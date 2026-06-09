// src/App/SignUp/UaTobDriverSignup.jsx
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import {
  Car, User, FileText, Shield, Camera, Check, ChevronRight,
  ChevronLeft, ChevronDown, Eye, EyeOff, Upload, Phone, Mail, Lock,
  MapPin, Calendar, CreditCard, AlertCircle, Zap,
  CheckCircle, Clock, ArrowRight, X, Crown, Users, Sparkles, Hash,
} from "lucide-react";
import signUp from '@/firebase/auth/signup';
import DriverLogin from "@/App/SignUp/DriverLogin";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { firebase_app } from "@/firebase/config";
import { useApplicationSubmitted } from "@/App/SignUp/useApplicationSubmitted";
import { useCreateDriverProfile } from "@/App/SignUp/useCreateDriverProfile";

const storage = getStorage(firebase_app);

/* ─── localStorage helpers ───────────────────────────────────────────── */
const LS_KEYS = {
  step:      "uatob_driver_step",
  account:   "uatob_driver_account",
  contact:   "uatob_driver_contact",
  vehicle:   "uatob_driver_vehicle",
  doc:       "uatob_driver_doc",
  uid:       "uatob_driver_uid",
  submitted: "uatob_driver_submitted",
};

function lsGet(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function lsClear() {
  Object.values(LS_KEYS).forEach(k => localStorage.removeItem(k));
}

/* ─── Default state values ───────────────────────────────────────────── */
const DEFAULT_ACCOUNT = { firstName: "", lastName: "", email: "", password: "", confirmPassword: "", terms: false };
const DEFAULT_CONTACT = { phone: "", address: "", city: "", state: "", zip: "" };
const DEFAULT_VEHICLE = { make: "", model: "", year: "", color: "", plate: "", vin: "", rideTypes: [] };
const DEFAULT_DOC = {
  licenseFront: false, licenseFrontUrl: "",
  licenseBack:  false, licenseBackUrl:  "",
  licenseNumber: "",
  registration:  false, registrationUrl: "",
  insurance:     false, insuranceUrl:    "",
  profilePhoto:  false, profilePhotoUrl: "",
};

const COMPLETED_STATUSES = ["approved", "online", "active", "suspended", "offline"];
const MAX_VEHICLE_YEAR   = new Date().getFullYear() + 1;

/* ─── Vehicle colors ─────────────────────────────────────────────────── */
const VEHICLE_COLORS = [
  { value: "Black",  label: "Black",       hex: "#0F0F10" },
  { value: "White",  label: "White",       hex: "#FAFAF7" },
  { value: "Silver", label: "Silver",      hex: "#C0C5CC" },
  { value: "Gray",   label: "Gray",        hex: "#6B7280" },
  { value: "Red",    label: "Red",         hex: "#DC2626" },
  { value: "Blue",   label: "Blue",        hex: "#2563EB" },
  { value: "Navy",   label: "Navy",        hex: "#1E3A8A" },
  { value: "Green",  label: "Green",       hex: "#16A34A" },
  { value: "Yellow", label: "Yellow",      hex: "#F59E0B" },
  { value: "Orange", label: "Orange",      hex: "#EA580C" },
  { value: "Brown",  label: "Brown",       hex: "#78350F" },
  { value: "Beige",  label: "Beige / Tan", hex: "#D4C5A0" },
  { value: "Gold",   label: "Gold",        hex: "#D4AF37" },
  { value: "Purple", label: "Purple",      hex: "#7C3AED" },
  { value: "Maroon", label: "Maroon",      hex: "#7F1D1D" },
  { value: "Other",  label: "Other",       hex: "#9CA3AF" },
];

/* ─── Year options ───────────────────────────────────────────────────── */
const VEHICLE_YEARS = (() => {
  const years = [{ value: "", label: "Select year…" }];
  for (let y = MAX_VEHICLE_YEAR; y >= 2005; y--) years.push({ value: String(y), label: String(y) });
  return years;
})();

/* ─── UaTob SVG Icon ─────────────────────────────────────────────────── */
function UaTobIcon({ size = 38 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="si-bg"   x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#FFFFFF"/><stop offset="100%" stopColor="#F3F4F6"/></linearGradient>
        <linearGradient id="si-road" x1="0" y1="0" x2="64" y2="0"  gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#111827"/><stop offset="100%" stopColor="#16A34A"/></linearGradient>
        <linearGradient id="si-car"  x1="0" y1="0" x2="1"  y2="1"><stop offset="0%" stopColor="#16A34A"/><stop offset="100%" stopColor="#15803D"/></linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#si-bg)"/>
      <rect x="0.5" y="0.5" width="63" height="63" rx="13.5" stroke="#E5E7EB" strokeWidth="1"/>
      <path d="M 10 46 Q 32 28 54 46" stroke="url(#si-road)" strokeWidth="2" strokeDasharray="4 3.5" strokeLinecap="round" fill="none" opacity="0.6"/>
      <circle cx="10" cy="46" r="5" fill="#111827" fillOpacity="0.12"/><circle cx="10" cy="46" r="3" fill="#111827"/>
      <text x="10" y="49" textAnchor="middle" fontFamily="system-ui" fontWeight="900" fontSize="4" fill="#fff">A</text>
      <circle cx="54" cy="46" r="5" fill="#16A34A" fillOpacity="0.18"/><circle cx="54" cy="46" r="3" fill="#16A34A"/>
      <text x="54" y="49" textAnchor="middle" fontFamily="system-ui" fontWeight="900" fontSize="4" fill="#fff">B</text>
      <g transform="translate(26,22)">
        <ellipse cx="6" cy="13" rx="7" ry="1.5" fill="#111827" opacity="0.1"/>
        <rect x="1" y="5" width="10" height="6" rx="1.5" fill="url(#si-car)"/>
        <path d="M2.5 5 L3.5 2 L8.5 2 L9.5 5Z" fill="#15803D"/>
        <rect x="3.5" y="2.3" width="2" height="1.8" rx="0.4" fill="#fff" fillOpacity="0.85"/>
        <rect x="6.5" y="2.3" width="2" height="1.8" rx="0.4" fill="#fff" fillOpacity="0.85"/>
        <circle cx="3" cy="11" r="1.7" fill="#111827"/><circle cx="3" cy="11" r="0.85" fill="#16A34A"/>
        <circle cx="9" cy="11" r="1.7" fill="#111827"/><circle cx="9" cy="11" r="0.85" fill="#22C55E"/>
        <rect x="10.2" y="6.5" width="1.5" height="1" rx="0.5" fill="#FCD34D" opacity="0.9"/>
      </g>
    </svg>
  );
}

/* ─── Design tokens ──────────────────────────────────────────────────── */
const C = {
  bg: "#FAFAF7", surface: "#FFFFFF", surfaceRaised: "#F9FAF7",
  surfaceBright: "#F3F4F0", border: "#E8E6DD", borderBright: "#D8D5CC",
  accent: "#16A34A", accentDim: "#15803D", accentGlow: "rgba(22,163,74,.1)",
  accentBorder: "rgba(22,163,74,.22)", text: "#0F0F10", textMid: "#5A5A52",
  textDim: "#9A988E", red: "#DC2626", blue: "#2563EB", green: "#16A34A",
  purple: "#7C3AED", amber: "#D97706",
};

const STEPS = [
  { id: 1, label: "Account",   icon: User },
  { id: 2, label: "Contact",   icon: Phone },
  { id: 3, label: "Vehicle",   icon: Car },
  { id: 4, label: "Documents", icon: FileText },
  { id: 5, label: "Verify",    icon: Shield },
];

const ALL_STATES = [
  { value: "",   label: "Select state…" },
  { value: "AL", label: "Alabama" },        { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },        { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },     { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },    { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },        { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },         { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },       { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },           { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },       { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },          { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },      { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },       { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },       { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },     { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" }, { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },           { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },         { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },   { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },   { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },          { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },        { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },     { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },      { value: "WY", label: "Wyoming" },
];

/* ─── Password strength ──────────────────────────────────────────────── */
function getPasswordStrength(pw = "") {
  if (!pw) return { score: 0, label: "", color: C.border };
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw))              score++;
  if (/[^a-zA-Z0-9]/.test(pw))   score++;
  if (score <= 1) return { score: 1, label: "Weak",      color: C.red   };
  if (score <= 2) return { score: 2, label: "Fair",      color: C.amber };
  if (score <= 3) return { score: 3, label: "Good",      color: C.blue  };
  if (score <= 4) return { score: 4, label: "Strong",    color: C.green };
  return               { score: 5, label: "Excellent", color: C.green };
}

