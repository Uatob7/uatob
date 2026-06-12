import { C, MONO, COND } from './tokens';

export default function FaceScheduled({ count }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 10px', borderRadius: 99, alignSelf: 'flex-start',
        background: 'rgba(192,132,252,.12)', border: '1px solid rgba(192,132,252,.25)' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C084FC',
          boxShadow: '0 0 6px #C084FC', animation: 'uaBlink 1.8s ease-in-out infinite' }}/>
        <span style={{ fontFamily: COND, fontSize: 10, fontWeight: 800,
          letterSpacing: '.14em', color: '#C084FC' }}>SCHEDULED</span>
      </div>

      <div>
        <div style={{ fontFamily: MONO, fontSize: 44, fontWeight: 800,
          color: '#C084FC', lineHeight: 1, textShadow: '0 0 30px rgba(192,132,252,.45)' }}>
          {count}
        </div>
        <div style={{ fontFamily: COND, fontSize: 11, fontWeight: 700,
          letterSpacing: '.18em', color: 'rgba(192,132,252,.6)', marginTop: 3 }}>
          UPCOMING {count === 1 ? 'RIDE' : 'RIDES'}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%',
          background: '#C084FC', boxShadow: '0 0 5px rgba(192,132,252,.6)', flexShrink: 0,
          animation: count > 0 ? 'uaBlink 2s ease-in-out infinite' : 'none' }}/>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.inkMid }}>
          {count > 0 ? 'pending dispatch' : 'queue clear'}
        </span>
      </div>
    </div>
  );
}
