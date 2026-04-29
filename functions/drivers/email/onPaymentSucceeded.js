
 schedule: "every 1 minutes",
    region:   "us-east1",

const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret }      = require("firebase-functions/params");
const admin                 = require("firebase-admin");
const sgMail                = require("@sendgrid/mail");

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

// ─────────────────────────────────────────────────────────────
// Email builder
// ─────────────────────────────────────────────────────────────
function buildOfflineDriverEmail({ driver, ride, rideId, totalDrivers }) {
  const firstName   = esc(driver.firstName || "Driver");
  const safePickup  = esc(ride.pickup  || "N/A");
  const safeDropoff = esc(ride.dropoff || "N/A");
  const safeType    = esc(
    ride.rideLabel ||
    (ride.rideType
      ? ride.rideType.charAt(0).toUpperCase() + ride.rideType.slice(1)
      : "Standard")
  );
  const safeRideId  = esc(rideId);
  const payout      = fmt.currency(ride.driverPayout);
  const distance    = fmt.miles(ride.tripDistanceMiles);
  const duration    = fmt.duration(ride.tripDurationMin);
  const year        = new Date().getFullYear();

  const epm =
    Number(ride.tripDistanceMiles) > 0
      ? fmt.currency(
          Number(ride.driverPayout ?? 0) / Number(ride.tripDistanceMiles)
        )
      : null;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Ride Available Near You — UaTob</title>
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
                               font-weight:700;color:#FBBF24;background-color:#1c1000;
                               padding:4px 9px;border-radius:100px;letter-spacing:1.5px;
                               border:1px solid #78350f;display:inline-block;">
                    GO ONLINE
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
                <td style="background:linear-gradient(135deg,#1c1000 0%,#292400 50%,#3b2800 100%);
                           padding:40px 36px 32px;">
                  <div style="display:inline-block;background-color:rgba(251,191,36,0.15);
                              border:1.5px solid #FBBF24;border-radius:100px;
                              padding:5px 14px;margin-bottom:20px;">
                    <span style="font-family:'Courier New',monospace;font-size:10px;
                                 font-weight:700;color:#FBBF24;letter-spacing:2px;">
                      &#9679;&nbsp; RIDE WAITING
                    </span>
                  </div>
                  <h1 class="hero-title"
                      style="margin:0 0 8px;font-family:Georgia,serif;font-size:36px;
                             font-weight:700;color:#ffffff;line-height:1.15;letter-spacing:-1px;">
                    Money's Waiting,<br/>
                    <span style="color:#FBBF24;">${firstName}</span>
                  </h1>
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:13px;
                             color:#FDE68A;letter-spacing:0.3px;">
                    A rider just paid &mdash; go online to accept this trip
                  </p>
                </td>
              </tr>
            </table>

            <!-- ── OFFLINE NUDGE STRIP ── -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="center"
                    style="padding:12px 36px;background-color:#1c0f00;
                           border-top:1px solid #292400;">
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:12px;
                             font-weight:700;color:#FBBF24;letter-spacing:1px;">
                    &#9888;&nbsp; YOU'RE CURRENTLY OFFLINE — GO ONLINE IN THE APP TO ACCEPT
                  </p>
                </td>
              </tr>
            </table>

            <!-- ── PAYOUT HERO STAT ── -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="center"
                    style="padding:32px 36px 24px;border-bottom:1px solid #1f1f1f;">
                  <p style="margin:0 0 6px;font-family:'Courier New',monospace;
                             font-size:11px;font-weight:700;color:#4ADE80;letter-spacing:2.5px;">
                    YOUR PAYOUT
                  </p>
                  <p class="payout-num"
                     style="margin:0;font-family:Georgia,serif;font-size:56px;
                            font-weight:700;color:#ffffff;line-height:1;letter-spacing:-2px;">
                    ${payout}
                  </p>
                  ${epm ? `
                  <p style="margin:8px 0 0;font-family:'Courier New',monospace;
                             font-size:12px;color:#6B7280;letter-spacing:0.5px;">
                    ${epm}/mile &nbsp;&#183;&nbsp;
                    <span style="color:#4ADE80;">80% split</span>
                  </p>` : ""}
                </td>
              </tr>
            </table>

            <!-- ── TRIP STATS ROW ── -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td width="33%" align="center"
                    style="padding:20px 12px;border-right:1px solid #1f1f1f;">
                  <p style="margin:0 0 5px;font-family:'Courier New',monospace;
                             font-size:10px;font-weight:700;color:#4ADE80;letter-spacing:2px;">
                    DISTANCE
                  </p>
                  <p class="stat-val"
                     style="margin:0;font-family:Georgia,serif;font-size:22px;
                            font-weight:700;color:#ffffff;">
                    ${distance}
                  </p>
                </td>
                <td width="33%" align="center"
                    style="padding:20px 12px;border-right:1px solid #1f1f1f;">
                  <p style="margin:0 0 5px;font-family:'Courier New',monospace;
                             font-size:10px;font-weight:700;color:#4ADE80;letter-spacing:2px;">
                    DURATION
                  </p>
                  <p class="stat-val"
                     style="margin:0;font-family:Georgia,serif;font-size:22px;
                            font-weight:700;color:#ffffff;">
                    ${duration}
                  </p>
                </td>
                <td width="33%" align="center"
                    style="padding:20px 12px;">
                  <p style="margin:0 0 5px;font-family:'Courier New',monospace;
                             font-size:10px;font-weight:700;color:#4ADE80;letter-spacing:2px;">
                    RIDE TYPE
                  </p>
                  <p class="stat-val"
                     style="margin:0;font-family:Georgia,serif;font-size:22px;
                            font-weight:700;color:#ffffff;">
                    ${safeType}
                  </p>
                </td>
              </tr>
            </table>

            <!-- ── ROUTE CARD ── -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:28px 36px;border-top:1px solid #1f1f1f;">
                  <p style="margin:0 0 18px;font-family:'Courier New',monospace;
                             font-size:11px;font-weight:700;color:#4ADE80;letter-spacing:2px;">
                    TRIP ROUTE
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
                          ${safePickup}
                        </p>
                      </td>
                    </tr>
                  </table>
                  <!-- Connector line -->
                  <table cellpadding="0" cellspacing="0" role="presentation"
                         style="margin:0 0 8px 12px;">
                    <tr>
                      <td style="border-left:2px dashed #166534;height:18px;width:1px;"></td>
                    </tr>
                  </table>
                  <!-- Dropoff -->
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
                        <p style="margin:0 0 2px;font-family:'Courier New',monospace;
                                   font-size:10px;font-weight:700;color:#6B7280;
                                   letter-spacing:1.5px;">DROPOFF</p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:15px;
                                   font-weight:700;color:#ffffff;line-height:1.4;">
                          ${safeDropoff}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- ── DRIVER COUNT NOTE ── -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="center"
                    style="padding:14px 36px;background-color:#0d0d0d;
                           border-top:1px solid #1f1f1f;">
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;
                             color:#6B7280;letter-spacing:0.5px;">
                    Sent to <span style="color:#FBBF24;">${totalDrivers} offline driver${totalDrivers !== 1 ? "s" : ""}</span>
                    &nbsp;&#183;&nbsp; go online first to claim it
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
                        <a href="https://uatob.com/driver/app"
                           class="cta-btn"
                           style="display:block;background-color:#D97706;
                                  color:#ffffff;font-family:'Courier New',monospace;
                                  font-size:15px;font-weight:700;text-decoration:none;
                                  padding:20px 32px;border-radius:12px;
                                  letter-spacing:1px;text-align:center;
                                  border:1px solid #FBBF24;">
                          GO ONLINE &amp; ACCEPT &#8594;
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:16px 0 0;font-family:'Courier New',monospace;
                             font-size:11px;color:#374151;text-align:center;
                             letter-spacing:0.5px;">
                    First driver online &amp; available wins the trip
                  </p>
                </td>
              </tr>
            </table>

            <!-- ── RIDE ID STRIP ── -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:16px 36px;background-color:#0d0d0d;
                           border-top:1px solid #1f1f1f;">
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;
                             color:#374151;letter-spacing:0.5px;">
                    RIDE ID &nbsp;<span style="color:#4ADE80;">${safeRideId}</span>
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
            <p style="margin:0;font-family:'Courier New',monospace;font-size:10px;
                       color:#1f2937;letter-spacing:0.3px;">
              You&apos;re receiving this because you&apos;re a registered UaTob driver.
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
    `Hey ${driver.firstName || "Driver"} — a ride just got paid and is waiting for a driver.\n\n` +
    `You're currently offline. Go online in the UaTob Driver App to accept it.\n\n` +
    `Payout:   ${payout}\n` +
    `Distance: ${distance}\n` +
    `Duration: ${duration}\n` +
    `Type:     ${ride.rideType || "Standard"}\n` +
    `Pickup:   ${ride.pickup   || "N/A"}\n` +
    `Dropoff:  ${ride.dropoff  || "N/A"}\n` +
    `Ride ID:  ${rideId}\n\n` +
    `Open the app and go online: https://uatob.com/driver/app`;

  return {
    to:      driver.email,
    from:    "UaTob Dispatch <noreply@uatob.com>",
    subject: `💰 ${payout} trip waiting — go online to accept`,
    text,
    html,
  };
}

