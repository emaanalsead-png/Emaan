// ==============================================
// guest-upgrade-block.js v1 — منع ترقية الزائر
// ==============================================
// ✅ v1:
//   1. منع فتح modal الترقية للزوار
//   2. منع registerMember من داخل session الزائر
//   3. إخفاء زر "عضوية" في bottom nav للزوار
//   4. رسالة واضحة للزائر
// ==============================================

(function () {
    'use strict';
    if (window.__guestUpgradeBlockV1) return;
    window.__guestUpgradeBlockV1 = true;

    function getMe() {
        try { if (typeof getCurrentUser === 'function') return getCurrentUser(); } catch (e) {}
        try {
            return JSON.parse(localStorage.getItem('qamar_current_user') || localStorage.getItem('qamar_user') || 'null');
        } catch (e) { return null; }
    }

    function isGuestNow() {
        var u = getMe();
        return !!(u && u.isGuest === true);
    }

    function toast(icon, msg) {
        if (typeof showToast === 'function') showToast(icon, msg);
        else alert(msg);
    }

    /* 1. Override openUpgradeModal */
    function _wrapOpenUpgrade() {
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            var orig = window.openUpgradeModal;
            if (typeof orig !== 'function') {
                if (attempts >= 40) clearInterval(t);
                return;
            }
            if (orig.__guestBlocked) { clearInterval(t); return; }

            window.openUpgradeModal = function () {
                if (isGuestNow()) {
                    toast('fa-user-secret', '🕵️ هذه الميزة للأعضاء فقط. سجّل حساباً نظامياً أولاً.');
                    return;
                }
                return orig.apply(this, arguments);
            };
            window.openUpgradeModal.__guestBlocked = true;
            clearInterval(t);
            console.log('✅ guest-upgrade-block: openUpgradeModal wrapped');
        }, 200);
    }

    /* 2. Override handleUpgrade */
    function _wrapHandleUpgrade() {
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            var orig = window.handleUpgrade;
            if (typeof orig !== 'function') {
                if (attempts >= 40) clearInterval(t);
                return;
            }
            if (orig.__guestBlocked) { clearInterval(t); return; }

            window.handleUpgrade = function (btn) {
                if (isGuestNow()) {
                    toast('fa-user-secret', '🕵️ سجّل حساب نظامي للترقية');
                    return;
                }
                return orig.apply(this, arguments);
            };
            window.handleUpgrade.__guestBlocked = true;
            clearInterval(t);
            console.log('✅ guest-upgrade-block: handleUpgrade wrapped');
        }, 200);
    }

    /* 3. Override registerMember */
    function _wrapRegisterMember() {
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            var orig = window.registerMember;
            if (typeof orig !== 'function') {
                if (attempts >= 40) clearInterval(t);
                return;
            }
            if (orig.__guestBlocked) { clearInterval(t); return; }

            window.registerMember = async function (name, age, gender, email, password) {
                /* لو الزائر يحاول الترقية من داخل جلسته */
                if (isGuestNow()) {
                    toast('fa-user-secret', '🕵️ لا يمكن ترقية حساب زائر. اخرج وسجّل حساباً جديداً.');
                    return { success: false, error: 'سجّل حساب نظامي أولاً' };
                }
                return await orig.apply(this, arguments);
            };
            window.registerMember.__guestBlocked = true;
            clearInterval(t);
            console.log('✅ guest-upgrade-block: registerMember wrapped');
        }, 200);
    }

    /* 4. إخفاء زر الترقية في bottom nav */
    function _hideUpgradeButton() {
        var btn = document.getElementById('upgrade-nav-btn');
        if (!btn) return false;
        if (isGuestNow()) {
            btn.style.display = 'none';
        } else {
            btn.style.display = '';
        }
        return true;
    }

    var hideTries = 0;
    var hideInterval = setInterval(function () {
        hideTries++;
        var u = getMe();
        if (u) {
            _hideUpgradeButton();
        }
        if (hideTries >= 20) clearInterval(hideInterval);
    }, 500);

    /* 5. إخفاء الزر عند أي تغيير في DOM */
    setInterval(function () {
        var btn = document.getElementById('upgrade-nav-btn');
        if (!btn) return;
        if (isGuestNow() && btn.style.display !== 'none') {
            btn.style.display = 'none';
        } else if (!isGuestNow() && btn.style.display === 'none') {
            btn.style.display = '';
        }
    }, 2000);

    /* Init */
    function init() {
        _wrapOpenUpgrade();
        _wrapHandleUpgrade();
        _wrapRegisterMember();
        setTimeout(_hideUpgradeButton, 500);
        setTimeout(_hideUpgradeButton, 2000);
        setTimeout(_hideUpgradeButton, 4000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

    console.log('✅ guest-upgrade-block.js v1 loaded');
})();
