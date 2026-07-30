// ActiveRide.jsx
// Active-ride screen in the new UaTob design — replaces the legacy full-screen
// HUD once a ride is in flight. Live driver tracking map + a clean status card
// (finding driver → en route → arrived → on the trip) with driver details.

import { useEffect, useMemo, useState, useCallback } from 'react';
import { getFirestore, doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';
import TrackMap from '@/App/UaTob/TrackMap';

const db = getFirestore(firebase_app);

const C = {
  bg: '#050A06', green: '#22C55E', greenBright: '#4ADE80', greenSoft: '#34D399',
  cyan: '#22D3EE', amber: '#FBBF24', red: '#F87171',
  inkDim: 'rgba(255,255,255,.22)', inkFade: 'rgba(255,255,255,.10)',
  inkMid: 'rgba(255,255,255,.45)', inkBright: 'rgba(255,255,255,.88)',
  border: 'rgba(34,197,94,.15)', borderBright: 'rgba(74,222,128,.35)',
};
const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";
const BODY = "'Syne','Inter',sans-serif";

const STATUS = {
  searching_driver: { icon: '🔍', label: 'Finding your driver', color: C.amber, sub: 'Broadcasting to drivers nearby', phase: 'search' },
  timeout:          { icon: '⏳', label: 'Still searching…',     color: C.amber, sub: 'Taking a little longer than usual', phase: 'search' },
  driver_assigned:  { icon: '🚗', label: 'Driver on the way',    color: C.greenBright, sub: 'Heading to your pickup', phase: 'toPickup' },
  driver_arriving:  { icon: '🚗', label: 'Driver arriving',      color: C.greenBright, sub: 'Almost at your pickup', phase: 'toPickup' },
  arrived:          { icon: '📍', label: 'Your driver is here',  color: C.cyan, sub: 'Meet at your pickup point', phase: 'toPickup' },
  in_progress:      { icon: '🛣️', label: 'On your way',          color: C.greenBright, sub: 'Enjoy the ride', phase: 'trip' },
};

function haversineMi(a, b) {
  if (!a || !b) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function useDriverLive(driverUid) {
  const [d, setD] = useState(null);
  useEffect(() => {
    if (!driverUid) { setD(null); return; }
    const unsub = onSnapshot(doc(db, 'Drivers', driverUid), (s) => setD(s.exists() ? { id: s.id, ...s.data() } : null));
    return () => unsub();
  }, [driverUid]);
  return d;
}

function useClock() {
  const [t, setT] = useState('');
  useEffect(() => {
    const tick = () => {
      const d = new Date(), p = (n) => String(n).padStart(2, '0');
      const h = d.getHours(), ap = h >= 12 ? 'PM' : 'AM';
      setT(`${h % 12 || 12}:${p(d.getMinutes())} ${ap}`);
    };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);
  return t;
}

export default function ActiveRide({ ride, uid, onContactDriver }) {
  const clock = useClock();
  const [canceling, setCanceling] = useState(false);

  const sc = STATUS[ride.status] || STATUS.driver_assigned;
  const driverUid = ride.driverUid || ride.driverInfo?.uid || null;
  const driverLive = useDriverLive(driverUid);
  const driverInfo = { ...(ride.driverInfo || {}), ...(driverLive || {}) };

  const pickup = ride.pickupLat != null ? { lat: ride.pickupLat, lng: ride.pickupLng } : null;
  const dropoff = ride.dropoffLat != null ? { lat: ride.dropoffLat, lng: ride.dropoffLng } : null;
  const driver = driverLive?.lat != null ? { lat: driverLive.lat, lng: driverLive.lng, heading: driverLive.heading } : null;

  // Rough live ETA/distance for the current leg (no Directions call).
  const leg = useMemo(() => {
    const target = sc.phase === 'trip' ? dropoff : pickup;
    if (driver && target) {
      const mi = haversineMi(driver, target);
      if (mi != null) return { mi, min: Math.max(1, Math.round((mi / 22) * 60)) };
    }
    if (sc.phase === 'trip' && ride.tripDistanceMiles) return { mi: ride.tripDistanceMiles, min: ride.tripDurationMin };
    return null;
  }, [driver, pickup, dropoff, sc.phase, ride.tripDistanceMiles, ride.tripDurationMin]);

  const cancel = useCallback(async () => {
    if (!ride?.id || canceling) return;
    setCanceling(true);
    try {
      await updateDoc(doc(db, 'Rides', ride.id), { status: 'canceled', canceledAt: serverTimestamp(), canceledBy: uid, updatedAt: serverTimestamp() });
    } catch (e) { console.warn('[ActiveRide] cancel failed', e?.message || e); setCanceling(false); }
  }, [ride?.id, uid, canceling]);

  const contact = () => {
    if (onContactDriver) return onContactDriver(driverInfo);
    if (driverInfo.phone) window.open(`tel:${driverInfo.phone}`);
  };

  const fmtMi = (mi) => (mi == null ? '—' : mi < 0.1 ? `${Math.round(mi * 5280)} ft` : `${mi.toFixed(1)} mi`);
  const showDriverCard = ['driver_assigned', 'driver_arriving', 'arrived', 'in_progress'].includes(ride.status) && driverInfo.name;
  const canCancel = ['searching_driver', 'timeout', 'driver_assigned', 'driver_arriving'].includes(ride.status);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=JetBrains+Mono:wght@400;500;700;800&family=Syne:wght@600;700;800&display=swap');
        @keyframes arBlink{0%,100%{opacity:1}50%{opacity:.25}}
        @keyframes arUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes arDots{0%,100%{opacity:1}50%{opacity:.3}}
      `}</style>
      <div style={{ position: 'fixed', inset: 0, background: C.bg, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* top bar */}
        <div style={{ position: 'relative', zIndex: 40, height: 34, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', background: 'linear-gradient(180deg,rgba(3,6,4,.9),rgba(3,6,4,0))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: COND, fontSize: 12, fontWeight: 800, letterSpacing: '.24em', color: 'rgba(255,255,255,.55)' }}>UATOB</span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.inkFade }}>·</span>
            <span style={{ fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.16em', color: sc.color, textShadow: `0 0 8px ${sc.color}88`, animation: 'arBlink 2.4s ease-in-out infinite' }}>{sc.label.toUpperCase()}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.greenBright, boxShadow: `0 0 7px ${C.greenBright}`, animation: 'arBlink 1.6s ease-in-out infinite' }} />
              <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 800, color: C.greenBright }}>LIVE</span>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,.4)' }}>{clock}</span>
          </div>
        </div>

        {/* map */}
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
          <TrackMap pickup={pickup} dropoff={dropoff} driver={driver} polyline={ride.polyline} phase={sc.phase} />

          {/* status card */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0 12px 16px', animation: 'arUp .5s cubic-bezier(.34,1.16,.64,1) both' }}>
            <div style={{ background: 'rgba(6,12,7,.94)', backdropFilter: 'blur(18px)', border: `1.5px solid ${C.borderBright}`, borderRadius: 22, padding: '15px 16px', boxShadow: '0 -6px 40px rgba(0,0,0,.6), 0 0 30px rgba(34,197,94,.08)' }}>
              {/* status row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: showDriverCard ? 13 : 4 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, background: `${sc.color}18`, border: `1.5px solid ${sc.color}44` }}>{sc.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: BODY, fontSize: 14.5, fontWeight: 700, color: C.inkBright }}>
                    {sc.label}
                    {sc.phase === 'search' && <span style={{ display: 'inline-flex', gap: 3, marginLeft: 6, verticalAlign: 'middle' }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: C.amber, animation: `arDots 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}</span>}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 9.5, color: sc.color, marginTop: 3 }}>{sc.sub}</div>
                </div>
                {leg && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 800, color: C.greenBright }}>{leg.min} min</div>
                    <div style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.1em', color: C.inkDim, textTransform: 'uppercase' }}>{fmtMi(leg.mi)}</div>
                  </div>
                )}
              </div>

              {/* driver card */}
              {showDriverCard && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 14, background: 'rgba(34,197,94,.06)', border: `1px solid ${C.border}`, marginBottom: 11 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, background: 'rgba(34,197,94,.12)', border: `2px solid ${C.green}` }}>
                    {driverInfo.photoURL ? <img src={driverInfo.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🧑‍✈️'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: BODY, fontSize: 13.5, fontWeight: 700, color: C.inkBright }}>{driverInfo.name || driverInfo.displayName || 'Your driver'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3, flexWrap: 'wrap' }}>
                      {driverInfo.rating != null && <span style={{ fontFamily: MONO, fontSize: 10, color: C.amber }}>★ {Number(driverInfo.rating).toFixed(1)}</span>}
                      {(driverInfo.vehicle || driverInfo.carModel) && <span style={{ fontFamily: COND, fontSize: 10.5, color: C.inkMid, letterSpacing: '.03em' }}>{driverInfo.vehicle || driverInfo.carModel}</span>}
                      {driverInfo.licensePlate && <span style={{ fontFamily: MONO, fontSize: 9, color: C.inkMid, padding: '1px 5px', borderRadius: 4, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)' }}>{driverInfo.licensePlate}</span>}
                    </div>
                  </div>
                  {driverInfo.phone && (
                    <button onClick={contact} aria-label="Call driver" style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, cursor: 'pointer', background: 'rgba(34,197,94,.12)', border: `1.5px solid ${C.border}`, color: C.greenBright, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📞</button>
                  )}
                </div>
              )}

              {/* route line */}
              {(ride.pickup || ride.dropoff) && (
                <div style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.02)', border: `1px solid ${C.inkFade}`, marginBottom: canCancel ? 11 : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.cyan }} />
                    <span style={{ width: 1.5, flex: 1, minHeight: 12, background: 'linear-gradient(180deg,#22D3EE,#4ADE80)', opacity: .4, margin: '2px 0' }} />
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.greenBright }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {[ride.pickup, ride.dropoff].map((a, i) => <div key={i} style={{ fontFamily: BODY, fontSize: 12, fontWeight: 600, color: C.inkMid, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a || '—'}</div>)}
                  </div>
                  {ride.fareTotal != null && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 800, color: C.greenBright }}>${Number(ride.fareTotal).toFixed(2)}</div>
                      <div style={{ fontFamily: COND, fontSize: 8.5, fontWeight: 800, letterSpacing: '.1em', color: C.inkDim, textTransform: 'uppercase' }}>{ride.paymentMethod === 'credit' ? 'Credit' : 'Cash'}</div>
                    </div>
                  )}
                </div>
              )}

              {canCancel && (
                <button onClick={cancel} disabled={canceling} style={{
                  width: '100%', cursor: canceling ? 'wait' : 'pointer', borderRadius: 13, padding: 13,
                  fontFamily: COND, fontSize: 14, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase',
                  color: C.red, background: 'rgba(248,113,113,.08)', border: '1.5px solid rgba(248,113,113,.35)', opacity: canceling ? .6 : 1,
                }}>{canceling ? 'Canceling…' : 'Cancel ride'}</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
