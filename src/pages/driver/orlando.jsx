import { useEffect, useRef } from 'react';
import {
  CarFront, Clock3, DollarSign, ShieldCheck,
  BadgeCheck, Star, MapPin, Users,
  Zap, TrendingUp, ArrowRight, ChevronRight,
  Sparkles, Wallet, CircleDollarSign
} from 'lucide-react';

/* ─── TOKENS ─────────────────────────────────── */
const G     = '#16A34A';
const G2    = '#15803D';
const G3    = '#166534';
const GL    = 'rgba(22,163,74,.08)';
const GB    = 'rgba(22,163,74,.14)';
const BG    = '#F7FAF7';
const BG2   = '#EEFBF2';
const WH    = '#FFFFFF';
const CARD  = '#FFFFFF';
const MID   = '#F0F7F1';
const TXT   = '#0E1F12';
const MUT   = '#5C7A62';
const MUTE2 = '#8AA890';
const BDR   = 'rgba(22,163,74,.13)';
const BDRL  = 'rgba(22,163,74,.26)';

/* ─── GLOBAL CSS ─────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Unbounded:wght@400;700;900&family=DM+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.dsl {
  background: ${BG};
  color: ${TXT};
  font-family: 'Space Grotesk', system-ui, sans-serif;
  overflow-x: hidden;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

/* ── Scroll reveal ── */
.sr {
  opacity: 0;
  transform: translateY(32px);
  transition: opacity .7s cubic-bezier(.16,1,.3,1), transform .7s cubic-bezier(.16,1,.3,1);
}
.sr.in { opacity: 1; transform: none; }

/* ── Keyframes ── */
@keyframes ticker {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
@keyframes shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
@keyframes floatSlow {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50%       { transform: translateY(-18px) rotate(1.5deg); }
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: .55; transform: scale(1.15); }
}
@keyframes gridScroll {
  from { background-position: 0 0; }
  to   { background-position: 0 80px; }
}
@keyframes scanline {
  0%   { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}
@keyframes numberCount {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: none; }
}

/* ── CTA Button / Link ── */
.dsl-cta {
  width: 100%;
  border: none;
  border-radius: 6px;
  padding: 20px 24px;
  background: linear-gradient(90deg, ${G} 0%, ${G2} 40%, ${G} 80%, ${G2} 100%);
  background-size: 300% auto;
  color: ${WH};
  font-family: 'Unbounded', sans-serif;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: .06em;
  text-transform: uppercase;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  animation: shimmer 4s linear infinite;
  transition: transform .2s ease, box-shadow .2s ease;
  position: relative;
  overflow: hidden;
  text-decoration: none;
}
.dsl-cta::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255,255,255,0);
  transition: background .2s ease;
}
.dsl-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 0 1px ${G}, 0 20px 60px rgba(34,197,94,.35);
}
.dsl-cta:hover::before { background: rgba(255,255,255,.07); }
.dsl-cta:active { transform: translateY(0); }

/* ── Cards ── */
.dsl-card {
  background: ${CARD};
  border: 1px solid ${BDR};
  border-radius: 4px;
  transition: border-color .25s ease, box-shadow .25s ease, transform .22s ease;
}
.dsl-card:hover {
  border-color: ${BDRL};
  box-shadow: 0 0 0 1px ${BDR}, 0 12px 40px rgba(22,163,74,.07);
  transform: translateY(-2px);
}

/* ── Chip ── */
.dsl-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: ${GL};
  border: 1px solid ${BDR};
  border-radius: 3px;
  padding: 7px 13px;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  font-weight: 500;
  color: ${G};
  letter-spacing: .04em;
  text-transform: uppercase;
}

/* ── Section label ── */
.dsl-label {
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  font-weight: 500;
  color: ${G};
  letter-spacing: .22em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 10px;
}
.dsl-label::before {
  content: '';
  display: inline-block;
  width: 28px;
  height: 1px;
  background: ${G};
}

/* ── Heading ── */
.dsl-h {
  font-family: 'Unbounded', sans-serif;
  line-height: .95;
  letter-spacing: -.01em;
}

