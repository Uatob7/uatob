// File: functions/onRidePaymentSucceeded.js

const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { getFirestore }      = require("firebase-admin/firestore");
const sgMail                = require("@sendgrid/mail");

const db = getFirestore();

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Trigger ───────────────────────────────────────────────────────────────────
exports.onRidePaymentSucceeded = onDocumentUpdated(
  {
    document: "Rides/{rideId}",
    region:   "us-central1",
    secrets:  ["SENDGRID_API_KEY"],
  },
  async (event) => {
    try {
      const before = event.data.before.data();
      const after  = event.data.after.data();

      // ── GATE 1: Only fire when paymentStatus just flipped to "succeeded" ──
      const justSucceeded =
        before.paymentStatus !== "succeeded" &&
        after.paymentStatus  === "succeeded";

      if (!justSucceeded) {
        return null; // Not a payment confirmation update — ignore
      }

      // ── GATE 2: Prevent duplicate emails ──────────────────────────────────
      if (after.receiptEmailSent) {
        console.log(`[receiptEmail] Already sent for ride ${event.params.rideId}, skipping.`);
        return null;
      }

      // ── GATE 3: Need a UID ────────────────────────────────────────────────
      if (!after.uid) {
        console.warn(`[receiptEmail] No UID on ride ${event.params.rideId}`);
        return null;
      }

      // ── Fetch rider account ───────────────────────────────────────────────
      const accountSnap = await db.collection("Accounts").doc(after.uid).get();
      if (!accountSnap.exists) {
        console.warn(`[receiptEmail] No account found for uid: ${after.uid}`);
        return null;
      }

      const account = accountSnap.data();
      const email   = account.email;
      const name    = account.name || "there";

      if (!email) {
        console.warn(`[receiptEmail] No email on account uid: ${after.uid}`);
        return null;
      }

      const sendgridKey = process.env.SENDGRID_API_KEY;
      if (!sendgridKey) {
        console.error("[receiptEmail] Missing SENDGRID_API_KEY");
        return null;
      }

      sgMail.setApiKey(sendgridKey);

      // ── Destructure ride fields from `after` ──────────────────────────────
      const {
        pickup,
        dropoff,
        fareTotal,
        fareBreakdown,
        tripDistanceMiles,
        tripDurationMin,
        paymentMethod,
        paymentLast4,
        rideType,
      } = after;

      // ── Sanitised display values ──────────────────────────────────────────
      const safeName     = esc(name);
      const safePickup   = esc(pickup  || "—");
      const safeDropoff  = esc(dropoff || "—");
      const safePayment  = esc(
        paymentLast4
          ? `${paymentMethod} •••• ${paymentLast4}`
          : paymentMethod || "—"
      );
      const safeRideType = esc(
        rideType
          ? rideType.charAt(0).toUpperCase() + rideType.slice(1)
          : "Standard"
      );

      const year = new Date().getFullYear();

      // ── Fare breakdown rows ───────────────────────────────────────────────
      const breakdown = fareBreakdown || {};
      const fareRows  = [
        { label: "Base Fare",     val: breakdown.baseFare     },
        { label: "Distance Fare", val: breakdown.distanceFare },
        { label: "Booking Fee",   val: breakdown.bookingFee   },
        { label: "Tip",           val: breakdown.tip          },
        { label: "Discount",      val: breakdown.discount, negative: true },
      ].filter((r) => r.val != null && r.val !== 0);

      const fareBreakdownHTML = fareRows.length
        ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                  style="margin-top:14px;padding-top:14px;border-top:1px dashed #d1d5db;">
            ${fareRows
              .map(
                (r) => `
              <tr>
                <td style="padding:5px 0;font-size:13px;color:#6B7280;font-family:Arial,sans-serif;">
                  ${esc(r.label)}
                </td>
                <td style="padding:5px 0;font-size:13px;color:#111827;font-weight:600;
                           font-family:Arial,sans-serif;text-align:right;">
                  ${r.negative ? "−" : ""}${fmt.currency(Math.abs(r.val))}
                </td>
              </tr>`
              )
              .join("")}
           </table>`
        : "";

      // ── HTML ──────────────────────────────────────────────────────────────
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
       style="margin:0;padding:40px 0;background-color:#f3f4f6;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:600px;width:100%;background-color:#ffffff;
                    border-radius:24px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- ── HERO ── -->
        <tr>
          <td align="center"
              style="background:linear-gradient(135deg,#15803D 0%,#16A34A 55%,#22C55E 100%);
                     padding:52px 32px 44px;">
            <div style="width:80px;height:80px;background-color:rgba(255,255,255,0.15);
                        border-radius:50%;text-align:center;line-height:80px;
                        font-size:42px;margin:0 auto 24px;">💳</div>
            <h1 class="hero-title"
                style="margin:0 0 12px;font-size:32px;font-weight:900;
                       color:#ffffff;line-height:1.2;letter-spacing:-0.5px;
                       font-family:Arial,sans-serif;">
              Payment Confirmed!
            </h1>
            <p style="margin:0;font-size:16px;color:#ffffff;font-weight:500;
                      font-family:Arial,sans-serif;opacity:0.92;line-height:1.5;">
              Your ride is booked, ${safeName}. A driver is on the way.
            </p>
          </td>
        </tr>

        <!-- ── PAYMENT CONFIRMED BADGE ── -->
        <tr>
          <td style="padding:0 32px;background-color:#ffffff;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                   style="margin-top:-20px;">
              <tr>
                <td align="center">
                  <div style="display:inline-block;background-color:#f0fdf4;
                              border:2px solid #86efac;border-radius:100px;
                              padding:10px 24px;font-size:13px;font-weight:700;
                              color:#15803d;font-family:Arial,sans-serif;
                              letter-spacing:0.5px;">
                    ✅ &nbsp;PAYMENT SUCCEEDED · SEARCHING FOR DRIVER
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
              Hey <strong>${safeName}</strong>! Your payment went through and your ride
              is confirmed. Here's your receipt — keep it for your records.
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
                                font-size:10px;color:#fff;font-family:Arial,sans-serif;">A</div>
                  </td>
                  <td valign="top">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#6B7280;
                               letter-spacing:0.8px;font-family:Arial,sans-serif;">PICKUP</p>
                    <p style="margin:2px 0 0;font-size:14px;color:#111827;
                               font-weight:600;font-family:Arial,sans-serif;">
                      ${safePickup}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Connector -->
              <table cellpadding="0" cellspacing="0" role="presentation"
                     style="margin:0 0 10px 10px;">
                <tr>
                  <td style="border-left:2px dashed #D1D5DB;height:16px;width:1px;"></td>
                </tr>
              </table>

              <!-- Dropoff -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td width="28" valign="top" style="padding-top:2px;">
                    <div style="width:20px;height:20px;background-color:#2563EB;
                                border-radius:50%;text-align:center;line-height:20px;
                                font-size:10px;color:#fff;font-family:Arial,sans-serif;">B</div>
                  </td>
                  <td valign="top">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#6B7280;
                               letter-spacing:0.8px;font-family:Arial,sans-serif;">DROPOFF</p>
                    <p style="margin:2px 0 0;font-size:14px;color:#111827;
                               font-weight:600;font-family:Arial,sans-serif;">
                      ${safeDropoff}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Trip stats -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-top:18px;padding-top:18px;border-top:1px solid #e5e7eb;">
                <tr>
                  <td width="33%" align="center" style="border-right:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#6B7280;
                               letter-spacing:0.8px;font-family:Arial,sans-serif;">DISTANCE</p>
                    <p style="margin:4px 0 0;font-size:18px;font-weight:800;
                               color:#111827;font-family:Arial,sans-serif;">
                      ${fmt.miles(tripDistanceMiles)}
                    </p>
                  </td>
                  <td width="33%" align="center" style="border-right:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#6B7280;
                               letter-spacing:0.8px;font-family:Arial,sans-serif;">EST. TIME</p>
                    <p style="margin:4px 0 0;font-size:18px;font-weight:800;
                               color:#111827;font-family:Arial,sans-serif;">
                      ${fmt.duration(tripDurationMin)}
                    </p>
                  </td>
                  <td width="33%" align="center">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#6B7280;
                               letter-spacing:0.8px;font-family:Arial,sans-serif;">RIDE TYPE</p>
                    <p style="margin:4px 0 0;font-size:18px;font-weight:800;
                               color:#111827;font-family:Arial,sans-serif;">
                      ${safeRideType}
                    </p>
                  </td>
                </tr>
              </table>
            </div>

            <!-- ── FARE SUMMARY ── -->
            <div style="background-color:#f0fdf4;border:2px solid #86efac;
                        border-radius:16px;padding:24px;margin-bottom:24px;">
              <h2 style="margin:0 0 16px;font-size:17px;font-weight:700;
                         color:#111827;font-family:Arial,sans-serif;">
                💳 Payment Summary
              </h2>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="font-size:13.5px;color:#6B7280;font-family:Arial,sans-serif;">
                    Payment Method
                  </td>
                  <td style="font-size:13.5px;color:#111827;font-weight:700;
                             font-family:Arial,sans-serif;text-align:right;">
                    ${safePayment}
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:8px;font-size:13.5px;color:#6B7280;
                             font-family:Arial,sans-serif;">
                    Status
                  </td>
                  <td style="padding-top:8px;font-size:13.5px;font-weight:700;
                             color:#15803d;font-family:Arial,sans-serif;text-align:right;">
                    ✅ Succeeded
                  </td>
                </tr>
              </table>

              ${fareBreakdownHTML}

              <!-- Total -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-top:16px;padding-top:16px;border-top:2px solid #86efac;">
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

            <!-- ── DRIVER SEARCHING NOTICE ── -->
            <div style="background-color:#fffbeb;border:2px solid #fde68a;
                        border-radius:16px;padding:24px;margin-bottom:24px;
                        text-align:center;">
              <div style="font-size:32px;margin-bottom:10px;">🔍</div>
              <h2 style="margin:0 0 8px;font-size:17px;font-weight:700;
                         color:#111827;font-family:Arial,sans-serif;">
                Finding Your Driver
              </h2>
              <p style="margin:0;font-size:13.5px;color:#6B7280;
                        font-family:Arial,sans-serif;line-height:1.6;">
                We're matching you with the nearest available driver.
                You'll get a notification in the app the moment one is confirmed.
              </p>
            </div>

            <!-- ── OPEN APP CTA ── -->
            <div style="text-align:center;margin:32px 0;">
              <a href="https://uatob.com"
                 style="display:inline-block;background-color:#16A34A;
                        color:#ffffff;font-size:16px;font-weight:700;
                        text-decoration:none;padding:16px 40px;
                        border-radius:14px;font-family:Arial,sans-serif;">
                Track Your Ride →
              </a>
              <p style="margin:12px 0 0;font-size:13px;color:#6B7280;
                         font-family:Arial,sans-serif;">
                Open the UaTob app to watch your driver in real time
              </p>
            </div>

            <!-- ── FOOTER NOTE ── -->
            <div style="text-align:center;padding-top:24px;
                        border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:13px;color:#4B5563;
                         line-height:1.7;font-family:Arial,sans-serif;">
                Issue with your payment? Contact us at
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
                        letter-spacing:-0.3px;">UaTob</div>
            <div style="font-size:12px;color:#6B7280;font-family:Arial,sans-serif;
                        margin-bottom:12px;">Orlando's Rideshare Platform</div>
            <div style="font-size:12px;color:#9CA3AF;font-family:Arial,sans-serif;
                        margin-bottom:12px;">© ${year} UaTob. All rights reserved.</div>
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
</html>`;

      // ── Send ──────────────────────────────────────────────────────────────
      const msg = {
        to:      email,
        from:    "UaTob <noreply@uatob.com>",
        replyTo: "support@uatob.com",
        subject: `✅ Payment confirmed — ${fmt.currency(fareTotal)} · UaTob`,
        text:
          `Hey ${name}! Your payment of ${fmt.currency(fareTotal)} went through. ` +
          `We're finding you a driver now. ` +
          `From: ${pickup} → ${dropoff} · ${fmt.miles(tripDistanceMiles)} · ` +
          `${fmt.duration(tripDurationMin)}. ` +
          `Open the app to track your ride: https://uatob.com`,
        html,
      };

      await sgMail.send(msg);

      // ── Mark as sent so this never fires twice ────────────────────────────
      await event.data.after.ref.update({ receiptEmailSent: true });

      console.log(`📧 [receiptEmail] Sent to ${email} for ride ${event.params.rideId} ✅`);
      return null;

    } catch (error) {
      console.error("❌ [receiptEmail] Error:", error);
      if (error.response) console.error(error.response.body);
      return null;
    }
  }
);
