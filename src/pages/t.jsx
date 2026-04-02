import { useEffect, useRef } from 'react';
import {
  CarFront, Clock3, DollarSign, ShieldCheck,
  BadgeCheck, Star, MapPin, Users,
  Zap, TrendingUp, ArrowRight, ChevronRight,
} from 'lucide-react';

/* ─── TOKENS ─────────────────────────────────── */
const G    = '#16A34A';
const GL   = '#DCFCE7';
const GB   = '#BBF7D0';
const BG   = '#F8FFF9';
const WH   = '#FFFFFF';
const TXT  = '#0D1F12';
const MUT  = '#6B7280';
const BDR  = '#E5E7EB';
const GBDR = '#86EFAC';

/* ─── GLOBAL CSS ─────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Syne:wght@400;600;700;800&display=swap');

.dsl * { box-sizing:border-box; margin:0; padding:0; }
.dsl { background:${BG}; color:${TXT}; font-family:'Syne',system-ui,sans-serif; overflow-x:hidden; }

.sr { opacity:0; transform:translateY(18px); transition:opacity .5s ease,transform .5s ease; }
.sr.in { opacity:1; transform:none; }

@keyframes tick   { from{transform:translateX(0)} to{transform:translateX(-50%)} }
@keyframes shimmer{ 0%{background-position:-200% center} 100%{background-position:200% center} }
@keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
@keyframes roadSc { from{background-position:0 0} to{background-position:0 72px} }

.dsl-cta {
  width:100%; border:none; border-radius:16px; padding:18px 24px;
  background:linear-gradient(90deg,#16A34A 0%,#15803D 40%,#16A34A 80%,#15803D 100%);
  background-size:200% auto;
  color:#fff; font-family:'Syne',sans-serif;
  font-size:17px; font-weight:800; letter-spacing:.02em; cursor:pointer;
  display:flex; align-items:center; justify-content:center; gap:8px;
  box-shadow:0 14px 36px rgba(22,163,74,.28);
  animation:shimmer 3.5s linear infinite;
  transition:transform .2s,box-shadow .2s;
}
.dsl-cta:hover  { transform:translateY(-2px); box-shadow:0 20px 48px rgba(22,163,74,.35); }
.dsl-cta:active { transform:translateY(0); }

.dsl-card {
  background:${WH}; border:1px solid ${BDR}; border-radius:20px;
  box-shadow:0 4px 20px rgba(0,0,0,.04);
  transition:border-color .25s,box-shadow .25s;
}
.dsl-card:hover { border-color:${GBDR}; box-shadow:0 8px 32px rgba(22,163,74,.08); }

.dsl-chip {
  display:inline-flex; align-items:center; gap:6px;
  background:${GL}; border:1px solid ${GBDR};
  border-radius:999px; padding:7px 13px;
  font-size:12px; font-weight:700; color:${G}; letter-spacing:.04em;
}

.dsl-req-row:last-child { border-bottom:none !important; padding-bottom:0 !important; }
`;

/* ─── SUB-COMPONENTS ─────────────────────────── */
function Stat({ value, label }) {
  return (
    <div style={{ textAlign:'center', flex:1 }}>
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:44, lineHeight:1, color:G }}>{value}</div>
      <div style={{ fontSize:11, fontWeight:700, color:MUT, letterSpacing:'.08em', textTransform:'uppercase', marginTop:4 }}>{label}</div>
    </div>
  );
}

function BenCard({ icon: Icon, title, desc, delay = 0 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) el.classList.add('in'); }, { threshold:.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className="sr dsl-card" style={{ padding:'22px 20px', transitionDelay:`${delay}s` }}>
      <div style={{ width:46, height:46, borderRadius:14, background:GL, border:`1px solid ${GBDR}`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14 }}>
        <Icon size={20} color={G} />
      </div>
      <div style={{ fontSize:15, fontWeight:800, color:TXT, marginBottom:6 }}>{title}</div>
      <div style={{ fontSize:13, color:MUT, lineHeight:1.65 }}>{desc}</div>
    </div>
  );
}

