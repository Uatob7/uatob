const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { getFirestore }      = require("firebase-admin/firestore");
const sgMail                = require("@sendgrid/mail");

const db = getFirestore();
const esc = (s) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

exports.onRideInProgress = onDocumentUpdated(
  { document: "Rides/{rideId}", region: "us-east1" },
  async (event) => {
    try {
      const before = event.data.before.data();
      const after  = event.data.after.data();
      if (before.status === after.status) return null;
      if (after.status !== "in_progress") return null;
      if (after.emailSent_in_progress) return null;
      if (!after.uid) return null;

      const accountSnap = await db.collection("Accounts").doc(after.uid).get();
      if (!accountSnap.exists) return null;
      const { email, name = "there" } = accountSnap.data();
      if (!email) return null;

      const eta  = after.dropoffEtaMin ? `~${after.dropoffEtaMin} min` : null;
      const year = new Date().getFullYear();

      const html = `
<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Trip Started</title>
<style>body{margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;}
@media only screen and (max-width:600px){.content-pad{padding:24px 16px!important;}.hero-title{font-size:26px!important;}}
</style></head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;background:#f3f4f6;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

  <tr><td align="center" style="background:linear-gradient(135deg,#15803D,#16A34A 55%,#22C55E);padding:52px 32px 44px;">
    <div style="font-size:52px;margin-bottom:16px;">🛣️</div>
    <h1 class="hero-title" style="margin:0 0 12px;font-size:32px;font-weight:900;color:#fff;">Trip started!</h1>
    <p style="margin:0;font-size:16px;color:#fff;opacity:.92;">${eta ? `About ${eta} to destination` : "On the way to your destination"}</p>
  </td></tr>

  <tr><td class="content-pad" style="padding:36px 32px;">
    <p style="font-size:16px;color:#111827;line-height:1.7;">Hey <strong>${esc(name)}</strong>! You're on your way. Sit back and enjoy the ride.</p>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:16px;padding:24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:13.5px;color:#6B7280;padding:5px 0;">Destination</td>
          <td style="font-size:13.5px;color:#111827;font-weight:700;text-align:right;">${esc(after.dropoff ?? "—")}</td>
        </tr>
        ${eta ? `<tr><td style="font-size:13.5px;color:#6B7280;padding:5px 0;">ETA</td><td style="font-size:13.5px;color:#15803D;font-weight:700;text-align:right;">${esc(eta)}</td></tr>` : ""}
      </table>
    </div>

    <div style="text-align:center;margin:32px 0;">
      <a href="https://uatob.com" style="display:inline-block;background:#16A34A;color:#fff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:14px;">Track Your Ride →</a>
    </div>
  </td></tr>

  <tr><td style="padding:24px 32px;text-align:center;background:#f3f4f6;border-top:1px solid #e5e7eb;">
    <div style="font-size:15px;font-weight:800;color:#111827;margin-bottom:4px;">UaTob</div>
    <div style="font-size:12px;color:#6B7280;margin-bottom:12px;">Orlando's Rideshare Platform</div>
    <div style="font-size:12px;color:#9CA3AF;">© ${year} UaTob. All rights reserved.</div>
  </td></tr>

</table></td></tr></table>
</body></html>`;

      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      await sgMail.send({
        to: email, from: "UaTob <noreply@uatob.com>", replyTo: "support@uatob.com",
        subject: `🛣️ Your trip has started${eta ? ` — ${eta} to destination` : ""}`,
        text: `Hey ${name}! Your trip has started. ${eta ? `About ${eta} to your destination.` : ""} Track at https://uatob.com`,
        html,
      });

      await event.data.after.ref.update({ emailSent_in_progress: true });
      console.log(`✅ [in_progress] email → ${email}`);
    } catch (err) {
      console.error("❌ [in_progress]", err.message);
    }
    return null;
  }
);