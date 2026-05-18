import { useMemo, useState, useEffect } from 'react';
import { Sun, X, BellRing, WifiOff } from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';

const ONLINE_MESSAGE  = "You're online — sit back and relax. We'll notify you the moment a ride is ready. Go grab a coffee ☕";
const OFFLINE_MESSAGE = "UaTob needs you online! The more drivers on the road, the more rides we can offer. Jump back on when you're ready 🚗";

export default function StatTiles({ earnings, online }) {
  const [msgVisible, setMsgVisible] = useState(true);
  const [closing,    setClosing]    = useState(false);

  const accentColor = online ? C.onlineGreen : C.text;

  const today          = earnings?.today ?? {};
  const week           = earnings?.week  ?? {};
  const dailyBreakdown = Array.isArray(week.dailyBreakdown) ? week.dailyBreakdown : [];
  const todayEarnings  = Number(today.earnings ?? 0);
  const todayTrips     = Number(today.trips    ?? 0);

  const weekSoFar = useMemo(() =>
    dailyBreakdown.reduce((sum, d) => sum + (Number(d?.amount) || 0), 0),
  [dailyBreakdown]);

  const maxBar = useMemo(() => {
    if (!dailyBreakdown.length) return 1;
    return Math.max(...dailyBreakdown.map(d => Number(d?.amount) || 0), 1);
  }, [dailyBreakdown]);

  // Re-show the banner every time online state flips
  useEffect(() => {
    setClosing(false);
    setMsgVisible(true);
  }, [online]);

  function dismissMessage() {
    setClosing(true);
    setTimeout(() => setMsgVisible(false), 260);
  }

  const isOnline   = online;
  const message    = isOnline ? ONLINE_MESSAGE : OFFLINE_MESSAGE;
  const label      = isOnline ? "You're live"  : "You're offline";
  const iconColor  = isOnline ? "#15803D"      : "#6B7280";
  const iconBg     = isOnline
    ? "linear-gradient(135deg,#22C55E,#15803d)"
    : "linear-gradient(135deg,#9CA3AF,#6B7280)";
  const iconShadow = isOnline
    ? "0 4px 10px rgba(22,163,74,0.35)"
    : "0 4px 10px rgba(0,0,0,0.15)";
  const bannerBg   = isOnline
    ? "linear-gradient(120deg, rgba(22,163,74,0.13) 0%, rgba(22,163,74,0.07) 100%)"
    : "rgba(0,0,0,0.04)";
  const bannerBorder = isOnline
    ? "1px solid rgba(22,163,74,0.25)"
    : `1px solid ${C.border}`;
  const dismissBg  = isOnline ? "rgba(22,163,74,0.15)" : "rgba(0,0,0,0.07)";

  return (
    <div>
      <style>{`
        @keyframes stRevealUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes stBarGrow {
          from { transform: scaleY(0.05); }
          to   { transform: scaleY(1); }
        }
        @keyframes msgSlideIn {
          from { opacity: 0; transform: translateY(-6px); max-height: 0; }
          to   { opacity: 1; transform: translateY(0);    max-height: 140px; }
        }
        @keyframes msgSlideOut {
          from { opacity: 1; transform: translateY(0);    max-height: 140px; }
          to   { opacity: 0; transform: translateY(-4px); max-height: 0; }
        }
        @keyframes bellRing {
          0%,100% { transform: rotate(0deg) scale(1); }
          15%     { transform: rotate(-18deg) scale(1.1); }
          30%     { transform: rotate(14deg) scale(1.1); }
          45%     { transform: rotate(-10deg) scale(1.05); }
          60%     { transform: rotate(7deg) scale(1.05); }
          75%     { transform: rotate(-4deg) scale(1); }
        }
        @keyframes wifiPulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50%     { opacity: .55; transform: scale(.9); }
        }
      `}</style>

      <div
        style={{
          background: online
            ? "linear-gradient(135deg,#F0FDF4 0%,#DCFCE7 50%,#F0FDF4 100%)"
            : "linear-gradient(135deg,#FAFAF7 0%,#F5F5F0 50%,#FAFAF7 100%)",
          border: online
            ? "1.5px solid rgba(22,163,74,.28)"
            : `1.5px solid ${C.border}`,
          borderRadius: 22,
          padding: "20px 22px 18px",
          position: "relative",
          overflow: "hidden",
          boxShadow: online
            ? "0 8px 28px rgba(22,163,74,.12), 0 1px 3px rgba(22,163,74,.06)"
            : `0 4px 16px ${C.shadow}`,
          animation: "stRevealUp .4s ease-out .1s both",
        }}
      >
        {/* Decorative stripes */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backgroundImage: online
              ? "repeating-linear-gradient(45deg,transparent,transparent 60px,rgba(22,163,74,.04) 60px,rgba(22,163,74,.04) 61px)"
              : "repeating-linear-gradient(45deg,transparent,transparent 60px,rgba(0,0,0,.012) 60px,rgba(0,0,0,.012) 61px)",
          }}
        />

        {/* Green glow (online only) */}
        {online && (
          <div
            style={{
              position: "absolute",
              top: -50, right: -50,
              width: 160, height: 160,
              borderRadius: "50%",
              pointerEvents: "none",
              background: "radial-gradient(circle, rgba(22,163,74,.18) 0%, transparent 70%)",
            }}
          />
        )}

        <div style={{ position: "relative" }}>
          {/* Header row */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              {/* Today pill */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  marginBottom: 6,
                  padding: "3px 9px",
                  borderRadius: 100,
                  background: online ? "rgba(22,163,74,.12)" : C.surfaceAlt,
                  border: `1px solid ${online ? "rgba(22,163,74,.2)" : C.border}`,
                }}
              >
                <Sun size={10} color={accentColor} strokeWidth={2.4} />
                <span
                  className="mono"
                  style={{
                    fontSize: 9.5, fontWeight: 800,
                    letterSpacing: ".1em", textTransform: "uppercase",
                    color: accentColor,
                  }}
                >
                  Today
                </span>
              </div>

              {/* Earnings */}
              <div
                className="condensed"
                style={{
                  fontSize: 38, fontWeight: 900,
                  color: C.text, letterSpacing: "-1px",
                  lineHeight: 1, fontVariantNumeric: "tabular-nums",
                }}
              >
                ${todayEarnings.toFixed(2)}
              </div>

              {/* Meta */}
              <div
                style={{
                  fontSize: 12, fontWeight: 600,
                  color: C.textMid, marginTop: 5,
                  lineHeight: 1.45, wordBreak: "break-word",
                }}
              >
                {todayTrips} trip{todayTrips !== 1 ? "s" : ""}
                {weekSoFar > 0 && (
                  <>
                    <span style={{ margin: "0 6px", color: C.textDim }}>·</span>
                    <span style={{ color: online ? "#15803D" : C.textMid }}>
                      ${weekSoFar.toFixed(2)} this week
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Sparkline */}
            {dailyBreakdown.length > 0 && (
              <div
                style={{
                  display: "flex", alignItems: "flex-end",
                  gap: 3, height: 38, flexShrink: 0, paddingTop: 4,
                }}
              >
                {dailyBreakdown.map((d, i) => {
                  const isFuture = d?.amount == null;
                  const amt = Number(d?.amount) || 0;
                  const pct = isFuture
                    ? 6
                    : Math.max((amt / maxBar) * 100, amt > 0 ? 12 : 6);

                  return (
                    <div
                      key={d?.day ?? i}
                      style={{
                        width: 6,
                        height: `${pct}%`,
                        minHeight: 4,
                        borderRadius: "2px 2px 1px 1px",
                        background: isFuture
                          ? C.border
                          : d?.isToday
                            ? online
                              ? "linear-gradient(180deg,#22C55E,#16A34A)"
                              : "linear-gradient(180deg,#374151,#111827)"
                            : amt > 0
                              ? online ? "rgba(22,163,74,.3)" : C.border
                              : C.surfaceAlt,
                        opacity: isFuture ? 0.4 : 1,
                        transformOrigin: "bottom",
                        animation: `stBarGrow .5s cubic-bezier(.34,1.2,.64,1) ${0.2 + i * 0.04}s both`,
                        boxShadow: d?.isToday && !isFuture
                          ? online
                            ? "0 2px 6px rgba(22,163,74,.35)"
                            : "0 2px 6px rgba(0,0,0,.15)"
                          : "none",
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Banner */}
          {msgVisible && (
            <div
              style={{
                marginTop: 2,
                borderRadius: 14,
                overflow: "hidden",
                animation: closing
                  ? "msgSlideOut .26s ease forwards"
                  : "msgSlideIn .4s cubic-bezier(.34,1.2,.64,1) .25s both",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: bannerBg,
                  border: bannerBorder,
                  borderRadius: 14,
                  padding: "10px 12px 10px 11px",
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: 32, height: 32,
                    borderRadius: 10, flexShrink: 0,
                    background: iconBg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: iconShadow,
                  }}
                >
                  {isOnline
                    ? <BellRing size={15} color="#fff" strokeWidth={2.2} style={{ animation: "bellRing 3s ease-in-out infinite" }} />
                    : <WifiOff  size={15} color="#fff" strokeWidth={2.2} style={{ animation: "wifiPulse 2s ease-in-out infinite" }} />
                  }
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 9, fontWeight: 800,
                      letterSpacing: ".1em", textTransform: "uppercase",
                      color: iconColor, marginBottom: 2,
                      fontFamily: "monospace",
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      fontSize: 12, fontWeight: 600,
                      color: C.text, lineHeight: 1.4,
                    }}
                  >
                    {message}
                  </div>
                </div>

                {/* Dismiss */}
                <button
                  aria-label="Dismiss"
                  onClick={dismissMessage}
                  style={{
                    width: 22, height: 22, flexShrink: 0,
                    borderRadius: "50%", border: "none",
                    background: dismissBg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", padding: 0,
                  }}
                >
                  <X size={11} color={iconColor} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
