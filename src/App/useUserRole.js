// src/App/useUserRole.js
//
// One PWA, two apps. On login we check the data: a uid with a Drivers/{uid} doc
// is a driver; otherwise a rider. The rider entry (/) uses this to bounce a
// logged-in driver over to /driver automatically.
//
//   'guest'   — not signed in
//   'loading' — checking
//   'driver'  — has a Drivers doc
//   'rider'   — everyone else signed in

import { useEffect, useState } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

export function useUserRole(uid) {
  const [role, setRole] = useState(uid ? 'loading' : 'guest');

  useEffect(() => {
    if (!uid) { setRole('guest'); return; }
    let alive = true;
    setRole('loading');
    getDoc(doc(db, 'Drivers', uid))
      .then((snap) => { if (alive) setRole(snap.exists() ? 'driver' : 'rider'); })
      .catch(() => { if (alive) setRole('rider'); });
    return () => { alive = false; };
  }, [uid]);

  return role;
}
