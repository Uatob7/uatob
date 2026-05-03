const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

if (!admin.apps.length) admin.initializeApp();

const REGION = "us-east1";

exports.adminSendDriverMessage = onCall(
  {
    region: REGION,
    secrets: ["SENDGRID_API_KEY"], // ✅ REQUIRED
  },
  async (request) => {
    

    // ── 2. Input Validation ────────────────────────────────
    const { rideId, driverUid, message } = request.data || {};

    if (!driverUid || !message?.trim()) {
      throw new HttpsError("invalid-argument", "driverUid and message are required.");
    }

    const cleanMessage = String(message).trim();

    // ── 3. Setup ───────────────────────────────────────────
    const db = getFirestore();
    const sendgridKey = process.env.SENDGRID_API_KEY;

    if (!sendgridKey) {
      throw new HttpsError("internal", "Missing email configuration.");
    }

    sgMail.setApiKey(sendgridKey);

    // ── 4. Fetch Driver ────────────────────────────────────
    const driverSnap = await db.collection("Drivers").doc(driverUid).get();

    if (!driverSnap.exists) {
      throw new HttpsError("not-found", `Driver ${driverUid} not found.`);
    }

    const driver = driverSnap.data();
    const fcmToken = driver.fcmToken ?? null;
    const email = driver.email ?? null;
    const firstName = driver.firstName ?? "Driver";
    const shortRide = rideId ? `#${rideId.slice(-6).toUpperCase()}` : "";

    const errors = [];
    let fcmSent = false;
    let emailSent = false;

    // ── 5. FCM ─────────────────────────────────────────────
    if (fcmToken) {
      try {
        await getMessaging().send({
          token: fcmToken,
          notification: {
            title: `UaTob Admin${shortRide ? ` · Ride ${shortRide}` : ""}`,
            body: cleanMessage,
          },
          data: {
            type: "admin_message",
            rideId: rideId ?? "",
            message: cleanMessage, // ✅ include for app usage
          },
          android: {
            priority: "high",
            notification: { sound: "default", channelId: "admin_alerts" },
          },
          apns: {
            payload: { aps: { sound: "default", badge: 1 } },
          },
        });

        fcmSent = true;
      } catch (e) {
        console.error("FCM send failed:", e);
        errors.push(`FCM: ${e.message}`);
      }
    }

    // ── 6. Email ───────────────────────────────────────────
    if (email) {
      try {
        await sgMail.send({
          to: email,
          from: { name: "UaTob Admin", email: "no-reply@uatob.com" },
          subject: `Admin Message${shortRide ? ` · Ride ${shortRide}` : ""} — UaTob`,
          html: buildEmailHtml({
            firstName,
            message: cleanMessage,
            shortRide,
          }),
        });

        emailSent = true;
      } catch (e) {
        console.error("Email send failed:", e);
        errors.push(`Email: ${e.message}`);
      }
    }

    const success = fcmSent || emailSent;

    // ── 7. Logging ─────────────────────────────────────────
    try {
      const logRef = rideId
        ? db.collection("Rides").doc(rideId).collection("adminMessages")
        : db.collection("adminMessageLogs");

      await logRef.add({
        driverUid,
        message: cleanMessage,
        rideId: rideId ?? null,
        sentBy: request.auth.uid,
        fcmSent,
        emailSent,
        errors,
        createdAt: FieldValue.serverTimestamp(), // ✅ FIXED
      });
    } catch (e) {
      console.error("Log write failed:", e);
    }

    return { success, fcmSent, emailSent, errors };
  }
);

// ── Email Template (unchanged except safer escaping) ──
function buildEmailHtml({ firstName, message, shortRide }) {
  const safeMsg = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `
  <html>
    <body style="font-family:Arial;background:#111;color:#fff;padding:20px;">
      <h2>UaTob Admin Message ${shortRide || ""}</h2>
      <p>Hi ${firstName},</p>
      <div style="background:#222;padding:15px;border-radius:8px;">
        ${safeMsg}
      </div>
    </body>
  </html>`;
}