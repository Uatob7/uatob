// announceOnlineDrivers.js
// Scheduled Cloud Function — emails + push-notifies approved/offline drivers
// when admin increments the sendCount in Firestore.
//
// HOW TO TRIGGER A BLAST:
//   Go to Firestore → Admin/onlineDriversBlasts → change sendCount
//   from 1 to 2 (or any higher number). Within ~1 minute, the function will:
//     • Email every driver with status "approved" or "offline" who has an email
//     • Push every same driver who has an fcmToken (drivers without one are skipped)
//   The function then records that sendCount as "lastBlastedCount" and saves
//   all emailed driver UIDs in "lastBlastedDrivers".
//   Next time you change sendCount to 3, it blasts again. And so on.
//
// FIRST-RUN BEHAVIOR:
//   On the very first execution, if no state doc exists, the function creates
//   one with sendCount=1, lastBlastedCount=1, initialBlastDone=true,
//   nextBlastDate=<today>. This means it won't blast until you actively
//   increment sendCount — preventing accidental first-deploy spam.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");
const STATE_REF = db.collection("Admin").doc("onlineDriversBlasts");

// ─────────────────────────────────────────────────────────────
// Brand SVGs (matches the cash-rides email)
// ─────────────────────────────────────────────────────────────
const UATOB_ICON_SVG = `
<svg width="46" height="46" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="oibg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F3F4F6"/>
    </linearGradient>
    <linearGradient id="oiroad" x1="0" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#16A34A"/>
    </linearGradient>
    <linearGradient id="oicar" x1="0" y1="1" x2="1" y2="1">
      <stop offset="0%" stop-color="#16A34A"/>
      <stop offset="100%" stop-color="#15803D"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#oibg)"/>
  <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" stroke="#E5E7EB" stroke-width="1"/>
  <path d="M 10 42 Q 32 24 54 42" stroke="url(#oiroad)" stroke-width="2.5"
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
    <rect x="1" y="5" width="10" height="6" rx="1.5" fill="url(#oicar)"/>
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
function buildOnlineRecruitEmail({ driver, onlineCount, sendCount }) {
  const firstName = String(driver.firstName || "Driver")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const year = new Date().getFullYear();

  let onlineCopy;
  if (onlineCount === 0) {
    onlineCopy = `<strong style="color:#FBBF24;">No one's online right now.</strong> That means whoever flips on first catches every request.`;
  } else if (onlineCount === 1) {
    onlineCopy = `<strong style="color:#FBBF24;">Only 1 driver is online right now.</strong> If you go online, you double the supply.`;
  } else if (onlineCount < 5) {
    onlineCopy = `<strong style="color:#FBBF24;">Only ${onlineCount} drivers are online right now.</strong> The next rider request is yours if you flip on now.`;
  } else {
    onlineCopy = `<strong style="color:#FBBF24;">${onlineCount} drivers are online right now</strong> — and the busier we get, the more riders we attract.`;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Orlando needs you online — UaTob</title>
  <style type="text/css">
    body, html {
      -webkit-text-size-adjust: 100% !important;
      -ms-text-size-adjust: 100% !important;
      margin: 0 !important; padding: 0 !important;
      background-color: #0a0a0a !important;
    }
    @media only screen and (max-width: 600px) {
      .hero-title { font-size: 28px !important; }
      .big-num    { font-size: 88px !important; }
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
                           color:#FBBF24;background-color:#1e1810;padding:4px 9px;
                           border-radius:100px;letter-spacing:1.5px;
                           border:1px solid #78350f;display:inline-block;">DRIVERS NEEDED</span>
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
            <td style="background:linear-gradient(135deg,#1a1207 0%,#3F2F12 55%,#78350f 100%);
                       padding:48px 40px 40px;">
              <h1 class="hero-title"
                  style="margin:0 0 16px;font-family:Georgia,serif;font-size:36px;
                         font-weight:700;color:#ffffff;line-height:1.2;letter-spacing:-1px;">
                Hey ${firstName} &mdash; Orlando<br/>
                <span style="color:#FBBF24;">needs you online.</span>
              </h1>
              <p style="margin:0;font-family:Georgia,serif;font-size:16px;
                        color:#FDE68A;line-height:1.65;">
                ${onlineCopy} Every minute you're offline is a rider going to Uber or Lyft instead of you.
              </p>
            </td>
          </tr></table>

          <!-- BIG STAT -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td align="center"
                style="padding:36px 40px 28px;border-bottom:1px solid #1f1f1f;">
              <p style="margin:0 0 4px;font-family:'Courier New',monospace;font-size:10px;
                        font-weight:700;color:#FBBF24;letter-spacing:2.5px;">
                DRIVERS ONLINE RIGHT NOW
              </p>
              <p class="big-num"
                 style="margin:0;font-family:Georgia,serif;font-size:96px;font-weight:700;
                        color:#ffffff;line-height:1;letter-spacing:-4px;">
                ${onlineCount}
              </p>
              <p style="margin:10px 0 0;font-family:'Courier New',monospace;font-size:11px;
                        color:#6B7280;letter-spacing:1px;">
                in the Orlando metro area
              </p>
            </td>
          </tr></table>

          <!-- UBER HISTORY BOX -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:32px 40px 8px;">
              <p style="margin:0 0 14px;font-family:'Courier New',monospace;font-size:11px;
                        font-weight:700;color:#4ADE80;letter-spacing:2.5px;">
                A TRUE STORY
              </p>
              <p style="margin:0 0 14px;font-family:Georgia,serif;font-size:16px;
                        color:#d1d5db;line-height:1.65;">
                When <strong style="color:#ffffff;">Uber launched in San Francisco in 2010</strong>,
                they had <strong style="color:#FBBF24;">3 drivers.</strong>
              </p>
              <p style="margin:0 0 14px;font-family:Georgia,serif;font-size:16px;
                        color:#d1d5db;line-height:1.65;">
                When <strong style="color:#ffffff;">Lyft launched in 2012</strong>,
                they had <strong style="color:#FBBF24;">fewer than 30.</strong>
              </p>
              <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:16px;
                        color:#ffffff;line-height:1.65;font-weight:600;">
                The drivers who showed up first are the ones who got rich.
              </p>
              <p style="margin:0;font-family:Georgia,serif;font-size:14px;
                        color:#9CA3AF;line-height:1.6;font-style:italic;">
                You're early. The platform is small. Your first 50 rides will be remembered.
              </p>
            </td>
          </tr></table>

          <!-- WHAT YOU GET -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:24px 40px 8px;">
              <p style="margin:0 0 12px;font-family:'Courier New',monospace;font-size:11px;
                        font-weight:700;color:#4ADE80;letter-spacing:2.5px;">
                WHAT YOU GET TONIGHT
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #1f1f1f;">
                    <table cellpadding="0" cellspacing="0" role="presentation"><tr>
                      <td valign="top" style="width:24px;padding-right:10px;">
                        <span style="color:#4ADE80;font-size:18px;line-height:1;">&#8226;</span>
                      </td>
                      <td valign="top">
                        <p style="margin:0;font-family:Georgia,serif;font-size:14px;color:#d1d5db;line-height:1.5;">
                          <strong style="color:#ffffff;">75% of every fare.</strong>
                          You keep more per ride than on any other platform.
                        </p>
                      </td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #1f1f1f;">
                    <table cellpadding="0" cellspacing="0" role="presentation"><tr>
                      <td valign="top" style="width:24px;padding-right:10px;">
                        <span style="color:#4ADE80;font-size:18px;line-height:1;">&#8226;</span>
                      </td>
                      <td valign="top">
                        <p style="margin:0;font-family:Georgia,serif;font-size:14px;color:#d1d5db;line-height:1.5;">
                          <strong style="color:#ffffff;">Cash, card, or Cash App.</strong>
                          Riders pay how they want, you collect at the curb when it's cash.
                        </p>
                      </td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;">
                    <table cellpadding="0" cellspacing="0" role="presentation"><tr>
                      <td valign="top" style="width:24px;padding-right:10px;">
                        <span style="color:#4ADE80;font-size:18px;line-height:1;">&#8226;</span>
                      </td>
                      <td valign="top">
                        <p style="margin:0;font-family:Georgia,serif;font-size:14px;color:#d1d5db;line-height:1.5;">
                          <strong style="color:#ffffff;">Less competition.</strong>
                          Other drivers are asleep or on Uber. The ride is yours.
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
                       style="display:block;background:linear-gradient(135deg,#FBBF24 0%,#F59E0B 60%,#D97706 100%);color:#1A1207;
                              font-family:'Courier New',monospace;font-size:15px;font-weight:800;
                              text-decoration:none;padding:20px 32px;border-radius:12px;
                              letter-spacing:1.5px;text-align:center;
                              box-shadow:0 8px 24px rgba(251,191,36,0.30);">
                      GO ONLINE NOW &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0;font-family:'Courier New',monospace;font-size:11px;
                        color:#6B7280;text-align:center;letter-spacing:0.5px;">
                One tap. Open uatob.com/driver and flip yourself online.
              </p>
            </td>
          </tr></table>

          <!-- BLAST # STRIP -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:14px 40px;background-color:#0d0d0d;border-top:1px solid #1f1f1f;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;
                        color:#374151;letter-spacing:0.5px;">
                DRIVER ALERT &nbsp;<span style="color:#FBBF24;">#${sendCount}</span>
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
            You&apos;re receiving this because you&apos;re an approved UaTob driver.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`.trim();

  let textOnlineLine;
  if (onlineCount === 0)      textOnlineLine = `No drivers are online right now. Whoever flips on first catches every request.`;
  else if (onlineCount === 1) textOnlineLine = `Only 1 driver is online right now. If you go online, you double the supply.`;
  else if (onlineCount < 5)   textOnlineLine = `Only ${onlineCount} drivers are online right now. The next rider request is yours if you flip on.`;
  else                        textOnlineLine = `${onlineCount} drivers are online right now — and the busier we get, the more riders we attract.`;

  const text =
    `Hey ${driver.firstName || "Driver"} — Orlando needs you online.\n\n` +
    `${textOnlineLine}\n\n` +
    `A TRUE STORY:\n` +
    `- When Uber launched in SF in 2010, they had 3 drivers.\n` +
    `- When Lyft launched in 2012, they had fewer than 30.\n` +
    `- The drivers who showed up first are the ones who got rich.\n\n` +
    `You're early. The platform is small. Your first 50 rides will be remembered.\n\n` +
    `WHAT YOU GET TONIGHT:\n` +
    `- 75% of every fare\n` +
    `- Cash, card, or Cash App — riders pay how they want\n` +
    `- Less competition — other drivers are asleep or on Uber\n\n` +
    `Go online: https://uatob.com/driver\n\n` +
    `Driver Alert #${sendCount}\n` +
    `— The UaTob Team`;

  return {
    to:      driver.email,
    from:    "UaTob Team <noreply@uatob.com>",
    replyTo: "support@uatob.com",
    subject: onlineCount === 0
      ? `⚡ No one's online — Orlando is yours tonight`
      : `⚡ Only ${onlineCount} driver${onlineCount === 1 ? "" : "s"} online — Orlando needs you`,
    text,
    html,
  };
}

// ─────────────────────────────────────────────────────────────
// Push notification builder
// ─────────────────────────────────────────────────────────────
function buildOnlinePushMessage({ driver, onlineCount, sendCount }) {
  let title, body;

  if (onlineCount === 0) {
    title = "⚡ Orlando is yours tonight";
    body  = "No drivers are online — every rider request goes to whoever flips on first.";
  } else if (onlineCount === 1) {
    title = `⚡ Only 1 driver online`;
    body  = "Go online and double the supply. Tap to flip on.";
  } else if (onlineCount < 5) {
    title = `⚡ Only ${onlineCount} drivers online`;
    body  = "Riders are waiting. Open UaTob and go online.";
  } else {
    title = `⚡ ${onlineCount} drivers online — join them`;
    body  = "Orlando is busy. Open UaTob and get in on the rides.";
  }

  return {
    token: driver.fcmToken,
    notification: { title, body },
    data: {
      title,
      body,
      type: "driver_recruit",
      sendCount: String(sendCount),
      url: "https://uatob.com/driver",
    },
    webpush: {
      fcmOptions: { link: "https://uatob.com/driver" },
      notification: {
        icon: "https://uatob.com/icon-192.png",
        badge: "https://uatob.com/icon-192.png",
        tag: `online-recruit-${sendCount}`,
        renotify: true,
        requireInteraction: false,
      },
    },
    android: {
      priority: "high",
      notification: { channelId: "driver_recruit", priority: "high" },
    },
    apns: {
      payload: {
        aps: { sound: "default", badge: 1 },
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Helper — strip dead FCM tokens after send errors
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
    console.log(`[announceOnlineDrivers] Dead FCM token cleared for ${driverUid} (${errCode})`);
  } catch (err) {
    console.error(`[announceOnlineDrivers] Failed to clear dead token for ${driverUid}:`, err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// Scheduled Cloud Function
// ─────────────────────────────────────────────────────────────
exports.announceOnlineDrivers = onSchedule(
  {
    schedule: "every 1 minutes",
    region:   "us-east1",
    secrets:  [SENDGRID_API_KEY],
  },
  async () => {
    sgMail.setApiKey(SENDGRID_API_KEY.value());

    // ── 1. Read state ────────────────────────────────────────
    const stateSnap = await STATE_REF.get();
    const state = stateSnap.exists ? stateSnap.data() : {};

    const sendCount        = state.sendCount        ?? 1;
    const lastBlastedCount = state.lastBlastedCount ?? null;
    const todayStr         = new Date().toISOString().slice(0, 10);

    // ── 2. First-run initialization ─────────────────────────
    if (!stateSnap.exists) {
      await STATE_REF.set({
        sendCount:         1,
        lastBlastedCount:  1,
        initialBlastDone:  true,
        nextBlastDate:     todayStr,
        initializedAt:     admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log("[announceOnlineDrivers] State doc initialized. Awaiting admin to increment sendCount.");
      return;
    }

    // ── 3. Decide whether to run ────────────────────────────
    if (lastBlastedCount !== null && sendCount <= lastBlastedCount) {
      console.log(
        `[announceOnlineDrivers] sendCount (${sendCount}) <= lastBlastedCount (${lastBlastedCount}). Skipping.`
      );
      return;
    }

    console.log(
      `[announceOnlineDrivers] sendCount ${sendCount} > lastBlastedCount ${lastBlastedCount}. Blasting.`
    );

    // ── 4. Pull all drivers, bucket by status ───────────────
    const driversSnap = await db.collection("Drivers").get();
    const targets = [];
    let onlineCount = 0;

    driversSnap.docs.forEach((doc) => {
      const data   = doc.data();
      const status = (data.status || "").toLowerCase();
      if (status === "online") {
        onlineCount++;
        return; // online drivers don't need recruiting
      }
      if ((status === "approved" || status === "offline") && data.email) {
        targets.push({ uid: doc.id, ...data });
      }
    });

    console.log(
      `[announceOnlineDrivers] Online now: ${onlineCount}. Recruit targets: ${targets.length}.`
    );

    if (targets.length === 0) {
      await STATE_REF.set(
        {
          lastBlastedCount:   sendCount,
          lastBlastAt:        admin.firestore.FieldValue.serverTimestamp(),
          lastOnlineCount:    onlineCount,
          lastTargetCount:    0,
          lastEmailSuccess:   0,
          lastEmailFailed:    0,
          lastPushSuccess:    0,
          lastPushFailed:     0,
          lastBlastedDrivers: [],
          nextBlastDate:      todayStr,
        },
        { merge: true }
      );
      console.log("[announceOnlineDrivers] No targets. State updated.");
      return;
    }

    // ── 5. Send emails ──────────────────────────────────────
    const emailResults = await Promise.allSettled(
      targets.map((driver) =>
        sgMail.send(buildOnlineRecruitEmail({ driver, onlineCount, sendCount }))
      )
    );

    // Build UID array from every driver successfully emailed this blast
    const lastBlastedDrivers = [];
    let emailSent   = 0;
    let emailFailed = 0;

    emailResults.forEach((r, i) => {
      if (r.status === "fulfilled") {
        emailSent++;
        lastBlastedDrivers.push(targets[i].uid);  // ← record UID on success
      } else {
        emailFailed++;
        console.error(
          `[announceOnlineDrivers] Email failed for ${targets[i]?.email}:`,
          r.reason?.message
        );
      }
    });

    // ── 6. Send FCM push (drivers without fcmToken are silently skipped) ──
    const pushTargets = targets.filter((d) => !!d.fcmToken);

    let pushSent   = 0;
    let pushFailed = 0;

    if (pushTargets.length > 0) {
      const messaging  = admin.messaging();
      const pushResults = await Promise.allSettled(
        pushTargets.map((driver) =>
          messaging.send(buildOnlinePushMessage({ driver, onlineCount, sendCount }))
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
            `[announceOnlineDrivers] Push failed for ${driver.uid}:`,
            errCode || r.reason?.message
          );
          if (errCode && DEAD_TOKEN_CODES.has(errCode)) {
            handleDeadToken(driver.uid, errCode);
          }
        }
      });
    }

    // ── 7. Persist state ────────────────────────────────────
    await STATE_REF.set(
      {
        lastBlastedCount:   sendCount,
        lastBlastAt:        admin.firestore.FieldValue.serverTimestamp(),
        lastOnlineCount:    onlineCount,
        lastTargetCount:    targets.length,
        lastEmailSuccess:   emailSent,
        lastEmailFailed:    emailFailed,
        lastPushSuccess:    pushSent,
        lastPushFailed:     pushFailed,
        lastBlastedDrivers,           // ← array of UIDs emailed this blast
        nextBlastDate:      todayStr,
      },
      { merge: true }
    );

    console.log(
      `[announceOnlineDrivers] Blast #${sendCount} done | ` +
      `Email: ${emailSent} sent, ${emailFailed} failed | ` +
      `Push: ${pushSent} sent, ${pushFailed} failed | ` +
      `Online: ${onlineCount} | Targets: ${targets.length} | ` +
      `Blasted UIDs (${lastBlastedDrivers.length}): [${lastBlastedDrivers.join(", ")}]`
    );
  }
);
