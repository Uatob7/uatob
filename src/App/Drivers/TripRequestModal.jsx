import { useState, useEffect, useMemo, useRef } from 'react';
import { Zap, Check, X } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebase_app } from '@/firebase/config';
import { C, TYPE_COLOR, TYPE_LABEL } from '@/App/Drivers/constants.js';

const functions = getFunctions(firebase_app, "us-east1");
const callGetDriverToPickup = httpsCallable(functions, "getDriverToPickup");

const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';

// ── Payment method config ──────────────────────────────────────────────
const PAYMENT_CONFIG = {
  cash: {
    label: 'CASH',
    color: '#F59E0B',
    bg:    'rgba(245,158,11,.13)',
    border:'rgba(245,158,11,.32)',
    icon:  '💵',
  },
  card: {
    label: 'CARD',
    color: '#60A5FA',
    bg:    'rgba(96,165,250,.12)',
    border:'rgba(96,165,250,.28)',
    icon:  '💳',
  },
  cashapp: {
    label: 'CASH APP',
    color: '#34D399',
    bg:    'rgba(52,211,153,.12)',
    border:'rgba(52,211,153,.28)',
    icon:  '$',
  },
};

// ── Polyline decoder ───────────────────────────────────────────────────
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

// ── Mapbox loader ──────────────────────────────────────────────────────
let _mbLoaded = false;
let _mbCallbacks = [];
function loadMapbox(cb) {
  if (_mbLoaded && window.mapboxgl) { cb(); return; }
  _mbCallbacks.push(cb);
  if (document.getElementById('mapbox-css')) return;
  const link = document.createElement('link');
  link.id = 'mapbox-css'; link.rel = 'stylesheet';
  link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
  document.head.appendChild(link);
  const script = document.createElement('script');
  script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
  script.onload = () => { _mbLoaded = true; _mbCallbacks.forEach(fn => fn()); _mbCallbacks = []; };
  document.head.appendChild(script);
}

// ── Global styles ──────────────────────────────────────────────────────
const MODAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=Bebas+Neue&display=swap');

  @keyframes trm-slideUp {
    from { opacity: 0; transform: translateY(32px) scale(.97); }
    to   { opacity: 1; transform: translateY(0)   scale(1);   }
  }
  @keyframes trm-backdropIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes trm-timerAlert {
    0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
    50%     { box-shadow: 0 0 0 8px rgba(239,68,68,0.2); }
  }
  @keyframes trm-livePulse {
    0%,100% { opacity: 1; transform: scale(1); }
    50%     { opacity: .4; transform: scale(.7); }
  }
  @keyframes trm-shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
  }
  @keyframes trm-routeDraw {
    from { stroke-dashoffset: 600; }
    to   { stroke-dashoffset: 0;   }
  }
  @keyframes trm-fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes trm-payBadgePop {
    0%   { opacity: 0; transform: scale(.82) translateY(4px); }
    70%  { transform: scale(1.06) translateY(-1px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }

  .trm-backdrop {
    animation: trm-backdropIn .2s ease both;
  }
  .trm-card {
    animation: trm-slideUp .42s cubic-bezier(.22, 1, .36, 1) both;
  }
  .trm-fade {
    animation: trm-fadeIn .35s ease both;
  }
  .trm-pay-badge {
    animation: trm-payBadgePop .38s cubic-bezier(.22,1,.36,1) both;
    animation-delay: .12s;
  }

  .trm-map-container .mapboxgl-ctrl-logo,
  .trm-map-container .mapboxgl-ctrl-attrib-button { display: none !important; }
  .trm-map-container .mapboxgl-ctrl-attrib {
    font-size: 8px !important;
    opacity: .15 !important;
    background: transparent !important;
  }
  .trm-map-container .mapboxgl-ctrl-bottom-right { bottom: 4px !important; right: 4px !important; }

  .trm-accept-btn:not(:disabled):hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 36px rgba(34,197,94,.45) !important;
  }
  .trm-accept-btn:not(:disabled):active {
    transform: translateY(0);
  }
  .trm-decline-btn:not(:disabled):hover {
    border-color: rgba(239,68,68,.5) !important;
    color: #EF4444 !important;
    background: rgba(239,68,68,.07) !important;
  }
  .trm-accept-btn, .trm-decline-btn {
    transition: all .18s cubic-bezier(.4,0,.2,1);
  }
`;

// ── Payment Badge ──────────────────────────────────────────────────────
function PaymentBadge({ paymentMethod }) {
  const cfg = PAYMENT_CONFIG[paymentMethod] ?? PAYMENT_CONFIG.card;
  const isCashApp = paymentMethod === 'cashapp';

  return (
    <div
      className="trm-pay-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 8,
        padding: '4px 9px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle inner glow strip */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(135deg, ${cfg.color}18 0%, transparent 60%)`,
        pointerEvents: 'none',
      }} />

      {/* Icon */}
      <span style={{
        fontSize: isCashApp ? 10 : 11,
        lineHeight: 1,
        fontFamily: isCashApp ? "'DM Mono', monospace" : 'inherit',
        fontWeight: isCashApp ? 800 : 'normal',
        color: cfg.color,
        position: 'relative',
      }}>
        {cfg.icon}
      </span>

      {/* Label */}
      <span style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '.1em',
        color: cfg.color,
        position: 'relative',
      }}>
        {cfg.label}
      </span>
    </div>
  );
}

