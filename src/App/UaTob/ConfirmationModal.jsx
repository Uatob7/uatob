/**
 * SearchingMapPanel.jsx
 *
 * Drop-in replacement for the `status === 'searching'` block inside
 * ConfirmationModal. Renders a live Mapbox map centred on the rider's
 * pickup pin, sweeps a radar beam, and places animated car markers for
 * every candidate driver fetched in real-time from Firestore.
 *
 * Props
 * ──────
 *  pickupLat        number   – pickup latitude  (required)
 *  pickupLng        number   – pickup longitude (required)
 *  candidateDriverUids  string[]  – from ride doc  (default [])
 *  secondsLeft      number
 *  isUrgent         boolean
 *  progress         number   – 0-100 (elapsed fraction of search window)
 *  pickup           string   – display label
 *  dropoff          string   – display label
 *  rideLabel        string
 *  miles            string
 *  total            string
 *  createdAtLabel   string | null
 *  riderUid         string | null
 *  shouldShowPhoneCapture  boolean
 *  onSkipPhone      fn
 *  onPhoneSaved     fn
 *  onCancel         fn  – async, shows spinner internally
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { X, Navigation, Car, Clock, MapPin, ChevronDown } from 'lucide-react';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

// ── re-use the PhoneCaptureCard already in ConfirmationModal ──────────────
// (import it from there; we just declare the panel here)
import PhoneCaptureCard from './ConfirmationModal'; // adjust if extracted

const db = getFirestore(firebase_app);

const MAPBOX_TOKEN =
  'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';

// ── tiny haversine for ETA badge ──────────────────────────────────────────
function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8, r = (d) => (d * Math.PI) / 180;
  const dLat = r(lat2 - lat1), dLng = r(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Radar SVG overlay (sits on top of Mapbox, pointer-events:none) ────────
function RadarOverlay({ sweepAngle, isUrgent, hasDrivers }) {
  const accent  = isUrgent ? '#EF4444' : '#22C55E';
  const accent2 = isUrgent ? '#F97316' : '#4ADE80';
  const r2d     = (d) => (d * Math.PI) / 180;
  const R = 46; // % of viewBox

  const trail = sweepAngle;
  const lead  = (sweepAngle + 65) % 360;

  const tx = 50 + R * Math.cos(r2d(trail));
  const ty = 50 + R * Math.sin(r2d(trail));
  const lx = 50 + R * Math.cos(r2d(lead));
  const ly = 50 + R * Math.sin(r2d(lead));
  const tipX = 50 + (R + 2) * Math.cos(r2d(lead));
  const tipY = 50 + (R + 2) * Math.sin(r2d(lead));

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 10,
      }}
    >
      <defs>
        <radialGradient id="rmVig" cx="50%" cy="50%" r="60%">
          <stop offset="20%" stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.72)" />
        </radialGradient>
        <radialGradient id="rmSweep" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={accent}  stopOpacity="0" />
          <stop offset="45%"  stopColor={accent}  stopOpacity="0.22" />
          <stop offset="100%" stopColor={accent2} stopOpacity="0.72" />
        </radialGradient>
      </defs>

      {/* vignette */}
      <rect width="100" height="100" fill="url(#rmVig)" />

      {/* concentric dashed rings */}
      {[14, 24, 34, 44].map((r, i) => (
        <circle
          key={i} cx="50" cy="50" r={r}
          fill="none"
          stroke={`rgba(${isUrgent ? '239,68,68' : '34,197,94'},${hasDrivers ? 0.09 : 0.14})`}
          strokeWidth="0.3"
          strokeDasharray="1.1 2"
        />
      ))}

      {/* sweep wedge */}
      <path
        d={`M 50 50 L ${tx} ${ty} A ${R} ${R} 0 0 1 ${lx} ${ly} Z`}
        fill="url(#rmSweep)"
        opacity="0.82"
      />

      {/* leading beam */}
      <line
        x1="50" y1="50" x2={lx} y2={ly}
        stroke={accent} strokeWidth="0.5"
        strokeLinecap="round" opacity="0.9"
      />

      {/* tip flare */}
      <circle cx={tipX} cy={tipY} r="1.1" fill={accent2} opacity="0.95" />
      <circle cx={tipX} cy={tipY} r="2.2" fill={accent}  opacity="0.22" />

      {/* crosshair */}
      <line x1="48.5" y1="50" x2="51.5" y2="50" stroke={`rgba(${isUrgent?'239,68,68':'34,197,94'},.4)`} strokeWidth="0.25"/>
      <line x1="50" y1="48.5" x2="50" y2="51.5" stroke={`rgba(${isUrgent?'239,68,68':'34,197,94'},.4)`} strokeWidth="0.25"/>
    </svg>
  );
}

