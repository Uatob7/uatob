// functions/feed/feedNotifier.js

const { onSchedule }   = require("firebase-functions/v2/scheduler");
const { getMessaging } = require("firebase-admin/messaging");
const admin            = require("firebase-admin");
const sgMail           = require("@sendgrid/mail");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ── HTML email builder ─────────────────────────────────────────────
function buildEmail({ driverName, message, feedId, year }) {
  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Driver Feed — UaTob</title>
  <style type="text/css">
    :root { color-scheme: dark; supported-color-schemes: dark; }
    body, html {
      margin: 0 !important; padding: 0 !important;
      background-color: #000000 !important; color: #ffffff !important;
      -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;
    }
    u + .body { background-color: #000000 !important; }
    @media only screen and (max-width: 600px) {
      .container  { width: 100% !important; }
      .outer-pad  { padding: 16px 12px !important; }
      .body-pad   { padding: 20px 16px !important; }
      .hero-title { font-size: 26px !important; }
    }
  </style>
</head>
<body class="body" style="margin:0;padding:0;background-color:#000000;color:#ffffff;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- Preview text -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#000000;opacity:0;">
    📢 ${esc(driverName)}: ${esc(message)}
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="margin:0;padding:0;background-color:#000000;" bgcolor="#000000">
    <tr>
      <td class="outer-pad" align="center" style="padding:32px 16px;background-color:#000000;" bgcolor="#000000">

        <table class="container" width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:600px;width:100%;background-color:#0a0a0a;
                      border-radius:20px;overflow:hidden;border:1px solid #1f1f1f;
                      box-shadow:0 0 60px rgba(34,197,94,0.10);" bgcolor="#0a0a0a">

          <!-- ── BRAND BAR ── -->
          <tr>
            <td style="padding:18px 24px;background-color:#000000;border-bottom:1px solid #1a1a1a;" bgcolor="#000000">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td valign="middle">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td valign="middle" style="padding-right:8px;">
                          <div style="width:30px;height:30px;background:linear-gradient(135deg,#22C55E,#16A34A);
                                      border-radius:8px;display:inline-block;text-align:center;line-height:30px;
                                      font-size:15px;font-weight:900;color:#ffffff;font-family:Arial,sans-serif;">
                            U
                          </div>
                        </td>
                        <td valign="middle">
                          <span style="font-family:Arial,sans-serif;font-size:18px;font-weight:900;
                                       color:#ffffff;letter-spacing:-0.4px;">UaTob</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" valign="middle">
                    <span style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:9.5px;
                                 font-weight:700;color:#22C55E;background-color:#0a1f10;
                                 padding:5px 10px;border-radius:100px;letter-spacing:1.5px;
                                 border:1px solid #22C55E;">
                      &#9679;&nbsp; DRIVER FEED
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── HERO ── -->
          <tr>
            <td align="center"
                style="background:linear-gradient(135deg,#001a0a 0%,#003d18 35%,#16A34A 100%);
                       padding:40px 32px 36px;">
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 18px;">
                <tr>
                  <td>
                    <div style="display:inline-block;background:linear-gradient(135deg,#22C55E,#16A34A);
                                border-radius:100px;padding:7px 16px;
                                box-shadow:0 6px 18px rgba(34,197,94,0.35);">
                      <span style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10.5px;
                                   font-weight:800;color:#ffffff;letter-spacing:2px;">
                        &#128226;&nbsp; NEW POST
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <h1 class="hero-title"
                  style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;
                         font-size:32px;font-weight:700;color:#ffffff;
                         line-height:1.15;letter-spacing:-0.8px;">
                Message from<br/>
                <span style="color:#FCD34D;font-style:italic;">${esc(driverName)}</span>
              </h1>
            </td>
          </tr>

          <!-- ── MESSAGE CARD ── -->
          <tr>
            <td class="body-pad" style="padding:28px 28px 12px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <p style="margin:0 0 14px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10.5px;
                        font-weight:700;color:#22C55E;letter-spacing:2px;">
                THE MESSAGE
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background:linear-gradient(135deg,#0d1f12 0%,#0a0a0a 100%);
                            border:1px solid #166534;border-radius:16px;overflow:hidden;
                            box-shadow:0 8px 24px rgba(22,163,74,0.12);">
                <tr>
                  <td style="padding:24px 22px;">
                    <!-- Quote mark -->
                    <div style="font-family:Georgia,serif;font-size:48px;color:#22C55E;
                                line-height:1;margin-bottom:-8px;opacity:0.6;">
                      &#8220;
                    </div>
                    <p style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;
                              font-size:18px;font-weight:400;color:#ffffff;
                              line-height:1.65;letter-spacing:-0.1px;">
                      ${esc(message)}
                    </p>
                    <div style="display:inline-block;background-color:rgba(34,197,94,0.1);
                                border:1px solid #166534;border-radius:100px;padding:5px 12px;">
                      <span style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10px;
                                   font-weight:700;color:#86EFAC;letter-spacing:1px;">
                        — ${esc(driverName)}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── CTA ── -->
          <tr>
            <td class="body-pad" style="padding:20px 28px 8px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center">
                    <a href="https://uatob.com/driver/login"
                       style="display:inline-block;
                              background:linear-gradient(135deg,#22C55E,#16A34A);
                              color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                              font-size:15px;font-weight:800;text-decoration:none;
                              padding:16px 32px;border-radius:14px;letter-spacing:0.3px;
                              box-shadow:0 8px 22px rgba(22,163,74,0.4);">
                      Open Driver App &rarr;
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:10px;">
                    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                              font-size:12px;color:#86EFAC;">
                      &#9679; View the full driver feed inside the app
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── SUPPORT ── -->
          <tr>
            <td class="body-pad" style="padding:20px 28px 28px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background-color:#111111;border:1px solid #1f1f1f;border-radius:14px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td width="44" valign="middle">
                          <div style="width:36px;height:36px;background-color:#0d1f12;
                                      border:1px solid #166534;border-radius:10px;
                                      text-align:center;line-height:34px;font-size:18px;">
                            &#128172;
                          </div>
                        </td>
                        <td valign="middle" style="padding-left:8px;">
                          <p style="margin:0 0 2px;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                    font-size:14px;font-weight:700;color:#ffffff;">
                            Questions?
                          </p>
                          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                    font-size:12px;color:#9CA3AF;line-height:1.5;">
                            Reply to this email or write
                            <a href="mailto:support@uatob.com"
                               style="color:#22C55E;text-decoration:none;font-weight:700;">support@uatob.com</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td style="padding:22px 32px 26px;background-color:#000000;border-top:1px solid #1a1a1a;
                       text-align:center;" bgcolor="#000000">
              <table cellpadding="0" cellspacing="0" role="presentation" align="center"
                     style="margin:0 auto 10px;">
                <tr>
                  <td valign="middle" style="padding-right:6px;">
                    <div style="width:18px;height:18px;background:linear-gradient(135deg,#22C55E,#16A34A);
                                border-radius:5px;display:inline-block;text-align:center;line-height:18px;
                                font-size:9px;font-weight:900;color:#ffffff;font-family:Arial,sans-serif;">
                      U
                    </div>
                  </td>
                  <td valign="middle">
                    <span style="font-family:Arial,sans-serif;font-size:12px;font-weight:800;
                                 color:#ffffff;letter-spacing:-0.2px;">UaTob</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                        font-size:11px;color:#6B7280;">
                Orlando, Florida &nbsp;&middot;&nbsp; Built with &#10084; for drivers
              </p>
              <p style="margin:0 0 14px;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                        font-size:10.5px;color:#4B5563;">
                &copy; ${year} UaTob LLC. All rights reserved.
              </p>
              <div>
                <a href="https://uatob.com/privacy-policy"
                   style="color:#6B7280;text-decoration:none;font-size:10.5px;margin:0 8px;
                          font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                          border-bottom:1px dotted #4B5563;">Privacy</a>
                <a href="https://uatob.com/driver-terms"
                   style="color:#6B7280;text-decoration:none;font-size:10.5px;margin:0 8px;
                          font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                          border-bottom:1px dotted #4B5563;">Driver Terms</a>
                <a href="https://uatob.com/help"
                   style="color:#6B7280;text-decoration:none;font-size:10.5px;margin:0 8px;
                          font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                          border-bottom:1px dotted #4B5563;">Help</a>
              </div>
              <p style="margin:12px 0 0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                        font-size:10px;color:#374151;line-height:1.5;">
                You're receiving this because you're a UaTob driver.
                To stop receiving feed emails, update your preferences in the app.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

// ── Plain text builder ─────────────────────────────────────────────
function buildText({ driverName, message }) {
  return (
    `📢 Driver Feed — UaTob\n\n` +
    `Message from ${driverName}:\n\n` +
    `"${message}"\n\n` +
    `Open the driver app to see more: https://uatob.com/driver/login\n\n` +
    `Questions? Email support@uatob.com\n\n` +
    `— The UaTob Team · Orlando, FL`
  );
}

// ── Scheduled function ─────────────────────────────────────────────
exports.feedNotifier = onSchedule(
  {
    schedule:  "every 1 minutes",
    region:    "us-east1",
    timeZone:  "America/New_York",
    secrets:   ["SENDGRID_API_KEY"],
  },
  async () => {
    const now  = admin.firestore.Timestamp.now();
    const year = new Date().getFullYear();

    // ── Init SendGrid ────────────────────────────────────────────
    const sendgridKey = process.env.SENDGRID_API_KEY;
    if (!sendgridKey) {
      console.error("[feedNotifier] Missing SENDGRID_API_KEY");
      return;
    }
    sgMail.setApiKey(sendgridKey);

    // ── 1. Fetch active Feed posts ───────────────────────────────
    const feedSnap = await db
      .collection("Feed")
      .where("paymentStatus", "==", "succeeded")
      .where("status",        "==", "active")
      .get();

    if (feedSnap.empty) {
      console.log("[feedNotifier] No active posts.");
      return;
    }

    // ── 2. Fetch all drivers ─────────────────────────────────────
    const driversSnap = await db.collection("Drivers").get();

    if (driversSnap.empty) {
      console.log("[feedNotifier] No drivers found.");
      return;
    }

    // Build driver list — collect fcmToken AND email
    const drivers = [];
    driversSnap.forEach((doc) => {
      const d = doc.data();
      drivers.push({
        uid:      doc.id,
        fcmToken: d.fcmToken && typeof d.fcmToken === "string" ? d.fcmToken : null,
        email:    d.email    && typeof d.email    === "string" ? d.email    : null,
      });
    });

    console.log(
      `[feedNotifier] ${feedSnap.size} active post(s), ` +
      `${drivers.filter(d => d.fcmToken).length} push token(s), ` +
      `${drivers.filter(d => d.email).length} email address(es)`
    );

    // ── 3. Process each Feed post ────────────────────────────────
    for (const feedDoc of feedSnap.docs) {
      const feedId = feedDoc.id;
      const feed   = feedDoc.data();

      // ── 3a. Delete if expired ──────────────────────────────────
      if (feed.expiresAt && feed.expiresAt.toMillis() < now.toMillis()) {
        await feedDoc.ref.delete();
        console.log(`[feedNotifier] 🗑️  Deleted expired Feed ${feedId}`);
        continue;
      }

      const notifiedUids      = Array.isArray(feed.notifiedUids)      ? feed.notifiedUids      : [];
      const emailNotifiedUids = Array.isArray(feed.emailNotifiedUids) ? feed.emailNotifiedUids : [];

      const driverName = feed.driverName || "A driver";
      const message    = feed.message    || "";

      // ── 3b. PUSH — drivers not yet push-notified ───────────────
      const pendingPush = drivers.filter(
        (d) => d.fcmToken && !notifiedUids.includes(d.uid)
      );

      if (pendingPush.length > 0) {
        const pushResults = await Promise.allSettled(
          pendingPush.map(({ fcmToken }) =>
            getMessaging().send({
              token: fcmToken,
              notification: {
                title: `📢 ${driverName}`,
                body:  message,
              },
              data: { type: "driver_feed", feedId },
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

        const newlyPushed = [];
        const staleTokens = [];

        pushResults.forEach((result, i) => {
          if (result.status === "fulfilled") {
            newlyPushed.push(pendingPush[i].uid);
          } else {
            const code = result.reason?.errorInfo?.code ?? "";
            if (
              code === "messaging/registration-token-not-registered" ||
              code === "messaging/invalid-registration-token"
            ) {
              staleTokens.push({ uid: pendingPush[i].uid });
            }
            console.warn(
              `[feedNotifier] Push failed for ${pendingPush[i].uid}:`,
              code || result.reason?.message
            );
          }
        });

        if (newlyPushed.length > 0) {
          await feedDoc.ref.update({
            notifiedUids: admin.firestore.FieldValue.arrayUnion(...newlyPushed),
            updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`[feedNotifier] ✅ Push — Feed ${feedId} → ${newlyPushed.length} driver(s)`);
        }

        // Clean stale FCM tokens
        if (staleTokens.length > 0) {
          await Promise.allSettled(
            staleTokens.map(({ uid }) =>
              db.collection("Drivers").doc(uid).update({
                fcmToken: admin.firestore.FieldValue.delete(),
              })
            )
          );
          console.log(`[feedNotifier] 🧹 Removed ${staleTokens.length} stale token(s)`);
        }
      } else {
        console.log(`[feedNotifier] Push — Feed ${feedId} — all drivers already notified`);
      }

      // ── 3c. EMAIL — drivers not yet email-notified ─────────────
      const pendingEmail = drivers.filter(
        (d) => d.email && !emailNotifiedUids.includes(d.uid)
      );

      if (pendingEmail.length > 0) {
        const html = buildEmail({ driverName, message, feedId, year });
        const text = buildText({ driverName, message });

        const emailResults = await Promise.allSettled(
          pendingEmail.map(({ email }) =>
            sgMail.send({
              to:      email,
              from:    "UaTob <noreply@uatob.com>",
              replyTo: "support@uatob.com",
              subject: `📢 ${driverName} posted on the Driver Feed`,
              text,
              html,
            })
          )
        );

        const newlyEmailed = [];

        emailResults.forEach((result, i) => {
          if (result.status === "fulfilled") {
            newlyEmailed.push(pendingEmail[i].uid);
          } else {
            console.warn(
              `[feedNotifier] Email failed for ${pendingEmail[i].uid}:`,
              result.reason?.message
            );
          }
        });

        if (newlyEmailed.length > 0) {
          await feedDoc.ref.update({
            emailNotifiedUids: admin.firestore.FieldValue.arrayUnion(...newlyEmailed),
            updatedAt:         admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`[feedNotifier] ✅ Email — Feed ${feedId} → ${newlyEmailed.length} driver(s)`);
        }
      } else {
        console.log(`[feedNotifier] Email — Feed ${feedId} — all drivers already emailed`);
      }
    }
  }
);