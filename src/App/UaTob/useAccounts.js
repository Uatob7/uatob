// useAccount.js

import { useState, useEffect } from "react";
import {
  doc,
  onSnapshot,
  getFirestore,
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useAccount(uid) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setAccount(null);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, "Accounts", uid),
      (snapshot) => {
        if (snapshot.exists()) {
          setAccount({
            uid: snapshot.id,
            ...snapshot.data(),
          });
        } else {
          setAccount(null);
        }

        setLoading(false);
      },
      (error) => {
        console.error("useAccount:", error);
        setLoading(false);
      }
    );

    return unsub;
  }, [uid]);

  return { account, loading };
}