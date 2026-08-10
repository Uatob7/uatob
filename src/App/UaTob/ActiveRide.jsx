// ActiveRide.jsx
// Active-ride screen in the new UaTob design — replaces the legacy full-screen
// HUD once a ride is in flight. Live driver tracking map + a clean status card
// (finding driver → en route → arrived → on the trip) with driver details.

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { getFirestore, doc, collection, addDoc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';
import TrackMap from '@/App/UaTob/TrackMap';
import { C, MONO, COND, BODY } from '@/App/UaTob/theme';

const db = getFirestore(firebase_app);

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
  // Drivers store firstName/lastName, not a single `name` — build one so the
  // driver card (which holds the message button) always shows once assigned.
  const driverName = driverInfo.name || driverInfo.displayName
    || [driverInfo.firstName, driverInfo.lastName].filter(Boolean).join(' ')
    || 'Your driver';
  // `vehicle` on a Driver doc is a map {year,make,model,color,plate,…} — format it
  // to a string (rendering the raw object crashes React).
  const _v = driverInfo.vehicle;
  const vehicleText = _v && typeof _v === 'object'
    ? [_v.color, _v.year, _v.make, _v.model].filter(Boolean).join(' ')
    : (typeof _v === 'string' ? _v : (driverInfo.carModel || ''));
  const plateText = driverInfo.licensePlate || (_v && typeof _v === 'object' ? _v.plate : null) || null;
  const showDriverCard = ['driver_assigned', 'driver_arriving', 'arrived', 'in_progress'].includes(ride.status) && !!driverUid;
  const canCancel = ['searching_driver', 'timeout', 'driver_assigned', 'driver_arriving'].includes(ride.status);

  // ── in-ride chat with the driver (Rides/{id}/Messages, same schema the
  //    driver's ActiveTripScreen reads/writes) ──────────────────────────────
  const [showChat,    setShowChat]    = useState(false);
  const [messages,    setMessages]    = useState([]);
  const [chatInput,   setChatInput]   = useState('');
  const [chatSending, setChatSending] = useState(false);

  useEffect(() => {
    if (!ride?.id) return;
    const unsub = onSnapshot(collection(db, 'Rides', ride.id, 'Messages'), (snap) => {
      setMessages(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0)),
      );
    }, () => {});
    return () => unsub();
  }, [ride?.id]);

  const unreadFromDriver = messages.filter((m) => m.senderRole === 'driver' && !m.readByRider).length;

  useEffect(() => {
    if (!showChat || !ride?.id) return;
    messages.filter((m) => m.senderRole === 'driver' && !m.readByRider)
      .forEach((m) => updateDoc(doc(db, 'Rides', ride.id, 'Messages', m.id), { readByRider: true }).catch(() => {}));
  }, [showChat, messages, ride?.id]);

  const sendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || !ride?.id || chatSending) return;
    setChatSending(true);
    try {
      await addDoc(collection(db, 'Rides', ride.id, 'Messages'), {
        text, senderUid: uid, senderRole: 'rider',
        createdAt: serverTimestamp(), readByRider: true, readByDriver: false,
      });
      setChatInput('');
    } catch (e) { console.warn('[ActiveRide] send failed', e?.message || e); }
    finally { setChatSending(false); }
  }, [chatInput, ride?.id, uid, chatSending]);

  // ── report this ride (filed to Support) ───────────────────────────────────
  const [showReport,    setShowReport]    = useState(false);
  const [reportSending, setReportSending] = useState(false);
  const [reportDone,    setReportDone]    = useState(false);

  const submitReport = useCallback(async (reason) => {
    if (!ride?.id || reportSending) return;
    setReportSending(true);
    try {
      await addDoc(collection(db, 'Support'), {
        uid, type: 'ride_report', rideId: ride.id, driverUid: driverUid || null,
        reason, pickup: ride.pickup ?? null, dropoff: ride.dropoff ?? null,
        status: 'open', createdAt: serverTimestamp(),
      });
      setReportDone(true);
    } catch (e) { console.warn('[ActiveRide] report failed', e?.message || e); }
    finally { setReportSending(false); }
  }, [ride, uid, driverUid, reportSending]);

  return (
    <>
      <style>{`
        @keyframes arBlink{0%,100%{opacity:1}50%{opacity:.25}}
        @keyframes arUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes arDots{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes scRing{0%{transform:scale(.32);opacity:.7}100%{transform:scale(1);opacity:0}}
        @keyframes scSweep{to{transform:rotate(360deg)}}
        @keyframes scBar{0%,100%{transform:scaleX(0);opacity:.5}50%{transform:scaleX(1);opacity:1}}
      `}</style>
      <div style={{ position: 'fixed', inset: 0, background: C.bg, overflow: 'hidden', color: C.inkBright, display: 'flex', flexDirection: 'column' }}>
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
          <TrackMap pickup={pickup} dropoff={dropoff} driver={driver} stops={ride.stops} polyline={sc.phase === 'toPickup' ? (ride.driverEtaPolyline || ride.polyline) : sc.phase === 'trip' ? (ride.driverToDropoffPolyline || ride.polyline) : ride.polyline} phase={sc.phase} />

          {/* status card */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0 12px 16px', animation: 'arUp .5s cubic-bezier(.34,1.16,.64,1) both' }}>
            {sc.phase === 'search' ? (
              <SearchingCard ride={ride} canCancel={canCancel} onCancel={cancel} canceling={canceling} onReport={() => { setShowReport(true); setReportDone(false); }} />
            ) : (
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
                    {(driverInfo.profilePhotoUrl || driverInfo.photoURL) ? <img src={driverInfo.profilePhotoUrl || driverInfo.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🧑‍✈️'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: BODY, fontSize: 13.5, fontWeight: 700, color: C.inkBright }}>{driverName}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3, flexWrap: 'wrap' }}>
                      {driverInfo.rating != null && <span style={{ fontFamily: MONO, fontSize: 10, color: C.amber }}>★ {Number(driverInfo.rating).toFixed(1)}</span>}
                      {vehicleText && <span style={{ fontFamily: COND, fontSize: 10.5, color: C.inkMid, letterSpacing: '.03em' }}>{vehicleText}</span>}
                      {plateText && <span style={{ fontFamily: MONO, fontSize: 9, color: C.inkMid, padding: '1px 5px', borderRadius: 4, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)' }}>{plateText}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => setShowChat(true)} aria-label="Message driver" style={{ position: 'relative', width: 38, height: 38, borderRadius: 11, cursor: 'pointer', background: 'rgba(34,197,94,.12)', border: `1.5px solid ${C.border}`, color: C.greenBright, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                      💬
                      {unreadFromDriver > 0 && (
                        <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: C.red, color: '#150404', fontFamily: MONO, fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #050A06' }}>{unreadFromDriver}</span>
                      )}
                    </button>
                    {driverInfo.phone && (
                      <button onClick={contact} aria-label="Call driver" style={{ width: 38, height: 38, borderRadius: 11, cursor: 'pointer', background: 'rgba(34,197,94,.12)', border: `1.5px solid ${C.border}`, color: C.greenBright, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📞</button>
                    )}
                  </div>
                </div>
              )}

              {/* route line */}
              {(ride.pickup || ride.dropoff) && (
                <div style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.02)', border: `1px solid ${C.inkFade}`, marginBottom: canCancel ? 11 : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.cyan }} />
                    <span style={{ width: 1.5, flex: 1, minHeight: 12, background: 'linear-gradient(180deg,#3FD0EE,#2FE08A)', opacity: .4, margin: '2px 0' }} />
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.greenBright }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {[ride.pickup, ...(Array.isArray(ride.stops) ? ride.stops.map((s) => s?.address) : []), ride.dropoff].map((a, i) => <div key={i} style={{ fontFamily: BODY, fontSize: 12, fontWeight: 600, color: C.inkMid, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a || '—'}</div>)}
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

              <button onClick={() => { setShowReport(true); setReportDone(false); }} style={{
                width: '100%', marginTop: canCancel ? 10 : 0, background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: MONO, fontSize: 10, color: C.inkDim, textDecoration: 'underline', textAlign: 'center', padding: 4,
              }}>Report a problem with this ride</button>
            </div>
            )}
          </div>
        </div>
      </div>

      {showChat && (
        <ChatSheet
          messages={messages} value={chatInput} onChange={setChatInput}
          onSend={sendChat} sending={chatSending}
          driverName={driverName}
          onClose={() => setShowChat(false)}
        />
      )}

      {showReport && (
        <ReportSheet
          done={reportDone} sending={reportSending}
          onSubmit={submitReport} onClose={() => setShowReport(false)}
        />
      )}
    </>
  );
}

// ── Searching-for-a-driver card ───────────────────────────────────────────────
// A dedicated, premium "Finding your driver" state: a live radar showing how
// many nearby drivers the request is being broadcast to, an elapsed timer, the
// search radius (which the settle cron widens over time), and the full trip
// route with every stop.
function tsMs(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  if (ts._seconds) return ts._seconds * 1000;
  return 0;
}

function SearchingCard({ ride, canCancel, onCancel, canceling, onReport }) {
  const started = tsMs(ride.dispatchedAt) || tsMs(ride.createdAt) || Date.now();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const elapsed = Math.max(0, Math.floor((now - started) / 1000));
  const mm = Math.floor(elapsed / 60), ss = elapsed % 60;
  const elapsedStr = `${mm}:${String(ss).padStart(2, '0')}`;

  const pinged = Array.isArray(ride.candidateDriverUids) ? ride.candidateDriverUids.length : 0;
  const radius = ride.dispatchRadiusMi || 20;
  const slow   = elapsed >= 45;

  const stops = Array.isArray(ride.stops) ? ride.stops : [];
  const nodes = [
    { addr: ride.pickup, label: 'Pickup', c: C.cyan, sq: false },
    ...stops.map((s, i) => ({ addr: s?.address, label: `Stop ${i + 1}`, c: C.amber, sq: false })),
    { addr: ride.dropoff, label: 'Destination', c: C.greenBright, sq: true },
  ];

  const Stat = ({ label, value, hi }) => (
    <div style={{ flex: 1, textAlign: 'center', padding: '9px 6px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: `1px solid ${C.border}` }}>
      <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, color: hi ? C.cyan : C.inkBright, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontFamily: COND, fontSize: 8.5, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: C.inkDim, marginTop: 3 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ background: 'rgba(6,12,7,.95)', backdropFilter: 'blur(18px)', border: `1.5px solid ${C.borderBright}`, borderRadius: 24, padding: '18px 16px 15px', boxShadow: '0 -6px 40px rgba(0,0,0,.6), 0 0 40px rgba(63,208,238,.08)' }}>
      {/* radar hero */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 118, height: 118, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ position: 'absolute', width: 118, height: 118, borderRadius: '50%', border: `1.5px solid ${C.cyan}55`, animation: `scRing 2.6s ease-out ${i * 0.85}s infinite` }} />
          ))}
          <span style={{ position: 'absolute', width: 118, height: 118, borderRadius: '50%', background: `conic-gradient(from 0deg, ${C.cyan}44, transparent 62%)`, WebkitMask: 'radial-gradient(circle, transparent 24px, #000 25px)', mask: 'radial-gradient(circle, transparent 24px, #000 25px)', animation: 'scSweep 2.4s linear infinite' }} />
          <div style={{ position: 'relative', width: 64, height: 64, borderRadius: '50%', background: 'rgba(4,10,8,.92)', border: `1.5px solid ${C.cyan}66`, boxShadow: `0 0 24px ${C.cyan}44`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontFamily: COND, fontSize: 26, fontWeight: 900, color: C.cyan, lineHeight: 1 }}>{pinged}</div>
            <div style={{ fontFamily: MONO, fontSize: 7, fontWeight: 800, letterSpacing: '.1em', color: C.inkMid, textTransform: 'uppercase', marginTop: 1 }}>nearby</div>
          </div>
        </div>

        <div style={{ fontFamily: COND, fontSize: 23, fontWeight: 900, color: C.inkBright, letterSpacing: '-.01em', marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          {slow ? 'Still searching' : 'Finding your driver'}
          <span style={{ display: 'inline-flex', gap: 3 }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: C.cyan, animation: `arDots 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}</span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: C.inkMid, marginTop: 4 }}>
          {pinged > 0 ? `Broadcasting to ${pinged} driver${pinged > 1 ? 's' : ''} nearby` : (slow ? 'Widening the search…' : 'Broadcasting to drivers nearby')}
        </div>
      </div>

      {/* stats */}
      <div style={{ display: 'flex', gap: 8, margin: '14px 0 12px' }}>
        <Stat label="Searching" value={elapsedStr} hi />
        <Stat label="Drivers" value={String(pinged)} />
        <Stat label="Radius" value={`${radius} mi`} />
      </div>

      {/* route with every stop */}
      <div style={{ display: 'flex', gap: 12, padding: '12px 13px', borderRadius: 14, background: 'rgba(255,255,255,.02)', border: `1px solid ${C.inkFade}`, marginBottom: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3 }}>
          {nodes.map((n, i) => (
            <div key={i} style={{ display: 'contents' }}>
              <span style={{ width: 8, height: 8, borderRadius: n.sq ? 2 : '50%', background: n.c, boxShadow: `0 0 7px ${n.c}` }} />
              {i < nodes.length - 1 && <span style={{ width: 1.5, flex: 1, minHeight: 16, background: n.c, opacity: .35, margin: '2px 0' }} />}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
          {nodes.map((n, i) => (
            <div key={i} style={{ minWidth: 0 }}>
              <div style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: n.c }}>{n.label}</div>
              <div style={{ fontFamily: BODY, fontSize: 12.5, fontWeight: 600, color: C.inkBright, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.addr || '—'}</div>
            </div>
          ))}
        </div>
        {ride.fareTotal != null && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, color: C.greenBright }}>${Number(ride.fareTotal).toFixed(2)}</div>
            <div style={{ fontFamily: COND, fontSize: 8.5, fontWeight: 800, letterSpacing: '.1em', color: C.inkDim, textTransform: 'uppercase' }}>{ride.paymentMethod === 'credit' ? 'Credit' : 'Cash'}</div>
          </div>
        )}
      </div>

      {canCancel && (
        <button onClick={onCancel} disabled={canceling} style={{
          width: '100%', cursor: canceling ? 'wait' : 'pointer', borderRadius: 13, padding: 13,
          fontFamily: COND, fontSize: 14, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase',
          color: C.red, background: 'rgba(248,113,113,.08)', border: '1.5px solid rgba(248,113,113,.35)', opacity: canceling ? .6 : 1,
        }}>{canceling ? 'Canceling…' : 'Cancel ride'}</button>
      )}
      <button onClick={onReport} style={{
        width: '100%', marginTop: canCancel ? 10 : 0, background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: MONO, fontSize: 10, color: C.inkDim, textDecoration: 'underline', textAlign: 'center', padding: 4,
      }}>Report a problem with this ride</button>
    </div>
  );
}

// ── Chat sheet ────────────────────────────────────────────────────────────────
function ChatSheet({ messages, value, onChange, onSend, sending, driverName, onClose }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(2,5,3,.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end',
    }}>
      <div style={{
        width: '100%', maxHeight: '78%', display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(180deg,rgba(8,16,10,.99),rgba(4,8,5,1))',
        borderTop: `1.5px solid ${C.borderBright}`, borderRadius: '24px 24px 0 0',
        boxShadow: '0 -20px 60px rgba(0,0,0,.7)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', borderBottom: `1px solid ${C.inkFade}` }}>
          <div style={{ fontFamily: COND, fontSize: 17, fontWeight: 800, color: C.inkBright }}>Message {driverName}</div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: C.inkMid, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.length === 0 && (
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.inkDim, textAlign: 'center', margin: 'auto', lineHeight: 1.6 }}>
              No messages yet.<br/>Say hi or share pickup details.
            </div>
          )}
          {messages.map((m) => {
            const mine = m.senderRole === 'rider';
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '76%', padding: '9px 12px', borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  fontFamily: BODY, fontSize: 13, lineHeight: 1.4,
                  color: mine ? '#04150a' : C.inkBright,
                  background: mine ? 'linear-gradient(135deg,#2FE08A,#17B673)' : 'rgba(255,255,255,.05)',
                  border: mine ? 'none' : `1px solid ${C.inkFade}`,
                }}>{m.text}</div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '10px 14px calc(14px + env(safe-area-inset-bottom))', borderTop: `1px solid ${C.inkFade}` }}>
          <input
            value={value} onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSend(); }}
            placeholder="Message…" autoFocus
            style={{ flex: 1, background: 'rgba(255,255,255,.04)', border: `1px solid ${C.border}`, borderRadius: 12, padding: '11px 14px', color: C.inkBright, fontFamily: BODY, fontSize: 14, outline: 'none' }}
          />
          <button onClick={onSend} disabled={sending || !value.trim()} aria-label="Send" style={{
            width: 46, borderRadius: 12, border: 'none', cursor: value.trim() ? 'pointer' : 'not-allowed',
            background: value.trim() ? 'linear-gradient(135deg,#2FE08A,#17B673)' : 'rgba(255,255,255,.06)',
            color: value.trim() ? '#04150a' : C.inkDim, fontSize: 17, fontWeight: 800, opacity: sending ? .6 : 1,
          }}>➤</button>
        </div>
      </div>
    </div>
  );
}

// ── Report sheet ──────────────────────────────────────────────────────────────
const REPORT_REASONS = ['Driver never arrived', 'Unsafe driving', 'Wrong route', 'Rude behavior', 'Vehicle issue', 'Other'];
function ReportSheet({ done, sending, onSubmit, onClose }) {
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: 'fixed', inset: 0, zIndex: 82, background: 'rgba(2,5,3,.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end',
    }}>
      <div style={{
        width: '100%', background: 'linear-gradient(180deg,rgba(16,8,8,.99),rgba(8,4,4,1))',
        borderTop: '1.5px solid rgba(248,113,113,.4)', borderRadius: '24px 24px 0 0',
        padding: '14px 18px calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -20px 60px rgba(0,0,0,.7)',
      }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: C.inkFade, margin: '0 auto 14px' }} />
        {done ? (
          <div style={{ textAlign: 'center', padding: '10px 0 6px' }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>✅</div>
            <div style={{ fontFamily: COND, fontSize: 18, fontWeight: 800, color: C.inkBright, marginBottom: 6 }}>Report sent</div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.inkMid, lineHeight: 1.5 }}>Our team will review it. You can also cancel the ride if you feel unsafe.</div>
            <button onClick={onClose} style={{ marginTop: 16, width: '100%', borderRadius: 13, padding: 13, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,.04)', color: C.inkBright, fontFamily: COND, fontSize: 14, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ fontFamily: COND, fontSize: 20, fontWeight: 800, color: C.inkBright, marginBottom: 4 }}>Report this ride</div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.inkMid, marginBottom: 16 }}>Pick what happened — it goes straight to support.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {REPORT_REASONS.map((r) => (
                <button key={r} onClick={() => onSubmit(r)} disabled={sending} style={{
                  width: '100%', textAlign: 'left', padding: '13px 15px', borderRadius: 12, cursor: sending ? 'wait' : 'pointer',
                  border: `1px solid ${C.border}`, background: 'rgba(255,255,255,.03)', color: C.inkBright,
                  fontFamily: BODY, fontSize: 13.5, fontWeight: 600, opacity: sending ? .6 : 1,
                }}>{r}</button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
