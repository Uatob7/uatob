const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");

const db = getFirestore();

// ── Haversine Distance ─────────────────────────────
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

exports.onRideCreated = onDocumentUpdated(
  {
    document: "Rides/{rideId}",
    region: "us-central1",
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const rideRef = event.data.after.ref;

    if (before.status === after.status) return;
    if (after.status !== "searching_driver") return;

    const { pickupLat, pickupLng } = after;

    if (pickupLat == null || pickupLng == null) {
      console.error("❌ Missing pickup coordinates");
      return;
    }

    try {
      const driversSnap = await db
        .collection("Drivers")
        .where("status", "==", "online")
        .get();

      if (driversSnap.empty) {
        await rideRef.update({
          candidateDrivers: [],
          candidateDriverUids: [],
          currentDriverIndex: 0,
          requestSentAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      const drivers = driversSnap.docs
        .map((doc) => ({
          uid: doc.id,
          ...doc.data(),
        }))
        .filter(
          (d) =>
            typeof d.lat === "number" &&
            typeof d.lng === "number" &&
            d.uid
        );

      const sorted = drivers
        .map((d) => ({
          uid: d.uid,
          distance: haversineDistance(
            d.lat,
            d.lng,
            pickupLat,
            pickupLng
          ),
        }))
        .sort((a, b) => a.distance - b.distance);

      const topDrivers = sorted.slice(0, 10);

      await rideRef.update({
        candidateDrivers: topDrivers,
        candidateDriverUids: topDrivers.map((d) => d.uid),
        currentDriverIndex: 0,
        requestSentAt: FieldValue.serverTimestamp(),
      });

      console.log(`✅ Ride dispatched to ${topDrivers.length} drivers`);
    } catch (err) {
      console.error("❌ Matching failed:", err);

      await rideRef.update({
        error: "matching_failed",
      });
    }
  }
);