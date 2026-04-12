const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ── PRICING TABLE ────────────────────────────────────────
const PRICING = {
  economy: {
    id: "economy",
    label: "Economy",
    desc: "Affordable everyday rides",
    eta: "4–8 min",
    capacity: 4,
    base: 1.5,
    perMile: 1.2,
    perMin: 0.18,
    bookingFee: 0.99,
    minimumFare: 4.99,
  },
  standard: {
    id: "standard",
    label: "Standard",
    desc: "Comfortable daily rides",
    eta: "2–5 min",
    capacity: 4,
    base: 2.0,
    perMile: 1.65,
    perMin: 0.25,
    bookingFee: 1.29,
    minimumFare: 6.99,
  },
  premium: {
    id: "premium",
    label: "Premium",
    desc: "Luxury rides",
    eta: "5–10 min",
    capacity: 4,
    base: 4.0,
    perMile: 3.25,
    perMin: 0.5,
    bookingFee: 1.99,
    minimumFare: 11.99,
  },
  xl: {
    id: "xl",
    label: "XL",
    desc: "Large group rides",
    eta: "5–9 min",
    capacity: 6,
    base: 2.5,
    perMile: 1.9,
    perMin: 0.3,
    bookingFee: 1.49,
    minimumFare: 8.49,
  },
};

// ── HELPERS ──────────────────────────────────────────────
function round2(n) {
  return Number(Number(n).toFixed(2));
}

function clamp(n, min, max) {
  return Math.min(Math.max(Number(n), min), max);
}

// ── PRICE CALCULATION ────────────────────────────────────
function calculateRidePrice(p, miles, minutes) {
  const base = p.base;
  const distance = round2(miles * p.perMile);
  const time = round2(minutes * p.perMin);
  const fee = p.bookingFee;

  const subtotal = round2(base + distance + time + fee);
  const hitMin = subtotal < p.minimumFare;

  const total = round2(hitMin ? p.minimumFare : subtotal);

  let receipt;

  if (!hitMin) {
    receipt = [
      { key: "baseFare", label: "Base fare", amount: round2(base) },
      { key: "distance", label: "Distance", amount: distance, note: `${miles} mi` },
      { key: "time", label: "Time", amount: time, note: `${minutes} min` },
      { key: "bookingFee", label: "Booking fee", amount: round2(fee) },
    ];
  } else {
    const scale = total / subtotal;

    const baseA = round2(base * scale);
    const distA = round2(distance * scale);
    const timeA = round2(time * scale);
    const feeA = round2(total - baseA - distA - timeA);

    receipt = [
      { key: "baseFare", label: "Base fare", amount: baseA },
      { key: "distance", label: "Distance", amount: distA, note: `${miles} mi` },
      { key: "time", label: "Time", amount: timeA, note: `${minutes} min` },
      { key: "bookingFee", label: "Booking fee", amount: feeA },
      {
        key: "minimumFareNote",
        label: "Minimum fare applied",
        amount: 0,
        note: `${p.label} minimum $${p.minimumFare}`,
      },
    ];
  }

  const breakdown = Object.fromEntries(receipt.map(r => [r.key, r.amount]));

  return {
    id: p.id,
    label: p.label,
    desc: p.desc,
    eta: p.eta,
    capacity: p.capacity,
    total,
    receipt,
    breakdown,
  };
}

// ── VALIDATION ───────────────────────────────────────────
function validate(miles, minutes) {
  if (miles == null || minutes == null) return "Missing fields";

  const m = Number(miles);
  const n = Number(minutes);

  if (!Number.isFinite(m) || !Number.isFinite(n))
    return "Invalid numbers";

  if (m < 0 || n < 0) return "Negative values not allowed";
  if (m > 300) return "Miles too large";
  if (n > 600) return "Minutes too large";

  return null;
}

// ── MAIN FUNCTION ────────────────────────────────────────
exports.Price = onRequest(
  { region: "us-central1", invoker: "public" },
  (req, res) => {
    cors(req, res, async () => {
      try {
        if (req.method === "OPTIONS") return res.status(204).send("");
        if (req.method !== "POST") {
          return res.status(405).json({ ok: false, error: "POST only" });
        }

        const body = req.body || {};

        const miles = body.miles;
        const minutes = body.durationMin;

        const err = validate(miles, minutes);
        if (err) return res.status(400).json({ ok: false, error: err });

        const cleanMiles = clamp(round2(miles), 0, 300);
        const cleanMinutes = clamp(round2(minutes), 0, 600);

        const rides = Object.fromEntries(
          Object.entries(PRICING).map(([k, v]) => [
            k,
            calculateRidePrice(v, cleanMiles, cleanMinutes),
          ])
        );

        // ── SAVE TO FIRESTORE (Search DB) ─────────────────
        await db.collection("Search").add({
          pickup: body.pickup || null,
          dropoff: body.dropoff || null,

          pickupCity: body.pickupCity || null,
          dropoffCity: body.dropoffCity || null,

          pickupLat: body.pickupLat || null,
          pickupLng: body.pickupLng || null,
          dropoffLat: body.dropoffLat || null,
          dropoffLng: body.dropoffLng || null,

          miles: cleanMiles,
          minutes: cleanMinutes,

          polyline: body.polyline || null, // ✅ IMPORTANT

          rides, // full pricing snapshot

          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return res.status(200).json({
          ok: true,
          trip: { miles: cleanMiles, minutes: cleanMinutes },
          rides,
          currency: "USD",
          generatedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.error(e);
        return res.status(500).json({ ok: false, error: "Server error" });
      }
    });
  }
);