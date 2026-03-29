import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  MapPin,
  Navigation,
  Clock,
  Car,
  Users,
  Zap,
  ChevronRight,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useAuthContext } from '@/context/AuthContext';

// ── THEME ────────────────────────────────────────────────
const T = {
  accent: '#16A34A',
  accentBorder: '#86EFAC',
  text: '#111827',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  surfaceAlt: '#F9FAFB',
  ink: '#111827',
};

// ── CLOUD FUNCTION URLS ──────────────────────────────────
const ROUTE_URL         = 'https://atob-ady2s2xhhq-uc.a.run.app';
const PRICE_URL         = 'https://price-ady2s2xhhq-uc.a.run.app';
const AUTOCOMPLETE_URL  = 'https://autocomplete-ady2s2xhhq-uc.a.run.app';

// ── HELPERS ──────────────────────────────────────────────
function safeNum(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function round2(val) {
  return Number(safeNum(val).toFixed(2));
}

function getRideIcon(rideId) {
  if (rideId === 'premium') return Zap;
  if (rideId === 'xl') return Users;
  return Car;
}
// ── FETCH ROUTE DATA ─────────────────────────────────────
async function fetchTripData(pickup, dropoff) {
  const res = await fetch(ROUTE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin: pickup, destination: dropoff }),
  });

  const data = await res.json();
  console.log(data);

  if (!res.ok) throw new Error(data.error || `Route error ${res.status}`);

  // Parse duration_text into minutes
  let durationMin = 0;
  if (data.duration_text) {
    const hoursMatch = data.duration_text.match(/(\d+)\s*hour/);
    const minsMatch  = data.duration_text.match(/(\d+)\s*min/);

    const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
    const mins  = minsMatch ? parseInt(minsMatch[1], 10) : 0;

    durationMin = hours * 60 + mins;
  }

  return {
    pickup,
    dropoff,
    miles: round2(data.distance_miles || 0),
    durationMin: Math.max(1, durationMin), // at least 1 min
    durationText: data.duration_text || '',
  };
}


// ── FETCH ALL PRICES ─────────────────────────────────────
async function fetchQuotesData(tripData) {
  const res = await fetch(PRICE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tripData),
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Pricing error ${res.status}`);
  }

  return data;
}

// ── SUBMIT BOOKING TO BACKEND ────────────────────────────
async function submitBooking(bookingPayload) {
  const BOOKING_URL = 'https://booking-ady2s2xhhq-uc.a.run.app';
  
  const res = await fetch(BOOKING_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bookingPayload),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Booking error ${res.status}`);
  }

  return data;
}


