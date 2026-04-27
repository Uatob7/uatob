import { useMemo } from 'react';
import {
  Car, Wallet, Award, MessageSquare, Trophy, Star,
  Flame, Sparkles, Lock, ChevronRight, Target, CheckCircle2,
  Zap, Crown,
} from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';

/**
 * Achievements — gamified milestone tracker.
 *
 * Props:
 *   driver        — driver doc
 *   onSeeAll      — (optional) handler for "See all" tap
 */
export default function Achievements({ driver, onSeeAll }) {
  if (!driver) return null;

  const totalTrips    = driver.totalRides   || 0;
  const reviewsCount  = driver.totalReviews || 0;
  const avgRating     = driver.averageRating || 0;
  const payoutReady   = !!driver.payoutMethod || driver.transferCapability === "enabled";
  const monthEarnings = driver.earnings?.month?.earnings ?? 0;
  const online        = driver.status === "online";

  // ── Achievement definitions with progress targets ───────────────────
  const BADGES = useMemo(() => [
    {
      id: "first_ride",
      icon: Car,
      label: "First Ride",
      sub: "Complete 1 ride",
      color: "#3B82F6",
      target: 1,
      current: totalTrips,
      tier: "starter",
    },
    {
      id: "deposit",
      icon: Wallet,
      label: "Payout Ready",
      sub: "Connect your bank",
      color: "#16A34A",
      target: 1,
      current: payoutReady ? 1 : 0,
      tier: "starter",
    },
    {
      id: "first_review",
      icon: Star,
      label: "5 Stars",
      sub: "Earn your first review",
      color: "#D97706",
      target: 1,
      current: reviewsCount,
      tier: "starter",
    },
    {
      id: "ten_rides",
      icon: Flame,
      label: "Hot Streak",
      sub: "10 completed rides",
      color: "#EA580C",
      target: 10,
      current: totalTrips,
      tier: "bronze",
    },
    {
      id: "fifty_rides",
      icon: Trophy,
      label: "Veteran",
      sub: "50 completed rides",
      color: "#7C3AED",
      target: 50,
      current: totalTrips,
      tier: "silver",
    },
    {
      id: "hundred_rides",
      icon: Award,
      label: "Centurion",
      sub: "100 completed rides",
      color: "#DC2626",
      target: 100,
      current: totalTrips,
      tier: "gold",
    },
    {
      id: "month_earner",
      icon: Sparkles,
      label: "Big Month",
      sub: "$500 in a month",
      color: "#0891B2",
      target: 500,
      current: monthEarnings,
      tier: "silver",
      isMoney: true,
    },
    {
      id: "elite_rating",
      icon: Crown,
      label: "Elite",
      sub: "4.9★ avg rating",
      color: "#B45309",
      target: 4.9,
      current: avgRating,
      tier: "gold",
      isRating: true,
    },
  ].map(b => {
    const earned   = b.current >= b.target;
    const progress = Math.min(b.current / b.target, 1);
    return { ...b, earned, progress };
  }), [totalTrips, reviewsCount, avgRating, payoutReady, monthEarnings]);

  const earnedCount = BADGES.filter(b => b.earned).length;
  const totalCount  = BADGES.length;
  const overallPct  = Math.round((earnedCount / totalCount) * 100);

  // Find "next up" — the unearned badge closest to completion
  const nextUp = useMemo(() => {
    const unearned = BADGES.filter(b => !b.earned);
    if (!unearned.length) return null;
    return unearned.sort((a, b) => b.progress - a.progress)[0];
  }, [BADGES]);

  // Sort: earned first (most recent likely first in array), then by progress
  const sortedBadges = useMemo(() => {
    return [...BADGES].sort((a, b) => {
      if (a.earned && !b.earned) return -1;
      if (!a.earned && b.earned) return 1;
      if (!a.earned && !b.earned) return b.progress - a.progress;
      return 0;
    });
  }, [BADGES]);

  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 22,
      padding: "20px",
      boxShadow: `0 2px 10px ${C.shadow}`,
      animation: "achReveal .4s ease-out both",
    }}>
      <style>{`
        @keyframes achReveal {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes achShimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes achEarnedPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.06); }
        }
        @keyframes achStarTwinkle {
          0%, 100% { opacity: 0.7; transform: rotate(-12deg) scale(1); }
          50%      { opacity: 1; transform: rotate(-12deg) scale(1.15); }
        }
        @keyframes achProgressGrow {
          from { width: 0%; }
        }
      `}</style>

      {/* ── Header row ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: "linear-gradient(135deg,#FCD34D,#F59E0B)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(245,158,11,0.35)",
          }}>
            <Trophy size={15} color="#fff" strokeWidth={2.4} fill="#fff"/>
          </div>
          <div>
            <div className="condensed" style={{
              fontSize: 16, fontWeight: 900, color: C.text,
              letterSpacing: "-0.3px", lineHeight: 1.1,
            }}>
              Achievements
            </div>
            <div style={{
              fontSize: 11, color: C.textDim, fontWeight: 600, marginTop: 1,
              fontVariantNumeric: "tabular-nums",
            }}>
              {earnedCount} of {totalCount} earned
            </div>
          </div>
        </div>

        <div
          onClick={onSeeAll}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            background: C.surfaceAlt,
            border: `1px solid ${C.border}`,
            borderRadius: 100, padding: "5px 11px",
            cursor: onSeeAll ? "pointer" : "default",
            transition: "all .15s",
          }}
          onMouseEnter={e => {
            if (!onSeeAll) return;
            e.currentTarget.style.background = C.text;
            e.currentTarget.style.color = "#fff";
            e.currentTarget.style.borderColor = C.text;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = C.surfaceAlt;
            e.currentTarget.style.color = "";
            e.currentTarget.style.borderColor = C.border;
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 800, color: "inherit" }}>
            See all
          </span>
          <ChevronRight size={11} strokeWidth={2.4}/>
        </div>
      </div>

      {/* ── Overall progress bar ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          height: 8,
          background: C.surfaceAlt,
          borderRadius: 100, overflow: "hidden",
          position: "relative",
        }}>
          <div style={{
            height: "100%",
            width: `${overallPct}%`,
            background: "linear-gradient(90deg,#FCD34D,#F59E0B,#FCD34D)",
            backgroundSize: "200% 100%",
            borderRadius: 100,
            animation: `achProgressGrow .8s cubic-bezier(.34,1.2,.64,1), achShimmer 3s linear infinite`,
            boxShadow: "0 1px 4px rgba(245,158,11,0.4)",
          }}/>
        </div>
      </div>

      {/* ── Next up hero (if any unearned) ── */}
      {nextUp && (
        <div style={{
          background: `linear-gradient(135deg, ${nextUp.color}0E, ${nextUp.color}05)`,
          border: `1.5px solid ${nextUp.color}30`,
          borderRadius: 14,
          padding: "12px 14px",
          marginBottom: 14,
          display: "flex", alignItems: "center", gap: 12,
          position: "relative", overflow: "hidden",
        }}>
          {/* Subtle stripe pattern */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `repeating-linear-gradient(45deg,transparent,transparent 30px,${nextUp.color}08 30px,${nextUp.color}08 31px)`,
            pointerEvents: "none",
          }}/>

          <div style={{
            position: "relative",
            width: 40, height: 40, borderRadius: 12,
            background: `linear-gradient(135deg, ${nextUp.color}, ${nextUp.color}DD)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            boxShadow: `0 6px 16px ${nextUp.color}50`,
          }}>
            <nextUp.icon size={18} color="#fff" strokeWidth={2.2}/>
          </div>

          <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6, marginBottom: 4,
            }}>
              <Target size={10} color={nextUp.color} strokeWidth={2.4}/>
              <span className="mono" style={{
                fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em",
                textTransform: "uppercase", color: nextUp.color,
              }}>
                Next up
              </span>
            </div>
            <div className="condensed" style={{
              fontSize: 14, fontWeight: 800, color: C.text,
              letterSpacing: "-0.2px", lineHeight: 1.15, marginBottom: 4,
            }}>
              {nextUp.label}
            </div>
            {/* Inline progress */}
            <div style={{
              height: 5,
              background: `${nextUp.color}15`,
              borderRadius: 100, overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: `${Math.max(nextUp.progress * 100, 4)}%`,
                background: `linear-gradient(90deg, ${nextUp.color}, ${nextUp.color}CC)`,
                borderRadius: 100,
                transition: "width 0.5s cubic-bezier(.34,1.2,.64,1)",
              }}/>
            </div>
            <div style={{
              fontSize: 10.5, fontWeight: 700, color: nextUp.color,
              marginTop: 4,
              fontVariantNumeric: "tabular-nums",
            }}>
              {nextUp.isRating
                ? `${Number(nextUp.current).toFixed(1)}★ / ${nextUp.target}★`
                : nextUp.isMoney
                  ? `$${Number(nextUp.current).toFixed(0)} / $${nextUp.target}`
                  : `${Math.floor(nextUp.current)} / ${nextUp.target}`}
              <span style={{ color: C.textDim, fontWeight: 600, marginLeft: 5 }}>
                · {Math.max(nextUp.target - nextUp.current, 0).toFixed(nextUp.isRating ? 1 : 0)}
                {nextUp.isMoney ? "" : nextUp.isRating ? "★" : ""} to go
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Badge grid ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 8,
      }}>
        {sortedBadges.slice(0, 8).map((b, i) => (
          <BadgeCard key={b.id} badge={b} index={i}/>
        ))}
      </div>

      {/* ── All-earned celebration ── */}
      {earnedCount === totalCount && (
        <div style={{
          marginTop: 14,
          background: "linear-gradient(135deg,#FFFBEB,#FEF3C7)",
          border: "1.5px solid #FCD34D",
          borderRadius: 12,
          padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <Crown size={16} color="#D97706" fill="#FCD34D" strokeWidth={2}/>
          <span className="condensed" style={{
            fontSize: 13, fontWeight: 800, color: "#92400E",
          }}>
            All achievements unlocked — legendary!
          </span>
        </div>
      )}
    </div>
  );
}

// ── Single badge card ──────────────────────────────────────────────
function BadgeCard({ badge, index }) {
  const Icon = badge.icon;
  const { color, label, earned, progress, target, current, isRating, isMoney } = badge;

  const tierMeta = {
    starter: { ring: "transparent",   tier: "" },
    bronze:  { ring: "#CD7F32",       tier: "B" },
    silver:  { ring: "#94A3B8",       tier: "S" },
    gold:    { ring: "#F59E0B",       tier: "G" },
  }[badge.tier] || {};

  return (
    <div
      title={`${label}${earned ? " — Earned!" : ` — ${Math.round(progress * 100)}% complete`}`}
      style={{
        background: earned
          ? `linear-gradient(135deg, ${color}10, ${color}04)`
          : C.surfaceAlt,
        border: earned
          ? `1.5px solid ${color}40`
          : `1px solid ${C.border}`,
        borderRadius: 14,
        padding: "12px 6px 10px",
        textAlign: "center",
        position: "relative",
        cursor: "pointer",
        transition: "all .2s",
        animation: `achReveal .35s ease-out ${0.1 + index * 0.05}s both`,
        overflow: "hidden",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = earned
          ? `0 6px 16px ${color}25`
          : `0 4px 12px rgba(0,0,0,0.06)`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "";
      }}
    >
      {/* Tier ring (top-right) */}
      {earned && tierMeta.tier && (
        <div style={{
          position: "absolute", top: 6, right: 6,
          width: 14, height: 14, borderRadius: "50%",
          background: tierMeta.ring,
          border: "1.5px solid #fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 7, fontWeight: 900, color: "#fff",
          boxShadow: `0 2px 4px ${tierMeta.ring}80`,
        }}>
          {tierMeta.tier}
        </div>
      )}

      {/* Earned checkmark (top-left) */}
      {earned && (
        <div style={{
          position: "absolute", top: 6, left: 6,
          width: 14, height: 14, borderRadius: "50%",
          background: "#16A34A",
          border: "1.5px solid #fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 4px rgba(22,163,74,0.5)",
        }}>
          <CheckCircle2 size={8} color="#fff" strokeWidth={3} fill="#16A34A"/>
        </div>
      )}

      {/* Icon medallion */}
      <div style={{
        position: "relative",
        width: 38, height: 38,
        borderRadius: "50%",
        background: earned
          ? `linear-gradient(135deg, ${color}, ${color}CC)`
          : C.border,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 8px",
        boxShadow: earned ? `0 4px 12px ${color}50` : "none",
        animation: earned && index === 0 ? "achEarnedPulse 2.5s ease-in-out infinite" : "none",
      }}>
        {earned ? (
          <Icon size={17} color="#fff" strokeWidth={2.2}/>
        ) : (
          <Lock size={14} color={C.textDim} strokeWidth={2}/>
        )}

        {/* Sparkle decoration on earned */}
        {earned && (
          <Sparkles
            size={9}
            style={{
              position: "absolute",
              top: -2, right: -2,
              color: "#FCD34D",
              filter: "drop-shadow(0 1px 2px rgba(245,158,11,0.5))",
              animation: "achStarTwinkle 2s ease-in-out infinite",
            }}
            fill="#FCD34D"
            strokeWidth={0}
          />
        )}
      </div>

      {/* Label */}
      <div className="condensed" style={{
        fontSize: 10.5, fontWeight: 800,
        color: earned ? color : C.textDim,
        letterSpacing: ".2px",
        lineHeight: 1.15,
        marginBottom: earned ? 0 : 6,
        height: 22,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {label}
      </div>

      {/* Progress for unearned */}
      {!earned && (
        <>
          <div style={{
            height: 3,
            background: C.border,
            borderRadius: 100, overflow: "hidden",
            margin: "0 auto",
            width: "85%",
          }}>
            <div style={{
              height: "100%",
              width: `${Math.max(progress * 100, 3)}%`,
              background: `linear-gradient(90deg, ${color}80, ${color})`,
              borderRadius: 100,
              transition: "width 0.5s cubic-bezier(.34,1.2,.64,1)",
            }}/>
          </div>
          <div style={{
            fontSize: 9, fontWeight: 700, color: C.textDim,
            marginTop: 4,
            fontVariantNumeric: "tabular-nums",
          }}>
            {isRating
              ? `${Number(current).toFixed(1)}/${target}`
              : isMoney
                ? `$${Math.floor(current)}/$${target}`
                : `${Math.floor(current)}/${target}`}
          </div>
        </>
      )}
    </div>
  );
}