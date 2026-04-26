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
      const {
        email,
        firstName,
        lastName,
        phone,
        createdAt,
        vehicle,
        documents,
        signInMethod,
        platform,
        referralCode,
      } = data || {};

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

      // ── Sanitised display values ───────────────────────────────────────
      const fullName     = esc(`${firstName || ""} ${lastName || ""}`.trim() || "N/A");
      const safeEmail    = esc(email        || "N/A");
      const safePhone    = esc(phone        || "N/A");
      const safeUid      = esc(uid          || "N/A");
      const safeMethod   = esc(signInMethod || "N/A");
      const safePlatform = esc(platform     || "N/A");
      const safeReferral = esc(referralCode || "None");

      const vehicleStr = esc(
        vehicle?.make && vehicle?.model
          ? `${vehicle.year || ""} ${vehicle.make} ${vehicle.model}`.trim()
          : "N/A"
      );
      const safePlate     = esc(vehicle?.plate || "N/A");
      const safeColor     = esc(vehicle?.color || "N/A");
      const safeRideTypes = esc(
        vehicle?.rideTypes?.length ? vehicle.rideTypes.join(", ") : "N/A"
      );

      const createdStr = createdAt?.toDate?.()
        ? createdAt.toDate().toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : "N/A";

      // ── Document status rows ───────────────────────────────────────────
      const docRows = [
        { label: "Driver's License (Front)", ok: documents?.licenseFront },
        { label: "Driver's License (Back)",  ok: documents?.licenseBack  },
        { label: "Vehicle Registration",     ok: documents?.registration },
        { label: "Proof of Insurance",       ok: documents?.insurance    },
        { label: "Profile Photo",            ok: documents?.profilePhoto },
      ];
      const allDocsUploaded = docRows.every(d => d.ok);
      const uploadedCount   = docRows.filter(d => d.ok).length;

      const year = new Date().getFullYear();

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>New Driver Signup — UaTob Admin</title>
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
                style="background:linear-gradient(135deg,#15803D 0%,#16A34A 55%,#22C55E 100%);
                       padding:48px 32px 40px;">
              <table cellpadding="0" cellspacing="0" role="presentation"
                     style="margin:0 auto 20px;">
                <tr>
                  <td align="center">
                    <div style="width:72px;height:72px;
                                background-color:rgba(255,255,255,0.15);
                                border-radius:50%;text-align:center;
                                line-height:72px;font-size:36px;">
                      🚗
                    </div>
                  </td>
                </tr>
              </table>
              <h1 class="hero-title"
                  style="margin:0 0 10px;font-size:28px;font-weight:900;
                         color:#ffffff;line-height:1.2;letter-spacing:-0.5px;
                         font-family:Arial,sans-serif;">
                New Driver Signup
              </h1>
              <p style="margin:0;font-size:14px;color:#ffffff;font-weight:500;
                        font-family:Arial,sans-serif;opacity:0.85;line-height:1.5;">
                A new driver just created an account on UaTob
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
                    <div style="display:inline-block;background-color:#f0fdf4;
                                border:2px solid #86efac;border-radius:100px;
                                padding:9px 22px;font-size:12px;font-weight:700;
                                color:#15803D;font-family:Arial,sans-serif;
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

              <!-- ── DRIVER DETAILS ── -->
              <div style="background-color:#f9fafb;border:1px solid #e5e7eb;
                          border-radius:16px;padding:24px;margin-bottom:24px;">
                <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  👤 Driver Details
                </h2>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  ${[
                    ["Full Name", fullName],
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

              <!-- ── VEHICLE INFO ── -->
              <div style="background-color:#eff6ff;border:2px solid #93c5fd;
                          border-radius:16px;padding:24px;margin-bottom:24px;">
                <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  🚙 Vehicle Info
                </h2>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  ${[
                    ["Vehicle",    vehicleStr],
                    ["Plate",      safePlate],
                    ["Color",      safeColor],
                    ["Ride Types", safeRideTypes],
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

              <!-- ── DOCUMENT STATUS ── -->
              <div style="border-radius:16px;padding:24px;margin-bottom:24px;
                          background-color:${allDocsUploaded ? "#f0fdf4" : "#fffbeb"};
                          border:2px solid ${allDocsUploaded ? "#86efac" : "#fde047"};">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                       style="margin-bottom:14px;">
                  <tr>
                    <td>
                      <h2 style="margin:0;font-size:16px;font-weight:700;
                                 color:#111827;font-family:Arial,sans-serif;">
                        📁 Documents
                      </h2>
                    </td>
                    <td style="text-align:right;">
                      <span style="font-size:12px;font-weight:700;
                                   color:${allDocsUploaded ? "#15803D" : "#92400e"};
                                   font-family:Arial,sans-serif;">
                        ${uploadedCount}/${docRows.length} UPLOADED
                      </span>
                    </td>
                  </tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  ${docRows.map((d, i) => `
                  <tr>
                    <td style="padding:9px 0;
                               ${i < docRows.length - 1 ? "border-bottom:1px solid " + (allDocsUploaded ? "#bbf7d0" : "#fde68a") + ";" : ""}
                               font-size:13px;color:#111827;
                               font-family:Arial,sans-serif;">
                      ${esc(d.label)}
                    </td>
                    <td style="padding:9px 0;
                               ${i < docRows.length - 1 ? "border-bottom:1px solid " + (allDocsUploaded ? "#bbf7d0" : "#fde68a") + ";" : ""}
                               font-size:13px;font-weight:700;text-align:right;
                               color:${d.ok ? "#16A34A" : "#D97706"};
                               font-family:Arial,sans-serif;">
                      ${d.ok ? "✓ Uploaded" : "⚠ Missing"}
                    </td>
                  </tr>`).join("")}
                </table>
              </div>

              <!-- ── SIGNUP METADATA ── -->
              <div style="background-color:#f9fafb;border:1px solid #e5e7eb;
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
                               ${i < arr.length - 1 ? "border-bottom:1px solid #e5e7eb;" : ""}
                               font-size:13px;color:#6B7280;
                               font-family:Arial,sans-serif;width:45%;">
                      ${label}
                    </td>
                    <td style="padding:10px 0;
                               ${i < arr.length - 1 ? "border-bottom:1px solid #e5e7eb;" : ""}
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
                      <a href="https://console.firebase.google.com/project/uatob/firestore/data/Drivers/${safeUid}"
                         style="display:inline-block;background-color:#16A34A;
                                color:#ffffff;font-size:13px;font-weight:700;
                                text-decoration:none;padding:12px 20px;
                                border-radius:10px;font-family:Arial,sans-serif;
                                width:100%;box-sizing:border-box;text-align:center;">
                        Review in Firestore →
                      </a>
                    </td>
                    <td width="4%">nbsp;</td>
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
                  Do not share this email — it contains internal driver data.
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
        subject: `🚗 New driver: ${fullName} (${safeEmail}) — ${uploadedCount}/${docRows.length} docs`,
        text:
          `New driver signed up on UaTob.\n\n` +
          `Name:         ${fullName}\n` +
          `Email:        ${email     || "N/A"}\n` +
          `Phone:        ${phone     || "N/A"}\n` +
          `UID:          ${uid       || "N/A"}\n` +
          `Vehicle:      ${vehicleStr}\n` +
          `Plate:        ${vehicle?.plate || "N/A"}\n` +
          `Ride Types:   ${vehicle?.rideTypes?.join(", ") || "N/A"}\n` +
          `Documents:    ${uploadedCount}/${docRows.length} uploaded\n` +
          `Sign-In:      ${signInMethod  || "N/A"}\n` +
          `Platform:     ${platform      || "N/A"}\n` +
          `Created:      ${createdStr}`,
        html,
      };

      // ── Send email ─────────────────────────────────────────────────────
      await sgMail.send(msg);
      console.log(`📧 Admin email sent for driver: ${email} (uid: ${uid})`);

      // ── Send push to all admin browsers (FIXED PATH & STRUCTURE) ───────
      try {
        // Get admin token from collection "Admin", document "push"
        const pushDoc = await db.collection("Admin").doc("push").get();
        let tokens = [];

        if (pushDoc.exists) {
          const data = pushDoc.data();
          // Support both single token (string) or array of tokens
          if (data.token && typeof data.token === "string") {
            tokens = [data.token];
          } else if (data.tokens && Array.isArray(data.tokens)) {
            tokens = data.tokens;
          }
        }

        if (tokens.length > 0) {
          const pushResults = await Promise.allSettled(
            tokens.map((token) =>
              getMessaging().send({
                token,
                notification: {
                  title: `🚗 New driver: ${fullName}`,
                  body:  `${email || "N/A"} · ${uploadedCount}/${docRows.length} docs uploaded`,
                },
                data: {
                  screen: "approvals",
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

          // Clean up stale tokens
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
            const currentDoc = await db.collection("Admin").doc("push").get();
            const currentData = currentDoc.data() || {};
            if (currentData.token && typeof currentData.token === "string") {
              // Single token mode – delete the field entirely
              await db.collection("Admin").doc("push").update({
                token: admin.firestore.FieldValue.delete(),
              });
              console.log(`🧹 Removed stale single admin token`);
            } else if (currentData.tokens && Array.isArray(currentData.tokens)) {
              // Array mode – remove each stale token
              await db.collection("Admin").doc("push").update({
                tokens: admin.firestore.FieldValue.arrayRemove(...staleTokens),
              });
              console.log(`🧹 Removed ${staleTokens.length} stale admin token(s)`);
            }
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

      console.log(`✅ Admin fully notified for driver: ${email} (uid: ${uid})`);
      return null;

    } catch (error) {
      console.error("❌ Error in onDriverCreatedNotifyAdmin:", error);
      if (error.response) console.error(error.response.body);
      return null;
    }
  }
);