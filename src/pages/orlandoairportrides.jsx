// src/landing/OrlandoAirportRides.jsx
// Target queries:
//   "Uber from MCO to Disney"
//   "MCO airport rideshare"
//   "cheapest ride from Orlando airport"
//   "MCO to International Drive Uber price"

import { useEffect, useRef, useState } from 'react';
import {
  Plane, Banknote, Zap, ShieldCheck, MapPin, Smartphone, Eye,
  Briefcase, Hotel, Tent, Building2, Star, ArrowRight,
} from 'lucide-react';
import {
  T, CSS, useSR, useCounter,
  StatBlock, BentoCard, Step, FAQItem,
  Hero, Ticker, CTAButton, SectionHeader, FinalCTA,
} from '@/App/UaTob/Uatobkit';

const DESTINATIONS = [
  { id: 'disney',   icon: Tent,      label: 'Disney',     name: 'Walt Disney World',         miles: 18, mins: 28, fare: 27, uberFare: 42 },
  { id: 'idrive',   icon: Hotel,     label: 'I-Drive',    name: 'International Drive',       miles: 11, mins: 18, fare: 19, uberFare: 32 },
  { id: 'universal',icon: Building2, label: 'Universal',  name: 'Universal Studios Orlando', miles: 14, mins: 22, fare: 23, uberFare: 36 },
  { id: 'downtown', icon: Briefcase, label: 'Downtown',   name: 'Downtown Orlando',          miles: 13, mins: 21, fare: 21, uberFare: 30 },
];

