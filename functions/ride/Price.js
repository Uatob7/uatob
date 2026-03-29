const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });

// ── PRICING TABLE ────────────────────────────────────────
const PRICING = {
  economy: {
    id: "economy",
    label: "Economy",
    desc: "Affordable everyday rides",
    eta: "4–8 min",
    capacity: 4,
    base: 2.0,
    perMile: 0.85,
    perMin: 0.15,
    bookingFee: 1.49,
    minimumFare: 5.5,
    color: "#16A34A",
  },

  standard: {
    id: "standard",
    label: "Standard",
    desc: "Comfortable daily rides",
    eta: "2–5 min",
    capacity: 4,
    base: 2.5,
    perMile: 1.15,
    perMin: 0.20,
    bookingFee: 1.99,
    minimumFare: 7.5,
    color: "#2563EB",
  },

  premium: {
    id: "premium",
    label: "Premium",
    desc: "Luxury vehicles & premium service",
    eta: "5–10 min",
    capacity: 4,
    base: 5.0,
    perMile: 2.75,
    perMin: 0.45,
    bookingFee: 2.99,
    minimumFare: 15.0,
    color: "#7C3AED",
  },

  xl: {
    id: "xl",
    label: "XL",
    desc: "Larger vehicles for groups",
    eta: "5–9 min",
    capacity: 6,
    base: 3.0,
    perMile: 1.45,
    perMin: 0.25,
    bookingFee: 1.99,
    minimumFare: 9.5,
    color: "#D97706",
  },
};

// ── HELPERS ──────────────────────────────────────────────
function round2(num) {
  return Number(Number(num).toFixed(2));
}

function clamp(num, min, max) {
  return Math.min(Math.max(Number(num), min), max);
}

// ── SURGE (static for now) ───────────────────────────────
function getSurge() {
  return 1;
}

// ── PRICE CALCULATOR ─────────────────────────────────────
function calculateRidePrice(pricing, miles, minutes, surgeMultiplier) {
  const base = pricing.base;
  const distance = round2(miles * pricing.perMile);
  const time = round2(minutes * pricing.perMin);
  const bookingFee = pricing.bookingFee;

  const subtotal = base + distance + time + bookingFee;

  const surgedSubtotal = round2(subtotal * surgeMultiplier);

  const total = round2(
    Math.max(surgedSubtotal, pricing.minimumFare)
  );

  const surgeAmount = round2(
    surgeMultiplier > 1 ? surgedSubtotal - subtotal : 0
  );

  const minimumAdj = round2(
    total > surgedSubtotal ? total - surgedSubtotal : 0
  );

  return {
    id: pricing.id,
    label: pricing.label,
    desc: pricing.desc,
    eta: pricing.eta,
    capacity: pricing.capacity,
    total,

    breakdown: {
      base: round2(base),
      distance,
      time,
      bookingFee: round2(bookingFee),
      surge: surgeAmount,
      minimumFareAdjustment: minimumAdj,
      minimumFare: pricing.minimumFare,
      subtotalBeforeMinimum: round2(subtotal),
    },

    meta: {
      perMile: pricing.perMile,
      perMin: pricing.perMin,
    },
  };
}

// ── VALIDATION ───────────────────────────────────────────
function validateTripInput(miles, minutes) {
  if (miles == null || minutes == null) {
    return "Missing required fields: miles, minutes";
  }

  const m = Number(miles);
  const mn = Number(minutes);

  if (!Number.isFinite(m)) return "miles must be a valid number";
  if (!Number.isFinite(mn)) return "minutes must be a valid number";
  if (m < 0) return "miles cannot be negative";
  if (mn < 0) return "minutes cannot be negative";
  if (m > 300) return "miles too large (max 300)";
  if (mn > 600) return "minutes too large (max 600)";

  return null;
}

// ── MAIN FUNCTION ────────────────────────────────────────
const Price = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method === "OPTIONS") {
        return res.status(204).send("");
      }

      if (req.method !== "POST") {
        return res.status(405).json({
          ok: false,
          error: "Method not allowed. Use POST.",
        });
      }

      const tripData = req.body || {};

      const miles = tripData.miles;
      const durationMin = tripData.durationMin;

      console.log("Miles:", miles);
      console.log("Duration (min):", durationMin);

      const validationError = validateTripInput(miles, durationMin);
      if (validationError) {
        return res.status(400).json({
          ok: false,
          error: validationError,
        });
      }

      const cleanMiles = clamp(round2(miles), 0, 300);
      const cleanMinutes = clamp(round2(durationMin), 0, 600);

      const surge = getSurge();

      // 🔥 AUTO-GENERATE ALL RIDES
      const rides = Object.fromEntries(
        Object.entries(PRICING).map(([key, config]) => [
          key,
          calculateRidePrice(config, cleanMiles, cleanMinutes, surge),
        ])
      );

      console.log(
        `[Price] ${cleanMiles}mi / ${cleanMinutes}min`,
        Object.fromEntries(
          Object.entries(rides).map(([k, v]) => [k, `$${v.total}`])
        )
      );

      return res.status(200).json({
        ok: true,
        trip: {
          miles: cleanMiles,
          minutes: cleanMinutes,
        },
        surgeMultiplier: surge,
        rides,
        currency: "USD",
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[Price] Error:", err);

      return res.status(500).json({
        ok: false,
        error: "Failed to calculate prices",
      });
    }
  });
});

module.exports = { Price };