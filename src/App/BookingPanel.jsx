import React, { useState, useEffect, useCallback } from 'react';
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

import { RIDE_TYPES, THEME as T } from '@/App/pricing.js';

// ── CLOUD FUNCTION URLS ──────────────────────────────────
const ROUTE_URL = 'https://atob-j2jspuowha-uc.a.run.app';
const PRICE_URL = 'https://YOUR_PRICE_FUNCTION_URL.a.run.app';

// ── FETCH ROUTE DATA (TRUTH #1) ──────────────────────────
async function fetchTripData(pickup, dropoff) {
  const res = await fetch(ROUTE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      origin: pickup,
      destination: dropoff,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Route error ${res.status}`);
  }

  return {
    pickup,
    dropoff,
    miles: Number(data.distance_miles || 0),
    durationMin: Number(data.duration_minutes || 0),
    durationText: data.duration_text || '',
  };
}

// ── FETCH PRICE DATA (TRUTH #2) ──────────────────────────
async function fetchPriceData(tripData, rideType) {
  const res = await fetch(PRICE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rideType,
      miles: tripData.miles,
      minutes: tripData.durationMin,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Pricing error ${res.status}`);
  }

  return data;
  /*
    Expected:
    {
      total,
      surgeMultiplier,
      breakdown: {
        base,
        distance,
        time,
        bookingFee,
        surge
      }
    }
  */
}

