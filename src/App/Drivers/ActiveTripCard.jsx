import { ChevronRight, Check, Phone, MessageSquare, Navigation } from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';

/**
 * Shows the active trip state machine: enroute → arrived → in_progress → completed.
 *
 * Props:
 *   activeTrip      — trip object
 *   tripStage       — "enroute" | "arrived" | "in_progress" | "completed"
 *   tripStageColor  — hex string matching the stage
 *   tripBtnLabel    — label for the advance button
 *   onAdvance       — called to move to the next stage
 */
export default function ActiveTripCard({ activeTrip, tripStage, tripStageColor, tripBtnLabel, onAdvance }) {
  if (!activeTrip || tripStage === "idle") return null;

  const STAGES = ["enroute", "arrived", "in_progress"];

  const stageLabel = {
    enroute:     "En Route to Pickup",
    arrived:     "Arrived at Pickup",
    in_progress: "Trip in Progress",
    completed:   "Complete",
  }[tripStage];

  return (
    <div style={{
      background: C.surface,
      border: `1.5px solid ${tripStageColor}35`,
      borderRadius: 22, padding: "22px",
      boxShadow: `0 4px 24px ${tripStageColor}12`,
      animation: "scaleIn .38s ease-out",
    }}>
      {/* Rider + fare header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div className="lbl" style={{ color: tripStageColor }}>{stageLabel}</div>
          <div className="condensed" style={{ fontSize: 26, fontWeight: 900, color: C.text, letterSpacing: "-0.5px" }}>
            {activeTrip.rider}
          </div>
        </div>
        <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: tripStageColor, letterSpacing: "-0.5px" }}>
          {activeTrip.fare}
        </div>
      </div>

      {/* Stage progress bar */}
      <div style={{ display: "flex", gap: 5, marginBottom: 18 }}>
        {STAGES.map(s => {
          const isActive = STAGES.indexOf(tripStage) >= STAGES.indexOf(s);
          return (
            <div
              key={s}
              className="trip-stage-bar"
              style={{
                background: isActive ? tripStageColor : C.border,
                boxShadow: isActive && s === tripStage ? `0 0 8px ${tripStageColor}55` : "none",
              }}
            />
          );
        })}
      </div>

      {/* Route pill */}
      <div className="route-pill" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, paddingTop: 2 }}>
            <div style={{ width: 8, height: 8, background: C.blue, borderRadius: "50%" }}/>
            <div style={{ width: 1, height: 22, background: C.border }}/>
            <div style={{ width: 8, height: 8, background: C.onlineGreen, borderRadius: 2, transform: "rotate(45deg)" }}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: C.textDim, fontWeight: 700, marginBottom: 2, letterSpacing: ".8px", textTransform: "uppercase" }}>Pickup</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>{activeTrip.pickup}</div>
            <div style={{ fontSize: 11, color: C.textDim, fontWeight: 700, marginBottom: 2, letterSpacing: ".8px", textTransform: "uppercase" }}>Drop-off</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{activeTrip.dropoff}</div>
          </div>
        </div>
      </div>

      {/* Action buttons (call / message / navigate) */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[
          { icon: Phone,         label: "Call",     c: C.blue         },
          { icon: MessageSquare, label: "Message",  c: C.purple       },
          { icon: Navigation,    label: "Navigate", c: C.onlineGreen  },
        ].map(a => (
          <button
            key={a.label}
            style={{ flex: 1, background: a.c + "12", border: `1px solid ${a.c}28`, borderRadius: 13, padding: "11px 6px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
          >
            <a.icon size={16} color={a.c}/>
            <span style={{ fontSize: 10, fontWeight: 700, color: a.c, letterSpacing: ".5px", fontFamily: "'Barlow Condensed',sans-serif" }}>
              {a.label}
            </span>
          </button>
        ))}
      </div>

      {/* Advance / Completed CTA */}
      {tripStage !== "completed" ? (
        <button
          onClick={onAdvance}
          style={{
            width: "100%", padding: "17px 24px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: `linear-gradient(135deg,${tripStageColor},${tripStageColor}bb)`,
            border: "none", borderRadius: 14, color: "#fff",
            fontFamily: "'Barlow',sans-serif", fontWeight: 800, fontSize: 15,
            cursor: "pointer",
            boxShadow: `0 6px 22px ${tripStageColor}30`,
            transition: "all .2s", letterSpacing: ".3px",
          }}
        >
          {tripBtnLabel} <ChevronRight size={17}/>
        </button>
      ) : (
        <div style={{
          background: "rgba(22,163,74,.07)",
          border: "1.5px solid rgba(22,163,74,.28)",
          borderRadius: 16, padding: 20, textAlign: "center",
          animation: "scaleIn .4s ease-out",
        }}>
          <Check size={28} color={C.onlineGreen} style={{ margin: "0 auto 8px", display: "block" }}/>
          <div className="condensed" style={{ fontSize: 22, fontWeight: 900, color: C.onlineGreen }}>
            Trip Complete!
          </div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: C.onlineGreen, marginTop: 4 }}>
            {activeTrip.fare} earned
          </div>
        </div>
      )}
    </div>
  );
}