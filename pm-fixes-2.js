// ==============================================
// pm-fixes-2.js v1 — إصلاح PM list + إشعار بصري
// ==============================================

(function () {
    'use strict';
    if (window.__pmFixes2V1) return;
    window.__pmFixes2V1 = true;

    /* 1. ضغط الاسم في قائمة PM → يفتح الخاص (مو البروفايل) */
    function _fixPmListNames() {
        var items = document.querySelectorAll('#pm-sidebar .sidebar-item');
        items.forEach(function (item) {
            if (item.__pmFixes2Fixed) return;

            /* نجد اسم المرسل — div بالنص الأبيض بدون img */
            var nameDiv = null;
            var allDivs = item.querySelectorAll('div');
            allDivs.forEach(function (div) {
                if (nameDiv) return;
                if (div.querySelector('img')) return;
                if (div.querySelector('div')) return;
                var style = div.getAttribute('style') || '';
                if (style.indexOf('#fff') === -1 &&
                    style.indexOf('#FFF') === -1 &&
                    style.indexOf('rgb(255, 255, 255)') === -1) return;
                var txt = (div.textContent || '').trim();
                if (!txt || txt.length < 1) return;
                nameDiv = div;
            });

            if (!nameDiv) return;
            item.__pmFixes2Fixed = true;

            /* إعادة ربط: اضغط الاسم → افتح الخاص */
            nameDiv.style.cursor = 'pointer';
            nameDiv.onclick = function (e) {
                e.stopPropagation();
                e.preventDefault();
                var evt = new MouseEvent('click', { bubbles: false, cancelable: true });
                item.dispatchEvent(evt);
            };
        });
    }

    setInterval(_fixPmListNames, 1500);

    /* 2. إشعار بصري للرسائل الخاصة */
    function _installNotifToast() {
        var orig = window.startNotificationsListener;
        if (typeof orig !== 'function' || orig.__pmFixes2Toast) return false;

        window.startNotificationsListener = function () {
            var user = null;
            try { if (typeof getCurrentUser === 'function') user = getCurrentUser(); } catch (e) {}
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
                        /* ⭐ إشعار بصري */
                        if (typeof showToast === 'function') {
                            var preview = n.preview || 'رسالة';
                            if (preview.length > 40) preview = preview.substring(0, 40) + '...';
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
    }

    var tries = 0;
    var t = setInterval(function () {
        tries++;
        if (_installNotifToast() || tries >= 40) clearInterval(t);
    }, 250);

    function init() {
        setTimeout(_fixPmListNames, 500);
        setTimeout(_fixPmListNames, 1500);
        setTimeout(_fixPmListNames, 3000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

    console.log('📦 pm-fixes-2.js v1 loaded');
})();
