// src/App/UaTob/LiveTrackingPanel.jsx
import React, { useMemo, useEffect, useState } from 'react';
import { Car, Star, Check } from 'lucide-react';
import { THEME as T } from '@/App/UaTob/pricing.js';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import TrackingMap from '@/App/UaTob/TrackingMap.jsx';
const RIDE_COLORS = {
  economy:  '#16A34A',
  standard: '#16A34A',
  premium:  '#7C3AED',
  xl:       '#F59E0B',
};

function getDriverColor(type) {
  return RIDE_COLORS[type] || '#16A34A';
}

// ── Firestore status → progress steps ─────────────────────
const STEPS = [
  { key: 'driver_assigned',   label: 'Assigned'  },
  { key: 'driver_arriving',   label: 'En Route'  },
  { key: 'arrived',           label: 'Arrived'   },
  { key: 'in_progress',       label: 'Riding'    },
  { key: 'completed',         label: 'Done'      },
];

const STATUS_ORDER = [
  'searching_driver',
  'driver_assigned',
  'driver_arriving',
  'arrived',
  'in_progress',
  'completed',
];

function buildProgress(liveStatus) {
  const currentIndex = STATUS_ORDER.indexOf(liveStatus);
  return STEPS.map((step) => {
    const stepIndex = STATUS_ORDER.indexOf(step.key);
    if (currentIndex === -1)         return { ...step, status: 'pending'   };
    if (stepIndex < currentIndex)    return { ...step, status: 'completed' };
    if (stepIndex === currentIndex)  return { ...step, status: 'current'   };
    return { ...step, status: 'pending' };
  });
}

// ── Status → human label ───────────────────────────────────
function getStatusLabel(status, driverName) {
  const name = driverName || 'Your driver';
  return {
    searching_driver: 'Finding you a driver…',
    driver_assigned:  `${name} has been assigned`,
    driver_arriving:  `${name} is on the way`,
    arrived:          `${name} has arrived!`,
    in_progress:      'On the way to your destination',
    completed:        'Ride complete 🎉',
  }[status] || '';
}

