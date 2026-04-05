import { useState } from "react";
import {
  Activity, DollarSign, Car, Shield,
  RefreshCw, Filter,
} from "lucide-react";
import { C } from '@/App/Admin/Tokens';
import { StatCard, SectionHeader, Avatar, StatusPill } from '@/App/Admin/UI';

function timeAgo(ts) {
  if (!ts) return "—";
  const seconds = ts?.seconds ?? Math.floor(ts / 1000);
  const diff = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function shortAddress(addr = "") {
  return addr.split(",")[0] || addr;
}

export function HomeTab({ liveRides = [], totalRides, activeDrivers = [], revenue, approvals = [], onToast }) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); onToast?.("Data refreshed"); }, 1100);
  };

  const activeCount = liveRides.filter(r => ["in_progress", "arrived"].includes(r.status)).length;
  const searchCount = liveRides.filter(r => r.status === "searching_driver").length;

  // Pending approvals = drivers whose status is not yet 'approved'
  const pendingApprovals = approvals.filter(d => d.status !== "approved");

  return (
    <div style={{ padding: "0 16px 16px" }}>

      {/* Live status bar */}
      <div className="card fade-up" style={{ padding: "12px 16px", marginBottom: 16, animationDelay: "40ms", opacity: 0, boxShadow: "0 1px 6px rgba(0,0,0,.05)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div className="live-dot" />
              <span style={{ fontSize: 12, fontWeight: 700 }}>{activeCount} active rides</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div className="amber-dot" />
              <span style={{ fontSize: 12, fontWeight: 700 }}>{searchCount} searching</span>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, display: "flex" }}
          >
            <RefreshCw size={15} style={{ animation: refreshing ? "spinAnim 1s linear infinite" : "none" }} />
          </button>
        </div>
      </div>

      {/* Stats grid — all values come from real props now */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <StatCard
          label="Total Rides"
          value={totalRides ?? liveRides.length}
          icon={Activity}
          color={C.blue}
          delay={80}
        />
        <StatCard
          label="Active Drivers"
          value={activeDrivers.length}
          icon={Car}
          color={C.green}
          delay={130}
        />
        <StatCard
          label="Revenue Today"
          value={revenue != null ? `${revenue.toFixed(2)}` : "—"}
          icon={DollarSign}
          color={C.amber}
          delay={180}
        />
        <StatCard
          label="Pending Approvals"
          value={pendingApprovals.length}
          icon={Shield}
          color={C.red}
          delay={230}
        />
      </div>

      {/* Live rides list */}
      <SectionHeader
        title={`Live Rides${liveRides.length ? ` (${liveRides.length})` : ""}`}
        action={
          <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: 11 }}>
            <Filter size={11} /> Filter
          </button>
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {liveRides.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 0", color: C.textMuted, fontSize: 13 }}>
            No rides yet
          </div>
        )}
        {liveRides.map((ride, i) => (
          <RideCard key={ride.id} ride={ride} delay={280 + i * 55} />
        ))}
      </div>
    </div>
  );
}

function RideCard({ ride, delay }) {
  const riderLabel  = ride.riderName  ?? `Rider …${ride.uid?.slice(-4) ?? "?"}`;
  const driverLabel = ride.driverName ?? (ride.driverId ? `Driver …${ride.driverId.slice(-4)}` : "—");

  return (
    <div
      className="card fade-up"
      style={{ padding: "14px 16px", animationDelay: `${delay}ms`, opacity: 0, boxShadow: "0 1px 5px rgba(0,0,0,.04)" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={riderLabel} size={34} colorIdx={1} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{riderLabel}</div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>{driverLabel}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
          <StatusPill status={ride.status} />
          <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: "#16A34A" }}>
            ${ride.fareTotal?.toFixed(2) ?? "—"}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#EEF1EE", borderRadius: 8, padding: "7px 10px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, letterSpacing: ".5px", marginBottom: 2 }}>
            FROM → TO · {ride.rideLabel ?? ride.rideType}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>
            {shortAddress(ride.pickup)} → {shortAddress(ride.dropoff)}
          </div>
        </div>
        <div style={{ fontSize: 10, color: "#9CA3AF" }}>{timeAgo(ride.createdAt)}</div>
      </div>

      <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: ".4px", textTransform: "uppercase",
          background: ride.paymentMethod === "cashapp" ? "#1A9141" : "#2563EB",
          color: "#fff", padding: "2px 7px", borderRadius: 4
        }}>
          {ride.paymentMethod}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: ".4px", textTransform: "uppercase",
          background: ride.payoutStatus === "pending" ? "#F59E0B22" : "#16A34A22",
          color: ride.payoutStatus === "pending" ? "#B45309" : "#15803D",
          padding: "2px 7px", borderRadius: 4
        }}>
          payout: {ride.payoutStatus}
        </span>
      </div>
    </div>
  );
}