function ReqRow({ icon: Icon, text }) {
  return (
    <div className="dsl-req-row" style={{ display:'flex', alignItems:'center', gap:14, padding:'15px 0', borderBottom:`1px solid ${BDR}` }}>
      <div style={{ width:38, height:38, minWidth:38, borderRadius:12, background:GL, border:`1px solid ${GBDR}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Icon size={16} color={G} />
      </div>
      <span style={{ fontSize:14, fontWeight:700, color:TXT }}>{text}</span>
      <div style={{ marginLeft:'auto', width:22, height:22, borderRadius:'50%', background:GL, border:`1px solid ${GBDR}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <ChevronRight size={12} color={G} />
      </div>
    </div>
  );
}

/* ─── MAIN ───────────────────────────────────── */
export default function DriverSignupLanding({ onStartApplication }) {

  useEffect(() => {
    const els = document.querySelectorAll('.dsl .sr');
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
    }, { threshold:.12 });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const fire = () => typeof onStartApplication === 'function' && onStartApplication();

  const BENEFITS = [
    { icon:DollarSign,  title:'Keep 80% of every fare',    desc:"Uber takes 25–40%. UaTob drivers pocket 80 cents of every dollar — on every single ride." },
    { icon:Zap,         title:'Next-day payouts',           desc:'Money hits your account the next morning. No weekly waits, no mystery holds.' },
    { icon:MapPin,      title:'Orlando built-in demand',    desc:'I-Drive, MCO, UCF, downtown — high-volume zones where your car is always needed.' },
    { icon:TrendingUp,  title:'Transparent surge',          desc:'See exactly why prices spike. Earn more when demand is real — no hidden math.' },
    { icon:Clock3,      title:'Drive on your schedule',     desc:'Go online whenever you want. No minimums, no forced shifts, no penalties.' },
    { icon:ShieldCheck, title:'Real driver support',        desc:'A small team that actually picks up the phone — not a chatbot ticket queue.' },
  ];

  const TICKER = ['80% earnings split','Next-day payouts','Orlando-first','Zero hidden fees','Founding driver perks','Fair surge pricing','Clean driver app','MCO airport demand','UCF night runs'];

  return (
    <div className="dsl">
      <style>{CSS}</style>

      {/* ── HERO ──────────────────────────────────── */}
      <div style={{ position:'relative', overflow:'hidden' }}>
        {/* road grid */}
        <div style={{
          position:'absolute', inset:0, pointerEvents:'none',
          backgroundImage:`linear-gradient(rgba(22,163,74,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(22,163,74,.06) 1px,transparent 1px)`,
          backgroundSize:'72px 72px',
          animation:'roadSc 10s linear infinite',
          transform:'perspective(700px) rotateX(52deg) scale(2.8) translateY(12%)',
          transformOrigin:'center bottom',
        }} />
        {/* glow blobs */}
        <div style={{ position:'absolute', width:420, height:420, borderRadius:'50%', background:'rgba(22,163,74,.07)', filter:'blur(100px)', top:-140, right:-100, pointerEvents:'none', animation:'floatY 9s ease-in-out infinite' }} />
        <div style={{ position:'absolute', width:280, height:280, borderRadius:'50%', background:'rgba(22,163,74,.05)', filter:'blur(80px)', bottom:0, left:-60, pointerEvents:'none', animation:'floatY 12s ease-in-out infinite reverse' }} />

        <div style={{ position:'relative', zIndex:2, padding:'56px 22px 40px' }}>
          {/* live badge */}
          <div style={{ display:'flex', justifyContent:'center', marginBottom:22 }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:GL, border:`1px solid ${GBDR}`, borderRadius:999, padding:'8px 16px', fontSize:11, fontWeight:800, color:G, letterSpacing:'.1em', textTransform:'uppercase' }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:G, display:'inline-block' }} />
              Now recruiting · Orlando, FL
            </div>
          </div>

          {/* headline */}
          <h1 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'clamp(70px,20vw,104px)', lineHeight:.9, letterSpacing:'.01em', textAlign:'center', marginBottom:6 }}>
            <span style={{ color:G }}>EARN</span><br/>
            <span style={{ WebkitTextStroke:`2px rgba(13,31,18,.15)`, color:'transparent' }}>MORE.</span><br/>
            DRIVE FREE.
          </h1>

          <p style={{ textAlign:'center', fontSize:15, color:MUT, lineHeight:1.72, maxWidth:340, margin:'20px auto 28px', fontWeight:400 }}>
            UaTob is Orlando's driver-first platform. Better cut, faster payouts, and a clean app that stays out of your way.
          </p>

          {/* chips */}
          <div style={{ display:'flex', justifyContent:'center', flexWrap:'wrap', gap:8, marginBottom:34 }}>
            <div className="dsl-chip"><DollarSign size={12} />Keep 80%</div>
            <div className="dsl-chip"><Zap size={12} />Next-day pay</div>
            <div className="dsl-chip"><MapPin size={12} />Orlando only</div>
          </div>

          <button className="dsl-cta" onClick={fire}>
            Start Application <ArrowRight size={18} />
          </button>
          <p style={{ textAlign:'center', fontSize:11, color:MUT, marginTop:12 }}>Takes less than 3 minutes · Free to join</p>
        </div>
      </div>

      {/* ── TICKER ────────────────────────────────── */}
      <div style={{ borderTop:`1px solid ${BDR}`, borderBottom:`1px solid ${BDR}`, overflow:'hidden', padding:'13px 0', background:GL }}>
        <div style={{ display:'flex', gap:56, whiteSpace:'nowrap', animation:'tick 20s linear infinite' }}>
          {[...TICKER,...TICKER].map((t,i) => (
            <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:10, fontSize:12, fontWeight:700, color:G, letterSpacing:'.1em', textTransform:'uppercase' }}>
              <span style={{ opacity:.45, fontSize:14 }}>◆</span>{t}
            </span>
          ))}
        </div>
      </div>

      {/* ── STATS ─────────────────────────────────── */}
      <div style={{ display:'flex', padding:'32px 22px', borderBottom:`1px solid ${BDR}`, background:WH }}>
        <Stat value="80%" label="Driver cut" />
        <div style={{ width:1, background:BDR, margin:'0 4px' }} />
        <Stat value="24H" label="Payouts" />
        <div style={{ width:1, background:BDR, margin:'0 4px' }} />
        <Stat value="$0"  label="To join" />
      </div>

      {/* ── BENEFITS ──────────────────────────────── */}
      <div style={{ padding:'40px 22px' }}>
        <div className="sr" style={{ marginBottom:24 }}>
          <div style={{ fontSize:11, fontWeight:800, color:G, letterSpacing:'.16em', textTransform:'uppercase', marginBottom:8 }}>Why UaTob</div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:42, lineHeight:1 }}>
            BUILT FOR<br/><span style={{ color:G }}>DRIVERS.</span>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {BENEFITS.map((b,i) => <BenCard key={i} {...b} delay={i * 0.07} />)}
        </div>
      </div>

      {/* ── EARNINGS TABLE ────────────────────────── */}
      <div style={{ padding:'0 22px 32px' }}>
        <div className="sr dsl-card" style={{ padding:'26px 22px', overflow:'hidden', position:'relative' }}>
          <div style={{ position:'absolute', right:-40, top:-40, width:160, height:160, borderRadius:'50%', background:'rgba(22,163,74,.05)', pointerEvents:'none' }} />
          <div style={{ fontSize:11, fontWeight:800, color:G, letterSpacing:'.16em', textTransform:'uppercase', marginBottom:8 }}>Earning potential</div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, lineHeight:1, marginBottom:18 }}>
            WHAT DOES<br/><span style={{ color:G }}>$600/WEEK</span> LOOK LIKE?
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
            {[
              { label:'20 hrs / week', val:'~40 trips' },
              { label:'Avg fare',      val:'$15' },
              { label:'Your cut',      val:'80% = $12' },
              { label:'Weekly take',   val:'~$480–$640' },
            ].map(r => (
              <div key={r.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 14px', background:BG, borderRadius:12, border:`1px solid ${BDR}` }}>
                <span style={{ fontSize:13, color:MUT, fontWeight:600 }}>{r.label}</span>
                <span style={{ fontSize:14, fontWeight:800, color:TXT }}>{r.val}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize:12, color:MUT, lineHeight:1.65 }}>Based on typical Orlando demand. Drive more, earn more — no cap.</p>
        </div>
      </div>

      {/* ── REQUIREMENTS ──────────────────────────── */}
      <div style={{ padding:'0 22px 32px' }}>
        <div className="sr" style={{ marginBottom:18 }}>
          <div style={{ fontSize:11, fontWeight:800, color:G, letterSpacing:'.16em', textTransform:'uppercase', marginBottom:8 }}>Requirements</div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:38, lineHeight:1 }}>WHAT YOU'LL<br/>NEED TO APPLY</div>
        </div>
        <div className="sr dsl-card" style={{ padding:'4px 20px 8px' }}>
          <ReqRow icon={BadgeCheck}  text="Valid driver's license" />
          <ReqRow icon={CarFront}    text="Eligible 4-door vehicle" />
          <ReqRow icon={ShieldCheck} text="Active vehicle insurance" />
          <ReqRow icon={Star}        text="Clean driving record" />
          <ReqRow icon={Users}       text="Professional, rider-friendly attitude" />
        </div>
      </div>

      {/* ── TESTIMONIAL ───────────────────────────── */}
      <div style={{ padding:'0 22px 32px' }}>
        <div className="sr" style={{ background:`linear-gradient(135deg,${GL},#f0fdf4)`, border:`1px solid ${GBDR}`, borderRadius:22, padding:'26px 22px' }}>
          <div style={{ display:'flex', gap:3, marginBottom:14 }}>
            {[...Array(5)].map((_,i) => <Star key={i} size={16} fill={G} color={G} />)}
          </div>
          <p style={{ fontSize:15, fontWeight:700, color:TXT, lineHeight:1.65, marginBottom:18 }}>
            "Better earnings than Uber from day one. The app is clean, payouts hit next morning. This is what driving should feel like."
          </p>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:40, height:40, borderRadius:'50%', background:GB, border:`1px solid ${GBDR}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>👤</div>
            <div>
              <div style={{ fontSize:13, fontWeight:800, color:TXT }}>Marcus J.</div>
              <div style={{ fontSize:11, color:MUT }}>UaTob driver · Orlando, FL</div>
            </div>
            <div className="dsl-chip" style={{ marginLeft:'auto', fontSize:11 }}>Founding Driver</div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM CTA ────────────────────────────── */}
      <div style={{ padding:'0 22px 60px' }}>
        <div className="sr dsl-card" style={{ padding:'30px 22px', marginBottom:18, textAlign:'center' }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:44, lineHeight:1, marginBottom:12 }}>
            READY TO<br/><span style={{ color:G }}>START EARNING?</span>
          </div>
          <p style={{ fontSize:13, color:MUT, lineHeight:1.7 }}>
            Join the first 50 founding drivers and unlock priority dispatch, bonus earnings, and a direct line to the UaTob team.
          </p>
        </div>
        <button className="dsl-cta" onClick={fire}>
          Start Application <ArrowRight size={18} />
        </button>
        <p style={{ textAlign:'center', fontSize:11, color:MUT, marginTop:14, lineHeight:1.65 }}>
          By continuing you begin the UaTob driver onboarding process. Free to join, no commitments.
        </p>
      </div>
    </div>
  );
}
