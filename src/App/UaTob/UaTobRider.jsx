// UaTobRider.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Rider-side app shell — 4-tab redesign.
//
//   REQUEST  post a trip → writes a Request doc (open board, no charge)
//   RIDES    the open board → pay cash/card → atomic claim → paying Ride
//   DRIVER   live fleet roster
//   YOU      account
//
// When a Ride goes active the parent (index.jsx) swaps this shell out for the
// existing full-screen <UaTob> map HUD, so live driver tracking is unchanged.
// This component owns everything BEFORE a ride is active.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useCallback, useEffect } from 'react';

import { useAutocomplete }  from '@/App/UaTob/useAutocomplete';
import { useGeo }           from '@/App/UaTob/useGeo';
import { useRoute }         from '@/App/UaTob/useRoute';
import { useRequests }      from '@/App/UaTob/useRequests';
import { useCreateRequest } from '@/App/UaTob/useCreateRequest';
import { useClaimRequest }  from '@/App/UaTob/useClaimRequest';
import { useAddCredit }     from '@/App/UaTob/useAddCredit';
import { useGeocode }       from '@/App/UaTob/useGeocode';
import RiderMap             from '@/App/UaTob/RiderMap';
import InstallBanner        from '@/App/UaTob/InstallBanner';
import { calcFare }         from '@/App/UaTob/fare';
import { RIDE_TYPES }       from '@/App/UaTob/pricing';

// ── Design tokens (UaTob tactical HUD) ───────────────────────────────────────
const C = {
  bg: '#050A06', bgDeep: '#030604', panel: 'rgba(5,12,7,0.82)',
  green: '#22C55E', greenBright: '#4ADE80', greenSoft: '#34D399',
  cyan: '#22D3EE', amber: '#FBBF24', red: '#F87171', purple: '#C084FC', blue: '#60A5FA',
  inkDim: 'rgba(255,255,255,.22)', inkFade: 'rgba(255,255,255,.10)',
  inkMid: 'rgba(255,255,255,.45)', inkBright: 'rgba(255,255,255,.88)',
  border: 'rgba(34,197,94,.15)', borderBright: 'rgba(74,222,128,.35)',
};
const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";
const BODY = "'Syne','Inter',sans-serif";

const RIDE_ICON = { economy: '🚗', standard: '🚙', premium: '✨', xl: '🚐' };
const TAG_COLOR = {
  economy: C.greenBright, standard: C.blue, premium: C.purple, xl: C.amber,
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=JetBrains+Mono:wght@400;500;700;800&family=Syne:wght@600;700;800&display=swap');
  @keyframes urFade   { from{opacity:0} to{opacity:1} }
  @keyframes urUp     { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes urSheet  { from{opacity:0;transform:translateY(60px)} to{opacity:1;transform:translateY(0)} }
  @keyframes urBlink  { 0%,100%{opacity:1} 50%{opacity:.25} }
  @keyframes urBar    { 0%,100%{transform:scaleY(.5);opacity:.45} 50%{transform:scaleY(1);opacity:1} }
  @keyframes urSpin   { to{transform:rotate(360deg)} }
  .ur-scroll::-webkit-scrollbar{display:none}
  .ur-tap{transition:transform .1s,background .15s,border-color .15s}
  .ur-tap:active{transform:scale(.97)}
  @media(prefers-reduced-motion:reduce){*{animation:none!important}}
`;

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

function tsAgo(ts) {
  const ms = ts?.toMillis ? ts.toMillis() : (ts?.seconds ? ts.seconds * 1000 : 0);
  if (!ms) return 'just now';
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${Math.max(1, s)}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

// ── Small primitives ─────────────────────────────────────────────────────────
function Ribbon({ mode, credit = 0, onOpenWallet }) {
  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () => {
      const d = new Date(), p = (n) => String(n).padStart(2, '0');
      const h = d.getHours(), ap = h >= 12 ? 'PM' : 'AM';
      setClock(`${h % 12 || 12}:${p(d.getMinutes())} ${ap}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{
      position: 'relative', zIndex: 40, height: 34, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 14px', background: 'linear-gradient(180deg,rgba(3,6,4,.9),rgba(3,6,4,0))',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ fontFamily: COND, fontSize: 12, fontWeight: 800, letterSpacing: '.24em', color: 'rgba(255,255,255,.55)' }}>UATOB</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: C.inkFade }}>·</span>
        <span style={{ fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.16em', color: C.greenBright, textShadow: `0 0 8px ${C.greenBright}88` }}>{mode}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
        {/* Ride-credit balance — tap to top up */}
        <button className="ur-tap" onClick={onOpenWallet} aria-label="Ride credit — add credit" style={{
          display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
          padding: '4px 9px 4px 8px', borderRadius: 99,
          border: '1px solid rgba(251,191,36,.35)', background: 'rgba(251,191,36,.10)',
          boxShadow: '0 0 12px rgba(251,191,36,.10)',
        }}>
          <span style={{ fontSize: 11, lineHeight: 1 }}>🪙</span>
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: C.amber, fontVariantNumeric: 'tabular-nums' }}>{money(credit)}</span>
          <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, color: C.amber, opacity: .8, marginLeft: 1 }}>+</span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.greenBright, boxShadow: `0 0 7px ${C.greenBright}`, animation: 'urBlink 1.6s ease-in-out infinite' }} />
          <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 800, letterSpacing: '.08em', color: C.greenBright }}>LIVE</span>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,.4)' }}>{clock}</span>
      </div>
    </div>
  );
}

function Eyebrow({ children, style }) {
  return <div style={{ fontFamily: COND, fontSize: 11, fontWeight: 800, letterSpacing: '.22em', textTransform: 'uppercase', color: C.inkDim, ...style }}>{children}</div>;
}
function H1({ children }) {
  return <div style={{ fontFamily: COND, fontSize: 27, fontWeight: 800, letterSpacing: '.01em', lineHeight: 1, margin: '5px 0 2px' }}>{children}</div>;
}
function Sub({ children }) {
  return <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.inkMid, lineHeight: 1.5, marginBottom: 16 }}>{children}</div>;
}
const cardStyle = { background: C.panel, backdropFilter: 'blur(12px)', border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: '0 8px 30px rgba(0,0,0,.4)' };

function Chip({ icon, children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 99,
      border: `1px solid ${C.border}`, background: 'rgba(34,197,94,.06)',
      fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.inkBright,
    }}>
      <span style={{ fontSize: 11 }}>{icon}</span>{children}
    </span>
  );
}

