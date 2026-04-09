const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore } = require("firebase-admin/firestore");
const sgMail = require("@sendgrid/mail");

const db = getFirestore();

// Escape user-controlled data to prevent HTML injection
const esc = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const fmt = {
  currency: (val) => `$${Number(val ?? 0).toFixed(2)}`,
  miles:    (val) => `${Number(val ?? 0).toFixed(1)} mi`,
  duration: (val) => {
    const total = Math.round(Number(val ?? 0));
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  },
};

const buildDriverEmail = ({ driver, ride, rideId }) => {
  const {
    pickup,
    dropoff,
    rideType,
    driverPayout,
    tripDistanceMiles,
    tripDurationMin,
  } = ride;

  const firstName   = esc(driver.firstName || "Driver");
  const safePickup  = esc(pickup  || "N/A");
  const safeDropoff = esc(dropoff || "N/A");
  const safeType    = esc(rideType ? rideType.charAt(0).toUpperCase() + rideType.slice(1) : "Standard");
  const safeRideId  = esc(rideId);
  const payout      = fmt.currency(driverPayout);
  const distance    = fmt.miles(tripDistanceMiles);
  const duration    = fmt.duration(tripDurationMin);
  const year        = new Date().getFullYear();

  // Earnings-per-mile display
  const epm = tripDistanceMiles > 0
    ? fmt.currency(Number(driverPayout ?? 0) / Number(tripDistanceMiles))
    : null;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>New Ride Available — UaTob</title>
  <style type="text/css">
    body, html {
      -webkit-text-size-adjust: 100% !important;
      -ms-text-size-adjust: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background-color: #0a0a0a !important;
    }
    @media only screen and (max-width: 600px) {
      .outer-pad  { padding: 16px !important; }
      .hero-title { font-size: 30px !important; }
      .stat-val   { font-size: 22px !important; }
      .cta-btn    { font-size: 16px !important; padding: 18px 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;">

<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="background-color:#0a0a0a;padding:40px 20px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:600px;width:100%;">

        <!-- ── HEADER WORDMARK ── -->
        <tr>
          <td align="center" style="padding-bottom:28px;">
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td>
                  <div style="display:inline-flex;align-items:center;gap:8px;">
                    <!-- UaTob icon (U shape in green) -->
                    <div style="width:34px;height:34px;border-radius:8px;
                                background-color:#16A34A;text-align:center;
                                line-height:34px;font-size:18px;font-weight:900;
                                color:#ffffff;font-family:Georgia,serif;">
                      U
                    </div>
                    <span style="font-family:Georgia,serif;font-size:20px;
                                 font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
                      Ua<span style="color:#4ADE80;">Tob</span>
                    </span>
                    <span style="font-family:'Courier New',monospace;font-size:10px;
                                 font-weight:700;color:#4ADE80;background-color:#052e16;
                                 padding:3px 8px;border-radius:100px;letter-spacing:1.5px;
                                 border:1px solid #166534;">
                      DISPATCH
                    </span>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── MAIN CARD ── -->
        <tr>
          <td style="background-color:#111111;border-radius:20px;
                     border:1px solid #1f1f1f;overflow:hidden;">

            <!-- ── HERO BAND ── -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background:linear-gradient(135deg,#052e16 0%,#14532d 50%,#166534 100%);
                           padding:40px 36px 32px;position:relative;">

                  <!-- Live badge -->
                  <div style="display:inline-block;background-color:rgba(74,222,128,0.15);
                              border:1.5px solid #4ADE80;border-radius:100px;
                              padding:5px 14px;margin-bottom:20px;">
                    <span style="font-family:'Courier New',monospace;font-size:10px;
                                 font-weight:700;color:#4ADE80;letter-spacing:2px;">
                      ● LIVE REQUEST
                    </span>
                  </div>

                  <h1 class="hero-title"
                      style="margin:0 0 8px;font-family:Georgia,serif;font-size:36px;
                             font-weight:700;color:#ffffff;line-height:1.15;
                             letter-spacing:-1px;">
                    New Ride<br/>
                    <span style="color:#4ADE80;">Available</span>
                  </h1>
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:13px;
                             color:#86efac;letter-spacing:0.3px;">
                    Hey ${firstName} — a rider needs you nearby
                  </p>

                </td>
              </tr>
            </table>

            <!-- ── PAYOUT HERO STAT ── -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="center"
                    style="padding:32px 36px 24px;
                           border-bottom:1px solid #1f1f1f;">
                  <p style="margin:0 0 6px;font-family:'Courier New',monospace;
                             font-size:11px;font-weight:700;color:#4ADE80;
                             letter-spacing:2.5px;">
                    YOUR PAYOUT
                  </p>
                  <p class="stat-val"
                     style="margin:0;font-family:Georgia,serif;font-size:56px;
                            font-weight:700;color:#ffffff;line-height:1;
                            letter-spacing:-2px;">
                    ${payout}
                  </p>
                  ${epm ? `
                  <p style="margin:8px 0 0;font-family:'Courier New',monospace;
                             font-size:12px;color:#6B7280;letter-spacing:0.5px;">
                    ${epm}/mile · <span style="color:#4ADE80;">80% split</span>
                  </p>` : ""}
                </td>
              </tr>
            </table>

            <!-- ── TRIP STATS ROW ── -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <!-- Distance -->
                <td width="33%" align="center"
                    style="padding:20px 12px;border-right:1px solid #1f1f1f;">
                  <p style="margin:0 0 5px;font-family:'Courier New',monospace;
                             font-size:10px;font-weight:700;color:#4ADE80;
                             letter-spacing:2px;">
                    DISTANCE
                  </p>
                  <p style="margin:0;font-family:Georgia,serif;font-size:22px;
                             font-weight:700;color:#ffffff;">
                    ${distance}
                  </p>
                </td>
                <!-- Duration -->
                <td width="33%" align="center"
                    style="padding:20px 12px;border-right:1px solid #1f1f1f;">
                  <p style="margin:0 0 5px;font-family:'Courier New',monospace;
                             font-size:10px;font-weight:700;color:#4ADE80;
                             letter-spacing:2px;">
                    DURATION
                  </p>
                  <p style="margin:0;font-family:Georgia,serif;font-size:22px;
                             font-weight:700;color:#ffffff;">
                    ${duration}
                  </p>
                </td>
                <!-- Type -->
                <td width="33%" align="center"
                    style="padding:20px 12px;">
                  <p style="margin:0 0 5px;font-family:'Courier New',monospace;
                             font-size:10px;font-weight:700;color:#4ADE80;
                             letter-spacing:2px;">
                    RIDE TYPE
                  </p>
                  <p style="margin:0;font-family:Georgia,serif;font-size:22px;
                             font-weight:700;color:#ffffff;">
                    ${safeType}
                  </p>
                </td>
              </tr>
            </table>

            <!-- ── ROUTE CARD ── -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:28px 36px;border-top:1px solid #1f1f1f;">

                  <p style="margin:0 0 18px;font-family:'Courier New',monospace;
                             font-size:11px;font-weight:700;color:#4ADE80;
                             letter-spacing:2px;">
                    TRIP ROUTE
                  </p>

                  <!-- Pickup row -->
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                         style="margin-bottom:8px;">
                    <tr>
                      <td width="32" valign="top" style="padding-top:3px;">
                        <div style="width:24px;height:24px;border-radius:50%;
                                    background-color:#4ADE80;text-align:center;
                                    line-height:24px;font-size:11px;font-weight:900;
                                    color:#052e16;font-family:'Courier New',monospace;">
                          A
                        </div>
                      </td>
                      <td valign="top">
                        <p style="margin:0 0 2px;font-family:'Courier New',monospace;
                                   font-size:10px;font-weight:700;color:#6B7280;
                                   letter-spacing:1.5px;">
                          PICKUP
                        </p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:15px;
                                   font-weight:700;color:#ffffff;line-height:1.4;">
                          ${safePickup}
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Connector line -->
                  <table cellpadding="0" cellspacing="0" role="presentation"
                         style="margin:0 0 8px 12px;">
                    <tr>
                      <td style="border-left:2px dashed #166534;height:18px;width:1px;"></td>
                    </tr>
                  </table>

                  <!-- Dropoff row -->
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td width="32" valign="top" style="padding-top:3px;">
                        <div style="width:24px;height:24px;border-radius:50%;
                                    background-color:#1f1f1f;border:2px solid #4ADE80;
                                    text-align:center;line-height:20px;font-size:11px;
                                    font-weight:900;color:#4ADE80;
                                    font-family:'Courier New',monospace;">
                          B
                        </div>
                      </td>
                      <td valign="top">
                        <p style="margin:0 0 2px;font-family:'Courier New',monospace;
                                   font-size:10px;font-weight:700;color:#6B7280;
                                   letter-spacing:1.5px;">
                          DROPOFF
                        </p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:15px;
                                   font-weight:700;color:#ffffff;line-height:1.4;">
                          ${safeDropoff}
                        </p>
                      </td>
                    </tr>
                  </table>

                </td>
              </tr>
            </table>

            <!-- ── CTA ── -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:8px 36px 36px;border-top:1px solid #1f1f1f;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                         style="margin-top:24px;">
                    <tr>
                      <td align="center">
                        <a href="https://uatob.com/driver/app"
                           class="cta-btn"
                           style="display:block;background:linear-gradient(135deg,#16A34A,#15803D);
                                  color:#ffffff;font-family:'Courier New',monospace;
                                  font-size:15px;font-weight:700;text-decoration:none;
                                  padding:20px 32px;border-radius:12px;
                                  letter-spacing:1px;text-align:center;
                                  border:1px solid #4ADE80;">
                          OPEN APP TO ACCEPT →
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin:16px 0 0;font-family:'Courier New',monospace;
                             font-size:11px;color:#374151;text-align:center;
                             letter-spacing:0.5px;">
                    Rides are first-come, first-served · Open your app now
                  </p>
                </td>
              </tr>
            </table>

            <!-- ── RIDE ID STRIP ── -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:16px 36px;background-color:#0d0d0d;
                           border-top:1px solid #1f1f1f;">
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;
                             color:#374151;letter-spacing:0.5px;">
                    RIDE ID &nbsp;
                    <span style="color:#4ADE80;">${safeRideId}</span>
                  </p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- ── FOOTER ── -->
        <tr>
          <td align="center" style="padding:28px 20px 0;">
            <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:11px;
                       color:#374151;letter-spacing:0.5px;">
              © ${year} UaTob · Orlando, FL
            </p>
            <p style="margin:0;font-family:'Courier New',monospace;font-size:10px;
                       color:#1f2937;letter-spacing:0.3px;">
              You're receiving this because you're listed as online in UaTob Dispatch.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>
  `.trim();

  const text =
    `New ride available on UaTob, ${driver.firstName || "Driver"}.\n\n` +
    `Payout:   ${payout}\n` +
    `Distance: ${distance}\n` +
    `Duration: ${duration}\n` +
    `Type:     ${rideType || "Standard"}\n` +
    `Pickup:   ${pickup || "N/A"}\n` +
    `Dropoff:  ${dropoff || "N/A"}\n` +
    `Ride ID:  ${rideId}\n\n` +
    `Open the UaTob app to accept this ride: https://uatob.com/driver/app`;

  return {
    to:      driver.email,
    from:    "UaTob Dispatch <noreply@uatob.com>",
    subject: `🚗 New ride · ${payout} payout · ${distance} — Accept now`,
    text,
    html,
  };
};

exports.onRideCreatedNotifyOnlineDrivers = onDocumentCreated(
  {
    document: "Rides/{rideId}",
    region:   "us-central1",
    secrets:  ["SENDGRID_API_KEY"],
  },
  async (event) => {
    try {
      const snap = event.data;
      if (!snap) return null;

      const ride   = snap.data();
      const rideId = event.params.rideId;

      // 🛡️ Prevent duplicate dispatches
      if (ride.driversNotified) {
        console.log(`Drivers already notified for ride ${rideId}, skipping.`);
        return null;
      }

      const sendgridKey = process.env.SENDGRID_API_KEY;
      if (!sendgridKey) {
        console.error("Missing SENDGRID_API_KEY");
        return null;
      }
      sgMail.setApiKey(sendgridKey);

      // 🔥 Get only online drivers
      const driversSnap = await db
        .collection("Drivers")
        .where("status", "==", "online")
        .get();

      if (driversSnap.empty) {
        console.log("No online drivers found.");
        return null;
      }

      console.log(`📡 Found ${driversSnap.size} online driver(s) — dispatching emails`);

      let sent   = 0;
      let failed = 0;

      for (const doc of driversSnap.docs) {
        const driver = doc.data();

        if (!driver.email) {
          console.warn(`⚠️  Driver ${doc.id} has no email — skipped`);
          continue;
        }

        const msg = buildDriverEmail({ driver, ride, rideId });

        try {
          await sgMail.send(msg);
          console.log(`📧 Dispatched → ${driver.email}`);
          sent++;
        } catch (err) {
          console.error(`❌ Failed for ${driver.email}:`, err?.response?.body ?? err.message);
          failed++;
        }
      }

      // Mark as dispatched to prevent re-trigger
      await snap.ref.update({ driversNotified: true });

      console.log(`✅ Dispatch complete — sent: ${sent}, failed: ${failed}`);
      return null;

    } catch (error) {
      console.error("❌ Function failed:", error);
      return null;
    }
  }
); 