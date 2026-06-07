const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const sgMail = require("@sendgrid/mail");

const db = getFirestore();

exports.onSupportMessageSent = onDocumentCreated(
  {
    document: "Support/{messageId}",
    region: "us-east1",
    secrets: ["SENDGRID_API_KEY"],
  },
  async (event) => {
    const msg = event.data?.data();
    if (!msg) return;

    // Only notify when admin sends
    if (msg.sender !== "admin") return;

    const { driverId, message, threadId } = msg;
    if (!driverId || !message) return;

    const driverSnap = await db.collection("Drivers").doc(driverId).get();
    if (!driverSnap.exists) {
      console.warn(`[onSupportMessageSent] driver ${driverId} not found`);
      return;
    }

    const driver    = driverSnap.data();
    const email     = driver.email ?? null;
    const fcmToken  = driver.fcmToken ?? null;
    const firstName = driver.firstName ?? "Driver";

    const safeMsg = String(message)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // ── FCM ───────────────────────────────────────────────────────────────
    if (fcmToken) {
      try {
        await getMessaging().send({
          token: fcmToken,
          notification: {
            title: "Support message from UaTob",
            body: message,
          },
          data: {
            type: "support_message",
            threadId: threadId ?? "",
            messageId: event.params.messageId,
          },
          android: {
            priority: "high",
            notification: { sound: "default", channelId: "support_alerts" },
          },
          apns: {
            payload: { aps: { sound: "default", badge: 1 } },
          },
        });
        console.log(`[onSupportMessageSent] FCM sent to ${driverId}`);
      } catch (e) {
        console.error("[onSupportMessageSent] FCM failed:", e.message);
      }
    }

    // ── Email ─────────────────────────────────────────────────────────────
    if (email) {
      const sendgridKey = process.env.SENDGRID_API_KEY;
      if (!sendgridKey) {
        console.error("[onSupportMessageSent] Missing SENDGRID_API_KEY");
        return;
      }
      sgMail.setApiKey(sendgridKey);

      try {
        await sgMail.send({
          to: email,
          from: { name: "UaTob Support", email: "no-reply@uatob.com" },
          subject: "You have a new message from UaTob Support",
          html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New support message</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;background:#f4f6fb;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

          <!-- Header -->
          <tr>
            <td style="background:#2563EB;padding:32px 32px 28px;text-align:center;">
              <div style="font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.7);margin-bottom:8px;">UaTob Support</div>
              <div style="font-size:26px;font-weight:800;color:#ffffff;line-height:1.2;">You have a new message</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 28px;">
              <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
                Hi ${firstName},
              </p>
              <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
                The UaTob support team has sent you a message:
              </p>

              <!-- Message bubble -->
              <div style="background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:14px;padding:20px 24px;margin-bottom:28px;">
                <p style="margin:0;font-size:15px;color:#1E3A5F;line-height:1.65;">${safeMsg}</p>
              </div>

              <p style="margin:0 0 28px;font-size:13.5px;color:#6B7280;line-height:1.6;">
                Open the UaTob Driver app to reply. Our team typically responds within a few hours.
              </p>

              <!-- CTA -->
              <div style="text-align:center;margin-bottom:28px;">
                <a href="https://driver.uatob.com"
                   style="display:inline-block;background:#2563EB;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;">
                  Open App &amp; Reply →
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background:#F9FAFB;border-top:1px solid #E5E7EB;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;">
                UaTob · Orlando, FL<br>
                <a href="mailto:support@uatob.com" style="color:#6B7280;text-decoration:none;">support@uatob.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
        });
        console.log(`[onSupportMessageSent] email sent to ${email}`);
      } catch (e) {
        console.error("[onSupportMessageSent] email failed:", e.message);
      }
    }
  }
);
