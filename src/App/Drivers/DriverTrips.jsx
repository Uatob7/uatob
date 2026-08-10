// DriverTrips.jsx — new-UaTob (dark) trip history for drivers, from completed rides.

import { useMemo, useState } from 'react';

const C = {
  bg: '#050A06', card: 'rgba(255,255,255,.035)', border: 'rgba(126,186,162,.16)',
  ink: '#FFFFFF', inkMid: 'rgba(255,255,255,.62)', inkDim: 'rgba(255,255,255,.4)',
  green: '#22C55E', greenBt: '#4ADE80', cyan: '#3FD0EE', amber: '#FBBF24',
};
const COND = "'Barlow Condensed',sans-serif";
const MONO = "'JetBrains Mono',monospace";
const BODY = "'Barlow',system-ui,sans-serif";
const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
// Cash → driver keeps 100% of the fare; credit → 75% payout.
const takeOf = (r) => r.paymentMethod === 'credit'
  ? (Number(r.driverPayout ?? (r.fareTotal != null ? r.fareTotal * 0.75 : 0)) || 0)
  : (Number(r.fareTotal ?? 0) || 0);
const cityOf = (full, city) => city || String(full || '').split(',')[0] || '—';

const FILTERS = [
  { id: 'all',   label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'week',  label: 'This week' },
];

export default function DriverTrips({ completedRides = [], online }) {
  const [filter, setFilter] = useState('all');

  const rides = useMemo(() => {
    const todayK = (() => { const x = new Date(); x.setHours(0, 0, 0, 0); return x.getTime(); })();
    const weekK = todayK - 6 * 86400000;
    return completedRides.filter((r) => {
      if (filter === 'all') return true;
      const d = r.updatedAt || r.createdAt; if (!d) return false;
      const x = new Date(d); x.setHours(0, 0, 0, 0);
      return filter === 'today' ? x.getTime() === todayK : x.getTime() >= weekK;
    });
  }, [completedRides, filter]);

  const total = rides.reduce((s, r) => s + takeOf(r), 0);

  return (
    <div style={{ minHeight: '100%', background: C.bg, color: C.ink, fontFamily: BODY, padding: '10px 16px 24px' }}>
      <style>{`@keyframes dtUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: C.inkDim }}>
        History {online && <span style={{ color: C.greenBt }}>· live</span>}
      </div>
      <div style={{ fontFamily: COND, fontSize: 32, fontWeight: 900, letterSpacing: '-.5px', lineHeight: 1, margin: '4px 0 14px' }}>Your trips</div>

      {/* summary */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '13px 14px' }}>
          <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{rides.length}</div>
          <div style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: C.inkDim, marginTop: 5 }}>Trips</div>
        </div>
        <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '13px 14px' }}>
          <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800, color: C.greenBt, lineHeight: 1 }}>{money(total)}</div>
          <div style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: C.inkDim, marginTop: 5 }}>Earned</div>
        </div>
      </div>

      {/* filter chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {FILTERS.map((f) => {
          const on = filter === f.id;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              flex: 1, padding: '9px 0', borderRadius: 11, cursor: 'pointer',
              border: `1px solid ${on ? 'rgba(47,224,138,.35)' : C.border}`,
              background: on ? 'rgba(34,197,94,.1)' : 'rgba(255,255,255,.03)',
              color: on ? C.greenBt : C.inkMid, fontFamily: COND, fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase',
            }}>{f.label}</button>
          );
        })}
      </div>

      {/* list */}
      {rides.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: '30px 22px', textAlign: 'center' }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>🚗</div>
          <div style={{ fontFamily: COND, fontSize: 16, fontWeight: 800, marginBottom: 5 }}>No trips {filter !== 'all' ? 'in this range' : 'yet'}</div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.inkMid, lineHeight: 1.6 }}>Completed rides land here with your payout and route.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rides.map((r, i) => (
            <div key={r.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '13px 15px', animation: `dtUp .4s ${Math.min(i, 8) * 0.03}s ease both` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
                <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.inkDim }}>
                  {(r.updatedAt || r.createdAt) ? new Date(r.updatedAt || r.createdAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 800, color: C.greenBt }}>+{money(takeOf(r))}</div>
              </div>
              {(() => {
                const stops = Array.isArray(r.stops) ? r.stops : [];
                const nodes = [
                  { text: cityOf(r.pickup, r.pickupCity), c: C.cyan, sq: false },
                  ...stops.map((s) => ({ text: cityOf(s?.address, s?.city), c: C.amber, sq: false })),
                  { text: cityOf(r.dropoff, r.dropoffCity), c: C.greenBt, sq: true },
                ];
                return (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                      {nodes.map((n, idx) => (
                        <div key={idx} style={{ display: 'contents' }}>
                          <span style={{ width: 7, height: 7, borderRadius: n.sq ? 2 : '50%', background: n.c }} />
                          {idx < nodes.length - 1 && <span style={{ width: 1.5, flex: 1, minHeight: 12, background: n.c, opacity: .4, margin: '2px 0' }} />}
                        </div>
                      ))}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {nodes.map((n, idx) => (
                        <div key={idx} style={{ fontFamily: BODY, fontSize: 12.5, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.text}</div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              <div style={{ display: 'flex', gap: 7, marginTop: 11, flexWrap: 'wrap' }}>
                <Chip>{r.rideLabel || r.rideType || 'Standard'}</Chip>
                {Array.isArray(r.stops) && r.stops.length > 0 && <Chip color={C.amber}>{r.stops.length} stop{r.stops.length > 1 ? 's' : ''}</Chip>}
                {r.tripDistanceMiles != null && <Chip>{Number(r.tripDistanceMiles).toFixed(1)} mi</Chip>}
                <Chip color={r.paymentMethod === 'credit' ? C.amber : C.greenBt}>{r.paymentMethod === 'credit' ? 'Credit' : 'Cash'}</Chip>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ children, color }) {
  return (
    <span style={{
      fontFamily: MONO, fontSize: 8.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase',
      padding: '3px 9px', borderRadius: 99, color: color || 'rgba(255,255,255,.55)',
      background: 'rgba(255,255,255,.05)', border: `1px solid ${color ? color + '3a' : 'rgba(255,255,255,.1)'}`,
    }}>{children}</span>
  );
}
