import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Car, Star, Shield, DollarSign, Bell, Settings, LogOut,
  ChevronRight, ArrowLeft, Globe, Map, Moon, Wifi, Zap,
  FileText, Clock, TrendingUp, CreditCard, TrendingDown,
  CheckCircle, AlertCircle, XCircle, Upload, X, Eye,
  Camera, Loader2, CheckCircle2, RefreshCw, Banknote,
  ArrowUpRight, ArrowDownLeft, Receipt, Users, MapPin,
  Award, Sparkles, Crown, Palette, Hash, Tag,
  Calculator, AlertTriangle, Wallet, BadgeDollarSign,
  Volume2, Smartphone,
} from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getFirestore, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebase_app } from '@/firebase/config';

const storage   = getStorage(firebase_app);
const db        = getFirestore(firebase_app);
const functions = getFunctions(firebase_app, 'us-east1');
const callProcessWithdrawal   = httpsCallable(functions, 'processWithdrawal');
const callPayCashBalance      = httpsCallable(functions, 'payCashBalance');
const callUpdateDriverSetting = httpsCallable(functions, 'updateDriverSetting');

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

// ─── Smart star renderer ──────────────────────────────────────────────────
function StarRow({ rating = 0, size = 14 }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const fill = rating >= i ? 1 : rating >= i - 0.5 ? 0.5 : 0;
    stars.push(
      <div key={i} style={{ position: "relative", width: size, height: size }}>
        <Star size={size} color="#E5E7EB" fill="#E5E7EB" strokeWidth={0}/>
        {fill > 0 && (
          <div style={{
            position: "absolute", top: 0, left: 0,
            width: `${fill * 100}%`, height: "100%",
            overflow: "hidden",
          }}>
            <Star size={size} color="#F59E0B" fill="#F59E0B" strokeWidth={0}/>
          </div>
        )}
      </div>
    );
  }
  return <div style={{ display: "inline-flex", gap: 2 }}>{stars}</div>;
}

// ─── Status badge for driver ──────────────────────────────────────────────
function DriverStatusBadge({ status, online }) {
  const meta = {
    approved: { label: online ? "Active" : "Approved", color: "#16A34A", bg: "rgba(22,163,74,.12)" },
    pending:  { label: "Under Review",                 color: "#D97706", bg: "rgba(217,119,6,.12)"  },
    rejected: { label: "Action Needed",                color: "#DC2626", bg: "rgba(220,38,38,.12)"  },
  }[status] || { label: "Pending Setup", color: "#6B7280", bg: "rgba(107,114,128,.12)" };

  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: meta.bg,
      border: `1px solid ${meta.color}30`,
      borderRadius: 100, padding: "4px 10px",
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: "50%",
        background: meta.color,
        boxShadow: `0 0 6px ${meta.color}80`,
        animation: status === "approved" && online ? "ptLiveDot 1.6s ease-in-out infinite" : "none",
      }}/>
      <span className="mono" style={{
        fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em",
        textTransform: "uppercase", color: meta.color,
      }}>
        {meta.label}
      </span>
    </div>
  );
}

// ─── Shared components ─────────────────────────────────────────────────────
const SectionHeader = ({ title, onBack }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
    <button
      onClick={onBack}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        padding: 8,
        borderRadius: 10,
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background .15s",
      }}
      onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
      onMouseLeave={e => e.currentTarget.style.background = C.surface}
    >
      <ArrowLeft size={16} color={C.text} strokeWidth={2.4}/>
    </button>
    <div className="condensed" style={{ fontSize: 24, fontWeight: 900, color: C.text, letterSpacing: "-0.5px" }}>
      {title}
    </div>
  </div>
);

