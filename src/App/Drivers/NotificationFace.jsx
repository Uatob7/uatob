// NotificationFace.jsx
import { Share2 } from 'lucide-react';

export default function NotificationFace({ online }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14, flexShrink: 0,
        background: 'linear-gradient(135deg,#34D399,#10B981)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 6px 18px rgba(16,185,129,.4)',
      }}>
        <Share2 size={20} color="#fff" strokeWidth={2.2}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 100,
          background: 'rgba(52,211,153,.12)', border: '1px solid rgba(52,211,153,.25)',
          marginBottom: 8,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#34D399', boxShadow: '0 0 8px rgba(52,211,153,0.8)',
            animation: 'scLiveDot 1.6s ease-in-out infinite',
          }}/>
          <span className="mono" style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '.12em',
            textTransform: 'uppercase', color: '#6EE7B7',
          }}>
            {online ? "You're online" : 'Spread the word'}
          </span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.82)', lineHeight: 1.5 }}>
          {online
            ? <>You're online — share UaTob with <span style={{ color: '#6EE7B7', fontWeight: 800 }}>everyone you know</span> and grow the network.</>
            : <>Tell your friends about UaTob. The more people who join, the more rides for <span style={{ color: '#6EE7B7', fontWeight: 800 }}>everyone</span>.</>
          }
        </div>
      </div>
    </div>
  );
}