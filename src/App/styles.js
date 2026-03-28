const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  @keyframes float    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-28px)} }
  @keyframes pulse    { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.18);opacity:.65} }
  @keyframes slideUp  { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
  @keyframes scaleIn  { from{opacity:0;transform:scale(.9) translateY(14px)} to{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes ripple   { 0%{transform:scale(1);opacity:.3} 100%{transform:scale(2.8);opacity:0} }
  @keyframes greenGlow { 0%,100%{box-shadow:0 0 24px rgba(22,163,74,.3)} 50%{box-shadow:0 0 48px rgba(22,163,74,.55)} }
  @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
  .field { background:#fff; border:1.5px solid #E5E7EB; border-radius:14px; padding:17px 17px 17px 50px; color:#111827; font-family:'Outfit',sans-serif; font-size:15px; font-weight:500; width:100%; transition:all .22s; outline:none; box-shadow:0 1px 4px rgba(0,0,0,.04); }
  .field::placeholder { color:#D1D5DB; }
  .field:focus { border-color:#16A34A; background:#F0FDF4; box-shadow:0 0 0 3px rgba(22,163,74,.12); }
  .auth-field { background:#fff; border:1.5px solid #E5E7EB; border-radius:12px; padding:15px 15px 15px 46px; color:#111827; font-family:'Outfit',sans-serif; font-size:15px; width:100%; transition:all .22s; outline:none; }
  .auth-field::placeholder { color:#D1D5DB; }
  .auth-field:focus { border-color:#16A34A; background:#F0FDF4; box-shadow:0 0 0 3px rgba(22,163,74,.12); }
  .ride-card { background:#fff; border:1.5px solid #E5E7EB; border-radius:18px; padding:16px 14px; cursor:pointer; transition:all .28s cubic-bezier(.4,0,.2,1); box-shadow:0 2px 8px rgba(0,0,0,.04); }
  .ride-card:hover { transform:translateY(-2px); box-shadow:0 8px 28px rgba(0,0,0,.08); }
  .ride-card.active { border-color:var(--rc); box-shadow:0 0 0 1px var(--rc), 0 8px 20px rgba(22,163,74,.08); background:#F9FAFB; }
  .cta-btn { background:linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D); border:none; border-radius:16px; padding:19px 32px; color:#fff; font-family:'Outfit',sans-serif; font-weight:800; font-size:16px; cursor:pointer; width:100%; transition:all .28s; box-shadow:0 8px 28px rgba(22,163,74,.3); }
  .cta-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 14px 40px rgba(22,163,74,.45); }
  .cta-btn:disabled { opacity:.35; cursor:not-allowed; }
  .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.14); backdrop-filter:blur(18px); display:flex; align-items:center; justify-content:center; z-index:1000; padding:20px; animation:fadeIn .22s ease; }
  .modal-box { background:#fff; border:1.5px solid #E5E7EB; border-radius:26px; padding:38px; width:100%; animation:scaleIn .32s cubic-bezier(.34,1.56,.64,1); box-shadow:0 28px 70px rgba(0,0,0,.1); position:relative; overflow:hidden; }
  .tab-btn { flex:1; background:transparent; border:none; padding:11px; font-family:'Outfit',sans-serif; font-weight:700; font-size:14px; cursor:pointer; border-radius:10px; color:#9CA3AF; transition:all .22s; }
  .tab-btn.active { background:linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D); color:#fff; box-shadow:0 4px 14px rgba(22,163,74,.28); }
  .pay-opt { background:#fff; border:1.5px solid #E5E7EB; border-radius:16px; padding:17px 18px; cursor:pointer; transition:all .22s; display:flex; align-items:center; gap:15px; }
  .pay-opt:hover { border-color:#D1D5DB; background:#FAFAFA; }
  .pay-opt.ac  { border-color:#16A34A; background:#F0FDF4; }
  .pay-opt.aca { border-color:#00D632; background:#F0FFF4; }
  .glass { background:#fff; border:1.5px solid #E5E7EB; border-radius:22px; box-shadow:0 4px 22px rgba(0,0,0,.05); }
  .live-badge { display:inline-flex; align-items:center; background:rgba(22,163,74,.1); border:1px solid rgba(22,163,74,.22); color:#16A34A; border-radius:100px; padding:5px 13px; font-size:12px; font-weight:700; gap:5px; }
  .lbl { font-size:10.5px; font-weight:700; color:#9CA3AF; letter-spacing:1.8px; text-transform:uppercase; margin-bottom:7px; }
  .suggest-box { position:absolute; top:100%; left:0; right:0; z-index:50; background:#fff; border:1.5px solid #E5E7EB; border-radius:14px; margin-top:4px; overflow:hidden; box-shadow:0 8px 28px rgba(0,0,0,.09); animation:slideDown .2s ease; }
  .suggest-item { padding:12px 18px; cursor:pointer; font-size:14px; font-weight:500; color:#111827; transition:background .15s; display:flex; align-items:center; gap:10px; }
  .suggest-item:hover { background:#F9FAFB; }
`;

export default CSS;