function MCOSampler() {
  const [destId, setDestId] = useState('disney');
  const dest = DESTINATIONS.find(d => d.id === destId);
  const savings = dest.uberFare - dest.fare;

  return (
    <div className="ua-card sr" style={{ padding: '24px 20px', position: 'relative', overflow: 'hidden' }}>
      <div className="ua-noise" />
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${T.green}, transparent 70%)`
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div className="ua-mono" style={{ marginBottom: 6 }}>From MCO Airport</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: T.white }}>
            Pick your destination
          </div>
        </div>
        <Plane size={22} color={T.green} strokeWidth={1.5} />
      </div>

      {/* Destination picker — 2x2 grid for 4 destinations */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
        {DESTINATIONS.map(d => {
          const Icon = d.icon;
          return (
            <button
              key={d.id}
              type="button"
              className={`ua-route ${destId === d.id ? 'active' : ''}`}
              onClick={() => setDestId(d.id)}
            >
              <Icon size={16} strokeWidth={1.75} />
              <span>{d.label}</span>
            </button>
          );
        })}
      </div>

      {/* Route preview */}
      <div key={destId} style={{
        background: T.surface2, border: `1px solid ${T.border}`,
        borderRadius: 6, padding: '14px', marginBottom: 10,
        animation: 'ua-fadeIn .35s ease both',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.green }} />
            <div style={{
              width: 1.5, height: 18, marginTop: 2, marginBottom: 2,
              background: `repeating-linear-gradient(to bottom, ${T.muted2} 0, ${T.muted2} 3px, transparent 3px, transparent 6px)`,
            }} />
            <div style={{ width: 7, height: 7, borderRadius: 2, background: T.text, transform: 'rotate(45deg)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>
              Orlando International Airport (MCO)
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>
              {dest.name}
            </div>
          </div>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2,
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: T.muted, letterSpacing: '.06em',
          }}>
            <span>{dest.miles} MI</span><span>{dest.mins} MIN</span>
          </div>
        </div>
      </div>

      {/* Fare comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div key={`u-${destId}`} style={{
          background: T.greenFaint, border: `1px solid ${T.borderHi}`,
          borderRadius: 6, padding: '16px 14px', animation: 'ua-billFlip .45s ease both',
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
            color: T.green, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 10
          }}>UaTob</div>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 30, fontWeight: 800,
            color: T.green, letterSpacing: '-.02em', lineHeight: 1
          }}>${dest.fare}</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: T.muted, marginTop: 4 }}>
            No surge ever
          </div>
        </div>
        <div key={`b-${destId}`} style={{
          background: T.surface2, border: `1px solid ${T.border}`,
          borderRadius: 6, padding: '16px 14px', animation: 'ua-billFlip .45s .08s ease both',
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
            color: T.muted, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 10
          }}>Uber X*</div>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 30, fontWeight: 800,
            color: T.muted, letterSpacing: '-.02em', lineHeight: 1,
            textDecoration: 'line-through', textDecorationColor: T.muted2,
          }}>${dest.uberFare}</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: T.muted2, marginTop: 4 }}>
            Surge varies
          </div>
        </div>
      </div>

      <div style={{
        background: T.surface2, border: `1px solid ${T.border}`,
        borderRadius: 6, padding: '14px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: T.muted, letterSpacing: '.06em' }}>
          YOU SAVE
        </span>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: T.green }}>
          ${savings} on this trip
        </span>
      </div>

      <p style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
        color: T.muted2, marginTop: 12, textAlign: 'center', letterSpacing: '.05em'
      }}>
        *Uber X estimates · actual fare varies with surge · UaTob fare locked when you book
      </p>
    </div>
  );
}

export default function OrlandoAirportRides() {
  useSR();
  const statsRef = useRef(null);
  const [statsIn, setStatsIn] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    const el = statsRef.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsIn(true); }, { threshold: .3 });
    obs.observe(el); return () => obs.disconnect();
  }, []);

  const TICKER = [
    'MCO airport rides',  'Lock your fare',    'No surge ever',
    'Pay cash or card',   'Disney transfers',  'I-Drive transfers',
    'Universal transfers','Curbside pickup',   'No app to download',
  ];

  const BENTO = [
    { icon: Plane,      title: 'Lands at MCO, books in 30 seconds', desc: 'Open uatob.com on your phone before baggage claim. Fare locked. Driver dispatched. No app to install while you wait for your bag.', accent: true },
    { icon: Eye,        title: 'See the price before you book',     desc: 'No surge surprises. The fare you see is the fare you pay — even at 2 AM on a holiday weekend.' },
    { icon: Banknote,   title: 'Cash, card, or Cash App',            desc: 'Pay how you want — no card on file required just to see prices.' },
    { icon: ShieldCheck,title: 'Drivers know the airport',           desc: 'Our Orlando drivers run MCO routes daily. They know which terminal, which exit, which lane.' },
    { icon: Zap,        title: 'Lower fares than Uber & Lyft',       desc: '10-30% cheaper on the same routes. We take less, drivers earn more, you pay less.', wide: false },
    { icon: MapPin,     title: 'Every Orlando destination',           desc: 'Disney resorts, Universal hotels, I-Drive, Lake Buena Vista, Downtown, Winter Park, Lake Nona — we cover the entire metro.', wide: true },
  ];

  const FAQS = [
    { q: "How much is an Uber from MCO to Disney?",
      a: "Uber X from MCO to Walt Disney World runs $35-50 depending on surge, time of day, and traffic. UaTob is a flat $27 — locked when you book, no surge applied after." },
    { q: "Where do I get picked up at MCO?",
      a: "Same pickup zones as Uber and Lyft — Level 1 ground transportation, ride-app pickup zones at Terminal A and Terminal B. You'll get the exact lane and curb number when your driver is 5 minutes out." },
    { q: "Can I book a ride to MCO?",
      a: "Yes — we run both directions. Book your ride to MCO at uatob.com just like any other Orlando trip. Many riders pre-book the night before for early-morning flights." },
    { q: "What if my flight is delayed?",
      a: "Just book when you actually land. There's no app to keep open, no GPS tracking required before you arrive. Open uatob.com from anywhere with WiFi or cell — your fare is calculated fresh." },
    { q: "Are UaTob drivers TNC-certified for the airport?",
      a: "Yes. All UaTob drivers are background-checked, insured, and authorized to pick up at MCO." },
    { q: "Can I pay the driver in cash at the airport?",
      a: "Absolutely. Choose 'cash' at booking, pay your driver direct at pickup. No card needed, no auto-charge. Same as a taxi but with the price locked in beforehand." },
  ];

  return (
    <div className="ua">
      <style>{CSS}</style>

      <Hero
        pill="MCO Airport Rides · Orlando, FL"
        headline1="LAND."
        headline2="BOOK."
        headline3="GO."
        sub="Orlando airport rides without the surge. Flat fares from MCO to Disney, Universal, I-Drive, and beyond. No app to install."
        chips={[
          { icon: Plane,     label: 'MCO pickup' },
          { icon: Eye,       label: 'No surge' },
          { icon: Smartphone,label: 'No app' },
        ]}
      >
        <MCOSampler />
        <CTAButton
          href="https://uatob.com"
          label="Book Your MCO Ride"
          subtext="Open uatob.com · Book in 30 seconds · Pay cash or card"
        />
      </Hero>

      <Ticker items={TICKER} />

      <div ref={statsRef} style={{
        display: 'flex', borderBottom: `1px solid ${T.border}`,
        background: T.bg2, position: 'relative', overflow: 'hidden'
      }}>
        <div className="ua-noise" />
        <StatBlock value="$27" label="MCO → Disney" index={0} />
        <StatBlock value="0"   suffix="%" label="Surge applied" animTarget={0} inView={statsIn} index={1} />
        <StatBlock value="30s" label="To book" index={2} />
      </div>

      <section style={{ padding: '52px 22px 40px', background: T.bg }}>
        <SectionHeader eyebrow="Why MCO travelers choose UaTob" line1="LOCKED-IN" line2="AIRPORT FARES." />
        <div className="ua-bento">
          {BENTO.map((b, i) => <BentoCard key={i} {...b} delay={i * .06} />)}
        </div>
      </section>

      <section style={{ padding: '0 22px 48px', background: T.bg }}>
        <SectionHeader eyebrow="How it works" line1="LAND & BOOK." line2="IN 30 SECONDS." />
        <div className="sr ua-card" style={{ padding: '24px 20px', position: 'relative', overflow: 'hidden' }}>
          <div className="ua-noise" />
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, ${T.green}, transparent 65%)`
          }} />
          <Step n={1} title="Open uatob.com after you land"  desc="On your phone at baggage claim. No app to download — works in any browser." />
          <Step n={2} title="Enter MCO and your destination" desc="See the exact fare in 30 seconds. No surge. No mystery." />
          <Step n={3} title="Pick payment method"             desc="Cash, card, or Cash App. Cash means you pay the driver direct — nothing charged upfront." />
          <Step n={4} title="Walk to ride pickup, hop in"     desc="Drivers know MCO terminals cold. You'll get exact pickup lane info when they're 5 min away." last />
        </div>
      </section>

      <section style={{ padding: '0 22px 48px', background: T.bg }}>
        <SectionHeader eyebrow="Frequently asked" line1="MCO RIDE" line2="QUESTIONS." />
        <div className="sr ua-card" style={{ padding: '0 20px', position: 'relative', overflow: 'hidden' }}>
          <div className="ua-noise" />
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, ${T.green}, transparent 60%)`
          }} />
          {FAQS.map((f, i) => (
            <FAQItem key={i} q={f.q} a={f.a}
              isOpen={openFaq === i}
              onToggle={() => setOpenFaq(openFaq === i ? -1 : i)} />
          ))}
        </div>
      </section>

      <FinalCTA
        eyebrow="Wheels down. Ride waiting."
        line1="HEADED TO"
        line2="ORLANDO?"
        sub="Bookmark uatob.com on your phone now. When you land, you'll be 30 seconds from a flat-fare ride to anywhere in the city."
        ctaLabel="Book Your MCO Ride"
        ctaSubtext={"No app · No download · No surge.\nUaTob — the Orlando airport rideshare."}
      />
    </div>
  );
}