/* ─── Field components ───────────────────────────────────────────────── */
function InputField({ label, placeholder, type = "text", icon: Icon, value, onChange, error, hint, suffix, valid, autoCapitalize }) {
  const [focused, setFocused] = useState(false);
  const [showPw,  setShowPw]  = useState(false);
  const isPw = type === "password";
  const showValid = valid && value && !error && !focused;

  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <div style={{
          fontSize: 11, fontWeight: 700,
          color: focused ? C.accent : error ? C.red : C.textMid,
          marginBottom: 7, letterSpacing: "1.5px", textTransform: "uppercase",
          fontFamily: "'Barlow Condensed', sans-serif", transition: "color .2s",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span>{label}</span>
          {showValid && <Check size={11} color={C.green} strokeWidth={2.6}/>}
        </div>
      )}
      <div style={{ position: "relative" }}>
        {Icon && (
          <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", zIndex: 1, pointerEvents: "none" }}>
            <Icon size={15} color={focused ? C.accent : error ? C.red : C.textDim} style={{ transition: "color .2s" }}/>
          </div>
        )}
        <input
          type={isPw && showPw ? "text" : type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(autoCapitalize ? e.target.value.toUpperCase() : e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%", background: C.surface,
            border: `1.5px solid ${error ? C.red : focused ? C.accent : showValid ? "rgba(22,163,74,.35)" : C.border}`,
            borderRadius: 13, padding: `13px ${isPw || suffix ? 44 : 14}px 13px ${Icon ? 42 : 14}px`,
            color: C.text, fontFamily: "'Barlow', sans-serif", fontSize: 14, fontWeight: 500,
            outline: "none", transition: "border-color .2s, box-shadow .2s",
            boxShadow: focused ? `0 0 0 4px rgba(22,163,74,.12)` : error ? `0 0 0 3px rgba(220,38,38,.07)` : "none",
          }}
        />
        {isPw && (
          <button type="button" onClick={() => setShowPw(p => !p)} style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.textDim, display: "flex", padding: 2 }}>
            {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
          </button>
        )}
        {suffix && !isPw && (
          <div style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.textDim, fontWeight: 600, pointerEvents: "none" }}>
            {suffix}
          </div>
        )}
      </div>
      {error && (
        <div style={{ fontSize: 11.5, color: C.red, marginTop: 5, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          <AlertCircle size={11}/>{error}
        </div>
      )}
      {hint && !error && (
        <div style={{ fontSize: 11, color: C.textDim, marginTop: 5, fontWeight: 500 }}>{hint}</div>
      )}
    </div>
  );
}

function SelectField({ label, value, onChange, options, icon: Icon, error }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 700, color: focused ? C.accent : error ? C.red : C.textMid, marginBottom: 7, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif", transition: "color .2s" }}>
          {label}
        </div>
      )}
      <div style={{ position: "relative" }}>
        {Icon && (
          <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <Icon size={15} color={focused ? C.accent : C.textDim}/>
          </div>
        )}
        <select
          value={value} onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{
            width: "100%", background: C.surface,
            border: `1.5px solid ${error ? C.red : focused ? C.accent : C.border}`,
            borderRadius: 13, padding: `13px 36px 13px ${Icon ? 42 : 14}px`,
            color: value ? C.text : C.textDim,
            fontFamily: "'Barlow', sans-serif", fontSize: 14, fontWeight: 500, outline: "none",
            appearance: "none", cursor: "pointer", transition: "border-color .2s",
            boxShadow: focused ? `0 0 0 4px rgba(22,163,74,.12)` : "none",
          }}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={14} color={C.textDim} style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}/>
      </div>
      {error && (
        <div style={{ fontSize: 11.5, color: C.red, marginTop: 5, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          <AlertCircle size={11}/>{error}
        </div>
      )}
    </div>
  );
}

function ColorPickerField({ label, value, onChange, error }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const selected = VEHICLE_COLORS.find(c => c.value === value);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div style={{ marginBottom: 16, position: "relative" }} ref={wrapRef}>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 700, color: open ? C.accent : error ? C.red : C.textMid, marginBottom: 7, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif", transition: "color .2s" }}>
          {label}
        </div>
      )}
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        width: "100%", background: C.surface,
        border: `1.5px solid ${error ? C.red : open ? C.accent : C.border}`,
        borderRadius: 13, padding: "12px 14px",
        fontFamily: "'Barlow', sans-serif", fontSize: 14, fontWeight: 500,
        color: selected ? C.text : C.textDim,
        outline: "none", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 12,
        transition: "all .2s", textAlign: "left",
        boxShadow: open ? `0 0 0 4px rgba(22,163,74,.12)` : "none",
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 8,
          background: selected
            ? selected.hex
            : `repeating-linear-gradient(45deg, ${C.borderBright}, ${C.borderBright} 4px, ${C.surfaceBright} 4px, ${C.surfaceBright} 8px)`,
          border: `1.5px solid ${selected ? "rgba(0,0,0,0.15)" : C.border}`,
          flexShrink: 0,
          boxShadow: selected ? "inset 0 1px 2px rgba(0,0,0,0.15), inset 0 -1px 1px rgba(255,255,255,0.2)" : "none",
        }}/>
        <span style={{ flex: 1 }}>{selected ? selected.label : "Select color…"}</span>
        <ChevronDown size={14} color={C.textDim} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}/>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 14, padding: 6,
          maxHeight: 280, overflowY: "auto",
          boxShadow: "0 12px 32px rgba(0,0,0,.12), 0 4px 12px rgba(0,0,0,.06)",
          zIndex: 50, animation: "dsFadeDown .18s cubic-bezier(.34,1.2,.64,1) both",
        }}>
          {VEHICLE_COLORS.map(c => {
            const isSel = c.value === value;
            return (
              <button key={c.value} type="button" onClick={() => { onChange(c.value); setOpen(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: "9px 10px", border: "none", borderRadius: 10,
                  background: isSel ? C.accentGlow : "transparent",
                  cursor: "pointer", fontFamily: "inherit",
                  fontSize: 14, fontWeight: 600,
                  color: isSel ? C.accent : C.text,
                  textAlign: "left", transition: "background .12s",
                }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = C.surfaceBright; }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ width: 22, height: 22, borderRadius: 7, background: c.hex, border: `1.5px solid ${c.hex === "#FAFAF7" ? C.border : "rgba(0,0,0,0.12)"}`, flexShrink: 0, boxShadow: "inset 0 1px 2px rgba(0,0,0,0.1), inset 0 -1px 1px rgba(255,255,255,0.15)" }}/>
                <span style={{ flex: 1 }}>{c.label}</span>
                {isSel && <Check size={14} color={C.accent} strokeWidth={2.6}/>}
              </button>
            );
          })}
        </div>
      )}
      {error && (
        <div style={{ fontSize: 11.5, color: C.red, marginTop: 5, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          <AlertCircle size={11}/>{error}
        </div>
      )}
    </div>
  );
}

function PasswordStrengthMeter({ password }) {
  const { score, label, color } = getPasswordStrength(password);
  if (!password) return null;
  return (
    <div style={{ marginTop: -10, marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= score ? color : C.surfaceBright, transition: "background .25s, transform .25s", transform: i <= score ? "scaleY(1)" : "scaleY(0.7)" }}/>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em" }}>
        <span style={{ color: C.textDim }}>Password strength</span>
        <span style={{ color }}>{label}</span>
      </div>
    </div>
  );
}

