// src/App/UaTob/FAQ.jsx
import React, { useState, useMemo } from "react";
import {
  HelpCircle, Search, Users, Car, DollarSign, Shield,
  MessageCircle, ChevronDown, X, Sparkles, TrendingUp,
  Mail, Phone, MapPin, Clock, CheckCircle, ArrowRight,
  Star, FileText, Zap, Lock, Heart,
} from "lucide-react";
import { THEME as T } from "@/App/UaTob/pricing.js";

// ── Constants ─────────────────────────────────────────────
const ACCENT = "#16A34A";
const BLUE = "#2563EB";
const PURPLE = "#7C3AED";
const AMBER = "#D97706";
const RED = "#DC2626";

// ── FAQ data ──────────────────────────────────────────────
const FAQ_DATA = [
  // ── RIDERS ──
  {
    category: "riders",
    q: "How does UaTob work?",
    a: "Open the UaTob app, enter your destination, pick a ride tier (Economy, Standard, Premium, or XL), and tap Book. We match you with a nearby driver in seconds. You'll see their name, photo, vehicle, and live location until they arrive — typically 2 to 7 minutes for Standard.",
    popular: true,
  },
  {
    category: "riders",
    q: "How are fares calculated?",
    a: "Every UaTob fare is built from four fixed parts: a base fare (varies by tier), a per-mile rate, a per-minute rate, and a small booking fee. There's no surge or dynamic pricing — the price you see at booking is the price you pay. Visit our Pricing page for the full rate breakdown by tier.",
    popular: true,
  },
  {
    category: "riders",
    q: "Can I cancel a ride?",
    a: "Yes. You can cancel anytime in the app. If you cancel within 2 minutes of booking, there's no fee. After that, a small cancellation fee may apply if a driver was already on the way. The driver receives the cancellation fee minus our platform cut.",
  },
  {
    category: "riders",
    q: "What payment methods do you accept?",
    a: "UaTob accepts all major credit and debit cards, Apple Pay, Google Pay, and Cash App. You can save multiple payment methods and choose which one to use for each ride. We do not accept cash payments at this time.",
  },
  {
    category: "riders",
    q: "Can I book a ride for someone else?",
    a: "Yes. After tapping the destination field, look for 'Book for someone else' and enter their phone number. They'll receive a text with the driver's details and live tracking link. The fare is still charged to your account.",
  },
  {
    category: "riders",
    q: "What's the difference between the ride tiers?",
    a: "Economy is our most affordable everyday ride. Standard is faster pickup with newer vehicles. Premium gives you a luxury car experience. XL fits up to 6 passengers in an SUV or van. All four tiers run on the same fixed-pricing model — no surge.",
  },

  // ── DRIVERS ──
  {
    category: "drivers",
    q: "How do drivers get paid?",
    a: "Drivers receive 75% of every fare directly via Stripe Connect. Earnings deposit to your linked bank account within 24 hours of each completed ride. You can also request instant payouts from the Earnings tab — typically arrive within minutes.",
    popular: true,
  },
  {
    category: "drivers",
    q: "How do I become a UaTob driver?",
    a: "Visit uatob.com/driver/signup and complete the 5-step application: account, contact info, vehicle, documents, and verification. You'll need a valid Florida driver's license, current insurance, and a vehicle that meets our standards. Our team reviews applications within 24–48 hours.",
    popular: true,
  },
  {
    category: "drivers",
    q: "What vehicle requirements do you have?",
    a: "Vehicles must be 2010 or newer (2015+ for Premium), have 4 doors, seat 4+ passengers, and pass an annual inspection. The car must be in safe mechanical condition with current registration and insurance. Branding from competing platforms isn't allowed.",
  },
  {
    category: "drivers",
    q: "How much can I earn?",
    a: "Earnings depend on hours driven, time of day, and ride tier. Drivers keep 75% of every fare plus 100% of tips. There are no weekly fees, no quotas, and no minimum hours. The Earnings tab shows your real-time today, week, and month totals.",
  },
  {
    category: "drivers",
    q: "Are there driving hour limits?",
    a: "Yes. For safety, UaTob enforces a 12-hour maximum continuous driving window. After 12 hours, the app pauses new ride requests until you've taken a 6-hour rest break. This protects you and your riders.",
  },
  {
    category: "drivers",
    q: "Can I drive for other rideshare apps?",
    a: "Yes. As an independent contractor, you can drive on multiple platforms. The only rule is you can't display competing platform branding (signs, decals, light-up logos) while you're online with UaTob.",
  },

  // ── PAYMENTS & PRICING ──
  {
    category: "payments",
    q: "Does UaTob use surge pricing?",
    a: "Never. UaTob does not charge surge or dynamic pricing under any circumstances. Your fare is calculated from the same fixed rates regardless of time of day, weather, holidays, or demand.",
    popular: true,
  },
  {
    category: "payments",
    q: "What is the booking fee?",
    a: "The booking fee is a small fixed charge per ride (ranging from $0.99 to $1.99 depending on tier) that covers payment processing, app infrastructure, and driver support. It's always shown clearly before you confirm.",
  },
  {
    category: "payments",
    q: "How do tips work?",
    a: "Tips are 100% optional and 100% go to the driver — UaTob takes nothing. You can tip in the app after the ride ends, with preset amounts ($1, $2, $5) or a custom amount. Tips are added to the driver's next payout automatically.",
  },
  {
    category: "payments",
    q: "I was charged extra after my ride. Why?",
    a: "Post-trip charges happen for: tolls (passed through at cost), cleaning fees (if there's damage or excessive mess), or a fare adjustment for a route change. You'll see a detailed breakdown in your receipt. If you think the charge is wrong, tap 'Dispute' on the receipt and our team will review within 48 hours.",
  },

  // ── SAFETY ──
  {
    category: "safety",
    q: "How do I report a safety concern?",
    a: "Tap the shield icon during an active trip to instantly contact our 24/7 safety team and share your location. After a ride, open ride history → tap the trip → 'Report an issue.' For serious concerns, email safety@uatob.com — we respond within 4 hours.",
    popular: true,
  },
  {
    category: "safety",
    q: "How are drivers vetted?",
    a: "Every UaTob driver passes: identity verification (gov ID + selfie matching), national criminal background check, motor vehicle records review, vehicle inspection, and annual re-verification. Drivers also do periodic in-app face checks to confirm the verified driver is the one driving.",
  },
  {
    category: "safety",
    q: "Can I share my trip with someone?",
    a: "Yes. During an active trip, tap the share icon to send a live link with your driver's name, vehicle, and route. The link updates in real time and expires automatically when the trip ends.",
  },
  {
    category: "safety",
    q: "What should I do in an emergency?",
    a: "Call 911 immediately. UaTob is not a substitute for emergency services. After the immediate situation is handled, report the incident in-app or email safety@uatob.com so we can investigate.",
  },

  // ── ACCOUNT ──
  {
    category: "account",
    q: "Is UaTob available outside Orlando?",
    a: "Not yet. We're focused on building the best possible service in Orlando before expanding. We plan to launch in additional Florida cities, but only when we're confident the product is ready. Stay updated by following us at uatob.com.",
  },
  {
    category: "account",
    q: "How do I delete my account?",
    a: "Open Settings → Account → Delete Account, or email support@uatob.com from your registered email. Account deletion is permanent and cannot be undone. Some data may be retained for legal and tax purposes per our Privacy Policy.",
  },
  {
    category: "account",
    q: "How do I update my payment method?",
    a: "Open the app → Profile → Payment Methods → Add or Remove. You can set any payment method as default for new rides. Removing a payment method doesn't affect any rides currently in progress.",
  },
  {
    category: "account",
    q: "I forgot my password. How do I reset it?",
    a: "On the login screen, tap 'Forgot password?' and enter your email. We'll send a reset link that expires in 1 hour. If you don't receive it, check your spam folder or email support@uatob.com for help.",
  },
];

