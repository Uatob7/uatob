// src/App/UaTob/useCashPayment.js
import { useState, useCallback } from 'react';

export function useCashPayment({ uid, bookingPayload, onSuccess, onError, onClose }) {
  const [loading, setLoading] = useState(false);

  const handleCash = useCallback(async () => {
    setLoading(true);

    try {
      console.log('[useCashPayment] START');

      if (!uid) throw new Error('Missing uid');
      if (!bookingPayload) throw new Error('Missing bookingPayload');

      const fareTotal = Number(bookingPayload.fareEstimate || 0);
      if (!fareTotal) throw new Error('Missing fareEstimate');

      // ── consistent split (MATCHES card + cashapp hooks)
      const platformFee = +(fareTotal * 0.25).toFixed(2);
      const driverPayout = +(fareTotal * 0.75).toFixed(2);

      // ── schedule normalization (same logic as other hooks)
      const isScheduled = bookingPayload.isScheduled === true;
      const scheduledAt =
        isScheduled && bookingPayload.scheduledAt
          ? bookingPayload.scheduledAt
          : null;

      // ── build canonical ride payload (IMPORTANT)
      const rideData = {
        uid,

        pickup: bookingPayload.pickup ?? null,
        dropoff: bookingPayload.dropoff ?? null,

        pickupCity: bookingPayload.pickupCity ?? null,
        pickupZip: bookingPayload.pickupZip ?? null,
        pickupLat: bookingPayload.pickupLat ?? null,
        pickupLng: bookingPayload.pickupLng ?? null,

        dropoffCity: bookingPayload.dropoffCity ?? null,
        dropoffZip: bookingPayload.dropoffZip ?? null,
        dropoffLat: bookingPayload.dropoffLat ?? null,
        dropoffLng: bookingPayload.dropoffLng ?? null,

        polyline: bookingPayload.polyline ?? null,

        rideType: bookingPayload.rideType ?? 'standard',
        rideLabel: bookingPayload.rideLabel ?? null,

        fareTotal,
        platformFee,
        driverPayout,

        tripDistanceMiles: bookingPayload.tripDistanceMiles ?? null,
        tripDurationMin: bookingPayload.tripDurationMin ?? null,
        fareBreakdown: bookingPayload.breakdown ?? null,

        isScheduled,
        scheduledAt,

        promoCode: bookingPayload.promoCode ?? null,
        discountAmount: bookingPayload.discountAmount ?? null,

        paymentMethod: 'cash',
        paymentStatus: 'succeeded',
        paymentIntentId: null,

        driverInfo: bookingPayload.driverInfo
          ? {
              driverCount: bookingPayload.driverInfo.driverCount ?? null,
              etaLabel: bookingPayload.driverInfo.etaLabel ?? null,
              etaMin: bookingPayload.driverInfo.etaMin ?? null,
              nearestMiles: bookingPayload.driverInfo.nearestMiles ?? null,
              stale: bookingPayload.driverInfo.stale ?? null,
            }
          : null,

        status: isScheduled ? 'scheduled' : 'searching_driver',

        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const debugRideId = `debug_${Date.now()}`;

      console.log('[useCashPayment] RIDE DATA:', rideData);
      console.log('[useCashPayment] FAKE RIDE CREATED:', {
        rideId: debugRideId,
      });

      onSuccess?.({
        method: 'cash',
        rideId: debugRideId,
        rideData, // 👈 important: same shape as real system
      });

      onClose?.();
    } catch (err) {
      console.error('[useCashPayment] ERROR:', err);
      onError?.(err.message || 'Cash booking failed.');
    } finally {
      setLoading(false);
      console.log('[useCashPayment] END');
    }
  }, [uid, bookingPayload, onSuccess, onError, onClose]);

  return { loading, handleCash };
}