function UploadBox({ label, hint, icon: Icon = Upload, uploaded, previewUrl, uploading, progress = 0, error, onFileSelect, onRemove }) {
  const inputRef = useRef(null);
  const isPdf = previewUrl && previewUrl.startsWith("data:application/pdf");

  return (
    <div style={{ marginBottom: 12 }}>
      <div onClick={() => !uploading && inputRef.current?.click()} style={{
        background: uploaded ? "rgba(22,163,74,.04)" : uploading ? "rgba(22,163,74,.02)" : C.surfaceRaised,
        border: `1.5px dashed ${error ? C.red : uploaded ? "rgba(22,163,74,.4)" : uploading ? C.accent : C.border}`,
        borderRadius: 16, padding: previewUrl && !isPdf ? "12px 18px 18px" : "22px 18px",
        cursor: uploading ? "default" : "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        transition: "all .25s", textAlign: "center", position: "relative", overflow: "hidden",
      }}>
        <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" capture={false} style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelect(f); e.target.value = ""; }}/>

        {previewUrl && !isPdf && (
          <div style={{ width: "100%", position: "relative" }}>
            <img src={previewUrl} alt="preview" style={{ width: "100%", maxHeight: 120, objectFit: "cover", borderRadius: 10, display: "block" }}/>
            {!uploading && onRemove && (
              <button type="button" onClick={e => { e.stopPropagation(); onRemove(); }} style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,.55)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={12} color="#fff"/>
              </button>
            )}
          </div>
        )}

        {isPdf && (
          <div style={{ width: "100%", background: "rgba(37,99,235,.07)", border: "1px solid rgba(37,99,235,.18)", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <FileText size={16} color={C.blue}/>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: C.blue }}>PDF uploaded</span>
            {!uploading && onRemove && (
              <button type="button" onClick={e => { e.stopPropagation(); onRemove(); }} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: C.textDim, display: "flex" }}>
                <X size={14}/>
              </button>
            )}
          </div>
        )}

        <div style={{ width: 44, height: 44, background: uploaded ? "rgba(22,163,74,.12)" : uploading ? C.accentGlow : C.surfaceBright, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .2s", flexShrink: 0 }}>
          {uploading ? (
            <svg width="28" height="28" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke={C.border} strokeWidth="4"/>
              <circle cx="22" cy="22" r="18" fill="none" stroke={C.accent} strokeWidth="4" strokeDasharray={`${(progress/100)*113} 113`} strokeLinecap="round" style={{ transformOrigin: "center", transform: "rotate(-90deg)", transition: "stroke-dasharray .3s" }}/>
            </svg>
          ) : uploaded ? <Check size={20} color={C.green}/> : <Icon size={20} color={C.textMid}/>}
        </div>

        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: uploading ? C.accent : uploaded ? C.green : C.text, marginBottom: 3 }}>
            {uploading ? `Uploading… ${progress}%` : uploaded ? `Uploaded ✓ — tap to replace` : label}
          </div>
          <div style={{ fontSize: 11.5, color: C.textDim, fontWeight: 500 }}>{hint}</div>
        </div>
      </div>
      {error && (
        <div style={{ fontSize: 11.5, color: C.red, marginTop: 5, fontWeight: 600, display: "flex", alignItems: "center", gap: 4, paddingLeft: 2 }}>
          <AlertCircle size={11}/>{error}
        </div>
      )}
    </div>
  );
}

/* ─── Step components ────────────────────────────────────────────────── */
function StepAccount({ data, setData, errors }) {
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);
  return (
    <div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <InputField label="First Name" placeholder="Marcus" icon={User} value={data.firstName} onChange={v => setData(d => ({ ...d, firstName: v }))} error={errors.firstName} valid={data.firstName.trim().length > 0}/>
        </div>
        <div style={{ flex: 1 }}>
          <InputField label="Last Name" placeholder="Johnson" value={data.lastName} onChange={v => setData(d => ({ ...d, lastName: v }))} error={errors.lastName} valid={data.lastName.trim().length > 0}/>
        </div>
      </div>
      <InputField label="Email Address" placeholder="marcus@example.com" type="email" icon={Mail} value={data.email} onChange={v => setData(d => ({ ...d, email: v }))} error={errors.email} valid={validEmail}/>
      <InputField label="Password" placeholder="Min. 8 characters" type="password" icon={Lock} value={data.password} onChange={v => setData(d => ({ ...d, password: v }))} error={errors.password}/>
      <PasswordStrengthMeter password={data.password}/>
      <InputField label="Confirm Password" placeholder="Re-enter password" type="password" icon={Lock} value={data.confirmPassword} onChange={v => setData(d => ({ ...d, confirmPassword: v }))} error={errors.confirmPassword} valid={data.confirmPassword && data.password === data.confirmPassword}/>

      <div onClick={() => setData(d => ({ ...d, terms: !d.terms }))} style={{
        background: data.terms ? "rgba(22,163,74,.05)" : C.surfaceRaised,
        border: `1.5px solid ${data.terms ? "rgba(22,163,74,.3)" : errors.terms ? C.red : C.border}`,
        borderRadius: 14, padding: "14px 16px",
        display: "flex", gap: 12, alignItems: "flex-start",
        cursor: "pointer", transition: "all .2s",
      }}>
        <div style={{ width: 22, height: 22, borderRadius: 7, border: `2px solid ${data.terms ? C.accent : C.border}`, background: data.terms ? C.accent : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1, transition: "all .2s" }}>
          {data.terms && <Check size={13} color="#fff" strokeWidth={3}/>}
        </div>
        <div style={{ fontSize: 12.5, color: C.textMid, fontWeight: 500, lineHeight: 1.6 }}>
          I agree to UaTob's{" "}
          <a href="/driver-terms" onClick={e => e.stopPropagation()} style={{ color: C.accent, fontWeight: 700, textDecoration: "none" }}>Driver Terms</a>
          {" "}and{" "}
          <a href="/privacy-policy" onClick={e => e.stopPropagation()} style={{ color: C.accent, fontWeight: 700, textDecoration: "none" }}>Privacy Policy</a>
        </div>
      </div>
      {errors.terms && (
        <div style={{ fontSize: 11.5, color: C.red, marginTop: 6, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          <AlertCircle size={11}/>{errors.terms}
        </div>
      )}
    </div>
  );
}

function StepContact({ data, setData, errors }) {
  return (
    <div>
      <InputField label="Mobile Number" placeholder="+1 (555) 000-0000" type="tel" icon={Phone} value={data.phone} onChange={v => setData(d => ({ ...d, phone: v }))} error={errors.phone} hint="We'll send a verification code to this number."/>
      <InputField label="Street Address" placeholder="123 Main Street, Apt 4B" icon={MapPin} value={data.address} onChange={v => setData(d => ({ ...d, address: v }))} error={errors.address}/>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1.2 }}>
          <InputField label="City" placeholder="Orlando" value={data.city} onChange={v => setData(d => ({ ...d, city: v }))} error={errors.city}/>
        </div>
        <div style={{ flex: 0.8 }}>
          <InputField label="ZIP Code" placeholder="32801" value={data.zip} onChange={v => setData(d => ({ ...d, zip: v }))} error={errors.zip}/>
        </div>
      </div>
      <SelectField label="State" icon={MapPin} value={data.state} onChange={v => setData(d => ({ ...d, state: v }))} options={ALL_STATES} error={errors.state}/>
      <div style={{ background: "linear-gradient(135deg, rgba(22,163,74,.05), rgba(22,163,74,.02))", border: "1px solid rgba(22,163,74,.2)", borderRadius: 14, padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, rgba(22,163,74,.18), rgba(22,163,74,.08))", border: "1px solid rgba(22,163,74,.25)", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Phone size={15} color={C.accent}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "#15803D", marginBottom: 2 }}>SMS verification on next step</div>
          <div style={{ fontSize: 11.5, color: C.textMid, fontWeight: 500 }}>We'll send a 6-digit code to confirm your number.</div>
        </div>
      </div>
    </div>
  );
}

