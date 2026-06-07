import { useEffect, useState } from "react";
import { getFirestore, collection, onSnapshot } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useSupportUnread() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "SupportThreads"), snap => {
      const total = snap.docs.reduce((s, d) => s + (d.data().unreadByAdmin || 0), 0);
      setUnread(total);
    }, err => console.error("[useSupportUnread]", err));

    return () => unsub();
  }, []);

  return unread;
}
