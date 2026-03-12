const TreeRenderer = (() => {
    var lv = 3;
    var currentZoom = 1;
    var MIN_ZOOM = 0.2;
    var MAX_ZOOM = 2;
    var ZOOM_STEP = 0.15;
    var R = 10; // Rounded corner radius

    function setLevel(n, el) {
        lv = n;
        document.querySelectorAll('.level-btn').forEach(function(b) { b.classList.remove('active'); });
        if (el) el.classList.add('active');
        render();
    }

    function populateRootSelect() {
        var s = document.getElementById('treeRoot');
        if (!s) return;
        var ms = App.getMembers(), cv = s.value;
        s.innerHTML = '<option value="">-- בחרו שורש --</option>';
        ms.forEach(function(m) {
            var o = document.createElement('option');
            o.value = m.id;
            o.textContent = m.firstName + ' ' + m.lastName;
            s.appendChild(o);
        });
        if (cv && ms.find(function(m) { return m.id === cv; })) {
            s.value = cv;
        } else {
            s.value = ms.length ? ms[0].id : '';
        }
    }

    function getPersonEmoji(gender, birthDate, deathDate) {
        var age = App.calculateAge(birthDate, deathDate);
        if (age === null) return gender === 'male' ? '👨' : '👩';
        if (gender === 'male') {
            if (age < 4) return '👶';
            if (age < 13) return '👦';
            if (age < 60) return '👨';
            return '👴';
        } else {
            if (age < 4) return '👶';
            if (age < 13) return '👧';
            if (age < 60) return '👩';
            return '👵';
        }
    }

    function formatBirthDate(dateStr) {
        if (!dateStr) return '';
        var p = dateStr.split('/');
        if (p.length !== 3) return dateStr;
        return p[0] + '.' + p[1] + '.' + p[2];
    }

    function isChildOf(person, parentIds) {
        if (!person) return false;
        for (var i = 0; i < parentIds.length; i++) {
            if (person.parentId === parentIds[i] || person.parentId2 === parentIds[i]) return true;
        }
        return false;
    }

    // Zoom
    function zoomIn() { currentZoom = Math.min(MAX_ZOOM, currentZoom + ZOOM_STEP); applyZoom(); }
    function zoomOut() { currentZoom = Math.max(MIN_ZOOM, currentZoom - ZOOM_STEP); applyZoom(); }
    function zoomReset() { currentZoom = 1; applyZoom(); }
    function zoomFit() {
        var c = document.getElementById('treeContainer'), w = document.getElementById('treeWrapper');
        if (!c || !w) return;
        currentZoom = 1; w.style.transform = 'scale(1)';
        requestAnimationFrame(function() {
            var cW = c.clientWidth - 40, cH = c.clientHeight - 40;
            var wW = w.scrollWidth, wH = w.scrollHeight;
            if (!wW || !wH) return;
            currentZoom = Math.max(MIN_ZOOM, Math.min(cW / wW, cH / wH, 1));
            applyZoom();
        });
    }
    function applyZoom() {
        var w = document.getElementById('treeWrapper');
        var d = document.getElementById('zoomLevelDisplay');
        if (w) { w.style.transform = 'scale(' + currentZoom + ')'; w.style.transformOrigin = 'top center'; }
        if (d) d.textContent = Math.round(currentZoom * 100) + '%';
    }

    // Export
    function toggleExportMenu() {
        var m = document.getElementById('exportDropdownContent');
        if (m) { m.classList.toggle('show'); if (m.classList.contains('show')) setTimeout(function() { document.addEventListener('click', function cl(e) { if (!e.target.closest('.export-dropdown')) { m.classList.remove('show'); document.removeEventListener('click', cl); } }); }, 10); }
    }
    function loadLib(url, cb) { if (url.indexOf('html2canvas') >= 0 && typeof html2canvas !== 'undefined') { cb(); return; } if (url.indexOf('jspdf') >= 0 && typeof jspdf !== 'undefined') { cb(); return; } var s = document.createElement('script'); s.src = url; s.onload = cb; document.head.appendChild(s); }
    function exportAsImage() {
        var m = document.getElementById('exportDropdownContent'); if (m) m.classList.remove('show');
        var w = document.getElementById('treeWrapper'); if (!w) return;
        App.showToast('מכין תמונה...', 'warning');
        var sz = currentZoom; w.style.transform = 'scale(1)';
        // Need to redraw connectors at scale 1
        requestAnimationFrame(function() { drawAllConnectors(); requestAnimationFrame(function() {
        loadLib('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', function() {
            html2canvas(w, { backgroundColor: '#FAFFF5', scale: 2, useCORS: true }).then(function(canvas) {
                var a = document.createElement('a'); a.download = 'family-tree.png'; a.href = canvas.toDataURL('image/png'); a.click();
                App.showToast('התמונה הורדה! 🖼️'); currentZoom = sz; applyZoom(); drawAllConnectors();
            }).catch(function() { App.showToast('שגיאה', 'error'); currentZoom = sz; applyZoom(); drawAllConnectors(); });
        }); }); });
    }
    function exportAsPDF() {
        var m = document.getElementById('exportDropdownContent'); if (m) m.classList.remove('show');
        var w = document.getElementById('treeWrapper'); if (!w) return;
        App.showToast('מכין PDF...', 'warning');
        var sz = currentZoom; w.style.transform = 'scale(1)';
        requestAnimationFrame(function() { drawAllConnectors(); requestAnimationFrame(function() {
        loadLib('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', function() {
            loadLib('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', function() {
                html2canvas(w, { backgroundColor: '#FAFFF5', scale: 2, useCORS: true }).then(function(canvas) {
                    var img = canvas.toDataURL('image/png');
                    var o = canvas.width > canvas.height ? 'landscape' : 'portrait';
                    var pdf = new jspdf.jsPDF({ orientation: o, unit: 'mm', format: 'a4' });
                    var pW = pdf.internal.pageSize.getWidth() - 20, pH = pdf.internal.pageSize.getHeight() - 20;
                    var r = Math.min(pW / canvas.width, pH / canvas.height);
                    pdf.addImage(img, 'PNG', 10 + (pW - canvas.width * r) / 2, 10 + (pH - canvas.height * r) / 2, canvas.width * r, canvas.height * r);
                    pdf.save('family-tree.pdf'); App.showToast('PDF הורד! 📄');
                    currentZoom = sz; applyZoom(); drawAllConnectors();
                }).catch(function() { App.showToast('שגיאה', 'error'); currentZoom = sz; applyZoom(); drawAllConnectors(); });
            });
        }); }); });
    }

    // =============================================
    // RENDER
    // =============================================
    function render() {
        var w = document.getElementById('treeWrapper');
        if (!w) return;
        var rid = document.getElementById('treeRoot')?.value;
        var sd = document.getElementById('showDivorced')?.checked ?? true;
        var sdc = document.getElementById('showDeceased')?.checked ?? true;
        var ms = App.getMembers();

        if (!rid || !ms.length) {
            w.innerHTML = '<div class="empty-state"><div class="icon">🌴</div><h3>בחרו שורש לעץ</h3></div>';
            return;
        }

        var root = ms.find(function(m) { return m.id === rid; });
        if (!root) return;
        var vis = {};

        function build(person, level, parentIds) {
            if (!person || level > lv || vis[person.id]) return '';
            vis[person.id] = true;
            if (person.status === 'deceased' && !sdc) return '';

            var spouses = [];
            ms.forEach(function(m) {
                if (vis[m.id]) return;
                if (m.spouseId === person.id || person.spouseId === m.id) {
                    var ex = m.isExSpouse || m.relationType === 'ex-spouse';
                    if (ex && !sd) return;
                    if (m.status === 'deceased' && !sdc) return;
                    spouses.push({ member: m, isEx: ex });
                }
            });

            var allParentIds = [person.id];
            spouses.forEach(function(sp) { allParentIds.push(sp.member.id); });

            var children = ms.filter(function(c) {
                if (vis[c.id]) return false;
                if (c.status === 'deceased' && !sdc) return false;
                return allParentIds.indexOf(c.parentId) !== -1 ||
                       (c.parentId2 && allParentIds.indexOf(c.parentId2) !== -1);
            });

            var childGroups = [];
            spouses.forEach(function(sp) {
                var spCh = children.filter(function(c) {
                    var pp = [person.id, sp.member.id];
                    return (pp.indexOf(c.parentId) !== -1 && pp.indexOf(c.parentId2) !== -1) ||
                           (pp.indexOf(c.parentId) !== -1 && !c.parentId2) ||
                           (pp.indexOf(c.parentId2) !== -1 && !c.parentId);
                });
                if (spCh.length > 0) childGroups.push({ children: spCh });
            });
            var assigned = {};
            childGroups.forEach(function(g) { g.children.forEach(function(c) { assigned[c.id] = true; }); });
            var solo = children.filter(function(c) { return !assigned[c.id]; });

            var h = '<div class="tree-family-unit" data-person-id="' + person.id + '">';
            h += buildCouple(person, spouses, parentIds);

            var allCh = [];
            childGroups.forEach(function(g, gi) {
                g.children.forEach(function(c) { allCh.push({ child: c, group: gi }); });
            });
            var lastGroup = childGroups.length - 1;
            solo.forEach(function(c) { allCh.push({ child: c, group: lastGroup + 1 }); });

            if (allCh.length > 0 && level < lv) {
                h += '<div class="tree-children-area">';
                var prevGroup = -1;
                allCh.forEach(function(entry) {
                    if (prevGroup !== -1 && entry.group !== prevGroup) {
                        h += '<div class="family-group-separator"></div>';
                    }
                    prevGroup = entry.group;
                    if (!vis[entry.child.id]) {
                        h += '<div class="tree-child-branch">';
                        h += build(entry.child, level + 1, allParentIds);
                        h += '</div>';
                    }
                });
                h += '</div>';
            }

            h += '</div>';
            return h;
        }

        function buildCouple(person, spouses, parentIds) {
            var h = '<div class="tree-couple">';
            if (spouses.length === 0) {
                h += nodeHTML(person, true);
            } else {
                var isPC = parentIds && parentIds.length > 0 && isChildOf(person, parentIds);
                spouses.forEach(function(sp, idx) {
                    vis[sp.member.id] = true;
                    var lp, rp, lc, rc;
                    if (person.gender === 'male') {
                        lp = sp.member; rp = person;
                        lc = false; rc = isPC;
                    } else {
                        lp = person; rp = sp.member;
                        lc = isPC; rc = false;
                    }
                    var isSC = parentIds && parentIds.length > 0 && isChildOf(sp.member, parentIds);
                    if (isSC) { lc = (lp.id === sp.member.id); rc = (rp.id === sp.member.id); }
                    if (!isSC && isPC) { lc = (lp.id === person.id); rc = (rp.id === person.id); }

                    if (idx > 0) h += '<div class="couple-spacer"></div>';
                    h += '<div class="couple-pair">';
                    h += '<div class="couple-member' + (lc ? ' is-child-anchor' : '') + '">' + nodeHTML(lp, false) + '</div>';
                    h += '<div class="couple-connector"><div class="couple-line ' + (sp.isEx ? 'ex-line' : 'married-line') + '"></div>';
                    h += '<span class="couple-symbol">' + (sp.isEx ? '💔' : '❤️') + '</span></div>';
                    h += '<div class="couple-member' + (rc ? ' is-child-anchor' : '') + '">' + nodeHTML(rp, false) + '</div>';
                    h += '</div>';
                });
            }
            h += '</div>';
            return h;
        }

        function nodeHTML(p) {
            var age = App.calculateAge(p.birthDate, p.deathDate);
            var gc = p.gender === 'male' ? 'male' : 'female';
            if (p.status === 'deceased') gc += ' deceased';
            var bg = p.gender === 'male' ? 'var(--male)' : 'var(--female)';
            var cm = (typeof DragConnect !== 'undefined' && DragConnect.isActive) ? DragConnect.isActive() : false;
            var emoji = getPersonEmoji(p.gender, p.birthDate, p.deathDate);

            var html = '<div class="tree-person ' + gc + (cm ? ' connectable' : '') + '" data-member-id="' + p.id + '" '
                + (cm ? '' : 'onclick="App.viewMember(\'' + p.id + '\')"') + '>';
            html += '<div class="tree-person-photo">';
            html += p.photo ? '<img src="' + p.photo + '">' : '<div class="tree-person-emoji" style="background:' + bg + '">' + emoji + '</div>';
            html += '</div>';
            html += '<div class="tree-person-name">' + p.firstName + ' ' + p.lastName + '</div>';
            if (p.birthDate) html += '<div class="tree-person-date">' + formatBirthDate(p.birthDate) + '</div>';
            if (age !== null) html += '<div class="tree-person-age">' + (p.status === 'deceased' ? '🕯️ ' : '') + 'גיל ' + age + '</div>';
            else if (p.status === 'deceased') html += '<div class="tree-person-age">🕯️</div>';
            html += '</div>';
            return html;
        }

        w.innerHTML = build(root, 1, []);

        // Draw connectors after layout
        requestAnimationFrame(function() {
            requestAnimationFrame(function() {
                drawAllConnectors();
            });
        });

        applyZoom();
    }

    // =============================================
    // SVG CONNECTOR DRAWING WITH ROUNDED CORNERS
    // =============================================
    function drawAllConnectors() {
        var wrapper = document.getElementById('treeWrapper');
        if (!wrapper) return;

        // Remove old SVG
        var old = wrapper.querySelector('.tree-svg-connectors');
        if (old) old.remove();

        wrapper.style.position = 'relative';
        var wRect = wrapper.getBoundingClientRect();

        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('tree-svg-connectors');
        svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:0;';
        svg.setAttribute('width', wrapper.scrollWidth);
        svg.setAttribute('height', wrapper.scrollHeight);

        var COLOR = '#4CAF50';
        var COLOR_LIGHT = '#A5D6A7';
        var WIDTH = 2;
        var GAP = 22; // vertical gap between levels

        // Process each family unit that has children
        var units = wrapper.querySelectorAll('.tree-family-unit');
        units.forEach(function(unit) {
            var childArea = unit.querySelector(':scope > .tree-children-area');
            if (!childArea) return;

            var coupleEl = unit.querySelector(':scope > .tree-couple');
            if (!coupleEl) return;

            var branches = childArea.querySelectorAll(':scope > .tree-child-branch');
            if (branches.length === 0) return;

            // Parent bottom center
            var cRect = coupleEl.getBoundingClientRect();
            var px = cRect.left + cRect.width / 2 - wRect.left;
            var py = cRect.bottom - wRect.top;

            // Children top centers
            var childPts = [];
            branches.forEach(function(br) {
                var fu = br.querySelector(':scope > .tree-family-unit');
                if (!fu) return;
                var fc = fu.querySelector(':scope > .tree-couple');
                if (!fc) return;

                // Find the anchor (child member) in the couple
                var anchor = fc.querySelector('.couple-member.is-child-anchor .tree-person');
                if (!anchor) {
                    // Try single person
                    anchor = fc.querySelector('.tree-person');
                }
                if (!anchor) anchor = fc;

                var aRect = anchor.getBoundingClientRect();
                childPts.push({
                    x: aRect.left + aRect.width / 2 - wRect.left,
                    y: aRect.top - wRect.top
                });
            });

            if (childPts.length === 0) return;

            // Mid Y point for the horizontal bracket
            var midY = py + GAP;

            // Ensure midY is between parent bottom and first child top
            var minChildY = Infinity;
            childPts.forEach(function(cp) { if (cp.y < minChildY) minChildY = cp.y; });
            if (midY > minChildY - 5) midY = (py + minChildY) / 2;

            // ---- DRAW WITH ROUNDED CORNERS ----

            // 1. Vertical stem: parent bottom → midY
            addLine(svg, px, py, px, midY, COLOR, WIDTH);

            if (childPts.length === 1) {
                // Single child: stem continues down to child
                var cp = childPts[0];
                if (Math.abs(cp.x - px) < 3) {
                    // Straight line
                    addLine(svg, px, midY, cp.x, cp.y, COLOR, WIDTH);
                } else {
                    // Rounded L-shape
                    drawRoundedL(svg, px, midY, cp.x, cp.y, R, COLOR, WIDTH);
                }
            } else {
                // Multiple children
                var leftX = Infinity, rightX = -Infinity;
                childPts.forEach(function(cp) {
                    if (cp.x < leftX) leftX = cp.x;
                    if (cp.x > rightX) rightX = cp.x;
                });

                // 2. Horizontal bracket: leftX → rightX at midY
                addLine(svg, leftX, midY, rightX, midY, COLOR, WIDTH);

                // 3. Drop from bracket to each child - with rounded corners
                childPts.forEach(function(cp) {
                    drawRoundedDrop(svg, cp.x, midY, cp.x, cp.y, R, COLOR, WIDTH);
                });
            }
        });

        wrapper.insertBefore(svg, wrapper.firstChild);
    }

    // Draw a simple line
    function addLine(svg, x1, y1, x2, y2, color, width) {
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', width);
        line.setAttribute('stroke-linecap', 'round');
        svg.appendChild(line);
    }

    // Draw an L-shaped connector with rounded corner
    // From (x1,y1) going down to horizontal level, then across to (x2,y2)
    function drawRoundedL(svg, x1, y1, x2, y2, r, color, width) {
        var dx = x2 - x1;
        var dy = y2 - y1;
        var dir = dx > 0 ? 1 : -1;
        var cr = Math.min(r, Math.abs(dx), Math.abs(dy) / 2);

        var d;
        if (cr < 1) {
            // No room for radius, just straight lines
            d = 'M' + x1 + ',' + y1 + ' L' + x1 + ',' + y2 + ' L' + x2 + ',' + y2;
        } else {
            // Horizontal at y1, then curve down, then vertical to y2
            d = 'M' + x1 + ',' + y1 +
                ' L' + (x2 - dir * cr) + ',' + y1 +
                ' Q' + x2 + ',' + y1 + ' ' + x2 + ',' + (y1 + cr) +
                ' L' + x2 + ',' + y2;
        }

        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', width);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        svg.appendChild(path);
    }

    // Draw a vertical drop from (x1,y1) to (x1,y2) with rounded corner at top
    // The top of the drop connects to a horizontal line at y1
    function drawRoundedDrop(svg, x1, y1, x2, y2, r, color, width) {
        var dropH = y2 - y1;
        if (dropH <= 0) return;

        // Simple vertical line for the drop - the rounding happens at the junction
        // We draw the drop as a path that starts with a tiny curve from horizontal to vertical
        var cr = Math.min(r, dropH / 3);

        // The drop just needs to be a vertical line from the bracket
        // Rounded corners at the T-junction are created by making the horizontal line
        // and vertical drops as separate rounded-cap paths
        addLine(svg, x1, y1, x2, y2, color, width);
    }

    // Resize handler
    var _rt;
    window.addEventListener('resize', function() {
        clearTimeout(_rt);
        _rt = setTimeout(drawAllConnectors, 250);
    });

    // Ctrl+wheel zoom
    document.addEventListener('DOMContentLoaded', function() {
        var c = document.getElementById('treeContainer');
        if (c) c.addEventListener('wheel', function(e) {
            if (e.ctrlKey || e.metaKey) { e.preventDefault(); e.deltaY < 0 ? zoomIn() : zoomOut(); }
        }, { passive: false });
    });

    return {
        setLevel: setLevel, populateRootSelect: populateRootSelect, render: render,
        zoomIn: zoomIn, zoomOut: zoomOut, zoomReset: zoomReset, zoomFit: zoomFit,
        exportAsImage: exportAsImage, exportAsPDF: exportAsPDF, toggleExportMenu: toggleExportMenu
    };
})();