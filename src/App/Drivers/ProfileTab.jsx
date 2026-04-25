import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Car, Star, Shield, DollarSign, Bell, Settings, LogOut,
  ChevronRight, ArrowLeft, Globe, Map, Moon, Wifi, Zap,
  FileText, Clock, TrendingUp, CreditCard, TrendingDown,
  CheckCircle, AlertCircle, XCircle, Upload, X, Eye,
  Camera, Loader2, CheckCircle2, RefreshCw, Banknote,
  ArrowUpRight, ArrowDownLeft, Receipt, Users, MapPin,
} from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getFirestore, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebase_app } from '@/firebase/config';

const storage   = getStorage(firebase_app);
const db        = getFirestore(firebase_app);
const functions = getFunctions(firebase_app, 'us-east1');
const callProcessWithdrawal = httpsCallable(functions, 'processWithdrawal');

// ─── Helpers ───────────────────────────────────────────────────────────────
function formatDate(ts) {
  if (!ts) return "—";
  const date = ts.toDate?.() ?? new Date(ts);
  return date.toLocaleDateString([], { month: "short", year: "numeric" });
}

function formatDateTime(ts) {
  if (!ts) return "—";
  const date = ts.toDate?.() ?? new Date(ts);
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function fmtMoney(val) {
  if (val == null || val === false) return "$0.00";
  return `$${Number(val).toFixed(2)}`;
}

// ─── Shared components ─────────────────────────────────────────────────────
const SectionHeader = ({ title, onBack }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
    <button
      onClick={onBack}
      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}
    >
      <ArrowLeft size={20} color={C.text} />
    </button>
    <div className="condensed" style={{ fontSize: 26, fontWeight: 900, color: C.text, letterSpacing: "-0.5px" }}>
      {title}
    </div>
  </div>
);

const ComingSoonBadge = ({ color = C.textDim, bg = C.surfaceAlt, label = "COMING SOON" }) => (
  <div style={{ background: bg, borderRadius: 12, padding: "11px 16px", textAlign: "center" }}>
    <div className="mono" style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: ".08em" }}>
      {label}
    </div>
  </div>
);

