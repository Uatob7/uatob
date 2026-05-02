import React, { useState } from "react";
import { Eye, EyeOff, X, Loader2 } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import signIn from "@/firebase/auth/signin";
import signUp from "@/firebase/auth/signup";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebase_app } from "@/firebase/config";

const functions         = getFunctions(firebase_app, "us-east1");
const callCreateAccount = httpsCallable(functions, "createAccount");

// ── Design tokens (mirrors UaTobDriverSignup) ─────────────────────────
const C = {
  bg:           "#FAFAF7",
  surface:      "#FFFFFF",
  surfaceRaised:"#F9FAF7",
  surfaceBright:"#F3F4F0",
  border:       "#E8E6DD",
  borderBright: "#D8D5CC",
  accent:       "#16A34A",
  accentDim:    "#15803D",
  accentGlow:   "rgba(22,163,74,.10)",
  accentBorder: "rgba(22,163,74,.22)",
  text:         "#0F0F10",
  textMid:      "#5A5A52",
  textDim:      "#9A988E",
  red:          "#DC2626",
  blue:         "#2563EB",
  green:        "#16A34A",
  purple:       "#7C3AED",
  amber:        "#D97706",
  cyan:         "#0891B2",
};

// ── SVG Logo ──────────────────────────────────────────────────────────
function UaTobIcon({ size = 38 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="ci-bg"   x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#FFFFFF"/><stop offset="100%" stopColor="#F3F4F6"/></linearGradient>
        <linearGradient id="ci-road" x1="0" y1="0" x2="64" y2="0"  gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#111827"/><stop offset="100%" stopColor="#16A34A"/></linearGradient>
        <linearGradient id="ci-car"  x1="0" y1="0" x2="1"  y2="1"><stop offset="0%" stopColor="#16A34A"/><stop offset="100%" stopColor="#15803D"/></linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#ci-bg)"/>
      <rect x="0.5" y="0.5" width="63" height="63" rx="13.5" stroke="#E5E7EB" strokeWidth="1"/>
      <path d="M 10 46 Q 32 28 54 46" stroke="url(#ci-road)" strokeWidth="2" strokeDasharray="4 3.5" strokeLinecap="round" fill="none" opacity="0.6"/>
      <circle cx="10" cy="46" r="5" fill="#111827" fillOpacity="0.12"/><circle cx="10" cy="46" r="3" fill="#111827"/>
      <text x="10" y="49" textAnchor="middle" fontFamily="system-ui" fontWeight="900" fontSize="4" fill="#fff">A</text>
      <circle cx="54" cy="46" r="5" fill="#16A34A" fillOpacity="0.18"/><circle cx="54" cy="46" r="3" fill="#16A34A"/>
      <text x="54" y="49" textAnchor="middle" fontFamily="system-ui" fontWeight="900" fontSize="4" fill="#fff">B</text>
      <g transform="translate(26,22)">
        <ellipse cx="6" cy="13" rx="7" ry="1.5" fill="#111827" opacity="0.1"/>
        <rect x="1" y="5" width="10" height="6" rx="1.5" fill="url(#ci-car)"/>
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

// ── Role data ─────────────────────────────────────────────────────────
const DEPARTMENTS = [
  {
    id: "support",
    label: "Customer Support",
    color: C.cyan,
    colorLight: "rgba(8,145,178,.10)",
    colorBorder: "rgba(8,145,178,.22)",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
      </svg>
    ),
    roles: [
      {
        title: "Support Agent I",
        type: "Full-Time",
        location: "Remote",
        pay: "$17–$21 / hr",
        desc: "First point of contact for rider and driver inquiries. Handle trip disputes, account questions, and payment issues via chat and email.",
        perks: ["Paid training", "Flexible shifts", "Health benefits after 90 days"],
        reqs: ["1+ yr customer service", "Strong written communication", "Empathy under pressure"],
      },
      {
        title: "Support Agent II — Escalations",
        type: "Full-Time",
        location: "Remote / Orlando, FL",
        pay: "$21–$26 / hr",
        desc: "Handle complex escalations from frontline agents. Coordinate with ops and engineering to resolve platform-level issues and safety incidents.",
        perks: ["Priority scheduling", "Bonus program", "Health + dental"],
        reqs: ["2+ yrs support experience", "Dispute resolution skills", "CRM proficiency"],
      },
      {
        title: "Weekend Support Specialist",
        type: "Part-Time",
        location: "Remote",
        pay: "$18–$22 / hr",
        desc: "Cover Saturday–Sunday peak hours when ride volume is highest. Ideal for someone looking for supplemental income with structured weekend shifts.",
        perks: ["Weekend differential pay", "No weekday commitment", "Equipment provided"],
        reqs: ["Available Sat–Sun 8am–8pm ET", "Customer-facing experience", "Reliable internet"],
      },
    ],
  },
  {
    id: "operations",
    label: "Operations & Management",
    color: C.amber,
    colorLight: "rgba(217,119,6,.09)",
    colorBorder: "rgba(217,119,6,.22)",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    roles: [
      {
        title: "City Operations Manager",
        type: "Full-Time",
        location: "Orlando, FL",
        pay: "$55,000–$72,000 / yr",
        desc: "Own driver supply and demand balance in the Orlando metro. Launch driver incentive campaigns, coordinate surge strategy, and report key metrics to leadership.",
        perks: ["Equity options", "Annual bonus", "Full benefits package"],
        reqs: ["3+ yrs ops or logistics management", "Data-driven mindset", "Rideshare/gig industry a plus"],
      },
      {
        title: "Support Team Manager",
        type: "Full-Time",
        location: "Remote / Orlando, FL",
        pay: "$52,000–$68,000 / yr",
        desc: "Lead a team of 8–15 support agents. Define quality standards, run performance reviews, build shift schedules, and own CSAT targets.",
        perks: ["Management bonus", "Remote-first", "Full benefits"],
        reqs: ["2+ yrs team management", "Support tooling expertise", "Strong coaching skills"],
      },
      {
        title: "Driver Onboarding Coordinator",
        type: "Full-Time · Contract-to-Hire",
        location: "Orlando, FL",
        pay: "$20–$25 / hr",
        desc: "Shepherd new driver applicants through background checks, document verification, and vehicle inspection. Keep pipeline moving and communicate status clearly.",
        perks: ["Conversion to full-time", "Mileage reimbursement", "Flexible hours"],
        reqs: ["Organized self-starter", "Familiarity with compliance workflows", "Driver's license"],
      },
    ],
  },
  {
    id: "engineering",
    label: "Engineering",
    color: C.purple,
    colorLight: "rgba(124,58,237,.09)",
    colorBorder: "rgba(124,58,237,.22)",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
      </svg>
    ),
    roles: [
      {
        title: "Frontend Engineer — React",
        type: "Full-Time",
        location: "Remote",
        pay: "$90,000–$120,000 / yr",
        desc: "Own the rider and driver app UIs built in Next.js + React. Work directly with the founder to ship polished, performant components. Deep involvement from design to deploy.",
        perks: ["Remote-first", "Equity package", "Direct founder access"],
        reqs: ["3+ yrs React/Next.js", "Strong CSS + design sensibility", "Firebase experience a plus"],
      },
      {
        title: "Backend / Firebase Engineer",
        type: "Full-Time",
        location: "Remote",
        pay: "$95,000–$125,000 / yr",
        desc: "Build and maintain Cloud Functions v2, Firestore data models, and third-party integrations (Stripe Connect, Google Maps, SendGrid). Architect for reliability at scale.",
        perks: ["Equity", "Remote + async culture", "Modern stack"],
        reqs: ["Strong Node.js / TypeScript", "Firebase / GCP experience", "Stripe or payments APIs a plus"],
      },
      {
        title: "Mobile Engineer — React Native",
        type: "Full-Time · Contract-to-Hire",
        location: "Remote",
        pay: "$85,000–$115,000 / yr",
        desc: "Port the web-based rider and driver apps to native iOS and Android. Work alongside the frontend engineer to unify the design system across platforms.",
        perks: ["Contract to full-time path", "Equity eligible", "Device stipend"],
        reqs: ["React Native + Expo", "Published apps on App Store / Play Store", "Real-time data experience"],
      },
      {
        title: "QA / Automation Engineer",
        type: "Part-Time · Contract",
        location: "Remote",
        pay: "$45–$65 / hr",
        desc: "Build end-to-end test coverage for the rider booking flow, driver dispatch, and payments. Write automated tests and own the regression suite.",
        perks: ["Flexible hours", "Fully remote", "Interesting problem space"],
        reqs: ["Playwright or Cypress", "Firebase test environment experience a plus", "Attention to edge cases"],
      },
    ],
  },
];

