// DriverProfile.jsx — new-UaTob (dark) "You" screen for drivers.
// Identity, payout (Stripe deposit) setup, vehicle, documents, and settings.

import { useState } from 'react';

const C = {
  bg: '#050A06', card: 'rgba(255,255,255,.035)', border: 'rgba(126,186,162,.16)', borderHi: 'rgba(47,224,138,.32)',
  ink: '#FFFFFF', inkMid: 'rgba(255,255,255,.62)', inkDim: 'rgba(255,255,255,.4)',
  green: '#22C55E', greenBt: '#4ADE80', amber: '#FBBF24', red: '#F87171', cyan: '#3FD0EE',
};
const COND = "'Barlow Condensed',sans-serif";
const MONO = "'JetBrains Mono',monospace";
const BODY = "'Barlow',system-ui,sans-serif";

const STATUS_META = {
  online:   { label: 'Online',       color: C.greenBt },
  offline:  { label: 'Offline',      color: C.inkDim },
  approved: { label: 'Approved',     color: C.greenBt },
  pending:  { label: 'Under review', color: C.amber },
  rejected: { label: 'Rejected',     color: C.red },
  suspended:{ label: 'Suspended',    color: C.red },
};

export default function DriverProfile({ driver, online, onSignOut, onOpenSupport, onEnablePush }) {
  const first = driver?.firstName || '';
  const last  = driver?.lastName || '';
  const name  = [first, last].filter(Boolean).join(' ') || 'Driver';
  const initials = `${first[0] || ''}${last[0] || ''}`.toUpperCase() || 'D';
  const photo = driver?.profilePhotoUrl || driver?.photoURL || '';
  const rating = driver?.averageRating ?? driver?.rating;
  const connected = driver?.transferCapability === 'enabled';
  const sm = STATUS_META[online ? 'online' : (driver?.status || 'offline')] || STATUS_META.offline;
  const v = driver?.vehicle || {};

  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');

  // push state (Notification.permission isn't reactive; re-reads on render)
  const perm = (typeof window !== 'undefined' && 'Notification' in window) ? window.Notification.permission : 'unsupported';
  const pushOn     = perm === 'granted' || !!driver?.fcmToken;
  const pushDenied = perm === 'denied' && !driver?.fcmToken;
  const [pushBusy, setPushBusy] = useState(false);
  const enablePush = async () => {
    if (pushBusy || pushOn || pushDenied) return;
    setPushBusy(true);
    try { await onEnablePush?.(); } finally { setPushBusy(false); }
  };

  const setupDeposit = async () => {
    if (busy) return;
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/drivers/connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: driver?.uid }),
      });
      const data = await res.json();
      if (data?.accountLink) { window.location.href = data.accountLink; return; }
      if (data?.enabled) { setErr(''); return; }
      setErr(data?.error || 'Could not start Stripe setup.');
    } catch (e) { setErr(e?.message || 'Stripe setup failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100%', background: C.bg, color: C.ink, fontFamily: BODY, padding: '10px 16px 24px' }}>
      <style>{`@keyframes dpUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: C.inkDim }}>Account</div>
      <div style={{ fontFamily: COND, fontSize: 32, fontWeight: 900, letterSpacing: '-.5px', lineHeight: 1, margin: '4px 0 16px' }}>You</div>

      {/* identity */}
      <div style={{ ...card(), display: 'flex', alignItems: 'center', gap: 14, padding: '18px 16px', animation: 'dpUp .4s ease both' }}>
        <div style={{ width: 62, height: 62, borderRadius: 20, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: COND, fontSize: 26, fontWeight: 900, color: C.greenBt, background: 'linear-gradient(135deg,rgba(34,197,94,.2),rgba(34,211,238,.12))', border: `1.5px solid ${C.borderHi}` }}>
          {photo ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: BODY, fontSize: 19, fontWeight: 800, lineHeight: 1.1 }}>{name}</div>
          {driver?.email && <div style={{ fontFamily: MONO, fontSize: 10, color: C.inkMid, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{driver.email}</div>}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <Pill color={sm.color}>{online && '● '}{sm.label}</Pill>
            {rating != null && <Pill color={C.amber}>★ {Number(rating).toFixed(2)}</Pill>}
            {(driver?.totalRides ?? 0) > 0 && <Pill color={C.cyan}>{driver.totalRides} rides</Pill>}
          </div>
        </div>
      </div>

      {/* payout / deposit */}
      <div style={{ ...card(), padding: '16px', marginTop: 12, animation: 'dpUp .45s .05s ease both', borderColor: connected ? C.border : 'rgba(251,191,36,.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, background: connected ? 'rgba(34,197,94,.1)' : 'rgba(251,191,36,.1)', border: `1px solid ${connected ? 'rgba(34,197,94,.28)' : 'rgba(251,191,36,.28)'}` }}>🏦</div>
            <div>
              <div style={{ fontFamily: BODY, fontSize: 14, fontWeight: 800 }}>Direct deposit</div>
              <div style={{ fontFamily: MONO, fontSize: 9.5, color: connected ? C.greenBt : C.amber, marginTop: 2 }}>{connected ? '✓ Bank linked · payouts on' : 'Not set up'}</div>
            </div>
          </div>
        </div>
        {!connected && (
          <>
            <button onClick={setupDeposit} disabled={busy} style={{
              marginTop: 13, width: '100%', borderRadius: 13, padding: 13, border: 'none', cursor: busy ? 'wait' : 'pointer',
              fontFamily: COND, fontSize: 14, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#04150a',
              background: 'linear-gradient(135deg,#2FE08A,#17B673 55%,#15803D)', boxShadow: '0 8px 22px rgba(34,197,94,.28)', opacity: busy ? .7 : 1,
            }}>{busy ? 'Opening Stripe…' : 'Set up direct deposit'}</button>
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.inkDim, textAlign: 'center', marginTop: 9, lineHeight: 1.5 }}>Link your bank via Stripe — get paid within 24h of rides.</div>
            {err && <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.red, textAlign: 'center', marginTop: 8 }}>{err}</div>}
          </>
        )}
      </div>

      {/* vehicle */}
      <Section label="Vehicle" />
      <div style={{ ...card(), padding: '4px 16px', animation: 'dpUp .45s .1s ease both' }}>
        <KV k="Car" v={[v.color, v.year, v.make, v.model].filter(Boolean).join(' ') || '—'} />
        <KV k="Plate" v={v.plate || '—'} mono border />
        <KV k="Ride types" v={(v.rideTypes || []).join(', ').toUpperCase() || '—'} border />
      </div>

      {/* documents */}
      {driver?.documents && Object.keys(driver.documents).length > 0 && (
        <>
          <Section label="Documents" />
          <div style={{ ...card(), padding: '4px 16px', animation: 'dpUp .45s .14s ease both' }}>
            {['licenseFront', 'licenseBack', 'insurance', 'registration', 'profilePhoto'].filter((k) => k in driver.documents).map((k, i) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
                <span style={{ fontFamily: BODY, fontSize: 12.5, fontWeight: 600, color: C.inkMid, textTransform: 'capitalize' }}>{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 800, padding: '2px 9px', borderRadius: 99, color: driver.documents[k] ? C.greenBt : C.amber, background: driver.documents[k] ? 'rgba(34,197,94,.1)' : 'rgba(251,191,36,.1)', border: `1px solid ${driver.documents[k] ? 'rgba(34,197,94,.25)' : 'rgba(251,191,36,.25)'}` }}>{driver.documents[k] ? 'Uploaded' : 'Missing'}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* settings */}
      <Section label="Settings" />
      <div style={{ ...card(), overflow: 'hidden', animation: 'dpUp .45s .18s ease both' }}>
        <Row icon="💬" title="Support" onClick={onOpenSupport} />
        <Row icon="🔔" title="Notifications" border
          onClick={pushOn || pushDenied ? undefined : enablePush}
          right={
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: pushOn ? C.greenBt : pushDenied ? C.red : C.amber }}>
              {pushOn ? '✓ On' : pushDenied ? 'Blocked' : pushBusy ? 'Turning on…' : 'Turn on'}
            </span>
          }
        />
        <Row icon="🛡️" title="Safety toolkit" border />
      </div>

      <button onClick={onSignOut} style={{
        marginTop: 14, width: '100%', borderRadius: 14, padding: 15, cursor: 'pointer',
        fontFamily: COND, fontSize: 14, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase',
        color: C.red, background: 'rgba(248,113,113,.08)', border: '1.5px solid rgba(248,113,113,.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
      }}>🚪 Sign out</button>
    </div>
  );
}

function card() { return { background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: '0 4px 20px rgba(0,0,0,.35)' }; }
function Section({ label }) {
  return <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(74,222,128,.55)', margin: '20px 2px 8px' }}>{label}</div>;
}
function Pill({ children, color }) {
  return <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 800, padding: '2px 9px', borderRadius: 99, color, background: `${color}1e`, border: `1px solid ${color}3a` }}>{children}</span>;
}
function KV({ k, v, mono, border }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderTop: border ? `1px solid ${C.border}` : 'none' }}>
      <span style={{ fontFamily: BODY, fontSize: 12.5, fontWeight: 600, color: C.inkDim }}>{k}</span>
      <span style={{ fontFamily: mono ? MONO : BODY, fontSize: mono ? 12 : 13, fontWeight: 700, color: C.ink, textAlign: 'right', maxWidth: '62%' }}>{v}</span>
    </div>
  );
}
function Row({ icon, title, onClick, border, right }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '15px 16px', cursor: onClick ? 'pointer' : 'default', borderTop: border ? `1px solid ${C.border}` : 'none' }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: 'rgba(34,197,94,.08)', border: `1px solid ${C.border}` }}>{icon}</div>
      <div style={{ flex: 1, fontFamily: BODY, fontSize: 14, fontWeight: 600, color: C.ink }}>{title}</div>
      {right != null ? right : <span style={{ color: C.inkDim, fontSize: 16 }}>›</span>}
    </div>
  );
}
