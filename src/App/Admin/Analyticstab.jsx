// src/App/UaTob/Admin/tabs/AnalyticsTab.jsx
import { useMemo } from "react";
import {
  Clock, CheckCircle, XCircle, DollarSign, ArrowUpRight,
  Eye, Smartphone, Monitor, TrendingUp, Activity, Users, MapPin,
  UserPlus, ShieldCheck, FileCheck,
} from "lucide-react";
import { C } from '@/App/Admin/Tokens';
import { Avatar, SectionHeader } from '@/App/Admin/UI';

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Helpers ──────────────────────────────────────────────
function tsToMs(ts) {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (ts?.toMillis) return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts?._seconds) return ts._seconds * 1000;
  return 0;
}

function dayIndexFromMonday(date) {
  const d = date.getDay();
  return d === 0 ? 6 : d - 1;
}

function isMobile(ua = "", screenW) {
  if (typeof screenW === "number" && screenW < 768) return true;
  return /Mobile|Android|iPhone|iPad|iPod/i.test(ua);
}

function shortPath(path) {
  if (!path) return "/";
  if (path.length <= 20) return path;
  return path.slice(0, 18) + "…";
}

function docCompletion(d) {
  const docs = d.documents || {};
  const required = ["licenseFront", "licenseBack", "registration", "insurance", "profilePhoto"];
  const uploaded = required.filter(k => !!docs[k]).length;
  return { uploaded, total: required.length };
}

