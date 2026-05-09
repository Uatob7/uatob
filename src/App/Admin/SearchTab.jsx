Protect your Cloud Firestore resources from abuse, such as billing fraud or phishing



Search
ub5Rt1a4Ubu0s8WIQznt
(default)

Accounts

Admin

Drivers

Rides

Search
Search

88UE6C7bl86HkriLW0dL

BmNesgMY4vR2JwrffMXc

C83iY5uvV9pDiX8bKO56

CvNtT7xCu4MrCyRlV75z

EY0EHd8AYTIdXjUnUMrY

HUKXLfrXcvEnQaDiQVNN

HpGl5Cb1vHdRrqKV2MEp

Ks3eJpga2jx7KwmeuO7A

RVacBprdulpdbzciixFG

V4eZDUqtdSHpZ9YsUbVe

VChUHfG7gHCYMMhX31Sb

YoimxaTkPZMVRwq4sCXH

am9QNciCywouFyTzUGxW

bYIdqVmEfWKYt8QY8oHU

gcPb1hWnqTN4yoLb2z8R

gcleMBpZ0ba39pYbkyvy

oET3xsJrDPZ2D62fwZuo

oOSbhJXi76b4fQ8xKCCM

ohNU7bxcXw8MSowY3HUM

siuczF7J6xC85gMqMTi2

tVPkErc9tYZ8nBRaRz1g

ub5Rt1a4Ubu0s8WIQznt

xXeIe4sNLI4VLgDEu5UA

zRbIIUhPYmgeNm8cgAGc

ztZ1Tz9UkULT0NZ89dQs
ub5Rt1a4Ubu0s8WIQznt
createdAt
May 7, 2026 at 5:01:52 PM UTC-4
(timestamp)


(map)


dropoff
"3024 North Powers Drive, Orlando, FL, USA"
(string)


miles
0.93
(double)


minutes
7
(int64)


pickup
"2382 Locke Avenue, Orlando, FL, USA"
(string)


pickupLat
28.5730568
(double)


pickupLng
-81.46963459999999
(double)



rides
(map)



economy
(map)


capacity
4
(int64)


desc
"Affordable everyday rides"
(string)


eta
"~34–39 min"
(string)


id
"economy"
(string)


label
"Economy"
(string)


total
4.99
(double)



premium
(map)


capacity
4
(int64)


desc
"Luxury rides"
(string)


eta
"~36–41 min"
(string)


id
"premium"
(string)


label
"Premium"
(string)


total
9.99
(double)



standard
(map)


capacity
4
(int64)


desc
"Comfortable daily rides"
(string)


eta
"~34–39 min"
(string)


id
"standard"
(string)


label
"Standard"
(string)


total
6.99
(double)



xl
(map)


capacity
6
(int64)


desc
"Large group rides"
(string)


eta
"~35–40 min"
(string)


id
"xl"
(string)


label
"XL"
(string)


total
7.99
(double)


uid
null




import { useState, useMemo } from "react";
import { MapPin, Navigation, Clock, Ruler, User, Search, ChevronRight, X } from "lucide-react";
import { C } from "@/App/Admin/Tokens";
import { useSearches } from "@/App/Admin/useSearches";

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtTime(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function stripCity(addr) {
  if (!addr) return "—";
  return addr.replace(/, Orlando, FL, USA$/i, "").replace(/, FL, USA$/i, "");
}

function milesToKm(mi) {
  return (mi * 1.609).toFixed(1);
}

// ── Mini map pin marker ────────────────────────────────────────────────────
function RouteVisual() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: C.primary ?? "#0D9488",
        boxShadow: `0 0 0 2px ${(C.primary ?? "#0D9488") + "33"}`,
      }} />
      <div style={{
        width: 1.5, height: 18,
        background: `linear-gradient(to bottom, ${C.primary ?? "#0D9488"}, ${C.accent ?? "#0891B2"})`,
        opacity: 0.5,
      }} />
      <div style={{
        width: 8, height: 8, borderRadius: "2px",
        background: C.accent ?? "#0891B2",
        transform: "rotate(45deg)",
        boxShadow: `0 0 0 2px ${(C.accent ?? "#0891B2") + "33"}`,
      }} />
    </div>
  );
}

