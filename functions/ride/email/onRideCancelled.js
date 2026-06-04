const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { getFirestore }      = require("firebase-admin/firestore");
const sgMail                = require("@sendgrid/mail");

const db = getFirestore();
const esc = (s) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

// ─────────────────────────────────────────────────────────────
// Brand SVGs — matches dispatch email exactly
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
function buildCancelledEmail({ name, ride }) {
  const userName = esc(name || "there");
  const year     = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Ride Cancelled — UaTob</title>
  <style type="text/css">
    body, html {
      -webkit-text-size-adjust: 100% !important;
      -ms-text-size-adjust: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background-color: #0a0a0a !important;
    }
    @media only screen and (max-width: 600px) {
      .hero-title { font-size: 28px !important; }
      .cta-btn    { font-size: 14px !important; padding: 16px 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;">

<!-- Preheader -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#0a0a0a;">
  Your ride was cancelled — book a new ride anytime at uatob.com.
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
                               font-weight:700;color:#F87171;background-color:#450a0a;
                               padding:4px 9px;border-radius:100px;letter-spacing:1.5px;
                               border:1px solid #991b1b;display:inline-block;">
                    CANCELLED
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
                <td style="background:linear-gradient(135deg,#450a0a 0%,#7f1d1d 50%,#991b1b 100%);
                           padding:40px 36px 32px;">
                  <div style="display:inline-block;background-color:rgba(248,113,113,0.15);
                              border:1.5px solid #F87171;border-radius:100px;
                              padding:5px 14px;margin-bottom:20px;">
                    <span style="font-family:'Courier New',monospace;font-size:10px;
                                 font-weight:700;color:#F87171;letter-spacing:2px;">
                      &#9679;&nbsp; RIDE CANCELLED
                    </span>
                  </div>
                  <h1 class="hero-title"
                      style="margin:0 0 8px;font-family:Georgia,serif;font-size:36px;
                             font-weight:700;color:#ffffff;line-height:1.15;letter-spacing:-1px;">
                    Your ride was<br/>
                    <span style="color:#F87171;">cancelled.</span>
                  </h1>
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:13px;
                             color:#fca5a5;letter-spacing:0.3px;">
                    Hey ${userName} &mdash; you can book a new ride anytime.
                  </p>
                </td>
              </tr>
            </table>

            <!-- ── TRIP DETAILS ── -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:28px 36px;border-bottom:1px solid #1f1f1f;">
                  <p style="margin:0 0 16px;font-family:'Courier New',monospace;
                             font-size:11px;font-weight:700;color:#F87171;letter-spacing:2px;">
                    CANCELLED TRIP
                  </p>

                  <!-- Pickup -->
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                         style="margin-bottom:8px;">
                    <tr>
                      <td width="32" valign="top" style="padding-top:3px;">
                        <div style="width:24px;height:24px;border-radius:50%;
                                    background-color:#4ADE80;text-align:center;
                                    line-height:24px;font-size:11px;font-weight:900;
                                    color:#052e16;font-family:'Courier New',monospace;">A</div>
                      </td>
                      <td valign="top">
                        <p style="margin:0 0 2px;font-family:'Courier New',monospace;
                                   font-size:10px;font-weight:700;color:#6B7280;
                                   letter-spacing:1.5px;">PICKUP</p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:15px;
                                   font-weight:700;color:#ffffff;line-height:1.4;">
                          ${esc(ride.pickup ?? "—")}
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Connector -->
                  <table cellpadding="0" cellspacing="0" role="presentation"
                         style="margin:0 0 8px 12px;">
                    <tr>
                      <td style="border-left:2px dashed #374151;height:18px;width:1px;"></td>
                    </tr>
                  </table>

                  <!-- Dropoff -->
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                         style="margin-bottom:${ride.cancellationReason ? "20px" : "0"};">
                    <tr>
                      <td width="32" valign="top" style="padding-top:3px;">
                        <div style="width:24px;height:24px;border-radius:50%;
                                    background-color:#1f1f1f;border:2px solid #F87171;
                                    text-align:center;line-height:20px;font-size:11px;
                                    font-weight:900;color:#F87171;
                                    font-family:'Courier New',monospace;">B</div>
                      </td>
                      <td valign="top">
                        <p style="margin:0 0 2px;font-family:'Courier New',monospace;
                                   font-size:10px;font-weight:700;color:#6B7280;
                                   letter-spacing:1.5px;">DROPOFF</p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:15px;
                                   font-weight:700;color:#ffffff;line-height:1.4;">
                          ${esc(ride.dropoff ?? "—")}
                        </p>
                      </td>
                    </tr>
                  </table>

                  ${ride.cancellationReason ? `
                  <!-- Reason -->
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                         style="margin-top:4px;">
                    <tr>
                      <td style="padding:12px 16px;background-color:#0d0d0d;
                                 border:1px solid #1f1f1f;border-radius:10px;">
                        <p style="margin:0 0 4px;font-family:'Courier New',monospace;
                                   font-size:10px;font-weight:700;color:#6B7280;
                                   letter-spacing:1.5px;">REASON</p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:14px;
                                   color:#fca5a5;line-height:1.5;">
                          ${esc(ride.cancellationReason)}
                        </p>
                      </td>
                    </tr>
                  </table>` : ""}
                </td>
              </tr>
            </table>

            <!-- ── CANDIDATE NOTE ── -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="center"
                    style="padding:14px 36px;background-color:#0d0d0d;
                           border-top:1px solid #1f1f1f;">
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;
                             color:#6B7280;letter-spacing:0.5px;">
                    If you were charged, we&apos;ll make it right &nbsp;&#183;&nbsp;
                    <a href="https://uatob.com/help"
                       style="color:#4ADE80;text-decoration:none;">uatob.com/help</a>
                  </p>
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
                        <a href="https://uatob.com"
                           class="cta-btn"
                           style="display:block;background-color:#16A34A;
                                  color:#ffffff;font-family:'Courier New',monospace;
                                  font-size:15px;font-weight:700;text-decoration:none;
                                  padding:20px 32px;border-radius:12px;
                                  letter-spacing:1px;text-align:center;
                                  border:1px solid #4ADE80;">
                          BOOK A NEW RIDE &#8594;
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:16px 0 0;font-family:'Courier New',monospace;
                             font-size:11px;color:#374151;text-align:center;
                             letter-spacing:0.5px;">
                    No surge pricing &nbsp;&#183;&nbsp; Flat distance fares &nbsp;&#183;&nbsp; Always
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
            <p style="margin:0 0 10px;font-family:'Courier New',monospace;font-size:10px;
                       color:#1f2937;letter-spacing:0.3px;">
              You&apos;re receiving this because you have a UaTob rider account.
            </p>
            <p style="margin:0;">
              <a href="https://uatob.com/privacy"
                 style="color:#374151;text-decoration:none;font-size:10px;
                        margin:0 8px;font-family:'Courier New',monospace;">Privacy</a>
              <a href="https://uatob.com/terms"
                 style="color:#374151;text-decoration:none;font-size:10px;
                        margin:0 8px;font-family:'Courier New',monospace;">Terms</a>
              <a href="https://uatob.com/unsubscribe"
                 style="color:#374151;text-decoration:none;font-size:10px;
                        margin:0 8px;font-family:'Courier New',monospace;">Unsubscribe</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`.trim();

  const text =
    `Hey ${name || "there"} — your UaTob ride was cancelled.\n\n` +
    `Pickup:  ${ride.pickup ?? "—"}\n` +
    `Dropoff: ${ride.dropoff ?? "—"}\n` +
    (ride.cancellationReason ? `Reason:  ${ride.cancellationReason}\n` : "") +
    `\nBook a new ride anytime at https://uatob.com\n\n` +
    `If you were charged, visit https://uatob.com/help\n\n` +
    `© ${year} UaTob · Orlando, FL`;

  return {
    to:      null, // set by caller
    from:    "UaTob <noreply@uatob.com>",
    replyTo: "support@uatob.com",
    subject: `Your UaTob ride was cancelled`,
    text,
    html,
  };
}

// ─────────────────────────────────────────────────────────────
// Cloud Function
// ─────────────────────────────────────────────────────────────
exports.onRideCancelled = onDocumentUpdated(
  { document: "Rides/{rideId}", region: "us-east1", secrets: ["SENDGRID_API_KEY"] },
  async (event) => {
    try {
      const before = event.data.before.data();
      const after  = event.data.after.data();

      if (before.status === after.status)   return null;
      if (after.status !== "cancelled")     return null;
      if (after.emailSent_cancelled)        return null;
      if (!after.uid)                       return null;

      const accountSnap = await db.collection("Accounts").doc(after.uid).get();
      if (!accountSnap.exists) return null;
      const { email, name = "there" } = accountSnap.data();
      if (!email) return null;

      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      const msg = buildCancelledEmail({ name, ride: after });
      msg.to = email;

      await sgMail.send(msg);
      await event.data.after.ref.update({ emailSent_cancelled: true });

      console.log(`[onRideCancelled] Email sent to ${email} ✅`);
    } catch (err) {
      console.error("[onRideCancelled]", err.message);
    }
    return null;
  }
);
