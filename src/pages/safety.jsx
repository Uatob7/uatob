import React from "react";
import { THEME as T } from "@/App/UaTob/pricing.js";

export default function Safety() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 32, fontWeight: 900, color: T.text }}>
        Safety
      </h1>

      <p style={{ color: T.textMuted, marginBottom: 30 }}>
        Your safety is our top priority at UaTob.
      </p>

      <div style={{ marginBottom: 30 }}>
        <h2 style={{ color: T.text }}>For Riders</h2>
        <ul style={{ color: T.textMuted }}>
          <li>View driver details before pickup</li>
          <li>Share your trip with friends or family</li>
          <li>Contact support anytime</li>
        </ul>
      </div>

      <div style={{ marginBottom: 30 }}>
        <h2 style={{ color: T.text }}>For Drivers</h2>
        <ul style={{ color: T.textMuted }}>
          <li>Background checks before approval</li>
          <li>Driver ratings and feedback system</li>
          <li>Emergency assistance support</li>
        </ul>
      </div>

      <div
        style={{
          padding: "20px",
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          background: T.surfaceAlt,
        }}
      >
        <h3 style={{ marginTop: 0, color: T.text }}>Emergency</h3>
        <p style={{ color: T.textMuted }}>
          If you are in immediate danger, call 911. UaTob is not a substitute
          for emergency services.
        </p>
      </div>
    </div>
  );
}