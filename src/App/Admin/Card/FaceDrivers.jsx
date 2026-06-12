import { C, MONO, COND } from './tokens';

export default function FaceDrivers({ onlineCount, total }) {
  const offline = total - onlineCount;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 10px', borderRadius: 99, alignSelf: 'flex-start',
        background: 'rgba(96,165,250,.12)', border: '1px solid rgba(96,165,250,.25)' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#60A5FA',
          boxShadow: '0 0 6px #60A5FA', animation: 'uaBlink 1.8s ease-in-out infinite' }}/>
        <span style={{ fontFamily: COND, fontSize: 10, fontWeight: 800,
          letterSpacing: '.14em', color: '#60A5FA' }}>DRIVERS</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 44, fontWeight: 800,
            color: '#60A5FA', lineHeight: 1, textShadow: '0 0 30px rgba(96,165,250,.45)' }}>
            {onlineCount}
          </div>
          <div style={{ fontFamily: COND, fontSize: 11, fontWeight: 700,
            letterSpacing: '.18em', color: 'rgba(96,165,250,.6)', marginTop: 3 }}>
            ONLINE
          </div>
        </div>
        <div style={{ paddingBottom: 8 }}>
          <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700,
            color: 'rgba(255,255,255,.38)', lineHeight: 1 }}>
            {total}
          </div>
          <div style={{ fontFamily: COND, fontSize: 9.5, fontWeight: 700,
            letterSpacing: '.14em', color: C.inkDim }}>
            TOTAL
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%',
          background: 'rgba(255,255,255,.22)', flexShrink: 0 }}/>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.inkMid }}>
          {offline} offline
        </span>
      </div>
    </div>
  );
}
