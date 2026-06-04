const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const sgMail = require("@sendgrid/mail");

const esc = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

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
function buildWelcomeEmail({ name, email }) {
  const userName  = esc(name || "there");
  const safeEmail = esc(email);
  const year      = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Welcome to UaTob</title>
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
  Your UaTob account is ready — request your first ride now. No surge pricing. Ever.
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
                    WELCOME
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
                                 font-weight:700;color:#4ADE80;letter-spacing:2px;">
                      &#9679;&nbsp; ACCOUNT ACTIVATED
                    </span>
                  </div>
                  <h1 class="hero-title"
                      style="margin:0 0 8px;font-family:Georgia,serif;font-size:36px;
                             font-weight:700;color:#ffffff;line-height:1.15;letter-spacing:-1px;">
                    Welcome to<br/>
                    <span style="color:#4ADE80;">UaTob, ${userName}.</span>
                  </h1>
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:13px;
                             color:#86efac;letter-spacing:0.3px;">
                    Orlando's rideshare — no surge pricing, ever.
                  </p>
                </td>
              </tr>
            </table>

            <!-- ── ACCOUNT SUMMARY ── -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:28px 36px;border-bottom:1px solid #1f1f1f;">
                  <p style="margin:0 0 14px;font-family:'Courier New',monospace;
                             font-size:11px;font-weight:700;color:#4ADE80;letter-spacing:2px;">
                    YOUR ACCOUNT
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="padding:10px 0;border-bottom:1px solid #1f1f1f;">
                        <span style="font-family:'Courier New',monospace;font-size:11px;
                                     color:#6B7280;letter-spacing:1px;">NAME</span>
                      </td>
                      <td align="right" style="padding:10px 0;border-bottom:1px solid #1f1f1f;">
                        <span style="font-family:Georgia,serif;font-size:15px;
                                     font-weight:700;color:#ffffff;">${userName}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:10px 0;">
                        <span style="font-family:'Courier New',monospace;font-size:11px;
                                     color:#6B7280;letter-spacing:1px;">EMAIL</span>
                      </td>
                      <td align="right" style="padding:10px 0;">
                        <span style="font-family:Georgia,serif;font-size:15px;
                                     font-weight:700;color:#ffffff;">${safeEmail}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- ── HOW IT WORKS ── -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:28px 36px;border-bottom:1px solid #1f1f1f;">
                  <p style="margin:0 0 20px;font-family:'Courier New',monospace;
                             font-size:11px;font-weight:700;color:#4ADE80;letter-spacing:2px;">
                    HOW IT WORKS
                  </p>

                  <!-- Step 1 -->
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                         style="margin-bottom:18px;">
                    <tr>
                      <td width="36" valign="top" style="padding-top:2px;">
                        <div style="width:26px;height:26px;background-color:#052e16;
                                    border:1.5px solid #4ADE80;border-radius:50%;
                                    text-align:center;line-height:23px;
                                    font-family:'Courier New',monospace;font-size:12px;
                                    font-weight:700;color:#4ADE80;">1</div>
                      </td>
                      <td valign="top" style="padding-left:12px;">
                        <p style="margin:0 0 3px;font-family:Georgia,serif;font-size:15px;
                                   font-weight:700;color:#ffffff;">Open uatob.com</p>
                        <p style="margin:0;font-family:'Courier New',monospace;font-size:12px;
                                   color:#6B7280;letter-spacing:0.3px;line-height:1.6;">
                          No app download needed. Open in your phone's browser.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Step 2 -->
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                         style="margin-bottom:18px;">
                    <tr>
                      <td width="36" valign="top" style="padding-top:2px;">
                        <div style="width:26px;height:26px;background-color:#052e16;
                                    border:1.5px solid #4ADE80;border-radius:50%;
                                    text-align:center;line-height:23px;
                                    font-family:'Courier New',monospace;font-size:12px;
                                    font-weight:700;color:#4ADE80;">2</div>
                      </td>
                      <td valign="top" style="padding-left:12px;">
                        <p style="margin:0 0 3px;font-family:Georgia,serif;font-size:15px;
                                   font-weight:700;color:#ffffff;">Enter Your Destination</p>
                        <p style="margin:0;font-family:'Courier New',monospace;font-size:12px;
                                   color:#6B7280;letter-spacing:0.3px;line-height:1.6;">
                          See your flat fare upfront. No surge. No surprises.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Step 3 -->
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td width="36" valign="top" style="padding-top:2px;">
                        <div style="width:26px;height:26px;background-color:#052e16;
                                    border:1.5px solid #22C55E;border-radius:50%;
                                    text-align:center;line-height:23px;
                                    font-family:'Courier New',monospace;font-size:12px;
                                    font-weight:700;color:#22C55E;">3</div>
                      </td>
                      <td valign="top" style="padding-left:12px;">
                        <p style="margin:0 0 3px;font-family:Georgia,serif;font-size:15px;
                                   font-weight:700;color:#ffffff;">Get Your Ride</p>
                        <p style="margin:0;font-family:'Courier New',monospace;font-size:12px;
                                   color:#6B7280;letter-spacing:0.3px;line-height:1.6;">
                          A vetted local driver picks you up. Pay by card, Cash App, or cash.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- ── WHY UATOB ── -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:28px 36px;border-bottom:1px solid #1f1f1f;">
                  <p style="margin:0 0 20px;font-family:'Courier New',monospace;
                             font-size:11px;font-weight:700;color:#4ADE80;letter-spacing:2px;">
                    WHY UATOB
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td width="33%" align="center" valign="top"
                          style="padding:16px 8px;background-color:#0d0d0d;
                                 border-radius:12px;border:1px solid #1f1f1f;">
                        <p style="margin:0 0 6px;font-size:24px;">📍</p>
                        <p style="margin:0 0 4px;font-family:'Courier New',monospace;
                                   font-size:10px;font-weight:700;color:#4ADE80;
                                   letter-spacing:1.5px;">LOCAL</p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:12px;
                                   color:#9CA3AF;line-height:1.5;">
                          Built for Orlando
                        </p>
                      </td>
                      <td width="2%"></td>
                      <td width="33%" align="center" valign="top"
                          style="padding:16px 8px;background-color:#0d0d0d;
                                 border-radius:12px;border:1px solid #1f1f1f;">
                        <p style="margin:0 0 6px;font-size:24px;">💸</p>
                        <p style="margin:0 0 4px;font-family:'Courier New',monospace;
                                   font-size:10px;font-weight:700;color:#4ADE80;
                                   letter-spacing:1.5px;">NO SURGE</p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:12px;
                                   color:#9CA3AF;line-height:1.5;">
                          Flat distance fares
                        </p>
                      </td>
                      <td width="2%"></td>
                      <td width="33%" align="center" valign="top"
                          style="padding:16px 8px;background-color:#0d0d0d;
                                 border-radius:12px;border:1px solid #1f1f1f;">
                        <p style="margin:0 0 6px;font-size:24px;">🛡️</p>
                        <p style="margin:0 0 4px;font-family:'Courier New',monospace;
                                   font-size:10px;font-weight:700;color:#4ADE80;
                                   letter-spacing:1.5px;">VETTED</p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:12px;
                                   color:#9CA3AF;line-height:1.5;">
                          Every driver reviewed
                        </p>
                      </td>
                    </tr>
                  </table>
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
                          REQUEST YOUR FIRST RIDE &#8594;
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:16px 0 0;font-family:'Courier New',monospace;
                             font-size:11px;color:#374151;text-align:center;
                             letter-spacing:0.5px;">
                    Pay by card &nbsp;&#183;&nbsp; Cash App &nbsp;&#183;&nbsp; Cash
                  </p>
                </td>
              </tr>
            </table>

            <!-- ── RIDE ID STRIP (account confirmation) ── -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:16px 36px;background-color:#0d0d0d;
                           border-top:1px solid #1f1f1f;">
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;
                             color:#374151;letter-spacing:0.5px;">
                    Questions? &nbsp;<a href="https://uatob.com/help"
                      style="color:#4ADE80;text-decoration:none;">uatob.com/help</a>
                    &nbsp;&#183;&nbsp; Reply to this email anytime.
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
              You&apos;re receiving this because you created a UaTob account.
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
    `Welcome to UaTob, ${name || "there"}!\n\n` +
    `Your account is ready.\n\n` +
    `Name:   ${name || "—"}\n` +
    `Email:  ${email}\n\n` +
    `HOW IT WORKS\n` +
    `1. Open uatob.com in your phone's browser — no app download needed.\n` +
    `2. Enter your destination and see your flat fare upfront. No surge. Ever.\n` +
    `3. A vetted local driver picks you up. Pay by card, Cash App, or cash.\n\n` +
    `Request your first ride: https://uatob.com\n\n` +
    `Questions? https://uatob.com/help\n\n` +
    `© ${year} UaTob · Orlando, FL`;

  return {
    to:      email,
    from:    "UaTob <noreply@uatob.com>",
    replyTo: "support@uatob.com",
    subject: `🚗 Welcome to UaTob, ${name || "there"} — your account is ready`,
    text,
    html,
  };
}

