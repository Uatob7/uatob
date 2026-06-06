// functions/src/createPromoCode.js
//
// Callable: "createPromoCode"
// Region:   us-east1
//
// Admin-only — caller must have role: "admin" in their Firestore user doc
// or the request must come from a Firebase Admin SDK context.
//
// Request:
// {
//   code?:           string   — custom code, e.g. "ORLANDO20". Auto-generated if omitted.
//   discountType:    "percent" | "flat"
//   discountValue:   number   — e.g. 10 (10%) or 5.00 ($5 flat)
//   description?:    string   — internal label
//   maxUses?:        number   — 0 = unlimited (default 0)
//   maxUsesPerUser?: number   — 0 = unlimited (default 1)
//   minFare?:        number   — minimum fare required (default 0)
//   expiresAt?:      string   — ISO 8601 date string, null = never expires
//   active?:         boolean  — default true
// }
//
// Response:
//   { success: true,  code: string, docId: string }
// | { success: false, message: string }

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

// ── Auto-generate a readable code if none provided ─────────────────────
// Format: "UAT-XXXXXXXX" (8 uppercase alphanumeric chars)
function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
  let suffix = "";
  for (let i = 0; i < 8; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `UAT-${suffix}`;
}

// ── Ensure generated code doesn't already exist ────────────────────────
async function resolveUniqueCode(requestedCode) {
  if (requestedCode) {
    const normalized = requestedCode.trim().toUpperCase();
    const existing   = await db.collection("promoCodes").doc(normalized).get();
    if (existing.exists) {
      throw new HttpsError("already-exists", `Promo code "${normalized}" already exists.`);
    }
    return normalized;
  }

  // Auto-generate, retry up to 5 times on collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateCode();
    const snap      = await db.collection("promoCodes").doc(candidate).get();
    if (!snap.exists) return candidate;
  }

  throw new HttpsError("internal", "Could not generate a unique promo code. Please try again.");
}

exports.createPromoCode = onCall(
  { region: "us-east1" },
  async (request) => {
    // ── 1. Auth check — must be a signed-in admin ────────────────────
    const callerUid = request.auth?.uid;
    if (!callerUid) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const adminSnap = await db.collection("users").doc(callerUid).get();
    if (!adminSnap.exists || adminSnap.data()?.role !== "admin") {
      throw new HttpsError("permission-denied", "Admin access required.");
    }

    // ── 2. Destructure + validate input ──────────────────────────────
    const {
      code,
      discountType,
      discountValue,
      description   = "",
      maxUses       = 0,
      maxUsesPerUser= 1,
      minFare       = 0,
      expiresAt     = null,
      active        = true,
    } = request.data ?? {};

    if (!["percent", "flat"].includes(discountType)) {
      throw new HttpsError("invalid-argument", 'discountType must be "percent" or "flat".');
    }

    if (typeof discountValue !== "number" || discountValue <= 0) {
      throw new HttpsError("invalid-argument", "discountValue must be a positive number.");
    }

    if (discountType === "percent" && discountValue > 100) {
      throw new HttpsError("invalid-argument", "Percent discount cannot exceed 100.");
    }

    if (typeof maxUses !== "number" || maxUses < 0) {
      throw new HttpsError("invalid-argument", "maxUses must be 0 or a positive integer.");
    }

    if (typeof maxUsesPerUser !== "number" || maxUsesPerUser < 0) {
      throw new HttpsError("invalid-argument", "maxUsesPerUser must be 0 or a positive integer.");
    }

    if (typeof minFare !== "number" || minFare < 0) {
      throw new HttpsError("invalid-argument", "minFare must be 0 or a positive number.");
    }

    // ── 3. Resolve / validate expiry ─────────────────────────────────
    let expiresAtTimestamp = null;
    if (expiresAt) {
      const expDate = new Date(expiresAt);
      if (isNaN(expDate.getTime())) {
        throw new HttpsError("invalid-argument", "expiresAt must be a valid ISO 8601 date string.");
      }
      if (expDate <= new Date()) {
        throw new HttpsError("invalid-argument", "expiresAt must be in the future.");
      }
      expiresAtTimestamp = Timestamp.fromDate(expDate);
    }

    // ── 4. Resolve unique code ────────────────────────────────────────
    const finalCode = await resolveUniqueCode(code);

    // ── 5. Write to Firestore ─────────────────────────────────────────
    const codeRef = db.collection("promoCodes").doc(finalCode);

    await codeRef.set({
      active,
      discountType,
      discountValue,
      description,
      maxUses,
      maxUsesPerUser,
      minFare,
      usedCount:  0,
      expiresAt:  expiresAtTimestamp,
      createdAt:  FieldValue.serverTimestamp(),
      createdBy:  callerUid,
    });

    console.log(`[createPromoCode] Created "${finalCode}" by uid=${callerUid}`);

    return {
      success: true,
      code:    finalCode,
      docId:   finalCode,
    };
  }
);
