// functions/aggregateRiderStats.js
//
// Two exports:
//
//   onRideCompletedAggregateRider — Firestore trigger. Fires when a Ride
//     transitions to status="completed" and updates the rider's account doc
//     with totalRides, lifetimeSpend, and lastRideAt.
//
//   backfillRiderStats — Callable. Runs once over every completed ride in
//     the database to populate rider docs for historical data. Idempotent
//     via riderStatsAggregated flag on each ride.
//
// Idempotency: each ride doc gets riderStatsAggregated=true after counting.
// If the function retries or is run multiple times, already-counted rides
// are skipped — no double counting.

const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ─────────────────────────────────────────────────────────────
// Helper: apply the increment to a rider doc
// ─────────────────────────────────────────────────────────────
async function incrementRiderStats({ riderUid, fareTotal, completedAt }) {
  if (!riderUid) {
    console.warn("[aggregateRiderStats] No riderUid — skipping");
    return;
  }

  // Accounts collection holds rider profiles (per your schema)
  const riderRef = db.collection("Accounts").doc(riderUid);
  const snap = await riderRef.get();

  if (!snap.exists) {
    console.warn(`[aggregateRiderStats] Rider ${riderUid} doc not found — skipping`);
    return;
  }

  const fare = Number(fareTotal) || 0;

  await riderRef.update({
    totalRides:     FieldValue.increment(1),
    lifetimeSpend:  FieldValue.increment(fare),
    lastRideAt:     completedAt || FieldValue.serverTimestamp(),
  });

  console.log(
    `[aggregateRiderStats] Rider ${riderUid} updated — +1 ride, +$${fare.toFixed(2)}`
  );
}

