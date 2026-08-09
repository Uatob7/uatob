import dynamic from 'next/dynamic';

// Client-only — the signup hydrates from localStorage; SSR would mismatch.
const SignUp = dynamic(() => import('@/App/SignUp'), { ssr: false });

export default function Home({ uid }) {
  return <SignUp uid={uid} />;
}