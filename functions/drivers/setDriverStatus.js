const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const cors = require("cors")({ origin: true });

// ── Init Admin (safe across hot-reloads) ─────────────────────────────
if (!getApps().length) initializeApp();
const db = getFirestore();

// ─────────────────────────────────────────────────────────────────────
//  setDriverStatus
//
//  POST  { uid, status: "online",        lat, lng }
//  POST  { uid, status: "offline" }
//  POST  { uid, status: "location_ping", lat, lng }
//
//  Firestore path: drivers/{uid}
// ─────────────────────────────────────────────────────────────────────
exports.setDriverStatus = onRequest(
  {
    region: "us-central1",
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

        // ── Validate lat/lng when needed ───────────────────
        const needsLocation = status === "online" || status === "location_ping";
        if (needsLocation) {
          const numLat = Number(lat);
          const numLng = Number(lng);

          if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) {
            return res.status(400).json({
              ok: false,
              error: "lat and lng must be valid numbers for online / location_ping",
            });
          }
          if (numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
            return res.status(400).json({ ok: false, error: "lat or lng out of range" });
          }
        }

        // ── Build Firestore payload ────────────────────────
        let update;

        if (status === "location_ping") {
          // Only refresh location — never touch the status field
          update = {
            lat:            Number(lat),
            lng:            Number(lng),
            lastLocationAt: FieldValue.serverTimestamp(),
            lastSeenAt:     FieldValue.serverTimestamp(),
            updatedAt:      FieldValue.serverTimestamp(),
          };

        } else if (status === "online") {
          update = {
            status:         "online",
            lat:            Number(lat),
            lng:            Number(lng),
            lastLocationAt: FieldValue.serverTimestamp(),
            lastSeenAt:     FieldValue.serverTimestamp(),
            updatedAt:      FieldValue.serverTimestamp(),
          };

        } else {
          // offline — wipe stale coordinates so they don't linger
          update = {
            status:         "offline",
            lat:            FieldValue.delete(),
            lng:            FieldValue.delete(),
            lastLocationAt: FieldValue.delete(),
            lastSeenAt:     FieldValue.serverTimestamp(),
            updatedAt:      FieldValue.serverTimestamp(),
          };
        }

        // ── Write to Firestore ─────────────────────────────
        // merge: true so we never clobber other driver profile fields
        await db
          .collection("Drivers")
          .doc(uid.trim())
          .set(update, { merge: true });

        console.log(
          `✅ setDriverStatus — uid:${uid} status:${status}` +
          (needsLocation ? ` lat:${Number(lat).toFixed(5)} lng:${Number(lng).toFixed(5)}` : "")
        );

        return res.status(200).json({ ok: true, status });

      } catch (err) {
        console.error("❌ setDriverStatus error:", err.message ?? err);
        return res.status(500).json({ ok: false, error: err.message ?? "Internal server error" });
      }
    });
  }
);
