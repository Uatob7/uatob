import { useState, useRef, useEffect, useCallback } from "react";
import {
  Car, User, FileText, Shield, Camera, Check, ChevronRight,
  ChevronLeft, Eye, EyeOff, Upload, Phone, Mail, Lock,
  MapPin, Calendar, CreditCard, AlertCircle, Zap,
  CheckCircle, Clock, ArrowRight, X
} from "lucide-react";
import signUp from '@/firebase/auth/signup';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { getFirestore } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";
import { useApplicationSubmitted } from "@/App/SignUp/useApplicationSubmitted";

const db = getFirestore(firebase_app);
const storage = getStorage(firebase_app);

const CLOUD_FUNCTION_URL = "https://createdriverprofile-ady2s2xhhq-uc.a.run.app";

/* ─── localStorage helpers ───────────────────── */
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
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function lsClear() {
  Object.values(LS_KEYS).forEach(k => localStorage.removeItem(k));
}

/* ─── Default state values ───────────────────── */
const DEFAULT_ACCOUNT = { firstName: "", lastName: "", email: "", password: "", confirmPassword: "", terms: false };
const DEFAULT_CONTACT = { phone: "", address: "", city: "", state: "", zip: "" };
const DEFAULT_VEHICLE = { make: "", model: "", year: "", color: "", plate: "", vin: "", rideTypes: [] };
const DEFAULT_DOC = {
  licenseFront:    false, licenseFrontUrl:    "",
  licenseBack:     false, licenseBackUrl:     "",
  licenseNumber:   "",
  registration:    false, registrationUrl:    "",
  insurance:       false, insuranceUrl:       "",
  profilePhoto:    false, profilePhotoUrl:    "",
};

// Statuses that mean the driver has already completed signup
const COMPLETED_STATUSES = ["approved", "online", "active", "suspended", "offline"];

/* ─── UaTob SVG Icon ─────────────────────────── */
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

/* ─── Design tokens ──────────────────────────── */
const C = {
  bg: "#FAFAFA", surface: "#FFFFFF", surfaceRaised: "#F9FAFB",
  surfaceBright: "#F3F4F6", border: "#E5E7EB", borderBright: "#D1D5DB",
  accent: "#16A34A", accentDim: "#15803D", accentGlow: "rgba(22,163,74,.1)",
  accentBorder: "rgba(22,163,74,.22)", text: "#111827", textMid: "#4B5563",
  textDim: "#9CA3AF", red: "#DC2626", blue: "#2563EB", green: "#16A34A",
  purple: "#7C3AED",
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

/* ─── FIELD COMPONENTS ───────────────────────── */

function InputField({ label, placeholder, type = "text", icon: Icon, value, onChange, error, hint, suffix }) {
  const [focused, setFocused] = useState(false);
  const [showPw,  setShowPw]  = useState(false);
  const isPw = type === "password";
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 700, color: focused ? C.accent : C.textMid, marginBottom: 7, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif", transition: "color .2s" }}>
          {label}
        </div>
      )}
      <div style={{ position: "relative" }}>
        {Icon && (
          <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", zIndex: 1, pointerEvents: "none" }}>
            <Icon size={15} color={focused ? C.accent : C.textDim} style={{ transition: "color .2s" }} />
          </div>
        )}
        <input
          type={isPw && showPw ? "text" : type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%", background: C.surface,
            border: `1px solid ${error ? C.red : focused ? C.accent : C.border}`,
            borderRadius: 13, padding: `13px ${isPw || suffix ? 44 : 14}px 13px ${Icon ? 42 : 14}px`,
            color: C.text, fontFamily: "'Barlow', sans-serif", fontSize: 14, fontWeight: 500,
            outline: "none", transition: "border-color .2s, box-shadow .2s",
            boxShadow: focused ? `0 0 0 3px rgba(22,163,74,.1)` : error ? `0 0 0 3px rgba(220,38,38,.07)` : "none",
          }}
        />
        {isPw && (
          <button onClick={() => setShowPw(p => !p)} style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.textDim, display: "flex", padding: 2 }}>
            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
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
          <AlertCircle size={11} />{error}
        </div>
      )}
      {hint && !error && (
        <div style={{ fontSize: 11, color: C.textDim, marginTop: 5, fontWeight: 500 }}>{hint}</div>
      )}
    </div>
  );
}

function SelectField({ label, value, onChange, options, icon: Icon }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 700, color: focused ? C.accent : C.textMid, marginBottom: 7, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif", transition: "color .2s" }}>
          {label}
        </div>
      )}
      <div style={{ position: "relative" }}>
        {Icon && (
          <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <Icon size={15} color={focused ? C.accent : C.textDim} />
          </div>
        )}
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%", background: C.surface, border: `1px solid ${focused ? C.accent : C.border}`,
            borderRadius: 13, padding: `13px 14px 13px ${Icon ? 42 : 14}px`, color: value ? C.text : C.textDim,
            fontFamily: "'Barlow', sans-serif", fontSize: 14, fontWeight: 500, outline: "none",
            appearance: "none", cursor: "pointer", transition: "border-color .2s",
            boxShadow: focused ? `0 0 0 3px rgba(22,163,74,.1)` : "none",
          }}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronRight size={13} color={C.textDim} style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%) rotate(90deg)", pointerEvents: "none" }} />
      </div>
    </div>
  );
}

