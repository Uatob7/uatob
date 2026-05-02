// src/hooks/useTrackViews.js
import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebase_app } from "@/firebase/config";
import { useAuthContext } from "@/context/AuthContext";

const functions = getFunctions(firebase_app, "us-east1");
const trackViewCallable = httpsCallable(functions, "trackView");

export function useTrackViews() {
  const router = useRouter();
  const { uid } = useAuthContext();

  const lastTrackedRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // ── Session ID (persist per browser session) ──
    let sessionId = localStorage.getItem("uatob_session_id");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem("uatob_session_id", sessionId);
    }

    const track = async (url) => {
      try {
        // ── Throttle (prevent spam) ──
        const now = Date.now();
        if (now - lastTrackedRef.current < 1500) return;
        lastTrackedRef.current = now;

        await trackViewCallable({
          path: url,
          uid: uid ?? null,
          sessionId,
          timestamp: now,
          title: document.title,
          referrer: document.referrer || null,
          userAgent: navigator.userAgent,
          screen: {
            w: window.innerWidth,
            h: window.innerHeight,
          },
        });
      } catch (err) {
        console.error("trackView error:", err?.message || err);
      }
    };

    // ── Initial load ──
    track(router.asPath);

    // ── Route changes ──
    const handleRouteChange = (url) => track(url);

    router.events.on("routeChangeComplete", handleRouteChange);

    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router, uid]);
}