export default function LiveTrackingPanel({
  rides        = [],
  ridesLoading = false,
  onRideDone,
}) {
  const [driverDoc, setDriverDoc] = useState(null);
    const driverUid = rides?.driverUid;
  console.log(rides);

  // ── Derive current ride ────────────────────────────────
  const currentRide = useMemo(() => {
    if (!rides?.length) return null;
    return rides.find(
      (r) => r.paymentStatus === 'succeeded' &&
             r.status !== 'completed'        &&
             r.status !== 'cancelled'
    ) ?? null;
  }, [rides]);

  // ── Live-listen to Drivers/{driverUid} ────────────────
  useEffect(() => {
    if (!driverUid) { setDriverDoc(null); return; }

    const db   = getFirestore();
    const ref  = doc(db, 'Drivers', driverUid);
    const unsub = onSnapshot(ref, (snap) => {
      setDriverDoc(snap.exists() ? snap.data() : null);
    });

    return () => unsub();
  }, [currentRide?.driverUid]);

  // ── Call onRideDone when ride completes ────────────────
  useEffect(() => {
    if (currentRide?.status === 'completed') {
      const t = setTimeout(() => onRideDone?.(), 3000);
      return () => clearTimeout(t);
    }
  }, [currentRide?.status]);

  // ── Derived display values ─────────────────────────────
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

  // ── Driver info from live Drivers doc ─────────────────
  const driverName    = driverDoc ? `${driverDoc.firstName} ${driverDoc.lastName}`.trim() : null;
  const driverLat     = currentRide?.driverLat     ?? null;
  const driverLng     = currentRide?.driverLng     ?? null;

  // ── Distance / ETA from ride doc (written by Cloud Fn) ─
  const headingToPickup  = ['driver_assigned', 'driver_arriving'].includes(liveStatus);
  const headingToDropoff = ['arrived', 'in_progress'].includes(liveStatus);

  const distanceMiles = headingToPickup
    ? (currentRide?.driverDistanceMiles ?? null)
    : headingToDropoff
    ? (currentRide?.dropoffDistanceMiles ?? null)
    : null;

  const etaMin = headingToPickup
    ? (currentRide?.driverEtaMin ?? null)
    : headingToDropoff
    ? (currentRide?.dropoffEtaMin ?? null)
    : null;

  // ── Loading state ──────────────────────────────────────
  if (ridesLoading) {
    return (
      <div className="glass" style={{ padding: '26px', textAlign: 'center', color: T.textMuted, fontSize: '14px', fontWeight: 600 }}>
        Loading ride…
      </div>
    );
  }

  if (!currentRide) {
    return (
      <div className="glass" style={{ padding: '26px', textAlign: 'center', color: T.textMuted, fontSize: '14px', fontWeight: 600 }}>
        No active ride found.
      </div>
    );
  }

  return (
    <div className="glass" style={{ padding: '26px' }}>

      <TrackingMap />

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.4px', color: T.text }}>
          Live Tracking
        </h2>
        {liveStatus === 'completed' && (
          <div className="live-badge">Complete ✓</div>
        )}
      </div>

      {/* ── Status label ── */}
      {liveStatus && (
        <div style={{ fontSize: '13px', fontWeight: 600, color: T.textMuted, marginBottom: '24px' }}>
          {getStatusLabel(liveStatus, driverName)}
        </div>
      )}

      {/* ── Progress Steps ── */}
      <div style={{ display: 'flex', position: 'relative', marginBottom: '28px' }}>
        {progress.map((step, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            {i < progress.length - 1 && (
              <div style={{
                position: 'absolute', top: '15px', left: '50%', width: '100%', height: '2px',
                background: step.status === 'completed'
                  ? 'linear-gradient(90deg,#16A34A,#22C55E)'
                  : T.border,
                zIndex: 0, transition: 'all .5s',
              }} />
            )}
            <div style={{
              width: '30px', height: '30px', borderRadius: '50%',
              position: 'relative', zIndex: 1,
              background: step.status === 'completed'
                ? 'linear-gradient(135deg,#16A34A,#15803D)'
                : step.status === 'current'
                ? 'linear-gradient(135deg,#111827,#374151)'
                : '#F3F4F6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: step.status !== 'pending'
                ? `0 4px 14px ${step.status === 'completed' ? 'rgba(22,163,74,.28)' : 'rgba(17,24,39,.2)'}`
                : 'none',
              transition: 'all .4s',
            }}>
              {step.status === 'completed' ? (
                <Check size={15} color="#fff" strokeWidth={3} />
              ) : step.status === 'current' ? (
                <div style={{ width: '7px', height: '7px', background: '#fff', borderRadius: '50%', animation: 'pulse 1.5s ease-in-out infinite' }} />
              ) : (
                <div style={{ width: '6px', height: '6px', background: '#D1D5DB', borderRadius: '50%' }} />
              )}
            </div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: step.status === 'pending' ? '#D1D5DB' : T.textMid, marginTop: '8px', textAlign: 'center' }}>
              {step.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── ETA / Distance card ── */}
      {distanceMiles !== null && etaMin !== null && (
        <div style={{
          background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)',
          border: `1.5px solid ${T.accentBorder}`,
          borderRadius: '16px', padding: '18px',
          display: 'flex', justifyContent: 'space-around',
          alignItems: 'center', marginBottom: '14px',
          animation: 'scaleIn .4s ease-out',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div className="lbl" style={{ marginBottom: '4px' }}>
              {headingToPickup ? 'Driver Distance' : 'Distance Remaining'}
            </div>
            <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: '32px', fontWeight: 700, letterSpacing: '-1px', color: T.accent, lineHeight: 1 }}>
              {distanceMiles}
              <span style={{ fontSize: '16px', fontWeight: 400, color: T.textMuted, marginLeft: '3px' }}>mi</span>
            </div>
          </div>
          <div style={{ width: '1px', height: '40px', background: T.border }} />
          <div style={{ textAlign: 'center' }}>
            <div className="lbl" style={{ marginBottom: '4px' }}>ETA</div>
            <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: '32px', fontWeight: 700, letterSpacing: '-1px', color: T.accent, lineHeight: 1 }}>
              {etaMin}
              <span style={{ fontSize: '16px', fontWeight: 400, color: T.textMuted, marginLeft: '3px' }}>min</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Route Summary ── */}
      <div style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: '16px', padding: '18px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '10px', height: '10px', background: T.ink, borderRadius: '50%' }} />
            <div style={{ width: '1.5px', flex: 1, background: T.border }} />
            <div style={{ width: '10px', height: '10px', background: T.accent, borderRadius: '2px', transform: 'rotate(45deg)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: '14px' }}>
              <div className="lbl">From</div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: T.text }}>{pickup}</div>
            </div>
            <div>
              <div className="lbl">To</div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: T.text }}>{dropoff}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div className="lbl">Fare</div>
            <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: '22px', fontWeight: 700, color: T.accent }}>${total}</div>
            <div style={{ fontSize: '11px', color: T.textMuted, marginTop: '2px' }}>{miles} mi</div>
          </div>
        </div>
      </div>

      {/* ── Driver Card ── */}
      <div style={{ background: T.surfaceAlt, border: `1.5px solid ${driverColor}25`, borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ width: '50px', height: '50px', background: driverColor, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Car size={24} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
            <span style={{ fontSize: '16px', fontWeight: 800, color: T.text }}>
              {driverName || 'Finding driver…'}
            </span>
            {driverDoc?.rating && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', fontWeight: 700, color: '#F59E0B' }}>
                <Star size={11} fill="#F59E0B" />
                {driverDoc.rating}
              </span>
            )}
          </div>
          <div style={{ fontSize: '13px', color: T.textMuted }}>
            {driverDoc
              ? `${driverDoc.city ?? ''} · ${driverDoc.zip ?? ''}`.trim().replace(/^·\s*/, '')
              : 'Driver details will appear here'}
          </div>
        </div>

        {/* Live location indicator */}
        {driverLat && driverLng && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <div style={{ width: '8px', height: '8px', background: '#16A34A', borderRadius: '50%', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ fontSize: '9px', fontWeight: 700, color: T.textMuted, letterSpacing: '0.5px' }}>LIVE</div>
          </div>
        )}
      </div>

    </div>
  );
}