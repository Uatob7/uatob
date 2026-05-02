const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getMessaging }      = require("firebase-admin/messaging");
const sgMail                = require("@sendgrid/mail");
const admin                 = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const esc = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const ADMIN_EMAIL = "support@uatob.com";

exports.onAccountCreatedNotifyAdmin = onDocumentCreated(
  {
    document: "Accounts/{uid}",
    region:   "us-east1",
    secrets:  ["SENDGRID_API_KEY"],
  },
  async (event) => {
    try {
      const snap = event.data;
      if (!snap) return null;

      const data = snap.data();
      const { email, name, createdAt } = data || {};
      const uid = event.params.uid;

      if (data.adminNotified) {
        console.log("Admin already notified, skipping.");
        return null;
      }

      const sendgridKey = process.env.SENDGRID_API_KEY;
      if (!sendgridKey) {
        console.error("Missing SENDGRID_API_KEY");
        return null;
      }

      sgMail.setApiKey(sendgridKey);

      // ── Display values ─────────────────────────────────────────────────
      const safeName  = esc(name  || "Unknown");
      const safeEmail = esc(email || "N/A");
      const safeUid   = esc(uid   || "N/A");

      const createdStr = createdAt?.toDate?.()
        ? createdAt.toDate().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
        : new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

      // First name for the greeting
      const firstName = esc((name || "").split(" ")[0] || "New rider");

      const year = new Date().getFullYear();

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Rider — UaTob</title>
  <style>
    body { margin:0!important; padding:0!important; background:#f4f4f5!important; }
    @media only screen and (max-width:600px) {
      .outer-pad { padding: 16px !important; }
      .card      { border-radius: 16px !important; }
      .hero-pad  { padding: 28px 20px 24px !important; }
      .body-pad  { padding: 24px 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="background:#f4f4f5;padding:40px 20px;" class="outer-pad">
  <tr>
    <td align="center">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:560px;width:100%;">

        <!-- ── LOGO ── -->
        <tr>
          <td align="center" style="padding-bottom:20px;">
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background:#0D9488;border-radius:12px;padding:9px 18px;">
                  <span style="font-size:18px;font-weight:900;letter-spacing:-0.5px;color:#ffffff;">
                    Ua<span style="color:#99f6e4;">Tob</span>
                  </span>
                </td>
                <td style="padding-left:12px;">
                  <span style="font-size:11px;font-weight:700;color:#71717a;
                               letter-spacing:1.5px;text-transform:uppercase;">
                    Admin Alerts
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── CARD ── -->
        <tr>
          <td style="background:#ffffff;border-radius:20px;
                     box-shadow:0 2px 16px rgba(0,0,0,.08);overflow:hidden;" class="card">

            <!-- Hero -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background:linear-gradient(120deg,#0f172a 0%,#1e3a5f 60%,#0D9488 100%);
                           padding:40px 36px 32px;" class="hero-pad">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td>
                        <!-- Avatar circle with initial -->
                        <div style="width:56px;height:56px;border-radius:50%;
                                    background:rgba(255,255,255,.15);
                                    border:2px solid rgba(255,255,255,.25);
                                    text-align:center;line-height:56px;
                                    font-size:22px;font-weight:900;color:#ffffff;
                                    margin-bottom:18px;text-transform:uppercase;">
                          ${esc((name || "?")[0])}
                        </div>
                        <div style="font-size:11px;font-weight:700;
                                    color:rgba(255,255,255,.55);letter-spacing:2px;
                                    text-transform:uppercase;margin-bottom:6px;">
                          New Rider Account
                        </div>
                        <div style="font-size:28px;font-weight:900;color:#ffffff;
                                    letter-spacing:-0.5px;line-height:1.1;margin-bottom:6px;">
                          ${safeName}
                        </div>
                        <div style="font-size:14px;color:rgba(255,255,255,.7);
                                    font-weight:500;">
                          ${safeEmail}
                        </div>
                      </td>
                      <td style="vertical-align:top;text-align:right;">
                        <div style="background:rgba(13,148,136,.3);
                                    border:1.5px solid rgba(153,246,228,.4);
                                    border-radius:100px;padding:6px 14px;
                                    display:inline-block;font-size:11px;
                                    font-weight:800;color:#99f6e4;
                                    letter-spacing:0.5px;white-space:nowrap;">
                          ● JUST JOINED
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Thin accent line -->
            <div style="height:3px;background:linear-gradient(90deg,#0D9488,#0891B2,#6366f1);"></div>

            <!-- Body -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:32px 36px;" class="body-pad">

                  <!-- Account details card -->
                  <div style="font-size:11px;font-weight:800;color:#94a3b8;
                              letter-spacing:1.5px;text-transform:uppercase;
                              margin-bottom:12px;">
                    Account Details
                  </div>

                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                         style="border:1px solid #e2e8f0;border-radius:14px;
                                overflow:hidden;margin-bottom:24px;">
                    <!-- Name -->
                    <tr style="background:#f8fafc;">
                      <td style="padding:14px 18px;font-size:12px;color:#64748b;
                                 font-weight:600;border-bottom:1px solid #e2e8f0;width:35%;">
                        Full Name
                      </td>
                      <td style="padding:14px 18px;font-size:13px;color:#0f172a;
                                 font-weight:700;text-align:right;
                                 border-bottom:1px solid #e2e8f0;">
                        ${safeName}
                      </td>
                    </tr>
                    <!-- Email -->
                    <tr style="background:#ffffff;">
                      <td style="padding:14px 18px;font-size:12px;color:#64748b;
                                 font-weight:600;border-bottom:1px solid #e2e8f0;">
                        Email
                      </td>
                      <td style="padding:14px 18px;font-size:13px;text-align:right;
                                 border-bottom:1px solid #e2e8f0;">
                        <a href="mailto:${safeEmail}"
                           style="color:#0D9488;text-decoration:none;font-weight:700;">
                          ${safeEmail}
                        </a>
                      </td>
                    </tr>
                    <!-- UID -->
                    <tr style="background:#f8fafc;">
                      <td style="padding:14px 18px;font-size:12px;color:#64748b;
                                 font-weight:600;border-bottom:1px solid #e2e8f0;">
                        UID
                      </td>
                      <td style="padding:14px 18px;text-align:right;
                                 border-bottom:1px solid #e2e8f0;">
                        <span style="font-family:monospace;font-size:11px;
                                     background:#f1f5f9;color:#475569;
                                     padding:4px 9px;border-radius:6px;
                                     display:inline-block;word-break:break-all;">
                          ${safeUid}
                        </span>
                      </td>
                    </tr>
                    <!-- Registered -->
                    <tr style="background:#ffffff;">
                      <td style="padding:14px 18px;font-size:12px;color:#64748b;font-weight:600;">
                        Registered
                      </td>
                      <td style="padding:14px 18px;font-size:13px;color:#0f172a;
                                 font-weight:700;text-align:right;">
                        ${createdStr}
                      </td>
                    </tr>
                  </table>

                  <!-- Milestone notice -->
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                         style="margin-bottom:24px;">
                    <tr>
                      <td style="background:linear-gradient(135deg,#f0fdf4,#ecfdf5);
                                 border:1.5px solid #86efac;border-radius:12px;
                                 padding:16px 18px;">
                        <table cellpadding="0" cellspacing="0" role="presentation">
                          <tr>
                            <td style="font-size:22px;padding-right:14px;
                                       vertical-align:middle;">🎉</td>
                            <td>
                              <div style="font-size:13px;font-weight:800;
                                          color:#14532d;margin-bottom:3px;">
                                ${firstName} is ready to ride
                              </div>
                              <div style="font-size:12px;color:#166534;line-height:1.5;">
                                Their account is active. They can book a ride on UaTob
                                right now — no further action needed.
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- CTA buttons -->
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                         style="margin-bottom:28px;">
                    <tr>
                      <td width="49%">
                        <a href="https://console.firebase.google.com/project/uatob-e7b4b/firestore/databases/-default-/data/~2FAccounts~2F${safeUid}"
                           style="display:block;background:linear-gradient(120deg,#0D9488,#0891B2);
                                  color:#ffffff;font-size:13px;font-weight:800;
                                  text-decoration:none;padding:13px 16px;
                                  border-radius:10px;text-align:center;">
                          View in Firestore →
                        </a>
                      </td>
                      <td width="2%"></td>
                      <td width="49%">
                        <a href="https://console.firebase.google.com/project/uatob-e7b4b/authentication/users"
                           style="display:block;background:#0f172a;
                                  color:#ffffff;font-size:13px;font-weight:800;
                                  text-decoration:none;padding:13px 16px;
                                  border-radius:10px;text-align:center;">
                          View in Auth →
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Divider + footer note -->
                  <div style="border-top:1px solid #e2e8f0;padding-top:20px;
                              text-align:center;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.8;">
                      Automated admin alert from UaTob &nbsp;·&nbsp;
                      <a href="mailto:support@uatob.com"
                         style="color:#0D9488;text-decoration:none;">
                        support@uatob.com
                      </a><br/>
                      Do not share — contains internal user data.
                    </p>
                  </div>

                </td>
              </tr>
            </table>

            <!-- Footer strip -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background:#f8fafc;border-top:1px solid #e2e8f0;
                           padding:16px 36px;text-align:center;">
                  <span style="font-size:13px;font-weight:800;color:#0f172a;">UaTob</span>
                  <span style="font-size:12px;color:#94a3b8;margin:0 8px;">·</span>
                  <span style="font-size:12px;color:#94a3b8;">Admin Notifications</span>
                  <br/>
                  <span style="font-size:11px;color:#cbd5e1;">
                    © ${year} UaTob LLC. All rights reserved.
                  </span>
                </td>
              </tr>
            </table>

          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;

      const msg = {
        to:      ADMIN_EMAIL,
        from:    "UaTob Admin <noreply@uatob.com>",
        subject: `🆕 New rider: ${safeName} (${safeEmail})`,
        text:
          `New rider account created on UaTob.\n\n` +
          `Name:      ${name  || "N/A"}\n` +
          `Email:     ${email || "N/A"}\n` +
          `UID:       ${uid   || "N/A"}\n` +
          `Created:   ${createdStr}\n\n` +
          `Account is active — no action needed.\n\n` +
          `Firestore: https://console.firebase.google.com/project/uatob-e7b4b/firestore/databases/-default-/data/~2FAccounts~2F${uid}`,
        html,
      };

      await sgMail.send(msg);
      console.log(`📧 Admin email sent for new account: ${email} (uid: ${uid})`);

      // ── Push notification ──────────────────────────────────────────────
      try {
        const pushDoc = await db.collection("Admin").doc("push").get();
        let tokens = [];

        if (pushDoc.exists) {
          const pushData = pushDoc.data();
          if (pushData.token && typeof pushData.token === "string") {
            tokens = [pushData.token];
          } else if (pushData.tokens && Array.isArray(pushData.tokens)) {
            tokens = pushData.tokens;
          }
        }

        if (tokens.length > 0) {
          const pushResults = await Promise.allSettled(
            tokens.map((token) =>
              getMessaging().send({
                token,
                notification: {
                  title: `🆕 New rider: ${safeName}`,
                  body:  `${safeEmail} just created an account`,
                },
                data: { screen: "riders", uid: uid ?? "" },
                webpush: {
                  notification: { icon: "/icon.png", badge: "/icon.png" },
                  fcmOptions:   { link: "https://uatob.com/admin" },
                },
              })
            )
          );

          const staleTokens = pushResults
            .map((result, i) => ({ result, token: tokens[i] }))
            .filter(({ result }) => {
              if (result.status !== "rejected") return false;
              const code = result.reason?.errorInfo?.code ?? "";
              return (
                code === "messaging/registration-token-not-registered" ||
                code === "messaging/invalid-registration-token"
              );
            })
            .map(({ token }) => token);

          if (staleTokens.length > 0) {
            const currentData = (await db.collection("Admin").doc("push").get()).data() || {};
            if (typeof currentData.token === "string") {
              await db.collection("Admin").doc("push").update({
                token: admin.firestore.FieldValue.delete(),
              });
            } else if (Array.isArray(currentData.tokens)) {
              await db.collection("Admin").doc("push").update({
                tokens: admin.firestore.FieldValue.arrayRemove(...staleTokens),
              });
            }
            console.log(`🧹 Removed ${staleTokens.length} stale token(s)`);
          }

          console.log(`🔔 Admin push sent to ${tokens.length} browser(s)`);
        } else {
          console.log("🔔 No admin FCM tokens found — skipping push");
        }
      } catch (pushErr) {
        console.warn("⚠️ Admin push failed (non-fatal):", pushErr.message);
      }

      await snap.ref.update({ adminNotified: true });
      console.log(`✅ Admin fully notified for new account: ${email} (uid: ${uid})`);
      return null;

    } catch (error) {
      console.error("❌ Error in onAccountCreatedNotifyAdmin:", error);
      if (error.response) console.error(error.response.body);
      return null;
    }
  }
);