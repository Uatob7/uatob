import Head from 'next/head';
import Drivers from '@/App/Drivers';

export default function Home({ uid }) {
  return (
    <>
      <Head>
        <link rel="manifest" href="/driver-manifest.json"/>
        <title>UaTob Driver</title>
      </Head>
      <Drivers uid={uid} />
    </>
  );
}
