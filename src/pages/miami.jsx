import { useEffect, useRef, useState } from 'react';
import {
  CarFront, Clock3, DollarSign, ShieldCheck,
  BadgeCheck, Star, MapPin, Zap,
  TrendingUp, ArrowRight, ChevronRight,
  Wallet, CircleDollarSign, CheckCircle2
} from 'lucide-react';

/* ─── TOKENS ─────────────────────────────────── */
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

/* ─── GLOBAL CSS ─────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=Lato:wght@300;400;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.ua { background: ${T.bg}; color: ${T.text}; font-family: 'Lato', sans-serif; overflow-x: hidden; min-height: 100vh; -webkit-font-smoothing: antialiased; }

/* ── Scroll reveal ── */
.ua .sr { opacity: 0; transform: translateY(28px); transition: opacity .65s cubic-bezier(.16,1,.3,1), transform .65s cubic-bezier(.16,1,.3,1); }
.ua .sr.in { opacity: 1; transform: none; }
.ua .sr.sl { transform: translateX(-24px); }
.ua .sr.sl.in { transform: none; }

/* ── Animations ── */
@keyframes ua-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes ua-pulse  { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.4; transform:scale(1.2); } }
@keyframes ua-float  { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
@keyframes ua-glow   { 0%,100% { opacity:.5; } 50% { opacity:1; } }
@keyframes ua-bar    { from { width: 0; } to { width: var(--w); } }
@keyframes ua-fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
@keyframes ua-scanline { 0% { top: -2px; } 100% { top: 100%; } }
@keyframes ua-shimmer { 0% { background-position: 200% center; } 100% { background-position: -200% center; } }
@keyframes ua-countup { from { opacity:0; transform:scale(.8); } to { opacity:1; transform:none; } }
@keyframes ua-borderFlow {
  0%,100% { border-color: rgba(34,197,94,.1); }
  50%      { border-color: rgba(34,197,94,.35); }
}

/* ── CTA ── */
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

/* ── Card ── */
.ua-card {
  background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 8px;
  transition: border-color .25s, box-shadow .25s, transform .22s;
}
.ua-card:hover { border-color: ${T.borderHi}; box-shadow: 0 0 0 1px ${T.border}, 0 8px 32px rgba(34,197,94,.08); transform: translateY(-2px); }

/* ── Chip ── */
.ua-chip {
  display: inline-flex; align-items: center; gap: 6px;
  background: ${T.greenFaint}; border: 1px solid ${T.border}; border-radius: 4px;
  padding: 6px 12px;
  font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 500;
  color: ${T.green}; letter-spacing: .07em; text-transform: uppercase;
}

/* ── Mono label ── */
.ua-mono {
  font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 500;
  color: ${T.green}; letter-spacing: .2em; text-transform: uppercase;
  display: flex; align-items: center; gap: 8px;
}
.ua-mono::before { content: ''; display: inline-block; width: 20px; height: 1px; background: ${T.green}; }

/* ── Range input ── */
.ua-range {
  -webkit-appearance: none; appearance: none;
  width: 100%; height: 3px; background: ${T.surface2}; border-radius: 2px; outline: none; cursor: pointer;
}
.ua-range::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 20px; height: 20px; border-radius: 50%;
  background: ${T.green}; cursor: pointer;
  box-shadow: 0 0 12px rgba(34,197,94,.5);
  transition: box-shadow .2s;
}
.ua-range::-webkit-slider-thumb:hover { box-shadow: 0 0 20px rgba(34,197,94,.7); }

/* ── Noise ── */
.ua-noise {
  position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.045'/%3E%3C/svg%3E");
  background-size: 180px; opacity: .6;
}

/* ── Grid bg ── */
.ua-grid {
  position: absolute; inset: 0; pointer-events: none;
  background-image: linear-gradient(${T.greenFaint} 1px, transparent 1px),
                    linear-gradient(90deg, ${T.greenFaint} 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 0%, transparent 100%);
}

