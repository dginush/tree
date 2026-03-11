const HebrewDate = (() => {
    function isLY(y) { return ((7 * y + 1) % 19) < 7; }

    function eD(y) {
        const m = Math.floor((235 * (y - 1) + 234) / 19);
        let p = 12084 + 13753 * m;
        let h = Math.floor(p / 1080);
        p %= 1080;
        let d = 1 + 29 * m + Math.floor(h / 24);
        h %= 24;
        let a = d;
        if (p >= 19440 || (p >= 9924 && d % 7 === 2 && !isLY(y)) || (p >= 16789 && d % 7 === 1 && isLY(y - 1))) a = d + 1;
        const dw = a % 7;
        if (dw === 0 || dw === 3 || dw === 5) a++;
        return a;
    }

    function yD(y) { return eD(y + 1) - eD(y); }

    function t1(hy) {
        const r = eD(5784), e = eD(hy);
        const d = new Date(2023, 8, 16);
        d.setDate(d.getDate() + (e - r));
        return d;
    }

    function convert(yr, mo, dy) {
        const g = new Date(yr, mo - 1, dy);
        let hy = 5784 + Math.floor(yr - 2023);
        let t = t1(hy);
        if (g < t) { hy--; t = t1(hy); }
        const tn = t1(hy + 1);
        if (g >= tn) { hy++; t = tn; }
        const dd = Math.round((g - t) / 864e5);
        const yl = yD(hy), lp = isLY(hy);
        let cv = 29, kv = 30;
        if (yl === 355 || yl === 385) cv = 30;
        if (yl === 353 || yl === 383) kv = 29;
        const ml = lp ? [30, cv, kv, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29] : [30, cv, kv, 29, 30, 29, 30, 29, 30, 29, 30, 29];
        let hm = 0, rem = dd;
        while (hm < ml.length && rem >= ml[hm]) { rem -= ml[hm]; hm++; }
        let hd = rem + 1;
        if (hm >= ml.length) hm = ml.length - 1;
        if (hd < 1) hd = 1;
        if (hd > 30) hd = 30;
        const mn = lp ?
            ['תשרי', 'חשוון', 'כסלו', 'טבת', 'שבט', "אדר א'", "אדר ב'", 'ניסן', 'אייר', 'סיוון', 'תמוז', 'אב', 'אלול'] :
            ['תשרי', 'חשוון', 'כסלו', 'טבת', 'שבט', 'אדר', 'ניסן', 'אייר', 'סיוון', 'תמוז', 'אב', 'אלול'];
        return { formatted: ds(hd) + ' ' + (mn[hm] || '') + ' ' + gy(hy) };
    }

    function ds(d) {
        const o = ['', "א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ז'", "ח'", "ט'"];
        const t = ['', "י'", "כ'", "ל'"];
        if (d === 15) return 'ט"ו';
        if (d === 16) return 'ט"ז';
        if (d < 10) return o[d];
        if (d === 10) return "י'";
        if (d === 20) return "כ'";
        if (d === 30) return "ל'";
        return t[Math.floor(d / 10)] + o[d % 10];
    }

    function gy(y) {
        const v = y % 1000;
        const h = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];
        const ta = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
        const oa = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
        const hv = Math.floor(v / 100), tv = Math.floor(v % 100 / 10), ov = v % 10;
        let r = '';
        if (hv > 0) r += h[hv];
        if (tv === 1 && ov === 5) r += 'טו';
        else if (tv === 1 && ov === 6) r += 'טז';
        else r += ta[tv] + oa[ov];
        if (r.length > 1) r = r.slice(0, -1) + '"' + r.slice(-1);
        else if (r.length === 1) r += "'";
        return "ה'" + r;
    }

    function fromDateString(s) {
        if (!s) return '';
        const p = s.split('/');
        if (p.length !== 3) return '';
        try { return convert(parseInt(p[2]), parseInt(p[1]), parseInt(p[0])).formatted; }
        catch (e) { return ''; }
    }

    return { convert, fromDateString };
})();