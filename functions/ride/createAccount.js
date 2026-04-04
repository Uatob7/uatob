const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const admin = require("firebase-admin");

const db = admin.firestore();

exports.createAccount = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // ── Only allow POST ──────────────────────────
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

   
        const { uid, email, name } = req.body ?? {};

        console.log(`[createAccount] Request received — UID: ${uid}, Email: ${email}, Name: ${name}`);

     

        const accountRef = db.collection("Accounts").doc(uid);

        // 🚀 Write account
        await accountRef.set(
          {
            uid,
            email,
            name: name ?? null,

            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        console.log(`[createAccount] Account saved — UID: ${uid}`);

        return res.status(200).json({
          success: true,
          uid,
        });

      } catch (err) {
        console.error("[createAccount] Error:", err);

        return res.status(500).json({
          error: "Internal server error",
          details: err.message,
        });
      }
    });
  }
);