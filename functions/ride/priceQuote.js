const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });

// ── PRICING TABLE ────────────────────────────────────────
const PRICING = {
  standard: {
    base: 5.0,
    perMile: 1.15,
    perMin: 0.32,
    bookingFee: 2.25,
    minimumFare: 10.0,
  },
  premium: {
    base: 9.5,
    perMile: 1.95,
    perMin: 0.55,
    bookingFee: 3.25,
    minimumFare: 17.0,
  },
  xl: {
    base: 7.75,
    perMile: 1.6,
    perMin: 0.44,
    bookingFee: 2.75,
    minimumFare: 13.5,
  },
};

// ── HELPERS ──────────────────────────────────────────────
function round2(num) {
  return Number(Number(num).toFixed(2));
}

function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

// ── SURGE LOGIC ──────────────────────────────────────────
// Keep this simple for launch. You can later replace this
// with demand-based logic, event logic, airport logic, etc.
function getSurge() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Sun, 6 = Sat

  // Weekend late night
  if ((day === 5 || day === 6 || day === 0) && (hour >= 22 || hour <= 2)) {
    return 1.35;
  }

  // Morning rush
  if (hour >= 7 && hour <= 9) {
    return 1.2;
  }

  // Evening rush
  if (hour >= 17 && hour <= 19) {
    return 1.25;
  }

  // Late night weekdays
  if (hour >= 22 || hour <= 2) {
    return 1.2;
  }

  return 1;
}

// ── CORE PRICE CALCULATOR ────────────────────────────────
function calculateRidePrice(pricing, miles, minutes, surgeMultiplier) {
  const base = pricing.base;
  const distance = miles * pricing.perMile;
  const time = minutes * pricing.perMin;
  const bookingFee = pricing.bookingFee;

  const rawSubtotal = base + distance + time + bookingFee;
  const surgedTotal = rawSubtotal * surgeMultiplier;
  const total = Math.max(surgedTotal, pricing.minimumFare || 0);

  // "Surge" shown in breakdown should reflect ONLY uplift
  // beyond the raw subtotal (including minimum fare effect if applicable)
  const surge = total - rawSubtotal;

  return {
    total: round2(total),
    breakdown: {
      base: round2(base),
      distance: round2(distance),
      time: round2(time),
      bookingFee: round2(bookingFee),
      surge: round2(surge > 0 ? surge : 0),
      minimumFare: round2(pricing.minimumFare || 0),
      subtotalBeforeSurge: round2(rawSubtotal),
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

  // Basic abuse protection / sanity caps
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
      // Handle preflight
      if (req.method === "OPTIONS") {
        return res.status(204).send("");
      }

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

      // Clean values
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