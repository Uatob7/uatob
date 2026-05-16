// thankYouAnnouncement.js
// Scheduled Cloud Function — sends a thank-you + "spread the word" email
// to all approved/online/offline drivers.
//
// HOW IT WORKS (smart, two-mode):
//
//   MODE A — Initial blast (one-time, runs immediately):
//     If Admin/thankYouAnnouncement.initialBlastDone is missing or false,
//     ignore the working-hours gate and email every eligible driver in
//     batches of BATCH_SIZE until everyone is covered, then flip
//     initialBlastDone = true.
//
//   MODE B — Growth re-blasts (automatic, working hours only):
//     Once initial blast is done, the function watches your driver pool.
//     When ≥GROWTH_THRESHOLD eligible drivers haven't received the email
//     for this version, it fires another batch (within 9 AM – 7 PM ET).
//     Smaller-than-threshold pending counts wait until enough new drivers
//     accumulate.
//
//   MANUAL RE-BLAST (to everyone):
//     Bump ANNOUNCEMENT_VERSION below and redeploy. Every eligible driver
//     gets the email again. Works in any mode.
//
// State per driver: Drivers/{uid}.thankYouEmailVersion (number)
// State global:     Admin/thankYouAnnouncement (initialBlastDone, stats)

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");

// ─────────────────────────────────────────────────────────────
// VERSION CONTROL — bump this number to trigger a re-blast to
// every eligible driver, regardless of growth threshold.
// ─────────────────────────────────────────────────────────────
const ANNOUNCEMENT_VERSION = 1;

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────
const ELIGIBLE_STATUSES   = ["approved", "online", "offline"];
const BATCH_SIZE          = 25;     // emails per run
const SEND_HOUR_START     = 9;      // 9 AM ET (growth re-blasts only)
const SEND_HOUR_END       = 19;     // 7 PM ET (growth re-blasts only)
const GROWTH_THRESHOLD    = 5;      // re-blast when this many new drivers are pending
const STATS_REF           = db.collection("Admin").doc("thankYouAnnouncement");

