import { useEffect, useState, useRef, useCallback } from 'react';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';
import StatusFace        from '@/App/Drivers/StatusFace.jsx';
import DriverInstallFace from '@/App/Drivers/DriverInstallFace.jsx';
import DriverPushFace    from '@/App/Drivers/DriverPushFace.jsx';

const db = getFirestore(firebase_app);
const FACE_TINT = { status: '#22C55E', install: '#22D3EE', push: '#FBBF24' };

const FACE_MS = 5500;

// A single card that flips between two faces:
//   • status  → Go online / online status (StatusFace)
//   • install → Install the PWA (same PWA as the rider)
// Once the app is installed (standalone / pwaDownloaded), only the status face
// shows — nothing to flip to.
export default function StatusCard({
  online,
  searches,
  activeTrip,
  tripStage,
  onToggle,
  onEnablePush,
  onlineSince,
  nearbyCount,
  driver,
}) {
  const [now, setNow]         = useState(Date.now());
  const [installed, setInstalled] = useState(false);
  const [faceIdx, setFaceIdx] = useState(0);
  const [paused, setPaused]   = useState(false);
  const onlineSinceRef = useRef(null);
  const pauseRef       = useRef(null);

  // ── online duration ────────────────────────────────
  useEffect(() => {
    if (online && !onlineSinceRef.current) onlineSinceRef.current = Date.now();
    if (!online) onlineSinceRef.current = null;
  }, [online]);
  useEffect(() => {
    if (!online) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [online]);

  const sinceMs = onlineSince
    ? (typeof onlineSince === 'number' ? onlineSince : onlineSince?.toMillis?.() ?? new Date(onlineSince).getTime())
    : onlineSinceRef.current;
  const onlineMin   = sinceMs ? Math.max(0, Math.floor((now - sinceMs) / 60_000)) : 0;
  const onlineLabel = onlineMin < 1 ? 'just now' : onlineMin < 60 ? `${onlineMin} min` : `${Math.floor(onlineMin / 60)}h ${onlineMin % 60}m`;

  // ── installed? (standalone / already flagged) — and persist the flag ───
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const persist = () => {
      if (!driver?.uid || driver?.pwaInstalled) return;   // write once
      setDoc(doc(db, 'Drivers', driver.uid), {
        pwaInstalled: true, pwaInstalledAt: serverTimestamp(), updatedAt: serverTimestamp(),
      }, { merge: true }).catch(() => {});
    };

    const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone;
    if (standalone || driver?.pwaInstalled || driver?.pwaDownloaded) { setInstalled(true); if (standalone) persist(); }

    const onDone = () => { setInstalled(true); persist(); };
    window.addEventListener('appinstalled', onDone);
    return () => window.removeEventListener('appinstalled', onDone);
  }, [driver?.uid, driver?.pwaInstalled, driver?.pwaDownloaded]);

  // Push state (Notification.permission isn't reactive — re-reads on each render;
  // the card re-renders when driver.fcmToken updates after enabling).
  const perm = (typeof window !== 'undefined' && 'Notification' in window) ? window.Notification.permission : 'default';
  const pushOn     = perm === 'granted' || !!driver?.fcmToken;
  const pushDenied = perm === 'denied' && !driver?.fcmToken;

  const faces = ['status'];
  if (!installed) faces.push('install');
  if (!pushOn)    faces.push('push');

  // keep index valid when the face set shrinks
  useEffect(() => { if (faceIdx >= faces.length) setFaceIdx(0); }, [faces.length, faceIdx]);

  // auto-flip (only when there's something to flip to, not mid-trip, not paused)
  useEffect(() => {
    if (faces.length <= 1 || activeTrip || paused) return;
    const id = setInterval(() => setFaceIdx((i) => (i + 1) % faces.length), FACE_MS);
    return () => clearInterval(id);
  }, [faces.length, activeTrip, paused]);

  const flip = useCallback(() => {
    if (faces.length <= 1) return;
    setFaceIdx((i) => (i + 1) % faces.length);
    setPaused(true);
    clearTimeout(pauseRef.current);
    pauseRef.current = setTimeout(() => setPaused(false), 7000);
  }, [faces.length]);

  const face = faces[Math.min(faceIdx, faces.length - 1)];
  const mode = !online ? 'offline' : activeTrip ? 'trip' : 'waiting';
  const scanColor = face === 'install'
    ? 'rgba(34,211,238,.52)'
    : face === 'push' ? 'rgba(251,191,36,.52)'
    : mode === 'offline' ? 'rgba(100,116,139,.4)' : 'rgba(34,197,94,.55)';

  return (
    <>
      <style>{`
        @keyframes scRadar { 0%{transform:scale(.6);opacity:.7} 100%{transform:scale(2.6);opacity:0} }
        @keyframes scScan  { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        @keyframes scFaceIn{ 0%{opacity:0;transform:translateY(6px) scale(.98)} 100%{opacity:1;transform:translateY(0) scale(1)} }
        .sc-face { animation: scFaceIn .38s cubic-bezier(.34,1.2,.64,1) both; }
      `}</style>

      <div style={{ borderRadius: 22 }}>
        <div style={{
          background: 'rgba(3,7,4,.96)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          border: '1.5px solid rgba(34,197,94,.18)', borderRadius: 22, padding: '18px 20px 14px',
          position: 'relative', overflow: 'hidden', boxShadow: '0 20px 56px rgba(0,0,0,.55), 0 4px 14px rgba(0,0,0,.3)',
        }}>
          {/* scan line */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${scanColor},transparent)`, animation: 'scScan 3s linear infinite', pointerEvents: 'none' }} />

          {/* radar rings — status/waiting only */}
          {face === 'status' && mode === 'waiting' && (
            <>
              <div style={{ position: 'absolute', top: '50%', right: 72, width: 52, height: 52, borderRadius: '50%', background: 'rgba(34,197,94,.12)', transform: 'translateY(-50%)', animation: 'scRadar 2.4s ease-out infinite', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: '50%', right: 72, width: 52, height: 52, borderRadius: '50%', background: 'rgba(34,197,94,.09)', transform: 'translateY(-50%)', animation: 'scRadar 2.4s ease-out .8s infinite', pointerEvents: 'none' }} />
            </>
          )}

          {/* face content — tap to flip (except on buttons) */}
          <div
            className="sc-face"
            key={face}
            onClick={(e) => { if (e.target.closest('button, input, a, textarea, select')) return; flip(); }}
            style={{ position: 'relative', minHeight: 168, display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: faces.length > 1 ? 'pointer' : 'default' }}
          >
            {face === 'status' ? (
              <StatusFace
                mode={mode}
                online={online}
                activeTrip={activeTrip}
                tripStage={tripStage}
                sinceMs={sinceMs}
                onlineLabel={onlineLabel}
                nearbyCount={nearbyCount}
                onToggle={onToggle}
                driver={driver}
                searches={searches}
              />
            ) : face === 'install' ? (
              <DriverInstallFace onInstalled={() => setInstalled(true)} />
            ) : (
              <DriverPushFace onEnable={onEnablePush} denied={pushDenied} />
            )}
          </div>

          {/* dot pagination — only when there's a second face */}
          {faces.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14 }}>
              {faces.map((f, i) => (
                <button key={f} onClick={() => { setFaceIdx(i); setPaused(true); clearTimeout(pauseRef.current); pauseRef.current = setTimeout(() => setPaused(false), 7000); }}
                  style={{ width: i === faceIdx ? 20 : 6, height: 6, borderRadius: 3, border: 'none', padding: 0, cursor: 'pointer',
                    background: i === faceIdx ? (FACE_TINT[f] || '#22C55E') : 'rgba(255,255,255,.18)',
                    boxShadow: i === faceIdx ? `0 0 8px ${(FACE_TINT[f] || '#22C55E')}80` : 'none', transition: 'all .28s ease', flexShrink: 0 }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
