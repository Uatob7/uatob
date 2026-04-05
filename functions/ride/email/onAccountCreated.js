const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const sgMail = require("@sendgrid/mail");

exports.onAccountCreated = onDocumentCreated(
  {
    document: "Accounts/{uid}",
    region: "us-central1",
    secrets: ["SENDGRID_API_KEY"],
  },
  async (event) => {
    try {
      const snap = event.data;
      if (!snap) return null;

      const accountData = snap.data();
      const { email, name } = accountData || {};

      if (!email) {
        console.log("No email found on account doc, skipping email.");
        return null;
      }

      const sendgridKey = process.env.SENDGRID_API_KEY;
      if (!sendgridKey) {
        console.error("Missing SENDGRID_API_KEY");
        return null;
      }

      sgMail.setApiKey(sendgridKey);

      const userName = name || "there";

      // 🧠 Prevent duplicate emails
      if (accountData.welcomeEmailSent) {
        console.log("Welcome email already sent, skipping.");
        return null;
      }

      const msg = {
        to: email,
        from: "UaTob <noreply@uatob.com>",
        subject: `🎉 Welcome to UaTob, ${userName}!`,
        text: `Hey ${userName}! Welcome to UaTob — Orlando’s rideshare platform. You’re all set to start requesting rides. Open the app and get moving 🚗`,
        html: `
          <div style="font-family:Arial,sans-serif;padding:24px;">
            <h1>Welcome to UaTob, ${userName}! 🎉</h1>
            <p>
              Your account has been successfully created.
            </p>
            <p>
              You can now request rides anytime in Orlando and get where you need to go — fast and reliable.
            </p>

            <div style="margin:24px 0;">
              <a href="https://uatob.com"
                 style="background:#16A34A;color:#fff;padding:14px 24px;
                        text-decoration:none;border-radius:8px;font-weight:bold;">
                Open UaTob
              </a>
            </div>

            <p style="font-size:13px;color:#666;">
              Need help? Visit our help center anytime.
            </p>
          </div>
        `,
      };

      await sgMail.send(msg);

      // ✅ Mark as sent to prevent duplicates
      await snap.ref.update({
        welcomeEmailSent: true,
      });

      console.log(`📧 Account welcome email sent to ${email} ✅`);
      return null;

    } catch (error) {
      console.error("❌ Error sending account welcome email:", error);
      if (error.response) {
        console.error(error.response.body);
      }
      return null;
    }
  }
);