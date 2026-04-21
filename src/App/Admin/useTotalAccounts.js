// src/App/Admin/useTotalAccounts.js

import { useEffect, useState } from "react";
import { getFirestore, collection, onSnapshot } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useTotalAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  console.log(accounts);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "Accounts"),
      (snapshot) => {
        const allAccounts = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAccounts(allAccounts);
        setLoading(false);
      },
      (err) => {
        console.error("useTotalAccounts error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return {
    accounts,
    loading,
    error,
    totalAccounts: accounts.length,
  };
}