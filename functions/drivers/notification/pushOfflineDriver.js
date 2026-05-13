// pushOfflineDrivers.js
// Scheduled Cloud Function — every 1 minute.
// Nudges OFFLINE drivers with push notifications when rides are waiting,
// so they know to open the app and go online.
//
// FIXES applied vs prior version:
//   1. Data-only FCM payload so background taps fire SW deep-link handler.
//   2. Dead tokens auto-cleared from driver docs.
//   3. Cooldown stamped on EVERY attempt (success or failure) so dead tokens
//      don't get hammered every minute forever.
//   4. Rides filtered to those with ≥3 minutes remaining — drivers nudged
//      about a ride that already expired is a worse experience than no nudge.
//   5. All driver-doc updates batched into a single commit (was N updates).
//   6. Short-circuit if no eligible drivers — don't compute topRide for nothing.
//   7. Helper functions for clarity (matches pushCandidateDrivers pattern).

const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin          = require("firebase-admin");
const { getMessaging } = require("firebase-admin/messaging");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────
const NUDGE_COOLDOWN_MS  = 30 * 60 * 1000;  // 30 min per driver
const MIN_RIDE_REMAINING = 3 * 60 * 1000;   // skip rides expiring < 3 min
const FUNCTION_REGION    = "us-east1";

// FCM errors meaning "stop sending to this token forever"
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

// ─────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────
const fmt = {
  currency: (v) => `$${Number(v ?? 0).toFixed(2)}`,
  miles:    (v) => `${Number(v ?? 0).toFixed(1)} mi`,
};

