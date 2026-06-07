const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const sgMail = require("@sendgrid/mail");

const db = getFirestore();

const ADMIN_EMAIL = "support@uatob.com";

const esc = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

exports.onSupportMessageSent = onDocumentCreated(
  {
    document: "Support/{messageId}",
    region: "us-east1",
    secrets: ["SENDGRID_API_KEY"],
  },
  async (event) => {
    const msg = event.data?.data();
    if (!msg) return;

    if (msg.sender === "admin") {
      await notifyDriver(msg);
    } else if (msg.sender === "driver") {
      await notifyAdmin(msg);
    }
  }
);

// ── Notify driver when admin sends a message ──────────────────────────────────
async function notifyDriver(msg) {
  const { driverId, message, threadId } = msg;
  if (!driverId || !message) return;

  const driverSnap = await db.collection("Drivers").doc(driverId).get();
  if (!driverSnap.exists) {
    console.warn(`[onSupportMessageSent] driver ${driverId} not found`);
    return;
  }

  const driver    = driverSnap.data();
  const email     = driver.email ?? null;
  const fcmToken  = driver.fcmToken ?? null;
  const firstName = driver.firstName ?? "Driver";

  const safeMsg = esc(message);

  if (fcmToken) {
    try {
      await getMessaging().send({
        token: fcmToken,
        notification: {
          title: "Support message from UaTob",
          body: message,
        },
        data: {
          type: "support_message",
          url: "https://uatob.com/driver",
          threadId: threadId ?? "",
        },
        android: {
          priority: "high",
          notification: { sound: "default", channelId: "support_alerts" },
        },
        apns: {
          payload: { aps: { sound: "default", badge: 1 } },
        },
      });
      console.log(`[onSupportMessageSent] FCM sent to driver ${driverId}`);
    } catch (e) {
      console.error("[onSupportMessageSent] driver FCM failed:", e.message);
    }
  }

  if (email) {
    const sendgridKey = process.env.SENDGRID_API_KEY;
    if (!sendgridKey) {
      console.error("[onSupportMessageSent] Missing SENDGRID_API_KEY");
      return;
    }
    sgMail.setApiKey(sendgridKey);

    try {
      await sgMail.send({
        to: email,
        from: { name: "UaTob Support", email: "no-reply@uatob.com" },
        subject: "You have a new message from UaTob Support",
        html: buildDriverEmailHtml({ firstName, safeMsg }),
      });
      console.log(`[onSupportMessageSent] email sent to driver ${email}`);
    } catch (e) {
      console.error("[onSupportMessageSent] driver email failed:", e.message);
    }
  }
}