// ─────────────────────────────────────────────────────────────
// Cloud Function — triggers on Rides/{rideId} update
// ─────────────────────────────────────────────────────────────
exports.onPaymentSucceeded = onDocumentUpdated(
  {
    document: "Rides/{rideId}",
    region:   "us-east1",
    secrets:  [SENDGRID_API_KEY],
  },
  async (event) => {
    try {
      const before = event.data.before.data();
      const after  = event.data.after.data();

      // Only fire on the exact flip we care about
      const wasSearching =
        before.status        === "pending_payment" &&
        before.paymentStatus === "pending";

      const isNowSearching =
        after.status        === "searching_driver" &&
        after.paymentStatus === "succeeded";

      if (!wasSearching || !isNowSearching) return null;

      // Guard: only run once (in case of duplicate triggers)
      if (after.offlineDriversEmailedAt) {
        console.log(`[onPaymentSucceeded] Already emailed offline drivers for ${event.params.rideId}`);
        return null;
      }

      const rideId  = event.params.rideId;
      const rideRef = event.data.after.ref;

      console.log(`[onPaymentSucceeded] Payment succeeded for ride ${rideId} — fetching offline drivers`);

      sgMail.setApiKey(SENDGRID_API_KEY.value());

      // Mark immediately to prevent duplicate sends on re-trigger
      await rideRef.update({
        offlineDriversEmailedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const driversSnap = await db
        .collection("Drivers")
        .where("status", "==", "offline")
        .get();

      if (driversSnap.empty) {
        console.log(`[onPaymentSucceeded] No offline drivers to notify for ${rideId}`);
        return null;
      }

      const drivers = driversSnap.docs
        .map((doc) => ({ uid: doc.id, ...doc.data() }))
        .filter((d) => !!d.email);

      if (drivers.length === 0) {
        console.log(`[onPaymentSucceeded] Offline drivers found but none have email`);
        return null;
      }

      console.log(`[onPaymentSucceeded] Sending to ${drivers.length} offline drivers`);

      const emailPromises = drivers.map((driver) =>
        sgMail.send(
          buildOfflineDriverEmail({
            driver,
            ride:         after,
            rideId,
            totalDrivers: drivers.length,
          })
        )
      );

      await Promise.allSettled(emailPromises);

      console.log(`[onPaymentSucceeded] Done — notified ${drivers.length} offline drivers for ${rideId}`);
      return null;

    } catch (error) {
      console.error("[onPaymentSucceeded] Error:", error);
      return null;
    }
  }
);