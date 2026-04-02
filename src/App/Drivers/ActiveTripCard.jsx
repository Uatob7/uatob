import { MapPin, Flag, Clock, Navigation, DollarSign, ChevronRight } from "lucide-react";
import { C } from '@/App/Drivers/constants.js';

/**
 * ActiveTripCard
 *
 * Props:
 *   activeTrip      — trip object | null
 *   tripStage       — "driver_assigned" | "arrived" | "in_progress"
 *   tripStageColor  — hex color for the current stage
 *   tripBtnLabel    — CTA button label string
 *   onAdvance       — handler called when CTA is tapped
 */
export default function ActiveTripCard({
  activeTrip,
  tripStage,
  tripStageColor,
  tripBtnLabel,
  onAdvance,
}) {
  if (!activeTrip) return null;

  const stageConfig = {
    driver_assigned: {
      icon:  <Navigation size={13} />,
      label: "En Route to Pickup",
      pulse: true,
    },
    arrived: {
      icon:  <MapPin size={13} />,
      label: "Waiting for Rider",
      pulse: false,
    },
    in_progress: {
      icon:  <Flag size={13} />,
      label: "Trip In Progress",
      pulse: true,
    },
  };

  const stage = stageConfig[tripStage] ?? stageConfig.driver_assigned;
  const isComplete = tripStage === "in_progress";

  /* ─── styles ─────────────────────────────────────────────────── */

  const s = {
    card: {
      background:   "#141414",
      borderRadius: 20,
      overflow:     "hidden",
      border:       "1px solid #2a2a2a",
    },

    stageBadge: {
      display:       "flex",
      alignItems:    "center",
      gap:           8,
      padding:       "11px 16px",
      background:    `${tripStageColor}14`,
      borderBottom:  `1px solid ${tripStageColor}22`,
      color:         tripStageColor,
      fontSize:      11,
      fontWeight:    700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
    },

    dot: {
      width:        7,
      height:       7,
      borderRadius: "50%",
      background:   tripStageColor,
      flexShrink:   0,
      ...(stage.pulse ? { animation: "pulseDot 1.4s ease-in-out infinite" } : {}),
    },

    body: {
      padding:    "16px 16px 0",
    },

    /* vertical timeline */
    timeline: {
      paddingLeft: 28,
      position:    "relative",
      display:     "flex",
      flexDirection: "column",
    },

    timelineLine: {
      position:   "absolute",
      left:       9,
      top:        22,
      bottom:     22,
      width:      1,
      background: "linear-gradient(to bottom, #3B82F6, #10B981)",
      opacity:    0.3,
    },

    stop: (dimmed) => ({
      display:      "flex",
      alignItems:   "flex-start",
      gap:          12,
      paddingBottom: 16,
      position:     "relative",
      opacity:      dimmed ? 0.35 : 1,
    }),

    stopDot: (color) => ({
      position:     "absolute",
      left:         -19,
      top:          4,
      width:        10,
      height:       10,
      borderRadius: "50%",
      border:       `2px solid ${color}`,
      background:   "#141414",
      flexShrink:   0,
    }),

    stopLabel: {
      fontSize:      10,
      fontWeight:    700,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color:         "#555",
      marginBottom:  2,
    },

    stopAddr: {
      fontSize:   13.5,
      fontWeight: 500,
      color:      "#e8e8e8",
      lineHeight: 1.35,
    },

    divider: {
      height:     1,
      background: "#1f1f1f",
      margin:     "14px 0 0",
    },

    stats: {
      display:             "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      padding:             "12px 16px",
    },

    stat: (i) => ({
      display:       "flex",
      flexDirection: "column",
      gap:           2,
      padding:       i === 0 ? "0 8px 0 0" : "0 8px",
      borderLeft:    i > 0 ? "1px solid #222" : "none",
    }),

    statValue: {
      fontFamily: "'DM Mono', 'Fira Mono', monospace",
      fontSize:   15,
      fontWeight: 500,
      color:      "#e8e8e8",
    },

    statKey: {
      fontSize:      10,
      fontWeight:    600,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      color:         "#444",
    },

    hardDivider: {
      height:     1,
      background: "#1f1f1f",
      margin:     0,
    },

    cta: {
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      gap:            10,
      width:          "100%",
      padding:        "15px 20px",
      background:     tripStageColor,
      border:         "none",
      color:          "#fff",
      fontSize:       14,
      fontWeight:     700,
      letterSpacing:  "0.04em",
      cursor:         "pointer",
      transition:     "filter .12s",
    },

    ctaArrow: {
      display:         "flex",
      alignItems:      "center",
      justifyContent:  "center",
      width:           24,
      height:          24,
      borderRadius:    "50%",
      background:      "rgba(255,255,255,0.18)",
      flexShrink:      0,
    },
  };

  return (
    <>
      <style>{`
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: .4; transform: scale(.65); }
        }
        .atc-cta:hover  { filter: brightness(1.12); }
        .atc-cta:active { filter: brightness(.9); }
      `}</style>

      <div style={s.card}>

        {/* Stage badge */}
        <div style={s.stageBadge}>
          <div style={s.dot} />
          {stage.icon}
          {stage.label}
        </div>

        {/* Route timeline */}
        <div style={s.body}>
          <div style={s.timeline}>
            <div style={s.timelineLine} />

            {/* Pickup */}
            <div style={s.stop(isComplete)}>
              <div style={s.stopDot("#3B82F6")} />
              <div>
                <div style={s.stopLabel}>Pickup</div>
                <div style={s.stopAddr}>{activeTrip.pickup}</div>
              </div>
            </div>

            {/* Dropoff */}
            <div style={{ ...s.stop(false), paddingBottom: 0 }}>
              <div style={s.stopDot("#10B981")} />
              <div>
                <div style={s.stopLabel}>Dropoff</div>
                <div style={s.stopAddr}>{activeTrip.dropoff}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={s.divider} />
        <div style={s.stats}>
          {[
            { value: activeTrip.fareTotal,                            label: "Fare" },
            { value: `${activeTrip.tripDistanceMiles?.toFixed(1)} mi`, label: "Distance" },
            { value: `${activeTrip.tripDurationMin} min`,             label: "Est. time" },
          ].map((item, i) => (
            <div key={i} style={s.stat(i)}>
              <span style={s.statValue}>{item.value}</span>
              <span style={s.statKey}>{item.label}</span>
            </div>
          ))}
        </div>

        <div style={s.hardDivider} />

        {/* CTA */}
        <button className="atc-cta" style={s.cta} onClick={onAdvance}>
          {tripBtnLabel}
          <div style={s.ctaArrow}>
            <ChevronRight size={13} strokeWidth={2.5} />
          </div>
        </button>

      </div>
    </>
  );
}