/* ─── UPLOAD BOX ─────────────────────────────── */

function UploadBox({ label, hint, icon: Icon = Upload, uploaded, previewUrl, uploading, progress = 0, error, onFileSelect, onRemove }) {
  const inputRef = useRef(null);
  const isPdf = previewUrl && previewUrl.startsWith("data:application/pdf");

  return (
    <div style={{ marginBottom: 12 }}>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        style={{
          background: uploaded ? "rgba(22,163,74,.04)" : uploading ? "rgba(22,163,74,.02)" : C.surfaceRaised,
          border: `1.5px dashed ${error ? C.red : uploaded ? "rgba(22,163,74,.4)" : uploading ? C.accent : C.border}`,
          borderRadius: 16, padding: previewUrl && !isPdf ? "12px 18px 18px" : "22px 18px",
          cursor: uploading ? "default" : "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
          transition: "all .25s", textAlign: "center", position: "relative", overflow: "hidden",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          capture={false}
          style={{ display: "none" }}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) onFileSelect(f);
            e.target.value = "";
          }}
        />

        {previewUrl && !isPdf && (
          <div style={{ width: "100%", position: "relative" }}>
            <img
              src={previewUrl}
              alt="preview"
              style={{ width: "100%", maxHeight: 120, objectFit: "cover", borderRadius: 10, display: "block" }}
            />
            {!uploading && onRemove && (
              <button
                onClick={e => { e.stopPropagation(); onRemove(); }}
                style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,.55)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={12} color="#fff" />
              </button>
            )}
          </div>
        )}

        {isPdf && (
          <div style={{ width: "100%", background: "rgba(37,99,235,.07)", border: "1px solid rgba(37,99,235,.18)", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <FileText size={16} color={C.blue} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: C.blue }}>PDF uploaded</span>
            {!uploading && onRemove && (
              <button
                onClick={e => { e.stopPropagation(); onRemove(); }}
                style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: C.textDim, display: "flex" }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        <div style={{
          width: 44, height: 44,
          background: uploaded ? "rgba(22,163,74,.12)" : uploading ? C.accentGlow : C.surfaceBright,
          borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background .2s", flexShrink: 0,
        }}>
          {uploading
            ? (
              <svg width="28" height="28" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="18" fill="none" stroke={C.border} strokeWidth="4" />
                <circle
                  cx="22" cy="22" r="18" fill="none" stroke={C.accent} strokeWidth="4"
                  strokeDasharray={`${(progress / 100) * 113} 113`} strokeLinecap="round"
                  style={{ transformOrigin: "center", transform: "rotate(-90deg)", transition: "stroke-dasharray .3s" }}
                />
              </svg>
            )
            : uploaded
              ? <Check size={20} color={C.green} />
              : <Icon size={20} color={C.textMid} />
          }
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
          <AlertCircle size={11} />{error}
        </div>
      )}
    </div>
  );
}

/* ─── STEP COMPONENTS ────────────────────────── */

