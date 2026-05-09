// src/App/Admin/useTotalAccounts.js

import { useEffect, useState } from "react";
import {
  getFirestore,
  collection,
  onSnapshot,
  query,
  orderBy
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let q;

    try {
      // If createdAt exists + indexed
      q = query(
        collection(db, "accounts"),
        orderBy("createdAt", "desc")
      );
    } catch (e) {
      console.warn("Falling back to unordered accounts:", e);
      q = collection(db, "accounts");
    }

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setAccounts(data);
        setLoading(false);
      },
      (err) => {
        console.error("useAccounts:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { accounts, loading };
}