// ─── UPLOAD SLOT ───────────────────────────────────────────────────────────
function UploadSlot({ slotKey, urlKey, label, Icon, docs, uid, onUploaded }) {
  const inputRef                      = useRef(null);
  const [uploading,   setUploading]   = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [error,       setError]       = useState("");
  const [previewUrl,  setPreviewUrl]  = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [justDone,    setJustDone]    = useState(false);

  const existingUrl = docs[urlKey] || "";
  const isUploaded  = Boolean(existingUrl || docs[slotKey]);

  const s = isUploaded
    ? { color: C.onlineGreen, bg: "#F0FDF4", border: "rgba(22,163,74,.25)", iconBg: "rgba(22,163,74,.12)", iconColor: "#16A34A" }
    : { color: C.red,         bg: "#FEF2F2", border: "rgba(220,38,38,.25)", iconBg: "rgba(220,38,38,.12)", iconColor: C.red    };

  const handleFile = useCallback(async (file) => {
    if (!file || !uid) return;
    setError("");
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) { setError("JPG, PNG, WEBP or PDF only"); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Max file size is 10 MB"); return; }
    if (file.type.startsWith("image/")) setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    setProgress(0);
    try {
      const ext        = file.name.split(".").pop();
      const path       = `drivers/${uid}/documents/${slotKey}_${Date.now()}.${ext}`;
      const storageRef = ref(storage, path);
      const task       = uploadBytesResumable(storageRef, file);
      await new Promise((resolve, reject) => {
        task.on("state_changed", snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)), reject, resolve);
      });
      const downloadURL = await getDownloadURL(task.snapshot.ref);
      await updateDoc(doc(db, "Drivers", uid), {
        [`documents.${slotKey}`]: true,
        [`documents.${urlKey}`]:  downloadURL,
      });
      onUploaded?.({ slotKey, urlKey, downloadURL });
      setPreviewUrl(downloadURL);
      setJustDone(true);
      setTimeout(() => setJustDone(false), 2500);
    } catch (err) {
      console.error(`Upload failed for ${slotKey}:`, err);
      setError("Upload failed — please try again");
      setPreviewUrl("");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [uid, slotKey, urlKey, onUploaded]);

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const displayUrl = previewUrl || existingUrl;

  return (
    <>
      {showPreview && displayUrl && (
        <div onClick={() => setShowPreview(false)} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <button onClick={() => setShowPreview(false)} style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,.15)", border: "none", borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={20} color="#fff" />
          </button>
          {displayUrl.includes("placeholder")
            ? <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>PDF preview not available</div>
            : <img src={displayUrl} alt={label} style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 16, objectFit: "contain" }} />
          }
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture={slotKey === "profilePhoto" ? "user" : undefined} style={{ display: "none" }} onChange={handleChange} />
      <div
        style={{ background: s.bg, border: `1.5px solid ${uploading ? "#2563EB40" : s.border}`, borderRadius: 16, padding: "14px 14px 13px", position: "relative", overflow: "hidden", transition: "transform .15s ease, box-shadow .15s ease, border-color .2s" }}
        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.08)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
      >
        {uploading && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "#EFF6FF" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#3B82F6,#2563EB)", transition: "width .2s ease", borderRadius: "0 3px 0 0" }} />
          </div>
        )}
        {justDone && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(22,163,74,.1)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 16, zIndex: 2 }}>
            <CheckCircle2 size={32} color="#16A34A" />
          </div>
        )}
        <div style={{ width: 36, height: 36, background: uploading ? "rgba(37,99,235,.12)" : s.iconBg, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10, transition: "background .2s" }}>
          {uploading ? <Loader2 size={17} color="#2563EB" style={{ animation: "spin 1s linear infinite" }} /> : isUploaded ? <CheckCircle2 size={17} color={s.iconColor} /> : <Upload size={17} color={s.iconColor} />}
        </div>
        <div className="condensed" style={{ fontSize: 13.5, fontWeight: 800, color: C.text, lineHeight: 1.2, marginBottom: 3 }}>{label}</div>
        <div className="mono" style={{ fontSize: 10, fontWeight: 700, color: uploading ? "#2563EB" : s.color, letterSpacing: ".05em", marginBottom: error ? 4 : 0 }}>
          {uploading ? `UPLOADING · ${progress}%` : isUploaded ? "✓ UPLOADED" : "REQUIRED"}
        </div>
        {error && <div style={{ fontSize: 10, color: C.red, fontWeight: 600, marginBottom: 4 }}>⚠ {error}</div>}
        {!uploading && (
          <div style={{ display: "flex", gap: 5, marginTop: 10 }} onClick={e => e.stopPropagation()}>
            {isUploaded && displayUrl && !displayUrl.includes("placeholder") && (
              <button onClick={() => setShowPreview(true)} style={{ flex: 1, padding: "6px 0", border: `1px solid ${s.border}`, borderRadius: 8, background: s.iconBg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, transition: "opacity .15s" }} onMouseEnter={e => e.currentTarget.style.opacity = ".75"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                <Eye size={11} color={s.iconColor} />
                <span className="mono" style={{ fontSize: 9.5, fontWeight: 700, color: s.iconColor }}>VIEW</span>
              </button>
            )}
            <button onClick={() => inputRef.current?.click()} style={{ flex: 1, padding: "7px 0", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, transition: "all .15s", ...(isUploaded ? { border: `1px solid ${C.border}`, background: C.surfaceAlt } : { border: `1.5px solid ${s.border}`, background: `linear-gradient(135deg, ${s.iconBg}, rgba(220,38,38,.2))`, boxShadow: `0 2px 8px ${s.color}22` }) }} onMouseEnter={e => e.currentTarget.style.opacity = ".8"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
              {isUploaded ? (<><Camera size={11} color={C.textMid} /><span className="mono" style={{ fontSize: 9.5, fontWeight: 700, color: C.textMid }}>REPLACE</span></>) : (<><Upload size={12} color={s.iconColor} /><span className="mono" style={{ fontSize: 10, fontWeight: 800, color: s.iconColor, letterSpacing: ".03em" }}>{slotKey === "profilePhoto" ? "TAKE PHOTO" : "UPLOAD NOW"}</span></>)}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── DOCUMENTS & INSURANCE ─────────────────────────────────────────────────
const DocumentsInsuranceSection = ({ driver, onBack }) => {
  const uid                   = driver?.uid ?? null;
  const [docs,    setDocs]    = useState(driver?.documents ?? {});
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!uid) return;
    setSyncing(true);
    const unsub = onSnapshot(
      doc(db, "Drivers", uid),
      (snap) => { if (snap.exists()) setDocs(snap.data()?.documents ?? {}); setSyncing(false); },
      (err)  => { console.error("[Docs] onSnapshot error:", err); setSyncing(false); }
    );
    return () => unsub();
  }, [uid]);

  const slots = [
    { key: "licenseFront", urlKey: "licenseFrontUrl", label: "License (Front)", Icon: FileText },
    { key: "licenseBack",  urlKey: "licenseBackUrl",  label: "License (Back)",  Icon: FileText },
    { key: "registration", urlKey: "registrationUrl", label: "Registration",    Icon: Car      },
    { key: "insurance",    urlKey: "insuranceUrl",    label: "Insurance Card",  Icon: Shield   },
    { key: "profilePhoto", urlKey: "profilePhotoUrl", label: "Profile Photo",   Icon: Star     },
  ];

  const handleUploaded = useCallback(({ slotKey, urlKey, downloadURL }) => {
    setDocs(prev => ({ ...prev, [slotKey]: true, [urlKey]: downloadURL }));
  }, []);

  const uploaded = slots.filter(s => docs[s.urlKey] || docs[s.key]).length;
  const allDone  = uploaded === slots.length;
  const pct      = Math.round((uploaded / slots.length) * 100);

  return (
    <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, animation: "slideUp .38s ease-out forwards" }}>
      <style>{`
        @keyframes spin   { from { transform: rotate(0deg)   } to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(.96) } to { opacity: 1; transform: scale(1) } }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <SectionHeader title="Documents & Insurance" onBack={onBack} />
        {syncing && <RefreshCw size={13} color={C.textDim} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />}
      </div>
      <div style={{ background: allDone ? "#F0FDF4" : "#EFF6FF", border: `1.5px solid ${allDone ? "#86EFAC" : "#93C5FD"}`, borderRadius: 18, padding: "18px 16px", display: "flex", gap: 14, alignItems: "flex-start", boxShadow: allDone ? "0 4px 20px rgba(22,163,74,.1)" : "0 4px 20px rgba(37,99,235,.08)" }}>
        <div style={{ width: 44, height: 44, flexShrink: 0, background: allDone ? "linear-gradient(135deg,#22C55E,#16A34A)" : "linear-gradient(135deg,#3B82F6,#2563EB)", borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: allDone ? "0 4px 12px rgba(22,163,74,.35)" : "0 4px 12px rgba(37,99,235,.3)" }}>
          {allDone ? <CheckCircle2 size={21} color="#fff" /> : <Shield size={20} color="#fff" />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <div className="condensed" style={{ fontSize: 16, fontWeight: 900, color: allDone ? "#14532D" : "#1E3A8A" }}>{uploaded}/{slots.length} documents submitted</div>
            <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: allDone ? "#16A34A" : "#2563EB" }}>{pct}%</div>
          </div>
          <div style={{ height: 7, background: allDone ? "#BBF7D0" : "#BFDBFE", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: allDone ? "linear-gradient(90deg,#22C55E,#16A34A)" : "linear-gradient(90deg,#60A5FA,#2563EB)", borderRadius: 99, transition: "width .5s cubic-bezier(.34,1.56,.64,1)" }} />
          </div>
          <div style={{ fontSize: 12, color: allDone ? "#16A34A" : "#3B82F6", marginTop: 6, fontWeight: 500 }}>
            {allDone ? "All documents submitted — under review ✓" : `${slots.length - uploaded} document${slots.length - uploaded !== 1 ? "s" : ""} still needed — tap a card below to upload`}
          </div>
        </div>
      </div>
      {!allDone && (
        <div style={{ background: "#FEF2F2", border: "1.5px solid rgba(220,38,38,.2)", borderRadius: 13, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center" }}>
          <AlertCircle size={16} color={C.red} style={{ flexShrink: 0 }} />
          <div>
            <div className="condensed" style={{ fontSize: 13, fontWeight: 800, color: C.red, marginBottom: 2 }}>Action required</div>
            <div style={{ fontSize: 11.5, color: "#991B1B", fontWeight: 500, lineHeight: 1.4 }}>Missing documents will delay your account approval. Upload them now to get on the road faster.</div>
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {slots.map(({ key, urlKey, label, Icon }) => (
          <UploadSlot key={key} slotKey={key} urlKey={urlKey} label={label} Icon={Icon} docs={docs} uid={uid} onUploaded={handleUploaded} />
        ))}
      </div>
      <div style={{ background: "#FFFBEB", border: "1px solid rgba(217,119,6,.2)", borderRadius: 13, padding: "13px 16px", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Clock size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 12, color: "#92400E", fontWeight: 500, lineHeight: 1.5 }}>Documents are reviewed by the UaTob team within 24–48 hours. You'll receive a notification once approved.</span>
      </div>
    </div>
  );
};

// ─── PAYMENT & PAYOUTS ─────────────────────────────────────────────────────
const PaymentPayoutsSection = ({ driver, onBack }) => {
  const [tab,         setTab]         = useState("overview");
  const [paying,      setPaying]      = useState(false);
  const [paySuccess,  setPaySuccess]  = useState(false);
  const [payError,    setPayError]    = useState("");
  const [driverData,  setDriverData]  = useState(driver ?? {});

  const uid = driver?.uid ?? null;

  // ── Live listener so withdrawal status updates in real time ──────────────
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      doc(db, "Drivers", uid),
      (snap) => { if (snap.exists()) setDriverData(snap.data()); },
      (err)  => console.error("[Payouts] onSnapshot error:", err)
    );
    return () => unsub();
  }, [uid]);

  const earnings       = driverData?.earnings   ?? {};
  const withdrawal     = driverData?.withdrawal ?? {};
  const today          = earnings.today ?? {};
  const week           = earnings.week  ?? {};
  const month          = earnings.month ?? {};

  const todayEarnings  = today.earnings        ?? 0;
  const todayTrips     = today.trips           ?? 0;
  const weekEarnings   = week.earnings         ?? 0;
  const weekTrips      = week.trips            ?? 0;
  const weekChange     = week.changePercent    ?? 0;
  const lastWeek       = week.lastWeekEarnings ?? 0;
  const monthEarnings  = month.earnings        ?? 0;
  const monthTrips     = month.trips           ?? 0;
  const dailyBreakdown = week.dailyBreakdown   ?? [];

  const totalPayout      = withdrawal.totalPayout ?? 0;
  const payoutStatus     = withdrawal.status      ?? null;
  const payoutAt         = withdrawal.paidAt;
  const rideBreakdown    = withdrawal.rideBreakdown ?? [];
  const rideCount        = withdrawal.rideCount     ?? 0;
  const lastSynced       = earnings.lastSyncedAt;

  const statusMeta = {
    paid:       { label: "Paid",       color: C.onlineGreen, bg: "#F0FDF4", border: "#86EFAC", Icon: CheckCircle  },
    pending:    { label: "Pending",    color: "#D97706",     bg: "#FFFBEB", border: "#FDE68A", Icon: Clock        },
    processing: { label: "Processing", color: "#2563EB",     bg: "#EFF6FF", border: "#93C5FD", Icon: RefreshCw    },
    failed:     { label: "Failed",     color: C.red,         bg: "#FEF2F2", border: "#FECACA", Icon: XCircle      },
  }[payoutStatus] ?? { label: "No payout", color: C.textMid, bg: C.surfaceAlt, border: C.border, Icon: AlertCircle };

  const maxBar = Math.max(...dailyBreakdown.map(d => d.amount ?? 0), 1);

  const handleRequestPayout = async () => {
    if (!uid || paying) return;
    setPaying(true);
    setPayError("");
    try {
      const { data } = await callProcessWithdrawal({ uid });
      if (data?.success) {
        setPaySuccess(true);
        setTimeout(() => setPaySuccess(false), 3000);
      }
    } catch (err) {
      setPayError(err?.message || "Payout failed — please try again");
    } finally {
      setPaying(false);
    }
  };

  const TabBtn = ({ id, label }) => (
    <button
      onClick={() => setTab(id)}
      style={{
        flex: 1, padding: "9px 0", border: "none", cursor: "pointer",
        background: tab === id ? C.text : "transparent",
        color:      tab === id ? (C.bg ?? "#fff") : C.textMid,
        borderRadius: 10, fontSize: 13, fontWeight: 700,
        fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "-0.2px",
        transition: "all .18s",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, animation: "slideUp .38s ease-out forwards" }}>
      <style>{`
        @keyframes spin       { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes payPulse   { 0%,100% { box-shadow: 0 0 0 0 rgba(22,163,74,.4) } 50% { box-shadow: 0 0 0 10px rgba(22,163,74,0) } }
        @keyframes fadeSlide  { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
      `}</style>

      <SectionHeader title="Payment & Payouts" onBack={onBack} />

      <div style={{ display: "flex", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 13, padding: 4, gap: 4 }}>
        <TabBtn id="overview" label="Overview" />
        <TabBtn id="history"  label="Payout History" />
      </div>

      {tab === "overview" && (
        <>
          {/* ── Pending payout hero ── */}
          {payoutStatus === "pending" && totalPayout > 0 && (
            <div style={{
              background: "linear-gradient(135deg,#0F172A,#1E293B)",
              borderRadius: 22, padding: "26px 22px",
              position: "relative", overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,.25)",
            }}>
              {/* Decorative circles */}
              <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(22,163,74,.08)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", bottom: -30, left: -30, width: 100, height: 100, borderRadius: "50%", background: "rgba(22,163,74,.06)", pointerEvents: "none" }} />

              <div className="mono" style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.4)", letterSpacing: ".1em", marginBottom: 8 }}>
                PENDING PAYOUT
              </div>
              <div className="condensed" style={{ fontSize: 52, fontWeight: 900, color: "#fff", lineHeight: 1, marginBottom: 4 }}>
                {fmtMoney(totalPayout)}
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)", marginBottom: 22 }}>
                From {rideCount} completed ride{rideCount !== 1 ? "s" : ""}
              </div>

              {payError && (
                <div style={{ background: "rgba(220,38,38,.15)", border: "1px solid rgba(220,38,38,.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#FCA5A5", fontWeight: 500 }}>
                  ⚠ {payError}
                </div>
              )}

              <button
                onClick={handleRequestPayout}
                disabled={paying || paySuccess}
                style={{
                  width: "100%", padding: "15px 0",
                  borderRadius: 14, border: "none",
                  background: paySuccess
                    ? "linear-gradient(135deg,#22C55E,#16A34A)"
                    : "linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)",
                  color: "#fff", fontSize: 15, fontWeight: 800,
                  fontFamily: "'Barlow', sans-serif",
                  cursor: paying ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: "0 4px 20px rgba(22,163,74,.4)",
                  animation: !paying && !paySuccess ? "payPulse 2s ease-in-out infinite" : "none",
                  transition: "all .2s",
                  opacity: paying ? .7 : 1,
                }}
              >
                {paying ? (
                  <><Loader2 size={17} style={{ animation: "spin 1s linear infinite" }} /> Processing…</>
                ) : paySuccess ? (
                  <><CheckCircle2 size={17} /> Payout Sent!</>
                ) : (
                  <><Banknote size={17} /> Request Payout · {fmtMoney(totalPayout)}</>
                )}
              </button>
            </div>
          )}

          {/* ── 80% split card ── */}
          <div style={{
            background: "linear-gradient(135deg,#F0FDF4,#DCFCE7,#F0FDF4)",
            border: "1.5px solid rgba(22,163,74,.28)",
            borderRadius: 20, padding: "20px", position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(45deg,transparent,transparent 60px,rgba(22,163,74,.03) 60px,rgba(22,163,74,.03) 61px)" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div className="mono" style={{ fontSize: 10, fontWeight: 700, color: "#15803D", letterSpacing: ".1em", marginBottom: 2 }}>YOUR CUT</div>
                <div className="condensed" style={{ fontSize: 44, fontWeight: 900, color: C.text, lineHeight: 1 }}>80%</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: C.onlineGreen, fontWeight: 600, marginBottom: 4 }}>of every fare</div>
                <div style={{ fontSize: 11, color: C.textDim }}>Platform fee: 20%</div>
              </div>
            </div>
            <div style={{ height: 8, background: "rgba(22,163,74,.15)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: "80%", height: "100%", background: "linear-gradient(90deg,#22C55E,#16A34A)", borderRadius: 99 }} />
            </div>
          </div>

          {/* ── Stat grid ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { label: "Today",      value: fmtMoney(todayEarnings), sub: `${todayTrips} trip${todayTrips !== 1 ? "s" : ""}`, color: C.onlineGreen },
              { label: "This Week",  value: fmtMoney(weekEarnings),  sub: `${weekTrips} trips`,  color: "#2563EB" },
              { label: "This Month", value: fmtMoney(monthEarnings), sub: `${monthTrips} trips`,  color: "#7C3AED" },
            ].map(({ label, value, sub, color }) => (
              <div key={label} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 12px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color, opacity: .3, borderRadius: "14px 14px 0 0" }} />
                <div className="lbl" style={{ marginBottom: 5 }}>{label}</div>
                <div className="condensed" style={{ fontSize: 21, fontWeight: 900, color: C.text, lineHeight: 1.1 }}>{value}</div>
                <div className="mono" style={{ fontSize: 10, color: C.textDim, marginTop: 3 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* ── Weekly bar chart ── */}
          {dailyBreakdown.length > 0 && (
            <div className="card" style={{ padding: "18px 18px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                <div className="condensed" style={{ fontSize: 15, fontWeight: 800, color: C.text }}>This Week</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {weekChange >= 0 ? <TrendingUp size={13} color={C.onlineGreen} /> : <TrendingDown size={13} color={C.red} />}
                  <span className="mono" style={{ fontSize: 11.5, fontWeight: 700, color: weekChange >= 0 ? C.onlineGreen : C.red }}>
                    {weekChange >= 0 ? "+" : ""}{weekChange}% vs last week
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 72 }}>
                {dailyBreakdown.map(({ day, amount, isToday }) => {
                  const pct = ((amount ?? 0) / maxBar) * 100;
                  return (
                    <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                      <div style={{ width: "100%", position: "relative", height: 56, display: "flex", alignItems: "flex-end" }}>
                        <div style={{ width: "100%", height: `${Math.max(pct, amount == null ? 0 : 4)}%`, minHeight: (amount ?? 0) > 0 ? 4 : 0, background: isToday ? C.onlineGreen : amount == null ? C.border : C.onlineGreen + "40", borderRadius: "5px 5px 3px 3px", transition: "height .4s ease" }} />
                        {isToday && (
                          <div style={{ position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)", background: C.onlineGreen, color: "#fff", fontSize: 9, fontWeight: 700, fontFamily: "monospace", padding: "2px 5px", borderRadius: 5, whiteSpace: "nowrap" }}>
                            {fmtMoney(amount)}
                          </div>
                        )}
                      </div>
                      <div className="mono" style={{ fontSize: 9.5, color: isToday ? C.onlineGreen : C.textDim, fontWeight: isToday ? 700 : 400 }}>{day}</div>
                    </div>
                  );
                })}
              </div>
              {lastWeek > 0 && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: C.textDim }}>Last week</span>
                  <span className="mono" style={{ fontSize: 12, color: C.textMid, fontWeight: 700 }}>{fmtMoney(lastWeek)}</span>
                </div>
              )}
            </div>
          )}

          {lastSynced && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
              <Clock size={11} color={C.textDim} />
              <span className="mono" style={{ fontSize: 10.5, color: C.textDim }}>Synced {formatDateTime(lastSynced)}</span>
            </div>
          )}
        </>
      )}

      {tab === "history" && (
        <>
          {/* ── Current withdrawal status hero ── */}
          <div style={{
            background: statusMeta.bg,
            border: `1.5px solid ${statusMeta.border}`,
            borderRadius: 20, padding: "22px 20px",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div className="mono" style={{ fontSize: 10, fontWeight: 700, color: statusMeta.color, letterSpacing: ".08em", marginBottom: 6 }}>
                  CURRENT PAYOUT
                </div>
                <div className="condensed" style={{ fontSize: 42, fontWeight: 900, color: C.text, lineHeight: 1 }}>
                  {fmtMoney(totalPayout)}
                </div>
                {payoutAt && (
                  <div style={{ fontSize: 12, color: C.textMid, marginTop: 4 }}>
                    {payoutStatus === "paid" ? "Paid" : "Created"} {formatDateTime(payoutAt || withdrawal.createdAt)}
                  </div>
                )}
              </div>
              <div style={{
                background: statusMeta.color + "18",
                border: `1.5px solid ${statusMeta.color}30`,
                borderRadius: 12, padding: "8px 14px",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <statusMeta.Icon size={14} color={statusMeta.color} style={payoutStatus === "processing" ? { animation: "spin 1.5s linear infinite" } : {}} />
                <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: statusMeta.color }}>
                  {statusMeta.label.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Meta row */}
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { Icon: Receipt, label: `${rideCount} ride${rideCount !== 1 ? "s" : ""}` },
                { Icon: Clock,   label: formatDateTime(withdrawal.createdAt) },
              ].map(({ Icon: Ic, label }) => (
                <div key={label} style={{ flex: 1, background: "rgba(255,255,255,.6)", borderRadius: 10, padding: "9px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                  <Ic size={12} color={C.textMid} />
                  <span style={{ fontSize: 11.5, color: C.textMid, fontWeight: 600 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Ride breakdown ── */}
          {rideBreakdown.length > 0 && (
            <div>
              <div className="lbl" style={{ marginBottom: 8, paddingLeft: 2 }}>Rides in this payout</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rideBreakdown.map((ride, i) => (
                  <div
                    key={ride.rideId ?? i}
                    style={{
                      background: C.surfaceAlt,
                      border: `1px solid ${C.border}`,
                      borderRadius: 14, padding: "14px 16px",
                      display: "flex", gap: 12, alignItems: "flex-start",
                      animation: `fadeSlide .3s ease ${i * 0.05}s both`,
                    }}
                  >
                    {/* Avatar */}
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: C.onlineGreen + "15", border: `1px solid ${C.onlineGreen}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Users size={16} color={C.onlineGreen} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Rider name + payout */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                        <div className="condensed" style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{ride.riderName ?? "Rider"}</div>
                        <div className="condensed" style={{ fontSize: 16, fontWeight: 900, color: C.onlineGreen }}>{fmtMoney(ride.driverPayout)}</div>
                      </div>

                      {/* Route */}
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                        <MapPin size={10} color={C.textDim} />
                        <span style={{ fontSize: 11, color: C.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ride.pickup?.split(",")[0] ?? "—"} → {ride.dropoff?.split(",")[0] ?? "—"}
                        </span>
                      </div>

                      {/* Meta */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="mono" style={{ fontSize: 9.5, color: C.textDim }}>{formatDateTime(ride.completedAt)}</span>
                        <span style={{ width: 3, height: 3, borderRadius: "50%", background: C.border }} />
                        <span className="mono" style={{ fontSize: 9.5, color: C.textDim, textTransform: "capitalize" }}>{ride.rideType ?? "standard"}</span>
                        <span style={{ width: 3, height: 3, borderRadius: "50%", background: C.border }} />
                        <span className="mono" style={{ fontSize: 9.5, color: C.textDim }}>Fare {fmtMoney(ride.fareTotal)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── No breakdown fallback ── */}
          {rideBreakdown.length === 0 && (
            <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px", textAlign: "center" }}>
              <Receipt size={22} color={C.textDim} style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 13, color: C.textDim, fontWeight: 500 }}>No ride breakdown available yet</div>
            </div>
          )}

          {/* ── Bank account placeholder ── */}
          <div style={{ background: C.surfaceAlt, border: `1.5px dashed ${C.border}`, borderRadius: 15, padding: "18px 16px", display: "flex", alignItems: "center", gap: 14, opacity: 0.65 }}>
            <div style={{ width: 38, height: 38, background: C.blue + "18", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <CreditCard size={17} color={C.blue} />
            </div>
            <div>
              <div className="condensed" style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Bank Account</div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>Direct deposit setup coming soon</div>
            </div>
          </div>

          {/* ── Deposit note ── */}
          <div style={{ background: "#F0FDF4", border: "1px solid rgba(22,163,74,.2)", borderRadius: 13, padding: "13px 16px", display: "flex", gap: 10, alignItems: "center" }}>
            <Zap size={16} color={C.onlineGreen} />
            <span style={{ fontSize: 12.5, color: "#15803D", fontWeight: 600 }}>Earnings deposit within 24 hrs of completing rides</span>
          </div>
        </>
      )}
    </div>
  );
};

// ─── NOTIFICATIONS ─────────────────────────────────────────────────────────
const NotificationsSection = ({ driver, onBack }) => {
  const groups = [
    { heading: "Ride Alerts", items: [{ label: "Ride requests", sub: "Alert when a rider is nearby", on: true }, { label: "Ride cancellations", sub: "Know when a ride is cancelled", on: true }] },
    { heading: "Earnings", items: [{ label: "Payout confirmed", sub: "When a deposit lands in your bank", on: true }, { label: "Weekly summary", sub: "Your earnings recap every Monday", on: true }, { label: "Surge zones", sub: "High-demand alerts in your area", on: false }] },
    { heading: "General", items: [{ label: "Promotions", sub: "Bonuses and limited-time offers", on: false }, { label: "App updates", sub: "New features and announcements", on: false }] },
  ];
  return (
    <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, animation: "slideUp .38s ease-out forwards" }}>
      <SectionHeader title="Notifications" onBack={onBack} />
      {groups.map(({ heading, items }) => (
        <div key={heading}>
          <div className="lbl" style={{ marginBottom: 8, paddingLeft: 4 }}>{heading}</div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {items.map(({ label, sub, on }, i) => (
              <div key={label} style={{ padding: "14px 18px", borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : "none", display: "flex", alignItems: "center", gap: 12, opacity: 0.62 }}>
                <div style={{ flex: 1 }}>
                  <div className="condensed" style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{label}</div>
                  <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2 }}>{sub}</div>
                </div>
                <div style={{ width: 44, height: 25, borderRadius: 13, background: on ? C.onlineGreen : C.border, position: "relative", flexShrink: 0 }}>
                  <div style={{ width: 19, height: 19, background: "#fff", borderRadius: "50%", position: "absolute", top: 3, ...(on ? { right: 3 } : { left: 3 }), boxShadow: "0 1px 4px rgba(0,0,0,.22)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <ComingSoonBadge label="NOTIFICATION CONTROLS COMING SOON" />
    </div>
  );
};

// ─── APP SETTINGS ──────────────────────────────────────────────────────────
const AppSettingsSection = ({ driver, onBack }) => {
  const groups = [
    { heading: "Preferences", items: [{ label: "Language", value: "English (US)", Icon: Globe, color: "#7C3AED" }, { label: "Navigation App", value: "Google Maps", Icon: Map, color: "#2563EB" }, { label: "Dark Mode", value: "System", Icon: Moon, color: C.text }] },
    { heading: "Device", items: [{ label: "Sound & Haptics", value: "On", Icon: Bell, color: "#D97706" }, { label: "Data Saver", value: "Off", Icon: Wifi, color: C.onlineGreen }] },
    { heading: "Account", items: [{ label: "App Version", value: "1.1.0", Icon: Zap, color: C.textMid }, { label: "Privacy Policy", value: "", Icon: Shield, color: C.blue }] },
  ];
  return (
    <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, animation: "slideUp .38s ease-out forwards" }}>
      <SectionHeader title="App Settings" onBack={onBack} />
      {groups.map(({ heading, items }) => (
        <div key={heading}>
          <div className="lbl" style={{ marginBottom: 8, paddingLeft: 4 }}>{heading}</div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {items.map(({ label, value, Icon, color }, i) => (
              <div key={label} style={{ padding: "13px 18px", borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : "none", display: "flex", alignItems: "center", gap: 12, opacity: 0.62 }}>
                <div style={{ width: 34, height: 34, background: color + "15", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={15} color={color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="condensed" style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{label}</div>
                </div>
                {value && <span className="mono" style={{ fontSize: 12, color: C.textDim }}>{value}</span>}
                <ChevronRight size={13} color={C.border} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <ComingSoonBadge label="SETTINGS PANEL COMING SOON" color="#7C3AED" bg="#F5F3FF" />
    </div>
  );
};

// ─── PROFILE TAB ───────────────────────────────────────────────────────────
export default function ProfileTab({ driver, online, onSignOut }) {
  const [activeSection, setActiveSection] = useState(null);
  const accentColor = online ? C.onlineGreen : C.offlineInk;

  const firstName   = driver?.firstName ?? "";
  const lastName    = driver?.lastName  ?? "";
  const fullName    = `${firstName} ${lastName}`.trim() || "Driver";
  const totalTrips  = driver?.earnings?.month?.trips ?? 0;
  const memberSince = formatDate(driver?.createdAt);
  const vehicle     = driver?.vehicle ?? {};
  const makeModel   = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ") || "—";
  const plate       = vehicle.plate ?? "—";
  const color       = vehicle.color ?? "—";
  const rideTypes   = Array.isArray(vehicle.rideTypes) && vehicle.rideTypes.length > 0
    ? vehicle.rideTypes.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(", ")
    : "—";

  const settingsItems = [
    { id: "documents",     Icon: Shield,     label: "Documents & Insurance", accent: C.blue      },
    { id: "payments",      Icon: DollarSign, label: "Payment & Payouts",     accent: accentColor },
    { id: "notifications", Icon: Bell,       label: "Notifications",         accent: C.textMid   },
    { id: "settings",      Icon: Settings,   label: "App Settings",          accent: C.purple    },
    { id: "signout",       Icon: LogOut,     label: "Sign Out",              accent: C.red       },
  ];

  if (activeSection === "documents")
    return <DocumentsInsuranceSection driver={driver} onBack={() => setActiveSection(null)} />;
  if (activeSection === "payments")
    return <PaymentPayoutsSection driver={driver} onBack={() => setActiveSection(null)} />;
  if (activeSection === "notifications")
    return <NotificationsSection driver={driver} onBack={() => setActiveSection(null)} />;
  if (activeSection === "settings")
    return <AppSettingsSection driver={driver} onBack={() => setActiveSection(null)} />;

  return (
    <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, animation: "slideUp .38s ease-out forwards" }}>

      {/* Driver hero */}
      <div style={{
        background: online ? "linear-gradient(135deg,#F0FDF4,#DCFCE7,#F0FDF4)" : "linear-gradient(135deg,#F9FAFB,#F3F4F6,#F9FAFB)",
        border: online ? "1.5px solid rgba(22,163,74,.28)" : `1px solid ${C.border}`,
        borderRadius: 22, padding: "28px 24px", textAlign: "center",
        position: "relative", overflow: "hidden",
        boxShadow: online ? "0 4px 24px rgba(22,163,74,.1)" : `0 2px 12px ${C.shadow}`,
      }}>
        <div style={{ position: "absolute", inset: 0, background: `repeating-linear-gradient(45deg,transparent,transparent 60px,${online ? "rgba(22,163,74,.03)" : "rgba(0,0,0,.015)"} 60px,${online ? "rgba(22,163,74,.03)" : "rgba(0,0,0,.015)"} 61px)` }} />
        <div style={{ width: 72, height: 72, background: online ? "linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)" : "linear-gradient(135deg,#374151,#111827 55%,#0A0A0A)", border: "3px solid rgba(255,255,255,.8)", borderRadius: "50%", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: online ? "0 0 0 6px rgba(22,163,74,.15), 0 8px 24px rgba(22,163,74,.3)" : "0 0 0 6px rgba(0,0,0,.07), 0 8px 24px rgba(0,0,0,.18)", position: "relative" }}>
          <span style={{ fontSize: 26, fontWeight: 900, color: "#fff", fontFamily: "'Barlow Condensed', sans-serif" }}>
            {firstName.charAt(0).toUpperCase()}{lastName.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="condensed" style={{ fontSize: 26, fontWeight: 900, color: C.text, letterSpacing: "-0.5px" }}>{fullName}</div>
        <div style={{ fontSize: 13, color: online ? accentColor : C.textMid, marginTop: 4, fontWeight: 600 }}>
          Driver since {memberSince} · {totalTrips} trip{totalTrips !== 1 ? "s" : ""}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 12 }}>
          {[...Array(5)].map((_, i) => <Star key={i} size={15} fill="#F59E0B" color="#F59E0B" />)}
          <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: C.text, marginLeft: 5 }}>
            {driver?.averageRating != null ? driver.averageRating.toFixed(2) : "—"}
          </span>
        </div>
      </div>

      {/* Vehicle */}
      <div className="card" style={{ padding: "20px" }}>
        <div className="condensed" style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 14, letterSpacing: "-0.3px" }}>Vehicle</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[{ label: "Make & Model", value: makeModel }, { label: "Plate", value: plate }, { label: "Color", value: color }, { label: "Ride Types", value: rideTypes }].map(v => (
            <div key={v.label} style={{ flex: "1 1 calc(50% - 5px)", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 13, padding: "13px 15px" }}>
              <div className="lbl">{v.label}</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, textTransform: "capitalize" }}>{v.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Settings list */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {settingsItems.map(({ id, Icon, label, accent }, i, arr) => (
          <div
            key={label}
            onClick={() => id === "signout" ? onSignOut?.() : setActiveSection(id)}
            style={{ padding: "15px 20px", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", transition: "background .15s" }}
            onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ width: 36, height: 36, background: accent + "12", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={16} color={accent} />
            </div>
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: label === "Sign Out" ? C.red : C.text }}>{label}</span>
            {id !== "signout" && <ChevronRight size={14} color={C.textDim} />}
          </div>
        ))}
      </div>
    </div>
  );
}