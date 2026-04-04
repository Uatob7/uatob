const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const axios = require("axios");
const cors = require("cors")({ origin: true });

// 🔑 Secret
const GOOGLE_MAPS_KEY = defineSecret("GOOGLE_MAPS_KEY");

// ── Init Admin ───────────────────────────────────────────
if (!getApps().length) initializeApp();
const db = getFirestore();

// ── Helper: Extract city + ZIP ───────────────────────────
function extractCityAndZip(components) {
  let city = "";
  let zip = "";

  components.forEach((c) => {
    if (c.types.includes("locality")) {
      city = c.long_name;
    }

    if (!city && c.types.includes("administrative_area_level_2")) {
      city = c.long_name;
    }

    if (c.types.includes("postal_code")) {
      zip = c.long_name;
    }
  });

  return { city, zip };
}

// ─────────────────────────────────────────────────────────
exports.setDriverStatus = onRequest(
  {
    region: "us-central1",
    secrets: [GOOGLE_MAPS_KEY], // 👈 important
  },
  async (req, res) => {
    return cors(req, res, async () => {
      try {

        // ── Pre-flight ─────────────────────────────────────
        if (req.method === "OPTIONS") return res.status(204).send("");
        if (req.method !== "POST") {
          return res.status(405).json({ ok: false, error: "Method Not Allowed" });
        }

        const { uid, status, lat, lng } = req.body ?? {};

        // ── Validate uid ───────────────────────────────────
        if (!uid || typeof uid !== "string" || !uid.trim()) {
          return res.status(400).json({ ok: false, error: "uid is required" });
        }

        // ── Validate status ────────────────────────────────
        const VALID_STATUSES = ["online", "offline", "location_ping"];
        if (!VALID_STATUSES.includes(status)) {
          return res.status(400).json({
            ok: false,
            error: `status must be one of: ${VALID_STATUSES.join(", ")}`,
          });
        }

        // ── Validate lat/lng ───────────────────────────────
        let numLat, numLng;
        const needsLocation = status === "online" || status === "location_ping";

        if (needsLocation) {
          numLat = Number(lat);
          numLng = Number(lng);

          if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) {
            return res.status(400).json({
              ok: false,
              error: "lat and lng must be valid numbers",
            });
          }

          if (numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
            return res.status(400).json({
              ok: false,
              error: "lat or lng out of range",
            });
          }
        }

        // ── 🧠 Get city + ZIP (ONLY when going online) ─────
        let city = null;
        let zip = null;

        if (status === "online") {
          try {
            const response = await axios.get(
              "https://maps.googleapis.com/maps/api/geocode/json",
              {
                params: {
                  latlng: `${numLat},${numLng}`,
                  key: GOOGLE_MAPS_KEY.value(),
                },
              }
            );

            const data = response.data;

            if (data.status === "OK" && data.results?.length) {
              const components = data.results[0].address_components;
              const extracted = extractCityAndZip(components);
              city = extracted.city;
              zip = extracted.zip;
            }
          } catch (geoErr) {
            console.error("Geocode error:", geoErr.message);
          }
        }

        // ── Build Firestore payload ────────────────────────
        let update;

        if (status === "location_ping") {
          update = {
            lat:            numLat,
            lng:            numLng,
            lastLocationAt: FieldValue.serverTimestamp(),
            lastSeenAt:     FieldValue.serverTimestamp(),
            updatedAt:      FieldValue.serverTimestamp(),
          };

        } else if (status === "online") {
          update = {
            status:         "online",
            lat:            numLat,
            lng:            numLng,
            city, // 👈 NEW
            zip,  // 👈 NEW
            lastLocationAt: FieldValue.serverTimestamp(),
            lastSeenAt:     FieldValue.serverTimestamp(),
            updatedAt:      FieldValue.serverTimestamp(),
          };

        } else {
          update = {
            status:         "offline",
            lat:            FieldValue.delete(),
            lng:            FieldValue.delete(),
            city:           FieldValue.delete(), // 👈 NEW
            zip:            FieldValue.delete(), // 👈 NEW
            lastLocationAt: FieldValue.delete(),
            lastSeenAt:     FieldValue.serverTimestamp(),
            updatedAt:      FieldValue.serverTimestamp(),
          };
        }

        // ── Save to Firestore ──────────────────────────────
        await db
          .collection("Drivers")
          .doc(uid.trim())
          .set(update, { merge: true });

        console.log(
          `✅ setDriverStatus — uid:${uid} status:${status}` +
          (needsLocation
            ? ` lat:${numLat.toFixed(5)} lng:${numLng.toFixed(5)}` +
              (city ? ` city:${city} zip:${zip}` : "")
            : "")
        );

        return res.status(200).json({
          ok: true,
          status,
          city,
          zip,
        });

      } catch (err) {
        console.error("❌ setDriverStatus error:", err.message ?? err);
        return res.status(500).json({
          ok: false,
          error: err.message ?? "Internal server error",
        });
      }
    });
  }
);