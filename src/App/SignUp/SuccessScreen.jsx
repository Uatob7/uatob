import { Mail, Clock, Zap, CheckCircle } from "lucide-react";
import { C } from '@/App/SignUp/constants.jsx';

export default function SuccessScreen({ firstName, email }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: '"Barlow", system-ui, sans-serif', color: C.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 420, animation: "scaleIn .6s cubic-bezier(.34,1.56,.64,1)" }}>
        <div style={{ width: 90, height: 90, background: "rgba(22,163,74,.1)", border: "2px solid rgba(22,163,74,.3)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", boxShadow: "0 0 0 12px rgba(22,163,74,.05)" }}>
          <CheckCircle size={44} color={C.green} />
        </div>

        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 38, fontWeight: 900, color: C.text, letterSpacing: "-1px", marginBottom: 10, lineHeight: 1.1 }}>
          Application<br/>Submitted!
        </div>
        <div style={{ fontSize: 15, color: C.textMid, lineHeight: 1.7, marginBottom: 32 }}>
          Welcome to UaTob, <strong style={{ color: C.text }}>{firstName}</strong>.<br/>
          Our team will review your application within{" "}
          <strong style={{ color: C.accent }}>24–48 hours</strong>. Check your email for updates.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { icon: Mail,  label: "Confirmation sent to", val: email,                     c: C.blue   },
            { icon: Clock, label: "Review time",          val: "24–48 hours",               c: C.accent },
            { icon: Zap,   label: "Once approved",        val: "Start earning immediately", c: C.green  },
          ].map((item, i) => (
            <div
              key={i}
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 18px", display: "flex", gap: 12, alignItems: "center", animation: `fadeUp .5s ease-out ${0.2 + i * 0.1}s both`, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}
            >
              <div style={{ width: 36, height: 36, background: item.c + "12", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <item.icon size={16} color={item.c} />
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 11, color: C.textDim, fontWeight: 600, letterSpacing: ".5px", textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 13.5, color: C.text, fontWeight: 700, marginTop: 2 }}>{item.val}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}