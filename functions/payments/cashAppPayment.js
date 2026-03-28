const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });

// Cash App Payment Endpoint
exports.cashAppPayment = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const { fareData } = req.body;

      if (!fareData?.total) {
        return res.status(400).json({ success: false, message: "Missing fare data" });
      }

      // Simulate Cash App payment
      // TODO: Integrate Cash App API if needed
      const rideId = Math.floor(Math.random() * 1000000);

      res.json({ success: true, rideId, message: "Cash App payment initiated" });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
});