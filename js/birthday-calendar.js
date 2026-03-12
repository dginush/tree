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
        return members.filter(function(m) {
            if (!m.birthDate || m.status === 'deceased') return false;
            var bd = parseBirthDate(m.birthDate);
            return bd && bd.month === month;
        }).map(function(m) {
            var bd = parseBirthDate(m.birthDate);
            var age = year - bd.year;
            var heb = HebrewDate.fromDateString(m.birthDate);
            return Object.assign({}, m, {
                birthDay: bd.day,
                birthMonth: bd.month,
                birthYear: bd.year,
                turnsAge: age,
                hebrewDate: heb
            });
        }).sort(function(a, b) { return a.birthDay - b.birthDay; });
    }

    function getBirthdaysForYear(year) {
        var all = [];
        for (var m = 0; m < 12; m++) {
            all.push({ month: m, birthdays: getBirthdaysForMonth(m, year) });
        }
        return all;
    }

    function daysInMonth(month, year) { return new Date(year, month + 1, 0).getDate(); }
    function firstDayOfMonth(month, year) { return new Date(year, month, 1).getDay(); }

    function render() {
        updateLabel();
        if (currentView === 'month') renderMonth();
        else if (currentView === 'year') renderYear();
        else renderList();
    }

    function updateLabel() {
        var el = document.getElementById('calendarMonthLabel');
        if (!el) return;
        if (currentView === 'year') el.textContent = currentYear.toString();
        else el.textContent = HEB_MONTHS[currentMonth] + ' ' + currentYear;
    }

    function renderMonth() {
        var c = document.getElementById('calendarContent');
        if (!c) return;
        var birthdays = getBirthdaysForMonth(currentMonth, currentYear);
        var bdayMap = {};
        birthdays.forEach(function(b) {
            if (!bdayMap[b.birthDay]) bdayMap[b.birthDay] = [];
            bdayMap[b.birthDay].push(b);
        });
        var days = daysInMonth(currentMonth, currentYear);
        var firstDay = firstDayOfMonth(currentMonth, currentYear);
        var today = new Date();
        var isCurrentMonth = today.getMonth() === currentMonth && today.getFullYear() === currentYear;

        var html = '<div class="calendar-grid"><div class="calendar-header-row">';
        HEB_DAYS.forEach(function(d) { html += '<div class="calendar-day-header">' + d + '</div>'; });
        html += '</div><div class="calendar-days">';

        for (var i = 0; i < firstDay; i++) html += '<div class="calendar-cell empty"></div>';

        for (var d = 1; d <= days; d++) {
            var isToday = isCurrentMonth && today.getDate() === d;
            var hasBday = bdayMap[d];
            html += '<div class="calendar-cell' + (isToday ? ' today' : '') + (hasBday ? ' has-birthday' : '') + '">';
            html += '<div class="cell-date' + (isToday ? ' today-date' : '') + '">' + d + '</div>';
            if (hasBday) {
                hasBday.forEach(function(b) {
                    var bg = b.gender === 'male' ? '#E3F2FD' : '#FCE4EC';
                    var color = b.gender === 'male' ? '#1565C0' : '#C2185B';
                    html += '<div class="bday-chip" style="background:' + bg + ';color:' + color + '" onclick="BirthdayCalendar.showDetail(\'' + b.id + '\',' + currentYear + ')">';
                    html += '<span class="bday-chip-emoji">🎂</span>';
                    html += '<span class="bday-chip-name">' + b.firstName + '</span>';
                    html += '<span class="bday-chip-age">' + b.turnsAge + '</span></div>';
                });
            }
            html += '</div>';
        }

        var totalCells = firstDay + days;
        var remaining = 7 - (totalCells % 7);
        if (remaining < 7) {
            for (var r = 0; r < remaining; r++) html += '<div class="calendar-cell empty"></div>';
        }
        html += '</div></div>';

        html += '<div class="birthday-summary"><div class="summary-title">🎂 ימי הולדת ב' + HEB_MONTHS[currentMonth] + ' (' + birthdays.length + ')</div>';
        if (birthdays.length === 0) {
            html += '<div class="summary-empty">אין ימי הולדת בחודש זה</div>';
        } else {
            html += '<div class="summary-list">';
            birthdays.forEach(function(b) {
                var daysLeft = daysUntilBirthday(b.birthDate);
                var bg = b.gender === 'male' ? 'var(--male)' : 'var(--female)';
                html += '<div class="summary-item" onclick="BirthdayCalendar.showDetail(\'' + b.id + '\',' + currentYear + ')">';
                html += '<div class="summary-avatar" style="background:' + bg + '">' + App.getInitials(b.firstName, b.lastName) + '</div>';
                html += '<div class="summary-info"><div class="summary-name">' + b.firstName + ' ' + b.lastName + '</div>';
                html += '<div class="summary-meta">' + b.birthDay + ' ' + HEB_MONTHS[currentMonth] + ' — יתמלא ' + b.turnsAge;
                if (b.hebrewDate) html += ' — 🕎 ' + b.hebrewDate;
                html += '</div></div>';
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
        var c = document.getElementById('calendarContent');
        if (!c) return;
        var yearData = getBirthdaysForYear(currentYear);
        var total = 0;
        yearData.forEach(function(m) { total += m.birthdays.length; });

        var html = '<div class="year-grid">';
        yearData.forEach(function(md, idx) {
            var count = md.birthdays.length;
            var isCM = new Date().getMonth() === idx && new Date().getFullYear() === currentYear;
            html += '<div class="year-month-card' + (isCM ? ' current' : '') + '" onclick="BirthdayCalendar.goToMonth(' + idx + ')">';
            html += '<div class="year-month-name">' + HEB_MONTHS[idx] + '</div>';
            html += '<div class="year-month-count">' + (count > 0 ? count : '—') + '</div>';
            html += '<div class="year-month-label">' + (count > 0 ? 'ימי הולדת' : '') + '</div>';
            if (count > 0) {
                html += '<div class="year-month-faces">';
                md.birthdays.slice(0, 4).forEach(function(b) {
                    var bg = b.gender === 'male' ? 'var(--male)' : 'var(--female)';
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
        var c = document.getElementById('calendarContent');
        if (!c) return;
        var allMembers = App.getMembers().filter(function(m) { return m.birthDate && m.status !== 'deceased'; });
        var withDays = allMembers.map(function(m) {
            var dl = daysUntilBirthday(m.birthDate);
            var bd = parseBirthDate(m.birthDate);
            var age = bd ? new Date().getFullYear() - bd.year + (dl === 0 ? 0 : dl < 0 ? 1 : 0) : 0;
            var heb = HebrewDate.fromDateString(m.birthDate);
            return Object.assign({}, m, { daysLeft: dl, nextAge: age, hebrewDate: heb, bd: bd });
        }).sort(function(a, b) { return a.daysLeft - b.daysLeft; });

        var html = '<div class="birthday-list-view">';
        if (!withDays.length) {
            html += '<div class="empty-state"><div class="icon">🎂</div><h3>אין ימי הולדת</h3></div>';
        } else {
            withDays.forEach(function(m) {
                var bg = m.gender === 'male' ? 'var(--male)' : 'var(--female)';
                var badge = '', badgeClass = '';
                if (m.daysLeft === 0) { badge = '🎉 היום!'; badgeClass = 'today-badge'; }
                else if (m.daysLeft === 1) { badge = 'מחר!'; badgeClass = 'soon-badge'; }
                else if (m.daysLeft <= 7) { badge = 'עוד ' + m.daysLeft + ' ימים'; badgeClass = 'soon-badge'; }
                else if (m.daysLeft <= 30) { badge = 'עוד ' + m.daysLeft + ' ימים'; badgeClass = 'month-badge'; }
                else { badge = 'עוד ' + m.daysLeft + ' ימים'; }
                html += '<div class="list-birthday-item" onclick="BirthdayCalendar.showDetail(\'' + m.id + '\',' + currentYear + ')">';
                html += '<div class="list-bday-avatar" style="background:' + bg + '">';
                html += m.photo ? '<img src="' + m.photo + '">' : App.getInitials(m.firstName, m.lastName);
                html += '</div>';
                html += '<div class="list-bday-info"><div class="list-bday-name">' + m.firstName + ' ' + m.lastName + '</div>';
                html += '<div class="list-bday-date">📅 ' + m.birthDate;
                if (m.hebrewDate) html += ' — 🕎 ' + m.hebrewDate;
                html += '</div>';
                html += '<div class="list-bday-relation">' + (App.RELATION_LABELS[m.relationType] || '') + '</div></div>';
                html += '<div class="list-bday-right"><div class="list-bday-age">' + m.nextAge + '</div>';
                html += '<div style="font-size:.75em;color:var(--text-muted)">שנים</div>';
                if (badge) html += '<div class="summary-badge ' + badgeClass + '">' + badge + '</div>';
                html += '</div></div>';
            });
        }
        html += '</div>';
        c.innerHTML = html;
    }

    function daysUntilBirthday(dateStr) {
        if (!dateStr) return 9999;
        var bd = parseBirthDate(dateStr);
        if (!bd) return 9999;
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var next = new Date(today.getFullYear(), bd.month, bd.day);
        if (next < today) next = new Date(today.getFullYear() + 1, bd.month, bd.day);
        return Math.ceil((next - today) / 864e5);
    }

    function showDetail(memberId, year) {
        var m = App.getMembers().find(function(x) { return x.id === memberId; });
        if (!m) return;
        var bd = parseBirthDate(m.birthDate);
        var age = bd ? year - bd.year : 0;
        var dl = daysUntilBirthday(m.birthDate);
        var heb = HebrewDate.fromDateString(m.birthDate);
        var bg = m.gender === 'male' ? 'var(--male)' : 'var(--female)';

        var html = '<div style="text-align:center;padding:10px">';
        html += '<div style="font-size:4em;margin-bottom:10px">🎂</div>';
        if (m.photo) {
            html += '<img src="' + m.photo + '" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:4px solid ' + bg + ';margin-bottom:10px">';
        } else {
            html += '<div style="width:80px;height:80px;border-radius:50%;background:' + bg + ';display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.8em;font-weight:700;margin:0 auto 10px">';
            html += App.getInitials(m.firstName, m.lastName) + '</div>';
        }
        html += '<h2>' + m.firstName + ' ' + m.lastName + '</h2>';
        html += '<div style="color:var(--text-muted);margin-bottom:15px">' + (App.RELATION_LABELS[m.relationType] || '') + '</div>';
        html += '<div class="bday-detail-grid">';
        html += '<div class="bday-detail-item"><div class="bday-detail-value">' + age + '</div><div class="bday-detail-label">שנים ב-' + year + '</div></div>';
        html += '<div class="bday-detail-item"><div class="bday-detail-value">' + m.birthDate + '</div><div class="bday-detail-label">תאריך לידה</div></div>';
        if (heb) {
            html += '<div class="bday-detail-item"><div class="bday-detail-value" style="font-size:.9em">' + heb + '</div><div class="bday-detail-label">🕎 תאריך עברי</div></div>';
        }
        if (dl === 0) {
            html += '<div class="bday-detail-item" style="background:#FFF3E0;grid-column:1/-1"><div class="bday-detail-value" style="color:#f44336">🎉 היום יום הולדת!</div></div>';
        } else {
            html += '<div class="bday-detail-item" style="grid-column:1/-1"><div class="bday-detail-value">' + dl + '</div><div class="bday-detail-label">ימים ליום הולדת הבא</div></div>';
        }
        html += '</div>';
        html += '<div style="margin-top:15px;display:flex;gap:8px;justify-content:center">';
        html += '<button class="btn btn-primary btn-sm" onclick="App.closeModal(\'birthdayDetailModal\');App.viewMember(\'' + m.id + '\')">👁️ פרטים</button>';
        html += '<button class="btn btn-accent btn-sm" onclick="BirthdayCalendar.sendWish(\'' + m.firstName + '\')">🎂 שלח ברכה</button>';
        html += '</div></div>';

        document.getElementById('birthdayDetailContent').innerHTML = html;
        App.openModal('birthdayDetailModal');
    }

    function sendWish(name) {
        var text = '🎂🎉 חג שמח ' + name + '! מאחלים יום הולדת מדהים!';
        if (navigator.share) {
            navigator.share({ title: 'ברכת יום הולדת', text: text });
        } else {
            window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
        }
    }

    function prevMonth() {
        if (currentView === 'year') { currentYear--; render(); return; }
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        render();
    }

    function nextMonth() {
        if (currentView === 'year') { currentYear++; render(); return; }
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        render();
    }

    function goToday() {
        currentMonth = new Date().getMonth();
        currentYear = new Date().getFullYear();
        render();
    }

    function goToMonth(m) {
        currentMonth = m;
        currentView = 'month';
        updateViewBtns();
        render();
    }

    function setView(v) {
        currentView = v;
        updateViewBtns();
        render();
    }

    function updateViewBtns() {
        document.querySelectorAll('.calendar-view-btn').forEach(function(b) { b.classList.remove('active'); });
        var id = { month: 'viewMonthBtn', year: 'viewYearBtn', list: 'viewListBtn' }[currentView];
        var el = document.getElementById(id);
        if (el) el.classList.add('active');
    }

    function renderUpcomingWidget(containerId) {
        var c = document.getElementById(containerId);
        if (!c) return;
        var members = App.getMembers().filter(function(m) { return m.birthDate && m.status !== 'deceased'; });
        var sorted = members.map(function(m) {
            return Object.assign({}, m, { dl: daysUntilBirthday(m.birthDate) });
        }).sort(function(a, b) { return a.dl - b.dl; }).slice(0, 6);

        if (!sorted.length) {
            c.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px">אין ימי הולדת</div>';
            return;
        }

        c.innerHTML = sorted.map(function(m) {
            var bg = m.gender === 'male' ? 'var(--male)' : 'var(--female)';
            var label = m.dl === 0 ? '🎉 היום!' : m.dl === 1 ? 'מחר!' : 'עוד ' + m.dl + ' ימים';
            var lc = m.dl === 0 ? '#f44336' : m.dl <= 7 ? 'var(--accent)' : 'var(--primary)';
            return '<div style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;margin-bottom:5px;cursor:pointer;background:' + (m.dl <= 7 ? '#FFF8E1' : '') + '" onclick="App.switchPage(\'birthdays\')">'
                + '<div style="width:36px;height:36px;border-radius:50%;background:' + bg + ';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.85em;flex-shrink:0">'
                + (m.photo ? '<img src="' + m.photo + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover">' : App.getInitials(m.firstName, m.lastName))
                + '</div>'
                + '<div style="flex:1"><div style="font-weight:600;font-size:.9em">' + m.firstName + ' ' + m.lastName + '</div>'
                + '<div style="font-size:.78em;color:var(--text-muted)">' + m.birthDate + '</div></div>'
                + '<span style="background:' + lc + ';color:#fff;padding:3px 10px;border-radius:12px;font-size:.76em;font-weight:600">' + label + '</span></div>';
        }).join('');
    }

    return {
        render: render,
        prevMonth: prevMonth,
        nextMonth: nextMonth,
        goToday: goToday,
        goToMonth: goToMonth,
        setView: setView,
        showDetail: showDetail,
        sendWish: sendWish,
        renderUpcomingWidget: renderUpcomingWidget
    };
})();