import { User, Phone, Car, FileText, Shield } from "lucide-react";

export const C = {
  bg: "#FAFAFA", surface: "#FFFFFF", surfaceRaised: "#F9FAFB",
  surfaceBright: "#F3F4F6", border: "#E5E7EB", borderBright: "#D1D5DB",
  accent: "#16A34A", accentDim: "#15803D", accentGlow: "rgba(22,163,74,.1)",
  accentBorder: "rgba(22,163,74,.22)", text: "#111827", textMid: "#4B5563",
  textDim: "#9CA3AF", red: "#DC2626", blue: "#2563EB", green: "#16A34A",
  purple: "#7C3AED",
};

export const STEPS = [
  { id: 1, label: "Account",   icon: User,      desc: "Personal info" },
  { id: 2, label: "Contact",   icon: Phone,     desc: "Phone & address" },
  { id: 3, label: "Vehicle",   icon: Car,       desc: "Your car details" },
  { id: 4, label: "Documents", icon: FileText,  desc: "License & ID" },
  { id: 5, label: "Verify",    icon: Shield,    desc: "Final review" },
];