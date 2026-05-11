// autoRefundTimeoutRides.js
// Scheduled Cloud Function — runs every minute.
// Finds rides that:
//   - Are in status "timeout"
//   - Have been timed out for ≥30 minutes
//   - Have NOT been auto-processed yet (autoRefundProcessedAt is null)
//
// For each such ride:
//   1. If paymentMethod is "card" or "cashapp"  → issue Stripe refund
//   2. If paymentMethod is "cash"               → mark cancelled (nothing to refund)
//   3. Update ride status to "cancelled" with audit fields
//   4. Email the rider: we couldn't find a driver, refund processed
//   5. Stamp the ride with autoRefundProcessedAt so we never re-process it
//
// Required Firestore index (composite):
//   Collection: Rides
//   Fields: status (ASC), timedOutAt (ASC)

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");
const sgMail = require("@sendgrid/mail");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const SENDGRID_API_KEY  = defineSecret("SENDGRID_API_KEY");

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────
const TIMEOUT_GRACE_MINUTES = 30;
const BATCH_LIMIT           = 25;

// Payment-method copy mapping
const REFUND_DESTINATIONS = {
  card:    "your card",
  cashapp: "your Cash App",
};

// ─────────────────────────────────────────────────────────────
// Brand SVG
// ─────────────────────────────────────────────────────────────
const UATOB_ICON_SVG = `
<svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="arbg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F3F4F6"/>
    </linearGradient>
    <linearGradient id="arroad" x1="0" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#16A34A"/>
    </linearGradient>
    <linearGradient id="arcar" x1="0" y1="1" x2="1" y2="1">
      <stop offset="0%" stop-color="#16A34A"/>
      <stop offset="100%" stop-color="#15803D"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#arbg)"/>
  <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" stroke="#E5E7EB" stroke-width="1"/>
  <path d="M 10 42 Q 32 24 54 42" stroke="url(#arroad)" stroke-width="2.5"
        stroke-dasharray="5 4" stroke-linecap="round" fill="none" opacity="0.6"/>
  <circle cx="10" cy="42" r="6" fill="#111827" opacity="0.12"/>
  <circle cx="10" cy="42" r="3.5" fill="#111827"/>
  <text x="10" y="45.5" text-anchor="middle" font-family="Arial,sans-serif"
        font-weight="800" font-size="4.5" fill="#fff">A</text>
  <circle cx="54" cy="42" r="6" fill="#16A34A" opacity="0.18"/>
  <circle cx="54" cy="42" r="3.5" fill="#16A34A"/>
  <text x="54" y="45.5" text-anchor="middle" font-family="Arial,sans-serif"
        font-weight="800" font-size="4.5" fill="#fff">B</text>
  <g transform="translate(26,26)">
    <ellipse cx="6" cy="12" rx="8" ry="2" fill="#111827" opacity="0.1"/>
    <rect x="1" y="5" width="10" height="6" rx="1.5" fill="url(#arcar)"/>
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

// ─────────────────────────────────────────────────────────────
// Email builder — clean, factual
// ─────────────────────────────────────────────────────────────
function buildApologyEmail({ account, ride, wasRefunded, refundAmount, paymentMethod }) {
  const safe = (s) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const firstName       = safe((account.name || "").split(" ")[0] || "there");
  const pickup          = safe(ride.pickup  || "your pickup");
  const dropoff         = safe(ride.dropoff || "your destination");
  const refundDest      = REFUND_DESTINATIONS[paymentMethod] || "your account";
  const refundTimeline  = paymentMethod === "cashapp"
    ? "Funds typically arrive in Cash App within a few minutes."
    : "Funds typically appear in 2\u20133 business days, depending on your bank.";
  const year            = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>We couldn't find you a driver — UaTob</title>
  <style type="text/css">
    body, html {
      -webkit-text-size-adjust: 100% !important;
      margin: 0 !important; padding: 0 !important;
      background-color: #FAFAF9 !important;
    }
    @media only screen and (max-width: 600px) {
      .hero-title { font-size: 24px !important; }
      .cta-btn    { font-size: 14px !important; padding: 16px 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#FAFAF9;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="background-color:#FAFAF9;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" role="presentation"
           style="max-width:600px;width:100%;">

      <!-- BRAND ICON -->
      <tr>
        <td align="center" style="padding-bottom:20px;">
          ${UATOB_ICON_SVG}
        </td>
      </tr>

      <!-- MAIN CARD -->
      <tr>
        <td style="background-color:#FFFFFF;border-radius:20px;
                   border:1px solid #E5E7EB;overflow:hidden;
                   box-shadow:0 1px 3px rgba(0,0,0,.04), 0 4px 16px rgba(0,0,0,.06);">

          <!-- HEADER -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:40px 36px 28px;">
              <p style="margin:0 0 10px;font-family:'Courier New',monospace;font-size:11px;
                        font-weight:700;color:#9CA3AF;letter-spacing:2px;text-transform:uppercase;">
                Ride update
              </p>
              <h1 class="hero-title"
                  style="margin:0;font-family:Georgia,serif;font-size:30px;
                         font-weight:700;color:#0F172A;line-height:1.25;letter-spacing:-0.5px;">
                Hi ${firstName} &mdash; we couldn&apos;t<br/>
                find you a driver.
              </h1>
            </td>
          </tr></table>

          <!-- ROUTE RECAP -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:0 36px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background-color:#FAFAFA;border:1px solid #E5E7EB;
                            border-radius:12px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <table cellpadding="0" cellspacing="0" role="presentation"><tr>
                      <td valign="top" style="padding-right:14px;width:14px;">
                        <table cellpadding="0" cellspacing="0" role="presentation"><tr>
                          <td style="padding-bottom:4px;line-height:0;">
                            <div style="width:8px;height:8px;border-radius:50%;
                                        background-color:#16A34A;"></div>
                          </td>
                        </tr><tr>
                          <td style="padding-bottom:4px;line-height:0;">
                            <div style="width:2px;height:22px;background-color:#E5E7EB;
                                        margin-left:3px;"></div>
                          </td>
                        </tr><tr>
                          <td style="line-height:0;">
                            <div style="width:8px;height:8px;border-radius:2px;
                                        background-color:#0F172A;transform:rotate(45deg);"></div>
                          </td>
                        </tr></table>
                      </td>
                      <td valign="top">
                        <p style="margin:0 0 2px;font-family:'Courier New',monospace;font-size:10px;
                                  font-weight:700;color:#9CA3AF;letter-spacing:1.2px;
                                  text-transform:uppercase;">
                          From
                        </p>
                        <p style="margin:0 0 14px;font-family:Georgia,serif;font-size:14px;
                                  color:#0F172A;font-weight:600;line-height:1.45;">
                          ${pickup}
                        </p>
                        <p style="margin:0 0 2px;font-family:'Courier New',monospace;font-size:10px;
                                  font-weight:700;color:#9CA3AF;letter-spacing:1.2px;
                                  text-transform:uppercase;">
                          To
                        </p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:14px;
                                  color:#0F172A;font-weight:600;line-height:1.45;">
                          ${dropoff}
                        </p>
                      </td>
                    </tr></table>
                  </td>
                </tr>
              </table>
            </td>
          </tr></table>

          ${wasRefunded ? `
          <!-- REFUND BLOCK -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:0 36px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background:linear-gradient(135deg,#F0FDF4 0%,#DCFCE7 100%);
                            border:1.5px solid #86EFAC;border-radius:14px;">
                <tr>
                  <td style="padding:22px;">
                    <table cellpadding="0" cellspacing="0" role="presentation" width="100%"><tr>
                      <td valign="middle" style="width:44px;padding-right:14px;">
                        <div style="width:40px;height:40px;border-radius:50%;
                                    background-color:#16A34A;color:#fff;text-align:center;
                                    line-height:40px;font-family:Arial,sans-serif;
                                    font-size:20px;font-weight:700;">&#10003;</div>
                      </td>
                      <td valign="middle">
                        <p style="margin:0 0 3px;font-family:'Courier New',monospace;font-size:10px;
                                  font-weight:700;color:#15803D;letter-spacing:1.4px;
                                  text-transform:uppercase;">
                          Refund processed
                        </p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:20px;
                                  color:#14532D;font-weight:700;line-height:1.3;">
                          $${refundAmount} back to ${refundDest}
                        </p>
                      </td>
                    </tr></table>
                    <p style="margin:14px 0 0;font-family:Georgia,serif;font-size:13.5px;
                              color:#14532D;line-height:1.6;">
                      ${refundTimeline}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr></table>
          ` : `
          <!-- NO-CHARGE BLOCK -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:0 36px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background-color:#F9FAFB;border:1.5px solid #E5E7EB;border-radius:14px;">
                <tr>
                  <td style="padding:20px 22px;">
                    <p style="margin:0 0 3px;font-family:'Courier New',monospace;font-size:10px;
                              font-weight:700;color:#6B7280;letter-spacing:1.4px;
                              text-transform:uppercase;">
                      No charge
                    </p>
                    <p style="margin:0;font-family:Georgia,serif;font-size:16px;
                              color:#0F172A;font-weight:600;line-height:1.5;">
                      You weren&apos;t charged for this ride.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr></table>
          `}

          <!-- WHAT HAPPENED -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:8px 36px 8px;">
              <p style="margin:0;font-family:Georgia,serif;font-size:15px;
                        color:#374151;line-height:1.7;">
                None of our nearby drivers were available to accept your ride
                before the search window closed. We&apos;re actively growing our
                Orlando driver fleet so this happens less often.
              </p>
            </td>
          </tr></table>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:24px 36px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
                <td align="center">
                  <a href="https://uatob.com" class="cta-btn"
                     style="display:block;background-color:#16A34A;color:#FFFFFF;
                            font-family:'Courier New',monospace;font-size:14px;font-weight:700;
                            text-decoration:none;padding:18px 28px;border-radius:12px;
                            letter-spacing:1px;text-align:center;">
                    TRY AGAIN AT UATOB.COM &rarr;
                  </a>
                </td>
              </tr></table>
            </td>
          </tr></table>

          <!-- FOOTER STRIP -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding:18px 36px;background-color:#FAFAF9;
                       border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-family:Georgia,serif;font-size:13px;
                        color:#6B7280;line-height:1.6;">
                Questions? Just reply to this email &mdash; we read every message.
              </p>
            </td>
          </tr></table>

        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td align="center" style="padding:20px 20px 0;">
          <p style="margin:0;font-family:'Courier New',monospace;font-size:10px;
                    color:#9CA3AF;letter-spacing:0.3px;">
            &copy; ${year} UaTob &nbsp;&middot;&nbsp; Orlando, FL
            &nbsp;&middot;&nbsp; support@uatob.com
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`.trim();

  const text =
    `Hi ${firstName} — we couldn't find you a driver.\n\n` +
    `Your ride from ${pickup} to ${dropoff} couldn't be matched. ` +
    `None of our nearby drivers were available to accept it before the search window closed.\n\n` +
    (wasRefunded
      ? `REFUND PROCESSED: $${refundAmount} has been refunded back to ${refundDest}. ` +
        `${refundTimeline}\n\n`
      : `You weren't charged for this ride.\n\n`) +
    `We're actively growing our Orlando driver fleet so this happens less often.\n\n` +
    `Try again: https://uatob.com\n\n` +
    `Questions? Just reply to this email.\n\n` +
    `— The UaTob Team`;

  const subject = wasRefunded
    ? `Your UaTob ride couldn't be matched — $${refundAmount} refunded`
    : `Your UaTob ride couldn't be matched`;

  return {
    to:      account.email,
    from:    "UaTob Team <support@uatob.com>",
    replyTo: "support@uatob.com",
    subject,
    text,
    html,
  };
}

