// src/App/UaTob/Admin/tabs/AnalyticsTab.jsx
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Eye, Smartphone, Monitor, TrendingUp, Activity, Users, MapPin,
  UserPlus, Search, Crown, Star, Car,
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

function shortAddress(addr) {
  if (!addr) return "—";
  const parts = addr.split(",").map(s => s.trim());
  return parts.slice(0, 2).join(", ") || addr;
}

function docCompletion(d) {
  const docs = d.documents || {};
  const required = ["licenseFront", "licenseBack", "registration", "insurance", "profilePhoto"];
  const uploaded = required.filter(k => !!docs[k]).length;
  return { uploaded, total: required.length };
}

// ── Build week buckets (Mon → Sun) ───────────────────────
function buildWeekBuckets() {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - dayIndexFromMonday(now));

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      label: DAYS[i],
      dateStr: d.toDateString(),
      isToday: d.toDateString() === now.toDateString(),
      isFuture: d > now,
      value: 0,
    };
  });
}

// ── Reusable bar chart ───────────────────────────────────
function BarChart({ buckets, maxVal, color }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
      {buckets.map((b, i) => {
        const pct = b.isFuture ? 0 : Math.max((b.value / maxVal) * 80, b.value > 0 ? 6 : 0);
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
            {!b.isFuture && b.value > 0 && (
              <div className="mono" style={{
                fontSize: 9, fontWeight: 700,
                color: b.isToday ? color : C.textDim,
                fontVariantNumeric: "tabular-nums",
              }}>
                {b.value}
              </div>
            )}
            {(b.isFuture || b.value === 0) && <div style={{ fontSize: 9, color: "transparent" }}>·</div>}
            <div style={{
              width: "100%",
              borderRadius: "4px 4px 0 0",
              height: `${b.isFuture ? 4 : Math.max(pct, 4)}px`,
              background: b.isFuture
                ? C.borderLight ?? `${C.border}`
                : b.isToday
                  ? `linear-gradient(180deg,${color},${color}cc 50%,${color}99)`
                  : `${color}22`,
              border: b.isFuture
                ? `1px solid ${C.border}`
                : `1px solid ${color}${b.isToday ? "bb" : "30"}`,
              boxShadow: b.isToday && !b.isFuture
                ? `0 4px 12px ${color}40`
                : "none",
              transition: "height .6s cubic-bezier(.34,1.2,.64,1)",
              minHeight: 4,
            }} />
            <div style={{
              fontSize: 9,
              color: b.isToday ? color : C.textDim,
              fontWeight: b.isToday ? 800 : 700,
              letterSpacing: ".5px",
            }}>
              {DAYS[i]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Searches Chart ───────────────────────────────────────
function SearchesChart({ searches = [] }) {
  const stats = useMemo(() => {
    const buckets = buildWeekBuckets();

    let withDriverInfo = 0;
    let noDriverInfo   = 0;
    let totalMiles     = 0;
    let totalMinutes   = 0;
    const dropoffCounts = new Map();

    searches.forEach(s => {
      const ms = tsToMs(s.createdAt);
      if (ms) {
        const d = new Date(ms);
        d.setHours(0, 0, 0, 0);
        const idx = buckets.findIndex(b => b.dateStr === d.toDateString());
        if (idx >= 0) buckets[idx].value++;
      }

      if (s.driverInfo) withDriverInfo++;
      else noDriverInfo++;

      if (typeof s.miles   === "number") totalMiles   += s.miles;
      if (typeof s.minutes === "number") totalMinutes += s.minutes;

      const dropoffKey = shortAddress(s.dropoff);
      if (dropoffKey && dropoffKey !== "—") {
        dropoffCounts.set(dropoffKey, (dropoffCounts.get(dropoffKey) ?? 0) + 1);
      }
    });

    const total      = searches.length;
    const weekTotal  = buckets.reduce((s, b) => s + b.value, 0);
    const maxVal     = Math.max(...buckets.map(b => b.value), 1);
    const avgMiles   = total > 0 ? totalMiles / total   : 0;
    const avgMinutes = total > 0 ? totalMinutes / total : 0;
    const matchRate  = total > 0 ? Math.round((withDriverInfo / total) * 100) : 0;

    const topDropoffs = [...dropoffCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return {
      buckets, weekTotal, maxVal, total,
      withDriverInfo, noDriverInfo,
      avgMiles: avgMiles.toFixed(2),
      avgMinutes: avgMinutes.toFixed(1),
      matchRate, topDropoffs,
    };
  }, [searches]);

  const blue = C.blue ?? "#2563EB";
  const todayBucket  = stats.buckets.find(b => b.isToday);
  const yesterdayIdx = stats.buckets.findIndex(b => b.isToday) - 1;
  const yesterday    = yesterdayIdx >= 0 ? stats.buckets[yesterdayIdx] : null;
  const dayDelta     = yesterday?.value > 0
    ? Math.round(((todayBucket.value - yesterday.value) / yesterday.value) * 100)
    : null;

  return (
    <div
      className="card fade-up"
      style={{
        padding: 0,
        marginBottom: 16,
        animationDelay: "10ms",
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
            background: `${blue}14`,
            border: `1.5px solid ${blue}28`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Search size={15} color={blue} strokeWidth={2.4}/>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Fare Quote Searches</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>
              {stats.total.toLocaleString()} total · {stats.matchRate}% matched a driver
            </div>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div className="mono" style={{
            fontSize: 22, fontWeight: 700, color: C.text, lineHeight: 1,
            fontVariantNumeric: "tabular-nums", letterSpacing: "-.5px",
          }}>
            {stats.weekTotal.toLocaleString()}
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
        <BarChart buckets={stats.buckets} maxVal={stats.maxVal} color={blue}/>
      </div>

      {/* Footer stats */}
      <div style={{
        display: "flex",
        borderTop: `1px solid ${C.border}`,
        background: C.surfaceAlt ?? `${C.bg ?? "#FAFAFA"}`,
      }}>
        <div style={{ flex: 1, padding: "12px 14px", borderRight: `1px solid ${C.border}` }}>
          <div style={{
            fontSize: 9.5, color: C.textMuted, fontWeight: 700,
            letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 4,
          }}>
            Today
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            <span className="mono" style={{
              fontSize: 16, fontWeight: 700, color: C.text,
              fontVariantNumeric: "tabular-nums", letterSpacing: "-.3px",
            }}>
              {todayBucket?.value ?? 0}
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

        <div style={{ flex: 1, padding: "12px 14px", borderRight: `1px solid ${C.border}` }}>
          <div style={{
            fontSize: 9.5, color: C.textMuted, fontWeight: 700,
            letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 4,
          }}>
            Match Rate
          </div>
          <span className="mono" style={{
            fontSize: 16, fontWeight: 700,
            color: stats.matchRate >= 70 ? C.green : stats.matchRate >= 40 ? "#D97706" : C.red,
            fontVariantNumeric: "tabular-nums", letterSpacing: "-.3px",
          }}>
            {stats.matchRate}%
          </span>
          <div style={{ fontSize: 9, color: C.textDim, fontWeight: 600, marginTop: 2 }}>
            {stats.withDriverInfo}/{stats.total} matched
          </div>
        </div>

        <div style={{ flex: 1, padding: "12px 14px" }}>
          <div style={{
            fontSize: 9.5, color: C.textMuted, fontWeight: 700,
            letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 4,
          }}>
            Avg Trip
          </div>
          <span className="mono" style={{
            fontSize: 16, fontWeight: 700, color: C.text,
            fontVariantNumeric: "tabular-nums", letterSpacing: "-.3px",
          }}>
            {stats.avgMiles}<span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}> mi</span>
          </span>
          <div style={{ fontSize: 9, color: C.textDim, fontWeight: 600, marginTop: 2 }}>
            {stats.avgMinutes} min avg
          </div>
        </div>
      </div>

      {/* No-driver alert */}
      {stats.total > 0 && stats.matchRate < 50 && (
        <div style={{
          padding: "10px 14px",
          background: `${C.red}08`,
          borderTop: `1px solid ${C.red}22`,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: C.red, boxShadow: `0 0 6px ${C.red}88`,
          }}/>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.red }}>
            <strong>{stats.noDriverInfo}</strong> riders found no nearby drivers — recruit drivers in hot zones
          </span>
        </div>
      )}

      {/* Top drop-offs */}
      {stats.topDropoffs.length > 0 && (
        <div style={{ padding: "14px 18px 16px", borderTop: `1px solid ${C.border}` }}>
          <div style={{
            fontSize: 9.5, color: C.textMuted, fontWeight: 800,
            letterSpacing: ".5px", textTransform: "uppercase",
            marginBottom: 10,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <MapPin size={10} strokeWidth={2.4}/>
            Top Destinations
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {stats.topDropoffs.map(([addr, count]) => {
              const pct = (count / stats.total) * 100;
              return (
                <div
                  key={addr}
                  style={{
                    position: "relative",
                    background: `${blue}06`,
                    border: `1px solid ${blue}15`,
                    borderRadius: 8,
                    padding: "8px 12px",
                    overflow: "hidden",
                  }}
                >
                  <div style={{
                    position: "absolute",
                    top: 0, left: 0, bottom: 0,
                    width: `${pct}%`,
                    background: `linear-gradient(90deg,${blue}18,${blue}08)`,
                    transition: "width .6s cubic-bezier(.34,1.2,.64,1)",
                  }}/>
                  <div style={{
                    position: "relative",
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between", gap: 10,
                  }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: C.text,
                      whiteSpace: "nowrap", overflow: "hidden",
                      textOverflow: "ellipsis", flex: 1,
                    }}>
                      {addr}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span className="mono" style={{
                        fontSize: 11, color: C.textMuted, fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {pct.toFixed(0)}%
                      </span>
                      <span className="mono" style={{
                        fontSize: 12, fontWeight: 700, color: blue,
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

// ── Driver Signups Chart ─────────────────────────────────
function DriverSignupsChart({ uatobdrivers = [] }) {
  const stats = useMemo(() => {
    const buckets = buildWeekBuckets();

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
      const ms = tsToMs(d.createdAt);
      if (ms) {
        const day = new Date(ms);
        day.setHours(0, 0, 0, 0);
        const idx = buckets.findIndex(b => b.dateStr === day.toDateString());
        if (idx >= 0) buckets[idx].value++;
      }

      switch (d.status) {
        case "online":      online++;      break;
        case "offline":     offline++;     break;
        case "approved":    approved++;    break;
        case "pending":     pending++;     break;
        case "in_progress": inProgress++;  break;
        case "rejected":    rejected++;    break;
        case "suspended":   suspended++;   break;
        default:
          if (!d.status && (d.currentStep ?? 0) < 5) inProgress++;
      }

      const dc = docCompletion(d);
      if (dc.uploaded === dc.total) docsComplete++;
      if (d.accountId) stripeConnected++;
    });

    const weekSignups   = buckets.reduce((s, b) => s + b.value, 0);
    const maxVal        = Math.max(...buckets.map(b => b.value), 1);
    const active        = online + offline;
    const approvedAll   = approved + active;
    const conversionPct = total > 0 ? Math.round((approvedAll / total) * 100) : 0;

    return {
      buckets, weekSignups, maxVal,
      total, online, offline, approved, pending, inProgress, rejected, suspended,
      active, approvedAll, conversionPct, docsComplete, stripeConnected,
    };
  }, [uatobdrivers]);

  const green        = C.green;
  const todayBucket  = stats.buckets.find(b => b.isToday);
  const yesterdayIdx = stats.buckets.findIndex(b => b.isToday) - 1;
  const yesterday    = yesterdayIdx >= 0 ? stats.buckets[yesterdayIdx] : null;
  const dayDelta     = yesterday?.value > 0
    ? Math.round(((todayBucket.value - yesterday.value) / yesterday.value) * 100)
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
            background: `${green}14`,
            border: `1.5px solid ${green}28`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <UserPlus size={15} color={green} strokeWidth={2.4}/>
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

      <div style={{ padding: "18px 18px 14px" }}>
        <BarChart buckets={stats.buckets} maxVal={stats.maxVal} color={green}/>
      </div>

      <div style={{
        display: "flex",
        borderTop: `1px solid ${C.border}`,
        background: C.surfaceAlt ?? `${C.bg ?? "#FAFAFA"}`,
      }}>
        <div style={{ flex: 1, padding: "12px 14px", borderRight: `1px solid ${C.border}` }}>
          <div style={{
            fontSize: 9.5, color: C.textMuted, fontWeight: 700,
            letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 4,
          }}>
            Today
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            <span className="mono" style={{
              fontSize: 16, fontWeight: 700, color: C.text,
              fontVariantNumeric: "tabular-nums", letterSpacing: "-.3px",
            }}>
              {todayBucket?.value ?? 0}
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

        <div style={{ flex: 1, padding: "12px 14px", borderRight: `1px solid ${C.border}` }}>
          <div style={{
            fontSize: 9.5, color: C.textMuted, fontWeight: 700,
            letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 4,
          }}>
            Conversion
          </div>
          <span className="mono" style={{
            fontSize: 16, fontWeight: 700, color: C.text,
            fontVariantNumeric: "tabular-nums", letterSpacing: "-.3px",
          }}>
            {stats.conversionPct}%
          </span>
          <div style={{ fontSize: 9, color: C.textDim, fontWeight: 600, marginTop: 2 }}>
            {stats.approvedAll}/{stats.total} approved
          </div>
        </div>

        <div style={{ flex: 1, padding: "12px 14px" }}>
          <div style={{
            fontSize: 9.5, color: C.textMuted, fontWeight: 700,
            letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 4,
          }}>
            Docs Ready
          </div>
          <span className="mono" style={{
            fontSize: 16, fontWeight: 700, color: C.text,
            fontVariantNumeric: "tabular-nums", letterSpacing: "-.3px",
          }}>
            {stats.docsComplete}
          </span>
          <div style={{ fontSize: 9, color: C.textDim, fontWeight: 600, marginTop: 2 }}>
            All 5 uploaded
          </div>
        </div>
      </div>

      <div style={{ padding: "14px 18px 16px", borderTop: `1px solid ${C.border}` }}>
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
    const buckets = buildWeekBuckets();

    const pathCounts    = new Map();
    let mobileCount     = 0;
    let desktopCount    = 0;
    const totalSessions = new Set();
    const totalUsers    = new Set();

    views.forEach(v => {
      const ms = tsToMs(v.timestamp ?? v.createdAt);
      if (!ms) return;
      const d = new Date(ms);
      d.setHours(0, 0, 0, 0);
      const idx = buckets.findIndex(b => b.dateStr === d.toDateString());
      if (idx >= 0) buckets[idx].value++;

      const p = v.path || "/";
      pathCounts.set(p, (pathCounts.get(p) ?? 0) + 1);

      if (isMobile(v.userAgent, v.screen?.w)) mobileCount++;
      else desktopCount++;

      if (v.sessionId) totalSessions.add(v.sessionId);
      if (v.uid) totalUsers.add(v.uid);
    });

    const totalViews  = buckets.reduce((s, b) => s + b.value, 0);
    const maxVal      = Math.max(...buckets.map(b => b.value), 1);
    const topPaths    = [...pathCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const totalDevices = mobileCount + desktopCount;
    const mobilePct   = totalDevices > 0 ? Math.round((mobileCount / totalDevices) * 100) : 0;

    return {
      buckets, totalViews, maxVal,
      totalSessions: totalSessions.size,
      totalUsers: totalUsers.size,
      mobileCount, desktopCount, mobilePct,
      topPaths,
    };
  }, [views]);

  const purple       = C.violet ?? "#7C3AED";
  const todayBucket  = stats.buckets.find(b => b.isToday);
  const yesterdayIdx = stats.buckets.findIndex(b => b.isToday) - 1;
  const yesterday    = yesterdayIdx >= 0 ? stats.buckets[yesterdayIdx] : null;
  const dayDelta     = yesterday?.value > 0
    ? Math.round(((todayBucket.value - yesterday.value) / yesterday.value) * 100)
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
            background: `${purple}14`,
            border: `1.5px solid ${purple}28`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Eye size={15} color={purple} strokeWidth={2.4}/>
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
        <BarChart buckets={stats.buckets} maxVal={stats.maxVal} color={purple}/>
      </div>

      <div style={{
        display: "flex",
        borderTop: `1px solid ${C.border}`,
        background: C.surfaceAlt ?? `${C.bg ?? "#FAFAFA"}`,
      }}>
        <div style={{ flex: 1, padding: "12px 14px", borderRight: `1px solid ${C.border}` }}>
          <div style={{
            fontSize: 9.5, color: C.textMuted, fontWeight: 700,
            letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 4,
          }}>
            Today
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            <span className="mono" style={{
              fontSize: 16, fontWeight: 700, color: C.text,
              fontVariantNumeric: "tabular-nums", letterSpacing: "-.3px",
            }}>
              {todayBucket?.value ?? 0}
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

        <div style={{ flex: 1, padding: "12px 14px", borderRight: `1px solid ${C.border}` }}>
          <div style={{
            fontSize: 9.5, color: C.textMuted, fontWeight: 700,
            letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 4,
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

        <div style={{ flex: 1, padding: "12px 14px" }}>
          <div style={{
            fontSize: 9.5, color: C.textMuted, fontWeight: 700,
            letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 4,
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
        <div style={{ padding: "14px 18px 16px", borderTop: `1px solid ${C.border}` }}>
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
                      whiteSpace: "nowrap", overflow: "hidden",
                      textOverflow: "ellipsis", flex: 1,
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

// ── Rides This Week (Stacked Fare Breakdown) ─────────────
function RidesChart({ rides = [] }) {
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: null });

  const stats = useMemo(() => {
    const buckets = buildWeekBuckets().map(b => ({
      ...b,
      rides:    [],
      fare:     0,
      platform: 0,
      driver:   0,
    }));

    let totalFare = 0, totalPlatform = 0, totalDriver = 0;

    rides.forEach(r => {
      const ms = tsToMs(r.createdAt);
      if (!ms) return;
      const d = new Date(ms); d.setHours(0, 0, 0, 0);
      const idx = buckets.findIndex(b => b.dateStr === d.toDateString());
      if (idx >= 0) {
        buckets[idx].rides.push(r);
        buckets[idx].fare     += r.fareTotal    ?? 0;
        buckets[idx].platform += r.platformFee  ?? 0;
        buckets[idx].driver   += r.driverPayout ?? 0;
      }
      totalFare     += r.fareTotal    ?? 0;
      totalPlatform += r.platformFee  ?? 0;
      totalDriver   += r.driverPayout ?? 0;
    });

    const totalRides = rides.length;
    const maxFare    = Math.max(...buckets.map(b => b.fare), 1);
    const platPct    = totalFare > 0 ? Math.round((totalPlatform / totalFare) * 100) : 25;
    const driverPct  = totalFare > 0 ? Math.round((totalDriver   / totalFare) * 100) : 75;
    const avgFare    = totalRides > 0 ? totalFare / totalRides : 0;

    return {
      buckets, totalRides, totalFare, totalPlatform, totalDriver,
      maxFare, platPct, driverPct, avgFare,
    };
  }, [rides]);

  const recentRides = useMemo(() =>
    [...rides]
      .sort((a, b) => tsToMs(b.createdAt) - tsToMs(a.createdAt))
      .slice(0, 5),
    [rides]
  );

  const STATUS_COLORS = {
    completed:        C.green   ?? "#22C55E",
    searching_driver: C.amber   ?? "#D97706",
    in_progress:      C.blue    ?? "#2563EB",
    cancelled:        C.red     ?? "#DC2626",
    expired:          C.textDim ?? "#9CA3AF",
  };

  const PLATFORM_COLOR = C.blue  ?? "#2563EB";
  const DRIVER_COLOR   = C.green ?? "#22C55E";

  return (
    <div
      className="card fade-up"
      style={{
        padding: 0, marginBottom: 16, animationDelay: "40ms", opacity: 0,
        boxShadow: "0 1px 8px rgba(0,0,0,.05)", overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{
        padding: "16px 18px 14px", borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: `${C.amber}14`, border: `1.5px solid ${C.amber}28`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Activity size={15} color={C.amber} strokeWidth={2.4}/>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Rides This Week</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>
              {stats.totalRides} ride{stats.totalRides !== 1 ? "s" : ""} · ${stats.totalFare.toFixed(2)} collected
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="mono" style={{
            fontSize: 22, fontWeight: 700, color: C.text, lineHeight: 1,
            fontVariantNumeric: "tabular-nums", letterSpacing: "-.5px",
          }}>
            {stats.totalRides.toLocaleString()}
          </div>
          <div style={{
            fontSize: 10, color: C.textMuted, fontWeight: 700,
            marginTop: 4, letterSpacing: ".3px", textTransform: "uppercase",
          }}>
            Total
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{
        display: "flex", borderBottom: `1px solid ${C.border}`,
        background: C.surfaceAlt ?? `${C.bg ?? "#FAFAFA"}`,
      }}>
        <div style={{ flex: 1, padding: "12px 14px", borderRight: `1px solid ${C.border}` }}>
          <div style={{
            fontSize: 9.5, color: C.textMuted, fontWeight: 700,
            letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 4,
          }}>
            Revenue
          </div>
          <span className="mono" style={{
            fontSize: 16, fontWeight: 700, color: C.text,
            fontVariantNumeric: "tabular-nums", letterSpacing: "-.3px",
          }}>
            ${stats.totalFare.toFixed(2)}
          </span>
          <div style={{ fontSize: 9, color: C.textDim, fontWeight: 600, marginTop: 2 }}>
            ${stats.avgFare.toFixed(2)} avg fare
          </div>
        </div>

        <div style={{ flex: 1, padding: "12px 14px", borderRight: `1px solid ${C.border}` }}>
          <div style={{
            fontSize: 9.5, color: C.textMuted, fontWeight: 700,
            letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 4,
          }}>
            UaTob Keeps
          </div>
          <span className="mono" style={{
            fontSize: 16, fontWeight: 700, color: PLATFORM_COLOR,
            fontVariantNumeric: "tabular-nums", letterSpacing: "-.3px",
          }}>
            ${stats.totalPlatform.toFixed(2)}
          </span>
          <div style={{ fontSize: 9, color: C.textDim, fontWeight: 600, marginTop: 2 }}>
            {stats.platPct}% of fares
          </div>
        </div>

        <div style={{ flex: 1, padding: "12px 14px" }}>
          <div style={{
            fontSize: 9.5, color: C.textMuted, fontWeight: 700,
            letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 4,
          }}>
            Drivers Keep
          </div>
          <span className="mono" style={{
            fontSize: 16, fontWeight: 700, color: DRIVER_COLOR,
            fontVariantNumeric: "tabular-nums", letterSpacing: "-.3px",
          }}>
            ${stats.totalDriver.toFixed(2)}
          </span>
          <div style={{ fontSize: 9, color: C.textDim, fontWeight: 600, marginTop: 2 }}>
            {stats.driverPct}% of fares
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ padding: "10px 18px 0", display: "flex", alignItems: "center", gap: 14 }}>
        {[
          { color: DRIVER_COLOR,   label: `Driver payout (${stats.driverPct}%)` },
          { color: PLATFORM_COLOR, label: `Platform fee (${stats.platPct}%)` },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{
              width: 10, height: 10, borderRadius: 2,
              background: item.color, flexShrink: 0,
            }}/>
            <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Stacked bar chart */}
      <div style={{ padding: "14px 18px 6px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 110 }}>
          {stats.buckets.map((b, i) => {
            const totalH = b.isFuture
              ? 0
              : Math.max((b.fare / stats.maxFare) * 90, b.fare > 0 ? 8 : 0);
            const driverH   = totalH > 0 ? (b.driver / b.fare) * totalH : 0;
            const platformH = totalH - driverH;

            return (
              <div
                key={DAYS[i]}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
              >
                {!b.isFuture && b.fare > 0 ? (
                  <div className="mono" style={{
                    fontSize: 9, fontWeight: 700,
                    color: b.isToday ? C.amber : C.textDim,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    ${b.fare.toFixed(0)}
                  </div>
                ) : (
                  <div style={{ fontSize: 9, color: "transparent" }}>·</div>
                )}

                {b.isFuture || b.fare === 0 ? (
                  <div style={{
                    width: "100%", height: 4, borderRadius: "4px 4px 0 0",
                    background: C.borderLight ?? C.border,
                    border: `1px solid ${C.border}`,
                  }}/>
                ) : (
                  <div
                    style={{
                      width: "100%", borderRadius: "4px 4px 0 0", overflow: "hidden",
                      display: "flex", flexDirection: "column",
                      height: `${totalH}px`, cursor: "pointer",
                      outline: b.isToday ? `1.5px solid ${C.amber}` : "none",
                      outlineOffset: 1,
                    }}
                    onMouseEnter={e => setTooltip({
                      visible: true, x: e.clientX, y: e.clientY,
                      content: (
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, color: C.text }}>
                            {b.label} — {b.rides.length} ride{b.rides.length !== 1 ? "s" : ""}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 3, fontSize: 11 }}>
                            <span style={{ color: C.textMuted }}>Total fare</span>
                            <span style={{ fontWeight: 700, color: C.text }}>${b.fare.toFixed(2)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 3, fontSize: 11 }}>
                            <span style={{ color: PLATFORM_COLOR }}>Platform keeps</span>
                            <span style={{ fontWeight: 700, color: PLATFORM_COLOR }}>${b.platform.toFixed(2)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 11 }}>
                            <span style={{ color: DRIVER_COLOR }}>Drivers keep</span>
                            <span style={{ fontWeight: 700, color: DRIVER_COLOR }}>${b.driver.toFixed(2)}</span>
                          </div>
                        </div>
                      ),
                    })}
                    onMouseMove={e => setTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY }))}
                    onMouseLeave={() => setTooltip(prev => ({ ...prev, visible: false }))}
                  >
                    {/* Platform segment (top) */}
                    <div style={{
                      height: `${platformH}px`,
                      background: PLATFORM_COLOR,
                      opacity: b.isToday ? 1 : 0.55,
                    }}/>
                    {/* Driver segment (bottom) */}
                    <div style={{
                      height: `${driverH}px`,
                      background: DRIVER_COLOR,
                      opacity: b.isToday ? 1 : 0.55,
                    }}/>
                  </div>
                )}

                <div style={{
                  fontSize: 9,
                  color: b.isToday ? C.amber : C.textDim,
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

      {/* Recent rides list */}
      {recentRides.length > 0 && (
        <div style={{ padding: "12px 18px 16px", borderTop: `1px solid ${C.border}` }}>
          <div style={{
            fontSize: 9.5, color: C.textMuted, fontWeight: 800,
            letterSpacing: ".5px", textTransform: "uppercase",
            marginBottom: 8, display: "flex", alignItems: "center", gap: 5,
          }}>
            <MapPin size={10} strokeWidth={2.4}/>
            Recent Rides
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {recentRides.map((r, i) => {
              const sc = STATUS_COLORS[r.status] ?? C.textDim;
              return (
                <div
                  key={r.id ?? i}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 0",
                    borderBottom: i < recentRides.length - 1 ? `1px solid ${C.border}` : "none",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 11, color: C.text, fontWeight: 700,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {(r.pickup  ?? "").split(",")[0] || "—"} → {(r.dropoff ?? "").split(",")[0] || "—"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 10, color: sc, fontWeight: 700, textTransform: "capitalize" }}>
                        {(r.status ?? "").replace(/_/g, " ")}
                      </span>
                      <span style={{ fontSize: 10, color: C.textDim }}>
                        · {r.tripDistanceMiles?.toFixed(1)} mi · {r.rideType}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div className="mono" style={{
                      fontSize: 13, fontWeight: 700, color: C.text,
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      ${(r.fareTotal ?? 0).toFixed(2)}
                    </div>
                    <div style={{ display: "flex", gap: 5, justifyContent: "flex-end", marginTop: 2 }}>
                      <span className="mono" style={{ fontSize: 9.5, color: DRIVER_COLOR, fontWeight: 700 }}>
                        drv ${(r.driverPayout ?? 0).toFixed(2)}
                      </span>
                      <span style={{ fontSize: 9.5, color: C.textDim }}>·</span>
                      <span className="mono" style={{ fontSize: 9.5, color: PLATFORM_COLOR, fontWeight: 700 }}>
                        plat ${(r.platformFee ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip.visible && (
        <div style={{
          position: "fixed",
          left: tooltip.x + 14, top: tooltip.y - 90,
          zIndex: 999,
          background: C.surface ?? "#fff",
          border: `1px solid ${C.border}`,
          borderRadius: 10, padding: "10px 14px",
          pointerEvents: "none", minWidth: 170,
          boxShadow: "0 4px 16px rgba(0,0,0,.1)",
        }}>
          {tooltip.content}
        </div>
      )}
    </div>
  );
}

// ── Top Drivers Leaderboard ──────────────────────────────
function TopDriversLeaderboard({ topDrivers = [] }) {
  const maxRides = Math.max(...topDrivers.map(d => d.rides ?? 0), 1);

  const getRankStyle = (rank) => {
    switch (rank) {
      case 0: return { color: "#F59E0B", bg: "#FEF3C7", icon: "👑", label: "GOLD",   gradient: "linear-gradient(135deg,#F59E0B,#D97706)" };
      case 1: return { color: "#9CA3AF", bg: "#F3F4F6", icon: "🥈", label: "SILVER", gradient: "linear-gradient(135deg,#9CA3AF,#6B7280)" };
      case 2: return { color: "#B45309", bg: "#FEF3C7", icon: "🥉", label: "BRONZE", gradient: "linear-gradient(135deg,#B45309,#92400E)" };
      default: return { color: C.textMuted, bg: C.surfaceAlt ?? "#F9FAFB", icon: null, label: null, gradient: null };
    }
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12, padding: "0 2px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Crown size={14} color="#F59E0B" strokeWidth={2.4}/>
          <span style={{
            fontSize: 11, fontWeight: 800, color: C.text,
            letterSpacing: ".5px", textTransform: "uppercase",
          }}>
            Top Drivers
          </span>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, color: C.textMuted,
          letterSpacing: ".3px", textTransform: "uppercase",
        }}>
          This Week
        </span>
      </div>

      {topDrivers.length === 0 ? (
        <div
          className="card"
          style={{
            padding: "32px 16px",
            textAlign: "center",
            boxShadow: "0 1px 6px rgba(0,0,0,.04)",
          }}
        >
          <Crown size={28} color={C.textDim} strokeWidth={1.6} style={{ marginBottom: 10 }}/>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>
            No completed rides yet
          </div>
          <div style={{ fontSize: 11, color: C.textMuted }}>
            Top drivers will appear here once trips start completing
          </div>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,.04)" }}>
          {topDrivers.map((d, i) => {
            const rank     = getRankStyle(i);
            const ridePct  = ((d.rides ?? 0) / maxRides) * 100;
            const rating   = d.averageRating;
            const isPodium = i < 3;

            return (
              <div
                key={d.uid ?? i}
                style={{
                  position: "relative",
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px",
                  borderBottom: i < topDrivers.length - 1 ? `1px solid ${C.border}` : "none",
                  background: isPodium ? `${rank.color}05` : "transparent",
                  transition: "background .15s",
                }}
              >
                {/* Rank medallion */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: rank.gradient ?? rank.bg,
                  flexShrink: 0,
                  boxShadow: isPodium ? `0 4px 10px ${rank.color}40` : "none",
                  border: isPodium ? `1.5px solid ${rank.color}50` : `1.5px solid ${C.border}`,
                }}>
                  <span className="mono" style={{
                    fontSize: 15, fontWeight: 900,
                    color: isPodium ? "#fff" : C.text,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-.5px",
                  }}>
                    {i + 1}
                  </span>
                </div>

                {/* Avatar with crown for #1 */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <Avatar name={d.name ?? d.uid} size={40} colorIdx={i}/>
                  {i === 0 && (
                    <div style={{
                      position: "absolute",
                      top: -8, right: -6,
                      width: 18, height: 18,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg,#F59E0B,#D97706)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      border: "2px solid #fff",
                      boxShadow: "0 2px 4px rgba(0,0,0,.2)",
                    }}>
                      <Crown size={9} color="#fff" strokeWidth={3} fill="#fff"/>
                    </div>
                  )}
                </div>

                {/* Name + stats */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 14, fontWeight: 700, color: C.text,
                      whiteSpace: "nowrap", overflow: "hidden",
                      textOverflow: "ellipsis", maxWidth: 160,
                      letterSpacing: "-.1px",
                    }}>
                      {d.name ?? d.uid}
                    </span>
                    {isPodium && rank.label && (
                      <span style={{
                        fontSize: 8.5, fontWeight: 800, color: "#fff",
                        background: rank.gradient,
                        padding: "2px 6px", borderRadius: 100,
                        letterSpacing: ".4px",
                      }}>
                        {rank.label}
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div style={{
                    height: 5, borderRadius: 100,
                    background: `${rank.color}15`,
                    overflow: "hidden", marginBottom: 6, maxWidth: 220,
                  }}>
                    <div style={{
                      width: `${ridePct}%`, height: "100%",
                      background: rank.gradient ?? `linear-gradient(90deg,${C.green},${C.green}cc)`,
                      borderRadius: 100,
                      transition: "width .8s cubic-bezier(.34,1.2,.64,1)",
                    }}/>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: C.textMuted }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: "var(--mono)" }}>
                      <Car size={9} strokeWidth={2.4}/>
                      <span style={{ fontWeight: 700, color: C.text }}>{d.rides ?? 0}</span>
                      <span> rides</span>
                    </span>

                    {rating !== undefined && rating !== null && (
                      <>
                        <span style={{ color: C.textDim }}>·</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: "var(--mono)" }}>
                          <Star
                            size={9} strokeWidth={2.4}
                            color={rating >= 4.8 ? "#F59E0B" : C.textMuted}
                            fill={rating  >= 4.8 ? "#F59E0B" : "none"}
                          />
                          <span style={{ fontWeight: 700, color: rating >= 4.8 ? "#F59E0B" : C.text }}>
                            {rating.toFixed(2)}
                          </span>
                        </span>
                      </>
                    )}

                    {d.earnings !== undefined && d.earnings !== null && (
                      <>
                        <span style={{ color: C.textDim }}>·</span>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 2,
                          fontFamily: "var(--mono)", fontWeight: 700, color: C.green,
                        }}>
                          ${d.earnings.toFixed(0)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Podium badge */}
                {isPodium && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 3,
                      padding: "3px 8px",
                      background: `${rank.color}15`,
                      border: `1px solid ${rank.color}30`,
                      borderRadius: 100,
                    }}>
                      <ArrowUpRight size={10} color={rank.color} strokeWidth={2.6}/>
                      <span style={{
                        fontSize: 9.5, fontWeight: 800, color: rank.color, letterSpacing: ".3px",
                      }}>
                        TOP {i + 1}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────
export function AnalyticsTab({
  uatobdrivers     = [],
  views            = [],
  searches         = [],
  rides            = [],
  avgTripDuration  = 0,
  avgFare          = 0,
  acceptanceRate   = 0,
  cancellationRate = 0,
  topDrivers       = [],
  totalRides       = 0,
  ridesPerDay      = [0, 0, 0, 0, 0, 0, 0],
}) {
  return (
    <div style={{ padding: "0 16px 16px" }}>

      {/* ─── PAGE VIEWS ─── */}
      <ViewsChart views={views}/>

      {/* ─── FARE QUOTE SEARCHES ─── */}
      <SearchesChart searches={searches}/>

      {/* ─── DRIVER SIGNUPS ─── */}
      <DriverSignupsChart uatobdrivers={uatobdrivers}/>

      {/* ─── RIDES THIS WEEK (stacked fare breakdown) ─── */}
      <RidesChart rides={rides}/>

      {/* ─── TOP DRIVERS LEADERBOARD ─── */}
      <TopDriversLeaderboard topDrivers={topDrivers}/>

    </div>
  );
}