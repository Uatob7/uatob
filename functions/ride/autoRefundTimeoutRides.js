// functions/rides/autoRefundTimeoutRides.js
// Runs every 7 minutes.
// Finds rides: status=="timeout", timedOutAt >= 30min ago, not yet processed.
// card/cashapp → Stripe refund → cancelled
// cash         → cancelled, no refund
// Sends apology email to rider via SendGrid.

const { onSchedule }   = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin            = require("firebase-admin");
const Stripe           = require("stripe");
const sgMail           = require("@sendgrid/mail");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const SENDGRID_API_KEY  = defineSecret("SENDGRID_API_KEY");

// ── CONFIG ──────────────────────────────────────────────────────
const TIMEOUT_GRACE_MINUTES = 30;
const BATCH_LIMIT           = 25;

const REFUND_DESTINATIONS = {
  card:    "your card",
  cashapp: "your Cash App",
};

// ── SVG ASSETS ──────────────────────────────────────────────────
const UATOB_ICON_SVG = `
<svg width="46" height="46" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="eribg"   x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F3F4F6"/>
    </linearGradient>
    <linearGradient id="eriroad" x1="0" y1="0" x2="64" y2="0"  gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#111827"/>
      <stop offset="100%" stop-color="#16A34A"/>
    </linearGradient>
    <linearGradient id="ericar"  x1="0" y1="0" x2="1"  y2="1">
      <stop offset="0%"   stop-color="#16A34A"/>
      <stop offset="100%" stop-color="#15803D"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#eribg)"/>
  <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" stroke="#E5E7EB" stroke-width="1"/>
  <path d="M 10 42 Q 32 24 54 42" stroke="url(#eriroad)" stroke-width="2.5"
        stroke-dasharray="5 4" stroke-linecap="round" fill="none" opacity="0.6"/>
  <circle cx="10" cy="42" r="6"   fill="#111827" opacity="0.12"/>
  <circle cx="10" cy="42" r="3.5" fill="#111827"/>
  <text x="10" y="45.5" text-anchor="middle" font-family="Arial,sans-serif"
        font-weight="800" font-size="4.5" fill="#fff">A</text>
  <circle cx="54" cy="42" r="6"   fill="#16A34A" opacity="0.18"/>
  <circle cx="54" cy="42" r="3.5" fill="#16A34A"/>
  <text x="54" y="45.5" text-anchor="middle" font-family="Arial,sans-serif"
        font-weight="800" font-size="4.5" fill="#fff">B</text>
  <g transform="translate(26,26)">
    <ellipse cx="6" cy="12" rx="8" ry="2" fill="#111827" opacity="0.1"/>
    <rect x="1" y="5" width="10" height="6" rx="1.5" fill="url(#ericar)"/>
    <path d="M3 5 L3.8 2 L8.2 2 L9 5Z" fill="#15803D"/>
    <rect x="3.5" y="2.5" width="2.3" height="2" rx="0.5" fill="#fff" fill-opacity="0.85"/>
    <rect x="6.2" y="2.5" width="2.3" height="2" rx="0.5" fill="#fff" fill-opacity="0.85"/>
    <circle cx="3" cy="11" r="1.8" fill="#111827"/>
    <circle cx="3" cy="11" r="0.9" fill="#16A34A"/>
    <circle cx="9" cy="11" r="1.8" fill="#111827"/>
    <circle cx="9" cy="11" r="0.9" fill="#22C55E"/>
    <rect x="10.5" y="6.5" width="1.5" height="1" rx="0.5" fill="#FCD34D"/>
  </g>
</svg>`.trim();

const ARROW_SVG = `
<svg width="20" height="20" viewBox="0 0 24 24" fill="none"
     xmlns="http://www.w3.org/2000/svg"
     style="display:inline-block;vertical-align:middle;margin:0 3px;">
  <path d="M5 12h14M13 6l6 6-6 6"
        stroke="#16A34A" stroke-width="2.2"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>`.trim();