// ── PLACE INPUT COMPONENT ────────────────────────────────
function PlaceInput({ label, icon: Icon, iconColor, placeholder, value, onChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [ghostText, setGhostText]     = useState('');
  const [focused, setFocused]         = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef    = useRef(null);
  const debounceRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setFocused(false);
        setSuggestions([]);
        setGhostText('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function fetchSuggestions(query) {
    if (!query || query.length < 2) {
      setSuggestions([]);
      setGhostText('');
      return;
    }
    try {
      const res = await fetch(AUTOCOMPLETE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: query }),
      });
      const data = await res.json();
      const preds = data.predictions || [];
      setSuggestions(preds);

      // Ghost text from first prediction
      const first = preds[0]?.description || '';
      if (first.toLowerCase().startsWith(query.toLowerCase())) {
        setGhostText(first.slice(query.length));
      } else {
        setGhostText('');
      }
    } catch {
      setSuggestions([]);
      setGhostText('');
    }
  }

  function handleChange(e) {
    const val = e.target.value;
    onChange(val);
    setActiveIndex(-1);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 250);
  }

  function handleSelect(description) {
    onChange(description);
    setSuggestions([]);
    setGhostText('');
    setFocused(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e) {
    // Accept ghost text with Tab or ArrowRight
    if ((e.key === 'Tab' || e.key === 'ArrowRight') && ghostText && activeIndex === -1) {
      e.preventDefault();
      handleSelect(value + ghostText);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1));
    }
    if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex].description);
    }
    if (e.key === 'Escape') {
      setSuggestions([]);
      setGhostText('');
    }
  }

  return (
    <div ref={wrapRef}>
      <div className="lbl">{label}</div>
      <div style={{ position: 'relative' }}>

        {/* Icon */}
        <Icon
          size={17}
          color={iconColor}
          style={{
            position: 'absolute',
            left: 17,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 3,
            pointerEvents: 'none',
          }}
        />

        {/* Ghost text layer */}
        {ghostText && focused && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              padding: '0 16px 0 46px',
              display: 'flex',
              alignItems: 'center',
              fontSize: 14,
              pointerEvents: 'none',
              zIndex: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            <span style={{ color: 'transparent' }}>{value}</span>
            <span style={{ color: T.textMuted, opacity: 0.45 }}>{ghostText}</span>
          </div>
        )}

        <input
          type="text"
          className="field"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          style={{ position: 'relative', zIndex: 2, background: 'transparent' }}
        />

        {/* Suggestions dropdown */}
        {focused && suggestions.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              background: '#fff',
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              boxShadow: '0 8px 28px rgba(0,0,0,.1)',
              zIndex: 100,
              overflow: 'hidden',
            }}
          >
            {suggestions.map((s, i) => {
              const main      = s.structured_formatting?.main_text || s.description;
              const secondary = s.structured_formatting?.secondary_text || '';
              const isActive  = i === activeIndex;
              return (
                <div
                  key={s.place_id}
                  onMouseDown={() => handleSelect(s.description)}
                  onMouseEnter={() => setActiveIndex(i)}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    background: isActive ? T.surfaceAlt : 'transparent',
                    borderBottom: i < suggestions.length - 1 ? `1px solid ${T.border}` : 'none',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    transition: 'background .12s',
                  }}
                >
                  <MapPin size={13} color={T.textMuted} style={{ marginTop: 3, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{main}</div>
                    {secondary && (
                      <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 1 }}>
                        {secondary}
                      </div>
                    )}
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

// ── MAIN COMPONENT ───────────────────────────────────────
export default function BookingPanel({ onBookNow }) {
  const { uid } = useAuthContext();

  const [pickup, setPickup]           = useState('');
  const [dropoff, setDropoff]         = useState('');
  const [selectedRide, setSelectedRide] = useState('standard');

  const [tripData, setTripData]       = useState(null);
  const [quotesData, setQuotesData]   = useState(null);

  const [loadingTrip, setLoadingTrip]     = useState(false);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [error, setError]                 = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);

  const tripRequestRef  = useRef(0);
  const quoteRequestRef = useRef(0);

  // ── STEP 1: GET TRIP DATA ──────────────────────────────
  useEffect(() => {
    const cleanPickup  = pickup.trim();
    const cleanDropoff = dropoff.trim();

    if (!cleanPickup || !cleanDropoff) {
      setTripData(null);
      setQuotesData(null);
      setError('');
      setLoadingTrip(false);
      setLoadingQuotes(false);
      setShowBreakdown(false);
      return;
    }

    const requestId = ++tripRequestRef.current;

    const timeout = setTimeout(async () => {
      try {
        setLoadingTrip(true);
        setLoadingQuotes(false);
        setError('');
        setTripData(null);
        setQuotesData(null);
        setShowBreakdown(false);

        const trip = await fetchTripData(cleanPickup, cleanDropoff);

        if (tripRequestRef.current !== requestId) return;
        setTripData(trip);
      } catch (err) {
        if (tripRequestRef.current !== requestId) return;
        setError(err.message || 'Failed to calculate route');
        setTripData(null);
        setQuotesData(null);
      } finally {
        if (tripRequestRef.current === requestId) setLoadingTrip(false);
      }
    }, 700);

    return () => clearTimeout(timeout);
  }, [pickup, dropoff]);

  // ── STEP 2: GET ALL RIDE PRICES ────────────────────────
  useEffect(() => {
    if (!tripData) return;

    const requestId = ++quoteRequestRef.current;

    async function loadQuotes() {
      try {
        setLoadingQuotes(true);
        setError('');

        const quotes = await fetchQuotesData(tripData);

        if (quoteRequestRef.current !== requestId) return;
        setQuotesData(quotes);

        const rideKeys = Object.keys(quotes?.rides || {});
        if (rideKeys.length && !quotes.rides[selectedRide]) {
          setSelectedRide(rideKeys[0]);
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
  }, [tripData]);

  const rideOptions = useMemo(() => Object.values(quotesData?.rides || {}), [quotesData]);

  const selectedQuote = useMemo(
    () => quotesData?.rides?.[selectedRide] || null,
    [quotesData, selectedRide]
  );

  // ── BOOK NOW (PASS TO PARENT) ──────────────────────────
  const handleBookNow = useCallback(() => {
    if (!tripData || !quotesData || !selectedQuote) return;

    const payload = {
      pickup: tripData.pickup,
      dropoff: tripData.dropoff,
      miles: tripData.miles,
      durationMin: tripData.durationMin,
      durationText: tripData.durationText,
      tripDistanceMiles: tripData.miles,
      tripDurationMin: tripData.durationMin,
      rideType: selectedRide,
      rideLabel: selectedQuote.label,
      fareEstimate: selectedQuote.total,
      surgeMultiplier: quotesData.surgeMultiplier || 1,
      breakdown: selectedQuote.breakdown || {},
      allQuotes: quotesData.rides || {},
      status: 'searching_driver',
      createdAt: new Date().toISOString(),
    };

    // Pass complete booking data to parent
    if (typeof onBookNow === 'function') {
      onBookNow(payload);
    }
  }, [tripData, quotesData, selectedQuote, selectedRide, onBookNow]);

  const isLoading = loadingTrip || loadingQuotes;
  const hasQuote  = !!tripData && !!quotesData && !!selectedQuote && !error && !isLoading;

  // ── RENDER ───────────────────────────────────────────────
  return (
    <div className="glass" style={{ padding: '26px' }}>
      <h2
        style={{
          fontSize: '18px',
          fontWeight: 800,
          letterSpacing: '-0.3px',
          color: T.text,
          marginBottom: '20px',
        }}
      >
        Book a Ride
      </h2>

      {/* Inputs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        <PlaceInput
          label="Pickup (A)"
          icon={MapPin}
          iconColor={T.accent}
          placeholder="Enter pickup address…"
          value={pickup}
          onChange={setPickup}
        />
        <PlaceInput
          label="Drop-off (B)"
          icon={Navigation}
          iconColor={T.ink}
          placeholder="Enter destination…"
          value={dropoff}
          onChange={setDropoff}
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 0',
            color: T.textMuted,
            fontSize: '13.5px',
            fontWeight: 500,
          }}
        >
          <Loader2 size={16} color={T.accent} style={{ animation: 'spin 1s linear infinite' }} />
          {loadingTrip ? 'Calculating route…' : 'Calculating prices…'}
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '14px',
            padding: '14px 16px',
            marginBottom: '16px',
          }}
        >
          <AlertCircle size={15} color="#DC2626" style={{ flexShrink: 0, marginTop: '1px' }} />
          <span style={{ fontSize: '13px', color: '#DC2626', fontWeight: 600 }}>{error}</span>
        </div>
      )}

      {/* Ride Selector — 2×2 grid */}
      {tripData && quotesData && rideOptions.length > 0 && (
        <div style={{ marginBottom: '18px' }}>
          <div className="lbl">Choose Ride</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '10px',
            }}
          >
            {rideOptions.map((ride) => {
              const active    = selectedRide === ride.id;
              const IconComp  = getRideIcon(ride.id);

              return (
                <div
                  key={ride.id}
                  className={`ride-card ${active ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedRide(ride.id);
                    setShowBreakdown(false);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '10px',
                    }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        background: active ? '#ECFDF5' : '#F3F4F6',
                        borderRadius: '9px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: active ? `1px solid ${T.accent}40` : '1px solid transparent',
                        transition: 'all .3s',
                      }}
                    >
                      <IconComp size={16} color={active ? T.accent : '#D1D5DB'} />
                    </div>

                    <div
                      style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '16px',
                        fontWeight: 700,
                        color: active ? T.accent : T.text,
                      }}
                    >
                      ${ride.total}
                    </div>
                  </div>

                  <div style={{ fontSize: '13.5px', fontWeight: 800, color: T.text, marginBottom: '2px' }}>
                    {ride.label}
                  </div>

                  <div style={{ fontSize: '11px', color: T.textMuted, marginBottom: '8px' }}>
                    {ride.desc}
                  </div>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '11px',
                        color: T.textMuted,
                        fontWeight: 600,
                      }}
                    >
                      <Clock size={10} />
                      {ride.eta}
                    </span>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '11px',
                        color: T.textMuted,
                        fontWeight: 600,
                      }}
                    >
                      <Users size={10} />
                      {ride.capacity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quote */}
      {hasQuote && (
        <>
          <div
            style={{
              background: T.surfaceAlt,
              border: `1px solid ${T.border}`,
              borderRadius: '18px',
              padding: '18px',
              marginBottom: '14px',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 800, color: T.text, marginBottom: '14px' }}>
              Trip Details
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '10px' }}>
              <div
                style={{
                  background: '#fff',
                  border: `1px solid ${T.border}`,
                  borderRadius: '13px',
                  padding: '12px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '20px',
                    fontWeight: 700,
                    color: T.accent,
                  }}
                >
                  {tripData.miles} mi
                </div>
                <div style={{ fontSize: '11px', color: T.textMuted, fontWeight: 700 }}>DISTANCE</div>
              </div>

              <div
                style={{
                  background: '#fff',
                  border: `1px solid ${T.border}`,
                  borderRadius: '13px',
                  padding: '12px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '20px',
                    fontWeight: 700,
                    color: T.accent,
                  }}
                >
                  {tripData.durationMin} min
                </div>
                <div style={{ fontSize: '11px', color: T.textMuted, fontWeight: 700 }}>DURATION</div>
              </div>
            </div>
          </div>

          {/* Fare estimate */}
          <div
            style={{
              background: 'linear-gradient(135deg,#F0FDF4 0%,#DCFCE7 100%)',
              border: `1.5px solid ${T.accentBorder}`,
              borderRadius: '18px',
              padding: '18px 22px',
              marginBottom: '16px',
              boxShadow: '0 4px 18px rgba(22,163,74,.08)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: showBreakdown ? '16px' : '0',
              }}
            >
              <div>
                <div className="lbl">Estimated Fare</div>
                <div
                  style={{
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'center',
                    marginTop: '4px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: '12px', color: T.textMuted, fontWeight: 500 }}>
                    {tripData.miles} mi · ~{tripData.durationMin} min
                  </span>

                  {safeNum(quotesData.surgeMultiplier, 1) > 1 && (
                    <span
                      style={{
                        background: 'rgba(22,163,74,.12)',
                        border: '1px solid rgba(22,163,74,.25)',
                        borderRadius: '100px',
                        padding: '2px 9px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: T.accent,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Zap size={10} />
                      {quotesData.surgeMultiplier}x surge
                    </span>
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '34px',
                    fontWeight: 700,
                    letterSpacing: '-1.5px',
                    color: T.accent,
                    lineHeight: 1,
                  }}
                >
                  ${selectedQuote.total}
                </div>

                <button
                  type="button"
                  onClick={() => setShowBreakdown(s => !s)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '11px',
                    color: T.accent,
                    fontWeight: 700,
                    marginTop: '4px',
                    fontFamily: 'Outfit,sans-serif',
                    padding: 0,
                  }}
                >
                  {showBreakdown ? '▲ Hide' : '▼ How is this calculated?'}
                </button>
              </div>
            </div>

            {showBreakdown && selectedQuote?.breakdown && (
              <div
                style={{
                  borderTop: `1px solid ${T.accentBorder}`,
                  paddingTop: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '9px',
                }}
              >
                {[
                  { label: 'Base fee', val: selectedQuote.breakdown.base },
                  {
                    label: `Distance (${tripData.miles} mi × $${selectedQuote.meta?.perMile || 0}/mi)`,
                    val: selectedQuote.breakdown.distance,
                  },
                  {
                    label: `Time (~${tripData.durationMin} min × $${selectedQuote.meta?.perMin || 0}/min)`,
                    val: selectedQuote.breakdown.time,
                  },
                  { label: 'Booking fee', val: selectedQuote.breakdown.bookingFee },
                  ...(safeNum(selectedQuote.breakdown.surge, 0) > 0
                    ? [{ label: 'Surge', val: selectedQuote.breakdown.surge, highlight: true }]
                    : []),
                ].map((row, i) => (
                  <div
                    key={i}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span
                      style={{
                        fontSize: '12.5px',
                        color: row.highlight ? T.accent : T.text,
                        fontWeight: 600,
                      }}
                    >
                      {row.label}
                    </span>
                    <span
                      style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: row.highlight ? T.accent : T.text,
                      }}
                    >
                      +${Number(row.val || 0).toFixed(2)}
                    </span>
                  </div>
                ))}

                <div
                  style={{
                    borderTop: `1px dashed ${T.accentBorder}`,
                    paddingTop: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 800, color: T.text }}>Total</span>
                  <span
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '15px',
                      fontWeight: 700,
                      color: T.accent,
                    }}
                  >
                    ${selectedQuote.total}
                  </span>
                </div>
              </div>
            )}
          </div>

          <button className="cta-btn" onClick={handleBookNow}>
            Book Now · ${selectedQuote.total}
            <ChevronRight size={17} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '4px' }} />
          </button>
        </>
      )}

      {!pickup.trim() && !dropoff.trim() && (
        <div
          style={{
            textAlign: 'center',
            padding: '14px 0',
            color: T.textMuted,
            fontSize: '13.5px',
            fontWeight: 500,
          }}
        >
          Enter pickup and destination
        </div>
      )}
    </div>
  );
}
