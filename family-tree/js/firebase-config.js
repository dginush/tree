const FirebaseDB = (() => {
    const firebaseConfig = {
        apiKey: "AIzaSyBzuTzWlCZ172viYyL_GF2znagk1Gp2UDE",
        authDomain: "family-tree-d41a6.firebaseapp.com",
        projectId: "family-tree-d41a6",
        storageBucket: "family-tree-d41a6.firebasestorage.app",
        messagingSenderId: "983366627690",
        appId: "1:983366627690:web:c7ed703a8c35c2991df513"
    };

    let db = null, isConnected = false;

    function init() {
        try {
            // Check if already initialized
            if (firebase.apps.length) {
                db = firebase.firestore();
                isConnected = true;
                updateStatus('synced', 'מסונכרן');
                return true;
            }

            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();

            // Enable persistence for offline support
            db.enablePersistence({ synchronizeTabs: true }).catch(e => {
                console.log('Persistence error (non-critical):', e.code);
            });

            isConnected = true;
            updateStatus('synced', 'מסונכרן');
            return true;
        } catch (e) {
            console.error('Firebase init error:', e);
            updateStatus('error', 'שגיאה');
            return false;
        }
    }

    function getDb() { return db; }

    function updateStatus(t, x) {
        const el = document.getElementById('syncStatus');
        if (!el) return;
        const d = el.querySelector('.sync-dot'), tx = el.querySelector('.sync-text');
        if (!d || !tx) return;
        d.className = 'sync-dot';
        d.style.background = '';
        if (t === 'synced') d.classList.add('synced');
        else if (t === 'syncing') d.classList.add('syncing');
        else if (t === 'error') d.style.background = '#ff5252';
        tx.textContent = x;
    }

    function getCollectionPath(c) {
        const tid = Sharing.getTreeId();
        if (!tid) throw new Error('No tree selected');
        return 'trees/' + tid + '/' + c;
    }

    let mU = null, eU = null;

    function listenToMembers(cb) {
        if (!db) return;
        if (mU) mU();
        try {
            const path = getCollectionPath('familyMembers');
            mU = db.collection(path).onSnapshot(s => {
                const a = [];
                s.forEach(d => a.push({ id: d.id, ...d.data() }));
                updateStatus('synced', 'מסונכרן');
                cb(a);
            }, e => {
                console.error('Members listen error:', e);
                updateStatus('error', 'שגיאה');
            });
        } catch (e) {
            console.error('Listen setup error:', e);
        }
    }

    function listenToEvents(cb) {
        if (!db) return;
        if (eU) eU();
        try {
            const path = getCollectionPath('familyEvents');
            eU = db.collection(path).onSnapshot(s => {
                const a = [];
                s.forEach(d => a.push({ id: d.id, ...d.data() }));
                cb(a);
            }, e => {
                console.error('Events listen error:', e);
            });
        } catch (e) {
            console.error('Events listen setup error:', e);
        }
    }

    function stopListening() {
        if (mU) { mU(); mU = null; }
        if (eU) { eU(); eU = null; }
    }

    async function getMembers() {
        if (!db) return [];
        updateStatus('syncing', 'טוען...');
        try {
            const s = await db.collection(getCollectionPath('familyMembers')).get();
            const a = [];
            s.forEach(d => a.push({ id: d.id, ...d.data() }));
            updateStatus('synced', 'מסונכרן');
            return a;
        } catch (e) {
            console.error('getMembers error:', e);
            updateStatus('error', 'שגיאה');
            return [];
        }
    }

    async function saveMember(m) {
        if (!db || !Sharing.canEdit()) return;
        updateStatus('syncing', 'שומר...');
        try {
            await db.collection(getCollectionPath('familyMembers')).doc(m.id).set(JSON.parse(JSON.stringify(m)));
            updateStatus('synced', 'מסונכרן');
        } catch (e) {
            console.error('saveMember error:', e);
            updateStatus('error', 'שגיאה');
        }
    }

    async function deleteMember(id) {
        if (!db || !Sharing.canDelete()) return;
        try {
            await db.collection(getCollectionPath('familyMembers')).doc(id).delete();
            updateStatus('synced', 'מסונכרן');
        } catch (e) {
            console.error('deleteMember error:', e);
        }
    }

    async function saveAllMembers(ms) {
        if (!db || !Sharing.canEdit()) return;
        try {
            const b = db.batch();
            const p = getCollectionPath('familyMembers');
            ms.forEach(m => b.set(db.collection(p).doc(m.id), JSON.parse(JSON.stringify(m))));
            await b.commit();
            updateStatus('synced', 'מסונכרן');
        } catch (e) {
            console.error('saveAllMembers error:', e);
        }
    }

    async function getEvents() {
        if (!db) return [];
        try {
            const s = await db.collection(getCollectionPath('familyEvents')).get();
            const a = [];
            s.forEach(d => a.push({ id: d.id, ...d.data() }));
            return a;
        } catch (e) {
            console.error('getEvents error:', e);
            return [];
        }
    }

    async function saveEvent(ev) {
        if (!db || !Sharing.canEdit()) return;
        try {
            await db.collection(getCollectionPath('familyEvents')).doc(ev.id).set(JSON.parse(JSON.stringify(ev)));
        } catch (e) {
            console.error('saveEvent error:', e);
        }
    }

    async function deleteEvent(id) {
        if (!db || !Sharing.canDelete()) return;
        try {
            await db.collection(getCollectionPath('familyEvents')).doc(id).delete();
        } catch (e) {
            console.error('deleteEvent error:', e);
        }
    }

    return {
        init, getDb, updateStatus,
        listenToMembers, listenToEvents, stopListening,
        getMembers, saveMember, deleteMember, saveAllMembers,
        getEvents, saveEvent, deleteEvent,
        isReady: () => isConnected
    };
})();