/* ── Scanline ── */
.ua-scanline {
  position: absolute; left: 0; right: 0; height: 120px; pointer-events: none;
  background: linear-gradient(to bottom, transparent, rgba(34,197,94,.025), transparent);
  animation: ua-scanline 7s linear infinite;
}

/* ── Bento grid ── */
.ua-bento { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.ua-bento-wide { grid-column: 1 / -1; }

/* ── Progress bar ── */
.ua-bar {
  height: 4px; border-radius: 2px;
  background: linear-gradient(90deg, ${T.green}, ${T.greenDim});
  animation: ua-bar .9s cubic-bezier(.16,1,.3,1) both;
}

@media (max-width: 380px) { .hero-num { font-size: 44px !important; } }
`;

/* ─── SCROLL REVEAL ─────────────────────────── */
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

/* ─── ANIMATED COUNTER ──────────────────────── */
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

/* ─── STAT BLOCK ────────────────────────────── */
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

/* ─── EARNINGS CALCULATOR ───────────────────── */
function EarningsCalc() {
  const [hours, setHours] = useState(20);
  const [days, setDays]   = useState(5);

  const tripsPerHour = 2.2;
  const avgFare      = 15;
  const uatobCut     = 0.20;
  const uberCut      = 0.28;

  const trips   = Math.round(hours * tripsPerHour);
  const gross   = trips * avgFare;
  const uatob   = Math.round(gross * (1 - uatobCut));
  const uber    = Math.round(gross * (1 - uberCut));
  const diff    = uatob - uber;

  return (
    <div className="ua-card sr" style={{ padding: '24px 20px', position: 'relative', overflow: 'hidden' }}>
      <div className="ua-noise" />
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${T.green}, transparent 70%)`
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div className="ua-mono" style={{ marginBottom: 6 }}>Earnings Calculator</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: T.white }}>
            See your take-home
          </div>
        </div>
        <CircleDollarSign size={22} color={T.green} strokeWidth={1.5} />
      </div>

      {/* Hours slider */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: T.muted, letterSpacing: '.08em' }}>
            HOURS / WEEK
          </span>
          <span style={{
            fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800,
            color: T.green, letterSpacing: '-.01em'
          }}>{hours}h</span>
        </div>
        <input type="range" min="5" max="50" value={hours}
          onChange={e => setHours(+e.target.value)} className="ua-range" />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: T.muted2 }}>5h</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: T.muted2 }}>50h</span>
        </div>
      </div>

      {/* Results */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        {/* UaTob */}
        <div style={{
          background: T.greenFaint, border: `1px solid ${T.borderHi}`,
          borderRadius: 6, padding: '16px 14px', position: 'relative', overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(circle at 50% 100%, rgba(34,197,94,.07), transparent 70%)`,
            pointerEvents: 'none'
          }} />
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
            color: T.green, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 10
          }}>UaTob (you)</div>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800,
            color: T.green, letterSpacing: '-.02em', lineHeight: 1
          }}>${uatob.toLocaleString()}</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: T.muted, marginTop: 4 }}>
            80% split
          </div>
        </div>
        {/* Uber */}
        <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 6, padding: '16px 14px' }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
            color: T.muted, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 10
          }}>Uber / Lyft</div>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800,
            color: T.muted, letterSpacing: '-.02em', lineHeight: 1
          }}>${uber.toLocaleString()}</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: T.muted2, marginTop: 4 }}>
            ~72% split
          </div>
        </div>
      </div>

      {/* Diff row */}
      <div style={{
        background: T.surface2, border: `1px solid ${T.border}`,
        borderRadius: 6, padding: '14px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: T.muted, letterSpacing: '.06em' }}>
          YOU KEEP EXTRA
        </span>
        <span style={{
          fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800,
          color: T.green
        }}>+${diff}/wk</span>
      </div>

      <p style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
        color: T.muted2, marginTop: 12, textAlign: 'center', letterSpacing: '.05em'
      }}>
        ≈ {trips} trips · ${avgFare} avg fare · illustrative estimate
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

/* ─── MAIN ───────────────────────────────────── */
export default function DriverSignupLanding() {
  useSR();

  const statsRef  = useRef(null);
  const [statsIn, setStatsIn] = useState(false);
  useEffect(() => {
    const el = statsRef.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsIn(true); }, { threshold: .3 });
    obs.observe(el); return () => obs.disconnect();
  }, []);

  const SIGNUP_URL = 'https://uatob.com/driver/signup?city=miami';

  const TICKER = [
    '80% driver split', 'Next-day payouts', 'Zero weekly fees',
    'Miami-first platform', 'Founding driver perks', 'Fair surge pricing',
    'Airport demand', 'Same-day cash-out', 'No hidden charges'
  ];

  const BENTO = [
    { icon: DollarSign,  title: 'Keep 80% of every fare',    desc: 'We take less so you take more home — every trip, no asterisks.',             accent: true },
    { icon: Zap,         title: 'Next-day payouts',           desc: "Cash hits your account fast. No waiting until Friday." },
    { icon: Clock3,      title: 'Drive your own hours',       desc: 'No minimums, no quotas. Go online whenever it works for you.',                wide: false },
    { icon: ShieldCheck, title: 'Real human support',         desc: "Reach a person when something goes wrong — fast." },
    { icon: TrendingUp,  title: 'Transparent surge pricing',  desc: 'You see exactly why rates go up. No black-box surprises.',                   wide: false },
    { icon: MapPin,      title: 'Built for Miami routes',   desc: 'Airport, South Beach, Brickell, Wynwood — demand where you already drive.',  wide: true },
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
              }}>Recruiting Drivers · Miami, FL</span>
            </div>
          </div>

          {/* Headline */}
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <div className="hero-num" style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 'clamp(48px, 14vw, 108px)',
              fontWeight: 800, lineHeight: .92,
              color: T.white, letterSpacing: '-.03em'
            }}>EARN</div>
            <div className="hero-num" style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 'clamp(48px, 14vw, 108px)',
              fontWeight: 800, lineHeight: .92,
              color: T.green, letterSpacing: '-.03em',
              textShadow: `0 0 80px rgba(34,197,94,.25)`
            }}>MORE.</div>
            <div className="hero-num" style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 'clamp(28px, 8vw, 64px)',
              fontWeight: 600, lineHeight: 1.1, marginTop: 8,
              color: 'transparent',
              WebkitTextStroke: `1px rgba(232,240,232,.2)`,
              letterSpacing: '-.01em'
            }}>DRIVE SMARTER.</div>
          </div>

          <p style={{
            textAlign: 'center', fontSize: 14, color: T.muted,
            lineHeight: 1.85, maxWidth: 300, margin: '20px auto 26px',
            fontWeight: 300
          }}>
            Miami's driver-first rideshare platform — built to keep more money
            in your pocket on every single trip.
          </p>

          {/* Chips */}
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 7, marginBottom: 28 }}>
            <div className="ua-chip"><Wallet size={11} />Keep 80%</div>
            <div className="ua-chip"><Zap size={11} />Paid next day</div>
            <div className="ua-chip"><Star size={11} />Founding perks</div>
          </div>

          {/* Calculator */}
          <EarningsCalc />

          {/* CTA */}
          <div style={{ marginTop: 16 }}>
            <a href={SIGNUP_URL} className="ua-cta">
              Start Application <ArrowRight size={16} strokeWidth={2.5} />
            </a>
            <p style={{
              textAlign: 'center', fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10, color: T.muted2, marginTop: 11, letterSpacing: '.07em'
            }}>
              Under 3 minutes · Free to join · No commitment
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
        <StatBlock value="80%" suffix="%" label="Your cut"   animTarget={80} inView={statsIn} index={0} />
        <StatBlock value="24H"            label="Payouts"    index={1} />
        <StatBlock value="$0"             label="To join"    index={2} />
      </div>

      {/* ── BENEFITS ── */}
      <section style={{ padding: '52px 22px 40px', background: T.bg }}>
        <div className="sr" style={{ marginBottom: 28 }}>
          <div className="ua-mono" style={{ marginBottom: 14 }}>Why drivers switch</div>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800,
            color: T.white, lineHeight: 1, marginBottom: 4
          }}>BUILT FOR</div>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800,
            color: T.green, lineHeight: 1
          }}>DRIVERS.</div>
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
          }}>3 STEPS</div>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800,
            color: T.green, lineHeight: 1
          }}>TO YOUR FIRST RIDE.</div>
        </div>
        <div className="sr ua-card" style={{ padding: '24px 20px', position: 'relative', overflow: 'hidden' }}>
          <div className="ua-noise" />
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, ${T.green}, transparent 65%)`
          }} />
          <Step n={1} title="Submit your info"   desc="Start your application. Tell us about yourself and your vehicle — takes about 2 minutes." />
          <Step n={2} title="Upload documents"    desc="Add your license, insurance, and registration. Secure and simple." />
          <Step n={3} title="Start earning"       desc="Once approved, go online whenever you want and start collecting fares." last />
        </div>
      </section>

      {/* ── REQUIREMENTS ── */}
      <section style={{ padding: '0 22px 48px', background: T.bg }}>
        <div className="sr" style={{ marginBottom: 22 }}>
          <div className="ua-mono" style={{ marginBottom: 14 }}>Requirements</div>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 30, fontWeight: 800,
            color: T.white, lineHeight: 1.05
          }}>WHAT YOU'LL<br />
            <span style={{ color: T.green }}>NEED TO APPLY</span>
          </div>
        </div>
        <div className="sr ua-card" style={{ padding: '8px 20px 16px', position: 'relative', overflow: 'hidden' }}>
          <div className="ua-noise" />
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, ${T.green}, transparent 60%)`
          }} />
          {[
            [BadgeCheck,  "Valid Florida driver's license"],
            [CarFront,    "4-door vehicle (2005 or newer)"],
            [ShieldCheck, "Active vehicle insurance"],
            [Star,        "Clean driving record"],
            [CheckCircle2,"Professional, rider-friendly attitude"],
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
            "The pay structure actually makes sense. I know exactly what I'm making,
            and the app doesn't fight me every step of the way."
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 6,
              background: T.greenFaint, border: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
            }}>👤</div>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, color: T.white }}>
                Marcus J.
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: T.muted, letterSpacing: '.07em' }}>
                UaTob driver · Miami
              </div>
            </div>
            <div className="ua-chip" style={{ marginLeft: 'auto' }}>Founding Driver</div>
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
            <div className="ua-mono" style={{ justifyContent: 'center', marginBottom: 18 }}>Ready to start</div>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontSize: 38, fontWeight: 800,
              color: T.white, lineHeight: .95, marginBottom: 6
            }}>READY TO</div>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontSize: 38, fontWeight: 800,
              color: T.green, lineHeight: .95, marginBottom: 18,
              textShadow: `0 0 60px rgba(34,197,94,.2)`
            }}>START EARNING?</div>
            <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.85, maxWidth: 290, margin: '0 auto' }}>
              Join Miami's first wave of founding drivers — priority onboarding,
              early access perks, and direct team support.
            </p>
          </div>

          <a href={SIGNUP_URL} className="ua-cta">
            Start Application <ArrowRight size={16} strokeWidth={2.5} />
          </a>

          <p style={{
            textAlign: 'center', fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10, color: T.muted2, marginTop: 14, lineHeight: 1.9, letterSpacing: '.05em'
          }}>
            Starting your application is free and takes under 3 minutes.<br />No commitment required.
          </p>
        </div>
      </section>
    </div>
  );
}
