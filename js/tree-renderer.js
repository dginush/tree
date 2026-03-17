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
          avatar: m.photo || "",
          gender: m.gender === "male" ? "M" : "F",
        },
        rels: {},
      };

      // הורים
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

      // בן/בת זוג
      if (m.spouseId) {
        var spouse = ms.find(function (x) {
          return x.id === m.spouseId;
        });
        if (spouse && (spouse.status !== "deceased" || sdc)) {
          person.rels.spouses = [m.spouseId];
        }
      }

      // ילדים
      var children = ms.filter(function (c) {
        if (c.status === "deceased" && !sdc) return false;
        return c.parentId === m.id || c.parentId2 === m.id;
      });
      if (children.length > 0) {
        // מיון לפי גיל
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

      // הוסף בן/בת זוג
      if (m.spouseId && !visited[m.spouseId]) addPerson(m.spouseId, depth);
      // הוסף ילדים
      children.forEach(function (c) {
        if (!visited[c.id]) addPerson(c.id, depth + 1);
      });
      // הוסף הורים
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
        '<div class="empty-state"><div class="icon">🌴</div><h3>בחרו שורש לעץ</h3></div>';
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
      // בדיקה שf3 זמין
      if (typeof f3 === "undefined") {
        container.innerHTML =
          '<div class="empty-state"><div class="icon">⏳</div><h3>טוען ספרייה...</h3><p>רענן את הדף</p></div>';
        return;
      }

      // הגדרת main_id בנתונים עצמם
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
        .setMiniTree(true)
        .setStyle("imageRect")
        .setOnHoverPathToMain();

      chart.updateTree({ initial: true });
      // הוספת אירוע לחיצה על כרטיס
      setTimeout(function () {
        container.querySelectorAll(".card").forEach(function (cardEl) {
          cardEl.style.cursor = "pointer";
          cardEl.addEventListener("click", function (e) {
            var datum = d3.select(this).datum();
            if (datum && datum.data && datum.data.id) {
              App.viewMember(datum.data.id);
            }
          });
        });
      }, 800);
    } catch (err) {
      console.error("Family chart error:", err);
      container.innerHTML =
        '<div class="empty-state"><div class="icon">⚠️</div><h3>שגיאה בטעינת העץ</h3><p>' +
        err.message +
        "</p></div>";
    }
  }

  // Zoom
  function zoomIn() {
    if (chart && chart.getChart) {
      var svg = document.querySelector("#FamilyChart svg");
      if (svg) {
        var g = svg.querySelector("g");
        if (g) {
          var t = d3.zoomTransform(svg);
          d3.select(svg)
            .transition()
            .call(
              d3.zoom().on("zoom", function (e) {
                g.setAttribute("transform", e.transform);
              }).scaleBy,
              1.3
            );
        }
      }
    }
    updateZoomDisplay();
  }

  function zoomOut() {
    var svg = document.querySelector("#FamilyChart svg");
    if (svg) {
      var g = svg.querySelector("g");
      if (g) {
        d3.select(svg)
          .transition()
          .call(
            d3.zoom().on("zoom", function (e) {
              g.setAttribute("transform", e.transform);
            }).scaleBy,
            0.7
          );
      }
    }
    updateZoomDisplay();
  }

  function zoomReset() {
    var svg = document.querySelector("#FamilyChart svg");
    if (svg) {
      d3.select(svg)
        .transition()
        .call(
          d3.zoom().on("zoom", function (e) {
            svg.querySelector("g").setAttribute("transform", e.transform);
          }).transform,
          d3.zoomIdentity
        );
    }
    updateZoomDisplay();
  }

  function zoomFit() {
    zoomReset();
    updateZoomDisplay();
  }

  function updateZoomDisplay() {
    var d = document.getElementById("zoomLevelDisplay");
    if (d) {
      var svg = document.querySelector("#FamilyChart svg");
      if (svg) {
        var t = d3.zoomTransform(svg);
        d.textContent = Math.round(t.k * 100) + "%";
      }
    }
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
    var container = document.getElementById("FamilyChart");
    if (!container) return;
    App.showToast("מכין תמונה...", "warning");
    loadLib(
      "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
      function () {
        html2canvas(container, {
          backgroundColor: "#212121",
          scale: 2,
          useCORS: true,
          logging: false,
        })
          .then(function (canvas) {
            var a = document.createElement("a");
            a.download = "family-tree.png";
            a.href = canvas.toDataURL("image/png");
            a.click();
            App.showToast("התמונה הורדה! 🖼️");
          })
          .catch(function (err) {
            console.error(err);
            App.showToast("שגיאה", "error");
          });
      }
    );
  }

  function exportAsPDF() {
    var m = document.getElementById("exportDropdownContent");
    if (m) m.classList.remove("show");
    var container = document.getElementById("FamilyChart");
    if (!container) return;
    App.showToast("מכין PDF...", "warning");
    loadLib(
      "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
      function () {
        loadLib(
          "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
          function () {
            html2canvas(container, {
              backgroundColor: "#212121",
              scale: 2,
              useCORS: true,
              logging: false,
            })
              .then(function (canvas) {
                var img = canvas.toDataURL("image/png");
                var o = canvas.width > canvas.height ? "landscape" : "portrait";
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
              })
              .catch(function (err) {
                console.error(err);
                App.showToast("שגיאה", "error");
              });
          }
        );
      }
    );
  }

  // Fullscreen
  function toggleFullscreen() {
    var card = document.querySelector(".tree-page-card");
    if (!card) return;
    var isFS = card.classList.contains("tree-fullscreen");
    if (isFS) {
      card.classList.remove("tree-fullscreen");
      var btn = card.querySelector(".fullscreen-close-btn");
      if (btn) btn.remove();
      document.getElementById("fullscreenBtn").textContent = "⛶";
      document.body.style.overflow = "";
      if (document.fullscreenElement)
        document.exitFullscreen().catch(function () {});
    } else {
      card.classList.add("tree-fullscreen");
      document.getElementById("fullscreenBtn").textContent = "✕";
      document.body.style.overflow = "hidden";
      var closeBtn = document.createElement("button");
      closeBtn.className = "fullscreen-close-btn";
      closeBtn.textContent = "✕";
      closeBtn.onclick = toggleFullscreen;
      card.appendChild(closeBtn);
      try {
        if (card.requestFullscreen) card.requestFullscreen();
        else if (card.webkitRequestFullscreen) card.webkitRequestFullscreen();
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
