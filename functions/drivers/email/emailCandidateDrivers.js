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
    try {
      const apiKey = process.env.SENDGRID_API_KEY;

      if (!apiKey) {
        console.error("[emailCandidateDrivers] Missing SendGrid API key");
        return;
      }

      sgMail.setApiKey(apiKey);

      // 1. Get active rides waiting for drivers
      const ridesSnap = await db
        .collection("Rides")
        .where("paymentStatus", "==", "succeeded")
        .where("status", "==", "searching_driver")
        .get();

      if (ridesSnap.empty) {
        console.log("[emailCandidateDrivers] No active rides");
        return;
      }

      // 2. Get online drivers
      const driversSnap = await db
        .collection("Drivers")
        .where("status", "==", "online")
        .get();

      if (driversSnap.empty) {
        console.log("[emailCandidateDrivers] No online drivers");
        return;
      }

      const drivers = driversSnap.docs
        .map((doc) => ({ uid: doc.id, ...doc.data() }))
        .filter((d) => d.email); // only drivers with email

      if (drivers.length === 0) {
        console.log("[emailCandidateDrivers] No drivers with email");
        return;
      }

      const emailPromises = [];

      ridesSnap.forEach((rideDoc) => {
        const ride = rideDoc.data();

        drivers.forEach((driver) => {
          // optional safety filter: ignore stale drivers
          const isStale =
            driver.minutesSinceLastSeen &&
            driver.minutesSinceLastSeen > 60 * 12; // 12 hours

          if (isStale) return;

          emailPromises.push(
            sgMail.send({
              to: driver.email,
              from: "no-reply@yourapp.com",
              subject: "🚗 New Ride Request Available",
              text: `
New ride available near you.

Pickup: ${ride.pickupLocation || "N/A"}
Dropoff: ${ride.dropoffLocation || "N/A"}

Open the app to accept this ride.
              `,
            })
          );
        });
      });

      await Promise.all(emailPromises);

      console.log(
        `[emailCandidateDrivers] Sent emails for ${ridesSnap.size} rides`
      );
    } catch (err) {
      console.error("[emailCandidateDrivers] Error:", err);
    }
  }
);