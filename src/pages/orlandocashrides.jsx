import { useEffect, useRef, useState } from 'react';
import {
  Banknote, Smartphone, ShieldCheck, MapPin, Zap,
  ChevronRight, ArrowRight, Star, CircleDollarSign,
  CheckCircle2, Plane, Building2, GraduationCap,
  Hand, Lock, Eye, Receipt, Globe, Coffee,
} from 'lucide-react';

/* ─── TOKENS (matches driver page exactly) ────── */
const T = {
  green:     '#22C55E',
  greenDim:  '#16A34A',
  greenGlow: 'rgba(34,197,94,.15)',
  greenFaint:'rgba(34,197,94,.06)',
  bg:        '#0C0F0C',
  bg2:       '#111411',
  surface:   '#161A16',
  surface2:  '#1C211C',
  border:    'rgba(34,197,94,.1)',
  borderHi:  'rgba(34,197,94,.25)',
  text:      '#E8F0E8',
  muted:     '#6B7F6B',
  muted2:    '#4A584A',
  white:     '#F0F7F0',
};

/* ─── GLOBAL CSS (matches driver page) ────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=Lato:wght@300;400;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.ua { background: ${T.bg}; color: ${T.text}; font-family: 'Lato', sans-serif; overflow-x: hidden; min-height: 100vh; -webkit-font-smoothing: antialiased; }

.ua .sr { opacity: 0; transform: translateY(28px); transition: opacity .65s cubic-bezier(.16,1,.3,1), transform .65s cubic-bezier(.16,1,.3,1); }
.ua .sr.in { opacity: 1; transform: none; }

@keyframes ua-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes ua-pulse  { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.4; transform:scale(1.2); } }
@keyframes ua-float  { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
@keyframes ua-fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
@keyframes ua-scanline { 0% { top: -2px; } 100% { top: 100%; } }
@keyframes ua-shimmer { 0% { background-position: 200% center; } 100% { background-position: -200% center; } }
@keyframes ua-countup { from { opacity:0; transform:scale(.8); } to { opacity:1; transform:none; } }
@keyframes ua-borderFlow {
  0%,100% { border-color: rgba(34,197,94,.1); }
  50%      { border-color: rgba(34,197,94,.35); }
}
@keyframes ua-billFlip {
  0%   { opacity: 0; transform: rotateX(90deg) translateY(-10px); }
  100% { opacity: 1; transform: rotateX(0) translateY(0); }
}

/* CTA */
.ua-cta {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  width: 100%; padding: 19px 24px; border: none; border-radius: 6px; cursor: pointer;
  background: linear-gradient(120deg, ${T.green} 0%, ${T.greenDim} 40%, #1DBF57 70%, ${T.green} 100%);
  background-size: 250% auto;
  animation: ua-shimmer 5s linear infinite;
  color: #000; font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 800;
  letter-spacing: .06em; text-transform: uppercase; text-decoration: none;
  transition: transform .2s, box-shadow .2s;
  position: relative; overflow: hidden;
}
.ua-cta::after {
  content: ''; position: absolute; inset: 0;
  background: rgba(255,255,255,0); transition: background .2s;
}
.ua-cta:hover { transform: translateY(-2px); box-shadow: 0 0 0 1px ${T.green}, 0 16px 50px rgba(34,197,94,.35); }
.ua-cta:hover::after { background: rgba(255,255,255,.08); }
.ua-cta:active { transform: none; }

/* Card */
.ua-card {
  background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 8px;
  transition: border-color .25s, box-shadow .25s, transform .22s;
}
.ua-card:hover { border-color: ${T.borderHi}; box-shadow: 0 0 0 1px ${T.border}, 0 8px 32px rgba(34,197,94,.08); transform: translateY(-2px); }

/* Chip */
.ua-chip {
  display: inline-flex; align-items: center; gap: 6px;
  background: ${T.greenFaint}; border: 1px solid ${T.border}; border-radius: 4px;
  padding: 6px 12px;
  font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 500;
  color: ${T.green}; letter-spacing: .07em; text-transform: uppercase;
}

/* Mono label */
.ua-mono {
  font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 500;
  color: ${T.green}; letter-spacing: .2em; text-transform: uppercase;
  display: flex; align-items: center; gap: 8px;
}
.ua-mono::before { content: ''; display: inline-block; width: 20px; height: 1px; background: ${T.green}; }

/* Route picker buttons */
.ua-route {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 12px 6px;
  background: ${T.surface2};
  border: 1px solid ${T.border};
  border-radius: 6px;
  cursor: pointer;
  transition: all .2s;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  color: ${T.muted};
  letter-spacing: .06em;
  text-transform: uppercase;
}
.ua-route:hover { border-color: ${T.borderHi}; color: ${T.text}; }
.ua-route.active {
  background: ${T.greenFaint};
  border-color: ${T.borderHi};
  color: ${T.green};
  box-shadow: 0 0 0 1px ${T.borderHi}, 0 4px 20px rgba(34,197,94,.15);
}

/* Noise */
.ua-noise {
  position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.045'/%3E%3C/svg%3E");
  background-size: 180px; opacity: .6;
}

/* Grid bg */
.ua-grid {
  position: absolute; inset: 0; pointer-events: none;
  background-image: linear-gradient(${T.greenFaint} 1px, transparent 1px),
                    linear-gradient(90deg, ${T.greenFaint} 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 0%, transparent 100%);
}

/* Scanline */
.ua-scanline {
  position: absolute; left: 0; right: 0; height: 120px; pointer-events: none;
  background: linear-gradient(to bottom, transparent, rgba(34,197,94,.025), transparent);
  animation: ua-scanline 7s linear infinite;
}

/* Bento */
.ua-bento { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.ua-bento-wide { grid-column: 1 / -1; }

@media (max-width: 380px) { .hero-num { font-size: 44px !important; } }
`;

/* ─── HOOKS ───────────────────────────────────── */
function useSR() {
  useEffect(() => {
    const obs = new IntersectionObserver(entries =>
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); }),
      { threshold: .08 }
    );
    document.querySelectorAll('.ua .sr').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

function useCounter(target, inView, duration = 1000) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target, duration]);
  return val;
}

/* ─── STAT BLOCK ──────────────────────────────── */
function StatBlock({ value, suffix = '', label, index, animTarget, inView }) {
  const count = useCounter(animTarget || 0, inView, 1200);
  const display = animTarget ? `${count}${suffix}` : value;
  return (
    <div style={{
      flex: 1, padding: '26px 12px', textAlign: 'center',
      borderRight: index < 2 ? `1px solid ${T.border}` : 'none',
      animation: `ua-countup .5s ${index * .12}s both`
    }}>
      <div style={{
        fontFamily: "'Syne', sans-serif", fontSize: 38, fontWeight: 800,
        lineHeight: 1, color: T.green, letterSpacing: '-.02em', marginBottom: 8
      }}>{display}</div>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
        color: T.muted, letterSpacing: '.14em', textTransform: 'uppercase'
      }}>{label}</div>
    </div>
  );
}

/* ─── FARE SAMPLER (rider's version of the calculator) ── */
const ROUTES = [
  {
    id: 'mco',  icon: Plane,
    label: 'MCO → Disney',
    from: 'Orlando International Airport',
    to:   'Walt Disney World',
    miles: 18, mins: 28,
    fare: 27, uberFare: 42,
  },
  {
    id: 'uni',  icon: Building2,
    label: 'I-Drive → Universal',
    from: 'International Drive',
    to:   'Universal Studios',
    miles: 4, mins: 12,
    fare: 11, uberFare: 18,
  },
  {
    id: 'ucf',  icon: GraduationCap,
    label: 'UCF → Downtown',
    from: 'UCF Main Campus',
    to:   'Downtown Orlando',
    miles: 13, mins: 22,
    fare: 19, uberFare: 28,
  },
];

function FareSampler() {
  const [routeId, setRouteId] = useState('mco');
  const route = ROUTES.find(r => r.id === routeId);
  const savings = route.uberFare - route.fare;

  return (
    <div className="ua-card sr" style={{ padding: '24px 20px', position: 'relative', overflow: 'hidden' }}>
      <div className="ua-noise" />
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${T.green}, transparent 70%)`
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div className="ua-mono" style={{ marginBottom: 6 }}>Cash Fare Sampler</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: T.white }}>
            Real Orlando routes
          </div>
        </div>
        <Banknote size={22} color={T.green} strokeWidth={1.5} />
      </div>

      {/* Route picker */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {ROUTES.map(r => {
          const Icon = r.icon;
          return (
            <button
              key={r.id}
              type="button"
              className={`ua-route ${routeId === r.id ? 'active' : ''}`}
              onClick={() => setRouteId(r.id)}
            >
              <Icon size={16} strokeWidth={1.75} />
              <span>{r.label}</span>
            </button>
          );
        })}
      </div>

      {/* Route detail */}
      <div key={routeId} style={{
        background: T.surface2,
        border: `1px solid ${T.border}`,
        borderRadius: 6,
        padding: '14px 14px',
        marginBottom: 10,
        animation: 'ua-fadeIn .35s ease both',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.green }} />
            <div style={{
              width: 1.5, height: 18, marginTop: 2, marginBottom: 2,
              background: `repeating-linear-gradient(to bottom, ${T.muted2} 0, ${T.muted2} 3px, transparent 3px, transparent 6px)`,
            }} />
            <div style={{ width: 7, height: 7, borderRadius: 2, background: T.text, transform: 'rotate(45deg)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: "'Lato', sans-serif", fontSize: 12, fontWeight: 700,
              color: T.text, marginBottom: 8, lineHeight: 1.3,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{route.from}</div>
            <div style={{
              fontFamily: "'Lato', sans-serif", fontSize: 12, fontWeight: 700,
              color: T.text, lineHeight: 1.3,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{route.to}</div>
          </div>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2,
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: T.muted, letterSpacing: '.06em',
          }}>
            <span>{route.miles} MI</span>
            <span>{route.mins} MIN</span>
          </div>
        </div>
      </div>

      {/* Price comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div key={`u-${routeId}`} style={{
          background: T.greenFaint, border: `1px solid ${T.borderHi}`,
          borderRadius: 6, padding: '16px 14px', position: 'relative', overflow: 'hidden',
          animation: 'ua-billFlip .45s ease both',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(circle at 50% 100%, rgba(34,197,94,.08), transparent 70%)`,
            pointerEvents: 'none'
          }} />
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
            color: T.green, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 10
          }}>UaTob (cash)</div>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 30, fontWeight: 800,
            color: T.green, letterSpacing: '-.02em', lineHeight: 1
          }}>${route.fare}</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: T.muted, marginTop: 4 }}>
            Pay driver direct
          </div>
        </div>
        <div key={`b-${routeId}`} style={{
          background: T.surface2, border: `1px solid ${T.border}`,
          borderRadius: 6, padding: '16px 14px',
          animation: 'ua-billFlip .45s .08s ease both',
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
            color: T.muted, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 10
          }}>Uber / Lyft</div>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 30, fontWeight: 800,
            color: T.muted, letterSpacing: '-.02em', lineHeight: 1,
            textDecoration: 'line-through', textDecorationColor: T.muted2,
          }}>${route.uberFare}</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: T.muted2, marginTop: 4 }}>
            Card required
          </div>
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
          +${savings} in pocket
        </span>
      </div>

      <p style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
        color: T.muted2, marginTop: 12, textAlign: 'center', letterSpacing: '.05em'
      }}>
        Sample fares · actual fare shown before you book at uatob.com
      </p>
    </div>
  );
}

/* ─── BENTO CARD ────────────────────────────── */
function BentoCard({ icon: Icon, title, desc, wide = false, accent = false, delay = 0 }) {
  return (
    <div
      className={`sr ua-card${wide ? ' ua-bento-wide' : ''}`}
      style={{
        padding: '22px 18px',
        transitionDelay: `${delay}s`,
        position: 'relative', overflow: 'hidden',
        background: accent ? `linear-gradient(135deg, rgba(34,197,94,.05), ${T.surface})` : T.surface,
        animation: accent ? 'ua-borderFlow 4s ease-in-out infinite' : undefined
      }}
    >
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 80, height: 80,
        background: `radial-gradient(circle at top right, rgba(34,197,94,.06), transparent 70%)`,
        pointerEvents: 'none'
      }} />
      <div style={{
        width: 38, height: 38, borderRadius: 6,
        background: T.greenFaint, border: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14
      }}>
        <Icon size={17} color={T.green} strokeWidth={1.75} />
      </div>
      <div style={{
        fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700,
        color: T.white, marginBottom: 7, lineHeight: 1.3
      }}>{title}</div>
      <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.8 }}>{desc}</div>
    </div>
  );
}

