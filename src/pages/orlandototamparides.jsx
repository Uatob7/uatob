// src/landing/OrlandoToTampaRides.jsx
// Target queries:
//   "Orlando to Tampa Uber price"
//   "rideshare from Orlando to Tampa"
//   "ride Tampa to Orlando"
//   "flat rate Orlando Tampa"

import { useEffect, useRef, useState } from 'react';
import {
  Compass, Banknote, Eye, ShieldCheck, MapPin, Smartphone,
  Trophy, Plane, Briefcase, Heart, ArrowRight, Star, Lock,
} from 'lucide-react';
import {
  T, CSS, useSR,
  StatBlock, BentoCard, Step, FAQItem,
  Hero, Ticker, CTAButton, SectionHeader, FinalCTA,
} from '@/App/UaTob/Uatobkit';

// Same trip, different angles — Orlando to Tampa is 84 miles.
// Show the value via use cases instead of multiple destinations.
const USE_CASES = [
  { id: 'gameday', icon: Trophy,    label: 'Game Day',  scenario: 'Bucs / Lightning game in Tampa',           desc: 'No driving, no parking, no late-night exhaustion' },
  { id: 'flight',  icon: Plane,     label: 'Catch Flight', scenario: 'Orlando hotel → Tampa airport (TPA)',   desc: 'No checked-bag rental car return, no shuttle waiting' },
  { id: 'biz',     icon: Briefcase, label: 'Business',  scenario: 'Meeting across the Florida I-4 corridor',  desc: 'Work during the drive, no rental, no fuel receipts' },
  { id: 'fam',     icon: Heart,     label: 'Visiting',  scenario: 'Seeing family without Uber-surge anxiety', desc: 'One locked price beats four separate surges' },
];

const FLAT_FARE  = 89;
const UBER_RANGE = '$140-180';
const DISTANCE   = 84;
const DURATION   = 95;

