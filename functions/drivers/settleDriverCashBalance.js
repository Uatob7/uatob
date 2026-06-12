// functions/drivers/settleDriverCashBalance.js
//
// Callable — pays the driver what the platform owes them from card/cashapp
// rides (platformOwes), minus any cash debt they owe us (cashOwed).
// Net positive → stripe.transfers.create() to driver's accountId.
// Follows the same atomic-lock → pre-flight → idempotency → Stripe →
// Firestore batch → rollback → audit pattern as processWithdrawal.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret }       = require("firebase-functions/params");
const admin                  = require("firebase-admin");
const Stripe                 = require("stripe");
const crypto                 = require("crypto");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");

// ── Helpers ──────────────────────────────────────────────────────────────────
async function logAttempt(driverUid, payload) {
  try {
    await db.collection("SettlementLogs").add({
      driverUid,
      ...payload,
      at: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn("[settleDriverCashBalance] logAttempt failed:", err.message);
  }
}

async function rollbackLock(balRef, driverRef, reason) {
  try {
    const now = admin.firestore.Timestamp.now();
    await Promise.all([
      balRef.update({
        "settlement.status":      "pending",
        "settlement.lockedAt":    admin.firestore.FieldValue.delete(),
        "settlement.lastError":   reason,
        "settlement.lastErrorAt": now,
        "settlement.updatedAt":   now,
      }),
      driverRef.update({
        "cashBalance.settlementStatus": "pending",
        "cashBalance.updatedAt":        now,
      }),
    ]);
  } catch (err) {
    console.error("[settleDriverCashBalance] rollback failed:", err.message);
  }
}

exports.settleDriverCashBalance = onCall(
  { region: "us-east1", secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    const { driverUid } = request.data ?? {};
    if (!driverUid) throw new HttpsError("invalid-argument", "Missing driverUid");

    const stripe    = new Stripe(process.env.STRIPE_SECRET_KEY);
    const balRef    = db.collection("DriverBalance").doc(driverUid);
    const driverRef = db.collection("Drivers").doc(driverUid);

    // ── (1) ATOMIC LOCK via transaction ──────────────────────────────────────
    let locked;
    try {
      locked = await db.runTransaction(async (tx) => {
        const [balSnap, driverSnap] = await Promise.all([
          tx.get(balRef),
          tx.get(driverRef),
        ]);

        if (!balSnap.exists) {
          throw new HttpsError("not-found", "No balance record for this driver");
        }
        if (!driverSnap.exists) {
          throw new HttpsError("not-found", "Driver not found");
        }

        const bal    = balSnap.data();
        const driver = driverSnap.data();

        const platformOwes = Number(bal.platformOwes ?? 0);
        const cashOwed     = Number(bal.cashOwed     ?? 0);
        const netPayout    = platformOwes - cashOwed;    // what we actually transfer
        const accountId    = driver.accountId ?? null;

        if (platformOwes <= 0) {
          throw new HttpsError("failed-precondition", "No pending payout to settle");
        }
        if (!accountId) {
          throw new HttpsError("failed-precondition", "Driver has no Stripe account");
        }

        const currentStatus = bal.settlement?.status;
        if (currentStatus === "processing") {
          throw new HttpsError("failed-precondition", "Settlement already in progress");
        }

        // Lock
        const now = admin.firestore.Timestamp.now();
        tx.update(balRef, {
          "settlement.status":    "processing",
          "settlement.lockedAt":  now,
          "settlement.updatedAt": now,
        });
        tx.update(driverRef, {
          "cashBalance.settlementStatus": "processing",
          "cashBalance.updatedAt":        now,
        });

        return { platformOwes, cashOwed, netPayout, accountId };
      });
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error("[settleDriverCashBalance] lock txn failed:", err);
      throw new HttpsError("internal", "Failed to lock settlement");
    }

    const { platformOwes, cashOwed, netPayout, accountId } = locked;
    const transferCents = Math.max(0, Math.round(netPayout * 100));

    // ── (2) PRE-FLIGHT: verify connected account can receive transfers ────────
    try {
      const account = await stripe.accounts.retrieve(accountId);
      if (!account.capabilities?.transfers || account.capabilities.transfers !== "active") {
        await rollbackLock(balRef, driverRef, "transfers_capability_inactive");
        throw new HttpsError("failed-precondition", "Driver's Stripe account cannot receive transfers yet");
      }
      if (account.requirements?.disabled_reason) {
        await rollbackLock(balRef, driverRef, `account_disabled_${account.requirements.disabled_reason}`);
        throw new HttpsError("failed-precondition", `Driver's Stripe account is disabled: ${account.requirements.disabled_reason}`);
      }
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      await rollbackLock(balRef, driverRef, "account_retrieval_failed");
      throw new HttpsError("internal", "Could not verify driver Stripe account");
    }

    // ── (3) PRE-FLIGHT: check platform balance ────────────────────────────────
    try {
      const balance   = await stripe.balance.retrieve();
      const available = (balance.available ?? [])
        .filter(b => b.currency === "usd")
        .reduce((sum, b) => sum + b.amount, 0);

      if (available < transferCents) {
        await rollbackLock(balRef, driverRef, "insufficient_platform_balance");
        throw new HttpsError(
          "failed-precondition",
          `Insufficient platform balance: $${(available / 100).toFixed(2)} available, $${(transferCents / 100).toFixed(2)} needed`
        );
      }
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.warn("[settleDriverCashBalance] balance check failed:", err.message);
    }

    // ── (4) IDEMPOTENCY KEY ───────────────────────────────────────────────────
    const idempotencyKey = crypto
      .createHash("sha256")
      .update(`settle:${driverUid}:${transferCents}:${Date.now()}`)
      .digest("hex")
      .slice(0, 64);

    // ── (5) STRIPE TRANSFER ───────────────────────────────────────────────────
    let transfer = null;

    if (transferCents > 0) {
      try {
        transfer = await stripe.transfers.create(
          {
            amount:      transferCents,
            currency:    "usd",
            destination: accountId,
            description: `UaTob driver settlement — $${(platformOwes).toFixed(2)} earned, $${cashOwed.toFixed(2)} cash offset`,
            metadata: {
              driverUid,
              platformOwes: String(platformOwes),
              cashOwed:     String(cashOwed),
              netPayout:    String(netPayout),
              createdBy:    "settleDriverCashBalance",
            },
          },
          { idempotencyKey }
        );
      } catch (err) {
        await rollbackLock(balRef, driverRef, `stripe_${err.code ?? "unknown"}`);
        await logAttempt(driverUid, {
          success: false,
          reason: "stripe_transfer_failed",
          stripeCode: err.code,
          stripeMessage: err.message,
          platformOwes, cashOwed, netPayout,
        });
        console.error("[settleDriverCashBalance] Stripe transfer failed:", err.message);

        if (err.code === "balance_insufficient") {
          throw new HttpsError("failed-precondition", "Platform has insufficient available balance");
        }
        if (err.code === "account_invalid") {
          throw new HttpsError("failed-precondition", "Driver Stripe account is invalid");
        }
        throw new HttpsError("internal", err.message ?? "Stripe transfer failed");
      }

      console.log(`[settleDriverCashBalance] transfer=${transfer.id} net=$${netPayout} driver=${driverUid}`);
    } else {
      // Net is 0 or negative — driver owes us more than we owe them.
      // Still settle the books (zero out platformOwes, reduce cashOwed).
      console.log(`[settleDriverCashBalance] net=$${netPayout} — no transfer needed, settling books only`);
    }

    // ── (6) FIRESTORE BATCH ───────────────────────────────────────────────────
    const now   = admin.firestore.Timestamp.now();
    const batch = db.batch();

    const remainingCashOwed = Math.max(0, cashOwed - platformOwes);

    batch.update(balRef, {
      platformOwes:                         0,
      platformOwesSettled:                  admin.firestore.FieldValue.increment(platformOwes),
      cashOwed:                             remainingCashOwed,
      cashSettledLifetime:                  admin.firestore.FieldValue.increment(Math.min(cashOwed, platformOwes)),
      lastSettledAt:                        now,
      "settlement.status":                  "paid",
      "settlement.paidAt":                  now,
      "settlement.updatedAt":               now,
      "settlement.transferId":              transfer?.id ?? null,
      "settlement.transferCents":           transferCents,
      "settlement.idempotencyKey":          idempotencyKey,
      "settlement.platformOwesAtSettle":    platformOwes,
      "settlement.cashOwedAtSettle":        cashOwed,
      updatedAt: now,
    });

    batch.update(driverRef, {
      "cashBalance.platformOwes":       0,
      "cashBalance.cashOwed":           remainingCashOwed,
      "cashBalance.lastSettledAt":      now,
      "cashBalance.settlementStatus":   transfer ? "paid" : "settled_no_transfer",
      "cashBalance.transferId":         transfer?.id ?? null,
      "cashBalance.updatedAt":          now,
    });

    const settlementRef = db.collection("DriverSettlements").doc();
    batch.set(settlementRef, {
      driverUid,
      platformOwes,
      cashOwed,
      netPayout,
      transferCents,
      transferId:      transfer?.id ?? null,
      accountId,
      idempotencyKey,
      method:          transfer ? "stripe_transfer" : "books_only",
      settledAt:       now,
      createdAt:       now,
    });

    try {
      await batch.commit();
    } catch (err) {
      if (transfer) {
        try {
          await stripe.transfers.createReversal(transfer.id, {
            metadata: { reason: "firestore_batch_failed", driverUid },
          });
          console.log(`[settleDriverCashBalance] transfer ${transfer.id} reversed`);
        } catch (revErr) {
          console.error("[settleDriverCashBalance] CRITICAL: reversal failed", {
            transferId: transfer.id, driverUid, err: revErr.message,
          });
          await logAttempt(driverUid, {
            success: false,
            reason: "CRITICAL_unreversed_transfer",
            transferId: transfer.id,
            platformOwes, cashOwed,
            batchError: err.message,
            reversalError: revErr.message,
          });
        }
      }
      await rollbackLock(balRef, driverRef, "firestore_batch_failed");
      throw new HttpsError("internal", "Transfer made but bookkeeping failed; reversal attempted");
    }

    // ── (7) AUDIT LOG ─────────────────────────────────────────────────────────
    await logAttempt(driverUid, {
      success: true,
      transferId: transfer?.id ?? null,
      platformOwes,
      cashOwed,
      netPayout,
      transferCents,
      idempotencyKey,
    });

    return {
      success:      true,
      platformOwes,
      cashOwed,
      netPayout,
      transferId:   transfer?.id ?? null,
      settledAt:    now.toDate().toISOString(),
    };
  }
);
