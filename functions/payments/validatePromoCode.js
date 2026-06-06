// functions/src/validatePromoCode.js
//
// Callable: "validatePromoCode"
// Region:   us-east1
//
// Request:  { code: string, uid?: string, fareEstimate?: number }
// Response: { valid: true,  discountType: 'percent'|'flat', discountValue: number, message: string }
//         | { valid: false, message: string }
//
// Firestore schema — collection: "promoCodes"
// ─────────────────────────────────────────────────────────────────────
// Document ID = promo code string (stored UPPERCASED, e.g. "UATOB10")
//
// Fields:
//   active          boolean   — master on/off switch
//   discountType    string    — "percent" | "flat"
//   discountValue   number    — e.g. 10 (= 10% off) or 5.00 (= $5 off)
//   minFare         number    — minimum fareEstimate to be eligible (default 0)
//   maxUses         number    — total redemptions allowed (0 = unlimited)
//   usedCount       number    — running redemption count
//   maxUsesPerUser  number    — per-UID redemption limit (0 = unlimited)
//   expiresAt       Timestamp — null = never expires
//   createdAt       Timestamp
//   description     string    — internal label, e.g. "Launch promo – 10% off"
//
// Sub-collection per code: "redemptions/{uid}"
//   Fields: { count: number, lastUsedAt: Timestamp }

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const db = getFirestore();

exports.validatePromoCode = onCall(
  { region: "us-east1" },
  async (request) => {
    const { code, uid, fareEstimate } = request.data ?? {};

    // ── 1. Basic input validation ──────────────────────────────────────
    if (!code || typeof code !== "string") {
      throw new HttpsError("invalid-argument", "A promo code is required.");
    }

    const normalized = code.trim().toUpperCase();

    if (normalized.length < 3 || normalized.length > 24) {
      return { valid: false, message: "That code doesn't look right." };
    }

    // ── 2. Fetch code document ─────────────────────────────────────────
    const codeRef  = db.collection("promoCodes").doc(normalized);
    const codeSnap = await codeRef.get();

    if (!codeSnap.exists) {
      return { valid: false, message: "Promo code not found." };
    }

    const promo = codeSnap.data();

    // ── 3. Active check ────────────────────────────────────────────────
    if (!promo.active) {
      return { valid: false, message: "This promo code is no longer active." };
    }

    // ── 4. Expiry check ────────────────────────────────────────────────
    if (promo.expiresAt) {
      const expiresMs = promo.expiresAt.toMillis?.() ?? promo.expiresAt._seconds * 1000;
      if (Date.now() > expiresMs) {
        return { valid: false, message: "This promo code has expired." };
      }
    }

    // ── 5. Global usage cap ────────────────────────────────────────────
    const maxUses = promo.maxUses ?? 0;
    if (maxUses > 0 && (promo.usedCount ?? 0) >= maxUses) {
      return { valid: false, message: "This promo code has reached its usage limit." };
    }

    // ── 6. Per-user usage cap (requires uid) ───────────────────────────
    const maxPerUser = promo.maxUsesPerUser ?? 0;
    if (maxPerUser > 0 && uid) {
      const redemptionSnap = await codeRef
        .collection("redemptions")
        .doc(uid)
        .get();

      if (redemptionSnap.exists) {
        const { count = 0 } = redemptionSnap.data();
        if (count >= maxPerUser) {
          return {
            valid: false,
            message:
              maxPerUser === 1
                ? "You've already used this promo code."
                : `You've reached the ${maxPerUser}-use limit for this code.`,
          };
        }
      }
    }

    // ── 7. Minimum fare check ──────────────────────────────────────────
    const minFare = promo.minFare ?? 0;
    if (minFare > 0 && fareEstimate !== undefined && fareEstimate !== null) {
      if (Number(fareEstimate) < minFare) {
        return {
          valid: false,
          message: `This code requires a minimum fare of $${minFare.toFixed(2)}.`,
        };
      }
    }

    // ── 8. Validate stored fields ──────────────────────────────────────
    const discountType  = promo.discountType;
    const discountValue = promo.discountValue;

    if (!["percent", "flat"].includes(discountType)) {
      // Malformed doc — fail gracefully, don't expose internals
      console.error(`[validatePromoCode] Malformed promo doc: ${normalized}`, promo);
      return { valid: false, message: "This promo code is invalid." };
    }

    if (typeof discountValue !== "number" || discountValue <= 0) {
      console.error(`[validatePromoCode] Bad discountValue on: ${normalized}`, promo);
      return { valid: false, message: "This promo code is invalid." };
    }

    // ── 9. All checks passed ───────────────────────────────────────────
    return {
      valid:         true,
      discountType,
      discountValue,
      message:
        discountType === "percent"
          ? `${discountValue}% off applied!`
          : `$${discountValue.toFixed(2)} off applied!`,
    };
  }
);


// ── BONUS: recordPromoRedemption ───────────────────────────────────────
//
// Call this from inside cardPayment / cashPayment / cashAppPayment
// AFTER a successful payment to commit the redemption count.
//
// Usage (inside your payment functions):
//   if (bookingPayload.promoCode) {
//     await recordPromoRedemption(bookingPayload.promoCode, uid);
//   }

async function recordPromoRedemption(code, uid) {
  if (!code || !uid) return;

  const normalized = code.trim().toUpperCase();
  const codeRef    = db.collection("promoCodes").doc(normalized);

  const batch = db.batch();

  // Increment global usedCount
  batch.update(codeRef, { usedCount: FieldValue.increment(1) });

  // Upsert per-user redemption record
  const redemptionRef = codeRef.collection("redemptions").doc(uid);
  batch.set(
    redemptionRef,
    {
      count:      FieldValue.increment(1),
      lastUsedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();
}

exports.recordPromoRedemption = recordPromoRedemption;
