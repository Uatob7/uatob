const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

if (!getApps().length) initializeApp();
const db = getFirestore();

exports.updateDriverPresence = onSchedule(
  {
    schedule: "every 7 minutes",
    region: "us-central1",
  },
  async () => {
    const now = Date.now();

    const driversSnap = await db.collection("Drivers").get();

    const batch = db.batch();

    driversSnap.forEach((doc) => {
      const driver = doc.data();

      if (!driver.lastSeenAt) return;

      const lastSeen = driver.lastSeenAt.toDate().getTime();
      const diffMs = now - lastSeen;
      const minutesSinceLastSeen = Math.floor(diffMs / 60000);

      let status = "offline";

      if (minutesSinceLastSeen <= 2) {
        status = "online";
      } else if (minutesSinceLastSeen <= 5) {
        status = "idle";
      }

      batch.update(doc.ref, {
        minutesSinceLastSeen,
        presenceUpdatedAt: FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();

    console.log(`✅ Driver presence updated`);
  }
);