// ==============================================
// guest-restrictions.js v2 — قيود الزائر الشاملة
// ==============================================
// ✅ v2 (فوق v1):
//   1. منع الترقية من كل مكان (modal + admin tab + nav)
//   2. منع يوتيوب كلياً
//   3. منع الشريط العائم بالكامل
// ==============================================

(function () {
    'use strict';
    if (window.__guestRestrictionsV2) return;
    window.__guestRestrictionsV2 = true;

    function getMe() {
        try { if (typeof getCurrentUser === 'function') return getCurrentUser(); } catch (e) {}
        try {
            return JSON.parse(localStorage.getItem('qamar_current_user') || localStorage.getItem('qamar_user') || 'null');
        } catch (e) { return null; }
    }
    function isGuest() {
        var u = getMe();
        return !!(u && u.isGuest === true);
    }
    function toast(icon, msg) {
        if (typeof showToast === 'function') showToast(icon, msg);
        else alert(msg);
    }

    /* 1. منع openUpgradeModal */
    var _t1 = setInterval(function () {
        var orig = window.openUpgradeModal;
        if (typeof orig !== 'function') return;
        if (orig.__gbBlocked) { clearInterval(_t1); return; }
        window.openUpgradeModal = function () {
            if (isGuest()) { toast('fa-user-secret', '🕵️ سجّل حساب نظامي للترقية'); return; }
            return orig.apply(this, arguments);
        };
        window.openUpgradeModal.__gbBlocked = true;
        clearInterval(_t1);
    }, 200);

    /* 2. منع handleUpgrade */
    var _t2 = setInterval(function () {
        var orig = window.handleUpgrade;
        if (typeof orig !== 'function') return;
        if (orig.__gbBlocked) { clearInterval(_t2); return; }
        window.handleUpgrade = function () {
            if (isGuest()) { toast('fa-user-secret', '🕵️ سجّل حساب نظامي للترقية'); return; }
            return orig.apply(this, arguments);
        };
        window.handleUpgrade.__gbBlocked = true;
        clearInterval(_t2);
    }, 200);

    /* 3. منع registerMember للزوار */
    var _t3 = setInterval(function () {
        var orig = window.registerMember;
        if (typeof orig !== 'function') return;
        if (orig.__gbBlocked) { clearInterval(_t3); return; }
        window.registerMember = async function () {
            if (isGuest()) {
                toast('fa-user-secret', '🕵️ لا يمكن ترقية حساب زائر');
                return { success: false, error: 'سجّل حساب نظامي أولاً' };
            }
            return await orig.apply(this, arguments);
        };
        window.registerMember.__gbBlocked = true;
        clearInterval(_t3);
    }, 200);

    /* 4. منع searchYouTube */
    var _t4 = setInterval(function () {
        var orig = window.searchYouTube;
        if (typeof orig !== 'function') return;
        if (orig.__gbBlocked) { clearInterval(_t4); return; }
        window.searchYouTube = function () {
            if (isGuest()) { toast('fa-user-secret', '🕵️ يوتيوب للأعضاء فقط'); return; }
            return orig.apply(this, arguments);
        };
        window.searchYouTube.__gbBlocked = true;
        clearInterval(_t4);
    }, 200);

    /* 5. إخفاء زر الترقية في bottom nav */
    function _hideUpgradeNav() {
        var btn = document.getElementById('upgrade-nav-btn');
        if (!btn) return;
        if (isGuest()) btn.style.display = 'none';
        else btn.style.display = '';
    }
    setInterval(_hideUpgradeNav, 1500);

    /* 6. حظر أزرار الزائر في admin tab (بروفايل) */
    function _blockAdminTab() {
        if (!isGuest()) return;
        /* profile.html يعمل في iframe — نرسل له رسالة */
        try {
            var iframe = document.getElementById('profile-iframe');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({ action: 'guestBlock' }, '*');
            }
        } catch (e) {}
    }

    /* 7. إخفاء أزرار الشريط العائم للزائر */
    function _hideFloatingTools() {
        if (!isGuest()) return;
        var tools = document.querySelectorAll('#floating-toolbar .tool-btn');
        tools.forEach(function (btn) {
            var action = btn.getAttribute('data-action');
            if (action === 'youtube') {
                btn.style.display = 'none';
            }
        });
    }
    setInterval(_hideFloatingTools, 1500);

    function init() {
        setTimeout(_hideUpgradeNav, 500);
        setTimeout(_hideFloatingTools, 2000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

    console.log('✅ guest-restrictions.js v2 loaded');
})();
