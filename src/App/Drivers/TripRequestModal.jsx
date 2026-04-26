





import { useState, useEffect, useMemo, useRef } from 'react';
import { Zap, Check, X } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebase_app } from '@/firebase/config';
import { C, TYPE_COLOR, TYPE_LABEL } from '@/App/Drivers/constants.js';

const functions = getFunctions(firebase_app, "us-east1");
const callGetDriverToPickup = httpsCallable(functions, "getDriverToPickup");

// Mapbox token
const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';

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
  link.id = 'mapbox-css';
  link.rel = 'stylesheet';
  link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
  document.head.appendChild(link);

  const script = document.createElement('script');
  script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
  script.onload = () => {
    _mbLoaded = true;
    _mbCallbacks.forEach(fn => fn());
    _mbCallbacks = [];
  };
  document.head.appendChild(script);
}

// ── CSS ────────────────────────────────────────────────────────────────
const ROUTE_CSS = `
  @keyframes trm-pulseRing { 0%,100%{r:10;opacity:.22} 50%{r:15;opacity:.07} }
  @keyframes trm-fadeIn    { from { opacity:0 } to { opacity:1 } }
  @keyframes trm-shimmer   {
    0%   { transform: translateX(-100%) }
    100% { transform: translateX(200%) }
  }

  .trm-pulse   { animation: trm-pulseRing 2.2s ease-in-out infinite; }
  .trm-fadein  { animation: trm-fadeIn .4s ease-out both; }

  .trm-map-wrap {
    border-radius: 16px;
    overflow: hidden;
    border: 1.5px solid rgba(255,255,255,.12);
    position: relative;
    margin-bottom: 16px;
    background: #0F1420;
    height: 200px;
  }

  .trm-map-pill {
    position: absolute; bottom: 10px; left: 50%;
    transform: translateX(-50%);
    display: flex; align-items: center; gap: 6px;
    background: rgba(17,24,39,.92);
    backdrop-filter: blur(8px);
    color: #fff; border-radius: 100px;
    padding: 6px 14px 6px 10px;
    font-size: 11px; font-weight: 700;
    white-space: nowrap; pointer-events: none;
    box-shadow: 0 2px 12px rgba(0,0,0,.3);
    letter-spacing: .3px;
    z-index: 10;
    font-family: 'Outfit', sans-serif;
  }
  .trm-map-pill-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #22C55E; flex-shrink: 0;
    box-shadow: 0 0 6px #22C55E;
    animation: pulse 1.4s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.9); }
  }

  .trm-skeleton {
    background: linear-gradient(90deg, #1e2432 25%, #252b3a 50%, #1e2432 75%);
    background-size: 200% 100%;
    animation: trm-shimmer 1.4s infinite;
    border-radius: 16px;
    height: 200px;
  }
`;