// ── Mapbox Route Map ───────────────────────────────────────────────────
function MapboxRouteMap({ polyline, driverLat, driverLng, pickupLat, pickupLng }) {
  const containerRef   = useRef(null);
  const mapRef         = useRef(null);
  const markersRef     = useRef([]);
  const initializedRef = useRef(false);

  const routeCoords = useMemo(() => {
    if (!polyline) return [];
    return decodePolyline(polyline).map(p => [p[1], p[0]]);
  }, [polyline]);

  const bounds = useMemo(() => {
    const pts = [];
    if (driverLat && driverLng) pts.push([driverLng, driverLat]);
    if (pickupLat && pickupLng) pts.push([pickupLng, pickupLat]);
    routeCoords.forEach(p => pts.push(p));
    if (!pts.length) return null;
    return {
      minLng: Math.min(...pts.map(p => p[0])),
      maxLng: Math.max(...pts.map(p => p[0])),
      minLat: Math.min(...pts.map(p => p[1])),
      maxLat: Math.max(...pts.map(p => p[1])),
    };
  }, [driverLat, driverLng, pickupLat, pickupLng, routeCoords]);

  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    loadMapbox(() => {
      if (!containerRef.current || initializedRef.current) return;
      initializedRef.current = true;
      window.mapboxgl.accessToken = MAPBOX_TOKEN;
      const center = driverLng && driverLat
        ? [driverLng, driverLat]
        : pickupLng && pickupLat
        ? [pickupLng, pickupLat]
        : [-81.3792, 28.5383];

      mapRef.current = new window.mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center, zoom: 13,
        attributionControl: false,
        interactive: false,
        fadeDuration: 200,
      });
      mapRef.current.addControl(new window.mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
    });
    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; initializedRef.current = false; }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !routeCoords.length) return;
    const attach = () => {
      if (!mapRef.current?.isStyleLoaded()) { setTimeout(attach, 80); return; }
      const geo = { type: 'Feature', geometry: { type: 'LineString', coordinates: routeCoords } };
      if (mapRef.current.getSource('route')) {
        mapRef.current.getSource('route').setData(geo);
      } else {
        mapRef.current.addSource('route', { type: 'geojson', data: geo });
        mapRef.current.addLayer({ id: 'route-glow', type: 'line', source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 0.12, 'line-blur': 4 } });
        mapRef.current.addLayer({ id: 'route-main', type: 'line', source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#22C55E', 'line-width': 3.5, 'line-opacity': 1 } });
        mapRef.current.addLayer({ id: 'route-dash', type: 'line', source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#fff', 'line-width': 1.5, 'line-opacity': 0.4, 'line-dasharray': [0, 5] } });
      }
    };
    attach();
  }, [routeCoords]);

  useEffect(() => {
    if (!mapRef.current) return;
    const attach = () => {
      if (!mapRef.current?.isStyleLoaded()) { setTimeout(attach, 80); return; }
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      if (driverLat && driverLng) {
        const el = document.createElement('div');
        el.style.cssText = 'position:relative;width:12px;height:12px;';
        el.innerHTML = `
          <div style="width:12px;height:12px;border-radius:50%;background:#3B82F6;border:2px solid #fff;box-shadow:0 0 12px rgba(59,130,246,.7);"></div>
          <div style="position:absolute;inset:-6px;border-radius:50%;border:1.5px solid rgba(59,130,246,.4);animation:trm-livePulse 2s ease-in-out infinite;"></div>
        `;
        markersRef.current.push(
          new window.mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([driverLng, driverLat]).addTo(mapRef.current)
        );
      }

      if (pickupLat && pickupLng) {
        const el = document.createElement('div');
        el.style.cssText = 'width:10px;height:10px;border-radius:50%;background:#22C55E;border:2px solid #fff;box-shadow:0 0 10px rgba(34,197,94,.65);';
        markersRef.current.push(
          new window.mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([pickupLng, pickupLat]).addTo(mapRef.current)
        );
      }

      if (bounds) {
        mapRef.current.fitBounds(
          [[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]],
          { padding: 44, maxZoom: 15, duration: 600 }
        );
      }
    };
    attach();
  }, [bounds, driverLat, driverLng, pickupLat, pickupLng]);

  return <div ref={containerRef} className="trm-map-container" style={{ width: '100%', height: '100%' }} />;
}

