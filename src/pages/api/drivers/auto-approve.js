// GET|POST /api/drivers/auto-approve?secret=CRON_SECRET
//
// Called on a schedule by cron-job.org. Auto-approves driver applications that
// have been pending for at least AUTO_APPROVE_AFTER_MIN minutes: flips
// Drivers.status 'pending' → 'approved' so the driver can go online. Once online
// the driver app manages status ('online'/'offline'), so this only ever acts on
// the one-time pending→approved transition.
//
// Auth: pass the shared secret as ?secret=... or header x-cron-secret.
// (Same CRON_SECRET as the other cron endpoints.)

import { adminDb, admin } from '@/firebase/admin';

const CRON_SECRET = process.env.CRON_SECRET;

const AUTO_APPROVE_AFTER_MIN = 7;
const AUTO_APPROVE_AFTER_MS  = AUTO_APPROVE_AFTER_MIN * 60_000;

function tsMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts._seconds) return ts._seconds * 1000;
  if (ts.seconds)  return ts.seconds * 1000;
  return 0;
}

export default async function handler(req, res) {
  const provided = req.query.secret || req.headers['x-cron-secret'];
  if (!CRON_SECRET || provided !== CRON_SECRET) return res.status(401).json({ error: 'unauthorized' });

  const db = adminDb();

  try {
    // Single-field query → no composite index required.
    const snap = await db.collection('Drivers').where('status', '==', 'pending').limit(100).get();

    const now = Date.now();
    const results = [];

    for (const docSnap of snap.docs) {
      const d = docSnap.data();
      const since = tsMillis(d.submittedAt || d.createdAt);
      const ageMs = since ? now - since : 0;

      // Not old enough yet — leave it pending.
      if (!since || ageMs < AUTO_APPROVE_AFTER_MS) {
        results.push({ id: docSnap.id, skipped: 'too_new', waitedMin: since ? Math.floor(ageMs / 60_000) : null });
        continue;
      }

      try {
        // Transaction re-checks it's still pending so we never override a manual
        // decision (approved/rejected/suspended) made in the meantime.
        const outcome = await db.runTransaction(async (tx) => {
          const fresh = await tx.get(docSnap.ref);
          if (!fresh.exists) return { skipped: 'gone' };
          if (fresh.data().status !== 'pending') return { skipped: fresh.data().status };
          tx.update(docSnap.ref, {
            status:       'approved',
            approvedAt:   admin.firestore.FieldValue.serverTimestamp(),
            approvedBy:   'auto',
            updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
          });
          return { approved: true };
        });
        results.push({ id: docSnap.id, ...outcome });
      } catch (e) {
        results.push({ id: docSnap.id, error: e.message });
      }
    }

    return res.status(200).json({ checked: snap.size, results });
  } catch (e) {
    console.error('[drivers/auto-approve]', e);
    return res.status(500).json({ error: e.message || 'auto-approve failed' });
  }
}
