import React from "react";
import { THEME as T } from "@/App/UaTob/pricing.js";

const faqs = [
  {
    q: "How does UaTob work?",
    a: "UaTob connects riders with nearby drivers through our platform.",
  },
  {
    q: "How are fares calculated?",
    a: "Fares are based on distance, time, and ride type.",
  },
  {
    q: "Can I cancel a ride?",
    a: "Yes, cancellation fees may apply depending on timing.",
  },
  {
    q: "How do drivers get paid?",
    a: "Drivers are paid through Stripe after each completed ride.",
  },
];

export default function FAQ() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 32, fontWeight: 900, color: T.text }}>FAQ</h1>
      <p style={{ color: T.textMuted, marginBottom: 30 }}>
        Frequently asked questions.
      </p>

      {faqs.map((f, i) => (
        <div key={i} style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 6, color: T.text }}>{f.q}</h3>
          <p style={{ color: T.textMuted }}>{f.a}</p>
        </div>
      ))}
    </div>
  );
}