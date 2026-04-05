const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const sgMail = require("@sendgrid/mail");

exports.onRideCreatedNotifyAdmin = onDocumentCreated(
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
        paymentStatus,
        status,
        createdAt,
      } = ride || {};

      // 🧠 Prevent duplicate notifications
      if (ride.adminNotified) {
        console.log("Admin already notified for this ride.");
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

      const msg = {
        to: ADMIN_EMAIL,
        from: "UaTob <noreply@uatob.com>",
        subject: "🚗 New Ride Created",
        text: `New ride created:\n\nFrom: ${pickup}\nTo: ${dropoff}\nFare: $${fareTotal}`,
        html: `
          <div style="font-family:Arial,sans-serif;padding:24px;">
            <h2>🚗 New Ride Created</h2>

            <div style="margin:20px 0;padding:16px;border:1px solid #eee;border-radius:10px;">
              <p><strong>User UID:</strong> ${uid}</p>
              <p><strong>Pickup:</strong> ${pickup}</p>
              <p><strong>Dropoff:</strong> ${dropoff}</p>
              <p><strong>Distance:</strong> ${tripDistanceMiles} miles</p>
              <p><strong>Duration:</strong> ${tripDurationMin} minutes</p>
              <p><strong>Payment Method:</strong> ${paymentMethod}</p>
              <p><strong>Payment Status:</strong> ${paymentStatus}</p>
              <p><strong>Status:</strong> ${status}</p>
              <p style="margin-top:10px;font-size:18px;">
                <strong>Total Fare: $${fareTotal}</strong>
              </p>
              <p style="margin-top:10px;">
                <strong>Created:</strong> ${
                  createdAt?.toDate?.().toLocaleString() || "N/A"
                }
              </p>
            </div>

            <div style="margin-top:20px;">
              <a href="https://console.firebase.google.com/"
                 style="background:#16A34A;color:#fff;padding:12px 20px;
                        text-decoration:none;border-radius:8px;font-weight:bold;">
                View Ride
              </a>
            </div>

            <p style="margin-top:20px;font-size:12px;color:#666;">
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

      console.log(`📧 Admin notified of new ride ✅`);
      return null;

    } catch (error) {
      console.error("❌ Error notifying admin (ride):", error);
      if (error.response) {
        console.error(error.response.body);
      }
      return null;
    }
  }
);