// ─────────────────────────────────────────────────────────────
// FCM payload builder — DATA-ONLY so service worker's
// onBackgroundMessage fires with the deep-link data intact.
// ─────────────────────────────────────────────────────────────
function buildOfflineNudgePayload({ driver, waitingCount, topRide }) {
  const hasTopRide = !!topRide;

  const title = waitingCount === 1
    ? "💰 1 ride is waiting near you"
    : `💰 ${waitingCount} rides are waiting near you`;

  const bodyParts = [];
  if (hasTopRide) {
    const payout   = fmt.currency(topRide.driverPayout);
    const distance = fmt.miles(topRide.tripDistanceMiles);
    bodyParts.push(`Top offer: ${payout} · ${distance}`);
    bodyParts.push(`${topRide.pickup ?? "N/A"} → ${topRide.dropoff ?? "N/A"}`);
  }
  bodyParts.push("Go online to start accepting rides.");
  const body = bodyParts.join("\n");

  return {
    token: driver.fcmToken,

    // DATA-ONLY — no top-level notification block.
    // Service worker reads title/body/screen and renders the
    // notification with click action.
    data: {
      // Rendering hints (read by SW + foreground handler)
      title,
      body,
      type:          "offline_nudge",

      // Deep-link target
      screen:        "GoOnline",
      waitingCount:  String(waitingCount),

      // Top ride preview (only if present — all values stringified for FCM)
      ...(hasTopRide && {
        topRideId:       topRide.id,
        topRidePayout:   String(topRide.driverPayout ?? 0),
        topRideDistance: String(topRide.tripDistanceMiles ?? 0),
        topRidePickup:   topRide.pickup  ?? "",
        topRideDropoff:  topRide.dropoff ?? "",
      }),

      // Dedupe stamp for SW
      sentAt: String(Date.now()),
    },

    android: {
      priority: "high",
    },

    apns: {
      payload: {
        aps: { contentAvailable: true },
      },
      headers: {
        "apns-priority":  "5",
        "apns-push-type": "background",
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Determine if an FCM error means the token is permanently dead.
// ─────────────────────────────────────────────────────────────
function isDeadTokenError(err) {
  const code = err?.errorInfo?.code || err?.code || "";
  return DEAD_TOKEN_CODES.has(code);
}

// ─────────────────────────────────────────────────────────────
// Filter rides to those with enough time remaining to be worth nudging.
// ─────────────────────────────────────────────────────────────
function filterActionableRides(rides, nowMs) {
  return rides.filter((ride) => {
    const expiresAtMs = ride.expiresAt?.toMillis?.()
      ?? (ride.expiresAt ? new Date(ride.expiresAt).getTime() : null);

    if (expiresAtMs === null) return true;          // no expiry — always actionable
    return (expiresAtMs - nowMs) >= MIN_RIDE_REMAINING;
  });
}

// ─────────────────────────────────────────────────────────────
// Pick the highest-payout ride (so the nudge is maximally enticing)
// ─────────────────────────────────────────────────────────────
function pickTopRide(rides) {
  if (rides.length === 0) return null;
  return rides.reduce((best, ride) =>
    (ride.driverPayout ?? 0) > (best.driverPayout ?? 0) ? ride : best
  );
}

// ─────────────────────────────────────────────────────────────
// Filter offline drivers by cooldown + token presence
// ─────────────────────────────────────────────────────────────
function getEligibleDrivers(driversSnap, nowMs) {
  const eligible = [];
  for (const doc of driversSnap.docs) {
    const d = { uid: doc.id, ...doc.data() };

    if (!d.fcmToken) continue;     // no push capability

    const lastNudgedMs = d.lastOfflineNudgeAt?.toMillis?.()
      ?? (d.lastOfflineNudgeAt ? new Date(d.lastOfflineNudgeAt).getTime() : 0);

    if ((nowMs - lastNudgedMs) < NUDGE_COOLDOWN_MS) continue;

    eligible.push(d);
  }
  return eligible;
}

// ─────────────────────────────────────────────────────────────
// Send pushes, return per-driver results so caller can batch updates
// ─────────────────────────────────────────────────────────────
async function sendNudges({ drivers, waitingCount, topRide }) {
  const settled = await Promise.allSettled(
    drivers.map((driver) =>
      getMessaging().send(
        buildOfflineNudgePayload({ driver, waitingCount, topRide })
      )
    )
  );

  return drivers.map((driver, i) => {
    const result = settled[i];
    if (result.status === "fulfilled") {
      return { driver, ok: true,  dead: false, err: null };
    }
    const dead = isDeadTokenError(result.reason);
    if (!dead) {
      console.error(
        `[pushOfflineDrivers] FCM error for ${driver.uid}:`,
        result.reason?.message
      );
    } else {
      console.log(`[pushOfflineDrivers] Dead token for ${driver.uid} — will clear`);
    }
    return { driver, ok: false, dead, err: result.reason };
  });
}

// ─────────────────────────────────────────────────────────────
// Scheduled Cloud Function
// ─────────────────────────────────────────────────────────────
exports.pushOfflineDriver = onSchedule(
  {
    schedule: "every 1 minutes",
    region:   FUNCTION_REGION,
  },
  async () => {
    const nowMs = Date.now();

    // ── 1. Fetch active rides ─────────────────────────────
    let ridesSnap;
    try {
      ridesSnap = await db
        .collection("Rides")
        .where("paymentStatus", "==", "succeeded")
        .where("status",        "==", "searching_driver")
        .get();
    } catch (err) {
      console.error("[pushOfflineDrivers] Rides query failed:", err.message);
      return;
    }

    if (ridesSnap.empty) return;  // quiet exit

    const allRides = ridesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const actionableRides = filterActionableRides(allRides, nowMs);

    if (actionableRides.length === 0) {
      console.log("[pushOfflineDrivers] All rides expired or about to expire — skipping");
      return;
    }

    // ── 2. Fetch offline drivers + filter eligibility ─────
    let driversSnap;
    try {
      driversSnap = await db
        .collection("Drivers")
        .where("status", "==", "offline")
        .get();
    } catch (err) {
      console.error("[pushOfflineDrivers] Drivers query failed:", err.message);
      return;
    }

    if (driversSnap.empty) {
      console.log("[pushOfflineDrivers] No offline drivers");
      return;
    }

    const eligibleDrivers = getEligibleDrivers(driversSnap, nowMs);

    if (eligibleDrivers.length === 0) {
      console.log("[pushOfflineDrivers] No eligible drivers (cooldown or no token)");
      return;
    }

    // ── 3. Compute the lure ride (best payout among actionable) ──
    const topRide = pickTopRide(actionableRides);

    console.log(
      `[pushOfflineDrivers] Sending to ${eligibleDrivers.length} drivers | ` +
      `${actionableRides.length} actionable rides | ` +
      `top offer: ${topRide ? fmt.currency(topRide.driverPayout) : "n/a"}`
    );

    // ── 4. Send pushes ────────────────────────────────────
    const results = await sendNudges({
      drivers:       eligibleDrivers,
      waitingCount:  actionableRides.length,
      topRide,
    });

    // ── 5. Batch-update driver docs ───────────────────────
    // ALWAYS stamp cooldown (even on failure) so dead tokens
    // don't trigger retry storms. Also clear dead tokens.
    const batch = db.batch();

    let sent       = 0;
    let failed     = 0;
    let deadTokens = 0;

    for (const r of results) {
      const ref = db.collection("Drivers").doc(r.driver.uid);

      const update = {
        lastOfflineNudgeAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (r.dead) {
        // Clear the dead token + record why for analytics
        update.fcmToken             = admin.firestore.FieldValue.delete();
        update.fcmTokenClearedAt    = admin.firestore.FieldValue.serverTimestamp();
        update.fcmTokenClearReason  = r.err?.errorInfo?.code || r.err?.code || "unknown";
        deadTokens++;
      }

      batch.update(ref, update);

      if (r.ok) sent++;
      else      failed++;
    }

    try {
      await batch.commit();
    } catch (err) {
      console.error("[pushOfflineDrivers] Batch commit failed:", err.message);
    }

    console.log(
      `[pushOfflineDrivers] Done | sent: ${sent} | failed: ${failed} | dead tokens cleared: ${deadTokens}`
    );
  }
);
