import { ToggleLeft, ToggleRight } from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';

/**
 * Online/offline status card with toggle button.
 *
 * Props:
 *   online      — bool
 *   activeTrip  — current trip object or null
 *   tripStage   — "idle" | "enroute" | "arrived" | "in_progress" | "completed"
 *   onToggle    — called when the toggle button is pressed
 */
export default function StatusCard({ online, activeTrip, tripStage, onToggle }) {
  return (
    <div style={{
      background: online
        ? "linear-gradient(135deg,#F0FDF4 0%,#DCFCE7 50%,#F0FDF4 100%)"
        : C.surface,
      border: online ? "1.5px solid rgba(22,163,74,.3)" : `1px solid ${C.border}`,
      borderRadius: 22, padding: "22px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      transition: "all .4s", position: "relative", overflow: "hidden",
      boxShadow: online ? "0 4px 24px rgba(22,163,74,.1)" : `0 2px 12px ${C.shadow}`,
    }}>
      {/* Scan-line animation when online */}
      {online && (
        <div style={{
          position: "absolute", left: 0, right: 0, height: 1,
          background: "linear-gradient(90deg,transparent,rgba(22,163,74,.3),transparent)",
          animation: "scanLine 4s ease-in-out infinite",
          pointerEvents: "none",
        }}/>
      )}

      <div>
        <div className="lbl" style={{ color: online ? C.onlineGreen : C.textDim, marginBottom: 6 }}>
          {online ? (activeTrip ? "◆ ON TRIP" : "◆ ACTIVE") : "○ OFFLINE"}
        </div>
        <div className="condensed" style={{ fontSize: 28, fontWeight: 900, color: online ? C.text : C.textDim, letterSpacing: "-0.5px", lineHeight: 1.05 }}>
          {online
            ? (activeTrip ? `Trip · ${tripStage.replace("_", " ")}` : "Waiting for requests")
            : "You're Offline"}
        </div>
        {online && !activeTrip && (
          <div style={{ fontSize: 12.5, color: C.onlineGreen, marginTop: 5, fontWeight: 600 }}>
            Scanning for nearby riders...
          </div>
        )}
      </div>

      {/* Only show toggle when not on a trip */}
      {!activeTrip && (
        <button
          onClick={onToggle}
          style={{
            background: online
              ? "rgba(22,163,74,.1)"
              : "linear-gradient(135deg,#111827,#374151 55%,#111827)",
            border: online ? "1.5px solid rgba(22,163,74,.35)" : "none",
            borderRadius: 100, padding: "13px 22px",
            color: online ? C.onlineGreen : "#FFFFFF",
            fontFamily: "'Barlow',sans-serif", fontWeight: 800, fontSize: 14,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
            transition: "all .3s",
            boxShadow: online ? "none" : "0 6px 20px rgba(0,0,0,.2)",
            animation: online ? "greenRing 2.5s ease-in-out infinite" : "none",
          }}
        >
          {online ? <ToggleRight size={18}/> : <ToggleLeft size={18}/>}
          {online ? "Online" : "Go Online"}
        </button>
      )}
    </div>
  );
}