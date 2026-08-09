// src/App/useTrackPwaInstall.js
//
// Records when a user installs / runs the PWA. Writes to their own doc:
//   pwaInstalled     : true
//   pwaInstalledAt   : server time of the FIRST install (set once)
//   pwaLastOpenedAt  : server time of each standalone open
//
// Fires on the `appinstalled` event and also whenever the app is opened while
// running standalone (display-mode: standalone / iOS navigator.standalone),
// which covers iOS where `appinstalled` never fires.
//
//   collection = 'Accounts' for riders, 'Drivers' for drivers.

import { useEffect } from 'react';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

export function useTrackPwaInstall(uid, collection = 'Accounts') {
  useEffect(() => {
    if (!uid || typeof window === 'undefined') return;
    const ref = doc(db, collection, uid);

    const mark = async () => {
      try {
        const snap = await getDoc(ref);
        if (!snap.exists()) return;            // don't create a doc from here
        const patch = {
          pwaInstalled:    true,
          pwaLastOpenedAt: serverTimestamp(),
          updatedAt:       serverTimestamp(),
        };
        if (!snap.data().pwaInstalledAt) patch.pwaInstalledAt = serverTimestamp();
        await setDoc(ref, patch, { merge: true });
      } catch (e) { /* non-fatal */ }
    };

    const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone;
    if (standalone) mark();

    const onInstalled = () => mark();
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, [uid, collection]);
}
