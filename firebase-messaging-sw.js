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

// התראות ברקע - כשהאתר סגור
messaging.onBackgroundMessage(function (payload) {
  var data = payload.data || {};
  var notification = payload.notification || {};

  var title = notification.title || "🌳 עץ משפחתי";
  var options = {
    body: notification.body || "",
    icon: "/icon-192.png",
    badge: "/icon-72.png",
    tag: data.type || "general",
    data: data,
    actions: [
      { action: "open", title: "פתח" },
      { action: "dismiss", title: "סגור" },
    ],
    vibrate: [200, 100, 200],
    requireInteraction: true,
  };

  return self.registration.showNotification(title, options);
});

// לחיצה על התראה
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  if (event.action === "dismiss") return;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        // אם יש חלון פתוח - תתמקד בו
        for (var i = 0; i < clientList.length; i++) {
          if (
            clientList[i].url.includes(self.location.origin) &&
            "focus" in clientList[i]
          ) {
            return clientList[i].focus();
          }
        }
        // אחרת - פתח חלון חדש
        return clients.openWindow("/");
      })
  );
});
