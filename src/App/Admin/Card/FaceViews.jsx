import { C, MONO, COND } from './tokens';

function fmtSec(sec) {
  if (!sec || sec < 1) return '—';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function deviceIcon(view) {
  const w = view?.screen?.w;
  if (!w) return '?';
  return w < 768 ? '📱' : '🖥';
}

export default function FaceViews({ views }) {
  const total  = views.length;
  const live   = views.filter(v => !v.exited).length;
  const recent = views.slice(0, 3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 10px', borderRadius: 99, alignSelf: 'flex-start',
        background: 'rgba(34,211,238,.12)', border: '1px solid rgba(34,211,238,.25)' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22D3EE',
          boxShadow: '0 0 6px #22D3EE', animation: 'uaBlink 1.8s ease-in-out infinite' }}/>
        <span style={{ fontFamily: COND, fontSize: 10, fontWeight: 800,
          letterSpacing: '.14em', color: '#22D3EE' }}>VIEWS</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 44, fontWeight: 800,
            color: '#22D3EE', lineHeight: 1, textShadow: '0 0 30px rgba(34,211,238,.45)' }}>
            {total}
          </div>
          <div style={{ fontFamily: COND, fontSize: 11, fontWeight: 700,
            letterSpacing: '.18em', color: 'rgba(34,211,238,.6)', marginTop: 3 }}>
            SESSIONS
          </div>
        </div>
        {live > 0 && (
          <div style={{ paddingBottom: 8 }}>
            <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700,
              color: '#4ADE80', lineHeight: 1 }}>
              {live}
            </div>
            <div style={{ fontFamily: COND, fontSize: 9.5, fontWeight: 700,
              letterSpacing: '.14em', color: 'rgba(74,222,128,.5)' }}>
              LIVE
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {recent.map((v, i) => (
          <div key={v.id || i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, lineHeight: 1 }}>{deviceIcon(v)}</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,.55)',
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {v.path || '/'}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.inkDim, flexShrink: 0 }}>
              {fmtSec(v.timeOnPageSec)}
            </span>
            <div style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
              background: !v.exited ? '#4ADE80' : 'rgba(255,255,255,.18)',
              boxShadow: !v.exited ? '0 0 5px rgba(74,222,128,.7)' : 'none' }}/>
          </div>
        ))}
      </div>
    </div>
  );
}