// ── Notify admin when a driver sends a message ────────────────────────────────
async function notifyAdmin(msg) {
  const { driverId, driverName, message, threadId } = msg;
  if (!message) return;

  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (!sendgridKey) {
    console.error("[onSupportMessageSent] Missing SENDGRID_API_KEY");
    return;
  }
  sgMail.setApiKey(sendgridKey);

  const name     = driverName || driverId || "A driver";
  const safeMsg  = esc(message);
  const safeName = esc(name);

  // ── Increment unread counter on the thread (atomic, server-side) ──────
  if (threadId) {
    try {
      await db.collection("SupportThreads").doc(threadId).update({
        unreadByAdmin: FieldValue.increment(1),
      });
    } catch (e) {
      console.error("[onSupportMessageSent] unreadByAdmin increment failed:", e.message);
    }
  }

  // ── FCM push to admin ─────────────────────────────────────────────────
  try {
    const adminPushSnap = await db.collection("Admin").doc("push").get();
    const adminToken    = adminPushSnap.exists ? adminPushSnap.data()?.token : null;

    if (adminToken) {
      await getMessaging().send({
        token: adminToken,
        notification: {
          title: `Driver message — ${name}`,
          body: message,
        },
        data: {
          type:     "driver_support_message",
          url:      "https://admin.uatob.com",
          driverId: driverId ?? "",
          threadId: threadId ?? "",
        },
        android: {
          priority: "high",
          notification: { sound: "default", channelId: "admin_alerts" },
        },
        apns: {
          payload: { aps: { sound: "default", badge: 1 } },
        },
      });
      console.log(`[onSupportMessageSent] admin FCM sent for driver ${driverId}`);
    } else {
      console.warn("[onSupportMessageSent] no admin FCM token found at Admin/push");
    }
  } catch (e) {
    console.error("[onSupportMessageSent] admin FCM failed:", e.message);
  }

  // ── Email to admin ────────────────────────────────────────────────────
  try {
    await sgMail.send({
      to:   ADMIN_EMAIL,
      from: { name: "UaTob Support", email: "no-reply@uatob.com" },
      subject: `Driver message from ${name} — UaTob Support`,
      html: buildAdminEmailHtml({ safeName, safeMsg, driverId, threadId }),
    });
    console.log(`[onSupportMessageSent] admin email sent for driver ${driverId}`);
  } catch (e) {
    console.error("[onSupportMessageSent] admin email failed:", e.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Email design system
// Dark, on-brand UaTob shell. Table-based + inline styles for client safety,
// solid color fallbacks under any gradient, bulletproof (VML) Outlook buttons,
// and a hidden preheader for the inbox preview line.
// ══════════════════════════════════════════════════════════════════════════════

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const T = {
  page:   "#07090C",
  card:   "#11161D",
  header: "#0C1117",
  border: "#1E2730",
  hr:     "#1A222B",
  ink:    "#E6EDF3",
  sub:    "#9BA8B4",
  faint:  "#6B7785",
  green:  "#22C55E",
  greenBright: "#4ADE80",
  amber:  "#FBBF24",
  bubble: "#0E141B",
};

// Current time, formatted for Orlando.
function nowET() {
  return new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  }) + " ET";
}

// Hidden inbox-preview text.
function preheader(text) {
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:transparent;height:0;width:0;line-height:0;font-size:1px;">${esc(text)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`;
}

// Bulletproof button (renders in Outlook via VML, everywhere else via anchor).
function button(href, label, bg = T.green, fg = "#06140C", width = 280) {
  return `
  <!--[if mso]>
  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
    href="${href}" style="height:50px;v-text-anchor:middle;width:${width}px;" arcsize="24%" stroke="f" fillcolor="${bg}">
    <w:anchorlock/>
    <center style="color:${fg};font-family:sans-serif;font-size:15px;font-weight:bold;">${label}</center>
  </v:roundrect>
  <![endif]-->
  <!--[if !mso]><!-->
  <a href="${href}" target="_blank"
     style="display:inline-block;background:${bg};color:${fg};font-family:${FONT};font-size:15px;font-weight:800;letter-spacing:.2px;text-decoration:none;padding:15px 38px;border-radius:13px;box-shadow:0 8px 22px rgba(34,197,94,.28);">
    ${label}
  </a>
  <!--<![endif]-->`;
}

// A chat-style message bubble with sender label, timestamp, and accent edge.
function bubble({ who, time, text, accent }) {
  const body = String(text ?? "").replace(/\r?\n/g, "<br>");
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:0 0 8px;">
      <span style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:${accent};">${who}</span>
      <span style="font-size:11px;font-weight:600;color:${T.faint};">&nbsp;·&nbsp;${time}</span>
    </td></tr>
    <tr><td bgcolor="${T.bubble}" style="background:${T.bubble};border:1px solid ${T.border};border-left:3px solid ${accent};border-radius:14px;padding:18px 20px;">
      <p style="margin:0;font-size:15px;line-height:1.7;color:${T.ink};font-family:${FONT};">${body}</p>
    </td></tr>
  </table>`;
}

// Shared dark email shell.
function emailShell({ accent, preheaderText, eyebrow, title, pill, bodyHtml, footerNote }) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="dark light">
  <meta name="supported-color-schemes" content="dark light">
  <title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${T.page};">
  ${preheader(preheaderText)}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${T.page}" style="background:${T.page};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${T.card};border:1px solid ${T.border};border-radius:22px;overflow:hidden;">

          <!-- accent stripe -->
          <tr><td height="4" bgcolor="${accent}" style="height:4px;line-height:4px;font-size:0;background:${accent};">&nbsp;</td></tr>

          <!-- header -->
          <tr>
            <td bgcolor="${T.header}" style="background:${T.header};padding:30px 36px 26px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${T.green};box-shadow:0 0 10px ${T.green};"></span>
                    <span style="font-family:${FONT};font-size:19px;font-weight:900;letter-spacing:-.3px;color:${T.ink};margin-left:8px;vertical-align:middle;">UaTob</span>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="font-family:${FONT};font-size:10.5px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:${T.faint};">${esc(eyebrow)}</span>
                  </td>
                </tr>
              </table>
              <div style="font-family:${FONT};font-size:25px;font-weight:800;line-height:1.25;color:${T.ink};margin-top:18px;">${esc(title)}</div>
              ${pill ? `<div style="margin-top:12px;">
                <span style="display:inline-block;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.28);border-radius:99px;padding:5px 14px;font-family:${FONT};font-size:11.5px;font-weight:800;letter-spacing:.04em;color:${T.greenBright};">${pill}</span>
              </div>` : ""}
            </td>
          </tr>

          <!-- body -->
          <tr><td style="padding:30px 36px 10px;font-family:${FONT};">${bodyHtml}</td></tr>

          <!-- footer -->
          <tr>
            <td style="padding:24px 36px 30px;border-top:1px solid ${T.hr};">
              <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.7;color:${T.faint};">
                UaTob · Orlando, FL<br>
                <a href="mailto:support@uatob.com" style="color:${T.sub};text-decoration:none;">support@uatob.com</a>
                ${footerNote ? `<br><span style="color:#566270;">${esc(footerNote)}</span>` : ""}
                <br><span style="color:#566270;">© ${year} UaTob</span>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Driver-facing email (admin → driver) ───────────────────────────────────────
function buildDriverEmailHtml({ firstName, safeMsg }) {
  const name = esc(firstName ?? "Driver");
  const time = nowET();

  const body = `
    <p style="margin:0 0 18px;font-size:15.5px;color:${T.ink};line-height:1.6;">Hi ${name},</p>
    <p style="margin:0 0 22px;font-size:14.5px;color:${T.sub};line-height:1.7;">
      The UaTob support team just replied to your conversation. Here's the latest message:
    </p>

    ${bubble({ who: "UaTob Support", time, text: safeMsg, accent: T.green })}

    <p style="margin:24px 0 26px;font-size:13.5px;color:${T.sub};line-height:1.7;">
      Open the Driver app to read the full thread and reply. We usually respond within a few hours.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:2px 0 22px;">
        ${button("https://driver.uatob.com", "Open App &amp; Reply →", T.green, "#06140C", 260)}
      </td></tr>
    </table>`;

  return emailShell({
    accent: T.green,
    preheaderText: "You have a new message from UaTob Support — tap to read and reply.",
    eyebrow: "Support",
    title: "You've got a new message",
    pill: null,
    bodyHtml: body,
  });
}

// ── Admin-facing email (driver → admin) ─────────────────────────────────────────
function buildAdminEmailHtml({ safeName, safeMsg, driverId, threadId }) {
  const safeDriver = esc(driverId ?? "");
  const safeThread = esc(threadId ?? "");
  const time       = nowET();
  const initial    = (safeName || "D").trim().charAt(0).toUpperCase() || "D";

  // compact meta box (only renders rows that exist)
  const metaRows = [
    safeDriver ? `<tr><td style="padding:12px 16px;border-top:1px solid ${T.border};">
        <span style="font-size:10.5px;font-weight:800;letter-spacing:.1em;color:${T.faint};">DRIVER ID</span><br>
        <span style="font-size:12.5px;color:${T.sub};font-family:'SFMono-Regular',Consolas,monospace;">${safeDriver}</span>
      </td></tr>` : "",
    safeThread ? `<tr><td style="padding:12px 16px;border-top:1px solid ${T.border};">
        <span style="font-size:10.5px;font-weight:800;letter-spacing:.1em;color:${T.faint};">THREAD ID</span><br>
        <span style="font-size:12.5px;color:${T.sub};font-family:'SFMono-Regular',Consolas,monospace;">${safeThread}</span>
      </td></tr>` : "",
  ].join("");

  const body = `
    <p style="margin:0 0 20px;font-size:14.5px;color:${T.sub};line-height:1.7;">
      A driver replied in support and is waiting on a response.
    </p>

    <!-- driver identity -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
      <tr>
        <td width="48" style="vertical-align:middle;">
          <div style="width:46px;height:46px;border-radius:50%;background:#16291C;border:1px solid #1E3A2A;text-align:center;line-height:46px;font-size:19px;font-weight:800;color:${T.greenBright};font-family:${FONT};">${initial}</div>
        </td>
        <td style="vertical-align:middle;padding-left:13px;">
          <div style="font-size:15px;font-weight:800;color:${T.ink};">${safeName}</div>
          <div style="font-size:12px;font-weight:600;color:${T.faint};">Driver · awaiting reply</div>
        </td>
      </tr>
    </table>

    ${bubble({ who: safeName, time, text: safeMsg, accent: T.amber })}

    ${metaRows ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;background:${T.bubble};border:1px solid ${T.border};border-top:none;border-radius:12px;overflow:hidden;">
      ${metaRows}
    </table>` : ""}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:26px 0 22px;">
        ${button("https://admin.uatob.com", "Reply in Admin Panel →", T.green, "#06140C", 280)}
      </td></tr>
    </table>`;

  return emailShell({
    accent: T.amber, // amber stripe signals "action needed"
    preheaderText: `${safeName} sent a support message and is waiting for a reply.`,
    eyebrow: "Admin · Support",
    title: "Driver support message",
    pill: "Awaiting reply",
    bodyHtml: body,
    footerNote: "Internal use only.",
  });
}