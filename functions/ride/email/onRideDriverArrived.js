const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { getFirestore }      = require("firebase-admin/firestore");
const sgMail                = require("@sendgrid/mail");

const db = getFirestore();
const esc = (s) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

exports.onRideDriverArrived = onDocumentUpdated(
  { document: "Rides/{rideId}", region: "us-east1" },
  async (event) => {
    try {
      const before = event.data.before.data();
      const after  = event.data.after.data();
      if (before.status === after.status) return null;
      if (after.status !== "arrived") return null;
      if (after.emailSent_arrived) return null;
      if (!after.uid) return null;

      const accountSnap = await db.collection("Accounts").doc(after.uid).get();
      if (!accountSnap.exists) return null;
      const { email, name = "there" } = accountSnap.data();
      if (!email) return null;

      let driver = null;
      const driverUid = after.driverUid || after?.driver?.uid;
      if (driverUid) {
        const dSnap = await db.collection("Drivers").doc(driverUid).get();
        if (dSnap.exists) driver = dSnap.data();
      }

      const driverName = driver?.firstName
        ? `${driver.firstName}${driver.lastName ? ` ${driver.lastName[0]}.` : ""}`
        : "Your driver";
      const vehicle = driver?.vehicle
        ? `${driver.vehicle.color ?? ""} ${driver.vehicle.make ?? ""} ${driver.vehicle.model ?? ""}`.trim()
        : null;
      const plate = driver?.vehicle?.plate?.toUpperCase() ?? null;
      const year  = new Date().getFullYear();

      const html = `
<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Driver Arrived</title>
<style>body{margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;}
@media only screen and (max-width:600px){.content-pad{padding:24px 16px!important;}.hero-title{font-size:26px!important;}}
</style></head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;background:#f3f4f6;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

  <tr><td align="center" style="background:linear-gradient(135deg,#15803D,#16A34A 55%,#22C55E);padding:52px 32px 44px;">
    <div style="font-size:52px;margin-bottom:16px;">🎯</div>
    <h1 class="hero-title" style="margin:0 0 12px;font-size:32px;font-weight:900;color:#fff;">${esc(driverName)} has arrived</h1>
    <p style="margin:0;font-size:16px;color:#fff;opacity:.92;">Your driver is waiting</p>
  </td></tr>

  <tr><td class="content-pad" style="padding:36px 32px;">
    <p style="font-size:16px;color:#111827;line-height:1.7;">Hey <strong>${esc(name)}</strong>! Your driver is at your pickup location now. Head out!</p>

    ${vehicle ? `
    <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:16px;padding:24px;margin-bottom:24px;text-align:center;">
      <p style="margin:0;font-size:15px;color:#111827;font-weight:700;">Look for</p>
      <p style="margin:8px 0 0;font-size:22px;font-weight:900;color:#15803D;">${esc(vehicle)}</p>
      ${plate ? `<p style="margin:6px 0 0;font-size:14px;color:#6B7280;font-weight:600;">Plate: ${esc(plate)}</p>` : ""}
    </div>` : ""}

    <div style="text-align:center;margin:32px 0;">
      <a href="https://uatob.com" style="display:inline-block;background:#16A34A;color:#fff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:14px;">Open App →</a>
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
        subject: `🎯 ${driverName} has arrived — head outside!`,
        text: `Hey ${name}! Your driver has arrived. ${vehicle ? `Look for ${vehicle}${plate ? ` (${plate})` : ""}.` : ""} Open the app: https://uatob.com`,
        html,
      });

      await event.data.after.ref.update({ emailSent_arrived: true });
      console.log(`✅ [arrived] email → ${email}`);
    } catch (err) {
      console.error("❌ [arrived]", err.message);
    }
    return null;
  }
);