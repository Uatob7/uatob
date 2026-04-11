// src/App/UaTob/LiveTrackingPanel.jsx
import React, { useMemo, useEffect, useState } from 'react';
import { Car, Star, Check, Phone, MapPin, Navigation } from 'lucide-react';
import { THEME as T } from '@/App/UaTob/pricing.js';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import TrackingMap from '@/App/UaTob/TrackingMap.jsx';

// ── Status → progress steps ────────────────────────────────
const STEPS = [
  { key: 'driver_assigned', label: 'Assigned'  },
  { key: 'driver_arriving', label: 'En Route'  },
  { key: 'arrived',         label: 'Arrived'   },
  { key: 'in_progress',     label: 'Riding'    },
  { key: 'completed',       label: 'Done'      },
];

const STATUS_ORDER = [
  'searching_driver',
  'driver_assigned',
  'driver_arriving',
  'arrived',
  'in_progress',
  'completed',
];

const RIDE_COLORS = {
  economy:  '#16A34A',
  standard: '#16A34A',
  premium:  '#7C3AED',
  xl:       '#F59E0B',
};

function getDriverColor(type) {
  return RIDE_COLORS[type] ?? '#16A34A';
}

function buildProgress(liveStatus) {
  const currentIndex = STATUS_ORDER.indexOf(liveStatus);
  return STEPS.map((step) => {
    const stepIndex = STATUS_ORDER.indexOf(step.key);
    if (currentIndex === -1)      return { ...step, status: 'pending'   };
    if (stepIndex < currentIndex) return { ...step, status: 'completed' };
    if (stepIndex === currentIndex) return { ...step, status: 'current' };
    return { ...step, status: 'pending' };
  });
}

function getStatusLabel(status, driverName) {
  const name = driverName || 'Your driver';
  return {
    searching_driver: 'Finding you a driver…',
    driver_assigned:  `${name} has been assigned`,
    driver_arriving:  `${name} is on the way`,
    arrived:          `${name} has arrived!`,
    in_progress:      'On the way to your destination',
    completed:        'Ride complete 🎉',
  }[status] ?? '';
}

// ── Initials avatar ────────────────────────────────────────
function DriverAvatar({ firstName, lastName, size = 52, color }) {
  const initials = [firstName?.[0], lastName?.[0]]
    .filter(Boolean)
    .join('')
    .toUpperCase() || '?';

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '14px',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: size * 0.32,
        fontWeight: 700,
        color: '#fff',
        letterSpacing: '1px',
      }}
    >
      {initials}
    </div>
  );
}

// ── Small pill badge ───────────────────────────────────────
function Pill({ children, color = T.accent }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: `${color}18`,
        border: `1px solid ${color}30`,
        borderRadius: '99px',
        padding: '2px 9px',
        fontSize: '11px',
        fontWeight: 700,
        color,
        letterSpacing: '0.3px',
      }}
    >
      {children}
    </span>
  );
}

