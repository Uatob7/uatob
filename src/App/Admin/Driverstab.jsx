(4) [{…}, {…}, {…}, {…}]
0
: 
{id: '3RjAcYUdDdVw6C59ejuQiqaWaI83', firstName: 'Anthony', currentStep: 1, lastName: 'eugene', createdAt: Timestamp, …}
1
: 
contact
: 
{zip: '32832', address: '2456 lake Nona Dr ', city: 'Orlando ', state: 'FL', phone: '2392972761'}
createdAt
: 
Timestamp {seconds: 1775337795, nanoseconds: 589000000}
currentStep
: 
1
documents
: 
{insurance: true, licenseFront: true, licenseNumber: 'H616423902610', profilePhoto: true, registration: true, …}
email
: 
"j.c.herbert22@gmail.com"
firstName
: 
"Jeffery "
id
: 
"5IUWVmreHsfcdANuAGiP3x1yOKj1"
lastName
: 
"Herbert "
status
: 
"pending"
uid
: 
"5IUWVmreHsfcdANuAGiP3x1yOKj1"
updatedAt
: 
Timestamp {seconds: 1775337802, nanoseconds: 312000000}
vehicle
: 
{plate: 'AJ58HN', color: 'Black ', model: 'Venza ', vin: 'JTEAAAAH5NJ118070', make: 'Toyota', …}
[[Prototype]]
: 
Object
2
: 
createdAt
: 
Timestamp {seconds: 1775336437, nanoseconds: 321000000}
currentStep
: 
1
email
: 
"Favored1now@outlook.com"
firstName
: 
"Jose "
id
: 
"Rwe7IjW5sRaZNb4dJkH9Vx2Uc2H3"
lastName
: 
"Rios "
status
: 
"in_progress"
uid
: 
"Rwe7IjW5sRaZNb4dJkH9Vx2Uc2H3"
updatedAt
: 
Timestamp {seconds: 1775336437, nanoseconds: 321000000}
[[Prototype]]
: 
Object
3
: 
createdAt
: 
Timestamp {seconds: 1775411103, nanoseconds: 584000000}
currentStep
: 
1
email
: 
"ff@live.com"
firstName
: 
"Fr"
id
: 
"zW6ixfoAC7bdHumBXEXAnQlKkIF2"
lastName
: 
"Fff"
status
: 
"in_progress"
uid
: 
"zW6ixfoAC7bdHumBXEXAnQlKkIF2"
updatedAt
: 
Timestamp {seconds: 1775411103, nanoseconds: 584000000}
[[Prototype]]
: 
Object
length
: 
4
[[Prototype]]
: 
Array(0)



// src/App/UaTob/Admin/tabs/DriversTab.jsx
import { useState } from "react";
import { Search, Bell, CheckCircle, XCircle, Ban, ChevronRight } from "lucide-react";
import { C, STATUS_CONFIG } from '@/App/Admin/Tokens';
import { Avatar, StatusPill }  from '@/App/Admin/UI';

// Replace with a useDrivers() Firestore hook when ready.
// Firestore collection: `drivers`  (driver account docs)
const MOCK_DRIVERS = [
  { id:"d001", name:"Jerome T.",  rating:4.97, rides:312, status:"online",  earnings:148.20, joined:"Jan 2024" },
  { id:"d002", name:"Leon A.",    rating:4.89, rides:204, status:"online",  earnings:94.80,  joined:"Mar 2024" },
  { id:"d003", name:"Kira N.",    rating:4.95, rides:187, status:"offline", earnings:0,      joined:"Feb 2024" },
  { id:"d004", name:"Tomás R.",   rating:4.82, rides:98,  status:"online",  earnings:76.40,  joined:"May 2024" },
  { id:"d005", name:"Sam H.",     rating:4.91, rides:441, status:"offline", earnings:0,      joined:"Nov 2023" },
  { id:"d006", name:"Aaliyah J.", rating:3.60, rides:23,  status:"pending", earnings:0,      joined:"Jun 2024" },
];

export function DriversTab({ fleet, onToast }) {

  console.log(fleet);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("all");
  const [selected, setSelected] = useState(null);

  const filters  = ["all","online","offline","pending"];
  const filtered = MOCK_DRIVERS.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || d.status === filter;
    return matchSearch && matchFilter;
  });

  if (selected) {
    return (
      <DriverDetail
        driver={selected}
        driverIdx={MOCK_DRIVERS.indexOf(selected)}
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
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Driver list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((driver, i) => (
          <div
            key={driver.id}
            className="card fade-up"
            style={{ animationDelay: `${130 + i * 45}ms`, opacity: 0, boxShadow: "0 1px 5px rgba(0,0,0,.04)", cursor: "pointer" }}
            onClick={() => setSelected(driver)}
          >
            <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ position: "relative" }}>
                <Avatar name={driver.name} size={40} colorIdx={i} />
                <div style={{
                  position: "absolute", bottom: 0, right: 0,
                  width: 11, height: 11, borderRadius: "50%",
                  background: STATUS_CONFIG[driver.status]?.color || C.textDim,
                  border: `2px solid ${C.surface}`,
                }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{driver.name}</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <span style={{ fontSize: 11, color: C.textMuted }}>★ {driver.rating}</span>
                  <span style={{ fontSize: 11, color: C.textMuted }}>{driver.rides} rides</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                <StatusPill status={driver.status} />
                {driver.earnings > 0 && (
                  <span className="mono" style={{ fontSize: 11, color: C.green }}>${driver.earnings}</span>
                )}
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
  return (
    <div style={{ padding: "0 16px 16px" }}>
      <button className="btn-ghost" onClick={onBack} style={{ marginBottom: 16, padding: "8px 14px" }}>
        ← Back to drivers
      </button>

      {/* Profile card */}
      <div className="card" style={{ padding: "20px", marginBottom: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <Avatar name={d.name} size={52} colorIdx={driverIdx} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 5 }}>{d.name}</div>
            <StatusPill status={d.status} />
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "Rating",   value: `★ ${d.rating}` },
            { label: "Rides",    value: d.rides },
            { label: "Earnings", value: d.earnings > 0 ? `$${d.earnings}` : "—" },
            { label: "Joined",   value: d.joined },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: C.surfaceHigh, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: ".5px", marginBottom: 3 }}>
                {label.toUpperCase()}
              </div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {d.status === "pending" && (
          <>
            <button className="btn-success" onClick={() => { onToast(`✅ ${d.name} approved`); onBack(); }}>
              <CheckCircle size={15} /> Approve Driver
            </button>
            <button className="btn-danger" onClick={() => { onToast(`❌ ${d.name} rejected`); onBack(); }}>
              <XCircle size={15} /> Reject Application
            </button>
          </>
        )}
        <button className="btn-ghost" onClick={() => onToast("Message sent")}>
          <Bell size={14} /> Send Notification
        </button>
        {d.status !== "pending" && (
          <button className="btn-danger" onClick={() => { onToast(`🚫 ${d.name} suspended`); onBack(); }}>
            <Ban size={14} /> Suspend Driver
          </button>
        )}
      </div>
    </div>
  );
}