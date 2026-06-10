import { useState, useEffect, useRef, useMemo } from "react";
import { X, Mail, ChevronRight, Send, ArrowLeft, CheckCheck, AlertCircle } from "lucide-react";
import {
  getFirestore, collection, addDoc, query, where, orderBy,
  onSnapshot, serverTimestamp, doc, setDoc, getDoc, updateDoc,
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

const CSS = `
  @keyframes rs-slideIn  { from{opacity:0;transform:translateY(100%)} to{opacity:1;transform:translateY(0)} }
  @keyframes rs-slideOut { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(100%)} }
  @keyframes rs-fadeIn   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes rs-chat-r   { from{opacity:0;transform:translateX(16px) scale(.96)} to{opacity:1;transform:translateX(0) scale(1)} }
  @keyframes rs-chat-l   { from{opacity:0;transform:translateX(-16px) scale(.96)} to{opacity:1;transform:translateX(0) scale(1)} }
  @keyframes rs-bounce    { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
  @keyframes rs-spin      { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

  .rs-overlay {
    position:fixed;inset:0;z-index:1300;
    background:#F8FAFC;display:flex;flex-direction:column;
    font-family:'Barlow',system-ui,sans-serif;overflow:hidden;
  }
  .rs-overlay.entering { animation:rs-slideIn .38s cubic-bezier(.22,1,.36,1) forwards; }
  .rs-overlay.leaving  { animation:rs-slideOut .28s cubic-bezier(.4,0,.6,1) forwards; }
  .rs-header {
    background:#fff;border-bottom:1px solid #E5E7EB;padding:0 20px;
    display:flex;align-items:center;justify-content:space-between;flex-shrink:0;
    padding-top:max(20px,env(safe-area-inset-top));padding-bottom:16px;
  }
  .rs-close-btn {
    width:36px;height:36px;border-radius:50%;background:#F3F4F6;border:none;
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;transition:background .15s,transform .12s;flex-shrink:0;
  }
  .rs-close-btn:hover{background:#E5E7EB} .rs-close-btn:active{transform:scale(.93)}
  .rs-body {
    flex:1;overflow-y:auto;padding:24px 20px 32px;
    display:flex;flex-direction:column;gap:24px;overscroll-behavior:contain;
  }
  .rs-hero { display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;animation:rs-fadeIn .4s ease .05s both; }
  .rs-hero-icon {
    width:72px;height:72px;border-radius:50%;
    background:linear-gradient(135deg,#EFF6FF,#DBEAFE);border:2px solid #BFDBFE;
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 0 0 8px rgba(59,130,246,.06);
  }
  .rs-hero-title{font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:900;color:#111827;letter-spacing:-.3px}
  .rs-hero-sub{font-size:14px;color:#6B7280;font-weight:500;line-height:1.55;max-width:300px}
  .rs-status-chip{display:inline-flex;align-items:center;gap:6px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:99px;padding:5px 12px;font-size:12px;font-weight:700;color:#16A34A;letter-spacing:.04em}
  .rs-status-dot{width:7px;height:7px;border-radius:50%;background:#22C55E;box-shadow:0 0 0 3px rgba(34,197,94,.2)}
  .rs-section{animation:rs-fadeIn .4s ease both}
  .rs-section-title{font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#9CA3AF;margin-bottom:10px;padding-left:2px}
  .rs-cards{display:flex;flex-direction:column;gap:10px}
  .rs-card{
    background:#fff;border:1px solid #E5E7EB;border-radius:16px;padding:16px;
    display:flex;align-items:center;gap:14px;
    cursor:pointer;text-decoration:none;color:inherit;
    transition:border-color .15s,box-shadow .15s,transform .12s;
    -webkit-tap-highlight-color:transparent;
  }
  .rs-card:hover{border-color:#D1D5DB;box-shadow:0 4px 16px rgba(0,0,0,.06)} .rs-card:active{transform:scale(.985)}
  .rs-card-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .rs-card-body{flex:1;min-width:0}
  .rs-card-label{font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:800;color:#111827;letter-spacing:-.1px;margin-bottom:2px}
  .rs-card-sub{font-size:12.5px;color:#6B7280;font-weight:500}
  .rs-card-badge{font-size:10px;font-weight:700;letter-spacing:.04em;background:#FEF3C7;color:#D97706;border:1px solid #FDE68A;border-radius:6px;padding:2px 7px;flex-shrink:0}
  .rs-card-badge.unread{background:#FEE2E2;color:#DC2626;border-color:#FECACA}
  .rs-faq-item{background:#fff;border:1px solid #E5E7EB;border-radius:14px;padding:14px 16px;cursor:pointer;transition:border-color .15s;-webkit-tap-highlight-color:transparent}
  .rs-faq-item:hover{border-color:#D1D5DB}
  .rs-faq-q{font-size:13.5px;font-weight:700;color:#111827;display:flex;align-items:center;justify-content:space-between;gap:10px}
  .rs-faq-a{font-size:13px;color:#6B7280;font-weight:500;line-height:1.55;margin-top:8px;border-top:1px solid #F3F4F6;padding-top:8px}
  .rs-footer-note{text-align:center;font-size:12px;color:#9CA3AF;font-weight:500;line-height:1.6;animation:rs-fadeIn .4s ease .3s both}

  .rsc-overlay {
    position:fixed;inset:0;z-index:1400;
    background:#F0F4F8;display:flex;flex-direction:column;
    font-family:'Barlow',system-ui,sans-serif;
  }
  .rsc-overlay.entering { animation:rs-slideIn .35s cubic-bezier(.22,1,.36,1) forwards; }
  .rsc-overlay.leaving  { animation:rs-slideOut .25s cubic-bezier(.4,0,.6,1) forwards; }
  .rsc-header {
    background:#fff;border-bottom:1px solid #E5E7EB;
    padding:0 16px;display:flex;align-items:center;gap:14px;flex-shrink:0;
    padding-top:max(18px,env(safe-area-inset-top));padding-bottom:14px;
  }
  .rsc-back-btn {
    width:36px;height:36px;border-radius:50%;background:#F3F4F6;border:none;
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;transition:background .15s,transform .12s;flex-shrink:0;
  }
  .rsc-back-btn:hover{background:#E5E7EB} .rsc-back-btn:active{transform:scale(.93)}
  .rsc-messages { flex:1;overflow-y:auto;padding:20px 16px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain; }
  .rsc-bubble-wrap{display:flex;flex-direction:column}
  .rsc-bubble-wrap.outgoing{align-items:flex-end} .rsc-bubble-wrap.incoming{align-items:flex-start}
  .rsc-bubble{max-width:78%;padding:11px 15px;border-radius:18px;font-size:14px;font-weight:500;line-height:1.5;word-break:break-word}
  .rsc-bubble.outgoing{background:linear-gradient(135deg,#3B82F6,#2563EB);color:#fff;border-bottom-right-radius:4px;animation:rs-chat-r .22s cubic-bezier(.34,1.56,.64,1) both}
  .rsc-bubble.incoming{background:#fff;color:#111827;border:1px solid #E5E7EB;border-bottom-left-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,.05);animation:rs-chat-l .22s cubic-bezier(.34,1.56,.64,1) both}
  .rsc-bubble-meta{font-size:11px;color:#9CA3AF;font-weight:500;margin-top:3px;display:flex;align-items:center;gap:4px}
  .rsc-typing{display:flex;align-items:center;gap:5px;background:#fff;border:1px solid #E5E7EB;padding:12px 16px;border-radius:18px;border-bottom-left-radius:4px;width:fit-content;box-shadow:0 2px 8px rgba(0,0,0,.05);animation:rs-chat-l .22s cubic-bezier(.34,1.56,.64,1) both}
  .rsc-typing-dot{width:7px;height:7px;border-radius:50%;background:#9CA3AF;animation:rs-bounce 1.2s ease-in-out infinite}
  .rsc-input-bar{background:#fff;border-top:1px solid #E5E7EB;padding:12px 16px;display:flex;align-items:flex-end;gap:10px;flex-shrink:0;padding-bottom:max(12px,env(safe-area-inset-bottom))}
  .rsc-textarea{flex:1;border:1.5px solid #E5E7EB;border-radius:20px;padding:10px 16px;font-size:14px;font-weight:500;color:#111827;font-family:'Barlow',system-ui,sans-serif;resize:none;outline:none;max-height:120px;overflow-y:auto;transition:border-color .15s;line-height:1.45;background:#F8FAFC}
  .rsc-textarea:focus{border-color:#3B82F6;background:#fff} .rsc-textarea::placeholder{color:#9CA3AF}
  .rsc-send-btn{width:44px;height:44px;border-radius:50%;border:none;flex-shrink:0;background:linear-gradient(135deg,#3B82F6,#2563EB);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .12s,box-shadow .15s;box-shadow:0 4px 12px rgba(37,99,235,.35)}
  .rsc-send-btn:hover{transform:scale(1.06)} .rsc-send-btn:active{transform:scale(.94)} .rsc-send-btn:disabled{background:#E5E7EB;box-shadow:none;cursor:default;transform:none}
  .rsc-day-divider{display:flex;justify-content:center;margin:8px 0 4px}
  .rsc-day-divider span{background:#E5E7EB;border-radius:99px;padding:4px 14px;font-size:11px;font-weight:700;color:#6B7280;letter-spacing:.04em}
`;

const FAQ_ITEMS = [
  { q: "How do I cancel a ride?",             a: "You can cancel a ride before your driver arrives by tapping the active ride card and selecting 'Cancel'. Cancellations after driver arrival may incur a small fee." },
  { q: "How do I track my driver?",           a: "Once a driver is assigned, you'll see their live location on the map and an ETA. The map updates every few seconds." },
  { q: "What payment methods are accepted?",  a: "We accept credit/debit cards and Cash App. You can update your payment method before booking." },
  { q: "How do I schedule a ride in advance?",a: "Tap 'Schedule' on the booking screen, choose your date and time, and confirm. Scheduled rides are dispatched automatically." },
  { q: "How do I rate my driver?",            a: "After your trip completes, a rating prompt appears automatically. You can also rate from your trip history." },
];

const AUTO_REPLY_TEXT = "Thanks for reaching out! A support agent will be with you shortly. Our average response time is under 5 minutes. 🙌";
const WELCOME_TEXT = (firstName) =>
  `${firstName ? `Hi ${firstName}! 👋 ` : "Hi there! 👋 "}Welcome to UaTob Support. How can we help you today?`;

function formatTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function tsToDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return new Date(ts);
}

