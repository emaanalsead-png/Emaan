// ==============================================
// voice-share-fix.js — إصلاح المشاركة في الاستوديو
// ==============================================
// ✅ الإصلاحات:
//   1. استبدال prompt() بـ modals مدمجة
//   2. اختيار الروم من قائمة
//   3. اختيار المستخدم من قائمة
//   4. تصميم موحد مع باقي المنصة
// ==============================================

(function () {
    'use strict';
    if (window.__voiceShareFixV1) return;
    window.__voiceShareFixV1 = true;

    /* ═══ Helpers ═══ */
    function getMe() {
        try { if (typeof getCurrentUser === 'function') { var u = getCurrentUser(); if (u && u.uid) return u; } } catch (e) {}
        try { return JSON.parse(localStorage.getItem('qamar_current_user') || 'null'); } catch (e) { return null; }
    }
    function getRoom() {
        try { if (typeof ChatState !== 'undefined' && ChatState.currentRoom) return ChatState.currentRoom; } catch (e) {}
        return 'general';
    }
    function toast(icon, msg) {
        if (typeof showToast === 'function') showToast(icon, msg);
        else console.log('[ShareFix]', msg);
    }
    function log() { console.log('[VoiceShareFix]', ...arguments); }

    /* ═══ CSS ═══ */
    (function injectCSS() {
        if (document.getElementById('vsfix-css')) return;
        var s = document.createElement('style');
        s.id = 'vsfix-css';
        s.textContent = `
.vsfix-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.95);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 1000200;
    display: none; justify-content: center; align-items: center;
    padding: 16px; direction: rtl;
    font-family: Cairo, sans-serif;
}
.vsfix-overlay.active { display: flex; }
.vsfix-box {
    background: #0a0616;
    border: 2px solid #a855f7;
    border-radius: 18px;
    width: 100%; max-width: 420px; max-height: 85vh;
    display: flex; flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.9), 0 0 40px rgba(168,85,247,0.4);
}
.vsfix-head {
    padding: 14px 16px;
    border-bottom: 1px solid rgba(168,85,247,0.3);
    background: linear-gradient(135deg, rgba(168,85,247,0.2), rgba(0,0,0,0.4));
    display: flex; justify-content: space-between; align-items: center;
    flex-shrink: 0;
}
.vsfix-head h3 {
    color: #c084fc; margin: 0; font-size: 15px; font-weight: 900;
    display: flex; align-items: center; gap: 8px;
}
.vsfix-close {
    background: rgba(255,68,68,0.2);
    border: 1px solid rgba(255,68,68,0.5);
    color: #ff7777;
    width: 30px; height: 30px; border-radius: 50%;
    cursor: pointer; font-size: 13px; font-weight: 900; padding: 0;
}
.vsfix-body {
    flex: 1; overflow-y: auto;
    padding: 12px;
}
.vsfix-hint {
    color: #888; font-size: 11px;
    text-align: center; padding: 8px;
    background: rgba(168,85,247,0.06);
    border-radius: 8px; margin-bottom: 12px;
    line-height: 1.5;
}
.vsfix-item {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 14px;
    background: rgba(168,85,247,0.06);
    border: 1px solid rgba(168,85,247,0.2);
    border-radius: 12px; margin-bottom: 8px;
    cursor: pointer; transition: all 0.15s;
}
.vsfix-item:hover {
    background: rgba(168,85,247,0.15);
    border-color: rgba(168,85,247,0.5);
    transform: translateX(-3px);
}
.vsfix-item:active { transform: scale(0.98); }
.vsfix-item-icon {
    font-size: 24px; flex-shrink: 0;
    width: 40px; height: 40px;
    border-radius: 10px;
    background: rgba(255,215,0,0.1);
    display: flex; align-items: center; justify-content: center;
}
.vsfix-item-icon img {
    width: 100%; height: 100%;
    border-radius: 10px;
    object-fit: cover;
}
.vsfix-item-info { flex: 1; min-width: 0; }
.vsfix-item-name {
    color: #fff; font-weight: 900; font-size: 13px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.vsfix-item-sub {
    color: #888; font-size: 10px; margin-top: 2px;
}
.vsfix-loading {
    text-align: center; padding: 30px;
    color: #c084fc; font-size: 13px;
}
.vsfix-empty {
    text-align: center; padding: 30px 20px;
    color: #666; font-size: 12px;
}
.vsfix-search {
    display: flex; gap: 6px; margin-bottom: 12px;
}
.vsfix-search input {
    flex: 1; padding: 11px 14px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(168,85,247,0.4);
    border-radius: 10px;
    color: #fff; font-family: inherit; font-size: 13px;
    outline: none; text-align: right;
    box-sizing: border-box;
}
.vsfix-search input:focus { border-color: #c084fc; }
.vsfix-search button {
    padding: 11px 18px;
    border-radius: 10px; border: none;
    background: linear-gradient(135deg, #a855f7, #7c3aed);
    color: #fff; font-family: inherit;
    font-size: 13px; font-weight: 900; cursor: pointer;
}
.vsfix-current {
    background: rgba(255,215,0,0.08);
    border: 1px solid rgba(255,215,0,0.4);
    border-radius: 12px; padding: 10px;
    margin-bottom: 12px;
    display: flex; align-items: center; gap: 10px;
}
.vsfix-current-icon {
    font-size: 20px;
    width: 36px; height: 36px;
    border-radius: 50%;
    background: rgba(255,215,0,0.15);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
}
.vsfix-current-info { flex: 1; }
.vsfix-current-name { color: #ffd700; font-weight: 900; font-size: 13px; }
.vsfix-current-sub { color: #888; font-size: 10px; margin-top: 2px; }
.vsfix-play-btn {
    width: 36px; height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, #ffd700, #b8860b);
    border: none; color: #000;
    font-size: 14px; font-weight: 900;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    padding: 0;
    flex-shrink: 0;
}
        `;
        document.head.appendChild(s);
    })();

    /* ═══ Fetch current recording ═══ */
    async function fetchMyRecording() {
        var me = getMe();
        if (!me) return null;
        try {
            var snap = await db.ref('studio_recordings/' + me.uid).once('value');
            return snap.val();
        } catch (e) {
            console.warn('fetch recording:', e);
            return null;
        }
    }

    /* ═══ Preview current recording ═══ */
    function previewCurrentRecording(rec) {
        if (!rec || !rec.audio) return;
        try {
            var bin = atob(rec.audio);
            var bytes = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            var blob = new Blob([bytes], { type: rec.mime || 'audio/webm' });
            var url = URL.createObjectURL(blob);
            var audio = new Audio(url);
            audio.play().catch(function (e) { console.warn('play:', e); });
            audio.onended = function () { URL.revokeObjectURL(url); };
        } catch (e) { console.warn('preview:', e); }
    }

    /* ═══ Build Current Recording Banner ═══ */
    function buildCurrentBanner(rec) {
        var wrap = document.createElement('div');
        wrap.className = 'vsfix-current';

        var icon = document.createElement('div');
        icon.className = 'vsfix-current-icon';
        icon.textContent = '🎵';

        var info = document.createElement('div');
        info.className = 'vsfix-current-info';

        var dur = rec.duration || 0;
        var m = Math.floor(dur / 60), s = dur % 60;
        var durStr = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');

        info.innerHTML =
            '<div class="vsfix-current-name">🎙️ تسجيلك الحالي</div>' +
            '<div class="vsfix-current-sub">⏱️ ' + durStr + ' · 💾 ' + ((rec.size || 0) / 1024).toFixed(1) + ' KB</div>';

        var playBtn = document.createElement('button');
        playBtn.className = 'vsfix-play-btn';
        playBtn.type = 'button';
        playBtn.innerHTML = '▶️';
        playBtn.onclick = function (e) {
            e.stopPropagation();
            previewCurrentRecording(rec);
        };

        wrap.appendChild(icon);
        wrap.appendChild(info);
        wrap.appendChild(playBtn);
        return wrap;
    }

    /* ═══ ROOM PICKER MODAL ═══ */
    function ensureRoomPickerModal() {
        var m = document.getElementById('vsfix-room-picker');
        if (m) return m;
        m = document.createElement('div');
        m.id = 'vsfix-room-picker';
        m.className = 'vsfix-overlay';
        m.innerHTML =
            '<div class="vsfix-box">' +
                '<div class="vsfix-head">' +
                    '<h3>📤 اختر الغرفة للمشاركة</h3>' +
                    '<button type="button" class="vsfix-close" id="vsfix-rp-close">✕</button>' +
                '</div>' +
                '<div class="vsfix-body">' +
                    '<div class="vsfix-hint">سيُحذف التسجيل تلقائياً بعد ساعة من النشر</div>' +
                    '<div id="vsfix-rp-current"></div>' +
                    '<div id="vsfix-rp-list"><div class="vsfix-loading">⏳ جاري التحميل...</div></div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(m);
        m.querySelector('#vsfix-rp-close').onclick = function () { m.classList.remove('active'); };
        m.addEventListener('click', function (e) { if (e.target === m) m.classList.remove('active'); });
        return m;
    }

    async function openRoomPicker() {
        var me = getMe();
        if (!me) { toast('fa-user', '⚠️ سجل دخول'); return; }

        var rec = await fetchMyRecording();
        if (!rec || !rec.audio) {
            toast('fa-times', '⚠️ لا يوجد تسجيل');
            return;
        }

        var m = ensureRoomPickerModal();
        m.classList.add('active');

        // Current recording banner
        var currentWrap = m.querySelector('#vsfix-rp-current');
        currentWrap.innerHTML = '';
        currentWrap.appendChild(buildCurrentBanner(rec));

        // Build room list
        var listEl = m.querySelector('#vsfix-rp-list');
        listEl.innerHTML = '<div class="vsfix-loading">⏳</div>';

        try {
            var visible;
            if (typeof QAMAR !== 'undefined' && QAMAR.getVisibleRooms) {
                visible = QAMAR.getVisibleRooms(me);
            } else {
                visible = (typeof QAMAR !== 'undefined' && QAMAR.ROOMS) ? QAMAR.ROOMS : {};
            }

            var rooms = Object.values(visible).filter(function (r) {
                return r.id !== 'jail' && r.id !== 'bot_training';
            });

            if (rooms.length === 0) {
                listEl.innerHTML = '<div class="vsfix-empty">لا غرف متاحة</div>';
                return;
            }

            listEl.innerHTML = '';
            var currentRoom = getRoom();

            rooms.forEach(function (room) {
                var item = document.createElement('div');
                item.className = 'vsfix-item';

                var iconEl = document.createElement('div');
                iconEl.className = 'vsfix-item-icon';
                if (room.iconImage) {
                    var img = document.createElement('img');
                    img.src = room.iconImage;
                    img.onerror = function () { iconEl.textContent = room.icon || '🚪'; };
                    iconEl.appendChild(img);
                } else {
                    iconEl.textContent = room.icon || '🚪';
                }

                var info = document.createElement('div');
                info.className = 'vsfix-item-info';
                var currentLabel = (room.id === currentRoom) ? ' <span style="color:#84cc16;font-size:10px;">(الحالية)</span>' : '';
                info.innerHTML =
                    '<div class="vsfix-item-name">' + (room.name || room.id) + currentLabel + '</div>' +
                    '<div class="vsfix-item-sub">🚪 ' + room.id + '</div>';

                item.appendChild(iconEl);
                item.appendChild(info);

                item.onclick = function () {
                    m.classList.remove('active');
                    shareRecordingToRoom(room.id, rec, room);
                };

                listEl.appendChild(item);
            });

        } catch (e) {
            console.error('room picker:', e);
            listEl.innerHTML = '<div class="vsfix-empty" style="color:#ff6666;">⚠️ ' + e.message + '</div>';
        }
    }

    async function shareRecordingToRoom(roomId, rec, roomData) {
        var me = getMe();
        if (!me) return;
        var roomName = roomData ? (roomData.name || roomId) : roomId;
        toast('fa-spinner', '⏳ جاري النشر في ' + roomName + '...');

        try {
            var rid = db.ref('room_voice_msgs/' + roomId).push().key;
            await db.ref('room_voice_msgs/' + roomId + '/' + rid).set({
                audio: rec.audio,
                byUid: me.uid,
                byName: me.name || 'مستخدم',
                byAvatar: me.avatar || '',
                duration: rec.duration || 0,
                size: rec.size || 0,
                mime: rec.mime || 'audio/webm',
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                expiresAt: Date.now() + 3600000
            });
            toast('fa-check', '✅ نُشر في ' + roomName);
            log('shared to room', roomId);
        } catch (e) {
            console.error('share to room:', e);
            toast('fa-times', '⚠️ فشل: ' + (e.message || ''));
        }
    }

    /* ═══ USER PICKER MODAL ═══ */
    function ensureUserPickerModal() {
        var m = document.getElementById('vsfix-user-picker');
        if (m) return m;
        m = document.createElement('div');
        m.id = 'vsfix-user-picker';
        m.className = 'vsfix-overlay';
        m.innerHTML =
            '<div class="vsfix-box">' +
                '<div class="vsfix-head">' +
                    '<h3>💬 اختر المستخدم</h3>' +
                    '<button type="button" class="vsfix-close" id="vsfix-up-close">✕</button>' +
                '</div>' +
                '<div class="vsfix-body">' +
                    '<div class="vsfix-hint">⚠️ يعمل مرة واحدة فقط عند فتحه، ثم يُحذف نهائياً</div>' +
                    '<div id="vsfix-up-current"></div>' +
                    '<div class="vsfix-search">' +
                        '<input type="text" id="vsfix-up-search" placeholder="ابحث بالاسم أو الكود..." autocomplete="off">' +
                        '<button type="button" id="vsfix-up-search-btn">🔍</button>' +
                    '</div>' +
                    '<div id="vsfix-up-list"></div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(m);
        m.querySelector('#vsfix-up-close').onclick = function () { m.classList.remove('active'); };
        m.addEventListener('click', function (e) { if (e.target === m) m.classList.remove('active'); });

        var inp = m.querySelector('#vsfix-up-search');
        var btn = m.querySelector('#vsfix-up-search-btn');
        inp.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); doUserSearch(inp.value.trim()); }
        });
        btn.onclick = function () { doUserSearch(inp.value.trim()); };

        return m;
    }

    var _upCacheRec = null;

    async function openUserPicker() {
        var me = getMe();
        if (!me) { toast('fa-user', '⚠️ سجل دخول'); return; }

        var rec = await fetchMyRecording();
        if (!rec || !rec.audio) {
            toast('fa-times', '⚠️ لا يوجد تسجيل');
            return;
        }

        _upCacheRec = rec;

        var m = ensureUserPickerModal();
        m.classList.add('active');

        var currentWrap = m.querySelector('#vsfix-up-current');
        currentWrap.innerHTML = '';
        currentWrap.appendChild(buildCurrentBanner(rec));

        // Reset search
        m.querySelector('#vsfix-up-search').value = '';
        m.querySelector('#vsfix-up-list').innerHTML = '<div class="vsfix-hint" style="margin-top:12px;">🔍 اكتب حرفين على الأقل للبحث</div>';
    }

    async function doUserSearch(q) {
        if (!q || q.length < 2) {
            toast('fa-info-circle', 'اكتب حرفين على الأقل');
            return;
        }
        var listEl = document.getElementById('vsfix-up-list');
        if (!listEl) return;
        listEl.innerHTML = '<div class="vsfix-loading">⏳ جاري البحث...</div>';

        try {
            var snap = await db.ref('users').limitToLast(500).once('value');
            var all = snap.val() || {};
            var ql = q.toLowerCase();
            var me = getMe() || {};
            var matches = [];

            Object.keys(all).forEach(function (uid) {
                if (uid === me.uid) return;
                var u = all[uid] || {};
                if (u.isBot) return;
                var name = (u.name || '').toLowerCase();
                var code = (u.code || '').toLowerCase();
                if (name.indexOf(ql) !== -1 || code.indexOf(ql) !== -1) {
                    matches.push({ uid: uid, name: u.name, avatar: u.avatar, code: u.code, rank: u.rank });
                }
            });

            if (matches.length === 0) {
                listEl.innerHTML = '<div class="vsfix-empty">لا نتائج</div>';
                return;
            }

            listEl.innerHTML = '';
            matches.slice(0, 20).forEach(function (u) {
                var item = document.createElement('div');
                item.className = 'vsfix-item';

                var iconEl = document.createElement('div');
                iconEl.className = 'vsfix-item-icon';
                var img = document.createElement('img');
                img.src = u.avatar || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(u.name || 'U') + '&background=333&color=fff');
                img.onerror = function () { this.src = 'https://ui-avatars.com/api/?name=U&background=333&color=fff'; };
                iconEl.appendChild(img);

                var info = document.createElement('div');
                info.className = 'vsfix-item-info';
                info.innerHTML =
                    '<div class="vsfix-item-name">' + (u.name || 'مجهول') + '</div>' +
                    '<div class="vsfix-item-sub">🔑 ' + (u.code || '—') + ' · ' + (u.rank || 'User') + '</div>';

                item.appendChild(iconEl);
                item.appendChild(info);

                item.onclick = function () {
                    var m = document.getElementById('vsfix-user-picker');
                    if (m) m.classList.remove('active');
                    sendRecordingToUser(u.uid, u.name, _upCacheRec);
                };

                listEl.appendChild(item);
            });
        } catch (e) {
            console.error('search:', e);
            listEl.innerHTML = '<div class="vsfix-empty" style="color:#ff6666;">⚠️ ' + e.message + '</div>';
        }
    }

    async function sendRecordingToUser(uid, name, rec) {
        var me = getMe();
        if (!me) return;
        if (!uid) return;
        if (!rec || !rec.audio) { toast('fa-times', '⚠️ لا يوجد تسجيل'); return; }

        toast('fa-spinner', '⏳ جاري الإرسال إلى ' + (name || 'المستخدم') + '...');

        try {
            var rid = db.ref('pm_voice_msgs/' + uid).push().key;
            await db.ref('pm_voice_msgs/' + uid + '/' + rid).set({
                audio: rec.audio,
                fromUid: me.uid,
                fromName: me.name || 'مستخدم',
                fromAvatar: me.avatar || '',
                duration: rec.duration || 0,
                size: rec.size || 0,
                mime: rec.mime || 'audio/webm',
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                viewed: false
            });
            toast('fa-check', '✅ أُرسل إلى ' + (name || 'المستخدم'));
            log('sent pm voice to', uid.substring(0, 6));
        } catch (e) {
            console.error('send pm:', e);
            toast('fa-times', '⚠️ فشل: ' + (e.message || ''));
        }
    }

    /* ═══ HOOK BUTTONS ═══ */
    function hookButtons() {
        var shareRoomBtn = document.getElementById('vx-act-share-room');
        var sharePmBtn = document.getElementById('vx-act-share-pm');

        if (shareRoomBtn && !shareRoomBtn.__vsfix) {
            shareRoomBtn.__vsfix = true;
            shareRoomBtn.onclick = function (e) {
                e.preventDefault();
                e.stopPropagation();
                openRoomPicker();
            };
            log('room button hooked');
        }

        if (sharePmBtn && !sharePmBtn.__vsfix) {
            sharePmBtn.__vsfix = true;
            sharePmBtn.onclick = function (e) {
                e.preventDefault();
                e.stopPropagation();
                openUserPicker();
            };
            log('pm button hooked');
        }
    }

    /* ═══ OBSERVER — يراقب ظهور الاستوديو ═══ */
    function startObserver() {
        // فحص دوري (بسيط وحاسم)
        setInterval(hookButtons, 500);
        log('observer started');
    }

    /* ═══ INIT ═══ */
    function init() {
        var tries = 0;
        var t = setInterval(function () {
            tries++;
            if (typeof db !== 'undefined' && db && getMe()) {
                clearInterval(t);
                startObserver();
                log('✅ ready');
            }
            if (tries >= 60) clearInterval(t);
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('✅ voice-share-fix.js v1 loaded');
})();
