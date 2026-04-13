import { useEffect, useRef, useState } from "react";
import { MapPin, Flag, Navigation, ChevronRight, Loader2, MessageCircle, Send, Check, ChevronDown, X } from "lucide-react";
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
 * ActiveTripCard – with driver ↔ rider messaging
 *
 * Props:
 *   activeTrip      — trip object | null
 *   tripStage       — "driver_assigned" | "arrived" | "in_progress"
 *   tripStageColor  — hex color for the current stage
 *   tripBtnLabel    — CTA button label string
 *   onAdvance       — handler called when CTA is tapped
 *   advancePending  — bool, disables CTA while Cloud Function is in-flight
 */
export default function ActiveTripCard({
  activeTrip,
  tripStage,
  tripStageColor,
  tripBtnLabel,
  onAdvance,
  advancePending,
}) {
  const [showMessages, setShowMessages] = useState(false);
  const [unreadCount, setUnreadCount]   = useState(0);

  if (!activeTrip) return null;

  const rideId = activeTrip.id ?? activeTrip.rideId;
  const accent = tripStageColor ?? "#2563EB";

  const stageConfig = {
    driver_assigned: { icon: <Navigation size={12} />, label: "En Route to Pickup", pulse: true  },
    arrived:         { icon: <MapPin size={12} />,     label: "Waiting for Rider",   pulse: false },
    in_progress:     { icon: <Flag size={12} />,       label: "Trip In Progress",     pulse: true  },
  };

  const stage       = stageConfig[tripStage] ?? stageConfig.driver_assigned;
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
        .atc-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .atc-dot.pulse { animation: pulseDot 1.5s ease-in-out infinite; }
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

        /* ── Message button row ── */
        .atc-msg-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
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
        /* wrapper keeps badge positioned relative to the icon only */
        .atc-icon-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .atc-unread-badge {
          position: absolute; top: -6px; right: -8px;
          background: #EF4444; color: #fff;
          font-size: 9px; font-weight: 800; line-height: 1;
          min-width: 15px; height: 15px; border-radius: 99px;
          padding: 0 3px;
          display: flex; align-items: center; justify-content: center;
          border: 1.5px solid #fff;
          pointer-events: none;
        }

        /* ── Message panel ── */
        .atc-msg-panel {
          margin: 0 14px 14px;
          border: 1.5px solid #E8ECF0;
          border-radius: 16px;
          overflow: hidden;
          animation: msgSlideIn .22s ease-out both;
        }
        .atc-msg-panel-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 11px 14px;
          border-bottom: 1px solid #F0F2F5;
          background: #F9FAFB;
        }
        .atc-msg-panel-title {
          display: flex; align-items: center; gap: 7px;
          font-size: 12px; font-weight: 700; color: #374151;
        }
        .atc-msg-list {
          min-height: 140px; max-height: 220px;
          overflow-y: auto; padding: 12px 14px;
          display: flex; flex-direction: column; gap: 8px;
          background: #fff;
          overscroll-behavior: contain;
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

        {/* Stage strip */}
        <div className="atc-stage" style={{ color: accent }}>
          <div className={`atc-dot${stage.pulse ? " pulse" : ""}`} style={{ background: accent }} />
          {stage.icon}
          {stage.label}
        </div>

        {/* Route timeline */}
        <div className="atc-body">
          <div className="atc-timeline">
            <div className="atc-timeline-track" />
            {/* Pickup */}
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
            {/* Dropoff */}
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

        {/* Stats */}
        <div className="atc-divider" />
        <div className="atc-stats">
          {[
            { value: `$${activeTrip.driverPayout?.toFixed(2) ?? "--"}`, key: "Payout" },
            { value: `${activeTrip.tripDistanceMiles?.toFixed(1) ?? "--"} mi`, key: "Distance" },
            { value: `${activeTrip.tripDurationMin ?? "--"} min`, key: "Est. Time" },
          ].map((item, i) => (
            <div key={i} className="atc-stat">
              <span className="atc-stat-value">{item.value}</span>
              <span className="atc-stat-key">{item.key}</span>
            </div>
          ))}
        </div>

        {/* Message toggle button */}
        <div className="atc-divider" />
        <div className="atc-msg-row">
          <button
            className={`atc-msg-btn${showMessages ? " active" : ""}`}
            onClick={() => setShowMessages((v) => !v)}
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
                display: "flex", alignItems: "center", gap: "4px",
                fontSize: "11px", fontWeight: 700, color: "#9CA3AF", padding: "4px 8px",
              }}
            >
              <ChevronDown size={13} /> Hide
            </button>
          )}
        </div>

        {/* Message panel */}
        {showMessages && rideId && (
          <DriverMessagePanel
            rideId={rideId}
            accent={accent}
            onUnreadChange={setUnreadCount}
          />
        )}

        {/* CTA */}
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
  const [input, setInput]       = useState("");
  const [sending, setSending]   = useState(false);
  const [sent, setSent]         = useState(false);
  const bottomRef               = useRef(null);
  const auth                    = getAuth();
  const db                      = getFirestore();
  const driverUid               = auth.currentUser?.uid ?? null;

  const QUICK_REPLIES = [
    "On my way 🚗",
    "I've arrived!",
    "Calling you now",
    "1 min away",
  ];

  // ── Subscribe to messages ───────────────────────────────
  useEffect(() => {
    if (!rideId) return;
    const ref  = query(
      collection(db, "Rides", rideId, "Messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(ref, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);

      // Count unread (rider messages not yet read by driver)
      const unread = msgs.filter(
        (m) => m.senderRole === "rider" && !m.readByDriver
      ).length;
      onUnreadChange?.(unread);
    });
    return () => unsub();
  }, [rideId]);

  // ── Mark rider messages as read when panel opens ────────
  useEffect(() => {
    if (!rideId) return;
    messages.forEach((msg) => {
      if (msg.senderRole === "rider" && !msg.readByDriver) {
        updateDoc(doc(db, "Rides", rideId, "Messages", msg.id), {
          readByDriver: true,
        }).catch(() => {});
      }
    });
  }, [messages, rideId]);

  // ── Auto-scroll ─────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send ────────────────────────────────────────────────
  async function sendMessage(text) {
    const trimmed = (text ?? input).trim();
    if (!trimmed || !rideId || !driverUid) return;
    setSending(true);
    try {
      await addDoc(collection(db, "Rides", rideId, "Messages"), {
        text: trimmed,
        senderUid:  driverUid,
        senderRole: "driver",
        createdAt:  serverTimestamp(),
        readByDriver: true,
      });
      setInput("");
      setSent(true);
      setTimeout(() => setSent(false), 2000);
    } catch (err) {
      console.error("Driver message send failed:", err);
    } finally {
      setSending(false);
    }
  }

  function formatTime(ts) {
    if (!ts?.seconds) return "";
    return new Date(ts.seconds * 1000).toLocaleTimeString([], {
      hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <div className="atc-msg-panel">
      {/* Message list */}
      <div className="atc-msg-list">
        {messages.length === 0 && (
          <div className="atc-msg-empty">No messages yet. Say hi to your rider!</div>
        )}
        {messages.map((msg) => {
          const isDriver = msg.senderRole === "driver";
          return (
            <div
              key={msg.id}
              style={{ display: "flex", justifyContent: isDriver ? "flex-end" : "flex-start" }}
            >
              <div
                style={{
                  maxWidth: "78%",
                  padding: "9px 13px",
                  borderRadius: isDriver ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: isDriver
                    ? `linear-gradient(135deg, ${accent}, ${accent}cc)`
                    : "#F3F4F6",
                  border: isDriver ? "none" : "1px solid #E8ECF0",
                  boxShadow: isDriver ? `0 2px 10px ${accent}30` : "none",
                }}
              >
                {/* "Rider" label on incoming messages */}
                {!isDriver && (
                  <div style={{
                    fontSize: "9px", fontWeight: 700, color: "#9CA3AF",
                    letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "3px",
                  }}>
                    Rider
                  </div>
                )}
                <div style={{
                  fontSize: "13px", fontWeight: 500,
                  color: isDriver ? "#fff" : "#1A1F2E", lineHeight: 1.4,
                }}>
                  {msg.text}
                </div>
                <div style={{
                  fontSize: "10px",
                  color: isDriver ? "rgba(255,255,255,.6)" : "#9CA3AF",
                  marginTop: "4px",
                  textAlign: isDriver ? "right" : "left",
                }}>
                  {formatTime(msg.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      <div className="atc-quick-row">
        {QUICK_REPLIES.map((qr) => (
          <button key={qr} className="atc-quick-btn" onClick={() => sendMessage(qr)}
            style={{ "--accent": accent }}>
            {qr}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="atc-msg-input-row">
        <textarea
          className="atc-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Type a message…"
          rows={1}
          style={{ "--accent": accent }}
        />
        <button
          className="atc-send-btn"
          onClick={() => sendMessage()}
          disabled={!input.trim() || sending}
          style={{
            background: !input.trim() || sending
              ? "#F3F4F6"
              : `linear-gradient(135deg, ${accent}, ${accent}cc)`,
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