/* ── Req row ── */
.dsl-req-row:last-child { border-bottom: none !important; padding-bottom: 0 !important; }

/* ── Noise overlay ── */
.dsl-noise {
  position: absolute; inset: 0; pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
  background-size: 200px 200px;
  opacity: .55;
}

@media (max-width: 360px) {
  .hero-h { font-size: 52px !important; }
}
`;

/* ─── SCROLL REVEAL ─────────────────────────── */
function useSR() {
  useEffect(() => {
    const els = document.querySelectorAll('.dsl .sr');
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
    }, { threshold: .1 });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

/* ─── SUB-COMPONENTS ─────────────────────────── */
function StatBlock({ value, label, index }) {
  return (
    <div style={{
      flex: 1,
      padding: '24px 14px',
      textAlign: 'center',
      borderRight: index < 2 ? `1px solid ${BDR}` : 'none',
      position: 'relative'
    }}>
      <div style={{
        fontFamily: "'Unbounded', sans-serif",
        fontSize: 38,
        fontWeight: 900,
        lineHeight: 1,
        color: G,
        letterSpacing: '-.02em',
        marginBottom: 8
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 10,
        color: MUT,
        letterSpacing: '.12em',
        textTransform: 'uppercase'
      }}>
        {label}
      </div>
    </div>
  );
}

function BenCard({ icon: Icon, title, desc, delay = 0 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) el.classList.add('in');
    }, { threshold: .1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="sr dsl-card"
      style={{
        padding: '22px 18px',
        transitionDelay: `${delay}s`,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 60, height: 60,
        background: `radial-gradient(circle at top right, rgba(34,197,94,.08), transparent 70%)`,
        pointerEvents: 'none'
      }} />
      <div style={{
        width: 40, height: 40,
        borderRadius: 3,
        background: GL,
        border: `1px solid ${BDR}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16
      }}>
        <Icon size={18} color={G} strokeWidth={1.75} />
      </div>
      <div style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 14, fontWeight: 700,
        color: TXT, marginBottom: 8, lineHeight: 1.3
      }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: MUT, lineHeight: 1.75 }}>
        {desc}
      </div>
    </div>
  );
}

function ReqRow({ icon: Icon, text }) {
  return (
    <div
      className="dsl-req-row"
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '17px 0',
        borderBottom: `1px solid ${BDR}`
      }}
    >
      <div style={{
        width: 36, height: 36, minWidth: 36,
        borderRadius: 3,
        background: GL,
        border: `1px solid ${BDR}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <Icon size={16} color={G} strokeWidth={1.75} />
      </div>
      <span style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 13, fontWeight: 600, color: TXT, flex: 1
      }}>
        {text}
      </span>
      <ChevronRight size={14} color={MUTE2} />
    </div>
  );
}

function StepCard({ number, title, desc }) {
  return (
    <div className="dsl-card" style={{
      padding: '22px 20px',
      display: 'flex', gap: 16, alignItems: 'flex-start'
    }}>
      <div style={{
        minWidth: 32, height: 32,
        borderRadius: 3,
        background: GL,
        border: `1px solid ${BDR}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'DM Mono', monospace",
        fontSize: 12, fontWeight: 500,
        color: G,
        marginTop: 1
      }}>
        {number < 10 ? `0${number}` : number}
      </div>
      <div>
        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 14, fontWeight: 700,
          color: TXT, marginBottom: 6
        }}>{title}</div>
        <div style={{ fontSize: 12, color: MUT, lineHeight: 1.75 }}>{desc}</div>
      </div>
    </div>
  );
}

