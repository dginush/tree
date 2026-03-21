const Sharing = (() => {
  let cTid = null,
    cRole = null,
    tInfo = null,
    db = null;

  function init(d) {
    db = d;
  }

  function genCode() {
    const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let r = "";
    for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)];
    return r;
  }

  async function createTree(uid, name) {
    const tid = "tree_" + Date.now().toString(36);
    const sc = genCode();
    const td = {
      id: tid,
      name: "העץ של " + (name || "המשפחה"),
      ownerId: uid,
      shareCode: sc,
      members: {
        [uid]: {
          role: "owner",
          name: name || "",
          joinedAt: new Date().toISOString(),
        },
      },
      createdAt: new Date().toISOString(),
      settings: { requireApproval: false, allowEditorDelete: false },
    };
    await db.collection("trees").doc(tid).set(td);
    cTid = tid;
    cRole = "owner";
    tInfo = td;
    await db
      .collection("userProfiles")
      .doc(uid)
      .set(
        {
          currentTreeId: tid,
          trees: firebase.firestore.FieldValue.arrayUnion({
            treeId: tid,
            name: td.name,
            role: "owner",
          }),
        },
        { merge: true }
      );
    return td;
  }

  async function loadUserTree(uid) {
    try {
      var p = await db.collection("userProfiles").doc(uid).get();
      var uc = getURLCode();

      if (uc) {
        var j = await joinByCode(
          uid,
          uc,
          firebase.auth().currentUser?.displayName || ""
        );
        if (j) {
          // Clean URL
          window.history.replaceState({}, "", window.location.pathname);
          return j;
        }
      }

      if (p.exists) {
        var d = p.data();

        // Try default tree first, then current tree
        var targetTreeId = d.defaultTreeId || d.currentTreeId;

        if (targetTreeId) {
          var t = await db.collection("trees").doc(targetTreeId).get();
          if (t.exists) {
            var td = t.data();
            // Verify user still has access
            if (td.members?.[uid]) {
              tInfo = td;
              cTid = targetTreeId;
              cRole = td.members[uid].role;

              // Update currentTreeId if needed
              if (d.currentTreeId !== targetTreeId) {
                await db
                  .collection("userProfiles")
                  .doc(uid)
                  .set({ currentTreeId: targetTreeId }, { merge: true });
              }
              return tInfo;
            }
          }
        }

        // If target tree not found, try first available tree
        var trees = d.trees || [];
        for (var i = 0; i < trees.length; i++) {
          var treeRef = await db.collection("trees").doc(trees[i].treeId).get();
          if (treeRef.exists && treeRef.data().members?.[uid]) {
            tInfo = treeRef.data();
            cTid = trees[i].treeId;
            cRole = tInfo.members[uid].role;
            await db
              .collection("userProfiles")
              .doc(uid)
              .set({ currentTreeId: cTid }, { merge: true });
            return tInfo;
          }
        }
      }
      return null;
    } catch (e) {
      console.error("loadUserTree error:", e);
      return null;
    }
  }
  function getURLCode() {
    const p = new URLSearchParams(window.location.search);
    return p.get("join") || null;
  }

  async function joinByCode(uid, code, name) {
    try {
      code = code.toUpperCase().trim();
      const s = await db
        .collection("trees")
        .where("shareCode", "==", code)
        .limit(1)
        .get();
      if (s.empty) return null;

      const td = s.docs[0].data();
      if (td.members?.[uid]) {
        cTid = td.id;
        cRole = td.members[uid].role;
        tInfo = td;
        return td;
      }

      const role = "editor";
      await db
        .collection("trees")
        .doc(td.id)
        .update({
          ["members." + uid]: {
            role,
            name,
            joinedAt: new Date().toISOString(),
          },
        });
      await db
        .collection("userProfiles")
        .doc(uid)
        .set(
          {
            currentTreeId: td.id,
            trees: firebase.firestore.FieldValue.arrayUnion({
              treeId: td.id,
              name: td.name,
              role,
            }),
          },
          { merge: true }
        );

      cTid = td.id;
      cRole = role;
      tInfo = { ...td };
      tInfo.members[uid] = { role, name };
      return tInfo;
    } catch (e) {
      console.error("joinByCode error:", e);
      return null;
    }
  }

  function getShareLink() {
    if (!tInfo) return "";
    return location.origin + location.pathname + "?join=" + tInfo.shareCode;
  }

  async function regenerateCode() {
    if (cRole !== "owner") return;
    const c = genCode();
    await db.collection("trees").doc(cTid).update({ shareCode: c });
    tInfo.shareCode = c;
    return c;
  }

  async function setMemberRole(uid, tid, r) {
    if (cRole !== "owner") return;
    await db
      .collection("trees")
      .doc(cTid)
      .update({ ["members." + tid + ".role"]: r });
    if (tInfo.members[tid]) tInfo.members[tid].role = r;
    App.showToast("עודכן ✓");
  }

  async function removeMember(uid, tid) {
    if (cRole !== "owner") return;
    await db
      .collection("trees")
      .doc(cTid)
      .update({
        ["members." + tid]: firebase.firestore.FieldValue.delete(),
      });
    delete tInfo.members[tid];
    App.showToast("הוסר", "warning");
  }

  async function renameTree(n) {
    if (cRole !== "owner") return;
    await db.collection("trees").doc(cTid).update({ name: n });
    tInfo.name = n;
  }

  let tU = null;
  function listenToTree(cb) {
    if (!db || !cTid) return;
    if (tU) tU();
    tU = db
      .collection("trees")
      .doc(cTid)
      .onSnapshot((d) => {
        if (d.exists) {
          tInfo = d.data();
          const uid = firebase.auth().currentUser?.uid;
          if (uid && tInfo.members?.[uid]) cRole = tInfo.members[uid].role;
          cb(tInfo);
        }
      });
  }

  function stopListening() {
    if (tU) {
      tU();
      tU = null;
    }
  }

  function openSharingModal() {
    renderContent();
    App.openModal("sharingModal");
  }

  function renderContent() {
    const c = document.getElementById("sharingContent");
    if (!c || !tInfo) return;
    const link = getShareLink();
    const uid = firebase.auth().currentUser?.uid;
    const own = cRole === "owner";
    const es = Object.entries(tInfo.members || {});
    let mh = "";
    es.forEach(([id, info]) => {
      const me = id === uid;
      const rl = { owner: "👑 בעלים", editor: "✏️ עורך", viewer: "👁️ צופה" };
      const rc = { owner: "#FF8F00", editor: "#2E7D32", viewer: "#1976D2" };
      mh +=
        '<div class="share-member-row"><div class="share-member-info"><div class="share-member-avatar" style="background:' +
        (rc[info.role] || "#999") +
        '">' +
        (info.name || "?")[0].toUpperCase() +
        '</div><div><div class="share-member-name">' +
        (info.name || "") +
        (me ? " (אני)" : "") +
        '</div><div class="share-member-role" style="color:' +
        (rc[info.role] || "") +
        '">' +
        rl[info.role] +
        "</div></div></div>" +
        (own && !me
          ? '<div class="share-member-actions"><select class="form-select compact" onchange="Sharing.setMemberRole(\'' +
            uid +
            "','" +
            id +
            '\',this.value)" style="font-size:.8em;padding:4px"><option value="editor" ' +
            (info.role === "editor" ? "selected" : "") +
            '>✏️</option><option value="viewer" ' +
            (info.role === "viewer" ? "selected" : "") +
            '>👁️</option></select><button class="btn btn-danger btn-sm" style="padding:4px 8px;font-size:.75em" onclick="if(confirm(\'' +
            "להסיר?" +
            "'))Sharing.removeMember('" +
            uid +
            "','" +
            id +
            "').then(()=>Sharing.renderContent())\">✕</button></div>"
          : "") +
        "</div>";
    });
    c.innerHTML =
      '<div class="share-section"><div class="share-section-title">🔗 קישור</div><div class="share-link-box"><input type="text" class="form-input share-link-input" id="shareLinkInput" value="' +
      link +
      '" readonly onclick="this.select()"><button class="btn btn-primary btn-sm" onclick="Sharing.copyLink()">📋</button></div><div class="share-actions-row"><button class="btn btn-accent btn-sm" onclick="Sharing.shareWA()">📞 WhatsApp</button>' +
      (own
        ? '<span style="font-weight:700">🔑 ' + tInfo.shareCode + "</span>"
        : "") +
      '</div></div><div class="share-section"><div class="share-section-title">👥 חברים (' +
      es.length +
      ')</div><div class="share-members-list">' +
      mh +
      '</div></div><div class="share-section"><div class="role-info-box ' +
      cRole +
      '">' +
      (cRole === "owner"
        ? "👑 בעלים"
        : cRole === "editor"
        ? "✏️ עורך"
        : "👁️ צופה") +
      "</div></div>";
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(getShareLink());
      App.showToast("הועתק! 📋");
    } catch {
      document.getElementById("shareLinkInput")?.select();
      document.execCommand("copy");
      App.showToast("הועתק!");
    }
  }

  function shareWA() {
    window.open(
      "https://wa.me/?text=" +
        encodeURIComponent(
          "🌳 הצטרפו לעץ המשפחה!\n" +
            getShareLink() +
            "\nקוד: " +
            (tInfo?.shareCode || "")
        ),
      "_blank"
    );
  }

  function canEdit() {
    return cRole === "owner" || cRole === "editor";
  }
  function canDelete() {
    return cRole === "owner";
  }
  // === Multi-Tree Functions ===

  async function getUserTrees() {
    var uid = firebase.auth().currentUser?.uid;
    if (!uid || !db) return [];

    try {
      var profileDoc = await db.collection("userProfiles").doc(uid).get();
      if (!profileDoc.exists) return [];

      var data = profileDoc.data();
      var treesArr = data.trees || [];

      // Enrich with fresh data from tree documents
      var enriched = [];
      for (var i = 0; i < treesArr.length; i++) {
        var t = treesArr[i];
        try {
          var treeDoc = await db.collection("trees").doc(t.treeId).get();
          if (treeDoc.exists) {
            var td = treeDoc.data();
            enriched.push({
              treeId: t.treeId,
              name: td.name || t.name || "עץ ללא שם",
              role: td.members?.[uid]?.role || t.role || "viewer",
              memberCount: Object.keys(td.members || {}).length,
              isDefault: data.defaultTreeId === t.treeId,
              isCurrent: cTid === t.treeId,
            });
          }
        } catch (e) {
          console.log("Tree load error for", t.treeId, e);
        }
      }
      return enriched;
    } catch (e) {
      console.error("getUserTrees error:", e);
      return [];
    }
  }

  async function switchTree(treeId) {
    var uid = firebase.auth().currentUser?.uid;
    if (!uid || !db || !treeId) return false;

    try {
      var treeDoc = await db.collection("trees").doc(treeId).get();
      if (!treeDoc.exists) {
        App.showToast("העץ לא נמצא", "error");
        return false;
      }

      var td = treeDoc.data();
      if (!td.members?.[uid]) {
        App.showToast("אין לך גישה לעץ זה", "error");
        return false;
      }

      // Stop current listeners
      FirebaseDB.stopListening();
      stopListening();

      // Update current tree
      cTid = treeId;
      cRole = td.members[uid].role;
      tInfo = td;

      // Save as current tree in profile
      await db
        .collection("userProfiles")
        .doc(uid)
        .set({ currentTreeId: treeId }, { merge: true });

      // Update header
      var tn = document.getElementById("currentTreeName");
      if (tn) tn.textContent = td.name || "";
      var rb = document.getElementById("roleBadge");
      var ic = { owner: "👑", editor: "✏️", viewer: "👁️" };
      if (rb) rb.textContent = ic[cRole] || "";

      // Re-init app
      App.initAfterLogin();

      App.showToast("🌳 עברת ל: " + (td.name || "עץ"));
      return true;
    } catch (e) {
      console.error("switchTree error:", e);
      App.showToast("שגיאה בהחלפת עץ", "error");
      return false;
    }
  }

  async function setDefaultTree(treeId) {
    var uid = firebase.auth().currentUser?.uid;
    if (!uid || !db) return;

    try {
      await db
        .collection("userProfiles")
        .doc(uid)
        .set({ defaultTreeId: treeId }, { merge: true });
      App.showToast("עץ ברירת מחדל עודכן ⭐");
    } catch (e) {
      console.error("setDefaultTree error:", e);
    }
  }

  async function getDefaultTreeId() {
    var uid = firebase.auth().currentUser?.uid;
    if (!uid || !db) return null;

    try {
      var profileDoc = await db.collection("userProfiles").doc(uid).get();
      if (profileDoc.exists) {
        return profileDoc.data().defaultTreeId || null;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async function leaveTree(treeId) {
    var uid = firebase.auth().currentUser?.uid;
    if (!uid || !db) return;

    try {
      var treeDoc = await db.collection("trees").doc(treeId).get();
      if (!treeDoc.exists) return;

      var td = treeDoc.data();

      // Owner can't leave
      if (td.ownerId === uid) {
        App.showToast("בעלים לא יכול לעזוב את העץ", "error");
        return;
      }

      // Remove from tree members
      await db
        .collection("trees")
        .doc(treeId)
        .update({
          ["members." + uid]: firebase.firestore.FieldValue.delete(),
        });

      // Remove from user profile trees array
      var profileDoc = await db.collection("userProfiles").doc(uid).get();
      if (profileDoc.exists) {
        var trees = profileDoc.data().trees || [];
        var updated = trees.filter(function (t) {
          return t.treeId !== treeId;
        });
        await db.collection("userProfiles").doc(uid).update({
          trees: updated,
        });

        // If this was the current tree, clear it
        if (profileDoc.data().currentTreeId === treeId) {
          if (updated.length > 0) {
            await db.collection("userProfiles").doc(uid).update({
              currentTreeId: updated[0].treeId,
            });
          } else {
            await db.collection("userProfiles").doc(uid).update({
              currentTreeId: firebase.firestore.FieldValue.delete(),
            });
          }
        }
      }

      App.showToast("עזבת את העץ", "warning");
    } catch (e) {
      console.error("leaveTree error:", e);
      App.showToast("שגיאה", "error");
    }
  }

  function openTreeSwitcher() {
    renderTreeSwitcher();
    App.openModal("treeSwitchModal");
  }

  async function renderTreeSwitcher() {
    var container = document.getElementById("treeSwitchContent");
    if (!container) return;

    container.innerHTML =
      '<div style="text-align:center;padding:20px">⏳ טוען עצים...</div>';

    var trees = await getUserTrees();

    if (!trees.length) {
      container.innerHTML =
        '<div class="empty-state"><div class="icon">🌳</div><h3>אין עצים</h3></div>';
      return;
    }

    var h = '<div class="tree-switch-list">';
    trees.forEach(function (t) {
      var roleLabel = {
        owner: "👑 בעלים",
        editor: "✏️ עורך",
        viewer: "👁️ צופה",
      };
      var roleColor = {
        owner: "#FF8F00",
        editor: "#2E7D32",
        viewer: "#1976D2",
      };

      h +=
        '<div class="tree-switch-item' + (t.isCurrent ? " current" : "") + '">';
      h += '<div class="tree-switch-info">';
      h += '<div class="tree-switch-name">';
      h += (t.isDefault ? "⭐ " : "") + t.name;
      if (t.isCurrent) h += ' <span class="tree-current-badge">נוכחי</span>';
      h += "</div>";
      h +=
        '<div class="tree-switch-meta">' +
        '<span style="color:' +
        (roleColor[t.role] || "#999") +
        '">' +
        (roleLabel[t.role] || t.role) +
        "</span>" +
        " · " +
        t.memberCount +
        " חברים" +
        "</div>";
      h += "</div>";
      h += '<div class="tree-switch-actions">';

      if (!t.isCurrent) {
        h +=
          '<button class="btn btn-primary btn-sm" onclick="Sharing.switchTree(\'' +
          t.treeId +
          "').then(function(ok){if(ok)App.closeModal('treeSwitchModal')})\">🔄 עבור</button>";
      }

      if (!t.isDefault) {
        h +=
          '<button class="btn btn-outline btn-sm" onclick="Sharing.setDefaultTree(\'' +
          t.treeId +
          '\').then(function(){Sharing.renderTreeSwitcher()})" title="הגדר כברירת מחדל">⭐</button>';
      }

      if (t.role !== "owner") {
        h +=
          '<button class="btn btn-danger btn-sm" style="padding:4px 8px" onclick="if(confirm(\'לעזוב את העץ?' +
          "'))Sharing.leaveTree('" +
          t.treeId +
          '\').then(function(){Sharing.renderTreeSwitcher()})" title="עזוב עץ">🚪</button>';
      }

      h += "</div></div>";
    });
    h += "</div>";

    h +=
      '<div style="margin-top:16px;display:flex;gap:8px;justify-content:center">';
    h +=
      '<button class="btn btn-primary" onclick="App.closeModal(\'treeSwitchModal\');Sharing.showNewTreeFromSwitcher()">🌱 צור עץ חדש</button>';
    h +=
      '<button class="btn btn-outline" onclick="App.closeModal(\'treeSwitchModal\');Sharing.showJoinTreeFromSwitcher()">🔗 הצטרף עם קוד</button>';
    h += "</div>";

    container.innerHTML = h;
  }

  function showNewTreeFromSwitcher() {
    document.getElementById("appContainer").style.display = "none";
    document.getElementById("treeSelectScreen").style.display = "";
    // Open the "new tree" section
    var opt = document.querySelectorAll(".tree-select-option");
    opt.forEach(function (o) {
      o.classList.remove("open");
    });
    if (opt[0]) opt[0].classList.add("open");
  }

  function showJoinTreeFromSwitcher() {
    document.getElementById("appContainer").style.display = "none";
    document.getElementById("treeSelectScreen").style.display = "";
    // Open the "join tree" section
    var opt = document.querySelectorAll(".tree-select-option");
    opt.forEach(function (o) {
      o.classList.remove("open");
    });
    if (opt[1]) opt[1].classList.add("open");
  }
  return {
    init: init,
    createTree: createTree,
    loadUserTree: loadUserTree,
    joinByCode: joinByCode,
    getShareLink: getShareLink,
    regenerateCode: regenerateCode,
    setMemberRole: setMemberRole,
    removeMember: removeMember,
    renameTree: renameTree,
    listenToTree: listenToTree,
    stopListening: stopListening,
    openSharingModal: openSharingModal,
    renderContent: renderContent,
    copyLink: copyLink,
    shareWA: shareWA,
    canEdit: canEdit,
    canDelete: canDelete,
    isOwner: function () {
      return cRole === "owner";
    },
    getRole: function () {
      return cRole;
    },
    getTreeId: function () {
      return cTid;
    },
    getTreeInfo: function () {
      return tInfo;
    },
    // Multi-tree functions
    getUserTrees: getUserTrees,
    switchTree: switchTree,
    setDefaultTree: setDefaultTree,
    getDefaultTreeId: getDefaultTreeId,
    leaveTree: leaveTree,
    openTreeSwitcher: openTreeSwitcher,
    renderTreeSwitcher: renderTreeSwitcher,
    showNewTreeFromSwitcher: showNewTreeFromSwitcher,
    showJoinTreeFromSwitcher: showJoinTreeFromSwitcher,
  };
})();
