
[{…}]
0
: 
createdAt
: 
Timestamp {seconds: 1775401178, nanoseconds: 946000000}
driverPayout
: 
9.62
dropoff
: 
"2382 Locke Avenue, Orlando, FL, USA"
dropoffCity
: 
"Orlando"
dropoffLat
: 
28.5730545
dropoffLng
: 
-81.4696329
dropoffZip
: 
"32818"
fareBreakdown
: 
{distance: 7.46, time: 2.88, bookingFee: 0.99, baseFare: 1.5}
fareTotal
: 
12.83
id
: 
"9lIb5VIfwKieH9Z0hKjZ"
paymentIntentId
: 
"pi_3TIs9GJhpOy6wtDq1ff5Lgvr"
paymentMethod
: 
"cashapp"
paymentStatus
: 
"succeeded"
payoutStatus
: 
"pending"
pickup
: 
"3050 C.R. Smith St, Orlando, FL 32805, USA"
pickupCity
: 
"Orlando"
pickupLat
: 
28.5335484
pickupLng
: 
-81.415593
pickupZip
: 
"32805"
platformFee
: 
3.21
rideLabel
: 
"Economy"
rideType
: 
"economy"
status
: 
"completed"
surgeMultiplier
: 
1
tripDistanceMiles
: 
6.22
tripDurationMin
: 
16
uid
: 
"6rIXzLa8kaQhxVdkVxPNVxMaWYV2"
updatedAt
: 
Timestamp {seconds: 1775401178, nanoseconds: 946000000}
[[Prototype]]
: 
Object
length
: 
1
[[Prototype]]
: 
Array(0)


import { useState } from "react";
import {
  Activity, DollarSign, Car, Shield,
  RefreshCw, Filter,
} from "lucide-react";
import { C } from '@/App/Admin/Tokens';
import { StatCard, SectionHeader, Avatar, StatusPill } from '@/App/Admin/UI';

// ── Live rides come from Firestore in production.
// Shape mirrors the Firestore `rides` document:
//   pickup, dropoff, fareTotal, status, rideLabel, uid, createdAt, …
// For now we keep mock data here; swap for a useRides() hook later.
const MOCK_RIDES = [
  { id:"r001", rider:"Marcus W.",  driver:"Jerome T.", from:"Downtown",  to:"Airport",        fare:38.50, status:"in_progress",     time:"2m ago"  },
  { id:"r002", rider:"Priya M.",   driver:"Leon A.",   from:"Westside",  to:"Midtown",        fare:14.20, status:"searching_driver", time:"1m ago"  },
  { id:"r003", rider:"Carlos D.",  driver:"Kira N.",   from:"North Park",to:"Harbor",         fare:22.80, status:"completed",        time:"8m ago"  },
  { id:"r004", rider:"Anya S.",    driver:"—",         from:"Oak Hills", to:"University",     fare:11.00, status:"searching_driver", time:"30s ago" },
  { id:"r005", rider:"Derek F.",   driver:"Tomás R.",  from:"Eastgate",  to:"Convention Ctr", fare:19.60, status:"arrived",          time:"4m ago"  },
];

export function HomeTab({ liveRides, onToast }) {

  console.log(liveRides)
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); onToast("Data refreshed"); }, 1100);
  };

  const activeCount = MOCK_RIDES.filter(r => ["in_progress","arrived"].includes(r.status)).length;
  const searchCount = MOCK_RIDES.filter(r => r.status === "searching_driver").length;

  return (
    <div style={{ padding: "0 16px 16px" }}>

      {/* Live status bar */}
      <div className="card fade-up" style={{ padding: "12px 16px", marginBottom: 16, animationDelay: "40ms", opacity: 0, boxShadow: "0 1px 6px rgba(0,0,0,.05)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div className="live-dot" />
              <span style={{ fontSize: 12, fontWeight: 700 }}>{activeCount} active rides</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div className="amber-dot" />
              <span style={{ fontSize: 12, fontWeight: 700 }}>{searchCount} searching</span>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, display: "flex" }}
          >
            <RefreshCw size={15} style={{ animation: refreshing ? "spinAnim 1s linear infinite" : "none" }} />
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <StatCard label="Total Rides"    value={1284} delta={12.4} icon={Activity}   color={C.blue}  delay={80}  />
        <StatCard label="Active Drivers" value={47}   delta={3}    icon={Car}        color={C.green} delay={130} />
        <StatCard label="Revenue Today"  value={9820} delta={8.1}  icon={DollarSign} color={C.amber} delay={180} />
        <StatCard label="Approvals"      value={6}    delta={-2}   icon={Shield}     color={C.red}   delay={230} />
      </div>

      {/* Live rides list */}
      <SectionHeader
        title="Live Rides"
        action={
          <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: 11 }}>
            <Filter size={11} /> Filter
          </button>
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {MOCK_RIDES.map((ride, i) => (
          <RideCard key={ride.id} ride={ride} delay={280 + i * 55} />
        ))}
      </div>
    </div>
  );
}

function RideCard({ ride, delay }) {
  return (
    <div
      className="card fade-up"
      style={{ padding: "14px 16px", animationDelay: `${delay}ms`, opacity: 0, boxShadow: "0 1px 5px rgba(0,0,0,.04)" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={ride.rider} size={34} colorIdx={1} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{ride.rider}</div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>{ride.driver}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
          <StatusPill status={ride.status} />
          <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: "#16A34A" }}>${ride.fare.toFixed(2)}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#EEF1EE", borderRadius: 8, padding: "7px 10px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, letterSpacing: ".5px", marginBottom: 2 }}>FROM → TO</div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{ride.from} → {ride.to}</div>
        </div>
        <div style={{ fontSize: 10, color: "#9CA3AF" }}>{ride.time}</div>
      </div>
    </div>
  );
}