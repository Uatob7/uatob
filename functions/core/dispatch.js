// functions/accounts/dispatch.js
// Scheduled every 1 minute. One function, four jobs:
// 1. Expires searching_driver rides past their expireAt → "timeout"
// 2. Auto-refunds timeout rides ≥30min old (card/cashapp → Stripe refund,
//    cash → no refund), flips them to "cancelled", emails the rider an apology
// 3. Dispatches pending/scheduled rides that have verified payment
// 4. Sends FCM push to every matched driver that has an fcmToken

const { onSchedule }   = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { getMessaging } = require("firebase-admin/messaging");
const admin            = require("firebase-admin");
const Stripe           = require("stripe");
const sgMail           = require("@sendgrid/mail");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const SENDGRID_API_KEY  = defineSecret("SENDGRID_API_KEY");

// ── CONFIG ─────────────────────────────────────────────────────
// Dispatch
const DISPATCH_LEAD_MS    = 30 * 60 * 1000;
const FRESH_MS            = 10 * 60 * 1000;
const STALE_PENALTY_MIN   = 10;
const AVG_SPEED_MPH       = 25;
const MIN_ETA_MIN         = 7;
const EXPIRE_ETA_MULT     = 2;
const EXPIRE_FLOOR_MS     = 30 * 60 * 1000;
const MAX_DISPATCH_MI     = 20;   // cap — fall back to full pool only if nobody closer
const ONLINE_BONUS_MAX_MI = 2.0;  // max distance advantage a long-wait driver can earn

// Auto-refund
const TIMEOUT_GRACE_MINUTES = 30;
const REFUND_BATCH_LIMIT    = 25;
const MAX_REFUND_ATTEMPTS   = 5;  // after this, flag for manual review instead of looping

// Stale match — drop drivers from the match whose presence is older than this
// at the moment we write. Prevents notifying drivers who went offline after
// the top-of-run Drivers query but before the per-ride dispatch write.
const DRIVER_STALE_HARD_MS = 20 * 60 * 1000; // 20 min: definitely offline

// Stripe circuit breaker — if Stripe returns a 5xx/network error, skip all
// remaining card rides this run instead of hammering the API with errors.
// Resets automatically on the next scheduler invocation (module re-eval).
let stripeCircuitOpen  = false;
let stripeCircuitError = null;

const REFUND_DESTINATIONS = {
  card:    "your card",
  cashapp: "your Cash App",
};

// ── HELPERS ────────────────────────────────────────────────────
const round2 = (n) => Number(Number(n).toFixed(2));

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R    = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateEtaMinutes(miles) {
  return Math.max(MIN_ETA_MIN, Math.round((miles / AVG_SPEED_MPH) * 60 + 1));
}

function presenceMillis(d) {
  const fromTs = (v) =>
    v && typeof v.toMillis === "function" ? v.toMillis()
    : typeof v === "number"               ? v
    :                                       null;
  return fromTs(d.presenceUpdatedAt) ?? fromTs(d.lastSeenAt) ?? fromTs(d.updatedAt) ?? null;
}

function toMillisSafe(v) {
  if (!v) return null;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v === "number") return v;
  const ms = new Date(v).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function computeExpireAt(ride, match) {
  const nearestEtaMin = match.length ? match[0].etaMin : 45;
  const baseMs =
    toMillisSafe(ride.isScheduled && ride.scheduledAt ? ride.scheduledAt : ride.createdAt)
    ?? Date.now();
  const offsetMs = Math.max(EXPIRE_FLOOR_MS, nearestEtaMin * EXPIRE_ETA_MULT * 60_000);
  return new Date(baseMs + offsetMs);
}

// ── SVG ASSETS (apology email) ─────────────────────────────────
const UATOB_ICON_SVG = `
<svg width="46" height="46" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="eribg"   x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F3F4F6"/>
    </linearGradient>
    <linearGradient id="eriroad" x1="0" y1="0" x2="64" y2="0"  gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#111827"/>
      <stop offset="100%" stop-color="#16A34A"/>
    </linearGradient>
    <linearGradient id="ericar"  x1="0" y1="0" x2="1"  y2="1">
      <stop offset="0%"   stop-color="#16A34A"/>
      <stop offset="100%" stop-color="#15803D"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#eribg)"/>
  <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" stroke="#E5E7EB" stroke-width="1"/>
  <path d="M 10 42 Q 32 24 54 42" stroke="url(#eriroad)" stroke-width="2.5"
        stroke-dasharray="5 4" stroke-linecap="round" fill="none" opacity="0.6"/>
  <circle cx="10" cy="42" r="6"   fill="#111827" opacity="0.12"/>
  <circle cx="10" cy="42" r="3.5" fill="#111827"/>
  <text x="10" y="45.5" text-anchor="middle" font-family="Arial,sans-serif"
        font-weight="800" font-size="4.5" fill="#fff">A</text>
  <circle cx="54" cy="42" r="6"   fill="#16A34A" opacity="0.18"/>
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
<svg width="20" height="20" viewBox="0 0 24 24" fill="none"
     xmlns="http://www.w3.org/2000/svg"
     style="display:inline-block;vertical-align:middle;margin:0 3px;">
  <path d="M5 12h14M13 6l6 6-6 6"
        stroke="#16A34A" stroke-width="2.2"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>`.trim();

