// File: functions/findDriversScheduled.js

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const axios = require("axios");

const db = getFirestore();
const GOOGLE_MAPS_KEY = defineSecret("GOOGLE_MAPS_KEY");

const TOP_N_PREFILTER   = 10;  // haversine → top 10 closest
const MAX_PER_RUN       = 20;  // rides processed per minute
const MAX_MINUTES_STALE = 10;  // ignore drivers not seen in 10+ min

/* ── Haversine (cheap pre-filter only) ─────────────────────────── */
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

/* ── Google Routes API (one route per driver) ──────────────────── */
async function fetchDriveRoute(driverLat, driverLng, pickupLat, pickupLng, apiKey) {
  const res = await axios.post(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      origin: {
        location: { latLng: { latitude: driverLat, longitude: driverLng } },
      },
      destination: {
        location: { latLng: { latitude: pickupLat, longitude: pickupLng } },
      },
      travelMode:               "DRIVE",
      routingPreference:        "TRAFFIC_AWARE",
      computeAlternativeRoutes: false,
    },
    {
      headers: {
        "Content-Type":     "application/json",
        "X-Goog-Api-Key":   apiKey,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
      },
      timeout: 8000,
    }
  );

  const route = res.data?.routes?.[0];
  if (!route) return null;

  const distanceMeters = route.distanceMeters;
  const etaSeconds     = parseInt(String(route.duration ?? "0").replace("s", ""), 10) || 0;
  const polyline       = route.polyline?.encodedPolyline ?? null;

  return {
    distanceMeters,
    distanceMiles: Number((distanceMeters / 1609.34).toFixed(2)),
    distanceText:  `${(distanceMeters / 1609.34).toFixed(1)} mi`,
    etaSeconds,
    etaMin:        Math.ceil(etaSeconds / 60),
    etaText:       `${Math.ceil(etaSeconds / 60)} mins`,
    polyline,
  };
}

/* ── Scheduled Function ────────────────────────────────────────── */
exports.findDrivers = onSchedule(
  {
    schedule: "every 1 minutes",
    region:   "us-east1",
    secrets:  [GOOGLE_MAPS_KEY],
  },
  async () => {
    console.log("[findDrivers] running...");

    // Rides waiting for drivers
    const ridesSnap = await db
      .collection("Rides")
      .where("status", "==", "searching_driver")
      .limit(MAX_PER_RUN)
      .get();

    if (ridesSnap.empty) {
      console.log("[findDrivers] no rides waiting");
      return;
    }

    console.log(`[findDrivers] processing ${ridesSnap.size} ride(s)`);

    // Online drivers (fetched once for all rides)
    const driversSnap = await db
      .collection("Drivers")
      .where("status", "==", "online")
      .get();

    if (driversSnap.empty) {
      console.log("[findDrivers] no drivers online");
      return;
    }

    const allDrivers = driversSnap.docs
      .map((doc) => ({ uid: doc.id, ...doc.data() }))
      .filter((d) => {
        if (typeof d.lat !== "number" || typeof d.lng !== "number") return false;
        if (d.trip === true) return false;
        if ((d.minutesSinceLastSeen ?? 999) > MAX_MINUTES_STALE) return false;
        return true;
      });

    if (allDrivers.length === 0) {
      console.log("[findDrivers] no eligible drivers (online, not on trip, recently seen)");
      return;
    }

    const apiKey = GOOGLE_MAPS_KEY.value();

    // Process each ride
    const tasks = ridesSnap.docs.map(async (rideDoc) => {
      const ride    = rideDoc.data();
      const rideRef = rideDoc.ref;
      const { pickupLat, pickupLng, rideType } = ride;

      if (typeof pickupLat !== "number" || typeof pickupLng !== "number") {
        console.warn(`[findDrivers] missing pickup coords on ${rideDoc.id}`);
        return;
      }

      // ── Filter by ride type ────────────────────────────────────
      const eligibleDrivers = allDrivers.filter((d) =>
        !rideType || (Array.isArray(d.rideTypes) && d.rideTypes.includes(rideType))
      );

      if (eligibleDrivers.length === 0) {
        console.warn(`[findDrivers] no drivers support rideType "${rideType}" for ride ${rideDoc.id}`);
        return;
      }

      // ── Step 1: haversine pre-filter to top N ──────────────────
      const preFiltered = eligibleDrivers
        .map((d) => ({
          uid:           d.uid,
          lat:           d.lat,
          lng:           d.lng,
          haversineDist: haversineMiles(d.lat, d.lng, pickupLat, pickupLng),
        }))
        .sort((a, b) => a.haversineDist - b.haversineDist)
        .slice(0, TOP_N_PREFILTER);

      // ── Step 2: computeRoutes per driver in parallel ───────────
      const routeResults = await Promise.allSettled(
        preFiltered.map((d) =>
          fetchDriveRoute(d.lat, d.lng, pickupLat, pickupLng, apiKey)
        )
      );

      // ── Step 3: merge results, filter failures, rank by distance ─
      const ranked = routeResults
        .map((result, i) => {
          if (result.status !== "fulfilled" || !result.value) return null;
          return {
            uid:    preFiltered[i].uid,
            lat:    preFiltered[i].lat,
            lng:    preFiltered[i].lng,
            source: "routes",
            ...result.value,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.distanceMiles - b.distanceMiles);

      if (ranked.length === 0) {
        console.warn(`[findDrivers] no valid routes for ride ${rideDoc.id} — falling back to haversine`);

        const fallback = preFiltered.map((d) => ({
          uid:           d.uid,
          lat:           d.lat,
          lng:           d.lng,
          distanceMiles: Number(d.haversineDist.toFixed(2)),
          distanceText:  `${d.haversineDist.toFixed(1)} mi`,
          source:        "haversine_fallback",
        }));

        await rideRef.update({
          candidateDrivers:    fallback,
          candidateDriverUids: fallback.map((d) => d.uid),
          currentDriverIndex:  0,
          requestSentAt:       FieldValue.serverTimestamp(),
        });
        console.log(`⚠️  Ride ${rideDoc.id} matched with ${fallback.length} drivers (haversine fallback)`);
        return;
      }

      await rideRef.update({
        candidateDrivers:    ranked,
        candidateDriverUids: ranked.map((d) => d.uid),
        currentDriverIndex:  0,
        requestSentAt:       FieldValue.serverTimestamp(),
      });

      console.log(`✅ Ride ${rideDoc.id} → ${ranked.length} drivers | closest: ${ranked[0].uid} @ ${ranked[0].distanceText} / ${ranked[0].etaText} | lat: ${ranked[0].lat} lng: ${ranked[0].lng}`);
    });

    await Promise.allSettled(tasks);
  }
);