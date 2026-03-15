// בדיקה שיש הרשאה
console.log("הרשאת התראות:", Notification.permission);

// שליחת התראת בדיקה ידנית
if (Notification.permission === "granted") {
  new Notification("🌳 בדיקה!", {
    body: "הודעות Push עובדות! 🎉",
    icon: "🎂",
  });
} else {
  Notification.requestPermission().then(function (p) {
    console.log("תוצאה:", p);
    if (p === "granted") {
      new Notification("🌳 בדיקה!", { body: "ההרשאה אושרה!" });
    }
  });
}
בדיקת הפונקציה של ימי הולדת ואירועים

// הפעלת בדיקה ידנית של ההתראות
PushNotifications.checkNotifications();

שים לב: הפונקציה checkNotifications בודקת אם השעה היא 10:00, ואם כבר נשלחה הודעה היום היא לא תשלח שוב. כדי לעקוף את זה לצורך בדיקה, הרץ:

// מחיקת הדגל שמונע שליחה חוזרת היום
localStorage.removeItem('push_sent_' + new Date().toDateString());

// ועכשיו הפעל שוב
PushNotifications.checkNotifications();


אם ההתראות לא עובדות

console.log('Permission:', Notification.permission);
console.log('PushNotifications exists:', typeof PushNotifications);
console.log('Browser support:', 'Notification' in window);

BL8pERC-fdA9cvYY_uwkp_IKsWp_Q-UaHBwGS5nAa1Rnkc-zszkk2hr_iKjbVcMar6-mw8xxHPRIcDDD0r4_EPw