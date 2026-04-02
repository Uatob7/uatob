import { useState, useRef } from "react";
import { ChevronRight, ChevronLeft, Check, ArrowRight } from "lucide-react";

import { C, STEPS }    from '@/App/SignUp/constants.jsx';
import { validate }     from '@/App/SignUp/validation.jsx';
import signUp           from '@/firebase/auth/signup';
import UaTobIcon        from '@/App/SignUp/UaTobIcon.jsx';
import StepAccount      from '@/App/SignUp/StepAccount.jsx';
import StepContact      from '@/App/SignUp/StepContact.jsx';
import StepVehicle      from '@/App/SignUp/StepVehicle.jsx';
import StepDocuments    from '@/App/SignUp/StepDocuments.jsx';
import StepVerify       from '@/App/SignUp/StepVerify.jsx';
import SuccessScreen    from '@/App/SignUp/SuccessScreen.jsx';

const STEP_TITLES = [
  "Create your account",
  "Where are you located?",
  "Tell us about your vehicle",
  "Upload your documents",
  "Review & submit",
];

const STEP_SUBTITLES = [
  "Set up your UaTob driver profile.",
  "We need your contact and location details.",
  "Your vehicle must meet our quality standards.",
  "Securely upload your required documents.",
  "Double-check everything before submitting.",
];

// ── Swap this URL for your deployed Cloud Function URL ───────────────────────
const CLOUD_FUNCTION_URL = "https://createdriverprofile-ady2s2xhhq-uc.a.run.app";
// ─────────────────────────────────────────────────────────────────────────────

