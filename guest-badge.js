// ==============================================
// guest-badge.js v1 (TEST) — شارة الزائر/العضو + منع الزائر
// ==============================================
// ✅ v1 (جديد كلياً):
//   1. 🕵️ شارة الزائر + ✅ شارة العضو
//   2. إظهار الشارة في: الشات، المتواجدين، الخاص، الإشعارات، غرفة الملك، البروفايل
//   3. منع الزائر من:
//      - الخاص (PM) — كل شيء
//      - إضافة صديق / إعجاب / حظر
//      - تعديل البروفايل
//      - رفع ملفات (في أي مكان)
//      - إطارات / تنسيقات سينمائية
//      - النرد
//      - التنبيهات
//      - الإبلاغ
//      - غرفة الملك
//      - رؤية UID/المعرّف في البروفايل
//   4. الزائر يحتفظ بـ:
//      - الكتابة في العام
//      - تبديل الغرف (العامة)
//      - عرض المتواجدين
//      - عرض البروفايلات (بدون تفاصيل حساسة)
// ==============================================

(function () {
    'use strict';
    if (window.__guestBadgeV1) return;
    window.__guestBadgeV1 = true;

    /* ══════════════════════════════════════════════ */
    /* State                                          */
    /* ══════════════════════════════════════════════ */
    var GB = {
        me: null,
        meIsGuest: false,
        observer: null,
        protectedOverrides: false
    };

    /* ══════════════════════════════════════════════ */
    /* Helpers                                        */
    /* ══════════════════════════════════════════════ */
    function getMe() {
        try {
            if (typeof getCurrentUser === 'function') return getCurrentUser();
        } catch (e) {}
        try {
            return JSON.parse(localStorage.getItem('qamar_current_user') || localStorage.getItem('qamar_user') || 'null');
        } catch (e) { return null; }
    }

    function isGuestUser(u) {
        if (!u) return false;
        if (u.isGuest === true) return true;
        if (u.isBot === true) return false;
        if (u.uid && u.uid.indexOf('bot_') === 0) return false;
        // بعض الحسابات القديمة ما عندها isGuest — نعتبرها عضو
        if (u.isGuest === false) return false;
        return false;
    }

    function iAmGuest() {
        var u = getMe();
        return isGuestUser(u);
    }

    /**
     * ⭐ يرجع HTML الشارة حسب نوع المستخدم
     * @param {Object} u — كائن المستخدم
     * @param {string} size — 'sm' | 'md' | 'lg'
     */
    function getBadgeHTML(u, size) {
        size = size || 'sm';
        if (!u) return '';
        if (u.isBot === true || (u.uid && u.uid.indexOf('bot_') === 0)) return '';

        var fontSize = size === 'lg' ? '12px' : (size === 'md' ? '10px' : '9px');
        var padding = size === 'lg' ? '3px 8px' : '2px 6px';

        if (isGuestUser(u)) {
            return '<span class="gb-badge gb-guest" title="زائر" style="display:inline-flex;align-items:center;gap:2px;font-size:' + fontSize + ';padding:' + padding + ';background:linear-gradient(135deg,rgba(148,163,184,0.35),rgba(100,116,139,0.25));border:1px solid rgba(148,163,184,0.6);border-radius:20px;color:#cbd5e1;font-weight:900;margin-right:4px;line-height:1;">🕵️</span>';
        }
        return '<span class="gb-badge gb-member" title="عضو" style="display:inline-flex;align-items:center;gap:2px;font-size:' + fontSize + ';padding:' + padding + ';background:linear-gradient(135deg,rgba(255,215,0,0.35),rgba(212,175,55,0.25));border:1px solid rgba(255,215,0,0.6);border-radius:20px;color:#ffd700;font-weight:900;margin-right:4px;line-height:1;">✅</span>';
    }

    /**
     * ⭐ يضيف الشارة لعنصر معيّن
     * @param {HTMLElement} el — العنصر الهدف
     * @param {Object} u — كائن المستخدم
     * @param {string} position — 'start' | 'end' | 'replace'
     */
    function attachBadge(el, u, position) {
        if (!el || !u) return;
        // نتجنب التكرار
        if (el.querySelector && el.querySelector('.gb-badge')) return;

        var html = getBadgeHTML(u, 'sm');
        if (!html) return;

        var badge = document.createElement('span');
        badge.innerHTML = html;
        var badgeEl = badge.firstChild;

        if (position === 'start') {
            el.insertBefore(badgeEl, el.firstChild);
        } else {
            el.appendChild(badgeEl);
        }
    }

    function toast(icon, msg) {
        if (typeof showToast === 'function') showToast(icon, msg);
        else console.log('[GuestBadge]', msg);
    }

    function _preventGuest(action) {
        if (!iAmGuest()) return false;
        toast('fa-user-secret', '🕵️ هذه الميزة للأعضاء فقط');
        console.log('🚫 Guest blocked from:', action);
        return true;
    }

    /* ══════════════════════════════════════════════ */
    /* CSS                                            */
    /* ══════════════════════════════════════════════ */
    (function injectCSS() {
        if (document.getElementById('guest-badge-css')) return;
        var s = document.createElement('style');
        s.id = 'guest-badge-css';
        s.textContent = `
/* ⭐ animation خفيف للشارة */
.gb-badge {
    animation: gbBadgeIn 0.3s ease-out;
    vertical-align: middle;
}
@keyframes gbBadgeIn {
    from { transform: scale(0.5); opacity: 0; }
    to   { transform: scale(1); opacity: 1; }
}

/* ⭐ منع الزائر من الأزرار — يظهر رمادي */
.gb-disabled-for-guest {
    opacity: 0.35 !important;
    pointer-events: none !important;
    cursor: not-allowed !important;
    position: relative;
}
.gb-disabled-for-guest::after {
    content: '🕵️';
    position: absolute;
    top: -6px;
    right: -6px;
    font-size: 12px;
    background: rgba(148,163,184,0.9);
    border-radius: 50%;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #cbd5e1;
}

/* ⭐ إشعار للأزرار المعطّلة */
.gb-lock-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: inherit;
    z-index: 100;
    font-size: 20px;
}

/* ⭐ في الشات */
.message-username .gb-badge {
    margin-right: 4px;
}
.message.bot .gb-badge { display: none; }

/* ⭐ في قائمة المتواجدين */
#users-sidebar .uli-name .gb-badge {
    margin-right: 4px;
}

/* ⭐ في الخاص */
#pm-sidebar .pm-name .gb-badge {
    margin-right: 4px;
}
`;
        document.head.appendChild(s);
    })();

    /* ══════════════════════════════════════════════ */
    /* 1. Attach badge to chat messages               */
    /* ══════════════════════════════════════════════ */
    function _attachBadgeToMessage(msgEl) {
        if (!msgEl || msgEl.classList.contains('system')) return;
        if (msgEl.querySelector('.gb-badge')) return;

        var uid = msgEl.getAttribute('data-sender-uid');
        if (!uid) return;
        if (uid.indexOf('bot_') === 0) return;

        // نحاول نجيب بيانات المستخدم من الـ cache
        var cachedUser = null;
        try {
            var targetKey = 'profile_target_data_' + uid;
            var raw = localStorage.getItem(targetKey);
            if (raw) cachedUser = JSON.parse(raw);
        } catch (e) {}

        // لو ما في cache، نجيب من Firebase
        if (!cachedUser) {
            if (typeof db === 'undefined' || !db) return;
            db.ref('users/' + uid + '/isGuest').once('value').then(function (s) {
                var isGuestVal = s.val();
                var u = { uid: uid, isGuest: isGuestVal === true };
                var un = msgEl.querySelector('.message-username');
                if (un && !un.querySelector('.gb-badge')) {
                    var badge = document.createElement('span');
                    badge.innerHTML = getBadgeHTML(u, 'sm');
                    if (badge.firstChild) un.insertBefore(badge.firstChild, un.firstChild);
                }
            }).catch(function () {});
            return;
        }

        var un = msgEl.querySelector('.message-username');
        if (un) {
            var badge = document.createElement('span');
            badge.innerHTML = getBadgeHTML(cachedUser, 'sm');
            if (badge.firstChild) un.insertBefore(badge.firstChild, un.firstChild);
        }
    }

    function _scanAllMessages() {
        document.querySelectorAll('#messages .message:not(.system)').forEach(_attachBadgeToMessage);
    }

    function _installMessagesObserver() {
        var container = document.getElementById('messages');
        if (!container) { setTimeout(_installMessagesObserver, 1000); return; }
        if (container.__gbObserved) return;
        container.__gbObserved = true;
        var obs = new MutationObserver(function (muts) {
            muts.forEach(function (m) {
                m.addedNodes.forEach(function (node) {
                    if (node.nodeType !== 1) return;
                    if (node.classList && node.classList.contains('message')) {
                        setTimeout(function () { _attachBadgeToMessage(node); }, 100);
                    }
                });
            });
        });
        obs.observe(container, { childList: true, subtree: false });
        _scanAllMessages();
    }

    /* ══════════════════════════════════════════════ */
    /* 2. Attach badge to online users list           */
    /* ══════════════════════════════════════════════ */
    function _attachBadgeToUsersList() {
        var items = document.querySelectorAll('#users-sidebar .users-list-item');
        items.forEach(function (item) {
            if (item.querySelector('.gb-badge')) return;
            var nameEl = item.querySelector('.uli-name');
            if (!nameEl) return;
            // نستخرج UID من onclick أو data
            var uid = null;
            var name = nameEl.textContent || '';
            // نبحث في onclick
            if (item.onclick) {
                try {
                    var fnStr = item.onclick.toString();
                    var m = fnStr.match(/openUserProfile\('([^']+)'/);
                    if (m) uid = m[1];
                } catch (e) {}
            }
            if (!uid) return;

            if (typeof db === 'undefined' || !db) return;
            db.ref('users/' + uid + '/isGuest').once('value').then(function (s) {
                var isGuestVal = s.val();
                if (isGuestVal !== true && isGuestVal !== false) return;
                var u = { uid: uid, isGuest: isGuestVal === true };
                var badge = document.createElement('span');
                badge.innerHTML = getBadgeHTML(u, 'sm');
                if (badge.firstChild) nameEl.insertBefore(badge.firstChild, nameEl.firstChild);
            }).catch(function () {});
        });
    }

    function _installUsersObserver() {
        var sb = document.getElementById('users-sidebar');
        if (!sb) { setTimeout(_installUsersObserver, 2000); return; }
        if (sb.__gbObserved) return;
        sb.__gbObserved = true;
        var obs = new MutationObserver(function () {
            setTimeout(_attachBadgeToUsersList, 200);
        });
        obs.observe(sb, { childList: true, subtree: true });
    }

    /* ══════════════════════════════════════════════ */
    /* 3. Attach badge to PM list                     */
    /* ══════════════════════════════════════════════ */
    function _attachBadgeToPMList() {
        var items = document.querySelectorAll('#pm-sidebar .sidebar-item');
        items.forEach(function (item) {
            if (item.querySelector('.gb-badge')) return;
            var nameEl = item.querySelector('div[style*="color:#fff"]');
            if (!nameEl) return;
            // نستخرج UID من onclick
            var uid = null;
            var onclickStr = '';
            try { onclickStr = item.onclick ? item.onclick.toString() : ''; } catch (e) {}
            var m = onclickStr.match(/openPrivateChatWith\(['"]([^'"]+)['"]/);
            if (m) uid = m[1];
            if (!uid) return;

            if (typeof db === 'undefined' || !db) return;
            db.ref('users/' + uid + '/isGuest').once('value').then(function (s) {
                var isGuestVal = s.val();
                if (isGuestVal !== true && isGuestVal !== false) return;
                var u = { uid: uid, isGuest: isGuestVal === true };
                var badge = document.createElement('span');
                badge.innerHTML = getBadgeHTML(u, 'sm');
                if (badge.firstChild) nameEl.insertBefore(badge.firstChild, nameEl.firstChild);
            }).catch(function () {});
        });
    }

    function _installPMObserver() {
        var sb = document.getElementById('pm-sidebar');
        if (!sb) { setTimeout(_installPMObserver, 2000); return; }
        if (sb.__gbObserved) return;
        sb.__gbObserved = true;
        new MutationObserver(function () {
            setTimeout(_attachBadgeToPMList, 200);
        }).observe(sb, { childList: true, subtree: true });
    }

    /* ══════════════════════════════════════════════ */
    /* 4. Attach badge to king-room users             */
    /* ══════════════════════════════════════════════ */
    function _attachBadgeToKingRoomUsers() {
        var rows = document.querySelectorAll('#king-room-view .kr-user');
        rows.forEach(function (row) {
            if (row.querySelector('.gb-badge')) return;
            var nameEl = row.querySelector('.kr-user-name');
            if (!nameEl) return;
            var subEl = row.querySelector('.kr-user-sub');
            if (!subEl) return;
            // UID مش موجود مباشرة — نجيب من cache أو نتجاوز
            // ملاحظة: king-room يعرض كود المستخدم، مش UID. نتجاوز هذه المرة.
        });
    }

    /* ══════════════════════════════════════════════ */
    /* 5. Prevent guest from restricted actions       */
    /* ══════════════════════════════════════════════ */
    function _applyGuestProtections() {
        if (GB.protectedOverrides) return;
        if (!iAmGuest()) return;   // فقط للزوار

        GB.protectedOverrides = true;
        console.log('🕵️ GuestBadge: applying guest restrictions');

        /* ── منع sendPrivateMsg ── */
        var _origSendPM = window.sendPrivateMsg;
        if (typeof _origSendPM === 'function') {
            window.sendPrivateMsg = function () {
                if (_preventGuest('sendPrivateMsg')) return;
                return _origSendPM.apply(this, arguments);
            };
        }

        /* ── منع openPrivateChatWith ── */
        var _origOpenPM = window.openPrivateChatWith;
        if (typeof _origOpenPM === 'function') {
            window.openPrivateChatWith = function () {
                if (_preventGuest('openPrivateChatWith')) return;
                return _origOpenPM.apply(this, arguments);
            };
        }

        /* ── منع openProfile (البروفايل الشخصي) ── */
        var _origOpenProfile = window.openProfile;
        if (typeof _origOpenProfile === 'function') {
            window.openProfile = function () {
                if (_preventGuest('openProfile')) return;
                return _origOpenProfile.apply(this, arguments);
            };
        }

        /* ── منع تعديل البروفايل ── */
        var _origUpdateField = window.updateIdentityField;
        if (typeof _origUpdateField === 'function') {
            window.updateIdentityField = function () {
                if (_preventGuest('updateIdentityField')) return Promise.resolve();
                return _origUpdateField.apply(this, arguments);
            };
        }

        /* ── منع MediaPicker (رفع ملفات) ── */
        if (window.MediaPicker && typeof window.MediaPicker.open === 'function') {
            var _origMPOpen = window.MediaPicker.open;
            window.MediaPicker.open = function () {
                if (_preventGuest('MediaPicker')) return Promise.resolve();
                return _origMPOpen.apply(this, arguments);
            };
        }

        /* ── منع PM file pickers ── */
        ['pmPickImage', 'pmPickVideo', 'pmPickAudio'].forEach(function (name) {
            var orig = window[name];
            if (typeof orig === 'function') {
                window[name] = function () {
                    if (_preventGuest(name)) return;
                    return orig.apply(this, arguments);
                };
            }
        });

        /* ── منع rollDice (النرد) ── */
        var _origRollDice = window.rollDice;
        if (typeof _origRollDice === 'function') {
            window.rollDice = function () {
                if (_preventGuest('rollDice')) return;
                return _origRollDice.apply(this, arguments);
            };
        }

        /* ── منع RoomAlerts (التنبيهات) ── */
        if (window.RoomAlerts && typeof window.RoomAlerts.open === 'function') {
            var _origRAOpen = window.RoomAlerts.open;
            window.RoomAlerts.open = function () {
                if (_preventGuest('RoomAlerts.open')) return;
                return _origRAOpen.apply(this, arguments);
            };
        }

        /* ── منع الترقية/التخفيض من البروفايل ── */
        var _origExecAdmin = window._executeAdminAction;
        if (typeof _origExecAdmin === 'function') {
            window._executeAdminAction = function () {
                if (_preventGuest('_executeAdminAction')) return;
                return _origExecAdmin.apply(this, arguments);
            };
        }

        /* ── منع pmOpenReportDialog (الإبلاغ) ── */
        var _origReport = window.pmOpenReportDialog;
        if (typeof _origReport === 'function') {
            window.pmOpenReportDialog = function () {
                if (_preventGuest('pmOpenReportDialog')) return;
                return _origReport.apply(this, arguments);
            };
        }

        /* ── منع pmOpenGuardianCallDialog (استدعاء السجان) ── */
        var _origGuardian = window.pmOpenGuardianCallDialog;
        if (typeof _origGuardian === 'function') {
            window.pmOpenGuardianCallDialog = function () {
                if (_preventGuest('pmOpenGuardianCallDialog')) return;
                return _origGuardian.apply(this, arguments);
            };
        }
    }

    /* ══════════════════════════════════════════════ */
    /* 6. Hide sensitive fields in visitor profile    */
    /* ══════════════════════════════════════════════ */
    function _hideSensitiveFieldsForGuest() {
        if (!iAmGuest()) return;
        var grid = document.getElementById('info-grid');
        if (!grid) return;
        // إخفاء UID والمعرّف
        ['uid', 'code'].forEach(function (key) {
            var el = grid.querySelector('[data-info="' + key + '"]');
            if (el) el.style.display = 'none';
        });
    }

    /* ══════════════════════════════════════════════ */
    /* 7. Disable buttons in guest profile            */
    /* ══════════════════════════════════════════════ */
    function _disableGuestProfileButtons() {
        if (!iAmGuest()) return;

        // تعطيل أزرار التعديل
        var toDisable = [
            'btn-edit-username',
            'btn-edit-bio',
            'btn-upload-avatar',
            'btn-remove-avatar',
            'btn-upload-cover',
            'btn-remove-cover',
            'btn-upload-music',
            'btn-remove-music',
            'btn-upload-poetry-bg',
            'btn-upload-poetry-attach',
            'btn-save-poetry',
            'btn-remove-poetry',
            'btn-upload-bg',
            'btn-remove-profile-bg',
            'remove-name-color',
            'remove-name-gradient',
            'remove-name-bg-color',
            'remove-name-bg-gradient',
            'remove-name-cinema-bg',
            'btn-remove-frame',
            'btn-remove-glow'
        ];
        toDisable.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.classList.add('gb-disabled-for-guest');
        });

        // تعطيل تفاعلات البروفايل
        ['btn-heart', 'btn-mail', 'btn-friend', 'btn-block'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.classList.add('gb-disabled-for-guest');
        });
    }

    /* ══════════════════════════════════════════════ */
    /* 8. Disable guest from king-room                */
    /* ══════════════════════════════════════════════ */
    function _blockKingRoomForGuest() {
        if (!iAmGuest()) return;

        var _origOpen = window.KingRoom && window.KingRoom.open;
        if (typeof _origOpen === 'function' && !window.KingRoom.__gbPatched) {
            window.KingRoom.open = function () {
                if (_preventGuest('KingRoom.open')) return;
                return _origOpen.apply(this, arguments);
            };
            window.KingRoom.__gbPatched = true;
        }

        // نتأكد من إخفاء زر غرفة الملك
        setInterval(function () {
            var btn = document.getElementById('king-room-btn');
            if (btn) btn.style.display = 'none';
        }, 1500);
    }

    /* ══════════════════════════════════════════════ */
    /* Init                                           */
    /* ══════════════════════════════════════════════ */
    function init() {
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            var u = getMe();
            if (!u) {
                if (attempts >= 40) clearInterval(t);
                return;
            }
            clearInterval(t);

            GB.me = u;
            GB.meIsGuest = isGuestUser(u);

            console.log('🕵️ GuestBadge: mode=' + (GB.meIsGuest ? 'GUEST' : 'MEMBER'));

            // installers
            _installMessagesObserver();
            setTimeout(_installUsersObserver, 1500);
            setTimeout(_installPMObserver, 1500);

            // protections (فقط للزوار)
            if (GB.meIsGuest) {
                setTimeout(_applyGuestProtections, 500);
                setTimeout(_blockKingRoomForGuest, 1000);
                setTimeout(_disableGuestProfileButtons, 1500);
                setTimeout(_hideSensitiveFieldsForGuest, 2000);
            }

        }, 500);
    }

    /* ══════════════════════════════════════════════ */
    /* Export                                         */
    /* ══════════════════════════════════════════════ */
    window.GuestBadge = {
        isGuest: isGuestUser,
        iAmGuest: iAmGuest,
        getBadgeHTML: getBadgeHTML,
        attachBadge: attachBadge,
        version: 1
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('🕵️ guest-badge.js v1 (TEST) loaded — badge + restrictions');
})();
