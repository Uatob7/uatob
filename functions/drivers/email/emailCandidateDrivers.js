// File: functions/emailCandidateDrivers.js

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

    // ─────────────────────────────────────────────
    // 1. Get active rides ready for dispatch
    // ─────────────────────────────────────────────
    const ridesSnap = await db
      .collection("Rides")
      .where("paymentStatus", "==", "succeeded")
      .where("status", "==", "searching_driver")
      .get();

    if (ridesSnap.empty) {
      console.log("[emailCandidateDrivers] No active rides");
      return;
    }

    // ─────────────────────────────────────────────
    // 2. Get online drivers once
    // ─────────────────────────────────────────────
    const driversSnap = await db
      .collection("Drivers")
      .where("status", "==", "online")
      .get();

    if (driversSnap.empty) {
      console.log("[emailCandidateDrivers] No online drivers");
      return;
    }

    const allDrivers = driversSnap.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    }));

    // helper: only drivers with email
    const emailableDrivers = allDrivers.filter((d) => d.email);

    const emailPromises = [];

    // ─────────────────────────────────────────────
    // 3. Process each ride
    // ─────────────────────────────────────────────
    for (const rideDoc of ridesSnap.docs) {
      const ride = rideDoc.data();
      const rideRef = rideDoc.ref;

      const alreadyDispatched = ride.emailDispatchStarted === true;
      const candidateUids = ride.candidateDriverUids || [];

      // ─────────────────────────────────────────
      // FIRST TIME DISPATCH (IMMEDIATE)
      // ─────────────────────────────────────────
      if (!alreadyDispatched) {
        console.log(`[DISPATCH] First wave for ride ${rideDoc.id}`);

        await rideRef.update({
          emailDispatchStarted: true,
          emailDispatchAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // send ONLY to candidate drivers first
        const firstWaveDrivers = emailableDrivers.filter((d) =>
          candidateUids.includes(d.uid)
        );

        for (const driver of firstWaveDrivers) {
          emailPromises.push(
            sgMail.send({
              to: driver.email,
              from: "no-reply@uatob.com",
              subject: "🚗 New Ride Request Near You",
              text: `
New ride available.

Pickup: ${ride.pickup || "N/A"}
Dropoff: ${ride.dropoff || "N/A"}
Distance: ${ride.tripDistanceMiles || "N/A"} miles

Open the app to accept this ride immediately.
              `,
            })
          );
        }

        continue;
      }

      // ─────────────────────────────────────────
      // PROGRESSIVE EXPANSION (EVERY MINUTE)
      // ─────────────────────────────────────────
      const currentIndex = ride.currentDriverIndex || 0;

      const batchSize = 10;

      const nextBatch = emailableDrivers.slice(
        currentIndex,
        currentIndex + batchSize
      );

      if (nextBatch.length === 0) {
        console.log(`[DISPATCH] No more drivers for ride ${rideDoc.id}`);
        continue;
      }

      console.log(
        `[DISPATCH] Expanding ride ${rideDoc.id} → drivers ${currentIndex} to ${currentIndex + batchSize}`
      );

      for (const driver of nextBatch) {
        emailPromises.push(
          sgMail.send({
            to: driver.email,
            from: "no-reply@uatob.com",
            subject: "🚗 New Ride Still Available",
            text: `
A ride is still waiting nearby.

Pickup: ${ride.pickup}
Dropoff: ${ride.dropoff}

You are receiving this because nearby drivers are being notified.
            `,
          })
        );
      }

      await rideRef.update({
        currentDriverIndex: currentIndex + batchSize,
        lastDispatchAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await Promise.allSettled(emailPromises);

    console.log(
      `[emailCandidateDrivers] Processed ${ridesSnap.size} ride(s)`
    );
  }
);