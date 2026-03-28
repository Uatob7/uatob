const admin = require("firebase-admin");
admin.initializeApp();

// Ride function
const { ATOB } = require("./ride/ATOB");

// Payment functions
const { cardPayment } = require("./payments/cardPayment");
const { cashAppPayment } = require("./payments/cashAppPayment");

// Exports
exports.ATOB = ATOB;
exports.cardPayment = cardPayment;
exports.cashAppPayment = cashAppPayment;