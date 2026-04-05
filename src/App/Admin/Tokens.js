// src/App/UaTob/Admin/tokens.js

export const C = {
  bg:          "#F2F5F2",
  surface:     "#FFFFFF",
  surfaceHigh: "#EEF1EE",
  border:      "#DDE5DD",
  borderLight: "#C8D4C8",
  text:        "#111827",
  textMuted:   "#6B7280",
  textDim:     "#9CA3AF",
  green:       "#16A34A",
  greenDark:   "#15803D",
  greenGlow:   "rgba(22,163,74,0.10)",
  blue:        "#2563EB",
  blueGlow:    "rgba(37,99,235,0.10)",
  amber:       "#B45309",
  amberGlow:   "rgba(180,83,9,0.10)",
  red:         "#DC2626",
  redGlow:     "rgba(220,38,38,0.10)",
  purple:      "#7C3AED",
  purpleGlow:  "rgba(124,58,237,0.10)",
};

export const STATUS_CONFIG = {
  in_progress:      { label: "In Progress", color: C.blue,    glow: C.blueGlow,   icon: "Activity"     },
  searching_driver: { label: "Searching",   color: C.amber,   glow: C.amberGlow,  icon: "Clock"        },
  arrived:          { label: "Arrived",     color: C.purple,  glow: C.purpleGlow, icon: "Zap"          },
  completed:        { label: "Completed",   color: C.green,   glow: C.greenGlow,  icon: "CheckCircle"  },
  cancelled:        { label: "Cancelled",   color: C.red,     glow: C.redGlow,    icon: "XCircle"      },
  online:           { label: "Online",      color: C.green,   glow: C.greenGlow,  icon: "CheckCircle"  },
  offline:          { label: "Offline",     color: C.textDim, glow: "transparent",icon: "XCircle"      },
  pending:          { label: "Pending",     color: C.amber,   glow: C.amberGlow,  icon: "Clock"        },
};

export const AVATAR_PALETTE = [
  "#16A34A","#2563EB","#7C3AED","#B45309","#DC2626","#0891B2",
];

export const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;800;900&family=Barlow:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

  * { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; }
  body { background:#F2F5F2; color:#111827; font-family:'Barlow',sans-serif; }
  ::-webkit-scrollbar { width:0; height:0; }

  @keyframes fadeUp      { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulse       { 0%,100%{opacity:1} 50%{opacity:.35} }
  @keyframes spinAnim    { to{transform:rotate(360deg)} }
  @keyframes slideInLeft { from{transform:translateX(-100%)} to{transform:translateX(0)} }
  @keyframes overlayIn   { from{opacity:0} to{opacity:1} }

  .fade-up   { animation:fadeUp .38s ease-out forwards; }
  .condensed { font-family:'Barlow Condensed',sans-serif; }
  .mono      { font-family:'JetBrains Mono',monospace; }

  .card {
    background:#FFFFFF;
    border:1px solid #DDE5DD;
    border-radius:16px;
    overflow:hidden;
    transition:border-color .15s, box-shadow .15s;
  }

  .pill {
    display:inline-flex; align-items:center; gap:5px;
    padding:3px 10px; border-radius:100px;
    font-size:11px; font-weight:700;
    letter-spacing:.4px; text-transform:uppercase;
  }

  .btn-primary {
    background:linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D);
    color:#fff; border:none; border-radius:12px; padding:13px 20px;
    font-family:'Barlow',sans-serif; font-weight:800; font-size:14px;
    cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;
    box-shadow:0 4px 14px rgba(22,163,74,.25); transition:opacity .15s;
  }
  .btn-primary:active { opacity:.85; }

  .btn-ghost {
    background:#FFFFFF; color:#111827;
    border:1px solid #DDE5DD; border-radius:12px; padding:10px 16px;
    font-family:'Barlow',sans-serif; font-weight:700; font-size:13px;
    cursor:pointer; display:flex; align-items:center; gap:6px;
    transition:background .15s;
  }
  .btn-ghost:active { background:#EEF1EE; }

  .btn-danger {
    background:rgba(220,38,38,.07); color:#DC2626;
    border:1px solid rgba(220,38,38,.2); border-radius:12px; padding:11px 16px;
    font-family:'Barlow',sans-serif; font-weight:700; font-size:13px;
    cursor:pointer; display:flex; align-items:center; gap:6px;
    transition:background .15s;
  }
  .btn-danger:active { background:rgba(220,38,38,.14); }

  .btn-success {
    background:rgba(22,163,74,.08); color:#16A34A;
    border:1px solid rgba(22,163,74,.22); border-radius:12px; padding:11px 16px;
    font-family:'Barlow',sans-serif; font-weight:700; font-size:13px;
    cursor:pointer; display:flex; align-items:center; gap:6px;
    transition:background .15s;
  }
  .btn-success:active { background:rgba(22,163,74,.16); }

  .tab-bar {
    position:fixed; bottom:0; left:0; right:0;
    background:rgba(255,255,255,.96);
    backdrop-filter:blur(14px);
    border-top:1px solid #DDE5DD;
    display:flex; z-index:100;
    padding-bottom:env(safe-area-inset-bottom);
    box-shadow:0 -2px 16px rgba(0,0,0,.06);
  }
  .tab-btn {
    flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;
    padding:10px 0 8px; border:none; background:transparent; cursor:pointer;
    color:#9CA3AF;
    font-family:'Barlow',sans-serif; font-size:10px; font-weight:700;
    letter-spacing:.5px; text-transform:uppercase; transition:color .15s;
  }
  .tab-btn.active { color:#16A34A; }

  .search-bar {
    display:flex; align-items:center; gap:10px;
    background:#FFFFFF; border:1px solid #DDE5DD; border-radius:12px;
    padding:10px 14px; box-shadow:0 1px 4px rgba(0,0,0,.04);
  }
  .search-bar input {
    flex:1; background:transparent; border:none; outline:none;
    color:#111827; font-family:'Barlow',sans-serif; font-size:14px; font-weight:500;
  }
  .search-bar input::placeholder { color:#9CA3AF; }

  .section-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
  .section-title {
    font-family:'Barlow Condensed',sans-serif;
    font-size:12px; font-weight:800; letter-spacing:1.2px;
    text-transform:uppercase; color:#6B7280;
  }

  .drawer-overlay { position:fixed; inset:0; background:rgba(0,0,0,.22); z-index:200; animation:overlayIn .2s ease; }
  .drawer {
    position:fixed; top:0; left:0; bottom:0; width:284px;
    background:#FFFFFF; border-right:1px solid #DDE5DD;
    box-shadow:6px 0 28px rgba(0,0,0,.09);
    z-index:201;
    animation:slideInLeft .25s cubic-bezier(.34,1.1,.64,1);
    display:flex; flex-direction:column; overflow-y:auto;
  }

  .live-dot  { width:7px; height:7px; border-radius:50%; background:#16A34A; animation:pulse 1.8s infinite; }
  .amber-dot { width:7px; height:7px; border-radius:50%; background:#B45309; animation:pulse 1.8s infinite; }
`;