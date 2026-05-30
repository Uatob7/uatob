import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Clock, Car, CheckCircle, RotateCcw, Loader2, Bell,
  AlertCircle, MapPin, Phone, Check, X, Share2,
  ChevronDown, ChevronUp, Shield, Navigation,
} from 'lucide-react';
import { THEME as T } from '@/App/UaTob/pricing.js';
import { doc, deleteDoc, onSnapshot, getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getMessaging, getToken } from 'firebase/messaging';
import { firebase_app } from '@/firebase/config';


const db        = getFirestore(firebase_app);
const functions = getFunctions(firebase_app, 'us-east1');
const callableExtendRideSearch = httpsCallable(functions, 'extendRideSearch');
const callableSaveRiderToken   = httpsCallable(functions, 'saveRiderFcmToken');
const callRiderLocation        = httpsCallable(functions, 'riderLocation');
const callableCancelRide       = httpsCallable(functions, 'cancelRide');
const callableUpdateRiderPhone = httpsCallable(functions, 'updateRiderPhone');

const VAPID_KEY        = 'BJ_sRHZonSGCKk2mB2i9ofTRS8ouFVMV-I15FX4sqdUXHyVb1lo6H-N4GMPrlcIIshRlykQicaxkxxFxcYcI4JQ';
const SEARCH_LIMIT_SEC = 7 * 60;
const PHONE_SKIP_KEY   = (rideId) => `uatob_phone_skipped_${rideId}`;
const PANEL_INTERVAL   = 4500;

// ── Helpers ────────────────────────────────────────────────────────────────
function getSecondsRemaining(expiresAt) {
  if (!expiresAt) return null; // null = not yet set
  const ms = expiresAt instanceof Date
    ? expiresAt.getTime()
    : expiresAt?.toDate?.()?.getTime?.() ?? new Date(expiresAt).getTime();
  if (!ms || isNaN(ms)) return null;
  return Math.max(0, Math.floor((ms - Date.now()) / 1000));
}

