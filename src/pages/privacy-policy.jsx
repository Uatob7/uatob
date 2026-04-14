// src/App/UaTob/PrivacyPolicy.jsx
import React from 'react';
import { THEME as T } from '@/App/UaTob/pricing.js';

const EFFECTIVE_DATE = 'April 13, 2026';

// ── Typography helpers ─────────────────────────────────────
function SectionTitle({ number, children }) {
  return (
    <div style={{ marginTop: '36px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
        <span
          style={{
            fontFamily:    '"JetBrains Mono", monospace',
            fontSize:      '11px',
            fontWeight:    700,
            color:         '#16A34A',
            letterSpacing: '1px',
            flexShrink:    0,
          }}
        >
          {String(number).padStart(2, '0')}
        </span>
        <h2
          style={{
            margin:        0,
            fontSize:      '17px',
            fontWeight:    800,
            color:         T.text,
            letterSpacing: '-0.3px',
            lineHeight:    1.2,
          }}
        >
          {children}
        </h2>
      </div>
      <div
        style={{
          height:     '1.5px',
          background: 'linear-gradient(90deg, #16A34A30, transparent)',
          marginTop:  '8px',
        }}
      />
    </div>
  );
}

function SubTitle({ children }) {
  return (
    <p
      style={{
        margin:        '18px 0 4px',
        fontSize:      '13px',
        fontWeight:    700,
        color:         T.text,
        letterSpacing: '-0.1px',
      }}
    >
      {children}
    </p>
  );
}

function Body({ children }) {
  return (
    <p
      style={{
        margin:     '0 0 10px',
        fontSize:   '13px',
        fontWeight: 400,
        color:      T.textMuted,
        lineHeight: 1.75,
      }}
    >
      {children}
    </p>
  );
}

function BulletList({ items }) {
  return (
    <ul
      style={{
        margin:        '4px 0 10px',
        paddingLeft:   '20px',
        display:       'flex',
        flexDirection: 'column',
        gap:           '5px',
      }}
    >
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: '13px', color: T.textMuted, lineHeight: 1.65 }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function InfoCard({ icon, title, children }) {
  return (
    <div
      style={{
        background:   T.surfaceAlt ?? '#F9FAFB',
        border:       `1px solid ${T.border}`,
        borderRadius: '12px',
        padding:      '14px 16px',
        marginBottom: '10px',
        display:      'flex',
        gap:          '12px',
        alignItems:   'flex-start',
      }}
    >
      <span style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 700, color: T.text, marginBottom: '4px' }}>
          {title}
        </div>
        <div style={{ fontSize: '13px', color: T.textMuted, lineHeight: 1.65 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────
export default function PrivacyPolicy({ onAccept, onDecline, showActions = false }) {
  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 4px', fontFamily: 'inherit' }}>

      {/* ── Header ── */}
      <div
        style={{
          textAlign:    'center',
          padding:      '32px 0 24px',
          borderBottom: `1.5px solid ${T.border}`,
          marginBottom: '4px',
        }}
      >
        <div
          style={{
            display:       'inline-flex',
            alignItems:    'center',
            gap:           '8px',
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
          YOUR PRIVACY
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
          Privacy Policy
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: '13px', color: T.textMuted }}>
          UaTob LLC &nbsp;·&nbsp; Effective {EFFECTIVE_DATE} &nbsp;·&nbsp; uatob.com
        </p>
      </div>

      {/* ── Intro callout ── */}
      <div
        style={{
          background:   '#16A34A08',
          border:       '1.5px solid #16A34A25',
          borderRadius: '14px',
          padding:      '16px 18px',
          marginTop:    '20px',
          marginBottom: '4px',
        }}
      >
        <p style={{ margin: 0, fontSize: '13px', color: T.textMuted, lineHeight: 1.7 }}>
          UaTob LLC ("UaTob," "we," "us," or "our") is committed to protecting your privacy. This
          Privacy Policy explains how we collect, use, disclose, and safeguard your information when
          you use the UaTob platform as a <strong style={{ color: T.text }}>Rider</strong> or{' '}
          <strong style={{ color: T.text }}>Driver</strong>. Please read it carefully.
        </p>
      </div>

      {/* ── At a glance cards ── */}
      <div style={{ marginTop: '24px', marginBottom: '4px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: T.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '10px' }}>
          AT A GLANCE
        </p>
        <InfoCard icon="📍" title="Location Data">
          We collect real-time GPS data from drivers while they are active on the platform. Riders see driver location during an active ride only.
        </InfoCard>
        <InfoCard icon="💳" title="Payment Data">
          Payment information is processed and stored by Stripe. UaTob does not store full card numbers on our servers.
        </InfoCard>
        <InfoCard icon="🔒" title="We Don't Sell Your Data">
          UaTob does not sell your personal information to third parties for their marketing purposes.
        </InfoCard>
        <InfoCard icon="🗑️" title="Your Rights">
          You may request access to, correction of, or deletion of your personal data at any time by contacting privacy@uatob.com.
        </InfoCard>
      </div>

      {/* ── SECTION 1 ── */}
      <SectionTitle number={1}>Information We Collect</SectionTitle>
      <SubTitle>1.1 Information You Provide</SubTitle>
      <Body>When you create an account or use our services, we collect:</Body>
      <BulletList items={[
        'Full name, email address, and phone number',
        'Profile photo (optional)',
        'Payment method information (processed via Stripe)',
        'Pickup and drop-off addresses entered during booking',
        'Driver-specific information: driver\'s license, vehicle details, insurance, and vehicle photos',
        'Messages sent through the in-app messaging system',
        'Feedback and ratings submitted after rides',
      ]} />

      <SubTitle>1.2 Information Collected Automatically</SubTitle>
      <Body>When you use the Platform, we automatically collect:</Body>
      <BulletList items={[
        'Device information: device type, operating system, unique device identifiers',
        'Log data: IP address, browser type, pages visited, timestamps, and referring URLs',
        'GPS and location data when the app is in use (drivers: continuously while active; riders: at booking and during active rides)',
        'Usage data: features accessed, ride history, session duration',
        'Crash reports and performance diagnostics',
      ]} />

      <SubTitle>1.3 Information from Third Parties</SubTitle>
      <Body>We may receive information about you from:</Body>
      <BulletList items={[
        'Stripe, for payment processing and fraud prevention',
        'Background check providers, for driver screening',
        'Google Maps and related APIs, for location and routing services',
        'Firebase Authentication, for account creation and identity verification',
      ]} />

      {/* ── SECTION 2 ── */}
      <SectionTitle number={2}>How We Use Your Information</SectionTitle>
      <Body>We use the information we collect to:</Body>
      <BulletList items={[
        'Facilitate ride matching between riders and available drivers',
        'Process payments and issue payouts to drivers via Stripe Connect',
        'Provide real-time GPS tracking and ETA information during active rides',
        'Send ride confirmations, receipts, and service notifications',
        'Communicate with you about your account, disputes, or support requests',
        'Calculate fares, platform fees, and driver earnings',
        'Enforce our Terms of Service and investigate violations',
        'Detect, prevent, and respond to fraud, abuse, and safety incidents',
        'Improve the Platform through usage analytics and performance monitoring',
        'Comply with applicable legal obligations',
      ]} />

      {/* ── SECTION 3 ── */}
      <SectionTitle number={3}>Location Data</SectionTitle>
      <SubTitle>3.1 Driver Location</SubTitle>
      <Body>
        When a driver is active on the Platform (online and available or on a trip), UaTob
        continuously collects GPS coordinates. This data is used to match drivers with nearby
        ride requests, display the driver's position to the assigned rider during an active trip,
        calculate distances and ETAs, and verify trip routes for fare calculation.
      </Body>
      <Body>
        Location collection stops when the driver goes offline. Drivers may not use the Platform
        to accept rides while location services are disabled.
      </Body>
      <SubTitle>3.2 Rider Location</SubTitle>
      <Body>
        We collect rider location at the time of booking to suggest a pickup point and at
        intervals during an active ride for routing and safety purposes. Riders may manually
        enter a pickup address without enabling device location services, though accuracy may
        be reduced.
      </Body>
      <SubTitle>3.3 Location Data Retention</SubTitle>
      <Body>
        Trip-level location data is retained for up to 24 months to support dispute resolution,
        safety investigations, and legal compliance. Aggregate or anonymized location data may
        be retained indefinitely for analytics.
      </Body>

      {/* ── SECTION 4 ── */}
      <SectionTitle number={4}>How We Share Your Information</SectionTitle>
      <Body>We do not sell your personal information. We share your information only in the following circumstances:</Body>

      <SubTitle>4.1 Between Riders and Drivers</SubTitle>
      <Body>
        When a ride is matched, the rider receives the driver's first name, vehicle details,
        license plate, and real-time location. The driver receives the rider's first name and
        pickup location. Phone numbers are shared only to facilitate direct contact during an
        active ride.
      </Body>

      <SubTitle>4.2 Service Providers</SubTitle>
      <Body>We share data with trusted third-party service providers who assist us in operating the Platform, including:</Body>
      <BulletList items={[
        'Stripe — payment processing and driver payouts',
        'Google — maps, routing, geocoding, and distance calculations',
        'Firebase (Google) — database, authentication, and cloud functions',
        'SendGrid — transactional email delivery',
        'Background check providers — driver screening and identity verification',
      ]} />
      <Body>
        These providers are contractually obligated to use your data only as directed by UaTob
        and in accordance with applicable law.
      </Body>

      <SubTitle>4.3 Legal and Safety Disclosures</SubTitle>
      <Body>We may disclose your information when required to:</Body>
      <BulletList items={[
        'Comply with applicable law, regulation, or legal process',
        'Respond to lawful requests from law enforcement or government authorities',
        'Protect the rights, property, or safety of UaTob, our users, or the public',
        'Investigate and prevent fraud, abuse, or violations of our Terms',
      ]} />

      <SubTitle>4.4 Business Transfers</SubTitle>
      <Body>
        In the event of a merger, acquisition, financing, or sale of all or a portion of UaTob's
        assets, your information may be transferred as part of that transaction. We will notify
        you via email or prominent notice on the Platform before your information is transferred
        and becomes subject to a different privacy policy.
      </Body>

      {/* ── SECTION 5 ── */}
      <SectionTitle number={5}>Data Retention</SectionTitle>
      <Body>
        We retain your personal information for as long as your account is active or as needed
        to provide services, resolve disputes, enforce agreements, and comply with legal obligations.
        Specific retention periods include:
      </Body>
      <BulletList items={[
        'Account information: retained for the duration of your account plus 3 years after closure',
        'Trip records and receipts: retained for 5 years for tax and legal compliance',
        'GPS and location data: retained for up to 24 months',
        'Messages: retained for 12 months after the associated ride is completed',
        'Payment records: retained as required by Stripe and applicable financial regulations',
        'Background check data: retained per applicable background check provider agreements',
      ]} />
      <Body>
        When data is no longer needed, we securely delete or anonymize it.
      </Body>

      {/* ── SECTION 6 ── */}
      <SectionTitle number={6}>Cookies and Tracking Technologies</SectionTitle>
      <Body>
        UaTob uses cookies and similar tracking technologies on our website (uatob.com) to
        maintain session state, remember your preferences, and analyze site usage. We use:
      </Body>
      <BulletList items={[
        'Essential cookies — required for authentication and core Platform functionality',
        'Analytics cookies — to understand how users interact with our website (e.g., Google Analytics)',
        'Firebase session tokens — to maintain your authenticated session in the app',
      ]} />
      <Body>
        You may disable cookies through your browser settings, though this may impact the
        functionality of the Platform. Our mobile application uses device identifiers and
        Firebase tokens rather than browser cookies.
      </Body>

      {/* ── SECTION 7 ── */}
      <SectionTitle number={7}>Data Security</SectionTitle>
      <Body>
        UaTob implements industry-standard security measures to protect your personal information,
        including:
      </Body>
      <BulletList items={[
        'Encryption of data in transit using TLS/HTTPS',
        'Firebase Security Rules to restrict unauthorized access to Firestore data',
        'Firebase Authentication for secure identity management',
        'Stripe\'s PCI-DSS compliant infrastructure for all payment data',
        'Role-based access controls limiting employee access to user data',
        'Regular security reviews and monitoring of Cloud Function endpoints',
      ]} />
      <Body>
        While we take reasonable precautions, no security system is impenetrable. In the event
        of a data breach that affects your personal information, we will notify you as required
        by applicable law.
      </Body>

      {/* ── SECTION 8 ── */}
      <SectionTitle number={8}>Your Rights and Choices</SectionTitle>
      <Body>Depending on your location and applicable law, you may have the right to:</Body>
      <BulletList items={[
        'Access the personal information UaTob holds about you',
        'Request correction of inaccurate or incomplete information',
        'Request deletion of your personal information, subject to legal retention requirements',
        'Object to or restrict certain processing of your data',
        'Withdraw consent where processing is based on consent',
        'Request a portable copy of your data in a machine-readable format',
      ]} />
      <Body>
        To exercise any of these rights, contact us at privacy@uatob.com. We will respond to
        verified requests within 30 days. We may need to verify your identity before processing
        your request.
      </Body>
      <SubTitle>8.1 Account Deletion</SubTitle>
      <Body>
        You may delete your account at any time through the app settings or by emailing
        support@uatob.com. Account deletion removes your profile and personal information from
        active systems, subject to retention periods required for legal and financial compliance.
      </Body>
      <SubTitle>8.2 Marketing Communications</SubTitle>
      <Body>
        You may opt out of promotional emails at any time by clicking the unsubscribe link in
        any marketing email or by updating your notification preferences in the app. You will
        continue to receive transactional communications related to your account and rides.
      </Body>

      {/* ── SECTION 9 ── */}
      <SectionTitle number={9}>Children's Privacy</SectionTitle>
      <Body>
        The UaTob Platform is not directed to individuals under the age of 18. We do not
        knowingly collect personal information from minors. If we become aware that a person
        under 18 has provided us with personal information, we will delete it promptly. If you
        believe a minor has submitted information to UaTob, please contact us at
        privacy@uatob.com.
      </Body>

      {/* ── SECTION 10 ── */}
      <SectionTitle number={10}>Third-Party Links and Services</SectionTitle>
      <Body>
        The Platform may contain links to third-party websites or integrate third-party services
        (such as Google Maps). UaTob is not responsible for the privacy practices of these third
        parties. We encourage you to review the privacy policies of any third-party services you
        interact with through our Platform.
      </Body>

      {/* ── SECTION 11 ── */}
      <SectionTitle number={11}>Florida Privacy Rights</SectionTitle>
      <Body>
        UaTob operates in Florida and complies with applicable Florida privacy laws. Florida
        residents have the right to know what personal information is collected, used, or
        disclosed, and to request access or deletion of their data as described in Section 8.
      </Body>
      <Body>
        UaTob does not discriminate against users who exercise their privacy rights. Exercising
        these rights will not result in denial of service, different pricing, or reduced quality
        of service.
      </Body>

      {/* ── SECTION 12 ── */}
      <SectionTitle number={12}>Changes to This Privacy Policy</SectionTitle>
      <Body>
        UaTob may update this Privacy Policy from time to time. When we make material changes,
        we will update the Effective Date at the top of this page and notify you via email or
        in-app notification. Your continued use of the Platform after such notice constitutes
        your acceptance of the updated policy.
      </Body>
      <Body>
        We encourage you to review this policy periodically to stay informed about how we
        protect your information.
      </Body>

      {/* ── SECTION 13 ── */}
      <SectionTitle number={13}>Contact Us</SectionTitle>
      <Body>
        If you have questions, concerns, or requests regarding this Privacy Policy or your
        personal data, please contact us:
      </Body>
      <div
        style={{
          background:   T.surfaceAlt ?? '#F9FAFB',
          border:       `1px solid ${T.border}`,
          borderRadius: '12px',
          padding:      '16px 18px',
          marginBottom: '12px',
        }}
      >
        {[
          ['Company',  'UaTob LLC'],
          ['Website',  'uatob.com'],
          ['Privacy',  'privacy@uatob.com'],
          ['Support',  'support@uatob.com'],
          ['Location', 'Orlando, Florida'],
        ].map(([label, value]) => (
          <div
            key={label}
            style={{ display: 'flex', gap: '12px', marginBottom: '6px', fontSize: '13px' }}
          >
            <span style={{ fontWeight: 700, color: T.text, minWidth: '70px' }}>{label}</span>
            <span style={{ color: T.textMuted }}>{value}</span>
          </div>
        ))}
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          borderTop:     `1px solid ${T.border}`,
          marginTop:     '24px',
          paddingTop:    '16px',
          textAlign:     'center',
          fontSize:      '11px',
          color:         T.textMuted,
          paddingBottom: showActions ? '0' : '32px',
        }}
      >
        © {new Date().getFullYear()} UaTob LLC. All rights reserved.
        &nbsp;·&nbsp; Last updated {EFFECTIVE_DATE}
      </div>

      {/* ── Optional accept / decline actions ── */}
      {showActions && (
        <div
          style={{
            display:        'flex',
            gap:            '10px',
            padding:        '20px 0 32px',
            justifyContent: 'center',
          }}
        >
          {onDecline && (
            <button
              onClick={onDecline}
              style={{
                padding:      '11px 24px',
                borderRadius: '12px',
                border:       `1.5px solid ${T.border}`,
                background:   'none',
                fontSize:     '13px',
                fontWeight:   700,
                color:        T.textMuted,
                cursor:       'pointer',
              }}
            >
              Decline
            </button>
          )}
          {onAccept && (
            <button
              onClick={onAccept}
              style={{
                padding:      '11px 28px',
                borderRadius: '12px',
                border:       'none',
                background:   'linear-gradient(135deg,#16A34A,#15803D)',
                fontSize:     '13px',
                fontWeight:   700,
                color:        '#fff',
                cursor:       'pointer',
                boxShadow:    '0 4px 14px rgba(22,163,74,.3)',
              }}
            >
              I Agree to the Privacy Policy
            </button>
          )}
        </div>
      )}

    </div>
  );
}