// functions/callable/updateDriverSetting.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const db = admin.firestore();

// ── Whitelist of allowed setting keys ──────────────────────────
// Anything not in this list is rejected — prevents arbitrary writes
const ALLOWED_KEYS = new Set([
  // Notifications
  "notifyRideRequests",
  "notifyPayoutConfirmed",
  "notifyWeeklySummary",
  "notifySurgeZones",
  "notifyPromotions",
  "notifyAppUpdates",

  // App settings
  "soundHaptics",
  "dataSaver",
  "darkModeAuto",
]);

exports.updateDriverSetting = onCall(
  { region: "us-east1" },
  async (request) => {
    // ── Auth check ─────────────────────────────────────
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }

    const { uid, key, value } = request.data || {};

    // ── Validate inputs ────────────────────────────────
    if (!uid || typeof uid !== "string") {
      throw new HttpsError("invalid-argument", "Missing or invalid uid");
    }
    if (!key || typeof key !== "string") {
      throw new HttpsError("invalid-argument", "Missing or invalid key");
    }
    if (typeof value !== "boolean") {
      throw new HttpsError("invalid-argument", "Value must be boolean");
    }
    if (!ALLOWED_KEYS.has(key)) {
      throw new HttpsError("permission-denied", `Setting "${key}" is not allowed`);
    }

    // ── Authorization: caller must be the driver themselves ────
    if (request.auth.uid !== uid) {
      throw new HttpsError("permission-denied", "Cannot edit another driver's settings");
    }

    try {
      // ── Write to Driver doc ────────────────────────────
      await db.collection("Drivers").doc(uid).update({
        [`settings.${key}`]: value,
        "settings.updatedAt": admin.firestore.FieldValue.serverTimestamp(),
        updatedAt:            admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`[updateDriverSetting] ${uid} · ${key} = ${value}`);

      return {
        success: true,
        key,
        value,
      };

    } catch (err) {
      console.error("[updateDriverSetting]", err);
      throw new HttpsError("internal", err.message || "Failed to update setting");
    }
  }
);