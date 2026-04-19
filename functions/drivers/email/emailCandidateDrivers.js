const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.emailCandidateDrivers = onSchedule(
  {
    schedule: "every 1 minutes",
    region: "us-central1",
    secrets: ["SENDGRID_API_KEY"],
  },
  async () => {
    const apiKey = process.env.SENDGRID_API_KEY;

    if (!apiKey) {
      console.error("[emailCandidateDrivers] Missing SendGrid API key");
      return;
    }

    sgMail.setApiKey(apiKey);

    const ridesSnap = await db
      .collection("Rides")
      .where("paymentStatus", "==", "succeeded")
      .where("status", "==", "searching_driver")
      .get();

    if (ridesSnap.empty) {
      console.log("[emailCandidateDrivers] No active rides");
      return;
    }

    const driversSnap = await db
      .collection("Drivers")
      .where("status", "==", "online")
      .get();

    if (driversSnap.empty) {
      console.log("[emailCandidateDrivers] No online drivers");
      return;
    }

    const drivers = driversSnap.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    }));

    const emailPromises = [];

    for (const rideDoc of ridesSnap.docs) {
      const ride = rideDoc.data();
      const rideRef = rideDoc.ref;

      const sentMap = ride.emailSentToDrivers || {};
      const candidateUids = ride.candidateDriverUids || [];

      // ───────────────────────────────
      // FIRST WAVE (candidate drivers)
      // ───────────────────────────────
      if (!ride.emailDispatchStarted) {
        console.log(`[DISPATCH] First wave ${rideDoc.id}`);

        await rideRef.update({
          emailDispatchStarted: true,
          emailDispatchAt: admin.firestore.FieldValue.serverTimestamp(),
          emailSentToDrivers: {},
        });

        for (const driver of drivers) {
          if (!candidateUids.includes(driver.uid)) continue;
          if (sentMap[driver.uid]) continue;

          emailPromises.push(
            sendDriverEmail(driver, ride)
          );

          sentMap[driver.uid] = true;
        }

        await rideRef.update({
          emailSentToDrivers: sentMap,
        });

        continue;
      }

      // ───────────────────────────────
      // EXPANSION WAVES
      // ───────────────────────────────
      const batchSize = 10;
      const currentIndex = ride.currentDriverIndex || 0;

      const nextBatch = drivers.slice(
        currentIndex,
        currentIndex + batchSize
      );

      if (nextBatch.length === 0) continue;

      console.log(
        `[DISPATCH] Expanding ${rideDoc.id} → ${currentIndex}-${currentIndex + batchSize}`
      );

      for (const driver of nextBatch) {
        if (sentMap[driver.uid]) continue;

        emailPromises.push(
          sendDriverEmail(driver, ride)
        );

        sentMap[driver.uid] = true;
      }

      await rideRef.update({
        currentDriverIndex: currentIndex + batchSize,
        emailSentToDrivers: sentMap,
        lastDispatchAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await Promise.allSettled(emailPromises);

    console.log(`[emailCandidateDrivers] Done`);
  }
);

// ───────────────────────────────
// EMAIL HELPER
// ───────────────────────────────
function sendDriverEmail(driver, ride) {
  return sgMail.send({
    to: driver.email,
    from: "no-reply@uatob.com",
    subject: "🚗 New Ride Request",
    text: `
New ride available.

Pickup: ${ride.pickup || "N/A"}
Dropoff: ${ride.dropoff || "N/A"}
Distance: ${ride.tripDistanceMiles || "N/A"} miles

Open the app to accept immediately.
    `,
  });
}