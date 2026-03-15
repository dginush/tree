const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// רץ כל יום ב-10:00 בבוקר (שעון ישראל)
exports.sendDailyNotifications = functions.pubsub
  .schedule("0 10 * * *")
  .timeZone("Asia/Jerusalem")
  .onRun(async (context) => {
    const db = admin.firestore();
    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth(); // 0-based

    // שבוע קדימה
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const weekDay = nextWeek.getDate();
    const weekMonth = nextWeek.getMonth();

    // קבלת כל הטוקנים
    const tokensSnap = await db.collection("fcmTokens").get();
    if (tokensSnap.empty) {
      console.log("No FCM tokens found");
      return null;
    }

    // לכל עץ - בדיקת ימי הולדת ואירועים
    const treeIds = new Set();
    const tokensByTree = {};

    tokensSnap.forEach((doc) => {
      const data = doc.data();
      if (data.token && data.treeId) {
        treeIds.add(data.treeId);
        if (!tokensByTree[data.treeId]) tokensByTree[data.treeId] = [];
        tokensByTree[data.treeId].push(data.token);
      }
    });

    for (const treeId of treeIds) {
      const tokens = tokensByTree[treeId];
      if (!tokens || !tokens.length) continue;

      // בדיקת ימי הולדת
      try {
        const membersSnap = await db
          .collection(`trees/${treeId}/familyMembers`)
          .get();
        membersSnap.forEach((doc) => {
          const m = doc.data();
          if (!m.birthDate || m.status === "deceased") return;

          const parts = m.birthDate.split("/");
          if (parts.length !== 3) return;
          const bDay = parseInt(parts[0]);
          const bMonth = parseInt(parts[1]) - 1;

          if (bDay === todayDay && bMonth === todayMonth) {
            const age = today.getFullYear() - parseInt(parts[2]);
            sendToTokens(
              tokens,
              {
                title: "🎂 יום הולדת שמח!",
                body: `${m.firstName} ${m.lastName} חוגג/ת ${age} היום!`,
              },
              { type: "birthday", memberId: doc.id }
            );
          }
        });
      } catch (err) {
        console.error("Birthday check error:", err);
      }

      // בדיקת אירועים בעוד שבוע
      try {
        const eventsSnap = await db
          .collection(`trees/${treeId}/familyEvents`)
          .get();
        eventsSnap.forEach((doc) => {
          const ev = doc.data();
          if (!ev.date || ev.type === "birthday") return;

          const parts = ev.date.split("/");
          if (parts.length !== 3) return;
          const evDay = parseInt(parts[0]);
          const evMonth = parseInt(parts[1]) - 1;

          let isInWeek = false;
          if (ev.recurring === "yearly") {
            isInWeek = evDay === weekDay && evMonth === weekMonth;
          } else {
            const evYear = parseInt(parts[2]);
            isInWeek =
              evDay === weekDay &&
              evMonth === weekMonth &&
              evYear === nextWeek.getFullYear();
          }

          if (isInWeek) {
            sendToTokens(
              tokens,
              {
                title: "📅 אירוע בעוד שבוע!",
                body: ev.name + (ev.location ? " - " + ev.location : ""),
              },
              { type: "event", eventId: doc.id }
            );
          }
        });
      } catch (err) {
        console.error("Events check error:", err);
      }
    }

    return null;
  });

async function sendToTokens(tokens, notification, data) {
  if (!tokens.length) return;

  const message = {
    notification: notification,
    data: data || {},
    tokens: tokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(
      `Sent: ${response.successCount} success, ${response.failureCount} failures`
    );

    // ניקוי טוקנים לא תקינים
    if (response.failureCount > 0) {
      const db = admin.firestore();
      response.responses.forEach(async (resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (
            errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/registration-token-not-registered"
          ) {
            // מחיקת טוקן לא תקין
            const snap = await db
              .collection("fcmTokens")
              .where("token", "==", tokens[idx])
              .get();
            snap.forEach((doc) => doc.ref.delete());
          }
        }
      });
    }
  } catch (err) {
    console.error("Send error:", err);
  }
}
