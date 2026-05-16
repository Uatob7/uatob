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

  return {
    subject: "You're now offline for the day — UaTob",
    text:
      `Hi ${name},\n\n` +
      `It’s midnight, so we’ve automatically set your driver status to OFFLINE.\n\n` +
      `You can go back online anytime in the app to start receiving ride requests again.\n\n` +
      `Drive safe and thank you for being part of UaTob.\n\n` +
      `— UaTob Team`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>You're now offline</h2>
        <p>Hi ${name},</p>

        <p>
          It’s midnight, so we’ve automatically set your driver status to
          <b>OFFLINE</b>.
        </p>

        <p>
          You can go back online anytime in the app to start receiving ride requests again.
        </p>

        <p>Drive safe and thank you for being part of UaTob.</p>

        <br/>
        <p style="color:#666">— UaTob Team</p>
      </div>
    `,
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

    console.log(
      `[midnightDriverOffline] found ${snap.size} driver(s)`
    );

    // 2. Init SendGrid
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    // 3. Process drivers
    const tasks = snap.docs.map(async (doc) => {
      const driver = doc.data();
      const driverId = doc.id;

      try {
        // update status
        await doc.ref.update({
          status: "offline",
          autoOfflineAt: FieldValue.serverTimestamp(),
        });

        // send email
        if (driver.email) {
          const email = buildOfflineEmail(driver.name);

          await sgMail.send({
            to: driver.email,
            from: "UaTob Team <support@uatob.com>",
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