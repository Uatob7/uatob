import { useState, useEffect, useRef, useCallback } from "react";
import { Star, LocateFixed, Loader2, X, AlertCircle, CheckCircle2, Info, Bell } from "lucide-react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";

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
import SupportOverlay, { SupportIcon } from '@/App/Drivers/SupportOverlay.jsx';
import { useDriverAccount }   from "@/App/Drivers/useDriverAccount";
import { useDriverRides }     from '@/App/Drivers/useDriverRides';
import { useSearch }  from "@/App/Drivers/useSearch";
import { useActiveRides }     from "@/App/Drivers/useActiveRides";
import { useDriverEarnings }  from "@/App/Drivers/useDriverEarnings";
import { useCompletedRides }  from "@/App/Drivers/useCompletedRides";
import { useIncomingRequest } from "@/App/Drivers/useIncomingRequest";
import { useDriverReviews }   from "@/App/Drivers/useDriverReviews";
import { useSupportUnread }   from "@/App/Drivers/useSupportUnread";
import { firebase_app }       from "@/firebase/config";

// ── Callables ─────────────────────────────────────────────────────────
const functions          = getFunctions(firebase_app, "us-east1");
const callDriverStatus   = httpsCallable(functions, "DriverStatus");
const callAcceptRide     = httpsCallable(functions, "acceptRide");
const callDeclineRide    = httpsCallable(functions, "declineRide");
const callUpdateTrip     = httpsCallable(functions, "updateTripStatus");
const callSaveFcmToken   = httpsCallable(functions, "saveDriverFcmToken");

// ── Firestore ─────────────────────────────────────────────────────────
const db = getFirestore(firebase_app);

// ── Trip button labels ────────────────────────────────────────────────
const TRIP_BUTTON_LABELS = {
  driver_assigned: "Arrived at Pickup",
  arrived:         "Start Trip",
  in_progress:     "Complete Trip",
};

// Maximum size for dismissed-requests memory (LRU-ish cap)
const MAX_DISMISSED = 100;

// ── localStorage helpers ──────────────────────────────────────────────
const LS_SEEN_REVIEWS_KEY = 'uatob_driver_seen_reviews';
function loadSeenReviews()    { try { return new Set(JSON.parse(localStorage.getItem(LS_SEEN_REVIEWS_KEY) || '[]')); } catch { return new Set(); } }
function saveSeenReviews(set) { try { localStorage.setItem(LS_SEEN_REVIEWS_KEY, JSON.stringify([...set])); } catch (_) {} }

// ── FCM Push Registration ─────────────────────────────────────────────
// Saves the driver's FCM token to Firestore. Returns boolean for the
// caller to inspect. Logs every outcome so DevTools makes failures obvious.
//
// IMPORTANT: this function does NOT prompt for permission. It only proceeds
// if permission is already "granted". The popup flow in handleEnableNotifications
// is responsible for the OS-level prompt.
async function registerFcmToken(uid) {
  try {
    if (!("Notification" in window)) {
      console.warn("[UaTob] Push not supported in this browser");
      return false;
    }
    if (window.Notification.permission !== "granted") {
      return false;
    }

    const messaging = getMessaging(firebase_app);
    const token = await getToken(messaging, {
      vapidKey: "BJ_sRHZonSGCKk2mB2i9ofTRS8ouFVMV-I15FX4sqdUXHyVb1lo6H-N4GMPrlcIIshRlykQicaxkxxFxcYcI4JQ",
    });

    if (!token) {
      console.warn("[UaTob] FCM returned empty token");
      return false;
    }

    const { data } = await callSaveFcmToken({ driverId: uid, token });
    console.log("[UaTob] FCM token saved:", { updated: data?.updated });
    return true;
  } catch (err) {
    console.error("[UaTob] Push registration failed:", err?.message || err);
    return false;
  }
}

// ── Audio helpers (with shared singleton context) ─────────────────────
let _audioCtx = null;
function getAudioCtx() {
  try {
    if (_audioCtx && _audioCtx.state !== "closed") return _audioCtx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    _audioCtx = new AudioCtx();
    return _audioCtx;
  } catch { return null; }
}

