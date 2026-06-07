// pushCandidateDrivers.js
// Scheduled Cloud Function — runs every 1 minute, mirrors emailCandidateDrivers cadence.
// Pushes FCM notifications to online candidate drivers when a ride enters
// searching_driver state, then expands to additional online drivers in waves.
//
// FIXES applied vs prior version:
//   1. Expansion now walks the ride's candidateDriverUids list (by proximity)
//      instead of slicing the global online-drivers array (which had no
//      stable order and made indexing meaningless across runs).
//   2. Data-only FCM payload so background taps fire the service worker's
//      onBackgroundMessage handler with deep-link data intact.
//   3. Single Firestore write per ride per run (was 2, with race risk).
//   4. Dead FCM tokens are auto-cleared on the driver doc when FCM returns
//      messaging/registration-token-not-registered — no more wasted sends.
//   5. lastPushAt stamped on every wave, not just expansion waves.
//   6. Helper functions: clearer flow, easier to maintain.
//   7. Defensive Firestore.update accepts FieldValue.delete() for fcmToken
//      and survives partial failures via allSettled.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin          = require("firebase-admin");
const { getMessaging } = require("firebase-admin/messaging");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────
const BATCH_SIZE        = 10;     // candidates per expansion wave
const EXPANSION_MIN_MS  = 60_000; // skip expansion if ride expires inside this window
const FUNCTION_REGION   = "us-east1";

// FCM error codes that mean "stop sending to this token forever"
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

// ─────────────────────────────────────────────────────────────
// Formatters (mirror emailCandidateDrivers for consistency)
// ─────────────────────────────────────────────────────────────
const fmt = {
  currency: (v) => `$${Number(v ?? 0).toFixed(2)}`,
  miles:    (v) => `${Number(v ?? 0).toFixed(1)} mi`,
  duration: (v) => {
    const t = Math.round(Number(v ?? 0));
    const h = Math.floor(t / 60);
    const m = t % 60;
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  },
};

