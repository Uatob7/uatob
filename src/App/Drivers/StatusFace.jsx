import { Power, Radar, Zap, MapPin } from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';

export default function StatusFace({ mode, online, activeTrip, tripStage, sinceMs, onlineLabel, nearbyCount, onToggle }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:14 }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <div style={{
            display:'inline-flex', alignItems:'center', gap:6,
            padding:'4px 10px', borderRadius:100,
            background: mode==='trip' ? 'rgba(255,255,255,0.10)' : mode==='waiting' ? 'rgba(22,163,74,.12)' : C.surfaceAlt,
            border: mode==='trip' ? '1px solid rgba(255,255,255,0.15)' : mode==='waiting' ? '1px solid rgba(22,163,74,.20)' : `1px solid ${C.border}`,
          }}>
            <div style={{
              width:6, height:6, borderRadius:'50%',
              background: mode==='offline' ? C.textDim : '#22C55E',
              boxShadow: mode!=='offline' ? '0 0 8px rgba(34,197,94,0.7)' : 'none',
              animation: mode!=='offline' ? 'scLiveDot 1.6s ease-in-out infinite' : 'none',
            }}/>
            <span className="mono" style={{ fontSize:10, fontWeight:800, letterSpacing:'.12em', textTransform:'uppercase', color: mode==='trip' ? 'rgba(255,255,255,0.85)' : mode==='waiting' ? C.onlineGreen : C.textDim }}>
              {mode==='trip' ? 'On trip' : mode==='waiting' ? 'Online · ready' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="condensed" style={{ fontSize:26, fontWeight:900, color: mode==='trip' ? '#fff' : C.text, letterSpacing:'-0.5px', lineHeight:1.1, marginBottom:4, opacity: mode==='offline' ? 0.65 : 1 }}>
          {mode==='offline' && "You're offline"}
          {mode==='waiting' && 'Looking for rides'}
          {mode==='trip'    && `Active trip · ${(tripStage ?? '').replace('_', ' ')}`}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:12, fontWeight:600, color: mode==='trip' ? 'rgba(255,255,255,0.55)' : mode==='waiting' ? '#15803D' : C.textDim, flexWrap:'wrap' }}>
          {mode==='offline' && <span>Tap "Go online" to start earning</span>}
          {mode==='waiting' && (
            <>
              <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}><Radar size={12} strokeWidth={2.2}/> Scanning area</span>
              {sinceMs && <><span style={{ width:3, height:3, borderRadius:'50%', background:'rgba(22,163,74,.35)' }}/><span>Online {onlineLabel}</span></>}
              {nearbyCount > 0 && <><span style={{ width:3, height:3, borderRadius:'50%', background:'rgba(22,163,74,.35)' }}/><span style={{ display:'inline-flex', alignItems:'center', gap:4 }}><MapPin size={11} strokeWidth={2.2}/>{nearbyCount} nearby</span></>}
            </>
          )}
          {mode==='trip' && <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}><Zap size={12} fill="#22C55E" strokeWidth={0}/> Earning · stay focused</span>}
        </div>
      </div>

      {!activeTrip && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0 }}>
          <button
            onClick={e => { e.stopPropagation(); onToggle(); }}
            style={{
              background: online ? 'linear-gradient(135deg,#22C55E 0%,#16A34A 55%,#15803D 100%)' : 'linear-gradient(135deg,#0F172A,#1F2937 55%,#0F172A)',
              border:'none', borderRadius:100,
              padding: online ? '13px 18px' : '13px 22px',
              color:'#fff', fontFamily:"'Barlow',sans-serif",
              fontWeight:800, fontSize:14, letterSpacing:'.3px',
              cursor:'pointer', display:'flex', alignItems:'center', gap:7,
              transition:'filter .15s, transform .1s',
              boxShadow: online ? '0 8px 20px rgba(22,163,74,.35)' : '0 8px 20px rgba(0,0,0,.18)',
              animation: online ? 'scOnlinePulse 2.4s ease-in-out infinite' : 'none',
            }}
            onMouseEnter={e => e.currentTarget.style.filter='brightness(1.08)'}
            onMouseLeave={e => e.currentTarget.style.filter=''}
            onMouseDown={e  => e.currentTarget.style.transform='scale(.97)'}
            onMouseUp={e    => e.currentTarget.style.transform=''}
          >
            <Power size={15} strokeWidth={2.6} fill={online ? '#fff' : 'transparent'}/>
            {online ? 'Online' : 'Go online'}
          </button>
        </div>
      )}

      {activeTrip && (
        <div style={{ flexShrink:0, width:48, height:48, borderRadius:14, background:'rgba(34,197,94,0.15)', border:'1.5px solid rgba(34,197,94,0.35)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
          <Zap size={20} color="#4ADE80" fill="#4ADE80" strokeWidth={2}/>
          <div style={{ position:'absolute', inset:-6, borderRadius:18, border:'2px solid rgba(34,197,94,0.4)', animation:'scRadar 2s ease-out infinite', pointerEvents:'none' }}/>
        </div>
      )}
    </div>
  );
}
