// DriverEarnings.jsx
// New-UaTob (dark) earnings cockpit for the driver app. Computes real numbers
// from completed rides and frames the day around a personal goal with a live
// "pace" ring — are you ahead of where you should be right now?

import { useMemo, useState } from 'react';

const C = {
  bg:        '#050A06',
  card:      'rgba(255,255,255,.035)',
  border:    'rgba(126,186,162,.16)',
  borderHi:  'rgba(47,224,138,.35)',
  ink:       '#FFFFFF',
  inkMid:    'rgba(255,255,255,.62)',
  inkDim:    'rgba(255,255,255,.4)',
  green:     '#22C55E',
  greenBt:   '#4ADE80',
  amber:     '#FBBF24',
  red:       '#F87171',
  track:     'rgba(255,255,255,.08)',
};
const COND = "'Barlow Condensed',sans-serif";
const MONO = "'JetBrains Mono',monospace";
const BODY = "'Barlow',system-ui,sans-serif";

const GOAL_KEY = 'uatob_driver_goal';
const GOALS = [100, 150, 200, 250, 300, 400];
const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const money0 = (n) => `$${Math.round(Number(n) || 0)}`;
const dayKey = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
const payoutOf = (r) => Number(r.driverPayout ?? (r.fareTotal != null ? r.fareTotal * 0.75 : 0)) || 0;

