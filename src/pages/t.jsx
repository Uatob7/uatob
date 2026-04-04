import { useEffect, useRef } from 'react';
import {
  CarFront, Clock3, DollarSign, ShieldCheck,
  BadgeCheck, Star, MapPin, Users,
  Zap, TrendingUp, ArrowRight, ChevronRight,
  Sparkles, Wallet, CircleDollarSign
} from 'lucide-react';

/* ─── TOKENS ─────────────────────────────────── */
const G    = '#16A34A';
const G2   = '#15803D';
const GL   = '#DCFCE7';
const GB   = '#BBF7D0';
const BG   = '#F7FCF8';
const WH   = '#FFFFFF';
const TXT  = '#0B1B11';
const MUT  = '#6B7280';
const BDR  = '#E5E7EB';
const GBDR = '#86EFAC';
const DARK = '#0D1F12';

/* ─── GLOBAL CSS ─────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Syne:wght@400;500;600;700;800&display=swap');

.dsl * { box-sizing:border-box; margin:0; padding:0; }
.dsl {
  background:${BG};
  color:${TXT};
  font-family:'Syne',system-ui,sans-serif;
  overflow-x:hidden;
  min-height:100vh;
}

.sr {
  opacity:0;
  transform:translateY(24px);
  transition:opacity .6s ease, transform .6s ease;
}
.sr.in {
  opacity:1;
  transform:none;
}

@keyframes tick { from { transform:translateX(0) } to { transform:translateX(-50%) } }
@keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
@keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
@keyframes pulseGlow {
  0%,100% { transform:scale(1); opacity:.9; }
  50% { transform:scale(1.08); opacity:.65; }
}
@keyframes roadSc { from{background-position:0 0} to{background-position:0 72px} }

.dsl-cta {
  width:100%;
  border:none;
  border-radius:18px;
  padding:18px 22px;
  background:linear-gradient(90deg,#16A34A 0%,#15803D 35%,#16A34A 75%,#15803D 100%);
  background-size:220% auto;
  color:#fff;
  font-family:'Syne',sans-serif;
  font-size:16px;
  font-weight:800;
  letter-spacing:.02em;
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  box-shadow:0 16px 40px rgba(22,163,74,.28);
  animation:shimmer 4s linear infinite;
  transition:transform .18s ease, box-shadow .18s ease, filter .18s ease;
}
.dsl-cta:hover {
  transform:translateY(-2px);
  box-shadow:0 20px 50px rgba(22,163,74,.34);
  filter:brightness(1.02);
}
.dsl-cta:active { transform:translateY(0); }

.dsl-card {
  background:${WH};
  border:1px solid ${BDR};
  border-radius:24px;
  box-shadow:0 6px 28px rgba(0,0,0,.045);
  transition:border-color .25s ease, box-shadow .25s ease, transform .2s ease;
  overflow:hidden;
}
.dsl-card:hover {
  border-color:${GBDR};
  box-shadow:0 12px 36px rgba(22,163,74,.08);
  transform:translateY(-2px);
}

.dsl-chip {
  display:inline-flex;
  align-items:center;
  gap:6px;
  background:${GL};
  border:1px solid ${GBDR};
  border-radius:999px;
  padding:8px 14px;
  font-size:12px;
  font-weight:800;
  color:${G};
  letter-spacing:.04em;
}

.dsl-section-label {
  font-size:11px;
  font-weight:800;
  color:${G};
  letter-spacing:.18em;
  text-transform:uppercase;
  margin-bottom:10px;
}

.dsl-title {
  font-family:'Bebas Neue',sans-serif;
  font-size:42px;
  line-height:1;
  letter-spacing:.01em;
}

.dsl-req-row:last-child {
  border-bottom:none !important;
  padding-bottom:0 !important;
}

.dsl-divider {
  width:100%;
  height:1px;
  background:${BDR};
}

.dsl-glass {
  background:rgba(255,255,255,.78);
  backdrop-filter:blur(14px);
  -webkit-backdrop-filter:blur(14px);
  border:1px solid rgba(255,255,255,.7);
}

@media (max-width: 360px) {
  .dsl-title { font-size:38px; }
}
`;

/* ─── SUB-COMPONENTS ─────────────────────────── */
function Stat({ value, label, sub }) {
  return (
    <div style={{ textAlign:'center', flex:1 }}>
      <div
        style={{
          fontFamily:"'Bebas Neue',sans-serif",
          fontSize:46,
          lineHeight:1,
          color:G
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize:11,
          fontWeight:800,
          color:MUT,
          letterSpacing:'.08em',
          textTransform:'uppercase',
          marginTop:4
        }}
      >
        {label}
      </div>
      {sub && (
        <div style={{ fontSize:11, color:MUT, marginTop:6 }}>
          {sub}
        </div>
      )}
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
    }, { threshold:.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="sr dsl-card"
      style={{
        padding:'22px 18px',
        transitionDelay:`${delay}s`,
        minHeight:180
      }}
    >
      <div
        style={{
          width:48,
          height:48,
          borderRadius:16,
          background:GL,
          border:`1px solid ${GBDR}`,
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
          marginBottom:14
        }}
      >
        <Icon size={20} color={G} />
      </div>

      <div style={{ fontSize:15, fontWeight:800, color:TXT, marginBottom:7 }}>
        {title}
      </div>

      <div style={{ fontSize:13, color:MUT, lineHeight:1.7 }}>
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
        display:'flex',
        alignItems:'center',
        gap:14,
        padding:'16px 0',
        borderBottom:`1px solid ${BDR}`
      }}
    >
      <div
        style={{
          width:40,
          height:40,
          minWidth:40,
          borderRadius:14,
          background:GL,
          border:`1px solid ${GBDR}`,
          display:'flex',
          alignItems:'center',
          justifyContent:'center'
        }}
      >
        <Icon size={17} color={G} />
      </div>

      <span style={{ fontSize:14, fontWeight:700, color:TXT }}>
        {text}
      </span>

      <div
        style={{
          marginLeft:'auto',
          width:24,
          height:24,
          borderRadius:'50%',
          background:GL,
          border:`1px solid ${GBDR}`,
          display:'flex',
          alignItems:'center',
          justifyContent:'center'
        }}
      >
        <ChevronRight size={12} color={G} />
      </div>
    </div>
  );
}

