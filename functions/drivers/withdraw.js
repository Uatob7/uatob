const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

const db = admin.firestore();

/**
 * Scheduled withdrawal — runs every minute
 *
 * 1. Finds all Rides: status=completed, paymentStatus=succeeded, payoutStatus=pending
 * 2. Groups by driverUid and totals driverPayout per driver
 * 3. Updates Drivers/{driverUid} directly with withdrawal info
 * 4. Flips all included rides to payoutStatus="processing" in a single batch
 */
exports.withdraw = onSchedule(
  {
    schedule: "* * * * *",
    region:   "us-central1",
    timeZone: "America/New_York",
  },
  async () => {
    try {

      // ── Query all pending payouts ───────────────────────────────
      const snap = await db.collection("Rides")
        .where("status",        "==", "completed")
        .where("paymentStatus", "==", "succeeded")
        .where("payoutStatus",  "==", "pending")
        .get();

      if (snap.empty) {
        console.log("ℹ️  [withdraw] No pending payouts found.");
        return;
      }

      // ── Group rides by driverUid ────────────────────────────────
      const driverMap = {};

      snap.forEach((doc) => {
        const data = doc.data();
        const uid  = data.driverUid;

        if (!uid) return;

        if (!driverMap[uid]) {
          driverMap[uid] = { rides: [], totalPayout: 0 };
        }

        driverMap[uid].rides.push({ id: doc.id, ...data });
        driverMap[uid].totalPayout = +(driverMap[uid].totalPayout + (data.driverPayout || 0)).toFixed(2);
      });

      // ── For each driver: fetch doc, write withdrawal onto driver doc ──
      const now   = admin.firestore.Timestamp.now();
      const batch = db.batch();
      const summary = [];

      for (const [uid, { rides, totalPayout }] of Object.entries(driverMap)) {

        // 1. Fetch driver doc
        const driverSnap = await db.collection("Drivers").doc(uid).get();

        if (!driverSnap.exists) {
          console.warn(`⚠️  [withdraw] Driver doc not found: ${uid} — skipping`);
          continue;
        }

        // 2. Write withdrawal info directly onto Drivers/{uid}
        const driverRef = db.collection("Drivers").doc(uid);

        batch.update(driverRef, {
          withdrawal: {
            totalPayout,
            rideCount:  rides.length,
            rideIds:    rides.map(r => r.id),
            status:     "pending",        // pending → processing → paid
            createdAt:  now,
            updatedAt:  now,
          },
          updatedAt: now,
        });

        // 3. Mark rides as "processing" so they aren't picked up again
        for (const ride of rides) {
          batch.update(db.collection("Rides").doc(ride.id), {
            payoutStatus: "processing",
            updatedAt:    now,
          });
        }

        const driver = driverSnap.data();

        summary.push({
          driverUid:  uid,
          name:       `${driver.firstName ?? ""} ${driver.lastName ?? ""}`.trim(),
          totalPayout,
          rideCount:  rides.length,
        });
      }

      if (summary.length === 0) {
        console.log("ℹ️  [withdraw] No eligible drivers found.");
        return;
      }

      await batch.commit();

      console.log(
        `✅ [withdraw] ${summary.length} driver(s) | ` +
        `${summary.reduce((a, d) => a + d.rideCount, 0)} rides | ` +
        `$${summary.reduce((a, d) => a + d.totalPayout, 0).toFixed(2)} total\n` +
        summary.map(d => `  → ${d.name} (${d.driverUid})  $${d.totalPayout}  (${d.rideCount} rides)`).join("\n")
      );

    } catch (err) {
      console.error("❌ [withdraw]", err);
    }
  }
);