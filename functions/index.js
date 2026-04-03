const admin = require("firebase-admin");
admin.initializeApp();

// Ride function
const { ATOB } = require("./ride/ATOB");
const { Price } = require("./ride/Price"); 
const { Autocomplete } = require("./ride/Autocomplete"); 
const { Geo } = require("./ride/Geo"); 
// Payment functions
const { cardPayment } = require("./payments/cardPayment");
const { cashAppPayment } = require("./payments/cashAppPayment");

// driver functions
const { createDriverProfile } = require("./drivers/createDriverProfile");
const { setDriverStatus } = require("./drivers/setDriverStatus");
const { acceptRide } = require("./drivers/acceptRide");
const { declineRide } = require("./drivers/declineRide");
const { updateTripStatus } = require("./drivers/updateTripStatus");
const { getTripButtonLabel } = require("./drivers/getTripButtonLabel");
const { getDriverEarnings } = require("./drivers/getDriverEarnings");


// Exports
exports.ATOB = ATOB;
exports.Autocomplete = Autocomplete;
exports.Price = Price;
exports.Geo = Geo;
exports.cardPayment = cardPayment;
exports.cashAppPayment = cashAppPayment;
exports.acceptRide = acceptRide;
exports.declineRide = declineRide;
exports.updateTripStatus = updateTripStatus;
exports.getTripButtonLabel = getTripButtonLabel;
exports.createDriverProfile = createDriverProfile;
exports.setDriverStatus = setDriverStatus;
exports.getDriverEarnings = getDriverEarnings;