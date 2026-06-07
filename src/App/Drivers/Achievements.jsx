import { useMemo } from 'react';
import {
  Car, Star, Sparkles, Crown, Trophy, Landmark, Coins,
  CreditCard, Banknote, Smartphone, Lock, CheckCircle2, Target,
} from 'lucide-react';

/**
 * Achievements — compact single-badge view for the StatusCard cycling face.
 * StatusCard drives which badge shows via `badgeIdx` (advances one per face visit).
 *
 * Badges mirror exactly what `updateDriverAchievements` writes:
 *   counters       → totalRides, cashRides, cashAppRides, cardRides
 *   review fields  → totalReviews, averageRating
 *   flags (map)    → achievements.{ firstRide, hundredRides, hundredCashRides,
 *                    hundredCashAppRides, hundredCardRides, firstReview,
 *                    fiveStarDriver, depositMade, earningsMilestone10 }
 *   misc           → deposit (bool), earnings.month.earnings
 *
 * A badge counts as earned if the backend flag is set OR the live counter
 * already meets target — so it shows instantly and also self-heals if the
 * recompute and the flag ever drift.
 *
 * Props:
 *   driver    — driver doc
 *   badgeIdx  — index of the badge to display (StatusCard-controlled)
 */
export default function Achievements({ driver, badgeIdx = 0 }) {
  const totalRides    = driver?.totalRides    || 0;
  const cashRides     = driver?.cashRides     || 0;
  const cashAppRides  = driver?.cashAppRides  || 0;
  const cardRides     = driver?.cardRides     || 0;
  const totalReviews  = driver?.totalReviews  || 0;
  const avgRating     = driver?.averageRating || 0;
  const monthEarnings = driver?.earnings?.month?.earnings ?? 0;
  const hasDeposit    = driver?.deposit === true;
  const ach           = driver?.achievements || {};

  const isFiveStar = avgRating >= 4.8 && totalReviews >= 10;

  const BADGES = useMemo(() => [
    { id:'first_ride',     achKey:'firstRide',           icon:Car,        label:'First Ride',     sub:'Complete your first ride', color:'#60A5FA', target:1,   current:totalRides },
    { id:'first_review',   achKey:'firstReview',         icon:Star,       label:'First Review',   sub:'Earn your first review',   color:'#F59E0B', target:1,   current:totalReviews },
    { id:'deposit',        achKey:'depositMade',         icon:Landmark,   label:'Deposit Made',   sub:'Add your driver deposit',  color:'#4ADE80', target:1,   current:hasDeposit ? 1 : 0 },
    { id:'earnings_10',    achKey:'earningsMilestone10', icon:Coins,      label:'First $10',      sub:'$10 earned this month',    color:'#22D3EE', target:10,  current:monthEarnings, isMoney:true },
    { id:'hundred_rides',  achKey:'hundredRides',        icon:Trophy,     label:'Century Club',   sub:'Complete 100 rides',       color:'#FB923C', target:100, current:totalRides },
    { id:'hundred_cash',   achKey:'hundredCashRides',    icon:Banknote,   label:'100 Cash Rides', sub:'100 cash-paid rides',      color:'#FBBF24', target:100, current:cashRides },
    { id:'hundred_cashapp',achKey:'hundredCashAppRides', icon:Smartphone, label:'100 Cash App',   sub:'100 Cash App rides',       color:'#00D632', target:100, current:cashAppRides },
    { id:'hundred_card',   achKey:'hundredCardRides',    icon:CreditCard, label:'100 Card Rides', sub:'100 card-paid rides',      color:'#818CF8', target:100, current:cardRides },
    {
      id:'five_star', achKey:'fiveStarDriver', icon:Crown, label:'5-Star Driver', sub:'4.8★ avg over 10 reviews', color:'#F472B6',
      target:1, current:isFiveStar ? 1 : 0, isCustomProgress:true,
      displayProgress: Math.min(
        ((Math.min(avgRating, 4.8) / 4.8) * 0.5) +
        ((Math.min(totalReviews, 10) / 10) * 0.5),
        1
      ),
      displayLabel: `${Number(avgRating).toFixed(1)}★ · ${Math.min(totalReviews, 10)}/10 reviews`,
    },
  ].map(b => {
    const flagged  = ach[b.achKey] === true;
    const earned   = flagged || b.current >= b.target;
    const rawProg  = b.isCustomProgress ? b.displayProgress : Math.min(b.current / b.target, 1);
    const progress = earned ? 1 : rawProg;
    return { ...b, earned, progress };
  }), [totalRides, cashRides, cashAppRides, cardRides, totalReviews, avgRating, monthEarnings, hasDeposit, isFiveStar, ach]);

  const earnedCount = BADGES.filter(b => b.earned).length;
  const badge       = BADGES[((badgeIdx % BADGES.length) + BADGES.length) % BADGES.length];
  const Icon        = badge.icon;

  const progressLabel = badge.earned
    ? 'Unlocked'
    : badge.isCustomProgress ? badge.displayLabel
    : badge.isMoney          ? `$${Math.floor(badge.current)} / $${badge.target}`
    : badge.target === 1     ? badge.sub
    : `${Math.floor(badge.current)} / ${badge.target}`;

  return (
    <div key={badge.id} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <style>{`
        @keyframes acBadgeIn   { from { opacity:0; transform:translateX(8px); } to { opacity:1; transform:none; } }
        @keyframes acTwinkle   { 0%,100% { opacity:.7; transform:scale(1); } 50% { opacity:1; transform:scale(1.18); } }
        @keyframes acGrow      { from { width:0; } }
      `}</style>

      {/* ── Medallion ── */}
      <div style={{
        position: 'relative',
        width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
        background: badge.earned
          ? `linear-gradient(135deg, ${badge.color}, ${badge.color}CC)`
          : 'rgba(255,255,255,.06)',
        border: badge.earned ? 'none' : '1.5px solid rgba(255,255,255,.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: badge.earned ? `0 6px 18px ${badge.color}55` : 'none',
        animation: 'acBadgeIn .35s cubic-bezier(.34,1.2,.64,1)',
      }}>
        {badge.earned
          ? <Icon size={23} color="#fff" strokeWidth={2.2}/>
          : <Lock size={18} color="rgba(255,255,255,.4)" strokeWidth={2}/>
        }
        {badge.earned && (
          <>
            <Sparkles size={11} fill="#FCD34D" strokeWidth={0} style={{
              position: 'absolute', top: -3, right: -3, color: '#FCD34D',
              filter: 'drop-shadow(0 1px 2px rgba(245,158,11,.5))', animation: 'acTwinkle 2s ease-in-out infinite',
            }}/>
            <div style={{
              position: 'absolute', bottom: -3, right: -3,
              width: 18, height: 18, borderRadius: '50%', background: '#16A34A',
              border: '2px solid #0A0A0A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircle2 size={10} color="#fff" strokeWidth={3}/>
            </div>
          </>
        )}
      </div>

      {/* ── Detail ── */}
      <div style={{ flex: 1, minWidth: 0, animation: 'acBadgeIn .35s cubic-bezier(.34,1.2,.64,1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          {!badge.earned && <Target size={10} color={badge.color} strokeWidth={2.4}/>}
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase',
            color: badge.earned ? '#4ADE80' : 'rgba(255,255,255,.3)', fontFamily: '"JetBrains Mono",monospace',
          }}>
            {badge.earned ? `Earned · ${earnedCount}/${BADGES.length}` : 'In progress'}
          </span>
        </div>

        <div className="condensed" style={{
          fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.4px', lineHeight: 1.1, marginBottom: 6,
        }}>
          {badge.label}
        </div>

        {/* Progress bar */}
        <div style={{ height: 5, background: 'rgba(255,255,255,.08)', borderRadius: 100, overflow: 'hidden', marginBottom: 5 }}>
          <div style={{
            height: '100%', width: `${Math.max(badge.progress * 100, 4)}%`,
            background: `linear-gradient(90deg, ${badge.color}, ${badge.color}CC)`,
            borderRadius: 100, boxShadow: `0 0 8px ${badge.color}80`,
            animation: 'acGrow .6s cubic-bezier(.34,1.2,.64,1)',
          }}/>
        </div>

        <div style={{
          fontSize: 10.5, fontWeight: 700, color: badge.earned ? '#4ADE80' : badge.color,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {progressLabel}
        </div>
      </div>
    </div>
  );
}