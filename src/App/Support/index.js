// UADashboard.jsx — UaTob Field Operator Dashboard
// Role: UA (User Admin) — read/write ops, no platform settings access
// Design: Dark ops-terminal, monospace accents, amber/orange alert palette

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Car, Users, CircleDollarSign, ListChecks, RotateCcw,
  MapPin, ChevronRight, Search, X, CheckCircle2, XCircle,
  Clock, Zap, ArrowUpRight, ArrowDownRight, Hash, Wifi,
  WifiOff, RefreshCw, Plus, Minus, AlertTriangle, Shield,
  ChevronsRight, Phone, Star, Calendar, Filter, MoreVertical
} from "lucide-react";

// ─── Mock data (replace with real Firebase hooks) ────────────────────────────
const MOCK_STATS = {
  ridesActive:   4,
  ridesSearching:2,
  ridesTotal:    1847,
  driversOnline: 9,
  driversTotal:  23,
  accountsTotal: 412,
  revenueToday:  "$1,284",
  completedToday:38,
  refundsIssued: 2,
};

const MOCK_RIDES = [
  { id:"R-8812", rider:"Marcus T.", driver:"Leon R.", status:"active",   fare:"$18.40", pickup:"Downtown Orlando",  dropoff:"Airport", duration:"22 min", started:"9:14 AM"  },
  { id:"R-8811", rider:"Priya S.", driver:"Sam K.",  status:"active",   fare:"$9.80",  pickup:"UCF Campus",       dropoff:"Walmart Supercenter", duration:"11 min", started:"9:08 AM"  },
  { id:"R-8810", rider:"Jade M.", driver:null,       status:"searching", fare:"$14.20", pickup:"Lake Nona",        dropoff:"Disney Springs", duration:"—",      started:"9:19 AM"  },
  { id:"R-8809", rider:"Tom A.",  driver:null,       status:"searching", fare:"$22.00", pickup:"I-Drive",          dropoff:"Sand Lake Rd", duration:"—",      started:"9:21 AM"  },
  { id:"R-8808", rider:"Carla B.",driver:"Mike D.",  status:"completed", fare:"$11.60", pickup:"Thornton Park",    dropoff:"Mills Ave", duration:"14 min", started:"8:52 AM"  },
  { id:"R-8807", rider:"Eli N.",  driver:"Jay P.",   status:"completed", fare:"$7.20",  pickup:"College Park",     dropoff:"Edgewater Dr", duration:"9 min",  started:"8:40 AM"  },
  { id:"R-8806", rider:"Mia R.",  driver:"Leon R.",  status:"completed", fare:"$31.00", pickup:"Orlando Int'l",    dropoff:"Windermere", duration:"37 min", started:"7:55 AM"  },
  { id:"R-8805", rider:"Sophia L.",driver:"Sam K.",  status:"cancelled", fare:"$0.00",  pickup:"MetroWest",        dropoff:"Dr. Phillips", duration:"—",      started:"8:10 AM"  },
];

const MOCK_DRIVERS = [
  { id:"D-01", name:"Leon R.",  status:"online",  rides:3, rating:4.9, phone:"407-555-0191", vehicle:"Toyota Camry · XHJ-884", joined:"Jan 2024" },
  { id:"D-02", name:"Sam K.",   status:"online",  rides:2, rating:4.8, phone:"407-555-0142", vehicle:"Honda Accord · YKL-221", joined:"Mar 2024" },
  { id:"D-03", name:"Mike D.",  status:"online",  rides:1, rating:4.7, phone:"407-555-0137", vehicle:"Kia Stinger · ZPW-991", joined:"Feb 2024" },
  { id:"D-04", name:"Jay P.",   status:"online",  rides:0, rating:4.6, phone:"407-555-0188", vehicle:"Hyundai Sonata · ART-002", joined:"Apr 2024" },
  { id:"D-05", name:"Chris V.", status:"offline", rides:0, rating:4.5, phone:"407-555-0111", vehicle:"Toyota Corolla · BNM-773", joined:"Dec 2023" },
  { id:"D-06", name:"Dana F.",  status:"offline", rides:0, rating:4.9, phone:"407-555-0166", vehicle:"Honda Civic · CXQ-488",  joined:"Nov 2023" },
];

const MOCK_ACCOUNTS = [
  { id:"U-441", name:"Marcus T.",  email:"marcus@email.com",  rides:18, joined:"Oct 2023", status:"active"   },
  { id:"U-440", name:"Priya S.",   email:"priya@email.com",   rides:7,  joined:"Jan 2024", status:"active"   },
  { id:"U-439", name:"Jade M.",    email:"jade@email.com",    rides:31, joined:"Aug 2023", status:"active"   },
  { id:"U-438", name:"Tom A.",     email:"tom@email.com",     rides:3,  joined:"Mar 2024", status:"active"   },
  { id:"U-437", name:"Carla B.",   email:"carla@email.com",   rides:44, joined:"Jun 2023", status:"active"   },
  { id:"U-436", name:"Eli N.",     email:"eli@email.com",     rides:12, joined:"Nov 2023", status:"suspended"},
];

