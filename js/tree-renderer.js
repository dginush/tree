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
    drawOverlaySVG();
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
      drawOverlaySVG();
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
      drawOverlaySVG();
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
  // SVG OVERLAY - Visio-style connectors
  // =============================================
  function drawOverlaySVG() {
    var w = document.getElementById("treeWrapper");
    if (!w) return;

    // הסרת SVG ישן
    var oldSvg = w.querySelector(".tree-svg-overlay");
    if (oldSvg) oldSvg.remove();

    var wRect = w.getBoundingClientRect();
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "tree-svg-overlay");
    svg.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;overflow:visible;";
    svg.setAttribute("width", w.scrollWidth);
    svg.setAttribute("height", w.scrollHeight);

    var trees = w.querySelectorAll(".tf-tree");
    trees.forEach(function (tree) {
      drawTreeConnectors(tree, svg, wRect);
    });

    w.appendChild(svg);
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
    var childPoints = branches
      .map(function (branch) {
        var childPerson = branch.querySelector(
          ":scope > .tf-tree > .tf-nc .tf-person"
        );
        if (!childPerson) childPerson = branch.querySelector(".tf-person");
        if (!childPerson) return null;

        // בדיקה: ילד עם הורה אחד בלבד
        var memberId = childPerson.getAttribute("data-member-id");
        var ms = App.getMembers();
        var childMember = null;
        for (var j = 0; j < ms.length; j++) {
          if (ms[j].id === memberId) {
            childMember = ms[j];
            break;
          }
        }

        var cRect = childPerson.getBoundingClientRect();
        var cx = cRect.left + cRect.width / 2 - wRect.left;
        var cy = cRect.top - wRect.top;

        // בדיקה אם צריך חיבור להורה ספציפי
        var specificParentX = null;
        if (childMember && nc.querySelector(".tf-couple")) {
          if (childMember.parentId && childMember.parentId2) {
            // שני הורים - חיבור לאמצע
            specificParentX = null;
          } else {
            var singleParentId = childMember.parentId || childMember.parentId2;
            if (singleParentId) {
              var parentPersonEl = nc.querySelector(
                '.tf-person[data-member-id="' + singleParentId + '"]'
              );
              if (parentPersonEl) {
                var ppRect = parentPersonEl.getBoundingClientRect();
                specificParentX = ppRect.left + ppRect.width / 2 - wRect.left;
              }
            }
          }
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
        // קו יחיד עם עיקולים
        svg.appendChild(createSmoothPath(gpx, parentY, cp.x, cp.y, midY));
      } else {
        // קו מהורה למטה
        svg.appendChild(createLine(gpx, parentY, gpx, midY));

        // קו אופקי
        var childXs = grp.children.map(function (c) {
          return c.x;
        });
        var leftX = Math.min.apply(null, childXs.concat([gpx]));
        var rightX = Math.max.apply(null, childXs.concat([gpx]));
        svg.appendChild(createLine(leftX, midY, rightX, midY));

        // קווים יורדים לכל ילד עם עיקול בפינה
        grp.children.forEach(function (cp) {
          svg.appendChild(createCornerDrop(cp.x, midY, cp.y));
        });
      }
    });
  }

  // יצירת path חלק בסגנון Visio
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

  function createCornerDrop(cx, midY, bottomY) {
    // קו אנכי מהבר האופקי למטה
    var el = document.createElementNS("http://www.w3.org/2000/svg", "line");
    el.setAttribute("x1", cx);
    el.setAttribute("y1", midY);
    el.setAttribute("x2", cx);
    el.setAttribute("y2", bottomY);
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

    // Touch
    c.addEventListener(
      "touchstart",
      function (e) {
        if (e.target.closest(".tf-person") || e.target.closest("button"))
          return;
        if (e.touches.length === 1) {
          isPanning = true;
          startX = e.touches[0].clientX;
          startY = e.touches[0].clientY;
          scrollStartX = c.scrollLeft;
          scrollStartY = c.scrollTop;
        }
      },
      { passive: true }
    );
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
  };
})();
