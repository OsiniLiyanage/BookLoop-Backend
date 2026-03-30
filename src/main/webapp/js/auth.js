// ═══════════════════════════════════════════════════════
// auth.js — Firebase Authentication
// FIX: onAuthStateChanged now unsubscribes after first call
//      so it never fires again and causes the reload loop.
// ═══════════════════════════════════════════════════════

// ── LOGIN (called from login.html) ──────────────────────────────────

async function doLogin() {
    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errBox   = document.getElementById('loginError');
    const btn      = document.getElementById('loginBtn');

    errBox.style.display = 'none';

    if (!email || !password) {
        showLoginError('Please enter your email and password.');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Signing in...`;

    try {
        await fbAuth.signInWithEmailAndPassword(email, password);
        // Success — redirect to dashboard
        window.location.href = 'dashboard.html';

    } catch (error) {
        btn.disabled = false;
        btn.innerHTML = `<i class="bi bi-box-arrow-in-right"></i> Sign In`;

        let msg = 'Sign in failed. Please try again.';
        if (error.code === 'auth/invalid-email')         msg = 'Invalid email address.';
        if (error.code === 'auth/user-not-found')        msg = 'No admin account with this email.';
        if (error.code === 'auth/wrong-password')        msg = 'Incorrect password.';
        if (error.code === 'auth/too-many-requests')     msg = 'Too many attempts. Try again later.';
        if (error.code === 'auth/invalid-credential')    msg = 'Incorrect email or password.';
        if (error.code === 'auth/network-request-failed')msg = 'Network error. Check your connection.';

        showLoginError(msg);
    }
}

function showLoginError(msg) {
    const errBox = document.getElementById('loginError');
    if (errBox) { errBox.textContent = msg; errBox.style.display = 'block'; }
}

function togglePassword() {
    const input = document.getElementById('loginPassword');
    const icon  = document.getElementById('pwToggleIcon');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'bi bi-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'bi bi-eye';
    }
}

// On login page: redirect to dashboard if already signed in
if (document.getElementById('loginBtn')) {
    // We're on login.html
    const unsub = fbAuth.onAuthStateChanged(user => {
        unsub(); // IMPORTANT: unsubscribe immediately — only check once
        if (user) window.location.href = 'dashboard.html';
    });

    // Keyboard support
    document.addEventListener('DOMContentLoaded', () => {
        ['loginEmail','loginPassword'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
        });
    });
}


// ── SIGN OUT (called from dashboard.html) ───────────────────────────

async function doSignOut() {
    if (!confirm('Sign out of BookLoop Admin?')) return;
    await fbAuth.signOut();
    window.location.href = 'login.html';
}


// ── AUTH GUARD (called once from dashboard.html) ─────────────────────
// FIX: Calls unsubscribe() immediately so onAuthStateChanged only
//      fires ONCE. Previously it kept firing every token refresh,
//      causing loadDashboard() to run repeatedly (the "reload" bug).

function requireAuth(onUserReady) {
    const unsubscribe = fbAuth.onAuthStateChanged(user => {
        unsubscribe(); // Stop listening — we only need the first result
        if (!user) {
            // Not signed in → back to login
            window.location.href = 'login.html';
        } else {
            // Signed in → give the user object to the caller
            onUserReady(user);
        }
    });
}