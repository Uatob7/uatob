// driverInProgressEmail.js
// Scheduled Cloud Function — emails drivers with status "in_progress"
// (drivers who started signup but haven't completed / been approved yet).
//
// Shows them real platform stats so they feel the urgency to finish their
// application and get approved.
//
// HOW TO TRIGGER A BLAST:
//   Go to Firestore → Admin/driverInProgressBlasts → increment sendCount.
//   Within ~1 minute, the function emails every in_progress driver.
//   Drivers WITH an fcmToken also get a short push notification.
//
// FIRST-RUN BEHAVIOR:
//   On first execution, creates the state doc with sendCount=1,
//   lastBlastedCount=1. Won't blast until admin actively increments sendCount.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");
const STATE_REF = db.collection("Admin").doc("driverInProgressBlasts");

// Window for counting cancelled-by-timeout rides
const TIMEOUT_LOOKBACK_DAYS = 7;

// ─────────────────────────────────────────────────────────────
// Brand SVGs (matches the other transactional emails)
// ─────────────────────────────────────────────────────────────
const UATOB_ICON_SVG = `
<svg width="46" height="46" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="drbg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F3F4F6"/>
    </linearGradient>
    <linearGradient id="drroad" x1="0" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#0D9488"/>
    </linearGradient>
    <linearGradient id="drcar" x1="0" y1="1" x2="1" y2="1">
      <stop offset="0%" stop-color="#0D9488"/>
      <stop offset="100%" stop-color="#0891B2"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#drbg)"/>
  <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" stroke="#E5E7EB" stroke-width="1"/>
  <path d="M 10 42 Q 32 24 54 42" stroke="url(#drroad)" stroke-width="2.5"
        stroke-dasharray="5 4" stroke-linecap="round" fill="none" opacity="0.6"/>
  <circle cx="10" cy="42" r="6" fill="#111827" opacity="0.12"/>
  <circle cx="10" cy="42" r="3.5" fill="#111827"/>
  <text x="10" y="45.5" text-anchor="middle" font-family="Arial,sans-serif"
        font-weight="800" font-size="4.5" fill="#fff">A</text>
  <circle cx="54" cy="42" r="6" fill="#0D9488" opacity="0.18"/>
  <circle cx="54" cy="42" r="3.5" fill="#0D9488"/>
  <text x="54" y="45.5" text-anchor="middle" font-family="Arial,sans-serif"
        font-weight="800" font-size="4.5" fill="#fff">B</text>
  <g transform="translate(26,26)">
    <ellipse cx="6" cy="12" rx="8" ry="2" fill="#111827" opacity="0.1"/>
    <rect x="1" y="5" width="10" height="6" rx="1.5" fill="url(#drcar)"/>
    <path d="M3 5 L3.8 2 L8.2 2 L9 5Z" fill="#0891B2"/>
    <rect x="3.5" y="2.5" width="2.3" height="2" rx="0.5" fill="#fff" fill-opacity="0.85"/>
    <rect x="6.2" y="2.5" width="2.3" height="2" rx="0.5" fill="#fff" fill-opacity="0.85"/>
    <circle cx="3" cy="11" r="1.8" fill="#111827"/>
    <circle cx="3" cy="11" r="0.9" fill="#0D9488"/>
    <circle cx="9" cy="11" r="1.8" fill="#111827"/>
    <circle cx="9" cy="11" r="0.9" fill="#0891B2"/>
    <rect x="10.5" y="6.5" width="1.5" height="1" rx="0.5" fill="#FCD34D"/>
  </g>
</svg>`.trim();

const ARROW_SVG = `
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
     style="display:inline-block;vertical-align:middle;margin:0 3px;">
  <path d="M5 12h14M13 6l6 6-6 6"
        stroke="#0D9488" stroke-width="2.2"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>`.trim();

