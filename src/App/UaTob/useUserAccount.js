import { useEffect, useState } from "react";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";

export function useUserAccount(uid) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;

    const db = getFirestore();
    const ref = doc(db, "Accounts", uid);

    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.exists() ? snap.data() : null;
      console.log("Account snapshot:", data); // ✅ logs actual fetched value
      setAccount(data);
      setLoading(false);
    });

    return () => unsub();
  }, [uid]);

  return { account, loading };
}