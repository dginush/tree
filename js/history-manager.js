const HistoryManager = (() => {
  var history = [];
  var MAX_ENTRIES = 200;

  async function load() {
    try {
      var tid = Sharing.getTreeId();
      if (!tid) return;
      var db = FirebaseDB.getDb();
      if (!db) return;
      var snap = await db
        .collection("trees/" + tid + "/changeHistory")
        .orderBy("timestamp", "desc")
        .limit(MAX_ENTRIES)
        .get();
      history = [];
      snap.forEach(function (d) {
        history.push(Object.assign({ id: d.id }, d.data()));
      });
    } catch (e) {
      console.error("History load error:", e);
    }
  }

  async function log(action, memberName, details) {
    try {
      var tid = Sharing.getTreeId();
      if (!tid) return;
      var db = FirebaseDB.getDb();
      if (!db) return;
      var user = firebase.auth().currentUser;
      var entry = {
        action: action,
        memberName: memberName || "",
        details: details || "",
        userName: user?.displayName || user?.email || "אנונימי",
        userId: user?.uid || "",
        timestamp: new Date().toISOString(),
      };
      await db.collection("trees/" + tid + "/changeHistory").add(entry);
      history.unshift(entry);
      if (history.length > MAX_ENTRIES) history = history.slice(0, MAX_ENTRIES);
    } catch (e) {
      console.error("History log error:", e);
    }
  }

  function render() {
    var c = document.getElementById("historyList");
    if (!c) return;
    if (!history.length) {
      c.innerHTML =
        '<div class="empty-state"><div class="icon">📜</div><h3>אין היסטוריה</h3></div>';
      return;
    }
    var icons = {
      add: "➕",
      edit: "✏️",
      delete: "🗑️",
      "add-event": "🎉",
      "edit-event": "✏️",
      "delete-event": "🗑️",
    };
    c.innerHTML = history
      .map(function (h) {
        var d = new Date(h.timestamp);
        var time =
          d.toLocaleDateString("he-IL") +
          " " +
          d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
        var icon = icons[h.action] || "📝";
        var actionText =
          {
            add: "הוסיף",
            edit: "ערך",
            delete: "מחק",
            "add-event": "הוסיף אירוע",
            "edit-event": "ערך אירוע",
            "delete-event": "מחק אירוע",
          }[h.action] || h.action;
        return (
          '<div style="display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid var(--border)">' +
          '<span style="font-size:1.3em">' +
          icon +
          "</span>" +
          '<div style="flex:1">' +
          '<div style="font-weight:600;font-size:.92em">' +
          '<span style="color:var(--primary)">' +
          (h.userName || "") +
          "</span> " +
          actionText +
          (h.memberName ? " <strong>" + h.memberName + "</strong>" : "") +
          "</div>" +
          (h.details
            ? '<div style="font-size:.8em;color:var(--text-muted)">' +
              h.details +
              "</div>"
            : "") +
          "</div>" +
          '<div style="font-size:.75em;color:var(--text-muted);white-space:nowrap">' +
          time +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  async function clear() {
    if (!Sharing.isOwner()) {
      App.showToast("רק בעלים יכול לנקות", "warning");
      return;
    }
    if (!confirm("למחוק את כל ההיסטוריה?")) return;
    try {
      var tid = Sharing.getTreeId();
      var db = FirebaseDB.getDb();
      var snap = await db.collection("trees/" + tid + "/changeHistory").get();
      var batch = db.batch();
      snap.forEach(function (doc) {
        batch.delete(doc.ref);
      });
      await batch.commit();
      history = [];
      render();
      App.showToast("ההיסטוריה נוקתה");
    } catch (e) {
      console.error(e);
    }
  }

  return {
    load: load,
    log: log,
    render: render,
    clear: clear,
  };
})();
