// src/App/UaTob/PricingPage.jsx
import React, { useState } from 'react';
import { Users, Clock, Shield, Info } from 'lucide-react';
import { THEME as T } from '@/App/UaTob/pricing.js';

// ── Exact tiers from the Price Cloud Function ──────────────
const TIERS = [
  {
    id:          'economy',
    label:       'Economy',
    desc:        'Affordable everyday rides',
    eta:         '7–20 min',
    capacity:    4,
    base:        1.50,
    perMile:     1.20,
    perMin:      0.18,
    bookingFee:  0.99,
    minimumFare: 4.99,
    color:       '#16A34A',
    badge:       '🟢',
  },
  {
    id:          'standard',
    label:       'Standard',
    desc:        'Comfortable daily rides',
    eta:         '2–7 min',
    capacity:    4,
    base:        2.00,
    perMile:     1.65,
    perMin:      0.25,
    bookingFee:  1.29,
    minimumFare: 6.99,
    color:       '#16A34A',
    badge:       '⭐',
    popular:     true,
  },
  {
    id:          'premium',
    label:       'Premium',
    desc:        'Luxury rides',
    eta:         '5–10 min',
    capacity:    4,
    base:        4.00,
    perMile:     3.25,
    perMin:      0.50,
    bookingFee:  1.99,
    minimumFare: 11.99,
    color:       '#7C3AED',
    badge:       '💜',
  },
  {
    id:          'xl',
    label:       'XL',
    desc:        'Large group rides',
    eta:         '5–9 min',
    capacity:    6,
    base:        2.50,
    perMile:     1.90,
    perMin:      0.30,
    bookingFee:  1.49,
    minimumFare: 8.49,
    color:       '#F59E0B',
    badge:       '🟡',
  },
];

const round2 = (n) => Number(Number(n).toFixed(2));

function estimateFare(tier, miles, minutes) {
  const subtotal = round2(tier.base + miles * tier.perMile + minutes * tier.perMin + tier.bookingFee);
  return Math.max(subtotal, tier.minimumFare);
}

// ── Sub-components ─────────────────────────────────────────
function StatPill({ icon, label }) {
  return (
    <span
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          '4px',
        background:   T.surfaceAlt ?? '#F9FAFB',
        border:       `1px solid ${T.border}`,
        borderRadius: '99px',
        padding:      '3px 10px',
        fontSize:     '11px',
        fontWeight:   600,
        color:        T.textMuted,
        whiteSpace:   'nowrap',
      }}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}

function RateRow({ label, value, note, color }) {
  return (
    <div
      style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'baseline',
        padding:        '7px 0',
        borderBottom:   `1px solid ${T.border}`,
      }}
    >
      <span style={{ fontSize: '12px', color: T.textMuted }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize:   '13px',
            fontWeight: 700,
            color:      color,
          }}
        >
          {value}
        </span>
        {note && (
          <span style={{ fontSize: '10px', color: T.textMuted, marginLeft: '4px' }}>{note}</span>
        )}
      </div>
    </div>
  );
}

