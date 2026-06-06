const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const esc = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// ─────────────────────────────────────────────────────────────
// Brand SVGs — email-safe, inlined
// ─────────────────────────────────────────────────────────────
const UATOB_ICON_SVG = `
<svg width="46" height="46" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="eribg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F3F4F6"/>
    </linearGradient>
    <linearGradient id="eriroad" x1="0" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#16A34A"/>
    </linearGradient>
    <linearGradient id="ericar" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#16A34A"/>
      <stop offset="100%" stop-color="#15803D"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#eribg)"/>
  <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" stroke="#E5E7EB" stroke-width="1"/>
  <path d="M 10 42 Q 32 24 54 42"
        stroke="url(#eriroad)" stroke-width="2.5" stroke-dasharray="5 4"
        stroke-linecap="round" fill="none" opacity="0.6"/>
  <circle cx="10" cy="42" r="6" fill="#111827" opacity="0.12"/>
  <circle cx="10" cy="42" r="3.5" fill="#111827"/>
  <text x="10" y="45.5" text-anchor="middle" font-family="Arial,sans-serif"
        font-weight="800" font-size="4.5" fill="#fff">A</text>
  <circle cx="54" cy="42" r="6" fill="#16A34A" opacity="0.18"/>
  <circle cx="54" cy="42" r="3.5" fill="#16A34A"/>
  <text x="54" y="45.5" text-anchor="middle" font-family="Arial,sans-serif"
        font-weight="800" font-size="4.5" fill="#fff">B</text>
  <g transform="translate(26,26)">
    <ellipse cx="6" cy="12" rx="8" ry="2" fill="#111827" opacity="0.1"/>
    <rect x="1" y="5" width="10" height="6" rx="1.5" fill="url(#ericar)"/>
    <path d="M3 5 L3.8 2 L8.2 2 L9 5Z" fill="#15803D"/>
    <rect x="3.5" y="2.5" width="2.3" height="2" rx="0.5" fill="#fff" fill-opacity="0.85"/>
    <rect x="6.2" y="2.5" width="2.3" height="2" rx="0.5" fill="#fff" fill-opacity="0.85"/>
    <circle cx="3" cy="11" r="1.8" fill="#111827"/>
    <circle cx="3" cy="11" r="0.9" fill="#16A34A"/>
    <circle cx="9" cy="11" r="1.8" fill="#111827"/>
    <circle cx="9" cy="11" r="0.9" fill="#22C55E"/>
    <rect x="10.5" y="6.5" width="1.5" height="1" rx="0.5" fill="#FCD34D"/>
  </g>
</svg>`.trim();

const ARROW_SVG = `
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
     style="display:inline-block;vertical-align:middle;margin:0 3px;">
  <path d="M5 12h14M13 6l6 6-6 6"
        stroke="#16A34A" stroke-width="2.2"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>`.trim();

