import { useState, useEffect } from "react";

function UaTobIcon({ size = 46 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="ribg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF"/><stop offset="100%" stopColor="#F3F4F6"/>
        </linearGradient>
        <linearGradient id="riroad" x1="0" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#111827"/><stop offset="100%" stopColor="#16A34A"/>
        </linearGradient>
        <linearGradient id="ricar" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#16A34A"/><stop offset="100%" stopColor="#15803D"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#ribg)"/>
      <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" stroke="#E5E7EB" strokeWidth="1"/>
      <path d="M 10 42 Q 32 24 54 42" stroke="url(#riroad)" strokeWidth="2.5" strokeDasharray="5 4" strokeLinecap="round" fill="none" opacity="0.6"/>
      <circle cx="10" cy="42" r="6" fill="#111827" opacity="0.12"/>
      <circle cx="10" cy="42" r="3.5" fill="#111827"/>
      <text x="10" y="45.5" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="4.5" fill="#fff">A</text>
      <circle cx="54" cy="42" r="6" fill="#16A34A" opacity="0.18"/>
      <circle cx="54" cy="42" r="3.5" fill="#16A34A"/>
      <text x="54" y="45.5" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="4.5" fill="#fff">B</text>
      <g transform="translate(26,26)">
        <ellipse cx="6" cy="12" rx="8" ry="2" fill="#111827" opacity="0.1"/>
        <rect x="1" y="5" width="10" height="6" rx="1.5" fill="url(#ricar)"/>
        <path d="M3 5 L3.8 2 L8.2 2 L9 5Z" fill="#15803D"/>
        <rect x="3.5" y="2.5" width="2.3" height="2" rx="0.5" fill="#fff" fillOpacity="0.85"/>
        <rect x="6.2" y="2.5" width="2.3" height="2" rx="0.5" fill="#fff" fillOpacity="0.85"/>
        <circle cx="3" cy="11" r="1.8" fill="#111827"/><circle cx="3" cy="11" r="0.9" fill="#16A34A"/>
        <circle cx="9" cy="11" r="1.8" fill="#111827"/><circle cx="9" cy="11" r="0.9" fill="#22C55E"/>
        <rect x="10.5" y="6.5" width="1.5" height="1" rx="0.5" fill="#FCD34D"/>
      </g>
    </svg>
  );
}

export default function App() {
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setDots(d => (d + 1) % 4), 500);
    return () => clearInterval(t);
  }, []);

  const loadingText = "Loading" + ".".repeat(dots);

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#FAFAFA",
      fontFamily: '"Outfit", system-ui, sans-serif',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;700;800&display=swap');

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes iconPulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 4px 12px rgba(22,163,74,0.2)); }
          50%       { transform: scale(1.06); filter: drop-shadow(0 6px 20px rgba(22,163,74,0.4)); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes roadDash {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: -40; }
        }
        .icon-pulse { animation: iconPulse 2s ease-in-out infinite; }
        .fade-up    { animation: fadeUp 0.5s ease both; }
        .spin-ring  { animation: spin 0.9s linear infinite; }
      `}</style>

      <div className="fade-up" style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "24px",
      }}>

        {/* Icon + spinning ring */}
        <div style={{ position: "relative", width: 96, height: 96, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Outer spinning arc — fills the wrapper exactly */}
          <svg
            className="spin-ring"
            width="96" height="96"
            viewBox="0 0 96 96"
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            <circle
              cx="48" cy="48" r="44"
              fill="none"
              stroke="#E5E7EB"
              strokeWidth="3"
            />
            <circle
              cx="48" cy="48" r="44"
              fill="none"
              stroke="#16A34A"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="70 207"
            />
          </svg>

          {/* Icon — centered via flex on parent */}
          <div className="icon-pulse" style={{ position: "relative", zIndex: 1, lineHeight: 0 }}>
            <UaTobIcon size={56} />
          </div>
        </div>

        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{
            fontFamily: '"Outfit", system-ui, sans-serif',
            fontWeight: 300,
            fontSize: "26px",
            color: "#111827",
            letterSpacing: "-0.5px",
            lineHeight: 1,
          }}>Ua</span>

          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M13 6l6 6-6 6"
              stroke="#16A34A" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>

          <span style={{
            fontFamily: '"Outfit", system-ui, sans-serif',
            fontWeight: 800,
            fontSize: "26px",
            background: "linear-gradient(135deg, #16A34A, #22C55E)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            letterSpacing: "-0.5px",
            lineHeight: 1,
          }}>Tob</span>
        </div>

        {/* Loading text */}
        <span style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "#9CA3AF",
          letterSpacing: "0.5px",
          minWidth: "90px",
          textAlign: "center",
        }}>
          {loadingText}
        </span>

      </div>
    </div>
  );
}
