const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const sgMail = require("@sendgrid/mail");

// Escape user-controlled data to prevent HTML injection
const esc = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

exports.onAccountCreated = onDocumentCreated(
  {
    document: "Accounts/{uid}",
    region: "us-central1",
    secrets: ["SENDGRID_API_KEY"],
  },
  async (event) => {
    try {
      const snap = event.data;
      if (!snap) return null;

      const accountData = snap.data();
      const { email, name, phone, createdAt } = accountData || {};

      if (!email) {
        console.log("No email found on account doc, skipping welcome email.");
        return null;
      }

      // 🧠 Prevent duplicate emails
      if (accountData.welcomeEmailSent) {
        console.log("Welcome email already sent, skipping.");
        return null;
      }

      const sendgridKey = process.env.SENDGRID_API_KEY;
      if (!sendgridKey) {
        console.error("Missing SENDGRID_API_KEY");
        return null;
      }

      sgMail.setApiKey(sendgridKey);

      const userName = esc(name || "there");
      const safeEmail = esc(email);
      const year = new Date().getFullYear();

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Welcome to UaTob!</title>
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
      .feature-col { display: block !important; width: 100% !important; }
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
                      🚗
                    </div>
                  </td>
                </tr>
              </table>

              <h1 class="hero-title"
                  style="margin:0 0 12px;font-size:32px;font-weight:900;color:#ffffff;
                         line-height:1.2;letter-spacing:-0.5px;font-family:Arial,sans-serif;">
                Welcome to UaTob, ${userName}!
              </h1>
              <p style="margin:0;font-size:16px;color:#ffffff;font-weight:500;
                        font-family:Arial,sans-serif;opacity:0.92;line-height:1.5;">
                Your account is ready. Orlando's at your fingertips.
              </p>
            </td>
          </tr>

          <!-- ── ACCOUNT CREATED BADGE ── -->
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
                      ✅ &nbsp;ACCOUNT SUCCESSFULLY CREATED
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
                Hey <strong>${userName}</strong>! You're officially part of UaTob —
                Orlando's own rideshare platform. Your account is set up and ready to go.
                Request your first ride in seconds.
              </p>

              <!-- ── ACCOUNT SUMMARY ── -->
              <div style="background-color:#f9fafb;border:1px solid #e5e7eb;
                          border-radius:16px;padding:24px;margin-bottom:28px;">
                <h2 style="margin:0 0 18px;font-size:17px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  👤 Your Account
                </h2>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;
                               font-size:13.5px;color:#6B7280;font-family:Arial,sans-serif;
                               width:45%;">
                      Name
                    </td>
                    <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;
                               font-size:13.5px;color:#111827;font-weight:700;
                               font-family:Arial,sans-serif;text-align:right;">
                      ${userName}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;font-size:13.5px;color:#6B7280;
                               font-family:Arial,sans-serif;">
                      Email
                    </td>
                    <td style="padding:10px 0;font-size:13.5px;color:#111827;font-weight:700;
                               font-family:Arial,sans-serif;text-align:right;">
                      ${safeEmail}
                    </td>
                  </tr>
                </table>
              </div>

              <!-- ── HOW IT WORKS ── -->
              <div style="background-color:#eff6ff;border:2px solid #93c5fd;
                          border-radius:16px;padding:24px;margin-bottom:28px;">
                <h2 style="margin:0 0 20px;font-size:17px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  🗺️ How UaTob Works
                </h2>

                <!-- Step 1 -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                       style="margin-bottom:16px;">
                  <tr>
                    <td width="36" valign="top">
                      <div style="width:28px;height:28px;background-color:#2563EB;
                                  border-radius:50%;text-align:center;line-height:28px;
                                  font-size:13px;font-weight:700;color:#ffffff;
                                  font-family:Arial,sans-serif;">1</div>
                    </td>
                    <td valign="middle" style="padding-left:10px;">
                      <p style="margin:0;font-size:14px;color:#111827;font-weight:700;
                                font-family:Arial,sans-serif;">Open the App</p>
                      <p style="margin:4px 0 0;font-size:13px;color:#4B5563;
                                font-family:Arial,sans-serif;">
                        Sign in with your account and allow location access.
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Step 2 -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                       style="margin-bottom:16px;">
                  <tr>
                    <td width="36" valign="top">
                      <div style="width:28px;height:28px;background-color:#2563EB;
                                  border-radius:50%;text-align:center;line-height:28px;
                                  font-size:13px;font-weight:700;color:#ffffff;
                                  font-family:Arial,sans-serif;">2</div>
                    </td>
                    <td valign="middle" style="padding-left:10px;">
                      <p style="margin:0;font-size:14px;color:#111827;font-weight:700;
                                font-family:Arial,sans-serif;">Enter Your Destination</p>
                      <p style="margin:4px 0 0;font-size:13px;color:#4B5563;
                                font-family:Arial,sans-serif;">
                        Type where you're headed and choose your ride type.
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Step 3 -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td width="36" valign="top">
                      <div style="width:28px;height:28px;background-color:#22C55E;
                                  border-radius:50%;text-align:center;line-height:28px;
                                  font-size:13px;font-weight:700;color:#ffffff;
                                  font-family:Arial,sans-serif;">3</div>
                    </td>
                    <td valign="middle" style="padding-left:10px;">
                      <p style="margin:0;font-size:14px;color:#111827;font-weight:700;
                                font-family:Arial,sans-serif;">Get There</p>
                      <p style="margin:4px 0 0;font-size:13px;color:#4B5563;
                                font-family:Arial,sans-serif;">
                        A nearby driver picks you up — fast, safe, and reliable.
                      </p>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- ── FEATURE HIGHLIGHTS ── -->
              <div style="margin-bottom:32px;">
                <h2 style="margin:0 0 16px;font-size:17px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  ⭐ Why Riders Love UaTob
                </h2>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td width="33%" class="feature-col" valign="top"
                        style="padding:16px;background-color:#f0fdf4;border-radius:12px;
                               text-align:center;">
                      <div style="font-size:28px;margin-bottom:8px;">📍</div>
                      <div style="font-size:13px;font-weight:700;color:#111827;
                                  font-family:Arial,sans-serif;">Local First</div>
                      <div style="font-size:12px;color:#6B7280;font-family:Arial,sans-serif;
                                  margin-top:4px;line-height:1.5;">
                        Built for Orlando — not a national afterthought.
                      </div>
                    </td>
                    <td width="2%"></td>
                    <td width="33%" class="feature-col" valign="top"
                        style="padding:16px;background-color:#eff6ff;border-radius:12px;
                               text-align:center;">
                      <div style="font-size:28px;margin-bottom:8px;">💸</div>
                      <div style="font-size:13px;font-weight:700;color:#111827;
                                  font-family:Arial,sans-serif;">Fair Pricing</div>
                      <div style="font-size:12px;color:#6B7280;font-family:Arial,sans-serif;
                                  margin-top:4px;line-height:1.5;">
                        Transparent fares — no surprise surges.
                      </div>
                    </td>
                    <td width="2%"></td>
                    <td width="33%" class="feature-col" valign="top"
                        style="padding:16px;background-color:#fefce8;border-radius:12px;
                               text-align:center;">
                      <div style="font-size:28px;margin-bottom:8px;">🛡️</div>
                      <div style="font-size:13px;font-weight:700;color:#111827;
                                  font-family:Arial,sans-serif;">Vetted Drivers</div>
                      <div style="font-size:12px;color:#6B7280;font-family:Arial,sans-serif;
                                  margin-top:4px;line-height:1.5;">
                        Every driver is reviewed and verified.
                      </div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- ── CTA ── -->
              <div style="text-align:center;margin:32px 0;">
                <a href="https://uatob.com"
                   class="cta-btn"
                   style="display:inline-block;background-color:#16A34A;
                          color:#ffffff;font-size:16px;font-weight:700;
                          text-decoration:none;padding:16px 40px;
                          border-radius:14px;font-family:Arial,sans-serif;">
                  Request Your First Ride →
                </a>
                <p style="margin:12px 0 0;font-size:13px;color:#6B7280;
                           font-family:Arial,sans-serif;">
                  Available now across Orlando
                </p>
              </div>

              <!-- ── FOOTER NOTE ── -->
              <div style="text-align:center;padding-top:24px;
                          border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:13px;color:#4B5563;
                           line-height:1.7;font-family:Arial,sans-serif;">
                  Questions or need help getting started?<br/>
                  Visit our
                  <a href="https://uatob.com/help"
                     style="color:#16A34A;text-decoration:none;font-weight:600;">
                    Help Center
                  </a>
                  or reply to this email.
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
                © ${year} UaTob. All rights reserved.
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
        to: email,
        from: "UaTob <noreply@uatob.com>",
        replyTo: "support@uatob.com",
        subject: `🎉 Welcome to UaTob, ${userName} — your account is ready!`,
        text: `Hey ${userName}! Welcome to UaTob — Orlando's rideshare platform. Your account is ready. Open the app, enter your destination, and get moving. Need help? Visit https://uatob.com/help`,
        html,
      };

      await sgMail.send(msg);

      // ✅ Mark as sent to prevent duplicates
      await snap.ref.update({ welcomeEmailSent: true });

      console.log(`📧 Welcome email sent to ${email} (${name}) ✅`);
      return null;

    } catch (error) {
      console.error("❌ Error sending welcome email:", error);
      if (error.response) {
        console.error(error.response.body);
      }
      return null;
    }
  }
);
