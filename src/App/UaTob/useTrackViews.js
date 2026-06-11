// src/hooks/useTrackViews.js
import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { getFirestore, collection, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";
import { useAuthContext } from "@/context/AuthContext";

const db = getFirestore(firebase_app);

export function useTrackViews() {
  const router        = useRouter();
  const { uid }       = useAuthContext();
  const lastTrackedRef = useRef(0);
  const docIdRef       = useRef(null); // current view doc ref
  const enteredAtRef   = useRef(null); // when page was entered
  const maxScrollRef   = useRef(0);    // max scroll % reached

  // ── Update the existing view doc with live stats ──
  const updateView = async (extra = {}) => {
    if (!docIdRef.current) return;
    try {
      const timeOnPage = enteredAtRef.current
        ? Math.floor((Date.now() - enteredAtRef.current) / 1000)
        : 0;
      await updateDoc(docIdRef.current, {
        timeOnPageSec: timeOnPage,
        maxScrollPct:  Math.round(maxScrollRef.current),
        updatedAt:     serverTimestamp(),
        ...extra,
      });
    } catch (_) {}
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    // ── Session ID ──
    let sessionId = localStorage.getItem("uatob_session_id");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem("uatob_session_id", sessionId);
    }

    // ── Create initial view doc ──
    const track = async (url) => {
      try {
        const now = Date.now();
        if (now - lastTrackedRef.current < 1500) return;
        lastTrackedRef.current = now;

        // Reset live stats for new page
        enteredAtRef.current = now;
        maxScrollRef.current = 0;
        docIdRef.current     = null;

        const ref = await addDoc(collection(db, "Views"), {
          path:          url,
          uid:           uid ?? null,
          sessionId,
          timestamp:     now,
          createdAt:     serverTimestamp(),
          title:         document.title,
          referrer:      document.referrer || null,
          userAgent:     navigator.userAgent,
          screen:        { w: window.innerWidth, h: window.innerHeight },
          timeOnPageSec: 0,
          maxScrollPct:  0,
          exited:        false,
        });

        docIdRef.current = ref;
      } catch (err) {
        console.error("trackView error:", err?.message || err);
      }
    };

    // ── Scroll depth ──
    const handleScroll = () => {
      const el     = document.documentElement;
      const pct    = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100;
      const capped = Math.min(100, isNaN(pct) ? 0 : pct);
      if (capped > maxScrollRef.current) {
        maxScrollRef.current = capped;
      }
    };

    // ── Tab visibility (user switches tab or minimizes) ──
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        updateView({ lastHiddenAt: serverTimestamp() });
      }
    };

    // ── Page unload (close/navigate away) ──
    const handleUnload = () => {
      updateView({ exited: true });
    };

    // ── Periodic heartbeat every 15s ──
    const heartbeat = setInterval(() => updateView(), 15_000);

    // ── Initial load ──
    track(router.asPath);

    // ── Route changes ──
    const handleRouteChange = (url) => {
      updateView({ exited: true }); // finalize old page
      track(url);                   // start new page
    };

    window.addEventListener("scroll",           handleScroll,     { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload",      handleUnload);
    router.events.on("routeChangeComplete",      handleRouteChange);

    return () => {
      clearInterval(heartbeat);
      updateView({ exited: true });
      window.removeEventListener("scroll",            handleScroll);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload",       handleUnload);
      router.events.off("routeChangeComplete",         handleRouteChange);
    };
  }, [router, uid]);
}