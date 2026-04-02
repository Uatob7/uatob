const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const admin = require("firebase-admin");



const db = admin.firestore();

exports.createDriverProfile = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // ✅ Only allow POST
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const { uid, accountData } = req.body || {};

      // ✅ Strong validation
      if (!uid || !accountData) {
        return res.status(400).json({ error: "Missing uid or accountData" });
      }

      const { firstName, lastName, email } = accountData;

      if (!firstName || !lastName || !email) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // ✅ Use Firestore server timestamp (better than new Date())
      await db.collection("Drivers").doc(uid).set({
        uid,
        firstName,
        lastName,
        email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "pending", // pending | approved | rejected
      });

      console.log(`Driver profile created for UID: ${uid}`);

      return res.status(200).json({
        success: true,
        uid,
        message: "Driver profile created successfully",
      });

    } catch (err) {
      console.error("Error creating driver profile:", err);
      return res.status(500).json({
        error: "Internal server error",
        details: err.message,
      });
    }
  });
});