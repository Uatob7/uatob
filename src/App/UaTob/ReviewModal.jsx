import React, { useState } from 'react';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const LABELS = { 1: 'Terrible', 2: 'Bad', 3: 'Okay', 4: 'Good', 5: 'Excellent' };
const STAR_COLORS = { 1: '#EF4444', 2: '#F97316', 3: '#EAB308', 4: '#84CC16', 5: '#22C55E' };

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');

  @keyframes reviewOverlayIn {
    from { opacity: 0 }
    to   { opacity: 1 }
  }
  @keyframes reviewSheetUp {
    from { transform: translateY(100%) }
    to   { transform: translateY(0) }
  }
  @keyframes reviewStarPop {
    0%, 100% { transform: scale(1) }
    50%       { transform: scale(1.35) }
  }
  @keyframes reviewSuccessPulse {
    0%   { transform: scale(0.8); opacity: 0 }
    60%  { transform: scale(1.1) }
    100% { transform: scale(1);   opacity: 1 }
  }
  @keyframes reviewFadeUp {
    from { opacity: 0; transform: translateY(8px) }
    to   { opacity: 1; transform: translateY(0) }
  }
  @keyframes reviewSpin {
    to { transform: rotate(360deg) }
  }

  .rm-overlay {
    position: fixed; inset: 0; z-index: 600;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(5px);
    display: flex; align-items: flex-end; justify-content: center;
    animation: reviewOverlayIn .25s ease;
  }
  .rm-sheet {
    background: #fff;
    border-radius: 28px 28px 0 0;
    width: 100%; max-width: 460px;
    padding: 10px 24px 44px;
    animation: reviewSheetUp .38s cubic-bezier(.32,1.1,.6,1);
    position: relative;
    font-family: 'Sora', system-ui, sans-serif;
    border: 1px solid rgba(0,0,0,0.06);
    border-bottom: none;
  }
  .rm-handle {
    width: 40px; height: 4px;
    border-radius: 100px;
    background: #E5E7EB;
    margin: 10px auto 22px;
  }
  .rm-close-btn {
    width: 34px; height: 34px;
    border-radius: 50%;
    background: #F3F4F6;
    border: 1px solid rgba(0,0,0,0.06);
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    color: #6B7280;
    transition: background .15s;
  }
  .rm-close-btn:hover { background: #E5E7EB; }
  .rm-meta-pill {
    font-size: 11px; font-weight: 600;
    color: #6B7280;
    background: #F3F4F6;
    border-radius: 100px;
    padding: 3px 9px;
  }
  .rm-star-btn {
    background: none; border: none;
    cursor: pointer; padding: 3px;
    line-height: 1;
    transition: transform .1s;
  }
  .rm-star-btn:active { transform: scale(0.92); }
  .rm-comment {
    width: 100%;
    background: #F9FAFB;
    border: 1.5px solid #E5E7EB;
    border-radius: 14px;
    padding: 13px 15px 32px;
    font-family: 'Sora', system-ui, sans-serif;
    font-size: 13px; font-weight: 500;
    color: #111827;
    resize: none; outline: none;
    transition: border-color .15s, box-shadow .15s;
    line-height: 1.6;
    box-sizing: border-box;
  }
  .rm-comment::placeholder { color: #9CA3AF; }
  .rm-comment:focus {
    border-color: #22C55E;
    box-shadow: 0 0 0 3px rgba(34,197,94,0.12);
  }
  .rm-submit {
    width: 100%; margin-top: 14px;
    padding: 15px 0;
    border: none; border-radius: 16px;
    font-family: 'Sora', system-ui, sans-serif;
    font-size: 15px; font-weight: 800;
    cursor: pointer;
    transition: background .2s, opacity .2s, transform .1s;
    display: flex; align-items: center; justify-content: center;
    gap: 8px;
    letter-spacing: -0.2px;
  }
  .rm-submit:not(:disabled):active { transform: scale(0.98); }
  .rm-skip {
    width: 100%; margin-top: 10px;
    background: none; border: none; cursor: pointer;
    font-family: 'Sora', system-ui, sans-serif;
    font-size: 13px; font-weight: 600;
    color: #9CA3AF; padding: 8px 0;
    transition: color .15s;
  }
  .rm-skip:hover { color: #6B7280; }
  .rm-spinner {
    width: 18px; height: 18px;
    border: 2.5px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: reviewSpin .8s linear infinite;
    display: inline-block;
  }
`;

function StarIcon({ filled, color }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill={filled ? color : 'none'}
        stroke={filled ? color : '#D1D5DB'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: 'fill .12s, stroke .12s' }}
      />
    </svg>
  );
}

function SuccessState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', textAlign: 'center', gap: 10,
      animation: 'reviewFadeUp .3s ease',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: '#DCFCE7',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 8,
        animation: 'reviewSuccessPulse .4s ease',
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
          stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', letterSpacing: '-0.4px' }}>
        Thanks for the review!
      </div>
      <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 500, maxWidth: 220, lineHeight: 1.6 }}>
        Your feedback helps us improve UaTob for everyone.
      </div>
    </div>
  );
}

const shortAddr = (str) => str?.split(',')[0] ?? str;

export default function ReviewModal({ ride, uid, onClose, onSubmitted }) {
  const [rating,    setRating]    = useState(0);
  const [hover,     setHover]     = useState(0);
  const [comment,   setComment]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [submitted, setSubmitted] = useState(false);

  const activeIndex = hover || rating;
  const activeColor = STAR_COLORS[activeIndex] ?? '#D1D5DB';

  const handleSubmit = async () => {
    if (!rating) { setError('Please select a star rating.'); return; }
    setLoading(true);
    setError('');
    try {
      const db = getFirestore();
      await addDoc(collection(db, 'Reviews'), {
        rideId:            ride.id,
        uid,
        driverUid:         ride.driverUid,
        rating,
        comment:           comment.trim(),
        pickup:            ride.pickup,
        dropoff:           ride.dropoff,
        fareTotal:         ride.fareTotal,
        rideLabel:         ride.rideLabel,
        tripDistanceMiles: ride.tripDistanceMiles,
        createdAt:         serverTimestamp(),
      });
      setSubmitted(true);
      setTimeout(() => onSubmitted(ride.id), 1800);
    } catch (err) {
      console.error('[ReviewModal]', err);
      setError('Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{styles}</style>

      <div
        className="rm-overlay"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="rm-sheet">
          <div className="rm-handle" />

          {submitted ? (
            <SuccessState />
          ) : (
            <>
              {/* ── Header ── */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{
                    fontSize: 10, fontWeight: 700,
                    letterSpacing: '1.6px', textTransform: 'uppercase',
                    color: '#9CA3AF', marginBottom: 4,
                  }}>
                    Rate your ride
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', letterSpacing: '-0.5px', lineHeight: 1.15 }}>
                    How was<br />your trip?
                  </div>
                </div>
                <button className="rm-close-btn" onClick={onClose}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* ── Ride card ── */}
              <div style={{
                background: '#F9FAFB',
                border: '1px solid #E5E7EB',
                borderRadius: 16,
                padding: '14px 16px',
                marginBottom: 24,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: '#EFF6FF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2" />
                    <circle cx="7.5" cy="17.5" r="2.5" />
                    <circle cx="17.5" cy="17.5" r="2.5" />
                  </svg>
                </div>
                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700,
                    color: '#111827', lineHeight: 1.4, marginBottom: 5,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {shortAddr(ride.pickup)}
                    <span style={{ color: '#9CA3AF', fontWeight: 500, margin: '0 6px' }}>→</span>
                    {shortAddr(ride.dropoff)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span className="rm-meta-pill">{ride.rideLabel}</span>
                    <span className="rm-meta-pill">{ride.tripDistanceMiles?.toFixed(1)} mi</span>
                    <span className="rm-meta-pill">${ride.fareTotal?.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* ── Stars ── */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      className="rm-star-btn"
                      onMouseEnter={() => setHover(n)}
                      onMouseLeave={() => setHover(0)}
                      onClick={() => { setRating(n); setError(''); }}
                    >
                      <StarIcon filled={activeIndex >= n} color={STAR_COLORS[activeIndex] ?? '#FBBF24'} />
                    </button>
                  ))}
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 700,
                  minHeight: 18, letterSpacing: '0.2px',
                  color: activeIndex ? activeColor : '#9CA3AF',
                  transition: 'color .15s',
                }}>
                  {LABELS[activeIndex] ?? 'Tap to rate'}
                </div>
              </div>

              {/* ── Comment ── */}
              <div style={{ position: 'relative', marginBottom: 6 }}>
                <textarea
                  className="rm-comment"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Leave a comment for your driver (optional)…"
                  maxLength={300}
                  rows={3}
                />
                <span style={{
                  position: 'absolute', bottom: 11, right: 13,
                  fontSize: 11, fontWeight: 600, color: '#9CA3AF',
                }}>
                  {comment.length}/300
                </span>
              </div>

              {/* ── Error ── */}
              {error && (
                <div style={{
                  background: 'rgba(220,38,38,.07)',
                  border: '1px solid rgba(220,38,38,.2)',
                  borderRadius: 11,
                  padding: '10px 14px',
                  fontSize: 12, fontWeight: 600, color: '#DC2626',
                  marginBottom: 12,
                  display: 'flex', alignItems: 'center', gap: 7,
                  animation: 'reviewFadeUp .2s ease',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}

              {/* ── Submit ── */}
              <button
                className="rm-submit"
                onClick={handleSubmit}
                disabled={loading || !rating}
                style={{
                  background: rating ? '#16A34A' : '#F3F4F6',
                  color: rating ? '#fff' : '#9CA3AF',
                  cursor: rating ? 'pointer' : 'not-allowed',
                }}
              >
                {loading
                  ? <span className="rm-spinner" />
                  : 'Submit Review'}
              </button>

              {/* ── Skip ── */}
              <button className="rm-skip" onClick={onClose}>
                Skip for now
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}