// ── Search card ────────────────────────────────────────────────────────────
function SearchCard({ doc, onClick }) {
  const { pickup, dropoff, miles, minutes, createdAt, uid } = doc;
  const anonymous = !uid || uid === "null" || uid === null;

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", background: C.surface ?? "#fff",
        border: `1px solid ${C.border ?? "#E5E7EB"}`,
        borderRadius: 16, padding: "14px 14px",
        display: "flex", alignItems: "center", gap: 12,
        cursor: "pointer", textAlign: "left",
        transition: "box-shadow .15s, transform .12s",
        boxShadow: "0 1px 4px rgba(0,0,0,.06)",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.1)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,.06)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <RouteVisual />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Pickup */}
        <div style={{
          fontSize: 13, fontWeight: 700,
          color: C.text ?? "#111827",
          fontFamily: "'Barlow', sans-serif",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {stripCity(pickup)}
        </div>
        {/* Dropoff */}
        <div style={{
          fontSize: 12, fontWeight: 500,
          color: C.textMuted ?? "#6B7280",
          fontFamily: "'Barlow', sans-serif",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          marginTop: 2,
        }}>
          {stripCity(dropoff)}
        </div>

        {/* Meta row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          marginTop: 6, flexWrap: "wrap",
        }}>
          <span style={pill}>
            <Ruler size={10} style={{ marginRight: 3 }} />
            {miles ? `${miles.toFixed(1)} mi` : "—"}
          </span>
          <span style={pill}>
            <Clock size={10} style={{ marginRight: 3 }} />
            {minutes ? `${minutes} min` : "—"}
          </span>
          <span style={{ ...pill, background: anonymous ? "rgba(107,114,128,.08)" : "rgba(13,148,136,.08)", color: anonymous ? C.textMuted : C.primary ?? "#0D9488" }}>
            <User size={10} style={{ marginRight: 3 }} />
            {anonymous ? "Guest" : "Rider"}
          </span>
          <span style={{ ...pill, marginLeft: "auto", fontSize: 10 }}>
            {fmtTime(createdAt)}
          </span>
        </div>
      </div>

      <ChevronRight size={14} color={C.textMuted ?? "#9CA3AF"} style={{ flexShrink: 0 }} />
    </button>
  );
}

const pill = {
  display: "inline-flex", alignItems: "center",
  fontSize: 10.5, fontWeight: 700,
  fontFamily: "'Barlow', sans-serif",
  padding: "2px 7px", borderRadius: 99,
  background: "rgba(0,0,0,.05)",
  color: "#6B7280",
};

// ── Detail drawer ──────────────────────────────────────────────────────────
function DetailDrawer({ doc, onClose }) {
  if (!doc) return null;
  const { pickup, dropoff, miles, minutes, pickupLat, pickupLng, uid, createdAt } = doc;
  const anonymous = !uid || uid === "null" || uid === null;

  const rows = [
    { label: "Pickup",    value: pickup,    icon: <Navigation size={14} color={C.primary ?? "#0D9488"} /> },
    { label: "Dropoff",   value: dropoff,   icon: <MapPin size={14} color={C.accent ?? "#0891B2"} /> },
    { label: "Distance",  value: miles ? `${miles.toFixed(2)} mi (${milesToKm(miles)} km)` : "—", icon: <Ruler size={14} color={C.textMuted} /> },
    { label: "Est. time", value: minutes ? `${minutes} min` : "—", icon: <Clock size={14} color={C.textMuted} /> },
    { label: "Rider UID", value: anonymous ? "Guest / not logged in" : uid, icon: <User size={14} color={C.textMuted} /> },
    { label: "Searched",  value: fmtTime(createdAt), icon: <Clock size={14} color={C.textMuted} /> },
  ];

  const mapsUrl = pickupLat && pickupLng
    ? `https://www.google.com/maps/search/?api=1&query=${pickupLat},${pickupLng}`
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,.35)", backdropFilter: "blur(3px)",
          animation: "adminFadeIn .2s ease",
        }}
      />
      {/* Sheet */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 201,
        background: C.surface ?? "#fff",
        borderRadius: "20px 20px 0 0",
        padding: "20px 20px 36px",
        maxWidth: 640, margin: "0 auto",
        animation: "adminSlideUp .28s cubic-bezier(.34,1.2,.64,1)",
        boxShadow: "0 -8px 40px rgba(0,0,0,.14)",
      }}>
        {/* Handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 99,
          background: C.border ?? "#E5E7EB",
          margin: "0 auto 18px",
        }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 900, color: C.text ?? "#111827", letterSpacing: "-0.3px" }}>
              Search Detail
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, fontFamily: "'Barlow', sans-serif", marginTop: 2 }}>
              {fmtTime(createdAt)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              border: `1px solid ${C.border ?? "#E5E7EB"}`,
              background: C.surfaceHigh ?? "#F9FAFB",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={14} color={C.textMuted} />
          </button>
        </div>

        {/* Rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map(({ label, value, icon }) => (
            <div key={label} style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: "10px 12px", borderRadius: 12,
              background: C.surfaceHigh ?? "#F9FAFB",
              border: `1px solid ${C.border ?? "#F3F4F6"}`,
            }}>
              <div style={{ marginTop: 1, flexShrink: 0 }}>{icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textMuted, fontFamily: "'Barlow', sans-serif", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>
                  {label}
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: C.text ?? "#111827",
                  fontFamily: "'Barlow', sans-serif",
                  wordBreak: "break-all",
                }}>
                  {value || "—"}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Map link */}
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              marginTop: 16, padding: "13px",
              borderRadius: 14, border: "none",
              background: `linear-gradient(135deg, ${C.primary ?? "#0D9488"}, ${C.accent ?? "#0891B2"})`,
              color: "#fff", fontSize: 14, fontWeight: 800,
              fontFamily: "'Barlow', sans-serif",
              textDecoration: "none",
              boxShadow: "0 4px 14px rgba(13,148,136,.3)",
            }}
          >
            <MapPin size={15} />
            View pickup on Google Maps
          </a>
        )}
      </div>
    </>
  );
}