const CATEGORIES = [
  { id: "all",      label: "All",      Icon: HelpCircle,    color: T.text   },
  { id: "riders",   label: "Riders",   Icon: Users,         color: BLUE     },
  { id: "drivers",  label: "Drivers",  Icon: Car,           color: ACCENT   },
  { id: "payments", label: "Payments", Icon: DollarSign,    color: AMBER    },
  { id: "safety",   label: "Safety",   Icon: Shield,        color: PURPLE   },
  { id: "account",  label: "Account",  Icon: FileText,      color: "#0891B2" },
];

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

// ── Category chip ─────────────────────────────────────────
function CategoryChip({ cat, active, count, onClick }) {
  const Icon = cat.Icon;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "8px 13px",
        background: active
          ? `linear-gradient(135deg, ${cat.color}, ${cat.color}DD)`
          : T.surface ?? "#FFFFFF",
        border: `1.5px solid ${active ? cat.color : T.border}`,
        borderRadius: 100,
        cursor: "pointer", fontFamily: "inherit",
        fontSize: 12.5, fontWeight: 800,
        color: active ? "#fff" : T.text,
        transition: "all .15s",
        whiteSpace: "nowrap",
        boxShadow: active ? `0 4px 12px ${cat.color}40` : "none",
      }}
      onMouseEnter={e => {
        if (active) return;
        e.currentTarget.style.borderColor = cat.color;
        e.currentTarget.style.color = cat.color;
      }}
      onMouseLeave={e => {
        if (active) return;
        e.currentTarget.style.borderColor = T.border;
        e.currentTarget.style.color = T.text;
      }}
    >
      <Icon size={13} strokeWidth={2.4}/>
      {cat.label}
      <span style={{
        background: active ? "rgba(255,255,255,0.25)" : `${cat.color}15`,
        color: active ? "#fff" : cat.color,
        borderRadius: 100,
        padding: "1px 7px",
        fontSize: 10.5, fontWeight: 800,
        fontVariantNumeric: "tabular-nums",
      }}>
        {count}
      </span>
    </button>
  );
}