// ─── Design tokens ───────────────────────────────────────────────────────────
const C = {
  bg:       "#0C0D0F",
  surface:  "#111316",
  card:     "#16191E",
  border:   "#1E2229",
  borderHi: "#2A2F3A",
  amber:    "#F59E0B",
  amberDim: "#92400E",
  green:    "#10B981",
  greenDim: "#064E3B",
  red:      "#EF4444",
  redDim:   "#7F1D1D",
  blue:     "#3B82F6",
  text:     "#E8EAF0",
  muted:    "#5A6172",
  subtle:   "#2E3340",
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Sora:wght@400;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body { background: ${C.bg}; }
  ::-webkit-scrollbar { width: 0; }

  @keyframes pulse-dot {
    0%,100% { opacity: 1; transform: scale(1); }
    50%      { opacity: .5; transform: scale(.85); }
  }
  @keyframes slide-up {
    from { opacity:0; transform:translateY(22px) }
    to   { opacity:1; transform:translateY(0) }
  }
  @keyframes fade-in {
    from { opacity:0 } to { opacity:1 }
  }
  @keyframes shimmer {
    0%   { background-position: -400px 0 }
    100% { background-position: 400px 0 }
  }
  @keyframes spin { from {transform:rotate(0deg)} to {transform:rotate(360deg)} }

  .ua-tab { flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;
    padding:8px 0; cursor:pointer; transition: color .15s; }
  .ua-tab.active span { color:${C.amber}; }
  .ua-tab.active svg  { color:${C.amber}; }
  .ua-tab svg, .ua-tab span { color:${C.muted}; transition:color .15s; }

  .ua-card { background:${C.card}; border:1px solid ${C.border}; border-radius:14px;
    transition: border-color .15s; }
  .ua-card:active { border-color:${C.borderHi}; }

  .ua-row { display:flex; align-items:center; gap:12px; padding:14px 16px;
    border-bottom:1px solid ${C.border}; cursor:pointer; transition:background .12s; }
  .ua-row:last-child { border-bottom:none; }
  .ua-row:active { background: rgba(255,255,255,.03); }

  .ua-btn-primary {
    background: ${C.amber}; color:#000; border:none; border-radius:10px;
    font-family:'Sora',sans-serif; font-weight:700; font-size:14px;
    padding:12px 20px; cursor:pointer; transition:opacity .12s, transform .1s;
    display:flex; align-items:center; gap:6px;
  }
  .ua-btn-primary:active { opacity:.85; transform:scale(.97); }

  .ua-btn-ghost {
    background:transparent; color:${C.muted}; border:1px solid ${C.border};
    border-radius:10px; font-family:'Sora',sans-serif; font-weight:600; font-size:13px;
    padding:10px 16px; cursor:pointer; transition:border-color .12s, color .12s;
    display:flex; align-items:center; gap:6px;
  }
  .ua-btn-ghost:active { border-color:${C.borderHi}; color:${C.text}; }

  .ua-btn-danger {
    background:rgba(239,68,68,.12); color:${C.red}; border:1px solid rgba(239,68,68,.25);
    border-radius:10px; font-family:'Sora',sans-serif; font-weight:600; font-size:13px;
    padding:10px 16px; cursor:pointer; transition:background .12s;
    display:flex; align-items:center; gap:6px;
  }
  .ua-btn-danger:active { background:rgba(239,68,68,.2); }

  .ua-input {
    background:${C.surface}; border:1px solid ${C.border}; border-radius:10px;
    color:${C.text}; font-family:'Sora',sans-serif; font-size:14px;
    padding:11px 14px; width:100%; outline:none; transition:border-color .15s;
  }
  .ua-input:focus { border-color:${C.amber}; }
  .ua-input::placeholder { color:${C.muted}; }

  .chip {
    display:inline-flex; align-items:center; gap:4px;
    padding:3px 9px; border-radius:6px;
    font-family:'IBM Plex Mono',monospace; font-size:11px; font-weight:500;
    letter-spacing:.3px;
  }
  .chip.active    { background:rgba(16,185,129,.12);  color:${C.green}; }
  .chip.searching { background:rgba(245,158,11,.12);  color:${C.amber}; }
  .chip.completed { background:rgba(59,130,246,.12);  color:${C.blue};  }
  .chip.cancelled { background:rgba(90,97,114,.12);   color:${C.muted}; }
  .chip.online    { background:rgba(16,185,129,.12);  color:${C.green}; }
  .chip.offline   { background:rgba(90,97,114,.12);   color:${C.muted}; }
  .chip.suspended { background:rgba(239,68,68,.12);   color:${C.red};   }

  .modal-backdrop {
    position:fixed; inset:0; z-index:200;
    background:rgba(0,0,0,.7); backdrop-filter:blur(6px);
    display:flex; align-items:flex-end; justify-content:center;
    animation:fade-in .15s ease;
    padding:0;
  }
  .modal-sheet {
    background:${C.card}; border:1px solid ${C.border};
    border-radius:20px 20px 0 0; width:100%; max-width:480px;
    padding:24px 20px 36px;
    animation:slide-up .22s cubic-bezier(.34,1.4,.64,1);
    max-height:85vh; overflow-y:auto;
  }
  .modal-pill {
    width:40px; height:4px; border-radius:2px;
    background:${C.subtle}; margin:0 auto 20px;
  }

  .search-bar {
    display:flex; align-items:center; gap:10px;
    background:${C.surface}; border:1px solid ${C.border}; border-radius:12px;
    padding:11px 14px; transition:border-color .15s;
  }
  .search-bar:focus-within { border-color:${C.amber}; }
  .search-bar input {
    background:transparent; border:none; outline:none;
    color:${C.text}; font-family:'Sora',sans-serif; font-size:14px; flex:1;
  }
  .search-bar input::placeholder { color:${C.muted}; }

  .stat-ticker {
    font-family:'IBM Plex Mono',monospace;
    font-size:26px; font-weight:600; color:${C.text};
    line-height:1;
  }

  .live-dot {
    width:7px; height:7px; border-radius:50%; background:${C.green};
    animation: pulse-dot 1.4s ease-in-out infinite;
    display:inline-block;
  }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function Mono({ children, style }) {
  return <span style={{ fontFamily:"'IBM Plex Mono',monospace", ...style }}>{children}</span>;
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily:"'IBM Plex Mono',monospace", fontSize:10, fontWeight:600,
      color:C.muted, letterSpacing:"1.5px", textTransform:"uppercase",
      padding:"0 4px", marginBottom:10,
    }}>
      {children}
    </div>
  );
}

