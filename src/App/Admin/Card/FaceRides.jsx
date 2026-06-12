import { C, MONO, COND } from './tokens';

const ORANGE      = '#FB923C';
const ACTIVE_SET  = new Set(['driver_assigned', 'arrived', 'in_progress']);

function tsMs(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  return 0;
}

export default function FaceRides({ rides }) {
  const total      = rides.length;
  const active     = rides.filter(r => ACTIVE_SET.has(r.status));
  const inProgress = rides.filter(r => r.status === 'in_progress').length;
  const dayAgo     = Date.now() - 24 * 3600_000;
  const todayDone  = rides.filter(r => r.status === 'completed' && tsMs(r.createdAt) > dayAgo);
  const revenue    = todayDone.reduce((s, r) => s + (r.fareTotal ?? 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 10px', borderRadius: 99, alignSelf: 'flex-start',
        background: 'rgba(251,146,60,.12)', border: '1px solid rgba(251,146,60,.25)' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: ORANGE,
          boxShadow: `0 0 6px ${ORANGE}`,
          animation: active.length > 0 ? 'uaBlink 1.8s ease-in-out infinite' : 'none' }}/>
        <span style={{ fontFamily: COND, fontSize: 10, fontWeight: 800,
          letterSpacing: '.14em', color: ORANGE }}>RIDES</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 44, fontWeight: 800,
            color: ORANGE, lineHeight: 1, textShadow: '0 0 30px rgba(251,146,60,.45)' }}>
            {total}
          </div>
          <div style={{ fontFamily: COND, fontSize: 11, fontWeight: 700,
            letterSpacing: '.18em', color: 'rgba(251,146,60,.6)', marginTop: 3 }}>
            TOTAL
          </div>
        </div>

        {active.length > 0 && (
          <div style={{ paddingBottom: 8 }}>
            <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700,
              color: '#FBBF24', lineHeight: 1 }}>
              {active.length}
            </div>
            <div style={{ fontFamily: COND, fontSize: 9.5, fontWeight: 700,
              letterSpacing: '.14em', color: 'rgba(251,191,36,.5)' }}>
              ACTIVE
            </div>
          </div>
        )}

        {revenue > 0 && (
          <div style={{ paddingBottom: 8 }}>
            <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700,
              color: 'rgba(74,222,128,.85)', lineHeight: 1 }}>
              ${revenue.toFixed(2)}
            </div>
            <div style={{ fontFamily: COND, fontSize: 9.5, fontWeight: 700,
              letterSpacing: '.14em', color: 'rgba(74,222,128,.45)' }}>
              TODAY
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: inProgress > 0 ? '#FBBF24' : ORANGE,
          boxShadow: inProgress > 0 ? '0 0 5px rgba(251,191,36,.6)' : `0 0 5px rgba(251,146,60,.6)`,
          animation: active.length > 0 ? 'uaBlink 1.4s ease-in-out infinite' : 'none' }}/>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.inkMid }}>
          {inProgress > 0
            ? `${inProgress} in progress`
            : active.length > 0
              ? `${active.length} active`
              : todayDone.length > 0
                ? `${todayDone.length} completed today`
                : 'no rides'}
        </span>
      </div>
    </div>
  );
}
