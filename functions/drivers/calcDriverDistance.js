const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const axios = require("axios");

const GOOGLE_MAPS_KEY = defineSecret("GOOGLE_MAPS_KEY");

if (!getApps().length) initializeApp();
const db = getFirestore();

// ── ROUTES API CALL (NEW) ─────────────────────────────
async function getRouteDistance(originLat, originLng, destLat, destLng, apiKey) {
  const response = await axios.post(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      origin: {
        location: {
          latLng: {
            latitude: originLat,
            longitude: originLng,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: destLat,
            longitude: destLng,
          },
        },
      },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      computeAlternativeRoutes: false,
      languageCode: "en-US",
      units: "IMPERIAL",
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "routes.distanceMeters,routes.duration",
      },
    }
  );

  const route = response.data?.routes?.[0];

  if (!route) {
    throw new Error("No route returned from Google Routes API");
  }

  const distanceMeters = route.distanceMeters;
  const durationSeconds = parseInt(route.duration.replace("s", ""), 10);

  const distanceMiles = +(distanceMeters / 1609.34).toFixed(2);
  const durationMin = Math.ceil(durationSeconds / 60);

  return { distanceMiles, durationMin };
}

// ── SAVE HELPER ─────────────────────────────
async function saveDistanceToRide(rideId, fields) {
  await db.collection("Rides").doc(rideId).update({
    ...fields,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// ─────────────────────────────────────────────
// TRIGGER 1: RIDE STATUS CHANGES
// ─────────────────────────────────────────────
exports.calcDriverDistance = onDocumentWritten(
  {
    document: "Rides/{rideId}",
    region: "us-central1",
    secrets: [GOOGLE_MAPS_KEY],
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const rideId = event.params.rideId;

    const prevStatus = before?.status;
    const nextStatus = after?.status;

    const isAssigned =
      prevStatus !== "driver_assigned" &&
      nextStatus === "driver_assigned";

    const isArrived =
      prevStatus !== "arrived" && nextStatus === "arrived";

    if (!isAssigned && !isArrived) return null;

    const driverUid = after?.driverUid;
    if (!driverUid) return null;

    const driverSnap = await db
      .collection("Drivers")
      .doc(driverUid)
      .get();

    if (!driverSnap.exists) return null;

    const { lat: driverLat, lng: driverLng } = driverSnap.data();

    try {
      if (isAssigned) {
        const { pickupLat, pickupLng } = after;
        if (pickupLat == null || pickupLng == null) return null;

        const { distanceMiles, durationMin } =
          await getRouteDistance(
            driverLat,
            driverLng,
            pickupLat,
            pickupLng,
            GOOGLE_MAPS_KEY.value()
          );

        await saveDistanceToRide(rideId, {
          driverDistanceMiles: distanceMiles,
          driverEtaMin: durationMin,
          driverLat,
          driverLng,
        });

        console.log(
          `✅ driver_assigned: ${distanceMiles}mi ~${durationMin}min`
        );
      }

      if (isArrived) {
        const { dropoffLat, dropoffLng } = after;
        if (dropoffLat == null || dropoffLng == null) return null;

        const { distanceMiles, durationMin } =
          await getRouteDistance(
            driverLat,
            driverLng,
            dropoffLat,
            dropoffLng,
            GOOGLE_MAPS_KEY.value()
          );

        await saveDistanceToRide(rideId, {
          dropoffDistanceMiles: distanceMiles,
          dropoffEtaMin: durationMin,
          driverLat,
          driverLng,
        });

        console.log(
          `✅ arrived: ${distanceMiles}mi ~${durationMin}min`
        );
      }
    } catch (err) {
      console.error("❌ calcDriverDistance error:", err.message);
    }

    return null;
  }
);

// ─────────────────────────────────────────────
// TRIGGER 2: DRIVER LOCATION UPDATES
// ─────────────────────────────────────────────
exports.trackDriverLocation = onDocumentWritten(
  {
    document: "Drivers/{driverUid}",
    region: "us-central1",
    secrets: [GOOGLE_MAPS_KEY],
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const driverUid = event.params.driverUid;

    if (before?.lat === after?.lat && before?.lng === after?.lng) {
      return null;
    }

    const driverLat = after?.lat;
    const driverLng = after?.lng;
    if (driverLat == null || driverLng == null) return null;

    const ridesSnap = await db
      .collection("Rides")
      .where("driverUid", "==", driverUid)
      .where("status", "in", [
        "driver_assigned",
        "driver_arriving",
        "arrived",
        "in_progress",
      ])
      .limit(1)
      .get();

    if (ridesSnap.empty) return null;

    const rideDoc = ridesSnap.docs[0];
    const ride = rideDoc.data();
    const rideId = rideDoc.id;

    const headingToPickup = [
      "driver_assigned",
      "driver_arriving",
    ].includes(ride.status);

    const headingToDropoff = [
      "arrived",
      "in_progress",
    ].includes(ride.status);

    let destLat, destLng, distanceField, etaField;

    if (headingToPickup) {
      destLat = ride.pickupLat;
      destLng = ride.pickupLng;
      distanceField = "driverDistanceMiles";
      etaField = "driverEtaMin";
    } else if (headingToDropoff) {
      destLat = ride.dropoffLat;
      destLng = ride.dropoffLng;
      distanceField = "dropoffDistanceMiles";
      etaField = "dropoffEtaMin";
    } else {
      return null;
    }

    if (destLat == null || destLng == null) return null;

    try {
      const { distanceMiles, durationMin } =
        await getRouteDistance(
          driverLat,
          driverLng,
          destLat,
          destLng,
          GOOGLE_MAPS_KEY.value()
        );

      await saveDistanceToRide(rideId, {
        [distanceField]: distanceMiles,
        [etaField]: durationMin,
        driverLat,
        driverLng,
      });

      console.log(
        `✅ trackDriverLocation: ${distanceMiles}mi ~${durationMin}min`
      );
    } catch (err) {
      console.error("❌ trackDriverLocation error:", err.message);
    }

    return null;
  }
);