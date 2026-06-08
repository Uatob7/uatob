// src/App/BookingPanel.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Navigation, Clock, Car, Users, Zap,
  ChevronRight, Loader2, AlertCircle, LocateFixed, MapPin, X,
} from 'lucide-react';
import { useAutocomplete } from '@/App/UaTob/useAutocomplete';
import { useRoute }        from '@/App/UaTob/useRoute';
import { useQuotes }       from '@/App/UaTob/useQuotes';
import { useGeo }          from '@/App/UaTob/useGeo';

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
  amber:        '#D97706',
  amberBg:      '#FFFBEB',
  amberBorder:  '#FDE68A',
};

// ── localStorage ──────────────────────────────────────────────────────
const LS_KEY = 'uatob_booking_form';
function saveBookingForm(data)  { try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (_) {} }
function loadBookingForm()      { try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch (_) { return null; } }
function clearBookingForm()     { try { localStorage.removeItem(LS_KEY); } catch (_) {} }

// ── Helpers ───────────────────────────────────────────────────────────
function safeNum(val, fallback = 0) { const n = Number(val); return Number.isFinite(n) ? n : fallback; }
function getRideIcon(rideId) {
  if (rideId === 'premium') return Zap;
  if (rideId === 'xl')      return Users;
  return Car;
}