// ── Driver Signups Chart ─────────────────────────────────
function DriverSignupsChart({ uatobdrivers = [] }) {
  const stats = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    const todayDayIdx = dayIndexFromMonday(now);
    monday.setDate(now.getDate() - todayDayIdx);

    // 7 day buckets
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return {
        label: DAYS[i],
        dateStr: d.toDateString(),
        isToday: d.toDateString() === now.toDateString(),
        isFuture: d > now,
        signups: 0,
        approved: 0,
        pending: 0,
      };
    });

    // Status & lifecycle counts (across ALL drivers, not just this week)
    let total           = uatobdrivers.length;
    let online          = 0;
    let offline         = 0;
    let approved        = 0;
    let pending         = 0;
    let inProgress      = 0;
    let rejected        = 0;
    let suspended       = 0;
    let docsComplete    = 0;
    let stripeConnected = 0;

    uatobdrivers.forEach(d => {
      // Bucket by signup day this week
      const ms = tsToMs(d.createdAt);
      if (ms) {
        const day = new Date(ms);
        day.setHours(0, 0, 0, 0);
        const idx = buckets.findIndex(b => b.dateStr === day.toDateString());
        if (idx >= 0) {
          buckets[idx].signups++;
          if (d.status === "approved" || d.status === "online" || d.status === "offline") {
            buckets[idx].approved++;
          } else if (d.status === "pending") {
            buckets[idx].pending++;
          }
        }
      }

      // Status totals
      switch (d.status) {
        case "online":      online++; break;
        case "offline":     offline++; break;
        case "approved":    approved++; break;
        case "pending":     pending++; break;
        case "in_progress": inProgress++; break;
        case "rejected":    rejected++; break;
        case "suspended":   suspended++; break;
        default:
          if (!d.status && (d.currentStep ?? 0) < 5) inProgress++;
      }

      const dc = docCompletion(d);
      if (dc.uploaded === dc.total) docsComplete++;
      if (d.accountId) stripeConnected++;
    });

    const weekSignups = buckets.reduce((s, b) => s + b.signups, 0);
    const maxVal = Math.max(...buckets.map(b => b.signups), 1);

    const active   = online + offline;
    const approvedAll = approved + active;
    const inFunnel = inProgress + pending;
    const conversionPct = total > 0 ? Math.round((approvedAll / total) * 100) : 0;

    return {
      buckets,
      weekSignups,
      maxVal,
      total,
      online,
      offline,
      approved,
      pending,
      inProgress,
      rejected,
      suspended,
      active,
      approvedAll,
      inFunnel,
      conversionPct,
      docsComplete,
      stripeConnected,
    };
  }, [uatobdrivers]);

  const todaysSignups = stats.buckets.find(b => b.isToday)?.signups ?? 0;
  const yesterdayIdx  = stats.buckets.findIndex(b => b.isToday) - 1;
  const yesterdaysSignups = yesterdayIdx >= 0 ? stats.buckets[yesterdayIdx].signups : 0;
  const dayDelta = yesterdaysSignups > 0
    ? Math.round(((todaysSignups - yesterdaysSignups) / yesterdaysSignups) * 100)
    : null;

  return (
    <div
      className="card fade-up"
      style={{
        padding: 0,
        marginBottom: 16,
        animationDelay: "30ms",
        opacity: 0,
        boxShadow: "0 1px 8px rgba(0,0,0,.05)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{
        padding: "16px 18px 14px",
        borderBottom: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: `${C.green}14`,
            border: `1.5px solid ${C.green}28`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <UserPlus size={15} color={C.green} strokeWidth={2.4}/>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Driver Signups This Week</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>
              {stats.total.toLocaleString()} total drivers · {stats.active} active
            </div>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div className="mono" style={{
            fontSize: 22, fontWeight: 700, color: C.text, lineHeight: 1,
            fontVariantNumeric: "tabular-nums", letterSpacing: "-.5px",
          }}>
            {stats.weekSignups.toLocaleString()}
          </div>
          <div style={{
            fontSize: 10, color: C.textMuted, fontWeight: 700,
            marginTop: 4, letterSpacing: ".3px", textTransform: "uppercase",
          }}>
            This week
          </div>
        </div>
      </div>

      {/* Bar chart */}
      <div style={{ padding: "18px 18px 14px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
          {stats.buckets.map((b, i) => {
            const pct = b.isFuture ? 0 : Math.max((b.signups / stats.maxVal) * 80, b.signups > 0 ? 6 : 0);
            const green = C.green;
            return (
              <div
                key={DAYS[i]}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                {!b.isFuture && b.signups > 0 && (
                  <div className="mono" style={{
                    fontSize: 9, fontWeight: 700,
                    color: b.isToday ? green : C.textDim,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {b.signups}
                  </div>
                )}
                {(b.isFuture || b.signups === 0) && <div style={{ fontSize: 9, color: "transparent" }}>·</div>}
                <div style={{
                  width: "100%",
                  borderRadius: "4px 4px 0 0",
                  height: `${b.isFuture ? 4 : Math.max(pct, 4)}px`,
                  background: b.isFuture
                    ? C.borderLight ?? `${C.border}`
                    : b.isToday
                      ? `linear-gradient(180deg,#22C55E,${green} 50%,#15803D)`
                      : `${green}22`,
                  border: b.isFuture
                    ? `1px solid ${C.border}`
                    : `1px solid ${green}${b.isToday ? "bb" : "30"}`,
                  boxShadow: b.isToday && !b.isFuture
                    ? `0 4px 12px ${green}40`
                    : "none",
                  transition: "height .6s cubic-bezier(.34,1.2,.64,1)",
                  minHeight: 4,
                }} />
                <div style={{
                  fontSize: 9,
                  color: b.isToday ? green : C.textDim,
                  fontWeight: b.isToday ? 800 : 700,
                  letterSpacing: ".5px",
                }}>
                  {DAYS[i]}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer stats row 1: Today / Conversion / Docs */}
      <div style={{
        display: "flex",
        borderTop: `1px solid ${C.border}`,
        background: C.surfaceAlt ?? `${C.bg ?? "#FAFAFA"}`,
      }}>
        {/* Today */}
        <div style={{
          flex: 1,
          padding: "12px 14px",
          borderRight: `1px solid ${C.border}`,
        }}>
          <div style={{
            fontSize: 9.5, color: C.textMuted, fontWeight: 700,
            letterSpacing: ".4px", textTransform: "uppercase",
            marginBottom: 4,
          }}>
            Today
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            <span className="mono" style={{
              fontSize: 16, fontWeight: 700, color: C.text,
              fontVariantNumeric: "tabular-nums", letterSpacing: "-.3px",
            }}>
              {todaysSignups}
            </span>
            {dayDelta !== null && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 2,
                fontSize: 10, fontWeight: 700,
                color: dayDelta >= 0 ? C.green : C.red,
                fontFamily: "var(--mono)", letterSpacing: ".02em",
              }}>
                <TrendingUp
                  size={9}
                  strokeWidth={2.6}
                  style={{ transform: dayDelta < 0 ? "rotate(180deg)" : "none" }}
                />
                {dayDelta >= 0 ? "+" : ""}{dayDelta}%
              </span>
            )}
          </div>
        </div>

        {/* Conversion */}
        <div style={{
          flex: 1,
          padding: "12px 14px",
          borderRight: `1px solid ${C.border}`,
        }}>
          <div style={{
            fontSize: 9.5, color: C.textMuted, fontWeight: 700,
            letterSpacing: ".4px", textTransform: "uppercase",
            marginBottom: 4,
          }}>
            Conversion
          </div>
          <span className="mono" style={{
            fontSize: 16, fontWeight: 700, color: C.text,
            fontVariantNumeric: "tabular-nums", letterSpacing: "-.3px",
          }}>
            {stats.conversionPct}%
          </span>
          <div style={{
            fontSize: 9, color: C.textDim, fontWeight: 600,
            marginTop: 2,
          }}>
            {stats.approvedAll}/{stats.total} approved
          </div>
        </div>

        {/* Docs ready */}
        <div style={{
          flex: 1,
          padding: "12px 14px",
        }}>
          <div style={{
            fontSize: 9.5, color: C.textMuted, fontWeight: 700,
            letterSpacing: ".4px", textTransform: "uppercase",
            marginBottom: 4,
          }}>
            Docs Ready
          </div>
          <span className="mono" style={{
            fontSize: 16, fontWeight: 700, color: C.text,
            fontVariantNumeric: "tabular-nums", letterSpacing: "-.3px",
          }}>
            {stats.docsComplete}
          </span>
          <div style={{
            fontSize: 9, color: C.textDim, fontWeight: 600,
            marginTop: 2,
          }}>
            All 5 uploaded
          </div>
        </div>
      </div>

      {/* Status breakdown (like Top Pages) */}
      <div style={{
        padding: "14px 18px 16px",
        borderTop: `1px solid ${C.border}`,
      }}>
        <div style={{
          fontSize: 9.5, color: C.textMuted, fontWeight: 800,
          letterSpacing: ".5px", textTransform: "uppercase",
          marginBottom: 10,
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <Users size={10} strokeWidth={2.4}/>
          Lifecycle Breakdown
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { label: "Online",      count: stats.online,     color: "#22C55E" },
            { label: "Offline",     count: stats.offline,    color: "#52525B" },
            { label: "Approved",    count: stats.approved,   color: "#2563EB" },
            { label: "Pending",     count: stats.pending,    color: "#D97706" },
            { label: "In Progress", count: stats.inProgress, color: "#6B7280" },
            { label: "Rejected",    count: stats.rejected,   color: "#DC2626" },
            { label: "Suspended",   count: stats.suspended,  color: "#7C3AED" },
          ]
            .filter(row => row.count > 0)
            .sort((a, b) => b.count - a.count)
            .map(row => {
              const pct = stats.total > 0 ? (row.count / stats.total) * 100 : 0;
              return (
                <div
                  key={row.label}
                  style={{
                    position: "relative",
                    background: `${row.color}06`,
                    border: `1px solid ${row.color}15`,
                    borderRadius: 8,
                    padding: "8px 12px",
                    overflow: "hidden",
                  }}
                >
                  {/* Background fill bar */}
                  <div style={{
                    position: "absolute",
                    top: 0, left: 0, bottom: 0,
                    width: `${pct}%`,
                    background: `linear-gradient(90deg,${row.color}18,${row.color}08)`,
                    transition: "width .6s cubic-bezier(.34,1.2,.64,1)",
                  }}/>

                  <div style={{
                    position: "relative",
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between", gap: 10,
                  }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 7,
                      fontSize: 12, fontWeight: 700, color: C.text,
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: row.color,
                        boxShadow: `0 0 6px ${row.color}88`,
                      }}/>
                      {row.label}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span className="mono" style={{
                        fontSize: 11, color: C.textMuted, fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {pct.toFixed(0)}%
                      </span>
                      <span className="mono" style={{
                        fontSize: 12, fontWeight: 700, color: row.color,
                        fontVariantNumeric: "tabular-nums",
                        minWidth: 30, textAlign: "right",
                      }}>
                        {row.count}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

          {stats.total === 0 && (
            <div style={{
              padding: "20px",
              textAlign: "center",
              fontSize: 12, color: C.textMuted,
              background: C.surfaceAlt ?? "#FAFAFA",
              borderRadius: 8,
            }}>
              No drivers yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Views Chart ──────────────────────────────────────────
function ViewsChart({ views = [] }) {
  const stats = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    const todayDayIdx = dayIndexFromMonday(now);
    monday.setDate(now.getDate() - todayDayIdx);

    const buckets = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return {
        label: DAYS[i],
        dateStr: d.toDateString(),
        isToday: d.toDateString() === now.toDateString(),
        isFuture: d > now,
        views: 0,
        sessions: new Set(),
      };
    });

    const pathCounts = new Map();
    let mobileCount = 0;
    let desktopCount = 0;
    let totalSessions = new Set();
    let totalUsers = new Set();

    views.forEach(v => {
      const ms = tsToMs(v.timestamp ?? v.createdAt);
      if (!ms) return;

      const d = new Date(ms);
      d.setHours(0, 0, 0, 0);
      const idx = buckets.findIndex(b => b.dateStr === d.toDateString());

      if (idx >= 0) {
        buckets[idx].views++;
        if (v.sessionId) buckets[idx].sessions.add(v.sessionId);
      }

      const p = v.path || "/";
      pathCounts.set(p, (pathCounts.get(p) ?? 0) + 1);

      if (isMobile(v.userAgent, v.screen?.w)) mobileCount++;
      else desktopCount++;

      if (v.sessionId) totalSessions.add(v.sessionId);
      if (v.uid) totalUsers.add(v.uid);
    });

    const totalViews = buckets.reduce((s, b) => s + b.views, 0);
    const maxVal = Math.max(...buckets.map(b => b.views), 1);

    const topPaths = [...pathCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    const totalDevices = mobileCount + desktopCount;
    const mobilePct = totalDevices > 0 ? Math.round((mobileCount / totalDevices) * 100) : 0;

    return {
      buckets, totalViews, maxVal,
      totalSessions: totalSessions.size,
      totalUsers: totalUsers.size,
      mobileCount, desktopCount, mobilePct,
      topPaths,
    };
  }, [views]);

  const todaysViews = stats.buckets.find(b => b.isToday)?.views ?? 0;
  const yesterdayIdx = stats.buckets.findIndex(b => b.isToday) - 1;
  const yesterdaysViews = yesterdayIdx >= 0 ? stats.buckets[yesterdayIdx].views : 0;
  const dayDelta = yesterdaysViews > 0
    ? Math.round(((todaysViews - yesterdaysViews) / yesterdaysViews) * 100)
    : null;

  return (
    <div
      className="card fade-up"
      style={{
        padding: 0,
        marginBottom: 16,
        animationDelay: "20ms",
        opacity: 0,
        boxShadow: "0 1px 8px rgba(0,0,0,.05)",
        overflow: "hidden",
      }}
    >
      <div style={{
        padding: "16px 18px 14px",
        borderBottom: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: `${C.violet ?? "#7C3AED"}14`,
            border: `1.5px solid ${C.violet ?? "#7C3AED"}28`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Eye size={15} color={C.violet ?? "#7C3AED"} strokeWidth={2.4}/>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Page Views This Week</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>
              {stats.totalSessions} session{stats.totalSessions !== 1 ? "s" : ""} · {stats.totalUsers} unique
            </div>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div className="mono" style={{
            fontSize: 22, fontWeight: 700, color: C.text, lineHeight: 1,
            fontVariantNumeric: "tabular-nums", letterSpacing: "-.5px",
          }}>
            {stats.totalViews.toLocaleString()}
          </div>
          <div style={{
            fontSize: 10, color: C.textMuted, fontWeight: 700,
            marginTop: 4, letterSpacing: ".3px", textTransform: "uppercase",
          }}>
            Total views
          </div>
        </div>
      </div>

      <div style={{ padding: "18px 18px 14px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
          {stats.buckets.map((b, i) => {
            const pct = b.isFuture ? 0 : Math.max((b.views / stats.maxVal) * 80, b.views > 0 ? 6 : 0);
            const purple = C.violet ?? "#7C3AED";
            return (
              <div
                key={DAYS[i]}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                {!b.isFuture && b.views > 0 && (
                  <div className="mono" style={{
                    fontSize: 9, fontWeight: 700,
                    color: b.isToday ? purple : C.textDim,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {b.views}
                  </div>
                )}
                {(b.isFuture || b.views === 0) && <div style={{ fontSize: 9, color: "transparent" }}>·</div>}
                <div style={{
                  width: "100%",
                  borderRadius: "4px 4px 0 0",
                  height: `${b.isFuture ? 4 : Math.max(pct, 4)}px`,
                  background: b.isFuture
                    ? C.borderLight ?? `${C.border}`
                    : b.isToday
                      ? `linear-gradient(180deg,${purple},${purple}cc 50%,${purple}99)`
                      : `${purple}22`,
                  border: b.isFuture
                    ? `1px solid ${C.border}`
                    : `1px solid ${purple}${b.isToday ? "bb" : "30"}`,
                  boxShadow: b.isToday && !b.isFuture
                    ? `0 4px 12px ${purple}40`
                    : "none",
                  transition: "height .6s cubic-bezier(.34,1.2,.64,1)",
                  minHeight: 4,
                }} />
                <div style={{
                  fontSize: 9,
                  color: b.isToday ? purple : C.textDim,
                  fontWeight: b.isToday ? 800 : 700,
                  letterSpacing: ".5px",
                }}>
                  {DAYS[i]}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{
        display: "flex",
        borderTop: `1px solid ${C.border}`,
        background: C.surfaceAlt ?? `${C.bg ?? "#FAFAFA"}`,
      }}>
        <div style={{
          flex: 1,
          padding: "12px 14px",
          borderRight: `1px solid ${C.border}`,
        }}>
          <div style={{
            fontSize: 9.5, color: C.textMuted, fontWeight: 700,
            letterSpacing: ".4px", textTransform: "uppercase",
            marginBottom: 4,
          }}>
            Today
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            <span className="mono" style={{
              fontSize: 16, fontWeight: 700, color: C.text,
              fontVariantNumeric: "tabular-nums", letterSpacing: "-.3px",
            }}>
              {todaysViews}
            </span>
            {dayDelta !== null && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 2,
                fontSize: 10, fontWeight: 700,
                color: dayDelta >= 0 ? C.green : C.red,
                fontFamily: "var(--mono)", letterSpacing: ".02em",
              }}>
                <TrendingUp
                  size={9}
                  strokeWidth={2.6}
                  style={{ transform: dayDelta < 0 ? "rotate(180deg)" : "none" }}
                />
                {dayDelta >= 0 ? "+" : ""}{dayDelta}%
              </span>
            )}
          </div>
        </div>

        <div style={{
          flex: 1,
          padding: "12px 14px",
          borderRight: `1px solid ${C.border}`,
        }}>
          <div style={{
            fontSize: 9.5, color: C.textMuted, fontWeight: 700,
            letterSpacing: ".4px", textTransform: "uppercase",
            marginBottom: 4,
          }}>
            Devices
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 11, fontWeight: 700, color: C.text,
              fontFamily: "var(--mono)",
            }}>
              <Smartphone size={11} color={C.blue} strokeWidth={2.4}/>
              {stats.mobilePct}%
            </span>
            <span style={{ color: C.textDim, fontSize: 10 }}>·</span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 11, fontWeight: 700, color: C.textMuted,
              fontFamily: "var(--mono)",
            }}>
              <Monitor size={11} color={C.textDim} strokeWidth={2.4}/>
              {100 - stats.mobilePct}%
            </span>
          </div>
        </div>

        <div style={{
          flex: 1,
          padding: "12px 14px",
        }}>
          <div style={{
            fontSize: 9.5, color: C.textMuted, fontWeight: 700,
            letterSpacing: ".4px", textTransform: "uppercase",
            marginBottom: 4,
          }}>
            Per session
          </div>
          <span className="mono" style={{
            fontSize: 16, fontWeight: 700, color: C.text,
            fontVariantNumeric: "tabular-nums", letterSpacing: "-.3px",
          }}>
            {stats.totalSessions > 0
              ? (stats.totalViews / stats.totalSessions).toFixed(1)
              : "—"}
          </span>
        </div>
      </div>

      {stats.topPaths.length > 0 && (
        <div style={{
          padding: "14px 18px 16px",
          borderTop: `1px solid ${C.border}`,
        }}>
          <div style={{
            fontSize: 9.5, color: C.textMuted, fontWeight: 800,
            letterSpacing: ".5px", textTransform: "uppercase",
            marginBottom: 10,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <MapPin size={10} strokeWidth={2.4}/>
            Top Pages
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {stats.topPaths.map(([path, count]) => {
              const pct = (count / stats.totalViews) * 100;
              const purple = C.violet ?? "#7C3AED";
              return (
                <div
                  key={path}
                  style={{
                    position: "relative",
                    background: `${purple}06`,
                    border: `1px solid ${purple}15`,
                    borderRadius: 8,
                    padding: "8px 12px",
                    overflow: "hidden",
                  }}
                >
                  <div style={{
                    position: "absolute",
                    top: 0, left: 0, bottom: 0,
                    width: `${pct}%`,
                    background: `linear-gradient(90deg,${purple}18,${purple}08)`,
                    transition: "width .6s cubic-bezier(.34,1.2,.64,1)",
                  }}/>

                  <div style={{
                    position: "relative",
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between", gap: 10,
                  }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: C.text,
                      fontFamily: "var(--mono)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      flex: 1,
                    }}>
                      {shortPath(path)}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span className="mono" style={{
                        fontSize: 11, color: C.textMuted, fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {pct.toFixed(0)}%
                      </span>
                      <span className="mono" style={{
                        fontSize: 12, fontWeight: 700, color: purple,
                        fontVariantNumeric: "tabular-nums",
                        minWidth: 30, textAlign: "right",
                      }}>
                        {count}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────
export function AnalyticsTab({
  uatobdrivers     = [],
  views            = [],
  avgTripDuration  = 0,
  avgFare          = 0,
  acceptanceRate   = 0,
  cancellationRate = 0,
  topDrivers       = [],
  totalRides       = 0,
  ridesPerDay      = [0, 0, 0, 0, 0, 0, 0],
  rides,
}) {
  const formatDuration = (minutes) => {
    const m = Math.floor(minutes);
    const s = Math.round((minutes - m) * 60);
    return `${m}m ${s}s`;
  };

  console.log(totalRides);
  console.log(rides);

  const maxVal   = Math.max(...ridesPerDay, 1);
  const todayIdx = (() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  })();

  const metrics = [
    { label: "Avg Trip Duration", value: formatDuration(avgTripDuration), icon: Clock,       color: C.blue  },
    { label: "Acceptance Rate",   value: `${acceptanceRate}%`,            icon: CheckCircle, color: C.green },
    { label: "Cancellation Rate", value: `${cancellationRate}%`,          icon: XCircle,     color: C.red   },
    { label: "Avg Fare",          value: `$${avgFare}`,                   icon: DollarSign,  color: C.amber },
  ];

  return (
    <div style={{ padding: "0 16px 16px" }}>

      {/* ─── PAGE VIEWS CHART ─── */}
      <ViewsChart views={views}/>

      {/* ─── DRIVER SIGNUPS CHART ─── */}
      <DriverSignupsChart uatobdrivers={uatobdrivers}/>

      {/* ─── RIDES THIS WEEK ─── */}
      <div
        className="card fade-up"
        style={{ padding: "18px", marginBottom: 16, animationDelay: "40ms", opacity: 0, boxShadow: "0 1px 8px rgba(0,0,0,.05)" }}
      >
        <div style={{
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: `${C.amber}14`,
              border: `1.5px solid ${C.amber}28`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Activity size={15} color={C.amber} strokeWidth={2.4}/>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Rides This Week</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{totalRides} total rides</div>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div className="mono" style={{
              fontSize: 22, fontWeight: 700, color: C.text, lineHeight: 1,
              fontVariantNumeric: "tabular-nums", letterSpacing: "-.5px",
            }}>
              {totalRides.toLocaleString()}
            </div>
            <div style={{
              fontSize: 10, color: C.textMuted, fontWeight: 700,
              marginTop: 4, letterSpacing: ".3px", textTransform: "uppercase",
            }}>
              Total
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
          {ridesPerDay.map((val, i) => (
            <div
              key={DAYS[i]}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}
            >
              {val > 0 && (
                <div className="mono" style={{
                  fontSize: 9, fontWeight: 700,
                  color: i === todayIdx ? C.amber : C.textDim,
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {val}
                </div>
              )}
              {val === 0 && <div style={{ fontSize: 9, color: "transparent" }}>·</div>}
              <div style={{
                width: "100%",
                borderRadius: "4px 4px 0 0",
                height: `${(val / maxVal) * 80}px`,
                minHeight: 4,
                background: i === todayIdx
                  ? `linear-gradient(180deg,${C.amber},${C.amber}cc 50%,${C.amber}99)`
                  : `${C.amber}22`,
                border: `1px solid ${C.amber}${i === todayIdx ? "bb" : "30"}`,
                boxShadow: i === todayIdx ? `0 4px 12px ${C.amber}40` : "none",
                transition: "height .6s cubic-bezier(.34,1.2,.64,1)",
              }}/>
              <div style={{
                fontSize: 9,
                color: i === todayIdx ? C.amber : C.textDim,
                fontWeight: i === todayIdx ? 800 : 700,
                letterSpacing: ".5px",
              }}>
                {DAYS[i]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── KEY METRICS ─── */}
      <SectionHeader title="Key Metrics"/>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {metrics.map(({ label, value, icon: Icon, color }, i) => (
          <div
            key={label}
            className="card fade-up"
            style={{ padding: "14px", animationDelay: `${90 + i * 55}ms`, opacity: 0, boxShadow: "0 1px 5px rgba(0,0,0,.04)" }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: `${color}14`,
              border: `1.5px solid ${color}28`,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 10,
            }}>
              <Icon size={15} color={color}/>
            </div>
            <div className="mono" style={{ fontSize: 17, fontWeight: 600, marginBottom: 3 }}>{value}</div>
            <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: ".3px" }}>
              {label.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      {/* ─── TOP DRIVERS ─── */}
      <SectionHeader title="Top Drivers"/>
      {topDrivers.length === 0 ? (
        <div
          className="card"
          style={{ padding: "20px 16px", textAlign: "center", fontSize: 12, color: C.textMuted }}
        >
          No completed rides yet this week
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,.04)" }}>
          {topDrivers.map((d, i) => (
            <div
              key={d.uid ?? i}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px",
                borderBottom: i < topDrivers.length - 1 ? `1px solid ${C.border}` : "none",
              }}
            >
              <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: C.textDim, width: 16 }}>
                #{i + 1}
              </div>
              <Avatar name={d.name ?? d.uid} size={32} colorIdx={i}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{d.name ?? d.uid}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>
                  {d.rides} rides · ★ {d.averageRating?.toFixed(2) ?? "—"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.green, fontWeight: 700 }}>
                <ArrowUpRight size={11}/> Top
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}