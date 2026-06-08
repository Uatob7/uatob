import { useState } from "react";
import { Gift, Share2, Copy, Check } from "lucide-react";
import { C } from '@/App/Drivers/constants.js';

/**
 * Driver-to-driver referral nudge — the most direct "drivers grow UaTob" lever:
 * more approved drivers → more Orlando coverage → more rides for everyone.
 *
 * This is a standalone card (not a transient toast). Mount it on the Home tab,
 * inside the StatusCard cycle, or after a milestone. All economics are props so
 * you can wire them to whatever the referral program actually pays.
 *
 * Props:
 *   driverBonus  — what the referrer earns (default 50)
 *   refereeBonus — what the new driver earns (default 25)
 *   trigger      — short condition string shown to the driver (default below)
 *   referralCode — the driver's personal code
 *   shareUrl     — signup/landing link
 *   onShared     — optional callback after a successful share/copy (for analytics)
 *   onDismiss    — optional; renders a close button when provided
 */
const GOLD  = "#FCD34D";
const GREEN = "#34D399";

export default function GrowthBanner({
  driverBonus  = 50,
  refereeBonus = 25,
  trigger      = "after their first 10 trips",
  referralCode = "DRIVE-UATOB",
  shareUrl     = "https://uatob.com",
  onShared,
  onDismiss,
}) {
  const [copied, setCopied] = useState(false);

  const flash = () => { setCopied(true); setTimeout(() => setCopied(false), 1800); };

  const share = async (e) => {
    e.stopPropagation();
    const msg = `Drive with UaTob in Orlando — use my code ${referralCode} and we both get paid. ${shareUrl}`;
    try {
      if (navigator.share) await navigator.share({ title: "Drive with UaTob", text: msg, url: shareUrl });
      else { await navigator.clipboard.writeText(msg); flash(); }
      onShared?.("share");
    } catch { /* user cancelled */ }
  };

  const copyCode = async (e) => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(referralCode); flash(); onShared?.("copy"); } catch {}
  };

  return (
    <div style={{
      position: "relative", overflow: "hidden", borderRadius: 16, padding: "14px 16px",
      background: "linear-gradient(135deg, rgba(20,24,33,.96), rgba(13,17,25,.96))",
      border: "1px solid rgba(252,211,77,.22)", boxShadow: "0 8px 30px rgba(0,0,0,.45)",
    }}>
      {/* Warm corner glow */}
      <div style={{
        position: "absolute", top: -40, right: -30, width: 150, height: 150, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(252,211,77,.16), transparent 70%)", pointerEvents: "none",
      }}/>
      {/* Gold→green accent stripe */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
        background: `linear-gradient(180deg, ${GOLD}, ${GREEN})`,
      }}/>

      <div style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 12, flexShrink: 0,
          background: "rgba(252,211,77,.12)", border: "1px solid rgba(252,211,77,.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Gift size={18} color={GOLD} strokeWidth={2.2} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: '"JetBrains Mono",monospace', fontSize: 9.5, fontWeight: 800,
            letterSpacing: "0.14em", textTransform: "uppercase", color: GOLD, marginBottom: 3,
          }}>
            Grow UaTob
          </div>
          <div className="condensed" style={{
            fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: "-0.3px",
            lineHeight: 1.15, marginBottom: 4,
          }}>
            Bring a driver, earn ${driverBonus}
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: C.textMid, lineHeight: 1.4, marginBottom: 11 }}>
            They get ${refereeBonus} {trigger}. More drivers means shorter waits and more rides across Orlando.
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button onClick={copyCode} style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 9,
              background: "rgba(255,255,255,.04)", border: "1px dashed rgba(252,211,77,.4)", cursor: "pointer",
            }}>
              <span style={{
                fontFamily: '"JetBrains Mono",monospace', fontSize: 12, fontWeight: 800,
                letterSpacing: "0.08em", color: "#fff",
              }}>
                {referralCode}
              </span>
              {copied ? <Check size={13} color={GREEN} /> : <Copy size={13} color={C.textMid} />}
            </button>

            <button onClick={share} style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9,
              border: "none", cursor: "pointer", color: "#1a1407", fontWeight: 800, fontSize: 12.5,
              background: `linear-gradient(135deg, ${GOLD}, #F59E0B)`,
              boxShadow: "0 4px 14px rgba(245,158,11,.35)",
            }}>
              <Share2 size={14} strokeWidth={2.5} /> Share
            </button>
          </div>
        </div>

        {onDismiss && (
          <button onClick={(e) => { e.stopPropagation(); onDismiss(); }} style={{
            position: "absolute", top: -4, right: -4, background: "none", border: "none",
            color: C.textMid, fontSize: 18, cursor: "pointer", lineHeight: 1, padding: 4,
          }}>
            ×
          </button>
        )}
      </div>
    </div>
  );
}
