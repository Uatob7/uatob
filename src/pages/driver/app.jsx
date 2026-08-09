import Head from 'next/head';
import Drivers from '@/App/Drivers';

export default function Home({ uid }) {
  return (
    <>
      <Head>
        <title>UaTob Driver</title>
      </Head>
      <Drivers uid={uid} />
    </>
  );
}
