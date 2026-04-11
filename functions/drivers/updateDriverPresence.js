const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

if (!getApps().length) initializeApp();
const db = getFirestore();

/**
 * Runs every 1 minute and updates driver presence
 */
exports.updateDriverPresence = onSchedule(
  {
    schedule: "* * * * *", // every 1 minute
    region: "us-central1",
  },
  async () => {
    const now = new Date();

    const driversSnap = await db.collection("Drivers").get();

    const batch = db.batch();

    driversSnap.forEach((doc) => {
      const driver = doc.data();

      let minutesSinceLastSeen = null;
      let status = "offline";

      if (driver.lastSeenAt) {
        const lastSeen = driver.lastSeenAt.toDate();
        const diffMs = now - lastSeen;
        minutesSinceLastSeen = Math.floor(diffMs / 60000);

        // 🚦 presence rules
        if (minutesSinceLastSeen <= 2) {
          status = "online";
        } else if (minutesSinceLastSeen <= 5) {
          status = "idle";
        } else {
          status = "offline";
        }
      }

      batch.update(doc.ref, {
        minutesSinceLastSeen,
        status,
        presenceUpdatedAt: FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();

    console.log(`✅ Driver presence updated for ${driversSnap.size} drivers`);
  }
);