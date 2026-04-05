const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const sgMail = require("@sendgrid/mail");

exports.onDriverApplicationSubmitted = onDocumentUpdated(
  {
    document: "Drivers/{uid}",
    region: "us-central1",
    secrets: ["SENDGRID_API_KEY"],
  },
  async (event) => {
    try {
      const before = event.data.before.data();
      const after  = event.data.after.data();

      // Only fire when status flips to "pending"
      if (before.status === after.status) return null;
      if (after.status !== "pending") return null;

      const { email, firstName, lastName, vehicle, documents } = after || {};

      if (!email) {
        console.log("No email on driver doc, skipping application submitted email.");
        return null;
      }

      const sendgridKey = process.env.SENDGRID_API_KEY;
      if (!sendgridKey) {
        console.error("Missing SENDGRID_API_KEY");
        return null;
      }

      sgMail.setApiKey(sendgridKey);

      const name        = firstName || "there";
      const vehicleStr  = vehicle?.make && vehicle?.model
        ? `${vehicle.year || ""} ${vehicle.make} ${vehicle.model}`.trim()
        : null;

      // Build doc status rows
      const docRows = [
        { label: "Driver's License (Front)", ok: documents?.licenseFront },
        { label: "Driver's License (Back)",  ok: documents?.licenseBack  },
        { label: "Vehicle Registration",      ok: documents?.registration },
        { label: "Proof of Insurance",        ok: documents?.insurance    },
        { label: "Profile Photo",             ok: documents?.profilePhoto },
      ];

      const allDocsUploaded = docRows.every(d => d.ok);

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Application Received — UaTob</title>
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
                      ✅
                    </div>
                  </td>
                </tr>
              </table>

              <h1 class="hero-title"
                  style="margin:0 0 12px;font-size:32px;font-weight:900;color:#ffffff;
                         line-height:1.2;letter-spacing:-0.5px;font-family:Arial,sans-serif;">
                Application Received!
              </h1>
              <p style="margin:0;font-size:16px;color:#ffffff;font-weight:500;
                        font-family:Arial,sans-serif;opacity:0.92;line-height:1.5;">
                We've got everything we need, ${name}.<br/>
                Our team is reviewing your application now.
              </p>
            </td>
          </tr>

          <!-- ── REVIEW TIMER BADGE ── -->
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
                      ⏱️ &nbsp;ESTIMATED REVIEW TIME: 24–48 HOURS
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
                Hey <strong>${name}</strong>! Your UaTob driver application has been
                successfully submitted. We'll review your documents and vehicle
                information and send you a decision within <strong>24–48 hours</strong>.
              </p>

              <!-- ── APPLICATION SUMMARY ── -->
              <div style="background-color:#f9fafb;border:1px solid #e5e7eb;
                          border-radius:16px;padding:24px;margin-bottom:28px;">
                <h2 style="margin:0 0 18px;font-size:17px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  📋 Your Application Summary
                </h2>

                <!-- Name -->
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

              <!-- ── DOCUMENTS STATUS ── -->
              <div style="border-radius:16px;padding:24px;margin-bottom:28px;
                          background-color:${allDocsUploaded ? "#f0fdf4" : "#fffbeb"};
                          border:2px solid ${allDocsUploaded ? "#86efac" : "#fde047"};">
                <h2 style="margin:0 0 16px;font-size:17px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  ${allDocsUploaded ? "📁 Documents — All Uploaded ✓" : "📁 Document Status"}
                </h2>

                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  ${docRows.map((d, i) => `
                  <tr>
                    <td style="padding:9px 0;
                               ${i < docRows.length - 1 ? "border-bottom:1px solid " + (allDocsUploaded ? "#bbf7d0" : "#fde68a") + ";" : ""}
                               font-size:13.5px;color:#111827;font-family:Arial,sans-serif;">
                      ${d.label}
                    </td>
                    <td style="padding:9px 0;
                               ${i < docRows.length - 1 ? "border-bottom:1px solid " + (allDocsUploaded ? "#bbf7d0" : "#fde68a") + ";" : ""}
                               font-size:13.5px;font-weight:700;text-align:right;
                               color:${d.ok ? "#16A34A" : "#D97706"};
                               font-family:Arial,sans-serif;">
                      ${d.ok ? "✓ Uploaded" : "⚠ Pending"}
                    </td>
                  </tr>
                  `).join("")}
                </table>

                ${!allDocsUploaded ? `
                <div style="margin-top:16px;padding:12px 16px;background-color:#fef3c7;
                            border-radius:10px;font-size:13px;color:#92400e;
                            font-family:Arial,sans-serif;line-height:1.6;">
                  ⚠️ <strong>Some documents are still missing.</strong> You can upload
                  them by returning to your application. Missing documents may delay
                  your approval.
                </div>
                ` : ""}
              </div>

              <!-- ── REVIEW TIMELINE ── -->
              <div style="background-color:#eff6ff;border:2px solid #93c5fd;
                          border-radius:16px;padding:24px;margin-bottom:32px;">
                <h2 style="margin:0 0 18px;font-size:17px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  🗓️ Review Timeline
                </h2>

                <!-- Timeline item 1 -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                       style="margin-bottom:14px;">
                  <tr>
                    <td width="36" valign="top">
                      <div style="width:28px;height:28px;background-color:#22C55E;
                                  border-radius:50%;text-align:center;line-height:28px;
                                  font-size:13px;font-weight:700;color:#ffffff;
                                  font-family:Arial,sans-serif;">✓</div>
                    </td>
                    <td valign="middle" style="padding-left:10px;">
                      <p style="margin:0;font-size:14px;color:#111827;font-weight:700;
                                font-family:Arial,sans-serif;">
                        Application Submitted
                        <span style="font-weight:500;color:#16A34A;margin-left:8px;
                                     font-size:12px;">DONE</span>
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Timeline item 2 -->
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
                        Document &amp; Background Verification
                        <span style="font-weight:500;color:#2563EB;margin-left:8px;
                                     font-size:12px;">IN PROGRESS</span>
                      </p>
                      <p style="margin:4px 0 0;font-size:13px;color:#4B5563;
                                font-family:Arial,sans-serif;">
                        Our team reviews your license, insurance, and vehicle details.
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Timeline item 3 -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td width="36" valign="top">
                      <div style="width:28px;height:28px;background-color:#D1D5DB;
                                  border-radius:50%;text-align:center;line-height:28px;
                                  font-size:13px;font-weight:700;color:#ffffff;
                                  font-family:Arial,sans-serif;">3</div>
                    </td>
                    <td valign="middle" style="padding-left:10px;">
                      <p style="margin:0;font-size:14px;color:#6B7280;font-weight:700;
                                font-family:Arial,sans-serif;">
                        Decision Email Sent to You
                        <span style="font-weight:500;color:#9CA3AF;margin-left:8px;
                                     font-size:12px;">PENDING</span>
                      </p>
                      <p style="margin:4px 0 0;font-size:13px;color:#9CA3AF;
                                font-family:Arial,sans-serif;">
                        You'll get an approval or follow-up email within 24–48 hours.
                      </p>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- ── WHILE YOU WAIT ── -->
              <div style="background-color:#f9fafb;border:1px solid #e5e7eb;
                          border-radius:14px;padding:20px;margin-bottom:32px;">
                <p style="margin:0 0 12px;font-size:15px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  💡 While You Wait
                </p>
                <ul style="margin:0;padding-left:18px;font-size:13.5px;
                           color:#4B5563;line-height:1.85;font-family:Arial,sans-serif;">
                  <li>Make sure your phone number is active — we may call to verify details</li>
                  <li>Keep your vehicle registration and insurance current</li>
                  <li>Check your spam folder so our approval email doesn't get buried</li>
                  ${!allDocsUploaded ? "<li><strong>Upload any missing documents</strong> to avoid delays</li>" : ""}
                </ul>
              </div>

              <!-- ── CTA ── -->
              ${!allDocsUploaded ? `
              <div style="text-align:center;margin:32px 0;">
                <a href="https://uatob.com/driver/signup"
                   style="display:inline-block;background-color:#D97706;
                          color:#ffffff;font-size:16px;font-weight:700;
                          text-decoration:none;padding:16px 36px;
                          border-radius:14px;font-family:Arial,sans-serif;">
                  Upload Missing Documents →
                </a>
                <p style="margin:12px 0 0;font-size:13px;color:#6B7280;
                           font-family:Arial,sans-serif;">
                  Missing documents may delay your approval
                </p>
              </div>
              ` : `
              <div style="text-align:center;margin:32px 0;">
                <p style="margin:0 0 6px;font-size:15px;color:#111827;font-weight:700;
                           font-family:Arial,sans-serif;">
                  🎉 You're all set! Sit tight.
                </p>
                <p style="margin:0;font-size:14px;color:#6B7280;
                           font-family:Arial,sans-serif;line-height:1.6;">
                  We'll email you the moment your application is approved.
                </p>
              </div>
              `}

              <!-- ── FOOTER NOTE ── -->
              <div style="text-align:center;padding-top:24px;
                          border-top:1px solid #e5e7eb;">
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
        subject: `✅ Application received, ${name} — we'll review it within 48 hours.`,
        text:    `Hey ${name}! We've received your UaTob driver application and our team is reviewing it now. You'll hear back within 24–48 hours. Questions? Visit https://uatob.com/help`,
        html,
      };

      await sgMail.send(msg);
      console.log(`📧 Application submitted email sent to ${email} (${firstName} ${lastName}) ✅`);
      return null;

    } catch (error) {
      console.error("❌ Error sending application submitted email:", error);
      return null;
    }
  }
);