function dayLabel(date) {
  if (!date) return "";
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(date, today))     return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function groupByDay(messages) {
  const groups = [];
  let currentDay = null, currentGroup = null;
  messages.forEach(msg => {
    const label = tsToDate(msg.createdAt) ? dayLabel(tsToDate(msg.createdAt)) : "";
    if (label !== currentDay) {
      currentDay   = label;
      currentGroup = { label, messages: [] };
      groups.push(currentGroup);
    }
    currentGroup.messages.push(msg);
  });
  return groups;
}

function isMissingIndexError(err) {
  const code = err?.code ?? "";
  const msg  = (err?.message ?? "").toLowerCase();
  return code === "failed-precondition" || msg.includes("requires an index");
}

// ── Chat screen ───────────────────────────────────────────────────────────────
function ChatScreen({ account, onClose }) {
  const [leaving,  setLeaving]  = useState(false);
  const [messages, setMessages] = useState([]);
  const [text,     setText]     = useState("");
  const [sending,  setSending]  = useState(false);
  const [typing,   setTyping]   = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const bottomRef = useRef(null);
  const textaRef  = useRef(null);
  const initRef   = useRef(false);

  const riderId   = account?.uid ?? account?.id ?? null;
  const threadId  = `rider_${riderId ?? "unknown"}`;
  const threadRef = useMemo(() => doc(db, "SupportThreads", threadId), [threadId]);

  const riderName = [account?.firstName, account?.lastName].filter(Boolean).join(" ") || null;
  const riderEmail = account?.email ?? null;

  // ── Subscribe to messages ──
  useEffect(() => {
    if (!riderId) { setLoading(false); return; }
    let unsub = null;
    setError(null);

    const subscribeFallback = () => {
      try {
        unsub = onSnapshot(
          query(collection(db, "Support"), where("threadId", "==", threadId)),
          (snap) => {
            setMessages(
              snap.docs.map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))
            );
            setLoading(false);
            setError(null);
          },
          (err) => {
            console.error("[UaTob] Rider support fallback failed:", err);
            setError({ title: "Couldn't load messages", detail: err?.message || "Please try again." });
            setLoading(false);
          }
        );
      } catch (err) {
        setError({ title: "Couldn't load messages", detail: err?.message || "Please try again." });
        setLoading(false);
      }
    };

    try {
      unsub = onSnapshot(
        query(collection(db, "Support"), where("threadId", "==", threadId), orderBy("createdAt", "asc")),
        (snap) => {
          setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error("[UaTob] Rider support subscribe failed:", err);
          if (isMissingIndexError(err)) {
            try { if (typeof unsub === "function") unsub(); } catch {}
            unsub = null;
            subscribeFallback();
          } else {
            setError({ title: "Couldn't load messages", detail: err?.message || "Please try again." });
            setLoading(false);
          }
        }
      );
    } catch (err) {
      subscribeFallback();
    }

    return () => { try { if (typeof unsub === "function") unsub(); } catch {} };
  }, [threadId, riderId]);

  // ── Init thread + welcome message ──
  useEffect(() => {
    if (!riderId || initRef.current) return;
    initRef.current = true;

    (async () => {
      try {
        const snap = await getDoc(threadRef);
        if (!snap.exists()) {
          await setDoc(threadRef, {
            riderId, riderName, riderEmail,
            createdAt:      serverTimestamp(),
            updatedAt:      serverTimestamp(),
            lastMessage:    WELCOME_TEXT(account?.firstName),
            lastSender:     "support",
            unreadByRider:  0,
            unreadBySupport: 0,
            welcomeSent:    true,
            autoReplySent:  false,
          });
          await addDoc(collection(db, "Support"), {
            threadId, riderId, riderName, riderEmail,
            message:   WELCOME_TEXT(account?.firstName),
            sender:    "support",
            isAuto:    true,
            status:    "read",
            createdAt: serverTimestamp(),
          });
        } else {
          const data = snap.data();
          if ((data?.unreadByRider ?? 0) > 0) {
            await updateDoc(threadRef, { unreadByRider: 0 });
          }
        }
      } catch (err) {
        console.error("[UaTob] Rider thread init failed:", err);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riderId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  const handleTextChange = (e) => {
    setText(e.target.value);
    const el = textaRef.current;
    if (el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }
  };

  const handleBack = () => { setLeaving(true); setTimeout(onClose, 240); };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !riderId) return;
    setSending(true);
    setText("");
    if (textaRef.current) textaRef.current.style.height = "auto";

    try {
      await addDoc(collection(db, "Support"), {
        threadId, riderId, riderName, riderEmail,
        message:   trimmed,
        sender:    "rider",
        status:    "unread",
        createdAt: serverTimestamp(),
      });

      const threadSnap = await getDoc(threadRef);
      const threadData = threadSnap.exists() ? threadSnap.data() : {};

      await setDoc(threadRef, {
        riderId, riderName, riderEmail,
        updatedAt:      serverTimestamp(),
        lastMessage:    trimmed,
        lastSender:     "rider",
        unreadBySupport: (threadData.unreadBySupport ?? 0) + 1,
      }, { merge: true });

      if (!threadData.autoReplySent) {
        setTyping(true);
        setTimeout(async () => {
          try {
            await addDoc(collection(db, "Support"), {
              threadId, riderId,
              message:   AUTO_REPLY_TEXT,
              sender:    "support",
              isAuto:    true,
              status:    "read",
              createdAt: serverTimestamp(),
            });
            await updateDoc(threadRef, {
              autoReplySent: true,
              lastMessage:   AUTO_REPLY_TEXT,
              lastSender:    "support",
              updatedAt:     serverTimestamp(),
            });
          } catch (err) {
            console.error("[UaTob] Rider auto-reply failed:", err);
          } finally {
            setTyping(false);
          }
        }, 2400);
      }
    } catch (err) {
      console.error("[UaTob] Rider support send failed:", err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const grouped = groupByDay(messages);

  return (
    <>
      <style>{CSS}</style>
      <div className={`rsc-overlay ${leaving ? "leaving" : "entering"}`}>

        <div className="rsc-header">
          <button className="rsc-back-btn" onClick={handleBack} aria-label="Back">
            <ArrowLeft size={18} color="#374151" strokeWidth={2.2}/>
          </button>
          <div style={{ width:40, height:40, borderRadius:"50%", background:"linear-gradient(135deg,#EFF6FF,#DBEAFE)", border:"2px solid #BFDBFE", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 14v-3a8 8 0 0 1 16 0v3"/><rect x="2" y="13" width="4" height="6" rx="2"/><rect x="18" y="13" width="4" height="6" rx="2"/>
              <path d="M22 19v1a4 4 0 0 1-4 4h-3"/><circle cx="14" cy="24" r="1" fill="#2563EB"/>
            </svg>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:17, fontWeight:900, color:"#111827", letterSpacing:"-.2px", lineHeight:1.1 }}>UaTob Support</div>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:2 }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:"#22C55E", boxShadow:"0 0 0 2px rgba(34,197,94,.2)", display:"inline-block" }}/>
              <span style={{ fontSize:11.5, color:"#16A34A", fontWeight:700 }}>Online · usually replies in &lt; 5 min</span>
            </div>
          </div>
        </div>

        <div className="rsc-messages">
          {error && (
            <div style={{ margin:"14px 12px", padding:"14px 16px", borderRadius:14, background:"rgba(239,68,68,.06)", border:"1.5px solid rgba(239,68,68,.20)", display:"flex", alignItems:"flex-start", gap:10 }}>
              <div style={{ width:30, height:30, borderRadius:"50%", flexShrink:0, background:"rgba(239,68,68,.10)", border:"1.5px solid rgba(239,68,68,.25)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <AlertCircle size={14} color="#DC2626"/>
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:800, color:"#DC2626", marginBottom:3 }}>{error.title}</div>
                <div style={{ fontSize:12, color:"#6B7280", fontWeight:500, lineHeight:1.5 }}>{error.detail}</div>
              </div>
            </div>
          )}

          {loading && !error && (
            <div style={{ display:"flex", justifyContent:"center", padding:"40px 0" }}>
              <div style={{ width:24, height:24, border:"2.5px solid #E5E7EB", borderTopColor:"#3B82F6", borderRadius:"50%", animation:"rs-spin .8s linear infinite" }}/>
            </div>
          )}

          {!loading && !error && messages.length === 0 && (
            <div style={{ textAlign:"center", padding:"40px 20px", color:"#9CA3AF", fontSize:13, fontWeight:500 }}>
              No messages yet. Start a conversation — we'll get back to you within minutes.
            </div>
          )}

          {!loading && grouped.map((group, gi) => (
            <div key={`${group.label}-${gi}`}>
              {group.label && (
                <div className="rsc-day-divider"><span>{group.label}</span></div>
              )}
              {group.messages.map((msg) => {
                const isRider = msg.sender === "rider";
                return (
                  <div key={msg.id} className={`rsc-bubble-wrap ${isRider ? "outgoing" : "incoming"}`}>
                    <div className={`rsc-bubble ${isRider ? "outgoing" : "incoming"}`}>{msg.message}</div>
                    <div className="rsc-bubble-meta" style={{ justifyContent: isRider ? "flex-end" : "flex-start" }}>
                      {isRider
                        ? <><span>{formatTime(msg.createdAt)}</span><CheckCheck size={12} color="#9CA3AF"/></>
                        : <span>UaTob Support{msg.isAuto && " · auto-reply"}{msg.createdAt ? ` · ${formatTime(msg.createdAt)}` : ""}</span>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {typing && (
            <div className="rsc-bubble-wrap incoming">
              <div className="rsc-typing">
                {[0, 160, 320].map((delay, i) => (
                  <div key={i} className="rsc-typing-dot" style={{ animationDelay:`${delay}ms` }}/>
                ))}
              </div>
              <div className="rsc-bubble-meta">UaTob Support is typing…</div>
            </div>
          )}

          <div ref={bottomRef}/>
        </div>

        <div className="rsc-input-bar">
          <textarea
            ref={textaRef}
            className="rsc-textarea"
            rows={1}
            placeholder={riderId ? "Type a message…" : "Sign in to send messages"}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            disabled={!riderId}
          />
          <button
            className="rsc-send-btn"
            onClick={handleSend}
            disabled={!text.trim() || sending || !riderId}
            aria-label="Send"
          >
            {sending
              ? <div style={{ width:18, height:18, border:"2.5px solid rgba(255,255,255,.35)", borderTopColor:"#fff", borderRadius:"50%", animation:"rs-spin 1s linear infinite" }}/>
              : <Send size={18} color="#fff" strokeWidth={2.2} style={{ transform:"translateX(1px)" }}/>
            }
          </button>
        </div>

      </div>
    </>
  );
}

// ── Main overlay ──────────────────────────────────────────────────────────────
export default function RiderSupportOverlay({ onClose, account }) {
  const [leaving,     setLeaving]     = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [showChat,    setShowChat]    = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasThread,   setHasThread]   = useState(false);

  const riderId  = account?.uid ?? account?.id ?? null;
  const threadId = riderId ? `rider_${riderId}` : null;

  useEffect(() => {
    if (!threadId) return;
    let unsub = null;
    try {
      unsub = onSnapshot(
        doc(db, "SupportThreads", threadId),
        (snap) => {
          if (snap.exists()) {
            setHasThread(true);
            setUnreadCount(snap.data()?.unreadByRider ?? 0);
          } else {
            setHasThread(false);
            setUnreadCount(0);
          }
        },
        (err) => console.error("[UaTob] Rider thread subscribe failed:", err)
      );
    } catch (err) {
      console.error("[UaTob] Rider thread subscribe threw:", err);
    }
    return () => { try { if (typeof unsub === "function") unsub(); } catch {} };
  }, [threadId]);

  const handleClose = () => { setLeaving(true); setTimeout(onClose, 260); };

  useEffect(() => {
    window.history.pushState({ riderSupport: true }, "");
    const handler = () => handleClose();
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const SupportSvg = ({ size = 20, color = "#2563EB" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14v-3a8 8 0 0 1 16 0v3"/><rect x="2" y="13" width="4" height="6" rx="2"/><rect x="18" y="13" width="4" height="6" rx="2"/>
      <path d="M22 19v1a4 4 0 0 1-4 4h-3"/><circle cx="14" cy="24" r="1" fill={color}/>
    </svg>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className={`rs-overlay ${leaving ? "leaving" : "entering"}`}>

        {showChat && <ChatScreen account={account} onClose={() => setShowChat(false)}/>}

        <div className="rs-header">
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div className="rs-hero-icon" style={{ width:38, height:38, borderRadius:10 }}>
              <SupportSvg size={20}/>
            </div>
            <div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, fontWeight:900, color:"#111827", letterSpacing:"-.2px", lineHeight:1 }}>Support</div>
              <div style={{ fontSize:12, color:"#6B7280", fontWeight:500 }}>We're here to help</div>
            </div>
          </div>
          <button className="rs-close-btn" onClick={handleClose} aria-label="Close">
            <X size={18} color="#374151" strokeWidth={2.2}/>
          </button>
        </div>

        <div className="rs-body">

          <div className="rs-hero">
            <div className="rs-hero-icon"><SupportSvg size={32}/></div>
            <div className="rs-status-chip"><span className="rs-status-dot"/>Support team online</div>
            <div className="rs-hero-title">How can we help?</div>
            <div className="rs-hero-sub">
              {account?.firstName ? `Hi ${account.firstName}! ` : ""}
              Reach out anytime — our support team usually responds within a few minutes.
            </div>
          </div>

          <div className="rs-section" style={{ animationDelay:".08s" }}>
            <div className="rs-section-title">Contact us</div>
            <div className="rs-cards">

              <div className="rs-card" onClick={() => setShowChat(true)}>
                <div className="rs-card-icon" style={{ background:"linear-gradient(135deg,#EFF6FF,#DBEAFE)", border:"1px solid #BFDBFE", position:"relative" }}>
                  <SupportSvg size={20}/>
                  {unreadCount > 0 && (
                    <div style={{ position:"absolute", top:-4, right:-4, minWidth:18, height:18, borderRadius:9, background:"#DC2626", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, padding:"0 5px", boxShadow:"0 2px 6px rgba(220,38,38,.4)", border:"2px solid #fff" }}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </div>
                  )}
                </div>
                <div className="rs-card-body">
                  <div className="rs-card-label">{hasThread ? "Continue conversation" : "Chat with us"}</div>
                  <div className="rs-card-sub">
                    {unreadCount > 0
                      ? `${unreadCount} new message${unreadCount === 1 ? "" : "s"} from support`
                      : hasThread ? "Pick up where you left off" : "Fastest · usually < 5 min reply"}
                  </div>
                </div>
                {unreadCount > 0
                  ? <span className="rs-card-badge unread">NEW</span>
                  : <span className="rs-card-badge">LIVE</span>}
                <ChevronRight size={16} color="#9CA3AF"/>
              </div>

              <a href="mailto:support@uatob.com" className="rs-card">
                <div className="rs-card-icon" style={{ background:"linear-gradient(135deg,#FFF7ED,#FED7AA)", border:"1px solid #FDC97A" }}>
                  <Mail size={20} color="#EA580C" strokeWidth={2}/>
                </div>
                <div className="rs-card-body">
                  <div className="rs-card-label">Email us</div>
                  <div className="rs-card-sub">support@uatob.com</div>
                </div>
                <ChevronRight size={16} color="#9CA3AF"/>
              </a>

            </div>
          </div>

          <div className="rs-section" style={{ animationDelay:".16s" }}>
            <div className="rs-section-title">Frequently asked questions</div>
            <div className="rs-cards">
              {FAQ_ITEMS.map((item, idx) => (
                <div key={idx} className="rs-faq-item" onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)} style={{ animationDelay:`${.18 + idx * .04}s` }}>
                  <div className="rs-faq-q">
                    <span>{item.q}</span>
                    <ChevronRight size={15} color="#9CA3AF" style={{ transform:expandedFaq === idx ? "rotate(90deg)" : "rotate(0deg)", transition:"transform .2s", flexShrink:0 }}/>
                  </div>
                  {expandedFaq === idx && <div className="rs-faq-a">{item.a}</div>}
                </div>
              ))}
            </div>
          </div>

          <div className="rs-footer-note">
            UaTob Support · Available 7 days a week<br/>
            6 AM – 11 PM ET · support@uatob.com
          </div>

        </div>
      </div>
    </>
  );
}
