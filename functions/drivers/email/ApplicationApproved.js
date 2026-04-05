const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const sgMail = require("@sendgrid/mail");

exports.ApplicationApproved = onDocumentUpdated(
  {
    document: "Drivers/{uid}",
    region: "us-central1",
    secrets: ["SENDGRID_API_KEY"],
  },
  async (event) => {
    try {
      const before = event.data.before.data();
      const after  = event.data.after.data();

      // Only fire when status flips to "approved"
      if (before.status === after.status) return null;
      if (after.status !== "approved") return null;

      const { email, firstName, lastName, vehicle } = after || {};

      if (!email) {
        console.log("No email on driver doc, skipping approval email.");
        return null;
      }

      const sendgridKey = process.env.SENDGRID_API_KEY;
      if (!sendgridKey) {
        console.error("Missing SENDGRID_API_KEY");
        return null;
      }

      sgMail.setApiKey(sendgridKey);

      const name       = firstName || "there";
      const vehicleStr = vehicle?.make && vehicle?.model
        ? `${vehicle.year || ""} ${vehicle.make} ${vehicle.model}`.trim()
        : null;

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>You're Approved — UaTob</title>
  <style type="text/css">
    body, html, div, span, p, a, table, tr, td, h1, h2, h3, h4, h5, h6 {
      -webkit-text-size-adjust: 100% !important;
      -ms-text-size-adjust: 100% !important;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      min-width: 100% !important;
      background-color: #ffffff !important;
      color: #000000 !important;
    }
    @media (prefers-color-scheme: dark) {
      body, html { background-color: #ffffff !important; }
      * { background-color: inherit !important; color: #000000 !important; }
    }
    @media only screen and (max-width: 600px) {
      .hero-title  { font-size: 26px !important; }
      .content-pad { padding: 24px 16px !important; }
      .cta-btn     { padding: 16px 28px !important; font-size: 15px !important; }
    }
  </style>
</head>
<body style="margin:0!important;padding:0!important;background-color:#ffffff!important;color:#000000!important;">

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="margin:0;padding:40px 0;background-color:#ffffff!important;">
    <tr>
      <td align="center" style="background-color:#ffffff!important;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:600px;width:100%;background-color:#ffffff!important;
                      border-radius:24px;overflow:hidden;">

          <!-- ── HERO ── -->
          <tr>
            <td align="center"
                style="background: linear-gradient(135deg, #15803D 0%, #16A34A 55%, #22C55E 100%);
                       padding: 52px 32px 44px;">

              <!-- Icon -->
              <table cellpadding="0" cellspacing="0" role="presentation"
                     style="margin: 0 auto 24px;">
                <tr>
                  <td align="center">
                    <div style="width:80px;height:80px;background-color:rgba(255,255,255,0.15);
                                border-radius:50%;text-align:center;line-height:80px;
                                font-size:42px;">
                      🎉
                    </div>
                  </td>
                </tr>
              </table>

              <h1 class="hero-title"
                  style="margin:0 0 12px;font-size:32px;font-weight:900;color:#ffffff;
                         line-height:1.2;letter-spacing:-0.5px;font-family:Arial,sans-serif;">
                You're Approved, ${name}!
              </h1>
              <p style="margin:0;font-size:16px;color:#ffffff;font-weight:500;
                        font-family:Arial,sans-serif;opacity:0.92;line-height:1.5;">
                Welcome to the UaTob driver network.<br/>
                You're ready to start earning.
              </p>
            </td>
          </tr>

          <!-- ── APPROVED BADGE ── -->
          <tr>
            <td style="padding:0 32px;background-color:#ffffff;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-top:-20px;">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background-color:#f0fdf4;
                                border:2px solid #86efac;border-radius:100px;
                                padding:10px 24px;font-size:13px;font-weight:700;
                                color:#15803d;font-family:Arial,sans-serif;letter-spacing:0.5px;">
                      ✅ &nbsp;DRIVER STATUS: APPROVED &amp; ACTIVE
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── MAIN CONTENT ── -->
          <tr>
            <td class="content-pad"
                style="padding:36px 32px;background-color:#ffffff;">

              <!-- Intro -->
              <p style="margin:0 0 28px;font-size:16px;color:#111827;
                        line-height:1.7;font-family:Arial,sans-serif;">
                Hey <strong>${name}</strong>! Great news — your UaTob driver
                application has been <strong>approved</strong>. Your account is now
                active and you can start accepting rides right away.
              </p>

              <!-- ── ACCOUNT SUMMARY ── -->
              <div style="background-color:#f9fafb;border:1px solid #e5e7eb;
                          border-radius:16px;padding:24px;margin-bottom:28px;">
                <h2 style="margin:0 0 18px;font-size:17px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  🪪 Your Driver Account
                </h2>

                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;
                               font-size:13.5px;color:#6B7280;font-family:Arial,sans-serif;
                               width:45%;">
                      Full Name
                    </td>
                    <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;
                               font-size:13.5px;color:#111827;font-weight:700;
                               font-family:Arial,sans-serif;text-align:right;">
                      ${firstName || ""} ${lastName || ""}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;
                               font-size:13.5px;color:#6B7280;font-family:Arial,sans-serif;">
                      Email
                    </td>
                    <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;
                               font-size:13.5px;color:#111827;font-weight:700;
                               font-family:Arial,sans-serif;text-align:right;">
                      ${email}
                    </td>
                  </tr>
                  ${vehicleStr ? `
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;
                               font-size:13.5px;color:#6B7280;font-family:Arial,sans-serif;">
                      Vehicle
                    </td>
                    <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;
                               font-size:13.5px;color:#111827;font-weight:700;
                               font-family:Arial,sans-serif;text-align:right;">
                      ${vehicleStr}
                    </td>
                  </tr>
                  ` : ""}
                  ${vehicle?.plate ? `
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;
                               font-size:13.5px;color:#6B7280;font-family:Arial,sans-serif;">
                      License Plate
                    </td>
                    <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;
                               font-size:13.5px;color:#111827;font-weight:700;
                               font-family:Arial,sans-serif;text-align:right;">
                      ${vehicle.plate}
                    </td>
                  </tr>
                  ` : ""}
                  ${vehicle?.rideTypes?.length ? `
                  <tr>
                    <td style="padding:10px 0;font-size:13.5px;color:#6B7280;
                               font-family:Arial,sans-serif;">
                      Ride Types
                    </td>
                    <td style="padding:10px 0;font-size:13.5px;color:#111827;font-weight:700;
                               font-family:Arial,sans-serif;text-align:right;
                               text-transform:capitalize;">
                      ${vehicle.rideTypes.join(", ")}
                    </td>
                  </tr>
                  ` : ""}
                </table>
              </div>

              <!-- ── HOW TO GET STARTED ── -->
              <div style="background-color:#eff6ff;border:2px solid #93c5fd;
                          border-radius:16px;padding:24px;margin-bottom:28px;">
                <h2 style="margin:0 0 18px;font-size:17px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  🚀 Get Started in 3 Steps
                </h2>

                <!-- Step 1 -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                       style="margin-bottom:14px;">
                  <tr>
                    <td width="36" valign="top">
                      <div style="width:28px;height:28px;background-color:#16A34A;
                                  border-radius:50%;text-align:center;line-height:28px;
                                  font-size:13px;font-weight:700;color:#ffffff;
                                  font-family:Arial,sans-serif;">1</div>
                    </td>
                    <td valign="middle" style="padding-left:10px;">
                      <p style="margin:0;font-size:14px;color:#111827;font-weight:700;
                                font-family:Arial,sans-serif;">
                        Open the UaTob Driver App
                      </p>
                      <p style="margin:4px 0 0;font-size:13px;color:#4B5563;
                                font-family:Arial,sans-serif;">
                        Log in with the email you registered with.
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Step 2 -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                       style="margin-bottom:14px;">
                  <tr>
                    <td width="36" valign="top">
                      <div style="width:28px;height:28px;background-color:#2563EB;
                                  border-radius:50%;text-align:center;line-height:28px;
                                  font-size:13px;font-weight:700;color:#ffffff;
                                  font-family:Arial,sans-serif;">2</div>
                    </td>
                    <td valign="middle" style="padding-left:10px;">
                      <p style="margin:0;font-size:14px;color:#111827;font-weight:700;
                                font-family:Arial,sans-serif;">
                        Go Online
                      </p>
                      <p style="margin:4px 0 0;font-size:13px;color:#4B5563;
                                font-family:Arial,sans-serif;">
                        Tap the toggle to go online and start receiving ride requests.
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Step 3 -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td width="36" valign="top">
                      <div style="width:28px;height:28px;background-color:#7C3AED;
                                  border-radius:50%;text-align:center;line-height:28px;
                                  font-size:13px;font-weight:700;color:#ffffff;
                                  font-family:Arial,sans-serif;">3</div>
                    </td>
                    <td valign="middle" style="padding-left:10px;">
                      <p style="margin:0;font-size:14px;color:#111827;font-weight:700;
                                font-family:Arial,sans-serif;">
                        Accept Your First Ride
                      </p>
                      <p style="margin:4px 0 0;font-size:13px;color:#4B5563;
                                font-family:Arial,sans-serif;">
                        Earnings are deposited automatically after each completed trip.
                      </p>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- ── TIPS ── -->
              <div style="background-color:#f9fafb;border:1px solid #e5e7eb;
                          border-radius:14px;padding:20px;margin-bottom:32px;">
                <p style="margin:0 0 12px;font-size:15px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  💡 Tips for Your First Day
                </p>
                <ul style="margin:0;padding-left:18px;font-size:13.5px;
                           color:#4B5563;line-height:1.85;font-family:Arial,sans-serif;">
                  <li>Keep your phone charged and your app notifications on</li>
                  <li>Drive during peak hours (mornings, evenings, weekends) for more requests</li>
                  <li>A clean car and friendly greeting go a long way for ratings</li>
                  <li>Check your earnings dashboard regularly in the app</li>
                </ul>
              </div>

              <!-- ── CTA ── -->
              <div style="text-align:center;margin:32px 0;">
                <a href="https://uatob.com/driver/login"
                   style="display:inline-block;background-color:#16A34A;
                          color:#ffffff;font-size:16px;font-weight:700;
                          text-decoration:none;padding:18px 40px;
                          border-radius:14px;font-family:Arial,sans-serif;">
                  Open Driver App →
                </a>
                <p style="margin:12px 0 0;font-size:13px;color:#6B7280;
                           font-family:Arial,sans-serif;">
                  Start earning today
                </p>
              </div>

              <!-- ── FOOTER NOTE ── -->
              <div style="text-align:center;padding-top:24px;
                          border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:13px;color:#4B5563;
                           line-height:1.7;font-family:Arial,sans-serif;">
                  Questions? Reply to this email or visit our
                  <a href="https://uatob.com/help"
                     style="color:#16A34A;text-decoration:none;font-weight:600;">
                    Help Center
                  </a>
                </p>
              </div>

            </td>
          </tr>

          <!-- ── EMAIL FOOTER ── -->
          <tr>
            <td style="padding:24px 32px;text-align:center;
                       background-color:#f3f4f6;border-top:1px solid #e5e7eb;">
              <div style="font-size:15px;font-weight:800;color:#111827;
                          font-family:Arial,sans-serif;margin-bottom:4px;
                          letter-spacing:-0.3px;">
                UaTob
              </div>
              <div style="font-size:12px;color:#6B7280;
                          font-family:Arial,sans-serif;margin-bottom:12px;">
                Orlando's Rideshare Platform
              </div>
              <div style="font-size:12px;color:#9CA3AF;
                          font-family:Arial,sans-serif;margin-bottom:12px;">
                © ${new Date().getFullYear()} UaTob. All rights reserved.
              </div>
              <div>
                <a href="https://uatob.com/privacy"
                   style="color:#16A34A;text-decoration:none;font-size:11px;
                          margin:0 8px;font-family:Arial,sans-serif;">Privacy</a>
                <a href="https://uatob.com/terms"
                   style="color:#16A34A;text-decoration:none;font-size:11px;
                          margin:0 8px;font-family:Arial,sans-serif;">Terms</a>
                <a href="https://uatob.com/unsubscribe"
                   style="color:#16A34A;text-decoration:none;font-size:11px;
                          margin:0 8px;font-family:Arial,sans-serif;">Unsubscribe</a>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
      `;

      const msg = {
        to:      email,
        from:    "UaTob <noreply@uatob.com>",
        subject: `🎉 You're approved, ${name} — welcome to UaTob!`,
        text:    `Hey ${name}! Your UaTob driver application has been approved. Open the driver app to go online and start accepting rides. Questions? Visit https://uatob.com/help`,
        html,
      };

      await sgMail.send(msg);
      console.log(`📧 Approval email sent to ${email} (${firstName} ${lastName}) ✅`);
      return null;

    } catch (error) {
      console.error("❌ Error sending approval email:", error);
      return null;
    }
  }
);