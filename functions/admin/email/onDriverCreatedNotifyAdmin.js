const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const sgMail = require("@sendgrid/mail");

exports.onDriverCreatedNotifyAdmin = onDocumentCreated(
  {
    document: "Drivers/{uid}",
    region: "us-central1",
    secrets: ["SENDGRID_API_KEY"],
  },
  async (event) => {
    try {
      const snap = event.data;
      if (!snap) return null;

      const data = snap.data();
      const {
        email,
        firstName,
        lastName,
        uid,
        createdAt,
      } = data || {};

      // 🧠 Prevent duplicate emails
      if (data.adminNotified) {
        console.log("Admin already notified for this driver.");
        return null;
      }

      const sendgridKey = process.env.SENDGRID_API_KEY;
      if (!sendgridKey) {
        console.error("Missing SENDGRID_API_KEY");
        return null;
      }

      sgMail.setApiKey(sendgridKey);

      // 🔥 CHANGE THIS
      const ADMIN_EMAIL = "support@uatob.com";

      const fullName =
        `${firstName || ""} ${lastName || ""}`.trim() || "N/A";

      const msg = {
        to: ADMIN_EMAIL,
        from: "UaTob <noreply@uatob.com>",
        subject: "🚗 New Driver Signup",
        text: `New driver signed up:\n\nName: ${fullName}\nEmail: ${email}\nUID: ${uid}`,
        html: `
          <div style="font-family:Arial,sans-serif;padding:24px;">
            <h2>🚗 New Driver Signup</h2>

            <div style="margin:20px 0;padding:16px;border:1px solid #eee;border-radius:10px;">
              <p><strong>Name:</strong> ${fullName}</p>
              <p><strong>Email:</strong> ${email || "N/A"}</p>
              <p><strong>UID:</strong> ${uid}</p>
              <p><strong>Created:</strong> ${
                createdAt?.toDate?.().toLocaleString() || "N/A"
              }</p>
            </div>

            <div style="margin-top:20px;">
              <a href="https://console.firebase.google.com/"
                 style="background:#16A34A;color:#fff;padding:12px 20px;
                        text-decoration:none;border-radius:8px;font-weight:bold;">
                Review Driver
              </a>
            </div>

            <p style="margin-top:20px;font-size:12px;color:#666;">
              This is an automated notification from UaTob.
            </p>
          </div>
        `,
      };

      await sgMail.send(msg);

      // ✅ mark as notified
      await snap.ref.update({
        adminNotified: true,
      });

      console.log(`📧 Admin notified of new driver: ${email} ✅`);
      return null;

    } catch (error) {
      console.error("❌ Error notifying admin (driver):", error);
      if (error.response) {
        console.error(error.response.body);
      }
      return null;
    }
  }
);