const admin = require("firebase-admin");

admin.initializeApp();

// Account presence
const { dispatch } = require("./accounts/dispatch");

// Ride presence
const { refreshRidePolylines } = require("./rides/refreshRidePolylines");
const { onRideStatusChangedRefreshPolylines } = require("./rides/onRideStatusChangedRefreshPolylines");
// Feed
const { feedNotifier } = require("./feed/feedNotifier");

// Promo scheduler
const { promoScheduler } = require("./promo/promoScheduler");

exports.dispatch = dispatch;
exports.refreshRidePolylines = refreshRidePolylines;
exports.onRideStatusChangedRefreshPolylines =
  onRideStatusChangedRefreshPolylines;
exports.feedNotifier = feedNotifier;
exports.promoScheduler = promoScheduler;