export default function UaTobDriverSignup({ uid }) {
  const [step,       setStep]       = useState(1);
  const [direction,  setDirection]  = useState("forward");
  const [animating,  setAnimating]  = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [errors,     setErrors]     = useState({});
  const [loading,    setLoading]    = useState(false);
  const [createdUid, setCreatedUid] = useState(null);

  const [accountData, setAccountData] = useState({ firstName: "", lastName: "", email: "", password: "", confirmPassword: "", terms: false });
  const [contactData, setContactData] = useState({ phone: "", address: "", city: "", state: "", zip: "" });
  const [vehicleData, setVehicleData] = useState({ make: "", model: "", year: "", color: "", plate: "", vin: "", rideTypes: [] });
  const [docData,     setDocData]     = useState({ licenseFront: false, licenseBack: false, licenseNumber: "", registration: false, insurance: false, profilePhoto: false });
 

  console.log("Account Data:", accountData);
  console.log("Contact Data:", contactData);
  console.log("Vehicle Data:", vehicleData);
  console.log("Document Data:", docData);   


  const scrollRef = useRef(null);

  // ── Calls the Cloud Function with uid + accountData ──────────────────────
  const sendToBackend = async (uid, accountData) => {
    const res = await fetch(CLOUD_FUNCTION_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ uid, accountData }),
    });

    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error || "Failed to create driver profile");
    }

    return res.json();
  };
  // ─────────────────────────────────────────────────────────────────────────

  const handleNext = async () => {
    if (loading) return;

    const e = validate(step, { accountData, contactData, vehicleData, docData });
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }

    try {
      setLoading(true);

      // 🔥 STEP 1 — Create Firebase Auth account, then send to Cloud Function
      if (step === 1 && !createdUid) {
        const { result, error: signUpError } = await signUp(
          accountData.email.trim().toLowerCase(),
          accountData.password
        );

        if (signUpError) throw signUpError;

        const newUid = result.user.uid;
        setCreatedUid(newUid);
        console.log("UID created:", newUid);

        // Send uid + accountData to the backend
        await sendToBackend(newUid, accountData);
        console.log("Driver profile sent to backend");
      }

      // 🔥 FINAL SUBMIT
      if (step === 5) {
        const driverData = {
          uid: createdUid,
          accountData,
          contactData,
          vehicleData,
          docData,
          createdAt: new Date()
        };
        console.log("SUBMIT:", driverData);
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
      console.error(err);
      setErrors({ email: err.message || "Signup failed" });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setDirection("back");
    setAnimating(true);
    setTimeout(() => {
      setStep(s => s - 1);
      setErrors({});
      setAnimating(false);
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, 200);
  };

  if (submitted) {
    return <SuccessScreen firstName={accountData.firstName} email={accountData.email} />;
  }

  const pct = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: '"Barlow", system-ui, sans-serif', color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800;900&family=Barlow+Condensed:wght@500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: ${C.textDim}; }
        select option { background: ${C.surface}; color: ${C.text}; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }

        @keyframes slideForward { from{opacity:0;transform:translateX(28px)}  to{opacity:1;transform:translateX(0)} }
        @keyframes slideBack    { from{opacity:0;transform:translateX(-28px)} to{opacity:1;transform:translateX(0)} }
        @keyframes fadeOut      { to{opacity:0} }
        @keyframes revealUp     { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scaleIn      { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:scale(1)} }
        @keyframes fadeUp       { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes greenPulse   { 0%,100%{box-shadow:0 4px 18px rgba(22,163,74,.25)} 50%{box-shadow:0 4px 28px rgba(22,163,74,.5)} }

        .green-btn {
          background: linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D);
          border: none; border-radius: 15px; color: #fff;
          font-family: 'Barlow', sans-serif; font-weight: 800; font-size: 15px;
          cursor: pointer; transition: all .22s; letter-spacing: .3px;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          animation: greenPulse 3s ease-in-out infinite;
        }
        .green-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 28px rgba(22,163,74,.4) !important; }
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
      `}</style>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px 120px", minHeight: "100vh" }}>

        {/* Header */}
        <div style={{ padding: "28px 0 24px", display: "flex", alignItems: "center", gap: 14 }}>
          <UaTobIcon size={38} />
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 2 }}>
              Driver Signup
            </div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 21, fontWeight: 900, color: C.text, letterSpacing: "-0.3px" }}>
              Start Driving Today
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ height: 3, background: C.surfaceBright, borderRadius: 2, marginBottom: 18, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#15803D,#16A34A,#22C55E)", borderRadius: 2, transition: "width .5s cubic-bezier(.34,1.2,.64,1)", boxShadow: "0 0 10px rgba(22,163,74,.4)" }} />
          </div>

          {/* Step pills */}
          <div style={{ display: "flex", gap: 6 }}>
            {STEPS.map(s => {
              const done   = step > s.id;
              const active = step === s.id;
              return (
                <div
                  key={s.id}
                  style={{ flex: 1, background: done ? C.accentGlow : active ? C.surface : C.surfaceRaised, border: `1px solid ${done ? C.accentBorder : active ? "rgba(22,163,74,.3)" : C.border}`, borderRadius: 12, padding: "9px 6px", textAlign: "center", transition: "all .3s", boxShadow: active ? "0 1px 6px rgba(22,163,74,.12)" : "none" }}
                >
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
            {STEP_TITLES[step - 1]}
          </div>
          <div style={{ fontSize: 13.5, color: C.textMid, marginTop: 5, fontWeight: 500 }}>
            {STEP_SUBTITLES[step - 1]}
          </div>
        </div>

        {/* Step content */}
        <div
          ref={scrollRef}
          style={{ animation: animating ? "fadeOut .15s ease forwards" : direction === "forward" ? "slideForward .35s cubic-bezier(.25,.46,.45,.94)" : "slideBack .35s cubic-bezier(.25,.46,.45,.94)" }}
        >
          {step === 1 && <StepAccount   data={accountData} setData={setAccountData} errors={errors} />}
          {step === 2 && <StepContact   data={contactData} setData={setContactData} errors={errors} />}
          {step === 3 && <StepVehicle   data={vehicleData} setData={setVehicleData} errors={errors} />}
          {step === 4 && <StepDocuments data={docData}     setData={setDocData}     errors={errors} />}
          {step === 5 && <StepVerify    accountData={accountData} contactData={contactData} vehicleData={vehicleData} docData={docData} />}
        </div>
      </div>

      {/* Sticky bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(250,250,250,.97)", backdropFilter: "blur(24px)", borderTop: `1px solid ${C.border}`, padding: "14px 20px 20px", boxShadow: "0 -8px 32px rgba(0,0,0,.06)" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", gap: 10, alignItems: "center" }}>
          {step > 1 && (
            <button className="ghost-btn" onClick={handleBack} style={{ padding: "15px 20px" }}>
              <ChevronLeft size={17} /> Back
            </button>
          )}
          <button
            className="green-btn"
            onClick={handleNext}
            disabled={loading || animating}
            style={{ flex: 1, padding: "16px 24px" }}
          >
            {loading
              ? <span>Please wait…</span>
              : step === 5
                ? <><span>Submit Application</span><ArrowRight size={17} /></>
                : <><span>Continue</span><ChevronRight size={17} /></>
            }
          </button>
        </div>

        {/* Dot progress */}
        <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 12 }}>
          {STEPS.map(s => (
            <div
              key={s.id}
              style={{ width: step === s.id ? 20 : 6, height: 3, background: step >= s.id ? C.accent : C.surfaceBright, borderRadius: 2, transition: "all .35s cubic-bezier(.34,1.2,.64,1)" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}