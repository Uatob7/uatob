// File: functions/emailCandidateDrivers.js
const { onSchedule }   = require("firebase-functions/v2/scheduler");
const { defineSecret }  = require("firebase-functions/params");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const sgMail = require("@sendgrid/mail");

if (!getApps().length) initializeApp();
const db = getFirestore();

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
// Brand SVGs — email-safe, inlined
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
  <path d="M 10 42 Q 32 24 54 42" stroke="url(#eriroad)" stroke-width="2.5" stroke-dasharray="5 4" stroke-linecap="round" fill="none" opacity="0.6"/>
  <circle cx="10" cy="42" r="6" fill="#111827" opacity="0.12"/>
  <circle cx="10" cy="42" r="3.5" fill="#111827"/>
  <text x="10" y="45.5" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="4.5" fill="#fff">A</text>
  <circle cx="54" cy="42" r="6" fill="#16A34A" opacity="0.18"/>
  <circle cx="54" cy="42" r="3.5" fill="#16A34A"/>
  <text x="54" y="45.5" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="4.5" fill="#fff">B</text>
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
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;margin:0 3px;">
  <path d="M5 12h14M13 6l6 6-6 6" stroke="#16A34A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`.trim();

// ─────────────────────────────────────────────────────────────
// Email builder
// ─────────────────────────────────────────────────────────────
const buildCandidateEmail = ({ driver, ride, rideId, totalCandidates }) => {
  const firstName   = esc(driver.firstName || "Driver");
  const safePickup  = esc(ride.pickup  || "N/A");
  const safeDropoff = esc(ride.dropoff || "N/A");
  const safeType    = esc(
    ride.rideLabel ||
    (ride.rideType ? ride.rideType.charAt(0).toUpperCase() + ride.rideType.slice(1) : "Standard")
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

  const candidateNote =
    totalCandidates > 1
      ? `Sent to <span style="color:#4ADE80;">${totalCandidates} nearby drivers</span> &nbsp;&#183;&nbsp; first to accept wins`
      : `You&apos;re the only driver being notified right now`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Ride Available — UaTob</title>
  <style>
    body,html{-webkit-text-size-adjust:100%!important;margin:0!important;padding:0!important;background-color:#0a0a0a!important;}
    @media only screen and (max-width:600px){.hero-title{font-size:28px!important}.payout-num{font-size:44px!important}.stat-val{font-size:18px!important}.cta-btn{font-size:14px!important;padding:16px 20px!important}}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#0a0a0a;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">

      <!-- WORDMARK -->
      <tr><td align="center" style="padding-bottom:28px;">
        <table cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td valign="middle" style="padding-right:10px;">${UATOB_ICON_SVG}</td>
          <td valign="middle">
            <span style="font-family:Georgia,serif;font-style:italic;font-weight:300;font-size:28px;color:#ffffff;letter-spacing:-0.5px;">Ua</span><!--
         -->${ARROW_SVG}<!--
         --><span style="font-family:Arial,sans-serif;font-weight:800;font-size:28px;color:#4ADE80;letter-spacing:-0.5px;">Tob</span>
          </td>
          <td valign="middle" style="padding-left:10px;">
            <span style="font-family:'Courier New',monospace;font-size:9px;font-weight:700;color:#4ADE80;background-color:#052e16;padding:4px 9px;border-radius:100px;letter-spacing:1.5px;border:1px solid #166534;display:inline-block;">DISPATCH</span>
          </td>
        </tr></table>
      </td></tr>

      <!-- MAIN CARD -->
      <tr><td style="background-color:#111111;border-radius:20px;border:1px solid #1f1f1f;overflow:hidden;">

        <!-- HERO -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td style="background:linear-gradient(135deg,#052e16 0%,#14532d 50%,#166534 100%);padding:40px 36px 32px;">
            <div style="display:inline-block;background-color:rgba(74,222,128,0.15);border:1.5px solid #4ADE80;border-radius:100px;padding:5px 14px;margin-bottom:20px;">
              <span style="font-family:'Courier New',monospace;font-size:10px;font-weight:700;color:#4ADE80;letter-spacing:2px;">&#9679;&nbsp; LIVE REQUEST</span>
            </div>
            <h1 class="hero-title" style="margin:0 0 8px;font-family:Georgia,serif;font-size:36px;font-weight:700;color:#ffffff;line-height:1.15;letter-spacing:-1px;">
              New Ride<br/><span style="color:#4ADE80;">Available</span>
            </h1>
            <p style="margin:0;font-family:'Courier New',monospace;font-size:13px;color:#86efac;">Hey ${firstName} &mdash; a rider needs you nearby</p>
          </td>
        </tr></table>

        <!-- PAYOUT -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td align="center" style="padding:32px 36px 24px;border-bottom:1px solid #1f1f1f;">
            <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:11px;font-weight:700;color:#4ADE80;letter-spacing:2.5px;">YOUR PAYOUT</p>
            <p class="payout-num" style="margin:0;font-family:Georgia,serif;font-size:56px;font-weight:700;color:#ffffff;line-height:1;letter-spacing:-2px;">${payout}</p>
            ${epm ? `<p style="margin:8px 0 0;font-family:'Courier New',monospace;font-size:12px;color:#6B7280;">${epm}/mile &nbsp;&#183;&nbsp; <span style="color:#4ADE80;">75% split</span></p>` : ""}
          </td>
        </tr></table>

        <!-- STATS -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td width="33%" align="center" style="padding:20px 12px;border-right:1px solid #1f1f1f;">
            <p style="margin:0 0 5px;font-family:'Courier New',monospace;font-size:10px;font-weight:700;color:#4ADE80;letter-spacing:2px;">DISTANCE</p>
            <p class="stat-val" style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#ffffff;">${distance}</p>
          </td>
          <td width="33%" align="center" style="padding:20px 12px;border-right:1px solid #1f1f1f;">
            <p style="margin:0 0 5px;font-family:'Courier New',monospace;font-size:10px;font-weight:700;color:#4ADE80;letter-spacing:2px;">DURATION</p>
            <p class="stat-val" style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#ffffff;">${duration}</p>
          </td>
          <td width="33%" align="center" style="padding:20px 12px;">
            <p style="margin:0 0 5px;font-family:'Courier New',monospace;font-size:10px;font-weight:700;color:#4ADE80;letter-spacing:2px;">RIDE TYPE</p>
            <p class="stat-val" style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#ffffff;">${safeType}</p>
          </td>
        </tr></table>

        <!-- ROUTE -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td style="padding:28px 36px;border-top:1px solid #1f1f1f;">
            <p style="margin:0 0 18px;font-family:'Courier New',monospace;font-size:11px;font-weight:700;color:#4ADE80;letter-spacing:2px;">TRIP ROUTE</p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:8px;"><tr>
              <td width="32" valign="top" style="padding-top:3px;">
                <div style="width:24px;height:24px;border-radius:50%;background-color:#4ADE80;text-align:center;line-height:24px;font-size:11px;font-weight:900;color:#052e16;font-family:'Courier New',monospace;">A</div>
              </td>
              <td valign="top">
                <p style="margin:0 0 2px;font-family:'Courier New',monospace;font-size:10px;font-weight:700;color:#6B7280;letter-spacing:1.5px;">PICKUP</p>
                <p style="margin:0;font-family:Georgia,serif;font-size:15px;font-weight:700;color:#ffffff;line-height:1.4;">${safePickup}</p>
              </td>
            </tr></table>
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 8px 12px;">
              <tr><td style="border-left:2px dashed #166534;height:18px;width:1px;"></td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
              <td width="32" valign="top" style="padding-top:3px;">
                <div style="width:24px;height:24px;border-radius:50%;background-color:#1f1f1f;border:2px solid #4ADE80;text-align:center;line-height:20px;font-size:11px;font-weight:900;color:#4ADE80;font-family:'Courier New',monospace;">B</div>
              </td>
              <td valign="top">
                <p style="margin:0 0 2px;font-family:'Courier New',monospace;font-size:10px;font-weight:700;color:#6B7280;letter-spacing:1.5px;">DROPOFF</p>
                <p style="margin:0;font-family:Georgia,serif;font-size:15px;font-weight:700;color:#ffffff;line-height:1.4;">${safeDropoff}</p>
              </td>
            </tr></table>
          </td>
        </tr></table>

        <!-- CANDIDATE NOTE -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td align="center" style="padding:14px 36px;background-color:#0d0d0d;border-top:1px solid #1f1f1f;">
            <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;color:#6B7280;">${candidateNote}</p>
          </td>
        </tr></table>

        <!-- CTA -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td style="padding:8px 36px 36px;border-top:1px solid #1f1f1f;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:24px;"><tr>
              <td align="center">
                <a href="https://uatob.com/driver/app" class="cta-btn"
                   style="display:block;background-color:#16A34A;color:#ffffff;font-family:'Courier New',monospace;font-size:15px;font-weight:700;text-decoration:none;padding:20px 32px;border-radius:12px;letter-spacing:1px;text-align:center;border:1px solid #4ADE80;">
                  OPEN APP TO ACCEPT &#8594;
                </a>
              </td>
            </tr></table>
            <p style="margin:16px 0 0;font-family:'Courier New',monospace;font-size:11px;color:#374151;text-align:center;">Rides are first-come, first-served &nbsp;&#183;&nbsp; Open your app now</p>
          </td>
        </tr></table>

        <!-- RIDE ID -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td style="padding:16px 36px;background-color:#0d0d0d;border-top:1px solid #1f1f1f;">
            <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;color:#374151;">
              RIDE ID &nbsp;<span style="color:#4ADE80;">${safeRideId}</span>
            </p>
          </td>
        </tr></table>

      </td></tr>

      <!-- FOOTER -->
      <tr><td align="center" style="padding:28px 20px 0;">
        <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:11px;color:#374151;">&#169; ${year} UaTob &nbsp;&#183;&nbsp; Orlando, FL</p>
        <p style="margin:0;font-family:'Courier New',monospace;font-size:10px;color:#1f2937;">You&apos;re receiving this because you&apos;re listed as online in UaTob Dispatch.</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`.trim();

  const text =
    `New ride available on UaTob, ${driver.firstName || "Driver"}.\n\n` +
    `Payout:   ${payout}\n` +
    `Distance: ${distance}\n` +
    `Duration: ${duration}\n` +
    `Type:     ${ride.rideType || "Standard"}\n` +
    `Pickup:   ${ride.pickup   || "N/A"}\n` +
    `Dropoff:  ${ride.dropoff  || "N/A"}\n` +
    `Ride ID:  ${rideId}\n\n` +
    `Open the UaTob app to accept: https://uatob.com/driver/app`;

  return {
    to:      driver.email,
    from:    "UaTob Dispatch <noreply@uatob.com>",
    subject: `🚗 New ride · ${payout} payout · ${distance} — Accept now`,
    text,
    html,
  };
};

// ─────────────────────────────────────────────────────────────
// Helper: send emails one by one with per-email logging
// ─────────────────────────────────────────────────────────────
async function dispatchEmails({ drivers, ride, rideId, label }) {
  let sent   = 0;
  let failed = 0;

  console.log(`[dispatch] Sending to ${drivers.length} ${label} driver(s) for ride ${rideId}`);

  for (const driver of drivers) {
    const msg = buildCandidateEmail({
      driver,
      ride,
      rideId,
      totalCandidates: drivers.length,
    });

    try {
      await sgMail.send(msg);
      console.log(`[dispatch] ✅ Sent → ${driver.email} | ${driver.firstName || "?"} ${driver.lastName || ""} | [${label}]`);
      sent++;
    } catch (err) {
      console.error(`[dispatch] ❌ Failed → ${driver.email}:`, err?.response?.body ?? err.message);
      failed++;
    }
  }

  console.log(`[dispatch] Batch done — sent: ${sent}, failed: ${failed}`);
  return { sent, failed };
}

// ─────────────────────────────────────────────────────────────
// Scheduled Cloud Function — runs every 1 minute
//
// HOW THE FLAG WORKS:
//   - New rides are created with NO emailDispatched field at all
//   - This function queries searching rides, filters in memory
//     for any doc where emailDispatched !== true (covers both
//     missing field and explicit false from a rollback)
//   - A Firestore transaction atomically sets emailDispatched: true
//     before sending — prevents double-send on overlapping runs
//   - After emails go out, emailDispatchedAt + metadata are written
//   - On error, emailDispatched is rolled back to false so the
//     next run retries
//   - You never need to set emailDispatched on ride creation
// ─────────────────────────────────────────────────────────────
exports.emailCandidateDrivers = onSchedule(
  {
    schedule: "every 1 minutes",
    region:   "us-central1",
    secrets:  [SENDGRID_API_KEY],
  },
  async () => {
    sgMail.setApiKey(SENDGRID_API_KEY.value());

    // Only look at rides from the last 30 minutes — ignore abandoned ones
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);

    // Query by status + payment only — no emailDispatched filter
    // because the field does not exist on fresh ride documents.
    // We handle the "already dispatched" check in memory below.
    const ridesSnap = await db
      .collection("Rides")
      .where("status",           "==", "searching_driver")
      .where("paymentStatus",    "==", "succeeded")
      .where("driversNotified",  "==", false)
      .where("createdAt",        ">=", cutoff)
      .get();

    if (ridesSnap.empty) {
      console.log("[emailCandidateDrivers] No searching rides found.");
      return;
    }

    // Keep only rides that haven't been dispatched yet.
    // emailDispatched missing (new ride) OR false (rolled back) both pass.
    const unnotified = ridesSnap.docs.filter(
      (doc) => doc.data().emailDispatched !== true
    );

    if (!unnotified.length) {
      console.log("[emailCandidateDrivers] All searching rides already dispatched.");
      return;
    }

    console.log(`[emailCandidateDrivers] ${unnotified.length} ride(s) need dispatch.`);

    for (const rideDoc of unnotified) {
      const rideId = rideDoc.id;
      const ride   = rideDoc.data();

      console.log(`\n[emailCandidateDrivers] ── Ride ${rideId} ──`);
      console.log(`[emailCandidateDrivers] Pickup:  ${ride.pickup  || "N/A"}`);
      console.log(`[emailCandidateDrivers] Dropoff: ${ride.dropoff || "N/A"}`);
      console.log(`[emailCandidateDrivers] Payout:  $${ride.driverPayout ?? 0}`);

      // Atomically claim the ride before sending anything.
      // If two scheduler instances overlap, only one wins — the other
      // sees emailDispatched already true and skips cleanly.
      const alreadyClaimed = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(rideDoc.ref);
        if (fresh.data()?.emailDispatched === true) return true;
        tx.update(rideDoc.ref, { emailDispatched: true });
        return false;
      });

      if (alreadyClaimed) {
        console.log(`[emailCandidateDrivers] ⚠️  Ride ${rideId} claimed by another run — skipping.`);
        continue;
      }

      try {
        let drivers    = [];
        let usedSource = "";

        // ── Priority 1: candidateDriverUids on the ride doc ────────
        const candidateUids = ride.candidateDriverUids || [];

        if (candidateUids.length > 0) {
          console.log(`[emailCandidateDrivers] ${candidateUids.length} candidate UID(s) found — fetching profiles...`);

          const snaps = await Promise.all(
            candidateUids.map((uid) => db.collection("Drivers").doc(uid).get())
          );

          drivers = snaps
            .filter((doc) => doc.exists)
            .map((doc)    => doc.data())
            .filter((d)   => !!d.email);

          usedSource = "candidate";
          console.log(`[emailCandidateDrivers] ${drivers.length} candidate(s) with valid email.`);
        }

        // ── Priority 2: all online drivers (fallback) ──────────────
        if (drivers.length === 0) {
          console.log(`[emailCandidateDrivers] No valid candidates — falling back to all online drivers.`);

          const onlineSnap = await db
            .collection("Drivers")
            .where("status", "==", "online")
            .get();

          drivers = onlineSnap.docs
            .map((doc)  => doc.data())
            .filter((d) => !!d.email);

          usedSource = "online-fallback";
          console.log(`[emailCandidateDrivers] ${drivers.length} online driver(s) with valid email.`);
        }

        // ── No drivers at all ──────────────────────────────────────
        if (drivers.length === 0) {
          console.warn(`[emailCandidateDrivers] ⚠️  No drivers to notify for ride ${rideId}.`);
          await rideDoc.ref.update({
            emailDispatchedAt: FieldValue.serverTimestamp(),
            notifySource:      "none",
            notifySentCount:   0,
            notifyFailedCount: 0,
            notifyDriverCount: 0,
          });
          continue;
        }

        // ── Send emails one by one ─────────────────────────────────
        const { sent, failed } = await dispatchEmails({
          drivers,
          ride,
          rideId,
          label: usedSource,
        });

        // ── Write audit metadata — emailDispatched already true ────
        await rideDoc.ref.update({
          emailDispatchedAt: FieldValue.serverTimestamp(),
          notifySource:      usedSource,
          notifySentCount:   sent,
          notifyFailedCount: failed,
          notifyDriverCount: drivers.length,
        });

        console.log(`[emailCandidateDrivers] ✅ Ride ${rideId} complete — source: ${usedSource}, sent: ${sent}, failed: ${failed}`);

      } catch (err) {
        console.error(`[emailCandidateDrivers] ❌ Error on ride ${rideId}:`, err);

        // Roll back so the next run retries this ride
        try {
          await rideDoc.ref.update({ emailDispatched: false });
          console.log(`[emailCandidateDrivers] 🔄 Rolled back emailDispatched for ride ${rideId} — will retry next run.`);
        } catch (rollbackErr) {
          console.error(`[emailCandidateDrivers] ❌ Rollback failed for ride ${rideId}:`, rollbackErr);
        }
      }
    }

    console.log("\n[emailCandidateDrivers] ── Run complete ──");
  }
);