// ── Live driver dot (HTML marker element factory) ─────────────────────────
function makeDriverEl(distMi, isUrgent) {
  const accent = isUrgent ? '#EF4444' : '#22C55E';
  const shadow = isUrgent ? '239,68,68' : '34,197,94';
  const eta    = distMi < 1 ? '< 1 mi' : `${distMi.toFixed(1)} mi`;
  const el     = document.createElement('div');
  el.style.cssText = 'pointer-events:none;';
  el.innerHTML = `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;">
      <div style="
        position:absolute;inset:-6px;border-radius:50%;
        background:radial-gradient(circle,rgba(${shadow},.3) 0%,transparent 70%);
        animation:driverAura 2s ease-in-out infinite;
      "></div>
      <div style="
        width:30px;height:30px;border-radius:50%;
        background:linear-gradient(145deg,#1a1a2e,#16213e);
        border:2px solid ${accent};
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 0 0 3px rgba(${shadow},.18),0 4px 12px rgba(0,0,0,.5);
        position:relative;z-index:1;
      ">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="${accent}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v6a2 2 0 0 1-2 2h-2"/>
          <circle cx="9" cy="20" r="2"/><circle cx="19" cy="20" r="2"/>
          <path d="M17 17H9"/>
        </svg>
      </div>
      <div style="
        background:rgba(0,0,0,.75);backdrop-filter:blur(6px);
        border:1px solid rgba(${shadow},.4);
        border-radius:5px;padding:2px 6px;
        font-size:9px;font-weight:700;color:${accent};
        letter-spacing:.03em;white-space:nowrap;
        font-family:monospace;
      ">${eta}</div>
    </div>
    <style>
      @keyframes driverAura{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.3);opacity:1}}
    </style>
  `;
  return el;
}

