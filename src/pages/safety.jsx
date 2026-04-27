// src/App/UaTob/Safety.jsx
import React, { useState } from "react";
import {
  Shield, Phone, AlertTriangle, MapPin, Users, Car,
  Eye, Share2, MessageCircle, Lock, CheckCircle, ArrowRight,
  ChevronRight, ChevronDown, Mail, Clock, Star, FileText,
  UserCheck, Headphones, Zap, Heart, Camera, Bell,
  ShieldCheck, AlertCircle, ExternalLink,
} from "lucide-react";
import { THEME as T } from "@/App/UaTob/pricing.js";

// ── Constants ─────────────────────────────────────────────
const ACCENT = "#16A34A";
const RED = "#DC2626";
const BLUE = "#2563EB";
const PURPLE = "#7C3AED";
const AMBER = "#D97706";

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

function Heading({ children, size = "26px" }) {
  return (
    <h2 style={{
      margin: "0 0 8px",
      fontSize: size, fontWeight: 900, color: T.text,
      letterSpacing: "-0.5px", lineHeight: 1.15,
    }}>
      {children}
    </h2>
  );
}

function Body({ children }) {
  return (
    <p style={{
      margin: "0 0 16px", fontSize: 14, color: T.textMuted,
      lineHeight: 1.7,
    }}>
      {children}
    </p>
  );
}

