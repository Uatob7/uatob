import { Clock, MapPin, Calendar } from 'lucide-react';

function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  return 0;
}

function fmtScheduled(ts) {
  if (!ts) return null;
  const ms = tsToMillis(ts);
  if (!ms) return null;
  const d = new Date(ms);
  const diffMs = ms - Date.now();
  const diffH = diffMs / 1000 / 3600;
  if (diffH < 0) return null;
  if (diffH < 24) return d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

function fmtCountdown(ts) {
  if (!ts) return null;
  const ms = tsToMillis(ts);
  const diff = ms - Date.now();
  if (diff <= 0) return 'Now';
  const totalH = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const d = Math.floor(totalH / 24);
  const h = totalH % 24;
  if (d > 0) return `in ${d}d ${h}h ${m}m`;
  if (h > 0) return `in ${h}h ${m}m`;
  if (m > 0) return `in ${m}m`;
  return 'Soon';
}

function parseCity(ride) {
  return ride.pickupCity
    || (ride.pickup ? ride.pickup.split(',').slice(-2, -1)[0]?.trim() : null)
    || 'Orlando';
}

const DOT = <span style={{ color:'rgba(165,180,252,.3)', fontSize:10, lineHeight:1 }}>·</span>;

export default function ScheduledFace({ hasScheduled, upcomingRides, currentRide, rideIdx }) {
  const ts = currentRide?.scheduledAt || currentRide?.createdAt;

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:14 }}>
      <div style={{ flex:1, minWidth:0 }}>

        {/* Badge */}
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'3px 9px', borderRadius:100, background:'rgba(129,140,248,.14)', border:'1px solid rgba(129,140,248,.28)', marginBottom:5 }}>
          <div style={{ width:5, height:5, borderRadius:'50%', background:'#818CF8', boxShadow:'0 0 8px rgba(129,140,248,0.8)', animation:'scLiveDot 1.6s ease-in-out infinite' }}/>
          <span className="mono" style={{ fontSize:9.5, fontWeight:800, letterSpacing:'.12em', textTransform:'uppercase', color:'#A5B4FC' }}>
            {!hasScheduled ? 'No upcoming rides' : upcomingRides.length > 1 ? `Ride ${rideIdx + 1} of ${upcomingRides.length}` : 'Scheduled ride'}
          </span>
        </div>

        {/* Heading */}
        <div className="condensed" style={{ fontSize:24, fontWeight:900, color:'#fff', letterSpacing:'-0.5px', lineHeight:1.1, marginBottom:5, animation:'scCountGlow 3s ease-in-out infinite' }}>
          {!hasScheduled ? 'Schedule a ride' : upcomingRides.length === 1 ? '1 ride scheduled' : `${upcomingRides.length} rides scheduled`}
        </div>

        {hasScheduled && currentRide ? (
          <>
            {/* Row 1: time + city */}
            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'nowrap', overflow:'hidden', marginBottom:4 }}>
              {ts && (
                <>
                  <Clock size={10} color='rgba(165,180,252,.7)' strokeWidth={2.2}/>
                  <span style={{ fontSize:11, fontWeight:700, color:'rgba(165,180,252,.9)', whiteSpace:'nowrap' }}>
                    {fmtScheduled(ts) ?? '—'}
                  </span>
                  <span style={{ fontSize:10, fontWeight:700, color:'#818CF8', background:'rgba(129,140,248,.14)', border:'1px solid rgba(129,140,248,.25)', padding:'1px 6px', borderRadius:99, whiteSpace:'nowrap' }}>
                    {fmtCountdown(ts)}
                  </span>
                  {DOT}
                </>
              )}
              <MapPin size={10} color='rgba(165,180,252,.55)' strokeWidth={2.2}/>
              <span style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,.5)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {parseCity(currentRide)}
              </span>
            </div>

            {/* Row 2: ride details chips */}
            <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
              {currentRide.rideType && (
                <span style={{ fontFamily:'"JetBrains Mono",monospace', fontSize:9, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:'#818CF8', background:'rgba(129,140,248,.16)', border:'1px solid rgba(129,140,248,.28)', padding:'1px 6px', borderRadius:5 }}>
                  {currentRide.rideType}
                </span>
              )}
              {typeof currentRide.driverPayout === 'number' && (
                <span style={{ fontFamily:'"JetBrains Mono",monospace', fontSize:10.5, fontWeight:800, color:'#FCD34D' }}>
                  ${currentRide.driverPayout.toFixed(2)}
                </span>
              )}
              {currentRide.paymentMethod && (
                <>
                  {DOT}
                  <span style={{ fontFamily:'"JetBrains Mono",monospace', fontSize:9, fontWeight:700, letterSpacing:'.05em', textTransform:'uppercase', color:'rgba(165,180,252,.6)', background:'rgba(129,140,248,.10)', border:'1px solid rgba(129,140,248,.18)', padding:'1px 6px', borderRadius:5 }}>
                    {currentRide.paymentMethod}
                  </span>
                </>
              )}
              {typeof currentRide.tripDistanceMiles === 'number' && (
                <>
                  {DOT}
                  <span style={{ fontFamily:'"JetBrains Mono",monospace', fontSize:10, fontWeight:600, color:'rgba(165,180,252,.7)' }}>
                    {currentRide.tripDistanceMiles.toFixed(2)} mi
                  </span>
                </>
              )}
              {typeof currentRide.tripDurationMin === 'number' && (
                <>
                  {DOT}
                  <span style={{ fontFamily:'"JetBrains Mono",monospace', fontSize:10, fontWeight:600, color:'rgba(165,180,252,.7)' }}>
                    {currentRide.tripDurationMin} min
                  </span>
                </>
              )}
            </div>
          </>
        ) : (
          <div style={{ fontSize:12, fontWeight:600, color:'rgba(165,180,252,.5)' }}>No rides coming up</div>
        )}
      </div>

      {/* Right: calendar icon + pagination dots */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0 }}>
        <div style={{ width:40, height:40, borderRadius:12, background:'rgba(129,140,248,.14)', border:'1px solid rgba(129,140,248,.28)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Calendar size={18} color="#A5B4FC" strokeWidth={2}/>
        </div>
        {upcomingRides.length > 1 && (
          <div style={{ display:'flex', gap:3 }}>
            {upcomingRides.slice(0, Math.min(5, upcomingRides.length)).map((_, i) => (
              <div key={i} style={{ width: i === rideIdx ? 12 : 4, height:4, borderRadius:2, background: i === rideIdx ? '#818CF8' : 'rgba(255,255,255,.2)', boxShadow: i === rideIdx ? '0 0 8px rgba(129,140,248,.7)' : 'none', transition:'all .3s ease' }}/>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
