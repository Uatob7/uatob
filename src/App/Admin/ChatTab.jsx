import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Send, MessageCircle, Search, CheckCheck, Clock, Mail,
  Star, ChevronRight, AlertCircle, Check, ArrowLeft, Zap,
  Filter, Copy, Flag, Reply, X
} from "lucide-react";
import {
  getFirestore, collection, query, where, orderBy, onSnapshot,
  addDoc, serverTimestamp, doc, updateDoc, getDoc, writeBatch, increment
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { firebase_app, auth } from "@/firebase/config";

const db = getFirestore(firebase_app);

// ── Design tokens ─────────────────────────────────────────────────────
const T = {
  bg:       "#F4F6FB",
  surface:  "#FFFFFF",
  card:     "#F9FAFC",
  border:   "#E4E8F0",
  accent:   "#2563EB",
  accentDim:"rgba(37,99,235,.10)",
  green:    "#16A34A",
  red:      "#DC2626",
  amber:    "#D97706",
  textPri:  "#111827",
  textSec:  "#6B7280",
  textMut:  "#9CA3AF",
};

const QUICK_REPLIES = [
  "Thanks for reaching out! I'll look into this right away.",
  "I've escalated this to our technical team — they'll follow up within 24h.",
  "Could you share more details about the issue?",
  "Your payment has been processed.",
  "I've updated your vehicle info. Allow up to 24h to reflect.",
  "I'm marking this as a no-show. The fee will appear in your next payout.",
];

// ── Thread-type helpers ────────────────────────────────────────────────
function isRiderThread(id) { return (id || "").startsWith("rider_"); }
function threadRole(id)    { return isRiderThread(id) ? "Rider" : "Driver"; }

// ── Helpers ────────────────────────────────────────────────────────────
function formatTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000)    return "now";
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function fullTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function avatarColor(str) {
  const colors = ["#3D7FFF","#8B5CF6","#EC4899","#14B8A6","#F59E0B","#EF4444"];
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}

