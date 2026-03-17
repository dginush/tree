const TreeRenderer = (() => {
  var lv = 100;
  var currentZoom = 1;
  var chart = null;
  var chartContainer = null;

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

  function buildFamilyChartData() {
    var ms = App.getMembers();
    var sdc = document.getElementById("showDeceased")?.checked ?? true;
    var rootId = document.getElementById("treeRoot")?.value;

    if (!ms.length || !rootId) return [];

    // המרת הנתונים לפורמט של family-chart
    var data = [];
    var visited = {};

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
          gender: m.gender === "male" ? "M" : "F",
          avatar: m.photo || "",
        },
        rels: {},
      };

      // הורים
      if (m.parentId) {
        var father = ms.find(function (x) {
          return x.id === m.parentId;
        });
        if (father && father.gender === "male") {
          person.rels.father = m.parentId;
        } else if (father && father.gender === "female") {
          person.rels.mother = m.parentId;
        }
      }
      if (m.parentId2) {
        var mother = ms.find(function (x) {
          return x.id === m.parentId2;
        });
        if (mother && mother.gender === "female") {
          person.rels.mother = m.parentId2;
        } else if (mother && mother.gender === "male") {
          person.rels.father = m.parentId2;
        }
      }

      // בן/בת זוג
      if (m.spouseId) {
        var spouse = ms.find(function (x) {
          return x.id === m.spouseId;
        });
        if (spouse) {
          person.rels.spouses = [m.spouseId];
        }
      }

      // ילדים
      var children = ms.filter(function (c) {
        return c.parentId === m.id || c.parentId2 === m.id;
      });
      if (children.length > 0) {
        person.rels.children = children.map(function (c) {
          return c.id;
        });
      }

      data.push(person);

      // הוסף את בן/בת הזוג
      if (m.spouseId && !visited[m.spouseId]) {
        addPerson(m.spouseId, depth);
      }

      // הוסף ילדים
      children.forEach(function (c) {
        if (!visited[c.id]) {
          addPerson(c.id, depth + 1);
        }
      });

      // הוסף הורים
      if (m.parentId && !visited[m.parentId]) addPerson(m.parentId, depth - 1);
      if (m.parentId2 && !visited[m.parentId2])
        addPerson(m.parentId2, depth - 1);
    }

    addPerson(rootId, 0);

    // מיון ילדים לפי גיל
    data.forEach(function (person) {
      if (person.rels.children && person.rels.children.length > 1) {
        person.rels.children.sort(function (aId, bId) {
          var a = ms.find(function (x) {
            return x.id === aId;
          });
          var b = ms.find(function (x) {
            return x.id === bId;
          });
          if (!a || !a.birthDate) return 1;
          if (!b || !b.birthDate) return -1;
          var da = a.birthDate.split("/");
          var db = b.birthDate.split("/");
          var dateA = new Date(
            parseInt(da[2]),
            parseInt(da[1]) - 1,
            parseInt(da[0])
          );
          var dateB = new Date(
            parseInt(db[2]),
            parseInt(db[1]) - 1,
            parseInt(db[0])
          );
          return dateA - dateB;
        });
      }
    });

    return data;
  }

  function render() {
    var container = document.getElementById("FamilyChart");
    if (!container) return;

    var data = buildFamilyChartData();
    if (!data.length) {
      container.innerHTML =
        '<div class="empty-state"><div class="icon">🌴</div><h3>בחרו שורש לעץ</h3></div>';
      if (chart) {
        chart = null;
      }
      return;
    }

    container.innerHTML = "";

    var rootId = document.getElementById("treeRoot")?.value;
    var ms = App.getMembers();

    try {
      chart = FamilyChart({
        id: "FamilyChart",
        data: data,
        main_id: rootId,
        node_separation: 250,
        level_separation: 150,
        card_dim: {
          w: 220,
          h: 70,
          text_x: 75,
          text_y: 15,
          img_w: 60,
          img_h: 60,
          img_x: 5,
          img_y: 5,
        },
        card_display: [
          function (d) {
            return d.data["first name"] + " " + d.data["last name"];
          },
          function (d) {
            if (!d.data.birthday) return "";
            var age = App.calculateAge(d.data.birthday);
            return d.data.birthday + (age !== null ? " (גיל " + age + ")" : "");
          },
        ],
        mini_tree: true,
        transition_time: 400,
      });

      // הוספת אירוע לחיצה על כרטיס
      setTimeout(function () {
        container.querySelectorAll(".card").forEach(function (card) {
          card.style.cursor = "pointer";
          var personId = card.getAttribute("data-id");
          if (personId) {
            card.addEventListener("click", function () {
              App.viewMember(personId);
            });
          }
        });
      }, 500);
    } catch (err) {
      console.error("Family chart render error:", err);
      container.innerHTML =
        '<div class="empty-state"><div class="icon">⚠️</div><h3>שגיאה בטעינת העץ</h3><p>' +
        err.message +
        "</p></div>";
    }

    updateZoomDisplay();
  }

  // Zoom
  function zoomIn() {
    currentZoom = Math.min(2, currentZoom + 0.15);
    applyZoom();
  }

  function zoomOut() {
    currentZoom = Math.max(0.2, currentZoom - 0.15);
    applyZoom();
  }

  function zoomReset() {
    currentZoom = 1;
    applyZoom();
  }

  function zoomFit() {
    var container = document.getElementById("FamilyChart");
    if (!container) return;
    var svg = container.querySelector("svg");
    if (!svg) return;
    var bbox = svg.getBBox();
    var cW = container.clientWidth;
    var cH = container.clientHeight;
    if (bbox.width && bbox.height) {
      currentZoom = Math.max(
        0.2,
        Math.min(cW / (bbox.width + 100), cH / (bbox.height + 100), 1)
      );
    }
    applyZoom();
  }

  function applyZoom() {
    var container = document.getElementById("FamilyChart");
    if (!container) return;
    var svg = container.querySelector("svg");
    if (svg) {
      var g = svg.querySelector("g");
      if (g) {
        var currentTransform = g.getAttribute("transform") || "";
        // שמור translate קיים
        var translateMatch = currentTransform.match(/translate\([^)]+\)/);
        var translate = translateMatch ? translateMatch[0] : "translate(0,0)";
        g.setAttribute("transform", translate + " scale(" + currentZoom + ")");
      }
    }
    updateZoomDisplay();
  }

  function updateZoomDisplay() {
    var d = document.getElementById("zoomLevelDisplay");
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
    var container = document.getElementById("FamilyChart");
    if (!container) return;
    App.showToast("מכין תמונה...", "warning");
    loadLib(
      "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
      function () {
        html2canvas(container, {
          backgroundColor: "#FAFFF5",
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
              backgroundColor: "#FAFFF5",
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
      else if (document.webkitFullscreenElement)
        document.webkitExitFullscreen();
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
