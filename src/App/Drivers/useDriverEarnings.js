// src/App/Drivers/useDriverEarnings.js

import { useState, useEffect, useCallback } from "react";

const EARNINGS_URL = "https://getdriverearnings-ady2s2xhhq-uc.a.run.app";

export function useDriverEarnings(uid) {
  const [earnings, setEarnings]   = useState(null);
  const [loading,  setLoading]    = useState(true);
  const [error,    setError]      = useState(null);

  console.log('earnings:', earnings);

  const fetchEarnings = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);

    try {
      const res  = await fetch(EARNINGS_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ uid }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch earnings");
      }

      setEarnings(data);
    } catch (err) {
      console.error("[useDriverEarnings]", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  // Fetch on mount + whenever uid changes
  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  return { earnings, loading, error, refetch: fetchEarnings };
}