// File: functions/midnightDriverOffline.js
//
// Midnight job (00:00 ET nightly). Three driver states, three different emails:
//
//   "online"   → currently online. Flip to offline + send surge reactivation email
//                with reset-explanation footer.
//   "offline"  → has driven before but offline tonight. Send surge re-engagement
//                email. No reset footer (status didn't change).
//   "approved" → approved but NEVER gone online. Send WELCOME / activation email
//                (no surge talk — they have no mental model for it).
//
// All emails honor an 18-hour cooldown via lastMidnightEmailAt to prevent spam.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");
const COOLDOWN_MS = 18 * 60 * 60 * 1000;

// ═══════════════════════════════════════════════════════════════════════
// SURGE EMAIL — used for "online" + "offline" variants
// ═══════════════════════════════════════════════════════════════════════
function buildSurgeEmail(driverName, wasOnline) {
  const name = driverName?.split(" ")[0] || "there";
  const dayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "America/New_York",
  });

  // Different opener depending on whether we just reset them or not
  const greetingHtml = wasOnline
    ? `Midnight just hit and we automatically set your status to <strong>offline</strong> — a nightly safety reset so no one's shown as available while asleep. But the city is still moving. Flip back online and catch the late runs.`
    : `You've been offline today and that's your call. But the next few hours are the busiest window UaTob sees all day — bar close, club close, then MCO red-eyes — and most drivers are already asleep. If you've got time tonight, this is when it pays.`;

  const greetingText = wasOnline
    ? `Midnight just hit and we automatically set your status to OFFLINE — a nightly safety reset so no one's shown as available while asleep. But the city is still moving. Flip back online and catch the late runs.`
    : `You've been offline today and that's your call. But the next few hours are the busiest window UaTob sees all day — bar close, club close, then MCO red-eyes — and most drivers are already asleep. If you've got time tonight, this is when it pays.`;

  const sectionLabel = wasOnline ? "Tonight's demand windows" : "Where the money is tonight";
  const subject = wasOnline
    ? "Orlando's going late — flip back online"
    : "Orlando's going late — drivers needed now";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#060D18;font-family:'Barlow',Arial,sans-serif;color:#CBD5E1;-webkit-font-smoothing:antialiased;">
  <div style="max-width:580px;margin:0 auto;padding:36px 16px 60px;">

    <!-- Logo -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-flex;align-items:center;gap:10px;">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 6 L8 22 Q8 30 18 30 Q28 30 28 22 L28 6" stroke="#0D9488" stroke-width="3.5" stroke-linecap="round" fill="none"/>
          <circle cx="18" cy="30" r="2.5" fill="#0891B2"/>
        </svg>
        <span style="font-family:Arial,sans-serif;font-size:26px;font-weight:900;letter-spacing:.06em;color:#F0FDFA;text-transform:uppercase;">UaTob</span>
      </div>
    </div>

    <!-- Card -->
    <div style="background:linear-gradient(160deg,#0C1A2E 0%,#0E2236 60%,#0B2D2A 100%);border:1px solid rgba(13,148,136,0.22);border-radius:22px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.55);">

      <!-- Hero (amber/surge) -->
      <div style="background:linear-gradient(135deg,#1E1B0F 0%,#2B2410 50%,#3F2F12 100%);padding:36px 36px 32px;border-bottom:1px solid rgba(251,191,36,0.18);">
        <div style="display:inline-flex;align-items:center;gap:7px;background:rgba(245,158,11,0.18);border:1px solid rgba(251,191,36,0.45);border-radius:99px;padding:6px 13px 6px 9px;margin-bottom:18px;">
          <div style="width:8px;height:8px;border-radius:50%;background:#FBBF24;box-shadow:0 0 12px rgba(251,191,36,0.9);"></div>
          <span style="font-family:Arial,sans-serif;font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#FCD34D;">Late Night · ${dayLabel}</span>
        </div>
        <div style="font-family:Arial,sans-serif;font-size:38px;font-weight:900;letter-spacing:-.005em;color:#fff;line-height:1.02;margin-bottom:8px;">
          Orlando is<br/><span style="color:#FBBF24;">going late.</span>
        </div>
        <div style="font-size:14px;font-weight:500;color:rgba(255,255,255,0.75);line-height:1.45;max-width:420px;">
          Bars close. Clubs let out. MCO red-eyes land. The riders who tip best are out right now — and most drivers are asleep.
        </div>
      </div>

      <!-- Body -->
      <div style="padding:32px 36px 8px;">

        <div style="font-size:16px;font-weight:700;color:#F0FDFA;margin-bottom:12px;">Hey ${name},</div>

        <div style="font-size:15px;color:#94A3B8;line-height:1.65;margin-bottom:26px;">${greetingHtml}</div>

        <!-- Demand windows -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
          <div style="width:3px;height:14px;background:linear-gradient(180deg,#FBBF24,#D97706);border-radius:99px;"></div>
          <div style="font-family:Arial,sans-serif;font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:rgba(251,191,36,0.85);">${sectionLabel}</div>
        </div>

        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:28px;">
          <tr>
            <td style="background:rgba(251,191,36,0.05);border:1px solid rgba(251,191,36,0.18);border-radius:13px;padding:13px 12px;width:33%;">
              <div style="font-family:Arial,sans-serif;font-size:14px;font-weight:900;color:#FCD34D;margin-bottom:4px;">12 — 2 AM</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.55);line-height:1.4;">Bar close · Downtown<br/>Wall St · Mills 50</div>
            </td>
            <td style="width:10px;"></td>
            <td style="background:rgba(251,191,36,0.05);border:1px solid rgba(251,191,36,0.18);border-radius:13px;padding:13px 12px;width:33%;">
              <div style="font-family:Arial,sans-serif;font-size:14px;font-weight:900;color:#FCD34D;margin-bottom:4px;">2 — 4 AM</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.55);line-height:1.4;">Club close · I-Drive<br/>Disney Springs</div>
            </td>
            <td style="width:10px;"></td>
            <td style="background:rgba(251,191,36,0.05);border:1px solid rgba(251,191,36,0.18);border-radius:13px;padding:13px 12px;width:33%;">
              <div style="font-family:Arial,sans-serif;font-size:14px;font-weight:900;color:#FCD34D;margin-bottom:4px;">4 — 6 AM</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.55);line-height:1.4;">MCO red-eyes<br/>Hotel runs</div>
            </td>
          </tr>
        </table>

        <!-- Pitch -->
        <div style="background:linear-gradient(135deg,rgba(13,148,136,0.10) 0%,rgba(8,145,178,0.10) 100%);border:1px solid rgba(13,148,136,0.30);border-radius:14px;padding:18px 20px;margin-bottom:26px;">
          <div style="font-size:14px;color:#E2E8F0;line-height:1.5;margin-bottom:10px;">
            <strong style="color:#5EEAD4;">Less competition.</strong> Most rideshare drivers log off by midnight — you'll be one of few choices.
          </div>
          <div style="font-size:14px;color:#E2E8F0;line-height:1.5;margin-bottom:10px;">
            <strong style="color:#5EEAD4;">Better fares.</strong> Late-night riders pick UaTob because they're done dealing with surge pricing elsewhere.
          </div>
          <div style="font-size:14px;color:#E2E8F0;line-height:1.5;">
            <strong style="color:#5EEAD4;">Cash welcome.</strong> Bar crowds pay cash. You keep every dollar at the curb — no waiting on payouts.
          </div>
        </div>

        <!-- CTA -->
        <div style="text-align:center;margin-bottom:12px;">
          <a href="https://uatob.com/driver/app" style="display:inline-block;background:linear-gradient(135deg,#FBBF24 0%,#F59E0B 60%,#D97706 100%);color:#1A1207;font-family:Arial,sans-serif;font-size:16px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;text-decoration:none;padding:16px 40px;border-radius:12px;box-shadow:0 12px 32px rgba(251,191,36,0.30);">Go Online Now →</a>
          <div style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:10px;">One tap. You're back live in seconds.</div>
        </div>

        ${wasOnline ? `
          <div style="margin-top:28px;padding:16px 18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:rgba(248,113,113,0.15);border:1px solid rgba(248,113,113,0.35);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#FCA5A5;">i</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.55);line-height:1.5;">
                <strong style="color:#FCA5A5;">Why am I offline?</strong> UaTob auto-resets every online driver to offline at midnight ET — a nightly safety net so you're never shown as available while asleep.
              </div>
            </div>
          </div>
        ` : ''}

        <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:26px 0 20px;"/>

        <div style="font-size:13px;color:rgba(255,255,255,0.4);line-height:1.6;text-align:center;padding-bottom:32px;">
          Driving tonight? Stay hydrated and watch for tired drivers.<br/>
          Questions? Reply to this email or visit <a href="https://uatob.com" style="color:#5EEAD4;text-decoration:none;font-weight:600;">uatob.com</a>.
        </div>

      </div>
    </div>

    <div style="text-align:center;margin-top:28px;">
      <div style="font-family:Arial,sans-serif;font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,0.2);">UaTob · Orlando, FL</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.15);margin-top:4px;">© ${new Date().getFullYear()} UaTob LLC · Drive safe.</div>
    </div>

  </div>
