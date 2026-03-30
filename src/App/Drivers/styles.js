import { C } from './constants.js';

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800;900&family=Barlow+Condensed:wght@500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes slideDown { from{opacity:0;transform:translateY(-16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slideUp   { from{opacity:0;transform:translateY(22px)}  to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
  @keyframes scaleIn   { from{opacity:0;transform:scale(.94) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes pulse     { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.15)} }
  @keyframes greenRing { 0%,100%{box-shadow:0 0 0 0 rgba(22,163,74,.35)} 50%{box-shadow:0 0 0 14px rgba(22,163,74,0)} }
  @keyframes scanLine  { 0%{top:0%} 100%{top:100%} }
  @keyframes revealUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }

  .condensed { font-family:'Barlow Condensed', sans-serif; }
  .mono      { font-family:'IBM Plex Mono', monospace; }

  .card {
    background: ${C.surface};
    border: 1px solid ${C.border};
    border-radius: 20px;
    box-shadow: 0 2px 12px ${C.shadow};
  }

  .tab-btn {
    flex:1; background:transparent; border:none; cursor:pointer;
    display:flex; flex-direction:column; align-items:center; gap:5px;
    padding:10px 4px 12px;
    font-family:'Barlow',sans-serif; font-size:9.5px; font-weight:700;
    color:${C.textDim}; transition:color .2s; letter-spacing:1px; text-transform:uppercase;
  }
  .tab-btn.act { color:${C.offlineInk}; }

  .notif {
    position:fixed; top:18px; left:50%; transform:translateX(-50%);
    background:${C.surface}; border:1px solid ${C.border};
    border-left:3px solid #16A34A;
    color:${C.text}; border-radius:14px; padding:13px 20px;
    z-index:9999; min-width:280px; max-width:420px;
    box-shadow:0 16px 48px ${C.shadowMd};
    animation:slideDown .35s cubic-bezier(.34,1.56,.64,1);
    display:flex; align-items:center; gap:12px;
  }

  .lbl {
    font-family:'Barlow Condensed',sans-serif;
    font-size:10px; font-weight:700; color:${C.textDim};
    letter-spacing:2px; text-transform:uppercase; margin-bottom:5px;
  }

  .route-pill {
    background:${C.surfaceAlt}; border:1px solid ${C.border};
    border-radius:14px; padding:14px 16px;
  }

  .badge-chip {
    border-radius:8px; padding:3px 9px;
    font-family:'Barlow Condensed',sans-serif;
    font-size:11px; font-weight:800; letter-spacing:1px;
  }

  .map-area {
    background:linear-gradient(160deg,#FAFAFA 0%,#F3F4F6 55%,#FAFAFA 100%);
    border:1px solid ${C.border};
    border-radius:20px; position:relative; overflow:hidden;
    box-shadow:0 2px 16px ${C.shadow};
  }

  .trip-stage-bar {
    height:4px; border-radius:3px; flex:1;
    transition:background .4s, box-shadow .4s;
  }

  ::-webkit-scrollbar { width:4px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:${C.border}; border-radius:4px; }
`;

export default CSS;