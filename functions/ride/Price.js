const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const PRICING = {
  economy:  { id: "economy",  label: "Economy",  desc: "Affordable everyday rides", eta: "7–20 min", capacity: 4, base: 1.5,  perMile: 1.2,  perMin: 0.18, bookingFee: 0.99, minimumFare: 4.99  },
  standard: { id: "standard", label: "Standard", desc: "Comfortable daily rides",   eta: "2–7 min",  capacity: 4, base: 2.0,  perMile: 1.65, perMin: 0.25, bookingFee: 1.29, minimumFare: 6.99  },
  premium:  { id: "premium",  label: "Premium",  desc: "Luxury rides",              eta: "5–10 min", capacity: 4, base: 4.0,  perMile: 3.25, perMin: 0.5,  bookingFee: 1.99, minimumFare: 11.99 },
  xl:       { id: "xl",       label: "XL",       desc: "Large group rides",         eta: "5–9 min",  capacity: 6, base: 2.5,  perMile: 1.9,  perMin: 0.3,  bookingFee: 1.49, minimumFare: 8.49  },
};

const round2 = (n) => Number(Number(n).toFixed(2));
const clamp  = (n, min, max) => Math.min(Math.max(Number(n), min), max);

function calculateRidePrice(p, miles, minutes) {
  const base     = p.base;
  const distance = round2(miles * p.perMile);
  const time     = round2(minutes * p.perMin);
  const fee      = p.bookingFee;
  const subtotal = round2(base + distance + time + fee);
  const hitMin   = subtotal < p.minimumFare;
  const total    = round2(hitMin ? p.minimumFare : subtotal);

  let receipt;
  if (!hitMin) {
    receipt = [
      { key: "baseFare",   label: "Base fare",   amount: round2(base) },
      { key: "distance",   label: "Distance",    amount: distance,   note: `${miles} mi` },
      { key: "time",       label: "Time",        amount: time,       note: `${minutes} min` },
      { key: "bookingFee", label: "Booking fee", amount: round2(fee) },
    ];
  } else {
    const scale = total / subtotal;
    const baseA = round2(base * scale);
    const distA = round2(distance * scale);
    const timeA = round2(time * scale);
    const feeA  = round2(total - baseA - distA - timeA);
    receipt = [
      { key: "baseFare",        label: "Base fare",            amount: baseA },
      { key: "distance",        label: "Distance",             amount: distA, note: `${miles} mi` },
      { key: "time",            label: "Time",                 amount: timeA, note: `${minutes} min` },
      { key: "bookingFee",      label: "Booking fee",          amount: feeA },
      { key: "minimumFareNote", label: "Minimum fare applied", amount: 0, note: `${p.label} minimum $${p.minimumFare}` },
    ];
  }

  return { id: p.id, label: p.label, desc: p.desc, eta: p.eta, capacity: p.capacity, total, receipt };
}

exports.Price = onCall(
   {
    region: "us-east1",
  },
  async (request) => {
    const miles   = Number(request.data?.miles);
    const minutes = Number(request.data?.durationMin);

    if (!Number.isFinite(miles) || !Number.isFinite(minutes))
      throw new HttpsError("invalid-argument", "Invalid numbers");
    if (miles < 0 || minutes < 0)
      throw new HttpsError("invalid-argument", "Negative values not allowed");
    if (miles > 300)
      throw new HttpsError("invalid-argument", "Miles too large");
    if (minutes > 600)
      throw new HttpsError("invalid-argument", "Minutes too large");

    const cleanMiles   = clamp(round2(miles),   0, 300);
    const cleanMinutes = clamp(round2(minutes), 0, 600);

    const rides = Object.fromEntries(
      Object.entries(PRICING).map(([k, v]) => [k, calculateRidePrice(v, cleanMiles, cleanMinutes)])
    );

    try {
      await db.collection("Search").add({
        pickup:    request.data?.pickup    ?? null,
        dropoff:   request.data?.dropoff   ?? null,
        miles:     cleanMiles,
        minutes:   cleanMinutes,
        polyline:  request.data?.polyline  ?? null,
        rides,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (dbErr) {
      console.error("Firestore write failed:", dbErr.message);
    }

    return {
      trip:        { miles: cleanMiles, minutes: cleanMinutes },
      rides,
      currency:    "USD",
      ok:          true,
      generatedAt: new Date().toISOString(),
    };
  }
);