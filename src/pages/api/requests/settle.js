// GET|POST /api/requests/settle?secret=CRON_SECRET
//
// Called every minute by cron-job.org. Looks at every Request the rider has
// marked as PAYING (status == 'paying', set by useMarkPayment when they tap
// "Pay cash" or "Ride credit") and atomically turns it into a canonical Ride:
//
//   • cash   → Ride is created, settled on arrival.
//   • credit → the poster's Accounts.credit must cover the fare; it's debited
//              in the SAME transaction that writes the Ride. If the balance no
//              longer covers it, the request is bounced back to 'open' with a
//              paymentError so it reappears on the rider's board to top up.
//
// When the Ride is created (immediate, non-scheduled) it is DISPATCHED: nearby
// online drivers are found and written to Rides.candidateDriverUids. The driver
// app (useIncomingRequest) only surfaces a ride to a driver whose uid is in that
// array, so without this step a booked ride would sit in 'searching_driver'
// forever with no real driver ever seeing it.
//
// The transaction re-reads status == 'paying' before acting, so a request is
// never double-converted even if two cron runs overlap.
//
// Auth: pass the shared secret as ?secret=... or header x-cron-secret.
// (Same CRON_SECRET as /api/credit/reconcile.)

import { adminDb, admin } from '@/firebase/admin';

const CRON_SECRET = process.env.CRON_SECRET;

// Platform take-rate — identical to useClaimRequest / useCashPayment so payouts reconcile.
const PLATFORM_RATE = 0.25;

// ── driver dispatch tunables ─────────────────────────────────────────────────
const DISPATCH_RADIUS_MI     = 20;          // starting search radius
const MAX_DISPATCH_RADIUS_MI = 100;         // hard ceiling as the search widens
const WIDEN_EVERY_MIN        = 1;           // grow the radius once per minute unaccepted
const WIDEN_STEP_MI          = 15;          // …by this much each step
const MAX_CANDIDATES         = 8;           // cap how many drivers get the request
const DRIVER_STALE_MS        = 30 * 60_000; // ignore "online" drivers not seen in 30 min

// Radius for a ride that's been searching `elapsedMin` minutes.
function radiusForElapsed(elapsedMin) {
  const grown = DISPATCH_RADIUS_MI + Math.floor(Math.max(0, elapsedMin) / WIDEN_EVERY_MIN) * WIDEN_STEP_MI;
  return Math.min(MAX_DISPATCH_RADIUS_MI, grown);
}

function haversineMi(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return Infinity;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function tsMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts._seconds) return ts._seconds * 1000;
  if (ts.seconds)  return ts.seconds * 1000;
  return 0;
}

// Find the nearest online drivers to a pickup point. Runs OUTSIDE the ride
// transaction (Firestore transactions can't run queries), so the result is a
// best-effort snapshot — useAcceptRide re-validates the ride is still open.
async function findCandidateDrivers(db, pickup, radiusMi = DISPATCH_RADIUS_MI) {
  if (!pickup || pickup.lat == null || pickup.lng == null) return [];
  const snap = await db.collection('Drivers').where('status', '==', 'online').limit(100).get();
  const now = Date.now();
  return snap.docs
    .map((d) => ({ uid: d.id, ...d.data() }))
    .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng))
    .filter((d) => {
      const seen = tsMillis(d.lastSeenAt || d.lastLocationAt || d.presenceUpdatedAt);
      return seen === 0 || now - seen <= DRIVER_STALE_MS;   // keep if fresh or no timestamp
    })
    .map((d) => ({ uid: d.uid, mi: haversineMi(pickup, { lat: d.lat, lng: d.lng }) }))
    .filter((d) => d.mi <= radiusMi)
    .sort((a, b) => a.mi - b.mi)
    .slice(0, MAX_CANDIDATES)
    .map((d) => d.uid);
}

