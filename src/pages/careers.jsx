import React from "react";
import { THEME as T } from "@/App/UaTob/pricing.js";

const roles = [
  {
    title: "Frontend Engineer",
    location: "Orlando, FL / Remote",
    desc: "Build and scale the UaTob rider and driver experience.",
  },
  {
    title: "Operations Manager",
    location: "Orlando, FL",
    desc: "Help grow and manage driver supply and city operations.",
  },
];

export default function Careers() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 32, fontWeight: 900, color: T.text }}>
        Careers
      </h1>
      <p style={{ color: T.textMuted, marginBottom: 30 }}>
        Join UaTob and help redefine ride-sharing.
      </p>

      {roles.map((job, i) => (
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
          <h2 style={{ margin: 0, color: T.text }}>{job.title}</h2>
          <p style={{ fontSize: 12, color: T.textMuted }}>{job.location}</p>
          <p style={{ color: T.textMuted }}>{job.desc}</p>

          <button
            style={{
              marginTop: 10,
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: "#16A34A",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Apply
          </button>
        </div>
      ))}
    </div>
  );
}