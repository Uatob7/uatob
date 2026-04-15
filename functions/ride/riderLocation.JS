const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const axios = require("axios");
const cors = require("cors")({ origin: true });

const { defineSecret } = require("firebase-functions/params");
const GOOGLE_MAPS_KEY = defineSecret("GOOGLE_MAPS_KEY");

// ── Init Firebase Admin ─────────────────────────────
if (!getApps().length) initializeApp();
const db = getFirestore();

// ───────────────────────────────────────────────────
// 🚀 riderLocation (LIVE TRACKING)
// Updates rider position + calculates distance & ETA
// to dropoff using Google Routes API
// ───────────────────────────────────────────────────
exports.riderLocation = onRequest(
  {
    region: "us-east1", // 🔥 better for Florida users
    invoker: "public",
    secrets: [GOOGLE_MAPS_KEY],
  },
  (req, res) => {
    cors(req, res, async () => {
      try {
        // ── Preflight ───────────────────────────────
        if (req.method === "OPTIONS") {
          return res.status(204).send("");
        }

        if (req.method !== "POST") {
          return res.status(405).json({
            ok: false,
            error: "Method Not Allowed",
          });
        }

        const { rideId, lat, lng } = req.body ?? {};

        // ── Validate rideId ─────────────────────────
        if (!rideId?.trim()) {
          return res.status(400).json({
            ok: false,
            error: "rideId is required",
          });
        }

        // ── Validate lat/lng ────────────────────────
        const numLat = Number(lat);
        const numLng = Number(lng);

        if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) {
          return res.status(400).json({
            ok: false,
            error: "lat/lng must be valid numbers",
          });
        }

        if (numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
          return res.status(400).json({
            ok: false,
            error: "lat/lng out of range",
          });
        }

        // ── Fetch ride ──────────────────────────────
        const rideRef = db.collection("Rides").doc(rideId.trim());
        const rideSnap = await rideRef.get();

        if (!rideSnap.exists) {
          return res.status(404).json({
            ok: false,
            error: "Ride not found",
          });
        }

        const rideData = rideSnap.data();
        const status = rideData.status;

        // ── Only track active rides ─────────────────
        const ACTIVE_STATUSES = [
          "driver_assigned",
          "driver_arriving",
          "arrived",
          "in_progress",
        ];

        if (!ACTIVE_STATUSES.includes(status)) {
          return res.status(200).json({
            ok: true,
            skipped: true,
            reason: `status is '${status}'`,
          });
        }

        // ── Base update (always write location) ─────
        const update = {
          riderLat: numLat,
          riderLng: numLng,
          riderLocationAt: FieldValue.serverTimestamp(),
        };

        // ── Dropoff coords ──────────────────────────
        const dropoffLat = rideData.dropoffLat ?? null;
        const dropoffLng = rideData.dropoffLng ?? null;

        let riderDropoffDistanceMiles = null;
        let riderDropoffEtaMin = null;

        // ── ROUTES API (rider → dropoff) ────────────
        if (dropoffLat != null && dropoffLng != null) {
          try {
            const routeRes = await axios.post(
              "https://routes.googleapis.com/directions/v2:computeRoutes",
              {
                origin: {
                  location: {
                    latLng: {
                      latitude: numLat,
                      longitude: numLng,
                    },
                  },
                },
                destination: {
                  location: {
                    latLng: {
                      latitude: dropoffLat,
                      longitude: dropoffLng,
                    },
                  },
                },
                travelMode: "DRIVE",
                routingPreference: "TRAFFIC_AWARE",
              },
              {
                headers: {
                  "Content-Type": "application/json",
                  "X-Goog-Api-Key": GOOGLE_MAPS_KEY.value(),
                  "X-Goog-FieldMask":
                    "routes.duration,routes.distanceMeters",
                },
                timeout: 8000,
              }
            );

            const route = routeRes.data?.routes?.[0];

            if (route) {
              const meters = route.distanceMeters ?? 0;

              const seconds = parseInt(
                route.duration?.replace("s", "") || "0",
                10
              );

              riderDropoffDistanceMiles = Number(
                (meters / 1609.34).toFixed(1)
              );

              riderDropoffEtaMin = Math.ceil(seconds / 60);
            }
          } catch (err) {
            console.error(
              "Routes API error (rider→dropoff):",
              err?.response?.data || err.message
            );
          }
        }

        // ── Optional: Trip Progress 🔥 ───────────────
        if (
          riderDropoffDistanceMiles != null &&
          rideData.tripDistanceMiles
        ) {
          const total = rideData.tripDistanceMiles;

          const progress =
            1 - riderDropoffDistanceMiles / total;

          update.tripProgress = Math.max(
            0,
            Math.min(1, progress)
          );
        }

        // ── Attach computed fields ───────────────────
        update.riderDropoffDistanceMiles =
          riderDropoffDistanceMiles;

        update.riderDropoffEtaMin =
          riderDropoffEtaMin;

        update.updatedAt = FieldValue.serverTimestamp();

        // ── Write to Firestore ───────────────────────
        await rideRef.set(update, { merge: true });

        return res.status(200).json({
          ok: true,
          riderDropoffDistanceMiles,
          riderDropoffEtaMin,
        });

      } catch (err) {
        console.error("❌ riderLocation error:", err);

        return res.status(500).json({
          ok: false,
          error: err.message || "Internal server error",
        });
      }
    });
  }
);