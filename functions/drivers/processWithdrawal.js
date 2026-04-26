const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const Stripe = require("stripe");
const crypto = require("crypto");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// Stripe metadata key value max = 500 chars. Truncate ride list safely.
function buildRideIdsMetadata(rideIds) {
  const joined = rideIds.join(",");
  if (joined.length <= 480) return joined;
  // Keep first N ride IDs that fit
  let out = "";
  for (const id of rideIds) {
    const next = out ? `${out},${id}` : id;
    if (next.length > 460) break;
    out = next;
  }
  return `${out}...+${rideIds.length - out.split(",").length}more`;
}

exports.processWithdrawal = onCall(
  { region: "us-east1", secrets: ["STRIPE_SECRET_KEY"] },
  async (request) => {
    const { uid } = request.data || {};
    if (!uid) throw new HttpsError("invalid-argument", "Missing uid");

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const driverRef = db.collection("Drivers").doc(uid);

    // ── (1) ATOMIC LOCK via transaction ──────────────────────────────
    // Two concurrent invocations cannot both pass this. The transaction
    // reads the driver, validates the withdrawal, and locks it. If anything
    // fails downstream we'll roll back this lock in the catch block.
    let lockedSnapshot;
    try {
      lockedSnapshot = await db.runTransaction(async (tx) => {
        const snap = await tx.get(driverRef);
        if (!snap.exists) {
          throw new HttpsError("not-found", "Driver not found");
        }

        const driver     = snap.data();
        const withdrawal = driver.withdrawal;
        const accountId  = driver.accountId;

        if (!withdrawal) {
          throw new HttpsError("failed-precondition", "No withdrawal record on driver");
        }
        if (withdrawal.status === "paid") {
          throw new HttpsError("failed-precondition", "Withdrawal already paid");
        }
        if (withdrawal.status === "processing") {
          throw new HttpsError("failed-precondition", "Withdrawal already processing");
        }
        if (!accountId) {
          throw new HttpsError("failed-precondition", "Driver has no Stripe account");
        }

        const rideIds     = withdrawal.rideIds ?? [];
        const totalPayout = Number(withdrawal.totalPayout);

        if (!Array.isArray(rideIds) || rideIds.length === 0) {
          throw new HttpsError("failed-precondition", "No ride IDs on withdrawal");
        }
        if (!Number.isFinite(totalPayout) || totalPayout <= 0) {
          throw new HttpsError("failed-precondition", "Invalid payout amount");
        }

        // Lock it
        tx.update(driverRef, {
          "withdrawal.status":    "processing",
          "withdrawal.lockedAt":  admin.firestore.Timestamp.now(),
          "withdrawal.updatedAt": admin.firestore.Timestamp.now(),
        });

        return { driver, withdrawal, accountId, rideIds, totalPayout };
      });
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error("[processWithdrawal] lock txn failed:", err);
      throw new HttpsError("internal", "Failed to lock withdrawal");
    }

    const { accountId, rideIds, totalPayout, withdrawal } = lockedSnapshot;
    const amountCents = Math.round(totalPayout * 100);

    // ── (2) PRE-FLIGHT: verify connected account can receive transfers
    try {
      const account = await stripe.accounts.retrieve(accountId);
      if (!account.capabilities?.transfers || account.capabilities.transfers !== "active") {
        await rollbackLock(driverRef, "transfers_capability_inactive");
        throw new HttpsError(
          "failed-precondition",
          "Driver's Stripe account cannot receive transfers yet"
        );
      }
      if (account.requirements?.disabled_reason) {
        await rollbackLock(driverRef, `account_disabled_${account.requirements.disabled_reason}`);
        throw new HttpsError(
          "failed-precondition",
          `Driver's Stripe account is disabled: ${account.requirements.disabled_reason}`
        );
      }
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      await rollbackLock(driverRef, "account_retrieval_failed");
      console.error("[processWithdrawal] account retrieve failed:", err);
      throw new HttpsError("internal", "Could not verify driver Stripe account");
    }

    // ── (3) PRE-FLIGHT: check available platform balance
    // Most of your 400 errors were probably here. Failing fast with a
    // clear error is much better than a Stripe rejection.
    try {
      const balance = await stripe.balance.retrieve();
      const available = (balance.available ?? [])
        .filter((b) => b.currency === "usd")
        .reduce((sum, b) => sum + b.amount, 0);

      if (available < amountCents) {
        await rollbackLock(driverRef, "insufficient_balance");
        throw new HttpsError(
          "failed-precondition",
          `Insufficient platform balance: $${(available / 100).toFixed(2)} available, $${totalPayout.toFixed(2)} needed`
        );
      }
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      // Non-fatal — log but proceed (Stripe will reject if truly insufficient)
      console.warn("[processWithdrawal] balance check failed:", err.message);
    }

    // ── (4) IDEMPOTENCY: deterministic key prevents double-transfers
    // If Cloud Functions retries, Stripe returns the same transfer instead
    // of creating a new one. Key must be stable per withdrawal request.
    const idempotencyKey = crypto
      .createHash("sha256")
      .update(`withdrawal:${uid}:${rideIds.join(",")}:${amountCents}`)
      .digest("hex")
      .slice(0, 64);

    // ── (5) STRIPE TRANSFER ──────────────────────────────────────────
    let transfer;
    try {
      transfer = await stripe.transfers.create(
        {
          amount:      amountCents,
          currency:    "usd",
          destination: accountId,
          description: `UaTob payout — ${rideIds.length} ride(s)`,
          metadata: {
            uid,
            rideIds:     buildRideIdsMetadata(rideIds),
            rideCount:   String(rideIds.length),
            createdBy:   "processWithdrawal",
          },
        },
        { idempotencyKey }
      );
    } catch (err) {
      // Stripe call failed — release the lock and surface a useful error
      await rollbackLock(driverRef, `stripe_${err.code || "unknown"}`);
      console.error("[processWithdrawal] Stripe transfer failed:", {
        code: err.code,
        type: err.type,
        message: err.message,
      });

      // Audit log
      await logAttempt(uid, {
        success: false,
        reason: "stripe_transfer_failed",
        stripeCode: err.code,
        stripeMessage: err.message,
        amount: totalPayout,
        rideCount: rideIds.length,
      });

      // Map Stripe errors to clearer client errors
      if (err.code === "balance_insufficient") {
        throw new HttpsError("failed-precondition", "Platform has insufficient available balance");
      }
      if (err.code === "account_invalid") {
        throw new HttpsError("failed-precondition", "Driver Stripe account is invalid");
      }
      throw new HttpsError("internal", err.message || "Stripe transfer failed");
    }

    console.log(`[processWithdrawal] transferId=${transfer.id} amount=$${totalPayout} idem=${idempotencyKey.slice(0, 8)}`);

    // ── (6) FIRESTORE BATCH ──────────────────────────────────────────
    // Money has moved at this point. If this batch fails we should
    // attempt to reverse the Stripe transfer so books stay in sync.
    const now   = admin.firestore.Timestamp.now();
    const batch = db.batch();

    for (const rideId of rideIds) {
      batch.update(db.collection("Rides").doc(rideId), {
        payoutStatus:    "paid",
        payoutTransferId: transfer.id,
        payoutAt:        now,
        updatedAt:       now,
      });
    }

    batch.update(driverRef, {
      "withdrawal.status":     "paid",
      "withdrawal.paidAt":     now,
      "withdrawal.updatedAt":  now,
      "withdrawal.transferId": transfer.id,
      updatedAt: now,
    });

    try {
      await batch.commit();
    } catch (err) {
      // Money moved but bookkeeping failed. Reverse the transfer.
      console.error("[processWithdrawal] batch commit failed, attempting reversal:", err);
      try {
        await stripe.transfers.createReversal(transfer.id, {
          metadata: { reason: "firestore_batch_failed", uid },
        });
        console.log(`[processWithdrawal] transfer ${transfer.id} reversed`);
      } catch (revErr) {
        // Now we have a real problem — money moved, books wrong.
        // Log loudly and let the admin reconcile manually.
        console.error("[processWithdrawal] CRITICAL: reversal also failed", {
          transferId: transfer.id,
          uid,
          err: revErr.message,
        });
        await logAttempt(uid, {
          success: false,
          reason: "CRITICAL_unreversed_transfer",
          transferId: transfer.id,
          amount: totalPayout,
          batchError: err.message,
          reversalError: revErr.message,
        });
      }
      await rollbackLock(driverRef, "firestore_batch_failed");
      throw new HttpsError("internal", "Payment recorded but bookkeeping failed; reversal attempted");
    }

    // ── (7) AUDIT LOG (success) ──────────────────────────────────────
    await logAttempt(uid, {
      success: true,
      transferId: transfer.id,
      amount: totalPayout,
      rideCount: rideIds.length,
      idempotencyKey,
    });

    return {
      success:    true,
      uid,
      totalPayout,
      rideCount:  rideIds.length,
      transferId: transfer.id,
      paidAt:     now.toDate().toISOString(),
    };
  }
);

// ── Helper: rollback lock back to "pending" with a recorded reason ──
async function rollbackLock(driverRef, reason) {
  try {
    await driverRef.update({
      "withdrawal.status":     "pending",
      "withdrawal.lockedAt":   admin.firestore.FieldValue.delete(),
      "withdrawal.lastError":  reason,
      "withdrawal.lastErrorAt": admin.firestore.Timestamp.now(),
      "withdrawal.updatedAt":  admin.firestore.Timestamp.now(),
    });
  } catch (err) {
    console.error("[processWithdrawal] rollback failed:", err);
  }
}

// ── Helper: write to PayoutLogs collection for audit + admin debugging
async function logAttempt(uid, payload) {
  try {
    await db.collection("PayoutLogs").add({
      uid,
      ...payload,
      at: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn("[processWithdrawal] logAttempt failed:", err.message);
  }
}