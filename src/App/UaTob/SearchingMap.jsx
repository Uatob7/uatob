import { useEffect, useRef, useState } from 'react';
import { Navigation } from 'lucide-react';

const MAPBOX_TOKEN = "pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA";
const MAP_STYLE = "mapbox://styles/mapbox/dark-v11";

/**
 * SearchingMap — Mapbox-based map for rider searching state
 * Shows pickup location and animated radar sweep overlay
 * 
 * Props:
 *   isUrgent      — boolean (when < 60s remaining)
 *   pickupLat     — number
 *   pickupLng     — number
 *   sweepAngle    — number (0-360) for radar animation
 */
export default function SearchingMap({ isUrgent, pickupLat, pickupLng, sweepAngle = 0 }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  // Default to Orlando if no coords provided
  const centerLat = pickupLat ?? 28.5383;
  const centerLng = pickupLng ?? -81.3792;

  const accent = isUrgent ? "#EF4444" : "#22C55E";
  const accent2 = isUrgent ? "#F59E0B" : "#22C55E";
  const ringRGB = isUrgent ? "239,68,68" : "22,163,74";

  // ── Init Mapbox ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;

    const script = document.createElement('script');
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
    script.async = true;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';

    document.head.appendChild(link);
    document.head.appendChild(script);

    script.onload = () => {
      if (!mapContainerRef.current) return;
      const mapboxgl = window.mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: MAP_STYLE,
        center: [centerLng, centerLat],
        zoom: 14,
        pitch: 35,
        bearing: -25,
        interactive: false,
        attributionControl: false,
      });

      map.on('load', () => {
        mapRef.current = map;
        setMapReady(true);

        let bearing = -25;
        const drift = setInterval(() => {
          bearing += 0.05;
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
  }, []);

  // ── Update map center if coordinates change ────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [centerLng, centerLat],
      zoom: 14,
      duration: 800,
    });
  }, [centerLat, centerLng, mapReady]);

  // ── Radar geometry ────────────────────────────────────────────────────────
  const toRad = deg => (deg * Math.PI) / 180;
  const R = 55;
  const trailAngle = sweepAngle;
  const leadAngle = (sweepAngle + 72) % 360;
  const trailX = 50 + R * Math.cos(toRad(trailAngle));
  const trailY = 50 + R * Math.sin(toRad(trailAngle));
  const leadX = 50 + R * Math.cos(toRad(leadAngle));
  const leadY = 50 + R * Math.sin(toRad(leadAngle));
  const tipX = 50 + 52 * Math.cos(toRad(leadAngle));
  const tipY = 50 + 52 * Math.sin(toRad(leadAngle));

  return (
    <div style={{
      position: "relative",
      height: 280,
      borderRadius: 20,
      overflow: "hidden",
      boxShadow: "0 20px 60px rgba(0,0,0,.35), 0 0 0 1px rgba(34,197,94,0.15)",
      marginBottom: "18px",
    }}>
      <div ref={mapContainerRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />

      {/* Radar overlay with animated sweep */}
      {mapReady && (
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            <radialGradient id="sweepGradSearching" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={accent} stopOpacity="0" />
              <stop offset="40%" stopColor={accent} stopOpacity="0.25" />
              <stop offset="100%" stopColor={accent2} stopOpacity="0.75" />
            </radialGradient>

            <radialGradient id="radarDiscSearching" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={accent} stopOpacity="0.10" />
              <stop offset="60%" stopColor={accent} stopOpacity="0.04" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Disc background */}
          <circle cx="50" cy="50" r="47" fill="url(#radarDiscSearching)" />

          {/* Concentric grid rings */}
          {[15, 27, 40].map((r) => (
            <circle
              key={r}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={`rgba(${ringRGB},.18)`}
              strokeWidth="0.6"
              strokeDasharray="2 3"
            />
          ))}

          {/* Cross hairs */}
          <line x1="50" y1="2" x2="50" y2="98" stroke={`rgba(${ringRGB},.12)`} strokeWidth="0.5" />
          <line x1="2" y1="50" x2="98" y2="50" stroke={`rgba(${ringRGB},.12)`} strokeWidth="0.5" />

          {/* Sweep wedge */}
          <path
            d={`M 50 50 L ${trailX} ${trailY} A ${R} ${R} 0 0 1 ${leadX} ${leadY} Z`}
            fill="url(#sweepGradSearching)"
            opacity="0.85"
          />

          {/* Leading beam line */}
          <line
            x1="50"
            y1="50"
            x2={leadX}
            y2={leadY}
            stroke={accent}
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.95"
          />

          {/* Tip flare */}
          <circle cx={tipX} cy={tipY} r="2.6" fill={accent2} opacity="0.95" />
          <circle cx={tipX} cy={tipY} r="5" fill={accent} opacity="0.20" />

          {/* Outer border ring */}
          <circle cx="50" cy="50" r="47" fill="none" stroke={`rgba(${ringRGB},.5)`} strokeWidth="1.5" />
        </svg>
      )}

      {/* Center "pickup location" pin */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${accent2}, ${accent})`,
          border: "3px solid #fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 4px 14px rgba(${ringRGB},.45)`,
          animation: "searchingCenterPulse 2s ease-in-out infinite",
          zIndex: 3,
        }}
      >
        <Navigation size={18} color="#fff" strokeWidth={2.4} style={{ marginTop: -1 }} />
      </div>

      <style>{`
        @keyframes searchingCenterPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 4px 14px rgba(${ringRGB},.45); }
          50%      { transform: translate(-50%, -50%) scale(1.08); box-shadow: 0 8px 24px rgba(${ringRGB},.65); }
        }
        @keyframes radarExpand {
          0%   { transform: scale(.5);  opacity: .85; }
          100% { transform: scale(2.2); opacity: 0;   }
        }
      `}</style>
    </div>
  );
}
