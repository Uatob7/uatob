import { useState, useEffect } from 'react';
import { Bell, BellRing, Check, Loader2, ShieldCheck } from 'lucide-react';
import { getMessaging, getToken } from 'firebase/messaging';
import { firebase_app } from '@/firebase/config';

const C = { green:'#22C55E', greenBright:'#4ADE80', greenSoft:'#34D399', red:'#F87171',
  text:'rgba(255,255,255,.92)', mid:'rgba(255,255,255,.55)', dim:'rgba(255,255,255,.32)' };
const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";

const VAPID_KEY = 'BJ_sRHZonSGCKk2mB2i9ofTRS8ouFVMV-I15FX4sqdUXHyVb1lo6H-N4GMPrlcIIshRlykQicaxkxxFxcYcI4JQ';

// Push enable prompt + status. Mirrors the rider FCM token pattern.
export default function NotificationsCard({ uid, account, callSaveFcmToken }) {
  const granted = (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') || !!account?.token;
  const [state, setState] = useState(granted ? 'on' : 'idle'); // idle | loading | on | error
  const [err, setErr]     = useState('');

  useEffect(() => { if (granted) setState('on'); }, [granted]);

  const enable = async () => {
    setErr(''); setState('loading');
    try {
      if (!('Notification' in window)) throw new Error('Not supported on this device');
      const perm = await window.Notification.requestPermission();
      if (perm !== 'granted') throw new Error('Permission denied');
      const messaging = getMessaging(firebase_app);
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      if (!token) throw new Error('Could not get token');
      await callSaveFcmToken?.({ uid, token });
      setState('on');
    } catch (e) {
      setErr(e?.message || 'Could not enable'); setState('error');
    }
  };

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
        <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 9px', borderRadius:100, background:'rgba(52,211,153,.12)', border:'1px solid rgba(52,211,153,.25)' }}>
          <Bell size={10} color={C.greenSoft} strokeWidth={2.4}/>
          <span style={{ fontFamily:COND, fontSize:9.5, fontWeight:800, letterSpacing:'.12em', textTransform:'uppercase', color:'#6EE7B7' }}>Alerts</span>
        </span>
      </div>

      {state === 'on' ? (
        <div style={{ minHeight:64, display:'flex', alignItems:'center', gap:12 }}>
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
        <div style={{ minHeight:64 }}>
          <div style={{ fontFamily:COND, fontSize:20, fontWeight:900, color:'#fff', letterSpacing:'-0.4px', marginBottom:3 }}>Stay in the loop</div>
          <div style={{ fontFamily:'Barlow,sans-serif', fontSize:12, color:C.mid, marginBottom:12, lineHeight:1.4 }}>
            Get notified the instant a driver accepts and when they arrive.
          </div>
          <button onClick={enable} disabled={state==='loading'} style={{
            width:'100%', padding:'12px 0', borderRadius:12, border:'none', cursor: state==='loading'?'not-allowed':'pointer',
            background:'linear-gradient(135deg,#34D399,#10B981)', color:'#04130A',
            fontFamily:COND, fontWeight:900, fontSize:14, letterSpacing:'.2px',
            display:'flex', alignItems:'center', justifyContent:'center', gap:7,
            boxShadow:'0 8px 22px rgba(16,185,129,.4)',
          }}>
            {state==='loading' ? <Loader2 size={15} style={{ animation:'spin 1s linear infinite' }}/> : <Bell size={15} strokeWidth={2.6}/>}
            {state==='loading' ? 'Enabling…' : 'Turn on notifications'}
          </button>
          {err && <div style={{ marginTop:8, fontSize:10.5, color:C.red, fontFamily:'Barlow,sans-serif', textAlign:'center' }}>{err}</div>}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, marginTop:8, fontSize:10, color:C.dim, fontFamily:'Barlow,sans-serif' }}>
            <ShieldCheck size={10}/> Only ride updates — no spam
          </div>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}