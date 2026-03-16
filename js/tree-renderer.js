const TreeRenderer = (() => {
  var lv = 3;
  var currentZoom = 1;
  var MIN_ZOOM = 0.2;
  var MAX_ZOOM = 2;
  var ZOOM_STEP = 0.15;
  var LINE_COLOR = "#4CAF50";
  var LINE_WIDTH = 2.5;
  var COUPLE_COLOR = "#E91E63";
  var RADIUS = 12;

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
    currentZoom = 1;
    w.style.transform = "scale(1)";
    w.style.transformOrigin = "top right";
    requestAnimationFrame(function () {
      var wW = w.scrollWidth,
        wH = w.scrollHeight;
      var cW = c.clientWidth,
        cH = c.clientHeight;
      if (!wW || !wH) return;
      currentZoom = Math.max(
        MIN_ZOOM,
        Math.min((cW - 20) / wW, (cH - 20) / wH, 1)
      );
      w.style.transform = "scale(" + currentZoom + ")";
      var d = document.getElementById("zoomLevelDisplay");
      if (d) d.textContent = Math.round(currentZoom * 100) + "%";
      drawOverlaySVG();
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          var scaledW = wW * currentZoom;
          var scaledH = wH * currentZoom;
          c.scrollLeft = scaledW < cW ? 0 : Math.round((scaledW - cW) / 2);
          c.scrollTop = scaledH < cH ? 0 : Math.round((scaledH - cH) / 2);
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
    // ציור מחדש של קווים אחרי שהדפדפן מעדכן layout
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        drawOverlaySVG();
      });
    });
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
    w.style.transformOrigin = "top right";
    requestAnimationFrame(function () {
      drawOverlaySVG();
      requestAnimationFrame(function () {
        // המרת ה-SVG ל-inline כדי ש-html2canvas יצלם אותו נכון
        var svgEl = w.querySelector(".tree-svg-overlay");
        if (svgEl) {
          var svgData = new XMLSerializer().serializeToString(svgEl);
          var canvas2 = document.createElement("canvas");
          canvas2.width = svgEl.getAttribute("width") || w.scrollWidth;
          canvas2.height = svgEl.getAttribute("height") || w.scrollHeight;
          var ctx2 = canvas2.getContext("2d");
          var img2 = new Image();
          img2.onload = function () {
            ctx2.drawImage(img2, 0, 0);
            // הסתר את ה-SVG זמנית והוסף את התמונה במקומו
            svgEl.style.display = "none";
            var tempImg = document.createElement("img");
            tempImg.src = canvas2.toDataURL("image/png");
            tempImg.className = "tree-svg-overlay-img";
            tempImg.style.cssText =
              "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;";
            w.appendChild(tempImg);

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
                    // ניקוי
                    tempImg.remove();
                    svgEl.style.display = "";

                    var a = document.createElement("a");
                    a.download = "family-tree.png";
                    a.href = canvas.toDataURL("image/png");
                    a.click();
                    App.showToast("התמונה הורדה! 🖼️");
                    currentZoom = sz;
                    applyZoom();
                  })
                  .catch(function (err) {
                    tempImg.remove();
                    svgEl.style.display = "";
                    console.error(err);
                    App.showToast("שגיאה", "error");
                    currentZoom = sz;
                    applyZoom();
                  });
              }
            );
          };
          img2.src =
            "data:image/svg+xml;base64," +
            btoa(unescape(encodeURIComponent(svgData)));
        } else {
          // אין SVG - ייצוא רגיל
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
        }
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
    w.style.transformOrigin = "top right";
    requestAnimationFrame(function () {
      drawOverlaySVG();
      requestAnimationFrame(function () {
        var svgEl = w.querySelector(".tree-svg-overlay");
        var tempImg = null;

        function doExport() {
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
                      if (tempImg) {
                        tempImg.remove();
                        svgEl.style.display = "";
                      }
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
                      if (tempImg) {
                        tempImg.remove();
                        svgEl.style.display = "";
                      }
                      console.error(err);
                      App.showToast("שגיאה", "error");
                      currentZoom = sz;
                      applyZoom();
                    });
                }
              );
            }
          );
        }

        if (svgEl) {
          var svgData = new XMLSerializer().serializeToString(svgEl);
          var canvas2 = document.createElement("canvas");
          canvas2.width = svgEl.getAttribute("width") || w.scrollWidth;
          canvas2.height = svgEl.getAttribute("height") || w.scrollHeight;
          var ctx2 = canvas2.getContext("2d");
          var img2 = new Image();
          img2.onload = function () {
            ctx2.drawImage(img2, 0, 0);
            svgEl.style.display = "none";
            tempImg = document.createElement("img");
            tempImg.src = canvas2.toDataURL("image/png");
            tempImg.className = "tree-svg-overlay-img";
            tempImg.style.cssText =
              "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;";
            w.appendChild(tempImg);
            doExport();
          };
          img2.src =
            "data:image/svg+xml;base64," +
            btoa(unescape(encodeURIComponent(svgData)));
        } else {
          doExport();
        }
      });
    });
  }

  // =============================================
  // BUILD HTML
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

      // מיון ילדים לפי גיל
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

      var h = '<div class="tf-tree">';
      h += '<div class="tf-nc">';
      h += buildCouple(person, spouses, parentIds);
      h += "</div>";

      if (children.length > 0 && level < lv) {
        h += '<div class="tf-gap"></div>';
        h += '<div class="tf-children-row">';
        children.forEach(function (c) {
          if (!vis[c.id]) {
            h += '<div class="tf-branch">';
            h += build(c, level + 1, allParentIds);
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
        h += nodeHTML(person);
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
          if (idx > 0) h += '<div style="width:8px"></div>';
          h += '<div class="tf-couple">';
          h += nodeHTML(lp);
          h +=
            '<div class="tf-couple-link"><div class="tf-couple-line' +
            (sp.isEx ? " tf-ex" : "") +
            '"></div>';
          h +=
            '<span class="tf-couple-heart">' +
            (sp.isEx ? "💔" : "❤️") +
            "</span></div>";
          h += nodeHTML(rp);
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
      var emoji = getPersonEmoji(p.gender, p.birthDate, p.deathDate);

      var html =
        '<div class="tf-person ' +
        gc +
        '" data-member-id="' +
        p.id +
        '" ' +
        "onclick=\"App.viewMember('" +
        p.id +
        "')\">";
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

    // ציור SVG overlay אחרי ש-DOM מוכן
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        drawOverlaySVG();
      });
    });

    applyZoom();
  }

  // =============================================
  // SVG OVERLAY - Visio-style connectors עם פינות מעוגלות
  // =============================================
  function drawOverlaySVG() {
    var w = document.getElementById("treeWrapper");
    if (!w) return;

    // הסרת כל SVG ישנים
    w.querySelectorAll(".tree-svg-overlay").forEach(function (el) {
      el.remove();
    });
    w.querySelectorAll(".tf-connector-svg").forEach(function (el) {
      el.remove();
    });

    // לכל tf-tree - צייר SVG מקומי בתוך ה-tf-gap שלו
    var trees = w.querySelectorAll(".tf-tree");
    trees.forEach(function (tree) {
      drawLocalConnector(tree);
    });
  }

  function drawLocalConnector(treeEl) {
    var nc = treeEl.querySelector(":scope > .tf-nc");
    var gap = treeEl.querySelector(":scope > .tf-gap");
    var childrenRow = treeEl.querySelector(":scope > .tf-children-row");
    if (!nc || !gap || !childrenRow) return;

    var branches = [];
    for (var i = 0; i < childrenRow.children.length; i++) {
      if (childrenRow.children[i].classList.contains("tf-branch")) {
        branches.push(childrenRow.children[i]);
      }
    }
    if (branches.length === 0) return;

    // תיקון zoom: getBoundingClientRect מחזיר ערכים מוכפלים ב-scale
    var z = currentZoom || 1;

    var gapRect = gap.getBoundingClientRect();
    var gapH = gapRect.height / z;
    var gapW = gapRect.width / z;
    var gapLeft = gapRect.left / z;
    var gapTop = gapRect.top / z;

    // מיקום ההורה
    var parentEl =
      nc.querySelector(".tf-couple") || nc.querySelector(".tf-person");
    if (!parentEl) return;
    var pRect = parentEl.getBoundingClientRect();
    var parentX = (pRect.left + pRect.width / 2) / z - gapLeft;
    var parentY = 0;

    // מיקום כל ילד
    var ms = App.getMembers();
    var parentPersonIds = [];
    nc.querySelectorAll(".tf-person").forEach(function (p) {
      var pid = p.getAttribute("data-member-id");
      if (pid) parentPersonIds.push(pid);
    });

    var childPoints = branches
      .map(function (branch) {
        var firstTree = branch.querySelector(":scope > .tf-tree");
        if (!firstTree) return null;
        var firstNc = firstTree.querySelector(":scope > .tf-nc");
        if (!firstNc) return null;

        var childPerson = null;
        var childMember = null;
        var allPersons = firstNc.querySelectorAll(".tf-person");

        allPersons.forEach(function (p) {
          if (childPerson) return;
          var mid = p.getAttribute("data-member-id");
          if (!mid) return;
          var member = null;
          for (var j = 0; j < ms.length; j++) {
            if (ms[j].id === mid) {
              member = ms[j];
              break;
            }
          }
          if (!member) return;
          var isChildOfParent = false;
          if (
            member.parentId &&
            parentPersonIds.indexOf(member.parentId) !== -1
          )
            isChildOfParent = true;
          if (
            member.parentId2 &&
            parentPersonIds.indexOf(member.parentId2) !== -1
          )
            isChildOfParent = true;
          if (isChildOfParent) {
            childPerson = p;
            childMember = member;
          }
        });

        if (!childPerson) {
          childPerson = firstNc.querySelector(".tf-person");
          if (childPerson) {
            var mid = childPerson.getAttribute("data-member-id");
            for (var j = 0; j < ms.length; j++) {
              if (ms[j].id === mid) {
                childMember = ms[j];
                break;
              }
            }
          }
        }
        if (!childPerson) return null;

        var cRect = childPerson.getBoundingClientRect();
        var cx = (cRect.left + cRect.width / 2) / z - gapLeft;
        var cy = gapH;

        var specificParentX = null;
        if (childMember && nc.querySelector(".tf-couple")) {
          var hasP1 =
            childMember.parentId &&
            parentPersonIds.indexOf(childMember.parentId) !== -1;
          var hasP2 =
            childMember.parentId2 &&
            parentPersonIds.indexOf(childMember.parentId2) !== -1;
          if (hasP1 && !hasP2) {
            var el = nc.querySelector(
              '.tf-person[data-member-id="' + childMember.parentId + '"]'
            );
            if (el) {
              var r = el.getBoundingClientRect();
              specificParentX = (r.left + r.width / 2) / z - gapLeft;
            }
          } else if (hasP2 && !hasP1) {
            var el = nc.querySelector(
              '.tf-person[data-member-id="' + childMember.parentId2 + '"]'
            );
            if (el) {
              var r = el.getBoundingClientRect();
              specificParentX = (r.left + r.width / 2) / z - gapLeft;
            }
          }
        }

        return { x: cx, y: cy, specificParentX: specificParentX };
      })
      .filter(Boolean);

    if (childPoints.length === 0) return;

    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "tf-connector-svg");
    svg.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;";
    svg.setAttribute("width", gapW);
    svg.setAttribute("height", gapH);

    var midY = gapH / 2;

    var groups = {};
    childPoints.forEach(function (cp) {
      var px = cp.specificParentX !== null ? cp.specificParentX : parentX;
      var key = Math.round(px);
      if (!groups[key]) groups[key] = { parentX: px, children: [] };
      groups[key].children.push(cp);
    });

    var groupKeys = Object.keys(groups);
    groupKeys.forEach(function (key) {
      var grp = groups[key];
      var gpx = grp.parentX;

      if (grp.children.length === 1) {
        var cp = grp.children[0];
        svg.appendChild(createSmoothPath(gpx, parentY, cp.x, cp.y, midY));
      } else {
        var r = RADIUS;
        svg.appendChild(createLine(gpx, parentY, gpx, midY));
        grp.children.forEach(function (cp) {
          var cx = cp.x;
          var cr = Math.min(
            r,
            Math.abs(cx - gpx) / 2,
            Math.abs(cp.y - midY) / 2
          );
          if (Math.abs(cx - gpx) < 3) {
            svg.appendChild(createLine(cx, midY, cx, cp.y));
          } else {
            var dir = cx > gpx ? 1 : -1;
            var pathD = "M " + gpx + " " + midY;
            pathD += " L " + (cx - cr * dir) + " " + midY;
            pathD += " Q " + cx + " " + midY + " " + cx + " " + (midY + cr);
            pathD += " L " + cx + " " + cp.y;
            var el = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "path"
            );
            el.setAttribute("d", pathD);
            el.setAttribute("stroke", LINE_COLOR);
            el.setAttribute("stroke-width", LINE_WIDTH);
            el.setAttribute("fill", "none");
            el.setAttribute("stroke-linecap", "round");
            el.setAttribute("stroke-linejoin", "round");
            svg.appendChild(el);
          }
        });
      }
    });

    gap.style.position = "relative";
    gap.appendChild(svg);
  }

  function drawTreeConnectors(treeEl, svg, wRect) {
    var nc = treeEl.querySelector(":scope > .tf-nc");
    var childrenRow = treeEl.querySelector(":scope > .tf-children-row");
    if (!nc || !childrenRow) return;

    var branches = [];
    for (var i = 0; i < childrenRow.children.length; i++) {
      if (childrenRow.children[i].classList.contains("tf-branch")) {
        branches.push(childrenRow.children[i]);
      }
    }
    if (branches.length === 0) return;

    // מיקום ההורה (תחתית הזוג/אדם)
    var parentEl =
      nc.querySelector(".tf-couple") || nc.querySelector(".tf-person");
    if (!parentEl) return;
    var pRect = parentEl.getBoundingClientRect();
    var parentX = pRect.left + pRect.width / 2 - wRect.left;
    var parentY = pRect.bottom - wRect.top;

    // מיקום כל ילד (חלק עליון)
    // מיקום כל ילד (חלק עליון)
    // מיקום כל ילד (חלק עליון) - תיקון כפילות
    var ms = App.getMembers();
    var parentPersonIds = [];
    var ncPersons = nc.querySelectorAll(".tf-person");
    ncPersons.forEach(function (p) {
      var pid = p.getAttribute("data-member-id");
      if (pid) parentPersonIds.push(pid);
    });

    var childPoints = branches
      .map(function (branch) {
        var firstTree = branch.querySelector(":scope > .tf-tree");
        if (!firstTree) return null;
        var firstNc = firstTree.querySelector(":scope > .tf-nc");
        if (!firstNc) return null;

        // מציאת הילד האמיתי - זה שה-parentId שלו מצביע על אחד מההורים למעלה
        var childPerson = null;
        var childMember = null;
        var allPersons = firstNc.querySelectorAll(".tf-person");

        allPersons.forEach(function (p) {
          if (childPerson) return; // כבר מצאנו
          var mid = p.getAttribute("data-member-id");
          if (!mid) return;
          var member = null;
          for (var j = 0; j < ms.length; j++) {
            if (ms[j].id === mid) {
              member = ms[j];
              break;
            }
          }
          if (!member) return;

          // בדיקה: האם אחד מההורים של האדם הזה נמצא ב-nc למעלה?
          var isChildOfParent = false;
          if (
            member.parentId &&
            parentPersonIds.indexOf(member.parentId) !== -1
          )
            isChildOfParent = true;
          if (
            member.parentId2 &&
            parentPersonIds.indexOf(member.parentId2) !== -1
          )
            isChildOfParent = true;

          if (isChildOfParent) {
            childPerson = p;
            childMember = member;
          }
        });

        // אם לא מצאנו דרך הורים, קח את הראשון (fallback)
        if (!childPerson) {
          childPerson = firstNc.querySelector(".tf-person");
          if (childPerson) {
            var mid = childPerson.getAttribute("data-member-id");
            for (var j = 0; j < ms.length; j++) {
              if (ms[j].id === mid) {
                childMember = ms[j];
                break;
              }
            }
          }
        }
        if (!childPerson) return null;

        var cRect = childPerson.getBoundingClientRect();
        var cx = cRect.left + cRect.width / 2 - wRect.left;
        var cy = cRect.top - wRect.top;

        // חיבור להורה ספציפי - רק אם יש בדיוק הורה אחד
        var specificParentX = null;
        if (childMember && nc.querySelector(".tf-couple")) {
          var hasP1 =
            childMember.parentId &&
            parentPersonIds.indexOf(childMember.parentId) !== -1;
          var hasP2 =
            childMember.parentId2 &&
            parentPersonIds.indexOf(childMember.parentId2) !== -1;

          if (hasP1 && !hasP2) {
            var el = nc.querySelector(
              '.tf-person[data-member-id="' + childMember.parentId + '"]'
            );
            if (el) {
              var r = el.getBoundingClientRect();
              specificParentX = r.left + r.width / 2 - wRect.left;
            }
          } else if (hasP2 && !hasP1) {
            var el = nc.querySelector(
              '.tf-person[data-member-id="' + childMember.parentId2 + '"]'
            );
            if (el) {
              var r = el.getBoundingClientRect();
              specificParentX = r.left + r.width / 2 - wRect.left;
            }
          }
          // שני הורים בזוג = null = אמצע
        }

        return { x: cx, y: cy, specificParentX: specificParentX };
      })
      .filter(Boolean);

    if (childPoints.length === 0) return;

    // חישוב נקודת אמצע Y
    var minChildY = Math.min.apply(
      null,
      childPoints.map(function (p) {
        return p.y;
      })
    );
    var midY = parentY + (minChildY - parentY) / 2;

    // קיבוץ ילדים לפי הורה
    var groups = {};
    childPoints.forEach(function (cp) {
      var px = cp.specificParentX !== null ? cp.specificParentX : parentX;
      var key = Math.round(px);
      if (!groups[key]) groups[key] = { parentX: px, children: [] };
      groups[key].children.push(cp);
    });

    var groupKeys = Object.keys(groups);
    groupKeys.forEach(function (key) {
      var grp = groups[key];
      var gpx = grp.parentX;

      if (grp.children.length === 1) {
        var cp = grp.children[0];
        // ילד יחיד - path מעוגל שלם
        svg.appendChild(createSmoothPath(gpx, parentY, cp.x, cp.y, midY));
      } else {
        // מספר ילדים מאותו הורה
        var r = RADIUS;
        var childXs = grp.children.map(function (c) {
          return c.x;
        });

        // קו אנכי מההורה למטה עד midY
        svg.appendChild(createLine(gpx, parentY, gpx, midY));

        // לכל ילד: path מעוגל מ-midY למטה
        grp.children.forEach(function (cp) {
          var cx = cp.x;
          var cr = Math.min(
            r,
            Math.abs(cx - gpx) / 2,
            Math.abs(cp.y - midY) / 2
          );

          if (Math.abs(cx - gpx) < 3) {
            // ישר מתחת להורה - קו ישר
            svg.appendChild(createLine(cx, midY, cx, cp.y));
          } else {
            // path מעוגל: אופקי מ-gpx עד cx, ואז למטה
            var dir = cx > gpx ? 1 : -1;
            var pathD = "M " + gpx + " " + midY;
            pathD += " L " + (cx - cr * dir) + " " + midY;
            pathD += " Q " + cx + " " + midY + " " + cx + " " + (midY + cr);
            pathD += " L " + cx + " " + cp.y;

            var el = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "path"
            );
            el.setAttribute("d", pathD);
            el.setAttribute("stroke", LINE_COLOR);
            el.setAttribute("stroke-width", LINE_WIDTH);
            el.setAttribute("fill", "none");
            el.setAttribute("stroke-linecap", "round");
            el.setAttribute("stroke-linejoin", "round");
            svg.appendChild(el);
          }
        });
      }
    });
  }

  // יצירת path חלק בסגנון Visio - לילד יחיד
  function createSmoothPath(x1, y1, x2, y2, midY) {
    var r = Math.min(
      RADIUS,
      Math.abs(x2 - x1) / 2,
      Math.abs(midY - y1) / 2,
      Math.abs(y2 - midY) / 2
    );
    var path;

    if (Math.abs(x1 - x2) < 3) {
      // ישר למטה
      path = "M " + x1 + " " + y1 + " L " + x1 + " " + y2;
    } else {
      var dir = x2 > x1 ? 1 : -1;
      path = "M " + x1 + " " + y1;
      path += " L " + x1 + " " + (midY - r);
      path += " Q " + x1 + " " + midY + " " + (x1 + r * dir) + " " + midY;
      path += " L " + (x2 - r * dir) + " " + midY;
      path += " Q " + x2 + " " + midY + " " + x2 + " " + (midY + r);
      path += " L " + x2 + " " + y2;
    }

    var el = document.createElementNS("http://www.w3.org/2000/svg", "path");
    el.setAttribute("d", path);
    el.setAttribute("stroke", LINE_COLOR);
    el.setAttribute("stroke-width", LINE_WIDTH);
    el.setAttribute("fill", "none");
    el.setAttribute("stroke-linecap", "round");
    el.setAttribute("stroke-linejoin", "round");
    return el;
  }

  function createLine(x1, y1, x2, y2) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", "line");
    el.setAttribute("x1", x1);
    el.setAttribute("y1", y1);
    el.setAttribute("x2", x2);
    el.setAttribute("y2", y2);
    el.setAttribute("stroke", LINE_COLOR);
    el.setAttribute("stroke-width", LINE_WIDTH);
    el.setAttribute("stroke-linecap", "round");
    return el;
  }

  // Resize & tab switch
  var _rt;
  window.addEventListener("resize", function () {
    clearTimeout(_rt);
    _rt = setTimeout(drawOverlaySVG, 200);
  });

  // Pan & Zoom
  document.addEventListener("DOMContentLoaded", function () {
    var c = document.getElementById("treeContainer");
    if (!c) return;

    // Zoom with Ctrl+Wheel
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

    // Pan (drag)
    var isPanning = false,
      startX = 0,
      startY = 0,
      scrollStartX = 0,
      scrollStartY = 0;

    c.addEventListener("mousedown", function (e) {
      if (e.target.closest(".tf-person") || e.target.closest("button")) return;
      isPanning = true;
      startX = e.clientX;
      startY = e.clientY;
      scrollStartX = c.scrollLeft;
      scrollStartY = c.scrollTop;
      c.style.cursor = "grabbing";
      e.preventDefault();
    });

    document.addEventListener("mousemove", function (e) {
      if (!isPanning) return;
      c.scrollLeft = scrollStartX - (e.clientX - startX);
      c.scrollTop = scrollStartY - (e.clientY - startY);
    });

    document.addEventListener("mouseup", function () {
      if (isPanning) {
        isPanning = false;
        c.style.cursor = "";
      }
    });

    // Touch support
    // Touch support - Pan + Pinch-to-Zoom
    var initialPinchDistance = 0;
    var initialPinchZoom = 1;

    c.addEventListener(
      "touchstart",
      function (e) {
        if (e.target.closest(".tf-person") || e.target.closest("button"))
          return;

        if (e.touches.length === 2) {
          // Pinch start
          isPanning = false;
          initialPinchDistance = getPinchDistance(e.touches);
          initialPinchZoom = currentZoom;
          e.preventDefault();
        } else if (e.touches.length === 1) {
          // Pan start
          isPanning = true;
          startX = e.touches[0].clientX;
          startY = e.touches[0].clientY;
          scrollStartX = c.scrollLeft;
          scrollStartY = c.scrollTop;
        }
      },
      { passive: false }
    );

    c.addEventListener(
      "touchmove",
      function (e) {
        if (e.touches.length === 2) {
          // Pinch zoom
          e.preventDefault();
          var currentDistance = getPinchDistance(e.touches);
          if (initialPinchDistance > 0) {
            var scale = currentDistance / initialPinchDistance;
            currentZoom = Math.max(
              MIN_ZOOM,
              Math.min(MAX_ZOOM, initialPinchZoom * scale)
            );
            applyZoom();
          }
        } else if (isPanning && e.touches.length === 1) {
          // Pan
          c.scrollLeft = scrollStartX - (e.touches[0].clientX - startX);
          c.scrollTop = scrollStartY - (e.touches[0].clientY - startY);
        }
      },
      { passive: false }
    );

    c.addEventListener("touchend", function (e) {
      if (e.touches.length < 2) {
        initialPinchDistance = 0;
      }
      if (e.touches.length === 0) {
        isPanning = false;
        // ציור מחדש של קווים אחרי זום
        drawOverlaySVG();
      }
    });

    function getPinchDistance(touches) {
      var dx = touches[0].clientX - touches[1].clientX;
      var dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    c.addEventListener(
      "touchmove",
      function (e) {
        if (!isPanning || e.touches.length !== 1) return;
        c.scrollLeft = scrollStartX - (e.touches[0].clientX - startX);
        c.scrollTop = scrollStartY - (e.touches[0].clientY - startY);
      },
      { passive: true }
    );

    c.addEventListener("touchend", function () {
      isPanning = false;
    });
  });
  function toggleFullscreen() {
    var card = document.querySelector(".tree-page-card");
    if (!card) return;

    var isFullscreen = card.classList.contains("tree-fullscreen");

    if (isFullscreen) {
      // יציאה ממסך מלא
      card.classList.remove("tree-fullscreen");
      var closeBtn = card.querySelector(".fullscreen-close-btn");
      if (closeBtn) closeBtn.remove();
      document.getElementById("fullscreenBtn").textContent = "⛶";
      document.body.style.overflow = "";
    } else {
      // כניסה למסך מלא
      card.classList.add("tree-fullscreen");
      document.getElementById("fullscreenBtn").textContent = "✕";
      document.body.style.overflow = "hidden";

      // כפתור יציאה
      var closeBtn = document.createElement("button");
      closeBtn.className = "fullscreen-close-btn";
      closeBtn.textContent = "✕";
      closeBtn.onclick = toggleFullscreen;
      card.appendChild(closeBtn);
    }

    // ציור מחדש
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        drawOverlaySVG();
      });
    });
  }
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
    redrawConnectors: drawOverlaySVG,
    toggleFullscreen: toggleFullscreen,
  };
})();
