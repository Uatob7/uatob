import { useState, useEffect } from 'react';
import { doc, updateDoc, getFirestore, serverTimestamp } from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

async function saveRecord(uid, downloaded) {
  if (!uid) return;
  try {
    await updateDoc(doc(db, 'Drivers', uid), {
      pwaInstallPromptedAt: serverTimestamp(),
      pwaDownloaded: downloaded,
    });
  } catch {}
}

export default function DriverDownloadCard({ uid }) {
  const [prompt,    setPrompt]    = useState(null);
  const [installed, setInstalled] = useState(false);
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    if (isStandalone()) { setInstalled(true); return; }

    // Grab any prompt that fired before this component mounted
    const existing = window.__pwaDriverPrompt || window.__pwaInstallPrompt;
    if (existing) { setPrompt(existing); }

    // Also catch prompts that fire after mount
    const handler = (e) => {
      e.preventDefault();
      window.__pwaDriverPrompt = e;
      setPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const onInstalled = () => { setInstalled(true); saveRecord(uid, true); };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [uid]);

  const handleClick = async () => {
    if (!prompt || loading) return;
    setLoading(true);
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    const accepted = outcome === 'accepted';
    await saveRecord(uid, accepted);
    if (accepted) {
      setInstalled(true);
      setPrompt(null);
      window.__pwaDriverPrompt = null;
      window.__pwaInstallPrompt = null;
    }
    setLoading(false);
  };

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
          Open UaTob Driver from your home screen.
        </span>
      </div>
    );
  }

  const ready = !!prompt && !loading;

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
            Get Driver App
          </span>
        </span>
      </div>

      <p style={{ fontFamily: COND, fontSize: 13, color: 'rgba(255,255,255,.55)', margin: 0, lineHeight: 1.5 }}>
        Add UaTob Driver to your home screen for instant access.
      </p>

      <button
        onClick={handleClick}
        disabled={!ready}
        style={{
          width: '100%', padding: '13px 0', borderRadius: 13,
          background: loading
            ? 'rgba(34,197,94,.15)'
            : ready
              ? '#22C55E'
              : 'rgba(255,255,255,.07)',
          border: ready
            ? '1.5px solid #22C55E'
            : '1.5px solid rgba(255,255,255,.1)',
          cursor: ready ? 'pointer' : 'default',
          fontFamily: COND, fontSize: 15, fontWeight: 800, letterSpacing: '.06em',
          color: loading
            ? '#4ADE80'
            : ready
              ? '#030604'
              : 'rgba(255,255,255,.25)',
          transition: 'all .18s',
          boxShadow: ready ? '0 0 18px rgba(34,197,94,.3)' : 'none',
        }}
      >
        {loading ? 'Installing…' : '⬇ Install App'}
      </button>

    </div>
  );
}
