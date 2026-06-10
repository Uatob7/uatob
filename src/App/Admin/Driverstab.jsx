import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Search, Bell, CheckCircle, XCircle, Ban, ChevronRight,
  FileText, Car, Loader2, ArrowLeft, MapPin, Phone, Mail,
  Star, TrendingUp, DollarSign, Clock, Shield, Eye,
  AlertCircle, CheckCircle2, X, CreditCard, Hash,
  Map as MapIcon, Navigation, Maximize2, Minimize2,
  Route, Banknote, Zap, User, Timer, Gift, Sparkles,
} from "lucide-react";
import { C, STATUS_CONFIG } from '@/App/Admin/Tokens';
import { Avatar, StatusPill } from '@/App/Admin/UI';
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirestore, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const functions         = getFunctions(firebase_app, "us-east1");
const callApproveDriver = httpsCallable(functions, "approveDriver");
const callRejectDriver  = httpsCallable(functions, "rejectDriver");
const callAwardReward   = httpsCallable(functions, "awardReward");
const callDeleteDriver  = httpsCallable(functions, "deleteDriver");
const db                = getFirestore(firebase_app);

// ─── MAPBOX LOADER ─────────────────────────────────────────────────────────
const MAPBOX_TOKEN = "pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA";
let _mbLoaded = false;
let _mbCallbacks = [];

function loadMapbox(cb) {
  if (_mbLoaded && window.mapboxgl) { cb(); return; }
  _mbCallbacks.push(cb);
  if (document.getElementById("mapbox-css-drivers")) {
    if (_mbLoaded) cb();
    return;
  }
  const link = document.createElement("link");
  link.id   = "mapbox-css-drivers";
  link.rel  = "stylesheet";
  link.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css";
  document.head.appendChild(link);
  const script = document.createElement("script");
  script.src    = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js";
  script.onload = () => {
    _mbLoaded = true;
    _mbCallbacks.forEach(f => f());
    _mbCallbacks = [];
  };
  document.head.appendChild(script);
}

// ─── GOOGLE ENCODED POLYLINE DECODER ───────────────────────────────────────
function decodePolyline(encoded) {
  if (!encoded) return [];
  const points = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, b;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push([lng / 1e5, lat / 1e5]);
  }
  return points;
}

// ─── RIDE STATUS CONFIG ─────────────────────────────────────────────────────
const RIDE_STATUS_COLOR = {
  searching_driver: "#F59E0B",
  driver_assigned:  "#3B82F6",
  driver_arriving:  "#8B5CF6",
  arrived:          "#06B6D4",
  in_progress:      "#10B981",
  completed:        "#6B7280",
  cancelled:        "#EF4444",
  timeout:          "#F59E0B",
};

const RIDE_STATUSES_HIDDEN_FROM_MAP = new Set(["completed", "cancelled", "timeout"]);
const DRIVER_LIVE_STATUSES = new Set(["driver_assigned", "driver_arriving", "arrived", "in_progress"]);

const RIDE_STEPS = [
  { key: "driver_assigned", label: "Assigned" },
  { key: "driver_arriving", label: "En Route" },
  { key: "arrived",         label: "Arrived"  },
  { key: "in_progress",     label: "Riding"   },
  { key: "completed",       label: "Done"     },
];

function rideStatusColor(status) {
  return RIDE_STATUS_COLOR[status] || "#9CA3AF";
}

function rideStatusLabel(status) {
  const map = {
    searching_driver: "Searching",
    driver_assigned:  "Assigned",
    driver_arriving:  "En Route",
    arrived:          "Arrived",
    in_progress:      "In Progress",
    completed:        "Completed",
    cancelled:        "Cancelled",
    timeout:          "Timed Out",
  };
  return map[status] || status;
}

const PIN_COLORS = {
  online:      "#16A34A",
  approved:    "#0EA5E9",
  offline:     "#9CA3AF",
  pending:     "#F59E0B",
  in_progress: "#3B82F6",
  rejected:    "#DC2626",
  suspended:   "#DC2626",
};

// ─── Helpers ────────────────────────────────────────────────────────────────
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

function locationStr(d) {
  const c = d.contact ?? {};
  const parts = [c.city, c.state, c.zip].filter(Boolean);
  return parts.join(", ");
}

function truncateAddress(addr, max = 28) {
  if (!addr) return "—";
  return addr.length > max ? addr.slice(0, max) + "…" : addr;
}

function rideFare(ride) {
  return ride.fareBreakdown?.fareTotal ?? ride.fareTotal ?? ride.fare ?? 0;
}

function rideCityPair(ride) {
  const p = ride.pickupCity ?? "";
  const d = ride.dropoffCity ?? "";
  if (p && d && p === d) return p;
  if (p && d) return `${p} → ${d}`;
  return p || d || "—";
}

// ─── PRESET REWARD AMOUNTS ──────────────────────────────────────────────────
const REWARD_PRESETS = [
  { label: "$5",  amount: 5  },
  { label: "$10", amount: 10 },
  { label: "$15", amount: 15 },
  { label: "$25", amount: 25 },
];

const REWARD_TYPE_OPTIONS = [
  { value: "online_incentive", label: "Online Incentive" },
  { value: "market_boost",     label: "Market Boost"     },
  { value: "referral_bonus",   label: "Referral Bonus"   },
  { value: "streak_bonus",     label: "Streak Bonus"     },
  { value: "promo",            label: "Promo"            },
];

