const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore }      = require("firebase-admin/firestore");
const sgMail                = require("@sendgrid/mail");

const db = getFirestore();

// Escape user-controlled data to prevent HTML injection
const esc = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const fmt = {
  currency : (val) => `$${Number(val ?? 0).toFixed(2)}`,
  miles    : (val) => `${Number(val ?? 0).toFixed(1)} mi`,
  duration : (val) => {
    const total = Math.round(Number(val ?? 0));
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  },
};

exports.onRidesCreated = onDocumentCreated(
  {
    document: "Rides/{rideId}",
    region:   "us-central1",
    secrets:  ["SENDGRID_API_KEY"],
  },
  async (event) => {
    try {
      const snap = event.data;
      if (!snap) return null;

      const ride = snap.data();
      const {
        uid,
        pickup,
        dropoff,
        fareTotal,
        fareBreakdown,   // { baseFare, distanceFare, bookingFee, tip, discount }
        tripDistanceMiles,
        tripDurationMin,
        paymentMethod,
        paymentLast4,    // last 4 digits of card if applicable
        status,
        rideType,        // e.g. "standard", "xl", "premium"
        driverName,
        vehicleMake,
        vehicleModel,
        vehiclePlate,
        rating,          // rider's rating of the driver, if already set
      } = ride || {};

      if (!uid) {
        console.log("No UID on ride, skipping email.");
        return null;
      }

      // 🧠 Prevent duplicate emails
      if (ride.emailSent) {
        console.log("Ride receipt email already sent, skipping.");
        return null;
      }

      // 🔍 Fetch account
      const accountSnap = await db.collection("Accounts").doc(uid).get();
      if (!accountSnap.exists) {
        console.log("No account found for UID:", uid);
        return null;
      }

      const account  = accountSnap.data();
      const email    = account.email;
      const name     = account.name || "there";

      if (!email) {
        console.log("No email on account, skipping.");
        return null;
      }

      const sendgridKey = process.env.SENDGRID_API_KEY;
      if (!sendgridKey) {
        console.error("Missing SENDGRID_API_KEY");
        return null;
      }

      sgMail.setApiKey(sendgridKey);

      // ── Sanitised display values ──────────────────────────────────────────
      const safeName     = esc(name);
      const safePickup   = esc(pickup  || "—");
      const safeDropoff  = esc(dropoff || "—");
      const safePayment  = esc(
        paymentLast4
          ? `${paymentMethod} •••• ${paymentLast4}`
          : paymentMethod || "—"
      );
      const safeDriver   = esc(driverName || "Your Driver");
      const safeVehicle  = esc(
        vehicleMake && vehicleModel
          ? `${vehicleMake} ${vehicleModel}${vehiclePlate ? ` · ${vehiclePlate}` : ""}`
          : "—"
      );
      const safeRideType = esc(
        rideType ? rideType.charAt(0).toUpperCase() + rideType.slice(1) : "Standard"
      );

      const statusColor = status === "completed" ? "#16A34A"
                        : status === "cancelled"  ? "#DC2626"
                        : "#D97706";
      const statusLabel = esc(
        status ? status.charAt(0).toUpperCase() + status.slice(1) : "—"
      );

      const year = new Date().getFullYear();

      // ── Fare breakdown rows (only shown if fareBreakdown exists) ──────────
      const breakdown = fareBreakdown || {};
      const fareRows = [
        { label: "Base Fare",     val: breakdown.baseFare     },
        { label: "Distance Fare", val: breakdown.distanceFare },
        { label: "Booking Fee",   val: breakdown.bookingFee   },
        { label: "Tip",           val: breakdown.tip          },
        { label: "Discount",      val: breakdown.discount, negative: true },
      ].filter(r => r.val != null && r.val !== 0);

      const fareBreakdownHTML = fareRows.length ? `
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="margin-top:14px;padding-top:14px;
                      border-top:1px dashed #d1d5db;">
          ${fareRows.map(r => `
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#6B7280;
                       font-family:Arial,sans-serif;">${esc(r.label)}</td>
            <td style="padding:5px 0;font-size:13px;color:#111827;font-weight:600;
                       font-family:Arial,sans-serif;text-align:right;">
              ${r.negative ? "−" : ""}${fmt.currency(Math.abs(r.val))}
            </td>
          </tr>`).join("")}
        </table>
      ` : "";

      // ── Star rating display ───────────────────────────────────────────────
      const starsHTML = rating ? (() => {
        const r = Math.round(Number(rating));
        return Array.from({ length: 5 }, (_, i) =>
          `<span style="color:${i < r ? "#FBBF24" : "#D1D5DB"};font-size:20px;">★</span>`
        ).join("");
      })() : null;

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Your UaTob Ride Receipt</title>
  <style type="text/css">
    body, html, div, span, p, a, table, tr, td, h1, h2, h3, h4, h5, h6 {
      -webkit-text-size-adjust: 100% !important;
      -ms-text-size-adjust: 100% !important;
    }
    body {
      margin: 0 !important; padding: 0 !important;
      width: 100% !important; min-width: 100% !important;
      background-color: #ffffff !important; color: #000000 !important;
    }
    @media (prefers-color-scheme: dark) {
      body, html { background-color: #ffffff !important; }
      * { background-color: inherit !important; color: #000000 !important; }
    }
    @media only screen and (max-width: 600px) {
      .hero-title  { font-size: 26px !important; }
      .content-pad { padding: 24px 16px !important; }
    }
  </style>
</head>
<body style="margin:0!important;padding:0!important;background-color:#ffffff!important;">

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="margin:0;padding:40px 0;background-color:#ffffff;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:600px;width:100%;background-color:#ffffff;
                      border-radius:24px;overflow:hidden;">

          <!-- ── HERO ── -->
          <tr>
            <td align="center"
                style="background:linear-gradient(135deg,#15803D 0%,#16A34A 55%,#22C55E 100%);
                       padding:52px 32px 44px;">
              <table cellpadding="0" cellspacing="0" role="presentation"
                     style="margin:0 auto 24px;">
                <tr>
                  <td align="center">
                    <div style="width:80px;height:80px;
                                background-color:rgba(255,255,255,0.15);
                                border-radius:50%;text-align:center;
                                line-height:80px;font-size:42px;">🧾</div>
                  </td>
                </tr>
              </table>
              <h1 class="hero-title"
                  style="margin:0 0 12px;font-size:32px;font-weight:900;
                         color:#ffffff;line-height:1.2;letter-spacing:-0.5px;
                         font-family:Arial,sans-serif;">
                Ride Receipt
              </h1>
              <p style="margin:0;font-size:16px;color:#ffffff;font-weight:500;
                        font-family:Arial,sans-serif;opacity:0.92;line-height:1.5;">
                Thanks for riding with UaTob, ${safeName}.
              </p>
            </td>
          </tr>

          <!-- ── STATUS BADGE ── -->
          <tr>
            <td style="padding:0 32px;background-color:#ffffff;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-top:-20px;">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;
                                background-color:#f0fdf4;border:2px solid #86efac;
                                border-radius:100px;padding:10px 24px;
                                font-size:13px;font-weight:700;
                                color:${statusColor};font-family:Arial,sans-serif;
                                letter-spacing:0.5px;">
                      ● &nbsp;RIDE ${statusLabel.toUpperCase()}
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
                Hey <strong>${safeName}</strong>! Here's your receipt for your recent
                UaTob ride. Keep this for your records.
              </p>

              <!-- ── ROUTE ── -->
              <div style="background-color:#f9fafb;border:1px solid #e5e7eb;
                          border-radius:16px;padding:24px;margin-bottom:24px;">
                <h2 style="margin:0 0 18px;font-size:17px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  🗺️ Your Trip
                </h2>

                <!-- Pickup -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                       style="margin-bottom:10px;">
                  <tr>
                    <td width="28" valign="top" style="padding-top:2px;">
                      <div style="width:20px;height:20px;background-color:#22C55E;
                                  border-radius:50%;text-align:center;line-height:20px;
                                  font-size:10px;color:#fff;font-family:Arial,sans-serif;">
                        A
                      </div>
                    </td>
                    <td valign="top">
                      <p style="margin:0;font-size:11px;font-weight:700;
                                 color:#6B7280;letter-spacing:0.8px;
                                 font-family:Arial,sans-serif;">PICKUP</p>
                      <p style="margin:2px 0 0;font-size:14px;color:#111827;
                                 font-weight:600;font-family:Arial,sans-serif;">
                        ${safePickup}
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Dashed connector -->
                <table cellpadding="0" cellspacing="0" role="presentation"
                       style="margin:0 0 10px 10px;">
                  <tr>
                    <td style="border-left:2px dashed #D1D5DB;height:16px;
                               width:1px;"></td>
                  </tr>
                </table>

                <!-- Dropoff -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td width="28" valign="top" style="padding-top:2px;">
                      <div style="width:20px;height:20px;background-color:#2563EB;
                                  border-radius:50%;text-align:center;line-height:20px;
                                  font-size:10px;color:#fff;font-family:Arial,sans-serif;">
                        B
                      </div>
                    </td>
                    <td valign="top">
                      <p style="margin:0;font-size:11px;font-weight:700;
                                 color:#6B7280;letter-spacing:0.8px;
                                 font-family:Arial,sans-serif;">DROPOFF</p>
                      <p style="margin:2px 0 0;font-size:14px;color:#111827;
                                 font-weight:600;font-family:Arial,sans-serif;">
                        ${safeDropoff}
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Trip stats -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                       style="margin-top:18px;padding-top:18px;
                              border-top:1px solid #e5e7eb;">
                  <tr>
                    <td width="33%" align="center"
                        style="border-right:1px solid #e5e7eb;">
                      <p style="margin:0;font-size:11px;font-weight:700;color:#6B7280;
                                 letter-spacing:0.8px;font-family:Arial,sans-serif;">
                        DISTANCE
                      </p>
                      <p style="margin:4px 0 0;font-size:18px;font-weight:800;
                                 color:#111827;font-family:Arial,sans-serif;">
                        ${fmt.miles(tripDistanceMiles)}
                      </p>
                    </td>
                    <td width="33%" align="center"
                        style="border-right:1px solid #e5e7eb;">
                      <p style="margin:0;font-size:11px;font-weight:700;color:#6B7280;
                                 letter-spacing:0.8px;font-family:Arial,sans-serif;">
                        DURATION
                      </p>
                      <p style="margin:4px 0 0;font-size:18px;font-weight:800;
                                 color:#111827;font-family:Arial,sans-serif;">
                        ${fmt.duration(tripDurationMin)}
                      </p>
                    </td>
                    <td width="33%" align="center">
                      <p style="margin:0;font-size:11px;font-weight:700;color:#6B7280;
                                 letter-spacing:0.8px;font-family:Arial,sans-serif;">
                        RIDE TYPE
                      </p>
                      <p style="margin:4px 0 0;font-size:18px;font-weight:800;
                                 color:#111827;font-family:Arial,sans-serif;">
                        ${safeRideType}
                      </p>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- ── FARE ── -->
              <div style="background-color:#f0fdf4;border:2px solid #86efac;
                          border-radius:16px;padding:24px;margin-bottom:24px;">
                <h2 style="margin:0 0 16px;font-size:17px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  💳 Payment
                </h2>

                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td style="font-size:13.5px;color:#6B7280;
                               font-family:Arial,sans-serif;">
                      Payment Method
                    </td>
                    <td style="font-size:13.5px;color:#111827;font-weight:700;
                               font-family:Arial,sans-serif;text-align:right;">
                      ${safePayment}
                    </td>
                  </tr>
                </table>

                ${fareBreakdownHTML}

                <!-- Total -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                       style="margin-top:16px;padding-top:16px;
                              border-top:2px solid #86efac;">
                  <tr>
                    <td style="font-size:16px;font-weight:800;color:#111827;
                               font-family:Arial,sans-serif;">
                      Total Charged
                    </td>
                    <td style="font-size:24px;font-weight:900;color:#15803D;
                               font-family:Arial,sans-serif;text-align:right;">
                      ${fmt.currency(fareTotal)}
                    </td>
                  </tr>
                </table>
              </div>

              <!-- ── DRIVER INFO ── -->
              <div style="background-color:#eff6ff;border:2px solid #93c5fd;
                          border-radius:16px;padding:24px;margin-bottom:24px;">
                <h2 style="margin:0 0 16px;font-size:17px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  🧑‍✈️ Your Driver
                </h2>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid #bfdbfe;
                               font-size:13.5px;color:#6B7280;
                               font-family:Arial,sans-serif;width:45%;">
                      Driver
                    </td>
                    <td style="padding:8px 0;border-bottom:1px solid #bfdbfe;
                               font-size:13.5px;color:#111827;font-weight:700;
                               font-family:Arial,sans-serif;text-align:right;">
                      ${safeDriver}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-size:13.5px;color:#6B7280;
                               font-family:Arial,sans-serif;">
                      Vehicle
                    </td>
                    <td style="padding:8px 0;font-size:13.5px;color:#111827;font-weight:700;
                               font-family:Arial,sans-serif;text-align:right;">
                      ${safeVehicle}
                    </td>
                  </tr>
                  ${starsHTML ? `
                  <tr>
                    <td style="padding:8px 0;font-size:13.5px;color:#6B7280;
                               font-family:Arial,sans-serif;border-top:1px solid #bfdbfe;">
                      Your Rating
                    </td>
                    <td style="padding:8px 0;text-align:right;
                               border-top:1px solid #bfdbfe;">
                      ${starsHTML}
                    </td>
                  </tr>
                  ` : `
                  <tr>
                    <td colspan="2" style="padding-top:16px;text-align:center;">
                      <a href="https://uatob.com/rate"
                         style="display:inline-block;background-color:#2563EB;
                                color:#ffffff;font-size:13px;font-weight:700;
                                text-decoration:none;padding:10px 24px;
                                border-radius:10px;font-family:Arial,sans-serif;">
                        ⭐ Rate Your Driver
                      </a>
                    </td>
                  </tr>
                  `}
                </table>
              </div>

              <!-- ── CTA ── -->
              <div style="text-align:center;margin:32px 0;">
                <a href="https://uatob.com"
                   style="display:inline-block;background-color:#16A34A;
                          color:#ffffff;font-size:16px;font-weight:700;
                          text-decoration:none;padding:16px 40px;
                          border-radius:14px;font-family:Arial,sans-serif;">
                  Request Another Ride →
                </a>
                <p style="margin:12px 0 0;font-size:13px;color:#6B7280;
                           font-family:Arial,sans-serif;">
                  Available now across Orlando
                </p>
              </div>

              <!-- ── FOOTER NOTE ── -->
              <div style="text-align:center;padding-top:24px;
                          border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:13px;color:#4B5563;
                           line-height:1.7;font-family:Arial,sans-serif;">
                  Issue with your ride? Contact us at
                  <a href="https://uatob.com/help"
                     style="color:#16A34A;text-decoration:none;font-weight:600;">
                    uatob.com/help
                  </a>
                  or reply to this email.
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
              <div style="font-size:12px;color:#6B7280;font-family:Arial,sans-serif;
                          margin-bottom:12px;">
                Orlando's Rideshare Platform
              </div>
              <div style="font-size:12px;color:#9CA3AF;font-family:Arial,sans-serif;
                          margin-bottom:12px;">
                © ${year} UaTob. All rights reserved.
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
        replyTo: "support@uatob.com",
        subject: `🧾 Your UaTob receipt — ${fmt.currency(fareTotal)}`,
        text: `Hey ${name}! Thanks for riding with UaTob. ` +
              `From ${pickup} to ${dropoff} · ${fmt.miles(tripDistanceMiles)} · ` +
              `${fmt.duration(tripDurationMin)} · Total: ${fmt.currency(fareTotal)}. ` +
              `Questions? Visit https://uatob.com/help`,
        html,
      };

      await sgMail.send(msg);

      await snap.ref.update({ emailSent: true });

      console.log(`📧 Ride receipt sent to ${email} (uid: ${uid}) ✅`);
      return null;

    } catch (error) {
      console.error("❌ Error sending ride receipt email:", error);
      if (error.response) console.error(error.response.body);
      return null;
    }
  }
);