export default function DriverEarnings({ completedRides = [], driver, online }) {
  const [goal, setGoal] = useState(() => {
    const v = Number(typeof localStorage !== 'undefined' && localStorage.getItem(GOAL_KEY));
    return GOALS.includes(v) ? v : 150;
  });
  const cycleGoal = () => {
    const next = GOALS[(GOALS.indexOf(goal) + 1) % GOALS.length];
    setGoal(next);
    try { localStorage.setItem(GOAL_KEY, String(next)); } catch {}
  };

  const stats = useMemo(() => {
    const todayK = dayKey(new Date());
    const weekStart = todayK - 6 * 86400000;
    let today = 0, todayN = 0, week = 0, weekN = 0, all = 0;
    const bars = Array.from({ length: 7 }, (_, i) => ({ k: weekStart + i * 86400000, amt: 0 }));

    for (const r of completedRides) {
      const d = r.updatedAt || r.createdAt;
      if (!d) continue;
      const k = dayKey(d);
      const p = payoutOf(r);
      all += p;
      if (k === todayK) { today += p; todayN++; }
      if (k >= weekStart) {
        week += p; weekN++;
        const b = bars.find((x) => x.k === k);
        if (b) b.amt += p;
      }
    }
    return { today, todayN, week, weekN, all, allN: completedRides.length, bars };
  }, [completedRides]);

  // Live pace: how much of the goal you'd expect by now (6am → midnight window).
  const now = new Date();
  const winStart = 6, winEnd = 24;
  const hrs = Math.max(0, Math.min(winEnd - winStart, now.getHours() + now.getMinutes() / 60 - winStart));
  const paceFrac = hrs / (winEnd - winStart);
  const expected = goal * paceFrac;
  const ahead = stats.today - expected;
  const pct = Math.max(0, Math.min(1, stats.today / goal));
  const hitGoal = stats.today >= goal;

  // ring geometry
  const R = 74, CIRC = 2 * Math.PI * R;
  const ringColor = hitGoal ? C.greenBt : ahead >= 0 ? C.green : C.amber;

  const avgPerTrip = stats.allN ? stats.all / stats.allN : 0;
  const cb = driver?.cashBalance ?? {};
  const platformOwes = Number(cb.platformOwes ?? 0);
  const cashOwed = Number(cb.cashOwed ?? 0);
  const net = platformOwes - cashOwed;

  const recent = completedRides.slice(0, 6);

  return (
    <div style={{ minHeight: '100%', background: C.bg, color: C.ink, fontFamily: BODY, padding: '10px 16px 24px' }}>
      <style>{`@keyframes deUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}} @keyframes deRing{from{stroke-dashoffset:${CIRC}}}`}</style>

      <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: C.inkDim }}>
        Earnings {online && <span style={{ color: C.greenBt }}>· live</span>}
      </div>
      <div style={{ fontFamily: COND, fontSize: 32, fontWeight: 900, letterSpacing: '-.5px', lineHeight: 1, margin: '4px 0 16px' }}>Today’s pace</div>

      {/* ── Goal pace ring ─────────────────────────────────────────── */}
      <div style={{ ...cardStyle(), padding: '22px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'deUp .4s ease both' }}>
        <div style={{ position: 'relative', width: 180, height: 180 }}>
          <svg width="180" height="180" viewBox="0 0 180 180" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="90" cy="90" r={R} fill="none" stroke={C.track} strokeWidth="12" />
            <circle cx="90" cy="90" r={R} fill="none" stroke={ringColor} strokeWidth="12" strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct)}
              style={{ transition: 'stroke-dashoffset .9s cubic-bezier(.34,1.1,.64,1), stroke .4s', filter: `drop-shadow(0 0 8px ${ringColor}aa)`, animation: 'deRing 1s ease' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontFamily: MONO, fontSize: 30, fontWeight: 800, lineHeight: 1, color: C.ink }}>{money0(stats.today)}</div>
            <button onClick={cycleGoal} style={{ marginTop: 5, background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO, fontSize: 10, fontWeight: 700, color: C.inkDim }}>
              of {money0(goal)} goal ▾
            </button>
            <div style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: C.inkDim, marginTop: 4 }}>{stats.todayN} trips today</div>
          </div>
        </div>

        {/* pace verdict */}
        <div style={{
          marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 99,
          background: hitGoal ? 'rgba(74,222,128,.12)' : ahead >= 0 ? 'rgba(34,197,94,.1)' : 'rgba(251,191,36,.1)',
          border: `1px solid ${hitGoal ? C.borderHi : ahead >= 0 ? 'rgba(34,197,94,.3)' : 'rgba(251,191,36,.3)'}`,
        }}>
          <span style={{ fontSize: 14 }}>{hitGoal ? '🎯' : ahead >= 0 ? '🔥' : '⏱'}</span>
          <span style={{ fontFamily: COND, fontSize: 13, fontWeight: 800, letterSpacing: '.04em', color: ringColor }}>
            {hitGoal ? 'Goal smashed!' : ahead >= 0 ? `${money0(ahead)} ahead of pace` : `${money0(goal - stats.today)} to hit goal`}
          </span>
        </div>
      </div>

      {/* ── Stat tiles ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, margin: '12px 0' }}>
        <Tile label="This week" value={money0(stats.week)} sub={`${stats.weekN} trips`} accent={C.greenBt} delay={.08} />
        <Tile label="Per trip"  value={money0(avgPerTrip)} sub="avg" accent={C.ink} delay={.14} />
        <Tile label="All time"  value={money0(stats.all)} sub={`${stats.allN} trips`} accent={C.greenBt} delay={.2} />
      </div>

      {/* ── Week bars ──────────────────────────────────────────────── */}
      <div style={{ ...cardStyle(), padding: '16px 16px 12px', animation: 'deUp .5s .1s ease both' }}>
        <div style={{ fontFamily: COND, fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: C.inkDim, marginBottom: 14 }}>Last 7 days</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 7, height: 96 }}>
          {stats.bars.map((b, i) => {
            const max = Math.max(...stats.bars.map((x) => x.amt), 1);
            const h = b.amt > 0 ? Math.max(6, (b.amt / max) * 82) : 3;
            const isToday = i === stats.bars.length - 1;
            const label = new Date(b.k).toLocaleDateString('en-US', { weekday: 'short' })[0];
            return (
              <div key={b.k} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: b.amt > 0 ? C.inkMid : 'transparent' }}>{money0(b.amt)}</div>
                <div style={{ width: '100%', maxWidth: 26, height: h, borderRadius: 6, background: isToday ? `linear-gradient(180deg,${C.greenBt},${C.green})` : 'rgba(255,255,255,.12)', boxShadow: isToday ? `0 0 12px ${C.green}66` : 'none', transition: 'height .5s ease' }} />
                <div style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, color: isToday ? C.greenBt : C.inkDim }}>{label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Balance ────────────────────────────────────────────────── */}
      <div style={{ ...cardStyle(), padding: '15px 16px', margin: '12px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'deUp .5s .16s ease both' }}>
        <div>
          <div style={{ fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: C.inkDim }}>Balance</div>
          <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800, color: net >= 0 ? C.greenBt : C.red, marginTop: 3 }}>
            {net >= 0 ? '+' : '−'}{money(Math.abs(net))}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: C.inkDim, marginTop: 2 }}>
            {platformOwes > 0 ? `${money(platformOwes)} owed to you` : cashOwed > 0 ? `${money(cashOwed)} cash to settle` : 'All settled'}
          </div>
        </div>
        <div style={{ fontFamily: COND, fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkDim, textAlign: 'right' }}>
          {driver?.transferCapability === 'enabled' ? 'Cash-out ready' : 'Manage in Profile'}
        </div>
      </div>

      {/* ── Recent payouts ─────────────────────────────────────────── */}
      {recent.length > 0 && (
        <div style={{ ...cardStyle(), padding: '6px 16px', animation: 'deUp .5s .22s ease both' }}>
          <div style={{ fontFamily: COND, fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: C.inkDim, padding: '10px 0 4px' }}>Recent payouts</div>
          {recent.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: BODY, fontSize: 13, fontWeight: 700, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190 }}>
                  {(r.dropoffCity || String(r.dropoff || '').split(',')[0] || 'Trip')}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.inkDim, marginTop: 2 }}>
                  {(r.updatedAt || r.createdAt) ? new Date(r.updatedAt || r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''} · {r.paymentMethod === 'credit' ? 'Credit' : 'Cash'}
                </div>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, color: C.greenBt }}>+{money(payoutOf(r))}</div>
            </div>
          ))}
        </div>
      )}

      {completedRides.length === 0 && (
        <div style={{ ...cardStyle(), padding: '28px 20px', textAlign: 'center', marginTop: 12 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>💸</div>
          <div style={{ fontFamily: COND, fontSize: 16, fontWeight: 800, color: C.ink, marginBottom: 5 }}>No trips yet</div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.inkMid, lineHeight: 1.6 }}>Go online and complete a ride — your earnings and pace show up here.</div>
        </div>
      )}
    </div>
  );
}

function cardStyle() {
  return { background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: '0 4px 20px rgba(0,0,0,.35)' };
}

function Tile({ label, value, sub, accent, delay }) {
  return (
    <div style={{ flex: 1, ...cardStyle(), padding: '13px 12px', textAlign: 'center', animation: `deUp .5s ${delay}s ease both` }}>
      <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 800, lineHeight: 1, color: accent }}>{value}</div>
      <div style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: C.inkDim, marginTop: 5 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 8.5, color: 'rgba(255,255,255,.32)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}
