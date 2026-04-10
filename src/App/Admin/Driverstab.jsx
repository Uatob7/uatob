import { useState } from "react";
import { Search, Bell, CheckCircle, XCircle, Ban, ChevronRight, FileText, Car } from "lucide-react";
import { C, STATUS_CONFIG } from '@/App/Admin/Tokens';
import { Avatar, StatusPill } from '@/App/Admin/UI';
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

function timeAgo(ts) {
  if (!ts) return "—";
  const seconds = ts?.seconds ?? Math.floor(ts / 1000);
  const diff = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fullName(d) {
  return `${d.firstName?.trim() ?? ""} ${d.lastName?.trim() ?? ""}`.trim() || "Unknown";
}

function docsComplete(documents = {}) {
  const required = ["insurance", "licenseFront", "profilePhoto", "registration"];
  const done = required.filter(k => documents[k] === true).length;
  return `${done}/${required.length} docs`;
}

export function DriversTab({ fleet = [], onToast }) {
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("all");
  const [selected, setSelected] = useState(null);

  const filters  = ["all", "online", "offline", "pending", "in_progress"];

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
        driverIdx={fleet.indexOf(selected)}
        onBack={() => setSelected(null)}
        onToast={onToast}
      />
    );
  }

  return (
    <div style={{ padding: "0 16px 16px" }}>
      {/* Search */}
      <div className="search-bar fade-up" style={{ marginBottom: 12, animationDelay: "40ms", opacity: 0 }}>
        <Search size={15} color={C.textDim} />
        <input
          placeholder="Search drivers…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Filter pills */}
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
            {/* count badge */}
            <span style={{
              marginLeft: 5, background: C.border, borderRadius: 100,
              padding: "1px 6px", fontSize: 10,
            }}>
              {f === "all" ? fleet.length : fleet.filter(d => d.status === f).length}
            </span>
          </button>
        ))}
      </div>

      {/* Driver list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 0", color: C.textMuted, fontSize: 13 }}>
            No drivers found
          </div>
        )}
        {filtered.map((driver, i) => (
          <div
            key={driver.id}
            className="card fade-up"
            style={{ animationDelay: `${130 + i * 45}ms`, opacity: 0, boxShadow: "0 1px 5px rgba(0,0,0,.04)", cursor: "pointer" }}
            onClick={() => setSelected(driver)}
          >
            <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ position: "relative" }}>
                <Avatar name={fullName(driver)} size={40} colorIdx={i} />
                <div style={{
                  position: "absolute", bottom: 0, right: 0,
                  width: 11, height: 11, borderRadius: "50%",
                  background: STATUS_CONFIG[driver.status]?.color || C.textDim,
                  border: `2px solid ${C.surface}`,
                }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{fullName(driver)}</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <span style={{ fontSize: 11, color: C.textMuted }}>{driver.email}</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                <StatusPill status={driver.status} />
                <span style={{ fontSize: 10, color: C.textMuted }}>{timeAgo(driver.createdAt)}</span>
              </div>
              <ChevronRight size={14} color={C.textDim} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Driver detail panel ───────────────────────────────────────────────
function DriverDetail({ driver: d, driverIdx, onBack, onToast }) {
  const db = getFirestore(firebase_app);

  const handleSuspendDriver = async () => {
    try {
      const driverRef = doc(db, "Drivers", d.id);
      await updateDoc(driverRef, { status: "suspended" });
      onToast(`🚫 ${fullName(d)} suspended`);
      onBack();
    } catch (err) {
      console.error("Error suspending driver:", err);
      onToast("Failed to suspend driver");
    }
  };

  const handleApproveDriver = async () => {
    try {
      const driverRef = doc(db, "Drivers", d.id);
      await updateDoc(driverRef, { status: "approved" });
      onToast(`✅ ${fullName(d)} approved`);
      onBack();
    } catch (err) {
      console.error("Error approving driver:", err);
      onToast("Failed to approve driver");
    }
  };

  const handleRejectDriver = async () => {
    try {
      const driverRef = doc(db, "Drivers", d.id);
      await updateDoc(driverRef, { status: "rejected" });
      onToast(`❌ ${fullName(d)} rejected`);
      onBack();
    } catch (err) {
      console.error("Error rejecting driver:", err);
      onToast("Failed to reject driver");
    }
  };
  const name = fullName(d);
  const docs = d.documents ?? {};
  const vehicle = d.vehicle ?? {};
  const contact = d.contact ?? {};

  const docItems = [
    { label: "Profile Photo",  done: docs.profilePhoto },
    { label: "License Front",  done: docs.licenseFront },
    { label: "Insurance",      done: docs.insurance },
    { label: "Registration",   done: docs.registration },
  ];

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <button className="btn-ghost" onClick={onBack} style={{ marginBottom: 16, padding: "8px 14px" }}>
        ← Back to drivers
      </button>

      {/* Profile card */}
      <div className="card" style={{ padding: "20px", marginBottom: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <Avatar name={name} size={52} colorIdx={driverIdx} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 5 }}>{name}</div>
            <StatusPill status={d.status} />
          </div>
        </div>

        {/* Info grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "Email",   value: d.email ?? "—" },
            { label: "Phone",   value: contact.phone ?? "—" },
            { label: "City",    value: contact.city ? `${contact.city.trim()}, ${contact.state}` : "—" },
            { label: "Joined",  value: timeAgo(d.createdAt) },
            { label: "Docs",    value: docsComplete(docs) },
            { label: "License", value: docs.licenseNumber ?? "—" },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: C.surfaceHigh, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: ".5px", marginBottom: 3 }}>
                {label.toUpperCase()}
              </div>
              <div className="mono" style={{ fontSize: 13, fontWeight: 600, wordBreak: "break-all" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Vehicle card */}
      {vehicle.make && (
        <div className="card" style={{ padding: "16px", marginBottom: 14, boxShadow: "0 1px 6px rgba(0,0,0,.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Car size={14} color={C.green} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Vehicle</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "Make",  value: vehicle.make },
              { label: "Model", value: vehicle.model?.trim() },
              { label: "Color", value: vehicle.color?.trim() },
              { label: "Plate", value: vehicle.plate },
              { label: "Year",  value: vehicle.year ?? "—" },
              { label: "VIN",   value: vehicle.vin ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: C.surfaceHigh, borderRadius: 8, padding: "8px 10px", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: ".5px", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{value ?? "—"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents checklist */}
      <div className="card" style={{ padding: "16px", marginBottom: 14, boxShadow: "0 1px 6px rgba(0,0,0,.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <FileText size={14} color={C.green} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>Documents</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {docItems.map(({ label, done }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13 }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: done ? C.green : C.red }}>
                {done ? "✓ Uploaded" : "✗ Missing"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(d.status === "pending" || d.status === "in_progress") && (
          <>
            <button className="btn-success" onClick={handleApproveDriver}>
              <CheckCircle size={15} /> Approve Driver
            </button>
            <button className="btn-danger" onClick={handleRejectDriver}>
              <XCircle size={15} /> Reject Application
            </button>
          </>
        )}
        <button className="btn-ghost" onClick={() => onToast("Message sent")}>
          <Bell size={14} /> Send Notification
        </button>
        {d.status !== "pending" && d.status !== "in_progress" && (
          <button className="btn-danger" onClick={handleSuspendDriver}>
            <Ban size={14} /> Suspend Driver
          </button>
        )}
      </div>
    </div>
  );
}
