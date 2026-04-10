import { LogOut } from "lucide-react";
import { C } from '@/App/Admin/Tokens';

export function DrawerFooter() {
  return (
    <div style={{ padding: "12px 10px", borderTop: `1px solid ${C.border}` }}>
      <button style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12,
        padding: "12px 12px", borderRadius: 12, border: "none",
        background: "transparent", color: C.red, cursor: "pointer",
        fontFamily: "'Barlow',sans-serif", fontSize: 15, fontWeight: 600,
      }}>
        <LogOut size={18} /> Sign Out
      </button>
    </div>
  );
}
