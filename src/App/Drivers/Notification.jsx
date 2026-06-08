import { C } from '@/App/Drivers/constants.js';


/**
 * Slide-down toast notification.
 * Render when `notification` is non-null; the parent clears it after 3.5 s.
 */
export default function Notification({ notification }) {
  if (!notification) return null;

  return (
    <div className="notif">
      <div style={{
        width: 7, height: 7,
        background: C.onlineGreen,
        borderRadius: "50%",
        flexShrink: 0,
        animation: "pulse 1.2s ease-in-out infinite",
      }}/>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
          {notification.title}
        </div>
        <div style={{ fontSize: 11.5, color: C.textMid, marginTop: 2 }}>
          {notification.msg}
        </div>
      </div>
    </div>
  );
}