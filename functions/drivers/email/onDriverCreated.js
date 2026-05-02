const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const sgMail = require("@sendgrid/mail");

exports.onDriverCreated = onDocumentUpdated(
  {
    document: "Drivers/{uid}",
    region: "us-central1",
    secrets: ["SENDGRID_API_KEY"],
  },
  async (event) => {
    try {
      const after = event.data.after.data();

      if (!after) return null;

      const { email, firstName, lastName, welcomeEmailSent, currentStep } = after;

      if (!email) return null;
      if (welcomeEmailSent) {
        console.log("Welcome email already sent, skipping.");
        return null;
      }

      const sendgridKey = process.env.SENDGRID_API_KEY;
      if (!sendgridKey) {
        console.error("Missing SENDGRID_API_KEY");
        return null;
      }

      sgMail.setApiKey(sendgridKey);

      const name = firstName || "there";
      const step = Number(currentStep ?? 1);
      const totalSteps = 5;
      const progressPct = Math.round((step / totalSteps) * 100);

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Welcome to UaTob — Finish Your Application</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, sans-serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">
    /* Force dark mode regardless of client setting */
    :root {
      color-scheme: dark;
      supported-color-schemes: dark;
    }
    body, html {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #000000 !important;
      color: #ffffff !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    /* Prevent dark mode auto-inversion in iOS Mail */
    [data-ogsc] body, [data-ogsb] body { background-color: #000000 !important; }
    u + .body { background-color: #000000 !important; }

    /* Mobile responsive */
    @media only screen and (max-width: 600px) {
      .container   { width: 100% !important; }
      .content-pad { padding: 24px 18px !important; }
      .hero-pad    { padding: 38px 22px 32px !important; }
      .hero-title  { font-size: 28px !important; line-height: 1.15 !important; }
      .hero-sub    { font-size: 14px !important; }
      .cta-btn     { padding: 16px 24px !important; font-size: 14px !important; display: block !important; }
      .perk-col    { display: block !important; width: 100% !important; padding: 0 0 10px 0 !important; }
      .stat-num    { font-size: 22px !important; }
    }
  </style>
</head>
<body class="body" style="margin:0;padding:0;background-color:#000000;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- Preview text -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#000000;opacity:0;">
    Hey ${name}, your UaTob driver account is created. You're 1 step in — finish the next 4 to get on the road.
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="margin:0;padding:0;background-color:#000000;" bgcolor="#000000">
    <tr>
      <td align="center" style="padding:32px 16px;background-color:#000000;" bgcolor="#000000">

        <table class="container" width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:600px;width:100%;background-color:#0a0a0a;border-radius:20px;
                      overflow:hidden;border:1px solid #1f1f1f;" bgcolor="#0a0a0a">

          <!-- ────────── BRAND BAR ────────── -->
          <tr>
            <td style="padding:18px 24px;background-color:#000000;border-bottom:1px solid #1a1a1a;"
                bgcolor="#000000">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td valign="middle">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td valign="middle" style="padding-right:8px;">
                          <div style="width:30px;height:30px;background:linear-gradient(135deg,#22C55E,#16A34A);
                                      border-radius:8px;display:inline-block;text-align:center;line-height:30px;
                                      font-size:15px;font-weight:900;color:#ffffff;font-family:Arial,sans-serif;">
                            U
                          </div>
                        </td>
                        <td valign="middle">
                          <span style="font-family:Arial,sans-serif;font-size:18px;font-weight:900;
                                       color:#ffffff;letter-spacing:-0.4px;">UaTob</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" valign="middle">
                    <span style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:9.5px;
                                 font-weight:700;color:#22C55E;background-color:#0a1f10;
                                 padding:5px 10px;border-radius:100px;letter-spacing:1.5px;
                                 border:1px solid #166534;">
                      &#9679;&nbsp; DRIVER PORTAL
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ────────── HERO ────────── -->
          <tr>
            <td class="hero-pad" align="center"
                style="background:linear-gradient(135deg,#001a0a 0%,#003d18 50%,#16A34A 200%);
                       padding:44px 32px 38px;position:relative;">

              <!-- Welcome badge -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 20px;">
                <tr>
                  <td>
                    <div style="display:inline-block;background-color:rgba(34,197,94,0.18);
                                border:1.5px solid #22C55E;border-radius:100px;padding:6px 14px;">
                      <span style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10px;
                                   font-weight:700;color:#86EFAC;letter-spacing:2px;">
                        &#9679;&nbsp; ACCOUNT CREATED
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <h1 class="hero-title"
                  style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;
                         font-size:34px;font-weight:700;color:#ffffff;
                         line-height:1.15;letter-spacing:-0.8px;">
                You're in,<br/>
                <span style="color:#86EFAC;font-style:italic;">${name}</span>
              </h1>
              <p class="hero-sub"
                 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                        font-size:15px;color:#D1FAE5;line-height:1.6;font-weight:400;">
                Welcome to Orlando's driver-first rideshare.<br/>
                You're <strong style="color:#ffffff;">1 of 5 steps</strong> to your first ride.
              </p>
            </td>
          </tr>

          <!-- ────────── PROGRESS TRACKER ────────── -->
          <tr>
            <td style="padding:24px 28px 8px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-bottom:14px;">
                <tr>
                  <td style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10px;
                             font-weight:700;color:#6B7280;letter-spacing:1.5px;">
                    APPLICATION PROGRESS
                  </td>
                  <td align="right" style="font-family:'SF Mono',Menlo,Consolas,monospace;
                                            font-size:11px;font-weight:700;color:#22C55E;
                                            letter-spacing:0.5px;">
                    ${progressPct}% &#183; STEP ${step}/${totalSteps}
                  </td>
                </tr>
              </table>

              <!-- Progress bar (table-based for email client compat) -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background-color:#1a1a1a;border-radius:100px;overflow:hidden;">
                <tr>
                  <td height="8" style="line-height:8px;font-size:0;">
                    <table width="${progressPct}%" cellpadding="0" cellspacing="0" role="presentation"
                           style="background:linear-gradient(90deg,#16A34A,#22C55E,#86EFAC);
                                  border-radius:100px;">
                      <tr>
                        <td height="8" style="line-height:8px;font-size:0;">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Step dots -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:14px;">
                <tr>
                  ${[1,2,3,4,5].map(i => {
                    const done = i < step;
                    const current = i === step;
                    const bg = done ? "#22C55E" : current ? "#16A34A" : "#1a1a1a";
                    const border = done ? "#22C55E" : current ? "#86EFAC" : "#2a2a2a";
                    const color = done || current ? "#ffffff" : "#4b5563";
                    const labels = ["Account", "Contact", "Vehicle", "Documents", "Review"];
                    return `
                  <td width="20%" align="center" style="padding:0 2px;">
                    <div style="width:26px;height:26px;background-color:${bg};border:1.5px solid ${border};
                                border-radius:50%;display:inline-block;text-align:center;line-height:23px;
                                font-family:Arial,sans-serif;font-size:11px;font-weight:800;color:${color};
                                ${current ? "box-shadow:0 0 0 4px rgba(34,197,94,0.18);" : ""}">
                      ${done ? "&#10003;" : i}
                    </div>
                    <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:9px;
                                font-weight:600;color:${current ? "#22C55E" : done ? "#86EFAC" : "#4b5563"};
                                margin-top:6px;letter-spacing:0.5px;text-transform:uppercase;">
                      ${labels[i-1]}
                    </div>
                  </td>`;
                  }).join("")}
                </tr>
              </table>
            </td>
          </tr>

          <!-- ────────── PRIMARY CTA ────────── -->
          <tr>
            <td class="content-pad" style="padding:28px 32px 8px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center">
                    <a href="https://uatob.com/driver-signup" class="cta-btn"
                       style="display:inline-block;background:linear-gradient(135deg,#22C55E,#16A34A);
                              color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                              font-size:15px;font-weight:800;text-decoration:none;
                              padding:16px 32px;border-radius:14px;letter-spacing:0.3px;
                              box-shadow:0 4px 14px rgba(22,163,74,0.4);">
                      Continue Application &rarr;
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:10px;">
                    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                              font-size:12px;color:#6B7280;">
                      Picks up where you left off &#183; ~5 min to finish
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ────────── WHAT'S NEXT ────────── -->
          <tr>
            <td class="content-pad" style="padding:32px 32px 16px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <p style="margin:0 0 6px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10.5px;
                        font-weight:700;color:#22C55E;letter-spacing:2px;">
                NEXT FOR YOU
              </p>
              <h2 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;
                         font-weight:700;color:#ffffff;letter-spacing:-0.4px;">
                Finish these 4 things
              </h2>

              ${[
                {
                  num: "2", current: step === 2,
                  title: "Tell us a little more",
                  desc: "Phone number, address, and emergency contact. Takes about 1 minute.",
                  icon: "&#9742;"
                },
                {
                  num: "3", current: step === 3,
                  title: "Add your vehicle",
                  desc: "Make, model, year, color, plate. We support cars 2005 or newer.",
                  icon: "&#128663;"
                },
                {
                  num: "4", current: step === 4,
                  title: "Upload your documents",
                  desc: "Driver's license, insurance, registration, and a clear profile photo.",
                  icon: "&#128196;"
                },
                {
                  num: "5", current: step === 5,
                  title: "We review &amp; you go live",
                  desc: "Most drivers are approved within 24&ndash;48 hours. Then start earning.",
                  icon: "&#10003;"
                },
              ].map((item) => `
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-bottom:10px;background-color:${item.current ? "#0d1f12" : "#111111"};
                            border:1px solid ${item.current ? "#16A34A" : "#1a1a1a"};
                            border-radius:14px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td width="44" valign="top">
                          <div style="width:36px;height:36px;
                                      background:${item.current
                                        ? "linear-gradient(135deg,#22C55E,#16A34A)"
                                        : "#1a1a1a"};
                                      border:1px solid ${item.current ? "#22C55E" : "#2a2a2a"};
                                      border-radius:10px;text-align:center;line-height:34px;
                                      font-family:Arial,sans-serif;font-size:14px;font-weight:800;
                                      color:#ffffff;">
                            ${item.num}
                          </div>
                        </td>
                        <td valign="top" style="padding-left:6px;">
                          <p style="margin:0 0 3px;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                    font-size:15px;font-weight:700;color:#ffffff;letter-spacing:-0.1px;">
                            ${item.title}
                          </p>
                          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                    font-size:13px;color:#9CA3AF;line-height:1.55;">
                            ${item.desc}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>`).join("")}
            </td>
          </tr>

          <!-- ────────── DOCUMENTS CHECKLIST ────────── -->
          <tr>
            <td class="content-pad" style="padding:8px 32px 28px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background-color:#001a0a;border:1px solid #166534;border-radius:14px;">
                <tr>
                  <td style="padding:20px 22px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                           style="margin-bottom:14px;">
                      <tr>
                        <td>
                          <p style="margin:0;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10px;
                                    font-weight:700;color:#86EFAC;letter-spacing:2px;">
                            HAVE THESE READY
                          </p>
                        </td>
                        <td align="right">
                          <span style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:9.5px;
                                       font-weight:700;color:#fbbf24;background-color:#1c1000;
                                       padding:3px 8px;border-radius:100px;letter-spacing:1px;
                                       border:1px solid #78350f;">
                            FOR STEP 4
                          </span>
                        </td>
                      </tr>
                    </table>

                    ${[
                      { label: "Driver's License", note: "Front &amp; back, clear &amp; current" },
                      { label: "Vehicle Registration", note: "Florida state registration" },
                      { label: "Proof of Insurance", note: "Active policy, your name on it" },
                      { label: "Profile Photo", note: "Clear headshot, no sunglasses" },
                    ].map((doc, i, arr) => `
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="padding:10px 0;${i < arr.length - 1 ? "border-bottom:1px solid #0d3d1a;" : ""}">
                          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td width="22" valign="top" style="padding-top:1px;">
                                <span style="color:#22C55E;font-size:14px;font-weight:800;">&#9633;</span>
                              </td>
                              <td valign="top">
                                <p style="margin:0 0 2px;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                          font-size:13.5px;font-weight:700;color:#ffffff;">
                                  ${doc.label}
                                </p>
                                <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                          font-size:11.5px;color:#86EFAC;line-height:1.5;">
                                  ${doc.note}
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>`).join("")}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ────────── PERKS GRID ────────── -->
          <tr>
            <td class="content-pad" style="padding:8px 32px 32px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <p style="margin:0 0 6px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10.5px;
                        font-weight:700;color:#22C55E;letter-spacing:2px;">
                WHY UATOB
              </p>
              <h2 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:22px;
                         font-weight:700;color:#ffffff;letter-spacing:-0.4px;">
                Built different. On purpose.
              </h2>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td width="50%" class="perk-col"
                      style="padding-right:6px;vertical-align:top;padding-bottom:12px;">
                    <div style="background-color:#0d1f12;border:1px solid #166534;border-radius:14px;
                                padding:18px 16px;text-align:center;">
                      <p class="stat-num"
                         style="margin:0 0 4px;font-family:Georgia,serif;font-size:30px;
                                font-weight:700;color:#22C55E;line-height:1;letter-spacing:-1px;">
                        75%
                      </p>
                      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                font-size:12px;font-weight:600;color:#D1FAE5;line-height:1.4;">
                        of every fare to you
                      </p>
                    </div>
                  </td>
                  <td width="50%" class="perk-col"
                      style="padding-left:6px;vertical-align:top;padding-bottom:12px;">
                    <div style="background-color:#001a2e;border:1px solid #1e40af;border-radius:14px;
                                padding:18px 16px;text-align:center;">
                      <p class="stat-num"
                         style="margin:0 0 4px;font-family:Georgia,serif;font-size:30px;
                                font-weight:700;color:#60A5FA;line-height:1;letter-spacing:-1px;">
                        $0
                      </p>
                      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                font-size:12px;font-weight:600;color:#DBEAFE;line-height:1.4;">
                        weekly fees, ever
                      </p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" class="perk-col"
                      style="padding-right:6px;vertical-align:top;">
                    <div style="background-color:#1c1000;border:1px solid #78350f;border-radius:14px;
                                padding:18px 16px;text-align:center;">
                      <p class="stat-num"
                         style="margin:0 0 4px;font-family:Georgia,serif;font-size:30px;
                                font-weight:700;color:#fbbf24;line-height:1;letter-spacing:-1px;">
                        24h
                      </p>
                      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                font-size:12px;font-weight:600;color:#FDE68A;line-height:1.4;">
                        instant payouts
                      </p>
                    </div>
                  </td>
                  <td width="50%" class="perk-col"
                      style="padding-left:6px;vertical-align:top;">
                    <div style="background-color:#1c0033;border:1px solid #6B21A8;border-radius:14px;
                                padding:18px 16px;text-align:center;">
                      <p class="stat-num"
                         style="margin:0 0 4px;font-family:Georgia,serif;font-size:30px;
                                font-weight:700;color:#C084FC;line-height:1;letter-spacing:-1px;">
                        100%
                      </p>
                      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                font-size:12px;font-weight:600;color:#E9D5FF;line-height:1.4;">
                        of tips, kept
                      </p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ────────── SUPPORT ────────── -->
          <tr>
            <td class="content-pad" style="padding:8px 32px 32px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background-color:#111111;border:1px solid #1f1f1f;border-radius:14px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td width="44" valign="middle">
                          <div style="width:36px;height:36px;background-color:#0d1f12;
                                      border:1px solid #166534;border-radius:10px;
                                      text-align:center;line-height:34px;font-size:18px;">
                            &#128172;
                          </div>
                        </td>
                        <td valign="middle" style="padding-left:8px;">
                          <p style="margin:0 0 2px;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                    font-size:14px;font-weight:700;color:#ffffff;">
                            Need help?
                          </p>
                          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                    font-size:12.5px;color:#9CA3AF;line-height:1.5;">
                            Reply to this email or write to
                            <a href="mailto:support@uatob.com"
                               style="color:#22C55E;text-decoration:none;font-weight:700;">support@uatob.com</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ────────── FOOTER ────────── -->
          <tr>
            <td style="padding:24px 32px 28px;background-color:#000000;border-top:1px solid #1a1a1a;
                       text-align:center;" bgcolor="#000000">
              <table cellpadding="0" cellspacing="0" role="presentation" align="center"
                     style="margin:0 auto 12px;">
                <tr>
                  <td valign="middle" style="padding-right:6px;">
                    <div style="width:18px;height:18px;background:linear-gradient(135deg,#22C55E,#16A34A);
                                border-radius:5px;display:inline-block;text-align:center;line-height:18px;
                                font-size:9px;font-weight:900;color:#ffffff;font-family:Arial,sans-serif;">
                      U
                    </div>
                  </td>
                  <td valign="middle">
                    <span style="font-family:Arial,sans-serif;font-size:12px;font-weight:800;
                                 color:#ffffff;letter-spacing:-0.2px;">UaTob</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                        font-size:11px;color:#6B7280;letter-spacing:0.3px;">
                Orlando, Florida &nbsp;&middot;&nbsp; Built with &#10084; for drivers
              </p>
              <p style="margin:0 0 14px;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                        font-size:10.5px;color:#4B5563;">
                &copy; ${new Date().getFullYear()} UaTob LLC. All rights reserved.
              </p>
              <div>
                <a href="https://uatob.com/privacy"
                   style="color:#6B7280;text-decoration:none;font-size:10.5px;margin:0 8px;
                          font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                          border-bottom:1px dotted #4B5563;">Privacy</a>
                <a href="https://uatob.com/driver-terms"
                   style="color:#6B7280;text-decoration:none;font-size:10.5px;margin:0 8px;
                          font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                          border-bottom:1px dotted #4B5563;">Driver Terms</a>
                <a href="https://uatob.com/unsubscribe"
                   style="color:#6B7280;text-decoration:none;font-size:10.5px;margin:0 8px;
                          font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                          border-bottom:1px dotted #4B5563;">Unsubscribe</a>
              </div>
              <p style="margin:14px 0 0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                        font-size:10px;color:#374151;line-height:1.5;">
                You're receiving this because you started a UaTob driver application.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`.trim();

      const text =
        `Hey ${name},\n\n` +
        `Welcome to UaTob — Orlando's driver-first rideshare.\n\n` +
        `You're step ${step} of ${totalSteps} (${progressPct}% complete).\n\n` +
        `WHAT'S NEXT:\n` +
        `  2. Tell us a little more (1 min)\n` +
        `  3. Add your vehicle\n` +
        `  4. Upload your documents\n` +
        `  5. We review & you go live (24–48 hrs)\n\n` +
        `HAVE THESE READY for step 4:\n` +
        `  - Driver's License (front & back)\n` +
        `  - Vehicle Registration\n` +
        `  - Proof of Insurance\n` +
        `  - Profile Photo (clear, no sunglasses)\n\n` +
        `WHY UATOB:\n` +
        `  - 75% of every fare is yours\n` +
        `  - $0 weekly fees, ever\n` +
        `  - Payouts within 24 hours\n` +
        `  - 100% of tips, kept\n\n` +
        `Continue your application: https://uatob.com/driver-signup\n\n` +
        `Questions? Reply here or email support@uatob.com\n\n` +
        `— The UaTob Team\nOrlando, FL`;

      const msg = {
        to: email,
        from: "UaTob <noreply@uatob.com>",
        replyTo: "support@uatob.com",
        subject: `🚗 You're in, ${name} — finish your UaTob application`,
        text,
        html,
      };

      await sgMail.send(msg);

      await event.data.after.ref.update({ welcomeEmailSent: true });

      console.log(`📧 Driver welcome email sent to ${email} (${firstName} ${lastName}) ✅`);
      return null;

    } catch (err) {
      console.error("❌ Welcome email error:", err);
      return null;
    }
  }
);