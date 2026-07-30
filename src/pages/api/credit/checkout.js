// POST /api/credit/checkout
// Creates a Stripe Checkout Session for a ride-credit top-up and saves it as a
// PENDING CreditTopups doc (keyed by the session id). Credit is NOT added here —
// the cron reconcile job verifies payment first (see /api/credit/reconcile).
//
// Body: { uid: string, amount: number (USD) }
// Returns: { url, sessionId }

import { adminDb, admin } from '@/firebase/admin';

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { uid, amount } = req.body || {};
    const amt = Number(amount);
    if (!uid || typeof uid !== 'string') return res.status(400).json({ error: 'Missing uid' });
    if (!Number.isFinite(amt) || amt < 1 || amt > 2000) return res.status(400).json({ error: 'Invalid amount' });
    if (!STRIPE_SECRET) return res.status(500).json({ error: 'Stripe is not configured' });

    const origin = req.headers.origin || (req.headers.host ? `https://${req.headers.host}` : 'https://www.uatob.com');
    const cents = Math.round(amt * 100);

    // ── Create the Checkout Session (Stripe REST) ──
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', `${origin}/?topup=success`);
    params.append('cancel_url', `${origin}/?topup=cancel`);
    params.append('client_reference_id', uid);
    params.append('metadata[uid]', uid);
    params.append('metadata[amount]', String(amt));
    params.append('metadata[kind]', 'ride_credit');
    params.append('line_items[0][quantity]', '1');
    params.append('line_items[0][price_data][currency]', 'usd');
    params.append('line_items[0][price_data][unit_amount]', String(cents));
    params.append('line_items[0][price_data][product_data][name]', 'UaTob ride credit');

    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${STRIPE_SECRET}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const session = await r.json();
    if (session.error) return res.status(400).json({ error: session.error.message });

    // ── Save pending top-up (server-side, keyed by session id) ──
    await adminDb().collection('CreditTopups').doc(session.id).set({
      uid,
      amount: amt,
      sessionId: session.id,
      status: 'pending',
      credited: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (e) {
    console.error('[credit/checkout]', e);
    return res.status(500).json({ error: e.message || 'Checkout failed' });
  }
}