// ── Stats bar ──────────────────────────────────────────────────────────────
function StatsBar({ searches }) {
  const total   = searches.length;
  const guests  = searches.filter(s => !s.uid || s.uid === "null" || s.uid === null).length;
  const riders  = total - guests;
  const avgMi   = total ? (searches.reduce((a, s) => a + (s.miles || 0), 0) / total).toFixed(1) : "—";

  const stats = [
    { label: "Total",   value: total },
    { label: "Riders",  value: riders },
    { label: "Guests",  value: guests },
    { label: "Avg mi",  value: avgMi },
  ];

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
      gap: 8, marginBottom: 14,
    }}>
      {stats.map(({ label, value }) => (
        <div key={label} style={{
          background: C.surface ?? "#fff",
          border: `1px solid ${C.border ?? "#E5E7EB"}`,
          borderRadius: 12, padding: "10px 6px",
          textAlign: "center",
        }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 900, color: C.text ?? "#111827" }}>
            {value}
          </div>
          <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.4px" }}>
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── MAIN ───────────────────────────────────────────────────────────────────
export function SearchTab({ onToast }) {
  const { searches, loading } = useSearches();
  const [query,    setQuery]    = useState("");
  const [filter,   setFilter]   = useState("all"); // all | riders | guests
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    let list = [...searches].sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });

    if (filter === "riders") list = list.filter(s => s.uid && s.uid !== "null");
    if (filter === "guests") list = list.filter(s => !s.uid || s.uid === "null" || s.uid === null);

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(s =>
        (s.pickup   || "").toLowerCase().includes(q) ||
        (s.dropoff  || "").toLowerCase().includes(q) ||
        (s.uid      || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [searches, query, filter]);

  const filterBtns = [
    { key: "all",    label: "All" },
    { key: "riders", label: "Riders" },
    { key: "guests", label: "Guests" },
  ];

  return (
    <div style={{ padding: "0 16px" }}>

      {/* Stats */}
      {!loading && searches.length > 0 && <StatsBar searches={searches} />}

      {/* Search input */}
      <div style={{
        position: "relative", marginBottom: 10,
      }}>
        <Search
          size={15}
          color={C.textMuted}
          style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
        />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by address or UID…"
          style={{
            width: "100%", padding: "11px 36px 11px 36px",
            borderRadius: 12, border: `1.5px solid ${C.border ?? "#E5E7EB"}`,
            background: C.surface ?? "#fff",
            fontFamily: "'Barlow', sans-serif", fontSize: 14, fontWeight: 500,
            color: C.text ?? "#111827", outline: "none",
            boxSizing: "border-box",
            transition: "border-color .15s",
          }}
          onFocus={e => e.target.style.borderColor = C.primary ?? "#0D9488"}
          onBlur={e  => e.target.style.borderColor = C.border ?? "#E5E7EB"}
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", padding: 2,
              display: "flex", alignItems: "center",
            }}
          >
            <X size={14} color={C.textMuted} />
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {filterBtns.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              padding: "6px 14px", borderRadius: 99,
              border: filter === key ? "none" : `1.5px solid ${C.border ?? "#E5E7EB"}`,
              background: filter === key
                ? (C.primary ?? "#0D9488")
                : (C.surface ?? "#fff"),
              color: filter === key ? "#fff" : (C.textMuted ?? "#6B7280"),
              fontFamily: "'Barlow', sans-serif", fontSize: 12, fontWeight: 700,
              cursor: "pointer", transition: "all .15s",
            }}
          >
            {label}
          </button>
        ))}
        <span style={{
          marginLeft: "auto",
          fontFamily: "'Barlow', sans-serif", fontSize: 12, fontWeight: 600,
          color: C.textMuted, alignSelf: "center",
        }}>
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: C.textMuted, fontFamily: "'Barlow', sans-serif", fontSize: 14 }}>
          Loading searches…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <Search size={28} color={C.border ?? "#E5E7EB"} style={{ margin: "0 auto 10px", display: "block" }} />
          <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, fontWeight: 600, color: C.textMuted }}>
            No searches found
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 100 }}>
          {filtered.map(doc => (
            <SearchCard key={doc.id} doc={doc} onClick={() => setSelected(doc)} />
          ))}
        </div>
      )}

      {/* Detail sheet */}
      <DetailDrawer doc={selected} onClose={() => setSelected(null)} />
    </div>
  );
}