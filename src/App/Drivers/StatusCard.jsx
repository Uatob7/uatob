import { useEffect, useState, useRef, useMemo } from 'react';
import {
  Power, Radar, Zap, MapPin, Calendar, Clock, ChevronRight, Navigation,
  Trophy, TrendingUp, Star, Share2,
  Banknote, Smartphone, CreditCard, Wallet, ArrowRight, DollarSign,
  Timer, Gauge, Route,
} from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';
import StatTiles      from '@/App/Drivers/StatTiles.jsx';
import Achievements   from '@/App/Drivers/Achievements.jsx';
import RecentSearches from '@/App/Drivers/RecentSearches.jsx';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const p = Date.parse(ts);
    return Number.isNaN(p) ? 0 : p;
  }
  return 0;
}

function fmtScheduled(ts) {
  if (!ts) return null;
  const ms = tsToMillis(ts);
  if (!ms) return null;
  const d = new Date(ms);
  const diffMs = ms - Date.now();
  const diffH = diffMs / 1000 / 3600;
  if (diffH < 0) return null;
  if (diffH < 24) {
    return d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

// "Today · 2:30 PM" / "Tomorrow · 2:30 PM" / "Fri Jun 12 · 2:30 PM"
function fmtScheduledRich(ts) {
  const ms = tsToMillis(ts);
  if (!ms) return { day: '—', time: '' };
  const d = new Date(ms);
  const time = d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  let day;
  if (sameDay(d, today))         day = 'Today';
  else if (sameDay(d, tomorrow)) day = 'Tomorrow';
  else day = d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return { day, time };
}

function parseCity(ride) {
  return ride.pickupCity
    || (ride.pickup ? ride.pickup.split(',').slice(-2, -1)[0]?.trim() : null)
    || 'Orlando';
}

function shortAddr(s) {
  if (!s || typeof s !== 'string') return null;
  const first = s.split(',')[0]?.trim();
  return first || null;
}

function fmtCountdown(ts) {
  if (!ts) return null;
  const ms = tsToMillis(ts);
  const diff = ms - Date.now();
  if (diff <= 0) return 'Now';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `in ${h}h ${m}m`;
  if (m > 0) return `in ${m}m`;
  return 'Soon';
}

// Detailed countdown parts for the scheduled hero (drives urgency styling).
function countdownParts(ts) {
  const ms = tsToMillis(ts);
  const diff = ms - Date.now();
  if (diff <= 0) return { label: 'Now', urgent: true, soon: true, diff: 0 };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const d = Math.floor(h / 24);
  let label;
  if (d >= 1)      label = `${d}d ${h % 24}h`;
  else if (h > 0)  label = `${h}h ${m}m`;
  else             label = `${m}m`;
  return { label, urgent: diff <= 0, soon: diff > 0 && diff < 30 * 60 * 1000, diff };
}

function fmtMoney(v, { cents = false } = {}) {
  const n = typeof v === 'number' ? v : Number(v);
  if (!isFinite(n)) return cents ? '$0.00' : '$0';
  return cents
    ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${Math.round(n).toLocaleString()}`;
}

function fmtMiles(n) {
  const v = Number(n);
  return isFinite(v) && v > 0 ? `${v.toFixed(1)} mi` : null;
}

function fmtDur(n) {
  const v = Number(n);
  return isFinite(v) && v > 0 ? `${Math.round(v)} min` : null;
}

// Normalize a payment-method string into a chip descriptor.
function paymentMeta(method) {
  const k = (method ?? '').toString().toLowerCase().replace(/[\s_-]/g, '');
  if (!k)                       return { label: 'Payment', color: '#94A3B8', Icon: Wallet };
  if (k.includes('cashapp'))    return { label: 'Cash App', color: '#00D632', Icon: Smartphone };
  if (k.includes('cash'))       return { label: 'Cash',     color: '#FBBF24', Icon: Banknote };
  if (k.includes('card') || k.includes('stripe') || k.includes('credit') || k.includes('debit'))
                                return { label: 'Card',     color: '#818CF8', Icon: CreditCard };
  return { label: 'Payment', color: '#94A3B8', Icon: Wallet };
}

// Ring fill toward a ride within a rolling 24h horizon (1 = imminent).
function ringProgress(ms) {
  const horizon = 24 * 3600 * 1000;
  if (ms <= 0) return 1;
  if (ms >= horizon) return 0.05;
  return 1 - ms / horizon;
}

function fareOf(ride) {
  return ride?.fareBreakdown?.fareTotal ?? ride?.fareTotal ?? null;
}

// ──────────────────────────────────────────────────────────────────────────────
// RadarScope — animated sweep + contact blips for the online face
// ──────────────────────────────────────────────────────────────────────────────
const BLIP_LAYOUT = [
  { a: 38,  r: 30 }, { a: 110, r: 22 }, { a: 168, r: 38 },
  { a: 232, r: 27 }, { a: 300, r: 34 }, { a: 348, r: 19 },
];

function RadarScope({ active = true, count = 0, size = 76, accent = '#22C55E' }) {
  const blips = BLIP_LAYOUT.slice(0, Math.max(0, Math.min(count, BLIP_LAYOUT.length)));
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {/* base scope */}
      <svg width={size} height={size} viewBox="0 0 100 100"
        style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <radialGradient id="scScopeBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="rgba(34,197,94,.10)"/>
            <stop offset="70%" stopColor="rgba(34,197,94,.03)"/>
            <stop offset="100%" stopColor="rgba(34,197,94,0)"/>
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="47" fill="url(#scScopeBg)"
          stroke="rgba(34,197,94,.28)" strokeWidth="1"/>
        {[16, 30, 44].map((r, i) => (
          <circle key={i} cx="50" cy="50" r={r} fill="none"
            stroke="rgba(34,197,94,.16)" strokeWidth="0.6" strokeDasharray="1.5 2.5"/>
        ))}
        {/* crosshair */}
        <line x1="50" y1="6"  x2="50" y2="94" stroke="rgba(34,197,94,.14)" strokeWidth="0.5"/>
        <line x1="6"  y1="50" x2="94" y2="50" stroke="rgba(34,197,94,.14)" strokeWidth="0.5"/>
        {/* contact blips */}
        {blips.map((b, i) => {
          const rad = (b.a * Math.PI) / 180;
          const x = 50 + b.r * Math.cos(rad);
          const y = 50 + b.r * Math.sin(rad);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="4.5" fill="none" stroke={accent} strokeWidth="0.8"
                opacity="0.5" style={{ animation: `scBlipPing 2.2s ease-out ${i * 0.3}s infinite` }}/>
              <circle cx={x} cy={y} r="2" fill={accent}
                style={{ filter: `drop-shadow(0 0 3px ${accent})` }}/>
            </g>
          );
        })}
        <circle cx="50" cy="50" r="2.2" fill="#4ADE80"
          style={{ filter: 'drop-shadow(0 0 4px #4ADE80)' }}/>
      </svg>

      {/* rotating sweep on its own layer (reliable CSS rotation about center) */}
      <svg width={size} height={size} viewBox="0 0 100 100"
        style={{
          position: 'absolute', inset: 0,
          transformOrigin: 'center',
          animation: active ? 'scSweepRotate 3.2s linear infinite' : 'none',
        }}>
        <defs>
          <linearGradient id="scSweepCone" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="rgba(74,222,128,.45)"/>
            <stop offset="100%" stopColor="rgba(74,222,128,0)"/>
          </linearGradient>
        </defs>
        <path d="M50 50 L50 5 A45 45 0 0 1 82 19 Z" fill="url(#scSweepCone)"/>
        <line x1="50" y1="50" x2="50" y2="5" stroke="#4ADE80" strokeWidth="0.9"
          strokeLinecap="round" opacity="0.9"/>
      </svg>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// MiniStat — compact glass chip used in the online live-stat strip
// ──────────────────────────────────────────────────────────────────────────────
function MiniStat({ Icon, value, label, color = '#4ADE80', dark = true }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 11px', borderRadius: 12, minWidth: 0,
      background: dark ? 'rgba(255,255,255,.05)' : 'rgba(22,163,74,.08)',
      border: `1px solid ${dark ? 'rgba(255,255,255,.08)' : 'rgba(22,163,74,.16)'}`,
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}1f`, color,
      }}>
        <Icon size={13} strokeWidth={2.3}/>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0 }}>
        <span className="mono" style={{
          fontSize: 13, fontWeight: 800, color: dark ? '#fff' : C.text,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {value}
        </span>
        <span style={{
          fontSize: 8.5, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase',
          color: dark ? 'rgba(255,255,255,.4)' : C.textDim,
        }}>
          {label}
        </span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// ToggleButton — shared online / go-online control
// ──────────────────────────────────────────────────────────────────────────────
function ToggleButton({ online, onToggle, compact = false }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle?.(); }}
      style={{
        background: online
          ? 'linear-gradient(135deg,#22C55E 0%,#16A34A 55%,#15803D 100%)'
          : 'linear-gradient(135deg,#0F172A,#1F2937 55%,#0F172A)',
        border: 'none', borderRadius: 100,
        padding: online ? '13px 18px' : '13px 22px',
        color: '#fff', fontFamily: "'Barlow',sans-serif",
        fontWeight: 800, fontSize: 14, letterSpacing: '.3px',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
        transition: 'filter .15s, transform .1s',
        boxShadow: online ? '0 8px 20px rgba(22,163,74,.35)' : '0 8px 20px rgba(0,0,0,.18)',
        animation: online ? 'scOnlinePulse 2.4s ease-in-out infinite' : 'none',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.08)')}
      onMouseLeave={e => (e.currentTarget.style.filter = '')}
      onMouseDown={e  => (e.currentTarget.style.transform = 'scale(.97)')}
      onMouseUp={e    => (e.currentTarget.style.transform = '')}
    >
      <Power size={15} strokeWidth={2.6} fill={online ? '#fff' : 'transparent'}/>
      {online ? 'Online' : 'Go online'}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// OnlineFace — the redesigned "waiting for rides" hero
// ──────────────────────────────────────────────────────────────────────────────
function OnlineFace({ online, onlineLabel, sinceMs, nearbyCount = 0, earnings, onToggle }) {
  const todayEarn = earnings?.today?.earnings ?? 0;
  const todayTrips = earnings?.today?.trips ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 100,
            background: 'rgba(22,163,74,.12)', border: '1px solid rgba(22,163,74,.20)',
            marginBottom: 9,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', background: '#22C55E',
              boxShadow: '0 0 8px rgba(34,197,94,.7)', animation: 'scLiveDot 1.6s ease-in-out infinite',
            }}/>
            <span className="mono" style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase',
              color: C.onlineGreen,
            }}>
              Online · ready
            </span>
          </div>

          <div className="condensed" style={{
            fontSize: 26, fontWeight: 900, color: C.text, letterSpacing: '-0.5px',
            lineHeight: 1.1, marginBottom: 6,
          }}>
            Looking for rides
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap',
            fontSize: 12, fontWeight: 600, color: '#15803D',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Radar size={12} strokeWidth={2.2}/> Scanning your area
            </span>
            {sinceMs && (
              <>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(22,163,74,.35)' }}/>
                <span>Online {onlineLabel}</span>
              </>
            )}
          </div>
        </div>

        {/* right: scope + toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
          <RadarScope active={online} count={nearbyCount} size={76} accent="#22C55E"/>
          <ToggleButton online={online} onToggle={onToggle}/>
        </div>
      </div>

      {/* live stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 8 }}>
        <MiniStat Icon={Clock}      value={onlineLabel}                 label="Online"  color="#4ADE80" dark={false}/>
        <MiniStat Icon={DollarSign} value={fmtMoney(todayEarn)}         label="Today"   color="#34D399" dark={false}/>
        <MiniStat Icon={Navigation} value={todayTrips}                  label="Trips"   color="#22C55E" dark={false}/>
        <MiniStat Icon={MapPin}     value={nearbyCount > 0 ? nearbyCount : '—'} label="Nearby" color="#16A34A" dark={false}/>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// OfflineHero — offline status (kept close to original, lightly refined)
// ──────────────────────────────────────────────────────────────────────────────
function OfflineHero({ onToggle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 100,
          background: C.surfaceAlt, border: `1px solid ${C.border}`, marginBottom: 8,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.textDim }}/>
          <span className="mono" style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: C.textDim,
          }}>
            Offline
          </span>
        </div>
        <div className="condensed" style={{
          fontSize: 26, fontWeight: 900, color: C.text, letterSpacing: '-0.5px',
          lineHeight: 1.1, marginBottom: 4, opacity: 0.65,
        }}>
          You're offline
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.textDim }}>
          Tap "Go online" to start earning
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        <ToggleButton online={false} onToggle={onToggle}/>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TripHero — on-trip status (kept close to original)
// ──────────────────────────────────────────────────────────────────────────────
function TripHero({ tripStage }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 100,
          background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)', marginBottom: 8,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: '#22C55E',
            boxShadow: '0 0 8px rgba(34,197,94,.7)', animation: 'scLiveDot 1.6s ease-in-out infinite',
          }}/>
          <span className="mono" style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.85)',
          }}>
            On trip
          </span>
        </div>
        <div className="condensed" style={{
          fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px',
          lineHeight: 1.1, marginBottom: 4,
        }}>
          {`Active trip · ${(tripStage ?? '').replace('_', ' ')}`}
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)',
        }}>
          <Zap size={12} fill="#22C55E" strokeWidth={0}/> Earning · stay focused
        </div>
      </div>
      <div style={{
        flexShrink: 0, width: 48, height: 48, borderRadius: 14,
        background: 'rgba(34,197,94,0.15)', border: '1.5px solid rgba(34,197,94,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
      }}>
        <Zap size={20} color="#4ADE80" fill="#4ADE80" strokeWidth={2}/>
        <div style={{
          position: 'absolute', inset: -6, borderRadius: 18,
          border: '2px solid rgba(34,197,94,0.4)', animation: 'scRadar 2s ease-out infinite', pointerEvents: 'none',
        }}/>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// CountdownRing — progress ring toward a scheduled ride
// ──────────────────────────────────────────────────────────────────────────────
function CountdownRing({ ms, color = '#A5B4FC', size = 56, Icon = Calendar }) {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const p = ringProgress(ms);
  const offset = circ * (1 - p);
  const urgent = ms <= 0;
  const soon   = ms > 0 && ms < 30 * 60 * 1000;
  const ring   = urgent ? '#F472B6' : soon ? '#FBBF24' : color;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 60 60" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="3"/>
        <circle cx="30" cy="30" r={r} fill="none" stroke={ring} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset .6s ease, stroke .4s ease',
            filter: `drop-shadow(0 0 4px ${ring}99)`,
          }}/>
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={20} color={ring} strokeWidth={2}
          style={{ animation: (urgent || soon) ? 'scLiveDot 1.4s ease-in-out infinite' : 'none' }}/>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// PaymentChip
// ──────────────────────────────────────────────────────────────────────────────
function PaymentChip({ method }) {
  const { label, color, Icon } = paymentMeta(method);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 99,
      background: `${color}1f`, border: `1px solid ${color}40`,
    }}>
      <Icon size={11} color={color} strokeWidth={2.4}/>
      <span className="mono" style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '.04em', color,
      }}>
        {label}
      </span>
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// RouteStrip — pickup → dropoff with distance / duration
// ──────────────────────────────────────────────────────────────────────────────
function RouteStrip({ ride }) {
  const from = shortAddr(ride.pickup)  || ride.pickupCity  || 'Pickup';
  const to   = shortAddr(ride.dropoff) || ride.dropoffCity || 'Dropoff';
  const dist = fmtMiles(ride.tripDistanceMiles);
  const dur  = fmtDur(ride.tripDurationMin);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 11px', borderRadius: 12,
      background: 'rgba(255,255,255,.04)', border: '1px solid rgba(129,140,248,.16)',
    }}>
      {/* endpoints rail */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34D399', boxShadow: '0 0 6px #34D39999' }}/>
        <div style={{ width: 2, height: 18, background: 'linear-gradient(#34D399,#F472B6)', opacity: 0.5, margin: '2px 0' }}/>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F472B6', boxShadow: '0 0 6px #F472B699' }}/>
      </div>

      {/* labels */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <span style={{
          fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.85)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {from}
        </span>
        <span style={{
          fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.55)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {to}
        </span>
      </div>

      {/* distance / duration */}
      {(dist || dur) && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
          {dist && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#A5B4FC' }}>
              <Gauge size={11} strokeWidth={2.3}/>{dist}
            </span>
          )}
          {dur && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: 'rgba(165,180,252,.7)' }}>
              <Timer size={11} strokeWidth={2.3}/>{dur}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// FareRow — fare, payout, payment, ride type
// ──────────────────────────────────────────────────────────────────────────────
function FareRow({ ride }) {
  const fare   = fareOf(ride);
  const payout = ride.driverPayout;
  const type   = ride.rideLabel || ride.rideType;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        {fare != null && (
          <span className="mono" style={{ fontSize: 18, fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
            {fmtMoney(fare, { cents: true })}
          </span>
        )}
        {payout != null && (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#4ADE80' }}>
            {fmtMoney(payout, { cents: true })} payout
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {type && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 9px', borderRadius: 99,
            background: 'rgba(129,140,248,.14)', border: '1px solid rgba(129,140,248,.25)',
          }}>
            <Route size={11} color="#A5B4FC" strokeWidth={2.4}/>
            <span className="mono" style={{ fontSize: 10, fontWeight: 800, color: '#A5B4FC', textTransform: 'capitalize' }}>
              {type}
            </span>
          </span>
        )}
        <PaymentChip method={ride.paymentMethod}/>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// RideQueue — tappable horizontal queue of upcoming rides
// ──────────────────────────────────────────────────────────────────────────────
function RideQueue({ rides, activeIdx, onSelect }) {
  if (!rides || rides.length < 2) return null;
  return (
    <div style={{
      display: 'flex', gap: 7, overflowX: 'auto', paddingTop: 2, paddingBottom: 2,
      WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
    }}>
      {rides.slice(0, 8).map((r, i) => {
        const active = i === activeIdx;
        const cd = countdownParts(r.scheduledAt || r.createdAt);
        const accent = cd.urgent ? '#F472B6' : cd.soon ? '#FBBF24' : '#818CF8';
        return (
          <button
            key={r.id || i}
            onClick={e => { e.stopPropagation(); onSelect?.(i); }}
            style={{
              flexShrink: 0, cursor: 'pointer', textAlign: 'left',
              display: 'flex', flexDirection: 'column', gap: 2,
              padding: '6px 10px', borderRadius: 10,
              background: active ? 'rgba(129,140,248,.18)' : 'rgba(255,255,255,.04)',
              border: `1px solid ${active ? 'rgba(129,140,248,.5)' : 'rgba(255,255,255,.08)'}`,
              transition: 'all .2s ease',
            }}
          >
            <span className="mono" style={{
              fontSize: 10.5, fontWeight: 800, color: active ? '#C7D2FE' : 'rgba(255,255,255,.6)',
            }}>
              {fmtScheduledRich(r.scheduledAt || r.createdAt).time || '—'}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%', background: accent,
                boxShadow: `0 0 5px ${accent}`,
              }}/>
              <span className="mono" style={{ fontSize: 9, fontWeight: 700, color: accent }}>
                {cd.label}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// ScheduledFace — the redesigned scheduled-rides hero
// ──────────────────────────────────────────────────────────────────────────────
function ScheduledFace({ upcomingRides, rideIdx, currentRide, onSelectRide }) {
  const hasScheduled = upcomingRides.length > 0;

  if (!hasScheduled || !currentRide) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 100,
            background: 'rgba(129,140,248,.14)', border: '1px solid rgba(129,140,248,.28)', marginBottom: 8,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#818CF8', boxShadow: '0 0 8px rgba(129,140,248,.8)' }}/>
            <span className="mono" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#A5B4FC' }}>
              No upcoming rides
            </span>
          </div>
          <div className="condensed" style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.1, marginBottom: 4 }}>
            Schedule clear
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(165,180,252,.55)' }}>
            Reservations will appear here as they come in
          </div>
        </div>
        <div style={{
          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
          background: 'rgba(129,140,248,.12)', border: '1px solid rgba(129,140,248,.24)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Calendar size={20} color="#A5B4FC" strokeWidth={2}/>
        </div>
      </div>
    );
  }

  const when = currentRide.scheduledAt || currentRide.createdAt;
  const cd   = countdownParts(when);
  const rich = fmtScheduledRich(when);
  const heroColor = cd.urgent ? '#F472B6' : cd.soon ? '#FBBF24' : '#A5B4FC';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 100,
            background: 'rgba(129,140,248,.14)', border: '1px solid rgba(129,140,248,.28)', marginBottom: 9,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', background: '#818CF8',
              boxShadow: '0 0 8px rgba(129,140,248,.8)', animation: 'scLiveDot 1.6s ease-in-out infinite',
            }}/>
            <span className="mono" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#A5B4FC' }}>
              {upcomingRides.length > 1 ? `Next · ride ${rideIdx + 1} of ${upcomingRides.length}` : 'Next ride'}
            </span>
          </div>

          {/* hero countdown */}
          <div className="condensed" style={{
            fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: '-0.6px', lineHeight: 1,
            marginBottom: 5, animation: 'scCountGlow 3s ease-in-out infinite',
          }}>
            {cd.label === 'Now' ? 'Now' : <>in {cd.label}</>}
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Clock size={11} color="rgba(165,180,252,.7)" strokeWidth={2.2}/>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(165,180,252,.9)' }}>
              {rich.day} · {rich.time}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <CountdownRing ms={cd.diff} color={heroColor} Icon={Calendar} size={56}/>
          {upcomingRides.length > 1 && (
            <div style={{ display: 'flex', gap: 4 }}>
              {upcomingRides.slice(0, Math.min(5, upcomingRides.length)).map((_, i) => (
                <div key={i} style={{
                  width: i === rideIdx ? 14 : 5, height: 5, borderRadius: 3,
                  background: i === rideIdx ? '#818CF8' : 'rgba(255,255,255,.2)',
                  boxShadow: i === rideIdx ? '0 0 8px rgba(129,140,248,.7)' : 'none',
                  transition: 'all .3s ease',
                }}/>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* route + fare */}
      <RouteStrip ride={currentRide}/>
      <FareRow ride={currentRide}/>

      {/* queue */}
      <RideQueue rides={upcomingRides} activeIdx={rideIdx} onSelect={onSelectRide}/>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Faces config
// Face order: 0=status, 1=scheduled, 2=stats, 3=achievements, 4=notification, 5=searches
// ──────────────────────────────────────────────────────────────────────────────
const FACES   = ['status', 'scheduled', 'stats', 'achievements', 'notification', 'searches'];
const FACE_MS = 5500;

export default function StatusCard({
  online,
  scheduledRides = [],
  searches,
  activeTrip,
  tripStage,
  onToggle,
  onlineSince,
  nearbyCount,
  earnings,
  driver,
}) {
  const [now,      setNow]      = useState(Date.now());
  const [faceIdx,  setFaceIdx]  = useState(0);
  const [rideIdx,  setRideIdx]  = useState(0);
  const [badgeIdx, setBadgeIdx] = useState(0);
  const onlineSinceRef          = useRef(null);
  const cycleRef                = useRef(null);

  // ── Online duration ────────────────────────────────
  useEffect(() => {
    if (online && !onlineSinceRef.current) onlineSinceRef.current = Date.now();
    if (!online) onlineSinceRef.current = null;
  }, [online]);

  // ── Scheduled rides ────────────────────────────────
  const upcomingRides = useMemo(() =>
    [...(scheduledRides || [])]
      .filter(r => {
        const st = r.scheduledAt || r.createdAt;
        if (!st) return false;
        return tsToMillis(st) > Date.now() - 3600000;
      })
      .sort((a, b) => tsToMillis(a.scheduledAt || a.createdAt) - tsToMillis(b.scheduledAt || b.createdAt)),
    [scheduledRides]
  );

  const hasScheduled = upcomingRides.length > 0;
  const currentRide  = upcomingRides[rideIdx] ?? null;

  // ── 1-minute tick (drives online duration + countdowns) ──
  useEffect(() => {
    if (!online && !hasScheduled) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [online, hasScheduled]);

  const sinceMs = onlineSince
    ? (typeof onlineSince === 'number' ? onlineSince : onlineSince?.toMillis?.() ?? new Date(onlineSince).getTime())
    : onlineSinceRef.current;

  const onlineMin   = sinceMs ? Math.max(0, Math.floor((now - sinceMs) / 60_000)) : 0;
  const onlineLabel = onlineMin < 1 ? 'just now'
    : onlineMin < 60 ? `${onlineMin} min`
    : `${Math.floor(onlineMin / 60)}h ${onlineMin % 60}m`;

  const activeFaces = FACES;

  // ── Auto-cycle ─────────────────────────────────────
  const startCycle = () => {
    clearInterval(cycleRef.current);
    if (activeTrip) return;
    cycleRef.current = setInterval(() => {
      setFaceIdx(i => {
        const next = (i + 1) % activeFaces.length;
        if (activeFaces[next] === 'scheduled') {
          setRideIdx(ri => (ri + 1) % Math.max(1, upcomingRides.length));
        }
        if (activeFaces[next] === 'achievements') {
          setBadgeIdx(bi => bi + 1);
        }
        return next;
      });
    }, FACE_MS);
  };

  useEffect(() => {
    startCycle();
    return () => clearInterval(cycleRef.current);
  }, [activeTrip, upcomingRides.length]); // eslint-disable-line

  const goFace = (i) => {
    setFaceIdx(i);
    if (activeFaces[i] === 'achievements') setBadgeIdx(bi => bi + 1);
    startCycle();
  };

  const selectRide = (i) => {
    setRideIdx(i);
    startCycle();
  };

  const face = activeFaces[faceIdx];
  const mode = !online ? 'offline' : activeTrip ? 'trip' : 'waiting';

  // ── Per-face card styles ───────────────────────────
  const faceStyles = {
    status: mode === 'offline'
      ? { bg: C.surface,       border: `1px solid ${C.border}`,              shadow: `0 2px 12px ${C.shadow}` }
      : mode === 'trip'
      ? { bg: 'linear-gradient(135deg,#0F172A 0%,#1E293B 50%,#0F172A 100%)', border: '1.5px solid rgba(34,197,94,.35)',   shadow: '0 12px 40px rgba(0,0,0,.25)' }
      : { bg: 'linear-gradient(135deg,#F0FDF4 0%,#DCFCE7 50%,#F0FDF4 100%)', border: '1.5px solid rgba(22,163,74,.30)',   shadow: '0 8px 28px rgba(22,163,74,.14)' },
    scheduled:  { bg: 'linear-gradient(135deg,#0F0A1E 0%,#160F2C 50%,#1A1338 100%)', border: '1.5px solid rgba(129,140,248,.35)', shadow: '0 12px 40px rgba(0,0,0,.30)' },
    stats:      { bg: 'linear-gradient(135deg,#0A0F1A 0%,#0F1A2E 50%,#0A0F1A 100%)', border: '1.5px solid rgba(59,130,246,.30)',  shadow: '0 12px 40px rgba(0,0,0,.28)' },
    achievements: { bg: 'linear-gradient(135deg,#1A0A00 0%,#2C1400 50%,#1A0A00 100%)', border: '1.5px solid rgba(251,146,60,.30)', shadow: '0 12px 40px rgba(0,0,0,.28)' },
    notification: { bg: 'linear-gradient(135deg,#0A1A14 0%,#0F2A1E 50%,#0A1A14 100%)', border: '1.5px solid rgba(34,197,94,.30)',  shadow: '0 12px 40px rgba(0,0,0,.28)' },
    searches:   { bg: 'linear-gradient(135deg,#08101E 0%,#0D1829 55%,#080F1B 100%)', border: '1.5px solid rgba(96,165,250,.28)',  shadow: '0 12px 40px rgba(0,0,0,.30)' },
  };

  const dotColors = {
    status:       mode === 'waiting' ? '#22C55E' : mode === 'trip' ? '#22C55E' : '#64748B',
    scheduled:    '#818CF8',
    stats:        '#60A5FA',
    achievements: '#FB923C',
    notification: '#34D399',
    searches:     '#60A5FA',
  };

  const currentStyle = faceStyles[face];

  return (
    <>
      <style>{`
        @keyframes scRadar {
          0%   { transform: scale(0.6); opacity: 0.7; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        @keyframes scLiveDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes scScan {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes scOnlinePulse {
          0%, 100% { box-shadow: 0 8px 20px rgba(22,163,74,.35), 0 0 0 0 rgba(22,163,74,.4); }
          50%      { box-shadow: 0 8px 20px rgba(22,163,74,.35), 0 0 0 12px rgba(22,163,74,0); }
        }
        @keyframes scFaceIn {
          0%   { opacity: 0; transform: translateY(6px) scale(.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes scCountGlow {
          0%,100% { text-shadow: 0 0 8px rgba(129,140,248,.3); }
          50%     { text-shadow: 0 0 28px rgba(129,140,248,.9), 0 0 50px rgba(129,140,248,.4); }
        }
        @keyframes scSweepRotate {
          to { transform: rotate(360deg); }
        }
        @keyframes scBlipPing {
          0%   { transform-origin: center; opacity: .6; }
          70%  { opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes rsTravel {
          0%   { top: -6px; }
          100% { top: 100%; }
        }
        .sc-face { animation: scFaceIn .38s cubic-bezier(.34,1.2,.64,1) both; }
      `}</style>

      <div style={{ borderRadius: 22 }}>
        <div style={{
          background:   currentStyle.bg,
          border:       currentStyle.border,
          borderRadius: 22,
          padding:      '18px 20px 14px',
          position:     'relative',
          overflow:     'hidden',
          transition:   'background .5s ease, border .5s ease, box-shadow .5s ease',
          boxShadow:    currentStyle.shadow,
        }}>

          {/* ── Decorative layers ── */}
          {face === 'status' && mode === 'waiting' && (
            <>
              <div style={{ position:'absolute', top:'50%', right:80, width:60, height:60, borderRadius:'50%', background:'rgba(22,163,74,.20)', transform:'translateY(-50%)', animation:'scRadar 2.4s ease-out infinite', pointerEvents:'none' }}/>
              <div style={{ position:'absolute', top:'50%', right:80, width:60, height:60, borderRadius:'50%', background:'rgba(22,163,74,.15)', transform:'translateY(-50%)', animation:'scRadar 2.4s ease-out 0.8s infinite', pointerEvents:'none' }}/>
              <div style={{ position:'absolute', inset:0, backgroundImage:'repeating-linear-gradient(45deg,transparent,transparent 60px,rgba(22,163,74,.04) 60px,rgba(22,163,74,.04) 61px)', pointerEvents:'none' }}/>
            </>
          )}
          {face === 'status' && mode === 'trip' && (
            <>
              <div style={{ position:'absolute', inset:0, opacity:.06, backgroundImage:'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)', backgroundSize:'32px 32px', pointerEvents:'none' }}/>
              <div style={{ position:'absolute', top:-60, right:-60, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(34,197,94,0.30) 0%,transparent 70%)', pointerEvents:'none' }}/>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,rgba(34,197,94,0.7),transparent)', animation:'scScan 2.5s linear infinite', pointerEvents:'none' }}/>
            </>
          )}
          {face === 'scheduled' && (
            <>
              <div style={{ position:'absolute', top:-60, right:-60, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(129,140,248,.28) 0%,transparent 70%)', filter:'blur(30px)', pointerEvents:'none' }}/>
              <div style={{ position:'absolute', bottom:-40, left:-40, width:160, height:160, borderRadius:'50%', background:'radial-gradient(circle,rgba(244,114,182,.18) 0%,transparent 70%)', filter:'blur(24px)', pointerEvents:'none' }}/>
              <div style={{ position:'absolute', inset:0, opacity:.05, backgroundImage:'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)', backgroundSize:'32px 32px', pointerEvents:'none' }}/>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,rgba(129,140,248,0.7),transparent)', animation:'scScan 3s linear infinite', pointerEvents:'none' }}/>
            </>
          )}
          {face === 'stats' && (
            <>
              <div style={{ position:'absolute', top:-40, right:-40, width:160, height:160, borderRadius:'50%', background:'radial-gradient(circle,rgba(59,130,246,.22) 0%,transparent 70%)', filter:'blur(28px)', pointerEvents:'none' }}/>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,rgba(59,130,246,0.6),transparent)', animation:'scScan 3.5s linear infinite', pointerEvents:'none' }}/>
            </>
          )}
          {face === 'achievements' && (
            <>
              <div style={{ position:'absolute', top:-40, right:-40, width:160, height:160, borderRadius:'50%', background:'radial-gradient(circle,rgba(251,146,60,.25) 0%,transparent 70%)', filter:'blur(28px)', pointerEvents:'none' }}/>
              <div style={{ position:'absolute', bottom:-30, left:-30, width:130, height:130, borderRadius:'50%', background:'radial-gradient(circle,rgba(234,179,8,.15) 0%,transparent 70%)', filter:'blur(20px)', pointerEvents:'none' }}/>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,rgba(251,146,60,0.6),transparent)', animation:'scScan 4s linear infinite', pointerEvents:'none' }}/>
            </>
          )}
          {face === 'notification' && (
            <>
              <div style={{ position:'absolute', top:-40, right:-40, width:170, height:170, borderRadius:'50%', background:'radial-gradient(circle,rgba(52,211,153,.22) 0%,transparent 70%)', filter:'blur(30px)', pointerEvents:'none' }}/>
              <div style={{ position:'absolute', inset:0, opacity:.05, backgroundImage:'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)', backgroundSize:'32px 32px', pointerEvents:'none' }}/>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,rgba(52,211,153,0.6),transparent)', animation:'scScan 3.8s linear infinite', pointerEvents:'none' }}/>
            </>
          )}
          {face === 'searches' && (
            <>
              <div style={{ position:'absolute', top:-50, right:-50, width:180, height:180, borderRadius:'50%', background:'radial-gradient(circle,rgba(96,165,250,.16) 0%,transparent 70%)', filter:'blur(28px)', pointerEvents:'none' }}/>
              <div style={{ position:'absolute', bottom:-40, left:-30, width:140, height:140, borderRadius:'50%', background:'radial-gradient(circle,rgba(192,132,252,.10) 0%,transparent 70%)', filter:'blur(22px)', pointerEvents:'none' }}/>
              <div style={{ position:'absolute', inset:0, opacity:.03, backgroundImage:'linear-gradient(rgba(255,255,255,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.6) 1px,transparent 1px)', backgroundSize:'32px 32px', pointerEvents:'none' }}/>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,rgba(96,165,250,.55),transparent)', animation:'scScan 3.6s linear infinite', pointerEvents:'none' }}/>
            </>
          )}

          {/* ── Face content ── */}
          <div className="sc-face" key={face + rideIdx + badgeIdx} style={{ position: 'relative', minHeight: 78 }}>

            {/* ════ FACE: STATUS ════ */}
            {face === 'status' && mode === 'offline' && (
              <OfflineHero onToggle={onToggle}/>
            )}
            {face === 'status' && mode === 'waiting' && (
              <OnlineFace
                online={online}
                onlineLabel={onlineLabel}
                sinceMs={sinceMs}
                nearbyCount={nearbyCount}
                earnings={earnings}
                onToggle={onToggle}
              />
            )}
            {face === 'status' && mode === 'trip' && (
              <TripHero tripStage={tripStage}/>
            )}

            {/* ════ FACE: SCHEDULED ════ */}
            {face === 'scheduled' && (
              <ScheduledFace
                upcomingRides={upcomingRides}
                rideIdx={rideIdx}
                currentRide={currentRide}
                onSelectRide={selectRide}
              />
            )}

            {/* ════ FACE: STATS ════ */}
            {face === 'stats' && (
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                  <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:100, background:'rgba(59,130,246,.12)', border:'1px solid rgba(59,130,246,.25)' }}>
                    <TrendingUp size={10} color="#93C5FD" strokeWidth={2.4}/>
                    <span className="mono" style={{ fontSize:10, fontWeight:800, letterSpacing:'.12em', textTransform:'uppercase', color:'#93C5FD' }}>Earnings</span>
                  </div>
                </div>
                <StatTiles earnings={earnings} online={online} />
              </div>
            )}

            {/* ════ FACE: ACHIEVEMENTS ════ */}
            {face === 'achievements' && (
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                  <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:100, background:'rgba(251,146,60,.12)', border:'1px solid rgba(251,146,60,.25)' }}>
                    <Trophy size={10} color="#FCD34D" strokeWidth={2.4}/>
                    <span className="mono" style={{ fontSize:10, fontWeight:800, letterSpacing:'.12em', textTransform:'uppercase', color:'#FCD34D' }}>Achievements</span>
                  </div>
                </div>
                <Achievements driver={driver} badgeIdx={badgeIdx} />
              </div>
            )}

            {/* ════ FACE: NOTIFICATION ════ */}
            {face === 'notification' && (
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{
                  width:48, height:48, borderRadius:14, flexShrink:0,
                  background:'linear-gradient(135deg,#34D399,#10B981)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow:'0 6px 18px rgba(16,185,129,.4)',
                }}>
                  <Share2 size={20} color="#fff" strokeWidth={2.2}/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:100, background:'rgba(52,211,153,.12)', border:'1px solid rgba(52,211,153,.25)', marginBottom:8 }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:'#34D399', boxShadow:'0 0 8px rgba(52,211,153,0.8)', animation:'scLiveDot 1.6s ease-in-out infinite' }}/>
                    <span className="mono" style={{ fontSize:10, fontWeight:800, letterSpacing:'.12em', textTransform:'uppercase', color:'#6EE7B7' }}>
                      {online ? "You're online" : 'Spread the word'}
                    </span>
                  </div>
                  <div style={{ fontSize:13, fontWeight:600, color:'rgba(255,255,255,.82)', lineHeight:1.5 }}>
                    {online
                      ? <>You're online — share UaTob with <span style={{ color:'#6EE7B7', fontWeight:800 }}>everyone you know</span> and grow the network.</>
                      : <>Tell your friends about UaTob. The more people who join, the more rides for <span style={{ color:'#6EE7B7', fontWeight:800 }}>everyone</span>.</>
                    }
                  </div>
                </div>
              </div>
            )}

            {/* ════ FACE: SEARCHES ════ */}
            {face === 'searches' && (
              <RecentSearches
                searches={searches ?? []}
                loading={false}
                limit={5}
              />
            )}

          </div>

          {/* ── Dot pagination ── */}
          <div style={{ display:'flex', justifyContent:'center', gap:6, marginTop:14, position:'relative' }}>
            {activeFaces.map((f, i) => (
              <button
                key={f}
                onClick={() => goFace(i)}
                style={{
                  width:  i === faceIdx ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  background: i === faceIdx ? dotColors[f] : 'rgba(255,255,255,.18)',
                  boxShadow: i === faceIdx ? `0 0 8px ${dotColors[f]}80` : 'none',
                  transition: 'all .28s ease',
                  flexShrink: 0,
                }}
              />
            ))}
          </div>

        </div>
      </div>
    </>
  );
}
