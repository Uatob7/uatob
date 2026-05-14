const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const db = admin.firestore();


const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");

const GOOGLE_MAPS_KEY = defineSecret("GOOGLE_MAPS_KEY");

exports.getDriverToPickup = onCall(
  {
    region: "us-east1",
    secrets: [GOOGLE_MAPS_KEY],
  },
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
            "Content-Type":      "application/json",
            "X-Goog-Api-Key":    GOOGLE_MAPS_KEY.value(),
            "X-Goog-FieldMask":  "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
          },
          timeout: 8000,
        }
      );
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

      const rideRef = db.collection("Rides").doc(rideId);

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(rideRef);

        if (!snap.exists) {
          throw new HttpsError("not-found", "Ride not found");
        }

        const ride = snap.data();

        // 🔐 Ensure correct driver
        if (ride.driverUid !== driverUid) {
          throw new HttpsError("permission-denied", "Unauthorized driver");
        }

        let newStatus = ride.status;

        // ── STATE MACHINE ───────────────────────────────
        if (action === "arrive") {
          if (ride.status !== "driver_assigned") {
            throw new HttpsError(
              "failed-precondition",
              "Invalid transition to arrived"
            );
          }
          newStatus = "arrived";
        } else if (action === "start") {
          if (ride.status !== "arrived") {
            throw new HttpsError(
              "failed-precondition",
              "Invalid transition to in_progress"
            );
          }
          newStatus = "in_progress";
        } else if (action === "complete") {
          if (ride.status !== "in_progress") {
            throw new HttpsError(
              "failed-precondition",
              "Invalid transition to completed"
            );
          }
          newStatus = "completed";
        } else {
          throw new HttpsError("invalid-argument", "Invalid action");
        }

        const update = {
          status: newStatus,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (action === "arrive") {
          update.arrivedAt = admin.firestore.FieldValue.serverTimestamp();
        }

        if (action === "start") {
          update.startedAt = admin.firestore.FieldValue.serverTimestamp();
        }

        if (action === "complete") {
          update.completedAt = admin.firestore.FieldValue.serverTimestamp();
        }

        tx.update(rideRef, update);
      });

      return {
        success: true,
        message: `Trip updated: ${action}`,
      };
    } catch (err) {
      console.error("[updateTripStatus]", err);

      if (err instanceof HttpsError) throw err;

      throw new HttpsError(
        "internal",
        err.message || "Failed to update trip"
      );
    }
  }
);




Cloud Firestore
Database
(default)
Data
Rules
Indexes
Disaster Recovery
Usage
Query Insights
Extensions
Protect your Cloud Firestore resources from abuse, such as billing fraud or phishing



Rides
0PNnj6KWLaoxZxBw7RFD
(default)

Accounts

Admin

Drivers

Rides

Search

Support

SupportThreads
Rides

0PNnj6KWLaoxZxBw7RFD

1T0rQvkIpRYQaNyTm8lx

BCCx17PgJoEmjMnJZ6dK

PlzVo8BNK7YNtJxqkYEP

vBxXLEArYcXWayvUmBBc
0PNnj6KWLaoxZxBw7RFD
acceptedAt
May 14, 2026 at 7:05:46 PM UTC-4
(timestamp)


adminNotified
true
(boolean)


approvedDriversEmailedAt
May 14, 2026 at 6:56:02 PM UTC-4
(timestamp)


(map)


arrivedAt
May 14, 2026 at 7:12:34 PM UTC-4
(timestamp)


(array)


(array)


completedAt
May 14, 2026 at 7:12:38 PM UTC-4
(timestamp)


createdAt
May 10, 2026 at 7:27:46 PM UTC-4
(timestamp)


currentDriverIndex
0
(int64)


(array)


driverDistanceMiles
0.06
(double)


driverEtaMin
1
(int64)


(map)


driverLat
28.572790166666664
(double)


driverLng
-81.46882866666665
(double)


driverLocationAt
May 14, 2026 at 7:12:35 PM UTC-4
(timestamp)


driverPayout
12.22
(double)


driverUid
"duuEID4AofX1ooCLfSsfVMjJpUu1"
(string)


dropoff
"Downtown Orlando, Orlando, FL, USA"
(string)


dropoffCity
"Orlando"
(string)


dropoffLat
28.5475134
(double)


dropoffLng
-81.3791202
(double)


dropoffZip
"32801"
(string)


emailDispatchAt
May 14, 2026 at 6:56:03 PM UTC-4
(timestamp)


emailDispatchStarted
true
(boolean)


(map)


expiresAt
May 14, 2026 at 7:28:46 PM UTC-4
(timestamp)



fareBreakdown
(map)


fareTotal
16.29
(double)


lastDispatchAt
May 14, 2026 at 6:57:02 PM UTC-4
(timestamp)


lastPushAt
May 14, 2026 at 6:56:04 PM UTC-4
(timestamp)


offlineDriversEmailedAt
May 14, 2026 at 6:56:04 PM UTC-4
(timestamp)


(map)


paymentIntentId
"pi_3TVglBJhpOy6wtDq0RGBkPb4"
(string)


paymentMethod
"cashapp"
(string)


paymentStatus
"succeeded"
(string)


payoutStatus
"processing"
(string)


pickup
"2382 Locke Ave, Orlando, FL 32818, USA"
(string)


pickupCity
"Orlando"
(string)


pickupLat
28.5730568
(double)


pickupLng
-81.46963459999999
(double)


pickupZip
"32818"
(string)


platformFee
4.07
(double)


polyline
"wtkmDp~fpNxACLI?a@GeF@s@rk@IloAAjB?CaKe@mt@VgAb@e@dDFzAN`En@fGxANs@RiFDkG?iDK_@BeCKmgBH{BXeCX_Bd@aBhAwCbEmJd@wAl@oCTkBPgCB_BEum@FyCVwCZ_CZcBx@}CbAsCnAqCrm@k|@`AcBbAwB~@gCx@}Cd@aC\kCZwE@mPCgu@Ne@`@uOJmMJaAVcA`@y@l@s@t@e@t@Wx@MdABv@Jf@VPPP`@Bf@Gd@S^QLk@Lg@E]IO@gKiF_GsBqCm@uC_@cEWeCIiGBic@v@US}FAyFAAaI@cGrJA"
(string)


pushDispatchAt
May 14, 2026 at 6:56:04 PM UTC-4
(timestamp)


pushDispatchStarted
true
(boolean)


pushDriverIndex
7
(int64)


(map)


requestSentAt
May 14, 2026 at 7:05:15 PM UTC-4
(timestamp)


rideLabel
"Economy"
(string)


rideType
"economy"
(string)


startedAt
May 14, 2026 at 7:12:36 PM UTC-4
(timestamp)


status
"completed"
(string)


timedOutAt
May 14, 2026 at 6:55:01 PM UTC-4
(timestamp)


timeoutMinutes
1
(int64)


tripDistanceMiles
8.95
(double)


tripDurationMin
17
(int64)


uid
"duuEID4AofX1ooCLfSsfVMjJpUu1"
(string)


updatedAt
May 14, 2026 at 7:13:01 PM UTC-4