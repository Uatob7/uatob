// src/App/UaTob/usePromo.js
import { useState, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';

/**
 * Manages promo-code entry, validation, and the resulting discount object.
 * Reads directly from the PromoCodes Firestore collection.
 *
 * @param {number} originalTotal  The base fare before any discount.
 */
export function usePromo(originalTotal) {
  const [code,     setCode]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [open,     setOpen]     = useState(false);
  const [discount, setDiscount] = useState(null);

  const handleApply = useCallback(async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setError('');
    setLoading(true);

    try {
      const snap = await getDoc(doc(db, 'PromoCodes', trimmed));

      if (!snap.exists()) {
        throw new Error('Promo code not found.');
      }

      const promo = snap.data();
      const now   = Date.now();

      // ── Validity checks ───────────────────────────
      if (promo.active === false) {
        throw new Error('This promo code is no longer active.');
      }
      if (promo.expiresAt && promo.expiresAt.toMillis() < now) {
        throw new Error('This promo code has expired.');
      }
      if (promo.startsAt && promo.startsAt.toMillis() > now) {
        throw new Error('This promo code is not yet valid.');
      }
      if (typeof promo.usageLimit === 'number' && (promo.usageCount ?? 0) >= promo.usageLimit) {
        throw new Error('This promo code has reached its usage limit.');
      }
      if (typeof promo.minFare === 'number' && originalTotal < promo.minFare) {
        throw new Error(`Minimum fare of $${promo.minFare.toFixed(2)} required.`);
      }

      // ── Calculate savings ─────────────────────────
      const savings = promo.discountType === 'percent'
        ? (originalTotal * promo.discountValue) / 100
        : Math.min(promo.discountValue, originalTotal);

      const newTotal = Math.max(0, originalTotal - savings).toFixed(2);

      setDiscount({
        code:          trimmed,
        savings:       savings.toFixed(2),
        newTotal,
        discountType:  promo.discountType,
        discountValue: promo.discountValue,
      });

    } catch (err) {
      setError(err.message || 'Could not apply code.');
      setDiscount(null);
    } finally {
      setLoading(false);
    }
  }, [code, originalTotal]);

  const handleRemove = useCallback(() => {
    setCode('');
    setDiscount(null);
    setError('');
    setOpen(false);
  }, []);

  return { code, setCode, open, setOpen, loading, error, discount, handleApply, handleRemove };
}