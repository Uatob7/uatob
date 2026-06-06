// File: functions/activateScheduledRides.js

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

/* ── Haversine Distance ───────────────────────────── */
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

/* ── Activate Scheduled Rides ────────────────────────
   Runs every minute.
   Finds rides where:
     - status       == "scheduled"
     - isScheduled  == true
     - paymentStatus == "succeeded"
     - scheduledAt is within the next 15 minutes
   Then matches nearby online drivers and flips to searching_driver.
──────────────────────────────────────────────────── */
exports.activateScheduledRides = onSchedule(
  {
    schedule: "every 2 minutes",
    region: "us-central1",
    timeZone: "America/New_York",
  },
  async () => {
    const now       = Date.now();
    const windowMs  = 15 * 60 * 1000; // 15 min lookahead
    const windowEnd = Timestamp.fromMillis(now + windowMs);
    const windowNow = Timestamp.fromMillis(now);

    console.log(`[activateScheduledRides] checking window: now → +15min`);

    // Rides that are scheduled, paid, and due within the next 15 min
    const ridesSnap = await db
      .collection("Rides")
      .where("status",        "==", "scheduled")
      .where("isScheduled",   "==", true)
      .where("paymentStatus", "==", "succeeded")
      .where("scheduledAt",   ">=", windowNow)
      .where("scheduledAt",   "<=", windowEnd)
      .get();

    if (ridesSnap.empty) {
      console.log("[activateScheduledRides] no rides to activate");
      return;
    }

    console.log(`[activateScheduledRides] found ${ridesSnap.size} ride(s) to activate`);

    // Fetch online drivers once — reuse for all rides this tick
    const driversSnap = await db
      .collection("Drivers")
      .where("status", "==", "online")
      .get();

    const onlineDrivers = driversSnap.docs
      .map((doc) => ({ uid: doc.id, ...doc.data() }))
      .filter((d) => typeof d.lat === "number" && typeof d.lng === "number");

    console.log(`[activateScheduledRides] ${onlineDrivers.length} drivers online`);

    const results = await Promise.allSettled(
      ridesSnap.docs.map(async (rideDoc) => {
        const rideId = rideDoc.id;
        const ride   = rideDoc.data();

        // Guard: already has candidates (re-trigger protection)
        if (ride.candidateDriverUids?.length > 0) {
          console.log(`[activateScheduledRides] ${rideId} already has candidates, skipping`);
          return;
        }

        const { pickupLat, pickupLng } = ride;

        if (pickupLat == null || pickupLng == null) {
          console.warn(`[activateScheduledRides] ${rideId} missing coords, skipping`);
          return;
        }

        if (onlineDrivers.length === 0) {
          // No drivers — still flip to searching so the rider sees the state change
          await rideDoc.ref.update({
            status:           "searching_driver",
            candidateDrivers:    [],
            candidateDriverUids: [],
            currentDriverIndex:  0,
            requestSentAt:       FieldValue.serverTimestamp(),
          });
          console.warn(`[activateScheduledRides] ${rideId} activated with 0 drivers online`);
          return;
        }

        const topDrivers = onlineDrivers
          .map((d) => ({
            uid:               d.uid,
            lat:               d.lat,
            lng:               d.lng,
            presenceUpdatedAt: d.presenceUpdatedAt || null,
            distance:          haversineDistance(d.lat, d.lng, pickupLat, pickupLng),
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 10);

        await rideDoc.ref.update({
          status:              "searching_driver",
          candidateDrivers:    topDrivers,
          candidateDriverUids: topDrivers.map((d) => d.uid),
          currentDriverIndex:  0,
          requestSentAt:       FieldValue.serverTimestamp(),
        });

        console.log(`✅ [activateScheduledRides] ${rideId} → searching_driver with ${topDrivers.length} candidates`);
      })
    );

    // Log any failures
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`[activateScheduledRides] ride ${ridesSnap.docs[i].id} failed:`, r.reason);
      }
    });
  }
);