function formatUsPhone(raw) {
  const d = String(raw ?? '').replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0,3)}) ${d.slice(3)}`;
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
}

function digitsOnly(s) { return String(s ?? '').replace(/\D/g, ''); }

function formatTime(ts) {
  if (!ts) return null;
  const d = ts instanceof Date ? ts : ts?.toDate?.() ?? new Date(ts);
  if (isNaN(d)) return null;
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDateTime(ts) {
  if (!ts) return null;
  const d = ts instanceof Date ? ts : ts?.toDate?.() ?? new Date(ts);
  if (isNaN(d)) return null;
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function paymentLabel(method) {
  if (!method) return null;
  const map = { cashapp: 'Cash App', card: 'Card', cash: 'Cash', apple_pay: 'Apple Pay', google_pay: 'Google Pay' };
  return map[method.toLowerCase()] ?? method;
}

// ── Radar SVG overlay ──────────────────────────────────────────────────────
function RadarOverlay({ sweepAngle }) {
  const toRad = deg => (deg * Math.PI) / 180;
  const R = 55;
  const trailAngle = sweepAngle;
  const leadAngle  = (sweepAngle + 90) % 360;
  const trailX = 50 + R * Math.cos(toRad(trailAngle));
  const trailY = 50 + R * Math.sin(toRad(trailAngle));
  const leadX  = 50 + R * Math.cos(toRad(leadAngle));
  const leadY  = 50 + R * Math.sin(toRad(leadAngle));
  const tipX   = 50 + 52 * Math.cos(toRad(leadAngle));
  const tipY   = 50 + 52 * Math.sin(toRad(leadAngle));
  return (
    <svg style={{ position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:2 }}
      viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <radialGradient id="cmSweepGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(34,197,94,0.35)"/>
          <stop offset="40%"  stopColor="rgba(34,197,94,0.10)"/>
          <stop offset="100%" stopColor="rgba(34,197,94,0)"/>
        </radialGradient>
      </defs>
      {[14,26,38,50].map((r,i) => (
        <circle key={i} cx="50" cy="50" r={r} fill="none"
          stroke="rgba(34,197,94,0.09)" strokeWidth="0.25" strokeDasharray="1.2 2.2"/>
      ))}
      <path d={`M 50 50 L ${trailX} ${trailY} A ${R} ${R} 0 0 1 ${leadX} ${leadY} Z`}
        fill="url(#cmSweepGrad)" opacity="0.5"/>
      <line x1="50" y1="50" x2={leadX} y2={leadY}
        stroke="#4ADE80" strokeWidth="0.35" strokeLinecap="round" opacity="0.7"/>
      <circle cx={tipX} cy={tipY} r="1.1" fill="#4ADE80" opacity="0.8"/>
      <circle cx={tipX} cy={tipY} r="2.0" fill="rgba(74,222,128,0.18)" opacity="0.8"/>
      <line x1="47.5" y1="50" x2="52.5" y2="50" stroke="rgba(34,197,94,0.35)" strokeWidth="0.25"/>
      <line x1="50" y1="47.5" x2="50" y2="52.5" stroke="rgba(34,197,94,0.35)" strokeWidth="0.25"/>
      <circle cx="50" cy="50" r="0.8" fill="rgba(74,222,128,0.7)"/>
    </svg>
  );
}

// ── Meta chip ──────────────────────────────────────────────────────────────
function MetaChip({ label, value, align = 'flex-start' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: align, flexShrink: 0 }}>
      <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.28)' }}>
        {label}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.55)', fontFamily: 'monospace' }}>
        {value}
      </div>
    </div>
  );
}

function MetaDivider() {
  return <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,.06)' }}/>;
}

// ── Cycling info card ──────────────────────────────────────────────────────
function CyclingCard({
  secondsLeft, isUrgent, progress, total, miles,
  candidateDrivers,
  rideId, riderUid,
  accountPhone, phoneSkipped,
  onPhoneSaved, onPhoneSkip,
  paymentMethod, createdAt, requestSentAt,
  notifDone, locationDone,
  onNotifAllow, onLocationAllow,
}) {
  const autoRef = useRef(null);

  // secondsLeft === null means expiresAt not yet on the doc
  const isPending = secondsLeft === null;
  const minutes   = isPending ? null : Math.floor(secondsLeft / 60);
  const seconds   = isPending ? null : secondsLeft % 60;

  const needsPhone = accountPhone !== null && !accountPhone && !phoneSkipped && !!riderUid;
  const needsNotif = !notifDone;
  const needsLoc   = !locationDone;

  const activePanels = useMemo(() => {
    const list = [0, 1];
    if (needsNotif) list.push(2);
    if (needsLoc)   list.push(3);
    if (needsPhone) list.push(4);
    list.push(5);
    return list;
  }, [needsNotif, needsLoc, needsPhone]);

  const [activeIdx, setActiveIdx] = useState(0);
  const panelId = activePanels[activeIdx] ?? 0;

  const advance = useCallback(() => {
    setActiveIdx(i => (i + 1) % activePanels.length);
  }, [activePanels.length]);

  useEffect(() => {
    clearInterval(autoRef.current);
    autoRef.current = setInterval(advance, PANEL_INTERVAL);
    return () => clearInterval(autoRef.current);
  }, [advance]);

  const goIdx = (i) => {
    setActiveIdx(i);
    clearInterval(autoRef.current);
    autoRef.current = setInterval(advance, PANEL_INTERVAL);
  };

  const accentColor  = isUrgent ? '#EF4444' : '#22C55E';
  const accentBg     = isUrgent ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.06)';
  const accentBorder = isUrgent ? 'rgba(239,68,68,0.22)' : 'rgba(34,197,94,0.16)';
  const accentMuted  = isUrgent ? 'rgba(252,165,165,.55)' : 'rgba(134,239,172,.5)';

  const panelLabels = ['Timer','Nearby','Alerts','Location','Phone','Share'];

  // Phone state
  const [phoneVal, setPhoneVal]       = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneErr, setPhoneErr]       = useState('');
  const [phoneDone, setPhoneDone]     = useState(false);

  const phoneDigits  = digitsOnly(phoneVal);
  const phoneValid   = phoneDigits.length === 10 || (phoneDigits.length === 11 && phoneDigits[0] === '1');
  const canSavePhone = phoneValid && !phoneSaving && !phoneDone;

  const handleSavePhone = async () => {
    if (!canSavePhone) return;
    setPhoneSaving(true); setPhoneErr('');
    try {
      const { data } = await callableUpdateRiderPhone({ uid: riderUid, phone: phoneDigits });
      if (data?.success) { setPhoneDone(true); setTimeout(() => onPhoneSaved?.(data.phone), 800); }
      else throw new Error('Update failed');
    } catch (e) { setPhoneErr(e?.message || "Couldn't save."); }
    finally { setPhoneSaving(false); }
  };

  // Notif state
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifErr, setNotifErr]         = useState('');

  const handleNotifAllow = async () => {
    setNotifLoading(true); setNotifErr('');
    try { await onNotifAllow(); }
    catch (e) { setNotifErr(e?.message || 'Permission failed'); }
    finally { setNotifLoading(false); }
  };

  // Location state
  const [locLoading, setLocLoading] = useState(false);
  const [locErr, setLocErr]         = useState('');

  const handleLocAllow = async () => {
    setLocLoading(true); setLocErr('');
    try { await onLocationAllow(); }
    catch (e) { setLocErr(e?.message || 'Could not get location'); }
    finally { setLocLoading(false); }
  };

  // Copy invite
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard?.writeText('https://uatob.com').catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const topDrivers = (candidateDrivers ?? [])
    .slice()
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
    .slice(0, 3);

  function driverDistLabel(mi) {
    const v = Number(mi ?? 0);
    if (v < 0.1) return `${Math.round(v * 5280)} ft`;
    return `${v.toFixed(1)} mi`;
  }

  const PANEL_MIN_H = 96;

  return (
    <div style={{
      background: accentBg,
      border: `1px solid ${accentBorder}`,
      borderRadius: 16,
      padding: '14px 16px',
      position: 'relative',
      overflow: 'hidden',
      animation: isUrgent ? 'timerBeat 1s ease-in-out infinite' : 'none',
    }}>
      {/* Shimmer */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(105deg,transparent 38%,rgba(255,255,255,.012) 50%,transparent 62%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 3s linear infinite',
        pointerEvents: 'none',
      }}/>

      <div style={{ position: 'relative' }}>

        {/* ── Top row: timer | fare ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '.13em',
              textTransform: 'uppercase', color: accentMuted, marginBottom: 3,
            }}>
              {isPending ? 'Searching' : isUrgent ? '⚡ Almost out of time' : 'Time remaining'}
            </div>

            {/* ── Timer display — pending vs counting ── */}
            {isPending ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42 }}>
                <Loader2
                  size={18}
                  color={accentColor}
                  style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}
                />
                <span style={{
                  fontFamily: '"JetBrains Mono","Courier New",monospace',
                  fontSize: 16, fontWeight: 700, color: accentColor, letterSpacing: '-.5px',
                }}>
                  Finding drivers…
                </span>
              </div>
            ) : (
              <div style={{
                fontFamily: '"JetBrains Mono","Courier New",monospace',
                fontSize: 42, fontWeight: 700, lineHeight: 1, letterSpacing: '-3px',
                color: accentColor,
              }}>
                {String(minutes).padStart(2,'0')}
                <span style={{ opacity: .45, animation: 'timerBeat .5s ease-in-out infinite' }}>:</span>
                {String(seconds).padStart(2,'0')}
              </div>
            )}
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.13em', textTransform: 'uppercase', color: accentMuted, marginBottom: 2 }}>
              Fare
            </div>
            <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 20, fontWeight: 700, color: accentColor, lineHeight: 1 }}>
              ${total}
            </div>
          </div>
        </div>

        {/* Timer progress bar — hide when pending */}
        {!isPending && (
          <div style={{ height: 3, borderRadius: 99, background: 'rgba(255,255,255,.07)', marginBottom: 10, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: isUrgent ? 'linear-gradient(90deg,#F59E0B,#EF4444)' : 'linear-gradient(90deg,#22C55E,#16A34A)',
              borderRadius: 99, transition: 'width 1s linear',
            }}/>
          </div>
        )}
        {isPending && <div style={{ height: 3, marginBottom: 10 }}/>}

        {/* ── Meta strip ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          paddingBottom: 11, borderBottom: '1px solid rgba(255,255,255,.07)',
        }}>
          <MetaChip label="Created" value={formatTime(createdAt) ?? '—'} />
          <MetaDivider />
          <MetaChip label="Sent"    value={formatTime(requestSentAt) ?? '—'} />
          <MetaDivider />
          <MetaChip label="Trip"    value={`${miles} mi`} align="flex-end" />
        </div>

        {/* ── Panel switcher ── */}
        <div style={{ paddingTop: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {activePanels.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goIdx(i)}
                  style={{
                    width: i === activeIdx ? 16 : 6,
                    height: 6,
                    borderRadius: i === activeIdx ? 3 : '50%',
                    background: i === activeIdx ? accentColor : 'rgba(255,255,255,.18)',
                    border: 'none', padding: 0, cursor: 'pointer',
                    transition: 'all .25s', flexShrink: 0,
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.13em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)' }}>
              {panelLabels[panelId]}
            </div>
          </div>

          <div style={{ minHeight: PANEL_MIN_H }}>

            {/* 0 — Timer status */}
            {panelId === 0 && (
              <div key="p0" style={{ animation: 'fadeUp .28s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: PANEL_MIN_H, textAlign: 'center', gap: 6 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', fontWeight: 600, lineHeight: 1.5, maxWidth: 240 }}>
                  Sit tight — we're pinging nearby drivers.<br/>You'll hear from us the moment one accepts.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block', animation: 'blink 1.2s ease-in-out infinite' }}/>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#4ADE80', letterSpacing: '.06em' }}>Searching nearby</span>
                </div>
              </div>
            )}

            {/* 1 — Candidate drivers */}
            {panelId === 1 && (() => {
              const count   = (candidateDrivers ?? []).length;
              const closest = topDrivers[0];
              const hasAny  = count > 0;
              return (
                <div key="p1" style={{ animation: 'fadeUp .28s ease', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: PANEL_MIN_H }}>
                  {!hasAny ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0' }}>
                      <Loader2 size={13} color="rgba(255,255,255,.3)" style={{ animation: 'spin 1s linear infinite' }}/>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>Scanning for drivers…</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.25)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, boxShadow: '0 0 12px rgba(34,197,94,.15)',
                      }}>
                        <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: '#4ADE80', lineHeight: 1 }}>{count}</div>
                        <div style={{ fontSize: 7, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(74,222,128,.7)', marginTop: 1 }}>
                          {count === 1 ? 'driver' : 'drivers'}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,.9)', marginBottom: 3 }}>
                          {count} {count === 1 ? 'driver' : 'drivers'} pinged
                        </div>
                        {closest && (
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Navigation size={10} color="#4ADE80"/>
                            <span>Closest <span style={{ color: '#4ADE80', fontWeight: 700, fontFamily: 'monospace' }}>{driverDistLabel(closest.distance)}</span> away</span>
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ADE80', display: 'inline-block', animation: 'blink 1.2s ease-in-out infinite' }}/>
                          Waiting on a response
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 2 — Notifications */}
            {panelId === 2 && (
              <div key="p2" style={{ animation: 'fadeUp .28s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Bell size={13} color="#93C5FD" strokeWidth={2.2}/>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,.88)' }}>Get notified instantly</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.32)', marginTop: 1 }}>Know the second a driver accepts</div>
                  </div>
                </div>
                <button onClick={handleNotifAllow} disabled={notifLoading} style={{
                  width: '100%', padding: '9px', borderRadius: 10, border: 'none',
                  background: notifLoading ? 'rgba(29,78,216,.4)' : '#1D4ED8',
                  color: '#fff', fontSize: 12, fontWeight: 800,
                  cursor: notifLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}>
                  {notifLoading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }}/> : <Bell size={12}/>}
                  {notifLoading ? 'Connecting…' : 'Allow notifications'}
                </button>
                {notifErr && <div style={{ marginTop: 5, fontSize: 10, color: '#FCA5A5', textAlign: 'center' }}>{notifErr}</div>}
              </div>
            )}

            {/* 3 — Location */}
            {panelId === 3 && (
              <div key="p3" style={{ animation: 'fadeUp .28s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(34,197,94,.09)', border: '1px solid rgba(34,197,94,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MapPin size={13} color="#4ADE80" strokeWidth={2.2}/>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,.88)' }}>Share your location</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.32)', marginTop: 1 }}>So your driver can find you faster</div>
                  </div>
                </div>
                <button onClick={handleLocAllow} disabled={locLoading} style={{
                  width: '100%', padding: '9px', borderRadius: 10, border: 'none',
                  background: locLoading ? 'rgba(21,128,61,.4)' : '#15803D',
                  color: '#fff', fontSize: 12, fontWeight: 800,
                  cursor: locLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}>
                  {locLoading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }}/> : <MapPin size={12}/>}
                  {locLoading ? 'Getting location…' : 'Enable location'}
                </button>
                {locErr && <div style={{ marginTop: 5, fontSize: 10, color: '#FCA5A5', textAlign: 'center' }}>{locErr}</div>}
              </div>
            )}

            {/* 4 — Phone */}
            {panelId === 4 && (
              <div key="p4" style={{ animation: 'fadeUp .28s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(96,165,250,.09)', border: '1px solid rgba(96,165,250,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Phone size={13} color="#93C5FD" strokeWidth={2.2}/>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,.88)' }}>Add your phone number</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.32)', marginTop: 1 }}>So your driver can reach you</div>
                  </div>
                </div>
                {phoneDone ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Check size={11} color="#fff" strokeWidth={3}/>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#86EFAC' }}>Phone saved!</div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="tel" inputMode="tel" autoComplete="tel"
                        placeholder="(555) 123-4567"
                        value={phoneVal}
                        onChange={e => { setPhoneVal(formatUsPhone(e.target.value)); if (phoneErr) setPhoneErr(''); }}
                        onKeyDown={e => { if (e.key === 'Enter' && canSavePhone) { e.preventDefault(); handleSavePhone(); } }}
                        disabled={phoneSaving}
                        style={{
                          flex: 1, padding: '8px 11px', borderRadius: 9,
                          border: `1.5px solid ${phoneErr ? 'rgba(239,68,68,.5)' : 'rgba(255,255,255,.12)'}`,
                          background: 'rgba(255,255,255,.05)',
                          fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.9)',
                          fontFamily: 'inherit', outline: 'none',
                        }}
                      />
                      <button onClick={handleSavePhone} disabled={!canSavePhone} style={{
                        padding: '0 12px', borderRadius: 9, border: 'none',
                        background: canSavePhone ? '#15803D' : 'rgba(255,255,255,.07)',
                        color: canSavePhone ? '#fff' : 'rgba(255,255,255,.25)',
                        fontSize: 11, fontWeight: 800, cursor: canSavePhone ? 'pointer' : 'not-allowed',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {phoneSaving ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }}/> : 'Save'}
                      </button>
                    </div>
                    {phoneErr && <div style={{ marginTop: 5, fontSize: 10, color: '#FCA5A5' }}>{phoneErr}</div>}
                  </>
                )}
              </div>
            )}

            {/* 5 — Share */}
            {panelId === 5 && (
              <div key="p5" style={{ animation: 'fadeUp .28s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(167,139,250,.09)', border: '1px solid rgba(167,139,250,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Share2 size={13} color="#C4B5FD" strokeWidth={2.2}/>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,.88)' }}>Help UaTob grow</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.32)', marginTop: 1 }}>Share with anyone you know</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ flex: 1, padding: '8px 11px', borderRadius: 9, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', minWidth: 0 }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', fontWeight: 700, marginBottom: 1 }}>Invite link</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(167,139,250,.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>uatob.com</div>
                  </div>
                  <button onClick={handleCopy} style={{
                    padding: '0 12px', borderRadius: 9, border: 'none',
                    background: copied ? 'rgba(34,197,94,.2)' : 'rgba(167,139,250,.18)',
                    color: copied ? '#4ADE80' : '#C4B5FD',
                    fontSize: 11, fontWeight: 800, cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .2s',
                  }}>
                    {copied ? <Check size={13} strokeWidth={3}/> : 'Copy'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────
export default function ConfirmationModal({ onClose, onPaymentCancelled, onRetry, onCancel, account, rides }) {
  const [status, setStatus]               = useState('checking_payment');
  const [secondsLeft, setSecondsLeft]     = useState(null); // null = expiresAt not yet known
  const [driver, setDriver]               = useState(null);
  const [visible, setVisible]             = useState(false);
  const [collapsed, setCollapsed]         = useState(false);
  const [liveRide, setLiveRide]           = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError]     = useState('');
  const [sweepAngle, setSweepAngle]       = useState(0);
  const [accountPhone, setAccountPhone]   = useState(null);
  const [phoneSkipped, setPhoneSkipped]   = useState(false);
  const [mapReady, setMapReady]           = useState(false);
  const [notifDone, setNotifDone]         = useState(false);
  const [locationDone, setLocationDone]   = useState(false);

  const timerRef        = useRef(null);
  const closeTimeoutRef = useRef(null);
  const mountedRef      = useRef(true);
  const lastRideIdRef   = useRef(null);
  const unsubRef        = useRef(null);
  const accountUnsubRef = useRef(null);
  const notifDoneRef    = useRef(false);
  const didTimeoutRef   = useRef(false);
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);

  const seedRide = useMemo(() => {
    if (!rides?.length) return null;
    return rides.find(r => r.paymentStatus === 'succeeded' && r.status !== 'completed' && r.status !== 'cancelled')
      ?? rides.find(r => r.status === 'pending_payment')
      ?? null;
  }, [rides]);

  const currentRide = liveRide ?? seedRide;
  const rideId      = currentRide?.id ?? null;
  const riderUid    = currentRide?.uid ?? null;

  // Derived
  const total    = useMemo(() => { const v = Number(currentRide?.fareTotal ?? 0); return Number.isFinite(v) ? v.toFixed(2) : '0.00'; }, [currentRide]);
  const miles    = useMemo(() => { const v = Number(currentRide?.tripDistanceMiles ?? 0); return Number.isFinite(v) ? v.toFixed(1) : '0.0'; }, [currentRide]);
  const progress = useMemo(() => {
    if (!currentRide?.createdAt) return 0;
    const ms = currentRide.createdAt instanceof Date
      ? currentRide.createdAt.getTime()
      : currentRide.createdAt?.toDate?.()?.getTime?.() ?? new Date(currentRide.createdAt).getTime();
    if (isNaN(ms)) return 0;
    return (Math.min(SEARCH_LIMIT_SEC, Math.floor((Date.now() - ms) / 1000)) / SEARCH_LIMIT_SEC) * 100;
  }, [currentRide?.createdAt, secondsLeft]);

  // secondsLeft null = expiresAt pending; treat as not urgent
  const isPending = secondsLeft === null;
  const isUrgent  = !isPending && secondsLeft < 60;
  const minutes   = isPending ? null : Math.floor(secondsLeft / 60);
  const seconds   = isPending ? null : secondsLeft % 60;

  const pickup           = currentRide?.pickup  ?? '—';
  const dropoff          = currentRide?.dropoff ?? '—';
  const rideLabel        = currentRide?.rideLabel ?? currentRide?.rideType ?? 'Ride';
  const candidateDrivers = currentRide?.candidateDrivers ?? [];
  const paymentMethod    = currentRide?.paymentMethod ?? null;
  const createdAt        = currentRide?.createdAt ?? null;
  const requestSentAt    = currentRide?.requestSentAt ?? null;

  // Mount / unmount
  useEffect(() => {
    mountedRef.current = true;
    const t = setTimeout(() => { if (mountedRef.current) setVisible(true); }, 30);
    return () => {
      mountedRef.current = false;
      clearTimeout(t);
      clearTimeout(closeTimeoutRef.current);
      clearInterval(timerRef.current);
      try { unsubRef.current?.(); } catch {}
      try { accountUnsubRef.current?.(); } catch {}
    };
  }, []);

  // Radar sweep
  useEffect(() => {
    if (status !== 'searching') return;
    let angle = 0;
    const id = setInterval(() => { angle = (angle + 2) % 360; setSweepAngle(angle); }, 30);
    return () => clearInterval(id);
  }, [status]);

  // Ride snapshot
  useEffect(() => {
    if (!rideId || rideId === lastRideIdRef.current) return;
    lastRideIdRef.current = rideId;
    try { unsubRef.current?.(); } catch {}
    unsubRef.current = onSnapshot(doc(db, 'Rides', rideId), (snap) => {
      if (!snap.exists() || !mountedRef.current) return;
      setLiveRide({ id: snap.id, ...snap.data() });
    }, err => console.warn('[ConfirmationModal] snapshot error:', err));
  }, [rideId]);

  // Account snapshot
  useEffect(() => {
    if (!riderUid) return;
    try { accountUnsubRef.current?.(); } catch {}
    try {
      accountUnsubRef.current = onSnapshot(doc(db, 'Accounts', riderUid), (snap) => {
        if (!mountedRef.current) return;
        const data = snap.exists() ? snap.data() : null;
        setAccountPhone(data?.phone ?? '');
        if (data?.token && !notifDoneRef.current) {
          setNotifDone(true);
          notifDoneRef.current = true;
        }
      }, err => { console.warn(err); setAccountPhone(''); });
    } catch { setAccountPhone(''); }
    return () => { try { accountUnsubRef.current?.(); } catch {} };
  }, [riderUid]);

  // Phone skip
  useEffect(() => {
    if (!rideId) { setPhoneSkipped(false); return; }
    try { setPhoneSkipped(sessionStorage.getItem(PHONE_SKIP_KEY(rideId)) === '1'); }
    catch { setPhoneSkipped(false); }
  }, [rideId]);

  // Status machine
  useEffect(() => {
    if (!currentRide) return;
    const s = currentRide.status;
    if (s === 'pending_payment') {
      setStatus('checking_payment');
    } else if (s === 'searching_driver' || s === 'searching') {
      if (status === 'timeout') { didTimeoutRef.current = false; setStatus('searching'); setDriver(null); }
      else if (!didTimeoutRef.current) { setStatus('searching'); setDriver(null); }
    } else if (s === 'driver_assigned') {
      clearInterval(timerRef.current); timerRef.current = null;
      if (currentRide.driver) setDriver(currentRide.driver);
      setStatus('assigned');
    } else if (s === 'timeout' || s === 'cancelled') {
      clearInterval(timerRef.current); timerRef.current = null;
      setStatus('timeout');
    }
  }, [currentRide]); // eslint-disable-line

  // ── Countdown — null-safe: never timeout when expiresAt is missing ────────
  useEffect(() => {
    if (status !== 'searching') {
      clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    const update = () => {
      // expiresAt not yet written by the scheduler — hold at null, never timeout
      if (!currentRide?.expiresAt) {
        setSecondsLeft(null);
        return;
      }

      const remaining = getSecondsRemaining(currentRide.expiresAt);

      // getSecondsRemaining returned null (bad timestamp) — hold, don't timeout
      if (remaining === null) {
        setSecondsLeft(null);
        return;
      }

      setSecondsLeft(remaining);

      if (remaining <= 0 && !didTimeoutRef.current) {
        didTimeoutRef.current = true;
        clearInterval(timerRef.current);
        timerRef.current = null;
        setStatus('timeout');
      }
    };

    update();
    clearInterval(timerRef.current);
    timerRef.current = setInterval(update, 1000);
    return () => { clearInterval(timerRef.current); timerRef.current = null; };
  }, [status, currentRide?.expiresAt]); // eslint-disable-line

  // Auto-close on assigned
  useEffect(() => {
    if (status !== 'assigned') return;
    const t = setTimeout(() => { if (mountedRef.current) handleClose(); }, 1800);
    return () => clearTimeout(t);
  }, [status]); // eslint-disable-line

  // Auto-register FCM if already granted
  useEffect(() => {
    if (status !== 'searching' || notifDoneRef.current || !('Notification' in window)) return;
    if (window.Notification.permission === 'granted' && rideId && riderUid && !currentRide?.riderFcmToken) {
      registerRiderFcmToken(rideId, riderUid)
        .then(() => { setNotifDone(true); notifDoneRef.current = true; })
        .catch(err => console.warn('[Rider] Auto token failed:', err.message));
    }
    if (window.Notification.permission !== 'default') notifDoneRef.current = true;
  }, [status, rideId, riderUid, currentRide?.riderFcmToken]); // eslint-disable-line

  // Mapbox
  useEffect(() => {
    if (!visible || mapRef.current) return;
    const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';
    const script = document.createElement('script');
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
    script.async = true;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
    document.head.appendChild(link);
    document.head.appendChild(script);
    script.onload = () => {
      if (!mapContainerRef.current) return;
      const mapboxgl = window.mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [currentRide?.pickupLng ?? -81.3792, currentRide?.pickupLat ?? 28.5383],
        zoom: 14, pitch: 40, bearing: -20, interactive: false, attributionControl: false,
      });
      map.on('load', () => {
        mapRef.current = map; setMapReady(true);
        let bearing = -20;
        const drift = setInterval(() => { bearing += 0.04; map.setBearing(bearing); }, 100);
        map.on('remove', () => clearInterval(drift));
      });
    };
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; setMapReady(false); } };
  }, [visible]); // eslint-disable-line

  async function registerRiderFcmToken(rId, uid) {
    if (!('Notification' in window)) throw new Error('Push not supported');
    const permission = await window.Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Permission denied');
    const messaging = getMessaging(firebase_app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) throw new Error('Empty token');
    await callableSaveRiderToken({ rideId: rId, uid, token });
  }

  const handleNotifAllow = async () => {
    if (!rideId || !riderUid) throw new Error('Ride info missing');
    await registerRiderFcmToken(rideId, riderUid);
    setNotifDone(true); notifDoneRef.current = true;
  };

  const handleLocationAllow = async () => {
    const position = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 })
    );
    const { latitude: lat, longitude: lng } = position.coords;
    if (rideId) await callRiderLocation({ rideId, lat, lng }).catch(() => {});
    setLocationDone(true);
  };

  const handleSkipPhone = () => {
    setPhoneSkipped(true);
    if (rideId) { try { sessionStorage.setItem(PHONE_SKIP_KEY(rideId), '1'); } catch {} }
  };

  const handleClose = async () => {
    if (status === 'checking_payment' && rideId) {
      deleteDoc(doc(db, 'Rides', rideId)).catch(err => console.warn(err));
      setVisible(false); closeTimeoutRef.current = setTimeout(() => onPaymentCancelled?.(), 260); return;
    }
    setVisible(false); closeTimeoutRef.current = setTimeout(() => onClose?.(), 260);
  };

  const handleWaitMore = async () => {
    if (!rideId || !riderUid) return;
    setActionLoading(true); didTimeoutRef.current = false;
    try { await callableExtendRideSearch({ rideId, uid: riderUid }); }
    catch (err) { console.error('Extend error:', err); didTimeoutRef.current = true; }
    finally { setActionLoading(false); }
  };

  const handleCancelRide = async () => {
    if (!rideId || !riderUid) return;
    setCancelLoading(true); setCancelError('');
    try {
      await callableCancelRide({ rideId, uid: riderUid });
      onCancel?.({ rideId, uid: riderUid });
      setVisible(false); closeTimeoutRef.current = setTimeout(() => onClose?.(), 260);
    } catch (err) {
      setCancelError(err?.message || 'Could not cancel. Please try again.');
    } finally { setCancelLoading(false); }
  };

  return (
    <>
      <style>{`
        @keyframes spin        { to { transform: rotate(360deg); } }
        @keyframes slideUp     { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
        @keyframes fadeIn      { from { opacity:0; } to { opacity:1; } }
        @keyframes fadeUp      { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
        @keyframes assignedPop { 0%{transform:scale(.8);opacity:0} 60%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
        @keyframes shimmer     { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes timerBeat   { 0%,100%{transform:scale(1)} 50%{transform:scale(1.018)} }
        @keyframes blink       { 0%,100%{opacity:1} 50%{opacity:.2} }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0, zIndex: 999,
        transition: 'opacity .28s ease',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      }}>
        {/* Mapbox bg */}
        <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0 }}/>

        {/* Radar */}
        {mapReady && status === 'searching' && <RadarOverlay sweepAngle={sweepAngle}/>}

        {/* Scrim */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 3,
          background: 'linear-gradient(to bottom, rgba(0,0,0,.18) 0%, rgba(0,0,0,.05) 35%, rgba(0,0,0,.65) 100%)',
          pointerEvents: 'none',
        }}/>

        {/* Bottom sheet */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
          zIndex: 10,
        }}>
          <div style={{
            width: '100%', maxWidth: 440,
            background: 'rgba(10,14,20,0.96)',
            backdropFilter: 'blur(24px)',
            borderRadius: '24px 24px 0 0',
            border: '1px solid rgba(255,255,255,0.07)',
            borderBottom: 'none',
            boxShadow: '0 -24px 80px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,0.08)',
            overflow: 'hidden',
            transform: visible ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform .35s cubic-bezier(.34,1.2,.64,1)',
          }}>

            {/* Drag handle + collapse */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              paddingTop: 10, paddingBottom: 6, position: 'relative',
            }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }}/>
              <button
                onClick={() => setCollapsed(c => !c)}
                style={{
                  position: 'absolute', right: 14,
                  width: 26, height: 26, borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,.12)',
                  background: 'rgba(255,255,255,.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'rgba(255,255,255,.5)',
                  transition: 'all .2s',
                }}
              >
                {collapsed
                  ? <ChevronUp size={14} color="rgba(255,255,255,.5)"/>
                  : <ChevronDown size={14} color="rgba(255,255,255,.5)"/>
                }
              </button>
            </div>

            {/* Collapsed pill */}
            {collapsed && (
              <div style={{ padding: '6px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(134,239,172,.55)' }}>
                  {status === 'searching' ? 'Searching' : status === 'checking_payment' ? 'Verifying' : status}
                </div>
                {status === 'searching' && (
                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: isPending ? 13 : 22,
                    fontWeight: 700,
                    color: isUrgent ? '#EF4444' : '#22C55E',
                    letterSpacing: isPending ? 0 : '-2px',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {isPending
                      ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }}/> Searching…</>
                      : `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`
                    }
                  </div>
                )}
              </div>
            )}

            {!collapsed && (
              <>
                {/* ══ CHECKING PAYMENT ══ */}
                {status === 'checking_payment' && (
                  <div style={{ padding: '20px 24px 32px', textAlign: 'center' }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%',
                      background: 'rgba(96,165,250,0.12)',
                      border: '1.5px solid rgba(96,165,250,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}>
                      <Loader2 size={26} color="#60A5FA" style={{ animation: 'spin 1s linear infinite' }}/>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: 'rgba(255,255,255,.92)', marginBottom: 6, letterSpacing: '-0.4px' }}>
                      Verifying payment…
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: 28, lineHeight: 1.5 }}>
                      This only takes a moment.
                    </div>
                    <button onClick={handleClose} style={{
                      width: '100%', padding: '13px 0', borderRadius: 14,
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.05)',
                      fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,.5)', cursor: 'pointer',
                    }}>
                      Cancel
                    </button>
                  </div>
                )}

                {/* ══ SEARCHING ══ */}
                {status === 'searching' && (
                  <div>
                    {/* Urgency strip */}
                    <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: isPending ? '100%' : `${100 - progress}%`,
                        background: isUrgent
                          ? 'linear-gradient(90deg,#F59E0B,#EF4444)'
                          : 'linear-gradient(90deg,#22C55E,#16A34A)',
                        transition: isPending ? 'none' : 'width 1s linear, background .5s ease',
                        animation: isPending ? 'shimmer 2s linear infinite' : 'none',
                        backgroundSize: isPending ? '200% 100%' : 'auto',
                      }}/>
                    </div>

                    <div style={{ padding: '14px 18px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>

                      {/* Header row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 3 }}>
                            Searching for driver
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>
                            {formatDateTime(createdAt) ?? '—'}
                            {paymentMethod && (
                              <> &nbsp;·&nbsp; <span style={{ color: 'rgba(96,165,250,.65)' }}>{paymentLabel(paymentMethod)}</span></>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 99, background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.22)', fontSize: 10, fontWeight: 800, color: '#4ADE80' }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ADE80', animation: 'blink 1.5s ease-in-out infinite', display: 'inline-block' }}/>
                          Live
                        </div>
                      </div>

                      <CyclingCard
                        secondsLeft={secondsLeft}
                        isUrgent={isUrgent}
                        progress={progress}
                        total={total}
                        miles={miles}
                        candidateDrivers={candidateDrivers}
                        rideId={rideId}
                        riderUid={riderUid}
                        accountPhone={accountPhone}
                        phoneSkipped={phoneSkipped}
                        onPhoneSaved={(p) => setAccountPhone(p)}
                        onPhoneSkip={handleSkipPhone}
                        paymentMethod={paymentMethod}
                        createdAt={createdAt}
                        requestSentAt={requestSentAt}
                        notifDone={notifDone}
                        locationDone={locationDone}
                        onNotifAllow={handleNotifAllow}
                        onLocationAllow={handleLocationAllow}
                      />

                      {/* Route card */}
                      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '11px 13px' }}>
                        <div style={{ display: 'flex', gap: 11, alignItems: 'stretch' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3, flexShrink: 0 }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#60A5FA' }}/>
                            <div style={{ width: 1, flex: 1, minHeight: 12, background: 'linear-gradient(to bottom, rgba(96,165,250,0.4), rgba(34,197,94,0.4))', margin: '3px 0' }}/>
                            <div style={{ width: 7, height: 7, borderRadius: 2, background: '#22C55E', transform: 'rotate(45deg)' }}/>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.85)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pickup}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dropoff}</div>
                          </div>
                        </div>
                      </div>

                      {/* Cancel */}
                      <button onClick={handleCancelRide} disabled={cancelLoading} style={{
                        width: '100%', padding: '10px 0', borderRadius: 11,
                        border: '1px solid rgba(255,255,255,0.07)', background: 'transparent',
                        color: 'rgba(255,255,255,.32)', fontSize: 12, fontWeight: 600,
                        cursor: cancelLoading ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}>
                        {cancelLoading
                          ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }}/> Cancelling…</>
                          : 'Cancel ride'
                        }
                      </button>
                      {cancelError && <div style={{ fontSize: 11, color: '#FCA5A5', textAlign: 'center' }}>{cancelError}</div>}
                    </div>
                  </div>
                )}

                {/* ══ ASSIGNED ══ */}
                {status === 'assigned' && (
                  <div style={{ padding: '20px 22px 32px' }}>
                    <div style={{
                      background: 'linear-gradient(135deg,rgba(34,197,94,0.14),rgba(21,128,61,0.08))',
                      border: '1px solid rgba(34,197,94,0.25)',
                      borderRadius: 18, padding: '22px 20px',
                      textAlign: 'center', marginBottom: 16,
                      animation: 'fadeIn .35s ease both',
                    }}>
                      <div style={{
                        width: 60, height: 60, borderRadius: '50%',
                        background: 'rgba(34,197,94,0.15)',
                        border: '2px solid rgba(34,197,94,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 14px',
                        animation: 'assignedPop .5s cubic-bezier(.34,1.56,.64,1) both',
                      }}>
                        <CheckCircle size={30} color="#22C55E" strokeWidth={2}/>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#22C55E', letterSpacing: '-0.5px', marginBottom: 5 }}>
                        Driver matched!
                      </div>
                      <div style={{ fontSize: 13, color: 'rgba(134,239,172,.65)', fontWeight: 500 }}>
                        Your ride is confirmed and on the way
                      </div>
                    </div>
                    {driver && (
                      <div style={{
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 14, padding: '13px 14px',
                        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
                        animation: 'slideUp .4s cubic-bezier(.34,1.2,.64,1) .15s both',
                      }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                          background: 'linear-gradient(135deg,#22C55E,#15803D)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 17, fontWeight: 900, color: '#fff',
                        }}>
                          {driver.name?.[0] ?? '?'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,.9)' }}>{driver.name || 'Driver'}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>
                            {driver.vehicle || 'Vehicle'} · {driver.plate || 'Plate pending'}
                          </div>
                        </div>
                        {driver.rating && (
                          <div style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.3)', borderRadius: 8, padding: '4px 9px', fontSize: 12, fontWeight: 800, color: '#FED7AA' }}>
                            ★ {driver.rating}
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.18)',
                      borderRadius: 12, padding: '11px 14px', marginBottom: 16,
                      animation: 'slideUp .4s cubic-bezier(.34,1.2,.64,1) .22s both',
                    }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(134,239,172,.6)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Confirmed fare</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>{rideLabel} · {miles} mi</div>
                      </div>
                      <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 22, fontWeight: 700, color: '#22C55E' }}>${total}</div>
                    </div>
                    <button onClick={handleClose} style={{
                      width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
                      background: 'linear-gradient(135deg,#22C55E,#15803D)',
                      color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer',
                      animation: 'slideUp .4s cubic-bezier(.34,1.2,.64,1) .3s both',
                    }}>
                      Track My Ride
                    </button>
                  </div>
                )}

                {/* ══ TIMEOUT ══ */}
                {status === 'timeout' && (
                  <div style={{ padding: '20px 22px 32px' }}>
                    <div style={{
                      background: 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(185,28,28,0.08))',
                      border: '1px solid rgba(239,68,68,0.2)',
                      borderRadius: 18, padding: '22px 20px',
                      textAlign: 'center', marginBottom: 16,
                      animation: 'fadeIn .35s ease both',
                    }}>
                      <div style={{
                        width: 60, height: 60, borderRadius: '50%',
                        background: 'rgba(239,68,68,0.15)',
                        border: '2px solid rgba(239,68,68,0.35)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 14px',
                        animation: 'assignedPop .5s cubic-bezier(.34,1.56,.64,1) both',
                      }}>
                        <Clock size={30} color="#EF4444" strokeWidth={2}/>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#EF4444', letterSpacing: '-0.5px', marginBottom: 5 }}>
                        No drivers found
                      </div>
                      <div style={{ fontSize: 13, color: 'rgba(252,165,165,.55)', fontWeight: 500, lineHeight: 1.5 }}>
                        We searched your area but couldn't find a nearby driver.
                      </div>
                    </div>

                    <div style={{
                      background: 'rgba(96,165,250,0.08)',
                      border: '1px solid rgba(96,165,250,0.2)',
                      borderRadius: 12, padding: '11px 14px', marginBottom: 14,
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      animation: 'slideUp .35s ease .1s both',
                    }}>
                      <Shield size={14} color="#60A5FA" strokeWidth={2.2} style={{ flexShrink: 0, marginTop: 1 }}/>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#93C5FD', marginBottom: 3 }}>Full refund on the way</div>
                        <div style={{ fontSize: 11, color: 'rgba(147,197,253,.6)', lineHeight: 1.5 }}>
                          Your {paymentMethod ? paymentLabel(paymentMethod) : 'payment'} will be refunded within 30 minutes. No charge will appear on your account.
                        </div>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '13px 14px', marginBottom: 16 }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3, flexShrink: 0 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#64748B' }}/>
                          <div style={{ width: 1, flex: 1, minHeight: 12, background: 'rgba(255,255,255,.1)', margin: '3px 0' }}/>
                          <div style={{ width: 7, height: 7, borderRadius: 2, background: '#22C55E', transform: 'rotate(45deg)' }}/>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.7)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pickup}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dropoff}</div>
                        </div>
                        <div style={{ flexShrink: 0, alignSelf: 'center', fontFamily: '"JetBrains Mono",monospace', fontSize: 13, fontWeight: 700, color: '#22C55E', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '4px 9px' }}>
                          ${total}
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)', marginBottom: 10 }}>
                      What would you like to do?
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button onClick={handleWaitMore} disabled={actionLoading || cancelLoading} style={{
                        width: '100%', padding: '14px 0', borderRadius: 13, border: 'none',
                        background: actionLoading || cancelLoading ? 'rgba(34,197,94,0.2)' : 'linear-gradient(135deg,#22C55E,#15803D)',
                        color: '#fff', fontSize: 14, fontWeight: 800,
                        cursor: actionLoading || cancelLoading ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                        opacity: actionLoading || cancelLoading ? 0.65 : 1, transition: 'all .15s',
                      }}>
                        {actionLoading
                          ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }}/> Extending search…</>
                          : <><RotateCcw size={15} strokeWidth={2.5}/> Keep searching</>
                        }
                      </button>
                      <button onClick={handleCancelRide} disabled={actionLoading || cancelLoading} style={{
                        width: '100%', padding: '13px 0', borderRadius: 13,
                        border: '1px solid rgba(255,255,255,0.09)',
                        background: 'rgba(255,255,255,0.04)',
                        color: 'rgba(255,255,255,.4)', fontSize: 13, fontWeight: 600,
                        cursor: actionLoading || cancelLoading ? 'not-allowed' : 'pointer',
                        opacity: actionLoading || cancelLoading ? 0.5 : 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}>
                        {cancelLoading
                          ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }}/> Cancelling…</>
                          : 'Cancel this ride'
                        }
                      </button>
                    </div>
                    {cancelError && <div style={{ marginTop: 10, fontSize: 11, color: '#FCA5A5', textAlign: 'center' }}>{cancelError}</div>}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}