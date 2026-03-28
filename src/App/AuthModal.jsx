import React from 'react';
import { X, Mail, Lock, User } from 'lucide-react';
import { UaTobWordmark } from '@/App/Brand.jsx';
import { THEME as T } from '@/App/pricing.js';

export default function AuthModal({
  authMode, setAuthMode,
  email, setEmail,
  password, setPassword,
  name, setName,
  onSubmit, onClose,
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '430px' }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: 'absolute', top: '18px', right: '18px', background: '#F3F4F6', border: 'none', cursor: 'pointer', color: T.textMuted, width: '34px', height: '34px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={17}/>
        </button>

        <div style={{ marginBottom: '18px' }}><UaTobWordmark iconSize={36}/></div>

        <div style={{ display: 'flex', gap: '5px', marginBottom: '26px', background: '#F3F4F6', padding: '4px', borderRadius: '13px' }}>
          <button className={`tab-btn ${authMode === 'login' ? 'active' : ''}`} onClick={() => setAuthMode('login')}>Login</button>
          <button className={`tab-btn ${authMode === 'signup' ? 'active' : ''}`} onClick={() => setAuthMode('signup')}>Sign Up</button>
        </div>

        <h3 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '5px', color: T.text, letterSpacing: '-0.5px' }}>
          {authMode === 'login' ? 'Welcome back' : 'Create account'}
        </h3>
        <p style={{ fontSize: '14px', color: T.textMuted, marginBottom: '22px', fontWeight: 500 }}>
          {authMode === 'login' ? 'Sign in to book your ride' : 'Join UaTob today'}
        </p>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
          {authMode === 'signup' && (
            <div style={{ position: 'relative' }}>
              <User size={16} color="#D1D5DB" style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', zIndex: 2 }}/>
              <input type="text" className="auth-field" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required/>
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <Mail size={16} color="#D1D5DB" style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', zIndex: 2 }}/>
            <input type="email" className="auth-field" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required/>
          </div>
          <div style={{ position: 'relative', marginBottom: '6px' }}>
            <Lock size={16} color="#D1D5DB" style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', zIndex: 2 }}/>
            <input type="password" className="auth-field" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required/>
          </div>
          <button type="submit" className="cta-btn">
            {authMode === 'login' ? 'Login & Continue' : 'Sign Up & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