function StepCard({ number, title, desc }) {
  return (
    <div className="dsl-card" style={{ padding:'20px 18px' }}>
      <div
        style={{
          width:36,
          height:36,
          borderRadius:'50%',
          background:GL,
          border:`1px solid ${GBDR}`,
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
          fontWeight:800,
          color:G,
          marginBottom:14
        }}
      >
        {number}
      </div>
      <div style={{ fontSize:15, fontWeight:800, marginBottom:6 }}>{title}</div>
      <div style={{ fontSize:13, color:MUT, lineHeight:1.7 }}>{desc}</div>
    </div>
  );
}

/* ─── MAIN ───────────────────────────────────── */
export default function DriverSignupLanding({ onStartApplication }) {
  useEffect(() => {
    const els = document.querySelectorAll('.dsl .sr');
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('in');
      });
    }, { threshold:.12 });

    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const fire = () => typeof onStartApplication === 'function' && onStartApplication();

  const BENEFITS = [
    {
      icon:DollarSign,
      title:'Keep 80% of every fare',
      desc:'UaTob drivers keep more from every ride, with no confusing payout math or hidden cuts.'
    },
    {
      icon:Zap,
      title:'Next-day payouts',
      desc:'Your money lands fast. No weekly waiting cycle and no payout mystery.'
    },
    {
      icon:MapPin,
      title:'Orlando-focused demand',
      desc:'Built for the routes drivers actually want — airport, nightlife, events, and campus runs.'
    },
    {
      icon:TrendingUp,
      title:'Fair surge pricing',
      desc:'When demand goes up, you see it clearly. No black-box pricing games.'
    },
    {
      icon:Clock3,
      title:'Drive whenever you want',
      desc:'Go online when it works for you. No minimum hours and no forced schedules.'
    },
    {
      icon:ShieldCheck,
      title:'Real human support',
      desc:'You can actually reach the team when something matters — fast.'
    },
  ];

  const TICKER = [
    '80% earnings split',
    'Next-day payouts',
    'Orlando-first',
    'Zero hidden fees',
    'Founding driver perks',
    'Fair surge pricing',
    'Clean driver app',
    'Airport demand',
    'Night run opportunities'
  ];

  return (
    <div className="dsl">
      <style>{CSS}</style>

      {/* ── HERO ──────────────────────────────────── */}
      <section style={{ position:'relative', overflow:'hidden' }}>
        {/* road grid */}
        <div
          style={{
            position:'absolute',
            inset:0,
            pointerEvents:'none',
            backgroundImage:`linear-gradient(rgba(22,163,74,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(22,163,74,.055) 1px,transparent 1px)`,
            backgroundSize:'72px 72px',
            animation:'roadSc 10s linear infinite',
            transform:'perspective(700px) rotateX(54deg) scale(2.8) translateY(14%)',
            transformOrigin:'center bottom'
          }}
        />

        {/* glow blobs */}
        <div
          style={{
            position:'absolute',
            width:420,
            height:420,
            borderRadius:'50%',
            background:'rgba(22,163,74,.08)',
            filter:'blur(110px)',
            top:-140,
            right:-100,
            pointerEvents:'none',
            animation:'floatY 9s ease-in-out infinite'
          }}
        />
        <div
          style={{
            position:'absolute',
            width:280,
            height:280,
            borderRadius:'50%',
            background:'rgba(22,163,74,.06)',
            filter:'blur(90px)',
            bottom:0,
            left:-60,
            pointerEvents:'none',
            animation:'floatY 12s ease-in-out infinite reverse'
          }}
        />

        <div style={{ position:'relative', zIndex:2, padding:'54px 22px 34px' }}>
          {/* badge */}
          <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
            <div
              className="dsl-glass"
              style={{
                display:'inline-flex',
                alignItems:'center',
                gap:8,
                borderRadius:999,
                padding:'9px 16px',
                fontSize:11,
                fontWeight:800,
                color:G,
                letterSpacing:'.1em',
                textTransform:'uppercase'
              }}
            >
              <span
                style={{
                  width:8,
                  height:8,
                  borderRadius:'50%',
                  background:G,
                  display:'inline-block',
                  animation:'pulseGlow 1.6s ease-in-out infinite'
                }}
              />
              Now recruiting · Orlando, FL
            </div>
          </div>

          {/* headline */}
          <h1
            style={{
              fontFamily:"'Bebas Neue',sans-serif",
              fontSize:'clamp(68px,20vw,108px)',
              lineHeight:.88,
              letterSpacing:'.01em',
              textAlign:'center',
              marginBottom:10
            }}
          >
            <span style={{ color:G }}>EARN</span><br />
            <span style={{ WebkitTextStroke:`2px rgba(13,31,18,.15)`, color:'transparent' }}>
              MORE.
            </span><br />
            DRIVE SMART.
          </h1>

          <p
            style={{
              textAlign:'center',
              fontSize:15,
              color:MUT,
              lineHeight:1.75,
              maxWidth:345,
              margin:'16px auto 28px',
              fontWeight:500
            }}
          >
            Join Orlando’s driver-first rideshare platform with higher take-home pay,
            faster payouts, and fewer headaches.
          </p>

          {/* chips */}
          <div
            style={{
              display:'flex',
              justifyContent:'center',
              flexWrap:'wrap',
              gap:8,
              marginBottom:30
            }}
          >
            <div className="dsl-chip"><Wallet size={12} />Keep 80%</div>
            <div className="dsl-chip"><Zap size={12} />Paid next day</div>
            <div className="dsl-chip"><Sparkles size={12} />Founding perks</div>
          </div>

          {/* Hero earning card */}
          <div
            className="sr dsl-card"
            style={{
              padding:'18px',
              marginBottom:18,
              background:'linear-gradient(180deg,#ffffff 0%, #f8fff9 100%)'
            }}
          >
            <div
              style={{
                display:'flex',
                alignItems:'center',
                justifyContent:'space-between',
                marginBottom:14
              }}
            >
              <div>
                <div style={{ fontSize:12, fontWeight:800, color:G, letterSpacing:'.12em', textTransform:'uppercase' }}>
                  Driver snapshot
                </div>
                <div style={{ fontSize:18, fontWeight:800, marginTop:6 }}>
                  20 hours can go a long way
                </div>
              </div>

              <div
                style={{
                  width:48,
                  height:48,
                  borderRadius:16,
                  background:GL,
                  border:`1px solid ${GBDR}`,
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center'
                }}
              >
                <CircleDollarSign size={22} color={G} />
              </div>
            </div>

            <div
              style={{
                display:'grid',
                gridTemplateColumns:'1fr 1fr',
                gap:10
              }}
            >
              {[
                ['Avg fare', '$15'],
                ['Your cut', '$12'],
                ['40 trips', '~$480'],
                ['Busy week', '$600+']
              ].map(([k,v]) => (
                <div
                  key={k}
                  style={{
                    background:WH,
                    border:`1px solid ${BDR}`,
                    borderRadius:16,
                    padding:'14px 12px'
                  }}
                >
                  <div style={{ fontSize:12, color:MUT, fontWeight:700, marginBottom:5 }}>{k}</div>
                  <div style={{ fontSize:20, fontWeight:800, color:TXT }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          <button className="dsl-cta" onClick={fire}>
            Start Application <ArrowRight size={18} />
          </button>

          <p style={{ textAlign:'center', fontSize:11, color:MUT, marginTop:12 }}>
            Takes under 3 minutes · Free to join
          </p>
        </div>
      </section>

      {/* ── TICKER ────────────────────────────────── */}
      <section
        style={{
          borderTop:`1px solid ${BDR}`,
          borderBottom:`1px solid ${BDR}`,
          overflow:'hidden',
          padding:'13px 0',
          background:GL
        }}
      >
        <div
          style={{
            display:'flex',
            gap:56,
            whiteSpace:'nowrap',
            animation:'tick 20s linear infinite'
          }}
        >
          {[...TICKER, ...TICKER].map((t, i) => (
            <span
              key={i}
              style={{
                display:'inline-flex',
                alignItems:'center',
                gap:10,
                fontSize:12,
                fontWeight:800,
                color:G,
                letterSpacing:'.1em',
                textTransform:'uppercase'
              }}
            >
              <span style={{ opacity:.45, fontSize:14 }}>◆</span>{t}
            </span>
          ))}
        </div>
      </section>

      {/* ── STATS ─────────────────────────────────── */}
      <section
        style={{
          display:'flex',
          padding:'32px 22px',
          borderBottom:`1px solid ${BDR}`,
          background:WH
        }}
      >
        <Stat value="80%" label="Driver cut" />
        <div style={{ width:1, background:BDR, margin:'0 4px' }} />
        <Stat value="24H" label="Payouts" />
        <div style={{ width:1, background:BDR, margin:'0 4px' }} />
        <Stat value="$0" label="To join" />
      </section>

      {/* ── BENEFITS ──────────────────────────────── */}
      <section style={{ padding:'42px 22px' }}>
        <div className="sr" style={{ marginBottom:24 }}>
          <div className="dsl-section-label">Why drivers switch</div>
          <div className="dsl-title">
            BUILT FOR<br /><span style={{ color:G }}>DRIVERS.</span>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {BENEFITS.map((b, i) => (
            <BenCard key={i} {...b} delay={i * 0.07} />
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────── */}
      <section style={{ padding:'0 22px 34px' }}>
        <div className="sr" style={{ marginBottom:18 }}>
          <div className="dsl-section-label">How it works</div>
          <div className="dsl-title">
            APPLY.<br /><span style={{ color:G }}>GET APPROVED.</span>
          </div>
        </div>

        <div style={{ display:'grid', gap:12 }}>
          <StepCard number="1" title="Submit your info" desc="Start your application and tell us a little about you and your vehicle." />
          <StepCard number="2" title="Upload documents" desc="Add your license, insurance, and vehicle details securely in the app." />
          <StepCard number="3" title="Start driving" desc="Once approved, go online and begin earning on your own schedule." />
        </div>
      </section>

      {/* ── REQUIREMENTS ──────────────────────────── */}
      <section style={{ padding:'0 22px 34px' }}>
        <div className="sr" style={{ marginBottom:18 }}>
          <div className="dsl-section-label">Requirements</div>
          <div className="dsl-title">
            WHAT YOU’LL<br />NEED TO APPLY
          </div>
        </div>

        <div className="sr dsl-card" style={{ padding:'4px 20px 8px' }}>
          <ReqRow icon={BadgeCheck} text="Valid driver's license" />
          <ReqRow icon={CarFront} text="Eligible 4-door vehicle" />
          <ReqRow icon={ShieldCheck} text="Active vehicle insurance" />
          <ReqRow icon={Star} text="Clean driving record" />
          <ReqRow icon={Users} text="Professional, rider-friendly attitude" />
        </div>
      </section>

      {/* ── TRUST / TESTIMONIAL ───────────────────── */}
      <section style={{ padding:'0 22px 34px' }}>
        <div
          className="sr"
          style={{
            background:`linear-gradient(135deg,${GL},#f0fdf4)`,
            border:`1px solid ${GBDR}`,
            borderRadius:24,
            padding:'26px 22px'
          }}
        >
          <div style={{ display:'flex', gap:3, marginBottom:14 }}>
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={16} fill={G} color={G} />
            ))}
          </div>

          <p
            style={{
              fontSize:15,
              fontWeight:700,
              color:TXT,
              lineHeight:1.7,
              marginBottom:18
            }}
          >
            "The pay structure makes way more sense. I know what I’m making, and
            the app doesn’t fight me every step of the way."
          </p>

          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div
              style={{
                width:42,
                height:42,
                borderRadius:'50%',
                background:GB,
                border:`1px solid ${GBDR}`,
                display:'flex',
                alignItems:'center',
                justifyContent:'center',
                fontSize:18
              }}
            >
              👤
            </div>

            <div>
              <div style={{ fontSize:13, fontWeight:800, color:TXT }}>Marcus J.</div>
              <div style={{ fontSize:11, color:MUT }}>UaTob driver · Orlando, FL</div>
            </div>

            <div className="dsl-chip" style={{ marginLeft:'auto', fontSize:11 }}>
              Founding Driver
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────── */}
      <section style={{ padding:'0 22px 60px' }}>
        <div
          className="sr dsl-card"
          style={{
            padding:'30px 22px',
            marginBottom:18,
            textAlign:'center',
            background:'linear-gradient(180deg,#ffffff 0%, #f8fff9 100%)'
          }}
        >
          <div
            style={{
              fontFamily:"'Bebas Neue',sans-serif",
              fontSize:46,
              lineHeight:1,
              marginBottom:12
            }}
          >
            READY TO<br /><span style={{ color:G }}>START EARNING?</span>
          </div>

          <p style={{ fontSize:13, color:MUT, lineHeight:1.75 }}>
            Join the first wave of founding drivers and get priority onboarding,
            early access perks, and direct support.
          </p>
        </div>

        <button className="dsl-cta" onClick={fire}>
          Start Application <ArrowRight size={18} />
        </button>

        <p
          style={{
            textAlign:'center',
            fontSize:11,
            color:MUT,
            marginTop:14,
            lineHeight:1.7
          }}
        >
          By continuing, you begin the UaTob driver onboarding process.
          Free to join, no commitments.
        </p>
      </section>
    </div>
  );
}