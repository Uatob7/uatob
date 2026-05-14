const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const axios = require("axios");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const GOOGLE_MAPS_KEY = defineSecret("GOOGLE_MAPS_KEY");

// ── Haversine ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────
// autoUpdateTripStatus
// Called by driver app on every GPS ping.
// Writes driverLat/driverLng + auto-transitions status
// based on proximity to pickup or dropoff.
//
// Payload:  { rideId, driverUid, driverLat, driverLng }
// Returns:  { success, autoTransition }
//   autoTransition → null | "arrived" | "completed"
// ─────────────────────────────────────────────────────────
exports.autoUpdateTripStatus = onCall(
  { region: "us-east1" },
  async (request) => {
    try {
      const { rideId, driverUid, driverLat, driverLng } = request.data || {};

      if (!rideId || !driverUid || driverLat == null || driverLng == null) {
        throw new HttpsError(
          "invalid-argument",
          "Missing rideId, driverUid, driverLat, or driverLng"
        );
      }

      const rideRef = db.collection("Rides").doc(rideId);
      let autoTransition = null;

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(rideRef);

        if (!snap.exists) {
          throw new HttpsError("not-found", "Ride not found");
        }

        const ride = snap.data();

        if (ride.driverUid !== driverUid) {
          throw new HttpsError("permission-denied", "Unauthorized driver");
        }

        const { status, pickupLat, pickupLng, dropoffLat, dropoffLng } = ride;

        // Always write location
        const update = {
          driverLat,
          driverLng,
          driverLocationAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt:        admin.firestore.FieldValue.serverTimestamp(),
        };

        // ── driver_assigned → arrived ──────────────────
        if (status === "driver_assigned" && pickupLat && pickupLng) {
          const dist = haversineMiles(driverLat, driverLng, pickupLat, pickupLng);
          update.driverDistanceMiles = parseFloat(dist.toFixed(3));

          if (dist <= 0.2) {
            update.status    = "arrived";
            update.arrivedAt = admin.firestore.FieldValue.serverTimestamp();
            autoTransition   = "arrived";
            console.log(`[autoUpdateTripStatus] ${rideId} → arrived (${dist.toFixed(3)} mi)`);
          }
        }

        // ── in_progress → completed ────────────────────
        else if (status === "in_progress" && dropoffLat && dropoffLng) {
          const dist = haversineMiles(driverLat, driverLng, dropoffLat, dropoffLng);

          if (dist <= 0.2) {
            update.status      = "completed";
            update.completedAt = admin.firestore.FieldValue.serverTimestamp();
            autoTransition     = "completed";
            console.log(`[autoUpdateTripStatus] ${rideId} → completed (${dist.toFixed(3)} mi)`);
          }
        }

        tx.update(rideRef, update);
      });

      return { success: true, autoTransition };

    } catch (err) {
      console.error("[autoUpdateTripStatus]", err);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", err.message || "Failed to update trip");
    }
  }
);

// ─────────────────────────────────────────────────────────
// updateTripStatus
// Manual action — "start" only.
// arrived and completed are GPS-driven via autoUpdateTripStatus.
//
// Payload:  { rideId, driverUid, action }
// Returns:  { success, message }
// ─────────────────────────────────────────────────────────
exports.updateTripStatus = onCall(
  { region: "us-east1" },
  async (request) => {
    try {
      const { rideId, driverUid, action } = request.data || {};

      if (!rideId || !driverUid || !action) {
        throw new HttpsError(
          "invalid-argument",
          "Missing rideId, driverUid, or action"
        );
      }

      if (action !== "start") {
        throw new HttpsError(
          "invalid-argument",
          "Only 'start' is a valid manual action — arrived and completed are GPS-driven"
        );
      }

      const rideRef = db.collection("Rides").doc(rideId);

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(rideRef);

        if (!snap.exists) {
          throw new HttpsError("not-found", "Ride not found");
        }

        const ride = snap.data();

        if (ride.driverUid !== driverUid) {
          throw new HttpsError("permission-denied", "Unauthorized driver");
        }

        if (ride.status !== "arrived") {
          throw new HttpsError(
            "failed-precondition",
            "Cannot start trip — system hasn't confirmed arrival yet. Make sure you're within 0.2 miles of the pickup."
          );
        }

        tx.update(rideRef, {
          status:    "in_progress",
          startedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      console.log(`[updateTripStatus] ${rideId} → in_progress`);
      return { success: true, message: "Trip started" };

    } catch (err) {
      console.error("[updateTripStatus]", err);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", err.message || "Failed to start trip");
    }
  }
);

// ─────────────────────────────────────────────────────────
// getDriverToPickup
// Returns ETA, distance, and polyline from driver to pickup
// using Google Routes API (traffic-aware).
//
// Payload:  { driverLat, driverLng, pickupLat, pickupLng }
// Returns:  { etaMinutes, distanceMiles, polyline }
// ─────────────────────────────────────────────────────────
exports.getDriverToPickup = onCall(
  { region: "us-east1", secrets: [GOOGLE_MAPS_KEY] },
  async (request) => {
    try {
      const { driverLat, driverLng, pickupLat, pickupLng } = request.data ?? {};

      if (
        driverLat == null ||
        driverLng == null ||
        pickupLat == null ||
        pickupLng == null
      ) {
        throw new HttpsError(
          "invalid-argument",
          "driverLat, driverLng, pickupLat, pickupLng are required"
        );
      }

      const response = await axios.post(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
          origin: {
            location: {
              latLng: { latitude: driverLat, longitude: driverLng },
            },
          },
          destination: {
            location: {
              latLng: { latitude: pickupLat, longitude: pickupLng },
            },
          },
          travelMode:               "DRIVE",
          routingPreference:        "TRAFFIC_AWARE",
          computeAlternativeRoutes: false,
        },
        {
          headers: {
            "Content-Type":     "application/json",
            "X-Goog-Api-Key":   GOOGLE_MAPS_KEY.value(),
            "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
          },
          timeout: 8000,
        }
      );

      const route = response.data?.routes?.[0];
      if (!route) throw new HttpsError("not-found", "No route found");

      const durationSec    = parseInt(route.duration?.replace("s", "") || "0", 10);
      const distanceMeters = route.distanceMeters || 0;

      return {
        etaMinutes:    Math.ceil(durationSec / 60),
        distanceMiles: parseFloat((distanceMeters / 1609.34).toFixed(2)),
        polyline:      route.polyline?.encodedPolyline || null,
      };

    } catch (err) {
      console.error("[getDriverToPickup]", err);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", err.message || "Failed to get route");
    }
  }
);