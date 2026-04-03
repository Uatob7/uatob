// functions/index.js
const { onRequest } = require('firebase-functions/v2/https');
const cors = require('cors')({ origin: true });

exports.createAccount = onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { uid, email } = req.body;
    if (!uid || !email) return res.status(400).json({ error: 'uid and email are required' });

    // your logic here — e.g. create Firestore doc, send welcome email, etc.

    return res.status(200).json({ success: true });
  });
});