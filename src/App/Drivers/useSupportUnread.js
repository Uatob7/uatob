import { useEffect, useState } from "react";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

/**
 * Subscribes to SupportThreads/driver_{uid} and returns the
 * driver's unread count. Returns 0 when the thread doc doesn't
 * exist or while the subscription is initializing.
 *
 * Safe to use in multiple components simultaneously — Firestore
 * deduplicates underlying listeners.
 */
export function useSupportUnread(uid) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!uid) {
      setUnread(0);
      return;
    }

    const threadId = `driver_${uid}`;
    let unsub = null;

    try {
      unsub = onSnapshot(
        doc(db, "SupportThreads", threadId),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setUnread(Math.max(0, Number(data?.unreadByDriver ?? 0)));
          } else {
            setUnread(0);
          }
        },
        (err) => {
          console.error("[UaTob] useSupportUnread subscribe failed:", err);
          setUnread(0);
        }
      );
    } catch (err) {
      console.error("[UaTob] useSupportUnread subscribe threw:", err);
    }

    return () => {
      try {
        if (typeof unsub === "function") unsub();
      } catch (err) {
        console.warn("[UaTob] useSupportUnread cleanup threw:", err);
      }
    };
  }, [uid]);

  return unread;
}