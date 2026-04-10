import { ArrowLeft } from "lucide-react";
import { C } from '@/App/Admin/Tokens';
import { SectionHeader } from '@/App/Admin/UI';

export function SettingsTab({ onBack }) {
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
      <SectionHeader title="Settings" />
      <div style={{ 
        padding: "20px 16px", 
        textAlign: "center", 
        background: C.surface, 
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        color: C.textMuted,
      }}>
        Settings management coming soon...
      </div>
    </div>
  );
}
