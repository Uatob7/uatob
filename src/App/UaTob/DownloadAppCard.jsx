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

async function saveRecord(uid, collection, downloaded) {
  if (!uid) return;
  try {
    await updateDoc(doc(db, collection, uid), {
      pwaInstallPromptedAt: serverTimestamp(),
      pwaDownloaded: downloaded,
    });
  } catch {}
}

export default function DownloadAppCard({ uid, collection = 'Accounts' }) {
  const [installed, setInstalled] = useState(false);
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    if (isStandalone()) { setInstalled(true); return; }
    window.addEventListener('appinstalled', () => setInstalled(true));
  }, []);

  const handleClick = async () => {
    const p = window.__pwaInstallPrompt;
    if (!p) return;
    setLoading(true);
    p.prompt();
    const { outcome } = await p.userChoice;
    const accepted = outcome === 'accepted';
    await saveRecord(uid, collection, accepted);
    if (accepted) {
      setInstalled(true);
      window.__pwaInstallPrompt = null;
    }
    // On dismiss: keep the prompt so the button works on next tap
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


    </div>
  );
}
