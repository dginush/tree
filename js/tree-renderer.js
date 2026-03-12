const TreeRenderer = (() => {
    var lv = 3;

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

    // Check if a person is a child of any of the given parent IDs
    function isChildOf(person, parentIds) {
        if (!person) return false;
        for (var i = 0; i < parentIds.length; i++) {
            if (person.parentId === parentIds[i] || person.parentId2 === parentIds[i]) {
                return true;
            }
        }
        return false;
    }

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

        // parentIds = IDs of the parents above this person
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

            // All parent IDs for finding children
            var allParentIds = [person.id];
            spouses.forEach(function(sp) { allParentIds.push(sp.member.id); });

            // Find children
            var children = ms.filter(function(c) {
                if (vis[c.id]) return false;
                if (c.status === 'deceased' && !sdc) return false;
                return allParentIds.indexOf(c.parentId) !== -1 ||
                       (c.parentId2 && allParentIds.indexOf(c.parentId2) !== -1);
            });

            // Group children by which spouse pair they belong to
            var childGroups = [];

            // Children of person + each spouse
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

            // Children with only person as parent (no spouse match)
            var assignedChildren = [];
            childGroups.forEach(function(g) {
                g.children.forEach(function(c) { assignedChildren.push(c.id); });
            });
            var soloChildren = children.filter(function(c) {
                return assignedChildren.indexOf(c.id) === -1;
            });

            // Build HTML
            var h = '<div class="tree-family-unit">';

            // Build couple display
            h += buildCouple(person, spouses, parentIds);

            // Children section
            var hasChildren = childGroups.length > 0 || soloChildren.length > 0;
            if (hasChildren && level < lv) {
                h += '<div class="tree-vertical-line"></div>';

                // All children in one container
                var allChildrenToBuild = [];
                childGroups.forEach(function(g) {
                    g.children.forEach(function(c) { allChildrenToBuild.push(c); });
                });
                soloChildren.forEach(function(c) { allChildrenToBuild.push(c); });

                h += '<div class="tree-children' + (allChildrenToBuild.length > 1 ? ' multiple' : '') + '">';
                allChildrenToBuild.forEach(function(c) {
                    if (!vis[c.id]) {
                        h += '<div class="tree-child-branch">';
                        h += '<div class="tree-child-connector"></div>';
                        h += build(c, level + 1, allParentIds);
                        h += '</div>';
                    }
                });
                h += '</div>';
            }

            h += '</div>';
            return h;
        }

        // Build the couple display with correct positioning
        // The child (person connected to parents above) is the anchor point
        // Spouse is positioned to the side
        function buildCouple(person, spouses, parentIds) {
            var h = '<div class="tree-couple">';

            if (spouses.length === 0) {
                // Single person, no spouse
                h += nodeHTML(person, true);
            } else {
                // Person + spouse(s)
                // Determine order: male on right, female on left
                // The person who is the CHILD (connected to parents above)
                // should be the anchor
                var isPersonChild = parentIds && parentIds.length > 0 &&
                    isChildOf(person, parentIds);

                spouses.forEach(function(sp, idx) {
                    vis[sp.member.id] = true;

                    var leftPerson, rightPerson, leftIsChild, rightIsChild;

                    // Option G: male right, female left
                    if (person.gender === 'male') {
                        // Person (male) on right, spouse (female) on left
                        leftPerson = sp.member;
                        rightPerson = person;
                        leftIsChild = !isPersonChild;
                        rightIsChild = isPersonChild;
                    } else {
                        // Person (female) on left, spouse (male) on right
                        leftPerson = person;
                        rightPerson = sp.member;
                        leftIsChild = isPersonChild;
                        rightIsChild = !isPersonChild;
                    }

                    // If spouse is actually the child of parents above
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

                    // Left person
                    h += '<div class="couple-member' + (leftIsChild ? ' is-child-anchor' : '') + '">';
                    h += nodeHTML(leftPerson, false);
                    h += '</div>';

                    // Connector
                    h += '<div class="couple-connector">';
                    h += '<div class="couple-line ' + (sp.isEx ? 'ex-line' : 'married-line') + '"></div>';
                    h += '<span class="couple-symbol">' + (sp.isEx ? '💔' : '❤️') + '</span>';
                    h += '</div>';

                    // Right person
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

        if (typeof DragConnect !== 'undefined' && DragConnect.isActive && DragConnect.isActive()) {
            DragConnect.toggleMode();
            DragConnect.toggleMode();
        }
    }

    return { setLevel: setLevel, populateRootSelect: populateRootSelect, render: render };
})();