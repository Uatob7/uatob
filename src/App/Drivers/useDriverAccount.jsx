import { useEffect, useState } from "react";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useDriverAccount(uid) {
  const [driver, setDriver]     = useState(null);
  const [loading, setLoading]   = useState(true);
  // notFound is true ONLY when a snapshot successfully resolves and the Drivers
  // doc genuinely does not exist. A transient read error must never set this,
  // otherwise the not-a-driver guard would sign a real driver out on a blip.
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!uid) {
      setDriver(null);
      setNotFound(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotFound(false);

    const ref = doc(db, "Drivers", uid);

    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setDriver({ id: snap.id, ...snap.data() });
          setNotFound(false);
        } else {
          setDriver(null);
          setNotFound(true); // confirmed: no such driver account
        }
        setLoading(false);
      },
      (error) => {
        // Transient failure (offline PWA, network hiccup, rules re-eval).
        // Keep the last-known driver and DON'T flag notFound — a false logout
        // is far worse than briefly stale data. Just stop the spinner.
        console.error("Error listening to driver:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  return { driver, loading, notFound };
}
