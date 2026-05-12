// src/landing/uatobKit.jsx
// Shared design tokens, CSS, and primitive components used across
// every UaTob landing page (driver, cash, airport, disney, tampa, ucf, no-app).

import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';

/* ─── TOKENS ─────────────────────────────────── */
export const T = {
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
export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=Lato:wght@300;400;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.ua { background: ${T.bg}; color: ${T.text}; font-family: 'Lato', sans-serif; overflow-x: hidden; min-height: 100vh; -webkit-font-smoothing: antialiased; }

.ua .sr { opacity: 0; transform: translateY(28px); transition: opacity .65s cubic-bezier(.16,1,.3,1), transform .65s cubic-bezier(.16,1,.3,1); }
.ua .sr.in { opacity: 1; transform: none; }

@keyframes ua-ticker  { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes ua-pulse   { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.4; transform:scale(1.2); } }
@keyframes ua-float   { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
@keyframes ua-fadeIn  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
@keyframes ua-scanline{ 0% { top: -2px; } 100% { top: 100%; } }
@keyframes ua-shimmer { 0% { background-position: 200% center; } 100% { background-position: -200% center; } }
@keyframes ua-countup { from { opacity:0; transform:scale(.8); } to { opacity:1; transform:none; } }
@keyframes ua-borderFlow { 0%,100% { border-color: rgba(34,197,94,.1); } 50% { border-color: rgba(34,197,94,.35); } }
@keyframes ua-billFlip { 0% { opacity:0; transform: rotateX(90deg) translateY(-10px); } 100% { opacity:1; transform: rotateX(0) translateY(0); } }

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

.ua-card {
  background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 8px;
  transition: border-color .25s, box-shadow .25s, transform .22s;
}
.ua-card:hover { border-color: ${T.borderHi}; box-shadow: 0 0 0 1px ${T.border}, 0 8px 32px rgba(34,197,94,.08); transform: translateY(-2px); }

.ua-chip {
  display: inline-flex; align-items: center; gap: 6px;
  background: ${T.greenFaint}; border: 1px solid ${T.border}; border-radius: 4px;
  padding: 6px 12px;
  font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 500;
  color: ${T.green}; letter-spacing: .07em; text-transform: uppercase;
}

.ua-mono {
  font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 500;
  color: ${T.green}; letter-spacing: .2em; text-transform: uppercase;
  display: flex; align-items: center; gap: 8px;
}
.ua-mono::before { content: ''; display: inline-block; width: 20px; height: 1px; background: ${T.green}; }

.ua-noise {
  position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.045'/%3E%3C/svg%3E");
  background-size: 180px; opacity: .6;
}

.ua-grid {
  position: absolute; inset: 0; pointer-events: none;
  background-image: linear-gradient(${T.greenFaint} 1px, transparent 1px),
                    linear-gradient(90deg, ${T.greenFaint} 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 0%, transparent 100%);
}

.ua-scanline {
  position: absolute; left: 0; right: 0; height: 120px; pointer-events: none;
  background: linear-gradient(to bottom, transparent, rgba(34,197,94,.025), transparent);
  animation: ua-scanline 7s linear infinite;
}

.ua-bento { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.ua-bento-wide { grid-column: 1 / -1; }

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
  font-size: 9px; color: ${T.muted};
  letter-spacing: .06em; text-transform: uppercase;
}
.ua-route:hover { border-color: ${T.borderHi}; color: ${T.text}; }
.ua-route.active {
  background: ${T.greenFaint};
  border-color: ${T.borderHi};
  color: ${T.green};
  box-shadow: 0 0 0 1px ${T.borderHi}, 0 4px 20px rgba(34,197,94,.15);
}

@media (max-width: 380px) { .hero-num { font-size: 44px !important; } }
`;

/* ─── HOOKS ───────────────────────────────────── */
export function useSR() {
  useEffect(() => {
    const obs = new IntersectionObserver(entries =>
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); }),
      { threshold: .08 }
    );
    document.querySelectorAll('.ua .sr').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

export function useCounter(target, inView, duration = 1000) {
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

/* ─── PRIMITIVES ──────────────────────────────── */
export function StatBlock({ value, suffix = '', label, index, animTarget, inView }) {
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

export function BentoCard({ icon: Icon, title, desc, wide = false, accent = false, delay = 0 }) {
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

export function Step({ n, title, desc, last }) {
  return (
    <div style={{ display: 'flex', gap: 16, position: 'relative' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 6, flexShrink: 0,
          background: T.greenFaint, border: `1px solid ${T.borderHi}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600, color: T.green
        }}>{String(n).padStart(2, '0')}</div>
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

