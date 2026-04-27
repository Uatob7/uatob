import { useState, useMemo } from 'react';
import {
  ArrowDownToLine, BadgeDollarSign, TrendingUp, TrendingDown,
  CheckCircle2, AlertCircle, Loader2, Sparkles, Calendar,
  Banknote, Wallet, ChevronRight, Clock, Flame,
} from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebase_app } from '@/firebase/config';

const functions           = getFunctions(firebase_app, "us-east1");
const callSetupDeposit    = httpsCallable(functions, "setupDeposit");
const callProcessWithdraw = httpsCallable(functions, "processWithdrawal");

// ── Helpers ────────────────────────────────────────────────────────────
function fmtMoney(n) {
  return Number(n ?? 0).toFixed(2);
}

function getTodayLabel() {
  const d = new Date();
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

export default function EarningsTab({ earnings, online, driver, onViewHistory }) {
  const [isSettingUpDeposit, setIsSettingUpDeposit] = useState(false);
  const [isWithdrawing,      setIsWithdrawing]      = useState(false);
  const [feedback,           setFeedback]           = useState(null); // { type, message }

  const accentColor = online ? C.onlineGreen : C.offlineInk;

  const todayEarnings  = earnings?.today?.earnings    ?? 0;
  const todayTrips     = earnings?.today?.trips       ?? 0;
  const weekEarnings   = earnings?.week?.earnings     ?? 0;
  const weekTrips      = earnings?.week?.trips        ?? 0;
  const monthEarnings  = earnings?.month?.earnings    ?? 0;
  const monthTrips     = earnings?.month?.trips       ?? 0;
  const lastWeek       = earnings?.week?.lastWeekEarnings ?? 0;
  const changePercent  = earnings?.week?.changePercent ?? 0;
  const dailyBreakdown = earnings?.week?.dailyBreakdown ?? [];

  const withdrawal     = driver?.transferCapability === "enabled";
  const pendingData    = driver?.withdrawal;
  const totalPayout    = pendingData?.totalPayout ?? 0;
  const rideCount      = pendingData?.rideCount   ?? 0;
  const lastPaidAt     = pendingData?.paidAt;
  const payoutStatus   = pendingData?.status;
  const lastPayoutAmt  = (pendingData?.rideBreakdown ?? [])
    .reduce((s, r) => s + (Number(r.driverPayout) || 0), 0);

  const showSetupGate  = !driver?.accountId || withdrawal !== true;
  const nothingPending = totalPayout === 0;
  const isPaid         = payoutStatus === "paid";

  // ── Compute streak (consecutive earning days) ───────────────────
  const streak = useMemo(() => {
    if (!dailyBreakdown.length) return 0;
    let count = 0;
    // Walk backwards from today, count consecutive days with earnings
    const todayIdx = dailyBreakdown.findIndex(d => d.isToday);
    if (todayIdx === -1) return 0;
    for (let i = todayIdx; i >= 0; i--) {
      const amt = dailyBreakdown[i].amount;
      if (amt != null && amt > 0) count++;
      else break;
    }
    return count;
  }, [dailyBreakdown]);

  const maxAmount = Math.max(...dailyBreakdown.map(d => d.amount ?? 0), 1);
  const weekAvg   = weekTrips > 0 ? weekEarnings / weekTrips : 0;

  // ── Setup deposit ────────────────────────────────────────────────
  const handleSetupDeposit = async () => {
    setIsSettingUpDeposit(true);
    setFeedback(null);
    try {
      const { data } = await callSetupDeposit({ email: driver.email, uid: driver.uid });
      if (data?.success && data?.accountLink) {
        window.location.href = data.accountLink;
      } else {
        setFeedback({ type: "error", message: "Failed to start Stripe onboarding. Please try again." });
        setIsSettingUpDeposit(false);
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: err?.message || "Stripe setup failed. Try again." });
      setIsSettingUpDeposit(false);
    }
  };

  // ── Process withdrawal ───────────────────────────────────────────
  const handleWithdraw = async () => {
    if (nothingPending || isWithdrawing) return;
    setIsWithdrawing(true);
    setFeedback(null);
    try {
      const { data } = await callProcessWithdraw({ uid: driver.uid });
      if (data?.success) {
        setFeedback({
          type: "success",
          message: `$${fmtMoney(data.totalPayout)} sent · ${data.rideCount} ride${data.rideCount !== 1 ? "s" : ""}`,
        });
        setTimeout(() => setFeedback(null), 5000);
      } else {
        setFeedback({ type: "error", message: data?.error || "Withdrawal failed" });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: err?.message || "Withdrawal failed. Try again." });
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, animation: "slideUp .38s ease-out forwards" }}>
      <style>{`
        @keyframes earnSpin { to { transform: rotate(360deg); } }
        @keyframes earnPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(22,163,74,.4); } 50% { box-shadow: 0 0 0 12px rgba(22,163,74,0); } }
        @keyframes earnGlow {
          0%,100% { opacity: .6; transform: scale(1); }
          50%      { opacity: 1;  transform: scale(1.1); }
        }
        @keyframes earnFadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* ── Header ── */}
      <div>
        <div className="condensed" style={{ fontSize: 28, fontWeight: 900, color: C.text, letterSpacing: "-0.5px", lineHeight: 1.1 }}>
          Earnings
        </div>
        <div style={{ fontSize: 12, color: C.textDim, marginTop: 4, fontWeight: 500 }}>
          {getTodayLabel()}
        </div>
      </div>

      {/* ── Hero today's earnings card ── */}
      <div style={{
        background: online
          ? "linear-gradient(135deg,#0F172A,#1E293B 50%,#0F172A)"
          : "linear-gradient(135deg,#1A1A1A,#262626 50%,#1A1A1A)",
        borderRadius: 24,
        padding: "26px 24px 22px",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 12px 40px rgba(0,0,0,0.20), 0 2px 6px rgba(0,0,0,0.08)",
      }}>
        {/* Decorative glow */}
        <div style={{
          position: "absolute", top: -80, right: -80,
          width: 240, height: 240, borderRadius: "50%",
          background: online
            ? "radial-gradient(circle, rgba(34,197,94,0.25) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(148,163,184,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
          animation: "earnGlow 4s ease-in-out infinite",
        }}/>
        {/* Grid */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.05,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          pointerEvents: "none",
        }}/>

        <div style={{ position: "relative" }}>
          {/* Status pill */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 100, padding: "5px 11px",
            marginBottom: 14,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: online ? "#4ADE80" : "#94A3B8",
              boxShadow: online ? "0 0 8px rgba(74,222,128,0.7)" : "none",
              animation: online ? "earnGlow 2s ease-in-out infinite" : "none",
            }}/>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.85)",
            }}>
              Today {online ? "· online" : "· offline"}
            </span>
          </div>

          <div className="mono" style={{
            fontSize: 10, fontWeight: 700, letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.45)", marginBottom: 6,
          }}>
            Today's earnings
          </div>

          <div style={{
            display: "flex", alignItems: "baseline", gap: 8,
            marginBottom: 18,
          }}>
            <span className="condensed" style={{
              fontSize: 56, fontWeight: 900, color: "#fff",
              letterSpacing: "-1.5px", lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}>
              ${fmtMoney(todayEarnings)}
            </span>
            <span style={{
              fontSize: 13, color: "rgba(255,255,255,0.55)",
              fontWeight: 600,
            }}>
              · {todayTrips} trip{todayTrips !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Stat row */}
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { label: "Week",   value: `$${fmtMoney(weekEarnings)}`,  sub: `${weekTrips} trips`  },
              { label: "Month",  value: `$${fmtMoney(monthEarnings)}`, sub: `${monthTrips} trips` },
              { label: "Avg/trip", value: `$${fmtMoney(weekAvg)}`,     sub: "this week"           },
            ].map(({ label, value, sub }) => (
              <div key={label} style={{
                flex: 1,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 12, padding: "10px 12px",
                backdropFilter: "blur(12px)",
              }}>
                <div className="mono" style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.45)",
                }}>
                  {label}
                </div>
                <div className="condensed" style={{
                  fontSize: 17, fontWeight: 800, color: "#fff",
                  marginTop: 3, letterSpacing: "-0.3px",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {value}
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 600,
                  color: "rgba(255,255,255,0.5)", marginTop: 1,
                }}>
                  {sub}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Streak indicator (only when active) ── */}
      {streak >= 2 && (
        <div style={{
          background: "linear-gradient(135deg,#FFFBEB,#FEF3C7)",
          border: "1.5px solid #FCD34D",
          borderRadius: 14,
          padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 12,
          animation: "earnFadeIn .35s ease-out",
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "linear-gradient(135deg,#F59E0B,#D97706)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 4px 12px rgba(217,119,6,0.35)",
          }}>
            <Flame size={18} color="#fff" fill="#fff" strokeWidth={2}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="condensed" style={{ fontSize: 14, fontWeight: 800, color: "#92400E" }}>
              {streak}-day streak 🔥
            </div>
            <div style={{ fontSize: 11.5, color: "#B45309", fontWeight: 500, marginTop: 1 }}>
              You've earned every day this week — keep it going!
            </div>
          </div>
        </div>
      )}

      {/* ── Withdrawal flow ── */}
      {showSetupGate ? (
        // ── SETUP GATE ──
        <div style={{
          background: "linear-gradient(135deg,#EFF6FF,#DBEAFE)",
          border: "1.5px solid rgba(37,99,235,.25)",
          borderRadius: 22, padding: "26px 22px",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: -30, right: -30,
            width: 140, height: 140, borderRadius: "50%",
            background: "rgba(37,99,235,0.08)", pointerEvents: "none",
          }}/>

          <div style={{ position: "relative" }}>
            <div style={{
              width: 56, height: 56,
              background: "linear-gradient(135deg,#3B82F6,#2563EB)",
              borderRadius: 16,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 14,
              boxShadow: "0 8px 24px rgba(37,99,235,.35)",
            }}>
              <BadgeDollarSign size={26} color="#fff" strokeWidth={2}/>
            </div>

            <div className="condensed" style={{
              fontSize: 20, fontWeight: 900, color: "#1E3A8A",
              marginBottom: 6, letterSpacing: "-0.3px",
            }}>
              Set up payouts
            </div>
            <div style={{
              fontSize: 13, color: "#1E40AF", fontWeight: 500,
              marginBottom: 18, lineHeight: 1.5,
            }}>
              Connect your bank via Stripe to receive deposits within 24 hours of completing rides.
            </div>

            {feedback?.type === "error" && (
              <div style={{
                background: "#FEF2F2",
                border: "1px solid #FCA5A5",
                borderRadius: 10, padding: "10px 13px",
                marginBottom: 14,
                display: "flex", alignItems: "center", gap: 8,
                animation: "earnFadeIn .25s ease-out",
              }}>
                <AlertCircle size={14} color="#DC2626"/>
                <span style={{ fontSize: 12, color: "#991B1B", fontWeight: 600 }}>
                  {feedback.message}
                </span>
              </div>
            )}

            <button
              onClick={handleSetupDeposit}
              disabled={isSettingUpDeposit}
              style={{
                width: "100%", padding: "14px 20px",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: "linear-gradient(135deg,#3B82F6,#2563EB 50%,#1D4ED8)",
                border: "none", borderRadius: 13, color: "#fff",
                fontFamily: "'Barlow',sans-serif", fontWeight: 800, fontSize: 14.5,
                letterSpacing: ".3px",
                cursor: isSettingUpDeposit ? "not-allowed" : "pointer",
                opacity: isSettingUpDeposit ? 0.7 : 1,
                boxShadow: "0 8px 24px rgba(37,99,235,.4)",
                transition: "filter .15s, transform .1s",
              }}
              onMouseEnter={e => { if (!isSettingUpDeposit) e.currentTarget.style.filter = "brightness(1.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.filter = ""; }}
            >
              {isSettingUpDeposit ? (
                <>
                  <Loader2 size={16} style={{ animation: "earnSpin 0.8s linear infinite" }}/>
                  Redirecting to Stripe…
                </>
              ) : (
                <>
                  <BadgeDollarSign size={16}/>
                  Connect Stripe Account
                </>
              )}
            </button>

            <div style={{
              marginTop: 12,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              fontSize: 11, color: "#1E40AF", fontWeight: 600,
            }}>
              <CheckCircle2 size={11}/>
              Secure · powered by Stripe
            </div>
          </div>
        </div>
      ) : nothingPending ? (
        // ── NOTHING PENDING (paid or never had a balance) ──
        <div style={{
          background: C.surface,
          border: `1.5px solid ${C.border}`,
          borderRadius: 22, padding: "22px 20px",
          position: "relative",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: isPaid ? 14 : 0 }}>
            <div style={{
              width: 48, height: 48,
              background: isPaid ? "#F0FDF4" : C.surfaceAlt,
              border: `1.5px solid ${isPaid ? "rgba(22,163,74,.25)" : C.border}`,
              borderRadius: 14,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              {isPaid
                ? <CheckCircle2 size={22} color={C.onlineGreen} strokeWidth={2}/>
                : <Wallet size={22} color={C.textDim} strokeWidth={2}/>
              }
            </div>
            <div style={{ flex: 1 }}>
              <div className="mono" style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
                {isPaid ? "Last payout" : "No pending balance"}
              </div>
              <div className="condensed" style={{
                fontSize: 32, fontWeight: 900, color: C.text,
                lineHeight: 1, letterSpacing: "-0.5px",
                fontVariantNumeric: "tabular-nums",
              }}>
                ${fmtMoney(isPaid ? lastPayoutAmt : 0)}
              </div>
              {isPaid && lastPaidAt && (
                <div style={{ fontSize: 11.5, color: C.onlineGreen, fontWeight: 600, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <CheckCircle2 size={11}/>
                  Paid {new Date(lastPaidAt?.seconds ? lastPaidAt.seconds * 1000 : lastPaidAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </div>
              )}
              {!isPaid && (
                <div style={{ fontSize: 12, color: C.textDim, fontWeight: 500, marginTop: 4 }}>
                  Complete a ride to see earnings here
                </div>
              )}
            </div>
          </div>

          {isPaid && onViewHistory && (
            <button
              onClick={onViewHistory}
              style={{
                width: "100%", padding: "12px 16px",
                background: C.surfaceAlt,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                cursor: "pointer", fontFamily: "inherit",
                transition: "all .15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.border; }}
              onMouseLeave={e => { e.currentTarget.style.background = C.surfaceAlt; }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                View payout history
              </span>
              <ChevronRight size={15} color={C.textMid}/>
            </button>
          )}
        </div>
      ) : (
        // ── READY TO WITHDRAW ──
        <div style={{
          background: "linear-gradient(135deg,#F0FDF4,#DCFCE7,#F0FDF4)",
          border: "1.5px solid rgba(22,163,74,.3)",
          borderRadius: 22, padding: "24px 22px",
          position: "relative", overflow: "hidden",
          boxShadow: "0 8px 28px rgba(22,163,74,.14)",
        }}>
          <div style={{
            position: "absolute", top: -40, right: -40,
            width: 160, height: 160, borderRadius: "50%",
            background: "rgba(22,163,74,0.10)", pointerEvents: "none",
          }}/>
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 60px,rgba(22,163,74,.04) 60px,rgba(22,163,74,.04) 61px)",
            pointerEvents: "none",
          }}/>

          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
              <div className="mono" style={{
                fontSize: 10, fontWeight: 700, letterSpacing: ".1em",
                textTransform: "uppercase", color: "#15803D",
              }}>
                Available to withdraw
              </div>
              <div style={{
                background: C.onlineGreen,
                color: "#fff",
                borderRadius: 100, padding: "3px 10px",
                fontSize: 9.5, fontWeight: 800, letterSpacing: ".06em",
                display: "inline-flex", alignItems: "center", gap: 4,
                boxShadow: "0 4px 12px rgba(22,163,74,.35)",
              }}>
                <Sparkles size={9} fill="#fff" strokeWidth={0}/>
                READY
              </div>
            </div>

            <div className="condensed" style={{
              fontSize: 48, fontWeight: 900, color: C.text,
              letterSpacing: "-1.2px", lineHeight: 1, marginBottom: 6,
              fontVariantNumeric: "tabular-nums",
            }}>
              ${fmtMoney(totalPayout)}
            </div>

            <div style={{ fontSize: 12.5, color: "#15803D", fontWeight: 600, marginBottom: 18, display: "flex", alignItems: "center", gap: 6 }}>
              <Banknote size={13}/>
              {rideCount} ride{rideCount !== 1 ? "s" : ""} · instant transfer to bank
            </div>

            {feedback && (
              <div style={{
                background: feedback.type === "success" ? "#F0FDF4" : "#FEF2F2",
                border: `1px solid ${feedback.type === "success" ? "#86EFAC" : "#FCA5A5"}`,
                borderRadius: 10, padding: "10px 13px",
                marginBottom: 14,
                display: "flex", alignItems: "center", gap: 8,
                animation: "earnFadeIn .25s ease-out",
              }}>
                {feedback.type === "success"
                  ? <CheckCircle2 size={14} color="#16A34A"/>
                  : <AlertCircle size={14} color="#DC2626"/>
                }
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: feedback.type === "success" ? "#15803D" : "#991B1B",
                }}>
                  {feedback.message}
                </span>
              </div>
            )}

            <button
              onClick={handleWithdraw}
              disabled={isWithdrawing}
              style={{
                width: "100%", padding: "15px 20px",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                background: "linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)",
                border: "none", borderRadius: 14, color: "#fff",
                fontFamily: "'Barlow',sans-serif", fontWeight: 800, fontSize: 15,
                letterSpacing: ".3px",
                cursor: isWithdrawing ? "not-allowed" : "pointer",
                opacity: isWithdrawing ? 0.75 : 1,
                boxShadow: "0 10px 28px rgba(22,163,74,.40)",
                transition: "filter .15s, transform .1s",
                animation: !isWithdrawing ? "earnPulse 2.4s ease-in-out infinite" : "none",
              }}
              onMouseEnter={e => { if (!isWithdrawing) e.currentTarget.style.filter = "brightness(1.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.filter = ""; }}
              onMouseDown={e  => { if (!isWithdrawing) e.currentTarget.style.transform = "scale(.98)"; }}
              onMouseUp={e    => { e.currentTarget.style.transform = ""; }}
            >
              {isWithdrawing ? (
                <>
                  <Loader2 size={17} style={{ animation: "earnSpin 0.8s linear infinite" }}/>
                  Processing payout…
                </>
              ) : (
                <>
                  <ArrowDownToLine size={17} strokeWidth={2.4}/>
                  Withdraw ${fmtMoney(totalPayout)}
                </>
              )}
            </button>

            <div style={{
              marginTop: 10,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              fontSize: 11, color: "#16A34A", fontWeight: 600,
            }}>
              <Clock size={11}/>
              Funds typically arrive in your bank within minutes
            </div>
          </div>
        </div>
      )}

      {/* ── Weekly chart ── */}
      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 20, padding: "22px",
        boxShadow: `0 1px 3px rgba(0,0,0,0.02), 0 4px 14px rgba(0,0,0,0.04)`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div className="condensed" style={{
              fontSize: 11, fontWeight: 800, color: C.textDim,
              letterSpacing: "1px", textTransform: "uppercase",
              marginBottom: 4,
            }}>
              This Week
            </div>
            <div className="condensed" style={{
              fontSize: 24, fontWeight: 900, color: C.text,
              letterSpacing: "-0.5px", lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}>
              ${fmtMoney(weekEarnings)}
            </div>
            <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 4, fontWeight: 500 }}>
              {weekTrips} trip{weekTrips !== 1 ? "s" : ""} · last week ${fmtMoney(lastWeek)}
            </div>
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: changePercent >= 0 ? "rgba(22,163,74,.10)" : "rgba(239,68,68,.10)",
            border:     `1px solid ${changePercent >= 0 ? "rgba(22,163,74,.25)" : "rgba(239,68,68,.25)"}`,
            color:      changePercent >= 0 ? C.onlineGreen : "#DC2626",
            borderRadius: 100, padding: "5px 10px",
            fontSize: 11, fontWeight: 700,
          }}>
            {changePercent >= 0
              ? <TrendingUp size={12} strokeWidth={2.4}/>
              : <TrendingDown size={12} strokeWidth={2.4}/>}
            {changePercent >= 0 ? "+" : ""}{changePercent}%
          </div>
        </div>

        {/* Chart */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120, position: "relative" }}>
          {/* Background grid lines */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", justifyContent: "space-between",
            pointerEvents: "none",
          }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                height: 1, background: C.border, opacity: 0.5,
                width: "100%",
              }}/>
            ))}
          </div>

          {dailyBreakdown.length > 0
            ? dailyBreakdown.map((d) => {
                const isFuture = d.amount === null;
                const pct      = isFuture ? 0 : Math.max(((d.amount ?? 0) / maxAmount) * 100, (d.amount ?? 0) > 0 ? 6 : 0);
                return (
                  <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, position: "relative", height: "100%", justifyContent: "flex-end" }}>
                    {!isFuture && d.isToday && (d.amount ?? 0) > 0 && (
                      <div style={{
                        position: "absolute",
                        top: `calc(100% - ${pct}% - 22px)`,
                        background: C.text,
                        color: "#fff",
                        fontSize: 10, fontWeight: 800,
                        padding: "3px 7px",
                        borderRadius: 6,
                        whiteSpace: "nowrap",
                        boxShadow: "0 4px 12px rgba(0,0,0,.18)",
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        ${d.amount}
                      </div>
                    )}
                    <div style={{
                      width: "100%",
                      height: `${isFuture ? 6 : Math.max(pct, 6)}%`,
                      background: isFuture
                        ? C.border
                        : d.isToday
                          ? (online ? "linear-gradient(180deg,#22C55E,#16A34A)" : "linear-gradient(180deg,#374151,#111827)")
                          : (d.amount > 0 ? "#D1FAE5" : C.surfaceAlt),
                      borderRadius: "6px 6px 3px 3px",
                      boxShadow: d.isToday && !isFuture
                        ? (online ? "0 4px 14px rgba(22,163,74,.35)" : "0 4px 14px rgba(17,24,39,.18)")
                        : "none",
                      border: d.isToday && !isFuture
                        ? "none"
                        : `1px solid ${C.border}`,
                      opacity: isFuture ? 0.4 : 1,
                      transition: "height .5s cubic-bezier(.34,1.2,.64,1)",
                    }}/>
                    <div className="condensed" style={{
                      fontSize: 10, fontWeight: 800,
                      color: d.isToday ? (online ? C.onlineGreen : C.text) : C.textDim,
                      letterSpacing: ".5px",
                    }}>
                      {d.day.toUpperCase()}
                    </div>
                  </div>
                );
              })
            : Array.from({ length: 7 }).map((_, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ width: "100%", height: 40, background: C.border, borderRadius: "6px 6px 3px 3px", opacity: 0.4 }}/>
                  <div style={{ width: 20, height: 8, background: C.border, borderRadius: 4, opacity: 0.4 }}/>
                </div>
              ))
          }
        </div>
      </div>

      {/* ── Footer info ── */}
      {!showSetupGate && (
        <div style={{
          background: C.surfaceAlt,
          border: `1px solid ${C.border}`,
          borderRadius: 12, padding: "11px 14px",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <CheckCircle2 size={14} color={C.onlineGreen} strokeWidth={2.2}/>
          <span style={{ fontSize: 11.5, color: C.textMid, fontWeight: 600, lineHeight: 1.4 }}>
            Bank account connected · {driver?.transferCapability === "enabled" ? "transfers enabled" : "verifying"}
          </span>
        </div>
      )}
    </div>
  );
}