// functions/scheduled/withdraw.js
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

const db = admin.firestore();

// ── Helpers ─────────────────────────────────────────────────
const round2 = (n) => +Number(n).toFixed(2);

function tsToMs(ts) {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (ts?.toMillis) return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts?._seconds) return ts._seconds * 1000;
  return 0;
}

/**
 * Decide if a ride should count toward this payout cycle.
 *
 * STRIPE-COLLECTED (card / cashapp / applepay / googlepay):
 *   - status === "completed"
 *   - paymentStatus === "succeeded"
 *   - payoutStatus is empty, "pending", or "processing"
 *
 * CASH:
 *   - status === "completed"
 *   - paymentMethod === "cash"
 *   - payoutStatus is empty, "pending", or "processing"
 *   - paymentStatus is ignored
 *
 * NOTE: We now also INCLUDE "processing" rides — because a ride that's
 * currently in a pending withdrawal IS still a real ride that should
 * remain on the withdrawal. If we excluded them, the reconcile step
 * would think they were deleted and remove them from the breakdown.
 */
function isLiveForPayout(ride) {
  if (ride.status !== "completed") return false;

  // Already paid out — done, not part of any live withdrawal
  if (ride.payoutStatus === "paid") return false;

  if (ride.paymentMethod === "cash") return true;

  return ride.paymentStatus === "succeeded";
}

