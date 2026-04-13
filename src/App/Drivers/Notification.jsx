import { useEffect, useState, useRef } from "react";
import { MessageCircle } from "lucide-react";
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
 * whenever the rider sends a new message. Auto-dismisses after 5 s.
 *
 * Props:
 *   activeTrip — trip object | null
 */
export default function Notification({ activeTrip }) {
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

      // Only react to rider messages we haven't shown yet
      if (data.senderRole !== "rider") return;
      if (last.id === lastMsgIdRef.current) return;

      lastMsgIdRef.current = last.id;
      setBanner({ text: data.text });

      // Auto-dismiss after 5 s
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setBanner(null), 5000);
    });

    return () => {
      unsub();
      clearTimeout(timerRef.current);
    };
  }, [rideId]);

  // Clear banner when trip ends
  useEffect(() => {
    if (!activeTrip) {
      setBanner(null);
      clearTimeout(timerRef.current);
      lastMsgIdRef.current = null;
    }
  }, [activeTrip]);

  if (!banner) return null;

  return (
    <div
      className="notif"
      style={{ cursor: "pointer" }}
      onClick={() => setBanner(null)}
    >
      {/* Pulse dot */}
      <div style={{
        width: 7, height: 7,
        background: C.onlineGreen,
        borderRadius: "50%",
        flexShrink: 0,
        animation: "pulse 1.2s ease-in-out infinite",
      }} />

      {/* Icon + message */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flex: 1, minWidth: 0 }}>
        <MessageCircle size={14} color={C.textMid} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: C.textMid,
            letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 2,
          }}>
            Rider
          </div>
          <div style={{
            fontSize: 13, fontWeight: 600, color: C.text,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {banner.text}
          </div>
        </div>
      </div>
    </div>
  );
}