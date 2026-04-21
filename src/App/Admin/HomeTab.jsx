import { useState, useMemo } from "react";
import {
  Activity, DollarSign, Car, Shield,
  RefreshCw, Filter, Search, X, ChevronDown, TrendingUp,
} from "lucide-react";
import { C } from '@/App/Admin/Tokens';
import { StatCard, SectionHeader, Avatar } from '@/App/Admin/UI';

// ── Helpers ───────────────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return "—";
  const seconds = ts?.seconds ?? Math.floor(ts / 1000);
  const diff = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function shortAddress(addr = "") {
  return addr.split(",")[0] || addr;
}

function tsToMs(ts) {
  if (!ts) return 0;
  if (ts?.seconds) return ts.seconds * 1000;
  if (typeof ts === "number") return ts;
  return 0;
}

// ── Status maps ───────────────────────────────────────────────────────
const STATUS_META = {
  searching_driver: { label: "Searching driver", dot: "#BA7517", bg: "#FAEEDA", color: "#854F0B" },
  in_progress:      { label: "In progress",      dot: "#639922", bg: "#EAF3DE", color: "#3B6D11" },
  arrived:          { label: "Arrived",           dot: "#185FA5", bg: "#E6F1FB", color: "#185FA5" },
  completed:        { label: "Completed",         dot: "#888780", bg: "#F1EFE8", color: "#5F5E5A" },
  cancelled:        { label: "Cancelled",         dot: "#E24B4A", bg: "#FCEBEB", color: "#A32D2D" },
};

const PAYMENT_META = {
  succeeded: { bg: "#EAF3DE", color: "#3B6D11", label: "Payment succeeded" },
  pending:   { bg: "#FAEEDA", color: "#854F0B", label: "Payment pending"   },
  failed:    { bg: "#FCEBEB", color: "#A32D2D", label: "Payment failed"    },
};

const PAYOUT_META = {
  processing: { bg: "#E6F1FB", color: "#185FA5", label: "Payout processing" },
  pending:    { bg: "#FAEEDA", color: "#854F0B", label: "Payout pending"    },
  paid:       { bg: "#EAF3DE", color: "#3B6D11", label: "Paid out"          },
  failed:     { bg: "#FCEBEB", color: "#A32D2D", label: "Payout failed"     },
};

