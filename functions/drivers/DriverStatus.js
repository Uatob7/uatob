const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const axios = require("axios");

// ── Init Admin ───────────────────────────────────────────
if (!getApps().length) initializeApp();
const db = getFirestore();

// ── Active ride statuses where a driver location update matters ──────
// Outside these states, we don't care about pinging the ride doc.
const ACTIVE_RIDE_STATUSES = [
  "driver_assigned",
  "driver_arriving",
  "arrived",
  "in_progress",
];

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

// ── Helper: Find this driver's currently-active ride ─────
// Looks for any ride where driverUid == uid AND status is in ACTIVE_RIDE_STATUSES.
// Returns the DocumentReference, or null if none found.
async function findActiveRideForDriver(driverUid) {
  if (!driverUid) return null;
  try {
    const snap = await db
      .collection("Rides")
      .where("driverUid", "==", driverUid)
      .where("status", "in", ACTIVE_RIDE_STATUSES)
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0].ref;
  } catch (err) {
    console.error("findActiveRideForDriver error:", err.message);
    return null;
  }
}

// ── Helper: Update active ride with driver position ──────
// Writes driverLat / driverLng / driverLocationAt so the rider's tracking
// map can compare freshness against riderLocationAt and pick the freshest.
async function pingDriverLocationOnActiveRide(driverUid, lat, lng) {
  const rideRef = await findActiveRideForDriver(driverUid);
  if (!rideRef) return null;

  try {
    await rideRef.set(
      {
        driverLat: lat,
        driverLng: lng,
        driverLocationAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return rideRef.id;
  } catch (err) {
    console.error("pingDriverLocationOnActiveRide error:", err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────
exports.DriverStatus = onCall(
  {
    region: "us-east1",
    secrets: ["GOOGLE_MAPS_KEY"],
  },
  async (request) => {
    try {
      const { uid, status, lat, lng } = request.data ?? {};

      // ── Validate uid ───────────────────────────────────
      if (!uid?.trim()) {
        throw new HttpsError("invalid-argument", "uid is required");
      }
      const driverUid = uid.trim();

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

      // ── Build Firestore update for Drivers doc ─────────
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

      // ── Write to Drivers doc ───────────────────────────
      await db.collection("Drivers").doc(driverUid).set(update, { merge: true });

      // ── If driver has an active ride, also update that ride's
      //    driverLat / driverLng / driverLocationAt so the rider's
      //    tracking map can use freshness-based GPS resolution.
      let updatedRideId = null;
      if (numLat != null && numLng != null && status !== "offline") {
        updatedRideId = await pingDriverLocationOnActiveRide(driverUid, numLat, numLng);
      }

      return {
        ok: true,
        status,
        city,
        zip,
        rideUpdated: !!updatedRideId,
        rideId: updatedRideId,
      };
    } catch (err) {
      console.error("❌ DriverStatus error:", err);

      if (err instanceof HttpsError) throw err;

      throw new HttpsError("internal", err.message || "Internal error");
    }
  }
);