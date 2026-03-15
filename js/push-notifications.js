//    "BL8pERC-fdA9cvYY_uwkp_IKsWp_Q-UaHBwGS5nAa1Rnkc-zszkk2hr_iKjbVcMar6-mw8xxHPRIcDDD0r4_EPw";
const PushNotifications = (() => {
  var VAPID_KEY =
    "BL8pERC-fdA9cvYY_uwkp_IKsWp_Q-UaHBwGS5nAa1Rnkc-zszkk2hr_iKjbVcMar6-mw8xxHPRIcDDD0r4_EPw"; // שים כאן את ה-VAPID Key שלך
  var checkInterval = null;

  function init() {
    // בדיקה מקומית כל דקה
    checkInterval = setInterval(checkNotifications, 60000);
    setTimeout(checkNotifications, 5000);
  }

  async function requestPermission() {
    // בדיקה שהדפדפן תומך
    if (!("Notification" in window)) {
      App.showToast("הדפדפן לא תומך בהתראות", "warning");
      return false;
    }

    try {
      var permission = await Notification.requestPermission();
      if (permission !== "granted") {
        App.showToast("ההתראות נחסמו בדפדפן", "warning");
        return false;
      }

      // בדיקה שיש Service Worker support
      if (!("serviceWorker" in navigator)) {
        App.showToast("התראות הופעלו (מקומית בלבד) 🔔");
        return true;
      }

      // ניסיון רישום Service Worker ו-FCM
      try {
        var registration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js"
        );
        await navigator.serviceWorker.ready;

        // בדיקה שיש firebase.messaging
        if (typeof firebase !== "undefined" && firebase.messaging) {
          var messaging = firebase.messaging();
          var token = await messaging.getToken({
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration,
          });

          if (token) {
            await saveTokenToFirestore(token);
            App.showToast("התראות Push הופעלו! 🔔");
            listenToForegroundMessages();
            return true;
          }
        }
      } catch (swErr) {
        console.log(
          "Service Worker/FCM setup failed (non-critical):",
          swErr.message
        );
      }

      // אם FCM נכשל - עדיין יש התראות מקומיות
      App.showToast("התראות הופעלו! 🔔");
      return true;
    } catch (err) {
      console.error("Permission error:", err);
      App.showToast("שגיאה בהפעלת התראות: " + err.message, "error");
      return false;
    }
  }

  async function saveTokenToFirestore(token) {
    try {
      var user = firebase.auth().currentUser;
      if (!user) return;
      var treeId = Sharing.getTreeId();
      if (!treeId) return;
      var db = FirebaseDB.getDb();
      if (!db) return;

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
          },
          { merge: true }
        );
    } catch (err) {
      console.log("Save token error:", err);
    }
  }

  function listenToForegroundMessages() {
    try {
      if (typeof firebase === "undefined" || !firebase.messaging) return;
      var messaging = firebase.messaging();
      messaging.onMessage(function (payload) {
        var notification = payload.notification || {};
        App.showToast(notification.body || "הודעה חדשה", "success");

        if (Notification.permission === "granted") {
          new Notification(notification.title || "🌳 עץ משפחתי", {
            body: notification.body || "",
            tag: "foreground",
          });
        }
      });
    } catch (err) {
      console.log("Foreground messaging not available:", err);
    }
  }

  function checkNotifications() {
    if (!("Notification" in window) || Notification.permission !== "granted")
      return;

    var now = new Date();
    if (now.getHours() !== 10 || now.getMinutes() > 5) return;

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
      if (parseInt(parts[0]) === today && parseInt(parts[1]) - 1 === month) {
        var age = now.getFullYear() - parseInt(parts[2]);
        sendLocalNotification(
          "🎂 יום הולדת שמח!",
          m.firstName + " " + m.lastName + " חוגג/ת " + age + " היום!"
        );
      }
    });
  }

  function checkUpcomingEvents(events, now) {
    var oneWeek = new Date(now);
    oneWeek.setDate(oneWeek.getDate() + 7);

    events.forEach(function (ev) {
      if (!ev.date || ev.type === "birthday") return;
      var parts = ev.date.split("/");
      if (parts.length !== 3) return;
      if (
        parseInt(parts[0]) === oneWeek.getDate() &&
        parseInt(parts[1]) - 1 === oneWeek.getMonth()
      ) {
        sendLocalNotification(
          "📅 אירוע בעוד שבוע!",
          ev.name + (ev.location ? " - " + ev.location : "")
        );
      }
    });
  }

  function sendLocalNotification(title, body) {
    try {
      new Notification(title, {
        body: body,
        tag: title + "_" + new Date().toDateString(),
        requireInteraction: true,
      });
    } catch (e) {
      console.log("Notification error:", e);
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
