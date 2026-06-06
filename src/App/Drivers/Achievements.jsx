import { useMemo } from 'react';
import {
  Car, Wallet, Star, Sparkles, Crown,
  CreditCard, Banknote, Smartphone, Lock, CheckCircle2, Target,
} from 'lucide-react';

/**
 * Achievements — compact single-badge view for the StatusCard cycling face.
 * StatusCard drives which badge shows via `badgeIdx` (advances one per face visit).
 *
 * Props:
 *   driver    — driver doc
 *   badgeIdx  — index of the badge to display (StatusCard-controlled)
 */
export default function Achievements({ driver, badgeIdx = 0 }) {
  const totalTrips    = driver?.totalRides    || 0;
  const reviewsCount  = driver?.totalReviews  || 0;
  const avgRating     = driver?.averageRating || 0;
  const payoutReady   = !!driver?.payoutMethod || driver?.transferCapability === 'enabled';
  const monthEarnings = driver?.earnings?.month?.earnings ?? 0;

  const hasCashApp  = driver?.paymentMethods?.cashApp === true || driver?.cashAppConnected === true;
  const hasCard     = driver?.paymentMethods?.card    === true || driver?.cardConnected    === true;
  const acceptsCash = driver?.paymentMethods?.cash    === true || driver?.cashEnabled       === true;
  const isTopDriver = avgRating >= 4.9 && totalTrips >= 50;

  const BADGES = useMemo(() => [
    { id:'first_ride',  icon:Car,        label:'First Ride',   sub:'Complete your first ride', color:'#60A5FA', target:1,    current:totalTrips },
    { id:'payout_ready',icon:Wallet,     label:'Payout Ready', sub:'Connect your bank',        color:'#4ADE80', target:1,    current:payoutReady ? 1 : 0 },
    { id:'cash_app',    icon:Smartphone, label:'Cash App',     sub:'Link your Cash App',       color:'#00D632', target:1,    current:hasCashApp ? 1 : 0 },
    { id:'card',        icon:CreditCard, label:'Card Ready',   sub:'Accept card payments',     color:'#818CF8', target:1,    current:hasCard ? 1 : 0 },
    { id:'cash',        icon:Banknote,   label:'Cash Ready',   sub:'Accept cash payments',     color:'#FBBF24', target:1,    current:acceptsCash ? 1 : 0 },
    { id:'five_stars',  icon:Star,       label:'5 Stars',      sub:'Earn your first review',   color:'#F59E0B', target:1,    current:reviewsCount },
    { id:'big_month',   icon:Sparkles,   label:'Big Month',    sub:'$1,000 in a month',        color:'#22D3EE', target:1000, current:monthEarnings, isMoney:true },
    {
      id:'top_driver', icon:Crown, label:'Top Driver', sub:'4.9★ avg & 50 rides', color:'#FB923C',
      target:1, current:isTopDriver ? 1 : 0, isCustomProgress:true,
      displayProgress: Math.min(((avgRating / 4.9) * 0.5) + ((Math.min(totalTrips, 50) / 50) * 0.5), 1),
      displayLabel: `${Number(avgRating).toFixed(1)}★ · ${Math.min(totalTrips, 50)}/50 rides`,
    },
  ].map(b => {
    const earned   = b.current >= b.target;
    const progress = b.isCustomProgress ? b.displayProgress : Math.min(b.current / b.target, 1);
    return { ...b, earned, progress };
  }), [totalTrips, reviewsCount, avgRating, payoutReady, monthEarnings, hasCashApp, hasCard, acceptsCash, isTopDriver]);

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
