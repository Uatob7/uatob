import { useState } from "react";
import { Eye, EyeOff, Check, AlertCircle, Upload, Loader2 } from "lucide-react";
import { C }  from '@/App/SignUp/constants.jsx';
import { storage, uploadBytes, getDownloadURL, ref } from '@/firebase/config';

export function InputField({ label, placeholder, type = "text", icon: Icon, value, onChange, error, hint, suffix }) {
  const [focused, setFocused] = useState(false);
  const [showPw, setShowPw]   = useState(false);
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
            boxShadow: focused
              ? `0 0 0 3px rgba(22,163,74,.1)`
              : error
              ? `0 0 0 3px rgba(220,38,38,.07)`
              : "none",
          }}
        />
        {isPw && (
          <button
            onClick={() => setShowPw(p => !p)}
            style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.textDim, display: "flex", padding: 2 }}
          >
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

export function SelectField({ label, value, onChange, options, icon: Icon }) {
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
            width: "100%", background: C.surface,
            border: `1px solid ${focused ? C.accent : C.border}`,
            borderRadius: 13, padding: `13px 36px 13px ${Icon ? 42 : 14}px`,
            color: value ? C.text : C.textDim,
            fontFamily: "'Barlow', sans-serif", fontSize: 14, fontWeight: 500,
            outline: "none", appearance: "none", cursor: "pointer",
            transition: "border-color .2s",
            boxShadow: focused ? `0 0 0 3px rgba(22,163,74,.1)` : "none",
          }}
        >
          {options.map(o => (
            <option key={o.value} value={o.value} style={{ background: C.surface, color: o.value ? C.text : C.textDim }}>
              {o.label}
            </option>
          ))}
        </select>
        <svg style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%) rotate(90deg)", pointerEvents: "none" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </div>
  );
}

export function UploadBox({ label, hint, icon: Icon = Upload, uploaded, onUpload }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `documents/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      onUpload(downloadURL);
    } catch (error) {
      console.error('Upload failed:', error);
      // Optionally, show error to user
    } finally {
      setUploading(false);
    }
  };

  const handleClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf';
    input.onchange = (e) => {
      const file = e.target.files[0];
      handleFileSelect(file);
    };
    input.click();
  };

  return (
    <div
      onClick={uploading ? undefined : handleClick}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { 
        e.preventDefault(); 
        setDragging(false); 
        const file = e.dataTransfer.files[0];
        handleFileSelect(file);
      }}
      style={{
        background: uploaded ? "rgba(22,163,74,.04)" : dragging ? C.accentGlow : C.surfaceRaised,
        border: `1.5px dashed ${uploaded ? "rgba(22,163,74,.4)" : dragging ? C.accent : C.border}`,
        borderRadius: 16, padding: "22px 18px", cursor: uploading ? "not-allowed" : "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        transition: "all .2s", textAlign: "center", marginBottom: 12,
        opacity: uploading ? 0.6 : 1,
      }}
    >
      <div style={{ width: 44, height: 44, background: uploaded ? "rgba(22,163,74,.12)" : C.surfaceBright, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .2s" }}>
        {uploading ? <Loader2 size={20} color={C.textMid} className="animate-spin" /> : uploaded ? <Check size={20} color={C.green} /> : <Icon size={20} color={C.textMid} />}
      </div>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: uploaded ? C.green : C.text, marginBottom: 3 }}>
          {uploading ? "Uploading..." : uploaded ? "Uploaded ✓" : label}
        </div>
        <div style={{ fontSize: 11.5, color: C.textDim, fontWeight: 500 }}>{hint}</div>
      </div>
    </div>
  );
}