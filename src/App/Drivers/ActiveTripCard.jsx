import { MapPin, Flag, Clock, Navigation, DollarSign, ChevronRight } from "lucide-react";
import { C } from '@/App/Drivers/constants.js';

/**
 * ActiveTripCard
 *
 * Renders nothing when there is no active trip.
 * When a trip is active, shows stage-appropriate UI with pickup/dropoff,
 * fare, distance, duration, and the stage-advance CTA button.
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

  console.log(activeTrip)

  const stageConfig = {
    driver_assigned: {
      icon:       <Navigation size={15} />,
      label:      "En Route to Pickup",
      pulse:      true,
    },
    arrived: {
      icon:       <MapPin size={15} />,
      label:      "Waiting for Rider",
      pulse:      false,
    },
    in_progress: {
      icon:       <Flag size={15} />,
      label:      "Trip In Progress",
      pulse:      true,
    },
  };

  const stage = stageConfig[tripStage] || stageConfig.driver_assigned;

  const cardStyle = {
    background:   C.surface,
    borderRadius: 18,
    overflow:     "hidden",
    border:       `1.5px solid ${tripStageColor}33`,
    boxShadow:    `0 0 24px ${tripStageColor}18`,
  };

  const stageBadgeStyle = {
    display:        "flex",
    alignItems:     "center",
    gap:            7,
    background:     `${tripStageColor}18`,
    borderBottom:   `1px solid ${tripStageColor}22`,
    padding:        "10px 16px",
    color:          tripStageColor,
    fontSize:       13,
    fontWeight:     700,
    letterSpacing:  "0.04em",
    textTransform:  "uppercase",
  };

  const dotStyle = {
    width:        8,
    height:       8,
    borderRadius: "50%",
    background:   tripStageColor,
    flexShrink:   0,
    ...(stage.pulse ? { animation: "pulseDot 1.4s ease-in-out infinite" } : {}),
  };

  const bodyStyle = {
    padding: "16px 16px 0",
  };

  const routeRowStyle = {
    display:       "flex",
    flexDirection: "column",
    gap:           0,
  };

  const routeItemStyle = (isLast) => ({
    display:       "flex",
    alignItems:    "flex-start",
    gap:           12,
    paddingBottom: isLast ? 0 : 10,
    position:      "relative",
  });

  const iconDotStyle = (color) => ({
    width:        32,
    height:       32,
    borderRadius: "50%",
    background:   `${color}18`,
    border:        `1.5px solid ${color}44`,
    display:      "flex",
    alignItems:   "center",
    justifyContent: "center",
    color:        color,
    flexShrink:   0,
    marginTop:    2,
  });

  const connectorStyle = {
    position:   "absolute",
    left:       15,
    top:        36,
    width:       2,
    height:     "calc(100% - 8px)",
    background: `${C.text}18`,
  };

  const addressLabelStyle = {
    fontSize:   11,
    fontWeight: 700,
    color:      `${C.text}55`,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 2,
  };

  const addressTextStyle = {
    fontSize:   14,
    fontWeight: 600,
    color:      C.text,
    lineHeight: 1.35,
  };

  const metaRowStyle = {
    display:        "flex",
    gap:            8,
    padding:        "14px 16px",
    borderTop:      `1px solid ${C.text}0f`,
    marginTop:      14,
  };

  const metaChipStyle = (color) => ({
    display:        "flex",
    alignItems:     "center",
    gap:            5,
    flex:           1,
    background:     `${color || C.text}0d`,
    borderRadius:   10,
    padding:        "8px 10px",
    color:          color || C.text,
    fontSize:       13,
    fontWeight:     700,
  });

  const metaSubStyle = {
    fontSize:   10,
    fontWeight: 500,
    opacity:    0.6,
    display:    "block",
    marginTop:  1,
  };

  const btnStyle = {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    gap:            8,
    width:          "100%",
    padding:        "15px 20px",
    background:     tripStageColor,
    border:         "none",
    borderTop:      `2px solid ${tripStageColor}`,
    color:          "#fff",
    fontSize:       15,
    fontWeight:     800,
    letterSpacing:  "0.02em",
    cursor:         "pointer",
    marginTop:      0,
    transition:     "filter .15s",
  };

  return (
    <>
      <style>{`
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: .5; transform: scale(.75); }
        }
        .atc-btn:hover  { filter: brightness(1.1); }
        .atc-btn:active { filter: brightness(.92); }
      `}</style>

      <div style={cardStyle}>

        {/* Stage badge */}
        <div style={stageBadgeStyle}>
          <div style={dotStyle} />
          {stage.icon}
          {stage.label}
        </div>

        {/* Route */}
        <div style={bodyStyle}>
          <div style={routeRowStyle}>

            {/* Pickup */}
            <div style={routeItemStyle(false)}>
              <div style={connectorStyle} />
              <div style={iconDotStyle(C.blue)}>
                <MapPin size={14} />
              </div>
              <div>
                <div style={addressLabelStyle}>Pickup</div>
                <div style={addressTextStyle}>{activeTrip.pickup}</div>
              </div>
            </div>

            {/* Dropoff */}
            <div style={routeItemStyle(true)}>
              <div style={iconDotStyle(C.green)}>
                <Flag size={14} />
              </div>
              <div>
                <div style={addressLabelStyle}>Dropoff</div>
                <div style={addressTextStyle}>{activeTrip.dropoff}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Meta chips */}
        <div style={metaRowStyle}>
          <div style={metaChipStyle("#F59E0B")}>
            <DollarSign size={13} />
            <div>
              <span>{activeTrip.fareTotal}</span>
              <span style={metaSubStyle}>Fare</span>
            </div>
          </div>

          <div style={metaChipStyle(C.blue)}>
            <Navigation size={13} />
            <div>
              <span>{activeTrip.tripDistanceMiles?.toFixed(1)} mi</span>
              <span style={metaSubStyle}>Distance</span>
            </div>
          </div>

          <div style={metaChipStyle(C.text)}>
            <Clock size={13} />
            <div>
              <span>{activeTrip.tripDurationMin} min</span>
              <span style={metaSubStyle}>Est. time</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <button className="atc-btn" style={btnStyle} onClick={onAdvance}>
          {tripBtnLabel}
          <ChevronRight size={17} />
        </button>
      </div>
    </>
  );
}