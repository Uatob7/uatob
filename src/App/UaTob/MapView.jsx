import React, { useMemo, useEffect, useRef, useState } from 'react';

// ── CSS ────────────────────────────────────────────────────────────────
const MAP_CSS = `
  @keyframes mv-dashFlow  { to { stroke-dashoffset: -40 } }
  @keyframes mv-pulseRing { 0%,100%{r:10;opacity:.22} 50%{r:15;opacity:.07} }
  @keyframes mv-pinDrop   {
    0%   { transform: translateY(-10px) scale(.85); opacity: 0; }
    65%  { transform: translateY(2px)   scale(1.06); opacity: 1; }
    100% { transform: translateY(0)     scale(1);    opacity: 1; }
  }
  @keyframes mv-routeDraw { from { stroke-dashoffset: var(--mv-len,1200) } to { stroke-dashoffset: 0 } }
  @keyframes mv-fadeUp    { from { opacity:0; transform:translateY(5px) } to { opacity:1; transform:translateY(0) } }

  .mv-flowing  { animation: mv-dashFlow  1.3s linear infinite; }
  .mv-pulse    { animation: mv-pulseRing 2.2s ease-in-out infinite; }
  .mv-route    { animation: mv-routeDraw 1s cubic-bezier(.4,0,.2,1) forwards; }
  .mv-fadeup   { animation: mv-fadeUp .4s ease-out both; }

  .mv-card {
    border-radius: 20px;
    overflow: hidden;
    border: 1.5px solid #E5E7EB;
    background: #fff;
    position: relative;
  }
  .mv-pill {
    position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 7px;
    background: #111827; color: #fff;
    border-radius: 100px; padding: 6px 14px 6px 10px;
    font-family: 'Outfit', system-ui, sans-serif;
    font-size: 12px; font-weight: 700; letter-spacing: .3px;
    white-space: nowrap;
    box-shadow: 0 4px 16px rgba(17,24,39,.24);
    pointer-events: none;
  }
  .mv-pill-dot { width: 7px; height: 7px; border-radius: 50%; background: #22C55E; flex-shrink: 0; }

  .mv-loc-row {
    display: flex; align-items: center; gap: 10px;
    padding: 11px 16px;
    border-top: 1.5px solid #E5E7EB;
  }
  .mv-connector { width: 1.5px; height: 12px; background: #E5E7EB; margin-left: 30px; }

  .mv-icon-wrap {
    width: 28px; height: 28px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .mv-icon-wrap.pickup  { background: #F0FDF4; border: 1.5px solid #BBF7D0; }
  .mv-icon-wrap.dropoff { background: #F9FAFB; border: 1.5px solid #E5E7EB; }

  .mv-loc-name { font-size: 13px; font-weight: 700; color: #111827;
                 white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mv-loc-sub  { font-size: 11px; font-weight: 500; color: #9CA3AF;
                 white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .mv-tier-badge {
    display: inline-flex; align-items: center;
    background: #F0FDF4; border: 1px solid #BBF7D0;
    border-radius: 100px; padding: 3px 10px;
    font-size: 10px; font-weight: 800; color: #16A34A;
    letter-spacing: .8px; text-transform: uppercase; flex-shrink: 0;
    font-family: 'Outfit', system-ui, sans-serif;
  }

  .mv-stats { display: flex; align-items: stretch; border-top: 1.5px solid #E5E7EB; }
  .mv-stat  { flex: 1; padding: 13px 16px; display: flex; flex-direction: column; gap: 3px; }
  .mv-stat + .mv-stat { border-left: 1.5px solid #E5E7EB; }
  .mv-stat-label { font-size: 10px; font-weight: 800; letter-spacing: 1.2px;
                   text-transform: uppercase; color: #9CA3AF; }
  .mv-stat-val   { font-size: 18px; font-weight: 900; color: #111827;
                   letter-spacing: -.5px; line-height: 1;
                   font-family: 'Outfit', system-ui, sans-serif; }
  .mv-stat-val.green { color: #16A34A; }
  .mv-stat-sub   { font-size: 11px; font-weight: 600; color: #6B7280; }
`;

// ── Google encoded polyline decoder ───────────────────────────────────
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

// ── Project lat/lng → SVG coords ──────────────────────────────────────
const SVG_W = 560, SVG_H = 218, PAD = 52;

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
    const dx = svgPts[i].x - svgPts[i - 1].x;
    const dy = svgPts[i].y - svgPts[i - 1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return Math.ceil(len) + 40;
}

