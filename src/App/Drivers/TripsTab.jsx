import { useState, useRef } from "react";
import { Car, MapPin, ArrowRight, ChevronDown, Loader2, TrendingUp, Route, Clock } from "lucide-react";
import { C } from "@/App/Drivers/constants.js";

// ── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 8;

const TYPE_META = {
  economy: { color: "#38BDF8", label: "Economy" },
  standard:{ color: "#6366F1", label: "Standard" },
  xl:      { color: "#8B5CF6", label: "XL"       },
  premium: { color: "#F59E0B", label: "Premium"  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function formatDate(ts) {
  const d = toDate(ts);
  if (!d) return "";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function dayKey(ts) {
  const d = toDate(ts);
  if (!d) return "Unknown";
  const today   = new Date(); today.setHours(0,0,0,0);
  const yest    = new Date(today); yest.setDate(yest.getDate() - 1);
  const tripDay = new Date(d);    tripDay.setHours(0,0,0,0);
  if (tripDay.getTime() === today.getTime()) return "Today";
  if (tripDay.getTime() === yest.getTime())  return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function shortenAddress(addr = "") {
  return addr.split(",")[0] ?? addr;
}

function groupByDay(trips) {
  const groups = [];
  const seen   = new Map();
  trips.forEach(trip => {
    const key = dayKey(trip.completedAt ?? trip.updatedAt);
    if (!seen.has(key)) { seen.set(key, groups.length); groups.push({ key, trips: [] }); }
    groups[seen.get(key)].trips.push(trip);
  });
  return groups;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SummaryStrip({ trips, online }) {
  const totalEarned = trips.reduce((s, t) => s + (t.driverPayout ?? 0), 0);
  const totalMiles  = trips.reduce((s, t) => s + (t.tripDistanceMiles ?? 0), 0);
  const totalMin    = trips.reduce((s, t) => s + (t.tripDurationMin ?? 0), 0);
  const accentColor = online ? C.onlineGreen : C.blue;

  const stats = [
    { icon: TrendingUp, label: "Earned",  value: `$${totalEarned.toFixed(2)}`, accent: accentColor },
    { icon: Route,      label: "Miles",   value: `${totalMiles.toFixed(1)}`,   accent: C.blue      },
    { icon: Clock,      label: "Minutes", value: `${totalMin}`,                accent: "#8B5CF6"   },
  ];

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(3,1fr)",
      background: "rgba(255,255,255,.03)",
      border: `1px solid ${C.border}`,
      borderRadius: 16, overflow: "hidden",
      marginBottom: 4,
    }}>
      {stats.map(({ icon: Icon, label, value, accent }, i) => (
        <div key={label} style={{
          padding: "14px 12px",
          borderLeft: i > 0 ? `1px solid ${C.border}` : "none",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Icon size={11} color={accent} strokeWidth={2.2} />
            <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.3)" }}>
              {label}
            </span>
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 15, fontWeight: 600, color: "#fff", letterSpacing: "-.02em",
          }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

function TripCard({ trip, isLast, isNew }) {
  const meta  = TYPE_META[trip.rideType] ?? TYPE_META.economy;
  const color = meta.color;
  const payout = trip.driverPayout ?? trip.fareTotal ?? 0;

  return (
    <div
      style={{
        display: "flex", gap: 0, alignItems: "stretch",
        borderBottom: !isLast ? `1px solid ${C.border}` : "none",
        animation: isNew ? "tt-slide-in .3s cubic-bezier(.22,1,.36,1) both" : "none",
        transition: "background .15s",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.025)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      {/* Left accent stripe */}
      <div style={{
        width: 3, flexShrink: 0,
        background: `linear-gradient(to bottom, ${color}, ${color}44)`,
        opacity: .85,
      }} />

      <div style={{ flex: 1, padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
        {/* Icon */}
        <div style={{
          width: 38, height: 38, flexShrink: 0,
          background: color + "12",
          border: `1px solid ${color}28`,
          borderRadius: 12,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Car size={16} color={color} strokeWidth={1.8} />
        </div>

        {/* Route + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Top row: badge + time */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <span style={{
              fontSize: 9.5, fontWeight: 800, letterSpacing: ".06em",
              textTransform: "uppercase",
              background: color + "15",
              border: `1px solid ${color}28`,
              color,
              borderRadius: 6, padding: "2px 7px",
            }}>
              {trip.rideLabel ?? meta.label}
            </span>
            <span style={{ fontSize: 10.5, color: "rgba(255,255,255,.3)", fontWeight: 500 }}>
              {formatTime(trip.completedAt ?? trip.updatedAt)}
            </span>
          </div>

          {/* Route: pickup → dropoff */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, overflow: "hidden" }}>
            <MapPin size={9} color="rgba(255,255,255,.3)" strokeWidth={2} style={{ flexShrink: 0 }} />
            <span style={{
              fontSize: 11.5, fontWeight: 500, color: "rgba(255,255,255,.55)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "0 1 auto",
              maxWidth: "40%",
            }}>
              {shortenAddress(trip.pickup)}
            </span>
            <ArrowRight size={9} color="rgba(255,255,255,.2)" strokeWidth={2} style={{ flexShrink: 0 }} />
            <span style={{
              fontSize: 11.5, fontWeight: 500, color: "rgba(255,255,255,.55)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "0 1 auto",
              maxWidth: "40%",
            }}>
              {shortenAddress(trip.dropoff)}
            </span>
          </div>
        </div>

        {/* Payout + stats */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 15, fontWeight: 700, color: "#fff",
            letterSpacing: "-.02em", marginBottom: 3,
          }}>
            ${payout.toFixed(2)}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,.28)", fontWeight: 500, lineHeight: 1.4 }}>
            {trip.tripDistanceMiles ? `${trip.tripDistanceMiles} mi` : ""}
            {trip.tripDurationMin  ? ` · ${trip.tripDurationMin}m`  : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

function DayGroup({ label, trips, newFromIdx }) {
  return (
    <div>
      {/* Date label */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "6px 2px 8px",
      }}>
        <span style={{
          fontSize: 10.5, fontWeight: 800, letterSpacing: ".1em",
          textTransform: "uppercase", color: "rgba(255,255,255,.28)",
          whiteSpace: "nowrap",
        }}>
          {label}
        </span>
        <div style={{ flex: 1, height: 1, background: C.border }} />
      </div>

      {/* Cards */}
      <div style={{
        background: "rgba(255,255,255,.025)",
        border: `1px solid ${C.border}`,
        borderRadius: 16, overflow: "hidden",
      }}>
        {trips.map((trip, i) => (
          <TripCard
            key={trip.id}
            trip={trip}
            isLast={i === trips.length - 1}
            isNew={newFromIdx != null && i >= newFromIdx}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function TripsTab({ completedRides = [], online }) {
  const [visibleCount, setVisibleCount]   = useState(PAGE_SIZE);
  const [loadingMore,  setLoadingMore]    = useState(false);
  const [newFromCount, setNewFromCount]   = useState(null); // track where newly loaded items start
  const bottomRef = useRef(null);

  const accentColor = online ? C.onlineGreen : C.blue;
  const visible     = completedRides.slice(0, visibleCount);
  const remaining   = completedRides.length - visibleCount;
  const hasMore     = remaining > 0;
  const groups      = groupByDay(visible);

  function handleLoadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    setNewFromCount(visibleCount); // items at index >= this are "new"
    // Slight delay for visual feedback
    setTimeout(() => {
      setVisibleCount(v => v + PAGE_SIZE);
      setLoadingMore(false);
      // Scroll to the load more button area after render
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
    }, 320);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600;700&display=swap');

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes tt-slide-in {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes tt-spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{
        padding: "18px 16px",
        display: "flex", flexDirection: "column", gap: 16,
        animation: "slideUp .38s ease-out forwards",
      }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="condensed" style={{ fontSize: 28, fontWeight: 900, color: C.text, letterSpacing: "-0.5px" }}>
            Trip History
          </div>
          <div style={{
            background: online ? "rgba(22,163,74,.1)" : "rgba(255,255,255,.04)",
            border:     online ? "1px solid rgba(22,163,74,.25)" : `1px solid ${C.border}`,
            borderRadius: 100, padding: "5px 13px",
          }}>
            <span className="condensed" style={{
              fontSize: 11.5, fontWeight: 800,
              color: online ? accentColor : "rgba(255,255,255,.35)",
              letterSpacing: ".08em",
            }}>
              {completedRides.length} TRIPS
            </span>
          </div>
        </div>

        {/* Empty state */}
        {completedRides.length === 0 ? (
          <div style={{
            background: "rgba(255,255,255,.025)",
            border: `1px solid ${C.border}`,
            borderRadius: 18, padding: "48px 20px",
            textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: "rgba(255,255,255,.04)",
              border: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 2,
            }}>
              <Car size={22} color="rgba(255,255,255,.2)" strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,.45)" }}>No trips yet</div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.22)", maxWidth: 200, lineHeight: 1.6 }}>
              Completed rides will appear here after your first trip.
            </div>
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <SummaryStrip trips={completedRides} online={online} />

            {/* Day-grouped trip list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {groups.map(({ key, trips: dayTrips }) => {
                // Find where new items start within this group
                const groupStartIdx = visible.indexOf(dayTrips[0]);
                const newFrom = newFromCount != null && groupStartIdx != null
                  ? Math.max(0, newFromCount - groupStartIdx)
                  : null;
                return (
                  <DayGroup
                    key={key}
                    label={key}
                    trips={dayTrips}
                    newFromIdx={newFrom < dayTrips.length ? newFrom : null}
                  />
                );
              })}
            </div>

            {/* Load more */}
            {hasMore && (
              <div ref={bottomRef} style={{ paddingTop: 4, paddingBottom: 8 }}>
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  style={{
                    width: "100%",
                    padding: "13px 20px",
                    background: "rgba(255,255,255,.03)",
                    border: `1px solid ${C.border}`,
                    borderRadius: 14,
                    cursor: loadingMore ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "all .15s",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={e => { if (!loadingMore) e.currentTarget.style.background = "rgba(255,255,255,.06)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,.03)"; }}
                >
                  {loadingMore ? (
                    <>
                      <Loader2
                        size={14}
                        color="rgba(255,255,255,.4)"
                        strokeWidth={2}
                        style={{ animation: "tt-spin .9s linear infinite" }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,.35)" }}>
                        Loading…
                      </span>
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} color="rgba(255,255,255,.4)" strokeWidth={2} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,.45)" }}>
                        Load {Math.min(PAGE_SIZE, remaining)} more
                        <span style={{ color: "rgba(255,255,255,.22)", fontWeight: 500 }}>
                          {" "}· {remaining} remaining
                        </span>
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* All loaded indicator */}
            {!hasMore && completedRides.length > PAGE_SIZE && (
              <div style={{ textAlign: "center", padding: "4px 0 8px" }}>
                <span style={{ fontSize: 11.5, color: "rgba(255,255,255,.2)", fontWeight: 600, letterSpacing: ".05em" }}>
                  ALL {completedRides.length} TRIPS LOADED
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