export default async function handler(req, res) {
  const provided = req.query.secret || req.headers['x-cron-secret'];
  if (!CRON_SECRET || provided !== CRON_SECRET) return res.status(401).json({ error: 'unauthorized' });

  const db = adminDb();

  try {
    // Single-field query → no composite index required.
    const snap = await db.collection('Requests').where('status', '==', 'paying').limit(50).get();

    const results = [];
    for (const docSnap of snap.docs) {
      try {
        // Dispatch: find nearby online drivers BEFORE the transaction (Firestore
        // transactions can't run queries). Skip for scheduled rides — those get
        // dispatched closer to their pickup time, not now.
        const d0 = docSnap.data();
        const willSchedule = d0.isScheduled === true && !!d0.scheduledAt;
        const candidateDriverUids = willSchedule
          ? []
          : await findCandidateDrivers(db, { lat: d0.pickupLat, lng: d0.pickupLng });

        const outcome = await db.runTransaction(async (tx) => {
          const fresh = await tx.get(docSnap.ref);
          if (!fresh.exists) return { skipped: 'gone' };
          const r = fresh.data();
          if (r.status !== 'paying') return { skipped: r.status };   // already handled / cancelled

          const method    = r.payWith === 'credit' ? 'credit' : 'cash';
          const payerUid  = r.payerUid || r.uid;
          const fareTotal = Number(r.fareEstimate || 0);

          // Ride credit is prepaid — verify the balance still covers the fare,
          // then debit inside this same transaction.
          let accountRef = null;
          if (method === 'credit') {
            accountRef = db.collection('Accounts').doc(payerUid);
            const acc = await tx.get(accountRef);
            const balance = Number(acc.exists ? (acc.data().credit || 0) : 0);
            if (balance < fareTotal) {
              // Bounce back onto the board so the rider can top up.
              tx.update(docSnap.ref, {
                status:       'open',
                payWith:      null,
                paymentError: 'insufficient_credit',
                updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
              });
              return { bounced: 'insufficient_credit', balance, fare: fareTotal };
            }
          }

          const platformFee  = +(fareTotal * PLATFORM_RATE).toFixed(2);
          const driverPayout = +(fareTotal * (1 - PLATFORM_RATE)).toFixed(2);

          const scheduled      = r.isScheduled === true && !!r.scheduledAt;
          const rideStatus     = scheduled ? 'scheduled' : 'searching_driver';
          const paymentStatus  = method === 'credit' ? 'paid' : 'succeeded';

          const rideRef = db.collection('Rides').doc();   // pre-allocate id

          // Canonical Ride — mirrors useClaimRequest / useCashPayment.
          tx.set(rideRef, {
            uid:       payerUid,     // the paying rider (poster) — drives useRides + tracking
            posterUid: r.uid,
            paidBy:    payerUid,
            requestId: docSnap.id,

            pickup:      r.pickup      ?? null,
            dropoff:     r.dropoff     ?? null,
            pickupCity:  r.pickupCity  ?? null,
            pickupZip:   r.pickupZip   ?? null,
            pickupLat:   r.pickupLat   ?? null,
            pickupLng:   r.pickupLng   ?? null,
            dropoffCity: r.dropoffCity ?? null,
            dropoffZip:  r.dropoffZip  ?? null,
            dropoffLat:  r.dropoffLat  ?? null,
            dropoffLng:  r.dropoffLng  ?? null,
            polyline:    r.polyline    ?? null,

            rideType:  r.rideType  ?? 'standard',
            rideLabel: r.rideLabel ?? null,

            fareTotal,
            platformFee,
            driverPayout,

            tripDistanceMiles: r.tripDistanceMiles ?? null,
            tripDurationMin:   r.tripDurationMin   ?? null,
            fareBreakdown:     r.fareBreakdown     ?? null,

            isScheduled:    scheduled,
            scheduledAt:    scheduled ? r.scheduledAt : null,
            promoCode:      null,
            discountAmount: null,
            match:          [],

            // ── driver dispatch ──────────────────────────────────────────────
            // Nearby online drivers who may claim this ride. useIncomingRequest
            // (driver app) filters on `candidateDriverUids array-contains uid`,
            // so this is what actually puts the ride in front of real drivers.
            candidateDriverUids: candidateDriverUids,
            driverUid:           null,
            dispatchedAt:        scheduled ? null : admin.firestore.FieldValue.serverTimestamp(),

            paymentMethod:  method,
            paymentStatus,
            creditCharged:  method === 'credit' ? fareTotal : null,
            paymentIntentId: null,

            // Ledger flag — the /api/drivers/settle-balances cron accrues this
            // ride into the driver's balance once it's completed, then flips it.
            balanceSettled: false,

            status:    rideStatus,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Lock the request.
          tx.update(docSnap.ref, {
            status:        'claimed',
            claimedBy:     payerUid,
            rideId:        rideRef.id,
            paymentMethod: method,
            paymentError:  null,
            settledAt:     admin.firestore.FieldValue.serverTimestamp(),
            updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
          });

          // Debit prepaid credit.
          if (accountRef) {
            tx.update(accountRef, {
              credit:    admin.firestore.FieldValue.increment(-fareTotal),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          return { rideId: rideRef.id, method, fare: fareTotal, dispatchedTo: candidateDriverUids.length };
        });

        results.push({ id: docSnap.id, ...outcome });
      } catch (e) {
        results.push({ id: docSnap.id, error: e.message });
      }
    }

    // ── PASS 2 · keep searching + widen ──────────────────────────────────────
    // Rides still hunting for a driver get re-dispatched every run: refresh the
    // candidate set (so drivers who just came online are included) and grow the
    // radius the longer the ride has gone unaccepted. A transaction re-checks the
    // ride is still unassigned so we never stomp a driver who accepted mid-run.
    const redispatch = [];
    const searching = await db.collection('Rides').where('status', '==', 'searching_driver').limit(50).get();
    for (const rideSnap of searching.docs) {
      try {
        const ride = rideSnap.data();
        if (ride.driverUid) continue;                       // already taken
        if (ride.pickupLat == null || ride.pickupLng == null) continue;

        const startedMs  = tsMillis(ride.dispatchedAt || ride.createdAt);
        const elapsedMin = startedMs ? (Date.now() - startedMs) / 60_000 : 0;
        const radius     = radiusForElapsed(elapsedMin);
        const candidates = await findCandidateDrivers(db, { lat: ride.pickupLat, lng: ride.pickupLng }, radius);

        const out = await db.runTransaction(async (tx) => {
          const fresh = await tx.get(rideSnap.ref);
          if (!fresh.exists) return { skipped: 'gone' };
          const fr = fresh.data();
          if (fr.status !== 'searching_driver' || fr.driverUid) return { skipped: fr.status };
          tx.update(rideSnap.ref, {
            candidateDriverUids: candidates,
            dispatchRadiusMi:    radius,
            dispatchAttempts:    (fr.dispatchAttempts || 0) + 1,
            lastDispatchAt:      admin.firestore.FieldValue.serverTimestamp(),
            updatedAt:           admin.firestore.FieldValue.serverTimestamp(),
          });
          return { candidates: candidates.length, radiusMi: radius };
        });
        redispatch.push({ rideId: rideSnap.id, ...out });
      } catch (e) {
        redispatch.push({ rideId: rideSnap.id, error: e.message });
      }
    }

    return res.status(200).json({
      checked: snap.size, results,
      searching: searching.size, redispatch,
    });
  } catch (e) {
    console.error('[requests/settle]', e);
    return res.status(500).json({ error: e.message || 'settle failed' });
  }
}
