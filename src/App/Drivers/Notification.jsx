import { useEffect, useState, useRef } from "react";
import { MessageCircle, ChevronRight } from "lucide-react";
import { C } from '@/App/Drivers/constants.js';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";

/**
 * Rider message banner.
 * Listens to the active ride's Messages subcollection and pops up
 * whenever the rider sends a new message. Auto-dismisses after DISMISS_MS.
 *
 * Props:
 *   activeTrip — trip object | null
 *   onReply    — optional (rideId) => void; opens the chat thread.
 *                If omitted, tapping the banner just dismisses it.
 */
const DISMISS_MS = 6000;

export default function Notification({ activeTrip, onReply }) {
  const [banner, setBanner] = useState(null);
  const timerRef            = useRef(null);
  const lastMsgIdRef        = useRef(null);

  const rideId = activeTrip?.id ?? activeTrip?.rideId ?? null;

  useEffect(() => {
    if (!rideId) {
      setBanner(null);
      return;
    }

    const db  = getFirestore();
    const ref = query(
      collection(db, "Rides", rideId, "Messages"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(ref, (snap) => {
      if (snap.empty) return;

      const docs = snap.docs;
      const last = docs[docs.length - 1];
      const data = last.data();

      if (data.senderRole !== "rider") return;
      if (last.id === lastMsgIdRef.current) return;

      lastMsgIdRef.current = last.id;
      setBanner({ id: last.id, text: data.text });

      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setBanner(null), DISMISS_MS);
    });

    return () => {
      unsub();
      clearTimeout(timerRef.current);
    };
  }, [rideId]);

  useEffect(() => {
    if (!activeTrip) {
      setBanner(null);
      clearTimeout(timerRef.current);
      lastMsgIdRef.current = null;
    }
  }, [activeTrip]);

  if (!banner) return null;

  const dismiss = () => { setBanner(null); clearTimeout(timerRef.current); };
  const handleClick = () => { if (onReply) onReply(rideId); else dismiss(); };

  return (
    <div
      className="notif"
      style={{
        position: "relative", overflow: "hidden", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 11,
        animation: "notifIn .34s cubic-bezier(.34,1.3,.5,1) both",
      }}
      onClick={handleClick}
    >
      <style>{`
        @keyframes notifIn  { from { opacity:0; transform: translateY(-10px) scale(.98); } to { opacity:1; transform:none; } }
        @keyframes notifBar { from { transform: scaleX(1); } to { transform: scaleX(0); } }
      `}</style>

      {/* Left accent stripe */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
        background: `linear-gradient(180deg, ${C.onlineGreen}, rgba(52,211,153,.2))`,
      }}/>

      {/* Avatar tile + pulse dot */}
      <div style={{ position: "relative", flexShrink: 0, marginLeft: 4 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 11,
          background: "rgba(52,211,153,.12)", border: "1px solid rgba(52,211,153,.28)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <MessageCircle size={16} color={C.onlineGreen} strokeWidth={2.2} />
        </div>
        <div style={{
          position: "absolute", top: -2, right: -2, width: 8, height: 8,
          borderRadius: "50%", background: C.onlineGreen,
          border: "2px solid rgba(11,15,23,1)",
          boxShadow: `0 0 8px ${C.onlineGreen}`,
          animation: "pulse 1.2s ease-in-out infinite",
        }}/>
      </div>

      {/* Kicker + message (up to 2 lines) */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{
            fontFamily: '"JetBrains Mono",monospace', fontSize: 9.5, fontWeight: 800,
            letterSpacing: "0.12em", textTransform: "uppercase", color: C.onlineGreen,
          }}>
            Rider
          </span>
          <span style={{ fontSize: 9, fontWeight: 600, color: C.textMid, opacity: .65 }}>
            new message
          </span>
        </div>
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: C.text, lineHeight: 1.3,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {banner.text}
        </div>
      </div>

      {/* Reply affordance */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 2, color: C.textMid }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.03em" }}>Reply</span>
        <ChevronRight size={14} strokeWidth={2.4} />
      </div>

      {/* Auto-dismiss countdown */}
      <div
        key={banner.id}
        style={{
          position: "absolute", left: 0, bottom: 0, height: 2, width: "100%",
          transformOrigin: "left",
          background: `linear-gradient(90deg, ${C.onlineGreen}, rgba(52,211,153,.3))`,
          animation: `notifBar ${DISMISS_MS}ms linear both`,
        }}
      />
    </div>
  );
}
