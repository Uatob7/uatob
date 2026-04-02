import { Shield, Camera, FileText } from "lucide-react";
import { C } from '@/App/SignUp/constants.jsx';
import { InputField, UploadBox } from '@/App/SignUp/FormFields.jsx';

export default function StepDocuments({ data, setData }) {
  return (
    <div>
      {/* Security notice */}
      <div style={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, borderRadius: 16, padding: "14px 16px", marginBottom: 20, display: "flex", gap: 12, alignItems: "center" }}>
        <Shield size={15} color={C.blue} />
        <div style={{ fontSize: 12.5, color: C.textMid, lineHeight: 1.55 }}>
          All documents are{" "}
          <strong style={{ color: C.text }}>encrypted and stored securely</strong>. We only use them for driver verification.
        </div>
      </div>

      {/* Driver's License */}
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, marginBottom: 12, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif" }}>
        Driver's License
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 4 }}>
        <div style={{ flex: 1 }}>
          <UploadBox label="Front Side" hint="Tap to upload photo" icon={Camera} uploaded={data.licenseFront} onUpload={v => setData(d => ({ ...d, licenseFront: v }))} />
        </div>
        <div style={{ flex: 1 }}>
          <UploadBox label="Back Side" hint="Tap to upload photo" icon={Camera} uploaded={data.licenseBack} onUpload={v => setData(d => ({ ...d, licenseBack: v }))} />
        </div>
      </div>
      <InputField
        label="License Number" placeholder="D1234567" icon={FileText}
        value={data.licenseNumber} onChange={v => setData(d => ({ ...d, licenseNumber: v }))}
        hint="As shown on your license"
      />

      <div style={{ height: 1, background: C.border, margin: "4px 0 18px" }} />

      {/* Registration & Insurance */}
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, marginBottom: 12, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif" }}>
        Vehicle Registration & Insurance
      </div>
      <UploadBox label="Vehicle Registration" hint="Photo or PDF accepted" icon={FileText} uploaded={data.registration} onUpload={v => setData(d => ({ ...d, registration: v }))} />
      <UploadBox label="Proof of Insurance" hint="Must be current & valid" icon={Shield} uploaded={data.insurance} onUpload={v => setData(d => ({ ...d, insurance: v }))} />

      <div style={{ height: 1, background: C.border, margin: "4px 0 18px" }} />

      {/* Profile photo */}
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, marginBottom: 12, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif" }}>
        Profile Photo
      </div>
      <UploadBox label="Your Photo" hint="Clear, recent headshot • No sunglasses" icon={Camera} uploaded={data.profilePhoto} onUpload={v => setData(d => ({ ...d, profilePhoto: v }))} />
    </div>
  );
}