// ── CSS (unchanged) ───────────────────────────────────────────────────
const PANEL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');

  @keyframes bp-spin    { to { transform: rotate(360deg) } }
  @keyframes bp-fadeUp  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes bp-alertIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes bp-pulse   { 0%,100%{box-shadow:0 0 0 0 rgba(22,163,74,.25)} 50%{box-shadow:0 0 0 6px rgba(22,163,74,0)} }
  @keyframes bp-dotPulse { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }

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
  .bp-ride-tag.unavail { color:${T.amber}; font-weight:700; }
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

  .bp-driver-banner { display:flex; align-items:center; gap:10px; padding:10px 14px; border-top:1px solid #F3F4F6; background:#FAFAFA; }
  .bp-driver-banner.unavail { background:${T.amberBg}; border-top-color:${T.amberBorder}; }
  .bp-driver-dot { width:7px; height:7px; border-radius:50%; background:#16A34A; flex-shrink:0; animation:bp-dotPulse 1.6s ease-in-out infinite; }
  .bp-driver-dot.stale { background:#9CA3AF; animation:none; }
  .bp-driver-dot.unavail { background:${T.amber}; animation:none; }
  .bp-driver-text { font-size:11.5px; font-weight:700; color:#374151; font-family:'Outfit',sans-serif; }
  .bp-driver-text.stale { color:#9CA3AF; }
  .bp-driver-text.unavail { color:${T.amber}; }
  .bp-driver-sub { font-size:10.5px; font-weight:500; color:#9CA3AF; font-family:'Outfit',sans-serif; margin-left:auto; }
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
  if (!driverInfo) {
    return (
      <div className="bp-driver-banner unavail">
        <div className="bp-driver-dot unavail"/>
        <span className="bp-driver-text unavail">Drivers limited in your area</span>
        <span className="bp-driver-sub">we'll keep searching</span>
      </div>
    );
  }
  const stale = driverInfo.stale;
  const count = driverInfo.driverCount ?? 1;
  const miles = driverInfo.nearestMiles;
  return (
    <div className="bp-driver-banner">
      <div className={`bp-driver-dot${stale ? ' stale' : ''}`}/>
      <span className={`bp-driver-text${stale ? ' stale' : ''}`}>
        {stale
          ? `${count} driver nearby · estimated location`
          : `${count} driver${count !== 1 ? 's' : ''} nearby`}
      </span>
      {miles != null && <span className="bp-driver-sub">{miles} mi away</span>}
    </div>
  );
}

// ── PlaceInput ────────────────────────────────────────────────────────
function PlaceInput({ isPickup, placeholder, value, onChange, onLocationRequest, isFocused, onFocus, onBlur }) {
  const { predictions, fetch: fetchSuggestions, clear: clearSuggestions } = useAutocomplete(250);
  const [ghostText,   setGhostText]   = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        clearSuggestions(); setGhostText('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [clearSuggestions]);

  function handleChange(e) {
    const val = e.target.value;
    onChange(val);
    setActiveIndex(-1);
    fetchSuggestions(val);
    // Ghost text: re-derive after predictions update (see effect below)
  }

  // Derive ghost text whenever predictions change
  useEffect(() => {
    const first = predictions[0]?.description || '';
    setGhostText(
      first.toLowerCase().startsWith(value.toLowerCase()) && value.length > 0
        ? first.slice(value.length)
        : ''
    );
  }, [predictions, value]);

  function handleSelect(desc) {
    onChange(desc); clearSuggestions(); setGhostText(''); setActiveIndex(-1);
  }

  function handleKeyDown(e) {
    if ((e.key === 'Tab' || e.key === 'ArrowRight') && ghostText && activeIndex === -1) {
      e.preventDefault(); handleSelect(value + ghostText); return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, predictions.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, -1)); }
    if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); handleSelect(predictions[activeIndex].description); }
    if (e.key === 'Escape') { clearSuggestions(); setGhostText(''); }
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
        <button type="button" className="bp-clear-btn"
          onClick={() => { onChange(''); clearSuggestions(); setGhostText(''); }}>
          <X size={11}/>
        </button>
      )}

      {predictions.length > 0 && (
        <div className="bp-dropdown">
          {predictions.map((s, i) => {
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

// ── buildPayload helper ───────────────────────────────────────────────
function buildPayload(trip, quote, quotes, rideId) {
  return {
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
  };
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────
export default function BookingPanel({ onBookNow, onPayloadChange, onPriceReady, onCancel }) {
  const saved = useMemo(() => loadBookingForm(), []);

  const [pickup,       setPickupRaw]    = useState(saved?.pickup       ?? '');
  const [dropoff,      setDropoffRaw]   = useState(saved?.dropoff      ?? '');
  const [selectedRide, setSelectedRide] = useState(saved?.selectedRide ?? 'standard');
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [focusedInput,  setFocusedInput]  = useState(null);

  // Location alert UI state
  const [showLocationAlert, setShowLocationAlert] = useState(false);

  // ── Hooks ──────────────────────────────────────────────────────────
  const { tripData,   loading: loadingTrip,   error: routeError,  reset: resetRoute  } = useRoute(pickup, dropoff);
  const { quotesData, loading: loadingQuotes, error: quotesError, reset: resetQuotes } = useQuotes(tripData);
  const { resolve: resolveGeo, loading: geoLoading, error: geoError, clear: clearGeoError } = useGeo();

  const error     = routeError || quotesError;
  const isLoading = loadingTrip || loadingQuotes;

  // ── Persist form ───────────────────────────────────────────────────
  function setPickup(val)  { setPickupRaw(val);  saveBookingForm({ pickup: val, dropoff,      selectedRide }); }
  function setDropoff(val) { setDropoffRaw(val); saveBookingForm({ pickup,      dropoff: val, selectedRide }); }

  useEffect(() => {
    if (!pickup && !dropoff) clearBookingForm();
  }, [pickup, dropoff]);

  // ── Derived ────────────────────────────────────────────────────────
  const rideOptions = useMemo(() => Object.values(quotesData?.rides || {}), [quotesData]);

  // If the currently-selected ride type doesn't exist in the new quotes, fall back to first available
  const resolvedRideId = useMemo(() => {
    if (!quotesData) return selectedRide;
    return quotesData.rides?.[selectedRide] ? selectedRide : (Object.keys(quotesData.rides || {})[0] ?? selectedRide);
  }, [quotesData, selectedRide]);

  const selectedQuote = useMemo(() => quotesData?.rides?.[resolvedRideId] || null, [quotesData, resolvedRideId]);
  const driverInfo    = useMemo(() => quotesData?.driverInfo ?? null, [quotesData]);

  const hasQuote = !!tripData && !!quotesData && !!selectedQuote && !error && !isLoading;

  const selectedEta        = selectedQuote?.eta ?? null;
  const isStaleEtaSelected = typeof selectedEta === 'string' && selectedEta.startsWith('~');
  const etaUnavailable     = selectedEta == null;

  // ── Notify parent of payload changes ──────────────────────────────
  const onPayloadChangeRef = useRef(onPayloadChange);
  const onPriceReadyRef    = useRef(onPriceReady);
  const priceReadyFiredRef = useRef(false);
  useEffect(() => { onPayloadChangeRef.current = onPayloadChange; }, [onPayloadChange]);
  useEffect(() => { onPriceReadyRef.current    = onPriceReady;    }, [onPriceReady]);

  useEffect(() => {
    if (!hasQuote || !selectedQuote) return;
    onPayloadChangeRef.current?.(buildPayload(tripData, selectedQuote, quotesData, resolvedRideId));
    if (!priceReadyFiredRef.current) {
      priceReadyFiredRef.current = true;
      onPriceReadyRef.current?.();
    }
  }, [hasQuote, selectedQuote, quotesData, tripData, resolvedRideId]);

  // Reset priceReady flag when trip clears
  useEffect(() => {
    if (!tripData) priceReadyFiredRef.current = false;
  }, [tripData]);

  // ── Geo handler ────────────────────────────────────────────────────
  const handleLocationAllow = useCallback(async () => {
    try {
      const address = await resolveGeo();
      setPickup(address);
      setShowLocationAlert(false);
    } catch {
      // geoError is already set inside useGeo; LocationAlert will display it
    }
  }, [resolveGeo]);

  const handleLocationDeny = useCallback(() => {
    setShowLocationAlert(false);
    clearGeoError();
  }, [clearGeoError]);

  // ── Cancel / reset ─────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    clearBookingForm();
    setPickupRaw(''); setDropoffRaw('');
    resetRoute(); resetQuotes();
    setShowBreakdown(false);
    setShowLocationAlert(false);
    clearGeoError();
    priceReadyFiredRef.current = false;
    onCancel?.();
  }, [resetRoute, resetQuotes, clearGeoError, onCancel]);

  // ── Book now ───────────────────────────────────────────────────────
  const handleBookNow = useCallback(() => {
    if (!tripData || !quotesData || !selectedQuote) return;
    const payload = buildPayload(tripData, selectedQuote, quotesData, resolvedRideId);
    clearBookingForm();
    onBookNow?.(payload);
  }, [tripData, quotesData, selectedQuote, resolvedRideId, onBookNow]);

  const showCancelBtn = !!(pickup.trim() || dropoff.trim());

  return (
    <>
      <style>{PANEL_CSS}</style>

      {(showLocationAlert || geoLoading || geoError) && (
        <LocationAlert
          onAllow={handleLocationAllow}
          onDeny={handleLocationDeny}
          loading={geoLoading}
          error={geoError}
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
            onLocationRequest={() => { clearGeoError(); setShowLocationAlert(true); }}
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
            <DriverBanner driverInfo={driverInfo}/>
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
            {!driverInfo && (
              <span style={{ fontSize:10.5, fontWeight:700, color:T.amber, fontFamily:'Outfit,sans-serif' }}>⚠ Drivers limited</span>
            )}
            {driverInfo?.stale && (
              <span style={{ fontSize:10.5, fontWeight:700, color:'#9CA3AF', fontFamily:'Outfit,sans-serif' }}>⚠ Estimated wait times</span>
            )}
          </div>
          <div className="bp-ride-grid" style={{ marginTop:10 }}>
            {rideOptions.map((ride) => {
              const active     = resolvedRideId === ride.id;
              const IconComp   = getRideIcon(ride.id);
              const etaUnavail = ride.eta == null;
              const isStaleEta = typeof ride.eta === 'string' && ride.eta.startsWith('~');
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
                    {etaUnavail ? (
                      <span className="bp-ride-tag unavail"><AlertCircle size={10}/>No ETA</span>
                    ) : (
                      <span className={`bp-ride-tag${isStaleEta ? ' stale' : ''}`}><Clock size={10}/>{ride.eta}</span>
                    )}
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
                  {etaUnavailable ? (
                    <span style={{ marginLeft:8, color:T.amber, fontWeight:700 }}>· drivers limited</span>
                  ) : (
                    <span style={{ marginLeft:8, color: isStaleEtaSelected ? '#9CA3AF' : T.accent, fontWeight:700 }}>
                      · {selectedEta} pickup
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
            Request Ride · ${selectedQuote.total}
            <ChevronRight size={16}/>
          </button>
        </div>
      )}
    </>
  );
}