// ── APOLOGY EMAIL BUILDER ──────────────────────────────────────
function buildApologyEmail({ account, ride, wasRefunded, refundAmount, paymentMethod }) {
  const esc = (s) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const firstName      = esc((account.name || "").split(" ")[0] || "there");
  const pickup         = esc(ride.pickup  || "your pickup");
  const dropoff        = esc(ride.dropoff || "your destination");
  const refundDest     = REFUND_DESTINATIONS[paymentMethod] || "your account";
  const refundTimeline = paymentMethod === "cashapp"
    ? "Funds typically arrive in Cash App within a few minutes."
    : "Funds typically appear in 2\u20133 business days, depending on your bank.";
  const year = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>We couldn't find you a driver — UaTob</title>
  <style type="text/css">
    body, html {
      -webkit-text-size-adjust: 100% !important;
      -ms-text-size-adjust: 100% !important;
      margin: 0 !important; padding: 0 !important;
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
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#0a0a0a;">
  ${wasRefunded
    ? `We couldn't find a driver — $${refundAmount} has been refunded to ${refundDest}.`
    : `We couldn't find a driver — you were not charged.`}
</div>

<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="background-color:#0a0a0a;padding:40px 20px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:600px;width:100%;">

        <!-- WORDMARK -->
        <tr>
          <td align="center" style="padding-bottom:28px;">
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
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
                               color:#FCD34D;background-color:#451a03;padding:4px 9px;
                               border-radius:100px;letter-spacing:1.5px;border:1px solid #92400e;
                               display:inline-block;">
                    NO DRIVER
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- MAIN CARD -->
        <tr>
          <td style="background-color:#111111;border-radius:20px;
                     border:1px solid #1f1f1f;overflow:hidden;">

            <!-- HERO -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background:linear-gradient(135deg,#451a03 0%,#78350f 50%,#92400e 100%);
                           padding:40px 36px 32px;">
                  <div style="display:inline-block;background-color:rgba(252,211,77,0.15);
                              border:1.5px solid #FCD34D;border-radius:100px;
                              padding:5px 14px;margin-bottom:20px;">
                    <span style="font-family:'Courier New',monospace;font-size:10px;
                                 font-weight:700;color:#FCD34D;letter-spacing:2px;">
                      &#9679;&nbsp; RIDE TIMED OUT
                    </span>
                  </div>
                  <h1 class="hero-title"
                      style="margin:0 0 8px;font-family:Georgia,serif;font-size:36px;
                             font-weight:700;color:#ffffff;line-height:1.15;letter-spacing:-1px;">
                    Sorry, ${firstName} &mdash;<br/>
                    <span style="color:#FCD34D;">no driver found.</span>
                  </h1>
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:13px;
                             color:#fde68a;letter-spacing:0.3px;">
                    ${wasRefunded
                      ? `Your $${refundAmount} has been refunded to ${refundDest}.`
                      : `You were not charged for this ride.`}
                  </p>
                </td>
              </tr>
            </table>

            <!-- REFUND BLOCK -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="center"
                    style="padding:32px 36px 24px;border-bottom:1px solid #1f1f1f;">
                  ${wasRefunded ? `
                  <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:11px;
                             font-weight:700;color:#4ADE80;letter-spacing:2.5px;">
                    REFUND PROCESSED
                  </p>
                  <p style="margin:0;font-family:Georgia,serif;font-size:48px;font-weight:700;
                             color:#ffffff;line-height:1;letter-spacing:-2px;">
                    $${esc(String(refundAmount))}
                  </p>
                  <p style="margin:8px 0 0;font-family:'Courier New',monospace;font-size:12px;
                             color:#6B7280;letter-spacing:0.5px;">
                    Back to ${esc(refundDest)} &nbsp;&#183;&nbsp;
                    <span style="color:#4ADE80;">&#10003; Confirmed</span>
                  </p>
                  <p style="margin:10px 0 0;font-family:Georgia,serif;font-size:13px;
                             color:#6B7280;line-height:1.6;">
                    ${esc(refundTimeline)}
                  </p>` : `
                  <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:11px;
                             font-weight:700;color:#4ADE80;letter-spacing:2.5px;">
                    NO CHARGE
                  </p>
                  <p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:700;
                             color:#ffffff;line-height:1.3;">
                    You were not charged<br/>for this ride.
                  </p>`}
                </td>
              </tr>
            </table>

            <!-- ROUTE -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:28px 36px;border-bottom:1px solid #1f1f1f;">
                  <p style="margin:0 0 16px;font-family:'Courier New',monospace;font-size:11px;
                             font-weight:700;color:#FCD34D;letter-spacing:2px;">
                    TRIP THAT TIMED OUT
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                         style="margin-bottom:8px;">
                    <tr>
                      <td width="32" valign="top" style="padding-top:3px;">
                        <div style="width:24px;height:24px;border-radius:50%;
                                    background-color:#4ADE80;text-align:center;line-height:24px;
                                    font-size:11px;font-weight:900;color:#052e16;
                                    font-family:'Courier New',monospace;">A</div>
                      </td>
                      <td valign="top">
                        <p style="margin:0 0 2px;font-family:'Courier New',monospace;font-size:10px;
                                   font-weight:700;color:#6B7280;letter-spacing:1.5px;">PICKUP</p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:15px;
                                   font-weight:700;color:#ffffff;line-height:1.4;">${pickup}</p>
                      </td>
                    </tr>
                  </table>
                  <table cellpadding="0" cellspacing="0" role="presentation"
                         style="margin:0 0 8px 12px;">
                    <tr>
                      <td style="border-left:2px dashed #374151;height:18px;width:1px;"></td>
                    </tr>
                  </table>
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td width="32" valign="top" style="padding-top:3px;">
                        <div style="width:24px;height:24px;border-radius:50%;
                                    background-color:#1f1f1f;border:2px solid #FCD34D;
                                    text-align:center;line-height:20px;font-size:11px;
                                    font-weight:900;color:#FCD34D;
                                    font-family:'Courier New',monospace;">B</div>
                      </td>
                      <td valign="top">
                        <p style="margin:0 0 2px;font-family:'Courier New',monospace;font-size:10px;
                                   font-weight:700;color:#6B7280;letter-spacing:1.5px;">DROPOFF</p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:15px;
                                   font-weight:700;color:#ffffff;line-height:1.4;">${dropoff}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- EXPLANATION -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="center"
                    style="padding:14px 36px;background-color:#0d0d0d;
                           border-top:1px solid #1f1f1f;">
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;
                             color:#6B7280;letter-spacing:0.5px;">
                    No nearby drivers accepted before the search window closed &nbsp;&#183;&nbsp;
                    <span style="color:#FCD34D;">we&apos;re growing our fleet</span>
                  </p>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:8px 36px 36px;border-top:1px solid #1f1f1f;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                         style="margin-top:24px;">
                    <tr>
                      <td align="center">
                        <a href="https://uatob.com" class="cta-btn"
                           style="display:block;background-color:#16A34A;color:#ffffff;
                                  font-family:'Courier New',monospace;font-size:15px;
                                  font-weight:700;text-decoration:none;padding:20px 32px;
                                  border-radius:12px;letter-spacing:1px;text-align:center;
                                  border:1px solid #4ADE80;">
                          TRY AGAIN AT UATOB.COM &#8594;
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:16px 0 0;font-family:'Courier New',monospace;font-size:11px;
                             color:#374151;text-align:center;letter-spacing:0.5px;">
                    Questions? Reply to this email — we read every message.
                  </p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- FOOTER -->
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
                 style="color:#374151;text-decoration:none;font-size:10px;margin:0 8px;
                        font-family:'Courier New',monospace;">Privacy</a>
              <a href="https://uatob.com/terms"
                 style="color:#374151;text-decoration:none;font-size:10px;margin:0 8px;
                        font-family:'Courier New',monospace;">Terms</a>
              <a href="https://uatob.com/unsubscribe"
                 style="color:#374151;text-decoration:none;font-size:10px;margin:0 8px;
                        font-family:'Courier New',monospace;">Unsubscribe</a>
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
    `Hi ${(account.name || "").split(" ")[0] || "there"} — we couldn't find you a driver.\n\n` +
    `Your ride from ${ride.pickup || "your pickup"} to ${ride.dropoff || "your destination"} ` +
    `timed out. None of our nearby drivers accepted before the search window closed.\n\n` +
    (wasRefunded
      ? `REFUND PROCESSED: $${refundAmount} has been refunded to ${refundDest}.\n${refundTimeline}\n\n`
      : `You were not charged for this ride.\n\n`) +
    `We're actively growing our Orlando driver fleet so this happens less often.\n\n` +
    `Try again: https://uatob.com\n\n` +
    `Questions? Just reply to this email.\n\n` +
    `© ${year} UaTob · Orlando, FL`;

  const subject = wasRefunded
    ? `We couldn't find a driver — $${refundAmount} refunded · UaTob`
    : `We couldn't find a driver — no charge · UaTob`;

  return {
    to:      account.email,
    from:    "UaTob <support@uatob.com>",
    replyTo: "support@uatob.com",
    subject,
    text,
    html,
  };
}

// ── CONFIRMATION EMAIL (ride received + payment good) ─────────
const PAYMENT_LABELS = {
  card:    "your card",
  cashapp: "Cash App",
  cash:    "cash",
};

function formatScheduledTime(v) {
  const ms = toMillisSafe(v);
  if (ms === null) return null;
  return new Date(ms).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday:  "short",
    month:    "short",
    day:      "numeric",
    hour:     "numeric",
    minute:   "2-digit",
  });
}

