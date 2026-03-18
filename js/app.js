const App = (() => {
  let members = [],
    editingId = null,
    cropper = null,
    pendingImageSrc = null;
  const RELATION_LABELS = {
    self: "אני",
    father: "אבא",
    mother: "אמא",
    spouse: "בן/בת זוג",
    "ex-spouse": "גרוש/ה",
    son: "בן",
    daughter: "בת",
    brother: "אח",
    sister: "אחות",
    "half-brother": "אח חורג",
    "half-sister": "אחות חורגת",
    grandfather: "סבא",
    grandmother: "סבתא",
    uncle: "דוד",
    aunt: "דודה",
    "cousin-male": "בן דוד",
    "cousin-female": "בת דודה",
    grandson: "נכד",
    granddaughter: "נכדה",
    nephew: "אחיין",
    niece: "אחיינית",
    "father-in-law": "חם",
    "mother-in-law": "חמות",
    "brother-in-law": "גיס",
    "sister-in-law": "גיסה",
    "son-in-law": "חתן",
    "daughter-in-law": "כלה",
    other: "אחר",
  };

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
  function getInitials(f, l) {
    return (f?.[0] || "") + (l?.[0] || "");
  }

  function pDS(s) {
    if (!s) return null;
    var p = s.split("/");
    if (p.length !== 3) return null;
    return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
  }

  function calculateAge(b, d) {
    var birth = pDS(b);
    if (!birth) return null;
    var end = d ? pDS(d) : new Date();
    if (!end) return null;
    var a = end.getFullYear() - birth.getFullYear();
    var m = end.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && end.getDate() < birth.getDate())) a--;
    return a;
  }

  function formatDate(s) {
    var d = pDS(s);
    if (!d) return s || "";
    return d.toLocaleDateString("he-IL", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function formatDateInput(i) {
    var v = i.value.replace(/[^\d]/g, "");
    if (v.length > 8) v = v.substr(0, 8);
    if (v.length >= 4)
      v = v.substr(0, 2) + "/" + v.substr(2, 2) + "/" + v.substr(4);
    else if (v.length >= 2) v = v.substr(0, 2) + "/" + v.substr(2);
    i.value = v;
  }

  function updateHebrewPreview(dateInputId, previewId, sunsetId) {
    var dateVal = document.getElementById(dateInputId)?.value;
    var previewEl = document.getElementById(previewId);
    if (!previewEl || !dateVal) {
      if (previewEl) previewEl.textContent = "";
      return;
    }
    var beforeSunset = true;
    if (sunsetId) {
      var sunsetEl = document.getElementById(sunsetId);
      if (sunsetEl) beforeSunset = sunsetEl.value === "before";
    }
    var heb = HebrewDate.fromDateString(dateVal, beforeSunset);
    previewEl.textContent = heb ? "🕎 " + heb : "";
  }

  function showToast(m, t) {
    t = t || "success";
    var c = document.getElementById("toastContainer");
    var el = document.createElement("div");
    el.className = "toast " + t;
    el.innerHTML =
      '<span style="font-size:1.2em">' +
      ({ success: "✓", error: "✕", warning: "⚠️" }[t] || "ℹ️") +
      '</span><span style="font-weight:500">' +
      m +
      "</span>";
    c.appendChild(el);
    setTimeout(function () {
      el.style.opacity = "0";
      setTimeout(function () {
        el.remove();
      }, 300);
    }, 3500);
  }

  function openModal(id) {
    document.getElementById(id)?.classList.add("active");
    document.body.style.overflow = "hidden";
  }
  function closeModal(id) {
    document.getElementById(id)?.classList.remove("active");
    document.body.style.overflow = "";
  }

  function switchPage(p) {
    document.querySelectorAll(".page").forEach(function (pg) {
      pg.classList.remove("active");
    });
    document.querySelectorAll(".nav-tab").forEach(function (t) {
      t.classList.remove("active");
    });
    document.getElementById("page-" + p)?.classList.add("active");
    document.querySelector('[data-page="' + p + '"]')?.classList.add("active");
    if (p === "dashboard") renderDashboard();
    if (p === "members") renderMembers();
    if (p === "tree") {
      TreeRenderer.populateRootSelect();
      TreeRenderer.render();
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          TreeRenderer.redrawConnectors();
        });
      });
    }
    if (p === "birthdays") BirthdayCalendar.render();
    if (p === "events") EventsManager.render();
    if (p === "history") {
      HistoryManager.load().then(function () {
        HistoryManager.render();
      });
    }
  }

  async function initAfterLogin() {
    console.log("initAfterLogin called");
    if (!Sharing.canEdit()) document.body.classList.add("viewer-mode");
    else document.body.classList.remove("viewer-mode");
    var treeNameEl = document.getElementById("currentTreeName");
    if (treeNameEl)
      treeNameEl.style.cursor = Sharing.isOwner() ? "pointer" : "default";
    Sharing.listenToTree(function () {
      if (!Sharing.canEdit()) document.body.classList.add("viewer-mode");
      else document.body.classList.remove("viewer-mode");
      var tn = document.getElementById("currentTreeName");
      if (tn) tn.style.cursor = Sharing.isOwner() ? "pointer" : "default";
    });
    FirebaseDB.listenToMembers(function (m) {
      members = m;
      var a = document.querySelector(".nav-tab.active")?.dataset?.page;
      if (a) switchPage(a);
    });
    FirebaseDB.listenToEvents(function (e) {
      EventsManager.setEvents(e);
      var a = document.querySelector(".nav-tab.active")?.dataset?.page;
      if (a === "events") EventsManager.render();
      if (a === "dashboard") EventsManager.renderUpcoming("upcomingEvents");
    });
    members = await FirebaseDB.getMembers();
    await EventsManager.load();
    await HistoryManager.load();
    PushNotifications.init();
    PushNotifications.listenToForegroundMessages();
    renderDashboard();
    showToast("ברוך הבא! 🌳");
  }

  function popFather(cv) {
    var s = document.getElementById("fatherId");
    if (!s) return;
    s.innerHTML = '<option value="">-- ללא --</option>';
    members.forEach(function (m) {
      if (m.id !== editingId && m.gender === "male") {
        var o = document.createElement("option");
        o.value = m.id;
        o.textContent = m.firstName + " " + m.lastName;
        if (cv === m.id) o.selected = true;
        s.appendChild(o);
      }
    });
  }

  function popMother(cv) {
    var s = document.getElementById("motherId");
    if (!s) return;
    s.innerHTML = '<option value="">-- ללא --</option>';
    members.forEach(function (m) {
      if (m.id !== editingId && m.gender === "female") {
        var o = document.createElement("option");
        o.value = m.id;
        o.textContent = m.firstName + " " + m.lastName;
        if (cv === m.id) o.selected = true;
        s.appendChild(o);
      }
    });
  }

  function popSpouse(cv) {
    var s = document.getElementById("spouseId");
    if (!s) return;
    s.innerHTML = '<option value="">--</option>';
    members.forEach(function (m) {
      if (m.id !== editingId) {
        var o = document.createElement("option");
        o.value = m.id;
        o.textContent = m.firstName + " " + m.lastName;
        if (cv === m.id) o.selected = true;
        s.appendChild(o);
      }
    });
  }

  function toggleExtraFields() {
    var x = document.getElementById("extraFields");
    var i = document.getElementById("expandIcon");
    if (x.style.display === "none") {
      x.style.display = "";
      i.classList.add("open");
      popSpouse();
    } else {
      x.style.display = "none";
      i.classList.remove("open");
    }
  }

  function toggleDeathDate() {
    var isDeceased = document.getElementById("status").value === "deceased";
    document.getElementById("deathDateGroup").style.display = isDeceased
      ? ""
      : "none";
    var sunsetGroup = document.getElementById("deathSunsetGroup");
    if (sunsetGroup) sunsetGroup.style.display = isDeceased ? "" : "none";
  }

  function handlePhotoUpload(e) {
    var f = e.target.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      showToast("גדול מדי (מקסימום 5MB)", "error");
      return;
    }
    var reader = new FileReader();
    reader.onload = function (ev) {
      openCropModal(ev.target.result);
    };
    reader.readAsDataURL(f);
    // Reset input so same file can be selected again
    e.target.value = "";
  }

  function openCropModal(imageSrc) {
    pendingImageSrc = imageSrc;
    var cropImage = document.getElementById("cropImage");
    cropImage.src = imageSrc;

    // Destroy previous cropper if exists
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }

    openModal("cropModal");

    // Wait for modal to be visible and image to load
    setTimeout(function () {
      cropImage.onload = function () {
        initCropper();
      };
      // If image already loaded (cached)
      if (cropImage.complete && cropImage.naturalWidth > 0) {
        initCropper();
      }
    }, 100);
  }

  function initCropper() {
    var cropImage = document.getElementById("cropImage");

    if (cropper) {
      cropper.destroy();
      cropper = null;
    }

    cropper = new Cropper(cropImage, {
      aspectRatio: 1,
      viewMode: 1,
      dragMode: "move",
      autoCropArea: 0.85,
      responsive: true,
      restore: false,
      guides: true,
      center: true,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
      minCropBoxWidth: 50,
      minCropBoxHeight: 50,
    });
  }

  function applyCrop() {
    if (!cropper) {
      showToast("אין תמונה לחיתוך", "error");
      return;
    }

    var canvas = cropper.getCroppedCanvas({
      width: 300,
      height: 300,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    });

    if (!canvas) {
      showToast("שגיאה בחיתוך", "error");
      return;
    }

    var compressed = canvas.toDataURL("image/jpeg", 0.7);

    // Update preview in member form
    document.getElementById("photoPreviewImg").src = compressed;
    document.getElementById("photoPreviewImg").style.display = "";
    document.getElementById("photoPlaceholder").style.display = "none";

    // Show crop existing button
    var cropBtn = document.getElementById("cropExistingBtn");
    if (cropBtn) cropBtn.style.display = "";

    // Cleanup
    closeCropModal();
    showToast("✂️ תמונה נחתכה בהצלחה");
  }

  function cancelCrop() {
    closeCropModal();
  }

  function closeCropModal() {
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    pendingImageSrc = null;
    closeModal("cropModal");
  }

  function openCropExisting() {
    var img = document.getElementById("photoPreviewImg");
    if (!img || img.style.display === "none" || !img.src) {
      showToast("אין תמונה לחיתוך", "warning");
      return;
    }
    openCropModal(img.src);
  }

  function cropRotateLeft() {
    if (cropper) cropper.rotate(-90);
  }

  function cropRotateRight() {
    if (cropper) cropper.rotate(90);
  }

  function cropFlipH() {
    if (cropper) {
      var data = cropper.getData();
      cropper.scaleX(data.scaleX === -1 ? 1 : -1);
    }
  }

  function cropFlipV() {
    if (cropper) {
      var data = cropper.getData();
      cropper.scaleY(data.scaleY === -1 ? 1 : -1);
    }
  }

  function cropReset() {
    if (cropper) cropper.reset();
  }

  function openAddModal() {
    editingId = null;
    document.getElementById("modalTitle").innerHTML = "➕ הוספת בן משפחה";
    document.getElementById("memberForm").reset();
    document.getElementById("memberId").value = "";
    document.getElementById("photoPreviewImg").style.display = "none";
    document.getElementById("photoPlaceholder").style.display = "";
    var cropBtn = document.getElementById("cropExistingBtn");
    if (cropBtn) cropBtn.style.display = "none";
    document.getElementById("extraFields").style.display = "none";
    document.getElementById("expandIcon").classList.remove("open");
    document.getElementById("deathDateGroup").style.display = "none";

    var hebPreview = document.getElementById("hebrewDatePreview");
    if (hebPreview) hebPreview.textContent = "";
    var deathHebPreview = document.getElementById("deathHebrewDatePreview");
    if (deathHebPreview) deathHebPreview.textContent = "";
    var birthSunset = document.getElementById("birthSunset");
    if (birthSunset) birthSunset.value = "before";
    var deathSunset = document.getElementById("deathSunset");
    if (deathSunset) deathSunset.value = "before";

    popFather();
    popMother();
    openModal("memberModal");
  }

  function openEditModal(id) {
    var m = members.find(function (x) {
      return x.id === id;
    });
    if (!m) return;
    editingId = id;
    document.getElementById("modalTitle").innerHTML = "✏️ עריכה";
    document.getElementById("memberId").value = m.id;
    document.getElementById("firstName").value = m.firstName || "";
    document.getElementById("lastName").value = m.lastName || "";
    document.getElementById("gender").value = m.gender || "";
    document.getElementById("birthDate").value = m.birthDate || "";

    var birthSunset = document.getElementById("birthSunset");
    if (birthSunset)
      birthSunset.value = m.birthBeforeSunset === false ? "after" : "before";
    updateHebrewPreview("birthDate", "hebrewDatePreview", "birthSunset");

    if (m.photo) {
      document.getElementById("photoPreviewImg").src = m.photo;
      document.getElementById("photoPreviewImg").style.display = "";
      document.getElementById("photoPlaceholder").style.display = "none";
      var cropBtn = document.getElementById("cropExistingBtn");
      if (cropBtn) cropBtn.style.display = "";
    } else {
      document.getElementById("photoPreviewImg").style.display = "none";
      document.getElementById("photoPlaceholder").style.display = "";
      var cropBtn2 = document.getElementById("cropExistingBtn");
      if (cropBtn2) cropBtn2.style.display = "none";
    }

    popFather(m.parentId);
    popMother(m.parentId2);

    var has =
      m.spouseId ||
      m.phone ||
      m.email ||
      m.address ||
      m.occupation ||
      m.birthPlace ||
      m.notes ||
      m.status === "deceased";
    if (has) {
      document.getElementById("extraFields").style.display = "";
      document.getElementById("expandIcon").classList.add("open");
      popSpouse(m.spouseId);
      document.getElementById("spouseId").value = m.spouseId || "";
      document.getElementById("status").value = m.status || "alive";
      document.getElementById("deathDate").value = m.deathDate || "";
      document.getElementById("deathDateGroup").style.display =
        m.status === "deceased" ? "" : "none";
      var deathSunsetGroup = document.getElementById("deathSunsetGroup");
      if (deathSunsetGroup)
        deathSunsetGroup.style.display = m.status === "deceased" ? "" : "none";
      var deathSunset = document.getElementById("deathSunset");
      if (deathSunset)
        deathSunset.value = m.deathBeforeSunset === false ? "after" : "before";
      updateHebrewPreview("deathDate", "deathHebrewDatePreview", "deathSunset");
      document.getElementById("birthPlace").value = m.birthPlace || "";
      document.getElementById("phone").value = m.phone || "";
      document.getElementById("email").value = m.email || "";
      document.getElementById("address").value = m.address || "";
      document.getElementById("occupation").value = m.occupation || "";
      document.getElementById("notes").value = m.notes || "";
    } else {
      document.getElementById("extraFields").style.display = "none";
      document.getElementById("expandIcon").classList.remove("open");
    }
    openModal("memberModal");
  }

  async function saveMember(e) {
    e.preventDefault();

    try {
      var backupData = JSON.stringify({
        members: members,
        events: EventsManager.getAll(),
        timestamp: new Date().toISOString(),
      });
      localStorage.setItem("familyTree_backup", backupData);
      localStorage.setItem("familyTree_backup_time", new Date().toISOString());
    } catch (backupErr) {
      console.log("Backup failed:", backupErr);
    }

    var pi = document.getElementById("photoPreviewImg");
    var photo = pi.style.display !== "none" ? pi.src : "";

    var birthSunsetEl = document.getElementById("birthSunset");
    var birthBeforeSunset = birthSunsetEl
      ? birthSunsetEl.value !== "after"
      : true;
    var deathSunsetEl = document.getElementById("deathSunset");
    var deathBeforeSunset = deathSunsetEl
      ? deathSunsetEl.value !== "after"
      : true;

    var birthDateVal = document.getElementById("birthDate").value.trim();
    var deathDateVal =
      document.getElementById("deathDate")?.value?.trim() || "";

    var hebrewBirthDate = birthDateVal
      ? HebrewDate.fromDateString(birthDateVal, birthBeforeSunset)
      : "";
    var hebrewDeathDate = deathDateVal
      ? HebrewDate.fromDateString(deathDateVal, deathBeforeSunset)
      : "";

    var fatherVal = document.getElementById("fatherId")?.value || null;
    var motherVal = document.getElementById("motherId")?.value || null;

    var extraVisible = document.getElementById("extraFields")?.style.display !== "none";

    var existingMember = editingId ? members.find(function(m) { return m.id === editingId; }) : null;
    
    var d = {
      id: editingId || generateId(),
      firstName: document.getElementById("firstName").value.trim(),
      lastName: document.getElementById("lastName").value.trim(),
      gender: document.getElementById("gender").value,
      relationType: "",
      parentId: fatherVal,
      parentId2: motherVal,
      birthDate: birthDateVal,
      birthBeforeSunset: birthBeforeSunset,
      hebrewBirthDate: hebrewBirthDate,
      photo: photo,
      spouseId: extraVisible ? (document.getElementById("spouseId")?.value || null) : (existingMember?.spouseId || null),
      status: extraVisible ? (document.getElementById("status")?.value || "alive") : (existingMember?.status || "alive"),
      deathDate: extraVisible ? (deathDateVal || null) : (existingMember?.deathDate || null),
      deathBeforeSunset: deathBeforeSunset,
      hebrewDeathDate: extraVisible ? hebrewDeathDate : (existingMember?.hebrewDeathDate || ""),
      birthPlace: extraVisible ? (document.getElementById("birthPlace")?.value?.trim() || "") : (existingMember?.birthPlace || ""),
      phone: extraVisible ? (document.getElementById("phone")?.value?.trim() || "") : (existingMember?.phone || ""),
      email: extraVisible ? (document.getElementById("email")?.value?.trim() || "") : (existingMember?.email || ""),
      address: extraVisible ? (document.getElementById("address")?.value?.trim() || "") : (existingMember?.address || ""),
      occupation: extraVisible ? (document.getElementById("occupation")?.value?.trim() || "") : (existingMember?.occupation || ""),
      notes: extraVisible ? (document.getElementById("notes")?.value?.trim() || "") : (existingMember?.notes || ""),

    if (d.spouseId) {
      var sp = members.find(function (m) {
        return m.id === d.spouseId;
      });
      if (sp && !sp.spouseId) {
        sp.spouseId = d.id;
        await FirebaseDB.saveMember(sp);
      }
    }
    if (editingId) {
      var old = members.find(function (m) {
        return m.id === editingId;
      });
      if (old?.spouseId && old.spouseId !== d.spouseId) {
        var os = members.find(function (m) {
          return m.id === old.spouseId;
        });
        if (os?.spouseId === editingId) {
          os.spouseId = null;
          await FirebaseDB.saveMember(os);
        }
      }
      var idx = members.findIndex(function (m) {
        return m.id === editingId;
      });
      if (idx !== -1) members[idx] = d;
    } else {
      members.push(d);
    }

    await FirebaseDB.saveMember(d);
    closeModal("memberModal");
    showToast(editingId ? "✏️ עודכן" : "🎉 נוסף");
    HistoryManager.log(
      editingId ? "edit" : "add",
      d.firstName + " " + d.lastName
    );
    rCP();
  }

  function confirmDelete(id) {
    var m = members.find(function (x) {
      return x.id === id;
    });
    if (!m) return;
    document.getElementById("confirmTitle").textContent =
      m.firstName + " " + m.lastName;
    document.getElementById("confirmMessage").textContent =
      "למחוק את בן המשפחה?";
    document.getElementById("confirmBtn").onclick = async function () {
      await delMember(id);
      closeModal("confirmModal");
    };
    openModal("confirmModal");
  }

  async function delMember(id) {
    var deleted = members.find(function (m) {
      return m.id === id;
    });
    var delName = deleted ? deleted.firstName + " " + deleted.lastName : "";
    for (var i = 0; i < members.length; i++) {
      var m = members[i];
      var ch = false;
      if (m.parentId === id) {
        m.parentId = null;
        ch = true;
      }
      if (m.parentId2 === id) {
        m.parentId2 = null;
        ch = true;
      }
      if (m.spouseId === id) {
        m.spouseId = null;
        ch = true;
      }
      if (ch) await FirebaseDB.saveMember(m);
    }
    members = members.filter(function (m) {
      return m.id !== id;
    });
    await FirebaseDB.deleteMember(id);
    showToast("נמחק", "warning");
    HistoryManager.log("delete", delName);
    rCP();
  }

  function viewMember(id) {
    var m = members.find(function (x) {
      return x.id === id;
    });
    if (!m) return;
    var age = calculateAge(m.birthDate, m.deathDate);
    var par1 = m.parentId
      ? members.find(function (x) {
          return x.id === m.parentId;
        })
      : null;
    var par2 = m.parentId2
      ? members.find(function (x) {
          return x.id === m.parentId2;
        })
      : null;
    var sp = m.spouseId
      ? members.find(function (x) {
          return x.id === m.spouseId;
        })
      : null;
    var ch = members.filter(function (x) {
      return x.parentId === id || x.parentId2 === id;
    });
    var heb =
      m.hebrewBirthDate ||
      HebrewDate.fromDateString(m.birthDate, m.birthBeforeSunset);
    var hebDeath =
      m.hebrewDeathDate ||
      (m.deathDate
        ? HebrewDate.fromDateString(m.deathDate, m.deathBeforeSunset)
        : "");
    var bg = m.gender === "male" ? "var(--male)" : "var(--female)";

    var h = '<div class="view-header">';
    if (m.photo)
      h += '<div class="view-avatar"><img src="' + m.photo + '"></div>';
    else
      h +=
        '<div class="view-avatar"><div class="initials" style="background:' +
        bg +
        '">' +
        getInitials(m.firstName, m.lastName) +
        "</div></div>";
    h += "<h2>" + m.firstName + " " + m.lastName + "</h2>";
    if (m.status === "deceased")
      h +=
        ' <span class="deceased-badge" style="position:static;display:inline-block">🕯️</span>';
    h += '</div><div class="view-details">';

    var details = [
      { l: "🎂 גיל", v: age !== null ? String(age) : "" },
      { l: "📅 לידה", v: formatDate(m.birthDate) },
      { l: "🕎 עברי", v: heb },
      { l: "📍 מקום לידה", v: m.birthPlace },
      { l: "📞 טלפון", v: m.phone },
      { l: "📧 מייל", v: m.email },
      { l: "📍 כתובת", v: m.address },
      { l: "💼 עיסוק", v: m.occupation },
      { l: "👨 אבא", v: par1 ? par1.firstName + " " + par1.lastName : "" },
      { l: "👩 אמא", v: par2 ? par2.firstName + " " + par2.lastName : "" },
      { l: "💒 בן/בת זוג", v: sp ? sp.firstName + " " + sp.lastName : "" },
    ];

    if (m.status === "deceased") {
      details.push({
        l: "🕯️ פטירה",
        v: m.deathDate ? formatDate(m.deathDate) : "",
      });
      if (hebDeath) details.push({ l: "🕯️ פטירה עברי", v: hebDeath });
    }

    details.forEach(function (d) {
      if (d.v)
        h +=
          '<div class="view-detail"><strong>' +
          d.l +
          "</strong>" +
          d.v +
          "</div>";
    });
    h += "</div>";

    if (ch.length) {
      h +=
        '<div class="view-children"><strong>👶 ילדים (' +
        ch.length +
        "):</strong><div>";
      ch.forEach(function (c) {
        h +=
          "<span class=\"view-child-chip\" onclick=\"App.closeModal('viewModal');App.viewMember('" +
          c.id +
          "')\">" +
          c.firstName +
          "</span>";
      });
      h += "</div></div>";
    }

    if (m.notes)
      h +=
        '<div style="margin-top:12px;padding:10px;background:#FFF8E1;border-radius:8px;font-size:.9em">📝 ' +
        m.notes +
        "</div>";
    h +=
      '<div style="margin-top:18px;display:flex;gap:8px;justify-content:center">';
    if (Sharing.canEdit())
      h +=
        "<button class=\"btn btn-primary btn-sm\" onclick=\"App.closeModal('viewModal');App.openEditModal('" +
        m.id +
        "')\">✏️ עריכה</button>";
    if (Sharing.canDelete())
      h +=
        "<button class=\"btn btn-danger btn-sm\" onclick=\"App.closeModal('viewModal');App.confirmDelete('" +
        m.id +
        "')\">🗑️ מחיקה</button>";
    h += "</div>";

    document.getElementById("viewContent").innerHTML = h;
    openModal("viewModal");
  }

  function renderDashboard() {
    var t = members.length;
    var ml = members.filter(function (m) {
      return m.gender === "male";
    }).length;
    var fm = members.filter(function (m) {
      return m.gender === "female";
    }).length;
    var ages = members
      .filter(function (m) {
        return m.birthDate;
      })
      .map(function (m) {
        return calculateAge(m.birthDate, m.deathDate);
      })
      .filter(function (a) {
        return a !== null;
      });
    var avg = ages.length
      ? Math.round(
          ages.reduce(function (a, b) {
            return a + b;
          }, 0) / ages.length
        )
      : 0;

    document.getElementById("statsBar").innerHTML =
      '<div class="stat-card"><div class="stat-icon" style="background:#E8F5E9;color:#2E7D32">👥</div><div class="stat-info"><h3>' +
      t +
      "</h3><p>בני משפחה</p></div></div>" +
      '<div class="stat-card"><div class="stat-icon" style="background:#E3F2FD;color:#1565C0">👨</div><div class="stat-info"><h3>' +
      ml +
      "</h3><p>גברים</p></div></div>" +
      '<div class="stat-card"><div class="stat-icon" style="background:#FCE4EC;color:#C2185B">👩</div><div class="stat-info"><h3>' +
      fm +
      "</h3><p>נשים</p></div></div>" +
      '<div class="stat-card"><div class="stat-icon" style="background:#FFF3E0;color:#E65100">📊</div><div class="stat-info"><h3>' +
      avg +
      "</h3><p>גיל ממוצע</p></div></div>";

    var rec = members
      .slice()
      .sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      })
      .slice(0, 5);
    var rmEl = document.getElementById("recentMembers");
    if (!rec.length) {
      rmEl.innerHTML =
        '<div class="empty-state"><div class="icon">👥</div><h3>ריק</h3><p>הוסיפו את בן המשפחה הראשון!</p><button class="btn btn-primary btn-sm" onclick="App.openAddModal()">➕ הוספה</button></div>';
    } else {
      rmEl.innerHTML = rec
        .map(function (m) {
          var age = calculateAge(m.birthDate, m.deathDate);
          var bg = m.gender === "male" ? "var(--male)" : "var(--female)";
          return (
            '<div style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;cursor:pointer" onclick="App.viewMember(\'' +
            m.id +
            "')\" onmouseover=\"this.style.background='#f5f5f5'\" onmouseout=\"this.style.background=''\">" +
            '<div style="width:38px;height:38px;border-radius:50%;background:' +
            bg +
            ';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.9em;flex-shrink:0;overflow:hidden">' +
            (m.photo
              ? '<img src="' +
                m.photo +
                '" style="width:100%;height:100%;object-fit:cover">'
              : getInitials(m.firstName, m.lastName)) +
            '</div><div><div style="font-weight:600;font-size:.92em">' +
            m.firstName +
            " " +
            m.lastName +
            "</div>" +
            '<div style="font-size:.8em;color:var(--text-muted)">' +
            (age !== null ? "גיל " + age : "") +
            "</div></div></div>"
          );
        })
        .join("");
    }
    BirthdayCalendar.renderUpcomingWidget("upcomingBirthdays");
  }

  function renderMembers() {
    var q = (document.getElementById("searchInput")?.value || "").toLowerCase();
    var f = members;
    if (q)
      f = members.filter(function (m) {
        return (m.firstName + " " + m.lastName).toLowerCase().indexOf(q) !== -1;
      });
    var g = document.getElementById("membersGrid");
    if (!f.length) {
      g.innerHTML =
        '<div class="empty-state" style="grid-column:1/-1"><div class="icon">👥</div><h3>' +
        (q ? "לא נמצאו תוצאות" : "עדיין אין בני משפחה") +
        "</h3><p>" +
        (q ? "נסו חיפוש אחר" : 'לחצו על "הוספה" כדי להתחיל') +
        "</p></div>";
      return;
    }
    g.innerHTML = f
      .map(function (m) {
        var age = calculateAge(m.birthDate, m.deathDate);
        var bg = m.gender === "male" ? "var(--male)" : "var(--female)";

        var parentsStr = "";
        var par1 = m.parentId
          ? members.find(function (x) {
              return x.id === m.parentId;
            })
          : null;
        var par2 = m.parentId2
          ? members.find(function (x) {
              return x.id === m.parentId2;
            })
          : null;
        if (par1 && par2) {
          parentsStr = par1.firstName + " ו" + par2.firstName;
        } else if (par1) {
          parentsStr = par1.firstName;
        } else if (par2) {
          parentsStr = par2.firstName;
        }

        var hebDate =
          m.hebrewBirthDate ||
          HebrewDate.fromDateString(m.birthDate, m.birthBeforeSunset);

        return (
          '<div class="member-card ' +
          m.gender +
          (m.status === "deceased" ? " deceased" : "") +
          '">' +
          (m.status === "deceased"
            ? '<div class="deceased-badge">🕯️</div>'
            : "") +
          '<div class="member-card-header"><div class="member-avatar">' +
          (m.photo
            ? '<img src="' + m.photo + '">'
            : '<div class="initials" style="background:' +
              bg +
              '">' +
              getInitials(m.firstName, m.lastName) +
              "</div>") +
          '</div><div><div class="member-name">' +
          m.firstName +
          " " +
          m.lastName +
          "</div></div></div>" +
          '<div class="member-details">' +
          (age !== null
            ? '<div class="member-detail">🎂 ' + age + "</div>"
            : "") +
          (m.birthDate
            ? '<div class="member-detail">📅 ' +
              formatDate(m.birthDate) +
              "</div>"
            : "") +
          (hebDate
            ? '<div class="member-detail">🕎 ' + hebDate + "</div>"
            : "") +
          (parentsStr
            ? '<div class="member-detail">👨‍👩‍👦 ' + parentsStr + "</div>"
            : "") +
          '</div><div class="member-actions">' +
          '<button class="btn btn-outline btn-sm" onclick="App.viewMember(\'' +
          m.id +
          "')\">👁️</button>" +
          '<button class="btn btn-primary btn-sm" onclick="App.openEditModal(\'' +
          m.id +
          "')\">✏️</button>" +
          '<button class="btn btn-danger btn-sm" onclick="App.confirmDelete(\'' +
          m.id +
          "')\">🗑️</button>" +
          "</div></div>"
        );
      })
      .join("");
  }

  function filterMembers() {
    renderMembers();
  }

  function exportData() {
    var d = { members: members, events: EventsManager.getAll() };
    var b = new Blob([JSON.stringify(d, null, 2)], {
      type: "application/json",
    });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = "family-tree.json";
    a.click();
    showToast("📤 יוצא");
  }

  async function importData(e) {
    var f = e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = async function (ev) {
      try {
        var d = JSON.parse(ev.target.result);
        if (d.members) {
          members = d.members;
          await FirebaseDB.saveAllMembers(members);
        }
        if (d.events) {
          for (var i = 0; i < d.events.length; i++)
            await FirebaseDB.saveEvent(d.events[i]);
          EventsManager.setEvents(d.events);
        }
        showToast("📥 יובא בהצלחה");
        rCP();
      } catch (err) {
        showToast("שגיאה בייבוא", "error");
      }
    };
    r.readAsText(f);
    e.target.value = "";
  }

  function restoreBackup() {
    var backup = localStorage.getItem("familyTree_backup");
    if (!backup) {
      showToast("אין גיבוי זמין", "warning");
      return;
    }
    var time = localStorage.getItem("familyTree_backup_time");
    var timeStr = time ? new Date(time).toLocaleString("he-IL") : "לא ידוע";
    if (!confirm("לשחזר גיבוי מ-" + timeStr + "?")) return;
    try {
      var data = JSON.parse(backup);
      if (data.members) {
        members = data.members;
        FirebaseDB.saveAllMembers(members);
      }
      showToast("שוחזר בהצלחה! 🔄");
      rCP();
    } catch (e) {
      showToast("שגיאה בשחזור", "error");
    }
  }

  function editTreeName() {
    if (!Sharing.isOwner()) return;
    var currentName = Sharing.getTreeInfo()?.name || "";
    document.getElementById("treeNameInput").value = currentName;
    openModal("treeNameModal");
  }

  async function saveTreeName() {
    if (!Sharing.isOwner()) return;
    var newName = document.getElementById("treeNameInput").value.trim();
    if (!newName) {
      showToast("יש להזין שם", "warning");
      return;
    }
    await Sharing.renameTree(newName);
    document.getElementById("currentTreeName").textContent = newName;
    closeModal("treeNameModal");
    showToast("שם העץ עודכן ✅");
  }

  function toggleDarkMode() {
    document.body.classList.toggle("dark-mode");
    var isDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("darkMode", isDark ? "1" : "0");
    var btn = document.getElementById("darkModeBtn");
    if (btn) {
      btn.textContent = isDark ? "☀️" : "🌙";
      btn.title = isDark ? "מצב בהיר" : "מצב כהה";
    }
  }

  (function () {
    if (localStorage.getItem("darkMode") === "1") {
      document.body.classList.add("dark-mode");
      var btn = document.getElementById("darkModeBtn");
      if (btn) {
        btn.textContent = "☀️";
        btn.title = "מצב בהיר";
      }
    }
  })();

  (function () {
    if (localStorage.getItem("darkMode") === "1") {
      document.body.classList.add("dark-mode");
      var btn = document.getElementById("darkModeBtn");
      if (btn) btn.textContent = "☀️";
    }
  })();

  function rCP() {
    var a =
      document.querySelector(".nav-tab.active")?.dataset?.page || "dashboard";
    switchPage(a);
  }

  function refreshTree() {
    TreeRenderer.populateRootSelect();
    TreeRenderer.render();
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay.active").forEach(function (m) {
        m.classList.remove("active");
      });
      document.body.style.overflow = "";
    }
  });

  document.querySelectorAll(".modal-overlay").forEach(function (ov) {
    ov.addEventListener("click", function (e) {
      if (e.target === this) {
        this.classList.remove("active");
        document.body.style.overflow = "";
      }
    });
  });

  return {
    initAfterLogin: initAfterLogin,
    switchPage: switchPage,
    openAddModal: openAddModal,
    openEditModal: openEditModal,
    saveMember: saveMember,
    viewMember: viewMember,
    confirmDelete: confirmDelete,
    closeModal: closeModal,
    openModal: openModal,
    filterMembers: filterMembers,
    showToast: showToast,
    handlePhotoUpload: handlePhotoUpload,
    formatDateInput: formatDateInput,
    toggleExtraFields: toggleExtraFields,
    toggleDeathDate: toggleDeathDate,
    exportData: exportData,
    importData: importData,
    refreshTree: refreshTree,
    updateHebrewPreview: updateHebrewPreview,
    editTreeName: editTreeName,
    saveTreeName: saveTreeName,
    restoreBackup: restoreBackup,
    toggleDarkMode: toggleDarkMode,
    // Crop functions
    applyCrop: applyCrop,
    cancelCrop: cancelCrop,
    openCropExisting: openCropExisting,
    cropRotateLeft: cropRotateLeft,
    cropRotateRight: cropRotateRight,
    cropFlipH: cropFlipH,
    cropFlipV: cropFlipV,
    cropReset: cropReset,
    getMembers: function () {
      return members;
    },
    getInitials: getInitials,
    calculateAge: calculateAge,
    generateId: generateId,
    RELATION_LABELS: RELATION_LABELS,
  };
})();
