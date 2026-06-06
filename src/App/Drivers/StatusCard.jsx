import { useEffect, useState, useRef } from 'react';
import { Power, Radar, Zap, MapPin } from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';

/**
 * Online/offline status card with toggle button.
 *
 * Props:
 *   online      — bool
 *   activeTrip  — current trip object or null
 *   tripStage   — "idle" | "enroute" | "arrived" | "in_progress" | "completed"
 *   onToggle    — called when the toggle button is pressed
 *   onlineSince — (optional) Date or timestamp when driver went online
 *   nearbyCount — (optional) number of riders nearby
 */
export default function StatusCard({
  online,
  scheduledRides,
  activeTrip,
  tripStage,
  onToggle,
  onlineSince,
  nearbyCount,
}) {
  const [now, setNow] = useState(Date.now());
  const onlineSinceRef = useRef(null);

  console.log('scheduledRides', scheduledRides);

  // Track when driver went online (fallback if not passed in)
  useEffect(() => {
    if (online && !onlineSinceRef.current) {
      onlineSinceRef.current = Date.now();
    }
    if (!online) {
      onlineSinceRef.current = null;
    }
  }, [online]);

  // Tick every minute to update online duration
  useEffect(() => {
    if (!online) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [online]);

  const sinceMs = onlineSince
    ? (typeof onlineSince === "number" ? onlineSince : onlineSince?.toMillis?.() ?? new Date(onlineSince).getTime())
    : onlineSinceRef.current;

  const onlineMin = sinceMs ? Math.max(0, Math.floor((now - sinceMs) / 60_000)) : 0;
  const onlineLabel = onlineMin < 1
    ? "just now"
    : onlineMin < 60
      ? `${onlineMin} min`
      : `${Math.floor(onlineMin / 60)}h ${onlineMin % 60}m`;

  // ── Mode determines layout/colors ──
  const mode = !online
    ? "offline"
    : activeTrip
      ? "trip"
      : "waiting";

  const styles = {
    offline: {
      bg:     C.surface,
      border: `1px solid ${C.border}`,
      shadow: `0 2px 12px ${C.shadow}`,
    },
    waiting: {
      bg:     "linear-gradient(135deg,#F0FDF4 0%,#DCFCE7 50%,#F0FDF4 100%)",
      border: "1.5px solid rgba(22,163,74,.30)",
      shadow: "0 8px 28px rgba(22,163,74,.14), 0 1px 3px rgba(22,163,74,.10)",
    },
    trip: {
      bg:     "linear-gradient(135deg,#0F172A 0%,#1E293B 50%,#0F172A 100%)",
      border: "1.5px solid rgba(34,197,94,.35)",
      shadow: "0 12px 40px rgba(0,0,0,.25), 0 2px 6px rgba(0,0,0,.10)",
    },
  }[mode];

  return (
    <div style={{
      background: styles.bg,
      border: styles.border,
      borderRadius: 22,
      padding: "22px",
      position: "relative",
      overflow: "hidden",
      transition: "all .4s cubic-bezier(.34,1.2,.64,1)",
      boxShadow: styles.shadow,
    }}>
      <style>{`
        @keyframes scRadar {
          0%   { transform: scale(0.6); opacity: 0.7; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        @keyframes scLiveDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes scScan {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes scStripeMove {
          to { background-position: 40px 0; }
        }
        @keyframes scOnlinePulse {
          0%, 100% { box-shadow: 0 8px 20px rgba(22,163,74,.35), 0 0 0 0 rgba(22,163,74,.4); }
          50%      { box-shadow: 0 8px 20px rgba(22,163,74,.35), 0 0 0 12px rgba(22,163,74,0); }
        }
      `}</style>

      {/* ── WAITING: Radar pulse rings ── */}
      {mode === "waiting" && (
        <>
          <div style={{
            position: "absolute", top: "50%", right: 80,
            width: 60, height: 60, borderRadius: "50%",
            background: "rgba(22,163,74,.20)",
            transform: "translateY(-50%)",
            animation: "scRadar 2.4s ease-out infinite",
            pointerEvents: "none",
          }}/>
          <div style={{
            position: "absolute", top: "50%", right: 80,
            width: 60, height: 60, borderRadius: "50%",
            background: "rgba(22,163,74,.15)",
            transform: "translateY(-50%)",
            animation: "scRadar 2.4s ease-out 0.8s infinite",
            pointerEvents: "none",
          }}/>
          {/* Diagonal stripes */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 60px,rgba(22,163,74,.04) 60px,rgba(22,163,74,.04) 61px)",
            pointerEvents: "none",
          }}/>
        </>
      )}

      {/* ── TRIP: Decorative grid + glow ── */}
      {mode === "trip" && (
        <>
          <div style={{
            position: "absolute", inset: 0, opacity: 0.06,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)," +
              "linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            pointerEvents: "none",
          }}/>
          <div style={{
            position: "absolute", top: -60, right: -60,
            width: 200, height: 200, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(34,197,94,0.30) 0%, transparent 70%)",
            pointerEvents: "none",
          }}/>
          {/* Animated scan line */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0,
            height: 2,
            background: "linear-gradient(90deg, transparent, rgba(34,197,94,0.7), transparent)",
            animation: "scScan 2.5s linear infinite",
            pointerEvents: "none",
          }}/>
        </>
      )}

      {/* ── Content ── */}
      <div style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Status pill */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 10px",
            borderRadius: 100,
            background: mode === "trip"
              ? "rgba(255,255,255,0.10)"
              : mode === "waiting"
                ? "rgba(22,163,74,.12)"
                : C.surfaceAlt,
            border: mode === "trip"
              ? "1px solid rgba(255,255,255,0.15)"
              : mode === "waiting"
                ? "1px solid rgba(22,163,74,.20)"
                : `1px solid ${C.border}`,
            marginBottom: 8,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: mode === "offline" ? C.textDim : "#22C55E",
              boxShadow: mode !== "offline" ? "0 0 8px rgba(34,197,94,0.7)" : "none",
              animation: mode !== "offline" ? "scLiveDot 1.6s ease-in-out infinite" : "none",
            }}/>
            <span className="mono" style={{
              fontSize: 10, fontWeight: 800, letterSpacing: ".12em",
              textTransform: "uppercase",
              color: mode === "trip"
                ? "rgba(255,255,255,0.85)"
                : mode === "waiting"
                  ? C.onlineGreen
                  : C.textDim,
            }}>
              {mode === "trip"   && "On trip"}
              {mode === "waiting" && "Online · ready"}
              {mode === "offline" && "Offline"}
            </span>
          </div>

          {/* Main title */}
          <div className="condensed" style={{
            fontSize: 26,
            fontWeight: 900,
            color: mode === "trip" ? "#fff" : C.text,
            letterSpacing: "-0.5px",
            lineHeight: 1.1,
            marginBottom: 4,
            opacity: mode === "offline" ? 0.65 : 1,
          }}>
            {mode === "offline" && "You're offline"}
            {mode === "waiting" && "Looking for rides"}
            {mode === "trip"    && `Active trip · ${(tripStage ?? "").replace("_", " ")}`}
          </div>

          {/* Sub-meta */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            fontSize: 12, fontWeight: 600,
            color: mode === "trip"
              ? "rgba(255,255,255,0.55)"
              : mode === "waiting"
                ? "#15803D"
                : C.textDim,
            flexWrap: "wrap",
          }}>
            {mode === "offline" && (
              <span>Tap "Go online" to start earning</span>
            )}

            {mode === "waiting" && (
              <>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Radar size={12} strokeWidth={2.2}/>
                  Scanning area
                </span>
                {sinceMs && (
                  <>
                    <span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(22,163,74,.35)" }}/>
                    <span>Online {onlineLabel}</span>
                  </>
                )}
                {nearbyCount > 0 && (
                  <>
                    <span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(22,163,74,.35)" }}/>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <MapPin size={11} strokeWidth={2.2}/>
                      {nearbyCount} nearby
                    </span>
                  </>
                )}
              </>
            )}

            {mode === "trip" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Zap size={12} fill="#22C55E" strokeWidth={0}/>
                Earning · stay focused
              </span>
            )}
          </div>
        </div>

        {/* Right: toggle button (only when not on trip) */}
        {!activeTrip && (
          <button
            onClick={onToggle}
            style={{
              flexShrink: 0,
              background: online
                ? "linear-gradient(135deg,#22C55E 0%,#16A34A 55%,#15803D 100%)"
                : "linear-gradient(135deg,#0F172A,#1F2937 55%,#0F172A)",
              border: "none",
              borderRadius: 100,
              padding: online ? "13px 18px" : "13px 22px",
              color: "#fff",
              fontFamily: "'Barlow',sans-serif",
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: ".3px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 7,
              transition: "filter .15s, transform .1s",
              boxShadow: online
                ? "0 8px 20px rgba(22,163,74,.35)"
                : "0 8px 20px rgba(0,0,0,.18)",
              animation: online ? "scOnlinePulse 2.4s ease-in-out infinite" : "none",
            }}
            onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.08)"}
            onMouseLeave={e => e.currentTarget.style.filter = ""}
            onMouseDown={e  => e.currentTarget.style.transform = "scale(.97)"}
            onMouseUp={e    => e.currentTarget.style.transform = ""}
          >
            <Power size={15} strokeWidth={2.6} fill={online ? "#fff" : "transparent"}/>
            {online ? "Online" : "Go online"}
          </button>
        )}

        {/* On-trip mini indicator */}
        {activeTrip && (
          <div style={{
            flexShrink: 0,
            width: 48, height: 48, borderRadius: 14,
            background: "rgba(34,197,94,0.15)",
            border: "1.5px solid rgba(34,197,94,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
          }}>
            <Zap size={20} color="#4ADE80" fill="#4ADE80" strokeWidth={2}/>
            <div style={{
              position: "absolute", inset: -6, borderRadius: 18,
              border: "2px solid rgba(34,197,94,0.4)",
              animation: "scRadar 2s ease-out infinite",
              pointerEvents: "none",
            }}/>
          </div>
        )}
      </div>
    </div>
  );
}
scheduledRides 
(6) [{…}, {…}, {…}, {…}, {…}, {…}]
0
: 
{id: '1T0rQvkIpRYQaNyTm8lx', dropoffLng: -82.70293029999999, driverInfo: null, timeoutMinutes: 10, apologyEmailSentAt: Timestamp, …}
1
: 
{id: 'BCCx17PgJoEmjMnJZ6dK', dropoffLng: -81.4725685, driverInfo: null, timeoutMinutes: 10, apologyEmailSentAt: Timestamp, …}
2
: 
{id: 'CCORFoKt5s5npoTRCNqo', emailDispatchStarted: true, adminNotified: true, lastPushAt: Timestamp, fareBreakdown: {…}, …}
3
: 
{id: 'PlzVo8BNK7YNtJxqkYEP', dropoffLng: -79.8865932, driverInfo: null, timeoutMinutes: 10, requestSentAt: Timestamp, …}
4
: 
{id: 'navuZiRgaxX3gK4YnWIr', pickupCity: 'Orlando', approvedDriversEmailedAt: Timestamp, pickupLng: -81.3104595, emailDispatchAt: Timestamp, …}
5
: 
{id: 'vBxXLEArYcXWayvUmBBc', dropoffLat: 34.307222, driverPayout: 11.66, status: 'cancelled', pushDispatchAt: Timestamp, …}
length
: 
6
[[Prototype]]
: 
Array(0)