const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const sgMail = require("@sendgrid/mail");

exports.onDriverCreated = onDocumentCreated(
  {
    document: "Drivers/{uid}",
    region: "us-central1",
    secrets: ["SENDGRID_API_KEY"],
  },
  async (event) => {
    try {
      const snap = event.data;
      if (!snap) return null;

      const driverData = snap.data();
      const { email, firstName, lastName } = driverData || {};

      if (!email) {
        console.log("No email found on driver doc, skipping welcome email.");
        return null;
      }

      const sendgridKey = process.env.SENDGRID_API_KEY;
      if (!sendgridKey) {
        console.error("Missing SENDGRID_API_KEY");
        return null;
      }

      sgMail.setApiKey(sendgridKey);

      const name = firstName || "there";

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Welcome to UaTob — Let's Get You Driving!</title>
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
      .step-col    { display: block !important; width: 100% !important; padding: 0 0 12px 0 !important; }
    }
  </style>
</head>
<body style="margin:0!important;padding:0!important;background-color:#ffffff!important;color:#000000!important;">

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="margin:0;padding:40px 0;background-color:#ffffff!important;">
    <tr>
      <td align="center" style="background-color:#ffffff!important;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:600px;width:100%;background-color:#ffffff!important;border-radius:24px;overflow:hidden;">

          <!-- ── HERO ── -->
          <tr>
            <td align="center"
                style="background: linear-gradient(135deg, #15803D 0%, #16A34A 55%, #22C55E 100%);
                       padding: 52px 32px 44px;">

              <!-- UaTob SVG Logo -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 28px;">
                <tr>
                  <td align="center">
                    <svg width="72" height="72" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"
                         style="display:block;">
                      <rect width="64" height="64" rx="14" fill="#ffffff" fill-opacity="0.15"/>
                      <rect x="0.5" y="0.5" width="63" height="63" rx="13.5" stroke="#ffffff" stroke-opacity="0.3" stroke-width="1"/>
                      <path d="M 10 46 Q 32 28 54 46" stroke="#ffffff" stroke-opacity="0.7"
                            stroke-width="2" stroke-dasharray="4 3.5" stroke-linecap="round" fill="none"/>
                      <circle cx="10" cy="46" r="5" fill="#ffffff" fill-opacity="0.2"/>
                      <circle cx="10" cy="46" r="3" fill="#ffffff"/>
                      <circle cx="54" cy="46" r="5" fill="#ffffff" fill-opacity="0.2"/>
                      <circle cx="54" cy="46" r="3" fill="#ffffff"/>
                      <g transform="translate(26,22)">
                        <rect x="1" y="5" width="10" height="6" rx="1.5" fill="#ffffff"/>
                        <path d="M2.5 5 L3.5 2 L8.5 2 L9.5 5Z" fill="#ffffff" fill-opacity="0.85"/>
                        <rect x="3.5" y="2.3" width="2" height="1.8" rx="0.4" fill="#16A34A"/>
                        <rect x="6.5" y="2.3" width="2" height="1.8" rx="0.4" fill="#16A34A"/>
                        <circle cx="3" cy="11" r="1.7" fill="#111827"/>
                        <circle cx="3" cy="11" r="0.85" fill="#22C55E"/>
                        <circle cx="9" cy="11" r="1.7" fill="#111827"/>
                        <circle cx="9" cy="11" r="0.85" fill="#22C55E"/>
                        <rect x="10.2" y="6.5" width="1.5" height="1" rx="0.5" fill="#FCD34D" opacity="0.9"/>
                      </g>
                    </svg>
                  </td>
                </tr>
              </table>

              <h1 class="hero-title"
                  style="margin:0 0 12px;font-size:34px;font-weight:900;color:#ffffff;
                         line-height:1.15;letter-spacing:-0.5px;font-family:Arial,sans-serif;">
                You're In, ${name}! 🚗💨
              </h1>
              <p style="margin:0;font-size:16px;color:#ffffff;font-weight:500;
                        font-family:Arial,sans-serif;opacity:0.92;line-height:1.5;">
                Your UaTob driver account has been created.<br/>
                A few quick steps and you'll be earning on the road.
              </p>
            </td>
          </tr>

          <!-- ── STATUS BADGE ── -->
          <tr>
            <td style="padding:0 32px;background-color:#ffffff;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-top:-20px;">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background-color:#fefce8;
                                border:2px solid #fde047;border-radius:100px;
                                padding:10px 24px;font-size:13px;font-weight:700;
                                color:#854d0e;font-family:Arial,sans-serif;letter-spacing:0.5px;">
                      ⏳ &nbsp;STATUS: PENDING REVIEW
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── MAIN CONTENT ── -->
          <tr>
            <td class="content-pad" style="padding:36px 32px;background-color:#ffffff;">

              <!-- Greeting -->
              <p style="margin:0 0 24px;font-size:17px;color:#111827;
                        line-height:1.7;font-family:Arial,sans-serif;">
                Hey <strong>${name}</strong> — welcome to UaTob! 🎉<br/>
                We're Orlando's rideshare platform built to put more money in drivers'
                pockets. You've taken the first step. Here's what happens next.
              </p>

              <!-- ── WHAT HAPPENS NEXT ── -->
              <div style="background-color:#f9fafb;border-radius:16px;
                          padding:24px;margin-bottom:32px;border:1px solid #e5e7eb;">
                <h2 style="margin:0 0 20px;font-size:18px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  🗺️ What Happens Next
                </h2>

                <!-- Step 1 -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                       style="margin-bottom:16px;">
                  <tr>
                    <td width="36" valign="top">
                      <div style="width:28px;height:28px;background-color:#16A34A;
                                  border-radius:50%;text-align:center;line-height:28px;
                                  font-size:13px;font-weight:700;color:#ffffff;
                                  font-family:Arial,sans-serif;">1</div>
                    </td>
                    <td valign="top" style="padding-left:8px;">
                      <p style="margin:0 0 3px;font-size:15px;font-weight:700;
                                color:#111827;font-family:Arial,sans-serif;">
                        Finish Your Application
                      </p>
                      <p style="margin:0;font-size:14px;color:#4B5563;
                                line-height:1.6;font-family:Arial,sans-serif;">
                        Complete steps 2–5 in the signup flow — contact info,
                        vehicle details, and document uploads.
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Step 2 -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                       style="margin-bottom:16px;">
                  <tr>
                    <td width="36" valign="top">
                      <div style="width:28px;height:28px;background-color:#16A34A;
                                  border-radius:50%;text-align:center;line-height:28px;
                                  font-size:13px;font-weight:700;color:#ffffff;
                                  font-family:Arial,sans-serif;">2</div>
                    </td>
                    <td valign="top" style="padding-left:8px;">
                      <p style="margin:0 0 3px;font-size:15px;font-weight:700;
                                color:#111827;font-family:Arial,sans-serif;">
                        We Review Your Application
                      </p>
                      <p style="margin:0;font-size:14px;color:#4B5563;
                                line-height:1.6;font-family:Arial,sans-serif;">
                        Our team verifies your license, vehicle registration,
                        insurance, and profile photo. This takes
                        <strong>24–48 hours</strong>.
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Step 3 -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                       style="margin-bottom:16px;">
                  <tr>
                    <td width="36" valign="top">
                      <div style="width:28px;height:28px;background-color:#16A34A;
                                  border-radius:50%;text-align:center;line-height:28px;
                                  font-size:13px;font-weight:700;color:#ffffff;
                                  font-family:Arial,sans-serif;">3</div>
                    </td>
                    <td valign="top" style="padding-left:8px;">
                      <p style="margin:0 0 3px;font-size:15px;font-weight:700;
                                color:#111827;font-family:Arial,sans-serif;">
                        Get Approved &amp; Go Live
                      </p>
                      <p style="margin:0;font-size:14px;color:#4B5563;
                                line-height:1.6;font-family:Arial,sans-serif;">
                        Once approved you'll get an email confirmation.
                        Open the UaTob driver app, go online, and start
                        accepting rides immediately.
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Step 4 -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td width="36" valign="top">
                      <div style="width:28px;height:28px;background-color:#22C55E;
                                  border-radius:50%;text-align:center;line-height:28px;
                                  font-size:13px;font-weight:700;color:#ffffff;
                                  font-family:Arial,sans-serif;">$</div>
                    </td>
                    <td valign="top" style="padding-left:8px;">
                      <p style="margin:0 0 3px;font-size:15px;font-weight:700;
                                color:#111827;font-family:Arial,sans-serif;">
                        Start Earning
                      </p>
                      <p style="margin:0;font-size:14px;color:#4B5563;
                                line-height:1.6;font-family:Arial,sans-serif;">
                        Pick up rides, earn per trip, and cash out on your
                        schedule. No weekly minimums. No hidden fees.
                      </p>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- ── DOCUMENTS CHECKLIST ── -->
              <div style="background-color:#f0fdf4;border:2px solid #86efac;
                          border-radius:16px;padding:24px;margin-bottom:32px;">
                <h2 style="margin:0 0 16px;font-size:17px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  📋 Documents You'll Need to Upload
                </h2>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid #bbf7d0;
                               font-size:14px;color:#111827;font-family:Arial,sans-serif;">
                      ✅ &nbsp;Driver's License (front &amp; back)
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid #bbf7d0;
                               font-size:14px;color:#111827;font-family:Arial,sans-serif;">
                      ✅ &nbsp;Vehicle Registration
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid #bbf7d0;
                               font-size:14px;color:#111827;font-family:Arial,sans-serif;">
                      ✅ &nbsp;Proof of Insurance (current &amp; valid)
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-size:14px;
                               color:#111827;font-family:Arial,sans-serif;">
                      ✅ &nbsp;Profile Photo (clear headshot, no sunglasses)
                    </td>
                  </tr>
                </table>
              </div>

              <!-- ── PERKS GRID ── -->
              <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;
                         color:#111827;font-family:Arial,sans-serif;">
                ⚡ Why Drivers Choose UaTob
              </h2>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-bottom:32px;">
                <tr>
                  <td width="50%" class="step-col"
                      style="padding-right:8px;vertical-align:top;padding-bottom:12px;">
                    <div style="background-color:#f0fdf4;border:2px solid #86efac;
                                border-radius:14px;padding:18px;text-align:center;">
                      <div style="font-size:28px;margin-bottom:8px;">💰</div>
                      <p style="margin:0;font-size:13px;font-weight:700;
                                color:#111827;font-family:Arial,sans-serif;line-height:1.5;">
                        Higher earnings per ride than the big apps
                      </p>
                    </div>
                  </td>
                  <td width="50%" class="step-col"
                      style="padding-left:8px;vertical-align:top;padding-bottom:12px;">
                    <div style="background-color:#eff6ff;border:2px solid #93c5fd;
                                border-radius:14px;padding:18px;text-align:center;">
                      <div style="font-size:28px;margin-bottom:8px;">🕐</div>
                      <p style="margin:0;font-size:13px;font-weight:700;
                                color:#111827;font-family:Arial,sans-serif;line-height:1.5;">
                        Fully flexible — drive when you want
                      </p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" class="step-col"
                      style="padding-right:8px;vertical-align:top;">
                    <div style="background-color:#fff7ed;border:2px solid #fdba74;
                                border-radius:14px;padding:18px;text-align:center;">
                      <div style="font-size:28px;margin-bottom:8px;">🏙️</div>
                      <p style="margin:0;font-size:13px;font-weight:700;
                                color:#111827;font-family:Arial,sans-serif;line-height:1.5;">
                        Orlando-built, Orlando-focused
                      </p>
                    </div>
                  </td>
                  <td width="50%" class="step-col"
                      style="padding-left:8px;vertical-align:top;">
                    <div style="background-color:#fef3c7;border:2px solid #fde047;
                                border-radius:14px;padding:18px;text-align:center;">
                      <div style="font-size:28px;margin-bottom:8px;">🚀</div>
                      <p style="margin:0;font-size:13px;font-weight:700;
                                color:#111827;font-family:Arial,sans-serif;line-height:1.5;">
                        Fast approval — most drivers live in 48 hrs
                      </p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- ── CTA ── -->
              <div style="text-align:center;margin:36px 0;">
                <a href="https://uatob.com/driver-signup"
                   style="display:inline-block;background-color:#16A34A;
                          color:#ffffff;font-size:17px;font-weight:700;
                          text-decoration:none;padding:18px 40px;
                          border-radius:14px;font-family:Arial,sans-serif;
                          letter-spacing:0.2px;">
                  Continue Your Application →
                </a>
                <p style="margin:14px 0 0;font-size:13px;color:#6B7280;
                           font-family:Arial,sans-serif;">
                  Takes less than 5 minutes to complete
                </p>
              </div>

              <!-- ── REQUIREMENTS REMINDER ── -->
              <div style="background-color:#f9fafb;border:1px solid #e5e7eb;
                          border-radius:14px;padding:20px;margin-bottom:24px;">
                <p style="margin:0 0 10px;font-size:14px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  🚗 Vehicle Requirements
                </p>
                <ul style="margin:0;padding-left:18px;font-size:13.5px;
                           color:#4B5563;line-height:1.8;font-family:Arial,sans-serif;">
                  <li>Model year 2005 or newer</li>
                  <li>4-door vehicle in good condition</li>
                  <li>Valid Florida registration</li>
                  <li>Current insurance policy</li>
                </ul>
              </div>

              <!-- ── FOOTER NOTE ── -->
              <div style="text-align:center;padding-top:24px;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:13px;color:#4B5563;
                           line-height:1.7;font-family:Arial,sans-serif;">
                  Questions about your application?<br/>
                  Reply to this email or visit our
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
                   style="color:#16A34A;text-decoration:none;font-size:11px;margin:0 8px;
                          font-family:Arial,sans-serif;">Privacy</a>
                <a href="https://uatob.com/terms"
                   style="color:#16A34A;text-decoration:none;font-size:11px;margin:0 8px;
                          font-family:Arial,sans-serif;">Terms</a>
                <a href="https://uatob.com/unsubscribe"
                   style="color:#16A34A;text-decoration:none;font-size:11px;margin:0 8px;
                          font-family:Arial,sans-serif;">Unsubscribe</a>
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
        subject: `🚗 Welcome to UaTob, ${name}! Finish your application to start driving.`,
        text:    `Hey ${name}! Welcome to UaTob — Orlando's rideshare platform. Finish your application at https://uatob.com/driver/signup and our team will review it within 24–48 hours. Once approved, you're ready to hit the road and start earning.`,
        html,
      };

      await sgMail.send(msg);
      console.log(`📧 Driver welcome email sent to ${email} (${firstName} ${lastName}) ✅`);
      return null;

    } catch (error) {
      console.error("❌ Error sending driver welcome email:", error);
      return null;
    }
  }
);
