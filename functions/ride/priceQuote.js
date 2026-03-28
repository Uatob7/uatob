const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });

// ── LAUNCH PRICING TABLE ─────────────────────────────────
const PRICING = {
  standard: {
    id: "standard",
    label: "Standard",
    desc: "Affordable everyday rides",
    eta: "2–4 min",
    capacity: "4 seats",
    base: 2.25,
    perMile: 0.95,
    perMin: 0.16,
    bookingFee: 0.99,
    minimumFare: 6.99,
  },
  premium: {
    id: "premium",
    label: "Premium",
    desc: "Luxury ride experience",
    eta: "3–5 min",
    capacity: "4 seats",
    base: 4.75,
    perMile: 1.45,
    perMin: 0.26,
    bookingFee: 1.99,
    minimumFare: 11.99,
  },
  xl: {
    id: "xl",
    label: "XL",
    desc: "More room for groups",
    eta: "4–6 min",
    capacity: "6 seats",
    base: 3.75,
    perMile: 1.22,
    perMin: 0.22,
    bookingFee: 1.49,
    minimumFare: 9.99,
  },
};

// ── HELPERS ──────────────────────────────────────────────
function round2(num) {
  return Number(Number(num).toFixed(2));
}

function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

// ── SURGE (DISABLED) ─────────────────────────────────────
function getSurge() {
  return 1; // Always no surge
}

// ── CORE PRICE CALCULATOR ────────────────────────────────
function calculateRidePrice(pricing, miles, minutes, surgeMultiplier) {
  const base = pricing.base;
  const distance = miles * pricing.perMile;
  const time = minutes * pricing.perMin;
  const bookingFee = pricing.bookingFee;

  const subtotalBeforeMinimum = base + distance + time + bookingFee;
  const surgedSubtotal = subtotalBeforeMinimum * surgeMultiplier;
  const total = Math.max(surgedSubtotal, pricing.minimumFare || 0);

  const surge = surgedSubtotal - subtotalBeforeMinimum;
  const minimumAdjustment =
    total > surgedSubtotal ? total - surgedSubtotal : 0;

  return {
    id: pricing.id,
    label: pricing.label,
    desc: pricing.desc,
    eta: pricing.eta,
    capacity: pricing.capacity,
    total: round2(total),
    breakdown: {
      base: round2(base),
      distance: round2(distance),
      time: round2(time),
      bookingFee: round2(bookingFee),
      surge: round2(surge > 0 ? surge : 0),
      minimumFareAdjustment: round2(
        minimumAdjustment > 0 ? minimumAdjustment : 0
      ),
      minimumFare: round2(pricing.minimumFare || 0),
      subtotalBeforeMinimum: round2(subtotalBeforeMinimum),
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

  const cleanMiles = Number(miles);
  const cleanMinutes = Number(minutes);

  if (Number.isNaN(cleanMiles) || Number.isNaN(cleanMinutes)) {
    return "Miles and minutes must be valid numbers";
  }

  if (!Number.isFinite(cleanMiles) || !Number.isFinite(cleanMinutes)) {
    return "Miles and minutes must be finite numbers";
  }

  if (cleanMiles < 0 || cleanMinutes < 0) {
    return "Miles and minutes cannot be negative";
  }

  if (cleanMiles > 300) {
    return "Miles value is too large";
  }

  if (cleanMinutes > 600) {
    return "Minutes value is too large";
  }

  return null;
}

// ── PRICE QUOTE FUNCTION ─────────────────────────────────
exports.priceQuote = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // CORS preflight
      if (req.method === "OPTIONS") {
        return res.status(204).send("");
      }

      // Only POST allowed
      if (req.method !== "POST") {
        return res.status(405).json({
          ok: false,
          error: "Method not allowed. Use POST.",
        });
      }

      const { miles, minutes } = req.body || {};

      const validationError = validateTripInput(miles, minutes);
      if (validationError) {
        return res.status(400).json({
          ok: false,
          error: validationError,
        });
      }

      const cleanMiles = clamp(round2(Number(miles)), 0, 300);
      const cleanMinutes = clamp(round2(Number(minutes)), 0, 600);
      const surgeMultiplier = getSurge();

      const rides = {
        standard: calculateRidePrice(
          PRICING.standard,
          cleanMiles,
          cleanMinutes,
          surgeMultiplier
        ),
        premium: calculateRidePrice(
          PRICING.premium,
          cleanMiles,
          cleanMinutes,
          surgeMultiplier
        ),
        xl: calculateRidePrice(
          PRICING.xl,
          cleanMiles,
          cleanMinutes,
          surgeMultiplier
        ),
      };

      return res.status(200).json({
        ok: true,
        trip: {
          miles: cleanMiles,
          minutes: cleanMinutes,
        },
        surgeMultiplier,
        rides,
        currency: "USD",
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Pricing error:", error);
      return res.status(500).json({
        ok: false,
        error: "Failed to calculate prices",
      });
    }
  });
});