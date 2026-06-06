// File: functions/findDriversOnCreate.js

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const db = getFirestore();

/* ── Haversine Distance ───────────────────────────── */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3958.8; // miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── On Ride Created ─────────────────────────────── */
exports.findDriversOnCreate = onDocumentCreated(
  {
    document: "Rides/{rideId}",
    region: "us-east1",
  },
  async (event) => {
    const rideId = event.params.rideId;
    const ride = event.data?.data();

    if (!ride) {
      console.warn(`[findDriversOnCreate] no data for ${rideId}`);
      return;
    }

    // Only process rides that start in searching_driver status
    if (ride.status !== "searching_driver") {
      console.log(
        `[findDriversOnCreate] skipping ${rideId} — status: ${ride.status}`
      );
      return;
    }

    const { pickupLat, pickupLng } = ride;

    if (pickupLat == null || pickupLng == null) {
      console.warn(`[findDriversOnCreate] missing coords for ${rideId}`);
      return;
    }

    console.log(`[findDriversOnCreate] processing ride ${rideId}`);

    // Get online drivers
    const driversSnap = await db
      .collection("Drivers")
      .where("status", "==", "online")
      .get();

    if (driversSnap.empty) {
      console.log(`[findDriversOnCreate] no drivers online for ${rideId}`);
      return;
    }

    const drivers = driversSnap.docs
      .map((doc) => ({ uid: doc.id, ...doc.data() }))
      .filter(
        (d) => typeof d.lat === "number" && typeof d.lng === "number"
      );

    const sorted = drivers
      .map((d) => ({
        uid: d.uid,
        lat: d.lat,
        lng: d.lng,
        presenceUpdatedAt: d.presenceUpdatedAt || null,
        distance: haversineDistance(d.lat, d.lng, pickupLat, pickupLng),
      }))
      .sort((a, b) => a.distance - b.distance);

    const topDrivers = sorted.slice(0, 10);

    await event.data.ref.update({
      candidateDrivers: topDrivers,
      candidateDriverUids: topDrivers.map((d) => d.uid),
      currentDriverIndex: 0,
      requestSentAt: FieldValue.serverTimestamp(),
    });

    console.log(
      `✅ Ride ${rideId} matched with ${topDrivers.length} drivers`
    );
  }
);