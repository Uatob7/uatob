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

      // ✅ Idempotency guard
      if (after.approvalEmailSent) {
        console.log("Approval email already sent, skipping.");
        return null;
      }

      const { email, firstName, lastName, vehicle, contact, approvedAt } = after || {};

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
      const year       = new Date().getFullYear();
      const vehicleStr = vehicle?.make && vehicle?.model
        ? `${vehicle.year || ""} ${vehicle.make} ${vehicle.model}`.trim()
        : null;

      // Format approval date
      const approvedDate = (() => {
        try {
          const ms = approvedAt?.toMillis?.() ?? approvedAt?._seconds * 1000 ?? Date.now();
          return new Date(ms).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
            hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
          });
        } catch {
          return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        }
      })();

      // Format ride types
      const rideTypes = (vehicle?.rideTypes || [])
        .map(t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());

      // Format phone
      const fmtPhone = (p) => {
        const digits = String(p || "").replace(/\D/g, "");
        if (digits.length === 10) {
          return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
        }
        return p || "";
      };

      const esc = (s) => String(s ?? "")
        .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>You're Approved — Welcome to UaTob</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, sans-serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">
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
    [data-ogsc] body, [data-ogsb] body { background-color: #000000 !important; }
    u + .body { background-color: #000000 !important; }

    @media only screen and (max-width: 600px) {
      .container   { width: 100% !important; }
      .outer-pad   { padding: 16px 12px !important; }
      .hero-title  { font-size: 30px !important; line-height: 1.1 !important; }
      .hero-sub    { font-size: 14px !important; }
      .hero-pad    { padding: 38px 22px 32px !important; }
      .body-pad    { padding: 24px 18px !important; }
      .cta-btn     { padding: 17px 24px !important; font-size: 15px !important; display: block !important; }
      .perk-col    { display: block !important; width: 100% !important; padding: 0 0 10px 0 !important; }
      .step-col    { display: block !important; width: 100% !important; padding: 0 0 12px 0 !important; }
    }
  </style>
</head>
<body class="body" style="margin:0;padding:0;background-color:#000000;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- Preview text -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#000000;opacity:0;">
    🎉 You're approved, ${esc(name)}! Open the driver app and go online to start earning today.
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="margin:0;padding:0;background-color:#000000;" bgcolor="#000000">
    <tr>
      <td class="outer-pad" align="center" style="padding:32px 16px;background-color:#000000;" bgcolor="#000000">

        <table class="container" width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:600px;width:100%;background-color:#0a0a0a;
                      border-radius:20px;overflow:hidden;border:1px solid #1f1f1f;
                      box-shadow:0 0 60px rgba(34,197,94,0.12);"
               bgcolor="#0a0a0a">

          <!-- ════════ BRAND BAR ════════ -->
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
                                 border:1px solid #22C55E;">
                      &#9679;&nbsp; APPROVED
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ════════ CELEBRATION HERO ════════ -->
          <tr>
            <td class="hero-pad" align="center"
                style="background:linear-gradient(135deg,#001a0a 0%,#003d18 35%,#16A34A 100%);
                       padding:48px 32px 40px;position:relative;">

              <!-- Confetti dots (decorative) -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 22px;">
                <tr>
                  <td>
                    <div style="display:inline-block;background:linear-gradient(135deg,#FBBF24,#22C55E);
                                border-radius:100px;padding:7px 16px;
                                box-shadow:0 6px 18px rgba(251,191,36,0.35);">
                      <span style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10.5px;
                                   font-weight:800;color:#000000;letter-spacing:2px;">
                        &#10003;&nbsp; YOU'RE IN
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <h1 class="hero-title"
                  style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;
                         font-size:38px;font-weight:700;color:#ffffff;
                         line-height:1.1;letter-spacing:-1px;">
                Welcome aboard,<br/>
                <span style="color:#FCD34D;font-style:italic;">${esc(name)}.</span>
              </h1>
              <p class="hero-sub"
                 style="margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                        font-size:15px;color:#D1FAE5;line-height:1.65;font-weight:400;max-width:400px;">
                Your application is <strong style="color:#ffffff;">approved</strong>. You're now an official UaTob driver — and your first ride is waiting.
              </p>

              <!-- Approved timestamp pill -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:22px auto 0;">
                <tr>
                  <td>
                    <div style="display:inline-block;background-color:rgba(0,0,0,0.4);
                                border:1px solid rgba(255,255,255,0.18);
                                border-radius:100px;padding:7px 14px;">
                      <span style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10.5px;
                                   font-weight:700;color:#ffffff;letter-spacing:1.2px;">
                        APPROVED &middot; ${esc(approvedDate.toUpperCase())}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ════════ EARNINGS POTENTIAL ════════ -->
          <tr>
            <td class="body-pad" style="padding:28px 28px 12px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <p style="margin:0 0 14px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10.5px;
                        font-weight:700;color:#22C55E;letter-spacing:2px;">
                YOUR EARNING POWER
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background:linear-gradient(135deg,#001a0a 0%,#0d3d1a 100%);
                            border:1px solid #22C55E;border-radius:16px;overflow:hidden;
                            box-shadow:0 8px 24px rgba(22,163,74,0.18);">
                <tr>
                  <td style="padding:24px 22px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td valign="top">
                          <p style="margin:0 0 6px;font-family:'SF Mono',Menlo,Consolas,monospace;
                                    font-size:9.5px;font-weight:700;color:#86EFAC;letter-spacing:1.5px;">
                            YOU KEEP
                          </p>
                          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;
                                    font-size:48px;font-weight:700;color:#ffffff;
                                    line-height:1;letter-spacing:-2px;">
                            75%
                          </p>
                          <p style="margin:6px 0 0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                    font-size:12px;color:#86EFAC;font-weight:600;line-height:1.4;">
                            of every fare &#183; plus 100% of tips
                          </p>
                        </td>
                        <td align="right" valign="top">
                          <!-- Visual chart of split -->
                          <div style="display:inline-block;width:88px;height:88px;
                                      background:conic-gradient(#22C55E 0deg 270deg,#1a1a1a 270deg 360deg);
                                      border-radius:50%;position:relative;">
                            <div style="position:absolute;top:14px;left:14px;
                                        width:60px;height:60px;background-color:#001a0a;
                                        border-radius:50%;text-align:center;line-height:60px;
                                        font-family:Georgia,serif;font-size:20px;font-weight:700;
                                        color:#ffffff;">
                              75%
                            </div>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Comparison stats -->
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                           style="margin-top:18px;border-top:1px solid #166534;">
                      <tr>
                        <td width="33%" style="padding:14px 6px 0;text-align:center;">
                          <p style="margin:0 0 3px;font-family:Georgia,serif;font-size:18px;
                                    font-weight:700;color:#ffffff;line-height:1;letter-spacing:-0.5px;">
                            $0
                          </p>
                          <p style="margin:0;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:9px;
                                    font-weight:700;color:#86EFAC;letter-spacing:0.8px;">
                            WEEKLY FEES
                          </p>
                        </td>
                        <td width="33%" style="padding:14px 6px 0;text-align:center;
                                                border-left:1px solid #166534;border-right:1px solid #166534;">
                          <p style="margin:0 0 3px;font-family:Georgia,serif;font-size:18px;
                                    font-weight:700;color:#ffffff;line-height:1;letter-spacing:-0.5px;">
                            24h
                          </p>
                          <p style="margin:0;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:9px;
                                    font-weight:700;color:#86EFAC;letter-spacing:0.8px;">
                            PAYOUTS
                          </p>
                        </td>
                        <td width="33%" style="padding:14px 6px 0;text-align:center;">
                          <p style="margin:0 0 3px;font-family:Georgia,serif;font-size:18px;
                                    font-weight:700;color:#ffffff;line-height:1;letter-spacing:-0.5px;">
                            100%
                          </p>
                          <p style="margin:0;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:9px;
                                    font-weight:700;color:#86EFAC;letter-spacing:0.8px;">
                            OF TIPS
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ════════ PRIMARY CTA ════════ -->
          <tr>
            <td class="body-pad" style="padding:24px 28px 8px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center">
                    <a href="https://uatob.com/driver/login" class="cta-btn"
                       style="display:inline-block;
                              background:linear-gradient(135deg,#22C55E,#16A34A);
                              color:#ffffff;
                              font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                              font-size:16px;font-weight:800;text-decoration:none;
                              padding:18px 36px;border-radius:14px;letter-spacing:0.3px;
                              box-shadow:0 8px 22px rgba(22,163,74,0.45);">
                      Open Driver App &rarr;
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:10px;">
                    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                              font-size:12px;color:#86EFAC;">
                      &#9679; Your account is live &mdash; go online to start receiving requests
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ════════ GET STARTED — 3 STEPS ════════ -->
          <tr>
            <td class="body-pad" style="padding:32px 28px 16px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <p style="margin:0 0 6px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10.5px;
                        font-weight:700;color:#22C55E;letter-spacing:2px;">
                FIRST RIDE IN 3 STEPS
              </p>
              <h2 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;
                         font-weight:700;color:#ffffff;letter-spacing:-0.4px;">
                Earn money in the next hour
              </h2>

              ${[
                {
                  num: "1",
                  title: "Log into the driver app",
                  desc: `Use the email <strong style="color:#86EFAC;">${esc(email)}</strong> and the password you set during signup.`,
                  accent: "#22C55E",
                },
                {
                  num: "2",
                  title: "Tap the green online toggle",
                  desc: "It's in the top-right of the home screen. Once you're online, our dispatch sends you nearby ride requests automatically.",
                  accent: "#22C55E",
                },
                {
                  num: "3",
                  title: "Accept your first ride",
                  desc: "Drive to pickup, complete the trip, and watch your earnings hit the dashboard. First payout typically lands within 24 hours.",
                  accent: "#22C55E",
                },
              ].map((step, i, arr) => `
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-bottom:10px;background-color:#111111;
                            border:1px solid #1f1f1f;border-radius:14px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td width="44" valign="top">
                          <div style="width:36px;height:36px;
                                      background:linear-gradient(135deg,${step.accent},#16A34A);
                                      border:1px solid ${step.accent};
                                      border-radius:10px;text-align:center;line-height:34px;
                                      font-family:Georgia,serif;font-size:16px;font-weight:700;
                                      color:#ffffff;
                                      box-shadow:0 4px 10px ${step.accent}30;">
                            ${step.num}
                          </div>
                        </td>
                        <td valign="top" style="padding-left:6px;">
                          <p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                    font-size:15px;font-weight:700;color:#ffffff;letter-spacing:-0.1px;">
                            ${step.title}
                          </p>
                          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                    font-size:13px;color:#9CA3AF;line-height:1.55;">
                            ${step.desc}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>`).join("")}
            </td>
          </tr>

          <!-- ════════ YOUR DRIVER PROFILE ════════ -->
          <tr>
            <td class="body-pad" style="padding:20px 28px 12px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <p style="margin:0 0 14px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10.5px;
                        font-weight:700;color:#22C55E;letter-spacing:2px;">
                YOUR DRIVER PROFILE
              </p>

              <!-- Profile card -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background:linear-gradient(135deg,#0d1f12 0%,#0a0a0a 100%);
                            border:1px solid #166534;border-radius:14px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 22px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td valign="middle">
                          <p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;
                                    font-size:20px;font-weight:700;color:#ffffff;
                                    letter-spacing:-0.3px;line-height:1.2;">
                            ${esc(firstName || "")} ${esc(lastName || "")}
                          </p>
                          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                    font-size:12px;color:#9CA3AF;font-weight:500;
                                    word-break:break-all;">
                            ${esc(email)}
                          </p>
                          ${contact?.phone ? `
                          <p style="margin:4px 0 0;font-family:'SF Mono',Menlo,Consolas,monospace;
                                    font-size:11.5px;color:#86EFAC;font-weight:700;letter-spacing:0.5px;">
                            ${esc(fmtPhone(contact.phone))}
                          </p>` : ""}
                        </td>
                        <td align="right" valign="middle">
                          <div style="display:inline-block;
                                      background:linear-gradient(135deg,#22C55E,#16A34A);
                                      border-radius:100px;padding:6px 14px;
                                      box-shadow:0 4px 10px rgba(22,163,74,0.35);">
                            <span style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:9.5px;
                                         font-weight:800;color:#ffffff;letter-spacing:1.2px;">
                              &#9679;&nbsp; ACTIVE
                            </span>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                ${vehicleStr ? `
                <!-- Vehicle row -->
                <tr>
                  <td style="padding:18px 22px;border-top:1px solid #166534;
                             background-color:rgba(0,0,0,0.25);">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td valign="middle">
                          <p style="margin:0 0 3px;font-family:'SF Mono',Menlo,Consolas,monospace;
                                    font-size:9px;font-weight:700;color:#6B7280;letter-spacing:1.2px;">
                            APPROVED VEHICLE
                          </p>
                          <p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                    font-size:15px;font-weight:700;color:#ffffff;line-height:1.2;">
                            ${esc(vehicleStr)}${vehicle?.color ? ` &middot; <span style="color:#9CA3AF;font-weight:500;">${esc(vehicle.color)}</span>` : ""}
                          </p>
                          ${rideTypes.length > 0 ? `
                          <p style="margin:0;font-family:'SF Mono',Menlo,Consolas,monospace;
                                    font-size:10px;font-weight:700;color:#86EFAC;letter-spacing:1px;">
                            ${rideTypes.map(esc).join(" &#183; ")}
                          </p>` : ""}
                        </td>
                        <td align="right" valign="middle">
                          <!-- Realistic license plate -->
                          <div style="display:inline-block;
                                      background:linear-gradient(180deg,#fafafa,#e5e5e5);
                                      border:2px solid #404040;border-radius:6px;padding:5px 11px;
                                      font-family:'Courier New',monospace;font-size:14px;font-weight:900;
                                      color:#000000;letter-spacing:2px;
                                      box-shadow:0 2px 5px rgba(0,0,0,0.5),inset 0 -1px 0 rgba(0,0,0,0.1);">
                            ${esc((vehicle?.plate || "—").toUpperCase())}
                          </div>
                          <div style="margin-top:3px;font-family:'SF Mono',Menlo,Consolas,monospace;
                                      font-size:8.5px;font-weight:700;color:#6B7280;letter-spacing:1px;">
                            FLORIDA
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>` : ""}
              </table>

              <p style="margin:10px 4px 0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                        font-size:11px;color:#6B7280;line-height:1.5;">
                Need to update something? Manage your profile in the driver app under Settings.
              </p>
            </td>
          </tr>

          <!-- ════════ FIRST DAY TIPS ════════ -->
          <tr>
            <td class="body-pad" style="padding:20px 28px 12px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <p style="margin:0 0 14px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10.5px;
                        font-weight:700;color:#22C55E;letter-spacing:2px;">
                PRO TIPS FOR DAY ONE
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td width="50%" class="perk-col"
                      style="padding-right:6px;vertical-align:top;padding-bottom:10px;">
                    <div style="background-color:#111111;border:1px solid #1f1f1f;border-radius:14px;
                                padding:16px;height:100%;">
                      <div style="display:inline-block;background-color:#0d1f12;border:1px solid #166534;
                                  border-radius:8px;padding:6px 10px;margin-bottom:10px;
                                  font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10px;
                                  font-weight:800;color:#22C55E;letter-spacing:1px;">
                        &#127919; HOTSPOTS
                      </div>
                      <p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                font-size:13px;font-weight:700;color:#ffffff;line-height:1.3;">
                        Drive peak hours
                      </p>
                      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                font-size:11.5px;color:#9CA3AF;line-height:1.5;">
                        Mornings 7-9am, evenings 5-7pm, weekend nights. More requests, more earnings.
                      </p>
                    </div>
                  </td>
                  <td width="50%" class="perk-col"
                      style="padding-left:6px;vertical-align:top;padding-bottom:10px;">
                    <div style="background-color:#111111;border:1px solid #1f1f1f;border-radius:14px;
                                padding:16px;height:100%;">
                      <div style="display:inline-block;background-color:#001a2e;border:1px solid #1e40af;
                                  border-radius:8px;padding:6px 10px;margin-bottom:10px;
                                  font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10px;
                                  font-weight:800;color:#60A5FA;letter-spacing:1px;">
                        &#11088; RATINGS
                      </div>
                      <p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                font-size:13px;font-weight:700;color:#ffffff;line-height:1.3;">
                        Clean car, friendly hello
                      </p>
                      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                font-size:11.5px;color:#9CA3AF;line-height:1.5;">
                        First impressions decide your rating. A clean interior &amp; warm greeting go far.
                      </p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" class="perk-col"
                      style="padding-right:6px;vertical-align:top;">
                    <div style="background-color:#111111;border:1px solid #1f1f1f;border-radius:14px;
                                padding:16px;height:100%;">
                      <div style="display:inline-block;background-color:#1c1000;border:1px solid #78350f;
                                  border-radius:8px;padding:6px 10px;margin-bottom:10px;
                                  font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10px;
                                  font-weight:800;color:#FBBF24;letter-spacing:1px;">
                        &#128293; STREAKS
                      </div>
                      <p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                font-size:13px;font-weight:700;color:#ffffff;line-height:1.3;">
                        Stay online 30+ min
                      </p>
                      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                font-size:11.5px;color:#9CA3AF;line-height:1.5;">
                        Quick on/off cycles tank your acceptance rate. Commit to a window.
                      </p>
                    </div>
                  </td>
                  <td width="50%" class="perk-col"
                      style="padding-left:6px;vertical-align:top;">
                    <div style="background-color:#111111;border:1px solid #1f1f1f;border-radius:14px;
                                padding:16px;height:100%;">
                      <div style="display:inline-block;background-color:#1c0033;border:1px solid #6B21A8;
                                  border-radius:8px;padding:6px 10px;margin-bottom:10px;
                                  font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10px;
                                  font-weight:800;color:#C084FC;letter-spacing:1px;">
                        &#128241; ALWAYS-ON
                      </div>
                      <p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                font-size:13px;font-weight:700;color:#ffffff;line-height:1.3;">
                        Phone charged, sound on
                      </p>
                      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                font-size:11.5px;color:#9CA3AF;line-height:1.5;">
                        Missed pings hurt your score. Use a car charger and turn ride alerts up.
                      </p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ════════ REFERRAL ════════ -->
          <tr>
            <td class="body-pad" style="padding:20px 28px 12px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background:linear-gradient(135deg,#1c1000 0%,#0a0a0a 100%);
                            border:1px solid #FBBF24;border-radius:14px;overflow:hidden;">
                <tr>
                  <td style="padding:18px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td width="48" valign="middle">
                          <div style="width:42px;height:42px;
                                      background:linear-gradient(135deg,#FBBF24,#D97706);
                                      border-radius:11px;text-align:center;line-height:42px;
                                      font-size:20px;
                                      box-shadow:0 4px 12px rgba(251,191,36,0.35);">
                            &#128276;
                          </div>
                        </td>
                        <td valign="middle" style="padding-left:10px;">
                          <p style="margin:0 0 3px;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                    font-size:14px;font-weight:800;color:#ffffff;letter-spacing:-0.1px;">
                            Know other Orlando drivers?
                          </p>
                          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                    font-size:12px;color:#FDE68A;line-height:1.5;">
                            Help us build the network. Share UaTob with anyone you'd want to drive alongside.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ════════ SUPPORT ════════ -->
          <tr>
            <td class="body-pad" style="padding:20px 28px 28px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
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
                            We're here, 24/7
                          </p>
                          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                    font-size:12.5px;color:#9CA3AF;line-height:1.5;">
                            Stuck on something? Reply to this email or write
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

          <!-- ════════ FOOTER ════════ -->
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
                &copy; ${year} UaTob LLC. All rights reserved.
              </p>
              <div>
                <a href="https://uatob.com/privacy-policy"
                   style="color:#6B7280;text-decoration:none;font-size:10.5px;margin:0 8px;
                          font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                          border-bottom:1px dotted #4B5563;">Privacy</a>
                <a href="https://uatob.com/driver-terms"
                   style="color:#6B7280;text-decoration:none;font-size:10.5px;margin:0 8px;
                          font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                          border-bottom:1px dotted #4B5563;">Driver Terms</a>
                <a href="https://uatob.com/help"
                   style="color:#6B7280;text-decoration:none;font-size:10.5px;margin:0 8px;
                          font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                          border-bottom:1px dotted #4B5563;">Help</a>
              </div>
              <p style="margin:14px 0 0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                        font-size:10px;color:#374151;line-height:1.5;">
                You're receiving this because you're an approved UaTob driver.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`.trim();

      // ── Plain-text version ────────────────────────────
      const text =
        `🎉 You're approved, ${name}!\n\n` +
        `Your UaTob driver application is approved. You're now an official driver and your first ride is waiting.\n\n` +
        `APPROVED: ${approvedDate}\n\n` +
        `YOU KEEP:\n` +
        `  ✓ 75% of every fare\n` +
        `  ✓ 100% of tips\n` +
        `  ✓ $0 weekly fees, ever\n` +
        `  ✓ Payouts within 24 hours\n\n` +
        `FIRST RIDE IN 3 STEPS:\n` +
        `  1. Log into the driver app with ${email}\n` +
        `  2. Tap the green online toggle (top-right of home)\n` +
        `  3. Accept your first ride and start earning\n\n` +
        (vehicleStr ? `APPROVED VEHICLE: ${vehicleStr}${vehicle?.color ? ` (${vehicle.color})` : ""}\n  Plate: ${(vehicle?.plate || "—").toUpperCase()}\n  Ride types: ${rideTypes.join(", ") || "Standard"}\n\n` : "") +
        `PRO TIPS:\n` +
        `  - Drive peak hours (7-9am, 5-7pm, weekend nights)\n` +
        `  - Keep your car clean and greet riders warmly\n` +
        `  - Stay online 30+ minutes — quick on/off hurts your rate\n` +
        `  - Phone charged, sound on for ride pings\n\n` +
        `Open the driver app: https://uatob.com/driver/login\n\n` +
        `Questions? Reply here or email support@uatob.com\n\n` +
        `Welcome aboard,\n— The UaTob Team\nOrlando, FL`;

      const msg = {
        to:      email,
        from:    "UaTob <noreply@uatob.com>",
        replyTo: "support@uatob.com",
        subject: `🎉 You're approved, ${name} — your first ride is waiting`,
        text,
        html,
      };

      await sgMail.send(msg);

      // ✅ Mark as sent to prevent re-fires
      await event.data.after.ref.update({ approvalEmailSent: true });

      console.log(`📧 Approval email sent to ${email} (${firstName} ${lastName}) ✅`);
      return null;

    } catch (error) {
      console.error("❌ Error sending approval email:", error);
      return null;
    }
  }
);