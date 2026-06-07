const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const axios = require("axios");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const GOOGLE_MAPS_KEY = defineSecret("GOOGLE_MAPS_KEY");

// ── Constants ──────────────────────────────────────────────────────────
const FRESH_MS           = 10 * 60 * 1000;
const STALE_MS           = 4  * 60 * 60 * 1000;
const STALE_PENALTY_SEC  = 5  * 60;   // softened: was 10 min, now 5
const TOP_N_ROUTES       = 5;         // bumped: more real ETAs = better accuracy
const TOP_N_HAVERSINE    = 10;

// ── Minimum display ETA — gives dispatch enough time to work ──────────
// Even if a driver is literally next door, we promise the rider 7 min.
// Real pickup could be faster; this just sets expectations correctly.
const MIN_DISPLAY_ETA_SEC = 7 * 60;   // 7 minutes

// Tier buffers: added ON TOP of the minimum, so premium always ≥ 9 min, etc.
const TIER_BUFFER_SEC = { economy: 0, standard: 0, premium: 120, xl: 60 };

const PRICING = {
  economy:  { id: "economy",  label: "Economy",  desc: "Affordable everyday rides", capacity: 4, base: 1.5,  perMile: 1.2,  perMin: 0.18, bookingFee: 0.99, minimumFare: 4.99 },
  standard: { id: "standard", label: "Standard", desc: "Comfortable daily rides",   capacity: 4, base: 2.0,  perMile: 1.65, perMin: 0.25, bookingFee: 1.29, minimumFare: 6.99 },
  premium:  { id: "premium",  label: "Premium",  desc: "Luxury rides",              capacity: 4, base: 3.0,  perMile: 2.50, perMin: 0.40, bookingFee: 1.79, minimumFare: 9.99 },
  xl:       { id: "xl",       label: "XL",       desc: "Large group rides",         capacity: 6, base: 2.25, perMile: 1.75, perMin: 0.28, bookingFee: 1.39, minimumFare: 7.99 },
};

// ── Helpers ───────────────────────────────────────────────────────────
const round2  = (n) => Number(Number(n).toFixed(2));
const clamp   = (n, lo, hi) => Math.min(Math.max(Number(n), lo), hi);
const clampTo0 = (n) => Math.max(0, n);  // guard against negative GPS artifacts

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

// ── ETA label — enforces the 7-min floor, tighter bands at low times ──
function formatEtaRange(rawEtaSec, stale = false) {
  // Never show under 7 min regardless of actual driver proximity
  const etaSec = Math.max(clampTo0(rawEtaSec), MIN_DISPLAY_ETA_SEC);
  const min    = Math.ceil(etaSec / 60);

  // Tighter band when close, wider when farther — feels more honest to riders
  const buffer = min <= 7  ? 2
               : min <= 12 ? 3
               :              5;

  const prefix = stale ? "~" : "";
  return `${prefix}${min}–${min + buffer} min`;
}

// ── Routes API (single driver → pickup) ──────────────────────────────
async function fetchRouteEta(driverLat, driverLng, pickupLat, pickupLng, apiKey) {
  const res = await axios.post(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      origin:      { location: { latLng: { latitude: driverLat, longitude: driverLng } } },
      destination: { location: { latLng: { latitude: pickupLat, longitude: pickupLng } } },
      travelMode:               "DRIVE",
      routingPreference:        "TRAFFIC_AWARE",
      computeAlternativeRoutes: false,
    },
    {
      headers: {
        "Content-Type":     "application/json",
        "X-Goog-Api-Key":   apiKey,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
      },
      timeout: 8000,
    }
  );

  const route = res.data?.routes?.[0];
  if (!route) return null;

  const distanceMeters  = route.distanceMeters ?? 0;
  const durationSeconds = parseInt(
    String(route.duration ?? "0s").replace("s", ""), 10
  ) || 0;

  return {
    distanceMiles: round2(distanceMeters / 1609.34),
    etaSeconds:    clampTo0(durationSeconds),   // guard negative
  };
}

