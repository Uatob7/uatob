const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ── Pricing ────────────────────────────────────────────────────────────
const PRICING = {
  economy:  { id: "economy",  label: "Economy",  desc: "Affordable everyday rides", capacity: 4, base: 1.5,  perMile: 1.2,  perMin: 0.18, bookingFee: 0.99, minimumFare: 4.99 },
  standard: { id: "standard", label: "Standard", desc: "Comfortable daily rides",   capacity: 4, base: 2.0,  perMile: 1.65, perMin: 0.25, bookingFee: 1.29, minimumFare: 6.99 },
  premium:  { id: "premium",  label: "Premium",  desc: "Luxury rides",              capacity: 4, base: 3.0,  perMile: 2.50, perMin: 0.40, bookingFee: 1.79, minimumFare: 9.99 },
  xl:       { id: "xl",       label: "XL",       desc: "Large group rides",         capacity: 6, base: 2.25, perMile: 1.75, perMin: 0.28, bookingFee: 1.39, minimumFare: 7.99 },
};

// ── Buffers (per-tier ETA padding) ────────────────────────────────────
const TIER_BUFFER = {
  economy:  0,
  standard: 0,
  premium:  2,
  xl:       1,
};

// ── Timing config ─────────────────────────────────────────────────────
// CRITICAL FIX #5: stale window tightened from 24h → 4h.
// A driver who hasn't pinged in 24h is almost certainly offline.
// 4h keeps recently-active-but-currently-AFK drivers in the pool
// without showing "ghost" drivers who left for the day.
const FRESH_MS = 10 * 60 * 1000;          // 10 min
const STALE_MS = 4 * 60 * 60 * 1000;      // 4 hours (was 24h)
const STALE_PENALTY_MIN = 10;

// CRITICAL FIX #4: 25 mph is realistic for Orlando city traffic.
// 40 mph was highway-average and produced systematically optimistic
// ETAs (40-60% too fast). Riders waited longer than promised → 1-star reviews.
const AVG_SPEED_MPH = 25;                 // was 40

// ── Helpers ───────────────────────────────────────────────────────────
const round2 = (n) => Number(Number(n).toFixed(2));
const clamp  = (n, min, max) => Math.min(Math.max(Number(n), min), max);

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
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

// ── Driver ETA ────────────────────────────────────────────────────────
async function getDriverEta(pickupLat, pickupLng) {
  const snap = await db.collection("Drivers").where("status", "==", "online").get();
  if (snap.empty) return null;

  const now = Date.now();

  let freshNearest = null;
  let staleNearest = null;
  let freshCount = 0;

  snap.forEach((doc) => {
    const d = doc.data();
    if (typeof d.lat !== "number" || typeof d.lng !== "number") return;

    const lastSeen = d.lastSeenAt?.toMillis?.() ?? 0;
    const ageMs = now - lastSeen;
    const miles = haversineMiles(pickupLat, pickupLng, d.lat, d.lng);

    if (ageMs <= FRESH_MS) {
      freshCount++;
      if (freshNearest === null || miles < freshNearest) freshNearest = miles;
    } else if (ageMs <= STALE_MS) {
      if (staleNearest === null || miles < staleNearest) staleNearest = miles;
    }
  });

  if (freshNearest !== null) {
    const etaMin = estimateEtaMinutes(freshNearest);
    return {
      etaMin,
      etaLabel: formatEtaRange(etaMin),
      driverCount: freshCount,
      nearestMiles: round2(freshNearest),
      stale: false,
    };
  }

  if (staleNearest !== null) {
    const etaMin = estimateEtaMinutes(staleNearest) + STALE_PENALTY_MIN;
    return {
      etaMin,
      etaLabel: formatEtaRange(etaMin, true),
      driverCount: 1,
      nearestMiles: round2(staleNearest),
      stale: true,
    };
  }

  return null;
}

// CRITICAL FIX #3: when no drivers exist, return null instead of a
// fake fallback ETA. Riders saw "15-25 min" even when zero drivers
// were online — they'd book, no driver came, they uninstalled.
// Honest unavailability builds more trust than fake availability.
// Client should render "Drivers limited" state when eta is null.
function buildTierEta(tierId, driverInfo) {
  if (!driverInfo) return null;
  const adjusted = driverInfo.etaMin + (TIER_BUFFER[tierId] ?? 0);
  const buffer = adjusted <= 5 ? 2 : adjusted <= 10 ? 3 : 5;
  const prefix = driverInfo.stale ? "~" : "";
  return `${prefix}${adjusted}–${adjusted + buffer} min`;
}

// ── Pricing ───────────────────────────────────────────────────────────
function calculateRidePrice(p, miles, minutes, etaLabel) {
  const base = p.base;
  const distance = round2(miles * p.perMile);
  const time = round2(minutes * p.perMin);
  const fee = p.bookingFee;
  const subtotal = round2(base + distance + time + fee);
  const hitMin = subtotal < p.minimumFare;
  const total = round2(hitMin ? p.minimumFare : subtotal);

  return {
    id: p.id,
    label: p.label,
    desc: p.desc,
    eta: etaLabel,
    capacity: p.capacity,
    total,
  };
}

// ── Cloud Function ─────────────────────────────────────────────────────
exports.Price = onCall(
  { region: "us-east1", invoker: "public" },
  async (request) => {

    // CRITICAL FIX #1: uid is taken ONLY from auth context, never the
    // client payload. Previously a malicious client could pass any
    // uid and impersonate other users in our analytics — breaking
    // search history, abuse detection, and per-user rate limiting.
    // Guests legitimately have no uid; we record them as null.
    const uid = request.auth?.uid ?? null;

    const miles     = Number(request.data?.miles);
    const minutes   = Number(request.data?.durationMin);
    const pickupLat = Number(request.data?.pickupLat);
    const pickupLng = Number(request.data?.pickupLng);

    if (!Number.isFinite(miles) || !Number.isFinite(minutes))
      throw new HttpsError("invalid-argument", "Invalid miles or duration");

    const cleanMiles   = clamp(round2(miles),   0, 300);
    const cleanMinutes = clamp(round2(minutes), 0, 600);
    const hasPickup    = Number.isFinite(pickupLat) && Number.isFinite(pickupLng);

    let driverInfo = null;
    if (hasPickup) {
      try {
        driverInfo = await getDriverEta(pickupLat, pickupLng);
      } catch {}
    }

    const rides = Object.fromEntries(
      Object.entries(PRICING).map(([k, v]) => [
        k,
        calculateRidePrice(v, cleanMiles, cleanMinutes, buildTierEta(k, driverInfo)),
      ])
    );

    // CRITICAL FIX #2: Search write is fire-and-forget.
    // Previously every rider waited for this Firestore write (200-800ms)
    // before seeing their price. Analytics shouldn't block UX.
    // If the write fails, the price still returns correctly — we
    // just lose one analytics row. Acceptable trade.
    db.collection("Search").add({
      uid,
      pickup: request.data?.pickup ?? null,
      dropoff: request.data?.dropoff ?? null,
      miles: cleanMiles,
      minutes: cleanMinutes,
      pickupLat: hasPickup ? pickupLat : null,
      pickupLng: hasPickup ? pickupLng : null,
      driverInfo,
      rides,
      createdAt: FieldValue.serverTimestamp(),
    }).catch((err) => {
      console.error("[Price] Search write failed:", err);
    });

    return {
      trip: { miles: cleanMiles, minutes: cleanMinutes },
      rides,
      driverInfo,
      currency: "USD",
      ok: true,
      generatedAt: new Date().toISOString(),
    };
  }
);
