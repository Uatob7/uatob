import { useMemo, useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, ArrowRight, Car, Clock } from 'lucide-react';

const C = {
  blue: '#60A5FA',
  blueSoft: '#93C5FD',
  violet: '#C084FC',
  green: '#4ADE80',
  red: '#F87171',
  text: 'rgba(255,255,255,.92)',
  mid: 'rgba(255,255,255,.55)',
  dim: 'rgba(255,255,255,.32)',
};

const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";

function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  return 0;
}

function strip(a) {
  if (!a) return '—';
  return a
    .replace(/^\s*\d+\s+[A-Za-z0-9.-]+\s+/, '')
    .replace(/,\s*(Orlando|Tampa|Kissimmee|FL|USA).*$/i, '')
    .trim();
}

// Live scheduled rides feed
export default function SearchesCard({ scheduledRides = [] }) {

  console.log('ScheduledCard render', { scheduledRides });
  const feed = useMemo(
    () =>
      [...scheduledRides]
        .filter((s) => s.pickup && s.dropoff)
        .sort(
          (a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt)
        )
        .slice(0, 6),
    [scheduledRides]
  );

  const [i, setI] = useState(0);
  const [exit, setExit] = useState(false);
  const t = useRef(null);

  useEffect(() => {
    if (!feed.length) return;

    clearInterval(t.current);

    t.current = setInterval(() => {
      setExit(true);

      setTimeout(() => {
        setI((x) => (x + 1) % feed.length);
        setExit(false);
      }, 260);
    }, 3600);

    return () => clearInterval(t.current);
  }, [feed.length]);

  const cur = feed[i];

  const dc = cur?.driverInfo?.driverCount ?? 0;
  const eta = cur?.driverInfo?.etaLabel ?? null;
  const fare =
    cur?.rides?.standard?.total ??
    cur?.rides?.economy?.total ??
    null;

  return (
    <div>
      <style>{`
        @keyframes scIn{from{opacity:0;transform:translateY(4px)}to{opacity:1}}
        @keyframes scOut{to{opacity:0;transform:translateY(-4px)}}
        @keyframes scDot{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes scBar{from{width:0}to{width:100%}}
      `}</style>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 9px',
            borderRadius: 100,
            background: 'rgba(96,165,250,.12)',
            border: '1px solid rgba(96,165,250,.22)',
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: C.blue,
              boxShadow: `0 0 7px ${C.blue}`,
              animation: 'scDot 1.8s ease-in-out infinite',
            }}
          />
          <span
            style={{
              fontFamily: COND,
              fontSize: 9.5,
              fontWeight: 800,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              color: C.blueSoft,
            }}
          >
            Scheduled Rides
          </span>
        </span>

        {feed.length > 0 && (
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10,
              fontWeight: 700,
              color: 'rgba(96,165,250,.4)',
            }}
          >
            {i + 1}/{feed.length}
          </span>
        )}
      </div>

      {/* Empty state */}
      {!cur ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            color: 'rgba(147,197,253,.4)',
            fontSize: 12,
            fontWeight: 600,
            padding: '8px 0',
            minHeight: 64,
          }}
        >
          <Car size={14} strokeWidth={2.2} />
          No scheduled rides
        </div>
      ) : (
        <div
          key={i}
          style={{
            minHeight: 64,
            animation: exit
              ? 'scOut .26s ease both'
              : 'scIn .3s cubic-bezier(.34,1.2,.64,1) both',
          }}
        >
          {/* Route */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 15,
                height: 15,
                borderRadius: 5,
                flexShrink: 0,
                background: 'rgba(96,165,250,.16)',
                border: '1px solid rgba(96,165,250,.28)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Navigation
                size={7}
                color={C.blue}
                strokeWidth={2.6}
              />
            </div>

            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontFamily: COND,
                fontSize: 15,
                fontWeight: 900,
                color: '#fff',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {strip(cur.pickup)}
            </span>

            <ArrowRight
              size={10}
              color="rgba(96,165,250,.35)"
              strokeWidth={2.5}
            />

            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontFamily: 'Barlow,sans-serif',
                fontSize: 12,
                fontWeight: 600,
                color: C.violet,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {strip(cur.dropoff)}
            </span>
          </div>

          {/* Meta */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 7px',
                borderRadius: 99,
                background:
                  dc > 0
                    ? 'rgba(34,197,94,.1)'
                    : 'rgba(239,68,68,.09)',
                border: `1px solid ${
                  dc > 0
                    ? 'rgba(34,197,94,.22)'
                    : 'rgba(239,68,68,.2)'
                }`,
              }}
            >
              <Car
                size={8}
                color={dc > 0 ? C.green : C.red}
                strokeWidth={2.4}
              />
              <span
                style={{
                  fontFamily: 'Barlow,sans-serif',
                  fontSize: 9,
                  fontWeight: 800,
                  color: dc > 0 ? C.green : C.red,
                }}
              >
                {dc > 0
                  ? `${dc} driver${dc > 1 ? 's' : ''}`
                  : 'No drivers'}
              </span>
            </span>

            {dc > 0 && eta && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Clock
                  size={8}
                  color="rgba(74,222,128,.45)"
                />
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 9.5,
                    fontWeight: 700,
                    color: 'rgba(74,222,128,.55)',
                  }}
                >
                  {eta}
                </span>
              </span>
            )}

            {fare != null && (
              <span
                style={{
                  marginLeft: 'auto',
                  fontFamily: MONO,
                  fontSize: 11,
                  fontWeight: 800,
                  color: C.green,
                }}
              >
                ${Number(fare).toFixed(2)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Progress bar */}
      {feed.length > 1 && (
        <div
          style={{
            marginTop: 10,
            height: 2,
            borderRadius: 2,
            background: 'rgba(96,165,250,.1)',
            overflow: 'hidden',
          }}
        >
          <div
            key={`b${i}`}
            style={{
              height: '100%',
              borderRadius: 2,
              background:
                'linear-gradient(90deg,#60A5FA,#C084FC)',
              animation: 'scBar 3.6s linear forwards',
            }}
          />
        </div>
      )}
    </div>
  );
}