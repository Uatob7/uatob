const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

exports.createDriverProfile = onCall(
  { region: "us-central1" },
  async (request) => {
    const {
      uid,
      accountData,
      contact,     // was: contactData
      vehicle,     // was: vehicleData
      documents,   // was: docData
      submit,
      currentStep,
    } = request.data;

    if (!uid) {
      throw new HttpsError("invalid-argument", "Missing uid");
    }

    const driverRef = db.collection("Drivers").doc(uid);

    // ── STEP 1 ──────────────────────────────────────────────────────────
    if (
      accountData &&
      !contact &&    // was: !contactData
      !vehicle &&    // was: !vehicleData
      !documents &&  // was: !docData
      !submit &&
      (!currentStep || currentStep === 1)
    ) {
      const { firstName, lastName, email } = accountData;

      if (!firstName || !lastName || !email) {
        throw new HttpsError("invalid-argument", "Missing required account fields");
      }

      const snap = await driverRef.get();
      const now  = FieldValue.serverTimestamp();

      if (!snap.exists) {
        await driverRef.set({
          uid,
          firstName,
          lastName,
          email,
          status:      "in_progress",
          currentStep: 1,
          createdAt:   now,
          updatedAt:   now,
        });
      } else {
        await driverRef.update({ firstName, lastName, email, updatedAt: now });
      }

      return { success: true, uid };
    }

    // ── STEP 2–5 ────────────────────────────────────────────────────────
    const snap = await driverRef.get();

    if (!snap.exists) {
      throw new HttpsError("not-found", "Complete step 1 first");
    }

    const now    = FieldValue.serverTimestamp();
    const update = { updatedAt: now };

    if (currentStep && currentStep > 1) {
      update.currentStep = currentStep;
    }

    if (submit) {
      update.status      = "pending";
      update.submittedAt = now;
    }

    if (accountData) {
      const { firstName, lastName, email } = accountData;
      if (firstName) update.firstName = firstName;
      if (lastName)  update.lastName  = lastName;
      if (email)     update.email     = email;
    }

    if (contact) {                                           // was: contactData
      const { phone, address, city, state, zip } = contact; // was: contactData
      if (!phone || !address || !city || !state || !zip) {
        throw new HttpsError("invalid-argument", "Missing contact fields");
      }
      update.contact = { phone, address, city, state, zip };
    }

    if (vehicle) {                                                        // was: vehicleData
      const { make, model, year, color, plate, vin, rideTypes } = vehicle; // was: vehicleData
      if (!model || !year || !color || !plate) {
        throw new HttpsError("invalid-argument", "Missing vehicle fields");
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

    if (documents) {               // was: docData
      update.documents = documents; // was: docData
    }

    await driverRef.update(update);

    return { success: true, uid, message: submit ? "Submitted" : "Saved" };
  }
);