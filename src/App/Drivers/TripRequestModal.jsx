import { useState, useEffect, useMemo, useRef } from 'react';
import { Zap, Check, X } from 'lucide-react';
import { C, TYPE_COLOR, TYPE_LABEL } from '@/App/Drivers/constants.js';

const FN_URL = "https://getdrivertopickup-ady2s2xhhq-uc.a.run.app";

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

// ── SVG projection ─────────────────────────────────────────────────────
const SVG_W = 520, SVG_H = 200, PAD = 48;

function project(pts) {
  if (!pts.length) return [];
  const lats = pts.map(p => p[0]);
  const lngs = pts.map(p => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const dLat = maxLat - minLat || 0.002;
  const dLng = maxLng - minLng || 0.002;
  const scaleX = (SVG_W - PAD * 2) / dLng;
  const scaleY = (SVG_H - PAD * 2) / dLat;
  const scale  = Math.min(scaleX, scaleY);
  const offX   = (SVG_W - dLng * scale) / 2;
  const offY   = (SVG_H - dLat * scale) / 2;
  return pts.map(([la, ln]) => ({
    x: offX + (ln - minLng) * scale,
    y: SVG_H - (offY + (la - minLat) * scale),
  }));
}

function toSVGPath(svgPts) {
  if (!svgPts.length) return '';
  return svgPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function approxPathLen(svgPts) {
  let len = 0;
  for (let i = 1; i < svgPts.length; i++) {
    const dx = svgPts[i].x - svgPts[i-1].x;
    const dy = svgPts[i].y - svgPts[i-1].y;
    len += Math.sqrt(dx*dx + dy*dy);
  }
  return Math.ceil(len) + 40;
}

// ── CSS ────────────────────────────────────────────────────────────────
const ROUTE_CSS = `
  @keyframes trm-dashFlow  { to { stroke-dashoffset: -40 } }
  @keyframes trm-pulseRing { 0%,100%{r:10;opacity:.22} 50%{r:15;opacity:.07} }
  @keyframes trm-pinDrop   {
    0%   { transform: translateY(-10px) scale(.85); opacity: 0; }
    65%  { transform: translateY(2px)   scale(1.06); opacity: 1; }
    100% { transform: translateY(0)     scale(1);    opacity: 1; }
  }
  @keyframes trm-routeDraw { from { stroke-dashoffset: var(--trm-len,1200) } to { stroke-dashoffset: 0 } }
  @keyframes trm-fadeIn    { from { opacity:0 } to { opacity:1 } }
  @keyframes trm-shimmer   {
    0%   { transform: translateX(-100%) }
    100% { transform: translateX(200%) }
  }

  .trm-flowing { animation: trm-dashFlow  1.3s linear infinite; }
  .trm-pulse   { animation: trm-pulseRing 2.2s ease-in-out infinite; }
  .trm-route   { animation: trm-routeDraw 1s cubic-bezier(.4,0,.2,1) forwards; }
  .trm-fadein  { animation: trm-fadeIn .4s ease-out both; }

  .trm-map-wrap {
    border-radius: 16px;
    overflow: hidden;
    border: 1.5px solid rgba(255,255,255,.12);
    position: relative;
    margin-bottom: 16px;
  }

  .trm-map-pill {
    position: absolute; bottom: 10px; left: 50%;
    transform: translateX(-50%);
    display: flex; align-items: center; gap: 6px;
    background: rgba(17,24,39,.82);
    backdrop-filter: blur(8px);
    color: #fff; border-radius: 100px;
    padding: 5px 12px 5px 9px;
    font-size: 11px; font-weight: 700;
    white-space: nowrap; pointer-events: none;
    box-shadow: 0 2px 12px rgba(0,0,0,.3);
    letter-spacing: .3px;
  }
  .trm-map-pill-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #22C55E; flex-shrink: 0;
    box-shadow: 0 0 6px #22C55E;
  }

  .trm-skeleton {
    background: linear-gradient(90deg, #1e2432 25%, #252b3a 50%, #1e2432 75%);
    background-size: 200% 100%;
    animation: trm-shimmer 1.4s infinite;
    border-radius: 16px;
    height: 200px;
  }
`;

// ── Route SVG ──────────────────────────────────────────────────────────
function RouteSVG({ svgPts, routeKey, driverLabel, pickupLabel }) {
  const d       = toSVGPath(svgPts);
  const len     = svgPts.length > 1 ? approxPathLen(svgPts) : 600;
  const start   = svgPts[0]                  ?? { x: 60,  y: 160 };
  const end     = svgPts[svgPts.length - 1] ?? { x: 460, y: 50  };
  const hasPath = svgPts.length > 1;

  return (
    <svg
      key={routeKey}
      width="100%"
      height={SVG_H}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      style={{ display: 'block', background: '#0F1420' }}
    >
      <defs>
        {/* Dark grid */}
        <pattern id="trm-grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M32 0L0 0 0 32" fill="none" stroke="rgba(255,255,255,.04)" strokeWidth=".8"/>
        </pattern>
        {/* Blue → green gradient for driver-to-pickup */}
        <linearGradient id="trm-rg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#3B82F6"/>
          <stop offset="100%" stopColor="#22C55E"/>
        </linearGradient>
        <filter id="trm-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Background */}
      <rect width={SVG_W} height={SVG_H} fill="#0F1420"/>
      <rect width={SVG_W} height={SVG_H} fill="url(#trm-grid)"/>

      {/* Road stripe behind route */}
      {hasPath && (() => {
        const mx = (start.x + end.x) / 2;
        const my = (start.y + end.y) / 2;
        return (
          <>
            <rect x={0} y={my - 10} width={SVG_W} height={20} fill="rgba(255,255,255,.03)" />
            <rect x={mx - 10} y={0} width={20} height={SVG_H} fill="rgba(255,255,255,.03)" />
          </>
        );
      })()}

      {/* Route halo */}
      {hasPath && (
        <path d={d} fill="none" stroke="rgba(59,130,246,.18)" strokeWidth="10"
              strokeLinecap="round" strokeLinejoin="round"/>
      )}

      {/* Animated route */}
      {hasPath && (
        <path
          className="trm-route"
          d={d}
          fill="none"
          stroke="url(#trm-rg)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#trm-glow)"
          style={{ '--trm-len': len, strokeDasharray: len }}
        />
      )}

      {/* Flowing dashes */}
      {hasPath && (
        <path
          className="trm-flowing"
          d={d}
          fill="none"
          stroke="rgba(255,255,255,.35)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeDasharray="6,16"
        />
      )}

      {/* ── Driver marker (car icon) ── */}
      <g style={{
        transformOrigin: `${start.x}px ${start.y}px`,
        animation: 'trm-pinDrop .5s cubic-bezier(.34,1.2,.64,1) .1s both',
      }}>
        {/* Pulse ring */}
        <circle className="trm-pulse" cx={start.x} cy={start.y} fill="#3B82F6"/>
        {/* Outer ring */}
        <circle cx={start.x} cy={start.y} r={14} fill="#1e2a4a" stroke="#3B82F6" strokeWidth="2"/>
        {/* Car SVG centered on marker */}
        <g transform={`translate(${start.x - 8}, ${start.y - 6})`}>
          <rect x="1" y="4"  width="14" height="7" rx="2" fill="#3B82F6"/>
          <path d="M3 4 L5 1 L11 1 L13 4Z" fill="#3B82F6" opacity=".8"/>
          <circle cx="4"  cy="11" r="1.5" fill="#0F1420"/>
          <circle cx="12" cy="11" r="1.5" fill="#0F1420"/>
          <rect x="2" y="5" width="4" height="3" rx="1" fill="rgba(255,255,255,.3)"/>
          <rect x="10" y="5" width="4" height="3" rx="1" fill="rgba(255,255,255,.3)"/>
        </g>
      </g>

      {/* Driver label */}
      {(() => {
        const text = driverLabel || 'Driver';
        const lw   = Math.min(text.length * 5.8 + 20, 120);
        const lx   = Math.max(4, Math.min(start.x - lw / 2, SVG_W - lw - 4));
        const ly   = start.y > SVG_H - 38 ? start.y - 22 : start.y + 20;
        return (
          <>
            <rect x={lx} y={ly} width={lw} height={15} rx={7}
                  fill="#3B82F6" opacity=".9"/>
            <text x={lx + lw/2} y={ly + 10.5} textAnchor="middle"
                  fontFamily="Outfit,sans-serif" fontSize="8.5" fontWeight="700"
                  fill="#fff" letterSpacing=".3">{text}</text>
          </>
        );
      })()}

      {/* ── Pickup pin ── */}
      <g style={{
        transformOrigin: `${end.x}px ${end.y}px`,
        animation: 'trm-pinDrop .5s cubic-bezier(.34,1.2,.64,1) .3s both',
      }}>
        <ellipse cx={end.x} cy={end.y + 24} rx={6} ry={2.5} fill="rgba(34,197,94,.2)"/>
        <path
          d={`M${end.x},${end.y + 24}
              C${end.x},${end.y + 24} ${end.x - 13},${end.y + 9}
              ${end.x - 13},${end.y - 3}
              A13,13 0 1,1 ${end.x + 13},${end.y - 3}
              C${end.x + 13},${end.y + 9} ${end.x},${end.y + 24} Z`}
          fill="#22C55E"
        />
        <circle cx={end.x} cy={end.y - 4} r={5.5} fill="#fff"/>
        <circle cx={end.x} cy={end.y - 4} r={2}   fill="#22C55E"/>
      </g>

      {/* Pickup label */}
      {(() => {
        const text = (pickupLabel || 'Pickup').slice(0, 20);
        const lw   = Math.min(text.length * 5.8 + 20, 130);
        const lx   = Math.max(4, Math.min(end.x - lw / 2, SVG_W - lw - 4));
        const ly   = end.y > SVG_H - 50 ? end.y - 22 : end.y + 28;
        return (
          <>
            <rect x={lx} y={ly} width={lw} height={15} rx={7}
                  fill="#22C55E" opacity=".9"/>
            <text x={lx + lw/2} y={ly + 10.5} textAnchor="middle"
                  fontFamily="Outfit,sans-serif" fontSize="8.5" fontWeight="700"
                  fill="#fff" letterSpacing=".3">{text}</text>
          </>
        );
      })()}
    </svg>
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
  const [driverEta,      setDriverEta]      = useState(null);
  const [polyline,       setPolyline]       = useState(null);
  const [loadingGeo,     setLoadingGeo]     = useState(false);
  const [routeKey,       setRouteKey]       = useState(0);
  const prevTripId                          = useRef(null);

  useEffect(() => {
    if (!tripRequest || !driver) return;
    if (prevTripId.current === tripRequest.id) return;
    prevTripId.current = tripRequest.id;

    const fetchDriverDistance = async () => {
      setLoadingGeo(true);
      setPolyline(null);
      try {
        const res = await fetch(FN_URL, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driverLat: driver.lat,
            driverLng: driver.lng,
            pickupLat: tripRequest.pickupLat,
            pickupLng: tripRequest.pickupLng,
          }),
        });

        const data = await res.json();

        if (res.ok) {
          setDriverDistance(data.distanceText);
          setDriverEta(data.etaText);
          setPolyline(data.polyline ?? null);
          setRouteKey(k => k + 1);
        }
      } catch (err) {
        console.error('getDriverToPickup error:', err);
      } finally {
        setLoadingGeo(false);
      }
    };

    fetchDriverDistance();
  }, [tripRequest?.id]);

  const svgPts = useMemo(() => {
    return polyline ? project(decodePolyline(polyline)) : [];
  }, [polyline]);

  if (!tripRequest) return null;

  const fare     = `$${tripRequest.driverPayout?.toFixed(2) ?? '0.00'}`;
  const distance = loadingGeo ? '…' : (driverDistance ?? `${tripRequest.tripDistanceMiles?.toFixed(1) ?? '—'} mi`);
  const eta      = loadingGeo ? '…' : (driverEta      ?? `${tripRequest.tripDurationMin ?? '—'} min`);

  // First line of pickup address as label
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
      <style>{ROUTE_CSS}</style>

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

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div className="lbl" style={{ color: C.onlineGreen }}>Incoming Request</div>
            <div className="condensed" style={{ fontSize: 28, fontWeight: 900, color: C.text, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
              {tripRequest.rideLabel ?? 'Standard'}
            </div>
            <div style={{ marginTop: 6 }}>
              <span
                className="badge-chip"
                style={{
                  background: (TYPE_COLOR[tripRequest.rideType] ?? C.blue) + '18',
                  border:     `1px solid ${(TYPE_COLOR[tripRequest.rideType] ?? C.blue)}40`,
                  color:      TYPE_COLOR[tripRequest.rideType] ?? C.blue,
                  fontSize:   11,
                }}
              >
                {TYPE_LABEL[tripRequest.rideType] ?? tripRequest.rideType}
              </span>
            </div>
          </div>

          {/* Countdown ring */}
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

        {/* ── Route map ── */}
        <div className="trm-map-wrap">
          {loadingGeo ? (
            <div className="trm-skeleton"/>
          ) : (
            <RouteSVG
              svgPts={svgPts}
              routeKey={routeKey}
              driverLabel="You"
              pickupLabel={pickupLabel}
            />
          )}
          {!loadingGeo && (
            <div className="trm-map-pill trm-fadein">
              <div className="trm-map-pill-dot"/>
              {svgPts.length > 1 ? `${distance} · ${eta} to pickup` : 'Calculating route…'}
            </div>
          )}
        </div>

        {/* Fare + distance/ETA tiles */}
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
              { lbl: 'ETA',       val: eta },
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

        {/* Route pill */}
        <div className="route-pill" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, paddingTop: 2 }}>
              <div style={{ width: 9, height: 9, background: C.blue,        borderRadius: '50%', flexShrink: 0 }}/>
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

        {/* Action buttons */}
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
            onMouseEnter={e => { if (!actionPending) { e.currentTarget.style.borderColor = C.red;    e.currentTarget.style.color = C.red; } }}
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
            onMouseLeave={e => { if (!actionPending) { e.currentTarget.style.transform = '';               e.currentTarget.style.boxShadow = '0 4px 18px rgba(22,163,74,.3)'; } }}
            onClick={onAccept}
          >
            <Check size={18}/> {actionPending ? 'Processing…' : `Accept · ${fare}`}
          </button>
        </div>

      </div>
    </div>
  );
}