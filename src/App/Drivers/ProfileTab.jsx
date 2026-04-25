import { useState, useCallback, useRef } from 'react';
import {
  Car, Star, Shield, DollarSign, Bell, Settings, LogOut,
  ChevronRight, ArrowLeft, Globe, Map, Moon, Wifi, Zap,
  FileText, Clock, TrendingUp, CreditCard, TrendingDown,
  CheckCircle, AlertCircle, XCircle, Upload, X, Eye,
  Camera, Loader2, CheckCircle2,
} from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const storage = getStorage(firebase_app);
const db      = getFirestore(firebase_app);

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
  const inputRef              = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [error, setError]         = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [justDone, setJustDone]   = useState(false);

  const existingUrl = docs[urlKey] || "";
  const isUploaded  = Boolean(existingUrl || docs[slotKey]);

  const getStatus = () => {
    if (isUploaded) return { label: "uploaded", color: C.onlineGreen, bg: "#F0FDF4", border: "rgba(22,163,74,.25)", iconBg: "rgba(22,163,74,.12)", iconColor: "#16A34A" };
    return { label: "required", color: C.red, bg: "#FEF2F2", border: "rgba(220,38,38,.25)", iconBg: "rgba(220,38,38,.12)", iconColor: C.red };
  };

  const s = getStatus();

  const handleFile = useCallback(async (file) => {
    if (!file || !uid) return;
    setError("");

    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setError("JPG, PNG, WEBP or PDF only");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Max file size is 10 MB");
      return;
    }

    // Local preview
    if (file.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(file));
    }

    setUploading(true);
    setProgress(0);

    try {
      const ext      = file.name.split(".").pop();
      const path     = `drivers/${uid}/documents/${slotKey}_${Date.now()}.${ext}`;
      const storageRef = ref(storage, path);
      const task     = uploadBytesResumable(storageRef, file);

      await new Promise((resolve, reject) => {
        task.on(
          "state_changed",
          snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          resolve,
        );
      });

      const downloadURL = await getDownloadURL(task.snapshot.ref);

      // Write to Firestore
      await updateDoc(doc(db, "Drivers", uid), {
        [`documents.${slotKey}`]:    true,
        [`documents.${urlKey}`]:     downloadURL,
      });

      setPreviewUrl(downloadURL);
      setJustDone(true);
      setTimeout(() => setJustDone(false), 2500);
      onUploaded?.({ slotKey, urlKey, downloadURL });
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
      {/* Preview lightbox */}
      {showPreview && displayUrl && (
        <div
          onClick={() => setShowPreview(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 1200,
            background: "rgba(0,0,0,.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <button
            onClick={() => setShowPreview(false)}
            style={{
              position: "absolute", top: 20, right: 20,
              background: "rgba(255,255,255,.15)", border: "none",
              borderRadius: "50%", width: 40, height: 40,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={20} color="#fff" />
          </button>
          {displayUrl.startsWith("data:application/pdf") ? (
            <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>PDF preview not available</div>
          ) : (
            <img
              src={displayUrl}
              alt={label}
              style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 16, objectFit: "contain" }}
            />
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        style={{ display: "none" }}
        onChange={handleChange}
      />

      <div
        style={{
          background: s.bg,
          border: `1.5px solid ${s.border}`,
          borderRadius: 16,
          padding: "14px 14px 13px",
          position: "relative",
          overflow: "hidden",
          cursor: uploading ? "default" : "pointer",
          transition: "transform .15s ease, box-shadow .15s ease",
        }}
        onClick={() => { if (!uploading) inputRef.current?.click(); }}
        onMouseEnter={e => { if (!uploading) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.08)"; } }}
        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
      >
        {/* Progress bar */}
        {uploading && (
          <div style={{
            position: "absolute", bottom: 0, left: 0,
            height: 3, background: "#2563EB",
            width: `${progress}%`,
            transition: "width .2s ease",
            borderRadius: "0 3px 0 0",
          }} />
        )}

        {/* Just done flash */}
        {justDone && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(22,163,74,.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 16,
            animation: "fadeIn .2s ease",
          }}>
            <CheckCircle2 size={28} color="#16A34A" />
          </div>
        )}

        {/* Icon */}
        <div style={{
          width: 34, height: 34,
          background: uploading ? "rgba(37,99,235,.12)" : s.iconBg,
          borderRadius: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 8,
        }}>
          {uploading
            ? <Loader2 size={16} color="#2563EB" style={{ animation: "spin 1s linear infinite" }} />
            : isUploaded
              ? <Icon size={16} color={s.iconColor} />
              : <Upload size={16} color={s.iconColor} />
          }
        </div>

        {/* Label */}
        <div className="condensed" style={{ fontSize: 13, fontWeight: 800, color: C.text, lineHeight: 1.2, marginBottom: 4 }}>
          {label}
        </div>

        {/* Status / progress */}
        <div className="mono" style={{ fontSize: 10, fontWeight: 700, color: uploading ? "#2563EB" : s.color, letterSpacing: ".04em" }}>
          {uploading ? `UPLOADING ${progress}%` : isUploaded ? "UPLOADED" : "TAP TO UPLOAD"}
        </div>

        {/* Error */}
        {error && (
          <div style={{ fontSize: 10, color: C.red, marginTop: 4, fontWeight: 600 }}>{error}</div>
        )}

        {/* Preview + re-upload row */}
        {isUploaded && !uploading && (
          <div
            style={{ display: "flex", gap: 6, marginTop: 10 }}
            onClick={e => e.stopPropagation()}
          >
            {displayUrl && !displayUrl.startsWith("data:application/pdf") && (
              <button
                onClick={() => setShowPreview(true)}
                style={{
                  flex: 1, padding: "5px 0", border: `1px solid ${s.border}`,
                  borderRadius: 8, background: s.iconBg, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                }}
              >
                <Eye size={11} color={s.iconColor} />
                <span className="mono" style={{ fontSize: 9.5, fontWeight: 700, color: s.iconColor }}>VIEW</span>
              </button>
            )}
            <button
              onClick={() => inputRef.current?.click()}
              style={{
                flex: 1, padding: "5px 0", border: `1px solid ${C.border}`,
                borderRadius: 8, background: C.surfaceAlt, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              }}
            >
              <Camera size={11} color={C.textMid} />
              <span className="mono" style={{ fontSize: 9.5, fontWeight: 700, color: C.textMid }}>REPLACE</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── DOCUMENTS & INSURANCE ─────────────────────────────────────────────────
const DocumentsInsuranceSection = ({ driver, onBack }) => {
  const uid  = driver?.uid ?? null;
  const [docs, setDocs] = useState(driver?.documents ?? {});

  const slots = [
    { key: "licenseFront", urlKey: "licenseFrontUrl", label: "License (Front)",   Icon: FileText },
    { key: "licenseBack",  urlKey: "licenseBackUrl",  label: "License (Back)",    Icon: FileText },
    { key: "registration", urlKey: "registrationUrl", label: "Registration",      Icon: Car      },
    { key: "insurance",    urlKey: "insuranceUrl",    label: "Insurance Card",    Icon: Shield   },
    { key: "profilePhoto", urlKey: "profilePhotoUrl", label: "Profile Photo",     Icon: Star     },
  ];

  const handleUploaded = useCallback(({ slotKey, urlKey, downloadURL }) => {
    setDocs(prev => ({ ...prev, [slotKey]: true, [urlKey]: downloadURL }));
  }, []);

  const uploaded = slots.filter(s => docs[s.urlKey] || docs[s.key]).length;
  const allDone  = uploaded === slots.length;

  return (
    <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, animation: "slideUp .38s ease-out forwards" }}>
      <style>{`
        @keyframes spin     { from { transform: rotate(0deg)  } to { transform: rotate(360deg) } }
        @keyframes fadeIn   { from { opacity: 0 }               to { opacity: 1 }               }
      `}</style>

      <SectionHeader title="Documents & Insurance" onBack={onBack} />

      {/* Progress banner */}
      <div style={{
        background: allDone ? "#F0FDF4" : "#EFF6FF",
        border: `1px solid ${allDone ? "#BBF7D0" : "#BFDBFE"}`,
        borderRadius: 18, padding: "18px 16px",
        display: "flex", gap: 14, alignItems: "flex-start",
      }}>
        <div style={{
          width: 42, height: 42,
          background: allDone ? "#16A34A" : "#2563EB",
          borderRadius: 13,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {allDone
            ? <CheckCircle2 size={20} color="#fff" />
            : <Shield size={19} color="#fff" />
          }
        </div>
        <div style={{ flex: 1 }}>
          <div className="condensed" style={{ fontSize: 15, fontWeight: 900, color: allDone ? "#14532D" : "#1E3A8A" }}>
            {uploaded}/{slots.length} documents submitted
          </div>
          <div style={{ marginTop: 8, height: 6, background: allDone ? "#BBF7D0" : "#BFDBFE", borderRadius: 99, overflow: "hidden" }}>
            <div style={{
              width: `${(uploaded / slots.length) * 100}%`,
              height: "100%",
              background: allDone ? "#16A34A" : "#2563EB",
              borderRadius: 99,
              transition: "width .4s",
            }} />
          </div>
          <div style={{ fontSize: 12, color: allDone ? "#16A34A" : "#3B82F6", marginTop: 5 }}>
            {allDone
              ? "All documents submitted — under review"
              : `${slots.length - uploaded} document${slots.length - uploaded !== 1 ? "s" : ""} still needed — tap a card to upload`
            }
          </div>
        </div>
      </div>

      {/* Doc grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {slots.map(({ key, urlKey, label, Icon }) => (
          <UploadSlot
            key={key}
            slotKey={key}
            urlKey={urlKey}
            label={label}
            Icon={Icon}
            docs={docs}
            uid={uid}
            onUploaded={handleUploaded}
          />
        ))}
      </div>

      {/* Info note */}
      <div style={{
        background: "#FFFBEB", border: "1px solid rgba(217,119,6,.2)",
        borderRadius: 13, padding: "13px 16px",
        display: "flex", gap: 10, alignItems: "flex-start",
      }}>
        <AlertCircle size={15} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 12, color: "#92400E", fontWeight: 500, lineHeight: 1.5 }}>
          Uploaded documents are reviewed by the UaTob team within 24–48 hours. You'll be notified once approved.
        </span>
      </div>
    </div>
  );
};

// ─── PAYMENT & PAYOUTS ─────────────────────────────────────────────────────
const PaymentPayoutsSection = ({ driver, onBack }) => {
  const [tab, setTab] = useState("overview");

  const earnings   = driver?.earnings   ?? {};
  const withdrawal = driver?.withdrawal ?? {};

  const today     = earnings.today ?? {};
  const week      = earnings.week  ?? {};
  const month     = earnings.month ?? {};

  const todayEarnings    = today.earnings     ?? 0;
  const todayTrips       = today.trips        ?? 0;
  const weekEarnings     = week.earnings      ?? 0;
  const weekTrips        = week.trips         ?? 0;
  const weekChange       = week.changePercent ?? 0;
  const lastWeek         = week.lastWeekEarnings ?? 0;
  const monthEarnings    = month.earnings     ?? 0;
  const monthTrips       = month.trips        ?? 0;
  const dailyBreakdown   = week.dailyBreakdown ?? [];

  const lastPayout       = withdrawal.totalPayout ?? 0;
  const lastPayoutStatus = withdrawal.status      ?? "—";
  const lastPayoutAt     = withdrawal.paidAt;
  const lastSynced       = earnings.lastSyncedAt;

  const withdrawalStatusMeta = {
    paid:    { label: "Paid",    color: C.onlineGreen, Icon: CheckCircle },
    pending: { label: "Pending", color: "#D97706",     Icon: Clock       },
    failed:  { label: "Failed",  color: C.red,         Icon: XCircle     },
  }[lastPayoutStatus] ?? { label: lastPayoutStatus, color: C.textMid, Icon: AlertCircle };

  const maxBar = Math.max(...dailyBreakdown.map(d => d.amount ?? 0), 1);

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
      <SectionHeader title="Payment & Payouts" onBack={onBack} />

      <div style={{ display: "flex", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 13, padding: 4, gap: 4 }}>
        <TabBtn id="overview" label="Overview" />
        <TabBtn id="history"  label="Payout History" />
      </div>

      {tab === "overview" && (
        <>
          <div style={{
            background: "linear-gradient(135deg,#F0FDF4,#DCFCE7,#F0FDF4)",
            border: "1.5px solid rgba(22,163,74,.28)",
            borderRadius: 22, padding: "22px 20px", textAlign: "center",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(45deg,transparent,transparent 60px,rgba(22,163,74,.03) 60px,rgba(22,163,74,.03) 61px)" }} />
            <div className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: "#15803D", letterSpacing: ".1em", marginBottom: 4 }}>YOUR EARNINGS SPLIT</div>
            <div className="condensed" style={{ fontSize: 58, fontWeight: 900, color: C.text, lineHeight: 1, margin: "2px 0 4px" }}>80%</div>
            <div style={{ fontSize: 13, color: C.onlineGreen, fontWeight: 600, marginBottom: 14 }}>of every fare goes straight to you</div>
            <div style={{ maxWidth: 220, margin: "0 auto", height: 8, background: "rgba(22,163,74,.15)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: "80%", height: "100%", background: C.onlineGreen, borderRadius: 99 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", maxWidth: 220, margin: "4px auto 0", fontSize: 10.5 }}>
              <span className="mono" style={{ color: C.onlineGreen, fontWeight: 700 }}>You · 80%</span>
              <span className="mono" style={{ color: C.textDim }}>Platform · 20%</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { label: "Today",      value: fmtMoney(todayEarnings),  sub: `${todayTrips} trip${todayTrips !== 1 ? "s" : ""}` },
              { label: "This Week",  value: fmtMoney(weekEarnings),   sub: `${weekTrips} trips`  },
              { label: "This Month", value: fmtMoney(monthEarnings),  sub: `${monthTrips} trips` },
            ].map(({ label, value, sub }) => (
              <div key={label} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 13, padding: "13px 12px" }}>
                <div className="lbl" style={{ marginBottom: 4 }}>{label}</div>
                <div className="condensed" style={{ fontSize: 20, fontWeight: 900, color: C.text, lineHeight: 1.1 }}>{value}</div>
                <div className="mono" style={{ fontSize: 10.5, color: C.textDim, marginTop: 3 }}>{sub}</div>
              </div>
            ))}
          </div>

          {dailyBreakdown.length > 0 && (
            <div className="card" style={{ padding: "18px 18px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                <div className="condensed" style={{ fontSize: 15, fontWeight: 800, color: C.text }}>This Week</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {weekChange >= 0
                    ? <TrendingUp size={13} color={C.onlineGreen} />
                    : <TrendingDown size={13} color={C.red} />
                  }
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
                        <div style={{
                          width: "100%",
                          height: `${Math.max(pct, amount == null ? 0 : 4)}%`,
                          minHeight: (amount ?? 0) > 0 ? 4 : 0,
                          background: isToday ? C.onlineGreen : amount == null ? C.border : C.onlineGreen + "40",
                          borderRadius: "5px 5px 3px 3px",
                          transition: "height .4s ease",
                        }} />
                        {isToday && (
                          <div style={{
                            position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)",
                            background: C.onlineGreen, color: "#fff",
                            fontSize: 9, fontWeight: 700, fontFamily: "monospace",
                            padding: "2px 5px", borderRadius: 5, whiteSpace: "nowrap",
                          }}>
                            {fmtMoney(amount)}
                          </div>
                        )}
                      </div>
                      <div className="mono" style={{ fontSize: 9.5, color: isToday ? C.onlineGreen : C.textDim, fontWeight: isToday ? 700 : 400 }}>
                        {day}
                      </div>
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
          <div className="card" style={{ padding: "20px" }}>
            <div className="condensed" style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 14 }}>Last Payout</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, background: withdrawalStatusMeta.color + "15", borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <withdrawalStatusMeta.Icon size={20} color={withdrawalStatusMeta.color} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="condensed" style={{ fontSize: 26, fontWeight: 900, color: C.text, lineHeight: 1 }}>{fmtMoney(lastPayout)}</div>
                <div style={{ fontSize: 12.5, color: C.textMid, marginTop: 3 }}>{formatDateTime(lastPayoutAt)}</div>
              </div>
              <div style={{ background: withdrawalStatusMeta.color + "15", border: `1px solid ${withdrawalStatusMeta.color}30`, borderRadius: 20, padding: "4px 12px" }}>
                <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: withdrawalStatusMeta.color, letterSpacing: ".04em" }}>
                  {withdrawalStatusMeta.label.toUpperCase()}
                </span>
              </div>
            </div>

            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Rides included", value: withdrawal.rideCount ?? 0 },
                { label: "Payout created", value: formatDateTime(withdrawal.createdAt) },
                { label: "Last updated",   value: formatDateTime(withdrawal.updatedAt) },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12.5, color: C.textDim }}>{label}</span>
                  <span className="mono" style={{ fontSize: 12.5, color: C.text, fontWeight: 700 }}>{String(value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: C.surfaceAlt, border: `1.5px dashed ${C.border}`, borderRadius: 15, padding: "18px 16px", display: "flex", alignItems: "center", gap: 14, opacity: 0.65 }}>
            <div style={{ width: 38, height: 38, background: C.blue + "18", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <CreditCard size={17} color={C.blue} />
            </div>
            <div>
              <div className="condensed" style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Bank Account</div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>Direct deposit setup coming soon</div>
            </div>
          </div>

          <div style={{ background: "#F0FDF4", border: "1px solid rgba(22,163,74,.2)", borderRadius: 13, padding: "13px 16px", display: "flex", gap: 10, alignItems: "center" }}>
            <Zap size={16} color={C.onlineGreen} />
            <span style={{ fontSize: 12.5, color: "#15803D", fontWeight: 600 }}>
              Earnings deposit within 24 hrs of completing rides
            </span>
          </div>

          <ComingSoonBadge label="FULL PAYOUT HISTORY COMING SOON" color="#16A34A" bg="#F0FDF4" />
        </>
      )}
    </div>
  );
};

