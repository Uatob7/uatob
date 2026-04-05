0
: 
createdAt
: 
Timestamp {seconds: 1775337043, nanoseconds: 944000000}
currentStep
: 
1
email
: 
"tony200795@gmail.com"
firstName
: 
"Anthony"
id
: 
"3RjAcYUdDdVw6C59ejuQiqaWaI83"
lastName
: 
"eugene"
status
: 
"in_progress"
uid
: 
"3RjAcYUdDdVw6C59ejuQiqaWaI83"
updatedAt
: 
Timestamp {seconds: 1775337043, nanoseconds: 944000000}
[[Prototype]]
: 
Object
1
: 
{id: '5IUWVmreHsfcdANuAGiP3x1yOKj1', contact: {…}, uid: '5IUWVmreHsfcdANuAGiP3x1yOKj1', lastName: 'Herbert ', firstName: 'Jeffery ', …}
2
: 
{id: 'Rwe7IjW5sRaZNb4dJkH9Vx2Uc2H3', email: 'Favored1now@outlook.com', currentStep: 1, createdAt: Timestamp, status: 'in_progress', …}
3
: 
{id: 'zW6ixfoAC7bdHumBXEXAnQlKkIF2', uid: 'zW6ixfoAC7bdHumBXEXAnQlKkIF2', updatedAt: Timestamp, firstName: 'Fr', lastName: 'Fff', …}
length
: 
4
[[Prototype]]
: 
Array(0


// src/App/UaTob/Admin/tabs/ApprovalsTab.jsx

import { useState } from "react";
import { Clock, CheckCircle, XCircle } from "lucide-react";
import { C } from '@/App/Admin/Tokens';
import { Avatar, EmptyState } from '@/App/Admin/UI';

// Replace with a Firestore query:
//   collection("drivers").where("status","==","pending").orderBy("createdAt","desc")
const MOCK_PENDING = [
  { id:"p001", name:"Aaliyah J.", type:"New driver",       time:"2h ago",  avatar:"AJ" },
  { id:"p002", name:"Marcus Obi", type:"Vehicle update",   time:"4h ago",  avatar:"MO" },
  { id:"p003", name:"Rosa C.",    type:"New driver",       time:"1d ago",  avatar:"RC" },
  { id:"p004", name:"Tyler W.",   type:"Document upload",  time:"1d ago",  avatar:"TW" },
  { id:"p005", name:"Farai N.",   type:"New driver",       time:"2d ago",  avatar:"FN" },
  { id:"p006", name:"Juno Park",  type:"Background check", time:"3d ago",  avatar:"JP" },
];

export const MOCK_PENDING_COUNT = MOCK_PENDING.length;

export function ApprovalsTab({approvals, onToast }) {
  const [items, setItems] = useState(MOCK_PENDING);

  const approve = id => {
    const it = items.find(i => i.id === id);
    setItems(p => p.filter(i => i.id !== id));
    onToast(`✅ ${it?.name} approved`);
  };

  const reject = id => {
    const it = items.find(i => i.id === id);
    setItems(p => p.filter(i => i.id !== id));
    onToast(`❌ ${it?.name} rejected`);
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
        {items.map((item, i) => (
          <div
            key={item.id}
            className="card fade-up"
            style={{ padding: "16px", animationDelay: `${90 + i * 55}ms`, opacity: 0, boxShadow: "0 1px 5px rgba(0,0,0,.04)" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <Avatar name={item.avatar} size={40} colorIdx={i} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{item.type} · {item.time}</div>
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