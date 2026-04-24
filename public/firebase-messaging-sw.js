importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyA_evhvMyw1qdv2vdXxqcu76y8rW828X14",
  authDomain: "uatob-e7b4b.firebaseapp.com",
  projectId: "uatob-e7b4b",
  storageBucket: "uatob-e7b4b.firebasestorage.app",
  messagingSenderId: "714931905484",
  appId: "1:714931905484:web:72e117c4583e6d14623369",
});

const messaging = firebase.messaging();

// ─────────────────────────────────────────────
// BACKGROUND PUSH HANDLER
// The compat SDK auto-displays the notification from your FCM payload.
// We only intercept here to suppress the duplicate — no manual
// showNotification() call needed.
// ─────────────────────────────────────────────
messaging.onBackgroundMessage((_payload) => {
  // Intentionally empty — Firebase displays the notification automatically.
  // Add data-only payload handling here if needed in the future.
});

// ─────────────────────────────────────────────
// NOTIFICATION CLICK HANDLER
// ─────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const rideId = event.notification?.data?.rideId;

  event.waitUntil(
    self.clients.openWindow(
      rideId
        ? `/driver/app?rideId=${rideId}`
        : "/driver/app"
    )
  );
});