// ─── Live Toggle (calls backend) ──────────────────────────────────────────
function LiveToggle({ uid, settingKey, value, onUpdate }) {
  const [on,      setOn]      = useState(!!value);
  const [loading, setLoading] = useState(false);

  // Sync external prop changes
  useEffect(() => { setOn(!!value); }, [value]);

  const handleToggle = async () => {
    if (loading || !uid) return;
    const newValue = !on;
    setOn(newValue); // optimistic
    setLoading(true);
    try {
      const { data } = await callUpdateDriverSetting({
        uid,
        key:   settingKey,
        value: newValue,
      });
      if (!data?.success) {
        setOn(!newValue); // revert
        console.error("Failed to update setting:", data?.error);
      } else {
        onUpdate?.(settingKey, newValue);
      }
    } catch (err) {
      setOn(!newValue); // revert
      console.error("Failed to update setting:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      style={{
        width: 44, height: 25, borderRadius: 13,
        background: on ? C.onlineGreen : C.border,
        position: "relative", flexShrink: 0,
        border: "none", cursor: loading ? "wait" : "pointer",
        transition: "background .25s ease",
        opacity: loading ? 0.6 : 1,
      }}
    >
      <div style={{
        width: 19, height: 19, background: "#fff", borderRadius: "50%",
        position: "absolute", top: 3,
        left: on ? 22 : 3,
        boxShadow: "0 1px 4px rgba(0,0,0,.22)",
        transition: "left .25s cubic-bezier(.34,1.56,.64,1)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {loading && <Loader2 size={11} color={C.textDim} style={{ animation: "spin 1s linear infinite" }}/>}
      </div>
    </button>
  );
}

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

// ─── PAYMENT & PAYOUTS (FULLY REDESIGNED) ──────────────────────────────────
const PaymentPayoutsSection = ({ driver, onBack }) => {
  const [tab,         setTab]         = useState("overview");
  const [paying,      setPaying]      = useState(false);
  const [paySuccess,  setPaySuccess]  = useState(false);
  const [payError,    setPayError]    = useState("");
  const [payingCash,  setPayingCash]  = useState(false);
  const [cashError,   setCashError]   = useState("");
  const [driverData,  setDriverData]  = useState(driver ?? {});

  const uid = driver?.uid ?? null;

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      doc(db, "Drivers", uid),
      (snap) => { if (snap.exists()) setDriverData(snap.data()); },
      (err)  => console.error("[Payouts] onSnapshot error:", err)
    );
    return () => unsub();
  }, [uid]);

  // ─── Pull from new schema ──────────────────────────────────────────
  const earnings = driverData?.earnings   ?? {};
  const w        = driverData?.withdrawal ?? {};
  const today    = earnings.today ?? {};
  const week     = earnings.week  ?? {};
  const month    = earnings.month ?? {};

  // Earnings summary
  const todayEarnings  = today.earnings ?? 0;
  const todayTrips     = today.trips    ?? 0;
  const weekEarnings   = week.earnings  ?? 0;
  const weekTrips      = week.trips     ?? 0;
  const monthEarnings  = month.earnings ?? 0;
  const monthTrips     = month.trips    ?? 0;

  // Withdrawal — new fields
  const totalPayout       = w.totalPayout       ?? 0;  // gross stripe payout
  const netPayout         = w.netPayout         ?? 0;  // after cash debt offset
  const cashFeeOwed       = w.cashFeeOwed       ?? 0;  // this cycle
  const carriedCashOwed   = w.carriedCashOwed   ?? 0;  // from prior cycles
  const cashOwedAfter     = w.cashOwedAfter     ?? 0;  // remaining after this cycle
  const stripeRideCount   = w.rideCount         ?? 0;
  const cashRideCount     = w.cashRideCount     ?? 0;
  const stripeRides       = w.rideBreakdown     ?? [];
  const cashRides         = w.cashRideBreakdown ?? [];
  const cashOwedBalance   = driverData?.cashOwedBalance ?? 0;
  const totalCashOwed     = +(cashFeeOwed + carriedCashOwed).toFixed(2);

  const payoutStatus = w.status ?? null;
  const payoutAt     = w.paidAt;
  const isPaid       = payoutStatus === "paid";
  const hasCashOwed  = totalCashOwed > 0 || cashOwedBalance > 0;
  const isOffsetting = totalPayout > 0 && totalCashOwed > 0;

  const lastSynced = earnings.lastSyncedAt;

  // Process card withdrawal
  const handleRequestPayout = async () => {
    if (!uid || paying || netPayout === 0) return;
    setPaying(true);
    setPayError("");
    try {
      const { data } = await callProcessWithdrawal({ uid });
      if (data?.success) {
        setPaySuccess(true);
        setTimeout(() => setPaySuccess(false), 3000);
      } else {
        setPayError(data?.error || "Payout failed — please try again");
      }
    } catch (err) {
      setPayError(err?.message || "Payout failed — please try again");
    } finally {
      setPaying(false);
    }
  };

  // Pay cash balance
  const handlePayCashBalance = async () => {
    if (!uid || payingCash) return;
    setPayingCash(true);
    setCashError("");
    try {
      const { data } = await callPayCashBalance({ uid });
      if (!data?.success) {
        setCashError(data?.error || "Failed to charge balance");
      }
    } catch (err) {
      setCashError(err?.message || "Failed to charge balance");
    } finally {
      setPayingCash(false);
    }
  };

  const TabBtn = ({ id, label }) => (
    <button
      onClick={() => setTab(id)}
      style={{
        flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
        background: tab === id ? C.text : "transparent",
        color:      tab === id ? "#fff" : C.textMid,
        borderRadius: 100, fontSize: 13, fontWeight: 800,
        fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "-0.2px",
        transition: "all .18s",
        boxShadow: tab === id ? "0 4px 12px rgba(0,0,0,0.18)" : "none",
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
        @keyframes payPulseRed{ 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,.4) } 50% { box-shadow: 0 0 0 10px rgba(239,68,68,0) } }
        @keyframes fadeSlide  { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
      `}</style>

      <SectionHeader title="Payment & Payouts" onBack={onBack} />

      <div style={{ display: "flex", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 100, padding: 4, gap: 4 }}>
        <TabBtn id="overview" label="Overview" />
        <TabBtn id="history"  label="Payout History" />
      </div>

      {tab === "overview" && (
        <>
          {/* ─── CASH OWED BANNER ─── */}
          {hasCashOwed && !isOffsetting && (
            <div style={{
              background: "linear-gradient(135deg,#FEF2F2,#FEE2E2 50%,#FEF2F2)",
              border: "1.5px solid rgba(239,68,68,.35)",
              borderRadius: 22, padding: "22px 20px",
              position: "relative", overflow: "hidden",
              boxShadow: "0 8px 28px rgba(239,68,68,.12)",
            }}>
              <div style={{
                position: "absolute", top: -50, right: -50,
                width: 180, height: 180, borderRadius: "50%",
                background: "rgba(239,68,68,0.10)", pointerEvents: "none",
              }}/>
              <div style={{
                position: "absolute", inset: 0,
                backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 40px,rgba(239,68,68,.04) 40px,rgba(239,68,68,.04) 41px)",
                pointerEvents: "none",
              }}/>

              <div style={{ position: "relative" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                  <div className="mono" style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: ".1em",
                    textTransform: "uppercase", color: "#B91C1C",
                  }}>
                    {carriedCashOwed > 0 ? "Cash balance · carried forward" : "Cash balance owed"}
                  </div>
                  <div style={{
                    background: "#EF4444", color: "#fff",
                    borderRadius: 100, padding: "3px 10px",
                    fontSize: 9.5, fontWeight: 800, letterSpacing: ".06em",
                    display: "inline-flex", alignItems: "center", gap: 4,
                    boxShadow: "0 4px 12px rgba(239,68,68,.35)",
                  }}>
                    <AlertTriangle size={9} fill="#fff" strokeWidth={0}/>
                    DUE
                  </div>
                </div>

                <div className="condensed" style={{
                  fontSize: 48, fontWeight: 900, color: "#DC2626",
                  letterSpacing: "-1.2px", lineHeight: 1, marginBottom: 6,
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {fmtMoney(totalCashOwed || cashOwedBalance)}
                </div>

                <div style={{
                  fontSize: 12.5, color: "#B91C1C", fontWeight: 600,
                  marginBottom: 14, display: "flex", alignItems: "center", gap: 6,
                }}>
                  <Banknote size={13}/>
                  {cashRideCount > 0
                    ? `${cashRideCount} cash ride${cashRideCount !== 1 ? "s" : ""} · platform fee collected`
                    : "Outstanding from previous cycles"}
                </div>

                {/* Carried-forward note */}
                {carriedCashOwed > 0 && cashFeeOwed > 0 && (
                  <div style={{
                    background: "rgba(217,119,6,.08)",
                    border: "1px solid rgba(217,119,6,.20)",
                    borderRadius: 10, padding: "8px 12px",
                    marginBottom: 12,
                    display: "flex", alignItems: "center", gap: 8,
                    fontSize: 11.5, color: "#92400E", fontWeight: 600,
                  }}>
                    <Calculator size={12}/>
                    <span>
                      {fmtMoney(cashFeeOwed)} this cycle + {fmtMoney(carriedCashOwed)} carried over
                    </span>
                  </div>
                )}

                <div style={{
                  background: "rgba(239,68,68,.08)",
                  border: "1px solid rgba(239,68,68,.18)",
                  borderRadius: 11, padding: "9px 13px",
                  display: "flex", alignItems: "flex-start", gap: 8,
                  marginBottom: 16,
                }}>
                  <AlertTriangle size={13} color="#EF4444" style={{ flexShrink: 0, marginTop: 1 }}/>
                  <span style={{ fontSize: 11.5, color: "#991B1B", fontWeight: 500, lineHeight: 1.45 }}>
                    You collected the full fare in cash from riders. UaTob's platform fee must be returned.
                  </span>
                </div>

                {cashError && (
                  <div style={{
                    background: "rgba(220,38,38,.15)", border: "1px solid rgba(220,38,38,.3)",
                    borderRadius: 10, padding: "10px 14px", marginBottom: 14,
                    fontSize: 12, color: "#991B1B", fontWeight: 500,
                  }}>
                    ⚠ {cashError}
                  </div>
                )}

                <button
                  onClick={handlePayCashBalance}
                  disabled={payingCash}
                  style={{
                    width: "100%", padding: "15px 20px",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                    background: "linear-gradient(135deg,#EF4444,#DC2626 55%,#B91C1C)",
                    border: "none", borderRadius: 14, color: "#fff",
                    fontFamily: "'Barlow',sans-serif", fontWeight: 800, fontSize: 15,
                    letterSpacing: ".3px",
                    cursor: payingCash ? "wait" : "pointer",
                    opacity: payingCash ? 0.7 : 1,
                    boxShadow: "0 10px 28px rgba(239,68,68,.38)",
                    animation: !payingCash ? "payPulseRed 2.4s ease-in-out infinite" : "none",
                  }}
                >
                  {payingCash
                    ? <><Loader2 size={17} style={{ animation: "spin 1s linear infinite" }}/> Processing…</>
                    : <><CreditCard size={17} strokeWidth={2.4}/> Pay {fmtMoney(totalCashOwed || cashOwedBalance)} Balance</>
                  }
                </button>

                <div style={{
                  marginTop: 10,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  fontSize: 11, color: "#B91C1C", fontWeight: 600,
                }}>
                  <Shield size={11}/>
                  Deducted via your connected bank account
                </div>
              </div>
            </div>
          )}

          {/* ─── PAYOUT READY (with offset breakdown) ─── */}
          {netPayout > 0 && (
            <div style={{
              background: "linear-gradient(135deg,#0F172A,#1E293B)",
              borderRadius: 22, padding: "26px 22px",
              position: "relative", overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,.25)",
            }}>
              <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(22,163,74,.08)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", bottom: -30, left: -30, width: 100, height: 100, borderRadius: "50%", background: "rgba(22,163,74,.06)", pointerEvents: "none" }} />

              <div style={{ position: "relative" }}>
                <div className="mono" style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.4)", letterSpacing: ".1em", marginBottom: 8 }}>
                  AVAILABLE TO WITHDRAW
                </div>
                <div className="condensed" style={{ fontSize: 52, fontWeight: 900, color: "#fff", lineHeight: 1, marginBottom: 4 }}>
                  {fmtMoney(netPayout)}
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)", marginBottom: 22 }}>
                  From {stripeRideCount} stripe ride{stripeRideCount !== 1 ? "s" : ""}
                </div>

                {/* Settlement breakdown */}
                {isOffsetting && (
                  <div style={{
                    background: "rgba(255,255,255,.06)",
                    border: "1px solid rgba(255,255,255,.10)",
                    borderRadius: 12, padding: "12px 14px",
                    marginBottom: 16,
                    display: "flex", flexDirection: "column", gap: 6,
                  }}>
                    <div className="mono" style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: ".1em",
                      textTransform: "uppercase", color: "rgba(255,255,255,.5)", marginBottom: 2,
                    }}>
                      Settlement
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, fontWeight: 600 }}>
                      <span style={{ color: "rgba(255,255,255,.7)" }}>Stripe payout</span>
                      <span className="mono" style={{ color: "#fff", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                        {fmtMoney(totalPayout)}
                      </span>
                    </div>
                    {cashFeeOwed > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, fontWeight: 600 }}>
                        <span style={{ color: "#FCA5A5" }}>Cash fees this cycle</span>
                        <span className="mono" style={{ color: "#FCA5A5", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                          −{fmtMoney(cashFeeOwed)}
                        </span>
                      </div>
                    )}
                    {carriedCashOwed > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, fontWeight: 600 }}>
                        <span style={{ color: "#FCA5A5" }}>Carried from previous</span>
                        <span className="mono" style={{ color: "#FCA5A5", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                          −{fmtMoney(carriedCashOwed)}
                        </span>
                      </div>
                    )}
                    <div style={{ height: 1, background: "rgba(255,255,255,.10)", margin: "4px 0" }}/>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 800 }}>
                      <span style={{ color: "#86EFAC" }}>Net to bank</span>
                      <span className="mono" style={{ color: "#86EFAC", fontVariantNumeric: "tabular-nums" }}>
                        {fmtMoney(netPayout)}
                      </span>
                    </div>
                    {cashOwedAfter > 0 && (
                      <div style={{
                        marginTop: 4, padding: "6px 10px",
                        background: "rgba(217,119,6,.15)",
                        border: "1px solid rgba(217,119,6,.30)",
                        borderRadius: 8,
                        fontSize: 10.5, color: "#FDE68A", fontWeight: 600,
                        display: "flex", alignItems: "center", gap: 6,
                      }}>
                        <AlertTriangle size={10}/>
                        {fmtMoney(cashOwedAfter)} cash debt will carry forward
                      </div>
                    )}
                  </div>
                )}

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
                  {paying
                    ? <><Loader2 size={17} style={{ animation: "spin 1s linear infinite" }} /> Processing…</>
                    : paySuccess
                      ? <><CheckCircle2 size={17} /> Payout Sent!</>
                      : <><Banknote size={17} /> Request Payout · {fmtMoney(netPayout)}</>
                  }
                </button>
              </div>
            </div>
          )}

          {/* Last paid summary (when nothing pending) */}
          {isPaid && stripeRides.length > 0 && netPayout === 0 && !hasCashOwed && (
            <div style={{
              background: "linear-gradient(135deg,#F0FDF4,#DCFCE7)",
              border: "1.5px solid rgba(22,163,74,.3)",
              borderRadius: 20, padding: "20px 20px",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <div className="mono" style={{ fontSize: 10, fontWeight: 700, color: "#15803D", letterSpacing: ".1em", marginBottom: 4 }}>
                    LAST PAYOUT
                  </div>
                  <div className="condensed" style={{ fontSize: 36, fontWeight: 900, color: C.text, lineHeight: 1 }}>
                    {fmtMoney(stripeRides.reduce((s, r) => s + (r.driverPayout ?? 0), 0))}
                  </div>
                  {payoutAt && (
                    <div style={{ fontSize: 12, color: "#15803D", marginTop: 4, fontWeight: 600 }}>
                      Paid {formatDateTime(payoutAt)}
                    </div>
                  )}
                </div>
                <div style={{
                  background: C.onlineGreen, color: "#fff",
                  borderRadius: 12, padding: "8px 12px",
                  display: "flex", alignItems: "center", gap: 6,
                  boxShadow: "0 4px 12px rgba(22,163,74,.35)",
                }}>
                  <CheckCircle size={14} />
                  <span className="mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em" }}>PAID</span>
                </div>
              </div>
              <div style={{
                background: "rgba(255,255,255,.6)", borderRadius: 10, padding: "8px 12px",
                fontSize: 12, color: "#15803D", fontWeight: 600,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <Receipt size={12} />
                {stripeRides.length} ride{stripeRides.length !== 1 ? "s" : ""} · view details in Payout History
              </div>
            </div>
          )}

          {/* Driver split visualization */}
          <div style={{
            background: "linear-gradient(135deg,#F0FDF4,#DCFCE7,#F0FDF4)",
            border: "1.5px solid rgba(22,163,74,.28)",
            borderRadius: 20, padding: "20px", position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(45deg,transparent,transparent 60px,rgba(22,163,74,.03) 60px,rgba(22,163,74,.03) 61px)" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div className="mono" style={{ fontSize: 10, fontWeight: 700, color: "#15803D", letterSpacing: ".1em", marginBottom: 2 }}>YOUR CUT</div>
                <div className="condensed" style={{ fontSize: 44, fontWeight: 900, color: C.text, lineHeight: 1 }}>75%</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: C.onlineGreen, fontWeight: 600, marginBottom: 4 }}>of every fare</div>
                <div style={{ fontSize: 11, color: C.textDim }}>Platform fee: 25%</div>
              </div>
            </div>
            <div style={{ height: 8, background: "rgba(22,163,74,.15)", borderRadius: 99, overflow: "hidden", display: "flex" }}>
              <div style={{ width: "75%", height: "100%", background: "linear-gradient(90deg,#22C55E,#16A34A)" }} />
              <div style={{ width: "25%", height: "100%", background: "rgba(0,0,0,.18)" }} />
            </div>
          </div>

          {/* Earnings stats */}
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

          {lastSynced && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
              <Clock size={11} color={C.textDim} />
              <span className="mono" style={{ fontSize: 10.5, color: C.textDim }}>Synced {formatDateTime(lastSynced)}</span>
            </div>
          )}
        </>
      )}

      {tab === "history" && (
        <PayoutHistoryView
          stripeRides={stripeRides}
          cashRides={cashRides}
          netPayout={netPayout}
          totalPayout={totalPayout}
          cashFeeOwed={cashFeeOwed}
          carriedCashOwed={carriedCashOwed}
          isPaid={isPaid}
          payoutAt={payoutAt}
          createdAt={w.createdAt}
        />
      )}
    </div>
  );
};

// ─── PAYOUT HISTORY VIEW (REDESIGNED) ─────────────────────────────────────
function PayoutHistoryView({
  stripeRides, cashRides, netPayout, totalPayout,
  cashFeeOwed, carriedCashOwed, isPaid, payoutAt, createdAt,
}) {
  const [filter, setFilter] = useState("all"); // all | stripe | cash

  const stripeSum = stripeRides.reduce((s, r) => s + (Number(r.driverPayout) || 0), 0);
  const cashSum   = cashRides.reduce((s, r) => s + (Number(r.platformFee) || 0), 0);

  const visibleRides = filter === "stripe" ? stripeRides
                     : filter === "cash"   ? cashRides
                     : [...stripeRides.map(r => ({ ...r, _type: "stripe" })),
                        ...cashRides.map(r => ({ ...r, _type: "cash" }))];

  const FilterBtn = ({ id, label, count, color }) => (
    <button
      onClick={() => setFilter(id)}
      style={{
        flex: 1, padding: "9px 0",
        background: filter === id ? color : "transparent",
        color: filter === id ? "#fff" : C.textMid,
        border: filter === id ? "none" : `1px solid ${C.border}`,
        borderRadius: 100,
        fontSize: 12, fontWeight: 800,
        fontFamily: "'Barlow Condensed', sans-serif",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
        transition: "all .15s",
      }}
    >
      {label}
      <span style={{
        fontSize: 10, fontWeight: 700,
        background: filter === id ? "rgba(255,255,255,.25)" : C.surfaceAlt,
        padding: "1px 6px", borderRadius: 99,
        fontFamily: "monospace",
      }}>
        {count}
      </span>
    </button>
  );

  return (
    <>
      {/* Hero status card */}
      <div style={{
        background: isPaid
          ? "linear-gradient(135deg,#F0FDF4,#DCFCE7)"
          : "linear-gradient(135deg,#FFFBEB,#FEF3C7)",
        border: `1.5px solid ${isPaid ? "rgba(22,163,74,.3)" : "rgba(217,119,6,.3)"}`,
        borderRadius: 20, padding: "22px 20px",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div className="mono" style={{
              fontSize: 10, fontWeight: 700,
              color: isPaid ? "#15803D" : "#B45309",
              letterSpacing: ".1em", marginBottom: 6,
            }}>
              {isPaid ? "LAST PAYOUT" : "CURRENT PAYOUT"}
            </div>
            <div className="condensed" style={{ fontSize: 42, fontWeight: 900, color: C.text, lineHeight: 1 }}>
              {fmtMoney(netPayout || stripeSum)}
            </div>
            {(payoutAt || createdAt) && (
              <div style={{ fontSize: 12, color: C.textMid, marginTop: 4 }}>
                {isPaid ? "Paid" : "Created"} {formatDateTime(payoutAt || createdAt)}
              </div>
            )}
          </div>
          <div style={{
            background: isPaid ? C.onlineGreen + "18" : "#D97706" + "18",
            border: `1.5px solid ${isPaid ? C.onlineGreen + "30" : "#D97706" + "30"}`,
            borderRadius: 12, padding: "8px 14px",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {isPaid ? <CheckCircle size={14} color={C.onlineGreen}/> : <Clock size={14} color="#D97706"/>}
            <span className="mono" style={{
              fontSize: 11, fontWeight: 700,
              color: isPaid ? C.onlineGreen : "#D97706",
            }}>
              {isPaid ? "PAID" : "PENDING"}
            </span>
          </div>
        </div>

        {/* Quick stats row */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{
            flex: 1,
            background: "rgba(255,255,255,.6)",
            borderRadius: 10, padding: "9px 12px",
          }}>
            <div className="lbl" style={{ marginBottom: 2 }}>Stripe</div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 800, color: C.onlineGreen, fontVariantNumeric: "tabular-nums" }}>
              +{fmtMoney(stripeSum)}
            </div>
            <div style={{ fontSize: 10, color: C.textDim, fontWeight: 600 }}>
              {stripeRides.length} ride{stripeRides.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div style={{
            flex: 1,
            background: "rgba(255,255,255,.6)",
            borderRadius: 10, padding: "9px 12px",
          }}>
            <div className="lbl" style={{ marginBottom: 2 }}>Cash fees</div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 800, color: C.red, fontVariantNumeric: "tabular-nums" }}>
              −{fmtMoney(cashSum)}
            </div>
            <div style={{ fontSize: 10, color: C.textDim, fontWeight: 600 }}>
              {cashRides.length} ride{cashRides.length !== 1 ? "s" : ""}
            </div>
          </div>
          {carriedCashOwed > 0 && (
            <div style={{
              flex: 1,
              background: "rgba(255,255,255,.6)",
              borderRadius: 10, padding: "9px 12px",
            }}>
              <div className="lbl" style={{ marginBottom: 2 }}>Carried</div>
              <div className="mono" style={{ fontSize: 13, fontWeight: 800, color: "#B45309", fontVariantNumeric: "tabular-nums" }}>
                −{fmtMoney(carriedCashOwed)}
              </div>
              <div style={{ fontSize: 10, color: C.textDim, fontWeight: 600 }}>
                prior cycle
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      {(stripeRides.length > 0 || cashRides.length > 0) && (
        <div style={{
          display: "flex", gap: 6,
          background: C.surfaceAlt,
          padding: 4, borderRadius: 100,
          border: `1px solid ${C.border}`,
        }}>
          <FilterBtn id="all"    label="All"    count={stripeRides.length + cashRides.length} color={C.text}/>
          <FilterBtn id="stripe" label="Stripe" count={stripeRides.length}                    color={C.onlineGreen}/>
          <FilterBtn id="cash"   label="Cash"   count={cashRides.length}                      color="#D97706"/>
        </div>
      )}

      {/* Ride list */}
      {visibleRides.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {visibleRides.map((ride, i) => {
            const isCash = ride._type === "cash" || ride.paymentMethod === "cash";
            const amount = isCash ? -(ride.platformFee ?? 0) : (ride.driverPayout ?? 0);
            const accentColor = isCash ? C.red : C.onlineGreen;

            return (
              <div
                key={ride.rideId ?? i}
                style={{
                  background: C.surfaceAlt,
                  border: `1px solid ${C.border}`,
                  borderRadius: 14, padding: "14px 16px",
                  display: "flex", gap: 12, alignItems: "flex-start",
                  animation: `fadeSlide .3s ease ${i * 0.05}s both`,
                  position: "relative", overflow: "hidden",
                }}
              >
                {/* Left accent stripe */}
                <div style={{
                  position: "absolute", top: 0, left: 0, bottom: 0,
                  width: 3,
                  background: accentColor,
                }}/>

                <div style={{
                  width: 38, height: 38, borderRadius: 11,
                  background: accentColor + "15",
                  border: `1px solid ${accentColor}25`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {isCash ? <Banknote size={16} color={accentColor}/> : <CreditCard size={16} color={accentColor}/>}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <div className="condensed" style={{
                      fontSize: 15, fontWeight: 800, color: C.text,
                      textTransform: "capitalize",
                    }}>
                      {ride.riderName ?? "Rider"}
                    </div>
                    <div className="condensed" style={{
                      fontSize: 16, fontWeight: 900,
                      color: accentColor,
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {isCash ? "−" : "+"}{fmtMoney(Math.abs(amount))}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                    <MapPin size={10} color={C.textDim}/>
                    <span style={{
                      fontSize: 11, color: C.textDim,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      textTransform: "capitalize",
                    }}>
                      {ride.pickup?.split(",")[0] ?? "—"} → {ride.dropoff?.split(",")[0] ?? "—"}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span className="mono" style={{ fontSize: 9.5, color: C.textDim }}>
                      {formatDateTime(ride.completedAt)}
                    </span>
                    <span style={{ width: 3, height: 3, borderRadius: "50%", background: C.border }}/>
                    <span className="mono" style={{
                      fontSize: 9.5,
                      color: isCash ? "#B45309" : C.textDim,
                      fontWeight: 700,
                      background: isCash ? "#FEF3C7" : "transparent",
                      padding: isCash ? "1px 6px" : 0,
                      borderRadius: isCash ? 4 : 0,
                      border: isCash ? `1px solid #FDE68A` : "none",
                      textTransform: "uppercase",
                    }}>
                      {isCash ? "CASH" : (ride.paymentMethod ?? "card").toUpperCase()}
                    </span>
                    <span style={{ width: 3, height: 3, borderRadius: "50%", background: C.border }}/>
                    <span className="mono" style={{ fontSize: 9.5, color: C.textDim, textTransform: "capitalize" }}>
                      {ride.rideType ?? "standard"}
                    </span>
                    <span style={{ width: 3, height: 3, borderRadius: "50%", background: C.border }}/>
                    <span className="mono" style={{ fontSize: 9.5, color: C.textDim }}>
                      Fare {fmtMoney(ride.fareTotal)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Net total card */}
          <div style={{
            marginTop: 4,
            background: isPaid ? "#F0FDF4" : C.surfaceAlt,
            border: `1.5px solid ${isPaid ? "rgba(22,163,74,.25)" : C.border}`,
            borderRadius: 14, padding: "14px 16px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span className="condensed" style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
                {isPaid ? "Net paid out" : "Net to bank"}
              </span>
              <span className="condensed" style={{ fontSize: 22, fontWeight: 900, color: C.onlineGreen, fontVariantNumeric: "tabular-nums" }}>
                {fmtMoney(netPayout)}
              </span>
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontSize: 11, color: C.textDim, fontWeight: 600,
              paddingTop: 8, borderTop: `1px solid ${C.border}`,
            }}>
              <span>{fmtMoney(stripeSum)} stripe − {fmtMoney(cashSum)} cash {carriedCashOwed > 0 ? `− ${fmtMoney(carriedCashOwed)} carried` : ""}</span>
            </div>
          </div>
        </div>
      )}

      {visibleRides.length === 0 && (
        <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 14, padding: "26px 20px", textAlign: "center" }}>
          <Receipt size={26} color={C.textDim} style={{ marginBottom: 10 }}/>
          <div className="condensed" style={{ fontSize: 14, fontWeight: 800, color: C.textMid, marginBottom: 4 }}>
            No payout history yet
          </div>
          <div style={{ fontSize: 12, color: C.textDim, fontWeight: 500 }}>
            Complete rides to start earning
          </div>
        </div>
      )}

      <div style={{
        background: "#F0FDF4", border: "1px solid rgba(22,163,74,.2)",
        borderRadius: 13, padding: "13px 16px",
        display: "flex", gap: 10, alignItems: "center",
      }}>
        <Zap size={16} color={C.onlineGreen}/>
        <span style={{ fontSize: 12.5, color: "#15803D", fontWeight: 600 }}>
          Earnings deposit within 24 hrs of completing rides
        </span>
      </div>
    </>
  );
}

