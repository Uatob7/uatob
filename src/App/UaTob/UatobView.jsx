import React, { useMemo } from 'react';
import { Car, Sparkles, Activity } from 'lucide-react';
import { useAllDrivers } from "@/App/UaTob/useAllDrivers";

// ─── BOUNDS / coords ──────────────────────────────────────────────────
const BOUNDS = { minLat: 28.30, maxLat: 28.78, minLng: -81.62, maxLng: -81.10 };

function latLngToPct(lat, lng) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 100;
  const y = ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100;
  return {
    x: Math.max(3, Math.min(97, +x.toFixed(1))),
    y: Math.max(3, Math.min(97, +y.toFixed(1))),
  };
}

function addressToCoords(address) {
  if (!address) return { x: 30, y: 50 };
  let hash = 0;
  for (let i = 0; i < address.length; i++) hash = address.charCodeAt(i) + ((hash << 5) - hash);
  return {
    x: +(15 + (Math.abs(hash % 1000) / 1000) * 70).toFixed(1),
    y: +(20 + (Math.abs((hash >> 4) % 1000) / 1000) * 60).toFixed(1),
  };
}

function statusInfo(status) {
  const s = (status || '').toLowerCase();
  if (s === 'online' || s === 'available') return { label: 'Online', color: '#22D3A5' };
  if (s === 'offline')                      return { label: 'Offline', color: '#475569' };
  return { label: 'Busy', color: '#60A5FA' };
}

// ── UATOB letter dot-matrix positions (x%, y%) ──
const LETTER_SLOTS = (() => {
  const letters = {
    U: [
      [1,0,1],
      [1,0,1],
      [1,0,1],
      [1,0,1],
      [0,1,0],
    ],
    A: [
      [0,1,0],
      [1,0,1],
      [1,1,1],
      [1,0,1],
      [1,0,1],
    ],
    T: [
      [1,1,1],
      [0,1,0],
      [0,1,0],
      [0,1,0],
      [0,1,0],
    ],
    O: [
      [0,1,0],
      [1,0,1],
      [1,0,1],
      [1,0,1],
      [0,1,0],
    ],
    B: [
      [1,1,0],
      [1,0,1],
      [1,1,0],
      [1,0,1],
      [1,1,0],
    ],
  };

  const slots = [];
  const letterKeys = ['U', 'A', 'T', 'O', 'B'];
  const startX  = 8;
  const colStep = 6;
  const letterW = 19;
  const startY  = 18;
  const rowStep = 12;

  letterKeys.forEach((key, li) => {
    const matrix = letters[key];
    const lx = startX + li * letterW;
    matrix.forEach((row, ri) => {
      row.forEach((filled, ci) => {
        if (filled) {
          slots.push({
            x: lx + ci * colStep,
            y: startY + ri * rowStep,
          });
        }
      });
    });
  });

  return slots;
})();