// ── CSS ────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  @keyframes ac-slideUp   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes ac-slideRight{ from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:translateX(0)} }
  @keyframes ac-slideIn   { from{opacity:0;transform:translateX(100%)} to{opacity:1;transform:translateX(0)} }
  @keyframes ac-slideOut  { from{opacity:1;transform:translateX(0)} to{opacity:0;transform:translateX(100%)} }
  @keyframes ac-fadeIn    { from{opacity:0} to{opacity:1} }
  @keyframes ac-pop       { 0%{transform:scale(.9);opacity:0} 60%{transform:scale(1.04)} 100%{transform:scale(1);opacity:1} }
  @keyframes ac-pulse     { 0%,100%{opacity:1} 50%{opacity:.4} }
  @keyframes ac-spin      { to{transform:rotate(360deg)} }
  @keyframes ac-bounce    {
    0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)}
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .ac-root {
    position: fixed; inset: 0; z-index: 1200;
    background: ${T.bg};
    font-family: 'DM Sans', system-ui, sans-serif;
    color: ${T.textPri};
    display: flex; flex-direction: column;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }

  /* ── TOP BAR ── */
  .ac-topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 16px;
    padding-top: max(16px, env(safe-area-inset-top));
    padding-bottom: 14px;
    background: ${T.surface};
    border-bottom: 1px solid ${T.border};
    flex-shrink: 0;
    gap: 12px;
  }
  .ac-topbar-left { display: flex; align-items: center; gap: 10px; }
  .ac-icon-btn {
    width: 38px; height: 38px; border-radius: 12px;
    background: ${T.card}; border: 1px solid ${T.border};
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background .15s, transform .1s;
    color: ${T.textSec}; flex-shrink: 0;
  }
  .ac-icon-btn:active { transform: scale(.92); }
  .ac-icon-btn:hover  { background: ${T.border}; color: ${T.textPri}; }

  .ac-topbar-title {
    font-size: 17px; font-weight: 700; color: ${T.textPri}; letter-spacing: -.3px;
  }
  .ac-topbar-sub { font-size: 11.5px; color: ${T.textSec}; font-weight: 500; margin-top: 1px; }

  .ac-badge {
    background: #EFF6FF; color: ${T.accent};
    border: 1px solid #BFDBFE; border-radius: 20px;
    padding: 4px 10px; font-size: 11px; font-weight: 700;
    display: flex; align-items: center; gap: 5px; letter-spacing: .02em;
    flex-shrink: 0;
  }
  .ac-badge.red { background: #FEF2F2; color: ${T.red}; border-color: #FECACA; }
  .ac-badge.green { background: #F0FDF4; color: ${T.green}; border-color: #BBF7D0; }

  /* ── SEARCH ── */
  .ac-search-wrap {
    padding: 12px 16px;
    background: ${T.surface};
    border-bottom: 1px solid ${T.border};
    flex-shrink: 0;
  }
  .ac-search-inner {
    display: flex; align-items: center; gap: 10px;
    background: ${T.card}; border: 1px solid ${T.border};
    border-radius: 12px; padding: 0 14px;
    transition: border-color .15s;
  }
  .ac-search-inner:focus-within { border-color: ${T.accent}; }
  .ac-search-input {
    flex: 1; background: none; border: none; outline: none;
    font-family: inherit; font-size: 14px; font-weight: 500;
    color: ${T.textPri}; padding: 11px 0;
  }
  .ac-search-input::placeholder { color: ${T.textMut}; }

  /* ── FILTERS ── */
  .ac-filters {
    display: flex; gap: 8px; padding: 10px 16px;
    background: ${T.surface}; border-bottom: 1px solid ${T.border};
    overflow-x: auto; flex-shrink: 0;
    -webkit-overflow-scrolling: touch; scrollbar-width: none;
  }
  .ac-filters::-webkit-scrollbar { display: none; }
  .ac-filter-chip {
    padding: 7px 14px; border-radius: 20px; font-size: 12px; font-weight: 700;
    cursor: pointer; white-space: nowrap; border: 1.5px solid ${T.border};
    background: ${T.card}; color: ${T.textSec};
    transition: all .15s; letter-spacing: .02em;
  }
  .ac-filter-chip.active {
    background: ${T.accentDim}; color: ${T.accent};
    border-color: rgba(37,99,235,.3);
  }

  /* ── CONVERSATION LIST ── */
  .ac-conv-list {
    flex: 1; overflow-y: auto;
    padding: 10px 12px 24px;
    display: flex; flex-direction: column; gap: 8px;
    overscroll-behavior: contain;
  }
  .ac-conv-list::-webkit-scrollbar { width: 0; }

  .ac-conv-item {
    background: ${T.card}; border: 1px solid ${T.border};
    border-radius: 16px; padding: 14px;
    cursor: pointer; transition: border-color .15s, background .15s, transform .1s;
    animation: ac-slideUp .3s ease both;
    display: flex; align-items: center; gap: 12px;
    -webkit-tap-highlight-color: transparent;
  }
  .ac-conv-item:active { transform: scale(.98); }
  .ac-conv-item.selected { border-color: rgba(37,99,235,.35); background: rgba(37,99,235,.05); }
  .ac-conv-item:hover:not(.selected) { border-color: #D1D5DB; background: #F0F4FF; }

  .ac-avatar {
    width: 46px; height: 46px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 15px; color: #fff;
    font-family: 'DM Mono', monospace;
  }
  .ac-conv-body { flex: 1; min-width: 0; }
  .ac-conv-name { font-size: 14px; font-weight: 700; color: ${T.textPri}; margin-bottom: 3px; }
  .ac-conv-preview {
    font-size: 12.5px; color: ${T.textSec}; font-weight: 400;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    max-width: 200px;
  }
  .ac-conv-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
  .ac-conv-time { font-size: 11px; color: ${T.textMut}; font-weight: 600; }
  .ac-unread-dot {
    min-width: 24px; height: 24px; border-radius: 12px;
    background: ${T.red}; color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 900; padding: 0 6px;
    animation: ac-pop .3s ease;
    box-shadow: 0 2px 8px rgba(220,38,38,.4), 0 0 12px rgba(220,38,38,.2);
    line-height: 1;
  }

  /* ── EMPTY STATE ── */
  .ac-empty {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 12px;
    padding: 40px 20px; text-align: center;
  }
  .ac-empty-icon {
    width: 64px; height: 64px; border-radius: 20px;
    background: ${T.card}; border: 1px solid ${T.border};
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 4px;
  }
  .ac-empty-title { font-size: 15px; font-weight: 700; color: ${T.textSec}; }
  .ac-empty-sub { font-size: 12.5px; color: ${T.textMut}; line-height: 1.5; }

  /* ── CHAT SCREEN ── */
  .ac-chat-screen {
    position: absolute; inset: 0; z-index: 10;
    background: ${T.bg}; display: flex; flex-direction: column;
    overflow: hidden;
  }
  .ac-chat-screen.entering { animation: ac-slideIn .3s cubic-bezier(.22,1,.36,1) forwards; }
  .ac-chat-screen.leaving  { animation: ac-slideOut .22s cubic-bezier(.4,0,.6,1) forwards; }

  .ac-chat-header {
    background: ${T.surface}; border-bottom: 1px solid ${T.border};
    padding: 0 16px; display: flex; align-items: center; gap: 12px;
    padding-top: max(16px, env(safe-area-inset-top));
    padding-bottom: 14px; flex-shrink: 0;
  }
  .ac-chat-driver-name { font-size: 15px; font-weight: 700; color: ${T.textPri}; line-height: 1.2; }
  .ac-chat-driver-sub { font-size: 11.5px; color: ${T.textSec}; font-weight: 500; margin-top: 2px; display: flex; align-items: center; gap: 5px; }
  .ac-online-dot { width: 6px; height: 6px; border-radius: 50%; background: ${T.green}; animation: ac-pulse 2s infinite; }

  /* driver info strip */
  .ac-driver-strip {
    background: ${T.surface}; border-bottom: 1px solid ${T.border};
    padding: 10px 16px; display: flex; align-items: center; gap: 10px;
    flex-shrink: 0; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none;
  }
  .ac-driver-strip::-webkit-scrollbar { display: none; }
  .ac-driver-pill {
    display: flex; align-items: center; gap: 6px;
    background: ${T.card}; border: 1px solid ${T.border};
    border-radius: 10px; padding: 7px 12px;
    font-size: 11.5px; font-weight: 600; color: ${T.textSec};
    white-space: nowrap; flex-shrink: 0;
  }
  .ac-driver-pill svg { flex-shrink: 0; }

  /* messages */
  .ac-messages {
    flex: 1; overflow-y: auto; padding: 18px 14px;
    display: flex; flex-direction: column; gap: 12px;
    overscroll-behavior: contain;
  }
  .ac-messages::-webkit-scrollbar { width: 0; }

  .ac-msg-group { display: flex; flex-direction: column; }
  .ac-msg-group.out { align-items: flex-end; }
  .ac-msg-group.in  { align-items: flex-start; }

  .ac-bubble {
    max-width: 80%; padding: 11px 14px; border-radius: 16px;
    font-size: 13.5px; line-height: 1.52; word-break: break-word;
    font-weight: 400;
  }
  .ac-bubble.out {
    background: ${T.accent};
    color: #fff; border-bottom-right-radius: 4px;
    box-shadow: 0 4px 14px rgba(37,99,235,.18);
    animation: ac-pop .2s cubic-bezier(.34,1.56,.64,1) both;
  }
  .ac-bubble.in {
    background: #FFFFFF; color: ${T.textPri};
    border: 1px solid ${T.border}; border-bottom-left-radius: 4px;
    box-shadow: 0 1px 4px rgba(0,0,0,.06);
    animation: ac-slideRight .2s ease both;
  }
  .ac-bubble-meta {
    font-size: 10.5px; color: ${T.textMut}; font-weight: 500;
    margin-top: 4px; display: flex; align-items: center; gap: 4px;
  }

  .ac-day-divider {
    display: flex; align-items: center; gap: 10px;
    margin: 6px 0;
  }
  .ac-day-divider hr { flex: 1; border: none; border-top: 1px solid ${T.border}; }
  .ac-day-label {
    font-size: 10.5px; font-weight: 700; color: ${T.textMut};
    letter-spacing: .06em; text-transform: uppercase;
  }

  /* typing */
  .ac-typing {
    display: flex; align-items: center; gap: 5px;
    background: ${T.card}; border: 1px solid ${T.border};
    padding: 12px 16px; border-radius: 16px; border-bottom-left-radius: 4px;
    width: fit-content; animation: ac-slideRight .2s ease;
  }
  .ac-typing-dot {
    width: 6px; height: 6px; border-radius: 50%; background: #CBD5E1;
    animation: ac-bounce 1.2s ease-in-out infinite;
  }

  /* quick replies */
  .ac-quick-wrap {
    padding: 10px 14px;
    background: ${T.surface}; border-top: 1px solid ${T.border};
    display: flex; gap: 8px; overflow-x: auto; flex-shrink: 0;
    -webkit-overflow-scrolling: touch; scrollbar-width: none;
  }
  .ac-quick-wrap::-webkit-scrollbar { display: none; }
  .ac-quick-btn {
    padding: 7px 13px; border-radius: 10px; font-size: 11.5px; font-weight: 600;
    cursor: pointer; white-space: nowrap; flex-shrink: 0;
    background: ${T.card}; border: 1px solid ${T.border};
    color: ${T.textSec}; font-family: inherit;
    transition: all .15s; max-width: 180px;
    overflow: hidden; text-overflow: ellipsis;
  }
  .ac-quick-btn:hover {
    background: ${T.accentDim}; color: ${T.accent};
    border-color: rgba(37,99,235,.3);
  }
  .ac-quick-btn:active { transform: scale(.95); }

  /* input bar */
  .ac-input-bar {
    padding: 10px 14px;
    padding-bottom: max(10px, env(safe-area-inset-bottom));
    background: ${T.surface}; border-top: 1px solid ${T.border};
    display: flex; align-items: flex-end; gap: 10px; flex-shrink: 0;
  }
  .ac-textarea {
    flex: 1; background: ${T.card}; border: 1.5px solid ${T.border};
    border-radius: 14px; padding: 11px 14px; font-size: 14px;
    font-weight: 500; color: ${T.textPri}; font-family: inherit;
    resize: none; outline: none; max-height: 110px; line-height: 1.45;
    transition: border-color .15s;
  }
  .ac-textarea:focus { border-color: ${T.accent}; }
  .ac-textarea::placeholder { color: ${T.textMut}; }
  .ac-send-btn {
    width: 44px; height: 44px; border-radius: 14px; border: none;
    background: ${T.accent}; display: flex; align-items: center; justify-content: center;
    cursor: pointer; flex-shrink: 0; transition: transform .12s, box-shadow .15s;
    box-shadow: 0 4px 14px rgba(37,99,235,.22);
  }
  .ac-send-btn:hover { transform: scale(1.06); box-shadow: 0 6px 20px rgba(37,99,235,.32); }
  .ac-send-btn:active { transform: scale(.93); }
  .ac-send-btn:disabled { background: ${T.card}; box-shadow: none; cursor: default; }

  /* spinner */
  .ac-spin { animation: ac-spin .8s linear infinite; }
`;

// ── Avatar ─────────────────────────────────────────────────────────────
function Avatar({ name, size = 46, fontSize = 15, photo }) {
  const color = avatarColor(name);
  if (photo) {
    return (
      <div className="ac-avatar" style={{ width: size, height: size, fontSize, background: color, overflow: "hidden" }}>
        <img src={photo} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }}/>
      </div>
    );
  }
  return (
    <div className="ac-avatar" style={{ width: size, height: size, fontSize, background: color }}>
      {initials(name)}
    </div>
  );
}

// ── Day grouping ───────────────────────────────────────────────────────
function dayLabel(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
  const today = new Date();
  const yest  = new Date(today); yest.setDate(today.getDate() - 1);
  const same  = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, yest))  return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function groupByDay(msgs) {
  const groups = [];
  let day = null, group = null;
  msgs.forEach(m => {
    const label = dayLabel(m.createdAt);
    if (label !== day) { day = label; group = { label, messages: [] }; groups.push(group); }
    group.messages.push(m);
  });
  return groups;
}

// ── Chat Screen ────────────────────────────────────────────────────────
function ChatScreen({ conv, onBack, onToast }) {
  const [leaving,  setLeaving]  = useState(false);
  const [messages, setMessages] = useState([]);
  const [text,     setText]     = useState("");
  const [sending,  setSending]  = useState(false);
  const [person,   setPerson]   = useState(null);
  const bottomRef  = useRef(null);
  const textaRef   = useRef(null);

  const riderThread = isRiderThread(conv.id);
  const personId    = riderThread ? conv.riderId : conv.driverId;

  // Load messages
  useEffect(() => {
    const q = query(
      collection(db, "Support"),
      where("threadId", "==", conv.id),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, async snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);

      const unread = msgs.filter(m => m.status === "unread" && m.sender !== "admin");
      try {
        const batch = writeBatch(db);
        unread.forEach(m => batch.update(doc(db, "Support", m.id), { status: "read" }));
        batch.update(doc(db, "SupportThreads", conv.id), { unreadByAdmin: 0, lastReadAt: serverTimestamp() });
        await batch.commit();
      } catch {}
    }, err => { console.error(err); });

    return () => unsub();
  }, [conv.id]);

  // Load person details (Drivers for driver threads, Accounts for rider threads)
  useEffect(() => {
    if (!personId) return;
    getDoc(doc(db, riderThread ? "Accounts" : "Drivers", personId))
      .then(snap => { if (snap.exists()) setPerson(snap.data()); })
      .catch(() => {});
  }, [personId, riderThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleBack = () => { setLeaving(true); setTimeout(onBack, 220); };

  const send = useCallback(async (msg) => {
    const m = msg ?? text.trim();
    if (!m || sending) return;
    setSending(true);
    setText("");
    if (textaRef.current) textaRef.current.style.height = "auto";
    try {
      await addDoc(collection(db, "Support"), {
        threadId: conv.id,
        ...(riderThread ? { riderId: conv.riderId } : { driverId: conv.driverId }),
        message: m, sender: "admin", status: "read",
        createdAt: serverTimestamp(), readAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "SupportThreads", conv.id), {
        lastMessage: m, lastSender: "admin", updatedAt: serverTimestamp(),
        unreadByAdmin: 0,
        ...(riderThread ? { unreadByRider: increment(1) } : { unreadByDriver: increment(1) }),
      });
      onToast?.("Sent", "success");
    } catch (e) { console.error(e); onToast?.("Failed to send", "error"); }
    finally { setSending(false); }
  }, [text, conv, sending, riderThread]);

  const handleChange = e => {
    setText(e.target.value);
    const el = textaRef.current;
    if (el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 110) + "px"; }
  };

  const personName = person
    ? (`${person.firstName || ""} ${person.lastName || ""}`.trim() || person.displayName || person.name || "")
    : (riderThread ? (conv.riderName || "Rider") : (conv.driverName || "Driver"));
  const grouped = groupByDay(messages);
  const role = threadRole(conv.id);

  return (
    <>
      <style>{CSS}</style>
      <div className={`ac-chat-screen ${leaving ? "leaving" : "entering"}`}>

        {/* Header */}
        <div className="ac-chat-header">
          <button className="ac-icon-btn" onClick={handleBack}>
            <ArrowLeft size={18} />
          </button>
          <Avatar name={personName} size={40} fontSize={14} photo={riderThread ? (person?.photoURL || null) : (person?.profilePhotoUrl || null)} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ac-chat-driver-name">{personName}</div>
            <div className="ac-chat-driver-sub">
              <span className="ac-online-dot" />
              <span>{role} · Support thread</span>
            </div>
          </div>
          <button
            className="ac-icon-btn"
            onClick={() => navigator.clipboard.writeText(personId || "")}
            title={`Copy ${role.toLowerCase()} ID`}
          >
            <Copy size={16} />
          </button>
        </div>

        {/* Person info pills */}
        {person && (
          <div className="ac-driver-strip">
            {person.email && (
              <div className="ac-driver-pill">
                <Mail size={12} color={T.accent} />
                <span style={{ color: T.textSec }}>{person.email}</span>
              </div>
            )}
            {!riderThread && person.averageRating != null && (
              <div className="ac-driver-pill">
                <Star size={12} fill={T.amber} color={T.amber} />
                <span style={{ color: T.textPri, fontWeight: 700 }}>
                  {person.averageRating.toFixed(2)}
                </span>
              </div>
            )}
            {person.phone && (
              <div className="ac-driver-pill" style={{ color: T.textSec }}>
                <span>📱</span><span>{person.phone}</span>
              </div>
            )}
            {personId && (
              <div className="ac-driver-pill" style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                <span style={{ color: T.textMut }}>{role} ID:</span>
                <span style={{ color: T.textSec }}>{personId.slice(0, 10)}…</span>
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="ac-messages">
          {grouped.map((g, gi) => (
            <div key={`${g.label}-${gi}`}>
              <div className="ac-day-divider">
                <hr /><span className="ac-day-label">{g.label}</span><hr />
              </div>
              {g.messages.map(msg => {
                const isAdmin = msg.sender === "admin";
                return (
                  <div key={msg.id} className={`ac-msg-group ${isAdmin ? "out" : "in"}`}>
                    <div className={`ac-bubble ${isAdmin ? "out" : "in"}`}>{msg.message}</div>
                    <div className="ac-bubble-meta" style={{ justifyContent: isAdmin ? "flex-end" : "flex-start" }}>
                      {isAdmin ? (
                        <>{msg.status === "read" ? <CheckCheck size={11} color={T.green} /> : <Check size={11} color={T.textMut} />}<span>{fullTime(msg.createdAt)}</span></>
                      ) : (
                        <span>{personName.split(" ")[0]} · {fullTime(msg.createdAt)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {messages.length === 0 && (
            <div className="ac-empty" style={{ opacity: .6 }}>
              <div className="ac-empty-icon"><MessageCircle size={26} color={T.textMut} strokeWidth={1.5} /></div>
              <div className="ac-empty-title">No messages yet</div>
              <div className="ac-empty-sub">Start the conversation below</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick replies */}
        <div className="ac-quick-wrap">
          {QUICK_REPLIES.map((r, i) => (
            <button key={i} className="ac-quick-btn" onClick={() => send(r)}>
              {r.length > 30 ? r.slice(0, 30) + "…" : r}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="ac-input-bar">
          <textarea
            ref={textaRef}
            className="ac-textarea"
            rows={1}
            placeholder="Reply… (Enter to send)"
            value={text}
            onChange={handleChange}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <button
            className="ac-send-btn"
            onClick={() => send()}
            disabled={!text.trim() || sending}
          >
            {sending
              ? <div className="ac-spin" style={{ width: 18, height: 18, border: "2.5px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%" }} />
              : <Send size={17} color="#fff" style={{ transform: "translateX(1px)" }} />
            }
          </button>
        </div>

      </div>
    </>
  );
}

// ── Main export ────────────────────────────────────────────────────────
export function ChatTab({ onBack, onToast }) {
  const [user,       setUser]       = useState(null);
  const [convs,      setConvs]      = useState([]);
  const [userNames,  setUserNames]  = useState({});
  const [userPhotos, setUserPhotos] = useState({});
  const [sel,        setSel]        = useState(null);
  const [search,    setSearch]    = useState("");
  const [filter,    setFilter]    = useState("all");

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // Load conversations
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "SupportThreads"), orderBy("updatedAt", "desc"));
    return onSnapshot(q, snap => {
      setConvs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => { console.error(err); onToast?.("Failed to load conversations", "error"); });
  }, [user]);

  // Look up names for threads that don't have one stored
  useEffect(() => {
    const missing = convs.filter(c => {
      const rider = isRiderThread(c.id);
      const pid   = rider ? c.riderId  : c.driverId;
      const name  = rider ? c.riderName : c.driverName;
      return !name && pid && !userNames[pid];
    });
    if (!missing.length) return;
    missing.forEach(c => {
      const rider = isRiderThread(c.id);
      const pid   = rider ? c.riderId : c.driverId;
      if (!pid) return;
      getDoc(doc(db, rider ? "Accounts" : "Drivers", pid)).then(snap => {
        if (!snap.exists()) return;
        const d     = snap.data();
        const full  = `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() || d.displayName || d.name || "";
        const photo = rider ? (d.photoURL || null) : (d.profilePhotoUrl || null);
        if (full)  setUserNames( prev => ({ ...prev, [pid]: full  }));
        if (photo) setUserPhotos(prev => ({ ...prev, [pid]: photo }));
      }).catch(() => {});
    });
  }, [convs]);

  const totalUnread = convs.reduce((s, c) => s + (c.unreadByAdmin || 0), 0);

  const filtered = useMemo(() => {
    let list = convs;
    if (filter === "unread") list = list.filter(c => (c.unreadByAdmin || 0) > 0);
    if (filter === "active") {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 1);
      list = list.filter(c => {
        const d = c.updatedAt?.toDate?.() || new Date(c.updatedAt?.seconds * 1000 || c.updatedAt);
        return d > cutoff;
      });
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(c => {
        const name  = (c.driverName  || c.riderName  || "").toLowerCase();
        const email = (c.driverEmail || c.riderEmail || "").toLowerCase();
        return name.includes(s) || email.includes(s);
      });
    }
    return list;
  }, [convs, filter, search]);

  return (
    <>
      <style>{CSS}</style>
      <div className="ac-root">

        {/* Top bar */}
        <div className="ac-topbar">
          <div className="ac-topbar-left">
            <button className="ac-icon-btn" onClick={onBack}><ArrowLeft size={18} /></button>
            <div>
              <div className="ac-topbar-title">Support Inbox</div>
              <div className="ac-topbar-sub">Driver messages</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {totalUnread > 0 && (
              <div className="ac-badge red">
                <AlertCircle size={12} />
                {totalUnread} unread
              </div>
            )}
            <div className="ac-badge">
              <MessageCircle size={12} />
              {convs.length}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="ac-search-wrap">
          <div className="ac-search-inner">
            <Search size={15} color={T.textMut} />
            <input
              className="ac-search-input"
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button style={{ background: "none", border: "none", cursor: "pointer", color: T.textMut, display: "flex" }} onClick={() => setSearch("")}>
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="ac-filters">
          {[
            { k: "all",    l: `All (${convs.length})` },
            { k: "unread", l: `Unread${totalUnread > 0 ? ` · ${totalUnread}` : ""}` },
            { k: "active", l: "Last 24h" },
          ].map(f => (
            <button
              key={f.k}
              className={`ac-filter-chip ${filter === f.k ? "active" : ""}`}
              onClick={() => setFilter(f.k)}
            >
              {f.l}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="ac-conv-list">
          {filtered.length === 0 ? (
            <div className="ac-empty">
              <div className="ac-empty-icon"><MessageCircle size={28} color={T.textMut} strokeWidth={1.5} /></div>
              <div className="ac-empty-title">No conversations</div>
              <div className="ac-empty-sub">Try a different filter or search term</div>
            </div>
          ) : (
            filtered.map((c, i) => {
              const unread  = c.unreadByAdmin || 0;
              const rider   = isRiderThread(c.id);
              const pid     = rider ? c.riderId  : c.driverId;
              const name    = (rider ? c.riderName  : c.driverName)
                           || userNames[pid]
                           || pid?.slice(0, 8)
                           || (rider ? "Rider" : "Driver");
              const role    = threadRole(c.id);
              const senderNotAdmin = c.lastSender && c.lastSender !== "admin";
              return (
                <div
                  key={c.id}
                  className={`ac-conv-item ${sel?.id === c.id ? "selected" : ""}`}
                  style={{ animationDelay: `${i * 0.04}s` }}
                  onClick={() => setSel(c)}
                >
                  <Avatar name={name} photo={userPhotos[pid] || null} />
                  <div className="ac-conv-body">
                    <div className="ac-conv-name" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {name}
                      <span style={{
                        fontSize: 9.5, fontWeight: 800, letterSpacing: ".06em",
                        padding: "1px 6px", borderRadius: 4,
                        background: rider ? "#FEF3C7" : "#EFF6FF",
                        color:      rider ? "#D97706"  : T.accent,
                        border:     `1px solid ${rider ? "#FDE68A" : "#BFDBFE"}`,
                        flexShrink: 0,
                      }}>
                        {role.toUpperCase()}
                      </span>
                    </div>
                    <div className="ac-conv-preview">
                      {c.lastSender === "admin" ? "You: " : ""}
                      {c.lastMessage || "No messages yet"}
                    </div>
                  </div>
                  <div className="ac-conv-right">
                    <span className="ac-conv-time">{formatTime(c.updatedAt)}</span>
                    {unread > 0 && (
                      <span className="ac-unread-dot">{unread > 9 ? "9+" : unread}</span>
                    )}
                    {unread === 0 && senderNotAdmin && (
                      <Reply size={13} color={T.accent} />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Chat overlay */}
        {sel && (
          <ChatScreen
            conv={sel}
            onBack={() => setSel(null)}
            onToast={onToast}
          />
        )}

      </div>
    </>
  );
}
