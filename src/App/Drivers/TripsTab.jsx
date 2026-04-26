import { useState, useRef } from "react";
import { Car, MapPin, ArrowRight, ChevronDown, Loader2, TrendingUp, Route, Clock } from "lucide-react";

// ── Light palette — modern, neutral, subtle ───────────────────────────────────
const C = {
  bg:         "#F8FAFC",
  surface:    "#FFFFFF",
  surfaceHov: "#F1F5F9",
  border:     "#E2E8F0",
  text:       "#0F172A",
  textMid:    "#475569",
  textDim:    "#94A3B8",
  green:      "#10B981",
  blue:       "#3B82F6",
  accentClean: "#3B82F6",
};

const PAGE_SIZE = 8;

const TYPE_META = {
  economy:  { color: "#3B82F6", label: "Economy"  },
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
      borderRadius: 20,
      overflow: "hidden",
      boxShadow: "0 1px 2px rgba(0,0,0,0.03), 0 1px 3px rgba(0,0,0,0.05)",
    }}>
      {stats.map(({ icon: Icon, label, value, color }, i) => (
        <div key={label} style={{
          padding: "14px 16px",
          borderLeft: i > 0 ? `1px solid ${C.border}` : "none",
          transition: "background 0.2s",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <div style={{
              padding: 2, borderRadius: 6, background: `${color}0d`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon size={12} color={color} strokeWidth={2.2} />
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: ".08em",
              textTransform: "uppercase", color: C.textDim,
            }}>
              {label}
            </span>
          </div>
          <div style={{
            fontFamily: "'Inter', -apple-system, system-ui, monospace",
            fontSize: 18, fontWeight: 700,
            color: C.text, letterSpacing: "-0.02em",
            lineHeight: 1.2,
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
        animation: isNew ? "tt-in 0.25s cubic-bezier(0.2, 0.9, 0.4, 1.1) both" : "none",
        transition: "background 0.15s",
        cursor: "pointer",
        overflow: "hidden",
        background: C.surface,
      }}
      onMouseEnter={e => e.currentTarget.style.background = C.surfaceHov}
      onMouseLeave={e => e.currentTarget.style.background = C.surface}
    >
      {/* Left accent stripe */}
      <div style={{
        width: 3, flexShrink: 0,
        background: color,
      }} />

      <div style={{ flex: 1, padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
        {/* Icon bubble */}
        <div style={{
          width: 40, height: 40, flexShrink: 0,
          background: `${color}0c`,
          border: `1px solid ${color}18`,
          borderRadius: 12,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Car size={18} color={color} strokeWidth={1.8} />
        </div>

        {/* Route + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: ".03em", textTransform: "uppercase",
              background: `${color}0d`, border: `1px solid ${color}18`, color,
              borderRadius: 20, padding: "2px 8px",
            }}>
              {trip.rideLabel ?? meta.label}
            </span>
            <span style={{ fontSize: 11, color: C.textDim, fontWeight: 500 }}>
              {formatTime(trip.completedAt ?? trip.updatedAt)}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <MapPin size={10} color={C.textDim} strokeWidth={2} />
              <span style={{
                fontSize: 12, fontWeight: 500, color: C.textMid,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                maxWidth: "140px",
              }}>
                {shortenAddress(trip.pickup)}
              </span>
            </div>
            <ArrowRight size={10} color={C.textDim} strokeWidth={2} />
            <span style={{
              fontSize: 12, fontWeight: 500, color: C.textMid,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              maxWidth: "140px",
            }}>
              {shortenAddress(trip.dropoff)}
            </span>
          </div>
        </div>

        {/* Payout */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{
            fontFamily: "'Inter', -apple-system, system-ui, monospace",
            fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: "-0.01em",
            marginBottom: 2,
          }}>
            ${payout.toFixed(2)}
          </div>
          <div style={{ fontSize: 10, color: C.textDim, fontWeight: 500 }}>
            {[
              trip.tripDistanceMiles ? `${trip.tripDistanceMiles} mi` : "",
              trip.tripDurationMin   ? `${trip.tripDurationMin} min`   : "",
            ].filter(Boolean).join(" • ")}
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
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 2px 10px 2px" }}>
        <span style={{
          fontSize: 11, fontWeight: 800, letterSpacing: ".1em",
          textTransform: "uppercase", color: C.textDim,
        }}>
          {label}
        </span>
        <div style={{ flex: 1, height: 1, background: C.border }} />
      </div>

      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03), 0 2px 5px rgba(0,0,0,0.05)",
        transition: "box-shadow 0.2s",
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
    }, 280);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700;14..32,800&display=swap');
        @keyframes slideUp { 
          from { opacity: 0; transform: translateY(12px); } 
          to { opacity: 1; transform: translateY(0); } 
        }
        @keyframes tt-in { 
          from { opacity: 0; transform: translateX(-6px); } 
          to { opacity: 1; transform: translateX(0); } 
        }
        @keyframes tt-spin { 
          to { transform: rotate(360deg); } 
        }
        * {
          box-sizing: border-box;
        }
      `}</style>

      <div style={{
        padding: "24px 20px 36px",
        display: "flex", flexDirection: "column", gap: 20,
        animation: "slideUp 0.35s ease-out forwards",
        background: C.bg, minHeight: "100%",
        color: C.text,
        fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
      }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{
              fontSize: 28, fontWeight: 800, color: C.text,
              letterSpacing: "-0.01em", margin: 0, lineHeight: 1.2,
            }}>
              Trip History
            </h1>
            <p style={{
              fontSize: 13, color: C.textMid, marginTop: 4, marginBottom: 0,
            }}>
              View and manage your completed rides
            </p>
          </div>
          <div style={{
            background: online ? `${C.green}0c` : C.surface,
            border: online ? `1px solid ${C.green}20` : `1px solid ${C.border}`,
            borderRadius: 100, padding: "5px 14px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
          }}>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: ".05em",
              color: online ? C.green : C.textDim,
            }}>
              {completedRides.length} TOTAL TRIPS
            </span>
          </div>
        </div>

        {/* ── Empty state ── */}
        {completedRides.length === 0 ? (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 24, padding: "56px 24px",
            textAlign: "center", display: "flex", flexDirection: "column",
            alignItems: "center", gap: 12,
            boxShadow: "0 4px 12px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.03)",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 20,
              background: C.surfaceHov, border: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Car size={24} color={C.textDim} strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.textMid }}>No trips yet</div>
            <div style={{ fontSize: 13, color: C.textDim, maxWidth: 220, lineHeight: 1.5 }}>
              Completed rides will appear here after your first trip.
            </div>
          </div>
        ) : (
          <>
            {/* ── Summary strip ── */}
            <SummaryStrip trips={completedRides} online={online} />

            {/* ── Grouped trip list ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
                    width: "100%", padding: "14px 20px",
                    background: C.surface, border: `1px solid ${C.border}`,
                    borderRadius: 40, cursor: loadingMore ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "all 0.2s",
                    fontFamily: "inherit", fontWeight: 600, fontSize: 13,
                    color: C.textMid,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                  }}
                  onMouseEnter={e => { if (!loadingMore) e.currentTarget.style.background = C.surfaceHov; e.currentTarget.style.borderColor = "#CBD5E1"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.surface; e.currentTarget.style.borderColor = C.border; }}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 size={15} color={C.textDim} strokeWidth={2}
                        style={{ animation: "tt-spin 0.8s linear infinite" }} />
                      <span>Loading trips…</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown size={15} strokeWidth={2} />
                      <span>Load {Math.min(PAGE_SIZE, remaining)} more trip{Math.min(PAGE_SIZE, remaining) !== 1 ? 's' : ''}</span>
                      <span style={{ fontSize: 12, color: C.textDim, fontWeight: 500 }}>
                        ({remaining} left)
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* ── All loaded ── */}
            {!hasMore && completedRides.length > PAGE_SIZE && (
              <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
                <span style={{ fontSize: 11, color: C.textDim, fontWeight: 700, letterSpacing: ".08em", background: C.surfaceHov, padding: "6px 14px", borderRadius: 100 }}>
                  ✓ ALL {completedRides.length} TRIPS LOADED
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}