function StepAccount({ data, setData, errors, isExistingUser }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <InputField label="First Name" placeholder="Marcus" icon={User} value={data.firstName} onChange={v => setData(d => ({ ...d, firstName: v }))} error={errors.firstName} />
        </div>
        <div style={{ flex: 1 }}>
          <InputField label="Last Name" placeholder="Johnson" value={data.lastName} onChange={v => setData(d => ({ ...d, lastName: v }))} error={errors.lastName} />
        </div>
      </div>
      <InputField label="Email Address" placeholder="marcus@example.com" type="email" icon={Mail} value={data.email} onChange={v => setData(d => ({ ...d, email: v }))} error={errors.email} />
      <InputField label="Password" placeholder="Min. 8 characters" type="password" icon={Lock} value={data.password} onChange={v => setData(d => ({ ...d, password: v }))} error={errors.password} hint="Use uppercase, lowercase, numbers, and symbols." />
      <InputField label="Confirm Password" placeholder="Re-enter password" type="password" icon={Lock} value={data.confirmPassword} onChange={v => setData(d => ({ ...d, confirmPassword: v }))} error={errors.confirmPassword} />
      <div style={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div
          onClick={() => setData(d => ({ ...d, terms: !d.terms }))}
          style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${data.terms ? C.accent : C.border}`, background: data.terms ? C.accentGlow : "transparent", flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1, transition: "all .2s" }}
        >
          {data.terms && <Check size={12} color={C.accent} />}
        </div>
        <div style={{ fontSize: 12.5, color: C.textMid, fontWeight: 500, lineHeight: 1.6 }}>
          I agree to UaTob's{" "}
          <span style={{ color: C.accent, cursor: "pointer" }}>Driver Terms of Service</span>
          {" "}and{" "}
          <span style={{ color: C.accent, cursor: "pointer" }}>Privacy Policy</span>
        </div>
      </div>
      {errors.terms && (
        <div style={{ fontSize: 11.5, color: C.red, marginTop: 6, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          <AlertCircle size={11} />{errors.terms}
        </div>
      )}
    </div>
  );
}

function StepContact({ data, setData, errors }) {
  return (
    <div>
      <InputField label="Mobile Number" placeholder="+1 (555) 000-0000" type="tel" icon={Phone} value={data.phone} onChange={v => setData(d => ({ ...d, phone: v }))} error={errors.phone} hint="We'll send a verification code to this number." />
      <InputField label="Street Address" placeholder="123 Main Street, Apt 4B" icon={MapPin} value={data.address} onChange={v => setData(d => ({ ...d, address: v }))} error={errors.address} />
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1.2 }}>
          <InputField label="City" placeholder="Orlando" value={data.city} onChange={v => setData(d => ({ ...d, city: v }))} error={errors.city} />
        </div>
        <div style={{ flex: 0.8 }}>
          <InputField label="ZIP Code" placeholder="32801" value={data.zip} onChange={v => setData(d => ({ ...d, zip: v }))} error={errors.zip} />
        </div>
      </div>
      <SelectField label="State" icon={MapPin} value={data.state} onChange={v => setData(d => ({ ...d, state: v }))} options={ALL_STATES} />
      <div style={{ background: "rgba(22,163,74,.04)", border: "1px solid rgba(22,163,74,.2)", borderRadius: 14, padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ width: 34, height: 34, background: C.accentGlow, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Phone size={14} color={C.accent} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.accent, marginBottom: 2 }}>SMS Verification Required</div>
          <div style={{ fontSize: 11.5, color: C.textMid }}>Your number will be verified on the next step.</div>
        </div>
      </div>
    </div>
  );
}

function StepVehicle({ data, setData, errors }) {
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
          ]} />
        </div>
        <div style={{ flex: 1 }}>
          <InputField label="Model" placeholder="Camry, Civic…" value={data.model} onChange={v => setData(d => ({ ...d, model: v }))} error={errors.model} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <InputField label="Year" placeholder="2020" type="number" icon={Calendar} value={data.year} onChange={v => setData(d => ({ ...d, year: v }))} error={errors.year} />
        </div>
        <div style={{ flex: 1 }}>
          <InputField label="Color" placeholder="Pearl White" value={data.color} onChange={v => setData(d => ({ ...d, color: v }))} error={errors.color} />
        </div>
      </div>
      <InputField label="License Plate" placeholder="ABC-1234" icon={CreditCard} value={data.plate} onChange={v => setData(d => ({ ...d, plate: v }))} error={errors.plate} hint="Enter as shown on your registration." />
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, marginBottom: 10, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif" }}>
          Ride Types You Can Offer
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { id: "standard", label: "Standard", c: "#2563EB", desc: "4 passengers" },
            { id: "xl",       label: "XL",       c: "#16A34A", desc: "6 passengers" },
            { id: "premium",  label: "Premium",  c: "#7C3AED", desc: "Luxury cars"  },
            { id: "economy",  label: "Economy",  c: "#D97706", desc: "Budget rides" },
          ].map(rt => {
            const selected = data.rideTypes?.includes(rt.id);
            return (
              <div
                key={rt.id}
                onClick={() => setData(d => {
                  const cur = d.rideTypes || [];
                  return { ...d, rideTypes: selected ? cur.filter(r => r !== rt.id) : [...cur, rt.id] };
                })}
                style={{
                  background: selected ? rt.c + "14" : C.surfaceRaised,
                  border: `1.5px solid ${selected ? rt.c + "50" : C.border}`,
                  borderRadius: 12, padding: "11px 16px", cursor: "pointer",
                  transition: "all .2s", flex: "1 1 calc(50% - 4px)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: selected ? rt.c : C.text, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: ".5px" }}>{rt.label}</div>
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{rt.desc}</div>
              </div>
            );
          })}
        </div>
        {errors.rideTypes && (
          <div style={{ fontSize: 11.5, color: C.red, marginTop: 6, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            <AlertCircle size={11} />{errors.rideTypes}
          </div>
        )}
      </div>
      <InputField label="Vehicle VIN" placeholder="1HGBH41JXMN109186" value={data.vin} onChange={v => setData(d => ({ ...d, vin: v }))} hint="17-character Vehicle Identification Number (optional)" />
    </div>
  );
}

/* ─── STEP 4: DOCUMENTS ──────────────────────── */

function StepDocuments({ data, setData, errors, uid }) {
  const [uploadState, setUploadState] = useState({
    licenseFront: { uploading: false, progress: 0, localPreview: "" },
    licenseBack:  { uploading: false, progress: 0, localPreview: "" },
    registration: { uploading: false, progress: 0, localPreview: "" },
    insurance:    { uploading: false, progress: 0, localPreview: "" },
    profilePhoto: { uploading: false, progress: 0, localPreview: "" },
  });

  const setSlot = useCallback((slot, patch) => {
    setUploadState(s => ({ ...s, [slot]: { ...s[slot], ...patch } }));
  }, []);

  const uploadFile = useCallback(async (slot, file) => {
    if (!uid) {
      console.warn("No UID yet — cannot upload to Firebase Storage");
      return;
    }

    let localPreview = "";
    if (file.type.startsWith("image/")) {
      localPreview = URL.createObjectURL(file);
    } else if (file.type === "application/pdf") {
      localPreview = "data:application/pdf;placeholder";
    }

    setSlot(slot, { uploading: true, progress: 0, localPreview });

    try {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!allowedTypes.includes(file.type)) {
        setSlot(slot, { uploading: false, progress: 0, localPreview: "" });
        return;
      }
      const ext  = file.name.split(".").pop();
      const path = `drivers/${uid}/documents/${slot}_${Date.now()}.${ext}`;
      const storageRef = ref(storage, path);
      const task = uploadBytesResumable(storageRef, file);

      await new Promise((resolve, reject) => {
        task.on(
          "state_changed",
          snap => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setSlot(slot, { progress: pct });
          },
          reject,
          resolve
        );
      });

      const downloadURL = await getDownloadURL(task.snapshot.ref);

      setData(d => ({
        ...d,
        [slot]: true,
        [`${slot}Url`]: downloadURL,
      }));

      setSlot(slot, { uploading: false, progress: 100, localPreview: downloadURL });
    } catch (err) {
      console.error(`Upload failed for ${slot}:`, err);
      setSlot(slot, { uploading: false, progress: 0, localPreview: "" });
    }
  }, [uid, setData, setSlot]);

  const removeSlot = useCallback((slot) => {
    setData(d => ({ ...d, [slot]: false, [`${slot}Url`]: "" }));
    setSlot(slot, { uploading: false, progress: 0, localPreview: "" });
  }, [setData, setSlot]);

  const preview = (slot) =>
    uploadState[slot].localPreview || data[`${slot}Url`] || "";

  const SectionLabel = ({ children }) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, marginBottom: 12, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif" }}>
      {children}
    </div>
  );

  const Divider = () => (
    <div style={{ height: 1, background: C.border, margin: "4px 0 18px" }} />
  );

  return (
    <div>
      <div style={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, borderRadius: 16, padding: "14px 16px", marginBottom: 20, display: "flex", gap: 12, alignItems: "center" }}>
        <Shield size={15} color={C.blue} />
        <div style={{ fontSize: 12.5, color: C.textMid, lineHeight: 1.55 }}>
          All documents are <strong style={{ color: C.text }}>encrypted and stored securely</strong>. We only use them for driver verification.
        </div>
      </div>

      <SectionLabel>Driver's License</SectionLabel>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <UploadBox label="Front Side" hint="Tap to upload photo" icon={Camera} uploaded={data.licenseFront} previewUrl={preview("licenseFront")} uploading={uploadState.licenseFront.uploading} progress={uploadState.licenseFront.progress} error={errors?.licenseFront} onFileSelect={f => uploadFile("licenseFront", f)} onRemove={() => removeSlot("licenseFront")} />
        </div>
        <div style={{ flex: 1 }}>
          <UploadBox label="Back Side" hint="Tap to upload photo" icon={Camera} uploaded={data.licenseBack} previewUrl={preview("licenseBack")} uploading={uploadState.licenseBack.uploading} progress={uploadState.licenseBack.progress} error={errors?.licenseBack} onFileSelect={f => uploadFile("licenseBack", f)} onRemove={() => removeSlot("licenseBack")} />
        </div>
      </div>
      <InputField label="License Number" placeholder="D1234567" icon={FileText} value={data.licenseNumber} onChange={v => setData(d => ({ ...d, licenseNumber: v }))} hint="As shown on your license" error={errors?.licenseNumber} />

      <Divider />

      <SectionLabel>Vehicle Registration &amp; Insurance</SectionLabel>
      <UploadBox label="Vehicle Registration" hint="Photo or PDF accepted" icon={FileText} uploaded={data.registration} previewUrl={preview("registration")} uploading={uploadState.registration.uploading} progress={uploadState.registration.progress} error={errors?.registration} onFileSelect={f => uploadFile("registration", f)} onRemove={() => removeSlot("registration")} />
      <UploadBox label="Proof of Insurance" hint="Must be current &amp; valid" icon={Shield} uploaded={data.insurance} previewUrl={preview("insurance")} uploading={uploadState.insurance.uploading} progress={uploadState.insurance.progress} error={errors?.insurance} onFileSelect={f => uploadFile("insurance", f)} onRemove={() => removeSlot("insurance")} />

      <Divider />

      <SectionLabel>Profile Photo</SectionLabel>
      <UploadBox label="Your Photo" hint="Clear, recent headshot · No sunglasses" icon={Camera} uploaded={data.profilePhoto} previewUrl={preview("profilePhoto")} uploading={uploadState.profilePhoto.uploading} progress={uploadState.profilePhoto.progress} error={errors?.profilePhoto} onFileSelect={f => uploadFile("profilePhoto", f)} onRemove={() => removeSlot("profilePhoto")} />
    </div>
  );
}

/* ─── STEP 5: VERIFY ─────────────────────────── */

function StepVerify({ accountData, contactData, vehicleData, docData }) {
  const allDocs = docData.licenseFront && docData.licenseBack && docData.registration && docData.insurance && docData.profilePhoto;

  const Section = ({ title, items }) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, marginBottom: 12, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif" }}>{title}</div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
        {items.map((item, i) => (
          <div key={i} style={{ padding: "12px 16px", borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, color: C.textMid, fontWeight: 500 }}>{item.label}</span>
            <span style={{ fontSize: 13, color: item.val ? C.text : C.textDim, fontWeight: 600, maxWidth: "55%", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.val || "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ background: allDocs ? "rgba(22,163,74,.05)" : "rgba(22,163,74,.04)", border: `1px solid ${allDocs ? "rgba(22,163,74,.25)" : "rgba(22,163,74,.18)"}`, borderRadius: 16, padding: "16px 18px", marginBottom: 22, display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ width: 38, height: 38, background: allDocs ? "rgba(22,163,74,.12)" : C.accentGlow, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {allDocs ? <CheckCircle size={18} color={C.green} /> : <Clock size={18} color={C.accent} />}
        </div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.accent, marginBottom: 2 }}>{allDocs ? "All documents uploaded" : "Some documents missing"}</div>
          <div style={{ fontSize: 11.5, color: C.textMid }}>{allDocs ? "Your application is ready to submit for review." : "You can still submit — upload remaining docs later."}</div>
        </div>
      </div>

      <Section title="Account" items={[
        { label: "Name",  val: `${accountData.firstName} ${accountData.lastName}` },
        { label: "Email", val: accountData.email },
      ]} />
      <Section title="Contact" items={[
        { label: "Phone",        val: contactData.phone },
        { label: "Address",      val: contactData.address },
        { label: "City / State", val: contactData.city && contactData.state ? `${contactData.city}, ${contactData.state} ${contactData.zip}` : "" },
      ]} />
      <Section title="Vehicle" items={[
        { label: "Vehicle",    val: vehicleData.make && vehicleData.model ? `${vehicleData.year} ${vehicleData.make} ${vehicleData.model}` : "" },
        { label: "Plate",      val: vehicleData.plate },
        { label: "Ride Types", val: vehicleData.rideTypes?.join(", ") },
      ]} />
      <Section title="Documents" items={[
        { label: "Driver's License", val: (docData.licenseFront && docData.licenseBack) ? "✓ Uploaded" : "Pending" },
        { label: "Registration",     val: docData.registration ? "✓ Uploaded" : "Pending" },
        { label: "Insurance",        val: docData.insurance    ? "✓ Uploaded" : "Pending" },
        { label: "Profile Photo",    val: docData.profilePhoto ? "✓ Uploaded" : "Pending" },
      ]} />

      {(docData.licenseFrontUrl || docData.profilePhotoUrl) && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, marginBottom: 10, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif" }}>Document Previews</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { url: docData.licenseFrontUrl,  label: "License Front" },
              { url: docData.licenseBackUrl,   label: "License Back"  },
              { url: docData.registrationUrl,  label: "Registration"  },
              { url: docData.insuranceUrl,     label: "Insurance"     },
              { url: docData.profilePhotoUrl,  label: "Profile Photo" },
            ].filter(d => d.url && !d.url.startsWith("data:application/pdf")).map((d, i) => (
              <div key={i} style={{ flex: "1 1 calc(33% - 6px)", minWidth: 90 }}>
                <img src={d.url} alt={d.label} style={{ width: "100%", height: 70, objectFit: "cover", borderRadius: 10, display: "block", border: `1px solid ${C.border}` }} />
                <div style={{ fontSize: 10, color: C.textDim, fontWeight: 600, textAlign: "center", marginTop: 4, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: ".5px", textTransform: "uppercase" }}>{d.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Zap size={14} color={C.accent} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: C.textMid, lineHeight: 1.6 }}>
          After submission, our team will review your application within <strong style={{ color: C.text }}>24–48 hours</strong>. You'll receive an email when you're approved to start driving.
        </div>
      </div>
    </div>
  );
}

/* ─── PENDING SCREEN ─────────────────────────── */

function PendingScreen({ firstName, email }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: '"Barlow", system-ui, sans-serif', color: C.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800;900&family=Barlow+Condensed:wght@500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes scaleIn { from { opacity: 0; transform: scale(.85) } to { opacity: 1; transform: scale(1) } }
        @keyframes fadeUp  { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes pulse   { 0%,100% { opacity: 1 } 50% { opacity: .5 } }
      `}} />
      <div style={{ textAlign: "center", maxWidth: 420, width: "100%", animation: "scaleIn .6s cubic-bezier(.34,1.56,.64,1)" }}>
        <div style={{ width: 90, height: 90, background: "rgba(22,163,74,.08)", border: "2px solid rgba(22,163,74,.25)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", boxShadow: "0 0 0 12px rgba(22,163,74,.04)" }}>
          <Clock size={40} color={C.accent} />
        </div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 38, fontWeight: 900, color: C.text, letterSpacing: "-1px", marginBottom: 10, lineHeight: 1.1 }}>
          Application<br/>Submitted!
        </div>
        <div style={{ fontSize: 15, color: C.textMid, lineHeight: 1.7, marginBottom: 32 }}>
          Welcome to UaTob, <strong style={{ color: C.text }}>{firstName}</strong>.<br/>
          Our team is reviewing your application. You'll hear back within <strong style={{ color: C.accent }}>24–48 hours</strong>.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { icon: Mail,  label: "Confirmation sent to", val: email,                      c: C.blue   },
            { icon: Clock, label: "Review time",          val: "24–48 hours",               c: C.accent },
            { icon: Zap,   label: "Once approved",        val: "Start earning immediately", c: C.green  },
          ].map((item, i) => (
            <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 18px", display: "flex", gap: 12, alignItems: "center", animation: `fadeUp .5s ease-out ${0.2 + i * 0.1}s both`, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
              <div style={{ width: 36, height: 36, background: item.c + "12", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <item.icon size={16} color={item.c} />
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 11, color: C.textDim, fontWeight: 600, letterSpacing: ".5px", textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif" }}>{item.label}</div>
                <div style={{ fontSize: 13.5, color: C.text, fontWeight: 700, marginTop: 2 }}>{item.val}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 28, display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.25)", borderRadius: 100, padding: "10px 20px" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B", animation: "pulse 1.5s ease-in-out infinite" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#B45309", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: ".5px" }}>
            STATUS: PENDING REVIEW
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN COMPONENT ─────────────────────────── */

export default function UaTobDriverSignup({ uid, driverSignUp }) {
  const { drivers} = useApplicationSubmitted(uid);

  const isExistingUser = Boolean(uid);

  // ── Guard: driver already completed signup ──────────────────
  // Return null for any status that means they're past the signup flow
  if (driverSignUp && COMPLETED_STATUSES.includes(driverSignUp.status)) {
    return null;
  }

  const [submitted, setSubmitted] = useState(() => lsGet(LS_KEYS.submitted, false));

  useEffect(() => {
    if (driverSignUp?.status === "pending") {
      setSubmitted(true);
      lsSet(LS_KEYS.submitted, true);
    }
  }, [driverSignUp?.status]);

  const [step,        setStep]        = useState(() => lsGet(LS_KEYS.step, 1));
  const [createdUid,  setCreatedUid]  = useState(() => uid || lsGet(LS_KEYS.uid, null));
  const [accountData, setAccountData] = useState(() => {
    const saved = lsGet(LS_KEYS.account, DEFAULT_ACCOUNT);
    return { ...DEFAULT_ACCOUNT, ...saved, password: "", confirmPassword: "" };
  });
  const [contactData, setContactData] = useState(() => lsGet(LS_KEYS.contact, DEFAULT_CONTACT));
  const [vehicleData, setVehicleData] = useState(() => lsGet(LS_KEYS.vehicle, DEFAULT_VEHICLE));
  const [docData,     setDocData]     = useState(() => lsGet(LS_KEYS.doc, DEFAULT_DOC));

  const [direction,        setDirection]        = useState("forward");
  const [animating,        setAnimating]        = useState(false);
  const [errors,           setErrors]           = useState({});
  const [loading,          setLoading]          = useState(false);
  const [submitError,      setSubmitError]      = useState(null);
  const [showResumeBanner, setShowResumeBanner] = useState(() => lsGet(LS_KEYS.step, 1) > 1);
  const scrollRef = useRef(null);

  const firestoreHydrated = useRef(false);
  useEffect(() => {
    if (!driverSignUp || firestoreHydrated.current) return;
    firestoreHydrated.current = true;
    const savedStep = driverSignUp.currentStep ?? 1;
    if (savedStep > 1) { setStep(s => Math.max(s, savedStep)); setShowResumeBanner(true); }
    if (driverSignUp.firstName || driverSignUp.lastName || driverSignUp.email) {
      setAccountData(d => ({ ...d, firstName: driverSignUp.firstName || d.firstName, lastName: driverSignUp.lastName || d.lastName, email: driverSignUp.email || d.email }));
    }
    if (driverSignUp.contactData) setContactData(d => ({ ...d, ...driverSignUp.contactData }));
    if (driverSignUp.vehicleData) setVehicleData(d => ({ ...d, ...driverSignUp.vehicleData }));
    if (driverSignUp.docData)     setDocData(d => ({ ...d, ...driverSignUp.docData }));
  }, [driverSignUp]);

  useEffect(() => { lsSet(LS_KEYS.step, step); }, [step]);
  useEffect(() => { lsSet(LS_KEYS.uid,  createdUid); }, [createdUid]);
  useEffect(() => {
    const { password, confirmPassword, ...safe } = accountData;
    lsSet(LS_KEYS.account, safe);
  }, [accountData]);
  useEffect(() => { lsSet(LS_KEYS.contact, contactData); }, [contactData]);
  useEffect(() => { lsSet(LS_KEYS.vehicle, vehicleData); }, [vehicleData]);
  useEffect(() => { lsSet(LS_KEYS.doc,     docData); },     [docData]);

  /* ── API helpers ── */

  const createDriverProfile = async (uid, data) => {
    const res = await fetch(CLOUD_FUNCTION_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, accountData: { firstName: data.firstName, lastName: data.lastName, email: data.email } }),
    });
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to create driver profile"); }
    return res.json();
  };

  const saveProgress = async (nextStep, overrideUid) => {
    const id = overrideUid ?? createdUid;
    if (!id) return;
    const res = await fetch(CLOUD_FUNCTION_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: id, currentStep: nextStep,
        accountData: { firstName: accountData.firstName, lastName: accountData.lastName, email: accountData.email },
        contactData, vehicleData, docData,
      }),
    });
    if (!res.ok) console.warn("⚠️ saveProgress CF failed silently:", await res.text().catch(() => ""));
  };

  const submitDriverData = async (uid) => {
    const res = await fetch(CLOUD_FUNCTION_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid, submit: true,
        contactData: { phone: contactData.phone, address: contactData.address, city: contactData.city, state: contactData.state, zip: contactData.zip },
        vehicleData: { make: vehicleData.make, model: vehicleData.model, year: vehicleData.year, color: vehicleData.color, plate: vehicleData.plate, vin: vehicleData.vin, rideTypes: vehicleData.rideTypes },
        docData:     { licenseFront: docData.licenseFront, licenseFrontUrl: docData.licenseFrontUrl, licenseBack: docData.licenseBack, licenseBackUrl: docData.licenseBackUrl, licenseNumber: docData.licenseNumber, registration: docData.registration, registrationUrl: docData.registrationUrl, insurance: docData.insurance, insuranceUrl: docData.insuranceUrl, profilePhoto: docData.profilePhoto, profilePhotoUrl: docData.profilePhotoUrl },
      }),
    });
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to submit application"); }
    return res.json();
  };

  /* ── Validation ── */

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
      if (!vehicleData.year || vehicleData.year < 2005 || vehicleData.year > 2026) e.year = "Enter a year between 2005–2026";
      if (!vehicleData.color.trim()) e.color = "Required";
      if (!vehicleData.plate.trim()) e.plate = "Required";
      if (!vehicleData.rideTypes?.length) e.rideTypes = "Select at least one ride type";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ── Navigation ── */

  const goNext = async () => {
    if (loading || animating || !validate()) return;
    setSubmitError(null);
    try {
      setLoading(true);
      if (step === 1) {
        if (isExistingUser) {
          await saveProgress(2, uid);
        } else if (!createdUid) {
          const { result, error: signUpError } = await signUp(accountData.email.trim().toLowerCase(), accountData.password);
          if (signUpError) throw signUpError;
          const newUid = result.user.uid;
          setCreatedUid(newUid);
          await createDriverProfile(newUid, accountData);
          await saveProgress(2, newUid);
        } else {
          await saveProgress(2);
        }
      } else if (step === 5) {
        const id = createdUid;
        if (!id) throw new Error("Missing user ID — please restart signup.");
        await submitDriverData(id);
        lsClear();
        lsSet(LS_KEYS.submitted, true);
        setSubmitted(true);
        return;
      } else {
        await saveProgress(step + 1);
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
        setErrors({ email: err.message || "Signup failed. Please try again." });
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
    setStep(1);
    setCreatedUid(uid || null);
    setAccountData(DEFAULT_ACCOUNT);
    setContactData(DEFAULT_CONTACT);
    setVehicleData(DEFAULT_VEHICLE);
    setDocData(DEFAULT_DOC);
    setErrors({});
    setSubmitError(null);
    setSubmitted(false);
    setShowResumeBanner(false);
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

  /* ── Main render ── */

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
    @keyframes greenPulse   { 0%,100% { box-shadow: 0 4px 18px rgba(22,163,74,.25) } 50% { box-shadow: 0 4px 28px rgba(22,163,74,.5) } }
    @keyframes errorShake   { 0%,100% { transform: translateX(0) } 20%,60% { transform: translateX(-6px) } 40%,80% { transform: translateX(6px) } }
    @keyframes slideDown    { from { opacity: 0; transform: translateY(-10px) } to { opacity: 1; transform: translateY(0) } }
    @keyframes spin         { to { transform: rotate(360deg) } }
    .green-btn {
      background: linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D);
      border: none; border-radius: 15px; color: #fff;
      font-family: 'Barlow', sans-serif; font-weight: 800; font-size: 15px;
      cursor: pointer; transition: all .22s; letter-spacing: .3px;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      animation: greenPulse 3s ease-in-out infinite;
    }
    .green-btn:hover    { transform: translateY(-1px); box-shadow: 0 8px 28px rgba(22,163,74,.4) !important; }
    .green-btn:disabled { opacity: .6; cursor: not-allowed; transform: none; animation: none; }
    .ghost-btn {
      background: ${C.surface}; border: 1.5px solid ${C.border};
      border-radius: 15px; color: ${C.textMid}; font-family: 'Barlow', sans-serif;
      font-weight: 700; font-size: 14px; cursor: pointer; transition: all .2s;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .ghost-btn:hover { border-color: ${C.accent}; color: ${C.accent}; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${C.surfaceBright}; border-radius: 4px; }
  `;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: '"Barlow", system-ui, sans-serif', color: C.text }}>
      <style dangerouslySetInnerHTML={{ __html: mainStyles }} />

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px 120px", minHeight: "100vh" }}>

        {/* Header */}
        <div style={{ padding: "28px 0 24px", display: "flex", alignItems: "center", gap: 14 }}>
          <UaTobIcon size={38} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 2 }}>Driver Signup</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 21, fontWeight: 900, color: C.text, letterSpacing: "-0.3px" }}>Start Driving Today</div>
          </div>
          {(step > 1 || accountData.firstName) && (
            <button
              onClick={restartForm}
              style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: "7px 12px", fontSize: 11, fontWeight: 700, color: C.textDim, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: ".5px", textTransform: "uppercase", transition: "all .2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.color = C.red; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textDim; }}
            >
              Start Over
            </button>
          )}
        </div>

        {/* Resume banner */}
        {showResumeBanner && (
          <div style={{ background: "rgba(22,163,74,.05)", border: "1px solid rgba(22,163,74,.2)", borderRadius: 14, padding: "13px 16px", marginBottom: 20, display: "flex", gap: 12, alignItems: "center", animation: "slideDown .3s ease" }}>
            <div style={{ width: 34, height: 34, background: C.accentGlow, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <CheckCircle size={16} color={C.accent} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.accent, marginBottom: 2 }}>Progress saved — welcome back!</div>
              <div style={{ fontSize: 11.5, color: C.textMid }}>Resuming from step {step} of {STEPS.length}.</div>
            </div>
            <button onClick={() => setShowResumeBanner(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 18, lineHeight: 1, padding: "0 2px" }}>×</button>
          </div>
        )}

        {/* Progress bar */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ height: 3, background: C.surfaceBright, borderRadius: 2, marginBottom: 18, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#15803D,#16A34A,#22C55E)", borderRadius: 2, transition: "width .5s cubic-bezier(.34,1.2,.64,1)", boxShadow: "0 0 10px rgba(22,163,74,.4)" }} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {STEPS.map(s => {
              const done = step > s.id, active = step === s.id;
              return (
                <div key={s.id} style={{ flex: 1, background: done ? C.accentGlow : active ? C.surface : C.surfaceRaised, border: `1px solid ${done ? C.accentBorder : active ? "rgba(22,163,74,.3)" : C.border}`, borderRadius: 12, padding: "9px 6px", textAlign: "center", transition: "all .3s", boxShadow: active ? "0 1px 6px rgba(22,163,74,.12)" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 5 }}>
                    {done ? <Check size={13} color={C.accent} /> : <s.icon size={13} color={active ? C.accent : C.textDim} />}
                  </div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9.5, fontWeight: 700, color: done || active ? C.accent : C.textDim, letterSpacing: "1px", textTransform: "uppercase" }}>
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step title */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 4 }}>
            Step {step} of {STEPS.length}
          </div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 900, color: C.text, letterSpacing: "-0.5px", animation: "revealUp .35s ease-out" }}>
            {["Create your account", "Where are you located?", "Tell us about your vehicle", "Upload your documents", "Review & submit"][step - 1]}
          </div>
          <div style={{ fontSize: 13.5, color: C.textMid, marginTop: 5, fontWeight: 500 }}>
            {["Set up your UaTob driver profile.", "We need your contact and location details.", "Your vehicle must meet our quality standards.", "Securely upload your required documents.", "Double-check everything before submitting."][step - 1]}
          </div>
        </div>

        {/* Submit error */}
        {submitError && (
          <div style={{ background: "rgba(220,38,38,.06)", border: "1px solid rgba(220,38,38,.25)", borderRadius: 14, padding: "13px 16px", marginBottom: 18, display: "flex", gap: 10, alignItems: "center", animation: "errorShake .4s ease" }}>
            <AlertCircle size={16} color={C.red} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: C.red, fontWeight: 600 }}>{submitError}</div>
          </div>
        )}

        {/* Step content */}
        <div
          ref={scrollRef}
          style={{ animation: animating ? "fadeOut .15s ease forwards" : direction === "forward" ? "slideForward .35s cubic-bezier(.25,.46,.45,.94)" : "slideBack .35s cubic-bezier(.25,.46,.45,.94)" }}
        >
          {step === 1 && <StepAccount   data={accountData} setData={setAccountData} errors={errors} isExistingUser={isExistingUser} />}
          {step === 2 && <StepContact   data={contactData} setData={setContactData} errors={errors} />}
          {step === 3 && <StepVehicle   data={vehicleData} setData={setVehicleData} errors={errors} />}
          {step === 4 && <StepDocuments data={docData}     setData={setDocData}     errors={errors} uid={createdUid || uid} />}
          {step === 5 && <StepVerify    accountData={accountData} contactData={contactData} vehicleData={vehicleData} docData={docData} />}
        </div>
      </div>

      {/* Sticky bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(250,250,250,.97)", backdropFilter: "blur(24px)", borderTop: `1px solid ${C.border}`, padding: "14px 20px 20px", boxShadow: "0 -8px 32px rgba(0,0,0,.06)" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", gap: 10, alignItems: "center" }}>
          {step > 1 && (
            <button className="ghost-btn" onClick={goBack} style={{ padding: "15px 20px" }}>
              <ChevronLeft size={17} /> Back
            </button>
          )}
          <button className="green-btn" onClick={goNext} disabled={loading || animating} style={{ flex: 1, padding: "16px 24px" }}>
            {loading
              ? <span>Please wait…</span>
              : step === 5
                ? <><span>Submit Application</span><ArrowRight size={17} /></>
                : <><span>Continue</span><ChevronRight size={17} /></>
            }
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 12 }}>
          {STEPS.map(s => (
            <div key={s.id} style={{ width: step === s.id ? 20 : 6, height: 3, background: step >= s.id ? C.accent : C.surfaceBright, borderRadius: 2, transition: "all .35s cubic-bezier(.34,1.2,.64,1)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}