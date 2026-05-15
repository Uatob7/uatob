// File: functions/findDriversScheduled.js

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const axios = require("axios");

const db = getFirestore();
const GOOGLE_MAPS_KEY = defineSecret("GOOGLE_MAPS_KEY");

const TOP_N_PREFILTER = 10;   // haversine → top 10 closest
const MAX_PER_RUN     = 20;   // rides processed per minute

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

/* ── Google Routes Matrix API ──────────────────────────────────── */
async function fetchDriveDistances(drivers, pickupLat, pickupLng, apiKey) {
  if (drivers.length === 0) return [];

  const body = {
    origins: drivers.map((d) => ({
      waypoint: {
        location: { latLng: { latitude: d.lat, longitude: d.lng } },
      },
    })),
    destinations: [{
      waypoint: {
        location: { latLng: { latitude: pickupLat, longitude: pickupLng } },
      },
    }],
    travelMode:        "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
  };

  const res = await axios.post(
    "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
    body,
    {
      headers: {
        "Content-Type":     "application/json",
        "X-Goog-Api-Key":   apiKey,
        "X-Goog-FieldMask": "originIndex,destinationIndex,distanceMeters,duration,condition",
      },
      timeout: 12000,
    }
  );

  // Each element: { originIndex, destinationIndex, distanceMeters, duration, condition }
  return res.data ?? [];
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
      .filter((d) => typeof d.lat === "number" && typeof d.lng === "number");

    if (allDrivers.length === 0) {
      console.log("[findDrivers] no drivers with valid coords");
      return;
    }

    const apiKey = GOOGLE_MAPS_KEY.value();

    // Process each ride
    const tasks = ridesSnap.docs.map(async (rideDoc) => {
      const ride    = rideDoc.data();
      const rideRef = rideDoc.ref;
      const { pickupLat, pickupLng } = ride;

      if (typeof pickupLat !== "number" || typeof pickupLng !== "number") {
        console.warn(`[findDrivers] missing pickup coords on ${rideDoc.id}`);
        return;
      }

      // ── Step 1: haversine pre-filter to top N ──────────────────
      const preFiltered = allDrivers
        .map((d) => ({
          uid:           d.uid,
          lat:           d.lat,
          lng:           d.lng,
          haversineDist: haversineMiles(d.lat, d.lng, pickupLat, pickupLng),
        }))
        .sort((a, b) => a.haversineDist - b.haversineDist)
        .slice(0, TOP_N_PREFILTER);

      // ── Step 2: Routes Matrix for real drive distances ─────────
      let elements = [];
      try {
        elements = await fetchDriveDistances(preFiltered, pickupLat, pickupLng, apiKey);
      } catch (err) {
        console.error(
          `[findDrivers] Routes API failed for ride ${rideDoc.id}:`,
          err?.response?.data || err.message
        );
        // Fallback: use haversine if Routes fails (better than nothing)
        const fallback = preFiltered.map((d) => ({
          uid:      d.uid,
          distance: Number(d.haversineDist.toFixed(2)),
          source:   "haversine_fallback",
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

      // ── Step 3: merge Routes results back with driver UIDs ─────
      const ranked = elements
        .filter((el) => el.condition === "ROUTE_EXISTS" && typeof el.distanceMeters === "number")
        .map((el) => {
          const driver        = preFiltered[el.originIndex];
          const distanceMiles = el.distanceMeters / 1609.34;
          const etaSeconds    = parseInt(String(el.duration ?? "0").replace("s", ""), 10) || 0;
          return {
            uid:       driver.uid,
            distance:  Number(distanceMiles.toFixed(2)),
            etaMin:    Math.ceil(etaSeconds / 60),
            source:    "routes",
          };
        })
        .sort((a, b) => a.distance - b.distance);

      if (ranked.length === 0) {
        console.warn(`[findDrivers] no valid routes for ride ${rideDoc.id}`);
        return;
      }

      await rideRef.update({
        candidateDrivers:    ranked,
        candidateDriverUids: ranked.map((d) => d.uid),
        currentDriverIndex:  0,
        requestSentAt:       FieldValue.serverTimestamp(),
      });

      console.log(`✅ Ride ${rideDoc.id} matched with ${ranked.length} drivers (real drive distance)`);
    });

    await Promise.allSettled(tasks);
  }
);