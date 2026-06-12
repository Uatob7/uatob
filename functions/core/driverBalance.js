// functions/core/driverBalance.js
//
// Runs every 1 minute — two phases:
//   Phase 1 — cursor-based: process newly completed rides, accumulate ledger
//   Phase 2 — full sync:    push every DriverBalance doc → Drivers.cashBalance
//
// Fee model (25%):
//   cash      → driver physically collected fareTotal; they OWE us platformFee
//   card/cashapp → payment already processed; platform collected fee;
//                  any outstanding cash debt is auto-absorbed on each ride

const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin          = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const PLATFORM_PCT = 0.25;
const RIDE_LIMIT   = 400;
const CONFIG_DOC   = db.collection("_config").doc("driverBalance");

const round2 = v => Math.round((v ?? 0) * 100) / 100;

function normalizeMethod(raw) {
  return (raw ?? "").toLowerCase().replace(/[\s_-]/g, "");
}

function tsMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (typeof ts === "number") return ts;
  return 0;
}

// Commit an array of batches sequentially
async function commitAll(batches) {
  for (const b of batches) await b.commit();
}

// Returns [activeBatch, allBatches] — auto-splits when approaching 400 ops
function makeBatcher() {
  const batches = [db.batch()];
  let count = 0;
  const add = (fn) => {
    if (count > 0 && count % 400 === 0) batches.push(db.batch());
    fn(batches[batches.length - 1]);
    count++;
  };
  return { add, batches };
}

