const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ── Pricing ────────────────────────────────────────────────────────────
const PRICING = {
  economy:  { id: "economy",  label: "Economy",  desc: "Affordable everyday rides", capacity: 4, base: 1.5,  perMile: 1.2,  perMin: 0.18, bookingFee: 0.99, minimumFare: 4.99  },
  standard: { id: "standard", label: "Standard", desc: "Comfortable daily rides",   capacity: 4, base: 2.0,  perMile: 1.65, perMin: 0.25, bookingFee: 1.29, minimumFare: 6.99  },
  premium:  { id: "premium",  label: "Premium",  desc: "Luxury rides",              capacity: 4, base: 4.0,  perMile: 3.25, perMin: 0.5,  bookingFee: 1.99, minimumFare: 11.99 },
  xl:       { id: "xl",       label: "XL",       desc: "Large group rides",         capacity: 6, base: 2.5,  perMile: 1.9,  perMin: 0.3,  bookingFee: 1.49, minimumFare: 8.49  },
};

// ── Fallback ETAs (only used if zero drivers in Firestore at all) ───────
const FALLBACK_ETA = {
  economy:  "15–25 min",
  standard: "15–25 min",
  premium:  "20–30 min",
  xl:       "18–28 min",
};

// ── Per-tier buffer minutes (premium/xl are rarer) ─────────────────────
const TIER_BUFFER = {
  economy:  0,
  standard: 0,
  premium:  2,
  xl:       1,
};

// ── Staleness windows ──────────────────────────────────────────────────
const FRESH_MS = 10 * 60 * 1000;       // 10 min  → live location, accurate ETA
const STALE_MS = 24 * 60 * 60 * 1000; // 24 hrs  → last known location, add penalty
const STALE_PENALTY_MIN = 10;          // extra minutes added when location is stale
const AVG_SPEED_MPH     = 20;          // assumed city driving speed

// ── Helpers ────────────────────────────────────────────────────────────
const round2 = (n) => Number(Number(n).toFixed(2));
const clamp  = (n, min, max) => Math.min(Math.max(Number(n), min), max);

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R    = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateEtaMinutes(miles) {
  return Math.max(1, Math.round((miles / AVG_SPEED_MPH) * 60 + 1));
}

function formatEtaRange(etaMin, stale = false) {
  const buffer = etaMin <= 5 ? 2 : etaMin <= 10 ? 3 : 5;
  const prefix = stale ? "~" : "";
  return `${prefix}${etaMin}–${etaMin + buffer} min`;
}

// ── Driver ETA lookup ──────────────────────────────────────────────────
async function getDriverEta(pickupLat, pickupLng) {
  const snap = await db
    .collection("Drivers")
    .where("status", "==", "online")
    .get();

  if (snap.empty) return null;

  const now = Date.now();

  let freshNearest = null;  // driver seen within 10 min
  let staleNearest = null;  // driver seen within 24 hrs
  let freshCount   = 0;

  snap.forEach((doc) => {
    const d = doc.data();

    // Must have a valid location
    if (typeof d.lat !== "number" || typeof d.lng !== "number") return;

    const lastSeen = d.lastSeenAt?.toMillis?.() ?? 0;
    const ageMs    = now - lastSeen;
    const miles    = haversineMiles(pickupLat, pickupLng, d.lat, d.lng);

    if (ageMs <= FRESH_MS) {
      // Live location — most accurate
      freshCount++;
      if (freshNearest === null || miles < freshNearest) freshNearest = miles;
    } else if (ageMs <= STALE_MS) {
      // Stale but still online status — use as fallback
      if (staleNearest === null || miles < staleNearest) staleNearest = miles;
    }
    // Beyond 24 hrs — ignore entirely
  });

  // ── Case 1: fresh drivers available ───────────────────────────────
  if (freshNearest !== null) {
    const etaMin = estimateEtaMinutes(freshNearest);
    return {
      etaMin,
      etaLabel:     formatEtaRange(etaMin, false),
      driverCount:  freshCount,
      nearestMiles: round2(freshNearest),
      stale:        false,
    };
  }

  // ── Case 2: only stale drivers (e.g. early launch, 1 driver) ──────
  if (staleNearest !== null) {
    const baseEta = estimateEtaMinutes(staleNearest);
    const etaMin  = baseEta + STALE_PENALTY_MIN;
    return {
      etaMin,
      etaLabel:     formatEtaRange(etaMin, true),
      driverCount:  1,
      nearestMiles: round2(staleNearest),
      stale:        true,
    };
  }

  // ── Case 3: online drivers but no usable location ─────────────────
  return null;
}