// ─────────────────────────────────────────────────────────────
// FCM payload builder — DATA-ONLY so the service worker fires
// onBackgroundMessage on background taps. The SW is responsible
// for rendering the notification with the deep-link click action.
// ─────────────────────────────────────────────────────────────
function buildPushPayload({ driver, ride, rideId, totalCandidates, minutesRemaining }) {
  const payout   = fmt.currency(ride.driverPayout);
  const distance = fmt.miles(ride.tripDistanceMiles);
  const duration = fmt.duration(ride.tripDurationMin);
  const rideType = ride.rideLabel
    ?? (ride.rideType
      ? ride.rideType.charAt(0).toUpperCase() + ride.rideType.slice(1)
      : "Standard");

  const title = `🚗 New ride · ${payout} · ${distance}`;

  const bodyParts = [
    `${ride.pickup ?? "N/A"} → ${ride.dropoff ?? "N/A"}`,
    `${duration} · ${rideType}`,
  ];
  if (minutesRemaining !== null && minutesRemaining <= 5) {
    bodyParts.push(`⚠️ Expires in ~${minutesRemaining} min!`);
  }
  if (totalCandidates > 1) {
    bodyParts.push(`${totalCandidates} drivers notified — first to accept wins`);
  }
  const body = bodyParts.join("\n");

  // ── DATA-ONLY PAYLOAD ─────────────────────────────────────
  // No top-level `notification` block. The service worker reads
  // this `data` and calls self.registration.showNotification()
  // with the title/body + click action. This is what makes the
  // tap-to-open deep link work on backgrounded apps.
  return {
    token: driver.fcmToken,

    data: {
      // Rendering hints (read by SW + foreground handler)
      title,
      body,
      type:      "ride_offer",

      // Deep-link data
      url:       "https://uatob.com/driver",
      rideId,
      screen:    "RideOffer",
      payout:    String(ride.driverPayout ?? 0),
      distance:  String(ride.tripDistanceMiles ?? 0),
      duration:  String(ride.tripDurationMin ?? 0),
      pickup:    ride.pickup  ?? "",
      dropoff:   ride.dropoff ?? "",
      rideType:  ride.rideType ?? "standard",

      // Stamp so SW can dedupe rapid resends
      sentAt:    String(Date.now()),
    },

    android: {
      priority: "high",
      // No notification block here either — SW handles it on web/Android.
      // If you have a native Android app, you'd add a notification block
      // here ONLY for that platform.
    },

    apns: {
      payload: {
        aps: {
          // contentAvailable triggers background fetch on iOS
          // without showing a system notification (your iOS app
          // handler renders the alert from data).
          contentAvailable: true,
        },
      },
      headers: {
        "apns-priority":   "5",        // 5 = normal for content-available
        "apns-push-type":  "background",
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Dead-token cleaner — clears fcmToken on the driver doc if FCM
// confirms the token is dead. Returns true if the token was dead.
// ─────────────────────────────────────────────────────────────
async function handleSendError(err, driverUid) {
  const code = err?.errorInfo?.code || err?.code || "";
  console.error(`[PUSH] FCM error for driver ${driverUid}: ${code} — ${err?.message}`);

  if (DEAD_TOKEN_CODES.has(code)) {
    try {
      await db.collection("Drivers").doc(driverUid).update({
        fcmToken:         admin.firestore.FieldValue.delete(),
        fcmTokenClearedAt: admin.firestore.FieldValue.serverTimestamp(),
        fcmTokenClearReason: code,
      });
      console.log(`[PUSH] Cleared dead token for driver ${driverUid}`);
      return true;
    } catch (clearErr) {
      console.error(`[PUSH] Failed to clear dead token for ${driverUid}:`, clearErr.message);
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────
// Send to a list of drivers, track results
// Returns { sentUids: [...], failedUids: [...] }
// ─────────────────────────────────────────────────────────────
async function sendToDrivers({ targets, ride, rideId, minutesRemaining }) {
  const totalCandidates = targets.length;
  const sentUids   = [];
  const failedUids = [];

  const settled = await Promise.allSettled(
    targets.map((driver) =>
      getMessaging().send(
        buildPushPayload({ driver, ride, rideId, totalCandidates, minutesRemaining })
      )
    )
  );

  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    const driver = targets[i];
    if (r.status === "fulfilled") {
      sentUids.push(driver.uid);
    } else {
      failedUids.push(driver.uid);
      // Don't await — fire and forget the cleanup
      handleSendError(r.reason, driver.uid).catch(() => {});
    }
  }

  return { sentUids, failedUids };
}

// ─────────────────────────────────────────────────────────────
// Process a single ride — returns the field updates to write,
// so the caller can batch a single Firestore write per ride.
// ─────────────────────────────────────────────────────────────
async function processRide({ rideDoc, onlineDriversByUid, now }) {
  const ride    = rideDoc.data();
  const rideId  = rideDoc.id;

  // ── Expiry guard ─────────────────────────────────────────
  const expiresAtMs = ride.expiresAt?.toMillis?.()
    ?? (ride.expiresAt ? new Date(ride.expiresAt).getTime() : null);

  if (expiresAtMs !== null && expiresAtMs <= now) {
    console.log(`[PUSH] Skipping ${rideId} — expired`);
    return null;
  }

  const msRemaining      = expiresAtMs !== null ? expiresAtMs - now : Infinity;
  const minutesRemaining = expiresAtMs !== null
    ? Math.max(1, Math.round(msRemaining / 60_000))
    : null;

  const sentMap       = ride.pushSentToDrivers   || {};
  const candidateUids = ride.candidateDriverUids || [];

  if (candidateUids.length === 0) {
    console.log(`[PUSH] ${rideId} has no candidateDriverUids — skipping`);
    return null;
  }

  // ── Resolve candidate UIDs to ONLINE drivers, preserving the
  //    distance-sorted order from candidateDriverUids ───────
  const orderedOnlineCandidates = candidateUids
    .map((uid) => onlineDriversByUid.get(uid))
    .filter(Boolean)               // online + has fcmToken
    .filter((d) => !sentMap[d.uid]);// not already pushed to

  if (orderedOnlineCandidates.length === 0) {
    console.log(`[PUSH] ${rideId} — no new online candidates to push to`);
    return null;
  }

  // ── Decide wave: first wave (no dispatch started yet) or expansion ──
  const isFirstWave = !ride.pushDispatchStarted;
  let targets;
  let nextIndex;

  if (isFirstWave) {
    // First wave: push to ALL un-pushed online candidates immediately
    targets   = orderedOnlineCandidates;
    nextIndex = candidateUids.length; // mark whole list as "covered"
    console.log(`[PUSH] First wave → ${rideId} (${targets.length} drivers)`);
  } else {
    // Expansion: skip if we're about to expire
    if (msRemaining <= EXPANSION_MIN_MS) {
      console.log(`[PUSH] Skipping expansion for ${rideId} — expires soon`);
      return null;
    }

    const currentIndex = ride.pushDriverIndex || 0;

    // The candidateUids slice we haven't touched yet
    const nextSliceUids = candidateUids.slice(currentIndex, currentIndex + BATCH_SIZE);

    targets = nextSliceUids
      .map((uid) => onlineDriversByUid.get(uid))
      .filter(Boolean)
      .filter((d) => !sentMap[d.uid]);

    nextIndex = currentIndex + BATCH_SIZE;

    if (targets.length === 0) {
      // No new online candidates in this slice — bump the index so
      // we move forward next run instead of being stuck on the same slice.
      console.log(`[PUSH] ${rideId} — slice ${currentIndex}-${nextIndex} has no online candidates, advancing index`);
      return {
        pushDriverIndex: nextIndex,
        lastPushAt:      admin.firestore.FieldValue.serverTimestamp(),
      };
    }

    console.log(`[PUSH] Expanding ${rideId} → candidates ${currentIndex}-${nextIndex} (${targets.length} pushed)`);
  }

  // ── Send ────────────────────────────────────────────────
  const { sentUids, failedUids } = await sendToDrivers({
    targets, ride, rideId, minutesRemaining,
  });

  // ── Update sentMap for successful sends ─────────────────
  const updatedSentMap = { ...sentMap };
  sentUids.forEach((uid) => { updatedSentMap[uid] = true; });

  // ── Build single Firestore update for this ride ────────
  const updates = {
    pushSentToDrivers: updatedSentMap,
    pushDriverIndex:   nextIndex,
    lastPushAt:        admin.firestore.FieldValue.serverTimestamp(),
  };

  if (isFirstWave) {
    updates.pushDispatchStarted = true;
    updates.pushDispatchAt      = admin.firestore.FieldValue.serverTimestamp();
  }

  console.log(
    `[PUSH] ${rideId} | wave: ${isFirstWave ? "first" : "expansion"} | ` +
    `${sentUids.length} sent, ${failedUids.length} failed`
  );

  return updates;
}

// ─────────────────────────────────────────────────────────────
// Scheduled Cloud Function
// ─────────────────────────────────────────────────────────────
exports.pushCandidateDrivers = onSchedule(
  {
    schedule: "every 1 minutes",
    region:   FUNCTION_REGION,
  },
  async () => {
    const now = Date.now();

    // ── 1. Pull active rides ──────────────────────────────
    let ridesSnap;
    try {
      ridesSnap = await db
        .collection("Rides")
        .where("paymentStatus", "==", "succeeded")
        .where("status",        "==", "searching_driver")
        .get();
    } catch (err) {
      console.error("[pushCandidateDrivers] Rides query failed:", err.message);
      return;
    }

    if (ridesSnap.empty) {
      // Quiet exit — no spam in logs when there's nothing to do
      return;
    }

    // ── 2. Pull online drivers, build uid → driver map ────
    let driversSnap;
    try {
      driversSnap = await db
        .collection("Drivers")
        .where("status", "==", "online")
        .get();
    } catch (err) {
      console.error("[pushCandidateDrivers] Drivers query failed:", err.message);
      return;
    }

    if (driversSnap.empty) {
      console.log(`[pushCandidateDrivers] ${ridesSnap.size} active rides but no online drivers`);
      return;
    }

    const onlineDriversByUid = new Map();
    for (const doc of driversSnap.docs) {
      const driver = { uid: doc.id, ...doc.data() };
      if (driver.fcmToken) {
        onlineDriversByUid.set(driver.uid, driver);
      }
    }

    if (onlineDriversByUid.size === 0) {
      console.log("[pushCandidateDrivers] No online drivers have fcmToken — nothing to push");
      return;
    }

    console.log(
      `[pushCandidateDrivers] ${ridesSnap.size} active rides, ` +
      `${onlineDriversByUid.size} push-eligible online drivers`
    );

    // ── 3. Process each ride independently ───────────────
    const rideOps = await Promise.allSettled(
      ridesSnap.docs.map(async (rideDoc) => {
        const updates = await processRide({
          rideDoc,
          onlineDriversByUid,
          now,
        });

        if (updates) {
          try {
            await rideDoc.ref.update(updates);
          } catch (err) {
            console.error(`[PUSH] Failed to update ride ${rideDoc.id}:`, err.message);
            throw err;
          }
        }
      })
    );

    const failed = rideOps.filter((r) => r.status === "rejected").length;
    console.log(
      `[pushCandidateDrivers] Done | ${ridesSnap.size - failed} ok, ${failed} failed`
    );
  }
);