// Constellation lines between consecutive online dots
function buildConstellationLines(onlineCount) {
  if (onlineCount < 2) return [];
  const lines = [];
  const slots = LETTER_SLOTS.slice(0, Math.min(onlineCount, LETTER_SLOTS.length));
  for (let i = 0; i < slots.length - 1; i++) {
    lines.push({
      x1: slots[i].x,     y1: slots[i].y,
      x2: slots[i + 1].x, y2: slots[i + 1].y,
    });
  }
  return lines;
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');

  @keyframes pinBreathe {
    0%, 100% { transform: translate(-50%,-50%) scale(1);    filter: brightness(1); }
    50%       { transform: translate(-50%,-50%) scale(1.12); filter: brightness(1.3); }
  }
  @keyframes haloRipple {
    0%   { transform: translate(-50%,-50%) scale(0.6); opacity: 0.7; }
    80%  { transform: translate(-50%,-50%) scale(2.2); opacity: 0;   }
    100% { transform: translate(-50%,-50%) scale(2.2); opacity: 0;   }
  }
  @keyframes pinDrop {
    0%   { transform: translate(-50%,-50%) scale(0);    opacity: 0; }
    60%  { transform: translate(-50%,-50%) scale(1.18); opacity: 1; }
    100% { transform: translate(-50%,-50%) scale(1);    opacity: 1; }
  }
  @keyframes radarSweep {
    0%   { transform: translateX(-100%); opacity: 0;   }
    8%   { opacity: 0.55; }
    50%  { opacity: 0.55; }
    100% { transform: translateX(100%);  opacity: 0;   }
  }
  @keyframes liveDot {
    0%, 100% { opacity: 1; transform: scale(1);     }
    50%       { opacity: 0.4; transform: scale(.85); }
  }
  @keyframes constellationDraw {
    0%   { stroke-dashoffset: 100; opacity: 0;   }
    50%  { opacity: .4;                         }
    100% { stroke-dashoffset: 0;   opacity: .4; }
  }
  @keyframes bgFloat {
    0%, 100% { transform: translate(0, 0)     scale(1);    }
    50%       { transform: translate(20px, -15px) scale(1.08); }
  }
  @keyframes badgePulse {
    0%, 100% { box-shadow: 0 0 0 0    rgba(34,211,165,0);   }
    50%       { box-shadow: 0 0 0 10px rgba(34,211,165,.18); }
  }
`;

export default function UatobView({ trips }) {

  console.log('Trips in UatobView:', trips);
  const { drivers, loading } = useAllDrivers();

  const driverPins = useMemo(() => drivers.map(d => {
    const hasGps = Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lng));
    const pos = hasGps
      ? latLngToPct(Number(d.lat), Number(d.lng))
      : addressToCoords(d.city || d.email || d.id);
    const info = statusInfo(d.status);
    return {
      id:     d.id,
      name:   d.firstName ? `${d.firstName} ${d.lastName}` : 'Driver',
      status: d.status || 'offline',
      pos,
      color:  info.color,
      label:  info.label,
    };
  }), [drivers]);

  const onlinePins  = useMemo(() => driverPins.filter(d => d.label === 'Online'),  [driverPins]);
  const offlinePins = useMemo(() => driverPins.filter(d => d.label !== 'Online'),  [driverPins]);

  const counts = useMemo(() => {
    const online    = onlinePins.length;
    const offline   = driverPins.filter(d => d.label === 'Offline').length;
    const tripCount = Array.isArray(trips) ? trips.length : 0;
    return { total: driverPins.length, online, offline, trips: tripCount };
  }, [driverPins, onlinePins, trips]);

  const constellationLines = useMemo(
    () => buildConstellationLines(onlinePins.length),
    [onlinePins.length]
  );

  const hasOnline = counts.online > 0;

  return (
    <>
      <style>{STYLES}</style>
      <div style={{
        position:     'relative',
        height:       'clamp(260px, 40vh, 320px)',
        borderRadius: '24px',
        overflow:     'hidden',
        background:   'linear-gradient(155deg, #0A1628 0%, #0E2540 35%, #103848 75%, #0F4C45 100%)',
        boxShadow:    '0 16px 48px rgba(10,22,40,.22), 0 2px 6px rgba(10,22,40,.08)',
        fontFamily:   'Outfit, system-ui, sans-serif',
      }}>

        {/* ── Ambient color blobs ── */}
        <div style={{
          position: 'absolute', top: -80, right: -80,
          width: 280, height: 280, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34,211,165,.32) 0%, transparent 70%)',
          filter: 'blur(40px)',
          animation: 'bgFloat 8s ease-in-out infinite',
          pointerEvents: 'none', zIndex: 1,
        }}/>
        <div style={{
          position: 'absolute', bottom: -60, left: -60,
          width: 240, height: 240, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(96,165,250,.22) 0%, transparent 70%)',
          filter: 'blur(36px)',
          animation: 'bgFloat 10s ease-in-out infinite reverse',
          pointerEvents: 'none', zIndex: 1,
        }}/>

        {/* ── Subtle grid pattern (very low opacity) ── */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, opacity: .15 }}>
          <defs>
            <pattern id="mv-dotgrid" width="36" height="36" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r=".8" fill="rgba(255,255,255,.5)"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#mv-dotgrid)"/>
        </svg>

        {/* ── Constellation lines between online dots ── */}
        {constellationLines.length > 0 && (
          <svg style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            zIndex: 3, pointerEvents: 'none',
          }}>
            {constellationLines.map((ln, i) => (
              <line
                key={i}
                x1={`${ln.x1}%`} y1={`${ln.y1}%`}
                x2={`${ln.x2}%`} y2={`${ln.y2}%`}
                stroke="rgba(34,211,165,.5)"
                strokeWidth="1"
                strokeDasharray="3 4"
                style={{
                  strokeDashoffset: 100,
                  animation: `constellationDraw 1.6s ease-out ${0.4 + i * 0.06}s forwards`,
                }}
              />
            ))}
          </svg>
        )}

        {/* ── Radar sweep overlay ── */}
        <div style={{
          position: 'absolute', inset: 0,
          zIndex: 4, pointerEvents: 'none', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            width: '40%',
            background: 'linear-gradient(90deg, transparent 0%, rgba(34,211,165,.16) 50%, transparent 100%)',
            animation: 'radarSweep 6s ease-in-out infinite',
            animationDelay: '1.5s',
          }}/>
        </div>

        {/* ── Top trust badge ── */}
        {!loading && (
          <div style={{
            position: 'absolute', top: 14, left: 14, zIndex: 20,
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 12px',
            background: hasOnline ? 'rgba(34,211,165,.14)' : 'rgba(148,163,184,.14)',
            border: `1px solid ${hasOnline ? 'rgba(34,211,165,.4)' : 'rgba(148,163,184,.3)'}`,
            borderRadius: 99,
            backdropFilter: 'blur(12px)',
            animation: hasOnline ? 'badgePulse 2.4s ease-in-out infinite' : 'none',
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: hasOnline ? '#22D3A5' : '#94A3B8',
              boxShadow: hasOnline ? '0 0 8px #22D3A5' : 'none',
              animation: hasOnline ? 'liveDot 1.6s ease-in-out infinite' : 'none',
            }}/>
            <span style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '.06em',
              color: hasOnline ? '#5EEAD4' : '#CBD5E1',
              textTransform: 'uppercase',
            }}>
              {hasOnline ? `${counts.online} nearby` : 'Drivers offline'}
            </span>
          </div>
        )}

        {/* ── Top-right: brand mark ── */}
        <div style={{
          position: 'absolute', top: 14, right: 14, zIndex: 20,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px',
          background: 'rgba(255,255,255,.06)',
          border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 10,
          backdropFilter: 'blur(12px)',
        }}>
          <Activity size={11} color="#5EEAD4" />
          <span style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.7)',
            letterSpacing: '.05em',
          }}>LIVE</span>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(10,22,40,.6)', backdropFilter: 'blur(8px)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 18px', borderRadius: 99,
              background: 'rgba(255,255,255,.08)',
              border: '1px solid rgba(255,255,255,.14)',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#22D3A5',
                animation: 'liveDot 1.2s ease-in-out infinite',
              }}/>
              <span style={{
                fontSize: 11, fontWeight: 800, color: '#fff',
                letterSpacing: '.1em', textTransform: 'uppercase',
              }}>
                Scanning your area…
              </span>
            </div>
          </div>
        )}

        {/* ── Offline / busy pins — ghost-quiet, scattered ── */}
        {offlinePins.map(d => (
          <div
            key={d.id}
            title={`${d.name} · ${d.label}`}
            style={{
              position:  'absolute',
              left:      `${d.pos.x}%`,
              top:       `${d.pos.y}%`,
              transform: 'translate(-50%,-50%)',
              zIndex:    5,
              opacity:   d.label === 'Busy' ? 0.7 : 0.28,
            }}
          >
            <div style={{
              width:          '11px',
              height:         '11px',
              background:     d.color,
              borderRadius:   '50%',
              border:         '1.5px solid rgba(255,255,255,.5)',
              boxShadow:      d.label === 'Busy' ? `0 0 8px ${d.color}aa` : 'none',
            }}/>
          </div>
        ))}

        {/* ── Online pins — letter slots, glowing, breathing ── */}
        {onlinePins.map((d, i) => {
          const slot = LETTER_SLOTS[i % LETTER_SLOTS.length];
          return (
            <React.Fragment key={d.id}>
              {/* Outer ripple halo */}
              <div
                style={{
                  position: 'absolute',
                  left: `${slot.x}%`,
                  top:  `${slot.y}%`,
                  width: 24, height: 24,
                  borderRadius: '50%',
                  border: '1.5px solid rgba(94,234,212,.5)',
                  pointerEvents: 'none',
                  zIndex: 6,
                  animation: `haloRipple 2.4s ease-out ${i * 0.15}s infinite`,
                }}
              />
              {/* Inner pin */}
              <div
                title={`${d.name} · Online`}
                style={{
                  position:  'absolute',
                  left:      `${slot.x}%`,
                  top:       `${slot.y}%`,
                  zIndex:    7,
                  animation: `pinDrop .55s cubic-bezier(.34,1.56,.64,1) ${i * 0.06}s both, pinBreathe 3.2s ease-in-out ${0.6 + i * 0.12}s infinite`,
                }}
              >
                <div style={{
                  width:          14,
                  height:         14,
                  background:     'radial-gradient(circle, #5EEAD4 0%, #14B8A6 100%)',
                  borderRadius:   '50%',
                  border:         '2px solid #ECFDF5',
                  boxShadow:      '0 0 16px rgba(94,234,212,.65), 0 2px 6px rgba(0,0,0,.3)',
                }}/>
              </div>
            </React.Fragment>
          );
        })}

        {/* ── Bottom strip — refined ── */}
        <div style={{
          position:    'absolute',
          bottom: 0, left: 0, right: 0,
          zIndex:      15,
          background:  'linear-gradient(180deg, rgba(10,22,40,.0) 0%, rgba(10,22,40,.85) 35%, rgba(10,22,40,.95) 100%)',
          padding:     '24px 16px 14px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background:     'rgba(255,255,255,.06)',
            backdropFilter: 'blur(16px)',
            border:         '1px solid rgba(255,255,255,.1)',
            borderRadius:   16,
            padding:        '11px 14px',
          }}>
            {/* Total */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '.1em',
                color: 'rgba(255,255,255,.45)', textTransform: 'uppercase',
              }}>Drivers</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{
                  fontSize: 18, fontWeight: 800, color: '#fff',
                  fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em', lineHeight: 1,
                }}>
                  {counts.total}
                </span>
              </div>
            </div>

            <div style={{ width: 1, height: 26, background: 'rgba(255,255,255,.1)' }}/>

            {/* Status pills */}
            <DarkPill color="#22D3A5" label="Online"  value={counts.online}  glow />
            <DarkPill color="#A78BFA" label="Trips"   value={counts.trips}   />
            <DarkPill color="#94A3B8" label="Offline" value={counts.offline} dim />

          </div>
        </div>

      </div>
    </>
  );
}

function DarkPill({ color, label, value, glow, dim }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{
        width: 7, height: 7, borderRadius: '50%',
        background: color,
        boxShadow: glow ? `0 0 6px ${color}` : 'none',
        opacity: dim ? .6 : 1,
        flexShrink: 0,
      }}/>
      <span style={{
        fontSize: 14, fontWeight: 800,
        color: dim ? 'rgba(255,255,255,.55)' : '#fff',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-.02em',
        lineHeight: 1,
      }}>
        {value}
      </span>
      <span style={{
        fontSize: 10, fontWeight: 600,
        color: 'rgba(255,255,255,.55)',
      }}>
        {label}
      </span>
    </div>
  );
}


Trips in UatobView: 
(4) [{…}, {…}, {…}, {…}]
0
: 
{id: '1T0rQvkIpRYQaNyTm8lx', timedOutAt: Timestamp, emailDispatchAt: Timestamp, offlineDriversNotified: {…}, pickupLng: -82.7099003, …}
1
: 
adminNotified
: 
true
apologyEmailSent
: 
true
apologyEmailSentAt
: 
Timestamp {seconds: 1778526962, nanoseconds: 854000000}
approvedDriversEmailedAt
: 
Timestamp {seconds: 1778469001, nanoseconds: 929000000}
approvedDriversNotified
: 
{KeQ8Y5kHGmQzXe5ALo80LoVGtTk2: true, OWrtmINIsHZcCCFyPgVzrxnMPw73: true, 1tw4E15GBGgNsYlvfMFQudJveke2: true, 5u2TDlnyxDSTqIENyxmaPB3SeAt1: true, 4gmxZQmeFQYIzj4x2ZKI6K1EdB02: true, …}
autoRefundProcessedAt
: 
Timestamp {seconds: 1778526962, nanoseconds: 303000000}
autoRefundStatus
: 
"succeeded"
cancelReason
: 
"timeout_auto_cancel"
cancelledAt
: 
Timestamp {seconds: 1778526962, nanoseconds: 303000000}
candidateDriverUids
: 
(6) ['7Uh6WlBZ0wYCZqF8OTrwpkODG7F2', 'at5VxbnwfXWAzsXVdKOwHMQCnOb2', '0Kh5xBvMgPNTN1WSpfBVOWRiVHe2', 'x6XldJOfWcbG5RRqocOfCs0u1m12', 'khfZ88XTF8TjI9dBcbqY0730MQA3', 'rr5rvgmy8HQcWLdAyOKssV9LdRv2']
candidateDrivers
: 
(6) [{…}, {…}, {…}, {…}, {…}, {…}]
createdAt
: 
Timestamp {seconds: 1778470943, nanoseconds: 235000000}
currentDriverIndex
: 
0
driverInfo
: 
null
driverPayout
: 
16.94
dropoff
: 
"8134 International Drive, Orlando, FL, USA"
dropoffCity
: 
"Orlando"
dropoffLat
: 
28.4480048
dropoffLng
: 
-81.4725685
dropoffZip
: 
"32819"
emailDispatchAt
: 
Timestamp {seconds: 1778469002, nanoseconds: 194000000}
emailDispatchStarted
: 
true
emailSentToDrivers
: 
{khfZ88XTF8TjI9dBcbqY0730MQA3: true, 0Kh5xBvMgPNTN1WSpfBVOWRiVHe2: true, x6XldJOfWcbG5RRqocOfCs0u1m12: true, at5VxbnwfXWAzsXVdKOwHMQCnOb2: true, 7Uh6WlBZ0wYCZqF8OTrwpkODG7F2: true, …}
expiresAt
: 
Timestamp {seconds: 1778471363, nanoseconds: 235000000}
fareBreakdown
: 
{}
fareTotal
: 
22.59
id
: 
"BCCx17PgJoEmjMnJZ6dK"
lastPushAt
: 
Timestamp {seconds: 1778469004, nanoseconds: 193000000}
offlineDriversEmailedAt
: 
Timestamp {seconds: 1778470984, nanoseconds: 960000000}
offlineDriversNotified
: 
{CBmYmBLg5PN2I2BEdQQGRTDYcx92: true, gmikoLPXOnRTf0T0AUgDog8VYUr1: true, ShwYtnVgnmYHYOv3i7J2KIwuCPh2: true, Z0SucKpv8iNCuNO1haW7Qe0rUSQ2: true, 2L1vviHxDaUoub2V1FbMbQfdt0I2: true, …}
paymentIntentId
: 
"pi_3TVkCzJhpOy6wtDq0g21GOlr"
paymentMethod
: 
"card"
paymentStatus
: 
"refunded"
payoutStatus
: 
"pending"
pickup
: 
"2325 West Fairbanks Avenue, Winter Park, FL, USA"
pickupCity
: 
"Winter Park"
pickupLat
: 
28.5933398
pickupLng
: 
-81.3807973
pickupZip
: 
"32789"
platformFee
: 
5.65
polyline
: 
"msomDnvuoNQ?ICAS?{@fACFjJVTp@SpD_FdDcFBa@~HuJlBoBxBeBvBsArBaAlC_AxBk@~Cg@`CQvYw@hDB|CNhDb@tInAdCPzCHpWA`QP~BJxBVnBd@tBv@bAf@zBzA`JlH`DtBpDrBpD`BnDpArBn@nCl@xGbAxQdCjDZrFVrFHzGIrYc@xCIhMErFF|BLzD\\rEn@~Cp@zC~@lBt@pPvHbBn@xC~@nCl@xB^hDXvCJni@ArBDbCR`BVbDr@lC~@zBbAjBhAdAt@|BvBxAbBdAvAbNvT|DxG~AhDbBhElAtEr@xDd@fDXhDLdCHzDN~tADnAXjDd@~Cv@jDdA`DdAbCtAbCpAhBnBzBp@l@xR`PbKjIzVzSnTzQjXzT|DrDtCzC|E`Gf`@hg@zPlTtBpCnL~PfBbCrNrQzPbT|LpNjH`JxUpZHd@pEnG~CpEpDhFlBtBxBnBjBlAfB|@dBn@xA^vCh@vF\\~GVfDLhAJxJn@N@`@KZO\\g@Lo@BaDPa@\\oBB_AAeAj@Dn@j@|@z@dAj@\\Jj@JRO@CAg@CeCt@A"
pushDispatchAt
: 
Timestamp {seconds: 1778468944, nanoseconds: 260000000}
pushDispatchStarted
: 
true
pushDriverIndex
: 
10
pushSentToDrivers
: 
{khfZ88XTF8TjI9dBcbqY0730MQA3: true}
receiptEmailSent
: 
true
refundId
: 
"re_3TVkCzJhpOy6wtDq0IlSAZFH"
requestSentAt
: 
Timestamp {seconds: 1778471343, nanoseconds: 637000000}
rideLabel
: 
"Economy"
rideType
: 
"economy"
searchExtended
: 
1
status
: 
"cancelled"
timedOutAt
: 
Timestamp {seconds: 1778471401, nanoseconds: 428000000}
timeoutMinutes
: 
10
tripDistanceMiles
: 
13.6
tripDurationMin
: 
21
uid
: 
"NaraNDRmxpYegriNTrUo5h3rGVI3"
updatedAt
: 
Timestamp {seconds: 1778526962, nanoseconds: 303000000}
[[Prototype]]
: 
Object
2
: 
{id: 'PlzVo8BNK7YNtJxqkYEP', cancelledAt: Timestamp, platformFee: 3.89, uid: 'TA5V8QslrMRxQ7xcUheGJrJJ9EG3', lastDispatchAt: Timestamp, …}
3
: 
{id: 'vBxXLEArYcXWayvUmBBc', candidateDriverUids: Array(6), paymentStatus: 'succeeded', dropoffLng: -79.8865932, timeoutMinutes: 10, …}
length
: 
4
[[Prototype]]
: 
Array(0)