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

const STATUS_META = {
  searching_driver: { label: "Searching driver", dot: "#BA7517", bg: "#FAEEDA", color: "#854F0B" },
  in_progress:      { label: "In progress",       dot: "#639922", bg: "#EAF3DE", color: "#3B6D11" },
  arrived:          { label: "Arrived",            dot: "#639922", bg: "#EAF3DE", color: "#3B6D11" },
  completed:        { label: "Completed",          dot: "#888780", bg: "#F1EFE8", color: "#5F5E5A" },
  cancelled:        { label: "Cancelled",          dot: "#E24B4A", bg: "#FCEBEB", color: "#A32D2D" },
};

export function HomeTab({
  liveRides = [],
  totalAccounts = 0,
  uatobdrivers = [],
  activeRides = [],
  searchingRides = [],
  totalRides = 0,
  activeDrivers = [],
  revenue = 0,
  approvals = [],
  onToast,
}) {
  console.log(approvals);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); onToast?.("Data refreshed"); }, 1100);
  };

  const pendingApprovals = approvals.filter(d => d.status !== "approved");

  return (
    <div style={{ padding: "0 16px 16px" }}>

      {/* Live status bar */}
      <div
        className="card fade-up"
        style={{
          padding: "11px 16px",
          marginBottom: 16,
          animationDelay: "40ms",
          opacity: 0,
          boxShadow: "0 1px 6px rgba(0,0,0,.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { dot: "#639922", label: `${totalAccounts} accounts` },
              { dot: "#BA7517", label: `${uatobdrivers.length} drivers` },
              { dot: "#639922", label: `${activeRides.length} active rides` },
              { dot: "#BA7517", label: `${searchingRides.length} searching` },
            ].map(({ dot, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
              </div>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, display: "flex", padding: 0 }}
          >
            <RefreshCw size={15} style={{ animation: refreshing ? "spinAnim 1s linear infinite" : "none" }} />
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <StatCard label="Total Rides"        value={totalRides ?? liveRides.length} icon={Activity}    color={C.blue}  delay={80}  />
        <StatCard label="Active Drivers"     value={activeDrivers.length}           icon={Car}         color={C.green} delay={130} />
        <StatCard label="Revenue Today"      value={revenue != null ? `${revenue.toFixed(2)}` : "—"} icon={DollarSign} color={C.amber} delay={180} />
        <StatCard label="Pending Approvals"  value={pendingApprovals.length}        icon={Shield}      color={C.red}   delay={230} />
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
  const driverLabel = ride.driverName ?? (ride.driverId ? `Driver …${ride.driverId.slice(-4)}` : "No driver yet");

  const s = STATUS_META[ride.status] ?? { label: ride.status, dot: "#888780", bg: "#F1EFE8", color: "#5F5E5A" };

  return (
    <div
      className="card fade-up"
      style={{ padding: "14px 16px", animationDelay: `${delay}ms`, opacity: 0 }}
    >

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={riderLabel} size={36} colorIdx={1} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{riderLabel}</div>
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}>{driverLabel}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 20,
            background: s.bg, color: s.color,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, display: "inline-block" }} />
            {s.label}
          </span>
          <span style={{ fontSize: 18, fontWeight: 500, color: "#3B6D11" }}>
            ${ride.fareTotal?.toFixed(2) ?? "—"}
          </span>
        </div>
      </div>

      {/* Route block */}
      <div style={{
        background: "#F8F8F6",
        border: "0.5px solid #E5E5E2",
        borderRadius: 8,
        padding: "10px 12px",
        display: "flex",
        gap: 10,
        alignItems: "center",
      }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { dot: "#639922", label: "Pickup",  addr: ride.pickup },
            { dot: "#E24B4A", label: "Dropoff", addr: ride.dropoff },
          ].map(({ dot, label, addr }) => (
            <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: dot, marginTop: 4, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 1 }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3 }}>{shortAddress(addr)}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ width: 1, background: "#E5E5E2", alignSelf: "stretch", margin: "0 2px" }} />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: "#6B7280" }}>{ride.rideLabel ?? ride.rideType}</span>
          <span style={{ fontSize: 10, color: "#9CA3AF" }}>
            {ride.tripDistanceMiles > 0 ? `${ride.tripDistanceMiles} mi` : "0 mi"} · {ride.tripDurationMin ?? 0} min
          </span>
          <span style={{ fontSize: 10, color: "#9CA3AF" }}>{timeAgo(ride.createdAt)}</span>
        </div>
      </div>

      {/* Footer tags + payout split */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        <span style={{
          fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 4,
          background: ride.paymentMethod === "cashapp" ? "#EAF3DE" : "#E6F1FB",
          color:      ride.paymentMethod === "cashapp" ? "#3B6D11" : "#185FA5",
        }}>
          {ride.paymentMethod === "cashapp" ? "Cash App" : ride.paymentMethod}
        </span>

        <span style={{
          fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 4,
          background: ride.payoutStatus === "pending" ? "#FAEEDA" : "#EAF3DE",
          color:      ride.payoutStatus === "pending" ? "#854F0B" : "#3B6D11",
        }}>
          Payout {ride.payoutStatus}
        </span>

        <div style={{ marginLeft: "auto", fontSize: 10, color: "#9CA3AF" }}>
          Payout{" "}
          <span style={{ color: "#374151", fontWeight: 600 }}>${ride.driverPayout?.toFixed(2) ?? "—"}</span>
          {" "}· Fee{" "}
          <span style={{ color: "#374151", fontWeight: 600 }}>${ride.platformFee?.toFixed(2) ?? "—"}</span>
        </div>
      </div>

      {/* Ride ID */}
      <div style={{ marginTop: 6, fontSize: 10, color: "#9CA3AF", fontFamily: "monospace", letterSpacing: ".3px" }}>
        {ride.id}
      </div>
    </div>
  );
}