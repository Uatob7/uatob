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
// Build FCM payload
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
    notification: { title, body: bodyParts.join("\n") },
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
          alert: { title, body: bodyParts.join("\n") },
        },
      },
      headers: { "apns-priority": "10" },
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Scheduled Function
// ─────────────────────────────────────────────────────────────
exports.pushOfflineDriver = onSchedule(
  {
    schedule: "every 1 minutes",
    region:   "us-east1",
  },
  async () => {
    // ── Check for active rides ────────────────────────────────
    const ridesSnap = await db
      .collection("Rides")
      .where("paymentStatus", "==", "succeeded")
      .where("status", "==", "searching_driver")
      .get();

    if (ridesSnap.empty) {
      console.log("[pushOfflineDriver] No waiting rides — skipping");
      return;
    }

    const now = Date.now();

    const activeRides = ridesSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((ride) => {
        const expiresAtMs = ride.expiresAt?.toMillis?.()
          ?? (ride.expiresAt ? new Date(ride.expiresAt).getTime() : null);
        return expiresAtMs === null || expiresAtMs > now;
      });

    if (activeRides.length === 0) {
      console.log("[pushOfflineDriver] All rides expired — skipping");
      return;
    }

    const topRide = activeRides.reduce((best, ride) =>
      (ride.driverPayout ?? 0) > (best.driverPayout ?? 0) ? ride : best
    );

    // ── Fetch offline drivers ─────────────────────────────────
    const driversSnap = await db
      .collection("Drivers")
      .where("status", "==", "offline")
      .get();

    if (driversSnap.empty) {
      console.log("[pushOfflineDriver] No offline drivers");
      return;
    }

    const NUDGE_COOLDOWN_MS = 30 * 60 * 1000;
    const nowMs = Date.now();

    const eligibleDrivers = [];

    for (const doc of driversSnap.docs) {
      const d = { uid: doc.id, ...doc.data() };

      if (!d.fcmToken) continue;

      const lastNudgedMs = d.lastOfflineNudgeAt?.toMillis?.()
        ?? (d.lastOfflineNudgeAt ? new Date(d.lastOfflineNudgeAt).getTime() : 0);

      if ((nowMs - lastNudgedMs) < NUDGE_COOLDOWN_MS) continue;

      eligibleDrivers.push(d);
    }

    if (eligibleDrivers.length === 0) {
      console.log("[pushOfflineDriver] No eligible drivers (cooldown or no token)");
      return;
    }

    console.log(
      `[pushOfflineDriver] Sending to ${eligibleDrivers.length} drivers | ${activeRides.length} rides`
    );

    // ── Send pushes + stamp cooldown ──────────────────────────
    const results = await Promise.allSettled(
      eligibleDrivers.map(async (driver) => {
        const payload = buildOfflineNudgePayload({
          driver,
          waitingCount: activeRides.length,
          topRide,
        });

        await getMessaging().send(payload);

        // Stamp cooldown after success
        await db.collection("Drivers").doc(driver.uid).update({
          lastOfflineNudgeAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      })
    );

    // ── Handle failures ───────────────────────────────────────
    let success = 0;
    let failed = 0;

    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        success++;
      } else {
        failed++;
        console.error(
          `[pushOfflineDriver] Failed for ${eligibleDrivers[i].uid}:`,
          r.reason?.message
        );
      }
    });

    console.log(
      `[pushOfflineDriver] Done | sent: ${success} | failed: ${failed}`
    );
  }
);