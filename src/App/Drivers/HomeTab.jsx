import { useEffect, useRef, useState } from 'react';
import StatusCard from '@/App/Drivers/StatusCard.jsx';

const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';
const MAP_STYLE   = 'mapbox://styles/mapbox/dark-v11';

/**
 * HomeTab — full-screen Mapbox background with a floating StatusCard HUD.
 *
 * Props:
 *   driver          — { lat, lng, ... }
 *   online          — bool
 *   searches        — array of active ride searches
 *   scheduledRides  — array of scheduled ride objects
 *   activeTrip      — trip object | null
 *   tripStage       — stage string
 *   tripStageColor  — hex color for current stage
 *   tripBtnLabel    — CTA button label
 *   earnings        — { today, week, trips }
 *   onToggleOnline  — handler
 *   onAdvanceTrip   — handler
 *   advancePending  — bool
 *   onUnreadChange  — (count: number) => void
 */
export default function HomeTab({
  driver,
  online,
  searches = [],
  scheduledRides = [],
  activeTrip,
  tripStage,
  tripStageColor,
  tripBtnLabel,
  earnings,
  onToggleOnline,
  onAdvanceTrip,
  advancePending,
  onUnreadChange,
}) {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const markersRef      = useRef([]);
  const sweepRef        = useRef(0);
  const rafRef          = useRef(null);
  const svgRef          = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  // ── Init / destroy Mapbox based on online ─────────────────────────────
  useEffect(() => {
    if (!online) {
      // tear down if going offline
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapReady(false);
      }
      return;
    }

    if (mapRef.current) return; // already loaded

    const script = document.createElement('script');
    script.src   = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
    script.async = true;
    const link   = document.createElement('link');
    link.rel     = 'stylesheet';
    link.href    = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
    document.head.appendChild(link);
    document.head.appendChild(script);

    script.onload = () => {
      if (!mapContainerRef.current) return;
      const mapboxgl      = window.mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container:          mapContainerRef.current,
        style:              MAP_STYLE,
        center:             [driver?.lng ?? -81.3792, driver?.lat ?? 28.5383],
        zoom:               13.5,
        pitch:              45,
        bearing:            -20,
        interactive:        false,
        attributionControl: false,
      });

      map.on('load', () => {
        mapRef.current = map;
        setMapReady(true);

        // slow drift
        let bearing = -20;
        const drift = setInterval(() => {
          bearing += 0.04;
          map.setBearing(bearing);
        }, 100);
        map.on('remove', () => clearInterval(drift));
      });
    };

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapReady(false);
      }
    };
  }, [online]); // eslint-disable-line

  // ── Radar sweep rAF ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !online) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const animate = () => {
      sweepRef.current = (sweepRef.current + 1.2) % 360;
      if (svgRef.current) {
        const angle = sweepRef.current;
        const toRad = d => (d * Math.PI) / 180;
        const R     = 55;
        const leadA = (angle + 80) % 360;

        const trailX = 50 + R * Math.cos(toRad(angle));
        const trailY = 50 + R * Math.sin(toRad(angle));
        const leadX  = 50 + R * Math.cos(toRad(leadA));
        const leadY  = 50 + R * Math.sin(toRad(leadA));
        const tipX   = 50 + 52 * Math.cos(toRad(leadA));
        const tipY   = 50 + 52 * Math.sin(toRad(leadA));

        const sweep = svgRef.current.querySelector('#ht-sweep');
        const arm   = svgRef.current.querySelector('#ht-arm');
        const tip   = svgRef.current.querySelector('#ht-tip');
        const tipGlow = svgRef.current.querySelector('#ht-tipglow');

        if (sweep) sweep.setAttribute('d', `M 50 50 L ${trailX} ${trailY} A ${R} ${R} 0 0 1 ${leadX} ${leadY} Z`);
        if (arm)   { arm.setAttribute('x2', leadX); arm.setAttribute('y2', leadY); }
        if (tip)   { tip.setAttribute('cx', tipX); tip.setAttribute('cy', tipY); }
        if (tipGlow) { tipGlow.setAttribute('cx', tipX); tipGlow.setAttribute('cy', tipY); }
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mapReady, online]);

  return (
    <>
      <style>{`
        @keyframes htSpin   { to { transform: rotate(360deg); } }
        @keyframes htSlideDown {
          from { opacity: 0; transform: translateY(-12px) scale(.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes htRingPulse {
          0%,100% { transform: scale(1);   opacity: .18; }
          50%      { transform: scale(1.45); opacity: 0;  }
        }
        @keyframes htBlink {
          0%,100% { opacity: 1; }
          50%      { opacity: .25; }
        }
      `}</style>

      {/* ── Full-screen container ── */}
      <div style={{
        position:   'fixed',
        inset:      0,
        background: '#050A06',  /* dark fallback when offline */
        overflow:   'hidden',
      }}>

        {/* Mapbox canvas — only mounted when online */}
        <div
          ref={mapContainerRef}
          style={{
            position:   'absolute',
            inset:      0,
            opacity:    online ? 1 : 0,
            transition: 'opacity .6s ease',
            pointerEvents: 'none',
          }}
        />

        {/* Offline dark overlay */}
        {!online && (
          <div style={{
            position:       'absolute',
            inset:          0,
            background:     'radial-gradient(ellipse at 50% 60%, #0D1A0F 0%, #050A06 100%)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
          }}>
            {/* subtle offline rings */}
            {[60, 110, 160].map((r, i) => (
              <div key={i} style={{
                position:     'absolute',
                width:        r * 2,
                height:       r * 2,
                borderRadius: '50%',
                border:       '1px solid rgba(34,197,94,0.07)',
                animation:    `htRingPulse ${2.8 + i * 0.6}s ease-in-out ${i * 0.4}s infinite`,
              }}/>
            ))}
            <div style={{ textAlign: 'center', position: 'relative' }}>
              <div style={{
                width:          48, height: 48, borderRadius: '50%',
                border:         '1.5px solid rgba(255,255,255,0.07)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                margin:         '0 auto 12px',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="1"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
                </svg>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.18)' }}>
                Offline
              </div>
            </div>
          </div>
        )}

        {/* Radar SVG — shown when online and map ready */}
        {online && mapReady && (
          <svg
            ref={svgRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <radialGradient id="ht-sweepGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="rgba(34,197,94,0.50)"/>
                <stop offset="45%"  stopColor="rgba(34,197,94,0.14)"/>
                <stop offset="100%" stopColor="rgba(34,197,94,0)"/>
              </radialGradient>
              <radialGradient id="ht-vig" cx="50%" cy="50%" r="60%">
                <stop offset="30%" stopColor="transparent"/>
                <stop offset="100%" stopColor="rgba(0,0,0,0.60)"/>
              </radialGradient>
            </defs>

            {/* vignette */}
            <rect width="100" height="100" fill="url(#ht-vig)"/>

            {/* rings */}
            {[14, 25, 36, 47].map((r, i) => (
              <circle key={i} cx="50" cy="50" r={r} fill="none"
                stroke="rgba(34,197,94,0.09)" strokeWidth="0.25" strokeDasharray="1.2 2.4"/>
            ))}

            {/* crosshair */}
            <line x1="47.5" y1="50" x2="52.5" y2="50" stroke="rgba(34,197,94,0.3)" strokeWidth="0.22"/>
            <line x1="50" y1="47.5" x2="50" y2="52.5" stroke="rgba(34,197,94,0.3)" strokeWidth="0.22"/>
            <circle cx="50" cy="50" r="0.75" fill="rgba(74,222,128,0.7)"/>

            {/* sweep cone */}
            <path id="ht-sweep" d="M 50 50 L 50 0 A 55 55 0 0 1 50 0 Z"
              fill="url(#ht-sweepGrad)" opacity="0.75"/>

            {/* sweep arm */}
            <line id="ht-arm" x1="50" y1="50" x2="50" y2="0"
              stroke="#4ADE80" strokeWidth="0.45" strokeLinecap="round" opacity="0.9"/>

            {/* tip dot */}
            <circle id="ht-tipglow" cx="50" cy="0" r="2.2" fill="rgba(74,222,128,0.22)"/>
            <circle id="ht-tip"     cx="50" cy="0" r="1.1" fill="#4ADE80" opacity="0.95"/>
          </svg>
        )}

        {/* Map loading spinner */}
        {online && !mapReady && (
          <div style={{
            position:       'absolute',
            inset:          0,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            flexDirection:  'column',
            gap:            12,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border:    '2px solid rgba(34,197,94,0.15)',
              borderTop: '2px solid #22C55E',
              animation: 'htSpin .9s linear infinite',
            }}/>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: 'rgba(255,255,255,0.35)' }}>
              Loading map…
            </span>
          </div>
        )}

        {/* ── Floating StatusCard HUD ── */}
        <div style={{
          position:        'absolute',
          top:             0,
          left:            0,
          right:           0,
          display:         'flex',
          justifyContent:  'center',
          padding:         '56px 16px 0',    /* top safe area + breathing room */
          zIndex:          30,
          pointerEvents:   'none',
          animation:       'htSlideDown .5s cubic-bezier(.34,1.2,.64,1) both',
        }}>
          <div style={{
            width:         '100%',
            maxWidth:      420,
            pointerEvents: 'auto',
            /* frosted glass lift */
            filter:        'drop-shadow(0 8px 32px rgba(0,0,0,0.55))',
          }}>
            <StatusCard
              online={online}
              activeTrip={activeTrip}
              tripStage={tripStage}
              onToggle={onToggleOnline}
              scheduledRides={scheduledRides}
              driver={driver}
            />
          </div>
        </div>

      </div>
    </>
  );
}

