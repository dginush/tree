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
        var s = document.getElementById('eventParticipants');
        s.innerHTML = '';
        App.getMembers().forEach(function(m) {
            var o = document.createElement('option');
            o.value = m.id;
            o.textContent = m.firstName + ' ' + m.lastName;
            s.appendChild(o);
        });

        // Set default recurring calendar type
        var recurCalType = document.getElementById('eventRecurringCalendar');
        if (recurCalType) recurCalType.value = 'gregorian';
        toggleRecurringCalendar();

        if (eid) {
            var ev = events.find(function(e) { return e.id === eid; });
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
                if (recurCalType) recurCalType.value = ev.recurringCalendar || 'gregorian';
                toggleRecurringCalendar();
                if (ev.participants) {
                    Array.from(s.options).forEach(function(o) {
                        o.selected = ev.participants.includes(o.value);
                    });
                }
            }
        } else {
            document.getElementById('eventModalTitle').innerHTML = '🎉 אירוע חדש';
        }
        App.openModal('eventModal');
    }

    function toggleRecurringCalendar() {
        var recurVal = document.getElementById('eventRecurring');
        var calGroup = document.getElementById('recurringCalendarGroup');
        if (!calGroup || !recurVal) return;
        if (recurVal.value === 'yearly') {
            calGroup.style.display = '';
        } else {
            calGroup.style.display = 'none';
        }
    }

    async function saveEvent(e) {
        e.preventDefault();
        var eid = document.getElementById('eventId').value;
        var ps = Array.from(document.getElementById('eventParticipants').selectedOptions).map(function(o) { return o.value; });
        var recurringVal = document.getElementById('eventRecurring').value;
        var recurCalEl = document.getElementById('eventRecurringCalendar');
        var recurringCalendar = (recurringVal === 'yearly' && recurCalEl) ? recurCalEl.value : 'gregorian';

        // Calculate Hebrew date for the event
        var dateStr = document.getElementById('eventDate').value.trim();
        var hebrewDate = '';
        if (dateStr) {
            hebrewDate = HebrewDate.fromDateString(dateStr);
        }

        var d = {
            id: eid || App.generateId(),
            name: document.getElementById('eventName').value.trim(),
            type: document.getElementById('eventType').value,
            date: dateStr,
            time: document.getElementById('eventTime').value,
            location: document.getElementById('eventLocation').value.trim(),
            description: document.getElementById('eventDescription').value.trim(),
            participants: ps,
            recurring: recurringVal,
            recurringCalendar: recurringCalendar,
            hebrewDate: hebrewDate,
            createdAt: eid ? (events.find(function(x) { return x.id === eid; })?.createdAt || new Date().toISOString()) : new Date().toISOString()
        };

        await FirebaseDB.saveEvent(d);
        var i = events.findIndex(function(x) { return x.id === d.id; });
        if (i !== -1) events[i] = d; else events.push(d);
        App.closeModal('eventModal');
        App.showToast(eid ? '✏️ עודכן' : '🎉 נוסף');
        render();
    }

    async function deleteEvent(id) {
        await FirebaseDB.deleteEvent(id);
        events = events.filter(function(e) { return e.id !== id; });
        App.showToast('נמחק', 'warning');
        render();
    }

    function confirmDelete(id) {
        var ev = events.find(function(e) { return e.id === id; });
        if (!ev) return;
        document.getElementById('confirmTitle').textContent = 'מחיקה?';
        document.getElementById('confirmMessage').textContent = ev.name;
        document.getElementById('confirmBtn').onclick = function() { deleteEvent(id); App.closeModal('confirmModal'); };
        App.openModal('confirmModal');
    }

    function filter(t, el) {
        cF = t;
        document.querySelectorAll('.events-filters .filter-chip').forEach(function(c) { c.classList.remove('active'); });
        if (el) el.classList.add('active');
        render();
    }

    function pDS(s) {
        if (!s) return null;
        var p = s.split('/');
        if (p.length !== 3) return null;
        return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
    }

    // Calculate days until event - supports Hebrew calendar recurring
    function dU(ev) {
        if (typeof ev === 'string') {
            // Backward compatible: if called with date string
            var d = pDS(ev);
            if (!d) return 9999;
            var t = new Date(); t.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
            return Math.ceil((d - t) / 864e5);
        }

        // Called with event object
        if (!ev || !ev.date) return 9999;

        // For recurring events with Hebrew calendar
        if (ev.recurring === 'yearly' && ev.recurringCalendar === 'hebrew') {
            var nextHeb = HebrewDate.getNextHebrewAnniversary(ev.date);
            if (nextHeb && nextHeb.gregorianDate) {
                var today = new Date(); today.setHours(0, 0, 0, 0);
                var target = new Date(nextHeb.gregorianDate); target.setHours(0, 0, 0, 0);
                return Math.ceil((target - today) / 864e5);
            }
        }

        // Default: Gregorian
        var gd = pDS(ev.date);
        if (!gd) return 9999;
        var now = new Date(); now.setHours(0, 0, 0, 0); gd.setHours(0, 0, 0, 0);

        if (ev.recurring === 'yearly') {
            // Find next Gregorian anniversary
            var thisYear = new Date(now.getFullYear(), gd.getMonth(), gd.getDate());
            if (thisYear < now) thisYear = new Date(now.getFullYear() + 1, gd.getMonth(), gd.getDate());
            return Math.ceil((thisYear - now) / 864e5);
        }

        return Math.ceil((gd - now) / 864e5);
    }

    // Get display date for recurring Hebrew events
    function getDisplayDate(ev) {
        if (ev.recurring === 'yearly' && ev.recurringCalendar === 'hebrew') {
            var nextHeb = HebrewDate.getNextHebrewAnniversary(ev.date);
            if (nextHeb) {
                return {
                    gregorianDate: nextHeb.gregorianDate,
                    hebrewFormatted: nextHeb.hebrewFormatted
                };
            }
        }
        return {
            gregorianDate: pDS(ev.date),
            hebrewFormatted: ev.hebrewDate || ''
        };
    }

    function render() {
        var c = document.getElementById('eventsList');
        if (!c) return;
        var f = cF === 'all' ? events : events.filter(function(e) { return e.type === cF; });

        // Sort by days until event
        f.sort(function(a, b) { return dU(a) - dU(b); });

        if (!f.length) {
            c.innerHTML = '<div class="empty-state"><div class="icon">🎉</div><h3>אין אירועים</h3><button class="btn btn-primary" onclick="EventsManager.openAddEvent()">➕</button></div>';
            return;
        }

        var ms = App.getMembers();
        var mo = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

        c.innerHTML = f.map(function(ev) {
            var display = getDisplayDate(ev);
            var d = display.gregorianDate;
            var days = dU(ev);
            var dl = '', dc = '';
            if (days === 0) { dl = 'היום!'; dc = 'today'; }
            else if (days === 1) { dl = 'מחר'; dc = ''; }
            else if (days > 0) { dl = 'עוד ' + days; dc = ''; }
            else { dl = 'עבר'; dc = 'past'; }

            var ns = (ev.participants || []).map(function(pid) {
                var m = ms.find(function(x) { return x.id === pid; });
                return m ? m.firstName : '';
            }).filter(Boolean).join(', ');

            var calLabel = '';
            if (ev.recurring === 'yearly') {
                calLabel = ev.recurringCalendar === 'hebrew' ? ' 🕎' : ' 📅';
            }

            var hebInfo = '';
            if (display.hebrewFormatted) {
                hebInfo = '<div style="font-size:.75em;color:#666">🕎 ' + display.hebrewFormatted + '</div>';
            }

            return '<div class="event-card">'
                + '<div class="event-icon ' + (ev.type || 'other') + '">' + (IC[ev.type] || '📌') + '</div>'
                + '<div class="event-info">'
                + '<div class="event-name">' + ev.name + (calLabel ? '<span style="font-size:.8em">' + calLabel + '</span>' : '') + '</div>'
                + '<div class="event-meta"><span>📌 ' + (LB[ev.type] || '') + '</span>'
                + (ev.location ? '<span>📍 ' + ev.location + '</span>' : '')
                + (ev.recurring === 'yearly' ? '<span>🔄 שנתי' + (ev.recurringCalendar === 'hebrew' ? ' (עברי)' : '') + '</span>' : '')
                + '</div>'
                + (ns ? '<div class="event-participants">👥 ' + ns + '</div>' : '')
                + hebInfo
                + '</div>'
                + '<div class="event-date-box">'
                + '<div class="day">' + (d ? d.getDate() : '?') + '</div>'
                + '<div class="month">' + (d ? mo[d.getMonth()] : '') + '</div>'
                + '<div class="days-left ' + dc + '">' + dl + '</div>'
                + '</div>'
                + '<div class="event-actions">'
                + '<button class="btn-ghost" onclick="EventsManager.openAddEvent(\'' + ev.id + '\')">✏️</button>'
                + '<button class="btn-ghost" style="color:#f44336" onclick="EventsManager.confirmDelete(\'' + ev.id + '\')">🗑️</button>'
                + '</div></div>';
        }).join('');
    }

    function renderUpcoming(cid) {
        var c = document.getElementById(cid);
        if (!c) return;
        var up = events.filter(function(e) { return dU(e) >= 0; })
            .sort(function(a, b) { return dU(a) - dU(b); })
            .slice(0, 5);

        if (!up.length) {
            c.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px">אין אירועים קרובים</div>';
            return;
        }

        c.innerHTML = up.map(function(ev) {
            var d = dU(ev);
            var i = IC[ev.type] || '📌';
            var l = d === 0 ? '🎉 היום!' : d === 1 ? 'מחר' : 'עוד ' + d + ' ימים';
            return '<div style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;margin-bottom:5px;background:' + (d <= 7 ? '#FFF8E1' : '') + '">'
                + '<span style="font-size:1.3em">' + i + '</span>'
                + '<div style="flex:1"><div style="font-weight:600;font-size:.9em">' + ev.name + '</div>'
                + '<div style="font-size:.8em;color:var(--text-muted)">' + ev.date + '</div></div>'
                + '<span style="background:' + (d === 0 ? '#f44336' : d <= 7 ? 'var(--accent)' : 'var(--primary)') + ';color:#fff;padding:3px 10px;border-radius:12px;font-size:.78em;font-weight:600">' + l + '</span></div>';
        }).join('');
    }

    return {
        load: load, getAll: getAll, setEvents: setEvents,
        openAddEvent: openAddEvent, saveEvent: saveEvent,
        deleteEvent: deleteEvent, confirmDelete: confirmDelete,
        filter: filter, render: render, renderUpcoming: renderUpcoming,
        toggleRecurringCalendar: toggleRecurringCalendar
    };
})();