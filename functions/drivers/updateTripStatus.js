const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");

const GOOGLE_MAPS_KEY = defineSecret("GOOGLE_MAPS_KEY");
const db = admin.firestore();

// ─── Proximity check via Routes API ───────────────────────────────────────────
async function getRouteDistanceMiles(originLat, originLng, destLat, destLng) {
  const response = await axios.post(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      origin:      { location: { latLng: { latitude: originLat, longitude: originLng } } },
      destination: { location: { latLng: { latitude: destLat,   longitude: destLng   } } },
      travelMode:               "DRIVE",
      routingPreference:        "TRAFFIC_AWARE",
      computeAlternativeRoutes: false,
    },
    {
      headers: {
        "Content-Type":     "application/json",
        "X-Goog-Api-Key":   GOOGLE_MAPS_KEY.value(),
        "X-Goog-FieldMask": "routes.distanceMeters",
      },
      timeout: 8000,
    }
  );

  const meters = response.data?.routes?.[0]?.distanceMeters;
  if (meters == null) throw new HttpsError("not-found", "No route found for proximity check");

  return meters / 1609.34; // → miles
}

// ─── updateTripStatus ──────────────────────────────────────────────────────────
exports.updateTripStatus = onCall(
  { region: "us-central1", secrets: [GOOGLE_MAPS_KEY] },
  async (request) => {
    try {
      const { rideId, driverUid, action, driverLat, driverLng } = request.data || {};

      if (!rideId || !driverUid || !action) {
        throw new HttpsError("invalid-argument", "Missing rideId, driverUid, or action");
      }

      // ── Require live GPS for location-gated actions ────────────────────────
      if (action === "arrive" || action === "complete") {
        if (driverLat == null || driverLng == null) {
          throw new HttpsError(
            "invalid-argument",
            "driverLat and driverLng are required for this action"
          );
        }
      }

      // ── Fetch ride BEFORE transaction for the proximity check ──────────────
      // (avoids an async Routes API call inside the transaction)
      const rideSnap = await db.collection("Rides").doc(rideId).get();
      if (!rideSnap.exists) throw new HttpsError("not-found", "Ride not found");

      const ride = rideSnap.data();

      if (ride.driverUid !== driverUid) {
        throw new HttpsError("permission-denied", "Unauthorized driver");
      }

      // ── Proximity gate ─────────────────────────────────────────────────────
      if (action === "arrive") {
        if (ride.status !== "driver_assigned") {
          throw new HttpsError("failed-precondition", "Invalid transition to arrived");
        }

        const ARRIVE_THRESHOLD_MI = 0.25;

        let distanceMiles;
        try {
          distanceMiles = await getRouteDistanceMiles(
            driverLat, driverLng,
            ride.pickupLat, ride.pickupLng
          );
        } catch (routeErr) {
          console.error("[updateTripStatus] Routes API failed for arrive check:", routeErr.message);
          throw new HttpsError("internal", "Could not verify your location. Please try again.");
        }

        console.log(`[arrive] Driver ${driverUid} is ${distanceMiles.toFixed(3)} mi from pickup`);

        if (distanceMiles > ARRIVE_THRESHOLD_MI) {
          throw new HttpsError(
            "failed-precondition",
            `You must be within ${ARRIVE_THRESHOLD_MI} mi of the pickup to mark arrived. ` +
            `Current distance: ${distanceMiles.toFixed(2)} mi.`
          );
        }
      }

      if (action === "complete") {
        if (ride.status !== "in_progress") {
          throw new HttpsError("failed-precondition", "Invalid transition to completed");
        }

        const COMPLETE_THRESHOLD_MI = 0.30;

        let distanceMiles;
        try {
          distanceMiles = await getRouteDistanceMiles(
            driverLat, driverLng,
            ride.dropoffLat, ride.dropoffLng
          );
        } catch (routeErr) {
          console.error("[updateTripStatus] Routes API failed for complete check:", routeErr.message);
          throw new HttpsError("internal", "Could not verify your location. Please try again.");
        }

        console.log(`[complete] Driver ${driverUid} is ${distanceMiles.toFixed(3)} mi from dropoff`);

        if (distanceMiles > COMPLETE_THRESHOLD_MI) {
          throw new HttpsError(
            "failed-precondition",
            `You must be within ${COMPLETE_THRESHOLD_MI} mi of the dropoff to complete the ride. ` +
            `Current distance: ${distanceMiles.toFixed(2)} mi.`
          );
        }
      }

      // ── Transactional status write ─────────────────────────────────────────
      await db.runTransaction(async (tx) => {
        const freshSnap = await tx.get(db.collection("Rides").doc(rideId));
        if (!freshSnap.exists) throw new HttpsError("not-found", "Ride not found");

        const freshRide = freshSnap.data();

        // Double-check auth inside transaction
        if (freshRide.driverUid !== driverUid) {
          throw new HttpsError("permission-denied", "Unauthorized driver");
        }

        let newStatus;
        const update = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

        if (action === "arrive") {
          if (freshRide.status !== "driver_assigned") {
            throw new HttpsError("failed-precondition", "Invalid transition to arrived");
          }
          newStatus = "arrived";
          update.arrivedAt = admin.firestore.FieldValue.serverTimestamp();

        } else if (action === "start") {
          if (freshRide.status !== "arrived") {
            throw new HttpsError("failed-precondition", "Invalid transition to in_progress");
          }
          newStatus = "in_progress";
          update.startedAt = admin.firestore.FieldValue.serverTimestamp();

        } else if (action === "complete") {
          if (freshRide.status !== "in_progress") {
            throw new HttpsError("failed-precondition", "Invalid transition to completed");
          }
          newStatus = "completed";
          update.completedAt = admin.firestore.FieldValue.serverTimestamp();

        } else {
          throw new HttpsError("invalid-argument", "Invalid action");
        }

        tx.update(db.collection("Rides").doc(rideId), { ...update, status: newStatus });
      });

      return { success: true, message: `Trip updated: ${action}` };

    } catch (err) {
      console.error("[updateTripStatus]", err);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", err.message || "Failed to update trip");
    }
  }
);