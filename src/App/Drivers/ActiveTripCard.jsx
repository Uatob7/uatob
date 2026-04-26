import { useEffect, useRef, useState } from "react";
import {
  MapPin, Flag, Navigation, ChevronRight, Loader2, MessageCircle,
  Send, Check, ChevronDown, X, AlertTriangle, UserX, Phone,
} from "lucide-react";
import {
  getFirestore, collection, onSnapshot, addDoc, serverTimestamp,
  query, orderBy, updateDoc, doc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebase_app } from "@/firebase/config";

const functions        = getFunctions(firebase_app, "us-east1");
const callReassignRide = httpsCallable(functions, "reassignRide");

// ─── Stage config ────────────────────────────────────────────────────────────
const STAGES = {
  driver_assigned: { label: "En Route to Pickup", color: "#38BDF8", dot: true },
  arrived:         { label: "Awaiting Rider",      color: "#A78BFA", dot: false },
  in_progress:     { label: "Trip in Progress",    color: "#34D399", dot: true },
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function ActiveTripCard({
  activeTrip, tripStage, tripStageColor, tripBtnLabel,
  onAdvance, advancePending, onUnreadChange,
}) {
  const [showMessages, setShowMessages] = useState(false);
  const [unreadCount,  setUnreadCount]  = useState(0);
  const [showReassign, setShowReassign] = useState(false);
  const [reassigning,  setReassigning]  = useState(false);
  const [reassignError,setReassignError]= useState("");

  useEffect(() => { onUnreadChange?.(unreadCount); }, [unreadCount, onUnreadChange]);

  if (!activeTrip) return null;

  const rideId     = activeTrip.id ?? activeTrip.rideId;
  const stageData  = STAGES[tripStage] ?? STAGES.driver_assigned;
  const accent     = tripStageColor ?? stageData.color;
  const isProgress = tripStage === "in_progress";
  const canReassign= tripStage === "driver_assigned";

  const openInMaps = (addr) => addr &&
    window.open(`https://maps.google.com/?q=${encodeURIComponent(addr)}`, "_blank");

  const handleReassign = async () => {
    if (reassigning) return;
    setReassigning(true); setReassignError("");
    try {
      const auth = getAuth();
      const { data } = await callReassignRide({ rideId, driverUid: auth.currentUser?.uid });
      if (data?.error) throw new Error(data.error);
      setShowReassign(false);
    } catch (err) {
      setReassignError(err.message || "Failed to reassign ride");
    } finally { setReassigning(false); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500&family=Outfit:wght@400;500;600&display=swap');

        :root { --atc-accent: ${accent}; }

        @keyframes atc-pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.5)} }
        @keyframes atc-in     { from{opacity:0;transform:translateY(10px) scale(.98)} to{opacity:1;transform:none} }
        @keyframes atc-spin   { to{transform:rotate(360deg)} }
        @keyframes atc-shimmer{ from{background-position:200% 0} to{background-position:-200% 0} }
        @keyframes atc-modal  { from{opacity:0;transform:scale(.9) translateY(16px)} to{opacity:1;transform:none} }
        @keyframes atc-msg-in { from{opacity:0;max-height:0} to{opacity:1;max-height:500px} }
        @keyframes atc-glow   { 0%,100%{box-shadow:0 0 20px ${accent}40} 50%{box-shadow:0 0 36px ${accent}70} }

        .atc-wrap * { box-sizing:border-box; }

        .atc-wrap {
          font-family:'Outfit',sans-serif;
          background:#0C0E14;
          border-radius:22px;
          border:1px solid rgba(255,255,255,.07);
          overflow:hidden;
          animation:atc-in .38s cubic-bezier(.22,1,.36,1) both;
          position:relative;
          box-shadow:0 2px 4px rgba(0,0,0,.4), 0 20px 60px rgba(0,0,0,.6);
        }

        /* Ambient glow strip at top */
        .atc-glow-bar {
          height:3px;
          background:linear-gradient(90deg, transparent 0%, ${accent} 40%, ${accent}aa 70%, transparent 100%);
          opacity:.85;
          transition:background .4s;
        }

        /* Stage header */
        .atc-stage-row {
          display:flex; align-items:center; justify-content:space-between;
          padding:13px 18px 10px;
          border-bottom:1px solid rgba(255,255,255,.05);
        }
        .atc-stage-left { display:flex; align-items:center; gap:9px; }
        .atc-stage-dot {
          width:8px; height:8px; border-radius:50%;
          background:${accent};
          box-shadow:0 0 8px ${accent};
          flex-shrink:0;
          animation:${stageData.dot ? "atc-pulse 1.6s ease-in-out infinite" : "none"};
        }
        .atc-stage-label {
          font-family:'Syne',sans-serif;
          font-size:11.5px; font-weight:700;
          letter-spacing:.12em; text-transform:uppercase;
          color:${accent};
        }
        .atc-fare-chip {
          font-family:'IBM Plex Mono',monospace;
          font-size:13px; font-weight:500;
          color:#fff; letter-spacing:-.01em;
          background:rgba(255,255,255,.06);
          border:1px solid rgba(255,255,255,.1);
          border-radius:8px; padding:4px 10px;
        }

        /* Route section */
        .atc-route { padding:18px 18px 14px; display:flex; flex-direction:column; gap:0; }
        .atc-route-line {
          display:flex; align-items:stretch; gap:14px;
        }
        .atc-rail {
          display:flex; flex-direction:column; align-items:center; flex-shrink:0;
          padding:4px 0;
        }
        .atc-node {
          width:11px; height:11px; border-radius:50%;
          border:2px solid;
          background:#0C0E14;
          flex-shrink:0; z-index:1;
          transition:border-color .3s, box-shadow .3s;
        }
        .atc-node.pickup  { border-color:#38BDF8; box-shadow:0 0 8px #38BDF840; }
        .atc-node.dropoff { border-color:#34D399; box-shadow:0 0 8px #34D39940; }
        .atc-connector {
          width:1.5px; flex:1; min-height:28px;
          background:linear-gradient(to bottom, #38BDF830, #34D39930);
          margin:4px 0;
          border-radius:2px;
        }
        .atc-stop-content { flex:1; padding-bottom:18px; }
        .atc-stop-content:last-child { padding-bottom:0; }
        .atc-stop-tag {
          font-size:9.5px; font-weight:700; letter-spacing:.1em; text-transform:uppercase;
          color:rgba(255,255,255,.3); margin-bottom:3px;
        }
        .atc-stop-row { display:flex; align-items:center; gap:8px; }
        .atc-stop-addr {
          font-size:13.5px; font-weight:500; color:rgba(255,255,255,.88);
          line-height:1.35; flex:1;
          opacity:${isProgress ? ".38" : "1"};
          transition:opacity .3s;
        }
        .atc-stop-addr.dropoff-addr { opacity:${!isProgress ? ".38" : "1"}; }
        .atc-map-pill {
          display:inline-flex; align-items:center; gap:4px;
          padding:4px 9px; border-radius:99px;
          font-size:10px; font-weight:700;
          cursor:pointer; border:none;
          transition:all .15s; flex-shrink:0;
          font-family:'Outfit',sans-serif;
        }
        .atc-map-pill.blue {
          background:rgba(56,189,248,.12);
          color:#38BDF8; border:1px solid rgba(56,189,248,.25);
        }
        .atc-map-pill.green {
          background:rgba(52,211,153,.12);
          color:#34D399; border:1px solid rgba(52,211,153,.25);
        }
        .atc-map-pill:hover { filter:brightness(1.2); transform:scale(1.04); }
        .atc-map-pill:active { transform:scale(.97); }

        /* Stats bar */
        .atc-stats-bar {
          display:grid; grid-template-columns:repeat(3,1fr);
          margin:0 14px;
          background:rgba(255,255,255,.03);
          border:1px solid rgba(255,255,255,.06);
          border-radius:14px;
          overflow:hidden;
        }
        .atc-stat-cell {
          padding:12px 14px;
          display:flex; flex-direction:column; gap:3px;
        }
        .atc-stat-cell + .atc-stat-cell {
          border-left:1px solid rgba(255,255,255,.06);
        }
        .atc-stat-val {
          font-family:'IBM Plex Mono',monospace;
          font-size:15px; font-weight:500;
          color:#fff; letter-spacing:-.02em;
        }
        .atc-stat-key {
          font-size:9.5px; font-weight:600; letter-spacing:.09em;
          text-transform:uppercase; color:rgba(255,255,255,.3);
        }

        /* Divider */
        .atc-divider { height:1px; background:rgba(255,255,255,.05); margin:14px 0; }

        /* Message toggle */
        .atc-msg-toggle-row {
          display:flex; align-items:center; justify-content:space-between;
          padding:0 16px 12px;
        }
        .atc-msg-toggle {
          display:flex; align-items:center; gap:8px;
          background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.09);
          border-radius:99px; padding:7px 14px;
          font-family:'Outfit',sans-serif; font-size:12px; font-weight:600;
          color:rgba(255,255,255,.55); cursor:pointer;
          transition:all .18s; position:relative;
        }
        .atc-msg-toggle.has-msg { border-color:${accent}50; color:${accent}; background:${accent}12; }
        .atc-msg-toggle:hover { border-color:rgba(255,255,255,.2); color:rgba(255,255,255,.8); }
        .atc-msg-toggle.has-msg:hover { border-color:${accent}80; }
        .atc-badge {
          position:absolute; top:-5px; right:-5px;
          background:#EF4444; color:#fff;
          font-size:9px; font-weight:800; min-width:16px; height:16px;
          border-radius:99px; padding:0 4px;
          display:flex; align-items:center; justify-content:center;
          border:2px solid #0C0E14;
        }
        .atc-msg-close {
          background:none; border:none; cursor:pointer;
          color:rgba(255,255,255,.25); padding:4px;
          transition:color .15s; display:flex;
          font-family:'Outfit',sans-serif; font-size:11px; font-weight:600;
          align-items:center; gap:4px;
        }
        .atc-msg-close:hover { color:rgba(255,255,255,.5); }

        /* Message panel */
        .atc-msg-panel {
          margin:0 14px 12px;
          border:1px solid rgba(255,255,255,.07);
          border-radius:16px; overflow:hidden;
          animation:atc-msg-in .22s ease-out both;
        }
        .atc-msg-header {
          padding:10px 14px;
          border-bottom:1px solid rgba(255,255,255,.06);
          background:rgba(255,255,255,.03);
          font-size:11px; font-weight:700; letter-spacing:.06em;
          text-transform:uppercase; color:rgba(255,255,255,.35);
        }
        .atc-msg-list {
          min-height:100px; max-height:180px; overflow-y:auto;
          padding:10px 12px; display:flex; flex-direction:column; gap:7px;
          background:#0C0E14; overscroll-behavior:contain; scroll-behavior:smooth;
        }
        .atc-msg-empty {
          text-align:center; color:rgba(255,255,255,.2);
          font-size:12px; margin-top:16px;
        }
        .atc-quick-row {
          display:flex; gap:5px; padding:8px 12px;
          flex-wrap:wrap; background:rgba(255,255,255,.02);
          border-top:1px solid rgba(255,255,255,.04);
        }
        .atc-quick {
          background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.09);
          border-radius:99px; padding:4px 10px;
          font-size:10.5px; font-weight:600; color:rgba(255,255,255,.45);
          cursor:pointer; font-family:'Outfit',sans-serif; transition:all .13s;
          white-space:nowrap;
        }
        .atc-quick:hover { background:rgba(255,255,255,.1); color:rgba(255,255,255,.8); }
        .atc-input-row {
          display:flex; gap:8px; padding:8px 10px 10px;
          border-top:1px solid rgba(255,255,255,.05); align-items:flex-end;
          background:#0C0E14;
        }
        .atc-textarea {
          flex:1; resize:none; background:rgba(255,255,255,.05);
          border:1px solid rgba(255,255,255,.09); border-radius:10px;
          padding:9px 12px; font-size:13px; color:rgba(255,255,255,.85);
          font-family:'Outfit',sans-serif; outline:none; line-height:1.4;
          max-height:70px; overflow-y:auto;
          transition:border-color .18s;
        }
        .atc-textarea:focus { border-color:${accent}70; }
        .atc-textarea::placeholder { color:rgba(255,255,255,.2); }
        .atc-send {
          width:38px; height:38px; border-radius:10px; border:none;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; flex-shrink:0; transition:all .15s;
        }

        /* CTA area */
        .atc-cta-area { padding:0 14px 14px; display:flex; flex-direction:column; gap:8px; }
        .atc-cta-btn {
          display:flex; align-items:center; justify-content:space-between;
          width:100%; padding:15px 20px;
          border:none; border-radius:14px;
          font-family:'Syne',sans-serif; font-size:14px; font-weight:700;
          color:#fff; cursor:pointer; letter-spacing:.04em;
          position:relative; overflow:hidden;
          transition:filter .13s, transform .1s, box-shadow .2s;
        }
        .atc-cta-btn::before {
          content:''; position:absolute; inset:0;
          background:linear-gradient(135deg, ${accent}, ${accent}bb);
          transition:opacity .2s;
        }
        .atc-cta-btn:hover { filter:brightness(1.1); transform:translateY(-1px); box-shadow:0 8px 24px ${accent}50; }
        .atc-cta-btn:active { filter:brightness(.92); transform:translateY(0); }
        .atc-cta-btn[disabled] { opacity:.5; cursor:not-allowed; transform:none !important; box-shadow:none !important; }
        .atc-cta-inner { position:relative; z-index:1; display:flex; align-items:center; justify-content:space-between; width:100%; }
        .atc-cta-arrow {
          width:28px; height:28px; border-radius:50%;
          background:rgba(255,255,255,.18);
          display:flex; align-items:center; justify-content:center;
        }
        .atc-reassign-btn {
          display:flex; align-items:center; justify-content:center; gap:7px;
          width:100%; padding:10px 14px;
          background:transparent; border:1px solid rgba(239,68,68,.25);
          border-radius:12px; cursor:pointer;
          color:rgba(239,68,68,.6); font-family:'Outfit',sans-serif;
          font-size:12px; font-weight:600;
          transition:all .15s;
        }
        .atc-reassign-btn:hover { background:rgba(239,68,68,.07); border-color:rgba(239,68,68,.5); color:#EF4444; }

        /* Modal */
        .atc-overlay {
          position:fixed; inset:0; z-index:1200;
          background:rgba(0,0,0,.7); backdrop-filter:blur(6px);
          display:flex; align-items:center; justify-content:center; padding:20px;
          animation:atc-in .15s ease-out both;
        }
        .atc-modal {
          background:#131620; border-radius:22px; max-width:320px; width:100%;
          padding:26px 24px 20px;
          border:1px solid rgba(239,68,68,.2);
          box-shadow:0 30px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(239,68,68,.08);
          animation:atc-modal .25s cubic-bezier(.34,1.56,.64,1) both;
          font-family:'Outfit',sans-serif;
        }
        .atc-modal-icon {
          width:52px; height:52px; border-radius:50%; margin:0 auto 14px;
          background:rgba(239,68,68,.1); border:1.5px solid rgba(239,68,68,.3);
          display:flex; align-items:center; justify-content:center;
        }
        .atc-modal-title { font-family:'Syne',sans-serif; font-size:17px; font-weight:800; color:#fff; text-align:center; margin-bottom:7px; }
        .atc-modal-body  { font-size:13px; color:rgba(255,255,255,.45); text-align:center; line-height:1.6; margin-bottom:20px; }
        .atc-modal-err   { background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.2); border-radius:9px; padding:8px 12px; font-size:11.5px; color:#FCA5A5; font-weight:600; margin-bottom:12px; text-align:center; }
        .atc-modal-btns  { display:flex; gap:8px; }
        .atc-modal-btn   { flex:1; padding:12px; border-radius:12px; font-size:13px; font-weight:700; font-family:'Outfit',sans-serif; cursor:pointer; transition:all .12s; display:flex; align-items:center; justify-content:center; gap:6px; }
        .atc-modal-btn.cancel  { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); color:rgba(255,255,255,.5); }
        .atc-modal-btn.cancel:hover { background:rgba(255,255,255,.1); color:rgba(255,255,255,.8); }
        .atc-modal-btn.danger  { background:linear-gradient(135deg,#EF4444,#DC2626); border:none; color:#fff; box-shadow:0 4px 16px rgba(220,38,38,.35); }
        .atc-modal-btn.danger:hover { filter:brightness(1.1); }
        .atc-modal-btn:disabled { opacity:.6; cursor:not-allowed; }
      `}</style>

      {/* Reassign modal */}
      {showReassign && (
        <div className="atc-overlay" onClick={(e) => { if (e.target === e.currentTarget && !reassigning) setShowReassign(false); }}>
          <div className="atc-modal">
            <div className="atc-modal-icon"><AlertTriangle size={24} color="#EF4444" /></div>
            <div className="atc-modal-title">Reassign this ride?</div>
            <div className="atc-modal-body">
              The rider will be matched with another driver. Frequent reassignments can affect your acceptance rate.
            </div>
            {reassignError && <div className="atc-modal-err">⚠ {reassignError}</div>}
            <div className="atc-modal-btns">
              <button className="atc-modal-btn cancel" onClick={() => setShowReassign(false)} disabled={reassigning}>Keep ride</button>
              <button className="atc-modal-btn danger" onClick={handleReassign} disabled={reassigning}>
                {reassigning
                  ? <><Loader2 size={13} style={{ animation: "atc-spin 1s linear infinite" }} /> Reassigning…</>
                  : <><UserX size={13} /> Reassign</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="atc-wrap">
        {/* Top glow bar */}
        <div className="atc-glow-bar" />

        {/* Stage + fare */}
        <div className="atc-stage-row">
          <div className="atc-stage-left">
            <div className="atc-stage-dot" />
            <span className="atc-stage-label">{stageData.label}</span>
          </div>
          <div className="atc-fare-chip">${activeTrip.driverPayout?.toFixed(2) ?? "--"}</div>
        </div>

        {/* Route */}
        <div className="atc-route">
          {/* Pickup */}
          <div className="atc-route-line">
            <div className="atc-rail">
              <div className="atc-node pickup" />
              <div className="atc-connector" />
            </div>
            <div className="atc-stop-content">
              <div className="atc-stop-tag">Pickup</div>
              <div className="atc-stop-row">
                <div className="atc-stop-addr">{activeTrip.pickup}</div>
                {!isProgress && (
                  <button className="atc-map-pill blue" onClick={() => openInMaps(activeTrip.pickup)}>
                    <MapPin size={10} strokeWidth={2.5} /> Maps
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* Dropoff */}
          <div className="atc-route-line">
            <div className="atc-rail" style={{ paddingTop: 0 }}>
              <div className="atc-node dropoff" />
            </div>
            <div className="atc-stop-content" style={{ paddingBottom: 0 }}>
              <div className="atc-stop-tag">Dropoff</div>
              <div className="atc-stop-row">
                <div className="atc-stop-addr dropoff-addr">{activeTrip.dropoff}</div>
                {isProgress && (
                  <button className="atc-map-pill green" onClick={() => openInMaps(activeTrip.dropoff)}>
                    <MapPin size={10} strokeWidth={2.5} /> Maps
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="atc-stats-bar">
          {[
            { val: `${activeTrip.tripDistanceMiles?.toFixed(1) ?? "--"} mi`, key: "Distance" },
            { val: `${activeTrip.tripDurationMin ?? "--"} min`,              key: "Est. Time" },
            { val: `$${activeTrip.fareBreakdown?.fareTotal?.toFixed(2) ?? activeTrip.fareTotal?.toFixed(2) ?? "--"}`, key: "Rider Fare" },
          ].map((s, i) => (
            <div key={i} className="atc-stat-cell">
              <span className="atc-stat-val">{s.val}</span>
              <span className="atc-stat-key">{s.key}</span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="atc-divider" />

        {/* Message toggle */}
        <div className="atc-msg-toggle-row">
          <button
            className={`atc-msg-toggle${unreadCount > 0 ? " has-msg" : ""}`}
            onClick={() => setShowMessages(v => !v)}
          >
            {unreadCount > 0 && <span className="atc-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
            <MessageCircle size={13} />
            {showMessages ? "Hide chat" : "Message rider"}
          </button>
          {showMessages && (
            <button className="atc-msg-close" onClick={() => setShowMessages(false)}>
              <X size={12} /> Close
            </button>
          )}
        </div>

        {showMessages && rideId && (
          <DriverMessagePanel rideId={rideId} accent={accent} onUnreadChange={setUnreadCount} />
        )}

        {/* CTA */}
        <div className="atc-cta-area">
          <button
            className="atc-cta-btn"
            onClick={onAdvance}
            disabled={advancePending}
          >
            <div className="atc-cta-inner">
              {advancePending
                ? <><Loader2 size={15} style={{ animation: "atc-spin 1s linear infinite" }} /><span style={{ marginLeft: 8 }}>Processing…</span></>
                : <><span>{tripBtnLabel}</span><div className="atc-cta-arrow"><ChevronRight size={14} strokeWidth={2.8} /></div></>
              }
            </div>
          </button>

          {canReassign && (
            <button className="atc-reassign-btn" onClick={() => setShowReassign(true)}>
              <UserX size={12} /> Can't make it? Reassign ride
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Driver message panel ─────────────────────────────────────────────────────
function DriverMessagePanel({ rideId, accent, onUnreadChange }) {
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState("");
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const listRef        = useRef(null);
  const bottomRef      = useRef(null);
  const isAtBottomRef  = useRef(true);
  const justSentRef    = useRef(false);
  const db             = getFirestore();
  const auth           = getAuth();
  const driverUid      = auth.currentUser?.uid ?? null;

  const QUICK = ["On my way 🚗", "I've arrived!", "Calling you now", "1 min away"];

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
      onUnreadChange?.(msgs.filter(m => m.senderRole === "rider" && !m.readByDriver).length);
    });
    return () => unsub();
  }, [rideId]);

  useEffect(() => {
    if (!rideId) return;
    messages.forEach(msg => {
      if (msg.senderRole === "rider" && !msg.readByDriver)
        updateDoc(doc(db, "Rides", rideId, "Messages", msg.id), { readByDriver: true }).catch(() => {});
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
    setSending(true); justSentRef.current = true;
    try {
      await addDoc(collection(db, "Rides", rideId, "Messages"), {
        text: trimmed, senderUid: driverUid, senderRole: "driver",
        createdAt: serverTimestamp(), readByDriver: true, readByRider: false,
      });
      setInput(""); setSent(true);
      setTimeout(() => setSent(false), 2000);
    } catch (err) {
      console.error(err); justSentRef.current = false;
    } finally { setSending(false); }
  }

  function fmt(ts) {
    if (!ts?.seconds) return "";
    return new Date(ts.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const lastDriverIdx = messages.reduce((a, m, i) => m.senderRole === "driver" ? i : a, -1);

  return (
    <div className="atc-msg-panel">
      <div className="atc-msg-header">Chat with rider</div>
      <div className="atc-msg-list" ref={listRef} onScroll={handleScroll}>
        {messages.length === 0 && <div className="atc-msg-empty">No messages yet. Say hi!</div>}
        {messages.map((msg, idx) => {
          const isDriver = msg.senderRole === "driver";
          const isLast   = isDriver && idx === lastDriverIdx;
          const seen     = isLast && msg.readByRider === true;
          return (
            <div key={msg.id} style={{ display:"flex", justifyContent: isDriver ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth:"78%", padding:"8px 12px",
                borderRadius: isDriver ? "13px 13px 3px 13px" : "13px 13px 13px 3px",
                background: isDriver
                  ? `linear-gradient(135deg, ${accent}, ${accent}cc)`
                  : "rgba(255,255,255,.07)",
                border: isDriver ? "none" : "1px solid rgba(255,255,255,.08)",
                boxShadow: isDriver ? `0 2px 12px ${accent}30` : "none",
              }}>
                {!isDriver && (
                  <div style={{ fontSize:9, fontWeight:700, color:accent, letterSpacing:".5px", textTransform:"uppercase", marginBottom:3 }}>
                    Rider
                  </div>
                )}
                <div style={{ fontSize:13, color: isDriver ? "#fff" : "rgba(255,255,255,.82)", lineHeight:1.4 }}>{msg.text}</div>
                <div style={{ display:"flex", alignItems:"center", justifyContent: isDriver ? "flex-end" : "flex-start", gap:4, marginTop:3 }}>
                  <span style={{ fontSize:9.5, color: isDriver ? "rgba(255,255,255,.45)" : "rgba(255,255,255,.25)" }}>{fmt(msg.createdAt)}</span>
                  {isLast && (
                    <span style={{ position:"relative", width:18, height:11, display:"inline-flex", alignItems:"center", flexShrink:0 }}>
                      <svg width="11" height="8" viewBox="0 0 11 8" fill="none" style={{ position:"absolute", left: seen ? 0 : 3, transition:"left .2s" }}>
                        <path d="M1 4L3.5 6.5L9.5 1" stroke={seen ? "#fff" : "rgba(255,255,255,.4)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <svg width="11" height="8" viewBox="0 0 11 8" fill="none" style={{ position:"absolute", right:0, opacity: seen ? 1 : 0, transition:"opacity .25s" }}>
                        <path d="M1 4L3.5 6.5L9.5 1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} style={{ height:1 }} />
      </div>

      <div className="atc-quick-row">
        {QUICK.map(q => (
          <button key={q} className="atc-quick" onClick={() => sendMessage(q)}>{q}</button>
        ))}
      </div>

      <div className="atc-input-row">
        <textarea
          className="atc-textarea"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Type a message…"
          rows={1}
        />
        <button
          className="atc-send"
          onClick={() => sendMessage()}
          disabled={!input.trim() || sending}
          style={{
            background: input.trim() && !sending ? `linear-gradient(135deg, ${accent}, ${accent}bb)` : "rgba(255,255,255,.06)",
            cursor: !input.trim() || sending ? "not-allowed" : "pointer",
            boxShadow: input.trim() ? `0 2px 12px ${accent}35` : "none",
          }}
        >
          {sent
            ? <Check size={14} color="#fff" strokeWidth={3} />
            : <Send size={13} color={input.trim() && !sending ? "#fff" : "rgba(255,255,255,.25)"} />
          }
        </button>
      </div>
    </div>
  );
}
