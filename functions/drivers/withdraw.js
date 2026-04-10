const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

const db = admin.firestore();

/**
 * Scheduled withdrawal — runs every minute
 *
 * 1. Finds all Rides: status=completed, paymentStatus=succeeded, payoutStatus=pending
 * 2. Groups by driverUid and totals driverPayout per driver
 * 3. If driver withdrawal is "paid" or empty → fresh withdrawal map
 *    If driver withdrawal is still "pending"  → accumulate new rides into it
 * 4. Flips all included rides to payoutStatus="processing"
 * 5. If no pending rides exist for a driver at all → resets totalPayout to 0
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

      const now     = admin.firestore.Timestamp.now();
      const batch   = db.batch();
      const summary = [];

      // ── Fetch all drivers that currently have a withdrawal map ──
      // so we can zero out any that no longer have pending rides
      const allDriversWithWithdrawal = await db.collection("Drivers")
        .where("withdrawal.status", "==", "paid")
        .get();

      // Zero out drivers whose last withdrawal is paid and have no new rides
      allDriversWithWithdrawal.forEach((doc) => {
        const uid = doc.id;
        if (!driverMap[uid]) {
          // No new pending rides — reset totalPayout to 0
          batch.update(db.collection("Drivers").doc(uid), {
            "withdrawal.totalPayout": 0,
            "withdrawal.rideCount":   0,
            "withdrawal.rideIds":     [],
            "withdrawal.updatedAt":   now,
          });
        }
      });

      // ── Process each driver with pending rides ──────────────────
      for (const [uid, { rides, totalPayout }] of Object.entries(driverMap)) {

        const driverSnap = await db.collection("Drivers").doc(uid).get();

        if (!driverSnap.exists) {
          console.warn(`⚠️  [withdraw] Driver doc not found: ${uid} — skipping`);
          continue;
        }

        const driver   = driverSnap.data();
        const existing = driver.withdrawal;
        const driverRef = db.collection("Drivers").doc(uid);

        const isPaidOrEmpty = !existing || existing.status === "paid";

        if (isPaidOrEmpty) {
          // ── Fresh withdrawal ──────────────────────────────────
          batch.update(driverRef, {
            withdrawal: {
              totalPayout,
              rideCount: rides.length,
              rideIds:   rides.map(r => r.id),
              status:    "pending",
              createdAt: now,
              updatedAt: now,
            },
            updatedAt: now,
          });
        } else {
          // ── Accumulate into existing pending withdrawal ───────
          const mergedTotal  = +((existing.totalPayout ?? 0) + totalPayout).toFixed(2);
          const mergedIds    = [...(existing.rideIds ?? []), ...rides.map(r => r.id)];
          const mergedCount  = (existing.rideCount ?? 0) + rides.length;

          batch.update(driverRef, {
            "withdrawal.totalPayout": mergedTotal,
            "withdrawal.rideCount":   mergedCount,
            "withdrawal.rideIds":     mergedIds,
            "withdrawal.updatedAt":   now,
            updatedAt:                now,
          });
        }

        // Mark rides as "processing" so they aren't picked up again
        for (const ride of rides) {
          batch.update(db.collection("Rides").doc(ride.id), {
            payoutStatus: "processing",
            updatedAt:    now,
          });
        }

        summary.push({
          driverUid:  uid,
          name:       `${driver.firstName ?? ""} ${driver.lastName ?? ""}`.trim(),
          totalPayout,
          rideCount:  rides.length,
          merged:     !isPaidOrEmpty,
        });
      }

      await batch.commit();

      if (summary.length === 0 && snap.empty) {
        console.log("ℹ️  [withdraw] No pending payouts found.");
        return;
      }

      console.log(
        `✅ [withdraw] ${summary.length} driver(s) | ` +
        `${summary.reduce((a, d) => a + d.rideCount, 0)} rides | ` +
        `$${summary.reduce((a, d) => a + d.totalPayout, 0).toFixed(2)} total\n` +
        summary.map(d =>
          `  → ${d.name} (${d.driverUid})  $${d.totalPayout}  (${d.rideCount} rides)${d.merged ? " [merged]" : " [new]"}`
        ).join("\n")
      );

    } catch (err) {
      console.error("❌ [withdraw]", err);
    }
  }
);