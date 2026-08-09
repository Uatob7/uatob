// DriverInstallFace.jsx
// The "Install the app" side of the driver StatusCard flip. Uses the SAME PWA
// install prompt as the rider (window.__pwaInstallPrompt, captured in _app.js) —
// it's one PWA for the whole app.

import { useEffect, useState } from 'react';

const COND = "'Barlow Condensed',sans-serif";
const MONO = "'JetBrains Mono',monospace";

export default function DriverInstallFace({ onInstalled }) {
  const [prompt, setPrompt] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.__pwaInstallPrompt) setPrompt(window.__pwaInstallPrompt);
    const onBip = (e) => { e.preventDefault(); window.__pwaInstallPrompt = e; setPrompt(e); };
    const onDone = () => { window.__pwaInstallPrompt = null; onInstalled?.(); };
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onDone);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onDone);
    };
  }, [onInstalled]);

  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  const canPrompt = !!prompt;

  const install = async (e) => {
    e?.stopPropagation?.();
    if (!prompt) return;
    try { prompt.prompt(); await prompt.userChoice; } catch { /* dismissed */ }
    window.__pwaInstallPrompt = null;
    setPrompt(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 4, padding: '4px 6px' }}>
      <div style={{
        width: 52, height: 52, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
        background: 'rgba(34,211,238,.12)', border: '1px solid rgba(34,211,238,.3)', color: '#22D3EE', marginBottom: 6,
      }}>⤓</div>

      <div style={{ fontFamily: COND, fontSize: 20, fontWeight: 900, letterSpacing: '.02em', color: 'rgba(232,255,239,.95)', lineHeight: 1 }}>
        Install UaTob Driver
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,.5)', lineHeight: 1.5, maxWidth: 260, marginTop: 2 }}>
        {canPrompt
          ? 'Add it to your home screen — faster launches, full-screen, instant ride alerts.'
          : isIOS
            ? 'Tap the Share button, then “Add to Home Screen.”'
            : 'Open this in Chrome or Safari to install to your home screen.'}
      </div>

      {canPrompt && (
        <button onClick={install} style={{
          marginTop: 12, border: 'none', cursor: 'pointer', borderRadius: 12, padding: '11px 26px',
          fontFamily: COND, fontSize: 14, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#04150a',
          background: 'linear-gradient(135deg,#2FE08A,#17B673)', boxShadow: '0 8px 22px rgba(34,197,94,.32)',
        }}>Install app</button>
      )}
    </div>
  );
}
