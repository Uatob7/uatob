const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });

exports.getTripButtonLabel = onRequest(async (req, res) => {
  cors(req, res, () => {
    try {
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ success: false, message: "Missing status" });
      }

      const labelMap = {
        driver_assigned: "Arrived at Pickup",
        arrived:         "Start Trip",
        in_progress:     "Complete Trip",
      };

      const label = labelMap[status];

      if (!label) {
        return res.status(404).json({ success: false, message: "No label for this status" });
      }

      return res.status(200).json({ success: true, label });
    } catch (err) {
      console.error("[getTripButtonLabel]", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });
});