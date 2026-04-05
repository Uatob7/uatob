// src/App/SignUp/steps/StepDocuments.jsx
import { Shield, Camera, FileText } from "lucide-react";
import { C } from '@/App/SignUp/constants.jsx';
import { InputField, UploadBox } from '@/App/SignUp/FormFields.jsx';

export default function StepDocuments({ data, setData, errors }) {
  // Helper to clear a specific field
  const clear = (field) => setData(d => ({ ...d, [field]: null }));

  return (
    <div>
      {/* Security notice */}
      <div style={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, borderRadius: 16, padding: "14px 16px", marginBottom: 20, display: "flex", gap: 12, alignItems: "center" }}>
        <Shield size={15} color={C.blue} />
        <div style={{ fontSize: 12.5, color: C.textMid, lineHeight: 1.55 }}>
          All documents are{" "}
          <strong style={{ color: C.text }}>encrypted and stored securely</strong>.
          {" "}We only use them for driver verification.
        </div>
      </div>

      {/* ── Driver's License ── */}
      <SectionLabel>Driver's License</SectionLabel>
      <div style={{ display: "flex", gap: 10, marginBottom: 4 }}>
        <div style={{ flex: 1 }}>
          <UploadBox
            label="Front Side"
            hint="Tap to take or upload photo"
            icon={Camera}
            accept="image/*"
            uploaded={data.licenseFront}
            onUpload={v => setData(d => ({ ...d, licenseFront: v }))}
            onClear={() => clear("licenseFront")}
          />
          {errors?.licenseFront && <FieldError>{errors.licenseFront}</FieldError>}
        </div>
        <div style={{ flex: 1 }}>
          <UploadBox
            label="Back Side"
            hint="Tap to take or upload photo"
            icon={Camera}
            accept="image/*"
            uploaded={data.licenseBack}
            onUpload={v => setData(d => ({ ...d, licenseBack: v }))}
            onClear={() => clear("licenseBack")}
          />
          {errors?.licenseBack && <FieldError>{errors.licenseBack}</FieldError>}
        </div>
      </div>

      <InputField
        label="License Number"
        placeholder="D1234567"
        icon={FileText}
        value={data.licenseNumber}
        onChange={v => setData(d => ({ ...d, licenseNumber: v }))}
        hint="As shown on your license"
        error={errors?.licenseNumber}
      />

      <Divider />

      {/* ── Registration & Insurance ── */}
      <SectionLabel>Vehicle Registration & Insurance</SectionLabel>

      <UploadBox
        label="Vehicle Registration"
        hint="Photo or PDF accepted"
        icon={FileText}
        accept="image/*,application/pdf"
        uploaded={data.registration}
        onUpload={v => setData(d => ({ ...d, registration: v }))}
        onClear={() => clear("registration")}
      />
      {errors?.registration && <FieldError style={{ marginBottom: 8 }}>{errors.registration}</FieldError>}

      <UploadBox
        label="Proof of Insurance"
        hint="Must be current & valid • Photo or PDF"
        icon={Shield}
        accept="image/*,application/pdf"
        uploaded={data.insurance}
        onUpload={v => setData(d => ({ ...d, insurance: v }))}
        onClear={() => clear("insurance")}
      />
      {errors?.insurance && <FieldError style={{ marginBottom: 8 }}>{errors.insurance}</FieldError>}

      <Divider />

      {/* ── Profile Photo ── */}
      <SectionLabel>Profile Photo</SectionLabel>

      <UploadBox
        label="Your Photo"
        hint="Clear, recent headshot • No sunglasses"
        icon={Camera}
        accept="image/*"
        uploaded={data.profilePhoto}
        onUpload={v => setData(d => ({ ...d, profilePhoto: v }))}
        onClear={() => clear("profilePhoto")}
      />
      {errors?.profilePhoto && <FieldError>{errors.profilePhoto}</FieldError>}
    </div>
  );
}

/* ─── Small helpers ─────────────────────────── */

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, marginBottom: 12, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif" }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: C.border, margin: "4px 0 18px" }} />;
}

function FieldError({ children, style }) {
  return (
    <div style={{ fontSize: 11.5, color: C.error || "#ef4444", marginTop: 4, paddingLeft: 2, ...style }}>
      {children}
    </div>
  );
}
