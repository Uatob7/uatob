import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

// ── Keyframe CSS ───────────────────────────────────────────────────────
const STYLES = `
  @keyframes drvOverlayIn { from{opacity:0} to{opacity:1} }
  @keyframes drvSheetUp   {
    from { transform: translateY(100%); opacity: 0 }
    to   { transform: translateY(0);    opacity: 1 }
  }
  @keyframes drvStarPop {
    0%,100% { transform: scale(1)    }
    50%     { transform: scale(1.25) }
  }
  @keyframes drvSuccessIn {
    0%   { transform: scale(0.7); opacity: 0 }
    60%  { transform: scale(1.1) }
    100% { transform: scale(1);   opacity: 1 }
  }
  @keyframes drvFadeUp {
    from { opacity: 0; transform: translateY(8px) }
    to   { opacity: 1; transform: translateY(0)   }
  }
`;

const STAR_COLORS = {
  1: '#EF4444',
  2: '#F97316',
  3: '#EAB308',
  4: '#84CC16',
  5: '#22C55E',
};

const LABELS = {
  1: 'Terrible',
  2: 'Bad',
  3: 'Okay',
  4: 'Good',
  5: 'Excellent',
};

// ── Star row (display-only, no interaction) ────────────────────────────
function StarDisplay({ rating }) {
  const color = STAR_COLORS[rating] ?? '#D1D5DB';
  return (
    <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <svg
          key={n}
          width="36" height="36"
          viewBox="0 0 24 24"
          fill="none"
          style={{
            animation: n <= rating ? `drvStarPop ${0.2 + n * 0.07}s ease` : 'none',
          }}
        >
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={n <= rating ? color : 'none'}
            stroke={n <= rating ? color : '#D1D5DB'}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </div>
  );
}

// ── Short address helper ───────────────────────────────────────────────
const shortAddr = str => str?.split(',')[0] ?? str;

// ── Main component ─────────────────────────────────────────────────────
/**
 * DriverReviewModal
 *
 * Props:
 *   review   — review doc from Firestore (rating, comment, pickup, dropoff,
 *               fareTotal, rideLabel, tripDistanceMiles)
 *   onClose  — called when driver taps "Got it" or backdrop
 */
export default function DriverReviewModal({ review, onClose }) {
  const [visible, setVisible] = useState(false);

  // slight delay so the sheet animates in after mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  if (!review) return null;

  const { rating, comment, pickup, dropoff, fareTotal, rideLabel, tripDistanceMiles } = review;
  const color = STAR_COLORS[rating] ?? '#16A34A';
  const label = LABELS[rating] ?? '';

  // sentiment-driven emoji
  const emoji = rating >= 4 ? '🎉' : rating === 3 ? '👍' : '📝';

  return (
    <>
      <style>{STYLES}</style>

      {/* ── Overlay ── */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 1200,
          background: 'rgba(0,0,0,0.50)',
          backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          animation: 'drvOverlayIn .22s ease',
        }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* ── Sheet ── */}
        <div style={{
          background: '#fff',
          borderRadius: '28px 28px 0 0',
          width: '100%',
          maxWidth: 480,
          padding: '10px 24px 48px',
          fontFamily: '"Barlow", system-ui, sans-serif',
          animation: visible ? 'drvSheetUp .36s cubic-bezier(.32,1.1,.6,1)' : 'none',
          border: '1px solid rgba(0,0,0,0.06)',
          borderBottom: 'none',
        }}>

          {/* Drag handle */}
          <div style={{
            width: 38, height: 4, borderRadius: 100,
            background: '#E5E7EB',
            margin: '10px auto 20px',
          }} />

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'flex-start',
            justifyContent: 'space-between', marginBottom: 20,
          }}>
            <div>
              <div style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '1.6px',
                textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 4,
              }}>
                Rider feedback
              </div>
              <div style={{
                fontSize: 22, fontWeight: 900, color: '#111827',
                letterSpacing: '-0.5px', lineHeight: 1.15,
              }}>
                Your ride was rated{' '}
                <span style={{ color }}>{label.toLowerCase()}</span> {emoji}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 34, height: 34, borderRadius: '50%',
                background: '#F3F4F6',
                border: '1px solid rgba(0,0,0,0.06)',
                cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#6B7280',
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Stars */}
          <div style={{ marginBottom: 8, animation: 'drvFadeUp .3s ease' }}>
            <StarDisplay rating={rating} />
          </div>

          {/* Rating label */}
          <div style={{
            textAlign: 'center', fontSize: 13, fontWeight: 800,
            color, marginBottom: 22, letterSpacing: '0.2px',
          }}>
            {label}
          </div>

          {/* Ride summary card */}
          <div style={{
            background: '#F9FAFB',
            border: '1px solid #E5E7EB',
            borderRadius: 16, padding: '14px 16px',
            marginBottom: comment ? 18 : 28,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: '#EFF6FF', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/>
                <circle cx="7.5" cy="17.5" r="2.5"/>
                <circle cx="17.5" cy="17.5" r="2.5"/>
              </svg>
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: '#111827',
                lineHeight: 1.4, marginBottom: 5,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {shortAddr(pickup)}
                <span style={{ color: '#9CA3AF', fontWeight: 500, margin: '0 6px' }}>→</span>
                {shortAddr(dropoff)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {rideLabel && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: '#6B7280',
                    background: '#F3F4F6', borderRadius: 100, padding: '2px 8px',
                  }}>
                    {rideLabel}
                  </span>
                )}
                {tripDistanceMiles != null && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: '#6B7280',
                    background: '#F3F4F6', borderRadius: 100, padding: '2px 8px',
                  }}>
                    {tripDistanceMiles.toFixed(1)} mi
                  </span>
                )}
                {fareTotal != null && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: '#6B7280',
                    background: '#F3F4F6', borderRadius: 100, padding: '2px 8px',
                  }}>
                    ${fareTotal.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Comment bubble */}
          {comment ? (
            <div style={{
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: 16, padding: '14px 16px',
              marginBottom: 28,
              animation: 'drvFadeUp .35s ease .1s both',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '1.2px',
                textTransform: 'uppercase', color: '#16A34A', marginBottom: 7,
              }}>
                Rider comment
              </div>
              <div style={{
                fontSize: 14, fontWeight: 500, color: '#111827',
                lineHeight: 1.6, fontStyle: 'italic',
              }}>
                "{comment}"
              </div>
            </div>
          ) : (
            <div style={{
              background: '#F9FAFB', border: '1px solid #E5E7EB',
              borderRadius: 16, padding: '12px 16px', marginBottom: 28,
              animation: 'drvFadeUp .35s ease .1s both',
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#9CA3AF', textAlign: 'center' }}>
                No comment left
              </div>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '15px 0',
              background: rating >= 4
                ? 'linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)'
                : rating === 3
                  ? 'linear-gradient(135deg,#F59E0B,#D97706)'
                  : 'linear-gradient(135deg,#6B7280,#374151)',
              color: '#fff', border: 'none', borderRadius: 16,
              fontFamily: '"Barlow", system-ui, sans-serif',
              fontSize: 15, fontWeight: 800,
              cursor: 'pointer', letterSpacing: '-0.2px',
              boxShadow: rating >= 4
                ? '0 4px 16px rgba(22,163,74,.28)'
                : rating === 3
                  ? '0 4px 16px rgba(245,158,11,.25)'
                  : '0 4px 16px rgba(107,114,128,.2)',
            }}
          >
            Got it — keep earning
          </button>

        </div>
      </div>
    </>
  );
}