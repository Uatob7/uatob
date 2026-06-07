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
const FRESH_MS          = 10 * 60 * 1000;       // 10 min
const STALE_MS          = 4  * 60 * 60 * 1000;  // 4 hours
const STALE_PENALTY_MIN = 10;
const AVG_SPEED_MPH     = 25;
const MIN_ETA_MIN       = 7;  // floor — dispatch needs time to confirm

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
  return Math.max(MIN_ETA_MIN, Math.round((miles / AVG_SPEED_MPH) * 60 + 1));
}

function formatEtaRange(etaMin, stale = false) {
  const buffer = etaMin <= 7  ? 2
               : etaMin <= 12 ? 3
               :                5;
  return `${stale ? "~" : ""}${etaMin}–${etaMin + buffer} min`;
}

// Pull presence age from whichever heartbeat field exists, tolerating both
// Firestore Timestamp objects and raw millisecond numbers. Returns null when
// no usable signal is present.
function presenceMillis(d) {
  const fromTs = (v) =>
    (v && typeof v.toMillis === "function") ? v.toMillis()
    : (typeof v === "number")               ? v
    :                                         null;

  return (
    fromTs(d.presenceUpdatedAt) ??
    fromTs(d.lastSeenAt) ??
    fromTs(d.updatedAt) ??
    null
  );
}

// ── Driver ETA ────────────────────────────────────────────────────────
async function getDriverEta(pickupLat, pickupLng) {

  // Query by status ONLY. A Firestore inequality on presenceUpdatedAt silently
  // excludes any driver whose field is missing, stale, or the wrong type — which
  // is exactly how a nearby online driver disappears. We evaluate freshness in
  // code below so a known-online driver is never dropped on a flaky heartbeat.
  const snap = await db
    .collection("Drivers")
    .where("status", "==", "online")
    .get();

  if (snap.empty) {
    console.log("[getDriverEta] No online drivers found");
    return null;
  }

  const now = Date.now();

  let freshNearest = null;
  let staleNearest = null;
  let freshCount   = 0;

  snap.forEach((doc) => {
    const d = doc.data();
    if (typeof d.lat !== "number" || typeof d.lng !== "number") return;

    const lastPresence = presenceMillis(d);
    const miles        = haversineMiles(pickupLat, pickupLng, d.lat, d.lng);

    // No presence signal at all → trust the online flag and treat as fresh
    // (age 0) rather than discarding the driver.
    const ageMs = lastPresence === null ? 0 : now - lastPresence;

    // Only discard when we KNOW the driver is past the stale cutoff.
    if (lastPresence !== null && ageMs > STALE_MS) return;

    if (ageMs <= FRESH_MS) {
      freshCount++;
      if (freshNearest === null || miles < freshNearest) freshNearest = miles;
    } else {
      // Between FRESH_MS and STALE_MS — stale but still eligible.
      if (staleNearest === null || miles < staleNearest) staleNearest = miles;
    }
  });

  if (freshNearest !== null) {
    const etaMin = estimateEtaMinutes(freshNearest);
    console.log(`[getDriverEta] Fresh driver found — ${etaMin} min, ${round2(freshNearest)} mi`);
    return {
      etaMin,
      etaLabel:     formatEtaRange(etaMin),
      driverCount:  freshCount,
      nearestMiles: round2(freshNearest),
      stale:        false,
    };
  }

  if (staleNearest !== null) {
    const etaMin = estimateEtaMinutes(staleNearest) + STALE_PENALTY_MIN;
    console.log(`[getDriverEta] Stale driver only — ${etaMin} min, ${round2(staleNearest)} mi`);
    return {
      etaMin,
      etaLabel:     formatEtaRange(etaMin, true),
      driverCount:  1,
      nearestMiles: round2(staleNearest),
      stale:        true,
    };
  }

  console.log("[getDriverEta] Online drivers found but none had valid coordinates");
  return null;
}

// ── Per-tier ETA label ────────────────────────────────────────────────
function buildTierEta(tierId, driverInfo) {
  if (!driverInfo) return null;
  const adjusted = driverInfo.etaMin + (TIER_BUFFER[tierId] ?? 0);
  const buffer   = adjusted <= 7  ? 2
                 : adjusted <= 12 ? 3
                 :                  5;
  return `${driverInfo.stale ? "~" : ""}${adjusted}–${adjusted + buffer} min`;
}

// ── Pricing ───────────────────────────────────────────────────────────
function calculateRidePrice(p, miles, minutes, etaLabel) {
  const base     = p.base;
  const distance = round2(miles   * p.perMile);
  const time     = round2(minutes * p.perMin);
  const fee      = p.bookingFee;
  const subtotal = round2(base + distance + time + fee);
  const total    = round2(subtotal < p.minimumFare ? p.minimumFare : subtotal);

  return {
    id:       p.id,
    label:    p.label,
    desc:     p.desc,
    eta:      etaLabel,
    capacity: p.capacity,
    total,
  };
}

// ── Cloud Function ─────────────────────────────────────────────────────
exports.Price = onCall(
  { region: "us-east1", invoker: "public" },
  async (request) => {

    const uid       = request.auth?.uid ?? null;
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
      } catch (err) {
        console.error("[Price] getDriverEta failed:", err.message);
      }
    }

    const rides = Object.fromEntries(
      Object.entries(PRICING).map(([k, v]) => [
        k,
        calculateRidePrice(v, cleanMiles, cleanMinutes, buildTierEta(k, driverInfo)),
      ])
    );

    // Fire-and-forget — doesn't block the price response
    db.collection("Search").add({
      uid,
      pickup:    request.data?.pickup  ?? null,
      dropoff:   request.data?.dropoff ?? null,
      miles:     cleanMiles,
      minutes:   cleanMinutes,
      pickupLat: hasPickup ? pickupLat : null,
      pickupLng: hasPickup ? pickupLng : null,
      driverInfo,
      rides,
      createdAt: FieldValue.serverTimestamp(),
    }).catch((err) => console.error("[Price] Search write failed:", err));

    return {
      trip:        { miles: cleanMiles, minutes: cleanMinutes },
      rides,
      driverInfo,
      currency:    "USD",
      ok:          true,
      generatedAt: new Date().toISOString(),
    };
  }
);
