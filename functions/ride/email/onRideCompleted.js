// File: functions/onRideCompleted.js

const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// 🔐 SendGrid secret (v2 safe way)
const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const esc = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const money = (v) => `$${Number(v ?? 0).toFixed(2)}`;

// ─────────────────────────────────────────────────────────────
// Trigger
// ─────────────────────────────────────────────────────────────
exports.onRideCompleted = onDocumentUpdated(
  {
    document: "Rides/{rideId}",
    region: "us-central1",
    secrets: ["SENDGRID_API_KEY"],
  },
  async (event) => {
    try {
      const before = event.data?.before?.data();
      const after  = event.data?.after?.data();

      if (!before || !after) return null;

      const rideId = event.params.rideId;

      // ── ONLY RUN WHEN STATUS FLIPS TO COMPLETED ──
      const justCompleted =
        before.status !== "completed" &&
        after.status === "completed";

      if (!justCompleted) return null;

      // ── IDEMPOTENCY CHECK ──
      if (after.completedEmailSent) {
        console.log(`[rideCompleted] Email already sent for ${rideId}`);
        return null;
      }

      if (!after.uid) {
        console.warn(`[rideCompleted] Missing uid for ${rideId}`);
        return null;
      }

      // ── Fetch user ──
      const userSnap = await db.collection("Accounts").doc(after.uid).get();
      if (!userSnap.exists) return null;

      const user = userSnap.data();
      if (!user.email) return null;

      sgMail.setApiKey(SENDGRID_API_KEY.value());

      // ── Extract fields ──
      const {
        pickup,
        dropoff,
        fareTotal,
        tripDistanceMiles,
        tripDurationMin,
        paymentMethod,
        paymentLast4,
        rideType,
        driverUid,
      } = after;

      const name = user.name || "there";

      // ── Optional driver fetch ──
      let driverName = "Your driver";
      if (driverUid) {
        const d = await db.collection("Drivers").doc(driverUid).get();
        if (d.exists) driverName = d.data()?.name || driverName;
      }

      const year = new Date().getFullYear();

      // ─────────────────────────────────────────────
      // FULL EMAIL HTML
      // ─────────────────────────────────────────────
      const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Trip Completed</title>
</head>

<body style="margin:0;background:#f3f4f6;font-family:Arial,sans-serif;">

<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;">

  <!-- HEADER -->
  <div style="background:#16a34a;color:#fff;padding:40px;text-align:center;">
    <h1 style="margin:0;">🚗 Trip Completed</h1>
    <p style="margin:8px 0 0;">Thanks for riding with UaTob</p>
  </div>

  <!-- BODY -->
  <div style="padding:28px;color:#111827;">

    <p>Hi <strong>${esc(name)}</strong>,</p>

    <p>Your ride has been completed successfully. Here is your final receipt.</p>

    <!-- TRIP -->
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:16px 0;">
      <h3>🗺️ Trip Details</h3>

      <p><b>Pickup:</b> ${esc(pickup)}</p>
      <p><b>Dropoff:</b> ${esc(dropoff)}</p>
      <p><b>Distance:</b> ${tripDistanceMiles} mi</p>
      <p><b>Duration:</b> ${tripDurationMin} min</p>
      <p><b>Ride Type:</b> ${esc(rideType)}</p>
    </div>

    <!-- PAYMENT -->
    <div style="background:#ecfdf5;border:1px solid #86efac;border-radius:12px;padding:16px;margin:16px 0;">
      <h3>💳 Payment</h3>

      <p><b>Method:</b> ${esc(paymentMethod)} ${paymentLast4 ? "•••• " + paymentLast4 : ""}</p>
      <p><b>Status:</b> Paid</p>

      <h2 style="color:#16a34a;">Total: ${money(fareTotal)}</h2>
    </div>

    <!-- DRIVER -->
    <div style="padding:16px;background:#fefce8;border:1px solid #fde68a;border-radius:12px;">
      <h3>👤 Driver</h3>
      <p>${esc(driverName)} completed your trip safely.</p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin:24px;">
      <a href="https://uatob.com"
         style="background:#16a34a;color:#fff;padding:14px 28px;
         text-decoration:none;border-radius:10px;font-weight:700;">
        View Trip History
      </a>
    </div>

  </div>

  <!-- FOOTER -->
  <div style="text-align:center;font-size:12px;color:#6b7280;padding:20px;">
    © ${year} UaTob
  </div>

</div>

</body>
</html>
`;

      // ── SEND EMAIL ──
      const msg = {
        to: user.email,
        from: "UaTob <noreply@uatob.com>",
        subject: `🚗 Trip Completed · ${money(fareTotal)} Receipt`,
        html,
      };

      await sgMail.send(msg);

      // ── MARK AS SENT (IDEMPOTENCY LOCK) ──
      await event.data.after.ref.update({
        completedEmailSent: true,
        completedEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ Ride completed email sent for ${rideId}`);

      return null;

    } catch (err) {
      console.error("❌ onRideCompleted error:", err);
      return null;
    }
  }
);