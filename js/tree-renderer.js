const TreeRenderer = (() => {
  var lv = 100;
  var chart = null;
  var card = null;

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

  function buildData() {
    var ms = App.getMembers();
    var sdc = document.getElementById("showDeceased")?.checked ?? true;
    var rootId = document.getElementById("treeRoot")?.value;
    if (!ms.length || !rootId) return [];

    var visited = {};
    var data = [];

    function addPerson(id, depth) {
      if (!id || visited[id] || depth > lv) return;
      var m = ms.find(function (x) {
        return x.id === id;
      });
      if (!m) return;
      if (m.status === "deceased" && !sdc) return;
      visited[id] = true;

      var person = {
        id: m.id,
        data: {
          "first name": m.firstName || "",
          "last name": m.lastName || "",
          birthday: m.birthDate || "",
          avatar:
            m.photo ||
            "data:image/svg+xml," +
              encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><rect width="60" height="60" fill="' +
                  (m.gender === "male" ? "#1976D2" : "#E91E63") +
                  '"/><text x="30" y="38" text-anchor="middle" fill="white" font-size="24" font-family="Arial">' +
                  ((m.firstName || "?")[0] + (m.lastName || "?")[0]) +
                  "</text></svg>"
              ),
          gender: m.gender === "male" ? "M" : "F",
        },
        rels: {},
      };

      if (m.parentId) {
        var p1 = ms.find(function (x) {
          return x.id === m.parentId;
        });
        if (p1) {
          if (p1.gender === "male") person.rels.father = m.parentId;
          else person.rels.mother = m.parentId;
        }
      }
      if (m.parentId2) {
        var p2 = ms.find(function (x) {
          return x.id === m.parentId2;
        });
        if (p2) {
          if (p2.gender === "female") person.rels.mother = m.parentId2;
          else person.rels.father = m.parentId2;
        }
      }

      if (m.spouseId) {
        var spouse = ms.find(function (x) {
          return x.id === m.spouseId;
        });
        if (spouse && (spouse.status !== "deceased" || sdc)) {
          person.rels.spouses = [m.spouseId];
        }
      }

      var children = ms.filter(function (c) {
        if (c.status === "deceased" && !sdc) return false;
        return c.parentId === m.id || c.parentId2 === m.id;
      });
      if (children.length > 0) {
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
        person.rels.children = children.map(function (c) {
          return c.id;
        });
      }

      data.push(person);

      if (m.spouseId && !visited[m.spouseId]) addPerson(m.spouseId, depth);
      children.forEach(function (c) {
        if (!visited[c.id]) addPerson(c.id, depth + 1);
      });
      if (m.parentId && !visited[m.parentId]) addPerson(m.parentId, depth - 1);
      if (m.parentId2 && !visited[m.parentId2])
        addPerson(m.parentId2, depth - 1);
    }

    addPerson(rootId, 0);
    return data;
  }

  function render() {
    var container = document.getElementById("FamilyChart");
    if (!container) return;

    var data = buildData();
    if (!data.length) {
      container.innerHTML =
        '<div class="empty-state" style="color:#fff"><div class="icon">🌴</div><h3>בחרו שורש לעץ</h3></div>';
      chart = null;
      return;
    }

    var rootId = document.getElementById("treeRoot")?.value;
    container.innerHTML = "";
    container.className = "f3";
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.minHeight = "500px";

    try {
      if (typeof f3 === "undefined") {
        container.innerHTML =
          '<div class="empty-state" style="color:#fff"><div class="icon">⏳</div><h3>טוען ספרייה...</h3><p>רענן את הדף</p></div>';
        return;
      }

      // סימון main
      data.forEach(function (d) {
        if (d.id === rootId) d.main = true;
        else delete d.main;
      });

      chart = f3
        .createChart("#FamilyChart", data)
        .setTransitionTime(500)
        .setCardXSpacing(250)
        .setCardYSpacing(150)
        .setSingleParentEmptyCard(false)
        .setOrientationVertical();

      card = chart
        .setCardHtml()
        .setCardDisplay([["first name", "last name"], ["birthday"]])
        .setMiniTree(false)
        .setStyle("imageRect")
        .setOnHoverPathToMain();

      // בעיה 3: לחיצה על כרטיס = פתיחת פרטים
      card.setOnCardClick(function (e, d) {
        if (d && d.data && d.data.id) {
          App.viewMember(d.data.id);
        }
      });

      chart.updateTree({ initial: true });
    } catch (err) {
      console.error("Family chart error:", err);
      container.innerHTML =
        '<div class="empty-state" style="color:#fff"><div class="icon">⚠️</div><h3>שגיאה בטעינת העץ</h3><p>' +
        err.message +
        "</p></div>";
    }

    updateZoomDisplay();
  }

  // בעיה 4: זום עובד
  function getChartSvg() {
    return document.querySelector("#FamilyChart svg");
  }

  function getChartG() {
    var svg = getChartSvg();
    return svg ? svg.querySelector("g") : null;
  }

  function zoomIn() {
    var svg = getChartSvg();
    if (!svg) return;
    try {
      var zoom = d3.zoom().on("zoom", function (e) {
        var g = svg.querySelector("g");
        if (g) g.setAttribute("transform", e.transform);
      });
      d3.select(svg).transition().duration(300).call(zoom.scaleBy, 1.3);
    } catch (e) {
      console.log("Zoom error:", e);
    }
    setTimeout(updateZoomDisplay, 350);
  }

  function zoomOut() {
    var svg = getChartSvg();
    if (!svg) return;
    try {
      var zoom = d3.zoom().on("zoom", function (e) {
        var g = svg.querySelector("g");
        if (g) g.setAttribute("transform", e.transform);
      });
      d3.select(svg).transition().duration(300).call(zoom.scaleBy, 0.7);
    } catch (e) {
      console.log("Zoom error:", e);
    }
    setTimeout(updateZoomDisplay, 350);
  }

  function zoomReset() {
    var container = document.getElementById("FamilyChart");
    if (!container) return;
    // render מחדש מאפס הכל
    render();
  }

  function zoomFit() {
    var container = document.getElementById("FamilyChart");
    if (!container) return;
    // render מחדש = fit
    render();
  }

  function updateZoomDisplay() {
    var d = document.getElementById("zoomLevelDisplay");
    if (!d) return;
    var svg = getChartSvg();
    if (svg) {
      try {
        var t = d3.zoomTransform(svg);
        d.textContent = Math.round(t.k * 100) + "%";
      } catch (e) {
        d.textContent = "100%";
      }
    }
  }

  // בעיה 5: ייצוא SVG איכותי
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

  function getSvgForExport() {
    var svg = getChartSvg();
    if (!svg) return null;

    // Clone SVG
    var clone = svg.cloneNode(true);

    // Get bounding box of content
    var g = svg.querySelector("g");
    if (!g) return null;

    var bbox = g.getBBox();
    var padding = 50;

    // Set viewBox to fit content
    clone.setAttribute(
      "viewBox",
      bbox.x -
        padding +
        " " +
        (bbox.y - padding) +
        " " +
        (bbox.width + padding * 2) +
        " " +
        (bbox.height + padding * 2)
    );
    clone.setAttribute("width", bbox.width + padding * 2);
    clone.setAttribute("height", bbox.height + padding * 2);

    // Reset transform on g element
    var cloneG = clone.querySelector("g");
    if (cloneG) cloneG.setAttribute("transform", "");

    // Add background
    var rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", bbox.x - padding);
    rect.setAttribute("y", bbox.y - padding);
    rect.setAttribute("width", bbox.width + padding * 2);
    rect.setAttribute("height", bbox.height + padding * 2);
    rect.setAttribute("fill", "#1a1a2e");
    clone.insertBefore(rect, clone.firstChild);

    // Add styles
    var styleEl = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "style"
    );
    var cssRules = "";
    try {
      var sheets = document.styleSheets;
      for (var i = 0; i < sheets.length; i++) {
        try {
          var rules = sheets[i].cssRules || sheets[i].rules;
          if (rules) {
            for (var j = 0; j < rules.length; j++) {
              cssRules += rules[j].cssText + "\n";
            }
          }
        } catch (e) {} // cross-origin sheets
      }
    } catch (e) {}
    styleEl.textContent = cssRules;
    clone.insertBefore(styleEl, clone.firstChild);

    return clone;
  }

  function exportAsImage() {
    var m = document.getElementById("exportDropdownContent");
    if (m) m.classList.remove("show");
    App.showToast("מכין תמונה...", "warning");
    var container = document.getElementById("FamilyChart");
    if (!container) {
      App.showToast("אין עץ", "error");
      return;
    }
    var svg = container.querySelector("svg");
    if (!svg) {
      App.showToast("אין עץ", "error");
      return;
    }
    var g = svg.querySelector("g");
    if (!g) {
      App.showToast("אין תוכן", "error");
      return;
    }

    var clone = svg.cloneNode(true);
    var bbox = g.getBBox();
    var pad = 80;
    var isDark = document.body.classList.contains("dark-mode");
    var bgColor = isDark ? "#1a1a2e" : "#f5f5f0";

    clone.setAttribute(
      "viewBox",
      bbox.x -
        pad +
        " " +
        (bbox.y - pad) +
        " " +
        (bbox.width + pad * 2) +
        " " +
        (bbox.height + pad * 2)
    );
    clone.setAttribute("width", Math.max(bbox.width + pad * 2, 800));
    clone.setAttribute("height", Math.max(bbox.height + pad * 2, 600));
    clone.removeAttribute("style");

    var cloneG = clone.querySelector("g");
    if (cloneG) cloneG.setAttribute("transform", "");

    // רקע
    var bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("x", bbox.x - pad);
    bgRect.setAttribute("y", bbox.y - pad);
    bgRect.setAttribute("width", bbox.width + pad * 2);
    bgRect.setAttribute("height", bbox.height + pad * 2);
    bgRect.setAttribute("fill", bgColor);
    clone.insertBefore(bgRect, clone.firstChild);

    // העתקת סגנונות מחושבים
    inlineStyles(svg, clone);

    // תיקון צבע קווים בייצוא
    clone.querySelectorAll(".link path, path.link").forEach(function (p) {
      p.setAttribute("stroke", isDark ? "#90caf9" : "#1a3a5c");
      p.style.stroke = isDark ? "#90caf9" : "#1a3a5c";
    });

    var svgData = new XMLSerializer().serializeToString(clone);
    var svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    var url = URL.createObjectURL(svgBlob);

    var img = new Image();
    img.onload = function () {
      var scale = 4;
      var canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      var a = document.createElement("a");
      a.download = "family-tree.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
      App.showToast("הורד באיכות גבוהה! 🖼️");
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      // fallback: הורד כ-SVG
      var a = document.createElement("a");
      a.download = "family-tree.svg";
      a.href = URL.createObjectURL(svgBlob);
      a.click();
      App.showToast("הורד כ-SVG! 📐");
    };
    img.src = url;
  }

  function exportAsPDF() {
    var m = document.getElementById("exportDropdownContent");
    if (m) m.classList.remove("show");
    App.showToast("מכין PDF...", "warning");
    var container = document.getElementById("FamilyChart");
    if (!container) {
      App.showToast("אין עץ", "error");
      return;
    }
    var svg = container.querySelector("svg");
    if (!svg) {
      App.showToast("אין עץ", "error");
      return;
    }
    var g = svg.querySelector("g");
    if (!g) return;

    var clone = svg.cloneNode(true);
    var bbox = g.getBBox();
    var pad = 80;
    var isDark = document.body.classList.contains("dark-mode");
    var bgColor = isDark ? "#1a1a2e" : "#f5f5f0";

    clone.setAttribute(
      "viewBox",
      bbox.x -
        pad +
        " " +
        (bbox.y - pad) +
        " " +
        (bbox.width + pad * 2) +
        " " +
        (bbox.height + pad * 2)
    );
    clone.setAttribute("width", Math.max(bbox.width + pad * 2, 800));
    clone.setAttribute("height", Math.max(bbox.height + pad * 2, 600));
    clone.removeAttribute("style");

    var cloneG = clone.querySelector("g");
    if (cloneG) cloneG.setAttribute("transform", "");

    var bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("x", bbox.x - pad);
    bgRect.setAttribute("y", bbox.y - pad);
    bgRect.setAttribute("width", bbox.width + pad * 2);
    bgRect.setAttribute("height", bbox.height + pad * 2);
    bgRect.setAttribute("fill", bgColor);
    clone.insertBefore(bgRect, clone.firstChild);

    inlineStyles(svg, clone);

    clone.querySelectorAll(".link path, path.link").forEach(function (p) {
      p.setAttribute("stroke", isDark ? "#90caf9" : "#1a3a5c");
      p.style.stroke = isDark ? "#90caf9" : "#1a3a5c";
    });

    var svgData = new XMLSerializer().serializeToString(clone);
    var svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    var url = URL.createObjectURL(svgBlob);

    var img = new Image();
    img.onload = function () {
      var scale = 4;
      var canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      loadLib(
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
        function () {
          var imgData = canvas.toDataURL("image/png");
          var o = canvas.width > canvas.height ? "landscape" : "portrait";
          var pdf = new jspdf.jsPDF({
            orientation: o,
            unit: "mm",
            format: "a3",
          });
          var pW = pdf.internal.pageSize.getWidth() - 20;
          var pH = pdf.internal.pageSize.getHeight() - 20;
          var r = Math.min(pW / canvas.width, pH / canvas.height);
          pdf.addImage(
            imgData,
            "PNG",
            10 + (pW - canvas.width * r) / 2,
            10 + (pH - canvas.height * r) / 2,
            canvas.width * r,
            canvas.height * r
          );
          pdf.save("family-tree.pdf");
          App.showToast("PDF הורד! 📄");
        }
      );
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      App.showToast("שגיאה", "error");
    };
    img.src = url;
  }
  // Helper: inline computed styles from source to clone
  function inlineStyles(source, clone) {
    try {
      var sourceChildren = source.querySelectorAll("*");
      var cloneChildren = clone.querySelectorAll("*");
      for (
        var i = 0;
        i < sourceChildren.length && i < cloneChildren.length;
        i++
      ) {
        var computed = window.getComputedStyle(sourceChildren[i]);
        var important = [
          "fill",
          "stroke",
          "stroke-width",
          "font-family",
          "font-size",
          "font-weight",
          "text-anchor",
          "dominant-baseline",
          "opacity",
          "visibility",
          "display",
          "color",
        ];
        important.forEach(function (prop) {
          var val = computed.getPropertyValue(prop);
          if (val) cloneChildren[i].style[prop] = val;
        });
      }
    } catch (e) {}
  }

  // Fullscreen
  function toggleFullscreen() {
    var cardEl = document.querySelector(".tree-page-card");
    if (!cardEl) return;
    var isFS = cardEl.classList.contains("tree-fullscreen");
    if (isFS) {
      cardEl.classList.remove("tree-fullscreen");
      var btn = cardEl.querySelector(".fullscreen-close-btn");
      if (btn) btn.remove();
      document.getElementById("fullscreenBtn").textContent = "⛶";
      document.body.style.overflow = "";
      if (document.fullscreenElement)
        document.exitFullscreen().catch(function () {});
    } else {
      cardEl.classList.add("tree-fullscreen");
      document.getElementById("fullscreenBtn").textContent = "✕";
      document.body.style.overflow = "hidden";
      var closeBtn = document.createElement("button");
      closeBtn.className = "fullscreen-close-btn";
      closeBtn.textContent = "✕";
      closeBtn.onclick = toggleFullscreen;
      cardEl.appendChild(closeBtn);
      try {
        if (cardEl.requestFullscreen) cardEl.requestFullscreen();
        else if (cardEl.webkitRequestFullscreen)
          cardEl.webkitRequestFullscreen();
      } catch (e) {}
    }
    setTimeout(function () {
      render();
    }, 300);
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
    toggleFullscreen: toggleFullscreen,
    redrawConnectors: function () {
      render();
    },
  };
})();
