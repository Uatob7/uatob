import React, { useState } from "react";

// ── Design tokens ─────────────────────────────────────────────────────
const C = {
  bg:           "#FAFAF7",
  surface:      "#FFFFFF",
  surfaceRaised:"#F9FAF7",
  surfaceBright:"#F3F4F0",
  border:       "#E8E6DD",
  borderBright: "#D8D5CC",
  accent:       "#16A34A",
  accentDim:    "#15803D",
  accentGlow:   "rgba(22,163,74,.10)",
  accentBorder: "rgba(22,163,74,.22)",
  text:         "#0F0F10",
  textMid:      "#5A5A52",
  textDim:      "#9A988E",
  blue:         "#2563EB",
  amber:        "#D97706",
  cyan:         "#0891B2",
  red:          "#DC2626",
};

// ── SVG Logo ──────────────────────────────────────────────────────────
function UaTobIcon({ size = 38 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="bl-bg"   x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#FFFFFF"/><stop offset="100%" stopColor="#F3F4F6"/></linearGradient>
        <linearGradient id="bl-road" x1="0" y1="0" x2="64" y2="0"  gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#111827"/><stop offset="100%" stopColor="#16A34A"/></linearGradient>
        <linearGradient id="bl-car"  x1="0" y1="0" x2="1"  y2="1"><stop offset="0%" stopColor="#16A34A"/><stop offset="100%" stopColor="#15803D"/></linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#bl-bg)"/>
      <rect x="0.5" y="0.5" width="63" height="63" rx="13.5" stroke="#E5E7EB" strokeWidth="1"/>
      <path d="M 10 46 Q 32 28 54 46" stroke="url(#bl-road)" strokeWidth="2" strokeDasharray="4 3.5" strokeLinecap="round" fill="none" opacity="0.6"/>
      <circle cx="10" cy="46" r="5" fill="#111827" fillOpacity="0.12"/><circle cx="10" cy="46" r="3" fill="#111827"/>
      <text x="10" y="49" textAnchor="middle" fontFamily="system-ui" fontWeight="900" fontSize="4" fill="#fff">A</text>
      <circle cx="54" cy="46" r="5" fill="#16A34A" fillOpacity="0.18"/><circle cx="54" cy="46" r="3" fill="#16A34A"/>
      <text x="54" y="49" textAnchor="middle" fontFamily="system-ui" fontWeight="900" fontSize="4" fill="#fff">B</text>
      <g transform="translate(26,22)">
        <ellipse cx="6" cy="13" rx="7" ry="1.5" fill="#111827" opacity="0.1"/>
        <rect x="1" y="5" width="10" height="6" rx="1.5" fill="url(#bl-car)"/>
        <path d="M2.5 5 L3.5 2 L8.5 2 L9.5 5Z" fill="#15803D"/>
        <rect x="3.5" y="2.3" width="2" height="1.8" rx="0.4" fill="#fff" fillOpacity="0.85"/>
        <rect x="6.5" y="2.3" width="2" height="1.8" rx="0.4" fill="#fff" fillOpacity="0.85"/>
        <circle cx="3" cy="11" r="1.7" fill="#111827"/><circle cx="3" cy="11" r="0.85" fill="#16A34A"/>
        <circle cx="9" cy="11" r="1.7" fill="#111827"/><circle cx="9" cy="11" r="0.85" fill="#22C55E"/>
        <rect x="10.2" y="6.5" width="1.5" height="1" rx="0.5" fill="#FCD34D" opacity="0.9"/>
      </g>
    </svg>
  );
}

