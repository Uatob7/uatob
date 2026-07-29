// src/App/UaTob/useAddCredit.js
//
// Prepaid wallet top-up. Adds ride credit to the rider's Accounts doc so they
// can request rides anytime and pay by credit on the board.
//
// ⚠️ This increments the balance directly. Before production, gate the balance
// bump behind a real Stripe charge (client confirms a PaymentIntent, a webhook
// or callable then credits the account) — never trust a client-side top-up with
// real money. The UI + balance mechanics are here; the charge is the open wire.

import { useState, useCallback } from 'react';
import {
  getFirestore,
  doc,
  updateDoc,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

export function useAddCredit(uid) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const addCredit = useCallback(
    async (amount) => {
      const amt = Number(amount);
      if (!uid)               { setError('Missing uid'); return false; }
      if (!Number.isFinite(amt) || amt <= 0) { setError('Enter a valid amount'); return false; }

      setLoading(true);
      setError(null);
      try {
        await updateDoc(doc(db, 'Accounts', uid), {
          credit:    increment(amt),
          updatedAt: serverTimestamp(),
        });
        return true;
      } catch (err) {
        console.error('[useAddCredit]', err);
        setError(err.message || 'Failed to add credit');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [uid],
  );

  return { addCredit, loading, error };
}
