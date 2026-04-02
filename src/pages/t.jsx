import React from 'react';
import {
  CarFront,
  Clock3,
  DollarSign,
  ShieldCheck,
  BadgeCheck,
  ChevronRight,
  Star,
  MapPin,
  Users,
} from 'lucide-react';

const T = {
  accent: '#16A34A',
  accentDark: '#15803D',
  accentBorder: '#86EFAC',
  text: '#111827',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  surfaceAlt: '#F9FAFB',
  white: '#FFFFFF',
};

function BenefitCard({ icon: Icon, title, text }) {
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${T.border}`,
        borderRadius: '18px',
        padding: '18px',
        boxShadow: '0 8px 24px rgba(0,0,0,.04)',
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '14px',
          background: '#ECFDF5',
          border: `1px solid ${T.accentBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '14px',
        }}
      >
        <Icon size={20} color={T.accent} />
      </div>

      <div
        style={{
          fontSize: '15px',
          fontWeight: 800,
          color: T.text,
          marginBottom: '6px',
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: '13px',
          color: T.textMuted,
          lineHeight: 1.6,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function RequirementRow({ icon: Icon, text }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 0',
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <div
        style={{
          width: '38px',
          height: '38px',
          minWidth: '38px',
          borderRadius: '12px',
          background: '#F0FDF4',
          border: `1px solid ${T.accentBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={17} color={T.accent} />
      </div>

      <span
        style={{
          fontSize: '14px',
          fontWeight: 700,
          color: T.text,
        }}
      >
        {text}
      </span>
    </div>
  );
}

export default function DriverSignupLanding({ onStartApplication }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #F0FDF4 0%, #FFFFFF 30%, #FFFFFF 100%)',
        padding: '24px 18px 40px',
        fontFamily: '"Outfit", system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: '540px', margin: '0 auto' }}>
        {/* HERO */}
        <div
          style={{
            background: 'linear-gradient(135deg,#16A34A 0%,#15803D 100%)',
            borderRadius: '28px',
            padding: '28px 24px',
            color: '#fff',
            boxShadow: '0 18px 50px rgba(22,163,74,.22)',
            marginBottom: '20px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              right: '-30px',
              top: '-30px',
              width: '140px',
              height: '140px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,.08)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '-20px',
              bottom: '-30px',
              width: '100px',
              height: '100px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,.06)',
            }}
          />

          <div
            style={{
              width: '58px',
              height: '58px',
              borderRadius: '18px',
              background: 'rgba(255,255,255,.14)',
              border: '1px solid rgba(255,255,255,.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '18px',
              backdropFilter: 'blur(10px)',
            }}
          >
            <CarFront size={28} color="#fff" />
          </div>

          <div
            style={{
              fontSize: '31px',
              fontWeight: 900,
              letterSpacing: '-1px',
              lineHeight: 1.05,
              marginBottom: '12px',
            }}
          >
            Drive with UaTob
          </div>

          <div
            style={{
              fontSize: '15px',
              lineHeight: 1.7,
              color: 'rgba(255,255,255,.92)',
              maxWidth: '420px',
              marginBottom: '20px',
            }}
          >
            Earn money on your schedule, accept rides in your area, and grow with a platform built for local drivers.
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div
              style={{
                background: 'rgba(255,255,255,.12)',
                border: '1px solid rgba(255,255,255,.18)',
                borderRadius: '999px',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <DollarSign size={13} />
              Keep more of your earnings
            </div>

            <div
              style={{
                background: 'rgba(255,255,255,.12)',
                border: '1px solid rgba(255,255,255,.18)',
                borderRadius: '999px',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Clock3 size={13} />
              Drive anytime
            </div>
          </div>
        </div>

        {/* BENEFITS */}
        <div style={{ marginBottom: '22px' }}>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 900,
              color: T.text,
              letterSpacing: '-0.5px',
              marginBottom: '14px',
            }}
          >
            Why drive with us?
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '12px',
            }}
          >
            <BenefitCard
              icon={DollarSign}
              title="Earn on your own time"
              text="Drive mornings, nights, weekends, or whenever it fits your schedule."
            />
            <BenefitCard
              icon={MapPin}
              title="Local rides near you"
              text="Accept trips in your city and stay active where demand is highest."
            />
            <BenefitCard
              icon={ShieldCheck}
              title="Built for trusted drivers"
              text="We’re focused on safe rides, real support, and quality service."
            />
          </div>
        </div>

        {/* REQUIREMENTS */}
        <div
          style={{
            background: '#fff',
            border: `1px solid ${T.border}`,
            borderRadius: '24px',
            padding: '22px 20px',
            boxShadow: '0 8px 24px rgba(0,0,0,.04)',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              fontSize: '20px',
              fontWeight: 900,
              color: T.text,
              letterSpacing: '-0.5px',
              marginBottom: '8px',
            }}
          >
            Driver requirements
          </div>

          <div
            style={{
              fontSize: '13px',
              color: T.textMuted,
              lineHeight: 1.65,
              marginBottom: '10px',
            }}
          >
            Before you apply, make sure you have the basics ready.
          </div>

          <RequirementRow icon={BadgeCheck} text="Valid driver’s license" />
          <RequirementRow icon={CarFront} text="Eligible 4-door vehicle" />
          <RequirementRow icon={ShieldCheck} text="Vehicle insurance" />
          <RequirementRow icon={Users} text="Professional and rider-friendly attitude" />
          <RequirementRow icon={Star} text="Clean, safe driving standards" />
        </div>

        {/* EARNINGS CARD */}
        <div
          style={{
            background: 'linear-gradient(135deg,#F9FAFB 0%,#F0FDF4 100%)',
            border: `1px solid ${T.border}`,
            borderRadius: '24px',
            padding: '22px 20px',
            marginBottom: '22px',
          }}
        >
          <div
            style={{
              fontSize: '19px',
              fontWeight: 900,
              color: T.text,
              letterSpacing: '-0.4px',
              marginBottom: '8px',
            }}
          >
            Start earning faster
          </div>

          <div
            style={{
              fontSize: '13.5px',
              color: T.textMuted,
              lineHeight: 1.7,
              marginBottom: '14px',
            }}
          >
            Complete your driver profile, upload your documents, and get ready to go online once approved.
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            {['Quick application', 'Flexible schedule', 'Local demand'].map((item) => (
              <div
                key={item}
                style={{
                  background: '#fff',
                  border: `1px solid ${T.border}`,
                  borderRadius: '999px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 800,
                  color: T.text,
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => typeof onStartApplication === 'function' && onStartApplication()}
          style={{
            width: '100%',
            border: 'none',
            borderRadius: '18px',
            padding: '17px 18px',
            background: 'linear-gradient(135deg,#16A34A,#15803D)',
            color: '#fff',
            fontSize: '16px',
            fontWeight: 900,
            cursor: 'pointer',
            boxShadow: '0 14px 34px rgba(22,163,74,.24)',
            fontFamily: '"Outfit", system-ui, sans-serif',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          Start Application
          <ChevronRight size={18} />
        </button>

        <div
          style={{
            textAlign: 'center',
            fontSize: '12px',
            color: T.textMuted,
            marginTop: '14px',
            lineHeight: 1.6,
          }}
        >
          By continuing, you’ll begin the UaTob driver onboarding process.
        </div>
      </div>
    </div>
  );
}