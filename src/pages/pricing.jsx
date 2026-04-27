// src/App/UaTob/PricingPage.jsx
import React, { useState, useMemo } from 'react';
import {
  Users, Clock, Shield, Info, Sparkles, MapPin, Calculator,
  TrendingUp, DollarSign, Crown, Car, Zap, Lock, Calendar,
  CheckCircle, ArrowRight, ChevronDown, Receipt,
} from 'lucide-react';
import { THEME as T } from '@/App/UaTob/pricing.js';

// ── Constants ─────────────────────────────────────────────
const ACCENT = '#16A34A';

// ── Exact tiers from the Price Cloud Function ────────────
const TIERS = [
  {
    id: 'economy',
    label: 'Economy',
    desc: 'Affordable everyday rides',
    eta: '7–20 min',
    capacity: 4,
    base: 1.50,
    perMile: 1.20,
    perMin: 0.18,
    bookingFee: 0.99,
    minimumFare: 4.99,
    color: '#16A34A',
    Icon: Car,
    tagline: 'Best value',
  },
  {
    id: 'standard',
    label: 'Standard',
    desc: 'Comfortable daily rides',
    eta: '2–7 min',
    capacity: 4,
    base: 2.00,
    perMile: 1.65,
    perMin: 0.25,
    bookingFee: 1.29,
    minimumFare: 6.99,
    color: '#2563EB',
    Icon: Zap,
    tagline: 'Fastest pickup',
    popular: true,
  },
  {
    id: 'premium',
    label: 'Premium',
    desc: 'Luxury rides',
    eta: '5–10 min',
    capacity: 4,
    base: 4.00,
    perMile: 3.25,
    perMin: 0.50,
    bookingFee: 1.99,
    minimumFare: 11.99,
    color: '#7C3AED',
    Icon: Crown,
    tagline: 'Top-tier vehicles',
  },
  {
    id: 'xl',
    label: 'XL',
    desc: 'Large group rides',
    eta: '5–9 min',
    capacity: 6,
    base: 2.50,
    perMile: 1.90,
    perMin: 0.30,
    bookingFee: 1.49,
    minimumFare: 8.49,
    color: '#D97706',
    Icon: Users,
    tagline: 'Up to 6 riders',
  },
];

const round2 = (n) => Number(Number(n).toFixed(2));

function estimateFare(tier, miles, minutes) {
  const subtotal = round2(tier.base + miles * tier.perMile + minutes * tier.perMin + tier.bookingFee);
  return Math.max(subtotal, tier.minimumFare);
}

// ── Helpers ───────────────────────────────────────────────
function SectionLabel({ children, color = ACCENT }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: `${color}10`,
      border: `1px solid ${color}30`,
      borderRadius: 100, padding: "4px 11px",
      marginBottom: 12,
    }}>
      <div style={{
        width: 5, height: 5, borderRadius: "50%", background: color,
      }}/>
      <span style={{
        fontSize: 10.5, fontWeight: 800, color,
        letterSpacing: "1.5px", textTransform: "uppercase",
      }}>
        {children}
      </span>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────
function StatPill({ icon, label }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: T.surfaceAlt ?? '#F9FAFB',
      border: `1px solid ${T.border}`,
      borderRadius: 100, padding: "3px 10px",
      fontSize: 11, fontWeight: 600, color: T.textMuted,
      whiteSpace: "nowrap",
    }}>
      {icon}
      <span>{label}</span>
    </span>
  );
}

function RateRow({ label, value, note, color }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      padding: "7px 0",
      borderBottom: `1px solid ${T.border}`,
    }}>
      <span style={{ fontSize: 12, color: T.textMuted }}>{label}</span>
      <div style={{ textAlign: "right" }}>
        <span style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 13, fontWeight: 700, color,
          fontVariantNumeric: "tabular-nums",
        }}>
          {value}
        </span>
        {note && (
          <span style={{ fontSize: 10, color: T.textMuted, marginLeft: 4 }}>{note}</span>
        )}
      </div>
    </div>
  );
}

