const admin = require("firebase-admin");
admin.initializeApp();

// Ride function
const { createAccount } = require("./ride/createAccount");
const { ATOB } = require("./ride/ATOB");
const { Price } = require("./ride/Price"); 
const { Autocomplete } = require("./ride/Autocomplete"); 
const { Geo } = require("./ride/Geo"); 
const { onAccountCreated } = require("./ride/email/onAccountCreated");
const { onRidesCreated } = require("./ride/email/onRidesCreated");

// Payment functions
const { cardPayment } = require("./payments/cardPayment");
const { cashAppPayment } = require("./payments/cashAppPayment");
const { cashAppChecker } = require("./payments/cashAppChecker");
const { cashAppPoller } = require("./payments/cashAppPoller");
const { setupDeposit } = require("./payments/setupDeposit");

// driver functions
const { createDriverProfile } = require("./drivers/createDriverProfile");
const { checkDriverDeposit } = require("./drivers/checkDriverDeposit");
const { setDriverStatus } = require("./drivers/setDriverStatus");
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
const { onRideCreatedNotifyOnlineDrivers } = require("./drivers/email/onRideCreatedNotifyOnlineDrivers");
const { withdraw } = require("./drivers/withdraw");
const { processWithdrawal } = require("./drivers/processWithdrawal");
const { updateDriverPresence } = require("./drivers/updateDriverPresence");
const { setDriverTripActive } = require("./drivers/setDriverTripActive");
const { onRideCreated } = require("./drivers/onRideCreated");
const { emailCandidateDrivers } = require("./drivers/email/emailCandidateDrivers");



// Admin functions
const { onAccountCreatedNotifyAdmin } = require("./admin/email/onAccountCreatedNotifyAdmin");
const { onDriverCreatedNotifyAdmin } = require("./admin/email/onDriverCreatedNotifyAdmin");
const { onRideCreatedNotifyAdmin } = require("./admin/email/onRideCreatedNotifyAdmin");
const { onDriverStatusChanged } = require("./admin/email/onDriverStatusChanged");



// Exports
exports.createAccount = createAccount;
exports.onAccountCreated = onAccountCreated;
exports.onRidesCreated = onRidesCreated;
exports.ATOB = ATOB;
exports.Autocomplete = Autocomplete;
exports.Price = Price;
exports.Geo = Geo;
exports.cardPayment = cardPayment;
exports.checkDriverDeposit = checkDriverDeposit;
exports.cashAppPayment = cashAppPayment;
exports.cashAppChecker = cashAppChecker;
exports.cashAppPoller = cashAppPoller;
exports.setupDeposit = setupDeposit;
exports.acceptRide = acceptRide;
exports.declineRide = declineRide;
exports.updateTripStatus = updateTripStatus;
exports.getTripButtonLabel = getTripButtonLabel;
exports.createDriverProfile = createDriverProfile;
exports.setDriverStatus = setDriverStatus;
exports.getDriverEarnings = getDriverEarnings;
exports.calcDriverDistance = calcDriverDistance;
exports.getDriverToPickup = getDriverToPickup;
exports.updateDriverPresence = updateDriverPresence;
exports.setDriverTripActive = setDriverTripActive;
exports.onRideCreated = onRideCreated;
exports.onDriverCreated = onDriverCreated;
exports.onDriverApplicationSubmitted = onDriverApplicationSubmitted;
exports.withdraw = withdraw;
exports.processWithdrawal = processWithdrawal;
exports.onRideCreatedNotifyOnlineDrivers = onRideCreatedNotifyOnlineDrivers;
exports.onDriverStatusChanged = onDriverStatusChanged;

exports.onAccountCreatedNotifyAdmin = onAccountCreatedNotifyAdmin;
exports.onDriverCreatedNotifyAdmin = onDriverCreatedNotifyAdmin;
exports.onRideCreatedNotifyAdmin = onRideCreatedNotifyAdmin;
exports.ApplicationApproved = ApplicationApproved;
exports.emailCandidateDrivers = emailCandidateDrivers;