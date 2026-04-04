const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const axios = require("axios");

const GOOGLE_MAPS_KEY = defineSecret("GOOGLE_MAPS_KEY");

if (!getApps().length) initializeApp();
const db = getFirestore();

// ── Shared: call Distance Matrix API ──────────────────────
async function getRoadDistance(originLat, originLng, destLat, destLng, apiKey) {
  const response = await axios.get(
    "https://maps.googleapis.com/maps/api/distancematrix/json",
    {
      params: {
        origins:      `${originLat},${originLng}`,
        destinations: `${destLat},${destLng}`,
        units:        "imperial",
        mode:         "driving",
        key:          apiKey,
      },
    }
  );

  const data    = response.data;
  const element = data.rows?.[0]?.elements?.[0];

  if (data.status !== "OK" || element?.status !== "OK") {
    throw new Error(`Distance Matrix error: ${data.status} / ${element?.status}`);
  }

  const distanceMiles = +(element.distance.value / 1609.344).toFixed(2);
  const durationMin   = Math.ceil(element.duration.value / 60);

  return { distanceMiles, durationMin };
}

// ── Shared: write distance fields to ride doc ─────────────
async function saveDistanceToRide(rideId, fields) {
  await db.collection("Rides").doc(rideId).update({
    ...fields,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// ─────────────────────────────────────────────────────────
// TRIGGER 1: Ride status changes
// → driver_assigned : calc driver → pickup
// → arrived         : calc driver → dropoff
// ─────────────────────────────────────────────────────────
exports.calcDriverDistance = onDocumentWritten(
  {
    document: "Rides/{rideId}",
    region:   "us-central1",
    secrets:  [GOOGLE_MAPS_KEY],
  },
  async (event) => {
    const before     = event.data.before.data();
    const after      = event.data.after.data();
    const rideId     = event.params.rideId;
    const prevStatus = before?.status;
    const nextStatus = after?.status;

    const isAssigned = prevStatus !== "driver_assigned" && nextStatus === "driver_assigned";
    const isArrived  = prevStatus !== "arrived"         && nextStatus === "arrived";

    if (!isAssigned && !isArrived) return null;

    const { driverUid } = after;
    if (!driverUid) {
      console.warn(`❌ calcDriverDistance — no driverUid on ride ${rideId}`);
      return null;
    }

    const driverSnap = await db.collection("Drivers").doc(driverUid).get();
    if (!driverSnap.exists) {
      console.warn(`❌ calcDriverDistance — driver ${driverUid} not found`);
      return null;
    }

    const { lat: driverLat, lng: driverLng } = driverSnap.data();
    if (driverLat == null || driverLng == null) {
      console.warn(`❌ calcDriverDistance — driver ${driverUid} has no location`);
      return null;
    }

    try {
      if (isAssigned) {
        const { pickupLat, pickupLng } = after;
        if (pickupLat == null || pickupLng == null) return null;

        const { distanceMiles, durationMin } = await getRoadDistance(
          driverLat, driverLng, pickupLat, pickupLng, GOOGLE_MAPS_KEY.value()
        );

        await saveDistanceToRide(rideId, {
          driverDistanceMiles: distanceMiles,
          driverEtaMin:        durationMin,
          driverLat,
          driverLng,
        });

        console.log(`✅ driver_assigned — ride:${rideId} driver→pickup ${distanceMiles}mi ~${durationMin}min`);
      }

      if (isArrived) {
        const { dropoffLat, dropoffLng } = after;
        if (dropoffLat == null || dropoffLng == null) return null;

        const { distanceMiles, durationMin } = await getRoadDistance(
          driverLat, driverLng, dropoffLat, dropoffLng, GOOGLE_MAPS_KEY.value()
        );

        await saveDistanceToRide(rideId, {
          dropoffDistanceMiles: distanceMiles,
          dropoffEtaMin:        durationMin,
          driverLat,
          driverLng,
        });

        console.log(`✅ arrived — ride:${rideId} driver→dropoff ${distanceMiles}mi ~${durationMin}min`);
      }

    } catch (err) {
      console.error(`❌ calcDriverDistance error on ride ${rideId}:`, err.message);
    }

    return null;
  }
);

// ─────────────────────────────────────────────────────────
// TRIGGER 2: Driver lat/lng changes
// → find their active ride → recalc distance to the
//   correct target based on current ride status
// ─────────────────────────────────────────────────────────
exports.trackDriverLocation = onDocumentWritten(
  {
    document: "Drivers/{driverUid}",
    region:   "us-central1",
    secrets:  [GOOGLE_MAPS_KEY],
  },
  async (event) => {
    const before    = event.data.before.data();
    const after     = event.data.after.data();
    const driverUid = event.params.driverUid;

    // ── Only act if lat or lng actually changed ────────────
    const latChanged = before?.lat !== after?.lat;
    const lngChanged = before?.lng !== after?.lng;
    if (!latChanged && !lngChanged) return null;

    const driverLat = after?.lat;
    const driverLng = after?.lng;
    if (driverLat == null || driverLng == null) return null;

    // ── Find the driver's active ride ──────────────────────
    const ACTIVE_STATUSES = ["driver_assigned", "driver_arriving", "arrived", "in_progress"];

    const ridesSnap = await db
      .collection("Rides")
      .where("driverUid", "==", driverUid)
      .where("status", "in", ACTIVE_STATUSES)
      .limit(1)
      .get();

    if (ridesSnap.empty) return null;

    const rideDoc = ridesSnap.docs[0];
    const rideId  = rideDoc.id;
    const ride    = rideDoc.data();
    const status  = ride.status;

    // ── Pick destination based on ride status ──────────────
    // heading to pickup  → target is pickup
    // heading to dropoff → target is dropoff
    const headingToPickup  = ["driver_assigned", "driver_arriving"].includes(status);
    const headingToDropoff = ["arrived", "in_progress"].includes(status);

    let destLat, destLng, distanceField, etaField;

    if (headingToPickup) {
      destLat       = ride.pickupLat;
      destLng       = ride.pickupLng;
      distanceField = "driverDistanceMiles";
      etaField      = "driverEtaMin";
    } else if (headingToDropoff) {
      destLat       = ride.dropoffLat;
      destLng       = ride.dropoffLng;
      distanceField = "dropoffDistanceMiles";
      etaField      = "dropoffEtaMin";
    } else {
      return null;
    }

    if (destLat == null || destLng == null) return null;

    try {
      const { distanceMiles, durationMin } = await getRoadDistance(
        driverLat, driverLng, destLat, destLng, GOOGLE_MAPS_KEY.value()
      );

      await saveDistanceToRide(rideId, {
        [distanceField]: distanceMiles,
        [etaField]:      durationMin,
        driverLat,
        driverLng,
      });

      console.log(
        `✅ trackDriverLocation — driver:${driverUid} ride:${rideId} ` +
        `status:${status} → ${distanceMiles}mi ~${durationMin}min`
      );

    } catch (err) {
      console.error(`❌ trackDriverLocation error — driver:${driverUid} ride:${rideId}:`, err.message);
    }

    return null;
  }
);