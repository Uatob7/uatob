import { useState, useRef } from "react";
import { Car, MapPin, ArrowRight, ChevronDown, Loader2, TrendingUp, Route, Clock } from "lucide-react";

// ── Dark palette — self-contained, no external C import ───────────────────────
const C = {
  bg:         "#0C0E14",
  surface:    "rgba(255,255,255,.03)",
  surfaceHov: "rgba(255,255,255,.06)",
  border:     "rgba(255,255,255,.08)",
  text:       "#F1F5F9",
  textMid:    "rgba(255,255,255,.5)",
  textDim:    "rgba(255,255,255,.28)",
  green:      "#22C55E",
  blue:       "#38BDF8",
};

const PAGE_SIZE = 8;

const TYPE_META = {
  economy:  { color: "#38BDF8", label: "Economy"  },
  standard: { color: "#6366F1", label: "Standard" },
  xl:       { color: "#8B5CF6", label: "XL"       },
  premium:  { color: "#F59E0B", label: "Premium"  },
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

function dayKey(ts) {
  const d = toDate(ts);
  if (!d) return "Unknown";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yest  = new Date(today); yest.setDate(yest.getDate() - 1);
  const day   = new Date(d);    day.setHours(0, 0, 0, 0);
  if (day.getTime() === today.getTime()) return "Today";
  if (day.getTime() === yest.getTime())  return "Yesterday";
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

// ── Summary strip ─────────────────────────────────────────────────────────────
function SummaryStrip({ trips, online }) {
  const totalEarned = trips.reduce((s, t) => s + (t.driverPayout ?? 0), 0);
  const totalMiles  = trips.reduce((s, t) => s + (t.tripDistanceMiles ?? 0), 0);
  const totalMin    = trips.reduce((s, t) => s + (t.tripDurationMin ?? 0), 0);
  const accentColor = online ? C.green : C.blue;

  const stats = [
    { icon: TrendingUp, label: "Earned",  value: `$${totalEarned.toFixed(2)}`, color: accentColor },
    { icon: Route,      label: "Miles",   value: totalMiles.toFixed(1),        color: C.blue      },
    { icon: Clock,      label: "Minutes", value: String(totalMin),             color: "#8B5CF6"   },
  ];

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(3,1fr)",
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 16, overflow: "hidden",
    }}>
      {stats.map(({ icon: Icon, label, value, color }, i) => (
        <div key={label} style={{
          padding: "13px 12px",
          borderLeft: i > 0 ? `1px solid ${C.border}` : "none",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
            <Icon size={10} color={color} strokeWidth={2.2} />
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: ".09em",
              textTransform: "uppercase", color: C.textDim,
            }}>
              {label}
            </span>
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 14.5, fontWeight: 600,
            color: C.text, letterSpacing: "-.02em",
          }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Single trip card ──────────────────────────────────────────────────────────
function TripCard({ trip, isLast, isNew }) {
  const meta   = TYPE_META[trip.rideType] ?? TYPE_META.economy;
  const color  = meta.color;
  const payout = trip.driverPayout ?? trip.fareTotal ?? 0;

  return (
    <div
      style={{
        display: "flex", alignItems: "stretch",
        borderBottom: !isLast ? `1px solid ${C.border}` : "none",
        animation: isNew ? "tt-in .3s cubic-bezier(.22,1,.36,1) both" : "none",
        transition: "background .15s",
        cursor: "pointer",
        overflow: "hidden",
      }}
      onMouseEnter={e => e.currentTarget.style.background = C.surfaceHov}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      {/* Left accent stripe */}
      <div style={{
        width: 3, flexShrink: 0,
        background: `linear-gradient(to bottom, ${color}, ${color}44)`,
      }} />

      <div style={{ flex: 1, padding: "13px 14px", display: "flex", gap: 11, alignItems: "center" }}>
        {/* Icon bubble */}
        <div style={{
          width: 38, height: 38, flexShrink: 0,
          background: color + "14",
          border: `1px solid ${color}28`,
          borderRadius: 11,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Car size={16} color={color} strokeWidth={1.8} />
        </div>

        {/* Route + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <span style={{
              fontSize: 9.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase",
              background: color + "16", border: `1px solid ${color}28`, color,
              borderRadius: 6, padding: "2px 7px",
            }}>
              {trip.rideLabel ?? meta.label}
            </span>
            <span style={{ fontSize: 10.5, color: C.textDim, fontWeight: 500 }}>
              {formatTime(trip.completedAt ?? trip.updatedAt)}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <MapPin size={9} color={C.textDim} strokeWidth={2} style={{ flexShrink: 0 }} />
            <span style={{
              fontSize: 11.5, fontWeight: 500, color: C.textMid,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              maxWidth: "38%",
            }}>
              {shortenAddress(trip.pickup)}
            </span>
            <ArrowRight size={9} color={C.textDim} strokeWidth={2} style={{ flexShrink: 0 }} />
            <span style={{
              fontSize: 11.5, fontWeight: 500, color: C.textMid,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              maxWidth: "38%",
            }}>
              {shortenAddress(trip.dropoff)}
            </span>
          </div>
        </div>

        {/* Payout */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "-.02em",
            marginBottom: 2,
          }}>
            ${payout.toFixed(2)}
          </div>
          <div style={{ fontSize: 10, color: C.textDim, fontWeight: 500 }}>
            {[
              trip.tripDistanceMiles ? `${trip.tripDistanceMiles} mi` : "",
              trip.tripDurationMin   ? `${trip.tripDurationMin}m`     : "",
            ].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Day group ─────────────────────────────────────────────────────────────────
function DayGroup({ label, trips, newFromIdx }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 2px 8px" }}>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: ".1em",
          textTransform: "uppercase", color: C.textDim, whiteSpace: "nowrap",
        }}>
          {label}
        </span>
        <div style={{ flex: 1, height: 1, background: C.border }} />
      </div>

      <div style={{
        background: C.surface,
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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [newFromCount, setNewFromCount] = useState(null);
  const bottomRef   = useRef(null);
  const accentColor = online ? C.green : C.blue;
  const visible     = completedRides.slice(0, visibleCount);
  const remaining   = completedRides.length - visibleCount;
  const hasMore     = remaining > 0;
  const groups      = groupByDay(visible);

  function handleLoadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    setNewFromCount(visibleCount);
    setTimeout(() => {
      setVisibleCount(v => v + PAGE_SIZE);
      setLoadingMore(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
    }, 300);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;900&family=IBM+Plex+Mono:wght@500;600;700&display=swap');
        @keyframes slideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        @keyframes tt-in   { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:none} }
        @keyframes tt-spin { to{transform:rotate(360deg)} }
      `}</style>

      <div style={{
        padding: "18px 16px 32px",
        display: "flex", flexDirection: "column", gap: 16,
        animation: "slideUp .38s ease-out forwards",
        background: C.bg, minHeight: "100%",
        color: C.text,
      }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{
            fontSize: 26, fontWeight: 900, color: C.text,
            letterSpacing: "-0.5px", fontFamily: "'Syne', sans-serif",
          }}>
            Trip History
          </div>
          <div style={{
            background: online ? "rgba(34,197,94,.1)" : C.surface,
            border: online ? "1px solid rgba(34,197,94,.25)" : `1px solid ${C.border}`,
            borderRadius: 100, padding: "5px 13px",
          }}>
            <span style={{
              fontSize: 11, fontWeight: 800, letterSpacing: ".08em",
              color: online ? accentColor : C.textDim,
            }}>
              {completedRides.length} TRIPS
            </span>
          </div>
        </div>

        {/* ── Empty state ── */}
        {completedRides.length === 0 ? (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 18, padding: "48px 20px",
            textAlign: "center", display: "flex", flexDirection: "column",
            alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: "rgba(255,255,255,.04)", border: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 2,
            }}>
              <Car size={22} color={C.textDim} strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.textMid }}>No trips yet</div>
            <div style={{ fontSize: 12.5, color: C.textDim, maxWidth: 200, lineHeight: 1.6 }}>
              Completed rides will appear here after your first trip.
            </div>
          </div>
        ) : (
          <>
            {/* ── Summary strip ── */}
            <SummaryStrip trips={completedRides} online={online} />

            {/* ── Grouped trip list ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {groups.map(({ key, trips: dayTrips }) => {
                const groupStart = visible.indexOf(dayTrips[0]);
                const newFrom    = newFromCount != null
                  ? Math.max(0, newFromCount - groupStart)
                  : null;
                return (
                  <DayGroup
                    key={key}
                    label={key}
                    trips={dayTrips}
                    newFromIdx={newFrom != null && newFrom < dayTrips.length ? newFrom : null}
                  />
                );
              })}
            </div>

            {/* ── Load more ── */}
            {hasMore && (
              <div ref={bottomRef}>
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  style={{
                    width: "100%", padding: "13px 20px",
                    background: C.surface, border: `1px solid ${C.border}`,
                    borderRadius: 14, cursor: loadingMore ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "background .15s", fontFamily: "inherit",
                  }}
                  onMouseEnter={e => { if (!loadingMore) e.currentTarget.style.background = C.surfaceHov; }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.surface; }}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 size={14} color={C.textDim} strokeWidth={2}
                        style={{ animation: "tt-spin .9s linear infinite" }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.textDim }}>Loading…</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} color={C.textDim} strokeWidth={2} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.textMid }}>
                        Load {Math.min(PAGE_SIZE, remaining)} more
                      </span>
                      <span style={{ fontSize: 12, color: C.textDim, fontWeight: 500 }}>
                        · {remaining} remaining
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* ── All loaded ── */}
            {!hasMore && completedRides.length > PAGE_SIZE && (
              <div style={{ textAlign: "center", padding: "4px 0" }}>
                <span style={{ fontSize: 11, color: C.textDim, fontWeight: 700, letterSpacing: ".08em" }}>
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
