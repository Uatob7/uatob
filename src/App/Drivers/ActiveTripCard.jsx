import { MapPin, Flag, Navigation, ChevronRight, Loader2 } from "lucide-react";

/**
 * ActiveTripCard – light redesign
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
  advancePending,
}) {

  if (!activeTrip) return null;

  const stageConfig = {
    driver_assigned: {
      icon: <Navigation size={12} />,
      label: "En Route to Pickup",
      pulse: true,
    },
    arrived: {
      icon: <MapPin size={12} />,
      label: "Waiting for Rider",
      pulse: false,
    },
    in_progress: {
      icon: <Flag size={12} />,
      label: "Trip In Progress",
      pulse: true,
    },
  };

  const stage = stageConfig[tripStage] ?? stageConfig.driver_assigned;
  const isComplete = tripStage === "in_progress";
  const isInProgress = tripStage === "in_progress";

  const accent = tripStageColor ?? "#2563EB";

  const openInMaps = (address) => {
    if (!address) return;
    const q = encodeURIComponent(address);
    window.open(`https://maps.google.com/?q=${q}`, "_blank");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: .3; transform: scale(.55); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .atc-root {
          font-family: 'DM Sans', sans-serif;
          background: #FFFFFF;
          border-radius: 18px;
          border: 1px solid #E8ECF0;
          box-shadow:
            0 1px 3px rgba(0,0,0,.06),
            0 8px 32px rgba(0,0,0,.06);
          overflow: hidden;
          animation: fadeUp .32s ease-out both;
        }

        /* ── stage strip ── */
        .atc-stage {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 10px 16px;
          border-bottom: 1px solid #F0F2F5;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .07em;
          text-transform: uppercase;
        }
        .atc-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .atc-dot.pulse {
          animation: pulseDot 1.5s ease-in-out infinite;
        }

        /* ── body ── */
        .atc-body {
          padding: 18px 16px 0;
        }

        /* ── timeline ── */
        .atc-timeline {
          position: relative;
          padding-left: 26px;
          display: flex;
          flex-direction: column;
        }
        .atc-timeline-track {
          position: absolute;
          left: 9px;
          top: 20px;
          bottom: 20px;
          width: 1.5px;
          background: linear-gradient(to bottom, #3B82F6 0%, #10B981 100%);
          opacity: .25;
          border-radius: 2px;
        }
        .atc-stop {
          position: relative;
          padding-bottom: 16px;
          transition: opacity .2s;
        }
        .atc-stop.dimmed { opacity: .3; }
        .atc-stop-node {
          position: absolute;
          left: -17px;
          top: 5px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          border-width: 2px;
          border-style: solid;
          background: #fff;
        }
        .atc-stop-tag {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .06em;
          text-transform: uppercase;
          color: #B0B8C4;
          margin-bottom: 2px;
        }
        .atc-stop-addr {
          font-size: 13.5px;
          font-weight: 500;
          color: #1A1F2E;
          line-height: 1.4;
          flex: 1;
        }
        .atc-stop-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* ── stats ── */
        .atc-divider {
          height: 1px;
          background: #F0F2F5;
          margin: 16px 0 0;
        }
        .atc-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          padding: 14px 16px;
          gap: 0;
        }
        .atc-stat {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .atc-map-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          border: 1px solid #DAEAFF;
          border-radius: 7px;
          background: #EFF6FF;
          color: #3B82F6;
          cursor: pointer;
          flex-shrink: 0;
          transition: background .13s, border-color .13s, transform .1s;
          line-height: 0;
        }
        .atc-map-btn:hover  { background: #DBEAFE; border-color: #BFDBFE; }
        .atc-map-btn:active { transform: scale(.93); }

        .atc-map-btn.green {
          background: #ECFDF5;
          border-color: #A7F3D0;
          color: #10B981;
        }
        .atc-map-btn.green:hover {
          background: #D1FAE5;
          border-color: #6EE7B7;
        }

        .atc-stat + .atc-stat {
          padding-left: 14px;
          border-left: 1px solid #EDF0F4;
        }
        .atc-stat-value {
          font-family: 'DM Mono', monospace;
          font-size: 14.5px;
          font-weight: 500;
          color: #1A1F2E;
          letter-spacing: -.01em;
        }
        .atc-stat-key {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: .055em;
          text-transform: uppercase;
          color: #B0B8C4;
        }

        /* ── CTA ── */
        .atc-cta-wrap {
          padding: 0 14px 14px;
        }
        .atc-cta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 14px 18px;
          border: none;
          border-radius: 12px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          cursor: pointer;
          transition: filter .13s, transform .1s;
          letter-spacing: .02em;
        }
        .atc-cta:hover  { filter: brightness(1.08); }
        .atc-cta:active { filter: brightness(.94); transform: scale(.99); }
        .atc-cta-arrow {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: rgba(255,255,255,.22);
          flex-shrink: 0;
        }
      `}</style>

      <div className="atc-root">
        {/* Stage strip */}
        <div className="atc-stage" style={{ color: accent }}>
          <div
            className={`atc-dot${stage.pulse ? " pulse" : ""}`}
            style={{ background: accent }}
          />
          {stage.icon}
          {stage.label}
        </div>

        {/* Route timeline */}
        <div className="atc-body">
          <div className="atc-timeline">
            <div className="atc-timeline-track" />

            {/* Pickup */}
            <div className={`atc-stop${isComplete ? " dimmed" : ""}`}>
              <div className="atc-stop-node" style={{ borderColor: "#3B82F6" }} />
              <div className="atc-stop-tag">Pickup</div>
              <div className="atc-stop-row">
                <div className="atc-stop-addr">{activeTrip.pickup}</div>

                {!isInProgress && (
                  <button
                    className="atc-map-btn"
                    onClick={() => openInMaps(activeTrip.pickup)}
                    title="Open Pickup in Maps"
                  >
                    <MapPin size={13} strokeWidth={2.2} />
                  </button>
                )}
              </div>
            </div>

            {/* Dropoff */}
            <div
              className={`atc-stop${tripStage === "driver_assigned" ? " dimmed" : ""}`}
              style={{ paddingBottom: 0 }}
            >
              <div className="atc-stop-node" style={{ borderColor: "#10B981" }} />
              <div className="atc-stop-tag">Dropoff</div>
              <div className="atc-stop-row">
                <div className="atc-stop-addr">{activeTrip.dropoff}</div>

                {isInProgress && (
                  <button
                    className="atc-map-btn green"
                    onClick={() => openInMaps(activeTrip.dropoff)}
                    title="Open Dropoff in Maps"
                  >
                    <MapPin size={13} strokeWidth={2.2} color="#10B981" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="atc-divider" />
        <div className="atc-stats">
          {[
            { value: activeTrip.driverPayout, key: "Fare" },
            { value: `${activeTrip.tripDistanceMiles?.toFixed(1)} mi`, key: "Distance" },
            { value: `${activeTrip.tripDurationMin} min`, key: "Est. Time" },
          ].map((item, i) => (
            <div key={i} className="atc-stat">
              <span className="atc-stat-value">{item.value}</span>
              <span className="atc-stat-key">{item.key}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="atc-cta-wrap">
          <button
            className="atc-cta"
            style={{
              background: accent,
              opacity: advancePending ? 0.7 : 1,
              cursor: advancePending ? "not-allowed" : "pointer",
            }}
            onClick={onAdvance}
            disabled={advancePending}
          >
            {advancePending ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ marginLeft: 8 }}>Processing...</span>
              </>
            ) : (
              <>
                <span>{tripBtnLabel}</span>
                <div className="atc-cta-arrow">
                  <ChevronRight size={14} strokeWidth={2.5} />
                </div>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}