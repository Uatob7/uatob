// InstallBanner.jsx
// A faint, "ghostly" PWA install nudge shown under the top bar. Uses the
// beforeinstallprompt event captured early in _app.js (window.__pwaInstallPrompt).
// Hides itself once installed, dismissed, or running standalone.

import { useEffect, useState } from 'react';
import { MONO, COND } from '@/App/UaTob/theme';

export default function InstallBanner({ installed: installedHint = false }) {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone;
    if (standalone) { setInstalled(true); return; }

    if (window.__pwaInstallPrompt) setPrompt(window.__pwaInstallPrompt);
    const onBip = (e) => { e.preventDefault(); window.__pwaInstallPrompt = e; setPrompt(e); };
    const onInstalled = () => { setInstalled(true); window.__pwaInstallPrompt = null; };
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  const canPrompt = !!prompt;

  if (installed || installedHint || dismissed) return null;   // already installed → let the push banner take over
  if (!canPrompt && !isIOS) return null;   // nothing we can do (e.g. desktop w/o prompt)

  const install = async () => {
    if (!prompt) return;
    try { prompt.prompt(); await prompt.userChoice; } catch { /* dismissed */ }
    window.__pwaInstallPrompt = null;
    setPrompt(null);
    setDismissed(true);
  };

  return (
    <div style={{ position: 'relative', zIndex: 35, flexShrink: 0, padding: '4px 12px 2px' }}>
      <style>{`@keyframes uaGhost{0%,100%{opacity:.7}50%{opacity:1}}`}</style>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 8px 11px', borderRadius: 12,
        background: 'linear-gradient(180deg, rgba(74,222,128,.09), rgba(34,197,94,.03))',
        border: '1px solid rgba(74,222,128,.18)', backdropFilter: 'blur(10px)',
        boxShadow: '0 6px 22px rgba(0,0,0,.28)', animation: 'uaGhost 4s ease-in-out infinite',
      }}>
        <span style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, background: 'rgba(74,222,128,.14)', border: '1px solid rgba(74,222,128,.3)', color: '#2FE08A',
        }}>⤓</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: COND, fontSize: 12.5, fontWeight: 800, letterSpacing: '.05em', color: 'rgba(232,255,239,.92)' }}>Install UaTob</div>
          <div style={{ fontFamily: MONO, fontSize: 8.5, color: 'rgba(255,255,255,.42)', marginTop: 1 }}>
            {canPrompt ? 'Add to your home screen' : 'Tap Share → Add to Home Screen'}
          </div>
        </div>
        {canPrompt && (
          <button onClick={install} style={{
            border: 'none', cursor: 'pointer', borderRadius: 9, padding: '7px 13px',
            fontFamily: COND, fontSize: 11.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#04150a',
            background: 'linear-gradient(135deg,#2FE08A,#17B673)', boxShadow: '0 4px 14px rgba(34,197,94,.3)',
          }}>Install</button>
        )}
        <button onClick={() => setDismissed(true)} aria-label="Dismiss" style={{
          width: 24, height: 24, flexShrink: 0, borderRadius: 7, cursor: 'pointer',
          background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.09)', color: 'rgba(255,255,255,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
        }}>✕</button>
      </div>
    </div>
  );
}