// ─────────────────────────────────────────────────────────────
// Brand SVGs
// ─────────────────────────────────────────────────────────────
const UATOB_ICON_SVG = `
<svg width="46" height="46" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="tybg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F3F4F6"/>
    </linearGradient>
    <linearGradient id="tyroad" x1="0" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#16A34A"/>
    </linearGradient>
    <linearGradient id="tycar" x1="0" y1="1" x2="1" y2="1">
      <stop offset="0%" stop-color="#16A34A"/>
      <stop offset="100%" stop-color="#15803D"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#tybg)"/>
  <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" stroke="#E5E7EB" stroke-width="1"/>
  <path d="M 10 42 Q 32 24 54 42" stroke="url(#tyroad)" stroke-width="2.5"
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
    <rect x="1" y="5" width="10" height="6" rx="1.5" fill="url(#tycar)"/>
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
function buildThankYouEmail({ driver }) {
  const firstName = String(driver.firstName || "Driver")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const year = new Date().getFullYear();

  const shareText = encodeURIComponent(
    "Need a ride in Orlando? Check out UaTob — no app to download, " +
    "book straight from your browser at uatob.com 🚗"
  );
  const shareUrl  = encodeURIComponent("https://uatob.com");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Thank You for Joining UaTob</title>
  <style type="text/css">
    body, html {
      -webkit-text-size-adjust: 100% !important;
      -ms-text-size-adjust: 100% !important;
      margin: 0 !important; padding: 0 !important;
      background-color: #0a0a0a !important;
    }
    @media only screen and (max-width: 600px) {
      .hero-title  { font-size: 26px !important; }
      .share-td    { display: block !important; width: 100% !important;
                     border-right: none !important;
                     border-bottom: 1px solid #1f1f1f !important; }
      .cta-btn     { font-size: 14px !important; padding: 16px 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="background-color:#0a0a0a;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" role="presentation"
           style="max-width:600px;width:100%;">

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
          </tr></table>
        </td>
      </tr>

      <tr>
        <td style="background-color:#111111;border-radius:20px;
                   border:1px solid #1f1f1f;overflow:hidden;">

          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="background:linear-gradient(135deg,#052e16 0%,#14532d 55%,#166534 100%);
                       padding:48px 40px 40px;">
              <p style="margin:0 0 12px;font-family:'Courier New',monospace;font-size:11px;
                        font-weight:700;color:#4ADE80;letter-spacing:2.5px;">
                A NOTE FROM THE FOUNDER
              </p>
              <h1 class="hero-title"
                  style="margin:0 0 16px;font-family:Georgia,serif;font-size:36px;
                         font-weight:700;color:#ffffff;line-height:1.2;letter-spacing:-1px;">
                Thank you, ${firstName}.
              </h1>
              <p style="margin:0;font-family:Georgia,serif;font-size:16px;
                        color:#BBF7D0;line-height:1.65;">
                For signing up to drive with UaTob. We&apos;re just one month old,
                and you are part of the reason this thing is actually moving.
              </p>
            </td>
          </tr></table>

          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:36px 40px 8px;">
              <p style="margin:0 0 18px;font-family:Georgia,serif;font-size:15px;
                        color:#d1d5db;line-height:1.7;">
                Your driver dashboard is always one click away &mdash; you can
                sign in anytime at
                <a href="https://uatob.com/driver"
                   style="color:#4ADE80;text-decoration:underline;font-weight:600;">uatob.com/driver</a>.
                Go online whenever you&apos;re ready. We work in the background to find you rides.
              </p>
              <p style="margin:0 0 18px;font-family:Georgia,serif;font-size:15px;
                        color:#d1d5db;line-height:1.7;">
                Here&apos;s the truth: UaTob only works if riders know we exist.
                The more people who hear about us, the more rides come in for you.
                That&apos;s where we need your help.
              </p>
            </td>
          </tr></table>

          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:16px 40px 4px;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;
                        font-weight:700;color:#4ADE80;letter-spacing:2.5px;">
                HELP US SPREAD THE WORD
              </p>
            </td>
          </tr></table>

          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:8px 40px 24px;">
              <p style="margin:0;font-family:Georgia,serif;font-size:15px;
                        color:#d1d5db;line-height:1.7;">
                Anyone in Orlando can request a ride with UaTob. No app to download
                &mdash; they just open
                <span style="color:#4ADE80;font-weight:700;">uatob.com</span>
                in their phone&apos;s browser. They can pay with card, Cash App,
                or just pay you directly in cash at pickup.
              </p>
              <p style="margin:14px 0 0;font-family:Georgia,serif;font-size:15px;
                        color:#d1d5db;line-height:1.7;">
                Tell your friends. Post in your group chats. Share to your
                Instagram story. Every person you tell is potentially your next ride.
              </p>
            </td>
          </tr></table>

          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
                <td width="33%" align="center" class="share-td"
                    style="padding:14px 10px;background-color:#0d0d0d;
                           border:1px solid #1f1f1f;border-radius:10px 0 0 10px;
                           border-right:1px solid #1f1f1f;">
                  <a href="https://wa.me/?text=${shareText}"
                     style="display:block;font-family:'Courier New',monospace;font-size:11px;
                            font-weight:700;color:#4ADE80;letter-spacing:1px;
                            text-decoration:none;">
                    &#128241; WHATSAPP
                  </a>
                </td>
                <td width="33%" align="center" class="share-td"
                    style="padding:14px 10px;background-color:#0d0d0d;
                           border-top:1px solid #1f1f1f;
                           border-bottom:1px solid #1f1f1f;
                           border-right:1px solid #1f1f1f;">
                  <a href="sms:?body=${shareText}"
                     style="display:block;font-family:'Courier New',monospace;font-size:11px;
                            font-weight:700;color:#4ADE80;letter-spacing:1px;
                            text-decoration:none;">
                    &#128172; TEXT
                  </a>
                </td>
                <td width="33%" align="center" class="share-td"
                    style="padding:14px 10px;background-color:#0d0d0d;
                           border:1px solid #1f1f1f;border-radius:0 10px 10px 0;">
                  <a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}"
                     style="display:block;font-family:'Courier New',monospace;font-size:11px;
                            font-weight:700;color:#4ADE80;letter-spacing:1px;
                            text-decoration:none;">
                    &#127760; FACEBOOK
                  </a>
                </td>
              </tr></table>
            </td>
          </tr></table>

          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:0 40px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
                <td style="background-color:#0d1f12;border:1.5px solid #166534;
                           border-radius:14px;padding:24px 26px;">
                  <p style="margin:0 0 10px;font-family:'Courier New',monospace;font-size:11px;
                            font-weight:700;color:#4ADE80;letter-spacing:1.5px;">
                    &#9889; PRO MOVE
                  </p>
                  <p style="margin:0;font-family:Georgia,serif;font-size:15px;
                            color:#d1d5db;line-height:1.7;">
                    Stay online even when it&apos;s quiet. We&apos;re actively pushing
                    UaTob across Orlando every single day. A ride request can come in
                    at any time, and the drivers who are online are the ones who get them.
                  </p>
                </td>
              </tr></table>
            </td>
          </tr></table>

          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:8px 40px 40px;border-top:1px solid #1f1f1f;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-top:24px;"><tr>
                <td align="center">
                  <a href="https://uatob.com/driver" class="cta-btn"
                     style="display:block;background-color:#16A34A;color:#ffffff;
                            font-family:'Courier New',monospace;font-size:15px;font-weight:700;
                            text-decoration:none;padding:20px 32px;border-radius:12px;
                            letter-spacing:1px;text-align:center;border:1px solid #4ADE80;">
                    GO ONLINE NOW &rarr;
                  </a>
                </td>
              </tr></table>
              <p style="margin:16px 0 0;font-family:'Courier New',monospace;font-size:11px;
                        color:#374151;text-align:center;letter-spacing:0.5px;">
                Sign in anytime at uatob.com/driver
              </p>
            </td>
          </tr></table>

          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:0 40px 32px;background-color:#0d0d0d;
                       border-top:1px solid #1f1f1f;">
              <p style="margin:24px 0 4px;font-family:Georgia,serif;font-style:italic;
                        font-size:14px;color:#9CA3AF;line-height:1.6;">
                Thanks again for being part of UaTob from the very start.
              </p>
              <p style="margin:0;font-family:Georgia,serif;font-size:14px;
                        color:#ffffff;font-weight:700;">
                &mdash; The UaTob Team
              </p>
            </td>
          </tr></table>

        </td>
      </tr>

      <tr>
        <td align="center" style="padding:28px 20px 0;">
          <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:11px;
                    color:#374151;letter-spacing:0.5px;">
            &copy; ${year} UaTob &nbsp;&middot;&nbsp; Orlando, FL
          </p>
          <p style="margin:0;font-family:'Courier New',monospace;font-size:10px;
                    color:#1f2937;letter-spacing:0.3px;">
            You&apos;re receiving this because you&apos;re a registered UaTob driver.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`.trim();

  const text =
    `Hey ${driver.firstName || "Driver"},\n\n` +
    `Thank you for signing up to drive with UaTob.\n\n` +
    `You can sign in anytime at uatob.com/driver and go online whenever you're ready. ` +
    `We work in the background to find you rides.\n\n` +
    `Here's the truth: UaTob is only one month old, and we need your help spreading the word. ` +
    `The more people who know about UaTob, the more rides come in for you.\n\n` +
    `Anyone in Orlando can request a ride with UaTob — no app to download. ` +
    `They just open uatob.com on their phone. Riders can pay with card, Cash App, ` +
    `or pay you directly in cash at pickup.\n\n` +
    `Tell your friends. Post in your group chats. Share to your story. ` +
    `Every person you tell is potentially your next ride.\n\n` +
    `Pro move: stay online even when it's quiet. We're pushing UaTob hard every single day. ` +
    `When a ride request comes in, the drivers who are online are the ones who get it.\n\n` +
    `Go online now: https://uatob.com/driver\n\n` +
    `Thanks again for being part of UaTob from the start.\n\n` +
    `— The UaTob Team`;

  return {
    to:      driver.email,
    from:    "UaTob Team <noreply@uatob.com>",
    replyTo: "support@uatob.com",
    subject: `Thank you for joining UaTob, ${driver.firstName || "Driver"} — here's how you can help us grow`,
    text,
    html,
  };
}

