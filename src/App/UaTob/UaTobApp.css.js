export const EXTRA_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');

  @keyframes fadeIn    { from{opacity:0}                                        to{opacity:1} }
  @keyframes slideUp   { from{opacity:0;transform:translateY(14px)}             to{opacity:1;transform:translateY(0)} }
  @keyframes modalIn   { from{opacity:0;transform:translateY(22px) scale(.97)}  to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes overlayIn { from{opacity:0}                                        to{opacity:1} }
  @keyframes spinAnim  { to{transform:rotate(360deg)} }

  .login-badge {
    display:inline-flex; align-items:center; gap:7px;
    background:#111827;
    border:none; border-radius:100px;
    padding:7px 15px 7px 12px;
    font-family:'Outfit',system-ui,sans-serif;
    font-size:12px; font-weight:800;
    color:#fff; letter-spacing:.3px;
    cursor:pointer;
    box-shadow:0 3px 12px rgba(17,24,39,.18);
    transition:opacity .15s, transform .15s;
  }
  .login-badge:active { opacity:.85; transform:scale(.97); }

  .account-btn {
    width:36px; height:36px; border-radius:50%;
    background:linear-gradient(135deg,#16A34A,#15803D);
    border:none; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    box-shadow:0 3px 12px rgba(22,163,74,.3);
    transition:opacity .15s, transform .15s;
    flex-shrink:0;
  }
  .account-btn:active { opacity:.85; transform:scale(.95); }

  .auth-overlay {
    position:fixed; inset:0; z-index:500;
    background:rgba(0,0,0,.45);
    backdrop-filter:blur(5px);
    display:flex; align-items:flex-end; justify-content:center;
    animation:overlayIn .2s ease;
    padding:0;
  }
  @media(min-height:600px) {
    .auth-overlay { align-items:center; padding:24px; }
  }

  .auth-sheet {
    background:#fff;
    border-radius:24px 24px 0 0;
    width:100%; max-width:420px;
    padding:28px 24px 40px;
    box-shadow:0 -8px 48px rgba(0,0,0,.14);
    animation:modalIn .32s cubic-bezier(.34,1.2,.64,1);
    position:relative;
    max-height:90vh;
    overflow-y:auto;
  }
  @media(min-height:600px) {
    .auth-sheet { border-radius:24px; max-height:none; }
  }

  .auth-input-wrap { position:relative; margin-bottom:12px; }

  .auth-input {
    width:100%; padding:13px 16px;
    background:#F9FAFB; border:1.5px solid #E5E7EB;
    border-radius:13px; outline:none;
    font-family:'Outfit',system-ui,sans-serif;
    font-size:14px; font-weight:500; color:#111827;
    transition:border-color .15s, box-shadow .15s;
    box-sizing:border-box;
  }
  .auth-input:focus {
    border-color:#16A34A;
    box-shadow:0 0 0 3px rgba(22,163,74,.12);
    background:#fff;
  }
  .auth-input::placeholder { color:#9CA3AF; }
  .auth-input.has-toggle   { padding-right:46px; }

  .auth-eye-btn {
    position:absolute; right:14px; top:50%;
    transform:translateY(-50%);
    background:none; border:none; cursor:pointer;
    color:#9CA3AF; display:flex; padding:0;
    transition:color .15s;
  }
  .auth-eye-btn:hover { color:#6B7280; }

  .auth-submit {
    width:100%; padding:14px;
    background:linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D);
    color:#fff; border:none; border-radius:14px;
    font-family:'Outfit',system-ui,sans-serif;
    font-size:15px; font-weight:800;
    cursor:pointer; margin-top:6px;
    box-shadow:0 4px 16px rgba(22,163,74,.28);
    display:flex; align-items:center; justify-content:center; gap:8px;
    transition:opacity .15s;
  }
  .auth-submit:active   { opacity:.85; }
  .auth-submit:disabled { opacity:.6; cursor:not-allowed; }

  .auth-toggle-link {
    background:none; border:none; cursor:pointer;
    color:#16A34A; font-weight:700;
    font-family:'Outfit',system-ui,sans-serif;
    font-size:13px; padding:0;
    text-decoration:underline;
    text-underline-offset:2px;
  }

  .auth-error {
    background:rgba(220,38,38,.07);
    border:1px solid rgba(220,38,38,.2);
    border-radius:10px; padding:10px 14px;
    color:#DC2626; font-size:13px; font-weight:600;
    margin-bottom:12px; line-height:1.5;
  }

  .mode-pill-row {
    display:flex; gap:6px;
    background:#F3F4F6; border-radius:12px;
    padding:4px; margin-bottom:22px;
  }
  .mode-pill {
    flex:1; padding:9px 0;
    border:none; border-radius:9px;
    font-family:'Outfit',system-ui,sans-serif;
    font-size:13px; font-weight:700; cursor:pointer;
    transition:background .15s, color .15s, box-shadow .15s;
    background:transparent; color:#6B7280;
  }
  .mode-pill.active {
    background:#fff;
    color:#111827;
    box-shadow:0 1px 6px rgba(0,0,0,.1);
  }

  .auth-terms {
    text-align:center;
    font-size:11px;
    color:#9CA3AF;
    font-family:'Outfit',system-ui,sans-serif;
    line-height:1.6;
    margin-top:14px;
    margin-bottom:4px;
  }
  .auth-terms a {
    color:#6B7280;
    font-weight:600;
    text-decoration:underline;
    text-underline-offset:2px;
    transition:color .15s;
  }
  .auth-terms a:hover { color:#16A34A; }

  .uatob-footer {
    border-top:1px solid #E5E7EB;
    margin-top:64px;
    padding:44px 20px 36px;
    max-width:680px;
    margin-left:auto;
    margin-right:auto;
    position:relative;
    z-index:1;
  }

  .footer-grid {
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:32px 20px;
    margin-bottom:36px;
  }
  @media(min-width:480px){
    .footer-grid { grid-template-columns:1.7fr 1fr 1fr; }
  }

  .footer-brand-col { grid-column:1 / -1; }
  @media(min-width:480px){
    .footer-brand-col { grid-column:auto; }
  }

  .footer-brand-blurb {
    font-size:13px; color:#6B7280; font-weight:500;
    line-height:1.7; margin-top:12px; margin-bottom:0;
  }

  .footer-driver-cta {
    display:inline-flex; align-items:center; gap:7px;
    background:#111827; color:#fff; border:none;
    border-radius:100px; padding:8px 16px 8px 13px;
    font-family:'Outfit',system-ui,sans-serif;
    font-size:12px; font-weight:800; cursor:pointer;
    transition:opacity .15s, transform .15s, box-shadow .15s;
    letter-spacing:.3px; margin-top:16px;
    text-decoration:none;
    box-shadow:0 3px 12px rgba(17,24,39,.16);
  }
  .footer-driver-cta:hover {
    opacity:.88; transform:translateY(-2px);
    box-shadow:0 6px 18px rgba(17,24,39,.22);
  }

  .footer-col-heading {
    font-size:10px; font-weight:800; letter-spacing:1.4px;
    text-transform:uppercase; color:#9CA3AF; margin-bottom:14px;
  }

  .footer-link {
    display:block; font-size:13px; font-weight:600;
    color:#374151; text-decoration:none; margin-bottom:10px;
    transition:color .15s, transform .12s; cursor:pointer;
    background:none; border:none; padding:0;
    font-family:'Outfit',system-ui,sans-serif; text-align:left;
  }
  .footer-link:hover { color:#16A34A; transform:translateX(2px); }

  .footer-divider {
    height:1px;
    background:linear-gradient(to right, #E5E7EB, transparent);
    margin-bottom:20px;
  }

  .footer-bottom {
    display:flex; align-items:center;
    justify-content:space-between; flex-wrap:wrap; gap:14px;
  }

  .footer-legal { font-size:11px; color:#9CA3AF; font-weight:500; line-height:1.6; }

  .footer-legal-links { display:flex; gap:14px; margin-top:4px; }

  .footer-legal-link {
    font-size:11px; color:#9CA3AF; font-weight:600;
    text-decoration:none; cursor:pointer;
    background:none; border:none; padding:0;
    font-family:'Outfit',system-ui,sans-serif; transition:color .15s;
  }
  .footer-legal-link:hover { color:#374151; }

  .footer-socials { display:flex; gap:8px; }

  .footer-social-btn {
    width:34px; height:34px; border-radius:50%;
    background:#F3F4F6; border:none; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    color:#6B7280;
    transition:background .15s, color .15s, transform .15s, box-shadow .15s;
    text-decoration:none;
  }
  .footer-social-btn:hover {
    background:#111827; color:#fff;
    transform:translateY(-3px);
    box-shadow:0 4px 12px rgba(17,24,39,.2);
  }

  .footer-orlando-badge {
    display:inline-flex; align-items:center; gap:5px;
    background:#F0FDF4; border:1px solid #BBF7D0;
    border-radius:100px; padding:4px 10px;
    font-size:10px; font-weight:800; color:#16A34A;
    letter-spacing:.8px; text-transform:uppercase; margin-top:10px;
  }
`;