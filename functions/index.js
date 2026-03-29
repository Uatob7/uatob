const admin = require("firebase-admin");
admin.initializeApp();

// Ride function
const { ATOB } = require("./ride/ATOB");
const { Price } = require("./ride/Price"); 
const { Autocomplete } = require("./ride/Autocomplete"); 
// Payment functions
const { cardPayment } = require("./payments/cardPayment");
const { cashAppPayment } = require("./payments/cashAppPayment");

// Exports
exports.ATOB = ATOB;
exports.Autocomplete = Autocomplete;
exports.Price = Price;
exports.cardPayment = cardPayment;
exports.cashAppPayment = cashAppPayment;