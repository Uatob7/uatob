import { C, MONO, COND } from '@/App/UaTob/Statuscardtokens';

const hasCoords = (item) => item?.pickupLat && item?.pickupLng;

function Ico({ n, size = 14, color = 'currentColor', sw = 1.7 }) {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  switch (n) {
    case 'radar': return <svg {...p}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><line x1="12" y1="2" x2="12" y2="4"/></svg>;
    case 'pin':   return <svg {...p}><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
    default:      return null;
  }
}

export default function SearchesCard({ searches = [] }) {
  const liveCount = searches.filter(hasCoords).length;
  const nearest   = searches.find(hasCoords);

  return (
    <>
      <style>{`
        @keyframes scBlink { 0%,100%{opacity:1} 50%{opacity:.22} }
        @keyframes scGlow  { 0%,100%{box-shadow:0 0 18px rgba(6,182,212,.18)} 50%{box-shadow:0 0 30px rgba(6,182,212,.38)} }
      `}</style>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
        background: 'rgba(6,182,212,.05)', border: '1px solid rgba(6,182,212,.18)',
        borderRadius: 14, padding: '13px 14px',
        boxShadow: '0 0 0 1px rgba(6,182,212,.04)',
      }}>

        {/* Icon */}
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: 'rgba(6,182,212,.1)', border: '1px solid rgba(6,182,212,.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'scGlow 2.8s ease-in-out infinite',
        }}>
          <Ico n="radar" size={20} color="#06B6D4"/>
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: COND, fontSize: 20, fontWeight: 900,
            letterSpacing: '.04em', color: '#fff', lineHeight: 1.05,
          }}>
            {liveCount} searching
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%', background: '#06B6D4',
              boxShadow: '0 0 5px #06B6D4',
              animation: 'scBlink 1.6s ease-in-out infinite',
            }}/>
            {nearest
              ? <span style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(255,255,255,.35)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                  <Ico n="pin" size={8} color="rgba(255,255,255,.3)"/> {nearest.pickup}
                </span>
              : <span style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(255,255,255,.35)' }}>
                  Orlando metro · now
                </span>
            }
          </div>
        </div>

        {/* Badge */}
        <div style={{
          flexShrink: 0, background: 'rgba(6,182,212,.12)',
          border: '1px solid rgba(6,182,212,.3)', borderRadius: 10,
          padding: '8px 13px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 1,
        }}>
          <span style={{
            fontFamily: MONO, fontSize: 18, fontWeight: 800,
            color: '#06B6D4', lineHeight: 1,
            textShadow: '0 0 14px rgba(6,182,212,.5)',
          }}>
            {liveCount}
          </span>
          <span style={{
            fontFamily: COND, fontSize: 7, fontWeight: 800,
            letterSpacing: '.12em', color: 'rgba(255,255,255,.35)',
            textTransform: 'uppercase',
          }}>
            live
          </span>
        </div>

      </div>
    </>
  );
}