// ─────────────────────────────────────────────────────────────
// Per-ride processor — refund + status update + email
// Returns true on success, false on failure.
// ─────────────────────────────────────────────────────────────
async function processRide(rideDoc, stripe) {
  const ride   = { id: rideDoc.id, ...rideDoc.data() };
  const rideId = ride.id;
  const paymentMethod = ride.paymentMethod || "card";

  console.log(`[autoRefund] Processing ride ${rideId} (uid: ${ride.uid}, payment: ${paymentMethod})`);

  let refundId      = null;
  let refundStatus  = "skipped";
  let refundAmount  = Number(ride.fareBreakdown?.fareTotal ?? 0).toFixed(2);
  let wasRefunded   = false;

  // ── 1. Refund logic ────────────────────────────────────────
  if (paymentMethod === "cash") {
    // Cash rides: rider never paid us anything to refund
    refundStatus = "cash_no_refund";
    console.log(`[autoRefund] Cash ride ${rideId} — no refund needed.`);

  } else if (ride.paymentIntentId && ride.paymentStatus === "succeeded") {
    // Card or Cash App: both go through Stripe payment intents.
    // Stripe routes the refund automatically based on the payment method.
    //   - card    → refund posts back to the rider's card
    //   - cashapp → refund posts back to the rider's Cash App balance
    try {
      const refund = await stripe.refunds.create({
        payment_intent: ride.paymentIntentId,
        reason:         "requested_by_customer",
        metadata: {
          rideId,
          autoRefund:    "true",
          paymentMethod,
        },
      });
      refundId     = refund.id;
      refundStatus = refund.status;
      wasRefunded  = true;
      console.log(
        `[autoRefund] ✓ Refund ${refundId} for ride ${rideId} ` +
        `| $${refundAmount} | ${paymentMethod}`
      );
    } catch (err) {
      if (err?.raw?.code === "charge_already_refunded") {
        refundStatus = "already_refunded";
        wasRefunded  = true;
        console.warn(`[autoRefund] Already refunded: ${rideId}`);
      } else {
        console.error(`[autoRefund] Stripe error on ride ${rideId}:`, err?.message || err);
        // Don't stamp processed → next run retries
        return false;
      }
    }
  } else {
    // No payment intent, or payment never succeeded — nothing to refund
    refundStatus = "no_payment";
    console.log(`[autoRefund] Ride ${rideId} had no successful payment to refund.`);
  }

  // ── 2. Update ride doc ────────────────────────────────────
  try {
    await db.collection("Rides").doc(rideId).update({
      status:                  "cancelled",
      paymentStatus:           wasRefunded ? "refunded" : ride.paymentStatus,
      refundId:                refundId,
      autoRefundStatus:        refundStatus,
      autoRefundProcessedAt:   admin.firestore.FieldValue.serverTimestamp(),
      cancelReason:            "timeout_auto_cancel",
      cancelledAt:             admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:               admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error(`[autoRefund] Failed to update ride ${rideId}:`, err);
    return false;
  }

  // ── 3. Look up rider account for email ──────────────────
  let account = null;
  try {
    const acctSnap = await db.collection("Accounts").doc(ride.uid).get();
    if (acctSnap.exists) account = acctSnap.data();
  } catch (err) {
    console.error(`[autoRefund] Failed to load Account ${ride.uid}:`, err);
  }

  if (!account?.email) {
    console.warn(`[autoRefund] No email for rider ${ride.uid} on ride ${rideId} — skipping email.`);
    return true; // refund still succeeded
  }

  // ── 4. Send email ─────────────────────────────────────────
  try {
    const msg = buildApologyEmail({
      account,
      ride,
      wasRefunded,
      refundAmount,
      paymentMethod,
    });
    await sgMail.send(msg);
    console.log(`[autoRefund] ✓ Email sent to ${account.email} for ride ${rideId}`);

    await db.collection("Rides").doc(rideId).update({
      apologyEmailSent:   true,
      apologyEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error(`[autoRefund] SendGrid error for ride ${rideId}:`, err?.message || err);
    // Refund still succeeded; email failure is non-fatal
  }

  return true;
}

// ─────────────────────────────────────────────────────────────
// Scheduled Cloud Function — runs every minute.
// ─────────────────────────────────────────────────────────────
exports.autoRefundTimeoutRides = onSchedule(
  {
    schedule: "every 1 minutes",
    region:   "us-east1",
    secrets:  [STRIPE_SECRET_KEY, SENDGRID_API_KEY],
    timeZone: "America/New_York",
  },
  async () => {

    // ── 1. Cutoff time ────────────────────────────────────
    const cutoffMs   = Date.now() - TIMEOUT_GRACE_MINUTES * 60 * 1000;
    const cutoffDate = new Date(cutoffMs);

    // ── 2. Query eligible rides ──────────────────────────
    let snap;
    try {
      snap = await db
        .collection("Rides")
        .where("status", "==", "timeout")
        .where("timedOutAt", "<=", cutoffDate)
        .limit(BATCH_LIMIT)
        .get();
    } catch (err) {
      // Likely missing index — Firestore returns a console link in the error
      console.error("[autoRefund] Query failed:", err?.message || err);
      return;
    }

    if (snap.empty) return;

    // Defensive filter — skip already-processed rides
    const eligible = snap.docs.filter((d) => !d.data().autoRefundProcessedAt);
    if (eligible.length === 0) return;

    console.log(
      `[autoRefund] Found ${eligible.length} timed-out ride(s) ` +
      `eligible for refund (≥${TIMEOUT_GRACE_MINUTES}min old).`
    );

    // ── 3. Init Stripe + SendGrid ─────────────────────────
    const stripeKey = STRIPE_SECRET_KEY.value();
    if (!stripeKey) {
      console.error("[autoRefund] STRIPE_SECRET_KEY not configured.");
      return;
    }
    const stripe = new Stripe(stripeKey);
    sgMail.setApiKey(SENDGRID_API_KEY.value());

    // ── 4. Process each ride independently ────────────────
    const results = await Promise.allSettled(
      eligible.map((doc) => processRide(doc, stripe))
    );

    const succeeded = results.filter((r) => r.status === "fulfilled" && r.value === true).length;
    const failed    = results.length - succeeded;

    console.log(
      `[autoRefund] Batch complete | ${succeeded} processed, ${failed} failed`
    );
  }
);