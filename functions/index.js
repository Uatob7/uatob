const admin = require("firebase-admin");
admin.initializeApp();

// Ride function
const { ATOB } = require("./ride/ATOB");
const { priceQuote } = require("./ride/priceQuote"); 
// Payment functions
const { cardPayment } = require("./payments/cardPayment");
const { cashAppPayment } = require("./payments/cashAppPayment");

// Exports
exports.ATOB = ATOB;
exports.priceQuote = priceQuote;
exports.cardPayment = cardPayment;
exports.cashAppPayment = cashAppPayment;