function Chip({ status }) {
  const labels = {
    active:"● LIVE", searching:"◌ MATCHING", completed:"✓ DONE",
    cancelled:"✕ CANCELLED", online:"● ONLINE", offline:"○ OFFLINE",
    suspended:"⚠ SUSPENDED", active_acct:"● ACTIVE",
  };
  return <span className={`chip ${status}`}>{labels[status] ?? status}</span>;
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function RideDetailModal({ ride, onClose, onAssign, onRemove, onRefund }) {
  if (!ride) return null;
  return (
    <div className="modal-backdrop" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-pill"/>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div>
            <Mono style={{ fontSize:11, color:C.amber, letterSpacing:"1px" }}>{ride.id}</Mono>
            <div style={{ fontFamily:"'Sora',sans-serif", fontSize:20, fontWeight:800, color:C.text, marginTop:2 }}>
              {ride.rider}
            </div>
          </div>
          <Chip status={ride.status}/>
        </div>

        {/* Route */}
        <div className="ua-card" style={{ padding:"14px 16px", marginBottom:16 }}>
          <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, paddingTop:2 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:C.green }}/>
              <div style={{ width:1, height:28, background:C.border }}/>
              <div style={{ width:8, height:8, borderRadius:"50%", background:C.amber }}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, color:C.muted, marginBottom:2 }}>Pickup</div>
              <div style={{ fontSize:14, fontWeight:600, color:C.text, marginBottom:12 }}>{ride.pickup}</div>
              <div style={{ fontSize:13, color:C.muted, marginBottom:2 }}>Dropoff</div>
              <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{ride.dropoff}</div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:20 }}>
          {[
            { label:"FARE",     value:ride.fare },
            { label:"DURATION", value:ride.duration },
            { label:"STARTED",  value:ride.started },
          ].map(s => (
            <div key={s.label} className="ua-card" style={{ padding:"12px 10px", textAlign:"center" }}>
              <Mono style={{ fontSize:9, color:C.muted, letterSpacing:"1px", display:"block", marginBottom:4 }}>{s.label}</Mono>
              <div style={{ fontSize:14, fontWeight:700, color:C.text, fontFamily:"'IBM Plex Mono',monospace" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Driver */}
        <div className="ua-card" style={{ padding:"12px 16px", marginBottom:20, display:"flex", alignItems:"center", gap:12 }}>
          <div style={{
            width:38, height:38, borderRadius:"50%",
            background: ride.driver ? "rgba(16,185,129,.15)" : C.subtle,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <Car size={18} color={ride.driver ? C.green : C.muted}/>
          </div>
          <div style={{ flex:1 }}>
            <Mono style={{ fontSize:10, color:C.muted, display:"block", marginBottom:2 }}>ASSIGNED DRIVER</Mono>
            <div style={{ fontSize:14, fontWeight:600, color:ride.driver ? C.text : C.muted }}>
              {ride.driver ?? "Unassigned"}
            </div>
          </div>
          {ride.status === "searching" && (
            <button className="ua-btn-primary" style={{ padding:"8px 14px", fontSize:12 }}
              onClick={() => onAssign(ride)}>
              <Plus size={13}/> Assign
            </button>
          )}
        </div>

        {/* Actions */}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {ride.status === "active" && (
            <button className="ua-btn-danger" style={{ width:"100%", justifyContent:"center" }}
              onClick={() => { onRemove(ride); onClose(); }}>
              <XCircle size={15}/> Cancel Ride
            </button>
          )}
          {(ride.status === "active" || ride.status === "completed") && (
            <button className="ua-btn-ghost" style={{ width:"100%", justifyContent:"center" }}
              onClick={() => { onRefund(ride); onClose(); }}>
              <RotateCcw size={15}/> Issue Refund — {ride.fare}
            </button>
          )}
          <button className="ua-btn-ghost" style={{ width:"100%", justifyContent:"center" }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignDriverModal({ ride, drivers, onAssign, onClose }) {
  if (!ride) return null;
  const online = drivers.filter(d => d.status === "online" && d.rides < 3);
  return (
    <div className="modal-backdrop" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-pill"/>
        <div style={{ fontFamily:"'Sora',sans-serif", fontSize:18, fontWeight:800, color:C.text, marginBottom:4 }}>
          Assign Driver
        </div>
        <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>
          {ride.rider} · {ride.pickup} → {ride.dropoff}
        </div>
        <SectionLabel>Available drivers</SectionLabel>
        <div className="ua-card" style={{ overflow:"hidden" }}>
          {online.length === 0 && (
            <div style={{ padding:"20px", textAlign:"center", color:C.muted, fontSize:13 }}>
              No available drivers online
            </div>
          )}
          {online.map(d => (
            <div key={d.id} className="ua-row" onClick={() => { onAssign(ride, d); onClose(); }}>
              <div style={{
                width:36, height:36, borderRadius:"50%",
                background:"rgba(16,185,129,.12)", border:"1px solid rgba(16,185,129,.25)",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <Car size={16} color={C.green}/>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, color:C.text, fontSize:14 }}>{d.name}</div>
                <Mono style={{ fontSize:11, color:C.muted }}>{d.vehicle}</Mono>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:12, color:C.muted }}>{d.rides} active</div>
                <div style={{ fontSize:12, color:C.amber }}>★ {d.rating}</div>
              </div>
              <ChevronRight size={15} color={C.muted}/>
            </div>
          ))}
        </div>
        <button className="ua-btn-ghost" style={{ width:"100%", justifyContent:"center", marginTop:14 }} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function DriverDetailModal({ driver, onClose }) {
  if (!driver) return null;
  return (
    <div className="modal-backdrop" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-pill"/>
        <div style={{ display:"flex", gap:14, alignItems:"center", marginBottom:20 }}>
          <div style={{
            width:54, height:54, borderRadius:"50%",
            background: driver.status==="online" ? "rgba(16,185,129,.12)" : C.subtle,
            border:`1.5px solid ${driver.status==="online" ? "rgba(16,185,129,.3)" : C.border}`,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <Car size={22} color={driver.status==="online" ? C.green : C.muted}/>
          </div>
          <div>
            <div style={{ fontFamily:"'Sora',sans-serif", fontSize:20, fontWeight:800, color:C.text }}>
              {driver.name}
            </div>
            <Mono style={{ fontSize:11, color:C.muted }}>{driver.id}</Mono>
          </div>
          <div style={{ marginLeft:"auto" }}>
            <Chip status={driver.status}/>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
          {[
            { label:"RATING",      value:`★ ${driver.rating}` },
            { label:"ACTIVE RIDES",value:driver.rides },
            { label:"JOINED",      value:driver.joined },
            { label:"PHONE",       value:driver.phone },
          ].map(s => (
            <div key={s.label} className="ua-card" style={{ padding:"12px 14px" }}>
              <Mono style={{ fontSize:9, color:C.muted, letterSpacing:"1px", display:"block", marginBottom:4 }}>{s.label}</Mono>
              <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="ua-card" style={{ padding:"12px 16px", marginBottom:20 }}>
          <Mono style={{ fontSize:9, color:C.muted, letterSpacing:"1px", display:"block", marginBottom:4 }}>VEHICLE</Mono>
          <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{driver.vehicle}</div>
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <a href={`tel:${driver.phone}`} style={{ textDecoration:"none", flex:1 }}>
            <button className="ua-btn-primary" style={{ width:"100%", justifyContent:"center" }}>
              <Phone size={14}/> Call Driver
            </button>
          </a>
          <button className="ua-btn-ghost" style={{ flex:1, justifyContent:"center" }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountDetailModal({ account, onClose, onSuspend }) {
  if (!account) return null;
  return (
    <div className="modal-backdrop" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-pill"/>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div>
            <div style={{ fontFamily:"'Sora',sans-serif", fontSize:20, fontWeight:800, color:C.text }}>
              {account.name}
            </div>
            <Mono style={{ fontSize:11, color:C.muted }}>{account.id}</Mono>
          </div>
          <Chip status={account.status === "active" ? "online" : "suspended"}/>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
          {[
            { label:"TOTAL RIDES", value:account.rides },
            { label:"JOINED",      value:account.joined },
          ].map(s => (
            <div key={s.label} className="ua-card" style={{ padding:"12px 14px" }}>
              <Mono style={{ fontSize:9, color:C.muted, letterSpacing:"1px", display:"block", marginBottom:4 }}>{s.label}</Mono>
              <div style={{ fontSize:22, fontWeight:700, color:C.text, fontFamily:"'IBM Plex Mono',monospace" }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="ua-card" style={{ padding:"12px 16px", marginBottom:20 }}>
          <Mono style={{ fontSize:9, color:C.muted, letterSpacing:"1px", display:"block", marginBottom:4 }}>EMAIL</Mono>
          <div style={{ fontSize:14, color:C.text }}>{account.email}</div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {account.status === "active" ? (
            <button className="ua-btn-danger" style={{ width:"100%", justifyContent:"center" }}
              onClick={() => { onSuspend(account); onClose(); }}>
              <Shield size={14}/> Suspend Account
            </button>
          ) : (
            <button className="ua-btn-primary" style={{ width:"100%", justifyContent:"center" }}
              onClick={() => { onSuspend(account); onClose(); }}>
              <CheckCircle2 size={14}/> Restore Account
            </button>
          )}
          <button className="ua-btn-ghost" style={{ width:"100%", justifyContent:"center" }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ToastBar({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      position:"fixed", bottom:88, left:"50%", transform:"translateX(-50%)",
      background:C.amber, color:"#000", borderRadius:10,
      padding:"11px 18px", fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:13,
      zIndex:300, whiteSpace:"nowrap", boxShadow:"0 8px 28px rgba(245,158,11,.4)",
      animation:"slide-up .2s ease",
    }}>
      {msg}
    </div>
  );
}

// ─── TABS ──────────────────────────────────────────────────────────────────────

// Overview Tab
function OverviewTab({ onToast }) {
  const s = MOCK_STATS;
  return (
    <div style={{ padding:"0 16px", animation:"slide-up .25s ease" }}>
      {/* Live indicator */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
        <span className="live-dot"/>
        <Mono style={{ fontSize:11, color:C.green }}>LIVE · Orlando, FL</Mono>
      </div>

      {/* Big stat grid */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
        {[
          { label:"ACTIVE RIDES",   value:s.ridesActive,    icon:<Zap size={14}/>,              accent:C.amber },
          { label:"MATCHING",       value:s.ridesSearching,  icon:<RefreshCw size={14}/>,         accent:C.blue  },
          { label:"DRIVERS ONLINE", value:s.driversOnline,   icon:<Car size={14}/>,               accent:C.green },
          { label:"REVENUE TODAY",  value:s.revenueToday,    icon:<CircleDollarSign size={14}/>,  accent:C.green },
        ].map(s => (
          <div key={s.label} className="ua-card" style={{ padding:"16px 16px 14px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <Mono style={{ fontSize:9, color:C.muted, letterSpacing:"1.2px" }}>{s.label}</Mono>
              <div style={{ color:s.accent, opacity:.7 }}>{s.icon}</div>
            </div>
            <div className="stat-ticker" style={{ color:s.accent }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Full-width stats */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:20 }}>
        {[
          { label:"COMPLETED TODAY", value:s.completedToday },
          { label:"TOTAL RIDES",     value:s.ridesTotal     },
          { label:"ACCOUNTS",        value:s.accountsTotal  },
        ].map(s => (
          <div key={s.label} className="ua-card" style={{ padding:"14px 12px" }}>
            <Mono style={{ fontSize:8.5, color:C.muted, letterSpacing:"1px", display:"block", marginBottom:6 }}>{s.label}</Mono>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:20, fontWeight:600, color:C.text }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <SectionLabel>Quick Actions</SectionLabel>
      <div className="ua-card" style={{ overflow:"hidden", marginBottom:20 }}>
        {[
          { icon:<Zap size={16} color={C.amber}/>,             label:"View live rides",    sub:"4 active now",          action:"Rides" },
          { icon:<Car size={16} color={C.green}/>,             label:"Driver fleet",       sub:"9 online, 23 total",    action:"Drivers" },
          { icon:<Users size={16} color={C.blue}/>,            label:"Rider accounts",     sub:"412 total accounts",    action:"Accounts" },
          { icon:<ListChecks size={16} color={C.text}/>,       label:"Completed jobs",     sub:"38 today",              action:"Jobs" },
        ].map(item => (
          <div key={item.label} className="ua-row">
            <div style={{
              width:36, height:36, borderRadius:9,
              background:C.surface, border:`1px solid ${C.border}`,
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              {item.icon}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{item.label}</div>
              <div style={{ fontSize:12, color:C.muted, marginTop:1 }}>{item.sub}</div>
            </div>
            <ChevronRight size={15} color={C.muted}/>
          </div>
        ))}
      </div>

      {/* Refunds alert */}
      <div className="ua-card" style={{
        padding:"14px 16px", display:"flex", alignItems:"center", gap:12,
        border:`1px solid rgba(239,68,68,.25)`,
        background:"rgba(239,68,68,.05)",
      }}>
        <AlertTriangle size={18} color={C.red}/>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:C.text }}>
            {s.refundsIssued} refunds issued today
          </div>
          <div style={{ fontSize:12, color:C.muted }}>Review in Jobs tab</div>
        </div>
      </div>
    </div>
  );
}

// Rides Tab
function RidesTab({ onToast }) {
  const [filter,   setFilter]   = useState("all");
  const [query,    setQuery]    = useState("");
  const [rides,    setRides]    = useState(MOCK_RIDES);
  const [detail,   setDetail]   = useState(null);
  const [assigning,setAssigning]= useState(null);

  const filters = ["all","active","searching","completed","cancelled"];

  const visible = rides.filter(r => {
    const matchF = filter==="all" || r.status===filter;
    const matchQ = !query || r.rider.toLowerCase().includes(query.toLowerCase())
      || r.id.toLowerCase().includes(query.toLowerCase());
    return matchF && matchQ;
  });

  const handleRemove = useCallback(ride => {
    setRides(prev => prev.map(r => r.id===ride.id ? {...r, status:"cancelled"} : r));
    onToast(`Ride ${ride.id} cancelled`);
  }, [onToast]);

  const handleRefund = useCallback(ride => {
    onToast(`Refund issued for ${ride.rider} — ${ride.fare}`);
  }, [onToast]);

  const handleAssign = useCallback((ride, driver) => {
    setRides(prev => prev.map(r => r.id===ride.id ? {...r, status:"active", driver:driver.name} : r));
    onToast(`${driver.name} assigned to ${ride.id}`);
    setDetail(null);
  }, [onToast]);

  return (
    <div style={{ padding:"0 16px", animation:"slide-up .25s ease" }}>
      <div className="search-bar" style={{ marginBottom:14 }}>
        <Search size={15} color={C.muted}/>
        <input placeholder="Search rider or ride ID…" value={query} onChange={e=>setQuery(e.target.value)}/>
        {query && <X size={14} color={C.muted} style={{ cursor:"pointer" }} onClick={()=>setQuery("")}/>}
      </div>

      {/* Filter pills */}
      <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:2, marginBottom:16,
        scrollbarWidth:"none" }}>
        {filters.map(f => (
          <button key={f} onClick={()=>setFilter(f)} style={{
            background: filter===f ? C.amber : C.surface,
            color: filter===f ? "#000" : C.muted,
            border:`1px solid ${filter===f ? C.amber : C.border}`,
            borderRadius:8, padding:"6px 14px",
            fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:600,
            cursor:"pointer", whiteSpace:"nowrap", transition:"all .15s",
          }}>
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      <SectionLabel>{visible.length} rides</SectionLabel>
      <div className="ua-card" style={{ overflow:"hidden", marginBottom:20 }}>
        {visible.length === 0 && (
          <div style={{ padding:"24px", textAlign:"center", color:C.muted, fontSize:13 }}>No rides found</div>
        )}
        {visible.map(ride => (
          <div key={ride.id} className="ua-row" onClick={()=>setDetail(ride)}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                <Mono style={{ fontSize:11, color:C.amber }}>{ride.id}</Mono>
                <Chip status={ride.status}/>
              </div>
              <div style={{ fontSize:14, fontWeight:600, color:C.text, marginBottom:2 }}>{ride.rider}</div>
              <div style={{
                fontSize:12, color:C.muted, whiteSpace:"nowrap", overflow:"hidden",
                textOverflow:"ellipsis",
              }}>
                {ride.pickup} → {ride.dropoff}
              </div>
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:14, fontWeight:600, color:C.text }}>
                {ride.fare}
              </div>
              <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{ride.started}</div>
            </div>
          </div>
        ))}
      </div>

      {detail && (
        <RideDetailModal
          ride={detail}
          onClose={()=>setDetail(null)}
          onAssign={r=>{ setAssigning(r); setDetail(null); }}
          onRemove={handleRemove}
          onRefund={handleRefund}
        />
      )}
      {assigning && (
        <AssignDriverModal
          ride={assigning}
          drivers={MOCK_DRIVERS}
          onAssign={handleAssign}
          onClose={()=>setAssigning(null)}
        />
      )}
    </div>
  );
}

// Drivers Tab
function DriversTab({ onToast }) {
  const [query,  setQuery]  = useState("");
  const [detail, setDetail] = useState(null);

  const visible = MOCK_DRIVERS.filter(d =>
    !query || d.name.toLowerCase().includes(query.toLowerCase())
  );

  const online  = visible.filter(d=>d.status==="online");
  const offline = visible.filter(d=>d.status==="offline");

  const Section = ({ label, drivers }) => (
    <>
      <SectionLabel>{label} ({drivers.length})</SectionLabel>
      <div className="ua-card" style={{ overflow:"hidden", marginBottom:16 }}>
        {drivers.length===0 && (
          <div style={{ padding:"20px", textAlign:"center", color:C.muted, fontSize:13 }}>None</div>
        )}
        {drivers.map(d => (
          <div key={d.id} className="ua-row" onClick={()=>setDetail(d)}>
            <div style={{
              width:38, height:38, borderRadius:"50%",
              background: d.status==="online" ? "rgba(16,185,129,.12)" : C.subtle,
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <Car size={16} color={d.status==="online" ? C.green : C.muted}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{d.name}</div>
              <Mono style={{ fontSize:11, color:C.muted }}>{d.vehicle}</Mono>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:12, color:C.amber }}>★ {d.rating}</div>
              <div style={{ fontSize:11, color:C.muted }}>{d.rides} active</div>
            </div>
            <ChevronRight size={15} color={C.muted} style={{ marginLeft:4 }}/>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div style={{ padding:"0 16px", animation:"slide-up .25s ease" }}>
      <div className="search-bar" style={{ marginBottom:16 }}>
        <Search size={15} color={C.muted}/>
        <input placeholder="Search driver…" value={query} onChange={e=>setQuery(e.target.value)}/>
        {query && <X size={14} color={C.muted} style={{ cursor:"pointer" }} onClick={()=>setQuery("")}/>}
      </div>
      <Section label="Online" drivers={online}/>
      <Section label="Offline" drivers={offline}/>
      {detail && <DriverDetailModal driver={detail} onClose={()=>setDetail(null)}/>}
    </div>
  );
}

// Accounts Tab
function AccountsTab({ onToast }) {
  const [query,    setQuery]    = useState("");
  const [accounts, setAccounts] = useState(MOCK_ACCOUNTS);
  const [detail,   setDetail]   = useState(null);

  const visible = accounts.filter(a =>
    !query || a.name.toLowerCase().includes(query.toLowerCase())
      || a.email.toLowerCase().includes(query.toLowerCase())
  );

  const handleSuspend = useCallback(account => {
    setAccounts(prev => prev.map(a =>
      a.id===account.id
        ? { ...a, status: a.status==="active" ? "suspended" : "active" }
        : a
    ));
    onToast(account.status==="active"
      ? `${account.name} suspended`
      : `${account.name} restored`);
  }, [onToast]);

  return (
    <div style={{ padding:"0 16px", animation:"slide-up .25s ease" }}>
      <div className="search-bar" style={{ marginBottom:16 }}>
        <Search size={15} color={C.muted}/>
        <input placeholder="Search name or email…" value={query} onChange={e=>setQuery(e.target.value)}/>
        {query && <X size={14} color={C.muted} style={{ cursor:"pointer" }} onClick={()=>setQuery("")}/>}
      </div>
      <SectionLabel>{visible.length} accounts</SectionLabel>
      <div className="ua-card" style={{ overflow:"hidden", marginBottom:20 }}>
        {visible.map(a => (
          <div key={a.id} className="ua-row" onClick={()=>setDetail(a)}>
            <div style={{
              width:38, height:38, borderRadius:"50%",
              background: a.status==="active" ? "rgba(59,130,246,.1)" : C.subtle,
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <Users size={16} color={a.status==="active" ? C.blue : C.muted}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:600, color:a.status==="suspended" ? C.muted : C.text }}>
                {a.name}
              </div>
              <div style={{ fontSize:12, color:C.muted }}>{a.email}</div>
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <Chip status={a.status==="active" ? "online" : "suspended"}/>
              <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{a.rides} rides</div>
            </div>
          </div>
        ))}
      </div>
      {detail && (
        <AccountDetailModal
          account={accounts.find(a=>a.id===detail.id)}
          onClose={()=>setDetail(null)}
          onSuspend={handleSuspend}
        />
      )}
    </div>
  );
}

// Jobs Tab
function JobsTab({ onToast }) {
  const completed = MOCK_RIDES.filter(r => r.status==="completed" || r.status==="cancelled");

  return (
    <div style={{ padding:"0 16px", animation:"slide-up .25s ease" }}>
      {/* Summary */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
        {[
          { label:"COMPLETED TODAY", value:MOCK_STATS.completedToday, color:C.green },
          { label:"REFUNDS ISSUED",  value:MOCK_STATS.refundsIssued,  color:C.red   },
        ].map(s => (
          <div key={s.label} className="ua-card" style={{ padding:"16px" }}>
            <Mono style={{ fontSize:9, color:C.muted, letterSpacing:"1.2px", display:"block", marginBottom:8 }}>{s.label}</Mono>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:28, fontWeight:600, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <SectionLabel>Recent Jobs</SectionLabel>
      <div className="ua-card" style={{ overflow:"hidden", marginBottom:20 }}>
        {completed.map(ride => (
          <div key={ride.id} className="ua-row">
            <div style={{
              width:36, height:36, borderRadius:9, flexShrink:0,
              background: ride.status==="completed" ? "rgba(59,130,246,.1)" : C.subtle,
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              {ride.status==="completed"
                ? <CheckCircle2 size={16} color={C.blue}/>
                : <XCircle size={16} color={C.muted}/>
              }
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                <Mono style={{ fontSize:11, color:C.amber }}>{ride.id}</Mono>
                <Chip status={ride.status}/>
              </div>
              <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{ride.rider}</div>
              <div style={{ fontSize:12, color:C.muted }}>Driver: {ride.driver ?? "—"}</div>
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:14, fontWeight:600, color:C.text }}>
                {ride.fare}
              </div>
              <div style={{ fontSize:11, color:C.muted }}>{ride.duration}</div>
              <button
                className="ua-btn-ghost"
                style={{ marginTop:6, padding:"5px 10px", fontSize:11 }}
                onClick={() => onToast(`Refund issued — ${ride.fare}`)}
              >
                <RotateCcw size={11}/> Refund
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id:"overview", label:"Overview", icon:Zap      },
  { id:"rides",    label:"Rides",    icon:Car       },
  { id:"drivers",  label:"Drivers",  icon:MapPin    },
  { id:"accounts", label:"Accounts", icon:Users     },
  { id:"jobs",     label:"Jobs",     icon:ListChecks},
];

export default function UADashboard() {
  const [tab,   setTab]   = useState("overview");
  const [toast, setToast] = useState(null);
  const toastRef = useRef(null);

  const showToast = useCallback(msg => {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => () => { if (toastRef.current) clearTimeout(toastRef.current); }, []);

  const today = new Date().toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" });

  return (
    <div style={{
      minHeight:"100vh", background:C.bg, color:C.text,
      fontFamily:"'Sora',sans-serif", maxWidth:480, margin:"0 auto",
      position:"relative",
    }}>
      <style>{GLOBAL_CSS}</style>

      {/* Header */}
      <div style={{
        padding:"18px 20px 14px",
        borderBottom:`1px solid ${C.border}`,
        position:"sticky", top:0, background:C.bg, zIndex:100,
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <Mono style={{ fontSize:10, color:C.amber, letterSpacing:"2px" }}>UA · FIELD OPS</Mono>
            </div>
            <div style={{
              fontFamily:"'Sora',sans-serif", fontSize:22, fontWeight:800,
              color:C.text, marginTop:2, letterSpacing:"-0.5px",
            }}>
              UaTob Console
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <Mono style={{ fontSize:10, color:C.muted, display:"block" }}>{today}</Mono>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:4, justifyContent:"flex-end" }}>
              <span className="live-dot"/>
              <Mono style={{ fontSize:10, color:C.green }}>LIVE</Mono>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ paddingTop:16, paddingBottom:80 }}>
        {tab==="overview" && <OverviewTab onToast={showToast}/>}
        {tab==="rides"    && <RidesTab    onToast={showToast}/>}
        {tab==="drivers"  && <DriversTab  onToast={showToast}/>}
        {tab==="accounts" && <AccountsTab onToast={showToast}/>}
        {tab==="jobs"     && <JobsTab     onToast={showToast}/>}
      </div>

      {/* Toast */}
      <ToastBar msg={toast}/>

      {/* Bottom tab bar */}
      <div style={{
        position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
        width:"100%", maxWidth:480,
        background:C.surface, borderTop:`1px solid ${C.border}`,
        display:"flex", zIndex:100,
        paddingBottom:"env(safe-area-inset-bottom, 8px)",
      }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab===t.id;
          return (
            <button
              key={t.id}
              className={`ua-tab ${active ? "active" : ""}`}
              onClick={()=>setTab(t.id)}
            >
              <Icon size={20}/>
              <span style={{ fontSize:10, fontFamily:"'IBM Plex Mono',monospace", fontWeight:500, letterSpacing:".3px" }}>
                {t.label.toUpperCase()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