/* ─── STEP ────────────────────────────────────── */
function Step({ n, title, desc, last }) {
  return (
    <div style={{ display: 'flex', gap: 16, position: 'relative' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 6, flexShrink: 0,
          background: T.greenFaint, border: `1px solid ${T.borderHi}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600, color: T.green
        }}>
          {String(n).padStart(2, '0')}
        </div>
        {!last && <div style={{ width: 1, flex: 1, marginTop: 6, background: T.border }} />}
      </div>
      <div style={{ paddingBottom: last ? 0 : 28 }}>
        <div style={{
          fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700,
          color: T.white, marginBottom: 6, marginTop: 6
        }}>{title}</div>
        <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.75 }}>{desc}</div>
      </div>
    </div>
  );
}

/* ─── FAQ ITEM ────────────────────────────────── */
function FAQItem({ q, a, isOpen, onToggle }) {
  return (
    <div style={{
      borderBottom: `1px solid ${T.border}`,
      padding: '18px 0',
    }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'transparent', border: 'none',
          padding: 0, cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{
          fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700,
          color: T.white, paddingRight: 12,
        }}>{q}</span>
        <ChevronRight
          size={16}
          color={T.green}
          style={{
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0)',
            transition: 'transform .2s',
            flexShrink: 0,
          }}
        />
      </button>
      {isOpen && (
        <p style={{
          fontSize: 13, color: T.muted, lineHeight: 1.8,
          marginTop: 10, animation: 'ua-fadeIn .25s ease both',
        }}>{a}</p>
      )}
    </div>
  );
}

/* ─── MAIN ───────────────────────────────────── */
export default function OrlandoCashRides() {
  useSR();

  const statsRef = useRef(null);
  const [statsIn, setStatsIn] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    const el = statsRef.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsIn(true); }, { threshold: .3 });
    obs.observe(el); return () => obs.disconnect();
  }, []);

  const BOOK_URL = 'https://uatob.com';

  const TICKER = [
    'Pay with cash',          'No app to download', 'No card required',
    'Pay your driver direct', 'Orlando rideshare',  'Web booking',
    'Cash app accepted',      'Card optional',      'No surge gouging',
  ];

  const BENTO = [
    { icon: Banknote,    title: 'Pay your driver in cash',     desc: 'No card on file. No auto-charge. Just hand them cash at pickup like a real taxi — but with upfront pricing.', accent: true },
    { icon: Smartphone,  title: 'No app to install',           desc: 'Open uatob.com in any browser. Book your ride in 30 seconds. Nothing to download or update.' },
    { icon: Eye,         title: 'See the price first',         desc: 'Enter your trip, see the exact fare before you book. No mystery charges, no card auth on a price you have not seen.' },
    { icon: ShieldCheck, title: 'No card required to see fares', desc: "Browse, get quotes, plan trips — all without entering payment info. Only commit when you're ready." },
    { icon: Globe,       title: 'Works from any device',       desc: 'Phone, laptop, hotel computer, friend\'s phone. If it has a browser, it books UaTob.' },
    { icon: MapPin,      title: 'Built for Orlando',           desc: 'Airport runs, theme park transfers, downtown nightlife, UCF student trips, I-Drive tourists. The routes you actually take.', wide: true },
  ];

  const FAQS = [
    {
      q: "Do I really not need a card?",
      a: "Right. Choose cash at checkout, pay the driver the exact fare shown when you arrive. You can also pay with card or Cash App if you prefer — but cash works just fine."
    },
    {
      q: "How does the price work if I pay cash?",
      a: "You see the full fare before you book. That's the price. No surge after the fact, no per-minute surprises, no tip pressure. You hand the driver that amount in cash at pickup."
    },
    {
      q: "What if the driver doesn't show up?",
      a: "Because you paid in cash, there's nothing to refund — you never paid anything yet. Just book a new ride. If you chose card and the ride doesn't match within 30 minutes, your refund is automatic."
    },
    {
      q: "Why isn't there an app?",
      a: "Because you shouldn't need to download 200MB of software to book a 20-minute ride. UaTob is a web app — it runs in your browser. Faster to start, no permissions, no updates."
    },
    {
      q: "Is this legal? Are drivers vetted?",
      a: "UaTob drivers go through ID verification, driving record checks, and vehicle inspection. We're an Orlando-based rideshare platform — same safety standards you'd expect."
    },
    {
      q: "Can I tip in cash?",
      a: "Yes — and it goes 100% to the driver. No platform cut on cash tips."
    },
  ];

  return (
    <div className="ua">
      <style>{CSS}</style>

      {/* ── HERO ── */}
      <section style={{ position: 'relative', overflow: 'hidden', paddingBottom: 0 }}>
        <div className="ua-grid" />
        <div className="ua-scanline" />
        <div className="ua-noise" style={{ position: 'fixed' }} />

        {/* Glow orbs */}
        <div style={{
          position: 'absolute', width: 480, height: 480, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34,197,94,.09) 0%, transparent 65%)',
          top: -200, right: -120, pointerEvents: 'none',
          animation: 'ua-float 11s ease-in-out infinite'
        }} />
        <div style={{
          position: 'absolute', width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34,197,94,.06) 0%, transparent 65%)',
          bottom: 60, left: -80, pointerEvents: 'none',
          animation: 'ua-float 15s ease-in-out infinite reverse'
        }} />

        <div style={{ position: 'relative', zIndex: 2, padding: '48px 22px 40px' }}>

          {/* Status pill */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(34,197,94,.05)', border: `1px solid ${T.border}`,
              borderRadius: 100, padding: '8px 16px'
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', background: T.green,
                animation: 'ua-pulse 2s ease-in-out infinite', display: 'inline-block'
              }} />
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
                color: T.green, letterSpacing: '.18em', textTransform: 'uppercase'
              }}>Live in Orlando · Cash Accepted</span>
            </div>
          </div>

          {/* Headline */}
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <div className="hero-num" style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 'clamp(48px, 14vw, 108px)',
              fontWeight: 800, lineHeight: .92,
              color: T.white, letterSpacing: '-.03em'
            }}>PAY</div>
            <div className="hero-num" style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 'clamp(48px, 14vw, 108px)',
              fontWeight: 800, lineHeight: .92,
              color: T.green, letterSpacing: '-.03em',
              textShadow: `0 0 80px rgba(34,197,94,.25)`
            }}>CASH.</div>
            <div className="hero-num" style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 'clamp(28px, 8vw, 64px)',
              fontWeight: 600, lineHeight: 1.1, marginTop: 8,
              color: 'transparent',
              WebkitTextStroke: `1px rgba(232,240,232,.2)`,
              letterSpacing: '-.01em'
            }}>NO APP. NO CARD.</div>
          </div>

          <p style={{
            textAlign: 'center', fontSize: 14, color: T.muted,
            lineHeight: 1.85, maxWidth: 300, margin: '20px auto 26px',
            fontWeight: 300
          }}>
            Orlando's rideshare you can pay in cash. Book in your browser,
            pay the driver direct at pickup. Nothing to download.
          </p>

          {/* Chips */}
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 7, marginBottom: 28 }}>
            <div className="ua-chip"><Banknote size={11} />Cash accepted</div>
            <div className="ua-chip"><Smartphone size={11} />No app</div>
            <div className="ua-chip"><Eye size={11} />Price upfront</div>
          </div>

          {/* Fare sampler */}
          <FareSampler />

          {/* CTA */}
          <div style={{ marginTop: 16 }}>
            <a href={BOOK_URL} className="ua-cta">
              Book a Ride <ArrowRight size={16} strokeWidth={2.5} />
            </a>
            <p style={{
              textAlign: 'center', fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10, color: T.muted2, marginTop: 11, letterSpacing: '.07em'
            }}>
              Under 30 seconds · No signup to see prices · Cash, card, or Cash App
            </p>
          </div>
        </div>
      </section>

      {/* ── TICKER ── */}
      <div style={{
        borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`,
        overflow: 'hidden', padding: '13px 0', background: T.bg2
      }}>
        <div style={{
          display: 'flex', gap: 56, whiteSpace: 'nowrap',
          animation: 'ua-ticker 24s linear infinite'
        }}>
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 14,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10, color: T.muted, letterSpacing: '.18em', textTransform: 'uppercase'
            }}>
              <span style={{ color: T.green, fontSize: 8 }}>◆</span>{t}
            </span>
          ))}
        </div>
      </div>

      {/* ── STATS ── */}
      <div ref={statsRef} style={{
        display: 'flex', borderBottom: `1px solid ${T.border}`,
        background: T.bg2, position: 'relative', overflow: 'hidden'
      }}>
        <div className="ua-noise" />
        <StatBlock value="$0"             label="To download"  index={0} />
        <StatBlock value="30s"            label="To book"      index={1} />
        <StatBlock value="100%"  suffix="%" label="Cash to driver" animTarget={100} inView={statsIn} index={2} />
      </div>

      {/* ── BENEFITS ── */}
      <section style={{ padding: '52px 22px 40px', background: T.bg }}>
        <div className="sr" style={{ marginBottom: 28 }}>
          <div className="ua-mono" style={{ marginBottom: 14 }}>Why riders choose UaTob</div>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800,
            color: T.white, lineHeight: 1, marginBottom: 4
          }}>NOTHING</div>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800,
            color: T.green, lineHeight: 1
          }}>TO LOSE.</div>
        </div>
        <div className="ua-bento">
          {BENTO.map((b, i) => <BentoCard key={i} {...b} delay={i * .06} />)}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: '0 22px 48px', background: T.bg }}>
        <div className="sr" style={{ marginBottom: 28 }}>
          <div className="ua-mono" style={{ marginBottom: 14 }}>How it works</div>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800,
            color: T.white, lineHeight: 1, marginBottom: 4
          }}>4 STEPS</div>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800,
            color: T.green, lineHeight: 1
          }}>TO YOUR RIDE.</div>
        </div>
        <div className="sr ua-card" style={{ padding: '24px 20px', position: 'relative', overflow: 'hidden' }}>
          <div className="ua-noise" />
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, ${T.green}, transparent 65%)`
          }} />
          <Step n={1} title="Open uatob.com"        desc="No download. Any browser, any device. Bookmark it for next time." />
          <Step n={2} title="Enter your trip"        desc="Pickup and dropoff. We show you the exact fare in 30 seconds — before you commit to anything." />
          <Step n={3} title="Choose cash payment"    desc="Three options: cash, card, or Cash App. Pick cash and we won't charge anything — you'll pay the driver directly." />
          <Step n={4} title="Pay your driver direct" desc="When the driver picks you up, hand them the cash. That's it. Tip in cash too if you want — 100% goes to them." last />
        </div>
      </section>

      {/* ── WHO IT'S FOR ── */}
      <section style={{ padding: '0 22px 48px', background: T.bg }}>
        <div className="sr" style={{ marginBottom: 22 }}>
          <div className="ua-mono" style={{ marginBottom: 14 }}>Made for</div>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 30, fontWeight: 800,
            color: T.white, lineHeight: 1.05
          }}>BUILT FOR<br />
            <span style={{ color: T.green }}>EVERY ORLANDO RIDE</span>
          </div>
        </div>
        <div className="sr ua-card" style={{ padding: '8px 20px 16px', position: 'relative', overflow: 'hidden' }}>
          <div className="ua-noise" />
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, ${T.green}, transparent 60%)`
          }} />
          {[
            [Plane,          "Tourists who don't want to download another app"],
            [GraduationCap,  "UCF & Valencia students paying in cash"],
            [Building2,      "Hotel guests headed to parks, dinner, the airport"],
            [Hand,           "Anyone without a credit card on file"],
            [Coffee,         "Late-night riders who tip their drivers in cash"],
          ].map(([Icon, text], i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 0',
              borderBottom: i < 4 ? `1px solid ${T.border}` : 'none'
            }}>
              <div style={{
                width: 34, height: 34, minWidth: 34, borderRadius: 6,
                background: T.greenFaint, border: `1px solid ${T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Icon size={15} color={T.green} strokeWidth={1.75} />
              </div>
              <span style={{
                fontFamily: "'Lato', sans-serif", fontSize: 13,
                fontWeight: 700, color: T.text, flex: 1
              }}>{text}</span>
              <ChevronRight size={13} color={T.muted2} />
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: '0 22px 48px', background: T.bg }}>
        <div className="sr" style={{ marginBottom: 22 }}>
          <div className="ua-mono" style={{ marginBottom: 14 }}>Frequently asked</div>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 30, fontWeight: 800,
            color: T.white, lineHeight: 1.05
          }}>QUESTIONS<br />
            <span style={{ color: T.green }}>FROM REAL RIDERS</span>
          </div>
        </div>
        <div className="sr ua-card" style={{ padding: '0 20px', position: 'relative', overflow: 'hidden' }}>
          <div className="ua-noise" />
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, ${T.green}, transparent 60%)`
          }} />
          {FAQS.map((f, i) => (
            <FAQItem
              key={i}
              q={f.q}
              a={f.a}
              isOpen={openFaq === i}
              onToggle={() => setOpenFaq(openFaq === i ? -1 : i)}
            />
          ))}
        </div>
      </section>

      {/* ── TESTIMONIAL ── */}
      <section style={{ padding: '0 22px 48px', background: T.bg }}>
        <div className="sr" style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 8, padding: '28px 22px',
          position: 'relative', overflow: 'hidden'
        }}>
          <div className="ua-noise" />
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, ${T.green}, transparent 60%)`
          }} />
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 72, lineHeight: 1,
            color: `rgba(34,197,94,.07)`, position: 'absolute',
            top: 10, right: 16, pointerEvents: 'none', userSelect: 'none', fontWeight: 800
          }}>"</div>
          <div style={{ display: 'flex', gap: 3, marginBottom: 16 }}>
            {[...Array(5)].map((_, i) => <Star key={i} size={13} fill={T.green} color={T.green} />)}
          </div>
          <p style={{
            fontSize: 15, fontWeight: 400, color: T.text,
            lineHeight: 1.85, marginBottom: 22, fontStyle: 'italic'
          }}>
            "I landed at MCO, didn't want to download Uber, didn't want my card on file
            with another app. Pulled up uatob.com, paid the driver cash. Same vibe as
            calling a cab — but with the price locked in upfront."
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 6,
              background: T.greenFaint, border: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
            }}>👤</div>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, color: T.white }}>
                Jordan T.
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: T.muted, letterSpacing: '.07em' }}>
                Visitor · Tampa, FL
              </div>
            </div>
            <div className="ua-chip" style={{ marginLeft: 'auto' }}>Cash Rider</div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{
        padding: '48px 22px 64px',
        background: T.bg2,
        borderTop: `1px solid ${T.border}`,
        position: 'relative', overflow: 'hidden'
      }}>
        <div className="ua-grid" style={{ opacity: .5 }} />
        <div className="ua-noise" />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="sr" style={{ textAlign: 'center', marginBottom: 28 }}>
            <div className="ua-mono" style={{ justifyContent: 'center', marginBottom: 18 }}>Ready when you are</div>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontSize: 38, fontWeight: 800,
              color: T.white, lineHeight: .95, marginBottom: 6
            }}>NEED A RIDE</div>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontSize: 38, fontWeight: 800,
              color: T.green, lineHeight: .95, marginBottom: 18,
              textShadow: `0 0 60px rgba(34,197,94,.2)`
            }}>IN ORLANDO?</div>
            <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.85, maxWidth: 290, margin: '0 auto' }}>
              Open uatob.com, enter your trip, see the price.
              Pay cash to the driver. Nothing to install. Nothing to lose.
            </p>
          </div>

          <a href={BOOK_URL} className="ua-cta">
            Book Your Ride Now <ArrowRight size={16} strokeWidth={2.5} />
          </a>

          <p style={{
            textAlign: 'center', fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10, color: T.muted2, marginTop: 14, lineHeight: 1.9, letterSpacing: '.05em'
          }}>
            Web app · No download · No signup to check prices.<br />
            UaTob — Orlando rideshare with cash, card, or Cash App.
          </p>
        </div>
      </section>
    </div>
  );
}