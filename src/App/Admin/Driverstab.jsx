import { useState, useEffect } from "react";
import { Search, Bell, CheckCircle, XCircle, Ban, ChevronRight, FileText, Car, ArrowLeft, MapPin, Phone, Mail, Star, TrendingUp, Clock, Shield } from "lucide-react";
import { C, STATUS_CONFIG } from '@/App/Admin/Tokens';
import { Avatar, StatusPill } from '@/App/Admin/UI';
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

/* ── helpers ── */
function timeAgo(ts) {
  if (!ts) return "—";
  const seconds = ts?.seconds ?? Math.floor(ts / 1000);
  const diff = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatMinutesAgo(minutes) {
  if (minutes == null) return "—";
  if (minutes < 1)    return "just now";
  if (minutes < 60)   return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

function fullName(d) {
  return `${d.firstName?.trim() ?? ""} ${d.lastName?.trim() ?? ""}`.trim() || "Unknown";
}

function docsComplete(documents = {}) {
  const required = ["insurance", "licenseFront", "profilePhoto", "registration"];
  const done = required.filter(k => documents[k] === true).length;
  return { done, total: required.length };
}

function getInitials(name) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

const AVATAR_PALETTES = [
  { bg: "#E8F4F0", text: "#2D7A5F" },
  { bg: "#EEF2FF", text: "#4338CA" },
  { bg: "#FFF7ED", text: "#C2410C" },
  { bg: "#F0FDF4", text: "#166534" },
  { bg: "#FDF4FF", text: "#7E22CE" },
  { bg: "#FFF1F2", text: "#BE123C" },
];

/* ── STATUS styles for the light theme ── */
const LIGHT_STATUS = {
  online:      { bg: "#ECFDF5", color: "#059669", dot: "#10B981", label: "Online" },
  offline:     { bg: "#F3F4F6", color: "#6B7280", dot: "#9CA3AF", label: "Offline" },
  pending:     { bg: "#FFFBEB", color: "#D97706", dot: "#F59E0B", label: "Pending" },
  in_progress: { bg: "#EFF6FF", color: "#2563EB", dot: "#3B82F6", label: "In Progress" },
  approved:    { bg: "#ECFDF5", color: "#059669", dot: "#10B981", label: "Approved" },
  rejected:    { bg: "#FFF1F2", color: "#BE123C", dot: "#F43F5E", label: "Rejected" },
  suspended:   { bg: "#FFF7ED", color: "#C2410C", dot: "#F97316", label: "Suspended" },
  idle:        { bg: "#F5F3FF", color: "#7C3AED", dot: "#A78BFA", label: "Idle" },
};

function LightStatusPill({ status }) {
  const s = LIGHT_STATUS[status] || { bg: "#F3F4F6", color: "#6B7280", dot: "#9CA3AF", label: status };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 100,
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 700, letterSpacing: ".3px",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

// FIX: Safe avatar with fallback palette
function DriverAvatar({ name, size = 44, idx = 0 }) {
  // Ensure idx is non‑negative and within bounds
  const safeIdx = Math.abs(idx) % AVATAR_PALETTES.length;
  const palette = AVATAR_PALETTES[safeIdx] ?? AVATAR_PALETTES[0];
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28,
      background: palette.bg, color: palette.text,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      fontSize: size * 0.36, fontWeight: 800,
      flexShrink: 0, userSelect: "none",
      border: `1.5px solid ${palette.text}22`,
    }}>
      {getInitials(name)}
    </div>
  );
}