// ── EMAIL BUILDER ───────────────────────────────────────────────
function buildApologyEmail({ account, ride, wasRefunded, refundAmount, paymentMethod }) {
  const esc = (s) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const firstName      = esc((account.name || "").split(" ")[0] || "there");
  const pickup         = esc(ride.pickup  || "your pickup");
  const dropoff        = esc(ride.dropoff || "your destination");
  const refundDest     = REFUND_DESTINATIONS[paymentMethod] || "your account";
  const refundTimeline = paymentMethod === "cashapp"
    ? "Funds typically arrive in Cash App within a few minutes."
    : "Funds typically appear in 2\u20133 business days, depending on your bank.";
  const year = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>We couldn't find you a driver — UaTob</title>
  <style type="text/css">
    body, html {
      -webkit-text-size-adjust: 100% !important;
      -ms-text-size-adjust: 100% !important;
      margin: 0 !important; padding: 0 !important;
      background-color: #0a0a0a !important;
    }
    @media only screen and (max-width: 600px) {
      .hero-title { font-size: 28px !important; }
      .cta-btn    { font-size: 14px !important; padding: 16px 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;">

<!-- Preheader -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#0a0a0a;">
  ${wasRefunded
    ? `We couldn't find a driver — $${refundAmount} has been refunded to ${refundDest}.`
    : `We couldn't find a driver — you were not charged.`}
</div>

<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="background-color:#0a0a0a;padding:40px 20px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:600px;width:100%;">

        <!-- WORDMARK -->
        <tr>
          <td align="center" style="padding-bottom:28px;">
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td valign="middle" style="padding-right:10px;">${UATOB_ICON_SVG}</td>
                <td valign="middle">
                  <span style="font-family:Georgia,serif;font-style:italic;font-weight:300;
                               font-size:28px;color:#ffffff;letter-spacing:-0.5px;">Ua</span><!--
               -->${ARROW_SVG}<!--
               --><span style="font-family:Arial,sans-serif;font-weight:800;font-size:28px;
                               color:#4ADE80;letter-spacing:-0.5px;">Tob</span>
                </td>
                <td valign="middle" style="padding-left:10px;">
                  <span style="font-family:'Courier New',monospace;font-size:9px;font-weight:700;
                               color:#FCD34D;background-color:#451a03;padding:4px 9px;
                               border-radius:100px;letter-spacing:1.5px;border:1px solid #92400e;
                               display:inline-block;">
                    NO DRIVER
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- MAIN CARD -->
        <tr>
          <td style="background-color:#111111;border-radius:20px;
                     border:1px solid #1f1f1f;overflow:hidden;">

            <!-- HERO -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background:linear-gradient(135deg,#451a03 0%,#78350f 50%,#92400e 100%);
                           padding:40px 36px 32px;">
                  <div style="display:inline-block;background-color:rgba(252,211,77,0.15);
                              border:1.5px solid #FCD34D;border-radius:100px;
                              padding:5px 14px;margin-bottom:20px;">
                    <span style="font-family:'Courier New',monospace;font-size:10px;
                                 font-weight:700;color:#FCD34D;letter-spacing:2px;">
                      &#9679;&nbsp; RIDE TIMED OUT
                    </span>
                  </div>
                  <h1 class="hero-title"
                      style="margin:0 0 8px;font-family:Georgia,serif;font-size:36px;
                             font-weight:700;color:#ffffff;line-height:1.15;letter-spacing:-1px;">
                    Sorry, ${firstName} &mdash;<br/>
                    <span style="color:#FCD34D;">no driver found.</span>
                  </h1>
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:13px;
                             color:#fde68a;letter-spacing:0.3px;">
                    ${wasRefunded
                      ? `Your $${refundAmount} has been refunded to ${refundDest}.`
                      : `You were not charged for this ride.`}
                  </p>
                </td>
              </tr>
            </table>

            <!-- REFUND BLOCK -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="center"
                    style="padding:32px 36px 24px;border-bottom:1px solid #1f1f1f;">
                  ${wasRefunded ? `
                  <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:11px;
                             font-weight:700;color:#4ADE80;letter-spacing:2.5px;">
                    REFUND PROCESSED
                  </p>
                  <p style="margin:0;font-family:Georgia,serif;font-size:48px;font-weight:700;
                             color:#ffffff;line-height:1;letter-spacing:-2px;">
                    $${esc(String(refundAmount))}
                  </p>
                  <p style="margin:8px 0 0;font-family:'Courier New',monospace;font-size:12px;
                             color:#6B7280;letter-spacing:0.5px;">
                    Back to ${esc(refundDest)} &nbsp;&#183;&nbsp;
                    <span style="color:#4ADE80;">&#10003; Confirmed</span>
                  </p>
                  <p style="margin:10px 0 0;font-family:Georgia,serif;font-size:13px;
                             color:#6B7280;line-height:1.6;">
                    ${esc(refundTimeline)}
                  </p>` : `
                  <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:11px;
                             font-weight:700;color:#4ADE80;letter-spacing:2.5px;">
                    NO CHARGE
                  </p>
                  <p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:700;
                             color:#ffffff;line-height:1.3;">
                    You were not charged<br/>for this ride.
                  </p>`}
                </td>
              </tr>
            </table>

            <!-- ROUTE -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:28px 36px;border-bottom:1px solid #1f1f1f;">
                  <p style="margin:0 0 16px;font-family:'Courier New',monospace;font-size:11px;
                             font-weight:700;color:#FCD34D;letter-spacing:2px;">
                    TRIP THAT TIMED OUT
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                         style="margin-bottom:8px;">
                    <tr>
                      <td width="32" valign="top" style="padding-top:3px;">
                        <div style="width:24px;height:24px;border-radius:50%;
                                    background-color:#4ADE80;text-align:center;line-height:24px;
                                    font-size:11px;font-weight:900;color:#052e16;
                                    font-family:'Courier New',monospace;">A</div>
                      </td>
                      <td valign="top">
                        <p style="margin:0 0 2px;font-family:'Courier New',monospace;font-size:10px;
                                   font-weight:700;color:#6B7280;letter-spacing:1.5px;">PICKUP</p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:15px;
                                   font-weight:700;color:#ffffff;line-height:1.4;">${pickup}</p>
                      </td>
                    </tr>
                  </table>
                  <table cellpadding="0" cellspacing="0" role="presentation"
                         style="margin:0 0 8px 12px;">
                    <tr>
                      <td style="border-left:2px dashed #374151;height:18px;width:1px;"></td>
                    </tr>
                  </table>
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td width="32" valign="top" style="padding-top:3px;">
                        <div style="width:24px;height:24px;border-radius:50%;
                                    background-color:#1f1f1f;border:2px solid #FCD34D;
                                    text-align:center;line-height:20px;font-size:11px;
                                    font-weight:900;color:#FCD34D;
                                    font-family:'Courier New',monospace;">B</div>
                      </td>
                      <td valign="top">
                        <p style="margin:0 0 2px;font-family:'Courier New',monospace;font-size:10px;
                                   font-weight:700;color:#6B7280;letter-spacing:1.5px;">DROPOFF</p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:15px;
                                   font-weight:700;color:#ffffff;line-height:1.4;">${dropoff}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- EXPLANATION -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="center"
                    style="padding:14px 36px;background-color:#0d0d0d;
                           border-top:1px solid #1f1f1f;">
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;
                             color:#6B7280;letter-spacing:0.5px;">
                    No nearby drivers accepted before the search window closed &nbsp;&#183;&nbsp;
                    <span style="color:#FCD34D;">we&apos;re growing our fleet</span>
                  </p>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:8px 36px 36px;border-top:1px solid #1f1f1f;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                         style="margin-top:24px;">
                    <tr>
                      <td align="center">
                        <a href="https://uatob.com" class="cta-btn"
                           style="display:block;background-color:#16A34A;color:#ffffff;
                                  font-family:'Courier New',monospace;font-size:15px;
                                  font-weight:700;text-decoration:none;padding:20px 32px;
                                  border-radius:12px;letter-spacing:1px;text-align:center;
                                  border:1px solid #4ADE80;">
                          TRY AGAIN AT UATOB.COM &#8594;
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:16px 0 0;font-family:'Courier New',monospace;font-size:11px;
                             color:#374151;text-align:center;letter-spacing:0.5px;">
                    Questions? Reply to this email — we read every message.
                  </p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td align="center" style="padding:28px 20px 0;">
            <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:11px;
                       color:#374151;letter-spacing:0.5px;">
              &#169; ${year} UaTob &nbsp;&#183;&nbsp; Orlando, FL
            </p>
            <p style="margin:0 0 10px;font-family:'Courier New',monospace;font-size:10px;
                       color:#1f2937;letter-spacing:0.3px;">
              You&apos;re receiving this because you have a UaTob rider account.
            </p>
            <p style="margin:0;">
              <a href="https://uatob.com/privacy"
                 style="color:#374151;text-decoration:none;font-size:10px;margin:0 8px;
                        font-family:'Courier New',monospace;">Privacy</a>
              <a href="https://uatob.com/terms"
                 style="color:#374151;text-decoration:none;font-size:10px;margin:0 8px;
                        font-family:'Courier New',monospace;">Terms</a>
              <a href="https://uatob.com/unsubscribe"
                 style="color:#374151;text-decoration:none;font-size:10px;margin:0 8px;
                        font-family:'Courier New',monospace;">Unsubscribe</a>
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
    `Hi ${(account.name || "").split(" ")[0] || "there"} — we couldn't find you a driver.\n\n` +
    `Your ride from ${ride.pickup || "your pickup"} to ${ride.dropoff || "your destination"} ` +
    `timed out. None of our nearby drivers accepted before the search window closed.\n\n` +
    (wasRefunded
      ? `REFUND PROCESSED: $${refundAmount} has been refunded to ${refundDest}.\n${refundTimeline}\n\n`
      : `You were not charged for this ride.\n\n`) +
    `We're actively growing our Orlando driver fleet so this happens less often.\n\n` +
    `Try again: https://uatob.com\n\n` +
    `Questions? Just reply to this email.\n\n` +
    `© ${year} UaTob · Orlando, FL`;

  const subject = wasRefunded
    ? `We couldn't find a driver — $${refundAmount} refunded · UaTob`
    : `We couldn't find a driver — no charge · UaTob`;

  return {
    to:      account.email,
    from:    "UaTob <support@uatob.com>",
    replyTo: "support@uatob.com",
    subject,
    text,
    html,
  };
}

// ── PER-RIDE PROCESSOR ──────────────────────────────────────────
async function processRide(rideDoc, stripe) {
  const ride          = { id: rideDoc.id, ...rideDoc.data() };
  const rideId        = ride.id;
  const paymentMethod = ride.paymentMethod || "card";

  console.log(
    `[autoRefund] Processing ${rideId} ` +
    `(uid: ${ride.uid}, payment: ${paymentMethod})`
  );

  let refundId     = null;
  let refundStatus = "skipped";
  let refundAmount = Number(ride.fareBreakdown?.fareTotal ?? 0).toFixed(2);
  let wasRefunded  = false;

  // ── 1. Refund ──────────────────────────────────────────────
  if (paymentMethod === "cash") {
    refundStatus = "cash_no_refund";
    console.log(`[autoRefund] Cash ride ${rideId} — no refund needed.`);

  } else if (ride.paymentIntentId && ride.paymentStatus === "succeeded") {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: ride.paymentIntentId,
        reason:         "requested_by_customer",
        metadata:       { rideId, autoRefund: "true", paymentMethod },
      });
      refundId     = refund.id;
      refundStatus = refund.status;
      wasRefunded  = true;
      console.log(
        `[autoRefund] ✓ Refund ${refundId} for ${rideId} | ` +
        `$${refundAmount} | ${paymentMethod}`
      );
    } catch (err) {
      if (err?.raw?.code === "charge_already_refunded") {
        refundStatus = "already_refunded";
        wasRefunded  = true;
        console.warn(`[autoRefund] Already refunded: ${rideId}`);
      } else {
        console.error(`[autoRefund] Stripe error on ${rideId}:`, err?.message || err);
        return false;
      }
    }
  } else {
    refundStatus = "no_payment";
    console.log(`[autoRefund] ${rideId} had no successful payment to refund.`);
  }

  // ── 2. Update ride doc ─────────────────────────────────────
  try {
    await db.collection("Rides").doc(rideId).update({
      status:                "cancelled",
      paymentStatus:         wasRefunded ? "refunded" : ride.paymentStatus,
      refundId,
      autoRefundStatus:      refundStatus,
      autoRefundProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
      cancelReason:          "timeout_auto_cancel",
      cancelledAt:           admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:             admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error(`[autoRefund] Failed to update ride ${rideId}:`, err);
    return false;
  }

  // ── 3. Fetch rider account ─────────────────────────────────
  let account = null;
  try {
    const acctSnap = await db.collection("Accounts").doc(ride.uid).get();
    if (acctSnap.exists) account = acctSnap.data();
  } catch (err) {
    console.error(`[autoRefund] Failed to load Account ${ride.uid}:`, err);
  }

  if (!account?.email) {
    console.warn(
      `[autoRefund] No email for rider ${ride.uid} on ride ${rideId} — skipping email.`
    );
    return true;
  }

  // ── 4. Send apology email ──────────────────────────────────
  try {
    const msg = buildApologyEmail({ account, ride, wasRefunded, refundAmount, paymentMethod });
    await sgMail.send(msg);
    console.log(`[autoRefund] ✓ Email sent to ${account.email} for ride ${rideId}`);

    await db.collection("Rides").doc(rideId).update({
      apologyEmailSent:   true,
      apologyEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error(`[autoRefund] SendGrid error for ride ${rideId}:`, err?.message || err);
  }

  return true;
}

// ── SCHEDULED FUNCTION ──────────────────────────────────────────
exports.autoRefundTimeoutRides = onSchedule(
  {
    schedule: "every 7 minutes",
   region: "us-central1",
    timeZone: "America/New_York",
    secrets:  [STRIPE_SECRET_KEY, SENDGRID_API_KEY],
  },
  async () => {
    const cutoffMs   = Date.now() - TIMEOUT_GRACE_MINUTES * 60 * 1000;
    const cutoffDate = new Date(cutoffMs);

    let snap;
    try {
      snap = await db
        .collection("Rides")
        .where("status",     "==", "timeout")
        .where("timedOutAt", "<=", cutoffDate)
        .limit(BATCH_LIMIT)
        .get();
    } catch (err) {
      console.error("[autoRefund] Query failed:", err?.message || err);
      return;
    }

    if (snap.empty) return;

    // Idempotency — skip anything already processed
    const eligible = snap.docs.filter((d) => !d.data().autoRefundProcessedAt);
    if (eligible.length === 0) return;

    console.log(
      `[autoRefund] ${eligible.length} timed-out ride(s) eligible ` +
      `(≥${TIMEOUT_GRACE_MINUTES}min old)`
    );

    const stripeKey = STRIPE_SECRET_KEY.value();
    if (!stripeKey) {
      console.error("[autoRefund] STRIPE_SECRET_KEY not configured.");
      return;
    }

    const stripe = new Stripe(stripeKey);
    sgMail.setApiKey(SENDGRID_API_KEY.value());

    const results = await Promise.allSettled(
      eligible.map((doc) => processRide(doc, stripe))
    );

    const succeeded = results.filter(
      (r) => r.status === "fulfilled" && r.value === true
    ).length;

    console.log(
      `[autoRefund] Batch complete | ${succeeded} processed, ` +
      `${results.length - succeeded} failed`
    );
  }
);