const Auth = (() => {
    let cu = null;
    function init() {
        const ok = FirebaseDB.init();
        if (!ok) {
            console.error('Firebase init failed!');
            return;
        }
        // Initialize Sharing with db reference
        Sharing.init(FirebaseDB.getDb());
        firebase.auth().onAuthStateChanged(async u => {
            if (u) {
                cu = u;
                console.log('User logged in:', u.email);
                await onLogin(u);
            } else {
                cu = null;
                console.log('User logged out');
                onLogout();
            }
        });
        // Enter key on password field
        document.getElementById('loginPassword')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') login();
        });
    }
    async function onLogin(u) {
        try {
            // Hide login screen immediately
            document.getElementById('loginScreen').style.display = 'none';
            // Update user info in header
            const nameEl = document.getElementById('userName');
            const emailEl = document.getElementById('userEmail');
            const avatarEl = document.getElementById('userAvatar');
            if (nameEl) nameEl.textContent = u.displayName || u.email.split('@')[0];
            if (emailEl) emailEl.textContent = u.email;
            if (avatarEl) {
                if (u.photoURL) avatarEl.innerHTML = '<img src="' + u.photoURL + '">';
                else avatarEl.textContent = (u.displayName || u.email)[0].toUpperCase();
            }
            // Make sure Sharing has db reference
            if (!FirebaseDB.isReady()) {
                FirebaseDB.init();
            }
            Sharing.init(FirebaseDB.getDb());

            // Try to load existing tree
            console.log('Loading user tree...');
            const tree = await Sharing.loadUserTree(u.uid);
            if (tree) {
                console.log('Tree found:', tree.name);
                const r = Sharing.getRole();
                const ic = { owner: '👑', editor: '✏️', viewer: '👁️' };
                const tn = document.getElementById('currentTreeName');
                if (tn) tn.textContent = tree.name || '';
                const rb = document.getElementById('roleBadge');
                if (rb) rb.textContent = ic[r] || '';
                document.getElementById('treeSelectScreen').style.display = 'none';
                document.getElementById('appContainer').style.display = '';
                App.initAfterLogin();
            } else {
                console.log('No tree found - showing tree select');
                document.getElementById('appContainer').style.display = 'none';
                document.getElementById('treeSelectScreen').style.display = '';
                document.getElementById('treeSelectUserName').textContent = u.displayName || u.email.split('@')[0];
            }
        } catch (e) {
            console.error('onLogin error:', e);
            document.getElementById('appContainer').style.display = 'none';
            document.getElementById('treeSelectScreen').style.display = '';
            document.getElementById('treeSelectUserName').textContent = u.displayName || u.email.split('@')[0];
        }
    }
    function onLogout() {
        document.getElementById('loginScreen').style.display = '';
        document.getElementById('appContainer').style.display = 'none';
        document.getElementById('treeSelectScreen').style.display = 'none';
        FirebaseDB.stopListening();
        Sharing.stopListening();
    }

    // ============================================
    // תיקון בעיה 2: תיקון createNewTree
    // ============================================
    window.createNewTree = async function() {
        const u = firebase.auth().currentUser;
        if (!u) {
            console.error('No user logged in');
            alert('יש להתחבר קודם');
            return;
        }

        const nameInput = document.getElementById('newTreeName');
        const n = nameInput?.value?.trim() || 'העץ שלי';

        try {
            console.log('Creating new tree:', n);

            // ודא ש-Sharing מאותחל עם db
            if (!FirebaseDB.isReady()) {
                FirebaseDB.init();
            }
            Sharing.init(FirebaseDB.getDb());

            const userName = u.displayName || u.email.split('@')[0] || 'משתמש';
            const t = await Sharing.createTree(u.uid, userName);

            if (!t) {
                throw new Error('createTree returned null');
            }

            await Sharing.renameTree(n);

            // Switch screens
            document.getElementById('treeSelectScreen').style.display = 'none';
            document.getElementById('appContainer').style.display = '';

            // Update header
            const tn = document.getElementById('currentTreeName');
            if (tn) tn.textContent = n;
            const rb = document.getElementById('roleBadge');
            if (rb) rb.textContent = '👑';

            App.initAfterLogin();
            App.showToast('העץ נוצר בהצלחה! 🌳');

            // Show sharing modal after a short delay
            setTimeout(() => Sharing.openSharingModal(), 1500);
        } catch (e) {
            console.error('createNewTree error:', e);
            alert('שגיאה ביצירת עץ: ' + (e.message || 'שגיאה לא ידועה'));
        }
    };

    window.joinExistingTree = async function() {
        const u = firebase.auth().currentUser;
        if (!u) {
            console.error('No user logged in');
            alert('יש להתחבר קודם');
            return;
        }

        const code = document.getElementById('joinTreeCode')?.value?.trim();
        if (!code || code.length < 4) {
            alert('הכניסו קוד תקין');
            return;
        }

        try {
            console.log('Joining tree with code:', code);

            // ודא ש-Sharing מאותחל עם db
            if (!FirebaseDB.isReady()) {
                FirebaseDB.init();
            }
            Sharing.init(FirebaseDB.getDb());

            const userName = u.displayName || u.email.split('@')[0] || 'משתמש';
            const r = await Sharing.joinByCode(u.uid, code, userName);

            if (r) {
                document.getElementById('treeSelectScreen').style.display = 'none';
                document.getElementById('appContainer').style.display = '';
                const tn = document.getElementById('currentTreeName');
                if (tn) tn.textContent = r.name || '';
                App.initAfterLogin();
                App.showToast('הצטרפת בהצלחה! 🎉');
            } else {
                alert('קוד לא נמצא - בדקו שוב');
            }
        } catch (e) {
            console.error('joinExistingTree error:', e);
            alert('שגיאה בהצטרפות: ' + (e.message || 'שגיאה לא ידועה'));
        }
    };

    async function login() {
        const e = document.getElementById('loginEmail').value.trim();
        const p = document.getElementById('loginPassword').value;
        if (!e || !p) { sE('loginError', 'מלאו הכל'); return; }
        hE('loginError');
        sL(true);
        try {
            await firebase.auth().signInWithEmailAndPassword(e, p);
        } catch (er) {
            const m = {
                'auth/user-not-found': 'משתמש לא קיים',
                'auth/wrong-password': 'סיסמה שגויה',
                'auth/invalid-credential': 'פרטים שגויים',
                'auth/invalid-email': 'מייל לא תקין',
                'auth/too-many-requests': 'יותר מדי ניסיונות, נסו מאוחר יותר'
            };
            sE('loginError', m[er.code] || er.message);
            sL(false);
        }
    }
    async function loginWithGoogle() {
        hE('loginError');
        sL(true);
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            await firebase.auth().signInWithPopup(provider);
        } catch (e) {
            if (e.code !== 'auth/popup-closed-by-user') {
                sE('loginError', e.message);
            }
            sL(false);
        }
    }
    async function register() {
        const n = document.getElementById('registerName').value.trim();
        const e = document.getElementById('registerEmail').value.trim();
        const p = document.getElementById('registerPassword').value;
        const p2 = document.getElementById('registerPassword2').value;
        if (!n || !e || !p) { sE('registerError', 'מלאו הכל'); return; }
        if (p.length < 6) { sE('registerError', '6+ תווים'); return; }
        if (p !== p2) { sE('registerError', 'סיסמאות לא תואמות'); return; }
        hE('registerError');
        sL(true);
        try {
            const r = await firebase.auth().createUserWithEmailAndPassword(e, p);
            await r.user.updateProfile({ displayName: n });
        } catch (er) {
            const m = {
                'auth/email-already-in-use': 'המייל כבר קיים',
                'auth/weak-password': 'סיסמה חלשה',
                'auth/invalid-email': 'מייל לא תקין'
            };
            sE('registerError', m[er.code] || er.message);
            sL(false);
        }
    }
    async function forgotPassword() {
        const e = document.getElementById('loginEmail').value.trim();
        if (!e) { sE('loginError', 'הכניסו מייל'); return; }
        try {
            await firebase.auth().sendPasswordResetEmail(e);
            alert('📧 נשלח!');
        } catch (er) {
            sE('loginError', er.message);
        }
    }
    function logout() {
        if (confirm('להתנתק?')) firebase.auth().signOut();
    }
    function showLogin() {
        document.getElementById('loginForm').style.display = '';
        document.getElementById('registerForm').style.display = 'none';
        hE('loginError'); hE('registerError');
    }
    function showRegister() {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = '';
        hE('loginError'); hE('registerError');
    }
    function sE(id, m) {
        const el = document.getElementById(id);
        if (el) { el.textContent = '❌ ' + m; el.style.display = ''; }
    }
    function hE(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    }
    function sL(on) {
        document.querySelectorAll('.login-btn').forEach(b => on ? b.classList.add('loading') : b.classList.remove('loading'));
    }
    function toggleUserMenu() {
        const d = document.getElementById('userDropdown');
        d.classList.toggle('show');
        if (d.classList.contains('show')) {
            setTimeout(() => document.addEventListener('click', function c(e) {
                if (!document.getElementById('userMenu')?.contains(e.target)) {
                    d.classList.remove('show');
                    document.removeEventListener('click', c);
                }
            }), 10);
        }
    }
    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    return { login, loginWithGoogle, register, logout, forgotPassword, showLogin, showRegister, toggleUserMenu };
})();