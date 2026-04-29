const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { getMessaging } = require("firebase-admin/messaging");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ─────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────
const fmt = {
  currency: (v) => `$${Number(v ?? 0).toFixed(2)}`,
  miles:    (v) => `${Number(v ?? 0).toFixed(1)} mi`,
};

// ─────────────────────────────────────────────────────────────
// Build FCM payload for offline driver nudge
// ─────────────────────────────────────────────────────────────
function buildOfflineNudgePayload({ driver, waitingCount, topRide }) {
  const hasTopRide = !!topRide;

  const title = waitingCount === 1
    ? `💰 1 ride is waiting near you`
    : `💰 ${waitingCount} rides are waiting near you`;

  const bodyParts = [];

  if (hasTopRide) {
    const payout   = fmt.currency(topRide.driverPayout);
    const distance = fmt.miles(topRide.tripDistanceMiles);
    bodyParts.push(`Top offer: ${payout} · ${distance}`);
    bodyParts.push(`${topRide.pickup ?? "N/A"} → ${topRide.dropoff ?? "N/A"}`);
  }

  bodyParts.push("Go online to start accepting rides.");

  return {
    token: driver.fcmToken,

    notification: {
      title,
      body: bodyParts.join("\n"),
    },

    data: {
      screen:       "GoOnline",
      waitingCount: String(waitingCount),
      ...(hasTopRide && {
        topRideId:       topRide.id,
        topRidePayout:   String(topRide.driverPayout ?? 0),
        topRideDistance: String(topRide.tripDistanceMiles ?? 0),
        topRidePickup:   topRide.pickup  ?? "",
        topRideDropoff:  topRide.dropoff ?? "",
      }),
    },

    android: {
      priority: "high",
      notification: {
        channelId:  "driver_nudges",
        sound:      "default",
        priority:   "high",
        visibility: "public",
      },
    },

    apns: {
      payload: {
        aps: {
          sound:            "default",
          badge:            1,
          contentAvailable: true,
          alert: {
            title,
            body: bodyParts.join("\n"),
          },
        },
      },
      headers: {
        "apns-priority": "10",
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Scheduled Cloud Function — every 5 minutes
// (less aggressive than the live-ride ticker)
// ─────────────────────────────────────────────────────────────
exports.pushOfflineDriverNudge = onSchedule(
  {
    schedule: "every 5 minutes",
    region:   "us-east1",
  },
  async () => {
    // ── Only run when rides are actually waiting ──────────────
    const ridesSnap = await db
      .collection("Rides")
      .where("paymentStatus", "==", "succeeded")
      .where("status",        "==", "searching_driver")
      .get();

    if (ridesSnap.empty) {
      console.log("[pushOfflineDriverNudge] No waiting rides — skipping");
      return;
    }

    const now = Date.now();

    // Filter out expired rides
    const activeRides = ridesSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((ride) => {
        const expiresAtMs = ride.expiresAt?.toMillis?.()
          ?? (ride.expiresAt ? new Date(ride.expiresAt).getTime() : null);
        return expiresAtMs === null || expiresAtMs > now;
      });

    if (activeRides.length === 0) {
      console.log("[pushOfflineDriverNudge] All waiting rides are expired — skipping");
      return;
    }

    // Pick the highest-payout ride to feature in the nudge
    const topRide = activeRides.reduce((best, ride) =>
      (ride.driverPayout ?? 0) > (best.driverPayout ?? 0) ? ride : best
    );

    // ── Fetch offline drivers with FCM tokens ─────────────────
    const driversSnap = await db
      .collection("Drivers")
      .where("status", "==", "offline")
      .get();

    if (driversSnap.empty) {
      console.log("[pushOfflineDriverNudge] No offline drivers found");
      return;
    }

    const NUDGE_COOLDOWN_MS = 30 * 60 * 1000; // 30-minute quiet period per driver

    const eligibleDrivers = driversSnap.docs
      .map((doc) => ({ uid: doc.id, ...doc.data() }))
      .filter((d) => {
        if (!d.fcmToken) return false;

        // Skip drivers nudged too recently
        const lastNudgedMs = d.lastOfflineNudgeAt?.toMillis?.()
          ?? (d.lastOfflineNudgeAt ? new Date(d.lastOfflineNudgeAt).getTime() : 0);

        return (now - lastNudgedMs) >= NUDGE_COOLDOWN_MS;
      });

    if (eligibleDrivers.length === 0) {
      console.log("[pushOfflineDriverNudge] All offline drivers are in cooldown");
      return;
    }

    console.log(
      `[pushOfflineDriverNudge] Nudging ${eligibleDrivers.length} offline drivers` +
      ` — ${activeRides.length} active ride(s) waiting`
    );

    // ── Send pushes + update cooldown timestamps ──────────────
    const pushPromises  = [];
    const batchUpdates  = [];

    for (const driver of eligibleDrivers) {
      const payload = buildOfflineNudgePayload({
        driver,
        waitingCount: activeRides.length,
        topRide,
      });

      pushPromises.push(
        getMessaging()
          .send(payload)
          .then(() => {
            // Stamp cooldown only after a successful send
            batchUpdates.push(
              db.collection("Drivers").doc(driver.uid).update({
                lastOfflineNudgeAt: admin.firestore.FieldValue.serverTimestamp(),
              })
            );
          })
          .catch((err) =>
            console.error(`[PUSH] Nudge failed for driver ${driver.uid}:`, err.message)
          )
      );
    }

    await Promise.allSettled(pushPromises);
    await Promise.allSettled(batchUpdates);

    console.log("[pushOfflineDriverNudge] Done");
  }
);