// ── Per-tier ETA label ─────────────────────────────────────────────────
function buildTierEta(tierId, driverInfo) {
  if (!driverInfo) return FALLBACK_ETA[tierId];

  const adjusted    = driverInfo.etaMin + (TIER_BUFFER[tierId] ?? 0);
  const buffer      = adjusted <= 5 ? 2 : adjusted <= 10 ? 3 : 5;
  const prefix      = driverInfo.stale ? "~" : "";
  return `${prefix}${adjusted}–${adjusted + buffer} min`;
}

// ── Fare calculator ────────────────────────────────────────────────────
function calculateRidePrice(p, miles, minutes, etaLabel) {
  const base     = p.base;
  const distance = round2(miles * p.perMile);
  const time     = round2(minutes * p.perMin);
  const fee      = p.bookingFee;
  const subtotal = round2(base + distance + time + fee);
  const hitMin   = subtotal < p.minimumFare;
  const total    = round2(hitMin ? p.minimumFare : subtotal);

  let receipt;
  if (!hitMin) {
    receipt = [
      { key: "baseFare",   label: "Base fare",   amount: round2(base) },
      { key: "distance",   label: "Distance",    amount: distance,    note: `${miles} mi` },
      { key: "time",       label: "Time",        amount: time,        note: `${minutes} min` },
      { key: "bookingFee", label: "Booking fee", amount: round2(fee) },
    ];
  } else {
    const scale = total / subtotal;
    const baseA = round2(base * scale);
    const distA = round2(distance * scale);
    const timeA = round2(time * scale);
    const feeA  = round2(total - baseA - distA - timeA);
    receipt = [
      { key: "baseFare",        label: "Base fare",            amount: baseA },
      { key: "distance",        label: "Distance",             amount: distA, note: `${miles} mi` },
      { key: "time",            label: "Time",                 amount: timeA, note: `${minutes} min` },
      { key: "bookingFee",      label: "Booking fee",          amount: feeA  },
      { key: "minimumFareNote", label: "Minimum fare applied", amount: 0,     note: `${p.label} minimum $${p.minimumFare}` },
    ];
  }

  return {
    id:       p.id,
    label:    p.label,
    desc:     p.desc,
    eta:      etaLabel,
    capacity: p.capacity,
    total,
    receipt,
  };
}

// ── Cloud Function ─────────────────────────────────────────────────────
exports.Price = onCall(
  {
    region: "us-east1",
    invoker: "public",
  },

  async (request) => {
    const miles     = Number(request.data?.miles);
    const minutes   = Number(request.data?.durationMin);
    const pickupLat = Number(request.data?.pickupLat);
    const pickupLng = Number(request.data?.pickupLng);

    // ── Validate ─────────────────────────────────────────────────────
    if (!Number.isFinite(miles) || !Number.isFinite(minutes))
      throw new HttpsError("invalid-argument", "Invalid miles or duration");
    if (miles < 0 || minutes < 0)
      throw new HttpsError("invalid-argument", "Negative values not allowed");
    if (miles > 300)
      throw new HttpsError("invalid-argument", "Miles too large");
    if (minutes > 600)
      throw new HttpsError("invalid-argument", "Minutes too large");

    const cleanMiles   = clamp(round2(miles),   0, 300);
    const cleanMinutes = clamp(round2(minutes), 0, 600);
    const hasPickup    = Number.isFinite(pickupLat) && Number.isFinite(pickupLng);

    // ── Driver ETA ───────────────────────────────────────────────────
    let driverInfo = null;
    if (hasPickup) {
      try {
        driverInfo = await getDriverEta(pickupLat, pickupLng);
      } catch (err) {
        console.warn("getDriverEta failed:", err.message);
        // Non-fatal — fall back to static ETAs
      }
    }

    // ── Build ride quotes ────────────────────────────────────────────
    const rides = Object.fromEntries(
      Object.entries(PRICING).map(([k, v]) => [
        k,
        calculateRidePrice(v, cleanMiles, cleanMinutes, buildTierEta(k, driverInfo)),
      ])
    );

    // ── Log to Firestore ─────────────────────────────────────────────
    try {
      await db.collection("Search").add({
        pickup:     request.data?.pickup   ?? null,
        dropoff:    request.data?.dropoff  ?? null,
        miles:      cleanMiles,
        minutes:    cleanMinutes,
        polyline:   request.data?.polyline ?? null,
        pickupLat:  hasPickup ? pickupLat  : null,
        pickupLng:  hasPickup ? pickupLng  : null,
        driverInfo,   // null if no drivers found, object if found
        rides,
        createdAt:  FieldValue.serverTimestamp(),
      });
    } catch (dbErr) {
      console.error("Firestore write failed:", dbErr.message);
    }

    // ── Response ─────────────────────────────────────────────────────
    return {
      trip: {
        miles:   cleanMiles,
        minutes: cleanMinutes,
      },
      rides,
      driverInfo,   // expose to client — use to show "X drivers nearby" etc.
      currency:    "USD",
      ok:          true,
      generatedAt: new Date().toISOString(),
    };
  }
);