exports.driverBalance = onSchedule(
  { schedule: "every 1 minutes", timeZone: "America/New_York", region: "us-central1" },
  async () => {

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1 — process new completed rides since last run
    // ═══════════════════════════════════════════════════════════════════════

    const configSnap = await CONFIG_DOC.get();
    const lastRunAt  = configSnap.exists ? configSnap.data().lastRunAt : null;

    let q = db.collection("Rides")
      .where("status",        "==", "completed")
      .where("paymentStatus", "==", "succeeded");

    if (lastRunAt) q = q.where("updatedAt", ">", lastRunAt);
    q = q.orderBy("updatedAt", "asc").limit(RIDE_LIMIT);

    const rideSnap = await q.get();
    let   latestTs = lastRunAt;

    if (!rideSnap.empty) {
      // Group rides by driver
      const byDriver = {};
      rideSnap.forEach(doc => {
        const data = doc.data();
        const uid  = data.driverUid;
        if (!uid) return;
        if (!byDriver[uid]) byDriver[uid] = [];
        byDriver[uid].push({ id: doc.id, ...data });
        const ts = data.updatedAt;
        if (ts && tsMillis(ts) > tsMillis(latestTs)) latestTs = ts;
      });

      const { add, batches } = makeBatcher();

      for (const [driverUid, rides] of Object.entries(byDriver)) {
        const ledgerRef  = db.collection("DriverBalance").doc(driverUid);
        const ledgerSnap = await ledgerRef.get();
        const ex         = ledgerSnap.exists ? ledgerSnap.data() : {};

        const led = {
          driverUid,
          totalCompletedRides:  ex.totalCompletedRides  ?? 0,
          totalFareRevenue:     ex.totalFareRevenue      ?? 0,
          totalPlatformFees:    ex.totalPlatformFees     ?? 0,
          totalDriverEarned:    ex.totalDriverEarned     ?? 0,
          cashRides:            ex.cashRides             ?? 0,
          cardRides:            ex.cardRides             ?? 0,
          cashAppRides:         ex.cashAppRides          ?? 0,
          cardRidesPending:     ex.cardRidesPending      ?? 0,
          cashAppRidesPending:  ex.cashAppRidesPending   ?? 0,
          cashOwed:             ex.cashOwed              ?? 0,
          cashOwedLifetime:     ex.cashOwedLifetime      ?? 0,
          cashSettledLifetime:  ex.cashSettledLifetime   ?? 0,
          platformOwes:         ex.platformOwes          ?? 0,
          platformOwesLifetime: ex.platformOwesLifetime  ?? 0,
          platformOwesSettled:  ex.platformOwesSettled   ?? 0,
          lastRideAt:           ex.lastRideAt            ?? null,
          lastSettledAt:        ex.lastSettledAt         ?? null,
        };

        rides.sort((a, b) => tsMillis(a.updatedAt) - tsMillis(b.updatedAt));

        for (const ride of rides) {
          const fareTotal    = Number(ride.fareTotal   ?? 0);
          const platformFee  = Number(ride.platformFee ?? round2(fareTotal * PLATFORM_PCT));
          const driverPayout = Number(ride.driverPayout ?? round2(fareTotal - platformFee));
          const method       = normalizeMethod(ride.paymentMethod);
          const rideTs       = ride.updatedAt ?? null;

          led.totalCompletedRides++;
          led.totalFareRevenue  += fareTotal;
          led.totalPlatformFees += platformFee;
          led.lastRideAt         = rideTs;

          if (method === "cash") {
            led.cashRides++;
            led.totalDriverEarned += fareTotal;
            led.cashOwed          += platformFee;
            led.cashOwedLifetime  += platformFee;

          } else if (method === "card" || method === "cashapp") {
            if (method === "card") { led.cardRides++; led.cardRidesPending++; }
            else                   { led.cashAppRides++; led.cashAppRidesPending++; }

            led.totalDriverEarned    += driverPayout;
            led.platformOwes         += driverPayout;
            led.platformOwesLifetime += driverPayout;

            if (led.cashOwed > 0) {
              const absorbed = Math.min(led.cashOwed, led.platformOwes);
              led.cashOwed            -= absorbed;
              led.cashSettledLifetime += absorbed;
              led.platformOwes        -= absorbed;
              if (absorbed > 0) led.lastSettledAt = rideTs;
            }
          }
        }

        // Round all money fields
        led.cashOwed             = round2(led.cashOwed);
        led.cashOwedLifetime     = round2(led.cashOwedLifetime);
        led.cashSettledLifetime  = round2(led.cashSettledLifetime);
        led.platformOwes         = round2(led.platformOwes);
        led.platformOwesLifetime = round2(led.platformOwesLifetime);
        led.platformOwesSettled  = round2(led.platformOwesSettled);
        led.totalFareRevenue     = round2(led.totalFareRevenue);
        led.totalPlatformFees    = round2(led.totalPlatformFees);
        led.totalDriverEarned    = round2(led.totalDriverEarned);
        led.updatedAt            = admin.firestore.FieldValue.serverTimestamp();

        add(b => b.set(ledgerRef, led, { merge: true }));
      }

      // Advance cursor
      add(b => b.set(CONFIG_DOC, { lastRunAt: latestTs ?? admin.firestore.Timestamp.now() }, { merge: true }));

      await commitAll(batches);

      console.log(`[driverBalance] phase1: ${rideSnap.size} rides, ${Object.keys(byDriver).length} drivers`);

    } else {
      // No new rides — still advance cursor
      await CONFIG_DOC.set({ lastRunAt: admin.firestore.Timestamp.now() }, { merge: true });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2 — sync every DriverBalance doc → Drivers.cashBalance
    //           runs every minute regardless of new rides
    // ═══════════════════════════════════════════════════════════════════════

    const allBalSnap = await db.collection("DriverBalance").get();
    if (allBalSnap.empty) return;

    const { add, batches } = makeBatcher();
    const now = admin.firestore.FieldValue.serverTimestamp();

    allBalSnap.forEach(snap => {
      const led       = snap.data();
      const driverUid = snap.id;

      add(b => b.update(db.collection("Drivers").doc(driverUid), {
        "cashBalance.cashOwed":            led.cashOwed            ?? 0,
        "cashBalance.cashOwedLifetime":    led.cashOwedLifetime    ?? 0,
        "cashBalance.platformOwes":        led.platformOwes        ?? 0,
        "cashBalance.platformOwesSettled": led.platformOwesSettled ?? 0,
        "cashBalance.totalCompletedRides": led.totalCompletedRides ?? 0,
        "cashBalance.cashRides":            led.cashRides            ?? 0,
        "cashBalance.cardRides":           led.cardRides            ?? 0,
        "cashBalance.cashAppRides":        led.cashAppRides         ?? 0,
        "cashBalance.cardRidesPending":    led.cardRidesPending     ?? 0,
        "cashBalance.cashAppRidesPending": led.cashAppRidesPending  ?? 0,
        "cashBalance.totalFareRevenue":    led.totalFareRevenue    ?? 0,
        "cashBalance.totalDriverEarned":   led.totalDriverEarned   ?? 0,
        "cashBalance.lastRideAt":          led.lastRideAt          ?? null,
        "cashBalance.lastSettledAt":       led.lastSettledAt       ?? null,
        "cashBalance.settlementStatus":    led.settlement?.status  ?? null,
        "cashBalance.updatedAt":           now,
      }));
    });

    await commitAll(batches);

    console.log(`[driverBalance] phase2: synced ${allBalSnap.size} driver(s)`);
  }
);
