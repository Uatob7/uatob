import { useState } from "react";
import { Clock, CheckCircle, XCircle, FileText, Car, User } from "lucide-react";
import { C } from '@/App/Admin/Tokens';
import { Avatar, EmptyState } from '@/App/Admin/UI';

function timeAgo(ts) {
  if (!ts) return "—";
  const seconds = ts?.seconds ?? Math.floor(ts / 1000);
  const diff = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fullName(d) {
  return `${d.firstName?.trim() ?? ""} ${d.lastName?.trim() ?? ""}`.trim() || "Unknown";
}

// Determine what type of approval this is based on the doc's fields
function approvalType(driver) {
  if (driver.status === "pending") return "New Driver";
  if (driver.documents && Object.values(driver.documents).some(Boolean)) return "Document Upload";
  if (driver.vehicle) return "Vehicle Update";
  return "Application";
}

function docsProgress(documents = {}) {
  const required = ["insurance", "licenseFront", "profilePhoto", "registration"];
  const done = required.filter(k => documents[k] === true).length;
  return { done, total: required.length };
}

export function ApprovalsTab({ approvals = [], onToast }) {
  const [dismissed, setDismissed] = useState(new Set());

  const items = approvals.filter(
    d => (d.status === "pending" || d.status === "in_progress") && !dismissed.has(d.id)
  );

  const approve = driver => {
    setDismissed(prev => new Set([...prev, driver.id]));
    onToast(`✅ ${fullName(driver)} approved`);
    // TODO: call your approveDriver Cloud Function here
  };

  const reject = driver => {
    setDismissed(prev => new Set([...prev, driver.id]));
    onToast(`❌ ${fullName(driver)} rejected`);
    // TODO: call your rejectDriver Cloud Function here
  };

  return (
    <div style={{ padding: "0 16px 16px" }}>
      {/* Pending count banner */}
      <div className="card fade-up" style={{ padding: "14px 16px", marginBottom: 16, animationDelay: "40ms", opacity: 0, boxShadow: "0 1px 6px rgba(0,0,0,.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: C.amberGlow, border: `1.5px solid ${C.amber}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Clock size={17} color={C.amber} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>
              {items.length}{" "}
              <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>pending</span>
            </div>
            <div style={{ fontSize: 11, color: C.textMuted }}>Review required</div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <EmptyState icon={CheckCircle} title="All caught up!" sub="No pending approvals" color={C.green} />
      )}

      {/* Approval cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((driver, i) => {
          const name    = fullName(driver);
          const type    = approvalType(driver);
          const docs    = docsProgress(driver.documents);
          const vehicle = driver.vehicle;
          const contact = driver.contact;

          return (
            <div
              key={driver.id}
              className="card fade-up"
              style={{ padding: "16px", animationDelay: `${90 + i * 55}ms`, opacity: 0, boxShadow: "0 1px 5px rgba(0,0,0,.04)" }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <Avatar name={name} size={40} colorIdx={i} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{name}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>
                    {type} · {timeAgo(driver.createdAt)}
                  </div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                  background: C.amberGlow, color: C.amber,
                  padding: "3px 8px", borderRadius: 6, letterSpacing: ".4px",
                }}>
                  {driver.status}
                </span>
              </div>

              {/* Info rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>

                {/* Email */}
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <User size={11} color={C.textDim} />
                  <span style={{ fontSize: 12, color: C.textMuted }}>{driver.email ?? "—"}</span>
                </div>

                {/* Docs progress */}
                {driver.documents && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <FileText size={11} color={C.textDim} />
                    <span style={{ fontSize: 12, color: docs.done === docs.total ? C.green : C.amber, fontWeight: 600 }}>
                      {docs.done}/{docs.total} documents uploaded
                    </span>
                  </div>
                )}

                {/* Vehicle */}
                {vehicle?.make && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <Car size={11} color={C.textDim} />
                    <span style={{ fontSize: 12, color: C.textMuted }}>
                      {vehicle.color?.trim()} {vehicle.make} {vehicle.model?.trim()} · {vehicle.plate}
                    </span>
                  </div>
                )}

                {/* Location */}
                {contact?.city && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 11, color: C.textDim }}>📍</span>
                    <span style={{ fontSize: 12, color: C.textMuted }}>
                      {contact.city.trim()}, {contact.state} {contact.zip}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-success" style={{ flex: 1 }} onClick={() => approve(driver)}>
                  <CheckCircle size={14} /> Approve
                </button>
                <button className="btn-danger" style={{ flex: 1 }} onClick={() => reject(driver)}>
                  <XCircle size={14} /> Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
Key changes:
Data — MOCK_PENDING gone. Reads from approvals prop, filtering to pending or in_progress status. Dismissed items are tracked locally in a Set until you wire up the real Cloud Functions.
approvalType() — infers the card label (New Driver / Document Upload / Vehicle Update) from what fields are present on the doc.
Info rows — each card now shows email, docs progress (e.g. 3/4 documents uploaded in amber/green), vehicle details if present, and city/state/zip from contact.
docsProgress() — checks the 4 required fields and colors the count amber if incomplete, green if all done.
TODOs marked — approve and reject handlers have comments for where to call your approveDriver/rejectDriver Cloud Functions when ready.