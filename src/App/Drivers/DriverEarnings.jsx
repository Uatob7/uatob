// DriverEarnings.jsx
// New-UaTob (dark) earnings cockpit for the driver app. Computes real numbers
// from completed rides and frames the day around a personal goal with a live
// "pace" ring — are you ahead of where you should be right now?

import { useMemo, useState } from 'react';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';
import { useSettleDriverCash } from '@/App/Drivers/useSettleDriverCash';

const gdb = getFirestore(firebase_app);

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

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const money0 = (n) => `$${Math.round(Number(n) || 0)}`;
const dayKey = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
const isCredit = (r) => r.paymentMethod === 'credit';
// What the driver actually took: cash → keeps 100% of the fare; credit → 75% payout.
const takeOf = (r) => isCredit(r)
  ? (Number(r.driverPayout ?? (r.fareTotal != null ? r.fareTotal * 0.75 : 0)) || 0)
  : (Number(r.fareTotal ?? 0) || 0);
// 25% UaTob fee the driver owes on a cash ride (netted from their credit balance).
const feeOf = (r) => isCredit(r) ? 0 : (Number(r.platformFee ?? (r.fareTotal != null ? r.fareTotal * 0.25 : 0)) || 0);

export default function DriverEarnings({ completedRides = [], driver, online }) {
  // Daily goal lives on the driver doc (live snapshot). Edit it in a small sheet.
  const goal = Number(driver?.dailyGoal) > 0 ? Number(driver.dailyGoal) : 150;
  const [editing, setEditing] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [goalSaving, setGoalSaving] = useState(false);

  const openGoal = () => { setGoalInput(String(goal)); setEditing(true); };
  const saveGoal = async () => {
    const v = Math.max(20, Math.min(2000, Math.round(Number(goalInput) || 0)));
    if (!driver?.uid || !v) { setEditing(false); return; }
    setGoalSaving(true);
    try {
      await setDoc(doc(gdb, 'Drivers', driver.uid), { dailyGoal: v, updatedAt: serverTimestamp() }, { merge: true });
      setEditing(false);
    } catch (e) { /* non-fatal */ }
    finally { setGoalSaving(false); }
  };

  const stats = useMemo(() => {
    const todayK = dayKey(new Date());
    const weekStart = todayK - 6 * 86400000;
    let today = 0, todayN = 0, week = 0, weekN = 0, all = 0;
    let cashKept = 0, creditPaid = 0, feeOwed = 0, cashN = 0, creditN = 0;
    const bars = Array.from({ length: 7 }, (_, i) => ({ k: weekStart + i * 86400000, amt: 0 }));

    for (const r of completedRides) {
      const d = r.updatedAt || r.createdAt;
      if (!d) continue;
      const k = dayKey(d);
      const p = takeOf(r);
      all += p;
      if (isCredit(r)) { creditPaid += p; creditN++; } else { cashKept += p; feeOwed += feeOf(r); cashN++; }
      if (k === todayK) { today += p; todayN++; }
      if (k >= weekStart) {
        week += p; weekN++;
        const b = bars.find((x) => x.k === k);
        if (b) b.amt += p;
      }
    }
    return { today, todayN, week, weekN, all, allN: completedRides.length, bars, cashKept, creditPaid, feeOwed, cashN, creditN };
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
  const connected = driver?.transferCapability === 'enabled';

  const recent = completedRides.slice(0, 6);

  // ── payout actions ────────────────────────────────────────────────────────
  const [busy, setBusy] = useState('');   // 'deposit' | 'cashout' | ''
  const [feedback, setFeedback] = useState(null);
  const { settle } = useSettleDriverCash();

  const setupDeposit = async () => {
    if (busy) return;
    setBusy('deposit'); setFeedback(null);
    try {
      const res = await fetch('/api/drivers/connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: driver?.uid }),
      });
      const data = await res.json();
      if (data?.accountLink) { window.location.href = data.accountLink; return; }
      if (data?.enabled) { setFeedback({ type: 'ok', msg: 'Bank already linked.' }); return; }
      setFeedback({ type: 'error', msg: data?.error || 'Could not start Stripe setup.' });
    } catch (e) {
      setFeedback({ type: 'error', msg: e?.message || 'Stripe setup failed.' });
    } finally { setBusy(''); }
  };

  const cashOut = async () => {
    if (busy || net <= 0) return;
    setBusy('cashout'); setFeedback(null);
    try {
      const out = await settle(driver?.uid);
      setFeedback({ type: 'ok', msg: `${money(out?.netPayout ?? net)} on the way to your bank.` });
    } catch (e) {
      setFeedback({ type: 'error', msg: e?.message || 'Cash-out failed.' });
    } finally { setBusy(''); }
  };

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
            <button onClick={openGoal} style={{ marginTop: 5, background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO, fontSize: 10, fontWeight: 700, color: C.inkDim, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              of {money0(goal)} goal <span style={{ color: C.greenBt }}>✎</span>
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

      {/* ── Cash vs Credit ─────────────────────────────────────────── */}
      <div style={{ ...cardStyle(), padding: '16px', marginBottom: 12, animation: 'deUp .5s .08s ease both' }}>
        <div style={{ fontFamily: COND, fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: C.inkDim, marginBottom: 12 }}>Cash vs credit</div>
        <Split icon="💵" title="Cash kept" note={`${stats.cashN} rides · you keep 100%`} value={money(stats.cashKept)} color={C.greenBt} />
        <div style={{ height: 1, background: C.border, margin: '11px 0' }} />
        <Split icon="🪙" title="Credit payout" note={`${stats.creditN} rides · 75% to your bank`} value={money(stats.creditPaid)} color={C.greenBt} />
        <div style={{ height: 1, background: C.border, margin: '11px 0' }} />
        <Split icon="⚖️" title="Owed to UaTob" note="25% fee on cash — netted from credit" value={`−${money(stats.feeOwed)}`} color={C.amber} />
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

      {/* ── Balance + payout ──────────────────────────────────────────── */}
      <div style={{ ...cardStyle(), padding: '16px', margin: '12px 0', animation: 'deUp .5s .16s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: C.inkDim }}>Available balance</div>
            <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 800, color: net >= 0 ? C.greenBt : C.red, marginTop: 4, lineHeight: 1 }}>
              {net >= 0 ? '' : '−'}{money(Math.abs(net))}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.inkDim, marginTop: 4 }}>
              {platformOwes > 0 ? `${money(platformOwes)} owed to you` : cashOwed > 0 ? `${money(cashOwed)} cash to settle` : 'All settled'}
            </div>
          </div>
          <span style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', padding: '4px 9px', borderRadius: 99, color: connected ? C.greenBt : C.amber, background: connected ? 'rgba(34,197,94,.1)' : 'rgba(251,191,36,.1)', border: `1px solid ${connected ? 'rgba(34,197,94,.3)' : 'rgba(251,191,36,.3)'}` }}>
            {connected ? '✓ Bank linked' : 'No bank'}
          </span>
        </div>

        {/* CTA */}
        {connected ? (
          <button onClick={cashOut} disabled={busy === 'cashout' || net <= 0} style={{
            marginTop: 14, width: '100%', borderRadius: 13, padding: 14, border: 'none',
            cursor: net > 0 && !busy ? 'pointer' : 'not-allowed',
            fontFamily: COND, fontSize: 15, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase',
            color: net > 0 ? '#04150a' : C.inkDim,
            background: net > 0 ? 'linear-gradient(135deg,#2FE08A,#17B673 55%,#15803D)' : 'rgba(255,255,255,.05)',
            boxShadow: net > 0 ? '0 8px 24px rgba(34,197,94,.3)' : 'none', opacity: busy === 'cashout' ? .7 : 1,
          }}>{busy === 'cashout' ? 'Cashing out…' : net > 0 ? `Cash out ${money(net)}` : 'Nothing to cash out'}</button>
        ) : (
          <button onClick={setupDeposit} disabled={busy === 'deposit'} style={{
            marginTop: 14, width: '100%', borderRadius: 13, padding: 14, border: 'none', cursor: busy ? 'wait' : 'pointer',
            fontFamily: COND, fontSize: 15, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#04150a',
            background: 'linear-gradient(135deg,#2FE08A,#17B673 55%,#15803D)', boxShadow: '0 8px 24px rgba(34,197,94,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: busy === 'deposit' ? .7 : 1,
          }}>{busy === 'deposit' ? 'Opening Stripe…' : '🏦 Set up direct deposit'}</button>
        )}
        {!connected && (
          <div style={{ fontFamily: MONO, fontSize: 9, color: C.inkDim, textAlign: 'center', marginTop: 9, lineHeight: 1.5 }}>
            Link your bank via Stripe to get paid within 24h of completing rides.
          </div>
        )}
        {feedback && (
          <div style={{ fontFamily: MONO, fontSize: 10, color: feedback.type === 'ok' ? C.greenBt : C.red, textAlign: 'center', marginTop: 10 }}>{feedback.msg}</div>
        )}
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
              <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, color: C.greenBt }}>+{money(takeOf(r))}</div>
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

      {/* ── Goal editor ─────────────────────────────────────────────── */}
      {editing && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setEditing(false); }} style={{
          position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(2,5,3,.62)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div style={{ width: '100%', maxWidth: 460, background: 'linear-gradient(180deg,rgba(10,18,12,.99),rgba(5,10,7,1))', borderTop: `1.5px solid ${C.borderHi}`, borderRadius: '24px 24px 0 0', padding: '16px 18px calc(22px + env(safe-area-inset-bottom))', boxShadow: '0 -20px 60px rgba(0,0,0,.7)' }}>
            <div style={{ width: 38, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.14)', margin: '0 auto 14px' }} />
            <div style={{ fontFamily: COND, fontSize: 20, fontWeight: 900, color: C.ink, letterSpacing: '-.01em' }}>Set your daily goal</div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.inkDim, marginTop: 3, marginBottom: 16 }}>How much do you want to make in a day? Drives your pace ring.</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 14, border: `1px solid ${C.borderHi}`, background: 'rgba(255,255,255,.03)' }}>
              <span style={{ fontFamily: MONO, fontSize: 24, fontWeight: 800, color: C.greenBt }}>$</span>
              <input
                type="number" min="20" max="2000" inputMode="numeric" autoFocus
                value={goalInput} onChange={(e) => setGoalInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveGoal(); }}
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontFamily: MONO, fontSize: 26, fontWeight: 800, color: C.ink, colorScheme: 'dark', width: '100%' }}
              />
              <span style={{ fontFamily: COND, fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkDim }}>/ day</span>
            </div>

            <div style={{ display: 'flex', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
              {[100, 150, 200, 250, 300].map((q) => (
                <button key={q} onClick={() => setGoalInput(String(q))} style={{ flex: 1, minWidth: 56, padding: '8px 0', borderRadius: 10, cursor: 'pointer', border: `1px solid ${String(q) === goalInput ? C.borderHi : C.border}`, background: String(q) === goalInput ? 'rgba(34,197,94,.1)' : 'rgba(255,255,255,.03)', color: String(q) === goalInput ? C.greenBt : C.inkMid, fontFamily: MONO, fontSize: 12, fontWeight: 800 }}>${q}</button>
              ))}
            </div>

            <button onClick={saveGoal} disabled={goalSaving} style={{
              marginTop: 16, width: '100%', borderRadius: 14, padding: 15, border: 'none', cursor: goalSaving ? 'wait' : 'pointer',
              fontFamily: COND, fontSize: 15, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#04150a',
              background: 'linear-gradient(135deg,#2FE08A,#17B673 55%,#15803D)', boxShadow: '0 8px 24px rgba(34,197,94,.3)', opacity: goalSaving ? .7 : 1,
            }}>{goalSaving ? 'Saving…' : 'Save goal'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function cardStyle() {
  return { background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: '0 4px 20px rgba(0,0,0,.35)' };
}

function Split({ icon, title, note, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: 'rgba(255,255,255,.04)', border: `1px solid ${C.border}` }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: BODY, fontSize: 13.5, fontWeight: 700, color: C.ink }}>{title}</div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: C.inkDim, marginTop: 2 }}>{note}</div>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, color }}>{value}</div>
    </div>
  );
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
