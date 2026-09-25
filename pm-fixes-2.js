// ==============================================
// pm-fixes-2.js v1 — إصلاح PM list + إشعار بصري
// ==============================================
// ✅ v1:
//   1. ضغط الاسم في قائمة PM → يفتح الخاص (كان يفتح بروفايل)
//   2. ضغط الصورة → بروفايل (كما هو)
//   3. إشعار بصري (toast) للرسائل الخاصة
// ==============================================

(function () {
    'use strict';
    if (window.__pmFixes2V1) return;
    window.__pmFixes2V1 = true;

    /* ══════════════════════════════════════════════ */
    /* 1. Fix PM list name click                      */
    /* ══════════════════════════════════════════════ */
    function _fixPmListNames() {
        var items = document.querySelectorAll('#pm-sidebar .sidebar-item');
        items.forEach(function (item) {
            if (item.__pmFixes2Fixed) return;

            // جب النص الأبيض (الاسم) بدون img
            var nameDiv = null;
            item.querySelectorAll('div').forEach(function (div) {
                if (div.querySelector('img')) return;
                var style = div.getAttribute('style') || '';
                var hasWhite = style.indexOf('#fff') !== -1 ||
                              style.indexOf('#FFF') !== -1 ||
                              style.indexOf('rgb(255, 255, 255)') !== -1;
                if (hasWhite && (div.textContent || '').trim().length > 0 && !div.querySelector('div')) {
                    nameDiv = div;
                }
            });

            if (!nameDiv) return;
            item.__pmFixes2Fixed = true;

            // Override: اضغط الاسم → افتح الخاص
            nameDiv.onclick = function (e) {
                e.stopPropagation();
                var evt = new MouseEvent('click', { bubbles: true, cancelable: true });
                item.dispatchEvent(evt);
            };
        });
    }

    /* كل 2 ثانية نفحص (لو القائمة رُسمت بعد فتحها) */
    setInterval(_fixPmListNames, 2000);

    /* ══════════════════════════════════════════════ */
    /* 2. إشعار بصري للرسائل الخاصة                    */
    /* ══════════════════════════════════════════════ */
    var _installNotifToast = function () {
        var orig = window.startNotificationsListener;
        if (typeof orig !== 'function' || orig.__pmFixes2Toast) return false;

        window.startNotificationsListener = function () {
            var user = getCurrentUser();
            if (!user || !user.uid) return;

            if (window.ChatState && ChatState.notificationsListener) {
                try { ChatState.notificationsListener.off(); } catch (e) {}
            }

            var lastKnownKey = '';
            db.ref('user_notifications/' + user.uid).limitToLast(50).once('value').then(function (s) {
                var unread = 0;
                s.forEach(function (c) {
                    var n = c.val();
                    if (!n) return;
                    lastKnownKey = c.key;
                    if (n.read) return;
                    if (n.fromUid === user.uid) return;
                    if (n.type === 'private') return;
                    unread++;
                });
                if (window.ChatState) ChatState.unreadCount = unread;
                if (typeof updateNotifBadge === 'function') updateNotifBadge();

                var ref = db.ref('user_notifications/' + user.uid).limitToLast(20);
                if (window.ChatState) ChatState.notificationsListener = ref;

                ref.on('child_added', function (s) {
                    var n = s.val();
                    if (!n) return;
                    if (s.key <= lastKnownKey) return;
                    if (n.fromUid === user.uid) return;
                    if (n.read) return;
                    lastKnownKey = s.key;

                    if (n.type === 'mention') {
                        if (typeof playBirdSoundThrottled === 'function') playBirdSoundThrottled();
                        if (typeof showToast === 'function') showToast('fa-bell', '🔔 ' + n.fromName + ' أشار إليك');
                        if (window.ChatState) ChatState.unreadCount++;
                        if (typeof updateNotifBadge === 'function') updateNotifBadge();
                    } else if (n.type === 'private') {
                        if (typeof playPrivateMsgSound === 'function') playPrivateMsgSound();
                        /* ⭐ إشعار بصري — كان ناقص */
                        var preview = n.preview || 'رسالة';
                        if (typeof showToast === 'function') {
                            showToast('fa-comment', '💬 ' + (n.fromName || 'مستخدم') + ': ' + preview);
                        }
                    } else if (n.type === 'friend_request') {
                        if (typeof showToast === 'function') showToast('fa-user-plus', '➕ طلب صداقة من ' + n.fromName);
                        if (window.ChatState) ChatState.unreadCount++;
                        if (typeof updateNotifBadge === 'function') updateNotifBadge();
                    } else if (n.type === 'like') {
                        if (typeof showToast === 'function') showToast('fa-heart', '❤️ ' + n.fromName + ' أعجب بك');
                        if (window.ChatState) ChatState.unreadCount++;
                        if (typeof updateNotifBadge === 'function') updateNotifBadge();
                    }
                });
            }).catch(function () {});
        };
        window.startNotificationsListener.__pmFixes2Toast = true;
        return true;
    };

    var tries = 0;
    var t = setInterval(function () {
        tries++;
        if (_installNotifToast() || tries >= 40) clearInterval(t);
    }, 250);

    /* ══════════════════════════════════════════════ */
    /* Init                                           */
    /* ══════════════════════════════════════════════ */
    function init() {
        setTimeout(_fixPmListNames, 500);
        setTimeout(_fixPmListNames, 1500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

    console.log('📦 pm-fixes-2.js v1 loaded — PM list fix + notif toast');
})();
