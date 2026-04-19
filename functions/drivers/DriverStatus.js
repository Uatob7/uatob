const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const axios = require("axios");

// ── Init Admin ───────────────────────────────────────────
if (!getApps().length) initializeApp();
const db = getFirestore();

// ── Helper: Extract city + ZIP ───────────────────────────
function extractCityAndZip(components = []) {
  let city = "";
  let zip = "";

  for (const c of components) {
    if (!city && c.types?.includes("locality")) {
      city = c.long_name;
    }
    if (!city && c.types?.includes("administrative_area_level_2")) {
      city = c.long_name;
    }
    if (c.types?.includes("postal_code")) {
      zip = c.long_name;
    }
  }

  return { city, zip };
}

// ─────────────────────────────────────────────────────────
exports.DriverStatus = onCall(
  {
    region: "us-central1",
    secrets: ["GOOGLE_MAPS_KEY"],
  },
  async (request) => {
    try {
      const { uid, status, lat, lng } = request.data ?? {};

      // ── Validate uid ───────────────────────────────────
      if (!uid?.trim()) {
        throw new HttpsError("invalid-argument", "uid is required");
      }

      // ── Validate status ────────────────────────────────
      const VALID_STATUSES = ["online", "offline", "location_ping"];

      if (!VALID_STATUSES.includes(status)) {
        throw new HttpsError(
          "invalid-argument",
          `status must be one of: ${VALID_STATUSES.join(", ")}`
        );
      }

      // ── Validate lat/lng ───────────────────────────────
      const needsLocation = status === "online" || status === "location_ping";

      let numLat = null;
      let numLng = null;

      if (needsLocation) {
        numLat = Number(lat);
        numLng = Number(lng);

        if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) {
          throw new HttpsError("invalid-argument", "lat/lng must be numbers");
        }

        if (numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
          throw new HttpsError("invalid-argument", "lat/lng out of range");
        }
      }

      // ── Geocode ONLY when going online ─────────────────
      let city = null;
      let zip = null;

      if (status === "online" && numLat != null && numLng != null) {
        try {
          const geo = await axios.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            {
              params: {
                latlng: `${numLat},${numLng}`,
                key: process.env.GOOGLE_MAPS_KEY,
              },
              timeout: 8000,
            }
          );

          const data = geo.data;

          if (data.status === "OK" && data.results?.length) {
            const extracted = extractCityAndZip(
              data.results[0].address_components
            );
            city = extracted.city;
            zip = extracted.zip;
          }
        } catch (err) {
          console.error("Geocode error:", err.message);
        }
      }

      // ── Build Firestore update ─────────────────────────
      let update;

      if (status === "location_ping") {
        update = {
          lat: numLat,
          lng: numLng,
          lastLocationAt: FieldValue.serverTimestamp(),
          lastSeenAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };
      } else if (status === "online") {
        update = {
          status: "online",
          lat: numLat,
          lng: numLng,
          city,
          zip,
          lastLocationAt: FieldValue.serverTimestamp(),
          lastSeenAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };
      } else {
        update = {
          status: "offline",
          lat: FieldValue.delete(),
          lng: FieldValue.delete(),
          city: FieldValue.delete(),
          zip: FieldValue.delete(),
          lastLocationAt: FieldValue.delete(),
          lastSeenAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };
      }

      // ── Write to Firestore ─────────────────────────────
      await db.collection("Drivers").doc(uid.trim()).set(update, { merge: true });

      return { ok: true, status, city, zip };
    } catch (err) {
      console.error("❌ DriverStatus error:", err);

      if (err instanceof HttpsError) throw err;

      throw new HttpsError("internal", err.message || "Internal error");
    }
  }
);