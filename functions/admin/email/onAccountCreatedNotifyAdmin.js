const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const sgMail = require("@sendgrid/mail");

exports.onAccountCreatedNotifyAdmin = onDocumentCreated(
  {
    document: "Accounts/{uid}",
    region: "us-central1",
    secrets: ["SENDGRID_API_KEY"],
  },
  async (event) => {
    try {
      const snap = event.data;
      if (!snap) return null;

      const data = snap.data();
      const { email, name, uid, createdAt } = data || {};

      // 🧠 Prevent duplicate admin emails
      if (data.adminNotified) {
        console.log("Admin already notified, skipping.");
        return null;
      }

      const sendgridKey = process.env.SENDGRID_API_KEY;
      if (!sendgridKey) {
        console.error("Missing SENDGRID_API_KEY");
        return null;
      }

      sgMail.setApiKey(sendgridKey);

      // 🔥 CHANGE THIS to your admin email
      const ADMIN_EMAIL = "support@uatob.com";

      const msg = {
        to: ADMIN_EMAIL,
        from: "UaTob <noreply@uatob.com>",
        subject: "🆕 New Account Created",
        text: `New user signed up:\n\nName: ${name}\nEmail: ${email}\nUID: ${uid}`,
        html: `
          <div style="font-family:Arial,sans-serif;padding:24px;">
            <h2>🆕 New Account Created</h2>

            <div style="margin:20px 0;padding:16px;border:1px solid #eee;border-radius:10px;">
              <p><strong>Name:</strong> ${name || "N/A"}</p>
              <p><strong>Email:</strong> ${email || "N/A"}</p>
              <p><strong>UID:</strong> ${uid}</p>
              <p><strong>Created:</strong> ${
                createdAt?.toDate?.().toLocaleString() || "N/A"
              }</p>
            </div>

            <p style="font-size:13px;color:#666;">
              This is an automated admin notification from UaTob.
            </p>
          </div>
        `,
      };

      await sgMail.send(msg);

      // ✅ mark as notified
      await snap.ref.update({
        adminNotified: true,
      });

      console.log(`📧 Admin notified of new account: ${email} ✅`);
      return null;

    } catch (error) {
      console.error("❌ Error notifying admin:", error);
      if (error.response) {
        console.error(error.response.body);
      }
      return null;
    }
  }
);