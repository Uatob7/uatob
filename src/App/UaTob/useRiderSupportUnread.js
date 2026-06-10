import { useEffect, useState } from "react";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useRiderSupportUnread(uid) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!uid) { setUnread(0); return; }

    const threadId = `rider_${uid}`;
    let unsub = null;

    try {
      unsub = onSnapshot(
        doc(db, "SupportThreads", threadId),
        (snap) => {
          if (snap.exists()) {
            setUnread(Math.max(0, Number(snap.data()?.unreadByRider ?? 0)));
          } else {
            setUnread(0);
          }
        },
        (err) => {
          console.error("[UaTob] useRiderSupportUnread failed:", err);
          setUnread(0);
        }
      );
    } catch (err) {
      console.error("[UaTob] useRiderSupportUnread threw:", err);
    }

    return () => {
      try { if (typeof unsub === "function") unsub(); } catch {}
    };
  }, [uid]);

  return unread;
}
