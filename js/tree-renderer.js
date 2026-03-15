const TreeRenderer = (() => {
  var lv = 3;
  var currentZoom = 1;
  var MIN_ZOOM = 0.2;
  var MAX_ZOOM = 2;
  var ZOOM_STEP = 0.15;

  // Connector config
  var LINE_COLOR = "#4CAF50";
  var LINE_WIDTH = 2;
  var V_GAP = 30; // vertical gap between parent bottom and children top
  var CORNER_R = 8; // corner radius
  var H_PAD = 10; // horizontal padding per branch
  var GROUP_GAP = 35; // gap between family groups

  function setLevel(n, el) {
    lv = n;
    document.querySelectorAll(".level-btn").forEach(function (b) {
      b.classList.remove("active");
    });
    if (el) el.classList.add("active");
    render();
  }

  function populateRootSelect() {
    var s = document.getElementById("treeRoot");
    if (!s) return;
    var ms = App.getMembers(),
      cv = s.value;
    s.innerHTML = '<option value="">-- בחרו שורש --</option>';
    ms.forEach(function (m) {
      var o = document.createElement("option");
      o.value = m.id;
      o.textContent = m.firstName + " " + m.lastName;
      s.appendChild(o);
    });
    if (
      cv &&
      ms.find(function (m) {
        return m.id === cv;
      })
    )
      s.value = cv;
    else s.value = ms.length ? ms[0].id : "";
  }

  function getPersonEmoji(gender, birthDate, deathDate) {
    var age = App.calculateAge(birthDate, deathDate);
    if (age === null) return gender === "male" ? "👨" : "👩";
    if (gender === "male") {
      if (age < 4) return "👶";
      if (age < 13) return "👦";
      if (age < 60) return "👨";
      return "👴";
    } else {
      if (age < 4) return "👶";
      if (age < 13) return "👧";
      if (age < 60) return "👩";
      return "👵";
    }
  }

  function formatBirthDate(dateStr) {
    if (!dateStr) return "";
    var p = dateStr.split("/");
    return p.length !== 3 ? dateStr : p[0] + "." + p[1] + "." + p[2];
  }

  function isChildOf(person, parentIds) {
    if (!person) return false;
    for (var i = 0; i < parentIds.length; i++) {
      if (person.parentId === parentIds[i] || person.parentId2 === parentIds[i])
        return true;
    }
    return false;
  }

  // Zoom
  function zoomIn() {
    currentZoom = Math.min(MAX_ZOOM, currentZoom + ZOOM_STEP);
    applyZoom();
  }
  function zoomOut() {
    currentZoom = Math.max(MIN_ZOOM, currentZoom - ZOOM_STEP);
    applyZoom();
  }
  function zoomReset() {
    currentZoom = 1;
    applyZoom();
  }
  function zoomFit() {
    var c = document.getElementById("treeContainer"),
      w = document.getElementById("treeWrapper");
    if (!c || !w) return;

    // שלב 1: איפוס זום ו-transform-origin
    currentZoom = 1;
    w.style.transform = "scale(1)";
    w.style.transformOrigin = "top right";

    requestAnimationFrame(function () {
      // שלב 2: מדידת הגודל האמיתי של התוכן
      var wW = w.scrollWidth,
        wH = w.scrollHeight;
      var cW = c.clientWidth,
        cH = c.clientHeight;
      if (!wW || !wH) return;

      // שלב 3: חישוב זום
      currentZoom = Math.max(
        MIN_ZOOM,
        Math.min((cW - 20) / wW, (cH - 20) / wH, 1)
      );

      // שלב 4: שינוי ל-top right כי אנחנו RTL
      w.style.transformOrigin = "top right";
      w.style.transform = "scale(" + currentZoom + ")";

      var d = document.getElementById("zoomLevelDisplay");
      if (d) d.textContent = Math.round(currentZoom * 100) + "%";

      drawAllConnectors();

      // שלב 5: מרכוז אחרי שהדפדפן מעדכן
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          // חישוב מרכוז אופקי
          var scaledW = wW * currentZoom;
          var scaledH = wH * currentZoom;

          if (scaledW < cW) {
            // העץ קטן מהחלון - מרכז
            c.scrollLeft = 0;
          } else {
            c.scrollLeft = Math.round((scaledW - cW) / 2);
          }

          // מרכוז אנכי
          if (scaledH < cH) {
            c.scrollTop = 0;
          } else {
            c.scrollTop = Math.round((scaledH - cH) / 2);
          }
        });
      });
    });
  }
  function applyZoom() {
    var w = document.getElementById("treeWrapper");
    var d = document.getElementById("zoomLevelDisplay");
    if (w) {
      w.style.transform = "scale(" + currentZoom + ")";
      w.style.transformOrigin = "top right";
    }
    if (d) d.textContent = Math.round(currentZoom * 100) + "%";
  }

  // Export
  function toggleExportMenu() {
    var m = document.getElementById("exportDropdownContent");
    if (m) {
      m.classList.toggle("show");
      if (m.classList.contains("show")) {
        setTimeout(function () {
          document.addEventListener("click", function cl(e) {
            if (!e.target.closest(".export-dropdown")) {
              m.classList.remove("show");
              document.removeEventListener("click", cl);
            }
          });
        }, 10);
      }
    }
  }
  function loadLib(url, cb) {
    if (url.indexOf("html2canvas") >= 0 && typeof html2canvas !== "undefined") {
      cb();
      return;
    }
    if (url.indexOf("jspdf") >= 0 && typeof jspdf !== "undefined") {
      cb();
      return;
    }
    var s = document.createElement("script");
    s.src = url;
    s.onload = cb;
    document.head.appendChild(s);
  }
  function exportAsImage() {
    var m = document.getElementById("exportDropdownContent");
    if (m) m.classList.remove("show");
    var w = document.getElementById("treeWrapper");
    if (!w) return;
    App.showToast("מכין תמונה...", "warning");
    var sz = currentZoom;
    w.style.transform = "scale(1)";
    requestAnimationFrame(function () {
      drawAllConnectors();
      requestAnimationFrame(function () {
        loadLib(
          "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
          function () {
            html2canvas(w, {
              backgroundColor: "#FAFFF5",
              scale: 2,
              useCORS: true,
              logging: false,
              width: w.scrollWidth,
              height: w.scrollHeight,
            })
              .then(function (canvas) {
                var a = document.createElement("a");
                a.download = "family-tree.png";
                a.href = canvas.toDataURL("image/png");
                a.click();
                App.showToast("התמונה הורדה! 🖼️");
                currentZoom = sz;
                applyZoom();
              })
              .catch(function (err) {
                console.error(err);
                App.showToast("שגיאה", "error");
                currentZoom = sz;
                applyZoom();
              });
          }
        );
      });
    });
  }
  function exportAsPDF() {
    var m = document.getElementById("exportDropdownContent");
    if (m) m.classList.remove("show");
    var w = document.getElementById("treeWrapper");
    if (!w) return;
    App.showToast("מכין PDF...", "warning");
    var sz = currentZoom;
    w.style.transform = "scale(1)";
    requestAnimationFrame(function () {
      drawAllConnectors();
      requestAnimationFrame(function () {
        loadLib(
          "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
          function () {
            loadLib(
              "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
              function () {
                html2canvas(w, {
                  backgroundColor: "#FAFFF5",
                  scale: 2,
                  useCORS: true,
                  logging: false,
                  width: w.scrollWidth,
                  height: w.scrollHeight,
                })
                  .then(function (canvas) {
                    var img = canvas.toDataURL("image/png");
                    var o =
                      canvas.width > canvas.height ? "landscape" : "portrait";
                    var pdf = new jspdf.jsPDF({
                      orientation: o,
                      unit: "mm",
                      format: "a4",
                    });
                    var pW = pdf.internal.pageSize.getWidth() - 20,
                      pH = pdf.internal.pageSize.getHeight() - 20;
                    var r = Math.min(pW / canvas.width, pH / canvas.height);
                    pdf.addImage(
                      img,
                      "PNG",
                      10 + (pW - canvas.width * r) / 2,
                      10 + (pH - canvas.height * r) / 2,
                      canvas.width * r,
                      canvas.height * r
                    );
                    pdf.save("family-tree.pdf");
                    App.showToast("PDF הורד! 📄");
                    currentZoom = sz;
                    applyZoom();
                  })
                  .catch(function (err) {
                    console.error(err);
                    App.showToast("שגיאה", "error");
                    currentZoom = sz;
                    applyZoom();
                  });
              }
            );
          }
        );
      });
    });
  }

  // =============================================
  // RENDER - Build HTML structure
  // =============================================
  function render() {
    var w = document.getElementById("treeWrapper");
    if (!w) return;
    var rid = document.getElementById("treeRoot")?.value;
    var sd = document.getElementById("showDivorced")?.checked ?? true;
    var sdc = document.getElementById("showDeceased")?.checked ?? true;
    var ms = App.getMembers();

    if (!rid || !ms.length) {
      w.innerHTML =
        '<div class="empty-state"><div class="icon">🌴</div><h3>בחרו שורש לעץ</h3></div>';
      return;
    }
    var root = ms.find(function (m) {
      return m.id === rid;
    });
    if (!root) return;
    var vis = {};

    function build(person, level, parentIds) {
      if (!person || level > lv || vis[person.id]) return "";
      vis[person.id] = true;
      if (person.status === "deceased" && !sdc) return "";

      var spouses = [];
      ms.forEach(function (m) {
        if (vis[m.id]) return;
        if (m.spouseId === person.id || person.spouseId === m.id) {
          var ex = m.isExSpouse || m.relationType === "ex-spouse";
          if (ex && !sd) return;
          if (m.status === "deceased" && !sdc) return;
          spouses.push({ member: m, isEx: ex });
        }
      });

      var allParentIds = [person.id];
      spouses.forEach(function (sp) {
        allParentIds.push(sp.member.id);
      });

      var children = ms.filter(function (c) {
        if (vis[c.id]) return false;
        if (c.status === "deceased" && !sdc) return false;
        return (
          allParentIds.indexOf(c.parentId) !== -1 ||
          (c.parentId2 && allParentIds.indexOf(c.parentId2) !== -1)
        );
      });

      // מיון ילדים לפי גיל - בכור בימין (ראשון במערך)
      children.sort(function (a, b) {
        var da = a.birthDate ? a.birthDate.split("/") : null;
        var db = b.birthDate ? b.birthDate.split("/") : null;
        var dateA =
          da && da.length === 3
            ? new Date(parseInt(da[2]), parseInt(da[1]) - 1, parseInt(da[0]))
            : new Date(9999, 0, 1);
        var dateB =
          db && db.length === 3
            ? new Date(parseInt(db[2]), parseInt(db[1]) - 1, parseInt(db[0]))
            : new Date(9999, 0, 1);
        return dateA - dateB;
      });

      var childGroups = [];
      var childGroups = [];
      spouses.forEach(function (sp) {
        var spCh = children.filter(function (c) {
          var pp = [person.id, sp.member.id];
          return (
            (pp.indexOf(c.parentId) !== -1 && pp.indexOf(c.parentId2) !== -1) ||
            (pp.indexOf(c.parentId) !== -1 && !c.parentId2) ||
            (pp.indexOf(c.parentId2) !== -1 && !c.parentId)
          );
        });
        if (spCh.length > 0) childGroups.push({ children: spCh });
      });
      var assigned = {};
      childGroups.forEach(function (g) {
        g.children.forEach(function (c) {
          assigned[c.id] = true;
        });
      });
      var solo = children.filter(function (c) {
        return !assigned[c.id];
      });

      var allCh = [];
      var gIdx = 0;
      childGroups.forEach(function (g) {
        g.children.forEach(function (c) {
          allCh.push({ child: c, group: gIdx });
        });
        gIdx++;
      });
      solo.forEach(function (c) {
        allCh.push({ child: c, group: gIdx });
      });

      var h = '<div class="tf-tree">';

      // Node content (couple or single person)
      h += '<div class="tf-nc">';
      h += buildCouple(person, spouses, parentIds);
      h += "</div>";

      // Children
      if (allCh.length > 0 && level < lv) {
        // Connector area - this DIV will be sized by JS to hold the lines
        h +=
          '<div class="tf-connector-area" data-children-count="' +
          allCh.length +
          '"></div>';

        // Children row
        h += '<div class="tf-children-row">';
        var prevGroup = -1;
        allCh.forEach(function (entry) {
          if (prevGroup !== -1 && entry.group !== prevGroup) {
            h += '<div class="tf-group-gap"></div>';
          }
          prevGroup = entry.group;
          if (!vis[entry.child.id]) {
            h += '<div class="tf-branch">';
            h += build(entry.child, level + 1, allParentIds);
            h += "</div>";
          }
        });
        h += "</div>";
      }

      h += "</div>";
      return h;
    }

    function buildCouple(person, spouses, parentIds) {
      var h = "";
      if (spouses.length === 0) {
        h +=
          '<div class="tf-couple-member" data-person-id="' +
          person.id +
          '">' +
          nodeHTML(person) +
          "</div>";
      } else {
        spouses.forEach(function (sp, idx) {
          vis[sp.member.id] = true;
          var lp, rp;
          if (person.gender === "male") {
            lp = sp.member;
            rp = person;
          } else {
            lp = person;
            rp = sp.member;
          }

          var personIsChild =
            parentIds && parentIds.length > 0 && isChildOf(person, parentIds);
          var spouseIsChild =
            parentIds &&
            parentIds.length > 0 &&
            isChildOf(sp.member, parentIds);
          var anchorId = personIsChild
            ? person.id
            : spouseIsChild
            ? sp.member.id
            : person.id;

          if (idx > 0) h += '<div style="width:10px"></div>';
          h += '<div class="tf-couple">';
          h +=
            '<div class="tf-couple-member" data-person-id="' +
            lp.id +
            '" ' +
            (lp.id === anchorId ? 'data-is-anchor="1"' : "") +
            ">" +
            nodeHTML(lp) +
            "</div>";
          h +=
            '<div class="tf-couple-link"><div class="tf-couple-line' +
            (sp.isEx ? " tf-ex" : "") +
            '"></div>';
          h +=
            '<span class="tf-couple-heart">' +
            (sp.isEx ? "💔" : "❤️") +
            "</span></div>";
          h +=
            '<div class="tf-couple-member" data-person-id="' +
            rp.id +
            '" ' +
            (rp.id === anchorId ? 'data-is-anchor="1"' : "") +
            ">" +
            nodeHTML(rp) +
            "</div>";
          h += "</div>";
        });
      }
      return h;
    }

    function nodeHTML(p) {
      var age = App.calculateAge(p.birthDate, p.deathDate);
      var gc = p.gender === "male" ? "male" : "female";
      if (p.status === "deceased") gc += " deceased";
      var bg = p.gender === "male" ? "var(--male)" : "var(--female)";
      var cm =
        typeof DragConnect !== "undefined" && DragConnect.isActive
          ? DragConnect.isActive()
          : false;
      var emoji = getPersonEmoji(p.gender, p.birthDate, p.deathDate);

      var html =
        '<div class="tf-person ' +
        gc +
        (cm ? " connectable" : "") +
        '" data-member-id="' +
        p.id +
        '" ' +
        (cm ? "" : "onclick=\"App.viewMember('" + p.id + "')\"") +
        ">";
      html += '<div class="tf-photo">';
      html += p.photo
        ? '<img src="' + p.photo + '">'
        : '<div class="tf-emoji" style="background:' +
          bg +
          '">' +
          emoji +
          "</div>";
      html += "</div>";
      html +=
        '<div class="tf-name">' + p.firstName + " " + p.lastName + "</div>";
      if (p.birthDate)
        html +=
          '<div class="tf-date">' + formatBirthDate(p.birthDate) + "</div>";
      if (age !== null)
        html +=
          '<div class="tf-age">' +
          (p.status === "deceased" ? "🕯️ " : "") +
          "גיל " +
          age +
          "</div>";
      else if (p.status === "deceased") html += '<div class="tf-age">🕯️</div>';
      html += "</div>";
      return html;
    }

    w.innerHTML = build(root, 1, []);

    // Draw connectors after DOM layout
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        drawAllConnectors();
      });
    });

    applyZoom();

    if (
      typeof DragConnect !== "undefined" &&
      DragConnect.isActive &&
      DragConnect.isActive()
    ) {
      DragConnect.toggleMode();
      DragConnect.toggleMode();
    }
  }

  // =============================================
  // DRAW CONNECTORS - Using absolutely positioned DIVs
  // =============================================
  function drawAllConnectors() {
    // Remove old connector lines
    document.querySelectorAll(".tf-line").forEach(function (el) {
      el.remove();
    });

    // For each tf-tree that has a connector area
    var areas = document.querySelectorAll(".tf-connector-area");
    areas.forEach(function (area) {
      drawConnectorForArea(area);
    });
  }

  function drawConnectorForArea(area) {
    var treeEl = area.parentElement;
    var ncEl = treeEl.querySelector(":scope > .tf-nc");
    var childrenRow = treeEl.querySelector(":scope > .tf-children-row");
    if (!ncEl || !childrenRow) return;

    var branches = [];
    for (var i = 0; i < childrenRow.children.length; i++) {
      if (childrenRow.children[i].classList.contains("tf-branch")) {
        branches.push(childrenRow.children[i]);
      }
    }
    if (branches.length === 0) return;

    var treeRect = treeEl.getBoundingClientRect();
    var parentBottom = getParentBottom(ncEl, treeRect);
    // סעיף 1: חישוב נקודות חיבור ספציפיות לכל ילד
    var ms = App.getMembers();
    var perChildParentX = branches.map(function (branch) {
      var personEl = branch.querySelector(".tf-person[data-member-id]");
      if (!personEl) return null;
      var specificX = getParentXForChild(ncEl, personEl, ms);
      return specificX;
    });
    var childTops = branches.map(function (branch) {
      return getChildTop(branch, treeRect);
    });

    area.style.height = V_GAP + "px";
    area.style.position = "relative";

    var areaRect = area.getBoundingClientRect();
    var defaultParentX = parentBottom.x - areaRect.left;
    var childXs = childTops.map(function (ct) {
      return ct.x - areaRect.left;
    });
    var midY = Math.round(V_GAP / 2);

    // סעיף 1: חשב נקודת מוצא ייחודית לכל ילד
    var ms = App.getMembers();
    var childParentXs = branches.map(function (branch) {
      // מצא את ה-member של הילד
      var personEl = branch.querySelector(".tf-person[data-member-id]");
      if (!personEl) return null;
      var memberId = personEl.getAttribute("data-member-id");
      var childMember = ms.find(function (m) {
        return m.id === memberId;
      });
      if (!childMember) return null;
      var specificX = getParentXForChild(ncEl, childMember, ms);
      return specificX !== null ? specificX - areaRect.left : null;
    });

    // בדוק אם כל הילדים מחוברים לאותו מקום
    var allSameParent = true;
    var firstParentX = null;
    for (var i = 0; i < childParentXs.length; i++) {
      var px = childParentXs[i] !== null ? childParentXs[i] : defaultParentX;
      if (firstParentX === null) firstParentX = px;
      else if (Math.abs(px - firstParentX) > 3) {
        allSameParent = false;
        break;
      }
    }

    // ציור SVG
    var oldLines = area.querySelectorAll(".tf-line");
    oldLines.forEach(function (l) {
      l.remove();
    });

    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "tf-line");
    svg.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;overflow:visible;";
    var areaW = area.offsetWidth;
    svg.setAttribute("width", areaW);
    svg.setAttribute("height", V_GAP);
    svg.setAttribute("viewBox", "0 0 " + areaW + " " + V_GAP);

    var paths = "";
    var r = CORNER_R;

    if (allSameParent) {
      // כל הילדים מאותו הורה - ציור כרגיל
      var parentX = firstParentX !== null ? firstParentX : defaultParentX;

      if (childXs.length === 1) {
        var cx = childXs[0];
        if (Math.abs(cx - parentX) < 3) {
          paths += svgLine(parentX, 0, parentX, V_GAP);
        } else {
          paths += svgPathLShape(parentX, 0, cx, V_GAP, midY, r);
        }
      } else {
        var leftX = Math.min.apply(null, childXs);
        var rightX = Math.max.apply(null, childXs);
        var barLeft = Math.min(leftX, parentX);
        var barRight = Math.max(rightX, parentX);

        paths += svgLine(parentX, 0, parentX, midY);
        paths += svgLine(barLeft, midY, barRight, midY);
        childXs.forEach(function (cx) {
          paths += svgLine(cx, midY, cx, V_GAP);
        });
      }
    } else {
      // סעיף 1: ילדים שונים מחוברים להורים שונים
      // קיבוץ לפי נקודת הורה
      var groups = {};
      for (var i = 0; i < branches.length; i++) {
        var px = childParentXs[i] !== null ? childParentXs[i] : defaultParentX;
        var key = Math.round(px);
        if (!groups[key]) groups[key] = { parentX: px, childXs: [] };
        groups[key].childXs.push(childXs[i]);
      }

      var groupKeys = Object.keys(groups);
      for (var g = 0; g < groupKeys.length; g++) {
        var grp = groups[groupKeys[g]];
        var gpx = grp.parentX;

        // קו אנכי מההורה למטה
        paths += svgLine(gpx, 0, gpx, midY);

        if (grp.childXs.length === 1) {
          var cx = grp.childXs[0];
          if (Math.abs(cx - gpx) < 3) {
            paths += svgLine(cx, midY, cx, V_GAP);
          } else {
            paths += svgLine(Math.min(gpx, cx), midY, Math.max(gpx, cx), midY);
            paths += svgLine(cx, midY, cx, V_GAP);
          }
        } else {
          var gLeftX = Math.min.apply(null, grp.childXs);
          var gRightX = Math.max.apply(null, grp.childXs);
          var gBarLeft = Math.min(gLeftX, gpx);
          var gBarRight = Math.max(gRightX, gpx);
          paths += svgLine(gBarLeft, midY, gBarRight, midY);
          grp.childXs.forEach(function (cx) {
            paths += svgLine(cx, midY, cx, V_GAP);
          });
        }
      }
    }

    svg.innerHTML = paths;
    area.appendChild(svg);
  }

  function getParentBottom(ncEl, treeRect) {
    var couple = ncEl.querySelector(".tf-couple");
    var el;
    if (couple) {
      el = couple;
    } else {
      el = ncEl.querySelector(".tf-person");
    }
    if (!el) el = ncEl;
    var r = el.getBoundingClientRect();
    return {
      x: r.left + r.width / 2,
      y: r.bottom,
    };
  }

  // סעיף 1: מציאת X ספציפי להורה ביולוגי של ילד
  function getParentXForChild(ncEl, childPersonEl, ms) {
    var couple = ncEl.querySelector(".tf-couple");
    if (!couple) return null; // אדם בודד - ברירת מחדל

    var memberId = childPersonEl.getAttribute("data-member-id");
    if (!memberId) return null;
    var childMember = null;
    for (var i = 0; i < ms.length; i++) {
      if (ms[i].id === memberId) {
        childMember = ms[i];
        break;
      }
    }
    if (!childMember) return null;

    // אם יש שני הורים - חיבור לאמצע (ברירת מחדל)
    if (childMember.parentId && childMember.parentId2) return null;

    // רק הורה אחד - חיבור ישירות אליו
    var singleParentId = childMember.parentId || childMember.parentId2;
    if (!singleParentId) return null;

    var parentEl = couple.querySelector(
      '.tf-couple-member[data-person-id="' + singleParentId + '"] .tf-person'
    );
    if (parentEl) {
      var pr = parentEl.getBoundingClientRect();
      return pr.left + pr.width / 2;
    }
    return null;
  }

  // חישוב נקודת חיבור ספציפית לילד - אם יש לו רק הורה אחד, מתחבר אליו
  function getParentXForChild(ncEl, childMember, ms) {
    var couple = ncEl.querySelector(".tf-couple");
    if (!couple) return null; // אדם בודד - ברירת מחדל

    // בדיקה: לילד יש שני הורים או רק אחד?
    var hasParent1 = childMember.parentId;
    var hasParent2 = childMember.parentId2;

    if (hasParent1 && hasParent2) {
      return null; // שני הורים - חיבור לאמצע הזוג (ברירת מחדל)
    }

    // רק הורה אחד - מצא את האלמנט שלו בזוג
    var singleParentId = hasParent1 || hasParent2;
    if (!singleParentId) return null;

    var parentEl = couple.querySelector(
      '.tf-couple-member[data-person-id="' + singleParentId + '"] .tf-person'
    );
    if (parentEl) {
      var pr = parentEl.getBoundingClientRect();
      return pr.left + pr.width / 2;
    }
    return null;
  }

  function getChildTop(branch, treeRect) {
    // Look for anchor member in couple
    var anchorMember = branch.querySelector(
      '.tf-couple-member[data-is-anchor="1"]'
    );
    var el = null;

    if (anchorMember) {
      el = anchorMember.querySelector(".tf-person");
    }

    if (!el) {
      // Single person (no couple)
      var singleMember = branch.querySelector(
        ":scope > .tf-tree > .tf-nc > .tf-couple-member"
      );
      if (singleMember) {
        el = singleMember.querySelector(".tf-person");
      }
    }

    if (!el) {
      el = branch.querySelector(".tf-person");
    }
    if (!el) el = branch;

    var r = el.getBoundingClientRect();
    return {
      x: r.left + r.width / 2,
      y: r.top,
    };
  }

  function addLine(parent, x, y, w, h, color, radius) {
    var d = document.createElement("div");
    d.className = "tf-line";
    d.style.cssText =
      "position:absolute;" +
      "left:" +
      Math.round(x) +
      "px;" +
      "top:" +
      Math.round(y) +
      "px;" +
      "width:" +
      Math.round(Math.max(w, LINE_WIDTH)) +
      "px;" +
      "height:" +
      Math.round(Math.max(h, LINE_WIDTH)) +
      "px;" +
      "background:" +
      color +
      ";" +
      "border-radius:" +
      (radius || 0) +
      "px;" +
      "pointer-events:none;z-index:1;";
    parent.appendChild(d);
  }

  function addRoundedCorners(area, parentX, childXs, midY, perChildParentX) {
    var oldLines = area.querySelectorAll(".tf-line");
    oldLines.forEach(function (l) {
      l.remove();
    });

    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "tf-line");
    svg.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;overflow:visible;";
    var areaW = area.offsetWidth;
    svg.setAttribute("width", areaW);
    svg.setAttribute("height", V_GAP);
    svg.setAttribute("viewBox", "0 0 " + areaW + " " + V_GAP);

    var paths = "";
    var r = CORNER_R;

    // סעיף 1: בדוק אם יש ילדים עם הורה ספציפי
    var hasSpecificParent = false;
    if (perChildParentX) {
      for (var i = 0; i < perChildParentX.length; i++) {
        if (perChildParentX[i] !== null) {
          hasSpecificParent = true;
          break;
        }
      }
    }

    if (!hasSpecificParent) {
      // התנהגות רגילה - כל הילדים מאותו מקור
      if (childXs.length === 1) {
        var cx = childXs[0];
        if (Math.abs(cx - parentX) < 3) {
          paths += svgLine(parentX, 0, parentX, V_GAP);
        } else {
          paths += svgPathLShape(parentX, 0, cx, V_GAP, midY, r);
        }
      } else {
        var leftX = Math.min.apply(null, childXs);
        var rightX = Math.max.apply(null, childXs);
        var barLeft = Math.min(leftX, parentX);
        var barRight = Math.max(rightX, parentX);

        paths += svgLine(parentX, 0, parentX, midY);
        paths += svgLine(barLeft, midY, barRight, midY);

        childXs.forEach(function (cx) {
          if (Math.abs(cx - parentX) < 3) {
            paths += svgLine(cx, midY, cx, V_GAP);
          } else {
            paths += svgCornerDrop(
              cx,
              midY,
              V_GAP,
              r,
              cx < parentX ? "left" : "right"
            );
          }
        });
      }
    } else {
      // סעיף 1: ילדים עם הורים ספציפיים
      var areaRect = area.getBoundingClientRect();
      var groups = {};

      for (var i = 0; i < childXs.length; i++) {
        var px;
        if (perChildParentX[i] !== null) {
          px = perChildParentX[i] - areaRect.left;
        } else {
          px = parentX;
        }
        var key = Math.round(px);
        if (!groups[key]) groups[key] = { parentX: px, childXs: [] };
        groups[key].childXs.push(childXs[i]);
      }

      var groupKeys = Object.keys(groups);
      for (var g = 0; g < groupKeys.length; g++) {
        var grp = groups[groupKeys[g]];
        var gpx = grp.parentX;

        paths += svgLine(gpx, 0, gpx, midY);

        if (grp.childXs.length === 1) {
          var cx = grp.childXs[0];
          if (Math.abs(cx - gpx) < 3) {
            paths += svgLine(cx, midY, cx, V_GAP);
          } else {
            paths += svgLine(Math.min(gpx, cx), midY, Math.max(gpx, cx), midY);
            paths += svgLine(cx, midY, cx, V_GAP);
          }
        } else {
          var gLeft = Math.min.apply(null, grp.childXs);
          var gRight = Math.max.apply(null, grp.childXs);
          var gBarLeft = Math.min(gLeft, gpx);
          var gBarRight = Math.max(gRight, gpx);
          paths += svgLine(gBarLeft, midY, gBarRight, midY);
          grp.childXs.forEach(function (cx) {
            paths += svgLine(cx, midY, cx, V_GAP);
          });
        }
      }
    }

    svg.innerHTML = paths;
    area.appendChild(svg);
  }
  function svgLine(x1, y1, x2, y2) {
    return (
      '<line x1="' +
      x1 +
      '" y1="' +
      y1 +
      '" x2="' +
      x2 +
      '" y2="' +
      y2 +
      '" stroke="' +
      LINE_COLOR +
      '" stroke-width="' +
      LINE_WIDTH +
      '" stroke-linecap="round"/>'
    );
  }

  function svgPathLShape(x1, y1, x2, y2, midY, r) {
    // From (x1, y1) down to midY, then horizontal to x2, then down to y2
    // With rounded corners at the two bends
    r = Math.min(
      r,
      Math.abs(x2 - x1) / 2,
      Math.abs(midY - y1) / 2,
      Math.abs(y2 - midY) / 2
    );
    var goingRight = x2 > x1;

    var path = "M " + x1 + " " + y1;
    // Down to first corner
    path += " L " + x1 + " " + (midY - r);
    // Corner 1
    if (goingRight) {
      path += " Q " + x1 + " " + midY + " " + (x1 + r) + " " + midY;
    } else {
      path += " Q " + x1 + " " + midY + " " + (x1 - r) + " " + midY;
    }
    // Horizontal to second corner
    if (goingRight) {
      path += " L " + (x2 - r) + " " + midY;
      path += " Q " + x2 + " " + midY + " " + x2 + " " + (midY + r);
    } else {
      path += " L " + (x2 + r) + " " + midY;
      path += " Q " + x2 + " " + midY + " " + x2 + " " + (midY + r);
    }
    // Down to end
    path += " L " + x2 + " " + y2;

    return (
      '<path d="' +
      path +
      '" stroke="' +
      LINE_COLOR +
      '" stroke-width="' +
      LINE_WIDTH +
      '" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    );
  }

  function svgCornerDrop(cx, midY, bottomY, r, side) {
    // Draw a rounded corner where horizontal line meets vertical drop
    // The horizontal line is already drawn, so just draw the vertical with rounded top
    r = Math.min(r, (bottomY - midY) / 2);
    return (
      '<line x1="' +
      cx +
      '" y1="' +
      midY +
      '" x2="' +
      cx +
      '" y2="' +
      bottomY +
      '" stroke="' +
      LINE_COLOR +
      '" stroke-width="' +
      LINE_WIDTH +
      '" stroke-linecap="round"/>'
    );
  }

  // Resize handler
  var _rt;
  window.addEventListener("resize", function () {
    clearTimeout(_rt);
    _rt = setTimeout(drawAllConnectors, 250);
  });

  // Ctrl+Wheel zoom
  document.addEventListener("DOMContentLoaded", function () {
    var c = document.getElementById("treeContainer");
    if (c)
      c.addEventListener(
        "wheel",
        function (e) {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.deltaY < 0 ? zoomIn() : zoomOut();
          }
        },
        { passive: false }
      );
  });

  return {
    setLevel: setLevel,
    populateRootSelect: populateRootSelect,
    render: render,
    zoomIn: zoomIn,
    zoomOut: zoomOut,
    zoomReset: zoomReset,
    zoomFit: zoomFit,
    exportAsImage: exportAsImage,
    exportAsPDF: exportAsPDF,
    toggleExportMenu: toggleExportMenu,
  };
})();
