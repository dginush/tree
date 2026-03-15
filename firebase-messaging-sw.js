// Service Worker for Firebase Cloud Messaging
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyBzuTzWlCZ172viYyL_GF2znagk1Gp2UDE",
  authDomain: "family-tree-d41a6.firebaseapp.com",
  projectId: "family-tree-d41a6",
  storageBucket: "family-tree-d41a6.firebasestorage.app",
  messagingSenderId: "983366627690",
  appId: "1:983366627690:web:c7ed703a8c35c2991df513",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  var title = payload.notification?.title || "🌳 עץ משפחתי";
  var options = {
    body: payload.notification?.body || "",
    icon: "🌳",
    badge: "🎂",
    tag: payload.data?.type || "general",
    data: payload.data,
  };
  return self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});
