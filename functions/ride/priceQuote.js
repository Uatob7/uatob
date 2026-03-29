const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });

// ── PRICING TABLE ────────────────────────────────────────
const PRICING = {
  standard: {
    id: "standard",
    label: "Standard",
    desc: "Affordable everyday rides",
    eta: "2–4 min",
    capacity: "4 seats",
    base: 1.50,
    perMile: 0.65,
    perMin: 0.12,
    bookingFee: 0.99,
    minimumFare: 4.99,
  },
  premium: {
    id: "premium",
    label: "Premium",
    desc: "Luxury vehicles, top-rated drivers",
    eta: "3–6 min",
    capacity: "4 seats",
    base: 2.75,
    perMile: 0.95,
    perMin: 0.20,
    bookingFee: 1.49,
    minimumFare: 7.99,
  },
  xl: {
    id: "xl",
    label: "XL",
    desc: "Spacious rides for groups",
    eta: "4–7 min",
    capacity: "6 seats",
    base: 2.25,
    perMile: 0.80,
    perMin: 0.16,
    bookingFee: 1.25,
    minimumFare: 6.99,
  },
};

// ── HELPERS ──────────────────────────────────────────────
function round2(num) {
  return Number(Number(num).toFixed(2));
}

function clamp(num, min, max) {
  return Math.min(Math.max(Number(num), min), max);
}

// ── SURGE ────────────────────────────────────────────────
function getSurge() {
  return 1;
}

// ── CORE CALCULATOR ──────────────────────────────────────
function calculateRidePrice(pricing, miles, minutes, surgeMultiplier) {
  const base       = pricing.base;
  const distance   = round2(miles   * pricing.perMile);
  const time       = round2(minutes * pricing.perMin);
  const bookingFee = pricing.bookingFee;

  const subtotal       = base + distance + time + bookingFee;
  const surgedSubtotal = round2(subtotal * surgeMultiplier);
  const total          = round2(Math.max(surgedSubtotal, pricing.minimumFare));

  const surgeAmount = round2(surgeMultiplier > 1 ? surgedSubtotal - subtotal : 0);
  const minimumAdj  = round2(total > surgedSubtotal ? total - surgedSubtotal : 0);

  return {
    id:       pricing.id,
    label:    pricing.label,
    desc:     pricing.desc,
    eta:      pricing.eta,
    capacity: pricing.capacity,
    total,

    breakdown: {
      base:                  round2(base),
      distance:              round2(distance),
      time:                  round2(time),
      bookingFee:            round2(bookingFee),
      surge:                 surgeAmount,
      minimumFareAdjustment: minimumAdj,
      minimumFare:           round2(pricing.minimumFare),
      subtotalBeforeMinimum: round2(subtotal),
    },

    meta: {
      perMile: pricing.perMile,
      perMin:  pricing.perMin,
    },
  };
}

// ── VALIDATION ───────────────────────────────────────────
function validateTripInput(miles, minutes) {
  if (miles == null || minutes == null) {
    return "Missing required fields: miles, minutes";
  }
  const m  = Number(miles);
  const mn = Number(minutes);
  if (Number.isNaN(m)  || !Number.isFinite(m))  return "miles must be a valid finite number";
  if (Number.isNaN(mn) || !Number.isFinite(mn)) return "minutes must be a valid finite number";
  if (m  < 0) return "miles cannot be negative";
  if (mn < 0) return "minutes cannot be negative";
  if (m  > 300) return "miles value is too large (max 300)";
  if (mn > 600) return "minutes value is too large (max 600)";
  return null;
}

// ── PRICE QUOTE ENDPOINT ─────────────────────────────────
exports.priceQuote = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method === "OPTIONS") return res.status(204).send("");
      if (req.method !== "POST") {
        return res.status(405).json({ ok: false, error: "Method not allowed. Use POST." });
      }

      const { miles, minutes } = req.body || {};

      const validationError = validateTripInput(miles, minutes);
      if (validationError) {
        return res.status(400).json({ ok: false, error: validationError });
      }

      const cleanMiles   = clamp(round2(Number(miles)),   0, 300);
      const cleanMinutes = clamp(round2(Number(minutes)), 0, 600);
      const surge        = getSurge();

      const rides = {
        standard: calculateRidePrice(PRICING.standard, cleanMiles, cleanMinutes, surge),
        premium:  calculateRidePrice(PRICING.premium,  cleanMiles, cleanMinutes, surge),
        xl:       calculateRidePrice(PRICING.xl,        cleanMiles, cleanMinutes, surge),
      };

      console.log(
        `[priceQuote] ${cleanMiles}mi / ${cleanMinutes}min → ` +
        `std $${rides.standard.total} | prem $${rides.premium.total} | xl $${rides.xl.total}`
      );

      return res.status(200).json({
        ok:              true,
        trip:            { miles: cleanMiles, minutes: cleanMinutes },
        surgeMultiplier: surge,
        rides,
        currency:        "USD",
        generatedAt:     new Date().toISOString(),
      });

    } catch (err) {
      console.error("[priceQuote] Error:", err);
      return res.status(500).json({ ok: false, error: "Failed to calculate prices" });
    }
  });
});
