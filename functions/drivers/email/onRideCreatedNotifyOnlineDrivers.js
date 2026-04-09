const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore } = require("firebase-admin/firestore");
const sgMail = require("@sendgrid/mail");

const db = getFirestore();

const esc = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

exports.onRideCreatedNotifyOnlineDrivers = onDocumentCreated(
  {
    document: "Rides/{rideId}",
    region: "us-central1",
    secrets: ["SENDGRID_API_KEY"],
  },
  async (event) => {
    try {
      const ride = event.data?.data();
      if (!ride) return;

      const rideId = event.params.rideId;

      const {
        pickup,
        dropoff,
        rideType,
        driverPayout,
        tripDistanceMiles,
        tripDurationMin,
      } = ride;

      // 🔥 Get ONLY online drivers
      const driversSnap = await db
        .collection("Drivers")
        .where("status", "==", "online")
        .get();

      if (driversSnap.empty) {
        console.log("No online drivers found.");
        return;
      }

      const sendgridKey = process.env.SENDGRID_API_KEY;
      sgMail.setApiKey(sendgridKey);

      const safePickup = esc(pickup);
      const safeDropoff = esc(dropoff);

      console.log(`📡 Found ${driversSnap.size} online drivers`);

      // 🚗 SEND EMAIL ONE BY ONE (as requested)
      for (const doc of driversSnap.docs) {
        const driver = doc.data();

        // ⚠️ skip invalid drivers safely
        if (!driver.email) continue;

        const msg = {
          to: driver.email,
          from: "UaTob Dispatch <noreply@uatob.com>",
          subject: "🚗 New Ride Available Near You",
          html: `
            <div style="font-family:Arial,sans-serif">
              <h2>Hello ${esc(driver.firstName || "Driver")},</h2>

              <p>A new ride is available:</p>

              <ul>
                <li><b>Pickup:</b> ${safePickup}</li>
                <li><b>Dropoff:</b> ${safeDropoff}</li>
                <li><b>Type:</b> ${esc(rideType || "Standard")}</li>
                <li><b>Distance:</b> ${tripDistanceMiles || 0} miles</li>
                <li><b>Duration:</b> ${tripDurationMin || 0} minutes</li>
                <li><b>Driver Payout:</b> $${driverPayout || 0}</li>
              </ul>

              <p>Open the app to accept this ride.</p>

              <hr />      <small>Ride ID: ${rideId}</small>
            </div>
          `,
        };

        try {
          await sgMail.send(msg);
          console.log(`📧 Sent to ${driver.email}`);
        } catch (err) {
          console.error(`❌ Failed for ${driver.email}`, err);
        }
      }

      console.log("✅ All online driver emails processed");

      return null;
    } catch (error) {
      console.error("❌ Function failed:", error);
      return null;
    }
  }
);