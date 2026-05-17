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
// Email template — Midnight surge recruiting
// ─────────────────────────────────────────────
function buildMidnightSurgeEmail(driverName) {
  const name = driverName?.split(" ")[0] || "there";

  // Compute the "go-online by" window — 4 AM ET
  const now = new Date();
  const dayLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "America/New_York",
  });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Orlando is going late — UaTob</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@700;800;900&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: #060D18;
      font-family: 'Barlow', Arial, sans-serif;
      color: #CBD5E1;
      -webkit-font-smoothing: antialiased;
    }

    .wrapper {
      max-width: 580px;
      margin: 0 auto;
      padding: 36px 16px 60px;
    }

    /* ── Logo bar ── */
    .logo-bar {
      text-align: center;
      margin-bottom: 28px;
    }

    .logo-mark {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }

    .logo-arc { width: 36px; height: 36px; }

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
      border-radius: 22px;
      overflow: hidden;
      box-shadow: 0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03) inset;
    }

    /* ── Hero header — amber/orange surge palette ── */
    .card-header {
      background:
        radial-gradient(circle at 80% 20%, rgba(251,191,36,0.25) 0%, transparent 60%),
        linear-gradient(135deg, #1E1B0F 0%, #2B2410 50%, #3F2F12 100%);
      padding: 36px 36px 32px;
      position: relative;
      overflow: hidden;
      border-bottom: 1px solid rgba(251,191,36,0.18);
    }

    .card-header::before {
      content: '';
      position: absolute;
      top: -80px; right: -80px;
      width: 240px; height: 240px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(245,158,11,0.18) 0%, transparent 70%);
    }

    .card-header::after {
      content: '';
      position: absolute;
      bottom: -90px; left: -40px;
      width: 260px; height: 260px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(13,148,136,0.10) 0%, transparent 70%);
    }

    .surge-chip {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: rgba(245,158,11,0.18);
      border: 1px solid rgba(251,191,36,0.45);
      border-radius: 99px;
      padding: 6px 13px 6px 9px;
      margin-bottom: 18px;
      position: relative;
      z-index: 1;
    }

    .chip-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #FBBF24;
      box-shadow: 0 0 12px rgba(251,191,36,0.9);
    }

    .chip-label {
      font-family: 'Barlow Condensed', Arial, sans-serif;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .14em;
      text-transform: uppercase;
      color: #FCD34D;
    }

    .header-title {
      font-family: 'Barlow Condensed', Arial, sans-serif;
      font-size: 38px;
      font-weight: 900;
      letter-spacing: -.005em;
      color: #fff;
      line-height: 1.02;
      position: relative;
      z-index: 1;
      margin-bottom: 8px;
    }

    .header-title .accent {
      color: #FBBF24;
    }

    .header-sub {
      font-size: 14px;
      font-weight: 500;
      color: rgba(255,255,255,0.75);
      line-height: 1.45;
      position: relative;
      z-index: 1;
      max-width: 420px;
    }

    /* ── Body ── */
    .card-body { padding: 32px 36px 8px; }

    .greeting {
      font-size: 16px;
      font-weight: 700;
      color: #F0FDFA;
      margin-bottom: 12px;
    }

    .body-text {
      font-size: 15px;
      font-weight: 400;
      color: #94A3B8;
      line-height: 1.65;
      margin-bottom: 26px;
    }

    .body-text strong {
      color: #E2E8F0;
      font-weight: 700;
    }

    /* ── Demand windows section ── */
    .section-label {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 14px;
    }

    .section-label-bar {
      width: 3px; height: 14px;
      background: linear-gradient(180deg, #FBBF24, #D97706);
      border-radius: 99px;
    }

    .section-label-text {
      font-family: 'Barlow Condensed', Arial, sans-serif;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .14em;
      text-transform: uppercase;
      color: rgba(251,191,36,0.85);
    }

    .window-row {
      display: flex;
      gap: 10px;
      margin-bottom: 28px;
    }

    .window-tile {
      flex: 1;
      background: rgba(251,191,36,0.05);
      border: 1px solid rgba(251,191,36,0.18);
      border-radius: 13px;
      padding: 13px 12px;
      text-align: left;
    }

    .window-time {
      font-family: 'Barlow Condensed', Arial, sans-serif;
      font-size: 14px;
      font-weight: 900;
      letter-spacing: .02em;
      color: #FCD34D;
      margin-bottom: 4px;
    }

    .window-desc {
      font-size: 11px;
      font-weight: 500;
      color: rgba(255,255,255,0.55);
      line-height: 1.4;
    }

    /* ── Pitch box ── */
    .pitch-box {
      background: linear-gradient(135deg, rgba(13,148,136,0.10) 0%, rgba(8,145,178,0.10) 100%);
      border: 1px solid rgba(13,148,136,0.30);
      border-radius: 14px;
      padding: 18px 20px;
      margin-bottom: 26px;
    }

    .pitch-row {
      display: flex;
      align-items: flex-start;
      gap: 11px;
    }

    .pitch-row + .pitch-row { margin-top: 10px; }

    .pitch-dot {
      flex-shrink: 0;
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #2DD4BF;
      margin-top: 7px;
      box-shadow: 0 0 8px rgba(45,212,191,0.6);
    }

    .pitch-line {
      font-size: 14px;
      font-weight: 500;
      color: #E2E8F0;
      line-height: 1.5;
    }

    .pitch-line strong {
      color: #5EEAD4;
      font-weight: 700;
    }

    /* ── CTA ── */
    .cta-wrap {
      text-align: center;
      margin-bottom: 12px;
    }

    .cta-btn {
      display: inline-block;
      background: linear-gradient(135deg, #FBBF24 0%, #F59E0B 60%, #D97706 100%);
      color: #1A1207 !important;
      font-family: 'Barlow Condensed', Arial, sans-serif;
      font-size: 16px;
      font-weight: 900;
      letter-spacing: .08em;
      text-transform: uppercase;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(251,191,36,0.30), 0 0 0 1px rgba(252,211,77,0.5) inset;
    }

    .cta-helper {
      font-size: 12px;
      font-weight: 500;
      color: rgba(255,255,255,0.4);
      margin-top: 10px;
      text-align: center;
    }

    /* ── Reset notice — footer style ── */
    .reset-box {
      margin-top: 28px;
      padding: 16px 18px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 12px;
    }

    .reset-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .reset-icon {
      flex-shrink: 0;
      width: 22px; height: 22px;
      border-radius: 50%;
      background: rgba(248,113,113,0.15);
      border: 1px solid rgba(248,113,113,0.35);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 900;
      color: #FCA5A5;
      font-family: 'Barlow Condensed', Arial, sans-serif;
    }

    .reset-text {
      font-size: 12px;
      font-weight: 500;
      color: rgba(255,255,255,0.55);
      line-height: 1.5;
    }

    .reset-text strong {
      color: #FCA5A5;
      font-weight: 700;
    }

    /* ── Divider ── */
    .divider {
      border: none;
      border-top: 1px solid rgba(255,255,255,0.07);
      margin: 26px 0 20px;
    }

    /* ── Footer note ── */
    .footer-note {
      font-size: 13px;
      color: rgba(255,255,255,0.4);
      line-height: 1.6;
      text-align: center;
      padding: 0 36px 32px;
    }

    .footer-note a {
      color: #5EEAD4;
      text-decoration: none;
      font-weight: 600;
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

      <!-- Hero -->
      <div class="card-header">
        <div class="surge-chip">
          <div class="chip-dot"></div>
          <span class="chip-label">Late Night · ${dayLabel}</span>
        </div>
        <div class="header-title">
          Orlando is<br/>
          <span class="accent">going late.</span>
        </div>
        <div class="header-sub">
          Bars close. Clubs let out. MCO red-eyes land.
          The riders who tip best are out right now —
          and most drivers are asleep.
        </div>
      </div>

      <!-- Body -->
      <div class="card-body">

        <div class="greeting">Hey ${name},</div>

        <div class="body-text">
          Midnight just hit and you're currently <strong>offline</strong> — a nightly
          safety reset we do so no one's accidentally shown as available while sleeping.
          But the night isn't over. Tap the button below to flip back online and catch
          the late-night runs while the streets are still moving.
        </div>

        <!-- Demand windows -->
        <div class="section-label">
          <div class="section-label-bar"></div>
          <div class="section-label-text">Tonight's Demand Windows</div>
        </div>

        <div class="window-row">
          <div class="window-tile">
            <div class="window-time">12 — 2 AM</div>
            <div class="window-desc">Bar close · Downtown<br/>Wall St · Mills 50</div>
          </div>
          <div class="window-tile">
            <div class="window-time">2 — 4 AM</div>
            <div class="window-desc">Club close · I-Drive<br/>Disney Springs</div>
          </div>
          <div class="window-tile">
            <div class="window-time">4 — 6 AM</div>
            <div class="window-desc">MCO red-eyes<br/>Early hotel runs</div>
          </div>
        </div>

        <!-- Pitch -->
        <div class="pitch-box">
          <div class="pitch-row">
            <div class="pitch-dot"></div>
            <div class="pitch-line">
              <strong>Less competition.</strong> Most rideshare drivers
              log off by midnight — you'll be one of few choices.
            </div>
          </div>
          <div class="pitch-row">
            <div class="pitch-dot"></div>
            <div class="pitch-line">
              <strong>Better fares.</strong> Late-night riders pick UaTob
              because they're already done dealing with surge pricing elsewhere.
            </div>
          </div>
          <div class="pitch-row">
            <div class="pitch-dot"></div>
            <div class="pitch-line">
              <strong>Cash welcome.</strong> Bar crowds pay cash. You keep
              every dollar at the curb — no waiting on payouts.
            </div>
          </div>
        </div>

        <!-- CTA -->
        <div class="cta-wrap">
          <a href="https://uatob.com/driver/app" class="cta-btn">Go Online Now →</a>
          <div class="cta-helper">One tap. You're back live in seconds.</div>
        </div>

        <!-- Reset notice (now footer-style, not hero) -->
        <div class="reset-box">
          <div class="reset-row">
            <div class="reset-icon">i</div>
            <div class="reset-text">
              <strong>Why am I offline?</strong> &nbsp;UaTob auto-resets every driver
              to offline at midnight ET. It's a nightly safety net so you're never
              shown as available while you're asleep. You're in control — flip back
              online whenever you're ready to drive.
            </div>
          </div>
        </div>

        <hr class="divider"/>

        <div class="footer-note">
          Driving tonight? Stay hydrated and watch for tired drivers on the road.<br/>
          Questions? Reply to this email or visit
          <a href="https://uatob.com">uatob.com</a>.
        </div>

      </div>
    </div>

    <!-- Bottom bar -->
    <div class="bottom-bar">
      <div class="bottom-logo">UaTob · Orlando, FL</div>
      <div class="bottom-tagline">© ${new Date().getFullYear()} UaTob LLC · Drive safe.</div>
    </div>

  </div>
</body>
</html>
  `.trim();

  const text =
    `Hey ${name},\n\n` +
    `Orlando is going late tonight.\n\n` +
    `You've been auto-reset to OFFLINE at midnight (our nightly safety reset). But the city's still moving — bars closing, clubs letting out, MCO red-eyes landing. Riders need rides and most drivers are asleep.\n\n` +
    `TONIGHT'S DEMAND WINDOWS\n` +
    `─────────────────────────\n` +
    `12 – 2 AM    Bar close · Downtown · Wall St · Mills 50\n` +
    `2 – 4 AM     Club close · I-Drive · Disney Springs\n` +
    `4 – 6 AM     MCO red-eyes · Early hotel runs\n\n` +
    `Why go back online now:\n` +
    `• Less competition — most rideshare drivers log off by midnight\n` +
    `• Better fares — late-night riders pick UaTob over surge pricing\n` +
    `• Cash welcome — bar crowds pay at the curb, no payout wait\n\n` +
    `One tap to go back online: https://uatob.com/driver/app\n\n` +
    `Why am I offline?\n` +
    `UaTob auto-resets every driver to offline at midnight ET. It's a nightly safety net so you're never shown as available while asleep. You're in control — flip back online whenever you're ready.\n\n` +
    `Drive safe,\n` +
    `— UaTob Team`;

  return {
    subject: "Orlando's going late — flip back online",
    text,
    html,
  };
}

// ─────────────────────────────────────────────
// Scheduled job
// ─────────────────────────────────────────────
exports.midnightDriverOffline = onSchedule(
  {
    schedule: "0 0 * * *", // midnight ET
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

    console.log(`[midnightDriverOffline] found ${snap.size} online driver(s)`);

    // 2. Also pull APPROVED but offline drivers — we want to recruit them too
    const approvedOfflineSnap = await db
      .collection("Drivers")
      .where("approvedAt", "!=", null)
      .where("status", "==", "offline")
      .get();

    console.log(
      `[midnightDriverOffline] additionally recruiting ${approvedOfflineSnap.size} offline-but-approved driver(s)`
    );

    // 3. Init SendGrid
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    // 4. Process currently-online drivers: flip offline + email
    const onlineTasks = snap.docs.map(async (doc) => {
      const driver = doc.data();
      const driverId = doc.id;

      try {
        await doc.ref.update({
          status: "offline",
          autoOfflineAt: FieldValue.serverTimestamp(),
        });

        if (driver.email) {
          const email = buildMidnightSurgeEmail(driver.firstName || driver.name);
          await sgMail.send({
            to: driver.email,
            from: "UaTob Team <noreply@uatob.com>",
            subject: email.subject,
            text: email.text,
            html: email.html,
          });
        }

        console.log(`✔ Driver ${driverId} reset offline + surge email sent`);
      } catch (err) {
        console.error(
          `[midnightDriverOffline] error driver ${driverId}:`,
          err?.message || err
        );
      }
    });

    // 5. Process already-offline approved drivers: just email (don't touch status)
    const offlineTasks = approvedOfflineSnap.docs.map(async (doc) => {
      const driver = doc.data();
      const driverId = doc.id;

      try {
        if (!driver.email) return;

        // Skip drivers we recruited within the last 18 hours to avoid spam
        const lastEmailedMs = driver.lastMidnightSurgeEmailAt?.toMillis?.() ?? 0;
        if (Date.now() - lastEmailedMs < 18 * 60 * 60 * 1000) {
          return;
        }

        const email = buildMidnightSurgeEmail(driver.firstName || driver.name);
        await sgMail.send({
          to: driver.email,
          from: "UaTob Team <noreply@uatob.com>",
          subject: email.subject,
          text: email.text,
          html: email.html,
        });

        await doc.ref.update({
          lastMidnightSurgeEmailAt: FieldValue.serverTimestamp(),
        });

        console.log(`✔ Offline driver ${driverId} surge email sent`);
      } catch (err) {
        console.error(
          `[midnightDriverOffline] error offline driver ${driverId}:`,
          err?.message || err
        );
      }
    });

    await Promise.allSettled([...onlineTasks, ...offlineTasks]);

    console.log("[midnightDriverOffline] complete");
  }
);
