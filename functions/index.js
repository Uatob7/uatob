const admin = require("firebase-admin");

admin.initializeApp();

// Core presence
const { dispatch } = require("./core/dispatch");
















// Admin presence
const { autoApprovePendingDrivers } = require("./admin/autoApprovePendingDrivers");


// Ride presence
const { refreshRidePolylines } = require("./ride/refreshRidePolylines");
const { onRideStatusChangedRefreshPolylines } = require("./ride/onRideStatusChangedRefreshPolylines");
const { rideStatusNotifier } = require("./ride/rideStatusNotifier");






// Promo scheduler
const { promoScheduler } = require("./promo/promoScheduler");

exports.dispatch = dispatch;




exports.refreshRidePolylines = refreshRidePolylines;
exports.onRideStatusChangedRefreshPolylines =
  onRideStatusChangedRefreshPolylines;
exports.rideStatusNotifier = rideStatusNotifier;
exports.promoScheduler = promoScheduler;

exports.autoApprovePendingDrivers = autoApprovePendingDrivers;