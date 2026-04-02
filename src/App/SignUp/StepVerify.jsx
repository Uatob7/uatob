import { CheckCircle, Clock, Zap } from "lucide-react";
import { C } from '@/App/SignUp/constants.jsx';

function Section({ title, items }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, marginBottom: 12, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif" }}>
        {title}
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
        {items.map((item, i) => (
          <div
            key={i}
            style={{ padding: "12px 16px", borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <span style={{ fontSize: 12.5, color: C.textMid, fontWeight: 500 }}>{item.label}</span>
            <span style={{ fontSize: 13, color: item.val ? C.text : C.textDim, fontWeight: 600, maxWidth: "55%", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.val || "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StepVerify({ accountData, contactData, vehicleData, docData }) {
  const allDocs = docData.licenseFront && docData.licenseBack && docData.registration && docData.insurance && docData.profilePhoto;

  return (
    <div>
      {/* Status banner */}
      <div style={{ background: allDocs ? "rgba(22,163,74,.05)" : "rgba(22,163,74,.04)", border: `1px solid ${allDocs ? "rgba(22,163,74,.25)" : "rgba(22,163,74,.18)"}`, borderRadius: 16, padding: "16px 18px", marginBottom: 22, display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ width: 38, height: 38, background: allDocs ? "rgba(22,163,74,.12)" : C.accentGlow, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {allDocs ? <CheckCircle size={18} color={C.green} /> : <Clock size={18} color={C.accent} />}
        </div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.accent, marginBottom: 2 }}>
            {allDocs ? "All documents uploaded" : "Some documents missing"}
          </div>
          <div style={{ fontSize: 11.5, color: C.textMid }}>
            {allDocs ? "Your application is ready to submit for review." : "You can still submit — upload remaining docs later."}
          </div>
        </div>
      </div>

      <Section
        title="Account"
        items={[
          { label: "Name",  val: `${accountData.firstName} ${accountData.lastName}` },
          { label: "Email", val: accountData.email },
        ]}
      />
      <Section
        title="Contact"
        items={[
          { label: "Phone",         val: contactData.phone },
          { label: "Address",       val: contactData.address },
          { label: "City / State",  val: contactData.city && contactData.state ? `${contactData.city}, ${contactData.state} ${contactData.zip}` : "" },
        ]}
      />
      <Section
        title="Vehicle"
        items={[
          { label: "Vehicle",    val: vehicleData.make && vehicleData.model ? `${vehicleData.year} ${vehicleData.make} ${vehicleData.model}` : "" },
          { label: "Plate",      val: vehicleData.plate },
          { label: "Ride Types", val: vehicleData.rideTypes?.join(", ") },
        ]}
      />
      <Section
        title="Documents"
        items={[
          { label: "Driver's License", val: (docData.licenseFront && docData.licenseBack) ? "✓ Uploaded" : "Pending"  },
          { label: "Registration",     val: docData.registration ? "✓ Uploaded" : "Pending"  },
          { label: "Insurance",        val: docData.insurance    ? "✓ Uploaded" : "Pending"  },
          { label: "Profile Photo",    val: docData.profilePhoto ? "✓ Uploaded" : "Pending"  },
        ]}
      />

      {/* Review timeline note */}
      <div style={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", marginTop: 4, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Zap size={14} color={C.accent} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: C.textMid, lineHeight: 1.6 }}>
          After submission, our team will review your application within{" "}
          <strong style={{ color: C.text }}>24–48 hours</strong>. You'll receive an email when you're approved to start driving.
        </div>
      </div>
    </div>
  );
}