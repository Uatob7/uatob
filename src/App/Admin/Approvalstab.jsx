// src/App/UaTob/Admin/tabs/ApprovalsTab.jsx
import { Clock, CheckCircle, XCircle } from "lucide-react";
import { C } from "@/App/Admin/Tokens";
import { Avatar, EmptyState } from "@/App/Admin/UI";

import { getFirestore, doc, updateDoc } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function ApprovalsTab({ approvals = [], onToast }) {
  // Data is owned by the parent dashboard (usePendingApprovals hook).
  // This component only handles approve/reject write actions.

  const approve = async (item) => {
    try {
      await updateDoc(doc(db, "Drivers", item.id), {
        status: "approved",
        updatedAt: new Date(),
      });
      onToast?.(`✅ ${item.firstName} approved`);
    } catch (err) {
      console.error("approve error:", err);
      onToast?.("❌ Failed to approve");
    }
  };

  const reject = async (item) => {
    try {
      await updateDoc(doc(db, "Drivers", item.id), {
        status: "rejected",
        updatedAt: new Date(),
      });
      onToast?.(`${item.firstName} rejected`);
    } catch (err) {
      console.error("reject error:", err);
      onToast?.("❌ Failed to reject");
    }
  };

  // Safe initials — handles missing or whitespace-only lastName
  const getInitials = (item) => {
    const first = item.firstName?.trim()[0] ?? "?";
    const last  = item.lastName?.trim()[0]  ?? "";
    return (first + last).toUpperCase();
  };

  const fullName = (item) =>
    [item.firstName, item.lastName].filter(Boolean).join(" ").trim() || "Unknown Driver";

  return (
    <div style={{ padding: "0 16px 16px" }}>

      {/* Pending count banner */}
      <div
        className="card fade-up"
        style={{ padding: "14px 16px", marginBottom: 16, animationDelay: "40ms", opacity: 0, boxShadow: "0 1px 6px rgba(0,0,0,.05)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: C.amberGlow, border: `1.5px solid ${C.amber}28`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Clock size={17} color={C.amber} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>
              {approvals.length}{" "}
              <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>pending</span>
            </div>
            <div style={{ fontSize: 11, color: C.textMuted }}>Review required</div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {approvals.length === 0 && (
        <EmptyState icon={CheckCircle} title="All caught up!" sub="No pending approvals" color={C.green} />
      )}

      {/* Approval cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {approvals.map((item, i) => (
          <div
            key={item.id}
            className="card fade-up"
            style={{ padding: 16, animationDelay: `${90 + i * 55}ms`, opacity: 0, boxShadow: "0 1px 5px rgba(0,0,0,.04)" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <Avatar name={getInitials(item)} size={40} colorIdx={i} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{fullName(item)}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>
                  {item.email ?? "No email"}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                  {item.currentStep != null ? `Step ${item.currentStep} of onboarding` : "Pending approval"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-success" style={{ flex: 1 }} onClick={() => approve(item)}>
                <CheckCircle size={14} /> Approve
              </button>
              <button className="btn-danger" style={{ flex: 1 }} onClick={() => reject(item)}>
                <XCircle size={14} /> Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
