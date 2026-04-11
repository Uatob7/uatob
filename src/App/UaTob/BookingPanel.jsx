// src/App/BookingPanel.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  MapPin, Navigation, Clock, Car, Users, Zap,
  ChevronRight, Loader2, AlertCircle, LocateFixed, X,
} from 'lucide-react';
import { useAuthContext } from '@/context/AuthContext';

const T = {
  accent:       '#16A34A',
  accentBorder: '#86EFAC',
  text:         '#111827',
  textMuted:    '#6B7280',
  border:       '#E5E7EB',
  surfaceAlt:   '#F9FAFB',
  ink:          '#111827',
};

const ROUTE_URL        = 'https://atob-ady2s2xhhq-uc.a.run.app';
const PRICE_URL        = 'https://price-ady2s2xhhq-uc.a.run.app';
const AUTOCOMPLETE_URL = 'https://autocomplete-ady2s2xhhq-uc.a.run.app';
const REVERSE_GEO_URL  = 'https://geo-ady2s2xhhq-uc.a.run.app';

const LS_BOOKING_KEY = 'uatob_booking_form';
function saveBookingForm(data)  { try { localStorage.setItem(LS_BOOKING_KEY, JSON.stringify(data)); } catch (_) {} }
function loadBookingForm()      { try { const r = localStorage.getItem(LS_BOOKING_KEY); return r ? JSON.parse(r) : null; } catch (_) { return null; } }
function clearBookingForm()     { try { localStorage.removeItem(LS_BOOKING_KEY); } catch (_) {} }

function safeNum(val, fallback = 0) { const n = Number(val); return Number.isFinite(n) ? n : fallback; }
function round2(val) { return Number(safeNum(val).toFixed(2)); }
function getRideIcon(rideId) {
  if (rideId === 'premium') return Zap;
  if (rideId === 'xl')      return Users;
  return Car;
}

