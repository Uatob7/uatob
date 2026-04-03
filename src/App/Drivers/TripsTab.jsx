import { Car, Star } from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';

const TYPE_COLOR = {
  standard: C.blue,
  xl:       "#8B5CF6",
  premium:  "#F59E0B",
};

function formatTime(ts) {
  if (!ts) return "";
  const date = ts instanceof Date ? ts : ts.toDate?.() ?? new Date(ts);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function shortenAddress(addr = "") {
  // "2382 Locke Avenue, Orlando, FL, USA" → "2382 Locke Ave"
  return addr.split(",")[0] ?? addr;
}

export default function TripsTab({ completedRides = [], online }) {
  const accentColor = online ? C.onlineGreen : C.offlineInk;

  return (
    <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, animation: "slideUp .38s ease-out forwards" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="condensed" style={{ fontSize: 28, fontWeight: 900, color: C.text, letterSpacing: "-0.5px" }}>
          Trip History
        </div>
        <div style={{
          background: online ? "rgba(22,163,74,.1)" : C.surfaceAlt,
          border:     online ? "1px solid rgba(22,163,74,.25)" : `1px solid ${C.border}`,
          borderRadius: 100, padding: "5px 13px",
        }}>
          <span className="condensed" style={{ fontSize: 12, fontWeight: 700, color: online ? accentColor : C.textMid, letterSpacing: ".5px" }}>
            {completedRides.length} TRIPS
          </span>
        </div>
      </div>

      {/* List */}
      {completedRides.length === 0 ? (
        <div className="card" style={{ padding: "40px 20px", textAlign: "center" }}>
          <Car size={28} color={C.textDim} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14, color: C.textDim, fontWeight: 600 }}>No completed trips yet</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {completedRides.map((trip, i) => {
            const color = TYPE_COLOR[trip.rideType] ?? C.blue;
            return (
              <div
                key={trip.id}
                style={{
                  padding:      "16px 20px",
                  borderBottom: i < completedRides.length - 1 ? `1px solid ${C.border}` : "none",
                  display:      "flex", gap: 14, alignItems: "center",
                  cursor:       "pointer", transition: "background .15s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                {/* Icon */}
                <div style={{
                  width: 42, height: 42,
                  background:   color + "12",
                  border:       `1px solid ${color}30`,
                  borderRadius: 13,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Car size={18} color={color} />
                </div>

                {/* Route */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span
                      className="badge-chip"
                      style={{ background: color + "15", border: `1px solid ${color}30`, color }}
                    >
                      {trip.rideLabel ?? trip.rideType}
                    </span>
                    <span style={{ fontSize: 11, color: C.textDim, fontWeight: 500 }}>
                      {formatTime(trip.completedAt)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: C.textDim, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {shortenAddress(trip.pickup)} → {shortenAddress(trip.dropoff)}
                  </div>
                </div>

                {/* Payout */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div className="mono" style={{ fontSize: 14.5, fontWeight: 700, color: accentColor }}>
                    ${(trip.driverPayout ?? trip.fareTotal ?? 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 11, color: C.textDim, fontWeight: 500, marginTop: 2 }}>
                    {trip.tripDistanceMiles ? `${trip.tripDistanceMiles} mi` : ""}
                    {trip.tripDurationMin  ? ` · ${trip.tripDurationMin} min` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ textAlign: "center", padding: "4px 0" }}>
        <span style={{ fontSize: 13, color: C.textDim, fontWeight: 600, cursor: "pointer" }}>
          Load more history
        </span>
      </div>
    </div>
  );
}