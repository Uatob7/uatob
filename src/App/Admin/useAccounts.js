import { useState, useEffect } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/firebase";

export function useAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "accounts"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, snap => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, err => {
      console.error("useAccounts:", err);
      setLoading(false);
    });

    return unsub;
  }, []);

  return { accounts, loading };
}