// ─── NOTIFICATIONS (calls backend) ─────────────────────────────────────────
const NotificationsSection = ({ driver, onBack }) => {
  const uid = driver?.uid;
  const [settings, setSettings] = useState(driver?.settings ?? {});

  // Live sync settings from driver doc
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      doc(db, "Drivers", uid),
      (snap) => { if (snap.exists()) setSettings(snap.data()?.settings ?? {}); },
    );
    return () => unsub();
  }, [uid]);

  const groups = [
    {
      heading: "Ride Alerts",
      items: [
        { key: "notifyRideRequests", label: "Ride requests", sub: "Alert when a rider is nearby", default: true },
      ]
    },
    {
      heading: "Earnings",
      items: [
        { key: "notifyPayoutConfirmed", label: "Payout confirmed", sub: "When a deposit lands in your bank", default: true },
        { key: "notifyWeeklySummary",   label: "Weekly summary",   sub: "Your earnings recap every Monday",  default: true },
        { key: "notifySurgeZones",      label: "Surge zones",      sub: "High-demand alerts in your area",   default: false },
      ]
    },
    {
      heading: "General",
      items: [
        { key: "notifyPromotions", label: "Promotions",  sub: "Bonuses and limited-time offers", default: false },
        { key: "notifyAppUpdates", label: "App updates", sub: "New features and announcements",  default: false },
      ]
    },
  ];

  const handleUpdate = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, animation: "slideUp .38s ease-out forwards" }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
      <SectionHeader title="Notifications" onBack={onBack} />

      {groups.map(({ heading, items }) => (
        <div key={heading}>
          <div className="lbl" style={{ marginBottom: 8, paddingLeft: 4 }}>{heading}</div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {items.map(({ key, label, sub, default: defaultValue }, i) => {
              const value = settings[key] ?? defaultValue;
              return (
                <div
                  key={label}
                  style={{
                    padding: "14px 18px",
                    borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : "none",
                    display: "flex", alignItems: "center", gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div className="condensed" style={{ fontSize: 15, fontWeight: 800, color: C.text }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2 }}>
                      {sub}
                    </div>
                  </div>
                  <LiveToggle
                    uid={uid}
                    settingKey={key}
                    value={value}
                    onUpdate={handleUpdate}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── APP SETTINGS (calls backend) ──────────────────────────────────────────
const AppSettingsSection = ({ driver, onBack }) => {
  const uid = driver?.uid;
  const [settings, setSettings] = useState(driver?.settings ?? {});

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      doc(db, "Drivers", uid),
      (snap) => { if (snap.exists()) setSettings(snap.data()?.settings ?? {}); },
    );
    return () => unsub();
  }, [uid]);

  const handleUpdate = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // Toggle items
  const toggleGroups = [
    {
      heading: "Device",
      items: [
        { key: "soundHaptics",  label: "Sound & Haptics", sub: "Audio cues and vibration", Icon: Volume2,    color: "#D97706", default: true  },
        { key: "dataSaver",     label: "Data Saver",      sub: "Reduce mobile data usage", Icon: Wifi,       color: C.onlineGreen, default: false },
        { key: "darkModeAuto",  label: "Dark Mode",       sub: "Follow system theme",      Icon: Moon,       color: C.text,    default: true  },
      ]
    },
  ];

  // Static info items
  const infoItems = [
    { label: "Language",       value: "English (US)",  Icon: Globe,    color: "#7C3AED" },
    { label: "Navigation App", value: "Google Maps",   Icon: Map,      color: "#2563EB" },
    { label: "App Version",    value: "1.1.0",         Icon: Zap,      color: C.textMid },
    { label: "Privacy Policy", value: "",              Icon: Shield,   color: C.blue    },
  ];

  return (
    <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, animation: "slideUp .38s ease-out forwards" }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
      <SectionHeader title="App Settings" onBack={onBack} />

      {/* Toggle groups */}
      {toggleGroups.map(({ heading, items }) => (
        <div key={heading}>
          <div className="lbl" style={{ marginBottom: 8, paddingLeft: 4 }}>{heading}</div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {items.map(({ key, label, sub, Icon, color, default: defaultValue }, i) => {
              const value = settings[key] ?? defaultValue;
              return (
                <div
                  key={label}
                  style={{
                    padding: "13px 18px",
                    borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : "none",
                    display: "flex", alignItems: "center", gap: 12,
                  }}
                >
                  <div style={{
                    width: 34, height: 34,
                    background: color + "15",
                    borderRadius: 10,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Icon size={15} color={color}/>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="condensed" style={{ fontSize: 15, fontWeight: 800, color: C.text }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 1 }}>
                      {sub}
                    </div>
                  </div>
                  <LiveToggle uid={uid} settingKey={key} value={value} onUpdate={handleUpdate}/>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Preferences (read-only) */}
      <div>
        <div className="lbl" style={{ marginBottom: 8, paddingLeft: 4 }}>Preferences</div>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {infoItems.slice(0, 2).map(({ label, value, Icon, color }, i, arr) => (
            <div
              key={label}
              style={{
                padding: "13px 18px",
                borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none",
                display: "flex", alignItems: "center", gap: 12,
              }}
            >
              <div style={{
                width: 34, height: 34,
                background: color + "15",
                borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Icon size={15} color={color}/>
              </div>
              <div style={{ flex: 1 }}>
                <div className="condensed" style={{ fontSize: 15, fontWeight: 800, color: C.text }}>
                  {label}
                </div>
              </div>
              {value && <span className="mono" style={{ fontSize: 12, color: C.textDim }}>{value}</span>}
              <ChevronRight size={13} color={C.border}/>
            </div>
          ))}
        </div>
      </div>

      {/* Account info */}
      <div>
        <div className="lbl" style={{ marginBottom: 8, paddingLeft: 4 }}>Account</div>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {infoItems.slice(2).map(({ label, value, Icon, color }, i, arr) => (
            <div
              key={label}
              style={{
                padding: "13px 18px",
                borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none",
                display: "flex", alignItems: "center", gap: 12,
              }}
            >
              <div style={{
                width: 34, height: 34,
                background: color + "15",
                borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Icon size={15} color={color}/>
              </div>
              <div style={{ flex: 1 }}>
                <div className="condensed" style={{ fontSize: 15, fontWeight: 800, color: C.text }}>
                  {label}
                </div>
              </div>
              {value && <span className="mono" style={{ fontSize: 12, color: C.textDim }}>{value}</span>}
              <ChevronRight size={13} color={C.border}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── PROFILE TAB ───────────────────────────────────────────────────────────
export default function ProfileTab({ driver, online, onSignOut }) {
  const [activeSection, setActiveSection] = useState(driver?.status === "rejected" ? "documents" : null);

  const firstName    = driver?.firstName ?? "";
  const lastName     = driver?.lastName  ?? "";
  const fullName     = `${firstName} ${lastName}`.trim() || "Driver";
  const totalTrips   = driver?.totalRides ?? driver?.earnings?.month?.trips ?? 0;
  const memberSince  = formatDate(driver?.createdAt);
  const profilePhoto = driver?.documents?.profilePhotoUrl;
  const avgRating    = driver?.averageRating ?? 0;
  const totalReviews = driver?.totalReviews ?? 0;
  const monthEarnings = driver?.earnings?.month?.earnings ?? 0;

  const vehicle    = driver?.vehicle ?? {};
  const makeModel  = [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "—";
  const carYear    = vehicle.year || "";
  const plate      = vehicle.plate ?? "—";
  const carColor   = vehicle.color ?? "—";
  const rideTypes  = Array.isArray(vehicle.rideTypes) && vehicle.rideTypes.length > 0
    ? vehicle.rideTypes.map(r => r.charAt(0).toUpperCase() + r.slice(1))
    : [];

  const driverStatus = driver?.status === "online" || driver?.status === "offline"
    ? "approved"
    : driver?.status;

  const accountItems = [
    { id: "documents",     Icon: Shield,     label: "Documents & Insurance", accent: C.blue,
      sub: driver?.status === "rejected" ? "Action required" : "View & update" },
    { id: "payments",      Icon: DollarSign, label: "Payment & Payouts",     accent: C.onlineGreen,
      sub: driver?.transferCapability === "enabled" ? "Connected" : "Setup needed" },
  ];

  const prefsItems = [
    { id: "notifications", Icon: Bell,       label: "Notifications",    accent: "#D97706" },
    { id: "settings",      Icon: Settings,   label: "App Settings",     accent: C.purple ?? "#7C3AED" },
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
      <style>{`
        @keyframes ptLiveDot { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>

      {/* Driver hero */}
      <div style={{
        background: online
          ? "linear-gradient(135deg,#F0FDF4 0%,#DCFCE7 50%,#F0FDF4 100%)"
          : "linear-gradient(135deg,#FAFAF7 0%,#F5F5F0 50%,#FAFAF7 100%)",
        border: online ? "1.5px solid rgba(22,163,74,.28)" : `1.5px solid ${C.border}`,
        borderRadius: 24,
        padding: "24px 22px 22px",
        position: "relative",
        overflow: "hidden",
        boxShadow: online
          ? "0 8px 28px rgba(22,163,74,.14), 0 1px 3px rgba(22,163,74,.06)"
          : `0 4px 16px ${C.shadow}`,
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: online
            ? "repeating-linear-gradient(45deg,transparent,transparent 60px,rgba(22,163,74,.04) 60px,rgba(22,163,74,.04) 61px)"
            : "repeating-linear-gradient(45deg,transparent,transparent 60px,rgba(0,0,0,.012) 60px,rgba(0,0,0,.012) 61px)",
          pointerEvents: "none",
        }}/>
        {online && (
          <div style={{
            position: "absolute", top: -50, right: -50,
            width: 180, height: 180, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(22,163,74,.18) 0%, transparent 70%)",
            pointerEvents: "none",
          }}/>
        )}

        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ position: "relative" }}>
              <div style={{
                width: 78, height: 78,
                borderRadius: "50%",
                background: profilePhoto
                  ? `url(${profilePhoto}) center/cover, ${online ? "linear-gradient(135deg,#22C55E,#16A34A)" : "linear-gradient(135deg,#374151,#111827)"}`
                  : online
                    ? "linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)"
                    : "linear-gradient(135deg,#374151,#111827 55%,#0A0A0A)",
                border: "3px solid rgba(255,255,255,.85)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: online
                  ? "0 0 0 6px rgba(22,163,74,.15), 0 8px 24px rgba(22,163,74,.3)"
                  : "0 0 0 6px rgba(0,0,0,.06), 0 8px 20px rgba(0,0,0,.15)",
                position: "relative",
              }}>
                {!profilePhoto && (
                  <span style={{
                    fontSize: 28, fontWeight: 900, color: "#fff",
                    fontFamily: "'Barlow Condensed', sans-serif",
                    letterSpacing: "-0.5px",
                  }}>
                    {firstName.charAt(0).toUpperCase()}{lastName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {online && (
                <div style={{
                  position: "absolute", bottom: 4, right: 4,
                  width: 18, height: 18, borderRadius: "50%",
                  background: "#22C55E",
                  border: "3px solid #fff",
                  boxShadow: "0 2px 6px rgba(34,197,94,0.5)",
                  animation: "ptLiveDot 1.6s ease-in-out infinite",
                }}/>
              )}
            </div>

            <DriverStatusBadge status={driverStatus} online={online}/>
          </div>

          <div className="condensed" style={{
            fontSize: 26, fontWeight: 900, color: C.text,
            letterSpacing: "-0.5px", lineHeight: 1.1,
            marginBottom: 6,
          }}>
            {fullName}
          </div>

          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            fontSize: 12, color: online ? "#15803D" : C.textMid,
            fontWeight: 600,
            flexWrap: "wrap",
            marginBottom: 14,
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Award size={11} strokeWidth={2.4}/>
              Driver since {memberSince}
            </span>
            <span style={{ width: 3, height: 3, borderRadius: "50%", background: online ? "rgba(22,163,74,.4)" : C.border }}/>
            <span>{totalTrips} trip{totalTrips !== 1 ? "s" : ""}</span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{
              flex: 1,
              background: "rgba(255,255,255,0.7)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.5)",
              borderRadius: 12,
              padding: "10px 12px",
            }}>
              <div className="mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.textDim, marginBottom: 4 }}>
                Rating
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                <span className="condensed" style={{ fontSize: 18, fontWeight: 900, color: C.text, letterSpacing: "-0.3px", fontVariantNumeric: "tabular-nums" }}>
                  {avgRating > 0 ? avgRating.toFixed(2) : "—"}
                </span>
                <Star size={11} fill="#F59E0B" color="#F59E0B" strokeWidth={0}/>
              </div>
              <div style={{ marginTop: 3 }}>
                <StarRow rating={avgRating} size={9}/>
              </div>
            </div>

            <div style={{
              flex: 1,
              background: "rgba(255,255,255,0.7)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.5)",
              borderRadius: 12,
              padding: "10px 12px",
            }}>
              <div className="mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.textDim, marginBottom: 4 }}>
                This month
              </div>
              <div className="condensed" style={{ fontSize: 18, fontWeight: 900, color: C.text, letterSpacing: "-0.3px", lineHeight: 1.05, fontVariantNumeric: "tabular-nums" }}>
                {fmtMoney(monthEarnings)}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.textDim, marginTop: 3 }}>
                {driver?.earnings?.month?.trips ?? 0} trips
              </div>
            </div>

            <div style={{
              flex: 1,
              background: "rgba(255,255,255,0.7)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.5)",
              borderRadius: 12,
              padding: "10px 12px",
            }}>
              <div className="mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.textDim, marginBottom: 4 }}>
                Reviews
              </div>
              <div className="condensed" style={{ fontSize: 18, fontWeight: 900, color: C.text, letterSpacing: "-0.3px", lineHeight: 1.05, fontVariantNumeric: "tabular-nums" }}>
                {totalReviews}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.textDim, marginTop: 3 }}>
                all-time
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle card */}
      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 22,
        padding: "20px",
        position: "relative",
        overflow: "hidden",
        boxShadow: `0 1px 3px ${C.shadow}`,
      }}>
        <div style={{
          position: "absolute", top: 16, right: -20,
          opacity: 0.04, pointerEvents: "none",
        }}>
          <Car size={120} strokeWidth={1} color={C.text}/>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, position: "relative" }}>
          <div>
            <div className="mono" style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
              Your Vehicle
            </div>
            <div className="condensed" style={{ fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: "-0.5px", lineHeight: 1.1, textTransform: "capitalize" }}>
              {makeModel}
            </div>
            {carYear && (
              <div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, marginTop: 2 }}>
                {carYear}
              </div>
            )}
          </div>

          <div style={{
            background: "linear-gradient(135deg,#FAFAF7,#F0EFE8)",
            border: "2px solid #1F2937",
            borderRadius: 8,
            padding: "5px 10px",
            position: "relative",
          }}>
            <div className="mono" style={{ fontSize: 7, fontWeight: 800, color: "#1F2937", letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.7 }}>
              Plate
            </div>
            <div className="condensed" style={{ fontSize: 16, fontWeight: 900, color: "#1F2937", letterSpacing: ".5px", lineHeight: 1, fontFamily: "'Inter Mono', monospace", textTransform: "uppercase" }}>
              {plate}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, position: "relative" }}>
          <div style={{ flex: 1, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 8,
              background: getCarColorHex(carColor),
              border: "1.5px solid rgba(0,0,0,0.12)",
              flexShrink: 0,
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.1)",
            }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="lbl" style={{ marginBottom: 1 }}>Color</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {carColor}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px" }}>
            <div className="lbl" style={{ marginBottom: 4 }}>Tiers</div>
            {rideTypes.length > 0 ? (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {rideTypes.map(t => (
                  <span key={t} style={{
                    fontSize: 9.5, fontWeight: 800,
                    background: t === "Premium" ? "#F5F3FF" : t === "Xl" ? "#FFFBEB" : "#F0FDF4",
                    color: t === "Premium" ? "#6D28D9" : t === "Xl" ? "#B45309" : "#15803D",
                    border: `1px solid ${t === "Premium" ? "#DDD6FE" : t === "Xl" ? "#FDE68A" : "#BBF7D0"}`,
                    padding: "2px 6px",
                    borderRadius: 5,
                    textTransform: "uppercase",
                    letterSpacing: ".04em",
                  }}>
                    {t}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim }}>—</div>
            )}
          </div>
        </div>
      </div>

      {/* Account section */}
      <div>
        <div className="lbl" style={{ marginBottom: 8, paddingLeft: 4 }}>Account</div>
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: `0 1px 3px ${C.shadow}`,
        }}>
          {accountItems.map(({ id, Icon, label, accent, sub }, i, arr) => (
            <div
              key={label}
              onClick={() => setActiveSection(id)}
              style={{
                padding: "14px 18px",
                borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none",
                display: "flex", alignItems: "center", gap: 14,
                cursor: "pointer",
                transition: "background .15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div style={{
                width: 38, height: 38,
                background: `linear-gradient(135deg, ${accent}18, ${accent}08)`,
                border: `1px solid ${accent}25`,
                borderRadius: 11,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Icon size={17} color={accent} strokeWidth={2.2}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: C.text, letterSpacing: "-0.1px" }}>
                  {label}
                </div>
                {sub && (
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: id === "documents" && driver?.status === "rejected" ? C.red : C.textDim, marginTop: 1 }}>
                    {sub}
                  </div>
                )}
              </div>
              <ChevronRight size={15} color={C.textDim} strokeWidth={2.2}/>
            </div>
          ))}
        </div>
      </div>

      {/* Preferences section */}
      <div>
        <div className="lbl" style={{ marginBottom: 8, paddingLeft: 4 }}>Preferences</div>
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: `0 1px 3px ${C.shadow}`,
        }}>
          {prefsItems.map(({ id, Icon, label, accent }, i, arr) => (
            <div
              key={label}
              onClick={() => setActiveSection(id)}
              style={{
                padding: "14px 18px",
                borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none",
                display: "flex", alignItems: "center", gap: 14,
                cursor: "pointer",
                transition: "background .15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div style={{
                width: 38, height: 38,
                background: `linear-gradient(135deg, ${accent}18, ${accent}08)`,
                border: `1px solid ${accent}25`,
                borderRadius: 11,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Icon size={17} color={accent} strokeWidth={2.2}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: C.text, letterSpacing: "-0.1px" }}>
                  {label}
                </div>
              </div>
              <ChevronRight size={15} color={C.textDim} strokeWidth={2.2}/>
            </div>
          ))}
        </div>
      </div>

      {/* Sign out */}
      <button
        onClick={() => onSignOut?.()}
        style={{
          marginTop: 8,
          background: C.surface,
          border: `1.5px solid ${C.border}`,
          borderRadius: 16,
          padding: "14px 18px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          cursor: "pointer",
          fontFamily: "inherit",
          transition: "all .15s",
          color: C.red,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "#FEF2F2";
          e.currentTarget.style.borderColor = "#FCA5A5";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = C.surface;
          e.currentTarget.style.borderColor = C.border;
        }}
      >
        <LogOut size={15} strokeWidth={2.2}/>
        <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.1px" }}>
          Sign Out
        </span>
      </button>

      <div style={{ textAlign: "center", padding: "4px 0 8px" }}>
        <span className="mono" style={{ fontSize: 10, fontWeight: 600, color: C.textDim, letterSpacing: ".05em" }}>
          UaTob Driver · v1.1.0
        </span>
      </div>
    </div>
  );
}

// ── Helper ─────────────────────────────────────────────────────────
function getCarColorHex(name = "") {
  const map = {
    black:  "#1A1A1A",
    white:  "#F5F5F0",
    silver: "#C0C0C0",
    gray:   "#6B7280",
    grey:   "#6B7280",
    red:    "#DC2626",
    blue:   "#2563EB",
    green:  "#16A34A",
    yellow: "#F59E0B",
    orange: "#EA580C",
    brown:  "#78350F",
    purple: "#7C3AED",
    gold:   "#D4AF37",
    beige:  "#D4C5A0",
  };
  return map[name.toLowerCase()] || "#9CA3AF";
}