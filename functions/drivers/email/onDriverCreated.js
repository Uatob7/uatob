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
      const year = new Date().getFullYear();

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Welcome to UaTob</title>
  <style type="text/css">
    body, table, td, p, a, h1, h2, h3 {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #0C0F0C !important;
    }
    @media only screen and (max-width: 600px) {
      .outer-pad  { padding: 16px !important; }
      .hero-title { font-size: 28px !important; line-height: 1.2 !important; }
      .hero-pad   { padding: 40px 24px 36px !important; }
      .body-pad   { padding: 32px 20px !important; }
      .two-col td { display: block !important; width: 100% !important; padding: 0 0 10px 0 !important; }
      .stat-cell  { padding: 0 8px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0C0F0C;">

<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="background-color:#0C0F0C;">
  <tr>
    <td class="outer-pad" align="center" style="padding:32px 16px;">

      <!-- ── WRAPPER ── -->
      <table width="600" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;
                    border:1px solid rgba(34,197,94,0.15);background-color:#111411;">

        <!-- ══ HERO ══ -->
        <tr>
          <td class="hero-pad" align="center"
              style="padding:52px 32px 44px;
                     background: linear-gradient(160deg, #0a1a0d 0%, #0f2914 40%, #0a1a0d 100%);
                     border-bottom:1px solid rgba(34,197,94,0.12);
                     position:relative;">

            <!-- Grid pattern overlay (inline SVG bg) -->
            <div style="position:absolute;inset:0;opacity:0.4;
                        background-image:linear-gradient(rgba(34,197,94,0.06) 1px, transparent 1px),
                                         linear-gradient(90deg, rgba(34,197,94,0.06) 1px, transparent 1px);
                        background-size:32px 32px;pointer-events:none;">
            </div>

            <!-- Logo mark -->
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 28px;">
              <tr>
                <td align="center">
                  <div style="width:64px;height:64px;border-radius:14px;
                              background:rgba(34,197,94,0.1);
                              border:1px solid rgba(34,197,94,0.3);
                              display:inline-flex;align-items:center;justify-content:center;
                              font-size:28px;line-height:64px;text-align:center;">
                    🚗
                  </div>
                </td>
              </tr>
            </table>

            <!-- Wordmark -->
            <div style="font-family:Arial,sans-serif;font-size:13px;font-weight:700;
                        letter-spacing:0.3em;color:rgba(34,197,94,0.7);
                        text-transform:uppercase;margin-bottom:18px;">
              UATOB DRIVER NETWORK
            </div>

            <!-- Headline -->
            <h1 class="hero-title"
                style="margin:0 0 14px;font-size:36px;font-weight:900;
                       color:#ffffff;line-height:1.1;letter-spacing:-0.5px;
                       font-family:Arial,sans-serif;">
              Welcome aboard, ${name}.
            </h1>
            <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.6);
                      font-family:Arial,sans-serif;line-height:1.6;max-width:380px;">
              Your driver account is created. Complete your application and you could be earning as soon as tomorrow.
            </p>

            <!-- Status pill -->
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px auto 0;">
              <tr>
                <td align="center"
                    style="background:rgba(253,224,71,0.1);border:1px solid rgba(253,224,71,0.35);
                           border-radius:100px;padding:9px 20px;">
                  <span style="font-family:Arial,sans-serif;font-size:12px;font-weight:700;
                               color:#fde047;letter-spacing:0.1em;text-transform:uppercase;">
                    ⏳ &nbsp;Pending Review
                  </span>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- ══ STATS ROW ══ -->
        <tr>
          <td style="background-color:#0f180f;border-bottom:1px solid rgba(34,197,94,0.1);">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td class="stat-cell" width="33%" align="center"
                    style="padding:22px 12px;border-right:1px solid rgba(34,197,94,0.1);">
                  <div style="font-family:Arial,sans-serif;font-size:26px;font-weight:900;
                              color:#22C55E;letter-spacing:-1px;margin-bottom:4px;">80%</div>
                  <div style="font-family:Arial,sans-serif;font-size:10px;font-weight:600;
                              color:rgba(255,255,255,0.35);letter-spacing:0.15em;text-transform:uppercase;">
                    Your cut
                  </div>
                </td>
                <td class="stat-cell" width="33%" align="center"
                    style="padding:22px 12px;border-right:1px solid rgba(34,197,94,0.1);">
                  <div style="font-family:Arial,sans-serif;font-size:26px;font-weight:900;
                              color:#22C55E;letter-spacing:-1px;margin-bottom:4px;">24H</div>
                  <div style="font-family:Arial,sans-serif;font-size:10px;font-weight:600;
                              color:rgba(255,255,255,0.35);letter-spacing:0.15em;text-transform:uppercase;">
                    Avg approval
                  </div>
                </td>
                <td class="stat-cell" width="33%" align="center"
                    style="padding:22px 12px;">
                  <div style="font-family:Arial,sans-serif;font-size:26px;font-weight:900;
                              color:#22C55E;letter-spacing:-1px;margin-bottom:4px;">$0</div>
                  <div style="font-family:Arial,sans-serif;font-size:10px;font-weight:600;
                              color:rgba(255,255,255,0.35);letter-spacing:0.15em;text-transform:uppercase;">
                    To join
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ══ BODY ══ -->
        <tr>
          <td class="body-pad" style="padding:36px 32px;background-color:#111411;">

            <!-- Section label -->
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
              <div style="width:20px;height:1px;background:#22C55E;display:inline-block;"></div>
              <span style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;
                           color:#22C55E;letter-spacing:0.22em;text-transform:uppercase;">
                What happens next
              </span>
            </div>

            <!-- Steps -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                   style="margin-bottom:32px;background:rgba(255,255,255,0.03);
                          border:1px solid rgba(34,197,94,0.1);border-radius:12px;
                          overflow:hidden;">

              <!-- Step 1 -->
              <tr>
                <td style="padding:20px 20px;border-bottom:1px solid rgba(34,197,94,0.08);">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td width="36" valign="top">
                        <div style="width:30px;height:30px;border-radius:6px;
                                    background:rgba(34,197,94,0.1);
                                    border:1px solid rgba(34,197,94,0.3);
                                    text-align:center;line-height:30px;
                                    font-size:12px;font-weight:700;
                                    color:#22C55E;font-family:Arial,sans-serif;">01</div>
                      </td>
                      <td valign="top" style="padding-left:14px;">
                        <p style="margin:0 0 4px;font-size:14px;font-weight:700;
                                  color:#ffffff;font-family:Arial,sans-serif;">
                          Finish Your Application
                        </p>
                        <p style="margin:0;font-size:13px;
                                  color:rgba(255,255,255,0.45);
                                  line-height:1.65;font-family:Arial,sans-serif;">
                          Complete your contact info, vehicle details, and document uploads.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Step 2 -->
              <tr>
                <td style="padding:20px 20px;border-bottom:1px solid rgba(34,197,94,0.08);">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td width="36" valign="top">
                        <div style="width:30px;height:30px;border-radius:6px;
                                    background:rgba(34,197,94,0.1);
                                    border:1px solid rgba(34,197,94,0.3);
                                    text-align:center;line-height:30px;
                                    font-size:12px;font-weight:700;
                                    color:#22C55E;font-family:Arial,sans-serif;">02</div>
                      </td>
                      <td valign="top" style="padding-left:14px;">
                        <p style="margin:0 0 4px;font-size:14px;font-weight:700;
                                  color:#ffffff;font-family:Arial,sans-serif;">
                          We Review Your Docs
                        </p>
                        <p style="margin:0;font-size:13px;
                                  color:rgba(255,255,255,0.45);
                                  line-height:1.65;font-family:Arial,sans-serif;">
                          License, registration, insurance, and photo — usually verified within <strong style="color:rgba(255,255,255,0.65);">24–48 hours</strong>.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Step 3 -->
              <tr>
                <td style="padding:20px 20px;border-bottom:1px solid rgba(34,197,94,0.08);">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td width="36" valign="top">
                        <div style="width:30px;height:30px;border-radius:6px;
                                    background:rgba(34,197,94,0.1);
                                    border:1px solid rgba(34,197,94,0.3);
                                    text-align:center;line-height:30px;
                                    font-size:12px;font-weight:700;
                                    color:#22C55E;font-family:Arial,sans-serif;">03</div>
                      </td>
                      <td valign="top" style="padding-left:14px;">
                        <p style="margin:0 0 4px;font-size:14px;font-weight:700;
                                  color:#ffffff;font-family:Arial,sans-serif;">
                          Get Approved &amp; Go Live
                        </p>
                        <p style="margin:0;font-size:13px;
                                  color:rgba(255,255,255,0.45);
                                  line-height:1.65;font-family:Arial,sans-serif;">
                          You'll get a confirmation email. Open the app, go online, and start earning immediately.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Step 4 -->
              <tr>
                <td style="padding:20px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td width="36" valign="top">
                        <div style="width:30px;height:30px;border-radius:6px;
                                    background:rgba(34,197,94,0.15);
                                    border:1px solid #22C55E;
                                    text-align:center;line-height:30px;
                                    font-size:14px;font-weight:700;
                                    color:#22C55E;font-family:Arial,sans-serif;">$</div>
                      </td>
                      <td valign="top" style="padding-left:14px;">
                        <p style="margin:0 0 4px;font-size:14px;font-weight:700;
                                  color:#22C55E;font-family:Arial,sans-serif;">
                          Start Earning
                        </p>
                        <p style="margin:0;font-size:13px;
                                  color:rgba(255,255,255,0.45);
                                  line-height:1.65;font-family:Arial,sans-serif;">
                          Earn per trip, cash out on your schedule. No minimums. No hidden fees.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>

            <!-- Documents checklist -->
            <div style="margin-bottom:28px;">
              <div style="margin-bottom:14px;">
                <div style="width:20px;height:1px;background:#22C55E;display:inline-block;vertical-align:middle;margin-right:10px;"></div>
                <span style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;
                             color:#22C55E;letter-spacing:0.22em;text-transform:uppercase;
                             vertical-align:middle;">
                  Documents needed
                </span>
              </div>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background:rgba(34,197,94,0.04);border:1px solid rgba(34,197,94,0.12);
                            border-radius:10px;overflow:hidden;">
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid rgba(34,197,94,0.08);
                             font-size:13px;color:rgba(255,255,255,0.7);font-family:Arial,sans-serif;">
                    <span style="color:#22C55E;margin-right:10px;">✓</span> Driver's License (front &amp; back)
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid rgba(34,197,94,0.08);
                             font-size:13px;color:rgba(255,255,255,0.7);font-family:Arial,sans-serif;">
                    <span style="color:#22C55E;margin-right:10px;">✓</span> Vehicle Registration
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid rgba(34,197,94,0.08);
                             font-size:13px;color:rgba(255,255,255,0.7);font-family:Arial,sans-serif;">
                    <span style="color:#22C55E;margin-right:10px;">✓</span> Proof of Insurance (current &amp; valid)
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;font-size:13px;
                             color:rgba(255,255,255,0.7);font-family:Arial,sans-serif;">
                    <span style="color:#22C55E;margin-right:10px;">✓</span> Profile Photo (clear headshot, no sunglasses)
                  </td>
                </tr>
              </table>
            </div>

            <!-- Vehicle requirements -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                   style="margin-bottom:36px;background:rgba(255,255,255,0.03);
                          border:1px solid rgba(255,255,255,0.07);border-radius:10px;">
              <tr>
                <td style="padding:16px 18px;border-bottom:1px solid rgba(255,255,255,0.06);">
                  <span style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;
                               color:rgba(255,255,255,0.35);letter-spacing:0.15em;text-transform:uppercase;">
                    Vehicle Requirements
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 18px;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td width="50%" style="font-size:13px;color:rgba(255,255,255,0.55);
                                            font-family:Arial,sans-serif;padding-bottom:8px;">
                        — Model year 2005 or newer
                      </td>
                      <td width="50%" style="font-size:13px;color:rgba(255,255,255,0.55);
                                            font-family:Arial,sans-serif;padding-bottom:8px;">
                        — 4-door, good condition
                      </td>
                    </tr>
                    <tr>
                      <td width="50%" style="font-size:13px;color:rgba(255,255,255,0.55);
                                            font-family:Arial,sans-serif;">
                        — Valid FL registration
                      </td>
                      <td width="50%" style="font-size:13px;color:rgba(255,255,255,0.55);
                                            font-family:Arial,sans-serif;">
                        — Current insurance
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- CTA button -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                   style="margin-bottom:12px;">
              <tr>
                <td align="center">
                  <a href="https://uatob.com/driver/signup"
                     style="display:inline-block;
                            background:linear-gradient(90deg,#16A34A,#22C55E);
                            color:#000000;font-size:15px;font-weight:800;
                            text-decoration:none;padding:18px 48px;
                            border-radius:8px;font-family:Arial,sans-serif;
                            letter-spacing:0.04em;text-transform:uppercase;">
                    Continue Application &nbsp;→
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;text-align:center;font-size:12px;
                      color:rgba(255,255,255,0.25);font-family:Arial,sans-serif;
                      letter-spacing:0.05em;">
              Takes less than 3 minutes to complete
            </p>

          </td>
        </tr>

        <!-- ══ FOOTER ══ -->
        <tr>
          <td style="padding:24px 32px;text-align:center;
                     background-color:#0a0d0a;
                     border-top:1px solid rgba(34,197,94,0.1);">
            <div style="font-family:Arial,sans-serif;font-size:14px;font-weight:800;
                        color:#22C55E;letter-spacing:0.1em;margin-bottom:4px;">
              UATOB
            </div>
            <div style="font-family:Arial,sans-serif;font-size:11px;
                        color:rgba(255,255,255,0.25);margin-bottom:14px;
                        letter-spacing:0.08em;">
              Orlando's Driver-First Rideshare Platform
            </div>
            <div style="font-family:Arial,sans-serif;font-size:12px;
                        color:rgba(255,255,255,0.2);margin-bottom:14px;">
              Questions? Reply to this email or visit our
              <a href="https://uatob.com/help"
                 style="color:#22C55E;text-decoration:none;">Help Center</a>
            </div>
            <div>
              <a href="https://uatob.com/privacy"
                 style="color:rgba(255,255,255,0.25);text-decoration:none;
                        font-size:11px;margin:0 10px;font-family:Arial,sans-serif;">Privacy</a>
              <a href="https://uatob.com/terms"
                 style="color:rgba(255,255,255,0.25);text-decoration:none;
                        font-size:11px;margin:0 10px;font-family:Arial,sans-serif;">Terms</a>
              <a href="https://uatob.com/unsubscribe"
                 style="color:rgba(255,255,255,0.25);text-decoration:none;
                        font-size:11px;margin:0 10px;font-family:Arial,sans-serif;">Unsubscribe</a>
            </div>
            <div style="font-family:Arial,sans-serif;font-size:11px;
                        color:rgba(255,255,255,0.12);margin-top:12px;">
              © ${year} UaTob. All rights reserved.
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;

      const msg = {
        to:      email,
        from:    "UaTob <noreply@uatob.com>",
        replyTo: "support@uatob.com",
        subject: `Welcome to UaTob, ${name} — finish your application to start driving`,
        text:    `Hey ${name}! Welcome to UaTob — Orlando's driver-first rideshare platform. Finish your application at https://uatob.com/driver/signup and our team will review it within 24–48 hours. Once approved, go online and start earning. Questions? Email support@uatob.com`,
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
