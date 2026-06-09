// src/App/UaTob/useCreateAccount.js

import { useState, useCallback } from "react";
import {
  doc,
  setDoc,
  serverTimestamp,
  getFirestore,
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useCreateAccount() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const createAccount = useCallback(async ({ uid, email, name }) => {
    if (!uid || typeof uid !== "string") {
      throw new Error("Missing or invalid uid");
    }

    setLoading(true);
    setError("");

    try {
      await setDoc(
        doc(db, "Accounts", uid),
        {
          uid,
          email: email ?? null,
          name: name ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      return {
        success: true,
        uid,
      };
    } catch (err) {
      const msg = err.message || "Failed to create account";
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setError("");
  }, []);

  return {
    createAccount,
    loading,
    error,
    clear,
  };
}