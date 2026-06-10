// File: functions/feedNotifier.js

const { onSchedule }   = require("firebase-functions/v2/scheduler");
const { getMessaging } = require("firebase-admin/messaging");
const admin            = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.feedNotifier = onSchedule(
  {
    schedule: "every 1 minutes",
    region:   "us-east1",
  },
  async () => {
    const now = admin.firestore.Timestamp.now();

    // ── 1. Fetch all active Feed posts ─────────────────────────────
    const feedSnap = await db
      .collection("Feed")
      .where("paymentStatus", "==", "succeeded")
      .where("status",        "==", "active")
      .get();

    if (feedSnap.empty) {
      console.log("[feedNotifier] No active posts.");
      return;
    }

    // ── 2. Fetch all drivers (online + offline) ────────────────────
    const driversSnap = await db.collection("Drivers").get();

    if (driversSnap.empty) {
      console.log("[feedNotifier] No drivers found.");
      return;
    }

    // Build map: uid → { fcmToken }
    const drivers = [];
    driversSnap.forEach((doc) => {
      const d = doc.data();
      if (d.fcmToken && typeof d.fcmToken === "string") {
        drivers.push({ uid: doc.id, fcmToken: d.fcmToken });
      }
    });

    console.log(`[feedNotifier] ${feedSnap.size} active post(s), ${drivers.length} driver(s) with tokens`);

    // ── 3. Process each Feed post ──────────────────────────────────
    for (const feedDoc of feedSnap.docs) {
      const feedId = feedDoc.id;
      const feed   = feedDoc.data();

      // ── 3a. Delete if expired ──────────────────────────────────
      if (feed.expiresAt && feed.expiresAt.toMillis() < now.toMillis()) {
        await feedDoc.ref.delete();
        console.log(`[feedNotifier] 🗑️  Deleted expired Feed ${feedId}`);
        continue;
      }

      // ── 3b. Who has already been notified? ────────────────────
      const notifiedUids = Array.isArray(feed.notifiedUids) ? feed.notifiedUids : [];

      // Drivers that haven't received this post yet
      const pending = drivers.filter((d) => !notifiedUids.includes(d.uid));

      if (pending.length === 0) {
        console.log(`[feedNotifier] Feed ${feedId} — all drivers already notified`);
        continue;
      }

      const posterName = feed.driverName || "A driver";
      const message    = feed.message    || "";

      // ── 3c. Send push to each pending driver ───────────────────
      const results = await Promise.allSettled(
        pending.map(({ fcmToken }) =>
          getMessaging().send({
            token: fcmToken,
            notification: {
              title: `📢 ${posterName}`,
              body:  message,
            },
            data: {
              type:   "driver_feed",
              feedId,
            },
            android: {
              priority: "high",
              notification: { sound: "default" },
            },
            apns: {
              payload: { aps: { sound: "default" } },
            },
          })
        )
      );

      // ── 3d. Collect successfully notified uids ─────────────────
      const newlyNotified = [];
      const staleTokens   = [];

      results.forEach((result, i) => {
        if (result.status === "fulfilled") {
          newlyNotified.push(pending[i].uid);
        } else {
          const code = result.reason?.errorInfo?.code ?? "";
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            staleTokens.push({ uid: pending[i].uid, token: pending[i].fcmToken });
          }
          console.warn(`[feedNotifier] Push failed for ${pending[i].uid}:`, code || result.reason?.message);
        }
      });

      // ── 3e. Patch Feed doc with newly notified uids ────────────
      if (newlyNotified.length > 0) {
        await feedDoc.ref.update({
          notifiedUids: admin.firestore.FieldValue.arrayUnion(...newlyNotified),
          updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[feedNotifier] ✅ Feed ${feedId} — notified ${newlyNotified.length} driver(s)`);
      }

      // ── 3f. Clean up stale FCM tokens from Driver docs ─────────
      if (staleTokens.length > 0) {
        await Promise.allSettled(
          staleTokens.map(({ uid, token }) =>
            db.collection("Drivers").doc(uid).update({
              fcmToken: admin.firestore.FieldValue.delete(),
            })
          )
        );
        console.log(`[feedNotifier] 🧹 Removed ${staleTokens.length} stale token(s)`);
      }
    }
  }
);