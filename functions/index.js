const admin = require("firebase-admin");

admin.initializeApp();

// Admin presence
const { autoApprovePendingDrivers } = require("./admin/autoApprovePendingDrivers");

// Account presence
const { dispatch } = require("./accounts/dispatch");

// Ride presence
const { refreshRidePolylines } = require("./ride/refreshRidePolylines");
const { onRideStatusChangedRefreshPolylines } = require("./ride/onRideStatusChangedRefreshPolylines");
const { autoRefundTimeoutRides } = require("./ride/autoRefundTimeoutRides");
const { rideStatusNotifier } = require("./ride/rideStatusNotifier");


const { notifyMatchedDriversByEmail } = require("./ride/email/notifyMatchedDriversByEmail");


// Feed
const { feedNotifier } = require("./feed/feedNotifier");

// Promo scheduler
const { promoScheduler } = require("./promo/promoScheduler");

exports.dispatch = dispatch;
exports.refreshRidePolylines = refreshRidePolylines;
exports.onRideStatusChangedRefreshPolylines =
  onRideStatusChangedRefreshPolylines;
exports.autoRefundTimeoutRides = autoRefundTimeoutRides;
exports.rideStatusNotifier = rideStatusNotifier;
exports.feedNotifier = feedNotifier;
exports.promoScheduler = promoScheduler;
exports.notifyMatchedDriversByEmail = notifyMatchedDriversByEmail;

exports.autoApprovePendingDrivers = autoApprovePendingDrivers;