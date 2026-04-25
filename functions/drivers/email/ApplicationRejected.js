const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const sgMail = require("@sendgrid/mail");

exports.ApplicationRejected = onDocumentUpdated(
  {
    document: "Drivers/{uid}",
    region: "us-central1",
    secrets: ["SENDGRID_API_KEY"],
  },
  async (event) => {
    try {
      const before = event.data.before.data();
      const after  = event.data.after.data();

      // Only fire when status changes TO rejected
      if (before.status === after.status) return null;
      if (after.status !== "rejected") return null;

      const { email, firstName, lastName } = after || {};

      if (!email) {
        console.log("No email found, skipping rejection email.");
        return null;
      }

      const sendgridKey = process.env.SENDGRID_API_KEY;
      if (!sendgridKey) {
        console.error("Missing SENDGRID_API_KEY");
        return null;
      }

      sgMail.setApiKey(sendgridKey);

      const name = firstName || "there";

      const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">

        <table width="600" style="background:#ffffff;border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#DC2626;padding:40px;text-align:center;color:#fff;">
              <h1 style="margin:0;font-size:28px;">Application Not Approved</h1>
              <p style="margin-top:10px;font-size:15px;">
                We're sorry, ${name}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:30px;color:#111;line-height:1.6;">

              <p>
                Hi <strong>${name}</strong>,
              </p>

              <p>
                Unfortunately, your UaTob driver application was
                <strong>not approved</strong> at this time.
              </p>

              <div style="background:#FEF2F2;border:1px solid #FCA5A5;
                          padding:20px;border-radius:12px;margin:20px 0;">
                <strong>What you can do next:</strong>
                <ul style="margin-top:10px;">
                  <li>Review your profile information</li>
                  <li>Make sure all required documents are clear and valid</li>
                  <li>Resubmit your application</li>
                </ul>
              </div>

              <p>
                If you believe this was a mistake or need help,
                please contact our support team.
              </p>

              <!-- CTA -->
              <div style="text-align:center;margin:30px 0;">
                <a href="https://uatob.com/help"
                   style="background:#DC2626;color:#fff;
                          padding:14px 28px;text-decoration:none;
                          border-radius:10px;font-weight:bold;">
                  Contact Support →
                </a>
              </div>

              <p style="font-size:13px;color:#555;">
                You can update your application anytime and try again.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="text-align:center;padding:20px;background:#F3F4F6;font-size:12px;color:#666;">
              © ${new Date().getFullYear()} UaTob
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
        to: email,
        from: "UaTob <noreply@uatob.com>",
        subject: `⚠️ Application Not Approved — UaTob`,
        text: `Hi ${name}, your UaTob driver application was not approved. Please review your profile and resubmit or contact support.`,
        html,
      };

      await sgMail.send(msg);

      console.log(`📧 Rejection email sent to ${email} ❌`);
      return null;

    } catch (error) {
      console.error("❌ Error sending rejection email:", error);
      return null;
    }
  }
);