// ── Helpers ────────────────────────────────────────────────────────────
function shortAddr(full = '') { return full.split(',')[0].trim(); }
function cityState(full = '') { return full.split(',').slice(1, 3).join(',').trim(); }

// ── Inline icons ──────────────────────────────────────────────────────
const PickupIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="4" fill="#16A34A"/>
    <circle cx="7" cy="7" r="6.5" stroke="#16A34A" strokeWidth="1" fill="none" opacity=".3"/>
  </svg>
);

const DropoffIcon = () => (
  <svg width="12" height="15" viewBox="0 0 10 13" fill="none">
    <path d="M5 0C2.239 0 0 2.239 0 5c0 3.75 5 8 5 8s5-4.25 5-8c0-2.761-2.239-5-5-5zm0 7a2 2 0 110-4 2 2 0 010 4z" fill="#111827"/>
  </svg>
);

// ── Label bubble helper ────────────────────────────────────────────────
function LabelBubble({ text, cx, cy, above = false }) {
  if (!text) return null;
  const lw = Math.min(text.length * 5.8 + 22, 160);
  const lx = Math.max(4, Math.min(cx - lw / 2, SVG_W - lw - 4));
  const ly = above ? cy - 22 : cy + 18;
  if (ly < 2 || ly + 16 > SVG_H - 2) return null;
  return (
    <>
      <rect x={lx} y={ly} width={lw} height={16} rx={8} fill="#111827" opacity=".82"/>
      <text x={lx + lw / 2} y={ly + 11.5} textAnchor="middle"
            fontFamily="Outfit,sans-serif" fontSize="9" fontWeight="700"
            fill="#fff" letterSpacing=".3">{text}</text>
    </>
  );
}

// ── Map SVG ────────────────────────────────────────────────────────────
function RouteSVG({ svgPts, routeKey, pickup, dropoff }) {
  const d       = toSVGPath(svgPts);
  const len     = svgPts.length > 1 ? approxPathLen(svgPts) : 600;
  const start   = svgPts[0]                  ?? { x: 80,  y: 170 };
  const end     = svgPts[svgPts.length - 1] ?? { x: 480, y: 60  };
  const hasPath = svgPts.length > 1;

  const pickupLabel  = shortAddr(pickup).slice(0, 22);
  const dropoffLabel = shortAddr(dropoff).slice(0, 22);

  // Decide label position: put pickup label below marker if there's room, above otherwise
  const pickupAbove  = start.y > SVG_H - 45;
  const dropoffAbove = end.y > SVG_H - 45;

  return (
    <svg
      key={routeKey}
      width="100%" height={SVG_H}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      style={{ display: 'block', background: '#F5F7F2' }}
    >
      <defs>
        <pattern id="mv-grid" width="36" height="36" patternUnits="userSpaceOnUse">
          <path d="M36 0L0 0 0 36" fill="none" stroke="#E8EDE8" strokeWidth=".8"/>
        </pattern>
        <linearGradient id="mv-rg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#22C55E"/>
          <stop offset="100%" stopColor="#111827"/>
        </linearGradient>
        <filter id="mv-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.8" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Base + grid */}
      <rect width={SVG_W} height={SVG_H} fill="#F5F7F2"/>
      <rect width={SVG_W} height={SVG_H} fill="url(#mv-grid)"/>

      {/* Contextual road stripes near midpoint */}
      {hasPath && (() => {
        const mx = (start.x + end.x) / 2;
        const my = (start.y + end.y) / 2;
        return (
          <>
            <rect x={0}      y={my - 11} width={SVG_W} height={22} fill="#ECEDE8" opacity=".65"/>
            <rect x={mx - 11} y={0}      width={22}    height={SVG_H} fill="#ECEDE8" opacity=".65"/>
            <line x1={0} y1={my} x2={SVG_W} y2={my} stroke="#D1D5CC" strokeWidth="1" strokeDasharray="10,8"/>
            <line x1={mx} y1={0} x2={mx}    y2={SVG_H} stroke="#D1D5CC" strokeWidth="1" strokeDasharray="10,8"/>
          </>
        );
      })()}

      {/* Route white halo */}
      {hasPath && (
        <path d={d} fill="none" stroke="#fff" strokeWidth="7"
              strokeLinecap="round" strokeLinejoin="round" opacity=".8"/>
      )}

      {/* Animated gradient route */}
      {hasPath && (
        <path
          className="mv-route"
          d={d}
          fill="none"
          stroke="url(#mv-rg)"
          strokeWidth="3.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#mv-glow)"
          style={{ '--mv-len': len, strokeDasharray: len }}
        />
      )}

      {/* Flowing dashes */}
      {hasPath && (
        <path
          className="mv-flowing"
          d={d}
          fill="none"
          stroke="#fff"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeDasharray="7,18"
          opacity=".6"
        />
      )}

      {/* ── Pickup marker ── */}
      <g style={{
        transformOrigin: `${start.x}px ${start.y}px`,
        animation: 'mv-pinDrop .55s cubic-bezier(.34,1.2,.64,1) .1s both'
      }}>
        <circle className="mv-pulse" cx={start.x} cy={start.y} fill="#22C55E"/>
        <circle cx={start.x} cy={start.y} r={13}  fill="#fff" stroke="#22C55E" strokeWidth="2.5"/>
        <circle cx={start.x} cy={start.y} r={6.5} fill="#22C55E"/>
        <circle cx={start.x} cy={start.y} r={2.5} fill="#fff"/>
      </g>
      <LabelBubble text={pickupLabel} cx={start.x} cy={start.y} above={pickupAbove}/>

      {/* ── Dropoff pin ── */}
      <g style={{
        transformOrigin: `${end.x}px ${end.y}px`,
        animation: 'mv-pinDrop .55s cubic-bezier(.34,1.2,.64,1) .3s both'
      }}>
        {/* shadow */}
        <ellipse cx={end.x} cy={end.y + 26} rx={7} ry={3} fill="rgba(17,24,39,.15)"/>
        {/* teardrop body */}
        <path
          d={`M${end.x},${end.y + 26}
              C${end.x},${end.y + 26} ${end.x - 14},${end.y + 10}
              ${end.x - 14},${end.y - 4}
              A14,14 0 1,1 ${end.x + 14},${end.y - 4}
              C${end.x + 14},${end.y + 10} ${end.x},${end.y + 26} Z`}
          fill="#111827"
        />
        <circle cx={end.x} cy={end.y - 5} r={6}   fill="#fff"/>
        <circle cx={end.x} cy={end.y - 5} r={2.5} fill="#111827"/>
      </g>
      <LabelBubble text={dropoffLabel} cx={end.x} cy={end.y + 30} above={dropoffAbove}/>
    </svg>
  );
}

