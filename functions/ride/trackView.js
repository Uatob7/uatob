// functions/index.js
const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

exports.trackView = onCall(
  {
    region: "us-east1",
    invoker: "public",
  },
  async (request) => {
    try {
      const {
        path,
        uid,
        sessionId,
        timestamp,
        title,
        referrer,
        userAgent,
        screen,
      } = request.data || {};

      if (!path) throw new Error("Missing path");

      const now = admin.firestore.FieldValue.serverTimestamp();

      // ─────────────────────────────────────────
      // SAVE UNDER Admin/views/events
      // ─────────────────────────────────────────
      await db
        .collection("Admin")
        .doc("views")
        .collection("events")
        .add({
          path,
          uid: uid || null,
          sessionId: sessionId || null,
          title: title || null,
          referrer: referrer || null,
          userAgent: userAgent || null,
          screen: screen || null,
          timestamp: timestamp || Date.now(),
          createdAt: now,
        });

      return { success: true };

    } catch (err) {
      console.error("trackView error:", err);
      throw new Error("Failed to track view");
    }
  }
);