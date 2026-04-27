// src/App/UaTob/AboutPage.jsx
import React, { useState, useMemo } from 'react';
import {
  MapPin, Shield, Users, Zap, Heart, Star, ArrowRight,
  Phone, Mail, Globe, Sparkles, TrendingUp, Award,
  CheckCircle, Clock, Crown, Car, DollarSign, Lock,
  ChevronDown, ChevronRight, MessageCircle,
} from 'lucide-react';
import { THEME as T } from '@/App/UaTob/pricing.js';

// ── Constants ─────────────────────────────────────────────
const ACCENT = '#16A34A';

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
        width: 5, height: 5, borderRadius: "50%",
        background: color,
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

function Heading({ children, center = false, size = '28px' }) {
  return (
    <h2 style={{
      margin: '0 0 12px',
      fontSize: size, fontWeight: 900, color: T.text,
      letterSpacing: "-0.6px", lineHeight: 1.15,
      textAlign: center ? 'center' : 'left',
    }}>
      {children}
    </h2>
  );
}

function Body({ children, center = false }) {
  return (
    <p style={{
      margin: '0 0 12px', fontSize: 14, color: T.textMuted,
      lineHeight: 1.75,
      textAlign: center ? 'center' : 'left',
    }}>
      {children}
    </p>
  );
}

function Divider() {
  return (
    <div style={{
      height: 1, background: T.border,
      margin: "44px 0",
    }}/>
  );
}

// ── Mini Orlando map (decorative SVG) ─────────────────────
function OrlandoMap() {
  return (
    <svg
      viewBox="0 0 200 140"
      style={{
        position: "absolute", inset: 0,
        width: "100%", height: "100%",
        opacity: 0.7,
      }}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="aboutMapBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F0FDF4"/>
          <stop offset="100%" stopColor="#DCFCE7"/>
        </linearGradient>
        <radialGradient id="aboutMapGlow" cx="50%" cy="55%" r="40%">
          <stop offset="0%" stopColor="rgba(34,197,94,0.18)"/>
          <stop offset="100%" stopColor="rgba(34,197,94,0)"/>
        </radialGradient>
      </defs>
      <rect width="200" height="140" fill="url(#aboutMapBg)"/>
      <rect width="200" height="140" fill="url(#aboutMapGlow)"/>

      {/* Grid */}
      <g opacity="0.18" stroke="#16A34A" strokeWidth="0.3">
        <line x1="0" y1="35" x2="200" y2="35"/>
        <line x1="0" y1="70" x2="200" y2="70"/>
        <line x1="0" y1="105" x2="200" y2="105"/>
        <line x1="50" y1="0" x2="50" y2="140"/>
        <line x1="100" y1="0" x2="100" y2="140"/>
        <line x1="150" y1="0" x2="150" y2="140"/>
      </g>

      {/* Roads */}
      <path
        d="M 0 70 Q 60 60 100 75 T 200 70"
        stroke="rgba(22,163,74,0.35)"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 100 0 Q 110 50 95 80 T 105 140"
        stroke="rgba(22,163,74,0.28)"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 25 140 Q 50 100 80 90 T 130 60 T 175 25"
        stroke="rgba(22,163,74,0.25)"
        strokeWidth="1"
        fill="none"
        strokeDasharray="2 3"
      />

      {/* "Lake" representing Lake Eola */}
      <ellipse cx="98" cy="78" rx="6" ry="4" fill="rgba(59,130,246,0.4)"/>

      {/* Pin: Downtown Orlando */}
      <g>
        <circle cx="98" cy="68" r="10" fill="rgba(22,163,74,0.15)">
          <animate attributeName="r" values="6;14;6" dur="3s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.3;0;0.3" dur="3s" repeatCount="indefinite"/>
        </circle>
        <circle cx="98" cy="68" r="4" fill="#16A34A" stroke="#fff" strokeWidth="1.2"/>
      </g>

      {/* Other dots */}
      <circle cx="62" cy="48" r="2" fill="rgba(22,163,74,0.55)"/>
      <circle cx="142" cy="58" r="2" fill="rgba(22,163,74,0.55)"/>
      <circle cx="78" cy="98" r="2" fill="rgba(22,163,74,0.55)"/>
      <circle cx="135" cy="92" r="2" fill="rgba(22,163,74,0.55)"/>
      <circle cx="48" cy="92" r="1.5" fill="rgba(22,163,74,0.35)"/>
      <circle cx="160" cy="105" r="1.5" fill="rgba(22,163,74,0.35)"/>
    </svg>
  );
}

