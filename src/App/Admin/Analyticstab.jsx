// src/App/UaTob/Admin/tabs/AnalyticsTab.jsx
import { Clock, CheckCircle, XCircle, DollarSign, ArrowUpRight } from "lucide-react";
import { C } from '@/App/Admin/Tokens';
import { Avatar, SectionHeader } from '@/App/Admin/UI';

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function AnalyticsTab({
  avgTripDuration  = 0,
  avgFare          = 0,
  acceptanceRate   = 0,
  cancellationRate = 0,
  topDrivers       = [],
  totalRides       = 0,
  ridesPerDay      = [0, 0, 0, 0, 0, 0, 0],
}) {
  const formatDuration = (minutes) => {
    const m = Math.floor(minutes);
    const s = Math.round((minutes - m) * 60);
    return `${m}m ${s}s`;
  };

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

      {/* Bar chart */}
      <div
        className="card fade-up"
        style={{ padding: "18px", marginBottom: 16, animationDelay: "40ms", opacity: 0, boxShadow: "0 1px 8px rgba(0,0,0,.05)" }}
      >
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Rides This Week</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>Total: {totalRides} rides</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
          {ridesPerDay.map((val, i) => (
            <div
              key={DAYS[i]}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}
            >
              <div style={{
                width: "100%",
                borderRadius: "4px 4px 0 0",
                height: `${(val / maxVal) * 80}px`,
                background: i === todayIdx
                  ? "linear-gradient(180deg,#22C55E,#15803D)"
                  : `${C.green}20`,
                border: `1px solid ${C.green}${i === todayIdx ? "bb" : "30"}`,
                transition: "height .6s cubic-bezier(.34,1.2,.64,1)",
              }} />
              <div style={{ fontSize: 9, color: C.textDim, fontWeight: 700 }}>{DAYS[i]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Key metrics */}
      <SectionHeader title="Key Metrics" />
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
              <Icon size={15} color={color} />
            </div>
            <div className="mono" style={{ fontSize: 17, fontWeight: 600, marginBottom: 3 }}>{value}</div>
            <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: ".3px" }}>
              {label.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      {/* Top drivers */}
      <SectionHeader title="Top Drivers" />
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
              <Avatar name={d.name ?? d.uid} size={32} colorIdx={i} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{d.name ?? d.uid}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>
                  {d.rides} rides · ★ {d.averageRating?.toFixed(2) ?? "—"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.green, fontWeight: 700 }}>
                <ArrowUpRight size={11} /> Top
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}