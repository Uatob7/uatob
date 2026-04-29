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
// Scheduled Cloud Function — every 5 minutes
// ─────────────────────────────────────────────────────────────
exports.pushOfflineDriverNudge = onSchedule(
  {
    schedule: "every 5 minutes",
    region:   "us-east1",
  },
  async () => {
    const runStartedAt = admin.firestore.Timestamp.now();

    // Counters — written to Firestore at the end so the admin
    // dashboard (or just the Firestore console) shows each run.
    const stats = {
      activeRides:       0,
      offlineDrivers:    0,
      noToken:           0,
      inCooldown:        0,
      attempted:         0,
      sent:              0,
      failed:            0,
      cooldownStamped:   0,
      cooldownStampFail: 0,
      topRidePayout:     null,
      exitReason:        null,   // set if we return early
    };

    // ── Only run when rides are actually waiting ──────────────
    const ridesSnap = await db
      .collection("Rides")
      .where("paymentStatus", "==", "succeeded")
      .where("status",        "==", "searching_driver")
      .get();

    if (ridesSnap.empty) {
      stats.exitReason = "no_waiting_rides";
      await writeRunLog(stats, runStartedAt);
      console.log("[pushOfflineDriverNudge] No waiting rides — skipping");
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

    stats.activeRides = activeRides.length;

    if (activeRides.length === 0) {
      stats.exitReason = "all_rides_expired";
      await writeRunLog(stats, runStartedAt);
      console.log("[pushOfflineDriverNudge] All waiting rides are expired — skipping");
      return;
    }

    const topRide = activeRides.reduce((best, ride) =>
      (ride.driverPayout ?? 0) > (best.driverPayout ?? 0) ? ride : best
    );
    stats.topRidePayout = topRide.driverPayout ?? 0;

    // ── Fetch offline drivers ─────────────────────────────────
    const driversSnap = await db
      .collection("Drivers")
      .where("status", "==", "offline")
      .get();

    if (driversSnap.empty) {
      stats.exitReason = "no_offline_drivers";
      await writeRunLog(stats, runStartedAt);
      console.log("[pushOfflineDriverNudge] No offline drivers found");
      return;
    }

    stats.offlineDrivers = driversSnap.size;

    const NUDGE_COOLDOWN_MS = 30 * 60 * 1000;

    const eligibleDrivers = [];

    for (const doc of driversSnap.docs) {
      const d = { uid: doc.id, ...doc.data() };

      if (!d.fcmToken) {
        stats.noToken++;
        continue;
      }

      const lastNudgedMs = d.lastOfflineNudgeAt?.toMillis?.()
        ?? (d.lastOfflineNudgeAt ? new Date(d.lastOfflineNudgeAt).getTime() : 0);

      if ((now - lastNudgedMs) < NUDGE_COOLDOWN_MS) {
        stats.inCooldown++;
        continue;
      }

      eligibleDrivers.push(d);
    }

    if (eligibleDrivers.length === 0) {
      stats.exitReason = "all_in_cooldown";
      await writeRunLog(stats, runStartedAt);
      console.log(
        `[pushOfflineDriverNudge] No eligible drivers` +
        ` (${stats.noToken} no token, ${stats.inCooldown} in cooldown)`
      );
      return;
    }

    stats.attempted = eligibleDrivers.length;

    console.log(
      `[pushOfflineDriverNudge] Nudging ${eligibleDrivers.length} drivers` +
      ` | ${activeRides.length} active ride(s)` +
      ` | top payout ${fmt.currency(topRide.driverPayout)}`
    );

    // ── Send pushes, then stamp cooldown on each success ──────
    // Fix: run send + cooldown stamp together per driver so there
    // is no race between pushPromises settling and batchUpdates
    // being populated.
    const perDriverResults = await Promise.allSettled(
      eligibleDrivers.map(async (driver) => {
        const payload = buildOfflineNudgePayload({
          driver,
          waitingCount: activeRides.length,
          topRide,
        });

        // Send push
        await getMessaging().send(payload);

        // Stamp cooldown only after confirmed send
        try {
          await db.collection("Drivers").doc(driver.uid).update({
            lastOfflineNudgeAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          stats.cooldownStamped++;
        } catch (stampErr) {
          stats.cooldownStampFail++;
          console.error(
            `[pushOfflineDriverNudge] Cooldown stamp failed for ${driver.uid}:`,
            stampErr.message
          );
        }
      })
    );

    // ── Tally send outcomes ───────────────────────────────────
    const failures = [];

    for (let i = 0; i < perDriverResults.length; i++) {
      const result = perDriverResults[i];
      if (result.status === "fulfilled") {
        stats.sent++;
      } else {
        stats.failed++;
        failures.push({
          uid:   eligibleDrivers[i].uid,
          error: result.reason?.message ?? String(result.reason),
        });
        console.error(
          `[pushOfflineDriverNudge] Send failed for driver ${eligibleDrivers[i].uid}:`,
          result.reason?.message
        );
      }
    }

    // ── Write run log ─────────────────────────────────────────
    await writeRunLog(stats, runStartedAt, failures);

    console.log(
      `[pushOfflineDriverNudge] Done` +
      ` | sent ${stats.sent}` +
      ` | failed ${stats.failed}` +
      ` | cooldown stamped ${stats.cooldownStamped}` +
      ` | stamp failures ${stats.cooldownStampFail}`
    );
  }
);

// ─────────────────────────────────────────────────────────────
// Write a run-log doc to Firestore
// Collection: PushLogs / document: offlineNudge_<epoch>
// Visible in admin dashboard or Firestore console
// ─────────────────────────────────────────────────────────────
async function writeRunLog(stats, runStartedAt, failures = []) {
  try {
    const docId = `offlineNudge_${runStartedAt.toMillis()}`;
    await db.collection("PushLogs").doc(docId).set({
      type:        "offlineDriverNudge",
      runStartedAt,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...stats,
      failures,    // array of { uid, error } — empty on clean runs
    });
  } catch (err) {
    // Never let logging crash the function
    console.error("[pushOfflineDriverNudge] Failed to write run log:", err.message);
  }
}