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

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun
  const diffToMon = (day === 0 ? -6 : 1 - day);

  const start = new Date(now);
  start.setDate(now.getDate() + diffToMon);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function useViews() {
  const [state, setState] = useState({
    views: [],
    byDay: {},       // { "Mon": [...], "Tue": [...], ... }
    dayCounts: [],   // [{ label: "Mon", date: "2026-05-04", count: N }, ...]
    loading: true,
    error: null,
  });

  useEffect(() => {
    const { start, end } = getWeekBounds();

    const q = query(
      collection(db, "Admin", "views", "events"),
      where("createdAt", ">=", Timestamp.fromDate(start)),
      where("createdAt", "<=", Timestamp.fromDate(end)),
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

        // Group by day label
        const byDay = {};
        views.forEach((v) => {
          if (!v.createdAt) return;
          const d = v.createdAt.toDate();
          const label = DAY_LABELS[d.getDay()];
          if (!byDay[label]) byDay[label] = [];
          byDay[label].push(v);
        });

        // Build ordered Mon–Sun array for the current week
        const dayCounts = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          const label = DAY_LABELS[d.getDay()];
          const dateStr = d.toISOString().slice(0, 10);
          dayCounts.push({
            label,
            date: dateStr,
            count: (byDay[label] ?? []).length,
          });
        }

        setState({ views, byDay, dayCounts, loading: false, error: null });
      },
      (err) => {
        console.error("useViews error:", err);
        setState({ views: [], byDay: {}, dayCounts: [], loading: false, error: err.message });
      }
    );

    return () => unsub();
  }, []);

  return state;
}