const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp, getApps } = require("firebase-admin/app");
const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");

if (!getApps().length) initializeApp();

const db = getFirestore();

// ── Haversine Distance (miles) ─────────────────────────────
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

// ── Firestore Trigger (UPDATED) ─────────────────────────────
exports.onRideCreated = onDocumentUpdated(
  {
    document: "Rides/{rideId}",
    region: "us-central1",
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const rideRef = event.data.after.ref;

    // ✅ Prevent infinite loop (only run when status changes to "searching_driver")
    if (before.status === after.status) return;

    if (after.status !== "searching_driver") return;

    const { pickupLat, pickupLng } = after;

    if (pickupLat == null || pickupLng == null) {
      console.error("❌ Missing pickup coordinates");
      return;
    }

    try {
      // ── 1. ONLY ONLINE DRIVERS ─────────────────────────────
      const driversSnap = await db
        .collection("Drivers")
        .where("status", "==", "online")
        .get();

      if (driversSnap.empty) {
        console.log("⚠️ No online drivers found");

        await rideRef.update({
          candidateDrivers: [],
          candidateDriverUids: [],
          currentDriverIndex: 0,
          status: "no_drivers_available",
          requestSentAt: FieldValue.serverTimestamp(),
        });

        return;
      }

      // ── 2. VALIDATE DRIVER DATA ─────────────────────────────
      const drivers = driversSnap.docs
        .map((doc) => doc.data())
        .filter(
          (d) =>
            typeof d.lat === "number" &&
            typeof d.lng === "number" &&
            d.uid
        );

      if (drivers.length === 0) {
        console.log("⚠️ No valid driver locations");

        await rideRef.update({
          candidateDrivers: [],
          candidateDriverUids: [],
          currentDriverIndex: 0,
          status: "no_valid_drivers",
          requestSentAt: FieldValue.serverTimestamp(),
        });

        return;
      }

      // ── 3. SORT BY DISTANCE ─────────────────────────────
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

      // ── 4. UPDATE RIDE ─────────────────────────────
      await rideRef.update({
        candidateDrivers: topDrivers,
        candidateDriverUids: topDrivers.map((d) => d.uid),
        currentDriverIndex: 0,
        requestSentAt: FieldValue.serverTimestamp(),
      });

      console.log(
        `✅ Ride re-dispatched to ${topDrivers.length} drivers`
      );
    } catch (err) {
      console.error("❌ Matching failed:", err);

      await rideRef.update({
        status: "error_matching_drivers",
      });
    }
  }
);