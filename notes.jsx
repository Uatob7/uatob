const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')('sk_test_XXXXXXXXXXXXXXXX'); // Replace with your Stripe secret key

admin.initializeApp();
const db = admin.firestore();

// ----------------------------
// Card Payment Endpoint
// ----------------------------
exports.processCardPayment = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(400).send({ success: false, message: 'POST only' });

    const { fareData, paymentMethodId } = req.body;
    if (!fareData || !paymentMethodId) return res.status(400).send({ success: false, message: 'Missing data' });

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(fareData.total * 100), // cents
      currency: 'usd',
      payment_method: paymentMethodId,
      confirm: true,
    });

    // Create ride document
    const rideRef = db.collection('rides').doc();
    await rideRef.set({
      fareData,
      paymentMethod: 'card',
      status: 'searching_driver',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.send({ success: true, rideId: rideRef.id });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: err.message });
  }
});

// ----------------------------
// Cash App Payment Endpoint
// ----------------------------
exports.processCashAppPayment = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(400).send({ success: false, message: 'POST only' });

    const { fareData } = req.body;
    if (!fareData) return res.status(400).send({ success: false, message: 'Missing fareData' });

    // Simulate Cash App payment (replace with real Cash App API if available)
    const paymentSuccess = true; 
    if (!paymentSuccess) return res.status(402).send({ success: false, message: 'Payment failed' });

    // Create ride document
    const rideRef = db.collection('rides').doc();
    await rideRef.set({
      fareData,
      paymentMethod: 'cash',
      status: 'searching_driver',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.send({ success: true, rideId: rideRef.id });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: err.message });
  }
});