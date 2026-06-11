// functions/rides/notifyMatchedDriversByEmail.js
// Fires whenever a Rides doc is updated.
// When status becomes "searching_driver" → email every driver in the match array
// as long as:
//   - ride.expireAt has not passed
//   - that driver has not already been emailed (matchEmailedUids array)

const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret }      = require("firebase-functions/params");
const admin                 = require("firebase-admin");
const sgMail                = require("@sendgrid/mail");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");

// ── EMAIL BUILDER ───────────────────────────────────────────────
function buildDriverRideEmail({
  driverFirstName,
  pickup,
  dropoff,
  fareTotal,
  driverPayout,
  miles,
  etaMin,
  rideId,
  isScheduled,
  scheduledAt,
  year,
}) {
  const esc = (s) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const name        = esc(driverFirstName || "Driver");
  const pickupEsc   = esc(pickup  || "Pickup location");
  const dropoffEsc  = esc(dropoff || "Destination");
  const payoutStr   = Number(driverPayout  || 0).toFixed(2);
  const fareStr     = Number(fareTotal     || 0).toFixed(2);
  const milesStr    = Number(miles         || 0).toFixed(1);
  const etaStr      = String(etaMin        || "?");

  const schedLabel = (() => {
    if (!isScheduled || !scheduledAt) return null;
    try {
      const ms = scheduledAt?.toMillis?.() ?? scheduledAt?._seconds * 1000 ?? null;
      if (!ms) return null;
      return new Date(ms).toLocaleString("en-US", {
        month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit",
        hour12: true, timeZone: "America/New_York",
      });
    } catch { return null; }
  })();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>New Ride Request — UaTob</title>
  <style type="text/css">
    :root { color-scheme: dark; supported-color-schemes: dark; }
    body, html {
      margin: 0 !important; padding: 0 !important;
      background-color: #000000 !important; color: #ffffff !important;
      -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;
    }
    u + .body { background-color: #000000 !important; }
    @media only screen and (max-width: 600px) {
      .container  { width: 100% !important; }
      .outer-pad  { padding: 16px 12px !important; }
      .body-pad   { padding: 20px 16px !important; }
      .hero-title { font-size: 28px !important; }
      .stat-col   { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body class="body" style="margin:0;padding:0;background-color:#000000;color:#ffffff;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- Preview text -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#000000;opacity:0;">
    🚗 New ride request near you — $${payoutStr} payout · ${milesStr}mi · ~${etaStr}min away
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="margin:0;padding:0;background-color:#000000;" bgcolor="#000000">
    <tr>
      <td class="outer-pad" align="center"
          style="padding:32px 16px;background-color:#000000;" bgcolor="#000000">

        <table class="container" width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:600px;width:100%;background-color:#0a0a0a;
                      border-radius:20px;overflow:hidden;border:1px solid #1f1f1f;
                      box-shadow:0 0 60px rgba(34,197,94,0.10);" bgcolor="#0a0a0a">

          <!-- ── BRAND BAR ── -->
          <tr>
            <td style="padding:18px 24px;background-color:#000000;
                       border-bottom:1px solid #1a1a1a;" bgcolor="#000000">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td valign="middle">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td valign="middle" style="padding-right:8px;">
                          <div style="width:30px;height:30px;
                                      background:linear-gradient(135deg,#22C55E,#16A34A);
                                      border-radius:8px;display:inline-block;
                                      text-align:center;line-height:30px;
                                      font-size:15px;font-weight:900;
                                      color:#ffffff;font-family:Arial,sans-serif;">U</div>
                        </td>
                        <td valign="middle">
                          <span style="font-family:Arial,sans-serif;font-size:18px;
                                       font-weight:900;color:#ffffff;
                                       letter-spacing:-0.4px;">UaTob</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" valign="middle">
                    <span style="font-family:'SF Mono',Menlo,Consolas,monospace;
                                 font-size:9.5px;font-weight:700;color:#22C55E;
                                 background-color:#0a1f10;padding:5px 10px;
                                 border-radius:100px;letter-spacing:1.5px;
                                 border:1px solid #22C55E;">
                      &#9679;&nbsp; RIDE REQUEST
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── HERO ── -->
          <tr>
            <td align="center"
                style="background:linear-gradient(135deg,#001a0a 0%,#003d18 35%,#16A34A 100%);
                       padding:40px 32px 36px;">
              <table cellpadding="0" cellspacing="0" role="presentation"
                     style="margin:0 auto 18px;">
                <tr>
                  <td>
                    <div style="display:inline-block;
                                background:linear-gradient(135deg,#FBBF24,#F59E0B);
                                border-radius:100px;padding:7px 16px;
                                box-shadow:0 6px 18px rgba(251,191,36,0.35);">
                      <span style="font-family:'SF Mono',Menlo,Consolas,monospace;
                                   font-size:10.5px;font-weight:800;color:#000000;
                                   letter-spacing:2px;">
                        &#128652;&nbsp; NEW REQUEST
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <h1 class="hero-title"
                  style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;
                         font-size:34px;font-weight:700;color:#ffffff;
                         line-height:1.15;letter-spacing:-0.8px;">
                New ride near you,<br/>
                <span style="color:#FCD34D;font-style:italic;">${name}.</span>
              </h1>
              <p style="margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,
                        Helvetica,Arial,sans-serif;font-size:14px;color:#D1FAE5;
                        line-height:1.65;font-weight:400;max-width:380px;">
                ${schedLabel
                  ? `Scheduled for <strong style="color:#ffffff;">${esc(schedLabel)}</strong> — open the app to accept.`
                  : `A rider is waiting <strong style="color:#ffffff;">right now</strong> — open the app to accept.`}
              </p>
            </td>
          </tr>

          <!-- ── PAYOUT STAT ── -->
          <tr>
            <td class="body-pad"
                style="padding:28px 28px 12px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background:linear-gradient(135deg,#001a0a 0%,#0d3d1a 100%);
                            border:1px solid #22C55E;border-radius:16px;overflow:hidden;
                            box-shadow:0 8px 24px rgba(22,163,74,0.18);">
                <tr>
                  <td style="padding:22px 22px 18px;">

                    <!-- Top: payout + fare -->
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td valign="top">
                          <p style="margin:0 0 4px;font-family:'SF Mono',Menlo,Consolas,monospace;
                                    font-size:9.5px;font-weight:700;color:#86EFAC;
                                    letter-spacing:1.5px;">YOUR PAYOUT</p>
                          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;
                                    font-size:48px;font-weight:700;color:#ffffff;
                                    line-height:1;letter-spacing:-2px;">
                            $${esc(payoutStr)}
                          </p>
                          <p style="margin:5px 0 0;font-family:-apple-system,BlinkMacSystemFont,
                                    Helvetica,Arial,sans-serif;font-size:11.5px;
                                    color:#86EFAC;font-weight:600;">
                            75% of $${esc(fareStr)} fare &nbsp;&#183;&nbsp; plus 100% of tips
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- Stats row -->
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                           style="margin-top:16px;border-top:1px solid #166534;">
                      <tr>
                        <td class="stat-col" width="33%"
                            style="padding:12px 6px 0;text-align:center;">
                          <p style="margin:0 0 3px;font-family:Georgia,serif;font-size:20px;
                                    font-weight:700;color:#ffffff;line-height:1;
                                    letter-spacing:-0.5px;">${esc(milesStr)}</p>
                          <p style="margin:0;font-family:'SF Mono',Menlo,Consolas,monospace;
                                    font-size:9px;font-weight:700;color:#86EFAC;
                                    letter-spacing:0.8px;">TRIP MILES</p>
                        </td>
                        <td class="stat-col" width="33%"
                            style="padding:12px 6px 0;text-align:center;
                                   border-left:1px solid #166534;
                                   border-right:1px solid #166534;">
                          <p style="margin:0 0 3px;font-family:Georgia,serif;font-size:20px;
                                    font-weight:700;color:#ffffff;line-height:1;
                                    letter-spacing:-0.5px;">~${esc(etaStr)}min</p>
                          <p style="margin:0;font-family:'SF Mono',Menlo,Consolas,monospace;
                                    font-size:9px;font-weight:700;color:#86EFAC;
                                    letter-spacing:0.8px;">YOU TO PICKUP</p>
                        </td>
                        <td class="stat-col" width="33%"
                            style="padding:12px 6px 0;text-align:center;">
                          <p style="margin:0 0 3px;font-family:Georgia,serif;font-size:20px;
                                    font-weight:700;color:#ffffff;line-height:1;
                                    letter-spacing:-0.5px;">75%</p>
                          <p style="margin:0;font-family:'SF Mono',Menlo,Consolas,monospace;
                                    font-size:9px;font-weight:700;color:#86EFAC;
                                    letter-spacing:0.8px;">YOUR CUT</p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── ROUTE ── -->
          <tr>
            <td class="body-pad"
                style="padding:20px 28px 12px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <p style="margin:0 0 14px;font-family:'SF Mono',Menlo,Consolas,monospace;
                        font-size:10.5px;font-weight:700;color:#22C55E;letter-spacing:2px;">
                THE TRIP
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background:linear-gradient(135deg,#0d1f12 0%,#0a0a0a 100%);
                            border:1px solid #166534;border-radius:14px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 22px;">

                    <!-- Pickup -->
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                           style="margin-bottom:10px;">
                      <tr>
                        <td width="32" valign="top" style="padding-top:2px;">
                          <div style="width:24px;height:24px;border-radius:50%;
                                      background-color:#22C55E;text-align:center;
                                      line-height:24px;font-size:11px;font-weight:900;
                                      color:#052e16;font-family:'SF Mono',Menlo,monospace;">A</div>
                        </td>
                        <td valign="top">
                          <p style="margin:0 0 2px;font-family:'SF Mono',Menlo,Consolas,monospace;
                                     font-size:9.5px;font-weight:700;color:#6B7280;
                                     letter-spacing:1.5px;">PICKUP</p>
                          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,
                                     Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;
                                     color:#ffffff;line-height:1.4;">${pickupEsc}</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Connector -->
                    <table cellpadding="0" cellspacing="0" role="presentation"
                           style="margin:0 0 10px 12px;">
                      <tr>
                        <td style="border-left:2px dashed #166534;height:16px;width:1px;"></td>
                      </tr>
                    </table>

                    <!-- Dropoff -->
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td width="32" valign="top" style="padding-top:2px;">
                          <div style="width:24px;height:24px;border-radius:50%;
                                      background-color:#0a0a0a;border:2px solid #818CF8;
                                      text-align:center;line-height:20px;font-size:11px;
                                      font-weight:900;color:#818CF8;
                                      font-family:'SF Mono',Menlo,monospace;">B</div>
                        </td>
                        <td valign="top">
                          <p style="margin:0 0 2px;font-family:'SF Mono',Menlo,Consolas,monospace;
                                     font-size:9.5px;font-weight:700;color:#6B7280;
                                     letter-spacing:1.5px;">DROPOFF</p>
                          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,
                                     Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;
                                     color:#ffffff;line-height:1.4;">${dropoffEsc}</p>
                        </td>
                      </tr>
                    </table>

                    ${schedLabel ? `
                    <!-- Scheduled pill -->
                    <div style="margin-top:14px;display:inline-block;
                                background-color:rgba(129,140,248,0.1);
                                border:1px solid rgba(129,140,248,0.35);
                                border-radius:100px;padding:5px 12px;">
                      <span style="font-family:'SF Mono',Menlo,Consolas,monospace;
                                   font-size:10px;font-weight:700;color:#818CF8;
                                   letter-spacing:1px;">
                        &#128197;&nbsp; SCHEDULED &middot; ${esc(schedLabel)}
                      </span>
                    </div>` : ""}

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── CTA ── -->
          <tr>
            <td class="body-pad"
                style="padding:20px 28px 8px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center">
                    <a href="https://uatob.com/driver/login"
                       style="display:inline-block;
                              background:linear-gradient(135deg,#22C55E,#16A34A);
                              color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,
                              Helvetica,Arial,sans-serif;font-size:15px;font-weight:800;
                              text-decoration:none;padding:17px 34px;border-radius:14px;
                              letter-spacing:0.3px;
                              box-shadow:0 8px 22px rgba(22,163,74,0.4);">
                      Open Driver App &rarr;
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:10px;">
                    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,
                              Helvetica,Arial,sans-serif;font-size:12px;color:#86EFAC;">
                      &#9679; Accept the ride before it expires
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── SUPPORT ── -->
          <tr>
            <td class="body-pad"
                style="padding:20px 28px 28px;background-color:#0a0a0a;" bgcolor="#0a0a0a">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background-color:#111111;border:1px solid #1f1f1f;
                            border-radius:14px;">
                <tr>
                  <td style="padding:16px 18px;">
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
                          <p style="margin:0 0 2px;font-family:-apple-system,BlinkMacSystemFont,
                                    Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;
                                    color:#ffffff;">Questions?</p>
                          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,
                                    Helvetica,Arial,sans-serif;font-size:12px;color:#9CA3AF;
                                    line-height:1.5;">
                            Reply here or write
                            <a href="mailto:support@uatob.com"
                               style="color:#22C55E;text-decoration:none;font-weight:700;">
                              support@uatob.com</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td style="padding:22px 32px 26px;background-color:#000000;
                       border-top:1px solid #1a1a1a;text-align:center;" bgcolor="#000000">
              <table cellpadding="0" cellspacing="0" role="presentation"
                     align="center" style="margin:0 auto 10px;">
                <tr>
                  <td valign="middle" style="padding-right:6px;">
                    <div style="width:18px;height:18px;
                                background:linear-gradient(135deg,#22C55E,#16A34A);
                                border-radius:5px;display:inline-block;text-align:center;
                                line-height:18px;font-size:9px;font-weight:900;
                                color:#ffffff;font-family:Arial,sans-serif;">U</div>
                  </td>
                  <td valign="middle">
                    <span style="font-family:Arial,sans-serif;font-size:12px;font-weight:800;
                                 color:#ffffff;letter-spacing:-0.2px;">UaTob</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,
                        Helvetica,Arial,sans-serif;font-size:11px;color:#6B7280;">
                Orlando, Florida &nbsp;&middot;&nbsp; Built with &#10084; for drivers
              </p>
              <p style="margin:0 0 14px;font-family:-apple-system,BlinkMacSystemFont,
                        Helvetica,Arial,sans-serif;font-size:10.5px;color:#4B5563;">
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
              <p style="margin:12px 0 0;font-family:-apple-system,BlinkMacSystemFont,
                        Helvetica,Arial,sans-serif;font-size:10px;color:#374151;line-height:1.5;">
                You're receiving this because you're an active UaTob driver.
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
    `Hi ${driverFirstName || "Driver"} — new ride request near you!\n\n` +
    `YOUR PAYOUT: $${payoutStr} (75% of $${fareStr} fare + 100% of tips)\n\n` +
    `TRIP:\n` +
    `  Pickup:  ${pickup  || "N/A"}\n` +
    `  Dropoff: ${dropoff || "N/A"}\n` +
    `  Miles:   ${milesStr}mi\n` +
    `  You to pickup: ~${etaStr}min\n` +
    (schedLabel ? `  Scheduled: ${schedLabel}\n` : "") +
    `\nOpen the driver app to accept: https://uatob.com/driver/login\n\n` +
    `Questions? Email support@uatob.com\n\n` +
    `© ${year} UaTob · Orlando, FL`;

  return { html, text };
}

// ── TRIGGER ─────────────────────────────────────────────────────
exports.notifyMatchedDriversByEmail = onDocumentUpdated(
  {
    document: "Rides/{rideId}",
   region: "us-central1",
    secrets:  [SENDGRID_API_KEY],
  },
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();
    const rideId = event.params.rideId;

    // ── 1. Only fire when status becomes "searching_driver" ──────
    if (before.status === after.status)          return null;
    if (after.status !== "searching_driver")     return null;

    // ── 2. Idempotency — only email once per ride ────────────────
    if (after.matchEmailSent === true) {
      console.log(`[matchEmail] ${rideId} — already emailed, skipping.`);
      return null;
    }

    // ── 3. Expiry guard ──────────────────────────────────────────
    const expireMs = after.expireAt?.toMillis?.() ?? null;
    if (expireMs !== null && Date.now() > expireMs) {
      console.log(`[matchEmail] ${rideId} — ride already expired, skipping emails.`);
      return null;
    }

    const match = Array.isArray(after.match) ? after.match : [];
    if (match.length === 0) {
      console.log(`[matchEmail] ${rideId} — empty match array, nothing to email.`);
      return null;
    }

    // ── 4. Init SendGrid ─────────────────────────────────────────
    const sgKey = process.env.SENDGRID_API_KEY;
    if (!sgKey) {
      console.error("[matchEmail] Missing SENDGRID_API_KEY");
      return null;
    }
    sgMail.setApiKey(sgKey);

    const year = new Date().getFullYear();

    // ── 5. Fetch all matched driver docs in parallel ──────────────
    const driverDocs = await Promise.allSettled(
      match.map((m) =>
        db.collection("Drivers").doc(m.uid).get()
          .then((snap) => ({
            uid:    m.uid,
            miles:  m.miles,
            etaMin: m.etaMin,
            data:   snap.exists ? snap.data() : null,
          }))
      )
    );

    // ── 6. Send emails ───────────────────────────────────────────
    const emailed    = [];
    const noEmail    = [];
    const failed     = [];

    await Promise.allSettled(
      driverDocs.map(async (result) => {
        if (result.status !== "fulfilled") return;

        const { uid, miles, etaMin, data } = result.value;

        if (!data) {
          console.warn(`[matchEmail] Driver ${uid} doc not found — skipping.`);
          noEmail.push(uid);
          return;
        }

        const email = typeof data.email === "string" && data.email.trim()
          ? data.email.trim()
          : null;

        if (!email) {
          console.log(`[matchEmail] Driver ${uid} has no email — skipping.`);
          noEmail.push(uid);
          return;
        }

        const { html, text } = buildDriverRideEmail({
          driverFirstName: data.firstName || null,
          pickup:          after.pickup   || null,
          dropoff:         after.dropoff  || null,
          fareTotal:       after.fareTotal,
          driverPayout:    after.driverPayout,
          miles,
          etaMin,
          rideId,
          isScheduled:     after.isScheduled  || false,
          scheduledAt:     after.scheduledAt  || null,
          year,
        });

        try {
          await sgMail.send({
            to:      email,
            from:    "UaTob <noreply@uatob.com>",
            replyTo: "support@uatob.com",
            subject: `🚗 New ride request — $${Number(after.driverPayout || 0).toFixed(2)} payout · UaTob`,
            text,
            html,
          });
          emailed.push(uid);
          console.log(`[matchEmail] ✅ Emailed driver ${uid} (${email})`);
        } catch (err) {
          console.error(
            `[matchEmail] SendGrid error for driver ${uid} (${email}):`,
            err?.message || err
          );
          failed.push(uid);
        }
      })
    );

    console.log(
      `[matchEmail] ${rideId} — ` +
      `emailed: ${emailed.length}, ` +
      `no email: ${noEmail.length}, ` +
      `failed: ${failed.length}`
    );

    // ── 7. Stamp ride — one flag covers the whole batch ──────────
    // matchEmailSent = true prevents any retry from re-emailing
    // matchEmailedUids = which drivers actually got the email
    try {
      await event.data.after.ref.update({
        matchEmailSent:     true,
        matchEmailedUids:   emailed,
        matchEmailSentAt:   admin.firestore.FieldValue.serverTimestamp(),
        updatedAt:          admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.warn(`[matchEmail] Could not stamp matchEmailSent on ${rideId}:`, err);
    }

    return null;
  }
);