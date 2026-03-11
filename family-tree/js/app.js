const App = (() => {
    let members = [], editingId = null;

    const RELATION_LABELS = {
        'self': 'אני', 'father': 'אבא', 'mother': 'אמא', 'spouse': 'בן/בת זוג',
        'ex-spouse': 'גרוש/ה', 'son': 'בן', 'daughter': 'בת', 'brother': 'אח', 'sister': 'אחות',
        'half-brother': 'אח חורג', 'half-sister': 'אחות חורגת', 'grandfather': 'סבא',
        'grandmother': 'סבתא', 'uncle': 'דוד', 'aunt': 'דודה', 'cousin-male': 'בן דוד',
        'cousin-female': 'בת דודה', 'grandson': 'נכד', 'granddaughter': 'נכדה',
        'nephew': 'אחיין', 'niece': 'אחיינית', 'father-in-law': 'חם',
        'mother-in-law': 'חמות', 'brother-in-law': 'גיס', 'sister-in-law': 'גיסה',
        'son-in-law': 'חתן', 'daughter-in-law': 'כלה', 'other': 'אחר'
    };

    const MR = [
        { v: 'self', l: '👤 אני' }, { v: 'father', l: '👨 אבא' }, { v: 'spouse', l: '💒 בן זוג' },
        { v: 'ex-spouse', l: '💔 גרוש' }, { v: 'son', l: '👦 בן' }, { v: 'brother', l: '👦 אח' },
        { v: 'half-brother', l: '👦 חורג' }, { v: 'grandfather', l: '👴 סבא' }, { v: 'uncle', l: '👨 דוד' },
        { v: 'cousin-male', l: '👦 בן דוד' }, { v: 'grandson', l: '👦 נכד' }, { v: 'nephew', l: '👦 אחיין' },
        { v: 'father-in-law', l: '👨 חם' }, { v: 'brother-in-law', l: '👨 גיס' },
        { v: 'son-in-law', l: '👨 חתן' }, { v: 'other', l: '👤 אחר' }
    ];

    const FR = [
        { v: 'self', l: '👤 אני' }, { v: 'mother', l: '👩 אמא' }, { v: 'spouse', l: '💒 בת זוג' },
        { v: 'ex-spouse', l: '💔 גרושה' }, { v: 'daughter', l: '👧 בת' }, { v: 'sister', l: '👧 אחות' },
        { v: 'half-sister', l: '👧 חורגת' }, { v: 'grandmother', l: '👵 סבתא' }, { v: 'aunt', l: '👩 דודה' },
        { v: 'cousin-female', l: '👧 בת דודה' }, { v: 'granddaughter', l: '👧 נכדה' },
        { v: 'niece', l: '👧 אחיינית' }, { v: 'mother-in-law', l: '👩 חמות' },
        { v: 'sister-in-law', l: '👩 גיסה' }, { v: 'daughter-in-law', l: '👩 כלה' },
        { v: 'other', l: '👤 אחר' }
    ];

    function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
    function getInitials(f, l) { return (f?.[0] || '') + (l?.[0] || ''); }

    function pDS(s) {
        if (!s) return null;
        const p = s.split('/');
        if (p.length !== 3) return null;
        return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
    }

    function calculateAge(b, d) {
        const birth = pDS(b);
        if (!birth) return null;
        const end = d ? pDS(d) : new Date();
        if (!end) return null;
        let a = end.getFullYear() - birth.getFullYear();
        const m = end.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && end.getDate() < birth.getDate())) a--;
        return a;
    }

    function formatDate(s) {
        const d = pDS(s);
        if (!d) return s || '';
        return d.toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    function formatDateInput(i) {
        let v = i.value.replace(/[^\d]/g, '');
        if (v.length > 8) v = v.substr(0, 8);
        if (v.length >= 4) v = v.substr(0, 2) + '/' + v.substr(2, 2) + '/' + v.substr(4);
        else if (v.length >= 2) v = v.substr(0, 2) + '/' + v.substr(2);
        i.value = v;
    }

    function showToast(m, t) {
        t = t || 'success';
        const c = document.getElementById('toastContainer');
        const el = document.createElement('div');
        el.className = 'toast ' + t;
        el.innerHTML = '<span style="font-size:1.2em">' + ({ success: '✓', error: '❌', warning: '⚠️' }[t] || 'ℹ️') + '</span><span style="font-weight:500">' + m + '</span>';
        c.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3500);
    }

    function openModal(id) { document.getElementById(id)?.classList.add('active'); document.body.style.overflow = 'hidden'; }
    function closeModal(id) { document.getElementById(id)?.classList.remove('active'); document.body.style.overflow = ''; }

    function switchPage(p) {
        document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.getElementById('page-' + p)?.classList.add('active');
        document.querySelector('[data-page="' + p + '"]')?.classList.add('active');
        if (p === 'dashboard') renderDashboard();
        if (p === 'members') renderMembers();
        if (p === 'tree') { TreeRenderer.populateRootSelect(); TreeRenderer.render(); }
        if (p === 'birthdays') BirthdayCalendar.render();
        if (p === 'events') EventsManager.render();
    }

    async function initAfterLogin() {
        console.log('initAfterLogin called');

        if (!Sharing.canEdit()) document.body.classList.add('viewer-mode');
        else document.body.classList.remove('viewer-mode');

        Sharing.listenToTree(() => {
            if (!Sharing.canEdit()) document.body.classList.add('viewer-mode');
            else document.body.classList.remove('viewer-mode');
        });

        FirebaseDB.listenToMembers(m => {
            members = m;
            const a = document.querySelector('.nav-tab.active')?.dataset?.page;
            if (a) switchPage(a);
        });

        FirebaseDB.listenToEvents(e => {
            EventsManager.setEvents(e);
            const a = document.querySelector('.nav-tab.active')?.dataset?.page;
            if (a === 'events') EventsManager.render();
            if (a === 'dashboard') EventsManager.renderUpcoming('upcomingEvents');
        });

        members = await FirebaseDB.getMembers();
        await EventsManager.load();

        if (!members.length && Sharing.isOwner()) {
            console.log('Loading demo data...');
            await loadDemo();
        }

        renderDashboard();
        showToast('ברוך הבא! 🌳');
    }

    function updateRelationOptions() {
        const g = document.getElementById('gender').value;
        const s = document.getElementById('relationType');
        const cv = s.value;
        s.innerHTML = '<option value="">--</option>';
        (g === 'male' ? MR : g === 'female' ? FR : []).forEach(o => {
            const el = document.createElement('option');
            el.value = o.v; el.textContent = o.l;
            if (o.v === cv) el.selected = true;
            s.appendChild(el);
        });
    }

    function popParent(cv) {
        const s = document.getElementById('parentId');
        s.innerHTML = '<option value="">-- בחר --</option>';
        members.forEach(m => {
            if (m.id !== editingId) {
                const o = document.createElement('option');
                o.value = m.id; o.textContent = m.firstName + ' ' + m.lastName;
                if (cv === m.id) o.selected = true;
                s.appendChild(o);
            }
        });
    }

    function popSpouse(cv) {
        const s = document.getElementById('spouseId');
        if (!s) return;
        s.innerHTML = '<option value="">--</option>';
        members.forEach(m => {
            if (m.id !== editingId) {
                const o = document.createElement('option');
                o.value = m.id; o.textContent = m.firstName + ' ' + m.lastName;
                if (cv === m.id) o.selected = true;
                s.appendChild(o);
            }
        });
    }

    function toggleExtraFields() {
        const x = document.getElementById('extraFields');
        const i = document.getElementById('expandIcon');
        if (x.style.display === 'none') { x.style.display = ''; i.classList.add('open'); popSpouse(); }
        else { x.style.display = 'none'; i.classList.remove('open'); }
    }

    function toggleDeathDate() {
        document.getElementById('deathDateGroup').style.display = document.getElementById('status').value === 'deceased' ? '' : 'none';
    }

    function handlePhotoUpload(e) {
        const f = e.target.files[0];
        if (!f) return;
        if (f.size > 2 * 1024 * 1024) { showToast('גדול מדי', 'error'); return; }
        const r = new FileReader();
        r.onload = ev => {
            document.getElementById('photoPreviewImg').src = ev.target.result;
            document.getElementById('photoPreviewImg').style.display = '';
            document.getElementById('photoPlaceholder').style.display = 'none';
        };
        r.readAsDataURL(f);
    }

    function openAddModal() {
        editingId = null;
        document.getElementById('modalTitle').innerHTML = '➕ הוספה';
        document.getElementById('memberForm').reset();
        document.getElementById('memberId').value = '';
        document.getElementById('photoPreviewImg').style.display = 'none';
        document.getElementById('photoPlaceholder').style.display = '';
        document.getElementById('extraFields').style.display = 'none';
        document.getElementById('expandIcon').classList.remove('open');
        document.getElementById('deathDateGroup').style.display = 'none';
        document.getElementById('relationType').innerHTML = '<option value="">-- בחרו מין --</option>';
        popParent();
        openModal('memberModal');
    }

    function openEditModal(id) {
        const m = members.find(x => x.id === id);
        if (!m) return;
        editingId = id;
        document.getElementById('modalTitle').innerHTML = '✏️ עריכה';
        document.getElementById('memberId').value = m.id;
        document.getElementById('firstName').value = m.firstName || '';
        document.getElementById('lastName').value = m.lastName || '';
        document.getElementById('gender').value = m.gender || '';
        updateRelationOptions();
        document.getElementById('relationType').value = m.relationType || '';
        document.getElementById('birthDate').value = m.birthDate || '';
        if (m.photo) {
            document.getElementById('photoPreviewImg').src = m.photo;
            document.getElementById('photoPreviewImg').style.display = '';
            document.getElementById('photoPlaceholder').style.display = 'none';
        } else {
            document.getElementById('photoPreviewImg').style.display = 'none';
            document.getElementById('photoPlaceholder').style.display = '';
        }
        popParent(m.parentId);
        document.getElementById('parentId').value = m.parentId || '';
        const has = m.spouseId || m.phone || m.email || m.address || m.occupation || m.birthPlace || m.notes || m.status === 'deceased';
        if (has) {
            document.getElementById('extraFields').style.display = '';
            document.getElementById('expandIcon').classList.add('open');
            popSpouse(m.spouseId);
            document.getElementById('spouseId').value = m.spouseId || '';
            document.getElementById('status').value = m.status || 'alive';
            document.getElementById('deathDate').value = m.deathDate || '';
            document.getElementById('deathDateGroup').style.display = m.status === 'deceased' ? '' : 'none';
            document.getElementById('birthPlace').value = m.birthPlace || '';
            document.getElementById('phone').value = m.phone || '';
            document.getElementById('email').value = m.email || '';
            document.getElementById('address').value = m.address || '';
            document.getElementById('occupation').value = m.occupation || '';
            document.getElementById('notes').value = m.notes || '';
        } else {
            document.getElementById('extraFields').style.display = 'none';
            document.getElementById('expandIcon').classList.remove('open');
        }
        openModal('memberModal');
    }

    async function saveMember(e) {
        e.preventDefault();
        const pi = document.getElementById('photoPreviewImg');
        const photo = pi.style.display !== 'none' ? pi.src : '';
        const d = {
            id: editingId || generateId(),
            firstName: document.getElementById('firstName').value.trim(),
            lastName: document.getElementById('lastName').value.trim(),
            gender: document.getElementById('gender').value,
            relationType: document.getElementById('relationType').value,
            parentId: document.getElementById('parentId').value || null,
            birthDate: document.getElementById('birthDate').value.trim(),
            photo,
            spouseId: document.getElementById('spouseId')?.value || null,
            status: document.getElementById('status')?.value || 'alive',
            deathDate: document.getElementById('deathDate')?.value || null,
            birthPlace: document.getElementById('birthPlace')?.value?.trim() || '',
            phone: document.getElementById('phone')?.value?.trim() || '',
            email: document.getElementById('email')?.value?.trim() || '',
            address: document.getElementById('address')?.value?.trim() || '',
            occupation: document.getElementById('occupation')?.value?.trim() || '',
            notes: document.getElementById('notes')?.value?.trim() || '',
            createdAt: editingId ? (members.find(m => m.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        if (d.spouseId) {
            const sp = members.find(m => m.id === d.spouseId);
            if (sp && !sp.spouseId) { sp.spouseId = d.id; await FirebaseDB.saveMember(sp); }
        }
        if (editingId) {
            const old = members.find(m => m.id === editingId);
            if (old?.spouseId && old.spouseId !== d.spouseId) {
                const os = members.find(m => m.id === old.spouseId);
                if (os?.spouseId === editingId) { os.spouseId = null; await FirebaseDB.saveMember(os); }
            }
            const i = members.findIndex(m => m.id === editingId);
            if (i !== -1) members[i] = d;
        } else members.push(d);
        await FirebaseDB.saveMember(d);
        closeModal('memberModal');
        showToast(editingId ? '✏️ עודכן' : '🎉 נוסף');
        rCP();
    }

    function confirmDelete(id) {
        const m = members.find(x => x.id === id);
        if (!m) return;
        document.getElementById('confirmTitle').textContent = m.firstName + ' ' + m.lastName;
        document.getElementById('confirmMessage').textContent = 'למחוק?';
        document.getElementById('confirmBtn').onclick = async () => { await delMember(id); closeModal('confirmModal'); };
        openModal('confirmModal');
    }

    async function delMember(id) {
        for (const m of members) {
            let ch = false;
            if (m.parentId === id) { m.parentId = null; ch = true; }
            if (m.spouseId === id) { m.spouseId = null; ch = true; }
            if (ch) await FirebaseDB.saveMember(m);
        }
        members = members.filter(m => m.id !== id);
        await FirebaseDB.deleteMember(id);
        showToast('נמחק', 'warning');
        rCP();
    }

    function viewMember(id) {
        const m = members.find(x => x.id === id);
        if (!m) return;
        const age = calculateAge(m.birthDate, m.deathDate);
        const par = m.parentId ? members.find(x => x.id === m.parentId) : null;
        const sp = m.spouseId ? members.find(x => x.id === m.spouseId) : null;
        const ch = members.filter(x => x.parentId === id);
        const heb = HebrewDate.fromDateString(m.birthDate);
        const bg = m.gender === 'male' ? 'var(--male)' : 'var(--female)';
        let h = '<div class="view-header">';
        if (m.photo) h += '<div class="view-avatar"><img src="' + m.photo + '"></div>';
        else h += '<div class="view-avatar"><div class="initials" style="background:' + bg + '">' + getInitials(m.firstName, m.lastName) + '</div></div>';
        h += '<h2>' + m.firstName + ' ' + m.lastName + '</h2><span class="relation-badge">' + (RELATION_LABELS[m.relationType] || '') + '</span>';
        if (m.status === 'deceased') h += ' <span class="deceased-badge" style="position:static;display:inline-block">🕯️</span>';
        h += '</div><div class="view-details">';
        [
            { l: '🎂 גיל', v: age !== null ? String(age) : '' },
            { l: '📅 לידה', v: formatDate(m.birthDate) },
            { l: '🕎 עברי', v: heb },
            { l: '📍 מקום', v: m.birthPlace },
            { l: '📞 טלפון', v: m.phone },
            { l: '📧 מייל', v: m.email },
            { l: '📍 כתובת', v: m.address },
            { l: '💼 עיסוק', v: m.occupation },
            { l: '👨‍👩‍👦 הורה', v: par ? par.firstName + ' ' + par.lastName : '' },
            { l: '💒 זוג', v: sp ? sp.firstName + ' ' + sp.lastName : '' }
        ].forEach(d => { if (d.v) h += '<div class="view-detail"><strong>' + d.l + '</strong>' + d.v + '</div>'; });
        h += '</div>';
        if (ch.length) {
            h += '<div class="view-children"><strong>👶 (' + ch.length + '):</strong><div>';
            ch.forEach(c => h += '<span class="view-child-chip" onclick="App.closeModal('viewModal');App.viewMember(\'' + c.id + '\')">' + c.firstName + '</span>');
            h += '</div></div>';
        }
        if (m.notes) h += '<div style="margin-top:12px;padding:10px;background:#FFF8E1;border-radius:8px;font-size:.9em">📝 ' + m.notes + '</div>';
        h += '<div style="margin-top:18px;display:flex;gap:8px;justify-content:center">';
        if (Sharing.canEdit()) h += '<button class="btn btn-primary btn-sm" onclick="App.closeModal('viewModal');App.openEditModal(\'' + m.id + '\')">✏️</button>';
        if (Sharing.canDelete()) h += '<button class="btn btn-danger btn-sm" onclick="App.closeModal('viewModal');App.confirmDelete(\'' + m.id + '\')">🗑️</button>';
        h += '</div>';
        document.getElementById('viewContent').innerHTML = h;
        openModal('viewModal');
    }

    function renderDashboard() {
        const t = members.length, ml = members.filter(m => m.gender === 'male').length, fm = members.filter(m => m.gender === 'female').length;
        const ages = members.filter(m => m.birthDate).map(m => calculateAge(m.birthDate, m.deathDate)).filter(a => a !== null);
        const avg = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
        document.getElementById('statsBar').innerHTML =
            '<div class="stat-card"><div class="stat-icon" style="background:#E8F5E9;color:#2E7D32">👥</div><div class="stat-info"><h3>' + t + '</h3><p>בני משפחה</p></div></div>' +
            '<div class="stat-card"><div class="stat-icon" style="background:#E3F2FD;color:#1565C0">👨</div><div class="stat-info"><h3>' + ml + '</h3><p>גברים</p></div></div>' +
            '<div class="stat-card"><div class="stat-icon" style="background:#FCE4EC;color:#C2185B">👩</div><div class="stat-info"><h3>' + fm + '</h3><p>נשים</p></div></div>' +
            '<div class="stat-card"><div class="stat-icon" style="background:#FFF3E0;color:#E65100">📊</div><div class="stat-info"><h3>' + avg + '</h3><p>גיל ממוצע</p></div></div>';

        const rec = [...members].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
        const rmEl = document.getElementById('recentMembers');
        if (!rec.length) rmEl.innerHTML = '<div class="empty-state"><div class="icon">👥</div><h3>ריק</h3><button class="btn btn-primary btn-sm" onclick="App.openAddModal()">➕</button></div>';
        else rmEl.innerHTML = rec.map(m => {
            const age = calculateAge(m.birthDate, m.deathDate);
            const bg = m.gender === 'male' ? 'var(--male)' : 'var(--female)';
            return '<div style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;cursor:pointer" onclick="App.viewMember(\'' + m.id + '\')" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='\'"><div style="width:38px;height:38px;border-radius:50%;background:' + bg + ';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.9em;flex-shrink:0;overflow:hidden">' + (m.photo ? '<img src="' + m.photo + '" style="width:100%;height:100%;object-fit:cover">' : getInitials(m.firstName, m.lastName)) + '</div><div><div style="font-weight:600;font-size:.92em">' + m.firstName + ' ' + m.lastName + '</div><div style="font-size:.8em;color:var(--text-muted)">' + (RELATION_LABELS[m.relationType] || '') + (age !== null ? ' — ' + age : '') + '</div></div></div>';
        }).join('');
        BirthdayCalendar.renderUpcomingWidget('upcomingBirthdays');
    }

    function renderMembers() {
        const q = (document.getElementById('searchInput')?.value || '').toLowerCase();
        let f = members;
        if (q) f = members.filter(m => (m.firstName + ' ' + m.lastName).toLowerCase().includes(q));
        const g = document.getElementById('membersGrid');
        if (!f.length) {
            g.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="icon">👥</div><h3>' + (q ? '—' : 'ריק') + '</h3></div>';
            return;
        }
        g.innerHTML = f.map(m => {
            const age = calculateAge(m.birthDate, m.deathDate);
            const par = m.parentId ? members.find(x => x.id === m.parentId) : null;
            const bg = m.gender === 'male' ? 'var(--male)' : 'var(--female)';
            return '<div class="member-card ' + m.gender + (m.status === 'deceased' ? ' deceased' : '') + '">' +
                (m.status === 'deceased' ? '<div class="deceased-badge">🕯️</div>' : '') +
                '<div class="member-card-header"><div class="member-avatar">' +
                (m.photo ? '<img src="' + m.photo + '">' : '<div class="initials" style="background:' + bg + '">' + getInitials(m.firstName, m.lastName) + '</div>') +
                '</div><div><div class="member-name">' + m.firstName + ' ' + m.lastName + '</div><span class="relation-badge">' + (RELATION_LABELS[m.relationType] || '') + '</span></div></div>' +
                '<div class="member-details">' +
                (age !== null ? '<div class="member-detail">🎂 ' + age + '</div>' : '') +
                (m.birthDate ? '<div class="member-detail">📅 ' + formatDate(m.birthDate) + '</div>' : '') +
                (par ? '<div class="member-detail">👨‍👩‍👦 ' + par.firstName + '</div>' : '') +
                '</div><div class="member-actions">' +
                '<button class="btn btn-outline btn-sm" onclick="App.viewMember(\'' + m.id + '\')">👁️</button>' +
                '<button class="btn btn-primary btn-sm" onclick="App.openEditModal(\'' + m.id + '\')">✏️</button>' +
                '<button class="btn btn-danger btn-sm" onclick="App.confirmDelete(\'' + m.id + '\')">🗑️</button>' +
                '</div></div>';
        }).join('');
    }

    function filterMembers() { renderMembers(); }

    function exportData() {
        const d = { members, events: EventsManager.getAll() };
        const b = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = 'family-tree.json';
        a.click();
        showToast('📤 יוצא');
    }

    async function importData(e) {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = async ev => {
            try {
                const d = JSON.parse(ev.target.result);
                if (d.members) { members = d.members; await FirebaseDB.saveAllMembers(members); }
                if (d.events) { for (const ev of d.events) await FirebaseDB.saveEvent(ev); EventsManager.setEvents(d.events); }
                showToast('📥 יובא');
                rCP();
            } catch { showToast('שגיאה', 'error'); }
        };
        r.readAsText(f);
        e.target.value = '';
    }

    function rCP() {
        const a = document.querySelector('.nav-tab.active')?.dataset?.page || 'dashboard';
        switchPage(a);
    }

    function refreshTree() { TreeRenderer.populateRootSelect(); TreeRenderer.render(); }

    async function loadDemo() {
        if (members.length) return;
        members = [
            { id: 'd1', firstName: 'אברהם', lastName: 'כהן', gender: 'male', relationType: 'grandfather', parentId: null, spouseId: 'd2', birthDate: '15/03/1945', status: 'alive', photo: '', birthPlace: 'ירושלים', phone: '', email: '', address: '', occupation: '', notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: 'd2', firstName: 'שרה', lastName: 'כהן', gender: 'female', relationType: 'grandmother', parentId: null, spouseId: 'd1', birthDate: '20/07/1948', status: 'alive', photo: '', birthPlace: '', phone: '', email: '', address: '', occupation: '', notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: 'd3', firstName: 'יצחק', lastName: 'כהן', gender: 'male', relationType: 'father', parentId: 'd1', spouseId: 'd4', birthDate: '08/11/1970', status: 'alive', photo: '', birthPlace: '', phone: '', email: '', address: '', occupation: 'מהנדס', notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: 'd4', firstName: 'רבקה', lastName: 'כהן', gender: 'female', relationType: 'mother', parentId: null, spouseId: 'd3', birthDate: '25/04/1972', status: 'alive', photo: '', birthPlace: '', phone: '', email: '', address: '', occupation: '', notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: 'd5', firstName: 'דוד', lastName: 'כהן', gender: 'male', relationType: 'self', parentId: 'd3', spouseId: 'd6', birthDate: '12/09/1995', status: 'alive', photo: '', birthPlace: '', phone: '', email: '', address: '', occupation: 'מפתח', notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: 'd6', firstName: 'מיכל', lastName: 'כהן', gender: 'female', relationType: 'spouse', parentId: null, spouseId: 'd5', birthDate: '30/01/1997', status: 'alive', photo: '', birthPlace: '', phone: '', email: '', address: '', occupation: '', notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: 'd7', firstName: 'נועם', lastName: 'כהן', gender: 'male', relationType: 'son', parentId: 'd5', spouseId: null, birthDate: '15/06/2022', status: 'alive', photo: '', birthPlace: '', phone: '', email: '', address: '', occupation: '', notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: 'd8', firstName: 'יעל', lastName: 'כהן', gender: 'female', relationType: 'sister', parentId: 'd3', spouseId: null, birthDate: '22/03/1998', status: 'alive', photo: '', birthPlace: '', phone: '', email: '', address: '', occupation: 'רופאה', notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: 'd9', firstName: 'מרדכי', lastName: 'כהן', gender: 'male', relationType: 'brother', parentId: 'd3', spouseId: null, birthDate: '05/12/2001', status: 'alive', photo: '', birthPlace: '', phone: '', email: '', address: '', occupation: '', notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        ];
        await FirebaseDB.saveAllMembers(members);
        const dE = [
            { id: 'ev1', name: 'יום הולדת נועם', type: 'birthday', date: '15/06/2025', time: '17:00', location: 'תל אביב', participants: ['d7', 'd5', 'd6'], description: '', recurring: 'yearly', createdAt: new Date().toISOString() },
            { id: 'ev2', name: 'ליל סדר', type: 'holiday', date: '12/04/2025', time: '19:30', location: 'ירושלים', participants: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9'], description: '', recurring: 'yearly', createdAt: new Date().toISOString() }
        ];
        for (const ev of dE) await FirebaseDB.saveEvent(ev);
        EventsManager.setEvents(dE);
    }

    // Global keyboard & modal listeners
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
            document.body.style.overflow = '';
        }
    });

    document.querySelectorAll('.modal-overlay').forEach(ov => {
        ov.addEventListener('click', function(e) {
            if (e.target === this) { this.classList.remove('active'); document.body.style.overflow = ''; }
        });
    });

    return {
        initAfterLogin, switchPage, openAddModal, openEditModal, saveMember,
        viewMember, confirmDelete, closeModal, openModal, filterMembers,
        showToast, handlePhotoUpload, formatDateInput, updateRelationOptions,
        toggleExtraFields, toggleDeathDate, exportData, importData, refreshTree,
        getMembers: () => members, getInitials, calculateAge, generateId, RELATION_LABELS
    };
})();