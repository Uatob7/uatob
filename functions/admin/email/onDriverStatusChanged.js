const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const sgMail = require("@sendgrid/mail");

const esc = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const ADMIN_EMAIL = "support@uatob.com";

exports.onDriverStatusChanged = onDocumentUpdated(
  {
    document: "Drivers/{uid}",
    region:   "us-central1",
    secrets:  ["SENDGRID_API_KEY"],
  },
  async (event) => {
    try {
      const before = event.data.before.data();
      const after  = event.data.after.data();

      // Only fire when status actually changes between online/offline
      const prevStatus = before?.status;
      const newStatus  = after?.status;

      if (prevStatus === newStatus) return null;
      if (!["online", "offline"].includes(newStatus)) return null;

      const sendgridKey = process.env.SENDGRID_API_KEY;
      if (!sendgridKey) {
        console.error("Missing SENDGRID_API_KEY");
        return null;
      }

      sgMail.setApiKey(sendgridKey);

      const uid        = event.params.uid;
      const isOnline   = newStatus === "online";

      const fullName   = esc(`${after.firstName || ""} ${after.lastName || ""}`.trim() || "N/A");
      const safeEmail  = esc(after.email  || "N/A");
      const safePhone  = esc(after.phone  || "N/A");
      const safeUid    = esc(uid          || "N/A");
      const safeCity   = esc(after.city   || "N/A");
      const safeZip    = esc(after.zip    || "N/A");

      const hasLocation = typeof after.lat === "number" && typeof after.lng === "number";
      const safeLat     = hasLocation ? after.lat.toFixed(6) : "N/A";
      const safeLng     = hasLocation ? after.lng.toFixed(6) : "N/A";
      const mapsUrl     = hasLocation
        ? `https://www.google.com/maps?q=${after.lat},${after.lng}`
        : null;

      const changedAt = after.lastSeenAt?.toDate?.()
        ? after.lastSeenAt.toDate().toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : new Date().toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          });

      const year = new Date().getFullYear();

      // ── Color tokens based on status ────────────────────────────────────
      const accent      = isOnline ? "#16A34A" : "#6B7280";
      const accentLight = isOnline ? "#f0fdf4" : "#f3f4f6";
      const accentBorder= isOnline ? "#86efac" : "#d1d5db";
      const accentText  = isOnline ? "#15803D" : "#374151";
      const statusEmoji = isOnline ? "🟢" : "⚫";
      const statusLabel = isOnline ? "ONLINE" : "OFFLINE";
      const heroGradient = isOnline
        ? "linear-gradient(135deg,#15803D 0%,#16A34A 55%,#22C55E 100%)"
        : "linear-gradient(135deg,#374151 0%,#4B5563 55%,#6B7280 100%)";

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Driver Status Change — UaTob Admin</title>
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
                style="background:${heroGradient};padding:48px 32px 40px;">
              <table cellpadding="0" cellspacing="0" role="presentation"
                     style="margin:0 auto 20px;">
                <tr>
                  <td align="center">
                    <div style="width:72px;height:72px;
                                background-color:rgba(255,255,255,0.15);
                                border-radius:50%;text-align:center;
                                line-height:72px;font-size:36px;">
                      ${statusEmoji}
                    </div>
                  </td>
                </tr>
              </table>
              <h1 class="hero-title"
                  style="margin:0 0 10px;font-size:28px;font-weight:900;
                         color:#ffffff;line-height:1.2;letter-spacing:-0.5px;
                         font-family:Arial,sans-serif;">
                Driver ${isOnline ? "Online" : "Offline"}
              </h1>
              <p style="margin:0;font-size:14px;color:#ffffff;font-weight:500;
                        font-family:Arial,sans-serif;opacity:0.85;line-height:1.5;">
                ${fullName} is now ${statusLabel}
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
                    <div style="display:inline-block;background-color:${accentLight};
                                border:2px solid ${accentBorder};border-radius:100px;
                                padding:9px 22px;font-size:12px;font-weight:700;
                                color:${accentText};font-family:Arial,sans-serif;
                                letter-spacing:0.5px;">
                      🕐 &nbsp;${changedAt.toUpperCase()}
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

              <!-- ── STATUS CHANGE ── -->
              <div style="background-color:${accentLight};border:2px solid ${accentBorder};
                          border-radius:16px;padding:24px;margin-bottom:24px;text-align:center;">
                <div style="font-size:13px;color:#6B7280;font-family:Arial,sans-serif;
                            margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">
                  Status Change
                </div>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td align="center" width="40%">
                      <span style="display:inline-block;padding:8px 20px;border-radius:100px;
                                   font-size:13px;font-weight:700;font-family:Arial,sans-serif;
                                   background-color:#e5e7eb;color:#374151;text-transform:uppercase;">
                        ${esc(prevStatus || "unknown")}
                      </span>
                    </td>
                    <td align="center" width="20%">
                      <span style="font-size:20px;">→</span>
                    </td>
                    <td align="center" width="40%">
                      <span style="display:inline-block;padding:8px 20px;border-radius:100px;
                                   font-size:13px;font-weight:700;font-family:Arial,sans-serif;
                                   background-color:${accent};color:#ffffff;text-transform:uppercase;">
                        ${esc(newStatus)}
                      </span>
                    </td>
                  </tr>
                </table>
              </div>

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
                    ["City / Zip", `${safeCity}, ${safeZip}`],
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

              <!-- ── LOCATION ── -->
              <div style="background-color:#eff6ff;border:2px solid #93c5fd;
                          border-radius:16px;padding:24px;margin-bottom:24px;">
                <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  📍 Last Known Location
                </h2>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  ${[
                    ["Latitude",  safeLat],
                    ["Longitude", safeLng],
                  ].map(([label, val], i, arr) => `
                  <tr>
                    <td style="padding:10px 0;
                               ${i < arr.length - 1 ? "border-bottom:1px solid #bfdbfe;" : ""}
                               font-size:13px;color:#6B7280;
                               font-family:Arial,sans-serif;width:40%;">
                      ${label}
                    </td>
                    <td style="padding:10px 0;
                               ${i < arr.length - 1 ? "border-bottom:1px solid #bfdbfe;" : ""}
                               font-size:13px;color:#111827;font-weight:700;
                               font-family:Arial,sans-serif;text-align:right;
                               font-family:monospace;">
                      ${val}
                    </td>
                  </tr>`).join("")}
                </table>

                ${mapsUrl ? `
                <div style="margin-top:16px;text-align:center;">
                  <a href="${mapsUrl}"
                     style="display:inline-block;background-color:#1D4ED8;
                            color:#ffffff;font-size:13px;font-weight:700;
                            text-decoration:none;padding:11px 24px;
                            border-radius:10px;font-family:Arial,sans-serif;">
                    Open in Google Maps →
                  </a>
                </div>` : `
                <p style="margin:12px 0 0;font-size:12px;color:#9CA3AF;
                           font-family:Arial,sans-serif;">
                  No location data available.
                </p>`}
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
                      <a href="https://console.firebase.google.com/project/uatob/firestore/data/Drivers/${uid}"
                         style="display:inline-block;background-color:#16A34A;
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
        subject: `${statusEmoji} ${fullName} is now ${statusLabel} — UaTob`,
        text:
          `Driver status change on UaTob.\n\n` +
          `Name:     ${fullName}\n` +
          `Email:    ${after.email  || "N/A"}\n` +
          `Phone:    ${after.phone  || "N/A"}\n` +
          `UID:      ${uid}\n` +
          `Status:   ${prevStatus || "unknown"} → ${newStatus}\n` +
          `Location: ${hasLocation ? `${after.lat}, ${after.lng}` : "N/A"}\n` +
          `City:     ${after.city || "N/A"}\n` +
          `Time:     ${changedAt}\n` +
          (mapsUrl ? `Maps:     ${mapsUrl}\n` : ""),
        html,
      };

      await sgMail.send(msg);

      console.log(`📧 Admin notified: ${fullName} (${uid}) is now ${newStatus} ✅`);
      return null;

    } catch (error) {
      console.error("❌ Error sending driver status notification:", error);
      if (error.response) console.error(error.response.body);
      return null;
    }
  }
);