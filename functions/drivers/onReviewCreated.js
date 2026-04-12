const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

if (!getApps().length) initializeApp();
const db = getFirestore();

exports.onReviewCreated = onDocumentCreated(
  {
    document: "Reviews/{reviewId}",
    region: "us-central1",
  },
  async (event) => {
    const review = event.data.data();

    if (!review || !review.driverUid || !review.rating) {
      console.log("❌ Invalid review data");
      return;
    }

    const driverRef = db.collection("Drivers").doc(review.driverUid);

    await db.runTransaction(async (tx) => {
      const driverSnap = await tx.get(driverRef);

      let totalReviews = 0;
      let ratingSum = 0;

      if (driverSnap.exists) {
        const data = driverSnap.data();
        totalReviews = data.totalReviews || 0;
        ratingSum = data.ratingSum || 0;
      }

      totalReviews += 1;
      ratingSum += review.rating;

      const averageRating = ratingSum / totalReviews;

      tx.set(
        driverRef,
        {
          totalReviews,
          ratingSum,
          averageRating: Number(averageRating.toFixed(2)),
          lastReviewAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    console.log(`✅ Updated driver ${review.driverUid} stats`);
  }
);