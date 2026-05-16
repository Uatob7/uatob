// File: functions/midnightDriverOffline.js

const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ─────────────────────────────────────────────
// Email template
// ─────────────────────────────────────────────
function buildOfflineEmail(driverName) {
  const name = driverName?.split(" ")[0] || "there";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>You're now offline — UaTob</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@700;800;900&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: #060D18;
      font-family: 'Barlow', Arial, sans-serif;
      color: #CBD5E1;
      -webkit-font-smoothing: antialiased;
    }

    .wrapper {
      max-width: 560px;
      margin: 0 auto;
      padding: 40px 16px 60px;
    }

    /* ── Logo bar ── */
    .logo-bar {
      text-align: center;
      margin-bottom: 36px;
    }

    .logo-mark {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }

    .logo-arc {
      width: 36px;
      height: 36px;
    }

    .logo-wordmark {
      font-family: 'Barlow Condensed', Arial, sans-serif;
      font-size: 26px;
      font-weight: 900;
      letter-spacing: .06em;
      color: #F0FDFA;
      text-transform: uppercase;
    }

    /* ── Card ── */
    .card {
      background: linear-gradient(160deg, #0C1A2E 0%, #0E2236 60%, #0B2D2A 100%);
      border: 1px solid rgba(13, 148, 136, 0.22);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03) inset;
    }

    /* ── Header band ── */
    .card-header {
      background: linear-gradient(135deg, #0D9488 0%, #0891B2 100%);
      padding: 32px 36px 28px;
      position: relative;
      overflow: hidden;
    }

    .card-header::before {
      content: '';
      position: absolute;
      top: -40px; right: -40px;
      width: 180px; height: 180px;
      border-radius: 50%;
      background: rgba(255,255,255,0.08);
    }

    .card-header::after {
      content: '';
      position: absolute;
      bottom: -60px; left: -20px;
      width: 220px; height: 220px;
      border-radius: 50%;
      background: rgba(0,0,0,0.12);
    }

    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: rgba(0,0,0,0.25);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 99px;
      padding: 5px 13px 5px 9px;
      margin-bottom: 16px;
      position: relative;
      z-index: 1;
    }

    .chip-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #F87171;
      box-shadow: 0 0 8px rgba(248,113,113,0.8);
    }

    .chip-label {
      font-family: 'Barlow Condensed', Arial, sans-serif;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .12em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.9);
    }

    .header-title {
      font-family: 'Barlow Condensed', Arial, sans-serif;
      font-size: 36px;
      font-weight: 900;
      letter-spacing: -.01em;
      color: #fff;
      line-height: 1.05;
      position: relative;
      z-index: 1;
    }

    .header-sub {
      font-size: 14px;
      font-weight: 500;
      color: rgba(255,255,255,0.72);
      margin-top: 6px;
      position: relative;
      z-index: 1;
    }

    /* ── Body ── */
    .card-body {
      padding: 32px 36px;
    }

    .greeting {
      font-size: 16px;
      font-weight: 600;
      color: #E2E8F0;
      margin-bottom: 14px;
    }

    .body-text {
      font-size: 15px;
      font-weight: 400;
      color: #94A3B8;
      line-height: 1.7;
      margin-bottom: 28px;
    }

    /* ── Info row ── */
    .info-row {
      display: flex;
      gap: 12px;
      margin-bottom: 28px;
    }

    .info-tile {
      flex: 1;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 14px 16px;
      text-align: center;
    }

    .info-tile-label {
      font-family: 'Barlow Condensed', Arial, sans-serif;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .14em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.35);
      margin-bottom: 5px;
    }

    .info-tile-value {
      font-family: 'Barlow Condensed', Arial, sans-serif;
      font-size: 18px;
      font-weight: 900;
      letter-spacing: .02em;
      color: #F0FDFA;
    }

    .info-tile-value.red {
      color: #FCA5A5;
    }

    .info-tile-value.teal {
      color: #5EEAD4;
    }

    /* ── CTA button ── */
    .cta-wrap {
      text-align: center;
      margin-bottom: 28px;
    }

    .cta-btn {
      display: inline-block;
      background: linear-gradient(135deg, #0D9488, #0891B2);
      color: #fff !important;
      font-family: 'Barlow Condensed', Arial, sans-serif;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
      text-decoration: none;
      padding: 14px 36px;
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(13,148,136,0.35);
    }

    /* ── Divider ── */
    .divider {
      border: none;
      border-top: 1px solid rgba(255,255,255,0.07);
      margin: 0 0 24px;
    }

    /* ── Footer note ── */
    .footer-note {
      font-size: 13px;
      color: rgba(255,255,255,0.35);
      line-height: 1.6;
      text-align: center;
    }

    .footer-note a {
      color: #5EEAD4;
      text-decoration: none;
    }

    /* ── Bottom bar ── */
    .bottom-bar {
      text-align: center;
      margin-top: 28px;
    }

    .bottom-logo {
      font-family: 'Barlow Condensed', Arial, sans-serif;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: .14em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.2);
    }

    .bottom-tagline {
      font-size: 12px;
      color: rgba(255,255,255,0.15);
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <div class="wrapper">

    <!-- Logo -->
    <div class="logo-bar">
      <div class="logo-mark">
        <svg class="logo-arc" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 6 L8 22 Q8 30 18 30 Q28 30 28 22 L28 6" stroke="#0D9488" stroke-width="3.5" stroke-linecap="round" fill="none"/>
          <circle cx="18" cy="30" r="2.5" fill="#0891B2"/>
        </svg>
        <span class="logo-wordmark">UaTob</span>
      </div>
    </div>

    <!-- Card -->
    <div class="card">

      <!-- Header -->
      <div class="card-header">
        <div class="status-chip">
          <div class="chip-dot"></div>
          <span class="chip-label">Auto Offline</span>
        </div>
        <div class="header-title">You're offline<br/>for the night.</div>
        <div class="header-sub">Midnight reset · Eastern Time</div>
      </div>

      <!-- Body -->
      <div class="card-body">

        <div class="greeting">Hey ${name},</div>

        <div class="body-text">
          We automatically set your status to <strong style="color:#E2E8F0;">offline</strong> at midnight
          so you're never accidentally shown as available while you sleep.
          Open the app anytime to go back online and start receiving requests.
        </div>

        <!-- Info tiles -->
        <div class="info-row">
          <div class="info-tile">
            <div class="info-tile-label">Status</div>
            <div class="info-tile-value red">Offline</div>
          </div>
          <div class="info-tile">
            <div class="info-tile-label">Reset at</div>
            <div class="info-tile-value">12:00 AM</div>
          </div>
          <div class="info-tile">
            <div class="info-tile-label">Go live</div>
            <div class="info-tile-value teal">Anytime</div>
          </div>
        </div>

        <!-- CTA -->
        <div class="cta-wrap">
          <a href="https://uatob.com" class="cta-btn">Open the App →</a>
        </div>

        <hr class="divider"/>

        <div class="footer-note">
          Questions? Reply to this email or visit
          <a href="https://uatob.com">uatob.com</a>.<br/>
          Thanks for driving with UaTob — drive safe out there.
        </div>

      </div>
    </div>

    <!-- Bottom bar -->
    <div class="bottom-bar">
      <div class="bottom-logo">UaTob · Orlando, FL</div>
      <div class="bottom-tagline">© ${new Date().getFullYear()} UaTob LLC · All rights reserved</div>
    </div>

  </div>
</body>
</html>
  `.trim();

  const text =
    `Hey ${name},\n\n` +
    `We automatically set your driver status to OFFLINE at midnight so you're never shown as available while you sleep.\n\n` +
    `Open the app anytime to go back online and start receiving ride requests.\n\n` +
    `Status: Offline\n` +
    `Reset at: 12:00 AM ET\n` +
    `Go live: Anytime — just open the app\n\n` +
    `Questions? Reply to this email or visit uatob.com.\n\n` +
    `Drive safe,\n` +
    `— UaTob Team`;

  return {
    subject: "You're offline for the night — UaTob",
    text,
    html,
  };
}

