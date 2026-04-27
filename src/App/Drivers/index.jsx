import { useState, useEffect, useRef, useCallback } from "react";
import { Star, LocateFixed, Loader2, X, AlertCircle, CheckCircle2, Info,
         HeadphonesIcon, MessageSquare, Phone, Mail, ChevronRight, ExternalLink } from "lucide-react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

import CSS              from '@/App/Drivers/styles.js';
import { C }            from '@/App/Drivers/constants.js';
import UaTobIcon        from '@/App/Drivers/Icon.jsx';
import TripRequestModal from '@/App/Drivers/TripRequestModal.jsx';
import BottomTabBar     from '@/App/Drivers/BottomTabBar.jsx';
import HomeTab          from '@/App/Drivers/HomeTab.jsx';
import EarningsTab      from '@/App/Drivers/EarningsTab.jsx';
import TripsTab         from '@/App/Drivers/TripsTab.jsx';
import ProfileTab       from '@/App/Drivers/ProfileTab.jsx';
import DriverReviewModal from '@/App/Drivers/DriverReviewModal.jsx';
import { useDriverAccount }   from "@/App/Drivers/useDriverAccount";
import { useDriverRides }     from '@/App/Drivers/useDriverRides';
import { useActiveRides }     from "@/App/Drivers/useActiveRides";
import { useDriverEarnings }  from "@/App/Drivers/useDriverEarnings";
import { useCompletedRides }  from "@/App/Drivers/useCompletedRides";
import { useIncomingRequest } from "@/App/Drivers/useIncomingRequest";
import { useDriverReviews }   from "@/App/Drivers/useDriverReviews";
import { firebase_app }       from "@/firebase/config";

// ── Callables ─────────────────────────────────────────────────────────
const functions          = getFunctions(firebase_app, "us-east1");
const callDriverStatus   = httpsCallable(functions, "DriverStatus");
const callAcceptRide     = httpsCallable(functions, "acceptRide");
const callDeclineRide    = httpsCallable(functions, "declineRide");
const callUpdateTrip     = httpsCallable(functions, "updateTripStatus");
const callSaveFcmToken   = httpsCallable(functions, "saveDriverFcmToken");

// ── Trip button labels ────────────────────────────────────────────────
const TRIP_BUTTON_LABELS = {
  driver_assigned: "Arrived at Pickup",
  arrived:         "Start Trip",
  in_progress:     "Complete Trip",
};

// ── localStorage helpers ──────────────────────────────────────────────
const LS_SEEN_REVIEWS_KEY = 'uatob_driver_seen_reviews';
function loadSeenReviews()    { try { return new Set(JSON.parse(localStorage.getItem(LS_SEEN_REVIEWS_KEY) || '[]')); } catch { return new Set(); } }
function saveSeenReviews(set) { try { localStorage.setItem(LS_SEEN_REVIEWS_KEY, JSON.stringify([...set])); } catch (_) {} }

// ── FCM Push Registration ─────────────────────────────────────────────
async function registerFcmToken(uid) {
  try {
    if (!("Notification" in window)) return;
    const permission = await window.Notification.requestPermission();
    if (permission !== "granted") return;
    const messaging = getMessaging(firebase_app);
    const token = await getToken(messaging, {
      vapidKey: "BJ_sRHZonSGCKk2mB2i9ofTRS8ouFVMV-I15FX4sqdUXHyVb1lo6H-N4GMPrlcIIshRlykQicaxkxxFxcYcI4JQ",
    });
    if (!token) return;
    await callSaveFcmToken({ driverId: uid, token });
  } catch (err) {
    console.warn("[UaTob] Push registration failed:", err.message);
  }
}

// ── Audio helpers (unchanged) ─────────────────────────────────────────
function playRequestChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
    const playTone = ({ freq, type = "sine", start, duration, volume = 0.25 }) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, start);
      osc.connect(gain); gain.connect(master);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.start(start); osc.stop(start + duration);
    };
    const now = ctx.currentTime + 0.02;
    [{ t:0.00,f1:740,f2:1110,d:0.18},{t:0.24,f1:880,f2:1320,d:0.18},
     {t:0.48,f1:1047,f2:1568,d:0.26},{t:0.95,f1:740,f2:1110,d:0.18},
     {t:1.19,f1:880,f2:1320,d:0.18},{t:1.43,f1:1047,f2:1568,d:0.30}]
      .forEach(({t,f1,f2,d}) => {
        playTone({freq:f1,type:"sine",    start:now+t,duration:d,volume:0.22});
        playTone({freq:f2,type:"triangle",start:now+t,duration:d,volume:0.12});
      });
    setTimeout(() => ctx.close().catch(()=>{}), 3000);
  } catch(e) {}
}

function playAcceptSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx(), master = ctx.createGain();
    master.gain.value = 0.22; master.connect(ctx.destination);
    const playTone = ({freq,type="sine",start,duration,volume}) => {
      const osc=ctx.createOscillator(), gain=ctx.createGain();
      osc.type=type; osc.frequency.setValueAtTime(freq,start);
      osc.connect(gain); gain.connect(master);
      gain.gain.setValueAtTime(0.0001,start);
      gain.gain.exponentialRampToValueAtTime(volume,start+0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001,start+duration);
      osc.start(start); osc.stop(start+duration);
    };
    const now = ctx.currentTime+0.02;
    playTone({freq:784, type:"sine",    start:now,       duration:0.14,volume:0.28});
    playTone({freq:1568,type:"triangle",start:now,       duration:0.14,volume:0.10});
    playTone({freq:1047,type:"sine",    start:now+0.13,  duration:0.22,volume:0.32});
    playTone({freq:2093,type:"triangle",start:now+0.13,  duration:0.22,volume:0.08});
    setTimeout(() => ctx.close().catch(()=>{}), 2000);
  } catch(e) {}
}

function playDeclineSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx(), master = ctx.createGain();
    master.gain.value = 0.20; master.connect(ctx.destination);
    const playTone = ({freq,type="sine",start,duration,volume}) => {
      const osc=ctx.createOscillator(), gain=ctx.createGain();
      osc.type=type; osc.frequency.setValueAtTime(freq,start);
      osc.connect(gain); gain.connect(master);
      gain.gain.setValueAtTime(0.0001,start);
      gain.gain.exponentialRampToValueAtTime(volume,start+0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001,start+duration);
      osc.start(start); osc.stop(start+duration);
    };
    const now = ctx.currentTime+0.02;
    playTone({freq:330,type:"sine",  start:now,     duration:0.16,volume:0.22});
    playTone({freq:247,type:"sine",  start:now+0.13,duration:0.20,volume:0.18});
    setTimeout(() => ctx.close().catch(()=>{}), 2000);
  } catch(e) {}
}

// ── Custom Support Icon SVG ───────────────────────────────────────────
function SupportIcon({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Headset arc */}
      <path
        d="M4 14v-3a8 8 0 0 1 16 0v3"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Left ear cup */}
      <rect x="2" y="13" width="4" height="6" rx="2"
        stroke={color} strokeWidth="1.8" fill="none"/>
      {/* Right ear cup */}
      <rect x="18" y="13" width="4" height="6" rx="2"
        stroke={color} strokeWidth="1.8" fill="none"/>
      {/* Mic arm */}
      <path
        d="M22 19v1a4 4 0 0 1-4 4h-3"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Mic dot */}
      <circle cx="14" cy="24" r="1" fill={color}/>
    </svg>
  );
}

