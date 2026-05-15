const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const axios = require("axios");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const GOOGLE_MAPS_KEY = defineSecret("GOOGLE_MAPS_KEY");

// ── Constants ──────────────────────────────────────────────────────────
const FRESH_MS          = 10 * 60 * 1000;
const STALE_MS          = 4  * 60 * 60 * 1000;
const STALE_PENALTY_SEC = 10 * 60;
const TOP_N_ROUTES      = 3;   // call Routes API for these
const TOP_N_HAVERSINE   = 10;  // keep these as haversine-only fallbacks for dispatch

const TIER_BUFFER_SEC = { economy: 0, standard: 0, premium: 120, xl: 60 };

const PRICING = {
  economy:  { id: "economy",  label: "Economy",  desc: "Affordable everyday rides", capacity: 4, base: 1.5,  perMile: 1.2,  perMin: 0.18, bookingFee: 0.99, minimumFare: 4.99 },
  standard: { id: "standard", label: "Standard", desc: "Comfortable daily rides",   capacity: 4, base: 2.0,  perMile: 1.65, perMin: 0.25, bookingFee: 1.29, minimumFare: 6.99 },
  premium:  { id: "premium",  label: "Premium",  desc: "Luxury rides",              capacity: 4, base: 3.0,  perMile: 2.50, perMin: 0.40, bookingFee: 1.79, minimumFare: 9.99 },
  xl:       { id: "xl",       label: "XL",       desc: "Large group rides",         capacity: 6, base: 2.25, perMile: 1.75, perMin: 0.28, bookingFee: 1.39, minimumFare: 7.99 },
};

// ── Helpers ───────────────────────────────────────────────────────────
const round2 = (n) => Number(Number(n).toFixed(2));
const clamp  = (n, lo, hi) => Math.min(Math.max(Number(n), lo), hi);

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

function formatEtaRange(etaSec, stale = false) {
  const min = Math.ceil(etaSec / 60);
  const buffer = min <= 5 ? 2 : min <= 10 ? 3 : 5;
  return `${stale ? "~" : ""}${min}–${min + buffer} min`;
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
    etaSeconds:    durationSeconds,
  };
}

// ── Core ETA resolution ───────────────────────────────────────────────
async function getDriverEta(pickupLat, pickupLng, apiKey) {
  const snap = await db.collection("Drivers").where("status", "==", "online").get();
  if (snap.empty) return null;

  const now = Date.now();

  // 1. Score every online driver by haversine + staleness
  const scored = [];
  snap.forEach((doc) => {
    const d = doc.data();
    if (typeof d.lat !== "number" || typeof d.lng !== "number") return;

    const lastSeen = d.lastSeenAt?.toMillis?.() ?? 0;
    const ageMs    = now - lastSeen;
    if (ageMs > STALE_MS) return;                        // too stale — skip entirely

    const miles = haversineMiles(pickupLat, pickupLng, d.lat, d.lng);
    const stale = ageMs > FRESH_MS;

    scored.push({ uid: doc.id, miles, stale, lat: d.lat, lng: d.lng });
  });

  if (scored.length === 0) return null;

  // Sort by haversine distance ascending
  scored.sort((a, b) => a.miles - b.miles);

  // 2. Top N_HAVERSINE become the candidate pool (matches your Firestore schema)
  //    Shape: [{ uid, distance }] — same as candidateDrivers[] on Ride docs
  const candidatePool = scored.slice(0, TOP_N_HAVERSINE).map((d) => ({
    uid:      d.uid,
    distance: round2(d.miles),
  }));

  // 3. Top N_ROUTES get real drive-time from Routes API — run in parallel
  const routeTargets = scored.slice(0, TOP_N_ROUTES);

  const routeResults = await Promise.all(
    routeTargets.map(async (driver) => {
      try {
        const route = await fetchRouteEta(driver.lat, driver.lng, pickupLat, pickupLng, apiKey);
        if (!route) return null;
        return {
          uid:          driver.uid,
          distanceMiles: route.distanceMiles,
          etaSeconds:   route.etaSeconds + (driver.stale ? STALE_PENALTY_SEC : 0),
          stale:        driver.stale,
        };
      } catch (err) {
        // One driver's Routes API call failed — don't crash the whole Price call
        console.warn(`[getDriverEta] Routes API failed for ${driver.uid}:`, err.message);
        return null;
      }
    })
  );

  // 4. Pick the fastest real ETA among successful calls
  const valid = routeResults.filter(Boolean).sort((a, b) => a.etaSeconds - b.etaSeconds);
  if (valid.length === 0) return null;

  const best = valid[0];

  return {
    // What the rider sees
    etaSeconds:    best.etaSeconds,
    etaMin:        Math.ceil(best.etaSeconds / 60),
    etaLabel:      formatEtaRange(best.etaSeconds, best.stale),
    nearestMiles:  best.distanceMiles,
    stale:         best.stale,
    driverCount:   valid.length,

    // Full pool — dispatch reads this to work down the list on timeout/decline
    // Matches your existing candidateDrivers[] + candidateDriverUids[] schema
    candidateDrivers:    candidatePool,
    candidateDriverUids: candidatePool.map((d) => d.uid),
  };
}

// ── Per-tier ETA label ─────────────────────────────────────────────────
function buildTierEta(tierId, driverInfo) {
  if (!driverInfo) return null;
  const adjustedSec = driverInfo.etaSeconds + (TIER_BUFFER_SEC[tierId] ?? 0);
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
    id: p.id, label: p.label, desc: p.desc,
    eta: etaLabel, capacity: p.capacity, total,
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
        console.error("[Price] getDriverEta failed:", err.message);
      }
    }

    const rides = Object.fromEntries(
      Object.entries(PRICING).map(([k, v]) => [
        k,
        calculateRidePrice(v, cleanMiles, cleanMinutes, buildTierEta(k, driverInfo)),
      ])
    );

    // Fire-and-forget Search write — doesn't block the price response
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
      trip:      { miles: cleanMiles, minutes: cleanMinutes },
      rides,
      driverInfo,   // includes candidateDrivers[] + candidateDriverUids[] for dispatch
      currency:  "USD",
      ok:        true,
      generatedAt: new Date().toISOString(),
    };
  }
);