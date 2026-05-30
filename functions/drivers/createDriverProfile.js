const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

exports.createDriverProfile = onCall(
  {
    region: "us-east1",
    invoker: "public",
  },
  async (request) => {
    const {
      uid,
      accountData,
      contact,
      vehicle,
      documents,
      submit,
      currentStep,
    } = request.data;

    if (!uid) {
      throw new HttpsError("invalid-argument", "Missing uid");
    }

    const driverRef = db.collection("Drivers").doc(uid);

    // STEP 1
    if (
      accountData &&
      !contact &&
      !vehicle &&
      !documents &&
      !submit &&
      (!currentStep || currentStep === 1)
    ) {
      const { firstName, lastName, email } = accountData;

      if (!firstName || !lastName || !email) {
        throw new HttpsError(
          "invalid-argument",
          "Missing required account fields"
        );
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

      return { success: true, uid };
    }

    // STEP 2–5
    const snap = await driverRef.get();

    if (!snap.exists) {
      throw new HttpsError("not-found", "Complete step 1 first");
    }

    const now = FieldValue.serverTimestamp();
    const update = { updatedAt: now };

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

    if (contact) {
      const { phone, address, city, state, zip } = contact;

      if (!phone || !address || !city || !state || !zip) {
        throw new HttpsError(
          "invalid-argument",
          "Missing contact fields"
        );
      }

      update.contact = {
        phone,
        address,
        city,
        state,
        zip,
      };
    }

    if (vehicle) {
      const {
        make,
        model,
        year,
        color,
        plate,
        vin,
        rideTypes,
      } = vehicle;

      if (!model || !year || !color || !plate) {
        throw new HttpsError(
          "invalid-argument",
          "Missing vehicle fields"
        );
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

    if (documents) {
      update.documents = documents;
    }

    await driverRef.update(update);

    return {
      success: true,
      uid,
      message: submit ? "Submitted" : "Saved",
    };
  }
);