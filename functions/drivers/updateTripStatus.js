const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");

const GOOGLE_MAPS_KEY = defineSecret("GOOGLE_MAPS_KEY");


const db = admin.firestore();

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

      const route = response.data?.routes?.[0];

      if (!route) {
        throw new HttpsError("not-found", "No route found");
      }

      const distanceMeters  = route.distanceMeters;
      const durationSeconds = parseInt(String(route.duration ?? "0").replace("s", ""), 10) || 0;
      const polyline        = route.polyline?.encodedPolyline ?? null;

      return {
        success:       true,

        distanceMeters,
        distanceMiles: distanceMeters / 1609.34,

        etaSeconds:    durationSeconds,
        etaMin:        Math.ceil(durationSeconds / 60),

        distanceText:  `${(distanceMeters / 1609.34).toFixed(1)} mi`,
        etaText:       `${Math.ceil(durationSeconds / 60)} mins`,

        polyline,
      };
    } catch (err) {
      console.error("[getDriverToPickup] Routes API error:", err?.response?.data || err.message);

      if (err instanceof HttpsError) throw err;

      throw new HttpsError(

// ─────────────────────────────────────────────────────────
exports.updateTripStatus = onCall(
  { region: "us-central1" },
   secrets: [GOOGLE_MAPS_KEY],
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
May 14, 2026 at 7:23:35 PM UTC-4
(timestamp)


adminNotified
true
(boolean)


approvedDriversEmailedAt
May 14, 2026 at 6:56:02 PM UTC-4
(timestamp)



approvedDriversNotified
(map)


1tw4E15GBGgNsYlvfMFQudJveke2
true
(boolean)


47HjcOmHIXQ5YOWnB0UruH5TtW12
true
(boolean)


4gmxZQmeFQYIzj4x2ZKI6K1EdB02
true
(boolean)


5u2TDlnyxDSTqIENyxmaPB3SeAt1
true
(boolean)


KeQ8Y5kHGmQzXe5ALo80LoVGtTk2
true
(boolean)


OWrtmINIsHZcCCFyPgVzrxnMPw73
true
(boolean)


Ure8E0iyx8Ob0dR7yN08GIHgHRy2
true
(boolean)


c8VuQdP10zNgAqDuBoVFmJL2Pyn2
true
(boolean)


lU9imSvYTwMGzqCjvxlm4rYHBme2
true
(boolean)


u2lsIx9WbIVVS2rfGPSXtVCyJpn1
true
(boolean)


vf81da95QxRYlpkrhxG79vAXJF23
true
(boolean)


arrivedAt
May 14, 2026 at 7:12:34 PM UTC-4
(timestamp)



candidateDriverUids
(array)


0
"duuEID4AofX1ooCLfSsfVMjJpUu1"
(string)


1
"7Uh6WlBZ0wYCZqF8OTrwpkODG7F2"
(string)


2
"0Kh5xBvMgPNTN1WSpfBVOWRiVHe2"
(string)


3
"at5VxbnwfXWAzsXVdKOwHMQCnOb2"
(string)


4
"x6XldJOfWcbG5RRqocOfCs0u1m12"
(string)


5
"khfZ88XTF8TjI9dBcbqY0730MQA3"
(string)


6
"rr5rvgmy8HQcWLdAyOKssV9LdRv2"
(string)



candidateDrivers
(array)



0
(map)


distance
0.05230770959930332
(double)


uid
"duuEID4AofX1ooCLfSsfVMjJpUu1"
(string)



1
(map)


distance
10.937635971819114
(double)


uid
"7Uh6WlBZ0wYCZqF8OTrwpkODG7F2"
(string)



2
(map)


distance
15.159312166515457
(double)


uid
"0Kh5xBvMgPNTN1WSpfBVOWRiVHe2"
(string)



3
(map)


distance
18.711830863230038
(double)


uid
"at5VxbnwfXWAzsXVdKOwHMQCnOb2"
(string)



4
(map)


distance
46.19668651669853
(double)


uid
"x6XldJOfWcbG5RRqocOfCs0u1m12"
(string)



5
(map)


distance
50.63495343139725
(double)


uid
"khfZ88XTF8TjI9dBcbqY0730MQA3"
(string)



6
(map)


distance
54.668083884450155
(double)


uid
"rr5rvgmy8HQcWLdAyOKssV9LdRv2"
(string)


completedAt
May 14, 2026 at 7:12:38 PM UTC-4
(timestamp)


createdAt
May 10, 2026 at 7:27:46 PM UTC-4
(timestamp)


currentDriverIndex
0
(int64)


driverDistanceMiles
0.06
(double)


driverEtaMin
1
(int64)



driverInfo
(map)


driverCount
1
(int64)


etaLabel
"1–3 min"
(string)


etaMin
1
(int64)


nearestMiles
0
(int64)


stale
false
(boolean)


driverLat
28.572782099999998
(double)


driverLng
-81.46883159999999
(double)


driverLocationAt
May 14, 2026 at 7:39:52 PM UTC-4
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



emailSentToDrivers
(map)


0Kh5xBvMgPNTN1WSpfBVOWRiVHe2
true
(boolean)


7Uh6WlBZ0wYCZqF8OTrwpkODG7F2
true
(boolean)


at5VxbnwfXWAzsXVdKOwHMQCnOb2
true
(boolean)


duuEID4AofX1ooCLfSsfVMjJpUu1
true
(boolean)


khfZ88XTF8TjI9dBcbqY0730MQA3
true
(boolean)


rr5rvgmy8HQcWLdAyOKssV9LdRv2
true
(boolean)


x6XldJOfWcbG5RRqocOfCs0u1m12
true
(boolean)


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



offlineDriversNotified
(map)


2L1vviHxDaUoub2V1FbMbQfdt0I2
true
(boolean)


CBmYmBLg5PN2I2BEdQQGRTDYcx92
true
(boolean)


ShwYtnVgnmYHYOv3i7J2KIwuCPh2
true
(boolean)


Z0SucKpv8iNCuNO1haW7Qe0rUSQ2
true
(boolean)


bBb4dBnOk7acwvpPpEH8tgyTuKX2
true
(boolean)


gmikoLPXOnRTf0T0AUgDog8VYUr1
true
(boolean)


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



pushSentToDrivers
(map)


khfZ88XTF8TjI9dBcbqY0730MQA3
true
(boolean)


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
"driver_assigned"
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
May 14, 2026 at 7:39:52 PM UTC-4