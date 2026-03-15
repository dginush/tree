const PushNotifications = (() => {
  // הכנס כאן את ה-VAPID Key שהעתקת מהקונסולה!
  var VAPID_KEY =
    "BL8pERC-fdA9cvYY_uwkp_IKsWp_Q-UaHBwGS5nAa1Rnkc-zszkk2hr_iKjbVcMar6-mw8xxHPRIcDDD0r4_EPw";

  var fcmToken = null;
  var checkInterval = null;

  function init() {
    registerServiceWorker();
    // בדיקה מקומית כל דקה (כגיבוי כשהאתר פתוח)
    checkInterval = setInterval(checkNotifications, 60000);
    setTimeout(checkNotifications, 5000);
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      console.log("Service Worker not supported");
      return;
    }

    try {
      var registration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js"
      );
      console.log("Service Worker registered:", registration.scope);

      // מחכה שה-SW יהיה פעיל
      await navigator.serviceWorker.ready;
      console.log("Service Worker ready");
    } catch (err) {
      console.error("SW registration failed:", err);
    }
  }

  async function requestPermission() {
    if (!("Notification" in window)) {
      App.showToast("הדפדפן לא תומך בהתראות", "warning");
      return false;
    }

    var permission = await Notification.requestPermission();
    if (permission !== "granted") {
      App.showToast("ההתראות נחסמו", "warning");
      return false;
    }

    // קבלת FCM Token
    try {
      await getToken();
      App.showToast("התראות הופעלו! 🔔");
      return true;
    } catch (err) {
      console.error("FCM Token error:", err);
      App.showToast("שגיאה בהפעלת התראות", "error");
      return false;
    }
  }

  async function getToken() {
    try {
      var messaging = firebase.messaging();
      var registration = await navigator.serviceWorker.getRegistration(
        "/firebase-messaging-sw.js"
      );

      fcmToken = await messaging.getToken({
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (fcmToken) {
        console.log("FCM Token:", fcmToken);
        // שמירת הטוקן ב-Firestore
        await saveTokenToFirestore(fcmToken);
        return fcmToken;
      }
    } catch (err) {
      console.error("getToken error:", err);
      throw err;
    }
  }

  async function saveTokenToFirestore(token) {
    var user = firebase.auth().currentUser;
    if (!user) return;

    var treeId = Sharing.getTreeId();
    if (!treeId) return;

    var db = FirebaseDB.getDb();
    if (!db) return;

    try {
      await db
        .collection("fcmTokens")
        .doc(user.uid)
        .set(
          {
            token: token,
            treeId: treeId,
            userId: user.uid,
            userName: user.displayName || user.email || "",
            updatedAt: new Date().toISOString(),
            platform:
              navigator.userAgent.indexOf("Mobile") > -1 ? "mobile" : "desktop",
          },
          { merge: true }
        );

      console.log("FCM token saved to Firestore");
    } catch (err) {
      console.error("Save token error:", err);
    }
  }

  // האזנה להתראות כשהאתר פתוח (Foreground)
  function listenToForegroundMessages() {
    try {
      var messaging = firebase.messaging();
      messaging.onMessage(function (payload) {
        console.log("Foreground message:", payload);
        var notification = payload.notification || {};
        var data = payload.data || {};

        // הצגת התראה ויזואלית באתר
        App.showToast(notification.body || "הודעה חדשה", "success");

        // גם הצגת Notification אם רוצים
        if (Notification.permission === "granted") {
          new Notification(notification.title || "🌳 עץ משפחתי", {
            body: notification.body || "",
            icon: "/icon-192.png",
            tag: data.type || "foreground",
          });
        }
      });
    } catch (err) {
      console.log("Foreground messaging not available:", err);
    }
  }

  // בדיקה מקומית (גיבוי)
  function checkNotifications() {
    if (Notification.permission !== "granted") return;

    var now = new Date();
    var hour = now.getHours();
    var minute = now.getMinutes();

    if (hour !== 10 || minute > 5) return;

    var todayKey = "push_sent_" + now.toDateString();
    if (localStorage.getItem(todayKey)) return;

    var members = App.getMembers();
    var events =
      typeof EventsManager !== "undefined" ? EventsManager.getAll() : [];

    checkBirthdays(members, now);
    checkUpcomingEvents(events, now);

    localStorage.setItem(todayKey, "1");
  }

  function checkBirthdays(members, now) {
    var today = now.getDate();
    var month = now.getMonth();

    members.forEach(function (m) {
      if (!m.birthDate || m.status === "deceased") return;
      var parts = m.birthDate.split("/");
      if (parts.length !== 3) return;
      var bDay = parseInt(parts[0]);
      var bMonth = parseInt(parts[1]) - 1;

      if (bDay === today && bMonth === month) {
        var age = now.getFullYear() - parseInt(parts[2]);
        sendLocalNotification(
          "🎂 יום הולדת שמח!",
          m.firstName + " " + m.lastName + " חוגג/ת " + age + " היום!",
          "birthday"
        );
      }
    });
  }

  function checkUpcomingEvents(events, now) {
    var oneWeek = new Date(now);
    oneWeek.setDate(oneWeek.getDate() + 7);
    var weekDay = oneWeek.getDate();
    var weekMonth = oneWeek.getMonth();
    var weekYear = oneWeek.getFullYear();

    events.forEach(function (ev) {
      if (!ev.date || ev.type === "birthday") return;
      var parts = ev.date.split("/");
      if (parts.length !== 3) return;
      var evDay = parseInt(parts[0]);
      var evMonth = parseInt(parts[1]) - 1;
      var evYear = parseInt(parts[2]);

      var isInWeek = false;
      if (ev.recurring === "yearly") {
        isInWeek = evDay === weekDay && evMonth === weekMonth;
      } else {
        isInWeek =
          evDay === weekDay && evMonth === weekMonth && evYear === weekYear;
      }

      if (isInWeek) {
        sendLocalNotification(
          "📅 אירוע בעוד שבוע!",
          ev.name + (ev.location ? " - " + ev.location : ""),
          "event"
        );
      }
    });
  }

  function sendLocalNotification(title, body, type) {
    if (Notification.permission !== "granted") return;
    try {
      new Notification(title, {
        body: body,
        icon: "/icon-192.png",
        tag: type + "_" + new Date().toDateString(),
        requireInteraction: true,
      });
    } catch (e) {
      console.log("Local notification error:", e);
    }
  }

  function stop() {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
  }

  return {
    init: init,
    stop: stop,
    requestPermission: requestPermission,
    checkNotifications: checkNotifications,
    listenToForegroundMessages: listenToForegroundMessages,
  };
})();
