const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

exports.createDriverProfile = onRequest(
  {
    region: "us-central1",
    invoker: "public",
  },
  (req, res) => {
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

        // ── STEP 1: Create / update base profile ─────────────────────────────
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
              error:
                "Missing required account fields: firstName, lastName, email",
            });
          }

          const snap = await driverRef.get();

          if (!snap.exists) {
            await driverRef.set({
              uid,
              firstName,
              lastName,
              email,
              status: "in_progress",
              currentStep: 1,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.log(`✅ Driver profile created for UID: ${uid}`);
          } else {
            await driverRef.update({
              firstName,
              lastName,
              email,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.log(`✅ Driver profile refreshed for UID: ${uid}`);
          }

          return res.status(200).json({
            success: true,
            uid,
            message: "Driver profile created successfully",
          });
        }

        // ── STEP 2–5: Progress updates ───────────────────────────────────────
        const snap = await driverRef.get();

        if (!snap.exists) {
          return res.status(404).json({
            error: "Driver profile not found. Complete step 1 first.",
          });
        }

        const update = {
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (currentStep && currentStep > 1) {
          update.currentStep = currentStep;
        }

        if (submit) {
          update.status = "pending";
          update.submittedAt = admin.firestore.FieldValue.serverTimestamp();
        }

        if (accountData) {
          const { firstName, lastName, email } = accountData;
          if (firstName) update.firstName = firstName;
          if (lastName) update.lastName = lastName;
          if (email) update.email = email;
        }

        if (
          contactData &&
          (contactData.phone ||
            contactData.address ||
            contactData.city ||
            contactData.state ||
            contactData.zip)
        ) {
          const { phone, address, city, state, zip } = contactData;

          if (!phone || !address || !city || !state || !zip) {
            return res.status(400).json({
              error:
                "Missing required contact fields: phone, address, city, state, zip",
            });
          }

          update.contact = { phone, address, city, state, zip };
        }

        if (
          vehicleData &&
          (vehicleData.make ||
            vehicleData.model ||
            vehicleData.year ||
            vehicleData.color ||
            vehicleData.plate)
        ) {
          const { make, model, year, color, plate, vin, rideTypes } =
            vehicleData;

          if (!model || !year || !color || !plate) {
            return res.status(400).json({
              error:
                "Missing required vehicle fields: model, year, color, plate",
            });
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

        if (
          docData &&
          (docData.licenseFront ||
            docData.licenseBack ||
            docData.registration ||
            docData.insurance ||
            docData.profilePhoto)
        ) {
          const {
            licenseFront,
            licenseFrontUrl,
            licenseBack,
            licenseBackUrl,
            licenseNumber,
            registration,
            registrationUrl,
            insurance,
            insuranceUrl,
            profilePhoto,
            profilePhotoUrl,
          } = docData;

          update.documents = {
            licenseFront: licenseFront || false,
            licenseFrontUrl: licenseFrontUrl || null,
            licenseBack: licenseBack || false,
            licenseBackUrl: licenseBackUrl || null,
            licenseNumber: licenseNumber || null,
            registration: registration || false,
            registrationUrl: registrationUrl || null,
            insurance: insurance || false,
            insuranceUrl: insuranceUrl || null,
            profilePhoto: profilePhoto || false,
            profilePhotoUrl: profilePhotoUrl || null,
          };
        }

        await driverRef.update(update);

        console.log(
          `✅ Driver data updated for UID: ${uid} | submit=${!!submit} | step=${
            currentStep ?? "—"
          }`
        );

        return res.status(200).json({
          success: true,
          uid,
          message: submit
            ? "Application submitted successfully"
            : "Progress saved successfully",
        });
      } catch (err) {
        console.error("❌ Error in createDriverProfile:", err);
        return res.status(500).json({
          error: "Internal server error",
          details: err.message,
        });
      }
    });
  }
);