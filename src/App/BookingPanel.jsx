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
import { PRICING, RIDE_TYPES, THEME as T } from '@/App/pricing.js';
import { calcFare, getSurge, generateTripData } from '@/App/fare.js';


// ── CLOUD FUNCTION URL ────────────────────────────────────
const ATOB_URL = 'https://atob-j2jspuowha-uc.a.run.app';

// ── CALL CLOUD FUNCTION ──────────────────────────────────
async function fetchATOB(pickup, dropoff) {
  const res = await fetch(ATOB_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin: pickup, destination: dropoff }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `ATOB error ${res.status}`);
  }

  return data;
  // Expected:
  // { distance_miles, duration_text, duration_minutes? }
}

// ── DURATION TEXT PARSER (fallback) ─────────────────────
function parseDurationText(text = '') {
  if (!text) return 0;
  let minutes = 0;
  const hours = text.match(/(\d+)\s*hour/i);
  const mins = text.match(/(\d+)\s*min/i);

  if (hours) minutes += parseInt(hours[1], 10) * 60;
  if (mins) minutes += parseInt(mins[1], 10);

  return minutes || 0;
}

// ── MAIN COMPONENT ───────────────────────────────────────
export default function BookingPanel({ onBookNow }) {
  // Location state
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');

  // Ride selection
  const [selectedRide, setSelectedRide] = useState('standard');

  // Route / fare state
  const [fareData, setFareData] = useState(null);
  const [tripData, setTripData] = useState(null);
  const [surgeMultiplier, setSurge] = useState(1);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);

  // ── Fetch route ONLY when pickup/dropoff changes ───────
  useEffect(() => {
    if (!pickup.trim() || !dropoff.trim()) {
      setFareData(null);
      setTripData(null);
      setRouteError('');
      return;
    }

    const timeout = setTimeout(() => {
      setLoadingRoute(true);
      setRouteError('');

      fetchATOB(pickup, dropoff)
        .then(data => {
          const miles = data.distance_miles;

          const durationMin =
            data.duration_minutes != null
              ? data.duration_minutes
              : parseDurationText(data.duration_text);

          const surge = getSurge();
          setSurge(surge);

          const trip = generateTripData(pickup, dropoff, miles, durationMin);
          setTripData(trip);

          setFareData(
            calcFare(selectedRide, trip.actualMiles, surge, durationMin)
          );
        })
        .catch(err => {
          console.error('ATOB error:', err);
          setRouteError(err.message || 'Failed to calculate route. Check your locations.');
          setFareData(null);
          setTripData(null);
        })
        .finally(() => setLoadingRoute(false));
    }, 800);

    return () => clearTimeout(timeout);
  }, [pickup, dropoff]);

  // ── Recalculate fare when ride type changes ────────────
  useEffect(() => {
    if (tripData) {
      setFareData(
        calcFare(selectedRide, tripData.actualMiles, surgeMultiplier, tripData.totalMin)
      );
    }
  }, [selectedRide, tripData, surgeMultiplier]);

  // ── Book Now handler ───────────────────────────────────
  const handleBookNow = useCallback(() => {
    if (!fareData || !tripData) return;

    const payload = {
      pickup,
      dropoff,
      rideType: selectedRide,
      fareEstimate: fareData.total,
      surgeMultiplier,
      tripDistanceMiles: tripData.actualMiles,
      tripDurationMin: tripData.totalMin,
      status: 'searching_driver',
      createdAt: new Date().toISOString(),
    };

    if (typeof onBookNow === 'function') {
      onBookNow(payload);
    } else {
      console.log('Booking payload:', payload);
    }
  }, [pickup, dropoff, selectedRide, fareData, tripData, surgeMultiplier, onBookNow]);

  const hasRoute = !loadingRoute && !routeError && fareData && tripData;

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

      {/* ── Location inputs ──────────────────────────────── */}
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

      {/* ── Loading state ─────────────────────────────────── */}
      {loadingRoute && (
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
          Calculating route…
        </div>
      )}

      {/* ── Error state ───────────────────────────────────── */}
      {routeError && !loadingRoute && (
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
          <span style={{ fontSize: '13px', color: '#DC2626', fontWeight: 600 }}>
            {routeError}
          </span>
        </div>
      )}

      {/* ── Main booking UI ───────────────────────────────── */}
      {hasRoute && (
        <>
          {/* Ride type selector */}
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
                const p = PRICING[ride.id];
                const fd = calcFare(
                  ride.id,
                  tripData.actualMiles,
                  surgeMultiplier,
                  tripData.totalMin
                );
                const IconComp = ride.id === 'premium' ? Zap : ride.id === 'xl' ? Users : Car;

                return (
                  <div
                    key={ride.id}
                    className={`ride-card ${selectedRide === ride.id ? 'active' : ''}`}
                    style={{ '--rc': p.color }}
                    onClick={() => setSelectedRide(ride.id)}
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
                          background: selectedRide === ride.id ? `${p.color}18` : '#F3F4F6',
                          borderRadius: '9px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border:
                            selectedRide === ride.id
                              ? `1px solid ${p.color}40`
                              : '1px solid transparent',
                          transition: 'all .3s',
                        }}
                      >
                        <IconComp size={16} color={selectedRide === ride.id ? p.color : '#D1D5DB'} />
                      </div>

                      <div
                        style={{
                          fontFamily: '"JetBrains Mono",monospace',
                          fontSize: '17px',
                          fontWeight: 700,
                          color: selectedRide === ride.id ? p.color : T.text,
                        }}
                      >
                        ${fd.total}
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

          {/* Trip details */}
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '14px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 800, color: T.text }}>
                Trip Details
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: tripData.traffic.color + '12',
                  border: `1px solid ${tripData.traffic.color}30`,
                  borderRadius: '100px',
                  padding: '3px 10px',
                }}
              >
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: tripData.traffic.color,
                  }}
                />
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: tripData.traffic.color,
                  }}
                >
                  {tripData.traffic.label} Traffic
                </span>
              </div>
            </div>

            {/* Stats row only */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3,1fr)',
                gap: '8px',
              }}
            >
              {[
                { label: 'Distance', val: tripData.actualMiles, unit: 'mi', sub: `${tripData.actualKm} km` },
                {
                  label: 'Duration',
                  val: tripData.totalMin,
                  unit: 'min',
                  sub: tripData.trafficDelay > 0 ? `+${tripData.trafficDelay}m delay` : 'No delay',
                },
                { label: 'Arrival', val: tripData.arrivalTime, unit: '', sub: 'est. time' },
              ].map((s, i) => (
                <div
                  key={i}
                  style={{
                    background: '#fff',
                    border: `1px solid ${T.border}`,
                    borderRadius: '13px',
                    padding: '12px 10px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontFamily: '"JetBrains Mono",monospace',
                      fontSize: i === 2 ? '14px' : '20px',
                      fontWeight: 700,
                      color: T.accent,
                      lineHeight: 1,
                      marginBottom: '2px',
                    }}
                  >
                    {s.val}
                    {s.unit && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: T.textMuted,
                          fontWeight: 500,
                          marginLeft: '2px',
                        }}
                      >
                        {s.unit}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: T.textMuted,
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                      marginBottom: '2px',
                    }}
                  >
                    {s.label}
                  </div>

                  <div
                    style={{
                      fontSize: '10px',
                      color: s.sub.includes('+') ? '#D97706' : T.textMuted,
                      fontWeight: 600,
                    }}
                  >
                    {s.sub}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fare summary */}
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
                  <span style={{ fontSize: '12px', color: T.textMuted, fontWeight: 500 }}>
                    {tripData.actualMiles} mi · ~{tripData.totalMin} min
                  </span>

                  {surgeMultiplier > 1 && (
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
                      {surgeMultiplier}x surge
                    </span>
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontFamily: '"JetBrains Mono",monospace',
                    fontSize: '34px',
                    fontWeight: 700,
                    letterSpacing: '-1.5px',
                    color: T.accent,
                    lineHeight: 1,
                  }}
                >
                  ${fareData.total}
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

            {showBreakdown && (
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
                  { label: 'Base fee', val: fareData.breakdown.base },
                  {
                    label: `Distance (${fareData.miles} mi × $${PRICING[selectedRide].perMile}/mi)`,
                    val: fareData.breakdown.distance,
                  },
                  {
                    label: `Time (~${fareData.durationMin} min × $${PRICING[selectedRide].perMin}/min)`,
                    val: fareData.breakdown.time,
                  },
                  { label: 'Booking fee', val: fareData.breakdown.bookingFee },
                  ...(fareData.breakdown.surge > 0
                    ? [{ label: `Surge (${surgeMultiplier}×)`, val: fareData.breakdown.surge, highlight: true }]
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
                        fontFamily: '"JetBrains Mono",monospace',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: row.highlight ? T.accent : T.text,
                      }}
                    >
                      +${row.val.toFixed(2)}
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
                      fontFamily: '"JetBrains Mono",monospace',
                      fontSize: '15px',
                      fontWeight: 700,
                      color: T.accent,
                    }}
                  >
                    ${fareData.total}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Book Now CTA */}
          <button className="cta-btn" onClick={handleBookNow}>
            Book Now · ${fareData.total}
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

      {/* Prompt */}
      {!loadingRoute && !routeError && !hasRoute && (pickup || dropoff) && (
        <div
          style={{
            textAlign: 'center',
            padding: '14px 0',
            color: T.textMuted,
            fontSize: '13.5px',
            fontWeight: 500,
          }}
        >
          {pickup && dropoff ? 'Calculating route…' : 'Enter both locations to see pricing'}
        </div>
      )}
    </div>
  );
}