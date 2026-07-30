// src/App/UaTob/useCreditCheckout.js
// Starts a Stripe Checkout for a ride-credit top-up. The server creates the
// session + a pending CreditTopups doc; we redirect to Stripe to pay. Credit is
// added later by the cron reconcile job (/api/credit/reconcile) once Stripe
// confirms payment — never on the client.

import { useState, useCallback } from 'react';

export function useCreditCheckout(uid) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const startCheckout = useCallback(async (amount) => {
    if (!uid) { setError('Please sign in first'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/credit/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, amount }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start checkout');
      window.location.assign(data.url);   // → Stripe Checkout (navigates away)
    } catch (e) {
      setError(e.message || 'Could not start checkout');
      setLoading(false);
    }
  }, [uid]);

  return { startCheckout, loading, error };
}