// ── Post data ─────────────────────────────────────────────────────────
const POSTS = [
  {
    id: 1,
    tag: "Announcement",
    tagColor: C.accent,
    tagBg: C.accentGlow,
    tagBorder: C.accentBorder,
    title: "Launching UaTob in Orlando",
    subtitle: "A ride experience built for the city, not the algorithm.",
    date: "April 15, 2026",
    readTime: "4 min read",
    author: "UaTob Team",
    body: [
      "Orlando deserves better than what the big platforms have been offering. Surge pricing that triples fares during a theme park rush. Drivers taking home less than half of what riders pay. A customer support line that sends you in circles.",
      "UaTob was built to fix that. Starting today, Orlando riders can book a ride based on actual distance — no hidden multipliers, no algorithm deciding your fare based on your phone's battery level. Just A to B, priced fairly.",
      "Our drivers keep 75% of every fare. That's not a promotional rate — it's the permanent model. We believe the people doing the work should be the ones getting paid for it.",
      "We're starting in the Orlando metro and building outward from there. If you're a driver or a rider who's tired of being squeezed, welcome to UaTob.",
    ],
    accent: C.accent,
    featured: true,
  },
  {
    id: 2,
    tag: "Product",
    tagColor: C.blue,
    tagBg: "rgba(37,99,235,.08)",
    tagBorder: "rgba(37,99,235,.22)",
    title: "How UaTob Pricing Works",
    subtitle: "Transparent fares. No surprises. Here's the math.",
    date: "March 28, 2026",
    readTime: "3 min read",
    author: "UaTob Team",
    body: [
      "Every UaTob fare is calculated the same way: a base rate plus a per-mile charge from your pickup to your dropoff. That's it. The price you see before you book is the price you pay.",
      "We don't have surge pricing. When it rains in Orlando, your fare doesn't double. When a concert lets out, you're not paying a 3x multiplier because demand is high. Distance is distance.",
      "Economy starts at $1.00 base + $1.10/mile. Comfort, XL, and Premium tiers are available for passengers who want more space or a higher-end vehicle. All tiers use the same transparent distance formula.",
      "We publish our rate card publicly at uatob.com/pricing. If you ever want to know exactly what a ride will cost before you open the app, you can estimate it yourself with the fare calculator on that page.",
    ],
    accent: C.blue,
    featured: false,
  },
  {
    id: 3,
    tag: "Drivers",
    tagColor: C.amber,
    tagBg: "rgba(217,119,6,.08)",
    tagBorder: "rgba(217,119,6,.22)",
    title: "Why Drivers Choose UaTob",
    subtitle: "75% earnings, daily payouts, and a platform that treats you like a professional.",
    date: "March 10, 2026",
    readTime: "5 min read",
    author: "UaTob Team",
    body: [
      "The average rideshare driver on legacy platforms takes home around 50–55% of the fare after platform fees. At UaTob, drivers keep 75% — permanently, not as a limited-time promotion.",
      "We also pay out daily. You don't wait for a weekly deposit to hit. Once your earnings clear, they're available to transfer the same day through Stripe Connect.",
      "Drivers on UaTob also get full visibility into every ride request before they accept — destination, estimated fare, and distance. You never accept a ride blind.",
      "Our onboarding takes less than 48 hours once your documents are verified. Sign up at uatob.com/driver/signup, upload your license, insurance, and registration, and our team reviews your application within a business day.",
    ],
    accent: C.amber,
    featured: false,
  },
  {
    id: 4,
    tag: "Safety",
    tagColor: C.cyan,
    tagBg: "rgba(8,145,178,.08)",
    tagBorder: "rgba(8,145,178,.22)",
    title: "Safety at UaTob",
    subtitle: "What we do before, during, and after every ride.",
    date: "February 20, 2026",
    readTime: "4 min read",
    author: "UaTob Team",
    body: [
      "Every UaTob driver passes a background check before their first ride. We screen through Checkr, one of the industry's leading background check providers, covering criminal history and driving record.",
      "During rides, your live location is tracked and stored throughout the trip. Riders can share a real-time tracking link with anyone they trust before they get in the car.",
      "Our support team is reachable 24/7 for any safety concern — before, during, or after a trip. Issues flagged as safety-related are escalated immediately and reviewed within the hour.",
      "We're building a platform where both riders and drivers feel respected and protected. Safety isn't a feature — it's the foundation.",
    ],
    accent: C.cyan,
    featured: false,
  },
];

const TAGS = ["All", "Announcement", "Product", "Drivers", "Safety"];

