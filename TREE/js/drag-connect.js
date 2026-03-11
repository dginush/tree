const DragConnect = (() => {
    let active = false, sId = null, lineEl = null, sX = 0, sY = 0;

    function toggleMode() {
        active = !active;
        const b = document.getElementById('connectModeBtn');
        const i = document.getElementById('connectInstructions');
        if (active) {
            b.classList.add('btn-primary');
            b.classList.remove('btn-outline');
            b.innerHTML = '🔗 ביטול';
            i.style.display = 'flex';
            eN();
        } else {
            b.classList.remove('btn-primary');
            b.classList.add('btn-outline');
            b.innerHTML = '🔗 קישור';
            i.style.display = 'none';
            dN();
            cancel();
        }
    }

    function eN() {
        document.querySelectorAll('.tree-node-content').forEach(n => {
            n.classList.add('connectable');
            n.addEventListener('mousedown', onMD);
            n.addEventListener('touchstart', onTS, { passive: false });
        });
    }

    function dN() {
        document.querySelectorAll('.tree-node-content').forEach(n => {
            n.classList.remove('connectable', 'drag-source', 'drag-target');
            n.removeEventListener('mousedown', onMD);
            n.removeEventListener('touchstart', onTS);
        });
    }

    function onMD(e) {
        if (!active) return;
        e.preventDefault();
        e.stopPropagation();
        sId = this.dataset.memberId;
        if (!sId) return;
        this.classList.add('drag-source');
        const r = this.getBoundingClientRect();
        sX = r.left + r.width / 2;
        sY = r.top + r.height / 2;
        cL();
        document.addEventListener('mousemove', onMM);
        document.addEventListener('mouseup', onMU);
    }

    function onTS(e) {
        if (!active) return;
        e.preventDefault();
        sId = this.dataset.memberId;
        if (!sId) return;
        this.classList.add('drag-source');
        const r = this.getBoundingClientRect();
        sX = r.left + r.width / 2;
        sY = r.top + r.height / 2;
        cL();
        document.addEventListener('touchmove', onTM, { passive: false });
        document.addEventListener('touchend', onTE);
    }

    function cL() {
        lineEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        lineEl.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999';
        lineEl.innerHTML = '<line id="dl" x1="' + sX + '" y1="' + sY + '" x2="' + sX + '" y2="' + sY + '" stroke="#4CAF50" stroke-width="3" stroke-dasharray="8,4"/>';
        document.body.appendChild(lineEl);
    }

    function uL(x, y) {
        if (!lineEl) return;
        const l = lineEl.querySelector('#dl');
        if (l) {
            l.setAttribute('x2', x);
            l.setAttribute('y2', y);
        }
        document.querySelectorAll('.tree-node-content').forEach(n => {
            n.classList.remove('drag-target');
            const r = n.getBoundingClientRect();
            if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom && n.dataset.memberId !== sId) {
                n.classList.add('drag-target');
            }
        });
    }

    function onMM(e) { uL(e.clientX, e.clientY); }
    function onTM(e) { e.preventDefault(); uL(e.touches[0].clientX, e.touches[0].clientY); }
    function onMU(e) { fin(e.clientX, e.clientY); document.removeEventListener('mousemove', onMM); document.removeEventListener('mouseup', onMU); }
    function onTE(e) { fin(e.changedTouches[0].clientX, e.changedTouches[0].clientY); document.removeEventListener('touchmove', onTM); document.removeEventListener('touchend', onTE); }

    function fin(x, y) {
        let tid = null;
        document.querySelectorAll('.tree-node-content').forEach(n => {
            const r = n.getBoundingClientRect();
            if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom && n.dataset.memberId !== sId) {
                tid = n.dataset.memberId;
            }
            n.classList.remove('drag-source', 'drag-target');
        });
        rL();
        if (sId && tid) showDlg(sId, tid);
        sId = null;
    }

    function cancel() {
        sId = null;
        rL();
        document.querySelectorAll('.tree-node-content').forEach(n => n.classList.remove('drag-source', 'drag-target'));
    }

    function rL() {
        if (lineEl) { lineEl.remove(); lineEl = null; }
    }

    function showDlg(fid, tid) {
        const ms = App.getMembers();
        const f = ms.find(m => m.id === fid);
        const t = ms.find(m => m.id === tid);
        if (!f || !t) return;

        const fc = f.gender === 'male' ? 'var(--male)' : 'var(--female)';
        const tc = t.gender === 'male' ? 'var(--male)' : 'var(--female)';

        let html = '<div style="text-align:center;margin-bottom:20px">';
        html += '<div style="display:flex;align-items:center;justify-content:center;gap:20px">';
        html += '<div>';
        html += '<div style="width:50px;height:50px;border-radius:50%;background:' + fc + ';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;margin:0 auto 5px">' + App.getInitials(f.firstName, f.lastName) + '</div>';
        html += '<div style="font-weight:600;font-size:.9em">' + f.firstName + '</div>';
        html += '</div>';
        html += '<span style="font-size:1.5em">🔗</span>';
        html += '<div>';
        html += '<div style="width:50px;height:50px;border-radius:50%;background:' + tc + ';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;margin:0 auto 5px">' + App.getInitials(t.firstName, t.lastName) + '</div>';
        html += '<div style="font-weight:600;font-size:.9em">' + t.firstName + '</div>';
        html += '</div></div></div>';
        html += '<div class="form-group" style="margin-bottom:15px">';
        html += '<label class="form-label">סוג קשר:</label>';
        html += '<select class="form-select" id="connectType">';
        html += '<option value="parent-child">' + f.firstName + ' הורה של ' + t.firstName + '</option>';
        html += '<option value="child-parent">' + t.firstName + ' הורה של ' + f.firstName + '</option>';
        html += '<option value="spouse">בני זוג</option>';
        html += '<option value="ex-spouse">גרושים</option>';
        html += '</select></div>';
        html += '<div style="display:flex;gap:10px;justify-content:center">';
        html += '<button class="btn btn-outline" onclick="App.closeModal(\'connectModal\')">ביטול</button>';
        html += '<button class="btn btn-primary" onclick="DragConnect.apply(\'' + fid + '\',\'' + tid + '\')">✓ חבר</button>';
        html += '</div>';

        document.getElementById('connectContent').innerHTML = html;
        App.openModal('connectModal');
    }

    async function apply(fid, tid) {
        const t = document.getElementById('connectType').value;
        const ms = App.getMembers();
        const f = ms.find(m => m.id === fid);
        const tr = ms.find(m => m.id === tid);
        if (!f || !tr) return;

        if (t === 'parent-child') {
            tr.parentId = fid;
            await FirebaseDB.saveMember(tr);
        } else if (t === 'child-parent') {
            f.parentId = tid;
            await FirebaseDB.saveMember(f);