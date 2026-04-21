import { ArrowLeft } from "lucide-react";
import { C } from "@/App/Admin/Tokens";
import { SectionHeader } from "@/App/Admin/UI";

export function RidersTab({ useriders, onBack }) {
  const { riders = [], loading, error } = useriders || {};

  console.log("Riders data:", useriders);

  return (
    <div style={{ padding: "0 16px 16px" }}>
      {onBack && (
        <button
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: C.textMuted,
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 16,
            fontFamily: "'Barlow', sans-serif",
          }}
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>
      )}

      <SectionHeader title="Active Riders" />

      {loading && (
        <div style={{ color: C.textMuted }}>Loading riders...</div>
      )}

      {error && (
        <div style={{ color: "red" }}>
          Error: {error.message}
        </div>
      )}

      {!loading && riders.length === 0 && (
        <div style={{ color: C.textMuted }}>
          No riders found
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {riders.map((rider) => (
          <div
            key={rider.id}
            style={{
              padding: 12,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              background: C.surface,
              color: C.text,
            }}
          >
            <div><b>Name:</b> {rider.name || "N/A"}</div>
            <div><b>Email:</b> {rider.email || "N/A"}</div>
            <div><b>UID:</b> {rider.uid}</div>
          </div>
        ))}
      </div>
    </div>
  );
}