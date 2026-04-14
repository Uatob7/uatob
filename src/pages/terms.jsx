// src/App/UaTob/TermsOfService.jsx
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
          background: `linear-gradient(90deg, #16A34A30, transparent)`,
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
        margin:       '18px 0 4px',
        fontSize:     '13px',
        fontWeight:   700,
        color:        T.text,
        letterSpacing:'-0.1px',
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
        margin:         '4px 0 10px',
        paddingLeft:    '20px',
        display:        'flex',
        flexDirection:  'column',
        gap:            '5px',
      }}
    >
      {items.map((item, i) => (
        <li
          key={i}
          style={{
            fontSize:   '13px',
            color:      T.textMuted,
            lineHeight: 1.65,
          }}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function Caps({ children }) {
  return (
    <p
      style={{
        margin:      '0 0 10px',
        fontSize:    '12px',
        fontWeight:  600,
        color:       T.textMuted,
        lineHeight:  1.7,
        background:  T.surfaceAlt ?? '#F9FAFB',
        border:      `1px solid ${T.border}`,
        borderRadius:'10px',
        padding:     '12px 14px',
      }}
    >
      {children}
    </p>
  );
}

// ── Main component ─────────────────────────────────────────
export default function TermsOfService({ onAccept, onDecline, showActions = false }) {
  return (
    <div
      style={{
        maxWidth:      '720px',
        margin:        '0 auto',
        padding:       '0 4px',
        fontFamily:    'inherit',
      }}
    >
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
            display:        'inline-flex',
            alignItems:     'center',
            gap:            '8px',
            background:     '#16A34A12',
            border:         '1px solid #16A34A30',
            borderRadius:   '99px',
            padding:        '4px 14px',
            fontSize:       '11px',
            fontWeight:     700,
            color:          '#16A34A',
            letterSpacing:  '0.8px',
            marginBottom:   '14px',
          }}
        >
          LEGAL AGREEMENT
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
          Terms of Service
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
          Please read these Terms carefully before creating an account or using the UaTob platform.
          By signing up as a <strong style={{ color: T.text }}>Rider</strong> or{' '}
          <strong style={{ color: T.text }}>Driver</strong>, you agree to be legally bound by these Terms.
        </p>
      </div>

      {/* ────────────────────────────────────────────────────── */}
      {/* SECTION 1 */}
      <SectionTitle number={1}>Introduction</SectionTitle>
      <Body>
        Welcome to UaTob. These Terms of Service ("Terms") govern your access to and use of the UaTob
        platform, including our website at uatob.com, mobile applications, and related services
        (collectively, the "Platform"), operated by UaTob LLC ("UaTob," "we," "us," or "our"), based
        in Orlando, Florida.
      </Body>
      <Body>
        By creating an account, booking a ride, or registering as a driver, you agree to be bound by
        these Terms. If you do not agree, do not use the Platform. These Terms apply to all users,
        including Riders, Drivers, and any individual who accesses or uses UaTob services.
      </Body>

      {/* SECTION 2 */}
      <SectionTitle number={2}>Eligibility</SectionTitle>
      <Body>To use the Platform, you must:</Body>
      <BulletList items={[
        'Be at least 18 years of age',
        'Have the legal capacity to enter into a binding contract under applicable law',
        'Not be prohibited from using the Platform under any applicable laws or regulations',
        'Provide accurate, complete, and current registration information',
      ]} />
      <Body>Drivers must additionally:</Body>
      <BulletList items={[
        'Hold a valid driver\'s license issued in the United States',
        'Maintain valid vehicle registration and insurance as required by Florida law',
        'Pass UaTob\'s background screening and vehicle inspection process',
        'Be legally authorized to work in the United States',
      ]} />

      {/* SECTION 3 */}
      <SectionTitle number={3}>Accounts and Registration</SectionTitle>
      <SubTitle>3.1 Account Creation</SubTitle>
      <Body>
        To access certain features of the Platform, you must create an account. You agree to provide
        accurate and complete information during registration and to keep your account information
        current.
      </Body>
      <SubTitle>3.2 Account Security</SubTitle>
      <Body>
        You are responsible for maintaining the confidentiality of your account credentials and for
        all activity that occurs under your account. Notify UaTob immediately at support@uatob.com if
        you suspect unauthorized access. UaTob is not liable for any loss resulting from unauthorized
        use of your credentials.
      </Body>
      <SubTitle>3.3 One Account Per Person</SubTitle>
      <Body>
        Each individual may maintain only one active account. UaTob reserves the right to terminate
        duplicate or fraudulent accounts without notice.
      </Body>

      {/* SECTION 4 */}
      <SectionTitle number={4}>The UaTob Platform</SectionTitle>
      <SubTitle>4.1 Ride-Sharing Services</SubTitle>
      <Body>
        UaTob provides a technology platform that connects independent driver partners ("Drivers") with
        individuals seeking transportation ("Riders"). UaTob is not a transportation carrier. Drivers
        are independent contractors — not employees, agents, or representatives of UaTob.
      </Body>
      <SubTitle>4.2 No Guarantee of Availability</SubTitle>
      <Body>
        UaTob does not guarantee the availability of drivers at any given time or location. Ride
        availability depends on driver supply, location, and demand within the service area.
      </Body>
      <SubTitle>4.3 Service Area</SubTitle>
      <Body>
        UaTob currently operates in the Orlando, Florida metropolitan area. Service availability may
        vary by location and is subject to change without notice.
      </Body>

      {/* SECTION 5 */}
      <SectionTitle number={5}>Fares and Payments</SectionTitle>
      <SubTitle>5.1 Fare Calculation</SubTitle>
      <Body>
        Fares are calculated based on a combination of base fare, distance, ride tier, and applicable
        fees. The estimated fare is displayed before you confirm a booking. Final fares may differ
        from estimates based on actual trip distance and duration.
      </Body>
      <SubTitle>5.2 Payment Processing</SubTitle>
      <Body>
        All payments are processed securely through Stripe. By using the Platform, you authorize
        UaTob to charge your selected payment method for all applicable ride fares, fees, and charges.
        UaTob uses Stripe Connect to facilitate payments to drivers.
      </Body>
      <SubTitle>5.3 Platform Fee</SubTitle>
      <Body>
        UaTob retains a platform service fee from each completed ride. Drivers receive the remaining
        portion of the fare as specified in their Driver Agreement.
      </Body>
      <SubTitle>5.4 Cancellations and Refunds</SubTitle>
      <Body>
        Cancellation policies vary based on when a cancellation occurs relative to driver assignment
        and arrival. UaTob reserves the right to charge a cancellation fee where applicable. Refund
        requests are reviewed on a case-by-case basis and may be submitted to support@uatob.com.
      </Body>
      <SubTitle>5.5 Disputes</SubTitle>
      <Body>
        If you believe you were charged incorrectly, you must notify UaTob within 30 days of the
        charge. UaTob will review the dispute and, at its sole discretion, issue a credit or refund
        where warranted.
      </Body>

      {/* SECTION 6 */}
      <SectionTitle number={6}>Rider Conduct</SectionTitle>
      <Body>As a Rider, you agree to:</Body>
      <BulletList items={[
        'Treat drivers with respect and courtesy at all times',
        'Not engage in discriminatory, abusive, or threatening behavior toward drivers',
        'Not damage or deface any driver\'s vehicle',
        'Wear a seatbelt during all rides as required by Florida law',
        'Not request rides for the purpose of conducting illegal activity',
        'Not bring prohibited items — including open alcohol containers, illegal substances, or weapons — into a driver\'s vehicle',
        'Be ready at the designated pickup location at the confirmed time',
      ]} />
      <Body>
        Riders who violate these conduct standards may have their accounts suspended or permanently
        deactivated.
      </Body>

      {/* SECTION 7 */}
      <SectionTitle number={7}>Driver Conduct and Obligations</SectionTitle>
      <Body>As a Driver, you agree to:</Body>
      <BulletList items={[
        'Maintain a valid driver\'s license, vehicle registration, and auto insurance at all times',
        'Keep your vehicle clean, safe, and in compliance with UaTob\'s vehicle standards',
        'Comply with all applicable traffic laws and regulations',
        'Treat riders with professionalism and courtesy',
        'Not accept or solicit off-platform payments from riders',
        'Not engage in discrimination based on race, color, religion, sex, national origin, disability, or any other protected characteristic',
        'Promptly report any accidents, incidents, or safety concerns to UaTob',
      ]} />
      <Body>
        Drivers who violate these obligations may be suspended, deactivated, or removed from the
        Platform, and may be subject to legal action where applicable.
      </Body>

      {/* SECTION 8 */}
      <SectionTitle number={8}>Independent Contractor Relationship</SectionTitle>
      <Body>
        Drivers using the UaTob Platform are independent contractors, not employees of UaTob LLC.
        Nothing in these Terms creates an employment, agency, joint venture, or partnership
        relationship between UaTob and any Driver. Drivers are solely responsible for determining
        how, when, and where they provide services, subject to applicable law and UaTob's standards.
      </Body>
      <Body>
        As independent contractors, Drivers are responsible for their own taxes, insurance, and
        compliance with applicable federal, state, and local laws.
      </Body>

      {/* SECTION 9 */}
      <SectionTitle number={9}>Privacy</SectionTitle>
      <Body>
        Your use of the Platform is governed by our Privacy Policy, available at uatob.com/privacy.
        By using the Platform, you consent to the collection, use, and disclosure of your information
        as described in the Privacy Policy.
      </Body>
      <Body>
        UaTob collects location data from drivers while they are active on the Platform in order to
        facilitate ride matching and live tracking. Riders may view driver location in real time
        during an active ride.
      </Body>

      {/* SECTION 10 */}
      <SectionTitle number={10}>Intellectual Property</SectionTitle>
      <Body>
        All content, features, and functionality of the Platform — including text, graphics, logos,
        software, and code — are owned by or licensed to UaTob LLC and are protected by applicable
        intellectual property laws.
      </Body>
      <Body>
        You may not reproduce, distribute, modify, create derivative works of, publicly display, or
        otherwise exploit any portion of the Platform without UaTob's prior written consent.
      </Body>

      {/* SECTION 11 */}
      <SectionTitle number={11}>Prohibited Uses</SectionTitle>
      <Body>You agree not to use the Platform to:</Body>
      <BulletList items={[
        'Violate any applicable law or regulation',
        'Impersonate any person or entity or misrepresent your affiliation',
        'Transmit harmful, offensive, or disruptive content through the messaging system',
        'Attempt to gain unauthorized access to any part of the Platform or its infrastructure',
        'Use automated tools, bots, or scripts to interact with the Platform',
        'Interfere with or disrupt the integrity or performance of the Platform',
        'Collect or harvest user data without authorization',
      ]} />

      {/* SECTION 12 */}
      <SectionTitle number={12}>Disclaimers</SectionTitle>
      <Caps>
        THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER
        EXPRESS OR IMPLIED. UATOB DISCLAIMS ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF
        MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. UATOB IS NOT
        RESPONSIBLE FOR THE CONDUCT, ACTIONS, OR OMISSIONS OF ANY DRIVER OR RIDER ON OR OFF THE
        PLATFORM.
      </Caps>

      {/* SECTION 13 */}
      <SectionTitle number={13}>Limitation of Liability</SectionTitle>
      <Caps>
        TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, UATOB LLC AND ITS OFFICERS, DIRECTORS,
        EMPLOYEES, AGENTS, AND LICENSORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
        CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL. IN NO
        EVENT SHALL UATOB'S TOTAL LIABILITY EXCEED THE GREATER OF (A) THE TOTAL AMOUNT PAID BY YOU
        TO UATOB IN THE THREE (3) MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED DOLLARS ($100.00).
      </Caps>

      {/* SECTION 14 */}
      <SectionTitle number={14}>Indemnification</SectionTitle>
      <Body>
        You agree to indemnify, defend, and hold harmless UaTob LLC and its officers, directors,
        employees, agents, and licensors from and against any claims, liabilities, damages, losses,
        and expenses — including reasonable attorneys' fees — arising out of or in connection with:
        (a) your use of the Platform; (b) your violation of these Terms; (c) your violation of any
        third-party rights; or (d) any ride you provide or receive through the Platform.
      </Body>

      {/* SECTION 15 */}
      <SectionTitle number={15}>Governing Law and Dispute Resolution</SectionTitle>
      <SubTitle>15.1 Governing Law</SubTitle>
      <Body>
        These Terms are governed by the laws of the State of Florida, without regard to its conflict
        of law provisions. Disputes shall be subject to the exclusive jurisdiction of the state and
        federal courts located in Orange County, Florida.
      </Body>
      <SubTitle>15.2 Informal Resolution</SubTitle>
      <Body>
        Before initiating any formal legal proceeding, you agree to contact UaTob at legal@uatob.com
        and attempt to resolve the dispute informally for at least 30 days.
      </Body>
      <SubTitle>15.3 Class Action Waiver</SubTitle>
      <Caps>
        YOU AND UATOB AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS
        INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR
        REPRESENTATIVE PROCEEDING.
      </Caps>

      {/* SECTION 16 */}
      <SectionTitle number={16}>Termination</SectionTitle>
      <Body>
        UaTob reserves the right to suspend or terminate your account at any time, with or without
        cause and with or without notice. Grounds include violation of these Terms, fraudulent
        activity, unsafe behavior, or conduct that harms other users or UaTob.
      </Body>
      <Body>
        Upon termination, your right to use the Platform ceases immediately. Sections 10, 12, 13,
        14, and 15 survive termination.
      </Body>

      {/* SECTION 17 */}
      <SectionTitle number={17}>Changes to These Terms</SectionTitle>
      <Body>
        UaTob may modify these Terms at any time. When material changes are made, we will update the
        Effective Date and notify you via email or in-app notification. Continued use of the Platform
        after such notice constitutes acceptance of the updated Terms.
      </Body>

      {/* SECTION 18 */}
      <SectionTitle number={18}>Miscellaneous</SectionTitle>
      <SubTitle>18.1 Entire Agreement</SubTitle>
      <Body>
        These Terms, together with the Privacy Policy and any applicable Driver Agreement, constitute
        the entire agreement between you and UaTob with respect to the Platform.
      </Body>
      <SubTitle>18.2 Severability</SubTitle>
      <Body>
        If any provision of these Terms is found to be unenforceable, it shall be modified to the
        minimum extent necessary, and the remaining provisions shall remain in full force and effect.
      </Body>
      <SubTitle>18.3 Waiver</SubTitle>
      <Body>
        UaTob's failure to enforce any right or provision shall not be deemed a waiver of such right
        or provision.
      </Body>
      <SubTitle>18.4 Assignment</SubTitle>
      <Body>
        You may not assign these Terms without UaTob's prior written consent. UaTob may assign these
        Terms without restriction.
      </Body>

      {/* SECTION 19 */}
      <SectionTitle number={19}>Contact Us</SectionTitle>
      <Body>If you have any questions about these Terms, please contact us:</Body>
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
          ['Legal',    'legal@uatob.com'],
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
          borderTop:  `1px solid ${T.border}`,
          marginTop:  '24px',
          paddingTop: '16px',
          textAlign:  'center',
          fontSize:   '11px',
          color:      T.textMuted,
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
              I Agree to the Terms
            </button>
          )}
        </div>
      )}
    </div>
  );
}