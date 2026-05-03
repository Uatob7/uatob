
import { useState, useEffect } from "react";
import {
  Search, Bell, CheckCircle, XCircle, Ban, ChevronRight,
  FileText, Car, Loader2, ArrowLeft, MapPin, Phone, Mail,
  Star, TrendingUp, DollarSign, Clock, Shield, Eye,
  AlertCircle, CheckCircle2, X, CreditCard, Hash,
} from "lucide-react";
import { C, STATUS_CONFIG } from '@/App/Admin/Tokens';
import { Avatar, StatusPill } from '@/App/Admin/UI';
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirestore, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const functions         = getFunctions(firebase_app, "us-east1");
const callApproveDriver = httpsCallable(functions, "approveDriver");
const callRejectDriver  = httpsCallable(functions, "rejectDriver");
const db                = getFirestore(firebase_app);

// ─── Helpers ───────────────────────────────────────────────────────────────
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

function formatTs(ts) {
  if (!ts) return "—";
  const date = ts.toDate?.() ?? new Date(ts);
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function fmtMoney(val) {
  return `$${Number(val ?? 0).toFixed(2)}`;
}

function fullName(d) {
  return `${d.firstName?.trim() ?? ""} ${d.lastName?.trim() ?? ""}`.trim() || "Unknown";
}

function docsComplete(documents = {}) {
  const required = ["insurance", "licenseFront", "profilePhoto", "registration"];
  const done = required.filter(k => documents[k] === true || documents[`${k}Url`]).length;
  return { done, total: required.length };
}

// ─── LIST TAB ──────────────────────────────────────────────────────────────
export function DriversTab({ fleet = [], onToast }) {
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("all");
  const [selected, setSelected] = useState(null);

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
        driverId={selected.id}
        driverIdx={fleet.indexOf(selected)}
        onBack={() => setSelected(null)}
        onToast={onToast}
      />
    );
  }

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="search-bar fade-up" style={{ marginBottom: 12, animationDelay: "40ms", opacity: 0 }}>
        <Search size={15} color={C.textDim} />
        <input placeholder="Search drivers…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="fade-up" style={{ display: "flex", gap: 8, marginBottom: 16, animationDelay: "80ms", opacity: 0, overflowX: "auto", paddingBottom: 2 }}>
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 14px", borderRadius: 100,
              border: `1.5px solid ${filter === f ? C.green : C.border}`,
              background: filter === f ? C.greenGlow : C.surface,
              color: filter === f ? C.green : C.textMuted,
              fontFamily: "'Barlow',sans-serif", fontSize: 12, fontWeight: 700,
              cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s",
            }}
          >
            {f === "in_progress" ? "In Progress" : f.charAt(0).toUpperCase() + f.slice(1)}
            <span style={{ marginLeft: 5, background: C.border, borderRadius: 100, padding: "1px 6px", fontSize: 10 }}>
              {f === "all" ? fleet.length : fleet.filter(d => d.status === f).length}
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 0", color: C.textMuted, fontSize: 13 }}>No drivers found</div>
        )}
        {filtered.map((driver, i) => {
          const { done, total } = docsComplete(driver.documents);
          const allDocs = done === total;
          return (
            <div
              key={driver.id}
              className="card fade-up"
              style={{ animationDelay: `${130 + i * 45}ms`, opacity: 0, cursor: "pointer", overflow: "hidden" }}
              onClick={() => setSelected(driver)}
            >
              {/* Status accent bar */}
              <div style={{ height: 3, background: STATUS_CONFIG[driver.status]?.color || C.border }} />
              <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ position: "relative" }}>
                  <Avatar name={fullName(driver)} size={42} colorIdx={i} />
                  <div style={{ position: "absolute", bottom: 0, right: 0, width: 11, height: 11, borderRadius: "50%", background: STATUS_CONFIG[driver.status]?.color || C.textDim, border: `2px solid ${C.surface}` }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{fullName(driver)}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{driver.email}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 5, alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: allDocs ? C.green : "#D97706", background: allDocs ? C.greenGlow : "#FFFBEB", border: `1px solid ${allDocs ? C.green + "40" : "#D9770640"}`, borderRadius: 6, padding: "2px 7px" }}>
                      {done}/{total} docs
                    </span>
                    {driver.averageRating && (
                      <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#F59E0B", fontWeight: 700 }}>
                        <Star size={9} fill="#F59E0B" /> {Number(driver.averageRating).toFixed(1)}
                      </span>
                    )}
                    {driver.totalRides != null && (
                      <span style={{ fontSize: 10, color: C.textMuted }}>{driver.totalRides} rides</span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                  <StatusPill status={driver.status} />
                  <span style={{ fontSize: 10, color: C.textMuted }}>
                    {(driver.status === "online" || driver.status === "offline") && driver.minutesSinceLastSeen != null
                      ? formatMinutesAgo(driver.minutesSinceLastSeen)
                      : timeAgo(driver.createdAt)}
                  </span>
                </div>
                <ChevronRight size={14} color={C.textDim} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DRIVER DETAIL ─────────────────────────────────────────────────────────
function DriverDetail({ driverId, driverIdx, onBack, onToast }) {
  const [d,          setD]          = useState(null);
  const [activeTab,  setActiveTab]  = useState("overview");
  const [approving,  setApproving]  = useState(false);
  const [rejecting,  setRejecting]  = useState(false);
  const [suspending, setSuspending] = useState(false);
  const [lightbox,   setLightbox]   = useState(null);

  // Live listener
  useEffect(() => {
    if (!driverId) return;
    const unsub = onSnapshot(
      doc(db, "Drivers", driverId),
      snap => { if (snap.exists()) setD({ id: snap.id, ...snap.data() }); },
      err  => console.error("[DriverDetail] snapshot error:", err)
    );
    return () => unsub();
  }, [driverId]);

  const handleApprove = async () => {
    if (approving) return;
    setApproving(true);
    try {
      await callApproveDriver({ driverUid: driverId });
      onToast(`✅ ${fullName(d)} approved`);
      onBack();
    } catch (err) {
      onToast(`Failed to approve: ${err.message}`);
    } finally { setApproving(false); }
  };

  const handleReject = async () => {
    if (rejecting) return;
    setRejecting(true);
    try {
      await callRejectDriver({ driverUid: driverId });
      onToast(`❌ ${fullName(d)} rejected`);
      onBack();
    } catch (err) {
      onToast(`Failed to reject: ${err.message}`);
    } finally { setRejecting(false); }
  };

  const handleSuspend = async () => {
    if (suspending) return;
    setSuspending(true);
    try {
      await updateDoc(doc(db, "Drivers", driverId), { status: "suspended" });
      onToast(`🚫 ${fullName(d)} suspended`);
      onBack();
    } catch (err) {
      onToast("Failed to suspend driver");
    } finally { setSuspending(false); }
  };

  if (!d) {
    return (
      <div style={{ padding: "60px 16px", textAlign: "center" }}>
        <Loader2 size={24} color={C.green} style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  const name       = fullName(d);
  const docs       = d.documents  ?? {};
  const vehicle    = d.vehicle    ?? {};
  const contact    = d.contact    ?? {};
  const earnings   = d.earnings   ?? {};
  const withdrawal = d.withdrawal ?? {};
  const week       = earnings.week  ?? {};
  const today      = earnings.today ?? {};
  const month      = earnings.month ?? {};

  const { done: docsDone, total: docsTotal } = docsComplete(docs);
  const allDocs = docsDone === docsTotal;

  const statusColor = STATUS_CONFIG[d.status]?.color || C.textDim;

  const docSlots = [
    { key: "licenseFront", urlKey: "licenseFrontUrl", label: "License Front" },
    { key: "licenseBack",  urlKey: "licenseBackUrl",  label: "License Back"  },
    { key: "insurance",    urlKey: "insuranceUrl",    label: "Insurance"     },
    { key: "registration", urlKey: "registrationUrl", label: "Registration"  },
    { key: "profilePhoto", urlKey: "profilePhotoUrl", label: "Profile Photo" },
  ];

  const tabs = ["overview", "documents", "earnings", "payout"];

  return (
    <div style={{ padding: "0 16px 24px" }}>
      <style>{`
        @keyframes spin     { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes fadeUp   { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
      `}</style>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, zIndex: 1300, background: "rgba(0,0,0,.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <button onClick={() => setLightbox(null)} style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,.15)", border: "none", borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={20} color="#fff" />
          </button>
          <img src={lightbox} alt="Document" style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 16, objectFit: "contain" }} />
        </div>
      )}

      {/* Back */}
      <button className="btn-ghost" onClick={onBack} style={{ marginBottom: 16, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6 }}>
        <ArrowLeft size={14} /> Back to drivers
      </button>

      {/* Hero card */}
      <div style={{
        background: "linear-gradient(135deg,#0F172A,#1E293B)",
        borderRadius: 20, padding: "22px 20px 20px",
        marginBottom: 14, position: "relative", overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,.2)",
      }}>
        {/* Status bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: statusColor }} />
        {/* Glow */}
        <div style={{ position: "absolute", top: -60, right: -60, width: 180, height: 180, borderRadius: "50%", background: `${statusColor}12`, pointerEvents: "none" }} />

        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
          <Avatar name={name} size={56} colorIdx={driverIdx} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 4, letterSpacing: "-0.3px" }}>{name}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <StatusPill status={d.status} />
              {d.averageRating != null && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#F59E0B", fontWeight: 700, background: "rgba(245,158,11,.12)", borderRadius: 6, padding: "3px 8px" }}>
                  <Star size={11} fill="#F59E0B" /> {Number(d.averageRating).toFixed(2)} · {d.totalReviews ?? 0} reviews
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { label: "Total Rides",   value: d.totalRides ?? 0,             icon: <Car size={12} color="rgba(255,255,255,.5)" /> },
            { label: "Earnings Today",value: fmtMoney(today.earnings),      icon: <DollarSign size={12} color="rgba(255,255,255,.5)" /> },
            { label: "Last Seen",     value: formatMinutesAgo(d.minutesSinceLastSeen), icon: <Clock size={12} color="rgba(255,255,255,.5)" /> },
          ].map(({ label, value, icon }) => (
            <div key={label} style={{ background: "rgba(255,255,255,.06)", borderRadius: 12, padding: "10px 12px", border: "1px solid rgba(255,255,255,.08)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>{icon}<span style={{ fontSize: 9, color: "rgba(255,255,255,.4)", fontWeight: 700, letterSpacing: ".04em" }}>{label.toUpperCase()}</span></div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 4, gap: 3, marginBottom: 14 }}>
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              flex: 1, padding: "8px 4px", border: "none",
              background: activeTab === t ? C.text : "transparent",
              color: activeTab === t ? "#fff" : C.textMuted,
              borderRadius: 9, fontSize: 11, fontWeight: 700,
              fontFamily: "'Barlow Condensed',sans-serif",
              cursor: "pointer", transition: "all .15s", textTransform: "capitalize",
            }}
          >
            {t === "payout" ? "Payout" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeUp .3s ease" }}>

          {/* Contact */}
          <div className="card" style={{ padding: "16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: ".06em", marginBottom: 12 }}>CONTACT</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { Icon: Mail,   value: d.email        ?? "—" },
                { Icon: Phone,  value: contact.phone  ?? "—" },
                { Icon: MapPin, value: contact.city   ? `${contact.city.trim()}, ${contact.state} ${contact.zip ?? ""}`.trim() : "—" },
              ].map(({ Icon, value }) => (
                <div key={value} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 30, height: 30, background: C.surfaceHigh, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={13} color={C.green} />
                  </div>
                  <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Account info */}
          <div className="card" style={{ padding: "16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: ".06em", marginBottom: 12 }}>ACCOUNT</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: "UID",      value: d.uid?.slice(0, 12) + "…" ?? "—" },
                { label: "Joined",   value: timeAgo(d.createdAt)           },
                { label: "License",  value: docs.licenseNumber ?? "—"      },
                { label: "Submitted",value: timeAgo(d.submittedAt)         },
                { label: "Stripe",   value: d.accountId ? "Connected" : "Not set", color: d.accountId ? C.green : C.red },
                { label: "Transfer", value: d.transferCapability ?? "—",  color: d.transferCapability === "enabled" ? C.green : "#D97706" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: C.surfaceHigh, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, letterSpacing: ".5px", marginBottom: 3 }}>{label.toUpperCase()}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: color ?? C.text, wordBreak: "break-all" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Vehicle */}
          {vehicle.make && (
            <div className="card" style={{ padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Car size={13} color={C.green} />
                <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: ".06em" }}>VEHICLE</span>
              </div>
              <div style={{ background: C.surfaceHigh, borderRadius: 12, padding: "14px 16px", border: `1px solid ${C.border}`, marginBottom: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: C.text, marginBottom: 2 }}>
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </div>
                <div style={{ fontSize: 13, color: C.textMuted }}>{vehicle.color}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { label: "Plate", value: vehicle.plate?.toUpperCase() ?? "—" },
                  { label: "VIN",   value: vehicle.vin ?? "N/A" },
                  { label: "Types", value: Array.isArray(vehicle.rideTypes) ? vehicle.rideTypes.join(", ") : "—" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: C.surfaceHigh, borderRadius: 8, padding: "8px 10px", border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: "capitalize" }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

  {/* Location */}
{d.lat && d.lng && (
  <div className="card" style={{ padding: "16px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <MapPin size={13} color={C.green} />
      <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: ".06em" }}>LAST LOCATION</span>
      {d.status === "online" && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: C.green }}>LIVE</span>
        </div>
      )}
    </div>
    <div style={{ background: C.surfaceHigh, borderRadius: 10, padding: "12px 14px", border: `1px solid ${C.border}` }}>
      <div style={{ fontFamily: "monospace", fontSize: 13, color: C.text, marginBottom: 4 }}>
        {d.lat?.toFixed(6)}, {d.lng?.toFixed(6)}
      </div>
      <div style={{ fontSize: 11, color: C.textMuted }}>{formatMinutesAgo(d.minutesSinceLastSeen)}</div>
    </div>
    <a
      href={`https://www.google.com/maps?q=${d.lat},${d.lng}`}
      target="_blank"
      rel="noreferrer"
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8, padding: "9px", background: "#1D4ED815", border: "1px solid #1D4ED830", borderRadius: 10, color: "#2563EB", fontSize: 12, fontWeight: 700, textDecoration: "none" }}
    >
      <MapPin size={12} /> Open in Google Maps
    </a>
  </div>
)}
        </div>
      )}

      {/* ── DOCUMENTS TAB ── */}
      {activeTab === "documents" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeUp .3s ease" }}>

          {/* Progress */}
          <div style={{ background: allDocs ? "#F0FDF4" : "#FFFBEB", border: `1.5px solid ${allDocs ? "#86EFAC" : "#FDE68A"}`, borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: allDocs ? C.green : "#D97706" }}>
                {allDocs ? "All documents submitted" : `${docsTotal - docsDone} document${docsTotal - docsDone !== 1 ? "s" : ""} missing`}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: allDocs ? C.green : "#D97706" }}>{docsDone}/{docsTotal}</span>
            </div>
            <div style={{ height: 6, background: allDocs ? "#BBF7D0" : "#FDE68A", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${(docsDone / docsTotal) * 100}%`, height: "100%", background: allDocs ? C.green : "#D97706", borderRadius: 99, transition: "width .4s" }} />
            </div>
          </div>

          {/* Doc cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {docSlots.map(({ key, urlKey, label }) => {
              const uploaded = Boolean(docs[urlKey] || docs[key]);
              const url      = docs[urlKey] || "";
              return (
                <div
                  key={key}
                  style={{
                    background: uploaded ? "#F0FDF4" : "#FEF2F2",
                    border: `1.5px solid ${uploaded ? "rgba(22,163,74,.25)" : "rgba(220,38,38,.2)"}`,
                    borderRadius: 14, overflow: "hidden",
                    cursor: uploaded && url ? "pointer" : "default",
                  }}
                  onClick={() => uploaded && url && setLightbox(url)}
                >
                  {/* Thumbnail */}
                  {url ? (
                    <div style={{ height: 80, background: "#1E293B", overflow: "hidden", position: "relative" }}>
                      <img src={url} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: .85 }} />
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.15)" }}>
                        <Eye size={18} color="#fff" />
                      </div>
                    </div>
                  ) : (
                    <div style={{ height: 80, background: "rgba(220,38,38,.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <FileText size={22} color="rgba(220,38,38,.4)" />
                    </div>
                  )}
                  <div style={{ padding: "10px 12px" }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text, marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: uploaded ? C.green : "#DC2626" }}>
                      {uploaded ? "✓ Uploaded" : "✗ Missing"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── EARNINGS TAB ── */}
      {activeTab === "earnings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeUp .3s ease" }}>

          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "Today",      value: fmtMoney(today.earnings),  sub: `${today.trips ?? 0} trips`,  color: C.green  },
              { label: "This Week",  value: fmtMoney(week.earnings),   sub: `${week.trips  ?? 0} trips`,  color: "#2563EB" },
              { label: "This Month", value: fmtMoney(month.earnings),  sub: `${month.trips ?? 0} trips`,  color: "#7C3AED" },
              { label: "All Time",   value: `${d.totalRides ?? 0} rides`, sub: "completed",              color: "#D97706" },
            ].map(({ label, value, sub, color }) => (
              <div key={label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 14px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: "14px 14px 0 0" }} />
                <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, letterSpacing: ".06em", marginBottom: 6 }}>{label.toUpperCase()}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: C.text, marginBottom: 2 }}>{value}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Weekly breakdown */}
          {(week.dailyBreakdown ?? []).length > 0 && (
            <div className="card" style={{ padding: "16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: ".06em", marginBottom: 14 }}>DAILY BREAKDOWN</div>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 64 }}>
                {(week.dailyBreakdown ?? []).map(({ day, amount, isToday }) => {
                  const max = Math.max(...(week.dailyBreakdown ?? []).map(d => d.amount ?? 0), 1);
                  const pct = ((amount ?? 0) / max) * 100;
                  return (
                    <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ width: "100%", position: "relative", height: 48, display: "flex", alignItems: "flex-end" }}>
                        <div style={{ width: "100%", height: `${Math.max(pct, (amount ?? 0) > 0 ? 8 : 0)}%`, background: isToday ? C.green : C.green + "35", borderRadius: "4px 4px 2px 2px", transition: "height .4s" }} />
                      </div>
                      <div style={{ fontSize: 9, color: isToday ? C.green : C.textMuted, fontWeight: isToday ? 800 : 400 }}>{day}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Last synced */}
          {earnings.lastSyncedAt && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
              <Clock size={11} color={C.textMuted} />
              <span style={{ fontSize: 11, color: C.textMuted }}>Synced {formatTs(earnings.lastSyncedAt)}</span>
            </div>
          )}
        </div>
      )}

      {/* ── PAYOUT TAB ── */}
      {activeTab === "payout" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeUp .3s ease" }}>

          {/* Status hero */}
          <div style={{
            background: withdrawal.status === "paid"
              ? "linear-gradient(135deg,#14532D,#166534)"
              : withdrawal.status === "pending"
                ? "linear-gradient(135deg,#78350F,#92400E)"
                : "linear-gradient(135deg,#1E293B,#0F172A)",
            borderRadius: 18, padding: "22px 18px",
            boxShadow: "0 4px 24px rgba(0,0,0,.2)",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.5)", letterSpacing: ".08em", marginBottom: 6 }}>WITHDRAWAL STATUS</div>
            <div style={{ fontSize: 38, fontWeight: 900, color: "#fff", marginBottom: 4 }}>{fmtMoney(withdrawal.totalPayout)}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
                background: withdrawal.status === "paid" ? "#22C55E30" : withdrawal.status === "pending" ? "#F59E0B30" : "rgba(255,255,255,.1)",
                color: withdrawal.status === "paid" ? "#4ADE80" : withdrawal.status === "pending" ? "#FCD34D" : "rgba(255,255,255,.6)",
                border: `1px solid ${withdrawal.status === "paid" ? "#4ADE8040" : withdrawal.status === "pending" ? "#FCD34D40" : "rgba(255,255,255,.15)"}`,
              }}>
                {(withdrawal.status ?? "No payout").toUpperCase()}
              </span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>
                {withdrawal.rideCount ?? 0} ride{(withdrawal.rideCount ?? 0) !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Payout meta */}
          <div className="card" style={{ padding: "16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: ".06em", marginBottom: 12 }}>PAYOUT DETAILS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Total Payout", value: fmtMoney(withdrawal.totalPayout) },
                { label: "Ride Count",   value: withdrawal.rideCount ?? 0 },
                { label: "Status",       value: withdrawal.status ?? "—" },
                { label: "Created",      value: formatTs(withdrawal.createdAt) },
                { label: "Updated",      value: formatTs(withdrawal.updatedAt) },
                { label: "Paid At",      value: formatTs(withdrawal.paidAt) },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 12.5, color: C.textMuted }}>{label}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{String(value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stripe */}
          <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 36, height: 36, background: "#635BFF15", border: "1px solid #635BFF30", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <CreditCard size={16} color="#635BFF" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>Stripe Account</div>
              <div style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace" }}>{d.accountId ?? "Not connected"}</div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: d.accountId ? C.greenGlow : "#FEF2F2", color: d.accountId ? C.green : "#DC2626", border: `1px solid ${d.accountId ? C.green + "30" : "#DC262630"}` }}>
              {d.accountId ? "CONNECTED" : "MISSING"}
            </span>
          </div>

          {/* Ride IDs */}
          {(withdrawal.rideIds ?? []).length > 0 && (
            <div className="card" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: ".06em", marginBottom: 10 }}>RIDE IDs</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {withdrawal.rideIds.map((id, i) => (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, background: C.surfaceHigh, borderRadius: 8, padding: "7px 10px", border: `1px solid ${C.border}` }}>
                    <Hash size={11} color={C.textMuted} />
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: C.text }}>{id}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ACTION BUTTONS ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        {(d.status === "pending" || d.status === "in_progress") && (
          <>
            <button
              className="btn-success"
              onClick={handleApprove}
              disabled={approving || rejecting}
              style={{ opacity: approving || rejecting ? .6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {approving
                ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Approving…</>
                : <><CheckCircle size={15} /> Approve Driver</>
              }
            </button>
            <button
              className="btn-danger"
              onClick={handleReject}
              disabled={approving || rejecting}
              style={{ opacity: approving || rejecting ? .6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {rejecting
                ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Rejecting…</>
                : <><XCircle size={15} /> Reject Application</>
              }
            </button>
          </>
        )}
        <button className="btn-ghost" onClick={() => onToast("Notification sent")} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Bell size={14} /> Send Notification
        </button>
        {d.status !== "pending" && d.status !== "in_progress" && (
          <button
            className="btn-danger"
            onClick={handleSuspend}
            disabled={suspending}
            style={{ opacity: suspending ? .6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {suspending
              ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Suspending…</>
              : <><Ban size={14} /> Suspend Driver</>
            }
          </button>
        )}
      </div>
    </div>
  );
}