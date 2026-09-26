// ==============================================
// room-purge.js v1 — حل إسعافي لحذف رسائل غرفة
// ==============================================
// ✅ v1:
//   1. زر 🗑️ أحمر لكل غرفة في تبويب الغرف (غرفة الملك)
//   2. تأكيد بكتابة كلمة "حذف"
//   3. عرض عدد الرسائل المحذوفة
//   4. audit_log لكل عملية
//   5. King فقط
// ==============================================

(function () {
    'use strict';
    if (window.__roomPurgeV1) return;
    window.__roomPurgeV1 = true;

    function getMe() {
        try { if (typeof getCurrentUser === 'function') return getCurrentUser(); } catch (e) {}
        try {
            return JSON.parse(localStorage.getItem('qamar_current_user') || localStorage.getItem('qamar_user') || 'null');
        } catch (e) { return null; }
    }

    function isKing() {
        var u = getMe();
        return !!(u && u.rank === 'King');
    }

    function toast(icon, msg) {
        if (typeof showToast === 'function') showToast(icon, msg);
        else alert(msg);
    }

    /* ══════════════════════════════════════════════ */
    /* 1. وسم صفوف الغرف بـ data-room-row              */
    /* ══════════════════════════════════════════════ */
    function markRoomRows() {
        var krView = document.getElementById('king-room-view');
        if (!krView) return;

        krView.querySelectorAll('.kr-user').forEach(function (row) {
            if (row.getAttribute('data-room-row')) return;
            /* زر التعديل موجود مع data-r = roomId */
            var editBtn = row.querySelector('.kr-icon-btn[data-r]');
            if (editBtn) {
                var roomId = editBtn.getAttribute('data-r');
                if (roomId) row.setAttribute('data-room-row', roomId);
            }
        });
    }

    /* ══════════════════════════════════════════════ */
    /* 2. إضافة زر 🗑️ لكل غرفة                        */
    /* ══════════════════════════════════════════════ */
    function injectButtons() {
        if (!isKing()) return;

        var krView = document.getElementById('king-room-view');
        if (!krView || !krView.classList.contains('active')) return;

        /* نتأكد أننا في تبويب الغرف */
        var activeTab = krView.querySelector('.kr-tab.active');
        if (!activeTab) return;
        var tabText = activeTab.textContent || '';
        if (tabText.indexOf('الغرف') === -1) return;

        var rows = krView.querySelectorAll('.kr-user[data-room-row]');
        rows.forEach(function (row) {
            if (row.querySelector('.room-purge-btn')) return;
            var roomId = row.getAttribute('data-room-row');
            if (!roomId) return;

            var btn = document.createElement('button');
            btn.className = 'kr-icon-btn room-purge-btn';
            btn.type = 'button';
            btn.style.cssText = 'margin-right:4px;background:rgba(255,68,68,0.15);border:1px solid rgba(255,68,68,0.5);color:#ff6666;';
            btn.innerHTML = '🗑️';
            btn.title = 'حذف كل رسائل هذه الغرفة';
            btn.onclick = function (e) {
                e.stopPropagation();
                e.preventDefault();
                purgeRoom(roomId);
            };
            row.appendChild(btn);
        });
    }

    /* ══════════════════════════════════════════════ */
    /* 3. تنفيذ الحذف                                 */
    /* ══════════════════════════════════════════════ */
    async function purgeRoom(roomId) {
        if (!isKing()) {
            toast('fa-lock', '👑 الملك فقط');
            return;
        }
        if (typeof db === 'undefined' || !db) {
            toast('fa-times', '⚠️ Firebase غير جاهز');
            return;
        }

        var roomName = roomId;
        if (typeof QAMAR !== 'undefined' && QAMAR.ROOMS && QAMAR.ROOMS[roomId]) {
            roomName = QAMAR.ROOMS[roomId].name || roomId;
        }

        /* حساب عدد الرسائل أولاً */
        var count = 0;
        try {
            var snap = await db.ref('room_messages/' + roomId).once('value');
            var data = snap.val() || {};
            count = Object.keys(data).length;
        } catch (e) {
            toast('fa-times', '⚠️ فشل قراءة العدد');
            return;
        }

        if (count === 0) {
            toast('fa-info-circle', '📭 الغرفة فارغة');
            return;
        }

        /* تأكيد بكتابة كلمة "حذف" */
        var input = prompt(
            '⚠️ تحذير خطير!\n\n' +
            'سيتم حذف ' + count + ' رسالة من غرفة "' + roomName + '"\n' +
            'لا يمكن التراجع!\n\n' +
            'اكتب "حذف" للتأكيد:'
        );
        if (input !== 'حذف') {
            if (input !== null) toast('fa-times', '❌ تم الإلغاء');
            return;
        }

        try {
            toast('fa-spinner', '⏳ جاري الحذف...');
            await db.ref('room_messages/' + roomId).remove();

            /* log */
            var me = getMe() || {};
            try {
                db.ref('audit_log').push({
                    type: 'room_purge',
                    byUid: me.uid || null,
                    byName: me.name || 'King',
                    roomId: roomId,
                    roomName: roomName,
                    messagesCount: count,
                    at: firebase.database.ServerValue.TIMESTAMP
                }).catch(function () {});
            } catch (e) {}

            toast('fa-check', '✅ تم حذف ' + count + ' رسالة من ' + roomName);

            /* تنظيف الشات العام إذا كان المستخدم في نفس الغرفة */
            if (typeof ChatState !== 'undefined' && ChatState.currentRoom === roomId) {
                var messagesEl = document.getElementById('messages');
                if (messagesEl) messagesEl.innerHTML = '';
                if (ChatState.seenMessages && ChatState.seenMessages.clear) {
                    ChatState.seenMessages.clear();
                }
            }

        } catch (e) {
            console.error('room-purge error:', e);
            toast('fa-times', '⚠️ فشل: ' + e.message);
        }
    }

    /* ══════════════════════════════════════════════ */
    /* 4. مراقبة مستمرة                                */
    /* ══════════════════════════════════════════════ */
    setInterval(function () {
        markRoomRows();
        injectButtons();
    }, 700);

    /* عند فتح غرفة الملك */
    var krObserverAttempts = 0;
    var krObserver = setInterval(function () {
        krObserverAttempts++;
        var krView = document.getElementById('king-room-view');
        if (krView) {
            clearInterval(krObserver);
            new MutationObserver(function () {
                setTimeout(markRoomRows, 100);
                setTimeout(injectButtons, 150);
            }).observe(krView, { childList: true, subtree: true, attributes: true });

            markRoomRows();
            injectButtons();
        }
        if (krObserverAttempts >= 60) clearInterval(krObserver);
    }, 500);

    console.log('✅ room-purge.js v1 loaded — زر حذف رسائل الغرف');
})();
