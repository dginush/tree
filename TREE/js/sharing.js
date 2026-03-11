const Sharing = (() => {
    let cTid = null, cRole = null, tInfo = null, db = null;

    function init(d) { db = d; }

    function genCode() {
        const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let r = '';
        for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)];
        return r;
    }

    async function createTree(uid, name) {
        const tid = 'tree_' + Date.now().toString(36);
        const sc = genCode();
        const td = {
            id: tid,
            name: 'העץ של ' + (name || 'המשפחה'),
            ownerId: uid,
            shareCode: sc,
            members: { [uid]: { role: 'owner', name: name || '', joinedAt: new Date().toISOString() } },
            createdAt: new Date().toISOString(),
            settings: { requireApproval: false, allowEditorDelete: false }
        };
        await db.collection('trees').doc(tid).set(td);
        cTid = tid;
        cRole = 'owner';
        tInfo = td;
        await db.collection('userProfiles').doc(uid).set({
            currentTreeId: tid,
            trees: firebase.firestore.FieldValue.arrayUnion({ treeId: tid, name: td.name, role: 'owner' })
        }, { merge: true });
        return td;
    }

    async function loadUserTree(uid) {
        try {
            const p = await db.collection('userProfiles').doc(uid).get();
            const uc = getURLCode();

            if (uc) {
                const j = await joinByCode(uid, uc, firebase.auth().currentUser?.displayName || '');
                if (j) return j;
            }

            if (p.exists) {
                const d = p.data();
                if (d.currentTreeId) {
                    const t = await db.collection('trees').doc(d.currentTreeId).get();
                    if (t.exists) {
                        tInfo = t.data();
                        cTid = d.currentTreeId;
                        cRole = tInfo.members?.[uid]?.role || 'viewer';
                        return tInfo;
                    }
                }
            }
            return null;
        } catch (e) {
            console.error('loadUserTree error:', e);
            return null;
        }
    }

    function getURLCode() {
        const p = new URLSearchParams(window.location.search);
        return p.get('join') || null;
    }

    async function joinByCode(uid, code, name) {
        try {
            code = code.toUpperCase().trim();
            const s = await db.collection('trees').where('shareCode', '==', code).limit(1).get();
            if (s.empty) return null;

            const td = s.docs[0].data();
            if (td.members?.[uid]) {
                cTid = td.id;
                cRole = td.members[uid].role;
                tInfo = td;
                return td;
            }

            const role = 'editor';
            await db.collection('trees').doc(td.id).update({
                ['members.' + uid]: { role, name, joinedAt: new Date().toISOString() }
            });
            await db.collection('userProfiles').doc(uid).set({
                currentTreeId: td.id,
                trees: firebase.firestore.FieldValue.arrayUnion({ treeId: td.id, name: td.name, role })
            }, { merge: true });

            cTid = td.id;
            cRole = role;
            tInfo = { ...td };
            tInfo.members[uid] = { role, name };
            return tInfo;
        } catch (e) {
            console.error('joinByCode error:', e);
            return null;
        }
    }

    function getShareLink() {
        if (!tInfo) return '';
        return location.origin + location.pathname + '?join=' + tInfo.shareCode;
    }

    async function regenerateCode() {
        if (cRole !== 'owner') return;
        const c = genCode();
        await db.collection('trees').doc(cTid).update({ shareCode: c });
        tInfo.shareCode = c;
        return c;
    }

    async function setMemberRole(uid, tid, r) {
        if (cRole !== 'owner') return;
        await db.collection('trees').doc(cTid).update({ ['members.' + tid + '.role']: r });
        if (tInfo.members[tid]) tInfo.members[tid].role = r;
        App.showToast('עודכן ✓');
    }

    async function removeMember(uid, tid) {
        if (cRole !== 'owner') return;
        await db.collection('trees').doc(cTid).update({
            ['members.' + tid]: firebase.firestore.FieldValue.delete()
        });
        delete tInfo.members[tid];
        App.showToast('הוסר', 'warning');
    }

    async function renameTree(n) {
        if (cRole !== 'owner') return;
        await db.collection('trees').doc(cTid).update({ name: n });
        tInfo.name = n;
    }

    let tU = null;
    function listenToTree(cb) {
        if (!db || !cTid) return;
        if (tU) tU();
        tU = db.collection('trees').doc(cTid).onSnapshot(d => {
            if (d.exists) {
                tInfo = d.data();
                const uid = firebase.auth().currentUser?.uid;
                if (uid && tInfo.members?.[uid]) cRole = tInfo.members[uid].role;
                cb(tInfo);
            }
        });
    }

    function stopListening() { if (tU) { tU(); tU = null; } }

    function openSharingModal() { renderContent(); App.openModal('sharingModal'); }

    function renderContent() {
        const c = document.getElementById('sharingContent');
        if (!c || !tInfo) return;
        const link = getShareLink();
        const uid = firebase.auth().currentUser?.uid;
        const own = cRole === 'owner';
        const es = Object.entries(tInfo.members || {});
        let mh = '';
        es.forEach(([id, info]) => {
            const me = id === uid;
            const rl = { owner: '👑 בעלים', editor: '✏️ עורך', viewer: '👁️ צופה' };
            const rc = { owner: '#FF8F00', editor: '#2E7D32', viewer: '#1976D2' };
            mh += '<div class="share-member-row"><div class="share-member-info"><div class="share-member-avatar" style="background:' + (rc[info.role] || '#999') + '">' + (info.name || '?')[0].toUpperCase() + '</div><div><div class="share-member-name">' + (info.name || '') + (me ? ' (אני)' : '') + '</div><div class="share-member-role" style="color:' + (rc[info.role] || '') + '">' + rl[info.role] + '</div></div></div>' + (own && !me ? '<div class="share-member-actions"><select class="form-select compact" onchange="Sharing.setMemberRole(\'' + uid + '\',\'' + id + '\',this.value)" style="font-size:.8em;padding:4px"><option value="editor" ' + (info.role === 'editor' ? 'selected' : '') + '>✏️</option><option value="viewer" ' + (info.role === 'viewer' ? 'selected' : '') + '>👁️</option></select><button class="btn btn-danger btn-sm" style="padding:4px 8px;font-size:.75em" onclick="if(confirm(\'' + 'להסיר?' + '\'))Sharing.removeMember(\'' + uid + '\',\'' + id + '\').then(()=>Sharing.renderContent())">✕</button></div>' : '') + '</div>';
        });
        c.innerHTML = '<div class="share-section"><div class="share-section-title">🔗 קישור</div><div class="share-link-box"><input type="text" class="form-input share-link-input" id="shareLinkInput" value="' + link + '" readonly onclick="this.select()"><button class="btn btn-primary btn-sm" onclick="Sharing.copyLink()">📋</button></div><div class="share-actions-row"><button class="btn btn-accent btn-sm" onclick="Sharing.shareWA()">📞 WhatsApp</button>' + (own ? '<span style="font-weight:700">🔑 ' + tInfo.shareCode + '</span>' : '') + '</div></div><div class="share-section"><div class="share-section-title">👥 חברים (' + es.length + ')</div><div class="share-members-list">' + mh + '</div></div><div class="share-section"><div class="role-info-box ' + cRole + '">' + (cRole === 'owner' ? '👑 בעלים' : cRole === 'editor' ? '✏️ עורך' : '👁️ צופה') + '</div></div>';
    }

    async function copyLink() {
        try {
            await navigator.clipboard.writeText(getShareLink());
            App.showToast('הועתק! 📋');
        } catch {
            document.getElementById('shareLinkInput')?.select();
            document.execCommand('copy');
            App.showToast('הועתק!');
        }
    }

    function shareWA() {
        window.open('https://wa.me/?text=' + encodeURIComponent('🌳 הצטרפו לעץ המשפחה!\n' + getShareLink() + '\nקוד: ' + (tInfo?.shareCode || '')), '_blank');
    }

    function canEdit() { return cRole === 'owner' || cRole === 'editor'; }
    function canDelete() { return cRole === 'owner'; }

    return {
        init, createTree, loadUserTree, joinByCode, getShareLink,
        regenerateCode, setMemberRole, removeMember, renameTree,
        listenToTree, stopListening, openSharingModal, renderContent,
        copyLink, shareWA, canEdit, canDelete,
        isOwner: () => cRole === 'owner',
        getRole: () => cRole,
        getTreeId: () => cTid,
        getTreeInfo: () => tInfo
    };
})();