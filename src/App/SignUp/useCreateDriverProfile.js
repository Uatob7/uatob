// src/App/SignUp/useCreateDriverProfile.js
import { useCallback } from 'react';
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

export function useCreateDriverProfile() {

  // ── Step 1: create or update the profile doc ──────────────────────
  const createDriverProfile = useCallback(async (uid, accountData) => {
    const { firstName, lastName, email } = accountData;
    if (!firstName || !lastName || !email) throw new Error('Missing required account fields');

    const driverRef = doc(db, 'Drivers', uid);
    const snap      = await getDoc(driverRef);
    const now       = serverTimestamp();

    if (!snap.exists()) {
      await setDoc(driverRef, {
        uid,
        firstName,
        lastName,
        email,
        status:      'in_progress',
        currentStep: 1,
        createdAt:   now,
        updatedAt:   now,
      });
    } else {
      await updateDoc(driverRef, { firstName, lastName, email, updatedAt: now });
    }

    return { success: true, uid };
  }, []);

  // ── Steps 2–4: save partial progress ─────────────────────────────
  const saveProgress = useCallback(async ({
    uid,
    currentStep,
    accountData,
    contactData,
    vehicleData,
    docData,
  }) => {
    if (!uid) return;
    try {
      const driverRef = doc(db, 'Drivers', uid);
      const snap      = await getDoc(driverRef);
      if (!snap.exists()) throw new Error('Complete step 1 first');

      const update = { updatedAt: serverTimestamp() };

      if (currentStep && currentStep > 1) update.currentStep = currentStep;

      if (accountData) {
        const { firstName, lastName, email } = accountData;
        if (firstName) update.firstName = firstName;
        if (lastName)  update.lastName  = lastName;
        if (email)     update.email     = email;
      }

      // Only write contact when all required fields are present
      if (
        contactData?.phone   &&
        contactData?.address &&
        contactData?.city    &&
        contactData?.state   &&
        contactData?.zip
      ) {
        update.contact = {
          phone:   contactData.phone,
          address: contactData.address,
          city:    contactData.city,
          state:   contactData.state,
          zip:     contactData.zip,
        };
      }

      // Only write vehicle when all required fields are present
      if (
        vehicleData?.model &&
        vehicleData?.year  &&
        vehicleData?.color &&
        vehicleData?.plate
      ) {
        update.vehicle = {
          make:      vehicleData.make      || null,
          model:     vehicleData.model,
          year:      vehicleData.year,
          color:     vehicleData.color,
          plate:     vehicleData.plate,
          vin:       vehicleData.vin       || null,
          rideTypes: vehicleData.rideTypes || [],
        };
      }

      if (docData) update.documents = docData;

      await updateDoc(driverRef, update);
    } catch (err) {
      console.warn('⚠️ saveProgress failed silently:', err.message);
    }
  }, []);

  // ── Step 5: final submission ──────────────────────────────────────
  const submitDriverData = useCallback(async (uid, { contactData, vehicleData, docData }) => {
    if (!uid) throw new Error('Missing user ID');

    const driverRef = doc(db, 'Drivers', uid);
    const snap      = await getDoc(driverRef);
    if (!snap.exists()) throw new Error('Complete step 1 first');

    const { phone, address, city, state, zip } = contactData;
    if (!phone || !address || !city || !state || !zip) throw new Error('Missing contact fields');

    const { model, year, color, plate } = vehicleData;
    if (!model || !year || !color || !plate) throw new Error('Missing vehicle fields');

    await updateDoc(driverRef, {
      status:      'pending',
      submittedAt: serverTimestamp(),
      updatedAt:   serverTimestamp(),
      contact: {
        phone,
        address,
        city,
        state,
        zip,
      },
      vehicle: {
        make:      vehicleData.make      || null,
        model,
        year,
        color,
        plate,
        vin:       vehicleData.vin       || null,
        rideTypes: vehicleData.rideTypes || [],
      },
      documents: {
        licenseFront:    docData.licenseFront    || false,
        licenseFrontUrl: docData.licenseFrontUrl || '',
        licenseBack:     docData.licenseBack     || false,
        licenseBackUrl:  docData.licenseBackUrl  || '',
        licenseNumber:   docData.licenseNumber   || '',
        registration:    docData.registration    || false,
        registrationUrl: docData.registrationUrl || '',
        insurance:       docData.insurance       || false,
        insuranceUrl:    docData.insuranceUrl    || '',
        profilePhoto:    docData.profilePhoto    || false,
        profilePhotoUrl: docData.profilePhotoUrl || '',
      },
    });

    return { success: true, uid, message: 'Submitted' };
  }, []);

  return { createDriverProfile, saveProgress, submitDriverData };
}