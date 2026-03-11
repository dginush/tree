const BirthdayCalendar = (() => {
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();
    let currentView = 'month';

    const HEB_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    const HEB_DAYS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];

    function parseBirthDate(str) {
        if (!str) return null;
        const p = str.split('/');
        if (p.length !== 3) return null;
        return { day: parseInt(p[0]), month: parseInt(p[1]) - 1, year: parseInt(p[2]) };
    }

    function getBirthdaysForMonth(month, year) {
        const members = App.getMembers();
        return members.filter(m => {
            if (!m.birthDate || m.status === 'deceased') return false;
            const bd = parseBirthDate(m.birthDate);
            return bd && bd.month === month;
        }).map(m => {
            const bd = parseBirthDate(m.birthDate);
            const age = year - bd.year;
            const heb = HebrewDate.fromDateString(m.birthDate);
            return { ...m, birthDay: bd.day, birthMonth: bd.month, birthYear: bd.year, turnsAge: age, hebrewDate: heb };
        }).sort((a, b) => a.birthDay - b.birthDay);
    }

    function getBirthdaysForYear(year) {
        const all = [];
        for (let m = 0; m < 12; m++) all.push({ month: m, birthdays: getBirthdaysForMonth(m, year) });
        return all;
    }

    function daysInMonth(month, year) { return new Date(year, month + 1, 0).getDate(); }
    function firstDayOfMonth(month, year) { return new Date(year, month, 1).getDay(); }

    function render() { updateLabel(); if (currentView === 'month') renderMonth(); else if (currentView === 'year') renderYear(); else renderList(); }

    function updateLabel() {
        const el = document.getElementById('calendarMonthLabel');
        if (!el) return;
        if (currentView === 'year') el.textContent = currentYear.toString();
        else el.textContent = HEB_MONTHS[currentMonth] + ' ' + currentYear;
    }

    function renderMonth() {
        const c = document.getElementById('calendarContent');
        if (!c) return;
        const birthdays = getBirthdaysForMonth(currentMonth, currentYear);
        const bdayMap = {};
        birthdays.forEach(b => { if (!bdayMap[b.birthDay]) bdayMap[b.birthDay] = []; bdayMap[b.birthDay].push(b); });
        const days = daysInMonth(currentMonth, currentYear);
        const firstDay = firstDayOfMonth(currentMonth, currentYear);
        const today = new Date();
        const isCurrentMonth = today.getMonth() === currentMonth && today.getFullYear() === currentYear;

        let html = '<div class="calendar-grid"><div class="calendar-header-row">';
        HEB_DAYS.forEach(d => html += '<div class="calendar-day-header">' + d + '</div>');
        html += '</div><div class="calendar-days">';
        for (let i = 0; i < firstDay; i++) html += '<div class="calendar-cell empty"></div>';
        for (let d = 1; d <= days; d++) {
            const isToday = isCurrentMonth && today.getDate() === d;
            const hasBday = bdayMap[d];
            html += '<div class="calendar-cell' + (isToday ? ' today' : '') + (hasBday ? ' has-birthday' : '') + '">';
            html += '<div class="cell-date' + (isToday ? ' today-date' : '') + '">' + d + '</div>';
            if (hasBday) {
                hasBday.forEach(b => {
                    const bg = b.gender === 'male' ? '#E3F2FD' : '#FCE4EC';
                    const color = b.gender === 'male' ? '#1565C0' : '#C2185B';
                    html += '<div class="bday-chip" style="background:' + bg + ';color:' + color + '" onclick="BirthdayCalendar.showDetail(\'' + b.id + '\',' + currentYear + ')"><span class="bday-chip-emoji">🎂</span><span class="bday-chip-name">' + b.firstName + '</span><span class="bday-chip-age">' + b.turnsAge + '</span></div>';
                });
            }
            html += '</div>';
        }
        const totalCells = firstDay + days;
        const remaining = 7 - (totalCells % 7);
        if (remaining < 7) for (let i = 0; i < remaining; i++) html += '<div class="calendar-cell empty"></div>';
        html += '</div></div>';

        html += '<div class="birthday-summary"><div class="summary-title">🎂 ימי הולדת ב' + HEB_MONTHS[currentMonth] + ' (' + birthdays.length + ')</div>';
        if (birthdays.length === 0) html += '<div class="summary-empty">אין ימי הולדת בחודש</div>';
        else {
            html += '<div class="summary-list">';
            birthdays.forEach(b => {
                const daysLeft = daysUntilBirthday(b.birthDate);
                const bg = b.gender === 'male' ? 'var(--male)' : 'var(--female)';
                html += '<div class="summary-item" onclick="BirthdayCalendar.showDetail(\'' + b.id + '\',' + currentYear + ')"><div class="summary-avatar" style="background:' + bg + '">' + App.getInitials(b.firstName, b.lastName) + '</div><div class="summary-info"><div class="summary-name">' + b.firstName + ' ' + b.lastName + '</div><div class="summary-meta">' + b.birthDay + ' ' + HEB_MONTHS[currentMonth] + ' — יתמלא ' + b.turnsAge + (b.hebrewDate ? ' — 🕎 ' + b.hebrewDate : '') + '</div></div>';
                if (daysLeft === 0) html += '<div class="summary-badge today-badge">🎉 היום!</div>';
                else if (daysLeft > 0 && daysLeft <= 30) html += '<div class="summary-badge soon-badge">עוד ' + daysLeft + ' ימים</div>';
                else html += '<div class="summary-badge">' + b.birthDay + '/' + String(currentMonth + 1).padStart(2, '0') + '</div>';
                html += '</div>';
            });
            html += '</div>';
        }
        html += '</div>';
        c.innerHTML = html;
    }

    function renderYear() {
        const c = document.getElementById('calendarContent');
        if (!c) return;
        const yearData = getBirthdaysForYear(currentYear);
        let total = 0;
        yearData.forEach(m => total += m.birthdays.length);
        let html = '<div class="year-grid">';
        yearData.forEach((md, idx) => {
            const count = md.birthdays.length;
            const isCM = new Date().getMonth() === idx && new Date().getFullYear() === currentYear;
            html += '<div class="year-month-card' + (isCM ? ' current' : '') + '" onclick="BirthdayCalendar.goToMonth(' + idx + ')"><div class="year-month-name">' + HEB_MONTHS[idx] + '</div><div class="year-month-count">' + (count > 0 ? count : '—') + '</div><div class="year-month-label">' + (count > 0 ? 'ימי הולדת' : '') + '</div>';
            if (count > 0) {
                html += '<div class="year-month-faces">';
                md.birthdays.slice(0, 4).forEach(b => {
                    const bg = b.gender === 'male' ? 'var(--male)' : 'var(--female)';
                    html += '<div class="mini-face" style="background:' + bg + '" title="' + b.firstName + ' ' + b.lastName + ' (' + b.turnsAge + ')">' + b.firstName[0] + '</div>';
                });
                if (count > 4) html += '<div class="mini-face more">+' + (count - 4) + '</div>';
                html += '</div>';
            }
            html += '</div>';
        });
        html += '</div><div class="year-total">סה"כ ' + total + ' ימי הולדת ב-' + currentYear + '</div>';
        c.innerHTML = html;
    }

    function renderList() {
        const c = document.getElementById('calendarContent');
        if (!c) return;
        const members = App.getMembers().filter(m => m.birthDate && m.status !== 'deceased');
        const withDays = members.map(m => {
            const dl = daysUntilBirthday(m.birthDate);
            const bd = parseBirthDate(m.birthDate);
            const age = bd ? new Date().getFullYear() - bd.year + (dl === 0 ? 0 : dl < 0 ? 1 : 0) : 0;
            const heb = HebrewDate.fromDateString(m.birthDate);
            return { ...m, daysLeft: dl, nextAge: age, hebrewDate: heb, bd };
        }).sort((a, b) => a.daysLeft - b.daysLeft);

        let html = '<div class="birthday-list-view">';
        if (!withDays.length) html += '<div class="empty-state"><div class="icon">🎂</div><h3>אין ימי הולדת</h3></div>';
        else {
            withDays.forEach(m => {
                const bg = m.gender === 'male' ? 'var(--male)' : 'var(--female)';
                let badge = '', badgeClass = '';
                if (m.daysLeft === 0) { badge = '🎉 היום!'; badgeClass = 'today-badge'; }
                else if (m.daysLeft === 1) { badge = 'מחר!'; badgeClass = 'soon-badge'; }
                else if (m.daysLeft <= 7) { badge = 'עוד ' + m.daysLeft + ' ימים'; badgeClass = 'soon-badge'; }
                else if (m.daysLeft <= 30) { badge = 'עוד ' + m.daysLeft + ' ימים'; badgeClass = 'month-badge'; }
                else { badge = 'עוד ' + m.daysLeft + ' ימים'; }
                html += '<div class="list-birthday-item" onclick="BirthdayCalendar.showDetail(\'' + m.id + '\',' + currentYear + ')"><div class="list-bday-avatar" style="background:' + bg + '">' + (m.photo ? '<img src="' + m.photo + '">' : App.getInitials(m.firstName, m.lastName)) + '</div><div class="list-bday-info"><div class="list-bday-name">' + m.firstName + ' ' + m.lastName + '</div><div class="list-bday-date">📅 ' + m.birthDate + (m.hebrewDate ? ' — 🕎 ' + m.hebrewDate : '') + '</div><div class="list-bday-relation">' + (App.RELATION_LABELS[m.relationType] || '') + '</div></div><div class="list-bday-right"><div class="list-bday-age">' + m.nextAge + '</div><div style="font-size:.75em;color:var(--text-muted)">שנים</div>' + (badge ? '<div class="summary-badge ' + badgeClass + '">' + badge + '</div>' : '') + '</div></div>';
            });
        }
        html += '</div>';
        c.innerHTML = html;
    }

    function daysUntilBirthday(dateStr) {
        if (!dateStr) return 9999;
        const bd = parseBirthDate(dateStr);
        if (!bd) return 9999;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        let next = new Date(today.getFullYear(), bd.month, bd.day);
        if (next < today) next = new Date(today.getFullYear() + 1, bd.month, bd.day);
        return Math.ceil((next - today) / 864e5);
    }

    function showDetail(memberId, year) {
        const m = App.getMembers().find(x => x.id === memberId);
        if (!m) return;
        const bd = parseBirthDate(m.birthDate);
        const age = bd ? year - bd.year : 0;
        const dl = daysUntilBirthday(m.birthDate);
        const heb = HebrewDate.fromDateString(m.birthDate);
        const bg = m.gender === 'male' ? 'var(--male)' : 'var(--female)';

        let html = '<div style="text-align:center;padding:10px"><div style="font-size:4em;margin-bottom:10px">🎂</div>';
        if (m.photo) html += '<img src="' + m.photo + '" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:4px solid ' + bg + ';margin-bottom:10px">';
        else html += '<div style="width:80px;height:80px;border-radius:50%;background:' + bg + ';display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.8em;font-weight:700;margin:0 auto 10px">' + App.getInitials(m.firstName, m.lastName) + '</div>';
        html += '<h2>' + m.firstName + ' ' + m.lastName + '</h2>';
        html += '<div style="color:var(--text-muted);margin-bottom:15px">' + (App.RELATION_LABELS[m.relationType] || '') + '</div>';
        html += '<div class="bday-detail-grid">';
        html += '<div class="bday-detail-item"><div class="bday-detail-value">' + age + '</div><div class="bday-detail-label">שנים ב-' + year + '</div></div>';
        html += '<div class="bday-detail-item"><div class="bday-detail-value">' + m.birthDate + '</div><div class="bday-detail-label">תאריך לידה</div></div>';
        if (heb) html += '<div class="bday-detail-item"><div class="bday-detail-value" style="font-size:.9em">' + heb + '</div><div class="bday-detail-label">🕎 תאריך עברי</div></div>';
        if (dl === 0) html += '<div class="bday-detail-item" style="background:#FFF3E0;grid-column:1/-1"><div class="bday-detail-value" style="color:#f44336">🎉 היום יום הולדת!</div></div>';
        else html += '<div class="bday-detail-item" style="grid-column:1/-1"><div class="bday-detail-value">' + dl + '</div><div class="bday-detail-label">ימים ליום הולדת הבא</div></div>';
        html += '</div>';
        html += '<div style="margin-top:15px;display:flex;gap:8px;justify-content:center">';
        html += '<button class="btn btn-primary btn-sm" onclick="App.closeModal('birthdayDetailModal');App.viewMember(\'' + m.id + '\')">👁️ פרטים</button>';
        html += '<button class="btn btn-accent btn-sm" onclick="BirthdayCalendar.sendWish(\'' + m.firstName + '\')">🎂 שלח ברכה</button>';
        html += '</div></div>';

        document.getElementById('birthdayDetailContent').innerHTML = html;
        App.openModal('birthdayDetailModal');
    }

    function sendWish(name) {
        const text = '🎂🎉 חג שמח ' + name + '! מאחלים יום הולדת מדהים!';
        if (navigator.share) navigator.share({ title: 'ברכת יום הולדת', text: text });
        else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
    }

    function prevMonth() {
        if (currentView === 'year') { currentYear--; render(); return; }
        currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } render();
    }
    function nextMonth() {
        if (currentView === 'year') { currentYear++; render(); return; }
        currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } render();
    }
    function goToday() { currentMonth = new Date().getMonth(); currentYear = new Date().getFullYear(); render(); }
    function goToMonth(m) { currentMonth = m; currentView = 'month'; updateViewBtns(); render(); }
    function setView(v) { currentView = v; updateViewBtns(); render(); }
    function updateViewBtns() {
        document.querySelectorAll('.calendar-view-btn').forEach(b => b.classList.remove('active'));
        const id = { month: 'viewMonthBtn', year: 'viewYearBtn', list: 'viewListBtn' }[currentView];
        document.getElementById(id)?.classList.add('active');
    }

    function renderUpcomingWidget(containerId) {
        const c = document.getElementById(containerId); if (!c) return;
        const members = App.getMembers().filter(m => m.birthDate && m.status !== 'deceased');
        const sorted = members.map(m => ({ ...m, dl: daysUntilBirthday(m.birthDate) })).sort((a, b) => a.dl - b.dl).slice(0, 6);
        if (!sorted.length) { c.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px">אין ימי הולדת</div>'; return; }
        c.innerHTML = sorted.map(m => {
            const bg = m.gender === 'male' ? 'var(--male)' : 'var(--female)';
            const label = m.dl === 0 ? '🎉 היום!' : m.dl === 1 ? 'מחר!' : 'עוד ' + m.dl + ' ימים';
            const lc = m.dl === 0 ? '#f44336' : m.dl <= 7 ? 'var(--accent)' : 'var(--primary)';
            return '<div style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;margin-bottom:5px;cursor:pointer;background:' + (m.dl <= 7 ? '#FFF8E1' : '') + '" onclick="App.switchPage('birthdays')">'
            + '<div style="width:36px;height:36px;border-radius:50%;background:' + bg + ';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.85em;flex-shrink:0">'
            + (m.photo ? '<img src="' + m.photo + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover">' : App.getInitials(m.firstName, m.lastName)) + '</div>'
            + '<div style="flex:1"><div style="font-weight:600;font-size:.9em">' + m.firstName + ' ' + m.lastName + '</div>'
            + '<div style="font-size:.78em;color:var(--text-muted)">' + m.birthDate + '</div></div>'
            + '<span style="background:' + lc + ';color:#fff;padding:3px 10px;border-radius:12px;font-size:.76em;font-weight:600">' + label + '</span></div>';
        }).join('');
    }

    return { render, prevMonth, nextMonth, goToday, goToMonth, setView, showDetail, sendWish, renderUpcomingWidget };
})();