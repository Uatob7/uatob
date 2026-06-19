import { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, getFirestore, serverTimestamp } from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";
const SANS = "'Barlow',system-ui,sans-serif";

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isSafari() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
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
  // After 4s with no prompt, show manual instructions instead of spinning
  const [showFallback, setShowFallback] = useState(false);
  const fallbackTimer = useRef(null);

  useEffect(() => {
    if (isStandalone()) { setInstalled(true); return; }

    // Pick up any prompt that already fired before mount
    if (window.__pwaDriverPrompt) {
      setPrompt(window.__pwaDriverPrompt);
      return;
    }
    if (window.__pwaInstallPrompt) {
      setPrompt(window.__pwaInstallPrompt);
      return;
    }

    // Listen for future fires
    const handler = (e) => {
      e.preventDefault();
      window.__pwaDriverPrompt = e;
      setPrompt(e);
      clearTimeout(fallbackTimer.current);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const onInstalled = () => { setInstalled(true); saveRecord(uid, true); };
    window.addEventListener('appinstalled', onInstalled);

    // If no prompt after 4s, show fallback instructions
    fallbackTimer.current = setTimeout(() => setShowFallback(true), 4000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
      clearTimeout(fallbackTimer.current);
    };
  }, [uid]);

  const handleInstall = async () => {
    if (!prompt) return;
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

      {/* Native prompt available — green install button */}
      {prompt && (
        <>
          <p style={{ fontFamily: COND, fontSize: 13, color: 'rgba(255,255,255,.55)', margin: 0, lineHeight: 1.5 }}>
            Add UaTob Driver to your home screen for instant access.
          </p>
          <button
            onClick={handleInstall}
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
            {loading ? 'Installing…' : '⬇ Install Driver App'}
          </button>
        </>
      )}

      {/* Fallback for iOS / browsers that don't support beforeinstallprompt */}
      {!prompt && showFallback && (
        <>
          <p style={{ fontFamily: COND, fontSize: 13, color: 'rgba(255,255,255,.55)', margin: 0, lineHeight: 1.5 }}>
            Add UaTob Driver to your home screen:
          </p>
          {isIOS() || isSafari() ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { step: '1', text: 'Tap the Share button in Safari' },
                { step: '2', text: 'Scroll down and tap "Add to Home Screen"' },
                { step: '3', text: 'Tap "Add" to confirm' },
              ].map(({ step, text }) => (
                <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                    background: 'rgba(34,211,238,.15)', border: '1px solid rgba(34,211,238,.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: MONO, fontSize: 9, fontWeight: 800, color: '#22D3EE',
                  }}>{step}</span>
                  <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.6)' }}>{text}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { step: '1', text: 'Open menu (⋮) in your browser' },
                { step: '2', text: 'Tap "Add to Home Screen" or "Install App"' },
                { step: '3', text: 'Tap "Add" or "Install" to confirm' },
              ].map(({ step, text }) => (
                <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                    background: 'rgba(34,211,238,.15)', border: '1px solid rgba(34,211,238,.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: MONO, fontSize: 9, fontWeight: 800, color: '#22D3EE',
                  }}>{step}</span>
                  <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.6)' }}>{text}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Waiting for browser to offer the prompt */}
      {!prompt && !showFallback && (
        <p style={{ fontFamily: COND, fontSize: 13, color: 'rgba(255,255,255,.35)', margin: 0, lineHeight: 1.5 }}>
          Add UaTob Driver to your home screen for instant access.
        </p>
      )}

    </div>
  );
}
