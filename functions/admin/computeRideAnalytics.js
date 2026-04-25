const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");

if (!getApps().length) initializeApp();

const db = getFirestore();

exports.computeRideAnalytics = onSchedule(
  { schedule: "every 1 minutes", region: "us-east1", timeZone: "America/New_York" },
  async () => {
    const now = new Date();

    const dayOfWeek = now.getDay();
    const diffToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() + diffToMon);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const ridesSnap = await db.collection("Rides")
      .where("createdAt", ">=", Timestamp.fromDate(monday))
      .where("createdAt", "<=", Timestamp.fromDate(sunday))
      .get();

    const rides     = ridesSnap.docs.map(d => d.data());
    const completed = rides.filter(r => r.status === "completed");

    const ridesPerDay = [0, 0, 0, 0, 0, 0, 0];
    rides.forEach(r => {
      const d = r.createdAt?.toDate?.();
      if (!d) return;
      const idx = (d.getDay() === 0 ? 6 : d.getDay() - 1);
      ridesPerDay[idx]++;
    });

    const totalRides     = rides.length;
    const totalCompleted = completed.length;

    const avgFare = totalCompleted
      ? completed.reduce((s, r) => s + (r.fareTotal ?? 0), 0) / totalCompleted
      : 0;

    const avgTripDuration = totalCompleted
      ? completed.reduce((s, r) => s + (r.tripDurationMin ?? 0), 0) / totalCompleted
      : 0;

    const accepted         = rides.filter(r => r.driverUid).length;
    const declined         = rides.filter(r => r.status === "declined" || r.status === "expired").length;
    const acceptanceRate   = totalRides ? (accepted / totalRides) * 100 : 0;
    const cancellationRate = totalRides ? (declined / totalRides) * 100 : 0;

    // ── Build driver map from completed rides ──────────────────────────────
    const driverMap = {};
    completed.forEach(r => {
      const uid = r.driverUid;
      if (!uid) return;
      if (!driverMap[uid]) driverMap[uid] = { uid, rides: 0, fareTotal: 0 };
      driverMap[uid].rides++;
      driverMap[uid].fareTotal += r.fareTotal ?? 0;
    });

    // ── Enrich with name + rating from Drivers collection ─────────────────
    const topUids = Object.values(driverMap)
      .sort((a, b) => b.rides - a.rides)
      .slice(0, 10)
      .map(d => d.uid);

    const driverDocs = await Promise.all(
      topUids.map(uid => db.collection("Drivers").doc(uid).get())
    );

    const topDrivers = driverDocs.map((snap, i) => {
      const uid  = topUids[i];
      const data = snap.exists ? snap.data() : {};
      const entry = driverMap[uid];
      return {
        rank:          i + 1,
        uid,
        name:          `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim() || uid,
        averageRating: data.averageRating ?? 0,
        totalRides:    data.totalRides ?? entry.rides,
        rides:         entry.rides,
        fareTotal:     parseFloat(entry.fareTotal.toFixed(2)),
      };
    });

    await db.collection("Admin").doc("analytics").set({
      updatedAt:        FieldValue.serverTimestamp(),
      weekStart:        Timestamp.fromDate(monday),
      weekEnd:          Timestamp.fromDate(sunday),
      totalRides,
      totalCompleted,
      ridesPerDay,
      avgFare:          parseFloat(avgFare.toFixed(2)),
      avgTripDuration:  parseFloat(avgTripDuration.toFixed(2)),
      acceptanceRate:   parseFloat(acceptanceRate.toFixed(2)),
      cancellationRate: parseFloat(cancellationRate.toFixed(2)),
      topDrivers,
    });

    console.log(`[Analytics] Done — ${totalRides} rides, ${topDrivers.length} top drivers`);
  }
);