// ── Read More Modal ───────────────────────────────────────────────────
function PostModal({ post, onClose }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(15,15,16,.6)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        animation: "fadeIn .2s ease",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 620,
          background: C.surface,
          borderRadius: "28px 28px 0 0",
          maxHeight: "88vh", overflowY: "auto",
          boxShadow: "0 -32px 80px rgba(0,0,0,.2)",
          animation: "slideUp .38s cubic-bezier(.34,1.2,.64,1)",
        }}
      >
        {/* Sticky header */}
        <div style={{
          position: "sticky", top: 0, zIndex: 10,
          background: "rgba(255,255,255,.95)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${C.border}`,
          padding: "14px 22px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: post.tagBg, border: `1px solid ${post.tagBorder}`,
            borderRadius: 100, padding: "4px 12px",
            fontSize: 10.5, fontWeight: 800, color: post.tagColor,
            fontFamily: "'Barlow Condensed',sans-serif",
            letterSpacing: ".12em", textTransform: "uppercase",
          }}>
            {post.tag}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              background: C.surfaceBright, border: `1px solid ${C.border}`,
              cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", color: C.textDim,
              fontSize: 18, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: "28px 26px 48px" }}>
          {/* Handle */}
          <div style={{ width: 40, height: 4, background: C.border, borderRadius: 2, margin: "-14px auto 26px" }} />

          <div style={{
            fontFamily: "'Barlow Condensed',sans-serif",
            fontSize: "clamp(26px,5vw,36px)",
            fontWeight: 900, color: C.text,
            letterSpacing: "-1px", lineHeight: 1.08,
            marginBottom: 10,
          }}>
            {post.title}
          </div>

          <div style={{
            fontSize: 15, color: C.textMid,
            fontWeight: 500, lineHeight: 1.6,
            marginBottom: 22,
          }}>
            {post.subtitle}
          </div>

          {/* Meta */}
          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            paddingBottom: 22,
            borderBottom: `1px solid ${C.border}`,
            marginBottom: 26,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%",
              background: `linear-gradient(135deg,#22C55E,#16A34A)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <UaTobIcon size={20} />
            </div>
            <div>
              <div style={{
                fontSize: 12.5, fontWeight: 800, color: C.text,
                fontFamily: "'Barlow Condensed',sans-serif",
              }}>
                {post.author}
              </div>
              <div style={{ fontSize: 11.5, color: C.textDim, fontWeight: 500 }}>
                {post.date} · {post.readTime}
              </div>
            </div>
          </div>

          {/* Body */}
          {post.body.map((para, i) => (
            <p key={i} style={{
              fontSize: 15, color: C.textMid,
              lineHeight: 1.75, fontWeight: 500,
              marginBottom: i < post.body.length - 1 ? 18 : 0,
            }}>
              {para}
            </p>
          ))}

          {/* Accent rule at bottom */}
          <div style={{
            marginTop: 36, paddingTop: 22,
            borderTop: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 4, height: 32, borderRadius: 2,
              background: `linear-gradient(180deg, ${post.accent}, ${post.accent}44)`,
            }} />
            <div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, lineHeight: 1.55 }}>
              Published by UaTob · {post.date}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Featured Post Card ────────────────────────────────────────────────
function FeaturedCard({ post, onRead }) {
  return (
    <div style={{
      background: C.surface,
      border: `1.5px solid ${C.border}`,
      borderRadius: 22,
      overflow: "hidden",
      marginBottom: 16,
      boxShadow: "0 2px 12px rgba(0,0,0,.05)",
      position: "relative",
    }}>
      {/* Top accent bar */}
      <div style={{
        height: 4,
        background: `linear-gradient(90deg, ${post.accent}, ${post.accent}66, transparent)`,
      }} />

      <div style={{ padding: "26px 24px 24px" }}>
        {/* Tag + date row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: post.tagBg, border: `1px solid ${post.tagBorder}`,
            borderRadius: 100, padding: "4px 12px",
            fontSize: 10.5, fontWeight: 800, color: post.tagColor,
            fontFamily: "'Barlow Condensed',sans-serif",
            letterSpacing: ".12em", textTransform: "uppercase",
          }}>
            <div style={{
              width: 5, height: 5, borderRadius: "50%",
              background: post.tagColor, opacity: 0.8,
            }} />
            {post.tag}
          </div>
          <div style={{ fontSize: 11.5, color: C.textDim, fontWeight: 600 }}>
            {post.date}
          </div>
        </div>

        {/* Title */}
        <div style={{
          fontFamily: "'Barlow Condensed',sans-serif",
          fontSize: "clamp(26px,6vw,38px)",
          fontWeight: 900, color: C.text,
          letterSpacing: "-1px", lineHeight: 1.06,
          marginBottom: 12,
        }}>
          {post.title}
        </div>

        {/* Subtitle */}
        <p style={{
          fontSize: 14.5, color: C.textMid,
          fontWeight: 500, lineHeight: 1.65,
          marginBottom: 22,
        }}>
          {post.subtitle}
        </p>

        {/* First paragraph preview */}
        <p style={{
          fontSize: 13.5, color: C.textDim,
          fontWeight: 500, lineHeight: 1.7,
          marginBottom: 22,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {post.body[0]}
        </p>

        {/* Footer row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "linear-gradient(135deg,#22C55E,#16A34A)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <UaTobIcon size={18} />
            </div>
            <div>
              <div style={{
                fontSize: 11.5, fontWeight: 800, color: C.text,
                fontFamily: "'Barlow Condensed',sans-serif",
              }}>
                {post.author}
              </div>
              <div style={{ fontSize: 10.5, color: C.textDim }}>{post.readTime}</div>
            </div>
          </div>

          <button
            onClick={() => onRead(post)}
            style={{
              padding: "10px 20px",
              background: `linear-gradient(135deg, ${post.accent}EE, ${post.accent})`,
              border: "none", borderRadius: 100,
              color: "#fff", fontWeight: 800, fontSize: 13,
              fontFamily: "'Barlow',sans-serif", cursor: "pointer",
              letterSpacing: ".3px",
              boxShadow: `0 4px 14px ${post.accent}35`,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            Read Post
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Regular Post Card ─────────────────────────────────────────────────
function PostCard({ post, onRead, index }) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1.5px solid ${C.border}`,
        borderRadius: 18,
        padding: "20px",
        marginBottom: 10,
        boxShadow: "0 1px 4px rgba(0,0,0,.04)",
        display: "flex", gap: 16, alignItems: "flex-start",
        cursor: "pointer",
        transition: "border-color .2s, box-shadow .2s, transform .15s",
        animation: `revealUp .4s ease-out ${index * 0.07}s both`,
      }}
      onClick={() => onRead(post)}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = post.tagBorder;
        e.currentTarget.style.boxShadow = `0 4px 18px ${post.accent}12`;
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = C.border;
        e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,.04)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Index number */}
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: post.tagBg, border: `1.5px solid ${post.tagBorder}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Barlow Condensed',sans-serif",
        fontSize: 15, fontWeight: 900, color: post.tagColor,
      }}>
        {String(index + 1).padStart(2, "0")}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Tag */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          background: post.tagBg, border: `1px solid ${post.tagBorder}`,
          borderRadius: 100, padding: "2px 9px",
          fontSize: 9.5, fontWeight: 800, color: post.tagColor,
          fontFamily: "'Barlow Condensed',sans-serif",
          letterSpacing: ".1em", textTransform: "uppercase",
          marginBottom: 7,
        }}>
          {post.tag}
        </div>

        <div style={{
          fontFamily: "'Barlow Condensed',sans-serif",
          fontSize: 17, fontWeight: 900, color: C.text,
          letterSpacing: "-.3px", lineHeight: 1.2, marginBottom: 5,
        }}>
          {post.title}
        </div>

        <p style={{
          fontSize: 12.5, color: C.textDim, fontWeight: 500,
          lineHeight: 1.55, marginBottom: 10,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {post.subtitle}
        </p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, color: C.textDim, fontWeight: 600 }}>
            {post.date} · {post.readTime}
          </div>
          <div style={{
            fontSize: 11, fontWeight: 800, color: post.tagColor,
            fontFamily: "'Barlow Condensed',sans-serif",
            letterSpacing: ".05em",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            Read
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function Blog() {
  const [activeTag,  setActiveTag]  = useState("All");
  const [activePost, setActivePost] = useState(null);

  const featured = POSTS[0];
  const rest     = POSTS.slice(1);

  const filtered = activeTag === "All"
    ? rest
    : rest.filter(p => p.tag === activeTag);

  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      fontFamily: '"Barlow", system-ui, sans-serif',
      color: C.text,
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800;900&family=Barlow+Condensed:wght@500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeIn   { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp  { from { transform: translateY(40px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes revealUp { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes pulse    { 0%,100% { opacity: 1 } 50% { opacity: .45 } }
      `}} />

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 18px 100px" }}>

        {/* ── Nav ── */}
        <div style={{
          padding: "26px 0 22px",
          display: "flex", alignItems: "center", gap: 14,
          borderBottom: `1px solid ${C.border}`,
          marginBottom: 40,
        }}>
          <UaTobIcon size={42} />
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "'Barlow Condensed',sans-serif",
              fontSize: 10, fontWeight: 700, color: C.textDim,
              letterSpacing: "2px", textTransform: "uppercase", marginBottom: 2,
            }}>
              UaTob · Blog
            </div>
            <div style={{
              fontFamily: "'Barlow Condensed',sans-serif",
              fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: "-.5px",
            }}>
              News & Updates
            </div>
          </div>
          {/* Live dot */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: C.accentGlow, border: `1px solid ${C.accentBorder}`,
            borderRadius: 100, padding: "6px 14px",
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              background: C.accent,
              animation: "pulse 1.8s ease-in-out infinite",
            }} />
            <span style={{
              fontSize: 11, fontWeight: 800, color: C.accentDim,
              fontFamily: "'Barlow Condensed',sans-serif",
              letterSpacing: ".12em", textTransform: "uppercase",
            }}>
              {POSTS.length} Posts
            </span>
          </div>
        </div>

        {/* ── Hero headline ── */}
        <div style={{ marginBottom: 36, animation: "revealUp .5s ease-out" }}>
          <div style={{
            fontFamily: "'Barlow Condensed',sans-serif",
            fontSize: "clamp(34px,8vw,50px)",
            fontWeight: 900, color: C.text,
            letterSpacing: "-1.5px", lineHeight: 1.07,
            marginBottom: 12,
          }}>
            Stories from the<br/>
            <span style={{ color: C.accent }}>road to fair rides.</span>
          </div>
          <p style={{
            fontSize: 14.5, color: C.textMid, fontWeight: 500, lineHeight: 1.7,
          }}>
            Updates, announcements, and the thinking behind UaTob.
          </p>
        </div>

        {/* ── Featured post ── */}
        <FeaturedCard post={featured} onRead={setActivePost} />

        {/* ── Filter tabs ── */}
        <div style={{ marginBottom: 20, marginTop: 32 }}>
          <div style={{
            fontSize: 10.5, fontWeight: 700, color: C.textMid,
            letterSpacing: "1.5px", textTransform: "uppercase",
            fontFamily: "'Barlow Condensed',sans-serif",
            marginBottom: 12,
          }}>
            Browse by topic
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TAGS.map(tag => {
              const isActive = activeTag === tag;
              const post     = POSTS.find(p => p.tag === tag);
              const color    = post?.tagColor    ?? C.accent;
              const colorBg  = post?.tagBg       ?? C.accentGlow;
              const colorBdr = post?.tagBorder   ?? C.accentBorder;
              return (
                <button
                  key={tag}
                  onClick={() => setActiveTag(tag)}
                  style={{
                    padding: "7px 15px",
                    borderRadius: 100,
                    border: `1.5px solid ${isActive ? (tag === "All" ? C.accentBorder : colorBdr) : C.border}`,
                    background: isActive ? (tag === "All" ? C.accentGlow : colorBg) : C.surface,
                    color: isActive ? (tag === "All" ? C.accent : color) : C.textMid,
                    fontWeight: 800, fontSize: 12,
                    fontFamily: "'Barlow Condensed',sans-serif",
                    letterSpacing: ".08em",
                    cursor: "pointer", transition: "all .18s",
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Post list ── */}
        {filtered.length > 0 ? (
          filtered.map((post, i) => (
            <PostCard key={post.id} post={post} onRead={setActivePost} index={i} />
          ))
        ) : (
          <div style={{
            textAlign: "center", padding: "48px 0",
            color: C.textDim, fontSize: 14, fontWeight: 600,
          }}>
            No posts in this category yet.
          </div>
        )}

        {/* ── Newsletter CTA ── */}
        <div style={{
          marginTop: 36,
          background: "linear-gradient(135deg, rgba(22,163,74,.07), rgba(22,163,74,.02))",
          border: "1.5px solid rgba(22,163,74,.22)",
          borderRadius: 20, padding: "28px 24px",
          textAlign: "center",
        }}>
          <div style={{
            fontFamily: "'Barlow Condensed',sans-serif",
            fontSize: 24, fontWeight: 900, color: C.text, marginBottom: 8,
          }}>
            Stay in the loop
          </div>
          <p style={{
            fontSize: 13.5, color: C.textMid, fontWeight: 500,
            lineHeight: 1.65, marginBottom: 20,
          }}>
            New posts, product updates, and Orlando launch news — straight to your inbox.
          </p>
          <div style={{ display: "flex", gap: 8, maxWidth: 400, margin: "0 auto" }}>
            <input
              type="email"
              placeholder="your@email.com"
              style={{
                flex: 1, padding: "12px 16px",
                background: C.surface, border: `1.5px solid ${C.border}`,
                borderRadius: 100, color: C.text,
                fontFamily: "'Barlow',sans-serif", fontSize: 13.5,
                fontWeight: 500, outline: "none",
              }}
            />
            <button style={{
              padding: "12px 22px",
              background: "linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)",
              border: "none", borderRadius: 100,
              color: "#fff", fontWeight: 800, fontSize: 13.5,
              fontFamily: "'Barlow',sans-serif", cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: "0 4px 14px rgba(22,163,74,.28)",
            }}>
              Subscribe →
            </button>
          </div>
        </div>

      </div>

      {/* ── Post modal ── */}
      {activePost && (
        <PostModal post={activePost} onClose={() => setActivePost(null)} />
      )}
    </div>
  );
}
