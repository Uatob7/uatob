// src/App/UaTob/useMarkPayment.js
//
// Marks a Request as PAYING so the server-side cron (/api/requests/settle,
// hit every minute by cron-job.org) can turn it into a canonical Ride. This
// replaces the old client-side conversion (useClaimRequest): the client no
// longer writes the Ride or debits credit itself — it only records the rider's
// choice (cash | credit). The cron does the money-moving transaction with the
// Admin SDK so it's atomic and can't be forged from the client.
//
// For credit we still do a *client-side* balance pre-check here purely for UX
// (so we can immediately open the top-up sheet instead of silently waiting a
// minute for the cron to reject it). The cron re-verifies the balance
// authoritatively before it debits anything.

import { useState, useCallback } from 'react';
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

export class PaymentError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;         // 'missing' | 'not_found' | 'already_claimed' | 'insufficient_credit'
    this.name = 'PaymentError';
  }
}

export function useMarkPayment(uid) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // request: the board request object (must include .id)
  // paymentMethod: 'cash' | 'credit'
  const markPayment = useCallback(
    async (request, paymentMethod = 'cash') => {
      if (!uid)         throw new PaymentError('missing', 'You must be signed in to book.');
      if (!request?.id) throw new PaymentError('missing', 'Missing request.');

      setLoading(true);
      setError(null);

      const requestRef = doc(db, 'Requests', request.id);
      const fareTotal  = Number(request.fareEstimate || 0);

      try {
        // Immediate UX pre-check for credit — the cron re-checks authoritatively.
        if (paymentMethod === 'credit') {
          const acc = await getDoc(doc(db, 'Accounts', uid));
          const balance = Number(acc.exists() ? (acc.data().credit || 0) : 0);
          if (balance < fareTotal) {
            const err = new PaymentError('insufficient_credit', 'Not enough ride credit.');
            err.needed  = +(fareTotal - balance).toFixed(2);
            err.balance = balance;
            err.fare    = fareTotal;
            throw err;
          }
        }

        // Record the choice. status → 'paying' pulls it off the open board
        // (useRequests reads status == 'open') and into the cron's queue
        // (settle reads status == 'paying'). uid is left untouched so the
        // Firestore update rule (owner-only, uid fixed) still passes.
        await updateDoc(requestRef, {
          status:            'paying',
          payWith:           paymentMethod,
          payerUid:          uid,
          paymentError:      null,
          paymentRequestedAt: serverTimestamp(),
          updatedAt:         serverTimestamp(),
        });
      } catch (err) {
        const e = err instanceof PaymentError
          ? err
          : new PaymentError('unknown', err.message || 'Payment failed.');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [uid],
  );

  return { markPayment, loading, error };
}