// ─────────────────────────────────────────────────────────────
// Email builder
// ─────────────────────────────────────────────────────────────
function buildApprovalReportEmail(approvedDrivers) {
  const count = approvedDrivers.length;
  const year  = new Date().getFullYear();
  const now   = new Date().toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
    timeZone: "America/New_York", timeZoneName: "short",
  });

  const driverRows = approvedDrivers.map((d, i) => {
    const name  = esc(d.firstName && d.lastName ? `${d.firstName} ${d.lastName}` : d.name || "Unknown");
    const email = esc(d.email || "—");
    const uid   = esc(d.uid);
    const phone = esc(d.phone || d.contact?.phone || "—");

    return `
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                   style="margin-bottom:${i < approvedDrivers.length - 1 ? "8px" : "0"};">
              <tr>
                <td style="background-color:#0d0d0d;border:1px solid #1f1f1f;
                           border-radius:10px;padding:14px 18px;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td valign="middle" style="padding-right:14px;">
                        <div style="width:36px;height:36px;border-radius:50%;
                                    background-color:#052e16;border:1.5px solid #166534;
                                    text-align:center;line-height:36px;
                                    font-family:'Courier New',monospace;font-size:13px;
                                    font-weight:900;color:#4ADE80;">
                          ${esc((d.firstName || d.name || "?")[0].toUpperCase())}
                        </div>
                      </td>
                      <td valign="middle">
                        <p style="margin:0 0 3px;font-family:Georgia,serif;font-size:15px;
                                   font-weight:700;color:#ffffff;line-height:1.2;">
                          ${name}
                        </p>
                        <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;
                                   color:#6B7280;letter-spacing:0.3px;">
                          ${email}
                          ${phone !== "—" ? `&nbsp;&#183;&nbsp; ${phone}` : ""}
                        </p>
                      </td>
                      <td valign="middle" align="right" style="white-space:nowrap;">
                        <span style="display:inline-block;background-color:rgba(74,222,128,0.12);
                                     border:1px solid #166534;border-radius:6px;
                                     padding:3px 9px;font-family:'Courier New',monospace;
                                     font-size:9px;font-weight:700;color:#4ADE80;
                                     letter-spacing:1px;">
                          APPROVED
                        </span>
                        <p style="margin:5px 0 0;font-family:'Courier New',monospace;
                                   font-size:9px;color:#374151;letter-spacing:0.3px;
                                   text-align:right;">
                          ${uid.slice(0, 8)}&hellip;
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>`;
  }).join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Driver Auto-Approval Report — UaTob</title>
  <style type="text/css">
    body, html {
      -webkit-text-size-adjust: 100% !important;
      -ms-text-size-adjust: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background-color: #0a0a0a !important;
    }
    @media only screen and (max-width: 600px) {
      .hero-title { font-size: 26px !important; }
      .count-num  { font-size: 52px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;">

<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#0a0a0a;">
  ${count} driver${count !== 1 ? "s" : ""} auto-approved · ${now}
</div>

<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="background-color:#0a0a0a;padding:40px 20px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:600px;width:100%;">

        <!-- ══ WORDMARK HEADER ══ -->
        <tr>
          <td align="center" style="padding-bottom:28px;">
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td valign="middle" style="padding-right:10px;">
                  ${UATOB_ICON_SVG}
                </td>
                <td valign="middle">
                  <span style="font-family:Georgia,serif;font-style:italic;font-weight:300;font-size:28px;
                               color:#ffffff;letter-spacing:-0.5px;line-height:1;">Ua</span><!--
               -->${ARROW_SVG}<!--
               --><span style="font-family:Arial,sans-serif;font-weight:800;font-size:28px;
                               color:#4ADE80;letter-spacing:-0.5px;line-height:1;">Tob</span>
                </td>
                <td valign="middle" style="padding-left:10px;">
                  <span style="font-family:'Courier New',monospace;font-size:9px;
                               font-weight:700;color:#4ADE80;background-color:#052e16;
                               padding:4px 9px;border-radius:100px;letter-spacing:1.5px;
                               border:1px solid #166534;display:inline-block;">
                    ADMIN
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ══ MAIN CARD ══ -->
        <tr>
          <td style="background-color:#111111;border-radius:20px;
                     border:1px solid #1f1f1f;overflow:hidden;">

            <!-- ── HERO BAND ── -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background:linear-gradient(135deg,#052e16 0%,#14532d 50%,#166534 100%);
                           padding:40px 36px 32px;">
                  <div style="display:inline-block;background-color:rgba(74,222,128,0.15);
                              border:1.5px solid #4ADE80;border-radius:100px;
                              padding:5px 14px;margin-bottom:20px;">
                    <span style="font-family:'Courier New',monospace;font-size:10px;
                                 font-weight:700;color:#86EFAC;letter-spacing:2px;">
                      &#9679;&nbsp; AUTO-APPROVAL RUN
                    </span>
                  </div>
                  <h1 class="hero-title"
                      style="margin:0 0 8px;font-family:Georgia,serif;font-size:34px;
                             font-weight:700;color:#ffffff;line-height:1.15;letter-spacing:-1px;">
                    Driver Approval<br/>
                    <span style="color:#4ADE80;">Report</span>
                  </h1>
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:13px;
                             color:#86efac;letter-spacing:0.3px;">
                    ${esc(now)}
                  </p>
                </td>
              </tr>
            </table>

            <!-- ── COUNT STAT ── -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="center"
                    style="padding:32px 36px 24px;border-bottom:1px solid #1f1f1f;">
                  <p style="margin:0 0 6px;font-family:'Courier New',monospace;
                             font-size:11px;font-weight:700;color:#4ADE80;letter-spacing:2.5px;">
                    DRIVERS APPROVED
                  </p>
                  <p class="count-num"
                     style="margin:0;font-family:Georgia,serif;font-size:64px;
                            font-weight:700;color:#ffffff;line-height:1;letter-spacing:-3px;">
                    ${count}
                  </p>
                  <p style="margin:8px 0 0;font-family:'Courier New',monospace;
                             font-size:12px;color:#6B7280;letter-spacing:0.5px;">
                    Status set to &nbsp;<span style="color:#4ADE80;">approved</span>&nbsp; in Firestore
                  </p>
                </td>
              </tr>
            </table>

            <!-- ── DRIVER LIST ── -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:24px 36px 28px;border-top:1px solid #1f1f1f;">
                  <p style="margin:0 0 16px;font-family:'Courier New',monospace;
                             font-size:11px;font-weight:700;color:#4ADE80;letter-spacing:2px;">
                    APPROVED DRIVERS
                  </p>
                  ${driverRows}
                </td>
              </tr>
            </table>

            <!-- ── CTA ── -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:8px 36px 36px;border-top:1px solid #1f1f1f;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                         style="margin-top:24px;">
                    <tr>
                      <td align="center">
                        <a href="https://uatob.com/admin"
                           style="display:block;background-color:#16A34A;
                                  color:#ffffff;font-family:'Courier New',monospace;
                                  font-size:15px;font-weight:700;text-decoration:none;
                                  padding:20px 32px;border-radius:12px;
                                  letter-spacing:1px;text-align:center;
                                  border:1px solid #4ADE80;">
                          VIEW IN ADMIN DASHBOARD &#8594;
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- ── TIMESTAMP STRIP ── -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:16px 36px;background-color:#0d0d0d;
                           border-top:1px solid #1f1f1f;">
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;
                             color:#374151;letter-spacing:0.5px;">
                    RUN AT &nbsp;<span style="color:#4ADE80;">${esc(now)}</span>
                  </p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- ══ FOOTER ══ -->
        <tr>
          <td align="center" style="padding:28px 20px 0;">
            <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:11px;
                       color:#374151;letter-spacing:0.5px;">
              &#169; ${year} UaTob &nbsp;&#183;&nbsp; Orlando, FL
            </p>
            <p style="margin:0;font-family:'Courier New',monospace;font-size:10px;
                       color:#1f2937;letter-spacing:0.3px;">
              Automated report &mdash; sent by UaTob Admin System
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`.trim();

  const textRows = approvedDrivers.map((d) => {
    const name  = d.firstName && d.lastName ? `${d.firstName} ${d.lastName}` : d.name || "Unknown";
    const phone = d.phone || d.contact?.phone || "—";
    return `  • ${name} · ${d.email || "—"} · ${phone} · UID: ${d.uid}`;
  }).join("\n");

  const text =
    `UaTob Driver Auto-Approval Report\n` +
    `Run at: ${now}\n\n` +
    `${count} driver${count !== 1 ? "s" : ""} approved:\n\n` +
    `${textRows}\n\n` +
    `View in admin: https://uatob.com/admin`;

  return {
    to:      "support@uatob.com",
    from:    "UaTob Admin <noreply@uatob.com>",
    subject: `✅ ${count} Driver${count !== 1 ? "s" : ""} Auto-Approved · ${now}`,
    text,
    html,
  };
}

// ─────────────────────────────────────────────────────────────
// Scheduled Cloud Function
// ─────────────────────────────────────────────────────────────
exports.autoApprovePendingDrivers = onSchedule(
  {
    schedule: "every 7 minutes",
    region:   "us-central1",
    secrets:  [SENDGRID_API_KEY],
  },
  async () => {
    sgMail.setApiKey(SENDGRID_API_KEY.value());

    // ── PASS 1: approve any drivers still in pending status ───────────────
    // Sets adminApprovalEmailSent: false so pass 2 picks them up immediately.
    const pendingSnap = await db
      .collection("Drivers")
      .where("status", "==", "pending")
      .get();

    if (!pendingSnap.empty) {
      const approveBatch = db.batch();
      pendingSnap.forEach((doc) => {
        approveBatch.update(doc.ref, {
          status:                 "approved",
          approvedAt:             admin.firestore.FieldValue.serverTimestamp(),
          updatedAt:              admin.firestore.FieldValue.serverTimestamp(),
          adminApprovalEmailSent: false, // ensures pass 2 picks them up
        });
      });
      await approveBatch.commit();
      console.log(`[autoApprove] Pass 1: approved ${pendingSnap.size} pending driver(s).`);
    }

    // ── PASS 2: email all approved drivers missing the email flag ─────────
    // Catches: pass 1 approvals, manual console approvals, and prior email failures.
    const unemailedSnap = await db
      .collection("Drivers")
      .where("status",                 "==", "approved")
      .where("adminApprovalEmailSent", "==", false)
      .get();

    if (unemailedSnap.empty) {
      console.log("[autoApprove] No approved drivers awaiting email.");
      return;
    }

    const approvedDrivers = unemailedSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        uid:       doc.id,
        firstName: data.firstName,
        lastName:  data.lastName,
        name:      data.name,
        email:     data.email,
        phone:     data.phone || data.contact?.phone,
      };
    });

    let adminEmailSent  = false;
    let adminEmailError = null;

    try {
      const msg = buildApprovalReportEmail(approvedDrivers);
      await sgMail.send(msg);
      adminEmailSent = true;
      console.log(`[autoApprove] Admin report email sent for ${approvedDrivers.length} driver(s).`);
    } catch (emailErr) {
      adminEmailError = emailErr?.message || String(emailErr);
      console.error("[autoApprove] Admin report email FAILED:", adminEmailError);
    }

    // Stamp each driver with the result.
    // If email failed → stays false → will retry next minute.
    // If email succeeded → true → won't be picked up again.
    const flagBatch = db.batch();
    unemailedSnap.forEach((doc) => {
      flagBatch.update(doc.ref, {
        adminApprovalEmailSent: adminEmailSent,
      });
    });
    await flagBatch.commit();

    // Audit log
    await db.collection("Admin").doc("autoApproveLog").collection("runs").add({
      runAt:           admin.firestore.FieldValue.serverTimestamp(),
      approvedCount:   approvedDrivers.length,
      approvedUids:    approvedDrivers.map((d) => d.uid),
      adminEmailSent,
      adminEmailError: adminEmailError ?? null,
    });

    console.log(`[autoApprove] Done · drivers=${approvedDrivers.length} · adminEmailSent=${adminEmailSent}`);
  }
);