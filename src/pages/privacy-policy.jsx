// src/App/Legal/PrivacyPolicy.jsx
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import {
  ArrowLeft, Shield, Database, Eye, Share2, Lock, UserCheck,
  Globe, Cookie, Baby, AlertTriangle, RefreshCw, Mail, Phone,
  ChevronRight, Calendar, FileText, MapPin, Smartphone, CheckCircle,
} from "lucide-react";

const C = {
  bg: "#FAFAF7", surface: "#FFFFFF", surfaceRaised: "#F9FAF7",
  surfaceBright: "#F3F4F0", border: "#E8E6DD", borderBright: "#D8D5CC",
  accent: "#16A34A", accentDim: "#15803D", accentGlow: "rgba(22,163,74,.1)",
  accentBorder: "rgba(22,163,74,.22)", text: "#0F0F10", textMid: "#5A5A52",
  textDim: "#9A988E", red: "#DC2626", blue: "#2563EB", purple: "#7C3AED",
};

const LAST_UPDATED = "April 1, 2026";
const EFFECTIVE_DATE = "April 1, 2026";

const SECTIONS = [
  { id: "intro",        label: "Introduction",            icon: Shield },
  { id: "collect",      label: "Information We Collect",  icon: Database },
  { id: "use",          label: "How We Use Information",  icon: Eye },
  { id: "share",        label: "How We Share Information", icon: Share2 },
  { id: "security",     label: "Data Security",            icon: Lock },
  { id: "rights",       label: "Your Privacy Rights",     icon: UserCheck },
  { id: "international", label: "International Users",    icon: Globe },
  { id: "cookies",      label: "Cookies & Tracking",      icon: Cookie },
  { id: "children",     label: "Children's Privacy",      icon: Baby },
  { id: "retention",    label: "Data Retention",          icon: Calendar },
  { id: "changes",      label: "Changes to This Policy",  icon: RefreshCw },
  { id: "contact",      label: "Contact Us",              icon: Mail },
];

