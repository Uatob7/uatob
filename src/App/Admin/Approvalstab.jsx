// src/App/UaTob/Admin/tabs/ApprovalsTab.jsx
import { useEffect, useState } from "react";
import { Clock, CheckCircle, XCircle } from "lucide-react";
import { C } from "@/App/Admin/Tokens";
import { Avatar, EmptyState } from "@/App/Admin/UI";

import { getFirestore, collection, query, where, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function ApprovalsTab({ onToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Firestore query: fetch drivers with status "pending", ordered by creation date
    const q = query(
      collection(db, "drivers"),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, snapshot => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setItems(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const approve = async id => {
    try {
      const it = items.find(i => i.id === id);
      if (!it) return;

      // Update Firestore
      await updateDoc(doc(db, "drivers", id), { status: "approved", updatedAt: new Date() });
      setItems(p => p.filter(i => i.id !== id));
      onToast(`✅ ${it.firstName} ${it.lastName} approved`);
    } catch (err) {
      console.error(err);
      onToast(`❌ Failed to approve`);
    }
  };

  const reject = async id => {
    try {
      const it = items.find(i => i.id === id);
      if (!it) return;

      // Update Firestore
      await updateDoc(doc(db, "drivers", id), { status: "rejected", updatedAt: new Date() });
      setItems(p => p.filter(i => i.id !== id));
      onToast(`❌ ${it.firstName} ${it.lastName} rejected`);
    } catch (err) {
      console.error(err);
      onToast(`❌ Failed to reject`);
    }
  };

  if (loading) return <div style={{ padding: 16 }}>Loading approvals...</div>;

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
              {items.length} <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>pending</span>
            </div>
            <div style={{ fontSize: 11, color: C.textMuted }}>Review required</div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {items.length === 0 && <EmptyState icon={CheckCircle} title="All caught up!" sub="No pending approvals" color={C.green} />}

      {/* Approval cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item, i) => (
          <div
            key={item.id}
            className="card fade-up"
            style={{ padding: "16px", animationDelay: `${90 + i * 55}ms`, opacity: 0, boxShadow: "0 1px 5px rgba(0,0,0,.04)" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <Avatar name={item.firstName[0] + item.lastName[0]} size={40} colorIdx={i} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{item.firstName} {item.lastName}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{item.currentStep ? `Step ${item.currentStep}` : "Pending approval"}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-success" style={{ flex: 1 }} onClick={() => approve(item.id)}>
                <CheckCircle size={14} /> Approve
              </button>
              <button className="btn-danger" style={{ flex: 1 }} onClick={() => reject(item.id)}>
                <XCircle size={14} /> Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}