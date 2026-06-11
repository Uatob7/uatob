// functions/accounts/dispatch.js
// Scheduled every 1 minute.
// 1. Expires searching_driver rides past their expireAt → "timeout"
// 2. Dispatches pending/scheduled rides that have verified payment
// 3. Sends FCM push to every matched driver that has an fcmToken

const { onSchedule }   = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { getMessaging } = require("firebase-admin/messaging");
const admin            = require("firebase-admin");
const Stripe           = require("stripe");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");

// ── CONFIG ─────────────────────────────────────────────────────
const DISPATCH_LEAD_MS  = 30 * 60 * 1000;
const FRESH_MS          = 10 * 60 * 1000;
const STALE_PENALTY_MIN = 10;
const AVG_SPEED_MPH     = 25;
const MIN_ETA_MIN       = 7;
const EXPIRE_ETA_MULT   = 2;
const EXPIRE_FLOOR_MS   = 30 * 60 * 1000;

// ── HELPERS ────────────────────────────────────────────────────
const round2 = (n) => Number(Number(n).toFixed(2));

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R    = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateEtaMinutes(miles) {
  return Math.max(MIN_ETA_MIN, Math.round((miles / AVG_SPEED_MPH) * 60 + 1));
}

function presenceMillis(d) {
  const fromTs = (v) =>
    v && typeof v.toMillis === "function" ? v.toMillis()
    : typeof v === "number"               ? v
    :                                       null;
  return fromTs(d.presenceUpdatedAt) ?? fromTs(d.lastSeenAt) ?? fromTs(d.updatedAt) ?? null;
}

function toMillisSafe(v) {
  if (!v) return null;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v === "number") return v;
  const ms = new Date(v).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function computeExpireAt(ride, match) {
  const nearestEtaMin = match.length ? match[0].etaMin : 45;
  const baseMs =
    toMillisSafe(ride.isScheduled && ride.scheduledAt ? ride.scheduledAt : ride.createdAt)
    ?? Date.now();
  const offsetMs = Math.max(EXPIRE_FLOOR_MS, nearestEtaMin * EXPIRE_ETA_MULT * 60_000);
  return new Date(baseMs + offsetMs);
}

// ── BUILD MATCH ─────────────────────────────────────────────────
// _fcmToken is kept in memory only — stripped before writing to Firestore
function buildMatch(driverPool, pickupLat, pickupLng, pickupZip) {
  const now = Date.now();
  let pool  = driverPool;

  if (pickupZip) {
    const zipPool = driverPool.filter(
      (d) => String(d.raw?.contact?.zip ?? "") === String(pickupZip)
    );
    if (zipPool.length) pool = zipPool;
  }

  const match = [];
  for (const d of pool) {
    const raw = d.raw;
    if (typeof raw.lat !== "number" || typeof raw.lng !== "number") continue;

    const lastPresence = presenceMillis(raw);
    const ageMs        = lastPresence === null ? 0 : now - lastPresence;
    const miles        = round2(haversineMiles(pickupLat, pickupLng, raw.lat, raw.lng));
    const stale        = lastPresence !== null && ageMs > FRESH_MS;
    const etaMin       = estimateEtaMinutes(miles) + (stale ? STALE_PENALTY_MIN : 0);

    match.push({
      uid:               raw.uid ?? d.id,
      miles,
      etaMin,
      stale,
      onlineTime:        typeof raw.onlineTime === "number" ? raw.onlineTime : null,
      presenceUpdatedAt: lastPresence,
      _fcmToken:         typeof raw.fcmToken === "string" && raw.fcmToken.length > 0
                           ? raw.fcmToken
                           : null,
    });
  }

  match.sort((a, b) => a.miles - b.miles);
  return match;
}

// Strip _fcmToken before any Firestore write
function toFirestoreMatch(match) {
  return match.map(({ _fcmToken, ...rest }) => rest);
}

