import { useState, useEffect } from "react";
import { Star, X, MessageSquare, Phone, Mail, ChevronRight } from "lucide-react";

// ── Custom Support Icon SVG ───────────────────────────────────────────
export function SupportIcon({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 14v-3a8 8 0 0 1 16 0v3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="2" y="13" width="4" height="6" rx="2" stroke={color} strokeWidth="1.8" fill="none"/>
      <rect x="18" y="13" width="4" height="6" rx="2" stroke={color} strokeWidth="1.8" fill="none"/>
      <path d="M22 19v1a4 4 0 0 1-4 4h-3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="14" cy="24" r="1" fill={color}/>
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const SUPPORT_CSS = `
  @keyframes sup-slideIn {
    from { opacity: 0; transform: translateY(100%); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes sup-slideOut {
    from { opacity: 1; transform: translateY(0); }
    to   { opacity: 0; transform: translateY(100%); }
  }
  @keyframes sup-fadeIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .sup-overlay {
    position: fixed; inset: 0; z-index: 1300;
    background: #F8FAFC;
    display: flex; flex-direction: column;
    font-family: 'Barlow', system-ui, sans-serif;
    overflow: hidden;
  }
  .sup-overlay.entering { animation: sup-slideIn .38s cubic-bezier(.22,1,.36,1) forwards; }
  .sup-overlay.leaving  { animation: sup-slideOut .28s cubic-bezier(.4,0,.6,1) forwards; }
  .sup-header {
    background: #fff;
    border-bottom: 1px solid #E5E7EB;
    padding: 0 20px;
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0;
    padding-top: max(20px, env(safe-area-inset-top));
    padding-bottom: 16px;
  }
  .sup-close-btn {
    width: 36px; height: 36px; border-radius: 50%;
    background: #F3F4F6; border: none;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background .15s, transform .12s;
    flex-shrink: 0;
  }
  .sup-close-btn:hover  { background: #E5E7EB; }
  .sup-close-btn:active { transform: scale(.93); }
  .sup-body {
    flex: 1; overflow-y: auto;
    padding: 24px 20px 32px;
    display: flex; flex-direction: column; gap: 24px;
    overscroll-behavior: contain;
  }
  .sup-hero {
    display: flex; flex-direction: column; align-items: center;
    text-align: center; gap: 12px;
    animation: sup-fadeIn .4s ease .05s both;
  }
  .sup-hero-icon {
    width: 72px; height: 72px; border-radius: 50%;
    background: linear-gradient(135deg, #EFF6FF, #DBEAFE);
    border: 2px solid #BFDBFE;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 0 8px rgba(59,130,246,.06);
  }
  .sup-hero-title { font-family: 'Barlow Condensed', sans-serif; font-size: 26px; font-weight: 900; color: #111827; letter-spacing: -.3px; }
  .sup-hero-sub   { font-size: 14px; color: #6B7280; font-weight: 500; line-height: 1.55; max-width: 300px; }
  .sup-status-chip {
    display: inline-flex; align-items: center; gap: 6px;
    background: #F0FDF4; border: 1px solid #BBF7D0;
    border-radius: 99px; padding: 5px 12px;
    font-size: 12px; font-weight: 700; color: #16A34A; letter-spacing: .04em;
  }
  .sup-status-dot { width: 7px; height: 7px; border-radius: 50%; background: #22C55E; box-shadow: 0 0 0 3px rgba(34,197,94,.2); }
  .sup-section { animation: sup-fadeIn .4s ease both; }
  .sup-section-title { font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #9CA3AF; margin-bottom: 10px; padding-left: 2px; }
  .sup-cards { display: flex; flex-direction: column; gap: 10px; }
  .sup-card {
    background: #fff; border: 1px solid #E5E7EB;
    border-radius: 16px; padding: 16px;
    display: flex; align-items: center; gap: 14px;
    cursor: pointer; text-decoration: none; color: inherit;
    transition: border-color .15s, box-shadow .15s, transform .12s;
    -webkit-tap-highlight-color: transparent;
  }
  .sup-card:hover  { border-color: #D1D5DB; box-shadow: 0 4px 16px rgba(0,0,0,.06); }
  .sup-card:active { transform: scale(.985); }
  .sup-card-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .sup-card-body { flex: 1; min-width: 0; }
  .sup-card-label { font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 800; color: #111827; letter-spacing: -.1px; margin-bottom: 2px; }
  .sup-card-sub   { font-size: 12.5px; color: #6B7280; font-weight: 500; }
  .sup-card-badge { font-size: 10px; font-weight: 700; letter-spacing: .04em; background: #FEF3C7; color: #D97706; border: 1px solid #FDE68A; border-radius: 6px; padding: 2px 7px; flex-shrink: 0; }
  .sup-faq-item { background: #fff; border: 1px solid #E5E7EB; border-radius: 14px; padding: 14px 16px; cursor: pointer; transition: border-color .15s; -webkit-tap-highlight-color: transparent; }
  .sup-faq-item:hover { border-color: #D1D5DB; }
  .sup-faq-q { font-size: 13.5px; font-weight: 700; color: #111827; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .sup-faq-a { font-size: 13px; color: #6B7280; font-weight: 500; line-height: 1.55; margin-top: 8px; border-top: 1px solid #F3F4F6; padding-top: 8px; }
  .sup-footer-note { text-align: center; font-size: 12px; color: #9CA3AF; font-weight: 500; line-height: 1.6; animation: sup-fadeIn .4s ease .3s both; }
`;

// ── FAQ data ──────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  { q: "How do I update my vehicle information?",    a: "Go to Profile → Vehicle Details. Changes may take up to 24 hours to reflect on the rider side." },
  { q: "When do I get paid?",                        a: "Payouts are processed daily. Funds typically arrive within 1–2 business days depending on your bank." },
  { q: "What happens if a rider doesn't show up?",  a: "After 5 minutes at the pickup location, you can mark the rider as a no-show and you'll still receive a wait-time fee." },
  { q: "How is my rating calculated?",              a: "Your rating is the average of your last 100 rider ratings. Ratings below 4.5 may affect your ability to receive premium rides." },
  { q: "How do I dispute a fare or report an issue?",a: "Use the 'Chat with us' option below or email support@uatob.com. Include the ride ID for faster resolution." },
];

// ── Component ─────────────────────────────────────────────────────────
export default function SupportOverlay({ onClose, driver }) {
  const [leaving,     setLeaving]     = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);

  const handleClose = () => { setLeaving(true); setTimeout(onClose, 260); };

  useEffect(() => {
    window.history.pushState({ support: true }, "");
    const handler = () => handleClose();
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  return (
    <>
      <style>{SUPPORT_CSS}</style>
      <div className={`sup-overlay ${leaving ? "leaving" : "entering"}`}>

        {/* ── Header ── */}
        <div className="sup-header">
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div className="sup-hero-icon" style={{ width:38, height:38, borderRadius:10 }}>
              <SupportIcon size={20} color="#2563EB" />
            </div>
            <div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, fontWeight:900, color:"#111827", letterSpacing:"-.2px", lineHeight:1 }}>Support</div>
              <div style={{ fontSize:12, color:"#6B7280", fontWeight:500 }}>We're here to help</div>
            </div>
          </div>
          <button className="sup-close-btn" onClick={handleClose} aria-label="Close support">
            <X size={18} color="#374151" strokeWidth={2.2} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="sup-body">

          {/* Hero */}
          <div className="sup-hero">
            <div className="sup-hero-icon"><SupportIcon size={32} color="#2563EB" /></div>
            <div className="sup-status-chip"><span className="sup-status-dot" />Support team online</div>
            <div className="sup-hero-title">How can we help?</div>
            <div className="sup-hero-sub">
              {driver?.firstName ? `Hi ${driver.firstName}! ` : ""}
              Reach out anytime — our driver support team usually responds within a few minutes.
            </div>
          </div>

          {/* Contact cards */}
          <div className="sup-section" style={{ animationDelay:".08s" }}>
            <div className="sup-section-title">Contact us</div>
            <div className="sup-cards">
              <a href="sms:+14079426078" className="sup-card">
                <div className="sup-card-icon" style={{ background:"linear-gradient(135deg,#EFF6FF,#DBEAFE)", border:"1px solid #BFDBFE" }}>
                  <MessageSquare size={20} color="#2563EB" strokeWidth={2} />
                </div>
                <div className="sup-card-body">
                  <div className="sup-card-label">Chat with us</div>
                  <div className="sup-card-sub">Fastest · usually &lt; 5 min reply</div>
                </div>
                <span className="sup-card-badge">LIVE</span>
                <ChevronRight size={16} color="#9CA3AF" />
              </a>
              <a href="tel:+14079426078" className="sup-card">
                <div className="sup-card-icon" style={{ background:"linear-gradient(135deg,#F0FDF4,#DCFCE7)", border:"1px solid #BBF7D0" }}>
                  <Phone size={20} color="#16A34A" strokeWidth={2} />
                </div>
                <div className="sup-card-body">
                  <div className="sup-card-label">Call support</div>
                  <div className="sup-card-sub">+1 (407) 942-6078</div>
                </div>
                <ChevronRight size={16} color="#9CA3AF" />
              </a>
              <a href="mailto:support@uatob.com" className="sup-card">
                <div className="sup-card-icon" style={{ background:"linear-gradient(135deg,#FFF7ED,#FED7AA)", border:"1px solid #FDC97A" }}>
                  <Mail size={20} color="#EA580C" strokeWidth={2} />
                </div>
                <div className="sup-card-body">
                  <div className="sup-card-label">Email us</div>
                  <div className="sup-card-sub">support@uatob.com</div>
                </div>
                <ChevronRight size={16} color="#9CA3AF" />
              </a>
            </div>
          </div>

          {/* Driver account card */}
          {driver?.firstName && (
            <div style={{ background:"#fff", border:"1px solid #E5E7EB", borderRadius:14, padding:"14px 16px", display:"flex", alignItems:"center", gap:12, animation:"sup-fadeIn .4s ease .14s both" }}>
              <div style={{ width:38, height:38, borderRadius:"50%", background:"#F3F4F6", border:"1.5px solid #E5E7EB", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:15, color:"#374151" }}>
                  {(driver.firstName?.[0] ?? "") + (driver.lastName?.[0] ?? "")}
                </span>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, color:"#9CA3AF", fontWeight:600, marginBottom:2, letterSpacing:".04em", textTransform:"uppercase" }}>Your account</div>
                <div style={{ fontSize:14, fontWeight:700, color:"#111827" }}>{driver.firstName} {driver.lastName}</div>
                <div style={{ fontSize:12, color:"#6B7280" }}>{driver.email ?? ""}</div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontSize:11, color:"#9CA3AF", marginBottom:2 }}>Rating</div>
                <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <Star size={12} fill="#F59E0B" color="#F59E0B" />
                  <span style={{ fontSize:14, fontWeight:800, color:"#111827", fontFamily:"'Barlow Condensed',sans-serif" }}>
                    {driver.averageRating != null ? driver.averageRating.toFixed(2) : "—"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* FAQ */}
          <div className="sup-section" style={{ animationDelay:".16s" }}>
            <div className="sup-section-title">Frequently asked questions</div>
            <div className="sup-cards">
              {FAQ_ITEMS.map((item, idx) => (
                <div
                  key={idx}
                  className="sup-faq-item"
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  style={{ animationDelay:`${.18 + idx * .04}s` }}
                >
                  <div className="sup-faq-q">
                    <span>{item.q}</span>
                    <ChevronRight
                      size={15}
                      color="#9CA3AF"
                      style={{ transform:expandedFaq === idx ? "rotate(90deg)" : "rotate(0deg)", transition:"transform .2s", flexShrink:0 }}
                    />
                  </div>
                  {expandedFaq === idx && <div className="sup-faq-a">{item.a}</div>}
                </div>
              ))}
            </div>
          </div>

          <div className="sup-footer-note">
            UaTob Driver Support · Available 7 days a week<br />
            6 AM – 11 PM ET · support@uatob.com
          </div>

        </div>
      </div>
    </>
  );
}
