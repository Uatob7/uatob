const admin = require("firebase-admin");
const { setGlobalOptions } = require("firebase-functions/v2");

admin.initializeApp();

setGlobalOptions({
  region: "us-east1",
  memory: "256MiB",
  maxInstances: 5,
  timeoutSeconds: 60,
});

// Ride function
const { createAccount } = require("./ride/createAccount");
const { ATOB } = require("./ride/ATOB");
const { Price } = require("./ride/Price"); 
const { Autocomplete } = require("./ride/Autocomplete"); 
const { Geo } = require("./ride/Geo"); 
const { onAccountCreated } = require("./ride/email/onAccountCreated");
const { activateScheduledRides } = require("./ride/activateScheduledRides");
const { riderLocation } = require("./ride/riderLocation");
const { cancelRide } = require("./ride/cancelRide");
const { extendRideSearch } = require("./ride/extendRideSearch");
const { rideTimeoutChecker } = require("./ride/rideTimeoutChecker");
const { onRidePaymentSucceeded } = require("./ride/email/onRidePaymentSucceeded");
const { onRideCancelled } = require("./ride/email/onRideCancelled");
const { onRideDriverArrived } = require("./ride/email/onRideDriverArrived");
const { onRideDriverArriving } = require("./ride/email/onRideDriverArriving");
const { onRideDriverAssigned } = require("./ride/email/onRideDriverAssigned");
const { onRideInProgress } = require("./ride/email/onRideInProgress");
const { findDriversOnCreate } = require("./ride/findDriversOnCreate");




const { saveRiderFcmToken } = require("./ride/saveRiderFcmToken");
const { onRideStatusChangedNotifyRider } = require("./ride/onRideStatusChangedNotifyRider");
const { trackView } = require("./ride/trackView");
const { updateRiderPhone } = require("./ride/updateRiderPhone");
const { autoRefundTimeoutRides } = require("./ride/autoRefundTimeoutRides");
const { refreshRidePolylines } = require("./ride/refreshRidePolylines");
const { onRideStatusChangedRefreshPolylines } = require("./ride/onRideStatusChangedRefreshPolylines");

// Payment functions
const { cashPayment } = require("./payments/cashPayment");
const { cardPayment } = require("./payments/cardPayment");
const { cashAppPayment } = require("./payments/cashAppPayment");
const { cardChecker } = require("./payments/cardChecker");
const { setupDeposit } = require("./payments/setupDeposit");
const { confirmCashCollection } = require("./payments/confirmCashCollection");
const { validatePromoCode } = require("./payments/validatePromoCode");
const { scheduledRideChecker } = require("./payments/scheduledRideChecker");

// driver functions
const { driverFeed } = require("./drivers/driverFeed");
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
const { ApplicationRejected  } = require("./drivers/email/ApplicationRejected");
const { notifyApprovedDrivers } = require("./drivers/email/notifyApprovedDrivers");
const { withdraw } = require("./drivers/withdraw");
const { processWithdrawal } = require("./drivers/processWithdrawal");
const { updateDriverPresence } = require("./drivers/updateDriverPresence");
const { setDriverTripActive } = require("./drivers/setDriverTripActive");
const { onReviewCreated } = require("./drivers/onReviewCreated");
const { updateDriverAchievements } = require("./drivers/updateDriverAchievements");
const { checkDriverStripeCapability } = require("./drivers/checkDriverStripeCapability");
const { saveDriverFcmToken } = require("./drivers/saveDriverFcmToken");
const { sendPushNotification } = require("./drivers/sendPushNotification");
const { pushCandidateDrivers } = require("./drivers/notification/pushCandidateDrivers");
const { reassignRide } = require("./drivers/reassignRide");
const { onPaymentSucceeded } = require("./drivers/email/onPaymentSucceeded");
const { pushOfflineDriver } = require("./drivers/notification/pushOfflineDriver");
const { updateDriverSetting } = require("./drivers/updateDriverSetting");
const { driverReportEmail } = require("./drivers/email/driverReportEmail");
const { driverInProgressEmail } = require("./drivers/email/driverInProgressEmail");
const { deleteDriverAccount } = require("./drivers/deleteDriverAccount");

const { emailCandidateDrivers } = require("./drivers/email/emailCandidateDrivers");



// Admin functions
const { onAccountCreatedNotifyAdmin } = require("./admin/email/onAccountCreatedNotifyAdmin");
const { onDriverCreatedNotifyAdmin } = require("./admin/email/onDriverCreatedNotifyAdmin");
const { onRideCreatedNotifyAdmin } = require("./admin/email/onRideCreatedNotifyAdmin");
const { onDriverStatusChanged } = require("./admin/email/onDriverStatusChanged");
const { thankYouAnnouncement } = require("./admin/email/thankYouAnnouncement");
const { saveAdminFcmToken } = require("./admin/saveAdminFcmToken");
const { approveDriver } = require("./admin/approveDriver");
const { rejectDriver } = require("./admin/rejectDriver");
const { computeRideAnalytics } = require("./admin/computeRideAnalytics");
const { adminSendDriverMessage } = require("./admin/adminSendDriverMessage");
const { announceCashRides } = require("./admin/email/announceCashRides");
const { announceOnlineDrivers } = require("./admin/announceOnlineDrivers");
const { awardReward  } = require("./admin/awardReward");
const { deleteDriver } = require("./admin/deleteDriver");
const { autoApprovePendingDrivers } = require("./admin/autoApprovePendingDrivers");
const { onSupportMessageSent } = require("./admin/onSupportMessageSent");

