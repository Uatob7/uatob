// GET|POST /api/drivers/settle-balances?secret=CRON_SECRET
//
// Server-side money ledger. Runs on a schedule (cron-job.org). Sweeps every
// COMPLETED ride that hasn't been accrued yet (balanceSettled != true) and rolls
// it into the driver's running balance — the cash-vs-credit model:
//
//   • cash ride   → driver kept 100% of the fare; they OWE UaTob the 25% fee
//                   → DriverBalance.cashOwed  += platformFee
//   • credit ride → UaTob holds the money, owes the driver 75%
//                   → DriverBalance.platformOwes += driverPayout
//
// Also tracks a per-ride-type breakdown (byType.<rideType>.{cashOwed,
// platformOwes, rides}) so you can see/withdraw what's owed by type. Mirrors the
// running totals onto Drivers/{uid}.cashBalance for the driver UI, and stamps
// each ride balanceSettled:true inside the same transaction so nothing is
// double-counted even if two runs overlap.
//
// Withdrawal itself stays where it is (useSettleDriverCash → Stripe transfer,
// then zeroes platformOwes) — this cron only keeps the books.
//
// Auth: ?secret=CRON_SECRET  (or x-cron-secret header).

import { adminDb, admin } from '@/firebase/admin';

const CRON_SECRET = process.env.CRON_SECRET;
const inc = (n) => admin.firestore.FieldValue.increment(n);
const now = () => admin.firestore.FieldValue.serverTimestamp();

export default async function handler(req, res) {
  const provided = req.query.secret || req.headers['x-cron-secret'];
  if (!CRON_SECRET || provided !== CRON_SECRET) return res.status(401).json({ error: 'unauthorized' });

  const db = adminDb();

  try {
    // Needs a composite index on Rides (status ASC, balanceSettled ASC).
    const snap = await db.collection('Rides')
      .where('status', '==', 'completed')
      .where('balanceSettled', '==', false)
      .limit(100)
      .get();

    const results = [];
    for (const rideSnap of snap.docs) {
      try {
        const out = await db.runTransaction(async (tx) => {
          const fresh = await tx.get(rideSnap.ref);
          if (!fresh.exists) return { skipped: 'gone' };
          const r = fresh.data();
          if (r.status !== 'completed') return { skipped: r.status };
          if (r.balanceSettled === true) return { skipped: 'already' };

          const driverUid = r.driverUid;
          if (!driverUid) {
            tx.update(rideSnap.ref, { balanceSettled: true, balanceSettledAt: now() });
            return { skipped: 'no_driver' };
          }

          const type   = r.rideType || 'standard';
          const credit = r.paymentMethod === 'credit';
          const payout = Number(r.driverPayout ?? (r.fareTotal != null ? r.fareTotal * 0.75 : 0)) || 0;
          const fee    = Number(r.platformFee  ?? (r.fareTotal != null ? r.fareTotal * 0.25 : 0)) || 0;

          const credOwes = credit ? payout : 0;   // UaTob → driver
          const cashOwes = credit ? 0 : fee;       // driver → UaTob

          // fresh sentinels per write (don't share increment descriptors)
          const ledger = () => ({
            platformOwes: inc(credOwes),
            cashOwed:     inc(cashOwes),
            byType: { [type]: { platformOwes: inc(credOwes), cashOwed: inc(cashOwes), rides: inc(1) } },
            lifetimeRides: inc(1),
            lifetimeCredit: inc(credOwes),
            lifetimeCashFees: inc(cashOwes),
            updatedAt: now(),
          });

          tx.set(db.collection('DriverBalance').doc(driverUid), ledger(), { merge: true });
          tx.set(db.collection('Drivers').doc(driverUid), { cashBalance: ledger() }, { merge: true });
          tx.update(rideSnap.ref, { balanceSettled: true, balanceSettledAt: now() });

          return { driverUid, type, credit, platformOwes: credOwes, cashOwed: cashOwes };
        });
        results.push({ id: rideSnap.id, ...out });
      } catch (e) {
        results.push({ id: rideSnap.id, error: e.message });
      }
    }

    return res.status(200).json({ checked: snap.size, results });
  } catch (e) {
    console.error('[drivers/settle-balances]', e);
    return res.status(500).json({ error: e.message || 'settle-balances failed' });
  }
}
