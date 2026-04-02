const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const admin = require("firebase-admin");

const db = admin.firestore();

exports.createDriverProfile = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // ── Only allow POST ──────────────────────────
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const { uid, accountData, contactData, vehicleData, docData } = req.body || {};

      // uid is required for both calls
      if (!uid) {
        return res.status(400).json({ error: "Missing uid" });
      }

      // ── CALL 1: Step 1 — create initial driver profile ──
      if (accountData) {
        const { firstName, lastName, email } = accountData;

        if (!firstName || !lastName || !email) {
          return res.status(400).json({ error: "Missing required account fields: firstName, lastName, email" });
        }

        await db.collection("Drivers").doc(uid).set({
          uid,
          firstName,
          lastName,
          email,
          status:    "pending",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`✅ Driver profile created for UID: ${uid}`);

        return res.status(200).json({
          success: true,
          uid,
          message: "Driver profile created successfully",
        });
      }

      // ── CALL 2: Step 5 — save contact, vehicle & doc data ──
      if (contactData || vehicleData || docData) {
        // Make sure the driver doc already exists before updating
        const driverRef = db.collection("Drivers").doc(uid);
        const driverSnap = await driverRef.get();

        if (!driverSnap.exists) {
          return res.status(404).json({ error: "Driver profile not found. Complete step 1 first." });
        }

        const update = {
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (contactData) {
          const { phone, address, city, state, zip } = contactData;
          if (!phone || !address || !city || !state || !zip) {
            return res.status(400).json({ error: "Missing required contact fields" });
          }
          update.contact = { phone, address, city, state, zip };
        }

        if (vehicleData) {
          const { make, model, year, color, plate, vin, rideTypes } = vehicleData;
          if (!model || !year || !color || !plate) {
            return res.status(400).json({ error: "Missing required vehicle fields" });
          }
          update.vehicle = { make, model, year, color, plate, vin: vin || null, rideTypes: rideTypes || [] };
        }

        if (docData) {
          const { licenseFront, licenseBack, licenseNumber, registration, insurance, profilePhoto } = docData;
          update.documents = {
            licenseFront:  licenseFront  || false,
            licenseBack:   licenseBack   || false,
            licenseNumber: licenseNumber || null,
            registration:  registration  || false,
            insurance:     insurance     || false,
            profilePhoto:  profilePhoto  || false,
          };
        }

        await driverRef.update(update);

        console.log(`✅ Driver data updated for UID: ${uid}`);

        return res.status(200).json({
          success: true,
          uid,
          message: "Driver data submitted successfully",
        });
      }

      // ── Neither accountData nor contactData/vehicleData/docData sent ──
      return res.status(400).json({
        error: "Missing data. Send accountData for step 1, or contactData/vehicleData/docData for step 5.",
      });

    } catch (err) {
      console.error("❌ Error in createDriverProfile:", err);
      return res.status(500).json({
        error: "Internal server error",
        details: err.message,
      });
    }
  });
});
