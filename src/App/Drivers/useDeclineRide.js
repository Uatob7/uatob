import { useCallback, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebase_app } from "@/firebase/config";

const fn = httpsCallable(getFunctions(firebase_app, "us-east1"), "declineRide");

export function useDeclineRide() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const call = useCallback(async (payload) => {
    setLoading(true); setError(null);
    try {
      const { data } = await fn(payload);
      if (data?.error) throw new Error(data.error);
      return data;
    } catch (err) {
      setError(err?.message || "declineRide failed");
      throw err;
    } finally { setLoading(false); }
  }, []);

  return { call, loading, error };
}