// ── Full-Screen Support Overlay ───────────────────────────────────────
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
    /* Safe area top */
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
  .sup-hero-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 26px; font-weight: 900; color: #111827; letter-spacing: -.3px;
  }
  .sup-hero-sub {
    font-size: 14px; color: #6B7280; font-weight: 500; line-height: 1.55; max-width: 300px;
  }

  /* Status chip */
  .sup-status-chip {
    display: inline-flex; align-items: center; gap: 6px;
    background: #F0FDF4; border: 1px solid #BBF7D0;
    border-radius: 99px; padding: 5px 12px;
    font-size: 12px; font-weight: 700; color: #16A34A; letter-spacing: .04em;
  }
  .sup-status-dot {
    width: 7px; height: 7px; border-radius: 50%; background: #22C55E;
    box-shadow: 0 0 0 3px rgba(34,197,94,.2);
  }

  /* Section */
  .sup-section { animation: sup-fadeIn .4s ease both; }
  .sup-section-title {
    font-size: 10px; font-weight: 800; letter-spacing: .12em;
    text-transform: uppercase; color: #9CA3AF;
    margin-bottom: 10px; padding-left: 2px;
  }
  .sup-cards { display: flex; flex-direction: column; gap: 10px; }

  /* Contact card */
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

  .sup-card-icon {
    width: 44px; height: 44px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .sup-card-body { flex: 1; min-width: 0; }
  .sup-card-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 16px; font-weight: 800; color: #111827;
    letter-spacing: -.1px; margin-bottom: 2px;
  }
  .sup-card-sub { font-size: 12.5px; color: #6B7280; font-weight: 500; }
  .sup-card-badge {
    font-size: 10px; font-weight: 700; letter-spacing: .04em;
    background: #FEF3C7; color: #D97706; border: 1px solid #FDE68A;
    border-radius: 6px; padding: 2px 7px; flex-shrink: 0;
  }

  /* FAQ items */
  .sup-faq-item {
    background: #fff; border: 1px solid #E5E7EB;
    border-radius: 14px; padding: 14px 16px;
    cursor: pointer; transition: border-color .15s;
    -webkit-tap-highlight-color: transparent;
  }
  .sup-faq-item:hover { border-color: #D1D5DB; }
  .sup-faq-q {
    font-size: 13.5px; font-weight: 700; color: #111827;
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
  }
  .sup-faq-a {
    font-size: 13px; color: #6B7280; font-weight: 500;
    line-height: 1.55; margin-top: 8px;
    border-top: 1px solid #F3F4F6; padding-top: 8px;
  }

  /* Footer note */
  .sup-footer-note {
    text-align: center; font-size: 12px; color: #9CA3AF; font-weight: 500;
    line-height: 1.6; animation: sup-fadeIn .4s ease .3s both;
  }
`;

const FAQ_ITEMS = [
  {
    q: "How do I update my vehicle information?",
    a: "Go to Profile → Vehicle Details. Changes may take up to 24 hours to reflect on the rider side.",
  },
  {
    q: "When do I get paid?",
    a: "Payouts are processed daily. Funds typically arrive within 1–2 business days depending on your bank.",
  },
  {
    q: "What happens if a rider doesn't show up?",
    a: "After 5 minutes at the pickup location, you can mark the rider as a no-show and you'll still receive a wait-time fee.",
  },
  {
    q: "How is my rating calculated?",
    a: "Your rating is the average of your last 100 rider ratings. Ratings below 4.5 may affect your ability to receive premium rides.",
  },
  {
    q: "How do I dispute a fare or report an issue?",
    a: "Use the 'Chat with us' option below or email support@uatob.com. Include the ride ID for faster resolution.",
  },
];

function SupportOverlay({ onClose, driver }) {
  const [leaving,      setLeaving]      = useState(false);
  const [expandedFaq,  setExpandedFaq]  = useState(null);

  const handleClose = () => {
    setLeaving(true);
    setTimeout(onClose, 260);
  };

  // Close on back gesture (popstate)
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
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="sup-hero-icon" style={{ width: 38, height: 38, borderRadius: 10 }}>
              <SupportIcon size={20} color="#2563EB" />
            </div>
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 900, color: "#111827", letterSpacing: "-.2px", lineHeight: 1 }}>
                Support
              </div>
              <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>
                We're here to help
              </div>
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
            <div className="sup-hero-icon">
              <SupportIcon size={32} color="#2563EB" />
            </div>
            <div className="sup-status-chip">
              <span className="sup-status-dot" />
              Support team online
            </div>
            <div className="sup-hero-title">How can we help?</div>
            <div className="sup-hero-sub">
              {driver?.firstName ? `Hi ${driver.firstName}! ` : ""}
              Reach out anytime — our driver support team usually responds within a few minutes.
            </div>
          </div>

          {/* Contact options */}
          <div className="sup-section" style={{ animationDelay: ".08s" }}>
            <div className="sup-section-title">Contact us</div>
            <div className="sup-cards">

              {/* Live chat */}
              <a
                href="sms:+14079426078"
                className="sup-card"
              >
                <div className="sup-card-icon" style={{ background: "linear-gradient(135deg,#EFF6FF,#DBEAFE)", border: "1px solid #BFDBFE" }}>
                  <MessageSquare size={20} color="#2563EB" strokeWidth={2} />
                </div>
                <div className="sup-card-body">
                  <div className="sup-card-label">Chat with us</div>
                  <div className="sup-card-sub">Fastest · usually &lt; 5 min reply</div>
                </div>
                <span className="sup-card-badge">LIVE</span>
                <ChevronRight size={16} color="#9CA3AF" />
              </a>

              {/* Phone */}
              <a
                href="tel:+14079426078"
                className="sup-card"
              >
                <div className="sup-card-icon" style={{ background: "linear-gradient(135deg,#F0FDF4,#DCFCE7)", border: "1px solid #BBF7D0" }}>
                  <Phone size={20} color="#16A34A" strokeWidth={2} />
                </div>
                <div className="sup-card-body">
                  <div className="sup-card-label">Call support</div>
                  <div className="sup-card-sub">+1 (407) 942-6078</div>
                </div>
                <ChevronRight size={16} color="#9CA3AF" />
              </a>

              {/* Email */}
              <a
                href="mailto:support@uatob.com"
                className="sup-card"
              >
                <div className="sup-card-icon" style={{ background: "linear-gradient(135deg,#FFF7ED,#FED7AA)", border: "1px solid #FDC97A" }}>
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

          {/* Driver info chip — makes it easy to reference when emailing */}
          {driver?.firstName && (
            <div style={{
              background: "#fff", border: "1px solid #E5E7EB",
              borderRadius: 14, padding: "14px 16px",
              display: "flex", alignItems: "center", gap: 12,
              animation: "sup-fadeIn .4s ease .14s both",
            }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#F3F4F6", border: "1.5px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 15, color: "#374151" }}>
                  {(driver.firstName?.[0] ?? "") + (driver.lastName?.[0] ?? "")}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600, marginBottom: 2, letterSpacing: ".04em", textTransform: "uppercase" }}>
                  Your account
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                  {driver.firstName} {driver.lastName}
                </div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>{driver.email ?? ""}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 2 }}>Rating</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Star size={12} fill="#F59E0B" color="#F59E0B" />
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#111827", fontFamily: "'Barlow Condensed', sans-serif" }}>
                    {driver.averageRating != null ? driver.averageRating.toFixed(2) : "—"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* FAQ */}
          <div className="sup-section" style={{ animationDelay: ".16s" }}>
            <div className="sup-section-title">Frequently asked questions</div>
            <div className="sup-cards">
              {FAQ_ITEMS.map((item, idx) => (
                <div
                  key={idx}
                  className="sup-faq-item"
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  style={{ animationDelay: `${.18 + idx * .04}s` }}
                >
                  <div className="sup-faq-q">
                    <span>{item.q}</span>
                    <ChevronRight
                      size={15} color="#9CA3AF"
                      style={{ transform: expandedFaq === idx ? "rotate(90deg)" : "rotate(0deg)", transition: "transform .2s", flexShrink: 0 }}
                    />
                  </div>
                  {expandedFaq === idx && (
                    <div className="sup-faq-a">{item.a}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="sup-footer-note">
            UaTob Driver Support · Available 7 days a week<br />
            6 AM – 11 PM ET · support@uatob.com
          </div>

        </div>
      </div>
    </>
  );
}

// ── APP NOTIFICATION ──────────────────────────────────────────────────
const NOTIF_STYLES = `
  @keyframes notifSlideDown { from{opacity:0;transform:translateY(-20px) scale(.96)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes notifSlideUp   { from{opacity:1;transform:translateY(0) scale(1)} to{opacity:0;transform:translateY(-16px) scale(.97)} }
  @keyframes notifProgress  { from{width:100%} to{width:0%} }
`;

function getNotifTheme(title) {
  const t = (title || "").toLowerCase();
  if (t.includes("accept")||t.includes("online")||t.includes("complete")||t.includes("trip"))
    return { color:"#16A34A",bg:"rgba(22,163,74,.10)",border:"rgba(22,163,74,.30)",ring:"rgba(22,163,74,.06)",Icon:CheckCircle2 };
  if (t.includes("offline")||t.includes("declin")||t.includes("error")||t.includes("fail")||t.includes("expired"))
    return { color:"#DC2626",bg:"rgba(220,38,38,.08)",border:"rgba(220,38,38,.25)",ring:"rgba(220,38,38,.05)",Icon:AlertCircle };
  return { color:"#2563EB",bg:"rgba(37,99,235,.08)",border:"rgba(37,99,235,.25)",ring:"rgba(37,99,235,.05)",Icon:Info };
}

function AppNotification({ notificationOverride }) {
  const notif = notificationOverride;
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const hideTimer = useRef(null);

  useEffect(() => {
    if (!notif) { setVisible(false); setLeaving(false); return; }
    setLeaving(false); setVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => setVisible(false), 280);
    }, 2800);
    return () => clearTimeout(hideTimer.current);
  }, [notif?.title, notif?.msg]);

  if (!visible || !notif) return null;
  const theme = getNotifTheme(notif.title);
  const { Icon } = theme;

  return (
    <>
      <style>{NOTIF_STYLES}</style>
      <div style={{ position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:1200,width:"calc(100% - 32px)",maxWidth:400,animation:leaving?"notifSlideUp .28s cubic-bezier(.4,0,.6,1) forwards":"notifSlideDown .32s cubic-bezier(.34,1.56,.64,1) forwards" }}>
        <div style={{ background:"#fff",borderRadius:20,padding:"14px 16px 14px 14px",boxShadow:"0 8px 32px rgba(0,0,0,.13),0 2px 8px rgba(0,0,0,.07)",border:`1.5px solid ${theme.border}`,display:"flex",alignItems:"center",gap:12,overflow:"hidden",position:"relative" }}>
          <div style={{ flexShrink:0,width:42,height:42,borderRadius:"50%",background:theme.bg,border:`1.5px solid ${theme.border}`,boxShadow:`0 0 0 6px ${theme.ring}`,display:"flex",alignItems:"center",justifyContent:"center" }}>
            <Icon size={18} color={theme.color} strokeWidth={2.2} />
          </div>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:900,color:"#111827",letterSpacing:"-.2px",lineHeight:1.2,marginBottom:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{notif.title}</div>
            <div style={{ fontSize:13,color:"#6B7280",fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{notif.msg}</div>
          </div>
          <div style={{ position:"absolute",bottom:0,left:0,height:3,borderRadius:"0 0 20px 20px",background:theme.color,opacity:.35,animation:"notifProgress 3s linear forwards" }} />
        </div>
      </div>
    </>
  );
}

// ── NOTIFICATION PERMISSION POPUP ─────────────────────────────────────
function NotificationPopup({ onEnable, onSkip, loading }) {
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onSkip(); }} style={{ position:"fixed",inset:0,zIndex:1050,background:"rgba(0,0,0,.45)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}>
      <style>{`@keyframes locFadeIn{from{opacity:0}to{opacity:1}} @keyframes locSlideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}} @keyframes locSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={{ background:"#fff",borderRadius:24,padding:"28px 24px 24px",width:"100%",maxWidth:360,boxShadow:"0 24px 60px rgba(0,0,0,.18)",animation:"locSlideUp .28s cubic-bezier(.34,1.56,.64,1)" }}>
        <div style={{ display:"flex",justifyContent:"center",marginBottom:20 }}>
          <div style={{ width:68,height:68,borderRadius:"50%",background:"rgba(37,99,235,.09)",border:"2px solid rgba(37,99,235,.25)",display:"flex",alignItems:"center",justifyContent:"center" }}>
            {loading ? <Loader2 size={28} color="#2563EB" style={{ animation:"locSpin 1s linear infinite" }}/> : <SupportIcon size={28} color="#2563EB"/>}
          </div>
        </div>
        <div style={{ textAlign:"center",marginBottom:8 }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,color:"#111827",marginBottom:6 }}>Stay in the loop</div>
          <div style={{ fontSize:13.5,color:"#6B7280",fontWeight:500,lineHeight:1.6 }}>Enable push notifications so you never miss a ride request.</div>
        </div>
        {!loading && (
          <div style={{ margin:"16px 0 22px",display:"flex",flexDirection:"column",gap:10 }}>
            {[{icon:"🔔",text:"Instant ride request alerts"},{icon:"📍",text:"Trip status updates"},{icon:"💰",text:"Earning confirmations"}]
              .map(({icon,text}) => (
                <div key={text} style={{ display:"flex",alignItems:"center",gap:10,background:"rgba(37,99,235,.04)",borderRadius:10,padding:"9px 12px",border:"1px solid rgba(37,99,235,.10)" }}>
                  <span style={{ fontSize:16 }}>{icon}</span>
                  <span style={{ fontSize:13,fontWeight:600,color:"#374151" }}>{text}</span>
                </div>
              ))}
          </div>
        )}
        {!loading && (
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            <button onClick={onEnable} style={{ width:"100%",padding:15,borderRadius:14,border:"none",background:"linear-gradient(135deg,#3B82F6,#2563EB 55%,#1D4ED8)",color:"#fff",fontSize:15,fontWeight:800,fontFamily:"'Barlow',sans-serif",cursor:"pointer",boxShadow:"0 4px 14px rgba(37,99,235,.35)",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
              <SupportIcon size={16} color="#fff"/> Enable notifications
            </button>
            <button onClick={onSkip} style={{ width:"100%",padding:14,borderRadius:14,border:"1.5px solid #E5E7EB",background:"#fff",color:"#6B7280",fontSize:14,fontWeight:700,cursor:"pointer" }}>
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── REJECTED BANNER ───────────────────────────────────────────────────
function RejectedBanner() {
  return (
    <div style={{ margin:"16px 20px",padding:16,borderRadius:16,background:"rgba(220,38,38,.06)",border:"1.5px solid rgba(220,38,38,.20)",display:"flex",alignItems:"flex-start",gap:12 }}>
      <div style={{ flexShrink:0,width:36,height:36,borderRadius:"50%",background:"rgba(220,38,38,.10)",border:"1.5px solid rgba(220,38,38,.25)",display:"flex",alignItems:"center",justifyContent:"center" }}>
        <AlertCircle size={18} color="#DC2626"/>
      </div>
      <div>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:900,color:"#DC2626",marginBottom:4 }}>Application not approved</div>
        <div style={{ fontSize:13,color:"#6B7280",fontWeight:500,lineHeight:1.6 }}>Your driver application was not approved. Please review your profile and resubmit your documents, or contact support.</div>
        <a href="mailto:support@uatob.com" style={{ display:"inline-block",marginTop:10,fontSize:13,fontWeight:700,color:"#DC2626",textDecoration:"none" }}>Contact support →</a>
      </div>
    </div>
  );
}

// ── SUSPENDED MODAL ───────────────────────────────────────────────────
function SuspendedModal() {
  return (
    <div style={{ position:"fixed",inset:0,zIndex:1100,background:"rgba(0,0,0,.5)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}>
      <style>{`@keyframes locSlideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ background:"#fff",borderRadius:24,padding:"32px 24px 28px",width:"100%",maxWidth:380,boxShadow:"0 24px 60px rgba(0,0,0,.2)",animation:"locSlideUp .28s cubic-bezier(.34,1.56,.64,1)",textAlign:"center" }}>
        <div style={{ display:"flex",justifyContent:"center",marginBottom:20 }}>
          <div style={{ width:72,height:72,borderRadius:"50%",background:"rgba(220,38,38,.08)",border:"2px solid rgba(220,38,38,.25)",display:"flex",alignItems:"center",justifyContent:"center" }}>
            <AlertCircle size={32} color="#DC2626"/>
          </div>
        </div>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:900,color:"#111827",marginBottom:8 }}>Account Suspended</div>
        <div style={{ fontSize:14,color:"#6B7280",fontWeight:500,lineHeight:1.6 }}>Your account has been suspended. Contact support for more information.</div>
        <a href="mailto:support@uatob.com" style={{ display:"inline-block",marginTop:24,width:"100%",padding:14,borderRadius:12,background:"linear-gradient(135deg,#DC2626,#991B1B)",color:"#fff",fontSize:15,fontWeight:800,textDecoration:"none",boxShadow:"0 4px 14px rgba(220,38,38,.3)" }}>
          Contact Support
        </a>
      </div>
    </div>
  );
}

// ── LOCATION POPUP ────────────────────────────────────────────────────
function LocationPopup({ onAllow, onDeny, loading, error }) {
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onDeny(); }} style={{ position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,.45)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}>
      <style>{`@keyframes locFadeIn{from{opacity:0}to{opacity:1}} @keyframes locSlideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}} @keyframes locSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={{ background:"#fff",borderRadius:24,padding:"28px 24px 24px",width:"100%",maxWidth:360,boxShadow:"0 24px 60px rgba(0,0,0,.18)",animation:"locSlideUp .28s cubic-bezier(.34,1.56,.64,1)" }}>
        <div style={{ display:"flex",justifyContent:"center",marginBottom:20 }}>
          <div style={{ width:68,height:68,borderRadius:"50%",background:error?"rgba(220,38,38,.08)":"rgba(22,163,74,.1)",border:`2px solid ${error?"rgba(220,38,38,.25)":"rgba(22,163,74,.3)"}`,display:"flex",alignItems:"center",justifyContent:"center" }}>
            {loading ? <Loader2 size={28} color="#16A34A" style={{ animation:"locSpin 1s linear infinite" }}/> : error ? <AlertCircle size={28} color="#DC2626"/> : <LocateFixed size={28} color="#16A34A"/>}
          </div>
        </div>
        <div style={{ textAlign:"center",marginBottom:8 }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,color:"#111827",marginBottom:6 }}>
            {loading?"Getting your location…":error?"Location required":"UaTob needs your location"}
          </div>
          <div style={{ fontSize:13.5,color:"#6B7280",fontWeight:500,lineHeight:1.6 }}>
            {loading?"Please allow location access in your browser.":error||"To go online and receive ride requests, we need your current location."}
          </div>
        </div>
        {!loading && (
          <div style={{ display:"flex",flexDirection:"column",gap:10,marginTop:22 }}>
            <button onClick={onAllow} style={{ width:"100%",padding:15,borderRadius:14,border:"none",background:error?"#DC2626":"linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)",color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer",boxShadow:error?"0 4px 14px rgba(220,38,38,.3)":"0 4px 14px rgba(22,163,74,.35)",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
              <LocateFixed size={16}/> {error?"Try again":"Allow location"}
            </button>
            <button onClick={onDeny} style={{ width:"100%",padding:14,borderRadius:14,border:"1.5px solid #E5E7EB",background:"#fff",color:"#6B7280",fontSize:14,fontWeight:700,cursor:"pointer" }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────
export default function UaTobDriverApp({ uid }) {
  const { driver }                        = useDriverAccount(uid);
  const { earnings, refetch }             = useDriverEarnings(uid);
  const { rides, loading: ridesLoading }  = useDriverRides(uid);
  const { requests, loading: reqLoading } = useIncomingRequest(uid);
  const { activeRides }                   = useActiveRides(uid);
  const { completedRides }                = useCompletedRides(uid);
  const { reviews }                       = useDriverReviews(uid);

  const isRejected   = driver?.status === "rejected";
  const driverOnTrip = driver?.trip === true;
  const sourceLoading = driverOnTrip ? reqLoading  : ridesLoading;
  const sourceRides   = driverOnTrip ? requests    : rides;

  // ── Local state ───────────────────────────────────────────────────
  const [mounted,           setMounted]           = useState(false);
  const [activeTab,         setActiveTab]         = useState("home");
  const [online,            setOnline]            = useState(false);
  const [activeTrip,        setActiveTrip]        = useState(null);
  const [requestTimer,      setRequestTimer]      = useState(15);
  const [notification,      setNotification]      = useState(null);
  const [tripBtnLabel,      setTripBtnLabel]      = useState("");
  const [dismissedRequests, setDismissedRequests] = useState(() => new Set());
  const [acceptedRequestId, setAcceptedRequestId] = useState(null);
  const [actionPending,     setActionPending]     = useState(false);
  const [advancePending,    setAdvancePending]    = useState(false);
  const [showLocationPopup, setShowLocationPopup] = useState(false);
  const [locationLoading,   setLocationLoading]   = useState(false);
  const [locationError,     setLocationError]     = useState("");
  const [showNotifPopup,    setShowNotifPopup]    = useState(false);
  const [notifLoading,      setNotifLoading]      = useState(false);
  const [seenReviewIds,     setSeenReviewIds]     = useState(() => loadSeenReviews());
  const [pendingReview,     setPendingReview]     = useState(null);
  // ── NEW: Support overlay ──────────────────────────────────────────
  const [showSupport,       setShowSupport]       = useState(false);

  const timerRef          = useRef(null);
  const prevRequestId     = useRef(null);
  const locationPingRef   = useRef(null);
  const onlineInitialized = useRef(false);

  useEffect(() => { if (isRejected) setActiveTab("profile"); }, [isRejected]);

  useEffect(() => {
    if (!driver || onlineInitialized.current) return;
    onlineInitialized.current = true;
    setOnline(driver.status === "online");
  }, [driver]);

  useEffect(() => {
    if (!uid) return;
    let unsub = () => {};
    try {
      const messaging = getMessaging(firebase_app);
      unsub = onMessage(messaging, async (payload) => {
        const title = payload.notification?.title ?? "New Ride";
        const body  = payload.notification?.body  ?? "";
        showNotif(title, body);
        if ("serviceWorker" in navigator) {
          try {
            const reg = await navigator.serviceWorker.ready;
            reg.showNotification(title, { body, icon:"/icon.png", tag:payload.data?.rideId??"uatob-driver", renotify:true, data:payload.data||{} });
          } catch(e) {}
        }
      });
    } catch(e) {}
    return unsub;
  }, [uid]);

  const tripRequest = online && !isRejected && !sourceLoading
    ? (sourceRides.find(r => r.status === "searching_driver" && !dismissedRequests.has(r.id) && r.id !== acceptedRequestId) ?? null)
    : null;

  useEffect(() => {
    const newId = tripRequest?.id ?? null;
    if (newId && newId !== prevRequestId.current) playRequestChime();
    prevRequestId.current = newId;
  }, [tripRequest?.id]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const active = activeRides.find(r =>
      r.driverUid === uid && ["driver_assigned","arrived","in_progress"].includes(r.status)
    );
    setActiveTrip(active || null);
  }, [activeRides, uid]);

  useEffect(() => { if (activeTrip?.id) setAcceptedRequestId(null); }, [activeTrip?.id]);

  useEffect(() => {
    if (!reviews.length || pendingReview || activeTrip || tripRequest) return;
    const unseen = reviews.find(r => !seenReviewIds.has(r.id));
    if (unseen) setPendingReview(unseen);
  }, [reviews, activeTrip, tripRequest]);

  const handleDismissReview = () => {
    if (!pendingReview) return;
    const updated = new Set(seenReviewIds);
    updated.add(pendingReview.id);
    setSeenReviewIds(updated);
    saveSeenReviews(updated);
    setPendingReview(null);
  };

  useEffect(() => { setTripBtnLabel(TRIP_BUTTON_LABELS[activeTrip?.status] ?? ""); }, [activeTrip?.status]);

  useEffect(() => {
    if (!tripRequest) { clearInterval(timerRef.current); setRequestTimer(15); return; }
    setRequestTimer(15);
    timerRef.current = setInterval(() => {
      setRequestTimer(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setDismissedRequests(prev => { const next = new Set(prev); if (tripRequest?.id) next.add(tripRequest.id); return next; });
          showNotif("Request expired","Looking for next...");
          return 15;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [tripRequest?.id]);

  useEffect(() => {
    clearInterval(locationPingRef.current);
    if (!online || isRejected) return;
    locationPingRef.current = setInterval(async () => {
      try {
        const position = await new Promise((res,rej) => navigator.geolocation.getCurrentPosition(res,rej,{ enableHighAccuracy:true,timeout:8000,maximumAge:30000 }));
        const { latitude:lat, longitude:lng } = position.coords;
        await callDriverStatus({ uid, status:"location_ping", lat, lng });
      } catch(e) {}
    }, 60_000);
    return () => clearInterval(locationPingRef.current);
  }, [online, uid, isRejected]);

  const showNotif = (title, msg) => {
    setNotification({ title, msg });
    setTimeout(() => setNotification(null), 3200);
  };

  const callDriverStatusFn = useCallback(async (status, lat=null, lng=null) => {
    const payload = { uid, status };
    if (lat!==null && lng!==null) { payload.lat=lat; payload.lng=lng; }
    const { data } = await callDriverStatus(payload);
    if (data?.error) throw new Error(data.error);
    return data;
  }, [uid]);

  const requestLocationAndGoOnline = useCallback(async () => {
    setLocationError(""); setLocationLoading(true);
    try {
      const position = await new Promise((res,rej) => navigator.geolocation.getCurrentPosition(res,rej,{ enableHighAccuracy:true,timeout:10000,maximumAge:0 }));
      const { latitude:lat, longitude:lng } = position.coords;
      await callDriverStatusFn("online", lat, lng);
      setOnline(true); setShowLocationPopup(false); setLocationError("");
      showNotif("Online","Ready for rides");
      if ("Notification" in window && window.Notification.permission === "default") setShowNotifPopup(true);
      else if ("Notification" in window && window.Notification.permission === "granted") registerFcmToken(uid);
    } catch(err) {
      if      (err.code===1) setLocationError("Location access was denied. Allow location in your browser settings.");
      else if (err.code===2) setLocationError("Could not detect your location. Check your device settings.");
      else if (err.code===3) setLocationError("Location request timed out. Please try again.");
      else                   setLocationError(err.message || "Could not get your location.");
    } finally { setLocationLoading(false); }
  }, [callDriverStatusFn, uid]);

  const handleEnableNotifications = useCallback(async () => {
    setNotifLoading(true);
    await registerFcmToken(uid);
    setNotifLoading(false); setShowNotifPopup(false);
  }, [uid]);

  const handleSkipNotifications = useCallback(() => setShowNotifPopup(false), []);

  const handleToggleOnline = useCallback(async () => {
    if (isRejected) return;
    if (online) {
      try { await callDriverStatusFn("offline"); } catch(e) {}
      setOnline(false); setActiveTrip(null); setDismissedRequests(new Set()); setAcceptedRequestId(null);
      showNotif("Offline","See you next time");
    } else {
      setLocationError(""); setShowLocationPopup(true);
    }
  }, [online, callDriverStatusFn, isRejected]);

  const handleLocationDeny = useCallback(() => {
    if (locationLoading) return;
    setShowLocationPopup(false); setLocationError(""); setLocationLoading(false);
  }, [locationLoading]);

  const handleAcceptTrip = async () => {
    if (!tripRequest || actionPending) return;
    setActionPending(true);
    try {
      const { data } = await callAcceptRide({ rideId:tripRequest.id, uid });
      if (data?.error) throw new Error(data.error);
      playAcceptSound(); clearInterval(timerRef.current);
      setAcceptedRequestId(tripRequest.id);
      setDismissedRequests(prev => { const next=new Set(prev); next.add(tripRequest.id); return next; });
      showNotif("Accepted","Drive to pickup");
    } catch(e) { showNotif("Error","Accept failed"); }
    finally { setActionPending(false); }
  };

  const handleDeclineTrip = async () => {
    if (!tripRequest || actionPending) return;
    setActionPending(true);
    try {
      const { data } = await callDeclineRide({ rideId:tripRequest.id, uid });
      if (data?.error) throw new Error(data.error);
      playDeclineSound(); clearInterval(timerRef.current);
      setDismissedRequests(prev => { const next=new Set(prev); next.add(tripRequest.id); return next; });
      showNotif("Declined","Searching for next ride");
    } catch(e) { showNotif("Error","Decline failed"); }
    finally { setActionPending(false); }
  };

  const handleAdvanceTrip = async () => {
    if (!activeTrip || advancePending) return;
    const actionMap = { driver_assigned:"arrive", arrived:"start", in_progress:"complete" };
    const action = actionMap[activeTrip.status];
    if (!action) return;
    setAdvancePending(true);
    try {
      const { data } = await callUpdateTrip({ rideId:activeTrip.id, driverUid:uid, action });
      if (data?.error) throw new Error(data.error);
      if (action === "complete") { await refetch(); showNotif("Trip complete",`+$${activeTrip.fareTotal||0}`); }
      else showNotif("Updating trip…","Please wait");
    } catch(e) { showNotif("Error","Update failed"); }
    finally { setAdvancePending(false); }
  };

  const tripStage      = activeTrip?.status;
  const tripStageColor = { driver_assigned:C.blue, arrived:C.onlineGreen, in_progress:C.green }[tripStage] || C.green;

  // ── Support icon button ───────────────────────────────────────────
  const SupportBtn = () => (
    <button
      onClick={() => setShowSupport(true)}
      style={{
        width: 36, height: 36, borderRadius: 10,
        background: C.surface,
        border: `1.5px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", transition: "background .15s, border-color .15s, transform .12s",
        flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.background = "#EFF6FF"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border;  e.currentTarget.style.background = C.surface;  }}
      onMouseDown={e  => { e.currentTarget.style.transform = "scale(.92)"; }}
      onMouseUp={e    => { e.currentTarget.style.transform = "scale(1)"; }}
      aria-label="Open support"
    >
      <SupportIcon size={18} color="#2563EB" />
    </button>
  );

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:'"Barlow",system-ui,sans-serif', color:C.text, position:"relative" }}>
      <style>{CSS}</style>

      {/* Support full-screen overlay */}
      {showSupport && (
        <SupportOverlay onClose={() => setShowSupport(false)} driver={driver} />
      )}

      {driver?.status === "suspended" && <SuspendedModal />}

      {showLocationPopup && !isRejected && (
        <LocationPopup loading={locationLoading} error={locationError} onAllow={requestLocationAndGoOnline} onDeny={handleLocationDeny} />
      )}

      {showNotifPopup && (
        <NotificationPopup loading={notifLoading} onEnable={handleEnableNotifications} onSkip={handleSkipNotifications} />
      )}

      <AppNotification notificationOverride={notification} />

      {!isRejected && (
        <TripRequestModal
          tripRequest={tripRequest} driver={driver} requestTimer={requestTimer}
          onAccept={handleAcceptTrip} onDecline={handleDeclineTrip} actionPending={actionPending}
        />
      )}

      {pendingReview && !activeTrip && !tripRequest && !isRejected && (
        <DriverReviewModal review={pendingReview} onClose={handleDismissReview} />
      )}

      <div style={{ maxWidth:680, margin:"0 auto", paddingBottom:90 }}>

        {/* ── Header ── */}
        <div style={{ padding:"20px 20px 0", display:"flex", justifyContent:"space-between", alignItems:"center", animation:mounted?"slideUp .5s ease-out forwards":"none", opacity:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <UaTobIcon size={40} online={online} />
            <div>
              <div className="condensed lbl">Driver Console</div>
              <div style={{ fontSize:20, fontWeight:800 }}>{driver?.firstName ?? ""}</div>
            </div>
          </div>

          {/* Right side: rating + support button */}
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, background:C.surface, borderRadius:100, padding:"6px 12px", border:`1px solid ${C.border}` }}>
              <Star size={11} fill="#F59E0B" color="#F59E0B" />
              <span style={{ fontSize:13, fontWeight:700, color:C.text }}>
                {driver?.averageRating != null ? driver.averageRating.toFixed(2) : "—"}
              </span>
            </div>
            {/* Support icon button — replaces the old Bell */}
            <SupportBtn />
          </div>
        </div>

        {isRejected && <RejectedBanner />}

        {activeTab === "home"     && !isRejected && <HomeTab driver={driver} online={online} rides={rides} activeTrip={activeTrip} tripStage={tripStage} tripStageColor={tripStageColor} tripBtnLabel={tripBtnLabel} earnings={earnings} onToggleOnline={handleToggleOnline} onAdvanceTrip={handleAdvanceTrip} advancePending={advancePending} />}
        {activeTab === "earnings" && !isRejected && <EarningsTab earnings={earnings} driver={driver} online={online} />}
        {activeTab === "trips"    && !isRejected && <TripsTab    completedRides={completedRides} online={online} />}
        {activeTab === "profile"  &&                <ProfileTab  driver={driver} online={online} />}
      </div>

      <BottomTabBar activeTab={activeTab} setActiveTab={isRejected ? ()=>{} : setActiveTab} online={online} activeTrip={activeTrip} isRejected={isRejected} />
    </div>
  );
}