// ═══════════════════════════════════════════════════════════════════════════
// AWARD REWARD SHEET
// ═══════════════════════════════════════════════════════════════════════════
function AwardRewardSheet({ driver, onClose, onSuccess }) {
  const [step,        setStep]        = useState("form"); // form | processing | done | error
  const [amount,      setAmount]      = useState(5);
  const [customAmt,   setCustomAmt]   = useState("");
  const [useCustom,   setUseCustom]   = useState(false);
  const [description, setDescription] = useState("");
  const [type,        setType]        = useState("online_incentive");
  const [zone,        setZone]        = useState("");
  const [errorMsg,    setErrorMsg]    = useState(null);

  const finalAmount = useCustom
    ? parseFloat(customAmt) || 0
    : amount;

  const canSubmit = finalAmount >= 0.5 && description.trim().length > 0;

  const handleAward = async () => {
    if (!canSubmit) return;
    setStep("processing");
    setErrorMsg(null);
    try {
      const { data } = await callAwardReward({
        driverUid:   driver.id,
        amount:      finalAmount,
        description: description.trim(),
        type,
        zone:        zone.trim() || null,
        awardedBy:   "admin",
      });
      if (data?.success) {
        setStep("done");
        setTimeout(() => {
          onSuccess?.(`🎁 ${fmtMoney(finalAmount)} reward sent to ${fullName(driver)}`);
          onClose();
        }, 2000);
      } else {
        setErrorMsg(data?.error || "Failed to award reward. Please try again.");
        setStep("error");
      }
    } catch (err) {
      setErrorMsg(err?.message || "Failed to award reward. Please try again.");
      setStep("error");
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1200,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        animation: "rModalIn .2s ease-out forwards",
      }}
    >
      <style>{`
        @keyframes rModalIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes rSheetUp  { from { transform:translateY(100%) } to { transform:translateY(0) } }
        @keyframes rCheckPop { 0%{transform:scale(0) rotate(-20deg)} 70%{transform:scale(1.2) rotate(4deg)} 100%{transform:scale(1) rotate(0)} }
        @keyframes rSpin     { to { transform: rotate(360deg); } }
        @keyframes rGlow     { 0%,100%{opacity:.6} 50%{opacity:1} }
        .reward-input {
          width: 100%; padding: 11px 13px;
          background: rgba(255,255,255,.04);
          border: 1.5px solid rgba(255,255,255,.1);
          border-radius: 11px; color: #fff;
          font-family: 'Barlow', sans-serif;
          font-size: 13px; font-weight: 600;
          outline: none; box-sizing: border-box;
          transition: border-color .15s;
        }
        .reward-input:focus { border-color: rgba(251,191,36,.5); }
        .reward-input::placeholder { color: rgba(255,255,255,.3); }
        .reward-select {
          width: 100%; padding: 11px 13px;
          background: rgba(255,255,255,.04);
          border: 1.5px solid rgba(255,255,255,.1);
          border-radius: 11px; color: #fff;
          font-family: 'Barlow', sans-serif;
          font-size: 13px; font-weight: 600;
          outline: none; box-sizing: border-box;
          cursor: pointer; appearance: none;
          transition: border-color .15s;
        }
        .reward-select:focus { border-color: rgba(251,191,36,.5); }
        .reward-select option { background: #1E293B; }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480,
          background: "linear-gradient(180deg,#0F172A,#111827)",
          borderRadius: "28px 28px 0 0",
          padding: "8px 0 40px",
          animation: "rSheetUp .3s cubic-bezier(.32,1,.5,1) forwards",
          overflow: "hidden",
          border: "1.5px solid rgba(251,191,36,.2)",
          borderBottom: "none",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 6px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 100, background: "rgba(255,255,255,.15)" }}/>
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 22px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{
              width: 40, height: 40,
              background: "linear-gradient(135deg,#F59E0B,#D97706)",
              borderRadius: 12,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 6px 18px rgba(217,119,6,.40)",
            }}>
              <Gift size={18} color="#fff" strokeWidth={2.2}/>
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", letterSpacing: "-0.3px" }}>
                Award Reward
              </div>
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.45)", fontWeight: 500, marginTop: 1 }}>
                {fullName(driver)}
              </div>
            </div>
          </div>
          {step !== "processing" && (
            <button
              onClick={onClose}
              style={{
                width: 34, height: 34, borderRadius: "50%",
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={15} color="rgba(255,255,255,.5)"/>
            </button>
          )}
        </div>

        {/* ── FORM ── */}
        {(step === "form" || step === "error") && (
          <div style={{ padding: "0 22px" }}>

            {/* Amount presets */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(251,191,36,.7)", marginBottom: 8 }}>
                Amount
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {REWARD_PRESETS.map(p => (
                  <button
                    key={p.amount}
                    onClick={() => { setAmount(p.amount); setUseCustom(false); }}
                    style={{
                      flex: 1, padding: "10px 0",
                      background: !useCustom && amount === p.amount
                        ? "linear-gradient(135deg,#F59E0B,#D97706)"
                        : "rgba(255,255,255,.05)",
                      border: `1.5px solid ${!useCustom && amount === p.amount ? "#F59E0B" : "rgba(255,255,255,.1)"}`,
                      borderRadius: 10, color: "#fff",
                      fontFamily: "'Barlow Condensed',sans-serif",
                      fontWeight: 900, fontSize: 15,
                      cursor: "pointer",
                      boxShadow: !useCustom && amount === p.amount ? "0 4px 14px rgba(217,119,6,.35)" : "none",
                      transition: "all .15s",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  onClick={() => setUseCustom(true)}
                  style={{
                    flex: 1, padding: "10px 0",
                    background: useCustom ? "rgba(251,191,36,.12)" : "rgba(255,255,255,.05)",
                    border: `1.5px solid ${useCustom ? "#F59E0B" : "rgba(255,255,255,.1)"}`,
                    borderRadius: 10, color: useCustom ? "#FCD34D" : "rgba(255,255,255,.5)",
                    fontFamily: "'Barlow Condensed',sans-serif",
                    fontWeight: 800, fontSize: 12,
                    cursor: "pointer",
                    transition: "all .15s",
                  }}
                >
                  Custom
                </button>
              </div>

              {useCustom && (
                <div style={{ position: "relative", marginBottom: 4 }}>
                  <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 15, fontWeight: 800, color: "#FCD34D" }}>$</span>
                  <input
                    className="reward-input"
                    type="number"
                    min="0.5"
                    step="0.5"
                    placeholder="0.00"
                    value={customAmt}
                    onChange={e => setCustomAmt(e.target.value)}
                    style={{ paddingLeft: 28 }}
                    autoFocus
                  />
                </div>
              )}

              {/* Live amount preview */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 6, padding: "10px",
                background: "rgba(251,191,36,.06)",
                border: "1px solid rgba(251,191,36,.15)",
                borderRadius: 10,
              }}>
                <Sparkles size={12} color="#F59E0B"/>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#FCD34D" }}>
                  {finalAmount >= 0.5 ? `${fmtMoney(finalAmount)} will be transferred instantly` : "Enter a valid amount"}
                </span>
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(251,191,36,.7)", marginBottom: 8 }}>
                Description *
              </div>
              <input
                className="reward-input"
                type="text"
                placeholder="e.g. Online downtown Orlando"
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={120}
              />
              <div style={{ fontSize: 10, color: "rgba(255,255,255,.25)", marginTop: 4, textAlign: "right" }}>
                {description.length}/120
              </div>
            </div>

            {/* Type */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(251,191,36,.7)", marginBottom: 8 }}>
                Type
              </div>
              <select
                className="reward-select"
                value={type}
                onChange={e => setType(e.target.value)}
              >
                {REWARD_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Zone (optional) */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(251,191,36,.7)", marginBottom: 8 }}>
                Zone <span style={{ color: "rgba(255,255,255,.25)", fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
              </div>
              <input
                className="reward-input"
                type="text"
                placeholder="e.g. downtown_orlando"
                value={zone}
                onChange={e => setZone(e.target.value)}
                maxLength={60}
              />
            </div>

            {/* Error */}
            {step === "error" && errorMsg && (
              <div style={{
                background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)",
                borderRadius: 10, padding: "10px 13px", marginBottom: 14,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <AlertCircle size={14} color="#EF4444"/>
                <span style={{ fontSize: 12, color: "#FCA5A5", fontWeight: 600 }}>{errorMsg}</span>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleAward}
              disabled={!canSubmit}
              style={{
                width: "100%", padding: "15px 20px",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                background: canSubmit
                  ? "linear-gradient(135deg,#F59E0B,#D97706 55%,#B45309)"
                  : "rgba(255,255,255,.08)",
                border: "none", borderRadius: 14,
                color: canSubmit ? "#fff" : "rgba(255,255,255,.3)",
                fontFamily: "'Barlow',sans-serif", fontWeight: 800, fontSize: 15,
                letterSpacing: ".3px",
                cursor: canSubmit ? "pointer" : "not-allowed",
                boxShadow: canSubmit ? "0 10px 28px rgba(217,119,6,.35)" : "none",
                transition: "all .2s",
              }}
            >
              <Gift size={17} strokeWidth={2.4}/>
              {canSubmit ? `Send ${fmtMoney(finalAmount)} Reward` : "Fill in required fields"}
            </button>

            <button
              onClick={onClose}
              style={{
                width: "100%", padding: "13px 20px", marginTop: 10,
                background: "transparent",
                border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 14, color: "rgba(255,255,255,.4)",
                fontFamily: "'Barlow',sans-serif", fontWeight: 700, fontSize: 13,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── PROCESSING ── */}
        {step === "processing" && (
          <div style={{
            padding: "40px 22px 20px",
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: 16,
          }}>
            <div style={{
              width: 72, height: 72,
              background: "linear-gradient(135deg,#F59E0B,#D97706)",
              borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 12px 32px rgba(217,119,6,.40)",
            }}>
              <Loader2 size={30} color="#fff" style={{ animation: "rSpin 0.8s linear infinite" }}/>
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>Sending reward…</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.45)", fontWeight: 500 }}>
              Transferring {fmtMoney(finalAmount)} to {fullName(driver)}
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {step === "done" && (
          <div style={{
            padding: "40px 22px 20px",
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: 16,
          }}>
            <div style={{
              width: 72, height: 72,
              background: "linear-gradient(135deg,#F59E0B,#D97706)",
              borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 12px 32px rgba(217,119,6,.45)",
              animation: "rCheckPop .45s cubic-bezier(.34,1.2,.64,1) forwards",
            }}>
              <CheckCircle2 size={32} color="#fff" strokeWidth={2.5}/>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#FCD34D" }}>
              {fmtMoney(finalAmount)} sent!
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.45)", fontWeight: 500 }}>
              Reward transferred to {fullName(driver)}'s bank
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RIDE STATUS STEPPER
// ═══════════════════════════════════════════════════════════════════════════
function RideStatusStepper({ status }) {
  const isSearching  = status === "searching_driver";
  const isCancelled  = status === "cancelled";
  const isTimedOut   = status === "timeout";
  const isCompleted  = status === "completed";

  const currentIdx = RIDE_STEPS.findIndex(s => s.key === status);
  const accentColor = rideStatusColor(status);

  if (isSearching) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "#F59E0B10", border: "1px solid #F59E0B30", marginTop: 8 }}>
        <div style={{ position: "relative", width: 10, height: 10, flexShrink: 0 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#F59E0B", animation: "stepperPulse 1.6s ease-out infinite" }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#F59E0B", letterSpacing: ".04em" }}>SEARCHING FOR DRIVER…</span>
      </div>
    );
  }

  if (isCancelled || isTimedOut) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "#EF444410", border: "1px solid #EF444430", marginTop: 8 }}>
        <XCircle size={12} color="#EF4444" />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", letterSpacing: ".04em" }}>
          {isTimedOut ? "TIMED OUT" : "CANCELLED"}
        </span>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      <style>{`
        @keyframes stepperPulse {
          0%   { box-shadow: 0 0 0 0 rgba(245,158,11,.7); }
          70%  { box-shadow: 0 0 0 8px rgba(245,158,11,0); }
          100% { box-shadow: 0 0 0 0 rgba(245,158,11,0);  }
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {RIDE_STEPS.map((step, i) => {
          const isDone    = i < currentIdx || isCompleted;
          const isActive  = i === currentIdx && !isCompleted;
          const nodeColor = isDone || isCompleted ? accentColor : isActive ? accentColor : "rgba(255,255,255,.12)";
          const lineColor = i < currentIdx || isCompleted ? accentColor : "rgba(255,255,255,.1)";

          return (
            <div key={step.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
              {i > 0 && (
                <div style={{ position: "absolute", top: 7, right: "50%", left: "-50%", height: 2, background: lineColor, transition: "background .3s", zIndex: 0 }} />
              )}
              <div style={{
                width: isActive ? 16 : 14, height: isActive ? 16 : 14, borderRadius: "50%",
                background: isDone || isCompleted ? nodeColor : isActive ? nodeColor : C.surfaceHigh,
                border: `2px solid ${isDone || isCompleted || isActive ? nodeColor : "rgba(255,255,255,.15)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative", zIndex: 1, transition: "all .25s",
                boxShadow: isActive ? `0 0 10px ${nodeColor}80` : "none", flexShrink: 0,
              }}>
                {(isDone || isCompleted) && (
                  <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                    <path d="M1.5 3.5L3 5L5.5 2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {isActive && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />}
              </div>
              <div style={{
                fontSize: 9, fontWeight: isActive ? 800 : 600,
                color: isActive ? accentColor : isDone || isCompleted ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.3)",
                marginTop: 5, textAlign: "center", letterSpacing: ".03em",
                transition: "color .25s", whiteSpace: "nowrap",
              }}>
                {step.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DRIVER + RIDE MAP VIEW
// ═══════════════════════════════════════════════════════════════════════════
function DriverMapView({
  drivers = [], rides = [], driverByUid = {},
  onDriverClick, onRideClick,
  height = 280, expandable = true,
}) {
  const containerRef    = useRef(null);
  const mapRef          = useRef(null);
  const markersRef      = useRef([]);
  const initializedRef  = useRef(false);
  const routeLayerIds   = useRef([]);

  const [expanded,      setExpanded]      = useState(false);
  const [hoveredDriver, setHoveredDriver] = useState(null);
  const [hoveredRide,   setHoveredRide]   = useState(null);
  const [tooltipPos,    setTooltipPos]    = useState({ x: 0, y: 0 });
  const [showRides,     setShowRides]     = useState(true);
  const [showDrivers,   setShowDrivers]   = useState(true);

  const mapHeight = expanded ? 520 : height;

  const driversWithLiveRide = useMemo(() => {
    const uids = new Set();
    rides.forEach(r => {
      if (
        DRIVER_LIVE_STATUSES.has(r.status) &&
        r.driverUid &&
        typeof r.driverLat === "number" &&
        typeof r.driverLng === "number"
      ) {
        uids.add(r.driverUid);
      }
    });
    return uids;
  }, [rides]);

  const pinnedDrivers = useMemo(
    () => drivers.filter(d =>
      typeof d.lat === "number" && typeof d.lng === "number" &&
      !isNaN(d.lat) && !isNaN(d.lng) &&
      !driversWithLiveRide.has(d.uid) &&
      !driversWithLiveRide.has(d.id)
    ),
    [drivers, driversWithLiveRide]
  );

  const pinnedRides = useMemo(
    () => rides.filter(r =>
      !RIDE_STATUSES_HIDDEN_FROM_MAP.has(r.status) &&
      typeof r.pickupLat === "number" && typeof r.pickupLng === "number" &&
      typeof r.dropoffLat === "number" && typeof r.dropoffLng === "number" &&
      !isNaN(r.pickupLat) && !isNaN(r.pickupLng)
    ),
    [rides]
  );

  const driverCounts = useMemo(() => {
    const out = { online: 0, approved: 0, offline: 0, pending: 0, in_progress: 0, suspended: 0 };
    pinnedDrivers.forEach(d => { if (out[d.status] != null) out[d.status]++; });
    return out;
  }, [pinnedDrivers]);

  const bounds = useMemo(() => {
    const allLats = [
      ...pinnedDrivers.map(d => d.lat),
      ...pinnedRides.flatMap(r => [r.pickupLat, r.dropoffLat, r.driverLat].filter(v => typeof v === "number")),
    ];
    const allLngs = [
      ...pinnedDrivers.map(d => d.lng),
      ...pinnedRides.flatMap(r => [r.pickupLng, r.dropoffLng, r.driverLng].filter(v => typeof v === "number")),
    ];
    if (allLats.length === 0) return null;
    return {
      minLat: Math.min(...allLats), maxLat: Math.max(...allLats),
      minLng: Math.min(...allLngs), maxLng: Math.max(...allLngs),
    };
  }, [pinnedDrivers, pinnedRides]);

  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;

    loadMapbox(() => {
      if (!containerRef.current || initializedRef.current) return;
      initializedRef.current = true;
      window.mapboxgl.accessToken = MAPBOX_TOKEN;

      const center = bounds
        ? [(bounds.minLng + bounds.maxLng) / 2, (bounds.minLat + bounds.maxLat) / 2]
        : [-81.3792, 28.5383];

      mapRef.current = new window.mapboxgl.Map({
        container: containerRef.current,
        style:     "mapbox://styles/mapbox/dark-v11",
        center, zoom: 11,
        attributionControl: false, fadeDuration: 0,
      });

      mapRef.current.addControl(
        new window.mapboxgl.NavigationControl({ showCompass: false, visualizePitch: false }),
        "top-right"
      );
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        initializedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const t = setTimeout(() => mapRef.current?.resize(), 320);
    return () => clearTimeout(t);
  }, [expanded]);

  function clearRideLayers(map) {
    routeLayerIds.current.forEach(id => {
      if (map.getLayer(id))  map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });
    routeLayerIds.current = [];
  }

  useEffect(() => {
    if (!mapRef.current) return;

    const render = () => {
      if (!mapRef.current?.isStyleLoaded()) {
        setTimeout(render, 100);
        return;
      }

      const map = mapRef.current;

      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      clearRideLayers(map);

      if (showRides) {
        pinnedRides.forEach((ride, idx) => {
          const color     = rideStatusColor(ride.status);
          const isCash    = ride.paymentMethod === "cash";
          const sourceId  = `ride-route-${ride.id ?? idx}`;
          const layerBgId = `ride-route-bg-${ride.id ?? idx}`;
          const layerFgId = `ride-route-fg-${ride.id ?? idx}`;

          let coords = decodePolyline(ride.polyline);
          if (coords.length < 2) {
            coords = [
              [ride.pickupLng,  ride.pickupLat],
              [ride.dropoffLng, ride.dropoffLat],
            ];
          }

          const geojson = { type: "Feature", geometry: { type: "LineString", coordinates: coords } };
          if (map.getSource(sourceId)) {
            map.getSource(sourceId).setData(geojson);
          } else {
            map.addSource(sourceId, { type: "geojson", data: geojson });
          }
          if (!map.getLayer(layerBgId)) {
            map.addLayer({ id: layerBgId, type: "line", source: sourceId, layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": color, "line-width": 7, "line-opacity": 0.18, "line-blur": 3 } });
          }
          if (!map.getLayer(layerFgId)) {
            map.addLayer({ id: layerFgId, type: "line", source: sourceId, layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": color, "line-width": 2.5, "line-opacity": 0.85, "line-dasharray": ride.status === "searching_driver" ? [2, 2] : [1] } });
          }
          routeLayerIds.current.push(sourceId, layerBgId, layerFgId);

          const pickupEl = document.createElement("div");
          pickupEl.style.cssText = `width:26px;height:26px;border-radius:50%;background:${color};border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.4);font-size:9.5px;font-weight:900;color:#fff;font-family:'Barlow',sans-serif;transition:transform .15s;position:relative;`;
          pickupEl.innerHTML = `<span>P</span>${isCash ? `<div style="position:absolute;top:-6px;right:-6px;width:14px;height:14px;border-radius:50%;background:#F59E0B;border:1.5px solid #fff;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:900;color:#fff;">$</div>` : ""}`;
          pickupEl.addEventListener("mouseenter", (e) => { setHoveredRide({ ...ride, _hoverType: "pickup" }); setHoveredDriver(null); const rect = containerRef.current?.getBoundingClientRect(); if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top }); pickupEl.style.transform = "scale(1.25)"; });
          pickupEl.addEventListener("mousemove", (e) => { const rect = containerRef.current?.getBoundingClientRect(); if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top }); });
          pickupEl.addEventListener("mouseleave", () => { setHoveredRide(null); pickupEl.style.transform = ""; });
          pickupEl.addEventListener("click", (e) => { e.stopPropagation(); onRideClick?.(ride); });
          markersRef.current.push(new window.mapboxgl.Marker({ element: pickupEl, anchor: "center" }).setLngLat([ride.pickupLng, ride.pickupLat]).addTo(map));

          const dropoffEl = document.createElement("div");
          dropoffEl.style.cssText = `width:26px;height:26px;border-radius:6px;background:${color};border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.4);font-size:9.5px;font-weight:900;color:#fff;font-family:'Barlow',sans-serif;transition:transform .15s;`;
          dropoffEl.textContent = "D";
          dropoffEl.addEventListener("mouseenter", (e) => { setHoveredRide({ ...ride, _hoverType: "dropoff" }); setHoveredDriver(null); const rect = containerRef.current?.getBoundingClientRect(); if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top }); dropoffEl.style.transform = "scale(1.25)"; });
          dropoffEl.addEventListener("mousemove", (e) => { const rect = containerRef.current?.getBoundingClientRect(); if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top }); });
          dropoffEl.addEventListener("mouseleave", () => { setHoveredRide(null); dropoffEl.style.transform = ""; });
          dropoffEl.addEventListener("click", (e) => { e.stopPropagation(); onRideClick?.(ride); });
          markersRef.current.push(new window.mapboxgl.Marker({ element: dropoffEl, anchor: "center" }).setLngLat([ride.dropoffLng, ride.dropoffLat]).addTo(map));

          if (DRIVER_LIVE_STATUSES.has(ride.status) && typeof ride.driverLat === "number" && typeof ride.driverLng === "number") {
            const liveEl = document.createElement("div");
            liveEl.style.cssText = `position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;`;
            liveEl.innerHTML = `<div style="position:absolute;inset:-2px;border-radius:50%;border:2px solid ${color};opacity:0;animation:livePulse 1.6s ease-out infinite;"></div><div style="position:relative;width:30px;height:30px;border-radius:50%;background:${color};border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px ${color}88, 0 2px 4px rgba(0,0,0,.3);transition:transform .15s;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"></path><circle cx="6.5" cy="16.5" r="2.5"></circle><circle cx="16.5" cy="16.5" r="2.5"></circle></svg></div>`;
            liveEl.addEventListener("mouseenter", (e) => { setHoveredRide({ ...ride, _hoverType: "live" }); setHoveredDriver(null); const rect = containerRef.current?.getBoundingClientRect(); if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top }); const inner = liveEl.querySelector("div:last-child"); if (inner) inner.style.transform = "scale(1.15)"; });
            liveEl.addEventListener("mousemove", (e) => { const rect = containerRef.current?.getBoundingClientRect(); if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top }); });
            liveEl.addEventListener("mouseleave", () => { setHoveredRide(null); const inner = liveEl.querySelector("div:last-child"); if (inner) inner.style.transform = ""; });
            liveEl.addEventListener("click", (e) => { e.stopPropagation(); const driver = ride.driverUid ? driverByUid[ride.driverUid] : null; if (driver) onDriverClick?.(driver); });
            markersRef.current.push(new window.mapboxgl.Marker({ element: liveEl, anchor: "center" }).setLngLat([ride.driverLng, ride.driverLat]).addTo(map));
          }
        });
      }

      if (showDrivers) {
        pinnedDrivers.forEach(driver => {
          const color  = PIN_COLORS[driver.status] || "#9CA3AF";
          const isLive = driver.status === "online" || driver.status === "approved";

          const wrap = document.createElement("div");
          wrap.style.cursor = "pointer";
          wrap.innerHTML = `<div style="position:relative;width:28px;height:36px;display:flex;align-items:flex-end;justify-content:center;filter:drop-shadow(0 4px 8px rgba(0,0,0,.35));">${isLive ? `<div style="position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);width:34px;height:34px;border-radius:50%;border:2px solid ${color};opacity:0;animation:driverPulse 2.2s ease-out infinite;"></div>` : ""}<svg width="28" height="36" viewBox="0 0 28 36" fill="none" style="position:relative;"><path d="M14 0C6.27 0 0 6.27 0 14c0 10 14 22 14 22s14-12 14-22C28 6.27 21.73 0 14 0z" fill="${color}"/><circle cx="14" cy="14" r="6.5" fill="#fff"/><circle cx="14" cy="14" r="3" fill="${color}"/></svg></div>`;
          wrap.addEventListener("mouseenter", (e) => { setHoveredDriver(driver); setHoveredRide(null); const rect = containerRef.current?.getBoundingClientRect(); if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top }); const inner = wrap.querySelector("svg"); if (inner) { inner.style.transform = "scale(1.18)"; inner.style.transition = "transform .15s"; } });
          wrap.addEventListener("mousemove", (e) => { const rect = containerRef.current?.getBoundingClientRect(); if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top }); });
          wrap.addEventListener("mouseleave", () => { setHoveredDriver(null); const inner = wrap.querySelector("svg"); if (inner) inner.style.transform = ""; });
          wrap.addEventListener("click", (e) => { e.stopPropagation(); onDriverClick?.(driver); });
          markersRef.current.push(new window.mapboxgl.Marker({ element: wrap.firstElementChild, anchor: "bottom" }).setLngLat([driver.lng, driver.lat]).addTo(map));
        });
      }

      const totalPins = (showDrivers ? pinnedDrivers.length : 0) + (showRides ? pinnedRides.length * 2 : 0);
      if (totalPins > 0 && bounds) {
        if (totalPins === 1 && pinnedDrivers.length === 1 && !showRides) {
          map.flyTo({ center: [pinnedDrivers[0].lng, pinnedDrivers[0].lat], zoom: 14, duration: 700 });
        } else {
          map.fitBounds([[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]], { padding: { top: 60, bottom: 70, left: 40, right: 60 }, maxZoom: 14, duration: 700 });
        }
      }
    };

    if (mapRef.current.loaded()) render();
    else mapRef.current.once("load", render);
  }, [pinnedDrivers, pinnedRides, bounds, onDriverClick, onRideClick, showRides, showDrivers, driverByUid]);

  const driverLegend = [
    { label: "Online",   count: driverCounts.online,   color: PIN_COLORS.online,   live: true  },
    { label: "Approved", count: driverCounts.approved, color: PIN_COLORS.approved, live: true  },
    { label: "Offline",  count: driverCounts.offline,  color: PIN_COLORS.offline               },
    { label: "Pending",  count: driverCounts.pending,  color: PIN_COLORS.pending               },
    ...(driverCounts.in_progress > 0 ? [{ label: "On Trip",   count: driverCounts.in_progress, color: PIN_COLORS.in_progress, live: true }] : []),
    ...(driverCounts.suspended   > 0 ? [{ label: "Suspended", count: driverCounts.suspended,   color: PIN_COLORS.suspended                }] : []),
  ].filter(it => it.count > 0);

  const rideLegend = useMemo(() => {
    const grouped = {};
    pinnedRides.forEach(r => { grouped[r.status] = (grouped[r.status] || 0) + 1; });
    return Object.entries(grouped).map(([status, count]) => ({
      label: rideStatusLabel(status), count, color: rideStatusColor(status),
      live: ["in_progress", "driver_arriving", "arrived", "driver_assigned"].includes(status),
    }));
  }, [pinnedRides]);

  const hasAnything = pinnedDrivers.length > 0 || pinnedRides.length > 0;
  const hoveredRideDriver = hoveredRide?.driverUid ? driverByUid[hoveredRide.driverUid] : null;

  return (
    <div className="card fade-up" style={{ marginBottom: 12, animationDelay: "20ms", opacity: 0, overflow: "hidden", position: "relative" }}>
      <style>{`
        @keyframes driverPulse { 0%{transform:translateX(-50%) scale(.6);opacity:.9} 70%{transform:translateX(-50%) scale(1.8);opacity:0} 100%{transform:translateX(-50%) scale(.6);opacity:0} }
        @keyframes livePulse   { 0%{transform:scale(.7);opacity:.9} 70%{transform:scale(2.0);opacity:0} 100%{transform:scale(.7);opacity:0} }
        .mapboxgl-ctrl-bottom-left, .mapboxgl-ctrl-bottom-right { display: none !important; }
        .mapboxgl-ctrl-top-right { margin: 8px 8px 0 0 !important; }
        .mapboxgl-ctrl-group { background: rgba(15,23,42,.85) !important; border: 1px solid rgba(255,255,255,.1) !important; backdrop-filter: blur(8px); }
        .mapboxgl-ctrl-group button { background: transparent !important; color: #fff !important; }
        .mapboxgl-ctrl-group button + button { border-top-color: rgba(255,255,255,.1) !important; }
        .mapboxgl-ctrl-group button:hover { background: rgba(255,255,255,.08) !important; }
        .mapboxgl-ctrl-group button .mapboxgl-ctrl-icon { filter: invert(1) !important; opacity: .8; }
        @keyframes tooltipIn { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:translateY(0) } }
      `}</style>

      <div style={{ padding: "12px 14px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(135deg,#0F172A,#1E293B)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MapIcon size={14} color="#fff" strokeWidth={2.4}/>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text, letterSpacing: "-0.1px" }}>Fleet Map</div>
            <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 600, marginTop: 1 }}>{pinnedDrivers.length} driver{pinnedDrivers.length !== 1 ? "s" : ""} · {pinnedRides.length} active ride{pinnedRides.length !== 1 ? "s" : ""}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => setShowRides(v => !v)} style={{ height: 28, padding: "0 10px", borderRadius: 8, border: `1.5px solid ${showRides ? "#3B82F6" : C.border}`, background: showRides ? "#3B82F615" : C.surfaceHigh, color: showRides ? "#3B82F6" : C.textMuted, fontSize: 10.5, fontWeight: 700, fontFamily: "'Barlow',sans-serif", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, transition: "all .15s" }}><Route size={10} />Rides</button>
          <button onClick={() => setShowDrivers(v => !v)} style={{ height: 28, padding: "0 10px", borderRadius: 8, border: `1.5px solid ${showDrivers ? C.green : C.border}`, background: showDrivers ? C.greenGlow : C.surfaceHigh, color: showDrivers ? C.green : C.textMuted, fontSize: 10.5, fontWeight: 700, fontFamily: "'Barlow',sans-serif", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, transition: "all .15s" }}><Car size={10} />Drivers</button>
          {expandable && (
            <button onClick={() => setExpanded(e => !e)} style={{ width: 30, height: 30, borderRadius: 9, border: `1px solid ${C.border}`, background: C.surfaceHigh, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "background .15s" }} onMouseEnter={e => e.currentTarget.style.background = C.border} onMouseLeave={e => e.currentTarget.style.background = C.surfaceHigh}>
              {expanded ? <Minimize2 size={12} color={C.textMuted}/> : <Maximize2 size={12} color={C.textMuted}/>}
            </button>
          )}
        </div>
      </div>

      <div style={{ position: "relative", height: mapHeight, background: "#0d1117", transition: "height .3s cubic-bezier(.32,.72,0,1)" }}>
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        {!hasAnything && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(13,17,23,.96)", backdropFilter: "blur(2px)", zIndex: 20 }}>
            <div style={{ textAlign: "center", padding: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}><Navigation size={20} color="rgba(255,255,255,.4)"/></div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 4 }}>No data on map</div>
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.5)", fontWeight: 500 }}>No drivers or active rides with location data</div>
            </div>
          </div>
        )}
        {hoveredDriver && !hoveredRide && (
          <div style={{ position: "absolute", left: Math.min(tooltipPos.x + 14, (containerRef.current?.clientWidth ?? 999) - 210), top: Math.max(tooltipPos.y - 64, 8), zIndex: 30, pointerEvents: "none", background: "rgba(15,23,42,.97)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, padding: "9px 12px", minWidth: 190, boxShadow: "0 10px 28px rgba(0,0,0,.35)", animation: "tooltipIn .12s ease-out" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}><div style={{ width: 7, height: 7, borderRadius: "50%", background: PIN_COLORS[hoveredDriver.status] || "#9CA3AF", boxShadow: (hoveredDriver.status === "online" || hoveredDriver.status === "approved") ? `0 0 8px ${PIN_COLORS[hoveredDriver.status]}` : "none" }}/><span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: PIN_COLORS[hoveredDriver.status] || "#9CA3AF" }}>Driver · {hoveredDriver.status}</span></div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "-0.1px", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fullName(hoveredDriver)}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{locationStr(hoveredDriver) || formatMinutesAgo(hoveredDriver.minutesSinceLastSeen)}</div>
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,.1)", fontSize: 10, color: "rgba(255,255,255,.45)", fontFamily: "monospace" }}>{hoveredDriver.lat?.toFixed(4)}, {hoveredDriver.lng?.toFixed(4)}</div>
            <div style={{ marginTop: 4, fontSize: 10, color: "rgba(255,255,255,.5)", fontWeight: 600 }}>Click to view details</div>
          </div>
        )}
        {hoveredRide && (
          <div style={{ position: "absolute", left: Math.min(tooltipPos.x + 14, (containerRef.current?.clientWidth ?? 999) - 280), top: Math.max(tooltipPos.y - 80, 8), zIndex: 30, pointerEvents: "none", background: "rgba(15,23,42,.97)", backdropFilter: "blur(12px)", border: `1px solid ${rideStatusColor(hoveredRide.status)}40`, borderRadius: 10, padding: "10px 13px", minWidth: 260, boxShadow: "0 10px 28px rgba(0,0,0,.35)", animation: "tooltipIn .12s ease-out" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><div style={{ width: 7, height: 7, borderRadius: "50%", background: rideStatusColor(hoveredRide.status), boxShadow: `0 0 8px ${rideStatusColor(hoveredRide.status)}` }}/><span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: rideStatusColor(hoveredRide.status) }}>{hoveredRide._hoverType === "live" ? "Live · " : "Ride · "}{rideStatusLabel(hoveredRide.status)}</span><span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 800, color: "#fff", background: "rgba(255,255,255,.1)", padding: "2px 7px", borderRadius: 5, fontFamily: "monospace" }}>{fmtMoney(rideFare(hoveredRide))}</span></div>
            {hoveredRide._hoverType === "live" && (<div style={{ display: "flex", gap: 8, marginBottom: 8, padding: "7px 9px", background: `${rideStatusColor(hoveredRide.status)}15`, border: `1px solid ${rideStatusColor(hoveredRide.status)}30`, borderRadius: 8 }}>{hoveredRide.driverEtaMin != null && (<div style={{ flex: 1, display: "flex", alignItems: "center", gap: 5 }}><Timer size={11} color={rideStatusColor(hoveredRide.status)}/><span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff" }}>{hoveredRide.driverEtaMin}m</span><span style={{ fontSize: 9.5, color: "rgba(255,255,255,.5)" }}>ETA</span></div>)}{hoveredRide.driverDistanceMiles != null && (<div style={{ flex: 1, display: "flex", alignItems: "center", gap: 5 }}><Route size={11} color={rideStatusColor(hoveredRide.status)}/><span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff" }}>{hoveredRide.driverDistanceMiles < 0.1 ? `${Math.round(hoveredRide.driverDistanceMiles * 5280)}ft` : `${hoveredRide.driverDistanceMiles.toFixed(1)}mi`}</span><span style={{ fontSize: 9.5, color: "rgba(255,255,255,.5)" }}>away</span></div>)}</div>)}
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}><div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}><div style={{ width: 16, height: 16, borderRadius: "50%", background: rideStatusColor(hoveredRide.status), border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, fontSize: 7, fontWeight: 900, color: "#fff" }}>P</div><span style={{ fontSize: 11, color: "rgba(255,255,255,.85)", fontWeight: 500, lineHeight: 1.3 }}>{truncateAddress(hoveredRide.pickup, 36)}</span></div><div style={{ width: 1.5, height: 10, background: "rgba(255,255,255,.15)", marginLeft: 7 }} /><div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}><div style={{ width: 16, height: 16, borderRadius: 4, background: rideStatusColor(hoveredRide.status), border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, fontSize: 7, fontWeight: 900, color: "#fff" }}>D</div><span style={{ fontSize: 11, color: "rgba(255,255,255,.85)", fontWeight: 500, lineHeight: 1.3 }}>{truncateAddress(hoveredRide.dropoff, 36)}</span></div></div>
            <div style={{ borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 8 }}><RideStatusStepper status={hoveredRide.status} /></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8, paddingTop: 7, borderTop: "1px solid rgba(255,255,255,.06)" }}><div style={{ fontSize: 10, color: "rgba(255,255,255,.55)" }}><span style={{ color: "rgba(255,255,255,.3)", marginRight: 3, letterSpacing: ".05em" }}>TYPE</span>{hoveredRide.rideLabel ?? hoveredRide.rideType ?? "—"}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,.55)" }}><span style={{ color: "rgba(255,255,255,.3)", marginRight: 3, letterSpacing: ".05em" }}>DIST</span>{hoveredRide.tripDistanceMiles != null ? `${hoveredRide.tripDistanceMiles}mi` : "—"}</div>{hoveredRide.tripDurationMin != null && (<div style={{ fontSize: 10, color: "rgba(255,255,255,.55)" }}><span style={{ color: "rgba(255,255,255,.3)", marginRight: 3, letterSpacing: ".05em" }}>TIME</span>{hoveredRide.tripDurationMin}m</div>)}<div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: hoveredRide.paymentMethod === "cash" ? "#F59E0B" : "#3B82F6", fontWeight: 700 }}>{hoveredRide.paymentMethod === "cash" ? <><Banknote size={10}/>CASH</> : <><CreditCard size={10}/>CARD</>}</div></div>
            {hoveredRideDriver && (<div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 7, paddingTop: 7, borderTop: "1px solid rgba(255,255,255,.06)" }}><div style={{ width: 18, height: 18, borderRadius: "50%", background: PIN_COLORS[hoveredRideDriver.status] || "#9CA3AF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 900, color: "#fff", border: "1.5px solid rgba(255,255,255,.3)", flexShrink: 0 }}><User size={9}/></div><span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.9)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fullName(hoveredRideDriver)}</span>{hoveredRideDriver.vehicle?.plate && (<span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.4)", fontFamily: "monospace", letterSpacing: ".05em", marginLeft: "auto" }}>{hoveredRideDriver.vehicle.plate.toUpperCase()}</span>)}</div>)}
          </div>
        )}
        <div style={{ position: "absolute", bottom: 12, left: 12, zIndex: 15, display: "flex", flexDirection: "column", gap: 5, maxWidth: "calc(100% - 24px)" }}>
          {showDrivers && driverLegend.length > 0 && (<div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{driverLegend.map(({ label, count, color, live }) => (<LegendPill key={label} label={label} count={count} color={color} live={live} />))}</div>)}
          {showRides && rideLegend.length > 0 && (<div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{rideLegend.map(({ label, count, color, live }) => (<LegendPill key={label} label={`↗ ${label}`} count={count} color={color} live={live} />))}</div>)}
        </div>
      </div>
    </div>
  );
}

