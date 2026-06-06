import { useEffect, useRef, useState } from 'react';
import StatusCard from '@/App/Drivers/StatusCard.jsx';

const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';
const MAP_STYLE   = 'mapbox://styles/mapbox/dark-v11';

// ── Helpers ───────────────────────────────────────────────────────────────────
function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  return 0;
}

// Build a GeoJSON FeatureCollection from search docs that have pickup coords
function buildPickupGeoJSON(searches = []) {
  const features = searches
    .filter(s => typeof s.pickupLat === 'number' && typeof s.pickupLng === 'number')
    .map(s => ({
      type: 'Feature',
      properties: {
        id:        s.id,
        age:       Math.min(1, Math.max(0, 1 - (Date.now() - tsToMillis(s.createdAt)) / (3 * 3600_000))), // 0–1, fades over 3h
        guest:     !s.uid || s.uid === 'null' || s.uid === null,
      },
      geometry: {
        type:        'Point',
        coordinates: [s.pickupLng, s.pickupLat],
      },
    }));
  return { type: 'FeatureCollection', features };
}

// Build scheduled-ride pickup GeoJSON
function buildScheduledGeoJSON(scheduledRides = []) {
  const features = scheduledRides
    .filter(r => typeof r.pickupLat === 'number' && typeof r.pickupLng === 'number')
    .map(r => ({
      type: 'Feature',
      properties: { id: r.id },
      geometry: { type: 'Point', coordinates: [r.pickupLng, r.pickupLat] },
    }));
  return { type: 'FeatureCollection', features };
}