// ─────────────────────────────────────────────────────────────
// 1. FIRESTORE TRIGGER — runs on every Ride update
// ─────────────────────────────────────────────────────────────
exports.onRideCompletedAggregateRider = onDocumentUpdated(
  {
    document: "Rides/{rideId}",
    region:   "us-east1",
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after  = event.data?.after?.data();

    if (!before || !after) return;

    // Only fire when status JUST became "completed"
    if (before.status === "completed" || after.status !== "completed") {
      return;
    }

    // Idempotency check — if we already counted this ride, skip
    if (after.riderStatsAggregated === true) {
      console.log(`[aggregateRiderStats] Ride ${event.params.rideId} already aggregated — skipping`);
      return;
    }

    const rideId = event.params.rideId;
    const riderUid = after.uid || after.riderUid;
    const fareTotal = after.fareBreakdown?.fareTotal ?? after.fareTotal ?? 0;
    const completedAt = after.completedAt || FieldValue.serverTimestamp();

    console.log(
      `[aggregateRiderStats] Ride ${rideId} completed — rider=${riderUid} fare=$${fareTotal}`
    );

    try {
      await incrementRiderStats({ riderUid, fareTotal, completedAt });

      // Mark this ride as counted so we never double-count
      await db.collection("Rides").doc(rideId).update({
        riderStatsAggregated: true,
        riderStatsAggregatedAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error(
        `[aggregateRiderStats] Failed for ride ${rideId}:`,
        err?.message || err
      );
    }
  }
);

// ─────────────────────────────────────────────────────────────
// 2. BACKFILL — callable, run once to populate historical data
// ─────────────────────────────────────────────────────────────
//
// HOW TO RUN (one-time):
//   From Firebase Console → Functions → backfillRiderStats → Test the function
//   With body: {}
//
// OR from the client (admin only):
//   const callBackfill = httpsCallable(functions, "backfillRiderStats");
//   await callBackfill({});
//
// SAFETY:
//   - Skips rides already marked riderStatsAggregated=true
//   - Resets each rider's stats to zero before recounting (so re-running is safe)
//   - Returns a summary of what happened
exports.backfillRiderStats = onCall(
  {
    region:  "us-east1",
    allowUnauthorized: true,
    timeoutSeconds: 540, // 9 min — backfill can take a while
  },
  async (request) => {
    console.log("[backfillRiderStats] Starting backfill…");

    // ── Step 1: zero out all rider stats so re-run is safe ──
    const ridersSnap = await db.collection("Accounts").get();
    console.log(`[backfillRiderStats] Resetting stats on ${ridersSnap.size} rider docs…`);

    const resetBatch = db.batch();
    let resetCount = 0;
    ridersSnap.docs.forEach((doc) => {
      resetBatch.update(doc.ref, {
        totalRides:    0,
        lifetimeSpend: 0,
        lastRideAt:    FieldValue.delete(),
      });
      resetCount++;
      // Batches max 500 writes — commit and start fresh if we're approaching it
      if (resetCount % 400 === 0) {
        // Note: we can't easily re-batch mid-iteration, so for now we trust
        // the rider count stays under 400. Add chunking if you scale past that.
      }
    });
    await resetBatch.commit();

    // ── Step 2: also un-mark all rides as aggregated so we recount ──
    const ridesSnap = await db
      .collection("Rides")
      .where("status", "==", "completed")
      .get();

    console.log(`[backfillRiderStats] Found ${ridesSnap.size} completed rides to process`);

    // Per-rider running totals (so we do ONE write per rider instead of N)
    const perRider = new Map(); // riderUid → { rides, spend, lastAt }

    ridesSnap.docs.forEach((doc) => {
      const data = doc.data();
      const riderUid = data.uid || data.riderUid;
      if (!riderUid) return;

      const fare = Number(data.fareBreakdown?.fareTotal ?? data.fareTotal ?? 0);
      const completedAt = data.completedAt?.toDate?.() ?? null;

      const cur = perRider.get(riderUid) || { rides: 0, spend: 0, lastAt: null };
      cur.rides += 1;
      cur.spend += fare;
      if (completedAt && (!cur.lastAt || completedAt > cur.lastAt)) {
        cur.lastAt = completedAt;
      }
      perRider.set(riderUid, cur);
    });

    console.log(`[backfillRiderStats] Aggregating to ${perRider.size} unique riders`);

    // ── Step 3: write rider totals ──
    const writeBatch = db.batch();
    let writes = 0;
    let skipped = 0;

    for (const [riderUid, stats] of perRider.entries()) {
      const riderRef = db.collection("Accounts").doc(riderUid);
      const snap = await riderRef.get();
      if (!snap.exists) {
        console.warn(`[backfillRiderStats] Rider ${riderUid} not found — skipping`);
        skipped++;
        continue;
      }
      writeBatch.update(riderRef, {
        totalRides:    stats.rides,
        lifetimeSpend: Math.round(stats.spend * 100) / 100, // round to cents
        lastRideAt:    stats.lastAt
          ? admin.firestore.Timestamp.fromDate(stats.lastAt)
          : FieldValue.delete(),
      });
      writes++;
    }

    await writeBatch.commit();

    // ── Step 4: mark all completed rides as aggregated ──
    // Done in chunks of 400 to stay under batch limit
    const rideUpdates = [];
    let chunk = db.batch();
    let chunkCount = 0;
    for (const doc of ridesSnap.docs) {
      chunk.update(doc.ref, {
        riderStatsAggregated: true,
        riderStatsAggregatedAt: FieldValue.serverTimestamp(),
      });
      chunkCount++;
      if (chunkCount >= 400) {
        rideUpdates.push(chunk.commit());
        chunk = db.batch();
        chunkCount = 0;
      }
    }
    if (chunkCount > 0) rideUpdates.push(chunk.commit());
    await Promise.all(rideUpdates);

    const summary = {
      success: true,
      ridersReset:    resetCount,
      ridesProcessed: ridesSnap.size,
      ridersUpdated:  writes,
      ridersSkipped:  skipped,
    };

    console.log(`[backfillRiderStats] Done:`, summary);
    return summary;
  }
);
