import React from "react";
import { THEME as T } from "@/App/UaTob/pricing.js";

const posts = [
  {
    title: "Launching UaTob in Orlando",
    date: "April 2026",
    desc: "We’re excited to bring a new ride experience to Orlando with better pricing and driver-first earnings.",
  },
  {
    title: "How UaTob Pricing Works",
    date: "March 2026",
    desc: "Transparent pricing with no hidden surge tricks. Here’s how we calculate fares.",
  },
];

export default function Blog() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 32, fontWeight: 900, color: T.text }}>Blog</h1>
      <p style={{ color: T.textMuted, marginBottom: 30 }}>
        Updates, announcements, and insights from UaTob.
      </p>

      {posts.map((p, i) => (
        <div
          key={i}
          style={{
            padding: "20px",
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            marginBottom: 20,
            background: T.surfaceAlt,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 20, color: T.text }}>{p.title}</h2>
          <p style={{ fontSize: 12, color: T.textMuted }}>{p.date}</p>
          <p style={{ color: T.textMuted }}>{p.desc}</p>
        </div>
      ))}
    </div>
  );
}