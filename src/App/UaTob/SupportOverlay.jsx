// SupportOverlay.jsx
// New-design support sheet. Opens from the top-bar Support button, collects a
// message and writes it to the Support collection (compatible with the existing
// admin support view: threadId/riderId/riderName/riderEmail/message/sender).

import { useState } from 'react';
import { getFirestore, collection, addDoc, doc, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

const C = {
  green: '#22C55E', greenBright: '#4ADE80', greenSoft: '#34D399', cyan: '#22D3EE', red: '#F87171',
  inkDim: 'rgba(255,255,255,.22)', inkFade: 'rgba(255,255,255,.10)',
  inkMid: 'rgba(255,255,255,.45)', inkBright: 'rgba(255,255,255,.88)',
  border: 'rgba(34,197,94,.15)', borderBright: 'rgba(74,222,128,.35)',
};
const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";
const BODY = "'Syne','Inter',sans-serif";

const inputStyle = {
  width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.03)',
  border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 13px', outline: 'none',
  fontFamily: BODY, fontSize: 14, fontWeight: 600, color: C.inkBright, caretColor: C.greenBright, colorScheme: 'dark',
};

export default function SupportOverlay({ uid, account, onClose }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [name, setName] = useState(account?.name || account?.displayName || '');
  const [email, setEmail] = useState(account?.email || '');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const valid = message.trim().length > 2;

  const send = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    try {
      const threadId = uid || `guest_${email.trim() || Date.now()}`;
      await addDoc(collection(db, 'Support'), {
        threadId,
        riderId:    uid || null,
        riderName:  name.trim() || null,
        riderEmail: email.trim() || null,
        subject:    subject.trim() || null,
        message:    message.trim(),
        sender:     'rider',
        status:     'unread',
        createdAt:  serverTimestamp(),
      });
      // Upsert the thread so it surfaces in the support dashboard.
      await setDoc(doc(db, 'SupportThreads', threadId), {
        threadId, riderId: uid || null, riderName: name.trim() || null, riderEmail: email.trim() || null,
        lastMessage: message.trim(), status: 'open', unreadBySupport: increment(1), updatedAt: serverTimestamp(),
      }, { merge: true });
      setSent(true);
    } catch (err) {
      console.error('[SupportOverlay]', err);
      setError(uid ? 'Could not send — please try again.' : 'Please sign in to contact support.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: '#050A06', display: 'flex', flexDirection: 'column', animation: 'soUp .3s ease both' }}>
      <style>{`@keyframes soUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* header */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px', borderBottom: `1px solid ${C.inkFade}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: 'rgba(34,197,94,.1)', border: `1px solid ${C.border}` }}>💬</div>
          <div>
            <div style={{ fontFamily: COND, fontSize: 18, fontWeight: 800, letterSpacing: '.02em', color: C.inkBright, lineHeight: 1 }}>Support</div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.inkDim, marginTop: 2 }}>We usually reply within a few minutes</div>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" style={{ width: 34, height: 34, borderRadius: 10, cursor: 'pointer', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.09)', color: C.inkMid, fontSize: 15 }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 28px' }}>
        {sent ? (
          <div style={{ textAlign: 'center', paddingTop: 40, animation: 'soUp .3s ease both' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, background: 'rgba(34,197,94,.12)', border: `2px solid ${C.green}`, boxShadow: '0 0 30px rgba(34,197,94,.25)' }}>✓</div>
            <div style={{ fontFamily: COND, fontSize: 22, fontWeight: 800, color: C.inkBright, marginBottom: 6 }}>Message sent</div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.inkMid, lineHeight: 1.6, maxWidth: 260, margin: '0 auto 26px' }}>
              Thanks for reaching out{name ? `, ${String(name).split(' ')[0]}` : ''}. Our team will get back to you{email ? ` at ${email}` : ''}.
            </div>
            <button onClick={onClose} style={{ border: 'none', cursor: 'pointer', borderRadius: 14, padding: '13px 26px', fontFamily: COND, fontSize: 14, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#04150a', background: 'linear-gradient(135deg,#4ADE80,#22C55E)', boxShadow: '0 8px 24px rgba(34,197,94,.3)' }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ fontFamily: BODY, fontSize: 15, fontWeight: 700, color: C.inkBright, marginBottom: 4 }}>How can we help?</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: C.inkMid, marginBottom: 18 }}>Tell us what's going on and we'll take care of it.</div>

            {error && (
              <div style={{ display: 'flex', gap: 8, padding: '11px 13px', marginBottom: 14, borderRadius: 12, background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.3)' }}>
                <span style={{ fontSize: 13 }}>⚠️</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.red, lineHeight: 1.5 }}>{error}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!uid && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={inputStyle} />
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" style={inputStyle} />
                </div>
              )}
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (optional)" style={inputStyle} />
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe your issue…" rows={6} style={{ ...inputStyle, resize: 'vertical', minHeight: 130, lineHeight: 1.5 }} />

              <button onClick={send} disabled={!valid || busy} style={{
                width: '100%', border: 'none', borderRadius: 16, padding: 16, marginTop: 2, cursor: valid && !busy ? 'pointer' : 'not-allowed',
                fontFamily: COND, fontSize: 16, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase',
                color: valid ? '#04150a' : C.inkDim,
                background: valid ? 'linear-gradient(135deg,#4ADE80,#22C55E 55%,#15803D)' : 'rgba(255,255,255,.05)',
                boxShadow: valid ? '0 10px 30px rgba(34,197,94,.3)' : 'none',
              }}>{busy ? 'Sending…' : 'Send message'}</button>
            </div>

            <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${C.inkFade}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="tel:407-942-6078" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none', padding: '12px 13px', borderRadius: 12, background: 'rgba(255,255,255,.015)', border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 16 }}>📞</span>
                <div><div style={{ fontFamily: BODY, fontSize: 13, fontWeight: 700, color: C.inkBright }}>Call us</div><div style={{ fontFamily: MONO, fontSize: 9.5, color: C.inkDim, marginTop: 1 }}>407-942-6078</div></div>
              </a>
              <a href="mailto:support@uatob.com" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none', padding: '12px 13px', borderRadius: 12, background: 'rgba(255,255,255,.015)', border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 16 }}>✉️</span>
                <div><div style={{ fontFamily: BODY, fontSize: 13, fontWeight: 700, color: C.inkBright }}>Email us</div><div style={{ fontFamily: MONO, fontSize: 9.5, color: C.inkDim, marginTop: 1 }}>support@uatob.com</div></div>
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