function playRequestChime() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(()=>{});
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
  } catch(e) {}
}

function playAcceptSound() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(()=>{});
    const master = ctx.createGain();
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
  } catch(e) {}
}

function playDeclineSound() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(()=>{});
    const master = ctx.createGain();
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
  } catch(e) {}
}

// ── APP NOTIFICATION ──────────────────────────────────────────────────
const NOTIF_STYLES = `
  @keyframes notifSlideDown { from{opacity:0;transform:translateY(-20px) scale(.96)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes notifSlideUp   { from{opacity:1;transform:translateY(0) scale(1)} to{opacity:0;transform:translateY(-16px) scale(.97)} }
  @keyframes notifProgress  { from{width:100%} to{width:0%} }
  @keyframes badgePop       { 0%{transform:scale(0)} 60%{transform:scale(1.18)} 100%{transform:scale(1)} }
`;

function getNotifTheme(title) {
  const t = (title || "").toLowerCase();
  if (t.includes("accept")||t.includes("online")||t.includes("complete")||t.includes("trip")||t.includes("enabled"))
    return { color:"#16A34A",bg:"rgba(22,163,74,.10)",border:"rgba(22,163,74,.30)",ring:"rgba(22,163,74,.06)",Icon:CheckCircle2 };
  if (t.includes("offline")||t.includes("declin")||t.includes("error")||t.includes("fail")||t.includes("expired")||t.includes("couldn't")||t.includes("skipped"))
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
            {loading ? <Loader2 size={28} color="#2563EB" style={{ animation:"locSpin 1s linear infinite" }}/> : <Bell size={28} color="#2563EB"/>}
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
              <Bell size={16} color="#fff"/> Enable notifications
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

  // null = loading, true = exists, false = not found (redirecting)
  const [driverExists, setDriverExists] = useState(null);

  useEffect(() => {
    if (!uid) {
      window.location.replace("https://uatob.com");
      return;
    }

    let unsub = null;
    try {
      const ref = doc(db, "Drivers", uid);
      unsub = onSnapshot(
        ref,
        (snap) => {
          if (!snap.exists()) {
            setDriverExists(false);
            window.location.replace("https://uatob.com");
          } else {
            setDriverExists(true);
          }
        },
        (err) => {
          console.error("[UaTob] Driver doc subscribe failed:", err);
          setDriverExists(false);
          window.location.replace("https://uatob.com");
        }
      );
    } catch (err) {
      console.error("[UaTob] Failed to subscribe to driver doc:", err);
      setDriverExists(false);
      window.location.replace("https://uatob.com");
    }

    return () => {
      try {
        if (typeof unsub === "function") unsub();
      } catch (err) {
        console.warn("[UaTob] unsub cleanup threw:", err);
      }
    };
  }, [uid]);

  if (driverExists !== true) return null;

  return <DriverAppInner uid={uid} />;
}

