// src/App/Legal/DriverTerms.jsx
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import {
  ArrowLeft, FileText, Shield, DollarSign, Car, AlertTriangle,
  Scale, CheckCircle, ChevronRight, Mail, Calendar, Lock,
  Users, Ban, Gavel, RefreshCw, Phone,
} from "lucide-react";

const C = {
  bg: "#FAFAF7", surface: "#FFFFFF", surfaceRaised: "#F9FAF7",
  surfaceBright: "#F3F4F0", border: "#E8E6DD", borderBright: "#D8D5CC",
  accent: "#16A34A", accentDim: "#15803D", accentGlow: "rgba(22,163,74,.1)",
  accentBorder: "rgba(22,163,74,.22)", text: "#0F0F10", textMid: "#5A5A52",
  textDim: "#9A988E", red: "#DC2626", blue: "#2563EB",
};

const LAST_UPDATED = "April 1, 2026";
const EFFECTIVE_DATE = "April 1, 2026";

const SECTIONS = [
  { id: "acceptance",      label: "Acceptance of Terms",       icon: CheckCircle },
  { id: "eligibility",     label: "Driver Eligibility",        icon: Shield },
  { id: "relationship",    label: "Independent Contractor",    icon: Users },
  { id: "vehicle",         label: "Vehicle Requirements",      icon: Car },
  { id: "fares",           label: "Fares & Earnings",          icon: DollarSign },
  { id: "conduct",         label: "Driver Conduct",            icon: Scale },
  { id: "ratings",         label: "Ratings & Deactivation",    icon: AlertTriangle },
  { id: "liability",       label: "Liability & Insurance",     icon: Lock },
  { id: "termination",     label: "Termination",               icon: Ban },
  { id: "disputes",        label: "Disputes & Arbitration",    icon: Gavel },
  { id: "changes",         label: "Changes to These Terms",    icon: RefreshCw },
  { id: "contact",         label: "Contact Information",       icon: Phone },
];