// ── NOTIFY MATCHED DRIVERS ──────────────────────────────────────
async function notifyMatchedDrivers(match, ride, rideId) {
  const withToken    = match.filter((d) => d._fcmToken);
  const withoutToken = match.filter((d) => !d._fcmToken);

  // Log drivers being skipped — useful when most drivers don't have tokens yet
  if (withoutToken.length > 0) {
    console.log(
      `[dispatch] ${rideId} — ${withoutToken.length} driver(s) skipped (no FCM token): ` +
      withoutToken.map((d) => d.uid).join(", ")
    );
  }

  if (withToken.length === 0) {
    console.log(`[dispatch] ${rideId} — no drivers with FCM token, push skipped.`);
    return;
  }

  const pickup  = ride.pickup  || "a nearby location";
  const dropoff = ride.dropoff || "your destination";

  const results = await Promise.allSettled(
    withToken.map(({ _fcmToken, uid, miles, etaMin }) =>
      getMessaging().send({
        token: _fcmToken,
        notification: {
          title: "🚗 New ride request",
          body:  `${pickup} → ${dropoff} · ${miles}mi · ~${etaMin}min away`,
        },
        data: {
          type:    "ride_request",
          rideId,
          miles:   String(miles),
          etaMin:  String(etaMin),
          pickup,
          dropoff,
        },
        android: {
          priority:     "high",
          notification: { sound: "default", channelId: "ride_requests" },
        },
        apns: {
          payload: { aps: { sound: "default", badge: 1 } },
        },
      })
      .then(() => ({ uid, sent: true }))
      .catch((err)  => ({ uid, sent: false, code: err?.errorInfo?.code ?? err?.message }))
    )
  );

  // Tally results + collect stale tokens
  const sent       = [];
  const failed     = [];
  const staleUids  = [];

  results.forEach((result, i) => {
    const { uid } = withToken[i];
    if (result.status === "fulfilled" && result.value.sent) {
      sent.push(uid);
    } else {
      const code = result.status === "fulfilled"
        ? result.value.code
        : result.reason?.errorInfo?.code ?? result.reason?.message;

      failed.push({ uid, code });

      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        staleUids.push(uid);
      }
    }
  });

  if (sent.length > 0) {
    console.log(
      `[dispatch] ${rideId} — pushed to ${sent.length} driver(s): ${sent.join(", ")}`
    );
  }
  if (failed.length > 0) {
    console.warn(
      `[dispatch] ${rideId} — push failed for ${failed.length} driver(s): ` +
      failed.map((f) => `${f.uid}(${f.code})`).join(", ")
    );
  }

  // Clean up stale FCM tokens from Driver docs
  if (staleUids.length > 0) {
    await Promise.allSettled(
      staleUids.map((uid) =>
        db.collection("Drivers").doc(uid).update({
          fcmToken: admin.firestore.FieldValue.delete(),
        })
        .then(() => console.log(`[dispatch] 🧹 Removed stale token for driver ${uid}`))
        .catch((err) => console.warn(`[dispatch] Could not remove stale token for ${uid}:`, err))
      )
    );
  }
}

