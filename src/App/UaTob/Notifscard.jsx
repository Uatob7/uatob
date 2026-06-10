// src/App/UaTob/NotifsCard.jsx
//
// Rider notifications face.
// Shows permission state and lets the rider toggle push notifications on/off.
// Calls useSaveRiderFcmToken — writes directly to Accounts/{uid}.

import { useState } from 'react';
import { useSaveRiderFcmToken } from '@/App/UaTob/useSaveRiderFcmToken';

// ── tokens (match BookRideCard / AccountCard) ─────────────────────────────────
const C = {
  bg:           '#050A06',
  faint:        'rgba(255,255,255,.06)',
  borderDim:    'rgba(34,197,94,.09)',
  border:       'rgba(34,197,94,.20)',
  green:        '#22C55E',
  greenBright:  '#4ADE80',
  greenDim:     'rgba(34,197,94,.08)',
  greenSoft:    '#34D399',
  white:        '#fff',
  dim:          'rgba(255,255,255,.32)',
  fade:         'rgba(255,255,255,.14)',
  amber:        '#F59E0B',
  amberDim:     'rgba(245,158,11,.09)',
  amberBorder:  'rgba(245,158,11,.28)',
  red:          '#F87171',
  redDim:       'rgba(248,113,113,.09)',
  indigo:       '#818CF8',
  indigoDim:    'rgba(129,140,248,.09)',
  indigoBorder: 'rgba(129,140,248,.22)',
};
const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";

const KF = `
  @keyframes nfSlideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes nfBlink   { 0%,100%{opacity:1} 50%{opacity:.22} }
  @keyframes nfSpin    { to{transform:rotate(360deg)} }
  @keyframes nfPop     { 0%{transform:scale(.4);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
  @keyframes nfGlow    { 0%,100%{box-shadow:0 0 18px rgba(74,222,128,.22)} 50%{box-shadow:0 0 32px rgba(74,222,128,.48)} }
`;

