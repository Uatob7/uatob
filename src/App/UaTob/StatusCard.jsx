/**
 * StatusCard.jsx — Rider HUD bottom card carousel
 *
 * Faces:
 *   0  BookRideCard
 *   1  SearchesCard
 *   2  ScheduledCard
 *   3  NotificationsCard
 *
 * Props (StatusCard):
 *   face              number
 *   onFaceChange      fn(index)
 *   rides             array
 *   searches          array
 *   scheduledRides    array
 *   now               number   (Date.now())
 *   callSaveFcmToken  fn
 *   onBook            fn
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── Design tokens ──────────────────────────────────────────────────────────
const C = {
  bg:          '#050A06',
  bgDeep:      '#030604',
  panel:       'rgba(5,10,6,.78)',
  panelSolid:  '#070D08',
  green:       '#22C55E',
  greenBright: '#4ADE80',
  greenSoft:   '#34D399',
  amber:       '#FB923C',
  amberBright: '#FBBF24',
  violet:      '#C084FC',
  cyan:        '#67E8F9',
  red:         '#F87171',
  line:        'rgba(34,197,94,.25)',
  lineSoft:    'rgba(34,197,94,.14)',
  inkText:     'rgba(255,255,255,.42)',
  inkTextDim:  'rgba(255,255,255,.22)',
  inkTextFade: 'rgba(255,255,255,.10)',
};

const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";

// ─── Card face indices ──────────────────────────────────────────────────────
export const FACE_BOOK      = 0;
export const FACE_SEARCHES  = 1;
export const FACE_SCHEDULED = 2;
export const FACE_NOTIFS    = 3;
export const FACE_COUNT     = 4;

const AUTO_CYCLE_MS = 3800;

// ─── Helpers ────────────────────────────────────────────────────────────────
function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') { const p = Date.parse(ts); return isNaN(p) ? 0 : p; }
  return 0;
}

function formatCountdown(ms) {
  if (!ms || ms <= 0) return 'DUE';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60;
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

function fmtSchedTime(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

function hasCoords(o) {
  return typeof o?.pickupLat === 'number' && typeof o?.pickupLng === 'number';
}

// ═══════════════════════════════════════════════════════════════════════════
// FACE 0 — Book a Ride
// ═══════════════════════════════════════════════════════════════════════════
function BookRideCard({ onBook }) {
  return (
    <div style={{ padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div>
          <div style={{
            fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.16em',
            color: C.greenBright, textTransform: 'uppercase',
          }}>Book a Ride</div>
          <div style={{ fontFamily: MONO, fontSize: 8.5, color: C.inkTextDim, marginTop: 1 }}>
            Orlando, FL
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: C.greenBright,
            boxShadow: `0 0 6px ${C.greenBright}`,
            animation: 'uaBlink 1.6s ease-in-out infinite',
          }}/>
          <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: C.greenBright }}>
            LIVE
          </span>
        </div>
      </div>

      {/* Pickup / Dropoff rows */}
      <div style={{
        borderRadius: 10, overflow: 'hidden',
        border: '1px solid rgba(34,197,94,.18)',
        background: 'rgba(255,255,255,.03)',
      }}>
        {[
          { label: 'Pickup',   placeholder: 'Where are you?', dot: C.greenBright, glow: true  },
          { label: 'Drop-off', placeholder: 'Where to?',      dot: 'rgba(255,255,255,.55)', glow: false },
        ].map((row, i) => (
          <div key={i}>
            {i > 0 && <div style={{ height: 1, background: 'rgba(34,197,94,.1)', margin: '0 10px' }}/>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px' }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: row.dot,
                boxShadow: row.glow ? `0 0 5px ${C.greenBright}88` : 'none',
              }}/>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: COND, fontSize: 7.5, fontWeight: 800, letterSpacing: '.1em',
                  color: C.inkTextDim, textTransform: 'uppercase',
                }}>{row.label}</div>
                <div style={{
                  fontFamily: MONO, fontSize: 10, fontWeight: 600,
                  color: 'rgba(255,255,255,.35)',
                }}>{row.placeholder}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button onClick={onBook} style={{
        width: '100%', padding: '9px 0', borderRadius: 10,
        background: 'linear-gradient(135deg, #22C55E, #16A34A)',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 18px rgba(34,197,94,.35)',
        animation: 'uaGlowPulse 2.8s ease-in-out infinite',
      }}>
        <span style={{
          fontFamily: COND, fontSize: 11, fontWeight: 800, letterSpacing: '.14em',
          color: '#fff', textTransform: 'uppercase',
        }}>Request Ride</span>
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FACE 1 — Live Searches
// ═══════════════════════════════════════════════════════════════════════════
function SearchesCard({ searches, scheduledRides }) {
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
          }}>Live Activity</div>
          <div style={{ fontFamily: MONO, fontSize: 8.5, color: C.inkTextDim, marginTop: 1 }}>
            Orlando metro · now
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {[
          { value: liveCount,  label: 'Searches',  color: C.cyan   },
          { value: schedCount, label: 'Scheduled', color: C.violet },
        ].map((tile, i) => (
          <div key={i} style={{
            borderRadius: 10, padding: '8px 11px',
            background: 'rgba(255,255,255,.04)',
            border: `1px solid ${tile.color}22`,
          }}>
            <div style={{
              fontFamily: MONO, fontSize: 21, fontWeight: 800, color: tile.color, lineHeight: 1,
              textShadow: `0 0 16px ${tile.color}55`,
            }}>{tile.value}</div>
            <div style={{
              fontFamily: COND, fontSize: 7.5, fontWeight: 800, letterSpacing: '.12em',
              color: C.inkTextDim, textTransform: 'uppercase', marginTop: 3,
            }}>{tile.label}</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '6px 10px', borderRadius: 8,
        background: 'rgba(255,255,255,.03)', border: '1px solid rgba(34,197,94,.1)',
      }}>
        {[
          { c: C.greenBright, label: 'Rider' },
          { c: C.amber,       label: 'Guest' },
          { c: C.violet,      label: 'Sched' },
        ].map((row, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', background: row.c,
              boxShadow: `0 0 4px ${row.c}88`,
            }}/>
            <span style={{
              fontFamily: MONO, fontSize: 8.5, fontWeight: 600,
              color: 'rgba(255,255,255,.38)',
            }}>{row.label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%', background: C.green,
            animation: 'uaBlink 1.4s ease-in-out infinite',
          }}/>
          <span style={{ fontFamily: MONO, fontSize: 8.5, color: C.greenBright }}>LIVE</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FACE 2 — Scheduled Rides
// ═══════════════════════════════════════════════════════════════════════════
function ScheduledCard({ scheduledRides, now }) {
  const sorted = useMemo(() => {
    return [...scheduledRides]
      .map(r => ({ ...r, _when: tsToMillis(r.scheduledAt) }))
      .sort((a, b) => a._when - b._when)
      .slice(0, 3);
  }, [scheduledRides]);

  return (
    <div style={{ padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div>
          <div style={{
            fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.16em',
            color: C.violet, textTransform: 'uppercase',
          }}>Scheduled</div>
          <div style={{ fontFamily: MONO, fontSize: 8.5, color: C.inkTextDim, marginTop: 1 }}>
            {sorted.length} upcoming
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '12px 0',
          fontFamily: MONO, fontSize: 10, color: C.inkTextDim, lineHeight: 1.6,
        }}>
          No scheduled rides.<br/>
          <span style={{ color: C.violet, opacity: .7 }}>Book one anytime</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {sorted.map((r, i) => {
            const cd      = r._when ? r._when - now : null;
            const due     = cd !== null && cd <= 0;
            const urgent  = cd !== null && cd > 0 && cd < 15 * 60 * 1000;
            const dotColor = due || urgent ? C.red : C.violet;
            return (
              <div key={r.id || i} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px',
                borderRadius: 8, background: 'rgba(192,132,252,.06)',
                border: '1px solid rgba(192,132,252,.14)',
                animation: `uaCardFlip .3s ease ${i * 0.05}s both`,
              }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: dotColor, boxShadow: `0 0 6px ${dotColor}`,
                  animation: (due || urgent) ? 'uaBlink 1.2s ease-in-out infinite' : 'none',
                }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: MONO, fontSize: 10, fontWeight: 700, color: '#F3E8FF',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {r.pickupLabel || r.pickupAddress || 'Pickup'}
                  </div>
                  <div style={{
                    fontFamily: MONO, fontSize: 8.5, color: 'rgba(192,132,252,.6)', marginTop: 1,
                  }}>
                    {fmtSchedTime(r._when)}
                  </div>
                </div>
                <div style={{
                  fontFamily: MONO, fontSize: 9, fontWeight: 800, flexShrink: 0,
                  color:      due || urgent ? C.red : '#E9D5FF',
                  background: due || urgent ? 'rgba(248,113,113,.14)' : 'rgba(192,132,252,.12)',
                  padding: '2px 7px', borderRadius: 6,
                }}>
                  {cd !== null ? formatCountdown(cd) : '—'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FACE 3 — Notifications
// ═══════════════════════════════════════════════════════════════════════════
function NotificationsCard({ rides, callSaveFcmToken }) {
  const [permState, setPermState] = useState('default');
  const [enabling,  setEnabling]  = useState(false);

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPermState(Notification.permission);
  }, []);

  const handleEnable = useCallback(async () => {
    setEnabling(true);
    try {
      const perm = await Notification.requestPermission();
      setPermState(perm);
      if (perm === 'granted' && callSaveFcmToken) await callSaveFcmToken();
    } catch (e) {}
    setEnabling(false);
  }, [callSaveFcmToken]);

  const recentRides = useMemo(() => {
    return [...(rides || [])]
      .sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt))
      .slice(0, 2);
  }, [rides]);

  return (
    <div style={{ padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div>
          <div style={{
            fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.16em',
            color: C.amberBright, textTransform: 'uppercase',
          }}>Alerts</div>
          <div style={{ fontFamily: MONO, fontSize: 8.5, color: C.inkTextDim, marginTop: 1 }}>
            {permState === 'granted' ? 'Push on' : 'Push off'}
          </div>
        </div>
        {permState !== 'granted' && (
          <button
            onClick={handleEnable}
            disabled={enabling || permState === 'denied'}
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 9px', borderRadius: 7,
              cursor: permState === 'denied' ? 'default' : 'pointer',
              background: permState === 'denied' ? 'rgba(248,113,113,.12)' : 'rgba(251,191,36,.14)',
              border: `1px solid ${permState === 'denied' ? C.red : C.amberBright}44`,
              fontFamily: MONO, fontSize: 9, fontWeight: 700,
              color: permState === 'denied' ? C.red : C.amberBright,
            }}>
            {enabling ? 'Enabling…' : permState === 'denied' ? 'Blocked' : 'Enable'}
          </button>
        )}
        {permState === 'granted' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontFamily: MONO, fontSize: 8.5, color: C.greenBright }}>ON</span>
          </div>
        )}
      </div>

      {/* Recent rides */}
      {recentRides.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {recentRides.map((ride, i) => {
            const status = ride.status || 'unknown';
            const statusColor = {
              completed:       C.greenBright,
              in_progress:     C.amberBright,
              driver_assigned: C.cyan,
              cancelled:       C.red,
            }[status] || C.inkText;
            return (
              <div key={ride.id || i} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px',
                borderRadius: 8, background: 'rgba(255,255,255,.03)',
                border: `1px solid ${statusColor}1a`,
                animation: `uaCardFlip .3s ease ${i * 0.06}s both`,
              }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: statusColor, boxShadow: `0 0 5px ${statusColor}77`,
                }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: MONO, fontSize: 10, fontWeight: 700,
                    color: 'rgba(255,255,255,.82)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {ride.pickupLabel || ride.pickupAddress || 'Pickup'}
                  </div>
                </div>
                <span style={{
                  fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.1em',
                  color: statusColor, textTransform: 'uppercase',
                  background: `${statusColor}18`, padding: '2px 6px', borderRadius: 5,
                }}>
                  {status.replace(/_/g, ' ')}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{
          textAlign: 'center', padding: '10px 0',
          fontFamily: MONO, fontSize: 10, color: C.inkTextDim, lineHeight: 1.7,
        }}>
          No recent rides yet.
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STATUS CARD (carousel shell)
// ═══════════════════════════════════════════════════════════════════════════
const FACES = [
  { label: 'Book',      color: C.greenBright },
  { label: 'Searches',  color: C.cyan        },
  { label: 'Scheduled', color: C.violet      },
  { label: 'Alerts',    color: C.amberBright },
];

export default function StatusCard({
  face,
  onFaceChange,
  rides,
  searches,
  scheduledRides,
  now,
  callSaveFcmToken,
  onBook,
}) {
  const [autoCycle, setAutoCycle] = useState(true);
  const timerRef = useRef(null);

  // Auto-advance
  useEffect(() => {
    if (!autoCycle) return;
    timerRef.current = setTimeout(() => {
      onFaceChange((face + 1) % FACE_COUNT);
    }, AUTO_CYCLE_MS);
    return () => clearTimeout(timerRef.current);
  }, [face, autoCycle, onFaceChange]);

  const handleTabClick = useCallback((i) => {
    setAutoCycle(false);
    onFaceChange(i);
    clearTimeout(timerRef.current);
    // Resume auto-cycle after 12 s of inactivity
    timerRef.current = setTimeout(() => setAutoCycle(true), 12_000);
  }, [onFaceChange]);

  const accentColor = FACES[face].color;

  return (
    <div style={{
      width: '100%', maxWidth: 340,
      background: 'linear-gradient(180deg, rgba(6,14,8,.94), rgba(3,8,5,.97))',
      border: `1px solid ${accentColor}30`,
      borderRadius: 16, overflow: 'hidden',
      boxShadow: `0 10px 36px rgba(0,0,0,.6), 0 0 24px ${accentColor}18`,
      backdropFilter: 'blur(16px)',
      transition: 'border-color .35s ease, box-shadow .35s ease',
    }}>

      {/* Top accent stripe */}
      <div style={{
        height: 2,
        background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
        transition: 'background .35s ease',
      }}/>

      {/* Tab bar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '7px 10px 0',
        borderBottom: '1px solid rgba(34,197,94,.1)',
      }}>
        {FACES.map((f, i) => {
          const active = i === face;
          return (
            <button key={i} onClick={() => handleTabClick(i)} style={{
              flex: 1, padding: '4px 2px 7px', cursor: 'pointer',
              background: 'none', border: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              position: 'relative',
            }}>
              <span style={{
                fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.1em',
                color: active ? f.color : 'rgba(255,255,255,.22)',
                textTransform: 'uppercase',
                transition: 'color .25s ease',
              }}>{f.label}</span>
              {active && (
                <div style={{
                  position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2,
                  borderRadius: '2px 2px 0 0',
                  background: f.color,
                  boxShadow: `0 0 8px ${f.color}`,
                  animation: 'uaFadeIn .2s ease both',
                }}/>
              )}
            </button>
          );
        })}
      </div>

      {/* Active face */}
      <div key={face} style={{ animation: 'uaCardFlip .28s ease both' }}>
        {face === FACE_BOOK      && <BookRideCard onBook={onBook}/>}
        {face === FACE_SEARCHES  && <SearchesCard searches={searches} scheduledRides={scheduledRides}/>}
        {face === FACE_SCHEDULED && <ScheduledCard scheduledRides={scheduledRides} now={now}/>}
        {face === FACE_NOTIFS    && <NotificationsCard rides={rides} callSaveFcmToken={callSaveFcmToken}/>}
      </div>

      {/* Progress dots */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5,
        padding: '2px 0 12px',
      }}>
        {FACES.map((f, i) => (
          <div key={i} onClick={() => handleTabClick(i)} style={{
            width: i === face ? 16 : 5, height: 5, borderRadius: 3,
            background: i === face ? accentColor : 'rgba(255,255,255,.15)',
            cursor: 'pointer',
            transition: 'width .3s ease, background .3s ease',
            boxShadow: i === face ? `0 0 8px ${accentColor}` : 'none',
          }}/>
        ))}
      </div>
    </div>
  );
}