const PERKS_GLOBAL = [
  { icon: "🛞", label: "Free rides",         desc: "Unlimited UaTob rides for team members" },
  { icon: "🌎", label: "Remote-first",        desc: "Most roles are fully remote" },
  { icon: "📈", label: "Equity options",       desc: "Get in early and grow with the platform" },
  { icon: "🤝", label: "Small team",           desc: "Direct impact, no bureaucracy" },
  { icon: "⚡", label: "Fast shipping",        desc: "We build and deploy constantly" },
  { icon: "🏥", label: "Health benefits",      desc: "Medical, dental, vision on eligible roles" },
];

// ── Auth Gate Modal ───────────────────────────────────────────────────
function AuthGateModal({ onClose, onAuthSuccess }) {
  const [mode,     setMode]     = useState("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [name,     setName]     = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = mode === "login"
        ? await signIn(email, password)
        : await signUp(email, password);

      if (result.error) throw new Error(result.error.message || "Authentication failed");

      if (mode === "signup") {
        const user = result.result?.user ?? result.user;
        if (!user?.uid) throw new Error("Sign-up succeeded but UID is missing.");
        await callCreateAccount({ uid: user.uid, email: user.email, name });
      }

      onAuthSuccess();
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%", background: C.surfaceRaised,
    border: `1.5px solid ${C.border}`,
    borderRadius: 12, padding: "13px 14px",
    color: C.text, fontFamily: "'Barlow',sans-serif",
    fontSize: 14, fontWeight: 500, outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(15,15,16,.55)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        animation: "fadeIn .2s ease",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480,
          background: C.surface,
          borderRadius: "24px 24px 0 0",
          padding: "10px 24px 44px",
          boxShadow: "0 -24px 64px rgba(0,0,0,.18)",
          animation: "slideUp .35s cubic-bezier(.34,1.2,.64,1)",
        }}
      >
        {/* Handle */}
        <div style={{ width: 40, height: 4, background: C.border, borderRadius: 2, margin: "16px auto 24px" }} />

        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 20, right: 20,
            width: 32, height: 32, borderRadius: "50%",
            background: C.surfaceBright, border: `1px solid ${C.border}`,
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", color: C.textDim,
          }}
        >
          <X size={14} />
        </button>

        {/* Headline */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontFamily: "'Barlow Condensed',sans-serif",
            fontSize: 26, fontWeight: 900, color: C.text, marginBottom: 4,
          }}>
            {mode === "login" ? "Sign in to apply" : "Create an account"}
          </div>
          <div style={{ fontSize: 13, color: C.textMid, fontWeight: 500 }}>
            {mode === "login"
              ? "Log in to your UaTob account to submit your application."
              : "Join UaTob, then apply for the role."}
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{
          display: "flex", gap: 4,
          background: C.surfaceBright, border: `1px solid ${C.border}`,
          borderRadius: 12, padding: 4, marginBottom: 20,
        }}>
          {["login", "signup"].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); }}
              style={{
                flex: 1, padding: "9px 0",
                border: "none", borderRadius: 9,
                background: mode === m ? C.surface : "transparent",
                boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                color: mode === m ? C.text : C.textDim,
                fontWeight: 800, fontSize: 13,
                fontFamily: "'Barlow Condensed',sans-serif",
                letterSpacing: ".05em",
                cursor: "pointer", transition: "all .18s",
              }}
            >
              {m === "login" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: "rgba(220,38,38,.06)",
            border: "1px solid rgba(220,38,38,.22)",
            borderRadius: 10, padding: "10px 14px",
            fontSize: 13, color: C.red, fontWeight: 600,
            marginBottom: 14,
          }}>
            {error}
          </div>
        )}

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={e => setName(e.target.value)}
              style={inputStyle}
            />
          )}
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
          />
          <div style={{ position: "relative" }}>
            <input
              type={showPw ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ ...inputStyle, paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPw(p => !p)}
              style={{
                position: "absolute", right: 13, top: "50%",
                transform: "translateY(-50%)",
                background: "none", border: "none",
                cursor: "pointer", color: C.textDim,
                display: "flex", padding: 2,
              }}
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || !email.trim() || !password.trim()}
          style={{
            width: "100%", padding: "15px",
            marginTop: 18,
            background: "linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)",
            border: "none", borderRadius: 100,
            color: "#fff", fontWeight: 800, fontSize: 15,
            fontFamily: "'Barlow',sans-serif", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            opacity: (loading || !email.trim() || !password.trim()) ? 0.55 : 1,
            boxShadow: "0 6px 20px rgba(22,163,74,.28)",
          }}
        >
          {loading
            ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            : mode === "login" ? "Sign In & Continue →" : "Create Account & Continue →"
          }
        </button>

        {/* Switch mode */}
        <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: C.textMid }}>
          {mode === "login" ? "No account? " : "Already have one? "}
          <button
            onClick={() => { setMode(m => m === "login" ? "signup" : "login"); setError(""); }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: C.accent, fontWeight: 700, fontSize: 13,
              fontFamily: "'Barlow',sans-serif", padding: 0,
            }}
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </div>

        {/* Terms */}
        <div style={{ textAlign: "center", marginTop: 10, fontSize: 11.5, color: C.textDim, lineHeight: 1.6 }}>
          By continuing, you agree to our{" "}
          <a href="/terms" style={{ color: C.accent, fontWeight: 600, textDecoration: "none" }}>Terms</a>
          {" "}and{" "}
          <a href="/privacy" style={{ color: C.accent, fontWeight: 600, textDecoration: "none" }}>Privacy Policy</a>.
        </div>
      </div>
    </div>
  );
}

