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
 * STRIPE-COLLECTED rides (card / cashapp / applepay / googlepay):
 *   - status === "completed"
 *   - paymentStatus === "succeeded"  (Stripe captured the money)
 *   - payoutStatus is empty OR "pending"
 *
 * CASH rides:
 *   - status === "completed"  (driver delivered the rider)
 *   - paymentMethod === "cash"
 *   - payoutStatus is empty OR "pending"
 *   - paymentStatus is IGNORED — there's no Stripe paymentStatus for cash;
 *     the proof of "money received" is that the driver completed the trip
 *     (we trust the driver tapped "Cash collected" to mark complete)
 */
function isReadyForPayout(ride) {
  if (ride.status !== "completed") return false;

  // Already processed or paid — skip
  if (ride.payoutStatus && ride.payoutStatus !== "pending") return false;

  if (ride.paymentMethod === "cash") {
    // Cash: completed status IS the proof of collection
    return true;
  }

  // Stripe-collected: must show captured payment
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
      //    (Note: removed paymentStatus filter — we filter
      //     in JS so cash rides don't get excluded)
      // ─────────────────────────────────────────────────────
      const snap = await db.collection("Rides")
        .where("status", "==", "completed")
        .get();

      // ─────────────────────────────────────────────────────
      // 2) Group rides per driver, separating Stripe vs cash
      // ─────────────────────────────────────────────────────
      const driverMap = {};

      snap.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        const uid  = data.driverUid;
        if (!uid) return;
        if (!isReadyForPayout(data)) return;

        if (!driverMap[uid]) {
          driverMap[uid] = {
            stripeRides:    [],   // card | cashapp | applepay | googlepay (we owe driver)
            cashRides:      [],   // cash (driver owes us platform fee)
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

      const now    = admin.firestore.Timestamp.now();
      const batch  = db.batch();
      const summary = [];

      // ─────────────────────────────────────────────────────
      // 3) Zero out drivers who were "paid" and have no new rides
      //    (so the dashboard shows $0 and not stale numbers)
      //    BUT preserve any carried-forward cashOwedBalance.
      // ─────────────────────────────────────────────────────
      const allDriversWithWithdrawal = await db.collection("Drivers")
        .where("withdrawal.status", "==", "paid")
        .get();

      allDriversWithWithdrawal.forEach((doc) => {
        const uid = doc.id;
        if (!driverMap[uid]) {
          batch.update(db.collection("Drivers").doc(uid), {
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
            // ⚠️ cashOwedBalance NOT zeroed — that's a long-running ledger
          });
        }
      });

      // ─────────────────────────────────────────────────────
      // 4) Process each driver
      // ─────────────────────────────────────────────────────
      for (const [uid, group] of Object.entries(driverMap)) {
        const { stripeRides, cashRides, stripePayoutSum, cashFeeOwedSum } = group;

        const driverSnap = await db.collection("Drivers").doc(uid).get();
        if (!driverSnap.exists) {
          console.warn(`⚠️  [withdraw] Driver doc not found: ${uid} — skipping`);
          continue;
        }

        const driver         = driverSnap.data();
        const existing       = driver.withdrawal || {};
        const driverRef      = db.collection("Drivers").doc(uid);

        // ─── Carry-forward balance ──────────────────────────
        // cashOwedBalance is a long-lived ledger. If a driver did 5 cash rides
        // and 0 stripe rides, they owe us $X. That doesn't get wiped by a
        // payout event — it carries forward and gets deducted from their NEXT
        // stripe payout.
        const carriedCashOwed = round2(driver.cashOwedBalance ?? 0);

        // ─── Look up rider names ────────────────────────────
        const allRides  = [...stripeRides, ...cashRides];
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

        // ─── Build rich breakdowns ──────────────────────────
        const stripeRideBreakdown = stripeRides.map(r => ({
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

        const cashRideBreakdown = cashRides.map(r => ({
          rideId:          r.id,
          riderUid:        r.uid          ?? null,
          riderName:       riderNameMap[r.uid] ?? "Unknown",
          pickup:          r.pickup       ?? "",
          dropoff:         r.dropoff      ?? "",
          fareTotal:       r.fareTotal    ?? 0,
          driverPayout:    r.driverPayout ?? 0, // already in driver's pocket
          platformFee:     r.platformFee  ?? 0, // ← what they owe us
          completedAt:     r.completedAt  ?? null,
          rideType:        r.rideType     ?? "standard",
          paymentMethod:   "cash",
        }));

        // ─── Net the math ───────────────────────────────────
        // stripePayoutSum  = $$$ we OWE driver (card/cashapp/etc)
        // cashFeeOwedSum   = $$$ driver OWES us this cycle (cash platform fees)
        // carriedCashOwed  = $$$ driver still owes from earlier cycles
        //
        //   netPayout = stripePayout - cashFeeOwed (this run) - carriedCashOwed
        //
        // If positive → we transfer that amount to their bank
        // If zero/negative → we transfer nothing, leftover carries forward.
        const totalCashOwed = round2(cashFeeOwedSum + carriedCashOwed);
        let   netPayout     = round2(stripePayoutSum - totalCashOwed);
        let   newCashOwedBalance = 0;

        if (netPayout < 0) {
          newCashOwedBalance = round2(-netPayout);
          netPayout = 0;
        } else {
          newCashOwedBalance = 0;
        }

        // ─── Decide: fresh withdrawal vs accumulate ─────────
        const isPaidOrEmpty = !existing.status || existing.status === "paid";

        if (isPaidOrEmpty) {
          // Fresh
          batch.update(driverRef, {
            cashOwedBalance: newCashOwedBalance,
            withdrawal: {
              // STRIPE side (what we owe driver)
              totalPayout:       stripePayoutSum,
              rideCount:         stripeRides.length,
              rideIds:           stripeRides.map(r => r.id),
              rideBreakdown:     stripeRideBreakdown,

              // CASH side (what driver owes us this cycle)
              cashFeeOwed:       cashFeeOwedSum,
              cashRideCount:     cashRides.length,
              cashRideIds:       cashRides.map(r => r.id),
              cashRideBreakdown,

              // Carried debt from earlier cycles
              carriedCashOwed,

              // Net (what actually transfers to driver's bank)
              netPayout,

              // After settlement, what's left on the ledger
              cashOwedAfter: newCashOwedBalance,

              status:    "pending",
              createdAt: now,
              updatedAt: now,
            },
            updatedAt: now,
          });
        } else {
          // Accumulate into existing pending withdrawal
          const mergedStripePayout =
            round2((existing.totalPayout ?? 0) + stripePayoutSum);
          const mergedCashFeeOwed =
            round2((existing.cashFeeOwed ?? 0) + cashFeeOwedSum);
          const mergedStripeIds =
            [...(existing.rideIds ?? []), ...stripeRides.map(r => r.id)];
          const mergedStripeCount =
            (existing.rideCount ?? 0) + stripeRides.length;
          const mergedStripeBreakdown =
            [...(existing.rideBreakdown ?? []), ...stripeRideBreakdown];
          const mergedCashIds =
            [...(existing.cashRideIds ?? []), ...cashRides.map(r => r.id)];
          const mergedCashCount =
            (existing.cashRideCount ?? 0) + cashRides.length;
          const mergedCashBreakdown =
            [...(existing.cashRideBreakdown ?? []), ...cashRideBreakdown];

          // Recompute net using merged totals + (still-carried) cash debt
          const totalCashOwedMerged =
            round2(mergedCashFeeOwed + carriedCashOwed);
          let   netPayoutMerged =
            round2(mergedStripePayout - totalCashOwedMerged);
          let   mergedCashOwedAfter = 0;

          if (netPayoutMerged < 0) {
            mergedCashOwedAfter = round2(-netPayoutMerged);
            netPayoutMerged = 0;
          }

          batch.update(driverRef, {
            cashOwedBalance: mergedCashOwedAfter,

            "withdrawal.totalPayout":       mergedStripePayout,
            "withdrawal.rideCount":         mergedStripeCount,
            "withdrawal.rideIds":           mergedStripeIds,
            "withdrawal.rideBreakdown":     mergedStripeBreakdown,

            "withdrawal.cashFeeOwed":       mergedCashFeeOwed,
            "withdrawal.cashRideCount":     mergedCashCount,
            "withdrawal.cashRideIds":       mergedCashIds,
            "withdrawal.cashRideBreakdown": mergedCashBreakdown,

            "withdrawal.carriedCashOwed":   carriedCashOwed,
            "withdrawal.netPayout":         netPayoutMerged,
            "withdrawal.cashOwedAfter":     mergedCashOwedAfter,

            "withdrawal.updatedAt":         now,
            updatedAt:                      now,
          });
        }

        // ─── Mark every ride as processing ──────────────────
        for (const ride of allRides) {
          batch.update(db.collection("Rides").doc(ride.id), {
            payoutStatus: "processing",
            updatedAt:    now,
          });
        }

        summary.push({
          driverUid:       uid,
          name:            `${driver.firstName ?? ""} ${driver.lastName ?? ""}`.trim(),
          stripeCount:     stripeRides.length,
          cashCount:       cashRides.length,
          stripePayoutSum,
          cashFeeOwedSum,
          carriedCashOwed,
          netPayout,
          newCashOwedBalance,
          merged:          !isPaidOrEmpty,
          stripeRideBreakdown,
          cashRideBreakdown,
        });
      }

      // ─────────────────────────────────────────────────────
      // 5) Commit
      // ─────────────────────────────────────────────────────
      await batch.commit();

      if (summary.length === 0) {
        console.log("ℹ️  [withdraw] No new payouts to process.");
        return;
      }

      // ─────────────────────────────────────────────────────
      // 6) Pretty log
      // ─────────────────────────────────────────────────────
      console.log(
        `✅ [withdraw] Processed ${summary.length} driver(s)\n` +
        summary.map(d => {
          const lines = [];
          lines.push(`  → ${d.name} (${d.driverUid}) ${d.merged ? "[merged]" : "[new]"}`);

          if (d.stripeCount > 0) {
            lines.push(`    💳 Stripe payout: $${d.stripePayoutSum.toFixed(2)} (${d.stripeCount} rides)`);
            d.stripeRideBreakdown.forEach(r => {
              lines.push(`      · [${r.paymentMethod}] ${r.riderName} — ${(r.pickup||"").split(",")[0]} → ${(r.dropoff||"").split(",")[0]} — $${(r.driverPayout||0).toFixed(2)}`);
            });
          }

          if (d.cashCount > 0) {
            lines.push(`    💵 Cash collected: ${d.cashCount} ride(s) — $${d.cashFeeOwedSum.toFixed(2)} fee owed to UaTob`);
            d.cashRideBreakdown.forEach(r => {
              lines.push(`      · ${r.riderName} — ${(r.pickup||"").split(",")[0]} → ${(r.dropoff||"").split(",")[0]} — $${(r.fareTotal||0).toFixed(2)} fare → $${(r.platformFee||0).toFixed(2)} fee`);
            });
          }

          if (d.carriedCashOwed > 0) {
            lines.push(`    📋 Previous balance: -$${d.carriedCashOwed.toFixed(2)} (carried from prior cycle)`);
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