function buildConfirmationEmail({ account, ride, paymentMethod }) {
  const esc = (s) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const firstName  = esc((account.name || "").split(" ")[0] || "there");
  const pickup     = esc(ride.pickup  || "your pickup");
  const dropoff    = esc(ride.dropoff || "your destination");
  const amount     = Number(ride.fareBreakdown?.fareTotal ?? 0).toFixed(2);
  const payLabel   = PAYMENT_LABELS[paymentMethod] || "your account";
  const isCash     = paymentMethod === "cash";
  const isSched    = Boolean(ride.isScheduled && ride.scheduledAt);
  const schedLabel = isSched ? esc(formatScheduledTime(ride.scheduledAt) || "") : null;
  const year       = new Date().getFullYear();

  const statusLine = isSched
    ? `We&apos;ll start matching you with a driver about 30 minutes before your pickup time.`
    : `We&apos;re finding you a driver right now &mdash; you&apos;ll be notified the moment one accepts.`;

  const payHeroLine = isCash
    ? `You&apos;ll pay $${amount} in cash at the end of your ride.`
    : `$${amount} confirmed on ${payLabel}.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>We received your ride — UaTob</title>
  <style type="text/css">
    body, html {
      -webkit-text-size-adjust: 100% !important;
      -ms-text-size-adjust: 100% !important;
      margin: 0 !important; padding: 0 !important;
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
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#0a0a0a;">
  Thanks ${firstName} — we received your ride from ${pickup}. ${isCash ? `Pay $${amount} in cash.` : `$${amount} confirmed.`}
</div>

<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="background-color:#0a0a0a;padding:40px 20px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:600px;width:100%;">

        <!-- WORDMARK -->
        <tr>
          <td align="center" style="padding-bottom:28px;">
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
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
                               display:inline-block;">
                    ${isSched ? "SCHEDULED" : "RIDE RECEIVED"}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- MAIN CARD -->
        <tr>
          <td style="background-color:#111111;border-radius:20px;
                     border:1px solid #1f1f1f;overflow:hidden;">

            <!-- HERO -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background:linear-gradient(135deg,#052e16 0%,#14532d 50%,#16A34A 100%);
                           padding:40px 36px 32px;">
                  <div style="display:inline-block;background-color:rgba(74,222,128,0.15);
                              border:1.5px solid #4ADE80;border-radius:100px;
                              padding:5px 14px;margin-bottom:20px;">
                    <span style="font-family:'Courier New',monospace;font-size:10px;
                                 font-weight:700;color:#4ADE80;letter-spacing:2px;">
                      &#10003;&nbsp; WE GOT YOUR RIDE
                    </span>
                  </div>
                  <h1 class="hero-title"
                      style="margin:0 0 8px;font-family:Georgia,serif;font-size:36px;
                             font-weight:700;color:#ffffff;line-height:1.15;letter-spacing:-1px;">
                    Thank you, ${firstName} &mdash;<br/>
                    <span style="color:#4ADE80;">ride received.</span>
                  </h1>
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:13px;
                             color:#bbf7d0;letter-spacing:0.3px;">
                    ${payHeroLine}
                  </p>
                </td>
              </tr>
            </table>

            <!-- PAYMENT BLOCK -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="center"
                    style="padding:32px 36px 24px;border-bottom:1px solid #1f1f1f;">
                  <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:11px;
                             font-weight:700;color:#4ADE80;letter-spacing:2.5px;">
                    ${isCash ? "PAY IN CASH" : "PAYMENT CONFIRMED"}
                  </p>
                  <p style="margin:0;font-family:Georgia,serif;font-size:48px;font-weight:700;
                             color:#ffffff;line-height:1;letter-spacing:-2px;">
                    $${esc(amount)}
                  </p>
                  <p style="margin:8px 0 0;font-family:'Courier New',monospace;font-size:12px;
                             color:#6B7280;letter-spacing:0.5px;">
                    ${isCash
                      ? `Due to your driver at drop-off`
                      : `Charged to ${esc(payLabel)} &nbsp;&#183;&nbsp; <span style="color:#4ADE80;">&#10003; Confirmed</span>`}
                  </p>
                </td>
              </tr>
            </table>

            <!-- ROUTE -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:28px 36px;border-bottom:1px solid #1f1f1f;">
                  <p style="margin:0 0 16px;font-family:'Courier New',monospace;font-size:11px;
                             font-weight:700;color:#4ADE80;letter-spacing:2px;">
                    YOUR TRIP
                  </p>
                  ${isSched ? `
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                         style="margin-bottom:16px;">
                    <tr>
                      <td style="background-color:#0d1f12;border:1px solid #166534;
                                 border-radius:10px;padding:10px 14px;">
                        <span style="font-family:'Courier New',monospace;font-size:10px;
                                     font-weight:700;color:#6B7280;letter-spacing:1.5px;">PICKUP TIME&nbsp;&nbsp;</span>
                        <span style="font-family:'Courier New',monospace;font-size:12px;
                                     font-weight:700;color:#4ADE80;letter-spacing:0.5px;">${schedLabel}</span>
                      </td>
                    </tr>
                  </table>` : ``}
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                         style="margin-bottom:8px;">
                    <tr>
                      <td width="32" valign="top" style="padding-top:3px;">
                        <div style="width:24px;height:24px;border-radius:50%;
                                    background-color:#4ADE80;text-align:center;line-height:24px;
                                    font-size:11px;font-weight:900;color:#052e16;
                                    font-family:'Courier New',monospace;">A</div>
                      </td>
                      <td valign="top">
                        <p style="margin:0 0 2px;font-family:'Courier New',monospace;font-size:10px;
                                   font-weight:700;color:#6B7280;letter-spacing:1.5px;">PICKUP</p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:15px;
                                   font-weight:700;color:#ffffff;line-height:1.4;">${pickup}</p>
                      </td>
                    </tr>
                  </table>
                  <table cellpadding="0" cellspacing="0" role="presentation"
                         style="margin:0 0 8px 12px;">
                    <tr>
                      <td style="border-left:2px dashed #374151;height:18px;width:1px;"></td>
                    </tr>
                  </table>
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td width="32" valign="top" style="padding-top:3px;">
                        <div style="width:24px;height:24px;border-radius:50%;
                                    background-color:#1f1f1f;border:2px solid #4ADE80;
                                    text-align:center;line-height:20px;font-size:11px;
                                    font-weight:900;color:#4ADE80;
                                    font-family:'Courier New',monospace;">B</div>
                      </td>
                      <td valign="top">
                        <p style="margin:0 0 2px;font-family:'Courier New',monospace;font-size:10px;
                                   font-weight:700;color:#6B7280;letter-spacing:1.5px;">DROPOFF</p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:15px;
                                   font-weight:700;color:#ffffff;line-height:1.4;">${dropoff}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- STATUS NOTE -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="center"
                    style="padding:14px 36px;background-color:#0d0d0d;
                           border-top:1px solid #1f1f1f;">
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;
                             color:#6B7280;letter-spacing:0.5px;line-height:1.6;">
                    ${statusLine}
                  </p>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:8px 36px 36px;border-top:1px solid #1f1f1f;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                         style="margin-top:24px;">
                    <tr>
                      <td align="center">
                        <a href="https://uatob.com" class="cta-btn"
                           style="display:block;background-color:#16A34A;color:#ffffff;
                                  font-family:'Courier New',monospace;font-size:15px;
                                  font-weight:700;text-decoration:none;padding:20px 32px;
                                  border-radius:12px;letter-spacing:1px;text-align:center;
                                  border:1px solid #4ADE80;">
                          TRACK YOUR RIDE &#8594;
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:16px 0 0;font-family:'Courier New',monospace;font-size:11px;
                             color:#374151;text-align:center;letter-spacing:0.5px;">
                    Questions? Reply to this email — we read every message.
                  </p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- FOOTER -->
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
                 style="color:#374151;text-decoration:none;font-size:10px;margin:0 8px;
                        font-family:'Courier New',monospace;">Privacy</a>
              <a href="https://uatob.com/terms"
                 style="color:#374151;text-decoration:none;font-size:10px;margin:0 8px;
                        font-family:'Courier New',monospace;">Terms</a>
              <a href="https://uatob.com/unsubscribe"
                 style="color:#374151;text-decoration:none;font-size:10px;margin:0 8px;
                        font-family:'Courier New',monospace;">Unsubscribe</a>
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
    `Hi ${(account.name || "").split(" ")[0] || "there"} — thank you, we received your ride!\n\n` +
    `From: ${ride.pickup || "your pickup"}\n` +
    `To:   ${ride.dropoff || "your destination"}\n` +
    (isSched && schedLabel ? `Pickup time: ${schedLabel}\n` : ``) +
    `\n` +
    (isCash
      ? `PAY IN CASH: $${amount} due to your driver at drop-off.\n\n`
      : `PAYMENT CONFIRMED: $${amount} charged to ${payLabel}.\n\n`) +
    (isSched
      ? `We'll start matching you with a driver about 30 minutes before your pickup time.\n\n`
      : `We're finding you a driver right now — you'll be notified the moment one accepts.\n\n`) +
    `Track your ride: https://uatob.com\n\n` +
    `Questions? Just reply to this email.\n\n` +
    `© ${year} UaTob · Orlando, FL`;

  const subject = isSched
    ? `Ride received — scheduled for ${formatScheduledTime(ride.scheduledAt) || "later"} · UaTob`
    : `Thank you — we received your ride · UaTob`;

  return {
    to:      account.email,
    from:    "UaTob <support@uatob.com>",
    replyTo: "support@uatob.com",
    subject,
    text,
    html,
  };
}

