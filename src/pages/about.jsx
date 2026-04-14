// src/App/UaTob/AboutPage.jsx
import React, { useState } from 'react';
import { MapPin, Shield, Users, Zap, Heart, Star, ArrowRight, Phone, Mail } from 'lucide-react';
import { THEME as T } from '@/App/UaTob/pricing.js';

// ── Helpers ────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p
      style={{
        fontSize:      '11px',
        fontWeight:    700,
        color:         '#16A34A',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        margin:        '0 0 10px',
      }}
    >
      {children}
    </p>
  );
}

function Heading({ children, center = false, size = '26px' }) {
  return (
    <h2
      style={{
        margin:        '0 0 10px',
        fontSize:      size,
        fontWeight:    900,
        color:         T.text,
        letterSpacing: '-0.5px',
        lineHeight:    1.2,
        textAlign:     center ? 'center' : 'left',
      }}
    >
      {children}
    </h2>
  );
}

function Body({ children, center = false }) {
  return (
    <p
      style={{
        margin:     '0 0 10px',
        fontSize:   '13px',
        color:      T.textMuted,
        lineHeight: 1.75,
        textAlign:  center ? 'center' : 'left',
      }}
    >
      {children}
    </p>
  );
}

function Divider() {
  return (
    <div
      style={{
        height:     '1.5px',
        background: `linear-gradient(90deg, transparent, ${T.border}, transparent)`,
        margin:     '36px 0',
      }}
    />
  );
}

