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
function Ribbon({ mode }) {
  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () => {
      const d = new Date(), p = (n) => String(n).padStart(2, '0');
      const h = d.getHours(), ap = h >= 12 ? 'PM' : 'AM';
      setClock(`${h % 12 || 12}:${p(d.getMinutes())}:${p(d.getSeconds())} ${ap}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{
      position: 'relative', zIndex: 40, height: 34, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px', background: 'linear-gradient(180deg,rgba(3,6,4,.9),rgba(3,6,4,0))',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: COND, fontSize: 12, fontWeight: 800, letterSpacing: '.24em', color: 'rgba(255,255,255,.55)' }}>UATOB</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: C.inkFade }}>·</span>
        <span style={{ fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.16em', color: C.greenBright, textShadow: `0 0 8px ${C.greenBright}88` }}>{mode}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.greenBright, boxShadow: `0 0 7px ${C.greenBright}`, animation: 'urBlink 1.6s ease-in-out infinite' }} />
          <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 800, letterSpacing: '.08em', color: C.greenBright }}>LIVE</span>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.4)' }}>{clock}</span>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 13 }}>
          {[5, 8, 11, 14].map((h, i) => (
            <span key={i} style={{ width: 2.5, height: h, borderRadius: 1, background: C.greenBright, boxShadow: `0 0 4px ${C.greenBright}88`, display: 'block', animation: `urBar 1.6s ease-in-out ${i * 0.18}s infinite` }} />
          ))}
        </div>
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

// ── Address input (autocomplete) ─────────────────────────────────────────────
function AddressField({ label, node, value, onChange, placeholder, onLocate, locating }) {
  const { predictions, fetch: fetchSug, clear } = useAutocomplete(250);
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative', padding: '14px 15px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: node, boxShadow: `0 0 10px ${node}` }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.18em', color: C.inkDim, textTransform: 'uppercase' }}>{label}</div>
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => { onChange(e.target.value); fetchSug(e.target.value); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          autoComplete="off"
          style={{
            width: '100%', background: 'none', border: 'none', outline: 'none',
            fontFamily: BODY, fontSize: 14, fontWeight: 600, color: C.inkBright,
            caretColor: C.greenBright, padding: '2px 0 0',
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
// REQUEST TAB
// ═══════════════════════════════════════════════════════════════════════════
function RequestPane({ uid, account, onPosted }) {
  const geo = useGeo();
  const [pickup,  setPickup]  = useState(account?.pickup || account?.address || '');
  const [dropoff, setDropoff] = useState('');
  const [rideType, setRideType] = useState('standard');
  const [posting, setPosting] = useState(false);

  const { tripData, loading: routing } = useRoute(pickup, dropoff);
  const { createRequest } = useCreateRequest(uid);

  const fares = useMemo(() => {
    const miles = tripData?.miles ?? 4.2;
    const mins  = tripData?.durationMin ?? 12;
    const out = {};
    for (const t of RIDE_TYPES) {
      try { out[t.id] = calcFare(t.id, miles, 1, mins).total; } catch { out[t.id] = null; }
    }
    return out;
  }, [tripData]);

  const ready = pickup.trim() && dropoff.trim() && tripData && !routing;

  const handleLocate = useCallback(async () => {
    try { const addr = await geo.resolve(); setPickup(addr); } catch { /* surfaced in geo.error */ }
  }, [geo]);

  const handlePost = useCallback(async () => {
    if (!ready || posting) return;
    setPosting(true);
    const label = RIDE_TYPES.find((t) => t.id === rideType)?.label ?? rideType;
    const fareEstimate = fares[rideType];
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
      fareEstimate,
      tripDistanceMiles: tripData.miles,
      tripDurationMin: tripData.durationMin,
    });
    setPosting(false);
    if (id) { setDropoff(''); onPosted?.(); }
  }, [ready, posting, rideType, fares, createRequest, account, pickup, dropoff, tripData, onPosted]);

  return (
    <div style={{ animation: 'urUp .38s cubic-bezier(.34,1.1,.64,1) both' }}>
      <Eyebrow>Post a trip</Eyebrow>
      <H1>Request a ride</H1>
      <Sub>Drop your pickup + destination. Your trip posts to the open board — any driver nearby can claim it.</Sub>

      <div style={cardStyle}>
        <AddressField label="Pickup" node={C.cyan} value={pickup} onChange={setPickup} placeholder="Where from?" onLocate={handleLocate} locating={geo.loading} />
        <div style={{ height: 1, background: C.inkFade }} />
        <AddressField label="Destination" node={C.greenBright} value={dropoff} onChange={setDropoff} placeholder="Where to?" />
      </div>
      {geo.error && <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.red, marginTop: 8 }}>{geo.error}</div>}

      {/* Ride types */}
      <div style={{ display: 'flex', gap: 8, margin: '14px 0 4px' }}>
        {RIDE_TYPES.map((t) => {
          const sel = rideType === t.id;
          return (
            <button
              key={t.id}
              className="ur-tap"
              onClick={() => setRideType(t.id)}
              style={{
                flex: 1, border: `1px solid ${sel ? C.borderBright : C.border}`, borderRadius: 14,
                padding: '11px 4px 10px', textAlign: 'center', cursor: 'pointer',
                background: sel ? 'rgba(34,197,94,.10)' : 'rgba(255,255,255,.015)',
                boxShadow: sel ? '0 0 22px rgba(34,197,94,.12)' : 'none',
              }}
            >
              <div style={{ fontSize: 19, lineHeight: 1 }}>{RIDE_ICON[t.id]}</div>
              <div style={{ fontFamily: COND, fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkBright, marginTop: 5 }}>{t.label}</div>
              <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.greenBright, marginTop: 2 }}>
                {fares[t.id] != null ? money(fares[t.id]) : '—'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Estimate */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '16px 2px 12px' }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, color: C.inkBright }}>
            {tripData ? tripData.miles : '—'}<span style={{ fontSize: 10, color: C.inkMid }}> mi</span>
          </div>
          <div style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.14em', color: C.inkDim, textTransform: 'uppercase' }}>Distance</div>
        </div>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, color: C.inkBright }}>
            {tripData ? tripData.durationMin : '—'}<span style={{ fontSize: 10, color: C.inkMid }}> min</span>
          </div>
          <div style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.14em', color: C.inkDim, textTransform: 'uppercase' }}>Est. time</div>
        </div>
        {routing && <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 9.5, color: C.amber }}>routing…</span>}
      </div>

      <button
        className="ur-tap"
        onClick={handlePost}
        disabled={!ready || posting}
        style={{
          width: '100%', border: 'none', borderRadius: 16, padding: 16, cursor: ready ? 'pointer' : 'not-allowed',
          fontFamily: COND, fontSize: 16, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase',
          color: ready ? '#04150a' : C.inkDim,
          background: ready ? 'linear-gradient(135deg,#4ADE80,#22C55E 55%,#15803D)' : 'rgba(255,255,255,.05)',
          boxShadow: ready ? '0 10px 30px rgba(34,197,94,.3)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
        }}
      >
        {posting ? 'Posting…' : 'Post request'}
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, opacity: .65, textTransform: 'none' }}>→ Request DB</span>
      </button>
      <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.inkDim, textAlign: 'center', marginTop: 11, lineHeight: 1.55 }}>
        Posting creates a <b style={{ color: C.greenSoft }}>Request</b> — visible to every driver on the board. No charge until it's claimed &amp; paid.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RIDES TAB (open board)
// ═══════════════════════════════════════════════════════════════════════════
function RequestCard({ req, onPay }) {
  const tagColor = TAG_COLOR[req.rideType] || C.greenBright;
  const initial = (req.posterName || 'Rider').trim().charAt(0).toUpperCase();
  return (
    <div style={{ ...cardStyle, padding: '14px 15px 13px', marginBottom: 11, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2.5, background: 'linear-gradient(180deg,#4ADE80,transparent)' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: COND, fontSize: 15, fontWeight: 800, color: C.greenBright, background: 'rgba(34,197,94,.12)', border: `1.5px solid ${C.borderBright}` }}>{initial}</div>
          <div>
            <div style={{ fontFamily: BODY, fontSize: 13, fontWeight: 700, color: C.inkBright, lineHeight: 1.1 }}>{req.posterName || 'Rider'}</div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.inkDim, marginTop: 2 }}>
              Posted {tsAgo(req.createdAt)}{req.posterRating ? ` · ★ ${Number(req.posterRating).toFixed(1)}` : ''}
            </div>
          </div>
        </div>
        <span style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', padding: '4px 8px', borderRadius: 7, color: tagColor, background: `${tagColor}18`, border: `1px solid ${tagColor}40` }}>{req.rideLabel || req.rideType}</span>
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
        <PayBtn kind="card" onClick={() => onPay(req, 'card')} sub="•••• 4821" />
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
  const col = cash ? C.greenSoft : C.cyan;
  return (
    <button className="ur-tap" onClick={onClick} style={{
      flex: 1, cursor: 'pointer', borderRadius: 12, padding: '12px 8px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      border: `1.5px solid ${col}59`, background: `${col}12`, color: col,
    }}>
      <span style={{ fontSize: 16, lineHeight: 1 }}>{cash ? '💵' : '💳'}</span>
      <span style={{ fontFamily: COND, fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>{cash ? 'Pay cash' : 'Pay card'}</span>
      <span style={{ fontFamily: MONO, fontSize: 9, opacity: .7 }}>{sub}</span>
    </button>
  );
}

function RidesPane({ requests, loading, onPay }) {
  return (
    <div style={{ animation: 'urUp .38s cubic-bezier(.34,1.1,.64,1) both' }}>
      <Eyebrow>Open board</Eyebrow>
      <H1>Rides</H1>
      <Sub>Live requests posted around you. Pick one and choose how to pay — that books it as a <b style={{ color: C.greenSoft }}>Ride</b>.</Sub>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '2px 2px 12px' }}>
        <Eyebrow style={{ letterSpacing: '.16em' }}>Open requests</Eyebrow>
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.greenBright, border: `1px solid ${C.border}`, background: 'rgba(34,197,94,.06)', padding: '3px 9px', borderRadius: 99 }}>{requests.length} LIVE</span>
      </div>

      {loading && <Empty icon="📡" title="Scanning the board" body="Loading open requests near you…" />}
      {!loading && requests.length === 0 && <Empty icon="🌙" title="Board is quiet" body="No open requests right now. Post one from the Request tab and it'll appear here for every rider." />}
      {requests.map((req) => <RequestCard key={req.id} req={req} onPay={onPay} />)}
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

// ═══════════════════════════════════════════════════════════════════════════
// DRIVER TAB
// ═══════════════════════════════════════════════════════════════════════════
function DriverPane({ drivers }) {
  const counts = useMemo(() => {
    let online = 0, busy = 0;
    for (const d of drivers) {
      if (d.status === 'online') online += 1;
      else if (d.status === 'on_trip' || d.status === 'busy') busy += 1;
    }
    return { online, busy, total: drivers.length };
  }, [drivers]);

  const sorted = useMemo(() => {
    const rank = (d) => (d.status === 'online' ? 0 : (d.status === 'on_trip' || d.status === 'busy') ? 1 : 2);
    return [...drivers].sort((a, b) => rank(a) - rank(b)).slice(0, 30);
  }, [drivers]);

  return (
    <div style={{ animation: 'urUp .38s cubic-bezier(.34,1.1,.64,1) both' }}>
      <Eyebrow>Live fleet</Eyebrow>
      <H1>Drivers</H1>
      <Sub>Everyone online around Orlando right now. Watch the fleet before you post.</Sub>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <FleetStat n={counts.online} label="Online" color={C.greenBright} glow />
        <FleetStat n={counts.busy} label="On trip" color={C.cyan} />
        <FleetStat n={counts.total} label="Total" color={C.inkBright} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '2px 2px 12px' }}>
        <Eyebrow style={{ letterSpacing: '.16em' }}>Fleet roster</Eyebrow>
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.greenBright, border: `1px solid ${C.border}`, background: 'rgba(34,197,94,.06)', padding: '3px 9px', borderRadius: 99 }}>BY STATUS</span>
      </div>

      {sorted.length === 0 && <Empty icon="🚦" title="No drivers yet" body="No drivers have come online. Check back shortly." />}
      {sorted.map((d) => <DriverRow key={d.id} d={d} />)}
    </div>
  );
}
function FleetStat({ n, label, color, glow }) {
  return (
    <div style={{ ...cardStyle, flex: 1, padding: '13px 12px', textAlign: 'center' }}>
      <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800, lineHeight: 1, color, textShadow: glow ? `0 0 14px ${color}66` : 'none' }}>{n}</div>
      <div style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.14em', color: C.inkDim, textTransform: 'uppercase', marginTop: 5 }}>{label}</div>
    </div>
  );
}
function DriverRow({ d }) {
  const st = d.status === 'online' ? C.greenBright : (d.status === 'on_trip' || d.status === 'busy') ? C.amber : C.inkDim;
  const stLabel = d.status === 'online' ? 'Online' : (d.status === 'on_trip' || d.status === 'busy') ? 'On trip' : 'Offline';
  const name = d.name || d.displayName || 'Driver';
  const vehicle = [d.vehicle, d.vehicleColor].filter(Boolean).join(' · ') || d.carModel || '';
  return (
    <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', marginBottom: 10 }}>
      <div style={{ position: 'relative', width: 46, height: 46, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, background: 'rgba(34,197,94,.1)', border: `2px solid ${C.borderBright}`, overflow: 'hidden' }}>
        {d.photoURL ? <img src={d.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🧑‍✈️'}
        <span style={{ position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: '50%', background: st, border: '2.5px solid #071009', boxShadow: d.status === 'online' ? `0 0 7px ${st}` : 'none' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: BODY, fontSize: 14, fontWeight: 700, color: C.inkBright }}>{name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
          {d.rating != null && <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: C.amber }}>★ {Number(d.rating).toFixed(2)}</span>}
          {vehicle && <span style={{ fontFamily: COND, fontSize: 10.5, fontWeight: 600, letterSpacing: '.03em', color: C.inkMid }}>{vehicle}</span>}
          {d.licensePlate && <span style={{ fontFamily: MONO, fontSize: 9, color: C.inkMid, padding: '2px 6px', borderRadius: 5, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.09)' }}>{d.licensePlate}</span>}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, color: st }}>{stLabel}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// YOU TAB
// ═══════════════════════════════════════════════════════════════════════════
function YouPane({ account, onSignOut }) {
  const name = account?.name || account?.displayName || 'Rider';
  const email = account?.email || '';
  const initial = name.trim().charAt(0).toUpperCase();
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

      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <FleetStat n={account?.ridesCount ?? account?.totalRides ?? 0} label="Rides" color={C.greenBright} />
        <FleetStat n={account?.rating != null ? `★ ${Number(account.rating).toFixed(1)}` : '★ 5.0'} label="Rating" color={C.inkBright} />
        <FleetStat n={account?.totalSpent != null ? money(account.totalSpent) : '$0'} label="Spent" color={C.greenBright} />
      </div>

      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <Row icon="💳" title="Payment methods" sub={account?.defaultCard ? `•••• ${account.defaultCard} · default` : 'Add a card or use cash'} />
        <Row icon="🕓" title="Ride history" sub={`${account?.ridesCount ?? account?.totalRides ?? 0} completed trips`} border />
        <Row icon="🎟️" title="Promos & credit" sub={account?.credit != null ? `${money(account.credit)} available` : 'Enter a promo code'} border />
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
function PaymentSheet({ req, method, onClose, onConfirm, busy }) {
  if (!req) return null;
  const fare = Number(req.fareEstimate || 0);
  const bd = fare > 0
    ? { base: fare * 0.15, dist: fare * 0.5, time: fare * 0.21, fee: fare * 0.14 }
    : { base: 0, dist: 0, time: 0, fee: 0 };
  const cash = method === 'cash';
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
        <Eyebrow style={{ letterSpacing: '.2em', fontSize: 10 }}>{cash ? 'Cash payment' : 'Card payment'}</Eyebrow>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px', marginBottom: 16, borderRadius: 14, border: `1.5px solid ${C.borderBright}`, background: 'rgba(34,197,94,.06)' }}>
          <span style={{ fontSize: 20 }}>{cash ? '💵' : '💳'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: BODY, fontSize: 13, fontWeight: 700 }}>{cash ? 'Cash to driver' : 'Visa •••• 4821'}</div>
            <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.inkMid, marginTop: 2 }}>{cash ? `Pay ${money(fare)} in cash on arrival` : `Charged ${money(fare)} when the trip ends`}</div>
          </div>
        </div>

        <button className="ur-tap" onClick={onConfirm} disabled={busy} style={{
          width: '100%', border: 'none', borderRadius: 16, padding: 16, cursor: busy ? 'wait' : 'pointer',
          fontFamily: COND, fontSize: 16, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#04150a',
          background: 'linear-gradient(135deg,#4ADE80,#22C55E 55%,#15803D)', boxShadow: '0 10px 30px rgba(34,197,94,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, opacity: busy ? .7 : 1,
        }}>
          {busy ? 'Booking…' : 'Confirm & book'}
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, opacity: .65, textTransform: 'none' }}>→ Ride DB</span>
        </button>
        <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.inkDim, textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
          Locks this Request atomically, then writes a <b style={{ color: C.greenSoft }}>Ride</b>. If another rider beat you, we'll say so.
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

// ── Toast ────────────────────────────────────────────────────────────────────
function Toast({ show, title, body }) {
  return (
    <div style={{
      position: 'absolute', left: 16, right: 16, bottom: 92, zIndex: 80,
      padding: '13px 15px', borderRadius: 14, background: 'rgba(20,8,8,.95)',
      border: '1.5px solid rgba(248,113,113,.4)', boxShadow: '0 12px 40px rgba(0,0,0,.6)',
      display: 'flex', alignItems: 'center', gap: 10,
      transform: show ? 'translateY(0)' : 'translateY(160%)',
      transition: 'transform .34s cubic-bezier(.34,1.16,.64,1)', pointerEvents: 'none',
    }}>
      <span style={{ fontSize: 18 }}>⚡</span>
      <div>
        <div style={{ fontFamily: BODY, fontSize: 13, fontWeight: 700, color: C.red }}>{title}</div>
        <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.inkMid, marginTop: 2 }}>{body}</div>
      </div>
    </div>
  );
}

// ── Tab bar ──────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'request', label: 'Request', icon: (c) => <path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z" stroke={c} /> },
  { id: 'rides',   label: 'Rides',   icon: (c) => <><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h13l4 4v4a2 2 0 0 1-2 2h-2" stroke={c} /><circle cx="7.5" cy="17.5" r="2.5" stroke={c} /><circle cx="17.5" cy="17.5" r="2.5" stroke={c} /></> },
  { id: 'driver',  label: 'Driver',  icon: (c) => <><circle cx="12" cy="8" r="4" stroke={c} /><path d="M4 21v-1a7 7 0 0 1 14 0v1" stroke={c} /></> },
  { id: 'you',     label: 'You',     icon: (c) => <><circle cx="12" cy="7" r="4.2" stroke={c} /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" stroke={c} /></> },
];
function TabBar({ tab, setTab, rideCount }) {
  return (
    <nav style={{
      position: 'relative', zIndex: 50, flexShrink: 0, height: 76,
      display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
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
  const [toast, setToast] = useState(null);          // { title, body }

  const { requests, loading: loadingRequests } = useRequests();
  const { claimRequest } = useClaimRequest(uid);

  // Hide a request locally the instant it's claimed, before the snapshot catches up.
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  const board = useMemo(() => requests.filter((r) => !hiddenIds.has(r.id)), [requests, hiddenIds]);

  const showToast = useCallback((title, body) => {
    setToast({ title, body });
    setTimeout(() => setToast(null), 2800);
  }, []);

  const openPay = useCallback((req, method) => setSheet({ req, method }), []);

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
      setSheet(null);
      if (err?.code === 'already_claimed') {
        setHiddenIds((prev) => new Set(prev).add(sheet.req.id));
        showToast('Just taken', `${sheet.req.posterName || 'That'} request was claimed first.`);
      } else {
        showToast('Booking failed', err?.message || 'Please try again.');
      }
    } finally {
      setBooking(false);
    }
  }, [sheet, booking, claimRequest, showToast]);

  const modeLabel = tab.toUpperCase();

  return (
    <>
      <style>{CSS}</style>
      <div style={{
        position: 'fixed', inset: 0, background: C.bg, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        backgroundImage: 'radial-gradient(900px 500px at 50% -10%, rgba(34,197,94,.08), transparent 60%)',
      }}>
        <Ribbon mode={modeLabel} />

        <div className="ur-scroll" style={{ position: 'relative', zIndex: 20, flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '6px 16px 24px', scrollbarWidth: 'none' }}>
          {tab === 'request' && <RequestPane uid={uid} account={account} onPosted={() => setTab('rides')} />}
          {tab === 'rides'   && <RidesPane requests={board} loading={loadingRequests} onPay={openPay} />}
          {tab === 'driver'  && <DriverPane drivers={drivers} />}
          {tab === 'you'     && <YouPane account={account} onSignOut={onSignOut} />}
        </div>

        <Toast show={!!toast} title={toast?.title} body={toast?.body} />

        {sheet && <PaymentSheet req={sheet.req} method={sheet.method} onClose={() => setSheet(null)} onConfirm={confirmPay} busy={booking} />}

        <TabBar tab={tab} setTab={setTab} rideCount={board.length} />
      </div>
    </>
  );
}
