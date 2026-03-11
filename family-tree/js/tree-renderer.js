const TreeRenderer = (() => {
    let lv = 3;

    function setLevel(n, el) {
        lv = n;
        document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
        if (el) el.classList.add('active');
        render();
    }

    function populateRootSelect() {
        const s = document.getElementById('treeRoot');
        if (!s) return;
        const ms = App.getMembers(), cv = s.value;
        s.innerHTML = '<option value="">--</option>';
        ms.forEach(m => {
            const o = document.createElement('option');
            o.value = m.id;
            o.textContent = m.firstName + ' ' + m.lastName;
            s.appendChild(o);
        });
        if (cv && ms.find(m => m.id === cv)) s.value = cv;
        else {
            const sl = ms.find(m => m.relationType === 'self');
            if (sl) s.value = sl.id;
            else if (ms.length) s.value = ms[0].id;
        }
    }

    function render() {
        const w = document.getElementById('treeWrapper');
        if (!w) return;
        const rid = document.getElementById('treeRoot')?.value;
        const sd = document.getElementById('showDivorced')?.checked ?? true;
        const sdc = document.getElementById('showDeceased')?.checked ?? true;
        const ms = App.getMembers();
        if (!rid || !ms.length) {
            w.innerHTML = '<div class="empty-state"><div class="icon">🌴</div><h3>בחרו שורש</h3></div>';
            return;
        }
        const root = ms.find(m => m.id === rid);
        if (!root) return;
        const vis = new Set();

        function build(p, l) {
            if (!p || l > lv || vis.has(p.id)) return '';
            vis.add(p.id);
            if (p.status === 'deceased' && !sdc) return '';
            const sps = [];
            ms.forEach(m => {
                if (vis.has(m.id)) return;
                if (m.spouseId === p.id || p.spouseId === m.id) {
                    const ex = m.isExSpouse || m.relationType === 'ex-spouse';
                    if (ex && !sd) return;
                    if (m.status === 'deceased' && !sdc) return;
                    sps.push({ member: m, isEx: ex });
                }
            });
            const pids = [p.id, ...sps.map(s => s.member.id)];
            const ch = ms.filter(c => {
                if (c.status === 'deceased' && !sdc) return false;
                return pids.includes(c.parentId);
            });
            let h = '<div class="tree-node"><div class="couple-display">';
            h += nH(p);
            sps.forEach(sp => {
                vis.add(sp.member.id);
                h += '<div class="couple-link-box">';
                if (sp.isEx) h += '<span class="ex-label">💔</span>';
                h += '<span class="couple-link">' + (sp.isEx ? '💔' : '❤️') + '</span></div>';
                h += nH(sp.member);
            });
            h += '</div>';
            if (ch.length && l < lv) {
                h += '<div class="tree-connector"></div><div class="children-container">';
                ch.forEach(c => { if (!vis.has(c.id)) h += '<div class="child-branch">' + build(c, l + 1) + '</div>'; });
                h += '</div>';
            }
            h += '</div>';
            return h;
        }

        function nH(p) {
            const age = App.calculateAge(p.birthDate, p.deathDate);
            let gc = p.gender === 'male' ? 'male' : 'female';
            if (p.status === 'deceased') gc = 'deceased';
            const heb = HebrewDate.fromDateString(p.birthDate);
            const ini = App.getInitials(p.firstName, p.lastName);
            const bg = p.gender === 'male' ? 'var(--male)' : 'var(--female)';
            const cm = DragConnect.isActive();
            return '<div class="tree-node-content ' + gc + (cm ? ' connectable' : '') + '" data-member-id="' + p.id + '" ' + (cm ? '' : 'onclick="App.viewMember(\'' + p.id + '\')"') + '><div class="tree-node-photo">' + (p.photo ? '<img src="' + p.photo + '">' : '<div class="initials" style="background:' + bg + '">' + ini + '</div>') + '</div><div class="tree-node-name">' + p.firstName + ' ' + p.lastName + '</div><div class="tree-node-dates">' + (age !== null ? 'גיל ' + age : '') + '</div>' + (heb ? '<div class="tree-node-hebrew">🕎 ' + heb + '</div>' : '') + '<div class="tree-node-relation">' + (App.RELATION_LABELS[p.relationType] || '') + '</div>' + (p.status === 'deceased' ? '<div style="font-size:.68em">🕯️</div>' : '') + '</div>';
        }

        w.innerHTML = build(root, 1);
        if (DragConnect.isActive()) { DragConnect.toggleMode(); DragConnect.toggleMode(); }
    }

    return { setLevel, populateRootSelect, render };
})();