// ─── NOTIFICATIONS ─────────────────────────────────────────────────────────
const NotificationsSection = ({ driver, onBack }) => {
  const groups = [
    {
      heading: "Ride Alerts",
      items: [
        { label: "Ride requests",      sub: "Alert when a rider is nearby",      on: true  },
        { label: "Ride cancellations", sub: "Know when a ride is cancelled",      on: true  },
      ],
    },
    {
      heading: "Earnings",
      items: [
        { label: "Payout confirmed",   sub: "When a deposit lands in your bank", on: true  },
        { label: "Weekly summary",     sub: "Your earnings recap every Monday",  on: true  },
        { label: "Surge zones",        sub: "High-demand alerts in your area",   on: false },
      ],
    },
    {
      heading: "General",
      items: [
        { label: "Promotions",         sub: "Bonuses and limited-time offers",   on: false },
        { label: "App updates",        sub: "New features and announcements",    on: false },
      ],
    },
  ];

  return (
    <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, animation: "slideUp .38s ease-out forwards" }}>
      <SectionHeader title="Notifications" onBack={onBack} />

      {groups.map(({ heading, items }) => (
        <div key={heading}>
          <div className="lbl" style={{ marginBottom: 8, paddingLeft: 4 }}>{heading}</div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {items.map(({ label, sub, on }, i) => (
              <div
                key={label}
                style={{ padding: "14px 18px", borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : "none", display: "flex", alignItems: "center", gap: 12, opacity: 0.62 }}
              >
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
    {
      heading: "Preferences",
      items: [
        { label: "Language",        value: "English (US)",  Icon: Globe,    color: "#7C3AED" },
        { label: "Navigation App",  value: "Google Maps",   Icon: Map,      color: "#2563EB" },
        { label: "Dark Mode",       value: "System",        Icon: Moon,     color: C.text    },
      ],
    },
    {
      heading: "Device",
      items: [
        { label: "Sound & Haptics", value: "On",            Icon: Bell,     color: "#D97706"      },
        { label: "Data Saver",      value: "Off",           Icon: Wifi,     color: C.onlineGreen  },
      ],
    },
    {
      heading: "Account",
      items: [
        { label: "App Version",     value: "1.1.0",         Icon: Zap,      color: C.textMid },
        { label: "Privacy Policy",  value: "",              Icon: Shield,   color: C.blue    },
      ],
    },
  ];

  return (
    <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, animation: "slideUp .38s ease-out forwards" }}>
      <SectionHeader title="App Settings" onBack={onBack} />

      {groups.map(({ heading, items }) => (
        <div key={heading}>
          <div className="lbl" style={{ marginBottom: 8, paddingLeft: 4 }}>{heading}</div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {items.map(({ label, value, Icon, color }, i) => (
              <div
                key={label}
                style={{ padding: "13px 18px", borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : "none", display: "flex", alignItems: "center", gap: 12, opacity: 0.62 }}
              >
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

  const firstName   = driver?.firstName  ?? "";
  const lastName    = driver?.lastName   ?? "";
  const fullName    = `${firstName} ${lastName}`.trim() || "Driver";
  const totalTrips  = driver?.earnings?.month?.trips ?? 0;
  const memberSince = formatDate(driver?.createdAt);

  const vehicle   = driver?.vehicle ?? {};
  const makeModel = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ") || "—";
  const plate     = vehicle.plate ?? "—";
  const color     = vehicle.color ?? "—";
  const rideTypes = Array.isArray(vehicle.rideTypes) && vehicle.rideTypes.length > 0
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
        background: online
          ? "linear-gradient(135deg,#F0FDF4,#DCFCE7,#F0FDF4)"
          : "linear-gradient(135deg,#F9FAFB,#F3F4F6,#F9FAFB)",
        border:       online ? "1.5px solid rgba(22,163,74,.28)" : `1px solid ${C.border}`,
        borderRadius: 22, padding: "28px 24px",
        textAlign:    "center", position: "relative", overflow: "hidden",
        boxShadow:    online ? "0 4px 24px rgba(22,163,74,.1)" : `0 2px 12px ${C.shadow}`,
      }}>
        <div style={{ position: "absolute", inset: 0, background: `repeating-linear-gradient(45deg,transparent,transparent 60px,${online ? "rgba(22,163,74,.03)" : "rgba(0,0,0,.015)"} 60px,${online ? "rgba(22,163,74,.03)" : "rgba(0,0,0,.015)"} 61px)` }} />
        <div style={{
          width: 72, height: 72,
          background: online
            ? "linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)"
            : "linear-gradient(135deg,#374151,#111827 55%,#0A0A0A)",
          border: "3px solid rgba(255,255,255,.8)", borderRadius: "50%",
          margin: "0 auto 14px",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: online
            ? "0 0 0 6px rgba(22,163,74,.15), 0 8px 24px rgba(22,163,74,.3)"
            : "0 0 0 6px rgba(0,0,0,.07), 0 8px 24px rgba(0,0,0,.18)",
          position: "relative",
        }}>
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
          {[
            { label: "Make & Model", value: makeModel },
            { label: "Plate",        value: plate      },
            { label: "Color",        value: color      },
            { label: "Ride Types",   value: rideTypes  },
          ].map(v => (
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
            style={{
              padding: "15px 20px",
              borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none",
              display: "flex", alignItems: "center", gap: 14,
              cursor: "pointer", transition: "background .15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ width: 36, height: 36, background: accent + "12", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={16} color={accent} />
            </div>
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: label === "Sign Out" ? C.red : C.text }}>
              {label}
            </span>
            {id !== "signout" && <ChevronRight size={14} color={C.textDim} />}
          </div>
        ))}
      </div>
    </div>
  );
}