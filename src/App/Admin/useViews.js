// src/App/Admin/useViews.js
import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  where,
  Timestamp,
} from "firebase/firestore";

import { firebase_app } from "@/firebase/config";
import { getFirestore } from "firebase/firestore";

const db = getFirestore(firebase_app);

export function useViews() {
  const [state, setState] = useState({
    views: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, "Admin", "views", "events"),
      where("createdAt", ">=", Timestamp.fromDate(startOfDay)),
      where("createdAt", "<=", Timestamp.fromDate(endOfDay)),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const views = snap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            path: data.path ?? null,
            uid: data.uid ?? null,
            sessionId: data.sessionId ?? null,
            title: data.title ?? null,
            referrer: data.referrer ?? null,
            userAgent: data.userAgent ?? null,
            timestamp: data.timestamp ?? null,
            createdAt: data.createdAt ?? null,
            screen: data.screen
              ? { width: data.screen.w ?? null, height: data.screen.h ?? null }
              : null,
          };
        });

        setState({ views, loading: false, error: null });
      },
      (err) => {
        console.error("useViews error:", err);
        setState({ views: [], loading: false, error: err.message });
      }
    );

    return () => unsub();
  }, []);

  return state;
}