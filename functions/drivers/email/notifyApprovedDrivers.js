// notifyApprovedDrivers.js
// Scheduled Cloud Function — runs every 1 minute
// Targets drivers in `status: "approved"` (approved but never online yet)
// and emails them when a paid ride is searching nearby. Combined message:
// "Your account is approved + a ride is waiting — go online to claim it."

const { onSchedule }   = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin            = require("firebase-admin");
const sgMail           = require("@sendgrid/mail");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");

// ─────────────────────────────────────────────────────────────
// Tunables
// ─────────────────────────────────────────────────────────────
const MAX_APPROVED_DRIVERS_PER_RIDE = 50;
const APPROVED_COOLDOWN_MS          = 30 * 60_000; // less aggressive than offline (30 min)

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

function maskAddress(raw) {
  if (!raw) return "—";
  const parts = String(raw).split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return "—";
  const first = parts[0].replace(/^(\d+[A-Za-z]?)(\s+)/, (_, num, sp) => {
    const dots = "•".repeat(Math.min(num.length, 4));
    return `${dots}${sp}`;
  });
  const tail = parts.slice(1).filter((p) => !/^USA$/i.test(p));
  const city = tail[0] ?? "";
  const state = tail[1] ?? "";
  const tailStr = [city, state].filter(Boolean).join(", ");
  return tailStr ? `${first} · ${tailStr}` : first;
}

function toMs(v) {
  if (!v) return null;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (v instanceof Date) return v.getTime();
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

function fmtExpiresAt(ms) {
  if (!ms) return null;
  const d = new Date(ms);
  const date = d.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    timeZone: "America/New_York",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true,
    timeZone: "America/New_York", timeZoneName: "short",
  });
  return `${date} · ${time}`;
}

