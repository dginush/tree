const EventsManager = (() => {
    let events = [], cF = 'all';
    const IC = { birthday: '🎂', wedding: '💒', barMitzvah: '📜', memorial: '🕯️', holiday: '🕎', other: '📌' };
    const LB = { birthday: 'יום הולדת', wedding: 'חתונה', barMitzvah: 'בר/בת מצווה', memorial: 'אזכרה', holiday: 'חג', other: 'אחר' };

    function setEvents(e) { events = e; }
    async function load() { events = await FirebaseDB.getEvents(); }
    function getAll() { return events; }

    function openAddEvent(eid) {
        document.getElementById('eventForm').reset();
        document.getElementById('eventId').value = '';
        const s = document.getElementById('eventParticipants');
        s.innerHTML = '';
        App.getMembers().forEach(m => {
            const o = document.createElement('option');
            o.value = m.id;
            o.textContent = m.firstName + ' ' + m.lastName;
            s.appendChild(o);
        });
        if (eid) {
            const ev = events.find(e => e.id === eid);
            if (ev) {
                document.getElementById('eventModalTitle').innerHTML = '✏️ עריכה';
                document.getElementById('eventId').value = ev.id;
                document.getElementById('eventName').value = ev.name || '';
                document.getElementById('eventType').value = ev.type || '';
                document.getElementById('eventDate').value = ev.date || '';
                document.getElementById('eventTime').value = ev.time || '';
                document.getElementById('eventLocation').value = ev.location || '';
                document.getElementById('eventDescription').value = ev.description || '';
                document.getElementById('eventRecurring').value = ev.recurring || 'no';
                if (ev.participants) Array.from(s.options).forEach(o => { o.selected = ev.participants.includes(o.value); });
            }
        } else {
            document.getElementById('eventModalTitle').innerHTML = '🎉 אירוע חדש';
        }
        App.openModal('eventModal');
    }

    async function saveEvent(e) {
        e.preventDefault();
        const eid = document.getElementById('eventId').value;
        const ps = Array.from(document.getElementById('eventParticipants').selectedOptions).map(o => o.value);
        const d = {
            id: eid || App.generateId(),
            name: document.getElementById('eventName').value.trim(),
            type: document.getElementById('eventType').value,
            date: document.getElementById('eventDate').value.trim(),
            time: document.getElementById('eventTime').value,
            location: document.getElementById('eventLocation').value.trim(),
            description: document.getElementById('eventDescription').value.trim(),
            participants: ps,
            recurring: document.getElementById('eventRecurring').value,
            createdAt: eid ? (events.find(x => x.id === eid)?.createdAt || new Date().toISOString()) : new Date().toISOString()
        };
        await FirebaseDB.saveEvent(d);
        const i = events.findIndex(x => x.id === d.id);
        if (i !== -1) events[i] = d; else events.push(d);
        App.closeModal('eventModal');
        App.showToast(eid ? '✏️ עודכן' : '🎉 נוסף');
        render();
    }

    async function deleteEvent(id) {
        await FirebaseDB.deleteEvent(id);
        events = events.filter(e => e.id !== id);
        App.showToast('נמחק', 'warning');
        render();
    }

    function confirmDelete(id) {
        const ev = events.find(e => e.id === id);
        if (!ev) return;
        document.getElementById('confirmTitle').textContent = 'מחיקה?';
        document.getElementById('confirmMessage').textContent = ev.name;
        document.getElementById('confirmBtn').onclick = () => { deleteEvent(id); App.closeModal('confirmModal'); };
        App.openModal('confirmModal');
    }

    function filter(t, el) {
        cF = t;
        document.querySelectorAll('.events-filters .filter-chip').forEach(c => c.classList.remove('active'));
        if (el) el.classList.add('active');
        render();
    }

    function pDS(s) {
        if (!s) return null;
        const p = s.split('/');
        if (p.length !== 3) return null;
        return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
    }

    function dU(s) {
        const d = pDS(s);
        if (!d) return 9999;
        const t = new Date(); t.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
        return Math.ceil((d - t) / 864e5);
    }

    function render() {
        const c = document.getElementById('eventsList');
        if (!c) return;
        let f = cF === 'all' ? events : events.filter(e => e.type === cF);
        f.sort((a, b) => { const da = pDS(a.date), db = pDS(b.date); return (da || new Date(9999, 0)) - (db || new Date(9999, 0)); });
        if (!f.length) {
            c.innerHTML = '<div class="empty-state"><div class="icon">🎉</div><h3>אין אירועים</h3><button class="btn btn-primary" onclick="EventsManager.openAddEvent()">➕</button></div>';
            return;
        }
        const ms = App.getMembers();
        const mo = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];
        c.innerHTML = f.map(ev => {
            const d = pDS(ev.date);
            const days = dU(ev.date);
            let dl = '', dc = '';
            if (days === 0) { dl = 'היום!'; dc = 'today'; }
            else if (days === 1) dl = 'מחר';
            else if (days > 0) dl = 'עוד ' + days;
            else { dl = 'עבר'; dc = 'past'; }
            const ns = (ev.participants || []).map(pid => { const m = ms.find(x => x.id === pid); return m ? m.firstName : ''; }).filter(Boolean).join(', ');
            return '<div class="event-card"><div class="event-icon ' + (ev.type || 'other') + '">' + (IC[ev.type] || '📌') + '</div><div class="event-info"><div class="event-name">' + ev.name + '</div><div class="event-meta"><span>📌 ' + (LB[ev.type] || '') + '</span>' + (ev.location ? '<span>📍 ' + ev.location + '</span>' : '') + '</div>' + (ns ? '<div class="event-participants">👥 ' + ns + '</div>' : '') + '</div><div class="event-date-box"><div class="day">' + (d ? d.getDate() : '?') + '</div><div class="month">' + (d ? mo[d.getMonth()] : '') + '</div><div class="days-left ' + dc + '">' + dl + '</div></div><div class="event-actions"><button class="btn-ghost" onclick="EventsManager.openAddEvent(\'' + ev.id + '\')">✏️</button><button class="btn-ghost" style="color:#f44336" onclick="EventsManager.confirmDelete(\'' + ev.id + '\')">🗑️</button></div></div>';
        }).join('');
    }

    function renderUpcoming(cid) {
        const c = document.getElementById(cid);
        if (!c) return;
        const up = events.filter(e => dU(e.date) >= 0).sort((a, b) => dU(a.date) - dU(b.date)).slice(0, 5);
        if (!up.length) { c.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px">—</div>'; return; }
        c.innerHTML = up.map(ev => {
            const d = dU(ev.date);
            const i = IC[ev.type] || '📌';
            const l = d === 0 ? '🎉 היום!' : d === 1 ? 'מחר' : 'עוד ' + d;
            return '<div style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;margin-bottom:5px;background:' + (d <= 7 ? '#FFF8E1' : '') + '"><span style="font-size:1.3em">' + i + '</span><div style="flex:1"><div style="font-weight:600;font-size:.9em">' + ev.name + '</div><div style="font-size:.8em;color:var(--text-muted)">' + ev.date + '</div></div><span style="background:' + (d === 0 ? '#f44336' : d <= 7 ? 'var(--accent)' : 'var(--primary)') + ';color:#fff;padding:3px 10px;border-radius:12px;font-size:.78em;font-weight:600">' + l + '</span></div>';
        }).join('');
    }

    return { load, getAll, setEvents, openAddEvent, saveEvent, deleteEvent, confirmDelete, filter, render, renderUpcoming };
})();