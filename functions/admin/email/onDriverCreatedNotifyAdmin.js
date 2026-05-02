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

exports.onDriverCreatedNotifyAdmin = onDocumentCreated(
  {
    document: "Drivers/{uid}",
    region:   "us-east1",
    secrets:  ["SENDGRID_API_KEY"],
  },
  async (event) => {
    try {
      const snap = event.data;
      if (!snap) return null;

      const data = snap.data();
      const { email, firstName, lastName, createdAt, signInMethod, platform } = data || {};
      const uid = event.params.uid;

      if (data.adminNotified) {
        console.log("Admin already notified for this driver, skipping.");
        return null;
      }

      const sendgridKey = process.env.SENDGRID_API_KEY;
      if (!sendgridKey) {
        console.error("Missing SENDGRID_API_KEY");
        return null;
      }

      sgMail.setApiKey(sendgridKey);

      // ── Display values ─────────────────────────────────────────────────
      const fullName     = esc(`${firstName || ""} ${lastName || ""}`.trim() || "Unknown");
      const safeEmail    = esc(email        || "N/A");
      const safeUid      = esc(uid          || "N/A");
      const safeMethod   = esc(signInMethod || "N/A");
      const safePlatform = esc(platform     || "N/A");

      const createdStr = createdAt?.toDate?.()
        ? createdAt.toDate().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
        : new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

      const year = new Date().getFullYear();

      // ── Signup progress steps ──────────────────────────────────────────
      const steps = [
        { label: "Account Created",    done: true  },
        { label: "Personal Info",      done: false },
        { label: "Vehicle Details",    done: false },
        { label: "Documents Upload",   done: false },
        { label: "Background Check",   done: false },
      ];

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Driver — UaTob</title>
  <style>
    body { margin:0!important; padding:0!important; background:#f4f4f5!important; }
    @media only screen and (max-width:600px) {
      .outer-pad { padding: 16px !important; }
      .card { border-radius: 16px !important; }
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

        <!-- ── LOGO ROW ── -->
        <tr>
          <td align="center" style="padding-bottom:24px;">
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background:#0D9488;border-radius:14px;
                           padding:10px 20px;display:inline-block;">
                  <span style="font-size:20px;font-weight:900;
                               letter-spacing:-0.5px;color:#ffffff;">
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

        <!-- ── MAIN CARD ── -->
        <tr>
          <td style="background:#ffffff;border-radius:20px;
                     box-shadow:0 2px 12px rgba(0,0,0,.07);
                     overflow:hidden;" class="card">

            <!-- Hero band -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background:linear-gradient(120deg,#0D9488 0%,#0891B2 100%);
                           padding:36px 36px 28px;">
                  <table cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td>
                        <!-- Icon bubble -->
                        <div style="width:52px;height:52px;background:rgba(255,255,255,.18);
                                    border-radius:14px;text-align:center;line-height:52px;
                                    font-size:26px;margin-bottom:16px;">
                          🚗
                        </div>
                        <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.7);
                                    letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">
                          New Driver Account
                        </div>
                        <div style="font-size:26px;font-weight:900;color:#ffffff;
                                    letter-spacing:-0.5px;line-height:1.2;margin-bottom:4px;">
                          ${fullName}
                        </div>
                        <div style="font-size:14px;color:rgba(255,255,255,.8);">
                          ${safeEmail}
                        </div>
                      </td>
                      <td style="text-align:right;vertical-align:top;padding-top:4px;">
                        <div style="background:rgba(255,255,255,.15);border:1.5px solid rgba(255,255,255,.3);
                                    border-radius:100px;padding:6px 14px;display:inline-block;
                                    font-size:11px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">
                          STEP 1 OF 5
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Progress bar -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:0;background:#f1f5f9;">
                  <div style="height:4px;background:linear-gradient(90deg,#0D9488 0%,#0D9488 20%,#e2e8f0 20%,#e2e8f0 100%);"></div>
                </td>
              </tr>
            </table>

            <!-- Content -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:32px 36px;">

                  <!-- Status notice -->
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                         style="margin-bottom:28px;">
                    <tr>
                      <td style="background:#fefce8;border:1.5px solid #fde047;
                                 border-radius:12px;padding:14px 18px;">
                        <table cellpadding="0" cellspacing="0" role="presentation">
                          <tr>
                            <td style="font-size:18px;padding-right:12px;">⏳</td>
                            <td>
                              <div style="font-size:13px;font-weight:800;color:#854d0e;
                                          margin-bottom:2px;">Signup In Progress</div>
                              <div style="font-size:12px;color:#a16207;line-height:1.5;">
                                This driver just created their account. They haven't completed
                                their profile yet — no action needed from you until they
                                submit for approval.
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Account details -->
                  <div style="font-size:11px;font-weight:800;color:#94a3b8;
                              letter-spacing:1.5px;text-transform:uppercase;
                              margin-bottom:14px;">
                    Account Details
                  </div>

                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                         style="border:1px solid #e2e8f0;border-radius:12px;
                                overflow:hidden;margin-bottom:28px;">
                    ${[
                      ["Full Name",    fullName],
                      ["Email",        `<a href="mailto:${safeEmail}" style="color:#0D9488;text-decoration:none;font-weight:700;">${safeEmail}</a>`],
                      ["UID",          `<span style="font-family:monospace;font-size:11px;background:#f1f5f9;padding:3px 8px;border-radius:6px;color:#475569;">${safeUid}</span>`],
                      ["Sign-In",      safeMethod],
                      ["Platform",     safePlatform],
                      ["Registered",   createdStr],
                    ].map(([label, val], i, arr) => `
                    <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f8fafc"};">
                      <td style="padding:13px 16px;font-size:12px;color:#64748b;
                                 border-bottom:${i < arr.length - 1 ? "1px solid #e2e8f0" : "none"};
                                 width:38%;font-weight:600;">
                        ${label}
                      </td>
                      <td style="padding:13px 16px;font-size:13px;color:#0f172a;
                                 font-weight:700;text-align:right;
                                 border-bottom:${i < arr.length - 1 ? "1px solid #e2e8f0" : "none"};">
                        ${val}
                      </td>
                    </tr>`).join("")}
                  </table>

                  <!-- Signup progress -->
                  <div style="font-size:11px;font-weight:800;color:#94a3b8;
                              letter-spacing:1.5px;text-transform:uppercase;
                              margin-bottom:14px;">
                    Signup Progress
                  </div>

                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                         style="border:1px solid #e2e8f0;border-radius:12px;
                                overflow:hidden;margin-bottom:28px;">
                    ${steps.map((step, i) => `
                    <tr style="background:${step.done ? "#f0fdf9" : "#ffffff"};">
                      <td style="padding:12px 16px;
                                 border-bottom:${i < steps.length - 1 ? "1px solid #e2e8f0" : "none"};">
                        <table cellpadding="0" cellspacing="0" role="presentation">
                          <tr>
                            <td style="width:28px;">
                              <div style="width:22px;height:22px;border-radius:50%;
                                          background:${step.done ? "#0D9488" : "#e2e8f0"};
                                          text-align:center;line-height:22px;
                                          font-size:11px;font-weight:800;
                                          color:${step.done ? "#ffffff" : "#94a3b8"};">
                                ${step.done ? "✓" : (i + 1)}
                              </div>
                            </td>
                            <td style="padding-left:10px;font-size:13px;
                                       font-weight:${step.done ? "700" : "500"};
                                       color:${step.done ? "#0f172a" : "#94a3b8"};">
                              ${esc(step.label)}
                            </td>
                            <td style="text-align:right;padding-right:4px;">
                              <span style="font-size:11px;font-weight:700;
                                          color:${step.done ? "#0D9488" : "#cbd5e1"};
                                          background:${step.done ? "#ccfbf1" : "#f1f5f9"};
                                          padding:3px 10px;border-radius:100px;">
                                ${step.done ? "Done" : "Pending"}
                              </span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>`).join("")}
                  </table>

                  <!-- CTA buttons -->
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                         style="margin-bottom:8px;">
                    <tr>
                      <td width="49%" align="center">
                        <a href="https://console.firebase.google.com/project/uatob-e7b4b/firestore/databases/-default-/data/~2FDrivers~2F${safeUid}"
                           style="display:block;background:linear-gradient(120deg,#0D9488,#0891B2);
                                  color:#ffffff;font-size:13px;font-weight:800;
                                  text-decoration:none;padding:13px 16px;
                                  border-radius:10px;text-align:center;
                                  letter-spacing:0.3px;">
                          View in Firestore →
                        </a>
                      </td>
                      <td width="2%"></td>
                      <td width="49%" align="center">
                        <a href="https://console.firebase.google.com/project/uatob-e7b4b/authentication/users"
                           style="display:block;background:#0f172a;
                                  color:#ffffff;font-size:13px;font-weight:800;
                                  text-decoration:none;padding:13px 16px;
                                  border-radius:10px;text-align:center;
                                  letter-spacing:0.3px;">
                          View in Auth →
                        </a>
                      </td>
                    </tr>
                  </table>

                </td>
              </tr>
            </table>

            <!-- Footer strip -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background:#f8fafc;border-top:1px solid #e2e8f0;
                           padding:18px 36px;text-align:center;">
                  <div style="font-size:11px;color:#94a3b8;line-height:1.7;">
                    Automated admin alert from UaTob &nbsp;·&nbsp;
                    <a href="mailto:support@uatob.com"
                       style="color:#0D9488;text-decoration:none;">support@uatob.com</a><br/>
                    Do not share — contains internal driver data.<br/>
                    © ${year} UaTob LLC. All rights reserved.
                  </div>
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
        subject: `🚗 New driver started signup — ${fullName} (${safeEmail})`,
        text:
          `New driver account created on UaTob.\n\n` +
          `Name:       ${fullName}\n` +
          `Email:      ${email  || "N/A"}\n` +
          `UID:        ${uid    || "N/A"}\n` +
          `Sign-In:    ${signInMethod || "N/A"}\n` +
          `Platform:   ${platform    || "N/A"}\n` +
          `Created:    ${createdStr}\n\n` +
          `Status: Signup in progress (Step 1 of 5 complete).\n` +
          `No action needed until they submit for approval.\n\n` +
          `Firestore: https://console.firebase.google.com/project/uatob-e7b4b/firestore/databases/-default-/data/~2FDrivers~2F${uid}`,
        html,
      };

      await sgMail.send(msg);
      console.log(`📧 Admin email sent for new driver: ${email} (uid: ${uid})`);

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
                  title: `🚗 New driver: ${fullName}`,
                  body:  `${safeEmail} just created an account`,
                },
                data: { screen: "approvals", uid: uid ?? "" },
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
      console.log(`✅ Admin fully notified for driver: ${email} (uid: ${uid})`);
      return null;

    } catch (error) {
      console.error("❌ Error in onDriverCreatedNotifyAdmin:", error);
      if (error.response) console.error(error.response.body);
      return null;
    }
  }
);