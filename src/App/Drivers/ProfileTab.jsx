import { Car, Star, Shield, DollarSign, Bell, Settings, LogOut, ChevronRight } from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';

function formatDate(ts) {
  if (!ts) return "—";
  const date = ts.toDate?.() ?? new Date(ts);
  return date.toLocaleDateString([], { month: "short", year: "numeric" });
}

export default function ProfileTab({ driver, online }) {
  const accentColor = online ? C.onlineGreen : C.offlineInk;

  const firstName   = driver?.firstName  ?? "";
  const lastName    = driver?.lastName   ?? "";
  const fullName    = `${firstName} ${lastName}`.trim() || "Driver";
  const totalTrips  = driver?.earnings?.month?.trips ?? 0;
  const memberSince = formatDate(driver?.createdAt);

  const vehicle     = driver?.vehicle ?? {};
  const makeModel   = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ") || "—";
  const plate       = vehicle.plate  ?? "—";
  const color       = vehicle.color  ?? "—";
  const rideTypes   = Array.isArray(vehicle.rideTypes) && vehicle.rideTypes.length > 0
    ? vehicle.rideTypes.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(", ")
    : "—";

  return (
    <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, animation: "slideUp .38s ease-out forwards" }}>

      {/* Driver hero card */}
      <div style={{
        background: online
          ? "linear-gradient(135deg,#F0FDF4,#DCFCE7,#F0FDF4)"
          : "linear-gradient(135deg,#F9FAFB,#F3F4F6,#F9FAFB)",
        border:       online ? "1.5px solid rgba(22,163,74,.28)" : `1px solid ${C.border}`,
        borderRadius: 22, padding: "28px 24px",
        textAlign: "center", position: "relative", overflow: "hidden",
        boxShadow: online ? "0 4px 24px rgba(22,163,74,.1)" : `0 2px 12px ${C.shadow}`,
      }}>
        <div style={{
          position:   "absolute", inset: 0,
          background: `repeating-linear-gradient(45deg,transparent,transparent 60px,${online ? "rgba(22,163,74,.03)" : "rgba(0,0,0,.015)"} 60px,${online ? "rgba(22,163,74,.03)" : "rgba(0,0,0,.015)"} 61px)`,
        }}/>

        {/* Avatar */}
        <div style={{
          width: 72, height: 72,
          background: online
            ? "linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)"
            : "linear-gradient(135deg,#374151,#111827 55%,#0A0A0A)",
          border: "3px solid rgba(255,255,255,.8)", borderRadius: "50%",
          margin: "0 auto 14px",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: online
            ? "0 0 0 6px rgba(22,163,74,.15), 0 8px 24px rgba(22,163,74,.3)"
            : "0 0 0 6px rgba(0,0,0,.07), 0 8px 24px rgba(0,0,0,.18)",
          position: "relative",
        }}>
          <span style={{ fontSize: 26, fontWeight: 900, color: "#fff", fontFamily: "'Barlow Condensed', sans-serif" }}>
            {firstName.charAt(0).toUpperCase()}{lastName.charAt(0).toUpperCase()}
          </span>
        </div>

        <div className="condensed" style={{ fontSize: 26, fontWeight: 900, color: C.text, letterSpacing: "-0.5px" }}>
          {fullName}
        </div>
        <div style={{ fontSize: 13, color: online ? accentColor : C.textMid, marginTop: 4, fontWeight: 600 }}>
          Driver since {memberSince} · {totalTrips} trips
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 12 }}>
          {[...Array(5)].map((_, i) => <Star key={i} size={15} fill="#F59E0B" color="#F59E0B"/>)}
          <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: C.text, marginLeft: 5 }}>4.93</span>
        </div>
      </div>

      {/* Vehicle info */}
      <div className="card" style={{ padding: "20px" }}>
        <div className="condensed" style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 14, letterSpacing: "-0.3px" }}>
          Vehicle
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { label: "Make & Model", value: makeModel  },
            { label: "Plate",        value: plate       },
            { label: "Color",        value: color       },
            { label: "Ride Types",   value: rideTypes   },
          ].map(v => (
            <div key={v.label} style={{
              flex: "1 1 calc(50% - 5px)",
              background: C.surfaceAlt, border: `1px solid ${C.border}`,
              borderRadius: 13, padding: "13px 15px",
            }}>
              <div className="lbl">{v.label}</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, textTransform: "capitalize" }}>{v.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Settings list */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {[
          { icon: Shield,     label: "Documents & Insurance", c: C.blue      },
          { icon: DollarSign, label: "Payment & Payouts",     c: accentColor },
          { icon: Bell,       label: "Notifications",         c: C.textMid   },
          { icon: Settings,   label: "App Settings",          c: C.purple    },
          { icon: LogOut,     label: "Sign Out",              c: C.red       },
        ].map((item, i, arr) => (
          <div
            key={item.label}
            style={{
              padding:      "15px 20px",
              borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none",
              display: "flex", alignItems: "center", gap: 14,
              cursor: "pointer", transition: "background .15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ width: 36, height: 36, background: item.c + "12", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <item.icon size={16} color={item.c}/>
            </div>
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: item.label === "Sign Out" ? C.red : C.text }}>
              {item.label}
            </span>
            {item.label !== "Sign Out" && <ChevronRight size={14} color={C.textDim}/>}
          </div>
        ))}
      </div>
    </div>
  );
}