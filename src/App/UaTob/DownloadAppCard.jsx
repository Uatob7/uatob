import { useState, useEffect } from 'react';
import { doc, updateDoc, getFirestore } from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

const C = {
  green:       '#22C55E',
  greenBright: '#4ADE80',
  greenSoft:   '#34D399',
  cyan:        '#22D3EE',
  text:        'rgba(255,255,255,.92)',
  mid:         'rgba(255,255,255,.55)',
  dim:         'rgba(255,255,255,.32)',
  faint:       'rgba(255,255,255,.10)',
  line:        'rgba(255,255,255,.08)',
};
const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

async function saveInstallRecord(uid, collection, downloaded) {
  if (!uid) return;
  try {
    await updateDoc(doc(db, collection, uid), {
      pwaInstallPromptedAt: new Date().toUTCString(),
      pwaDownloaded: downloaded,
    });
  } catch {}
}

export default function DownloadAppCard({ uid, collection = 'Accounts' }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed,      setInstalled]      = useState(false);
  const [installing,     setInstalling]     = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) { setInstalled(true); return; }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    const downloaded = outcome === 'accepted';
    await saveInstallRecord(uid, collection, downloaded);
    if (downloaded) setInstalled(true);
    setDeferredPrompt(null);
    setInstalling(false);
  };

  const ios = isIos();

  return (
    <div>
      {/* Header chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 9px', borderRadius: 100,
          background: 'rgba(34,211,238,.1)', border: '1px solid rgba(34,211,238,.22)',
        }}>
          <span style={{ fontSize: 10 }}>📲</span>
          <span style={{
            fontFamily: COND, fontSize: 9.5, fontWeight: 800,
            letterSpacing: '.12em', textTransform: 'uppercase', color: C.cyan,
          }}>Get the App</span>
        </span>
      </div>

      {installed ? (
        /* Already installed */
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 8, padding: '16px 0',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(34,197,94,.12)', border: `1.5px solid ${C.green}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>✓</div>
          <span style={{
            fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.greenBright,
            letterSpacing: '.04em',
          }}>App installed!</span>
          <span style={{ fontFamily: COND, fontSize: 10, color: C.dim }}>
            Open UaTob from your home screen.
          </span>
        </div>
      ) : deferredPrompt ? (
        /* Native install prompt available (Android / Chrome desktop) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{
            fontFamily: COND, fontSize: 12, color: C.mid,
            margin: 0, lineHeight: 1.55,
          }}>
            Add UaTob to your home screen for one-tap ride booking — no app store needed.
          </p>
          <button
            onClick={handleInstall}
            disabled={installing}
            style={{
              padding: '11px 0', borderRadius: 12, cursor: installing ? 'not-allowed' : 'pointer',
              background: installing ? 'rgba(34,197,94,.12)' : C.green,
              border: `1.5px solid ${C.green}`,
              fontFamily: COND, fontSize: 14, fontWeight: 800,
              letterSpacing: '.06em', color: installing ? C.greenBright : '#030604',
              transition: 'all .18s',
              width: '100%',
            }}
          >
            {installing ? 'Installing…' : 'Install App'}
          </button>
        </div>
      ) : ios ? (
        /* iOS — manual Safari instructions */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{
            fontFamily: COND, fontSize: 12, color: C.mid,
            margin: 0, lineHeight: 1.55,
          }}>
            Add UaTob to your home screen in Safari:
          </p>
          {[
            { n: 1, icon: '⬆️', text: 'Tap the Share button at the bottom of Safari' },
            { n: 2, icon: '➕', text: 'Scroll down and tap "Add to Home Screen"' },
            { n: 3, icon: '✓',  text: 'Tap "Add" in the top-right corner' },
          ].map(({ n, icon, text }) => (
            <div key={n} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '8px 10px', borderRadius: 10,
              background: C.faint, border: `1px solid ${C.line}`,
            }}>
              <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1.4 }}>{icon}</span>
              <span style={{ fontFamily: COND, fontSize: 12, color: C.mid, lineHeight: 1.5 }}>
                {text}
              </span>
            </div>
          ))}
        </div>
      ) : (
        /* Generic fallback (non-iOS, no prompt yet) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{
            fontFamily: COND, fontSize: 12, color: C.mid,
            margin: 0, lineHeight: 1.55,
          }}>
            Install UaTob directly from your browser — no app store required.
          </p>
          {[
            { icon: '⋮', text: 'Open your browser menu (three-dot icon)' },
            { icon: '➕', text: 'Tap "Add to Home Screen" or "Install App"' },
            { icon: '✓',  text: 'Confirm to install' },
          ].map(({ icon, text }, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '8px 10px', borderRadius: 10,
              background: C.faint, border: `1px solid ${C.line}`,
            }}>
              <span style={{
                fontFamily: MONO, fontSize: 13, color: C.cyan,
                flexShrink: 0, lineHeight: 1.4,
              }}>{icon}</span>
              <span style={{ fontFamily: COND, fontSize: 12, color: C.mid, lineHeight: 1.5 }}>
                {text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