// ── Core ETA resolution ───────────────────────────────────────────────
async function getDriverEta(pickupLat, pickupLng, apiKey) {
  const snap = await db.collection("Drivers").where("status", "==", "online").get();

  if (snap.empty) {
    console.log("[getDriverEta] No online drivers found");
    return null;
  }

  const now = Date.now();

  // 1. Score every online driver by haversine + staleness
  const scored = [];
  snap.forEach((doc) => {
    const d = doc.data();
    if (typeof d.lat !== "number" || typeof d.lng !== "number") return;

    const lastSeen = d.lastSeenAt?.toMillis?.() ?? 0;
    const ageMs    = now - lastSeen;
    if (ageMs > STALE_MS) return;   // location too old — skip entirely

    const miles = haversineMiles(pickupLat, pickupLng, d.lat, d.lng);
    const stale = ageMs > FRESH_MS;

    scored.push({ uid: doc.id, miles, stale, lat: d.lat, lng: d.lng });
  });

  if (scored.length === 0) {
    console.log("[getDriverEta] All online drivers had stale locations (>4h)");
    return null;
  }

  // Sort by haversine distance ascending
  scored.sort((a, b) => a.miles - b.miles);

  console.log(`[getDriverEta] ${scored.length} eligible drivers; querying Routes API for top ${Math.min(TOP_N_ROUTES, scored.length)}`);

  // 2. Candidate pool for dispatch (top 10 by haversine)
  const candidatePool = scored.slice(0, TOP_N_HAVERSINE).map((d) => ({
    uid:      d.uid,
    distance: round2(d.miles),
  }));

  // 3. Top N_ROUTES get real drive-time — run in parallel
  const routeTargets  = scored.slice(0, TOP_N_ROUTES);
  const routeResults  = await Promise.all(
    routeTargets.map(async (driver) => {
      try {
        const route = await fetchRouteEta(driver.lat, driver.lng, pickupLat, pickupLng, apiKey);
        if (!route) return null;

        const etaSeconds = clampTo0(route.etaSeconds + (driver.stale ? STALE_PENALTY_SEC : 0));

        return {
          uid:           driver.uid,
          distanceMiles: route.distanceMiles,
          etaSeconds,
          stale:         driver.stale,
        };
      } catch (err) {
        console.warn(`[getDriverEta] Routes API failed for driver ${driver.uid}:`, err.message);
        return null;
      }
    })
  );

  // 4. Pick the fastest real ETA among successful calls
  const valid = routeResults.filter(Boolean).sort((a, b) => a.etaSeconds - b.etaSeconds);

  if (valid.length === 0) {
    console.warn("[getDriverEta] All Routes API calls failed — no valid ETAs");
    return null;
  }

  const best = valid[0];

  console.log(`[getDriverEta] Best raw ETA: ${Math.ceil(best.etaSeconds / 60)} min (${best.distanceMiles} mi) — display floor: ${MIN_DISPLAY_ETA_SEC / 60} min`);

  return {
    // Raw real ETA (what dispatch logic can use for internal decisions)
    etaSeconds:    best.etaSeconds,
    etaMin:        Math.ceil(best.etaSeconds / 60),

    // Display ETA (enforces 7-min floor — what riders see)
    etaLabel:      formatEtaRange(best.etaSeconds, best.stale),
    nearestMiles:  best.distanceMiles,
    stale:         best.stale,
    driverCount:   valid.length,

    // Full candidate pool for dispatch
    candidateDrivers:    candidatePool,
    candidateDriverUids: candidatePool.map((d) => d.uid),
  };
}

// ── Per-tier ETA label (tier buffer stacks on top of the 7-min floor) ─
function buildTierEta(tierId, driverInfo) {
  if (!driverInfo) return null;

  // Apply the tier buffer to the raw ETA, THEN formatEtaRange re-applies the floor.
  // Result: economy/standard show exactly 7 min floor; premium ≥ 9 min; xl ≥ 8 min.
  const adjustedSec = clampTo0(driverInfo.etaSeconds) + (TIER_BUFFER_SEC[tierId] ?? 0);
  return formatEtaRange(adjustedSec, driverInfo.stale);
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
  {
    region:   "us-east1",
    invoker:  "public",
    secrets:  [GOOGLE_MAPS_KEY],
  },
  async (request) => {
    const uid       = request.auth?.uid ?? null;
    const miles     = Number(request.data?.miles);
    const minutes   = Number(request.data?.durationMin);
    const pickupLat = Number(request.data?.pickupLat);
    const pickupLng = Number(request.data?.pickupLng);

    if (!Number.isFinite(miles) || !Number.isFinite(minutes))
      throw new HttpsError("invalid-argument", "Invalid miles or duration");

    const cleanMiles   = clamp(round2(miles),   0, 300);
    const cleanMinutes = clamp(round2(minutes),  0, 600);
    const hasPickup    = Number.isFinite(pickupLat) && Number.isFinite(pickupLng);

    let driverInfo = null;
    if (hasPickup) {
      try {
        driverInfo = await getDriverEta(pickupLat, pickupLng, GOOGLE_MAPS_KEY.value());
      } catch (err) {
        console.error("[Price] getDriverEta threw unexpectedly:", err.message);
      }
    }

    const rides = Object.fromEntries(
      Object.entries(PRICING).map(([k, v]) => [
        k,
        calculateRidePrice(v, cleanMiles, cleanMinutes, buildTierEta(k, driverInfo)),
      ])
    );

    // Fire-and-forget — Search write doesn't block price response
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