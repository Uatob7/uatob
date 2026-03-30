import { X, Zap } from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';

/**
 * Fixed top banner shown when surge pricing is active.
 */
export default function SurgeBanner({ show, online, onClose }) {
  if (!show || !online) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 900,
      padding: "0 16px", display: "flex", justifyContent: "center",
      animation: "slideDown .35s ease",
    }}>
      <div style={{
        background: "linear-gradient(90deg,#F0FDF4,#DCFCE7,#F0FDF4)",
        border: "1px solid rgba(22,163,74,.3)",
        borderTop: "none",
        borderRadius: "0 0 18px 18px",
        padding: "10px 18px",
        display: "flex", alignItems: "center", gap: 10,
        maxWidth: 560, width: "100%",
        boxShadow: "0 6px 24px rgba(22,163,74,.1)",
      }}>
        <Zap size={15} color={C.onlineGreen}/>
        <span style={{
          fontSize: 12.5, fontWeight: 700, color: C.onlineGreen,
          flex: 1,
          fontFamily: "'Barlow Condensed',sans-serif",
          letterSpacing: ".5px",
        }}>
          SURGE ACTIVE — UP TO{" "}
          <span style={{ color: "#15803D" }}>2.1×</span>{" "}
          IN YOUR ZONE
        </span>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, display: "flex", padding: 2 }}
        >
          <X size={14}/>
        </button>
      </div>
    </div>
  );
}