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

      const name       = firstName || "there";
      const year       = new Date().getFullYear();
      const vehicleStr = vehicle?.make && vehicle?.model
        ? `${vehicle.year || ""} ${vehicle.make} ${vehicle.model}`.trim()
        : null;

      const docRows = [
        { label: "Driver's License (Front)", ok: documents?.licenseFront },
        { label: "Driver's License (Back)",  ok: documents?.licenseBack  },
        { label: "Vehicle Registration",      ok: documents?.registration },
        { label: "Proof of Insurance",        ok: documents?.insurance    },
        { label: "Profile Photo",             ok: documents?.profilePhoto },
      ];

      const allDocsUploaded = docRows.every(d => d.ok);
      const missingCount    = docRows.filter(d => !d.ok).length;

      /* ── helpers ── */
      const esc = (s) => String(s ?? "")
        .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Application Received — UaTob</title>
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
      .outer-pad   { padding: 16px !important; }
      .hero-title  { font-size: 26px !important; line-height: 1.2 !important; }
      .hero-pad    { padding: 40px 20px 36px !important; }
      .body-pad    { padding: 28px 18px !important; }
      .summary-row td { font-size: 12px !important; }
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
                     background:linear-gradient(160deg,#0a1a0d 0%,#0f2914 45%,#0a1a0d 100%);
                     border-bottom:1px solid rgba(34,197,94,0.12);">

            <!-- Grid pattern -->
            <div style="position:absolute;inset:0;opacity:0.4;pointer-events:none;
                        background-image:linear-gradient(rgba(34,197,94,0.06) 1px,transparent 1px),
                                         linear-gradient(90deg,rgba(34,197,94,0.06) 1px,transparent 1px);
                        background-size:32px 32px;"></div>

            <!-- Icon -->
            <table cellpadding="0" cellspacing="0" role="presentation"
                   style="margin:0 auto 24px;">
              <tr>
                <td align="center">
                  <div style="width:64px;height:64px;border-radius:14px;
                              background:rgba(34,197,94,0.12);
                              border:1px solid rgba(34,197,94,0.35);
                              font-size:30px;text-align:center;line-height:64px;">
                    📋
                  </div>
                </td>
              </tr>
            </table>

            <!-- Eyebrow -->
            <div style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;
                        letter-spacing:0.28em;color:rgba(34,197,94,0.7);
                        text-transform:uppercase;margin-bottom:14px;">
              APPLICATION RECEIVED
            </div>

            <!-- Headline -->
            <h1 class="hero-title"
                style="margin:0 0 12px;font-size:32px;font-weight:900;
                       color:#ffffff;line-height:1.1;letter-spacing:-0.5px;
                       font-family:Arial,sans-serif;">
              We've got it, ${esc(name)}.
            </h1>
            <p style="margin:0 auto;font-size:15px;color:rgba(255,255,255,0.55);
                      font-family:Arial,sans-serif;line-height:1.65;max-width:380px;">
              Your driver application is in. Our team is reviewing your
              documents and vehicle info now.
            </p>

            <!-- Review time pill -->
            <table cellpadding="0" cellspacing="0" role="presentation"
                   style="margin:24px auto 0;">
              <tr>
                <td align="center"
                    style="background:rgba(253,224,71,0.08);
                           border:1px solid rgba(253,224,71,0.3);
                           border-radius:100px;padding:9px 20px;">
                  <span style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;
                               color:#fde047;letter-spacing:0.12em;text-transform:uppercase;">
                    ⏱ &nbsp;Estimated review: 24–48 hours
                  </span>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- ══ PROGRESS BAR ══ -->
        <tr>
          <td style="background-color:#0f180f;border-bottom:1px solid rgba(34,197,94,0.1);">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <!-- Step 1 — done -->
                <td width="33%" align="center"
                    style="padding:18px 8px;border-right:1px solid rgba(34,197,94,0.1);">
                  <div style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;
                              color:#22C55E;letter-spacing:0.12em;text-transform:uppercase;
                              margin-bottom:6px;">
                    ✓ &nbsp;Submitted
                  </div>
                  <div style="height:3px;background:#22C55E;border-radius:2px;"></div>
                </td>
                <!-- Step 2 — active -->
                <td width="33%" align="center"
                    style="padding:18px 8px;border-right:1px solid rgba(34,197,94,0.1);">
                  <div style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;
                              color:#fde047;letter-spacing:0.12em;text-transform:uppercase;
                              margin-bottom:6px;">
                    ● &nbsp;In Review
                  </div>
                  <div style="height:3px;background:rgba(253,224,71,0.4);border-radius:2px;"></div>
                </td>
                <!-- Step 3 — pending -->
                <td width="33%" align="center"
                    style="padding:18px 8px;">
                  <div style="font-family:Arial,sans-serif;font-size:10px;font-weight:600;
                              color:rgba(255,255,255,0.2);letter-spacing:0.12em;text-transform:uppercase;
                              margin-bottom:6px;">
                    ○ &nbsp;Decision
                  </div>
                  <div style="height:3px;background:rgba(255,255,255,0.07);border-radius:2px;"></div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ══ BODY ══ -->
        <tr>
          <td class="body-pad" style="padding:36px 32px;background-color:#111411;">

            <!-- ── APPLICATION SUMMARY ── -->
            <div style="margin-bottom:14px;">
              <div style="display:inline-block;width:20px;height:1px;
                          background:#22C55E;vertical-align:middle;margin-right:10px;"></div>
              <span style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;
                           color:#22C55E;letter-spacing:0.22em;text-transform:uppercase;
                           vertical-align:middle;">
                Application Summary
              </span>
            </div>

            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                   style="margin-bottom:28px;background:rgba(255,255,255,0.03);
                          border:1px solid rgba(34,197,94,0.1);border-radius:12px;
                          overflow:hidden;">
              <!-- Name -->
              <tr>
                <td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.05);
                           font-size:12px;color:rgba(255,255,255,0.35);
                           font-family:Arial,sans-serif;letter-spacing:0.06em;
                           text-transform:uppercase;width:40%;">
                  Full Name
                </td>
                <td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.05);
                           font-size:13px;color:rgba(255,255,255,0.8);font-weight:700;
                           font-family:Arial,sans-serif;text-align:right;">
                  ${esc(firstName)} ${esc(lastName)}
                </td>
              </tr>
              <!-- Email -->
              <tr>
                <td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.05);
                           font-size:12px;color:rgba(255,255,255,0.35);
                           font-family:Arial,sans-serif;letter-spacing:0.06em;
                           text-transform:uppercase;">
                  Email
                </td>
                <td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.05);
                           font-size:13px;color:rgba(255,255,255,0.8);font-weight:700;
                           font-family:Arial,sans-serif;text-align:right;">
                  ${esc(email)}
                </td>
              </tr>
              ${vehicleStr ? `
              <!-- Vehicle -->
              <tr>
                <td style="padding:14px 18px;
                           ${vehicle?.plate || vehicle?.rideTypes?.length ? "border-bottom:1px solid rgba(255,255,255,0.05);" : ""}
                           font-size:12px;color:rgba(255,255,255,0.35);
                           font-family:Arial,sans-serif;letter-spacing:0.06em;
                           text-transform:uppercase;">
                  Vehicle
                </td>
                <td style="padding:14px 18px;
                           ${vehicle?.plate || vehicle?.rideTypes?.length ? "border-bottom:1px solid rgba(255,255,255,0.05);" : ""}
                           font-size:13px;color:rgba(255,255,255,0.8);font-weight:700;
                           font-family:Arial,sans-serif;text-align:right;">
                  ${esc(vehicleStr)}
                </td>
              </tr>
              ` : ""}
              ${vehicle?.plate ? `
              <!-- Plate -->
              <tr>
                <td style="padding:14px 18px;
                           ${vehicle?.rideTypes?.length ? "border-bottom:1px solid rgba(255,255,255,0.05);" : ""}
                           font-size:12px;color:rgba(255,255,255,0.35);
                           font-family:Arial,sans-serif;letter-spacing:0.06em;
                           text-transform:uppercase;">
                  License Plate
                </td>
                <td style="padding:14px 18px;
                           ${vehicle?.rideTypes?.length ? "border-bottom:1px solid rgba(255,255,255,0.05);" : ""}
                           font-size:13px;color:rgba(255,255,255,0.8);font-weight:700;
                           font-family:Arial,sans-serif;text-align:right;">
                  ${esc(vehicle.plate)}
                </td>
              </tr>
              ` : ""}
              ${vehicle?.rideTypes?.length ? `
              <!-- Ride types -->
              <tr>
                <td style="padding:14px 18px;font-size:12px;color:rgba(255,255,255,0.35);
                           font-family:Arial,sans-serif;letter-spacing:0.06em;
                           text-transform:uppercase;">
                  Ride Types
                </td>
                <td style="padding:14px 18px;font-size:13px;color:rgba(255,255,255,0.8);
                           font-weight:700;font-family:Arial,sans-serif;text-align:right;
                           text-transform:capitalize;">
                  ${vehicle.rideTypes.map(esc).join(", ")}
                </td>
              </tr>
              ` : ""}
            </table>

            <!-- ── DOCUMENT STATUS ── -->
            <div style="margin-bottom:14px;">
              <div style="display:inline-block;width:20px;height:1px;
                          background:#22C55E;vertical-align:middle;margin-right:10px;"></div>
              <span style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;
                           color:#22C55E;letter-spacing:0.22em;text-transform:uppercase;
                           vertical-align:middle;">
                Document Status
              </span>
            </div>

            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                   style="margin-bottom:${allDocsUploaded ? "28px" : "12px"};
                          background:rgba(255,255,255,0.03);
                          border:1px solid ${allDocsUploaded
                            ? "rgba(34,197,94,0.2)"
                            : "rgba(253,224,71,0.2)"};
                          border-radius:12px;overflow:hidden;">
              ${docRows.map((d, i) => `
              <tr>
                <td style="padding:13px 18px;
                           ${i < docRows.length - 1 ? "border-bottom:1px solid rgba(255,255,255,0.05);" : ""}
                           font-size:13px;color:rgba(255,255,255,0.6);
                           font-family:Arial,sans-serif;">
                  ${esc(d.label)}
                </td>
                <td style="padding:13px 18px;
                           ${i < docRows.length - 1 ? "border-bottom:1px solid rgba(255,255,255,0.05);" : ""}
                           font-size:12px;font-weight:700;text-align:right;
                           font-family:Arial,sans-serif;
                           color:${d.ok ? "#22C55E" : "#fbbf24"};
                           letter-spacing:0.06em;text-transform:uppercase;">
                  ${d.ok ? "✓ Uploaded" : "⚠ Missing"}
                </td>
              </tr>
              `).join("")}
            </table>

            ${!allDocsUploaded ? `
            <!-- Missing docs warning -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                   style="margin-bottom:28px;background:rgba(251,191,36,0.06);
                          border:1px solid rgba(251,191,36,0.25);border-radius:10px;">
              <tr>
                <td style="padding:14px 18px;font-size:13px;
                           color:rgba(253,224,71,0.85);font-family:Arial,sans-serif;
                           line-height:1.65;">
                  <strong>${missingCount} document${missingCount > 1 ? "s" : ""} still missing.</strong>
                  Upload them to avoid delays — incomplete applications take longer to review.
                </td>
              </tr>
            </table>
            ` : ""}

            <!-- ── REVIEW TIMELINE ── -->
            <div style="margin-bottom:14px;">
              <div style="display:inline-block;width:20px;height:1px;
                          background:#22C55E;vertical-align:middle;margin-right:10px;"></div>
              <span style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;
                           color:#22C55E;letter-spacing:0.22em;text-transform:uppercase;
                           vertical-align:middle;">
                What happens now
              </span>
            </div>

            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                   style="margin-bottom:32px;background:rgba(255,255,255,0.03);
                          border:1px solid rgba(34,197,94,0.1);border-radius:12px;
                          overflow:hidden;">

              <!-- Done -->
              <tr>
                <td style="padding:18px 20px;border-bottom:1px solid rgba(255,255,255,0.05);">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td width="34" valign="middle">
                        <div style="width:28px;height:28px;border-radius:6px;
                                    background:rgba(34,197,94,0.15);
                                    border:1px solid #22C55E;
                                    text-align:center;line-height:28px;
                                    font-size:13px;font-weight:700;
                                    color:#22C55E;font-family:Arial,sans-serif;">✓</div>
                      </td>
                      <td valign="middle" style="padding-left:14px;">
                        <span style="font-family:Arial,sans-serif;font-size:13px;
                                     font-weight:700;color:#22C55E;">
                          Application Submitted
                        </span>
                        <span style="font-family:Arial,sans-serif;font-size:10px;
                                     font-weight:700;color:rgba(34,197,94,0.5);
                                     letter-spacing:0.1em;text-transform:uppercase;
                                     margin-left:8px;">Done</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Active -->
              <tr>
                <td style="padding:18px 20px;border-bottom:1px solid rgba(255,255,255,0.05);
                           background:rgba(253,224,71,0.03);">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td width="34" valign="top">
                        <div style="width:28px;height:28px;border-radius:6px;
                                    background:rgba(253,224,71,0.1);
                                    border:1px solid rgba(253,224,71,0.35);
                                    text-align:center;line-height:28px;
                                    font-size:12px;font-weight:700;
                                    color:#fde047;font-family:Arial,sans-serif;">02</div>
                      </td>
                      <td valign="top" style="padding-left:14px;">
                        <div style="font-family:Arial,sans-serif;font-size:13px;
                                    font-weight:700;color:#ffffff;margin-bottom:4px;">
                          Document &amp; Vehicle Verification
                          <span style="font-size:10px;font-weight:700;
                                       color:#fde047;letter-spacing:0.1em;
                                       text-transform:uppercase;margin-left:8px;">
                            In Progress
                          </span>
                        </div>
                        <div style="font-family:Arial,sans-serif;font-size:12px;
                                    color:rgba(255,255,255,0.4);line-height:1.6;">
                          License, insurance, and vehicle details are being reviewed.
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Pending -->
              <tr>
                <td style="padding:18px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td width="34" valign="top">
                        <div style="width:28px;height:28px;border-radius:6px;
                                    background:rgba(255,255,255,0.04);
                                    border:1px solid rgba(255,255,255,0.1);
                                    text-align:center;line-height:28px;
                                    font-size:12px;font-weight:700;
                                    color:rgba(255,255,255,0.2);
                                    font-family:Arial,sans-serif;">03</div>
                      </td>
                      <td valign="top" style="padding-left:14px;">
                        <div style="font-family:Arial,sans-serif;font-size:13px;
                                    font-weight:700;color:rgba(255,255,255,0.3);
                                    margin-bottom:4px;">
                          Decision Email Sent
                          <span style="font-size:10px;font-weight:700;
                                       color:rgba(255,255,255,0.2);letter-spacing:0.1em;
                                       text-transform:uppercase;margin-left:8px;">
                            Pending
                          </span>
                        </div>
                        <div style="font-family:Arial,sans-serif;font-size:12px;
                                    color:rgba(255,255,255,0.25);line-height:1.6;">
                          You'll receive an approval or follow-up within 24–48 hours.
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>

            <!-- While you wait -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                   style="margin-bottom:32px;background:rgba(255,255,255,0.03);
                          border:1px solid rgba(255,255,255,0.07);border-radius:10px;">
              <tr>
                <td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.05);">
                  <span style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;
                               color:rgba(255,255,255,0.3);letter-spacing:0.15em;
                               text-transform:uppercase;">
                    While you wait
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 18px;font-size:13px;
                           color:rgba(255,255,255,0.45);font-family:Arial,sans-serif;
                           line-height:1.9;">
                  — Keep your phone active — we may call to verify details<br/>
                  — Check your spam folder so our approval email isn't missed<br/>
                  — Make sure insurance and registration stay current<br/>
                  ${!allDocsUploaded
                    ? `— <strong style="color:rgba(253,224,71,0.7);">Upload missing documents</strong> to avoid delays`
                    : `— You're all set — sit tight and we'll be in touch`}
                </td>
              </tr>
            </table>

            <!-- ── CTA ── -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                   style="margin-bottom:10px;">
              <tr>
                <td align="center">
                  <a href="https://uatob.com/driver/signup"
                     style="display:inline-block;
                            background:${allDocsUploaded
                              ? "linear-gradient(90deg,#16A34A,#22C55E)"
                              : "linear-gradient(90deg,#b45309,#f59e0b)"};
                            color:#000000;font-size:14px;font-weight:800;
                            text-decoration:none;padding:17px 44px;
                            border-radius:8px;font-family:Arial,sans-serif;
                            letter-spacing:0.05em;text-transform:uppercase;">
                    ${allDocsUploaded
                      ? "View Your Application →"
                      : "Upload Missing Documents →"}
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;text-align:center;font-size:11px;
                      color:rgba(255,255,255,0.2);font-family:Arial,sans-serif;
                      letter-spacing:0.05em;">
              ${allDocsUploaded
                ? "We'll email you the moment a decision is made"
                : `${missingCount} missing document${missingCount > 1 ? "s" : ""} may delay your approval`}
            </p>

          </td>
        </tr>

        <!-- ══ FOOTER ══ -->
        <tr>
          <td style="padding:24px 32px;text-align:center;
                     background-color:#0a0d0a;
                     border-top:1px solid rgba(34,197,94,0.1);">
            <div style="font-family:Arial,sans-serif;font-size:13px;font-weight:800;
                        color:#22C55E;letter-spacing:0.12em;margin-bottom:4px;">
              UATOB
            </div>
            <div style="font-family:Arial,sans-serif;font-size:11px;
                        color:rgba(255,255,255,0.2);margin-bottom:12px;
                        letter-spacing:0.07em;">
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
                 style="color:rgba(255,255,255,0.2);text-decoration:none;
                        font-size:11px;margin:0 10px;font-family:Arial,sans-serif;">Privacy</a>
              <a href="https://uatob.com/terms"
                 style="color:rgba(255,255,255,0.2);text-decoration:none;
                        font-size:11px;margin:0 10px;font-family:Arial,sans-serif;">Terms</a>
              <a href="https://uatob.com/unsubscribe"
                 style="color:rgba(255,255,255,0.2);text-decoration:none;
                        font-size:11px;margin:0 10px;font-family:Arial,sans-serif;">Unsubscribe</a>
            </div>
            <div style="font-family:Arial,sans-serif;font-size:11px;
                        color:rgba(255,255,255,0.1);margin-top:12px;">
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
        subject: `Application received, ${name} — we'll review it within 48 hours`,
        text:    `Hey ${name}! We've received your UaTob driver application and our team is reviewing it now. You'll hear back within 24–48 hours.${!allDocsUploaded ? ` You still have ${missingCount} missing document(s) — upload them at https://uatob.com/driver/signup to avoid delays.` : ""} Questions? Email support@uatob.com`,
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
