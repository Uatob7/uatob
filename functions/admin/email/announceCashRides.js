// announceCashRides.js
// Scheduled Cloud Function — runs every minute until all approved drivers have been emailed.
// After initial blast, re-runs on a random day each week to catch new drivers.
// Tracks state in Firestore: Admin/announcements

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");

const ANNOUNCE_REF = db.collection("Admin").doc("announcements");

// ─────────────────────────────────────────────────────────────
// Brand SVGs
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
    <linearGradient id="ericar" x1="0" y1="1" x2="1" y2="1">
      <stop offset="0%" stop-color="#16A34A"/>
      <stop offset="100%" stop-color="#15803D"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#eribg)"/>
  <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" stroke="#E5E7EB" stroke-width="1"/>
  <path d="M 10 42 Q 32 24 54 42" stroke="url(#eriroad)" stroke-width="2.5"
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
// Email builder — updated for 100% cash, future deduction model
// ─────────────────────────────────────────────────────────────
function buildCashAnnouncementEmail({ driver, sendCount }) {
  const firstName = String(driver.firstName || "Driver")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const year = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Cash Rides Now Live — UaTob</title>
  <style type="text/css">
    body, html {
      -webkit-text-size-adjust: 100% !important;
      -ms-text-size-adjust: 100% !important;
      margin: 0 !important; padding: 0 !important;
      background-color: #0a0a0a !important;
    }
    @media only screen and (max-width: 600px) {
      .hero-title { font-size: 28px !important; }
      .step-td    { display: block !important; width: 100% !important;
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
                           color:#4ADE80;background-color:#052e16;padding:4px 9px;
                           border-radius:100px;letter-spacing:1.5px;
                           border:1px solid #166534;display:inline-block;">NEW FEATURE</span>
            </td>
          </tr></table>
        </td>
      </tr>

      <!-- MAIN CARD -->
      <tr>
        <td style="background-color:#111111;border-radius:20px;
                   border:1px solid #1f1f1f;overflow:hidden;">

          <!-- HERO BANNER -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="background:linear-gradient(135deg,#052e16 0%,#14532d 50%,#166534 100%);
                       padding:44px 36px 36px;">
              <div style="display:inline-block;background-color:rgba(74,222,128,0.15);
                          border:1.5px solid #4ADE80;border-radius:100px;
                          padding:5px 14px;margin-bottom:20px;">
                <span style="font-family:'Courier New',monospace;font-size:10px;
                             font-weight:700;color:#4ADE80;letter-spacing:2px;">
                  &#9679;&nbsp; PLATFORM UPDATE
                </span>
              </div>
              <h1 class="hero-title"
                  style="margin:0 0 10px;font-family:Georgia,serif;font-size:38px;
                         font-weight:700;color:#ffffff;line-height:1.15;letter-spacing:-1px;">
                Cash Rides<br/>
                <span style="color:#4ADE80;">Are Now Live.</span>
              </h1>
              <p style="margin:0;font-family:'Courier New',monospace;font-size:13px;
                        color:#BBF7D0;letter-spacing:0.3px;line-height:1.6;">
                Hey ${firstName} &mdash; riders can now book and pay in cash.<br/>
                You keep <strong>100% of every cash fare</strong> collected at pickup.<br/>
                UaTob&apos;s platform fee is settled automatically from your card ride earnings.
              </p>
            </td>
          </tr></table>

          <!-- SPLIT CALLOUT -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td align="center" style="padding:36px 36px 28px;border-bottom:1px solid #1f1f1f;">
              <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:11px;
                        font-weight:700;color:#4ADE80;letter-spacing:2.5px;">CASH FARE SPLIT</p>
              <p style="margin:0;font-family:Georgia,serif;font-size:58px;font-weight:700;
                        color:#ffffff;line-height:1;letter-spacing:-2px;">100%</p>
              <p style="margin:8px 0 0;font-family:'Courier New',monospace;font-size:12px;
                        color:#6B7280;letter-spacing:0.5px;">
                you collect the full amount &nbsp;&#183;&nbsp;
                <span style="color:#4ADE80;">platform fee auto-deducted from card/Cash App rides</span>
              </p>
            </td>
          </tr></table>

          <!-- HOW IT WORKS HEADER -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:28px 36px 20px;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;
                        font-weight:700;color:#4ADE80;letter-spacing:2px;">HOW IT WORKS</p>
            </td>
          </tr></table>

          <!-- 3 STEPS -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td width="33%" align="center" class="step-td"
                style="padding:20px 16px 28px;border-right:1px solid #1f1f1f;vertical-align:top;">
              <div style="width:44px;height:44px;border-radius:50%;background-color:#052e16;
                          border:2px solid #166534;text-align:center;line-height:44px;
                          font-family:Georgia,serif;font-size:20px;font-weight:700;
                          color:#4ADE80;margin:0 auto 14px;">1</div>
              <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:10px;
                        font-weight:700;color:#4ADE80;letter-spacing:1.5px;">RIDE REQUEST</p>
              <p style="margin:0;font-family:Georgia,serif;font-size:14px;
                        color:#d1d5db;line-height:1.5;">
                A cash ride pops up in your app just like any other request.
              </p>
            </td>
            <td width="33%" align="center" class="step-td"
                style="padding:20px 16px 28px;border-right:1px solid #1f1f1f;vertical-align:top;">
              <div style="width:44px;height:44px;border-radius:50%;background-color:#052e16;
                          border:2px solid #166534;text-align:center;line-height:44px;
                          font-family:Georgia,serif;font-size:20px;font-weight:700;
                          color:#4ADE80;margin:0 auto 14px;">2</div>
              <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:10px;
                        font-weight:700;color:#4ADE80;letter-spacing:1.5px;">COLLECT CASH</p>
              <p style="margin:0;font-family:Georgia,serif;font-size:14px;
                        color:#d1d5db;line-height:1.5;">
                The app shows the exact fare. Collect the full amount from the rider at pickup.
              </p>
            </td>
            <td width="33%" align="center" class="step-td"
                style="padding:20px 16px 28px;vertical-align:top;">
              <div style="width:44px;height:44px;border-radius:50%;background-color:#052e16;
                          border:2px solid #166534;text-align:center;line-height:44px;
                          font-family:Georgia,serif;font-size:20px;font-weight:700;
                          color:#4ADE80;margin:0 auto 14px;">3</div>
              <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:10px;
                        font-weight:700;color:#4ADE80;letter-spacing:1.5px;">KEEP IT ALL</p>
              <p style="margin:0;font-family:Georgia,serif;font-size:14px;
                        color:#d1d5db;line-height:1.5;">
                100% yours immediately. UaTob&apos;s cut is handled through your other ride earnings.
              </p>
            </td>
          </tr></table>

          <!-- FEE MODEL CALLOUT -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:0 36px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
                <td style="background-color:#0d1117;border:1.5px solid #1e3a5f;
                           border-radius:14px;padding:18px 22px;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
                    <td width="40" valign="middle" style="padding-right:14px;">
                      <div style="width:38px;height:38px;border-radius:50%;
                                  background-color:#1e3a5f;text-align:center;line-height:38px;
                                  font-family:'Courier New',monospace;font-size:18px;
                                  font-weight:900;color:#60A5FA;">&#128274;</div>
                    </td>
                    <td valign="middle">
                      <p style="margin:0 0 3px;font-family:'Courier New',monospace;font-size:11px;
                                font-weight:700;color:#60A5FA;letter-spacing:1.5px;">
                        HOW THE PLATFORM FEE WORKS
                      </p>
                      <p style="margin:0;font-family:Georgia,serif;font-size:14px;
                                color:#d1d5db;line-height:1.6;">
                        You keep <strong style="color:#ffffff;">100% of every cash fare</strong> at pickup.
                        UaTob&apos;s platform fee for cash rides will be automatically deducted
                        from your <span style="color:#4ADE80;">card ride</span> and
                        <span style="color:#4ADE80;">Cash App ride</span> payouts on a rolling basis —
                        so there&apos;s no out-of-pocket cost and no manual transfers.
                      </p>
                    </td>
                  </tr></table>
                </td>
              </tr></table>
            </td>
          </tr></table>

          <!-- CASH BADGE CALLOUT -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:0 36px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
                <td style="background-color:#0d1f0d;border:1.5px solid #166534;
                           border-radius:14px;padding:18px 22px;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
                    <td width="40" valign="middle" style="padding-right:14px;">
                      <div style="width:38px;height:38px;border-radius:50%;
                                  background-color:#166534;text-align:center;line-height:38px;
                                  font-family:'Courier New',monospace;font-size:22px;
                                  font-weight:900;color:#4ADE80;">$</div>
                    </td>
                    <td valign="middle">
                      <p style="margin:0 0 3px;font-family:'Courier New',monospace;font-size:11px;
                                font-weight:700;color:#4ADE80;letter-spacing:1.5px;">
                        LOOK FOR THE CASH BADGE
                      </p>
                      <p style="margin:0;font-family:Georgia,serif;font-size:14px;
                                color:#d1d5db;line-height:1.5;">
                        Cash ride requests are clearly marked with a
                        <span style="color:#FBBF24;font-weight:700;">CASH</span> label
                        so you always know what you&apos;re accepting before you confirm.
                      </p>
                    </td>
                  </tr></table>
                </td>
              </tr></table>
            </td>
          </tr></table>

          <!-- IMPORTANT NOTE -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:24px 36px;border-top:1px solid #1f1f1f;">
              <p style="margin:0 0 10px;font-family:'Courier New',monospace;font-size:11px;
                        font-weight:700;color:#FBBF24;letter-spacing:2px;">
                &#9888;&nbsp; IMPORTANT
              </p>
              <p style="margin:0;font-family:Georgia,serif;font-size:14px;
                        color:#9ca3af;line-height:1.7;">
                Always collect the <strong style="color:#ffffff;">full fare shown in the app</strong>
                before starting the trip. If a rider won&apos;t pay upfront, you are not required to
                accept the ride. Your safety and earnings come first.
              </p>
            </td>
          </tr></table>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:8px 36px 36px;border-top:1px solid #1f1f1f;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-top:24px;"><tr>
                <td align="center">
                  <a href="https://uatob.com/driver/app" class="cta-btn"
                     style="display:block;background-color:#16A34A;color:#ffffff;
                            font-family:'Courier New',monospace;font-size:15px;font-weight:700;
                            text-decoration:none;padding:20px 32px;border-radius:12px;
                            letter-spacing:1px;text-align:center;border:1px solid #4ADE80;">
                    OPEN THE DRIVER APP &#8594;
                  </a>
                </td>
              </tr></table>
              <p style="margin:16px 0 0;font-family:'Courier New',monospace;font-size:11px;
                        color:#374151;text-align:center;letter-spacing:0.5px;">
                Go online now and start accepting cash rides
              </p>
            </td>
          </tr></table>

          <!-- SEND COUNT STRIP -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:16px 36px;background-color:#0d0d0d;border-top:1px solid #1f1f1f;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;
                        color:#374151;letter-spacing:0.5px;">
                ANNOUNCEMENT &nbsp;<span style="color:#4ADE80;">BLAST #${sendCount}</span>
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
            &#169; ${year} UaTob &nbsp;&#183;&nbsp; Orlando, FL
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
    `Hey ${driver.firstName || "Driver"} — UaTob now accepts cash from riders.\n\n` +
    `What this means for you:\n` +
    `- Cash ride requests show up in your app just like card rides\n` +
    `- Collect the full fare shown in the app from the rider at pickup\n` +
    `- Keep 100% of every cash fare — no split at pickup\n` +
    `- UaTob's platform fee is auto-deducted from your card & Cash App ride payouts\n` +
    `- Cash rides are clearly labeled so you always know before accepting\n\n` +
    `Important: Always collect the full fare before starting the trip.\n\n` +
    `Open the driver app: https://uatob.com/driver/app\n\n` +
    `Announcement Blast #${sendCount}\n\n` +
    `— The UaTob Team`;

  return {
    to:      driver.email,
    from:    "UaTob Team <noreply@uatob.com>",
    replyTo: "support@uatob.com",
    subject: "💵 New: Riders can now pay cash — you keep 100% at pickup",
    text,
    html,
  };
}

// ─────────────────────────────────────────────────────────────
// Scheduled Cloud Function
// Runs every minute.
// Logic:
//   Phase 1 — Initial blast not done yet:
//     Email all drivers who haven't been emailed yet (batched via emailedUids set).
//     When all current drivers are covered, mark initialBlastDone = true
//     and schedule the next random re-blast date (random day, 7–21 days out).
//
//   Phase 2 — Initial blast done:
//     Do nothing until today >= nextBlastDate.
//     On that day, email any driver not in emailedUids (new drivers since last blast).
//     Then set a new nextBlastDate (random, 7–21 days out).
// ─────────────────────────────────────────────────────────────
exports.announceCashRides = onSchedule(
  {
    schedule: "every 1 minutes",
    region:   "us-east1",
    secrets:  [SENDGRID_API_KEY],
  },
  async () => {
    sgMail.setApiKey(SENDGRID_API_KEY.value());

    // ── 1. Read current announcement state ────────────────────
    const announceSnap = await ANNOUNCE_REF.get();
    const state = announceSnap.exists ? announceSnap.data() : {};

    const initialBlastDone = state.initialBlastDone ?? false;
    const emailedUids      = new Set(state.emailedUids ?? []);
    const sendCount        = state.cashRidesSentCount ?? 0;
    const nextBlastDate    = state.nextBlastDate ?? null; // "YYYY-MM-DD"

    const todayStr = new Date().toISOString().slice(0, 10);

    // ── 2. Decide whether to run ──────────────────────────────
    if (initialBlastDone) {
      // Phase 2: only run on or after the scheduled re-blast date
      if (!nextBlastDate || todayStr < nextBlastDate) {
        console.log(
          `[announceCashRides] Initial blast done. Next blast: ${nextBlastDate || "not set"}. Skipping.`
        );
        return;
      }
      console.log(`[announceCashRides] Re-blast day reached (${todayStr}). Running.`);
    } else {
      console.log("[announceCashRides] Initial blast in progress.");
    }

    // ── 3. Pull all drivers with an email ─────────────────────
    const driversSnap = await db.collection("Drivers").get();
    const allDrivers  = driversSnap.docs
      .map((doc) => ({ uid: doc.id, ...doc.data() }))
      .filter((d) => !!d.email);

    // ── 4. Filter to only un-emailed drivers ──────────────────
    const targets = allDrivers.filter((d) => !emailedUids.has(d.uid));

    if (targets.length === 0) {
      console.log("[announceCashRides] No new drivers to email.");

      if (!initialBlastDone) {
        // All existing drivers already covered — mark blast done
        const nextDate = randomFutureDate(7, 21);
        await ANNOUNCE_REF.set(
          {
            initialBlastDone: true,
            nextBlastDate:    nextDate,
            cashRidesSentCount: sendCount,
          },
          { merge: true }
        );
        console.log(
          `[announceCashRides] Initial blast complete. Next re-blast: ${nextDate}`
        );
      } else {
        // Re-blast: no new drivers, schedule next anyway
        const nextDate = randomFutureDate(7, 21);
        await ANNOUNCE_REF.set({ nextBlastDate: nextDate }, { merge: true });
        console.log(`[announceCashRides] No new drivers. Next re-blast: ${nextDate}`);
      }
      return;
    }

    const newCount = sendCount + 1;
    console.log(
      `[announceCashRides] Blast #${newCount} — emailing ${targets.length} driver(s)`
    );

    // ── 5. Send emails ────────────────────────────────────────
    const results = await Promise.allSettled(
      targets.map((driver) =>
        sgMail.send(buildCashAnnouncementEmail({ driver, sendCount: newCount }))
      )
    );

    const sent   = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(
          `[announceCashRides] Failed for ${targets[i]?.email}:`,
          r.reason?.message
        );
      }
    });

    // ── 6. Update state ───────────────────────────────────────
    // Only add successfully emailed UIDs to the set
    const newlyEmailed = targets
      .filter((_, i) => results[i].status === "fulfilled")
      .map((d) => d.uid);

    const updatedUids = [...emailedUids, ...newlyEmailed];

    // Check if all drivers are now covered
    const allUids        = allDrivers.map((d) => d.uid);
    const allCovered     = allUids.every((uid) => updatedUids.includes(uid));
    const blastNowDone   = initialBlastDone || allCovered;
    const nextDate       = blastNowDone ? randomFutureDate(7, 21) : (nextBlastDate ?? null);

    await ANNOUNCE_REF.set(
      {
        cashRidesSentCount:          newCount,
        cashRidesLastSentAt:         admin.firestore.FieldValue.serverTimestamp(),
        cashRidesLastSentDriverCount: targets.length,
        cashRidesLastSentSuccess:    sent,
        cashRidesLastSentFailed:     failed,
        emailedUids:                 updatedUids,
        initialBlastDone:            blastNowDone,
        ...(nextDate ? { nextBlastDate: nextDate } : {}),
      },
      { merge: true }
    );

    console.log(
      `[announceCashRides] Blast #${newCount} done | ${sent} sent, ${failed} failed` +
      (blastNowDone ? ` | All drivers covered. Next re-blast: ${nextDate}` : " | More drivers pending.")
    );
  }
);

// ─────────────────────────────────────────────────────────────
// Helper — random date between minDays and maxDays from today
// ─────────────────────────────────────────────────────────────
function randomFutureDate(minDays, maxDays) {
  const days = Math.floor(Math.random() * (maxDays - minDays + 1)) + minDays;
  const d    = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}