// ── MAIN COMPONENT ───────────────────────────────────────
export default function BookingPanel({ onBookNow }) {
  // Input state
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');

  // Ride selection
  const [selectedRide, setSelectedRide] = useState('standard');

  // ONLY 2 TRUTHS
  const [tripData, setTripData] = useState(null);
  const [priceData, setPriceData] = useState(null);

  // UI state
  const [loadingTrip, setLoadingTrip] = useState(false);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [error, setError] = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);

  // ── STEP 1: GET TRIP DATA WHEN LOCATIONS CHANGE ────────
  useEffect(() => {
    if (!pickup.trim() || !dropoff.trim()) {
      setTripData(null);
      setPriceData(null);
      setError('');
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setLoadingTrip(true);
        setError('');
        setTripData(null);
        setPriceData(null);

        const trip = await fetchTripData(pickup, dropoff);
        setTripData(trip);
      } catch (err) {
        console.error('Trip fetch error:', err);
        setError(err.message || 'Failed to calculate route');
      } finally {
        setLoadingTrip(false);
      }
    }, 700);

    return () => clearTimeout(timeout);
  }, [pickup, dropoff]);

  // ── STEP 2: GET PRICE DATA WHEN TRIP/RIDE CHANGES ──────
  useEffect(() => {
    if (!tripData) return;

    let cancelled = false;

    async function loadPrice() {
      try {
        setLoadingPrice(true);
        setError('');

        const price = await fetchPriceData(tripData, selectedRide);

        if (!cancelled) {
          setPriceData(price);
        }
      } catch (err) {
        console.error('Price fetch error:', err);
        if (!cancelled) {
          setError(err.message || 'Failed to calculate price');
          setPriceData(null);
        }
      } finally {
        if (!cancelled) setLoadingPrice(false);
      }
    }

    loadPrice();

    return () => {
      cancelled = true;
    };
  }, [tripData, selectedRide]);

  // ── BOOK NOW ────────────────────────────────────────────
  const handleBookNow = useCallback(() => {
    if (!tripData || !priceData) return;

    const payload = {
      pickup: tripData.pickup,
      dropoff: tripData.dropoff,
      rideType: selectedRide,
      tripDistanceMiles: tripData.miles,
      tripDurationMin: tripData.durationMin,
      fareEstimate: priceData.total,
      surgeMultiplier: priceData.surgeMultiplier || 1,
      breakdown: priceData.breakdown || {},
      status: 'searching_driver',
      createdAt: new Date().toISOString(),
    };

    if (typeof onBookNow === 'function') {
      onBookNow(payload);
    } else {
      console.log('Booking payload:', payload);
    }
  }, [tripData, priceData, selectedRide, onBookNow]);

  const isLoading = loadingTrip || loadingPrice;
  const hasQuote = !!tripData && !!priceData && !error && !isLoading;

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

      {/* ── Location Inputs ─────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        {/* Pickup */}
        <div>
          <div className="lbl">Pickup (A)</div>
          <div style={{ position: 'relative' }}>
            <MapPin
              size={17}
              color={T.accent}
              style={{
                position: 'absolute',
                left: '17px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 2,
              }}
            />
            <input
              type="text"
              className="field"
              placeholder="Enter pickup address…"
              value={pickup}
              onChange={e => setPickup(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        {/* Dropoff */}
        <div>
          <div className="lbl">Drop-off (B)</div>
          <div style={{ position: 'relative' }}>
            <Navigation
              size={17}
              color={T.ink}
              style={{
                position: 'absolute',
                left: '17px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 2,
              }}
            />
            <input
              type="text"
              className="field"
              placeholder="Enter destination…"
              value={dropoff}
              onChange={e => setDropoff(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      {/* ── Loading ─────────────────────────────────────── */}
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
          <Loader2
            size={16}
            color={T.accent}
            style={{ animation: 'spin 1s linear infinite' }}
          />
          {loadingTrip ? 'Calculating route…' : 'Calculating price…'}
        </div>
      )}

      {/* ── Error ───────────────────────────────────────── */}
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
          <AlertCircle
            size={15}
            color="#DC2626"
            style={{ flexShrink: 0, marginTop: '1px' }}
          />
          <span
            style={{
              fontSize: '13px',
              color: '#DC2626',
              fontWeight: 600,
            }}
          >
            {error}
          </span>
        </div>
      )}

      {/* ── Ride Selector ───────────────────────────────── */}
      {tripData && (
        <div style={{ marginBottom: '18px' }}>
          <div className="lbl">Choose Ride</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2,1fr)',
              gap: '10px',
            }}
          >
            {RIDE_TYPES.map(ride => {
              const active = selectedRide === ride.id;
              const IconComp =
                ride.id === 'premium' ? Zap : ride.id === 'xl' ? Users : Car;

              return (
                <div
                  key={ride.id}
                  className={`ride-card ${active ? 'active' : ''}`}
                  onClick={() => setSelectedRide(ride.id)}
                  style={{
                    cursor: 'pointer',
                  }}
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
                        border: active
                          ? `1px solid ${T.accent}40`
                          : '1px solid transparent',
                        transition: 'all .3s',
                      }}
                    >
                      <IconComp
                        size={16}
                        color={active ? T.accent : '#D1D5DB'}
                      />
                    </div>

                    <div
                      style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '16px',
                        fontWeight: 700,
                        color: active ? T.accent : T.text,
                      }}
                    >
                      {active && priceData ? `$${priceData.total}` : 'Select'}
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: '13.5px',
                      fontWeight: 800,
                      color: T.text,
                      marginBottom: '2px',
                    }}
                  >
                    {ride.label}
                  </div>

                  <div
                    style={{
                      fontSize: '11px',
                      color: T.textMuted,
                      marginBottom: '8px',
                    }}
                  >
                    {ride.desc}
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
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

      {/* ── Trip Details ────────────────────────────────── */}
      {hasQuote && (
        <>
          <div
            style={{
              background: T.surfaceAlt,
              border: `1px solid ${T.border}`,
              borderRadius: '18px',
              padding: '18px',
              marginBottom: '14px',
              animation: 'scaleIn .35s ease-out',
            }}
          >
            <div
              style={{
                fontSize: '13px',
                fontWeight: 800,
                color: T.text,
                marginBottom: '14px',
              }}
            >
              Trip Details
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2,1fr)',
                gap: '10px',
              }}
            >
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
                <div
                  style={{
                    fontSize: '11px',
                    color: T.textMuted,
                    fontWeight: 700,
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                  }}
                >
                  Distance
                </div>
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
                <div
                  style={{
                    fontSize: '11px',
                    color: T.textMuted,
                    fontWeight: 700,
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                  }}
                >
                  Duration
                </div>
              </div>
            </div>
          </div>

          {/* ── Fare Summary ─────────────────────────────── */}
          <div
            style={{
              background: 'linear-gradient(135deg,#F0FDF4 0%,#DCFCE7 100%)',
              border: `1.5px solid ${T.accentBorder}`,
              borderRadius: '18px',
              padding: '18px 22px',
              marginBottom: '16px',
              animation: 'scaleIn .38s ease-out',
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
                  <span
                    style={{
                      fontSize: '12px',
                      color: T.textMuted,
                      fontWeight: 500,
                    }}
                  >
                    {tripData.miles} mi · ~{tripData.durationMin} min
                  </span>

                  {priceData.surgeMultiplier > 1 && (
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
                      {priceData.surgeMultiplier}x surge
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
                  ${priceData.total}
                </div>

                <button
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

            {showBreakdown && priceData.breakdown && (
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
                  { label: 'Base fee', val: priceData.breakdown.base },
                  { label: 'Distance', val: priceData.breakdown.distance },
                  { label: 'Time', val: priceData.breakdown.time },
                  { label: 'Booking fee', val: priceData.breakdown.bookingFee },
                  ...(priceData.breakdown.surge > 0
                    ? [{ label: 'Surge', val: priceData.breakdown.surge, highlight: true }]
                    : []),
                ].map((row, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12.5px',
                        color: row.highlight ? T.accent : T.textMid,
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
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      color: T.text,
                    }}
                  >
                    Total
                  </span>
                  <span
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '15px',
                      fontWeight: 700,
                      color: T.accent,
                    }}
                  >
                    ${priceData.total}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── CTA ─────────────────────────────────────── */}
          <button className="cta-btn" onClick={handleBookNow}>
            Book Now · ${priceData.total}
            <ChevronRight
              size={17}
              style={{
                display: 'inline',
                verticalAlign: 'middle',
                marginLeft: '4px',
              }}
            />
          </button>
        </>
      )}

      {/* ── Empty Prompt ────────────────────────────────── */}
      {!loadingTrip && !loadingPrice && !error && !tripData && !priceData && (
        <div
          style={{
            textAlign: 'center',
            padding: '14px 0',
            color: T.textMuted,
            fontSize: '13.5px',
            fontWeight: 500,
          }}
        >
          Enter pickup and destination to get a quote
        </div>
      )}
    </div>
  );
}