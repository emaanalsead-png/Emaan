// ==============================================
// firebase-persistence.js v2
// ==============================================
// ✅ v2 (تصحيح):
//   1. keepSynced فقط على 3 nodes حرجة (بدل 9)
//   2. لا نزامن bot_memory (polling يعمل)
//   3. persistence مفعّل ضمنياً
// ==============================================

(function () {
    'use strict';
    if (window.__firebasePersistenceV2) return;
    window.__firebasePersistenceV2 = true;

    function _init() {
        if (typeof db === 'undefined' || !db) {
            setTimeout(_init, 300);
            return;
        }

        // ⭐ keepSynced فقط على 3 nodes (بدل 9)
        // هذه البيانات تُقرأ كثيراً وتتغير قليلاً
        var CRITICAL_PATHS = [
            'config',
            'room_settings'
        ];

        CRITICAL_PATHS.forEach(function (p) {
            try { db.ref(p).keepSynced(true); } catch (e) {}
        });

        console.log('💾 keepSynced: ' + CRITICAL_PATHS.length + ' critical paths only');

        // ⭐ users/$uid (بعد جاهزية المستخدم)
        var attempts = 0;
        var _t = setInterval(function () {
            attempts++;
            var u = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
            if (u && u.uid) {
                clearInterval(_t);
                try { db.ref('users/' + u.uid).keepSynced(true); } catch (e) {}
                console.log('💾 keepSynced: users/' + u.uid.substring(0, 8) + '...');
            }
            if (attempts >= 30) clearInterval(_t);
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }

    console.log('✅ firebase-persistence.js v2 loaded — minimal keepSynced');
})();