function TierCard({ tier, estimatedFare, isSelected, onClick }) {
  const Icon = tier.Icon;
  const isPremium = tier.id === "premium";

  return (
    <div
      onClick={onClick}
      style={{
        background: isPremium && isSelected
          ? `linear-gradient(135deg, ${tier.color}10, ${tier.color}03)`
          : isSelected
            ? `${tier.color}05`
            : T.surface ?? '#FFFFFF',
        border: `2px solid ${isSelected ? tier.color : T.border}`,
        borderRadius: 20,
        padding: 22,
        cursor: "pointer",
        transition: "all .25s",
        position: "relative",
        boxShadow: isSelected
          ? `0 12px 32px ${tier.color}25, 0 2px 6px ${tier.color}15`
          : `0 1px 3px rgba(0,0,0,0.02)`,
        transform: isSelected ? "translateY(-2px)" : "translateY(0)",
      }}
      onMouseEnter={e => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = `${tier.color}50`;
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = `0 8px 20px ${tier.color}15`;
        }
      }}
      onMouseLeave={e => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = T.border;
          e.currentTarget.style.transform = "";
          e.currentTarget.style.boxShadow = `0 1px 3px rgba(0,0,0,0.02)`;
        }
      }}
    >
      {/* Popular badge */}
      {tier.popular && (
        <div style={{
          position: "absolute", top: -11, left: "50%",
          transform: "translateX(-50%)",
          background: `linear-gradient(135deg, ${tier.color}, ${tier.color}DD)`,
          color: "#fff", fontSize: 10, fontWeight: 800,
          letterSpacing: "0.6px", padding: "3px 12px",
          borderRadius: 100, whiteSpace: "nowrap",
          boxShadow: `0 4px 10px ${tier.color}50`,
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          <Sparkles size={9} fill="#fff" strokeWidth={0}/>
          MOST POPULAR
        </div>
      )}

      {/* Premium gold ring */}
      {isPremium && (
        <div style={{
          position: "absolute", top: -1, left: -1, right: -1, bottom: -1,
          borderRadius: 20,
          background: `linear-gradient(135deg, transparent 30%, ${tier.color}30 50%, transparent 70%)`,
          pointerEvents: "none",
          zIndex: 0,
          opacity: isSelected ? 1 : 0.5,
          transition: "opacity .25s",
        }}/>
      )}

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          marginBottom: 14,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: 4,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `linear-gradient(135deg, ${tier.color}, ${tier.color}DD)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                boxShadow: `0 4px 12px ${tier.color}40`,
              }}>
                <Icon size={17} color="#fff" strokeWidth={2.2}/>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 18, fontWeight: 900, color: T.text,
                  letterSpacing: "-0.3px", lineHeight: 1.1,
                }}>
                  {tier.label}
                </div>
                <div style={{
                  fontSize: 10.5, fontWeight: 700, color: tier.color,
                  letterSpacing: "0.04em", textTransform: "uppercase",
                  marginTop: 1,
                }}>
                  {tier.tagline}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 8 }}>
              {tier.desc}
            </div>
          </div>

          {estimatedFare !== null && (
            <div style={{
              textAlign: "right",
              background: `${tier.color}08`,
              border: `1px solid ${tier.color}25`,
              borderRadius: 12,
              padding: "8px 12px",
              flexShrink: 0,
              marginLeft: 8,
            }}>
              <div style={{
                fontSize: 9, fontWeight: 800, color: tier.color,
                letterSpacing: "0.08em", textTransform: "uppercase",
                marginBottom: 2,
              }}>
                Estimate
              </div>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 22, fontWeight: 800, color: tier.color,
                lineHeight: 1, letterSpacing: "-0.5px",
                fontVariantNumeric: "tabular-nums",
              }}>
                ${estimatedFare.toFixed(2)}
              </div>
            </div>
          )}
        </div>

        {/* Pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          <StatPill icon={<Users size={10}/>} label={`Up to ${tier.capacity} riders`}/>
          <StatPill icon={<Clock size={10}/>} label={tier.eta}/>
        </div>

        {/* Rate breakdown */}
        <div>
          <RateRow label="Base fare"   value={`$${tier.base.toFixed(2)}`}    color={tier.color}/>
          <RateRow label="Per mile"    value={`$${tier.perMile.toFixed(2)}`} note="/ mi" color={tier.color}/>
          <RateRow label="Per minute"  value={`$${tier.perMin.toFixed(2)}`}  note="/ min" color={tier.color}/>
          <RateRow label="Booking fee" value={`$${tier.bookingFee.toFixed(2)}`} color={tier.color}/>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            paddingTop: 10,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted }}>
              Minimum fare
            </span>
            <span style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 13, fontWeight: 700, color: tier.color,
              background: `${tier.color}12`,
              border: `1px solid ${tier.color}25`,
              borderRadius: 8, padding: "2px 8px",
              fontVariantNumeric: "tabular-nums",
            }}>
              ${tier.minimumFare.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Quick-pick buttons for calculator ─────────────────────
function QuickPick({ miles, minutes, onPick, active }) {
  return (
    <button
      type="button"
      onClick={onPick}
      style={{
        background: active ? ACCENT : T.surface ?? "#FFFFFF",
        border: `1.5px solid ${active ? ACCENT : T.border}`,
        borderRadius: 100,
        padding: "6px 12px",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 11.5, fontWeight: 700,
        color: active ? "#fff" : T.text,
        transition: "all .15s",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.borderColor = ACCENT;
          e.currentTarget.style.color = ACCENT;
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.borderColor = T.border;
          e.currentTarget.style.color = T.text;
        }
      }}
    >
      {miles} mi · {minutes} min
    </button>
  );
}

// ── Main component ───────────────────────────────────────
export default function PricingPage() {
  const [miles, setMiles]     = useState('');
  const [minutes, setMinutes] = useState('');
  const [selected, setSelected] = useState(null);

  const parsedMiles   = parseFloat(miles)   || 0;
  const parsedMinutes = parseFloat(minutes) || 0;
  const hasEstimate   = parsedMiles > 0 && parsedMinutes > 0;

  const estimates = useMemo(() => Object.fromEntries(
    TIERS.map(t => [t.id, hasEstimate ? estimateFare(t, parsedMiles, parsedMinutes) : null])
  ), [parsedMiles, parsedMinutes, hasEstimate]);

  const cheapest = useMemo(() => {
    if (!hasEstimate) return null;
    return TIERS.reduce((min, t) =>
      estimates[t.id] < estimates[min.id] ? t : min
    , TIERS[0]);
  }, [estimates, hasEstimate]);

  const quickPicks = [
    { miles: 2, minutes: 8, label: "Short" },
    { miles: 5, minutes: 15, label: "Medium" },
    { miles: 10, minutes: 25, label: "Across town" },
    { miles: 18, minutes: 40, label: "Airport" },
  ];

  const handleQuickPick = (m, mn) => {
    setMiles(String(m));
    setMinutes(String(mn));
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 4px", fontFamily: "inherit" }}>
      <style>{`
        @keyframes ppFadeUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes ppShimmer { 0%,100% { opacity: .5 } 50% { opacity: 1 } }
        @keyframes ppGrow { from { transform: scaleX(0); transform-origin: left; } to { transform: scaleX(1); transform-origin: left; } }
      `}</style>

      {/* ── Hero ── */}
      <div style={{
        position: "relative",
        background: "linear-gradient(135deg,#F0FDF4 0%,#DCFCE7 50%,#F0FDF4 100%)",
        border: `1.5px solid rgba(22,163,74,.25)`,
        borderRadius: 24,
        padding: "32px 28px",
        marginTop: 16,
        marginBottom: 22,
        overflow: "hidden",
        boxShadow: "0 12px 32px rgba(22,163,74,.10)",
        textAlign: "center",
      }}>
        {/* Decorative corner glows */}
        <div style={{
          position: "absolute", top: -60, right: -60,
          width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(22,163,74,0.20) 0%, transparent 70%)",
          pointerEvents: "none",
        }}/>
        <div style={{
          position: "absolute", bottom: -40, left: -40,
          width: 140, height: 140, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(34,197,94,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        }}/>
        {/* Diagonal stripes */}
        <div style={{
          position: "absolute", inset: 0,
          background: "repeating-linear-gradient(45deg,transparent,transparent 60px,rgba(22,163,74,.04) 60px,rgba(22,163,74,.04) 61px)",
          pointerEvents: "none",
        }}/>

        <div style={{ position: "relative" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(22,163,74,.25)",
            borderRadius: 100, padding: "5px 12px",
            marginBottom: 18,
            boxShadow: "0 4px 12px rgba(22,163,74,.12)",
          }}>
            <Lock size={11} color={ACCENT} strokeWidth={2.6}/>
            <span style={{
              fontSize: 10.5, fontWeight: 800, color: ACCENT,
              letterSpacing: "1px", textTransform: "uppercase",
            }}>
              Transparent Pricing
            </span>
            <span style={{
              width: 4, height: 4, borderRadius: "50%",
              background: "#22C55E",
              animation: "ppShimmer 2s ease-in-out infinite",
            }}/>
          </div>

          <h1 style={{
            margin: 0, fontSize: 38, fontWeight: 900, color: T.text,
            letterSpacing: "-1px", lineHeight: 1.1, marginBottom: 14,
          }}>
            Simple, honest{" "}
            <span style={{
              background: "linear-gradient(135deg, #22C55E, #16A34A 60%, #15803D)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              fares
            </span>
          </h1>

          <p style={{
            margin: "0 auto 20px", fontSize: 14.5, color: T.textMuted,
            lineHeight: 1.65, maxWidth: 480,
          }}>
            No surge pricing. No hidden fees. Your fare is calculated from four fixed components — base fare, distance, time, and a booking fee. That's it.
          </p>

          {/* Trust pills */}
          <div style={{
            display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap",
          }}>
            {[
              { Icon: Lock, text: "No surge pricing" },
              { Icon: CheckCircle, text: "No hidden fees" },
              { Icon: Receipt, text: "Fare shown upfront" },
            ].map(({ Icon, text }) => (
              <div key={text} style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(22,163,74,.18)",
                borderRadius: 100, padding: "5px 10px",
                fontSize: 11.5, fontWeight: 700, color: "#15803D",
              }}>
                <Icon size={11} strokeWidth={2.4}/>
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Estimate Calculator (FEATURED, MOVED UP) ── */}
      <div style={{ marginBottom: 32 }}>
        <SectionLabel>Estimate your fare</SectionLabel>
        <h2 style={{
          margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: T.text,
          letterSpacing: "-0.5px", lineHeight: 1.1,
        }}>
          Quick fare calculator
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: 13.5, color: T.textMuted, lineHeight: 1.6 }}>
          Pick a typical trip or enter custom values to see live estimates across all four tiers.
        </p>

        <div style={{
          background: T.surface ?? "#FFFFFF",
          border: `1.5px solid ${T.border}`,
          borderRadius: 20,
          padding: 22,
          boxShadow: "0 4px 16px rgba(0,0,0,.04)",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Decorative calculator icon */}
          <div style={{
            position: "absolute", top: 16, right: 16,
            opacity: 0.06, pointerEvents: "none",
          }}>
            <Calculator size={56} color={ACCENT}/>
          </div>

          {/* Quick-pick chips */}
          <div style={{ marginBottom: 18, position: "relative" }}>
            <div style={{
              fontSize: 10.5, fontWeight: 800, color: T.textMuted,
              letterSpacing: "0.08em", textTransform: "uppercase",
              marginBottom: 8,
            }}>
              Quick presets
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {quickPicks.map((p, i) => {
                const isActive = parsedMiles === p.miles && parsedMinutes === p.minutes;
                return (
                  <QuickPick
                    key={i}
                    miles={p.miles}
                    minutes={p.minutes}
                    active={isActive}
                    onPick={() => handleQuickPick(p.miles, p.minutes)}
                  />
                );
              })}
            </div>
          </div>

          {/* Input fields */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{
                display: "block", fontSize: 10.5, fontWeight: 800,
                color: T.textMuted, letterSpacing: "0.08em",
                textTransform: "uppercase", marginBottom: 6,
              }}>
                Distance
              </label>
              <div style={{ position: "relative" }}>
                <MapPin
                  size={14}
                  color={T.textMuted}
                  style={{
                    position: "absolute", left: 12, top: "50%",
                    transform: "translateY(-50%)", pointerEvents: "none",
                  }}
                />
                <input
                  type="number" min="0" step="0.1"
                  placeholder="e.g. 3.5"
                  value={miles}
                  onChange={e => setMiles(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "11px 50px 11px 34px",
                    borderRadius: 12,
                    border: `1.5px solid ${T.border}`,
                    background: T.surfaceAlt ?? "#F9FAFB",
                    fontSize: 14,
                    fontFamily: '"JetBrains Mono", monospace',
                    fontWeight: 700, color: T.text,
                    outline: "none", boxSizing: "border-box",
                    transition: "border-color .15s, background .15s",
                    fontVariantNumeric: "tabular-nums",
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = ACCENT;
                    e.target.style.background = T.surface ?? "#FFF";
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = T.border;
                    e.target.style.background = T.surfaceAlt ?? "#F9FAFB";
                  }}
                />
                <span style={{
                  position: "absolute", right: 12, top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 11, fontWeight: 700, color: T.textMuted,
                  pointerEvents: "none",
                }}>
                  miles
                </span>
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{
                display: "block", fontSize: 10.5, fontWeight: 800,
                color: T.textMuted, letterSpacing: "0.08em",
                textTransform: "uppercase", marginBottom: 6,
              }}>
                Trip time
              </label>
              <div style={{ position: "relative" }}>
                <Clock
                  size={14}
                  color={T.textMuted}
                  style={{
                    position: "absolute", left: 12, top: "50%",
                    transform: "translateY(-50%)", pointerEvents: "none",
                  }}
                />
                <input
                  type="number" min="0" step="1"
                  placeholder="e.g. 12"
                  value={minutes}
                  onChange={e => setMinutes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "11px 56px 11px 34px",
                    borderRadius: 12,
                    border: `1.5px solid ${T.border}`,
                    background: T.surfaceAlt ?? "#F9FAFB",
                    fontSize: 14,
                    fontFamily: '"JetBrains Mono", monospace',
                    fontWeight: 700, color: T.text,
                    outline: "none", boxSizing: "border-box",
                    transition: "border-color .15s, background .15s",
                    fontVariantNumeric: "tabular-nums",
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = ACCENT;
                    e.target.style.background = T.surface ?? "#FFF";
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = T.border;
                    e.target.style.background = T.surfaceAlt ?? "#F9FAFB";
                  }}
                />
                <span style={{
                  position: "absolute", right: 12, top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 11, fontWeight: 700, color: T.textMuted,
                  pointerEvents: "none",
                }}>
                  minutes
                </span>
              </div>
            </div>
          </div>

          {/* Estimate summary */}
          {hasEstimate && cheapest && (
            <div style={{
              marginTop: 16,
              background: `${ACCENT}08`,
              border: `1px solid ${ACCENT}25`,
              borderRadius: 12, padding: "10px 14px",
              display: "flex", alignItems: "center", gap: 10,
              animation: "ppFadeUp .3s ease-out",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: ACCENT,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Sparkles size={13} color="#fff" strokeWidth={2.4}/>
              </div>
              <div style={{ flex: 1, fontSize: 12.5, color: T.text, lineHeight: 1.5 }}>
                For a <strong>{parsedMiles} mi · {parsedMinutes} min</strong> trip,{" "}
                <strong style={{ color: ACCENT }}>{cheapest.label}</strong> starts at{" "}
                <strong style={{ color: ACCENT, fontFamily: '"JetBrains Mono", monospace' }}>
                  ${estimates[cheapest.id].toFixed(2)}
                </strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Tier cards ── */}
      <div style={{ marginBottom: 36 }}>
        <SectionLabel>Choose your ride</SectionLabel>
        <h2 style={{
          margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: T.text,
          letterSpacing: "-0.5px", lineHeight: 1.1,
        }}>
          Four tiers, one promise
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: 13.5, color: T.textMuted, lineHeight: 1.6 }}>
          Tap a card to see its fare highlighted. {hasEstimate && "Live estimates shown for your trip."}
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 18,
        }}>
          {TIERS.map(tier => (
            <TierCard
              key={tier.id}
              tier={tier}
              estimatedFare={estimates[tier.id]}
              isSelected={selected === tier.id}
              onClick={() => setSelected(selected === tier.id ? null : tier.id)}
            />
          ))}
        </div>
      </div>

      {/* ── How pricing works ── */}
      <div style={{ marginBottom: 36 }}>
        <SectionLabel>How it works</SectionLabel>
        <h2 style={{
          margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: T.text,
          letterSpacing: "-0.5px", lineHeight: 1.1,
        }}>
          How your fare is calculated
        </h2>
        <p style={{ margin: "0 0 18px", fontSize: 13.5, color: T.textMuted, lineHeight: 1.6 }}>
          Four fixed components — no surprises, no math anxiety.
        </p>

        <div style={{
          background: T.surface ?? "#FFFFFF",
          border: `1.5px solid ${T.border}`,
          borderRadius: 20, padding: 22,
        }}>
          {/* Visual formula */}
          <div style={{
            background: `linear-gradient(135deg, ${ACCENT}06, ${ACCENT}02)`,
            border: `1px solid ${ACCENT}25`,
            borderRadius: 14,
            padding: 18,
            marginBottom: 18,
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, flexWrap: "wrap",
            }}>
              {[
                { label: "Base", short: "fee", color: ACCENT },
                { op: "+" },
                { label: "Distance", short: "× miles", color: "#2563EB" },
                { op: "+" },
                { label: "Time", short: "× min", color: "#7C3AED" },
                { op: "+" },
                { label: "Booking", short: "fee", color: "#D97706" },
                { op: "=" },
                { label: "Fare", short: "total", color: T.text, isResult: true },
              ].map((item, i) => {
                if (item.op) {
                  return (
                    <span key={i} style={{
                      fontSize: 18, fontWeight: 800,
                      color: T.textMuted,
                    }}>
                      {item.op}
                    </span>
                  );
                }
                return (
                  <div key={i} style={{
                    background: item.isResult
                      ? `linear-gradient(135deg, ${ACCENT}, ${ACCENT}DD)`
                      : `${item.color}10`,
                    border: item.isResult ? "none" : `1.5px solid ${item.color}30`,
                    borderRadius: 10,
                    padding: "7px 10px",
                    textAlign: "center",
                    boxShadow: item.isResult ? `0 4px 12px ${ACCENT}40` : "none",
                  }}>
                    <div style={{
                      fontSize: 11.5, fontWeight: 800,
                      color: item.isResult ? "#fff" : item.color,
                      letterSpacing: "0.02em",
                    }}>
                      {item.label}
                    </div>
                    <div style={{
                      fontSize: 9, fontWeight: 600,
                      color: item.isResult ? "rgba(255,255,255,0.8)" : T.textMuted,
                      marginTop: 1, fontFamily: '"JetBrains Mono", monospace',
                    }}>
                      {item.short}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Component explanations */}
          {[
            { Icon: DollarSign, color: ACCENT,    label: "Base Fare",   desc: "A flat fee charged at the start of every ride. Varies by tier — Economy is lowest, Premium is highest." },
            { Icon: MapPin,     color: "#2563EB", label: "Distance",    desc: "Charged per mile traveled from pickup to drop-off. Calculated from real-time GPS." },
            { Icon: Clock,      color: "#7C3AED", label: "Time",        desc: "Charged per minute of the trip. Keeps fares fair when you hit traffic or take a longer route." },
            { Icon: Receipt,    color: "#D97706", label: "Booking Fee", desc: "A small fixed fee that covers payment processing, support, and platform infrastructure." },
          ].map((row, i, arr) => {
            const Icon = row.Icon;
            return (
              <div key={i} style={{
                display: "flex", gap: 12, alignItems: "flex-start",
                padding: "12px 0",
                borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none",
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: `linear-gradient(135deg, ${row.color}18, ${row.color}08)`,
                  border: `1px solid ${row.color}25`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Icon size={15} color={row.color} strokeWidth={2.2}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13.5, fontWeight: 800, color: T.text,
                    marginBottom: 3, letterSpacing: "-0.1px",
                  }}>
                    {row.label}
                  </div>
                  <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.55 }}>
                    {row.desc}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Minimum fare callout */}
          <div style={{
            marginTop: 14,
            display: "flex", gap: 10, alignItems: "flex-start",
            background: "#FFFBEB",
            border: "1px solid #FDE68A",
            borderRadius: 12, padding: "12px 14px",
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: 8,
              background: "#D9770618",
              border: "1px solid #D9770630",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <Info size={13} color="#D97706" strokeWidth={2.4}/>
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: "#92400E", lineHeight: 1.6 }}>
              <strong style={{ color: "#7C2D12" }}>Minimum fare:</strong> If the calculated fare falls below the tier minimum, the minimum fare applies. This ensures every trip is worthwhile for drivers.
            </p>
          </div>
        </div>
      </div>

      {/* ── No surge callout (anchor) ── */}
      <div style={{
        background: "linear-gradient(135deg, rgba(22,163,74,.08), rgba(22,163,74,.03))",
        border: "1.5px solid rgba(22,163,74,.28)",
        borderRadius: 20,
        padding: "22px 24px",
        marginBottom: 32,
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -30, right: -30,
          width: 120, height: 120, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(22,163,74,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }}/>
        <div style={{
          position: "relative",
          display: "flex", gap: 14, alignItems: "flex-start",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: `linear-gradient(135deg, ${ACCENT}, #15803D)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 8px 20px rgba(22,163,74,.35)",
          }}>
            <Lock size={22} color="#fff" strokeWidth={2.2}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 18, fontWeight: 900, color: T.text,
              letterSpacing: "-0.3px", lineHeight: 1.1, marginBottom: 6,
            }}>
              No surge pricing — ever
            </div>
            <p style={{ margin: 0, fontSize: 13, color: T.textMuted, lineHeight: 1.65 }}>
              UaTob does not charge surge or dynamic pricing. Your fare is calculated from the same fixed rates regardless of time of day, weather, holidays, or demand. The price you see at booking is the price you pay.
            </p>
            <div style={{
              display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10,
            }}>
              {["Rush hour", "Late night", "Weekends", "Holidays", "Bad weather", "Big events"].map(t => (
                <span key={t} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: "rgba(255,255,255,0.7)",
                  border: `1px solid rgba(22,163,74,.2)`,
                  borderRadius: 100,
                  padding: "3px 9px",
                  fontSize: 10.5, fontWeight: 700, color: "#15803D",
                }}>
                  <CheckCircle size={9} strokeWidth={2.6}/>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Driver split (animated) ── */}
      <div style={{
        background: T.surface ?? "#FFFFFF",
        border: `1.5px solid ${T.border}`,
        borderRadius: 20,
        padding: "22px 24px",
        marginBottom: 32,
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 14, flexWrap: "wrap", gap: 8,
        }}>
          <div>
            <div style={{
              fontSize: 16, fontWeight: 900, color: T.text,
              letterSpacing: "-0.3px", lineHeight: 1.1,
            }}>
              How fares are split
            </div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
              Drivers keep the majority of every fare.
            </div>
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: `${ACCENT}10`,
            border: `1px solid ${ACCENT}30`,
            borderRadius: 100, padding: "4px 10px",
            fontSize: 11, fontWeight: 800, color: ACCENT,
          }}>
            <TrendingUp size={11} strokeWidth={2.4}/>
            Industry-leading
          </div>
        </div>

        {/* Stacked bar */}
        <div style={{
          display: "flex",
          borderRadius: 12,
          overflow: "hidden",
          marginBottom: 14,
          height: 44,
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)",
        }}>
          <div style={{
            flex: "75",
            background: "linear-gradient(135deg, #22C55E, #16A34A 60%, #15803D)",
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 8, color: "#fff",
            fontSize: 14, fontWeight: 900,
            letterSpacing: "-0.2px",
            position: "relative",
            animation: "ppGrow .8s cubic-bezier(.34,1.2,.64,1) both",
            boxShadow: "0 2px 8px rgba(22,163,74,.35)",
          }}>
            <Car size={15} color="#fff" fill="rgba(255,255,255,0.15)" strokeWidth={2.2}/>
            <span>Driver · 75%</span>
          </div>
          <div style={{
            flex: "25",
            background: "linear-gradient(135deg, #6B7280, #4B5563)",
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 6, color: "#fff",
            fontSize: 12, fontWeight: 800,
            letterSpacing: "-0.1px",
            animation: "ppGrow .8s cubic-bezier(.34,1.2,.64,1) .2s both",
          }}>
            Platform · 25%
          </div>
        </div>

        {/* Real $ example */}
        <div style={{
          background: T.surfaceAlt ?? "#F9FAFB",
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: "12px 14px",
          marginBottom: 12,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 10,
        }}>
          <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>
            Example: <strong style={{ color: T.text }}>$20.00 fare</strong>
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" }}>
                Driver gets
              </div>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 16, fontWeight: 800, color: ACCENT,
                fontVariantNumeric: "tabular-nums",
              }}>
                $15.00
              </div>
            </div>
            <div style={{ width: 1, height: 24, background: T.border }}/>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" }}>
                Platform
              </div>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 16, fontWeight: 800, color: T.textMuted,
                fontVariantNumeric: "tabular-nums",
              }}>
                $5.00
              </div>
            </div>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 12, color: T.textMuted, lineHeight: 1.6 }}>
          The 25% platform fee covers payment processing, infrastructure, insurance support, and operations. <strong style={{ color: T.text }}>No weekly fees, no surprise deductions.</strong> Drivers also keep <strong style={{ color: ACCENT }}>100% of tips</strong>.
        </p>
      </div>

      {/* ── Service area + footer ── */}
      <div style={{
        background: T.surface ?? "#FFFFFF",
        border: `1px solid ${T.border}`,
        borderRadius: 18,
        padding: "20px 22px",
        marginTop: 16, marginBottom: 32,
        textAlign: "center",
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          background: `${ACCENT}10`,
          border: `1px solid ${ACCENT}25`,
          borderRadius: 100,
          padding: "5px 11px",
          marginBottom: 12,
        }}>
          <MapPin size={11} color={ACCENT} strokeWidth={2.6}/>
          <span style={{
            fontSize: 10.5, fontWeight: 800, color: ACCENT,
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
            Service Area
          </span>
        </div>
        <div style={{
          fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 8,
        }}>
          Orlando, Florida & surrounding metro
        </div>
        <p style={{
          margin: "0 0 12px", fontSize: 11.5, color: T.textMuted, lineHeight: 1.65,
          maxWidth: 460, marginLeft: "auto", marginRight: "auto",
        }}>
          Prices shown are in USD. Estimated fares are for reference only — final fares are calculated at booking based on real-time route data.
        </p>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 11, color: T.textMuted, fontWeight: 600,
        }}>
          Questions?{" "}
          <a
            href="mailto:support@uatob.com"
            style={{
              color: ACCENT,
              fontWeight: 800,
              textDecoration: "none",
              borderBottom: `1px dotted ${ACCENT}`,
            }}
          >
            support@uatob.com
          </a>
        </div>
      </div>
    </div>
  );
}