exports.withdraw = onSchedule(
  {
    schedule: "* * * * *",
    region:   "us-central1",
    timeZone: "America/New_York",
  },
  async () => {
    try {
      // ─────────────────────────────────────────────────────
      // 1) Pull every completed ride
      // ─────────────────────────────────────────────────────
      const snap = await db.collection("Rides")
        .where("status", "==", "completed")
        .get();

      // ─────────────────────────────────────────────────────
      // 2) Group LIVE rides per driver.
      //
      //    A ride is "live" if it should appear in the driver's
      //    current pending withdrawal. This now includes both:
      //      - new rides (payoutStatus empty / pending)
      //      - rides already being processed (payoutStatus processing)
      //
      //    By doing this, we can fully RECONSTRUCT the withdrawal
      //    from scratch every run instead of appending — which means
      //    deleted rides naturally drop out.
      // ─────────────────────────────────────────────────────
      const driverMap = {};

      snap.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        const uid  = data.driverUid;
        if (!uid) return;
        if (!isLiveForPayout(data)) return;

        if (!driverMap[uid]) {
          driverMap[uid] = {
            stripeRides:     [],
            cashRides:       [],
            stripePayoutSum: 0,
            cashFeeOwedSum:  0,
          };
        }

        if (data.paymentMethod === "cash") {
          driverMap[uid].cashRides.push(data);
          driverMap[uid].cashFeeOwedSum = round2(
            driverMap[uid].cashFeeOwedSum + (data.platformFee || 0)
          );
        } else {
          driverMap[uid].stripeRides.push(data);
          driverMap[uid].stripePayoutSum = round2(
            driverMap[uid].stripePayoutSum + (data.driverPayout || 0)
          );
        }
      });

      const now     = admin.firestore.Timestamp.now();
      const batch   = db.batch();
      const summary = [];

      // ─────────────────────────────────────────────────────
      // 3) Find every driver that has a non-paid withdrawal
      //    so we can reconcile them — even if they currently
      //    have zero live rides (i.e. all their rides were
      //    deleted). This is the key fix: we don't only look
      //    at drivers in driverMap, we look at every driver
      //    that has an outstanding withdrawal.
      // ─────────────────────────────────────────────────────
      const driversWithWithdrawal = await db.collection("Drivers")
        .where("withdrawal.status", "in", ["pending", "paid"])
        .get();

      const reconcileSet = new Set();
      driversWithWithdrawal.forEach((d) => reconcileSet.add(d.id));
      Object.keys(driverMap).forEach((uid) => reconcileSet.add(uid));

      // ─────────────────────────────────────────────────────
      // 4) Process each driver in the reconcile set
      // ─────────────────────────────────────────────────────
      for (const uid of reconcileSet) {
        const group = driverMap[uid] || {
          stripeRides:     [],
          cashRides:       [],
          stripePayoutSum: 0,
          cashFeeOwedSum:  0,
        };
        const { stripeRides, cashRides, stripePayoutSum, cashFeeOwedSum } = group;

        const driverSnap = await db.collection("Drivers").doc(uid).get();
        if (!driverSnap.exists) {
          console.warn(`⚠️  [withdraw] Driver doc not found: ${uid} — skipping`);
          continue;
        }

        const driver    = driverSnap.data();
        const existing  = driver.withdrawal || {};
        const driverRef = db.collection("Drivers").doc(uid);

        // ─── Carry-forward balance ──────────────────────────
        const carriedCashOwed = round2(driver.cashOwedBalance ?? 0);

        // ─── Reconstruct breakdowns from live rides ─────────
        const allRides  = [...stripeRides, ...cashRides];
        const riderUids = [...new Set(allRides.map((r) => r.uid).filter(Boolean))];
        const riderDocs = await Promise.all(
          riderUids.map((ruid) => db.collection("Accounts").doc(ruid).get())
        );
        const riderNameMap = {};
        riderDocs.forEach((d) => {
          if (d.exists) {
            const data = d.data();
            riderNameMap[d.id] = data.name || data.email || d.id;
          }
        });

        const stripeRideBreakdown = stripeRides.map((r) => ({
          rideId:        r.id,
          riderUid:      r.uid          ?? null,
          riderName:     riderNameMap[r.uid] ?? "Unknown",
          pickup:        r.pickup       ?? "",
          dropoff:       r.dropoff      ?? "",
          driverPayout:  r.driverPayout ?? 0,
          fareTotal:     r.fareTotal    ?? 0,
          completedAt:   r.completedAt  ?? null,
          rideType:      r.rideType     ?? "standard",
          paymentMethod: r.paymentMethod ?? "card",
        }));

        const cashRideBreakdown = cashRides.map((r) => ({
          rideId:        r.id,
          riderUid:      r.uid          ?? null,
          riderName:     riderNameMap[r.uid] ?? "Unknown",
          pickup:        r.pickup       ?? "",
          dropoff:       r.dropoff      ?? "",
          fareTotal:     r.fareTotal    ?? 0,
          driverPayout:  r.driverPayout ?? 0,
          platformFee:   r.platformFee  ?? 0,
          completedAt:   r.completedAt  ?? null,
          rideType:      r.rideType     ?? "standard",
          paymentMethod: "cash",
        }));

        // ─── Net math ───────────────────────────────────────
        const totalCashOwed = round2(cashFeeOwedSum + carriedCashOwed);
        let   netPayout     = round2(stripePayoutSum - totalCashOwed);
        let   newCashOwedBalance = 0;

        if (netPayout < 0) {
          newCashOwedBalance = round2(-netPayout);
          netPayout = 0;
        }

        const hasAnyLiveRides = stripeRides.length > 0 || cashRides.length > 0;
        const existingStatus  = existing.status;

        // ─── Decide branch ──────────────────────────────────
        // Three cases:
        //
        // A) Driver has no live rides AND existing withdrawal is "paid"
        //    or empty → zero everything out (preserve cashOwedBalance ledger).
        //
        // B) Driver has no live rides AND existing withdrawal is "pending"
        //    → all rides on this withdrawal got deleted. Cancel/clear it.
        //
        // C) Driver has live rides → fully REBUILD withdrawal from those
        //    rides (regardless of whether existing is paid/pending/empty).
        //    This is the fix: we no longer "append" — we always rebuild,
        //    so deleted rides naturally fall off.
        // ───────────────────────────────────────────────────

        if (!hasAnyLiveRides) {
          // No live rides for this driver at all
          if (existingStatus === "pending") {
            // CASE B — existing pending withdrawal got emptied by deletions
            batch.update(driverRef, {
              cashOwedBalance: carriedCashOwed, // unchanged; nothing settled
              withdrawal: {
                totalPayout:       0,
                rideCount:         0,
                rideIds:           [],
                rideBreakdown:     [],
                cashFeeOwed:       0,
                cashRideCount:     0,
                cashRideIds:       [],
                cashRideBreakdown: [],
                carriedCashOwed,
                netPayout:         0,
                cashOwedAfter:     carriedCashOwed,
                status:            "cancelled",
                createdAt:         existing.createdAt ?? now,
                updatedAt:         now,
              },
              updatedAt: now,
            });
          } else {
            // CASE A — was paid (or empty), zero out display fields
            batch.update(driverRef, {
              "withdrawal.totalPayout":       0,
              "withdrawal.netPayout":         0,
              "withdrawal.cashFeeOwed":       0,
              "withdrawal.rideCount":         0,
              "withdrawal.rideIds":           [],
              "withdrawal.rideBreakdown":     [],
              "withdrawal.cashRideCount":     0,
              "withdrawal.cashRideIds":       [],
              "withdrawal.cashRideBreakdown": [],
              "withdrawal.updatedAt":         now,
              // cashOwedBalance untouched (ledger)
            });
          }
          continue;
        }

        // CASE C — Driver has live rides. Rebuild entirely.
        batch.update(driverRef, {
          cashOwedBalance: newCashOwedBalance,
          withdrawal: {
            // Stripe (we owe driver)
            totalPayout:       stripePayoutSum,
            rideCount:         stripeRides.length,
            rideIds:           stripeRides.map((r) => r.id),
            rideBreakdown:     stripeRideBreakdown,

            // Cash (driver owes us this cycle)
            cashFeeOwed:       cashFeeOwedSum,
            cashRideCount:     cashRides.length,
            cashRideIds:       cashRides.map((r) => r.id),
            cashRideBreakdown,

            // Carried debt
            carriedCashOwed,

            // Net to transfer
            netPayout,

            // Post-settlement ledger
            cashOwedAfter:     newCashOwedBalance,

            status:    "pending",
            createdAt: existingStatus === "pending"
              ? (existing.createdAt ?? now)
              : now,
            updatedAt: now,
          },
          updatedAt: now,
        });

        // ─── Mark rides as processing ────────────────────────
        for (const ride of allRides) {
          if (ride.payoutStatus !== "processing") {
            batch.update(db.collection("Rides").doc(ride.id), {
              payoutStatus: "processing",
              updatedAt:    now,
            });
          }
        }

        summary.push({
          driverUid:           uid,
          name:                `${driver.firstName ?? ""} ${driver.lastName ?? ""}`.trim(),
          stripeCount:         stripeRides.length,
          cashCount:           cashRides.length,
          stripePayoutSum,
          cashFeeOwedSum,
          carriedCashOwed,
          netPayout,
          newCashOwedBalance,
          rebuilt:             true,
          stripeRideBreakdown,
          cashRideBreakdown,
        });
      }

      // ─────────────────────────────────────────────────────
      // 5) Commit
      // ─────────────────────────────────────────────────────
      await batch.commit();

      if (summary.length === 0) {
        console.log("ℹ️  [withdraw] No active withdrawals — only reconciles ran.");
        return;
      }

      // ─────────────────────────────────────────────────────
      // 6) Pretty log
      // ─────────────────────────────────────────────────────
      console.log(
        `✅ [withdraw] Reconciled ${summary.length} driver(s)\n` +
        summary.map((d) => {
          const lines = [];
          lines.push(`  → ${d.name} (${d.driverUid}) [rebuilt]`);

          if (d.stripeCount > 0) {
            lines.push(`    💳 Stripe payout: $${d.stripePayoutSum.toFixed(2)} (${d.stripeCount} rides)`);
            d.stripeRideBreakdown.forEach((r) => {
              lines.push(`      · [${r.paymentMethod}] ${r.riderName} — ${(r.pickup||"").split(",")[0]} → ${(r.dropoff||"").split(",")[0]} — $${(r.driverPayout||0).toFixed(2)}`);
            });
          }

          if (d.cashCount > 0) {
            lines.push(`    💵 Cash collected: ${d.cashCount} ride(s) — $${d.cashFeeOwedSum.toFixed(2)} fee owed to UaTob`);
            d.cashRideBreakdown.forEach((r) => {
              lines.push(`      · ${r.riderName} — ${(r.pickup||"").split(",")[0]} → ${(r.dropoff||"").split(",")[0]} — $${(r.fareTotal||0).toFixed(2)} fare → $${(r.platformFee||0).toFixed(2)} fee`);
            });
          }

          if (d.carriedCashOwed > 0) {
            lines.push(`    📋 Previous balance: -$${d.carriedCashOwed.toFixed(2)} (carried)`);
          }

          lines.push(`    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          lines.push(
            `    🏦 NET TRANSFER: $${d.netPayout.toFixed(2)}` +
            (d.newCashOwedBalance > 0
              ? ` · ⚠️  Driver still owes $${d.newCashOwedBalance.toFixed(2)} → carried forward`
              : "")
          );

          return lines.join("\n");
        }).join("\n\n")
      );
    } catch (err) {
      console.error("❌ [withdraw]", err);
    }
  }
);