// ─────────────────────────────────────────────────────────────
// Cloud Function
// ─────────────────────────────────────────────────────────────
exports.onAccountCreated = onDocumentCreated(
  {
    document: "Accounts/{uid}",
    region:   "us-central1",
    secrets:  ["SENDGRID_API_KEY"],
  },
  async (event) => {
    try {
      const snap = event.data;
      if (!snap) return null;

      const accountData = snap.data();
      const { email, name } = accountData || {};

      if (!email) {
        console.log("[onAccountCreated] No email on account doc — skipping.");
        return null;
      }

      if (accountData.welcomeEmailSent) {
        console.log("[onAccountCreated] Welcome email already sent — skipping.");
        return null;
      }

      const sendgridKey = process.env.SENDGRID_API_KEY;
      if (!sendgridKey) {
        console.error("[onAccountCreated] Missing SENDGRID_API_KEY");
        return null;
      }

      sgMail.setApiKey(sendgridKey);

      const msg = buildWelcomeEmail({ name, email });
      await sgMail.send(msg);

      await snap.ref.update({ welcomeEmailSent: true });

      console.log(`[onAccountCreated] Welcome email sent to ${email} ✅`);
      return null;

    } catch (error) {
      console.error("[onAccountCreated] Error:", error);
      if (error.response) console.error(error.response.body);
      return null;
    }
  }
);