function LegendPill({ label, count, color, live }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(15,23,42,.85)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 99, padding: "4px 9px" }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: live ? `0 0 8px ${color}` : "none" }}/>
      <span style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,.85)", letterSpacing: ".05em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 10, fontWeight: 800, fontFamily: "monospace", color: "#fff", background: "rgba(255,255,255,.12)", padding: "1px 5px", borderRadius: 5, marginLeft: 1 }}>{count}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DRIVERS TAB
// ═══════════════════════════════════════════════════════════════════════════
export function DriversTab({ rides = [], fleet = [], onToast, onSelectRide }) {
  const [search,    setSearch]    = useState("");
  const [locSearch, setLocSearch] = useState("");
  const [filter,    setFilter]    = useState("all");
  const [selected,  setSelected]  = useState(null);

  const filters = ["all", "online", "approved", "offline", "pending", "in_progress"];

  const driverByUid = useMemo(() => {
    const out = {};
    fleet.forEach(d => {
      if (d.uid) out[d.uid] = d;
      if (d.id)  out[d.id]  = d;
    });
    return out;
  }, [fleet]);

  const mapDrivers = useMemo(() => {
    if (filter === "all") return fleet.filter(d => ["online", "approved", "offline", "pending"].includes(d.status));
    return fleet.filter(d => d.status === filter);
  }, [fleet, filter]);

  const activeRides = useMemo(() => {
    if (!rides) return [];
    return rides.filter(r => !RIDE_STATUSES_HIDDEN_FROM_MAP.has(r.status));
  }, [rides]);

  const listDrivers = useMemo(() => {
    return fleet.filter(d => {
      if (filter !== "all" && d.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = fullName(d).toLowerCase();
        const email = (d.email || "").toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }
      if (locSearch) {
        const q = locSearch.toLowerCase();
        const c = d.contact ?? {};
        const hay = [c.city, c.state, c.zip, c.address].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [fleet, filter, search, locSearch]);

  const handleDriverClick = useCallback((driver) => {
    setSelected(driver);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleRideClick = useCallback((ride) => {
    onSelectRide?.(ride);
  }, [onSelectRide]);

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

  const showMap = filter !== "in_progress";

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="fade-up" style={{ display: "flex", gap: 8, marginBottom: 12, animationDelay: "0ms", opacity: 0, overflowX: "auto", paddingBottom: 2 }}>
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 100, border: `1.5px solid ${filter === f ? C.green : C.border}`, background: filter === f ? C.greenGlow : C.surface, color: filter === f ? C.green : C.textMuted, fontFamily: "'Barlow',sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s" }}>
            {f === "in_progress" ? "In Progress" : f.charAt(0).toUpperCase() + f.slice(1)}
            <span style={{ marginLeft: 5, background: C.border, borderRadius: 100, padding: "1px 6px", fontSize: 10 }}>
              {f === "all" ? fleet.length : fleet.filter(d => d.status === f).length}
            </span>
          </button>
        ))}
      </div>

      {showMap && (
        <DriverMapView
          drivers={mapDrivers}
          rides={activeRides}
          driverByUid={driverByUid}
          onDriverClick={handleDriverClick}
          onRideClick={handleRideClick}
          height={300}
        />
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <div className="search-bar fade-up" style={{ flex: 1, minWidth: 180, animationDelay: "40ms", opacity: 0 }}>
          <Search size={15} color={C.textDim} />
          <input placeholder="Search name or email…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", color: C.textMuted }}><X size={13}/></button>}
        </div>
        <div className="search-bar fade-up" style={{ flex: 1, minWidth: 180, animationDelay: "60ms", opacity: 0, border: locSearch ? `1.5px solid ${C.green}` : undefined, background: locSearch ? C.greenGlow : undefined }}>
          <MapPin size={15} color={locSearch ? C.green : C.textDim} />
          <input placeholder="City, state, or ZIP…" value={locSearch} onChange={e => setLocSearch(e.target.value)} style={{ color: locSearch ? C.green : undefined }} />
          {locSearch && <button onClick={() => setLocSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", color: C.green }}><X size={13}/></button>}
        </div>
      </div>

      {(search || locSearch) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", marginBottom: 10, background: C.greenGlow, border: `1px solid ${C.green}30`, borderRadius: 10, fontSize: 11.5, fontWeight: 600, color: C.green }}>
          <span>Showing {listDrivers.length} of {fleet.length} drivers{search && ` · matching "${search}"`}{locSearch && ` · in "${locSearch}"`}</span>
          <button onClick={() => { setSearch(""); setLocSearch(""); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, color: C.green, textDecoration: "underline" }}>Clear</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {listDrivers.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: C.surfaceHigh, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}><Search size={18} color={C.textMuted}/></div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 4 }}>No drivers found</div>
            <div style={{ fontSize: 11.5, color: C.textMuted, fontWeight: 500 }}>Try adjusting your filters or search terms</div>
          </div>
        )}
        {listDrivers.map((driver, i) => {
          const { done, total } = docsComplete(driver.documents);
          const allDocs = done === total;
          const loc = locationStr(driver);
          return (
            <div key={driver.id} className="card fade-up" style={{ animationDelay: `${130 + i * 45}ms`, opacity: 0, cursor: "pointer", overflow: "hidden" }} onClick={() => setSelected(driver)}>
              <div style={{ height: 3, background: STATUS_CONFIG[driver.status]?.color || C.border }} />
              <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ position: "relative" }}>
                  <Avatar name={fullName(driver)} size={42} colorIdx={i} photo={driver.profilePhotoUrl || null} />
                  <div style={{ position: "absolute", bottom: 0, right: 0, width: 11, height: 11, borderRadius: "50%", background: STATUS_CONFIG[driver.status]?.color || C.textDim, border: `2px solid ${C.surface}` }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{fullName(driver)}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{driver.email}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 5, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: allDocs ? C.green : "#D97706", background: allDocs ? C.greenGlow : "#FFFBEB", border: `1px solid ${allDocs ? C.green + "40" : "#D9770640"}`, borderRadius: 6, padding: "2px 7px" }}>{done}/{total} docs</span>
                    {driver.averageRating && <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#F59E0B", fontWeight: 700 }}><Star size={9} fill="#F59E0B" /> {Number(driver.averageRating).toFixed(1)}</span>}
                    {driver.totalRides != null && <span style={{ fontSize: 10, color: C.textMuted }}>{driver.totalRides} rides</span>}
                    {loc && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, color: C.textMuted, fontWeight: 600 }}><MapPin size={9} strokeWidth={2.4}/>{loc}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                  <StatusPill status={driver.status} />
                  <span style={{ fontSize: 10, color: C.textMuted }}>
                    {(driver.status === "online" || driver.status === "approved" || driver.status === "offline") && driver.minutesSinceLastSeen != null
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

// ═══════════════════════════════════════════════════════════════════════════
// DRIVER DETAIL
// ═══════════════════════════════════════════════════════════════════════════
function DriverDetail({ driverId, driverIdx, onBack, onToast }) {
  const [d,            setD]            = useState(null);
  const [activeTab,    setActiveTab]    = useState("overview");
  const [approving,    setApproving]    = useState(false);
  const [rejecting,    setRejecting]    = useState(false);
  const [suspending,   setSuspending]   = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [lightbox,     setLightbox]     = useState(null);
  const [showReward,   setShowReward]   = useState(false);   // ← NEW

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

  const handleDelete = async () => {
    if (deleting) return;
    const confirmed = window.confirm(
      `⚠️ Are you sure you want to permanently delete ${fullName(d)} from the app?\n\nThis action cannot be undone and will:\n• Remove all driver data\n• Cancel active rides\n• Delete all reviews\n\nType DELETE to confirm.`
    );
    if (!confirmed) return;
    
    const userConfirm = window.prompt("Type DELETE to confirm deletion:");
    if (userConfirm !== "DELETE") {
      onToast("❌ Deletion cancelled");
      return;
    }

    setDeleting(true);
    try {
      const { data } = await callDeleteDriver({ driverUid: driverId });
      if (data?.success) {
        onToast(`✅ ${data.driverName} has been permanently deleted (${data.deletedCounts.rides} rides updated, ${data.deletedCounts.reviews} reviews deleted)`);
        setTimeout(() => onBack(), 1500);
      } else {
        onToast(`Failed to delete driver: ${data?.error || "Unknown error"}`);
      }
    } catch (err) {
      onToast(`Failed to delete driver: ${err.message}`);
    } finally { setDeleting(false); }
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

  // ── Rewards ──
  const rewardsBalance = d.rewardsBalance ?? 0;
  const rewards        = d.rewards        ?? [];

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

  const isPendingReview = d.status === "pending" || d.status === "in_progress";
  const canSuspend      = ["approved", "online", "offline"].includes(d.status);

  return (
    <div style={{ padding: "0 16px 24px" }}>
      <style>{`
        @keyframes spin   { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
      `}</style>

      {/* Award Reward sheet */}
      {showReward && (
        <AwardRewardSheet
          driver={d}
          onClose={() => setShowReward(false)}
          onSuccess={(msg) => onToast(msg)}
        />
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, zIndex: 1300, background: "rgba(0,0,0,.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <button onClick={() => setLightbox(null)} style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,.15)", border: "none", borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={20} color="#fff" />
          </button>
          <img src={lightbox} alt="Document" style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 16, objectFit: "contain" }} />
        </div>
      )}

      <button className="btn-ghost" onClick={onBack} style={{ marginBottom: 16, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6 }}>
        <ArrowLeft size={14} /> Back to drivers
      </button>

      {/* Hero card */}
      <div style={{ background: "linear-gradient(135deg,#0F172A,#1E293B)", borderRadius: 20, padding: "22px 20px 20px", marginBottom: 14, position: "relative", overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,.2)" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: statusColor }} />
        <div style={{ position: "absolute", top: -60, right: -60, width: 180, height: 180, borderRadius: "50%", background: `${statusColor}12`, pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
          <Avatar name={name} size={56} colorIdx={driverIdx} photo={d.profilePhotoUrl || null} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 4, letterSpacing: "-0.3px" }}>{name}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <StatusPill status={d.status} />
              {d.averageRating != null && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#F59E0B", fontWeight: 700, background: "rgba(245,158,11,.12)", borderRadius: 6, padding: "3px 8px" }}>
                  <Star size={11} fill="#F59E0B" /> {Number(d.averageRating).toFixed(2)} · {d.totalReviews ?? 0} reviews
                </span>
              )}
              {/* Rewards balance badge on hero */}
              {rewardsBalance > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#FCD34D", fontWeight: 700, background: "rgba(251,191,36,.12)", borderRadius: 6, padding: "3px 8px", border: "1px solid rgba(251,191,36,.2)" }}>
                  <Gift size={11}/> {fmtMoney(rewardsBalance)} rewards
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { label: "Total Rides",    value: d.totalRides ?? 0,                        icon: <Car size={12} color="rgba(255,255,255,.5)" /> },
            { label: "Earnings Today", value: fmtMoney(today.earnings),                 icon: <DollarSign size={12} color="rgba(255,255,255,.5)" /> },
            { label: "Last Seen",      value: formatMinutesAgo(d.minutesSinceLastSeen), icon: <Clock size={12} color="rgba(255,255,255,.5)" /> },
          ].map(({ label, value, icon }) => (
            <div key={label} style={{ background: "rgba(255,255,255,.06)", borderRadius: 12, padding: "10px 12px", border: "1px solid rgba(255,255,255,.08)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>{icon}<span style={{ fontSize: 9, color: "rgba(255,255,255,.4)", fontWeight: 700, letterSpacing: ".04em" }}>{label.toUpperCase()}</span></div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 4, gap: 3, marginBottom: 14 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: "8px 4px", border: "none", background: activeTab === t ? C.text : "transparent", color: activeTab === t ? "#fff" : C.textMuted, borderRadius: 9, fontSize: 11, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", cursor: "pointer", transition: "all .15s", textTransform: "capitalize" }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeUp .3s ease" }}>
          <div className="card" style={{ padding: "16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: ".06em", marginBottom: 12 }}>CONTACT</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { Icon: Mail,   value: d.email        ?? "—" },
                { Icon: Phone,  value: contact.phone  ?? "—" },
                { Icon: MapPin, value: contact.city   ? `${contact.city.trim()}, ${contact.state} ${contact.zip ?? ""}`.trim() : "—" },
              ].map(({ Icon, value }) => (
                <div key={value} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 30, height: 30, background: C.surfaceHigh, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={13} color={C.green} /></div>
                  <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: "16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: ".06em", marginBottom: 12 }}>ACCOUNT</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: "UID",       value: d.uid?.slice(0, 12) + "…" ?? "—" },
                { label: "Joined",    value: timeAgo(d.createdAt) },
                { label: "License",   value: docs.licenseNumber ?? "—" },
                { label: "Submitted", value: timeAgo(d.submittedAt) },
                { label: "Stripe",    value: d.accountId ? "Connected" : "Not set", color: d.accountId ? C.green : C.red },
                { label: "Transfer",  value: d.transferCapability ?? "—", color: d.transferCapability === "enabled" ? C.green : "#D97706" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: C.surfaceHigh, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, letterSpacing: ".5px", marginBottom: 3 }}>{label.toUpperCase()}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: color ?? C.text, wordBreak: "break-all" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {vehicle.make && (
            <div className="card" style={{ padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><Car size={13} color={C.green} /><span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: ".06em" }}>VEHICLE</span></div>
              <div style={{ background: C.surfaceHigh, borderRadius: 12, padding: "14px 16px", border: `1px solid ${C.border}`, marginBottom: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: C.text, marginBottom: 2 }}>{vehicle.year} {vehicle.make} {vehicle.model}</div>
                <div style={{ fontSize: 13, color: C.textMuted }}>{vehicle.color}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[{ label: "Plate", value: vehicle.plate?.toUpperCase() ?? "—" }, { label: "VIN", value: vehicle.vin ?? "N/A" }, { label: "Types", value: Array.isArray(vehicle.rideTypes) ? vehicle.rideTypes.join(", ") : "—" }].map(({ label, value }) => (
                  <div key={label} style={{ background: C.surfaceHigh, borderRadius: 8, padding: "8px 10px", border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: "capitalize" }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {d.lat && d.lng && (
            <div className="card" style={{ padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <MapPin size={13} color={C.green} />
                <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: ".06em" }}>LAST LOCATION</span>
                {(d.status === "online" || d.status === "approved") && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.green }}>LIVE</span>
                  </div>
                )}
              </div>
              <div style={{ background: C.surfaceHigh, borderRadius: 10, padding: "12px 14px", border: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: "monospace", fontSize: 13, color: C.text, marginBottom: 4 }}>{d.lat?.toFixed(6)}, {d.lng?.toFixed(6)}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{formatMinutesAgo(d.minutesSinceLastSeen)}</div>
              </div>
              <a href={`https://www.google.com/maps?q=${d.lat},${d.lng}`} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8, padding: "9px", background: "#1D4ED815", border: "1px solid #1D4ED830", borderRadius: 10, color: "#2563EB", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                <MapPin size={12} /> Open in Google Maps
              </a>
            </div>
          )}
        </div>
      )}

      {activeTab === "documents" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeUp .3s ease" }}>
          <div style={{ background: allDocs ? "#F0FDF4" : "#FFFBEB", border: `1.5px solid ${allDocs ? "#86EFAC" : "#FDE68A"}`, borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: allDocs ? C.green : "#D97706" }}>{allDocs ? "All documents submitted" : `${docsTotal - docsDone} document${docsTotal - docsDone !== 1 ? "s" : ""} missing`}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: allDocs ? C.green : "#D97706" }}>{docsDone}/{docsTotal}</span>
            </div>
            <div style={{ height: 6, background: allDocs ? "#BBF7D0" : "#FDE68A", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${(docsDone / docsTotal) * 100}%`, height: "100%", background: allDocs ? C.green : "#D97706", borderRadius: 99, transition: "width .4s" }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {docSlots.map(({ key, urlKey, label }) => {
              const uploaded = Boolean(docs[urlKey] || docs[key]);
              const url      = docs[urlKey] || "";
              return (
                <div key={key} style={{ background: uploaded ? "#F0FDF4" : "#FEF2F2", border: `1.5px solid ${uploaded ? "rgba(22,163,74,.25)" : "rgba(220,38,38,.2)"}`, borderRadius: 14, overflow: "hidden", cursor: uploaded && url ? "pointer" : "default" }} onClick={() => uploaded && url && setLightbox(url)}>
                  {url ? (<div style={{ height: 80, background: "#1E293B", overflow: "hidden", position: "relative" }}><img src={url} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: .85 }} /><div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.15)" }}><Eye size={18} color="#fff" /></div></div>) : (<div style={{ height: 80, background: "rgba(220,38,38,.06)", display: "flex", alignItems: "center", justifyContent: "center" }}><FileText size={22} color="rgba(220,38,38,.4)" /></div>)}
                  <div style={{ padding: "10px 12px" }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text, marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: uploaded ? C.green : "#DC2626" }}>{uploaded ? "✓ Uploaded" : "✗ Missing"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "earnings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeUp .3s ease" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "Today",      value: fmtMoney(today.earnings), sub: `${today.trips ?? 0} trips`,  color: C.green  },
              { label: "This Week",  value: fmtMoney(week.earnings),  sub: `${week.trips  ?? 0} trips`,  color: "#2563EB" },
              { label: "This Month", value: fmtMoney(month.earnings), sub: `${month.trips ?? 0} trips`,  color: "#7C3AED" },
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
          {earnings.lastSyncedAt && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
              <Clock size={11} color={C.textMuted} />
              <span style={{ fontSize: 11, color: C.textMuted }}>Synced {formatTs(earnings.lastSyncedAt)}</span>
            </div>
          )}
        </div>
      )}

      {activeTab === "payout" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeUp .3s ease" }}>

          {/* ── Rewards summary ── */}
          <div style={{
            background: "linear-gradient(135deg,#0F172A,#1C1917)",
            border: "1.5px solid rgba(251,191,36,.2)",
            borderRadius: 18, padding: "18px 18px",
            boxShadow: "0 4px 20px rgba(251,191,36,.08)",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: -40, right: -40, width: 130, height: 130, borderRadius: "50%", background: "radial-gradient(circle, rgba(251,191,36,0.14) 0%, transparent 70%)", pointerEvents: "none" }}/>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: rewards.length > 0 ? 14 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#F59E0B,#D97706)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(217,119,6,.35)" }}>
                  <Gift size={16} color="#fff" strokeWidth={2.2}/>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(251,191,36,.6)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 2 }}>Rewards Balance</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#FCD34D", letterSpacing: "-0.5px", fontVariantNumeric: "tabular-nums" }}>{fmtMoney(rewardsBalance)}</div>
                </div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,.35)", textAlign: "right", lineHeight: 1.5 }}>
                {rewards.length} reward{rewards.length !== 1 ? "s" : ""} total<br/>
                <span style={{ color: "rgba(251,191,36,.4)" }}>Resets on payout</span>
              </div>
            </div>
            {rewards.length > 0 && (
              <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(251,191,36,.1)", borderRadius: 10, overflow: "hidden" }}>
                {rewards.slice(0, 5).map((r, i) => {
                  const ts = r.awardedAt?.seconds ? new Date(r.awardedAt.seconds * 1000) : r.awardedAt ? new Date(r.awardedAt) : null;
                  return (
                    <div key={r.id ?? i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderBottom: i < Math.min(rewards.length, 5) - 1 ? "1px solid rgba(251,191,36,.08)" : "none" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.description ?? "Bonus"}</div>
                        {ts && <div style={{ fontSize: 10, color: "rgba(255,255,255,.3)", marginTop: 1 }}>{ts.toLocaleDateString([], { month: "short", day: "numeric" })}</div>}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#FCD34D", marginLeft: 10, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>+{fmtMoney(r.amount)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Withdrawal status */}
          <div style={{ background: withdrawal.status === "paid" ? "linear-gradient(135deg,#14532D,#166534)" : withdrawal.status === "pending" ? "linear-gradient(135deg,#78350F,#92400E)" : "linear-gradient(135deg,#1E293B,#0F172A)", borderRadius: 18, padding: "22px 18px", boxShadow: "0 4px 24px rgba(0,0,0,.2)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.5)", letterSpacing: ".08em", marginBottom: 6 }}>WITHDRAWAL STATUS</div>
            <div style={{ fontSize: 38, fontWeight: 900, color: "#fff", marginBottom: 4 }}>{fmtMoney(withdrawal.totalPayout)}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: withdrawal.status === "paid" ? "#22C55E30" : withdrawal.status === "pending" ? "#F59E0B30" : "rgba(255,255,255,.1)", color: withdrawal.status === "paid" ? "#4ADE80" : withdrawal.status === "pending" ? "#FCD34D" : "rgba(255,255,255,.6)", border: `1px solid ${withdrawal.status === "paid" ? "#4ADE8040" : withdrawal.status === "pending" ? "#FCD34D40" : "rgba(255,255,255,.15)"}` }}>
                {(withdrawal.status ?? "No payout").toUpperCase()}
              </span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>{withdrawal.rideCount ?? 0} ride{(withdrawal.rideCount ?? 0) !== 1 ? "s" : ""}</span>
            </div>
          </div>

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

          <div style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 36, height: 36, background: "#635BFF15", border: "1px solid #635BFF30", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><CreditCard size={16} color="#635BFF" /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>Stripe Account</div>
              <div style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace" }}>{d.accountId ?? "Not connected"}</div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: d.accountId ? C.greenGlow : "#FEF2F2", color: d.accountId ? C.green : "#DC2626", border: `1px solid ${d.accountId ? C.green + "30" : "#DC262630"}` }}>
              {d.accountId ? "CONNECTED" : "MISSING"}
            </span>
          </div>

          {(withdrawal.rideIds ?? []).length > 0 && (
            <div className="card" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: ".06em", marginBottom: 10 }}>RIDE IDs</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {withdrawal.rideIds.map((id) => (
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

      {/* ── Action buttons ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        {isPendingReview && (
          <>
            <button className="btn-success" onClick={handleApprove} disabled={approving || rejecting} style={{ opacity: approving || rejecting ? .6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {approving ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Approving…</> : <><CheckCircle size={15} /> Approve Driver</>}
            </button>
            <button className="btn-danger" onClick={handleReject} disabled={approving || rejecting} style={{ opacity: approving || rejecting ? .6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {rejecting ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Rejecting…</> : <><XCircle size={15} /> Reject Application</>}
            </button>
          </>
        )}

        {/* Award Reward button — available for any non-rejected/suspended driver */}
        {!["rejected", "suspended"].includes(d.status) && (
          <button
            onClick={() => setShowReward(true)}
            style={{
              width: "100%", padding: "14px 20px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: "linear-gradient(135deg,#F59E0B,#D97706 55%,#B45309)",
              border: "none", borderRadius: 13, color: "#fff",
              fontFamily: "'Barlow',sans-serif", fontWeight: 800, fontSize: 14.5,
              letterSpacing: ".3px", cursor: "pointer",
              boxShadow: "0 8px 24px rgba(217,119,6,.35)",
            }}
          >
            <Gift size={16} strokeWidth={2.2}/> Award Reward
          </button>
        )}

        <button className="btn-ghost" onClick={() => onToast("Notification sent")} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Bell size={14} /> Send Notification
        </button>

        {canSuspend && (
          <button className="btn-danger" onClick={handleSuspend} disabled={suspending} style={{ opacity: suspending ? .6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {suspending ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Suspending…</> : <><Ban size={14} /> Suspend Driver</>}
          </button>
        )}

        <button
          className="btn-danger"
          onClick={handleDelete}
          disabled={deleting}
          style={{
            opacity: deleting ? .6 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            background: "linear-gradient(135deg,#DC2626,#B91C1C)",
            borderColor: "#DC2626"
          }}
        >
          {deleting ? (
            <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Deleting…</>
          ) : (
            <><X size={14} /> Delete Driver Permanently</>
          )}
        </button>
      </div>
    </div>
  );
}