export function FAQItem({ q, a, isOpen, onToggle }) {
  return (
    <div style={{ borderBottom: `1px solid ${T.border}`, padding: '18px 0' }}>
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
          size={16} color={T.green}
          style={{
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0)',
            transition: 'transform .2s', flexShrink: 0,
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

/* ─── HERO BUILDER ───────────────────────────── */
export function Hero({ pill, headline1, headline2, headline3, sub, chips, children, statusDot = true }) {
  return (
    <section style={{ position: 'relative', overflow: 'hidden', paddingBottom: 0 }}>
      <div className="ua-grid" />
      <div className="ua-scanline" />
      <div className="ua-noise" style={{ position: 'fixed' }} />
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
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(34,197,94,.05)', border: `1px solid ${T.border}`,
            borderRadius: 100, padding: '8px 16px'
          }}>
            {statusDot && <span style={{
              width: 7, height: 7, borderRadius: '50%', background: T.green,
              animation: 'ua-pulse 2s ease-in-out infinite', display: 'inline-block'
            }} />}
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
              color: T.green, letterSpacing: '.18em', textTransform: 'uppercase'
            }}>{pill}</span>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          {headline1 && <div className="hero-num" style={{
            fontFamily: "'Syne', sans-serif", fontSize: 'clamp(48px, 14vw, 108px)',
            fontWeight: 800, lineHeight: .92, color: T.white, letterSpacing: '-.03em'
          }}>{headline1}</div>}
          {headline2 && <div className="hero-num" style={{
            fontFamily: "'Syne', sans-serif", fontSize: 'clamp(48px, 14vw, 108px)',
            fontWeight: 800, lineHeight: .92, color: T.green, letterSpacing: '-.03em',
            textShadow: `0 0 80px rgba(34,197,94,.25)`
          }}>{headline2}</div>}
          {headline3 && <div className="hero-num" style={{
            fontFamily: "'Syne', sans-serif", fontSize: 'clamp(28px, 8vw, 64px)',
            fontWeight: 600, lineHeight: 1.1, marginTop: 8,
            color: 'transparent', WebkitTextStroke: `1px rgba(232,240,232,.2)`,
            letterSpacing: '-.01em'
          }}>{headline3}</div>}
        </div>

        {sub && <p style={{
          textAlign: 'center', fontSize: 14, color: T.muted,
          lineHeight: 1.85, maxWidth: 300, margin: '20px auto 26px', fontWeight: 300
        }}>{sub}</p>}

        {chips && chips.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 7, marginBottom: 28 }}>
            {chips.map((c, i) => (
              <div key={i} className="ua-chip">
                {c.icon && <c.icon size={11} />}{c.label}
              </div>
            ))}
          </div>
        )}

        {children}
      </div>
    </section>
  );
}

/* ─── TICKER ──────────────────────────────────── */
export function Ticker({ items }) {
  return (
    <div style={{
      borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`,
      overflow: 'hidden', padding: '13px 0', background: T.bg2
    }}>
      <div style={{
        display: 'flex', gap: 56, whiteSpace: 'nowrap',
        animation: 'ua-ticker 24s linear infinite'
      }}>
        {[...items, ...items].map((t, i) => (
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
  );
}

/* ─── CTA WITH SUBTEXT ────────────────────────── */
export function CTAButton({ href = 'https://uatob.com', label = 'Book a Ride', subtext }) {
  return (
    <div style={{ marginTop: 16 }}>
      <a href={href} className="ua-cta">
        {label} <ChevronRight size={16} strokeWidth={2.5} />
      </a>
      {subtext && <p style={{
        textAlign: 'center', fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 10, color: T.muted2, marginTop: 11, letterSpacing: '.07em'
      }}>{subtext}</p>}
    </div>
  );
}

/* ─── SECTION HEADER ──────────────────────────── */
export function SectionHeader({ eyebrow, line1, line2 }) {
  return (
    <div className="sr" style={{ marginBottom: 28 }}>
      <div className="ua-mono" style={{ marginBottom: 14 }}>{eyebrow}</div>
      {line1 && <div style={{
        fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800,
        color: T.white, lineHeight: 1, marginBottom: 4
      }}>{line1}</div>}
      {line2 && <div style={{
        fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 800,
        color: T.green, lineHeight: 1
      }}>{line2}</div>}
    </div>
  );
}

/* ─── FINAL CTA ───────────────────────────────── */
export function FinalCTA({ eyebrow, line1, line2, sub, ctaLabel, ctaSubtext, href = 'https://uatob.com' }) {
  return (
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
          <div className="ua-mono" style={{ justifyContent: 'center', marginBottom: 18 }}>{eyebrow}</div>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 38, fontWeight: 800,
            color: T.white, lineHeight: .95, marginBottom: 6
          }}>{line1}</div>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 38, fontWeight: 800,
            color: T.green, lineHeight: .95, marginBottom: 18,
            textShadow: `0 0 60px rgba(34,197,94,.2)`
          }}>{line2}</div>
          {sub && <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.85, maxWidth: 290, margin: '0 auto' }}>{sub}</p>}
        </div>
        <a href={href} className="ua-cta">
          {ctaLabel} <ChevronRight size={16} strokeWidth={2.5} />
        </a>
        {ctaSubtext && <p style={{
          textAlign: 'center', fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10, color: T.muted2, marginTop: 14, lineHeight: 1.9, letterSpacing: '.05em'
        }}>{ctaSubtext}</p>}
      </div>
    </section>
  );
}