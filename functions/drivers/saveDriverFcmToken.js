// functions/saveDriverFcmToken.js
//
// Callable: stores or updates a driver's FCM token so push notifications
// (new ride requests, etc.) can reach them.
//
// Rules:
//   - Region MUST be us-east1 (matches client-side getFunctions(..., 'us-east1'))
//   - invoker: "public" so v2 onCall is callable without a Cloud Run auth token
//   - Caller's auth uid MUST match the driverId — drivers can only update their own token
//   - Writes to fcmToken + fcmTokenUpdatedAt (matches Driver schema everywhere else)
//   - Clears fcmTokenClearReason + fcmTokenClearedAt when a fresh token saves
//     (so a driver who re-authenticates after a token-cleared event looks healthy again)

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

exports.saveDriverFcmToken = onCall(
  {
    region:  "us-east1",
    invoker: "public",
  },
  async (request) => {
    const { driverId, token } = request.data || {};

    // ── Input validation ─────────────────────────────────────────
    if (!driverId || typeof driverId !== "string" || !driverId.trim()) {
      throw new HttpsError("invalid-argument", "Missing or invalid driverId.");
    }

    if (!token || typeof token !== "string" || !token.trim()) {
      throw new HttpsError("invalid-argument", "Missing or invalid FCM token.");
    }

    // ── Auth check — caller must be the driver they're updating ─
    const callerUid = request.auth?.uid;
    if (!callerUid) {
      throw new HttpsError("unauthenticated", "Sign in to save your push token.");
    }
    if (callerUid !== driverId) {
      console.warn(
        `[saveDriverFcmToken] Rejected: caller ${callerUid} tried to update driver ${driverId}`
      );
      throw new HttpsError(
        "permission-denied",
        "You can only update your own push token."
      );
    }

    // ── Write to Firestore ───────────────────────────────────────
    try {
      const db        = getFirestore();
      const driverRef = db.collection("Drivers").doc(driverId);
      const snap      = await driverRef.get();

      if (!snap.exists) {
        throw new HttpsError("not-found", `Driver ${driverId} not found.`);
      }

      // If the incoming token matches what we already have, don't bother writing
      const existingToken = snap.data()?.fcmToken;
      if (existingToken === token) {
        console.log(
          `[saveDriverFcmToken] Token unchanged for ${driverId} — skipping write`
        );
        return { success: true, updated: false };
      }

      await driverRef.update({
        fcmToken:               token,
        fcmTokenUpdatedAt:      FieldValue.serverTimestamp(),
        // Clear dead-token markers — driver re-authenticated successfully
        fcmTokenClearReason:    FieldValue.delete(),
        fcmTokenClearedAt:      FieldValue.delete(),
      });

      console.log(`[saveDriverFcmToken] Token saved for driver ${driverId}`);
      return { success: true, updated: true };
    } catch (err) {
      // Re-throw HttpsErrors as-is, wrap everything else
      if (err instanceof HttpsError) throw err;
      console.error(
        `[saveDriverFcmToken] Firestore error for driver ${driverId}:`,
        err?.message || err
      );
      throw new HttpsError(
        "internal",
        "Could not save token. Please try again."
      );
    }
  }
);