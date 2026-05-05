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

const fmt = {
  currency: (v) => `$${Number(v ?? 0).toFixed(2)}`,
  miles:    (v) => `${Number(v ?? 0).toFixed(1)} mi`,
  duration: (v) => {
    const t = Math.round(Number(v ?? 0));
    const h = Math.floor(t / 60);
    const m = t % 60;
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  },
};

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

const LOCK_SVG = `
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
     style="display:inline-block;vertical-align:middle;margin-right:5px;opacity:0.6;">
  <rect x="3" y="11" width="18" height="11" rx="2" stroke="#6B7280" stroke-width="2"/>
  <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#6B7280" stroke-width="2" stroke-linecap="round"/>
</svg>`.trim();

// ─────────────────────────────────────────────────────────────
// Email builder
// ─────────────────────────────────────────────────────────────
function buildCandidateEmail({ driver, ride, rideId, totalCandidates, minutesRemaining }) {
  const firstName  = esc(driver.firstName || "Driver");
  const safeType   = esc(
    ride.rideLabel ||
    (ride.rideType
      ? ride.rideType.charAt(0).toUpperCase() + ride.rideType.slice(1)
      : "Standard")
  );
  const safeRideId = esc(rideId);
  const payout     = fmt.currency(ride.driverPayout);
  const distance   = fmt.miles(ride.tripDistanceMiles);
  const duration   = fmt.duration(ride.tripDurationMin);
  const year       = new Date().getFullYear();

  const epm =
    Number(ride.tripDistanceMiles) > 0
      ? fmt.currency(Number(ride.driverPayout ?? 0) / Number(ride.tripDistanceMiles))
      : null;

  // ── URGENCY: flip entire hero to red when ≤5 min remaining ──
  const isUrgent    = minutesRemaining !== null && minutesRemaining <= 5;
  const heroBg      = isUrgent
    ? "background:linear-gradient(135deg,#3b0000 0%,#7f1d1d 50%,#991b1b 100%);"
    : "background:linear-gradient(135deg,#052e16 0%,#14532d 50%,#166534 100%);";
  const heroAccent  = isUrgent ? "#fca5a5" : "#86efac";
  const badgeColor  = isUrgent ? "#fca5a5" : "#4ADE80";
  const badgeBg     = isUrgent ? "rgba(252,165,165,0.15)" : "rgba(74,222,128,0.15)";
  const badgeBorder = isUrgent ? "#fca5a5" : "#4ADE80";
  const badgeText   = isUrgent
    ? `&#9888;&nbsp; EXPIRES IN ~${minutesRemaining} MIN`
    : "&#9679;&nbsp; LIVE REQUEST";

  // ── CANDIDATE NOTE ───────────────────────────────────────────
  const candidateNote =
    totalCandidates > 1
      ? `${totalCandidates} drivers notified &nbsp;&middot;&nbsp; <span style="color:#4ADE80;">first to accept wins</span>`
      : `You&apos;re the only driver being notified`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>New Ride — UaTob</title>
  <style type="text/css">
    body, html {
      -webkit-text-size-adjust: 100% !important;
      -ms-text-size-adjust: 100% !important;
      margin: 0 !important; padding: 0 !important;
      background-color: #0a0a0a !important;
    }
    @media only screen and (max-width: 600px) {
      .payout-num { font-size: 52px !important; }
      .stat-val   { font-size: 18px !important; }
      .cta-btn    { font-size: 14px !important; padding: 18px 20px !important; }
      .outer-pad  { padding: 24px 14px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;">

<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="background-color:#0a0a0a;padding:40px 20px;" class="outer-pad">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" role="presentation"
           style="max-width:600px;width:100%;">

      <!-- ══ WORDMARK ══ -->
      <tr>
        <td align="center" style="padding-bottom:24px;">
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
                           border-radius:100px;letter-spacing:1.5px;border:1px solid #166534;
                           display:inline-block;">DISPATCH</span>
            </td>
          </tr></table>
        </td>
      </tr>

      <!-- ══ MAIN CARD ══ -->
      <tr>
        <td style="background-color:#111111;border-radius:20px;
                   border:1px solid #1f1f1f;overflow:hidden;">

          <!-- ── HERO (urgency-aware) ── -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="${heroBg}padding:40px 36px 36px;">
              <div style="display:inline-block;background-color:${badgeBg};
                          border:1.5px solid ${badgeBorder};border-radius:100px;
                          padding:5px 14px;margin-bottom:18px;">
                <span style="font-family:'Courier New',monospace;font-size:10px;
                             font-weight:700;color:${badgeColor};letter-spacing:2px;">
                  ${badgeText}
                </span>
              </div>
              <p style="margin:0 0 4px;font-family:'Courier New',monospace;font-size:12px;
                        color:${heroAccent};letter-spacing:1px;">
                Hey ${firstName} &mdash; a rider needs a driver
              </p>
              <p style="margin:0;font-family:Georgia,serif;font-size:15px;
                        color:${heroAccent};opacity:0.75;line-height:1.5;">
                Accept this ride in the app to see the full route.
              </p>
            </td>
          </tr></table>

          <!-- ── PAYOUT HEADLINE (68px, first visual anchor) ── -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td align="center"
                style="padding:36px 36px 28px;border-bottom:1px solid #1f1f1f;">
              <p style="margin:0 0 4px;font-family:'Courier New',monospace;font-size:11px;
                        font-weight:700;color:#4ADE80;letter-spacing:2.5px;">YOUR PAYOUT</p>
              <p class="payout-num"
                 style="margin:0;font-family:Georgia,serif;font-size:68px;font-weight:700;
                        color:#ffffff;line-height:1;letter-spacing:-3px;">${payout}</p>
              ${epm ? `
              <p style="margin:10px 0 0;font-family:'Courier New',monospace;font-size:12px;
                        color:#6B7280;letter-spacing:0.5px;">
                ${epm}&nbsp;per mile
              </p>` : ""}
            </td>
          </tr></table>

          <!-- ── TRIP STATS ── -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td width="33%" align="center"
                style="padding:22px 12px;border-right:1px solid #1f1f1f;">
              <p style="margin:0 0 5px;font-family:'Courier New',monospace;font-size:10px;
                        font-weight:700;color:#4ADE80;letter-spacing:2px;">DISTANCE</p>
              <p class="stat-val"
                 style="margin:0;font-family:Georgia,serif;font-size:24px;
                        font-weight:700;color:#ffffff;">${distance}</p>
            </td>
            <td width="33%" align="center"
                style="padding:22px 12px;border-right:1px solid #1f1f1f;">
              <p style="margin:0 0 5px;font-family:'Courier New',monospace;font-size:10px;
                        font-weight:700;color:#4ADE80;letter-spacing:2px;">DURATION</p>
              <p class="stat-val"
                 style="margin:0;font-family:Georgia,serif;font-size:24px;
                        font-weight:700;color:#ffffff;">${duration}</p>
            </td>
            <td width="33%" align="center" style="padding:22px 12px;">
              <p style="margin:0 0 5px;font-family:'Courier New',monospace;font-size:10px;
                        font-weight:700;color:#4ADE80;letter-spacing:2px;">RIDE TYPE</p>
              <p class="stat-val"
                 style="margin:0;font-family:Georgia,serif;font-size:24px;
                        font-weight:700;color:#ffffff;">${safeType}</p>
            </td>
          </tr></table>

          <!-- ── LOCKED ROUTE (both addresses hidden) ── -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:28px 36px;border-top:1px solid #1f1f1f;">
              <p style="margin:0 0 18px;font-family:'Courier New',monospace;font-size:11px;
                        font-weight:700;color:#4ADE80;letter-spacing:2px;">TRIP ROUTE</p>

              <!-- A · Pickup (hidden) -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     role="presentation" style="margin-bottom:6px;">
                <tr>
                  <td width="32" valign="middle">
                    <div style="width:26px;height:26px;border-radius:50%;
                                background-color:#1a2e1a;border:2px solid #166534;
                                text-align:center;line-height:22px;font-size:11px;
                                font-weight:900;color:#4ADE80;
                                font-family:'Courier New',monospace;">A</div>
                  </td>
                  <td valign="middle">
                    <p style="margin:0 0 3px;font-family:'Courier New',monospace;
                               font-size:10px;font-weight:700;color:#6B7280;
                               letter-spacing:1.5px;">PICKUP</p>
                    <span style="display:inline-block;background-color:#1a1a1a;
                                 border-radius:6px;padding:5px 12px;">
                      ${LOCK_SVG}<span style="font-family:'Courier New',monospace;
                        font-size:13px;color:#374151;letter-spacing:3px;">
                        &#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;</span>
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Dashed connector -->
              <table cellpadding="0" cellspacing="0" role="presentation"
                     style="margin:0 0 6px 13px;">
                <tr>
                  <td style="border-left:2px dashed #1f2937;height:20px;width:1px;"></td>
                </tr>
              </table>

              <!-- B · Dropoff (hidden) -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     role="presentation" style="margin-bottom:20px;">
                <tr>
                  <td width="32" valign="middle">
                    <div style="width:26px;height:26px;border-radius:50%;
                                background-color:#111111;border:2px solid #374151;
                                text-align:center;line-height:22px;font-size:11px;
                                font-weight:900;color:#4B5563;
                                font-family:'Courier New',monospace;">B</div>
                  </td>
                  <td valign="middle">
                    <p style="margin:0 0 3px;font-family:'Courier New',monospace;
                               font-size:10px;font-weight:700;color:#374151;
                               letter-spacing:1.5px;">DROPOFF</p>
                    <span style="display:inline-block;background-color:#1a1a1a;
                                 border-radius:6px;padding:5px 12px;">
                      ${LOCK_SVG}<span style="font-family:'Courier New',monospace;
                        font-size:13px;color:#374151;letter-spacing:3px;">
                        &#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;</span>
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Unlock nudge bar -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
                <td style="background-color:#0d1a0d;border:1px solid #1a3320;
                           border-radius:10px;padding:14px 18px;">
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:12px;
                             color:#4ADE80;letter-spacing:0.5px;text-align:center;">
                    &#128274;&nbsp; Full route unlocks the moment you accept in the app
                  </p>
                </td>
              </tr></table>
            </td>
          </tr></table>

          <!-- ── CANDIDATE NOTE ── -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td align="center"
                style="padding:14px 36px;background-color:#0d0d0d;
                       border-top:1px solid #1f1f1f;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;
                        color:#6B7280;letter-spacing:0.5px;">${candidateNote}</p>
            </td>
          </tr></table>

          <!-- ── CTA ── -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:8px 36px 36px;border-top:1px solid #1f1f1f;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-top:24px;"><tr>
                <td align="center">
                  <a href="https://uatob.com/driver/app" class="cta-btn"
                     style="display:block;background-color:#16A34A;color:#ffffff;
                            font-family:'Courier New',monospace;font-size:15px;font-weight:700;
                            text-decoration:none;padding:22px 32px;border-radius:12px;
                            letter-spacing:1.5px;text-align:center;border:1px solid #4ADE80;">
                    ACCEPT IN APP &rarr;
                  </a>
                </td>
              </tr></table>
              <p style="margin:14px 0 0;font-family:'Courier New',monospace;font-size:11px;
                        color:#374151;text-align:center;letter-spacing:0.5px;">
                First come, first served &nbsp;&middot;&nbsp; Tap to claim
              </p>
            </td>
          </tr></table>

          <!-- ── RIDE ID STRIP ── -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:14px 36px;background-color:#0d0d0d;
                       border-top:1px solid #1f1f1f;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;
                        color:#374151;letter-spacing:0.5px;">
                RIDE &nbsp;<span style="color:#4ADE80;">${safeRideId}</span>
              </p>
            </td>
          </tr></table>

        </td>
      </tr>

      <!-- ══ FOOTER ══ -->
      <tr>
        <td align="center" style="padding:28px 20px 0;">
          <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:11px;
                    color:#374151;letter-spacing:0.5px;">
            &copy; ${year} UaTob &nbsp;&middot;&nbsp; Orlando, FL
          </p>
          <p style="margin:0;font-family:'Courier New',monospace;font-size:10px;
                    color:#1f2937;letter-spacing:0.3px;">
            You&apos;re receiving this because you&apos;re listed as online in UaTob Dispatch.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>

</body>
</html>`.trim();

  const text =
    `New ride on UaTob, ${driver.firstName || "Driver"}.\n\n` +
    `Payout:   ${payout}\n` +
    `Distance: ${distance}\n` +
    `Duration: ${duration}\n` +
    `Type:     ${ride.rideType || "Standard"}\n` +
    `Route:    Unlocked in app after you accept\n` +
    `Ride ID:  ${rideId}\n\n` +
    (totalCandidates > 1
      ? `${totalCandidates} drivers were notified — first to accept wins.\n\n`
      : `You're the only driver being notified right now.\n\n`) +
    `Accept this ride: https://uatob.com/driver/app`;

  return {
    to:      driver.email,
    from:    "UaTob Dispatch <noreply@uatob.com>",
    subject: `🚗 New ride · ${payout} · ${distance} · Accept now`,
    text,
    html,
  };
}

// ─────────────────────────────────────────────────────────────
// Send helper
// ─────────────────────────────────────────────────────────────
function sendDriverEmail(driver, ride, rideId, totalCandidates, minutesRemaining) {
  const msg = buildCandidateEmail({ driver, ride, rideId, totalCandidates, minutesRemaining });
  return sgMail.send(msg);
}

// ─────────────────────────────────────────────────────────────
// Scheduled Cloud Function
// ─────────────────────────────────────────────────────────────
exports.emailCandidateDrivers = onSchedule(
  {
    schedule: "every 1 minutes",
    region:   "us-east1",
    secrets:  [SENDGRID_API_KEY],
  },
  async () => {
    sgMail.setApiKey(SENDGRID_API_KEY.value());

    const ridesSnap = await db
      .collection("Rides")
      .where("paymentStatus", "==", "succeeded")
      .where("status", "==", "searching_driver")
      .get();

    if (ridesSnap.empty) {
      console.log("[emailCandidateDrivers] No active rides");
      return;
    }

    const driversSnap = await db
      .collection("Drivers")
      .where("status", "==", "online")
      .get();

    if (driversSnap.empty) {
      console.log("[emailCandidateDrivers] No online drivers");
      return;
    }

    const drivers = driversSnap.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));

    const emailPromises = [];
    const now     = Date.now();
    const TICK_MS = 60_000;

    for (const rideDoc of ridesSnap.docs) {
      const ride    = rideDoc.data();
      const rideRef = rideDoc.ref;
      const rideId  = rideDoc.id;

      // ── EXPIRY GUARD ─────────────────────────────────────────
      const expiresAtMs = ride.expiresAt?.toMillis?.()
        ?? (ride.expiresAt ? new Date(ride.expiresAt).getTime() : null);

      if (expiresAtMs !== null && expiresAtMs <= now) {
        console.log(`[DISPATCH] Skipping ${rideId} — already expired`);
        continue;
      }

      const msRemaining      = expiresAtMs !== null ? expiresAtMs - now : Infinity;
      const minutesRemaining = expiresAtMs !== null
        ? Math.max(1, Math.round(msRemaining / 60_000))
        : null;

      const sentMap       = ride.emailSentToDrivers  || {};
      const candidateUids = ride.candidateDriverUids || [];

      // ── FIRST WAVE ───────────────────────────────────────────
      if (!ride.emailDispatchStarted) {
        console.log(
          `[DISPATCH] First wave → ${rideId} (${minutesRemaining ?? "∞"} min remaining)`
        );

        await rideRef.update({
          emailDispatchStarted: true,
          emailDispatchAt:      admin.firestore.FieldValue.serverTimestamp(),
          emailSentToDrivers:   {},
        });

        const candidateDrivers = drivers.filter(
          (d) => candidateUids.includes(d.uid) && !sentMap[d.uid] && !!d.email
        );

        for (const driver of candidateDrivers) {
          emailPromises.push(
            sendDriverEmail(driver, ride, rideId, candidateDrivers.length, minutesRemaining)
          );
          sentMap[driver.uid] = true;
        }

        await rideRef.update({ emailSentToDrivers: sentMap });
        continue;
      }

      // ── EXPANSION WAVES ──────────────────────────────────────
      if (msRemaining <= TICK_MS) {
        console.log(
          `[DISPATCH] Skipping expansion for ${rideId} — only ${Math.round(msRemaining / 1000)}s left`
        );
        continue;
      }

      const batchSize    = 10;
      const currentIndex = ride.currentDriverIndex || 0;
      const nextBatch    = drivers
        .slice(currentIndex, currentIndex + batchSize)
        .filter((d) => !sentMap[d.uid] && !!d.email);

      if (nextBatch.length === 0) continue;

      console.log(
        `[DISPATCH] Expanding ${rideId} → drivers ${currentIndex}–${currentIndex + batchSize} (${minutesRemaining ?? "∞"} min remaining)`
      );

      for (const driver of nextBatch) {
        emailPromises.push(
          sendDriverEmail(driver, ride, rideId, nextBatch.length, minutesRemaining)
        );
        sentMap[driver.uid] = true;
      }

      await rideRef.update({
        currentDriverIndex: currentIndex + batchSize,
        emailSentToDrivers: sentMap,
        lastDispatchAt:     admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await Promise.allSettled(emailPromises);
    console.log("[emailCandidateDrivers] Done");
  }
);