// ── Mapbox Map Component ───────────────────────────────────────────────
function MapboxRouteMap({ polyline, driverLat, driverLng, pickupLat, pickupLng, distance, eta }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const initializedRef = useRef(false);

  // Decode polyline once
  const routePoints = useMemo(() => {
    if (!polyline) return [];
    return decodePolyline(polyline);
  }, [polyline]);

  // Calculate bounds from all points
  const bounds = useMemo(() => {
    const points = [];
    if (driverLat && driverLng) points.push([driverLng, driverLat]);
    if (pickupLat && pickupLng) points.push([pickupLng, pickupLat]);
    if (routePoints.length) points.push(...routePoints.map(p => [p[1], p[0]]));
    
    if (points.length === 0) return null;
    
    const lngs = points.map(p => p[0]);
    const lats = points.map(p => p[1]);
    return {
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
    };
  }, [driverLat, driverLng, pickupLat, pickupLng, routePoints]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || initializedRef.current) return;

    loadMapbox(() => {
      if (!mapContainerRef.current || initializedRef.current) return;
      initializedRef.current = true;

      window.mapboxgl.accessToken = MAPBOX_TOKEN;

      // Default center (fallback to driver or pickup or Orlando)
      let centerLng = -81.3792;
      let centerLat = 28.5383;
      if (driverLng && driverLat) {
        centerLng = driverLng;
        centerLat = driverLat;
      } else if (pickupLng && pickupLat) {
        centerLng = pickupLng;
        centerLat = pickupLat;
      }

      mapRef.current = new window.mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [centerLng, centerLat],
        zoom: 13,
        attributionControl: false,
      });

      mapRef.current.addControl(
        new window.mapboxgl.AttributionControl({ compact: true }),
        'bottom-right'
      );
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        initializedRef.current = false;
      }
    };
  }, []); // Empty dependency array - only run on mount

  // Add route line
  useEffect(() => {
    if (!mapRef.current || !routePoints.length) return;

    const waitForMap = () => {
      if (!mapRef.current || !mapRef.current.isStyleLoaded()) {
        setTimeout(waitForMap, 100);
        return;
      }

      const geojson = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routePoints.map(p => [p[1], p[0]]),
        },
      };

      // Add source and layer
      if (mapRef.current.getSource('route')) {
        mapRef.current.getSource('route').setData(geojson);
      } else {
        mapRef.current.addSource('route', { type: 'geojson', data: geojson });
        mapRef.current.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          paint: {
            'line-color': '#22C55E',
            'line-width': 4,
            'line-opacity': 0.9,
            'line-gap-width': 0,
            'line-blur': 0,
          },
        });
        
        // Add glow effect
        mapRef.current.addLayer({
          id: 'route-glow',
          type: 'line',
          source: 'route',
          paint: {
            'line-color': '#3B82F6',
            'line-width': 8,
            'line-opacity': 0.3,
            'line-blur': 2,
          },
        });
      }
    };

    waitForMap();
  }, [routePoints]);

  // Add markers and fit bounds
  useEffect(() => {
    if (!mapRef.current || !bounds) return;

    const waitForMap = () => {
      if (!mapRef.current || !mapRef.current.isStyleLoaded()) {
        setTimeout(waitForMap, 100);
        return;
      }

      // Clear existing markers
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];

      // Add driver marker (if available)
      if (driverLat && driverLng) {
        const el = document.createElement('div');
        el.innerHTML = `
          <div style="
            width: 32px;
            height: 32px;
            background: #3B82F6;
            border-radius: 50%;
            border: 3px solid #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
              <rect x="2" y="7" width="20" height="12" rx="2" ry="2"/>
              <path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3"/>
              <line x1="7" y1="15" x2="17" y2="15"/>
            </svg>
          </div>
          <div style="
            position: absolute;
            bottom: -20px;
            left: 50%;
            transform: translateX(-50%);
            background: #3B82F6;
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
            white-space: nowrap;
            font-family: Outfit, sans-serif;
          ">You</div>
        `;
        el.style.position = 'relative';
        el.style.width = '32px';
        el.style.height = '32px';
        
        const marker = new window.mapboxgl.Marker({ element: el })
          .setLngLat([driverLng, driverLat])
          .addTo(mapRef.current);
        markersRef.current.push(marker);
      }

      // Add pickup marker
      if (pickupLat && pickupLng) {
        const el = document.createElement('div');
        el.innerHTML = `
          <div style="
            width: 32px;
            height: 32px;
            background: #22C55E;
            border-radius: 50%;
            border: 3px solid #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </div>
          <div style="
            position: absolute;
            bottom: -20px;
            left: 50%;
            transform: translateX(-50%);
            background: #22C55E;
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
            white-space: nowrap;
            font-family: Outfit, sans-serif;
          ">Pickup</div>
        `;
        el.style.position = 'relative';
        el.style.width = '32px';
        el.style.height = '32px';
        
        const marker = new window.mapboxgl.Marker({ element: el })
          .setLngLat([pickupLng, pickupLat])
          .addTo(mapRef.current);
        markersRef.current.push(marker);
      }

      // Fit bounds to show all points
      if (bounds) {
        const padding = 50;
        mapRef.current.fitBounds(
          [[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]],
          { padding, duration: 800, maxZoom: 15 }
        );
      }
    };

    waitForMap();
  }, [bounds, driverLat, driverLng, pickupLat, pickupLng]);

  return (
    <div
      ref={mapContainerRef}
      className="trm-map-wrap"
      style={{ width: '100%', height: '200px' }}
    />
  );
}

