import { C, MONO, COND } from './tokens';

export default function FaceSearches({ count, guestCount }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 10px', borderRadius: 99, alignSelf: 'flex-start',
        background: 'rgba(74,222,128,.12)', border: '1px solid rgba(74,222,128,.25)' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE80',
          boxShadow: '0 0 6px #4ADE80', animation: 'uaBlink 1.8s ease-in-out infinite' }}/>
        <span style={{ fontFamily: COND, fontSize: 10, fontWeight: 800,
          letterSpacing: '.14em', color: '#4ADE80' }}>SEARCHES</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 44, fontWeight: 800,
            color: '#4ADE80', lineHeight: 1, textShadow: '0 0 30px rgba(74,222,128,.45)' }}>
            {count}
          </div>
          <div style={{ fontFamily: COND, fontSize: 11, fontWeight: 700,
            letterSpacing: '.18em', color: 'rgba(74,222,128,.6)', marginTop: 3 }}>
            ACTIVE
          </div>
        </div>
        {guestCount > 0 && (
          <div style={{ paddingBottom: 8 }}>
            <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700,
              color: 'rgba(251,146,60,.7)', lineHeight: 1 }}>
              {guestCount}
            </div>
            <div style={{ fontFamily: COND, fontSize: 9.5, fontWeight: 700,
              letterSpacing: '.14em', color: 'rgba(251,146,60,.5)' }}>
              GUEST
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%',
          background: '#4ADE80', boxShadow: '0 0 5px rgba(74,222,128,.6)', flexShrink: 0,
          animation: count > 0 ? 'uaBlink 1.4s ease-in-out infinite' : 'none' }}/>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.inkMid }}>
          {count > 0 ? 'live demand' : 'no active searches'}
        </span>
      </div>
    </div>
  );
}
