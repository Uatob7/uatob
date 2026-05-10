// updateRiderPhone.js
// Callable: writes a phone number to Accounts/{uid}.
// Auth-gated: request.auth.uid must match the target uid.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// E.164-ish: starts with +, 8-15 digits total
const E164 = /^\+\d{8,15}$/;

// Strip everything that isn't + or a digit
function normalize(raw) {
  if (!raw) return "";
  let s = String(raw).replace(/[^\d+]/g, "");

  // If they didn't include a +, assume US (+1)
  if (!s.startsWith("+")) {
    if (s.length === 10)            s = "+1" + s;
    else if (s.length === 11 && s[0] === "1") s = "+" + s;
    else                             s = "+" + s;
  }
  return s;
}

exports.updateRiderPhone = onCall(
  { region: "us-east1" },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }

    const { uid, phone } = request.data ?? {};
    if (!uid || typeof uid !== "string") {
      throw new HttpsError("invalid-argument", "Missing uid.");
    }
    if (uid !== callerUid) {
      throw new HttpsError("permission-denied", "uid mismatch.");
    }
    if (!phone || typeof phone !== "string") {
      throw new HttpsError("invalid-argument", "Missing phone.");
    }

    const normalized = normalize(phone);
    if (!E164.test(normalized)) {
      throw new HttpsError(
        "invalid-argument",
        "Phone number doesn't look valid. Try a 10-digit US number."
      );
    }

    await db.collection("Accounts").doc(uid).set(
      {
        phone: normalized,
        phoneUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { success: true, phone: normalized };
  }
);