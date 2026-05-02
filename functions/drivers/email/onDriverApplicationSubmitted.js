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

      // ✅ Only fire when status flips TO "pending"
      if (before.status === after.status) return null;
      if (after.status !== "pending") return null;

      // ✅ Idempotency guard
      if (after.submittedEmailSent) {
        console.log("Submitted email already sent, skipping.");
        return null;
      }

      const { email, firstName, lastName, vehicle, documents, contact, submittedAt } = after || {};

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

      const name = firstName || "there";
      const year = new Date().getFullYear();

      // ── Format vehicle ────────────────────────────────
      const vehicleStr = vehicle?.make && vehicle?.model
        ? `${vehicle.year || ""} ${vehicle.make} ${vehicle.model}`.trim()
        : null;

      // ── Format submitted date ─────────────────────────
      const submittedDate = (() => {
        try {
          const ms = submittedAt?.toMillis?.() ?? submittedAt?._seconds * 1000 ?? Date.now();
          const d = new Date(ms);
          return d.toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
            hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
          });
        } catch {
          return new Date().toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
          });
        }
      })();

      // ── Document status ───────────────────────────────
      const docRows = [
        { key: "licenseFront", label: "Driver's License (Front)", critical: true,  ok: !!documents?.licenseFront },
        { key: "licenseBack",  label: "Driver's License (Back)",  critical: true,  ok: !!documents?.licenseBack  },
        { key: "registration", label: "Vehicle Registration",      critical: true,  ok: !!documents?.registration },
        { key: "insurance",    label: "Proof of Insurance",        critical: true,  ok: !!documents?.insurance    },
        { key: "profilePhoto", label: "Profile Photo",             critical: true,  ok: !!documents?.profilePhoto },
      ];
      const allDocsUploaded = docRows.every(d => d.ok);
      const uploadedCount   = docRows.filter(d => d.ok).length;
      const missingCount    = docRows.length - uploadedCount;
      const missingDocs     = docRows.filter(d => !d.ok);
      const docsPct         = Math.round((uploadedCount / docRows.length) * 100);

      // ── Helpers ───────────────────────────────────────
      const esc = (s) => String(s ?? "")
        .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

      // Format phone: 4079426078 -> (407) 942-6078
      const fmtPhone = (p) => {
        const digits = String(p || "").replace(/\D/g, "");
        if (digits.length === 10) {
          return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
        }
        return p || "";
      };

      // Format ride types nicely
      const rideTypes = (vehicle?.rideTypes || [])
        .map(t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Application Received — UaTob</title>
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
      .hero-title  { font-size: 26px !important; line-height: 1.15 !important; }
      .hero-sub    { font-size: 14px !important; }
      .hero-pad    { padding: 36px 22px 30px !important; }
      .body-pad    { padding: 24px 18px !important; }
      .cta-btn     { padding: 16px 22px !important; font-size: 14px !important; display: block !important; }
      .veh-stat    { display: block !important; width: 100% !important; padding: 8px 0 !important; }
      .summary-cell{ font-size: 12px !important; padding: 12px 14px !important; }
    }
  </style>
