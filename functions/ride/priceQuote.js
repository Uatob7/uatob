const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });

// ── PRICING STRATEGY ─────────────────────────────────────
//
// 2026 market benchmarks (per RideWise / industry data):
//   UberX:      base $3.50 | $1.50/mi | $0.40/min | booking ~$2.50
//   Lyft Std:   base $3.00 | $1.20/mi | $0.35/min | booking ~$2.00
//   UberXL:     base $4.50 | $2.10/mi | $0.50/min
//   Uber Black: base $8.00 | $3.50/mi | $0.65/min
//
// Our positioning: 20–30% cheaper than Uber, 10–15% cheaper than Lyft.
// Drivers still earn fairly — we take a smaller platform cut.
//
// Benchmark: 5 miles / 20 min trip
//   UberX:    $3.50 + (5×$1.50) + (20×$0.40) + $2.50 = $21.50
//   Lyft Std: $3.00 + (5×$1.20) + (20×$0.35) + $2.00 = $18.00
//   OURS Std: $2.00 + (5×$0.85) + (20×$0.18) + $1.25 = $12.10  ✓ ~33% below Uber
//
// ─────────────────────────────────────────────────────────

const PRICING = {
  // ── STANDARD ─────────────────────────────────────────
  // Everyday rides. Target: ~30% below UberX.
  standard: {
    id: "standard",
    label: "Standard",
    desc: "Affordable everyday rides",
    eta: "2–4 min",
    capacity: "4 seats",
    base: 2.00,
    perMile: 0.85,
    perMin: 0.18,
    bookingFee: 1.25,
    minimumFare: 5.99,
    // Uber equiv at 5mi/20min: ~$21.50 → ours: ~$12.35
  },

  // ── PREMIUM ───────────────────────────────────────────
  // Upscale vehicles. Target: ~25% below Uber Comfort ($24–28 range).
  premium: {
    id: "premium",
    label: "Premium",
    desc: "Luxury vehicles, top-rated drivers",
    eta: "3–6 min",
    capacity: "4 seats",
    base: 3.50,
    perMile: 1.15,
    perMin: 0.26,
    bookingFee: 1.75,
    minimumFare: 9.99,
    // Uber Comfort at 5mi/20min: ~$27.00 → ours: ~$18.00
  },

  // ── XL ────────────────────────────────────────────────
  // Groups up to 6. Target: ~25% below UberXL ($28–34 range).
  xl: {
    id: "xl",
    label: "XL",
    desc: "Spacious rides for groups",
    eta: "4–7 min",
    capacity: "6 seats",
    base: 3.00,
    perMile: 1.05,
    perMin: 0.22,
    bookingFee: 1.49,
    minimumFare: 8.99,
    // UberXL at 5mi/20min: ~$36.50 → ours: ~$22.75 (~38% cheaper)
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
// Currently disabled (always 1x).
// To enable: replace with time-based or demand-based logic.
// Example: return hour >= 17 && hour <= 19 ? 1.3 : 1.0;
function getSurge() {
  return 1;
}

// ── CORE CALCULATOR ──────────────────────────────────────
function calculateRidePrice(pricing, miles, minutes, surgeMultiplier) {
  const base       = pricing.base;
  const distance   = round2(miles   * pricing.perMile);
  const time       = round2(minutes * pricing.perMin);
  const bookingFee = pricing.bookingFee;

  const subtotal        = base + distance + time + bookingFee;
  const surgedSubtotal  = round2(subtotal * surgeMultiplier);
  const total           = round2(Math.max(surgedSubtotal, pricing.minimumFare));

  const surgeAmount     = round2(surgeMultiplier > 1 ? surgedSubtotal - subtotal : 0);
  const minimumAdj      = round2(total > surgedSubtotal ? total - surgedSubtotal : 0);

  // Savings vs Uber benchmarks (informational only, shown in UI)
  const uberBenchmarks = {
    standard: round2(3.50 + miles * 1.50 + minutes * 0.40 + 2.50),
    premium:  round2(5.00 + miles * 1.85 + minutes * 0.45 + 2.50),
    xl:       round2(4.50 + miles * 2.10 + minutes * 0.50 + 2.50),
  };
  const uberPrice   = uberBenchmarks[pricing.id] ?? null;
  const savingsAmt  = uberPrice ? round2(uberPrice - total) : null;
  const savingsPct  = uberPrice ? Math.round(((uberPrice - total) / uberPrice) * 100) : null;

  return {
    id:       pricing.id,
    label:    pricing.label,
    desc:     pricing.desc,
    eta:      pricing.eta,
    capacity: pricing.capacity,
    total:    total,

    breakdown: {
      base:                    round2(base),
      distance:                round2(distance),
      time:                    round2(time),
      bookingFee:              round2(bookingFee),
      surge:                   surgeAmount,
      minimumFareAdjustment:   minimumAdj,
      minimumFare:             round2(pricing.minimumFare),
      subtotalBeforeMinimum:   round2(subtotal),
    },

    // Rate card (used in UI fare breakdown labels)
    meta: {
      perMile: pricing.perMile,
      perMin:  pricing.perMin,
    },

    // Savings vs Uber (optional — use in UI to show "Save $X vs Uber")
    savings: {
      vsUber:    savingsAmt,
      vsUberPct: savingsPct,
      uberPrice: uberPrice,
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
// POST { miles, minutes }
// Returns { ok, trip, surgeMultiplier, rides, currency, generatedAt }
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

      // Log for monitoring
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
