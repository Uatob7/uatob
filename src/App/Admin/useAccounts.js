// src/App/Admin/useAccounts.js

import { useEffect, useState } from "react";
import {
  getFirestore,
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

// Detects "requires an index" errors so we can fall back to an
// unordered query while the index builds (or if it's missing entirely).
function isMissingIndexError(err) {
  const code = err?.code ?? "";
  const msg  = (err?.message ?? "").toLowerCase();
  return code === "failed-precondition" || msg.includes("requires an index");
}

export function useAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    let unsub = null;

    // Subscribe without orderBy + sort client-side
    const subscribeFallback = () => {
      try {
        unsub = onSnapshot(
          collection(db, "Accounts"),
          (snap) => {
            const data = snap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .sort((a, b) => {
                const ta = a.createdAt?.seconds ?? 0;
                const tb = b.createdAt?.seconds ?? 0;
                return tb - ta; // desc
              });
            setAccounts(data);
            setLoading(false);
            setError(null);
          },
          (err) => {
            console.error("useAccounts (fallback):", err);
            setError(err);
            setLoading(false);
          }
        );
      } catch (err) {
        console.error("useAccounts fallback subscribe threw:", err);
        setError(err);
        setLoading(false);
      }
    };

    // Primary attempt: ordered by createdAt desc
    try {
      const q = query(
        collection(db, "Accounts"),
        orderBy("createdAt", "desc")
      );

      unsub = onSnapshot(
        q,
        (snap) => {
          const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setAccounts(data);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error("useAccounts:", err);
          if (isMissingIndexError(err)) {
            console.warn("[useAccounts] Falling back to client-side sort.");
            try { if (typeof unsub === "function") unsub(); } catch {}
            unsub = null;
            subscribeFallback();
          } else {
            setError(err);
            setLoading(false);
          }
        }
      );
    } catch (err) {
      console.error("useAccounts subscribe threw:", err);
      subscribeFallback();
    }

    return () => {
      try {
        if (typeof unsub === "function") unsub();
      } catch (err) {
        console.warn("useAccounts cleanup threw:", err);
      }
    };
  }, []);

  return { accounts, loading, error };
}