// POST /api/drivers/connect  { uid }
//
// Replaces the old `setupDeposit` Cloud Function. Creates (or reuses) a Stripe
// Connect Express account for the driver, saves accountId on Drivers/{uid},
// refreshes transferCapability from the account's payouts_enabled, and returns a
// Stripe onboarding accountLink for the client to redirect to.
//
// Env: STRIPE_SECRET_KEY (falls back to NEXT_PUBLIC_STRIPE_SECRET_KEY),
//      FIREBASE_SERVICE_ACCOUNT (admin). Uses the request origin for return URLs.

import { adminDb, admin } from '@/firebase/admin';

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY;

async function stripe(path, params) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${STRIPE_SECRET}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!STRIPE_SECRET) return res.status(500).json({ error: 'Stripe is not configured' });

  const uid = req.body?.uid;
  if (!uid) return res.status(400).json({ error: 'uid required' });

  const db = adminDb();
  const driverRef = db.collection('Drivers').doc(uid);

  try {
    const snap = await driverRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'driver not found' });
    const driver = snap.data();

    // 1 — reuse or create the connected account
    let accountId = driver.accountId || null;
    if (!accountId) {
      const acct = await stripe('accounts', {
        type: 'express',
        country: 'US',
        email: driver.email || '',
        'capabilities[transfers][requested]': 'true',
        'business_type': 'individual',
        'metadata[driverUid]': uid,
      });
      accountId = acct.id;
    }

    // 2 — refresh payout capability onto the driver doc
    const acct = await stripe(`accounts/${accountId}`, {}); // POST with no params = retrieve+noop update
    const enabled = !!acct.payouts_enabled;
    await driverRef.set({
      accountId,
      transferCapability: enabled ? 'enabled' : 'pending',
      'cashBalance.transferCapability': enabled ? 'enabled' : 'pending',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Already fully onboarded → nothing more to do.
    if (enabled) return res.status(200).json({ success: true, enabled: true });

    // 3 — onboarding link
    const origin = req.headers.origin || `https://${req.headers.host}` || 'https://www.uatob.com';
    const link = await stripe('account_links', {
      account: accountId,
      refresh_url: `${origin}/driver?deposit=refresh`,
      return_url:  `${origin}/driver?deposit=done`,
      type: 'account_onboarding',
    });

    return res.status(200).json({ success: true, accountLink: link.url });
  } catch (e) {
    console.error('[drivers/connect]', e);
    return res.status(500).json({ error: e.message || 'connect failed' });
  }
}
