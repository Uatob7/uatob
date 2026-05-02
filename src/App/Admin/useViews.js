import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";

import { firebase_app } from "@/firebase/config";
import { getFirestore } from "firebase/firestore";

const db = getFirestore(firebase_app);

export function useViews(pageSize = 100) {
  const [state, setState] = useState({
    views: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    const q = query(
      collection(db, "Admin", "views", "events"),
      orderBy("createdAt", "desc"),
      limit(pageSize)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const views = snapshot.docs.map((doc) => {
          const data = doc.data();

          return {
            id: doc.id,
            path: data.path || null,
            uid: data.uid || null,
            sessionId: data.sessionId || null,
            title: data.title || null,
            referrer: data.referrer || null,
            userAgent: data.userAgent || null,
            timestamp: data.timestamp || null,
            createdAt: data.createdAt || null,

            screen: data.screen
              ? {
                  width: data.screen.w || null,
                  height: data.screen.h || null,
                }
              : null,
          };
        });

        setState({
          views,
          loading: false,
          error: null,
        });
      },
      (err) => {
        console.error("useViews error:", err);

        setState({
          views: [],
          loading: false,
          error: err.message,
        });
      }
    );

    return () => unsub();
  }, [pageSize]);

  return state;
}