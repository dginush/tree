const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
admin.initializeApp();

exports.sendDailyNotifications = onSchedule(
  {
    schedule: "0 10 * * *",
    timeZone: "Asia/Jerusalem",
    region: "europe-west1",
  },
  async (event) => {
    const db = admin.firestore();
    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth();

    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const weekDay = nextWeek.getDate();
    const weekMonth = nextWeek.getMonth();

    const tokensSnap = await db.collection("fcmTokens").get();
    if (tokensSnap.empty) {
      console.log("No FCM tokens found");
      return;
    }

    const tokensByTree = {};
    tokensSnap.forEach(function (doc) {
      var data = doc.data();
      if (data.token && data.treeId) {
        if (!tokensByTree[data.treeId]) tokensByTree[data.treeId] = [];
        tokensByTree[data.treeId].push(data.token);
      }
    });

    var treeIds = Object.keys(tokensByTree);
    for (var i = 0; i < treeIds.length; i++) {
      var treeId = treeIds[i];
      var tokens = tokensByTree[treeId];

      try {
        var membersSnap = await db
          .collection("trees/" + treeId + "/familyMembers")
          .get();
        membersSnap.forEach(function (doc) {
          var m = doc.data();
          if (!m.birthDate || m.status === "deceased") return;
          var parts = m.birthDate.split("/");
          if (parts.length !== 3) return;
          var bDay = parseInt(parts[0]);
          var bMonth = parseInt(parts[1]) - 1;
          if (bDay === todayDay && bMonth === todayMonth) {
            var age = today.getFullYear() - parseInt(parts[2]);
            sendToTokens(tokens, {
              title: "🎂 יום הולדת שמח!",
              body:
                m.firstName + " " + m.lastName + " חוגג/ת " + age + " היום!",
            });
          }
        });
      } catch (err) {
        console.error("Birthday check error:", err);
      }

      try {
        var eventsSnap = await db
          .collection("trees/" + treeId + "/familyEvents")
          .get();
        eventsSnap.forEach(function (doc) {
          var ev = doc.data();
          if (!ev.date || ev.type === "birthday") return;
          var parts = ev.date.split("/");
          if (parts.length !== 3) return;
          var evDay = parseInt(parts[0]);
          var evMonth = parseInt(parts[1]) - 1;
          var isInWeek = false;
          if (ev.recurring === "yearly") {
            isInWeek = evDay === weekDay && evMonth === weekMonth;
          } else {
            var evYear = parseInt(parts[2]);
            isInWeek =
              evDay === weekDay &&
              evMonth === weekMonth &&
              evYear === nextWeek.getFullYear();
          }
          if (isInWeek) {
            sendToTokens(tokens, {
              title: "📅 אירוע בעוד שבוע!",
              body: ev.name + (ev.location ? " - " + ev.location : ""),
            });
          }
        });
      } catch (err) {
        console.error("Events check error:", err);
      }
    }
  }
);

async function sendToTokens(tokens, notification) {
  if (!tokens || !tokens.length) return;
  try {
    var response = await admin.messaging().sendEachForMulticast({
      notification: notification,
      tokens: tokens,
    });
    console.log(
      "Sent: " +
        response.successCount +
        " success, " +
        response.failureCount +
        " failures"
    );
    if (response.failureCount > 0) {
      var db = admin.firestore();
      response.responses.forEach(async function (resp, idx) {
        if (!resp.success) {
          var code = resp.error ? resp.error.code : "";
          if (
            code === "messaging/invalid-registration-token" ||
            code === "messaging/registration-token-not-registered"
          ) {
            var snap = await db
              .collection("fcmTokens")
              .where("token", "==", tokens[idx])
              .get();
            snap.forEach(function (doc) {
              doc.ref.delete();
            });
          }
        }
      });
    }
  } catch (err) {
    console.error("Send error:", err);
  }
}
