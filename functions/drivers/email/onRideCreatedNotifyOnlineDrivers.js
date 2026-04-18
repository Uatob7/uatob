const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore }      = require("firebase-admin/firestore");
const sgMail                = require("@sendgrid/mail");

const db = getFirestore();

/* ─── HELPERS ──────────────────────────────────────────────── */
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

/* ─── EMAIL BUILDER ─────────────────────────────────────────── */
const buildDriverEmail = ({ driver, ride, rideId }) => {
  const {
    pickup,
    dropoff,
    rideType,
    driverPayout,
    tripDistanceMiles,
    tripDurationMin,
  } = ride;

  const firstName  = esc(driver.firstName || "Driver");
  const safePickup = esc(pickup  || "N/A");
  const safeDropoff= esc(dropoff || "N/A");
  const safeType   = esc(rideType
    ? rideType.charAt(0).toUpperCase() + rideType.slice(1)
    : "Standard");
  const safeRideId = esc(rideId);
  const payout     = fmt.currency(driverPayout);
  const distance   = fmt.miles(tripDistanceMiles);
  const duration   = fmt.duration(tripDurationMin);
  const year       = new Date().getFullYear();

  const epm = tripDistanceMiles > 0
    ? fmt.currency(Number(driverPayout ?? 0) / Number(tripDistanceMiles))
    : null;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>New Ride Available — UaTob</title>
  <style type="text/css">
    body, table, td, p, a, h1, h2 {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    body { margin:0; padding:0; background-color:#0C0F0C; }
    @media only screen and (max-width: 600px) {
      .outer-pad  { padding: 16px !important; }
      .hero-pad   { padding: 36px 20px 28px !important; }
      .body-pad   { padding: 0 !important; }
      .payout-num { font-size: 48px !important; }
      .stat-val   { font-size: 20px !important; }
      .cta-btn    { font-size: 13px !important; padding: 16px 20px !important; }
      .route-pad  { padding: 24px 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0C0F0C;">

<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="background-color:#0C0F0C;">
  <tr>
    <td class="outer-pad" align="center" style="padding:32px 16px;">

      <!-- ── WORDMARK ── -->
      <table cellpadding="0" cellspacing="0" role="presentation"
             style="margin-bottom:28px;">
        <tr>
          <td align="center">
            <span style="font-family:Arial,sans-serif;font-size:22px;
                         font-weight:300;color:#ffffff;letter-spacing:-0.3px;">Ua</span>
            <span style="font-family:Arial,sans-serif;font-size:14px;
                         color:#22C55E;margin:0 3px;vertical-align:middle;">&#8594;</span>
            <span style="font-family:Arial,sans-serif;font-size:22px;
                         font-weight:800;color:#22C55E;letter-spacing:-0.3px;">Tob</span>
            &nbsp;
            <span style="font-family:Arial,sans-serif;font-size:9px;font-weight:700;
                         color:#22C55E;background:rgba(34,197,94,0.08);
                         border:1px solid rgba(34,197,94,0.25);
                         padding:3px 9px;border-radius:100px;
                         letter-spacing:0.18em;text-transform:uppercase;
                         vertical-align:middle;">Dispatch</span>
          </td>
        </tr>
      </table>

      <!-- ── WRAPPER ── -->
      <table width="600" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;
                    border:1px solid rgba(34,197,94,0.15);background-color:#111411;">

        <!-- ══ HERO ══ -->
        <tr>
          <td class="hero-pad" align="center"
              style="padding:44px 32px 36px;
                     background:linear-gradient(160deg,#0a1a0d 0%,#0f2914 45%,#0a1a0d 100%);
                     border-bottom:1px solid rgba(34,197,94,0.12);">

            <!-- Live badge -->
            <table cellpadding="0" cellspacing="0" role="presentation"
                   style="margin:0 auto 22px;">
              <tr>
                <td align="center"
                    style="background:rgba(34,197,94,0.08);
                           border:1px solid rgba(34,197,94,0.3);
                           border-radius:100px;padding:7px 16px;">
                  <span style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;
                               color:#22C55E;letter-spacing:0.2em;text-transform:uppercase;">
                    &#9679;&nbsp; Live Request
                  </span>
                </td>
              </tr>
            </table>

            <!-- Headline -->
            <h1 style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:34px;
                       font-weight:900;color:#ffffff;line-height:1.05;
                       letter-spacing:-0.5px;">
              New Ride<br/>
              <span style="color:#22C55E;">Available</span>
            </h1>
            <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;
                      color:rgba(255,255,255,0.45);line-height:1.6;">
              Hey ${firstName} — a rider near you needs a driver
            </p>

          </td>
        </tr>

        <!-- ══ PAYOUT HERO ══ -->
        <tr>
          <td align="center"
              style="padding:32px 32px 28px;
                     border-bottom:1px solid rgba(34,197,94,0.1);
                     background:rgba(34,197,94,0.02);">
            <div style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;
                        color:#22C55E;letter-spacing:0.25em;text-transform:uppercase;
                        margin-bottom:10px;">
              Your Payout
            </div>
            <div class="payout-num"
                 style="font-family:Arial,sans-serif;font-size:60px;font-weight:900;
                        color:#ffffff;line-height:1;letter-spacing:-2px;margin-bottom:10px;">
              ${payout}
            </div>
            <table cellpadding="0" cellspacing="0" role="presentation"
                   style="margin:0 auto;">
              <tr>
                <td style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);
                           border-radius:100px;padding:5px 14px;">
                  <span style="font-family:Arial,sans-serif;font-size:11px;
                               color:rgba(34,197,94,0.8);letter-spacing:0.08em;">
                    80% split${epm ? ` &nbsp;·&nbsp; ${epm}/mi` : ""}
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
                <td width="33%" align="center"
                    style="padding:22px 10px;border-right:1px solid rgba(34,197,94,0.1);">
                  <div style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;
                              color:#22C55E;letter-spacing:0.18em;text-transform:uppercase;
                              margin-bottom:7px;">Distance</div>
                  <div class="stat-val"
                       style="font-family:Arial,sans-serif;font-size:22px;font-weight:800;
                              color:#ffffff;letter-spacing:-0.5px;">${distance}</div>
                </td>
                <td width="33%" align="center"
                    style="padding:22px 10px;border-right:1px solid rgba(34,197,94,0.1);">
                  <div style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;
                              color:#22C55E;letter-spacing:0.18em;text-transform:uppercase;
                              margin-bottom:7px;">Duration</div>
                  <div class="stat-val"
                       style="font-family:Arial,sans-serif;font-size:22px;font-weight:800;
                              color:#ffffff;letter-spacing:-0.5px;">${duration}</div>
                </td>
                <td width="33%" align="center"
                    style="padding:22px 10px;">
                  <div style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;
                              color:#22C55E;letter-spacing:0.18em;text-transform:uppercase;
                              margin-bottom:7px;">Ride Type</div>
                  <div class="stat-val"
                       style="font-family:Arial,sans-serif;font-size:22px;font-weight:800;
                              color:#ffffff;letter-spacing:-0.5px;">${safeType}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ══ ROUTE ══ -->
        <tr>
          <td class="route-pad" style="padding:28px 32px;
                     border-bottom:1px solid rgba(34,197,94,0.1);">

            <div style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;
                        color:#22C55E;letter-spacing:0.22em;text-transform:uppercase;
                        margin-bottom:18px;">
              <span style="display:inline-block;width:18px;height:1px;
                           background:#22C55E;vertical-align:middle;
                           margin-right:8px;"></span>Trip Route
            </div>

            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">

              <!-- Pickup -->
              <tr>
                <td width="30" valign="top" style="padding-top:2px;">
                  <div style="width:26px;height:26px;border-radius:6px;
                              background:#22C55E;text-align:center;line-height:26px;
                              font-family:Arial,sans-serif;font-size:11px;
                              font-weight:900;color:#000;">A</div>
                </td>
                <td valign="top" style="padding-left:12px;">
                  <div style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;
                              color:rgba(255,255,255,0.3);letter-spacing:0.14em;
                              text-transform:uppercase;margin-bottom:4px;">Pickup</div>
                  <div style="font-family:Arial,sans-serif;font-size:14px;font-weight:700;
                              color:#ffffff;line-height:1.4;">${safePickup}</div>
                </td>
              </tr>

              <!-- Connector -->
              <tr>
                <td valign="top" style="padding:4px 0 4px 12px;">
                  <div style="width:2px;height:20px;
                              background:linear-gradient(to bottom,#22C55E,rgba(34,197,94,0.2));
                              border-radius:1px;margin-left:1px;"></div>
                </td>
                <td></td>
              </tr>

              <!-- Dropoff -->
              <tr>
                <td width="30" valign="top" style="padding-top:2px;">
                  <div style="width:26px;height:26px;border-radius:6px;
                              background:rgba(34,197,94,0.08);
                              border:1.5px solid #22C55E;
                              text-align:center;line-height:23px;
                              font-family:Arial,sans-serif;font-size:11px;
                              font-weight:900;color:#22C55E;">B</div>
                </td>
                <td valign="top" style="padding-left:12px;">
                  <div style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;
                              color:rgba(255,255,255,0.3);letter-spacing:0.14em;
                              text-transform:uppercase;margin-bottom:4px;">Dropoff</div>
                  <div style="font-family:Arial,sans-serif;font-size:14px;font-weight:700;
                              color:#ffffff;line-height:1.4;">${safeDropoff}</div>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- ══ CTA ══ -->
        <tr>
          <td style="padding:28px 32px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="center">
                  <a href="https://uatob.com/driver/app"
                     class="cta-btn"
                     style="display:block;
                            background:linear-gradient(90deg,#16A34A,#22C55E);
                            color:#000000;font-family:Arial,sans-serif;
                            font-size:14px;font-weight:800;text-decoration:none;
                            padding:18px 32px;border-radius:8px;
                            letter-spacing:0.06em;text-transform:uppercase;
                            text-align:center;">
                    Open App to Accept &nbsp;&#8594;
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:14px 0 0;font-family:Arial,sans-serif;font-size:11px;
                      color:rgba(255,255,255,0.2);text-align:center;letter-spacing:0.05em;">
              Rides are first-come, first-served &nbsp;·&nbsp; Open your app now
            </p>
          </td>
        </tr>

        <!-- ══ RIDE ID STRIP ══ -->
        <tr>
          <td style="padding:13px 32px;background-color:#0a0d0a;
                     border-top:1px solid rgba(34,197,94,0.08);">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td>
                  <span style="font-family:Arial,sans-serif;font-size:10px;
                               color:rgba(255,255,255,0.2);letter-spacing:0.1em;
                               text-transform:uppercase;">Ride ID &nbsp;</span>
                  <span style="font-family:Arial,sans-serif;font-size:10px;
                               color:rgba(34,197,94,0.6);letter-spacing:0.06em;">
                    ${safeRideId}
                  </span>
                </td>
                <td align="right">
                  <span style="font-family:Arial,sans-serif;font-size:10px;
                               color:rgba(255,255,255,0.15);letter-spacing:0.06em;">
                    UaTob Dispatch
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>

      <!-- ══ FOOTER ══ -->
      <table width="600" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:600px;width:100%;margin-top:20px;">
        <tr>
          <td align="center" style="padding:0 16px;">
            <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:11px;
                      color:rgba(255,255,255,0.15);letter-spacing:0.05em;">
              &#169; ${year} UaTob &nbsp;·&nbsp; Orlando, FL
            </p>
            <p style="margin:0;font-family:Arial,sans-serif;font-size:10px;
                      color:rgba(255,255,255,0.1);line-height:1.7;">
              You're receiving this because you're listed as online in UaTob.<br/>
              <a href="https://uatob.com/driver/settings"
                 style="color:rgba(34,197,94,0.4);text-decoration:none;">
                Manage notification preferences
              </a>
            </p>
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>

</body>
</html>`;

  const text =
    `New ride available — UaTob Dispatch\n\n` +
    `Payout:   ${payout}${epm ? ` (${epm}/mi)` : ""}\n` +
    `Distance: ${distance}\n` +
    `Duration: ${duration}\n` +
    `Type:     ${rideType || "Standard"}\n` +
    `Pickup:   ${pickup   || "N/A"}\n` +
    `Dropoff:  ${dropoff  || "N/A"}\n` +
    `Ride ID:  ${rideId}\n\n` +
    `Open the app to accept: https://uatob.com/driver/app\n` +
    `Rides are first-come, first-served.`;

  return {
    to:      driver.email,
    from:    "UaTob Dispatch <noreply@uatob.com>",
    replyTo: "support@uatob.com",
    subject: `New ride — ${payout} · ${distance} · Accept now`,
    text,
    html,
  };
};

/* ─── CLOUD FUNCTION ────────────────────────────────────────── */
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

      // Guard: prevent duplicate dispatches
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

      // Fetch only online drivers
      const driversSnap = await db
        .collection("Drivers")
        .where("status", "==", "online")
        .get();

      if (driversSnap.empty) {
        console.log("No online drivers found.");
        await snap.ref.update({ driversNotified: true });
        return null;
      }

      console.log(`📡 Found ${driversSnap.size} online driver(s) — dispatching`);

      let sent   = 0;
      let failed = 0;

      for (const doc of driversSnap.docs) {
        const driver = doc.data();

        if (!driver.email) {
          console.warn(`⚠️  Driver ${doc.id} missing email — skipped`);
          continue;
        }

        const msg = buildDriverEmail({ driver, ride, rideId });

        try {
          await sgMail.send(msg);
          console.log(`📧 Dispatched → ${driver.email}`);
          sent++;
        } catch (err) {
          console.error(
            `❌ Failed for ${driver.email}:`,
            err?.response?.body ?? err.message
          );
          failed++;
        }
      }

      // Mark dispatched to prevent re-trigger
      await snap.ref.update({ driversNotified: true });

      console.log(`✅ Dispatch complete — sent: ${sent}, failed: ${failed}`);
      return null;

    } catch (error) {
      console.error("❌ Function failed:", error);
      return null;
    }
  }
);
