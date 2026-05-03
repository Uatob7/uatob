// functions/src/adminSendDriverMessage.js
//
// Firebase Cloud Functions v2 — onCall
// Region: us-east1  (matches admin dashboard client)
//
// Called by the admin dashboard to send a message to a driver.
// Delivers via two channels simultaneously:
//   1. FCM push notification  → driver sees it even if app is backgrounded
//   2. Firestore subcollection → driver's in-app DriverMessagePanel renders it
//
// Payload from client:
//   { rideId, driverUid, fcmToken, message }
//
// Firestore writes:
//   Rides/{rideId}/messages/{messageId}          ← ride-scoped thread
//   Drivers/{driverUid}/adminMessages/{messageId} ← driver-scoped inbox

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

const REGION = "us-east1";

/* ─── Validation helpers ─────────────────────────────────────────── */
function requireString(val, name) {
  if (typeof val !== "string" || !val.trim()) {
    throw new HttpsError("invalid-argument", `${name} must be a non-empty string.`);
  }
  return val.trim();
}

/* ─── Cloud Function ─────────────────────────────────────────────── */
exports.adminSendDriverMessage = onCall(
  {
    region: REGION,
    enforceAppCheck: false, // flip to true once App Check is wired up
  },
  async (request) => {
    /* ── 1. Auth guard — caller must be signed in ── */
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to send driver messages."
      );
    }

    /* ── 2. Parse + validate inputs ── */
    const { rideId, driverUid, fcmToken, message } = request.data ?? {};

    const safeRideId    = requireString(rideId,    "rideId");
    const safeDriverUid = requireString(driverUid, "driverUid");
    const safeMessage   = requireString(message,   "message");

    // fcmToken is optional — we still write to Firestore even without it
    const safeFcmToken = typeof fcmToken === "string" && fcmToken.trim()
      ? fcmToken.trim()
      : null;

    const db          = getFirestore();
    const adminUid    = request.auth.uid;
    const sentAt      = FieldValue.serverTimestamp();

    /* ── 3. Build the message document ── */
    const messageDoc = {
      text:        safeMessage,
      senderUid:   adminUid,
      senderRole:  "admin",
      recipientUid: safeDriverUid,
      rideId:      safeRideId,
      sentAt,
      deliveredViaPush: false, // updated below if FCM succeeds
      read: false,
    };

    /* ── 4. Write to Firestore (both collections) ── */
    const rideMessageRef   = db
      .collection("Rides")
      .doc(safeRideId)
      .collection("messages")
      .doc(); // auto-ID

    const driverMessageRef = db
      .collection("Drivers")
      .doc(safeDriverUid)
      .collection("adminMessages")
      .doc(rideMessageRef.id); // same ID → easy cross-reference

    const batch = db.batch();
    batch.set(rideMessageRef,   messageDoc);
    batch.set(driverMessageRef, messageDoc);
    await batch.commit();

    const messageId = rideMessageRef.id;

    /* ── 5. FCM push (best-effort — never throw on FCM failure) ── */
    let fcmResult = { sent: false, reason: "no_token" };

    if (safeFcmToken) {
      try {
        const fcmPayload = {
          token: safeFcmToken,

          // Shown in the system notification tray
          notification: {
            title: "📣 Message from UaTob Admin",
            body:  safeMessage.length > 100
              ? `${safeMessage.slice(0, 97)}…`
              : safeMessage,
          },

          // Data payload — DriverMessagePanel can act on these
          data: {
            type:       "admin_message",
            messageId,
            rideId:     safeRideId,
            senderRole: "admin",
            text:       safeMessage,
          },

          // Android config — high priority so it wakes a backgrounded app
          android: {
            priority: "high",
            notification: {
              channelId: "admin_messages",
              sound:     "default",
              priority:  "high",
            },
          },

          // APNs config for iOS
          apns: {
            headers: {
              "apns-priority": "10",
            },
            payload: {
              aps: {
                alert: {
                  title: "📣 Message from UaTob Admin",
                  body:  safeMessage,
                },
                sound: "default",
                badge: 1,
              },
            },
          },
        };

        const fcmResponse = await getMessaging().send(fcmPayload);
        fcmResult = { sent: true, fcmMessageId: fcmResponse };

        // Back-patch both Firestore docs to reflect push delivery
        const deliveredUpdate = { deliveredViaPush: true };
        await Promise.all([
          rideMessageRef.update(deliveredUpdate),
          driverMessageRef.update(deliveredUpdate),
        ]);
      } catch (fcmErr) {
        // Log but don't surface to admin — message is already in Firestore
        console.error(
          `[adminSendDriverMessage] FCM send failed for driver ${safeDriverUid}:`,
          fcmErr?.errorInfo ?? fcmErr
        );

        // If the token is stale/invalid, note it (don't crash the function)
        const isInvalidToken =
          fcmErr?.code === "messaging/registration-token-not-registered" ||
          fcmErr?.code === "messaging/invalid-registration-token";

        fcmResult = {
          sent:   false,
          reason: isInvalidToken ? "invalid_token" : "fcm_error",
          error:  fcmErr?.errorInfo?.message ?? fcmErr?.message ?? "unknown",
        };
      }
    }

    /* ── 6. Return result to admin dashboard ── */
    return {
      success:   true,
      messageId,
      rideId:    safeRideId,
      driverUid: safeDriverUid,
      fcm:       fcmResult,
    };
  }
);