// ── Inner component — all hooks live here ─────────────────────────────
function DriverAppInner({ uid }) {
  const { driver }                        = useDriverAccount(uid);
  const { earnings, refetch }             = useDriverEarnings(uid);
  const { rides, loading: ridesLoading }  = useDriverRides(uid);
  const { requests, loading: reqLoading } = useIncomingRequest(uid);
  const { activeRides }                   = useActiveRides(uid);
  const { completedRides }                = useCompletedRides(uid);
  const { reviews }                       = useDriverReviews(uid);
  const supportUnread                     = useSupportUnread(uid);
  const { searches } = useSearch();


  const isRejected    = driver?.status === "rejected";
  const driverOnTrip  = driver?.trip === true;
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
  const [showSupport,       setShowSupport]       = useState(false);

  const timerRef          = useRef(null);
  const prevRequestId     = useRef(null);
  const locationPingRef   = useRef(null);
  const onlineInitialized = useRef(false);
  const notifTimerRef     = useRef(null);

  useEffect(() => { if (isRejected) setActiveTab("profile"); }, [isRejected]);

  // Initialize online state ONCE from server. After that, server status is informational only —
  // the user's local toggle controls UI state.
  useEffect(() => {
    if (!driver || onlineInitialized.current) return;
    onlineInitialized.current = true;
    setOnline(driver.status === "online");
  }, [driver]);

  // Sync DOWN: if server force-offlines the driver (admin action), reflect locally
  useEffect(() => {
    if (!onlineInitialized.current || !driver) return;
    if (online && driver.status !== "online" && driver.status !== "in_progress") {
      setOnline(false);
      setActiveTrip(null);
      setDismissedRequests(new Set());
      setAcceptedRequestId(null);
    }
  }, [driver?.status, online]);

  // ── FCM foreground message handler ────────────────────────────────
  // Reads payload.data.* first because pushCandidateDrivers sends data-only
  // payloads (so the service worker's onBackgroundMessage fires). Falls back
  // to payload.notification.* for any legacy/transitional messages.
  useEffect(() => {
    if (!uid) return;
    let unsub = () => {};
    try {
      const messaging = getMessaging(firebase_app);
      unsub = onMessage(messaging, async (payload) => {
        const title  = payload.data?.title  ?? payload.notification?.title ?? "New Ride";
        const body   = payload.data?.body   ?? payload.notification?.body  ?? "";
        const rideId = payload.data?.rideId;

        showNotif(title, body);

        if ("serviceWorker" in navigator) {
          try {
            const reg = await navigator.serviceWorker.ready;
            reg.showNotification(title, {
              body,
              icon: "/icon.png",
              tag: rideId ?? "uatob-driver",
              renotify: true,
              data: payload.data || {},
            });
          } catch (e) {
            console.warn("[UaTob] SW showNotification failed:", e?.message);
          }
        }
      });
    } catch (e) {
      console.warn("[UaTob] onMessage setup failed:", e?.message);
    }
    return () => {
      try { if (typeof unsub === "function") unsub(); } catch (e) {}
    };
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
  }, [reviews, activeTrip, tripRequest, pendingReview, seenReviewIds]);

  const handleDismissReview = useCallback(() => {
    if (!pendingReview) return;
    setSeenReviewIds(prev => {
      const updated = new Set(prev);
      updated.add(pendingReview.id);
      saveSeenReviews(updated);
      return updated;
    });
    setPendingReview(null);
  }, [pendingReview]);

  useEffect(() => { setTripBtnLabel(TRIP_BUTTON_LABELS[activeTrip?.status] ?? ""); }, [activeTrip?.status]);

  useEffect(() => {
    if (!tripRequest) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setRequestTimer(60);
      return;
    }
    // Use timeout from request (in minutes) or default to 1 minute (60 seconds)
    const timeoutSeconds = (tripRequest.timeoutMinutes ?? 1) * 60;
    setRequestTimer(timeoutSeconds);
    timerRef.current = setInterval(async () => {
      setRequestTimer(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          // Record the auto-decline when request times out
          if (tripRequest?.id) {
            callDeclineRide({ rideId: tripRequest.id, uid }).catch(() => {});
          }
          setDismissedRequests(prev => {
            const next = new Set(prev);
            if (tripRequest?.id) next.add(tripRequest.id);
            // Cap memory: if too many, drop oldest by recreating from last N entries
            if (next.size > MAX_DISMISSED) {
              const arr = Array.from(next);
              return new Set(arr.slice(arr.length - MAX_DISMISSED));
            }
            return next;
          });
          showNotif("Request expired","Looking for next...");
          return 60;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [tripRequest?.id]);

  useEffect(() => {
    clearInterval(locationPingRef.current);
    locationPingRef.current = null;
    if (!online || isRejected) return;
    locationPingRef.current = setInterval(async () => {
      try {
        const position = await new Promise((res,rej) => navigator.geolocation.getCurrentPosition(res,rej,{ enableHighAccuracy:true,timeout:8000,maximumAge:30000 }));
        const { latitude:lat, longitude:lng } = position.coords;
        await callDriverStatus({ uid, status:"location_ping", lat, lng });
      } catch(e) {}
    }, 60_000);
    return () => {
      clearInterval(locationPingRef.current);
      locationPingRef.current = null;
    };
  }, [online, uid, isRejected]);

  // Cleanup notification timer on unmount
  useEffect(() => {
    return () => {
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    };
  }, []);

  const showNotif = useCallback((title, msg) => {
    setNotification({ title, msg });
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    notifTimerRef.current = setTimeout(() => setNotification(null), 3200);
  }, []);

  const callDriverStatusFn = useCallback(async (status, lat=null, lng=null) => {
    const payload = { uid, status };
    if (lat!==null && lng!==null) { payload.lat=lat; payload.lng=lng; }
    const { data } = await callDriverStatus(payload);
    if (data?.error) throw new Error(data.error);
    return data;
  }, [uid]);

  // ── Request location + go online + refresh FCM token ──────────────
  // After a successful go-online, ALWAYS attempt to refresh the FCM token:
  //   - permission "default" → show popup (user hasn't decided yet)
  //   - permission "granted" → save token (refresh in case it rotated)
  //   - permission "denied"  → registerFcmToken returns false silently
  // The server-side function is idempotent (skips the write if the token
  // hasn't changed), so calling this on every go-online is cheap.
  const requestLocationAndGoOnline = useCallback(async () => {
    setLocationError("");
    setLocationLoading(true);
    try {
      if (!("geolocation" in navigator)) {
        throw new Error("Geolocation is not supported in this browser.");
      }
      const position = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: true, timeout: 10000, maximumAge: 0,
        })
      );
      const { latitude: lat, longitude: lng } = position.coords;

      await callDriverStatusFn("online", lat, lng);
      setOnline(true);
      setShowLocationPopup(false);
      setLocationError("");
      showNotif("Online", "Ready for rides");

      // Refresh FCM token on every go-online
      if ("Notification" in window) {
        if (window.Notification.permission === "default") {
          setShowNotifPopup(true);
        } else if (window.Notification.permission === "granted") {
          registerFcmToken(uid);
        }
        // permission === "denied" → do nothing
      }
    } catch (err) {
      if      (err?.code === 1) setLocationError("Location access was denied. Allow location in your browser settings.");
      else if (err?.code === 2) setLocationError("Could not detect your location. Check your device settings.");
      else if (err?.code === 3) setLocationError("Location request timed out. Please try again.");
      else                      setLocationError(err?.message || "Could not get your location.");
    } finally {
      setLocationLoading(false);
    }
  }, [callDriverStatusFn, uid, showNotif]);

  // ── Enable notifications from the popup ───────────────────────────
  // Explicitly prompts for permission, then registers the token,
  // then surfaces a clear toast about what happened.
  const handleEnableNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      if (window.Notification.permission === "default") {
        const permission = await window.Notification.requestPermission();
        if (permission !== "granted") {
          showNotif("Notifications skipped", "You can enable them later in profile");
          setShowNotifPopup(false);
          return;
        }
      }

      const ok = await registerFcmToken(uid);
      if (ok) {
        showNotif("Notifications enabled", "You'll get alerts for new rides");
      } else {
        showNotif("Couldn't enable", "Try again from your profile");
      }
    } catch (err) {
      console.error("[UaTob] Enable notifications failed:", err?.message);
      showNotif("Couldn't enable", "Try again from your profile");
    } finally {
      setNotifLoading(false);
      setShowNotifPopup(false);
    }
  }, [uid, showNotif]);

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
  }, [online, callDriverStatusFn, isRejected, showNotif]);

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
      if (action === "complete") {
        await refetch();
        // Show driver's actual cut (75/25 split), not the gross fare
        const driverCut = activeTrip.driverPayout
                       ?? (activeTrip.fareTotal != null ? activeTrip.fareTotal * 0.75 : 0);
        showNotif("Trip complete", `+$${driverCut.toFixed(2)}`);
      }
      else showNotif("Updating trip…","Please wait");
    } catch(e) { showNotif("Error","Update failed"); }
    finally { setAdvancePending(false); }
  };

  const tripStage      = activeTrip?.status;
  const tripStageColor = { driver_assigned:C.blue, arrived:C.onlineGreen, in_progress:C.green }[tripStage] || C.green;

  // ── Support button with unread badge ────────────────────────────
  const SupportBtn = () => {
    const showBadge = supportUnread > 0;
    const badgeText = supportUnread > 99 ? "99+" : String(supportUnread);

    return (
      <button
        onClick={() => setShowSupport(true)}
        style={{
          position: "relative",
          width: 36, height: 36, borderRadius: 10,
          background: C.surface,
          border: `1.5px solid ${showBadge ? "#FECACA" : C.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
          transition: "background .15s, border-color .15s, transform .12s",
          flexShrink: 0,
          overflow: "visible",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = showBadge ? "#FCA5A5" : "#93C5FD";
          e.currentTarget.style.background  = "#EFF6FF";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = showBadge ? "#FECACA" : C.border;
          e.currentTarget.style.background  = C.surface;
        }}
        onMouseDown={e  => { e.currentTarget.style.transform = "scale(.92)"; }}
        onMouseUp={e    => { e.currentTarget.style.transform = "scale(1)"; }}
        aria-label={
          showBadge
            ? `Open support — ${supportUnread} unread message${supportUnread === 1 ? "" : "s"}`
            : "Open support"
        }
      >
        <SupportIcon size={18} color="#2563EB" />

        {showBadge && (
          <span
            style={{
              position: "absolute",
              top: -5, right: -5,
              minWidth: badgeText.length > 1 ? 20 : 18,
              height: 18,
              padding: badgeText.length > 1 ? "0 5px" : 0,
              borderRadius: 9,
              background: "linear-gradient(135deg,#EF4444,#DC2626)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              lineHeight: 1,
              fontFamily: '"Barlow",system-ui,sans-serif',
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #fff",
              boxShadow: "0 2px 6px rgba(220,38,38,.45)",
              letterSpacing: ".02em",
              pointerEvents: "none",
              animation: "badgePop .3s cubic-bezier(.34,1.56,.64,1)",
            }}
          >
            {badgeText}
          </span>
        )}
      </button>
    );
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:'"Barlow",system-ui,sans-serif', color:C.text, position:"relative" }}>
      <style>{CSS}</style>
      <style>{NOTIF_STYLES}</style>

      {showSupport && <SupportOverlay onClose={() => setShowSupport(false)} driver={driver} />}

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
        <div style={{ padding:"20px 20px 0", display:"flex", justifyContent:"space-between", alignItems:"center", animation:mounted?"slideUp .5s ease-out forwards":"none", opacity:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <UaTobIcon size={40} online={online} />
            <div>
              <div className="condensed lbl">Driver Console</div>
              <div style={{ fontSize:20, fontWeight:800 }}>{driver?.firstName ?? ""}</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, background:C.surface, borderRadius:100, padding:"6px 12px", border:`1px solid ${C.border}` }}>
              <Star size={11} fill="#F59E0B" color="#F59E0B" />
              <span style={{ fontSize:13, fontWeight:700, color:C.text }}>
                {driver?.averageRating != null ? driver.averageRating.toFixed(2) : "—"}
              </span>
            </div>
            <SupportBtn />
          </div>
        </div>

        {isRejected && <RejectedBanner />}

        {activeTab === "home"     && !isRejected && <HomeTab driver={driver} online={online} rides={rides} activeTrip={activeTrip} tripStage={tripStage} tripStageColor={tripStageColor} tripBtnLabel={tripBtnLabel} earnings={earnings} onToggleOnline={handleToggleOnline} onAdvanceTrip={handleAdvanceTrip} advancePending={advancePending} searches={searches} />}
        {activeTab === "earnings" && !isRejected && <EarningsTab earnings={earnings} driver={driver} online={online} />}
        {activeTab === "trips"    && !isRejected && <TripsTab    completedRides={completedRides} online={online} />}
        {activeTab === "profile"  &&                <ProfileTab  driver={driver} online={online} />}
      </div>

      <BottomTabBar activeTab={activeTab} setActiveTab={isRejected ? ()=>{} : setActiveTab} online={online} activeTrip={activeTrip} isRejected={isRejected} />
    </div>
  );
}