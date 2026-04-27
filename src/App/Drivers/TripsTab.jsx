import { useState, useRef, useMemo } from "react";
import {
  Car, MapPin, ArrowRight, ChevronDown, Loader2, TrendingUp, Route, Clock,
  Search, X, Filter, Calendar, DollarSign, Star, CheckCircle2, Award,
  Zap, Crown, Users,
} from "lucide-react";

// ── Palette ────────────────────────────────────────────────────────────
const C = {
  bg:         "#FAFAF7",
  surface:    "#FFFFFF",
  surfaceAlt: "#F5F5F0",
  surfaceHov: "#FAFAF5",
  border:     "#E8E6DD",
  borderSoft: "#F0EEE5",
  text:       "#0A0A0A",
  textMid:    "#5A5A52",
  textDim:    "#9A988E",
  green:      "#16A34A",
  greenSoft:  "#F0FDF4",
  blue:       "#2563EB",
  amber:      "#D97706",
  red:        "#DC2626",
};

const PAGE_SIZE = 8;

const TYPE_META = {
  economy:  { color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", label: "Economy",  Icon: Car },
  standard: { color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE", label: "Standard", Icon: Car },
  xl:       { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", label: "XL",       Icon: Users },
  premium:  { color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE", label: "Premium",  Icon: Crown },
};

// ── Helpers ────────────────────────────────────────────────────────────
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

function formatDuration(min) {
  if (!min) return "";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function dayKey(ts) {
  const d = toDate(ts);
  if (!d) return { label: "Unknown", date: null };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yest  = new Date(today); yest.setDate(yest.getDate() - 1);
  const day   = new Date(d);    day.setHours(0, 0, 0, 0);
  if (day.getTime() === today.getTime()) return { label: "Today", date: d };
  if (day.getTime() === yest.getTime())  return { label: "Yesterday", date: d };
  return {
    label: d.toLocaleDateString([], { weekday: "long" }),
    sub:   d.toLocaleDateString([], { month: "short", day: "numeric" }),
    date:  d,
  };
}

function shortenAddress(addr = "") {
  return addr.split(",")[0]?.trim() ?? addr;
}

function groupByDay(trips) {
  const groups = [];
  const seen   = new Map();
  trips.forEach(trip => {
    const key = dayKey(trip.completedAt ?? trip.updatedAt);
    const k   = key.label + (key.sub ?? "");
    if (!seen.has(k)) {
      seen.set(k, groups.length);
      groups.push({ key: k, label: key.label, sub: key.sub, date: key.date, trips: [] });
    }
    groups[seen.get(k)].trips.push(trip);
  });
  return groups;
}

function fmtMoney(n) {
  return `$${Number(n ?? 0).toFixed(2)}`;
}

// ── Hero summary card ─────────────────────────────────────────────────
function HeroSummary({ trips, online }) {
  const totalEarned = trips.reduce((s, t) => s + (Number(t.driverPayout) || 0), 0);
  const totalMiles  = trips.reduce((s, t) => s + (Number(t.tripDistanceMiles) || 0), 0);
  const totalMin    = trips.reduce((s, t) => s + (Number(t.tripDurationMin) || 0), 0);
  const tripCount   = trips.length;
  const avgFare     = tripCount > 0 ? totalEarned / tripCount : 0;
  const avgPerMile  = totalMiles > 0 ? totalEarned / totalMiles : 0;

  return (
    <div style={{
      background: "linear-gradient(135deg,#0A0A0A,#1A1A1A 55%,#262626)",
      borderRadius: 24,
      padding: "26px 24px 22px",
      position: "relative",
      overflow: "hidden",
      boxShadow: "0 12px 40px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)",
    }}>
      {/* Decorative grid */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.06,
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
        pointerEvents: "none",
      }}/>
      {/* Glow */}
      <div style={{
        position: "absolute", top: -60, right: -60,
        width: 200, height: 200, borderRadius: "50%",
        background: `radial-gradient(circle, ${online ? "rgba(22,163,74,0.25)" : "rgba(37,99,235,0.18)"} 0%, transparent 70%)`,
        pointerEvents: "none",
      }}/>

      <div style={{ position: "relative" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 100, padding: "5px 12px",
          marginBottom: 16,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: online ? "#4ADE80" : "#94A3B8",
            boxShadow: online ? "0 0 10px rgba(74,222,128,0.6)" : "none",
            animation: online ? "ttPulse 2s ease-in-out infinite" : "none",
          }}/>
          <span style={{
            fontSize: 10, fontWeight: 700,
            letterSpacing: ".08em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.85)",
          }}>
            {tripCount} trip{tripCount !== 1 ? "s" : ""} · all time
          </span>
        </div>

        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: ".1em",
          textTransform: "uppercase", color: "rgba(255,255,255,0.5)",
          marginBottom: 6,
        }}>
          Total earned
        </div>

        <div style={{
          fontSize: 52, fontWeight: 800, color: "#fff",
          letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 18,
          fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
          fontVariantNumeric: "tabular-nums",
        }}>
          {fmtMoney(totalEarned)}
        </div>

        {/* Stat chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { label: "Avg fare",     value: fmtMoney(avgFare),                Icon: TrendingUp },
            { label: "Per mile",     value: `$${avgPerMile.toFixed(2)}`,      Icon: Route      },
            { label: "Total miles",  value: totalMiles.toFixed(1),            Icon: MapPin     },
            { label: "Total time",   value: formatDuration(totalMin) || "0m", Icon: Clock      },
          ].map(({ label, value, Icon }) => (
            <div key={label} style={{
              flex: "1 1 calc(50% - 4px)",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 12,
              padding: "10px 12px",
              display: "flex", alignItems: "center", gap: 10,
              backdropFilter: "blur(12px)",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: "rgba(255,255,255,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Icon size={13} color="rgba(255,255,255,0.85)" strokeWidth={2.2}/>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: ".06em",
                  textTransform: "uppercase", color: "rgba(255,255,255,0.45)",
                }}>
                  {label}
                </div>
                <div style={{
                  fontSize: 14, fontWeight: 700, color: "#fff",
                  letterSpacing: "-0.01em", marginTop: 1,
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Filter chips ──────────────────────────────────────────────────────
function FilterChips({ activeFilter, setActiveFilter, counts }) {
  const filters = [
    { id: "all",      label: "All",      count: counts.all      },
    { id: "economy",  label: "Economy",  count: counts.economy  },
    { id: "standard", label: "Standard", count: counts.standard },
    { id: "xl",       label: "XL",       count: counts.xl       },
    { id: "premium",  label: "Premium",  count: counts.premium  },
  ];

  return (
    <div style={{
      display: "flex", gap: 6, overflowX: "auto",
      padding: "2px 2px 4px",
      msOverflowStyle: "none", scrollbarWidth: "none",
    }} className="tt-no-scrollbar">
      {filters.map(({ id, label, count }) => {
        const isActive = activeFilter === id;
        const meta = TYPE_META[id];
        return (
          <button
            key={id}
            onClick={() => setActiveFilter(id)}
            disabled={count === 0}
            style={{
              flexShrink: 0,
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px",
              borderRadius: 100,
              border: `1px solid ${isActive ? C.text : C.border}`,
              background: isActive ? C.text : C.surface,
              color: isActive ? "#fff" : (count === 0 ? C.textDim : C.textMid),
              fontSize: 12, fontWeight: 700,
              cursor: count === 0 ? "not-allowed" : "pointer",
              opacity: count === 0 ? 0.5 : 1,
              transition: "all 0.18s",
              fontFamily: "inherit",
              boxShadow: isActive ? "0 4px 12px rgba(0,0,0,0.12)" : "none",
            }}
          >
            {meta && (
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: meta.color,
              }}/>
            )}
            {label}
            <span style={{
              fontSize: 10, fontWeight: 600,
              padding: "1px 6px", borderRadius: 100,
              background: isActive ? "rgba(255,255,255,0.18)" : C.surfaceAlt,
              color: isActive ? "#fff" : C.textDim,
            }}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Search bar ────────────────────────────────────────────────────────
function SearchBar({ query, setQuery }) {
  return (
    <div style={{
      position: "relative",
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 100,
      display: "flex", alignItems: "center",
      padding: "0 14px 0 16px",
      transition: "border-color 0.18s, box-shadow 0.18s",
    }}>
      <Search size={15} color={C.textDim} strokeWidth={2.2}/>
      <input
        type="text"
        placeholder="Search by address…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{
          flex: 1, border: "none", outline: "none",
          background: "transparent",
          padding: "11px 10px",
          fontSize: 13, fontWeight: 500,
          color: C.text,
          fontFamily: "inherit",
        }}
      />
      {query && (
        <button
          onClick={() => setQuery("")}
          style={{
            border: "none", background: C.surfaceAlt,
            width: 22, height: 22, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <X size={12} color={C.textMid} strokeWidth={2.4}/>
        </button>
      )}
    </div>
  );
}

// ── Single trip card ─────────────────────────────────────────────────
function TripCard({ trip, isLast, isNew }) {
  const meta   = TYPE_META[trip.rideType] ?? TYPE_META.economy;
  const Icon   = meta.Icon;
  const payout = Number(trip.driverPayout ?? trip.fareTotal ?? 0);
  const fare   = Number(trip.fareTotal ?? 0);
  const isHigh = payout >= 10;

  return (
    <div
      style={{
        position: "relative",
        borderBottom: !isLast ? `1px solid ${C.borderSoft}` : "none",
        animation: isNew ? "ttIn 0.32s cubic-bezier(0.2,0.9,0.4,1.1) both" : "none",
        transition: "background 0.15s",
        cursor: "pointer",
        overflow: "hidden",
      }}
      onMouseEnter={e => e.currentTarget.style.background = C.surfaceHov}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <div style={{ padding: "16px 18px", display: "flex", gap: 14, alignItems: "flex-start" }}>
        {/* Left: tier icon + colored bar */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{
            width: 42, height: 42,
            background: meta.bg,
            border: `1.5px solid ${meta.border}`,
            borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
          }}>
            <Icon size={18} color={meta.color} strokeWidth={2}/>
            {isHigh && (
              <div style={{
                position: "absolute", top: -4, right: -4,
                width: 16, height: 16, borderRadius: "50%",
                background: "#FCD34D",
                border: "2px solid #fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 6px rgba(252,211,77,0.5)",
              }}>
                <Star size={8} fill="#92400E" color="#92400E" strokeWidth={0}/>
              </div>
            )}
          </div>
        </div>

        {/* Middle: route + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 9.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase",
              background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color,
              borderRadius: 6, padding: "2px 7px",
            }}>
              {trip.rideLabel ?? meta.label}
            </span>
            <span style={{ fontSize: 11, color: C.textDim, fontWeight: 600 }}>
              {formatTime(trip.completedAt ?? trip.updatedAt)}
            </span>
            {trip.rating && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                fontSize: 11, color: "#D97706", fontWeight: 700,
              }}>
                <Star size={10} fill="#D97706" color="#D97706" strokeWidth={0}/>
                {Number(trip.rating).toFixed(1)}
              </span>
            )}
          </div>

          {/* Pickup */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              background: C.green, flexShrink: 0,
              boxShadow: "0 0 0 3px rgba(22,163,74,0.15)",
            }}/>
            <span style={{
              fontSize: 13, fontWeight: 600, color: C.text,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {shortenAddress(trip.pickup)}
            </span>
          </div>

          {/* Connector */}
          <div style={{
            marginLeft: 3, height: 8, width: 1,
            background: `linear-gradient(${C.border},${C.borderSoft})`,
          }}/>

          {/* Dropoff */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 7, height: 7, borderRadius: 1.5,
              background: C.text, flexShrink: 0,
            }}/>
            <span style={{
              fontSize: 13, fontWeight: 600, color: C.text,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {shortenAddress(trip.dropoff)}
            </span>
          </div>

          {/* Footer meta */}
          <div style={{
            marginTop: 10, paddingTop: 10,
            borderTop: `1px dashed ${C.borderSoft}`,
            display: "flex", alignItems: "center", gap: 10,
            fontSize: 11, color: C.textDim, fontWeight: 600,
          }}>
            {trip.tripDistanceMiles != null && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Route size={10} strokeWidth={2.2}/>
                {Number(trip.tripDistanceMiles).toFixed(1)} mi
              </span>
            )}
            {trip.tripDurationMin != null && (
              <>
                <span style={{ width: 2, height: 2, borderRadius: "50%", background: C.border }}/>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Clock size={10} strokeWidth={2.2}/>
                  {formatDuration(trip.tripDurationMin)}
                </span>
              </>
            )}
            {trip.payoutStatus === "paid" && (
              <>
                <span style={{ width: 2, height: 2, borderRadius: "50%", background: C.border }}/>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  color: C.green, fontWeight: 700,
                }}>
                  <CheckCircle2 size={10} strokeWidth={2.4}/>
                  PAID
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: payout */}
        <div style={{ textAlign: "right", flexShrink: 0, minWidth: 70 }}>
          <div style={{
            fontSize: 19, fontWeight: 800, color: C.text,
            letterSpacing: "-0.02em", lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}>
            {fmtMoney(payout)}
          </div>
          {fare !== payout && fare > 0 && (
            <div style={{
              fontSize: 10, color: C.textDim, fontWeight: 600, marginTop: 4,
              fontVariantNumeric: "tabular-nums",
            }}>
              of {fmtMoney(fare)}
            </div>
          )}
          <div style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: ".06em",
            color: C.textDim, marginTop: 4, textTransform: "uppercase",
          }}>
            payout
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Day group ────────────────────────────────────────────────────────
function DayGroup({ label, sub, trips, newFromIdx }) {
  const dayTotal = trips.reduce((s, t) => s + (Number(t.driverPayout) || 0), 0);

  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 4px 10px",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{
            fontSize: 14, fontWeight: 800, color: C.text,
            letterSpacing: "-0.01em",
          }}>
            {label}
          </span>
          {sub && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: C.textDim,
            }}>
              · {sub}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: C.textDim, letterSpacing: ".05em",
          }}>
            {trips.length} trip{trips.length !== 1 ? "s" : ""}
          </span>
          <span style={{ width: 3, height: 3, borderRadius: "50%", background: C.border }}/>
          <span style={{
            fontSize: 12, fontWeight: 700, color: C.green,
            fontVariantNumeric: "tabular-nums",
          }}>
            +{fmtMoney(dayTotal)}
          </span>
        </div>
      </div>

      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.04)",
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

