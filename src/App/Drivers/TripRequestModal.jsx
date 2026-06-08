/**
 * TripRequestModal.jsx  — Full-screen Mapbox + bidirectional slide control
 * ─────────────────────────────────────────────────────────────────────────
 * Slide RIGHT  → Accept
 * Slide LEFT   → Decline
 *
 * Props (same contract as previous TripRequestModal)
 * ──────────────────────────────────────────────────
 *   driver          { uid, lat, lng, firstName }
 *   tripRequest     Firestore ride doc
 *   requestTimer    number (seconds remaining, 0–60)
 *   onAccept        () => void
 *   onDecline       () => void
 *   actionPending   boolean
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Zap } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebase_app } from '@/firebase/config';
import { TYPE_COLOR, TYPE_LABEL } from '@/App/Drivers/constants.js';

const functions           = getFunctions(firebase_app, 'us-east1');
const callGetDriverToPickup = httpsCallable(functions, 'getDriverToPickup');

const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';
const MB_VERSION   = 'v3.3.0';

// ─── palette (matches ActiveTripScreen exactly) ────────────────────────────
const C = {
  bg:          '#050A06',
  panel:       'rgba(5,10,6,.82)',
  panelDeep:   'rgba(2,5,3,.94)',
  green:       '#22C55E',
  greenBright: '#4ADE80',
  greenSoft:   '#34D399',
  amber:       '#FB923C',
  amberBright: '#FBBF24',
  red:         '#F87171',
  redDeep:     '#EF4444',
  white:       'rgba(255,255,255,.88)',
  ink:         'rgba(255,255,255,.42)',
  inkDim:      'rgba(255,255,255,.22)',
  inkFaint:    'rgba(255,255,255,.10)',
  cyan:        '#67E8F9',
};

const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";

// ─── payment config ────────────────────────────────────────────────────────
const PAY_CFG = {
  cash:    { label:'CASH',     color:'#F59E0B', bg:'rgba(245,158,11,.13)', border:'rgba(245,158,11,.32)', icon:'💵' },
  card:    { label:'CARD',     color:'#60A5FA', bg:'rgba(96,165,250,.12)', border:'rgba(96,165,250,.28)', icon:'💳' },
  cashapp: { label:'CASH APP', color:'#34D399', bg:'rgba(52,211,153,.12)', border:'rgba(52,211,153,.28)', icon:'$'  },
};

// ─── polyline decoder (identical to both source files) ────────────────────
function decodePolyline(encoded) {
  if (!encoded) return [];
  const pts = [];
  let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    pts.push([lat / 1e5, lng / 1e5]);
  }
  return pts;
}

// ─── address masker ────────────────────────────────────────────────────────
function maskAddress(raw) {
  if (!raw) return '—';
  const parts = String(raw).split(',').map(s => s.trim()).filter(Boolean);
  if (!parts.length) return '—';
  const first = parts[0].replace(/^(\d+[A-Za-z]?)(\s+)/, (_, num, sp) =>
    `${'•'.repeat(Math.min(num.length, 4))}${sp}`
  );
  const tail = parts.slice(1).filter(p => !/^USA$/i.test(p));
  const tailStr = tail.slice(0, 2).join(', ');
  return tailStr ? `${first} · ${tailStr}` : first;
}

// ─── lerp ─────────────────────────────────────────────────────────────────
const lerp = (a, b, t) => a + (b - a) * t;

// ─── global mapbox loader (deduped) ───────────────────────────────────────
let _mbReady = false;
let _mbQueue = [];
function loadMapbox(cb) {
  if (_mbReady && window.mapboxgl) { cb(); return; }
  _mbQueue.push(cb);
  if (document.getElementById('trm2-mb-script')) return;
  const link = document.createElement('link');
  link.rel  = 'stylesheet';
  link.href = `https://api.mapbox.com/mapbox-gl-js/${MB_VERSION}/mapbox-gl.css`;
  document.head.appendChild(link);
  const script = document.createElement('script');
  script.id     = 'trm2-mb-script';
  script.src    = `https://api.mapbox.com/mapbox-gl-js/${MB_VERSION}/mapbox-gl.js`;
  script.onload = () => { _mbReady = true; _mbQueue.forEach(fn => fn()); _mbQueue = []; };
  document.head.appendChild(script);
}

// ═══════════════════════════════════════════════════════════════════════════
// FULL-SCREEN MAPBOX BACKGROUND
// ═══════════════════════════════════════════════════════════════════════════
function FullscreenMap({ driverLat, driverLng, pickupLat, pickupLng, polyline, onReady }) {
  const containerRef   = useRef(null);
  const mapRef         = useRef(null);
  const markersRef     = useRef([]);
  const initRef        = useRef(false);

  const routeCoords = useMemo(() => {
    if (!polyline) return [];
    return decodePolyline(polyline).map(p => [p[1], p[0]]);
  }, [polyline]);

  // init map once
  useEffect(() => {
    if (initRef.current || !containerRef.current) return;
    loadMapbox(() => {
      if (initRef.current || !containerRef.current) return;
      initRef.current = true;
      window.mapboxgl.accessToken = MAPBOX_TOKEN;

      const ctr = (driverLng && driverLat)
        ? [driverLng, driverLat]
        : (pickupLng && pickupLat)
        ? [pickupLng, pickupLat]
        : [-81.3792, 28.5383];

      mapRef.current = new window.mapboxgl.Map({
        container:        containerRef.current,
        style:            'mapbox://styles/mapbox/dark-v11',
        center:           ctr,
        zoom:             13.5,
        pitch:            52,
        bearing:          -12,
        interactive:      false,
        attributionControl: false,
        fadeDuration:     300,
      });

      mapRef.current.on('load', () => {
        onReady?.();
      });
    });

    return () => {
      markersRef.current.forEach(m => { try { m.remove(); } catch {}});
      markersRef.current = [];
      if (mapRef.current) { try { mapRef.current.remove(); } catch {} mapRef.current = null; initRef.current = false; }
    };
  // eslint-disable-next-line
  }, []);

  // draw route
  useEffect(() => {
    if (!mapRef.current || !routeCoords.length) return;
    const attach = () => {
      if (!mapRef.current?.isStyleLoaded()) { setTimeout(attach, 80); return; }
      const geo = { type: 'Feature', geometry: { type: 'LineString', coordinates: routeCoords } };
      if (mapRef.current.getSource('trm-route')) {
        mapRef.current.getSource('trm-route').setData(geo);
      } else {
        mapRef.current.addSource('trm-route', { type: 'geojson', data: geo });
        mapRef.current.addLayer({ id: 'trm-glow', type: 'line', source: 'trm-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': C.green, 'line-width': 16, 'line-opacity': 0.14, 'line-blur': 9 } });
        mapRef.current.addLayer({ id: 'trm-main', type: 'line', source: 'trm-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': C.green, 'line-width': 4.5, 'line-opacity': 1 } });
        mapRef.current.addLayer({ id: 'trm-dash', type: 'line', source: 'trm-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#EAFFF2', 'line-width': 2, 'line-opacity': 0.45, 'line-dasharray': [0, 5] } });
      }

      // fit bounds
      const pts = [...routeCoords];
      if (driverLat && driverLng) pts.push([driverLng, driverLat]);
      if (pickupLat && pickupLng) pts.push([pickupLng, pickupLat]);
      if (pts.length >= 2) {
        const lngs = pts.map(p => p[0]), lats = pts.map(p => p[1]);
        mapRef.current.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: { top: 160, bottom: 320, left: 56, right: 56 }, maxZoom: 15.5, pitch: 52, duration: 900 }
        );
      }
    };
    attach();
  }, [routeCoords, driverLat, driverLng, pickupLat, pickupLng]);

  // place markers
  useEffect(() => {
    if (!mapRef.current) return;
    const attach = () => {
      if (!mapRef.current?.isStyleLoaded()) { setTimeout(attach, 80); return; }
      markersRef.current.forEach(m => { try { m.remove(); } catch {} });
      markersRef.current = [];

      if (driverLat && driverLng) {
        const el = document.createElement('div');
        el.style.cssText = 'position:relative;width:16px;height:16px;display:flex;align-items:center;justify-content:center;';
        el.innerHTML = `
          <div style="width:14px;height:14px;border-radius:50%;background:#3B82F6;border:2.5px solid #fff;box-shadow:0 0 14px rgba(59,130,246,.8);z-index:1;"></div>
          <div style="position:absolute;inset:-8px;border-radius:50%;border:2px solid rgba(59,130,246,.35);animation:trm2-pulse 2s ease-in-out infinite;"></div>
        `;
        markersRef.current.push(
          new window.mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([driverLng, driverLat]).addTo(mapRef.current)
        );
      }

      if (pickupLat && pickupLng) {
        const el = document.createElement('div');
        el.style.cssText = 'display:flex;flex-direction:column;align-items:center;pointer-events:none;';
        el.innerHTML = `
          <div style="padding:4px 8px;border-radius:7px;background:rgba(3,6,4,.88);border:1.5px solid rgba(74,222,128,.5);box-shadow:0 4px 14px rgba(0,0,0,.5),0 0 12px rgba(74,222,128,.25);color:#4ADE80;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;white-space:nowrap;">
            ● PICKUP
          </div>
          <div style="width:2px;height:9px;background:rgba(74,222,128,.55);margin-top:-1px;"></div>
          <div style="width:6px;height:6px;border-radius:50%;background:#4ADE80;box-shadow:0 0 8px #4ADE80;"></div>
        `;
        markersRef.current.push(
          new window.mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([pickupLng, pickupLat]).addTo(mapRef.current)
        );
      }
    };
    attach();
  }, [driverLat, driverLng, pickupLat, pickupLng]);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
}

// ═══════════════════════════════════════════════════════════════════════════
// TIMER RING (unchanged design)
// ═══════════════════════════════════════════════════════════════════════════
function TimerRing({ timer, total = 60 }) {
  const R    = 20;
  const circ = 2 * Math.PI * R;
  const pct  = timer / total;
  const danger = timer <= 10;
  return (
    <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
      <svg width="52" height="52" viewBox="0 0 52 52" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="26" cy="26" r={R} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="3" />
        <circle cx="26" cy="26" r={R} fill="none"
          stroke={danger ? C.redDeep : C.greenBright}
          strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke .3s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: MONO, fontSize: 15, fontWeight: 700,
        color: danger ? C.redDeep : C.white,
        borderRadius: '50%',
        animation: danger ? 'trm2-alert 1s ease-in-out infinite' : 'none',
        transition: 'color .3s',
      }}>
        {timer}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTE RAIL
// ═══════════════════════════════════════════════════════════════════════════
function RouteRail() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0, paddingTop:3, gap:0 }}>
      <div style={{ width:9, height:9, borderRadius:'50%', background:C.greenBright, border:'1.5px solid rgba(255,255,255,.6)', boxShadow:`0 0 8px ${C.greenBright}` }} />
      <div style={{ width:1.5, height:26, background:`linear-gradient(to bottom, ${C.greenBright}55, rgba(255,255,255,.1))`, margin:'4px 0', borderRadius:2 }} />
      <div style={{ width:9, height:9, background:'rgba(255,255,255,.7)', transform:'rotate(45deg)', boxShadow:'0 0 6px rgba(255,255,255,.35)' }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BIDIRECTIONAL SLIDE CONTROL
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Thumb starts centered.
 * Drag RIGHT ≥ 75% of half-track → onAccept
 * Drag LEFT  ≥ 75% of half-track → onDecline
 * Release early → spring back to center.
 */