// ── Main export ────────────────────────────────────────────────────────
export default function MapView({ bookingPayload }) {
  const [routeKey, setRouteKey] = useState(0);
  const prevRef                 = useRef(null);

  useEffect(() => {
    const curr = bookingPayload;
    if (!curr) { prevRef.current = null; return; }
    const prev = prevRef.current;
    const changed = !prev
      || prev.pickup   !== curr.pickup
      || prev.dropoff  !== curr.dropoff
      || prev.rideType !== curr.rideType
      || prev.polyline !== curr.polyline;
    if (changed) { setRouteKey(k => k + 1); prevRef.current = curr; }
  }, [bookingPayload]);

  const svgPts = useMemo(() => {
    const raw = bookingPayload?.polyline;
    return raw ? project(decodePolyline(raw)) : [];
  }, [bookingPayload?.polyline]);

  if (!bookingPayload) return null;

  const {
    pickup            = '',
    dropoff           = '',
    rideLabel         = '',
    fareEstimate      = null,
    miles             = null,
    tripDistanceMiles = null,
    durationMin       = null,
    durationText      = null,
  } = bookingPayload;

  const distMiles = miles ?? tripDistanceMiles;
  const distStr   = distMiles != null ? `${Number(distMiles).toFixed(1)} mi` : '—';
  const fareStr   = fareEstimate != null ? `$${Number(fareEstimate).toFixed(2)}` : '—';
  const etaStr    = durationText ?? (durationMin != null ? `${durationMin} min` : '—');
  const hasRoute  = !!(pickup && dropoff);

  return (
    <div style={{ fontFamily: "'Outfit', system-ui, sans-serif" }}>
      <style>{MAP_CSS}</style>

      <div className="mv-card">

        {/* Map area */}
        <div style={{ position: 'relative', height: SVG_H, overflow: 'hidden' }}>
          <RouteSVG
            svgPts={svgPts}
            routeKey={routeKey}
            pickup={pickup}
            dropoff={dropoff}
          />
          <div className="mv-pill mv-fadeup" key={routeKey} style={{ animationDelay: '.5s' }}>
            <div className="mv-pill-dot"/>
            {hasRoute ? 'Route calculated' : 'Set pickup & dropoff'}
          </div>
        </div>
  
       
      </div>
    </div>
  );
}