/**
 * HomeTab — full-screen Mapbox background with floating StatusCard HUD
 * and pulsing pickup dots for every search (+ scheduled rides).
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
  const markersRef      = useRef([]);   // DOM pulse markers (CSS-based)
  const sweepRef        = useRef(0);
  const rafRef          = useRef(null);
  const svgRef          = useRef(null);
  const pulseLayersRef  = useRef(false); // have we added the Mapbox layers yet?
  const [mapReady, setMapReady] = useState(false);

  // ── Init / destroy Mapbox ─────────────────────────────────────────────
  useEffect(() => {
    if (!online) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current    = null;
        pulseLayersRef.current = false;
        setMapReady(false);
      }
      return;
    }
    if (mapRef.current) return;

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
      const mapboxgl       = window.mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container:          mapContainerRef.current,
        style:              MAP_STYLE,
        center:             [driver?.lng ?? -81.3792, driver?.lat ?? 28.5383],
        zoom:               12,
        pitch:              45,
        bearing:            -20,
        interactive:        false,
        attributionControl: false,
      });

      map.on('load', () => {
        mapRef.current = map;

        // ── Add pickup dot layers ──────────────────────────────────────
        // Source: all searches
        map.addSource('ht-searches', {
          type: 'geojson',
          data: buildPickupGeoJSON(searches),
        });

        // Source: scheduled ride pickups
        map.addSource('ht-scheduled', {
          type: 'geojson',
          data: buildScheduledGeoJSON(scheduledRides),
        });

        // Outer pulse halo — search dots (teal)
        map.addLayer({
          id:     'ht-search-halo',
          type:   'circle',
          source: 'ht-searches',
          paint:  {
            'circle-radius':       14,
            'circle-color':        'rgba(52,211,153,0)',
            'circle-stroke-color': 'rgba(52,211,153,0.45)',
            'circle-stroke-width': 1.5,
            'circle-opacity':      ['*', ['get', 'age'], 0.6],
          },
        });

        // Inner solid dot — search (teal / amber for guest)
        map.addLayer({
          id:     'ht-search-dot',
          type:   'circle',
          source: 'ht-searches',
          paint:  {
            'circle-radius':       5,
            'circle-color':        [
              'case',
              ['get', 'guest'], 'rgba(251,146,60,0.95)',
              'rgba(52,211,153,0.95)',
            ],
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 1.5,
            'circle-blur':         0.1,
            'circle-opacity':      ['*', ['get', 'age'], 0.9],
          },
        });

        // Outer halo — scheduled (purple)
        map.addLayer({
          id:     'ht-sched-halo',
          type:   'circle',
          source: 'ht-scheduled',
          paint:  {
            'circle-radius':       18,
            'circle-color':        'rgba(0,0,0,0)',
            'circle-stroke-color': 'rgba(192,132,252,0.5)',
            'circle-stroke-width': 2,
          },
        });

        // Inner dot — scheduled (purple)
        map.addLayer({
          id:     'ht-sched-dot',
          type:   'circle',
          source: 'ht-scheduled',
          paint:  {
            'circle-radius':       7,
            'circle-color':        'rgba(192,132,252,0.95)',
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 2,
          },
        });

        pulseLayersRef.current = true;

        // slow drift
        let bearing = -20;
        const drift = setInterval(() => {
          bearing += 0.04;
          map.setBearing(bearing);
        }, 100);
        map.on('remove', () => clearInterval(drift));

        setMapReady(true);
      });
    };

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current         = null;
        pulseLayersRef.current = false;
        setMapReady(false);
      }
    };
  }, [online]); // eslint-disable-line

  // ── Keep dot sources in sync with live data ───────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !pulseLayersRef.current) return;
    const map = mapRef.current;
    if (!map.isStyleLoaded()) return;
    map.getSource('ht-searches') ?.setData(buildPickupGeoJSON(searches));
    map.getSource('ht-scheduled')?.setData(buildScheduledGeoJSON(scheduledRides));
  }, [searches, scheduledRides, mapReady]);

  // ── Pulse animation: scale the halo layer radius over time ───────────
  useEffect(() => {
    if (!mapReady || !pulseLayersRef.current) return;
    const map = mapRef.current;
    let t = 0;
    const id = setInterval(() => {
      if (!map || !map.isStyleLoaded()) return;
      t += 0.06;
      // oscillate halo radius between 10 and 20
      const r = 10 + 10 * ((Math.sin(t) + 1) / 2);
      // oscillate halo opacity between 0.15 and 0.55
      const o = 0.15 + 0.4  * ((Math.sin(t) + 1) / 2);
      map.setPaintProperty('ht-search-halo', 'circle-radius',  r);
      map.setPaintProperty('ht-search-halo', 'circle-stroke-width', 1 + 1.5 * ((Math.sin(t) + 1) / 2));

      // scheduled halo — slightly offset phase
      const rs = 14 + 10 * ((Math.sin(t + 1) + 1) / 2);
      map.setPaintProperty('ht-sched-halo', 'circle-radius', rs);
    }, 40);
    return () => clearInterval(id);
  }, [mapReady]);

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

        const sweep   = svgRef.current.querySelector('#ht-sweep');
        const arm     = svgRef.current.querySelector('#ht-arm');
        const tip     = svgRef.current.querySelector('#ht-tip');
        const tipGlow = svgRef.current.querySelector('#ht-tipglow');

        if (sweep)   sweep.setAttribute('d', `M 50 50 L ${trailX} ${trailY} A ${R} ${R} 0 0 1 ${leadX} ${leadY} Z`);
        if (arm)     { arm.setAttribute('x2', leadX);   arm.setAttribute('y2', leadY); }
        if (tip)     { tip.setAttribute('cx', tipX);    tip.setAttribute('cy', tipY); }
        if (tipGlow) { tipGlow.setAttribute('cx', tipX); tipGlow.setAttribute('cy', tipY); }
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mapReady, online]);

  // ── Dot count badge ───────────────────────────────────────────────────
  const dotCount = searches.filter(
    s => typeof s.pickupLat === 'number' && typeof s.pickupLng === 'number'
  ).length;

  return (
    <>
      <style>{`
        @keyframes htSpin   { to { transform: rotate(360deg); } }
        @keyframes htSlideDown {
          from { opacity: 0; transform: translateY(-12px) scale(.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes htRingPulse {
          0%,100% { transform: scale(1);    opacity: .18; }
          50%     { transform: scale(1.45); opacity: 0;   }
        }
        @keyframes htBlink {
          0%,100% { opacity: 1; }
          50%     { opacity: .25; }
        }
      `}</style>

      {/* ── Full-screen container ── */}
      <div style={{ position: 'fixed', inset: 0, background: '#050A06', overflow: 'hidden' }}>

        {/* Mapbox canvas */}
        <div
          ref={mapContainerRef}
          style={{
            position:      'absolute',
            inset:         0,
            opacity:       online ? 1 : 0,
            transition:    'opacity .6s ease',
            pointerEvents: 'none',
          }}
        />

        {/* Offline overlay */}
        {!online && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 50% 60%, #0D1A0F 0%, #050A06 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {[60, 110, 160].map((r, i) => (
              <div key={i} style={{
                position: 'absolute', width: r * 2, height: r * 2, borderRadius: '50%',
                border: '1px solid rgba(34,197,94,0.07)',
                animation: `htRingPulse ${2.8 + i * 0.6}s ease-in-out ${i * 0.4}s infinite`,
              }}/>
            ))}
            <div style={{ textAlign: 'center', position: 'relative' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                border: '1.5px solid rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="1"/>
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
                </svg>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.18)' }}>
                Offline
              </div>
            </div>
          </div>
        )}

        {/* Radar SVG */}
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

            <rect width="100" height="100" fill="url(#ht-vig)"/>
            {[14, 25, 36, 47].map((r, i) => (
              <circle key={i} cx="50" cy="50" r={r} fill="none"
                stroke="rgba(34,197,94,0.09)" strokeWidth="0.25" strokeDasharray="1.2 2.4"/>
            ))}
            <line x1="47.5" y1="50" x2="52.5" y2="50" stroke="rgba(34,197,94,0.3)" strokeWidth="0.22"/>
            <line x1="50" y1="47.5" x2="50" y2="52.5" stroke="rgba(34,197,94,0.3)" strokeWidth="0.22"/>
            <circle cx="50" cy="50" r="0.75" fill="rgba(74,222,128,0.7)"/>
            <path id="ht-sweep" d="M 50 50 L 50 0 A 55 55 0 0 1 50 0 Z"
              fill="url(#ht-sweepGrad)" opacity="0.75"/>
            <line id="ht-arm" x1="50" y1="50" x2="50" y2="0"
              stroke="#4ADE80" strokeWidth="0.45" strokeLinecap="round" opacity="0.9"/>
            <circle id="ht-tipglow" cx="50" cy="0" r="2.2" fill="rgba(74,222,128,0.22)"/>
            <circle id="ht-tip"     cx="50" cy="0" r="1.1" fill="#4ADE80" opacity="0.95"/>
          </svg>
        )}

        {/* Map loading spinner */}
        {online && !mapReady && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 12,
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

        {/* ── Live dot legend badge — bottom left ── */}
        {online && mapReady && dotCount > 0 && (
          <div style={{
            position: 'absolute', bottom: 100, left: 16, zIndex: 20,
            display: 'flex', flexDirection: 'column', gap: 6,
            animation: 'htSlideDown .4s ease both',
          }}>
            {/* Search pickups */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'rgba(5,10,6,.72)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(52,211,153,.25)', borderRadius: 99,
              padding: '5px 11px',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#34D399', boxShadow: '0 0 8px rgba(52,211,153,.8)',
                animation: 'htBlink 1.8s ease-in-out infinite',
              }}/>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, fontWeight: 700, color: '#34D399' }}>
                {dotCount} searching {dotCount !== 1 ? '' : ''}
              </span>
            </div>

            {/* Scheduled pickups badge — only if any */}
            {scheduledRides.filter(r => r.pickupLat && r.pickupLng).length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'rgba(5,10,6,.72)', backdropFilter: 'blur(10px)',
                border: '1px solid rgba(192,132,252,.25)', borderRadius: 99,
                padding: '5px 11px',
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#C084FC', boxShadow: '0 0 8px rgba(192,132,252,.8)',
                  animation: 'htBlink 2.2s ease-in-out infinite',
                }}/>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, fontWeight: 700, color: '#C084FC' }}>
                  {scheduledRides.filter(r => r.pickupLat && r.pickupLng).length} scheduled
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Floating StatusCard HUD ── */}
        <div style={{
          position:       'absolute',
          top:            0, left: 0, right: 0,
          display:        'flex',
          justifyContent: 'center',
          padding:        '56px 16px 0',
          zIndex:         30,
          pointerEvents:  'none',
          animation:      'htSlideDown .5s cubic-bezier(.34,1.2,.64,1) both',
        }}>
          <div style={{
            width: '100%', maxWidth: 420,
            pointerEvents: 'auto',
            filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.55))',
          }}>
            <StatusCard
              online={online}
              searches={searches}
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
