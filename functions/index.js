const admin = require("firebase-admin");
admin.initializeApp();

// Ride function
const { createAccount } = require("./ride/createAccount");
const { ATOB } = require("./ride/ATOB");
const { Price } = require("./ride/Price"); 
const { Autocomplete } = require("./ride/Autocomplete"); 
const { Geo } = require("./ride/Geo"); 
const { onAccountCreated } = require("./ride/email/onAccountCreated");
const { riderLocation } = require("./ride/riderLocation.JS");
const { cancelRide } = require("./ride/cancelRide");
const { extendRideSearch } = require("./ride/extendRideSearch");
const { rideTimeoutChecker } = require("./ride/rideTimeoutChecker");
const { findDrivers } = require("./ride/findDrivers");

// Payment functions
const { cardPayment } = require("./payments/cardPayment");
const { cashAppPayment } = require("./payments/cashAppPayment");
const { cardChecker } = require("./payments/cardChecker");
const { setupDeposit } = require("./payments/setupDeposit");

// driver functions
const { createDriverProfile } = require("./drivers/createDriverProfile");
const { checkDriverDeposit } = require("./drivers/checkDriverDeposit");
const { DriverStatus } = require("./drivers/DriverStatus");
const { acceptRide } = require("./drivers/acceptRide");
const { declineRide } = require("./drivers/declineRide");
const { updateTripStatus } = require("./drivers/updateTripStatus");
const { getTripButtonLabel } = require("./drivers/getTripButtonLabel");
const { getDriverEarnings } = require("./drivers/getDriverEarnings");
const { calcDriverDistance } = require("./drivers/calcDriverDistance");
const { getDriverToPickup } = require("./drivers/getDriverToPickup");
const { onDriverCreated } = require("./drivers/email/onDriverCreated");
const { onDriverApplicationSubmitted } = require("./drivers/email/onDriverApplicationSubmitted");
const { ApplicationApproved } = require("./drivers/email/ApplicationApproved");
const { withdraw } = require("./drivers/withdraw");
const { processWithdrawal } = require("./drivers/processWithdrawal");
const { updateDriverPresence } = require("./drivers/updateDriverPresence");
const { setDriverTripActive } = require("./drivers/setDriverTripActive");
const { onReviewCreated } = require("./drivers/onReviewCreated");
const { updateDriverAchievements } = require("./drivers/updateDriverAchievements");
const { checkDriverStripeCapability } = require("./drivers/checkDriverStripeCapability");



const { emailCandidateDrivers } = require("./drivers/email/emailCandidateDrivers");



// Admin functions
const { onAccountCreatedNotifyAdmin } = require("./admin/email/onAccountCreatedNotifyAdmin");
const { onDriverCreatedNotifyAdmin } = require("./admin/email/onDriverCreatedNotifyAdmin");
const { onRideCreatedNotifyAdmin } = require("./admin/email/onRideCreatedNotifyAdmin");
const { onDriverStatusChanged } = require("./admin/email/onDriverStatusChanged");



// Exports
exports.createAccount = createAccount;
exports.onAccountCreated = onAccountCreated;
exports.ATOB = ATOB;
exports.findDrivers = findDrivers;
exports.riderLocation = riderLocation;
exports.Autocomplete = Autocomplete;
exports.Price = Price;
exports.cancelRide = cancelRide;
exports.extendRideSearch = extendRideSearch;
exports.Geo = Geo;
exports.cardPayment = cardPayment;
exports.checkDriverDeposit = checkDriverDeposit;
exports.cashAppPayment = cashAppPayment;
exports.setupDeposit = setupDeposit;
exports.acceptRide = acceptRide;
exports.rideTimeoutChecker = rideTimeoutChecker;
exports.declineRide = declineRide;
exports.updateTripStatus = updateTripStatus;
exports.getTripButtonLabel = getTripButtonLabel;
exports.createDriverProfile = createDriverProfile;
exports.DriverStatus = DriverStatus;
exports.getDriverEarnings = getDriverEarnings;
exports.calcDriverDistance = calcDriverDistance;
exports.getDriverToPickup = getDriverToPickup;
exports.updateDriverPresence = updateDriverPresence;
exports.setDriverTripActive = setDriverTripActive;
exports.cardChecker = cardChecker;
exports.onDriverCreated = onDriverCreated;
exports.updateDriverAchievements = updateDriverAchievements;
exports.onDriverApplicationSubmitted = onDriverApplicationSubmitted;
exports.withdraw = withdraw;

exports.processWithdrawal = processWithdrawal;
exports.onReviewCreated = onReviewCreated;
exports.onDriverStatusChanged = onDriverStatusChanged;
exports.checkDriverStripeCapability = checkDriverStripeCapability;

exports.onAccountCreatedNotifyAdmin = onAccountCreatedNotifyAdmin;
exports.onDriverCreatedNotifyAdmin = onDriverCreatedNotifyAdmin;
exports.onRideCreatedNotifyAdmin = onRideCreatedNotifyAdmin;
exports.ApplicationApproved = ApplicationApproved;
exports.emailCandidateDrivers = emailCandidateDrivers;