// ── Main component ─────────────────────────────────────────────────────
export default function TripRequestModal({
  driver,
  tripRequest,
  requestTimer,
  onAccept,
  onDecline,
  actionPending = false,
}) {
  const [driverDistance, setDriverDistance] = useState(null);
  const [driverEta, setDriverEta] = useState(null);
  const [polyline, setPolyline] = useState(null);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const prevTripId = useRef(null);

  // Add CSS to document - MUST be before any conditional returns
  useEffect(() => {
    if (!document.getElementById('trm-styles')) {
      const style = document.createElement('style');
      style.id = 'trm-styles';
      style.textContent = ROUTE_CSS;
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    if (!tripRequest || !driver) return;
    if (prevTripId.current === tripRequest.id) return;
    prevTripId.current = tripRequest.id;

    const fetchDriverDistance = async () => {
      setLoadingGeo(true);
      setPolyline(null);
      try {
        const { data } = await callGetDriverToPickup({
          driverLat: driver.lat,
          driverLng: driver.lng,
          pickupLat: tripRequest.pickupLat,
          pickupLng: tripRequest.pickupLng,
        });

        if (data?.success) {
          setDriverDistance(data.distanceText);
          setDriverEta(data.etaText);
          setPolyline(data.polyline ?? null);
        }
      } catch (err) {
        console.error('getDriverToPickup error:', err);
      } finally {
        setLoadingGeo(false);
      }
    };

    fetchDriverDistance();
  }, [tripRequest?.id]);

  // Move the early return AFTER all hooks
  if (!tripRequest) return null;

  const fare = `$${tripRequest.driverPayout?.toFixed(2) ?? '0.00'}`;
  const distance = loadingGeo ? '…' : (driverDistance ?? `${tripRequest.tripDistanceMiles?.toFixed(1) ?? '—'} mi`);
  const eta = loadingGeo ? '…' : (driverEta ?? `${tripRequest.tripDurationMin ?? '—'} min`);

  const pickupLabel = (tripRequest.pickup ?? '').split(',')[0].trim();

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(250,250,250,.88)',
      backdropFilter: 'blur(14px)',
      zIndex: 800,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: 16,
      animation: 'fadeIn .2s ease',
    }}>
      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderTop: `3px solid ${C.onlineGreen}`,
        borderRadius: '26px 26px 20px 20px',
        padding: '24px 20px 20px',
        width: '100%', maxWidth: 520,
        animation: 'scaleIn .38s cubic-bezier(.34,1.56,.64,1)',
        boxShadow: '0 -12px 60px rgba(0,0,0,.1)',
      }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div className="lbl" style={{ color: C.onlineGreen }}>Incoming Request</div>
            <div className="condensed" style={{ fontSize: 28, fontWeight: 900, color: C.text, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
              {tripRequest.rideLabel ?? 'Standard'}
            </div>
            <div style={{ marginTop: 6 }}>
              <span className="badge-chip" style={{
                background: (TYPE_COLOR[tripRequest.rideType] ?? C.blue) + '18',
                border: `1px solid ${(TYPE_COLOR[tripRequest.rideType] ?? C.blue)}40`,
                color: TYPE_COLOR[tripRequest.rideType] ?? C.blue,
                fontSize: 11,
              }}>
                {TYPE_LABEL[tripRequest.rideType] ?? tripRequest.rideType}
              </span>
            </div>
          </div>

          <div style={{ position: 'relative', width: 58, height: 58 }}>
            <svg width="58" height="58" viewBox="0 0 58 58">
              <circle cx="29" cy="29" r="24" fill="none" stroke={C.border} strokeWidth="3"/>
              <circle
                cx="29" cy="29" r="24" fill="none"
                stroke={requestTimer <= 5 ? C.red : C.onlineGreen}
                strokeWidth="3"
                strokeDasharray="150.8"
                strokeDashoffset={150.8 - (requestTimer / 15) * 150.8}
                strokeLinecap="round"
                transform="rotate(-90 29 29)"
                style={{ transition: 'stroke-dashoffset 1s linear, stroke .3s' }}
              />
            </svg>
            <div className="mono" style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700,
              color: requestTimer <= 5 ? C.red : C.text,
            }}>
              {requestTimer}
            </div>
          </div>
        </div>

        {/* Mapbox Map Area */}
        {loadingGeo ? (
          <div className="trm-skeleton"/>
        ) : (
          <MapboxRouteMap
            polyline={polyline}
            driverLat={driver?.lat}
            driverLng={driver?.lng}
            pickupLat={tripRequest.pickupLat}
            pickupLng={tripRequest.pickupLng}
            distance={distance}
            eta={eta}
          />
        )}
        
        {!loadingGeo && (
          <div className="trm-map-pill trm-fadein">
            <div className="trm-map-pill-dot"/>
            {polyline ? `${distance} · ${eta} to pickup` : 'Calculating route…'}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{
            flex: 1,
            background: C.onlinePale,
            border: `1px solid ${C.onlineBorder}`,
            borderRadius: 14, padding: '14px 16px',
          }}>
            <div className="lbl">Fare</div>
            <div className="mono condensed" style={{ fontSize: 30, fontWeight: 700, color: C.onlineGreen, letterSpacing: '-0.5px', lineHeight: 1 }}>
              {fare}
            </div>
            {tripRequest.surgeMultiplier > 1 && (
              <div style={{
                marginTop: 4,
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'rgba(22,163,74,.1)',
                border: '1px solid rgba(22,163,74,.28)',
                borderRadius: 6, padding: '2px 7px',
              }}>
                <Zap size={9} color={C.onlineGreen}/>
                <span className="condensed" style={{ fontSize: 11, fontWeight: 800, color: C.onlineGreen, letterSpacing: '.5px' }}>
                  {tripRequest.surgeMultiplier}× SURGE
                </span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 0.8 }}>
            {[
              { lbl: 'To Pickup', val: distance },
              { lbl: 'ETA', val: eta },
            ].map(m => (
              <div key={m.lbl} style={{
                background: C.surfaceAlt,
                border: `1px solid ${C.border}`,
                borderRadius: 12, padding: '10px 14px',
                flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
              }}>
                <div className="lbl">{m.lbl}</div>
                <div className="mono" style={{
                  fontSize: 15, fontWeight: 700,
                  color: loadingGeo ? C.textMid : C.text,
                }}>
                  {m.val}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="route-pill" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, paddingTop: 2 }}>
              <div style={{ width: 9, height: 9, background: C.blue, borderRadius: '50%', flexShrink: 0 }}/>
              <div style={{ width: 1, height: 26, background: C.border }}/>
              <div style={{ width: 9, height: 9, background: C.onlineGreen, borderRadius: 2, transform: 'rotate(45deg)', flexShrink: 0 }}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 10 }}>
                <div className="lbl">Pickup</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{tripRequest.pickup}</div>
              </div>
              <div>
                <div className="lbl">Drop-off</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{tripRequest.dropoff}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            disabled={actionPending}
            style={{
              padding: '16px 18px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: C.surface,
              border: `1.5px solid ${C.border}`,
              borderRadius: 14,
              color: C.textMid,
              cursor: actionPending ? 'not-allowed' : 'pointer',
              opacity: actionPending ? 0.6 : 1,
              boxShadow: `0 2px 8px ${C.shadow}`,
              transition: 'all .2s',
            }}
            onMouseEnter={e => { if (!actionPending) { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.color = C.red; } }}
            onMouseLeave={e => { if (!actionPending) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMid; } }}
            onClick={onDecline}
          >
            <X size={20}/>
          </button>
          <button
            disabled={actionPending}
            style={{
              flex: 1,
              padding: '16px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: actionPending
                ? 'rgba(22,163,74,0.75)'
                : 'linear-gradient(135deg, #22C55E, #16A34A 55%, #15803D)',
              border: 'none',
              borderRadius: 14,
              color: '#fff',
              fontFamily: "'Barlow',sans-serif",
              fontWeight: 800, fontSize: 15,
              cursor: actionPending ? 'not-allowed' : 'pointer',
              opacity: actionPending ? 0.85 : 1,
              boxShadow: actionPending
                ? '0 4px 18px rgba(22,163,74,.2)'
                : '0 4px 18px rgba(22,163,74,.3)',
              transition: 'all .22s',
              letterSpacing: '.3px',
            }}
            onMouseEnter={e => { if (!actionPending) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(22,163,74,.4)'; } }}
            onMouseLeave={e => { if (!actionPending) { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 18px rgba(22,163,74,.3)'; } }}
            onClick={onAccept}
          >
            <Check size={18}/> {actionPending ? 'Processing…' : `Accept · ${fare}`}
          </button>
        </div>

      </div>
    </div>
  );
}