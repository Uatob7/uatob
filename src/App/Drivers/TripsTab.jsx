import { useState, useRef } from "react";
import {
  Car, MapPin, ArrowRight, ChevronDown,
  Loader2, TrendingUp, Route, Clock
} from "lucide-react";
import { C } from "@/App/Drivers/constants.js";

const PAGE_SIZE = 8;

const TYPE_META = {
  economy: { color: "#38BDF8", label: "Economy" },
  standard:{ color: "#6366F1", label: "Standard" },
  xl:      { color: "#8B5CF6", label: "XL" },
  premium: { color: "#F59E0B", label: "Premium" },
};

// ── helpers ─────────────────────────────
function toDate(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts.toDate === "function") return ts.toDate();
  return new Date(ts);
}

function formatTime(ts) {
  const d = toDate(ts);
  if (!d) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dayKey(ts) {
  const d = toDate(ts);
  if (!d) return "Unknown";

  const today = new Date();
  today.setHours(0,0,0,0);

  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);

  const tripDay = new Date(d);
  tripDay.setHours(0,0,0,0);

  if (tripDay.getTime() === today.getTime()) return "Today";
  if (tripDay.getTime() === yest.getTime()) return "Yesterday";

  return d.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric"
  });
}

function groupByDay(trips) {
  const groups = [];
  const seen = new Map();

  trips.forEach(trip => {
    const key = dayKey(trip.completedAt ?? trip.updatedAt);
    if (!seen.has(key)) {
      seen.set(key, groups.length);
      groups.push({ key, trips: [] });
    }
    groups[seen.get(key)].trips.push(trip);
  });

  return groups;
}

// ── summary ─────────────────────────────
function SummaryStrip({ trips, online }) {
  const totalEarned = trips.reduce((s, t) => s + (t.driverPayout ?? 0), 0);
  const totalMiles = trips.reduce((s, t) => s + (t.tripDistanceMiles ?? 0), 0);
  const totalMin = trips.reduce((s, t) => s + (t.tripDurationMin ?? 0), 0);

  const stats = [
    { icon: TrendingUp, label: "Earned", value: `$${totalEarned.toFixed(2)}` },
    { icon: Route, label: "Miles", value: totalMiles.toFixed(1) },
    { icon: Clock, label: "Minutes", value: totalMin },
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      background: "rgba(255,255,255,.05)",
      border: `1px solid ${C.border}`,
      borderRadius: 16,
      overflow: "hidden"
    }}>
      {stats.map(({ icon: Icon, label, value }, i) => (
        <div key={label} style={{
          padding: "14px 12px",
          borderLeft: i ? `1px solid ${C.border}` : "none"
        }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Icon size={12} color="#fff" />
            <span style={{ fontSize: 10, color: "#bbb" }}>{label}</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── trip card ───────────────────────────
function TripCard({ trip, isLast }) {
  const meta = TYPE_META[trip.rideType] ?? TYPE_META.economy;

  return (
    <div style={{
      display: "flex",
      borderBottom: !isLast ? `1px solid ${C.border}` : "none",
      padding: 14
    }}>
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: meta.color + "22",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <Car size={16} color={meta.color} />
      </div>

      <div style={{ flex: 1, marginLeft: 10 }}>
        <div style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>
          {meta.label}
        </div>

        <div style={{ fontSize: 11, color: "#aaa" }}>
          {trip.pickup} → {trip.dropoff}
        </div>

        <div style={{ fontSize: 11, color: "#888" }}>
          {formatTime(trip.completedAt)}
        </div>
      </div>

      <div style={{ color: "#fff", fontWeight: 700 }}>
        ${trip.driverPayout?.toFixed(2)}
      </div>
    </div>
  );
}

// ── day group ───────────────────────────
function DayGroup({ label, trips }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ color: "#888", fontSize: 12, marginBottom: 6 }}>
        {label}
      </div>

      <div style={{
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        overflow: "hidden"
      }}>
        {trips.map((t, i) => (
          <TripCard
            key={t.id}
            trip={t}
            isLast={i === trips.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

// ── main ────────────────────────────────
export default function TripsTab({ completedRides = [], online }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const groups = groupByDay(completedRides.slice(0, visibleCount));
  const remaining = completedRides.length - visibleCount;
  const bottomRef = useRef(null);

  function loadMore() {
    setVisibleCount(v => v + PAGE_SIZE);
  }

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ color: "#fff" }}>Trip History</h2>

      <SummaryStrip trips={completedRides} online={online} />

      {groups.map(g => (
        <DayGroup key={g.key} label={g.key} trips={g.trips} />
      ))}

      {remaining > 0 && (
        <button
          onClick={loadMore}
          style={{
            marginTop: 12,
            width: "100%",
            padding: 12,
            background: "#222",
            color: "#fff",
            border: "1px solid #333"
          }}
        >
          Load More ({remaining})
        </button>
      )}
    </div>
  );
}