export default function DriverTerms() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const [tocOpen, setTocOpen] = useState(false);
  const sectionRefs = useRef({});

  // Track which section is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
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
        @keyframes slideRight { from { opacity: 0; transform: translateX(-12px) } to { opacity: 1; transform: translateX(0) } }
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
            onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
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
              Driver Terms of Service
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTocOpen(o => !o)}
            style={{
              background: tocOpen ? C.accent : C.surface,
              border: `1px solid ${tocOpen ? C.accent : C.border}`,
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
          background: "linear-gradient(135deg,#F0FDF4,#DCFCE7,#F0FDF4)",
          border: "1.5px solid rgba(22,163,74,.28)",
          borderRadius: 22, padding: "24px 22px",
          marginBottom: 22,
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: -50, right: -50,
            width: 180, height: 180, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(22,163,74,.18) 0%, transparent 70%)",
            pointerEvents: "none",
          }}/>
          <div style={{ position: "relative" }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: "linear-gradient(135deg,#22C55E,#16A34A)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 14,
              boxShadow: "0 8px 20px rgba(22,163,74,.35)",
            }}>
              <FileText size={22} color="#fff" strokeWidth={2.2}/>
            </div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 28, fontWeight: 900, color: C.text,
              letterSpacing: "-0.5px", lineHeight: 1.1, marginBottom: 8,
            }}>
              Driver Terms of Service
            </div>
            <div style={{ fontSize: 13.5, color: C.textMid, lineHeight: 1.6, marginBottom: 14 }}>
              These Terms govern your use of the UaTob Driver platform. Please read carefully — by signing up, you agree to be bound by them.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(22,163,74,.18)",
                borderRadius: 100, padding: "5px 10px",
                fontSize: 11, fontWeight: 700, color: "#15803D",
              }}>
                <Calendar size={11} strokeWidth={2.4}/>
                Effective {EFFECTIVE_DATE}
              </div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(22,163,74,.18)",
                borderRadius: 100, padding: "5px 10px",
                fontSize: 11, fontWeight: 700, color: "#15803D",
              }}>
                <RefreshCw size={11} strokeWidth={2.4}/>
                Last updated {LAST_UPDATED}
              </div>
            </div>
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
                    background: isActive ? C.accentGlow : "transparent",
                    cursor: "pointer", fontFamily: "inherit",
                    color: isActive ? C.accent : C.text,
                    transition: "background .12s",
                    textAlign: "left",
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.surfaceBright; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{
                    width: 26, height: 26, borderRadius: 7,
                    background: isActive ? C.accent : C.surfaceBright,
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
        <Section id="acceptance" title="1. Acceptance of Terms" icon={CheckCircle} sectionRefs={sectionRefs}>
          <p>
            Welcome to UaTob. These Driver Terms of Service ("<strong>Terms</strong>") form a legally binding agreement between you ("<strong>Driver</strong>", "you", or "your") and UaTob, Inc. ("<strong>UaTob</strong>", "we", "us", or "our") governing your access to and use of the UaTob platform, including our mobile application, website, and related services (collectively, the "<strong>Platform</strong>").
          </p>
          <p>
            By creating a Driver account, completing the signup process, or using the Platform in any way, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you do not agree, you must not use the Platform.
          </p>
          <Callout color={C.blue} icon={AlertTriangle}>
            You must be at least 21 years old to drive on UaTob. By accepting these Terms, you represent that you meet this requirement.
          </Callout>
        </Section>

        <Section id="eligibility" title="2. Driver Eligibility" icon={Shield} sectionRefs={sectionRefs}>
          <p>To qualify and remain eligible as a Driver on UaTob, you must:</p>
          <BulletList items={[
            "Be at least 21 years of age",
            "Hold a valid driver's license issued in your state of residence for at least one (1) year",
            "Have legal authorization to work in the United States",
            "Pass a background check, motor vehicle records check, and ongoing reviews",
            "Maintain valid auto insurance meeting your state's minimum requirements (and UaTob's coverage requirements)",
            "Own or have legal authorization to drive the vehicle you register on the Platform",
            "Provide accurate, current, and complete information during signup and at all times",
            "Comply with all applicable federal, state, and local laws",
          ]} />
          <p>
            UaTob reserves the right to deny, suspend, or terminate Driver accounts at our sole discretion if any eligibility requirement is not met or maintained.
          </p>
        </Section>

        <Section id="relationship" title="3. Independent Contractor Relationship" icon={Users} sectionRefs={sectionRefs}>
          <p>
            You acknowledge and agree that you are an <strong>independent contractor</strong> and not an employee, agent, joint venturer, or partner of UaTob. Nothing in these Terms creates an employer-employee relationship between you and UaTob.
          </p>
          <p>As an independent contractor:</p>
          <BulletList items={[
            "You control when, where, and how often you accept ride requests",
            "You are responsible for all expenses related to your driving (fuel, maintenance, tolls, etc.)",
            "You are solely responsible for your own taxes, including self-employment taxes",
            "You will not receive employee benefits such as health insurance, paid time off, or retirement plans",
            "You may engage in other work, including driving for competing platforms, when not actively on a UaTob trip",
          ]} />
          <Callout color="#D97706" icon={AlertTriangle}>
            UaTob will issue Form 1099-K or 1099-NEC, as applicable, for tax reporting. You should consult a tax professional regarding your tax obligations.
          </Callout>
        </Section>

        <Section id="vehicle" title="4. Vehicle Requirements" icon={Car} sectionRefs={sectionRefs}>
          <p>All vehicles operated on the UaTob Platform must meet our standards:</p>
          <BulletList items={[
            "Model year 2010 or newer (2015 or newer for Premium tier)",
            "Four (4) doors with seating for four or more passengers",
            "Pass an annual vehicle inspection",
            "Be in safe, working mechanical condition with no cosmetic damage that would impair the rider experience",
            "Display valid registration and license plates issued in the state where you operate",
            "Be covered by valid auto insurance at all times",
            "Not be branded with conflicting commercial signage from competing platforms",
          ]} />
          <p>
            You agree to keep your vehicle clean, well-maintained, and free of strong odors. You must report any accidents, damage, or significant mechanical issues to UaTob within 24 hours.
          </p>
        </Section>

        <Section id="fares" title="5. Fares & Earnings" icon={DollarSign} sectionRefs={sectionRefs}>
          <p>
            UaTob calculates fares dynamically based on factors including base fare, distance, duration, demand, time of day, and ride tier. Fares are quoted to riders before booking and are binding once a ride begins.
          </p>
          <BulletList items={[
            <span key="1"><strong>Driver share:</strong> You earn 75% of the total fare on each completed ride. UaTob retains 25% as a platform service fee.</span>,
            <span key="2"><strong>Tips:</strong> 100% of all rider tips go directly to you. UaTob does not take a cut of tips.</span>,
            <span key="3"><strong>Surge pricing:</strong> When demand exceeds supply, fares may increase. Surge multipliers are applied to the entire fare and your 75% share scales proportionally.</span>,
            <span key="4"><strong>Cancellation fees:</strong> If a rider cancels after you have begun the trip to pickup, you may receive a cancellation fee, less the platform fee.</span>,
            <span key="5"><strong>Payouts:</strong> Earnings are deposited to your connected bank account within 24 hours of each completed ride. You may also request instant payouts subject to applicable fees.</span>,
            <span key="6"><strong>Adjustments:</strong> UaTob may adjust fares for legitimate disputes, route changes, fraud, or technical errors.</span>,
          ]} />
          <Callout color={C.accent} icon={CheckCircle}>
            We process payouts via Stripe Connect. You agree to Stripe's Connected Account Agreement as part of accepting these Terms.
          </Callout>
        </Section>

        <Section id="conduct" title="6. Driver Conduct" icon={Scale} sectionRefs={sectionRefs}>
          <p>While using the Platform, you agree to:</p>
          <BulletList items={[
            "Drive safely and obey all traffic laws",
            "Treat all riders with respect, courtesy, and professionalism",
            "Take the most direct, efficient route unless the rider requests otherwise",
            "Not discriminate against any rider on the basis of race, ethnicity, national origin, religion, gender, gender identity, sexual orientation, age, disability, or any protected characteristic",
            "Not consume alcohol, drugs, or any impairing substances within 8 hours of, or while, providing rides",
            "Maintain a clean, smoke-free vehicle interior at all times",
            "Not transport additional passengers (e.g., friends, family) while a rider is in the vehicle, unless authorized by the rider",
            "Not solicit personal contact information, tips outside the app, or off-platform business from riders",
            "Not record audio or video of riders without explicit consent (where required by state law)",
            "Report any safety incidents, accidents, or harmful rider behavior to UaTob immediately",
          ]} />
          <Callout color={C.red} icon={Ban}>
            Violations of conduct rules — particularly relating to safety, discrimination, or harassment — may result in immediate deactivation without warning.
          </Callout>
        </Section>

        <Section id="ratings" title="7. Ratings & Deactivation" icon={AlertTriangle} sectionRefs={sectionRefs}>
          <p>
            Riders rate Drivers on a 1–5 star scale after each trip. Your rolling average rating is used to evaluate your standing on the Platform.
          </p>
          <BulletList items={[
            "Drivers must maintain a minimum 4.6 average rating across the most recent 100 rides",
            "Falling below the threshold may result in coaching, temporary suspension, or permanent deactivation",
            "Repeated cancellations, no-shows, or low acceptance rates may also result in account action",
            "UaTob reserves the right to deactivate accounts immediately for safety or legal violations, regardless of rating",
            "Deactivated drivers may appeal through our support channels — appeals are reviewed within 7 business days",
          ]} />
        </Section>

        <Section id="liability" title="8. Liability & Insurance" icon={Lock} sectionRefs={sectionRefs}>
          <p>
            <strong>You</strong> are required to maintain your own valid auto insurance that meets your state's minimum coverage requirements. UaTob provides supplemental commercial coverage that activates during specific trip phases:
          </p>
          <BulletList items={[
            <span key="1"><strong>Period 1 (App on, no ride):</strong> Contingent liability coverage of up to $50,000/$100,000/$25,000.</span>,
            <span key="2"><strong>Period 2 (En route to pickup):</strong> $1,000,000 third-party liability coverage.</span>,
            <span key="3"><strong>Period 3 (Rider in vehicle):</strong> $1,000,000 third-party liability coverage plus contingent comprehensive and collision (subject to deductible).</span>,
          ]} />
          <p>
            <strong>UaTob will not be liable</strong> for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Platform, including loss of profits, vehicle damage outside covered periods, or personal injury beyond statutory minimums.
          </p>
          <p>
            You agree to indemnify and hold UaTob harmless from any claims arising from your negligent or unlawful acts while using the Platform.
          </p>
        </Section>

        <Section id="termination" title="9. Termination" icon={Ban} sectionRefs={sectionRefs}>
          <p>
            <strong>By you:</strong> You may stop driving at any time. To permanently close your account, contact us at <a href="mailto:[email protected]" style={{ color: C.accent, fontWeight: 700, textDecoration: "none" }}>[email protected]</a>.
          </p>
          <p>
            <strong>By UaTob:</strong> We may suspend or terminate your account at any time, with or without notice, for any reason, including but not limited to:
          </p>
          <BulletList items={[
            "Violation of these Terms or applicable laws",
            "Failing to maintain eligibility requirements",
            "Safety concerns, fraud, or misuse of the Platform",
            "Extended inactivity (over 12 months without a completed ride)",
            "Decommissioning of the Platform",
          ]} />
          <p>
            Upon termination, your access ends immediately, but provisions related to liability, indemnification, and dispute resolution survive.
          </p>
        </Section>

        <Section id="disputes" title="10. Disputes & Arbitration" icon={Gavel} sectionRefs={sectionRefs}>
          <Callout color="#D97706" icon={AlertTriangle}>
            <strong>Important:</strong> This section requires you to resolve disputes with UaTob through binding individual arbitration and waives your right to participate in a class action.
          </Callout>
          <p>
            Any dispute, claim, or controversy arising out of or relating to these Terms or your use of the Platform shall be resolved exclusively through final and binding arbitration administered by the American Arbitration Association under its Commercial Arbitration Rules.
          </p>
          <BulletList items={[
            "Arbitration is conducted in your state of residence (or via video conference)",
            "Each party bears its own costs unless statute or arbitrator decides otherwise",
            "You waive any right to a jury trial or to participate in a class action",
            "Small-claims court actions for amounts within that court's jurisdiction are excluded",
            <span key="opt"><strong>Opt-out:</strong> You may opt out of arbitration within 30 days of accepting these Terms by emailing <a href="mailto:[email protected]" style={{ color: C.accent, fontWeight: 700, textDecoration: "none" }}>[email protected]</a> with your full legal name and a clear statement of opt-out.</span>,
          ]} />
        </Section>

        <Section id="changes" title="11. Changes to These Terms" icon={RefreshCw} sectionRefs={sectionRefs}>
          <p>
            UaTob may update these Terms from time to time. Material changes will be communicated via email or in-app notification at least 30 days before they take effect. Your continued use of the Platform after the effective date constitutes acceptance of the revised Terms.
          </p>
          <p>
            If you do not agree to the changes, you must stop using the Platform and may close your account.
          </p>
        </Section>

        <Section id="contact" title="12. Contact Information" icon={Phone} sectionRefs={sectionRefs}>
          <p>For questions, support, or legal inquiries:</p>
          <ContactCard email="[email protected]" subject="General driver questions" Icon={Mail} color={C.blue}/>
          <ContactCard email="[email protected]" subject="Legal & arbitration matters" Icon={Gavel} color={C.text}/>
          <ContactCard email="[email protected]" subject="Privacy & data requests" Icon={Lock} color={C.accent}/>
          <p style={{ marginTop: 14 }}>
            <strong>Mailing address:</strong><br/>
            UaTob, Inc.<br/>
            Legal Department<br/>
            [Mailing Address]<br/>
            [City, State, ZIP]
          </p>
        </Section>

        {/* Footer acknowledgment */}
        <div style={{
          marginTop: 32,
          background: C.surface,
          border: `1.5px solid ${C.border}`,
          borderRadius: 18, padding: "20px",
          display: "flex", gap: 14, alignItems: "flex-start",
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11,
            background: "linear-gradient(135deg, rgba(22,163,74,.18), rgba(22,163,74,.08))",
            border: "1px solid rgba(22,163,74,.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <CheckCircle size={18} color={C.accent} strokeWidth={2.2}/>
          </div>
          <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.6 }}>
            By signing up as a Driver on UaTob, you acknowledge that you have read these Terms in full,
            understand them, and agree to be bound by them. Keep a copy for your records.
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
          background: "linear-gradient(135deg, rgba(22,163,74,.15), rgba(22,163,74,.05))",
          border: "1px solid rgba(22,163,74,.22)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Icon size={16} color={C.accent} strokeWidth={2.2}/>
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
            background: C.accent, marginTop: 8, flexShrink: 0,
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