/* ─── MAIN ───────────────────────────────────── */
export default function DriverSignupLanding() {
  useSR();

  const SIGNUP_URL = 'https://uatob.com/driver/signup';

  const BENEFITS = [
    { icon: DollarSign,  title: 'Keep 80% of every fare',   desc: 'UaTob drivers keep more from every ride, with no confusing payout math or hidden cuts.' },
    { icon: Zap,         title: 'Next-day payouts',          desc: 'Your money lands fast. No weekly waiting cycle and no payout mystery.' },
    { icon: MapPin,      title: 'Orlando-focused demand',    desc: 'Built for the routes drivers actually want — airport, nightlife, events, and campus runs.' },
    { icon: TrendingUp,  title: 'Fair surge pricing',        desc: 'When demand spikes, you see it clearly. No black-box pricing games.' },
    { icon: Clock3,      title: 'Drive whenever you want',   desc: 'Go online when it works for you. No minimum hours and no forced schedules.' },
    { icon: ShieldCheck, title: 'Real human support',        desc: "You can actually reach the team when something matters — fast." },
  ];

  const TICKER = [
    '80% earnings split', 'Next-day payouts', 'Orlando-first',
    'Zero hidden fees', 'Founding driver perks', 'Fair surge pricing',
    'Clean driver app', 'Airport demand', 'Night run opportunities'
  ];

  return (
    <div className="dsl">
      <style>{CSS}</style>

      {/* ── HERO ────────────────────────────────── */}
      <section style={{ position: 'relative', overflow: 'hidden', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

        {/* animated grid bg */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `linear-gradient(rgba(22,163,74,.04) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(22,163,74,.04) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          animation: 'gridScroll 12s linear infinite'
        }} />

        {/* glow orbs */}
        <div style={{
          position: 'absolute', width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(22,163,74,.10) 0%, transparent 65%)',
          top: -200, right: -120, pointerEvents: 'none',
          animation: 'floatSlow 10s ease-in-out infinite'
        }} />
        <div style={{
          position: 'absolute', width: 340, height: 340, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(22,163,74,.07) 0%, transparent 65%)',
          bottom: 60, left: -100, pointerEvents: 'none',
          animation: 'floatSlow 14s ease-in-out infinite reverse'
        }} />

        {/* scan line */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(22,163,74,.2), transparent)',
          animation: 'scanline 8s linear infinite',
          pointerEvents: 'none', zIndex: 1
        }} />

        <div className="dsl-noise" />

        <div style={{ position: 'relative', zIndex: 2, padding: '52px 22px 40px', flex: 1, display: 'flex', flexDirection: 'column' }}>

          {/* status badge */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(22,163,74,.07)',
              border: '1px solid rgba(22,163,74,.18)',
              borderRadius: 3, padding: '8px 14px'
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: G, display: 'inline-block',
                animation: 'pulse 1.8s ease-in-out infinite'
              }} />
              <span style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10, fontWeight: 500,
                color: G, letterSpacing: '.16em', textTransform: 'uppercase'
              }}>
                Now recruiting · Orlando, FL
              </span>
            </div>
          </div>

          {/* big headline */}
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <h1 className="hero-h dsl-h" style={{ fontSize: 'clamp(58px,18vw,100px)', color: TXT }}>
              EARN
            </h1>
            <h1 className="hero-h dsl-h" style={{
              fontSize: 'clamp(58px,18vw,100px)',
              color: G,
              textShadow: `0 0 60px rgba(22,163,74,.2)`
            }}>
              MORE.
            </h1>
            <h1 className="hero-h dsl-h" style={{
              fontSize: 'clamp(58px,18vw,100px)',
              color: 'transparent',
              WebkitTextStroke: `1px rgba(14,31,18,.18)`
            }}>
              DRIVE SMART.
            </h1>
          </div>

          <p style={{
            textAlign: 'center',
            fontSize: 14, fontWeight: 400,
            color: MUT, lineHeight: 1.8,
            maxWidth: 320, margin: '0 auto 28px',
            letterSpacing: '.01em'
          }}>
            Join Orlando's driver-first rideshare platform — higher take-home, faster payouts, fewer headaches.
          </p>

          {/* chips */}
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
            <div className="dsl-chip"><Wallet size={11} />Keep 80%</div>
            <div className="dsl-chip"><Zap size={11} />Paid next day</div>
            <div className="dsl-chip"><Sparkles size={11} />Founding perks</div>
          </div>

          {/* Earning snapshot card */}
          <div className="sr dsl-card" style={{
            padding: '22px', marginBottom: 20,
            background: CARD, position: 'relative', overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, ${G} 0%, transparent 70%)`
            }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <div style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10, color: G,
                  letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 6
                }}>
                  Driver snapshot
                </div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700, color: TXT }}>
                  20 hrs can go a long way
                </div>
              </div>
              <div style={{
                width: 40, height: 40, borderRadius: 3,
                background: GL, border: `1px solid ${BDR}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <CircleDollarSign size={20} color={G} strokeWidth={1.75} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                ['Avg fare', '$15'],
                ['Your cut', '$12'],
                ['40 trips',  '~$480'],
                ['Busy week', '$600+']
              ].map(([k, v]) => (
                <div key={k} style={{
                  background: MID, border: `1px solid ${BDR}`,
                  borderRadius: 3, padding: '14px 12px'
                }}>
                  <div style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 10, color: MUT,
                    letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6
                  }}>{k}</div>
                  <div style={{
                    fontFamily: "'Unbounded', sans-serif",
                    fontSize: 22, fontWeight: 900,
                    color: TXT, letterSpacing: '-.02em'
                  }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Hero CTA ── */}
          <a href={SIGNUP_URL} className="dsl-cta">
            Start Application <ArrowRight size={17} strokeWidth={2.5} />
          </a>
          <p style={{
            textAlign: 'center', fontSize: 11, color: MUTE2,
            marginTop: 12, fontFamily: "'DM Mono', monospace",
            letterSpacing: '.06em'
          }}>
            Under 3 minutes · Free to join
          </p>
        </div>
      </section>

      {/* ── TICKER ──────────────────────────────── */}
      <section style={{
        borderTop: `1px solid ${BDR}`, borderBottom: `1px solid ${BDR}`,
        overflow: 'hidden', padding: '14px 0',
        background: BG2, position: 'relative'
      }}>
        <div style={{
          display: 'flex', gap: 48, whiteSpace: 'nowrap',
          animation: 'ticker 22s linear infinite'
        }}>
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 12,
              fontFamily: "'DM Mono', monospace",
              fontSize: 10, fontWeight: 500,
              color: MUT, letterSpacing: '.16em', textTransform: 'uppercase'
            }}>
              <span style={{ color: G, fontSize: 16 }}>◆</span>{t}
            </span>
          ))}
        </div>
      </section>

      {/* ── STATS ───────────────────────────────── */}
      <section style={{
        display: 'flex', borderBottom: `1px solid ${BDR}`,
        background: WH, position: 'relative', overflow: 'hidden'
      }}>
        <div className="dsl-noise" />
        <StatBlock value="80%" label="Driver cut"  index={0} />
        <StatBlock value="24H" label="Payouts"     index={1} />
        <StatBlock value="$0"  label="To join"     index={2} />
      </section>

      {/* ── BENEFITS ────────────────────────────── */}
      <section style={{ padding: '52px 22px 42px', background: BG }}>
        <div className="sr" style={{ marginBottom: 28 }}>
          <div className="dsl-label" style={{ marginBottom: 14 }}>Why drivers switch</div>
          <div className="dsl-h" style={{ fontSize: 36, color: TXT, marginBottom: 4 }}>BUILT FOR</div>
          <div className="dsl-h" style={{ fontSize: 36, color: G }}>DRIVERS.</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {BENEFITS.map((b, i) => (
            <BenCard key={i} {...b} delay={i * 0.07} />
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────── */}
      <section style={{ padding: '0 22px 42px', background: BG }}>
        <div className="sr" style={{ marginBottom: 24 }}>
          <div className="dsl-label" style={{ marginBottom: 14 }}>How it works</div>
          <div className="dsl-h" style={{ fontSize: 36, color: TXT, marginBottom: 4 }}>APPLY.</div>
          <div className="dsl-h" style={{ fontSize: 36, color: G }}>GET APPROVED.</div>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <StepCard number={1} title="Submit your info"  desc="Start your application and tell us a little about you and your vehicle." />
          <StepCard number={2} title="Upload documents"  desc="Add your license, insurance, and vehicle details securely in the app." />
          <StepCard number={3} title="Start driving"     desc="Once approved, go online and begin earning on your own schedule." />
        </div>
      </section>

      {/* ── REQUIREMENTS ────────────────────────── */}
      <section style={{ padding: '0 22px 42px', background: BG }}>
        <div className="sr" style={{ marginBottom: 22 }}>
          <div className="dsl-label" style={{ marginBottom: 14 }}>Requirements</div>
          <div className="dsl-h" style={{ fontSize: 32, color: TXT, lineHeight: 1.05 }}>
            WHAT YOU'LL<br /><span style={{ color: G }}>NEED TO APPLY</span>
          </div>
        </div>
        <div className="sr dsl-card" style={{ padding: '4px 20px 8px', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, ${G} 0%, transparent 60%)`
          }} />
          <ReqRow icon={BadgeCheck}  text="Valid driver's license" />
          <ReqRow icon={CarFront}    text="Eligible 4-door vehicle" />
          <ReqRow icon={ShieldCheck} text="Active vehicle insurance" />
          <ReqRow icon={Star}        text="Clean driving record" />
          <ReqRow icon={Users}       text="Professional, rider-friendly attitude" />
        </div>
      </section>

      {/* ── TESTIMONIAL ─────────────────────────── */}
      <section style={{ padding: '0 22px 42px', background: BG }}>
        <div className="sr" style={{
          background: BG2, border: `1px solid ${BDR}`,
          borderRadius: 4, padding: '28px 22px',
          position: 'relative', overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, ${G} 0%, transparent 65%)`
          }} />
          <div style={{
            fontFamily: "'Unbounded', sans-serif",
            fontSize: 80, lineHeight: 1,
            color: 'rgba(22,163,74,.1)',
            position: 'absolute', top: 12, right: 18,
            pointerEvents: 'none', userSelect: 'none'
          }}>
            "
          </div>
          <div style={{ display: 'flex', gap: 3, marginBottom: 18 }}>
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={14} fill={G} color={G} />
            ))}
          </div>
          <p style={{
            fontSize: 15, fontWeight: 500, color: TXT,
            lineHeight: 1.75, marginBottom: 22, fontStyle: 'italic'
          }}>
            "The pay structure makes way more sense. I know what I'm making, and
            the app doesn't fight me every step of the way."
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 3,
              background: GL, border: `1px solid ${BDR}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18
            }}>
              👤
            </div>
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 700, color: TXT }}>
                Marcus J.
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: MUT, letterSpacing: '.08em' }}>
                UaTob driver · Orlando, FL
              </div>
            </div>
            <div className="dsl-chip" style={{ marginLeft: 'auto' }}>
              Founding Driver
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────── */}
      <section style={{ padding: '0 22px 64px', background: BG2, borderTop: `1px solid ${BDR}` }}>
        <div className="sr" style={{
          padding: '40px 0 28px', textAlign: 'center',
          borderBottom: `1px solid ${BDR}`, marginBottom: 28
        }}>
          <div className="dsl-label" style={{ justifyContent: 'center', marginBottom: 18 }}>
            Ready to start
          </div>
          <div className="dsl-h" style={{ fontSize: 40, color: TXT, marginBottom: 6 }}>READY TO</div>
          <div className="dsl-h" style={{ fontSize: 40, color: G, marginBottom: 16 }}>START EARNING?</div>
          <p style={{ fontSize: 13, color: MUT, lineHeight: 1.8, maxWidth: 300, margin: '0 auto' }}>
            Join the first wave of founding drivers and get priority onboarding,
            early access perks, and direct support.
          </p>
        </div>

        {/* ── Final CTA ── */}
        <a href={SIGNUP_URL} className="dsl-cta">
          Start Application <ArrowRight size={17} strokeWidth={2.5} />
        </a>

        <p style={{
          textAlign: 'center',
          fontFamily: "'DM Mono', monospace",
          fontSize: 10, color: MUTE2,
          marginTop: 16, lineHeight: 1.8, letterSpacing: '.05em'
        }}>
          By continuing, you begin the UaTob driver onboarding process.<br />
          Free to join — no commitments.
        </p>
      </section>
    </div>
  );
}
