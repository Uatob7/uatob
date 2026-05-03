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
 * For a CASH ride to count as collected and ready to be reconciled:
 *   - paymentMethod === "cash"
 *   - status === "completed"
 *   - cashCollectedAt is set (driver tapped "Cash collected")
 *   - paymentStatus === "succeeded"
 *
 * For a CARD ride to count:
 *   - paymentMethod !== "cash"  (card | cashapp | applepay | googlepay)
 *   - status === "completed"
 *   - paymentStatus === "succeeded"
 *
 * Both must have payoutStatus === "pending" (not already accumulated).
 */
function isReadyForPayout(ride) {
  if (ride.status !== "completed")            return false;
  if (ride.paymentStatus !== "succeeded")     return false;
  if (ride.payoutStatus && ride.payoutStatus !== "pending") return false;

  if (ride.paymentMethod === "cash") {
    // Cash MUST be collected before we count it
    return !!ride.cashCollectedAt;
  }
  return true;
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
      // 1) Pull every completed + paid ride
      // ─────────────────────────────────────────────────────
      const snap = await db.collection("Rides")
        .where("status",        "==", "completed")
        .where("paymentStatus", "==", "succeeded")
        .get();

      // ─────────────────────────────────────────────────────
      // 2) Group rides per driver, separating card vs cash
      //    Skip rides that aren't ready (e.g. cash without
      //    cashCollectedAt yet).
      // ─────────────────────────────────────────────────────
      const driverMap = {};

      snap.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        const uid  = data.driverUid;
        if (!uid) return;
        if (!isReadyForPayout(data)) return;

        if (!driverMap[uid]) {
          driverMap[uid] = {
            cardRides:        [],
            cashRides:        [],
            cardPayoutSum:    0, // we owe driver
            cashFeeOwedSum:   0, // driver owes us
          };
        }

        if (data.paymentMethod === "cash") {
          driverMap[uid].cashRides.push(data);
          driverMap[uid].cashFeeOwedSum = round2(
            driverMap[uid].cashFeeOwedSum + (data.platformFee || 0)
          );
        } else {
          driverMap[uid].cardRides.push(data);
          driverMap[uid].cardPayoutSum = round2(
            driverMap[uid].cardPayoutSum + (data.driverPayout || 0)
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
        const { cardRides, cashRides, cardPayoutSum, cashFeeOwedSum } = group;

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
        // and 0 card rides, they owe us $X. That doesn't get wiped by a payout
        // event — it carries forward and gets deducted from their NEXT card
        // payout.
        const carriedCashOwed = round2(driver.cashOwedBalance ?? 0);

        // ─── Look up rider names ────────────────────────────
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

        // ─── Build rich breakdowns ──────────────────────────
        const cardRideBreakdown = cardRides.map(r => ({
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
          platformFee:     r.platformFee  ?? 0, // ← this is what they owe us
          cashCollectedAt: r.cashCollectedAt ?? null,
          completedAt:     r.completedAt  ?? null,
          rideType:        r.rideType     ?? "standard",
          paymentMethod:   "cash",
        }));

        // ─── Net the math ───────────────────────────────────
        // cardPayoutSum     = $$$ we OWE driver from card/cashapp/etc
        // cashFeeOwedSum    = $$$ driver OWES us (platform fee on cash they collected)
        // carriedCashOwed   = $$$ driver still owes from earlier cycles
        //
        //   netPayout = cardPayout - cashFeeOwed (this run) - carriedCashOwed
        //
        // If positive → we transfer that amount to their bank
        // If zero/negative → we transfer nothing, and the leftover becomes
        //   the new cashOwedBalance for next cycle.
        const totalCashOwed = round2(cashFeeOwedSum + carriedCashOwed);
        let   netPayout     = round2(cardPayoutSum - totalCashOwed);
        let   newCashOwedBalance = 0;

        if (netPayout < 0) {
          // Driver still owes us after this. Carry it forward.
          newCashOwedBalance = round2(-netPayout);
          netPayout = 0;
        } else {
          // Driver paid off all cash debt with their card payouts.
          newCashOwedBalance = 0;
        }

        // ─── Decide: fresh withdrawal vs accumulate ─────────
        const isPaidOrEmpty = !existing.status || existing.status === "paid";

        if (isPaidOrEmpty) {
          // Fresh
          batch.update(driverRef, {
            cashOwedBalance: newCashOwedBalance,
            withdrawal: {
              // CARD side (what we owe driver)
              totalPayout:       cardPayoutSum,
              rideCount:         cardRides.length,
              rideIds:           cardRides.map(r => r.id),
              rideBreakdown:     cardRideBreakdown,

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
          const mergedCardPayout =
            round2((existing.totalPayout ?? 0) + cardPayoutSum);
          const mergedCashFeeOwed =
            round2((existing.cashFeeOwed ?? 0) + cashFeeOwedSum);
          const mergedCardIds =
            [...(existing.rideIds ?? []), ...cardRides.map(r => r.id)];
          const mergedCardCount =
            (existing.rideCount ?? 0) + cardRides.length;
          const mergedCardBreakdown =
            [...(existing.rideBreakdown ?? []), ...cardRideBreakdown];
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
            round2(mergedCardPayout - totalCashOwedMerged);
          let   mergedCashOwedAfter = 0;

          if (netPayoutMerged < 0) {
            mergedCashOwedAfter = round2(-netPayoutMerged);
            netPayoutMerged = 0;
          }

          batch.update(driverRef, {
            cashOwedBalance: mergedCashOwedAfter,

            "withdrawal.totalPayout":       mergedCardPayout,
            "withdrawal.rideCount":         mergedCardCount,
            "withdrawal.rideIds":           mergedCardIds,
            "withdrawal.rideBreakdown":     mergedCardBreakdown,

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
          cardCount:       cardRides.length,
          cashCount:       cashRides.length,
          cardPayoutSum,
          cashFeeOwedSum,
          carriedCashOwed,
          netPayout,
          newCashOwedBalance,
          merged:          !isPaidOrEmpty,
          cardRideBreakdown,
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

          if (d.cardCount > 0) {
            lines.push(`    💳 Card payout: $${d.cardPayoutSum.toFixed(2)} (${d.cardCount} rides)`);
            d.cardRideBreakdown.forEach(r => {
              lines.push(`      · ${r.riderName} — ${(r.pickup||"").split(",")[0]} → ${(r.dropoff||"").split(",")[0]} — $${(r.driverPayout||0).toFixed(2)}`);
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

          lines.push(
            `    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
          );
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