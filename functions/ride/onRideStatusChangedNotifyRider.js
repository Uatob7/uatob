const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { getMessaging }      = require("firebase-admin/messaging");
const admin                 = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ─────────────────────────────────────────────────────────────
// Status → rider-facing push copy
// ─────────────────────────────────────────────────────────────
function buildRiderPush(newStatus, ride, driver) {
  const driverName = driver?.firstName
    ? `${driver.firstName}${driver.lastName ? ` ${driver.lastName[0]}.` : ""}`
    : "Your driver";

  const vehicle = driver?.vehicle
    ? `${driver.vehicle.color ? driver.vehicle.color + " " : ""}${driver.vehicle.make ?? ""} ${driver.vehicle.model ?? ""}`.trim()
    : null;

  const plate = driver?.vehicle?.plate ? driver.vehicle.plate.toUpperCase() : null;

  switch (newStatus) {
    case "driver_assigned":
      return {
        title: `🚗 ${driverName} is your driver`,
        body:  vehicle
          ? `${vehicle}${plate ? ` · ${plate}` : ""} is on the way`
          : "Your driver is on the way",
      };

    case "driver_arriving":
      return {
        title: `📍 ${driverName} is almost there`,
        body:  ride.driverEtaMin
          ? `Arriving in about ${ride.driverEtaMin} min`
          : "Head outside soon",
      };

    case "arrived":
      return {
        title: `🎯 ${driverName} has arrived`,
        body:  vehicle
          ? `Look for the ${vehicle}${plate ? ` (${plate})` : ""}`
          : "Your driver is waiting outside",
      };

    case "in_progress":
      return {
        title: "🛣️ Trip started",
        body:  ride.dropoffEtaMin
          ? `About ${ride.dropoffEtaMin} min to ${ride.dropoff?.split(",")[0] ?? "your destination"}`
          : `On the way to ${ride.dropoff?.split(",")[0] ?? "your destination"}`,
      };

    case "completed":
      return {
        title: "✅ You've arrived",
        body:  ride.fareTotal
          ? `Trip complete · $${Number(ride.fareTotal).toFixed(2)} · Thanks for riding!`
          : "Trip complete · Thanks for riding!",
      };

    case "cancelled":
      return {
        title: "❌ Ride cancelled",
        body:  "Your ride was cancelled. Tap to book again.",
      };

    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Cloud Function
// ─────────────────────────────────────────────────────────────
exports.onRideStatusChangedNotifyRider = onDocumentUpdated(
  {
    document: "Rides/{rideId}",
    region:   "us-central1",
  },
  async (event) => {
    try {
      const before = event.data.before.data();
      const after  = event.data.after.data();

      const prevStatus = before?.status;
      const newStatus  = after?.status;
      const rideId     = event.params.rideId;

      if (prevStatus === newStatus) return null;

      const RIDER_NOTIFY_STATUSES = [
        "driver_assigned",
        "driver_arriving",
        "arrived",
        "in_progress",
        "completed",
        "cancelled",
      ];
      if (!RIDER_NOTIFY_STATUSES.includes(newStatus)) return null;

      // ── Get rider UID ─────────────────────────────────────────────
      const riderUid = after.uid ?? null;
      if (!riderUid) {
        console.log(`[RideStatus] No rider UID found on ride ${rideId}`);
        return null;
      }

      // ── Get rider FCM token ───────────────────────────────────────
      const accountSnap = await db.collection("Accounts").doc(riderUid).get();
      if (!accountSnap.exists) {
        console.log(`[RideStatus] Rider account ${riderUid} not found`);
        return null;
      }

      const fcmToken = accountSnap.data()?.fcmToken;
      if (!fcmToken) {
        console.log(`[RideStatus] Rider ${riderUid} has no FCM token — skipping push`);
        return null;
      }

      // ── Get driver doc (for name, vehicle, etc.) ──────────────────
      let driver = null;
      if (after.driverUid) {
        const driverSnap = await db.collection("Drivers").doc(after.driverUid).get();
        if (driverSnap.exists) driver = driverSnap.data();
      }

      // ── Build push payload ────────────────────────────────────────
      const copy = buildRiderPush(newStatus, after, driver);
      if (!copy) return null;

      // ── Send push ─────────────────────────────────────────────────
      try {
        await getMessaging().send({
          token: fcmToken,
          notification: {
            title: copy.title,
            body:  copy.body,
          },
          data: {
            screen: "tracking",
            rideId,
            status: newStatus,
          },
          webpush: {
            notification: {
              icon:  "/icon.png",
              badge: "/icon.png",
              tag:   rideId,
              renotify: "true",
            },
            fcmOptions: {
              link: "https://uatob.com",
            },
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
                badge: 1,
              },
            },
          },
          android: {
            priority: "high",
            notification: {
              sound:     "default",
              channelId: "ride_updates",
            },
          },
        });

        console.log(`🔔 Rider push sent for ride ${rideId}: ${prevStatus} → ${newStatus}`);
      } catch (pushErr) {
        const errCode = pushErr?.errorInfo?.code ?? "";

        if (
          errCode === "messaging/registration-token-not-registered" ||
          errCode === "messaging/invalid-registration-token"
        ) {
          await db.collection("Accounts").doc(riderUid).update({
            fcmToken: admin.firestore.FieldValue.delete(),
          });
          console.log(`🧹 Removed stale FCM token for rider ${riderUid}`);
        } else {
          console.error("❌ Rider push failed:", pushErr.message);
        }
      }

      return null;

    } catch (error) {
      console.error("❌ Error in onRideStatusChangedNotifyRider:", error);
      return null;
    }
  }
);