async function fetchTripData(pickup, dropoff) {
  const res  = await fetch(ROUTE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origin: pickup, destination: dropoff }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Route error ${res.status}`);

  // ✅ Prefer duration_minutes (new ATOB), fall back to parsing duration_text (old)
  let durationMin = 0;
  if (data.duration_minutes) {
    durationMin = data.duration_minutes;
  } else if (data.duration_text) {
    const h = (data.duration_text.match(/(\d+)\s*hour/) || [])[1] | 0;
    const m = (data.duration_text.match(/(\d+)\s*min/)  || [])[1] | 0;
    durationMin = h * 60 + m;
  }

  return {
    pickup,
    dropoff,
    miles:        round2(data.distance_miles ?? 0),
    durationMin:  Math.max(1, durationMin),
    durationText: data.duration_text ?? `${durationMin} min`,
    pickupCity:   data.pickupCity  ?? '',
    pickupZip:    data.pickupZip   ?? '',
    pickupLat:    data.pickupLat   ?? null,
    pickupLng:    data.pickupLng   ?? null,
    dropoffCity:  data.dropoffCity ?? '',
    dropoffZip:   data.dropoffZip  ?? '',
    dropoffLat:   data.dropoffLat  ?? null,
    dropoffLng:   data.dropoffLng  ?? null,
  };
}

async function fetchQuotesData(tripData) {
  const res  = await fetch(PRICE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tripData) });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `Pricing error ${res.status}`);

  // ✅ Normalize all totals to 2 decimal places (e.g. 12.8 → "12.80")
  if (data.rides) {
    Object.values(data.rides).forEach(ride => {
      ride.total = Number(ride.total).toFixed(2);
    });
  }

  return data;
}

async function reverseGeocode(lat, lng) {
  const res  = await fetch(REVERSE_GEO_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat, lng }) });
  const data = await res.json();
  if (!res.ok || !data.address) throw new Error(data.error || 'Could not find your address.');
  return { address: data.address };
}

function LocationAlert({ onAllow, onDeny, loading, error }) {
  return (
    <div style={{ borderRadius: '14px', border: `1.5px solid ${error ? '#FECACA' : '#BBF7D0'}`, background: error ? '#FEF2F2' : 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', padding: '14px 16px', marginBottom: '16px', animation: 'alertIn .2s ease' }}>
      <style>{`
        @keyframes alertIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin     { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
      `}</style>
      {error ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <AlertCircle size={15} color="#DC2626" style={{ flexShrink: 0, marginTop: '1px' }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '13px', color: '#DC2626', fontWeight: 600, margin: '0 0 10px' }}>{error}</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={onAllow} style={{ flex: 1, padding: '8px 12px', borderRadius: '10px', border: 'none', background: '#DC2626', color: '#fff', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>Try again</button>
              <button onClick={onDeny}  style={{ flex: 1, padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #FECACA', background: '#fff', color: '#DC2626', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>Dismiss</button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '38px', height: '38px', flexShrink: 0, background: '#fff', border: '1.5px solid #BBF7D0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {loading
              ? <Loader2 size={16} color={T.accent} style={{ animation: 'spin 1s linear infinite' }} />
              : <LocateFixed size={16} color={T.accent} />
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: T.text, margin: '0 0 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {loading ? 'Getting your location…' : 'Use your current location?'}
            </p>
            {!loading && <p style={{ fontSize: '11.5px', color: T.textMuted, fontWeight: 500, margin: 0 }}>Auto-fill your pickup address</p>}
          </div>
          {!loading && (
            <div style={{ display: 'flex', gap: '7px', flexShrink: 0 }}>
              <button onClick={onAllow} style={{ padding: '7px 13px', borderRadius: '10px', border: 'none', background: T.accent, color: '#fff', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif', boxShadow: '0 3px 10px rgba(22,163,74,.3)' }}>Allow</button>
              <button onClick={onDeny}  title="Dismiss" style={{ width: '32px', height: '32px', borderRadius: '10px', border: `1.5px solid ${T.border}`, background: '#fff', color: T.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlaceInput({ label, icon: Icon, iconColor, placeholder, value, onChange, onLocationRequest }) {
  const [suggestions, setSuggestions] = useState([]);
  const [ghostText,   setGhostText]   = useState('');
  const [focused,     setFocused]     = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef     = useRef(null);
  const debounceRef = useRef(null);
  const isPickup    = label === 'Pickup (A)';

  useEffect(() => {
    function handler(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) { setFocused(false); setSuggestions([]); setGhostText(''); } }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function fetchSuggestions(query) {
    if (!query || query.length < 2) { setSuggestions([]); setGhostText(''); return; }
    try {
      const res   = await fetch(AUTOCOMPLETE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: query }) });
      const data  = await res.json();
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

  function handleSelect(desc) { onChange(desc); setSuggestions([]); setGhostText(''); setFocused(false); setActiveIndex(-1); }

  function handleKeyDown(e) {
    if ((e.key === 'Tab' || e.key === 'ArrowRight') && ghostText && activeIndex === -1) { e.preventDefault(); handleSelect(value + ghostText); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, suggestions.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, -1)); }
    if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); handleSelect(suggestions[activeIndex].description); }
    if (e.key === 'Escape') { setSuggestions([]); setGhostText(''); }
  }

  return (
    <div ref={wrapRef}>
      <div className="lbl">{label}</div>
      <div style={{ position: 'relative' }}>
        {isPickup && onLocationRequest ? (
          <button type="button" onClick={onLocationRequest} title="Use my current location"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 3, background: 'none', border: 'none', padding: '4px', cursor: 'pointer', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#ECFDF5'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <Icon size={17} color={iconColor} />
          </button>
        ) : (
          <Icon size={17} color={iconColor} style={{ position: 'absolute', left: 17, top: '50%', transform: 'translateY(-50%)', zIndex: 3, pointerEvents: 'none' }} />
        )}

        {ghostText && focused && (
          <div style={{ position: 'absolute', inset: 0, padding: '0 16px 0 46px', display: 'flex', alignItems: 'center', fontSize: 14, pointerEvents: 'none', zIndex: 1, whiteSpace: 'nowrap', overflow: 'hidden' }}>
            <span style={{ color: 'transparent' }}>{value}</span>
            <span style={{ color: T.textMuted, opacity: 0.45 }}>{ghostText}</span>
          </div>
        )}

        <input type="text" className="field" placeholder={placeholder} value={value}
          onChange={handleChange} onFocus={() => setFocused(true)} onKeyDown={handleKeyDown}
          autoComplete="off" style={{ position: 'relative', zIndex: 2, background: 'transparent' }}
        />

        {focused && suggestions.length > 0 && (
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#fff', border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: '0 8px 28px rgba(0,0,0,.1)', zIndex: 100, overflow: 'hidden' }}>
            {suggestions.map((s, i) => {
              const main      = s.structured_formatting?.main_text || s.description;
              const secondary = s.structured_formatting?.secondary_text || '';
              const isActive  = i === activeIndex;
              return (
                <div key={s.place_id} onMouseDown={() => handleSelect(s.description)} onMouseEnter={() => setActiveIndex(i)}
                  style={{ padding: '10px 16px', cursor: 'pointer', background: isActive ? T.surfaceAlt : 'transparent', borderBottom: i < suggestions.length - 1 ? `1px solid ${T.border}` : 'none', display: 'flex', alignItems: 'flex-start', gap: 10, transition: 'background .12s' }}
                >
                  <MapPin size={13} color={T.textMuted} style={{ marginTop: 3, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{main}</div>
                    {secondary && <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 1 }}>{secondary}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function BreakdownLines({ quote, tripData }) {
  const receipt = quote?.receipt;
  const bd      = quote?.breakdown || {};
  const meta    = quote?.meta      || {};

  if (Array.isArray(receipt) && receipt.length > 0) {
    const chargeLines = receipt.filter(l => l.key !== 'minimumFareNote');
    const noteLines   = receipt.filter(l => l.key === 'minimumFareNote');

    return (
      <div style={{ borderTop: `1px solid ${T.accentBorder}`, paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
        {chargeLines.map((line, i) => (
          <div key={line.key ?? i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <span style={{ fontSize: '12.5px', color: T.text, fontWeight: 600 }}>{line.label}</span>
              {line.note && <span style={{ fontSize: '11px', color: T.textMuted, fontWeight: 500 }}>{line.note}</span>}
            </div>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '13px', fontWeight: 700, color: T.text }}>
              +${Number(line.amount || 0).toFixed(2)}
            </span>
          </div>
        ))}
        {noteLines.map((line, i) => (
          <div key={`note-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(22,163,74,.07)', border: '1px solid rgba(22,163,74,.18)', borderRadius: '8px', padding: '7px 10px' }}>
            <Zap size={11} color={T.accent} />
            <span style={{ fontSize: '11.5px', color: T.accent, fontWeight: 700 }}>{line.note || line.label}</span>
          </div>
        ))}
        <div style={{ borderTop: `1px dashed ${T.accentBorder}`, paddingTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: T.text }}>Total</span>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '15px', fontWeight: 700, color: T.accent }}>${quote.total}</span>
        </div>
      </div>
    );
  }

  const rows = [
    { label: 'Base fee',                                                                     val: bd.base },
    { label: `Distance (${tripData?.miles} mi × $${meta.perMile || 0}/mi)`,                 val: bd.distance },
    { label: `Time (~${tripData?.durationMin} min × $${meta.perMin || 0}/min)`,             val: bd.time },
    { label: 'Booking fee',                                                                  val: bd.bookingFee },
    ...(safeNum(bd.surge, 0) > 0 ? [{ label: 'Surge', val: bd.surge, highlight: true }] : []),
  ].filter(r => r.val != null);

  return (
    <div style={{ borderTop: `1px solid ${T.accentBorder}`, paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12.5px', color: row.highlight ? T.accent : T.text, fontWeight: 600 }}>{row.label}</span>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '13px', fontWeight: 700, color: row.highlight ? T.accent : T.text }}>+${Number(row.val || 0).toFixed(2)}</span>
        </div>
      ))}
      <div style={{ borderTop: `1px dashed ${T.accentBorder}`, paddingTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '13px', fontWeight: 800, color: T.text }}>Total</span>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '15px', fontWeight: 700, color: T.accent }}>${quote.total}</span>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────
