const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const sgMail = require("@sendgrid/mail");

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

const ADMIN_EMAIL = "support@uatob.com";

exports.onRideCreatedNotifyAdmin = onDocumentCreated(
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
        fareBreakdown,    // { baseFare, distanceFare, bookingFee, tip, discount }
        tripDistanceMiles,
        tripDurationMin,
        paymentMethod,
        paymentLast4,
        paymentStatus,
        status,
        rideType,
        driverName,
        driverUid,
        vehicleMake,
        vehicleModel,
        vehiclePlate,
        createdAt,
      } = ride || {};

      const rideId = event.params.rideId;

      // 🧠 Prevent duplicate notifications
      if (ride.adminNotified) {
        console.log("Admin already notified for this ride, skipping.");
        return null;
      }

      const sendgridKey = process.env.SENDGRID_API_KEY;
      if (!sendgridKey) {
        console.error("Missing SENDGRID_API_KEY");
        return null;
      }

      sgMail.setApiKey(sendgridKey);

      // ── Sanitised display values ─────────────────────────────────────────
      const safeRideId  = esc(rideId      || "N/A");
      const safeUid     = esc(uid         || "N/A");
      const safePickup  = esc(pickup      || "N/A");
      const safeDropoff = esc(dropoff     || "N/A");
      const safeDriver  = esc(driverName  || "Unassigned");
      const safeDriverUid = esc(driverUid || "N/A");
      const safeVehicle = esc(
        vehicleMake && vehicleModel
          ? `${vehicleMake} ${vehicleModel}${vehiclePlate ? ` · ${vehiclePlate}` : ""}`
          : "N/A"
      );
      const safePayment = esc(
        paymentLast4
          ? `${paymentMethod} •••• ${paymentLast4}`
          : paymentMethod || "N/A"
      );
      const safeRideType = esc(
        rideType
          ? rideType.charAt(0).toUpperCase() + rideType.slice(1)
          : "Standard"
      );

      const rideStatusColor = status === "completed" ? "#16A34A"
                            : status === "cancelled"  ? "#DC2626"
                            : status === "active"     ? "#2563EB"
                            : "#D97706";
      const safeStatus = esc(
        status ? status.charAt(0).toUpperCase() + status.slice(1) : "N/A"
      );

      const payStatusColor = paymentStatus === "paid"    ? "#16A34A"
                           : paymentStatus === "failed"  ? "#DC2626"
                           : "#D97706";
      const safePayStatus = esc(
        paymentStatus
          ? paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)
          : "N/A"
      );

      const createdStr = createdAt?.toDate?.()
        ? createdAt.toDate().toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : "N/A";

      // ── Fare breakdown rows ──────────────────────────────────────────────
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
               style="margin-top:12px;padding-top:12px;border-top:1px dashed #d1d5db;">
          ${fareRows.map(r => `
          <tr>
            <td style="padding:5px 0;font-size:12.5px;color:#6B7280;
                       font-family:Arial,sans-serif;">${esc(r.label)}</td>
            <td style="padding:5px 0;font-size:12.5px;color:#111827;font-weight:600;
                       font-family:Arial,sans-serif;text-align:right;">
              ${r.negative ? "−" : ""}${fmt.currency(Math.abs(r.val))}
            </td>
          </tr>`).join("")}
        </table>
      ` : "";

      const year = new Date().getFullYear();

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>New Ride — UaTob Admin</title>
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
      .hero-title  { font-size: 24px !important; }
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
                style="background:linear-gradient(135deg,#1D4ED8 0%,#2563EB 55%,#3B82F6 100%);
                       padding:48px 32px 40px;">
              <table cellpadding="0" cellspacing="0" role="presentation"
                     style="margin:0 auto 20px;">
                <tr>
                  <td align="center">
                    <div style="width:72px;height:72px;
                                background-color:rgba(255,255,255,0.15);
                                border-radius:50%;text-align:center;
                                line-height:72px;font-size:36px;">
                      🚗
                    </div>
                  </td>
                </tr>
              </table>
              <h1 class="hero-title"
                  style="margin:0 0 10px;font-size:28px;font-weight:900;
                         color:#ffffff;line-height:1.2;letter-spacing:-0.5px;
                         font-family:Arial,sans-serif;">
                New Ride Created
              </h1>
              <p style="margin:0;font-size:14px;color:#ffffff;font-weight:500;
                        font-family:Arial,sans-serif;opacity:0.85;line-height:1.5;">
                A new ride was just booked on UaTob
              </p>
            </td>
          </tr>

          <!-- ── STATUS BADGES ── -->
          <tr>
            <td style="padding:0 32px;background-color:#ffffff;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-top:-18px;">
                <tr>
                  <td align="center">
                    <!-- Ride status -->
                    <div style="display:inline-block;background-color:#eff6ff;
                                border:2px solid #93c5fd;border-radius:100px;
                                padding:9px 18px;font-size:12px;font-weight:700;
                                color:${rideStatusColor};font-family:Arial,sans-serif;
                                letter-spacing:0.5px;margin:0 4px;">
                      ● &nbsp;RIDE: ${safeStatus.toUpperCase()}
                    </div>
                    <!-- Payment status -->
                    <div style="display:inline-block;background-color:#f0fdf4;
                                border:2px solid #86efac;border-radius:100px;
                                padding:9px 18px;font-size:12px;font-weight:700;
                                color:${payStatusColor};font-family:Arial,sans-serif;
                                letter-spacing:0.5px;margin:0 4px;">
                      💳 &nbsp;PAYMENT: ${safePayStatus.toUpperCase()}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── MAIN CONTENT ── -->
          <tr>
            <td class="content-pad"
                style="padding:32px 32px;background-color:#ffffff;">

              <!-- ── ROUTE ── -->
              <div style="background-color:#f9fafb;border:1px solid #e5e7eb;
                          border-radius:16px;padding:24px;margin-bottom:24px;">
                <h2 style="margin:0 0 18px;font-size:16px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  🗺️ Trip Route
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
                      <p style="margin:0;font-size:11px;font-weight:700;color:#6B7280;
                                 letter-spacing:0.8px;font-family:Arial,sans-serif;">
                        PICKUP
                      </p>
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
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                       style="margin-bottom:18px;">
                  <tr>
                    <td width="28" valign="top" style="padding-top:2px;">
                      <div style="width:20px;height:20px;background-color:#2563EB;
                                  border-radius:50%;text-align:center;line-height:20px;
                                  font-size:10px;color:#fff;font-family:Arial,sans-serif;">
                        B
                      </div>
                    </td>
                    <td valign="top">
                      <p style="margin:0;font-size:11px;font-weight:700;color:#6B7280;
                                 letter-spacing:0.8px;font-family:Arial,sans-serif;">
                        DROPOFF
                      </p>
                      <p style="margin:2px 0 0;font-size:14px;color:#111827;
                                 font-weight:600;font-family:Arial,sans-serif;">
                        ${safeDropoff}
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Trip stats -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                       style="padding-top:16px;border-top:1px solid #e5e7eb;">
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
                <h2 style="margin:0 0 14px;font-size:16px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  💳 Fare & Payment
                </h2>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td style="font-size:13px;color:#6B7280;
                               font-family:Arial,sans-serif;">
                      Payment Method
                    </td>
                    <td style="font-size:13px;color:#111827;font-weight:700;
                               font-family:Arial,sans-serif;text-align:right;">
                      ${safePayment}
                    </td>
                  </tr>
                </table>

                ${fareBreakdownHTML}

                <!-- Total -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                       style="margin-top:14px;padding-top:14px;
                              border-top:2px solid #86efac;">
                  <tr>
                    <td style="font-size:15px;font-weight:800;color:#111827;
                               font-family:Arial,sans-serif;">
                      Total Fare
                    </td>
                    <td style="font-size:24px;font-weight:900;color:#15803D;
                               font-family:Arial,sans-serif;text-align:right;">
                      ${fmt.currency(fareTotal)}
                    </td>
                  </tr>
                </table>
              </div>

              <!-- ── DRIVER & RIDER ── -->
              <div style="background-color:#eff6ff;border:2px solid #93c5fd;
                          border-radius:16px;padding:24px;margin-bottom:24px;">
                <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  👥 Parties
                </h2>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  ${[
                    ["Rider UID",   `<span style="font-family:monospace;font-size:12px;
                                     background:#dbeafe;padding:2px 6px;border-radius:4px;">
                                     ${safeUid}</span>`],
                    ["Driver",      safeDriver],
                    ["Driver UID",  `<span style="font-family:monospace;font-size:12px;
                                     background:#dbeafe;padding:2px 6px;border-radius:4px;">
                                     ${safeDriverUid}</span>`],
                    ["Vehicle",     safeVehicle],
                  ].map(([label, val], i, arr) => `
                  <tr>
                    <td style="padding:10px 0;
                               ${i < arr.length - 1 ? "border-bottom:1px solid #bfdbfe;" : ""}
                               font-size:13px;color:#6B7280;
                               font-family:Arial,sans-serif;width:40%;">
                      ${label}
                    </td>
                    <td style="padding:10px 0;
                               ${i < arr.length - 1 ? "border-bottom:1px solid #bfdbfe;" : ""}
                               font-size:13px;color:#111827;font-weight:700;
                               font-family:Arial,sans-serif;text-align:right;">
                      ${val}
                    </td>
                  </tr>`).join("")}
                </table>
              </div>

              <!-- ── RIDE METADATA ── -->
              <div style="background-color:#f9fafb;border:1px solid #e5e7eb;
                          border-radius:16px;padding:24px;margin-bottom:24px;">
                <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  🧾 Ride Metadata
                </h2>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  ${[
                    ["Ride ID",   `<span style="font-family:monospace;font-size:12px;
                                   background:#e5e7eb;padding:2px 6px;border-radius:4px;">
                                   ${safeRideId}</span>`],
                    ["Created",   createdStr],
                  ].map(([label, val], i, arr) => `
                  <tr>
                    <td style="padding:10px 0;
                               ${i < arr.length - 1 ? "border-bottom:1px solid #e5e7eb;" : ""}
                               font-size:13px;color:#6B7280;
                               font-family:Arial,sans-serif;width:35%;">
                      ${label}
                    </td>
                    <td style="padding:10px 0;
                               ${i < arr.length - 1 ? "border-bottom:1px solid #e5e7eb;" : ""}
                               font-size:13px;color:#111827;font-weight:700;
                               font-family:Arial,sans-serif;text-align:right;">
                      ${val}
                    </td>
                  </tr>`).join("")}
                </table>
              </div>

              <!-- ── QUICK ACTIONS ── -->
              <div style="background-color:#f9fafb;border:1px solid #e5e7eb;
                          border-radius:16px;padding:20px;margin-bottom:24px;">
                <h2 style="margin:0 0 14px;font-size:16px;font-weight:700;
                           color:#111827;font-family:Arial,sans-serif;">
                  ⚡ Quick Actions
                </h2>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td width="48%" align="center">
                      <a href="https://console.firebase.google.com/project/uatob/firestore/data/Rides/${safeRideId}"
                         style="display:inline-block;background-color:#2563EB;
                                color:#ffffff;font-size:13px;font-weight:700;
                                text-decoration:none;padding:12px 20px;
                                border-radius:10px;font-family:Arial,sans-serif;
                                width:100%;box-sizing:border-box;text-align:center;">
                        View Ride in Firestore →
                      </a>
                    </td>
                    <td width="4%"></td>
                    <td width="48%" align="center">
                      <a href="https://console.firebase.google.com/project/uatob/firestore/data/Accounts/${safeUid}"
                         style="display:inline-block;background-color:#111827;
                                color:#ffffff;font-size:13px;font-weight:700;
                                text-decoration:none;padding:12px 20px;
                                border-radius:10px;font-family:Arial,sans-serif;
                                width:100%;box-sizing:border-box;text-align:center;">
                        View Rider Account →
                      </a>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- ── FOOTER NOTE ── -->
              <div style="text-align:center;padding-top:20px;
                          border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:12px;color:#9CA3AF;
                           line-height:1.7;font-family:Arial,sans-serif;">
                  This is an automated admin notification from UaTob.<br/>
                  Do not share this email — it contains internal ride data.
                </p>
              </div>

            </td>
          </tr>

          <!-- ── EMAIL FOOTER ── -->
          <tr>
            <td style="padding:20px 32px;text-align:center;
                       background-color:#f3f4f6;border-top:1px solid #e5e7eb;">
              <div style="font-size:14px;font-weight:800;color:#111827;
                          font-family:Arial,sans-serif;margin-bottom:4px;">
                UaTob Admin
              </div>
              <div style="font-size:12px;color:#6B7280;font-family:Arial,sans-serif;
                          margin-bottom:8px;">
                Internal Notifications
              </div>
              <div style="font-size:11px;color:#9CA3AF;font-family:Arial,sans-serif;">
                © ${year} UaTob. All rights reserved.
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
        to:      ADMIN_EMAIL,
        from:    "UaTob Admin <noreply@uatob.com>",
        subject: `🚗 New ride: ${safePickup} → ${safeDropoff} · ${fmt.currency(fareTotal)}`,
        text:
          `New ride created on UaTob.\n\n` +
          `Ride ID:      ${rideId      || "N/A"}\n` +
          `Rider UID:    ${uid         || "N/A"}\n` +
          `Pickup:       ${pickup      || "N/A"}\n` +
          `Dropoff:      ${dropoff     || "N/A"}\n` +
          `Distance:     ${fmt.miles(tripDistanceMiles)}\n` +
          `Duration:     ${fmt.duration(tripDurationMin)}\n` +
          `Ride Type:    ${rideType    || "N/A"}\n` +
          `Driver:       ${driverName  || "Unassigned"}\n` +
          `Vehicle:      ${vehicleMake && vehicleModel ? `${vehicleMake} ${vehicleModel}` : "N/A"}\n` +
          `Payment:      ${paymentMethod || "N/A"}\n` +
          `Pay Status:   ${paymentStatus || "N/A"}\n` +
          `Total Fare:   ${fmt.currency(fareTotal)}\n` +
          `Ride Status:  ${status      || "N/A"}\n` +
          `Created:      ${createdStr}`,
        html,
      };

      await sgMail.send(msg);

      await snap.ref.update({ adminNotified: true });

      console.log(`📧 Admin notified of new ride (${rideId}) ✅`);
      return null;

    } catch (error) {
      console.error("❌ Error sending admin ride notification:", error);
      if (error.response) console.error(error.response.body);
      return null;
    }
  }
);