function TampaSampler() {
  const [caseId, setCaseId] = useState('flight');
  const c = USE_CASES.find(x => x.id === caseId);

  return (
    <div className="ua-card sr" style={{ padding: '24px 20px', position: 'relative', overflow: 'hidden' }}>
      <div className="ua-noise" />
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${T.green}, transparent 70%)`
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div className="ua-mono" style={{ marginBottom: 6 }}>Orlando ↔ Tampa</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: T.white }}>
            $89 flat. Always.
          </div>
        </div>
        <Compass size={22} color={T.green} strokeWidth={1.5} />
      </div>

      {/* Big route card */}
      <div style={{
        background: T.surface2, border: `1px solid ${T.borderHi}`,
        borderRadius: 6, padding: '18px 16px', marginBottom: 14,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 100, height: 100,
          background: 'radial-gradient(circle, rgba(34,197,94,.08), transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.green }} />
            <div style={{
              width: 1.5, height: 28, marginTop: 2, marginBottom: 2,
              background: `repeating-linear-gradient(to bottom, ${T.muted2} 0, ${T.muted2} 3px, transparent 3px, transparent 6px)`,
            }} />
            <div style={{ width: 8, height: 8, borderRadius: 2, background: T.text, transform: 'rotate(45deg)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: T.white, marginBottom: 12 }}>
              Orlando
            </div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: T.white }}>
              Tampa
            </div>
          </div>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: T.muted, letterSpacing: '.06em',
          }}>
            <span>{DISTANCE} MI</span>
            <span>~{DURATION} MIN</span>
          </div>
        </div>
      </div>

      {/* Use case picker */}
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
        color: T.muted, letterSpacing: '.12em', marginBottom: 8, textTransform: 'uppercase',
      }}>What's the trip?</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
        {USE_CASES.map(uc => {
          const Icon = uc.icon;
          return (
            <button key={uc.id} type="button"
              className={`ua-route ${caseId === uc.id ? 'active' : ''}`}
              onClick={() => setCaseId(uc.id)}>
              <Icon size={16} strokeWidth={1.75} />
              <span>{uc.label}</span>
            </button>
          );
        })}
      </div>

      <div key={caseId} style={{
        background: T.surface2, border: `1px solid ${T.border}`,
        borderRadius: 6, padding: '14px',
        marginBottom: 14, animation: 'ua-fadeIn .35s ease both',
      }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: T.white, marginBottom: 4 }}>
          {c.scenario}
        </div>
        <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.55 }}>{c.desc}</div>
      </div>

      {/* Fare comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div style={{
          background: T.greenFaint, border: `1px solid ${T.borderHi}`,
          borderRadius: 6, padding: '16px 14px',
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: T.green,
            letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 10
          }}>UaTob (flat)</div>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 30, fontWeight: 800,
            color: T.green, letterSpacing: '-.02em', lineHeight: 1
          }}>${FLAT_FARE}</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: T.muted, marginTop: 4 }}>One trip, one price</div>
        </div>
        <div style={{
          background: T.surface2, border: `1px solid ${T.border}`,
          borderRadius: 6, padding: '16px 14px',
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: T.muted,
            letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 10
          }}>Uber X*</div>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800,
            color: T.muted, letterSpacing: '-.02em', lineHeight: 1.2,
          }}>{UBER_RANGE}</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: T.muted2, marginTop: 4 }}>Surge-dependent</div>
        </div>
      </div>

      <div style={{
        background: T.surface2, border: `1px solid ${T.border}`,
        borderRadius: 6, padding: '14px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: T.muted, letterSpacing: '.06em' }}>
          YOU KEEP
        </span>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: T.green }}>
          $51-91 in pocket
        </span>
      </div>

      <p style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
        color: T.muted2, marginTop: 12, textAlign: 'center', letterSpacing: '.05em'
      }}>
        *Uber X 84-mile estimate, surge-dependent · UaTob fare locked at $89 always
      </p>
    </div>
  );
}

export default function OrlandoToTampaRides() {
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
    'Orlando to Tampa', '$89 flat',         'Cheaper than Uber',
    'No surge ever',    'Both directions',  '~95 minute trip',
    'Pay cash or card', 'Web app only',     'No rental needed',
  ];

  const BENTO = [
    { icon: Lock,       title: 'Locked $89 flat fare',                desc: "Every time. Game day, holiday weekend, 2 AM — the price is the price. Uber prices this trip at $140-180.", accent: true },
    { icon: Eye,        title: 'No surge on long trips',               desc: 'Inter-city Uber rides are the worst surge offenders. UaTob never surges — flat fare, every trip.' },
    { icon: Banknote,   title: 'Pay cash, card, or Cash App',          desc: 'Choose at booking. Cash means you pay the driver direct on arrival — even for a 84-mile trip.' },
    { icon: ShieldCheck,title: 'Verified Florida drivers',             desc: "Drivers know the I-4 corridor cold. Same drivers who run airport routes daily." },
    { icon: Smartphone, title: 'No app to download',                    desc: 'Book at uatob.com from any browser. Especially useful if you\'re visiting from out of state.', wide: false },
    { icon: Compass,    title: 'Works both directions',                  desc: 'Tampa → Orlando is the same flat $89 fare. Bucs game, Lightning game, Tampa Bay vacation, business trip back home.', wide: true },
  ];

  const FAQS = [
    { q: "How much is an Uber from Orlando to Tampa?",
      a: "Uber X from Orlando to Tampa runs $140-180 depending on time of day, surge, and traffic. UaTob is a flat $89 every trip — no surge, no time-of-day pricing, no holiday markup." },
    { q: "How long does the drive take?",
      a: "About 95 minutes on I-4 in normal traffic. Add 15-20 minutes for rush hour or weekend tourist traffic. Your driver handles the route — you ride." },
    { q: "Is this a real ride, or a shuttle?",
      a: "A real direct ride. One driver, one car, your trip. Same as any other UaTob ride — just longer." },
    { q: "Can I pay cash for an 84-mile trip?",
      a: "Yes. Cash works the same as for any ride — you pay the driver direct on arrival. Many inter-city riders prefer cash because there's no card on file required." },
    { q: "What if I need to come back to Orlando?",
      a: "Book the return separately at uatob.com when you're ready. Same $89 flat fare from Tampa → Orlando." },
    { q: "Can I split the $89 with friends?",
      a: "Yes — the fare is per trip, not per person. Up to 4 riders (or 6 with the XL option) split the same $89. That's $22 each for four people, or $15 each for six. Way less than gas, parking, and tolls." },
    { q: "What if the driver doesn't show up?",
      a: "If your ride doesn't get matched within 30 minutes, your card is refunded automatically. If you chose cash, you weren't charged in the first place." },
  ];

  return (
    <div className="ua">
      <style>{CSS}</style>

      <Hero
        pill="Orlando ↔ Tampa · Florida Rideshare"
        headline1="ORLANDO."
        headline2="TAMPA."
        headline3="$89 FLAT. ALWAYS."
        sub="The inter-city ride Uber overcharges for. One flat fare, no surge — even on game days and holidays. Cash, card, or Cash App."
        chips={[
          { icon: Lock,     label: '$89 flat' },
          { icon: Banknote, label: 'Cash OK' },
          { icon: Eye,      label: 'No surge' },
        ]}
      >
        <TampaSampler />
        <CTAButton
          href="https://uatob.com"
          label="Book Orlando → Tampa"
          subtext="$89 flat · No surge · No app to install"
        />
      </Hero>

      <Ticker items={TICKER} />

      <div ref={statsRef} style={{
        display: 'flex', borderBottom: `1px solid ${T.border}`,
        background: T.bg2, position: 'relative', overflow: 'hidden'
      }}>
        <div className="ua-noise" />
        <StatBlock value="$89"  label="Flat fare"      index={0} />
        <StatBlock value="$51+" label="Saved vs Uber"  index={1} />
        <StatBlock value="0"    suffix="%" label="Surge applied" animTarget={0} inView={statsIn} index={2} />
      </div>

      <section style={{ padding: '52px 22px 40px', background: T.bg }}>
        <SectionHeader eyebrow="Why Florida riders choose UaTob" line1="ONE PRICE." line2="EVERY TIME." />
        <div className="ua-bento">
          {BENTO.map((b, i) => <BentoCard key={i} {...b} delay={i * .06} />)}
        </div>
      </section>

      <section style={{ padding: '0 22px 48px', background: T.bg }}>
        <SectionHeader eyebrow="How it works" line1="ORLANDO TO" line2="TAMPA IN 4 STEPS." />
        <div className="sr ua-card" style={{ padding: '24px 20px', position: 'relative', overflow: 'hidden' }}>
          <div className="ua-noise" />
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, ${T.green}, transparent 65%)`
          }} />
          <Step n={1} title="Open uatob.com"                desc="Phone, laptop, hotel computer — anything with a browser." />
          <Step n={2} title="Enter Orlando pickup, Tampa dropoff" desc="Specific addresses or general area. The fare auto-locks at $89 for any Orlando → Tampa trip." />
          <Step n={3} title="Pick cash or card"              desc="Cash means pay the driver at dropoff. Card means we charge now. Cash App works too." />
          <Step n={4} title="Hit the road, sit back"         desc="~95 minutes. Driver handles I-4. You handle the music." last />
        </div>
      </section>

      <section style={{ padding: '0 22px 48px', background: T.bg }}>
        <SectionHeader eyebrow="Frequently asked" line1="INTER-CITY" line2="RIDE FAQS." />
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
        eyebrow="The flat-fare Florida ride"
        line1="HEADED TO"
        line2="TAMPA?"
        sub="One trip, one driver, $89. Whether it's a Bucs game or a flight from TPA — the fare is locked when you book."
        ctaLabel="Book Your Ride"
        ctaSubtext={"Orlando ↔ Tampa · $89 flat · Cash or card.\nUaTob — Florida rideshare without the surge."}
      />
    </div>
  );
}