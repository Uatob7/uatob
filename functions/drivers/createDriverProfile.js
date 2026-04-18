const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });

const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

exports.createDriverProfile = onRequest(
  {
    region: "us-central1",
    invoker: "public",
  },
  (req, res) => {
    // ✅ Handle preflight FIRST
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      return res.status(204).send("");
    }

    cors(req, res, async () => {
      try {
        if (req.method !== "POST") {
          return res.status(405).json({ error: "Method not allowed" });
        }

        const {
          uid,
          accountData,
          contactData,
          vehicleData,
          docData,
          submit,
          currentStep,
        } = req.body || {};

        if (!uid) {
          return res.status(400).json({ error: "Missing uid" });
        }

        const driverRef = db.collection("Drivers").doc(uid);

        // ── STEP 1 ─────────────────────────────
        if (
          accountData &&
          !contactData &&
          !vehicleData &&
          !docData &&
          !submit &&
          (!currentStep || currentStep === 1)
        ) {
          const { firstName, lastName, email } = accountData;

          if (!firstName || !lastName || !email) {
            return res.status(400).json({
              error: "Missing required account fields",
            });
          }

          const snap = await driverRef.get();
          const now = FieldValue.serverTimestamp();

          if (!snap.exists) {
            await driverRef.set({
              uid,
              firstName,
              lastName,
              email,
              status: "in_progress",
              currentStep: 1,
              createdAt: now,
              updatedAt: now,
            });
          } else {
            await driverRef.update({
              firstName,
              lastName,
              email,
              updatedAt: now,
            });
          }

          return res.status(200).json({
            success: true,
            uid,
          });
        }

        // ── STEP 2–5 ───────────────────────────
        const snap = await driverRef.get();

        if (!snap.exists) {
          return res.status(404).json({
            error: "Complete step 1 first",
          });
        }

        const now = FieldValue.serverTimestamp();

        const update = {
          updatedAt: now,
        };

        if (currentStep && currentStep > 1) {
          update.currentStep = currentStep;
        }

        if (submit) {
          update.status = "pending";
          update.submittedAt = now;
        }

        if (accountData) {
          const { firstName, lastName, email } = accountData;
          if (firstName) update.firstName = firstName;
          if (lastName) update.lastName = lastName;
          if (email) update.email = email;
        }

        if (contactData) {
          const { phone, address, city, state, zip } = contactData;

          if (!phone || !address || !city || !state || !zip) {
            return res.status(400).json({ error: "Missing contact fields" });
          }

          update.contact = { phone, address, city, state, zip };
        }

        if (vehicleData) {
          const { make, model, year, color, plate, vin, rideTypes } =
            vehicleData;

          if (!model || !year || !color || !plate) {
            return res.status(400).json({ error: "Missing vehicle fields" });
          }

          update.vehicle = {
            make: make || null,
            model,
            year,
            color,
            plate,
            vin: vin || null,
            rideTypes: rideTypes || [],
          };
        }

        if (docData) {
          update.documents = docData;
        }

        await driverRef.update(update);

        return res.status(200).json({
          success: true,
          uid,
          message: submit ? "Submitted" : "Saved",
        });

      } catch (err) {
        console.error("❌ Error:", err);
        return res.status(500).json({
          error: err.message,
        });
      }
    });
  }
);