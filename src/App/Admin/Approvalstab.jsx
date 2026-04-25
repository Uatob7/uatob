// src/App/UaTob/Admin/tabs/ApprovalsTab.jsx
import { useState } from "react";
import {
  Clock, CheckCircle, XCircle, Loader2, ChevronRight, ShieldCheck,
  Mail, Calendar, Car, FileText, AlertTriangle, Inbox, Sparkles,
  ArrowUpRight, MapPin, Phone, Activity,
} from "lucide-react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebase_app } from "@/firebase/config";
import { C } from "@/App/Admin/Tokens";
import { Avatar } from "@/App/Admin/UI";

const functions         = getFunctions(firebase_app, "us-east1");
const callApproveDriver = httpsCallable(functions, "approveDriver");
const callRejectDriver  = httpsCallable(functions, "rejectDriver");

// ─── Helpers ───────────────────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return "—";
  const seconds = ts?.seconds ?? Math.floor(ts / 1000);
  const diff    = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}

function fullName(item) {
  return [item.firstName, item.lastName].filter(Boolean).join(" ").trim() || "Unknown Driver";
}

function getInitials(item) {
  const first = item.firstName?.trim()[0] ?? "?";
  const last  = item.lastName?.trim()[0]  ?? "";
  return (first + last).toUpperCase();
}

function docsComplete(documents = {}) {
  const required = ["insurance", "licenseFront", "licenseBack", "profilePhoto", "registration"];
  const done = required.filter(k => documents[k] === true || documents[`${k}Url`]).length;
  return { done, total: required.length, pct: Math.round((done / required.length) * 100) };
}

