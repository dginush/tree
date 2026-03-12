const HebrewDate = (() => {

    function convert(gYear, gMonth, gDay) {
        try {
            var hDate = new hebcal.HDate(new Date(gYear, gMonth - 1, gDay));
            var day = hDate.getDate();
            var month = hDate.getMonth();
            var year = hDate.getFullYear();
            var monthName = getMonthName(month, year);
            return {
                day: day,
                month: month,
                year: year,
                monthName: monthName,
                isLeap: hebcal.HDate.isLeapYear(year),
                formatted: formatDay(day) + ' ' + monthName + ' ' + formatYear(year)
            };
        } catch (e) {
            console.error('Hebrew date error:', e);
            return { day: 1, month: 1, year: 5785, monthName: '', isLeap: false, formatted: '' };
        }
    }

    function convertWithSunset(gYear, gMonth, gDay, beforeSunset) {
        if (beforeSunset === false) {
            var d = new Date(gYear, gMonth - 1, gDay + 1);
            return convert(d.getFullYear(), d.getMonth() + 1, d.getDate());
        }
        return convert(gYear, gMonth, gDay);
    }

    function hebrewToGregorian(hy, hm, hd) {
        try {
            var hDate = new hebcal.HDate(hd, hm, hy);
            var gDate = hDate.greg();
            return new Date(gDate.getFullYear(), gDate.getMonth(), gDate.getDate());
        } catch (e) {
            return new Date();
        }
    }

    function getNextHebrewAnniversary(originalDateStr, beforeSunset) {
        var hd = fromDateStringFull(originalDateStr, beforeSunset);
        if (!hd) return null;
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var currentHYear = new hebcal.HDate(today).getFullYear();

        for (var tryYear = currentHYear; tryYear <= currentHYear + 2; tryYear++) {
            try {
                var tm = hd.month;
                var td = hd.day;
                if (!hebcal.HDate.isLeapYear(tryYear) && hd.isLeap && tm === 13) {
                    tm = 12;
                }
                var target = new hebcal.HDate(td, tm, tryYear);
                var gDate = target.greg();
                if (gDate >= today) {
                    return {
                        gregorianDate: gDate,
                        hebrewFormatted: formatDay(td) + ' ' + getMonthName(tm, tryYear) + ' ' + formatYear(tryYear)
                    };
                }
            } catch (e) { continue; }
        }
        return null;
    }

    function getMonthName(month, year) {
        var isLeap = false;
        try { isLeap = hebcal.HDate.isLeapYear(year); } catch (e) {}
        if (isLeap) {
            return {
                1: 'ניסן', 2: 'אייר', 3: 'סיוון', 4: 'תמוז',
                5: 'אב', 6: 'אלול', 7: 'תשרי', 8: 'חשוון',
                9: 'כסלו', 10: 'טבת', 11: 'שבט',
                12: "אדר א'", 13: "אדר ב'"
            }[month] || '';
        }
        return {
            1: 'ניסן', 2: 'אייר', 3: 'סיוון', 4: 'תמוז',
            5: 'אב', 6: 'אלול', 7: 'תשרי', 8: 'חשוון',
            9: 'כסלו', 10: 'טבת', 11: 'שבט', 12: 'אדר'
        }[month] || '';
    }

    function formatDay(d) {
        if (d < 1 || d > 30) return String(d);
        var g = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
        var t = ['', 'י', 'כ', 'ל'];
        if (d === 15) return 'ט"ו';
        if (d === 16) return 'ט"ז';
        var tens = Math.floor(d / 10);
        var ones = d % 10;
        if (d < 10) return g[d] + "'";
        if (ones === 0) return t[tens] + "'";
        return t[tens] + '"' + g[ones];
    }

    function formatYear(y) {
        var v = y % 1000;
        var h = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];
        var ta = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
        var oa = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
        var hv = Math.floor(v / 100);
        var tv = Math.floor((v % 100) / 10);
        var ov = v % 10;
        var r = '';
        if (hv > 0) r += h[hv];
        if (tv === 1 && ov === 5) r += 'טו';
        else if (tv === 1 && ov === 6) r += 'טז';
        else {
            if (tv > 0) r += ta[tv];
            if (ov > 0) r += oa[ov];
        }
        if (r.length > 1) r = r.slice(0, -1) + '"' + r.slice(-1);
        else if (r.length === 1) r += "'";
        return "ה'" + r;
    }

    function fromDateString(s, beforeSunset) {
        if (!s) return '';
        var p = s.split('/');
        if (p.length !== 3) return '';
        try {
            var d = parseInt(p[0], 10);
            var m = parseInt(p[1], 10);
            var y = parseInt(p[2], 10);
            if (isNaN(d) || isNaN(m) || isNaN(y)) return '';
            if (m < 1 || m > 12 || d < 1 || d > 31) return '';
            if (typeof beforeSunset === 'boolean') {
                return convertWithSunset(y, m, d, beforeSunset).formatted;
            }
            return convert(y, m, d).formatted;
        } catch (e) { return ''; }
    }

    function fromDateStringFull(s, beforeSunset) {
        if (!s) return null;
        var p = s.split('/');
        if (p.length !== 3) return null;
        try {
            var d = parseInt(p[0], 10);
            var m = parseInt(p[1], 10);
            var y = parseInt(p[2], 10);
            if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
            if (m < 1 || m > 12 || d < 1 || d > 31) return null;
            if (typeof beforeSunset === 'boolean') {
                return convertWithSunset(y, m, d, beforeSunset);
            }
            return convert(y, m, d);
        } catch (e) { return null; }
    }

    return {
        convert: convert,
        convertWithSunset: convertWithSunset,
        fromDateString: fromDateString,
        fromDateStringFull: fromDateStringFull,
        getNextHebrewAnniversary: getNextHebrewAnniversary,
        hebrewToGregorian: hebrewToGregorian,
        isLeapYear: function(y) { try { return hebcal.HDate.isLeapYear(y); } catch(e) { return false; } },
        daysInHebrewMonth: function(m, y) { try { return hebcal.HDate.daysInMonth(m, y); } catch(e) { return 30; } }
    };
})();