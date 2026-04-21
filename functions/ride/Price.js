const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const PRICING = {
  economy:  { id: "economy",  label: "Economy",  desc: "Affordable everyday rides", capacity: 4, base: 1.5,  perMile: 1.2,  perMin: 0.18, bookingFee: 0.99, minimumFare: 4.99  },
  standard: { id: "standard", label: "Standard", desc: "Comfortable daily rides",   capacity: 4, base: 2.0,  perMile: 1.65, perMin: 0.25, bookingFee: 1.29, minimumFare: 6.99  },
  premium:  { id: "premium",  label: "Premium",  desc: "Luxury rides",              capacity: 4, base: 4.0,  perMile: 3.25, perMin: 0.5,  bookingFee: 1.99, minimumFare: 11.99 },
  xl:       { id: "xl",       label: "XL",       desc: "Large group rides",         capacity: 6, base: 2.5,  perMile: 1.9,  perMin: 0.3,  bookingFee: 1.49, minimumFare: 8.49  },
};

// Fallback ETAs if no drivers are online
const FALLBACK_ETA = {
  economy:  "7–20 min",
  standard: "2–7 min",
  premium:  "5–10 min",
  xl:       "5–9 min",
};

// Max minutes since last seen to consider a driver "truly online"
const MAX_STALE_MINUTES = 10;

const round2 = (n) => Number(Number(n).toFixed(2));
const clamp  = (n, min, max) => Math.min(Math.max(Number(n), min), max);

/**
 * Haversine distance in miles between two lat/lng points
 */
function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Given distance to nearest driver in miles, estimate ETA in minutes.
 * Assumes ~20 mph average city speed + 1 min buffer.
 */
function estimateEtaMinutes(driverMiles) {
  const AVG_SPEED_MPH = 20;
  const raw = (driverMiles / AVG_SPEED_MPH) * 60 + 1;
  return Math.max(1, Math.round(raw));
}

/**
 * Format ETA minutes into a display string.
 * e.g. 4 → "4–6 min", 12 → "12–15 min"
 */
function formatEtaRange(etaMin) {
  const buffer = etaMin <= 5 ? 2 : etaMin <= 10 ? 3 : 5;
  return `${etaMin}–${etaMin + buffer} min`;
}

/**
 * Query Firestore for online, recently-seen drivers near a pickup point.
 * Returns { etaMin, etaLabel, driverCount, nearestMiles }
 */
async function getDriverEta(pickupLat, pickupLng) {
  // Grab all drivers marked online (Firestore can't geo-query natively, so fetch all online)
  const snap = await db
    .collection("Drivers")
    .where("status", "==", "online")
    .get();

  if (snap.empty) return null;

  let nearest = null;
  let driverCount = 0;

  snap.forEach((doc) => {
    const d = doc.data();
    const stale = d.minutesSinceLastSeen ?? 9999;

    // Skip drivers who haven't been seen recently
    if (stale > MAX_STALE_MINUTES) return;
    // Skip drivers without location
    if (typeof d.lat !== "number" || typeof d.lng !== "number") return;

    driverCount++;
    const miles = haversineMiles(pickupLat, pickupLng, d.lat, d.lng);
    if (nearest === null || miles < nearest) nearest = miles;
  });

  if (nearest === null) return null; // No fresh drivers found

  const etaMin = estimateEtaMinutes(nearest);
  return {
    etaMin,
    etaLabel: formatEtaRange(etaMin),
    driverCount,
    nearestMiles: round2(nearest),
  };
}

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
      { key: "distance",   label: "Distance",    amount: distance,   note: `${miles} mi` },
      { key: "time",       label: "Time",        amount: time,       note: `${minutes} min` },
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
      { key: "bookingFee",      label: "Booking fee",          amount: feeA },
      { key: "minimumFareNote", label: "Minimum fare applied", amount: 0, note: `${p.label} minimum $${p.minimumFare}` },
    ];
  }

  return {
    id: p.id,
    label: p.label,
    desc: p.desc,
    eta: etaLabel,          // ← dynamic now
    capacity: p.capacity,
    total,
    receipt,
  };
}

exports.Price = onCall(
  { region: "us-east1" },
  async (request) => {
    const miles   = Number(request.data?.miles);
    const minutes = Number(request.data?.durationMin);
    const pickupLat = Number(request.data?.pickupLat);
    const pickupLng = Number(request.data?.pickupLng);

    if (!Number.isFinite(miles) || !Number.isFinite(minutes))
      throw new HttpsError("invalid-argument", "Invalid numbers");
    if (miles < 0 || minutes < 0)
      throw new HttpsError("invalid-argument", "Negative values not allowed");
    if (miles > 300)
      throw new HttpsError("invalid-argument", "Miles too large");
    if (minutes > 600)
      throw new HttpsError("invalid-argument", "Minutes too large");

    const cleanMiles   = clamp(round2(miles),   0, 300);
    const cleanMinutes = clamp(round2(minutes), 0, 600);

    // --- Fetch live driver ETA ---
    let driverInfo = null;
    const hasPickup = Number.isFinite(pickupLat) && Number.isFinite(pickupLng);
    if (hasPickup) {
      try {
        driverInfo = await getDriverEta(pickupLat, pickupLng);
      } catch (e) {
        console.warn("Driver ETA lookup failed:", e.message);
      }
    }

    // Build per-tier ETA labels
    // All tiers share the same nearest-driver wait time, but premium/xl
    // get a small buffer added since fewer of those vehicle types exist.
    function tierEta(tierId) {
      if (!driverInfo) return FALLBACK_ETA[tierId];
      const buffers = { economy: 0, standard: 0, premium: 2, xl: 1 };
      const adjusted = driverInfo.etaMin + (buffers[tierId] ?? 0);
      const bufferRange = adjusted <= 5 ? 2 : adjusted <= 10 ? 3 : 5;
      return `${adjusted}–${adjusted + bufferRange} min`;
    }

    const rides = Object.fromEntries(
      Object.entries(PRICING).map(([k, v]) => [
        k,
        calculateRidePrice(v, cleanMiles, cleanMinutes, tierEta(k)),
      ])
    );

    try {
      await db.collection("Search").add({
        pickup:       request.data?.pickup    ?? null,
        dropoff:      request.data?.dropoff   ?? null,
        miles:        cleanMiles,
        minutes:      cleanMinutes,
        polyline:     request.data?.polyline  ?? null,
        rides,
        driverInfo,   // log what we found
        createdAt:    FieldValue.serverTimestamp(),
      });
    } catch (dbErr) {
      console.error("Firestore write failed:", dbErr.message);
    }

    return {
      trip:        { miles: cleanMiles, minutes: cleanMinutes },
      rides,
      driverInfo,   // expose to client if you want to show "X drivers nearby"
      currency:    "USD",
      ok:          true,
      generatedAt: new Date().toISOString(),
    };
  }
);