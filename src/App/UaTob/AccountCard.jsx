/**
 * AccountCard.jsx — Rider account face for the StatusCard HUD
 *
 * Props:
 *   account   object  — { displayName, email, phone, photoURL, createdAt,
 *                         tier, totalRides, totalSpend, promoBalance }
 *   rides     array   — full ride history (used for quick stats)
 *   onEdit    fn      — opens edit-profile flow
 *   onSignOut fn      — signs rider out
 */

import { useState, useMemo } from 'react';

// ── tokens (mirrors BookRideCard / UaTobApp) ─────────────────────────────────
const C = {
  bg:          '#050A06',
  panel:       'rgba(255,255,255,.035)',
  border:      'rgba(34,197,94,.18)',
  borderDim:   'rgba(34,197,94,.09)',
  green:       '#22C55E',
  greenBright: '#4ADE80',
  greenSoft:   '#34D399',
  white:       '#fff',
  dim:         'rgba(255,255,255,.22)',
  fade:        'rgba(255,255,255,.10)',
  faint:       'rgba(255,255,255,.06)',
  amber:       'rgba(251,191,36,.9)',
  amberDim:    'rgba(251,191,36,.18)',
  purple:      'rgba(192,132,252,.9)',
  purpleDim:   'rgba(192,132,252,.14)',
};
const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";

// ── tier config ──────────────────────────────────────────────────────────────
const TIERS = {
  bronze:   { label: 'Bronze',   color: '#cd7f32',          bg: 'rgba(205,127,50,.14)'  },
  silver:   { label: 'Silver',   color: 'rgba(200,200,210,.9)', bg: 'rgba(200,200,210,.12)' },
  gold:     { label: 'Gold',     color: C.amber,             bg: C.amberDim              },
  platinum: { label: 'Platinum', color: C.purple,            bg: C.purpleDim             },
};

// ── helpers ──────────────────────────────────────────────────────────────────
function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') { const p = Date.parse(ts); return isNaN(p) ? 0 : p; }
  return 0;
}