</head>
<body class="body" style="margin:0;padding:0;background-color:#000000;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- Preview text -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#000000;opacity:0;">
    Hey ${esc(name)}, your UaTob application is in. Review takes 24–48 hours.${!allDocsUploaded ? ` ${missingCount} doc${missingCount > 1 ? "s" : ""} still needed to avoid delays.` : ""}
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="margin:0;padding:0;background-color:#000000;" bgcolor="#000000">
    <tr>
      <td class="outer-pad" align="center" style="padding:32px 16px;background-color:#000000;" bgcolor="#000000">

        <table class="container" width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:600px;width:100%;background-color:#0a0a0a;
                      border-radius:20px;overflow:hidden;border:1px solid #1f1f1f;"
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
                                 border:1px solid #166534;">
                      &#9679;&nbsp; APPLICATION
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ════════ HERO ════════ -->
          <tr>
            <td class="hero-pad" align="center"
                style="background:linear-gradient(135deg,#001a0a 0%,#003d18 50%,#16A34A 200%);
                       padding:42px 32px 36px;">

              <!-- Status badge -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 18px;">
                <tr>
                  <td>
                    <div style="display:inline-block;background-color:rgba(34,197,94,0.18);
                                border:1.5px solid #22C55E;border-radius:100px;padding:6px 14px;">
                      <span style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10px;
                                   font-weight:700;color:#86EFAC;letter-spacing:2px;">
                        &#9679;&nbsp; APPLICATION RECEIVED
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <h1 class="hero-title"
                  style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;
                         font-size:32px;font-weight:700;color:#ffffff;
                         line-height:1.15;letter-spacing:-0.8px;">
                We've got it,<br/>
                <span style="color:#86EFAC;font-style:italic;">${esc(name)}.</span>
              </h1>
              <p class="hero-sub"
                 style="margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                        font-size:14.5px;color:#D1FAE5;line-height:1.6;font-weight:400;max-width:380px;">
                Your driver application is in. Our team is reviewing your documents and vehicle info now.
              </p>

              <!-- ETA pill -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:22px auto 0;">
                <tr>
                  <td>
                    <div style="display:inline-block;background-color:rgba(0,0,0,0.35);
                                border:1px solid rgba(255,255,255,0.15);
                                border-radius:100px;padding:8px 16px;">
                      <span style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:11px;
                                   font-weight:700;color:#ffffff;letter-spacing:1.2px;">
                        &#9201;&nbsp; REVIEW: 24&ndash;48 HOURS
                      </span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ════════ TIMELINE ════════ -->
          <tr>
            <td style="padding:20px 24px;background-color:#0a0a0a;border-bottom:1px solid #1a1a1a;"
                bgcolor="#0a0a0a">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <!-- Step 1: Submitted -->
                  <td width="33%" align="center" style="padding:0 4px;">
                    <div style="width:32px;height:32px;background:linear-gradient(135deg,#22C55E,#16A34A);
                                border-radius:50%;display:inline-block;text-align:center;line-height:32px;
                                font-family:Arial,sans-serif;font-size:14px;font-weight:800;color:#ffffff;
                                box-shadow:0 0 0 4px rgba(34,197,94,0.18);">
                      &#10003;
                    </div>
                    <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:9.5px;
                                font-weight:700;color:#22C55E;margin-top:8px;letter-spacing:1.2px;">
                      SUBMITTED
                    </div>
                  </td>
                  <!-- Step 2: Review -->
                  <td width="33%" align="center" style="padding:0 4px;">
                    <div style="width:32px;height:32px;background-color:#1c1000;
                                border:1.5px solid #FBBF24;border-radius:50%;display:inline-block;
                                text-align:center;line-height:29px;
                                font-family:Arial,sans-serif;font-size:13px;font-weight:800;color:#FBBF24;
                                box-shadow:0 0 0 4px rgba(251,191,36,0.12);">
                      2
                    </div>
                    <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:9.5px;
                                font-weight:700;color:#FBBF24;margin-top:8px;letter-spacing:1.2px;">
                      IN REVIEW
                    </div>
                  </td>
                  <!-- Step 3: Decision -->
                  <td width="33%" align="center" style="padding:0 4px;">
                    <div style="width:32px;height:32px;background-color:#1a1a1a;
                                border:1.5px solid #2a2a2a;border-radius:50%;display:inline-block;
                                text-align:center;line-height:29px;
                                font-family:Arial,sans-serif;font-size:13px;font-weight:800;color:#4b5563;">
                      3
                    </div>
                    <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:9.5px;
                                font-weight:700;color:#4b5563;margin-top:8px;letter-spacing:1.2px;">
                      DECISION
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Connecting line -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:8px;">
                <tr>
                  <td style="padding:0 28px;">
                    <div style="height:2px;background:linear-gradient(90deg,#22C55E 0%,#22C55E 33%,#FBBF24 33%,#FBBF24 66%,#2a2a2a 66%);border-radius:2px;"></div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${!allDocsUploaded ? `
          <!-- ════════ MISSING DOCS BANNER (PRIORITY) ════════ -->
          <tr>
            <td style="padding:18px 24px 0;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background:linear-gradient(135deg,#1c1000 0%,#1a0d00 100%);
                            border:1.5px solid #FBBF24;border-radius:14px;overflow:hidden;">
                <tr>
                  <td style="padding:18px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td width="44" valign="top">
                          <div style="width:38px;height:38px;
                                      background:linear-gradient(135deg,#FBBF24,#D97706);
                                      border-radius:10px;text-align:center;line-height:38px;
                                      font-size:18px;font-weight:900;color:#000000;
                                      box-shadow:0 4px 12px rgba(251,191,36,0.3);">
                            &#9888;
                          </div>
                        </td>
                        <td valign="top" style="padding-left:8px;">
                          <p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                    font-size:15px;font-weight:800;color:#ffffff;letter-spacing:-0.1px;">
                            ${missingCount} document${missingCount > 1 ? "s" : ""} still needed
                          </p>
                          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                    font-size:13px;color:#FDE68A;line-height:1.55;">
                            ${missingDocs.map(d => `<strong style="color:#ffffff;">${esc(d.label)}</strong>`).join(" &middot; ")}<br/>
                            <span style="color:#FCD34D;font-weight:600;">Upload these to avoid review delays.</span>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}

          <!-- ════════ DOCS PROGRESS ════════ -->
          <tr>
            <td class="body-pad" style="padding:28px 28px 12px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-bottom:14px;">
                <tr>
                  <td>
                    <p style="margin:0;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10.5px;
                              font-weight:700;color:#22C55E;letter-spacing:2px;">
                      DOCUMENT STATUS
                    </p>
                  </td>
                  <td align="right">
                    <p style="margin:0;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:11px;
                              font-weight:700;color:${allDocsUploaded ? "#22C55E" : "#FBBF24"};
                              letter-spacing:0.5px;">
                      ${uploadedCount} OF ${docRows.length} &#183; ${docsPct}%
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Progress bar -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background-color:#1a1a1a;border-radius:100px;overflow:hidden;margin-bottom:18px;">
                <tr>
                  <td height="8" style="line-height:8px;font-size:0;">
                    <table width="${docsPct}%" cellpadding="0" cellspacing="0" role="presentation"
                           style="background:${allDocsUploaded
                             ? "linear-gradient(90deg,#16A34A,#22C55E,#86EFAC)"
                             : "linear-gradient(90deg,#FBBF24,#F59E0B)"};
                                  border-radius:100px;">
                      <tr>
                        <td height="8" style="line-height:8px;font-size:0;">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Doc rows -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background-color:#111111;border:1px solid #1f1f1f;
                            border-radius:14px;overflow:hidden;">
                ${docRows.map((d, i) => `
                <tr>
                  <td style="padding:13px 16px;
                             ${i < docRows.length - 1 ? "border-bottom:1px solid #1a1a1a;" : ""}">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td width="28" valign="middle">
                          <div style="width:22px;height:22px;
                                      background:${d.ok ? "#0d3d1a" : "#1c1000"};
                                      border:1px solid ${d.ok ? "#22C55E" : "#FBBF24"};
                                      border-radius:6px;text-align:center;line-height:20px;
                                      font-family:Arial,sans-serif;font-size:11px;font-weight:800;
                                      color:${d.ok ? "#22C55E" : "#FBBF24"};">
                            ${d.ok ? "&#10003;" : "&#33;"}
                          </div>
                        </td>
                        <td valign="middle" style="padding-left:10px;">
                          <span style="font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                       font-size:13px;font-weight:600;
                                       color:${d.ok ? "#ffffff" : "#FDE68A"};">
                            ${esc(d.label)}
                          </span>
                        </td>
                        <td align="right" valign="middle">
                          <span style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:9.5px;
                                       font-weight:700;color:${d.ok ? "#22C55E" : "#FBBF24"};
                                       letter-spacing:1px;
                                       background-color:${d.ok ? "#0a1f10" : "#1c1000"};
                                       border:1px solid ${d.ok ? "#166534" : "#78350f"};
                                       padding:3px 8px;border-radius:100px;">
                            ${d.ok ? "UPLOADED" : "MISSING"}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                `).join("")}
              </table>
            </td>
          </tr>

          <!-- ════════ CONTACT INFO ════════ -->
          ${contact ? `
          <tr>
            <td class="body-pad" style="padding:20px 28px 12px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <p style="margin:0 0 14px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10.5px;
                        font-weight:700;color:#22C55E;letter-spacing:2px;">
                CONTACT &amp; APPLICANT
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background-color:#111111;border:1px solid #1f1f1f;
                            border-radius:14px;overflow:hidden;">
                <tr>
                  <td class="summary-cell" style="padding:14px 16px;border-bottom:1px solid #1a1a1a;
                                                  font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                                  font-size:11px;color:#6B7280;letter-spacing:0.5px;
                                                  text-transform:uppercase;font-weight:700;width:38%;">
                    Name
                  </td>
                  <td class="summary-cell" style="padding:14px 16px;border-bottom:1px solid #1a1a1a;
                                                  font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                                  font-size:13px;color:#ffffff;font-weight:700;text-align:right;">
                    ${esc(firstName)} ${esc(lastName)}
                  </td>
                </tr>
                <tr>
                  <td class="summary-cell" style="padding:14px 16px;border-bottom:1px solid #1a1a1a;
                                                  font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                                  font-size:11px;color:#6B7280;letter-spacing:0.5px;
                                                  text-transform:uppercase;font-weight:700;">
                    Email
                  </td>
                  <td class="summary-cell" style="padding:14px 16px;border-bottom:1px solid #1a1a1a;
                                                  font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                                  font-size:13px;color:#ffffff;font-weight:700;text-align:right;
                                                  word-break:break-all;">
                    ${esc(email)}
                  </td>
                </tr>
                ${contact.phone ? `
                <tr>
                  <td class="summary-cell" style="padding:14px 16px;border-bottom:1px solid #1a1a1a;
                                                  font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                                  font-size:11px;color:#6B7280;letter-spacing:0.5px;
                                                  text-transform:uppercase;font-weight:700;">
                    Phone
                  </td>
                  <td class="summary-cell" style="padding:14px 16px;border-bottom:1px solid #1a1a1a;
                                                  font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                                  font-size:13px;color:#ffffff;font-weight:700;text-align:right;">
                    ${esc(fmtPhone(contact.phone))}
                  </td>
                </tr>` : ""}
                ${contact.address ? `
                <tr>
                  <td class="summary-cell" style="padding:14px 16px;border-bottom:1px solid #1a1a1a;
                                                  font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                                  font-size:11px;color:#6B7280;letter-spacing:0.5px;
                                                  text-transform:uppercase;font-weight:700;vertical-align:top;">
                    Address
                  </td>
                  <td class="summary-cell" style="padding:14px 16px;border-bottom:1px solid #1a1a1a;
                                                  font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                                  font-size:13px;color:#ffffff;font-weight:700;text-align:right;
                                                  line-height:1.5;">
                    ${esc(contact.address)}<br/>
                    <span style="color:#9CA3AF;font-weight:500;">
                      ${esc(contact.city || "")}${contact.city && contact.state ? ", " : ""}${esc(contact.state || "")} ${esc(contact.zip || "")}
                    </span>
                  </td>
                </tr>` : ""}
                <tr>
                  <td class="summary-cell" style="padding:14px 16px;
                                                  font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                                  font-size:11px;color:#6B7280;letter-spacing:0.5px;
                                                  text-transform:uppercase;font-weight:700;">
                    Submitted
                  </td>
                  <td class="summary-cell" style="padding:14px 16px;
                                                  font-family:'SF Mono',Menlo,Consolas,monospace;
                                                  font-size:12px;color:#86EFAC;font-weight:700;text-align:right;">
                    ${esc(submittedDate)}
                  </td>
                </tr>
              </table>

              <p style="margin:10px 4px 0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                        font-size:11px;color:#6B7280;line-height:1.5;">
                See something wrong? Reply to this email and we'll fix it.
              </p>
            </td>
          </tr>
          ` : ""}

          <!-- ════════ VEHICLE CARD ════════ -->
          ${vehicleStr ? `
          <tr>
            <td class="body-pad" style="padding:20px 28px 12px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <p style="margin:0 0 14px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10.5px;
                        font-weight:700;color:#22C55E;letter-spacing:2px;">
                YOUR VEHICLE
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background:linear-gradient(135deg,#0d1f12 0%,#0a0a0a 100%);
                            border:1px solid #166534;border-radius:14px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 22px 14px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td valign="top">
                          <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10px;
                                      font-weight:700;color:#86EFAC;letter-spacing:1.2px;margin-bottom:4px;">
                            ${rideTypes.length > 0 ? rideTypes.map(esc).join(" &middot; ") : "STANDARD"}
                          </div>
                          <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;
                                      font-weight:700;color:#ffffff;letter-spacing:-0.4px;line-height:1.2;">
                            ${esc(vehicleStr)}
                          </div>
                          ${vehicle?.color ? `
                          <div style="margin-top:6px;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                      font-size:12px;color:#9CA3AF;font-weight:500;">
                            ${esc(vehicle.color)}
                          </div>` : ""}
                        </td>
                        <td align="right" valign="top">
                          <!-- License plate -->
                          <div style="display:inline-block;background:linear-gradient(180deg,#fafafa,#e5e5e5);
                                      border:2px solid #404040;border-radius:6px;padding:6px 12px;
                                      font-family:'Courier New',monospace;font-size:16px;font-weight:900;
                                      color:#000000;letter-spacing:2px;
                                      box-shadow:0 2px 6px rgba(0,0,0,0.5),inset 0 -1px 0 rgba(0,0,0,0.1);">
                            ${esc(vehicle?.plate || "—").toUpperCase()}
                          </div>
                          <div style="margin-top:5px;font-family:'SF Mono',Menlo,Consolas,monospace;
                                      font-size:9px;font-weight:700;color:#6B7280;letter-spacing:1px;">
                            FLORIDA
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 22px 18px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                           style="border-top:1px solid #166534;">
                      <tr>
                        <td class="veh-stat" width="${vehicle?.year ? "33%" : "50%"}"
                            style="padding:12px 0 0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;">
                          <div style="font-size:9.5px;font-weight:700;color:#6B7280;letter-spacing:1px;
                                      text-transform:uppercase;margin-bottom:3px;">Make</div>
                          <div style="font-size:13px;font-weight:700;color:#ffffff;">${esc(vehicle?.make || "—")}</div>
                        </td>
                        <td class="veh-stat" width="${vehicle?.year ? "33%" : "50%"}"
                            style="padding:12px 0 0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;">
                          <div style="font-size:9.5px;font-weight:700;color:#6B7280;letter-spacing:1px;
                                      text-transform:uppercase;margin-bottom:3px;">Model</div>
                          <div style="font-size:13px;font-weight:700;color:#ffffff;">${esc(vehicle?.model || "—")}</div>
                        </td>
                        ${vehicle?.year ? `
                        <td class="veh-stat" width="33%"
                            style="padding:12px 0 0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;">
                          <div style="font-size:9.5px;font-weight:700;color:#6B7280;letter-spacing:1px;
                                      text-transform:uppercase;margin-bottom:3px;">Year</div>
                          <div style="font-size:13px;font-weight:700;color:#ffffff;">${esc(vehicle.year)}</div>
                        </td>` : ""}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}

          <!-- ════════ CTA ════════ -->
          <tr>
            <td class="body-pad" style="padding:24px 28px 8px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center">
                    <a href="https://uatob.com/driver-signup" class="cta-btn"
                       style="display:inline-block;
                              background:${allDocsUploaded
                                ? "linear-gradient(135deg,#22C55E,#16A34A)"
                                : "linear-gradient(135deg,#FBBF24,#D97706)"};
                              color:${allDocsUploaded ? "#ffffff" : "#000000"};
                              font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                              font-size:15px;font-weight:800;text-decoration:none;
                              padding:16px 32px;border-radius:14px;letter-spacing:0.3px;
                              box-shadow:0 4px 14px ${allDocsUploaded
                                ? "rgba(22,163,74,0.4)"
                                : "rgba(251,191,36,0.35)"};">
                      ${allDocsUploaded
                        ? "View Application &rarr;"
                        : `Upload ${missingCount} Missing Doc${missingCount > 1 ? "s" : ""} &rarr;`}
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:10px;">
                    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                              font-size:12px;color:#6B7280;">
                      ${allDocsUploaded
                        ? "We'll email you the moment a decision is made"
                        : `Adding missing docs typically speeds up review by 1&ndash;2 days`}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ════════ WHILE YOU WAIT ════════ -->
          <tr>
            <td class="body-pad" style="padding:24px 28px 12px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <p style="margin:0 0 14px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10.5px;
                        font-weight:700;color:#22C55E;letter-spacing:2px;">
                WHILE YOU WAIT
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background-color:#111111;border:1px solid #1f1f1f;border-radius:14px;">
                ${[
                  { icon: "&#128241;", title: "Keep your phone active",
                    desc: "We may text or call to verify a detail on your application." },
                  { icon: "&#128231;", title: "Whitelist our email",
                    desc: "Mark <strong style='color:#86EFAC;'>noreply@uatob.com</strong> as not spam so the approval email lands in your inbox." },
                  { icon: "&#128218;", title: "Keep documents current",
                    desc: "Make sure your insurance and registration don't expire during review." },
                  ...(!allDocsUploaded ? [{
                    icon: "&#9888;", title: `Upload your ${missingCount} missing doc${missingCount > 1 ? "s" : ""}`,
                    desc: `<strong style='color:#FDE68A;'>${missingDocs.map(d => esc(d.label)).join(", ")}</strong> &mdash; missing docs delay approval.`,
                    urgent: true,
                  }] : []),
                ].map((item, i, arr) => `
                <tr>
                  <td style="padding:14px 18px;
                             ${i < arr.length - 1 ? "border-bottom:1px solid #1a1a1a;" : ""}
                             ${item.urgent ? "background-color:#1c1000;" : ""}">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td width="36" valign="top" style="padding-top:1px;">
                          <div style="width:30px;height:30px;
                                      background:${item.urgent ? "#FBBF24" : "#0d1f12"};
                                      border:1px solid ${item.urgent ? "#FBBF24" : "#166534"};
                                      border-radius:8px;text-align:center;line-height:30px;
                                      font-size:14px;color:${item.urgent ? "#000000" : "#22C55E"};">
                            ${item.icon}
                          </div>
                        </td>
                        <td valign="top" style="padding-left:10px;">
                          <p style="margin:0 0 3px;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                    font-size:13.5px;font-weight:700;
                                    color:${item.urgent ? "#FCD34D" : "#ffffff"};">
                            ${item.title}
                          </p>
                          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                    font-size:12.5px;color:${item.urgent ? "#FDE68A" : "#9CA3AF"};line-height:1.55;">
                            ${item.desc}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                `).join("")}
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
                            Questions about your application?
                          </p>
                          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
                                    font-size:12.5px;color:#9CA3AF;line-height:1.5;">
                            Reply to this email or reach us at
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
                You're receiving this because you submitted a UaTob driver application.
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
        `Hey ${name},\n\n` +
        `We've received your UaTob driver application — our team is reviewing it now.\n\n` +
        `REVIEW TIME: 24–48 hours\n` +
        `SUBMITTED: ${submittedDate}\n\n` +
        `DOCUMENT STATUS (${uploadedCount}/${docRows.length}):\n` +
        docRows.map(d => `  ${d.ok ? "[✓] UPLOADED" : "[!] MISSING "}  ${d.label}`).join("\n") +
        (!allDocsUploaded
          ? `\n\n⚠ ${missingCount} DOCUMENT${missingCount > 1 ? "S" : ""} MISSING:\n` +
            missingDocs.map(d => `  - ${d.label}`).join("\n") +
            `\n\nUpload these to avoid review delays:\n` +
            `https://uatob.com/driver-signup`
          : "") +
        (vehicleStr ? `\n\nYOUR VEHICLE:\n  ${vehicleStr}\n  Plate: ${(vehicle?.plate || "—").toUpperCase()}\n  Color: ${vehicle?.color || "—"}\n  Ride types: ${rideTypes.join(", ") || "Standard"}` : "") +
        `\n\nWHILE YOU WAIT:\n` +
        `  - Keep your phone active (we may call to verify)\n` +
        `  - Whitelist noreply@uatob.com so our approval email isn't filtered\n` +
        `  - Keep your insurance and registration current\n\n` +
        `Questions? Reply here or email support@uatob.com\n\n` +
        `— The UaTob Team\nOrlando, FL`;

      const subject = allDocsUploaded
        ? `✓ Application received, ${name} — review in 24–48 hours`
        : `⚠ ${name}, your UaTob application is in — but ${missingCount} doc${missingCount > 1 ? "s" : ""} still needed`;

      const msg = {
        to:      email,
        from:    "UaTob <noreply@uatob.com>",
        replyTo: "support@uatob.com",
        subject,
        text,
        html,
      };

      await sgMail.send(msg);

      // ✅ Mark as sent to prevent re-fires
      await event.data.after.ref.update({ submittedEmailSent: true });

      console.log(`📧 Application submitted email sent to ${email} (${firstName} ${lastName}) ✅ — ${uploadedCount}/${docRows.length} docs`);
      return null;

    } catch (error) {
      console.error("❌ Error sending application submitted email:", error);
      return null;
    }
  }
);