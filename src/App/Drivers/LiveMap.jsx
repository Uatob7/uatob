import { useEffect, useRef, useState, useMemo } from 'react';
import { Users, Activity, Wifi, MapPin, DollarSign, X, Calendar, Clock, Navigation, ChevronRight, Zap } from 'lucide-react';

const MAPBOX_TOKEN = "pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA";
const MAP_STYLE    = "mapbox://styles/mapbox/dark-v11";

// ── Tunables ──────────────────────────────────────────────────────────────────
const MAX_SEARCH_AGE_MS = 10 * 60 * 1000;
const MAX_RADIUS_MILES  = 15;
const MAX_VISIBLE       = 12;

// ── Helpers ───────────────────────────────────────────────────────────────────
function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function timeAgo(ts) {
  if (!ts) return "";
  const ms = ts?.toMillis ? ts.toMillis() : (ts?.seconds ? ts.seconds * 1000 : Number(ts));
  const diffSec = Math.floor((Date.now() - ms) / 1000);
  if (diffSec < 30)   return "just now";
  if (diffSec < 60)   return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return `${Math.floor(diffSec / 3600)}h ago`;
}

function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  return 0;
}

function fmtScheduledTime(ts) {
  if (!ts) return null;
  const ms = tsToMillis(ts);
  if (!ms) return null;
  const d   = new Date(ms);
  const now = Date.now();
  const diffMs = ms - now;
  const diffH  = diffMs / 3600000;
  if (diffH < 0) return null;
  if (diffH < 24) return d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

function fmtCountdown(ts) {
  if (!ts) return null;
  const ms   = tsToMillis(ts);
  const diff = ms - Date.now();
  if (diff <= 0) return 'Now';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return 'Soon';
}

function parseCity(ride) {
  return ride.pickupCity
    || (ride.pickup ? ride.pickup.split(',').slice(-2, -1)[0]?.trim() : null)
    || 'Nearby';
}

// ── Scheduled Rides Drawer ────────────────────────────────────────────────────
function ScheduledDrawer({ rides, onClose }) {
  const upcoming = useMemo(() =>
    [...(rides || [])]
      .filter(r => {
        const st = r.scheduledAt || r.createdAt;
        if (!st) return false;
        return tsToMillis(st) > Date.now() - 3600000;
      })
      .sort((a, b) => tsToMillis(a.scheduledAt || a.createdAt) - tsToMillis(b.scheduledAt || b.createdAt)),
    [rides]
  );

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 40,
      background: 'rgba(4,10,6,0.96)', backdropFilter: 'blur(24px)',
      borderRadius: 20, display: 'flex', flexDirection: 'column',
      animation: 'drawerIn .35s cubic-bezier(.34,1.1,.64,1)',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 12px',
        borderBottom: '1px solid rgba(129,140,248,.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: 'linear-gradient(135deg,#818CF8,#4F46E5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(129,140,248,.35)',
          }}>
            <Calendar size={14} color="#fff" strokeWidth={2.4}/>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '-0.2px' }}>
              Scheduled Rides
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(165,180,252,.7)', letterSpacing: '.06em' }}>
              {upcoming.length} upcoming
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 8, width: 28, height: 28, display: 'flex',
          alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,.6)',
        }}>
          <X size={13}/>
        </button>
      </div>

      {/* Ride list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px 14px' }}>
        {upcoming.length === 0 ? (
          <div style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Calendar size={28} color="rgba(129,140,248,.3)" strokeWidth={1.5}/>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', fontWeight: 600 }}>No upcoming rides</span>
          </div>
        ) : upcoming.map((ride, i) => {
          const ts        = ride.scheduledAt || ride.createdAt;
          const timeLabel = fmtScheduledTime(ts);
          const countdown = fmtCountdown(ts);
          const city      = parseCity(ride);
          const fare      = ride.fareBreakdown?.fareTotal ?? ride.fareTotal ?? null;
          const payout    = ride.driverPayout ?? null;
          const miles     = ride.tripDistanceMiles ?? null;

          return (
            <div key={ride.id || i} style={{
              background: 'rgba(129,140,248,.07)',
              border: '1px solid rgba(129,140,248,.18)',
              borderRadius: 13, padding: '11px 12px',
              marginBottom: i < upcoming.length - 1 ? 8 : 0,
              animation: `rideRowIn .3s cubic-bezier(.34,1.1,.64,1) ${i * 0.06}s both`,
            }}>
              {/* Time row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={10} color='rgba(165,180,252,.7)' strokeWidth={2.2}/>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(165,180,252,.9)' }}>
                    {timeLabel ?? '—'}
                  </span>
                </div>
                {countdown && (
                  <span style={{
                    fontSize: 10, fontWeight: 800, color: '#818CF8',
                    background: 'rgba(129,140,248,.15)',
                    border: '1px solid rgba(129,140,248,.25)',
                    padding: '2px 7px', borderRadius: 99,
                    fontFamily: 'monospace',
                  }}>
                    {countdown}
                  </span>
                )}
              </div>

              {/* Route */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 4 }}>
                <MapPin size={10} color='#818CF8' strokeWidth={2.4} style={{ marginTop: 2, flexShrink: 0 }}/>
                <span style={{
                  fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,.85)',
                  lineHeight: 1.3,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {ride.pickup ?? city}
                </span>
              </div>
              {ride.dropoff && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 7 }}>
                  <Navigation size={10} color='rgba(165,180,252,.5)' strokeWidth={2.2} style={{ marginTop: 2, flexShrink: 0 }}/>
                  <span style={{
                    fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.45)',
                    lineHeight: 1.3,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {ride.dropoff}
                  </span>
                </div>
              )}

              {/* Stats row */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                paddingTop: 7, borderTop: '1px solid rgba(255,255,255,.06)',
                fontSize: 10.5, fontWeight: 700,
              }}>
                {miles != null && (
                  <span style={{ color: 'rgba(255,255,255,.4)' }}>{Number(miles).toFixed(1)} mi</span>
                )}
                {payout != null && (
                  <>
                    {miles != null && <span style={{ color: 'rgba(255,255,255,.15)' }}>·</span>}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3, color: '#4ADE80',
                      fontFamily: 'monospace',
                    }}>
                      <Zap size={9} fill="#4ADE80" strokeWidth={0}/>
                      ${Number(payout).toFixed(2)} payout
                    </span>
                  </>
                )}
                {fare != null && payout == null && (
                  <span style={{ color: 'rgba(165,180,252,.7)', fontFamily: 'monospace' }}>
                    ${Number(fare).toFixed(2)}
                  </span>
                )}
                <div style={{ flex: 1 }}/>
                {ride.rideType && (
                  <span style={{
                    fontSize: 9.5, fontWeight: 800, letterSpacing: '.08em',
                    textTransform: 'uppercase', color: 'rgba(129,140,248,.6)',
                  }}>
                    {ride.rideType}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function LiveMap({ online, driver, searches = [], scheduledRides = [], activeTrip }) {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const markersRef      = useRef([]);
  const [mapReady,     setMapReady]     = useState(false);
  const [sweepAngle,   setSweepAngle]   = useState(0);
  const [selected,     setSelected]     = useState(null);
  const [showScheduled, setShowScheduled] = useState(false);

  // ── Filter searches ───────────────────────────────────────────────────────
  const visibleSearches = useMemo(() => {
    if (!driver?.lat || !driver?.lng) return [];
    const now = Date.now();
    return searches
      .filter(s => {
        if (typeof s.pickupLat !== "number" || typeof s.pickupLng !== "number") return false;
        const ageMs = now - (s.createdAt?.toMillis?.() ?? 0);
        if (ageMs > MAX_SEARCH_AGE_MS) return false;
        const dist = haversineMiles(driver.lat, driver.lng, s.pickupLat, s.pickupLng);
        if (dist > MAX_RADIUS_MILES) return false;
        return true;
      })
      .map(s => ({
        ...s,
        distMiles: haversineMiles(driver.lat, driver.lng, s.pickupLat, s.pickupLng),
      }))
      .sort((a, b) => a.distMiles - b.distMiles)
      .slice(0, MAX_VISIBLE);
  }, [searches, driver?.lat, driver?.lng]);

  const nearbyCount = visibleSearches.length;

  // Upcoming scheduled count
  const upcomingScheduled = useMemo(() =>
    (scheduledRides || []).filter(r => {
      const st = r.scheduledAt || r.createdAt;
      if (!st) return false;
      return tsToMillis(st) > Date.now() - 3600000;
    }),
    [scheduledRides]
  );
  const scheduledCount = upcomingScheduled.length;
  const nextRide       = upcomingScheduled[0] ?? null;
  const nextCountdown  = nextRide ? fmtCountdown(nextRide.scheduledAt || nextRide.createdAt) : null;

  // ── Radar sweep ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!online || activeTrip) return;
    let angle = 0;
    const id = setInterval(() => { angle = (angle + 2) % 360; setSweepAngle(angle); }, 30);
    return () => clearInterval(id);
  }, [online, activeTrip]);

  // ── Init Mapbox ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!online || activeTrip || mapRef.current) return;

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
      const mapboxgl = window.mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container:          mapContainerRef.current,
        style:              MAP_STYLE,
        center:             [driver?.lng ?? -81.3792, driver?.lat ?? 28.5383],
        zoom:               13.2,
        pitch:              42,
        bearing:            -18,
        interactive:        false,
        attributionControl: false,
      });
      map.on('load', () => {
        mapRef.current = map;
        setMapReady(true);
        let bearing = -18;
        const drift = setInterval(() => { bearing += 0.05; map.setBearing(bearing); }, 100);
        map.on('remove', () => clearInterval(drift));
      });
    };

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; setMapReady(false); }
    };
  }, [online, activeTrip]);

  // ── Heatmap ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map  = mapRef.current;
    const data = {
      type: "FeatureCollection",
      features: visibleSearches.map(s => ({
        type: "Feature", properties: {},
        geometry: { type: "Point", coordinates: [s.pickupLng, s.pickupLat] },
      })),
    };
    if (map.getSource("demand")) { map.getSource("demand").setData(data); return; }
    map.addSource("demand", { type: "geojson", data });
    map.addLayer({
      id: "demand-heat", type: "heatmap", source: "demand", maxzoom: 16,
      paint: {
        "heatmap-weight":    1,
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 15, 1.2],
        "heatmap-radius":    ["interpolate", ["linear"], ["zoom"], 10, 18,  15, 45],
        "heatmap-opacity":   0.55,
        "heatmap-color": [
          "interpolate", ["linear"], ["heatmap-density"],
          0, "rgba(34,197,94,0)", 0.3, "rgba(34,197,94,0.25)",
          0.6, "rgba(96,165,250,0.45)", 1.0, "rgba(244,114,182,0.7)",
        ],
      },
    });
  }, [mapReady, visibleSearches]);

  // ── Rider markers ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const mapboxgl = window.mapboxgl;
    const map      = mapRef.current;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    visibleSearches.forEach((s, i) => {
      const el = document.createElement('div');
      el.style.cssText = 'cursor:pointer; pointer-events:auto;';
      el.innerHTML = `
        <div style="position:relative;width:30px;height:30px;display:flex;align-items:center;justify-content:center;animation:riderFadeIn .5s cubic-bezier(.34,1.4,.64,1) ${i * 0.06}s both;">
          <div style="position:absolute;inset:-5px;border-radius:50%;background:radial-gradient(circle,rgba(96,165,250,0.35) 0%,transparent 70%);animation:riderPulse 2.2s ease-in-out ${i * 0.3}s infinite;"></div>
          <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(145deg,#60A5FA,#2563EB);border:2px solid rgba(255,255,255,0.95);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(37,99,235,0.55),0 0 0 3px rgba(59,130,246,0.22);transition:transform .15s;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div>
        </div>
        <style>@keyframes riderFadeIn{from{opacity:0;transform:scale(.3);}to{opacity:1;transform:scale(1);}}@keyframes riderPulse{0%,100%{opacity:.6;transform:scale(1);}50%{opacity:1;transform:scale(1.25);}}</style>
      `;
      el.addEventListener('click', e => { e.stopPropagation(); setSelected(s); });
      el.addEventListener('mouseenter', () => { const d = el.querySelector('div>div:last-child'); if(d) d.style.transform='scale(1.15)'; });
      el.addEventListener('mouseleave', () => { const d = el.querySelector('div>div:last-child'); if(d) d.style.transform='scale(1)'; });
      markersRef.current.push(new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([s.pickupLng, s.pickupLat]).addTo(map));
    });

    if (visibleSearches.length > 0 && driver?.lat && driver?.lng) {
      const bounds = new mapboxgl.LngLatBounds([driver.lng, driver.lat], [driver.lng, driver.lat]);
      visibleSearches.forEach(s => bounds.extend([s.pickupLng, s.pickupLat]));
      map.fitBounds(bounds, { padding: { top: 70, bottom: 90, left: 50, right: 50 }, maxZoom: 14, duration: 1200, pitch: 42 });
    }
  }, [mapReady, visibleSearches, driver?.lat, driver?.lng]);

  if (!online || activeTrip) return null;

  // ── Radar geometry ────────────────────────────────────────────────────────
  const toRad = deg => (deg * Math.PI) / 180;
  const R      = 55;
  const trailX = 50 + R * Math.cos(toRad(sweepAngle));
  const trailY = 50 + R * Math.sin(toRad(sweepAngle));
  const leadA  = (sweepAngle + 72) % 360;
  const leadX  = 50 + R * Math.cos(toRad(leadA));
  const leadY  = 50 + R * Math.sin(toRad(leadA));
  const tipX   = 50 + 52 * Math.cos(toRad(leadA));
  const tipY   = 50 + 52 * Math.sin(toRad(leadA));

  const selectedFare = selected?.rides?.economy?.total ?? null;

  return (
    <>
      <style>{`
        @keyframes livePulse { 0%,100%{opacity:1;box-shadow:0 0 8px rgba(74,222,128,.8);}50%{opacity:.5;box-shadow:0 0 4px rgba(74,222,128,.3);} }
        @keyframes popIn     { from{opacity:0;transform:translateY(-8px) scale(.96);}to{opacity:1;transform:none;} }
        @keyframes drawerIn  { from{opacity:0;transform:scale(.97);}to{opacity:1;transform:scale(1);} }
        @keyframes rideRowIn { from{opacity:0;transform:translateX(-8px);}to{opacity:1;transform:none;} }
        @keyframes schedPing { 0%,100%{box-shadow:0 0 0 0 rgba(129,140,248,.5);}50%{box-shadow:0 0 0 6px rgba(129,140,248,0);} }
        @keyframes spin      { to{transform:rotate(360deg);} }
        @keyframes badgePop  { 0%{transform:scale(.7);opacity:0;}60%{transform:scale(1.2);}100%{transform:scale(1);opacity:1;} }
      `}</style>

      <div style={{ position: "relative", height: 280, borderRadius: 20, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.35), 0 0 0 1px rgba(34,197,94,0.15)" }}>

        <div ref={mapContainerRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}/>

        {/* Radar sweep (no riders) */}
        {mapReady && nearbyCount === 0 && (
          <svg style={{ position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none" }} viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <radialGradient id="sweepGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="rgba(34,197,94,0.75)"/>
                <stop offset="55%"  stopColor="rgba(34,197,94,0.22)"/>
                <stop offset="100%" stopColor="rgba(34,197,94,0)"/>
              </radialGradient>
              <radialGradient id="mapVig" cx="50%" cy="50%" r="60%">
                <stop offset="35%" stopColor="transparent"/>
                <stop offset="100%" stopColor="rgba(0,0,0,0.65)"/>
              </radialGradient>
            </defs>
            <rect width="100" height="100" fill="url(#mapVig)"/>
            {[16,28,40,52].map((r,i) => (
              <circle key={i} cx="50" cy="50" r={r} fill="none" stroke="rgba(34,197,94,0.15)" strokeWidth="0.3" strokeDasharray="1.2 2.2"/>
            ))}
            <path d={`M 50 50 L ${trailX} ${trailY} A ${R} ${R} 0 0 1 ${leadX} ${leadY} Z`} fill="url(#sweepGrad)" opacity="0.72"/>
            <line x1="50" y1="50" x2={leadX} y2={leadY} stroke="#4ADE80" strokeWidth="0.55" strokeLinecap="round" opacity="0.95"/>
            <circle cx={tipX} cy={tipY} r="1.3" fill="#4ADE80" opacity="0.95"/>
            <circle cx={tipX} cy={tipY} r="2.4" fill="rgba(74,222,128,0.25)" opacity="0.9"/>
            <line x1="47.5" y1="50" x2="52.5" y2="50" stroke="rgba(34,197,94,0.55)" strokeWidth="0.3"/>
            <line x1="50" y1="47.5" x2="50" y2="52.5" stroke="rgba(34,197,94,0.55)" strokeWidth="0.3"/>
            <circle cx="50" cy="50" r="0.9" fill="rgba(74,222,128,0.85)"/>
          </svg>
        )}

        {/* Vignette (riders present) */}
        {mapReady && nearbyCount > 0 && (
          <div style={{ position:"absolute",inset:0,pointerEvents:"none", background:"radial-gradient(circle at 50% 50%,transparent 40%,rgba(0,0,0,0.55) 100%)" }}/>
        )}

        {/* Loading */}
        {!mapReady && (
          <div style={{ position:"absolute",inset:0,background:"linear-gradient(135deg,#0F1F17,#0A1814)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10 }}>
            <div style={{ width:44,height:44,borderRadius:"50%",border:"2.5px solid rgba(34,197,94,0.15)",borderTop:"2.5px solid #22C55E",animation:"spin .9s linear infinite" }}/>
            <span style={{ fontSize:11,color:"rgba(255,255,255,0.4)",letterSpacing:".08em",fontWeight:600 }}>Locating…</span>
          </div>
        )}

        {/* ── Top HUD ── */}
        <div style={{ position:"absolute",top:10,left:10,right:10,display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:20,pointerEvents:"none",gap:6 }}>

          {/* Online pill */}
          <div style={{ display:"inline-flex",alignItems:"center",gap:6,background:"rgba(0,0,0,0.62)",backdropFilter:"blur(14px)",border:"1px solid rgba(34,197,94,0.35)",borderRadius:100,padding:"5px 12px" }}>
            <div style={{ width:6,height:6,borderRadius:"50%",background:"#4ADE80",boxShadow:"0 0 8px rgba(74,222,128,.8)",animation:"livePulse 1.4s ease-in-out infinite" }}/>
            <span style={{ fontSize:10,fontWeight:800,letterSpacing:".12em",textTransform:"uppercase",color:"rgba(255,255,255,.92)",fontFamily:"monospace" }}>Online</span>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {/* Scheduled badge — tappable */}
            {scheduledRides.length > 0 && (
              <button
                onClick={() => setShowScheduled(true)}
                style={{
                  pointerEvents: 'auto',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(14px)',
                  border: '1px solid rgba(129,140,248,0.50)',
                  borderRadius: 100, padding: '5px 11px',
                  cursor: 'pointer', position: 'relative',
                  animation: 'schedPing 2.4s ease-in-out infinite',
                }}
              >
                <Calendar size={10} color="#A5B4FC" strokeWidth={2.4}/>
                <span style={{ fontSize:10,fontWeight:800,letterSpacing:".1em",textTransform:"uppercase",color:"#A5B4FC",fontFamily:"monospace" }}>
                  {scheduledRides.length} sched
                </span>
                {nextCountdown && (
                  <span style={{
                    fontSize:9.5, fontWeight:800, color:'#818CF8',
                    background:'rgba(129,140,248,.18)', padding:'1px 5px',
                    borderRadius:99, fontFamily:'monospace',
                  }}>
                    {nextCountdown}
                  </span>
                )}
                <ChevronRight size={9} color="rgba(165,180,252,.6)"/>
              </button>
            )}

            {/* Active searches pill */}
            <div style={{ display:"inline-flex",alignItems:"center",gap:6,background:"rgba(0,0,0,0.62)",backdropFilter:"blur(14px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:100,padding:"5px 12px" }}>
              <Wifi size={10} color="rgba(255,255,255,.8)" strokeWidth={2.4}/>
              <span style={{ fontSize:10,fontWeight:700,color:"rgba(255,255,255,.8)" }}>
                {nearbyCount > 0 ? `${nearbyCount} active` : "Scanning"}
              </span>
            </div>
          </div>
        </div>

        {/* ── Selected rider popup ── */}
        {selected && (
          <div style={{ position:"absolute",top:50,left:10,right:10,zIndex:25,background:"rgba(8,16,10,0.92)",backdropFilter:"blur(20px)",border:"1px solid rgba(96,165,250,0.35)",borderRadius:14,padding:"11px 13px",boxShadow:"0 12px 40px rgba(0,0,0,.55)",animation:"popIn .25s cubic-bezier(.34,1.4,.64,1)" }}>
            <button onClick={() => setSelected(null)} style={{ position:"absolute",top:6,right:6,background:"rgba(255,255,255,0.07)",border:"none",borderRadius:6,width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"rgba(255,255,255,.6)" }} aria-label="Close">
              <X size={12}/>
            </button>
            <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:6 }}>
              <div style={{ width:7,height:7,borderRadius:"50%",background:"#60A5FA",boxShadow:"0 0 6px rgba(96,165,250,0.8)" }}/>
              <span style={{ fontSize:9.5,fontWeight:800,letterSpacing:".1em",textTransform:"uppercase",color:"#93C5FD",fontFamily:"monospace" }}>
                Rider request · {timeAgo(selected.createdAt)}
              </span>
            </div>
            <div style={{ display:"flex",alignItems:"flex-start",gap:8,marginBottom:4 }}>
              <MapPin size={11} color="#60A5FA" strokeWidth={2.4} style={{ marginTop:3,flexShrink:0 }}/>
              <div style={{ fontSize:12,color:"rgba(255,255,255,.92)",fontWeight:600,lineHeight:1.3 }}>{selected.pickup ?? "Pickup"}</div>
            </div>
            <div style={{ display:"flex",alignItems:"flex-start",gap:8,marginBottom:8 }}>
              <MapPin size={11} color="#22C55E" strokeWidth={2.4} style={{ marginTop:3,flexShrink:0 }}/>
              <div style={{ fontSize:12,color:"rgba(255,255,255,.7)",lineHeight:1.3 }}>{selected.dropoff ?? "Dropoff"}</div>
            </div>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:7,borderTop:"1px solid rgba(255,255,255,.08)",fontSize:10.5,fontWeight:700 }}>
              <span style={{ color:"rgba(255,255,255,.55)" }}>{selected.distMiles.toFixed(1)} mi away · {selected.miles?.toFixed(1) ?? "?"} mi trip</span>
              {selectedFare != null && (
                <span style={{ display:"inline-flex",alignItems:"center",gap:3,color:"#4ADE80",fontFamily:"monospace" }}>
                  <DollarSign size={10} strokeWidth={2.6}/>{selectedFare.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Bottom card ── */}
        <div style={{ position:"absolute",bottom:10,left:10,right:10,zIndex:20,pointerEvents:"none" }}>
          <div style={{ background:"rgba(8,16,10,0.82)",backdropFilter:"blur(20px)",border:"1px solid rgba(34,197,94,0.22)",borderRadius:14,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,boxShadow:"0 8px 32px rgba(0,0,0,.35)" }}>
            <div style={{ width:34,height:34,borderRadius:10,flexShrink:0,background:nearbyCount>0?"linear-gradient(135deg,#3B82F6,#1d4ed8)":"linear-gradient(135deg,#22C55E,#15803d)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:nearbyCount>0?"0 4px 12px rgba(29,78,216,.45)":"0 4px 12px rgba(21,128,61,.45)" }}>
              {nearbyCount > 0 ? <Users size={15} color="#fff" strokeWidth={2.2}/> : <Activity size={15} color="#fff" strokeWidth={2.2}/>}
            </div>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontSize:13,fontWeight:800,color:"rgba(255,255,255,.95)",letterSpacing:"-0.2px",lineHeight:1.2 }}>
                {nearbyCount > 0 ? `${nearbyCount} rider${nearbyCount>1?"s":""} searching nearby` : "Scanning area"}
              </div>
              {scheduledCount > 0 && (
                <div style={{ fontSize:10,fontWeight:600,color:"rgba(165,180,252,.7)",marginTop:2,display:"flex",alignItems:"center",gap:4 }}>
                  <Calendar size={9} color="rgba(165,180,252,.6)" strokeWidth={2.2}/>
                  {scheduledCount} scheduled ride{scheduledCount>1?"s":""} ahead
                  {nextCountdown && <span style={{ color:'#818CF8' }}>· next {nextCountdown}</span>}
                </div>
              )}
            </div>
            {nearbyCount > 0 && (
              <div style={{ minWidth:28,height:28,background:"linear-gradient(135deg,rgba(59,130,246,0.25),rgba(29,78,216,0.25))",border:"1px solid rgba(96,165,250,0.4)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <span style={{ fontSize:12,fontWeight:800,color:"#93C5FD" }}>{nearbyCount}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Scheduled Drawer ── */}
        {showScheduled && (
          <ScheduledDrawer
            rides={scheduledRides}
            onClose={() => setShowScheduled(false)}
          />
        )}

      </div>
    </>
  );
}