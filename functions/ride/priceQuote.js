const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });

// ── PRICING TABLE ────────────────────────────────────────
const PRICING = {
  standard: {
    base: 5.0,
    perMile: 1.1,
    perMin: 0.3,
    bookingFee: 2.0,
  },
  premium: {
    base: 9.0,
    perMile: 1.8,
    perMin: 0.5,
    bookingFee: 3.0,
  },
  xl: {
    base: 7.5,
    perMile: 1.5,
    perMin: 0.4,
    bookingFee: 2.5,
  },
};

// ── SURGE LOGIC ──────────────────────────────────────────
function getSurge() {
  // Replace later with real logic if needed
  return 1;
}

// ── HELPER: CALCULATE ONE RIDE TYPE ──────────────────────
function calculateRidePrice(pricing, miles, minutes, surgeMultiplier) {
  const base = pricing.base;
  const distance = miles * pricing.perMile;
  const time = minutes * pricing.perMin;
  const bookingFee = pricing.bookingFee;

  const subtotal = base + distance + time + bookingFee;
  const surgedTotal = subtotal * surgeMultiplier;
  const surge = surgedTotal - subtotal;

  return {
    total: Number(surgedTotal.toFixed(2)),
    breakdown: {
      base: Number(base.toFixed(2)),
      distance: Number(distance.toFixed(2)),
      time: Number(time.toFixed(2)),
      bookingFee: Number(bookingFee.toFixed(2)),
      surge: Number(surge.toFixed(2)),
    },
  };
}

// ── PRICE QUOTE FUNCTION ─────────────────────────────────
exports.priceQuote = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const { miles, minutes } = req.body;

      if (miles == null || minutes == null) {
        return res.status(400).json({
          error: "Missing required fields: miles, minutes",
        });
      }

      const cleanMiles = Number(miles);
      const cleanMinutes = Number(minutes);

      if (isNaN(cleanMiles) || isNaN(cleanMinutes)) {
        return res.status(400).json({
          error: "Miles and minutes must be valid numbers",
        });
      }

      const surgeMultiplier = getSurge();

      const rides = {
        standard: calculateRidePrice(PRICING.standard, cleanMiles, cleanMinutes, surgeMultiplier),
        premium: calculateRidePrice(PRICING.premium, cleanMiles, cleanMinutes, surgeMultiplier),
        xl: calculateRidePrice(PRICING.xl, cleanMiles, cleanMinutes, surgeMultiplier),
      };

      return res.status(200).json({
        surgeMultiplier,
        rides,
      });
    } catch (error) {
      console.error("Pricing error:", error);
      return res.status(500).json({
        error: "Failed to calculate prices",
      });
    }
  });
});