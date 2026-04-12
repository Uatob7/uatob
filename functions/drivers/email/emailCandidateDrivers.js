const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp, getApps } = require("firebase-admin/app");
const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");
const sgMail = require("@sendgrid/mail");

if (!getApps().length) initializeApp();
const db = getFirestore();

// ✅ Proper secret handling (Firebase v2 way)
const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");

exports.emailCandidateDrivers = onDocumentUpdated(
  {
    document: "Rides/{rideId}",
    region: "us-central1",
    secrets: [SENDGRID_API_KEY],
  },
  async (event) => {
    const before = event.data?.before?.data() || {};
    const after = event.data?.after?.data() || {};
    const rideRef = event.data.after.ref;

    try {
      // ✅ set API key ONCE, correctly
      sgMail.setApiKey(SENDGRID_API_KEY.value());

      const beforeList = before.candidateDriverUids || [];
      const afterList = after.candidateDriverUids || [];

      // ✅ if nothing changed → exit
      if (beforeList.length === afterList.length &&
          beforeList.every((v, i) => v === afterList[i])) {
        return;
      }

      // ❌ prevent duplicate sends
      if (after.candidateEmail === true) {
        console.log("⚠️ Already emailed");
        return;
      }

      if (!afterList.length) {
        console.log("⚠️ No candidate drivers");
        return;
      }

      console.log(`📨 Emailing ${afterList.length} drivers`);

      // ─────────────────────────────
      // FETCH DRIVERS
      // ─────────────────────────────
      const driverSnaps = await Promise.all(
        afterList.map((uid) =>
          db.collection("Drivers").doc(uid).get()
        )
      );

      const validDrivers = driverSnaps
        .filter((doc) => doc.exists)
        .map((doc) => doc.data())
        .filter((d) => d.email);

      if (!validDrivers.length) {
        console.log("⚠️ No drivers with emails");
        return;
      }

      // ─────────────────────────────
      // SEND EMAILS
      // ─────────────────────────────
      const messages = validDrivers.map((driver) => ({
        to: driver.email,
        from: "support@uatob.com",
        subject: "🚗 New Ride Available",
        html: `
          <div style="font-family:sans-serif;padding:20px">
            <h2>New Ride Available</h2>
            <p><strong>Pickup:</strong> ${after.pickup}</p>
            <p><strong>Dropoff:</strong> ${after.dropoff}</p>
            <p><strong>Payout:</strong> $${after.driverPayout ?? 0}</p>
            <a href="https://uatob.com/driver/app"
               style="background:#16A34A;color:#fff;padding:12px 20px;
                      text-decoration:none;border-radius:8px;">
              Open App
            </a>
          </div>
        `,
      }));

      await sgMail.send(messages);

      // ─────────────────────────────
      // MARK AS SENT
      // ─────────────────────────────
      await rideRef.update({
        candidateEmail: true,
        candidateNotifiedAt: FieldValue.serverTimestamp(),
      });

      console.log("✅ Emails sent successfully");

    } catch (err) {
      console.error("❌ Email error:", err);
    }
  }
);