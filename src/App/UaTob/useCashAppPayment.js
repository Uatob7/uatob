// src/App/UaTob/useCashAppPayment.js

import { useState, useCallback } from 'react';

/**
 * DEBUG ONLY VERSION
 * - No Stripe
 * - No Firebase
 * - No redirects
 * - Just logs everything
 */
export function useCashAppPayment({ uid, bookingPayload, onSuccess, onError }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Simulate CashApp flow ─────────────────────────────────────
  const handleCashApp = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      console.log('🟢 [CashApp DEBUG] Start payment flow');
      console.log('UID:', uid);
      console.log('Booking Payload:', bookingPayload);

      if (!uid) {
        throw new Error('Missing uid');
      }

      if (!bookingPayload) {
        throw new Error('Missing bookingPayload');
      }

      const fareTotal = Number(bookingPayload?.fareEstimate);

      console.log('💰 Fare Total:', fareTotal);

      if (!fareTotal) {
        throw new Error('Missing fare estimate');
      }

      const isScheduled = bookingPayload?.isScheduled === true;

      console.log('📅 Is Scheduled:', isScheduled);

      const scheduledAt = isScheduled
        ? bookingPayload?.scheduledAt
        : null;

      console.log('⏱ Scheduled At:', scheduledAt);

      const platformFee = +(fareTotal * 0.25).toFixed(2);
      const driverPayout = +(fareTotal * 0.75).toFixed(2);

      const mockIntentId = `pi_mock_${Date.now()}`;
      const mockRideId = `ride_mock_${Date.now()}`;

      console.log('🧾 Calculated Breakdown:', {
        fareTotal,
        platformFee,
        driverPayout,
      });

      console.log('🧪 Mock Payment Intent Created:', mockIntentId);

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
        paymentMethod: 'cashapp_debug',
        paymentIntentId: mockIntentId,
        status: 'pending_dispatch',
        createdAt: new Date().toISOString(),
      };

      console.log('🚗 Generated Ride Data:', rideData);

      // simulate async delay
      await new Promise((res) => setTimeout(res, 500));

      console.log('✅ Simulating onSuccess callback');

      onSuccess?.({
        method: 'cashapp_debug',
        rideId: mockRideId,
        paymentIntent: mockIntentId,
        rideData,
      });

    } catch (err) {
      console.error('❌ CashApp DEBUG Error:', err.message);
      setError(err.message);
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  }, [uid, bookingPayload, onSuccess, onError]);

  return {
    loading,
    error,
    setError,
    handleCashApp,
  };
}