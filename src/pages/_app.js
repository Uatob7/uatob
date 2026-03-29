import "@/styles/globals.css";
import Head from "next/head";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { AuthContextProvider, useAuthContext } from "@/context/AuthContext";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);


export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>UaTob</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

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

  return <Component {...pageProps} uid={uid} />;
}