function TierCard({ tier, estimatedFare, isSelected, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background:   T.surfaceAlt ?? '#F9FAFB',
        border:       `2px solid ${isSelected ? tier.color : T.border}`,
        borderRadius: '18px',
        padding:      '20px',
        cursor:       'pointer',
        transition:   'all .2s',
        position:     'relative',
        boxShadow:    isSelected ? `0 4px 20px ${tier.color}22` : 'none',
      }}
    >
      {/* Popular badge */}
      {tier.popular && (
        <div
          style={{
            position:     'absolute',
            top:          '-11px',
            left:         '50%',
            transform:    'translateX(-50%)',
            background:   `linear-gradient(135deg,${tier.color},${tier.color}cc)`,
            color:        '#fff',
            fontSize:     '10px',
            fontWeight:   800,
            letterSpacing:'0.6px',
            padding:      '3px 12px',
            borderRadius: '99px',
            whiteSpace:   'nowrap',
            boxShadow:    `0 2px 8px ${tier.color}40`,
          }}
        >
          MOST POPULAR
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
            <span style={{ fontSize: '18px' }}>{tier.badge}</span>
            <span style={{ fontSize: '18px', fontWeight: 800, color: T.text }}>{tier.label}</span>
          </div>
          <div style={{ fontSize: '12px', color: T.textMuted }}>{tier.desc}</div>
        </div>
        {estimatedFare !== null && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: T.textMuted, marginBottom: '2px' }}>Est.</div>
            <div
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize:   '22px',
                fontWeight: 700,
                color:      tier.color,
                lineHeight: 1,
              }}
            >
              ${estimatedFare.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* Pills */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <StatPill icon={<Users size={10} />} label={`Up to ${tier.capacity} riders`} />
        <StatPill icon={<Clock size={10} />} label={tier.eta} />
      </div>

      {/* Rate breakdown */}
      <div>
        <RateRow label="Base fare"   value={`$${tier.base.toFixed(2)}`}    color={tier.color} />
        <RateRow label="Per mile"    value={`$${tier.perMile.toFixed(2)}`} note="/ mi" color={tier.color} />
        <RateRow label="Per minute"  value={`$${tier.perMin.toFixed(2)}`}  note="/ min" color={tier.color} />
        <RateRow label="Booking fee" value={`$${tier.bookingFee.toFixed(2)}`} color={tier.color} />
        <div
          style={{
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'center',
            paddingTop:     '8px',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 700, color: T.textMuted }}>Minimum fare</span>
          <span
            style={{
              fontFamily:   '"JetBrains Mono", monospace',
              fontSize:     '13px',
              fontWeight:   700,
              color:        tier.color,
              background:   `${tier.color}12`,
              border:       `1px solid ${tier.color}25`,
              borderRadius: '8px',
              padding:      '2px 8px',
            }}
          >
            ${tier.minimumFare.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────
export default function PricingPage() {
  const [miles,   setMiles]   = useState('');
  const [minutes, setMinutes] = useState('');
  const [selected, setSelected] = useState(null);

  const parsedMiles   = parseFloat(miles)   || 0;
  const parsedMinutes = parseFloat(minutes) || 0;
  const hasEstimate   = parsedMiles > 0 && parsedMinutes > 0;

  const estimates = Object.fromEntries(
    TIERS.map((t) => [
      t.id,
      hasEstimate ? estimateFare(t, parsedMiles, parsedMinutes) : null,
    ])
  );

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 4px', fontFamily: 'inherit' }}>

      {/* ── Header ── */}
      <div style={{ textAlign: 'center', padding: '32px 0 24px', borderBottom: `1.5px solid ${T.border}` }}>
        <div
          style={{
            display:       'inline-flex',
            alignItems:    'center',
            gap:           '6px',
            background:    '#16A34A12',
            border:        '1px solid #16A34A30',
            borderRadius:  '99px',
            padding:       '4px 14px',
            fontSize:      '11px',
            fontWeight:    700,
            color:         '#16A34A',
            letterSpacing: '0.8px',
            marginBottom:  '14px',
          }}
        >
          TRANSPARENT PRICING
        </div>
        <h1
          style={{
            margin:        0,
            fontSize:      '28px',
            fontWeight:    900,
            color:         T.text,
            letterSpacing: '-0.6px',
          }}
        >
          Simple, Honest Fares
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: '13px', color: T.textMuted, maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
          No surge pricing. No hidden fees. Your fare is calculated from four fixed components —
          base fare, distance, time, and a booking fee. That's it.
        </p>
      </div>

      {/* ── How pricing works ── */}
      <div style={{ marginTop: '28px', marginBottom: '28px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: T.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px', margin: '0 0 12px' }}>
          HOW YOUR FARE IS CALCULATED
        </p>
        <div
          style={{
            background:   T.surfaceAlt ?? '#F9FAFB',
            border:       `1.5px solid ${T.border}`,
            borderRadius: '16px',
            padding:      '20px',
          }}
        >
          {/* Formula */}
          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            '8px',
              flexWrap:       'wrap',
              marginBottom:   '20px',
              padding:        '14px',
              background:     '#16A34A08',
              border:         '1px solid #16A34A20',
              borderRadius:   '12px',
            }}
          >
            {[
              { label: 'Base Fare', color: '#16A34A' },
              { label: '+', color: T.textMuted, op: true },
              { label: 'Distance', color: '#16A34A' },
              { label: '+', color: T.textMuted, op: true },
              { label: 'Time', color: '#16A34A' },
              { label: '+', color: T.textMuted, op: true },
              { label: 'Booking Fee', color: '#16A34A' },
            ].map((item, i) => (
              <span
                key={i}
                style={{
                  fontFamily:   item.op ? 'inherit' : '"JetBrains Mono", monospace',
                  fontSize:     item.op ? '18px' : '13px',
                  fontWeight:   700,
                  color:        item.color,
                  background:   item.op ? 'none' : '#16A34A12',
                  border:       item.op ? 'none' : '1px solid #16A34A25',
                  borderRadius: '8px',
                  padding:      item.op ? '0' : '4px 10px',
                }}
              >
                {item.label}
              </span>
            ))}
          </div>

          {/* Explanation rows */}
          {[
            {
              label: 'Base Fare',
              desc:  'A flat fee charged at the start of every ride. Varies by tier.',
              icon:  '🚗',
            },
            {
              label: 'Distance',
              desc:  'Charged per mile traveled from pickup to drop-off.',
              icon:  '📍',
            },
            {
              label: 'Time',
              desc:  'Charged per minute of the trip. Keeps fares fair in traffic.',
              icon:  '⏱️',
            },
            {
              label: 'Booking Fee',
              desc:  'A small fee that covers platform operation costs.',
              icon:  '📋',
            },
          ].map((row, i) => (
            <div
              key={i}
              style={{
                display:       'flex',
                gap:           '12px',
                alignItems:    'flex-start',
                padding:       '10px 0',
                borderBottom:  i < 3 ? `1px solid ${T.border}` : 'none',
              }}
            >
              <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>{row.icon}</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: T.text, marginBottom: '2px' }}>{row.label}</div>
                <div style={{ fontSize: '12px', color: T.textMuted, lineHeight: 1.55 }}>{row.desc}</div>
              </div>
            </div>
          ))}

          {/* Minimum fare note */}
          <div
            style={{
              marginTop:    '14px',
              display:      'flex',
              gap:          '10px',
              alignItems:   'flex-start',
              background:   '#F59E0B08',
              border:       '1px solid #F59E0B25',
              borderRadius: '10px',
              padding:      '10px 12px',
            }}
          >
            <Info size={14} color="#F59E0B" style={{ flexShrink: 0, marginTop: '1px' }} />
            <p style={{ margin: 0, fontSize: '12px', color: T.textMuted, lineHeight: 1.6 }}>
              <strong style={{ color: T.text }}>Minimum fare:</strong> If the calculated fare falls
              below the tier minimum, the minimum fare applies. This ensures every trip is worthwhile
              for drivers.
            </p>
          </div>
        </div>
      </div>

      {/* ── Estimate calculator ── */}
      <div style={{ marginBottom: '28px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: T.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', margin: '0 0 12px' }}>
          ESTIMATE YOUR FARE
        </p>
        <div
          style={{
            background:   T.surfaceAlt ?? '#F9FAFB',
            border:       `1.5px solid ${T.border}`,
            borderRadius: '16px',
            padding:      '20px',
            display:      'flex',
            gap:          '14px',
            alignItems:   'flex-end',
            flexWrap:     'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: '140px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: T.textMuted, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
              Distance (miles)
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder="e.g. 3.5"
              value={miles}
              onChange={(e) => setMiles(e.target.value)}
              style={{
                width:        '100%',
                padding:      '10px 13px',
                borderRadius: '12px',
                border:       `1.5px solid ${T.border}`,
                background:   T.surface ?? '#fff',
                fontSize:     '14px',
                fontFamily:   '"JetBrains Mono", monospace',
                fontWeight:   600,
                color:        T.text,
                outline:      'none',
                boxSizing:    'border-box',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#16A34A')}
              onBlur={(e)  => (e.target.style.borderColor = T.border)}
            />
          </div>
          <div style={{ flex: 1, minWidth: '140px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: T.textMuted, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
              Trip time (minutes)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 12"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              style={{
                width:        '100%',
                padding:      '10px 13px',
                borderRadius: '12px',
                border:       `1.5px solid ${T.border}`,
                background:   T.surface ?? '#fff',
                fontSize:     '14px',
                fontFamily:   '"JetBrains Mono", monospace',
                fontWeight:   600,
                color:        T.text,
                outline:      'none',
                boxSizing:    'border-box',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#16A34A')}
              onBlur={(e)  => (e.target.style.borderColor = T.border)}
            />
          </div>
          {hasEstimate && (
            <div
              style={{
                fontSize:   '12px',
                color:      T.textMuted,
                flexBasis:  '100%',
                marginTop:  '-4px',
              }}
            >
              Showing estimates for a <strong style={{ color: T.text }}>{parsedMiles} mi</strong> / <strong style={{ color: T.text }}>{parsedMinutes} min</strong> trip.
              Actual fare may vary based on real-time route data.
            </div>
          )}
        </div>
      </div>

      {/* ── Tier cards ── */}
      <p style={{ fontSize: '11px', fontWeight: 700, color: T.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', margin: '0 0 16px' }}>
        RIDE TIERS
      </p>
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap:                 '20px',
          marginBottom:        '32px',
        }}
      >
        {TIERS.map((tier) => (
          <TierCard
            key={tier.id}
            tier={tier}
            estimatedFare={estimates[tier.id]}
            isSelected={selected === tier.id}
            onClick={() => setSelected(selected === tier.id ? null : tier.id)}
          />
        ))}
      </div>

      {/* ── No surge pricing callout ── */}
      <div
        style={{
          background:   '#16A34A08',
          border:       '1.5px solid #16A34A25',
          borderRadius: '16px',
          padding:      '20px 22px',
          marginBottom: '28px',
          display:      'flex',
          gap:          '14px',
          alignItems:   'flex-start',
        }}
      >
        <Shield size={22} color="#16A34A" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: T.text, marginBottom: '6px' }}>
            No surge pricing — ever
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: T.textMuted, lineHeight: 1.7 }}>
            UaTob does not charge surge or dynamic pricing. Your fare is calculated from the same
            fixed rates regardless of time of day, weather, holidays, or demand. The price you see
            at booking is the price you pay.
          </p>
        </div>
      </div>

      {/* ── Driver split note ── */}
      <div
        style={{
          background:   T.surfaceAlt ?? '#F9FAFB',
          border:       `1.5px solid ${T.border}`,
          borderRadius: '16px',
          padding:      '20px 22px',
          marginBottom: '32px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 700, color: T.text, marginBottom: '10px' }}>
          How fares are split
        </div>
        <div style={{ display: 'flex', gap: '0', borderRadius: '10px', overflow: 'hidden', marginBottom: '12px', height: '36px' }}>
          <div
            style={{
              flex:           '75',
              background:     'linear-gradient(90deg,#16A34A,#22C55E)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              fontSize:       '13px',
              fontWeight:     800,
              color:          '#fff',
              gap:            '6px',
            }}
          >
            🚗 Driver — 75%
          </div>
          <div
            style={{
              flex:           '25',
              background:     T.border,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              fontSize:       '12px',
              fontWeight:     700,
              color:          T.textMuted,
            }}
          >
            Platform — 25%
          </div>
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: T.textMuted, lineHeight: 1.65 }}>
          Drivers keep <strong style={{ color: T.text }}>75% of every fare</strong>. UaTob retains
          a 25% platform fee to cover payment processing, infrastructure, insurance support, and
          platform operations. There are no weekly fees or hidden deductions.
        </p>
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          borderTop:   `1px solid ${T.border}`,
          paddingTop:  '16px',
          paddingBottom:'32px',
          textAlign:   'center',
          fontSize:    '11px',
          color:       T.textMuted,
          lineHeight:  1.7,
        }}
      >
        Prices shown are in USD and apply to rides within the Orlando, Florida service area.
        Estimated fares are for reference only — final fares are calculated at the time of booking
        based on real-time route data.
        <br />
        Questions? Contact us at <strong style={{ color: T.text }}>support@uatob.com</strong>
      </div>

    </div>
  );
}