// ── Address input (autocomplete) ─────────────────────────────────────────────
function AddressField({ label, node, value, onChange, placeholder, onLocate, locating, compact }) {
  const { predictions, fetch: fetchSug, clear } = useAutocomplete(250);
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative', padding: compact ? '12px 14px' : '14px 15px', display: 'flex', alignItems: 'center', gap: compact ? 11 : 12 }}>
      <span style={{ width: compact ? 9 : 10, height: compact ? 9 : 10, borderRadius: '50%', flexShrink: 0, background: node, boxShadow: `0 0 10px ${node}` }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {!compact && <div style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.18em', color: C.inkDim, textTransform: 'uppercase' }}>{label}</div>}
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => { onChange(e.target.value); fetchSug(e.target.value); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          autoComplete="off"
          style={{
            width: '100%', background: 'none', border: 'none', outline: 'none',
            fontFamily: BODY, fontSize: compact ? 13.5 : 14, fontWeight: 600, color: C.inkBright,
            caretColor: C.greenBright, padding: compact ? 0 : '2px 0 0',
          }}
        />
      </div>
      {onLocate && !value && (
        <button className="ur-tap" onClick={onLocate} aria-label="Use my location" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.inkMid, display: 'flex', padding: 4 }}>
          {locating
            ? <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${C.inkFade}`, borderTopColor: C.greenBright, display: 'block', animation: 'urSpin .7s linear infinite' }} />
            : <span style={{ fontSize: 15 }}>◎</span>}
        </button>
      )}
      {focused && predictions.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% - 4px)', left: 12, right: 12, zIndex: 50,
          background: '#0D1A0F', border: `1px solid ${C.border}`, borderRadius: 12,
          overflow: 'hidden', boxShadow: '0 12px 36px rgba(0,0,0,.6)',
        }}>
          {predictions.slice(0, 5).map((s) => (
            <div
              key={s.place_id}
              className="ur-tap"
              onMouseDown={() => { onChange(s.description); clear(); }}
              style={{ padding: '10px 13px', cursor: 'pointer', borderBottom: `1px solid rgba(255,255,255,.04)` }}
            >
              <div style={{ fontFamily: COND, fontSize: 12, fontWeight: 700, color: '#fff' }}>{s.structured_formatting?.main_text || s.description}</div>
              {s.structured_formatting?.secondary_text && (
                <div style={{ fontFamily: MONO, fontSize: 9, color: C.inkMid, marginTop: 1 }}>{s.structured_formatting.secondary_text}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST TAB — multi-step: route → when → price → post
// ═══════════════════════════════════════════════════════════════════════════
function fmtDayLabel(d) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - t.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tmrw';
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short' });
}
const fmtDayNum = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
function fmtWhen(scheduledAt) {
  if (!scheduledAt) return 'Leave now';
  return new Date(scheduledAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function splitAddr(a) {
  const parts = String(a || '').split(',').map((s) => s.trim()).filter(Boolean);
  return { main: parts[0] || '—', sub: parts.slice(1, 3).join(', ') };
}

function StepDots({ step, total }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} style={{ width: i === step ? 18 : 6, height: 4, borderRadius: 2, background: i <= step ? C.greenBright : C.inkFade, boxShadow: i === step ? `0 0 8px ${C.greenBright}88` : 'none', transition: 'width .25s, background .25s' }} />
      ))}
    </div>
  );
}

function RequestPane({ uid, account, onPosted, onRoute }) {
  const geo = useGeo();
  const [step, setStep] = useState(0);              // 0 route · 1 when · 2 price
  const [pickup,  setPickup]  = useState(account?.pickup || account?.address || '');
  const [dropoff, setDropoff] = useState('');
  const [rideType, setRideType] = useState('standard');
  const [leaveNow, setLeaveNow] = useState(true);
  const [schedDay, setSchedDay] = useState(null);   // Date @ local midnight
  const [schedTime, setSchedTime] = useState('');   // 'HH:MM'
  const [posting, setPosting] = useState(false);

  const { tripData, loading: routing } = useRoute(pickup, dropoff);
  const { createRequest } = useCreateRequest(uid);

  // Geocode the pickup on its own so the map can center on it before a
  // destination exists, then report the live route up to the map.
  const pickupPoint = useGeocode(pickup);
  useEffect(() => {
    if (!onRoute) return;
    const pk = tripData?.pickupLat != null ? { lat: tripData.pickupLat, lng: tripData.pickupLng } : pickupPoint;
    const dp = tripData?.dropoffLat != null ? { lat: tripData.dropoffLat, lng: tripData.dropoffLng } : null;
    onRoute({ pickup: pk || null, dropoff: dp, polyline: tripData?.polyline || null });
  }, [pickupPoint, tripData, onRoute]);

  const fares = useMemo(() => {
    const miles = tripData?.miles ?? 4.2;
    const mins  = tripData?.durationMin ?? 12;
    const out = {};
    for (const t of RIDE_TYPES) {
      try { out[t.id] = calcFare(t.id, miles, 1, mins).total; } catch { out[t.id] = null; }
    }
    return out;
  }, [tripData]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d;
  }), []);

  const scheduledAt = useMemo(() => {
    if (leaveNow || !schedDay || !schedTime) return null;
    const [h, m] = schedTime.split(':').map(Number);
    const d = new Date(schedDay); d.setHours(h || 0, m || 0, 0, 0);
    return d;
  }, [leaveNow, schedDay, schedTime]);

  const routeReady = !!(pickup.trim() && dropoff.trim() && tripData && !routing);
  const whenReady  = leaveNow || (scheduledAt && scheduledAt.getTime() > Date.now() + 60_000);

  const handleLocate = useCallback(async () => {
    try { const addr = await geo.resolve(); setPickup(addr); } catch { /* surfaced in geo.error */ }
  }, [geo]);

  const handlePost = useCallback(async () => {
    if (!routeReady || posting) return;
    setPosting(true);
    const label = RIDE_TYPES.find((t) => t.id === rideType)?.label ?? rideType;
    const id = await createRequest({
      posterName:   account?.name || account?.displayName || 'Rider',
      posterRating: account?.rating ?? null,
      posterPhoto:  account?.photoURL ?? null,
      pickup, dropoff,
      pickupCity: tripData.pickupCity, pickupZip: tripData.pickupZip,
      pickupLat: tripData.pickupLat, pickupLng: tripData.pickupLng,
      dropoffCity: tripData.dropoffCity, dropoffZip: tripData.dropoffZip,
      dropoffLat: tripData.dropoffLat, dropoffLng: tripData.dropoffLng,
      polyline: tripData.polyline,
      rideType, rideLabel: label,
      fareEstimate: fares[rideType],
      tripDistanceMiles: tripData.miles,
      tripDurationMin: tripData.durationMin,
      isScheduled: !leaveNow,
      scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
    });
    setPosting(false);
    if (id) {
      setDropoff(''); setStep(0); setLeaveNow(true); setSchedDay(null); setSchedTime('');
      onPosted?.();
    }
  }, [routeReady, posting, rideType, fares, createRequest, account, pickup, dropoff, tripData, leaveNow, scheduledAt, onPosted]);

  const titles = ['Request a ride', 'When do you leave?', 'Confirm & price'];

  return (
    <div style={{ animation: 'urUp .38s cubic-bezier(.34,1.1,.64,1) both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 18 }}>
        {step > 0
          ? <button className="ur-tap" onClick={() => setStep((s) => s - 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.inkMid, fontFamily: COND, fontSize: 11, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', padding: 0, display: 'flex', alignItems: 'center', gap: 5 }}>‹ Back</button>
          : <Eyebrow>Post a trip</Eyebrow>}
        <StepDots step={step} total={3} />
      </div>
      <div style={{ fontFamily: COND, fontSize: 19, fontWeight: 800, letterSpacing: '.01em', color: C.inkBright, margin: '5px 0 12px' }}>{titles[step]}</div>

      {/* ── STEP 0 · ROUTE ── */}
      {step === 0 && (
        <>
          {/* connected pickup → destination card */}
          <div style={{ ...cardStyle, position: 'relative' }}>
            <AddressField compact node={C.cyan} value={pickup} onChange={setPickup} placeholder="Pickup location" onLocate={handleLocate} locating={geo.loading} />
            <div style={{ height: 1, background: C.inkFade, marginLeft: 34 }} />
            <AddressField compact node={C.greenBright} value={dropoff} onChange={setDropoff} placeholder="Where to?" />
            {/* rail connecting the two dots */}
            <div style={{ position: 'absolute', left: 18.5, top: 30, bottom: 30, width: 1.5, background: 'linear-gradient(180deg,#22D3EE,#4ADE80)', opacity: .35 }} />
          </div>
          {geo.error && <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.red, marginTop: 8 }}>{geo.error}</div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22, margin: '12px 2px' }}>
            {tripData ? (
              <>
                <Chip icon="📍">{tripData.miles} mi</Chip>
                <Chip icon="⏱">{tripData.durationMin} min</Chip>
              </>
            ) : (
              <span style={{ fontFamily: MONO, fontSize: 9.5, color: C.inkDim }}>
                {routing ? 'Finding route…' : 'Enter both to see distance & time'}
              </span>
            )}
          </div>

          <StepButton enabled={routeReady} onClick={() => setStep(1)}>Continue</StepButton>
        </>
      )}

      {/* ── STEP 1 · WHEN ── */}
      {step === 1 && (
        <>
          <div style={{ display: 'flex', gap: 9, marginBottom: 14 }}>
            {[{ v: true, ic: '⚡', t: 'Leave now', s: 'Post immediately' }, { v: false, ic: '🗓', t: 'Schedule', s: 'Pick a day & time' }].map((o) => {
              const sel = leaveNow === o.v;
              return (
                <button key={String(o.v)} className="ur-tap" onClick={() => setLeaveNow(o.v)} style={{
                  flex: 1, cursor: 'pointer', borderRadius: 16, padding: '16px 12px', textAlign: 'left',
                  border: `1.5px solid ${sel ? C.borderBright : C.border}`,
                  background: sel ? 'rgba(34,197,94,.10)' : 'rgba(255,255,255,.015)',
                  boxShadow: sel ? '0 0 22px rgba(34,197,94,.12)' : 'none',
                }}>
                  <div style={{ fontSize: 20 }}>{o.ic}</div>
                  <div style={{ fontFamily: COND, fontSize: 15, fontWeight: 800, letterSpacing: '.04em', color: C.inkBright, marginTop: 8 }}>{o.t}</div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: C.inkDim, marginTop: 2 }}>{o.s}</div>
                </button>
              );
            })}
          </div>

          {!leaveNow && (
            <div style={{ ...cardStyle, padding: 14, marginBottom: 14, animation: 'urUp .25s ease both' }}>
              <Eyebrow style={{ fontSize: 9, letterSpacing: '.16em' }}>Pick a day</Eyebrow>
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '9px 0 14px', paddingBottom: 2 }} className="ur-scroll">
                {days.map((d) => {
                  const sel = schedDay && d.getTime() === schedDay.getTime();
                  return (
                    <button key={d.getTime()} className="ur-tap" onClick={() => setSchedDay(d)} style={{
                      flexShrink: 0, minWidth: 52, cursor: 'pointer', borderRadius: 12, padding: '9px 6px', textAlign: 'center',
                      border: `1px solid ${sel ? C.borderBright : C.border}`, background: sel ? 'rgba(34,197,94,.12)' : 'rgba(255,255,255,.015)',
                    }}>
                      <div style={{ fontFamily: COND, fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: sel ? C.greenBright : C.inkMid }}>{fmtDayLabel(d)}</div>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: C.inkDim, marginTop: 3 }}>{fmtDayNum(d)}</div>
                    </button>
                  );
                })}
              </div>
              <Eyebrow style={{ fontSize: 9, letterSpacing: '.16em' }}>Pick a time</Eyebrow>
              <input
                type="time"
                value={schedTime}
                onChange={(e) => setSchedTime(e.target.value)}
                style={{
                  marginTop: 9, width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.03)',
                  border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', outline: 'none',
                  fontFamily: MONO, fontSize: 15, fontWeight: 700, color: C.inkBright, colorScheme: 'dark',
                }}
              />
              {scheduledAt && (
                <div style={{ fontFamily: MONO, fontSize: 10, color: C.greenSoft, marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  🗓 {fmtWhen(scheduledAt)}
                </div>
              )}
            </div>
          )}

          <StepButton enabled={!!whenReady} onClick={() => setStep(2)}>Continue</StepButton>
        </>
      )}

      {/* ── STEP 2 · PRICE ── */}
      {step === 2 && (
        <>
          {/* Trip summary */}
          <div style={{ ...cardStyle, padding: '13px 15px', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 11 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.cyan, boxShadow: `0 0 7px ${C.cyan}` }} />
                <span style={{ width: 1.5, flex: 1, minHeight: 18, background: 'linear-gradient(180deg,#22D3EE,#4ADE80)', opacity: .4, margin: '3px 0' }} />
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.greenBright, boxShadow: `0 0 7px ${C.greenBright}` }} />
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                {[pickup, dropoff].map((a, i) => {
                  const { main, sub } = splitAddr(a);
                  return (
                    <div key={i} style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: BODY, fontSize: 13, fontWeight: 700, color: C.inkBright, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{main}</div>
                      {sub && <div style={{ fontFamily: MONO, fontSize: 9, color: C.inkDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 11, borderTop: `1px solid ${C.inkFade}` }}>
              <span style={{ fontSize: 13 }}>{leaveNow ? '⚡' : '🗓'}</span>
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: leaveNow ? C.greenSoft : C.cyan }}>{fmtWhen(scheduledAt)}</span>
              <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 10, color: C.inkMid }}>{tripData?.miles} mi · {tripData?.durationMin} min</span>
            </div>
          </div>

          {/* Ride selector — vertical list */}
          <Eyebrow style={{ letterSpacing: '.16em' }}>Choose your ride</Eyebrow>
          <div style={{ margin: '10px 0 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {RIDE_TYPES.map((t) => {
              const sel = rideType === t.id;
              return (
                <button key={t.id} className="ur-tap" onClick={() => setRideType(t.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px', cursor: 'pointer',
                  border: `1.5px solid ${sel ? C.borderBright : C.border}`, borderRadius: 15,
                  background: sel ? 'rgba(34,197,94,.10)' : 'rgba(255,255,255,.015)', boxShadow: sel ? '0 0 22px rgba(34,197,94,.12)' : 'none',
                }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, background: sel ? 'rgba(34,197,94,.12)' : 'rgba(255,255,255,.03)', border: `1px solid ${sel ? C.borderBright : C.border}` }}>{RIDE_ICON[t.id]}</div>
                  <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                    <div style={{ fontFamily: BODY, fontSize: 14, fontWeight: 700, color: C.inkBright }}>{t.label}</div>
                    <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.inkDim, marginTop: 2 }}>{t.capacity} seats · {t.desc}</div>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, color: sel ? C.greenBright : C.inkBright }}>{fares[t.id] != null ? money(fares[t.id]) : '—'}</div>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, color: '#04150a', fontWeight: 900,
                    border: `1.5px solid ${sel ? C.greenBright : C.inkFade}`, background: sel ? C.greenBright : 'transparent',
                  }}>{sel ? '✓' : ''}</span>
                </button>
              );
            })}
          </div>

          <div style={{ height: 14 }} />
          <StepButton enabled={routeReady && !posting} onClick={handlePost}>
            {posting ? 'Posting…' : `Post request · ${fares[rideType] != null ? money(fares[rideType]) : ''}`}
          </StepButton>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.inkDim, textAlign: 'center', marginTop: 11, lineHeight: 1.55 }}>
            Posts a <b style={{ color: C.greenSoft }}>Request</b>. Pay it with cash or ride credit from the Rides tab.
          </div>
        </>
      )}
    </div>
  );
}

function StepButton({ enabled, onClick, children }) {
  return (
    <button className="ur-tap" onClick={enabled ? onClick : undefined} disabled={!enabled} style={{
      width: '100%', border: 'none', borderRadius: 16, padding: 16, cursor: enabled ? 'pointer' : 'not-allowed',
      fontFamily: COND, fontSize: 16, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase',
      color: enabled ? '#04150a' : C.inkDim,
      background: enabled ? 'linear-gradient(135deg,#4ADE80,#22C55E 55%,#15803D)' : 'rgba(255,255,255,.05)',
      boxShadow: enabled ? '0 10px 30px rgba(34,197,94,.3)' : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
    }}>
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RIDES TAB (open board)
// ═══════════════════════════════════════════════════════════════════════════
function RequestCard({ req, onPay, credit }) {
  const tagColor = TAG_COLOR[req.rideType] || C.greenBright;
  const scheduledMs = req.scheduledAt?.toMillis ? req.scheduledAt.toMillis() : (req.scheduledAt?.seconds ? req.scheduledAt.seconds * 1000 : null);
  return (
    <div style={{ ...cardStyle, padding: '14px 15px 13px', marginBottom: 11, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2.5, background: 'linear-gradient(180deg,#4ADE80,transparent)' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 34, height: 34, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: 'rgba(251,191,36,.12)', border: '1.5px solid rgba(251,191,36,.35)' }}>⏳</div>
          <div>
            <div style={{ fontFamily: BODY, fontSize: 13, fontWeight: 700, color: C.inkBright, lineHeight: 1.1 }}>Awaiting payment</div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.inkDim, marginTop: 2 }}>Posted {tsAgo(req.createdAt)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', padding: '4px 8px', borderRadius: 7, color: tagColor, background: `${tagColor}18`, border: `1px solid ${tagColor}40` }}>{req.rideLabel || req.rideType}</span>
          {scheduledMs && (
            <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, color: C.cyan, padding: '2px 7px', borderRadius: 6, background: 'rgba(34,211,238,.08)', border: '1px solid rgba(34,211,238,.25)' }}>
              🗓 {new Date(scheduledMs).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 11, marginBottom: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.cyan, boxShadow: `0 0 7px ${C.cyan}` }} />
          <span style={{ width: 1.5, flex: 1, minHeight: 16, background: 'linear-gradient(180deg,#22D3EE,#4ADE80)', opacity: .4, margin: '2px 0' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.greenBright, boxShadow: `0 0 7px ${C.greenBright}` }} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {[req.pickup, req.dropoff].map((a, i) => (
            <div key={i} style={{ fontFamily: BODY, fontSize: 12.5, fontWeight: 600, color: C.inkBright, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a || '—'}</div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, padding: '10px 0', marginBottom: 12, borderTop: `1px solid ${C.inkFade}`, borderBottom: `1px solid ${C.inkFade}` }}>
        <Stat n={req.tripDistanceMiles} unit="mi" label="Distance" />
        <Stat n={req.tripDurationMin} unit="min" label="Est. time" />
        <Stat n={req.fareEstimate != null ? money(req.fareEstimate) : '—'} label="Est. fare" hi />
      </div>

      <div style={{ display: 'flex', gap: 9 }}>
        <PayBtn kind="cash" onClick={() => onPay(req, 'cash')} sub={req.fareEstimate != null ? `${money(req.fareEstimate)} on arrival` : 'on arrival'} />
        <PayBtn kind="credit" onClick={() => onPay(req, 'credit')} sub={`${money(credit || 0)} avail`} />
      </div>
    </div>
  );
}
function Stat({ n, unit, label, hi }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, color: hi ? C.greenBright : C.inkBright }}>
        {n ?? '—'}{unit && n != null ? <span style={{ fontSize: 9, color: C.inkMid, fontWeight: 600, marginLeft: 1 }}>{unit}</span> : ''}
      </div>
      <div style={{ fontFamily: COND, fontSize: 8.5, fontWeight: 800, letterSpacing: '.12em', color: C.inkDim, textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}
function PayBtn({ kind, sub, onClick }) {
  const cash = kind === 'cash';
  const col = cash ? C.greenSoft : C.amber;
  return (
    <button className="ur-tap" onClick={onClick} style={{
      flex: 1, cursor: 'pointer', borderRadius: 12, padding: '12px 8px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      border: `1.5px solid ${col}59`, background: `${col}12`, color: col,
    }}>
      <span style={{ fontSize: 16, lineHeight: 1 }}>{cash ? '💵' : '🪙'}</span>
      <span style={{ fontFamily: COND, fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>{cash ? 'Pay cash' : 'Ride credit'}</span>
      <span style={{ fontFamily: MONO, fontSize: 9, opacity: .7 }}>{sub}</span>
    </button>
  );
}

function RidesPane({ requests, loading, onPay, credit }) {
  return (
    <div style={{ animation: 'urUp .38s cubic-bezier(.34,1.1,.64,1) both' }}>
      <Eyebrow>Awaiting payment</Eyebrow>
      <H1>Rides</H1>
      <Sub>Your ride requests waiting to be paid. Pay one with <b style={{ color: C.greenSoft }}>cash</b> or <b style={{ color: C.amber }}>ride credit</b> to book it.</Sub>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '2px 2px 12px' }}>
        <Eyebrow style={{ letterSpacing: '.16em' }}>Your requests</Eyebrow>
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.greenBright, border: `1px solid ${C.border}`, background: 'rgba(34,197,94,.06)', padding: '3px 9px', borderRadius: 99 }}>{requests.length} PENDING</span>
      </div>

      {loading && <Empty icon="⏳" title="Loading" body="Fetching your requests…" />}
      {!loading && requests.length === 0 && <Empty icon="✅" title="All caught up" body="You have no rides waiting for payment. Post a request and it'll show up here to pay." />}
      {requests.map((req) => <RequestCard key={req.id} req={req} onPay={onPay} credit={credit} />)}
    </div>
  );
}
function Empty({ icon, title, body }) {
  return (
    <div style={{ ...cardStyle, padding: '30px 22px', textAlign: 'center' }}>
      <div style={{ fontSize: 30, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontFamily: COND, fontSize: 16, fontWeight: 800, letterSpacing: '.06em', color: C.inkBright, marginBottom: 6 }}>{title}</div>
      <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.inkMid, lineHeight: 1.6 }}>{body}</div>
    </div>
  );
}

// Shared stat tile (used by the wallet + account stats).
function FleetStat({ n, label, color, glow }) {
  return (
    <div style={{ ...cardStyle, flex: 1, padding: '13px 12px', textAlign: 'center' }}>
      <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800, lineHeight: 1, color, textShadow: glow ? `0 0 14px ${color}66` : 'none' }}>{n}</div>
      <div style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.14em', color: C.inkDim, textTransform: 'uppercase', marginTop: 5 }}>{label}</div>
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════════════════
// YOU TAB
// ═══════════════════════════════════════════════════════════════════════════
function YouPane({ account, onSignOut, onAddCredit }) {
  const name = account?.name || account?.displayName || 'Rider';
  const email = account?.email || '';
  const initial = name.trim().charAt(0).toUpperCase();
  const credit = Number(account?.credit || 0);
  return (
    <div style={{ animation: 'urUp .38s cubic-bezier(.34,1.1,.64,1) both' }}>
      <Eyebrow>Account</Eyebrow>
      <H1>You</H1>
      <Sub>Profile, payment and your ride history.</Sub>

      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 14, padding: '18px 16px', marginBottom: 14 }}>
        <div style={{ width: 60, height: 60, borderRadius: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: COND, fontSize: 26, fontWeight: 800, color: C.greenBright, background: 'linear-gradient(135deg,rgba(34,197,94,.2),rgba(34,211,238,.12))', border: `1.5px solid ${C.borderBright}`, overflow: 'hidden' }}>
          {account?.photoURL ? <img src={account.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
        </div>
        <div>
          <div style={{ fontFamily: BODY, fontSize: 19, fontWeight: 800, color: C.inkBright, lineHeight: 1.1 }}>{name}</div>
          {email && <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.inkMid, marginTop: 4 }}>{email}</div>}
          {account?.tier && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontFamily: COND, fontSize: 9.5, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: C.greenBright, border: `1px solid ${C.border}`, background: 'rgba(34,197,94,.07)', padding: '3px 9px', borderRadius: 99 }}>◆ {account.tier} rider</span>}
        </div>
      </div>

      {/* Ride credit wallet */}
      <div style={{ ...cardStyle, padding: '16px 16px 15px', marginBottom: 14, position: 'relative', overflow: 'hidden', borderColor: 'rgba(251,191,36,.22)' }}>
        <div style={{ position: 'absolute', right: -20, top: -20, width: 90, height: 90, borderRadius: '50%', background: 'radial-gradient(circle,rgba(251,191,36,.12),transparent 70%)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: C.amber, display: 'flex', alignItems: 'center', gap: 6 }}>🪙 Ride credit</div>
            <div style={{ fontFamily: MONO, fontSize: 30, fontWeight: 800, color: C.inkBright, marginTop: 6, lineHeight: 1 }}>{money(credit)}</div>
            <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.inkDim, marginTop: 5 }}>Prepaid — pay for rides on the board</div>
          </div>
          <button className="ur-tap" onClick={onAddCredit} style={{
            border: 'none', cursor: 'pointer', borderRadius: 13, padding: '12px 16px',
            fontFamily: COND, fontSize: 13, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#150e02',
            background: 'linear-gradient(135deg,#FCD34D,#FBBF24 55%,#D97706)', boxShadow: '0 8px 22px rgba(251,191,36,.28)',
          }}>+ Add</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <FleetStat n={account?.ridesCount ?? account?.totalRides ?? 0} label="Rides" color={C.greenBright} />
        <FleetStat n={account?.rating != null ? `★ ${Number(account.rating).toFixed(1)}` : '★ 5.0'} label="Rating" color={C.inkBright} />
        <FleetStat n={account?.totalSpent != null ? money(account.totalSpent) : '$0'} label="Spent" color={C.greenBright} />
      </div>

      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <Row icon="💳" title="Payment methods" sub={account?.defaultCard ? `•••• ${account.defaultCard} · default` : 'Add a card or use cash'} />
        <Row icon="🕓" title="Ride history" sub={`${account?.ridesCount ?? account?.totalRides ?? 0} completed trips`} border />
        <Row icon="🪙" title="Add ride credit" sub={`${money(credit)} balance`} border onClick={onAddCredit} />
        <Row icon="🛡️" title="Safety & sharing" sub="Trusted contacts, live share" border />
      </div>
      <div style={{ height: 12 }} />
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <Row icon="🔔" title="Notifications" />
        <Row icon="💬" title="Support" border />
        <Row icon="🚪" title="Sign out" danger border onClick={onSignOut} />
      </div>
    </div>
  );
}
function Row({ icon, title, sub, border, danger, onClick }) {
  return (
    <div className="ur-tap" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '15px 16px', cursor: 'pointer', borderTop: border ? `1px solid ${C.inkFade}` : 'none' }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: 'rgba(34,197,94,.08)', border: `1px solid ${C.border}` }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: BODY, fontSize: 14, fontWeight: 600, color: danger ? C.red : C.inkBright }}>{title}</div>
        {sub && <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.inkDim, marginTop: 2 }}>{sub}</div>}
      </div>
      {!danger && <span style={{ color: C.inkDim, fontSize: 16 }}>›</span>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT SHEET
// ═══════════════════════════════════════════════════════════════════════════
function PaymentSheet({ req, method, credit = 0, onClose, onConfirm, onAddCredit, busy }) {
  if (!req) return null;
  const fare = Number(req.fareEstimate || 0);
  const bd = fare > 0
    ? { base: fare * 0.15, dist: fare * 0.5, time: fare * 0.21, fee: fare * 0.14 }
    : { base: 0, dist: 0, time: 0, fee: 0 };
  const cash = method === 'cash';
  const insufficient = !cash && Number(credit) < fare;
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: 'absolute', inset: 0, zIndex: 70, background: 'rgba(2,5,3,.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end', animation: 'urFade .2s ease',
    }}>
      <div style={{
        width: '100%', background: 'linear-gradient(180deg,rgba(8,16,10,.98),rgba(4,8,5,.99))',
        borderTop: `1.5px solid ${C.borderBright}`, borderRadius: '26px 26px 34px 34px',
        padding: '10px 18px 26px', boxShadow: '0 -20px 60px rgba(0,0,0,.7),0 0 40px rgba(34,197,94,.08)',
        animation: 'urSheet .34s cubic-bezier(.34,1.16,.64,1) both',
      }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: C.inkFade, margin: '0 auto 16px' }} />
        <Eyebrow style={{ letterSpacing: '.2em', fontSize: 10 }}>{cash ? 'Cash payment' : 'Ride credit'}</Eyebrow>
        <div style={{ fontFamily: COND, fontSize: 22, fontWeight: 800, lineHeight: 1, margin: '4px 0 14px' }}>
          Book {(req.posterName || 'this').split(' ')[0]}'s ride
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '12px 13px', marginBottom: 14, borderRadius: 14, background: 'rgba(255,255,255,.02)', border: `1px solid ${C.inkFade}` }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.cyan }} />
            <span style={{ width: 1.5, flex: 1, minHeight: 14, background: 'linear-gradient(180deg,#22D3EE,#4ADE80)', opacity: .4, margin: '2px 0' }} />
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.greenBright }} />
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[req.pickup, req.dropoff].map((a, i) => (
              <div key={i} style={{ fontFamily: BODY, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a || '—'}</div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <BrkRow label="Base + booking" val={bd.base} />
          <BrkRow label={`Distance · ${req.tripDistanceMiles ?? '—'} mi`} val={bd.dist} />
          <BrkRow label={`Time · ${req.tripDurationMin ?? '—'} min`} val={bd.time} />
          <BrkRow label="Service fee" val={bd.fee} />
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.inkFade}`, marginTop: 4, paddingTop: 12 }}>
            <span style={{ fontFamily: COND, fontSize: 15, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: C.inkBright }}>Total</span>
            <span style={{ fontFamily: MONO, fontSize: 19, fontWeight: 800, color: C.greenBright }}>{money(fare)}</span>
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px', marginBottom: 16, borderRadius: 14,
          border: `1.5px solid ${insufficient ? 'rgba(248,113,113,.5)' : cash ? C.borderBright : 'rgba(251,191,36,.45)'}`,
          background: insufficient ? 'rgba(248,113,113,.06)' : cash ? 'rgba(34,197,94,.06)' : 'rgba(251,191,36,.06)',
        }}>
          <span style={{ fontSize: 20 }}>{cash ? '💵' : '🪙'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: BODY, fontSize: 13, fontWeight: 700 }}>{cash ? 'Cash to driver' : 'Ride credit'}</div>
            <div style={{ fontFamily: MONO, fontSize: 9.5, color: insufficient ? C.red : C.inkMid, marginTop: 2 }}>
              {cash
                ? `Pay ${money(fare)} in cash on arrival`
                : insufficient
                  ? `Balance ${money(credit)} · ${money(fare - credit)} short`
                  : `Balance ${money(credit)} → ${money(credit - fare)} after`}
            </div>
          </div>
        </div>

        {insufficient ? (
          <button className="ur-tap" onClick={onAddCredit} style={{
            width: '100%', border: 'none', borderRadius: 16, padding: 16, cursor: 'pointer',
            fontFamily: COND, fontSize: 16, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#150e02',
            background: 'linear-gradient(135deg,#FCD34D,#FBBF24 55%,#D97706)', boxShadow: '0 10px 30px rgba(251,191,36,.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
          }}>
            Add ride credit
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, opacity: .65, textTransform: 'none' }}>→ Wallet</span>
          </button>
        ) : (
          <button className="ur-tap" onClick={onConfirm} disabled={busy} style={{
            width: '100%', border: 'none', borderRadius: 16, padding: 16, cursor: busy ? 'wait' : 'pointer',
            fontFamily: COND, fontSize: 16, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#04150a',
            background: 'linear-gradient(135deg,#4ADE80,#22C55E 55%,#15803D)', boxShadow: '0 10px 30px rgba(34,197,94,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, opacity: busy ? .7 : 1,
          }}>
            {busy ? 'Booking…' : `Confirm & ${cash ? 'book' : 'pay'}`}
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, opacity: .65, textTransform: 'none' }}>→ Ride DB</span>
          </button>
        )}
        <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.inkDim, textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
          {cash
            ? <>Locks this Request atomically, then writes a <b style={{ color: C.greenSoft }}>Ride</b>. If another rider beat you, it just closes.</>
            : <>Ride credit is <b style={{ color: C.amber }}>prepaid</b> — {money(fare)} comes off your balance the moment it's booked.</>}
        </div>
      </div>
    </div>
  );
}
function BrkRow({ label, val }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 2px', fontFamily: MONO, fontSize: 12, color: C.inkMid }}>
      <span>{label}</span>
      <span style={{ color: C.inkBright, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(val)}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ADD-CREDIT (WALLET TOP-UP) SHEET
// ═══════════════════════════════════════════════════════════════════════════
const TOPUP_AMOUNTS = [10, 25, 50, 100];

function TopUpSheet({ balance = 0, onClose, onConfirm, busy }) {
  const [amount, setAmount] = useState(25);
  const [custom, setCustom] = useState('');
  const value = custom ? Number(custom) : amount;
  const valid = Number.isFinite(value) && value > 0;
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: 'absolute', inset: 0, zIndex: 72, background: 'rgba(2,5,3,.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end', animation: 'urFade .2s ease',
    }}>
      <div style={{
        width: '100%', background: 'linear-gradient(180deg,rgba(16,12,4,.98),rgba(6,5,2,.99))',
        borderTop: '1.5px solid rgba(251,191,36,.4)', borderRadius: '26px 26px 34px 34px',
        padding: '10px 18px 26px', boxShadow: '0 -20px 60px rgba(0,0,0,.7),0 0 40px rgba(251,191,36,.08)',
        animation: 'urSheet .34s cubic-bezier(.34,1.16,.64,1) both',
      }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: C.inkFade, margin: '0 auto 16px' }} />
        <Eyebrow style={{ letterSpacing: '.2em', fontSize: 10, color: C.amber }}>🪙 Add ride credit</Eyebrow>
        <div style={{ fontFamily: COND, fontSize: 22, fontWeight: 800, lineHeight: 1, margin: '4px 0 4px' }}>Top up your wallet</div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: C.inkMid, marginBottom: 16 }}>Balance {money(balance)} → <b style={{ color: C.amber }}>{money(balance + (valid ? value : 0))}</b></div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {TOPUP_AMOUNTS.map((a) => {
            const sel = !custom && amount === a;
            return (
              <button key={a} className="ur-tap" onClick={() => { setAmount(a); setCustom(''); }} style={{
                flex: 1, cursor: 'pointer', borderRadius: 13, padding: '14px 4px', fontFamily: MONO, fontSize: 15, fontWeight: 800,
                border: `1.5px solid ${sel ? 'rgba(251,191,36,.5)' : C.border}`, background: sel ? 'rgba(251,191,36,.12)' : 'rgba(255,255,255,.015)',
                color: sel ? C.amber : C.inkBright,
              }}>${a}</button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', marginBottom: 16, borderRadius: 13, border: `1px solid ${custom ? 'rgba(251,191,36,.4)' : C.border}`, background: 'rgba(255,255,255,.02)' }}>
          <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 800, color: C.inkMid }}>$</span>
          <input
            type="number" min="1" inputMode="decimal" placeholder="Custom amount"
            value={custom} onChange={(e) => setCustom(e.target.value)}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontFamily: MONO, fontSize: 15, fontWeight: 700, color: C.inkBright, colorScheme: 'dark' }}
          />
        </div>

        <button className="ur-tap" onClick={() => valid && onConfirm(value)} disabled={!valid || busy} style={{
          width: '100%', border: 'none', borderRadius: 16, padding: 16, cursor: valid && !busy ? 'pointer' : 'not-allowed',
          fontFamily: COND, fontSize: 16, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase',
          color: valid ? '#150e02' : C.inkDim,
          background: valid ? 'linear-gradient(135deg,#FCD34D,#FBBF24 55%,#D97706)' : 'rgba(255,255,255,.05)',
          boxShadow: valid ? '0 10px 30px rgba(251,191,36,.28)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, opacity: busy ? .7 : 1,
        }}>
          {busy ? 'Adding…' : `Add ${valid ? money(value) : 'credit'}`}
        </button>
        <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.inkDim, textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
          Credit is stored on your account and spent on the board. Card charging via Stripe is wired at checkout.
        </div>
      </div>
    </div>
  );
}

