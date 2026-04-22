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

messaging.onBackgroundMessage((payload) => {
  console.log("[SW] push received:", payload);

  const title =
    payload.notification?.title ||
    payload.data?.title ||
    "New Request";

  const body =
    payload.notification?.body ||
    payload.data?.body ||
    "";

  let data = payload.data || {};
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch {}
  }

  self.registration.showNotification(title, {
    body,
    icon: "/icon.png",
    data,
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  let data = event.notification.data || {};
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch {}
  }

  const rideId = data?.rideId;

  event.waitUntil(
    clients.openWindow(
      rideId ? `/driver/app?rideId=${rideId}` : "/driver/app"
    )
  );
});