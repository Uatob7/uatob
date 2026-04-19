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
        console.error("[emailCandidateDrivers] Missing SendGrid key");
        return;
      }

      sgMail.setApiKey(apiKey);

      // 1. Get rides that need drivers
      const ridesSnap = await db
        .collection("Rides")
        .where("paymentStatus", "==", "succeeded")
        .where("status", "==", "searching_driver")
        .get();

      if (ridesSnap.empty) {
        console.log("[emailCandidateDrivers] No matching rides");
        return;
      }

      // 2. Get all online drivers
      const driversSnap = await db
        .collection("Drivers")
        .where("online", "==", true)
        .get();

      if (driversSnap.empty) {
        console.log("[emailCandidateDrivers] No online drivers");
        return;
      }

      const drivers = driversSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // 3. Loop rides + notify drivers
      const emailPromises = [];

      ridesSnap.forEach((rideDoc) => {
        const ride = rideDoc.data();

        drivers.forEach((driver) => {
          if (!driver.email) return;

          emailPromises.push(
            sgMail.send({
              to: driver.email,
              from: "no-reply@yourapp.com",
              subject: "New Ride Available 🚗",
              text: `A new ride is available near you.

Pickup: ${ride.pickupLocation || "N/A"}
Dropoff: ${ride.dropoffLocation || "N/A"}

Open the app to accept the ride.`,
            })
          );
        });
      });

      await Promise.all(emailPromises);

      console.log(
        `[emailCandidateDrivers] Sent emails for ${ridesSnap.size} rides`
      );
    } catch (error) {
      console.error("[emailCandidateDrivers] Error:", error);
    }
  }
);