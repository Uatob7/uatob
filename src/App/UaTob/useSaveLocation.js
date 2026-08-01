// src/App/UaTob/useSaveLocation.js
//
// Grabs the rider's current GPS position and persists it on their Account doc so
// the map can center on where they actually are. Called when the rider taps
// "Request" (a user gesture — required for the browser geolocation prompt).
//
// Writes onto Accounts/{uid}:
//   lat, lng            — last known coordinates
//   locationAccuracy    — GPS accuracy in metres (may be null)
//   locationEnabled     — flag: did the rider ALLOW location tracking?
//                         true on success, false if they denied the prompt
//   locationUpdatedAt   — server timestamp of this attempt
//
// useAccounts() is a live snapshot, so once this writes, RiderMap re-centers on
// its own (its `center` prop reads account.lat/lng).

import { useState, useCallback } from 'react';
import { getFirestore, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

export function useSaveLocation(uid) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const capture = useCallback(async () => {
    if (!uid) return null;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Location is not supported on this device.');
      return null;
    }

    setLoading(true);
    setError('');
    const accountRef = doc(db, 'Accounts', uid);

    try {
      console.log('[useSaveLocation] requesting GPS for', uid);
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: true,
          timeout:            10_000,
          maximumAge:         60_000,  // a minute-old fix is fine for centering
        })
      );

      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      console.log('[useSaveLocation] got fix', { lat, lng, accuracy });

      await updateDoc(accountRef, {
        lat,
        lng,
        locationAccuracy:  accuracy ?? null,
        locationEnabled:   true,
        locationUpdatedAt: serverTimestamp(),
        updatedAt:         serverTimestamp(),
      });
      console.log('[useSaveLocation] saved to Accounts/' + uid);

      return { lat, lng };
    } catch (err) {
      console.warn('[useSaveLocation] failed:', err?.code, err?.message);
      // code 1 = PERMISSION_DENIED — record that tracking is turned OFF so the
      // UI can stop asking / fall back to the default center. Other errors
      // (timeout, position unavailable) don't change the permission flag.
      let msg;
      if (err?.code === 1) {
        try {
          await updateDoc(accountRef, {
            locationEnabled:   false,
            locationUpdatedAt: serverTimestamp(),
          });
        } catch (wErr) { console.warn('[useSaveLocation] flag write failed:', wErr?.message); }
        msg = 'Location access was denied.';
      } else if (err?.code === 2) {
        msg = 'Location unavailable (no GPS fix).';
      } else if (err?.code === 3) {
        msg = 'Location timed out.';
      } else {
        // No positioning error code → likely the Firestore write itself failed.
        msg = err?.message || 'Could not save your location.';
      }
      setError(msg);
      return { error: msg };
    } finally {
      setLoading(false);
    }
  }, [uid]);

  return { capture, loading, error };
}
