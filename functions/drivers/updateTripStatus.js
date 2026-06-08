const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const axios = require("axios");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const GOOGLE_MAPS_KEY = defineSecret("GOOGLE_MAPS_KEY");

// ── Proximity thresholds (meters) ─────────────────────────────────────
const PROXIMITY = {
  arrive:   300,  // must be at pickup
  start:    500,  // small forward movement allowed
  complete: 300,  // must be at dropoff
};

// Driver location must be fresher than this to be trusted
const MAX_LOCATION_AGE_MS = 2 * 60 * 1000;  // 2 minutes

const TRANSITIONS = {
  arrive: {
    from: "driver_assigned", to: "arrived",     field: "arrivedAt",
    targetLat: "pickupLat",  targetLng: "pickupLng",  targetName: "pickup",
  },
  start: {
    from: "arrived",         to: "in_progress", field: "startedAt",
    targetLat: "pickupLat",  targetLng: "pickupLng",  targetName: "pickup",
  },
  complete: {
    from: "in_progress",     to: ";;; ",   field: "completedAt",
    targetLat: "dropoffLat", targetLng: "dropoffLng", targetName: "dropoff",
  },
};

// ── Routes API call ───────────────────────────────────────────────────
async function getDistanceMeters(originLat, originLng, destLat, destLng, apiKey) {
  const res = await axios.post(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      origin:      { location: { latLng: { latitude: originLat, longitude: originLng } } },
      destination: { location: { latLng: { latitude: destLat,   longitude: destLng   } } },
      travelMode:               "DRIVE",
      routingPreference:        "TRAFFIC_UNAWARE",  // we only need distance, save quota
      computeAlternativeRoutes: false,
    },
    {
      headers: {
        "Content-Type":     "application/json",
        "X-Goog-Api-Key":   apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters",
      },
      timeout: 8000,
    }
  );

  const route = res.data?.routes?.[0];
  if (!route) throw new HttpsError("not-found", "Could not compute route");
  return route.distanceMeters ?? 0;
}

// ── Cloud Function ─────────────────────────────────────────────────────
exports.updateTripStatus = onCall(
  {
    region:  "us-east1",
    invoker: "public",
    secrets: [GOOGLE_MAPS_KEY],
  },
  async (request) => {
    const driverUid = request.auth?.uid;
    if (!driverUid) throw new HttpsError("unauthenticated", "Login required");

    const { rideId, action } = request.data || {};
    if (!rideId || !action) throw new HttpsError("invalid-argument", "Missing rideId or action");

    const transition = TRANSITIONS[action];
    if (!transition) throw new HttpsError("invalid-argument", `Invalid action: ${action}`);

    const rideRef = db.collection("Rides").doc(rideId);

    // ── Step 1: read ride (outside transaction so we can do the Routes API call) ──
    const snap = await rideRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Ride not found");

    const ride = snap.data();

    if (ride.driverUid !== driverUid)
      throw new HttpsError("permission-denied", "Unauthorized driver");

    if (ride.status !== transition.from)
      throw new HttpsError("failed-precondition", `Expected status '${transition.from}', got '${ride.status}'`);

    // ── Step 2: validate driver has a fresh location ──
    const { driverLat, driverLng, driverLocationAt } = ride;

    if (typeof driverLat !== "number" || typeof driverLng !== "number")
      throw new HttpsError("failed-precondition", "Driver location not available");

    const locationAgeMs = Date.now() - (driverLocationAt?.toMillis?.() ?? 0);
    if (locationAgeMs > MAX_LOCATION_AGE_MS) {
      throw new HttpsError(
        "failed-precondition",
        "Driver location is stale. Make sure your GPS is on and the app is open."
      );
    }

    // ── Step 3: proximity check via Routes API ──
    const targetLat = ride[transition.targetLat];
    const targetLng = ride[transition.targetLng];

    if (typeof targetLat !== "number" || typeof targetLng !== "number")
      throw new HttpsError("failed-precondition", `${transition.targetName} coordinates missing on ride`);

    let distanceMeters;
    try {
      distanceMeters = await getDistanceMeters(
        driverLat, driverLng, targetLat, targetLng, GOOGLE_MAPS_KEY.value()
      );
    } catch (err) {
      console.error(`[updateTripStatus] Routes API failed for ride ${rideId}:`, err.message);
      throw new HttpsError("internal", "Could not verify location. Try again.");
    }

    const allowedMeters = PROXIMITY[action];
    if (distanceMeters > allowedMeters) {
      throw new HttpsError(
        "failed-precondition",
        `You're too far from the ${transition.targetName} (${Math.round(distanceMeters)}m away). Get closer and try again.`
      );
    }

    // ── Step 4: transactional state transition ──
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(rideRef);
      if (!fresh.exists) throw new HttpsError("not-found", "Ride not found");

      // Re-check status inside the transaction in case it changed
      if (fresh.data().status !== transition.from)
        throw new HttpsError("failed-precondition", "Ride status changed, please refresh");

      tx.update(rideRef, {
        status:                       transition.to,
        [transition.field]:           admin.firestore.FieldValue.serverTimestamp(),
        [`${action}DistanceMeters`]:  Math.round(distanceMeters),  // audit trail
        updatedAt:                    admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return {
      success: true,
      action,
      status: transition.to,
      distanceMeters: Math.round(distanceMeters),
    };
  }
);