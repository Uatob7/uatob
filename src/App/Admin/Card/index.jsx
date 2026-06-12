import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useDriverCounts } from '@/App/UaTob/useDriverCounts';
import FaceDrivers   from './FaceDrivers';
import FaceRiders    from './FaceRiders';
import FaceScheduled from './FaceScheduled';
import FaceSearches  from './FaceSearches';
import FaceViews     from './FaceViews';

const FACES   = ['drivers', 'riders', 'scheduled', 'searches', 'views'];
const FACE_MS = 4500;

const FACE_CFG = {
  drivers:   { color: '#60A5FA', scan: 'rgba(96,165,250,.6)'   },
  riders:    { color: '#FBBF24', scan: 'rgba(251,191,36,.55)'  },
  scheduled: { color: '#C084FC', scan: 'rgba(192,132,252,.55)' },
  searches:  { color: '#4ADE80', scan: 'rgba(74,222,128,.55)'  },
  views:     { color: '#22D3EE', scan: 'rgba(34,211,238,.55)'  },
};

export default function AdminStatusCard({ onlineCount, accounts, searches, scheduledRides, views }) {
  const [faceIdx, setFaceIdx] = useState(0);
  const cycleRef  = useRef(null);
  const resumeRef = useRef(null);
  const pausedRef = useRef(false);
  const startRef  = useRef(null);

  const driverCounts = useDriverCounts();
  const ridersOnMap  = useMemo(() => accounts.filter(a => typeof a.lat === 'number').length, [accounts]);
  const guestCount   = useMemo(() => searches.filter(s => !s.uid || s.uid === 'null').length, [searches]);

  const startCycle = useCallback(() => {
    clearInterval(cycleRef.current);
    if (pausedRef.current) return;
    cycleRef.current = setInterval(() => {
      setFaceIdx(i => (i + 1) % FACES.length);
    }, FACE_MS);
  }, []);

  useEffect(() => { startRef.current = startCycle; }, [startCycle]);

  useEffect(() => {
    startCycle();
    return () => { clearInterval(cycleRef.current); clearTimeout(resumeRef.current); };
  }, [startCycle]);

  const goFace = useCallback((i) => {
    clearInterval(cycleRef.current);
    clearTimeout(resumeRef.current);
    pausedRef.current = true;
    setFaceIdx(i);
    resumeRef.current = setTimeout(() => {
      pausedRef.current = false;
      startRef.current?.();
    }, 7000);
  }, []);

  const face = FACES[faceIdx];
  const cfg  = FACE_CFG[face];

  return (
    <div style={{
      position: 'absolute', top: 36, left: 0, right: 0, zIndex: 30,
      display: 'flex', justifyContent: 'center', padding: '0 16px',
      pointerEvents: 'none',
    }}>
      <div style={{
        width: '100%', maxWidth: 340, pointerEvents: 'auto',
        filter: 'drop-shadow(0 10px 32px rgba(0,0,0,.55))',
      }}>
        <div style={{ borderRadius: 22 }}>
          <div style={{
            background:           'rgba(3,7,4,.96)',
            backdropFilter:       'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border:               '1.5px solid rgba(34,197,94,.18)',
            borderRadius:         22,
            padding:              '18px 20px 14px',
            position:             'relative',
            overflow:             'hidden',
            boxShadow:            '0 20px 56px rgba(0,0,0,.55), 0 4px 14px rgba(0,0,0,.3)',
          }}>

            {/* Scan line — color identifies current face */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg,transparent,${cfg.scan},transparent)`,
              animation: 'adScan 3s linear infinite',
              pointerEvents: 'none',
            }}/>

            {/* Radar rings — searches face only */}
            {face === 'searches' && searches.length > 0 && (
              <>
                <div style={{ position: 'absolute', top: '50%', right: 60, width: 52, height: 52,
                  borderRadius: '50%', background: 'rgba(74,222,128,.1)',
                  transform: 'translateY(-50%)', animation: 'adRadar 2.4s ease-out infinite',
                  pointerEvents: 'none' }}/>
                <div style={{ position: 'absolute', top: '50%', right: 60, width: 52, height: 52,
                  borderRadius: '50%', background: 'rgba(74,222,128,.07)',
                  transform: 'translateY(-50%)', animation: 'adRadar 2.4s ease-out .8s infinite',
                  pointerEvents: 'none' }}/>
              </>
            )}

            {/* Face content — tap to advance */}
            <div
              key={face}
              className="ad-face"
              onClick={(e) => {
                if (e.target.closest('button,input,a')) return;
                goFace((faceIdx + 1) % FACES.length);
              }}
              style={{
                minHeight: 130, display: 'flex', flexDirection: 'column',
                justifyContent: 'center', cursor: 'pointer',
                animation: 'adFaceIn .38s cubic-bezier(.34,1.2,.64,1) both',
              }}
            >
              {face === 'drivers'   && <FaceDrivers   onlineCount={onlineCount}     total={driverCounts.total}/>}
              {face === 'riders'    && <FaceRiders    ridersOnMap={ridersOnMap}      total={accounts.length}/>}
              {face === 'scheduled' && <FaceScheduled count={scheduledRides.length}/>}
              {face === 'searches'  && <FaceSearches  count={searches.length}        guestCount={guestCount}/>}
              {face === 'views'     && <FaceViews     views={views}/>}
            </div>

            {/* Dot pagination */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14 }}>
              {FACES.map((f, i) => (
                <button key={f} onClick={() => goFace(i)} style={{
                  width: i === faceIdx ? 20 : 6, height: 6, borderRadius: 3,
                  border: 'none', padding: 0, cursor: 'pointer',
                  background: i === faceIdx ? FACE_CFG[f].color : 'rgba(255,255,255,.18)',
                  boxShadow: i === faceIdx ? `0 0 8px ${FACE_CFG[f].color}80` : 'none',
                  transition: 'all .28s ease', flexShrink: 0,
                }}/>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
