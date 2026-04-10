import { X } from "lucide-react";
import { C } from '@/App/Admin/Tokens';
import { UaTobWordmark } from '@/App/Admin/Brand';

export function DrawerHeader({ onClose }) {
  return (
    <div style={{ padding: "20px 20px 18px", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, display: "flex" }}
        >
          <X size={20} />
        </button>
      </div>
      <UaTobWordmark iconSize={38} />
      <div style={{ marginTop: 6, fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: "1.3px" }}>
        ADMIN CONSOLE
      </div>
    </div>
  );
}
