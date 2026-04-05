const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore } = require("firebase-admin/firestore");
const sgMail = require("@sendgrid/mail");

const db = getFirestore();

exports.onRideCreated = onDocumentCreated(
  {
    document: "Rides/{rideId}",
    region: "us-central1",
    secrets: ["SENDGRID_API_KEY"],
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
        tripDistanceMiles,
        tripDurationMin,
        paymentMethod,
        status,
      } = ride || {};

      if (!uid) {
        console.log("No UID on ride, skipping email.");
        return null;
      }

      // 🔍 Get account by UID
      const accountSnap = await db.collection("Accounts").doc(uid).get();

      if (!accountSnap.exists) {
        console.log("No account found for UID:", uid);
        return null;
      }

      const account = accountSnap.data();
      const email = account.email;
      const name = account.name || "there";

      if (!email) {
        console.log("No email on account, skipping.");
        return null;
      }

      // 🧠 Prevent duplicate emails
      if (ride.emailSent) {
        console.log("Ride email already sent.");
        return null;
      }

      const sendgridKey = process.env.SENDGRID_API_KEY;
      if (!sendgridKey) {
        console.error("Missing SENDGRID_API_KEY");
        return null;
      }

      sgMail.setApiKey(sendgridKey);

      const msg = {
        to: email,
        from: "UaTob <noreply@uatob.com>",
        subject: `🚗 Your UaTob Ride Receipt`,
        text: `Hey ${name}, your ride from ${pickup} to ${dropoff} is ${status}. Total: $${fareTotal}`,
        html: `
          <div style="font-family:Arial,sans-serif;padding:24px;">
            <h2>🚗 Ride Receipt</h2>
            <p>Hey <strong>${name}</strong>, thanks for riding with UaTob!</p>

            <div style="margin:20px 0;padding:16px;border:1px solid #eee;border-radius:10px;">
              <p><strong>Pickup:</strong> ${pickup}</p>
              <p><strong>Dropoff:</strong> ${dropoff}</p>
              <p><strong>Distance:</strong> ${tripDistanceMiles} miles</p>
              <p><strong>Duration:</strong> ${tripDurationMin} minutes</p>
              <p><strong>Payment:</strong> ${paymentMethod}</p>
              <p style="font-size:18px;margin-top:12px;">
                <strong>Total: $${fareTotal}</strong>
              </p>
            </div>

            <p style="font-size:13px;color:#666;">
              We appreciate you riding with UaTob 🚀
            </p>
          </div>
        `,
      };

      await sgMail.send(msg);

      // ✅ Mark email sent on ride doc
      await snap.ref.update({
        emailSent: true,
      });

      console.log(`📧 Ride email sent to ${email} ✅`);
      return null;

    } catch (error) {
      console.error("❌ Error sending ride email:", error);
      if (error.response) {
        console.error(error.response.body);
      }
      return null;
    }
  }
);