// ── FAQ Item ──────────────────────────────────────────────
function FAQItem({ faq, color, defaultOpen = false }) {
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
          textAlign: "left", fontFamily: "inherit",
        }}
      >
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
          {faq.popular && !open && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              background: "#FFFBEB",
              border: "1px solid #FDE68A",
              borderRadius: 100, padding: "2px 7px",
              fontSize: 9.5, fontWeight: 800, color: "#B45309",
              letterSpacing: ".05em", textTransform: "uppercase",
              flexShrink: 0,
            }}>
              <Sparkles size={9} fill="#F59E0B" color="#F59E0B" strokeWidth={0}/>
              Popular
            </div>
          )}
          <span style={{
            fontSize: 13.5, fontWeight: 700, color: T.text,
            lineHeight: 1.4,
          }}>
            {faq.q}
          </span>
        </div>
        <div style={{
          width: 26, height: 26, borderRadius: "50%",
          background: open ? color : `${color}12`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, transition: "all .25s",
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
            fontSize: 13, color: T.textMuted, lineHeight: 1.7,
          }}>
            {faq.a}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────
export default function FAQ() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Get color for each category
  const getCategoryColor = (catId) => {
    return CATEGORIES.find(c => c.id === catId)?.color ?? ACCENT;
  };

  // Filter FAQs
  const filteredFAQs = useMemo(() => {
    let result = FAQ_DATA;
    if (activeCategory !== "all") {
      result = result.filter(f => f.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(f =>
        f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)
      );
    }
    return result;
  }, [activeCategory, searchQuery]);

  // Counts per category
  const categoryCounts = useMemo(() => {
    const counts = { all: FAQ_DATA.length };
    CATEGORIES.forEach(c => {
      if (c.id !== "all") {
        counts[c.id] = FAQ_DATA.filter(f => f.category === c.id).length;
      }
    });
    return counts;
  }, []);

  const popularFAQs = useMemo(
    () => FAQ_DATA.filter(f => f.popular),
    []
  );

  const showPopularSection = activeCategory === "all" && !searchQuery.trim();

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 4px", fontFamily: "inherit" }}>
      <style>{`
        @keyframes faqFadeUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
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
            width: 60, height: 60, borderRadius: 17,
            background: `linear-gradient(135deg, ${ACCENT}, #15803D)`,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 16,
            boxShadow: "0 12px 28px rgba(22,163,74,.4)",
          }}>
            <HelpCircle size={28} color="#fff" strokeWidth={2.2}/>
          </div>

          <h1 style={{
            margin: 0, fontSize: 36, fontWeight: 900, color: T.text,
            letterSpacing: "-1px", lineHeight: 1.1, marginBottom: 12,
          }}>
            How can we{" "}
            <span style={{
              background: "linear-gradient(135deg, #22C55E, #16A34A 60%, #15803D)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              help?
            </span>
          </h1>

          <p style={{
            margin: "0 auto 22px", fontSize: 14.5, color: T.textMuted,
            lineHeight: 1.65, maxWidth: 480,
          }}>
            Quick answers to the most common questions about riding, driving, and using UaTob.
          </p>

          {/* Search bar */}
          <div style={{
            position: "relative",
            maxWidth: 460, margin: "0 auto",
          }}>
            <Search
              size={16}
              color={T.textMuted}
              style={{
                position: "absolute", left: 16, top: "50%",
                transform: "translateY(-50%)", pointerEvents: "none",
              }}
            />
            <input
              type="text"
              placeholder="Search FAQs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "13px 44px 13px 42px",
                background: T.surface ?? "#FFFFFF",
                border: `1.5px solid ${T.border}`,
                borderRadius: 100,
                fontSize: 14, fontWeight: 500, color: T.text,
                outline: "none", fontFamily: "inherit",
                transition: "border-color .15s, box-shadow .15s",
                boxShadow: "0 4px 12px rgba(0,0,0,.06)",
              }}
              onFocus={e => {
                e.target.style.borderColor = ACCENT;
                e.target.style.boxShadow = "0 0 0 4px rgba(22,163,74,.12), 0 4px 12px rgba(0,0,0,.06)";
              }}
              onBlur={e => {
                e.target.style.borderColor = T.border;
                e.target.style.boxShadow = "0 4px 12px rgba(0,0,0,.06)";
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute", right: 12, top: "50%",
                  transform: "translateY(-50%)",
                  background: T.surfaceAlt ?? "#F3F4F0",
                  border: "none", borderRadius: "50%",
                  width: 22, height: 22,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={12} color={T.textMuted} strokeWidth={2.4}/>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Category chips ── */}
      <div style={{
        display: "flex", gap: 6,
        marginBottom: 24,
        overflowX: "auto",
        paddingBottom: 4,
        scrollbarWidth: "none",
      }}>
        {CATEGORIES.map(cat => (
          <CategoryChip
            key={cat.id}
            cat={cat}
            count={categoryCounts[cat.id]}
            active={activeCategory === cat.id}
            onClick={() => setActiveCategory(cat.id)}
          />
        ))}
      </div>

      {/* ── Popular section (only when "all" + no search) ── */}
      {showPopularSection && (
        <div style={{ marginBottom: 28 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            marginBottom: 12,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: "linear-gradient(135deg,#F59E0B,#D97706)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 10px rgba(217,119,6,.35)",
            }}>
              <TrendingUp size={14} color="#fff" strokeWidth={2.4}/>
            </div>
            <span style={{
              fontSize: 13, fontWeight: 800, color: T.text,
              letterSpacing: "-0.2px",
            }}>
              Popular questions
            </span>
            <div style={{
              flex: 1, height: 1, background: T.border, marginLeft: 4,
            }}/>
            <span style={{
              fontSize: 11, color: T.textMuted, fontWeight: 700,
            }}>
              {popularFAQs.length} answers
            </span>
          </div>

          {popularFAQs.map((faq, i) => (
            <FAQItem
              key={i}
              faq={faq}
              color={getCategoryColor(faq.category)}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      )}

      {/* ── Filtered results ── */}
      <div style={{ marginBottom: 32 }}>
        {/* Section header for filtered results */}
        {(activeCategory !== "all" || searchQuery.trim()) && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            marginBottom: 12,
          }}>
            {(() => {
              const cat = CATEGORIES.find(c => c.id === activeCategory) ?? CATEGORIES[0];
              const Icon = cat.Icon;
              return (
                <>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: `linear-gradient(135deg, ${cat.color}, ${cat.color}DD)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: `0 4px 10px ${cat.color}30`,
                  }}>
                    <Icon size={14} color="#fff" strokeWidth={2.4}/>
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 800, color: T.text,
                    letterSpacing: "-0.2px",
                  }}>
                    {searchQuery.trim()
                      ? `Search: "${searchQuery.trim()}"`
                      : `${cat.label} questions`}
                  </span>
                </>
              );
            })()}
            <div style={{
              flex: 1, height: 1, background: T.border, marginLeft: 4,
            }}/>
            <span style={{
              fontSize: 11, color: T.textMuted, fontWeight: 700,
            }}>
              {filteredFAQs.length} {filteredFAQs.length === 1 ? "result" : "results"}
            </span>
          </div>
        )}

        {/* "All categories" header */}
        {showPopularSection && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            marginBottom: 12,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: `linear-gradient(135deg, ${ACCENT}, #15803D)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 4px 10px ${ACCENT}30`,
            }}>
              <HelpCircle size={14} color="#fff" strokeWidth={2.4}/>
            </div>
            <span style={{
              fontSize: 13, fontWeight: 800, color: T.text,
              letterSpacing: "-0.2px",
            }}>
              All questions
            </span>
            <div style={{
              flex: 1, height: 1, background: T.border, marginLeft: 4,
            }}/>
            <span style={{
              fontSize: 11, color: T.textMuted, fontWeight: 700,
            }}>
              {FAQ_DATA.length} answers
            </span>
          </div>
        )}

        {/* No results */}
        {filteredFAQs.length === 0 ? (
          <div style={{
            background: T.surface ?? "#FFFFFF",
            border: `1.5px solid ${T.border}`,
            borderRadius: 18,
            padding: "32px 24px",
            textAlign: "center",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: T.surfaceAlt ?? "#F3F4F0",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              marginBottom: 14,
            }}>
              <Search size={24} color={T.textMuted} strokeWidth={2}/>
            </div>
            <div style={{
              fontSize: 16, fontWeight: 800, color: T.text,
              marginBottom: 6, letterSpacing: "-0.2px",
            }}>
              No matches found
            </div>
            <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.55, marginBottom: 16 }}>
              Try a different search term or browse by category.
            </div>
            <button
              type="button"
              onClick={() => { setSearchQuery(""); setActiveCategory("all"); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 14px",
                background: ACCENT,
                color: "#fff",
                border: "none", borderRadius: 100,
                fontSize: 12.5, fontWeight: 800,
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: `0 4px 12px ${ACCENT}40`,
              }}
            >
              Clear filters
              <ArrowRight size={12} strokeWidth={2.4}/>
            </button>
          </div>
        ) : (
          filteredFAQs.map((faq, i) => (
            <FAQItem
              key={`${activeCategory}-${searchQuery}-${i}`}
              faq={faq}
              color={getCategoryColor(faq.category)}
              defaultOpen={false}
            />
          ))
        )}
      </div>

      {/* ── Still need help? CTA ── */}
      <div style={{
        background: "linear-gradient(135deg, rgba(22,163,74,.08), rgba(22,163,74,.02))",
        border: `1.5px solid rgba(22,163,74,.28)`,
        borderRadius: 22,
        padding: "26px 24px",
        marginBottom: 28,
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -40, right: -40,
          width: 160, height: 160, borderRadius: "50%",
          background: `radial-gradient(circle, rgba(22,163,74,0.18) 0%, transparent 70%)`,
          pointerEvents: "none",
        }}/>

        <div style={{ position: "relative", textAlign: "center" }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: `linear-gradient(135deg, ${ACCENT}, #15803D)`,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 12,
            boxShadow: `0 8px 20px ${ACCENT}40`,
          }}>
            <MessageCircle size={24} color="#fff" strokeWidth={2.2}/>
          </div>

          <div style={{
            fontSize: 20, fontWeight: 900, color: T.text,
            letterSpacing: "-0.4px", lineHeight: 1.1, marginBottom: 6,
          }}>
            Still need help?
          </div>
          <p style={{
            margin: "0 auto 18px", fontSize: 13.5, color: T.textMuted,
            lineHeight: 1.6, maxWidth: 420,
          }}>
            Our team is small, local, and we read every message. Reach out and we'll get back within a few hours.
          </p>

          <div style={{
            display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap",
          }}>
            <a
              href="mailto:[email protected]"
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "12px 18px",
                background: `linear-gradient(135deg, ${ACCENT}, #15803D)`,
                color: "#fff",
                borderRadius: 100,
                fontSize: 13.5, fontWeight: 800,
                letterSpacing: "0.2px",
                textDecoration: "none",
                boxShadow: `0 8px 20px ${ACCENT}40`,
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
              <Mail size={14} strokeWidth={2.4}/>
              Email support
            </a>
            <a
              href="mailto:[email protected]"
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "12px 18px",
                background: T.surface ?? "#FFFFFF",
                color: PURPLE,
                border: `1.5px solid ${PURPLE}30`,
                borderRadius: 100,
                fontSize: 13.5, fontWeight: 800,
                letterSpacing: "0.2px",
                textDecoration: "none",
                transition: "all .15s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = PURPLE;
                e.currentTarget.style.background = `${PURPLE}06`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = `${PURPLE}30`;
                e.currentTarget.style.background = T.surface ?? "#FFFFFF";
              }}
            >
              <Shield size={14} strokeWidth={2.4}/>
              Safety concern
            </a>
          </div>

          <div style={{
            marginTop: 16,
            display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap",
            fontSize: 11.5, color: T.textMuted, fontWeight: 600,
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Clock size={11} strokeWidth={2.4}/>
              Response within 4 hours
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <MapPin size={11} strokeWidth={2.4}/>
              Orlando, FL
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Heart size={11} fill="#EF4444" color="#EF4444" strokeWidth={0}/>
              Real humans
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
