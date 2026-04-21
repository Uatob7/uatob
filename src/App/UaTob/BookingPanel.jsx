// src/App/BookingPanel.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Navigation, Clock, Car, Users, Zap,
  ChevronRight, Loader2, AlertCircle, LocateFixed, MapPin, X,
} from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuthContext } from '@/context/AuthContext';
import { firebase_app } from '@/firebase/config';


// ── Callables ─────────────────────────────────────────────────────────
const functions        = getFunctions(firebase_app, 'us-east1');
const callATOB         = httpsCallable(functions, 'ATOB');
const callPrice        = httpsCallable(functions, 'Price');
const callAutocomplete = httpsCallable(functions, 'Autocomplete');
const callGeo          = httpsCallable(functions, 'Geo');

// ── Theme tokens ──────────────────────────────────────────────────────
const T = {
  accent:       '#16A34A',
  accentLight:  '#F0FDF4',
  accentBorder: '#86EFAC',
  accentBorder2:'#BBF7D0',
  text:         '#111827',
  textMuted:    '#6B7280',
  border:       '#E5E7EB',
  surfaceAlt:   '#F9FAFB',
};

// ── localStorage ──────────────────────────────────────────────────────
const LS_KEY = 'uatob_booking_form';
function saveBookingForm(data)  { try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (_) {} }
function loadBookingForm()      { try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch (_) { return null; } }
function clearBookingForm()     { try { localStorage.removeItem(LS_KEY); } catch (_) {} }

// ── Helpers ───────────────────────────────────────────────────────────
function safeNum(val, fallback = 0) { const n = Number(val); return Number.isFinite(n) ? n : fallback; }
function round2(val) { return Number(safeNum(val).toFixed(2)); }
function getRideIcon(rideId) {
  if (rideId === 'premium') return Zap;
  if (rideId === 'xl')      return Users;
  return Car;
}

// ── Network helpers ───────────────────────────────────────────────────
async function fetchTripData(pickup, dropoff) {
  const { data } = await callATOB({ origin: pickup, destination: dropoff });

  let durationMin = data.duration_minutes;
  if (!durationMin && data.route?.duration_seconds)
    durationMin = Math.ceil(data.route.duration_seconds / 60);
  if (!durationMin && data.duration_text) {
    const h = (data.duration_text.match(/(\d+)\s*hour/) || [])[1] || 0;
    const m = (data.duration_text.match(/(\d+)\s*min/)  || [])[1] || 0;
    durationMin = Number(h) * 60 + Number(m);
  }

  return {
    pickup, dropoff,
    miles:        round2(data.distance_miles ?? 0),
    durationMin:  Math.max(1, Number(durationMin || 0)),
    durationText: data.duration_text || `${Math.max(1, Number(durationMin || 0))} min`,
    pickupCity:   data.pickup?.city  ?? '',  pickupZip:  data.pickup?.zip  ?? '',
    pickupLat:    data.pickup?.lat   ?? null, pickupLng: data.pickup?.lng  ?? null,
    dropoffCity:  data.dropoff?.city ?? '',  dropoffZip: data.dropoff?.zip ?? '',
    dropoffLat:   data.dropoff?.lat  ?? null, dropoffLng: data.dropoff?.lng ?? null,
    polyline:     data.route?.polyline ?? null,
  };
}

async function fetchQuotesData(tripData) {
  const { data } = await callPrice(tripData);
  if (!data.ok) throw new Error(data.error || 'Pricing error');
  if (data.rides)
    Object.values(data.rides).forEach(r => { r.total = Number(r.total).toFixed(2); });
  return data;
}

async function reverseGeocode(lat, lng) {
  const { data } = await callGeo({ lat, lng });
  if (!data.address) throw new Error('Could not find your address.');
  return { address: data.address };
}

