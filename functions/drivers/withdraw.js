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
          driverMap[uid] = {
            cardRides:    [],
            cashRides:    [],
            totalPayout:  0,
            owedToUaTob:  0,
          };
        }

        if (data.paymentMethod === "cash") {
          driverMap[uid].cashRides.push({ id: doc.id, ...data });
          driverMap[uid].owedToUaTob = +(
            driverMap[uid].owedToUaTob + (data.platformFee || 0)
          ).toFixed(2);
        } else {
          driverMap[uid].cardRides.push({ id: doc.id, ...data });
          driverMap[uid].totalPayout = +(
            driverMap[uid].totalPayout + (data.driverPayout || 0)
          ).toFixed(2);
        }
      });

      const now   = admin.firestore.Timestamp.now();
      const batch = db.batch();
      const summary = [];

      // ── Zero out paid drivers with no new rides ─────────────────
      const allDriversWithWithdrawal = await db.collection("Drivers")
        .where("withdrawal.status", "==", "paid")
        .get();

      allDriversWithWithdrawal.forEach((doc) => {
        const uid = doc.id;
        if (!driverMap[uid]) {
          batch.update(db.collection("Drivers").doc(uid), {
            "withdrawal.totalPayout":      0,
            "withdrawal.owedToUaTob":      0,
            "withdrawal.rideCount":        0,
            "withdrawal.rideIds":          [],
            "withdrawal.rideBreakdown":    [],
            "withdrawal.cashRideCount":    0,
            "withdrawal.cashRideIds":      [],
            "withdrawal.cashRideBreakdown":[],
            "withdrawal.updatedAt":        now,
          });
        }
      });

      // ── Process each driver with pending rides ──────────────────
      for (const [uid, { cardRides, cashRides, totalPayout, owedToUaTob }] of Object.entries(driverMap)) {

        const driverSnap = await db.collection("Drivers").doc(uid).get();
        if (!driverSnap.exists) {
          console.warn(`⚠️  [withdraw] Driver doc not found: ${uid} — skipping`);
          continue;
        }

        const driver    = driverSnap.data();
        const existing  = driver.withdrawal;
        const driverRef = db.collection("Drivers").doc(uid);

        // ── Build rider name map for all rides ────────────────────
        const allRides  = [...cardRides, ...cashRides];
        const riderUids = [...new Set(allRides.map(r => r.uid).filter(Boolean))];
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

        // ── Card ride breakdown ───────────────────────────────────
        const rideBreakdown = cardRides.map(r => ({
          rideId:       r.id,
          riderUid:     r.uid          ?? null,
          riderName:    riderNameMap[r.uid] ?? "Unknown",
          pickup:       r.pickup       ?? "",
          dropoff:      r.dropoff      ?? "",
          driverPayout: r.driverPayout ?? 0,
          fareTotal:    r.fareTotal    ?? 0,
          completedAt:  r.completedAt  ?? null,
          rideType:     r.rideType     ?? "standard",
          paymentMethod:"card",
        }));

        // ── Cash ride breakdown ───────────────────────────────────
        const cashRideBreakdown = cashRides.map(r => ({
          rideId:       r.id,
          riderUid:     r.uid          ?? null,
          riderName:    riderNameMap[r.uid] ?? "Unknown",
          pickup:       r.pickup       ?? "",
          dropoff:      r.dropoff      ?? "",
          platformFee:  r.platformFee  ?? 0,
          fareTotal:    r.fareTotal    ?? 0,
          completedAt:  r.completedAt  ?? null,
          rideType:     r.rideType     ?? "standard",
          paymentMethod:"cash",
        }));

        const isPaidOrEmpty = !existing || existing.status === "paid";

        if (isPaidOrEmpty) {
          // ── Fresh withdrawal ──────────────────────────────────
          batch.update(driverRef, {
            withdrawal: {
              // card
              totalPayout,
              rideCount:         cardRides.length,
              rideIds:           cardRides.map(r => r.id),
              rideBreakdown,
              // cash
              owedToUaTob,
              cashRideCount:     cashRides.length,
              cashRideIds:       cashRides.map(r => r.id),
              cashRideBreakdown,
              // meta
              status:    "pending",
              createdAt: now,
              updatedAt: now,
            },
            updatedAt: now,
          });
        } else {
          // ── Accumulate into existing pending withdrawal ───────
          const mergedTotal         = +((existing.totalPayout    ?? 0) + totalPayout).toFixed(2);
          const mergedOwed          = +((existing.owedToUaTob    ?? 0) + owedToUaTob).toFixed(2);
          const mergedIds           = [...(existing.rideIds           ?? []), ...cardRides.map(r => r.id)];
          const mergedCount         = (existing.rideCount         ?? 0) + cardRides.length;
          const mergedBreakdown     = [...(existing.rideBreakdown     ?? []), ...rideBreakdown];
          const mergedCashIds       = [...(existing.cashRideIds       ?? []), ...cashRides.map(r => r.id)];
          const mergedCashCount     = (existing.cashRideCount     ?? 0) + cashRides.length;
          const mergedCashBreakdown = [...(existing.cashRideBreakdown ?? []), ...cashRideBreakdown];

          batch.update(driverRef, {
            "withdrawal.totalPayout":       mergedTotal,
            "withdrawal.owedToUaTob":       mergedOwed,
            "withdrawal.rideCount":         mergedCount,
            "withdrawal.rideIds":           mergedIds,
            "withdrawal.rideBreakdown":     mergedBreakdown,
            "withdrawal.cashRideCount":     mergedCashCount,
            "withdrawal.cashRideIds":       mergedCashIds,
            "withdrawal.cashRideBreakdown": mergedCashBreakdown,
            "withdrawal.updatedAt":         now,
            updatedAt:                      now,
          });
        }

        // ── Mark all rides as processing ──────────────────────────
        for (const ride of allRides) {
          batch.update(db.collection("Rides").doc(ride.id), {
            payoutStatus: "processing",
            updatedAt:    now,
          });
        }

        summary.push({
          driverUid:    uid,
          name:         `${driver.firstName ?? ""} ${driver.lastName ?? ""}`.trim(),
          totalPayout,
          owedToUaTob,
          cardCount:    cardRides.length,
          cashCount:    cashRides.length,
          merged:       !isPaidOrEmpty,
          rideBreakdown,
          cashRideBreakdown,
        });
      }

      await batch.commit();

      if (summary.length === 0 && snap.empty) {
        console.log("ℹ️  [withdraw] No pending payouts found.");
        return;
      }

      console.log(
        `✅ [withdraw] ${summary.length} driver(s)\n` +
        summary.map(d =>
          `  → ${d.name} (${d.driverUid})${d.merged ? " [merged]" : " [new]"}\n` +
          (d.cardCount > 0
            ? `    💳 Card: $${d.totalPayout} payout (${d.cardCount} rides)\n` +
              d.rideBreakdown.map(r =>
                `      · ${r.riderName} — ${r.pickup.split(",")[0]} → ${r.dropoff.split(",")[0]} — $${r.driverPayout}`
              ).join("\n")
            : "") +
          (d.cashCount > 0
            ? `\n    💵 Cash: $${d.owedToUaTob} owed to UaTob (${d.cashCount} rides)\n` +
              d.cashRideBreakdown.map(r =>
                `      · ${r.riderName} — ${r.pickup.split(",")[0]} → ${r.dropoff.split(",")[0]} — $${r.platformFee} fee`
              ).join("\n")
            : "")
        ).join("\n")
      );

    } catch (err) {
      console.error("❌ [withdraw]", err);
    }
  }
);