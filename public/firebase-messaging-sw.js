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
// Intentionally empty — Firebase displays the
// notification automatically from the FCM payload.
// ─────────────────────────────────────────────
messaging.onBackgroundMessage((_payload) => {
  // no-op
});

// ─────────────────────────────────────────────
// NOTIFICATION CLICK HANDLER
// Opens the link from FCM payload data.url,
// falls back to notification.click_action,
// then falls back to "/".
// ─────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data       = event.notification.data ?? {};
  const targetUrl  = data.url ?? event.notification.click_action ?? "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // If a tab is already open on the target URL, just focus it
        const match = clients.find((c) => c.url === targetUrl);
        if (match) return match.focus();

        // If any tab is open, navigate it to the target URL
        if (clients.length > 0) return clients[0].navigate(targetUrl).then((c) => c?.focus());

        // No tab open — open a new one
        return self.clients.openWindow(targetUrl);
      })
  );
});