// Account presence



// Exports
exports.createAccount = createAccount;
exports.driverFeed = driverFeed;
exports.onAccountCreated = onAccountCreated;
exports.ATOB = ATOB;
exports.riderLocation = riderLocation;
exports.Autocomplete = Autocomplete;
exports.activateScheduledRides = activateScheduledRides;
exports.Price = Price;
exports.cancelRide = cancelRide;
exports.extendRideSearch = extendRideSearch;
exports.Geo = Geo;
exports.autoRefundTimeoutRides = autoRefundTimeoutRides;
exports.refreshRidePolylines = refreshRidePolylines;
exports.onRideStatusChangedRefreshPolylines = onRideStatusChangedRefreshPolylines;
exports.onRideCancelled = onRideCancelled;
exports.onRideDriverArrived = onRideDriverArrived;
exports.onRideDriverArriving = onRideDriverArriving;
exports.onRideDriverAssigned = onRideDriverAssigned;
exports.onRideInProgress = onRideInProgress;
exports.findDriversOnCreate = findDriversOnCreate;
exports.validatePromoCode = validatePromoCode;






exports.onRidePaymentSucceeded = onRidePaymentSucceeded;
exports.cardPayment = cardPayment;
exports.scheduledRideChecker = scheduledRideChecker;
exports.cashPayment = cashPayment;
exports.checkDriverDeposit = checkDriverDeposit;
exports.cashAppPayment = cashAppPayment;
exports.confirmCashCollection = confirmCashCollection;
exports.setupDeposit = setupDeposit;
exports.notifyApprovedDrivers = notifyApprovedDrivers;
exports.acceptRide = acceptRide;
exports.pushCandidateDrivers = pushCandidateDrivers;
exports.rideTimeoutChecker = rideTimeoutChecker;
exports.declineRide = declineRide;
exports.updateRiderPhone = updateRiderPhone;
exports.updateTripStatus = updateTripStatus;
exports.getTripButtonLabel = getTripButtonLabel;
exports.ApplicationRejected = ApplicationRejected;
exports.DriverStatus = DriverStatus;
exports.trackView = trackView;
exports.sendPushNotification = sendPushNotification;
exports.getDriverEarnings = getDriverEarnings;
exports.calcDriverDistance = calcDriverDistance;
exports.getDriverToPickup = getDriverToPickup;
exports.onRideStatusChangedNotifyRider = onRideStatusChangedNotifyRider;
exports.updateDriverPresence = updateDriverPresence;
exports.setDriverTripActive = setDriverTripActive;
exports.cardChecker = cardChecker;
exports.onDriverCreated = onDriverCreated;
exports.updateDriverAchievements = updateDriverAchievements;
exports.onDriverApplicationSubmitted = onDriverApplicationSubmitted;
exports.withdraw = withdraw;
exports.saveDriverFcmToken = saveDriverFcmToken;
exports.adminSendDriverMessage = adminSendDriverMessage;
exports.saveRiderFcmToken = saveRiderFcmToken;
exports.reassignRide = reassignRide;
exports.processWithdrawal = processWithdrawal;
exports.onReviewCreated = onReviewCreated;
exports.onDriverStatusChanged = onDriverStatusChanged;
exports.checkDriverStripeCapability = checkDriverStripeCapability;
exports.onPaymentSucceeded = onPaymentSucceeded;
exports.pushOfflineDriver = pushOfflineDriver;
exports.updateDriverSetting = updateDriverSetting;
exports.driverReportEmail = driverReportEmail;
exports.driverInProgressEmail = driverInProgressEmail;
exports.deleteDriverAccount = deleteDriverAccount;

exports.onAccountCreatedNotifyAdmin = onAccountCreatedNotifyAdmin;
exports.thankYouAnnouncement = thankYouAnnouncement;
exports.announceCashRides = announceCashRides;
exports.onDriverCreatedNotifyAdmin = onDriverCreatedNotifyAdmin;
exports.onRideCreatedNotifyAdmin = onRideCreatedNotifyAdmin;
exports.ApplicationApproved = ApplicationApproved;
exports.emailCandidateDrivers = emailCandidateDrivers;
exports.saveAdminFcmToken = saveAdminFcmToken;
exports.approveDriver = approveDriver;
exports.rejectDriver = rejectDriver;
exports.computeRideAnalytics = computeRideAnalytics;
exports.announceOnlineDrivers = announceOnlineDrivers;
exports.awardReward = awardReward;
exports.deleteDriver = deleteDriver;
exports.autoApprovePendingDrivers = autoApprovePendingDrivers;
exports.onSupportMessageSent = onSupportMessageSent;

