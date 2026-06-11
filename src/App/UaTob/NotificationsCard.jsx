import { useState, useEffect } from 'react';
import { Bell, BellRing, Check, Loader2, ShieldCheck } from 'lucide-react';
import { useSaveRiderFcmToken } from '@/App/UaTob/useSaveRiderFcmToken';
import RiderFeedFace from '@/App/UaTob/RiderFeedFace';

const C = { green:'#22C55E', greenBright:'#4ADE80', greenSoft:'#34D399', red:'#F87171',
  text:'rgba(255,255,255,.92)', mid:'rgba(255,255,255,.55)', dim:'rgba(255,255,255,.32)' };
const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";

// Push enable prompt + status.
export default function NotificationsCard({ uid, account, onActiveChange }) {
  const { requestAndSave, loading, error, permission } = useSaveRiderFcmToken();
  const isOn = account?.notifications === true && permission === 'granted';

  // 0 = "Notifications on" status face, 1 = live feed face
  const [faceIdx,  setFaceIdx]  = useState(0);
  const [feedBusy, setFeedBusy] = useState(false);

  useEffect(() => { onActiveChange?.(feedBusy || faceIdx === 1); }, [feedBusy, faceIdx, onActiveChange]);

  // Auto-advance to the feed face after 4s; once there, stay until the user leaves
  useEffect(() => {
    if (!isOn || feedBusy || faceIdx === 1) return;
    const id = setInterval(() => setFaceIdx(1), 4000);
    return () => clearInterval(id);
  }, [isOn, feedBusy, faceIdx]);

  // Reset face when notifications turn off
  useEffect(() => { if (!isOn) setFaceIdx(0); }, [isOn]);

  const enable = async () => { await requestAndSave(uid); };

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6, marginBottom:10 }}>
        <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 9px', borderRadius:100, background:'rgba(52,211,153,.12)', border:'1px solid rgba(52,211,153,.25)' }}>
          <Bell size={10} color={C.greenSoft} strokeWidth={2.4}/>
          <span style={{ fontFamily:COND, fontSize:9.5, fontWeight:800, letterSpacing:'.12em', textTransform:'uppercase', color:'#6EE7B7' }}>Alerts</span>
        </span>
        {isOn && (
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            {[0, 1].map(i => (
              <button
                key={i}
                onClick={() => setFaceIdx(i)}
                style={{
                  width: faceIdx === i ? 14 : 5,
                  height:5, borderRadius:100, border:'none', cursor:'pointer', padding:0,
                  background: faceIdx === i ? '#34D399' : 'rgba(255,255,255,.18)',
                  transition:'all .3s ease',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {isOn ? (
        <div key={faceIdx} style={{ animation:'faceIn .35s ease both' }}>
          {faceIdx === 0 ? (
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:46, height:46, borderRadius:14, flexShrink:0, background:'linear-gradient(135deg,#22C55E,#15803D)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 6px 18px rgba(34,197,94,.4)' }}>
                <BellRing size={20} color="#fff" strokeWidth={2.2}/>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:COND, fontSize:18, fontWeight:900, color:'#fff', letterSpacing:'-0.3px', display:'flex', alignItems:'center', gap:6 }}>
                  Notifications on <Check size={15} color={C.greenBright} strokeWidth={3}/>
                </div>
                <div style={{ fontFamily:'Barlow,sans-serif', fontSize:11.5, color:C.mid, marginTop:2, lineHeight:1.4 }}>
                  You'll know the moment a driver accepts your ride.
                </div>
              </div>
            </div>
          ) : (
            <RiderFeedFace uid={uid} account={account} onBusy={setFeedBusy}/>
          )}
        </div>
      ) : (
        <div style={{ minHeight:64 }}>
          <div style={{ fontFamily:COND, fontSize:20, fontWeight:900, color:'#fff', letterSpacing:'-0.4px', marginBottom:3 }}>Stay in the loop</div>
          <div style={{ fontFamily:'Barlow,sans-serif', fontSize:12, color:C.mid, marginBottom:12, lineHeight:1.4 }}>
            Get notified the instant a driver accepts and when they arrive.
          </div>
          <button onClick={enable} disabled={loading || !uid} style={{
            width:'100%', padding:'12px 0', borderRadius:12, border:'none', cursor: loading||!uid?'not-allowed':'pointer',
            background:'linear-gradient(135deg,#34D399,#10B981)', color:'#04130A',
            fontFamily:COND, fontWeight:900, fontSize:14, letterSpacing:'.2px',
            display:'flex', alignItems:'center', justifyContent:'center', gap:7,
            boxShadow:'0 8px 22px rgba(16,185,129,.4)',
          }}>
            {loading ? <Loader2 size={15} style={{ animation:'spin 1s linear infinite' }}/> : <Bell size={15} strokeWidth={2.6}/>}
            {loading ? 'Enabling…' : 'Turn on notifications'}
          </button>
          {error && <div style={{ marginTop:8, fontSize:10.5, color:C.red, fontFamily:'Barlow,sans-serif', textAlign:'center' }}>{error}</div>}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, marginTop:8, fontSize:10, color:C.dim, fontFamily:'Barlow,sans-serif' }}>
            <ShieldCheck size={10}/> Only ride updates — no spam
          </div>
        </div>
      )}
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes faceIn  { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}