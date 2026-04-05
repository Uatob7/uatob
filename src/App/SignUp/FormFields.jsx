// src/App/SignUp/FormFields.jsx
import { useState, useRef } from "react";
import { Eye, EyeOff, AlertCircle, Upload, Check, X } from "lucide-react";
import { C } from '@/App/SignUp/constants.jsx';

/* ─── InputField ─────────────────────────────── */
export function InputField({ label, placeholder, type = "text", icon: Icon, value, onChange, error, hint, suffix }) {
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
          <button
            type="button"
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

/* ─── UploadBox ──────────────────────────────── */
// `uploaded` is either falsy (nothing yet) or a data-URL string (preview).
// `onUpload(dataURL)` is called with the base64 string on file select.
// `onClear()` is called when the user removes the file.
// `accept` defaults to images; pass "image/*,application/pdf" for docs that allow PDFs.
export function UploadBox({ label, hint, icon: Icon = Upload, uploaded, onUpload, onClear, accept = "image/*" }) {
  const inputRef  = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [loading,  setLoading]  = useState(false);

  const hasFile = Boolean(uploaded);
  const isImage = hasFile && uploaded.startsWith("data:image");

  const handleFiles = (files) => {
    const file = files?.[0];
    if (!file) return;

    // 10 MB guard
    if (file.size > 10 * 1024 * 1024) {
      alert("File is too large. Please upload a file under 10 MB.");
      return;
    }

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      onUpload(e.target.result); // passes back the data URL
      setLoading(false);
    };
    reader.onerror = () => {
      alert("Could not read file. Please try again.");
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleClick = () => {
    if (hasFile) return; // clicking the preview area does nothing; use the X to clear
    inputRef.current?.click();
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onClear?.();
    // Reset the hidden input so the same file can be re-selected
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div style={{ marginBottom: 12, position: "relative" }}>
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={accept === "image/*" ? "environment" : undefined}
        style={{ display: "none" }}
        onChange={e => handleFiles(e.target.files)}
      />

      <div
        onClick={handleClick}
        onDragOver={e => { e.preventDefault(); if (!hasFile) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          if (!hasFile) handleFiles(e.dataTransfer.files);
        }}
        style={{
          background: hasFile ? "rgba(22,163,74,.04)" : dragging ? "rgba(22,163,74,.08)" : C.surfaceRaised,
          border: `1.5px dashed ${hasFile ? "rgba(22,163,74,.4)" : dragging ? C.accent : C.border}`,
          borderRadius: 16,
          overflow: "hidden",
          cursor: hasFile ? "default" : "pointer",
          transition: "all .2s",
          minHeight: hasFile && isImage ? 0 : 110,
        }}
      >
        {/* ── Image preview ── */}
        {hasFile && isImage && (
          <div style={{ position: "relative" }}>
            <img
              src={uploaded}
              alt="Uploaded preview"
              style={{ width: "100%", maxHeight: 180, objectFit: "cover", display: "block", borderRadius: 14 }}
            />
            {/* Clear button overlaid on the image */}
            <button
              type="button"
              onClick={handleClear}
              style={{
                position: "absolute", top: 8, right: 8,
                background: "rgba(0,0,0,.55)", border: "none", borderRadius: "50%",
                width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#fff",
              }}
            >
              <X size={14} />
            </button>
            <div style={{ padding: "8px 12px 10px", display: "flex", alignItems: "center", gap: 6 }}>
              <Check size={13} color={C.accent} />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>{label} uploaded</span>
            </div>
          </div>
        )}

        {/* ── Non-image file (PDF etc.) ── */}
        {hasFile && !isImage && (
          <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, background: "rgba(22,163,74,.12)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Check size={18} color={C.accent} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.accent }}>File uploaded ✓</div>
              <div style={{ fontSize: 11.5, color: C.textDim }}>{hint}</div>
            </div>
            <button
              type="button"
              onClick={handleClear}
              style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 8px", cursor: "pointer", color: C.textDim, display: "flex", alignItems: "center" }}
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* ── Empty / loading state ── */}
        {!hasFile && (
          <div style={{ padding: "22px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
            <div style={{ width: 44, height: 44, background: loading ? "rgba(22,163,74,.08)" : C.surfaceBright, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .2s" }}>
              {loading
                ? <div style={{ width: 18, height: 18, border: `2px solid ${C.accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                : <Icon size={20} color={C.textMid} />
              }
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, marginBottom: 3 }}>
                {loading ? "Reading file…" : label}
              </div>
              <div style={{ fontSize: 11.5, color: C.textDim, fontWeight: 500 }}>{hint}</div>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