// ── MAIN ───────────────────────────────────────────────────────
exports.dispatch = onSchedule(
  {
    schedule: "every 1 minutes",
    region:   "us-east1",
    timeZone: "America/New_York",
    secrets:  [STRIPE_SECRET_KEY],
  },
  async () => {
    const now   = Date.now();
    const nowTs = admin.firestore.Timestamp.fromMillis(now);

    // ── 1. Parallel queries ──────────────────────────────────
    const [snapshot, expiredSnap, driverSnap] = await Promise.all([
      db.collection("Rides")
        .where("status", "in", ["scheduled", "pending_dispatch"])
        .get(),
      db.collection("Rides")
        .where("status", "==", "searching_driver")
        .where("expireAt", "<=", nowTs)
        .get(),
      db.collection("Drivers")
        .where("status", "==", "online")
        .get(),
    ]);

    // ── 2. Expire timed-out rides ────────────────────────────
    if (!expiredSnap.empty) {
      console.log(`[dispatch] Timing out ${expiredSnap.size} expired ride(s)...`);
      await Promise.allSettled(
        expiredSnap.docs.map((doc) =>
          doc.ref.update({
            status:     "timeout",
            timedOutAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt:  admin.firestore.FieldValue.serverTimestamp(),
          })
          .then(() => console.log(`[dispatch] ⏰ ${doc.id} → timeout`))
          .catch((err) => console.error(`[dispatch] ❌ timeout failed for ${doc.id}:`, err))
        )
      );
    }

    if (snapshot.empty) {
      console.log("[dispatch] No rides awaiting dispatch.");
      return;
    }

    console.log(`[dispatch] Evaluating ${snapshot.size} ride(s)...`);

    // ── 3. Driver pool ───────────────────────────────────────
    const driverPool = driverSnap.docs.map((doc) => ({ id: doc.id, raw: doc.data() }));

    const withTokenCount    = driverPool.filter((d) => d.raw.fcmToken).length;
    const withoutTokenCount = driverPool.length - withTokenCount;
    console.log(
      `[dispatch] Driver pool: ${driverPool.length} online ` +
      `(${withTokenCount} with FCM token, ${withoutTokenCount} without)`
    );

    // ── 4. Lazy Stripe init ──────────────────────────────────
    let stripe = null;
    const getStripe = () => {
      if (!stripe) {
        const key = STRIPE_SECRET_KEY.value();
        if (!key) throw new Error("Stripe key not configured");
        stripe = new Stripe(key);
      }
      return stripe;
    };

    // ── 5. Process rides ─────────────────────────────────────
    await Promise.allSettled(
      snapshot.docs.map(async (doc) => {
        const ride   = doc.data();
        const rideId = doc.id;

        try {
          await doc.ref.update({
            dispatchLastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Scheduled gate
          if (ride.isScheduled && ride.scheduledAt) {
            const schedMs = toMillisSafe(ride.scheduledAt);
            if (schedMs === null) {
              console.warn(`[dispatch] ${rideId} invalid scheduledAt — skipping`);
              return;
            }
            if (now < schedMs - DISPATCH_LEAD_MS) return;
          }

          // Payment gate
          const method = ride.paymentMethod ?? "card";
          let paymentVerified = false;
          let patchPayment    = null;

          if (method === "cash") {
            paymentVerified = ride.paymentStatus === "succeeded";
          } else {
            if (!ride.paymentIntentId) {
              console.log(`[dispatch] ${rideId} (${method}) no paymentIntentId — skipping`);
              return;
            }

            if (ride.paymentStatus === "succeeded") {
              paymentVerified = true;
            } else {
              const intent = await getStripe().paymentIntents.retrieve(ride.paymentIntentId);
              console.log(`[dispatch] ${rideId} (${method}) intent: ${intent.status}`);

              if (intent.status === "succeeded") {
                paymentVerified = true;
                patchPayment    = "succeeded";
              } else if (intent.status === "canceled") {
                await doc.ref.update({
                  paymentStatus: "canceled",
                  status:        "canceled",
                  updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
                });
                console.log(`[dispatch] ${rideId} intent canceled → ride canceled`);
                return;
              } else {
                return;
              }
            }
          }

          if (!paymentVerified) return;

          // Build match (includes _fcmToken in memory)
          const hasPickup =
            Number.isFinite(ride.pickupLat) && Number.isFinite(ride.pickupLng);
          const match = hasPickup
            ? buildMatch(driverPool, ride.pickupLat, ride.pickupLng, ride.pickupZip ?? null)
            : [];

          // Write to Firestore — _fcmToken stripped
          const update = {
            status:       "searching_driver",
            match:        toFirestoreMatch(match),
            matchCount:   match.length,
            expireAt:     computeExpireAt(ride, match),
            dispatchedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
          };
          if (patchPayment) update.paymentStatus = patchPayment;

          await doc.ref.update(update);

          console.log(
            `[dispatch] ✅ ${rideId} (${method}) → searching_driver | ` +
            `${match.length} driver(s)` +
            (match.length ? ` | nearest ${match[0].miles}mi / ${match[0].etaMin}min` : "")
          );

          // Push notify matched drivers (non-blocking — failure doesn't affect dispatch)
          if (match.length > 0) {
            await notifyMatchedDrivers(match, ride, rideId);
          }

        } catch (err) {
          console.error(`[dispatch] ❌ Error on ride ${rideId}:`, err);
        }
      })
    );
  }
);