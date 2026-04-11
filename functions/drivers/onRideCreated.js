const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp, getApps } = require("firebase-admin/app");
const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");

if (!getApps().length) initializeApp();
const db = getFirestore();

// ── Haversine ─────────────────────────────
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

// ── Trigger ─────────────────────────────
exports.onRideCreated = onDocumentCreated(
  {
    document: "Rides/{rideId}",
    region: "us-central1",
  },
  async (event) => {
    const snap = event.data;
    const ride = snap.data();
    const rideRef = snap.ref;

    const { pickupLat, pickupLng } = ride;

    if (pickupLat == null || pickupLng == null) {
      console.error("❌ Missing pickup coordinates");
      return;
    }

    try {
      // 1. Get drivers (you SHOULD later filter online only)
      const driversSnap = await db.collection("Drivers").get();

      if (driversSnap.empty) {
        console.log("⚠️ No drivers found");
        await rideRef.update({
          candidateDrivers: [],
          candidateDriverUids: [],
          currentDriverUid: null,
          status: "no_drivers_available",
          requestSentAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      // 2. Build driver list safely
      const drivers = driversSnap.docs
        .map((doc) => doc.data())
        .filter((d) => typeof d.lat === "number" && typeof d.lng === "number" && d.uid);

      if (drivers.length === 0) {
        console.log("⚠️ No valid driver locations");
        return;
      }

      // 3. Sort by distance
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

      const topDrivers = sorted.slice(0, 5);

      const firstDriver = topDrivers[0]?.uid || null;

      // 4. Update ride safely
      await rideRef.update({
        candidateDrivers: topDrivers,
        candidateDriverUids: topDrivers.map((d) => d.uid),

        currentDriverUid: firstDriver,
        currentDriverIndex: 0,

        requestSentAt: FieldValue.serverTimestamp(),
        status: firstDriver ? "dispatching" : "no_drivers_available",
      });

      console.log("✅ Ride dispatched successfully");
    } catch (err) {
      console.error("❌ Matching failed:", err);
    }
  }
);