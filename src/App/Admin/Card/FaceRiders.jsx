import { C, MONO, COND } from './tokens';

export default function FaceRiders({ ridersOnMap, total }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 10px', borderRadius: 99, alignSelf: 'flex-start',
        background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.25)' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FBBF24',
          boxShadow: '0 0 6px #FBBF24', animation: 'uaBlink 1.8s ease-in-out infinite' }}/>
        <span style={{ fontFamily: COND, fontSize: 10, fontWeight: 800,
          letterSpacing: '.14em', color: '#FBBF24' }}>RIDERS</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 44, fontWeight: 800,
            color: '#FBBF24', lineHeight: 1, textShadow: '0 0 30px rgba(251,191,36,.45)' }}>
            {ridersOnMap}
          </div>
          <div style={{ fontFamily: COND, fontSize: 11, fontWeight: 700,
            letterSpacing: '.18em', color: 'rgba(251,191,36,.6)', marginTop: 3 }}>
            ON MAP
          </div>
        </div>
        <div style={{ paddingBottom: 8 }}>
          <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700,
            color: 'rgba(255,255,255,.38)', lineHeight: 1 }}>
            {total}
          </div>
          <div style={{ fontFamily: COND, fontSize: 9.5, fontWeight: 700,
            letterSpacing: '.14em', color: C.inkDim }}>
            ACCOUNTS
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%',
          background: '#FBBF24', boxShadow: '0 0 5px rgba(251,191,36,.6)', flexShrink: 0 }}/>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.inkMid }}>
          {total - ridersOnMap} without location
        </span>
      </div>
    </div>
  );
}
