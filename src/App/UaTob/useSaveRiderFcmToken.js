// src/App/UaTob/useSaveRiderFcmToken.js
//
// Requests push permission, gets FCM token, saves it to Accounts/{uid}.
// Matches the allowUnauthorized: true pattern used across the codebase.

import { useState, useCallback } from 'react';
import { getMessaging, getToken } from 'firebase/messaging';
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const VAPID_KEY =
  'BJ_sRHZonSGCKk2mB2i9ofTRS8ouFVMV-I15FX4sqdUXHyVb1lo6H-N4GMPrlcIIshRlykQicaxkxxFxcYcI4JQ';

const db = getFirestore(firebase_app);

export function useSaveRiderFcmToken() {
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [permission,  setPermission]  = useState(
    typeof window !== 'undefined' && 'Notification' in window
      ? window.Notification.permission   // 'default' | 'granted' | 'denied'
      : 'unsupported'
  );

  // ── requestAndSave ──────────────────────────────────────────────────────
  // Call this when the rider taps "Turn on notifications".
  // Returns true on success, false on any failure.
  const requestAndSave = useCallback(async (uid) => {
    if (!uid) {
      setError('Missing uid');
      return false;
    }

    if (!('Notification' in window)) {
      setError('Push notifications not supported in this browser');
      return false;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Request browser permission if not already granted
      if (window.Notification.permission !== 'granted') {
        const result = await window.Notification.requestPermission();
        setPermission(result);
        if (result !== 'granted') {
          setError('Notification permission denied');
          return false;
        }
      }

      // 2. Get FCM token via Firebase Messaging
      const messaging = getMessaging(firebase_app);
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });

      if (!token) {
        setError('FCM returned empty token');
        return false;
      }

      // 3. Save token directly to Accounts/{uid} — no Cloud Function needed
      await setDoc(
        doc(db, 'Accounts', uid),
        {
          fcmToken:       token,
          fcmUpdatedAt:   serverTimestamp(),
          notifications:  true,
        },
        { merge: true }
      );

      console.log('[UaTob] Rider FCM token saved to Accounts/', uid);
      return true;

    } catch (err) {
      const msg = err?.message || 'Failed to register notifications';
      console.error('[UaTob] useSaveRiderFcmToken error:', msg);
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── disable ─────────────────────────────────────────────────────────────
  // Clears the token from Firestore so the rider stops receiving pushes.
  const disable = useCallback(async (uid) => {
    if (!uid) return;
    try {
      await setDoc(
        doc(db, 'Accounts', uid),
        {
          fcmToken:      null,
          fcmUpdatedAt:  serverTimestamp(),
          notifications: false,
        },
        { merge: true }
      );
    } catch (err) {
      console.error('[UaTob] disable notifications error:', err?.message);
    }
  }, []);

  return {
    requestAndSave,
    disable,
    loading,
    error,
    permission,      // expose so UI can show correct state
  };
}