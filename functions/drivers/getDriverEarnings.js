const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const admin = require("firebase-admin");

const db = admin.firestore();

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

exports.getDriverEarnings = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
      }

      const { uid } = req.body || {};

      if (!uid) {
        return res.status(400).json({ success: false, error: "Missing uid" });
      }

      // ── Time boundaries ───────────────────────────────────────────
      const now = new Date();

      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const lastWeekStart = new Date(weekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(weekStart);
      lastWeekEnd.setMilliseconds(-1);

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);

      const lookbackStart = lastWeekStart < monthStart ? lastWeekStart : monthStart;

      // ── Query ─────────────────────────────────────────────────────
      const snap = await db
        .collection("Rides")
        .where("driverUid",     "==", uid)
        .where("status",        "==", "completed")
        .where("paymentStatus", "==", "succeeded")
        .where("updatedAt",     ">=", admin.firestore.Timestamp.fromDate(lookbackStart))
        .get();

      // ── Totals ────────────────────────────────────────────────────
      let todayEarnings    = 0;
      let todayTrips       = 0;
      let weekEarnings     = 0;
      let weekTrips        = 0;
      let lastWeekEarnings = 0;
      let monthEarnings    = 0;
      let monthTrips       = 0;

      // Daily breakdown — keyed by day index 0 (Sun) → 6 (Sat)
      const dailyMap = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

      snap.forEach((doc) => {
        const data   = doc.data();
        const payout = data.driverPayout || 0;
        const date   = data.updatedAt?.toDate?.();

        if (!date) return;

        if (date >= monthStart) {
          monthEarnings += payout;
          monthTrips++;
        }

        if (date >= weekStart) {
          weekEarnings += payout;
          weekTrips++;

          // ── Add to daily breakdown ───────────────────────────────
          const dayIndex = date.getDay(); // 0 = Sun, 6 = Sat
          dailyMap[dayIndex] = +(dailyMap[dayIndex] + payout).toFixed(2);

          if (date >= todayStart) {
            todayEarnings += payout;
            todayTrips++;
          }
        } else if (date >= lastWeekStart && date <= lastWeekEnd) {
          lastWeekEarnings += payout;
        }
      });

      // ── Build daily array (Sun → Sat) ─────────────────────────────
      // Only includes days up to today so future days show as null
      const todayDayIndex = now.getDay();
      const dailyBreakdown = DAYS.map((day, i) => ({
        day,
        amount:  i <= todayDayIndex ? dailyMap[i] : null,
        isToday: i === todayDayIndex,
      }));

      // ── Week-over-week % change ───────────────────────────────────
      let weekChangePercent = 0;
      if (lastWeekEarnings > 0) {
        weekChangePercent = ((weekEarnings - lastWeekEarnings) / lastWeekEarnings) * 100;
      } else if (weekEarnings > 0) {
        weekChangePercent = 100;
      }

      // ── Build summary ─────────────────────────────────────────────
      const earningsSummary = {
        today: {
          earnings: +todayEarnings.toFixed(2),
          trips:     todayTrips,
        },
        week: {
          earnings:         +weekEarnings.toFixed(2),
          trips:             weekTrips,
          changePercent:    +weekChangePercent.toFixed(1),
          lastWeekEarnings: +lastWeekEarnings.toFixed(2),
          dailyBreakdown,
        },
        month: {
          earnings: +monthEarnings.toFixed(2),
          trips:     monthTrips,
        },
        lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // ── Write to Drivers doc ──────────────────────────────────────
      await db.collection("Drivers").doc(uid).update({
        earnings:  earningsSummary,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ [getDriverEarnings] uid: ${uid} | today: $${earningsSummary.today.earnings} (${todayTrips} trips) | week: $${earningsSummary.week.earnings} | month: $${earningsSummary.month.earnings}`);

      return res.status(200).json({
        success: true,
        ...earningsSummary,
      });

    } catch (err) {
      console.error("❌ getDriverEarnings:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Internal server error",
      });
    }
  });
});