import React, { useState } from 'react';
import { X, Star } from 'lucide-react';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function ReviewModal({ ride, uid, onClose, onSubmitted }) {
  const [rating,  setRating]  = useState(0);
  const [hover,   setHover]   = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async () => {
    if (!rating) { setError('Please select a star rating.'); return; }
    setLoading(true);
    setError('');
    try {
      const db = getFirestore();
      await addDoc(collection(db, 'Reviews'), {
        rideId:           ride.id,
        uid,
        driverUid:        ride.driverUid,
        rating,
        comment:          comment.trim(),
        pickup:           ride.pickup,
        dropoff:          ride.dropoff,
        fareTotal:        ride.fareTotal,
        rideLabel:        ride.rideLabel,
        tripDistanceMiles: ride.tripDistanceMiles,
        createdAt:        serverTimestamp(),
      });
      onSubmitted(ride.id);
    } catch (err) {
      console.error('[ReviewModal]', err);
      setError('Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const shortAddr = (str) => str?.split(',')[0] ?? str;

  const LABEL = { 1: 'Terrible', 2: 'Bad', 3: 'OK', 4: 'Good', 5: 'Excellent' };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(0,0,0,0.40)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'overlayIn .2s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff',
        borderRadius: '24px 24px 0 0',
        width: '100%',
        maxWidth: '440px',
        padding: '26px 22px 44px',
        animation: 'modalIn .32s cubic-bezier(.34,1.2,.64,1)',
        position: 'relative',
        fontFamily: '"Outfit",system-ui,sans-serif',
      }}>

        {/* ── Drag handle ── */}
        <div style={{
          width: 36, height: 4, borderRadius: 100,
          background: '#E5E7EB',
          margin: '0 auto 20px',
        }} />

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{
              fontSize: 11, fontWeight: 800, color: '#9CA3AF',
              letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 5,
            }}>
              Rate your ride
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#111827', letterSpacing: '-0.4px' }}>
              How was your trip?
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#F3F4F6', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#6B7280', flexShrink: 0,
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Ride summary card ── */}
        <div style={{
          background: '#F9FAFB',
          border: '1.5px solid #E5E7EB',
          borderRadius: 14,
          padding: '12px 16px',
          marginBottom: 22,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
            {shortAddr(ride.pickup)}
            <span style={{ color: '#9CA3AF', fontWeight: 500, margin: '0 6px' }}>→</span>
            {shortAddr(ride.dropoff)}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>
              {ride.rideLabel}
            </span>
            <span style={{ fontSize: 12, color: '#D1D5DB' }}>·</span>
            <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>
              {ride.tripDistanceMiles?.toFixed(1)} mi
            </span>
            <span style={{ fontSize: 12, color: '#D1D5DB' }}>·</span>
            <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>
              ${ride.fareTotal?.toFixed(2)}
            </span>
          </div>
        </div>

        {/* ── Stars ── */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => { setRating(n); setError(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 1 }}
            >
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  fill={(hover || rating) >= n ? '#FBBF24' : 'none'}
                  stroke={(hover || rating) >= n ? '#FBBF24' : '#D1D5DB'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ))}
        </div>

        {/* ── Rating label ── */}
        <div style={{
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 700,
          color: (hover || rating) ? '#16A34A' : '#9CA3AF',
          marginBottom: 20,
          minHeight: 20,
          transition: 'color .15s',
        }}>
          {LABEL[hover || rating] ?? ''}
        </div>

        {/* ── Comment ── */}
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Leave a comment for your driver (optional)…"
          maxLength={300}
          rows={3}
          style={{
            width: '100%',
            background: '#F9FAFB',
            border: '1.5px solid #E5E7EB',
            borderRadius: 13,
            padding: '12px 14px',
            fontFamily: '"Outfit",system-ui,sans-serif',
            fontSize: 13,
            fontWeight: 500,
            color: '#111827',
            resize: 'none',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color .15s, box-shadow .15s',
          }}
          onFocus={e => {
            e.target.style.borderColor = '#16A34A';
            e.target.style.boxShadow   = '0 0 0 3px rgba(22,163,74,.1)';
          }}
          onBlur={e => {
            e.target.style.borderColor = '#E5E7EB';
            e.target.style.boxShadow   = 'none';
          }}
        />
        <div style={{
          textAlign: 'right', fontSize: 11,
          color: '#9CA3AF', fontWeight: 500,
          marginTop: 4, marginBottom: 4,
        }}>
          {comment.length}/300
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{
            marginBottom: 10, padding: '9px 13px',
            background: 'rgba(220,38,38,.07)',
            border: '1px solid rgba(220,38,38,.2)',
            borderRadius: 10,
            fontSize: 12, fontWeight: 600, color: '#DC2626',
          }}>
            {error}
          </div>
        )}

        {/* ── Submit ── */}
        <button
          onClick={handleSubmit}
          disabled={loading || !rating}
          style={{
            width: '100%',
            marginTop: 10,
            padding: '14px 0',
            background: rating
              ? 'linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)'
              : '#E5E7EB',
            color: rating ? '#fff' : '#9CA3AF',
            border: 'none',
            borderRadius: 14,
            fontFamily: '"Outfit",system-ui,sans-serif',
            fontSize: 15,
            fontWeight: 800,
            cursor: rating ? 'pointer' : 'not-allowed',
            boxShadow: rating ? '0 4px 16px rgba(22,163,74,.28)' : 'none',
            transition: 'background .2s, color .2s, box-shadow .2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {loading ? (
            <svg width="16" height="16" viewBox="0 0 24 24" style={{ animation: 'spinAnim 1s linear infinite' }}>
              <circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="3" fill="none" strokeDasharray="40" strokeDashoffset="10" />
            </svg>
          ) : 'Submit Review'}
        </button>

        {/* ── Skip ── */}
        <button
          onClick={onClose}
          style={{
            width: '100%', marginTop: 12,
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: '"Outfit",system-ui,sans-serif',
            fontSize: 13, fontWeight: 600, color: '#9CA3AF',
          }}
        >
          Skip for now
        </button>

      </div>
    </div>
  );
}