// ══════════════════════════════════════════════════════════════════════════
export function SearchingMapPanel({
  pickupLat,
  pickupLng,
  candidateDriverUids = [],
  secondsLeft,
  isUrgent,
  progress,
  pickup,
  dropoff,
  rideLabel,
  miles,
  total,
  createdAtLabel,
  riderUid,
  shouldShowPhoneCapture,
  onSkipPhone,
  onPhoneSaved,
  onCancel,
}) {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const markersRef      = useRef([]);
  const pickupMarkerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [sweepAngle, setSweepAngle]     = useState(0);
  const [driverDocs, setDriverDocs]     = useState({});   // uid → {lat,lng,name,...}
  const [cancelLoading, setCancelLoading] = useState(false);
  const [infoOpen, setInfoOpen]         = useState(false);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  // ── Radar sweep via rAF ─────────────────────────────────────────────────
  useEffect(() => {
    let raf, last = performance.now(), angle = 0;
    const tick = (now) => {
      angle = (angle + (now - last) * 0.075) % 360;
      last  = now;
      setSweepAngle(angle);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Subscribe to each candidateDriver doc ──────────────────────────────
  useEffect(() => {
    if (!candidateDriverUids.length) { setDriverDocs({}); return; }
    const unsubs = candidateDriverUids.map((uid) =>
      onSnapshot(doc(db, 'Drivers', uid), (snap) => {
        if (!snap.exists()) return;
        setDriverDocs((prev) => ({ ...prev, [uid]: { uid, ...snap.data() } }));
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [candidateDriverUids.join(',')]);

  // ── Init Mapbox ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !pickupLat || !pickupLng) return;

    const link   = Object.assign(document.createElement('link'), {
      rel: 'stylesheet',
      href: 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css',
    });
    const script = Object.assign(document.createElement('script'), {
      src: 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js',
      async: true,
    });
    document.head.append(link, script);

    script.onload = () => {
      if (!mapContainerRef.current) return;
      const mapboxgl          = window.mapboxgl;
      mapboxgl.accessToken    = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container:         mapContainerRef.current,
        style:             'mapbox://styles/mapbox/dark-v11',
        center:            [pickupLng, pickupLat],
        zoom:              13.5,
        pitch:             50,
        bearing:           -12,
        interactive:       false,
        attributionControl: false,
      });

      map.on('load', () => {
        mapRef.current = map;

        // ── pickup pin ──────────────────────────────────────────────────
        const pinEl = document.createElement('div');
        pinEl.innerHTML = `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
            <div style="
              position:absolute;inset:-8px;border-radius:50%;
              background:radial-gradient(circle,rgba(255,255,255,.22) 0%,transparent 65%);
              animation:pickupGlow 2.2s ease-in-out infinite;
            "></div>
            <div style="
              width:36px;height:36px;border-radius:50%;
              background:linear-gradient(145deg,#fff,#E0F2FE);
              border:2.5px solid #0EA5E9;
              display:flex;align-items:center;justify-content:center;
              box-shadow:0 0 0 5px rgba(14,165,233,.2),0 6px 20px rgba(0,0,0,.55);
              position:relative;z-index:2;
            ">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#0EA5E9"
                stroke="#0EA5E9" stroke-width="1.5">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5" fill="#fff"/>
              </svg>
            </div>
            <div style="
              width:2px;height:10px;background:linear-gradient(#0EA5E9,transparent);
              margin-top:-1px;
            "></div>
          </div>
          <style>
            @keyframes pickupGlow{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.25);opacity:1}}
          </style>
        `;
        pickupMarkerRef.current = new mapboxgl.Marker({ element: pinEl, anchor: 'bottom' })
          .setLngLat([pickupLng, pickupLat])
          .addTo(map);

        // ── slow cinematic drift ────────────────────────────────────────
        let bearing = -12;
        const drift = setInterval(() => {
          bearing += 0.04;
          map.setBearing(bearing);
        }, 80);
        map.on('remove', () => clearInterval(drift));

        setMapReady(true);
      });
    };

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapReady(false);
      }
    };
  }, [pickupLat, pickupLng]);

  // ── Place/update driver markers whenever driverDocs or map changes ──────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const mapboxgl = window.mapboxgl;
    const map      = mapRef.current;

    // clear old
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const drivers = Object.values(driverDocs).filter(
      (d) => typeof d.lat === 'number' && typeof d.lng === 'number'
    );

    drivers.forEach((d) => {
      const dist = haversineMiles(pickupLat, pickupLng, d.lat, d.lng);
      const el   = makeDriverEl(dist, isUrgent);
      const m    = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([d.lng, d.lat])
        .addTo(map);
      markersRef.current.push(m);
    });

    // fit bounds to include pickup + all drivers
    if (drivers.length) {
      const bounds = new mapboxgl.LngLatBounds([pickupLng, pickupLat], [pickupLng, pickupLat]);
      drivers.forEach((d) => bounds.extend([d.lng, d.lat]));
      map.fitBounds(bounds, {
        padding: { top: 80, bottom: 80, left: 50, right: 50 },
        maxZoom: 14,
        duration: 1400,
        pitch: 50,
      });
    }
  }, [mapReady, driverDocs, isUrgent, pickupLat, pickupLng]);

  const driverCount = Object.keys(driverDocs).length;

  const handleCancel = async () => {
    setCancelLoading(true);
    try { await onCancel?.(); } finally { setCancelLoading(false); }
  };

  // ────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Sora:wght@400;600;700;800;900&display=swap');

        .rm-root * { box-sizing: border-box; }

        /* progress bar at very top */
        .rm-prog-track {
          height: 3px;
          background: rgba(255,255,255,.06);
          overflow: hidden;
        }
        .rm-prog-fill {
          height: 100%;
          border-radius: 0 2px 2px 0;
          transition: width 1s linear;
        }

        /* map shell */
        .rm-map-shell {
          position: relative;
          height: 230px;
          overflow: hidden;
          background: #0a0f1a;
        }

        /* HUD chips */
        .rm-chip {
          display: inline-flex; align-items: center; gap: 5px;
          background: rgba(0,0,0,.65); backdrop-filter: blur(14px);
          border-radius: 100px; padding: 5px 11px;
          font-family: 'Space Mono', monospace;
          font-size: 9.5px; font-weight: 700;
          letter-spacing: .08em; text-transform: uppercase;
        }

        /* info drawer */
        .rm-drawer {
          background: #0d1117;
          color: #e5e7eb;
          font-family: 'Sora', sans-serif;
        }

        /* timer digits */
        .rm-timer {
          font-family: 'Space Mono', monospace;
          font-size: 52px;
          font-weight: 700;
          letter-spacing: -4px;
          line-height: 1;
        }

        /* cancel btn */
        .rm-cancel-btn {
          border: none; cursor: pointer;
          font-family: 'Sora', sans-serif;
          font-weight: 700; font-size: 13px;
          transition: opacity .15s, transform .15s;
        }
        .rm-cancel-btn:hover:not(:disabled) { opacity: .8; transform: translateY(-1px); }
        .rm-cancel-btn:active:not(:disabled) { transform: translateY(0); }

        /* live dot */
        @keyframes liveBlink {
          0%,100%{opacity:1;box-shadow:0 0 6px rgba(34,197,94,.8)}
          50%{opacity:.4;box-shadow:0 0 2px rgba(34,197,94,.3)}
        }
        @keyframes rmDriverIn {
          from{opacity:0;transform:scale(.3)}
          to{opacity:1;transform:scale(1)}
        }
        @keyframes rmSpin { to{transform:rotate(360deg)} }
      `}</style>

      <div className="rm-root" style={{ borderRadius: 'inherit', overflow: 'hidden' }}>

        {/* ── top progress bar ─────────────────────────────────────────── */}
        {progress > 0 && (
          <div className="rm-prog-track">
            <div
              className="rm-prog-fill"
              style={{
                width: `${100 - progress}%`,
                background: isUrgent
                  ? 'linear-gradient(90deg,#F97316,#EF4444)'
                  : 'linear-gradient(90deg,#22C55E,#16A34A)',
              }}
            />
          </div>
        )}

        {/* ── MAP SHELL ────────────────────────────────────────────────── */}
        <div className="rm-map-shell">

          {/* mapbox canvas */}
          <div
            ref={mapContainerRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          />

          {/* radar sweep overlay */}
          {mapReady && (
            <RadarOverlay
              sweepAngle={sweepAngle}
              isUrgent={isUrgent}
              hasDrivers={driverCount > 0}
            />
          )}

          {/* loading skeleton */}
          {!mapReady && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg,#080d14,#0d1624)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                border: '2.5px solid rgba(34,197,94,.1)',
                borderTop: '2.5px solid #22C55E',
                animation: 'rmSpin .9s linear infinite',
              }}/>
              <span style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 10, fontWeight: 700,
                color: 'rgba(255,255,255,.3)',
                letterSpacing: '.1em', textTransform: 'uppercase',
              }}>
                Locating…
              </span>
            </div>
          )}

          {/* ── top HUD ──────────────────────────────────────────────── */}
          <div style={{
            position: 'absolute', top: 10, left: 10, right: 10,
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-start', zIndex: 20, pointerEvents: 'none',
          }}>
            {/* LIVE chip */}
            <div className="rm-chip" style={{
              border: `1px solid rgba(${isUrgent?'239,68,68':'34,197,94'},.35)`,
              color: isUrgent ? '#FCA5A5' : '#86EFAC',
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: isUrgent ? '#EF4444' : '#22C55E',
                animation: 'liveBlink 1.4s ease-in-out infinite',
              }}/>
              {isUrgent ? 'Urgent' : 'Scanning'}
            </div>

            {/* driver count chip */}
            {driverCount > 0 && (
              <div className="rm-chip" style={{
                border: '1px solid rgba(255,255,255,.12)',
                color: 'rgba(255,255,255,.8)',
                gap: 6,
              }}>
                <Car size={9} strokeWidth={2.5}/>
                {driverCount} driver{driverCount > 1 ? 's' : ''} nearby
              </div>
            )}
          </div>

          {/* ── timer pill (bottom-center of map) ────────────────────── */}
          <div style={{
            position: 'absolute', bottom: 12,
            left: '50%', transform: 'translateX(-50%)',
            zIndex: 20, textAlign: 'center',
          }}>
            <div style={{
              background: isUrgent
                ? 'rgba(127,29,29,.85)'
                : 'rgba(5,46,22,.85)',
              backdropFilter: 'blur(16px)',
              border: `1px solid rgba(${isUrgent?'239,68,68':'34,197,94'},.4)`,
              borderRadius: 14,
              padding: '8px 20px 6px',
              boxShadow: '0 8px 32px rgba(0,0,0,.4)',
            }}>
              <div style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 9, fontWeight: 700,
                letterSpacing: '.14em', textTransform: 'uppercase',
                color: isUrgent ? '#FCA5A5' : '#86EFAC',
                marginBottom: 2,
              }}>
                Time remaining
              </div>
              <div style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 34, fontWeight: 700,
                letterSpacing: '-2px', lineHeight: 1,
                color: isUrgent ? '#FCA5A5' : '#4ADE80',
              }}>
                {String(minutes).padStart(2, '0')}
                <span style={{ opacity: .4, fontSize: 18, letterSpacing: 0, margin: '0 1px' }}>:</span>
                {String(seconds).padStart(2, '0')}
              </div>
            </div>
          </div>
        </div>

        {/* ── DRAWER ──────────────────────────────────────────────────── */}
        <div className="rm-drawer" style={{ padding: '18px 18px 20px' }}>

          {/* heading */}
          <div style={{
            display: 'flex', alignItems: 'flex-start',
            justifyContent: 'space-between', marginBottom: 14,
          }}>
            <div>
              <div style={{
                fontFamily: "'Sora', sans-serif",
                fontSize: 17, fontWeight: 900,
                color: '#f1f5f9', letterSpacing: '-0.3px',
              }}>
                {isUrgent ? 'Almost out of time…' : 'Finding your driver'}
              </div>
              <div style={{
                fontFamily: "'Sora', sans-serif",
                fontSize: 11.5, fontWeight: 500,
                color: 'rgba(255,255,255,.38)', marginTop: 3,
              }}>
                {driverCount > 0
                  ? `${driverCount} driver${driverCount > 1 ? 's' : ''} detected in your area`
                  : 'Scanning Orlando for available drivers'}
              </div>
            </div>

            {/* driver count badge */}
            {driverCount > 0 && (
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: isUrgent
                  ? 'linear-gradient(135deg,#7F1D1D,#991B1B)'
                  : 'linear-gradient(135deg,#052E16,#166534)',
                border: `1px solid rgba(${isUrgent?'239,68,68':'34,197,94'},.35)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Space Mono', monospace",
                fontSize: 15, fontWeight: 700,
                color: isUrgent ? '#FCA5A5' : '#4ADE80',
              }}>
                {driverCount}
              </div>
            )}
          </div>

          {/* route card */}
          <div style={{
            background: 'rgba(255,255,255,.04)',
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 14, padding: '12px 14px',
            marginBottom: 10,
          }}>
            {/* pickup */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 9 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(14,165,233,.15)',
                border: '1.5px solid rgba(14,165,233,.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0EA5E9' }}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: '.1em',
                  textTransform: 'uppercase', color: 'rgba(255,255,255,.3)',
                  marginBottom: 2,
                }}>Pickup</div>
                <div style={{
                  fontSize: 12.5, fontWeight: 700, color: '#e2e8f0',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{pickup}</div>
              </div>
            </div>

            {/* connector line */}
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ width: 22, display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 1.5, height: 16, background: 'rgba(255,255,255,.1)' }}/>
              </div>
            </div>

            {/* dropoff */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 7 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                background: 'rgba(34,197,94,.12)',
                border: '1.5px solid rgba(34,197,94,.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: 2, background: '#22C55E', transform: 'rotate(45deg)' }}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: '.1em',
                  textTransform: 'uppercase', color: 'rgba(255,255,255,.3)',
                  marginBottom: 2,
                }}>Dropoff</div>
                <div style={{
                  fontSize: 12.5, fontWeight: 700, color: '#e2e8f0',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{dropoff}</div>
              </div>
            </div>
          </div>

          {/* fare row */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'rgba(34,197,94,.07)',
            border: '1px solid rgba(34,197,94,.18)',
            borderRadius: 10, padding: '9px 13px',
            marginBottom: shouldShowPhoneCapture ? 0 : 4,
          }}>
            <span style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: 12, fontWeight: 600,
              color: 'rgba(255,255,255,.45)',
            }}>
              {rideLabel} · {miles} mi
            </span>
            <span style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 16, fontWeight: 700,
              color: '#4ADE80',
            }}>
              ${total}
            </span>
          </div>

          {/* phone capture (light card on dark bg — keep existing component) */}
          {shouldShowPhoneCapture && (
            <div style={{ marginTop: 10 }}>
              <PhoneCaptureCard
                uid={riderUid}
                onSkip={onSkipPhone}
                onSaved={onPhoneSaved}
              />
            </div>
          )}

          {/* cancel */}
          <button
            className="rm-cancel-btn"
            onClick={handleCancel}
            disabled={cancelLoading}
            style={{
              marginTop: 14, width: '100%',
              padding: '12px 0', borderRadius: 12,
              background: 'rgba(255,255,255,.05)',
              border: '1px solid rgba(255,255,255,.1)',
              color: 'rgba(255,255,255,.4)',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 7,
              opacity: cancelLoading ? 0.5 : 1,
            }}
          >
            {cancelLoading
              ? <><div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,.2)', borderTop: '2px solid rgba(255,255,255,.6)', animation: 'rmSpin 1s linear infinite' }}/> Cancelling…</>
              : 'Cancel this ride'
            }
          </button>

          {createdAtLabel && (
            <div style={{
              marginTop: 10, textAlign: 'center',
              fontFamily: "'Space Mono', monospace",
              fontSize: 9, color: 'rgba(255,255,255,.18)',
              letterSpacing: '.06em',
            }}>
              Booked {createdAtLabel}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default SearchingMapPanel;