// ── Stat cell ──────────────────────────────────────────────
function StatCell({ label, value, unit, accent = T.accent }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: T.textMuted,
          letterSpacing: '0.6px',
          textTransform: 'uppercase',
          marginBottom: '6px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '34px',
          fontWeight: 700,
          letterSpacing: '-1.5px',
          color: accent,
          lineHeight: 1,
        }}
      >
        {value}
        {unit && (
          <span
            style={{
              fontSize: '15px',
              fontWeight: 400,
              color: T.textMuted,
              marginLeft: '3px',
            }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────
export default function LiveTrackingPanel({ active, onRideDone }) {
  const [driverDoc, setDriverDoc] = useState(null);

  const currentRide = useMemo(() => {
    if (!active?.length) return null;
    return (
      active.find(
        (r) =>
          r.paymentStatus === 'succeeded' &&
          r.status !== 'completed' &&
          r.status !== 'cancelled'
      ) ?? null
    );
  }, [active]);

  const driverUid = currentRide?.driverUid;

  useEffect(() => {
    if (!driverUid) { setDriverDoc(null); return; }
    const db    = getFirestore();
    const ref   = doc(db, 'Drivers', driverUid);
    const unsub = onSnapshot(ref, (snap) => {
      setDriverDoc(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, [driverUid]);

  useEffect(() => {
    if (currentRide?.status === 'completed') {
      const t = setTimeout(() => onRideDone?.(), 3000);
      return () => clearTimeout(t);
    }
  }, [currentRide?.status]);

  // ── Derived values ─────────────────────────────────────
  const liveStatus  = currentRide?.status ?? '';
  const pickup      = currentRide?.pickup  ?? 'Pickup location';
  const dropoff     = currentRide?.dropoff ?? 'Drop-off location';
  const driverColor = getDriverColor(currentRide?.rideType);
  const progress    = buildProgress(liveStatus);

  const total = useMemo(() => {
    const v = Number(currentRide?.fareTotal ?? 0);
    return Number.isFinite(v) ? v.toFixed(2) : '--';
  }, [currentRide]);

  const miles = useMemo(() => {
    const v = Number(currentRide?.tripDistanceMiles ?? 0);
    return Number.isFinite(v) ? v.toFixed(1) : '0.0';
  }, [currentRide]);

  // ── Driver info ────────────────────────────────────────
  const driverFirstName = driverDoc?.firstName ?? '';
  const driverLastName  = driverDoc?.lastName  ?? '';
  const driverName = driverFirstName || driverLastName
    ? `${driverFirstName} ${driverLastName}`.trim()
    : null;

  const vehicle    = driverDoc?.vehicle ?? null;
  const driverPhone = driverDoc?.contact?.phone ?? null;
  const driverRating = driverDoc?.rating ?? null;

  // ── Live position ──────────────────────────────────────
  const driverLat = currentRide?.driverLat ?? null;
  const driverLng = currentRide?.driverLng ?? null;
  const hasLiveLocation = driverLat !== null && driverLng !== null;

  const driverPos = useMemo(() => {
    if (!hasLiveLocation) return null;
    const x = ((driverLng + 180) / 360) * 100;
    const y = ((90 - driverLat) / 180) * 100;
    return { x: +x.toFixed(1), y: +y.toFixed(1) };
  }, [driverLat, driverLng, hasLiveLocation]);

  // ── ETA / distance — both legs always available ────────
  const headingToPickup  = ['driver_assigned', 'driver_arriving'].includes(liveStatus);
  const headingToDropoff = ['arrived', 'in_progress'].includes(liveStatus);

  // Leg 1: driver → pickup
  const driverDistanceMiles = currentRide?.driverDistanceMiles ?? null;
  const driverEtaMin        = currentRide?.driverEtaMin        ?? null;

  // Leg 2: pickup → dropoff
  const dropoffDistanceMiles = currentRide?.dropoffDistanceMiles ?? null;
  const dropoffEtaMin        = currentRide?.dropoffEtaMin        ?? null;

  // Legacy single values (still used by map etc.)
  const distanceMiles = headingToPickup  ? driverDistanceMiles  : dropoffDistanceMiles;
  const etaMin        = headingToPickup  ? driverEtaMin         : dropoffEtaMin;

  // ── Empty state ────────────────────────────────────────
  if (!currentRide) {
    return (
      <div
        className="glass"
        style={{
          padding: '26px',
          textAlign: 'center',
          color: T.textMuted,
          fontSize: '14px',
          fontWeight: 600,
        }}
      >
        No active ride found.
      </div>
    );
  }

  // ── Vehicle label ──────────────────────────────────────
  const vehicleLabel = vehicle
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim()
    : null;

  const vehicleColor = vehicle?.color
    ? vehicle.color.charAt(0).toUpperCase() + vehicle.color.slice(1)
    : null;

  return (
    <div className="glass" style={{ padding: '26px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* ── Map ── */}
      <TrackingMap
        bookingPayload={currentRide}
        rideStatus={liveStatus}
        assignedDriver={driverDoc}
        driverPos={driverPos}
        isTracking={true}
        etaMinutes={etaMin}
        distToDropoff={distanceMiles}
      />

      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.4px', color: T.text, margin: 0 }}>
            Live Tracking
          </h2>
          {liveStatus && (
            <div style={{ fontSize: '13px', fontWeight: 600, color: T.textMuted, marginTop: '4px' }}>
              {getStatusLabel(liveStatus, driverName)}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          {liveStatus === 'completed' && (
            <Pill color="#16A34A">Complete ✓</Pill>
          )}
          {hasLiveLocation && liveStatus !== 'completed' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div
                style={{
                  width: '7px',
                  height: '7px',
                  background: '#16A34A',
                  borderRadius: '50%',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
              <span style={{ fontSize: '10px', fontWeight: 700, color: T.textMuted, letterSpacing: '0.8px' }}>
                LIVE GPS
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Progress stepper ── */}
      <div style={{ display: 'flex', position: 'relative' }}>
        {progress.map((step, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
            }}
          >
            {i < progress.length - 1 && (
              <div
                style={{
                  position: 'absolute',
                  top: '15px',
                  left: '50%',
                  width: '100%',
                  height: '2px',
                  background:
                    step.status === 'completed'
                      ? 'linear-gradient(90deg,#16A34A,#22C55E)'
                      : T.border,
                  zIndex: 0,
                  transition: 'all .5s',
                }}
              />
            )}
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                position: 'relative',
                zIndex: 1,
                background:
                  step.status === 'completed'
                    ? 'linear-gradient(135deg,#16A34A,#15803D)'
                    : step.status === 'current'
                    ? 'linear-gradient(135deg,#111827,#374151)'
                    : '#F3F4F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow:
                  step.status !== 'pending'
                    ? `0 4px 14px ${step.status === 'completed' ? 'rgba(22,163,74,.28)' : 'rgba(17,24,39,.2)'}`
                    : 'none',
                transition: 'all .4s',
              }}
            >
              {step.status === 'completed' ? (
                <Check size={15} color="#fff" strokeWidth={3} />
              ) : step.status === 'current' ? (
                <div
                  style={{
                    width: '7px',
                    height: '7px',
                    background: '#fff',
                    borderRadius: '50%',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                />
              ) : (
                <div style={{ width: '6px', height: '6px', background: '#D1D5DB', borderRadius: '50%' }} />
              )}
            </div>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: step.status === 'pending' ? '#D1D5DB' : T.textMid,
                marginTop: '8px',
                textAlign: 'center',
              }}
            >
              {step.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Route Timeline — both legs always visible ── */}
      {(driverDistanceMiles !== null || dropoffDistanceMiles !== null) && (
        <div
          style={{
            background: T.surfaceAlt,
            border: `1.5px solid ${T.border}`,
            borderRadius: '16px',
            padding: '18px 20px',
          }}
        >
          {/* Spine row */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>

            {/* Driver dot */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: headingToPickup ? driverColor : T.border,
                  boxShadow: headingToPickup ? `0 0 0 3px ${driverColor}22` : 'none',
                  transition: 'all .4s',
                }}
              />
            </div>

            {/* Leg 1 line — driver → pickup */}
            <div
              style={{
                flex: 1,
                height: '2px',
                background: headingToPickup
                  ? `linear-gradient(90deg,${driverColor},${driverColor}88)`
                  : T.border,
                transition: 'all .4s',
                position: 'relative',
              }}
            />

            {/* Pickup dot */}
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: T.ink,
                border: `2px solid ${headingToPickup ? T.border : T.ink}`,
                flexShrink: 0,
                transition: 'all .4s',
              }}
            />

            {/* Leg 2 line — pickup → dropoff */}
            <div
              style={{
                flex: 1,
                height: '2px',
                background: headingToDropoff
                  ? `linear-gradient(90deg,${T.accent},${T.accent}88)`
                  : T.border,
                transition: 'all .4s',
              }}
            />

            {/* Dropoff diamond */}
            <div
              style={{
                width: '10px',
                height: '10px',
                background: headingToDropoff ? T.accent : T.border,
                borderRadius: '2px',
                transform: 'rotate(45deg)',
                flexShrink: 0,
                transition: 'all .4s',
              }}
            />
          </div>

          {/* Labels row */}
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>

            {/* Leg 1 stat */}
            <div style={{ flexShrink: 0, maxWidth: '80px' }}>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: headingToPickup ? driverColor : T.textMuted,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  marginBottom: '3px',
                  transition: 'color .4s',
                }}
              >
                Driver
              </div>
              {driverDistanceMiles !== null ? (
                <>
                  <div
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: headingToPickup ? '22px' : '15px',
                      fontWeight: 700,
                      color: headingToPickup ? driverColor : T.textMuted,
                      lineHeight: 1,
                      transition: 'all .4s',
                    }}
                  >
                    {driverDistanceMiles}
                    <span style={{ fontSize: '11px', fontWeight: 400, marginLeft: '2px' }}>mi</span>
                  </div>
                  {driverEtaMin !== null && (
                    <div style={{ fontSize: '11px', color: headingToPickup ? driverColor : T.textMuted, marginTop: '2px', transition: 'color .4s' }}>
                      {driverEtaMin} min away
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: '11px', color: T.textMuted }}>—</div>
              )}
            </div>

            {/* Pickup label — centered */}
            <div style={{ flex: 1, textAlign: 'center', padding: '0 8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.textMuted, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '3px' }}>
                Pickup
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: T.textMuted,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {pickup.split(',')[0]}
              </div>
            </div>

            {/* Leg 2 stat — right aligned */}
            <div style={{ flexShrink: 0, maxWidth: '80px', textAlign: 'right' }}>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: headingToDropoff ? T.accent : T.textMuted,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  marginBottom: '3px',
                  transition: 'color .4s',
                }}
              >
                Dropoff
              </div>
              {dropoffDistanceMiles !== null ? (
                <>
                  <div
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: headingToDropoff ? '22px' : '15px',
                      fontWeight: 700,
                      color: headingToDropoff ? T.accent : T.textMuted,
                      lineHeight: 1,
                      transition: 'all .4s',
                    }}
                  >
                    {dropoffDistanceMiles}
                    <span style={{ fontSize: '11px', fontWeight: 400, marginLeft: '2px' }}>mi</span>
                  </div>
                  {dropoffEtaMin !== null && (
                    <div style={{ fontSize: '11px', color: headingToDropoff ? T.accent : T.textMuted, marginTop: '2px', transition: 'color .4s' }}>
                      {dropoffEtaMin} min away
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: '11px', color: T.textMuted }}>—</div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ── Route card ── */}
      <div
        style={{
          background: T.surfaceAlt,
          border: `1px solid ${T.border}`,
          borderRadius: '16px',
          padding: '18px',
        }}
      >
        <div style={{ display: 'flex', gap: '14px', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '10px', height: '10px', background: T.ink, borderRadius: '50%' }} />
            <div style={{ width: '1.5px', flex: 1, background: T.border }} />
            <div
              style={{
                width: '10px',
                height: '10px',
                background: T.accent,
                borderRadius: '2px',
                transform: 'rotate(45deg)',
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ marginBottom: '14px' }}>
              <div className="lbl">From</div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: T.text,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {pickup}
              </div>
            </div>
            <div>
              <div className="lbl">To</div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: T.text,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {dropoff}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div className="lbl">Trip</div>
            <div
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '22px',
                fontWeight: 700,
                color: T.accent,
              }}
            >
              ${total}
            </div>
            <div style={{ fontSize: '11px', color: T.textMuted, marginTop: '2px' }}>{miles} mi</div>
          </div>
        </div>
      </div>

      {/* ── Driver card ── */}
      <div
        style={{
          background: T.surfaceAlt,
          border: `1.5px solid ${driverColor}25`,
          borderRadius: '16px',
          padding: '16px',
        }}
      >
        {/* Top row: avatar + name + rating */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: vehicleLabel ? '14px' : 0 }}>
          <DriverAvatar
            firstName={driverFirstName}
            lastName={driverLastName}
            size={52}
            color={driverColor}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '16px', fontWeight: 800, color: T.text }}>
                {driverName || 'Finding driver…'}
              </span>
              {driverRating && (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#F59E0B',
                  }}
                >
                  <Star size={11} fill="#F59E0B" />
                  {driverRating}
                </span>
              )}
              {currentRide?.rideLabel && (
                <Pill color={driverColor}>{currentRide.rideLabel}</Pill>
              )}
            </div>

            {/* Vehicle info */}
            {vehicleLabel && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '13px',
                  color: T.textMuted,
                  marginBottom: '3px',
                }}
              >
                <Car size={12} />
                <span>
                  {vehicleColor ? `${vehicleColor} ` : ''}{vehicleLabel}
                </span>
              </div>
            )}

            {/* Plate */}
            {vehicle?.plate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '2px',
                    background: T.border,
                    border: `1px solid ${T.border}`,
                    borderRadius: '6px',
                    padding: '2px 8px',
                    color: T.text,
                  }}
                >
                  {vehicle.plate.toUpperCase()}
                </span>
                {vehicle?.year && (
                  <span style={{ fontSize: '11px', color: T.textMuted }}>{vehicle.year}</span>
                )}
              </div>
            )}
          </div>

          {/* Phone CTA + live pip */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
            {driverPhone && (
              <a
                href={`tel:${driverPhone}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: `${driverColor}12`,
                  border: `1.5px solid ${driverColor}30`,
                  borderRadius: '10px',
                  padding: '7px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: driverColor,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                <Phone size={12} />
                Call
              </a>
            )}
            {hasLiveLocation && liveStatus !== 'completed' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div
                  style={{
                    width: '7px',
                    height: '7px',
                    background: '#16A34A',
                    borderRadius: '50%',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                />
                <span style={{ fontSize: '9px', fontWeight: 700, color: T.textMuted, letterSpacing: '0.6px' }}>
                  LIVE
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom row: driver location */}
        {driverDoc && (
          <div
            style={{
              borderTop: `1px solid ${T.border}`,
              paddingTop: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: T.textMuted,
            }}
          >
            <MapPin size={12} />
            <span>
              {[driverDoc.city, driverDoc.zip].filter(Boolean).join(', ') || 'Orlando, FL'}
            </span>
            {hasLiveLocation && (
              <>
                <span style={{ color: T.border }}>·</span>
                <Navigation size={11} />
                <span>{driverLat?.toFixed(4)}, {driverLng?.toFixed(4)}</span>
              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
}