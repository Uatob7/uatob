// GET|POST /api/credit/reconcile?secret=CRON_SECRET
// Called on a schedule by cron-job.org. Looks at every PENDING top-up, asks
// Stripe whether its Checkout Session is paid, and — only then — atomically
// adds the credit to the rider's account and marks the top-up settled. The
// transaction guards against double-crediting if the cron runs concurrently.
//
// Auth: pass the shared secret as ?secret=... or header x-cron-secret.

import { adminDb, admin } from '@/firebase/admin';

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req, res) {
  const provided = req.query.secret || req.headers['x-cron-secret'];
  if (!CRON_SECRET || provided !== CRON_SECRET) return res.status(401).json({ error: 'unauthorized' });
  if (!STRIPE_SECRET) return res.status(500).json({ error: 'Stripe is not configured' });

  const db = adminDb();

  try {
    // Single-field query → no composite index required.
    const snap = await db.collection('CreditTopups').where('status', '==', 'pending').limit(50).get();

    const results = [];
    for (const docSnap of snap.docs) {
      const t = docSnap.data();
      if (t.credited || !t.sessionId) continue;
      try {
        const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${t.sessionId}`, {
          headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
        });
        const session = await r.json();
        if (session.error) { results.push({ id: docSnap.id, error: session.error.message }); continue; }

        if (session.payment_status === 'paid') {
          await db.runTransaction(async (tx) => {
            const fresh = await tx.get(docSnap.ref);
            const fd = fresh.data();
            if (!fresh.exists || fd.credited) return;           // already handled
            const accRef = db.collection('Accounts').doc(fd.uid);
            tx.set(accRef, {
              credit: admin.firestore.FieldValue.increment(Number(fd.amount) || 0),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            tx.update(docSnap.ref, {
              credited: true,
              status: 'paid',
              paymentIntentId: session.payment_intent || null,
              paidAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          });
          results.push({ id: docSnap.id, credited: t.amount });
        } else if (session.status === 'expired') {
          await docSnap.ref.update({ status: 'expired' });
          results.push({ id: docSnap.id, expired: true });
        } else {
          results.push({ id: docSnap.id, pending: session.payment_status });
        }
      } catch (e) {
        results.push({ id: docSnap.id, error: e.message });
      }
    }

    return res.status(200).json({ checked: snap.size, results });
  } catch (e) {
    console.error('[credit/reconcile]', e);
    return res.status(500).json({ error: e.message || 'reconcile failed' });
  }
}