const ACCENT_BAR = {
  searching_driver: "linear-gradient(90deg,#BA7517,#F0A733)",
  in_progress:      "linear-gradient(90deg,#639922,#8DC53E)",
  arrived:          "linear-gradient(90deg,#185FA5,#3B82F6)",
  completed:        "#D1D5DB",
  cancelled:        "linear-gradient(90deg,#E24B4A,#F87171)",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Weekly Summary ────────────────────────────────────────────────────
function WeeklySummary({ allRides = [] }) {
  // Build 7-day buckets starting from last Sunday
  const now     = new Date();
  const dayOfWk = now.getDay(); // 0=Sun
  const sunday  = new Date(now);
  sunday.setHours(0, 0, 0, 0);
  sunday.setDate(now.getDate() - dayOfWk);

  const buckets = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return {
      label:        DAY_LABELS[d.getDay()],
      dateStr:      d.toDateString(),
      isToday:      d.toDateString() === now.toDateString(),
      isFuture:     d > now,
      rides:        0,
      fareTotal:    0,
      platformFee:  0,
      driverPayout: 0,
    };
  });

  // Filter only completed rides this week and bucket them
  allRides
    .filter(r => r.status === "completed")
    .forEach(r => {
      const ms = tsToMs(r.completedAt ?? r.updatedAt ?? r.createdAt);
      if (!ms) return;
      const d = new Date(ms);
      d.setHours(0, 0, 0, 0);
      const idx = buckets.findIndex(b => b.dateStr === d.toDateString());
      if (idx === -1) return;
      buckets[idx].rides        += 1;
      buckets[idx].fareTotal    += Number(r.fareTotal    ?? 0);
      buckets[idx].platformFee  += Number(r.platformFee  ?? 0);
      buckets[idx].driverPayout += Number(r.driverPayout ?? 0);
    });

  const totalRides        = buckets.reduce((s, b) => s + b.rides,        0);
  const totalFare         = buckets.reduce((s, b) => s + b.fareTotal,    0);
  const totalPlatformFee  = buckets.reduce((s, b) => s + b.platformFee,  0);
  const totalDriverPayout = buckets.reduce((s, b) => s + b.driverPayout, 0);

  const maxFare = Math.max(...buckets.map(b => b.fareTotal), 1);

  const [hoveredIdx, setHoveredIdx] = useState(null);
  const hovered = hoveredIdx !== null ? buckets[hoveredIdx] : null;

  return (
    <div
      className="card fade-up"
      style={{
        marginBottom: 16,
        padding: 0,
        overflow: "hidden",
        border: "1px solid #EBEBEA",
        borderRadius: 16,
        boxShadow: "0 2px 12px rgba(0,0,0,.06)",
        animationDelay: "20ms",
        opacity: 0,
      }}
    >
      {/* Header */}
      <div style={{
        padding: "16px 18px 12px",
        borderBottom: "1px solid #F3F4F6",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
            <TrendingUp size={14} color="#639922" />
            <span style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>Rides This Week</span>
          </div>
          <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>
            {totalRides} completed ride{totalRides !== 1 ? "s" : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#111827", letterSpacing: "-0.8px", fontFamily: "monospace" }}>
            ${totalFare.toFixed(2)}
          </div>
          <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600 }}>total fare</div>
        </div>
      </div>

      {/* Bar chart */}
      <div style={{ padding: "16px 18px 10px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 90 }}>
          {buckets.map((b, i) => {
            const pct     = b.isFuture ? 0 : Math.max((b.fareTotal / maxFare) * 100, b.rides > 0 ? 8 : 0);
            const isHov   = hoveredIdx === i;
            return (
              <div
                key={b.label}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "default" }}
              >
                {/* Value label on top */}
                {!b.isFuture && b.rides > 0 && (
                  <div style={{ fontSize: 9, fontWeight: 700, color: b.isToday ? "#639922" : "#9CA3AF", opacity: isHov ? 1 : 0.85 }}>
                    ${b.fareTotal.toFixed(0)}
                  </div>
                )}
                {(b.isFuture || b.rides === 0) && <div style={{ flex: 1 }} />}

                {/* Bar */}
                <div style={{
                  width: "100%",
                  height: b.isFuture ? 6 : `${Math.max(pct, 6)}%`,
                  background: b.isFuture
                    ? "#F3F4F6"
                    : b.isToday
                      ? (isHov ? "linear-gradient(180deg,#8DC53E,#639922)" : "linear-gradient(180deg,#639922,#4d7a1a)")
                      : isHov
                        ? "linear-gradient(180deg,#6B7280,#374151)"
                        : "linear-gradient(180deg,#D1D5DB,#9CA3AF)",
                  borderRadius: "5px 5px 3px 3px",
                  transition: "height .45s ease-out, background .15s",
                  boxShadow: b.isToday && !b.isFuture ? "0 0 10px rgba(99,153,34,.35)" : "none",
                  border: b.isToday && !b.isFuture ? "1px solid rgba(99,153,34,.25)" : "1px solid transparent",
                  opacity: b.isFuture ? 0.3 : 1,
                  minHeight: 6,
                }} />

                {/* Day label */}
                <div style={{
                  fontSize: 10, fontWeight: 700,
                  color: b.isToday ? "#639922" : "#9CA3AF",
                  letterSpacing: ".4px",
                }}>
                  {b.label.toUpperCase()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hover tooltip */}
      {hovered && !hovered.isFuture && (
        <div style={{
          margin: "0 18px 12px",
          padding: "10px 14px",
          background: "#F9F9F7",
          border: "1px solid #EBEBEA",
          borderRadius: 10,
          display: "flex", gap: 16, flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px" }}>{hovered.label}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>{hovered.rides} ride{hovered.rides !== 1 ? "s" : ""}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px" }}>Fare</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>${hovered.fareTotal.toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px" }}>Platform</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#185FA5" }}>${hovered.platformFee.toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px" }}>Driver</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#639922" }}>${hovered.driverPayout.toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* Totals footer */}
      <div style={{
        padding: "12px 18px",
        borderTop: "1px solid #F3F4F6",
        display: "flex", gap: 0,
      }}>
        {[
          { label: "Total Fare",    val: `$${totalFare.toFixed(2)}`,         color: "#111827" },
          { label: "Platform Fee",  val: `$${totalPlatformFee.toFixed(2)}`,  color: "#185FA5" },
          { label: "Driver Payout", val: `$${totalDriverPayout.toFixed(2)}`, color: "#639922" },
        ].map((item, i) => (
          <div key={item.label} style={{
            flex: 1, textAlign: "center",
            borderRight: i < 2 ? "1px solid #F3F4F6" : "none",
            padding: "0 8px",
          }}>
            <div style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 3 }}>
              {item.label}
            </div>
            <div style={{ fontSize: 14, fontWeight: 900, color: item.color, fontFamily: "monospace", letterSpacing: "-0.3px" }}>
              {item.val}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Filter Panel ──────────────────────────────────────────────────────
function FilterPanel({ filters, onChange, onClear, resultCount }) {
  return (
    <div style={{
      background: "#F9F9F7",
      border: "1px solid #EBEBEA",
      borderRadius: 14,
      padding: "14px 16px",
      marginBottom: 14,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      <div style={{ position: "relative" }}>
        <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
        <input
          value={filters.search}
          onChange={e => onChange("search", e.target.value)}
          placeholder="Search address, city, zip…"
          style={{
            width: "100%", padding: "9px 12px 9px 32px",
            borderRadius: 10, border: "1px solid #E5E7EB",
            fontSize: 12, fontWeight: 500, color: "#111827",
            background: "#fff", outline: "none",
            boxSizing: "border-box", fontFamily: "inherit",
          }}
        />
        {filters.search && (
          <button onClick={() => onChange("search", "")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", display: "flex", padding: 0 }}>
            <X size={13} />
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <FilterSelect value={filters.status} onChange={v => onChange("status", v)} options={[
          { value: "",                 label: "All statuses" },
          { value: "searching_driver", label: "Searching"    },
          { value: "in_progress",      label: "In progress"  },
          { value: "arrived",          label: "Arrived"      },
          { value: "completed",        label: "Completed"    },
          { value: "cancelled",        label: "Cancelled"    },
        ]} />
        <FilterSelect value={filters.paymentMethod} onChange={v => onChange("paymentMethod", v)} options={[
          { value: "",        label: "All payments" },
          { value: "card",    label: "Card"         },
          { value: "cashapp", label: "Cash App"     },
        ]} />
        <FilterSelect value={filters.paymentStatus} onChange={v => onChange("paymentStatus", v)} options={[
          { value: "",          label: "Payment status" },
          { value: "succeeded", label: "Succeeded"      },
          { value: "pending",   label: "Pending"        },
          { value: "failed",    label: "Failed"         },
        ]} />
        <FilterSelect value={filters.payoutStatus} onChange={v => onChange("payoutStatus", v)} options={[
          { value: "",           label: "Payout status" },
          { value: "processing", label: "Processing"    },
          { value: "pending",    label: "Pending"       },
          { value: "paid",       label: "Paid"          },
          { value: "failed",     label: "Failed"        },
        ]} />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>
          {resultCount} ride{resultCount !== 1 ? "s" : ""} found
        </span>
        <button onClick={onClear} style={{ fontSize: 11, fontWeight: 700, color: "#E24B4A", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          Clear all
        </button>
      </div>
    </div>
  );
}

function FilterSelect({ value, onChange, options }) {
  return (
    <div style={{ position: "relative", flex: 1, minWidth: 120 }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", padding: "8px 28px 8px 10px",
          borderRadius: 8, border: "1px solid #E5E7EB",
          fontSize: 11, fontWeight: 600, color: value ? "#111827" : "#9CA3AF",
          background: value ? "#fff" : "#F9F9F7",
          appearance: "none", outline: "none", cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={11} style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }} />
    </div>
  );
}

// ── HomeTab ───────────────────────────────────────────────────────────
const DEFAULT_FILTERS = {
  search:        "",
  status:        "",
  paymentMethod: "",
  paymentStatus: "",
  payoutStatus:  "",
};

export function HomeTab({
  liveRides = [],
  allRides = [],
  allApprovals = [],
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
  const [refreshing,  setRefreshing]  = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters,     setFilters]     = useState(DEFAULT_FILTERS);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); onToast?.("Data refreshed"); }, 1100);
  };

  const handleFilterChange = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));
  const handleClearFilters = () => setFilters(DEFAULT_FILTERS);
  const activeFilterCount  = Object.values(filters).filter(Boolean).length;

  const filteredRides = useMemo(() => {
    return liveRides.filter(ride => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const searchable = [
          ride.pickup, ride.dropoff,
          ride.pickupCity, ride.dropoffCity,
          ride.pickupZip, ride.dropoffZip,
        ].map(v => (v ?? "").toLowerCase()).join(" ");
        if (!searchable.includes(q)) return false;
      }
      if (filters.status        && ride.status        !== filters.status)        return false;
      if (filters.paymentMethod && ride.paymentMethod !== filters.paymentMethod) return false;
      if (filters.paymentStatus && ride.paymentStatus !== filters.paymentStatus) return false;
      if (filters.payoutStatus  && ride.payoutStatus  !== filters.payoutStatus)  return false;
      return true;
    });
  }, [liveRides, filters]);

  return (
    <div style={{ padding: "0 16px 16px" }}>

      {/* ── Live status bar ── */}
      <div className="card fade-up" style={{ padding: "11px 16px", marginBottom: 16, animationDelay: "40ms", opacity: 0, boxShadow: "0 1px 6px rgba(0,0,0,.05)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { dot: "#639922", label: `${totalAccounts} accounts`          },
              { dot: "#BA7517", label: `${uatobdrivers.length} drivers`     },
              { dot: "#639922", label: `${activeRides.length} active rides` },
              { dot: "#BA7517", label: `${searchingRides.length} searching` },
            ].map(({ dot, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
              </div>
            ))}
          </div>
          <button onClick={handleRefresh} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, display: "flex", padding: 0 }}>
            <RefreshCw size={15} style={{ animation: refreshing ? "spinAnim 1s linear infinite" : "none" }} />
          </button>
        </div>
      </div>

      {/* ── Stats grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <StatCard label="Total Rides"       value={totalRides ?? liveRides.length} icon={Activity}   color={C.blue}  delay={80}  />
        <StatCard label="Active Drivers"    value={activeDrivers.length}           icon={Car}        color={C.green} delay={130} />
        <StatCard label="Revenue Today"     value={revenue != null ? `${revenue.toFixed(2)}` : "—"} icon={DollarSign} color={C.amber} delay={180} />
        <StatCard label="Pending Approvals" value={allApprovals.length}            icon={Shield}     color={C.red}   delay={230} />
      </div>

      {/* ── Weekly Summary ── */}
      <WeeklySummary allRides={allRides.length > 0 ? allRides : liveRides} />

      {/* ── Section header + filter toggle ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
          Live Rides{liveRides.length ? ` (${filteredRides.length}/${liveRides.length})` : ""}
        </span>
        <button
          onClick={() => setShowFilters(p => !p)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 8,
            border: `1px solid ${activeFilterCount > 0 ? "#639922" : "#E5E7EB"}`,
            background: activeFilterCount > 0 ? "#EAF3DE" : "#fff",
            color: activeFilterCount > 0 ? "#3B6D11" : "#6B7280",
            fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <Filter size={11} />
          Filter
          {activeFilterCount > 0 && (
            <span style={{ width: 16, height: 16, borderRadius: "50%", background: "#639922", color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Filter panel ── */}
      {showFilters && (
        <FilterPanel
          filters={filters}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
          resultCount={filteredRides.length}
        />
      )}

      {/* ── Rides list ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filteredRides.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 0", color: C.textMuted, fontSize: 13 }}>
            {activeFilterCount > 0 ? "No rides match your filters" : "No rides yet"}
          </div>
        )}
        {filteredRides.map((ride, i) => (
          <RideCard key={ride.id} ride={ride} delay={280 + i * 55} />
        ))}
      </div>
    </div>
  );
}

// ── RideCard ──────────────────────────────────────────────────────────
function RideCard({ ride, delay }) {
  const riderLabel  = ride.riderName  ?? `Rider …${ride.uid?.slice(-4) ?? "?"}`;
  const driverLabel = ride.driverName ?? (ride.driverId ? `Driver …${ride.driverId.slice(-4)}` : "No driver yet");

  const s  = STATUS_META[ride.status]         ?? { label: ride.status,         dot: "#888780", bg: "#F1EFE8", color: "#5F5E5A" };
  const pm = PAYMENT_META[ride.paymentStatus] ?? { bg: "#F3F4F6", color: "#6B7280", label: ride.paymentStatus };
  const po = PAYOUT_META[ride.payoutStatus]   ?? { bg: "#F3F4F6", color: "#6B7280", label: ride.payoutStatus  };

  return (
    <div
      className="card fade-up"
      style={{
        padding: 0, animationDelay: `${delay}ms`, opacity: 0,
        overflow: "hidden", border: "1px solid #EBEBEA",
        borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,.06)",
      }}
    >
      <div style={{ height: 3, background: ACCENT_BAR[ride.status] ?? "#D1D5DB" }} />

      <div style={{ padding: "14px 16px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar name={riderLabel} size={38} colorIdx={1} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{riderLabel}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                <Car size={10} />
                {driverLabel}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
              background: s.bg, color: s.color, letterSpacing: ".3px",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0, boxShadow: `0 0 5px ${s.dot}` }} />
              {s.label}
            </span>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#111827", letterSpacing: "-0.5px", fontFamily: "monospace" }}>
              ${ride.fareTotal?.toFixed(2) ?? "—"}
            </span>
          </div>
        </div>

        {/* Route */}
        <div style={{
          background: "#F9F9F7", border: "1px solid #EBEBEA",
          borderRadius: 12, padding: "12px 14px", marginBottom: 12, position: "relative",
        }}>
          <div style={{
            position: "absolute", left: 20, top: 22, bottom: 22,
            width: 1.5, background: "linear-gradient(180deg,#639922,#E24B4A)", borderRadius: 2,
          }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { dot: "#639922", label: "Pickup",  addr: shortAddress(ride.pickup),  city: ride.pickupCity,  zip: ride.pickupZip  },
              { dot: "#E24B4A", label: "Dropoff", addr: shortAddress(ride.dropoff), city: ride.dropoffCity, zip: ride.dropoffZip },
            ].map(({ dot, label, addr, city, zip }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 9, height: 9, borderRadius: "50%",
                  background: dot, flexShrink: 0,
                  boxShadow: `0 0 6px ${dot}88`,
                  border: "2px solid #fff", zIndex: 1,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {addr}
                    {city && <span style={{ color: "#9CA3AF", fontWeight: 400 }}> · {city}{zip ? ` ${zip}` : ""}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trip stats */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {[
            ride.rideLabel ?? ride.rideType,
            `${ride.tripDistanceMiles ?? 0} mi`,
            `~${ride.tripDurationMin ?? 0} min`,
            timeAgo(ride.createdAt),
          ].map(label => (
            <span key={label} style={{
              fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 6,
              background: "#F3F4F6", color: "#6B7280",
            }}>
              {label}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingTop: 10, borderTop: "1px solid #F3F4F6", flexWrap: "wrap", gap: 6,
        }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 6,
              background: ride.paymentMethod === "cashapp" ? "#EAF3DE" : "#E6F1FB",
              color:      ride.paymentMethod === "cashapp" ? "#3B6D11" : "#185FA5",
            }}>
              {ride.paymentMethod === "cashapp" ? "Cash App" : ride.paymentMethod ?? "Card"}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 6, background: pm.bg, color: pm.color }}>
              {pm.label}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 6, background: po.bg, color: po.color }}>
              {po.label}
            </span>
          </div>
          <div style={{ fontSize: 10, color: "#9CA3AF" }}>
            <span style={{ color: "#374151", fontWeight: 700 }}>${ride.driverPayout?.toFixed(2) ?? "—"}</span>
            {" driver · "}
            <span style={{ color: "#374151", fontWeight: 700 }}>${ride.platformFee?.toFixed(2) ?? "—"}</span>
            {" fee"}
          </div>
        </div>

        {/* Ride ID */}
        <div style={{ marginTop: 8, fontSize: 9, color: "#D1D5DB", fontFamily: "monospace", letterSpacing: ".4px" }}>
          {ride.id}
        </div>
      </div>
    </div>
  );
}