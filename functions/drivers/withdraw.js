(default)

Accounts

Admin

Drivers

Rides

Search
Rides

MPjnntkYtjyzMaD1G8Mq

WbtG2eQrnieF7b3WVDXj
WbtG2eQrnieF7b3WVDXj
acceptedAt
May 3, 2026 at 9:59:04 AM UTC-4
(timestamp)


adminNotified
true
(boolean)


arrivedAt
May 3, 2026 at 10:09:46 AM UTC-4
(timestamp)



candidateDriverUids
(array)


0
"duuEID4AofX1ooCLfSsfVMjJpUu1"
(string)



candidateDrivers
(array)



0
(map)


distance
0.001203767555356099
(double)


uid
"duuEID4AofX1ooCLfSsfVMjJpUu1"
(string)


cashCollectedAt
May 3, 2026 at 10:31:51 AM UTC-4
(timestamp)


completedAt
May 3, 2026 at 10:32:11 AM UTC-4
(timestamp)


completedEmailSent
true
(boolean)


completedEmailSentAt
May 3, 2026 at 10:32:12 AM UTC-4
(timestamp)


createdAt
May 3, 2026 at 9:57:39 AM UTC-4
(timestamp)


currentDriverIndex
0
(int64)


driverDistanceMiles
0.08
(double)


driverEtaMin
1
(int64)


driverInfo
null
(null)


driverLat
28.57270825
(double)


driverLng
-81.46776849999999
(double)


driverLocationAt
May 3, 2026 at 10:32:07 AM UTC-4
(timestamp)


driverPayout
3.74
(double)


driverUid
"duuEID4AofX1ooCLfSsfVMjJpUu1"
(string)


dropoff
"3024 North Powers Drive, Orlando, FL, USA"
(string)


dropoffCity
"Orlando"
(string)


dropoffDistanceMiles
0.79
(double)


dropoffEtaMin
4
(int64)


dropoffLat
28.5819909
(double)


dropoffLng
-81.4694363
(double)


dropoffZip
"32818"
(string)


emailDispatchAt
May 3, 2026 at 9:58:46 AM UTC-4
(timestamp)


emailDispatchStarted
true
(boolean)



emailSentToDrivers
(map)


duuEID4AofX1ooCLfSsfVMjJpUu1
true
(boolean)


expiresAt
May 3, 2026 at 10:07:39 AM UTC-4
(timestamp)



fareBreakdown
(map)


fareTotal
4.99
(double)


lastPushAt
May 3, 2026 at 9:59:04 AM UTC-4
(timestamp)


paymentIntentId
null
(null)


paymentMethod
"cash"
(string)


paymentStatus
"succeeded"
(string)


payoutStatus
"paid"
(string)


pickup
"2382 Locke Ave, Orlando, FL, USA"
(string)


pickupCity
"Orlando"
(string)


pickupLat
28.5730568
(double)


pickupLng
-81.46963459999999
(double)


pickupZip
"32818"
(string)


platformFee
1.25
(double)


polyline
"wtkmDp~fpNxACLI?a@GeF@s@{\F_C?{@?qXHBjBFJIdEBTDNRT"
(string)


pushDispatchAt
May 3, 2026 at 9:58:04 AM UTC-4
(timestamp)


pushDispatchStarted
true
(boolean)


pushDriverIndex
10
(int64)



pushSentToDrivers
(map)


duuEID4AofX1ooCLfSsfVMjJpUu1
true
(boolean)


requestSentAt
May 3, 2026 at 9:59:03 AM UTC-4
(timestamp)


rideLabel
"Economy"
(string)


rideType
"economy"
(string)


riderDropoffDistanceMiles
0.8
(double)


riderDropoffEtaMin
4
(int64)


riderLat
28.57270521428572
(double)


riderLng
-81.46776814285715
(double)


riderLocationAt
May 3, 2026 at 10:01:18 AM UTC-4
(timestamp)


startedAt
May 3, 2026 at 10:32:05 AM UTC-4
(timestamp)


status
"completed"
(string)


timeoutMinutes
10
(int64)


tripDistanceMiles
0.93
(double)


tripDurationMin
5
(int64)


tripProgress
0.13978494623655913
(double)


uid
"5BlsJlZGTVesHtaCbmxgD5ENHXy2"
(string)


updatedAt
May 3, 2026 at 10:32:11 AM UTC-4

const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

const db = admin.firestore();