// ── Value card ─────────────────────────────────────────────
function ValueCard({ icon: Icon, color, title, children }) {
  return (
    <div
      style={{
        background:   T.surfaceAlt ?? '#F9FAFB',
        border:       `1.5px solid ${T.border}`,
        borderRadius: '16px',
        padding:      '20px',
        display:      'flex',
        flexDirection:'column',
        gap:          '10px',
      }}
    >
      <div
        style={{
          width:          '40px',
          height:         '40px',
          borderRadius:   '12px',
          background:     `${color}15`,
          border:         `1.5px solid ${color}30`,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          flexShrink:     0,
        }}
      >
        <Icon size={18} color={color} />
      </div>
      <div>
        <div style={{ fontSize: '14px', fontWeight: 800, color: T.text, marginBottom: '4px' }}>
          {title}
        </div>
        <div style={{ fontSize: '13px', color: T.textMuted, lineHeight: 1.65 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Stat block ─────────────────────────────────────────────
function StatBlock({ value, label, color = '#16A34A' }) {
  return (
    <div style={{ textAlign: 'center', padding: '4px' }}>
      <div
        style={{
          fontFamily:    '"JetBrains Mono", monospace',
          fontSize:      '36px',
          fontWeight:    800,
          color,
          lineHeight:    1,
          letterSpacing: '-1.5px',
          marginBottom:  '6px',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: '12px', fontWeight: 600, color: T.textMuted, letterSpacing: '0.3px' }}>
        {label}
      </div>
    </div>
  );
}

// ── FAQ item ───────────────────────────────────────────────
function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        borderBottom: `1px solid ${T.border}`,
        padding:      '14px 0',
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width:          '100%',
          background:     'none',
          border:         'none',
          cursor:         'pointer',
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
          gap:            '12px',
          padding:        0,
          textAlign:      'left',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 700, color: T.text, lineHeight: 1.4 }}>
          {q}
        </span>
        <span
          style={{
            fontSize:   '18px',
            color:      '#16A34A',
            flexShrink: 0,
            transition: 'transform .2s',
            transform:  open ? 'rotate(45deg)' : 'rotate(0deg)',
            lineHeight: 1,
          }}
        >
          +
        </span>
      </button>
      {open && (
        <p
          style={{
            margin:     '10px 0 0',
            fontSize:   '13px',
            color:      T.textMuted,
            lineHeight: 1.7,
          }}
        >
          {a}
        </p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────
export default function AboutPage() {
  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 4px', fontFamily: 'inherit' }}>

      {/* ── Hero ── */}
      <div
        style={{
          textAlign:    'center',
          padding:      '40px 0 32px',
          borderBottom: `1.5px solid ${T.border}`,
        }}
      >
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
            marginBottom:  '16px',
          }}
        >
          ORLANDO, FLORIDA
        </div>
        <h1
          style={{
            margin:        0,
            fontSize:      '34px',
            fontWeight:    900,
            color:         T.text,
            letterSpacing: '-0.8px',
            lineHeight:    1.15,
            marginBottom:  '14px',
          }}
        >
          Rides Built for
          <br />
          <span style={{ color: '#16A34A' }}>Real People</span>
        </h1>
        <p
          style={{
            margin:      '0 auto',
            fontSize:    '14px',
            color:       T.textMuted,
            lineHeight:  1.75,
            maxWidth:    '480px',
          }}
        >
          UaTob is an Orlando-based ride-sharing platform built from the ground up to give
          riders honest fares and drivers a fair cut — no surge pricing, no corporate
          middlemen, no nonsense.
        </p>
      </div>

      {/* ── Stats ── */}
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap:                 '4px',
          padding:             '28px 0',
          borderBottom:        `1.5px solid ${T.border}`,
        }}
      >
        <StatBlock value="75%"       label="Goes to the driver"     color="#16A34A" />
        <StatBlock value="$0"        label="Surge pricing"          color={T.text}  />
        <StatBlock value="Orlando"   label="Home base"              color="#16A34A" />
      </div>

      {/* ── Our story ── */}
      <div style={{ padding: '36px 0 0' }}>
        <SectionLabel>Our Story</SectionLabel>
        <Heading>Why we built UaTob</Heading>
        <Body>
          UaTob started with a simple observation: ride-sharing had drifted away from the people
          it was supposed to serve. Drivers were getting squeezed with smaller and smaller cuts.
          Riders were hit with unpredictable surge pricing. And both groups were locked into
          platforms that treated them as numbers.
        </Body>
        <Body>
          We set out to fix that — starting right here in Orlando. UaTob is built on a
          straightforward promise: drivers keep 75% of every fare, riders always pay the same
          fixed rate, and everyone knows exactly what to expect before they ever tap "Book."
        </Body>
        <Body>
          We're a local team. We drive these roads. We know this city. And we believe the best
          ride-sharing platform is one that puts the community first.
        </Body>
      </div>

      <Divider />

      {/* ── Values ── */}
      <div>
        <SectionLabel>What We Stand For</SectionLabel>
        <Heading>Our values</Heading>
        <div
          style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap:                 '14px',
            marginTop:           '20px',
          }}
        >
          <ValueCard icon={Shield} color="#16A34A" title="Transparent Pricing">
            No surge pricing. No hidden fees. Your fare is calculated from four fixed
            components — base fare, distance, time, and a booking fee. Period.
          </ValueCard>
          <ValueCard icon={Heart} color="#EF4444" title="Driver First">
            Drivers keep 75% of every ride. We believe the people doing the work deserve
            the majority of what riders pay. No weekly fees. No surprise deductions.
          </ValueCard>
          <ValueCard icon={MapPin} color="#3B82F6" title="Local Focus">
            We started in Orlando and we're growing carefully — block by block, neighborhood
            by neighborhood. We'd rather serve our community well than scale too fast.
          </ValueCard>
          <ValueCard icon={Zap} color="#F59E0B" title="Built for Speed">
            Standard rides arrive in 2–7 minutes. Our dispatch system matches drivers in
            real time so you're never waiting around wondering where your ride is.
          </ValueCard>
          <ValueCard icon={Users} color="#7C3AED" title="Every Group">
            Whether it's just you or a group of six, we have a tier for it. Economy,
            Standard, Premium, and XL — all priced fairly, all on the same platform.
          </ValueCard>
          <ValueCard icon={Star} color="#F59E0B" title="Trust & Safety">
            Every driver goes through a background check and vehicle inspection before
            their first ride. Ratings keep everyone accountable on both sides.
          </ValueCard>
        </div>
      </div>

      <Divider />

      {/* ── For riders ── */}
      <div>
        <SectionLabel>For Riders</SectionLabel>
        <Heading>Getting around Orlando, simplified</Heading>
        <Body>
          Book a ride in seconds, track your driver in real time, and pay a fare you knew
          before you booked. UaTob works across Orlando — from downtown to the suburbs —
          with four ride tiers to match any trip and any budget.
        </Body>
        <div
          style={{
            background:   '#16A34A08',
            border:       '1.5px solid #16A34A25',
            borderRadius: '14px',
            padding:      '16px 18px',
            marginTop:    '16px',
          }}
        >
          {[
            'Fixed fare shown before you book — no surprises',
            'Real-time GPS tracking from driver assignment to drop-off',
            'In-app messaging to coordinate with your driver',
            'Ride history and digital receipts',
            'Four tiers: Economy, Standard, Premium, and XL',
          ].map((item, i) => (
            <div
              key={i}
              style={{
                display:      'flex',
                alignItems:   'flex-start',
                gap:          '10px',
                padding:      '6px 0',
                borderBottom: i < 4 ? `1px solid #16A34A15` : 'none',
              }}
            >
              <span style={{ color: '#16A34A', fontWeight: 800, flexShrink: 0, marginTop: '1px' }}>✓</span>
              <span style={{ fontSize: '13px', color: T.textMuted, lineHeight: 1.55 }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <Divider />

      {/* ── For drivers ── */}
      <div>
        <SectionLabel>For Drivers</SectionLabel>
        <Heading>Drive on your terms</Heading>
        <Body>
          UaTob was built with drivers in mind from day one. You set your own schedule, work
          when you want, and take home 75 cents of every dollar a rider pays. No medallions,
          no weekly fees, no quota requirements.
        </Body>
        <div
          style={{
            background:   T.surfaceAlt ?? '#F9FAFB',
            border:       `1.5px solid ${T.border}`,
            borderRadius: '14px',
            padding:      '16px 18px',
            marginTop:    '16px',
          }}
        >
          {[
            '75% of every fare — the highest split in the market',
            'Flexible schedule — go online and offline whenever you want',
            'Real-time earnings dashboard with trip and payout history',
            'Stripe-powered payouts directly to your bank account',
            'In-app trip requests with audio chime and accept/decline',
            'Dedicated driver support at support@uatob.com',
          ].map((item, i) => (
            <div
              key={i}
              style={{
                display:      'flex',
                alignItems:   'flex-start',
                gap:          '10px',
                padding:      '6px 0',
                borderBottom: i < 5 ? `1px solid ${T.border}` : 'none',
              }}
            >
              <span
                style={{
                  color:      '#16A34A',
                  fontWeight: 800,
                  flexShrink: 0,
                  marginTop:  '1px',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize:   '11px',
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontSize: '13px', color: T.textMuted, lineHeight: 1.55 }}>{item}</span>
            </div>
          ))}
        </div>

        {/* Driver CTA */}
        <div
          style={{
            marginTop:    '16px',
            display:      'flex',
            alignItems:   'center',
            gap:          '8px',
            fontSize:     '13px',
            color:        T.textMuted,
          }}
        >
          <ArrowRight size={14} color="#16A34A" />
          <span>
            Ready to drive?{' '}
            <a
              href="/driver/signup"
              style={{ color: '#16A34A', fontWeight: 700, textDecoration: 'none' }}
            >
              Apply to become a UaTob driver →
            </a>
          </span>
        </div>
      </div>

      <Divider />

      {/* ── FAQ ── */}
      <div>
        <SectionLabel>Common Questions</SectionLabel>
        <Heading>FAQ</Heading>
        <div style={{ marginTop: '16px' }}>
          {[
            {
              q: 'Is UaTob available outside of Orlando?',
              a: 'Not yet. We\'re currently focused on building the best possible service in the Orlando, Florida area. We plan to expand to additional cities in the future, but only when we\'re confident the product is ready.',
            },
            {
              q: 'Does UaTob use surge pricing?',
              a: 'Never. UaTob does not charge surge or dynamic pricing under any circumstances. Your fare is calculated from the same fixed rates regardless of time of day, weather, holidays, or demand. The price you see at booking is the price you pay.',
            },
            {
              q: 'How do drivers get paid?',
              a: 'Drivers are paid through Stripe Connect directly to their linked bank account. Payouts are processed by UaTob after each completed ride. Drivers receive 75% of every fare with no weekly fees or hidden deductions.',
            },
            {
              q: 'How do I become a UaTob driver?',
              a: 'Visit uatob.com/driver/signup to start your application. You\'ll need a valid Florida driver\'s license, proof of insurance, and a vehicle that meets our standards. After submitting your application, our team will review it and reach out within a few business days.',
            },
            {
              q: 'What vehicle types does UaTob support?',
              a: 'UaTob supports Economy (standard 4-door), Standard (newer, well-maintained 4-door), Premium (luxury vehicles), and XL (SUVs and vans seating up to 6). Vehicle requirements for each tier are listed during driver onboarding.',
            },
            {
              q: 'How do I report a safety concern?',
              a: 'You can report safety issues directly through the app after your ride, or by emailing support@uatob.com. For emergencies, always call 911 first. UaTob reviews all safety reports and takes appropriate action.',
            },
            {
              q: 'What is the booking fee?',
              a: 'The booking fee is a small fixed charge per ride that covers platform operations including payment processing, app infrastructure, and driver support. It ranges from $0.99 to $1.99 depending on the ride tier and is always shown clearly before you confirm a booking.',
            },
          ].map((item, i) => (
            <FAQItem key={i} q={item.q} a={item.a} />
          ))}
        </div>
      </div>

      <Divider />

      {/* ── Contact ── */}
      <div style={{ marginBottom: '16px' }}>
        <SectionLabel>Get in Touch</SectionLabel>
        <Heading>Contact UaTob</Heading>
        <Body>
          Have a question, concern, or just want to say hello? We're a small local team and we
          actually read our emails.
        </Body>
        <div
          style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap:                 '12px',
            marginTop:           '16px',
          }}
        >
          {[
            {
              icon:  Mail,
              color: '#16A34A',
              label: 'General & Support',
              value: 'support@uatob.com',
              href:  'mailto:support@uatob.com',
            },
            {
              icon:  Mail,
              color: '#7C3AED',
              label: 'Legal & Privacy',
              value: 'legal@uatob.com',
              href:  'mailto:legal@uatob.com',
            },
            {
              icon:  MapPin,
              color: '#3B82F6',
              label: 'Service Area',
              value: 'Orlando, Florida',
              href:  null,
            },
            {
              icon:  Phone,
              color: '#F59E0B',
              label: 'Website',
              value: 'uatob.com',
              href:  'https://uatob.com',
            },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={i}
                style={{
                  background:   T.surfaceAlt ?? '#F9FAFB',
                  border:       `1.5px solid ${T.border}`,
                  borderRadius: '14px',
                  padding:      '16px',
                  display:      'flex',
                  gap:          '12px',
                  alignItems:   'flex-start',
                }}
              >
                <div
                  style={{
                    width:          '36px',
                    height:         '36px',
                    borderRadius:   '10px',
                    background:     `${item.color}15`,
                    border:         `1.5px solid ${item.color}30`,
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    flexShrink:     0,
                  }}
                >
                  <Icon size={15} color={item.color} />
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: T.textMuted, marginBottom: '3px', letterSpacing: '0.3px' }}>
                    {item.label}
                  </div>
                  {item.href ? (
                    <a
                      href={item.href}
                      style={{ fontSize: '13px', fontWeight: 700, color: item.color, textDecoration: 'none' }}
                    >
                      {item.value}
                    </a>
                  ) : (
                    <div style={{ fontSize: '13px', fontWeight: 700, color: T.text }}>
                      {item.value}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          borderTop:     `1px solid ${T.border}`,
          marginTop:     '28px',
          paddingTop:    '16px',
          paddingBottom: '32px',
          textAlign:     'center',
          fontSize:      '11px',
          color:         T.textMuted,
          lineHeight:    1.7,
        }}
      >
        © {new Date().getFullYear()} UaTob LLC · Orlando, Florida · uatob.com
      </div>

    </div>
  );
}