// ── Apply Modal ────────────────────────────────────────────────────────
function ApplyModal({ role, dept, onClose, user }) {
  // Pre-fill from Firebase auth user if available
  const knownName  = user?.displayName || "";
  const knownEmail = user?.email        || "";

  const [form, setForm] = useState({
    name:     knownName,
    email:    knownEmail,
    linkedin: "",
    message:  "",
  });
  const [sent, setSent] = useState(false);

  const handleSubmit = () => {
    if (!form.name.trim() || !form.email.trim()) return;
    setSent(true);
  };

  // True when the field value is locked from auth — no edits needed
  const lockedName  = Boolean(knownName);
  const lockedEmail = Boolean(knownEmail);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(15,15,16,.55)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: "0 0 0 0",
        animation: "fadeIn .2s ease",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 560,
          background: C.surface,
          borderRadius: "24px 24px 0 0",
          padding: "28px 24px 40px",
          boxShadow: "0 -24px 64px rgba(0,0,0,.18)",
          animation: "slideUp .35s cubic-bezier(.34,1.2,.64,1)",
          maxHeight: "90vh", overflowY: "auto",
        }}
      >
        {sent ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{
              width: 72, height: 72,
              background: "linear-gradient(135deg,#22C55E,#16A34A)",
              borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
              boxShadow: "0 10px 28px rgba(22,163,74,.35)",
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 28, fontWeight: 900, color: C.text, marginBottom: 8 }}>
              Application sent!
            </div>
            <div style={{ fontSize: 14, color: C.textMid, lineHeight: 1.6 }}>
              We'll be in touch at <strong style={{ color: C.text }}>{form.email}</strong>.<br/>
              Expect a reply within <strong style={{ color: C.accent }}>3–5 business days</strong>.
            </div>
            <button
              onClick={onClose}
              style={{
                marginTop: 24, padding: "13px 32px",
                background: C.accent, border: "none", borderRadius: 100,
                color: "#fff", fontWeight: 800, fontSize: 14,
                fontFamily: "'Barlow',sans-serif", cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Handle */}
            <div style={{ width: 40, height: 4, background: C.border, borderRadius: 2, margin: "0 auto 24px" }} />

            <div style={{ marginBottom: 20 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: dept.colorLight,
                border: `1px solid ${dept.colorBorder}`,
                borderRadius: 100, padding: "4px 12px",
                fontSize: 11, fontWeight: 800,
                color: dept.color,
                fontFamily: "'Barlow Condensed',sans-serif",
                letterSpacing: ".12em", textTransform: "uppercase",
                marginBottom: 8,
              }}>
                <span style={{ color: dept.color }}>{dept.label}</span>
              </div>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 26, fontWeight: 900, color: C.text, lineHeight: 1.1 }}>
                {role.title}
              </div>
              <div style={{ fontSize: 13, color: C.textMid, marginTop: 4 }}>
                {role.location} · {role.pay}
              </div>
            </div>

            {/* Identity — locked card if logged in, editable fields if not */}
            {(lockedName || lockedEmail) ? (
              <div style={{
                background: C.accentGlow,
                border: `1.5px solid ${C.accentBorder}`,
                borderRadius: 14, padding: "13px 16px",
                display: "flex", alignItems: "center", gap: 12,
                marginBottom: 14,
              }}>
                {/* Avatar initial */}
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg,#22C55E,#16A34A)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'Barlow Condensed',sans-serif",
                  fontSize: 18, fontWeight: 900, color: "#fff",
                  boxShadow: "0 4px 10px rgba(22,163,74,.3)",
                }}>
                  {knownName ? knownName.charAt(0).toUpperCase() : knownEmail.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {knownName && (
                    <div style={{
                      fontFamily: "'Barlow Condensed',sans-serif",
                      fontSize: 16, fontWeight: 900, color: C.text,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {knownName}
                    </div>
                  )}
                  {knownEmail && (
                    <div style={{
                      fontSize: 12.5, color: C.textMid, fontWeight: 500,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      marginTop: knownName ? 1 : 0,
                    }}>
                      {knownEmail}
                    </div>
                  )}
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 800, color: C.accentDim,
                  fontFamily: "'Barlow Condensed',sans-serif",
                  letterSpacing: ".1em", textTransform: "uppercase",
                  background: C.surface, border: `1px solid ${C.accentBorder}`,
                  borderRadius: 100, padding: "3px 9px", flexShrink: 0,
                }}>
                  Signed in ✓
                </div>
              </div>
            ) : (
              /* Not logged in — show editable name + email fields */
              <>
                {[
                  { key: "name",  label: "Full Name",     placeholder: "Marcus Johnson",     type: "text"  },
                  { key: "email", label: "Email Address", placeholder: "marcus@example.com", type: "email" },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 14 }}>
                    <div style={{
                      fontSize: 10.5, fontWeight: 700, color: C.textMid,
                      letterSpacing: "1.4px", textTransform: "uppercase",
                      fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 6,
                    }}>
                      {f.label}
                    </div>
                    <input
                      type={f.type}
                      placeholder={f.placeholder}
                      value={form[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      style={{
                        width: "100%", background: C.surfaceRaised,
                        border: `1.5px solid ${C.border}`,
                        borderRadius: 12, padding: "12px 14px",
                        color: C.text, fontFamily: "'Barlow',sans-serif",
                        fontSize: 14, fontWeight: 500, outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                ))}
              </>
            )}

            {/* LinkedIn — always shown */}
            {[
              { key: "linkedin", label: "LinkedIn / Portfolio (optional)", placeholder: "linkedin.com/in/…", type: "text" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <div style={{
                  fontSize: 10.5, fontWeight: 700, color: C.textMid,
                  letterSpacing: "1.4px", textTransform: "uppercase",
                  fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 6,
                }}>
                  {f.label}
                </div>
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{
                    width: "100%", background: C.surfaceRaised,
                    border: `1.5px solid ${C.border}`,
                    borderRadius: 12, padding: "12px 14px",
                    color: C.text, fontFamily: "'Barlow',sans-serif",
                    fontSize: 14, fontWeight: 500, outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 10.5, fontWeight: 700, color: C.textMid,
                letterSpacing: "1.4px", textTransform: "uppercase",
                fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 6,
              }}>
                Why UaTob?
              </div>
              <textarea
                placeholder="Tell us what excites you about this role…"
                value={form.message}
                onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                rows={4}
                style={{
                  width: "100%", background: C.surfaceRaised,
                  border: `1.5px solid ${C.border}`,
                  borderRadius: 12, padding: "12px 14px",
                  color: C.text, fontFamily: "'Barlow',sans-serif",
                  fontSize: 14, fontWeight: 500, outline: "none",
                  resize: "vertical", boxSizing: "border-box",
                }}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!form.name.trim() || !form.email.trim()}
              style={{
                width: "100%", padding: "16px",
                background: "linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)",
                border: "none", borderRadius: 100,
                color: "#fff", fontWeight: 800, fontSize: 15,
                fontFamily: "'Barlow',sans-serif", cursor: "pointer",
                opacity: (!form.name.trim() || !form.email.trim()) ? 0.5 : 1,
              }}
            >
              Submit Application →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Role Card ─────────────────────────────────────────────────────────
function RoleCard({ role, dept, onApply, onApplyGated }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      background: C.surface,
      border: `1.5px solid ${open ? dept.colorBorder : C.border}`,
      borderRadius: 18,
      marginBottom: 10,
      overflow: "hidden",
      transition: "border-color .2s, box-shadow .2s",
      boxShadow: open ? `0 4px 20px ${dept.color}12` : "0 1px 4px rgba(0,0,0,.04)",
    }}>
      {/* Header row */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          padding: "18px 20px",
          display: "flex", alignItems: "center", gap: 14,
          cursor: "pointer",
        }}
      >
        <div style={{
          width: 42, height: 42, borderRadius: 13, flexShrink: 0,
          background: open ? dept.colorLight : C.surfaceBright,
          border: `1.5px solid ${open ? dept.colorBorder : C.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: open ? dept.color : C.textDim,
          transition: "all .2s",
        }}>
          {dept.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Barlow Condensed',sans-serif",
            fontSize: 18, fontWeight: 900, color: C.text,
            letterSpacing: "-.2px", lineHeight: 1.2,
          }}>
            {role.title}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 5 }}>
            <span style={{
              fontSize: 10.5, fontWeight: 700, color: C.textMid,
              background: C.surfaceBright, border: `1px solid ${C.border}`,
              borderRadius: 100, padding: "2px 9px",
              fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: ".08em",
            }}>
              {role.location}
            </span>
            <span style={{
              fontSize: 10.5, fontWeight: 700, color: C.textMid,
              background: C.surfaceBright, border: `1px solid ${C.border}`,
              borderRadius: 100, padding: "2px 9px",
              fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: ".08em",
            }}>
              {role.type}
            </span>
          </div>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{
            fontFamily: "'Barlow Condensed',sans-serif",
            fontSize: 14, fontWeight: 900,
            color: dept.color,
          }}>
            {role.pay}
          </div>
          <div style={{
            marginTop: 6,
            width: 28, height: 28,
            background: open ? dept.colorLight : C.surfaceBright,
            border: `1.5px solid ${open ? dept.colorBorder : C.border}`,
            borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            marginLeft: "auto",
            transition: "all .2s",
          }}>
            <svg
              width="12" height="12" viewBox="0 0 24 24"
              fill="none" stroke={open ? dept.color : C.textDim}
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded body */}
      {open && (
        <div style={{
          borderTop: `1px solid ${C.border}`,
          padding: "20px 20px 22px",
          animation: "expandDown .2s ease",
        }}>
          <p style={{ fontSize: 14, color: C.textMid, lineHeight: 1.65, marginBottom: 20, fontWeight: 500 }}>
            {role.desc}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
            {/* Requirements */}
            <div style={{
              background: C.surfaceRaised,
              border: `1px solid ${C.border}`,
              borderRadius: 14, padding: "14px 16px",
            }}>
              <div style={{
                fontSize: 10, fontWeight: 800, color: C.textMid,
                letterSpacing: "1.4px", textTransform: "uppercase",
                fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 10,
              }}>
                Requirements
              </div>
              {role.reqs.map((r, i) => (
                <div key={i} style={{
                  display: "flex", gap: 8, alignItems: "flex-start",
                  fontSize: 12.5, color: C.textMid, fontWeight: 500,
                  marginBottom: i < role.reqs.length - 1 ? 7 : 0,
                  lineHeight: 1.45,
                }}>
                  <div style={{
                    width: 5, height: 5, borderRadius: "50%",
                    background: C.borderBright, flexShrink: 0, marginTop: 5,
                  }} />
                  {r}
                </div>
              ))}
            </div>

            {/* Perks */}
            <div style={{
              background: `linear-gradient(135deg, ${dept.colorLight}, rgba(255,255,255,0))`,
              border: `1px solid ${dept.colorBorder}`,
              borderRadius: 14, padding: "14px 16px",
            }}>
              <div style={{
                fontSize: 10, fontWeight: 800, color: dept.color,
                letterSpacing: "1.4px", textTransform: "uppercase",
                fontFamily: "'Barlow Condensed',sans-serif",
                opacity: 0.85, marginBottom: 10,
              }}>
                Perks
              </div>
              {role.perks.map((p, i) => (
                <div key={i} style={{
                  display: "flex", gap: 8, alignItems: "flex-start",
                  fontSize: 12.5, color: C.textMid, fontWeight: 500,
                  marginBottom: i < role.perks.length - 1 ? 7 : 0,
                  lineHeight: 1.45,
                }}>
                  <div style={{
                    width: 5, height: 5, borderRadius: "50%",
                    background: dept.color, flexShrink: 0, marginTop: 5,
                    opacity: 0.6,
                  }} />
                  {p}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onApplyGated(role, dept)}
            style={{
              width: "100%", padding: "14px",
              background: `linear-gradient(135deg, ${dept.color}EE, ${dept.color})`,
              border: "none", borderRadius: 100,
              color: "#fff", fontWeight: 800, fontSize: 14,
              fontFamily: "'Barlow',sans-serif", cursor: "pointer",
              letterSpacing: ".3px",
              boxShadow: `0 6px 18px ${dept.color}35`,
            }}
          >
            Apply for This Role →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function Careers() {
  const { uid, user } = useAuthContext();

  const [activeModal,   setActiveModal]   = useState(null); // { role, dept }
  const [activeDept,    setActiveDept]    = useState("all");
  const [showAuthGate,  setShowAuthGate]  = useState(false);
  const [pendingRole,   setPendingRole]   = useState(null); // { role, dept } — held until auth completes

  const totalRoles = DEPARTMENTS.reduce((a, d) => a + d.roles.length, 0);

  // Called from every "Apply for This Role" button
  const handleApplyGated = (role, dept) => {
    if (uid) {
      // Already logged in — open apply modal directly
      setActiveModal({ role, dept });
    } else {
      // Not logged in — stash the role and show auth gate
      setPendingRole({ role, dept });
      setShowAuthGate(true);
    }
  };

  // Called after successful login/signup inside AuthGateModal
  const handleAuthSuccess = () => {
    setShowAuthGate(false);
    if (pendingRole) {
      setActiveModal(pendingRole);
      setPendingRole(null);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      fontFamily: '"Barlow", system-ui, sans-serif',
      color: C.text,
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800;900&family=Barlow+Condensed:wght@500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, textarea { transition: border-color .2s, box-shadow .2s; }
        input:focus, textarea:focus { border-color: #16A34A !important; box-shadow: 0 0 0 4px rgba(22,163,74,.1) !important; }
        @keyframes fadeIn      { from { opacity: 0 }                          to { opacity: 1 } }
        @keyframes slideUp     { from { transform: translateY(40px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes expandDown  { from { opacity: 0; transform: translateY(-6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes revealUp    { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes spin        { to { transform: rotate(360deg) } }
      `}} />

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 18px 100px" }}>

        {/* ── Nav ── */}
        <div style={{
          padding: "26px 0 22px",
          display: "flex", alignItems: "center", gap: 14,
          borderBottom: `1px solid ${C.border}`,
          marginBottom: 40,
        }}>
          <UaTobIcon size={42} />
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "'Barlow Condensed',sans-serif",
              fontSize: 10, fontWeight: 700, color: C.textDim,
              letterSpacing: "2px", textTransform: "uppercase", marginBottom: 2,
            }}>
              UaTob · Careers
            </div>
            <div style={{
              fontFamily: "'Barlow Condensed',sans-serif",
              fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: "-.5px",
            }}>
              Join the Team
            </div>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: C.accentGlow,
            border: `1px solid ${C.accentBorder}`,
            borderRadius: 100, padding: "6px 14px",
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              background: C.accent,
              animation: "pulse 1.8s ease-in-out infinite",
            }} />
            <span style={{
              fontSize: 11, fontWeight: 800, color: C.accentDim,
              fontFamily: "'Barlow Condensed',sans-serif",
              letterSpacing: ".12em", textTransform: "uppercase",
            }}>
              Hiring Now
            </span>
          </div>
        </div>

        {/* ── Hero ── */}
        <div style={{ marginBottom: 44, animation: "revealUp .5s ease-out" }}>
          <div style={{
            fontFamily: "'Barlow Condensed',sans-serif",
            fontSize: "clamp(36px, 8vw, 52px)",
            fontWeight: 900, color: C.text,
            letterSpacing: "-1.5px", lineHeight: 1.08,
            marginBottom: 14,
          }}>
            Build the future of<br/>
            <span style={{ color: C.accent }}>Orlando rideshare.</span>
          </div>
          <p style={{
            fontSize: 15, color: C.textMid, fontWeight: 500, lineHeight: 1.7,
            maxWidth: 520, marginBottom: 28,
          }}>
            UaTob is Orlando's local rideshare platform — no corporate overhead, no surge pricing, and drivers keep 75% of every fare. We're a small team building fast. Every hire matters.
          </p>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { val: totalRoles,   label: "Open Roles"     },
              { val: "75%",        label: "Driver Cut"     },
              { val: "Orlando",    label: "HQ"             },
              { val: "Early",      label: "Stage"          },
            ].map((s, i) => (
              <div key={i} style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 14, padding: "12px 18px",
                textAlign: "center",
                boxShadow: "0 1px 4px rgba(0,0,0,.04)",
                animation: `revealUp .4s ease-out ${i * 0.07}s both`,
              }}>
                <div style={{
                  fontFamily: "'Barlow Condensed',sans-serif",
                  fontSize: 22, fontWeight: 900, color: C.text,
                }}>
                  {s.val}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textDim, letterSpacing: ".06em", textTransform: "uppercase" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Global Perks ── */}
        <div style={{ marginBottom: 44 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: C.textMid,
            letterSpacing: "1.5px", textTransform: "uppercase",
            fontFamily: "'Barlow Condensed',sans-serif",
            marginBottom: 14,
          }}>
            Why work at UaTob
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {PERKS_GLOBAL.map((p, i) => (
              <div key={i} style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: "14px 14px",
                boxShadow: "0 1px 4px rgba(0,0,0,.03)",
              }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{p.icon}</div>
                <div style={{
                  fontFamily: "'Barlow Condensed',sans-serif",
                  fontSize: 14, fontWeight: 900, color: C.text, marginBottom: 3,
                }}>
                  {p.label}
                </div>
                <div style={{ fontSize: 11.5, color: C.textDim, fontWeight: 500, lineHeight: 1.5 }}>
                  {p.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Department filter tabs ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: C.textMid,
            letterSpacing: "1.5px", textTransform: "uppercase",
            fontFamily: "'Barlow Condensed',sans-serif",
            marginBottom: 12,
          }}>
            Open Positions
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { id: "all", label: "All Roles", color: C.accent, colorLight: C.accentGlow, colorBorder: C.accentBorder },
              ...DEPARTMENTS.map(d => ({ id: d.id, label: d.label, color: d.color, colorLight: d.colorLight, colorBorder: d.colorBorder })),
            ].map(tab => {
              const isActive = activeDept === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveDept(tab.id)}
                  style={{
                    padding: "7px 15px",
                    borderRadius: 100,
                    border: `1.5px solid ${isActive ? tab.colorBorder : C.border}`,
                    background: isActive ? tab.colorLight : C.surface,
                    color: isActive ? tab.color : C.textMid,
                    fontWeight: 800, fontSize: 12,
                    fontFamily: "'Barlow Condensed',sans-serif",
                    letterSpacing: ".08em",
                    cursor: "pointer", transition: "all .18s",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Role lists by department ── */}
        {DEPARTMENTS.filter(d => activeDept === "all" || activeDept === d.id).map(dept => (
          <div key={dept.id} style={{ marginBottom: 36 }}>
            {/* Dept header */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              marginBottom: 14,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: dept.colorLight,
                border: `1.5px solid ${dept.colorBorder}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: dept.color,
              }}>
                {dept.icon}
              </div>
              <div style={{
                fontFamily: "'Barlow Condensed',sans-serif",
                fontSize: 18, fontWeight: 900, color: C.text,
                letterSpacing: "-.3px",
              }}>
                {dept.label}
              </div>
              <div style={{
                marginLeft: "auto",
                fontSize: 11, fontWeight: 700,
                color: dept.color,
                fontFamily: "'Barlow Condensed',sans-serif",
                background: dept.colorLight,
                border: `1px solid ${dept.colorBorder}`,
                borderRadius: 100, padding: "3px 10px",
              }}>
                {dept.roles.length} {dept.roles.length === 1 ? "role" : "roles"}
              </div>
            </div>

            {dept.roles.map((role, i) => (
              <RoleCard
                key={i}
                role={role}
                dept={dept}
                onApplyGated={handleApplyGated}
              />
            ))}
          </div>
        ))}

        {/* ── Footer CTA ── */}
        <div style={{
          background: "linear-gradient(135deg, rgba(22,163,74,.07), rgba(22,163,74,.02))",
          border: "1.5px solid rgba(22,163,74,.22)",
          borderRadius: 20, padding: "28px 24px",
          textAlign: "center",
          marginTop: 20,
        }}>
          <div style={{
            fontFamily: "'Barlow Condensed',sans-serif",
            fontSize: 24, fontWeight: 900, color: C.text, marginBottom: 8,
          }}>
            Don't see your role?
          </div>
          <p style={{ fontSize: 13.5, color: C.textMid, fontWeight: 500, lineHeight: 1.65, marginBottom: 20 }}>
            We're always open to great people. Send us a note at{" "}
            <a href="mailto:careers@uatob.com" style={{ color: C.accent, fontWeight: 700, textDecoration: "none" }}>
              careers@uatob.com
            </a>{" "}and tell us how you'd contribute.
          </p>
          <a
            href="mailto:careers@uatob.com"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "13px 28px",
              background: "linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)",
              border: "none", borderRadius: 100,
              color: "#fff", fontWeight: 800, fontSize: 14,
              fontFamily: "'Barlow',sans-serif",
              textDecoration: "none",
              boxShadow: "0 8px 22px rgba(22,163,74,.3)",
            }}
          >
            Get in Touch →
          </a>
        </div>
      </div>

      {/* ── Auth Gate Modal ── */}
      {showAuthGate && (
        <AuthGateModal
          onClose={() => { setShowAuthGate(false); setPendingRole(null); }}
          onAuthSuccess={handleAuthSuccess}
        />
      )}

      {/* ── Apply Modal ── */}
      {activeModal && (
        <ApplyModal
          role={activeModal.role}
          dept={activeModal.dept}
          onClose={() => setActiveModal(null)}
          user={user ?? null}
        />
      )}
    </div>
  );
}
