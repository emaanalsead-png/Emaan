// ==============================================
// user-data-optimizer.js v2
// ==============================================
// ✅ v2 (تصحيح v1):
//   1. تجاهل null/undefined في _handleFieldChange
//   2. تجاهل التحديثات أثناء الانقطاع
//   3. لا كتابة إلى localStorage عند عدم وجود تغيير فعلي
// ✅ v1:
//   1. يستمع فقط لـ 14 حقل بدل النود كامل
//   2. يستبعد: musicURL, profileBgValue, cover, poetryBg, poetryAttachment
// ==============================================

(function () {
    'use strict';
    if (window.__userDataOptimizerV2) return;
    window.__userDataOptimizerV2 = true;

    /* ══════════════════════════════════════════════ */
    /* الحقول التي نحتاجها فقط لتحديث UI              */
    /* ══════════════════════════════════════════════ */
    const UI_FIELDS = [
        'name',
        'avatar',
        'avatarFrame',
        'nameColor',
        'nameGradient',
        'nameBgColor',
        'nameBgGradient',
        'cinemaTextStyle',
        'cinemaBgStyle',
        'profileGlow',
        'isBanned',
        'bannedUntil',
        'isJailed',
        'jailUntil'
    ];

    let _fieldState = {};
    let _lastFlushHash = '';
    let _debounceTimer = null;
    let _myListeners = [];
    let _active = false;

    function _handleFieldChange(field, value) {
        // ⭐ v2: تجاهل null/undefined (خاصة أثناء الانقطاع)
        if (value === null || value === undefined) return;

        // ⭐ v2: تجاهل أثناء الانقطاع (لا تُلوّث الحالة المؤقتة)
        if (window.__qamarOffline) {
            console.log('⏭️ user-data-optimizer: skip field update (offline):', field);
            return;
        }

        _fieldState[field] = value;
        clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(_flush, 150);
    }

    function _flush() {
        const u = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
        if (!u || !u.uid) return;

        try {
            // ⭐ v2: تحقق إن كان هناك تغيير فعلي
            var raw = localStorage.getItem(QAMAR.STORAGE_KEYS.CURRENT_USER)
                   || localStorage.getItem(QAMAR.STORAGE_KEYS.USER);
            const c = raw ? JSON.parse(raw) : {};
            const up = Object.assign({}, c, _fieldState);

            var newHash = JSON.stringify(_fieldState);
            if (newHash === _lastFlushHash) return;
            _lastFlushHash = newHash;

            if (typeof saveSession === 'function') {
                saveSession(up, up.isGuest === true);
            }

            // حدّث UI
            if (typeof window.refreshAvatarsInMessages === 'function') {
                window.refreshAvatarsInMessages(_fieldState.avatarFrame);
            }
            if (typeof window.refreshNameStylesInMessages === 'function') {
                window.refreshNameStylesInMessages(_fieldState);
            }
        } catch (e) {
            console.warn('user-data-optimizer flush failed:', e);
        }
    }

    function _stopOriginalListener() {
        try {
            if (window.ChatState && ChatState.listeners && ChatState.listeners.userDataRef) {
                ChatState.listeners.userDataRef.off();
                delete ChatState.listeners.userDataRef;
            }
        } catch (e) {}
    }

    function _stopMyListeners() {
        _myListeners.forEach(function (ref) {
            try { ref.off(); } catch (e) {}
        });
        _myListeners = [];
        _active = false;
    }

    function _startFieldListeners() {
        const u = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
        if (!u || !u.uid) {
            console.warn('⚠️ user-data-optimizer: no user yet');
            return false;
        }
        if (typeof db === 'undefined' || !db) {
            console.warn('⚠️ user-data-optimizer: db not ready');
            return false;
        }

        _stopOriginalListener();
        _stopMyListeners();

        const basePath = 'users/' + u.uid + '/';

        UI_FIELDS.forEach(function (field) {
            const ref = db.ref(basePath + field);
            ref.on('value', function (s) {
                _handleFieldChange(field, s.val());
            }, function (err) {
                console.warn('optimizer listener ' + field + ':', err.message);
            });
            _myListeners.push(ref);

            if (window.ChatState && ChatState.listeners) {
                ChatState.listeners['opt_' + field] = ref;
            }
        });

        _active = true;
        console.log('✅ user-data-optimizer: ' + UI_FIELDS.length + ' field listeners active');
        console.log('📊 يستبعد: musicURL, profileBgValue, cover, poetryBg, poetryAttachment');
        return true;
    }

    /* ══════════════════════════════════════════════ */
    /* Override startUserDataListener                 */
    /* ══════════════════════════════════════════════ */
    const _origStart = window.startUserDataListener;

    window.startUserDataListener = function () {
        if (_startFieldListeners()) return;

        console.warn('⚠️ optimizer: falling back to original (user/db not ready)');
        if (typeof _origStart === 'function') {
            try { _origStart(); } catch (e) {
                console.error('Original startUserDataListener failed:', e);
            }
        } else {
            setTimeout(function () {
                if (_startFieldListeners()) return;
                if (typeof _origStart === 'function') {
                    try { _origStart(); } catch (e) {}
                }
            }, 500);
        }
    };

    /* ══════════════════════════════════════════════ */
    /* Cleanup                                        */
    /* ══════════════════════════════════════════════ */
    const _origCleanup = window.cleanupAllListeners;
    window.cleanupAllListeners = function () {
        _stopMyListeners();
        _fieldState = {};
        _lastFlushHash = '';
        if (typeof _origCleanup === 'function') {
            try { _origCleanup(); } catch (e) {}
        }
    };

    /* ══════════════════════════════════════════════ */
    /* Init                                           */
    /* ══════════════════════════════════════════════ */
    function init() {
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            if (typeof getCurrentUser === 'function' &&
                getCurrentUser() &&
                typeof db !== 'undefined' && db) {
                clearInterval(t);
                console.log('✅ user-data-optimizer.js v2 ready');
            }
            if (attempts >= 40) clearInterval(t);
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('📦 user-data-optimizer.js v2 loaded — null-safe + offline-aware');
})();
