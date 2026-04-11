const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const sgMail = require("@sendgrid/mail");

if (!getApps().length) initializeApp();
const db = getFirestore();

// 🔑 SET YOUR SENDGRID KEY
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ─────────────────────────────────────────────
// MAIN FUNCTION
// ─────────────────────────────────────────────
exports.emailCandidateDrivers = onDocumentCreated(
  {
    document: "Rides/{rideId}",
    region: "us-central1",
  },
  async (event) => {
    const snap = event.data;
    const ride = snap.data();
    const rideId = snap.id;

    try {
      // ❌ Already notified
      if (ride.driversNotified) {
        console.log("⚠️ Drivers already notified");
        return null;
      }

      const candidateUids = ride.candidateDriverUids || [];

      if (!candidateUids.length) {
        console.log("⚠️ No candidate drivers");
        return null;
      }

      console.log(`📨 Sending emails to ${candidateUids.length} drivers`);

      // ─────────────────────────────────────
      // FETCH ALL DRIVERS IN PARALLEL
      // ─────────────────────────────────────
      const driverSnaps = await Promise.all(
        candidateUids.map((uid) =>
          db.collection("Drivers").doc(uid).get()
        )
      );

      const validDrivers = driverSnaps
        .filter((doc) => doc.exists)
        .map((doc) => doc.data())
        .filter((d) => d.email); // must have email

      if (!validDrivers.length) {
        console.log("⚠️ No drivers with emails");
        return null;
      }

      // ─────────────────────────────────────
      // BUILD EMAILS
      // ─────────────────────────────────────
      const messages = validDrivers.map((driver) => {
        const payout = `$${Number(ride.driverPayout ?? 0).toFixed(2)}`;

        return {
          to: driver.email,
          from: "support@uatob.com",
          subject: "🚗 New Ride Available",
          html: `
            <div style="font-family:sans-serif;padding:20px">
              <h2>New Ride Available</h2>
              <p><strong>Payout:</strong> ${payout}</p>
              <p><strong>Pickup:</strong> ${ride.pickup}</p>
              <p><strong>Dropoff:</strong> ${ride.dropoff}</p>
              <p><strong>Distance:</strong> ${ride.tripDistanceMiles ?? "-"} mi</p>
              <p><strong>Duration:</strong> ${ride.tripDurationMin ?? "-"} min</p>
              <br/>
              <a href="https://uatob.com/driver/app"
                 style="background:#16A34A;color:#fff;padding:12px 20px;
                        text-decoration:none;border-radius:8px;">
                Open App
              </a>
            </div>
          `,
        };
      });

      // ─────────────────────────────────────
      // SEND EMAILS (BATCH)
      // ─────────────────────────────────────
      await sgMail.send(messages);

      // ─────────────────────────────────────
      // MARK AS SENT
      // ─────────────────────────────────────
      await snap.ref.update({
        driversNotified: true,
        driversNotifiedAt: FieldValue.serverTimestamp(),
      });

      console.log("✅ Emails sent successfully");

    } catch (err) {
      console.error("❌ Email error:", err.message);
    }

    return null;
  }
);