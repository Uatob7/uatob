import { useState, useCallback } from 'react';
import {
  getFirestore, doc, getDoc, collection,
  runTransaction, serverTimestamp, Timestamp, increment, addDoc,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

export function useSettleDriverCash() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [settled, setSettled] = useState(false);
  const [result,  setResult]  = useState(null);

  const settle = useCallback(async (driverUid) => {
    if (!driverUid) return;
    setLoading(true);
    setError(null);
    setSettled(false);
    setResult(null);

    try {
      const balRef    = doc(db, 'DriverBalance', driverUid);
      const driverRef = doc(db, 'Drivers', driverUid);

      // ── 1. Read current balance & driver doc ──────────────────────────────
      const [balSnap, driverSnap] = await Promise.all([
        getDoc(balRef),
        getDoc(driverRef),
      ]);

      if (!balSnap.exists())   throw new Error('No balance record for this driver');
      if (!driverSnap.exists()) throw new Error('Driver not found');

      const bal    = balSnap.data();
      const driver = driverSnap.data();

      const platformOwes = Number(bal.platformOwes ?? 0);
      const cashOwed     = Number(bal.cashOwed     ?? 0);
      const netPayout    = platformOwes - cashOwed;
      const accountId    = driver.accountId ?? null;

      if (platformOwes <= 0) throw new Error('No pending payout to settle');
      if (!accountId)        throw new Error('Driver has no Stripe account');

      const transferCents     = Math.max(0, Math.round(netPayout * 100));
      const remainingCashOwed = Math.max(0, cashOwed - platformOwes);

      // ── 2. Stripe transfer via REST (same pattern as useNotificationCardPayment) ──
      let transferId = null;

      if (transferCents > 0) {
        const body = new URLSearchParams({
          amount:                     String(transferCents),
          currency:                   'usd',
          destination:                accountId,
          description:                `UaTob settlement — $${platformOwes.toFixed(2)} earned, $${cashOwed.toFixed(2)} cash offset`,
          'metadata[driverUid]':      driverUid,
          'metadata[platformOwes]':   String(platformOwes),
          'metadata[cashOwed]':       String(cashOwed),
          'metadata[netPayout]':      String(netPayout),
          'metadata[createdBy]':      'useSettleDriverCash',
        });

        const res = await fetch('https://api.stripe.com/v1/transfers', {
          method:  'POST',
          headers: {
            Authorization:  `Bearer ${process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body,
        });

        const transfer = await res.json();
        if (transfer.error) throw new Error(transfer.error.message);
        transferId = transfer.id;
      }

      // ── 3. Firestore — update DriverBalance + Drivers + DriverSettlements ──
      const now = Timestamp.now();

      await runTransaction(db, async (tx) => {
        tx.update(balRef, {
          platformOwes:                       0,
          platformOwesSettled:                increment(platformOwes),
          cardRidesPending:                   0,
          cashAppRidesPending:                0,
          cashOwed:                           remainingCashOwed,
          cashSettledLifetime:                increment(Math.min(cashOwed, platformOwes)),
          lastSettledAt:                      now,
          'settlement.status':                transferId ? 'paid' : 'settled_no_transfer',
          'settlement.paidAt':                now,
          'settlement.updatedAt':             now,
          'settlement.transferId':            transferId,
          'settlement.transferCents':         transferCents,
          'settlement.platformOwesAtSettle':  platformOwes,
          'settlement.cashOwedAtSettle':      cashOwed,
        });

        tx.update(driverRef, {
          'cashBalance.platformOwes':          0,
          'cashBalance.cardRidesPending':      0,
          'cashBalance.cashAppRidesPending':   0,
          'cashBalance.cashOwed':              remainingCashOwed,
          'cashBalance.lastSettledAt':    now,
          'cashBalance.settlementStatus': transferId ? 'paid' : 'settled_no_transfer',
          'cashBalance.transferId':       transferId,
          'cashBalance.updatedAt':        now,
        });

        const settlementRef = doc(collection(db, 'DriverSettlements'));
        tx.set(settlementRef, {
          driverUid,
          platformOwes,
          cashOwed,
          netPayout,
          transferCents,
          transferId,
          accountId,
          method:    transferId ? 'stripe_transfer' : 'books_only',
          settledAt: now,
          createdAt: now,
        });
      });

      // ── 4. Audit log ──────────────────────────────────────────────────────
      await addDoc(collection(db, 'SettlementLogs'), {
        driverUid,
        success: true,
        transferId,
        platformOwes,
        cashOwed,
        netPayout,
        transferCents,
        at: serverTimestamp(),
      });

      const out = {
        success: true,
        platformOwes,
        cashOwed,
        netPayout,
        transferId,
        settledAt: now.toDate().toISOString(),
      };
      setResult(out);
      setSettled(true);
      return out;

    } catch (err) {
      const msg = err?.message ?? 'Settlement failed';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setSettled(false);
    setResult(null);
  }, []);

  return { settle, loading, error, settled, result, reset };
}
