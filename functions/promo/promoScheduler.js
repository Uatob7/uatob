// functions/promo/promoScheduler.js
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin          = require("firebase-admin");

const db = admin.firestore();

// ── Adjectives + nouns for readable codes ─────────────
const ADJECTIVES = [
  "FAST", "FREE", "BOLD", "RIDE", "SAFE", "SLICK",
  "SWIFT", "SMART", "CLEAN", "COOL", "ELITE", "PRIME",
];
const NOUNS = [
  "ORL", "UCF", "407", "TOWN", "TRIP", "LANE",
  "MOVE", "HAUL", "RUSH", "CITY", "RUN", "HOP",
];

// ── Config ─────────────────────────────────────────────
const DISCOUNT_POOLS = [
  { discountType: "percent", discountValue: 5  },
  { discountType: "percent", discountValue: 10 },
  { discountType: "flat",    discountValue: 2  },
  { discountType: "flat",    discountValue: 3  },
];

const USAGE_LIMIT = 50;   // riders who can use it before it expires
const MIN_FARE    = 6.00; // minimum fare to apply

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateCode() {
  const adj    = pickRandom(ADJECTIVES);
  const noun   = pickRandom(NOUNS);
  const suffix = Math.floor(10 + Math.random() * 90); // 10–99
  return `${adj}${noun}${suffix}`;
}

// ── Scheduled function — runs every hour ───────────────
exports.promoScheduler = onSchedule(
  {
    schedule: "every 60 minutes",
  region: "us-central1",
    timeZone: "America/New_York",
  },
  async () => {
    const now     = admin.firestore.Timestamp.now();
    const expires = admin.firestore.Timestamp.fromMillis(
      Date.now() + 60 * 60 * 1000  // valid for exactly 1 hour
    );

    const discount = pickRandom(DISCOUNT_POOLS);
    const code     = generateCode();

    const promoDoc = {
      active:        true,
      discountType:  discount.discountType,
      discountValue: discount.discountValue,
      minFare:       MIN_FARE,
      usageLimit:    USAGE_LIMIT,
      usageCount:    0,
      createdAt:     now,
      startsAt:      now,
      expiresAt:     expires,
      auto:          true,   // flag so you know it was machine-generated
    };

    // Use the code string itself as the doc ID — matches usePromo.js lookup
    await db.collection("PromoCodes").doc(code).set(promoDoc);

    console.log(`[promoScheduler] Created code ${code} — ${discount.discountType === "percent"
      ? `${discount.discountValue}% off`
      : `$${discount.discountValue} flat`} · expires ${expires.toDate().toISOString()}`);
  }
);