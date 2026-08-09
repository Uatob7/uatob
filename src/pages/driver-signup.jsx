import dynamic from 'next/dynamic';

// Client-only: the signup hydrates its state from localStorage, which would
// mismatch server-rendered HTML. Rendering client-side avoids the hydration error.
const SignUp = dynamic(() => import('@/App/SignUp'), { ssr: false });

export default function Home({ uid }) {
  return <SignUp uid={uid} />;
}