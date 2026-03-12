const TreeRenderer = (() => {
    var lv = 3;
    var currentZoom = 1;
    var MIN_ZOOM = 0.2;
    var MAX_ZOOM = 2;
    var ZOOM_STEP = 0.15;

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
            var first = ms.length ? ms[0].id : '';
            s.value = first;
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
            if (person.parentId === parentIds[i] || person.parentId2 === parentIds[i]) {
                return true;
            }
        }
        return false;
    }

    // =============================================
    // ZOOM FUNCTIONS - FIX #4
    // =============================================
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
        var container = document.getElementById('treeContainer');
        var wrapper = document.getElementById('treeWrapper');
        if (!container || !wrapper) return;

        // Reset zoom first to measure real size
        currentZoom = 1;
        wrapper.style.transform = 'scale(1)';

        // Wait for reflow
        requestAnimationFrame(function() {
            var containerW = container.clientWidth - 40;
            var containerH = container.clientHeight - 40;
            var contentW = wrapper.scrollWidth;
            var contentH = wrapper.scrollHeight;

            if (contentW === 0 || contentH === 0) return;

            var scaleX = containerW / contentW;
            var scaleY = containerH / contentH;
            currentZoom = Math.min(scaleX, scaleY, 1); // Don't zoom in past 100%
            currentZoom = Math.max(currentZoom, MIN_ZOOM);

            applyZoom();

            // Scroll to center
            container.scrollLeft = (wrapper.scrollWidth * currentZoom - containerW) / 2;
            container.scrollTop = 0;
        });
    }

    function applyZoom() {
        var wrapper = document.getElementById('treeWrapper');
        var display = document.getElementById('zoomLevelDisplay');
        if (wrapper) {
            wrapper.style.transform = 'scale(' + currentZoom + ')';
            wrapper.style.transformOrigin = 'top center';
        }
        if (display) {
            display.textContent = Math.round(currentZoom * 100) + '%';
        }
    }

    // =============================================
    // EXPORT FUNCTIONS - FIX #5
    // =============================================
    function toggleExportMenu() {
        var menu = document.getElementById('exportDropdownContent');
        if (menu) {
            menu.classList.toggle('show');
            // Close on outside click
            if (menu.classList.contains('show')) {
                setTimeout(function() {
                    document.addEventListener('click', function closeExport(e) {
                        if (!e.target.closest('.export-dropdown')) {
                            menu.classList.remove('show');
                            document.removeEventListener('click', closeExport);
                        }
                    });
                }, 10);
            }
        }
    }

    function exportAsImage() {
        var menu = document.getElementById('exportDropdownContent');
        if (menu) menu.classList.remove('show');

        var wrapper = document.getElementById('treeWrapper');
        if (!wrapper) return;

        App.showToast('מכין תמונה... ⏳', 'warning');

        // Save current zoom and reset for export
        var savedZoom = currentZoom;
        wrapper.style.transform = 'scale(1)';

        // Use html2canvas
        loadHtml2Canvas(function() {
            html2canvas(wrapper, {
                backgroundColor: '#FAFFF5',
                scale: 2,
                useCORS: true,
                logging: false,
                scrollX: 0,
                scrollY: 0,
                windowWidth: wrapper.scrollWidth,
                windowHeight: wrapper.scrollHeight
            }).then(function(canvas) {
                var link = document.createElement('a');
                link.download = 'family-tree.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
                App.showToast('התמונה הורדה! 🖼️');

                // Restore zoom
                currentZoom = savedZoom;
                applyZoom();
            }).catch(function(err) {
                console.error('Export error:', err);
                App.showToast('שגיאה בייצוא', 'error');
                currentZoom = savedZoom;
                applyZoom();
            });
        });
    }

    function exportAsPDF() {
        var menu = document.getElementById('exportDropdownContent');
        if (menu) menu.classList.remove('show');

        var wrapper = document.getElementById('treeWrapper');
        if (!wrapper) return;

        App.showToast('מכין PDF... ⏳', 'warning');

        var savedZoom = currentZoom;
        wrapper.style.transform = 'scale(1)';

        loadHtml2Canvas(function() {
            loadJsPDF(function() {
                html2canvas(wrapper, {
                    backgroundColor: '#FAFFF5',
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    scrollX: 0,
                    scrollY: 0,
                    windowWidth: wrapper.scrollWidth,
                    windowHeight: wrapper.scrollHeight
                }).then(function(canvas) {
                    var imgData = canvas.toDataURL('image/png');
                    var imgW = canvas.width;
                    var imgH = canvas.height;

                    // Determine orientation
                    var orientation = imgW > imgH ? 'landscape' : 'portrait';
                    var pdf = new jspdf.jsPDF({
                        orientation: orientation,
                        unit: 'mm',
                        format: 'a4'
                    });

                    var pageW = pdf.internal.pageSize.getWidth();
                    var pageH = pdf.internal.pageSize.getHeight();
                    var margin = 10;
                    var availW = pageW - margin * 2;
                    var availH = pageH - margin * 2;

                    var ratio = Math.min(availW / imgW, availH / imgH);
                    var finalW = imgW * ratio;
                    var finalH = imgH * ratio;
                    var offsetX = margin + (availW - finalW) / 2;
                    var offsetY = margin + (availH - finalH) / 2;

                    pdf.addImage(imgData, 'PNG', offsetX, offsetY, finalW, finalH);
                    pdf.save('family-tree.pdf');
                    App.showToast('PDF הורד! 📄');

                    currentZoom = savedZoom;
                    applyZoom();
                }).catch(function(err) {
                    console.error('PDF export error:', err);
                    App.showToast('שגיאה בייצוא PDF', 'error');
                    currentZoom = savedZoom;
                    applyZoom();
                });
            });
        });
    }

    function loadHtml2Canvas(cb) {
        if (typeof html2canvas !== 'undefined') { cb(); return; }
        var s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload = cb;
        s.onerror = function() { App.showToast('שגיאה בטעינת ספרייה', 'error'); };
        document.head.appendChild(s);
    }

    function loadJsPDF(cb) {
        if (typeof jspdf !== 'undefined') { cb(); return; }
        var s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        s.onload = cb;
        s.onerror = function() { App.showToast('שגיאה בטעינת ספרייה', 'error'); };
        document.head.appendChild(s);
    }

    // =============================================
    // MAIN RENDER FUNCTION
    // =============================================
    function render() {
        var w = document.getElementById('treeWrapper');
        if (!w) return;
        var rid = document.getElementById('treeRoot')?.value;
        var sd = document.getElementById('showDivorced')?.checked ?? true;
        var sdc = document.getElementById('showDeceased')?.checked ?? true;
        var ms = App.getMembers();

        if (!rid || !ms.length) {
            w.innerHTML = '<div class="empty-state"><div class="icon">🌴</div><h3>בחרו שורש לעץ</h3><p>הוסיפו בני משפחה ובחרו מי יהיה בראש העץ</p></div>';
            return;
        }

        var root = ms.find(function(m) { return m.id === rid; });
        if (!root) return;

        var vis = {};

        function build(person, level, parentIds) {
            if (!person || level > lv || vis[person.id]) return '';
            vis[person.id] = true;
            if (person.status === 'deceased' && !sdc) return '';

            // Find spouses
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

            // Find children
            var children = ms.filter(function(c) {
                if (vis[c.id]) return false;
                if (c.status === 'deceased' && !sdc) return false;
                return allParentIds.indexOf(c.parentId) !== -1 ||
                       (c.parentId2 && allParentIds.indexOf(c.parentId2) !== -1);
            });

            // Group children by spouse pair - FIX #2
            var childGroups = [];
            spouses.forEach(function(sp) {
                var spouseChildren = children.filter(function(c) {
                    var parentPair = [person.id, sp.member.id];
                    return (parentPair.indexOf(c.parentId) !== -1 && parentPair.indexOf(c.parentId2) !== -1) ||
                           (parentPair.indexOf(c.parentId) !== -1 && !c.parentId2) ||
                           (parentPair.indexOf(c.parentId2) !== -1 && !c.parentId);
                });
                if (spouseChildren.length > 0) {
                    childGroups.push({ spouse: sp, children: spouseChildren });
                }
            });

            var assignedChildren = [];
            childGroups.forEach(function(g) {
                g.children.forEach(function(c) { assignedChildren.push(c.id); });
            });
            var soloChildren = children.filter(function(c) {
                return assignedChildren.indexOf(c.id) === -1;
            });

            // Build HTML
            var h = '<div class="tree-family-unit">';
            h += buildCouple(person, spouses, parentIds);

            // Children section
            var hasChildren = childGroups.length > 0 || soloChildren.length > 0;
            if (hasChildren && level < lv) {
                h += '<div class="tree-vertical-line"></div>';

                // Build all children with family group separators
                var allChildEntries = []; // { type: 'child', child: c } or { type: 'separator' }

                childGroups.forEach(function(g, gIdx) {
                    g.children.forEach(function(c) {
                        allChildEntries.push({ type: 'child', child: c });
                    });
                    // Add separator between groups
                    if (gIdx < childGroups.length - 1 || soloChildren.length > 0) {
                        allChildEntries.push({ type: 'separator' });
                    }
                });
                soloChildren.forEach(function(c, idx) {
                    allChildEntries.push({ type: 'child', child: c });
                    if (idx < soloChildren.length - 1) {
                        // No separator between solo children
                    }
                });

                // Remove trailing separator
                while (allChildEntries.length && allChildEntries[allChildEntries.length - 1].type === 'separator') {
                    allChildEntries.pop();
                }

                // Count actual children for line calculations
                var childCount = allChildEntries.filter(function(e) { return e.type === 'child'; }).length;

                // We use a special wrapper that we will post-process with JS
                h += '<div class="tree-children-wrapper" data-child-count="' + childCount + '">';

                // Build children HTML
                h += '<div class="tree-children-row">';
                allChildEntries.forEach(function(entry) {
                    if (entry.type === 'separator') {
                        h += '<div class="family-group-separator"></div>';
                    } else if (!vis[entry.child.id]) {
                        h += '<div class="tree-child-branch">';
                        h += '<div class="tree-child-connector"></div>';
                        h += build(entry.child, level + 1, allParentIds);
                        h += '</div>';
                    }
                });
                h += '</div>';
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
                var isPersonChild = parentIds && parentIds.length > 0 &&
                    isChildOf(person, parentIds);

                spouses.forEach(function(sp, idx) {
                    vis[sp.member.id] = true;

                    var leftPerson, rightPerson, leftIsChild, rightIsChild;

                    if (person.gender === 'male') {
                        leftPerson = sp.member;
                        rightPerson = person;
                        leftIsChild = !isPersonChild;
                        rightIsChild = isPersonChild;
                    } else {
                        leftPerson = person;
                        rightPerson = sp.member;
                        leftIsChild = isPersonChild;
                        rightIsChild = !isPersonChild;
                    }

                    var isSpouseChild = parentIds && parentIds.length > 0 &&
                        isChildOf(sp.member, parentIds);
                    if (isSpouseChild) {
                        leftIsChild = (leftPerson.id === sp.member.id);
                        rightIsChild = (rightPerson.id === sp.member.id);
                    }

                    if (idx > 0) {
                        h += '<div class="couple-spacer"></div>';
                    }

                    h += '<div class="couple-pair">';
                    h += '<div class="couple-member' + (leftIsChild ? ' is-child-anchor' : '') + '">';
                    h += nodeHTML(leftPerson, false);
                    h += '</div>';
                    h += '<div class="couple-connector">';
                    h += '<div class="couple-line ' + (sp.isEx ? 'ex-line' : 'married-line') + '"></div>';
                    h += '<span class="couple-symbol">' + (sp.isEx ? '💔' : '❤️') + '</span>';
                    h += '</div>';
                    h += '<div class="couple-member' + (rightIsChild ? ' is-child-anchor' : '') + '">';
                    h += nodeHTML(rightPerson, false);
                    h += '</div>';
                    h += '</div>';
                });
            }

            h += '</div>';
            return h;
        }

        function nodeHTML(p, isSingle) {
            var age = App.calculateAge(p.birthDate, p.deathDate);
            var gc = p.gender === 'male' ? 'male' : 'female';
            if (p.status === 'deceased') gc += ' deceased';
            var bg = p.gender === 'male' ? 'var(--male)' : 'var(--female)';
            var cm = (typeof DragConnect !== 'undefined' && DragConnect.isActive) ? DragConnect.isActive() : false;
            var emoji = getPersonEmoji(p.gender, p.birthDate, p.deathDate);

            var html = '<div class="tree-person ' + gc + (cm ? ' connectable' : '') + (isSingle ? ' single' : '') + '" data-member-id="' + p.id + '" '
                + (cm ? '' : 'onclick="App.viewMember(\'' + p.id + '\')"') + '>';

            html += '<div class="tree-person-photo">';
            if (p.photo) {
                html += '<img src="' + p.photo + '">';
            } else {
                html += '<div class="tree-person-emoji" style="background:' + bg + '">' + emoji + '</div>';
            }
            html += '</div>';
            html += '<div class="tree-person-name">' + p.firstName + ' ' + p.lastName + '</div>';
            if (p.birthDate) {
                html += '<div class="tree-person-date">' + formatBirthDate(p.birthDate) + '</div>';
            }
            if (age !== null) {
                html += '<div class="tree-person-age">' + (p.status === 'deceased' ? '🕯️ ' : '') + 'גיל ' + age + '</div>';
            } else if (p.status === 'deceased') {
                html += '<div class="tree-person-age">🕯️</div>';
            }
            html += '</div>';
            return html;
        }

        w.innerHTML = build(root, 1, []);

        // Post-process: draw accurate connecting lines - FIX #1 and #3
        requestAnimationFrame(function() {
            drawConnectingLines();
        });

        // Apply current zoom
        applyZoom();

        if (typeof DragConnect !== 'undefined' && DragConnect.isActive && DragConnect.isActive()) {
            DragConnect.toggleMode();
            DragConnect.toggleMode();
        }
    }

    // =============================================
    // PRECISE LINE DRAWING - FIX #1 and #3
    // =============================================
    function drawConnectingLines() {
        var wrappers = document.querySelectorAll('.tree-children-wrapper');

        wrappers.forEach(function(wrapper) {
            var row = wrapper.querySelector('.tree-children-row');
            if (!row) return;

            // Set row styles
            row.style.display = 'flex';
            row.style.justifyContent = 'center';
            row.style.position = 'relative';
            row.style.paddingTop = '20px';

            var branches = row.querySelectorAll(':scope > .tree-child-branch');
            if (branches.length === 0) return;

            // Remove old lines
            var oldSVG = wrapper.querySelector('.connector-svg');
            if (oldSVG) oldSVG.remove();

            if (branches.length <= 1) return; // Single child - vertical line is enough

            // Get positions relative to the row
            var rowRect = row.getBoundingClientRect();

            var centers = [];
            branches.forEach(function(branch) {
                var connector = branch.querySelector('.tree-child-connector');
                if (connector) {
                    var rect = connector.getBoundingClientRect();
                    centers.push({
                        x: rect.left + rect.width / 2 - rowRect.left,
                        top: rect.top - rowRect.top
                    });
                }
            });

            if (centers.length < 2) return;

            // Draw SVG for horizontal line - precisely from first to last child center
            var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.classList.add('connector-svg');
            svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:20px;pointer-events:none;overflow:visible;';

            var leftMost = centers[0].x;
            var rightMost = centers[centers.length - 1].x;

            // Horizontal line - exactly from first child center to last child center - FIX #3
            var hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            hLine.setAttribute('x1', leftMost);
            hLine.setAttribute('y1', 0);
            hLine.setAttribute('x2', rightMost);
            hLine.setAttribute('y2', 0);
            hLine.setAttribute('stroke', '#A5D6A7');
            hLine.setAttribute('stroke-width', '2');
            svg.appendChild(hLine);

            // Vertical drops to each child - FIX #1
            centers.forEach(function(c) {
                var vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                vLine.setAttribute('x1', c.x);
                vLine.setAttribute('y1', 0);
                vLine.setAttribute('x2', c.x);
                vLine.setAttribute('y2', 20);
                vLine.setAttribute('stroke', '#A5D6A7');
                vLine.setAttribute('stroke-width', '2');
                svg.appendChild(vLine);
            });

            row.insertBefore(svg, row.firstChild);

            // Hide the CSS connectors since we're using SVG
            branches.forEach(function(branch) {
                var connector = branch.querySelector('.tree-child-connector');
                if (connector) connector.style.display = 'none';
            });
        });
    }

    // Redraw lines on window resize
    var resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            drawConnectingLines();
        }, 200);
    });

    // Wheel zoom on tree container - FIX #4
    document.addEventListener('DOMContentLoaded', function() {
        var container = document.getElementById('treeContainer');
        if (container) {
            container.addEventListener('wheel', function(e) {
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    if (e.deltaY < 0) zoomIn();
                    else zoomOut();
                }
            }, { passive: false });
        }
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
        toggleExportMenu: toggleExportMenu
    };
})();