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
    region:   "us-central1",
    secrets:  ["SENDGRID_API_KEY"],
  },
  async (event) => {
    try {
      const snap = event.data;
      if (!snap) return null;

      const data = snap.data();
      const {
        email,
        name,
        phone,
        createdAt,
        signInMethod,
        platform,
        referralCode,
      } = data || {};

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

      // ── Sanitised display values ───────────────────────────────────────
      const safeName     = esc(name         || "N/A");
      const safeEmail    = esc(email        || "N/A");
      const safePhone    = esc(phone        || "N/A");
      const safeUid      = esc(uid          || "N/A");
      const safeMethod   = esc(signInMethod || "N/A");
      const safePlatform = esc(platform     || "N/A");
      const safeReferral = esc(referralCode || "None");

      const createdStr = createdAt?.toDate?.()
        ? createdAt.toDate().toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : "N/A";

      const year = new Date().getFullYear();

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>New Account — UaTob Admin</title>
  <style type="text/css">
    body, html, div, span, p, a, table, tr, td, h1, h2, h3, h4, h5, h6 {
      -webkit-text-size-adjust: 100% !important;
      -ms-text-size-adjust: 100% !important;
    }
    body {
      margin: 0 !important; padding: 0 !important;
      width: 100% !important; min-width: 100% !important;
      background-color: #ffffff !important; color: #000000 !important;
    }
    @media (prefers-color-scheme: dark) {
      body, html { background-color: #ffffff !important; }
      * { background-color: inherit !important; color: #000000 !important; }
    }
    @media only screen and (max-width: 600px) {
      .hero-title  { font-size: 24px !important; }
      .content-pad { padding: 24px 16px !important; }
    }
  </style>
</head>
<body style="margin:0!important;padding:0!important;background-color:#ffffff!important;">

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="margin:0;padding:40px 0;background-color:#ffffff;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:600px;width:100%;background-color:#ffffff;
                      border-radius:24px;overflow:hidden;">

          <!-- ── HERO ── -->
          <tr>
            <td align="center"
                style="background:linear-gradient(135deg,#1D4ED8 0%,#2563EB 55%,#3B82F6 100%);
                       padding:48px 32px 40px;">
              <table cellpadding="0" cellspacing="0" role="presentation"
                     style="margin:0 auto 20px;">
                <tr>
                  <td align="center">
                    <div style="width:72px;height:72px;
                                background-color:rgba(255,255,255,0.15);
                                border-radius:50%;text-align:center;
                                line-height:72px;font-size:36px;">
                      🆕
                    </div>
                  </td>
                </tr>
              </table>
              <h1 class="hero-title"
                  style="margin:0 0 10px;font-size:28px;font-weight:900;
                         color:#ffffff;line-height:1.2;letter-spacing:-0.5px;
                         font-family:Arial,sans-serif;">
                New Rider Account
              </h1>
              <p style="margin:0;font-size:14px;color:#ffffff;font-weight:500;
                        font-family:Arial,sans-serif;opacity:0.85;line-height:1.5;">
                A new user just signed up on UaTob
              </p>
            </td>
          </tr>

          <!-- ── TIMESTAMP BADGE ── -->
          <tr>
            <td style="padding:0 32px;background-color:#ffffff;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-top:-18px;">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background-color:#eff6ff;
                                border:2px solid #93c5fd;border-radius:100px;
                                padding:9px 22px;font-size:12px;font-weight:700;
                                color:#1D4ED8;font-family:Arial,sans-serif;
                                letter-spacing:0.5px;">
                      🕐 &nbsp;${createdStr.toUpperCase()}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── MAIN CONTENT ── -->
          <tr>
            <td class="content-pad"
                style="padding:32px 32px;background-color:#ffffff;">

              <!-- ── USER DETAILS ── -->
              <div style="background-color:#f9fafb;border:1px solid #e5e7eb;
                          border-radius:16px;padding:24px;margin-bottom:24px;">
                <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  👤 User Details
                </h2>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  ${[
                    ["Full Name", safeName],
                    ["Email",     safeEmail],
                    ["Phone",     safePhone],
                    ["UID",       `<span style="font-family:monospace;font-size:12px;
                                   background:#e5e7eb;padding:2px 6px;border-radius:4px;">
                                   ${safeUid}</span>`],
                  ].map(([label, val], i, arr) => `
                  <tr>
                    <td style="padding:10px 0;
                               ${i < arr.length - 1 ? "border-bottom:1px solid #e5e7eb;" : ""}
                               font-size:13px;color:#6B7280;
                               font-family:Arial,sans-serif;width:40%;">
                      ${label}
                    </td>
                    <td style="padding:10px 0;
                               ${i < arr.length - 1 ? "border-bottom:1px solid #e5e7eb;" : ""}
                               font-size:13px;color:#111827;font-weight:700;
                               font-family:Arial,sans-serif;text-align:right;">
                      ${val}
                    </td>
                  </tr>`).join("")}
                </table>
              </div>

              <!-- ── SIGNUP METADATA ── -->
              <div style="background-color:#eff6ff;border:2px solid #93c5fd;
                          border-radius:16px;padding:24px;margin-bottom:24px;">
                <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  📱 Sign-Up Details
                </h2>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  ${[
                    ["Sign-In Method", safeMethod],
                    ["Platform",       safePlatform],
                    ["Referral Code",  safeReferral],
                    ["Timestamp",      createdStr],
                  ].map(([label, val], i, arr) => `
                  <tr>
                    <td style="padding:10px 0;
                               ${i < arr.length - 1 ? "border-bottom:1px solid #bfdbfe;" : ""}
                               font-size:13px;color:#6B7280;
                               font-family:Arial,sans-serif;width:45%;">
                      ${label}
                    </td>
                    <td style="padding:10px 0;
                               ${i < arr.length - 1 ? "border-bottom:1px solid #bfdbfe;" : ""}
                               font-size:13px;color:#111827;font-weight:700;
                               font-family:Arial,sans-serif;text-align:right;
                               text-transform:capitalize;">
                      ${val}
                    </td>
                  </tr>`).join("")}
                </table>
              </div>

              <!-- ── ADMIN ACTIONS ── -->
              <div style="background-color:#f9fafb;border:1px solid #e5e7eb;
                          border-radius:16px;padding:20px;margin-bottom:24px;">
                <h2 style="margin:0 0 14px;font-size:16px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  ⚡ Quick Actions
                </h2>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td width="48%" align="center">
                      <a href="https://console.firebase.google.com/project/uatob/firestore/data/Accounts/${safeUid}"
                         style="display:inline-block;background-color:#2563EB;
                                color:#ffffff;font-size:13px;font-weight:700;
                                text-decoration:none;padding:12px 20px;
                                border-radius:10px;font-family:Arial,sans-serif;
                                width:100%;box-sizing:border-box;text-align:center;">
                        View in Firestore →
                      </a>
                    </td>
                    <td width="4%"></td>
                    <td width="48%" align="center">
                      <a href="https://console.firebase.google.com/project/uatob/authentication/users"
                         style="display:inline-block;background-color:#111827;
                                color:#ffffff;font-size:13px;font-weight:700;
                                text-decoration:none;padding:12px 20px;
                                border-radius:10px;font-family:Arial,sans-serif;
                                width:100%;box-sizing:border-box;text-align:center;">
                        View in Auth →
                      </a>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- ── FOOTER NOTE ── -->
              <div style="text-align:center;padding-top:20px;
                          border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:12px;color:#9CA3AF;
                           line-height:1.7;font-family:Arial,sans-serif;">
                  This is an automated admin notification from UaTob.<br/>
                  Do not share this email — it contains internal user data.
                </p>
              </div>

            </td>
          </tr>

          <!-- ── EMAIL FOOTER ── -->
          <tr>
            <td style="padding:20px 32px;text-align:center;
                       background-color:#f3f4f6;border-top:1px solid #e5e7eb;">
              <div style="font-size:14px;font-weight:800;color:#111827;
                          font-family:Arial,sans-serif;margin-bottom:4px;">
                UaTob Admin
              </div>
              <div style="font-size:12px;color:#6B7280;font-family:Arial,sans-serif;
                          margin-bottom:8px;">
                Internal Notifications
              </div>
              <div style="font-size:11px;color:#9CA3AF;font-family:Arial,sans-serif;">
                © ${year} UaTob. All rights reserved.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
      `;

      const msg = {
        to:      ADMIN_EMAIL,
        from:    "UaTob Admin <noreply@uatob.com>",
        subject: `🆕 New rider: ${safeName} (${safeEmail})`,
        text:
          `New rider signed up on UaTob.\n\n` +
          `Name:         ${name     || "N/A"}\n` +
          `Email:        ${email    || "N/A"}\n` +
          `Phone:        ${phone    || "N/A"}\n` +
          `UID:          ${uid      || "N/A"}\n` +
          `Sign-In:      ${signInMethod || "N/A"}\n` +
          `Platform:     ${platform    || "N/A"}\n` +
          `Referral:     ${referralCode || "None"}\n` +
          `Created:      ${createdStr}`,
        html,
      };

      // ── Send email ─────────────────────────────────────────────────────
      await sgMail.send(msg);
      console.log(`📧 Admin email sent for new account: ${email} (uid: ${uid})`);

      // ── Send push to all admin browsers ───────────────────────────────
      try {
        const adminTokenDoc = await db.collection("AdminTokens").doc("push").get();
        const tokens = adminTokenDoc.exists
          ? (adminTokenDoc.data()?.tokens ?? [])
          : [];

        if (tokens.length > 0) {
          const pushResults = await Promise.allSettled(
            tokens.map((token) =>
              getMessaging().send({
                token,
                notification: {
                  title: `🆕 New rider: ${name || "N/A"}`,
                  body:  `${email || "N/A"} just signed up on UaTob`,
                },
                data: {
                  screen: "riders",
                  uid:    uid ?? "",
                },
                webpush: {
                  notification: {
                    icon:  "/icon.png",
                    badge: "/icon.png",
                  },
                  fcmOptions: {
                    link: "https://uatob.com/admin",
                  },
                },
              })
            )
          );

          // ── Clean up stale tokens ──────────────────────────────────────
          const staleTokens = [];
          pushResults.forEach((result, i) => {
            if (result.status === "rejected") {
              const errCode = result.reason?.errorInfo?.code ?? "";
              if (
                errCode === "messaging/registration-token-not-registered" ||
                errCode === "messaging/invalid-registration-token"
              ) {
                staleTokens.push(tokens[i]);
              }
            }
          });

          if (staleTokens.length > 0) {
            await db.collection("AdminTokens").doc("push").update({
              tokens: admin.firestore.FieldValue.arrayRemove(...staleTokens),
            });
            console.log(`🧹 Removed ${staleTokens.length} stale admin FCM token(s)`);
          }

          console.log(`🔔 Admin push sent to ${tokens.length} browser(s)`);
        } else {
          console.log("🔔 No admin FCM tokens found — skipping push");
        }
      } catch (pushErr) {
        console.warn("⚠️ Admin push failed (non-fatal):", pushErr.message);
      }

      // ── Mark as notified ───────────────────────────────────────────────
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