function fmtCountdown(msRemaining) {
  if (msRemaining == null) return null;
  if (msRemaining <= 0) return "EXPIRED";
  const totalMin = Math.round(msRemaining / 60_000);
  if (totalMin < 60) return `${totalMin} min left`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${String(m).padStart(2, "0")}m left`;
}

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

// Inline checkmark badge for "approved" theme
const APPROVED_BADGE_SVG = `
<svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="28" cy="28" r="28" fill="#16A34A"/>
  <circle cx="28" cy="28" r="26" fill="none" stroke="#4ADE80" stroke-width="1.5" opacity="0.6"/>
  <path d="M16 28L24 36L40 20" stroke="#fff" stroke-width="3.5"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>`.trim();

// ─────────────────────────────────────────────────────────────
// Email builder
// ─────────────────────────────────────────────────────────────
function buildApprovedDriverEmail({ driver, ride, rideId, totalDrivers, msRemaining, expiresAtMs }) {
  const firstName   = esc(driver.firstName?.trim() || "Driver");
  const safePickup  = esc(maskAddress(ride.pickup));
  const safeDropoff = esc(maskAddress(ride.dropoff));
  const safeType    = esc(
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
      ? fmt.currency(
          Number(ride.driverPayout ?? 0) / Number(ride.tripDistanceMiles)
        )
      : null;

  const countdownText    = fmtCountdown(msRemaining);
  const expiresAtText    = fmtExpiresAt(expiresAtMs);
  const minutesRemaining = msRemaining != null ? Math.max(0, Math.round(msRemaining / 60_000)) : null;

  const isUrgent = minutesRemaining !== null && minutesRemaining <= 5;

  // Approved drivers theme: green hero (celebration) with countdown chip
  const chipBg     = isUrgent ? "rgba(248,113,113,0.16)" : "rgba(74,222,128,0.18)";
  const chipBorder = isUrgent ? "#F87171"               : "#4ADE80";
  const chipText   = isUrgent ? "#FCA5A5"               : "#86EFAC";

  const heroChip = countdownText
    ? `
      <div style="display:inline-block;background-color:${chipBg};
                  border:1.5px solid ${chipBorder};border-radius:100px;
                  padding:5px 14px;margin-bottom:20px;">
        <span style="font-family:'Courier New',monospace;font-size:10px;
                     font-weight:700;color:${chipText};letter-spacing:2px;">
          &#9679;&nbsp; FIRST RIDE READY &nbsp;&#183;&nbsp; ${esc(countdownText.toUpperCase())}
        </span>
      </div>`
    : `
      <div style="display:inline-block;background-color:rgba(74,222,128,0.18);
                  border:1.5px solid #4ADE80;border-radius:100px;
                  padding:5px 14px;margin-bottom:20px;">
        <span style="font-family:'Courier New',monospace;font-size:10px;
                     font-weight:700;color:#86EFAC;letter-spacing:2px;">
          &#9679;&nbsp; FIRST RIDE READY
        </span>
      </div>`;

  const urgencyBanner = isUrgent
    ? `
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="center"
                    style="padding:12px 36px;background-color:#7f1d1d;
                           border-top:1px solid #991b1b;">
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:12px;
                             font-weight:700;color:#fca5a5;letter-spacing:1px;">
                    &#9888;&nbsp; EXPIRES IN ~${minutesRemaining} MIN — GO ONLINE NOW
                  </p>
                </td>
              </tr>
            </table>`
    : "";

  const expiresStrip = expiresAtText
    ? `
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:14px 36px;background-color:#0d0d0d;
                           border-top:1px solid #1f1f1f;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td valign="middle">
                        <p style="margin:0;font-family:'Courier New',monospace;font-size:10px;
                                   font-weight:700;color:#6B7280;letter-spacing:1.8px;">
                          EXPIRES AT
                        </p>
                        <p style="margin:3px 0 0;font-family:Georgia,serif;font-size:14px;
                                   font-weight:700;color:#ffffff;letter-spacing:-0.2px;">
                          ${esc(expiresAtText)}
                        </p>
                      </td>
                      ${countdownText ? `
                      <td valign="middle" align="right" style="white-space:nowrap;">
                        <span style="display:inline-block;background-color:${chipBg};
                                     border:1px solid ${chipBorder};border-radius:8px;
                                     padding:5px 10px;font-family:'Courier New',monospace;
                                     font-size:11px;font-weight:700;color:${chipText};
                                     letter-spacing:0.6px;">
                          ${esc(countdownText.toUpperCase())}
                        </span>
                      </td>` : ""}
                    </tr>
                  </table>
                </td>
              </tr>
            </table>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>You're Approved — First Ride Waiting</title>
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
      .payout-num { font-size: 44px !important; }
      .stat-val   { font-size: 18px !important; }
      .cta-btn    { font-size: 14px !important; padding: 16px 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;">

<!-- Preheader -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#0a0a0a;">
  ${esc(`Your UaTob driver account is approved · ${payout} first ride waiting · ${countdownText || "go online to accept"}`)}
</div>

<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="background-color:#0a0a0a;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" role="presentation"
           style="max-width:600px;width:100%;">

      <!-- WORDMARK HEADER -->
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
                           border:1px solid #166534;display:inline-block;">APPROVED</span>
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
            <td style="background:linear-gradient(135deg,#052e16 0%,#14532d 50%,#166534 100%);
                       padding:36px 36px 32px;">

              <!-- Approval badge -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:18px;">
                <tr>
                  <td valign="middle">${APPROVED_BADGE_SVG}</td>
                  <td valign="middle" style="padding-left:14px;">
                    <p style="margin:0;font-family:'Courier New',monospace;font-size:10px;
                               font-weight:700;color:#4ADE80;letter-spacing:2px;line-height:1;">
                      ACCOUNT STATUS
                    </p>
                    <p style="margin:4px 0 0;font-family:Georgia,serif;font-size:18px;
                               font-weight:700;color:#ffffff;line-height:1;">
                      Approved &amp; ready to drive
                    </p>
                  </td>
                </tr>
              </table>

              ${heroChip}

              <h1 class="hero-title"
                  style="margin:0 0 8px;font-family:Georgia,serif;font-size:34px;
                         font-weight:700;color:#ffffff;line-height:1.15;letter-spacing:-1px;">
                Welcome aboard,<br/>
                <span style="color:#4ADE80;">${firstName}</span>
              </h1>
              <p style="margin:0;font-family:'Courier New',monospace;font-size:13px;
                         color:#86efac;letter-spacing:0.3px;">
                Your account is live &mdash; and your first ride just came in
              </p>
            </td>
          </tr></table>

          <!-- ONBOARDING NUDGE -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td align="center" style="padding:14px 36px;background-color:#0d0d0d;
                                      border-top:1px solid #1f1f1f;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;
                         color:#9CA3AF;letter-spacing:0.5px;">
                You haven&apos;t gone online yet &nbsp;&#183;&nbsp;
                <span style="color:#4ADE80;">Open the app to claim this trip</span>
              </p>
            </td>
          </tr></table>

          ${urgencyBanner}

          <!-- PAYOUT -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td align="center" style="padding:32px 36px 24px;border-bottom:1px solid #1f1f1f;
                                      border-top:1px solid #1f1f1f;">
              <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:11px;
                         font-weight:700;color:#4ADE80;letter-spacing:2.5px;">YOUR PAYOUT</p>
              <p class="payout-num"
                 style="margin:0;font-family:Georgia,serif;font-size:56px;font-weight:700;
                        color:#ffffff;line-height:1;letter-spacing:-2px;">${payout}</p>
              ${epm ? `<p style="margin:8px 0 0;font-family:'Courier New',monospace;font-size:12px;
                         color:#6B7280;letter-spacing:0.5px;">${epm}/mile &nbsp;&#183;&nbsp;
                         <span style="color:#4ADE80;">75% split</span></p>` : ""}
            </td>
          </tr></table>

          <!-- STATS ROW -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td width="33%" align="center"
                style="padding:20px 12px;border-right:1px solid #1f1f1f;">
              <p style="margin:0 0 5px;font-family:'Courier New',monospace;font-size:10px;
                         font-weight:700;color:#4ADE80;letter-spacing:2px;">DISTANCE</p>
              <p class="stat-val" style="margin:0;font-family:Georgia,serif;font-size:22px;
                                         font-weight:700;color:#ffffff;">${distance}</p>
            </td>
            <td width="33%" align="center"
                style="padding:20px 12px;border-right:1px solid #1f1f1f;">
              <p style="margin:0 0 5px;font-family:'Courier New',monospace;font-size:10px;
                         font-weight:700;color:#4ADE80;letter-spacing:2px;">DURATION</p>
              <p class="stat-val" style="margin:0;font-family:Georgia,serif;font-size:22px;
                                         font-weight:700;color:#ffffff;">${duration}</p>
            </td>
            <td width="33%" align="center" style="padding:20px 12px;">
              <p style="margin:0 0 5px;font-family:'Courier New',monospace;font-size:10px;
                         font-weight:700;color:#4ADE80;letter-spacing:2px;">RIDE TYPE</p>
              <p class="stat-val" style="margin:0;font-family:Georgia,serif;font-size:22px;
                                         font-weight:700;color:#ffffff;">${safeType}</p>
            </td>
          </tr></table>

          <!-- ROUTE (masked) -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:28px 36px;border-top:1px solid #1f1f1f;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-bottom:14px;">
                <tr>
                  <td>
                    <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;
                               font-weight:700;color:#4ADE80;letter-spacing:2px;">
                      TRIP ROUTE
                    </p>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;background-color:#1f1f1f;
                                 border:1px solid #2a2a2a;border-radius:6px;
                                 padding:3px 8px;font-family:'Courier New',monospace;
                                 font-size:9px;font-weight:700;color:#9CA3AF;
                                 letter-spacing:0.6px;">
                      FULL ADDRESS IN APP
                    </span>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-bottom:8px;"><tr>
                <td width="32" valign="top" style="padding-top:3px;">
                  <div style="width:24px;height:24px;border-radius:50%;background-color:#4ADE80;
                              text-align:center;line-height:24px;font-size:11px;font-weight:900;
                              color:#052e16;font-family:'Courier New',monospace;">A</div>
                </td>
                <td valign="top">
                  <p style="margin:0 0 2px;font-family:'Courier New',monospace;font-size:10px;
                             font-weight:700;color:#6B7280;letter-spacing:1.5px;">PICKUP</p>
                  <p style="margin:0;font-family:Georgia,serif;font-size:15px;font-weight:700;
                             color:#ffffff;line-height:1.4;">${safePickup}</p>
                </td>
              </tr></table>
              <table cellpadding="0" cellspacing="0" role="presentation"
                     style="margin:0 0 8px 12px;"><tr>
                <td style="border-left:2px dashed #166534;height:18px;width:1px;"></td>
              </tr></table>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
                <td width="32" valign="top" style="padding-top:3px;">
                  <div style="width:24px;height:24px;border-radius:50%;
                              background-color:#1f1f1f;border:2px solid #4ADE80;
                              text-align:center;line-height:20px;font-size:11px;font-weight:900;
                              color:#4ADE80;font-family:'Courier New',monospace;">B</div>
                </td>
                <td valign="top">
                  <p style="margin:0 0 2px;font-family:'Courier New',monospace;font-size:10px;
                             font-weight:700;color:#6B7280;letter-spacing:1.5px;">DROPOFF</p>
                  <p style="margin:0;font-family:Georgia,serif;font-size:15px;font-weight:700;
                             color:#ffffff;line-height:1.4;">${safeDropoff}</p>
                </td>
              </tr></table>
            </td>
          </tr></table>

          ${expiresStrip}

          <!-- HOW IT WORKS (3 quick steps for first-timers) -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:24px 36px;border-top:1px solid #1f1f1f;">
              <p style="margin:0 0 16px;font-family:'Courier New',monospace;font-size:11px;
                         font-weight:700;color:#4ADE80;letter-spacing:2px;">
                YOUR FIRST 3 STEPS
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-bottom:10px;">
                <tr>
                  <td width="28" valign="top" style="padding-top:2px;">
                    <div style="width:22px;height:22px;border-radius:50%;
                                background-color:#052e16;border:1.5px solid #4ADE80;
                                text-align:center;line-height:18px;font-size:11px;
                                font-weight:900;color:#4ADE80;
                                font-family:'Courier New',monospace;">1</div>
                  </td>
                  <td valign="top">
                    <p style="margin:0;font-family:Georgia,serif;font-size:14px;
                               color:#ffffff;font-weight:700;line-height:1.4;">
                      Open the UaTob Driver App
                    </p>
                    <p style="margin:2px 0 0;font-family:'Courier New',monospace;font-size:11px;
                               color:#6B7280;letter-spacing:0.3px;">
                      Sign in with the email this was sent to
                    </p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-bottom:10px;">
                <tr>
                  <td width="28" valign="top" style="padding-top:2px;">
                    <div style="width:22px;height:22px;border-radius:50%;
                                background-color:#052e16;border:1.5px solid #4ADE80;
                                text-align:center;line-height:18px;font-size:11px;
                                font-weight:900;color:#4ADE80;
                                font-family:'Courier New',monospace;">2</div>
                  </td>
                  <td valign="top">
                    <p style="margin:0;font-family:Georgia,serif;font-size:14px;
                               color:#ffffff;font-weight:700;line-height:1.4;">
                      Tap &ldquo;Go Online&rdquo;
                    </p>
                    <p style="margin:2px 0 0;font-family:'Courier New',monospace;font-size:11px;
                               color:#6B7280;letter-spacing:0.3px;">
                      Allow location &mdash; we route rides based on it
                    </p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td width="28" valign="top" style="padding-top:2px;">
                    <div style="width:22px;height:22px;border-radius:50%;
                                background-color:#052e16;border:1.5px solid #4ADE80;
                                text-align:center;line-height:18px;font-size:11px;
                                font-weight:900;color:#4ADE80;
                                font-family:'Courier New',monospace;">3</div>
                  </td>
                  <td valign="top">
                    <p style="margin:0;font-family:Georgia,serif;font-size:14px;
                               color:#ffffff;font-weight:700;line-height:1.4;">
                      Accept the trip when it appears
                    </p>
                    <p style="margin:2px 0 0;font-family:'Courier New',monospace;font-size:11px;
                               color:#6B7280;letter-spacing:0.3px;">
                      You&apos;ll see the same ${payout} request inside the app
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr></table>

          <!-- DRIVER COUNT NOTE -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td align="center" style="padding:14px 36px;background-color:#0d0d0d;
                                      border-top:1px solid #1f1f1f;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;
                         color:#6B7280;letter-spacing:0.5px;">
                Sent to <span style="color:#4ADE80;">${totalDrivers} approved driver${totalDrivers !== 1 ? "s" : ""}</span>
                &nbsp;&#183;&nbsp; first to go online claims it
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
                    OPEN APP &amp; GO ONLINE &#8594;
                  </a>
                </td>
              </tr></table>
              <p style="margin:16px 0 0;font-family:'Courier New',monospace;font-size:11px;
                         color:#374151;text-align:center;letter-spacing:0.5px;">
                You&apos;re cleared to drive &mdash; this is your first ride
              </p>
            </td>
          </tr></table>

          <!-- RIDE ID STRIP -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:16px 36px;background-color:#0d0d0d;border-top:1px solid #1f1f1f;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;
                         color:#374151;letter-spacing:0.5px;">
                RIDE ID &nbsp;<span style="color:#4ADE80;">${safeRideId}</span>
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
          <p style="margin:0 0 4px;font-family:'Courier New',monospace;font-size:10px;
                     color:#1f2937;letter-spacing:0.3px;">
            You&apos;re receiving this because your driver application was approved
            and a paid ride is searching nearby.
          </p>
          <p style="margin:0;font-family:'Courier New',monospace;font-size:10px;
                     color:#1f2937;letter-spacing:0.3px;">
            Questions? &nbsp;
            <a href="mailto:support@uatob.com" style="color:#374151;text-decoration:underline;">
              support@uatob.com
            </a>
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`.trim();

  const text =
    `Welcome aboard, ${driver.firstName?.trim() || "Driver"}!\n\n` +
    `Your UaTob driver account is APPROVED and ready to go.\n` +
    `A paid ride just came in nearby — open the app to claim it.\n\n` +
    `Payout:    ${payout}\n` +
    `Distance:  ${distance}\n` +
    `Duration:  ${duration}\n` +
    `Type:      ${ride.rideType || "Standard"}\n` +
    `Pickup:    ${maskAddress(ride.pickup)}\n` +
    `Dropoff:   ${maskAddress(ride.dropoff)}\n` +
    (expiresAtText ? `Expires:   ${expiresAtText}` +
      (countdownText ? ` (${countdownText})\n` : "\n") : "") +
    `Ride ID:   ${rideId}\n\n` +
    `Your first 3 steps:\n` +
    `  1. Open the UaTob Driver App\n` +
    `  2. Tap "Go Online" (allow location)\n` +
    `  3. Accept the trip when it appears\n\n` +
    `Open the app: https://uatob.com/driver/app\n` +
    `Need help? support@uatob.com`;

  const subject = countdownText
    ? `✅ You're approved · ${payout} first ride · ${countdownText}`
    : `✅ Welcome to UaTob — your first ride (${payout}) is waiting`;

  return {
    to:      driver.email,
    from:    "UaTob Dispatch <noreply@uatob.com>",
    replyTo: "support@uatob.com",
    subject,
    text,
    html,
  };
}

// ─────────────────────────────────────────────────────────────
// Scheduled Cloud Function — every 1 minute
// ─────────────────────────────────────────────────────────────
exports.notifyApprovedDrivers = onSchedule(
  {
    schedule: "every 2 minutes",
    region:   "us-east1",
    secrets:  [SENDGRID_API_KEY],
  },
  async () => {
    try {
      sgMail.setApiKey(SENDGRID_API_KEY.value());
      const now = Date.now();

      // 1. Find rides actively searching for a driver
      const ridesSnap = await db
        .collection("Rides")
        .where("status",        "==", "searching_driver")
        .where("paymentStatus", "==", "succeeded")
        .get();

      if (ridesSnap.empty) {
        console.log("[notifyApprovedDrivers] No rides currently searching — done");
        return;
      }

      // 2. Find approved-but-never-online drivers
      //    These are drivers in `status: "approved"` who haven't transitioned
      //    to online or offline yet. Once they go online for the first time
      //    they'll be in "online" or "offline" thereafter.
      const driversSnap = await db
        .collection("Drivers")
        .where("status", "==", "approved")
        .get();

      const drivers = driversSnap.docs
        .map((doc) => ({ uid: doc.id, ...doc.data() }))
        .filter((d) => !!d.email);

      if (drivers.length === 0) {
        console.log("[notifyApprovedDrivers] No approved drivers with email — done");
        return;
      }

      console.log(
        `[notifyApprovedDrivers] ${ridesSnap.size} searching ride(s), ` +
        `${drivers.length} approved driver(s)`
      );

      const batch = db.batch();
      const emailPromises = [];

      for (const rideDoc of ridesSnap.docs) {
        const rideId = rideDoc.id;
        const ride   = rideDoc.data();

        // Skip expired rides
        const expiresAtMs = toMs(ride.expiresAt);
        if (expiresAtMs !== null && expiresAtMs <= now) {
          console.log(`[notifyApprovedDrivers] Ride ${rideId} — already expired, skipping`);
          continue;
        }
        const msRemaining = expiresAtMs !== null ? expiresAtMs - now : null;

        // approvedDriversNotified: { [driverUid]: true } — per-ride dedupe
        const alreadyNotified = ride.approvedDriversNotified || {};

        // Filter eligible: not already emailed for THIS ride, and not within cooldown
        let eligible = drivers.filter((d) => {
          if (alreadyNotified[d.uid]) return false;
          const lastSentMs = toMs(d.lastApprovedNotifyAt);
          if (lastSentMs && now - lastSentMs < APPROVED_COOLDOWN_MS) return false;
          return true;
        });

        if (eligible.length > MAX_APPROVED_DRIVERS_PER_RIDE) {
          eligible = eligible.slice(0, MAX_APPROVED_DRIVERS_PER_RIDE);
        }

        if (eligible.length === 0) {
          console.log(
            `[notifyApprovedDrivers] Ride ${rideId} — 0 eligible approved drivers`
          );
          continue;
        }

        console.log(
          `[notifyApprovedDrivers] Ride ${rideId} — emailing ${eligible.length} approved driver(s) ` +
          `(${msRemaining != null ? Math.round(msRemaining/60_000) + " min" : "no expiry"} remaining)`
        );

        for (const driver of eligible) {
          emailPromises.push(
            sgMail.send(
              buildApprovedDriverEmail({
                driver,
                ride,
                rideId,
                totalDrivers: eligible.length,
                msRemaining,
                expiresAtMs,
              })
            )
          );
        }

        // Mark these drivers as notified on the ride doc
        const updatedNotified = { ...alreadyNotified };
        for (const d of eligible) {
          updatedNotified[d.uid] = true;
        }

        batch.update(rideDoc.ref, {
          approvedDriversNotified:  updatedNotified,
          approvedDriversEmailedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        for (const d of eligible) {
          batch.update(db.collection("Drivers").doc(d.uid), {
            lastApprovedNotifyAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      await Promise.all([
        batch.commit(),
        Promise.allSettled(emailPromises),
      ]);

      console.log("[notifyApprovedDrivers] Run complete");

    } catch (error) {
      console.error("[notifyApprovedDrivers] Error:", error);
    }
  }
);