export default function BookingPanel({ onBookNow, onPayloadChange }) {
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

  const [showLocationAlert, setShowLocationAlert] = useState(false);
  const [locationLoading,   setLocationLoading]   = useState(false);
  const [locationError,     setLocationError]     = useState('');

  const tripRequestRef  = useRef(0);
  const quoteRequestRef = useRef(0);

  const lastFetchedTripRef = useRef(saved?.tripData ? `${saved.tripData.pickup}||${saved.tripData.dropoff}` : '');

  function setPickup(val)  { setPickupRaw(val);  saveBookingForm({ pickup: val, dropoff,      selectedRide, tripData, quotesData }); }
  function setDropoff(val) { setDropoffRaw(val); saveBookingForm({ pickup,      dropoff: val, selectedRide, tripData, quotesData }); }

  useEffect(() => {
    if (pickup || dropoff) saveBookingForm({ pickup, dropoff, selectedRide, tripData, quotesData });
    else clearBookingForm();
  }, [pickup, dropoff, selectedRide, tripData, quotesData]);

  const buildPayload = useCallback((trip, quote, quotes) => ({
    pickup:            trip.pickup,
    dropoff:           trip.dropoff,
    pickupCity:        trip.pickupCity  || '',
    pickupZip:         trip.pickupZip   || '',
    pickupLat:         trip.pickupLat   ?? null,
    pickupLng:         trip.pickupLng   ?? null,
    dropoffCity:       trip.dropoffCity || '',
    dropoffZip:        trip.dropoffZip  || '',
    dropoffLat:        trip.dropoffLat  ?? null,
    dropoffLng:        trip.dropoffLng  ?? null,
    miles:             trip.miles,
    durationMin:       trip.durationMin,
    durationText:      trip.durationText,
    tripDistanceMiles: trip.miles,
    tripDurationMin:   trip.durationMin,
    rideType:          selectedRide,
    rideLabel:         quote.label,
    fareEstimate:      quote.total,
    breakdown:         quote.breakdown || {},
    receipt:           quote.receipt   || [],
    allQuotes:         quotes.rides    || {},
    status:            'searching_driver',
    createdAt:         new Date().toISOString(),
  }), [selectedRide]);

  useEffect(() => {
    if (!tripData || !quotesData) return;
    const quote = quotesData?.rides?.[selectedRide];
    if (!quote) return;
    if (typeof onPayloadChange !== 'function') return;
    onPayloadChange(buildPayload(tripData, quote, quotesData));
  }, [selectedRide, quotesData, tripData, buildPayload, onPayloadChange]);

  const handleLocationAllow = useCallback(async () => {
    setLocationError('');
    setLocationLoading(true);
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
      );
      const geo = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      setPickup(geo.address);
      setShowLocationAlert(false);
      setLocationError('');
    } catch (err) {
      if (err.code === 1) setLocationError('Location access was denied. Please allow it in your browser settings.');
      else if (err.code === 2) setLocationError('Could not detect your location. Try again or enter manually.');
      else if (err.code === 3) setLocationError('Location request timed out. Please try again.');
      else setLocationError(err.message || 'Could not get your location.');
    } finally {
      setLocationLoading(false);
    }
  }, []);

  const handleLocationDeny = useCallback(() => {
    setShowLocationAlert(false);
    setLocationError('');
  }, []);

  // ── STEP 1: TRIP DATA ──────────────────────────────────
  useEffect(() => {
    const p = pickup.trim(), d = dropoff.trim();
    if (!p || !d) {
      setTripData(null); setQuotesData(null); setError('');
      setLoadingTrip(false); setLoadingQuotes(false); setShowBreakdown(false);
      lastFetchedTripRef.current = '';
      return;
    }

    const key = `${p}||${d}`;
    if (lastFetchedTripRef.current === key && tripData && quotesData) return;

    const requestId = ++tripRequestRef.current;
    const timeout = setTimeout(async () => {
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
    return () => clearTimeout(timeout);
  }, [pickup, dropoff]);

  // ── STEP 2: PRICES ─────────────────────────────────────
  useEffect(() => {
    if (!tripData) return;
    if (quotesData) return;

    const requestId = ++quoteRequestRef.current;
    async function loadQuotes() {
      try {
        setLoadingQuotes(true); setError('');
        const quotes = await fetchQuotesData(tripData);
        if (quoteRequestRef.current !== requestId) return;
        setQuotesData(quotes);
        const keys = Object.keys(quotes?.rides || {});
        if (keys.length && !quotes.rides[selectedRide]) setSelectedRide(keys[0]);
      } catch (err) {
        if (quoteRequestRef.current !== requestId) return;
        setError(err.message || 'Failed to calculate prices');
        setQuotesData(null);
      } finally {
        if (quoteRequestRef.current === requestId) setLoadingQuotes(false);
      }
    }
    loadQuotes();
  }, [tripData]);

  const rideOptions   = useMemo(() => Object.values(quotesData?.rides || {}), [quotesData]);
  const selectedQuote = useMemo(() => quotesData?.rides?.[selectedRide] || null, [quotesData, selectedRide]);

  const handleBookNow = useCallback(() => {
    if (!tripData || !quotesData || !selectedQuote) return;
    const payload = buildPayload(tripData, selectedQuote, quotesData);
    clearBookingForm();
    if (typeof onBookNow === 'function') onBookNow(payload);
  }, [tripData, quotesData, selectedQuote, buildPayload, onBookNow]);

  const isLoading = loadingTrip || loadingQuotes;
  const hasQuote  = !!tripData && !!quotesData && !!selectedQuote && !error && !isLoading;

  return (
    <>
      <style>{`@keyframes spin { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }`}</style>

      <div className="glass" style={{ padding: '26px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px', color: T.text, marginBottom: '20px' }}>Book a Ride</h2>

        {(showLocationAlert || locationLoading || locationError) && (
          <LocationAlert
            onAllow={handleLocationAllow}
            onDeny={handleLocationDeny}
            loading={locationLoading}
            error={locationError}
          />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          <PlaceInput
            label="Pickup (A)" icon={MapPin} iconColor={T.accent}
            placeholder="Enter pickup address…" value={pickup} onChange={setPickup}
            onLocationRequest={() => { setLocationError(''); setShowLocationAlert(true); }}
          />
          <PlaceInput label="Drop-off (B)" icon={Navigation} iconColor={T.ink} placeholder="Enter destination…" value={dropoff} onChange={setDropoff} />
        </div>

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 0', color: T.textMuted, fontSize: '13.5px', fontWeight: 500 }}>
            <Loader2 size={16} color={T.accent} style={{ animation: 'spin 1s linear infinite' }} />
            {loadingTrip ? 'Calculating route…' : 'Calculating prices…'}
          </div>
        )}

        {error && !isLoading && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '14px', padding: '14px 16px', marginBottom: '16px' }}>
            <AlertCircle size={15} color="#DC2626" style={{ flexShrink: 0, marginTop: '1px' }} />
            <span style={{ fontSize: '13px', color: '#DC2626', fontWeight: 600 }}>{error}</span>
          </div>
        )}

        {tripData && quotesData && rideOptions.length > 0 && (
          <div style={{ marginBottom: '18px' }}>
            <div className="lbl">Choose Ride</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {rideOptions.map((ride) => {
                const active   = selectedRide === ride.id;
                const IconComp = getRideIcon(ride.id);
                return (
                  <div key={ride.id} className={`ride-card ${active ? 'active' : ''}`}
                    onClick={() => { setSelectedRide(ride.id); setShowBreakdown(false); }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ width: '32px', height: '32px', background: active ? '#ECFDF5' : '#F3F4F6', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: active ? `1px solid ${T.accent}40` : '1px solid transparent', transition: 'all .3s' }}>
                        <IconComp size={16} color={active ? T.accent : '#D1D5DB'} />
                      </div>
                      <div
  style={{
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '16px',
    fontWeight: 700,
    color: active ? T.accent : T.text
  }}
>
  ${Number(ride.total).toFixed(2)}
</div>
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: 800, color: T.text, marginBottom: '2px' }}>{ride.label}</div>
                    <div style={{ fontSize: '11px', color: T.textMuted, marginBottom: '8px' }}>{ride.desc}</div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: T.textMuted, fontWeight: 600 }}><Clock size={10} />{ride.eta}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: T.textMuted, fontWeight: 600 }}><Users size={10} />{ride.capacity}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {hasQuote && (
          <>
            <div style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: '18px', padding: '18px', marginBottom: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: T.text, marginBottom: '14px' }}>Trip Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '10px' }}>
                <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: '13px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '20px', fontWeight: 700, color: T.accent }}>{tripData.miles} mi</div>
                  <div style={{ fontSize: '11px', color: T.textMuted, fontWeight: 700 }}>DISTANCE</div>
                </div>
                <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: '13px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '20px', fontWeight: 700, color: T.accent }}>{tripData.durationMin} min</div>
                  <div style={{ fontSize: '11px', color: T.textMuted, fontWeight: 700 }}>DURATION</div>
                </div>
              </div>
            </div>

            <div style={{ background: 'linear-gradient(135deg,#F0FDF4 0%,#DCFCE7 100%)', border: `1.5px solid ${T.accentBorder}`, borderRadius: '18px', padding: '18px 22px', marginBottom: '16px', boxShadow: '0 4px 18px rgba(22,163,74,.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showBreakdown ? '16px' : '0' }}>
                <div>
                  <div className="lbl">Estimated Fare</div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: T.textMuted, fontWeight: 500 }}>{tripData.miles} mi · ~{tripData.durationMin} min</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '34px', fontWeight: 700, letterSpacing: '-1.5px', color: T.accent, lineHeight: 1 }}>${selectedQuote.total}</div>
                  <button type="button" onClick={() => setShowBreakdown(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: T.accent, fontWeight: 700, marginTop: '4px', fontFamily: 'Outfit,sans-serif', padding: 0 }}>
                    {showBreakdown ? '▲ Hide' : '▼ How is this calculated?'}
                  </button>
                </div>
              </div>

              {showBreakdown && (
                <BreakdownLines quote={selectedQuote} tripData={tripData} />
              )}
            </div>

            <button className="cta-btn" onClick={handleBookNow}>
              Book Now · ${selectedQuote.total}
              <ChevronRight size={17} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '4px' }} />
            </button>
          </>
        )}

        {!pickup.trim() && !dropoff.trim() && (
          <div style={{ textAlign: 'center', padding: '14px 0', color: T.textMuted, fontSize: '13.5px', fontWeight: 500 }}>
            Enter pickup and destination
          </div>
        )}
      </div>
    </>
  );
}