// ─────────────────────────────────────────────────────────────
// Eastern-time hour check (only used for growth re-blasts)
// ─────────────────────────────────────────────────────────────
function isWithinSendWindow() {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  });
  const h = parseInt(fmt.format(new Date()), 10);
  return h >= SEND_HOUR_START && h < SEND_HOUR_END;
}

// ─────────────────────────────────────────────────────────────
// Scheduled Cloud Function — runs every 15 minutes.
// ─────────────────────────────────────────────────────────────
exports.thankYouAnnouncement = onSchedule(
  {
    schedule: "every 1 minutes",
    region:   "us-central1",
    secrets:  [SENDGRID_API_KEY],
    timeZone: "America/New_York",
  },
  async () => {

    // ── 1. Read state ─────────────────────────────────────────
    const statsSnap         = await STATS_REF.get();
    const stats             = statsSnap.exists ? statsSnap.data() : {};
    const initialBlastDone  = stats.initialBlastDone === true;
    const isInitialBlast    = !initialBlastDone;

    // ── 2. Working-hours gate (skip ONLY for initial blast) ──
    if (!isInitialBlast && !isWithinSendWindow()) {
      console.log(
        `[thankYouAnnouncement] Re-blast mode, outside send window ` +
        `(${SEND_HOUR_START}:00–${SEND_HOUR_END}:00 ET). Skipping.`
      );
      return;
    }

    sgMail.setApiKey(SENDGRID_API_KEY.value());

    // ── 3. Pull all eligible drivers ─────────────────────────
    let driversSnap;
    try {
      driversSnap = await db
        .collection("Drivers")
        .where("status", "in", ELIGIBLE_STATUSES)
        .get();
    } catch (err) {
      console.error("[thankYouAnnouncement] Drivers query failed:", err);
      return;
    }

    // Filter + dedupe by email
    const seenEmails = new Set();
    const eligible = [];

    for (const doc of driversSnap.docs) {
      const d = { uid: doc.id, ...doc.data() };
      const email = (d.email ?? "").toLowerCase().trim();

      if (!email)                                                  continue;
      if (seenEmails.has(email))                                   continue;
      if (d.marketingOptIn === false)                              continue;
      if ((d.thankYouEmailVersion ?? 0) === ANNOUNCEMENT_VERSION)  continue;

      seenEmails.add(email);
      eligible.push(d);
    }

    // ── 4. Decide whether to act ─────────────────────────────
    if (eligible.length === 0) {
      console.log(
        `[thankYouAnnouncement] v${ANNOUNCEMENT_VERSION} — nobody pending. All caught up.`
      );

      // If initial blast wasn't marked done, mark it now (everyone is covered)
      if (isInitialBlast) {
        await STATS_REF.set(
          {
            currentVersion:   ANNOUNCEMENT_VERSION,
            initialBlastDone: true,
            initialBlastDoneAt: admin.firestore.FieldValue.serverTimestamp(),
            lastCheckedAt:    admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        console.log(`[thankYouAnnouncement] Initial blast complete. Switching to growth mode.`);
      } else {
        await STATS_REF.set(
          {
            currentVersion: ANNOUNCEMENT_VERSION,
            lastCheckedAt:  admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
      return;
    }

    // In growth-mode, only fire if enough new drivers have accumulated.
    // Initial blast ignores the threshold — send to everyone immediately.
    if (!isInitialBlast && eligible.length < GROWTH_THRESHOLD) {
      console.log(
        `[thankYouAnnouncement] Growth mode: ${eligible.length} pending < ` +
        `threshold ${GROWTH_THRESHOLD}. Waiting for more drivers.`
      );
      await STATS_REF.set(
        {
          currentVersion:      ANNOUNCEMENT_VERSION,
          pendingForNextBlast: eligible.length,
          lastCheckedAt:       admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }

    // ── 5. Take a batch ──────────────────────────────────────
    const targets = eligible.slice(0, BATCH_SIZE);
    console.log(
      `[thankYouAnnouncement] ${isInitialBlast ? "INITIAL" : "GROWTH"} blast ` +
      `v${ANNOUNCEMENT_VERSION} — sending to ${targets.length} of ${eligible.length} pending`
    );

    // ── 6. Send emails ───────────────────────────────────────
    const results = await Promise.allSettled(
      targets.map((driver) => sgMail.send(buildThankYouEmail({ driver })))
    );

    const sent   = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(
          `[thankYouAnnouncement] Failed for ${targets[i]?.email}:`,
          r.reason?.message
        );
      }
    });

    // ── 7. Stamp each successfully-emailed driver ───────────
    const batch = db.batch();
    let stamps = 0;

    targets.forEach((driver, i) => {
      if (results[i].status === "fulfilled") {
        batch.update(db.collection("Drivers").doc(driver.uid), {
          thankYouEmailVersion: ANNOUNCEMENT_VERSION,
          thankYouEmailSentAt:  admin.firestore.FieldValue.serverTimestamp(),
        });
        stamps++;
      }
    });

    try {
      if (stamps > 0) await batch.commit();
    } catch (err) {
      console.error("[thankYouAnnouncement] Driver-doc stamp batch failed:", err);
    }

    // ── 8. Update stats doc ──────────────────────────────────
    // If this batch finished off the eligible list AND we were in initial-blast
    // mode, flip initialBlastDone.
    const remaining        = Math.max(0, eligible.length - sent);
    const justFinishedInit = isInitialBlast && remaining === 0;

    try {
      await STATS_REF.set(
        {
          currentVersion:        ANNOUNCEMENT_VERSION,
          lastSentAt:            admin.firestore.FieldValue.serverTimestamp(),
          lastSentCount:         sent,
          lastFailedCount:       failed,
          lastBatchSize:         targets.length,
          lastBlastMode:         isInitialBlast ? "initial" : "growth",
          remainingThisVersion:  remaining,
          totalSentLifetime:     admin.firestore.FieldValue.increment(sent),
          ...(justFinishedInit
            ? {
                initialBlastDone:    true,
                initialBlastDoneAt:  admin.firestore.FieldValue.serverTimestamp(),
              }
            : {}),
        },
        { merge: true }
      );
    } catch (err) {
      console.error("[thankYouAnnouncement] Stats update failed:", err);
    }

    console.log(
      `[thankYouAnnouncement] ${isInitialBlast ? "INITIAL" : "GROWTH"} ` +
      `v${ANNOUNCEMENT_VERSION} done | ${sent} sent, ${failed} failed | ${remaining} remaining` +
      (justFinishedInit ? " | Initial blast complete." : "")
    );
  }
);