</body>
</html>`.trim();

  const text =
    `Hey ${name},\n\n` +
    `${greetingText}\n\n` +
    `${sectionLabel.toUpperCase()}\n` +
    `─────────────────────────\n` +
    `12 – 2 AM    Bar close · Downtown · Wall St · Mills 50\n` +
    `2 – 4 AM     Club close · I-Drive · Disney Springs\n` +
    `4 – 6 AM     MCO red-eyes · Hotel runs\n\n` +
    `Why go online now:\n` +
    `• Less competition — most rideshare drivers log off by midnight\n` +
    `• Better fares — late-night riders pick UaTob over surge pricing\n` +
    `• Cash welcome — bar crowds pay at the curb, no payout wait\n\n` +
    `Go online: https://uatob.com/driver/app\n\n` +
    (wasOnline ? `Why am I offline? UaTob auto-resets every online driver to offline at midnight ET — a nightly safety net so you're never shown as available while asleep.\n\n` : '') +
    `Drive safe,\n— UaTob Team`;

  return { subject, html, text };
}

// ═══════════════════════════════════════════════════════════════════════
// WELCOME / ACTIVATION EMAIL — for "approved" drivers who never went online
// No surge talk. Warm, instructional, low-pressure.
// ═══════════════════════════════════════════════════════════════════════
function buildWelcomeEmail(driverName) {
  const name = driverName?.split(" ")[0] || "there";

  const subject = `${name}, you're approved to drive — let's get your first ride in`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#FAFAF9;font-family:Georgia,serif;color:#1A1A1A;-webkit-font-smoothing:antialiased;">
  <div style="max-width:580px;margin:0 auto;padding:40px 16px 60px;">

    <!-- Logo -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-flex;align-items:center;gap:10px;">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 6 L8 22 Q8 30 18 30 Q28 30 28 22 L28 6" stroke="#0D9488" stroke-width="3.5" stroke-linecap="round" fill="none"/>
          <circle cx="18" cy="30" r="2.5" fill="#0891B2"/>
        </svg>
        <span style="font-family:Arial,sans-serif;font-size:26px;font-weight:900;letter-spacing:.06em;color:#0F172A;text-transform:uppercase;">UaTob</span>
      </div>
    </div>

    <!-- Card -->
    <div style="background:#FFFFFF;border:1px solid #E5E5E1;border-radius:18px;overflow:hidden;box-shadow:0 12px 32px rgba(15,23,42,0.06);">

      <!-- Hero (clean / instructional, NOT surge) -->
      <div style="background:linear-gradient(160deg,#F0FDFA 0%,#ECFEFF 100%);padding:36px 36px 28px;border-bottom:1px solid rgba(13,148,136,0.18);">
        <div style="display:inline-flex;align-items:center;gap:7px;background:rgba(13,148,136,0.10);border:1px solid rgba(13,148,136,0.30);border-radius:99px;padding:5px 12px 5px 8px;margin-bottom:18px;">
          <div style="width:7px;height:7px;border-radius:50%;background:#0D9488;"></div>
          <span style="font-family:Arial,sans-serif;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#0F766E;">Approved Driver</span>
        </div>
        <div style="font-family:Georgia,serif;font-size:32px;font-weight:700;color:#0F172A;line-height:1.15;letter-spacing:-.01em;margin-bottom:10px;">
          You're approved, ${name}.<br/>
          <span style="color:#0D9488;">Let's get you driving.</span>
        </div>
        <div style="font-size:15px;color:#475569;line-height:1.55;max-width:440px;">
          Your background check cleared and your account is fully approved. Whenever you're ready to start earning, just flip yourself online.
        </div>
      </div>

      <!-- Body -->
      <div style="padding:32px 36px;">

        <div style="font-size:15px;color:#475569;line-height:1.7;margin-bottom:28px;">
          Most new UaTob drivers' best night is their first night — less pressure, fewer expectations, you just learn the flow. Here's how to start.
        </div>

        <!-- Steps -->
        <div style="margin-bottom:32px;">

          <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:22px;">
            <div style="flex-shrink:0;width:36px;height:36px;border-radius:50%;background:#0D9488;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-size:17px;font-weight:700;">1</div>
            <div>
              <div style="font-family:Georgia,serif;font-size:16px;font-weight:700;color:#0F172A;margin-bottom:4px;">Open the driver app</div>
              <div style="font-size:14px;color:#475569;line-height:1.55;">Tap the link below or go to uatob.com/driver/app on your phone. No app download needed — it works right in your browser.</div>
            </div>
          </div>

          <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:22px;">
            <div style="flex-shrink:0;width:36px;height:36px;border-radius:50%;background:#0D9488;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-size:17px;font-weight:700;">2</div>
            <div>
              <div style="font-family:Georgia,serif;font-size:16px;font-weight:700;color:#0F172A;margin-bottom:4px;">Flip yourself online</div>
              <div style="font-size:14px;color:#475569;line-height:1.55;">One tap on the "Go Online" button. That's it — you'll start receiving ride requests in your area.</div>
            </div>
          </div>

          <div style="display:flex;align-items:flex-start;gap:16px;">
            <div style="flex-shrink:0;width:36px;height:36px;border-radius:50%;background:#0D9488;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-size:17px;font-weight:700;">3</div>
            <div>
              <div style="font-family:Georgia,serif;font-size:16px;font-weight:700;color:#0F172A;margin-bottom:4px;">Accept your first ride</div>
              <div style="font-size:14px;color:#475569;line-height:1.55;">When a request comes in you have 30 seconds to accept. Tap accept, drive to pickup, complete the trip. UaTob handles the rest — payment, payout, all of it.</div>
            </div>
          </div>

        </div>

        <!-- Earnings note -->
        <div style="background:#F0FDFA;border:1px solid rgba(13,148,136,0.20);border-radius:12px;padding:18px 20px;margin-bottom:28px;">
          <div style="font-family:Arial,sans-serif;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#0F766E;margin-bottom:6px;">Your Earnings</div>
          <div style="font-size:14px;color:#0F172A;line-height:1.6;">
            You keep <strong style="color:#0D9488;">75%</strong> of every fare. UaTob takes 25% to keep the platform running. Cash rides go straight in your pocket at the curb — we settle the platform fee from your card and Cash App rides automatically.
          </div>
        </div>

        <!-- CTA -->
        <div style="text-align:center;margin-bottom:8px;">
          <a href="https://uatob.com/driver/app" style="display:inline-block;background:#0D9488;color:#fff;font-family:Arial,sans-serif;font-size:15px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;text-decoration:none;padding:16px 40px;border-radius:12px;box-shadow:0 8px 24px rgba(13,148,136,0.30);">Open Driver App →</a>
          <div style="font-size:12px;color:#94A3B8;margin-top:12px;font-family:Georgia,serif;font-style:italic;">No app to install. Works on any phone.</div>
        </div>

        <hr style="border:none;border-top:1px solid #E5E5E1;margin:28px 0 20px;"/>

        <div style="font-size:13px;color:#64748B;line-height:1.7;text-align:center;">
          Questions about your first ride? Just reply to this email — a real person will get back to you.<br/>
          We're rooting for you, ${name}.
        </div>

      </div>
    </div>

    <div style="text-align:center;margin-top:24px;font-family:Arial,sans-serif;">
      <div style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#94A3B8;">UaTob · Orlando, FL</div>
      <div style="font-size:11px;color:#CBD5E1;margin-top:4px;font-family:Georgia,serif;">© ${new Date().getFullYear()} UaTob LLC</div>
    </div>

  </div>
</body>
</html>`.trim();

  const text =
    `Hey ${name},\n\n` +
    `Good news: you're approved to drive on UaTob.\n\n` +
    `Your background check cleared and your account is fully ready. Whenever you want to start earning, just flip yourself online — most new UaTob drivers' best night is their first one.\n\n` +
    `HOW TO START\n` +
    `─────────────\n\n` +
    `1. OPEN THE DRIVER APP\n` +
    `   Go to uatob.com/driver/app on your phone. No app download needed.\n\n` +
    `2. FLIP YOURSELF ONLINE\n` +
    `   One tap on the "Go Online" button. You'll start receiving ride requests in your area.\n\n` +
    `3. ACCEPT YOUR FIRST RIDE\n` +
    `   30 seconds to accept. Drive to pickup. Complete the trip. UaTob handles payment and payout.\n\n` +
    `YOUR EARNINGS\n` +
    `You keep 75% of every fare. Cash rides go straight in your pocket at the curb — we settle the platform fee from your card/Cash App rides automatically.\n\n` +
    `Get started: https://uatob.com/driver/app\n\n` +
    `Questions about your first ride? Reply to this email — a real person will get back to you.\n\n` +
    `We're rooting for you, ${name}.\n— UaTob Team`;

  return { subject, html, text };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN SCHEDULED JOB
// ═══════════════════════════════════════════════════════════════════════
exports.midnightDriverOffline = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "America/New_York",
    region: "us-east1",
    secrets: [SENDGRID_API_KEY],
  },
  async () => {
    console.log("[midnightDriverOffline] running…");

    sgMail.setApiKey(SENDGRID_API_KEY.value());

    const now = Date.now();

    // Pull every driver in one read — small dataset, easier to bucket client-side
    const allSnap = await db.collection("Drivers").get();
    if (allSnap.empty) {
      console.log("[midnightDriverOffline] no drivers found");
      return;
    }

    // Bucket by status
    const online   = [];
    const offline  = [];
    const approved = [];

    allSnap.docs.forEach(doc => {
      const data = doc.data();
      const status = (data.status || "").toLowerCase();
      if (!data.email) return; // skip drivers without email

      if (status === "online")        online.push({ doc, data });
      else if (status === "offline")  offline.push({ doc, data });
      else if (status === "approved") approved.push({ doc, data });
    });

    console.log(
      `[midnightDriverOffline] online=${online.length} · ` +
      `offline=${offline.length} · approved=${approved.length}`
    );

    const tasks = [];

    // ─── 1. ONLINE → flip offline + surge email (with reset notice) ───
    online.forEach(({ doc, data }) => {
      tasks.push((async () => {
        const driverId = doc.id;
        try {
          await doc.ref.update({
            status: "offline",
            autoOfflineAt: FieldValue.serverTimestamp(),
            lastMidnightEmailAt: FieldValue.serverTimestamp(),
          });

          const email = buildSurgeEmail(data.firstName || data.name, true);
          await sgMail.send({
            to: data.email,
            from: "UaTob Team <noreply@uatob.com>",
            subject: email.subject,
            text: email.text,
            html: email.html,
          });
          console.log(`  ✔ online → offline + surge: ${driverId}`);
        } catch (err) {
          console.error(`  ✗ online driver ${driverId}:`, err?.message || err);
        }
      })());
    });

    // ─── 2. OFFLINE (driven before) → surge re-engagement email ───
    offline.forEach(({ doc, data }) => {
      tasks.push((async () => {
        const driverId = doc.id;
        try {
          // Cooldown check
          const lastMs = data.lastMidnightEmailAt?.toMillis?.() ?? 0;
          if (now - lastMs < COOLDOWN_MS) {
            console.log(`  · offline ${driverId} cooldown, skip`);
            return;
          }

          const email = buildSurgeEmail(data.firstName || data.name, false);
          await sgMail.send({
            to: data.email,
            from: "UaTob Team <noreply@uatob.com>",
            subject: email.subject,
            text: email.text,
            html: email.html,
          });

          await doc.ref.update({
            lastMidnightEmailAt: FieldValue.serverTimestamp(),
          });
          console.log(`  ✔ offline surge: ${driverId}`);
        } catch (err) {
          console.error(`  ✗ offline driver ${driverId}:`, err?.message || err);
        }
      })());
    });

    // ─── 3. APPROVED (never online) → WELCOME / activation email ───
    approved.forEach(({ doc, data }) => {
      tasks.push((async () => {
        const driverId = doc.id;
        try {
          // Cooldown check
          const lastMs = data.lastMidnightEmailAt?.toMillis?.() ?? 0;
          if (now - lastMs < COOLDOWN_MS) {
            console.log(`  · approved ${driverId} cooldown, skip`);
            return;
          }

          const email = buildWelcomeEmail(data.firstName || data.name);
          await sgMail.send({
            to: data.email,
            from: "UaTob Team <noreply@uatob.com>",
            subject: email.subject,
            text: email.text,
            html: email.html,
          });

          await doc.ref.update({
            lastMidnightEmailAt: FieldValue.serverTimestamp(),
          });
          console.log(`  ✔ approved welcome: ${driverId}`);
        } catch (err) {
          console.error(`  ✗ approved driver ${driverId}:`, err?.message || err);
        }
      })());
    });

    await Promise.allSettled(tasks);
    console.log("[midnightDriverOffline] complete");
  }
);
