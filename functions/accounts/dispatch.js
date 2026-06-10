// functions/dispatch.js

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");

// ── INIT ADMIN ─────────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// ── SECRET ─────────────────────────────────────────
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");

// ── CONFIG ─────────────────────────────────────────
const DISPATCH_LEAD_MS    = 30 * 60 * 1000;     // scheduled rides go live 30 min before scheduledAt
const FRESH_MS            = 10 * 60 * 1000;     // mirrors useQuotes
const STALE_PENALTY_MIN   = 10;
const AVG_SPEED_MPH       = 25;
const MIN_ETA_MIN         = 7;
const EXPIRE_ETA_MULT     = 2;                   // expireAt = base + (nearestEtaMin × 2)
const EXPIRE_FLOOR_MS     = 30 * 60 * 1000;      // minimum 30 min from base regardless of ETA

// ── HELPERS (mirrors useQuotes match math) ─────────
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

// ── EXPIRE AT ──────────────────────────────────────
// base = scheduledAt for scheduled rides, createdAt otherwise.
// offset = max(30 min, nearestEtaMin × 2).
function computeExpireAt(ride, match) {
  const nearestEtaMin = match.length ? match[0].etaMin : 45;
  const baseMs =
    toMillisSafe(ride.isScheduled && ride.scheduledAt ? ride.scheduledAt : ride.createdAt)
    ?? Date.now();
  const offsetMs = Math.max(EXPIRE_FLOOR_MS, nearestEtaMin * EXPIRE_ETA_MULT * 60_000);
  return new Date(baseMs + offsetMs);
}

// ── BUILD MATCH FROM CACHED DRIVER POOL ────────────
// driverPool is fetched ONCE per run; match is computed per ride.
// Zip pre-filter applied in memory — falls back to full pool if no zip hits.
function buildMatch(driverPool, pickupLat, pickupLng, pickupZip) {
  const now = Date.now();

  let pool = driverPool;
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
    });
  }

  match.sort((a, b) => a.miles - b.miles);
  return match;
}

// ── MAIN FUNCTION ──────────────────────────────────
exports.dispatch = onSchedule(
  {
    schedule: "every 1 minutes",
    region: "us-central1",
    secrets: [STRIPE_SECRET_KEY],
  },
  async () => {
    const now    = Date.now();
    const nowTs  = admin.firestore.Timestamp.fromMillis(now);

    // ── 1. PARALLEL QUERIES ────────────────────────
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

    // ── 2. EXPIRE TIMED-OUT RIDES ──────────────────
    if (!expiredSnap.empty) {
      console.log(`[dispatch] Timing out ${expiredSnap.size} expired ride(s)...`);
      const timeoutJobs = expiredSnap.docs.map((doc) =>
        doc.ref.update({
          status:      "timeout",
          timedOutAt:  admin.firestore.FieldValue.serverTimestamp(),
          updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
        }).then(() => console.log(`[dispatch] ⏰ ${doc.id} → timeout`))
          .catch((err) => console.error(`[dispatch] ❌ timeout update failed for ${doc.id}:`, err))
      );
      await Promise.allSettled(timeoutJobs);
    }

    if (snapshot.empty) {
      console.log("[dispatch] No rides awaiting dispatch.");
      return;
    }

    console.log(`[dispatch] Evaluating ${snapshot.size} ride(s)...`);

    // ── 3. DRIVER POOL ─────────────────────────────
    const driverPool = driverSnap.docs.map((doc) => ({
      id: doc.id,
      raw: doc.data(),
    }));

    console.log(`[dispatch] Driver pool: ${driverPool.length} online`);

    // ── 4. LAZY STRIPE INIT (only if a card/cashapp ride needs verify)
    let stripe = null;
    const getStripe = () => {
      if (!stripe) {
        const key = STRIPE_SECRET_KEY.value();
        if (!key) throw new Error("Stripe key not configured");
        stripe = new Stripe(key);
      }
      return stripe;
    };

    // ── 5. PROCESS RIDES ───────────────────────────
    const jobs = snapshot.docs.map(async (doc) => {
      const ride   = doc.data();
      const rideId = doc.id;

      try {
        // ── 4a. RECORD LAST SEEN BY DISPATCH ───────
        await doc.ref.update({
          dispatchLastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // ── 4b. SCHEDULED GATE ─────────────────────
        // Scheduled rides only dispatch inside the lead window.
        if (ride.isScheduled && ride.scheduledAt) {
          const schedMs = toMillisSafe(ride.scheduledAt);
          if (schedMs === null) {
            console.warn(`[dispatch] ${rideId} invalid scheduledAt — skipping`);
            return;
          }
          if (now < schedMs - DISPATCH_LEAD_MS) {
            // Too early — leave it alone.
            return;
          }
        }

        // ── 4c. PAYMENT GATE ───────────────────────
        const method = ride.paymentMethod ?? "card";
        let paymentVerified = false;
        let patchPayment = null;

        if (method === "cash") {
          // Cash rides are written paymentStatus: 'succeeded' at booking.
          paymentVerified = ride.paymentStatus === "succeeded";
        } else {
          // card / cashapp → must have a real PaymentIntent
          if (!ride.paymentIntentId) {
            // Intent never created (user bailed before step 2) — not dispatchable yet.
            console.log(`[dispatch] ${rideId} (${method}) no paymentIntentId — skipping`);
            return;
          }

          if (ride.paymentStatus === "succeeded") {
            paymentVerified = true;
          } else {
            // Verify with Stripe (cashapp confirms async after redirect)
            const intent = await getStripe().paymentIntents.retrieve(ride.paymentIntentId);
            console.log(`[dispatch] ${rideId} (${method}) intent: ${intent.status}`);

            if (intent.status === "succeeded") {
              paymentVerified = true;
              patchPayment = "succeeded";
            } else if (intent.status === "canceled") {
              await doc.ref.update({
                paymentStatus: "canceled",
                status: "canceled",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              console.log(`[dispatch] ${rideId} intent canceled → ride canceled`);
              return;
            } else {
              // requires_payment_method / processing / requires_action — wait
              return;
            }
          }
        }

        if (!paymentVerified) return;

        // ── 4d. BUILD MATCH ────────────────────────
        const hasPickup =
          Number.isFinite(ride.pickupLat) && Number.isFinite(ride.pickupLng);

        const match = hasPickup
          ? buildMatch(driverPool, ride.pickupLat, ride.pickupLng, ride.pickupZip ?? null)
          : [];

        // ── 4e. DISPATCH ───────────────────────────
        const update = {
          status: "searching_driver",
          match,
          matchCount: match.length,
          expireAt: computeExpireAt(ride, match),
          dispatchedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (patchPayment) update.paymentStatus = patchPayment;

        await doc.ref.update(update);

        console.log(
          `[dispatch] ✅ ${rideId} (${method}) → searching_driver | ${match.length} driver(s) matched` +
          (match.length ? ` | nearest ${match[0].miles} mi / ${match[0].etaMin} min` : "")
        );
      } catch (err) {
        console.error(`[dispatch] ❌ Error on ride ${rideId}:`, err);
      }
    });

    await Promise.allSettled(jobs);
  }
);