function BidirectionalSlide({ onAccept, onDecline, pending, disabled }) {
  const trackRef   = useRef(null);
  const halfRef    = useRef(0);          // half of usable travel
  const draggingRef = useRef(false);
  const offsetRef  = useRef(0);          // live offset from center (px)
  const [x, setX]         = useState(0);
  const [result, setResult] = useState(null); // 'accept' | 'decline' | null

  const THUMB = 58;
  const PAD   = 4;
  const COMMIT = 0.75;   // fraction of half-track needed to commit

  const measure = useCallback(() => {
    if (!trackRef.current) return;
    halfRef.current = Math.max(0, (trackRef.current.clientWidth - THUMB - PAD * 2) / 2);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const clientX = (e) => e.touches?.[0]?.clientX ?? e.clientX ?? 0;
  const setOffset = (px) => { offsetRef.current = px; setX(px); };

  const onDown = (e) => {
    if (pending || disabled || result) return;
    draggingRef.current = true;
    measure();
    const startX = clientX(e);
    const startOffset = offsetRef.current;

    const move = (ev) => {
      if (!draggingRef.current) return;
      let nx = startOffset + (clientX(ev) - startX);
      nx = Math.max(-halfRef.current, Math.min(halfRef.current, nx));
      setOffset(nx);
      if (ev.cancelable) ev.preventDefault();
    };

    const up = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);

      const ratio = offsetRef.current / halfRef.current;
      if (ratio >= COMMIT) {
        setOffset(halfRef.current);
        setResult('accept');
        onAccept?.();
      } else if (ratio <= -COMMIT) {
        setOffset(-halfRef.current);
        setResult('decline');
        onDecline?.();
      } else {
        setOffset(0); // spring back
      }
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
  };

  // normalized 0→1 for right fill, 0→-1 for left fill
  const ratio  = halfRef.current ? x / halfRef.current : 0;
  const isRight = ratio > 0;
  const isLeft  = ratio < 0;
  const progress = Math.abs(ratio);

  const acceptColor  = C.greenBright;
  const declineColor = C.redDeep;
  const activeColor  = isRight ? acceptColor : isLeft ? declineColor : acceptColor;

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      {/* end labels */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginBottom: 8, padding: '0 2px',
      }}>
        <span style={{
          fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.14em',
          color: isLeft ? declineColor : 'rgba(255,255,255,.22)',
          transition: 'color .2s',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {/* left chevrons */}
          {[0,1,2].map(i => (
            <svg key={i} width="9" height="9" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: `trm2-chev-left 1.3s ${i * 0.14}s ease-in-out infinite` }}>
              <polyline points="15 6 9 12 15 18"/>
            </svg>
          ))}
          DECLINE
        </span>
        <span style={{
          fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.14em',
          color: isRight ? acceptColor : 'rgba(255,255,255,.22)',
          transition: 'color .2s',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          ACCEPT
          {[0,1,2].map(i => (
            <svg key={i} width="9" height="9" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: `trm2-chev-right 1.3s ${i * 0.14}s ease-in-out infinite` }}>
              <polyline points="9 6 15 12 9 18"/>
            </svg>
          ))}
        </span>
      </div>

      {/* track */}
      <div
        ref={trackRef}
        style={{
          position: 'relative', width: '100%', height: THUMB + PAD * 2,
          borderRadius: 20,
          background: 'rgba(255,255,255,.04)',
          border: isRight
            ? `1px solid ${acceptColor}44`
            : isLeft
            ? `1px solid ${declineColor}44`
            : '1px solid rgba(255,255,255,.1)',
          overflow: 'hidden',
          transition: 'border-color .2s',
        }}
      >
        {/* left (decline) fill */}
        <div style={{
          position: 'absolute',
          top: 0, bottom: 0,
          right: '50%',
          width: isLeft ? `${Math.abs(ratio) * 50}%` : 0,
          background: `linear-gradient(to left, ${declineColor}33, ${declineColor}18)`,
          transition: draggingRef.current ? 'none' : 'width .25s cubic-bezier(.34,1.1,.64,1)',
        }} />

        {/* right (accept) fill */}
        <div style={{
          position: 'absolute',
          top: 0, bottom: 0,
          left: '50%',
          width: isRight ? `${ratio * 50}%` : 0,
          background: `linear-gradient(to right, ${acceptColor}33, ${acceptColor}18)`,
          transition: draggingRef.current ? 'none' : 'width .25s cubic-bezier(.34,1.1,.64,1)',
        }} />

        {/* center notch */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 1.5, height: 28, borderRadius: 2,
          background: 'rgba(255,255,255,.14)',
          pointerEvents: 'none',
        }} />

        {/* draggable thumb — positioned from center */}
        <div
          onPointerDown={onDown}
          onTouchStart={onDown}
          style={{
            position: 'absolute',
            top: PAD,
            // center = (trackWidth - THUMB) / 2 = halfRef * 2 / 2 ... we compute via left offset
            left: `calc(50% - ${THUMB / 2}px + ${x}px)`,
            width: THUMB, height: THUMB,
            borderRadius: 16,
            background: result === 'accept'
              ? `linear-gradient(135deg, ${acceptColor}, #16A34A)`
              : result === 'decline'
              ? `linear-gradient(135deg, ${declineColor}, #B91C1C)`
              : pending
              ? 'rgba(255,255,255,.1)'
              : `linear-gradient(135deg, ${activeColor}ee, ${activeColor}99)`,
            boxShadow: pending
              ? 'none'
              : result === 'accept'
              ? `0 4px 20px ${acceptColor}66, inset 0 1px 0 rgba(255,255,255,.3)`
              : result === 'decline'
              ? `0 4px 20px ${declineColor}66, inset 0 1px 0 rgba(255,255,255,.2)`
              : `0 4px 20px ${activeColor}55, inset 0 1px 0 rgba(255,255,255,.25)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: pending || result ? 'default' : 'grab',
            touchAction: 'none',
            transition: draggingRef.current
              ? 'background .12s, box-shadow .12s'
              : 'left .28s cubic-bezier(.34,1.1,.64,1), background .2s, box-shadow .2s',
            zIndex: 2,
          }}
        >
          {pending ? (
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              border: '2px solid rgba(0,0,0,.25)', borderTop: '2px solid #000',
              animation: 'trm2-spin .7s linear infinite',
            }}/>
          ) : result === 'accept' ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="#000" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : result === 'decline' ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          ) : (
            /* double-headed arrow at rest */
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke={x !== 0 ? '#000' : C.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              style={{ opacity: x !== 0 ? 1 : 0.8 }}>
              <path d="M7 12l-4 0M3 12l3-3M3 12l3 3M17 12l4 0M21 12l-3-3M21 12l-3 3"/>
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function TripRequestModal({
  driver,
  tripRequest,
  requestTimer,
  onAccept,
  onDecline,
  actionPending = false,
}) {
  const [polyline,   setPolyline]   = useState(null);
  const [driverDist, setDriverDist] = useState(null);
  const [driverEta,  setDriverEta]  = useState(null);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [mapLoaded,  setMapLoaded]  = useState(false);
  const prevTripId = useRef(null);

  // inject keyframes
  useEffect(() => {
    if (document.getElementById('trm2-css')) return;
    const style = document.createElement('style');
    style.id = 'trm2-css';
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');
      @keyframes trm2-spin         { to { transform: rotate(360deg); } }
      @keyframes trm2-blink        { 0%,100%{opacity:1} 50%{opacity:.2} }
      @keyframes trm2-pulse        { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.7)} }
      @keyframes trm2-alert        { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0)} 50%{box-shadow:0 0 0 8px rgba(239,68,68,.2)} }
      @keyframes trm2-slideup      { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
      @keyframes trm2-fadein       { from{opacity:0} to{opacity:1} }
      @keyframes trm2-chev-right   { 0%,100%{opacity:.3;transform:translateX(0)} 50%{opacity:1;transform:translateX(2.5px)} }
      @keyframes trm2-chev-left    { 0%,100%{opacity:.3;transform:translateX(0)} 50%{opacity:1;transform:translateX(-2.5px)} }
      @keyframes trm2-shimmer      { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
      .trm2-map .mapboxgl-ctrl-logo,
      .trm2-map .mapboxgl-ctrl-attrib { display:none !important; }
    `;
    document.head.appendChild(style);
  }, []);

  // fetch route on new trip
  useEffect(() => {
    if (!tripRequest || !driver) return;
    if (prevTripId.current === tripRequest.id) return;
    prevTripId.current = tripRequest.id;
    setPolyline(null);
    setDriverDist(null);
    setDriverEta(null);
    setLoadingGeo(true);
    callGetDriverToPickup({
      driverLat: driver.lat, driverLng: driver.lng,
      pickupLat: tripRequest.pickupLat, pickupLng: tripRequest.pickupLng,
    }).then(({ data }) => {
      if (data?.success) {
        setDriverDist(data.distanceText ?? null);
        setDriverEta(data.etaText ?? null);
        setPolyline(data.polyline ?? null);
      }
    }).catch(console.error)
      .finally(() => setLoadingGeo(false));
  }, [tripRequest?.id]);

  if (!tripRequest) return null;

  const payMethod    = tripRequest.paymentMethod ?? 'card';
  const payCfg       = PAY_CFG[payMethod] ?? PAY_CFG.card;
  const rideColor    = TYPE_COLOR[tripRequest.rideType] ?? '#3B82F6';
  const fare         = `$${tripRequest.driverPayout?.toFixed(2) ?? '0.00'}`;
  const pickupText   = maskAddress(tripRequest.pickup);
  const dropoffText  = maskAddress(tripRequest.dropoff);
  const danger       = requestTimer <= 10;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 800,
      background: C.bg,
      fontFamily: MONO,
    }}>
      {/* ── full-screen map ── */}
      <div className="trm2-map" style={{ position: 'absolute', inset: 0 }}>
        {!loadingGeo ? (
          <FullscreenMap
            driverLat={driver?.lat}
            driverLng={driver?.lng}
            pickupLat={tripRequest.pickupLat}
            pickupLng={tripRequest.pickupLng}
            polyline={polyline}
            onReady={() => setMapLoaded(true)}
          />
        ) : (
          /* shimmer placeholder while route loads */
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg, #050A06 25%, #0C1410 50%, #050A06 75%)',
            backgroundSize: '200% 100%',
            animation: 'trm2-shimmer 1.8s ease-in-out infinite',
          }} />
        )}
      </div>

      {/* ── vignette (depth + bottom panel legibility) ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
        background: [
          'radial-gradient(ellipse at 50% 44%, transparent 35%, rgba(3,6,4,.3) 75%, rgba(3,6,4,.7) 100%)',
          'linear-gradient(to bottom, rgba(3,6,4,.55) 0%, transparent 22%, transparent 42%, rgba(2,5,3,.92) 100%)',
        ].join(', '),
      }} />

      {/* ── top ribbon ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
        paddingTop: 'max(14px, env(safe-area-inset-top))',
        pointerEvents: 'none',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 18px', height: 44,
        }}>
          {/* brand */}
          <span style={{
            fontFamily: COND, fontSize: 12, fontWeight: 800, letterSpacing: '.22em',
            color: 'rgba(255,255,255,.45)',
          }}>
            UATOB
          </span>

          {/* center: NEW RIDE badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: C.panelDeep, backdropFilter: 'blur(12px)',
            border: `1px solid ${rideColor}44`,
            borderRadius: 99, padding: '5px 12px',
            animation: 'trm2-fadein .4s ease both',
          }}>
            {tripRequest.surgeMultiplier > 1 && <Zap size={10} color={rideColor}/>}
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: rideColor, boxShadow: `0 0 8px ${rideColor}`,
              animation: 'trm2-blink 1.4s ease-in-out infinite',
              display: 'inline-block',
            }}/>
            <span style={{
              fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.14em',
              color: rideColor,
            }}>
              NEW {(TYPE_LABEL[tripRequest.rideType] ?? 'RIDE').toUpperCase()} REQUEST
            </span>
          </div>

          {/* timer */}
          <TimerRing timer={requestTimer} total={60} />
        </div>

        {/* color accent line under ribbon */}
        <div style={{
          height: 2, marginTop: 4,
          background: `linear-gradient(90deg, transparent, ${rideColor}99 30%, ${rideColor}99 70%, transparent)`,
        }}/>
      </div>

      {/* ── LIVE + ETA pill (floats on the map) ── */}
      {!loadingGeo && (driverDist || driverEta) && (
        <div style={{
          position: 'absolute', top: 'calc(78px + env(safe-area-inset-top))',
          left: '50%', transform: 'translateX(-50%)',
          zIndex: 22, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', gap: 8,
          background: C.panelDeep, backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 99, padding: '5px 14px',
          animation: 'trm2-fadein .5s .2s ease both',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:C.greenBright, boxShadow:`0 0 6px ${C.greenBright}`, animation:'trm2-blink 1.6s ease-in-out infinite', display:'inline-block' }}/>
          {driverDist && (
            <span style={{ fontFamily:MONO, fontSize:11, fontWeight:700, color:C.white }}>
              {driverDist}
            </span>
          )}
          {driverDist && driverEta && (
            <span style={{ width:1, height:10, background:'rgba(255,255,255,.15)' }}/>
          )}
          {driverEta && (
            <span style={{ fontFamily:MONO, fontSize:11, fontWeight:700, color:C.greenBright }}>
              {driverEta} to pickup
            </span>
          )}
        </div>
      )}

      {/* ── bottom panel ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30,
        animation: 'trm2-slideup .45s cubic-bezier(.34,1.1,.64,1) both',
      }}>
        <div style={{
          background: C.panelDeep,
          borderTop: `1px solid ${rideColor}28`,
          borderRadius: '26px 26px 0 0',
          backdropFilter: 'blur(20px)',
          boxShadow: `0 -16px 56px rgba(0,0,0,.7), 0 0 44px ${rideColor}0e`,
          padding: '12px 18px max(20px, calc(env(safe-area-inset-bottom) + 14px))',
        }}>
          {/* drag handle */}
          <div style={{ width:36, height:3.5, borderRadius:2, background:'rgba(255,255,255,.12)', margin:'0 auto 14px' }} />

          {/* ── fare + payment row ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 14,
          }}>
            {/* fare */}
            <div style={{ display:'flex', alignItems:'baseline', gap:5 }}>
              <span style={{
                fontFamily: COND, fontSize: 46, fontWeight: 900, lineHeight: 1,
                letterSpacing: '.02em', color: C.white,
              }}>
                {fare}
              </span>
              {tripRequest.surgeMultiplier > 1 && (
                <span style={{
                  display:'inline-flex', alignItems:'center', gap:3,
                  background:'rgba(234,179,8,.12)', border:'1px solid rgba(234,179,8,.3)',
                  borderRadius:6, padding:'3px 7px', marginLeft:4,
                  fontFamily:COND, fontSize:10, fontWeight:800, letterSpacing:'.06em', color:'#EAB308',
                }}>
                  <Zap size={9} color="#EAB308" fill="#EAB308" />
                  {tripRequest.surgeMultiplier}× SURGE
                </span>
              )}
            </div>

            {/* payment badge */}
            <div style={{
              display:'inline-flex', alignItems:'center', gap:6,
              background: payCfg.bg, border:`1px solid ${payCfg.border}`,
              borderRadius:10, padding:'6px 12px',
            }}>
              <span style={{ fontSize:12, color:payCfg.color }}>{payCfg.icon}</span>
              <span style={{ fontFamily:MONO, fontSize:10, fontWeight:800, letterSpacing:'.1em', color:payCfg.color }}>
                {payCfg.label}
              </span>
            </div>
          </div>

          {/* ── route strip ── */}
          <div style={{
            display:'flex', gap:12, alignItems:'stretch',
            background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)',
            borderRadius:14, padding:'10px 13px', marginBottom:14,
          }}>
            <RouteRail/>
            <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:9 }}>
              {/* pickup */}
              <div>
                <div style={{ fontFamily:COND, fontSize:8, fontWeight:800, letterSpacing:'.14em', color:C.inkDim, textTransform:'uppercase', marginBottom:2 }}>
                  Pickup
                </div>
                <div style={{ fontFamily:MONO, fontSize:12, fontWeight:700, color:C.white, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {pickupText}
                </div>
              </div>
              {/* dropoff */}
              <div>
                <div style={{ fontFamily:COND, fontSize:8, fontWeight:800, letterSpacing:'.14em', color:C.inkDim, textTransform:'uppercase', marginBottom:2 }}>
                  Drop-off
                </div>
                <div style={{ fontFamily:MONO, fontSize:12, fontWeight:600, color:'rgba(255,255,255,.55)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {dropoffText}
                </div>
              </div>
            </div>

            {/* trip stats */}
            <div style={{ display:'flex', flexDirection:'column', gap:8, flexShrink:0, alignItems:'flex-end', justifyContent:'center' }}>
              {[
                { label:'DIST',  value:`${tripRequest.tripDistanceMiles?.toFixed(1) ?? '—'} mi` },
                { label:'TIME',  value:`${tripRequest.tripDurationMin ?? '—'} min` },
              ].map(s => (
                <div key={s.label} style={{ textAlign:'right' }}>
                  <div style={{ fontFamily:COND, fontSize:8, fontWeight:800, letterSpacing:'.12em', color:C.inkDim, marginBottom:1 }}>
                    {s.label}
                  </div>
                  <div style={{ fontFamily:MONO, fontSize:13, fontWeight:700, color:C.white }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── bidirectional slide control ── */}
          <BidirectionalSlide
            onAccept={onAccept}
            onDecline={onDecline}
            pending={actionPending}
            disabled={false}
          />
        </div>
      </div>
    </div>
  );
}