// ─── Single Approval Card ──────────────────────────────────────────────────
function ApprovalCard({ item, index, onApprove, onReject }) {
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const docs = docsComplete(item.documents);
  const allDocsIn = docs.done === docs.total;
  const vehicle   = item.vehicle ?? {};
  const contact   = item.contact ?? {};

  const handleApprove = async () => {
    if (approving || rejecting) return;
    setApproving(true);
    try { await onApprove(item); }
    finally { setApproving(false); }
  };

  const handleReject = async () => {
    if (approving || rejecting) return;
    setRejecting(true);
    try { await onReject(item); }
    finally { setRejecting(false); }
  };

  return (
    <div
      className="fade-up"
      style={{
        animationDelay: `${90 + index * 55}ms`, opacity: 0,
        background: "var(--bg-card, #FFFFFF)",
        border: "1px solid var(--border, rgba(0,0,0,.06))",
        borderRadius: 14, overflow: "hidden",
        transition: "border-color .15s, box-shadow .15s, transform .15s",
        position: "relative",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,0,0,.10)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.06)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border, rgba(0,0,0,.06))"; e.currentTarget.style.boxShadow = "none"; }}
    >
      {/* Status accent bar */}
      <div style={{ height: 3, background: "linear-gradient(90deg,#D97706,#F59E0B,#D97706)" }} />

      <div style={{ padding: "16px 16px 14px" }}>

        {/* ── Top row: avatar + name + status pill ── */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
          <Avatar name={getInitials(item)} size={46} colorIdx={index} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#09090B", letterSpacing: "-.02em" }}>{fullName(item)}</div>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "3px 8px", borderRadius: 6,
                background: "#FFFBEB", color: "#92400E",
                border: "1px solid #FDE68A",
                fontSize: 10, fontWeight: 700, letterSpacing: ".02em",
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#D97706", boxShadow: "0 0 5px #D9770688" }} />
                PENDING
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
              <Mail size={11} color="#71717A" />
              <span style={{ fontSize: 12, color: "#52525B", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.email ?? "No email"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {item.submittedAt && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, color: "#71717A", fontWeight: 500 }}>
                  <Calendar size={10} /> {timeAgo(item.submittedAt)}
                </span>
              )}
              {item.currentStep != null && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, color: "#71717A", fontWeight: 500 }}>
                  <Activity size={10} /> Step {item.currentStep}/5
                </span>
              )}
              {contact.city && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, color: "#71717A", fontWeight: 500 }}>
                  <MapPin size={10} /> {contact.city.trim()}{contact.state ? `, ${contact.state}` : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Document progress bar ── */}
        <div style={{
          background: allDocsIn ? "#F0FDF4" : "#FFFBEB",
          border: `1px solid ${allDocsIn ? "#BBF7D0" : "#FDE68A"}`,
          borderRadius: 11, padding: "11px 13px", marginBottom: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <FileText size={12} color={allDocsIn ? "#16A34A" : "#D97706"} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: allDocsIn ? "#15803D" : "#92400E" }}>
                Documents {docs.done}/{docs.total}
              </span>
            </div>
            <span style={{ fontFamily: "monospace", fontSize: 10.5, fontWeight: 700, color: allDocsIn ? "#16A34A" : "#D97706" }}>{docs.pct}%</span>
          </div>
          <div style={{ height: 5, background: allDocsIn ? "#BBF7D0" : "#FDE68A", borderRadius: 99, overflow: "hidden" }}>
            <div style={{
              width: `${docs.pct}%`, height: "100%",
              background: allDocsIn
                ? "linear-gradient(90deg,#22C55E,#16A34A)"
                : "linear-gradient(90deg,#F59E0B,#D97706)",
              borderRadius: 99,
              transition: "width .5s cubic-bezier(.34,1.56,.64,1)",
            }} />
          </div>
        </div>

        {/* ── Vehicle info (if available) ── */}
        {(vehicle.make || vehicle.model) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "9px 12px", background: "#F9FAFB", border: "1px solid rgba(0,0,0,.06)", borderRadius: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "#EFF6FF", border: "1px solid #DBEAFE", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Car size={13} color="#2563EB" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#09090B", textTransform: "capitalize" }}>
                {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}
              </div>
              <div style={{ fontSize: 10.5, color: "#71717A", textTransform: "capitalize", fontWeight: 500 }}>
                {[vehicle.color, vehicle.plate?.toUpperCase()].filter(Boolean).join(" · ") || "Vehicle pending"}
              </div>
            </div>
          </div>
        )}

        {/* ── Action buttons ── */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleReject}
            disabled={approving || rejecting}
            style={{
              flex: 1, padding: "11px 14px", borderRadius: 11,
              border: "1px solid #FECACA",
              background: "#fff", color: "#DC2626",
              fontFamily: "inherit", fontSize: 13, fontWeight: 700,
              cursor: approving || rejecting ? "not-allowed" : "pointer",
              opacity: approving || rejecting ? .6 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: "all .15s",
            }}
            onMouseEnter={e => { if (!approving && !rejecting) { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.borderColor = "#FCA5A5"; } }}
            onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#FECACA"; }}
          >
            {rejecting
              ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Rejecting…</>
              : <><XCircle size={13} /> Reject</>
            }
          </button>
          <button
            onClick={handleApprove}
            disabled={approving || rejecting}
            style={{
              flex: 1.4, padding: "11px 14px", borderRadius: 11, border: "none",
              background: "linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)",
              color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
              cursor: approving || rejecting ? "not-allowed" : "pointer",
              opacity: approving || rejecting ? .8 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              boxShadow: "0 4px 14px rgba(22,163,74,.3)",
              transition: "all .15s",
            }}
            onMouseEnter={e => { if (!approving && !rejecting) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(22,163,74,.4)"; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 14px rgba(22,163,74,.3)"; }}
          >
            {approving
              ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Approving…</>
              : <><CheckCircle size={13} /> Approve Driver</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ApprovalsTab ─────────────────────────────────────────────────────
export function ApprovalsTab({ allApprovals = [], onToast }) {

  const approve = async (item) => {
    try {
      await callApproveDriver({ driverUid: item.id });
      onToast?.(`✅ ${item.firstName ?? "Driver"} approved`);
    } catch (err) {
      console.error("approve error:", err);
      onToast?.("❌ Failed to approve");
    }
  };

  const reject = async (item) => {
    try {
      await callRejectDriver({ driverUid: item.id });
      onToast?.(`${item.firstName ?? "Driver"} rejected`);
    } catch (err) {
      console.error("reject error:", err);
      onToast?.("❌ Failed to reject");
    }
  };

  // Compute aggregate stats
  const docsReady = allApprovals.filter(a => {
    const d = docsComplete(a.documents);
    return d.done === d.total;
  }).length;
  const docsMissing = allApprovals.length - docsReady;
  const oldestPending = allApprovals.reduce((oldest, a) => {
    const ms = a.submittedAt?.seconds ? a.submittedAt.seconds * 1000 : 0;
    if (!ms) return oldest;
    return !oldest || ms < oldest ? ms : oldest;
  }, null);

  return (
    <div style={{ padding: "0 16px 24px" }}>
      <style>{`
        @keyframes spin   { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes pulse  { 0%,100% { opacity:1 } 50% { opacity:.5 } }
      `}</style>

      {/* ── Hero stats card ── */}
      <div className="fade-up" style={{
        background: allApprovals.length > 0
          ? "linear-gradient(135deg,#0F172A,#1E293B)"
          : "linear-gradient(135deg,#F0FDF4,#DCFCE7,#F0FDF4)",
        borderRadius: 18, padding: "20px 18px",
        marginBottom: 14, position: "relative", overflow: "hidden",
        animationDelay: "40ms", opacity: 0,
        border: allApprovals.length > 0 ? "none" : "1.5px solid rgba(22,163,74,.28)",
        boxShadow: allApprovals.length > 0 ? "0 8px 32px rgba(0,0,0,.2)" : "0 4px 20px rgba(22,163,74,.1)",
      }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: allApprovals.length > 0 ? "rgba(217,119,6,.08)" : "rgba(22,163,74,.06)", pointerEvents: "none" }} />

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, position: "relative" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
              {allApprovals.length > 0 ? (
                <>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B", animation: "pulse 1.5s ease-in-out infinite", boxShadow: "0 0 8px rgba(245,158,11,.6)" }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.6)", letterSpacing: ".08em" }}>AWAITING REVIEW</span>
                </>
              ) : (
                <>
                  <Sparkles size={11} color="#16A34A" />
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#15803D", letterSpacing: ".08em" }}>QUEUE CLEAR</span>
                </>
              )}
            </div>
            <div style={{
              fontSize: 38, fontWeight: 800,
              color: allApprovals.length > 0 ? "#fff" : "#09090B",
              letterSpacing: "-.03em", lineHeight: 1, fontFeatureSettings: "'tnum'",
            }}>
              {allApprovals.length}
            </div>
            <div style={{ fontSize: 12, color: allApprovals.length > 0 ? "rgba(255,255,255,.55)" : "#52525B", marginTop: 4, fontWeight: 500 }}>
              {allApprovals.length === 1 ? "Driver application pending" : "Driver applications pending"}
            </div>
          </div>

          <div style={{
            width: 44, height: 44, borderRadius: 13,
            background: allApprovals.length > 0 ? "rgba(245,158,11,.15)" : "rgba(22,163,74,.15)",
            border: `1px solid ${allApprovals.length > 0 ? "rgba(245,158,11,.3)" : "rgba(22,163,74,.3)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            {allApprovals.length > 0
              ? <ShieldCheck size={20} color="#F59E0B" />
              : <CheckCircle size={20} color="#16A34A" />
            }
          </div>
        </div>

        {/* Inline stats */}
        {allApprovals.length > 0 && (
          <div style={{ display: "flex", gap: 8, position: "relative" }}>
            {[
              { label: "Docs ready",  value: docsReady,                                        color: "#22C55E" },
              { label: "Docs missing",value: docsMissing,                                      color: "#F59E0B" },
              { label: "Oldest",      value: oldestPending ? timeAgo({ seconds: oldestPending / 1000 }) : "—", color: "#60A5FA" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                flex: 1, background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.08)",
                borderRadius: 10, padding: "9px 11px",
              }}>
                <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.4)", fontWeight: 700, letterSpacing: ".04em", marginBottom: 3, textTransform: "uppercase" }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color, letterSpacing: "-.02em", fontFeatureSettings: "'tnum'" }}>{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Empty state ── */}
      {allApprovals.length === 0 && (
        <div className="fade-up" style={{
          background: "#FFFFFF",
          border: "1px solid rgba(0,0,0,.06)",
          borderRadius: 14, padding: "48px 24px", textAlign: "center",
          animationDelay: "120ms", opacity: 0,
        }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "#F0FDF4", border: "1px solid #BBF7D0", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircle size={26} color="#16A34A" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#09090B", marginBottom: 4, letterSpacing: "-.01em" }}>All caught up</div>
          <div style={{ fontSize: 12.5, color: "#71717A", fontWeight: 500 }}>No pending driver applications right now.</div>
        </div>
      )}

      {/* ── Section header ── */}
      {allApprovals.length > 0 && (
        <div className="fade-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, animationDelay: "70ms", opacity: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#09090B", letterSpacing: "-.01em" }}>Pending Applications</span>
            <span style={{
              padding: "2px 8px", borderRadius: 100,
              background: "#FFFBEB", border: "1px solid #FDE68A",
              fontSize: 10, fontWeight: 700, color: "#92400E", letterSpacing: ".02em",
            }}>
              {allApprovals.length}
            </span>
          </div>
        </div>
      )}

      {/* ── Approval cards ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {allApprovals.map((item, i) => (
          <ApprovalCard
            key={item.id}
            item={item}
            index={i}
            onApprove={approve}
            onReject={reject}
          />
        ))}
      </div>
    </div>
  );
}