// ─────────────────────────────────────────────
// Scheduled job
// ─────────────────────────────────────────────
exports.midnightDriverOffline = onSchedule(
  {
    schedule: "0 0 * * *", // midnight
    timeZone: "America/New_York",
    region: "us-east1",
  },
  async () => {
    console.log("[midnightDriverOffline] running...");

    // 1. Get all online drivers
    const snap = await db
      .collection("Drivers")
      .where("status", "==", "online")
      .get();

    if (snap.empty) {
      console.log("[midnightDriverOffline] no online drivers found");
      return;
    }

    console.log(`[midnightDriverOffline] found ${snap.size} driver(s)`);

    // 2. Init SendGrid
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    // 3. Process drivers
    const tasks = snap.docs.map(async (doc) => {
      const driver = doc.data();
      const driverId = doc.id;

      try {
        // Update status
        await doc.ref.update({
          status: "offline",
          autoOfflineAt: FieldValue.serverTimestamp(),
        });

        // Send email
        if (driver.email) {
          const email = buildOfflineEmail(driver.name);

          await sgMail.send({
            to: driver.email,
            from: "UaTob Team <noreply@uatob.com>",
            subject: email.subject,
            text: email.text,
            html: email.html,
          });
        }

        console.log(`✔ Driver ${driverId} set offline`);
      } catch (err) {
        console.error(
          `[midnightDriverOffline] error driver ${driverId}:`,
          err?.message || err
        );
      }
    });

    await Promise.allSettled(tasks);

    console.log("[midnightDriverOffline] complete");
  }
);

