const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ─────────────────────────────────────────────
   PUSH COPY
──────────────────────────────────────────── */
function buildRiderPush(newStatus, ride, driver) {
  const driverName = driver?.firstName
    ? `${driver.firstName}${driver.lastName ? ` ${driver.lastName[0]}.` : ""}`
    : "Your driver";

  const vehicle = driver?.vehicle
    ? `${driver.vehicle.color ? driver.vehicle.color + " " : ""}${driver.vehicle.make ?? ""} ${driver.vehicle.model ?? ""}`.trim()
    : null;

  const plate = driver?.vehicle?.plate
    ? driver.vehicle.plate.toUpperCase()
    : null;

  switch (newStatus) {
    case "driver_assigned":
      return {
        title: `🚗 ${driverName} is your driver`,
        body: ride.driverEtaMin
          ? `${vehicle ? `${vehicle}${plate ? ` · ${plate}` : ""} · ` : ""}Arriving in ~${ride.driverEtaMin} min`
          : "Your driver is on the way",
      };

    case "driver_arriving":
      return {
        title: `📍 ${driverName} is almost there`,
        body: ride.driverEtaMin
          ? `Arriving in about ${ride.driverEtaMin} min`
          : "Arriving soon",
      };

    case "arrived":
      return {
        title: `🎯 ${driverName} has arrived`,
        body: vehicle
          ? `Look for ${vehicle}${plate ? ` (${plate})` : ""}`
          : "Your driver is waiting",
      };

    case "in_progress":
      return {
        title: "🛣️ Trip started",
        body: ride.dropoffEtaMin
          ? `About ${ride.dropoffEtaMin} min to destination`
          : "On the way",
      };

    case "completed":
      return {
        title: "✅ Trip completed",
        body: ride.fareTotal
          ? `Fare: $${Number(ride.fareTotal).toFixed(2)}`
          : "Thanks for riding!",
      };

    case "cancelled":
      return {
        title: "❌ Ride cancelled",
        body: "Your ride was cancelled",
      };

    default:
      return null;
  }
}

/* ─────────────────────────────────────────────
   MAIN FUNCTION
──────────────────────────────────────────── */
exports.onRideStatusChangedNotifyRider = onDocumentUpdated(
  {
    document: "Rides/{rideId}",
    region: "us-east1",
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const rideId = event.params.rideId;

    const prevStatus = before?.status;
    const newStatus = after?.status;

    if (!after || prevStatus === newStatus) return null;

    /* ─────────────────────────────────────────────
       VALID STATUSES
    ───────────────────────────────────────────── */
    const allowed = [
      "driver_assigned",
      "driver_arriving",
      "arrived",
      "in_progress",
      "completed",
      "cancelled",
    ];

    if (!allowed.includes(newStatus)) return null;

    /* ─────────────────────────────────────────────
       RIDER
    ───────────────────────────────────────────── */
    const riderUid = after.uid;
    if (!riderUid) return null;

    const accountSnap = await db.collection("Accounts").doc(riderUid).get();
    if (!accountSnap.exists) return null;

    const fcmToken = accountSnap.data()?.token;
    if (!fcmToken) return null;

    /* ─────────────────────────────────────────────
       DRIVER
    ───────────────────────────────────────────── */
    let driver = null;
    const driverUid = after.driverUid || after?.driver?.uid;

    if (driverUid) {
      const driverSnap = await db.collection("Drivers").doc(driverUid).get();
      if (driverSnap.exists) driver = driverSnap.data();
    }

    /* ─────────────────────────────────────────────
       DUPLICATE PREVENTION (FIXED)
       per STATUS per RIDER
    ───────────────────────────────────────────── */
    const alreadySent =
      after?.pushSentToRiders?.[newStatus]?.[riderUid] === true;

    if (alreadySent) {
      console.log(`🔁 Already sent ${newStatus} to ${riderUid}`);
      return null;
    }

    /* ─────────────────────────────────────────────
       BUILD MESSAGE
    ───────────────────────────────────────────── */
    const copy = buildRiderPush(newStatus, after, driver);
    if (!copy) return null;

    /* ─────────────────────────────────────────────
       SEND PUSH
    ───────────────────────────────────────────── */
    try {
      await getMessaging().send({
        token: fcmToken,
        notification: {
          title: copy.title,
          body: copy.body,
        },
        data: {
          rideId,
          status: newStatus,
          screen: "tracking",
        },
        android: {
          priority: "high",
          notification: {
            channelId: "ride_updates",
          },
        },
      });

      /* ─────────────────────────────────────────────
         MARK SENT (FIXED STRUCTURE)
      ───────────────────────────────────────────── */
      await db.collection("Rides").doc(rideId).set(
        {
          pushSentToRiders: {
            [newStatus]: {
              [riderUid]: true,
            },
          },
        },
        { merge: true }
      );

      console.log(`✅ Push sent: ${newStatus} → ${riderUid}`);

    } catch (err) {
      console.error("❌ Push failed:", err.message);
    }

    return null;
  }
);