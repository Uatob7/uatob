// functions/index.js (or adminSendDriverMessage.js)

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore }       = require("firebase-admin/firestore");
const { getMessaging }       = require("firebase-admin/messaging");
const sgMail                 = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const REGION = "us-east1";

exports.adminSendDriverMessage = onCall({ region: REGION }, async (request) => {
  // Auth guard — only signed-in admins
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const { rideId, driverUid, message } = request.data;

  if (!driverUid || !message?.trim()) {
    throw new HttpsError("invalid-argument", "driverUid and message are required.");
  }

  const db = getFirestore();
  const driverSnap = await db.collection("Drivers").doc(driverUid).get();

  if (!driverSnap.exists) {
    throw new HttpsError("not-found", `Driver ${driverUid} not found.`);
  }

  const driver     = driverSnap.data();
  const fcmToken   = driver.fcmToken   ?? null;
  const email      = driver.email      ?? null;
  const firstName  = driver.firstName  ?? "Driver";
  const shortRide  = rideId ? `#${rideId.slice(-6).toUpperCase()}` : "";

  const errors   = [];
  let   fcmSent  = false;
  let   emailSent = false;

  // ── 1. FCM Push ──────────────────────────────────────────────────
  if (fcmToken) {
    try {
      await getMessaging().send({
        token: fcmToken,
        notification: {
          title: `UaTob Admin${shortRide ? ` · Ride ${shortRide}` : ""}`,
          body:  message.trim(),
        },
        data: {
          type:   "admin_message",
          rideId: rideId ?? "",
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

  // ── 2. SendGrid Email ─────────────────────────────────────────────
  if (email) {
    try {
      await sgMail.send({
        to:      email,
        from:    { name: "UaTob Admin", email: "no-reply@uatob.com" },
        subject: `Admin Message${shortRide ? ` · Ride ${shortRide}` : ""} — UaTob`,
        html: buildEmailHtml({ firstName, message: message.trim(), shortRide }),
      });
      emailSent = true;
    } catch (e) {
      console.error("Email send failed:", e);
      errors.push(`Email: ${e.message}`);
    }
  }

  const success = fcmSent || emailSent;

  // ── 3. Log to Firestore ───────────────────────────────────────────
  try {
    const logRef = rideId
      ? db.collection("Rides").doc(rideId).collection("adminMessages")
      : db.collection("adminMessageLogs");

    await logRef.add({
      driverUid,
      message:   message.trim(),
      sentBy:    request.auth.uid,
      fcmSent,
      emailSent,
      errors,
      createdAt: new Date(),
    });
  } catch (e) {
    console.error("Log write failed:", e); // non-fatal
  }

  return { success, fcmSent, emailSent, errors };
});

// ── Email template ────────────────────────────────────────────────
function buildEmailHtml({ firstName, message, shortRide }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#0C0F0C;font-family:'Courier New',monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0C0F0C;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#111511;border:1px solid #1E2A1E;border-radius:16px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a2e4a,#0d1f35);padding:28px 32px;border-bottom:1px solid #1E2A1E;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="font-size:11px;font-weight:700;color:#22C55E;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px;">
                    UaTob Admin
                  </div>
                  <div style="font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-.02em;">
                    Message from HQ
                  </div>
                  ${shortRide ? `<div style="margin-top:6px;display:inline-block;background:rgba(47,111,237,.2);border:1px solid rgba(47,111,237,.4);border-radius:6px;padding:3px 10px;font-size:11px;font-weight:700;color:#7BA7FF;letter-spacing:.04em;">Ride ${shortRide}</div>` : ""}
                </td>
                <td align="right" style="vertical-align:top;">
                  <div style="width:44px;height:44px;background:#22C55E;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#0C0F0C;text-align:center;line-height:44px;">U</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 20px;font-size:14px;color:#9CA89C;line-height:1.5;">
              Hi ${firstName},
            </p>
            <div style="background:#0C0F0C;border:1px solid #1E2A1E;border-left:3px solid #22C55E;border-radius:10px;padding:18px 20px;margin-bottom:24px;">
              <p style="margin:0;font-size:15px;color:#E8F0E8;line-height:1.65;white-space:pre-wrap;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
            </div>
            <p style="margin:0;font-size:12px;color:#4A5E4A;line-height:1.6;">
              This message was sent directly from the UaTob admin dashboard. If you have questions, contact support.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 24px;border-top:1px solid #1E2A1E;">
            <p style="margin:0;font-size:10px;color:#2E3E2E;text-align:center;letter-spacing:.06em;text-transform:uppercase;">
              UaTob · Orlando, FL · Driver Operations
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}