function fmtMoney(cents) {
  if (!cents && cents !== 0) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDate(ts) {
  const ms = tsToMillis(ts);
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── tiny icon set ────────────────────────────────────────────────────────────
function Ico({ n, size = 14, color = 'currentColor', sw = 1.7 }) {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  switch (n) {
    case 'user':    return <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case 'mail':    return <svg {...p}><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>;
    case 'phone':   return <svg {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.05 3.4 2 2 0 0 1 3 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z"/></svg>;
    case 'tag':     return <svg {...p}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
    case 'star':    return <svg {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
    case 'car':     return <svg {...p}><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
    case 'cash':    return <svg {...p}><rect x="2" y="6" width="20" height="12" rx="1"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'edit':    return <svg {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
    case 'out':     return <svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
    case 'shield':  return <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
    default:        return null;
  }
}

// ── stat chip ────────────────────────────────────────────────────────────────
function StatChip({ icon, label, value, accent }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      padding: '9px 6px', borderRadius: 10,
      background: C.faint, border: `1px solid ${C.borderDim}`,
    }}>
      <Ico n={icon} size={13} color={accent || C.greenSoft}/>
      <span style={{
        fontFamily: COND, fontSize: 15, fontWeight: 900, letterSpacing: '.03em',
        color: accent || C.greenBright, lineHeight: 1,
      }}>{value}</span>
      <span style={{
        fontFamily: COND, fontSize: 7.5, fontWeight: 700, letterSpacing: '.12em',
        color: C.dim, textTransform: 'uppercase',
      }}>{label}</span>
    </div>
  );
}

// ── info row ─────────────────────────────────────────────────────────────────
function InfoRow({ icon, value, dim }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <Ico n={icon} size={12} color={C.dim}/>
      <span style={{
        fontFamily: MONO, fontSize: 9, color: dim ? C.dim : 'rgba(255,255,255,.62)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
      }}>{value || '—'}</span>
    </div>
  );
}

// ── action button ────────────────────────────────────────────────────────────
function ActionBtn({ icon, label, onClick, variant = 'ghost' }) {
  const styles = {
    ghost:   { bg: C.faint,                  border: `1px solid ${C.borderDim}`, color: C.dim         },
    outline: { bg: 'transparent',             border: `1px solid ${C.border}`,   color: C.greenBright },
    danger:  { bg: 'rgba(239,68,68,.07)',     border: '1px solid rgba(239,68,68,.2)', color: 'rgba(239,68,68,.8)' },
  };
  const s = styles[variant];
  return (
    <button onClick={onClick} style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      padding: '8px 6px', borderRadius: 9, cursor: 'pointer',
      background: s.bg, border: s.border, transition: 'opacity .15s',
    }}>
      <Ico n={icon} size={12} color={s.color}/>
      <span style={{
        fontFamily: COND, fontSize: 9.5, fontWeight: 800, letterSpacing: '.12em',
        color: s.color, textTransform: 'uppercase',
      }}>{label}</span>
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function AccountCard({
  account = null,
  rides   = [],
  onEdit,
  onSignOut,
}) {
  const [showPromo, setShowPromo] = useState(false);

  const tier    = account?.tier || 'bronze';
  const tierCfg = TIERS[tier] || TIERS.bronze;

  // quick stats derived from rides array
  const stats = useMemo(() => {
    const completed = rides.filter(r => r.status === 'completed');
    const spend     = completed.reduce((s, r) => s + (r.fareCents || 0), 0);
    return { total: completed.length, spend };
  }, [rides]);

  const totalRides = account?.totalRides ?? stats.total;
  const totalSpend = account?.totalSpend ?? stats.spend;
  const promoBalance = account?.promoBalance ?? 0;

  return (
    <div style={{
      padding: '12px 12px 14px',
      display: 'flex', flexDirection: 'column', gap: 10,
      userSelect: 'none',
      animation: 'uaCardFlip .28s ease both',
    }}>

      {/* ── header label ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{
            fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.16em',
            color: C.greenBright, textTransform: 'uppercase',
          }}>My Account</div>
          <div style={{ fontFamily: MONO, fontSize: 8, color: C.dim, marginTop: 1 }}>Orlando, FL</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%', background: C.greenBright,
            boxShadow: `0 0 6px ${C.greenBright}`,
            animation: 'uaBlink 1.6s ease-in-out infinite',
          }}/>
          <span style={{ fontFamily: MONO, fontSize: 7.5, fontWeight: 700, color: C.greenBright }}>LIVE</span>
        </div>
      </div>

      <div style={{ height: 1, background: C.borderDim }}/>

      {/* ── avatar + name ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        {/* avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {account?.photoURL ? (
            <img src={account.photoURL} alt="avatar" style={{
              width: 52, height: 52, borderRadius: 14,
              border: `1.5px solid ${C.border}`,
              objectFit: 'cover',
            }}/>
          ) : (
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'rgba(34,197,94,.1)', border: `1.5px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                fontFamily: COND, fontSize: 20, fontWeight: 900,
                color: C.greenBright, letterSpacing: '.04em',
              }}>{initials(account?.displayName)}</span>
            </div>
          )}
          {/* tier badge */}
          <div style={{
            position: 'absolute', bottom: -5, right: -5,
            background: tierCfg.bg, border: `1px solid ${tierCfg.color}`,
            borderRadius: 6, padding: '1px 5px',
          }}>
            <span style={{
              fontFamily: COND, fontSize: 7, fontWeight: 800, letterSpacing: '.1em',
              color: tierCfg.color, textTransform: 'uppercase',
            }}>{tierCfg.label}</span>
          </div>
        </div>

        {/* name + contact */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{
            fontFamily: COND, fontSize: 15, fontWeight: 900, letterSpacing: '.04em',
            color: '#fff', lineHeight: 1, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {account?.displayName || 'Rider'}
          </div>
          <InfoRow icon="mail"  value={account?.email}/>
          <InfoRow icon="phone" value={account?.phone} dim={!account?.phone}/>
        </div>
      </div>

      {/* ── stats row ── */}
      <div style={{ display: 'flex', gap: 6 }}>
        <StatChip icon="car"  label="Rides"   value={totalRides}/>
        <StatChip icon="cash" label="Spent"   value={fmtMoney(totalSpend)} accent={C.greenBright}/>
        <StatChip icon="star" label="Member"  value={fmtDate(account?.createdAt)} accent={tierCfg.color}/>
      </div>

      {/* ── promo balance chip ── */}
      {promoBalance > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 11px', borderRadius: 10,
          background: 'rgba(34,197,94,.07)', border: `1px solid ${C.border}`,
          animation: 'uaFadeIn .3s ease both',
        }}>
          <Ico n="tag" size={13} color={C.greenBright}/>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: COND, fontSize: 8.5, fontWeight: 800, letterSpacing: '.12em',
              color: C.dim, textTransform: 'uppercase',
            }}>Promo Balance</div>
            <div style={{
              fontFamily: MONO, fontSize: 11, fontWeight: 700,
              color: C.greenBright,
            }}>{fmtMoney(promoBalance)}</div>
          </div>
          <div style={{
            fontFamily: COND, fontSize: 7.5, fontWeight: 800, letterSpacing: '.1em',
            color: C.greenSoft, textTransform: 'uppercase',
          }}>Auto-applied</div>
        </div>
      )}

      {/* ── member since + shield ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', borderRadius: 9,
        background: C.faint, border: `1px solid ${C.borderDim}`,
      }}>
        <Ico n="shield" size={12} color={C.dim}/>
        <span style={{
          fontFamily: MONO, fontSize: 8.5, color: C.dim, flex: 1,
        }}>Member since {fmtDate(account?.createdAt)}</span>
        <span style={{
          fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.12em',
          color: C.dim, textTransform: 'uppercase',
        }}>Verified</span>
      </div>

      {/* ── actions ── */}
      <div style={{ display: 'flex', gap: 6 }}>
        <ActionBtn icon="edit" label="Edit"      variant="outline" onClick={onEdit}/>
        <ActionBtn icon="out"  label="Sign Out"  variant="danger"  onClick={onSignOut}/>
      </div>

    </div>
  );
}
