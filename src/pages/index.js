import Head from 'next/head';
import UaTobApp from '@/App/UaTob/App';

const META = {
  title: "UaTob — Orlando's Rideshare Platform",
  description:
    "Request a ride in seconds. UaTob connects Orlando riders with trusted local drivers. Fast pickups, fair prices, no surprise surges.",
  url: "https://www.uatob.com",
  image: "https://www.uatob.com/og-image.png",
  siteName: "UaTob",
  locale: "en_US",
  twitter: "@uatob",
};

export default function Home({ uid }) {
  return (
    <>
      <Head>
        {/* ── Primary SEO ── */}
        <title>{META.title}</title>
        <meta name="description" content={META.description} />
        <meta
          name="keywords"
          content="rideshare Orlando, ride hailing Orlando, UaTob, Orlando taxi alternative, affordable rides Orlando"
        />
        <meta name="author" content="UaTob" />
        <meta name="application-name" content="UaTob" />
        <meta name="theme-color" content="#16A34A" />
        <meta name="color-scheme" content="light" />
        <link rel="canonical" href={META.url} />

        {/* ── Mobile ── */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="UaTob" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="default"
        />

        {/* ── Open Graph ── */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={META.url} />
        <meta property="og:site_name" content={META.siteName} />
        <meta property="og:title" content={META.title} />
        <meta property="og:description" content={META.description} />
        <meta property="og:image" content={META.image} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:locale" content={META.locale} />

        {/* ── Twitter ── */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content={META.twitter} />
        <meta name="twitter:creator" content={META.twitter} />
        <meta name="twitter:title" content={META.title} />
        <meta name="twitter:description" content={META.description} />
        <meta name="twitter:image" content={META.image} />

        {/* ── Icons ── */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* ── Geo SEO ── */}
        <meta name="geo.region" content="US-FL" />
        <meta name="geo.placename" content="Orlando, Florida" />
        <meta name="geo.position" content="28.5383;-81.3792" />
        <meta name="ICBM" content="28.5383, -81.3792" />

        {/* ── JSON-LD ── */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "MobileApplication",
              name: "UaTob",
              description: META.description,
              url: META.url,
              applicationCategory: "TravelApplication",
              operatingSystem: "iOS, Android, Web",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              areaServed: {
                "@type": "City",
                name: "Orlando",
              },
              provider: {
                "@type": "Organization",
                name: "UaTob",
                url: META.url,
                contactPoint: {
                  "@type": "ContactPoint",
                  email: "support@uatob.com",
                  contactType: "customer support",
                },
              },
            }),
          }}
        />
      </Head>

      <UaTobApp uid={uid} />
    </>
  );
}