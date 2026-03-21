const Auth = (() => {
  let cu = null;
  let resendCooldown = false;

  function init() {
    const ok = FirebaseDB.init();
    if (!ok) {
      console.error("Firebase init failed!");
      return;
    }
    Sharing.init(FirebaseDB.getDb());

    firebase.auth().onAuthStateChanged(async (u) => {
      if (u) {
        cu = u;
        console.log("User logged in:", u.email, "verified:", u.emailVerified);

        // Google users are always verified
        var isGoogleUser = u.providerData.some(function (p) {
          return p.providerId === "google.com";
        });

        if (!u.emailVerified && !isGoogleUser) {
          // Show verification screen
          showVerifyScreen(u);
        } else {
          // Verified - proceed to app
          await onLogin(u);
        }
      } else {
        cu = null;
        console.log("User logged out");
        onLogout();
      }
    });

    document
      .getElementById("loginPassword")
      ?.addEventListener("keydown", function (e) {
        if (e.key === "Enter") login();
      });

    document
      .getElementById("registerPassword2")
      ?.addEventListener("keydown", function (e) {
        if (e.key === "Enter") register();
      });
  }

  function showVerifyScreen(u) {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("treeSelectScreen").style.display = "none";
    document.getElementById("appContainer").style.display = "none";
    document.getElementById("verifyScreen").style.display = "";

    var text = document.getElementById("verifyEmailText");
    if (text) {
      text.innerHTML =
        'שלחנו מייל אימות ל-<strong dir="ltr">' +
        u.email +
        "</strong><br>בדקו את תיבת הדואר ולחצו על הקישור.";
    }
  }

  async function resendVerification() {
    if (resendCooldown) return;

    var u = firebase.auth().currentUser;
    if (!u) return;

    try {
      await u.sendEmailVerification({
        url: window.location.origin + window.location.pathname,
      });

      // Start cooldown (60 seconds)
      resendCooldown = true;
      var btn = document.getElementById("resendBtn");
      var seconds = 60;

      btn.disabled = true;
      btn.innerHTML =
        '<span class="resend-timer">' + seconds + "</span> ⏳ נשלח! המתינו";

      var interval = setInterval(function () {
        seconds--;
        if (seconds <= 0) {
          clearInterval(interval);
          resendCooldown = false;
          btn.disabled = false;
          btn.innerHTML = "📤 שלח שוב";
        } else {
          btn.innerHTML =
            '<span class="resend-timer">' + seconds + "</span> ⏳ המתינו";
        }
      }, 1000);

      hE("verifyError");
    } catch (err) {
      console.error("Resend verification error:", err);
      if (err.code === "auth/too-many-requests") {
        sE("verifyError", "יותר מדי ניסיונות. נסו מאוחר יותר");
      } else {
        sE("verifyError", err.message);
      }
    }
  }

  async function checkVerification() {
    var u = firebase.auth().currentUser;
    if (!u) return;

    try {
      // Reload user to get fresh emailVerified status
      await u.reload();
      u = firebase.auth().currentUser;

      if (u.emailVerified) {
        document.getElementById("verifyScreen").style.display = "none";
        hE("verifyError");
        await onLogin(u);
      } else {
        sE("verifyError", "המייל עדיין לא אומת. לחצו על הקישור במייל ונסו שוב");
      }
    } catch (err) {
      console.error("Check verification error:", err);
      sE("verifyError", "שגיאה בבדיקה: " + err.message);
    }
  }

  async function onLogin(u) {
    try {
      document.getElementById("loginScreen").style.display = "none";
      document.getElementById("verifyScreen").style.display = "none";

      var nameEl = document.getElementById("userName");
      var emailEl = document.getElementById("userEmail");
      var avatarEl = document.getElementById("userAvatar");

      if (nameEl) nameEl.textContent = u.displayName || u.email.split("@")[0];
      if (emailEl) emailEl.textContent = u.email;
      if (avatarEl) {
        if (u.photoURL) avatarEl.innerHTML = '<img src="' + u.photoURL + '">';
        else avatarEl.textContent = (u.displayName || u.email)[0].toUpperCase();
      }

      if (!FirebaseDB.isReady()) {
        FirebaseDB.init();
      }
      Sharing.init(FirebaseDB.getDb());

      console.log("Loading user tree...");
      var tree = await Sharing.loadUserTree(u.uid);

      if (tree) {
        console.log("Tree found:", tree.name);
        var r = Sharing.getRole();
        var ic = { owner: "👑", editor: "✏️", viewer: "👁️" };
        var tn = document.getElementById("currentTreeName");
        if (tn) tn.textContent = tree.name || "";
        var rb = document.getElementById("roleBadge");
        if (rb) rb.textContent = ic[r] || "";
        document.getElementById("treeSelectScreen").style.display = "none";
        document.getElementById("appContainer").style.display = "";
        App.initAfterLogin();
      } else {
        console.log("No tree found - showing tree select");
        document.getElementById("appContainer").style.display = "none";
        document.getElementById("treeSelectScreen").style.display = "";
        document.getElementById("treeSelectUserName").textContent =
          u.displayName || u.email.split("@")[0];
      }
    } catch (e) {
      console.error("onLogin error:", e);
      document.getElementById("appContainer").style.display = "none";
      document.getElementById("treeSelectScreen").style.display = "";
      document.getElementById("treeSelectUserName").textContent =
        u.displayName || u.email.split("@")[0];
    }
  }

  function onLogout() {
    document.getElementById("loginScreen").style.display = "";
    document.getElementById("appContainer").style.display = "none";
    document.getElementById("treeSelectScreen").style.display = "none";
    document.getElementById("verifyScreen").style.display = "none";
    FirebaseDB.stopListening();
    Sharing.stopListening();
  }

  window.createNewTree = async function () {
    var u = firebase.auth().currentUser;
    if (!u) {
      console.error("No user logged in");
      alert("יש להתחבר קודם");
      return;
    }
    var nameInput = document.getElementById("newTreeName");
    var n = nameInput?.value?.trim() || "העץ שלי";
    try {
      console.log("Creating new tree:", n);
      if (!FirebaseDB.isReady()) {
        FirebaseDB.init();
      }
      Sharing.init(FirebaseDB.getDb());
      var userName = u.displayName || u.email.split("@")[0] || "משתמש";
      var t = await Sharing.createTree(u.uid, userName);
      if (!t) {
        throw new Error("createTree returned null");
      }
      await Sharing.renameTree(n);
      // Update user profile with new tree
      await FirebaseDB.getDb()
        .collection("userProfiles")
        .doc(u.uid)
        .set(
          {
            currentTreeId: Sharing.getTreeId(),
            trees: firebase.firestore.FieldValue.arrayUnion({
              treeId: Sharing.getTreeId(),
              name: n,
              role: "owner",
            }),
          },
          { merge: true }
        );
      document.getElementById("treeSelectScreen").style.display = "none";
      document.getElementById("appContainer").style.display = "";
      var tn = document.getElementById("currentTreeName");
      if (tn) tn.textContent = n;
      var rb = document.getElementById("roleBadge");
      if (rb) rb.textContent = "👑";
      App.initAfterLogin();
      App.showToast("העץ נוצר בהצלחה! 🌳");
      setTimeout(function () {
        Sharing.openSharingModal();
      }, 1500);
    } catch (e) {
      console.error("createNewTree error:", e);
      alert("שגיאה ביצירת עץ: " + (e.message || "שגיאה לא ידועה"));
    }
  };

  window.joinExistingTree = async function () {
    var u = firebase.auth().currentUser;
    if (!u) {
      console.error("No user logged in");
      alert("יש להתחבר קודם");
      return;
    }
    var code = document.getElementById("joinTreeCode")?.value?.trim();
    if (!code || code.length < 4) {
      alert("הכניסו קוד תקין");
      return;
    }
    try {
      console.log("Joining tree with code:", code);
      if (!FirebaseDB.isReady()) {
        FirebaseDB.init();
      }
      Sharing.init(FirebaseDB.getDb());
      var userName = u.displayName || u.email.split("@")[0] || "משתמש";
      var r = await Sharing.joinByCode(u.uid, code, userName);
      if (r) {
        document.getElementById("treeSelectScreen").style.display = "none";
        document.getElementById("appContainer").style.display = "";
        var tn = document.getElementById("currentTreeName");
        if (tn) tn.textContent = r.name || "";
        App.initAfterLogin();
        App.showToast("הצטרפת בהצלחה! 🎉");
      } else {
        alert("קוד לא נמצא - בדקו שוב");
      }
    } catch (e) {
      console.error("joinExistingTree error:", e);
      alert("שגיאה בהצטרפות: " + (e.message || "שגיאה לא ידועה"));
    }
  };

  async function login() {
    var e = document.getElementById("loginEmail").value.trim();
    var p = document.getElementById("loginPassword").value;
    if (!e || !p) {
      sE("loginError", "מלאו הכל");
      return;
    }
    hE("loginError");
    sL(true);
    try {
      var result = await firebase.auth().signInWithEmailAndPassword(e, p);

      // Check if email is verified (skip for Google users)
      var isGoogleUser = result.user.providerData.some(function (p) {
        return p.providerId === "google.com";
      });

      if (!result.user.emailVerified && !isGoogleUser) {
        sL(false);
        // onAuthStateChanged will handle showing verify screen
      }
    } catch (er) {
      var m = {
        "auth/user-not-found": "משתמש לא קיים",
        "auth/wrong-password": "סיסמה שגויה",
        "auth/invalid-credential": "פרטים שגויים",
        "auth/invalid-email": "מייל לא תקין",
        "auth/too-many-requests": "יותר מדי ניסיונות, נסו מאוחר יותר",
      };
      sE("loginError", m[er.code] || er.message);
      sL(false);
    }
  }

  async function loginWithGoogle() {
    hE("loginError");
    sL(true);
    try {
      var provider = new firebase.auth.GoogleAuthProvider();
      await firebase.auth().signInWithPopup(provider);
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user") {
        sE("loginError", e.message);
      }
      sL(false);
    }
  }

  async function register() {
    var n = document.getElementById("registerName").value.trim();
    var e = document.getElementById("registerEmail").value.trim();
    var p = document.getElementById("registerPassword").value;
    var p2 = document.getElementById("registerPassword2").value;
    if (!n || !e || !p) {
      sE("registerError", "מלאו הכל");
      return;
    }
    if (p.length < 6) {
      sE("registerError", "6+ תווים");
      return;
    }
    if (p !== p2) {
      sE("registerError", "סיסמאות לא תואמות");
      return;
    }
    hE("registerError");
    sL(true);
    try {
      var r = await firebase.auth().createUserWithEmailAndPassword(e, p);
      await r.user.updateProfile({ displayName: n });

      // Send verification email
      await r.user.sendEmailVerification({
        url: window.location.origin + window.location.pathname,
      });

      console.log("Verification email sent to:", e);
      sL(false);
      // onAuthStateChanged will handle showing verify screen
    } catch (er) {
      var m = {
        "auth/email-already-in-use": "המייל כבר קיים",
        "auth/weak-password": "סיסמה חלשה",
        "auth/invalid-email": "מייל לא תקין",
      };
      sE("registerError", m[er.code] || er.message);
      sL(false);
    }
  }

  async function forgotPassword() {
    var e = document.getElementById("loginEmail").value.trim();
    if (!e) {
      sE("loginError", "הכניסו מייל");
      return;
    }
    try {
      await firebase.auth().sendPasswordResetEmail(e);
      alert("📧 נשלח!");
    } catch (er) {
      sE("loginError", er.message);
    }
  }

  function logout() {
    if (confirm("להתנתק?")) firebase.auth().signOut();
  }

  function showLogin() {
    document.getElementById("loginForm").style.display = "";
    document.getElementById("registerForm").style.display = "none";
    hE("loginError");
    hE("registerError");
  }

  function showRegister() {
    document.getElementById("loginForm").style.display = "none";
    document.getElementById("registerForm").style.display = "";
    hE("loginError");
    hE("registerError");
  }

  function sE(id, m) {
    var el = document.getElementById(id);
    if (el) {
      el.textContent = "❌ " + m;
      el.style.display = "";
    }
  }

  function hE(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = "none";
  }

  function sL(on) {
    document.querySelectorAll(".login-btn").forEach(function (b) {
      on ? b.classList.add("loading") : b.classList.remove("loading");
    });
  }

  function toggleUserMenu() {
    var d = document.getElementById("userDropdown");
    d.classList.toggle("show");
    if (d.classList.contains("show")) {
      setTimeout(function () {
        document.addEventListener("click", function c(e) {
          if (!document.getElementById("userMenu")?.contains(e.target)) {
            d.classList.remove("show");
            document.removeEventListener("click", c);
          }
        });
      }, 10);
    }
  }

  // Auto-init
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {
    login: login,
    loginWithGoogle: loginWithGoogle,
    register: register,
    logout: logout,
    forgotPassword: forgotPassword,
    showLogin: showLogin,
    showRegister: showRegister,
    toggleUserMenu: toggleUserMenu,
    resendVerification: resendVerification,
    checkVerification: checkVerification,
  };
})();
