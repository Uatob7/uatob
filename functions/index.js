const admin = require("firebase-admin");

admin.initializeApp();

// Account presence
const { dispatch }        = require("./accounts/dispatch");

// Feed presence
const { feedNotifier }    = require("./feed/feedNotifier");

// Promo scheduler
const { promoScheduler }  = require("./promo/promoScheduler");

exports.dispatch       = dispatch;
exports.feedNotifier   = feedNotifier;
exports.promoScheduler = promoScheduler;