const FirebaseDB = (() => {
  const firebaseConfig = {
    apiKey: "AIzaSyBzuTzWlCZ172viYyL_GF2znagk1Gp2UDE",
    authDomain: "family-tree-d41a6.firebaseapp.com",
    projectId: "family-tree-d41a6",
    storageBucket: "family-tree-d41a6.firebasestorage.app",
    messagingSenderId: "983366627690",
    appId: "1:983366627690:web:c7ed703a8c35c2991df513",
  };

  let db = null,
    storage = null,
    isConnected = false;

  function init() {
    try {
      if (firebase.apps.length) {
        db = firebase.firestore();
        storage = firebase.storage();
        isConnected = true;
        updateStatus("synced", "מסונכרן");
        return true;
      }

      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      storage = firebase.storage();

      db.enablePersistence({ synchronizeTabs: true }).catch(function (e) {
        console.log("Persistence error (non-critical):", e.code);
      });

      isConnected = true;
      updateStatus("synced", "מסונכרן");
      return true;
    } catch (e) {
      console.error("Firebase init error:", e);
      updateStatus("error", "שגיאה");
      return false;
    }
  }

  function getDb() {
    return db;
  }

  function updateStatus(t, x) {
    var el = document.getElementById("syncStatus");
    if (!el) return;
    var d = el.querySelector(".sync-dot"),
      tx = el.querySelector(".sync-text");
    if (!d || !tx) return;
    d.className = "sync-dot";
    d.style.background = "";
    if (t === "synced") d.classList.add("synced");
    else if (t === "syncing") d.classList.add("syncing");
    else if (t === "error") d.style.background = "#ff5252";
    tx.textContent = x;
  }

  function getCollectionPath(c) {
    var tid = Sharing.getTreeId();
    if (!tid) throw new Error("No tree selected");
    return "trees/" + tid + "/" + c;
  }

  var mU = null,
    eU = null;

  function listenToMembers(cb) {
    if (!db) return;
    if (mU) mU();
    try {
      var path = getCollectionPath("familyMembers");
      mU = db.collection(path).onSnapshot(
        function (s) {
          var a = [];
          s.forEach(function (d) {
            a.push(Object.assign({ id: d.id }, d.data()));
          });
          updateStatus("synced", "מסונכרן");
          cb(a);
        },
        function (e) {
          console.error("Members listen error:", e);
          updateStatus("error", "שגיאה");
        }
      );
    } catch (e) {
      console.error("Listen setup error:", e);
    }
  }

  function listenToEvents(cb) {
    if (!db) return;
    if (eU) eU();
    try {
      var path = getCollectionPath("familyEvents");
      eU = db.collection(path).onSnapshot(
        function (s) {
          var a = [];
          s.forEach(function (d) {
            a.push(Object.assign({ id: d.id }, d.data()));
          });
          cb(a);
        },
        function (e) {
          console.error("Events listen error:", e);
        }
      );
    } catch (e) {
      console.error("Events listen setup error:", e);
    }
  }

  function stopListening() {
    if (mU) {
      mU();
      mU = null;
    }
    if (eU) {
      eU();
      eU = null;
    }
  }

  async function getMembers() {
    if (!db) return [];
    updateStatus("syncing", "טוען...");
    try {
      var s = await db.collection(getCollectionPath("familyMembers")).get();
      var a = [];
      s.forEach(function (d) {
        a.push(Object.assign({ id: d.id }, d.data()));
      });
      updateStatus("synced", "מסונכרן");
      return a;
    } catch (e) {
      console.error("getMembers error:", e);
      updateStatus("error", "שגיאה");
      return [];
    }
  }

  async function saveMember(m) {
    if (!db || !Sharing.canEdit()) return;
    updateStatus("syncing", "שומר...");
    try {
      await db
        .collection(getCollectionPath("familyMembers"))
        .doc(m.id)
        .set(JSON.parse(JSON.stringify(m)));
      updateStatus("synced", "מסונכרן");
    } catch (e) {
      console.error("saveMember error:", e);
      updateStatus("error", "שגיאה");
    }
  }

  async function deleteMember(id) {
    if (!db || !Sharing.canDelete()) return;
    try {
      await db.collection(getCollectionPath("familyMembers")).doc(id).delete();
      updateStatus("synced", "מסונכרן");
    } catch (e) {
      console.error("deleteMember error:", e);
    }
  }

  async function saveAllMembers(ms) {
    if (!db || !Sharing.canEdit()) return;
    try {
      var b = db.batch();
      var p = getCollectionPath("familyMembers");
      ms.forEach(function (m) {
        b.set(db.collection(p).doc(m.id), JSON.parse(JSON.stringify(m)));
      });
      await b.commit();
      updateStatus("synced", "מסונכרן");
    } catch (e) {
      console.error("saveAllMembers error:", e);
    }
  }

  async function getEvents() {
    if (!db) return [];
    try {
      var s = await db.collection(getCollectionPath("familyEvents")).get();
      var a = [];
      s.forEach(function (d) {
        a.push(Object.assign({ id: d.id }, d.data()));
      });
      return a;
    } catch (e) {
      console.error("getEvents error:", e);
      return [];
    }
  }

  async function saveEvent(ev) {
    if (!db || !Sharing.canEdit()) return;
    try {
      await db
        .collection(getCollectionPath("familyEvents"))
        .doc(ev.id)
        .set(JSON.parse(JSON.stringify(ev)));
    } catch (e) {
      console.error("saveEvent error:", e);
    }
  }

  async function deleteEvent(id) {
    if (!db || !Sharing.canDelete()) return;
    try {
      await db.collection(getCollectionPath("familyEvents")).doc(id).delete();
    } catch (e) {
      console.error("deleteEvent error:", e);
    }
  }

  // === Photo Storage Functions ===

  async function uploadMemberPhoto(treeId, memberId, dataURL) {
    if (!dataURL || !dataURL.startsWith("data:image")) return null;
    if (!storage) {
      console.error("Storage not initialized");
      return null;
    }

    try {
      // המרת Base64 ל-Blob
      var parts = dataURL.split(",");
      var mime = parts[0].match(/:(.*?);/)[1];
      var binary = atob(parts[1]);
      var array = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      var blob = new Blob([array], { type: mime });

      // העלאה ל-Storage
      var path = "trees/" + treeId + "/members/" + memberId + "/photo.jpg";
      var ref = storage.ref(path);

      var snapshot = await ref.put(blob, {
        contentType: "image/jpeg",
        cacheControl: "public, max-age=31536000",
      });

      // קבלת URL ציבורי
      var url = await snapshot.ref.getDownloadURL();
      return url;
    } catch (err) {
      console.error("Photo upload error:", err);
      return null;
    }
  }

  async function deleteMemberPhoto(treeId, memberId) {
    if (!storage) return;
    try {
      var path = "trees/" + treeId + "/members/" + memberId + "/photo.jpg";
      var ref = storage.ref(path);
      await ref.delete();
    } catch (err) {
      if (err.code !== "storage/object-not-found") {
        console.error("Photo delete error:", err);
      }
    }
  }

  return {
    init: init,
    getDb: getDb,
    updateStatus: updateStatus,
    listenToMembers: listenToMembers,
    listenToEvents: listenToEvents,
    stopListening: stopListening,
    getMembers: getMembers,
    saveMember: saveMember,
    deleteMember: deleteMember,
    saveAllMembers: saveAllMembers,
    getEvents: getEvents,
    saveEvent: saveEvent,
    deleteEvent: deleteEvent,
    uploadMemberPhoto: uploadMemberPhoto,
    deleteMemberPhoto: deleteMemberPhoto,
    isReady: function () {
      return isConnected;
    },
  };
})();
