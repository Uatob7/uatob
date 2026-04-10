// src/App/Admin/useDriverPresence.js

import { useEffect, useState } from "react";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useDriverPresence() {
  const [uatobdrivers, setUatobdrivers] = useState([]);
  const [count, setCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [offlineCount, setOfflineCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const q = query(
      collection(db, "Drivers"),
      where("status", "in", ["online", "offline"])
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const online = list.filter((d) => d.status === "online").length;
        const offline = list.filter((d) => d.status === "offline").length;

        setUatobdrivers(list);
        setCount(list.length);
        setOnlineCount(online);
        setOfflineCount(offline);
        setLoading(false);
      },
      (err) => {
        console.error("useDriverPresence error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return {
    uatobdrivers,
    count,
    onlineCount,
    offlineCount,
    loading,
    error,
  };
}