export default function PrivacyPolicy() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const [tocOpen, setTocOpen] = useState(false);
  const sectionRefs = useRef({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-30% 0px -50% 0px" }
    );
    Object.values(sectionRefs.current).forEach(ref => {
      if (ref) observer.observe(ref);
    });
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTocOpen(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: '"Barlow", system-ui, sans-serif', color: C.text }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800;900&family=Barlow+Condensed:wght@500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.surfaceBright}; border-radius: 4px; }
      `}} />

      {/* Sticky header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(250,250,247,0.92)",
        backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{
          maxWidth: 720, margin: "0 auto",
          padding: "14px 16px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              padding: 8, borderRadius: 10,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background .15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = C.surfaceBright}
            onMouseLeave={e => e.currentTarget.style.background = C.surface}
          >
            <ArrowLeft size={16} color={C.text} strokeWidth={2.4}/>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 9.5, fontWeight: 700, color: C.textDim,
              letterSpacing: "1.5px", textTransform: "uppercase",
            }}>
              Legal Documents
            </div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 18, fontWeight: 900, color: C.text,
              letterSpacing: "-0.3px", lineHeight: 1.1,
            }}>
              Privacy Policy
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTocOpen(o => !o)}
            style={{
              background: tocOpen ? C.purple : C.surface,
              border: `1px solid ${tocOpen ? C.purple : C.border}`,
              padding: "7px 12px", borderRadius: 100,
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5,
              transition: "all .15s",
            }}
          >
            <FileText size={12} color={tocOpen ? "#fff" : C.textMid} strokeWidth={2.4}/>
            <span style={{
              fontSize: 11, fontWeight: 800,
              color: tocOpen ? "#fff" : C.textMid,
              fontFamily: "'Barlow Condensed', sans-serif",
              letterSpacing: ".5px", textTransform: "uppercase",
            }}>
              Contents
            </span>
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 80px" }}>
        {/* Hero */}
        <div style={{
          background: "linear-gradient(135deg,#F5F3FF,#EDE9FE,#F5F3FF)",
          border: "1.5px solid rgba(124,58,237,.28)",
          borderRadius: 22, padding: "24px 22px",
          marginBottom: 22,
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: -50, right: -50,
            width: 180, height: 180, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124,58,237,.18) 0%, transparent 70%)",
            pointerEvents: "none",
          }}/>
          <div style={{ position: "relative" }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: "linear-gradient(135deg,#A78BFA,#7C3AED)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 14,
              boxShadow: "0 8px 20px rgba(124,58,237,.35)",
            }}>
              <Shield size={22} color="#fff" strokeWidth={2.2}/>
            </div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 28, fontWeight: 900, color: C.text,
              letterSpacing: "-0.5px", lineHeight: 1.1, marginBottom: 8,
            }}>
              Privacy Policy
            </div>
            <div style={{ fontSize: 13.5, color: C.textMid, lineHeight: 1.6, marginBottom: 14 }}>
              Your privacy matters to us. This policy explains what information UaTob collects, how we use it, and the rights you have over your data.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(124,58,237,.18)",
                borderRadius: 100, padding: "5px 10px",
                fontSize: 11, fontWeight: 700, color: "#5B21B6",
              }}>
                <Calendar size={11} strokeWidth={2.4}/>
                Effective {EFFECTIVE_DATE}
              </div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(124,58,237,.18)",
                borderRadius: 100, padding: "5px 10px",
                fontSize: 11, fontWeight: 700, color: "#5B21B6",
              }}>
                <RefreshCw size={11} strokeWidth={2.4}/>
                Last updated {LAST_UPDATED}
              </div>
            </div>
          </div>
        </div>

        {/* Quick summary card */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 18, padding: "18px 20px",
          marginBottom: 22,
          boxShadow: `0 1px 3px ${C.bg}`,
        }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 10, fontWeight: 800, color: C.textDim,
            letterSpacing: "1.5px", textTransform: "uppercase",
            marginBottom: 12,
          }}>
            Quick Summary
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { Icon: CheckCircle, color: C.accent, text: "We never sell your personal data to third parties." },
              { Icon: Lock,        color: C.blue,   text: "All data is encrypted in transit and at rest." },
              { Icon: UserCheck,   color: C.purple, text: "You can request, correct, or delete your data anytime." },
              { Icon: Eye,         color: "#D97706", text: "Location is only collected when you're actively driving." },
            ].map(({ Icon, color, text }, i) => (
              <div key={i} style={{
                display: "flex", gap: 10, alignItems: "center",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: `${color}15`,
                  border: `1px solid ${color}25`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Icon size={14} color={color} strokeWidth={2.4}/>
                </div>
                <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>
                  {text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* TOC dropdown */}
        {tocOpen && (
          <div style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 16, padding: 8, marginBottom: 18,
            boxShadow: "0 8px 24px rgba(0,0,0,.06)",
            animation: "fadeIn .25s ease",
          }}>
            {SECTIONS.map((s, i) => {
              const Icon = s.icon;
              const isActive = activeSection === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => scrollToSection(s.id)}
                  style={{
                    width: "100%",
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px",
                    border: "none", borderRadius: 10,
                    background: isActive ? "rgba(124,58,237,0.08)" : "transparent",
                    cursor: "pointer", fontFamily: "inherit",
                    color: isActive ? C.purple : C.text,
                    transition: "background .12s",
                    textAlign: "left",
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.surfaceBright; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{
                    width: 26, height: 26, borderRadius: 7,
                    background: isActive ? C.purple : C.surfaceBright,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Icon size={13} color={isActive ? "#fff" : C.textMid} strokeWidth={2.2}/>
                  </div>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>
                    {i + 1}. {s.label}
                  </span>
                  <ChevronRight size={13} color={C.textDim} strokeWidth={2.2}/>
                </button>
              );
            })}
          </div>
        )}

        {/* Sections */}
        <Section id="intro" title="1. Introduction" icon={Shield} sectionRefs={sectionRefs}>
          <p>
            UaTob, Inc. ("<strong>UaTob</strong>", "we", "us", "our") respects your privacy and is committed to protecting your personal information. This Privacy Policy describes how we collect, use, share, and safeguard information when you use our mobile applications, websites, and related services (the "<strong>Platform</strong>").
          </p>
          <p>
            This policy applies to <strong>both riders and drivers</strong> who use the Platform, with section-specific notes where the data practices differ.
          </p>
          <p>
            By using the Platform, you agree to the practices described here. If you don't agree, please don't use the Platform.
          </p>
        </Section>

        <Section id="collect" title="2. Information We Collect" icon={Database} sectionRefs={sectionRefs}>
          <p>We collect information in three categories:</p>

          <SubHeading icon={UserCheck}>A. Information You Provide Directly</SubHeading>
          <BulletList items={[
            <span key="1"><strong>Account info:</strong> name, email, phone number, password, date of birth.</span>,
            <span key="2"><strong>Driver-only info:</strong> driver's license, vehicle registration, insurance, profile photo, license number, banking/payout information.</span>,
            <span key="3"><strong>Rider-only info:</strong> payment methods (card, Apple Pay, Google Pay, Cash App).</span>,
            <span key="4"><strong>Communications:</strong> messages sent through the in-app chat, support tickets, ratings, and reviews.</span>,
            <span key="5"><strong>Verification data:</strong> background check results, driving history records (drivers only).</span>,
          ]} />

          <SubHeading icon={Smartphone}>B. Information Collected Automatically</SubHeading>
          <BulletList items={[
            <span key="1"><strong>Device data:</strong> device type, OS version, app version, language, IP address, mobile network info.</span>,
            <span key="2"><strong>Location data:</strong> precise GPS location while you're using the app actively (drivers: only while online; riders: only during ride booking and trip).</span>,
            <span key="3"><strong>Usage data:</strong> pages viewed, ride history, ratings given, time spent in app, crash reports, performance metrics.</span>,
            <span key="4"><strong>Cookies & similar:</strong> session tokens, analytics identifiers (see Section 8).</span>,
          ]} />

          <SubHeading icon={Globe}>C. Information from Third Parties</SubHeading>
          <BulletList items={[
            <span key="1"><strong>Background check vendors:</strong> identity verification, criminal history, motor vehicle records (drivers only).</span>,
            <span key="2"><strong>Payment processors:</strong> Stripe, Apple Pay, Google Pay, Cash App provide transaction confirmations.</span>,
            <span key="3"><strong>Mapping services:</strong> Google Maps and Mapbox provide route, traffic, and geocoding data.</span>,
            <span key="4"><strong>Marketing partners:</strong> referral and promotional partners may share signup data with your consent.</span>,
          ]} />

          <Callout color="#D97706" icon={AlertTriangle}>
            We do not collect Social Security Numbers in full. Drivers' background checks are conducted via tokenized integration with our verified vendor and SSN is encrypted, never stored on our servers.
          </Callout>
        </Section>

        <Section id="use" title="3. How We Use Your Information" icon={Eye} sectionRefs={sectionRefs}>
          <p>We use collected information for:</p>
          <BulletList items={[
            <span key="1"><strong>Providing the service:</strong> matching riders with drivers, calculating fares, processing payments, dispatching rides.</span>,
            <span key="2"><strong>Safety:</strong> verifying driver eligibility, monitoring trips for unusual patterns, supporting emergency response.</span>,
            <span key="3"><strong>Communication:</strong> sending ride confirmations, receipts, account notifications, support replies.</span>,
            <span key="4"><strong>Improvements:</strong> analyzing usage to improve features, fix bugs, build new tools.</span>,
            <span key="5"><strong>Personalization:</strong> showing relevant ride options, surge zones, and saved locations.</span>,
            <span key="6"><strong>Marketing:</strong> sending promotional offers (only with your consent — opt out anytime).</span>,
            <span key="7"><strong>Legal & compliance:</strong> preventing fraud, complying with legal obligations, enforcing our Terms.</span>,
          ]} />
        </Section>

        <Section id="share" title="4. How We Share Information" icon={Share2} sectionRefs={sectionRefs}>
          <Callout color={C.accent} icon={CheckCircle}>
            <strong>We never sell your personal information to advertisers or data brokers.</strong>
          </Callout>
          <p>We share information only in these specific cases:</p>

          <SubHeading icon={UserCheck}>With Other Users</SubHeading>
          <BulletList items={[
            "Riders see the driver's first name, photo, vehicle info, plate, and rating.",
            "Drivers see the rider's first name, pickup/drop-off, and rating.",
            "Trip-related communication (in-app chat) is visible only to the matched parties.",
          ]} />

          <SubHeading icon={Globe}>With Service Providers</SubHeading>
          <BulletList items={[
            "Payment processors (Stripe, Apple, Google) for fare and payout transactions.",
            "Background check vendors (drivers only).",
            "Mapping & navigation providers (Google Maps, Mapbox).",
            "Cloud hosting (Google Cloud, Firebase) for application infrastructure.",
            "Analytics & crash reporting (Sentry, Firebase Analytics) — with anonymized identifiers.",
          ]} />
          <p>
            All service providers are bound by data-processing agreements requiring them to safeguard your data and use it only to provide their service to UaTob.
          </p>

          <SubHeading icon={AlertTriangle}>For Safety & Legal Reasons</SubHeading>
          <BulletList items={[
            "When required by law, subpoena, court order, or government request.",
            "To protect the rights, property, or safety of UaTob, our users, or others.",
            "In the event of a corporate transaction (merger, acquisition, asset sale) — users will be notified.",
          ]} />
        </Section>

        <Section id="security" title="5. Data Security" icon={Lock} sectionRefs={sectionRefs}>
          <p>
            We implement industry-standard technical and organizational safeguards to protect your data:
          </p>
          <BulletList items={[
            "TLS 1.3 encryption for all data in transit.",
            "AES-256 encryption for sensitive data at rest (banking info, identity documents).",
            "Multi-factor authentication available for all accounts.",
            "Strict role-based access controls — only authorized personnel can access user data.",
            "Continuous monitoring, intrusion detection, and regular third-party security audits.",
            "Encrypted backups stored in geographically distributed regions.",
          ]} />
          <Callout color={C.red} icon={AlertTriangle}>
            No system is 100% secure. If you suspect your account has been compromised, contact us immediately at <a href="mailto:[email protected]" style={{ color: C.red, fontWeight: 700, textDecoration: "none" }}>[email protected]</a>.
          </Callout>
        </Section>

        <Section id="rights" title="6. Your Privacy Rights" icon={UserCheck} sectionRefs={sectionRefs}>
          <p>Depending on your jurisdiction, you may have the following rights:</p>
          <BulletList items={[
            <span key="1"><strong>Access:</strong> request a copy of the personal information we hold about you.</span>,
            <span key="2"><strong>Correct:</strong> update inaccurate or incomplete information.</span>,
            <span key="3"><strong>Delete:</strong> request deletion of your data, subject to legal retention requirements.</span>,
            <span key="4"><strong>Port:</strong> receive your data in a machine-readable format.</span>,
            <span key="5"><strong>Object:</strong> object to processing for marketing or other non-essential purposes.</span>,
            <span key="6"><strong>Withdraw consent:</strong> revoke any consent you previously gave.</span>,
            <span key="7"><strong>Opt out of sale/sharing:</strong> we do not sell data, but you can confirm this any time.</span>,
          ]} />
          <p>
            To exercise any of these rights, email <a href="mailto:[email protected]" style={{ color: C.purple, fontWeight: 700, textDecoration: "none" }}>[email protected]</a> with your request. We respond within 30 days (45 days for complex requests).
          </p>

          <SubHeading icon={MapPin}>State-Specific Rights</SubHeading>
          <p>
            <strong>California (CCPA/CPRA):</strong> California residents have additional rights to know, delete, correct, and limit the use of sensitive personal information. We do not sell or share data for cross-context behavioral advertising.
          </p>
          <p>
            <strong>European Economic Area / UK (GDPR):</strong> Residents have rights under GDPR including the right to lodge a complaint with their local Data Protection Authority. Our lawful bases for processing include contract performance, legal obligations, legitimate interests, and consent.
          </p>
          <p>
            <strong>Other states:</strong> Virginia (VCDPA), Colorado (CPA), Connecticut (CTDPA), and others provide similar rights — exercise them via the same email contact.
          </p>
        </Section>

        <Section id="international" title="7. International Users" icon={Globe} sectionRefs={sectionRefs}>
          <p>
            UaTob operates primarily in the United States. If you access the Platform from outside the U.S., your information will be transferred to and processed in the United States, where data protection laws may differ from those in your country.
          </p>
          <p>
            For users in the EEA, UK, and Switzerland, we use Standard Contractual Clauses approved by the European Commission to ensure adequate protection of transferred data.
          </p>
        </Section>

        <Section id="cookies" title="8. Cookies & Tracking" icon={Cookie} sectionRefs={sectionRefs}>
          <p>We use cookies and similar technologies for:</p>
          <BulletList items={[
            <span key="1"><strong>Essential cookies:</strong> authentication, session management, fraud prevention. These cannot be disabled.</span>,
            <span key="2"><strong>Analytics cookies:</strong> understand how features are used. We use Firebase Analytics with anonymized identifiers.</span>,
            <span key="3"><strong>Preference cookies:</strong> remember your language, dark mode, and saved locations.</span>,
          ]} />
          <p>
            You can manage cookie preferences in your browser or device settings. Disabling essential cookies will prevent the app from working correctly.
          </p>
          <p>
            <strong>Do Not Track:</strong> our Platform does not currently respond to "Do Not Track" browser signals, as no industry standard exists. We honor opt-out preferences set within our app.
          </p>
        </Section>

        <Section id="children" title="9. Children's Privacy" icon={Baby} sectionRefs={sectionRefs}>
          <Callout color={C.red} icon={AlertTriangle}>
            UaTob is not intended for users under 18. We do not knowingly collect data from children under 13.
          </Callout>
          <p>
            Riders must be 18 or older to create an account. Minors may ride only when accompanied by a parent or legal guardian who has booked the ride. Drivers must be at least 21.
          </p>
          <p>
            If you believe we have collected data from a child under 13, contact us at <a href="mailto:[email protected]" style={{ color: C.purple, fontWeight: 700, textDecoration: "none" }}>[email protected]</a> and we will promptly delete it.
          </p>
        </Section>

        <Section id="retention" title="10. Data Retention" icon={Calendar} sectionRefs={sectionRefs}>
          <p>We retain personal data only as long as needed for the purposes described in this Policy:</p>
          <BulletList items={[
            <span key="1"><strong>Active accounts:</strong> for the duration of your relationship with UaTob.</span>,
            <span key="2"><strong>Trip records:</strong> 7 years for tax, legal, and dispute resolution purposes.</span>,
            <span key="3"><strong>Background check records:</strong> as required by state regulations (typically 5–7 years).</span>,
            <span key="4"><strong>Communications:</strong> 3 years from the last interaction.</span>,
            <span key="5"><strong>Closed accounts:</strong> certain data is retained in archived form for fraud prevention and legal compliance, then permanently deleted.</span>,
          ]} />
        </Section>

        <Section id="changes" title="11. Changes to This Policy" icon={RefreshCw} sectionRefs={sectionRefs}>
          <p>
            We may update this Privacy Policy periodically to reflect changes in our practices, technology, or legal requirements. Material changes will be communicated by email or in-app notification at least 30 days before they take effect.
          </p>
          <p>
            Your continued use of the Platform after the effective date constitutes acceptance. The "Last updated" date at the top of this page reflects the most recent revision.
          </p>
        </Section>

        <Section id="contact" title="12. Contact Us" icon={Mail} sectionRefs={sectionRefs}>
          <p>For privacy-related questions, requests, or concerns:</p>
          <ContactCard email="[email protected]" subject="General privacy inquiries & data requests" Icon={Mail} color={C.purple}/>
          <ContactCard email="[email protected]" subject="Report a security issue" Icon={Shield} color={C.red}/>
          <ContactCard email="[email protected]" subject="Data Protection Officer" Icon={UserCheck} color={C.blue}/>
          <p style={{ marginTop: 14 }}>
            <strong>Mailing address:</strong><br/>
            UaTob, Inc.<br/>
            Attn: Privacy Team<br/>
            [Mailing Address]<br/>
            [City, State, ZIP]
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>EU Representative:</strong> [Name and contact information of EU representative, if applicable]
          </p>
        </Section>

        {/* Footer */}
        <div style={{
          marginTop: 32,
          background: C.surface,
          border: `1.5px solid ${C.border}`,
          borderRadius: 18, padding: "20px",
          display: "flex", gap: 14, alignItems: "flex-start",
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11,
            background: "linear-gradient(135deg, rgba(124,58,237,.18), rgba(124,58,237,.08))",
            border: "1px solid rgba(124,58,237,.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Lock size={18} color={C.purple} strokeWidth={2.2}/>
          </div>
          <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.6 }}>
            We're committed to protecting your privacy and being transparent about how we use your data. If you have any concerns, reach out — we read every message.
          </div>
        </div>

        <div style={{
          textAlign: "center", marginTop: 24,
          paddingTop: 20, borderTop: `1px solid ${C.border}`,
        }}>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11, fontWeight: 700, color: C.textDim,
            letterSpacing: "1.5px", textTransform: "uppercase",
          }}>
            © UaTob, Inc. All rights reserved.
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Helper components ──────────────────────────────────────────────────
function Section({ id, title, icon: Icon, children, sectionRefs }) {
  return (
    <div
      id={id}
      ref={el => { if (sectionRefs?.current) sectionRefs.current[id] = el; }}
      style={{
        marginBottom: 28,
        scrollMarginTop: 80,
        animation: "fadeIn .35s ease both",
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        marginBottom: 14,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "linear-gradient(135deg, rgba(124,58,237,.15), rgba(124,58,237,.05))",
          border: "1px solid rgba(124,58,237,.22)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Icon size={16} color={C.purple} strokeWidth={2.2}/>
        </div>
        <h2 style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 22, fontWeight: 900, color: C.text,
          letterSpacing: "-0.4px", lineHeight: 1.1,
        }}>
          {title}
        </h2>
      </div>
      <div style={{
        fontSize: 14, color: C.textMid, lineHeight: 1.7,
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        {children}
      </div>
    </div>
  );
}

function SubHeading({ icon: Icon, children }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      marginTop: 6, marginBottom: 2,
    }}>
      <Icon size={13} color={C.purple} strokeWidth={2.4}/>
      <span style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 14, fontWeight: 800, color: C.text,
        letterSpacing: "-0.1px",
      }}>
        {children}
      </span>
    </div>
  );
}

function BulletList({ items }) {
  return (
    <ul style={{
      listStyle: "none", padding: 0, margin: 0,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      {items.map((item, i) => (
        <li key={i} style={{
          display: "flex", gap: 10, alignItems: "flex-start",
          fontSize: 14, color: C.textMid, lineHeight: 1.6,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: C.purple, marginTop: 8, flexShrink: 0,
          }}/>
          <span style={{ flex: 1 }}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Callout({ color, icon: Icon, children }) {
  return (
    <div style={{
      background: `${color}10`,
      border: `1.5px solid ${color}40`,
      borderRadius: 14,
      padding: "12px 14px",
      display: "flex", gap: 10, alignItems: "flex-start",
      margin: "4px 0",
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: `${color}20`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <Icon size={14} color={color} strokeWidth={2.4}/>
      </div>
      <div style={{ flex: 1, fontSize: 13, color: color, fontWeight: 500, lineHeight: 1.5 }}>
        {children}
      </div>
    </div>
  );
}

function ContactCard({ email, subject, Icon, color }) {
  return (
    <a
      href={`mailto:${email}`}
      style={{
        display: "flex", gap: 12, alignItems: "center",
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 12, padding: "12px 14px",
        marginBottom: 8,
        textDecoration: "none",
        transition: "all .15s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = `0 4px 12px ${color}20`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = C.border;
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${color}15`,
        border: `1px solid ${color}25`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <Icon size={15} color={color} strokeWidth={2.2}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 800, color: C.text,
          lineHeight: 1.2, marginBottom: 2,
        }}>
          {email}
        </div>
        <div style={{ fontSize: 11.5, color: C.textDim, fontWeight: 500 }}>
          {subject}
        </div>
      </div>
      <ChevronRight size={14} color={C.textDim} strokeWidth={2.2}/>
    </a>
  );
}
