const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });

// ── PRICING TABLE ────────────────────────────────────────
const PRICING = {
  economy: {
    id:          "economy",
    label:       "Economy",
    desc:        "Affordable everyday rides",
    eta:         "4–8 min",
    capacity:    4,
    base:        1.50,
    perMile:     1.20,
    perMin:      0.18,
    bookingFee:  0.99,
    minimumFare: 4.99,
  },

  standard: {
    id:          "standard",
    label:       "Standard",
    desc:        "Comfortable daily rides",
    eta:         "2–5 min",
    capacity:    4,
    base:        2.00,
    perMile:     1.65,
    perMin:      0.25,
    bookingFee:  1.29,
    minimumFare: 6.99,
  },

  premium: {
    id:          "premium",
    label:       "Premium",
    desc:        "Luxury vehicles & premium service",
    eta:         "5–10 min",
    capacity:    4,
    base:        4.00,
    perMile:     3.25,
    perMin:      0.50,
    bookingFee:  1.99,
    minimumFare: 11.99,
  },

  xl: {
    id:          "xl",
    label:       "XL",
    desc:        "Larger vehicles for groups",
    eta:         "5–9 min",
    capacity:    6,
    base:        2.50,
    perMile:     1.90,
    perMin:      0.30,
    bookingFee:  1.49,
    minimumFare: 8.49,
  },
};

// ── HELPERS ──────────────────────────────────────────────
function round2(num) {
  return Number(Number(num).toFixed(2));
}

function clamp(num, min, max) {
  return Math.min(Math.max(Number(num), min), max);
}

// ── PRICE CALCULATOR ─────────────────────────────────────
function calculateRidePrice(pricing, miles, minutes) {
  const rawBase       = pricing.base;
  const rawDistance   = round2(miles   * pricing.perMile);
  const rawTime       = round2(minutes * pricing.perMin);
  const rawBookingFee = pricing.bookingFee;
  const rawSubtotal   = round2(rawBase + rawDistance + rawTime + rawBookingFee);

  const hitMinimum    = rawSubtotal < pricing.minimumFare;
  const total         = round2(hitMinimum ? pricing.minimumFare : rawSubtotal);

  // ── Build receipt lines ──────────────────────────────
  // Each line has: { label, amount, note? }
  // They must sum exactly to total.

  let lines;

  if (!hitMinimum) {
    // Normal fare — straightforward receipt
    lines = [
      { key: "baseFare",   label: "Base fare",   amount: round2(rawBase) },
      { key: "distance",   label: "Distance",    amount: rawDistance,   note: `${miles} mi` },
      { key: "time",       label: "Time",         amount: rawTime,       note: `${minutes} min` },
      { key: "bookingFee", label: "Booking fee",  amount: round2(rawBookingFee) },
    ];
  } else {
    // Minimum fare applied — show real components scaled to total,
    // so every line still makes intuitive sense and sums correctly.
    const scale = total / rawSubtotal;

    const base       = round2(rawBase       * scale);
    const distance   = round2(rawDistance   * scale);
    const time       = round2(rawTime       * scale);
    // bookingFee is the remainder — absorbs floating point drift too
    const bookingFee = round2(total - base - distance - time);

    lines = [
      { key: "baseFare",         label: "Base fare",          amount: base },
      { key: "distance",         label: "Distance",           amount: distance,   note: `${miles} mi` },
      { key: "time",             label: "Time",               amount: time,       note: `${minutes} min` },
      { key: "bookingFee",       label: "Booking fee",        amount: bookingFee },
      { key: "minimumFareNote",  label: "Minimum fare applied", amount: 0,        note: `${pricing.label} min $${pricing.minimumFare}` },
    ];
  }

  // Sanity check — fix any remaining rounding drift on bookingFee
  const lineSum = round2(lines.reduce((acc, l) => acc + l.amount, 0));
  if (lineSum !== total) {
    const bfLine = lines.find(l => l.key === "bookingFee");
    if (bfLine) bfLine.amount = round2(bfLine.amount + (total - lineSum));
  }

  // Also expose a flat breakdown object for easy field access on the frontend
  const breakdown = Object.fromEntries(lines.map(l => [l.key, l.amount]));

  return {
    id:       pricing.id,
    label:    pricing.label,
    desc:     pricing.desc,
    eta:      pricing.eta,
    capacity: pricing.capacity,
    total,

    // Structured receipt — use this for rendering line items
    receipt: lines,

    // Flat map — use this for quick field access (e.g. breakdown.bookingFee)
    breakdown,

    meta: {
      perMile:     pricing.perMile,
      perMin:      pricing.perMin,
      minimumFare: pricing.minimumFare,
      hitMinimum,
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

  if (!Number.isFinite(m))  return "miles must be a valid number";
  if (!Number.isFinite(mn)) return "minutes must be a valid number";
  if (m  < 0)   return "miles cannot be negative";
  if (mn < 0)   return "minutes cannot be negative";
  if (m  > 300) return "miles too large (max 300)";
  if (mn > 600) return "minutes too large (max 600)";

  return null;
}

// ── MAIN FUNCTION ────────────────────────────────────────
exports.Price = onRequest(
  {
    region:   "us-central1",
    invoker:  "public", // ✅ makes it publicly accessible
  },
  (req, res) => {
    cors(req, res, async () => {
      try {
        if (req.method === "OPTIONS") {
          return res.status(204).send("");
        }

        if (req.method !== "POST") {
          return res.status(405).json({
            ok:    false,
            error: "Method not allowed. Use POST.",
          });
        }

        const tripData = req.body || {};

        console.log("[Price] Received trip data:", tripData);

        const miles       = tripData.miles;
        const durationMin = tripData.durationMin;

        console.log("Miles:", miles);
        console.log("Duration (min):", durationMin);

        const validationError = validateTripInput(miles, durationMin);
        if (validationError) {
          return res.status(400).json({
            ok:    false,
            error: validationError,
          });
        }

        const cleanMiles   = clamp(round2(miles),       0, 300);
        const cleanMinutes = clamp(round2(durationMin), 0, 600);

        const rides = Object.fromEntries(
          Object.entries(PRICING).map(([key, config]) => [
            key,
            calculateRidePrice(config, cleanMiles, cleanMinutes),
          ])
        );

        console.log(
          `[Price] ${cleanMiles}mi / ${cleanMinutes}min →`,
          Object.fromEntries(
            Object.entries(rides).map(([k, v]) => [k, `$${v.total}`])
          )
        );

        return res.status(200).json({
          ok:          true,
          trip:        { miles: cleanMiles, minutes: cleanMinutes },
          rides,
          currency:    "USD",
          generatedAt: new Date().toISOString(),
        });

      } catch (err) {
        console.error("[Price] Error:", err);
        return res.status(500).json({
          ok:    false,
          error: "Failed to calculate prices",
        });
      }
    });
  }
);