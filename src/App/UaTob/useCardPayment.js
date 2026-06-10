// src/App/UaTob/useCardPayment.js

import { useState, useCallback } from 'react';

/**
 * DEBUG ONLY CARD PAYMENT FLOW
 * - No Stripe
 * - No Firebase
 * - No backend calls
 * - Only logs full payment + ride lifecycle
 */
export function useCardPayment({ uid, bookingPayload, onSuccess, onError }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();

    setLoading(true);
    setError('');

    try {
      console.log('💳 [CARD DEBUG] Payment flow started');
      console.log('UID:', uid);
      console.log('Booking Payload:', bookingPayload);

      // ── Validation ──────────────────────────────────────────────
      const fareTotal = Number(bookingPayload?.fareEstimate);

      if (!uid) throw new Error('Missing uid');
      if (!fareTotal) throw new Error('Missing fare estimate');
      if (Math.round(fareTotal * 100) < 50)
        throw new Error('Minimum $0.50 required');

      const isScheduled = bookingPayload?.isScheduled === true;
      const scheduledAt = isScheduled ? bookingPayload?.scheduledAt : null;

      console.log('💰 Fare:', fareTotal);
      console.log('📅 Scheduled:', isScheduled);
      console.log('⏱ Scheduled At:', scheduledAt);

      if (isScheduled) {
        if (!scheduledAt) throw new Error('scheduledAt required');
        const ms = new Date(scheduledAt).getTime();
        if (isNaN(ms)) throw new Error('Invalid scheduledAt');
        if (ms < Date.now() + 10 * 60 * 1000)
          throw new Error('Must be 10+ minutes in future');
      }

      // ── Mock Stripe PaymentMethod ───────────────────────────────
      const mockPaymentMethod = {
        id: `pm_mock_${Date.now()}`,
        type: 'card',
      };

      console.log('🧪 PaymentMethod Created:', mockPaymentMethod);

      // ── Mock PaymentIntent ───────────────────────────────────────
      const mockPaymentIntent = {
        id: `pi_mock_${Date.now()}`,
        status: 'succeeded',
      };

      console.log('🧾 PaymentIntent Created:', mockPaymentIntent);

      // ── Fee breakdown ────────────────────────────────────────────
      const platformFee = +(fareTotal * 0.25).toFixed(2);
      const driverPayout = +(fareTotal * 0.75).toFixed(2);

      console.log('💸 Fee Breakdown:', {
        fareTotal,
        platformFee,
        driverPayout,
      });

      // ── Build ride object ────────────────────────────────────────
      const rideData = {
        uid,
        pickup: bookingPayload?.pickup,
        dropoff: bookingPayload?.dropoff,
        rideType: bookingPayload?.rideType ?? 'standard',
        fareTotal,
        platformFee,
        driverPayout,
        isScheduled,
        scheduledAt,
        paymentMethod: 'card_debug',
        paymentIntentId: mockPaymentIntent.id,
        status: 'pending_dispatch',
        createdAt: new Date().toISOString(),
      };

      console.log('🚗 Ride Data Generated:', rideData);

      // ── Simulate backend check ──────────────────────────────────
      console.log('🔍 Simulating checkRideIntent...');
      await new Promise((res) => setTimeout(res, 400));
      console.log('✅ Ride intent approved (mock)');

      // ── Simulate DB write ───────────────────────────────────────
      const rideId = `ride_mock_${Date.now()}`;
      console.log('🗄️ Ride stored with ID:', rideId);

      // ── Simulate dispatch delay ─────────────────────────────────
      if (!isScheduled) {
        console.log('⏳ Scheduling driver search in 60s (simulated)');
        setTimeout(() => {
          console.log('🚖 STATUS UPDATE → searching_driver (mock)');
        }, 2000); // shortened for debug
      }

      // ── Success callback ─────────────────────────────────────────
      console.log('🎉 Payment flow completed');

      onSuccess?.({
        method: 'card_debug',
        rideId,
        paymentIntent: mockPaymentIntent.id,
        rideData,
      });

      setComplete(true);

    } catch (err) {
      console.error('❌ CARD DEBUG ERROR:', err.message);
      setError(err.message);
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  }, [uid, bookingPayload, onSuccess, onError]);

  return {
    loading,
    error,
    complete,
    focused,
    setComplete,
    setError,
    setFocused,
    handleSubmit,
  };
}