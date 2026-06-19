import { useState, useEffect } from 'react';
import { doc, updateDoc, getFirestore } from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

async function saveRecord(uid, collection, downloaded) {
  if (!uid) return;
  try {
    await updateDoc(doc(db, collection, uid), {
      pwaInstallPromptedAt: new Date().toUTCString(),
      pwaDownloaded: downloaded,
    });
  } catch {}
}

export default function DownloadAppCard({ uid, collection = 'Accounts' }) {
  const [prompt,     setPrompt]     = useState(null);   // beforeinstallprompt event
  const [installed,  setInstalled]  = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [showSteps,  setShowSteps]  = useState(false);

  useEffect(() => {
    if (isStandalone()) { setInstalled(true); return; }
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', () => setInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const handleClick = async () => {
    if (prompt) {
      setLoading(true);
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      const accepted = outcome === 'accepted';
      await saveRecord(uid, collection, accepted);
      if (accepted) setInstalled(true);
      setPrompt(null);
      setLoading(false);
    } else {
      // iOS or browser hasn't fired beforeinstallprompt yet — show steps
      setShowSteps(true);
      await saveRecord(uid, collection, false);
    }
  };

  const ios = isIos();

  const iosSteps = [
    { icon: '⬆️', text: 'Tap the Share button at the bottom of Safari' },
    { icon: '➕', text: 'Tap "Add to Home Screen"' },
    { icon: '✅', text: 'Tap "Add" to confirm' },
  ];

  if (installed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '20px 0' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(34,197,94,.12)', border: '1.5px solid #22C55E',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
        }}>✓</div>
        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: '#4ADE80', letterSpacing: '.04em' }}>
          App installed!
        </span>
        <span style={{ fontFamily: COND, fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
          Open UaTob from your home screen.
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 9px', borderRadius: 100,
          background: 'rgba(34,211,238,.1)', border: '1px solid rgba(34,211,238,.22)',
        }}>
          <span style={{ fontSize: 10 }}>📲</span>
          <span style={{ fontFamily: COND, fontSize: 9.5, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#22D3EE' }}>
            Get the App
          </span>
        </span>
      </div>

      {/* Description */}
      <p style={{ fontFamily: COND, fontSize: 13, color: 'rgba(255,255,255,.55)', margin: 0, lineHeight: 1.5 }}>
        Add UaTob to your home screen — no app store, one tap to book.
      </p>

      {/* Install button — always visible */}
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          width: '100%', padding: '13px 0', borderRadius: 13,
          background: loading ? 'rgba(34,197,94,.15)' : '#22C55E',
          border: '1.5px solid #22C55E',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: COND, fontSize: 15, fontWeight: 800, letterSpacing: '.06em',
          color: loading ? '#4ADE80' : '#030604',
          transition: 'all .18s',
          boxShadow: loading ? 'none' : '0 0 18px rgba(34,197,94,.3)',
        }}
      >
        {loading ? 'Installing…' : '⬇ Install App'}
      </button>

      {/* Steps revealed after button tap when native prompt isn't available */}
      {showSteps && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, animation: 'uaSlideUp .3s ease both' }}>
          <p style={{ fontFamily: COND, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.35)', margin: 0, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            {ios ? 'In Safari:' : 'In your browser:'}
          </p>
          {(ios ? iosSteps : [
            { icon: '⋮',  text: 'Tap the three-dot menu in your browser' },
            { icon: '➕', text: 'Tap "Add to Home Screen" or "Install App"' },
            { icon: '✅', text: 'Tap "Add" to confirm' },
          ]).map(({ icon, text }, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 10,
              background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
            }}>
              <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
              <span style={{ fontFamily: COND, fontSize: 12, color: 'rgba(255,255,255,.55)', lineHeight: 1.4 }}>
                {text}
              </span>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
