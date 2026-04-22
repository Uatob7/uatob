const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { getMessaging } = require("firebase-admin/messaging");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ─────────────────────────────────────────────────────────────
// Formatters (mirrors emailCandidateDrivers)
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
// Build FCM payload
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

  return {
    token: driver.fcmToken,

    notification: {
      title,
      body: bodyParts.join("\n"),
    },

    // Deep-link data — your app can read these on tap
    data: {
      rideId,
      screen:   "RideOffer",
      payout:   String(ride.driverPayout ?? 0),
      distance: String(ride.tripDistanceMiles ?? 0),
      duration: String(ride.tripDurationMin ?? 0),
      pickup:   ride.pickup  ?? "",
      dropoff:  ride.dropoff ?? "",
      rideType: ride.rideType ?? "standard",
    },

    android: {
      priority: "high",
      notification: {
        channelId: "ride_offers",   // create this channel in your Android app
        sound:     "default",
        priority:  "max",           // heads-up notification
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
        "apns-priority": "10",       // immediate delivery
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Scheduled Cloud Function — every 1 minute, matches email cadence
// ─────────────────────────────────────────────────────────────
exports.pushCandidateDrivers = onSchedule(
  {
    schedule: "every 1 minutes",
    region:   "us-east1",
  },
  async () => {
    const ridesSnap = await db
      .collection("Rides")
      .where("paymentStatus", "==", "succeeded")
      .where("status",        "==", "searching_driver")
      .get();

    if (ridesSnap.empty) {
      console.log("[pushCandidateDrivers] No active rides");
      return;
    }

    const driversSnap = await db
      .collection("Drivers")
      .where("status", "==", "online")
      .get();

    if (driversSnap.empty) {
      console.log("[pushCandidateDrivers] No available drivers");
      return;
    }

    const drivers = driversSnap.docs
      .map((doc) => ({ uid: doc.id, ...doc.data() }))
      .filter((d) => !!d.fcmToken);     // must have a valid token

    const pushPromises = [];
    const now     = Date.now();
    const TICK_MS = 60_000;

    for (const rideDoc of ridesSnap.docs) {
      const ride    = rideDoc.data();
      const rideRef = rideDoc.ref;
      const rideId  = rideDoc.id;

      // ── EXPIRY GUARD ─────────────────────────────────────────
      const expiresAtMs = ride.expiresAt?.toMillis?.()
        ?? (ride.expiresAt ? new Date(ride.expiresAt).getTime() : null);

      if (expiresAtMs !== null && expiresAtMs <= now) {
        console.log(`[PUSH] Skipping ${rideId} — expired`);
        continue;
      }

      const msRemaining      = expiresAtMs !== null ? expiresAtMs - now : Infinity;
      const minutesRemaining = expiresAtMs !== null
        ? Math.max(1, Math.round(msRemaining / 60_000))
        : null;

      const sentMap       = ride.pushSentToDrivers   || {};  // separate from email map
      const candidateUids = ride.candidateDriverUids || [];

      // ── FIRST WAVE ───────────────────────────────────────────
      if (!ride.pushDispatchStarted) {
        console.log(`[PUSH] First wave → ${rideId}`);

        await rideRef.update({
          pushDispatchStarted: true,
          pushDispatchAt:      admin.firestore.FieldValue.serverTimestamp(),
          pushSentToDrivers:   {},
        });

        const candidateDrivers = drivers.filter(
          (d) => candidateUids.includes(d.uid) && !sentMap[d.uid]
        );

        for (const driver of candidateDrivers) {
          const payload = buildPushPayload({
            driver,
            ride,
            rideId,
            totalCandidates: candidateDrivers.length,
            minutesRemaining,
          });
          pushPromises.push(
            getMessaging()
              .send(payload)
              .catch((err) =>
                console.error(`[PUSH] Failed for driver ${driver.uid}:`, err.message)
              )
          );
          sentMap[driver.uid] = true;
        }

        await rideRef.update({ pushSentToDrivers: sentMap });
        continue;
      }

      // ── EXPANSION WAVES ──────────────────────────────────────
      if (msRemaining <= TICK_MS) {
        console.log(`[PUSH] Skipping expansion for ${rideId} — expires too soon`);
        continue;
      }

      const batchSize    = 10;
      const currentIndex = ride.pushDriverIndex || 0;
      const nextBatch    = drivers
        .slice(currentIndex, currentIndex + batchSize)
        .filter((d) => !sentMap[d.uid]);

      if (nextBatch.length === 0) continue;

      console.log(`[PUSH] Expanding ${rideId} → drivers ${currentIndex}–${currentIndex + batchSize}`);

      for (const driver of nextBatch) {
        const payload = buildPushPayload({
          driver,
          ride,
          rideId,
          totalCandidates: nextBatch.length,
          minutesRemaining,
        });
        pushPromises.push(
          getMessaging()
            .send(payload)
            .catch((err) =>
              console.error(`[PUSH] Failed for driver ${driver.uid}:`, err.message)
            )
        );
        sentMap[driver.uid] = true;
      }

      await rideRef.update({
        pushDriverIndex:   currentIndex + batchSize,
        pushSentToDrivers: sentMap,
        lastPushAt:        admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await Promise.allSettled(pushPromises);
    console.log("[pushCandidateDrivers] Done");
  }
);