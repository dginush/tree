const PushNotifications = (() => {
  var checkInterval = null;

  function init() {
    // בדיקה כל דקה אם צריך לשלוח התראה
    checkInterval = setInterval(checkNotifications, 60000);
    // בדיקה ראשונית
    setTimeout(checkNotifications, 5000);
    // בקשת הרשאה
    requestPermission();
  }

  function requestPermission() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  function checkNotifications() {
    if (Notification.permission !== "granted") return;

    var now = new Date();
    var hour = now.getHours();
    var minute = now.getMinutes();

    // בדיקה רק בשעה 10:00
    if (hour !== 10 || minute > 5) return;

    // בדיקה שלא שלחנו כבר היום
    var todayKey = "push_sent_" + now.toDateString();
    if (localStorage.getItem(todayKey)) return;

    var members = App.getMembers();
    var events = EventsManager.getAll();

    // סעיף 5: בדיקת ימי הולדת היום
    checkBirthdays(members, now);

    // סעיף 6: בדיקת אירועים בעוד שבוע
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
        sendNotification(
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
      if (!ev.date || ev.type === "birthday") return; // ימי הולדת מטופלים בנפרד
      var parts = ev.date.split("/");
      if (parts.length !== 3) return;

      var evDay = parseInt(parts[0]);
      var evMonth = parseInt(parts[1]) - 1;
      var evYear = parseInt(parts[2]);

      // בדיקה אם האירוע בעוד בדיוק שבוע
      var isInWeek = false;

      if (ev.recurring === "yearly") {
        // אירוע שנתי - בדיקה רק לפי יום וחודש
        isInWeek = evDay === weekDay && evMonth === weekMonth;
      } else {
        // אירוע חד פעמי
        isInWeek =
          evDay === weekDay && evMonth === weekMonth && evYear === weekYear;
      }

      if (isInWeek) {
        sendNotification(
          "📅 אירוע בעוד שבוע!",
          ev.name + (ev.location ? " - " + ev.location : "") + "\n" + ev.date,
          "event"
        );
      }
    });
  }

  function sendNotification(title, body, type) {
    if (Notification.permission !== "granted") return;

    try {
      var notification = new Notification(title, {
        body: body,
        icon: type === "birthday" ? "🎂" : "📅",
        tag: type + "_" + new Date().toDateString(),
        requireInteraction: true,
      });

      notification.onclick = function () {
        window.focus();
        notification.close();
      };

      // סגירה אוטומטית אחרי 30 שניות
      setTimeout(function () {
        notification.close();
      }, 30000);
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
    checkNotifications: checkNotifications, // לבדיקה ידנית
  };
})();