// ── Main export ──────────────────────────────────────────────────────
export default function TripsTab({ completedRides = [], online }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [newFromCount, setNewFromCount] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [query,        setQuery]        = useState("");
  const bottomRef = useRef(null);

  // Compute filter counts
  const counts = useMemo(() => {
    const c = { all: completedRides.length, economy: 0, standard: 0, xl: 0, premium: 0 };
    completedRides.forEach(t => {
      if (c[t.rideType] != null) c[t.rideType]++;
    });
    return c;
  }, [completedRides]);

  // Apply filters + search
  const filtered = useMemo(() => {
    let out = completedRides;
    if (activeFilter !== "all") {
      out = out.filter(t => t.rideType === activeFilter);
    }
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      out = out.filter(t =>
        (t.pickup ?? "").toLowerCase().includes(q)
        || (t.dropoff ?? "").toLowerCase().includes(q)
      );
    }
    return out;
  }, [completedRides, activeFilter, query]);

  const visible   = filtered.slice(0, visibleCount);
  const remaining = filtered.length - visibleCount;
  const hasMore   = remaining > 0;
  const groups    = groupByDay(visible);

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

  const isFiltered = activeFilter !== "all" || query.trim().length > 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700;14..32,800&display=swap');
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ttIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ttSpin { to { transform: rotate(360deg); } }
        @keyframes ttPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        .tt-no-scrollbar::-webkit-scrollbar { display: none; }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{
        padding: "20px 18px 32px",
        display: "flex", flexDirection: "column", gap: 18,
        animation: "slideUp 0.35s ease-out forwards",
        background: C.bg, minHeight: "100%",
        color: C.text,
        fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
      }}>

        {/* ── Header ── */}
        <div>
          <h1 style={{
            fontSize: 30, fontWeight: 800, color: C.text,
            letterSpacing: "-0.025em", margin: 0, lineHeight: 1.1,
          }}>
            Trip History
          </h1>
          <p style={{
            fontSize: 13, color: C.textMid, marginTop: 4, marginBottom: 0,
            fontWeight: 500,
          }}>
            Every ride you've completed
          </p>
        </div>

        {/* Empty state */}
        {completedRides.length === 0 ? (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 24, padding: "64px 24px",
            textAlign: "center", display: "flex", flexDirection: "column",
            alignItems: "center", gap: 14,
            boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.04)",
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: "linear-gradient(135deg,#F0FDF4,#DCFCE7)",
              border: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(22,163,74,0.1)",
            }}>
              <Car size={28} color={C.green} strokeWidth={1.6}/>
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                No trips yet
              </div>
              <div style={{ fontSize: 13, color: C.textMid, maxWidth: 240, lineHeight: 1.5 }}>
                Your completed rides will appear here. Go online to start earning.
              </div>
            </div>
          </div>
        ) : (
          <>
            <HeroSummary trips={completedRides} online={online}/>

            {/* Search + filter row */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <SearchBar query={query} setQuery={setQuery}/>
              <FilterChips
                activeFilter={activeFilter}
                setActiveFilter={setActiveFilter}
                counts={counts}
              />
            </div>

            {/* Filter result summary */}
            {isFiltered && (
              <div style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: "10px 14px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                animation: "ttIn 0.25s ease-out both",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Filter size={13} color={C.textMid} strokeWidth={2}/>
                  <span style={{ fontSize: 12, color: C.textMid, fontWeight: 600 }}>
                    {filtered.length === 0
                      ? "No matching trips"
                      : `${filtered.length} of ${completedRides.length} trips`}
                  </span>
                </div>
                <button
                  onClick={() => { setActiveFilter("all"); setQuery(""); }}
                  style={{
                    background: "none", border: "none",
                    color: C.blue, fontSize: 12, fontWeight: 700,
                    cursor: "pointer", padding: 0,
                    fontFamily: "inherit",
                  }}
                >
                  Clear
                </button>
              </div>
            )}

            {/* Grouped trip list */}
            {filtered.length === 0 ? (
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 18, padding: "40px 24px",
                textAlign: "center",
              }}>
                <Search size={24} color={C.textDim} strokeWidth={1.5} style={{ marginBottom: 10 }}/>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.textMid, marginBottom: 4 }}>
                  No trips match your filters
                </div>
                <div style={{ fontSize: 12, color: C.textDim }}>
                  Try a different search or filter
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {groups.map(({ key, label, sub, trips: dayTrips }) => {
                  const groupStart = visible.indexOf(dayTrips[0]);
                  const newFrom    = newFromCount != null
                    ? Math.max(0, newFromCount - groupStart)
                    : null;
                  return (
                    <DayGroup
                      key={key}
                      label={label}
                      sub={sub}
                      trips={dayTrips}
                      newFromIdx={newFrom != null && newFrom < dayTrips.length ? newFrom : null}
                    />
                  );
                })}
              </div>
            )}

            {/* Load more */}
            {hasMore && (
              <div ref={bottomRef}>
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  style={{
                    width: "100%", padding: "14px 20px",
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 100,
                    cursor: loadingMore ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "all 0.18s",
                    fontFamily: "inherit", fontWeight: 700, fontSize: 13,
                    color: C.textMid,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  }}
                  onMouseEnter={e => {
                    if (loadingMore) return;
                    e.currentTarget.style.background = C.text;
                    e.currentTarget.style.color = "#fff";
                    e.currentTarget.style.borderColor = C.text;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = C.surface;
                    e.currentTarget.style.color = C.textMid;
                    e.currentTarget.style.borderColor = C.border;
                  }}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 size={15} strokeWidth={2}
                        style={{ animation: "ttSpin 0.8s linear infinite" }}/>
                      <span>Loading…</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown size={15} strokeWidth={2.2}/>
                      <span>Load {Math.min(PAGE_SIZE, remaining)} more</span>
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        background: C.surfaceAlt,
                        padding: "1px 8px", borderRadius: 100,
                      }}>
                        {remaining} left
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* All loaded */}
            {!hasMore && filtered.length > PAGE_SIZE && (
              <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 11, color: C.textDim, fontWeight: 700,
                  letterSpacing: ".06em",
                  background: C.surfaceAlt,
                  border: `1px solid ${C.border}`,
                  padding: "7px 14px", borderRadius: 100,
                }}>
                  <CheckCircle2 size={12} strokeWidth={2.2}/>
                  ALL {filtered.length} TRIPS LOADED
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}