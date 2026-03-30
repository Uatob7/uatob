// src/App/Brand.jsx
import React from 'react';

export function UaTobIcon({ size = 46 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="ribg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF"/><stop offset="100%" stopColor="#F3F4F6"/>
        </linearGradient>
        <linearGradient id="riroad" x1="0" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#111827"/><stop offset="100%" stopColor="#16A34A"/>
        </linearGradient>
        <linearGradient id="ricar" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#16A34A"/><stop offset="100%" stopColor="#15803D"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#ribg)"/>
      <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" stroke="#E5E7EB" strokeWidth="1"/>
      <path d="M 10 42 Q 32 24 54 42" stroke="url(#riroad)" strokeWidth="2.5" strokeDasharray="5 4" strokeLinecap="round" fill="none" opacity="0.6"/>
      <circle cx="10" cy="42" r="6" fill="#111827" opacity="0.12"/>
      <circle cx="10" cy="42" r="3.5" fill="#111827"/>
      <text x="10" y="45.5" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="4.5" fill="#fff">A</text>
      <circle cx="54" cy="42" r="6" fill="#16A34A" opacity="0.18"/>
      <circle cx="54" cy="42" r="3.5" fill="#16A34A"/>
      <text x="54" y="45.5" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="4.5" fill="#fff">B</text>
      <g transform="translate(26,26)">
        <ellipse cx="6" cy="12" rx="8" ry="2" fill="#111827" opacity="0.1"/>
        <rect x="1" y="5" width="10" height="6" rx="1.5" fill="url(#ricar)"/>
        <path d="M3 5 L3.8 2 L8.2 2 L9 5Z" fill="#15803D"/>
        <rect x="3.5" y="2.5" width="2.3" height="2" rx="0.5" fill="#fff" fillOpacity="0.85"/>
        <rect x="6.2" y="2.5" width="2.3" height="2" rx="0.5" fill="#fff" fillOpacity="0.85"/>
        <circle cx="3" cy="11" r="1.8" fill="#111827"/><circle cx="3" cy="11" r="0.9" fill="#16A34A"/>
        <circle cx="9" cy="11" r="1.8" fill="#111827"/><circle cx="9" cy="11" r="0.9" fill="#22C55E"/>
        <rect x="10.5" y="6.5" width="1.5" height="1" rx="0.5" fill="#FCD34D"/>
      </g>
    </svg>
  );
}

export function UaTobWordmark({ iconSize = 46 }) {
  const fontSize  = iconSize * 0.62;
  const arrowSize = fontSize * 0.72;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: iconSize * 0.25 + 'px' }}>
      <UaTobIcon size={iconSize} />

      {/* Ua → Tob text */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>

        {/* "Ua" — light weight, dark */}
        <span style={{
          fontFamily:  '"Outfit", system-ui, sans-serif',
          fontWeight:  300,
          fontSize:    fontSize + 'px',
          color:       '#111827',
          letterSpacing: '-0.5px',
          lineHeight:  1,
        }}>
          Ua
        </span>

        {/* Arrow */}
        <svg
          width={arrowSize}
          height={arrowSize}
          viewBox="0 0 24 24"
          fill="none"
          style={{ margin: '0 2px', flexShrink: 0 }}
        >
          <path
            d="M5 12h14M13 6l6 6-6 6"
            stroke="#16A34A"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* "Tob" — bold, green */}
        <span style={{
          fontFamily:  '"Outfit", system-ui, sans-serif',
          fontWeight:  800,
          fontSize:    fontSize + 'px',
          background:  'linear-gradient(135deg, #16A34A, #22C55E)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor:  'transparent',
          backgroundClip:       'text',
          letterSpacing: '-0.5px',
          lineHeight:  1,
        }}>
          Tob
        </span>

      </div>
    </div>
  );
}

export function CashAppIcon({ size = 21, color = '#00D632' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill={color}/>
      <text x="12" y="17.5" textAnchor="middle" fontFamily="system-ui" fontWeight="900" fontSize="15" fill="#fff">$</text>
    </svg>
  );
}