// ─────────────────────────────────────────────────────────────
// Email builder — In-Progress Driver Blast
// ─────────────────────────────────────────────────────────────
function buildInProgressEmail({ driver, counts, timeoutCancels, sendCount }) {
  const firstName = String(driver.firstName || "Driver")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const year = new Date().getFullYear();

  const { online, offline, approved } = counts;

  // Figure out what step they're on so we can tailor the opener
  const currentStep = driver.currentStep ?? driver.step ?? null;
  const stepLabel = currentStep ? `Step ${currentStep}` : "your application";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Finish Your Application — UaTob</title>
  <style type="text/css">
    body, html {
      -webkit-text-size-adjust: 100% !important;
      -ms-text-size-adjust: 100% !important;
      margin: 0 !important; padding: 0 !important;
      background-color: #0a0a0a !important;
    }
    @media only screen and (max-width: 600px) {
      .hero-title { font-size: 30px !important; }
      .stat-num   { font-size: 56px !important; }
      .stat-td    { display: block !important; width: 100% !important;
                    border-right: none !important; border-bottom: 1px solid #1f1f1f !important; }
      .cta-btn    { font-size: 14px !important; padding: 16px 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="background-color:#0a0a0a;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" role="presentation"
           style="max-width:600px;width:100%;">

      <!-- WORDMARK -->
      <tr>
        <td align="center" style="padding-bottom:28px;">
          <table cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td valign="middle" style="padding-right:10px;">${UATOB_ICON_SVG}</td>
            <td valign="middle">
              <span style="font-family:Georgia,serif;font-style:italic;font-weight:300;
                           font-size:28px;color:#ffffff;letter-spacing:-0.5px;">Ua</span><!--
           -->${ARROW_SVG}<!--
           --><span style="font-family:Arial,sans-serif;font-weight:800;font-size:28px;
                           color:#2DD4BF;letter-spacing:-0.5px;">Tob</span>
            </td>
            <td valign="middle" style="padding-left:10px;">
              <span style="font-family:'Courier New',monospace;font-size:9px;font-weight:700;
                           color:#2DD4BF;background-color:#042f2e;padding:4px 9px;
                           border-radius:100px;letter-spacing:1.5px;
                           border:1px solid #134e4a;display:inline-block;">DRIVER UPDATE</span>
            </td>
          </tr></table>
        </td>
      </tr>

      <!-- MAIN CARD -->
      <tr>
        <td style="background-color:#111111;border-radius:20px;
                   border:1px solid #1f1f1f;overflow:hidden;">

          <!-- HERO -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="background:linear-gradient(135deg,#042f2e 0%,#0c3a38 55%,#134e4a 100%);
                       padding:48px 40px 40px;">
              <p style="margin:0 0 8px;font-family:'Courier New',monospace;font-size:10px;
                        font-weight:700;color:#2DD4BF;letter-spacing:2.5px;">
                YOUR APPLICATION IS WAITING
              </p>
              <h1 class="hero-title"
                  style="margin:0 0 14px;font-family:Georgia,serif;font-size:38px;
                         font-weight:700;color:#ffffff;line-height:1.15;letter-spacing:-1px;">
                Hey ${firstName}, don&apos;t<br/>
                <span style="color:#2DD4BF;">leave money on the table.</span>
              </h1>
              <p style="margin:0 0 14px;font-family:Georgia,serif;font-size:16px;color:#99F6E4;line-height:1.65;">
                You started your UaTob driver application — you&apos;re on <strong style="color:#ffffff;">${stepLabel}</strong>.
                While you&apos;ve been away, riders in Orlando have been requesting rides.
                Every driver who finishes their application is one more person who could have earned from those trips.
              </p>
              <p style="margin:0;font-family:Georgia,serif;font-size:15px;color:#5EEAD4;line-height:1.5;">
                Here&apos;s what the UaTob network looks like right now.
              </p>
            </td>
          </tr></table>

          <!-- DRIVER COUNT STATS -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:32px 40px 8px;">
              <p style="margin:0 0 18px;font-family:'Courier New',monospace;font-size:11px;
                        font-weight:700;color:#2DD4BF;letter-spacing:2.5px;">
                THE DRIVER NETWORK RIGHT NOW
              </p>
            </td>
          </tr></table>

          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td width="33%" align="center" class="stat-td"
                style="padding:0 18px 24px;border-right:1px solid #1f1f1f;vertical-align:top;">
              <p class="stat-num"
                 style="margin:0;font-family:Georgia,serif;font-size:64px;font-weight:700;
                        color:#4ADE80;line-height:1;letter-spacing:-2px;">
                ${online}
              </p>
              <p style="margin:8px 0 4px;font-family:'Courier New',monospace;font-size:10px;
                        font-weight:700;color:#4ADE80;letter-spacing:1.5px;">
                ONLINE
              </p>
              <p style="margin:0;font-family:Georgia,serif;font-size:12px;color:#9CA3AF;line-height:1.5;">
                Covering Orlando<br/>right now
              </p>
            </td>
            <td width="33%" align="center" class="stat-td"
                style="padding:0 18px 24px;border-right:1px solid #1f1f1f;vertical-align:top;">
              <p class="stat-num"
                 style="margin:0;font-family:Georgia,serif;font-size:64px;font-weight:700;
                        color:#FBBF24;line-height:1;letter-spacing:-2px;">
                ${offline}
              </p>
              <p style="margin:8px 0 4px;font-family:'Courier New',monospace;font-size:10px;
                        font-weight:700;color:#FBBF24;letter-spacing:1.5px;">
                OFFLINE
              </p>
              <p style="margin:0;font-family:Georgia,serif;font-size:12px;color:#9CA3AF;line-height:1.5;">
                Approved but<br/>offline now
              </p>
            </td>
            <td width="33%" align="center" class="stat-td"
                style="padding:0 18px 24px;vertical-align:top;">
              <p class="stat-num"
                 style="margin:0;font-family:Georgia,serif;font-size:64px;font-weight:700;
                        color:#60A5FA;line-height:1;letter-spacing:-2px;">
                ${approved}
              </p>
              <p style="margin:8px 0 4px;font-family:'Courier New',monospace;font-size:10px;
                        font-weight:700;color:#60A5FA;letter-spacing:1.5px;">
                APPROVED
              </p>
              <p style="margin:0;font-family:Georgia,serif;font-size:12px;color:#9CA3AF;line-height:1.5;">
                Cleared to drive,<br/>ready to earn
              </p>
            </td>
          </tr></table>

          <!-- MISSED RIDES BOX -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:8px 40px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
                <td style="background-color:#1f0f0f;border:1.5px solid #7f1d1d;
                           border-radius:14px;padding:24px;">
                  <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:11px;
                            font-weight:700;color:#FCA5A5;letter-spacing:1.5px;">
                    &#9888;&nbsp; RIDES LOST TO TIMEOUTS &middot; LAST ${TIMEOUT_LOOKBACK_DAYS} DAYS
                  </p>
                  <p style="margin:0 0 10px;font-family:Georgia,serif;font-size:48px;font-weight:700;
                            color:#FCA5A5;line-height:1;letter-spacing:-2px;">
                    ${timeoutCancels}
                  </p>
                  <p style="margin:0;font-family:Georgia,serif;font-size:14px;
                            color:#FECACA;line-height:1.6;">
                    ${timeoutCancels === 0
                      ? `Zero lost rides this week. The drivers who are online are covering Orlando. Finish your application and join them.`
                      : `${timeoutCancels === 1 ? "One rider" : `${timeoutCancels} riders`} paid for a UaTob and couldn&apos;t get picked up — because not enough drivers were online. Every one of those was a fare that should have gone to a driver. That driver could have been you.`
                    }
                  </p>
                </td>
              </tr></table>
            </td>
          </tr></table>

          <!-- WHAT HAPPENS WHEN YOU FINISH -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:0 40px 8px;">
              <p style="margin:0 0 18px;font-family:'Courier New',monospace;font-size:11px;
                        font-weight:700;color:#2DD4BF;letter-spacing:2.5px;">
                WHAT HAPPENS WHEN YOU FINISH
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:14px 0;border-bottom:1px solid #1f1f1f;">
                    <table cellpadding="0" cellspacing="0" role="presentation"><tr>
                      <td valign="top" style="width:28px;padding-right:12px;">
                        <span style="display:inline-block;width:22px;height:22px;border-radius:50%;
                                     background:#042f2e;color:#2DD4BF;
                                     font-family:Georgia,serif;font-size:13px;font-weight:700;
                                     text-align:center;line-height:22px;">1</span>
                      </td>
                      <td valign="top">
                        <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:15px;
                                  font-weight:700;color:#ffffff;line-height:1.4;">
                          We review and approve you fast.
                        </p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:13.5px;color:#d1d5db;line-height:1.55;">
                          Once your application is complete, we personally review it and get back to you.
                          This is a real platform — not an algorithm.
                        </p>
                      </td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 0;border-bottom:1px solid #1f1f1f;">
                    <table cellpadding="0" cellspacing="0" role="presentation"><tr>
                      <td valign="top" style="width:28px;padding-right:12px;">
                        <span style="display:inline-block;width:22px;height:22px;border-radius:50%;
                                     background:#042f2e;color:#2DD4BF;
                                     font-family:Georgia,serif;font-size:13px;font-weight:700;
                                     text-align:center;line-height:22px;">2</span>
                      </td>
                      <td valign="top">
                        <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:15px;
                                  font-weight:700;color:#ffffff;line-height:1.4;">
                          You keep 75% of every fare. No surge, no games.
                        </p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:13.5px;color:#d1d5db;line-height:1.55;">
                          UaTob takes 25%. That&apos;s it. No hidden fees,
                          no surge pricing for riders (so they actually use the platform),
                          no manipulation of your earnings.
                        </p>
                      </td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 0;border-bottom:1px solid #1f1f1f;">
                    <table cellpadding="0" cellspacing="0" role="presentation"><tr>
                      <td valign="top" style="width:28px;padding-right:12px;">
                        <span style="display:inline-block;width:22px;height:22px;border-radius:50%;
                                     background:#042f2e;color:#2DD4BF;
                                     font-family:Georgia,serif;font-size:13px;font-weight:700;
                                     text-align:center;line-height:22px;">3</span>
                      </td>
                      <td valign="top">
                        <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:15px;
                                  font-weight:700;color:#ffffff;line-height:1.4;">
                          Go online — a ride can come at any time.
                        </p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:13.5px;color:#d1d5db;line-height:1.55;">
                          Bar close, airport runs, hotel pickups — Orlando doesn&apos;t sleep.
                          Drivers who stay online 2&ndash;3 hours catch real money.
                          No peak hours guaranteed yet, but being online IS the strategy.
                        </p>
                      </td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 0;">
                    <table cellpadding="0" cellspacing="0" role="presentation"><tr>
                      <td valign="top" style="width:28px;padding-right:12px;">
                        <span style="display:inline-block;width:22px;height:22px;border-radius:50%;
                                     background:#042f2e;color:#2DD4BF;
                                     font-family:Georgia,serif;font-size:13px;font-weight:700;
                                     text-align:center;line-height:22px;">4</span>
                      </td>
                      <td valign="top">
                        <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:15px;
                                  font-weight:700;color:#ffffff;line-height:1.4;">
                          Tell your friends &amp; family about UaTob.
                        </p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:13.5px;color:#d1d5db;line-height:1.55;">
                          No app needed for riders — just open <strong style="color:#ffffff;">uatob.com</strong> from any phone.
                          Cash, card, or Cash App accepted.
                          Every rider your network sends is another fare in your pocket.
                        </p>
                      </td>
                    </tr></table>
                  </td>
                </tr>
              </table>
            </td>
          </tr></table>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:24px 40px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center">
                    <a href="https://uatob.com/driver/signup" class="cta-btn"
                       style="display:block;background:linear-gradient(135deg,#0D9488 0%,#0891B2 60%,#0369A1 100%);
                              color:#ffffff;font-family:'Courier New',monospace;font-size:15px;font-weight:800;
                              text-decoration:none;padding:20px 32px;border-radius:12px;
                              letter-spacing:1.5px;text-align:center;
                              box-shadow:0 8px 24px rgba(13,148,136,0.35);">
                      FINISH MY APPLICATION &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0;font-family:'Courier New',monospace;font-size:11px;
                        color:#6B7280;text-align:center;letter-spacing:0.5px;">
                Questions? Reply to this email or visit <span style="color:#2DD4BF;">uatob.com</span>
              </p>
            </td>
          </tr></table>

          <!-- BLAST # STRIP -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:14px 40px;background-color:#0d0d0d;border-top:1px solid #1f1f1f;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;
                        color:#374151;letter-spacing:0.5px;">
                DRIVER UPDATE &nbsp;<span style="color:#2DD4BF;">#${sendCount}</span>
              </p>
            </td>
          </tr></table>

        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td align="center" style="padding:28px 20px 0;">
          <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:11px;
                    color:#374151;letter-spacing:0.5px;">
            &copy; ${year} UaTob &nbsp;&middot;&nbsp; Orlando, FL
          </p>
          <p style="margin:0;font-family:'Courier New',monospace;font-size:10px;
                    color:#1f2937;letter-spacing:0.3px;">
            You&apos;re receiving this because you started a UaTob driver application.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`.trim();

  // ── Plain text variant ──
  const text =
    `Hey ${driver.firstName || "Driver"} — your UaTob driver application is still waiting on you.\n\n` +
    `You're on ${stepLabel}. Here's where the platform stands right now:\n\n` +
    `THE DRIVER NETWORK\n` +
    `─────────────────────────\n` +
    `${online}   Online   — covering Orlando right now\n` +
    `${offline}   Offline  — approved but offline now\n` +
    `${approved}   Approved — cleared to drive and ready to earn\n\n` +
    `⚠ RIDES LOST · LAST ${TIMEOUT_LOOKBACK_DAYS} DAYS\n` +
    `─────────────────────────\n` +
    `${timeoutCancels} ${timeoutCancels === 0
      ? `— Zero lost rides this week. Finish your app and help keep it that way.`
      : `riders paid for a UaTob and timed out waiting. No driver was online. That should have been your fare.`
    }\n\n` +
    `WHAT HAPPENS WHEN YOU FINISH:\n\n` +
    `1. WE REVIEW AND APPROVE YOU FAST.\n` +
    `   Real platform, real people reviewing your application.\n\n` +
    `2. YOU KEEP 75% OF EVERY FARE.\n` +
    `   UaTob takes 25%. No hidden fees, no games.\n\n` +
    `3. GO ONLINE — A RIDE CAN COME AT ANY TIME.\n` +
    `   Bar close, airports, hotels. Drivers online 2-3 hours catch real money.\n\n` +
    `4. TELL YOUR FRIENDS & FAMILY.\n` +
    `   No app needed for riders — just uatob.com. Cash, card, or Cash App.\n\n` +
    `Finish your application: https://uatob.com/driver/signup\n\n` +
    `Driver Update #${sendCount}\n` +
    `— The UaTob Team`;

  return {
    to:      driver.email,
    from:    "UaTob Team <noreply@uatob.com>",
    replyTo: "support@uatob.com",
    subject: `⏳ ${firstName}, your UaTob application is still waiting`,
    text,
    html,
  };
}

// ─────────────────────────────────────────────────────────────
// Push notification builder — short version
// ─────────────────────────────────────────────────────────────
function buildInProgressPush({ driver, counts, timeoutCancels, sendCount }) {
  const { online } = counts;
  const firstName = driver.firstName || "Driver";

  const title = `⏳ ${firstName}, finish your UaTob application`;
  const body  = timeoutCancels > 0
    ? `${timeoutCancels} rides timed out this week — only ${online} driver${online === 1 ? "" : "s"} online. Finish up and get in.`
    : `${online} driver${online === 1 ? "" : "s"} online now. Finish your app and start earning.`;

  return {
    token: driver.fcmToken,
    notification: { title, body },
    data: {
      title,
      body,
      type: "driver_in_progress",
      sendCount: String(sendCount),
      url: "https://uatob.com/driver/signup",
    },
    webpush: {
      fcmOptions: { link: "https://uatob.com/driver/signup" },
      notification: {
        icon: "https://uatob.com/icon-192.png",
        badge: "https://uatob.com/icon-192.png",
        tag: `driver-inprogress-${sendCount}`,
        renotify: true,
        requireInteraction: false,
      },
    },
    android: {
      priority: "high",
      notification: { channelId: "driver_updates", priority: "high" },
    },
    apns: {
      payload: { aps: { sound: "default", badge: 1 } },
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Helper — strip dead FCM tokens
// ─────────────────────────────────────────────────────────────
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

async function handleDeadToken(driverUid, errCode) {
  try {
    await db.collection("Drivers").doc(driverUid).update({
      fcmToken: admin.firestore.FieldValue.delete(),
      fcmTokenClearReason: errCode,
      fcmTokenClearedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`[driverInProgress] Dead FCM token cleared for ${driverUid} (${errCode})`);
  } catch (err) {
    console.error(`[driverInProgress] Failed to clear dead token for ${driverUid}:`, err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// Helper — count cancelled-by-timeout rides in last N days
// ─────────────────────────────────────────────────────────────
async function countTimeoutCancellations(lookbackDays) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);

  try {
    const snap = await db.collection("Rides")
      .where("status", "==", "cancelled")
      .where("cancelReason", "==", "timeout_auto_cancel")
      .where("cancelledAt", ">=", cutoff)
      .get();
    return snap.size;
  } catch (err) {
    // Fallback if composite index is missing — filter client-side
    console.warn("[driverInProgress] Compound query failed, falling back:", err.message);
    const snap = await db.collection("Rides")
      .where("status", "==", "cancelled")
      .get();
    const cutoffMs = cutoff.getTime();
    return snap.docs.filter(doc => {
      const data = doc.data();
      return (
        data.cancelReason === "timeout_auto_cancel" &&
        (data.cancelledAt?.toMillis?.() ?? 0) >= cutoffMs
      );
    }).length;
  }
}

// ─────────────────────────────────────────────────────────────
// Scheduled Cloud Function
// ─────────────────────────────────────────────────────────────
exports.driverInProgressEmail = onSchedule(
  {
    schedule: "every 1 minutes",
    region:   "us-east1",
    secrets:  [SENDGRID_API_KEY],
  },
  async () => {
    sgMail.setApiKey(SENDGRID_API_KEY.value());

    // ── 1. Read state ───────────────────────────────────────
    const stateSnap = await STATE_REF.get();
    const state = stateSnap.exists ? stateSnap.data() : {};

    const sendCount        = state.sendCount        ?? 1;
    const lastBlastedCount = state.lastBlastedCount ?? null;
    const todayStr         = new Date().toISOString().slice(0, 10);

    // ── 2. First-run initialization ────────────────────────
    if (!stateSnap.exists) {
      await STATE_REF.set({
        sendCount:        1,
        lastBlastedCount: 1,
        initialBlastDone: true,
        nextBlastDate:    todayStr,
        initializedAt:    admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log("[driverInProgress] State doc initialized. Awaiting admin to increment sendCount.");
      return;
    }

    // ── 3. Decide whether to run ───────────────────────────
    if (lastBlastedCount !== null && sendCount <= lastBlastedCount) {
      console.log(
        `[driverInProgress] sendCount (${sendCount}) <= lastBlastedCount (${lastBlastedCount}). Skipping.`
      );
      return;
    }

    console.log(`[driverInProgress] sendCount ${sendCount} > lastBlastedCount ${lastBlastedCount}. Blasting.`);

    // ── 4. Pull drivers ────────────────────────────────────
    // Targets: status === "in_progress"
    // Counts:  online / offline / approved from the full driver pool
    const driversSnap = await db.collection("Drivers").get();
    const targets = [];
    const counts = { online: 0, offline: 0, approved: 0 };

    driversSnap.docs.forEach((doc) => {
      const data = doc.data();
      const status = (data.status || "").toLowerCase();

      // Build platform counts from ALL drivers
      if      (status === "online")   counts.online++;
      else if (status === "offline")  counts.offline++;
      else if (status === "approved") counts.approved++;

      // Only email in_progress drivers who have an email address
      if (status === "in_progress" && data.email) {
        targets.push({ uid: doc.id, ...data });
      }
    });

    console.log(
      `[driverInProgress] In-progress targets: ${targets.length} | ` +
      `Online: ${counts.online} · Offline: ${counts.offline} · Approved: ${counts.approved}`
    );

    // ── 5. Count timeout cancellations ────────────────────
    const timeoutCancels = await countTimeoutCancellations(TIMEOUT_LOOKBACK_DAYS);
    console.log(`[driverInProgress] Timeout cancellations (last ${TIMEOUT_LOOKBACK_DAYS} days): ${timeoutCancels}`);

    if (targets.length === 0) {
      await STATE_REF.set(
        {
          lastBlastedCount:  sendCount,
          lastBlastAt:       admin.firestore.FieldValue.serverTimestamp(),
          lastOnlineCount:   counts.online,
          lastOfflineCount:  counts.offline,
          lastApprovedCount: counts.approved,
          lastTimeoutCount:  timeoutCancels,
          lastTargetCount:   0,
          lastEmailSuccess:  0,
          lastEmailFailed:   0,
          lastPushSuccess:   0,
          lastPushFailed:    0,
          nextBlastDate:     todayStr,
        },
        { merge: true }
      );
      console.log("[driverInProgress] No in_progress targets found. State updated.");
      return;
    }

    // ── 6. Send emails ─────────────────────────────────────
    const emailResults = await Promise.allSettled(
      targets.map((driver) =>
        sgMail.send(buildInProgressEmail({ driver, counts, timeoutCancels, sendCount }))
      )
    );

    const emailedUids = [];
    let emailSent = 0;
    let emailFailed = 0;

    emailResults.forEach((r, i) => {
      if (r.status === "fulfilled") {
        emailSent++;
        emailedUids.push(targets[i].uid);
      } else {
        emailFailed++;
        console.error(
          `[driverInProgress] Email failed for ${targets[i]?.email}:`,
          r.reason?.message
        );
      }
    });

    // ── 7. Send FCM push (drivers with fcmToken only) ──────
    const pushTargets = targets.filter((d) => !!d.fcmToken);
    let pushSent = 0;
    let pushFailed = 0;

    if (pushTargets.length > 0) {
      const messaging = admin.messaging();
      const pushResults = await Promise.allSettled(
        pushTargets.map((driver) =>
          messaging.send(buildInProgressPush({ driver, counts, timeoutCancels, sendCount }))
        )
      );

      pushResults.forEach((r, i) => {
        const driver = pushTargets[i];
        if (r.status === "fulfilled") {
          pushSent++;
        } else {
          pushFailed++;
          const errCode = r.reason?.errorInfo?.code || r.reason?.code;
          console.error(
            `[driverInProgress] Push failed for ${driver.uid}:`,
            errCode || r.reason?.message
          );
          if (errCode && DEAD_TOKEN_CODES.has(errCode)) {
            handleDeadToken(driver.uid, errCode);
          }
        }
      });
    }

    // ── 8. Persist state ───────────────────────────────────
    await STATE_REF.set(
      {
        lastBlastedCount:   sendCount,
        lastBlastAt:        admin.firestore.FieldValue.serverTimestamp(),
        lastOnlineCount:    counts.online,
        lastOfflineCount:   counts.offline,
        lastApprovedCount:  counts.approved,
        lastTimeoutCount:   timeoutCancels,
        lastTargetCount:    targets.length,
        lastEmailSuccess:   emailSent,
        lastEmailFailed:    emailFailed,
        lastPushSuccess:    pushSent,
        lastPushFailed:     pushFailed,
        lastBlastedDrivers: emailedUids,
        nextBlastDate:      todayStr,
      },
      { merge: true }
    );

    console.log(
      `[driverInProgress] Blast #${sendCount} done | ` +
      `Email: ${emailSent} sent, ${emailFailed} failed | ` +
      `Push: ${pushSent} sent, ${pushFailed} failed | ` +
      `In-progress targets: ${targets.length} | ` +
      `Online: ${counts.online} · Offline: ${counts.offline} · Approved: ${counts.approved} | ` +
      `Timeouts (${TIMEOUT_LOOKBACK_DAYS}d): ${timeoutCancels}`
    );
  }
);