// ── Tab bar ──────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'request', label: 'Request', icon: (c) => <path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z" stroke={c} /> },
  { id: 'rides',   label: 'Rides',   icon: (c) => <><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h13l4 4v4a2 2 0 0 1-2 2h-2" stroke={c} /><circle cx="7.5" cy="17.5" r="2.5" stroke={c} /><circle cx="17.5" cy="17.5" r="2.5" stroke={c} /></> },
  { id: 'you',     label: 'You',     icon: (c) => <><circle cx="12" cy="7" r="4.2" stroke={c} /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" stroke={c} /></> },
];
function TabBar({ tab, setTab, rideCount }) {
  return (
    <nav style={{
      position: 'relative', zIndex: 50, flexShrink: 0, height: 76,
      display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
      background: 'linear-gradient(0deg,rgba(3,6,4,.97),rgba(3,6,4,.72))',
      borderTop: `1px solid ${C.border}`, backdropFilter: 'blur(14px)',
    }}>
      {TABS.map((t) => {
        const on = tab === t.id;
        const col = on ? C.greenBright : C.inkDim;
        return (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 5, cursor: 'pointer', border: 'none', background: 'none', position: 'relative', paddingTop: 8, color: col,
          }}>
            {on && <span style={{ position: 'absolute', top: 0, width: 34, height: 2.5, borderRadius: '0 0 3px 3px', background: C.greenBright, boxShadow: `0 0 10px ${C.greenBright}` }} />}
            <svg width={23} height={23} viewBox="0 0 24 24" fill="none" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ filter: on ? 'drop-shadow(0 0 8px rgba(74,222,128,.55))' : 'none' }}>
              {t.icon(col)}
            </svg>
            <span style={{ fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>{t.label}</span>
            {t.id === 'rides' && rideCount > 0 && (
              <span style={{ position: 'absolute', top: 4, right: 'calc(50% - 22px)', minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: C.red, color: '#150404', fontFamily: MONO, fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #030604' }}>{rideCount}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SHELL
// ═══════════════════════════════════════════════════════════════════════════
export default function UaTobRider({ uid, account, drivers = [], onSignOut = () => {} }) {
  const [tab, setTab] = useState('request');
  const [sheet, setSheet] = useState(null);          // { req, method }
  const [booking, setBooking] = useState(false);
  const [topup, setTopup] = useState(false);         // add-credit sheet open
  const [route, setRoute] = useState({ pickup: null, dropoff: null, polyline: null });
  const [requestOpen, setRequestOpen] = useState(false); // composer collapsed → button only

  const { requests, loading: loadingRequests } = useRequests(uid);
  const { claimRequest } = useClaimRequest(uid);
  const { addCredit, loading: addingCredit } = useAddCredit(uid);

  const credit = Number(account?.credit || 0);

  // Hide a request locally the instant it's claimed, before the snapshot catches up.
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  const board = useMemo(() => requests.filter((r) => !hiddenIds.has(r.id)), [requests, hiddenIds]);

  const openPay = useCallback((req, method) => setSheet({ req, method }), []);
  const openTopup = useCallback(() => { setSheet(null); setTopup(true); }, []);

  const confirmPay = useCallback(async () => {
    if (!sheet || booking) return;
    setBooking(true);
    try {
      await claimRequest(sheet.req, sheet.method);
      // Success — the new Ride goes active; index.jsx will swap to the map HUD
      // on the next Rides snapshot. Hide the claimed request immediately.
      setHiddenIds((prev) => new Set(prev).add(sheet.req.id));
      setSheet(null);
    } catch (err) {
      if (err?.code === 'insufficient_credit') {
        // Not enough balance — keep the request, send them to top up.
        openTopup();
      } else if (err?.code === 'already_claimed') {
        // Lost the claim race — silently drop the request from the board.
        setSheet(null);
        setHiddenIds((prev) => new Set(prev).add(sheet.req.id));
      } else {
        setSheet(null);
        console.warn('[UaTobRider] booking failed:', err?.message || err);
      }
    } finally {
      setBooking(false);
    }
  }, [sheet, booking, claimRequest, openTopup]);

  const handleAddCredit = useCallback(async (amount) => {
    const ok = await addCredit(amount);
    if (ok) setTopup(false);
  }, [addCredit]);

  const collapseRequest = useCallback(() => {
    setRequestOpen(false);
    setRoute({ pickup: null, dropoff: null, polyline: null });
  }, []);
  const onPosted = useCallback(() => {
    setTab('rides');
    setRequestOpen(false);
    setRoute({ pickup: null, dropoff: null, polyline: null });
  }, []);

  const modeLabel = tab.toUpperCase();

  return (
    <>
      <style>{CSS}</style>
      <div style={{
        position: 'fixed', inset: 0, background: C.bg, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        backgroundImage: 'radial-gradient(900px 500px at 50% -10%, rgba(34,197,94,.08), transparent 60%)',
      }}>
        <Ribbon mode={modeLabel} credit={credit} onOpenWallet={openTopup} />
        <InstallBanner />

        {tab === 'request' ? (
          /* Map-first home — live map backdrop + composer panel */
          <div style={{ position: 'relative', zIndex: 20, flex: 1, overflow: 'hidden' }}>
            <RiderMap
              center={account?.lat != null ? { lat: account.lat, lng: account.lng } : undefined}
              drivers={drivers}
              pickup={route.pickup}
              dropoff={route.dropoff}
              polyline={route.polyline}
            />
            <div className="ur-scroll" style={{
              position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '74%', overflowY: 'auto',
              background: 'linear-gradient(180deg, rgba(6,12,7,.82), rgba(4,8,5,.98))', backdropFilter: 'blur(16px)',
              borderTop: `1px solid ${C.border}`, borderRadius: '26px 26px 0 0',
              boxShadow: '0 -20px 50px rgba(0,0,0,.55)', padding: '10px 16px 20px', scrollbarWidth: 'none',
            }}>
              <button
                onClick={requestOpen ? collapseRequest : undefined}
                aria-label={requestOpen ? 'Collapse' : undefined}
                style={{ display: 'block', width: '100%', border: 'none', background: 'none', padding: '2px 0 12px', cursor: requestOpen ? 'pointer' : 'default' }}
              >
                <span style={{ display: 'block', width: 38, height: 4, borderRadius: 2, background: C.inkFade, margin: '0 auto' }} />
              </button>

              {requestOpen ? (
                <RequestPane uid={uid} account={account} onPosted={onPosted} onRoute={setRoute} />
              ) : (
                <div style={{ animation: 'urUp .3s cubic-bezier(.34,1.1,.64,1) both', paddingBottom: 6 }}>
                  <div style={{ fontFamily: COND, fontSize: 24, fontWeight: 800, letterSpacing: '.01em', color: C.inkBright }}>
                    Where to{account?.name ? `, ${String(account.name).split(' ')[0]}` : ''}?
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.inkMid, margin: '6px 0 16px', lineHeight: 1.5 }}>
                    Set a pickup and destination, then post it to the board.
                  </div>
                  <button className="ur-tap" onClick={() => setRequestOpen(true)} style={{
                    width: '100%', border: 'none', borderRadius: 16, padding: 17, cursor: 'pointer',
                    fontFamily: COND, fontSize: 17, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#04150a',
                    background: 'linear-gradient(135deg,#4ADE80,#22C55E 55%,#15803D)', boxShadow: '0 10px 30px rgba(34,197,94,.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  }}>
                    <span style={{ fontSize: 18 }}>🔍</span> Request a ride
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="ur-scroll" style={{ position: 'relative', zIndex: 20, flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '6px 16px 24px', scrollbarWidth: 'none' }}>
            {tab === 'rides'  && <RidesPane requests={board} loading={loadingRequests} onPay={openPay} credit={credit} />}
            {tab === 'you'    && <YouPane account={account} onSignOut={onSignOut} onAddCredit={openTopup} />}
          </div>
        )}

        {sheet && (
          <PaymentSheet
            req={sheet.req}
            method={sheet.method}
            credit={credit}
            onClose={() => setSheet(null)}
            onConfirm={confirmPay}
            onAddCredit={openTopup}
            busy={booking}
          />
        )}

        {topup && (
          <TopUpSheet
            balance={credit}
            onClose={() => setTopup(false)}
            onConfirm={handleAddCredit}
            busy={addingCredit}
          />
        )}

        <TabBar tab={tab} setTab={setTab} rideCount={board.length} />
      </div>
    </>
  );
}
