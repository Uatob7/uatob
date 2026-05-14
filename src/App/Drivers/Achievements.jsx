import { useMemo, useState } from 'react';
import {
  Car, Wallet, Award, MessageSquare, Trophy, Star,
  Flame, Sparkles, Lock, Target, CheckCircle2,
  Zap, Crown, ChevronRight, ChevronUp,
} from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';

/**
 * Achievements v2 — gamified milestone tracker.
 * Dark, cinematic, card-forward design.
 *
 * Props:
 *   driver    — driver doc
 *   onSeeAll  — (optional) handler for "See all" tap
 */
export default function Achievements({ driver, onSeeAll }) {
  if (!driver) return null;

  const [showAll, setShowAll] = useState(false);
  const [activeId, setActiveId] = useState(null);

  const totalTrips    = driver.totalRides   || 0;
  const reviewsCount  = driver.totalReviews || 0;
  const avgRating     = driver.averageRating || 0;
  const payoutReady   = !!driver.payoutMethod || driver.transferCapability === 'enabled';
  const monthEarnings = driver.earnings?.month?.earnings ?? 0;

  const BADGES = useMemo(() => [
    {
      id: 'first_ride',
      icon: Car,
      label: 'First Ride',
      sub: 'Complete your first ride',
      color: '#60A5FA',
      glow: 'rgba(96,165,250,0.45)',
      target: 1,
      current: totalTrips,
      tier: 'starter',
    },
    {
      id: 'deposit',
      icon: Wallet,
      label: 'Payout Ready',
      sub: 'Connect your bank account',
      color: '#34D399',
      glow: 'rgba(52,211,153,0.45)',
      target: 1,
      current: payoutReady ? 1 : 0,
      tier: 'starter',
    },
    {
      id: 'first_review',
      icon: Star,
      label: '5 Stars',
      sub: 'Earn your first review',
      color: '#FBBF24',
      glow: 'rgba(251,191,36,0.45)',
      target: 1,
      current: reviewsCount,
      tier: 'starter',
    },
    {
      id: 'ten_rides',
      icon: Flame,
      label: 'Hot Streak',
      sub: '10 completed rides',
      color: '#FB923C',
      glow: 'rgba(251,146,60,0.45)',
      target: 10,
      current: totalTrips,
      tier: 'bronze',
    },
    {
      id: 'fifty_rides',
      icon: Trophy,
      label: 'Veteran',
      sub: '50 completed rides',
      color: '#A78BFA',
      glow: 'rgba(167,139,250,0.45)',
      target: 50,
      current: totalTrips,
      tier: 'silver',
    },
    {
      id: 'hundred_rides',
      icon: Award,
      label: 'Centurion',
      sub: '100 completed rides',
      color: '#F87171',
      glow: 'rgba(248,113,113,0.45)',
      target: 100,
      current: totalTrips,
      tier: 'gold',
    },
    {
      id: 'month_earner',
      icon: Zap,
      label: 'Big Month',
      sub: '$500 earned in a month',
      color: '#22D3EE',
      glow: 'rgba(34,211,238,0.45)',
      target: 500,
      current: monthEarnings,
      tier: 'silver',
      isMoney: true,
    },
    {
      id: 'elite_rating',
      icon: Crown,
      label: 'Elite',
      sub: '4.9★ average rating',
      color: '#FCD34D',
      glow: 'rgba(252,211,77,0.45)',
      target: 4.9,
      current: avgRating,
      tier: 'gold',
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

  const nextUp = useMemo(() => {
    const unearned = BADGES.filter(b => !b.earned);
    if (!unearned.length) return null;
    return unearned.sort((a, b) => b.progress - a.progress)[0];
  }, [BADGES]);

  const sortedBadges = useMemo(() => [...BADGES].sort((a, b) => {
    if (a.earned && !b.earned) return -1;
    if (!a.earned && b.earned) return 1;
    if (!a.earned && !b.earned) return b.progress - a.progress;
    return 0;
  }), [BADGES]);

  const visibleBadges = showAll ? sortedBadges : sortedBadges.slice(0, 4);

  return (
    <div style={{
      borderRadius: 22,
      overflow: 'hidden',
      background: '#0C1210',
      border: '1px solid rgba(255,255,255,0.07)',
      boxShadow: '0 24px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)',
      animation: 'achReveal .45s ease-out both',
    }}>
      <style>{`
        @keyframes achReveal {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes achShimmer {
          0%   { background-position:-200% 0; }
          100% { background-position:200% 0; }
        }
        @keyframes achProgressGrow {
          from { width:0%; }
        }
        @keyframes achPulseGlow {
          0%,100% { opacity:.6; transform:scale(1); }
          50%     { opacity:1;  transform:scale(1.08); }
        }
        @keyframes achStarSpin {
          0%   { transform:rotate(0deg) scale(1); }
          50%  { transform:rotate(15deg) scale(1.2); }
          100% { transform:rotate(0deg) scale(1); }
        }
        @keyframes achBadgeIn {
          from { opacity:0; transform:scale(.8) translateY(6px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
        @keyframes achSweep {
          from { transform:scaleX(0); }
          to   { transform:scaleX(1); }
        }
        @keyframes achLockBounce {
          0%,100% { transform:translateY(0); }
          50%     { transform:translateY(-2px); }
        }
      `}</style>

      {/* ── Top section: dark header ── */}
      <div style={{
        padding: '20px 20px 0',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        paddingBottom: 18,
      }}>

        {/* Header row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            {/* Trophy icon with glow */}
            <div style={{
              width: 36, height: 36, borderRadius: 12,
              background: 'linear-gradient(135deg,#FCD34D 0%,#D97706 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(252,211,77,0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
              flexShrink: 0,
            }}>
              <Trophy size={16} color="#fff" strokeWidth={2.2} fill="#fff"/>
            </div>
            <div>
              <div style={{
                fontSize: 15, fontWeight: 900, color: 'rgba(255,255,255,0.95)',
                letterSpacing: '-0.3px', lineHeight: 1.1,
                fontFamily: 'system-ui, sans-serif',
              }}>
                Achievements
              </div>
              <div style={{
                fontSize: 11, fontWeight: 600, marginTop: 1,
                color: 'rgba(255,255,255,0.35)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {earnedCount} / {totalCount} unlocked
              </div>
            </div>
          </div>

          {/* Progress fraction pill */}
          <div style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 100,
            padding: '5px 12px',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: overallPct === 100 ? '#FCD34D' : '#22C55E',
              boxShadow: overallPct === 100
                ? '0 0 8px rgba(252,211,77,0.8)'
                : '0 0 8px rgba(34,197,94,0.7)',
              animation: 'achPulseGlow 2s ease-in-out infinite',
            }}/>
            <span style={{
              fontSize: 11, fontWeight: 800,
              color: 'rgba(255,255,255,0.85)',
              fontVariantNumeric: 'tabular-nums',
              fontFamily: 'monospace',
            }}>
              {overallPct}%
            </span>
          </div>
        </div>

        {/* ── Overall progress track ── */}
        <div style={{
          height: 6, borderRadius: 100,
          background: 'rgba(255,255,255,0.07)',
          overflow: 'hidden', position: 'relative',
        }}>
          <div style={{
            height: '100%',
            width: `${overallPct}%`,
            borderRadius: 100,
            background: 'linear-gradient(90deg,#FCD34D,#F59E0B,#FCD34D)',
            backgroundSize: '200% 100%',
            animation: 'achProgressGrow .9s cubic-bezier(.34,1.2,.64,1) both, achShimmer 3s linear infinite',
            boxShadow: '0 0 10px rgba(252,211,77,0.5)',
            transformOrigin: 'left',
          }}/>
        </div>
      </div>

      {/* ── Next Up hero card ── */}
      {nextUp && (
        <div style={{
          margin: '0',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: `linear-gradient(135deg, ${nextUp.color}12 0%, transparent 60%)`,
          position: 'relative', overflow: 'hidden',
        }}>
          {/* BG diagonal accent */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `repeating-linear-gradient(135deg, transparent, transparent 24px, ${nextUp.color}06 24px, ${nextUp.color}06 25px)`,
            pointerEvents: 'none',
          }}/>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 2,
            marginBottom: 10,
          }}>
            <Target size={9} color={nextUp.color} strokeWidth={2.5}/>
            <span style={{
              fontSize: 9, fontWeight: 900, letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: nextUp.color,
              fontFamily: 'monospace',
              marginLeft: 4,
            }}>
              Next Up
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
            {/* Icon */}
            <div style={{
              width: 52, height: 52, borderRadius: 16, flexShrink: 0,
              background: `linear-gradient(145deg, ${nextUp.color}22, ${nextUp.color}0A)`,
              border: `1.5px solid ${nextUp.color}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 8px 24px ${nextUp.glow}`,
              position: 'relative',
            }}>
              <nextUp.icon size={22} color={nextUp.color} strokeWidth={2}/>
              {/* Corner sparkle */}
              <div style={{
                position: 'absolute', top: -4, right: -4,
                width: 14, height: 14, borderRadius: '50%',
                background: '#0C1210',
                border: `1.5px solid ${nextUp.color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Lock size={7} color={nextUp.color} strokeWidth={2.5}/>
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 16, fontWeight: 900,
                color: 'rgba(255,255,255,0.92)',
                letterSpacing: '-0.4px', lineHeight: 1.1,
                marginBottom: 3,
              }}>
                {nextUp.label}
              </div>
              <div style={{
                fontSize: 11.5, fontWeight: 500,
                color: 'rgba(255,255,255,0.4)',
                marginBottom: 10, lineHeight: 1.3,
              }}>
                {nextUp.sub}
              </div>

              {/* Progress bar */}
              <div style={{
                height: 5, borderRadius: 100,
                background: 'rgba(255,255,255,0.08)',
                overflow: 'hidden', marginBottom: 6,
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.max(nextUp.progress * 100, 3)}%`,
                  background: `linear-gradient(90deg, ${nextUp.color}80, ${nextUp.color})`,
                  borderRadius: 100,
                  boxShadow: `0 0 8px ${nextUp.color}60`,
                  transition: 'width .6s cubic-bezier(.34,1.2,.64,1)',
                }}/>
              </div>

              {/* Progress label */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{
                  fontSize: 10.5, fontWeight: 700,
                  color: nextUp.color,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {nextUp.isRating
                    ? `${Number(nextUp.current).toFixed(1)}★ of ${nextUp.target}★`
                    : nextUp.isMoney
                      ? `$${Number(nextUp.current).toFixed(0)} of $${nextUp.target}`
                      : `${Math.floor(nextUp.current)} of ${nextUp.target}`}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: 'rgba(255,255,255,0.3)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {nextUp.isMoney
                    ? `$${Math.max(nextUp.target - nextUp.current, 0).toFixed(0)} to go`
                    : nextUp.isRating
                      ? `${Math.max(nextUp.target - nextUp.current, 0).toFixed(1)}★ to go`
                      : `${Math.max(Math.ceil(nextUp.target - nextUp.current), 0)} to go`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Badge grid ── */}
      <div style={{ padding: '16px 20px 4px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
        }}>
          {visibleBadges.map((b, i) => (
            <BadgeCard
              key={b.id}
              badge={b}
              index={i}
              active={activeId === b.id}
              onTap={() => setActiveId(activeId === b.id ? null : b.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Show more / less ── */}
      <div style={{ padding: '10px 20px 18px' }}>
        <button
          onClick={() => { setShowAll(p => !p); if (!showAll && onSeeAll) onSeeAll(); }}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 12,
            padding: '10px 0',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.5)',
            fontSize: 12, fontWeight: 700,
            transition: 'all .18s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.09)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
          }}
        >
          {showAll ? <ChevronUp size={13} strokeWidth={2.4}/> : <ChevronRight size={13} strokeWidth={2.4}/>}
          {showAll ? 'Show less' : `Show all ${totalCount} achievements`}
        </button>
      </div>

      {/* ── All earned ── */}
      {earnedCount === totalCount && (
        <div style={{
          margin: '0 20px 20px',
          background: 'linear-gradient(135deg,rgba(252,211,77,0.12),rgba(245,158,11,0.06))',
          border: '1.5px solid rgba(252,211,77,0.3)',
          borderRadius: 14,
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Crown size={18} color="#FCD34D" fill="#FCD34D" strokeWidth={1.5}/>
          <span style={{
            fontSize: 13, fontWeight: 800,
            color: 'rgba(252,211,77,0.9)',
            letterSpacing: '-0.2px',
          }}>
            Legendary — all achievements unlocked!
          </span>
        </div>
      )}
    </div>
  );
}

// ── Single badge card ─────────────────────────────────────────────────
function BadgeCard({ badge, index, active, onTap }) {
  const Icon = badge.icon;
  const { color, glow, label, earned, progress, target, current, isRating, isMoney } = badge;

  return (
    <div
      onClick={onTap}
      style={{
        background: earned
          ? `linear-gradient(155deg, ${color}18 0%, ${color}08 100%)`
          : 'rgba(255,255,255,0.03)',
        border: earned
          ? `1px solid ${color}35`
          : '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
        padding: '14px 6px 12px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all .2s cubic-bezier(.34,1.2,.64,1)',
        animation: `achBadgeIn .4s cubic-bezier(.34,1.2,.64,1) ${0.05 + index * 0.06}s both`,
        position: 'relative', overflow: 'hidden',
        boxShadow: earned
          ? `0 4px 20px ${glow}, inset 0 1px 0 rgba(255,255,255,0.06)`
          : 'inset 0 1px 0 rgba(255,255,255,0.04)',
        transform: active ? 'scale(0.95)' : 'scale(1)',
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
          e.currentTarget.style.boxShadow = earned
            ? `0 8px 28px ${glow}`
            : '0 4px 16px rgba(0,0,0,0.3)';
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = active ? 'scale(0.95)' : 'scale(1)';
        e.currentTarget.style.boxShadow = earned
          ? `0 4px 20px ${glow}, inset 0 1px 0 rgba(255,255,255,0.06)`
          : 'inset 0 1px 0 rgba(255,255,255,0.04)';
      }}
    >
      {/* Earned checkmark */}
      {earned && (
        <div style={{
          position: 'absolute', top: 6, right: 6,
          width: 14, height: 14, borderRadius: '50%',
          background: '#16A34A',
          border: '1.5px solid rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(22,163,74,0.5)',
        }}>
          <CheckCircle2 size={8} color="#fff" strokeWidth={3}/>
        </div>
      )}

      {/* Icon medallion */}
      <div style={{
        position: 'relative',
        width: 40, height: 40, borderRadius: '50%',
        background: earned
          ? `radial-gradient(circle at 35% 35%, ${color}, ${color}99)`
          : 'rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 9px',
        boxShadow: earned
          ? `0 6px 20px ${glow}, inset 0 1px 0 rgba(255,255,255,0.3)`
          : 'none',
        animation: earned ? 'achPulseGlow 3s ease-in-out infinite' : 'none',
      }}>
        {earned
          ? <Icon size={17} color="#fff" strokeWidth={2}/>
          : <Lock size={13} color="rgba(255,255,255,0.2)" strokeWidth={2}
              style={{ animation: 'achLockBounce 3s ease-in-out infinite' }}
            />
        }
        {/* Sparkle on earned */}
        {earned && (
          <Sparkles
            size={9}
            style={{
              position: 'absolute', top: -3, right: -3,
              color: '#FCD34D',
              filter: 'drop-shadow(0 0 3px rgba(252,211,77,0.8))',
              animation: 'achStarSpin 2.5s ease-in-out infinite',
            }}
            fill="#FCD34D"
            strokeWidth={0}
          />
        )}
      </div>

      {/* Label */}
      <div style={{
        fontSize: 10, fontWeight: 800,
        color: earned ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)',
        letterSpacing: '.1px',
        lineHeight: 1.2,
        marginBottom: earned ? 0 : 7,
        minHeight: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {label}
      </div>

      {/* Unearned progress */}
      {!earned && (
        <>
          <div style={{
            height: 3, borderRadius: 100,
            background: 'rgba(255,255,255,0.07)',
            overflow: 'hidden', margin: '0 auto', width: '80%',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.max(progress * 100, 3)}%`,
              background: `linear-gradient(90deg, ${color}60, ${color})`,
              borderRadius: 100,
              transition: 'width .5s cubic-bezier(.34,1.2,.64,1)',
            }}/>
          </div>
          <div style={{
            fontSize: 9, fontWeight: 700,
            color: 'rgba(255,255,255,0.22)',
            marginTop: 5,
            fontVariantNumeric: 'tabular-nums',
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
