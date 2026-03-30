import React from 'react';

export default function Loader() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#FAFAFA',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        {/* Spinning ring */}
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          border: '3px solid #E5E7EB',
          borderTopColor: '#16A34A',
          animation: 'spin 0.75s linear infinite',
        }}/>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#9CA3AF', fontFamily: 'system-ui' }}>
          Loading…
        </span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}