// ── CSS ───────────────────────────────────────────────────────────────
const PANEL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');

  @keyframes bp-spin    { to { transform: rotate(360deg) } }
  @keyframes bp-fadeUp  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes bp-alertIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes bp-pulse   { 0%,100%{box-shadow:0 0 0 0 rgba(22,163,74,.25)} 50%{box-shadow:0 0 0 6px rgba(22,163,74,0)} }
  @keyframes bp-dotPulse { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }

  /* ── Single-driver growing ring animation ── */
  @keyframes bp-sonar-1 {
    0%   { transform:scale(1);   opacity:.7; }
    100% { transform:scale(3.2); opacity:0;  }
  }
  @keyframes bp-sonar-2 {
    0%   { transform:scale(1);   opacity:.5; }
    100% { transform:scale(2.4); opacity:0;  }
  }
  @keyframes bp-sonar-3 {
    0%   { transform:scale(1);   opacity:.35; }
    100% { transform:scale(1.7); opacity:0;  }
  }
  @keyframes bp-core-breathe {
    0%,100% { transform:scale(1);   box-shadow:0 0 0 0 rgba(22,163,74,.5); }
    50%     { transform:scale(1.12); box-shadow:0 0 12px 4px rgba(22,163,74,.25); }
  }

  .bp-card { border-radius:20px; border:1.5px solid #E5E7EB; background:#fff; overflow:hidden; font-family:'Outfit',system-ui,sans-serif; }
  .bp-card + .bp-card { margin-top:10px; }
  .bp-card-header { display:flex; align-items:center; justify-content:space-between; padding:13px 16px 0; font-family:'Outfit',system-ui,sans-serif; }
  .bp-card-header-label { font-size:11px; font-weight:800; letter-spacing:1.2px; text-transform:uppercase; color:#9CA3AF; }
  .bp-cancel-btn { width:26px; height:26px; border-radius:50%; background:#F3F4F6; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#6B7280; transition:background .15s,color .15s,transform .12s; padding:0; flex-shrink:0; }
  .bp-cancel-btn:hover  { background:#E5E7EB; color:#111827; transform:scale(1.08); }
  .bp-cancel-btn:active { transform:scale(.94); }
  .bp-route-row { display:flex; align-items:center; gap:12px; padding:13px 16px; position:relative; }
  .bp-route-row + .bp-route-row { border-top:1px solid #F3F4F6; }
  .bp-icon { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:border-color .2s,background .2s; }
  .bp-icon.pickup  { background:#F0FDF4; border:1.5px solid #BBF7D0; }
  .bp-icon.dropoff { background:#F9FAFB; border:1.5px solid #E5E7EB; }
  .bp-icon.pickup.active  { background:#DCFCE7; border-color:#16A34A; animation:bp-pulse 1.8s ease-in-out infinite; }
  .bp-icon.dropoff.active { background:#F3F4F6; border-color:#9CA3AF; }
  .bp-input { flex:1; border:none; outline:none; background:transparent; font-family:'Outfit',system-ui,sans-serif; font-size:13.5px; font-weight:600; color:#111827; caret-color:#16A34A; min-width:0; }
  .bp-input::placeholder { color:#D1D5DB; font-weight:500; }
  .bp-route-connector { position:absolute; left:calc(16px + 13px); bottom:-1px; width:1.5px; height:14px; background:linear-gradient(to bottom,#BBF7D0,#E5E7EB); z-index:1; }
  .bp-geo-btn { width:28px; height:28px; flex-shrink:0; background:none; border:none; cursor:pointer; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#9CA3AF; transition:background .15s,color .15s; padding:0; }
  .bp-geo-btn:hover { background:#F0FDF4; color:#16A34A; }
  .bp-clear-btn { width:22px; height:22px; flex-shrink:0; background:#F3F4F6; border:none; cursor:pointer; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#9CA3AF; transition:background .15s,color .15s; padding:0; }
  .bp-clear-btn:hover { background:#E5E7EB; color:#374151; }
  .bp-dropdown { position:absolute; top:calc(100% + 4px); left:0; right:0; background:#fff; border:1.5px solid #E5E7EB; border-radius:16px; box-shadow:0 12px 36px rgba(0,0,0,.1); z-index:200; overflow:hidden; }
  .bp-suggestion { display:flex; align-items:flex-start; gap:10px; padding:11px 16px; cursor:pointer; border-bottom:1px solid #F3F4F6; transition:background .1s; }
  .bp-suggestion:last-child { border-bottom:none; }
  .bp-suggestion:hover, .bp-suggestion.active { background:#F9FAFB; }
  .bp-sug-main { font-size:13px; font-weight:700; color:#111827; }
  .bp-sug-sub  { font-size:11px; color:#9CA3AF; font-weight:500; margin-top:1px; }
  .bp-ghost-wrap { position:absolute; inset:0; display:flex; align-items:center; padding-left:calc(16px + 28px + 12px); padding-right:16px; pointer-events:none; z-index:0; font-family:'Outfit',system-ui,sans-serif; font-size:13.5px; font-weight:600; white-space:nowrap; overflow:hidden; }
  .bp-ride-grid { display:grid; grid-template-columns:1fr 1fr; gap:0; }
  .bp-ride-card { padding:16px; cursor:pointer; border-right:1px solid #F3F4F6; border-bottom:1px solid #F3F4F6; transition:background .15s; position:relative; }
  .bp-ride-card:nth-child(2n)        { border-right:none; }
  .bp-ride-card:nth-last-child(-n+2) { border-bottom:none; }
  .bp-ride-card:hover  { background:#FAFAFA; }
  .bp-ride-card.active { background:#F0FDF4; }
  .bp-ride-card.active::after { content:''; position:absolute; inset:0; border:2px solid #16A34A; border-radius:0; pointer-events:none; }
  .bp-ride-card:first-child.active::after      { border-radius:18px 0 0 0; }
  .bp-ride-card:nth-child(2).active::after     { border-radius:0 18px 0 0; }
  .bp-ride-card:nth-last-child(2).active::after{ border-radius:0 0 0 18px; }
  .bp-ride-card:last-child.active::after       { border-radius:0 0 18px 0; }
  .bp-ride-icon-wrap { width:34px; height:34px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:10px; transition:background .2s,border-color .2s; border:1.5px solid transparent; }
  .bp-ride-card.active .bp-ride-icon-wrap { background:#DCFCE7 !important; border-color:rgba(22,163,74,.3) !important; }
  .bp-ride-name  { font-size:13px; font-weight:800; color:#111827; margin-bottom:2px; }
  .bp-ride-desc  { font-size:11px; color:#9CA3AF; font-weight:500; margin-bottom:8px; }
  .bp-ride-price { font-family:'JetBrains Mono',monospace; font-size:17px; font-weight:700; color:#111827; transition:color .2s; }
  .bp-ride-card.active .bp-ride-price { color:#16A34A; }
  .bp-ride-meta  { display:flex; gap:8px; flex-wrap:wrap; margin-top:6px; }
  .bp-ride-tag   { display:flex; align-items:center; gap:3px; font-size:10.5px; color:#9CA3AF; font-weight:600; }
  .bp-ride-tag.stale { color:#9CA3AF; }
  .bp-stats { display:flex; align-items:stretch; border-top:1.5px solid #E5E7EB; }
  .bp-stat  { flex:1; padding:13px 16px; display:flex; flex-direction:column; gap:3px; }
  .bp-stat + .bp-stat { border-left:1.5px solid #E5E7EB; }
  .bp-stat-label { font-size:10px; font-weight:800; letter-spacing:1.2px; text-transform:uppercase; color:#9CA3AF; }
  .bp-stat-val   { font-size:20px; font-weight:900; color:#111827; letter-spacing:-.5px; line-height:1; font-family:'Outfit',system-ui,sans-serif; }
  .bp-stat-val.green { color:#16A34A; }
  .bp-stat-sub   { font-size:11px; font-weight:600; color:#9CA3AF; }
  .bp-fare-card  { border-radius:20px; border:1.5px solid #BBF7D0; background:linear-gradient(135deg,#F0FDF4 0%,#DCFCE7 100%); overflow:hidden; font-family:'Outfit',system-ui,sans-serif; }
  .bp-fare-top   { display:flex; align-items:center; justify-content:space-between; padding:18px 20px 16px; gap:12px; }
  .bp-fare-amount{ font-family:'JetBrains Mono',monospace; font-size:38px; font-weight:700; color:#16A34A; letter-spacing:-2px; line-height:1; }
  .bp-fare-label { font-size:11px; font-weight:800; letter-spacing:1px; text-transform:uppercase; color:#6B7280; margin-bottom:4px; }
  .bp-fare-sub   { font-size:12px; font-weight:500; color:#6B7280; margin-top:4px; }
  .bp-breakdown-toggle { background:none; border:none; cursor:pointer; font-family:'Outfit',system-ui,sans-serif; font-size:11px; font-weight:700; color:#16A34A; padding:0; margin-top:4px; display:block; }
  .bp-breakdown  { border-top:1px solid #BBF7D0; padding:16px 20px; display:flex; flex-direction:column; gap:10px; animation:bp-fadeUp .22s ease-out; }
  .bp-bd-row     { display:flex; justify-content:space-between; align-items:center; }
  .bp-bd-label   { font-size:12.5px; color:#374151; font-weight:600; }
  .bp-bd-note    { font-size:11px; color:#9CA3AF; font-weight:500; margin-top:1px; }
  .bp-bd-val     { font-family:'JetBrains Mono',monospace; font-size:13px; font-weight:700; color:#111827; }
  .bp-bd-total   { border-top:1px dashed #BBF7D0; padding-top:10px; display:flex; justify-content:space-between; align-items:center; }
  .bp-bd-total-label { font-size:13px; font-weight:800; color:#111827; }
  .bp-bd-total-val   { font-family:'JetBrains Mono',monospace; font-size:16px; font-weight:700; color:#16A34A; }
  .bp-min-note   { display:flex; align-items:center; gap:6px; background:rgba(22,163,74,.07); border:1px solid rgba(22,163,74,.18); border-radius:8px; padding:7px 10px; }
  .bp-min-note span { font-size:11.5px; color:#16A34A; font-weight:700; }
  .bp-book-btn   { width:100%; padding:16px; background:linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D); color:#fff; border:none; border-radius:16px; font-family:'Outfit',system-ui,sans-serif; font-size:15px; font-weight:900; letter-spacing:-.2px; cursor:pointer; box-shadow:0 6px 20px rgba(22,163,74,.3); display:flex; align-items:center; justify-content:center; gap:6px; transition:opacity .15s,transform .12s,box-shadow .15s; }
  .bp-book-btn:hover  { opacity:.93; transform:translateY(-1px); box-shadow:0 8px 26px rgba(22,163,74,.38); }
  .bp-book-btn:active { opacity:.88; transform:scale(.98); }
  .bp-geo-alert  { border-radius:16px; border:1.5px solid #BBF7D0; background:linear-gradient(135deg,#F0FDF4,#DCFCE7); padding:14px 16px; animation:bp-alertIn .2s ease; margin-bottom:10px; }
  .bp-geo-alert.error { border-color:#FECACA; background:#FEF2F2; }
  .bp-status     { display:flex; align-items:center; gap:10px; padding:16px 18px; border-top:1px solid #F3F4F6; font-size:13px; font-weight:600; color:#6B7280; font-family:'Outfit',system-ui,sans-serif; }
  .bp-error      { display:flex; align-items:flex-start; gap:10px; background:#FEF2F2; border:1px solid #FECACA; border-radius:14px; padding:14px 16px; font-family:'Outfit',system-ui,sans-serif; }
  .bp-error span { font-size:13px; color:#DC2626; font-weight:600; }
  .bp-empty      { padding:22px 18px; text-align:center; font-size:13px; font-weight:500; color:#D1D5DB; font-family:'Outfit',system-ui,sans-serif; border-top:1px solid #F9FAFB; }
  .bp-fadeup     { animation:bp-fadeUp .3s ease-out both; }

  /* ── Driver banner base ── */
  .bp-driver-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-top: 1px solid #F3F4F6;
    background: #FAFFFE;
  }
  .bp-driver-banner.stale {
    background: #FAFAFA;
  }

  /* ── Multi-driver dot (simple pulse) ── */
  .bp-driver-dot-multi {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #16A34A;
    flex-shrink: 0;
    animation: bp-dotPulse 1.6s ease-in-out infinite;
  }
  .bp-driver-dot-multi.stale {
    background: #9CA3AF;
    animation: none;
  }

  /* ── Single-driver sonar ── */
  .bp-sonar-wrap {
    position: relative;
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .bp-sonar-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: rgba(22, 163, 74, 0.18);
    animation: bp-sonar-1 2.2s ease-out infinite;
  }
  .bp-sonar-ring-2 {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: rgba(22, 163, 74, 0.14);
    animation: bp-sonar-2 2.2s ease-out infinite;
    animation-delay: 0.55s;
  }
  .bp-sonar-ring-3 {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: rgba(22, 163, 74, 0.1);
    animation: bp-sonar-3 2.2s ease-out infinite;
    animation-delay: 1.1s;
  }
  .bp-sonar-core {
    position: relative;
    z-index: 2;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #16A34A;
    animation: bp-core-breathe 2.2s ease-in-out infinite;
  }

  .bp-driver-text {
    font-size: 12.5px;
    font-weight: 700;
    color: #111827;
    font-family: 'Outfit', sans-serif;
    line-height: 1.3;
  }
  .bp-driver-text.stale { color: #9CA3AF; }
  .bp-driver-sub {
    font-size: 11px;
    font-weight: 500;
    color: #9CA3AF;
    font-family: 'Outfit', sans-serif;
    margin-top: 1px;
  }
  .bp-driver-miles {
    margin-left: auto;
    font-size: 11px;
    font-weight: 700;
    color: #16A34A;
    font-family: 'Outfit', sans-serif;
    background: #F0FDF4;
    border: 1px solid #BBF7D0;
    border-radius: 100px;
    padding: 3px 10px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .bp-driver-miles.stale {
    color: #9CA3AF;
    background: #F9FAFB;
    border-color: #E5E7EB;
  }
`;

// ── Location alert ────────────────────────────────────────────────────
function LocationAlert({ onAllow, onDeny, loading, error }) {
  return (
    <div className={`bp-geo-alert${error ? ' error' : ''}`}>
      {error ? (
        <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
          <AlertCircle size={15} color="#DC2626" style={{ flexShrink:0, marginTop:1 }}/>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:13, color:'#DC2626', fontWeight:600, margin:'0 0 10px', fontFamily:'Outfit,sans-serif' }}>{error}</p>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={onAllow} style={{ flex:1, padding:'8px 12px', borderRadius:10, border:'none', background:'#DC2626', color:'#fff', fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'Outfit,sans-serif' }}>Try again</button>
              <button onClick={onDeny}  style={{ flex:1, padding:'8px 12px', borderRadius:10, border:'1.5px solid #FECACA', background:'#fff', color:'#DC2626', fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'Outfit,sans-serif' }}>Dismiss</button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:38, height:38, flexShrink:0, background:'#fff', border:'1.5px solid #BBF7D0', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {loading
              ? <Loader2 size={16} color={T.accent} style={{ animation:'bp-spin 1s linear infinite' }}/>
              : <LocateFixed size={16} color={T.accent}/>}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:13, fontWeight:700, color:T.text, margin:'0 0 1px', fontFamily:'Outfit,sans-serif', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {loading ? 'Getting your location…' : 'Use your current location?'}
            </p>
            {!loading && <p style={{ fontSize:11.5, color:T.textMuted, fontWeight:500, margin:0, fontFamily:'Outfit,sans-serif' }}>Auto-fill your pickup address</p>}
          </div>
          {!loading && (
            <div style={{ display:'flex', gap:7, flexShrink:0 }}>
              <button onClick={onAllow} style={{ padding:'7px 13px', borderRadius:10, border:'none', background:T.accent, color:'#fff', fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'Outfit,sans-serif', boxShadow:'0 3px 10px rgba(22,163,74,.3)' }}>Allow</button>
              <button onClick={onDeny}  style={{ width:32, height:32, borderRadius:10, border:`1.5px solid ${T.border}`, background:'#fff', color:T.textMuted, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
                <X size={14}/>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Driver availability banner ────────────────────────────────────────
function DriverBanner({ driverInfo }) {
  if (!driverInfo) return null;

  const stale = driverInfo.stale;
  const count = driverInfo.driverCount ?? 1;
  const miles = driverInfo.nearestMiles;
  const isSingle = count === 1;

  return (
    <div className={`bp-driver-banner${stale ? ' stale' : ''}`}>

      {/* ── Indicator: sonar for 1 driver, simple dot for 2+ ── */}
      {isSingle && !stale ? (
        <div className="bp-sonar-wrap">
          <div className="bp-sonar-ring"   />
          <div className="bp-sonar-ring-2" />
          <div className="bp-sonar-ring-3" />
          <div className="bp-sonar-core"   />
        </div>
      ) : (
        <div className={`bp-driver-dot-multi${stale ? ' stale' : ''}`} />
      )}

      {/* ── Text ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className={`bp-driver-text${stale ? ' stale' : ''}`}>
          {isSingle
            ? stale ? '1 driver nearby · estimated location' : '1 driver nearby'
            : stale ? `${count} drivers nearby · estimated locations` : `${count} drivers nearby`}
        </div>
        {isSingle && !stale && (
          <div className="bp-driver-sub">Ready to pick you up</div>
        )}
        {stale && (
          <div className="bp-driver-sub">Location may be out of date</div>
        )}
      </div>

      {/* ── Distance pill ── */}
      {miles != null && (
        <div className={`bp-driver-miles${stale ? ' stale' : ''}`}>
          {miles} mi away
        </div>
      )}
    </div>
  );
}

// ── PlaceInput ────────────────────────────────────────────────────────
function PlaceInput({ isPickup, placeholder, value, onChange, onLocationRequest, isFocused, onFocus, onBlur }) {
  const [suggestions, setSuggestions] = useState([]);
  const [ghostText,   setGhostText]   = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef     = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setSuggestions([]); setGhostText('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function fetchSuggestions(query) {
    if (!query || query.length < 2) { setSuggestions([]); setGhostText(''); return; }
    try {
      const { data } = await callAutocomplete({ input: query });
      const preds = data.predictions || [];
      setSuggestions(preds);
      const first = preds[0]?.description || '';
      setGhostText(first.toLowerCase().startsWith(query.toLowerCase()) ? first.slice(query.length) : '');
    } catch { setSuggestions([]); setGhostText(''); }
  }

  function handleChange(e) {
    const val = e.target.value;
    onChange(val);
    setActiveIndex(-1);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 250);
  }

  function handleSelect(desc) {
    onChange(desc); setSuggestions([]); setGhostText(''); setActiveIndex(-1);
  }

  function handleKeyDown(e) {
    if ((e.key === 'Tab' || e.key === 'ArrowRight') && ghostText && activeIndex === -1) { e.preventDefault(); handleSelect(value + ghostText); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, suggestions.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, -1)); }
    if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); handleSelect(suggestions[activeIndex].description); }
    if (e.key === 'Escape') { setSuggestions([]); setGhostText(''); }
  }

  return (
    <div className="bp-route-row" ref={wrapRef} style={{ position:'relative' }}>
      <div className={`bp-icon ${isPickup ? 'pickup' : 'dropoff'}${isFocused ? ' active' : ''}`}>
        {isPickup ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="5" r="3" fill="#16A34A"/>
            <circle cx="5" cy="5" r="4.5" stroke="#16A34A" strokeWidth="1" fill="none" opacity=".3"/>
          </svg>
        ) : (
          <svg width="9" height="11" viewBox="0 0 10 13" fill="none">
            <path d="M5 0C2.239 0 0 2.239 0 5c0 3.75 5 8 5 8s5-4.25 5-8c0-2.761-2.239-5-5-5zm0 7a2 2 0 110-4 2 2 0 010 4z" fill="#111827"/>
          </svg>
        )}
      </div>

      {ghostText && isFocused && (
        <div className="bp-ghost-wrap">
          <span style={{ color:'transparent' }}>{value}</span>
          <span style={{ color:T.textMuted, opacity:.4 }}>{ghostText}</span>
        </div>
      )}

      <input
        type="text"
        className="bp-input"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        style={{ position:'relative', zIndex:2 }}
      />

      {isPickup && onLocationRequest && !value && (
        <button type="button" className="bp-geo-btn" onClick={onLocationRequest} title="Use current location">
          <LocateFixed size={15}/>
        </button>
      )}

      {value && (
        <button type="button" className="bp-clear-btn" onClick={() => { onChange(''); setSuggestions([]); setGhostText(''); }}>
          <X size={11}/>
        </button>
      )}

      {suggestions.length > 0 && (
        <div className="bp-dropdown">
          {suggestions.map((s, i) => {
            const main      = s.structured_formatting?.main_text || s.description;
            const secondary = s.structured_formatting?.secondary_text || '';
            return (
              <div key={s.place_id} className={`bp-suggestion${i === activeIndex ? ' active' : ''}`}
                onMouseDown={() => handleSelect(s.description)}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <MapPin size={12} color="#9CA3AF" style={{ marginTop:3, flexShrink:0 }}/>
                <div>
                  <div className="bp-sug-main">{main}</div>
                  {secondary && <div className="bp-sug-sub">{secondary}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Breakdown lines ───────────────────────────────────────────────────
function BreakdownLines({ quote, tripData }) {
  const receipt = quote?.receipt;
  const bd      = quote?.breakdown || {};
  const meta    = quote?.meta      || {};

  if (Array.isArray(receipt) && receipt.length > 0) {
    const chargeLines = receipt.filter(l => l.key !== 'minimumFareNote');
    const noteLines   = receipt.filter(l => l.key === 'minimumFareNote');
    return (
      <div className="bp-breakdown">
        {chargeLines.map((line, i) => (
          <div key={line.key ?? i} className="bp-bd-row">
            <div>
              <div className="bp-bd-label">{line.label}</div>
              {line.note && <div className="bp-bd-note">{line.note}</div>}
            </div>
            <span className="bp-bd-val">+${Number(line.amount || 0).toFixed(2)}</span>
          </div>
        ))}
        {noteLines.map((line, i) => (
          <div key={`note-${i}`} className="bp-min-note">
            <Zap size={11} color={T.accent}/>
            <span>{line.note || line.label}</span>
          </div>
        ))}
        <div className="bp-bd-total">
          <span className="bp-bd-total-label">Total</span>
          <span className="bp-bd-total-val">${quote.total}</span>
        </div>
      </div>
    );
  }

  const rows = [
    { label: 'Base fee',                                                              val: bd.base },
    { label: `Distance (${tripData?.miles} mi × $${meta.perMile || 0}/mi)`,          val: bd.distance },
    { label: `Time (~${tripData?.durationMin} min × $${meta.perMin || 0}/min)`,      val: bd.time },
    { label: 'Booking fee',                                                           val: bd.bookingFee },
    ...(safeNum(bd.surge, 0) > 0 ? [{ label: 'Surge', val: bd.surge, hi: true }] : []),
  ].filter(r => r.val != null);

  return (
    <div className="bp-breakdown">
      {rows.map((row, i) => (
        <div key={i} className="bp-bd-row">
          <span className="bp-bd-label" style={row.hi ? { color: T.accent } : {}}>{row.label}</span>
          <span className="bp-bd-val"   style={row.hi ? { color: T.accent } : {}}>+${Number(row.val || 0).toFixed(2)}</span>
        </div>
      ))}
      <div className="bp-bd-total">
        <span className="bp-bd-total-label">Total</span>
        <span className="bp-bd-total-val">${quote.total}</span>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────
export default function BookingPanel({ onBookNow, onPayloadChange, onPriceReady, onCancel }) {
  const { uid } = useAuthContext();
  const saved   = useMemo(() => loadBookingForm(), []);

  const [pickup,       setPickupRaw]    = useState(saved?.pickup       ?? '');
  const [dropoff,      setDropoffRaw]   = useState(saved?.dropoff      ?? '');
  const [selectedRide, setSelectedRide] = useState(saved?.selectedRide ?? 'standard');
  const [tripData,     setTripData]     = useState(saved?.tripData     ?? null);
  const [quotesData,   setQuotesData]   = useState(saved?.quotesData   ?? null);

  const [loadingTrip,   setLoadingTrip]   = useState(false);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [error,         setError]         = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);

  const [focusedInput,      setFocusedInput]      = useState(null);
  const [showLocationAlert, setShowLocationAlert] = useState(false);
  const [locationLoading,   setLocationLoading]   = useState(false);
  const [locationError,     setLocationError]     = useState('');

  const priceReadyFiredRef  = useRef(false);
  const tripRequestRef      = useRef(0);
  const quoteRequestRef     = useRef(0);
  const lastFetchedTripRef  = useRef(saved?.tripData ? `${saved.tripData.pickup}||${saved.tripData.dropoff}` : '');

  const onPayloadChangeRef = useRef(onPayloadChange);
  const onPriceReadyRef    = useRef(onPriceReady);
  const selectedRideRef    = useRef(selectedRide);

  useEffect(() => { onPayloadChangeRef.current = onPayloadChange; }, [onPayloadChange]);
  useEffect(() => { onPriceReadyRef.current    = onPriceReady;    }, [onPriceReady]);
  useEffect(() => { selectedRideRef.current    = selectedRide;    }, [selectedRide]);

  function setPickup(val)  { setPickupRaw(val);  saveBookingForm({ pickup: val, dropoff,      selectedRide, tripData, quotesData }); }
  function setDropoff(val) { setDropoffRaw(val); saveBookingForm({ pickup,      dropoff: val, selectedRide, tripData, quotesData }); }

  useEffect(() => {
    if (pickup || dropoff) saveBookingForm({ pickup, dropoff, selectedRide, tripData, quotesData });
    else clearBookingForm();
  }, [pickup, dropoff, selectedRide, tripData, quotesData]);

  const buildPayload = useCallback((trip, quote, quotes, rideId) => ({
    pickup:            trip.pickup,
    dropoff:           trip.dropoff,
    pickupCity:        trip.pickupCity  || '',  pickupZip:   trip.pickupZip  || '',
    pickupLat:         trip.pickupLat   ?? null, pickupLng:  trip.pickupLng  ?? null,
    dropoffCity:       trip.dropoffCity || '',  dropoffZip:  trip.dropoffZip || '',
    dropoffLat:        trip.dropoffLat  ?? null, dropoffLng: trip.dropoffLng ?? null,
    miles:             trip.miles,
    durationMin:       trip.durationMin,
    durationText:      trip.durationText,
    tripDistanceMiles: trip.miles,
    tripDurationMin:   trip.durationMin,
    rideType:          rideId,
    rideLabel:         quote.label,
    fareEstimate:      quote.total,
    breakdown:         quote.breakdown || {},
    receipt:           quote.receipt   || [],
    allQuotes:         quotes.rides    || {},
    driverInfo:        quotes.driverInfo ?? null,
    polyline:          trip.polyline   || null,
    status:            'searching_driver',
    createdAt:         new Date().toISOString(),
  }), []);

  useEffect(() => {
    if (!tripData || !quotesData) return;
    const quote = quotesData?.rides?.[selectedRide];
    if (!quote || typeof onPayloadChangeRef.current !== 'function') return;
    onPayloadChangeRef.current(buildPayload(tripData, quote, quotesData, selectedRide));
  }, [selectedRide, quotesData, tripData, buildPayload]);

  const handleLocationAllow = useCallback(async () => {
    setLocationError(''); setLocationLoading(true);
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
      );
      const geo = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      setPickup(geo.address);
      setShowLocationAlert(false); setLocationError('');
    } catch (err) {
      if (err.code === 1) setLocationError('Location access was denied. Please allow it in browser settings.');
      else if (err.code === 2) setLocationError('Could not detect your location. Try again or enter manually.');
      else if (err.code === 3) setLocationError('Location request timed out. Please try again.');
      else setLocationError(err.message || 'Could not get your location.');
    } finally { setLocationLoading(false); }
  }, []);

  const handleLocationDeny = useCallback(() => { setShowLocationAlert(false); setLocationError(''); }, []);

  // ── Step 1: trip data ─────────────────────────────────────────────
  useEffect(() => {
    const p = pickup.trim(), d = dropoff.trim();
    if (!p || !d) {
      setTripData(null); setQuotesData(null); setError('');
      setLoadingTrip(false); setLoadingQuotes(false); setShowBreakdown(false);
      lastFetchedTripRef.current = '';
      priceReadyFiredRef.current = false;
      return;
    }
    const key = `${p}||${d}`;
    if (lastFetchedTripRef.current === key && tripData && quotesData) return;
    const requestId = ++tripRequestRef.current;
    const t = setTimeout(async () => {
      try {
        setLoadingTrip(true); setLoadingQuotes(false); setError('');
        setTripData(null); setQuotesData(null); setShowBreakdown(false);
        const trip = await fetchTripData(p, d);
        if (tripRequestRef.current !== requestId) return;
        lastFetchedTripRef.current = key;
        setTripData(trip);
      } catch (err) {
        if (tripRequestRef.current !== requestId) return;
        setError(err.message || 'Failed to calculate route');
        setTripData(null); setQuotesData(null);
        lastFetchedTripRef.current = '';
      } finally {
        if (tripRequestRef.current === requestId) setLoadingTrip(false);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [pickup, dropoff]);

  // ── Step 2: quotes ────────────────────────────────────────────────
  useEffect(() => {
    if (!tripData || quotesData) return;
    const requestId = ++quoteRequestRef.current;
    async function loadQuotes() {
      try {
        setLoadingQuotes(true); setError('');
        const quotes = await fetchQuotesData(tripData);
        if (quoteRequestRef.current !== requestId) return;

        const keys           = Object.keys(quotes?.rides || {});
        const resolvedRideId = (quotes.rides?.[selectedRideRef.current])
          ? selectedRideRef.current
          : (keys[0] ?? selectedRideRef.current);

        setQuotesData(quotes);
        if (resolvedRideId !== selectedRideRef.current) setSelectedRide(resolvedRideId);

        const quote = quotes.rides?.[resolvedRideId];
        if (quote && typeof onPayloadChangeRef.current === 'function') {
          onPayloadChangeRef.current(buildPayload(tripData, quote, quotes, resolvedRideId));
        }

        if (!priceReadyFiredRef.current) {
          priceReadyFiredRef.current = true;
          onPriceReadyRef.current?.();
        }
      } catch (err) {
        if (quoteRequestRef.current !== requestId) return;
        setError(err.message || 'Failed to calculate prices');
        setQuotesData(null);
      } finally {
        if (quoteRequestRef.current === requestId) setLoadingQuotes(false);
      }
    }
    loadQuotes();
  }, [tripData, buildPayload]);

  const rideOptions   = useMemo(() => Object.values(quotesData?.rides || {}), [quotesData]);
  const selectedQuote = useMemo(() => quotesData?.rides?.[selectedRide] || null, [quotesData, selectedRide]);
  const driverInfo    = useMemo(() => quotesData?.driverInfo ?? null, [quotesData]);

  const isLoading = loadingTrip || loadingQuotes;
  const hasQuote  = !!tripData && !!quotesData && !!selectedQuote && !error && !isLoading;

  useEffect(() => {
    if (hasQuote && !priceReadyFiredRef.current) {
      priceReadyFiredRef.current = true;
      onPriceReadyRef.current?.();
    }
  }, [hasQuote]);

  const handleCancel = useCallback(() => {
    clearBookingForm();
    setPickupRaw(''); setDropoffRaw('');
    setTripData(null); setQuotesData(null);
    setError(''); setShowBreakdown(false);
    setShowLocationAlert(false); setLocationError('');
    lastFetchedTripRef.current  = '';
    priceReadyFiredRef.current  = false;
    onCancel?.();
  }, [onCancel]);

  const handleBookNow = useCallback(() => {
    if (!tripData || !quotesData || !selectedQuote) return;
    const payload = buildPayload(tripData, selectedQuote, quotesData, selectedRide);
    clearBookingForm();
    if (typeof onBookNow === 'function') onBookNow(payload);
  }, [tripData, quotesData, selectedQuote, selectedRide, buildPayload, onBookNow]);

  const showCancelBtn = !!(pickup.trim() || dropoff.trim());

  return (
    <>
      <style>{PANEL_CSS}</style>

      {(showLocationAlert || locationLoading || locationError) && (
        <LocationAlert
          onAllow={handleLocationAllow}
          onDeny={handleLocationDeny}
          loading={locationLoading}
          error={locationError}
        />
      )}

      {/* ── Route input card ── */}
      <div className="bp-card" style={{ marginBottom:10 }}>
        {showCancelBtn && (
          <div className="bp-card-header">
            <span className="bp-card-header-label">Your trip</span>
            <button type="button" className="bp-cancel-btn" onClick={handleCancel} title="Cancel and start over" aria-label="Cancel booking">
              <X size={12}/>
            </button>
          </div>
        )}

        <div style={{ position:'relative' }}>
          <PlaceInput
            isPickup
            placeholder="Where are you?"
            value={pickup}
            onChange={setPickup}
            onLocationRequest={() => { setLocationError(''); setShowLocationAlert(true); }}
            isFocused={focusedInput === 'pickup'}
            onFocus={() => setFocusedInput('pickup')}
            onBlur={() => setFocusedInput(null)}
          />
          <div className="bp-route-connector"/>
        </div>

        <PlaceInput
          isPickup={false}
          placeholder="Where to?"
          value={dropoff}
          onChange={setDropoff}
          isFocused={focusedInput === 'dropoff'}
          onFocus={() => setFocusedInput('dropoff')}
          onBlur={() => setFocusedInput(null)}
        />

        {isLoading && (
          <div className="bp-status">
            <Loader2 size={15} color={T.accent} style={{ animation:'bp-spin 1s linear infinite' }}/>
            {loadingTrip ? 'Calculating route…' : 'Calculating prices…'}
          </div>
        )}

        {error && !isLoading && (
          <div style={{ padding:'12px 16px', borderTop:'1px solid #F3F4F6' }}>
            <div className="bp-error">
              <AlertCircle size={15} color="#DC2626" style={{ flexShrink:0, marginTop:1 }}/>
              <span>{error}</span>
            </div>
          </div>
        )}

        {hasQuote && (
          <>
            <div className="bp-stats bp-fadeup">
              <div className="bp-stat">
                <div className="bp-stat-label">Distance</div>
                <div className="bp-stat-val">{tripData.miles}<span style={{ fontSize:11, fontWeight:600, color:'#9CA3AF' }}> mi</span></div>
                <div className="bp-stat-sub">point to point</div>
              </div>
              <div className="bp-stat">
                <div className="bp-stat-label">Duration</div>
                <div className="bp-stat-val">{tripData.durationMin}<span style={{ fontSize:11, fontWeight:600, color:'#9CA3AF' }}> min</span></div>
                <div className="bp-stat-sub">{tripData.durationText}</div>
              </div>
              <div className="bp-stat">
                <div className="bp-stat-label">Est. Fare</div>
                <div className="bp-stat-val green">${selectedQuote.total}</div>
                <div className="bp-stat-sub">{selectedQuote.label}</div>
              </div>
            </div>

            {/* ── Driver availability banner ── */}
            <DriverBanner driverInfo={driverInfo} />
          </>
        )}

        {!pickup.trim() && !dropoff.trim() && (
          <div className="bp-empty">Enter pickup and destination above</div>
        )}
      </div>

      {/* ── Ride selector card ── */}
      {rideOptions.length > 0 && !isLoading && !error && (
        <div className="bp-card bp-fadeup" style={{ marginBottom:10 }}>
          <div style={{ padding:'14px 16px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:11, fontWeight:800, letterSpacing:'1.2px', textTransform:'uppercase', color:'#9CA3AF', fontFamily:'Outfit,sans-serif' }}>Choose Ride</span>
            {driverInfo?.stale && (
              <span style={{ fontSize:10.5, fontWeight:700, color:'#9CA3AF', fontFamily:'Outfit,sans-serif' }}>
                ⚠ Estimated wait times
              </span>
            )}
          </div>
          <div className="bp-ride-grid" style={{ marginTop:10 }}>
            {rideOptions.map((ride) => {
              const active   = selectedRide === ride.id;
              const IconComp = getRideIcon(ride.id);
              const isStaleEta = ride.eta?.startsWith('~');
              return (
                <div key={ride.id} className={`bp-ride-card${active ? ' active' : ''}`}
                  onClick={() => { setSelectedRide(ride.id); setShowBreakdown(false); }}
                >
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                    <div className="bp-ride-icon-wrap" style={{ background: active ? '#DCFCE7' : '#F3F4F6' }}>
                      <IconComp size={16} color={active ? T.accent : '#D1D5DB'}/>
                    </div>
                    {active && (
                      <div style={{ width:18, height:18, borderRadius:'50%', background:T.accent, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                          <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="bp-ride-name">{ride.label}</div>
                  <div className="bp-ride-desc">{ride.desc}</div>
                  <div className="bp-ride-price">${Number(ride.total).toFixed(2)}</div>
                  <div className="bp-ride-meta">
                    <span className={`bp-ride-tag${isStaleEta ? ' stale' : ''}`}>
                      <Clock size={10}/>{ride.eta}
                    </span>
                    <span className="bp-ride-tag"><Users size={10}/>{ride.capacity}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Fare + Book card ── */}
      {hasQuote && (
        <div className="bp-fadeup">
          <div className="bp-fare-card" style={{ marginBottom:12 }}>
            <div className="bp-fare-top">
              <div>
                <div className="bp-fare-label">Estimated Fare</div>
                <div className="bp-fare-amount">${selectedQuote.total}</div>
                <div className="bp-fare-sub">
                  {tripData.miles} mi · ~{tripData.durationMin} min
                  {selectedQuote.eta && (
                    <span style={{
                      marginLeft: 8,
                      color: driverInfo?.stale ? '#9CA3AF' : T.accent,
                      fontWeight: 700,
                    }}>
                      · {selectedQuote.eta} pickup
                    </span>
                  )}
                </div>
                <button className="bp-breakdown-toggle" onClick={() => setShowBreakdown(s => !s)}>
                  {showBreakdown ? '▲ Hide breakdown' : '▼ How is this calculated?'}
                </button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0 }}>
                <div style={{ display:'inline-flex', alignItems:'center', gap:5, background:'#fff', border:'1.5px solid #BBF7D0', borderRadius:100, padding:'5px 12px', fontSize:11, fontWeight:800, color:T.accent, letterSpacing:'.8px', textTransform:'uppercase', fontFamily:'Outfit,sans-serif' }}>
                  {selectedQuote.label}
                </div>
                <div style={{ fontSize:11, color:'#6B7280', fontWeight:500 }}>distance-based</div>
              </div>
            </div>
            {showBreakdown && <BreakdownLines quote={selectedQuote} tripData={tripData}/>}
          </div>

          <button className="bp-book-btn" onClick={handleBookNow}>
            Book Now · ${selectedQuote.total}
            <ChevronRight size={16}/>
          </button>
        </div>
      )}
    </>
  );
}
