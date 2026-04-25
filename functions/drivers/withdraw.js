const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

const db = admin.firestore();

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

      // ── Zero out paid drivers with no new rides ─────────────────
      const allDriversWithWithdrawal = await db.collection("Drivers")
        .where("withdrawal.status", "==", "paid")
        .get();

      allDriversWithWithdrawal.forEach((doc) => {
        const uid = doc.id;
        if (!driverMap[uid]) {
          batch.update(db.collection("Drivers").doc(uid), {
            "withdrawal.totalPayout": 0,
            "withdrawal.rideCount":   0,
            "withdrawal.rideIds":     [],
            "withdrawal.riders":      [],
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

        const driver    = driverSnap.data();
        const existing  = driver.withdrawal;
        const driverRef = db.collection("Drivers").doc(uid);

        // ── Build riders summary for this batch of rides ──────────
        // Fetch rider accounts to get names
        const riderUids = [...new Set(rides.map(r => r.uid).filter(Boolean))];
        const riderDocs = await Promise.all(
          riderUids.map(ruid => db.collection("Accounts").doc(ruid).get())
        );
        const riderNameMap = {};
        riderDocs.forEach((d) => {
          if (d.exists) {
            const data = d.data();
            riderNameMap[d.id] = data.name || data.email || d.id;
          }
        });

        // Build per-ride breakdown
        const rideBreakdown = rides.map(r => ({
          rideId:      r.id,
          riderUid:    r.uid     ?? null,
          riderName:   riderNameMap[r.uid] ?? "Unknown",
          pickup:      r.pickup  ?? "",
          dropoff:     r.dropoff ?? "",
          driverPayout: r.driverPayout ?? 0,
          fareTotal:   r.fareTotal    ?? 0,
          completedAt: r.completedAt  ?? null,
          rideType:    r.rideType     ?? "standard",
        }));

        const isPaidOrEmpty = !existing || existing.status === "paid";

        if (isPaidOrEmpty) {
          // ── Fresh withdrawal ──────────────────────────────────
          batch.update(driverRef, {
            withdrawal: {
              totalPayout,
              rideCount:     rides.length,
              rideIds:       rides.map(r => r.id),
              rideBreakdown,
              status:        "pending",
              createdAt:     now,
              updatedAt:     now,
            },
            updatedAt: now,
          });
        } else {
          // ── Accumulate into existing pending withdrawal ───────
          const mergedTotal     = +((existing.totalPayout ?? 0) + totalPayout).toFixed(2);
          const mergedIds       = [...(existing.rideIds ?? []),       ...rides.map(r => r.id)];
          const mergedCount     = (existing.rideCount ?? 0) + rides.length;
          const mergedBreakdown = [...(existing.rideBreakdown ?? []), ...rideBreakdown];

          batch.update(driverRef, {
            "withdrawal.totalPayout":   mergedTotal,
            "withdrawal.rideCount":     mergedCount,
            "withdrawal.rideIds":       mergedIds,
            "withdrawal.rideBreakdown": mergedBreakdown,
            "withdrawal.updatedAt":     now,
            updatedAt:                  now,
          });
        }

        // ── Mark rides as processing ──────────────────────────────
        for (const ride of rides) {
          batch.update(db.collection("Rides").doc(ride.id), {
            payoutStatus: "processing",
            updatedAt:    now,
          });
        }

        summary.push({
          driverUid:    uid,
          name:         `${driver.firstName ?? ""} ${driver.lastName ?? ""}`.trim(),
          totalPayout,
          rideCount:    rides.length,
          merged:       !isPaidOrEmpty,
          rideBreakdown,
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
          `  → ${d.name} (${d.driverUid})  $${d.totalPayout}  (${d.rideCount} rides)${d.merged ? " [merged]" : " [new]"}\n` +
          d.rideBreakdown.map(r =>
            `      · ${r.riderName} — ${r.pickup.split(",")[0]} → ${r.dropoff.split(",")[0]} — $${r.driverPayout}`
          ).join("\n")
        ).join("\n")
      );

    } catch (err) {
      console.error("❌ [withdraw]", err);
    }
  }
);