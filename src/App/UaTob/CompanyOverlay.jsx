import { useEffect, useRef } from 'react';

const C = {
  bg:           '#050A06',
  bgCard:       'rgba(5,12,7,0.97)',
  green:        '#22C55E',
  greenBright:  '#4ADE80',
  greenSoft:    '#34D399',
  cyan:         '#22D3EE',
  amber:        '#FBBF24',
  inkDim:       'rgba(255,255,255,.22)',
  inkFade:      'rgba(255,255,255,.10)',
  inkMid:       'rgba(255,255,255,.45)',
  inkBright:    'rgba(255,255,255,.88)',
  border:       'rgba(34,197,94,.15)',
  borderBright: 'rgba(74,222,128,.35)',
};

const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";
const BODY = "'Syne','Inter',sans-serif";

const KEYFRAMES = `
  @keyframes coSlideUp { from{opacity:0;transform:translateY(100%)} to{opacity:1;transform:translateY(0)} }
  @keyframes coFadeIn  { from{opacity:0} to{opacity:1} }
  @keyframes coBlink   { 0%,100%{opacity:1} 50%{opacity:.25} }
  @keyframes coGlow    { 0%,100%{box-shadow:0 0 18px rgba(74,222,128,.25)} 50%{box-shadow:0 0 36px rgba(74,222,128,.5)} }
`;

function Row({ label, value, mono = false }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 0',
      borderBottom: `1px solid ${C.border}`,
    }}>
      <span style={{ fontFamily: COND, fontSize: 11, fontWeight: 700,
        letterSpacing: '.14em', color: C.inkDim, textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontFamily: mono ? MONO : BODY, fontSize: 12, fontWeight: 600,
        color: C.inkBright, textAlign: 'right', maxWidth: '60%', lineHeight: 1.4 }}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontFamily: COND, fontSize: 10, fontWeight: 800,
        letterSpacing: '.2em', color: C.greenBright,
        textTransform: 'uppercase', marginBottom: 6,
        display: 'flex', alignItems: 'center', gap: 7,
      }}>
        <div style={{
          flex: 1, height: 1,
          background: `linear-gradient(90deg,${C.greenBright}44,transparent)`,
        }}/>
        {title}
        <div style={{
          flex: 1, height: 1,
          background: `linear-gradient(270deg,${C.greenBright}44,transparent)`,
        }}/>
      </div>
      {children}
    </div>
  );
}

export default function CompanyOverlay({ onClose }) {
  const sheetRef = useRef(null);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <style>{KEYFRAMES}</style>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(3,6,4,.72)', backdropFilter: 'blur(6px)',
          animation: 'coFadeIn .25s ease both',
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 51,
          maxHeight: '88vh', overflowY: 'auto',
          background: C.bgCard,
          borderTop: `1.5px solid ${C.borderBright}`,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: '0 0 40px',
          boxShadow: '0 -8px 48px rgba(0,0,0,.75), 0 0 40px rgba(34,197,94,.06)',
          animation: 'coSlideUp .38s cubic-bezier(.34,1.2,.64,1) both',
        }}
      >
        {/* Handle */}
        <div style={{
          display: 'flex', justifyContent: 'center', paddingTop: 10, marginBottom: 6,
        }}>
          <div style={{
            width: 36, height: 4, borderRadius: 99,
            background: 'rgba(255,255,255,.15)',
          }}/>
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 20px 18px',
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 14,
              background: 'rgba(34,197,94,.1)',
              border: `1.5px solid ${C.borderBright}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 18px rgba(34,197,94,.2)',
              animation: 'coGlow 3s ease-in-out infinite',
            }}>
              <span style={{ fontSize: 22 }}>🚕</span>
            </div>
            <div>
              <div style={{ fontFamily: COND, fontSize: 22, fontWeight: 900,
                letterSpacing: '.06em', color: C.inkBright, lineHeight: 1 }}>
                UATOB
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5, marginTop: 3,
              }}>
                <div style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: C.greenBright,
                  boxShadow: `0 0 6px ${C.greenBright}`,
                  animation: 'coBlink 1.8s ease-in-out infinite',
                }}/>
                <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700,
                  letterSpacing: '.1em', color: C.greenBright }}>LIVE PLATFORM</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 34, height: 34, borderRadius: 10, cursor: 'pointer',
              background: 'rgba(255,255,255,.05)',
              border: '1px solid rgba(255,255,255,.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.inkMid, fontSize: 18, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '20px 20px 0' }}>

          {/* Mission */}
          <Section title="About">
            <div style={{
              fontFamily: BODY, fontSize: 13, color: C.inkMid,
              lineHeight: 1.65, padding: '6px 0 4px',
            }}>
              UaTob is a ride-sharing platform built for Orlando, FL. Our mission is to connect riders with trusted local drivers — faster, safer, and smarter.
            </div>
          </Section>

          {/* Company info */}
          <Section title="Company">
            <Row label="Name"     value="UaTob Inc." />
            <Row label="Founded"  value="2024" />
            <Row label="City"     value="Orlando, FL" />
            <Row label="Region"   value="Central Florida" />
          </Section>

          {/* Platform */}
          <Section title="Platform">
            <Row label="Version"    value="3.2.0" mono />
            <Row label="Status"     value="Operational" />
            <Row label="Network"    value="Live · Encrypted" mono />
            <Row label="Engine"     value="Mapbox GL JS v3" mono />
          </Section>

          {/* Contact */}
          <Section title="Contact">
            <Row label="Support"  value="support@uatob.com" mono />
            <Row label="Business" value="hello@uatob.com"   mono />
            <Row label="Website"  value="uatob.com"         mono />
          </Section>

          {/* Legal */}
          <Section title="Legal">
            <div style={{
              fontFamily: MONO, fontSize: 9.5, color: C.inkDim,
              lineHeight: 1.7, padding: '6px 0',
              letterSpacing: '.03em',
            }}>
              © 2024–2026 UaTob Inc. All rights reserved.{'\n'}
              Use of this platform is subject to our Terms of Service and Privacy Policy.
            </div>
          </Section>

        </div>
      </div>
    </>
  );
}