function Spinner({ size = 14, color = C.green }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid rgba(34,197,94,.12)`,
      borderTop: `2px solid ${color}`,
      animation: 'nfSpin .7s linear infinite', flexShrink: 0,
    }}/>
  );
}

function Ico({ n, size = 14, color = 'currentColor', sw = 1.7 }) {
  const p = { width:size, height:size, viewBox:'0 0 24 24', fill:'none',
    stroke:color, strokeWidth:sw, strokeLinecap:'round', strokeLinejoin:'round' };
  switch(n) {
    case 'bell':    return <svg {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
    case 'bell-off':return <svg {...p}><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
    case 'check':   return <svg {...p}><polyline points="20 6 9 17 4 12"/></svg>;
    case 'warn':    return <svg {...p}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case 'car':     return <svg {...p}><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
    case 'pin':     return <svg {...p}><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
    case 'shield':  return <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
    case 'x':       return <svg {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
    default: return null;
  }
}

// ── What riders get notified about ───────────────────────────────────────────
const NOTIF_PERKS = [
  { icon: 'car',    label: 'Driver accepted',   sub: 'The moment a driver takes your ride'  },
  { icon: 'pin',    label: 'Driver arriving',    sub: 'When they\'re 2 min away'             },
  { icon: 'check',  label: 'Ride completed',     sub: 'Receipt and trip summary'             },
  { icon: 'shield', label: 'Ride updates',       sub: 'Status changes in real time'          },
];

export default function NotifsCard({ uid, account }) {
  const { requestAndSave, disable, loading, error, permission } = useSaveRiderFcmToken();
  const [success, setSuccess] = useState(false);

  // Derive current state from account doc + browser permission
  const isEnabled     = account?.notifications === true && permission === 'granted';
  const isDenied      = permission === 'denied';
  const isUnsupported = permission === 'unsupported';

  const handleEnable = async () => {
    if (!uid) return;
    const ok = await requestAndSave(uid);
    if (ok) setSuccess(true);
  };

  const handleDisable = async () => {
    if (!uid) return;
    await disable(uid);
    setSuccess(false);
  };

  return (
    <>
      <style>{KF}</style>
      <div style={{ padding:'12px 13px 14px', display:'flex', flexDirection:'column', gap:12,
        animation:'nfSlideUp .3s ease both' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontFamily:COND, fontSize:10, fontWeight:800, letterSpacing:'.16em',
              color:C.greenBright, textTransform:'uppercase' }}>
              Notifications
            </div>
            <div style={{ fontFamily:MONO, fontSize:8.5, color:C.dim, marginTop:2 }}>
              Stay ahead of your ride
            </div>
          </div>
          <div style={{ width:34, height:34, borderRadius:10,
            background: isEnabled ? 'rgba(34,197,94,.1)' : C.faint,
            border:`1px solid ${isEnabled ? C.border : 'rgba(255,255,255,.07)'}`,
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow: isEnabled ? '0 0 14px rgba(74,222,128,.2)' : 'none',
          }}>
            <Ico n={isEnabled ? 'bell' : 'bell-off'} size={16}
              color={isEnabled ? C.greenBright : C.dim}/>
          </div>
        </div>

        <div style={{ height:1, background:C.borderDim }}/>

        {/* Perks list */}
        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
          {NOTIF_PERKS.map((p, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{
                width:28, height:28, borderRadius:8, flexShrink:0,
                background: isEnabled ? 'rgba(34,197,94,.08)' : C.faint,
                border:`1px solid ${isEnabled ? C.borderDim : 'rgba(255,255,255,.06)'}`,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <Ico n={p.icon} size={13} color={isEnabled ? C.greenSoft : C.dim}/>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:COND, fontSize:11.5, fontWeight:800,
                  letterSpacing:'.04em', color: isEnabled ? '#fff' : 'rgba(255,255,255,.5)' }}>
                  {p.label}
                </div>
                <div style={{ fontFamily:MONO, fontSize:8, color:C.dim, marginTop:1 }}>
                  {p.sub}
                </div>
              </div>
              {isEnabled && (
                <div style={{ animation:'nfPop .3s cubic-bezier(.34,1.4,.64,1) both' }}>
                  <Ico n="check" size={12} color={C.greenBright} sw={2.2}/>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ height:1, background:C.borderDim }}/>

        {/* Error */}
        {error && (
          <div style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 11px',
            background:C.redDim, border:'1px solid rgba(248,113,113,.2)',
            borderRadius:9, fontFamily:MONO, fontSize:9.5, color:C.red }}>
            <Ico n="warn" size={11} color={C.red}/>{error}
          </div>
        )}

        {/* Denied state */}
        {isDenied && (
          <div style={{ padding:'10px 12px', background:C.amberDim,
            border:`1px solid ${C.amberBorder}`, borderRadius:10,
            display:'flex', alignItems:'flex-start', gap:9 }}>
            <Ico n="warn" size={13} color={C.amber} style={{ flexShrink:0, marginTop:1 }}/>
            <div>
              <div style={{ fontFamily:COND, fontSize:11, fontWeight:800,
                color:C.amber, marginBottom:3 }}>
                Notifications blocked
              </div>
              <div style={{ fontFamily:MONO, fontSize:8.5,
                color:'rgba(245,158,11,.75)', lineHeight:1.6 }}>
                Open your browser settings and allow notifications for this site, then come back.
              </div>
            </div>
          </div>
        )}

        {/* Unsupported */}
        {isUnsupported && (
          <div style={{ padding:'9px 12px', background:C.faint,
            border:'1px solid rgba(255,255,255,.07)', borderRadius:9,
            fontFamily:MONO, fontSize:9, color:C.dim, lineHeight:1.6 }}>
            Push notifications aren't supported in this browser. Try Chrome or Safari.
          </div>
        )}

        {/* Success flash */}
        {success && !error && (
          <div style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 11px',
            background:C.greenDim, border:`1px solid ${C.border}`,
            borderRadius:9, fontFamily:MONO, fontSize:9.5, color:C.greenBright,
            animation:'nfSlideUp .25s ease both' }}>
            <Ico n="check" size={11} color={C.greenBright}/>
            Notifications enabled
          </div>
        )}

        {/* CTA */}
        {!isUnsupported && !isDenied && (
          isEnabled
            ? <button type="button" onClick={handleDisable} style={{
                width:'100%', padding:'10px 0', borderRadius:11,
                border:'1px solid rgba(248,113,113,.18)',
                background:'rgba(248,113,113,.05)', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:7,
                fontFamily:COND, fontSize:11, fontWeight:800, letterSpacing:'.13em',
                textTransform:'uppercase', color:'rgba(248,113,113,.7)',
                transition:'background .12s',
              }}>
                <Ico n="bell-off" size={13} color="rgba(248,113,113,.7)"/>
                Turn Off Notifications
              </button>
            : <button type="button" onClick={handleEnable} disabled={loading || !uid}
                style={{
                  width:'100%', padding:'11px 0', borderRadius:11, border:'none',
                  background: loading || !uid
                    ? 'rgba(255,255,255,.06)'
                    : 'linear-gradient(135deg,#22C55E,#16A34A)',
                  color: loading || !uid ? C.fade : '#fff',
                  fontFamily:COND, fontSize:12, fontWeight:800, letterSpacing:'.14em',
                  textTransform:'uppercase', cursor: loading || !uid ? 'not-allowed' : 'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:7,
                  boxShadow: loading || !uid ? 'none' : '0 4px 18px rgba(34,197,94,.3)',
                  animation: loading || !uid ? 'none' : 'nfGlow 2.8s ease-in-out infinite',
                  transition:'all .15s',
                }}>
                {loading
                  ? <><Spinner size={13}/> Enabling…</>
                  : <><Ico n="bell" size={13} color="#fff"/> Turn On Notifications</>
                }
              </button>
        )}

        <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
          gap:5, fontFamily:MONO, fontSize:8.5, color:C.fade }}>
          <Ico n="shield" size={9} color={C.fade}/> Only used for your ride updates
        </div>

      </div>
    </>
  );
}