async function sendRideConfirmationEmail(doc, ride, rideId, paymentMethod) {
  try {
    const acctSnap = await db.collection("Accounts").doc(ride.uid).get();
    const account  = acctSnap.exists ? acctSnap.data() : null;

    if (!account?.email) {
      console.warn(
        `[dispatch:confirm] No email for rider ${ride.uid} on ride ${rideId} — skipping.`
      );
      return;
    }

    const msg = buildConfirmationEmail({ account, ride, paymentMethod });
    await sgMail.send(msg);

    await doc.ref.update({
      confirmationEmailSent:   true,
      confirmationEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(
      `[dispatch:confirm] ✓ Confirmation email sent to ${account.email} for ride ${rideId}`
    );
  } catch (err) {
    console.error(`[dispatch:confirm] Email failed for ${rideId}:`, err?.message || err);
  }
}

// ── REFUND: PER-RIDE PROCESSOR ─────────────────────────────────
async function processTimeoutRide(rideDoc, getStripe) {
  const ride          = { id: rideDoc.id, ...rideDoc.data() };
  const rideId        = ride.id;
  const paymentMethod = ride.paymentMethod || "card";
  const attempts      = Number(ride.autoRefundAttempts ?? 0);

  console.log(
    `[dispatch:refund] Processing ${rideId} ` +
    `(uid: ${ride.uid}, payment: ${paymentMethod}, attempt: ${attempts + 1})`
  );

  let refundId     = null;
  let refundStatus = "skipped";
  let refundAmount = Number(ride.fareBreakdown?.fareTotal ?? 0).toFixed(2);
  let wasRefunded  = false;

  // ── 1. Refund ──────────────────────────────────────────────
  if (paymentMethod === "cash") {
    refundStatus = "cash_no_refund";
    console.log(`[dispatch:refund] Cash ride ${rideId} — no refund needed.`);

  } else if (ride.paymentIntentId && ride.paymentStatus === "succeeded") {
    try {
      const refund = await getStripe().refunds.create({
        payment_intent: ride.paymentIntentId,
        reason:         "requested_by_customer",
        metadata:       { rideId, autoRefund: "true", paymentMethod },
      });
      refundId     = refund.id;
      refundStatus = refund.status;
      wasRefunded  = true;
      // Trust Stripe's actual refunded amount over fareTotal
      if (typeof refund.amount === "number") {
        refundAmount = (refund.amount / 100).toFixed(2);
      }
      console.log(
        `[dispatch:refund] ✓ Refund ${refundId} for ${rideId} | ` +
        `$${refundAmount} | ${paymentMethod}`
      );
    } catch (err) {
      if (err?.raw?.code === "charge_already_refunded") {
        refundStatus = "already_refunded";
        wasRefunded  = true;
        console.warn(`[dispatch:refund] Already refunded: ${rideId}`);
      } else {
        console.error(`[dispatch:refund] Stripe error on ${rideId}:`, err?.message || err);

        // Don't loop forever — flag for manual review after MAX attempts
        const failPatch = {
          autoRefundAttempts: attempts + 1,
          autoRefundLastError: String(err?.message ?? err),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (attempts + 1 >= MAX_REFUND_ATTEMPTS) {
          failPatch.status                = "cancelled";
          failPatch.cancelReason          = "timeout_auto_cancel";
          failPatch.cancelledAt           = admin.firestore.FieldValue.serverTimestamp();
          failPatch.autoRefundStatus      = "refund_failed_manual_review";
          failPatch.autoRefundProcessedAt = admin.firestore.FieldValue.serverTimestamp();
          console.error(
            `[dispatch:refund] ⚠️ ${rideId} hit ${MAX_REFUND_ATTEMPTS} failed refund ` +
            `attempts — flagged refund_failed_manual_review. Rider was charged; handle manually.`
          );
        }
        await rideDoc.ref.update(failPatch).catch((e) =>
          console.error(`[dispatch:refund] Could not record failure on ${rideId}:`, e)
        );
        return false;
      }
    }
  } else {
    refundStatus = "no_payment";
    console.log(`[dispatch:refund] ${rideId} had no successful payment to refund.`);
  }

  // ── 2. Update ride doc ─────────────────────────────────────
  try {
    await rideDoc.ref.update({
      status:                "cancelled",
      paymentStatus:         wasRefunded ? "refunded" : ride.paymentStatus,
      refundId,
      refundedAmount:        wasRefunded ? Number(refundAmount) : null,
      autoRefundStatus:      refundStatus,
      autoRefundProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
      cancelReason:          "timeout_auto_cancel",
      cancelledAt:           admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:             admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error(`[dispatch:refund] Failed to update ride ${rideId}:`, err);
    return false;
  }

  // ── 3. Fetch rider account ─────────────────────────────────
  let account = null;
  try {
    const acctSnap = await db.collection("Accounts").doc(ride.uid).get();
    if (acctSnap.exists) account = acctSnap.data();
  } catch (err) {
    console.error(`[dispatch:refund] Failed to load Account ${ride.uid}:`, err);
  }

  if (!account?.email) {
    console.warn(
      `[dispatch:refund] No email for rider ${ride.uid} on ride ${rideId} — skipping email.`
    );
    return true;
  }

  // ── 4. Send apology email ──────────────────────────────────
  try {
    const msg = buildApologyEmail({ account, ride, wasRefunded, refundAmount, paymentMethod });
    await sgMail.send(msg);
    console.log(`[dispatch:refund] ✓ Email sent to ${account.email} for ride ${rideId}`);

    await rideDoc.ref.update({
      apologyEmailSent:   true,
      apologyEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error(`[dispatch:refund] SendGrid error for ride ${rideId}:`, err?.message || err);
  }

  return true;
}

// ── BUILD MATCH ─────────────────────────────────────────────────
// _fcmToken is kept in memory only — stripped before writing to Firestore
function buildMatch(driverPool, pickupLat, pickupLng, pickupZip) {
  const now = Date.now();
  let pool  = driverPool;

  if (pickupZip) {
    const zipPool = driverPool.filter(
      (d) => String(d.raw?.contact?.zip ?? "") === String(pickupZip)
    );
    if (zipPool.length) pool = zipPool;
  }

  const candidates = [];
  for (const d of pool) {
    const raw = d.raw;
    if (typeof raw.lat !== "number" || typeof raw.lng !== "number") continue;

    const lastPresence = presenceMillis(raw);
    const ageMs        = lastPresence === null ? 0 : now - lastPresence;

    // Fix: hard-stale filter — drop drivers whose presence signal is so old
    // that they are almost certainly offline. This is a second-pass check
    // against the top-of-run Drivers query snapshot; a driver who went offline
    // in the gap between that query and now won't get a push they can't act on.
    // We only skip when we have a real presence reading (null = never updated,
    // treat as fresh so new drivers aren't silently excluded).
    if (lastPresence !== null && ageMs > DRIVER_STALE_HARD_MS) continue;

    const miles        = round2(haversineMiles(pickupLat, pickupLng, raw.lat, raw.lng));
    const stale        = lastPresence !== null && ageMs > FRESH_MS;
    const etaMin       = estimateEtaMinutes(miles) + (stale ? STALE_PENALTY_MIN : 0);
    const onlineTime   = typeof raw.onlineTime === "number" ? raw.onlineTime : 0;

    // Waiting bonus: drivers online longer get up to ONLINE_BONUS_MAX_MI subtracted
    // from their effective distance so they rank above a slightly closer idle driver.
    const waitHours       = onlineTime / 3600;
    const waitBonus       = Math.min(waitHours * 0.5, ONLINE_BONUS_MAX_MI);
    const effectiveMiles  = Math.max(0, miles - waitBonus);

    candidates.push({
      uid:               raw.uid ?? d.id,
      miles,
      effectiveMiles,
      etaMin,
      stale,
      onlineTime,
      presenceUpdatedAt: lastPresence,
      _fcmToken:         typeof raw.fcmToken === "string" && raw.fcmToken.length > 0
                           ? raw.fcmToken
                           : null,
    });
  }

  // Prefer drivers within MAX_DISPATCH_MI; fall back to full pool if none qualify
  const nearby = candidates.filter((d) => d.miles <= MAX_DISPATCH_MI);
  const match  = (nearby.length > 0 ? nearby : candidates)
    .sort((a, b) => a.effectiveMiles - b.effectiveMiles);

  return match;
}

// Strip _fcmToken before any Firestore write
function toFirestoreMatch(match) {
  return match.map(({ _fcmToken, ...rest }) => rest);
}

// ── NOTIFY MATCHED DRIVERS ──────────────────────────────────────
async function notifyMatchedDrivers(match, ride, rideId) {
  const withToken    = match.filter((d) => d._fcmToken);
  const withoutToken = match.filter((d) => !d._fcmToken);

  // Log drivers being skipped — useful when most drivers don't have tokens yet
  if (withoutToken.length > 0) {
    console.log(
      `[dispatch] ${rideId} — ${withoutToken.length} driver(s) skipped (no FCM token): ` +
      withoutToken.map((d) => d.uid).join(", ")
    );
  }

  if (withToken.length === 0) {
    console.log(`[dispatch] ${rideId} — no drivers with FCM token, push skipped.`);
    return;
  }

  const pickup  = ride.pickup  || "a nearby location";
  const dropoff = ride.dropoff || "your destination";

  const results = await Promise.allSettled(
    withToken.map(({ _fcmToken, uid, miles, etaMin }) =>
      getMessaging().send({
        token: _fcmToken,
        notification: {
          title: "🚗 New ride request",
          body:  `${pickup} → ${dropoff} · ${miles}mi · ~${etaMin}min away`,
        },
        data: {
          type:    "ride_request",
          rideId,
          miles:   String(miles),
          etaMin:  String(etaMin),
          pickup,
          dropoff,
        },
        android: {
          priority:     "high",
          notification: { sound: "default", channelId: "ride_requests" },
        },
        apns: {
          payload: { aps: { sound: "default", badge: 1 } },
        },
      })
      .then(() => ({ uid, sent: true }))
      .catch((err)  => ({ uid, sent: false, code: err?.errorInfo?.code ?? err?.message }))
    )
  );

  // Tally results + collect stale tokens
  const sent       = [];
  const failed     = [];
  const staleUids  = [];

  results.forEach((result, i) => {
    const { uid } = withToken[i];
    if (result.status === "fulfilled" && result.value.sent) {
      sent.push(uid);
    } else {
      const code = result.status === "fulfilled"
        ? result.value.code
        : result.reason?.errorInfo?.code ?? result.reason?.message;

      failed.push({ uid, code });

      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        staleUids.push(uid);
      }
    }
  });

  if (sent.length > 0) {
    console.log(
      `[dispatch] ${rideId} — pushed to ${sent.length} driver(s): ${sent.join(", ")}`
    );
  }
  if (failed.length > 0) {
    console.warn(
      `[dispatch] ${rideId} — push failed for ${failed.length} driver(s): ` +
      failed.map((f) => `${f.uid}(${f.code})`).join(", ")
    );
  }

  // Clean up stale FCM tokens from Driver docs
  if (staleUids.length > 0) {
    await Promise.allSettled(
      staleUids.map((uid) =>
        db.collection("Drivers").doc(uid).update({
          fcmToken: admin.firestore.FieldValue.delete(),
        })
        .then(() => console.log(`[dispatch] 🧹 Removed stale token for driver ${uid}`))
        .catch((err) => console.warn(`[dispatch] Could not remove stale token for ${uid}:`, err))
      )
    );
  }
}

// ── MAIN ───────────────────────────────────────────────────────
exports.dispatch = onSchedule(
  {
    schedule: "every 1 minutes",
   region: "us-central1",
    timeZone: "America/New_York",
    secrets:  [STRIPE_SECRET_KEY, SENDGRID_API_KEY],
  },
  async () => {
    const now      = Date.now();
    const nowTs    = admin.firestore.Timestamp.fromMillis(now);
    const cutoffTs = admin.firestore.Timestamp.fromMillis(
      now - TIMEOUT_GRACE_MINUTES * 60 * 1000
    );

    // ── Lazy Stripe init (shared by payment-gate + refunds) ──
    let stripe = null;
    const getStripe = () => {
      if (!stripe) {
        const key = STRIPE_SECRET_KEY.value();
        if (!key) throw new Error("Stripe key not configured");
        stripe = new Stripe(key);
      }
      return stripe;
    };

    // ── SendGrid init (refund apologies + ride confirmations) ─
    sgMail.setApiKey(SENDGRID_API_KEY.value());

    // ── 1. Parallel queries ──────────────────────────────────
    const [snapshot, expiredSnap, refundSnap, driverSnap] = await Promise.all([
      db.collection("Rides")
        .where("status", "in", ["scheduled", "pending_dispatch"])
        .get(),
      db.collection("Rides")
        .where("status", "==", "searching_driver")
        .where("expireAt", "<=", nowTs)
        .get(),
      db.collection("Rides")
        .where("status",     "==", "timeout")
        .where("timedOutAt", "<=", cutoffTs)
        .limit(REFUND_BATCH_LIMIT)
        .get(),
      db.collection("Drivers")
        .where("status", "==", "online")
        .get(),
    ]);

    // ── 2. Expire timed-out rides ────────────────────────────
    if (!expiredSnap.empty) {
      console.log(`[dispatch] Timing out ${expiredSnap.size} expired ride(s)...`);
      await Promise.allSettled(
        expiredSnap.docs.map((doc) =>
          doc.ref.update({
            status:     "timeout",
            timedOutAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt:  admin.firestore.FieldValue.serverTimestamp(),
          })
          .then(() => console.log(`[dispatch] ⏰ ${doc.id} → timeout`))
          .catch((err) => console.error(`[dispatch] ❌ timeout failed for ${doc.id}:`, err))
        )
      );
    }

    // ── 3. Auto-refund stale timeout rides (≥30min old) ──────
    const refundEligible = refundSnap.docs.filter(
      (d) => !d.data().autoRefundProcessedAt
    );

    if (refundEligible.length > 0) {
      console.log(
        `[dispatch:refund] ${refundEligible.length} timed-out ride(s) eligible ` +
        `(≥${TIMEOUT_GRACE_MINUTES}min old)`
      );

      const refundResults = await Promise.allSettled(
        refundEligible.map((doc) => processTimeoutRide(doc, getStripe))
      );

      const refunded = refundResults.filter(
        (r) => r.status === "fulfilled" && r.value === true
      ).length;

      console.log(
        `[dispatch:refund] Batch complete | ${refunded} processed, ` +
        `${refundResults.length - refunded} failed`
      );
    }

    // ── 4. Dispatch pending/scheduled rides ──────────────────
    if (snapshot.empty) {
      console.log("[dispatch] No rides awaiting dispatch.");
      return;
    }

    console.log(`[dispatch] Evaluating ${snapshot.size} ride(s)...`);

    const driverPool = driverSnap.docs.map((doc) => ({ id: doc.id, raw: doc.data() }));

    const withTokenCount    = driverPool.filter((d) => d.raw.fcmToken).length;
    const withoutTokenCount = driverPool.length - withTokenCount;
    console.log(
      `[dispatch] Driver pool: ${driverPool.length} online ` +
      `(${withTokenCount} with FCM token, ${withoutTokenCount} without)`
    );

    // ── 5. Process rides ─────────────────────────────────────
    await Promise.allSettled(
      snapshot.docs.map(async (doc) => {
        const ride   = doc.data();
        const rideId = doc.id;

        try {
          await doc.ref.update({
            dispatchLastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Scheduled gate
          if (ride.isScheduled && ride.scheduledAt) {
            const schedMs = toMillisSafe(ride.scheduledAt);
            if (schedMs === null) {
              console.warn(`[dispatch] ${rideId} invalid scheduledAt — skipping`);
              return;
            }
            if (now < schedMs - DISPATCH_LEAD_MS) return;
          }

          // Payment gate
          const method = ride.paymentMethod ?? "card";
          let paymentVerified = false;
          let patchPayment    = null;

          if (method === "cash") {
            paymentVerified = ride.paymentStatus === "succeeded";
          } else {
            if (!ride.paymentIntentId) {
              console.log(`[dispatch] ${rideId} (${method}) no paymentIntentId — skipping`);
              return;
            }

            if (ride.paymentStatus === "succeeded") {
              paymentVerified = true;
            } else {
              // Fix: circuit breaker — if Stripe already errored this run,
              // skip all remaining unverified card rides rather than hitting
              // a broken API N more times. They'll be retried next minute.
              if (stripeCircuitOpen) {
                console.warn(
                  `[dispatch] ${rideId} — Stripe circuit open (${stripeCircuitError}), skipping`
                );
                return;
              }

              let intent;
              try {
                intent = await getStripe().paymentIntents.retrieve(ride.paymentIntentId);
              } catch (stripeErr) {
                const statusCode = stripeErr?.statusCode ?? 0;
                // 4xx errors are per-intent problems (bad ID, auth) — don't trip circuit.
                // 5xx / network errors mean Stripe is down — trip circuit for this run.
                if (!statusCode || statusCode >= 500) {
                  stripeCircuitOpen  = true;
                  stripeCircuitError = stripeErr?.message ?? String(stripeErr);
                  console.error(
                    `[dispatch] ⚡ Stripe circuit tripped on ${rideId}: ${stripeCircuitError}`
                  );
                } else {
                  console.error(
                    `[dispatch] Stripe ${statusCode} on ${rideId}: ${stripeErr?.message}`
                  );
                }
                return;
              }

              console.log(`[dispatch] ${rideId} (${method}) intent: ${intent.status}`);

              if (intent.status === "succeeded") {
                paymentVerified = true;
                patchPayment    = "succeeded";
              } else if (intent.status === "canceled") {
                await doc.ref.update({
                  paymentStatus: "canceled",
                  status:        "canceled",
                  updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
                });
                console.log(`[dispatch] ${rideId} intent canceled → ride canceled`);
                return;
              } else {
                return;
              }
            }
          }

          if (!paymentVerified) return;

          // Build match (includes _fcmToken in memory)
          const hasPickup =
            Number.isFinite(ride.pickupLat) && Number.isFinite(ride.pickupLng);
          const match = hasPickup
            ? buildMatch(driverPool, ride.pickupLat, ride.pickupLng, ride.pickupZip ?? null)
            : [];

          // ── Fix: transactional dispatch write ──────────────
          // Uses a Firestore transaction with a status precondition so that
          // two overlapping scheduler invocations (Cloud Scheduler is not
          // exactly-once) cannot both dispatch the same ride. The second
          // writer will see status == "searching_driver" inside the
          // transaction, abort with ALREADY_DISPATCHED, and skip silently.
          const VALID_DISPATCH_STATUSES = ["pending_dispatch", "scheduled"];

          const update = {
            status:       "searching_driver",
            match:        toFirestoreMatch(match),
            matchCount:   match.length,
            expireAt:     computeExpireAt(ride, match),
            dispatchedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
          };
          if (patchPayment) update.paymentStatus = patchPayment;

          let alreadyDispatched = false;

          await db.runTransaction(async (tx) => {
            const fresh = await tx.get(doc.ref);
            if (!fresh.exists) {
              alreadyDispatched = true;
              return; // deleted mid-run
            }
            const freshStatus = fresh.data().status;
            if (!VALID_DISPATCH_STATUSES.includes(freshStatus)) {
              // Another invocation already moved this ride forward — skip.
              alreadyDispatched = true;
              return;
            }
            tx.update(doc.ref, update);
          });

          if (alreadyDispatched) {
            console.log(`[dispatch] ⚡ ${rideId} already dispatched by concurrent run — skipped`);
            return;
          }

          console.log(
            `[dispatch] ✅ ${rideId} (${method}) → searching_driver | ` +
            `${match.length} driver(s)` +
            (match.length ? ` | nearest ${match[0].miles}mi / ${match[0].etaMin}min` : "")
          );

          // Confirmation email — fires the first time payment is verified.
          // Guarded by confirmationEmailSent so re-dispatched/reassigned rides
          // never email the rider twice.
          if (!ride.confirmationEmailSent) {
            await sendRideConfirmationEmail(doc, ride, rideId, method);
          }

          // Push notify matched drivers (non-blocking — failure doesn't affect dispatch)
          if (match.length > 0) {
            await notifyMatchedDrivers(match, ride, rideId);
          }

        } catch (err) {
          console.error(`[dispatch] ❌ Error on ride ${rideId}:`, err);
        }
      })
    );
  }
);