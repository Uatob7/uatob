// driverReports.js
// Scheduled Cloud Function — sends a "State of the Platform" report to ALL drivers
// (online, offline, and approved). Shows them the real numbers:
//   - How many drivers are online / offline / approved
//   - How many rides we lost to timeout in the last 7 days
//   - Ask them to stay online and recruit friends + family
//
// HOW TO TRIGGER A REPORT:
//   Go to Firestore → Admin/driverReports → increment sendCount.
//   Within ~1 minute, the function blasts every driver with an email,
//   plus an FCM push to those with a fcmToken (shorter version).
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
const STATE_REF = db.collection("Admin").doc("driverReports");

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
      <stop offset="100%" stop-color="#16A34A"/>
    </linearGradient>
    <linearGradient id="drcar" x1="0" y1="1" x2="1" y2="1">
      <stop offset="0%" stop-color="#16A34A"/>
      <stop offset="100%" stop-color="#15803D"/>
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
  <circle cx="54" cy="42" r="6" fill="#16A34A" opacity="0.18"/>
  <circle cx="54" cy="42" r="3.5" fill="#16A34A"/>
  <text x="54" y="45.5" text-anchor="middle" font-family="Arial,sans-serif"
        font-weight="800" font-size="4.5" fill="#fff">B</text>
  <g transform="translate(26,26)">
    <ellipse cx="6" cy="12" rx="8" ry="2" fill="#111827" opacity="0.1"/>
    <rect x="1" y="5" width="10" height="6" rx="1.5" fill="url(#drcar)"/>
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
// Email builder — Driver Report
// ─────────────────────────────────────────────────────────────
function buildDriverReportEmail({ driver, counts, timeoutCancels, sendCount }) {
  const firstName = String(driver.firstName || "Driver")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const year = new Date().getFullYear();

  const { online, offline, approved } = counts;
  const driverStatus = (driver.status || "").toLowerCase();

  // ── Personalized opening based on this driver's status ─────────
  let personalIntro;
  if (driverStatus === "online") {
    personalIntro = `
      <p style="margin:0 0 14px;font-family:Georgia,serif;font-size:16px;color:#BBF7D0;line-height:1.65;">
        <strong style="color:#4ADE80;">Thank you for being online right now, ${firstName}.</strong>
        You're one of the few drivers covering Orlando tonight. Every ride that gets accepted is because of drivers like you who show up.
      </p>
    `;
  } else if (driverStatus === "offline") {
    personalIntro = `
      <p style="margin:0 0 14px;font-family:Georgia,serif;font-size:16px;color:#FDE68A;line-height:1.65;">
        Hey ${firstName} — here's where UaTob stands right now. You're approved and you've driven before. We need you back online to help cover Orlando.
      </p>
    `;
  } else {
    personalIntro = `
      <p style="margin:0 0 14px;font-family:Georgia,serif;font-size:16px;color:#FDE68A;line-height:1.65;">
        Hey ${firstName} — you're approved to drive on UaTob but you haven't gone online yet. Here's exactly where the platform stands. We need you.
      </p>
    `;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Driver Report — UaTob</title>
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
                           color:#4ADE80;letter-spacing:-0.5px;">Tob</span>
            </td>
            <td valign="middle" style="padding-left:10px;">
              <span style="font-family:'Courier New',monospace;font-size:9px;font-weight:700;
                           color:#60A5FA;background-color:#0c1a2e;padding:4px 9px;
                           border-radius:100px;letter-spacing:1.5px;
                           border:1px solid #1e3a8a;display:inline-block;">DRIVER REPORT</span>
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
            <td style="background:linear-gradient(135deg,#0c1a2e 0%,#0e2236 55%,#1e3a8a 100%);
                       padding:48px 40px 40px;">
              <p style="margin:0 0 8px;font-family:'Courier New',monospace;font-size:10px;
                        font-weight:700;color:#60A5FA;letter-spacing:2.5px;">
                STATE OF THE PLATFORM
              </p>
              <h1 class="hero-title"
                  style="margin:0 0 14px;font-family:Georgia,serif;font-size:38px;
                         font-weight:700;color:#ffffff;line-height:1.15;letter-spacing:-1px;">
                Here&apos;s where<br/>
                <span style="color:#60A5FA;">UaTob stands today.</span>
              </h1>
              ${personalIntro}
            </td>
          </tr></table>

          <!-- DRIVER COUNT STATS -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:32px 40px 8px;">
              <p style="margin:0 0 18px;font-family:'Courier New',monospace;font-size:11px;
                        font-weight:700;color:#60A5FA;letter-spacing:2.5px;">
                THE DRIVER NETWORK
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
                Have driven before<br/>but offline now
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
                Cleared to drive,<br/>haven&apos;t started yet
              </p>
            </td>
          </tr></table>

          <!-- PAINFUL TIMEOUT NUMBER -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:8px 40px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
                <td style="background-color:#1f0f0f;border:1.5px solid #7f1d1d;
                           border-radius:14px;padding:24px;">
                  <table cellpadding="0" cellspacing="0" role="presentation" width="100%"><tr>
                    <td valign="top">
                      <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:11px;
                                font-weight:700;color:#FCA5A5;letter-spacing:1.5px;">
                        &#9888;&nbsp; RIDES WE LOST &middot; LAST ${TIMEOUT_LOOKBACK_DAYS} DAYS
                      </p>
                      <p style="margin:0 0 10px;font-family:Georgia,serif;font-size:48px;font-weight:700;
                                color:#FCA5A5;line-height:1;letter-spacing:-2px;">
                        ${timeoutCancels}
                      </p>
                      <p style="margin:0;font-family:Georgia,serif;font-size:14px;
                                color:#FECACA;line-height:1.6;">
                        ${timeoutCancels === 0
                          ? `Zero this week. Let's keep it there.`
                          : `${timeoutCancels === 1 ? "One rider" : `${timeoutCancels} riders`} requested a UaTob, paid upfront, and timed out waiting — because no driver was online to accept. Every one of them is a refund, a frustrated customer, and a lost ride that should have been yours.`
                        }
                      </p>
                    </td>
                  </tr></table>
                </td>
              </tr></table>
            </td>
          </tr></table>

          <!-- THE REAL TALK -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:0 40px 8px;">
              <p style="margin:0 0 14px;font-family:'Courier New',monospace;font-size:11px;
                        font-weight:700;color:#4ADE80;letter-spacing:2.5px;">
                WHAT WE NEED FROM YOU
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:14px 0;border-bottom:1px solid #1f1f1f;">
                    <table cellpadding="0" cellspacing="0" role="presentation"><tr>
                      <td valign="top" style="width:28px;padding-right:12px;">
                        <span style="display:inline-block;width:22px;height:22px;border-radius:50%;
                                     background:#052e16;color:#4ADE80;
                                     font-family:Georgia,serif;font-size:13px;font-weight:700;
                                     text-align:center;line-height:22px;">1</span>
                      </td>
                      <td valign="top">
                        <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:15px;
                                  font-weight:700;color:#ffffff;line-height:1.4;">
                          Go online &mdash; and stay online.
                        </p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:13.5px;color:#d1d5db;line-height:1.55;">
                          A ride can come at any moment. Drivers who stay online 2&ndash;3 hours catch real money.
                          Drivers who flip on for 10 minutes and give up never see it.
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
                                     background:#052e16;color:#4ADE80;
                                     font-family:Georgia,serif;font-size:13px;font-weight:700;
                                     text-align:center;line-height:22px;">2</span>
                      </td>
                      <td valign="top">
                        <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:15px;
                                  font-weight:700;color:#ffffff;line-height:1.4;">
                          Tell your friends &amp; family about UaTob.
                        </p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:13.5px;color:#d1d5db;line-height:1.55;">
                          Every rider who books costs us nothing in marketing.
                          Tell your people: <strong style="color:#ffffff;">no app needed</strong> &mdash;
                          just open uatob.com from any phone. Cash, card, or Cash App accepted.
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
                                     background:#052e16;color:#4ADE80;
                                     font-family:Georgia,serif;font-size:13px;font-weight:700;
                                     text-align:center;line-height:22px;">3</span>
                      </td>
                      <td valign="top">
                        <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:15px;
                                  font-weight:700;color:#ffffff;line-height:1.4;">
                          Be patient on the first ride.
                        </p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:13.5px;color:#d1d5db;line-height:1.55;">
                          UaTob is small and growing. The first ride might take an hour.
                          The 50th ride will take 8 minutes. Hold the line and you become one of the originals.
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
                    <a href="https://uatob.com/driver" class="cta-btn"
                       style="display:block;background:linear-gradient(135deg,#22C55E 0%,#16A34A 60%,#15803D 100%);color:#ffffff;
                              font-family:'Courier New',monospace;font-size:15px;font-weight:800;
                              text-decoration:none;padding:20px 32px;border-radius:12px;
                              letter-spacing:1.5px;text-align:center;
                              box-shadow:0 8px 24px rgba(22,163,74,0.30);">
                      ${driverStatus === "online" ? "OPEN DRIVER APP &rarr;" : "GO ONLINE NOW &rarr;"}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0;font-family:'Courier New',monospace;font-size:11px;
                        color:#6B7280;text-align:center;letter-spacing:0.5px;">
                Share with friends: <span style="color:#4ADE80;">uatob.com</span>
              </p>
            </td>
          </tr></table>

          <!-- BLAST # STRIP -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:14px 40px;background-color:#0d0d0d;border-top:1px solid #1f1f1f;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;
                        color:#374151;letter-spacing:0.5px;">
                DRIVER REPORT &nbsp;<span style="color:#60A5FA;">#${sendCount}</span>
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
            You&apos;re receiving this because you&apos;re a UaTob driver.
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
    `Hey ${driver.firstName || "Driver"} — here's where UaTob stands today.\n\n` +
    `THE DRIVER NETWORK\n` +
    `─────────────────────────\n` +
    `${online}   Online   — covering Orlando right now\n` +
    `${offline}   Offline  — have driven before but offline now\n` +
    `${approved}   Approved — cleared to drive, haven't started\n\n` +
    `⚠ RIDES WE LOST · LAST ${TIMEOUT_LOOKBACK_DAYS} DAYS\n` +
    `─────────────────────────\n` +
    `${timeoutCancels} ${timeoutCancels === 0
      ? `— Zero this week. Let's keep it there.`
      : `riders requested a UaTob, paid upfront, and timed out waiting because no driver was online. Every one of them is a refund and a lost ride that should have been yours.`
    }\n\n` +
    `WHAT WE NEED FROM YOU:\n\n` +
    `1. GO ONLINE — AND STAY ONLINE.\n` +
    `   A ride can come at any moment. Drivers who stay online 2-3 hours catch real money. Drivers who flip on for 10 minutes and give up never see it.\n\n` +
    `2. TELL YOUR FRIENDS & FAMILY.\n` +
    `   No app needed — just open uatob.com from any phone. Cash, card, or Cash App accepted.\n\n` +
    `3. BE PATIENT ON THE FIRST RIDE.\n` +
    `   UaTob is small and growing. The first ride might take an hour. The 50th ride will take 8 minutes. Hold the line and you become one of the originals.\n\n` +
    `Go online: https://uatob.com/driver\n` +
    `Share UaTob: https://uatob.com\n\n` +
    `Driver Report #${sendCount}\n` +
    `— The UaTob Team`;

  return {
    to:      driver.email,
    from:    "UaTob Team <noreply@uatob.com>",
    replyTo: "support@uatob.com",
    subject: `📊 Driver Report: ${online} online · ${timeoutCancels} rides lost this week`,
    text,
    html,
  };
}

