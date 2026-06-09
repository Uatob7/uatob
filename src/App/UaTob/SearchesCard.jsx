import { C, MONO, COND } from '@/App/UaTob/Statuscardtokens';

const hasCoords = (item) => {
  return item?.lat && item?.lng;
};

export default function SearchesCard({ searches = [], scheduledRides = [] }) {
  const liveCount  = searches.filter(hasCoords).length;
  const schedCount = scheduledRides.filter(hasCoords).length;

  return (
    <div style={{ padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div>
          <div style={{
            fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.16em',
            color: C.cyan, textTransform: 'uppercase',
          }}>
            Live Activity
          </div>
          <div style={{ fontFamily: MONO, fontSize: 8.5, color: C.inkTextDim, marginTop: 1 }}>
            Orlando metro · now
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {[
          { value: liveCount,  label: 'Searches',  color: C.cyan },
          { value: schedCount, label: 'Scheduled', color: C.violet },
        ].map((tile, i) => (
          <div key={i} style={{
            borderRadius: 10,
            padding: '8px 11px',
            background: 'rgba(255,255,255,.04)',
            border: `1px solid ${tile.color}22`,
          }}>
            <div style={{
              fontFamily: MONO,
              fontSize: 21,
              fontWeight: 800,
              color: tile.color,
              lineHeight: 1,
              textShadow: `0 0 16px ${tile.color}55`,
            }}>
              {tile.value}
            </div>
            <div style={{
              fontFamily: COND,
              fontSize: 7.5,
              fontWeight: 800,
              letterSpacing: '.12em',
              color: C.inkTextDim,
              textTransform: 'uppercase',
              marginTop: 3,
            }}>
              {tile.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}