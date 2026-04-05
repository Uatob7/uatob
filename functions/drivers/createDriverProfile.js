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

      const {
        uid,
        accountData,
        contactData,
        vehicleData,
        docData,
        submit,
        currentStep,
      } = req.body || {};

      // uid is required for all calls
      if (!uid) {
        return res.status(400).json({ error: "Missing uid" });
      }

      // ── CALL 1: Step 1 — create initial driver profile ──────────────────
      if (accountData) {
        const { firstName, lastName, email } = accountData;

        if (!firstName || !lastName || !email) {
          return res.status(400).json({
            error: "Missing required account fields: firstName, lastName, email",
          });
        }

        await db.collection("Drivers").doc(uid).set({
          uid,
          firstName,
          lastName,
          email,
          status:      "in_progress",
          currentStep: 1,
          createdAt:   admin.firestore.FieldValue.serverTimestamp(),
          updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`✅ Driver profile created for UID: ${uid}`);

        return res.status(200).json({
          success: true,
          uid,
          message: "Driver profile created successfully",
        });
      }

      // ── CALL 2: Progress saves (Steps 2–4) & final submit (Step 5) ──────
      if (contactData || vehicleData || docData || currentStep || submit) {
        const driverRef  = db.collection("Drivers").doc(uid);
        const driverSnap = await driverRef.get();

        if (!driverSnap.exists) {
          return res.status(404).json({
            error: "Driver profile not found. Complete step 1 first.",
          });
        }

        const update = {
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // Track which step the driver is on
        if (currentStep) {
          update.currentStep = currentStep;
        }

        // Mark as pending when the driver hits Submit
        if (submit) {
          update.status = "pending";
          update.submittedAt = admin.firestore.FieldValue.serverTimestamp();
        }

        // ── Contact data (Step 2) ──
        if (contactData) {
          const { phone, address, city, state, zip } = contactData;

          if (!phone || !address || !city || !state || !zip) {
            return res.status(400).json({
              error: "Missing required contact fields: phone, address, city, state, zip",
            });
          }

          update.contact = { phone, address, city, state, zip };
        }

        // ── Vehicle data (Step 3) ──
        if (vehicleData) {
          const { make, model, year, color, plate, vin, rideTypes } = vehicleData;

          if (!model || !year || !color || !plate) {
            return res.status(400).json({
              error: "Missing required vehicle fields: model, year, color, plate",
            });
          }

          update.vehicle = {
            make:      make      || null,
            model,
            year,
            color,
            plate,
            vin:       vin       || null,
            rideTypes: rideTypes || [],
          };
        }

        // ── Document data (Step 4) — booleans + Firebase Storage URLs ──
        if (docData) {
          const {
            licenseFront,    licenseFrontUrl,
            licenseBack,     licenseBackUrl,
            licenseNumber,
            registration,    registrationUrl,
            insurance,       insuranceUrl,
            profilePhoto,    profilePhotoUrl,
          } = docData;

          update.documents = {
            licenseFront:    licenseFront    || false,
            licenseFrontUrl: licenseFrontUrl || null,

            licenseBack:     licenseBack     || false,
            licenseBackUrl:  licenseBackUrl  || null,

            licenseNumber:   licenseNumber   || null,

            registration:    registration    || false,
            registrationUrl: registrationUrl || null,

            insurance:       insurance       || false,
            insuranceUrl:    insuranceUrl    || null,

            profilePhoto:    profilePhoto    || false,
            profilePhotoUrl: profilePhotoUrl || null,
          };
        }

        await driverRef.update(update);

        console.log(`✅ Driver data updated for UID: ${uid} | submit=${!!submit} | step=${currentStep ?? "—"}`);

        return res.status(200).json({
          success: true,
          uid,
          message: submit
            ? "Application submitted successfully"
            : "Progress saved successfully",
        });
      }

      // ── Nothing useful was sent ──────────────────────────────────────────
      return res.status(400).json({
        error:
          "Missing data. Send accountData for step 1, or any of contactData / vehicleData / docData / currentStep / submit for subsequent steps.",
      });

    } catch (err) {
      console.error("❌ Error in createDriverProfile:", err);
      return res.status(500).json({
        error:   "Internal server error",
        details: err.message,
      });
    }
  });
});
