// POST /api/requests/settle-one   { requestId }
//
// Instant, rider-triggered settlement. Called by the client the moment a rider
// taps "Pay cash" / "Ride credit" so their request becomes a real Ride and gets
// dispatched right away — no waiting for the every-minute /api/requests/settle
// cron. Both share settleOneRequest(), whose transaction re-checks
// status == 'paying', so the instant call and the cron can never double-convert.
//
// No secret needed: this only converts a request the rider has ALREADY marked
// as paying (which the cron would do anyway). It cannot settle anything that
// isn't already in the 'paying' state, and for credit it debits the poster's own
// prepaid balance exactly as the cron does.

import { adminDb } from '@/firebase/admin';
import { settleOneRequest } from '@/pages/api/requests/settle';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const requestId = req.body?.requestId || req.query?.requestId;
  if (!requestId) return res.status(400).json({ error: 'missing_requestId' });

  try {
    const db  = adminDb();
    const ref = db.collection('Requests').doc(String(requestId));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'not_found' });
    if (snap.data().status !== 'paying') {
      // Already settled by the cron (or not yet marked) — nothing to do, and
      // that's a success from the client's point of view.
      return res.status(200).json({ ok: true, skipped: snap.data().status });
    }

    const outcome = await settleOneRequest(db, snap);
    return res.status(200).json({ ok: true, ...outcome });
  } catch (e) {
    console.error('[requests/settle-one]', e);
    return res.status(500).json({ error: e.message || 'settle failed' });
  }
}
