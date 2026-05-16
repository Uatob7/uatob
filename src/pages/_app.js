// pages/_app.js
import "@/styles/globals.css";
import Head from "next/head";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { AuthContextProvider, useAuthContext } from "@/context/AuthContext";
import { useTrackViews } from '@/App/UaTob/useTrackViews';
import { useEffect } from "react";
import { getMessaging } from "firebase/messaging";
import { firebase_app } from "@/firebase/config";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

function ServiceWorkerInit() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/firebase-messaging-sw.js")
      .then((reg) => {
        console.log("[SW] Registered:", reg.scope);
        // Bind messaging to the SW so FCM can receive pushes
        getMessaging(firebase_app);
      })
      .catch((err) => console.warn("[SW] Registration failed:", err.message));
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

  useTrackViews();

  return (
    <>
      <Component {...pageProps} uid={uid} />
      <Analytics />
      <SpeedInsights />
    </>
  );
}