import { useState, useEffect } from "react";

const GREEN       = '#22C55E';
const GREEN_BRIGHT = '#4ADE80';
const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";

const BOOT_LINES = [
  'Connecting to dispatch…',
  'Scanning nearby drivers…',
  'Loading fare engine…',
  'Ready',
];

function RadarIcon({ size = 52 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="ldr-car" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4ADE80"/>
          <stop offset="100%" stopColor="#16A34A"/>
        </linearGradient>
        <radialGradient id="ldr-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#4ADE80" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#4ADE80" stopOpacity="0"/>
        </radialGradient>
      </defs>

      {/* glow disc */}
      <circle cx="32" cy="32" r="30" fill="url(#ldr-glow)"/>

      {/* road arc */}
      <path d="M 10 46 Q 32 22 54 46"
        stroke="url(#ldr-car)" strokeWidth="1.8"
        strokeDasharray="5 4" strokeLinecap="round"
        fill="none" opacity="0.5"/>

      {/* A dot */}
      <circle cx="10" cy="46" r="4" fill="rgba(34,197,94,.18)"/>
      <circle cx="10" cy="46" r="2.2" fill={GREEN}/>

      {/* B dot */}
      <circle cx="54" cy="46" r="4" fill="rgba(74,222,128,.18)"/>
      <circle cx="54" cy="46" r="2.2" fill={GREEN_BRIGHT}/>

      {/* car body */}
      <g transform="translate(25.5,24)">
        <rect x="1" y="5" width="11" height="6.5" rx="1.5" fill="url(#ldr-car)"/>
        <path d="M3 5 L4 1.5 L9 1.5 L10 5Z" fill="#16A34A"/>
        <rect x="3.5" y="2" width="2.5" height="2.2" rx="0.5" fill="rgba(255,255,255,.85)"/>
        <rect x="6.5" y="2" width="2.5" height="2.2" rx="0.5" fill="rgba(255,255,255,.85)"/>
        <circle cx="3.2" cy="11.5" r="1.8" fill="#030604"/>
        <circle cx="3.2" cy="11.5" r="0.9" fill={GREEN}/>
        <circle cx="9.8" cy="11.5" r="1.8" fill="#030604"/>
        <circle cx="9.8" cy="11.5" r="0.9" fill={GREEN_BRIGHT}/>
        <rect x="11.5" y="6.5" width="1.8" height="1.2" rx="0.4" fill="#FCD34D"/>
      </g>
    </svg>
  );
}

export default function Loader() {
  const [lineIdx, setLineIdx] = useState(0);
  const [blink,   setBlink]   = useState(true);

  useEffect(() => {
    if (lineIdx >= BOOT_LINES.length - 1) return;
    const t = setTimeout(() => setLineIdx(i => i + 1), 700);
    return () => clearTimeout(t);
  }, [lineIdx]);

  useEffect(() => {
    const t = setInterval(() => setBlink(b => !b), 530);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#050A06',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');

        @keyframes ldrSpin   { to { transform: rotate(360deg); } }
        @keyframes ldrPulse  { 0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.35)} 50%{box-shadow:0 0 0 10px rgba(34,197,94,0)} }
        @keyframes ldrScan   { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        @keyframes ldrIn     { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ldrLineIn { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }
        @keyframes ldrBlink  { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28,
        animation: 'ldrIn .5s cubic-bezier(.34,1.2,.64,1) both' }}>

        {/* spinning ring + icon */}
        <div style={{ position: 'relative', width: 100, height: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

          {/* track ring */}
          <svg width="100" height="100" viewBox="0 0 100 100"
            style={{ position: 'absolute', inset: 0 }}>
            <circle cx="50" cy="50" r="46" fill="none"
              stroke="rgba(34,197,94,.10)" strokeWidth="2"/>
          </svg>

          {/* spinning arc */}
          <svg width="100" height="100" viewBox="0 0 100 100"
            style={{ position: 'absolute', inset: 0, animation: 'ldrSpin .9s linear infinite' }}>
            <circle cx="50" cy="50" r="46" fill="none"
              stroke={GREEN_BRIGHT} strokeWidth="2" strokeLinecap="round"
              strokeDasharray="72 217"/>
          </svg>

          {/* icon container */}
          <div style={{
            width: 64, height: 64, borderRadius: 18, flexShrink: 0,
            background: 'rgba(34,197,94,.08)',
            border: '1px solid rgba(34,197,94,.22)',
            boxShadow: `0 0 28px rgba(74,222,128,.18)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', overflow: 'hidden',
            animation: 'ldrPulse 2.4s ease-in-out infinite',
          }}>
            {/* scan line */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, transparent, ${GREEN_BRIGHT}, transparent)`,
              opacity: 0.7,
              animation: 'ldrScan 2s linear infinite',
            }}/>
            <RadarIcon size={40}/>
          </div>
        </div>

        {/* wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: COND, fontWeight: 900, fontSize: 32,
            color: '#fff', letterSpacing: '.04em', lineHeight: 1 }}>
            Ua
          </span>
          <div style={{ width: 2, height: 22, borderRadius: 2,
            background: `linear-gradient(to bottom, ${GREEN}, ${GREEN_BRIGHT})` }}/>
          <span style={{ fontFamily: COND, fontWeight: 900, fontSize: 32,
            color: GREEN_BRIGHT, letterSpacing: '.04em', lineHeight: 1,
            textShadow: `0 0 20px rgba(74,222,128,.4)` }}>
            Tob
          </span>
        </div>

        {/* boot log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 220 }}>
          {BOOT_LINES.slice(0, lineIdx + 1).map((line, i) => {
            const done = i < lineIdx;
            const cur  = i === lineIdx;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8,
                animation: 'ldrLineIn .22s ease both' }}>
                <div style={{
                  width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                  background: done ? GREEN : cur ? GREEN_BRIGHT : 'rgba(255,255,255,.18)',
                  boxShadow: cur ? `0 0 7px ${GREEN_BRIGHT}` : 'none',
                  animation: cur ? 'ldrBlink 1.1s ease-in-out infinite' : 'none',
                }}/>
                <span style={{
                  fontFamily: MONO, fontSize: 9.5, fontWeight: done ? 500 : 700,
                  color: done ? 'rgba(34,197,94,.5)' : cur ? GREEN_BRIGHT : 'rgba(255,255,255,.22)',
                  letterSpacing: '.04em',
                }}>
                  {line}
                  {cur && (
                    <span style={{ opacity: blink ? 1 : 0, transition: 'none',
                      marginLeft: 2, color: GREEN_BRIGHT }}>▌</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* Orlando tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 4, height: 4, borderRadius: '50%',
            background: GREEN_BRIGHT, boxShadow: `0 0 6px ${GREEN_BRIGHT}`,
            animation: 'ldrBlink 1.6s ease-in-out infinite' }}/>
          <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700,
            color: 'rgba(255,255,255,.28)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
            Orlando, FL · flat-rate · no surge
          </span>
        </div>

      </div>
    </div>
  );
}
