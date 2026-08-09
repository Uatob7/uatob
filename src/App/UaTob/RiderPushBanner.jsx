// RiderPushBanner.jsx
// Step 2 of the rider onboarding nudge: after the PWA is installed, ask the
// rider to turn on notifications (ride updates). Shows only once installed and
// only while push isn't enabled — mirrors InstallBanner's ghostly style.

import { useEffect, useState } from 'react';
import { MONO, COND } from '@/App/UaTob/theme';
import { useSaveRiderFcmToken } from '@/App/UaTob/useSaveRiderFcmToken';

export default function RiderPushBanner({ uid, account }) {
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { requestAndSave, loading, permission } = useSaveRiderFcmToken();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone;
    if (standalone || account?.pwaInstalled) setInstalled(true);
    const onInstalled = () => setInstalled(true);
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, [account?.pwaInstalled]);

  const pushOn = permission === 'granted' || !!account?.fcmToken;
  const denied = permission === 'denied';

  // Only AFTER install, and only if push isn't on.
  if (!uid || !installed || pushOn || dismissed || permission === 'unsupported') return null;

  const enable = async () => {
    const ok = await requestAndSave(uid);
    if (ok) setDismissed(true);
  };

  return (
    <div style={{ position: 'relative', zIndex: 35, flexShrink: 0, padding: '4px 12px 2px' }}>
      <style>{`@keyframes uaGhost{0%,100%{opacity:.7}50%{opacity:1}}`}</style>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 8px 11px', borderRadius: 12,
        background: 'linear-gradient(180deg, rgba(251,191,36,.10), rgba(217,119,6,.03))',
        border: '1px solid rgba(251,191,36,.22)', backdropFilter: 'blur(10px)',
        boxShadow: '0 6px 22px rgba(0,0,0,.28)', animation: 'uaGhost 4s ease-in-out infinite',
      }}>
        <span style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, background: 'rgba(251,191,36,.14)', border: '1px solid rgba(251,191,36,.3)', color: '#FBBF24',
        }}>🔔</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: COND, fontSize: 12.5, fontWeight: 800, letterSpacing: '.05em', color: 'rgba(232,255,239,.92)' }}>
            {denied ? 'Notifications are off' : 'Turn on ride updates'}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 8.5, color: 'rgba(255,255,255,.42)', marginTop: 1 }}>
            {denied ? 'Re-enable them for UaTob in your browser settings.' : 'Know the moment a driver claims your ride.'}
          </div>
        </div>
        {!denied && (
          <button onClick={enable} disabled={loading} style={{
            border: 'none', cursor: loading ? 'wait' : 'pointer', borderRadius: 9, padding: '7px 13px',
            fontFamily: COND, fontSize: 11.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#150e02',
            background: 'linear-gradient(135deg,#FCD34D,#FBBF24)', boxShadow: '0 4px 14px rgba(251,191,36,.3)',
          }}>{loading ? '…' : 'Turn on'}</button>
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