// ── Stat block ─────────────────────────────────────────────
function StatBlock({ value, label, sublabel, Icon, color }) {
  return (
    <div style={{
      flex: 1,
      background: T.surface ?? "#FFFFFF",
      border: `1px solid ${T.border}`,
      borderRadius: 16,
      padding: "16px 12px",
      textAlign: "center",
      position: "relative",
      overflow: "hidden",
      transition: "transform .2s, box-shadow .2s",
    }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = `0 8px 20px ${color}15`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "";
      }}
    >
      {/* Top accent line */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: color, opacity: 0.6,
      }}/>

      {Icon && (
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: `${color}15`,
          border: `1px solid ${color}25`,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 8px",
        }}>
          <Icon size={14} color={color} strokeWidth={2.4}/>
        </div>
      )}

      <div style={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 28, fontWeight: 800, color,
        lineHeight: 1, letterSpacing: "-1px",
        marginBottom: 4,
        fontVariantNumeric: "tabular-nums",
      }}>
        {value}
      </div>

      <div style={{
        fontSize: 11, fontWeight: 700, color: T.text,
        letterSpacing: "0.2px", marginBottom: 2,
      }}>
        {label}
      </div>

      {sublabel && (
        <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 500 }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}

// ── Value card ─────────────────────────────────────────────
function ValueCard({ icon: Icon, color, title, children, featured = false }) {
  return (
    <div
      style={{
        background: featured
          ? `linear-gradient(135deg, ${color}08, ${color}02)`
          : T.surface ?? '#FFFFFF',
        border: `1.5px solid ${featured ? `${color}30` : T.border}`,
        borderRadius: 18,
        padding: 20,
        display: "flex", flexDirection: "column", gap: 10,
        position: "relative",
        overflow: "hidden",
        transition: "all .25s",
        boxShadow: featured ? `0 4px 16px ${color}10` : `0 1px 3px rgba(0,0,0,0.02)`,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = `0 8px 24px ${color}18`;
        e.currentTarget.style.borderColor = `${color}50`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = featured ? `0 4px 16px ${color}10` : `0 1px 3px rgba(0,0,0,0.02)`;
        e.currentTarget.style.borderColor = featured ? `${color}30` : T.border;
      }}
    >
      {featured && (
        <div style={{
          position: "absolute", top: 12, right: 12,
          fontSize: 9, fontWeight: 800, color,
          background: `${color}15`,
          border: `1px solid ${color}30`,
          borderRadius: 100,
          padding: "2px 7px",
          letterSpacing: "0.08em", textTransform: "uppercase",
        }}>
          Core
        </div>
      )}

      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: featured
          ? `linear-gradient(135deg, ${color}, ${color}DD)`
          : `${color}15`,
        border: featured ? "none" : `1.5px solid ${color}30`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        boxShadow: featured ? `0 4px 12px ${color}40` : "none",
      }}>
        <Icon size={20} color={featured ? "#fff" : color} strokeWidth={2.2}/>
      </div>
      <div>
        <div style={{
          fontSize: 15, fontWeight: 800, color: T.text,
          marginBottom: 4, letterSpacing: "-0.2px",
        }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.65 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Audience card (Riders / Drivers) ──────────────────────
function AudienceCard({ title, tagline, color, icon: Icon, items, ctaLabel, ctaHref, accent }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${color}06, ${color}01)`,
      border: `1.5px solid ${color}25`,
      borderRadius: 22,
      padding: "24px 22px",
      position: "relative",
      overflow: "hidden",
      flex: 1,
    }}>
      {/* Decorative corner */}
      <div style={{
        position: "absolute", top: -40, right: -40,
        width: 140, height: 140, borderRadius: "50%",
        background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
        pointerEvents: "none",
      }}/>
      {/* Diagonal stripes */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `repeating-linear-gradient(45deg,transparent,transparent 60px,${color}05 60px,${color}05 61px)`,
        pointerEvents: "none",
      }}/>

      <div style={{ position: "relative" }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: `linear-gradient(135deg, ${color}, ${color}DD)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 14,
          boxShadow: `0 8px 20px ${color}40`,
        }}>
          <Icon size={22} color="#fff" strokeWidth={2.2}/>
        </div>

        <div style={{
          fontSize: 22, fontWeight: 900, color: T.text,
          letterSpacing: "-0.4px", lineHeight: 1.1, marginBottom: 6,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 13, color, fontWeight: 700, marginBottom: 18,
        }}>
          {tagline}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
          {items.map((item, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 9,
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: "50%",
                background: `${color}15`,
                border: `1px solid ${color}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, marginTop: 1,
              }}>
                <CheckCircle size={10} color={color} strokeWidth={2.6}/>
              </div>
              <span style={{
                fontSize: 13, color: T.text,
                fontWeight: 500, lineHeight: 1.55, flex: 1,
              }}>
                {item}
              </span>
            </div>
          ))}
        </div>

        {ctaLabel && (
          <a
            href={ctaHref}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 16px",
              background: `linear-gradient(135deg, ${color}, ${color}DD)`,
              color: "#fff",
              borderRadius: 100,
              fontSize: 13, fontWeight: 800,
              letterSpacing: "0.2px",
              textDecoration: "none",
              boxShadow: `0 6px 16px ${color}40`,
              transition: "all .15s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.filter = "brightness(1.08)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "";
              e.currentTarget.style.filter = "";
            }}
          >
            {ctaLabel}
            <ArrowRight size={14} strokeWidth={2.4}/>
          </a>
        )}
      </div>
    </div>
  );
}

// ── FAQ item ───────────────────────────────────────────────
function FAQItem({ q, a, color = ACCENT, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      background: open ? `${color}05` : T.surface ?? "#FFFFFF",
      border: `1px solid ${open ? `${color}30` : T.border}`,
      borderRadius: 14,
      marginBottom: 8,
      overflow: "hidden",
      transition: "all .2s",
    }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", background: "none", border: "none",
          cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          gap: 12, padding: "14px 16px",
          textAlign: "left",
          fontFamily: "inherit",
        }}
      >
        <span style={{
          fontSize: 13.5, fontWeight: 700, color: T.text,
          lineHeight: 1.4, flex: 1,
        }}>
          {q}
        </span>
        <div style={{
          width: 26, height: 26, borderRadius: "50%",
          background: open ? color : `${color}12`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          transition: "all .25s",
        }}>
          <ChevronDown
            size={14}
            color={open ? "#fff" : color}
            strokeWidth={2.6}
            style={{
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform .25s",
            }}
          />
        </div>
      </button>
      {open && (
        <div style={{
          padding: "0 16px 14px",
          borderTop: `1px solid ${color}15`,
          marginTop: -1,
        }}>
          <p style={{
            margin: "12px 0 0",
            fontSize: 13, color: T.textMuted,
            lineHeight: 1.7,
          }}>
            {a}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Contact card ───────────────────────────────────────────
function ContactCard({ Icon, color, label, value, href }) {
  const Component = href ? 'a' : 'div';
  return (
    <Component
      href={href || undefined}
      style={{
        background: T.surface ?? "#FFFFFF",
        border: `1.5px solid ${T.border}`,
        borderRadius: 14,
        padding: 14,
        display: "flex", gap: 12, alignItems: "center",
        textDecoration: "none",
        transition: "all .15s",
        cursor: href ? "pointer" : "default",
      }}
      onMouseEnter={e => {
        if (!href) return;
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = `0 4px 14px ${color}20`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = T.border;
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "";
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 11,
        background: `linear-gradient(135deg, ${color}18, ${color}08)`,
        border: `1px solid ${color}25`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <Icon size={16} color={color} strokeWidth={2.2}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10, fontWeight: 800, color: T.textMuted,
          letterSpacing: "0.08em", textTransform: "uppercase",
          marginBottom: 2,
        }}>
          {label}
        </div>
        <div style={{
          fontSize: 13.5, fontWeight: 800, color: href ? color : T.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {value}
        </div>
      </div>
      {href && <ChevronRight size={14} color={T.textMuted} strokeWidth={2.2}/>}
    </Component>
  );
}

// ── Main component ─────────────────────────────────────────
export default function AboutPage() {
  // Group FAQs by category
  const faqGroups = useMemo(() => [
    {
      label: "Riders",
      color: "#3B82F6",
      Icon: Users,
      items: [
        {
          q: "Is UaTob available outside of Orlando?",
          a: "Not yet. We're currently focused on building the best possible service in the Orlando, Florida area. We plan to expand to additional cities in the future, but only when we're confident the product is ready.",
          defaultOpen: true,
        },
        {
          q: "Does UaTob use surge pricing?",
          a: "Never. UaTob does not charge surge or dynamic pricing under any circumstances. Your fare is calculated from the same fixed rates regardless of time of day, weather, holidays, or demand. The price you see at booking is the price you pay.",
        },
        {
          q: "What is the booking fee?",
          a: "The booking fee is a small fixed charge per ride that covers platform operations including payment processing, app infrastructure, and driver support. It ranges from $0.99 to $1.99 depending on the ride tier and is always shown clearly before you confirm a booking.",
        },
        {
          q: "What vehicle types does UaTob support?",
          a: "UaTob supports Economy (standard 4-door), Standard (newer, well-maintained 4-door), Premium (luxury vehicles), and XL (SUVs and vans seating up to 6). Vehicle requirements for each tier are listed during driver onboarding.",
        },
      ],
    },
    {
      label: "Drivers",
      color: ACCENT,
      Icon: Car,
      items: [
        {
          q: "How do drivers get paid?",
          a: "Drivers are paid through Stripe Connect directly to their linked bank account. Payouts are processed by UaTob after each completed ride. Drivers receive 75% of every fare with no weekly fees or hidden deductions.",
        },
        {
          q: "How do I become a UaTob driver?",
          a: "Visit uatob.com/driver/signup to start your application. You'll need a valid Florida driver's license, proof of insurance, and a vehicle that meets our standards. After submitting your application, our team will review it and reach out within a few business days.",
        },
      ],
    },
    {
      label: "Safety & Trust",
      color: "#7C3AED",
      Icon: Shield,
      items: [
        {
          q: "How do I report a safety concern?",
          a: "You can report safety issues directly through the app after your ride, or by emailing support@uatob.com. For emergencies, always call 911 first. UaTob reviews all safety reports and takes appropriate action.",
        },
      ],
    },
  ], []);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 4px', fontFamily: 'inherit' }}>
      <style>{`
        @keyframes apFadeUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes apShimmer { 0%,100% { opacity: .6 } 50% { opacity: 1 } }
      `}</style>

      {/* ── Hero ── */}
      <div style={{
        position: "relative",
        background: "linear-gradient(135deg,#F0FDF4 0%,#DCFCE7 50%,#F0FDF4 100%)",
        border: `1.5px solid rgba(22,163,74,.25)`,
        borderRadius: 24,
        padding: "32px 28px 36px",
        marginTop: 16,
        marginBottom: 22,
        overflow: "hidden",
        boxShadow: "0 12px 32px rgba(22,163,74,.10)",
      }}>
        <OrlandoMap/>

        <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(22,163,74,.25)",
            borderRadius: 100, padding: "5px 12px",
            marginBottom: 18,
            boxShadow: "0 4px 12px rgba(22,163,74,.12)",
          }}>
            <MapPin size={11} color={ACCENT} strokeWidth={2.6}/>
            <span style={{
              fontSize: 10.5, fontWeight: 800, color: ACCENT,
              letterSpacing: "1px", textTransform: "uppercase",
            }}>
              Orlando, Florida
            </span>
            <span style={{
              width: 4, height: 4, borderRadius: "50%",
              background: "#22C55E",
              animation: "apShimmer 2s ease-in-out infinite",
            }}/>
          </div>

          <h1 style={{
            margin: 0, fontSize: 38, fontWeight: 900, color: T.text,
            letterSpacing: "-1px", lineHeight: 1.1, marginBottom: 14,
          }}>
            Rides Built for<br/>
            <span style={{
              background: "linear-gradient(135deg, #22C55E, #16A34A 60%, #15803D)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              Real People
            </span>
          </h1>

          <p style={{
            margin: '0 auto 20px', fontSize: 14.5, color: T.textMuted,
            lineHeight: 1.65, maxWidth: 460,
          }}>
            UaTob is an Orlando-based ride-sharing platform built from the ground up to give riders honest fares and drivers a fair cut — no surge pricing, no corporate middlemen, no nonsense.
          </p>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: T.surface ?? "#FFFFFF",
            border: `1px solid ${T.border}`,
            borderRadius: 100,
            padding: "6px 6px 6px 14px",
            fontSize: 12, fontWeight: 700, color: T.text,
            boxShadow: "0 4px 14px rgba(0,0,0,.06)",
          }}>
            <Sparkles size={12} color="#F59E0B" fill="#F59E0B" strokeWidth={0}/>
            <span>Built local, by Orlandoans, for Orlando</span>
            <span style={{
              width: 24, height: 24, borderRadius: "50%",
              background: ACCENT,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 6px rgba(22,163,74,.4)",
            }}>
              <Heart size={11} color="#fff" fill="#fff" strokeWidth={2}/>
            </span>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{
        display: "flex", gap: 8, marginBottom: 36,
      }}>
        <StatBlock
          value="75%"
          label="Driver share"
          sublabel="of every fare"
          Icon={DollarSign}
          color={ACCENT}
        />
        <StatBlock
          value="$0"
          label="Surge fees"
          sublabel="ever"
          Icon={Lock}
          color={T.text}
        />
        <StatBlock
          value="2–7"
          label="Min. wait"
          sublabel="for Standard"
          Icon={Clock}
          color="#3B82F6"
        />
      </div>

      {/* ── Mission card ── */}
      <div style={{
        background: T.surface ?? "#FFFFFF",
        border: `1px solid ${T.border}`,
        borderRadius: 22,
        padding: "26px 24px",
        marginBottom: 36,
        position: "relative",
        overflow: "hidden",
        boxShadow: `0 1px 3px rgba(0,0,0,.02)`,
      }}>
        {/* Subtle quote mark */}
        <div style={{
          position: "absolute", top: 8, left: 16,
          fontSize: 96, fontWeight: 900, color: ACCENT,
          opacity: 0.06, lineHeight: 1, fontFamily: "Georgia, serif",
          pointerEvents: "none",
        }}>
          "
        </div>

        <div style={{ position: "relative" }}>
          <SectionLabel>Our Mission</SectionLabel>
          <Heading size="24px">Why we built UaTob</Heading>
          <Body>
            UaTob started with a simple observation: ride-sharing had drifted away from the people it was supposed to serve. Drivers were getting squeezed with smaller and smaller cuts. Riders were hit with unpredictable surge pricing. And both groups were locked into platforms that treated them as numbers.
          </Body>
          <Body>
            We set out to fix that — starting right here in Orlando. UaTob is built on a straightforward promise: <strong style={{ color: T.text }}>drivers keep 75% of every fare, riders always pay the same fixed rate, and everyone knows exactly what to expect before they ever tap "Book."</strong>
          </Body>
          <Body>
            We're a local team. We drive these roads. We know this city. And we believe the best ride-sharing platform is one that puts the community first.
          </Body>
        </div>
      </div>

      {/* ── Values ── */}
      <div style={{ marginBottom: 36 }}>
        <SectionLabel>What We Stand For</SectionLabel>
        <Heading>Our values</Heading>
        <Body>The principles that guide every product decision we make.</Body>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
          marginTop: 20,
        }}>
          <ValueCard icon={Shield} color={ACCENT} title="Transparent Pricing" featured>
            No surge pricing. No hidden fees. Your fare is calculated from four fixed components — base fare, distance, time, and a booking fee. Period.
          </ValueCard>
          <ValueCard icon={Heart} color="#EF4444" title="Driver First" featured>
            Drivers keep 75% of every ride. We believe the people doing the work deserve the majority of what riders pay. No weekly fees. No surprise deductions.
          </ValueCard>
          <ValueCard icon={MapPin} color="#3B82F6" title="Local Focus">
            We started in Orlando and we're growing carefully — block by block, neighborhood by neighborhood. We'd rather serve our community well than scale too fast.
          </ValueCard>
          <ValueCard icon={Zap} color="#F59E0B" title="Built for Speed">
            Standard rides arrive in 2–7 minutes. Our dispatch system matches drivers in real time so you're never waiting around wondering where your ride is.
          </ValueCard>
          <ValueCard icon={Users} color="#7C3AED" title="Every Group">
            Whether it's just you or a group of six, we have a tier for it. Economy, Standard, Premium, and XL — all priced fairly, all on the same platform.
          </ValueCard>
          <ValueCard icon={Star} color="#D97706" title="Trust & Safety">
            Every driver goes through a background check and vehicle inspection before their first ride. Ratings keep everyone accountable on both sides.
          </ValueCard>
        </div>
      </div>

      <Divider/>

      {/* ── Riders & Drivers (side-by-side) ── */}
      <div style={{ marginBottom: 36 }}>
        <SectionLabel>Two sides, one platform</SectionLabel>
        <Heading>Built for everyone in the ride</Heading>
        <Body>
          UaTob is designed to work fairly for both riders and drivers — because a good rideshare platform needs both to thrive.
        </Body>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 14, marginTop: 22,
        }}>
          <AudienceCard
            title="For Riders"
            tagline="Honest fares, fast pickups"
            color="#3B82F6"
            icon={Users}
            items={[
              "Fixed fare shown before you book",
              "Real-time GPS tracking from pickup to drop-off",
              "In-app messaging with your driver",
              "Ride history & digital receipts",
              "Four tiers: Economy, Standard, Premium, XL",
            ]}
          />
          <AudienceCard
            title="For Drivers"
            tagline="75% take-home, no fees"
            color={ACCENT}
            icon={Car}
            items={[
              "75% of every fare — highest split in the market",
              "Flexible schedule, online whenever",
              "Real-time earnings dashboard",
              "Stripe payouts to your bank",
              "Dedicated support & no quotas",
            ]}
            ctaLabel="Apply to drive"
            ctaHref="/driver/signup"
          />
        </div>
      </div>

      <Divider/>

      {/* ── FAQ ── */}
      <div style={{ marginBottom: 36 }}>
        <SectionLabel>Common Questions</SectionLabel>
        <Heading>Frequently asked</Heading>
        <Body>Everything you need to know, organized by topic.</Body>

        {faqGroups.map((group, i) => {
          const Icon = group.Icon;
          return (
            <div key={group.label} style={{ marginTop: i === 0 ? 22 : 28 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                marginBottom: 12,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: `${group.color}15`,
                  border: `1px solid ${group.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={14} color={group.color} strokeWidth={2.4}/>
                </div>
                <span style={{
                  fontSize: 13, fontWeight: 800, color: group.color,
                  letterSpacing: "0.5px", textTransform: "uppercase",
                }}>
                  {group.label}
                </span>
                <div style={{
                  flex: 1, height: 1, background: T.border, marginLeft: 4,
                }}/>
                <span style={{
                  fontSize: 11, color: T.textMuted, fontWeight: 700,
                }}>
                  {group.items.length}
                </span>
              </div>
              {group.items.map((item, j) => (
                <FAQItem
                  key={j}
                  q={item.q}
                  a={item.a}
                  color={group.color}
                  defaultOpen={item.defaultOpen}
                />
              ))}
            </div>
          );
        })}

        {/* Still have questions? */}
        <div style={{
          marginTop: 24,
          background: `${ACCENT}06`,
          border: `1.5px solid ${ACCENT}25`,
          borderRadius: 16,
          padding: "16px 18px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11,
            background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}DD)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            boxShadow: `0 4px 12px ${ACCENT}40`,
          }}>
            <MessageCircle size={16} color="#fff" strokeWidth={2.2}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: T.text, marginBottom: 2 }}>
              Still have questions?
            </div>
            <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>
              Drop us a line at <a href="mailto:support@uatob.com" style={{ color: ACCENT, fontWeight: 700, textDecoration: "none" }}>support@uatob.com</a> — we read every email.
            </div>
          </div>
        </div>
      </div>

      <Divider/>

      {/* ── Contact ── */}
      <div style={{ marginBottom: 16 }}>
        <SectionLabel>Get in Touch</SectionLabel>
        <Heading>Contact UaTob</Heading>
        <Body>
          Have a question, concern, or just want to say hello? We're a small local team and we actually read our emails.
        </Body>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 10, marginTop: 18,
        }}>
          <ContactCard
            Icon={Mail} color={ACCENT}
            label="General & Support"
            value="support@uatob.com"
            href="mailto:support@uatob.com"
          />
          <ContactCard
            Icon={Lock} color="#7C3AED"
            label="Legal & Privacy"
            value="legal@uatob.com"
            href="mailto:legal@uatob.com"
          />
          <ContactCard
            Icon={MapPin} color="#3B82F6"
            label="Service Area"
            value="Orlando, Florida"
          />
          <ContactCard
            Icon={Globe} color="#F59E0B"
            label="Website"
            value="uatob.com"
            href="https://uatob.com"
          />
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        background: T.surface ?? "#FFFFFF",
        border: `1px solid ${T.border}`,
        borderRadius: 18,
        padding: "20px 22px",
        marginTop: 28, marginBottom: 32,
        textAlign: "center",
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          marginBottom: 10,
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6,
            background: `linear-gradient(135deg, #22C55E, #16A34A)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 6px rgba(22,163,74,.4)",
          }}>
            <Car size={12} color="#fff" strokeWidth={2.4}/>
          </div>
          <span style={{
            fontSize: 14, fontWeight: 900, color: T.text,
            letterSpacing: "-0.3px",
          }}>
            UaTob
          </span>
        </div>

        <div style={{
          fontSize: 11.5, color: T.textMuted, lineHeight: 1.7,
          marginBottom: 8,
        }}>
          Built with <Heart size={11} color="#EF4444" fill="#EF4444" strokeWidth={0} style={{ display: "inline", verticalAlign: "middle", margin: "0 2px" }}/> in Orlando, Florida
        </div>

        <div style={{
          fontSize: 10.5, color: T.textMuted, lineHeight: 1.7,
          letterSpacing: "0.3px",
        }}>
          © {new Date().getFullYear()} UaTob LLC ·{" "}
          <a href="/driver-terms" style={{ color: T.textMuted, textDecoration: "none", borderBottom: `1px dotted ${T.textMuted}` }}>Terms</a>
          {" "}·{" "}
          <a href="/privacy-policy" style={{ color: T.textMuted, textDecoration: "none", borderBottom: `1px dotted ${T.textMuted}` }}>Privacy</a>
          {" "}·{" "}
          uatob.com
        </div>
      </div>
    </div>
  );
}
