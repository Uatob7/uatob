const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const sgMail = require("@sendgrid/mail");

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
      const { email, name } = accountData || {};

      if (!email) {
        console.log("No email provided, skipping onboarding email.");
        return null;
      }

      const sendgridKey = process.env.SENDGRID_API_KEY;
      if (!sendgridKey) {
        console.error("Missing SENDGRID_API_KEY");
        return null;
      }

      sgMail.setApiKey(sendgridKey);

      const firstName = name ? name.split(' ')[0] : 'there';

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Welcome to CallTelo! 🎉</title>
  <style type="text/css">
    /* CRITICAL: Force light mode everywhere */
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
   
    /* Kill dark mode */
    @media (prefers-color-scheme: dark) {
      body, html { background-color: #ffffff !important; }
      * { background-color: inherit !important; color: #000000 !important; }
    }
   
    /* Mobile */
    @media only screen and (max-width: 600px) {
      .hero-title { font-size: 28px !important; }
      .content-padding { padding: 24px 16px !important; }
      .cta-button { padding: 16px 32px !important; font-size: 15px !important; }
      .feature-grid { display: block !important; }
      .feature-col { display: block !important; width: 100% !important; padding: 0 0 16px 0 !important; }
    }
  </style>
</head>
<body style="margin: 0 !important; padding: 0 !important; background-color: #ffffff !important; color: #000000 !important;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin: 0; padding: 40px 0; background-color: #ffffff !important;">
    <tr>
      <td align="center" style="background-color: #ffffff !important;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width: 600px; width: 100%; background-color: #ffffff !important; border-radius: 24px;
                      overflow: hidden;">
         
          <!-- Hero Header -->
          <tr>
            <td align="center" style="background-color: #007aff; padding: 48px 32px;">
              <svg width="160" height="60" viewBox="0 0 160 60" xmlns="http://www.w3.org/2000/svg" aria-label="CallTelo Logo" style="display: block; margin: 0 auto 24px;">
                <defs>
                  <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
                    <stop offset="50%" stop-color="#ffffff" stop-opacity="0.85"/>
                    <stop offset="100%" stop-color="#ffffff" stop-opacity="0.95"/>
                  </linearGradient>
                </defs>
                <g transform="translate(30,30)">
                  <circle r="20" fill="url(#logoGradient)"/>
                  <circle r="16" fill="white" opacity="0.3"/>
                  <circle r="12" fill="white" opacity="0.2"/>
                  <path fill="#007aff" transform="translate(-7,-7) scale(1.5)" d="M10.01,7.69c-0.615,0-1.21,-0.1,-1.765,-0.28c-0.175,-0.06,-0.37,-0.015,-0.505,0.12l-0.785,0.985c-1.415,-0.675,-2.74,-1.95,-3.445,-3.415l0.975,-0.83c0.135,-0.14,0.175,-0.335,0.12,-0.51c-0.185,-0.555,-0.28,-1.15,-0.28,-1.765c0,-0.27,-0.225,-0.495,-0.495,-0.495H2.095C1.825,1.5 1.5,1.62 1.5,1.995C1.5,6.64 5.365,10.5 10.01,10.5c0.355,0 0.495,-0.315 0.495,-0.59V8.185c0,-0.27,-0.225,-0.495,-0.495,-0.495z"/>
                </g>
                <text x="90" y="38" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#ffffff">CallTelo</text>
              </svg>
             
              <div style="font-size: 48px; margin-bottom: 12px;">👋</div>
             
              <h1 style="margin: 0; font-size: 32px; font-weight: 800; color: #ffffff; line-height: 1.2;">
                Welcome to CallTelo!
              </h1>
             
              <p style="margin: 12px 0 0; font-size: 16px; color: #ffffff; font-weight: 500;">
                Turn your time into money
              </p>
            </td>
          </tr>
         
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 32px; background-color: #ffffff;">
             
              <!-- Greeting -->
              <p style="margin: 0 0 24px; font-size: 17px; color: #000000; line-height: 1.6;">
                Hey ${firstName}! 🎉
              </p>
             
              <p style="margin: 0 0 32px; font-size: 16px; color: #000000; line-height: 1.7;">
                You've just joined a platform where you get paid to talk. Post your number,
                take calls, and <strong>earn $0.48 per minute</strong> for your time.
              </p>
             
              <!-- How It Works -->
              <div style="background-color: #f9fafb; border-radius: 16px; padding: 24px; margin-bottom: 32px; border: 1px solid #e5e7eb;">
                <h2 style="margin: 0 0 20px; font-size: 19px; font-weight: 700; color: #000000;">
                  🚀 How CallTelo Works
                </h2>
               
                <div style="margin-bottom: 16px; padding-left: 32px; position: relative;">
                  <div style="position: absolute; left: 0; top: 0; width: 24px; height: 24px;
                              background-color: #007aff; border-radius: 50%; display: flex; align-items: center;
                              justify-content: center; font-size: 12px; font-weight: 700; color: #ffffff;">1</div>
                  <p style="margin: 0 0 4px; font-size: 15px; color: #000000; font-weight: 600;">
                    Post Your Number
                  </p>
                  <p style="margin: 0; font-size: 14px; color: #000000; line-height: 1.6;">
                    Create your listing with a short message about yourself. Pay $1 to go live for 24 hours.
                  </p>
                </div>
               
                <div style="margin-bottom: 16px; padding-left: 32px; position: relative;">
                  <div style="position: absolute; left: 0; top: 0; width: 24px; height: 24px;
                              background-color: #007aff; border-radius: 50%; display: flex; align-items: center;
                              justify-content: center; font-size: 12px; font-weight: 700; color: #ffffff;">2</div>
                  <p style="margin: 0 0 4px; font-size: 15px; color: #000000; font-weight: 600;">
                    Get Called
                  </p>
                  <p style="margin: 0; font-size: 14px; color: #000000; line-height: 1.6;">
                    People browse the feed, find you, and pay $1 to call you. You get a regular phone call.
                  </p>
                </div>
               
                <div style="margin-bottom: 16px; padding-left: 32px; position: relative;">
                  <div style="position: absolute; left: 0; top: 0; width: 24px; height: 24px;
                              background-color: #007aff; border-radius: 50%; display: flex; align-items: center;
                              justify-content: center; font-size: 12px; font-weight: 700; color: #ffffff;">3</div>
                  <p style="margin: 0 0 4px; font-size: 15px; color: #000000; font-weight: 600;">
                    Answer & Talk
                  </p>
                  <p style="margin: 0; font-size: 14px; color: #000000; line-height: 1.6;">
                    Have a conversation. The timer starts when you answer.
                  </p>
                </div>
               
                <div style="padding-left: 32px; position: relative;">
                  <div style="position: absolute; left: 0; top: 0; width: 24px; height: 24px;
                              background-color: #10b981; border-radius: 50%; display: flex; align-items: center;
                              justify-content: center; font-size: 12px; font-weight: 700; color: #ffffff;">4</div>
                  <p style="margin: 0 0 4px; font-size: 15px; color: #000000; font-weight: 600;">
                    Get Paid
                  </p>
                  <p style="margin: 0; font-size: 14px; color: #000000; line-height: 1.6;">
                    For calls <strong>over 60 seconds</strong>, earn <strong>$0.48/minute</strong>.
                    Longer calls = more money!
                  </p>
                </div>
              </div>
             
              <!-- Feature Grid -->
              <div style="margin-bottom: 32px;">
                <h2 style="margin: 0 0 20px; font-size: 19px; font-weight: 700; color: #000000;">
                  ✨ Why You'll Love It
                </h2>
               
                <table width="100%" cellpadding="0" cellspacing="0" class="feature-grid">
                  <tr>
                    <td width="50%" class="feature-col" style="padding-right: 8px; vertical-align: top;">
                      <div style="background-color: #f0fdf4; border: 2px solid #86efac; border-radius: 14px;
                                  padding: 20px; text-align: center; height: 100%;">
                        <div style="font-size: 32px; margin-bottom: 8px;">🔒</div>
                        <p style="margin: 0; font-size: 14px; color: #000000; font-weight: 600; line-height: 1.5;">
                          Your number stays private & protected
                        </p>
                      </div>
                    </td>
                    <td width="50%" class="feature-col" style="padding-left: 8px; vertical-align: top;">
                      <div style="background-color: #fff7ed; border: 2px solid #fdba74; border-radius: 14px;
                                  padding: 20px; text-align: center; height: 100%;">
                        <div style="font-size: 32px; margin-bottom: 8px;">💰</div>
                        <p style="margin: 0; font-size: 14px; color: #000000; font-weight: 600; line-height: 1.5;">
                          Instant payouts after every call
                        </p>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td class="feature-col" style="padding-right: 8px; padding-top: 16px; vertical-align: top;">
                      <div style="background-color: #f0f7ff; border: 2px solid #93c5fd; border-radius: 14px;
                                  padding: 20px; text-align: center; height: 100%;">
                        <div style="font-size: 32px; margin-bottom: 8px;">⏰</div>
                        <p style="margin: 0; font-size: 14px; color: #000000; font-weight: 600; line-height: 1.5;">
                          Work on your own schedule
                        </p>
                      </div>
                    </td>
                    <td class="feature-col" style="padding-left: 8px; padding-top: 16px; vertical-align: top;">
                      <div style="background-color: #fef3c7; border: 2px solid #fde047; border-radius: 14px;
                                  padding: 20px; text-align: center; height: 100%;">
                        <div style="font-size: 32px; margin-bottom: 8px;">🎯</div>
                        <p style="margin: 0; font-size: 14px; color: #000000; font-weight: 600; line-height: 1.5;">
                          You choose who to talk to
                        </p>
                      </div>
                    </td>
                  </tr>
                </table>
              </div>
             
              <!-- Quick Start Tips -->
              <div style="background-color: #eff6ff; border-radius: 16px;
                          padding: 24px; margin-bottom: 32px; border: 2px solid #93c5fd;">
                <p style="margin: 0 0 16px; font-size: 16px; color: #000000; font-weight: 700;">
                  💡 Quick Start Tips
                </p>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #000000; line-height: 1.7;">
                  <li style="margin-bottom: 8px;">
                    <strong>Upload a profile photo</strong> — posts with photos get 3x more calls
                  </li>
                  <li style="margin-bottom: 8px;">
                    <strong>Write a catchy message</strong> — tell people why they should call you
                  </li>
                  <li style="margin-bottom: 8px;">
                    <strong>Stay active</strong> — active users appear higher in the feed
                  </li>
                  <li>
                    <strong>Be ready to answer</strong> — the faster you pick up, the better your reputation
                  </li>
                </ul>
              </div>
             
              <!-- CTA Button -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="https://calltelo.com"
                   style="display: inline-block; background-color: #007aff;
                          color: #ffffff; font-size: 17px; font-weight: 700; text-decoration: none;
                          padding: 18px 40px; border-radius: 14px;">
                  Post Your Number & Start Earning →
                </a>
              </div>
             
              <!-- Earnings Example -->
              <div style="background-color: #f0fdf4; border: 2px solid #86efac; border-radius: 16px; padding: 24px; margin-bottom: 24px;">
                <p style="margin: 0 0 12px; font-size: 15px; color: #000000; font-weight: 700; text-align: center;">
                  📊 Example Earnings
                </p>
                <table width="100%" cellpadding="8" cellspacing="0" style="font-size: 14px;">
                  <tr>
                    <td style="border-bottom: 1px solid #bbf7d0; padding: 8px 0; color: #000000;">5-minute call</td>
                    <td style="border-bottom: 1px solid #bbf7d0; padding: 8px 0; text-align: right; font-weight: 700; color: #000000;">$2.40</td>
                  </tr>
                  <tr>
                    <td style="border-bottom: 1px solid #bbf7d0; padding: 8px 0; color: #000000;">10-minute call</td>
                    <td style="border-bottom: 1px solid #bbf7d0; padding: 8px 0; text-align: right; font-weight: 700; color: #000000;">$4.80</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #000000;">30-minute call</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 700; font-size: 16px; color: #10b981;">$14.40</td>
                  </tr>
                </table>
              </div>
             
              <!-- Footer Note -->
              <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; font-size: 13px; color: #000000; line-height: 1.6;">
                  Questions? We're here to help!<br/>
                  Reply to this email or visit our
                  <a href="https://calltelo.com/help" style="color: #007aff; text-decoration: none; font-weight: 600;">Help Center</a>
                </p>
              </div>
            </td>
          </tr>
         
          <!-- Email Footer -->
          <tr>
            <td style="padding: 24px 32px; text-align: center; background-color: #f3f4f6; border-top: 1px solid #e5e7eb;">
              <div style="font-size: 13px; color: #000000; font-weight: 500; margin-bottom: 8px;">
                CallTelo
              </div>
              <div style="font-size: 12px; color: #000000;">
                © ${new Date().getFullYear()} CallTelo. All rights reserved.
              </div>
              <div style="margin-top: 12px;">
                <a href="https://calltelo.com/privacy" style="color: #007aff; text-decoration: none; font-size: 11px; margin: 0 8px;">Privacy</a>
                <a href="https://calltelo.com/terms" style="color: #007aff; text-decoration: none; font-size: 11px; margin: 0 8px;">Terms</a>
                <a href="https://calltelo.com/unsubscribe" style="color: #007aff; text-decoration: none; font-size: 11px; margin: 0 8px;">Unsubscribe</a>
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
        from: "CallTelo <noreply@calltelo.com>",
        subject: "👋 Welcome to CallTelo — Start Earning From Calls!",
        text: `Hey ${firstName}! Welcome to CallTelo. Post your number, take calls, and earn $0.48 per minute. Get started: https://calltelo.com`,
        html,
      };

      await sgMail.send(msg);
      console.log(`📧 Onboarding email sent to ${email} ✅`);
      return null;
    } catch (error) {
      console.error("Error sending onboarding email:", error);
      return null;
    }
  }
);