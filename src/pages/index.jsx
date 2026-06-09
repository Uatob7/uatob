import Head from 'next/head';
import UaTobApp from '@/App/UaTob';

const META = {
  title:       "UaTob — Rideshare | Cash, Card & Cash App",
  description: "Book a ride in Orlando in under 30 seconds. Pay cash, card, or Cash App — no app download, no card required to see prices. No surge pricing. Serving MCO, Disney, Universal, I-Drive, UCF & downtown Orlando.",
  url:         "https://www.uatob.com",
  image:       "https://www.uatob.com/og-image.png",
  siteName:    "UaTob",
  locale:      "en_US",
  twitter:     "@uatob",
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["LocalBusiness", "TaxiService"],
      "name": "UaTob",
      "description": "Orlando rideshare accepting cash, card, and Cash App. No app download required. No surge pricing. Serving MCO, Disney, Universal, I-Drive, UCF, and downtown Orlando.",
      "url": "https://www.uatob.com",
      "telephone": "407-942-6078",
      "email": "support@uatob.com",
      "openingHours": "Mo-Su 00:00-23:59",
      "priceRange": "$$",
      "paymentAccepted": "Cash, Credit Card, Cash App",
      "currenciesAccepted": "USD",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Orlando",
        "addressRegion": "FL",
        "addressCountry": "US"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 28.5383,
        "longitude": -81.3792
      },
      "areaServed": [
        { "@type": "City",  "name": "Orlando" },
        { "@type": "City",  "name": "Kissimmee" },
        { "@type": "Place", "name": "Orlando International Airport" },
        { "@type": "Place", "name": "Walt Disney World" },
        { "@type": "Place", "name": "Universal Studios Orlando" },
        { "@type": "Place", "name": "International Drive" },
        { "@type": "Place", "name": "University of Central Florida" },
        { "@type": "Place", "name": "Downtown Orlando" },
        { "@type": "Place", "name": "Lake Nona" },
        { "@type": "Place", "name": "SeaWorld Orlando" },
        { "@type": "Place", "name": "ICON Park Orlando" },
        { "@type": "Place", "name": "Celebration FL" },
        { "@type": "Place", "name": "Winter Park FL" }
      ],
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "Ride Services",
        "itemListElement": [
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "Economy Ride",
              "description": "Affordable everyday rides around Orlando."
            }
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "Comfort Ride",
              "description": "Newer, higher-rated vehicles for a smoother trip."
            }
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "XL Ride",
              "description": "Larger vehicles for groups up to 6 passengers."
            }
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "Premium Ride",
              "description": "Top-tier vehicles for airport runs and special occasions."
            }
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "Electric Ride",
              "description": "Eco-friendly electric vehicle rides in Orlando."
            }
          }
        ]
      },
      "sameAs": [
        "https://uatob.com",
        "https://www.uatob.com"
      ]
    },
    {
      "@type": "WebSite",
      "name": "UaTob",
      "url": "https://www.uatob.com",
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://www.uatob.com/?q={search_term_string}"
        },
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Does UaTob accept cash?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. UaTob is Orlando's rideshare that accepts cash. Choose cash at checkout and pay the driver the exact fare shown when they pick you up. No card required."
          }
        },
        {
          "@type": "Question",
          "name": "Do I need to download an app to book a ride?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No app needed. UaTob is a web app — open uatob.com in any browser on any device and book in under 30 seconds."
          }
        },
        {
          "@type": "Question",
          "name": "Does UaTob have surge pricing?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No. UaTob uses flat upfront pricing. The fare you see before you book is the fare you pay — no surge multipliers, ever."
          }
        },
        {
          "@type": "Question",
          "name": "What areas does UaTob serve in Orlando?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "UaTob serves all of Orlando including MCO airport, Walt Disney World, Universal Studios, International Drive, UCF, Downtown Orlando, Lake Nona, Kissimmee, and surrounding areas."
          }
        },
        {
          "@type": "Question",
          "name": "What payment methods does UaTob accept?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "UaTob accepts cash (paid directly to driver), credit/debit card, and Cash App."
          }
        }
      ]
    }
  ]
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
          content="rideshare Orlando, cash uber Orlando, pay cash for ride Orlando, uber cash payment Orlando, Orlando ride no app, MCO to Disney ride, MCO to Universal ride, Orlando airport rideshare cash, no surge rideshare Orlando, book ride without app Orlando, I-Drive rideshare, UCF rideshare, cash ride Orlando, Orlando taxi alternative, affordable rides Orlando FL, Cash App ride Orlando, ride to Disney World cash, rideshare no credit card Orlando, UaTob, Orlando local rideshare, kiss­immee rideshare, lake nona rides, orlando transportation"
        />
        <meta name="author"           content="UaTob" />
        <meta name="application-name" content="UaTob" />
        <meta name="theme-color"      content="#16A34A" />
        <meta name="color-scheme"     content="light" />
        <meta name="robots"           content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <link rel="canonical"         href={META.url} />

        {/* ── Mobile ── */}
        <meta name="viewport"                        content="width=device-width, initial-scale=1" />
        <meta name="mobile-web-app-capable"          content="yes" />
        <meta name="apple-mobile-web-app-capable"    content="yes" />
        <meta name="apple-mobile-web-app-title"      content="UaTob" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        {/* ── Open Graph ── */}
        <meta property="og:type"        content="website" />
        <meta property="og:url"         content={META.url} />
        <meta property="og:site_name"   content={META.siteName} />
        <meta property="og:title"       content={META.title} />
        <meta property="og:description" content={META.description} />
        <meta property="og:image"       content={META.image} />
        <meta property="og:image:width"  content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt"    content="UaTob — Orlando Rideshare. Pay cash, card or Cash App." />
        <meta property="og:locale"      content={META.locale} />

        {/* ── Twitter ── */}
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:site"        content={META.twitter} />
        <meta name="twitter:creator"     content={META.twitter} />
        <meta name="twitter:title"       content={META.title} />
        <meta name="twitter:description" content={META.description} />
        <meta name="twitter:image"       content={META.image} />
        <meta name="twitter:image:alt"   content="UaTob — Orlando Rideshare. Pay cash, card or Cash App." />

        {/* ── Icons ── */}
        <link rel="icon"             href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* ── Geo SEO ── */}
        <meta name="geo.region"    content="US-FL" />
        <meta name="geo.placename" content="Orlando, Florida" />
        <meta name="geo.position"  content="28.5383;-81.3792" />
        <meta name="ICBM"          content="28.5383, -81.3792" />

        {/* ── JSON-LD ── */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </Head>

      <UaTobApp uid={uid} />
    </>
  );
}