import { Zap, Check, X } from 'lucide-react';
import { C, TYPE_COLOR, TYPE_LABEL } from '@/App/Drivers/constants.js';

/**
 * Full-screen overlay shown when a new trip request arrives.
 *
 * Props:
 *   tripRequest   — Firestore ride object (null = hidden)
 *   requestTimer  — seconds remaining (1–15)
 *   onAccept      — callback
 *   onDecline     — callback
 */
export default function TripRequestModal({ tripRequest, requestTimer, onAccept, onDecline }) {
  if (!tripRequest) return null;

  const fare     = `$${tripRequest.fareTotal?.toFixed(2) ?? "0.00"}`;
  const distance = `${tripRequest.tripDistanceMiles?.toFixed(1) ?? "—"} mi`;
  const eta      = `${tripRequest.tripDurationMin ?? "—"} min`;

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(250,250,250,.88)",
      backdropFilter: "blur(14px)",
      zIndex: 800,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      padding: 16,
      animation: "fadeIn .2s ease",
    }}>
      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderTop: `3px solid ${C.onlineGreen}`,
        borderRadius: "26px 26px 20px 20px",
        padding: "28px 24px 24px",
        width: "100%", maxWidth: 520,
        animation: "scaleIn .38s cubic-bezier(.34,1.56,.64,1)",
        boxShadow: "0 -12px 60px rgba(0,0,0,.1)",
      }}>

        {/* Header row — ride type label + countdown */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div className="lbl" style={{ color: C.onlineGreen }}>Incoming Request</div>
            <div className="condensed" style={{ fontSize: 28, fontWeight: 900, color: C.text, letterSpacing: "-0.5px", lineHeight: 1.1 }}>
              {tripRequest.rideLabel ?? "Standard"}
            </div>
            <div style={{ marginTop: 6 }}>
              <span
                className="badge-chip"
                style={{
                  background: (TYPE_COLOR[tripRequest.rideType] ?? C.blue) + "18",
                  border:     `1px solid ${(TYPE_COLOR[tripRequest.rideType] ?? C.blue)}40`,
                  color:      TYPE_COLOR[tripRequest.rideType] ?? C.blue,
                  fontSize:   11,
                }}
              >
                {TYPE_LABEL[tripRequest.rideType] ?? tripRequest.rideType}
              </span>
            </div>
          </div>

          {/* SVG countdown ring */}
          <div style={{ position: "relative", width: 58, height: 58 }}>
            <svg width="58" height="58" viewBox="0 0 58 58">
              <circle cx="29" cy="29" r="24" fill="none" stroke={C.border} strokeWidth="3"/>
              <circle
                cx="29" cy="29" r="24" fill="none"
                stroke={requestTimer <= 5 ? C.red : C.onlineGreen}
                strokeWidth="3"
                strokeDasharray="150.8"
                strokeDashoffset={150.8 - (requestTimer / 15) * 150.8}
                strokeLinecap="round"
                transform="rotate(-90 29 29)"
                style={{ transition: "stroke-dashoffset 1s linear, stroke .3s" }}
              />
            </svg>
            <div className="mono" style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 700,
              color: requestTimer <= 5 ? C.red : C.text,
            }}>
              {requestTimer}
            </div>
          </div>
        </div>

        {/* Fare + distance/ETA tiles */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <div style={{
            flex: 1,
            background: C.onlinePale,
            border: `1px solid ${C.onlineBorder}`,
            borderRadius: 14, padding: "14px 16px",
          }}>
            <div className="lbl">Fare</div>
            <div className="mono condensed" style={{ fontSize: 30, fontWeight: 700, color: C.onlineGreen, letterSpacing: "-0.5px", lineHeight: 1 }}>
              {fare}
            </div>
            {tripRequest.surgeMultiplier > 1 && (
              <div style={{
                marginTop: 4,
                display: "inline-flex", alignItems: "center", gap: 4,
                background: "rgba(22,163,74,.1)",
                border: "1px solid rgba(22,163,74,.28)",
                borderRadius: 6, padding: "2px 7px",
              }}>
                <Zap size={9} color={C.onlineGreen}/>
                <span className="condensed" style={{ fontSize: 11, fontWeight: 800, color: C.onlineGreen, letterSpacing: ".5px" }}>
                  {tripRequest.surgeMultiplier}× SURGE
                </span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 0.8 }}>
            {[{ lbl: "Distance", val: distance }, { lbl: "ETA", val: eta }].map(m => (
              <div key={m.lbl} style={{
                background: C.surfaceAlt,
                border: `1px solid ${C.border}`,
                borderRadius: 12, padding: "10px 14px",
                flex: 1, display: "flex", flexDirection: "column", justifyContent: "center",
              }}>
                <div className="lbl">{m.lbl}</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{m.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Route pill */}
        <div className="route-pill" style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, paddingTop: 2 }}>
              <div style={{ width: 9, height: 9, background: C.blue,        borderRadius: "50%", flexShrink: 0 }}/>
              <div style={{ width: 1, height: 26, background: C.border }}/>
              <div style={{ width: 9, height: 9, background: C.onlineGreen, borderRadius: 2, transform: "rotate(45deg)", flexShrink: 0 }}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 10 }}>
                <div className="lbl">Pickup</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{tripRequest.pickup}</div>
              </div>
              <div>
                <div className="lbl">Drop-off</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{tripRequest.dropoff}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            style={{ padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "center", background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 14, color: C.textMid, cursor: "pointer", boxShadow: `0 2px 8px ${C.shadow}`, transition: "all .2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.color = C.red; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMid; }}
            onClick={onDecline}
          >
            <X size={20}/>
          </button>
          <button
            style={{ flex: 1, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "linear-gradient(135deg, #22C55E, #16A34A 55%, #15803D)", border: "none", borderRadius: 14, color: "#fff", fontFamily: "'Barlow',sans-serif", fontWeight: 800, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 18px rgba(22,163,74,.3)", transition: "all .22s", letterSpacing: ".3px" }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(22,163,74,.4)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "";                 e.currentTarget.style.boxShadow = "0 4px 18px rgba(22,163,74,.3)"; }}
            onClick={onAccept}
          >
            <Check size={18}/> Accept · {fare}
          </button>
        </div>

      </div>
    </div>
  );
}