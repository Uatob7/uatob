import "@/styles/globals.css";

// Capture beforeinstallprompt as early as possible — before any component mounts
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__pwaInstallPrompt = e;
  });
}
import Head from "next/head";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { AuthContextProvider, useAuthContext } from "@/context/AuthContext";
import { useTrackViews } from "@/App/UaTob/useTrackViews";
import { useEffect } from "react";
import { getMessaging } from "firebase/messaging";
import { firebase_app } from "@/firebase/config";

import { useAccountPresence } from '@/App/UaTob/useAccountPresence';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
);

function ServiceWorkerInit() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/firebase-messaging-sw.js")
      .then((reg) => {
        console.log("[SW] Registered:", reg.scope);
        getMessaging(firebase_app);
      })
      .catch((err) =>
        console.warn("[SW] Registration failed:", err.message)
      );
  }, []);

  return null;
}

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>UaTob</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <ServiceWorkerInit />

      <AuthContextProvider>
        <Elements stripe={stripePromise}>
          <AppWithAuth Component={Component} pageProps={pageProps} />
        </Elements>
      </AuthContextProvider>
    </>
  );
}

function AppWithAuth({ Component, pageProps }) {
  const { uid } = useAuthContext();

  console.log("[AppWithAuth] Current UID:", uid);

  useTrackViews();

  // ✅ moved into hook
  useAccountPresence(uid);

  return (
    <>
      <Component {...pageProps} uid={uid} />
      <Analytics />
      <SpeedInsights />
    </>
  );
}