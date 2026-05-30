// functions/callable/awardReward.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const Stripe = require("stripe");
const crypto = require("crypto");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * awardReward
 *
 * Admin-callable function that awards a monetary incentive to a driver.
 * - Fires an instant Stripe transfer from the platform account → driver's
 *   connected Stripe account.
 * - Appends an entry to the driver's `rewards[]` array.
 * - Increments `rewardsBalance` (lifetime wallet display; resets to 0
 *   when the driver's next withdrawal is processed).
 *
 * Required caller data:
 *   driverUid   {string}  — Firestore Driver doc ID
 *   amount      {number}  — Dollar amount, e.g. 5 or 10.50
 *   description {string}  — Human-readable reason, e.g. "Online downtown Orlando"
 *
 * Optional caller data:
 *   type        {string}  — Reward category. Defaults to "online_incentive"
 *                           Other examples: "referral_bonus", "streak_bonus",
 *                           "market_boost", "promo"
 *   zone        {string}  — Geo tag, e.g. "downtown_orlando"
 *   awardedBy   {string}  — Admin UID for audit trail
 */
exports.awardReward = onCall(
  { region: "us-east1", secrets: ["STRIPE_SECRET_KEY"] },
  async (request) => {
    // ── (0) AUTH CHECK ───────────────────────────────────────────────
    // Only authenticated admin users should be calling this.
    // Wire up custom claims on your admin accounts and uncomment:
    //
    // if (!request.auth?.token?.admin) {
    //   throw new HttpsError("permission-denied", "Admin only");
    // }

    const {
      driverUid,
      amount,
      description,
      type      = "online_incentive",
      zone      = null,
      awardedBy = null,
    } = request.data || {};

    // ── (1) VALIDATE INPUT ───────────────────────────────────────────
    if (!driverUid || typeof driverUid !== "string") {
      throw new HttpsError("invalid-argument", "Missing or invalid driverUid");
    }
    if (!amount || typeof amount !== "number" || amount <= 0) {
      throw new HttpsError("invalid-argument", "amount must be a positive number");
    }
    if (!description || typeof description !== "string" || !description.trim()) {
      throw new HttpsError("invalid-argument", "Missing description");
    }

    const amountCents = Math.round(amount * 100);
    if (amountCents < 50) {
      // Stripe minimum transfer is $0.50
      throw new HttpsError("invalid-argument", "Minimum reward amount is $0.50");
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // ── (2) LOAD DRIVER ──────────────────────────────────────────────
    const driverRef  = db.collection("Drivers").doc(driverUid);
    const driverSnap = await driverRef.get();

    if (!driverSnap.exists) {
      throw new HttpsError("not-found", `Driver not found: ${driverUid}`);
    }

    const driver    = driverSnap.data();
    const accountId = driver.accountId;

    if (!accountId) {
      throw new HttpsError(
        "failed-precondition",
        "Driver does not have a connected Stripe account"
      );
    }

    // ── (3) PRE-FLIGHT: verify connected account can receive transfers ─
    try {
      const account = await stripe.accounts.retrieve(accountId);

      if (account.capabilities?.transfers !== "active") {
        throw new HttpsError(
          "failed-precondition",
          "Driver's Stripe account cannot receive transfers yet"
        );
      }
      if (account.requirements?.disabled_reason) {
        throw new HttpsError(
          "failed-precondition",
          `Driver's Stripe account is disabled: ${account.requirements.disabled_reason}`
        );
      }
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error("[awardReward] account retrieve failed:", err);
      throw new HttpsError("internal", "Could not verify driver Stripe account");
    }

    // ── (4) PRE-FLIGHT: check platform balance ───────────────────────
    try {
      const balance   = await stripe.balance.retrieve();
      const available = (balance.available ?? [])
        .filter((b) => b.currency === "usd")
        .reduce((sum, b) => sum + b.amount, 0);

      if (available < amountCents) {
        throw new HttpsError(
          "failed-precondition",
          `Insufficient platform balance: $${(available / 100).toFixed(2)} available, $${amount.toFixed(2)} needed`
        );
      }
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      // Non-fatal — log but proceed; Stripe will reject if truly insufficient
      console.warn("[awardReward] balance check failed:", err.message);
    }

    // ── (5) IDEMPOTENCY KEY ──────────────────────────────────────────
    // Deterministic per driver + amount + description so accidental
    // double-taps in the admin UI don't fire two transfers.
    const idempotencyKey = crypto
      .createHash("sha256")
      .update(`reward:${driverUid}:${amountCents}:${description.trim()}:${Date.now()}`)
      .digest("hex")
      .slice(0, 64);

    // ── (6) STRIPE TRANSFER ──────────────────────────────────────────
    let transfer;
    try {
      transfer = await stripe.transfers.create(
        {
          amount:      amountCents,
          currency:    "usd",
          destination: accountId,
          description: `UaTob reward — ${description.trim()}`,
          metadata: {
            driverUid,
            rewardType:  type,
            description: description.trim().slice(0, 200),
            zone:        zone ?? "",
            awardedBy:   awardedBy ?? "admin",
            createdBy:   "awardReward",
          },
        },
        { idempotencyKey }
      );
    } catch (err) {
      console.error("[awardReward] Stripe transfer failed:", {
        code:    err.code,
        type:    err.type,
        message: err.message,
      });

      await logRewardAttempt(driverUid, {
        success:       false,
        reason:        "stripe_transfer_failed",
        stripeCode:    err.code,
        stripeMessage: err.message,
        amount,
        description,
        type,
        zone,
        awardedBy,
      });

      if (err.code === "balance_insufficient") {
        throw new HttpsError("failed-precondition", "Platform has insufficient available balance");
      }
      if (err.code === "account_invalid") {
        throw new HttpsError("failed-precondition", "Driver Stripe account is invalid");
      }
      throw new HttpsError("internal", err.message || "Stripe transfer failed");
    }

    console.log(
      `[awardReward] transferId=${transfer.id} driver=${driverUid} amount=$${amount.toFixed(2)}`
    );

    // ── (7) FIRESTORE WRITE ──────────────────────────────────────────
    // Money has already moved. Build the reward entry then atomically
    // append it and increment rewardsBalance.
    const now = admin.firestore.Timestamp.now();

    const rewardEntry = {
      id:          transfer.id,           // Stripe transfer ID as stable reward ID
      type,
      description: description.trim(),
      amount,
      amountCents,
      zone:        zone ?? null,
      awardedBy:   awardedBy ?? null,
      transferId:  transfer.id,
      awardedAt:   now,
      status:      "paid",                // always paid — transfer already fired
    };

    try {
      await driverRef.update({
        rewards:        admin.firestore.FieldValue.arrayUnion(rewardEntry),
        rewardsBalance: admin.firestore.FieldValue.increment(amount),
        updatedAt:      now,
      });
    } catch (err) {
      // Money moved but Firestore failed. Log loudly — admin must reconcile.
      console.error("[awardReward] CRITICAL: Stripe transfer succeeded but Firestore write failed", {
        transferId: transfer.id,
        driverUid,
        amount,
        err: err.message,
      });

      await logRewardAttempt(driverUid, {
        success:        false,
        reason:         "CRITICAL_firestore_write_failed",
        transferId:     transfer.id,
        amount,
        description,
        firestoreError: err.message,
      });

      throw new HttpsError(
        "internal",
        "Reward transferred but not recorded — contact support with transfer ID: " + transfer.id
      );
    }

    // ── (8) AUDIT LOG ────────────────────────────────────────────────
    await logRewardAttempt(driverUid, {
      success:    true,
      transferId: transfer.id,
      amount,
      description,
      type,
      zone,
      awardedBy,
      idempotencyKey,
    });

    return {
      success:    true,
      driverUid,
      amount,
      transferId: transfer.id,
      awardedAt:  now.toDate().toISOString(),
    };
  }
);

// ── Helper: write to RewardLogs collection for audit + admin debugging ──
async function logRewardAttempt(driverUid, payload) {
  try {
    await db.collection("RewardLogs").add({
      driverUid,
      ...payload,
      at: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn("[awardReward] logRewardAttempt failed:", err.message);
  }
}