function StepVehicle({ data, setData, errors }) {
  const RIDE_TYPES = [
    { id: "economy",  label: "Economy",  desc: "Budget rides", c: "#16A34A", Icon: Car   },
    { id: "standard", label: "Standard", desc: "4 passengers", c: "#2563EB", Icon: Car   },
    { id: "xl",       label: "XL",       desc: "6 passengers", c: "#D97706", Icon: Users },
    { id: "premium",  label: "Premium",  desc: "Luxury cars",  c: "#7C3AED", Icon: Crown },
  ];
  return (
    <div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <SelectField label="Make" icon={Car} value={data.make} onChange={v => setData(d => ({ ...d, make: v }))} options={[
            { value: "", label: "Select…" }, { value: "Toyota", label: "Toyota" }, { value: "Honda", label: "Honda" },
            { value: "Ford", label: "Ford" }, { value: "Chevrolet", label: "Chevrolet" }, { value: "Tesla", label: "Tesla" },
            { value: "BMW", label: "BMW" }, { value: "Mercedes", label: "Mercedes" }, { value: "Hyundai", label: "Hyundai" },
            { value: "Kia", label: "Kia" }, { value: "Nissan", label: "Nissan" }, { value: "Subaru", label: "Subaru" },
            { value: "Volkswagen", label: "Volkswagen" }, { value: "Jeep", label: "Jeep" }, { value: "Other", label: "Other" },
          ]}/>
        </div>
        <div style={{ flex: 1 }}>
          <InputField label="Model" placeholder="Camry, Civic…" value={data.model} onChange={v => setData(d => ({ ...d, model: v }))} error={errors.model}/>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <SelectField label="Year" icon={Calendar} value={data.year} onChange={v => setData(d => ({ ...d, year: v }))} options={VEHICLE_YEARS} error={errors.year}/>
        </div>
        <div style={{ flex: 1 }}>
          <ColorPickerField label="Color" value={data.color} onChange={v => setData(d => ({ ...d, color: v }))} error={errors.color}/>
        </div>
      </div>
      <InputField label="License Plate" placeholder="ABC-1234" icon={CreditCard} value={data.plate} onChange={v => setData(d => ({ ...d, plate: v }))} error={errors.plate} hint="Enter as shown on your registration." autoCapitalize/>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, marginBottom: 10, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>Ride Types You Can Offer</span>
          {data.rideTypes?.length > 0 && <span style={{ fontSize: 10, color: C.accent, letterSpacing: 0, fontFamily: "'Barlow', sans-serif", textTransform: "none" }}>{data.rideTypes.length} selected</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {RIDE_TYPES.map(rt => {
            const selected = data.rideTypes?.includes(rt.id);
            const Icon = rt.Icon;
            return (
              <div key={rt.id} onClick={() => setData(d => { const cur = d.rideTypes || []; return { ...d, rideTypes: selected ? cur.filter(r => r !== rt.id) : [...cur, rt.id] }; })} style={{ background: selected ? `linear-gradient(135deg, ${rt.c}10, ${rt.c}04)` : C.surfaceRaised, border: `1.5px solid ${selected ? rt.c + "50" : C.border}`, borderRadius: 14, padding: "12px 14px", cursor: "pointer", transition: "all .2s", position: "relative", display: "flex", alignItems: "center", gap: 10, boxShadow: selected ? `0 4px 12px ${rt.c}15` : "none" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: selected ? `linear-gradient(135deg, ${rt.c}, ${rt.c}DD)` : C.surfaceBright, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: selected ? `0 3px 8px ${rt.c}40` : "none", transition: "all .2s" }}>
                  <Icon size={16} color={selected ? "#fff" : C.textDim} strokeWidth={2.2}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: selected ? rt.c : C.text, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: ".3px" }}>{rt.label}</div>
                  <div style={{ fontSize: 10.5, color: C.textDim, fontWeight: 600, marginTop: 1 }}>{rt.desc}</div>
                </div>
                {selected && (
                  <div style={{ position: "absolute", top: 6, right: 6, width: 16, height: 16, borderRadius: "50%", background: rt.c, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 4px ${rt.c}50` }}>
                    <Check size={9} color="#fff" strokeWidth={3.2}/>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {errors.rideTypes && (
          <div style={{ fontSize: 11.5, color: C.red, marginTop: 6, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            <AlertCircle size={11}/>{errors.rideTypes}
          </div>
        )}
      </div>

      <InputField label="Vehicle VIN" placeholder="1HGBH41JXMN109186" icon={Hash} value={data.vin} onChange={v => setData(d => ({ ...d, vin: v }))} hint="17-character Vehicle Identification Number (optional)" autoCapitalize/>
    </div>
  );
}

function StepDocuments({ data, setData, errors, uid }) {
  const [uploadState, setUploadState] = useState({
    licenseFront: { uploading: false, progress: 0, localPreview: "" },
    licenseBack:  { uploading: false, progress: 0, localPreview: "" },
    registration: { uploading: false, progress: 0, localPreview: "" },
    insurance:    { uploading: false, progress: 0, localPreview: "" },
    profilePhoto: { uploading: false, progress: 0, localPreview: "" },
  });

  const setSlot = useCallback((slot, patch) => setUploadState(s => ({ ...s, [slot]: { ...s[slot], ...patch } })), []);

  const uploadFile = useCallback(async (slot, file) => {
    if (!uid) { console.warn("No UID yet"); return; }
    let localPreview = "";
    if (file.type.startsWith("image/")) localPreview = URL.createObjectURL(file);
    else if (file.type === "application/pdf") localPreview = "data:application/pdf;placeholder";
    setSlot(slot, { uploading: true, progress: 0, localPreview });
    try {
      const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!allowed.includes(file.type)) { setSlot(slot, { uploading: false, progress: 0, localPreview: "" }); return; }
      const ext  = file.name.split(".").pop();
      const path = `drivers/${uid}/documents/${slot}_${Date.now()}.${ext}`;
      const task = uploadBytesResumable(ref(storage, path), file);
      await new Promise((res, rej) => { task.on("state_changed", snap => setSlot(slot, { progress: Math.round((snap.bytesTransferred / snap.totalBytes) * 100) }), rej, res); });
      const url = await getDownloadURL(task.snapshot.ref);
      setData(d => ({ ...d, [slot]: true, [`${slot}Url`]: url }));
      setSlot(slot, { uploading: false, progress: 100, localPreview: url });
    } catch (err) {
      console.error(`Upload failed for ${slot}:`, err);
      setSlot(slot, { uploading: false, progress: 0, localPreview: "" });
    }
  }, [uid, setData, setSlot]);

  const removeSlot = useCallback((slot) => {
    setData(d => ({ ...d, [slot]: false, [`${slot}Url`]: "" }));
    setSlot(slot, { uploading: false, progress: 0, localPreview: "" });
  }, [setData, setSlot]);

  const preview = (slot) => uploadState[slot].localPreview || data[`${slot}Url`] || "";

  const SectionLabel = ({ children, icon: Icon }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, color: C.textMid, marginBottom: 12, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif" }}>
      {Icon && <Icon size={12} color={C.textDim} strokeWidth={2.2}/>}
      {children}
    </div>
  );
  const Divider = () => <div style={{ height: 1, background: C.border, margin: "4px 0 18px" }}/>;

  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, rgba(37,99,235,.04), rgba(37,99,235,.02))", border: "1px solid rgba(37,99,235,.20)", borderRadius: 16, padding: "14px 16px", marginBottom: 20, display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ width: 36, height: 36, borderRadius: 11, background: "rgba(37,99,235,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Shield size={16} color={C.blue} strokeWidth={2.2}/>
        </div>
        <div style={{ fontSize: 12.5, color: C.textMid, lineHeight: 1.55 }}>
          All documents are <strong style={{ color: C.text }}>encrypted and stored securely</strong>. Used only for verification.
        </div>
      </div>

      <SectionLabel icon={CreditCard}>Driver's License</SectionLabel>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <UploadBox label="Front Side" hint="Tap to upload photo" icon={Camera} uploaded={data.licenseFront} previewUrl={preview("licenseFront")} uploading={uploadState.licenseFront.uploading} progress={uploadState.licenseFront.progress} error={errors?.licenseFront} onFileSelect={f => uploadFile("licenseFront", f)} onRemove={() => removeSlot("licenseFront")}/>
        </div>
        <div style={{ flex: 1 }}>
          <UploadBox label="Back Side" hint="Tap to upload photo" icon={Camera} uploaded={data.licenseBack} previewUrl={preview("licenseBack")} uploading={uploadState.licenseBack.uploading} progress={uploadState.licenseBack.progress} error={errors?.licenseBack} onFileSelect={f => uploadFile("licenseBack", f)} onRemove={() => removeSlot("licenseBack")}/>
        </div>
      </div>
      <InputField label="License Number" placeholder="D1234567" icon={FileText} value={data.licenseNumber} onChange={v => setData(d => ({ ...d, licenseNumber: v }))} hint="As shown on your license" error={errors?.licenseNumber} autoCapitalize/>
      <Divider/>
      <SectionLabel icon={Car}>Vehicle Registration &amp; Insurance</SectionLabel>
      <UploadBox label="Vehicle Registration" hint="Photo or PDF accepted" icon={FileText} uploaded={data.registration} previewUrl={preview("registration")} uploading={uploadState.registration.uploading} progress={uploadState.registration.progress} error={errors?.registration} onFileSelect={f => uploadFile("registration", f)} onRemove={() => removeSlot("registration")}/>
      <UploadBox label="Proof of Insurance" hint="Must be current &amp; valid" icon={Shield} uploaded={data.insurance} previewUrl={preview("insurance")} uploading={uploadState.insurance.uploading} progress={uploadState.insurance.progress} error={errors?.insurance} onFileSelect={f => uploadFile("insurance", f)} onRemove={() => removeSlot("insurance")}/>
      <Divider/>
      <SectionLabel icon={User}>Profile Photo</SectionLabel>
      <UploadBox label="Your Photo" hint="Clear, recent headshot · No sunglasses" icon={Camera} uploaded={data.profilePhoto} previewUrl={preview("profilePhoto")} uploading={uploadState.profilePhoto.uploading} progress={uploadState.profilePhoto.progress} error={errors?.profilePhoto} onFileSelect={f => uploadFile("profilePhoto", f)} onRemove={() => removeSlot("profilePhoto")}/>
    </div>
  );
}

function StepVerify({ accountData, contactData, vehicleData, docData }) {
  const allDocs = docData.licenseFront && docData.licenseBack && docData.registration && docData.insurance && docData.profilePhoto;
  const colorMeta = VEHICLE_COLORS.find(c => c.value === vehicleData.color);

  const Section = ({ title, items, icon: Icon }) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, color: C.textMid, marginBottom: 10, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif", paddingLeft: 4 }}>
        {Icon && <Icon size={11} color={C.textDim} strokeWidth={2.2}/>}
        {title}
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
        {items.map((item, i) => (
          <div key={i} style={{ padding: "12px 16px", borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12.5, color: C.textMid, fontWeight: 500 }}>{item.label}</span>
            <span style={{ fontSize: 13, color: item.val ? C.text : C.textDim, fontWeight: 600, maxWidth: "60%", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
              {item.swatch && <div style={{ width: 14, height: 14, borderRadius: 4, background: item.swatch, border: "1px solid rgba(0,0,0,.15)", flexShrink: 0 }}/>}
              {item.val || "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ background: allDocs ? "linear-gradient(135deg, rgba(22,163,74,.08), rgba(22,163,74,.03))" : "linear-gradient(135deg, rgba(217,119,6,.08), rgba(217,119,6,.03))", border: `1.5px solid ${allDocs ? "rgba(22,163,74,.3)" : "rgba(217,119,6,.3)"}`, borderRadius: 18, padding: "18px 20px", marginBottom: 22, display: "flex", gap: 14, alignItems: "center" }}>
        <div style={{ width: 44, height: 44, background: allDocs ? "linear-gradient(135deg,#22C55E,#16A34A)" : "linear-gradient(135deg,#F59E0B,#D97706)", borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: allDocs ? "0 6px 16px rgba(22,163,74,.35)" : "0 6px 16px rgba(217,119,6,.35)" }}>
          {allDocs ? <CheckCircle size={20} color="#fff"/> : <Clock size={20} color="#fff"/>}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 900, fontFamily: "'Barlow Condensed', sans-serif", color: allDocs ? "#15803D" : "#92400E", marginBottom: 2 }}>
            {allDocs ? "Ready to submit ✓" : "Some documents missing"}
          </div>
          <div style={{ fontSize: 12, color: C.textMid, fontWeight: 500 }}>
            {allDocs ? "All required documents uploaded." : "You can still submit — upload missing docs later."}
          </div>
        </div>
      </div>

      <Section title="Account" icon={User} items={[
        { label: "Name",  val: `${accountData.firstName} ${accountData.lastName}` },
        { label: "Email", val: accountData.email },
      ]}/>
      <Section title="Contact" icon={Phone} items={[
        { label: "Phone",        val: contactData.phone },
        { label: "Address",      val: contactData.address },
        { label: "City / State", val: contactData.city && contactData.state ? `${contactData.city}, ${contactData.state} ${contactData.zip}` : "" },
      ]}/>
      <Section title="Vehicle" icon={Car} items={[
        { label: "Vehicle", val: vehicleData.make && vehicleData.model ? `${vehicleData.year} ${vehicleData.make} ${vehicleData.model}` : "" },
        { label: "Color",   val: vehicleData.color, swatch: colorMeta?.hex },
        { label: "Plate",   val: vehicleData.plate?.toUpperCase() },
        { label: "Tiers",   val: vehicleData.rideTypes?.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(", ") },
      ]}/>
      <Section title="Documents" icon={FileText} items={[
        { label: "Driver's License", val: (docData.licenseFront && docData.licenseBack) ? "✓ Uploaded" : "Pending" },
        { label: "Registration",     val: docData.registration  ? "✓ Uploaded" : "Pending" },
        { label: "Insurance",        val: docData.insurance     ? "✓ Uploaded" : "Pending" },
        { label: "Profile Photo",    val: docData.profilePhoto  ? "✓ Uploaded" : "Pending" },
      ]}/>

      {(docData.licenseFrontUrl || docData.profilePhotoUrl) && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, color: C.textMid, marginBottom: 10, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif", paddingLeft: 4 }}>
            <Eye size={11} color={C.textDim} strokeWidth={2.2}/>
            Document Previews
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { url: docData.licenseFrontUrl, label: "License Front" },
              { url: docData.licenseBackUrl,  label: "License Back"  },
              { url: docData.registrationUrl, label: "Registration"  },
              { url: docData.insuranceUrl,    label: "Insurance"     },
              { url: docData.profilePhotoUrl, label: "Profile Photo" },
            ].filter(d => d.url && !d.url.startsWith("data:application/pdf")).map((d, i) => (
              <div key={i} style={{ flex: "1 1 calc(33% - 6px)", minWidth: 90 }}>
                <img src={d.url} alt={d.label} style={{ width: "100%", height: 70, objectFit: "cover", borderRadius: 10, display: "block", border: `1px solid ${C.border}` }}/>
                <div style={{ fontSize: 9.5, color: C.textDim, fontWeight: 700, textAlign: "center", marginTop: 4, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: ".5px", textTransform: "uppercase" }}>{d.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: "linear-gradient(135deg, rgba(22,163,74,.05), rgba(22,163,74,.02))", border: "1px solid rgba(22,163,74,.2)", borderRadius: 14, padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: C.accentGlow, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Zap size={14} color={C.accent} strokeWidth={2.2}/>
        </div>
        <div style={{ fontSize: 12, color: C.textMid, lineHeight: 1.55 }}>
          After submission, our team reviews your application within <strong style={{ color: C.text }}>24–48 hours</strong>. You'll be notified by email.
        </div>
      </div>
    </div>
  );
}

/* ─── Pending screen ─────────────────────────────────────────────────── */
function PendingScreen({ firstName, email }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: '"Barlow", system-ui, sans-serif', color: C.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800;900&family=Barlow+Condensed:wght@500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes scaleIn { from { opacity: 0; transform: scale(.85) } to { opacity: 1; transform: scale(1) } }
        @keyframes fadeUp  { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes pulse   { 0%,100% { opacity: 1 } 50% { opacity: .5 } }
        @keyframes psGlow  { 0%,100% { box-shadow: 0 0 0 0 rgba(22,163,74,.3) } 50% { box-shadow: 0 0 0 16px rgba(22,163,74,0) } }
      `}}/>
      <div style={{ textAlign: "center", maxWidth: 420, width: "100%", animation: "scaleIn .6s cubic-bezier(.34,1.56,.64,1)" }}>
        <div style={{ width: 96, height: 96, background: "linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", boxShadow: "0 12px 32px rgba(22,163,74,.4)", animation: "psGlow 2.5s ease-in-out infinite", position: "relative" }}>
          <CheckCircle size={44} color="#fff" strokeWidth={2.2}/>
          <Sparkles size={14} color="#FCD34D" fill="#FCD34D" strokeWidth={0} style={{ position: "absolute", top: 8, right: 8, filter: "drop-shadow(0 2px 4px rgba(245,158,11,0.5))" }}/>
        </div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 38, fontWeight: 900, color: C.text, letterSpacing: "-1px", marginBottom: 10, lineHeight: 1.1 }}>
          You're in,<br/>{firstName}!
        </div>
        <div style={{ fontSize: 15, color: C.textMid, lineHeight: 1.7, marginBottom: 32 }}>
          Application submitted. Our team is reviewing now —<br/>you'll hear back within <strong style={{ color: C.accent }}>24–48 hours</strong>.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { icon: Mail,  label: "Confirmation sent to", val: email,                      c: C.blue   },
            { icon: Clock, label: "Review time",          val: "24–48 hours",               c: C.accent },
            { icon: Zap,   label: "Once approved",        val: "Start earning immediately", c: C.green  },
          ].map((item, i) => (
            <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "13px 16px", display: "flex", gap: 12, alignItems: "center", animation: `fadeUp .5s ease-out ${0.2 + i * 0.1}s both`, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
              <div style={{ width: 36, height: 36, background: `linear-gradient(135deg, ${item.c}18, ${item.c}08)`, border: `1px solid ${item.c}25`, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <item.icon size={16} color={item.c} strokeWidth={2.2}/>
              </div>
              <div style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: C.textDim, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif" }}>{item.label}</div>
                <div style={{ fontSize: 13.5, color: C.text, fontWeight: 700, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.val}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 28, display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.25)", borderRadius: 100, padding: "10px 20px" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B", animation: "pulse 1.5s ease-in-out infinite" }}/>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#B45309", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: ".1em", textTransform: "uppercase" }}>Pending Review</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────── */
export default function UaTobDriverSignup({ uid, driverSignUp }) {
  const router = useRouter();
  const { drivers } = useApplicationSubmitted(uid);
  const { createDriverProfile, saveProgress, submitDriverData } = useCreateDriverProfile();

  const isExistingUser = Boolean(uid);

  const [submitted,        setSubmitted]        = useState(() => lsGet(LS_KEYS.submitted, false));
  const [step,             setStep]             = useState(() => lsGet(LS_KEYS.step, 1));
  const [createdUid,       setCreatedUid]       = useState(() => uid || lsGet(LS_KEYS.uid, null));
  const [accountData,      setAccountData]      = useState(() => { const s = lsGet(LS_KEYS.account, DEFAULT_ACCOUNT); return { ...DEFAULT_ACCOUNT, ...s, password: "", confirmPassword: "" }; });
  const [contactData,      setContactData]      = useState(() => lsGet(LS_KEYS.contact, DEFAULT_CONTACT));
  const [vehicleData,      setVehicleData]      = useState(() => lsGet(LS_KEYS.vehicle, DEFAULT_VEHICLE));
  const [docData,          setDocData]          = useState(() => lsGet(LS_KEYS.doc, DEFAULT_DOC));
  const [direction,        setDirection]        = useState("forward");
  const [animating,        setAnimating]        = useState(false);
  const [errors,           setErrors]           = useState({});
  const [loading,          setLoading]          = useState(false);
  const [submitError,      setSubmitError]      = useState(null);
  const [showResumeBanner, setShowResumeBanner] = useState(() => lsGet(LS_KEYS.step, 1) > 1);
  const [showLoginForm,    setShowLoginForm]    = useState(false);

  const scrollRef         = useRef(null);
  const firestoreHydrated = useRef(false);

  // ── Redirects ──────────────────────────────────────────────────────
  useEffect(() => {
    const driverSignUpStatus = driverSignUp?.status;
    const driversStatus      = drivers?.[0]?.status;
    const shouldRedirect = ["approved","online"].includes(driverSignUpStatus) || ["approved","online"].includes(driversStatus);
    if (shouldRedirect) router.push("/driver");
  }, [driverSignUp?.status, drivers, router]);

  useEffect(() => {
    if (driverSignUp?.status === "pending") { setSubmitted(true); lsSet(LS_KEYS.submitted, true); }
  }, [driverSignUp?.status]);

  // ── Firestore hydration ───────────────────────────────────────────
  useEffect(() => {
    if (!drivers?.length || firestoreHydrated.current) return;
    firestoreHydrated.current = true;
    const driver = drivers[0];
    const savedStep = driver.currentStep ?? 1;
    if (savedStep > 1) { setStep(s => Math.max(s, savedStep)); setShowResumeBanner(true); }
    if (driver.firstName || driver.lastName || driver.email) setAccountData(d => ({ ...d, firstName: driver.firstName || d.firstName, lastName: driver.lastName || d.lastName, email: driver.email || d.email }));
    if (driver.contact)   setContactData(d => ({ ...d, phone: driver.contact.phone || d.phone, address: driver.contact.address || d.address, city: driver.contact.city || d.city, state: driver.contact.state || d.state, zip: driver.contact.zip || d.zip }));
    if (driver.vehicle)   setVehicleData(d => ({ ...d, make: driver.vehicle.make || d.make, model: driver.vehicle.model || d.model, year: driver.vehicle.year || d.year, color: driver.vehicle.color || d.color, plate: driver.vehicle.plate || d.plate, vin: driver.vehicle.vin || d.vin, rideTypes: driver.vehicle.rideTypes || d.rideTypes }));
    if (driver.documents) { const docs = driver.documents; setDocData(d => ({ ...d, licenseFront: docs.licenseFront || d.licenseFront, licenseFrontUrl: docs.licenseFrontUrl || d.licenseFrontUrl, licenseBack: docs.licenseBack || d.licenseBack, licenseBackUrl: docs.licenseBackUrl || d.licenseBackUrl, licenseNumber: docs.licenseNumber || d.licenseNumber, registration: docs.registration || d.registration, registrationUrl: docs.registrationUrl || d.registrationUrl, insurance: docs.insurance || d.insurance, insuranceUrl: docs.insuranceUrl || d.insuranceUrl, profilePhoto: docs.profilePhoto || d.profilePhoto, profilePhotoUrl: docs.profilePhotoUrl || d.profilePhotoUrl })); }
  }, [drivers]);

  useEffect(() => {
    if (!driverSignUp || firestoreHydrated.current || drivers?.length) return;
    firestoreHydrated.current = true;
    const savedStep = driverSignUp.currentStep ?? 1;
    if (savedStep > 1) { setStep(s => Math.max(s, savedStep)); setShowResumeBanner(true); }
    if (driverSignUp.firstName || driverSignUp.lastName || driverSignUp.email) setAccountData(d => ({ ...d, firstName: driverSignUp.firstName || d.firstName, lastName: driverSignUp.lastName || d.lastName, email: driverSignUp.email || d.email }));
    if (driverSignUp.contact)   setContactData(d => ({ ...d, ...driverSignUp.contact }));
    if (driverSignUp.vehicle)   setVehicleData(d => ({ ...d, ...driverSignUp.vehicle }));
    if (driverSignUp.documents) setDocData(d => ({ ...d, ...driverSignUp.documents }));
  }, [driverSignUp, drivers]);

  // ── Persist to localStorage ───────────────────────────────────────
  useEffect(() => { lsSet(LS_KEYS.step, step); }, [step]);
  useEffect(() => { lsSet(LS_KEYS.uid,  createdUid); }, [createdUid]);
  useEffect(() => { const { password, confirmPassword, ...safe } = accountData; lsSet(LS_KEYS.account, safe); }, [accountData]);
  useEffect(() => { lsSet(LS_KEYS.contact, contactData); }, [contactData]);
  useEffect(() => { lsSet(LS_KEYS.vehicle, vehicleData); }, [vehicleData]);
  useEffect(() => { lsSet(LS_KEYS.doc,     docData);     }, [docData]);

  if (driverSignUp && COMPLETED_STATUSES.includes(driverSignUp.status)) return null;

  // ── Validation ────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (step === 1) {
      if (!accountData.firstName.trim()) e.firstName = "Required";
      if (!accountData.lastName.trim())  e.lastName  = "Required";
      if (!accountData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = "Enter a valid email address";
      if (accountData.password.length < 8) e.password = "Password must be at least 8 characters";
      if (accountData.password !== accountData.confirmPassword) e.confirmPassword = "Passwords don't match";
      if (!accountData.terms) e.terms = "You must agree to continue";
    }
    if (step === 2) {
      if (!contactData.phone.trim())   e.phone   = "Required";
      if (!contactData.address.trim()) e.address = "Required";
      if (!contactData.city.trim())    e.city    = "Required";
      if (!contactData.zip.match(/^\d{5}(-\d{4})?$/)) e.zip = "Enter a valid ZIP code";
      if (!contactData.state)          e.state   = "Required";
    }
    if (step === 3) {
      if (!vehicleData.model.trim()) e.model = "Required";
      if (!vehicleData.year || Number(vehicleData.year) < 2005 || Number(vehicleData.year) > MAX_VEHICLE_YEAR) e.year = `Select year between 2005–${MAX_VEHICLE_YEAR}`;
      if (!vehicleData.color) e.color = "Pick a color";
      if (!vehicleData.plate.trim()) e.plate = "Required";
      if (!vehicleData.rideTypes?.length) e.rideTypes = "Select at least one ride type";
    }
    if (step === 4) {
      if (!docData.licenseFront) e.licenseFront = "Required — upload front of license";
      if (!docData.licenseBack)  e.licenseBack  = "Required — upload back of license";
      if (!docData.insurance)    e.insurance    = "Required — upload proof of insurance";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Navigation ────────────────────────────────────────────────────
  const goNext = async () => {
    if (loading || animating || !validate()) return;
    setSubmitError(null);
    try {
      setLoading(true);

      if (step === 1) {
        if (isExistingUser) {
          await saveProgress({ uid, currentStep: 2, accountData: { firstName: accountData.firstName, lastName: accountData.lastName, email: accountData.email }, contact: contactData, vehicle: vehicleData, documents: docData });
        } else if (!createdUid) {
          const { result, error: signUpError } = await signUp(accountData.email.trim().toLowerCase(), accountData.password);
          if (signUpError) throw signUpError;
          const newUid = result.user.uid;
          setCreatedUid(newUid);
          await createDriverProfile(newUid, accountData);
          await saveProgress({ uid: newUid, currentStep: 2, accountData: { firstName: accountData.firstName, lastName: accountData.lastName, email: accountData.email }, contact: contactData, vehicle: vehicleData, documents: docData });
        } else {
          await saveProgress({ uid: createdUid, currentStep: 2, accountData: { firstName: accountData.firstName, lastName: accountData.lastName, email: accountData.email }, contact: contactData, vehicle: vehicleData, documents: docData });
        }
      } else if (step === 2) {
        await saveProgress({ uid: createdUid, currentStep: 3, contact: contactData });
      } else if (step === 3) {
        await saveProgress({ uid: createdUid, currentStep: 4, vehicle: vehicleData });
      } else if (step === 4) {
        await saveProgress({ uid: createdUid, currentStep: 5, documents: docData });
      } else if (step === 5) {
        const id = createdUid;
        if (!id) throw new Error("Missing user ID — please restart signup.");
        await submitDriverData(id, { contactData, vehicleData, docData });
        lsClear();
        lsSet(LS_KEYS.submitted, true);
        setSubmitted(true);
        return;
      }

      setDirection("forward");
      setAnimating(true);
      setTimeout(() => {
        setStep(s => s + 1);
        setErrors({});
        setAnimating(false);
        scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      }, 200);

    } catch (err) {
      console.error("❌ Error:", err);
      if (step === 1 && !isExistingUser) {
        if (err.code === "auth/email-already-in-use") {
          setShowLoginForm(true);
          setSubmitError(null);
          setErrors({});
        } else {
          setErrors({ email: err.message || "Signup failed. Please try again." });
          setShowLoginForm(false);
        }
      } else {
        setSubmitError(err.message || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (animating) return;
    setDirection("back");
    setAnimating(true);
    setTimeout(() => {
      setStep(s => s - 1);
      setErrors({});
      setSubmitError(null);
      setAnimating(false);
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, 200);
  };

  const restartForm = () => {
    lsClear();
    setStep(1); setCreatedUid(uid || null);
    setAccountData(DEFAULT_ACCOUNT); setContactData(DEFAULT_CONTACT);
    setVehicleData(DEFAULT_VEHICLE); setDocData(DEFAULT_DOC);
    setErrors({}); setSubmitError(null);
    setSubmitted(false); setShowResumeBanner(false);
    firestoreHydrated.current = false;
  };

  const pct = ((step - 1) / (STEPS.length - 1)) * 100;

  if (submitted) {
    return (
      <PendingScreen
        firstName={driverSignUp?.firstName ?? accountData.firstName}
        email={driverSignUp?.email         ?? accountData.email}
      />
    );
  }

  const stepTitles = [
    { title: "Create your account",    sub: "Set up your UaTob driver profile." },
    { title: "Where are you located?", sub: "We need your contact and address." },
    { title: "Tell us about your car", sub: "Your vehicle must meet our standards." },
    { title: "Upload your documents",  sub: "Securely upload required IDs." },
    { title: "Review & submit",        sub: "Double-check before submitting." },
  ];

  const mainStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800;900&family=Barlow+Condensed:wght@500;600;700;800;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    input::placeholder { color: ${C.textDim}; }
    select option { background: ${C.surface}; color: ${C.text}; }
    input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
    @keyframes slideForward { from { opacity: 0; transform: translateX(28px)  } to { opacity: 1; transform: translateX(0) } }
    @keyframes slideBack    { from { opacity: 0; transform: translateX(-28px) } to { opacity: 1; transform: translateX(0) } }
    @keyframes fadeOut      { to { opacity: 0 } }
    @keyframes revealUp     { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
    @keyframes greenPulse   { 0%,100% { box-shadow: 0 8px 24px rgba(22,163,74,.3) } 50% { box-shadow: 0 8px 32px rgba(22,163,74,.5) } }
    @keyframes errorShake   { 0%,100% { transform: translateX(0) } 20%,60% { transform: translateX(-6px) } 40%,80% { transform: translateX(6px) } }
    @keyframes slideDown    { from { opacity: 0; transform: translateY(-10px) } to { opacity: 1; transform: translateY(0) } }
    @keyframes spin         { to { transform: rotate(360deg) } }
    @keyframes dsFadeDown   { from { opacity: 0; transform: translateY(-6px) } to { opacity: 1; transform: translateY(0) } }
    .green-btn { background: linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D); border: none; border-radius: 100px; color: #fff; font-family: 'Barlow', sans-serif; font-weight: 800; font-size: 15px; cursor: pointer; transition: all .22s; letter-spacing: .3px; display: flex; align-items: center; justify-content: center; gap: 8px; animation: greenPulse 3s ease-in-out infinite; }
    .green-btn:hover    { transform: translateY(-1px); filter: brightness(1.08); }
    .green-btn:disabled { opacity: .6; cursor: not-allowed; transform: none; animation: none; }
    .ghost-btn { background: ${C.surface}; border: 1.5px solid ${C.border}; border-radius: 100px; color: ${C.textMid}; font-family: 'Barlow', sans-serif; font-weight: 700; font-size: 14px; cursor: pointer; transition: all .2s; display: flex; align-items: center; justify-content: center; gap: 6px; }
    .ghost-btn:hover { border-color: ${C.text}; color: ${C.text}; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${C.surfaceBright}; border-radius: 4px; }
  `;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: '"Barlow", system-ui, sans-serif', color: C.text }}>
      <style dangerouslySetInnerHTML={{ __html: mainStyles }}/>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px 130px", minHeight: "100vh" }}>

        {/* Header */}
        <div style={{ padding: "26px 0 22px", display: "flex", alignItems: "center", gap: 14 }}>
          <UaTobIcon size={42}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 2 }}>UaTob · Driver Signup</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: "-0.5px" }}>Start Driving Today</div>
          </div>
          {(step > 1 || accountData.firstName) && (
            <button type="button" onClick={restartForm} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 100, padding: "7px 12px", fontSize: 11, fontWeight: 700, color: C.textDim, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: ".5px", textTransform: "uppercase", transition: "all .2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.color = C.red; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textDim; }}>
              Start Over
            </button>
          )}
        </div>

        {/* Resume banner */}
        {showResumeBanner && (
          <div style={{ background: "linear-gradient(135deg, rgba(22,163,74,.06), rgba(22,163,74,.02))", border: "1px solid rgba(22,163,74,.25)", borderRadius: 14, padding: "13px 16px", marginBottom: 18, display: "flex", gap: 12, alignItems: "center", animation: "slideDown .3s ease" }}>
            <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, rgba(22,163,74,.18), rgba(22,163,74,.08))", border: "1px solid rgba(22,163,74,.25)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <CheckCircle size={16} color={C.accent} strokeWidth={2.2}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: "#15803D", marginBottom: 2 }}>Welcome back!</div>
              <div style={{ fontSize: 11.5, color: C.textMid, fontWeight: 500 }}>Resuming from step {step} of {STEPS.length}.</div>
            </div>
            <button type="button" onClick={() => setShowResumeBanner(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 22, lineHeight: 1, padding: "0 2px" }}>×</button>
          </div>
        )}

        {/* Progress bar */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ height: 6, background: C.surfaceBright, borderRadius: 100, marginBottom: 16, overflow: "hidden", position: "relative" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#15803D,#16A34A,#22C55E)", borderRadius: 100, transition: "width .5s cubic-bezier(.34,1.2,.64,1)", boxShadow: "0 0 12px rgba(22,163,74,.5)" }}/>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {STEPS.map(s => {
              const done   = step > s.id;
              const active = step === s.id;
              return (
                <div key={s.id} style={{ flex: 1, background: done ? "linear-gradient(135deg, rgba(22,163,74,.12), rgba(22,163,74,.04))" : active ? C.surface : C.surfaceRaised, border: `1.5px solid ${done ? "rgba(22,163,74,.35)" : active ? C.accent : C.border}`, borderRadius: 12, padding: "8px 4px", textAlign: "center", transition: "all .3s", boxShadow: active ? "0 4px 14px rgba(22,163,74,.18)" : "none", transform: active ? "translateY(-1px)" : "translateY(0)" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 4, height: 18 }}>
                    {done ? <Check size={14} color={C.accent} strokeWidth={2.8}/> : <s.icon size={14} color={active ? C.accent : C.textDim} strokeWidth={2.2}/>}
                  </div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 800, color: done || active ? C.accent : C.textDim, letterSpacing: "1px", textTransform: "uppercase" }}>{s.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step title */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: "inline-block", background: C.accentGlow, border: `1px solid ${C.accentBorder}`, borderRadius: 100, padding: "3px 10px", fontSize: 10, fontWeight: 800, color: C.accent, letterSpacing: ".15em", textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 8 }}>
            Step {step} of {STEPS.length}
          </div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 900, color: C.text, letterSpacing: "-0.5px", animation: "revealUp .35s ease-out", lineHeight: 1.1 }}>
            {stepTitles[step - 1].title}
          </div>
          <div style={{ fontSize: 13.5, color: C.textMid, marginTop: 5, fontWeight: 500 }}>{stepTitles[step - 1].sub}</div>
        </div>

        {/* Submit error */}
        {submitError && (
          <div style={{ background: "rgba(220,38,38,.06)", border: "1px solid rgba(220,38,38,.25)", borderRadius: 14, padding: "13px 16px", marginBottom: 18, display: "flex", gap: 10, alignItems: "center", animation: "errorShake .4s ease" }}>
            <AlertCircle size={16} color={C.red} style={{ flexShrink: 0 }}/>
            <div style={{ fontSize: 13, color: C.red, fontWeight: 600 }}>{submitError}</div>
          </div>
        )}

        {/* Step content */}
        <div ref={scrollRef} style={{ animation: animating ? "fadeOut .15s ease forwards" : direction === "forward" ? "slideForward .35s cubic-bezier(.25,.46,.45,.94)" : "slideBack .35s cubic-bezier(.25,.46,.45,.94)" }}>
          {showLoginForm && step === 1 ? (
            <DriverLogin
              email={accountData.email}
              onSuccess={(user) => {
                setCreatedUid(user.uid);
                lsSet(LS_KEYS.uid, user.uid);
                setShowLoginForm(false);
                setAccountData(d => ({ ...d, password: "", confirmPassword: "" }));
                setDirection("forward");
                setAnimating(true);
                setTimeout(() => { setStep(2); setErrors({}); setAnimating(false); scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }, 200);
              }}
              onBackToSignup={() => { setShowLoginForm(false); setAccountData(d => ({ ...d, password: "", confirmPassword: "" })); }}
            />
          ) : (
            <>
              {step === 1 && <StepAccount   data={accountData} setData={setAccountData} errors={errors}/>}
              {step === 2 && <StepContact   data={contactData} setData={setContactData} errors={errors}/>}
              {step === 3 && <StepVehicle   data={vehicleData} setData={setVehicleData} errors={errors}/>}
              {step === 4 && <StepDocuments data={docData}     setData={setDocData}     errors={errors} uid={createdUid || uid}/>}
              {step === 5 && <StepVerify    accountData={accountData} contactData={contactData} vehicleData={vehicleData} docData={docData}/>}
            </>
          )}
        </div>
      </div>

      {/* Sticky bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(250,250,247,.95)", backdropFilter: "blur(24px)", borderTop: `1px solid ${C.border}`, padding: "14px 20px 18px", boxShadow: "0 -8px 32px rgba(0,0,0,.06)" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", gap: 10, alignItems: "center" }}>
          {step > 1 && !showLoginForm && (
            <button type="button" className="ghost-btn" onClick={goBack} style={{ padding: "15px 22px" }}>
              <ChevronLeft size={17}/> Back
            </button>
          )}
          {!showLoginForm && (
            <button type="button" className="green-btn" onClick={goNext} disabled={loading || animating} style={{ flex: 1, padding: "16px 24px" }}>
              {loading
                ? <span>Please wait…</span>
                : step === 5
                  ? <><Sparkles size={16} fill="#fff" strokeWidth={0}/><span>Submit Application</span></>
                  : <><span>Continue</span><ArrowRight size={17}/></>
              }
            </button>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 12 }}>
          {STEPS.map(s => (
            <div key={s.id} style={{ width: step === s.id ? 22 : 6, height: 3, background: step >= s.id ? C.accent : C.surfaceBright, borderRadius: 2, transition: "all .35s cubic-bezier(.34,1.2,.64,1)" }}/>
          ))}
        </div>
      </div>
    </div>
  );
}