// ==============================================
// room-picker.js v6 — استخدام QAMAR/db مباشرة
// ==============================================

(function () {
    'use strict';
    if (window.__roomPickerV6) return;
    window.__roomPickerV6 = true;

    var STORAGE_KEY = 'qamar_room_picker_done';
    var LAST_ROOM_KEY = 'qamar_last_room';

    /* CSS */
    (function injectCSS() {
        if (document.getElementById('room-picker-css')) return;
        var s = document.createElement('style');
        s.id = 'room-picker-css';
        s.textContent = `
#room-picker-screen {
    position: fixed !important;
    top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
    background: linear-gradient(180deg, #0a0518 0%, #1a0e2e 50%, #0a0518 100%) !important;
    z-index: 999999 !important;
    display: none !important;
    flex-direction: column !important;
    direction: rtl !important;
    font-family: Cairo, sans-serif !important;
    overflow-y: auto !important;
    color: #fff !important;
}
#room-picker-screen.active { display: flex !important; }

#rp-header { padding: 24px 20px 12px !important; text-align: center !important; flex-shrink: 0 !important; }
#rp-header h2 { color: #ffd700 !important; font-size: 22px !important; font-weight: 900 !important; margin: 0 0 6px !important; }
#rp-header .rp-user { color: #ffffff !important; font-size: 14px !important; font-weight: 700 !important; }
#rp-header .rp-user-name { color: #ffd700 !important; }
#rp-header .rp-hint { color: #cccccc !important; font-size: 12px !important; margin-top: 8px !important; }

#rp-list {
    flex: 1 !important;
    padding: 12px 16px 24px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 10px !important;
    max-width: 480px !important;
    width: 100% !important;
    margin: 0 auto !important;
    box-sizing: border-box !important;
}

.rp-item {
    background: rgba(30, 20, 50, 0.95) !important;
    border: 1px solid rgba(255,215,0,0.4) !important;
    border-radius: 14px !important;
    padding: 14px 16px !important;
    display: flex !important;
    align-items: center !important;
    gap: 14px !important;
    cursor: pointer !important;
    box-sizing: border-box !important;
    min-height: 70px !important;
}
.rp-item:active { background: rgba(212, 175, 55, 0.3) !important; }
.rp-icon {
    width: 46px !important; height: 46px !important;
    border-radius: 12px !important;
    background: rgba(212, 175, 55, 0.15) !important;
    border: 1px solid rgba(212, 175, 55, 0.4) !important;
    display: flex !important; align-items: center !important; justify-content: center !important;
    font-size: 24px !important; flex-shrink: 0 !important; overflow: hidden !important;
}
.rp-icon img { width: 100% !important; height: 100% !important; object-fit: cover !important; }
.rp-info { flex: 1 !important; min-width: 0 !important; text-align: right !important; }
.rp-name { color: #ffffff !important; font-size: 16px !important; font-weight: 900 !important; margin-bottom: 4px !important; }
.rp-meta { color: #cccccc !important; font-size: 12px !important; }
.rp-count { color: #84cc16 !important; font-weight: 700 !important; }
.rp-count.empty { color: #999 !important; }
.rp-arrow { color: #ffd700 !important; font-size: 20px !important; flex-shrink: 0 !important; }

#rp-footer { padding: 12px 20px 24px !important; text-align: center !important; flex-shrink: 0 !important; }
#rp-logout {
    background: rgba(30, 20, 50, 0.95) !important;
    border: 1px solid rgba(255,68,68,0.5) !important;
    color: #ff7777 !important;
    padding: 12px 28px !important;
    border-radius: 10px !important;
    font-family: inherit !important;
    font-size: 13px !important;
    font-weight: 900 !important;
    cursor: pointer !important;
}

#rp-debug {
    background: rgba(0,0,0,0.6) !important;
    border: 1px solid rgba(255,68,68,0.5) !important;
    border-radius: 10px !important;
    padding: 12px !important;
    color: #ff9999 !important;
    font-size: 11px !important;
    font-family: monospace !important;
    margin: 10px 0 !important;
    direction: ltr !important;
    text-align: left !important;
    word-break: break-all !important;
    line-height: 1.6 !important;
}
#rp-debug strong { color: #ffd700 !important; }

#rp-retry {
    margin-top: 10px !important;
    padding: 10px 24px !important;
    background: #ffd700 !important;
    color: #050508 !important;
    border: none !important;
    border-radius: 8px !important;
    font-family: inherit !important;
    font-weight: 900 !important;
    cursor: pointer !important;
    font-size: 12px !important;
}
        `;
        document.head.appendChild(s);
    })();

    var _origInitChat = null;
    var _pickerActive = false;

    /* ⭐ الوصول للمتغيرات العامة */
    function getMe() {
        try {
            if (typeof getCurrentUser === 'function') {
                var u = getCurrentUser();
                if (u) return u;
            }
        } catch(e) {}
        try {
            return JSON.parse(localStorage.getItem('qamar_current_user') || localStorage.getItem('qamar_user') || 'null');
        } catch(e) { return null; }
    }

    function escapeHtml(s) {
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, function(c) {
            return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
        });
    }

    /* ⭐ الحصول على QAMAR/db من المتغيرات العامة أو window */
    function getQamar() {
        try {
            if (typeof QAMAR !== 'undefined' && QAMAR) return QAMAR;
        } catch(e) {}
        return window.QAMAR || null;
    }
    function getDb() {
        try {
            if (typeof db !== 'undefined' && db) return db;
        } catch(e) {}
        return window.db || null;
    }

    function buildList() {
        var listEl = document.getElementById('rp-list');
        if (!listEl) return;

        var debug = [];
        var Q = getQamar();
        var D = getDb();

        debug.push('getCurrentUser: ' + (typeof getCurrentUser));
        debug.push('QAMAR (direct): ' + (typeof QAMAR));
        debug.push('window.QAMAR: ' + (typeof window.QAMAR));
        debug.push('db (direct): ' + (typeof db));
        debug.push('window.db: ' + (typeof window.db));

        var me = getMe();
        debug.push('me: ' + (me ? (me.name + ' / ' + me.uid) : 'NULL'));

        // فشل 1: لا يوجد مستخدم
        if (!me) {
            listEl.innerHTML =
                '<div id="rp-debug"><strong>⚠️ لم يتم العثور على المستخدم</strong><br>' +
                debug.join('<br>') + '</div>' +
                '<div style="text-align:center"><button id="rp-retry" onclick="location.reload()">🔄 إعادة التحميل</button></div>';
            return;
        }

        // فشل 2: QAMAR غير معرّف
        if (!Q) {
            listEl.innerHTML =
                '<div id="rp-debug"><strong>⚠️ QAMAR غير معرّف — config.js لم يحمّل</strong><br>' +
                debug.join('<br>') + '</div>' +
                '<div style="text-align:center"><button id="rp-retry" onclick="location.reload()">🔄 إعادة التحميل</button></div>';
            return;
        }

        if (Q.ROOMS) debug.push('QAMAR.ROOMS keys: ' + Object.keys(Q.ROOMS).join(','));

        // فشل 3: QAMAR.ROOMS فارغة
        if (!Q.ROOMS || Object.keys(Q.ROOMS).length === 0) {
            listEl.innerHTML =
                '<div id="rp-debug"><strong>⚠️ QAMAR.ROOMS فارغة</strong><br>' +
                debug.join('<br>') + '</div>' +
                '<div style="text-align:center"><button id="rp-retry" onclick="location.reload()">🔄 إعادة التحميل</button></div>';
            return;
        }

        // الحصول على الرومات
        var visible;
        try {
            if (typeof Q.getVisibleRooms === 'function') {
                visible = Q.getVisibleRooms(me);
            } else {
                visible = Q.ROOMS;
            }
        } catch(e) {
            listEl.innerHTML =
                '<div id="rp-debug"><strong>⚠️ خطأ في getVisibleRooms:</strong><br>' + e.message + '<br>' +
                debug.join('<br>') + '</div>' +
                '<div style="text-align:center"><button id="rp-retry" onclick="location.reload()">🔄 إعادة التحميل</button></div>';
            return;
        }

        var roomIds = Object.keys(visible || {}).filter(function(rid) {
            return rid !== 'bot_training' && rid !== 'jail';
        });

        debug.push('visible rooms: ' + roomIds.length + ' [' + roomIds.join(',') + ']');

        if (roomIds.length === 0) {
            listEl.innerHTML =
                '<div id="rp-debug"><strong>⚠️ لا توجد غرف متاحة</strong><br>' +
                debug.join('<br>') + '</div>' +
                '<div style="text-align:center"><button id="rp-retry" onclick="location.reload()">🔄 إعادة التحميل</button></div>';
            return;
        }

        // نجاح
        listEl.innerHTML = '';

        roomIds.forEach(function(rid) {
            var room = visible[rid];
            var item = document.createElement('div');
            item.className = 'rp-item';
            item.setAttribute('data-room-id', rid);

            var iconHtml = room.icon || '🚪';
            if (room.iconImage) {
                iconHtml = '<img src="' + escapeHtml(room.iconImage) + '" alt="">';
            }

            var nameStyle = '';
            if (room.nameColor && /^#[0-9a-f]{3,8}$/i.test(room.nameColor)) {
                nameStyle = 'style="color:' + room.nameColor + '"';
            }

            item.innerHTML =
                '<div class="rp-icon">' + iconHtml + '</div>' +
                '<div class="rp-info">' +
                    '<div class="rp-name" ' + nameStyle + '>' + escapeHtml(room.name || rid) + '</div>' +
                    '<div class="rp-meta"><span class="rp-count" data-count-for="' + escapeHtml(rid) + '">👥 ...</span></div>' +
                '</div>' +
                '<div class="rp-arrow">◀</div>';

            item.onclick = function() { pickRoom(rid); };
            listEl.appendChild(item);
        });

        loadPresenceCounts(roomIds);
    }

    function loadPresenceCounts(roomIds) {
        var D = getDb();
        if (!D) return;
        try {
            D.ref('user_presence').once('value').then(function(snap) {
                var data = snap.val() || {};
                var now = Date.now();
                var counts = {};
                roomIds.forEach(function(rid) { counts[rid] = 0; });
                Object.keys(data).forEach(function(uid) {
                    var p = data[uid];
                    if (!p || p.state !== 'online') return;
                    if ((now - (p.lastChanged || 0)) >= 120000) return;
                    if (p.room && counts[p.room] !== undefined) counts[p.room]++;
                });
                roomIds.forEach(function(rid) {
                    var el = document.querySelector('[data-count-for="' + rid + '"]');
                    if (!el) return;
                    if (counts[rid] > 0) {
                        el.textContent = '👥 ' + counts[rid];
                        el.classList.remove('empty');
                    } else {
                        el.textContent = '👥 0';
                        el.classList.add('empty');
                    }
                });
            }).catch(function() {});
        } catch(e) {}
    }

    function pickRoom(roomId) {
        var me = getMe();
        if (!me) return;
        var Q = getQamar();
        if (!Q || typeof Q.isRoomVisible !== 'function' || !Q.isRoomVisible(roomId, me)) {
            if (typeof showToast === 'function') showToast('fa-lock', '🔒 غير متاحة');
            return;
        }

        try {
            localStorage.setItem(STORAGE_KEY, '1');
            localStorage.setItem(LAST_ROOM_KEY, roomId);
        } catch(e) {}

        if (typeof cleanupAllListeners === 'function') {
            try { cleanupAllListeners(); } catch(e) {}
        }

        var cs = window.ChatState;
        if (cs) {
            cs.isInitialized = false;
            cs.currentRoom = roomId;
            cs.messagesListener = null;
            cs.presenceInterval = null;
            cs.privateChatsListener = null;
            cs.notificationsListener = null;
            cs.privateMessagesListener = null;
            if (cs.seenMessages && cs.seenMessages.clear) cs.seenMessages.clear();
        }

        hidePicker();

        var ls = document.getElementById('login-screen');
        if (ls) ls.style.display = 'none';
        var cc = document.getElementById('chat-container');
        if (cc) cc.style.display = 'none';
        var messagesEl = document.getElementById('messages');
        if (messagesEl) messagesEl.innerHTML = '';

        setTimeout(function() {
            if (_origInitChat) {
                try { _origInitChat.call(window); } catch(err) { console.error(err); }
            } else if (typeof initChat === 'function') {
                try { initChat(); } catch(err) {}
            }
            setTimeout(function() {
                var cc2 = document.getElementById('chat-container');
                if (cc2 && cc2.style.display === 'none') cc2.style.display = 'flex';
            }, 150);
        }, 100);
    }

    function showPicker() {
        if (_pickerActive) return;
        _pickerActive = true;

        var me = getMe();
        if (!me) { _pickerActive = false; return; }

        var screen = document.getElementById('room-picker-screen');
        if (!screen) {
            screen = document.createElement('div');
            screen.id = 'room-picker-screen';
            screen.innerHTML =
                '<div id="rp-header">' +
                    '<h2>🌙 قمر الشام</h2>' +
                    '<div class="rp-user">أهلاً <span class="rp-user-name" id="rp-user-name"></span></div>' +
                    '<div class="rp-hint">اختر غرفة للدخول</div>' +
                '</div>' +
                '<div id="rp-list"></div>' +
                '<div id="rp-footer">' +
                    '<button type="button" id="rp-logout">🚪 تسجيل خروج</button>' +
                '</div>';
            document.body.appendChild(screen);
        }

        var nameEl = document.getElementById('rp-user-name');
        if (nameEl) nameEl.textContent = me.name || 'زائر';

        var logoutBtn = document.getElementById('rp-logout');
        if (logoutBtn) {
            logoutBtn.onclick = function() {
                if (!confirm('تسجيل خروج؟')) return;
                if (typeof handleLogout === 'function') handleLogout();
                else if (typeof logout === 'function') logout().then(function() { location.reload(); });
            };
        }

        var ls = document.getElementById('login-screen');
        if (ls) ls.style.display = 'none';
        var cc = document.getElementById('chat-container');
        if (cc) cc.style.display = 'none';

        buildList();
        screen.classList.add('active');
    }

    function hidePicker() {
        _pickerActive = false;
        var screen = document.getElementById('room-picker-screen');
        if (screen) screen.classList.remove('active');
    }

    function patchInitChatNow() {
        if (typeof initChat !== 'function') {
            var wait = setInterval(function() {
                if (typeof initChat === 'function') {
                    clearInterval(wait);
                    patchInitChatNow();
                }
            }, 20);
            setTimeout(function() { clearInterval(wait); }, 5000);
            return;
        }
        if (window.__roomPickerPatched) return;
        window.__roomPickerPatched = true;

        _origInitChat = window.initChat || initChat;
        window.initChat = function() {
            var done = false;
            try { done = localStorage.getItem(STORAGE_KEY) === '1'; } catch(e) {}
            if (!done) { showPicker(); return; }
            return _origInitChat.apply(this, arguments);
        };
    }

    window.showRoomPicker = function() {
        try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
        if (typeof cleanupAllListeners === 'function') {
            try { cleanupAllListeners(); } catch(e) {}
        }
        if (window.ChatState) window.ChatState.isInitialized = false;
        showPicker();
    };

    patchInitChatNow();
    console.log('🚪 room-picker.js v6 loaded — direct QAMAR/db access');
})();
