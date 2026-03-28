import React from 'react';
import { Car, Star, Check } from 'lucide-react';
import { THEME as T } from '@/App/pricing.js';

// ── DRIVER / RIDE COLORS (UI ONLY) ───────────────────────
const RIDE_COLORS = {
  standard: '#16A34A',
  premium: '#7C3AED',
  xl: '#F59E0B',
};

function getDriverColor(type) {
  return RIDE_COLORS[type] || '#16A34A';
}

export default function LiveTrackingPanel({
  pickup = '',
  dropoff = '',
  fareData = null,
  tripData = null,
  assignedDriver = null,
  rideStatus = '',
  etaMinutes = 0,
  distToDropoff = 0,
  getProgress = () => [],
}) {
  const driverColor = getDriverColor(assignedDriver?.type);

  return (
    <div className="glass" style={{ padding: '26px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '26px',
        }}
      >
        <h2
          style={{
            fontSize: '20px',
            fontWeight: 800,
            letterSpacing: '-0.4px',
            color: T.text,
          }}
        >
          Live Tracking
        </h2>

        {rideStatus === 'completed' && (
          <div className="live-badge">Complete ✓</div>
        )}
      </div>

      {/* Progress Steps */}
      <div
        style={{
          display: 'flex',
          position: 'relative',
          marginBottom: '28px',
        }}
      >
        {getProgress().map((step, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
            }}
          >
            {i < 3 && (
              <div
                style={{
                  position: 'absolute',
                  top: '15px',
                  left: '50%',
                  width: '100%',
                  height: '2px',
                  background:
                    step.status === 'completed'
                      ? 'linear-gradient(90deg,#16A34A,#22C55E)'
                      : T.border,
                  zIndex: 0,
                  transition: 'all .5s',
                }}
              />
            )}

            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                background:
                  step.status === 'completed'
                    ? 'linear-gradient(135deg,#16A34A,#15803D)'
                    : step.status === 'current'
                    ? 'linear-gradient(135deg,#111827,#374151)'
                    : '#F3F4F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 1,
                boxShadow:
                  step.status !== 'pending'
                    ? `0 4px 14px ${
                        step.status === 'completed'
                          ? 'rgba(22,163,74,.28)'
                          : 'rgba(17,24,39,.2)'
                      }`
                    : 'none',
                transition: 'all .4s',
              }}
            >
              {step.status === 'completed' ? (
                <Check size={15} color="#fff" strokeWidth={3} />
              ) : step.status === 'current' ? (
                <div
                  style={{
                    width: '7px',
                    height: '7px',
                    background: '#fff',
                    borderRadius: '50%',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    background: '#D1D5DB',
                    borderRadius: '50%',
                  }}
                />
              )}
            </div>

            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: step.status === 'pending' ? '#D1D5DB' : T.textMid,
                marginTop: '8px',
                textAlign: 'center',
              }}
            >
              {step.label}
            </div>
          </div>
        ))}
      </div>

      {/* Route Summary */}
      <div
        style={{
          background: T.surfaceAlt,
          border: `1px solid ${T.border}`,
          borderRadius: '16px',
          padding: '18px',
          marginBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', gap: '14px', alignItems: 'stretch' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <div
              style={{
                width: '10px',
                height: '10px',
                background: T.ink,
                borderRadius: '50%',
              }}
            />
            <div
              style={{
                width: '1.5px',
                flex: 1,
                background: T.border,
              }}
            />
            <div
              style={{
                width: '10px',
                height: '10px',
                background: T.accent,
                borderRadius: '2px',
                transform: 'rotate(45deg)',
              }}
            />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: '14px' }}>
              <div className="lbl">From</div>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: T.text,
                }}
              >
                {pickup || 'Pickup location'}
              </div>
            </div>

            <div>
              <div className="lbl">To</div>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: T.text,
                }}
              >
                {dropoff || 'Drop-off location'}
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div className="lbl">Fare</div>
            <div
              style={{
                fontFamily: '"JetBrains Mono",monospace',
                fontSize: '22px',
                fontWeight: 700,
                color: T.accent,
              }}
            >
              ${fareData?.total ?? '--'}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: T.textMuted,
                marginTop: '2px',
              }}
            >
              {tripData?.miles ?? tripData?.actualMiles ?? 0} mi
            </div>
          </div>
        </div>
      </div>

      {/* Distance Remaining */}
      {['heading_to_dropoff', 'arrived_at_dropoff'].includes(rideStatus) && (
        <div
          style={{
            background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)',
            border: `1.5px solid ${T.accentBorder}`,
            borderRadius: '16px',
            padding: '20px',
            textAlign: 'center',
            marginBottom: '14px',
            animation: 'scaleIn .4s ease-out',
          }}
        >
          <div className="lbl" style={{ marginBottom: '6px' }}>
            Distance Remaining
          </div>

          <div
            style={{
              fontFamily: '"JetBrains Mono",monospace',
              fontSize: '50px',
              fontWeight: 700,
              letterSpacing: '-2px',
              lineHeight: 1,
              color: T.accent,
            }}
          >
            {distToDropoff}
            <span
              style={{
                fontSize: '22px',
                fontWeight: 400,
                color: T.textMuted,
                marginLeft: '4px',
              }}
            >
              mi
            </span>
          </div>

          <div
            style={{
              fontSize: '13px',
              color: T.textMuted,
              marginTop: '8px',
            }}
          >
            ~{etaMinutes} min remaining
          </div>
        </div>
      )}

      {/* Driver Card */}
      <div
        style={{
          background: T.surfaceAlt,
          border: `1.5px solid ${driverColor}25`,
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        <div
          style={{
            width: '50px',
            height: '50px',
            background: driverColor,
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Car size={24} color="#fff" />
        </div>

        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '3px',
            }}
          >
            <span
              style={{
                fontSize: '16px',
                fontWeight: 800,
                color: T.text,
              }}
            >
              {assignedDriver?.name || 'Finding driver...'}
            </span>

            {assignedDriver?.rating && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#F59E0B',
                }}
              >
                <Star size={11} fill="#F59E0B" />
                {assignedDriver.rating}
              </span>
            )}
          </div>

          <div
            style={{
              fontSize: '13px',
              color: T.textMuted,
            }}
          >
            {assignedDriver
              ? `${assignedDriver.vehicle} · ${assignedDriver.plate}`
              : 'Driver details will appear here'}
          </div>
        </div>
      </div>
    </div>
  );
}