// ─────────────────────────────────────────────────────────────
// Push notification builder — short version
// ─────────────────────────────────────────────────────────────
function buildDriverReportPush({ driver, counts, timeoutCancels, sendCount }) {
  const { online } = counts;
  const driverStatus = (driver.status || "").toLowerCase();

  let title, body;

  if (driverStatus === "online") {
    title = `📊 Driver Report — thanks for being online`;
    body  = `${online} drivers online · ${timeoutCancels} rides lost this week. Tap for the full picture.`;
  } else {
    title = `📊 Only ${online} driver${online === 1 ? "" : "s"} online — we need you`;
    body  = timeoutCancels > 0
      ? `${timeoutCancels} rides timed out this week because no one was online. Go online now.`
      : `Stay online and tell a friend. Open UaTob.`;
  }

  return {
    token: driver.fcmToken,
    notification: { title, body },
    data: {
      title,
      body,
      type: "driver_report",
      sendCount: String(sendCount),
      url: "https://uatob.com/driver",
    },
    webpush: {
      fcmOptions: { link: "https://uatob.com/driver" },
      notification: {
        icon: "https://uatob.com/icon-192.png",
        badge: "https://uatob.com/icon-192.png",
        tag: `driver-report-${sendCount}`,
        renotify: true,
        requireInteraction: false,
      },
    },
    android: {
      priority: "high",
      notification: { channelId: "driver_report", priority: "high" },
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
    console.log(`[driverReports] Dead FCM token cleared for ${driverUid} (${errCode})`);
  } catch (err) {
    console.error(`[driverReports] Failed to clear dead token for ${driverUid}:`, err.message);
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
    // Fallback if the compound index is missing — pull all cancelled and filter client-side
    console.warn("[driverReports] Compound query failed, falling back:", err.message);
    const snap = await db.collection("Rides")
      .where("status", "==", "cancelled")
      .get();
    const cutoffMs = cutoff.getTime();
    return snap.docs.filter(doc => {
      const data = doc.data();
      const reasonMatches = data.cancelReason === "timeout_auto_cancel";
      const cancelledAt = data.cancelledAt?.toMillis?.() ?? 0;
      return reasonMatches && cancelledAt >= cutoffMs;
    }).length;
  }
}

// ─────────────────────────────────────────────────────────────
// Scheduled Cloud Function
// ─────────────────────────────────────────────────────────────
exports.driverReportEmail = onSchedule(
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
      console.log("[driverReports] State doc initialized. Awaiting admin to increment sendCount.");
      return;
    }

    // ── 3. Decide whether to run ───────────────────────────
    if (lastBlastedCount !== null && sendCount <= lastBlastedCount) {
      console.log(
        `[driverReports] sendCount (${sendCount}) <= lastBlastedCount (${lastBlastedCount}). Skipping.`
      );
      return;
    }

    console.log(`[driverReports] sendCount ${sendCount} > lastBlastedCount ${lastBlastedCount}. Blasting.`);

    // ── 4. Pull all drivers, bucket by status ──────────────
    const driversSnap = await db.collection("Drivers").get();
    const targets = [];
    const counts = { online: 0, offline: 0, approved: 0 };

    driversSnap.docs.forEach((doc) => {
      const data = doc.data();
      const status = (data.status || "").toLowerCase();

      if      (status === "online")   counts.online++;
      else if (status === "offline")  counts.offline++;
      else if (status === "approved") counts.approved++;

      // Email/push EVERY driver in these three statuses — including online ones
      if (["online", "offline", "approved"].includes(status) && data.email) {
        targets.push({ uid: doc.id, ...data });
      }
    });

    console.log(
      `[driverReports] Online: ${counts.online} · Offline: ${counts.offline} · Approved: ${counts.approved} · Targets: ${targets.length}`
    );

    // ── 5. Count timeout cancellations in lookback window ──
    const timeoutCancels = await countTimeoutCancellations(TIMEOUT_LOOKBACK_DAYS);
    console.log(`[driverReports] Timeout cancellations (last ${TIMEOUT_LOOKBACK_DAYS} days): ${timeoutCancels}`);

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
      console.log("[driverReports] No targets. State updated.");
      return;
    }

    // ── 6. Send emails ─────────────────────────────────────
    const emailResults = await Promise.allSettled(
      targets.map((driver) =>
        sgMail.send(buildDriverReportEmail({ driver, counts, timeoutCancels, sendCount }))
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
          `[driverReports] Email failed for ${targets[i]?.email}:`,
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
          messaging.send(buildDriverReportPush({ driver, counts, timeoutCancels, sendCount }))
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
            `[driverReports] Push failed for ${driver.uid}:`,
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
        lastBlastedCount:  sendCount,
        lastBlastAt:       admin.firestore.FieldValue.serverTimestamp(),
        lastOnlineCount:   counts.online,
        lastOfflineCount:  counts.offline,
        lastApprovedCount: counts.approved,
        lastTimeoutCount:  timeoutCancels,
        lastTargetCount:   targets.length,
        lastEmailSuccess:  emailSent,
        lastEmailFailed:   emailFailed,
        lastPushSuccess:   pushSent,
        lastPushFailed:    pushFailed,
        lastBlastedDrivers: emailedUids,
        nextBlastDate:     todayStr,
      },
      { merge: true }
    );

    console.log(
      `[driverReports] Blast #${sendCount} done | ` +
      `Email: ${emailSent} sent, ${emailFailed} failed | ` +
      `Push: ${pushSent} sent, ${pushFailed} failed | ` +
      `Online: ${counts.online} · Offline: ${counts.offline} · Approved: ${counts.approved} | ` +
      `Timeouts (${TIMEOUT_LOOKBACK_DAYS}d): ${timeoutCancels}`
    );
  }
);