// src/App/UaTob/usePromo.js
import { useState, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebase_app } from '@/firebase/config';

const functions       = getFunctions(firebase_app, 'us-east1');
const callValidatePromo = httpsCallable(functions, 'validatePromoCode');

/**
 * Manages promo-code entry, validation, and the resulting discount object.
 *
 * @param {number} originalTotal  The base fare before any discount.
 *
 * Returns:
 *   code        string
 *   setCode     (string) => void
 *   open        bool         Whether the input row is expanded
 *   setOpen     (bool) => void
 *   loading     bool
 *   error       string
 *   discount    { code, savings, newTotal, discountType, discountValue } | null
 *   handleApply () => Promise<void>
 *   handleRemove() => void
 */
export function usePromo(originalTotal) {
  const [code,     setCode]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [open,     setOpen]     = useState(false);
  const [discount, setDiscount] = useState(null);

  const handleApply = useCallback(async () => {
    if (!code.trim()) return;
    setError('');
    setLoading(true);
    try {
      const { data } = await callValidatePromo({ code: code.trim().toUpperCase() });
      if (!data.valid) throw new Error(data.message || 'Invalid promo code.');

      const savings = data.discountType === 'percent'
        ? (originalTotal * data.discountValue) / 100
        : Math.min(data.discountValue, originalTotal);

      const newTotal = Math.max(0, originalTotal - savings).toFixed(2);

      setDiscount({
        code:          code.trim().toUpperCase(),
        savings:       savings.toFixed(2),
        newTotal,
        discountType:  data.discountType,
        discountValue: data.discountValue,
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

  return {
    code,
    setCode,
    open,
    setOpen,
    loading,
    error,
    discount,
    handleApply,
    handleRemove,
  };
}