/* ════════════════════════════════════════
   DRIVERS TAB (list view)
════════════════════════════════════════ */
export function DriversTab({ fleet = [], onToast }) {
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("all");
  const [selected, setSelected] = useState(null);
  const [mounted,  setMounted]  = useState(false);

  useEffect(() => { setTimeout(() => setMounted(true), 30); }, []);

  const filters = ["all", "online", "offline", "pending", "in_progress"];

  const filtered = fleet.filter(d => {
    const name = fullName(d).toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) ||
                        d.email?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || d.status === filter;
    return matchSearch && matchFilter;
  });

  if (selected) {
    return (
      <DriverDetail
        driver={selected}
        driverIdx={fleet.indexOf(selected)}   // may be -1, but we'll handle inside DriverDetail
        onBack={() => setSelected(null)}
        onToast={onToast}
      />
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');

        .drv-root * { box-sizing: border-box; }

        .drv-search {
          display: flex; align-items: center; gap: 10px;
          background: #fff;
          border: 1.5px solid #E5E7EB;
          border-radius: 14px;
          padding: 0 14px;
          height: 44px;
          transition: border-color .2s, box-shadow .2s;
        }
        .drv-search:focus-within {
          border-color: #2D7A5F;
          box-shadow: 0 0 0 3px rgba(45,122,95,.08);
        }
        .drv-search input {
          flex: 1; border: none; outline: none; background: transparent;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 13px; color: #111827;
        }
        .drv-search input::placeholder { color: #9CA3AF; }

        .drv-pill {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 13px; border-radius: 100px;
          border: 1.5px solid #E5E7EB;
          background: #fff;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 12px; font-weight: 700; color: #6B7280;
          cursor: pointer; white-space: nowrap;
          transition: all .15s;
        }
        .drv-pill.active {
          border-color: #2D7A5F;
          background: #ECFDF5;
          color: #2D7A5F;
        }
        .drv-pill:not(.active):hover {
          border-color: #D1D5DB;
          background: #F9FAFB;
          color: #374151;
        }

        .drv-card {
          background: #fff;
          border: 1.5px solid #F3F4F6;
          border-radius: 18px;
          cursor: pointer;
          transition: border-color .18s, box-shadow .18s, transform .18s;
          overflow: hidden;
        }
        .drv-card:hover {
          border-color: #D1FAE5;
          box-shadow: 0 4px 20px rgba(45,122,95,.08);
          transform: translateY(-1px);
        }
        .drv-card:active { transform: translateY(0); }

        .drv-fade {
          opacity: 0; transform: translateY(14px);
          transition: opacity .45s cubic-bezier(.22,1,.36,1), transform .45s cubic-bezier(.22,1,.36,1);
        }
        .drv-fade.in { opacity: 1; transform: translateY(0); }

        .drv-count-badge {
          background: #F3F4F6; color: #9CA3AF;
          border-radius: 100px; padding: 1px 7px;
          font-size: 10px; font-weight: 700;
          margin-left: 4px;
        }
        .drv-pill.active .drv-count-badge {
          background: rgba(45,122,95,.12);
          color: #2D7A5F;
        }
      `}</style>

      <div className="drv-root" style={{ padding: "0 16px 24px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

        {/* Search */}
        <div className={`drv-fade ${mounted ? "in" : ""}`} style={{ marginBottom: 12, transitionDelay: "30ms" }}>
          <div className="drv-search">
            <Search size={15} color="#9CA3AF" strokeWidth={2.5} />
            <input
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ border: "none", background: "none", cursor: "pointer", color: "#9CA3AF", padding: 0, lineHeight: 1 }}>✕</button>
            )}
          </div>
        </div>

        {/* Filter pills */}
        <div className={`drv-fade ${mounted ? "in" : ""}`}
          style={{ display: "flex", gap: 7, marginBottom: 18, overflowX: "auto", paddingBottom: 2, transitionDelay: "70ms" }}>
          {filters.map(f => (
            <button key={f} className={`drv-pill ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f === "in_progress" ? "In Progress" : f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="drv-count-badge">
                {f === "all" ? fleet.length : fleet.filter(d => d.status === f).length}
              </span>
            </button>
          ))}
        </div>

        {/* Driver list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#9CA3AF", fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>🔍</div>
              No drivers found
            </div>
          )}
          {filtered.map((driver, i) => {
            const { done, total } = docsComplete(driver.documents);
            const st = LIGHT_STATUS[driver.status] || LIGHT_STATUS.offline;
            const showLastSeen = (driver.status === "online" || driver.status === "offline") && driver.minutesSinceLastSeen != null;

            return (
              <div
                key={driver.id}
                className={`drv-card drv-fade ${mounted ? "in" : ""}`}
                style={{ transitionDelay: `${120 + i * 40}ms` }}
                onClick={() => setSelected(driver)}
              >
                <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 13 }}>
                  {/* Avatar with status dot */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <DriverAvatar name={fullName(driver)} size={46} idx={i} />
                    <div style={{
                      position: "absolute", bottom: 1, right: 1,
                      width: 10, height: 10, borderRadius: "50%",
                      background: st.dot, border: "2px solid #fff",
                    }} />
                  </div>

                  {/* Name + email */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {fullName(driver)}
                    </div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {driver.email}
                    </div>
                  </div>

                  {/* Right side */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
                    <LightStatusPill status={driver.status} />
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={9} color="#C4C9D4" />
                      <span style={{ fontSize: 10, color: "#C4C9D4", fontWeight: 600 }}>
                        {showLastSeen ? formatMinutesAgo(driver.minutesSinceLastSeen) : timeAgo(driver.createdAt)}
                      </span>
                    </div>
                  </div>

                  <ChevronRight size={15} color="#D1D5DB" strokeWidth={2.5} />
                </div>

                {/* Subtle doc progress strip */}
                {(driver.status === "pending" || driver.status === "in_progress") && (
                  <div style={{ padding: "0 16px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 3, background: "#F3F4F6", borderRadius: 100, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(done / total) * 100}%`, background: "#2D7A5F", borderRadius: 100, transition: "width .6s" }} />
                    </div>
                    <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, whiteSpace: "nowrap" }}>{done}/{total} docs</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════
   DRIVER DETAIL
════════════════════════════════════════ */
function DriverDetail({ driver: d, driverIdx, onBack, onToast }) {
  const db = getFirestore(firebase_app);
  const [tab, setTab] = useState("info");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setTimeout(() => setMounted(true), 30); }, []);

  const handleSuspendDriver = async () => {
    try {
      await updateDoc(doc(db, "Drivers", d.id), { status: "suspended" });
      onToast(`🚫 ${fullName(d)} suspended`);
      onBack();
    } catch (err) { onToast("Failed to suspend driver"); }
  };

  const handleApproveDriver = async () => {
    try {
      await updateDoc(doc(db, "Drivers", d.id), { status: "approved" });
      onToast(`✅ ${fullName(d)} approved`);
      onBack();
    } catch (err) { onToast("Failed to approve driver"); }
  };

  const handleRejectDriver = async () => {
    try {
      await updateDoc(doc(db, "Drivers", d.id), { status: "rejected" });
      onToast(`❌ ${fullName(d)} rejected`);
      onBack();
    } catch (err) { onToast("Failed to reject driver"); }
  };

  const name    = fullName(d);
  const docs    = d.documents ?? {};
  const vehicle = d.vehicle   ?? {};
  const contact = d.contact   ?? {};
  const earnings = d.earnings ?? {};
  const { done: docsDone, total: docsTotal } = docsComplete(docs);

  const docItems = [
    { label: "Profile Photo", done: docs.profilePhoto, icon: "🤳" },
    { label: "License Front", done: docs.licenseFront, icon: "🪪" },
    { label: "License Back",  done: docs.licenseBack,  icon: "🪪" },
    { label: "Insurance",     done: docs.insurance,    icon: "📄" },
    { label: "Registration",  done: docs.registration, icon: "📋" },
  ];

  const showLastSeen = (d.status === "online" || d.status === "offline") && d.minutesSinceLastSeen != null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');

        .det-root * { box-sizing: border-box; }

        .det-fade {
          opacity: 0; transform: translateY(12px);
          transition: opacity .4s cubic-bezier(.22,1,.36,1), transform .4s cubic-bezier(.22,1,.36,1);
        }
        .det-fade.in { opacity: 1; transform: translateY(0); }

        .det-tab {
          flex: 1; border: none; background: none;
          padding: 9px 8px; border-radius: 10px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 12px; font-weight: 700; color: #9CA3AF;
          cursor: pointer; transition: all .15s;
          text-align: center;
        }
        .det-tab.active {
          background: #fff;
          color: #111827;
          box-shadow: 0 1px 4px rgba(0,0,0,.08);
        }
        .det-tab:not(.active):hover { color: #374151; }

        .det-section {
          background: #fff;
          border: 1.5px solid #F3F4F6;
          border-radius: 18px;
          padding: 18px;
          margin-bottom: 12px;
        }

        .det-section-title {
          font-size: 10px; font-weight: 800;
          letter-spacing: 1px; text-transform: uppercase;
          color: #9CA3AF; margin-bottom: 14px;
        }

        .det-info-cell {
          background: #FAFAFA;
          border: 1px solid #F3F4F6;
          border-radius: 12px;
          padding: 11px 13px;
        }

        .det-info-label {
          font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: .6px;
          color: #C4C9D4; margin-bottom: 4px;
        }

        .det-info-value {
          font-size: 13px; font-weight: 600; color: #111827;
          word-break: break-all;
        }

        .det-doc-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 12px; border-radius: 11px;
          transition: background .15s;
          border: 1px solid transparent;
        }
        .det-doc-row:hover { background: #F9FAFB; }

        .det-action-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; padding: 13px;
          border-radius: 14px; border: none;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 13px; font-weight: 700;
          cursor: pointer; transition: all .18s;
        }
        .det-action-btn:hover { transform: translateY(-1px); filter: brightness(.97); }
        .det-action-btn:active { transform: translateY(0); }

        .det-bar-segment {
          flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;
        }
        .det-stat-card {
          flex: 1;
          background: #FAFAFA;
          border: 1px solid #F3F4F6;
          border-radius: 14px;
          padding: 14px 10px;
          text-align: center;
        }
      `}</style>

      <div className="det-root" style={{ padding: "0 16px 28px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

        {/* Back button */}
        <div className={`det-fade ${mounted ? "in" : ""}`} style={{ marginBottom: 16, transitionDelay: "0ms" }}>
          <button onClick={onBack} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "none", border: "none", cursor: "pointer",
            color: "#6B7280", fontSize: 13, fontWeight: 700,
            padding: "8px 0", fontFamily: "'Plus Jakarta Sans', sans-serif",
            transition: "color .15s",
          }}>
            <ArrowLeft size={15} strokeWidth={2.5} />
            Back to drivers
          </button>
        </div>

        {/* ── HERO ── */}
        <div className={`det-fade ${mounted ? "in" : ""}`} style={{
          background: "#fff",
          border: "1.5px solid #F3F4F6",
          borderRadius: 22,
          padding: "22px 20px 18px",
          marginBottom: 12,
          position: "relative",
          overflow: "hidden",
          transitionDelay: "40ms",
        }}>
          {/* Decorative top stripe */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 4,
            background: "linear-gradient(90deg, #2D7A5F 0%, #10B981 50%, #6EE7B7 100%)",
          }} />

          <div style={{ display: "flex", alignItems: "flex-start", gap: 15, marginBottom: 18 }}>
            <div style={{ position: "relative" }}>
              {/* FIX: use Math.max(0, driverIdx) to avoid negative index */}
              <DriverAvatar name={name} size={58} idx={Math.max(0, driverIdx)} />
              {d.status === "online" && (
                <div style={{
                  position: "absolute", bottom: 1, right: 1,
                  width: 12, height: 12, borderRadius: "50%",
                  background: "#10B981", border: "2.5px solid #fff",
                  boxShadow: "0 0 0 2px rgba(16,185,129,.25)",
                }} />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: "'Instrument Serif', serif",
                fontSize: 22, color: "#111827", lineHeight: 1.2, marginBottom: 6,
              }}>
                {name}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <LightStatusPill status={d.status} />
                {d.averageRating > 0 && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    background: "#FFFBEB", color: "#D97706",
                    padding: "3px 10px", borderRadius: 100,
                    fontSize: 11, fontWeight: 700,
                  }}>
                    <Star size={10} fill="#D97706" /> {d.averageRating}.0
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 3 quick stats */}
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { icon: <Car size={13} color="#2D7A5F" />, label: "Rides", value: d.totalRides ?? 0 },
              { icon: <Clock size={13} color="#7C3AED" />, label: "Last seen", value: showLastSeen ? formatMinutesAgo(d.minutesSinceLastSeen) : timeAgo(d.createdAt) },
              { icon: <Shield size={13} color="#2563EB" />, label: "Docs", value: `${docsDone}/${docsTotal}` },
            ].map(({ icon, label, value }) => (
              <div key={label} className="det-stat-card">
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 5 }}>{icon}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 2 }}>{value}</div>
                <div style={{ fontSize: 10, color: "#C4C9D4", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── TABS ── */}
        <div className={`det-fade ${mounted ? "in" : ""}`} style={{
          background: "#F3F4F6",
          borderRadius: 14, padding: 5,
          display: "flex", gap: 3,
          marginBottom: 14,
          transitionDelay: "80ms",
        }}>
          {["info", "vehicle", "docs", "earnings"].map(t => (
            <button key={t} className={`det-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* ── INFO TAB ── */}
        {tab === "info" && (
          <div className={`det-fade ${mounted ? "in" : ""}`} style={{ transitionDelay: "110ms" }}>
            <div className="det-section">
              <div className="det-section-title">Contact</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                {[
                  { label: "Email",  value: d.email ?? "—",    icon: <Mail size={11} color="#9CA3AF" /> },
                  { label: "Phone",  value: contact.phone ?? "—", icon: <Phone size={11} color="#9CA3AF" /> },
                  { label: "City",   value: contact.city ? `${contact.city.trim()}, ${contact.state}` : "—", icon: <MapPin size={11} color="#9CA3AF" /> },
                  { label: "Joined", value: timeAgo(d.createdAt), icon: <Clock size={11} color="#9CA3AF" /> },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="det-info-cell">
                    <div className="det-info-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>{icon} {label}</div>
                    <div className="det-info-value">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Account flags */}
            <div className="det-section">
              <div className="det-section-title">Account</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {[
                  { label: "Deposit Paid",        ok: d.deposit,                           badge: d.deposit ? "Paid" : "Unpaid" },
                  { label: "Transfer Capability",  ok: d.transferCapability === "enabled",  badge: d.transferCapability ?? "—" },
                  { label: "Withdrawal Status",    ok: d.withdrawal?.status === "complete", badge: d.withdrawal?.status ?? "—" },
                  { label: "Payout Amount",        ok: true, badge: d.withdrawal?.totalPayout ? `$${d.withdrawal.totalPayout.toFixed(2)}` : "—" },
                ].map(({ label, ok, badge }) => (
                  <div key={label} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 13px", borderRadius: 12,
                    background: "#FAFAFA", border: "1px solid #F3F4F6",
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{label}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: ok ? "#059669" : "#D97706",
                      background: ok ? "#ECFDF5" : "#FFFBEB",
                      padding: "3px 10px", borderRadius: 100,
                      textTransform: "capitalize",
                    }}>
                      {badge}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── VEHICLE TAB ── */}
        {tab === "vehicle" && (
          <div className={`det-fade ${mounted ? "in" : ""}`} style={{ transitionDelay: "110ms" }}>
            {vehicle.make ? (
              <div className="det-section">
                {/* Vehicle hero */}
                <div style={{
                  background: "linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)",
                  border: "1px solid #D1FAE5",
                  borderRadius: 14, padding: "18px", marginBottom: 16,
                  display: "flex", alignItems: "center", gap: 14,
                }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: "#fff", border: "1px solid #D1FAE5",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 26,
                  }}>🚗</div>
                  <div>
                    <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, color: "#111827", lineHeight: 1.2 }}>
                      {vehicle.year} {vehicle.make}
                    </div>
                    <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>{vehicle.color} · {vehicle.plate}</div>
                    <div style={{ display: "flex", gap: 5, marginTop: 7 }}>
                      {(vehicle.rideTypes ?? []).map(t => (
                        <span key={t} style={{
                          background: "#EFF6FF", color: "#2563EB",
                          padding: "2px 9px", borderRadius: 100,
                          fontSize: 10, fontWeight: 700, textTransform: "capitalize",
                        }}>{t}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="det-section-title">Details</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                  {[
                    { label: "Make",  value: vehicle.make },
                    { label: "Model", value: vehicle.model?.trim() },
                    { label: "Color", value: vehicle.color?.trim() },
                    { label: "Plate", value: vehicle.plate },
                    { label: "Year",  value: vehicle.year ?? "—" },
                    { label: "VIN",   value: vehicle.vin  ?? "N/A" },
                  ].map(({ label, value }) => (
                    <div key={label} className="det-info-cell">
                      <div className="det-info-label">{label}</div>
                      <div className="det-info-value">{value ?? "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="det-section" style={{ textAlign: "center", padding: "32px 20px", color: "#9CA3AF", fontSize: 13 }}>
                No vehicle on file
              </div>
            )}
          </div>
        )}

        {/* ── DOCS TAB ── */}
        {tab === "docs" && (
          <div className={`det-fade ${mounted ? "in" : ""}`} style={{ transitionDelay: "110ms" }}>
            <div className="det-section">
              {/* Progress */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div className="det-section-title" style={{ marginBottom: 0 }}>Documents</div>
                <span style={{
                  fontSize: 12, fontWeight: 800, color: docsDone === docsTotal ? "#059669" : "#D97706",
                  background: docsDone === docsTotal ? "#ECFDF5" : "#FFFBEB",
                  padding: "3px 10px", borderRadius: 100,
                }}>{docsDone}/{docsTotal} complete</span>
              </div>
              <div style={{ height: 4, background: "#F3F4F6", borderRadius: 100, overflow: "hidden", marginBottom: 16 }}>
                <div style={{
                  height: "100%", borderRadius: 100,
                  width: `${(docsDone / docsTotal) * 100}%`,
                  background: docsDone === docsTotal
                    ? "linear-gradient(90deg, #059669, #10B981)"
                    : "linear-gradient(90deg, #D97706, #F59E0B)",
                  transition: "width .8s cubic-bezier(.22,1,.36,1)",
                }} />
              </div>

              {docItems.map(({ label, done, icon }) => (
                <div key={label} className="det-doc-row">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 10,
                      background: done ? "#ECFDF5" : "#FFF1F2",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16,
                    }}>{icon}</div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{label}</span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: done ? "#059669" : "#F43F5E",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    {done ? "✓ Uploaded" : "✗ Missing"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── EARNINGS TAB ── */}
        {tab === "earnings" && (
          <div className={`det-fade ${mounted ? "in" : ""}`} style={{ transitionDelay: "110ms" }}>
            <div className="det-section">
              <div className="det-section-title">Summary</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {[
                  { label: "Today",  value: `$${(earnings.today?.earnings ?? 0).toFixed(2)}`, sub: `${earnings.today?.trips ?? 0} trips` },
                  { label: "Week",   value: `$${(earnings.week?.earnings ?? 0).toFixed(2)}`,  sub: `${earnings.week?.trips ?? 0} trips` },
                  { label: "Month",  value: `$${(earnings.month?.earnings ?? 0).toFixed(2)}`, sub: `${earnings.month?.trips ?? 0} trips` },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="det-stat-card">
                    <div style={{ fontSize: 17, fontWeight: 800, color: "#111827", marginBottom: 3 }}>{value}</div>
                    <div style={{ fontSize: 10, color: "#C4C9D4", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 10, color: "#9CA3AF" }}>{sub}</div>
                  </div>
                ))}
              </div>

              {/* Bar chart */}
              <div className="det-section-title">This Week</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 68 }}>
                {(earnings.week?.dailyBreakdown ?? []).map(({ day, amount, isToday }) => {
                  const max = Math.max(...(earnings.week?.dailyBreakdown ?? []).map(b => b.amount ?? 0), 0.01);
                  const h = amount > 0 ? Math.max(10, (amount / max) * 56) : 5;
                  return (
                    <div key={day} className="det-bar-segment">
                      <div style={{
                        width: "100%", height: h,
                        borderRadius: 6,
                        background: isToday
                          ? "linear-gradient(180deg, #10B981 0%, #059669 100%)"
                          : amount > 0
                          ? "linear-gradient(180deg, #6EE7B7 0%, #34D399 100%)"
                          : "#F3F4F6",
                        border: isToday ? "none" : "1px solid #E5E7EB",
                        transition: "height .8s cubic-bezier(.22,1,.36,1)",
                      }} />
                      <span style={{ fontSize: 9, fontWeight: 700, color: isToday ? "#059669" : "#C4C9D4", textTransform: "uppercase" }}>{day}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payout card */}
            {d.withdrawal && (
              <div style={{
                background: d.withdrawal.status === "pending" ? "#FFFBEB" : "#ECFDF5",
                border: `1.5px solid ${d.withdrawal.status === "pending" ? "#FDE68A" : "#A7F3D0"}`,
                borderRadius: 18, padding: "18px 20px",
                display: "flex", alignItems: "center", gap: 14,
              }}>
                <div style={{ fontSize: 30 }}>💸</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", color: "#9CA3AF", marginBottom: 4 }}>
                    Pending Payout
                  </div>
                  <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 26, color: "#111827", lineHeight: 1 }}>
                    ${d.withdrawal.totalPayout?.toFixed(2) ?? "0.00"}
                  </div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                    {d.withdrawal.rideCount} rides · Transfer {d.transferCapability}
                  </div>
                </div>
                <span style={{
                  padding: "4px 12px", borderRadius: 100,
                  background: d.withdrawal.status === "pending" ? "#FEF3C7" : "#D1FAE5",
                  color: d.withdrawal.status === "pending" ? "#D97706" : "#059669",
                  fontSize: 11, fontWeight: 700, textTransform: "capitalize",
                }}>{d.withdrawal.status}</span>
              </div>
            )}
          </div>
        )}

        {/* ── ACTIONS ── */}
        <div className={`det-fade ${mounted ? "in" : ""}`} style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 14, transitionDelay: "160ms" }}>
          {(d.status === "pending" || d.status === "in_progress") && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
              <button className="det-action-btn" onClick={handleApproveDriver} style={{ background: "#ECFDF5", color: "#059669", border: "1.5px solid #A7F3D0" }}>
                <CheckCircle size={15} strokeWidth={2.5} /> Approve
              </button>
              <button className="det-action-btn" onClick={handleRejectDriver} style={{ background: "#FFF1F2", color: "#BE123C", border: "1.5px solid #FECDD3" }}>
                <XCircle size={15} strokeWidth={2.5} /> Reject
              </button>
            </div>
          )}
          <button className="det-action-btn" onClick={() => onToast("Message sent")}
            style={{ background: "#F8FAFC", color: "#475569", border: "1.5px solid #E2E8F0" }}>
            <Bell size={14} strokeWidth={2.5} /> Send Notification
          </button>
          {d.status !== "pending" && d.status !== "in_progress" && (
            <button className="det-action-btn" onClick={handleSuspendDriver}
              style={{ background: "#FFF7ED", color: "#C2410C", border: "1.5px solid #FED7AA" }}>
              <Ban size={14} strokeWidth={2.5} /> Suspend Driver
            </button>
          )}
        </div>

      </div>
    </>
  );
}