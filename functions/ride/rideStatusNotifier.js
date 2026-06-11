// functions/rides/rideStatusNotifier.js
// Fires on every Rides doc update.
// If status changed to a notifiable value → FCM push to the rider.

const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { getMessaging }      = require("firebase-admin/messaging");
const admin                 = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ── PUSH COPY ───────────────────────────────────────────────────
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

// ── NOTIFIABLE STATUSES ─────────────────────────────────────────
const NOTIFIABLE = new Set([
  "driver_assigned",
  "driver_arriving",
  "arrived",
  "in_progress",
  "completed",
  "cancelled",
]);

// ── TRIGGER ─────────────────────────────────────────────────────
exports.rideStatusNotifier = onDocumentUpdated(
  {
    document: "Rides/{rideId}",
   region: "us-central1",
  },
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();
    const rideId = event.params.rideId;

    // ── 1. Guard: status must have changed ─────────────────
    if (before.status === after.status) return null;
    if (!NOTIFIABLE.has(after.status))  return null;

    const newStatus = after.status;
    const uid       = after.uid;

    if (!uid) {
      console.warn(`[rideStatusNotifier] ${rideId} has no uid — skipping.`);
      return null;
    }

    // ── 2. Idempotency guard ───────────────────────────────
    const sentKey = `pushSent_${newStatus}`;
    if (after[sentKey]) {
      console.log(
        `[rideStatusNotifier] ${rideId} — push for "${newStatus}" already sent.`
      );
      return null;
    }

    // ── 3. Fetch rider FCM token ───────────────────────────
    let fcmToken = null;
    try {
      const acctSnap = await db.collection("Accounts").doc(uid).get();
      if (acctSnap.exists) fcmToken = acctSnap.data()?.fcmToken ?? null;
    } catch (err) {
      console.error(`[rideStatusNotifier] Failed to load Account ${uid}:`, err);
      return null;
    }

    if (!fcmToken) {
      console.warn(
        `[rideStatusNotifier] No FCM token for rider ${uid} on ride ${rideId}.`
      );
      return null;
    }

    // ── 4. Fetch driver if needed ──────────────────────────
    let driver = null;
    const needsDriver = ["driver_assigned", "driver_arriving", "arrived"].includes(newStatus);

    if (needsDriver && after.driverUid) {
      try {
        const driverSnap = await db.collection("Drivers").doc(after.driverUid).get();
        if (driverSnap.exists) driver = driverSnap.data();
      } catch (err) {
        console.warn(
          `[rideStatusNotifier] Could not load driver ${after.driverUid}:`, err
        );
      }
    }

    // ── 5. Build push payload ──────────────────────────────
    const push = buildRiderPush(newStatus, after, driver);
    if (!push) {
      console.log(`[rideStatusNotifier] No push copy for status "${newStatus}" — skipping.`);
      return null;
    }

    // ── 6. Send FCM ────────────────────────────────────────
    try {
      await getMessaging().send({
        token:        fcmToken,
        notification: { title: push.title, body: push.body },
        data: {
          type:    "ride_status",
          rideId,
          status:  newStatus,
        },
        android: {
          priority:     "high",
          notification: { sound: "default" },
        },
        apns: {
          payload: { aps: { sound: "default" } },
        },
      });

      console.log(
        `[rideStatusNotifier] ✅ Push sent to ${uid} | ` +
        `ride ${rideId} | status: ${newStatus}`
      );
    } catch (err) {
      const code = err?.errorInfo?.code ?? "";

      // Stale token — clean it up
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        console.warn(
          `[rideStatusNotifier] Stale FCM token for ${uid} — removing.`
        );
        try {
          await db.collection("Accounts").doc(uid).update({
            fcmToken: admin.firestore.FieldValue.delete(),
          });
        } catch (cleanErr) {
          console.error(
            `[rideStatusNotifier] Failed to clean token for ${uid}:`, cleanErr
          );
        }
      } else {
        console.error(
          `[rideStatusNotifier] FCM error for ${uid} on ${rideId}:`,
          code || err?.message
        );
      }
      return null;
    }

    // ── 7. Stamp idempotency flag ──────────────────────────
    try {
      await event.data.after.ref.update({
        [sentKey]:  true,
        updatedAt:  admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      // Non-fatal — push already sent, stamp is best-effort
      console.warn(
        `[rideStatusNotifier] Could not stamp ${sentKey} on ${rideId}:`, err
      );
    }

    return null;
  }
);