// ── Feature card (large) ──────────────────────────────────
function FeatureCard({ Icon, color, title, desc, items }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${color}06, ${color}01)`,
      border: `1.5px solid ${color}25`,
      borderRadius: 18,
      padding: "20px",
      position: "relative",
      overflow: "hidden",
      transition: "all .25s",
    }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = `0 8px 24px ${color}18`;
        e.currentTarget.style.borderColor = `${color}50`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "";
        e.currentTarget.style.borderColor = `${color}25`;
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: `linear-gradient(135deg, ${color}, ${color}DD)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 12,
        boxShadow: `0 6px 16px ${color}40`,
      }}>
        <Icon size={20} color="#fff" strokeWidth={2.2}/>
      </div>
      <div style={{
        fontSize: 15, fontWeight: 800, color: T.text,
        marginBottom: 6, letterSpacing: "-0.2px",
      }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6, marginBottom: items?.length ? 12 : 0 }}>
        {desc}
      </div>
      {items && items.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((item, i) => (
            <li key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              fontSize: 12.5, color: T.text, fontWeight: 500,
              padding: "4px 0", lineHeight: 1.5,
            }}>
              <CheckCircle size={12} color={color} strokeWidth={2.6} style={{ marginTop: 3, flexShrink: 0 }}/>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Step row ──────────────────────────────────────────────
function StepRow({ num, title, desc, color, isLast }) {
  return (
    <div style={{
      display: "flex", gap: 14,
      paddingBottom: isLast ? 0 : 18,
      position: "relative",
    }}>
      {/* Connecting line */}
      {!isLast && (
        <div style={{
          position: "absolute",
          left: 17, top: 36, bottom: 0,
          width: 2,
          background: `linear-gradient(180deg, ${color}40, ${color}10)`,
        }}/>
      )}

      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        background: `linear-gradient(135deg, ${color}, ${color}DD)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        boxShadow: `0 4px 12px ${color}40`,
        position: "relative", zIndex: 1,
      }}>
        <span style={{
          fontSize: 13, fontWeight: 900, color: "#fff",
          fontVariantNumeric: "tabular-nums",
        }}>
          {num}
        </span>
      </div>
      <div style={{ flex: 1, paddingTop: 6 }}>
        <div style={{
          fontSize: 14, fontWeight: 800, color: T.text,
          marginBottom: 3, letterSpacing: "-0.1px",
        }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6 }}>
          {desc}
        </div>
      </div>
    </div>
  );
}

// ── Collapsible safety tip ────────────────────────────────
function SafetyTip({ q, a, color = ACCENT, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      background: open ? `${color}05` : T.surface ?? "#FFFFFF",
      border: `1px solid ${open ? `${color}30` : T.border}`,
      borderRadius: 12,
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
          gap: 12, padding: "12px 14px",
          textAlign: "left", fontFamily: "inherit",
        }}
      >
        <span style={{
          fontSize: 13, fontWeight: 700, color: T.text,
          lineHeight: 1.4, flex: 1,
        }}>
          {q}
        </span>
        <div style={{
          width: 22, height: 22, borderRadius: "50%",
          background: open ? color : `${color}12`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, transition: "all .25s",
        }}>
          <ChevronDown
            size={12}
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
          padding: "0 14px 12px",
          borderTop: `1px solid ${color}15`,
          marginTop: -1,
        }}>
          <p style={{
            margin: "10px 0 0",
            fontSize: 12.5, color: T.textMuted, lineHeight: 1.65,
          }}>
            {a}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────
export default function Safety() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 4px", fontFamily: "inherit" }}>
      <style>{`
        @keyframes safPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,.4); } 50% { box-shadow: 0 0 0 12px rgba(220,38,38,0); } }
        @keyframes safFadeUp { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
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
        <div style={{
          position: "absolute", top: -60, right: -60,
          width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(22,163,74,0.20) 0%, transparent 70%)",
          pointerEvents: "none",
        }}/>
        <div style={{
          position: "absolute", inset: 0,
          background: "repeating-linear-gradient(45deg,transparent,transparent 60px,rgba(22,163,74,.04) 60px,rgba(22,163,74,.04) 61px)",
          pointerEvents: "none",
        }}/>

        <div style={{ position: "relative" }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: `linear-gradient(135deg, ${ACCENT}, #15803D)`,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 16,
            boxShadow: "0 12px 28px rgba(22,163,74,.4)",
          }}>
            <ShieldCheck size={30} color="#fff" strokeWidth={2.2}/>
          </div>

          <h1 style={{
            margin: 0, fontSize: 36, fontWeight: 900, color: T.text,
            letterSpacing: "-1px", lineHeight: 1.1, marginBottom: 12,
          }}>
            Your safety,{" "}
            <span style={{
              background: "linear-gradient(135deg, #22C55E, #16A34A 60%, #15803D)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              built in
            </span>
          </h1>

          <p style={{
            margin: "0 auto 20px", fontSize: 14.5, color: T.textMuted,
            lineHeight: 1.65, maxWidth: 480,
          }}>
            Every trip on UaTob is backed by features and policies designed to keep riders and drivers safe — from background checks to GPS tracking to 24/7 support.
          </p>

          <div style={{
            display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap",
          }}>
            {[
              { Icon: UserCheck,  text: "Background-checked drivers" },
              { Icon: MapPin,     text: "Live GPS tracking" },
              { Icon: Headphones, text: "24/7 support" },
            ].map(({ Icon, text }) => (
              <div key={text} style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "rgba(255,255,255,0.85)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(22,163,74,.2)",
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

      {/* ── Emergency CTA (UNMISSABLE) ── */}
      <div style={{
        background: "linear-gradient(135deg, #FEF2F2, #FEE2E2)",
        border: `2px solid ${RED}`,
        borderRadius: 20,
        padding: "20px 22px",
        marginBottom: 32,
        boxShadow: "0 12px 32px rgba(220,38,38,0.18)",
        display: "flex", gap: 14, alignItems: "center",
        flexWrap: "wrap",
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: `linear-gradient(135deg, #EF4444, ${RED})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          animation: "safPulse 2s ease-in-out infinite",
        }}>
          <AlertTriangle size={26} color="#fff" strokeWidth={2.4}/>
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{
            fontSize: 11, fontWeight: 800, color: RED,
            letterSpacing: "0.1em", textTransform: "uppercase",
            marginBottom: 3,
          }}>
            In an emergency
          </div>
          <div style={{
            fontSize: 18, fontWeight: 900, color: "#7F1D1D",
            letterSpacing: "-0.3px", lineHeight: 1.2,
            marginBottom: 4,
          }}>
            Call 911 immediately
          </div>
          <div style={{ fontSize: 12.5, color: "#991B1B", fontWeight: 600, lineHeight: 1.5 }}>
            UaTob is not a substitute for emergency services. If you or someone near you is in immediate danger, contact authorities first.
          </div>
        </div>

        <a
          href="tel:911"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "13px 20px",
            background: `linear-gradient(135deg, #EF4444, ${RED})`,
            color: "#fff",
            borderRadius: 100,
            fontSize: 14, fontWeight: 800,
            letterSpacing: "0.2px",
            textDecoration: "none",
            boxShadow: "0 8px 20px rgba(220,38,38,0.4)",
            transition: "all .15s",
            flexShrink: 0,
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
          <Phone size={15} fill="#fff" strokeWidth={2.4}/>
          Call 911
        </a>
      </div>

      {/* ── Built-in safety features ── */}
      <div style={{ marginBottom: 36 }}>
        <SectionLabel>Safety features</SectionLabel>
        <Heading>Built into every ride</Heading>
        <Body>
          From the moment you open the app to the second you arrive, UaTob runs continuous safety checks behind the scenes.
        </Body>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 12, marginTop: 18,
        }}>
          <FeatureCard
            Icon={MapPin}
            color={ACCENT}
            title="Live GPS Tracking"
            desc="Every trip is GPS-tracked from pickup to drop-off."
            items={[
              "Real-time location for both rider and driver",
              "Trip route recorded for accountability",
              "Anonymous to other users — only you see your location",
            ]}
          />

          <FeatureCard
            Icon={Share2}
            color={BLUE}
            title="Share Your Trip"
            desc="Send live trip details to anyone you trust."
            items={[
              "Driver name, photo, plate, vehicle",
              "Live route and ETA",
              "Trip status updates as you go",
            ]}
          />

          <FeatureCard
            Icon={UserCheck}
            color={PURPLE}
            title="Verified Drivers"
            desc="Every driver passes multi-step verification before their first ride."
            items={[
              "Criminal background check",
              "Motor vehicle records review",
              "Identity & document verification",
              "Annual re-verification",
            ]}
          />

          <FeatureCard
            Icon={Phone}
            color={AMBER}
            title="Anonymous Calling"
            desc="Driver and rider phone numbers are never shared."
            items={[
              "Calls routed through our system",
              "Numbers stay private to both parties",
              "In-app messaging always available",
            ]}
          />

          <FeatureCard
            Icon={Star}
            color="#EAB308"
            title="Two-Way Ratings"
            desc="Riders rate drivers. Drivers rate riders. Accountability flows both ways."
            items={[
              "Every trip ends with a 1–5 star rating",
              "Low-rated accounts are reviewed",
              "Anonymous to the other party",
            ]}
          />

          <FeatureCard
            Icon={Bell}
            color="#0891B2"
            title="RideCheck"
            desc="Our system flags unusual activity automatically."
            items={[
              "Unexpected stops detected via GPS",
              "Long route deviations flagged",
              "We reach out to confirm you're okay",
            ]}
          />
        </div>
      </div>

      {/* ── For Riders ── */}
      <div style={{ marginBottom: 32 }}>
        <SectionLabel color={BLUE}>For riders</SectionLabel>
        <Heading>How to ride safely</Heading>
        <Body>
          A few simple steps before, during, and after every trip.
        </Body>

        <div style={{
          background: T.surface ?? "#FFFFFF",
          border: `1.5px solid ${T.border}`,
          borderRadius: 20,
          padding: "22px",
          marginTop: 18,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 800, color: BLUE,
            letterSpacing: "0.1em", textTransform: "uppercase",
            marginBottom: 16,
          }}>
            Before You Get In
          </div>

          <StepRow
            num="1"
            color={BLUE}
            title="Verify the vehicle"
            desc="Match the license plate, make, model, and color shown in the app to the car arriving for you. If anything's off, don't get in."
          />
          <StepRow
            num="2"
            color={BLUE}
            title="Confirm your driver's name"
            desc="Ask 'Who are you here to pick up?' — let the driver say your name first. Never share it before they do."
          />
          <StepRow
            num="3"
            color={BLUE}
            title="Check the driver's photo"
            desc="The face you see in the app should match the person behind the wheel. Photos update with each verification."
          />
          <StepRow
            num="4"
            color={BLUE}
            title="Sit in the back seat"
            desc="When riding solo, the back seat gives both you and the driver more personal space."
            isLast
          />
        </div>

        <div style={{
          background: `${BLUE}06`,
          border: `1.5px solid ${BLUE}25`,
          borderRadius: 18,
          padding: "20px 22px",
          marginTop: 12,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 800, color: BLUE,
            letterSpacing: "0.1em", textTransform: "uppercase",
            marginBottom: 16,
          }}>
            During Your Trip
          </div>
          <StepRow
            num="5"
            color={BLUE}
            title="Share your trip"
            desc="Tap 'Share Trip' to send your live route, driver info, and ETA to a friend or family member."
          />
          <StepRow
            num="6"
            color={BLUE}
            title="Trust your gut"
            desc="If something feels wrong, ask the driver to pull over to a safe, public place. You can end the ride anytime."
          />
          <StepRow
            num="7"
            color={BLUE}
            title="Use in-app chat & calling"
            desc="Communicate with your driver through the app — your phone number stays private."
            isLast
          />
        </div>
      </div>

      {/* ── For Drivers ── */}
      <div style={{ marginBottom: 32 }}>
        <SectionLabel color={ACCENT}>For drivers</SectionLabel>
        <Heading>How to drive safely</Heading>
        <Body>
          Your safety matters as much as your riders'. Here's how UaTob has your back.
        </Body>

        <div style={{
          background: T.surface ?? "#FFFFFF",
          border: `1.5px solid ${T.border}`,
          borderRadius: 20,
          padding: "22px",
          marginTop: 18,
        }}>
          <StepRow
            num="1"
            color={ACCENT}
            title="Confirm rider identity"
            desc="When the rider gets in, ask for their first name. The app shows you their name once they're matched."
          />
          <StepRow
            num="2"
            color={ACCENT}
            title="Inspect your vehicle daily"
            desc="Check tires, lights, fluid levels, and seat belts before you go online. Report any issues immediately."
          />
          <StepRow
            num="3"
            color={ACCENT}
            title="Take regular breaks"
            desc="UaTob enforces a maximum 12-hour driving window. Pull over to rest if you feel tired — your earnings can wait."
          />
          <StepRow
            num="4"
            color={ACCENT}
            title="Never accept off-app trips"
            desc="If a rider asks you to take them somewhere outside the app's route, decline. Only app-routed trips are insured."
          />
          <StepRow
            num="5"
            color={ACCENT}
            title="Use the in-app emergency button"
            desc="Tap the shield icon to instantly share your location with UaTob support and emergency contacts."
            isLast
          />
        </div>
      </div>

      {/* ── Driver verification process ── */}
      <div style={{ marginBottom: 32 }}>
        <SectionLabel color={PURPLE}>Trust & verification</SectionLabel>
        <Heading>How we vet our drivers</Heading>
        <Body>
          Before a single rider gets in their car, every UaTob driver passes a multi-step verification process.
        </Body>

        <div style={{
          background: `linear-gradient(135deg, ${PURPLE}06, ${PURPLE}01)`,
          border: `1.5px solid ${PURPLE}25`,
          borderRadius: 20,
          padding: "22px",
          marginTop: 18,
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: -40, right: -40,
            width: 140, height: 140, borderRadius: "50%",
            background: `radial-gradient(circle, ${PURPLE}15 0%, transparent 70%)`,
            pointerEvents: "none",
          }}/>

          <div style={{ position: "relative" }}>
            {[
              { Icon: FileText,   title: "Identity verification",      desc: "Government-issued ID, driver's license, and selfie matching." },
              { Icon: Shield,     title: "Background check",            desc: "National criminal database + multi-state county searches via accredited vendor." },
              { Icon: Car,        title: "Vehicle inspection",          desc: "Annual inspection + verified registration and active insurance on file." },
              { Icon: UserCheck,  title: "Motor vehicle records",       desc: "DMV record review for moving violations, license status, and driving history." },
              { Icon: Camera,     title: "Real-time face match",        desc: "Periodic in-app selfie checks confirm the active driver is the verified driver." },
            ].map((item, i, arr) => {
              const Icon = item.Icon;
              return (
                <div key={i} style={{
                  display: "flex", gap: 12, alignItems: "flex-start",
                  padding: "12px 0",
                  borderBottom: i < arr.length - 1 ? `1px solid ${PURPLE}15` : "none",
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE}DD)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    boxShadow: `0 4px 10px ${PURPLE}30`,
                  }}>
                    <Icon size={15} color="#fff" strokeWidth={2.2}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13.5, fontWeight: 800, color: T.text,
                      marginBottom: 3,
                    }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.55 }}>
                      {item.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Reporting an incident ── */}
      <div style={{ marginBottom: 32 }}>
        <SectionLabel color={AMBER}>Incident reporting</SectionLabel>
        <Heading>If something goes wrong</Heading>
        <Body>
          We take every report seriously. Here's how to reach us.
        </Body>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 12, marginTop: 18,
        }}>
          {[
            {
              Icon: AlertTriangle,
              color: RED,
              urgency: "Immediate danger",
              title: "Call 911",
              desc: "If you or someone else is in immediate danger.",
              cta: "Call 911",
              href: "tel:911",
            },
            {
              Icon: Bell,
              color: AMBER,
              urgency: "Active trip",
              title: "Tap shield icon",
              desc: "Sends your live location to UaTob safety team & contacts.",
              cta: "Open app",
              href: null,
            },
            {
              Icon: Mail,
              color: BLUE,
              urgency: "After your trip",
              title: "Report from history",
              desc: "Tap any past ride → Report an issue → describe what happened.",
              cta: "support@uatob.com",
              href: "mailto:[email protected]",
            },
            {
              Icon: ShieldCheck,
              color: PURPLE,
              urgency: "Serious safety concern",
              title: "Email the safety team",
              desc: "We respond to safety reports within 4 hours, 24/7.",
              cta: "[email protected]",
              href: "mailto:[email protected]",
            },
          ].map((item, i) => {
            const Icon = item.Icon;
            return (
              <a
                key={i}
                href={item.href || undefined}
                style={{
                  background: T.surface ?? "#FFFFFF",
                  border: `1.5px solid ${T.border}`,
                  borderRadius: 16,
                  padding: 18,
                  display: "flex", flexDirection: "column", gap: 10,
                  textDecoration: "none",
                  transition: "all .2s",
                  cursor: item.href ? "pointer" : "default",
                  position: "relative",
                  overflow: "hidden",
                }}
                onMouseEnter={e => {
                  if (!item.href) return;
                  e.currentTarget.style.borderColor = item.color;
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = `0 8px 20px ${item.color}20`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = T.border;
                  e.currentTarget.style.transform = "";
                  e.currentTarget.style.boxShadow = "";
                }}
              >
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  marginBottom: 4,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9,
                    background: `linear-gradient(135deg, ${item.color}, ${item.color}DD)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    boxShadow: `0 4px 10px ${item.color}40`,
                  }}>
                    <Icon size={14} color="#fff" strokeWidth={2.4}/>
                  </div>
                  <div style={{
                    fontSize: 9.5, fontWeight: 800, color: item.color,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                  }}>
                    {item.urgency}
                  </div>
                </div>
                <div>
                  <div style={{
                    fontSize: 14, fontWeight: 800, color: T.text,
                    marginBottom: 4, letterSpacing: "-0.1px",
                  }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.55 }}>
                    {item.desc}
                  </div>
                </div>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 12, fontWeight: 700, color: item.color,
                  marginTop: "auto",
                  paddingTop: 8,
                  borderTop: `1px solid ${T.border}`,
                }}>
                  {item.cta}
                  {item.href && <ArrowRight size={11} strokeWidth={2.4}/>}
                </div>
              </a>
            );
          })}
        </div>
      </div>

      {/* ── Safety FAQ ── */}
      <div style={{ marginBottom: 32 }}>
        <SectionLabel>Common questions</SectionLabel>
        <Heading>Safety FAQ</Heading>

        <div style={{ marginTop: 18 }}>
          <SafetyTip
            defaultOpen
            q="What happens if I report an unsafe driver?"
            a="Reports go directly to our safety team. We review trip data, GPS records, and any messages. While we investigate, the driver is suspended from the platform. Confirmed violations result in permanent removal."
          />
          <SafetyTip
            q="Are my conversations recorded?"
            a="In-app messages are stored securely for safety review. Phone calls routed through our system are not recorded by default but the call may be logged for fraud prevention. We never sell or share message content with third parties."
          />
          <SafetyTip
            q="What insurance covers my ride?"
            a="UaTob carries commercial liability coverage that activates when a driver is en route to or with a passenger. Drivers also carry their own personal auto insurance. See our Driver Terms for full coverage details by trip phase."
          />
          <SafetyTip
            q="Can I request a specific driver gender?"
            a="At this time, we don't offer driver-gender preferences. We're actively researching how to add safety options like this in a way that's fair to all drivers and riders. We welcome your feedback at support@uatob.com."
          />
          <SafetyTip
            q="What if my driver makes me uncomfortable?"
            a="You can end any ride at any time by asking the driver to pull over in a safe, public place. Then report the trip in the app and rate the driver accordingly. Our team reviews every 1–3 star rating."
          />
          <SafetyTip
            q="How do I share my trip with someone?"
            a="During an active trip, tap the share icon in the app. It generates a live link showing your driver, vehicle, and route. The link expires automatically when the trip ends."
          />
        </div>
      </div>

      {/* ── Closing care card ── */}
      <div style={{
        background: T.surface ?? "#FFFFFF",
        border: `1.5px solid ${T.border}`,
        borderRadius: 18,
        padding: "20px 22px",
        marginTop: 16, marginBottom: 32,
        display: "flex", gap: 14, alignItems: "center",
        flexWrap: "wrap",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: `linear-gradient(135deg, #EF4444, #DC2626)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 6px 16px rgba(220,38,38,.3)",
        }}>
          <Heart size={22} color="#fff" fill="#fff" strokeWidth={2}/>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{
            fontSize: 15, fontWeight: 900, color: T.text,
            letterSpacing: "-0.2px", marginBottom: 4,
          }}>
            We're here, 24/7
          </div>
          <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.6 }}>
            Our safety team monitors trips and reports around the clock. Reach us anytime at{" "}
            <a href="mailto:[email protected]" style={{
              color: ACCENT, fontWeight: 800, textDecoration: "none",
              borderBottom: `1px dotted ${ACCENT}`,
            }}>
              [email protected]
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