exports.withdraw = onSchedule(
  {
    schedule: "* * * * *",
    region:   "us-central1",
    timeZone: "America/New_York",
  },
  async () => {
    try {

      // ── Query all pending payouts ───────────────────────────────
      const snap = await db.collection("Rides")
        .where("status",        "==", "completed")
        .where("paymentStatus", "==", "succeeded")
        .where("payoutStatus",  "==", "pending")
        .get();

      // ── Group rides by driverUid ────────────────────────────────
      const driverMap = {};

      snap.forEach((doc) => {
        const data = doc.data();
        const uid  = data.driverUid;
        if (!uid) return;

        if (!driverMap[uid]) {
          driverMap[uid] = { rides: [], totalPayout: 0 };
        }

        driverMap[uid].rides.push({ id: doc.id, ...data });
        driverMap[uid].totalPayout = +(driverMap[uid].totalPayout + (data.driverPayout || 0)).toFixed(2);
      });

      const now     = admin.firestore.Timestamp.now();
      const batch   = db.batch();
      const summary = [];

      // ── Zero out paid drivers with no new rides ─────────────────
      const allDriversWithWithdrawal = await db.collection("Drivers")
        .where("withdrawal.status", "==", "paid")
        .get();

      allDriversWithWithdrawal.forEach((doc) => {
        const uid = doc.id;
        if (!driverMap[uid]) {
          batch.update(db.collection("Drivers").doc(uid), {
            "withdrawal.totalPayout": 0,
            "withdrawal.rideCount":   0,
            "withdrawal.rideIds":     [],
            "withdrawal.riders":      [],
            "withdrawal.updatedAt":   now,
          });
        }
      });

      // ── Process each driver with pending rides ──────────────────
      for (const [uid, { rides, totalPayout }] of Object.entries(driverMap)) {

        const driverSnap = await db.collection("Drivers").doc(uid).get();
        if (!driverSnap.exists) {
          console.warn(`⚠️  [withdraw] Driver doc not found: ${uid} — skipping`);
          continue;
        }

        const driver    = driverSnap.data();
        const existing  = driver.withdrawal;
        const driverRef = db.collection("Drivers").doc(uid);

        // ── Build riders summary for this batch of rides ──────────
        // Fetch rider accounts to get names
        const riderUids = [...new Set(rides.map(r => r.uid).filter(Boolean))];
        const riderDocs = await Promise.all(
          riderUids.map(ruid => db.collection("Accounts").doc(ruid).get())
        );
        const riderNameMap = {};
        riderDocs.forEach((d) => {
          if (d.exists) {
            const data = d.data();
            riderNameMap[d.id] = data.name || data.email || d.id;
          }
        });

        // Build per-ride breakdown
        const rideBreakdown = rides.map(r => ({
          rideId:      r.id,
          riderUid:    r.uid     ?? null,
          riderName:   riderNameMap[r.uid] ?? "Unknown",
          pickup:      r.pickup  ?? "",
          dropoff:     r.dropoff ?? "",
          driverPayout: r.driverPayout ?? 0,
          fareTotal:   r.fareTotal    ?? 0,
          completedAt: r.completedAt  ?? null,
          rideType:    r.rideType     ?? "standard",
        }));

        const isPaidOrEmpty = !existing || existing.status === "paid";

        if (isPaidOrEmpty) {
          // ── Fresh withdrawal ──────────────────────────────────
          batch.update(driverRef, {
            withdrawal: {
              totalPayout,
              rideCount:     rides.length,
              rideIds:       rides.map(r => r.id),
              rideBreakdown,
              status:        "pending",
              createdAt:     now,
              updatedAt:     now,
            },
            updatedAt: now,
          });
        } else {
          // ── Accumulate into existing pending withdrawal ───────
          const mergedTotal     = +((existing.totalPayout ?? 0) + totalPayout).toFixed(2);
          const mergedIds       = [...(existing.rideIds ?? []),       ...rides.map(r => r.id)];
          const mergedCount     = (existing.rideCount ?? 0) + rides.length;
          const mergedBreakdown = [...(existing.rideBreakdown ?? []), ...rideBreakdown];

          batch.update(driverRef, {
            "withdrawal.totalPayout":   mergedTotal,
            "withdrawal.rideCount":     mergedCount,
            "withdrawal.rideIds":       mergedIds,
            "withdrawal.rideBreakdown": mergedBreakdown,
            "withdrawal.updatedAt":     now,
            updatedAt:                  now,
          });
        }

        // ── Mark rides as processing ──────────────────────────────
        for (const ride of rides) {
          batch.update(db.collection("Rides").doc(ride.id), {
            payoutStatus: "processing",
            updatedAt:    now,
          });
        }

        summary.push({
          driverUid:    uid,
          name:         `${driver.firstName ?? ""} ${driver.lastName ?? ""}`.trim(),
          totalPayout,
          rideCount:    rides.length,
          merged:       !isPaidOrEmpty,
          rideBreakdown,
        });
      }

      await batch.commit();

      if (summary.length === 0 && snap.empty) {
        console.log("ℹ️  [withdraw] No pending payouts found.");
        return;
      }

      console.log(
        `✅ [withdraw] ${summary.length} driver(s) | ` +
        `${summary.reduce((a, d) => a + d.rideCount, 0)} rides | ` +
        `$${summary.reduce((a, d) => a + d.totalPayout, 0).toFixed(2)} total\n` +
        summary.map(d =>
          `  → ${d.name} (${d.driverUid})  $${d.totalPayout}  (${d.rideCount} rides)${d.merged ? " [merged]" : " [new]"}\n` +
          d.rideBreakdown.map(r =>
            `      · ${r.riderName} — ${r.pickup.split(",")[0]} → ${r.dropoff.split(",")[0]} — $${r.driverPayout}`
          ).join("\n")
        ).join("\n")
      );

    } catch (err) {
      console.error("❌ [withdraw]", err);
    }
  }
);