import { useEffect, useRef, useState } from "react";
import { MapPin, Flag, Navigation, ChevronRight, Loader2, MessageCircle, Send, Check, ChevronDown, X, AlertTriangle } from "lucide-react";
import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  updateDoc,
  doc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

/**
 * ActiveTripCard – with driver ↔ rider messaging + decline ride
 *
 * Props:
 *   activeTrip      — trip object | null
 *   tripStage       — "driver_assigned" | "arrived" | "in_progress"
 *   tripStageColor  — hex color for the current stage
 *   tripBtnLabel    — CTA button label string
 *   onAdvance       — handler called when CTA is tapped
 *   advancePending  — bool, disables CTA while Cloud Function is in-flight
 *   onUnreadChange  — (count: number) => void
 */
export default function ActiveTripCard({
  activeTrip,
  tripStage,
  tripStageColor,
  tripBtnLabel,
  onAdvance,
  advancePending,
  onUnreadChange,
}) {
  const [showMessages, setShowMessages] = useState(false);
  const [unreadCount,  setUnreadCount]  = useState(0);

  useEffect(() => {
    onUnreadChange?.(unreadCount);
  }, [unreadCount, onUnreadChange]);

  if (!activeTrip) return null;

  const rideId = activeTrip.id ?? activeTrip.rideId;
  const accent = tripStageColor ?? "#2563EB";

  const stageConfig = {
    driver_assigned: { icon: <Navigation size={12} />, label: "En Route to Pickup", pulse: true  },
    arrived:         { icon: <MapPin size={12} />,     label: "Waiting for Rider",  pulse: false },
    in_progress:     { icon: <Flag size={12} />,       label: "Trip In Progress",   pulse: true  },
  };

  const stage        = stageConfig[tripStage] ?? stageConfig.driver_assigned;
  const isInProgress = tripStage === "in_progress";

  const openInMaps = (address) => {
    if (!address) return;
    window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, "_blank");
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
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes msgSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes confirmSlide {
          from { opacity: 0; transform: translateY(-6px) scaleY(.96); }
          to   { opacity: 1; transform: translateY(0)   scaleY(1); }
        }

        .atc-root {
          font-family: 'DM Sans', sans-serif;
          background: #FFFFFF;
          border-radius: 18px;
          border: 1px solid #E8ECF0;
          box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 8px 32px rgba(0,0,0,.06);
          overflow: hidden;
          animation: fadeUp .32s ease-out both;
        }

        /* ── Stage strip ── */
        .atc-stage {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 7px;
          padding: 10px 12px 10px 16px;
          border-bottom: 1px solid #F0F2F5;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .07em;
          text-transform: uppercase;
        }
        .atc-stage-left {
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .atc-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .atc-dot.pulse { animation: pulseDot 1.5s ease-in-out infinite; }

        /* ── Decline pill (idle state) ── */
        .atc-decline-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border-radius: 99px;
          border: 1.5px solid #FCA5A5;
          background: #FFF1F2;
          font-family: 'DM Sans', sans-serif;
          font-size: 10px;
          font-weight: 700;
          color: #DC2626;
          cursor: pointer;
          letter-spacing: .04em;
          white-space: nowrap;
          flex-shrink: 0;
          transition: background .15s, border-color .15s, transform .1s;
        }
        .atc-decline-pill:hover  { background: #FFE4E6; border-color: #F87171; }
        .atc-decline-pill:active { transform: scale(.96); }

        /* ── Confirm banner ── */
        .atc-confirm-banner {
          margin: 10px 14px 0;
          padding: 14px;
          background: #FFF7ED;
          border: 1.5px solid #FED7AA;
          border-radius: 14px;
          animation: confirmSlide .2s ease-out both;
        }
        .atc-confirm-title {
          display: flex; align-items: center; gap: 7px;
          font-size: 13px; font-weight: 700; color: #92400E; margin-bottom: 7px;
        }
        .atc-confirm-body {
          font-size: 12px; color: #B45309; line-height: 1.55; margin-bottom: 13px;
        }
        .atc-confirm-actions {
          display: flex; gap: 8px;
        }
        .atc-confirm-keep {
          flex: 1; padding: 9px 0; border-radius: 9px;
          border: 1.5px solid #FED7AA; background: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; font-weight: 700; color: #92400E; cursor: pointer;
          transition: background .13s;
        }
        .atc-confirm-keep:hover { background: #FEF3C7; }
        .atc-confirm-yes {
          flex: 1; padding: 9px 0; border-radius: 9px;
          border: none; background: #DC2626;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; font-weight: 700; color: #fff; cursor: pointer;
          transition: filter .13s;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .atc-confirm-yes:hover   { filter: brightness(1.08); }
        .atc-confirm-yes:active  { filter: brightness(.94); }
        .atc-confirm-yes:disabled { opacity: .6; cursor: not-allowed; }

        /* ── Error note ── */
        .atc-decline-error {
          margin: 7px 14px 0;
          font-size: 11px; font-weight: 600; color: #DC2626; text-align: center;
          font-family: 'DM Sans', sans-serif;
        }

        /* ── Body / timeline ── */
        .atc-body { padding: 18px 16px 0; }
        .atc-timeline { position: relative; padding-left: 26px; display: flex; flex-direction: column; }
        .atc-timeline-track {
          position: absolute; left: 9px; top: 20px; bottom: 20px;
          width: 1.5px;
          background: linear-gradient(to bottom, #3B82F6 0%, #10B981 100%);
          opacity: .25; border-radius: 2px;
        }
        .atc-stop { position: relative; padding-bottom: 16px; transition: opacity .2s; }
        .atc-stop.dimmed { opacity: .3; }
        .atc-stop-node {
          position: absolute; left: -17px; top: 5px;
          width: 10px; height: 10px;
          border-radius: 50%; border-width: 2px; border-style: solid; background: #fff;
        }
        .atc-stop-tag { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #B0B8C4; margin-bottom: 2px; }
        .atc-stop-addr { font-size: 13.5px; font-weight: 500; color: #1A1F2E; line-height: 1.4; flex: 1; }
        .atc-stop-row { display: flex; align-items: center; gap: 8px; }
        .atc-divider { height: 1px; background: #F0F2F5; margin: 16px 0 0; }

        /* ── Stats ── */
        .atc-stats { display: grid; grid-template-columns: repeat(3, 1fr); padding: 14px 16px; }
        .atc-stat { display: flex; flex-direction: column; gap: 3px; }
        .atc-stat + .atc-stat { padding-left: 14px; border-left: 1px solid #EDF0F4; }
        .atc-stat-value { font-family: 'DM Mono', monospace; font-size: 14.5px; font-weight: 500; color: #1A1F2E; letter-spacing: -.01em; }
        .atc-stat-key { font-size: 10px; font-weight: 600; letter-spacing: .055em; text-transform: uppercase; color: #B0B8C4; }

        /* ── Map buttons ── */
        .atc-map-btn {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 4px; border: 1px solid #DAEAFF; border-radius: 7px;
          background: #EFF6FF; color: #3B82F6; cursor: pointer; flex-shrink: 0;
          transition: background .13s, border-color .13s, transform .1s; line-height: 0;
        }
        .atc-map-btn:hover  { background: #DBEAFE; border-color: #BFDBFE; }
        .atc-map-btn:active { transform: scale(.93); }
        .atc-map-btn.green { background: #ECFDF5; border-color: #A7F3D0; color: #10B981; }
        .atc-map-btn.green:hover { background: #D1FAE5; border-color: #6EE7B7; }

        /* ── CTA ── */
        .atc-cta-wrap { padding: 0 14px 14px; }
        .atc-cta {
          display: flex; align-items: center; justify-content: space-between;
          width: 100%; padding: 14px 18px; border: none; border-radius: 12px;
          font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 700;
          color: #fff; cursor: pointer; transition: filter .13s, transform .1s; letter-spacing: .02em;
        }
        .atc-cta:hover  { filter: brightness(1.08); }
        .atc-cta:active { filter: brightness(.94); transform: scale(.99); }
        .atc-cta-arrow {
          display: flex; align-items: center; justify-content: center;
          width: 26px; height: 26px; border-radius: 50%;
          background: rgba(255,255,255,.22); flex-shrink: 0;
        }

        /* ── Message row ── */
        .atc-msg-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 14px 14px;
        }
        .atc-msg-btn {
          display: flex; align-items: center; gap: 7px;
          background: none; border: 1.5px solid #E8ECF0; border-radius: 10px;
          padding: 8px 14px; font-family: 'DM Sans', sans-serif;
          font-size: 12px; font-weight: 700; cursor: pointer;
          transition: all .18s; color: #6B7280; position: relative;
        }
        .atc-msg-btn.active { border-color: var(--accent); color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); }
        .atc-msg-btn:hover  { border-color: var(--accent); color: var(--accent); }
        .atc-icon-wrap {
          position: relative; display: inline-flex;
          align-items: center; justify-content: center; flex-shrink: 0;
        }
        .atc-unread-badge {
          position: absolute; top: -6px; right: -8px;
          background: #EF4444; color: #fff;
          font-size: 9px; font-weight: 800; line-height: 1;
          min-width: 15px; height: 15px; border-radius: 99px; padding: 0 3px;
          display: flex; align-items: center; justify-content: center;
          border: 1.5px solid #fff; pointer-events: none;
        }

        /* ── Message panel ── */
        .atc-msg-panel {
          margin: 0 14px 14px; border: 1.5px solid #E8ECF0;
          border-radius: 16px; overflow: hidden;
          animation: msgSlideIn .22s ease-out both;
        }
        .atc-msg-list {
          min-height: 140px; max-height: 220px; overflow-y: auto;
          -webkit-overflow-scrolling: touch; padding: 12px 14px;
          display: flex; flex-direction: column; gap: 8px;
          background: #fff; overscroll-behavior: contain; scroll-behavior: smooth;
        }
        .atc-msg-empty {
          text-align: center; color: #B0B8C4;
          font-size: 12px; font-weight: 500; margin-top: 20px;
        }
        .atc-quick-row {
          display: flex; gap: 6px; padding: 0 14px 8px; flex-wrap: wrap; background: #fff;
        }
        .atc-quick-btn {
          background: none; border: 1px solid #E8ECF0; border-radius: 99px;
          padding: 4px 10px; font-size: 11px; font-weight: 600;
          color: #9CA3AF; cursor: pointer; white-space: nowrap;
          transition: all .15s; font-family: 'DM Sans', sans-serif;
        }
        .atc-quick-btn:hover { border-color: var(--accent); color: var(--accent); }
        .atc-msg-input-row {
          display: flex; gap: 8px; padding: 8px 12px 12px;
          border-top: 1px solid #F0F2F5; align-items: flex-end; background: #fff;
        }
        .atc-textarea {
          flex: 1; resize: none; background: #F9FAFB;
          border: 1.5px solid #E8ECF0; border-radius: 10px;
          padding: 9px 12px; font-size: 13px; color: #1A1F2E;
          font-family: 'DM Sans', sans-serif; outline: none;
          line-height: 1.4; max-height: 72px; overflow-y: auto;
          transition: border-color .18s;
        }
        .atc-textarea:focus { border-color: var(--accent); }
        .atc-send-btn {
          width: 38px; height: 38px; border-radius: 10px; border: none;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; flex-shrink: 0; transition: all .18s;
        }
      `}</style>

      <div className="atc-root" style={{ "--accent": accent }}>

        {/* ── Stage strip ── */}
        <div className="atc-stage" style={{ color: accent }}>
          <div className="atc-stage-left">
            <div className={`atc-dot${stage.pulse ? " pulse" : ""}`} style={{ background: accent }} />
            {stage.icon}
            {stage.label}
          </div>

          {tripStage === "driver_assigned" && (
            <DeclinePill rideId={rideId} />
          )}
        </div>

        {/* ── Confirm banner (rendered just below strip, inside card) ── */}
        {tripStage === "driver_assigned" && (
          <DeclineConfirmBanner rideId={rideId} />
        )}

        {/* ── Route timeline ── */}
        <div className="atc-body">
          <div className="atc-timeline">
            <div className="atc-timeline-track" />
            <div className={`atc-stop${isInProgress ? " dimmed" : ""}`}>
              <div className="atc-stop-node" style={{ borderColor: "#3B82F6" }} />
              <div className="atc-stop-tag">Pickup</div>
              <div className="atc-stop-row">
                <div className="atc-stop-addr">{activeTrip.pickup}</div>
                {!isInProgress && (
                  <button className="atc-map-btn" onClick={() => openInMaps(activeTrip.pickup)} title="Open in Maps">
                    <MapPin size={13} strokeWidth={2.2} />
                  </button>
                )}
              </div>
            </div>
            <div className={`atc-stop${tripStage === "driver_assigned" ? " dimmed" : ""}`} style={{ paddingBottom: 0 }}>
              <div className="atc-stop-node" style={{ borderColor: "#10B981" }} />
              <div className="atc-stop-tag">Dropoff</div>
              <div className="atc-stop-row">
                <div className="atc-stop-addr">{activeTrip.dropoff}</div>
                {isInProgress && (
                  <button className="atc-map-btn green" onClick={() => openInMaps(activeTrip.dropoff)} title="Open in Maps">
                    <MapPin size={13} strokeWidth={2.2} color="#10B981" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="atc-divider" />
        <div className="atc-stats">
          {[
            { value: `$${activeTrip.driverPayout?.toFixed(2) ?? "--"}`,       key: "Payout"    },
            { value: `${activeTrip.tripDistanceMiles?.toFixed(1) ?? "--"} mi`, key: "Distance"  },
            { value: `${activeTrip.tripDurationMin ?? "--"} min`,              key: "Est. Time" },
          ].map((item, i) => (
            <div key={i} className="atc-stat">
              <span className="atc-stat-value">{item.value}</span>
              <span className="atc-stat-key">{item.key}</span>
            </div>
          ))}
        </div>

        {/* ── Message toggle ── */}
        <div className="atc-divider" />
        <div className="atc-msg-row">
          <button
            className={`atc-msg-btn${showMessages ? " active" : ""}`}
            onClick={() => setShowMessages(v => !v)}
          >
            <span className="atc-icon-wrap">
              <MessageCircle size={13} />
              {unreadCount > 0 && (
                <span className="atc-unread-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </span>
            {showMessages ? "Hide Messages" : "Message Rider"}
          </button>
          {showMessages && (
            <button
              onClick={() => setShowMessages(false)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 11, fontWeight: 700, color: "#9CA3AF", padding: "4px 8px",
              }}
            >
              <ChevronDown size={13} /> Hide
            </button>
          )}
        </div>

        {showMessages && rideId && (
          <DriverMessagePanel
            rideId={rideId}
            accent={accent}
            onUnreadChange={setUnreadCount}
          />
        )}

        {/* ── CTA ── */}
        <div className="atc-cta-wrap">
          <button
            className="atc-cta"
            style={{ background: accent, opacity: advancePending ? 0.7 : 1, cursor: advancePending ? "not-allowed" : "pointer" }}
            onClick={onAdvance}
            disabled={advancePending}
          >
            {advancePending ? (
              <>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
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

/* ─── Shared decline state (lifted above both sub-components) ────────────────
   Both DeclinePill and DeclineConfirmBanner need access to the same phase/error
   state. The cleanest approach without a context is to keep state in the parent
   and pass it down — but since ActiveTripCard re-renders on every prop change
   anyway, we use a small module-level Map keyed by rideId to share state
   between the two sibling components rendered in the same card.
   A simpler alternative: lift state into ActiveTripCard and pass via props.
   We use the simpler alternative here — both components are controlled from
   a wrapper hook. ────────────────────────────────────────────────────────── */

function useDeclineRide(rideId) {
  const [phase, setPhase] = useState("idle");   // "idle" | "confirm" | "loading"
  const [error, setError] = useState(null);
  const auth              = getAuth();

  async function confirm() {
    if (phase !== "confirm") return;
    setPhase("loading");
    setError(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const res   = await fetch(
        "https://us-central1-YOUR_PROJECT.cloudfunctions.net/declineRide",
        {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ rideId }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      // Firestore listener in parent will unmount this card naturally
    } catch (err) {
      console.error("[declineRide]", err);
      setError("Something went wrong — tap to try again");
      setPhase("idle");
    }
  }

  return { phase, setPhase, error, confirm };
}

// ── We need shared state between the pill and the banner.
//    Simplest fix: hoist into a wrapper that renders both. ──────────────────

function DeclinePill({ rideId }) {
  // This component just needs to trigger the shared state —
  // see DeclineRideSection below for the full implementation.
  return null;
}

function DeclineConfirmBanner({ rideId }) {
  return null;
}

/* ─── The real implementation — replaces both stubs above ───────────────────
   In ActiveTripCard, swap out the two stub usages for one:

     {tripStage === "driver_assigned" && (
       <DeclineRideSection rideId={rideId} accent={accent} />  ← in stage strip
     )}

   But since the pill sits inside the strip and the banner sits below it,
   we instead lift state to ActiveTripCard itself. See the corrected
   ActiveTripCard below that uses declinePhase state directly.
─────────────────────────────────────────────────────────────────────────────

   CLEAN FINAL PATTERN — replace the export default above with this version
   that owns decline state directly: */

export function ActiveTripCardFull({
  activeTrip,
  tripStage,
  tripStageColor,
  tripBtnLabel,
  onAdvance,
  advancePending,
  onUnreadChange,
}) {
  const [showMessages,  setShowMessages]  = useState(false);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [declinePhase,  setDeclinePhase]  = useState("idle");  // "idle"|"confirm"|"loading"
  const [declineError,  setDeclineError]  = useState(null);
  const auth = getAuth();

  useEffect(() => { onUnreadChange?.(unreadCount); }, [unreadCount, onUnreadChange]);

  if (!activeTrip) return null;

  const rideId = activeTrip.id ?? activeTrip.rideId;
  const accent = tripStageColor ?? "#2563EB";

  const stageConfig = {
    driver_assigned: { icon: <Navigation size={12} />, label: "En Route to Pickup", pulse: true  },
    arrived:         { icon: <MapPin size={12} />,     label: "Waiting for Rider",  pulse: false },
    in_progress:     { icon: <Flag size={12} />,       label: "Trip In Progress",   pulse: true  },
  };
  const stage        = stageConfig[tripStage] ?? stageConfig.driver_assigned;
  const isInProgress = tripStage === "in_progress";

  const openInMaps = (address) => {
    if (!address) return;
    window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, "_blank");
  };

  async function handleDeclineConfirm() {
    setDeclinePhase("loading");
    setDeclineError(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const res   = await fetch(
        "https://us-central1-YOUR_PROJECT.cloudfunctions.net/declineRide",
        {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ rideId }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      // Firestore listener in parent will unmount this card naturally
    } catch (err) {
      console.error("[declineRide]", err);
      setDeclineError("Something went wrong — please try again");
      setDeclinePhase("idle");
    }
  }

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
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes msgSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes confirmSlide {
          from { opacity: 0; transform: translateY(-6px) scaleY(.96); }
          to   { opacity: 1; transform: translateY(0)   scaleY(1); }
        }

        .atc-root {
          font-family: 'DM Sans', sans-serif;
          background: #FFFFFF;
          border-radius: 18px;
          border: 1px solid #E8ECF0;
          box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 8px 32px rgba(0,0,0,.06);
          overflow: hidden;
          animation: fadeUp .32s ease-out both;
        }
        .atc-stage {
          display: flex; align-items: center; justify-content: space-between;
          gap: 7px; padding: 10px 12px 10px 16px;
          border-bottom: 1px solid #F0F2F5;
          font-size: 11px; font-weight: 700;
          letter-spacing: .07em; text-transform: uppercase;
        }
        .atc-stage-left { display: flex; align-items: center; gap: 7px; }
        .atc-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .atc-dot.pulse { animation: pulseDot 1.5s ease-in-out infinite; }

        .atc-decline-pill {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 11px; border-radius: 99px;
          border: 1.5px solid #FCA5A5; background: #FFF1F2;
          font-family: 'DM Sans', sans-serif; font-size: 10px; font-weight: 700;
          color: #DC2626; cursor: pointer; letter-spacing: .04em;
          white-space: nowrap; flex-shrink: 0;
          transition: background .15s, border-color .15s, transform .1s;
        }
        .atc-decline-pill:hover  { background: #FFE4E6; border-color: #F87171; }
        .atc-decline-pill:active { transform: scale(.96); }
        .atc-decline-pill.active {
          background: #FEE2E2; border-color: #F87171;
        }

        .atc-confirm-banner {
          margin: 10px 14px 0; padding: 14px;
          background: #FFF7ED; border: 1.5px solid #FED7AA; border-radius: 14px;
          animation: confirmSlide .2s ease-out both;
        }
        .atc-confirm-title {
          display: flex; align-items: center; gap: 7px;
          font-size: 13px; font-weight: 700; color: #92400E; margin-bottom: 6px;
        }
        .atc-confirm-body {
          font-size: 12px; color: #B45309; line-height: 1.55; margin-bottom: 13px;
        }
        .atc-confirm-actions { display: flex; gap: 8px; }
        .atc-confirm-keep {
          flex: 1; padding: 9px 0; border-radius: 9px;
          border: 1.5px solid #FED7AA; background: #fff;
          font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 700;
          color: #92400E; cursor: pointer; transition: background .13s;
        }
        .atc-confirm-keep:hover { background: #FEF3C7; }
        .atc-confirm-yes {
          flex: 1; padding: 9px 0; border-radius: 9px;
          border: none; background: #DC2626;
          font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 700;
          color: #fff; cursor: pointer; transition: filter .13s;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .atc-confirm-yes:hover    { filter: brightness(1.08); }
        .atc-confirm-yes:active   { filter: brightness(.94);  }
        .atc-confirm-yes:disabled { opacity: .65; cursor: not-allowed; filter: none; }

        .atc-decline-error {
          margin: 7px 14px 0; padding: 0;
          font-size: 11px; font-weight: 600; color: #DC2626; text-align: center;
          font-family: 'DM Sans', sans-serif;
        }

        .atc-body { padding: 18px 16px 0; }
        .atc-timeline { position: relative; padding-left: 26px; display: flex; flex-direction: column; }
        .atc-timeline-track {
          position: absolute; left: 9px; top: 20px; bottom: 20px;
          width: 1.5px;
          background: linear-gradient(to bottom, #3B82F6 0%, #10B981 100%);
          opacity: .25; border-radius: 2px;
        }
        .atc-stop { position: relative; padding-bottom: 16px; transition: opacity .2s; }
        .atc-stop.dimmed { opacity: .3; }
        .atc-stop-node {
          position: absolute; left: -17px; top: 5px;
          width: 10px; height: 10px;
          border-radius: 50%; border-width: 2px; border-style: solid; background: #fff;
        }
        .atc-stop-tag { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #B0B8C4; margin-bottom: 2px; }
        .atc-stop-addr { font-size: 13.5px; font-weight: 500; color: #1A1F2E; line-height: 1.4; flex: 1; }
        .atc-stop-row { display: flex; align-items: center; gap: 8px; }
        .atc-divider { height: 1px; background: #F0F2F5; margin: 16px 0 0; }

        .atc-stats { display: grid; grid-template-columns: repeat(3, 1fr); padding: 14px 16px; }
        .atc-stat { display: flex; flex-direction: column; gap: 3px; }
        .atc-stat + .atc-stat { padding-left: 14px; border-left: 1px solid #EDF0F4; }
        .atc-stat-value { font-family: 'DM Mono', monospace; font-size: 14.5px; font-weight: 500; color: #1A1F2E; letter-spacing: -.01em; }
        .atc-stat-key { font-size: 10px; font-weight: 600; letter-spacing: .055em; text-transform: uppercase; color: #B0B8C4; }

        .atc-map-btn {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 4px; border: 1px solid #DAEAFF; border-radius: 7px;
          background: #EFF6FF; color: #3B82F6; cursor: pointer; flex-shrink: 0;
          transition: background .13s, border-color .13s, transform .1s; line-height: 0;
        }
        .atc-map-btn:hover  { background: #DBEAFE; border-color: #BFDBFE; }
        .atc-map-btn:active { transform: scale(.93); }
        .atc-map-btn.green { background: #ECFDF5; border-color: #A7F3D0; color: #10B981; }
        .atc-map-btn.green:hover { background: #D1FAE5; border-color: #6EE7B7; }

        .atc-cta-wrap { padding: 0 14px 14px; }
        .atc-cta {
          display: flex; align-items: center; justify-content: space-between;
          width: 100%; padding: 14px 18px; border: none; border-radius: 12px;
          font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 700;
          color: #fff; cursor: pointer; transition: filter .13s, transform .1s; letter-spacing: .02em;
        }
        .atc-cta:hover  { filter: brightness(1.08); }
        .atc-cta:active { filter: brightness(.94); transform: scale(.99); }
        .atc-cta-arrow {
          display: flex; align-items: center; justify-content: center;
          width: 26px; height: 26px; border-radius: 50%;
          background: rgba(255,255,255,.22); flex-shrink: 0;
        }

        .atc-msg-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 14px 14px;
        }
        .atc-msg-btn {
          display: flex; align-items: center; gap: 7px;
          background: none; border: 1.5px solid #E8ECF0; border-radius: 10px;
          padding: 8px 14px; font-family: 'DM Sans', sans-serif;
          font-size: 12px; font-weight: 700; cursor: pointer;
          transition: all .18s; color: #6B7280;
        }
        .atc-msg-btn.active { border-color: var(--accent); color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); }
        .atc-msg-btn:hover  { border-color: var(--accent); color: var(--accent); }
        .atc-icon-wrap {
          position: relative; display: inline-flex;
          align-items: center; justify-content: center; flex-shrink: 0;
        }
        .atc-unread-badge {
          position: absolute; top: -6px; right: -8px;
          background: #EF4444; color: #fff;
          font-size: 9px; font-weight: 800; line-height: 1;
          min-width: 15px; height: 15px; border-radius: 99px; padding: 0 3px;
          display: flex; align-items: center; justify-content: center;
          border: 1.5px solid #fff; pointer-events: none;
        }

        .atc-msg-panel {
          margin: 0 14px 14px; border: 1.5px solid #E8ECF0;
          border-radius: 16px; overflow: hidden;
          animation: msgSlideIn .22s ease-out both;
        }
        .atc-msg-list {
          min-height: 140px; max-height: 220px; overflow-y: auto;
          -webkit-overflow-scrolling: touch; padding: 12px 14px;
          display: flex; flex-direction: column; gap: 8px;
          background: #fff; overscroll-behavior: contain; scroll-behavior: smooth;
        }
        .atc-msg-empty {
          text-align: center; color: #B0B8C4; font-size: 12px; font-weight: 500; margin-top: 20px;
        }
        .atc-quick-row { display: flex; gap: 6px; padding: 0 14px 8px; flex-wrap: wrap; background: #fff; }
        .atc-quick-btn {
          background: none; border: 1px solid #E8ECF0; border-radius: 99px;
          padding: 4px 10px; font-size: 11px; font-weight: 600;
          color: #9CA3AF; cursor: pointer; white-space: nowrap;
          transition: all .15s; font-family: 'DM Sans', sans-serif;
        }
        .atc-quick-btn:hover { border-color: var(--accent); color: var(--accent); }
        .atc-msg-input-row {
          display: flex; gap: 8px; padding: 8px 12px 12px;
          border-top: 1px solid #F0F2F5; align-items: flex-end; background: #fff;
        }
        .atc-textarea {
          flex: 1; resize: none; background: #F9FAFB;
          border: 1.5px solid #E8ECF0; border-radius: 10px;
          padding: 9px 12px; font-size: 13px; color: #1A1F2E;
          font-family: 'DM Sans', sans-serif; outline: none;
          line-height: 1.4; max-height: 72px; overflow-y: auto;
          transition: border-color .18s;
        }
        .atc-textarea:focus { border-color: var(--accent); }
        .atc-send-btn {
          width: 38px; height: 38px; border-radius: 10px; border: none;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; flex-shrink: 0; transition: all .18s;
        }
      `}</style>

      <div className="atc-root" style={{ "--accent": accent }}>

        {/* ── Stage strip with inline decline pill ── */}
        <div className="atc-stage" style={{ color: accent }}>
          <div className="atc-stage-left">
            <div className={`atc-dot${stage.pulse ? " pulse" : ""}`} style={{ background: accent }} />
            {stage.icon}
            {stage.label}
          </div>

          {tripStage === "driver_assigned" && (
            <button
              className={`atc-decline-pill${declinePhase === "confirm" ? " active" : ""}`}
              onClick={() => {
                if (declinePhase === "idle") setDeclinePhase("confirm");
                else if (declinePhase === "confirm") setDeclinePhase("idle");
              }}
              disabled={declinePhase === "loading"}
            >
              {declinePhase === "loading" ? (
                <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <AlertTriangle size={10} />
              )}
              {declinePhase === "loading" ? "Declining…" : declinePhase === "confirm" ? "Cancel" : "Can't do this ride"}
            </button>
          )}
        </div>

        {/* ── Confirm banner — slides in just below the strip ── */}
        {tripStage === "driver_assigned" && declinePhase === "confirm" && (
          <div className="atc-confirm-banner">
            <div className="atc-confirm-title">
              <AlertTriangle size={14} color="#D97706" />
              Decline this ride?
            </div>
            <div className="atc-confirm-body">
              The ride will return to the search pool and another driver will be assigned. Only decline if you genuinely cannot complete it.
            </div>
            <div className="atc-confirm-actions">
              <button className="atc-confirm-keep" onClick={() => setDeclinePhase("idle")}>
                Keep Ride
              </button>
              <button
                className="atc-confirm-yes"
                onClick={handleDeclineConfirm}
                disabled={declinePhase === "loading"}
              >
                {declinePhase === "loading" && (
                  <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                )}
                Yes, Decline
              </button>
            </div>
          </div>
        )}

        {declineError && (
          <div className="atc-decline-error">{declineError}</div>
        )}

        {/* ── Route timeline ── */}
        <div className="atc-body">
          <div className="atc-timeline">
            <div className="atc-timeline-track" />
            <div className={`atc-stop${isInProgress ? " dimmed" : ""}`}>
              <div className="atc-stop-node" style={{ borderColor: "#3B82F6" }} />
              <div className="atc-stop-tag">Pickup</div>
              <div className="atc-stop-row">
                <div className="atc-stop-addr">{activeTrip.pickup}</div>
                {!isInProgress && (
                  <button className="atc-map-btn" onClick={() => openInMaps(activeTrip.pickup)} title="Open in Maps">
                    <MapPin size={13} strokeWidth={2.2} />
                  </button>
                )}
              </div>
            </div>
            <div className={`atc-stop${tripStage === "driver_assigned" ? " dimmed" : ""}`} style={{ paddingBottom: 0 }}>
              <div className="atc-stop-node" style={{ borderColor: "#10B981" }} />
              <div className="atc-stop-tag">Dropoff</div>
              <div className="atc-stop-row">
                <div className="atc-stop-addr">{activeTrip.dropoff}</div>
                {isInProgress && (
                  <button className="atc-map-btn green" onClick={() => openInMaps(activeTrip.dropoff)} title="Open in Maps">
                    <MapPin size={13} strokeWidth={2.2} color="#10B981" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="atc-divider" />
        <div className="atc-stats">
          {[
            { value: `$${activeTrip.driverPayout?.toFixed(2) ?? "--"}`,       key: "Payout"    },
            { value: `${activeTrip.tripDistanceMiles?.toFixed(1) ?? "--"} mi`, key: "Distance"  },
            { value: `${activeTrip.tripDurationMin ?? "--"} min`,              key: "Est. Time" },
          ].map((item, i) => (
            <div key={i} className="atc-stat">
              <span className="atc-stat-value">{item.value}</span>
              <span className="atc-stat-key">{item.key}</span>
            </div>
          ))}
        </div>

        {/* ── Message toggle ── */}
        <div className="atc-divider" />
        <div className="atc-msg-row">
          <button
            className={`atc-msg-btn${showMessages ? " active" : ""}`}
            onClick={() => setShowMessages(v => !v)}
          >
            <span className="atc-icon-wrap">
              <MessageCircle size={13} />
              {unreadCount > 0 && (
                <span className="atc-unread-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </span>
            {showMessages ? "Hide Messages" : "Message Rider"}
          </button>
          {showMessages && (
            <button
              onClick={() => setShowMessages(false)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 11, fontWeight: 700, color: "#9CA3AF", padding: "4px 8px",
              }}
            >
              <ChevronDown size={13} /> Hide
            </button>
          )}
        </div>

        {showMessages && rideId && (
          <DriverMessagePanel
            rideId={rideId}
            accent={accent}
            onUnreadChange={setUnreadCount}
          />
        )}

        {/* ── CTA ── */}
        <div className="atc-cta-wrap">
          <button
            className="atc-cta"
            style={{ background: accent, opacity: advancePending ? 0.7 : 1, cursor: advancePending ? "not-allowed" : "pointer" }}
            onClick={onAdvance}
            disabled={advancePending}
          >
            {advancePending ? (
              <>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
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

// ── Driver message panel ──────────────────────────────────────────────────────
function DriverMessagePanel({ rideId, accent, onUnreadChange }) {
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState("");
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const listRef        = useRef(null);
  const bottomRef      = useRef(null);
  const isAtBottomRef  = useRef(true);
  const justSentRef    = useRef(false);
  const auth           = getAuth();
  const db             = getFirestore();
  const driverUid      = auth.currentUser?.uid ?? null;

  const QUICK_REPLIES = ["On my way 🚗", "I've arrived!", "Calling you now", "1 min away"];

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  useEffect(() => {
    if (!rideId) return;
    const ref = query(collection(db, "Rides", rideId, "Messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(ref, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      const unread = msgs.filter(m => m.senderRole === "rider" && !m.readByDriver).length;
      onUnreadChange?.(unread);
    });
    return () => unsub();
  }, [rideId]);

  useEffect(() => {
    if (!rideId) return;
    messages.forEach(msg => {
      if (msg.senderRole === "rider" && !msg.readByDriver) {
        updateDoc(doc(db, "Rides", rideId, "Messages", msg.id), { readByDriver: true }).catch(() => {});
      }
    });
  }, [messages, rideId]);

  useEffect(() => {
    if (!bottomRef.current) return;
    if (isAtBottomRef.current || justSentRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
      justSentRef.current = false;
    }
  }, [messages]);

  async function sendMessage(text) {
    const trimmed = (text ?? input).trim();
    if (!trimmed || !rideId || !driverUid) return;
    setSending(true);
    justSentRef.current = true;
    try {
      await addDoc(collection(db, "Rides", rideId, "Messages"), {
        text: trimmed, senderUid: driverUid, senderRole: "driver",
        createdAt: serverTimestamp(), readByDriver: true, readByRider: false,
      });
      setInput("");
      setSent(true);
      setTimeout(() => setSent(false), 2000);
    } catch (err) {
      console.error("Driver message send failed:", err);
      justSentRef.current = false;
    } finally {
      setSending(false);
    }
  }

  function formatTime(ts) {
    if (!ts?.seconds) return "";
    return new Date(ts.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="atc-msg-panel">
      <div className="atc-msg-list" ref={listRef} onScroll={handleScroll}>
        {messages.length === 0 && (
          <div className="atc-msg-empty">No messages yet. Say hi to your rider!</div>
        )}
        {(() => {
          const lastDriverIdx = messages.reduce((acc, m, i) => m.senderRole === "driver" ? i : acc, -1);
          return messages.map((msg, idx) => {
            const isDriver   = msg.senderRole === "driver";
            const isLastSent = isDriver && idx === lastDriverIdx;
            const seen       = isLastSent && msg.readByRider === true;
            return (
              <div key={msg.id} style={{ display: "flex", justifyContent: isDriver ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "78%", padding: "9px 13px",
                  borderRadius: isDriver ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: isDriver ? `linear-gradient(135deg, ${accent}, ${accent}cc)` : "#F3F4F6",
                  border: isDriver ? "none" : "1px solid #E8ECF0",
                  boxShadow: isDriver ? `0 2px 10px ${accent}30` : "none",
                }}>
                  {!isDriver && (
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 3 }}>
                      Rider
                    </div>
                  )}
                  <div style={{ fontSize: 13, fontWeight: 500, color: isDriver ? "#fff" : "#1A1F2E", lineHeight: 1.4 }}>
                    {msg.text}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: isDriver ? "flex-end" : "flex-start", gap: 3, marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: isDriver ? "rgba(255,255,255,.6)" : "#9CA3AF" }}>
                      {formatTime(msg.createdAt)}
                    </span>
                    {isLastSent && (
                      <span style={{ display: "inline-flex", alignItems: "center", position: "relative", width: 18, height: 11, flexShrink: 0 }}>
                        <svg width="11" height="8" viewBox="0 0 11 8" fill="none" style={{ position: "absolute", left: seen ? "0px" : "3px", transition: "left .2s ease" }}>
                          <path d="M1 4L3.5 6.5L9.5 1" stroke={seen ? accent : "rgba(255,255,255,.55)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <svg width="11" height="8" viewBox="0 0 11 8" fill="none" style={{ position: "absolute", right: "0px", opacity: seen ? 1 : 0, transition: "opacity .25s ease" }}>
                          <path d="M1 4L3.5 6.5L9.5 1" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          });
        })()}
        <div ref={bottomRef} style={{ height: 1 }} />
      </div>

      <div className="atc-quick-row">
        {QUICK_REPLIES.map(qr => (
          <button key={qr} className="atc-quick-btn" onClick={() => sendMessage(qr)} style={{ "--accent": accent }}>
            {qr}
          </button>
        ))}
      </div>

      <div className="atc-msg-input-row">
        <textarea
          className="atc-textarea"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Type a message…"
          rows={1}
          style={{ "--accent": accent }}
        />
        <button
          className="atc-send-btn"
          onClick={() => sendMessage()}
          disabled={!input.trim() || sending}
          style={{
            background: !input.trim() || sending ? "#F3F4F6" : `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            cursor: !input.trim() || sending ? "not-allowed" : "pointer",
            boxShadow: input.trim() ? `0 2px 10px ${accent}35` : "none",
          }}
        >
          {sent
            ? <Check size={15} color="#fff" strokeWidth={3} />
            : <Send size={14} color={!input.trim() || sending ? "#9CA3AF" : "#fff"} />
          }
        </button>
      </div>
    </div>
  );
}