// ── Timer Ring ─────────────────────────────────────────────────────────
function TimerRing({ timer, total = 15 }) {
  const R = 20;
  const circ = 2 * Math.PI * R;
  const pct  = timer / total;
  const danger = timer <= 5;

  return (
    <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
      <svg width="52" height="52" viewBox="0 0 52 52" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="26" cy="26" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="3" />
        <circle
          cx="26" cy="26" r={R} fill="none"
          stroke={danger ? '#EF4444' : '#22C55E'}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke .3s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'DM Mono', monospace",
        fontSize: 15, fontWeight: 500,
        color: danger ? '#EF4444' : 'rgba(255,255,255,.9)',
        animation: danger ? 'trm-timerAlert 1s ease-in-out infinite' : 'none',
        borderRadius: '50%',
        transition: 'color .3s',
      }}>
        {timer}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────
export default function TripRequestModal({
  driver,
  tripRequest,
  requestTimer,
  onAccept,
  onDecline,
  actionPending = false,
}) {
  const [driverDistance, setDriverDistance] = useState(null);
  const [driverEta,      setDriverEta]      = useState(null);
  const [polyline,       setPolyline]       = useState(null);
  const [loadingGeo,     setLoadingGeo]     = useState(false);
  const prevTripId = useRef(null);

  useEffect(() => {
    if (!document.getElementById('trm-modal-css')) {
      const s = document.createElement('style');
      s.id = 'trm-modal-css';
      s.textContent = MODAL_CSS;
      document.head.appendChild(s);
    }
  }, []);

  useEffect(() => {
    if (!tripRequest || !driver) return;
    if (prevTripId.current === tripRequest.id) return;
    prevTripId.current = tripRequest.id;
    setLoadingGeo(true);
    setPolyline(null);
    callGetDriverToPickup({
      driverLat: driver.lat, driverLng: driver.lng,
      pickupLat: tripRequest.pickupLat, pickupLng: tripRequest.pickupLng,
    }).then(({ data }) => {
      if (data?.success) {
        setDriverDistance(data.distanceText);
        setDriverEta(data.etaText);
        setPolyline(data.polyline ?? null);
      }
    }).catch(console.error)
      .finally(() => setLoadingGeo(false));
  }, [tripRequest?.id]);

  if (!tripRequest) return null;

  const fare         = `$${tripRequest.driverPayout?.toFixed(2) ?? '0.00'}`;
  const distText     = loadingGeo ? null : (driverDistance ?? null);
  const etaText      = loadingGeo ? null : (driverEta ?? null);
  const danger       = requestTimer <= 5;
  const rideColor    = TYPE_COLOR[tripRequest.rideType] ?? '#3B82F6';
  const pickupShort  = (tripRequest.pickup ?? '').split(',')[0].trim();
  const dropoffShort = (tripRequest.dropoff ?? '').split(',')[0].trim();
  const payMethod    = tripRequest.paymentMethod ?? 'card';

  return (
    <>
      {/* Backdrop */}
      <div
        className="trm-backdrop"
        style={{
          position: 'fixed', inset: 0, zIndex: 800,
          background: 'rgba(4,6,12,.82)',
          backdropFilter: 'blur(18px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          padding: '0 0 env(safe-area-inset-bottom)',
        }}
      >
        {/* Card */}
        <div
          className="trm-card"
          style={{
            width: '100%', maxWidth: 480,
            background: 'linear-gradient(180deg, #0E1117 0%, #090C13 100%)',
            borderRadius: '28px 28px 0 0',
            border: '1px solid rgba(255,255,255,.07)',
            borderBottom: 'none',
            overflow: 'hidden',
            boxShadow: '0 -24px 80px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.06)',
          }}
        >
          {/* Top accent line */}
          <div style={{
            height: 2,
            background: `linear-gradient(90deg, transparent 0%, ${rideColor} 30%, ${rideColor} 70%, transparent 100%)`,
            opacity: .9,
          }} />

          {/* ── Header ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 20px 0',
          }}>
            {/* Left: badges + fare */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

              {/* Ride type pill */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: rideColor + '16',
                border: `1px solid ${rideColor}35`,
                borderRadius: 8, padding: '4px 10px',
              }}>
                {tripRequest.surgeMultiplier > 1 && <Zap size={10} color={rideColor} />}
                <span style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 10.5, fontWeight: 700,
                  letterSpacing: '.08em', textTransform: 'uppercase',
                  color: rideColor,
                }}>
                  {TYPE_LABEL[tripRequest.rideType] ?? tripRequest.rideType}
                </span>
              </div>

              {/* ── Payment badge ── */}
              <PaymentBadge paymentMethod={payMethod} />

              {/* Fare */}
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 40, lineHeight: 1,
                color: '#fff',
                letterSpacing: '.02em',
              }}>
                {fare}
              </div>

              {tripRequest.surgeMultiplier > 1 && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'rgba(234,179,8,.12)', border: '1px solid rgba(234,179,8,.3)',
                  borderRadius: 6, padding: '3px 7px',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 10, fontWeight: 800, letterSpacing: '.06em',
                  color: '#EAB308',
                }}>
                  <Zap size={9} color="#EAB308" fill="#EAB308" />
                  {tripRequest.surgeMultiplier}× SURGE
                </div>
              )}
            </div>

            {/* Right: timer */}
            <TimerRing timer={requestTimer} total={15} />
          </div>

          {/* ── Map ── */}
          <div style={{
            margin: '16px 20px 0',
            height: 178,
            borderRadius: 16,
            overflow: 'hidden',
            position: 'relative',
            border: '1px solid rgba(255,255,255,.07)',
            background: '#070A10',
          }}>
            {loadingGeo ? (
              <div style={{
                width: '100%', height: '100%',
                background: 'linear-gradient(90deg, #0d1018 25%, #131824 50%, #0d1018 75%)',
                backgroundSize: '200% 100%',
                animation: 'trm-shimmer 1.6s ease-in-out infinite',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 11, fontWeight: 600, letterSpacing: '.08em',
                  color: 'rgba(255,255,255,.18)', textTransform: 'uppercase',
                }}>
                  Calculating route…
                </span>
              </div>
            ) : (
              <MapboxRouteMap
                polyline={polyline}
                driverLat={driver?.lat}
                driverLng={driver?.lng}
                pickupLat={tripRequest.pickupLat}
                pickupLng={tripRequest.pickupLng}
              />
            )}

            {/* LIVE badge */}
            <div style={{
              position: 'absolute', top: 10, left: 10, zIndex: 10,
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(7,10,16,.85)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 99, padding: '4px 10px',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 9.5, fontWeight: 700, letterSpacing: '.12em',
              color: 'rgba(255,255,255,.55)', textTransform: 'uppercase',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#22C55E',
                boxShadow: '0 0 6px #22C55E',
                display: 'inline-block',
                animation: 'trm-livePulse 1.6s ease-in-out infinite',
              }} />
              Live
            </div>

            {/* Distance / ETA pill */}
            {(distText || etaText) && !loadingGeo && (
              <div className="trm-fade" style={{
                position: 'absolute', bottom: 10, left: '50%',
                transform: 'translateX(-50%)', zIndex: 10,
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(7,10,16,.88)', backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,.09)',
                borderRadius: 99, padding: '5px 14px',
                whiteSpace: 'nowrap',
              }}>
                {distText && (
                  <span style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 11.5, fontWeight: 500, color: 'rgba(255,255,255,.75)',
                  }}>
                    {distText}
                  </span>
                )}
                {distText && etaText && (
                  <span style={{ width: 1, height: 10, background: 'rgba(255,255,255,.15)' }} />
                )}
                {etaText && (
                  <span style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 11.5, fontWeight: 500, color: '#22C55E',
                  }}>
                    {etaText} to pickup
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── Route strip ── */}
          <div style={{
            margin: '14px 20px 0',
            background: 'rgba(255,255,255,.03)',
            border: '1px solid rgba(255,255,255,.06)',
            borderRadius: 16, padding: '14px 16px',
            display: 'flex', gap: 14, alignItems: 'stretch',
          }}>
            {/* Rail */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 0, paddingTop: 3, flexShrink: 0,
            }}>
              <div style={{
                width: 9, height: 9, borderRadius: '50%',
                background: '#22C55E',
                boxShadow: '0 0 8px rgba(34,197,94,.5)',
                flexShrink: 0,
              }} />
              <div style={{
                width: 1.5, flex: 1, minHeight: 24,
                background: 'linear-gradient(to bottom, rgba(34,197,94,.4), rgba(255,255,255,.1))',
                margin: '4px 0', borderRadius: 2,
              }} />
              <div style={{
                width: 9, height: 9,
                background: 'rgba(255,255,255,.7)',
                transform: 'rotate(45deg)',
                flexShrink: 0,
                boxShadow: '0 0 6px rgba(255,255,255,.3)',
              }} />
            </div>

            {/* Addresses */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 9.5, fontWeight: 700,
                  letterSpacing: '.1em', textTransform: 'uppercase',
                  color: 'rgba(255,255,255,.28)', marginBottom: 3,
                }}>
                  Pickup
                </div>
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 13, fontWeight: 600,
                  color: 'rgba(255,255,255,.88)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {pickupShort}
                </div>
                {tripRequest.pickup !== pickupShort && (
                  <div style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 11, fontWeight: 400,
                    color: 'rgba(255,255,255,.3)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    marginTop: 1,
                  }}>
                    {tripRequest.pickup.split(',').slice(1).join(',').trim()}
                  </div>
                )}
              </div>
              <div>
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 9.5, fontWeight: 700,
                  letterSpacing: '.1em', textTransform: 'uppercase',
                  color: 'rgba(255,255,255,.28)', marginBottom: 3,
                }}>
                  Drop-off
                </div>
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 13, fontWeight: 600,
                  color: 'rgba(255,255,255,.6)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {dropoffShort}
                </div>
                {tripRequest.dropoff !== dropoffShort && (
                  <div style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 11, fontWeight: 400,
                    color: 'rgba(255,255,255,.22)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    marginTop: 1,
                  }}>
                    {tripRequest.dropoff.split(',').slice(1).join(',').trim()}
                  </div>
                )}
              </div>
            </div>

            {/* Trip stats */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 8,
              flexShrink: 0, alignItems: 'flex-end', justifyContent: 'center',
            }}>
              {[
                { label: 'Distance', value: `${tripRequest.tripDistanceMiles?.toFixed(1) ?? '—'} mi` },
                { label: 'Duration', value: `${tripRequest.tripDurationMin ?? '—'} min` },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'right' }}>
                  <div style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 9, fontWeight: 700,
                    letterSpacing: '.08em', textTransform: 'uppercase',
                    color: 'rgba(255,255,255,.25)', marginBottom: 1,
                  }}>
                    {s.label}
                  </div>
                  <div style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 13, fontWeight: 500,
                    color: 'rgba(255,255,255,.72)',
                  }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── CTA buttons ── */}
          <div style={{
            display: 'flex', gap: 10,
            padding: '14px 20px 20px',
          }}>
            {/* Decline */}
            <button
              className="trm-decline-btn"
              disabled={actionPending}
              onClick={onDecline}
              style={{
                width: 52, height: 52, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,.04)',
                border: '1px solid rgba(255,255,255,.1)',
                borderRadius: 14,
                color: 'rgba(255,255,255,.4)',
                cursor: actionPending ? 'not-allowed' : 'pointer',
                opacity: actionPending ? 0.5 : 1,
              }}
            >
              <X size={18} strokeWidth={2.5} />
            </button>

            {/* Accept */}
            <button
              className="trm-accept-btn"
              disabled={actionPending}
              onClick={onAccept}
              style={{
                flex: 1, height: 52,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                background: actionPending
                  ? 'rgba(34,197,94,.55)'
                  : 'linear-gradient(135deg, #22C55E 0%, #16A34A 55%, #15803D 100%)',
                border: 'none',
                borderRadius: 14,
                cursor: actionPending ? 'not-allowed' : 'pointer',
                boxShadow: actionPending ? 'none' : '0 4px 20px rgba(34,197,94,.3)',
                opacity: actionPending ? .85 : 1,
              }}
            >
              {actionPending ? (
                <span style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 13, fontWeight: 700,
                  color: '#fff', letterSpacing: '.04em',
                }}>
                  Processing…
                </span>
              ) : (
                <>
                  <Check size={17} color="#fff" strokeWidth={2.8} />
                  <span style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 14, fontWeight: 700,
                    color: '#fff', letterSpacing: '.03em',
                  }}>
                    Accept
                  </span>
                  <span style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 13, fontWeight: 500,
                    color: 'rgba(255,255,255,.75)',
                  }}>
                    {fare}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}