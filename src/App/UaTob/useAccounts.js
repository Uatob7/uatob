import { useState, useEffect } from "react";
import { doc, onSnapshot, getFirestore } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);


export function useAccounts(uid) {
  const [account, setAccount] = useState(null);

  useEffect(() => {
    if (!uid) return;

    const unsub = onSnapshot(
      doc(db, "Accounts", uid),
      (snap) => {
        if (!snap.exists()) {
          setAccount(null);
          return;
        }

        setAccount({
          uid: snap.id,
          ...snap.data(),
        });
      }
    );

    return unsub;
  }, [uid]);

  return { account };
}