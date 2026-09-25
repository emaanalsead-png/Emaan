// ==============================================
// pm-monitor.js v3 (TEST) — مراقبة الخاص
// ==============================================
// ✅ v3:
//   1. openFor(targetUid) — فتح مباشر على عضو من البروفايل
//   2. open() — فتح من غرفة الملك (قائمة الأعضاء)
//   3. عرض المحذوفات: originalText + originalAttachment
//   4. استرجاع فردي (يبقي original* كنسخة احتياطية)
//   5. حذف فردي للمحذوفة (remove كامل)
//   6. حذف كل المحذوفات لعضو-مرسل
//   7. حذف المحادثة كاملة (من الطرفين)
//   8. King only — تحقق صريح
//   9. كل عملية حذف → audit_log
//   10. زر 💬 في غرفة الملك (header) + openFor من البروفايل
// ==============================================

(function () {
    'use strict';
    if (window.__pmMonitorV3) return;
    window.__pmMonitorV3 = true;

    /* ══════════════════════════════════════════════ */
    /* State                                          */
    /* ══════════════════════════════════════════════ */
    var PM = {
        currentMember: null,   // { uid, name, avatar }
        currentOther: null,    // { uid, name, avatar }
        screen: 'members',     // 'members' | 'conversations' | 'messages'
        membersCache: []
    };

    /* ══════════════════════════════════════════════ */
    /* Helpers                                        */
    /* ══════════════════════════════════════════════ */
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

    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    }

    function timeAgo(ts) {
        if (!ts) return '';
        var s = Math.floor((Date.now() - ts) / 1000);
        if (s < 60) return 'الآن';
        var m = Math.floor(s / 60); if (m < 60) return 'قبل ' + m + 'د';
        var h = Math.floor(m / 60); if (h < 24) return 'قبل ' + h + 'س';
        return 'قبل ' + Math.floor(h / 24) + 'ي';
    }

    function fmtTime(ts) {
        if (!ts) return '—';
        try {
            return new Date(ts).toLocaleString('ar-EG', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (e) { return '—'; }
    }

    function toast(icon, msg) {
        if (typeof showToast === 'function') showToast(icon, msg);
    }

    function logAudit(type, data) {
        try {
            var me = getMe();
            db.ref('audit_log').push(Object.assign({
                type: type,
                byUid: me ? me.uid : null,
                byName: me ? me.name : 'King',
                at: firebase.database.ServerValue.TIMESTAMP
            }, data || {})).catch(function () {});
        } catch (e) {}
    }

    /* ══════════════════════════════════════════════ */
    /* CSS                                            */
    /* ══════════════════════════════════════════════ */
    (function injectCSS() {
        if (document.getElementById('pm-monitor-v3-css')) return;
        var s = document.createElement('style');
        s.id = 'pm-monitor-v3-css';
        s.textContent = `
#pm-monitor-modal {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.92);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    z-index: 9999999;
    display: none;
    justify-content: center;
    align-items: center;
    direction: rtl;
    font-family: Cairo, sans-serif;
    padding: 10px;
}
#pm-monitor-modal.active { display: flex; }

#pmm-box {
    background: #0a0616;
    border: 2px solid #a855f7;
    border-radius: 18px;
    width: 100%;
    max-width: 540px;
    height: 92vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.9), 0 0 40px rgba(168,85,247,0.4);
}

#pmm-header {
    padding: 14px;
    border-bottom: 1px solid rgba(168,85,247,0.3);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: linear-gradient(135deg, rgba(124,58,237,0.2), rgba(168,85,247,0.1));
    flex-shrink: 0;
}
#pmm-header h3 {
    color: #c084fc;
    margin: 0;
    font-size: 15px;
    font-weight: 900;
    display: flex;
    align-items: center;
    gap: 8px;
}
#pmm-header h3 .pmm-back-btn {
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(168,85,247,0.3);
    color: #c084fc;
    padding: 4px 10px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 900;
    cursor: pointer;
    font-family: inherit;
    display: none;
}
#pmm-header h3 .pmm-back-btn.show { display: inline-block; }

#pmm-close {
    background: rgba(255,68,68,0.2);
    border: 1px solid rgba(255,68,68,0.5);
    color: #ff7777;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 14px;
    font-weight: 900;
    padding: 0;
}

#pmm-search-wrap {
    padding: 10px;
    border-bottom: 1px solid rgba(168,85,247,0.2);
    flex-shrink: 0;
}
#pmm-search {
    width: 100%;
    padding: 10px 14px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(168,85,247,0.4);
    border-radius: 10px;
    color: #fff;
    font-family: inherit;
    font-size: 13px;
    outline: none;
    text-align: right;
    box-sizing: border-box;
}
#pmm-search:focus { border-color: #c084fc; }

#pmm-body {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
    scrollbar-width: thin;
    scrollbar-color: rgba(168,85,247,0.4) transparent;
}
#pmm-body::-webkit-scrollbar { width: 5px; }
#pmm-body::-webkit-scrollbar-thumb {
    background: rgba(168,85,247,0.4);
    border-radius: 5px;
}

/* ── Rows (members / conversations) ── */
.pmm-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    background: rgba(168,85,247,0.06);
    border: 1px solid rgba(168,85,247,0.2);
    border-radius: 10px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.15s;
}
.pmm-row:hover { background: rgba(168,85,247,0.15); }
.pmm-row:active { transform: scale(0.99); }

.pmm-row img {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    border: 2px solid #a855f7;
    object-fit: cover;
    flex-shrink: 0;
    background: #333;
}
.pmm-row-info {
    flex: 1;
    min-width: 0;
}
.pmm-row-name {
    color: #fff;
    font-weight: 900;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.pmm-row-sub {
    color: #888;
    font-size: 10px;
    margin-top: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.pmm-row-count {
    color: #c084fc;
    font-size: 10px;
    font-weight: 900;
    flex-shrink: 0;
    text-align: left;
}
.pmm-row-badge-del {
    color: #ff7777;
    font-size: 10px;
    font-weight: 900;
    margin-top: 2px;
}

/* ── Message bubble ── */
.pmm-msg {
    padding: 10px 12px;
    border-radius: 10px;
    margin-bottom: 8px;
    max-width: 90%;
    position: relative;
    word-break: break-word;
    font-size: 12px;
    line-height: 1.5;
}
.pmm-msg.sent {
    background: linear-gradient(135deg,#7c3aed,#a855f7);
    color: #fff;
    margin-left: auto;
}
.pmm-msg.received {
    background: rgba(255,255,255,0.08);
    color: #fff;
    border: 1px solid rgba(255,255,255,0.1);
    margin-right: auto;
}
.pmm-msg.deleted {
    background: rgba(239,68,68,0.15) !important;
    border: 1px solid rgba(239,68,68,0.5) !important;
    color: #ffcccc !important;
}
.pmm-msg-meta {
    font-size: 9px;
    opacity: 0.8;
    margin-bottom: 4px;
    font-weight: 900;
}
.pmm-msg-time {
    font-size: 9px;
    opacity: 0.65;
    margin-top: 5px;
}
.pmm-msg-deleted-badge {
    color: #ff8888;
    font-size: 9px;
    font-weight: 900;
    margin-top: 4px;
}
.pmm-msg-attach {
    margin-top: 6px;
    border-radius: 8px;
    overflow: hidden;
    max-width: 100%;
}
.pmm-msg-attach img,
.pmm-msg-attach video {
    max-width: 100%;
    max-height: 200px;
    display: block;
    border-radius: 8px;
}
.pmm-msg-attach audio {
    width: 100%;
    max-width: 240px;
}
.pmm-msg-actions {
    display: flex;
    gap: 6px;
    margin-top: 8px;
    flex-wrap: wrap;
}
.pmm-btn-sm {
    padding: 5px 10px;
    border-radius: 6px;
    border: none;
    font-family: inherit;
    font-size: 10px;
    font-weight: 900;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.pmm-btn-sm.restore { background: rgba(34,197,94,0.25); color: #4ade80; border: 1px solid rgba(34,197,94,0.6); }
.pmm-btn-sm.delete  { background: rgba(239,68,68,0.25); color: #ff7777; border: 1px solid rgba(239,68,68,0.6); }

/* ── Action bar (top of messages) ── */
.pmm-actionbar {
    display: flex;
    gap: 6px;
    padding: 10px;
    border-bottom: 1px solid rgba(168,85,247,0.2);
    flex-shrink: 0;
    background: rgba(0,0,0,0.3);
    flex-wrap: wrap;
}
.pmm-actionbar button {
    flex: 1;
    min-width: 120px;
    padding: 10px;
    border-radius: 10px;
    border: none;
    font-family: inherit;
    font-size: 11px;
    font-weight: 900;
    cursor: pointer;
}
.pmm-actionbar .ab-del-deleted {
    background: rgba(255,152,0,0.2);
    border: 1px solid rgba(255,152,0,0.6);
    color: #ffbb66;
}
.pmm-actionbar .ab-del-all {
    background: rgba(239,68,68,0.2);
    border: 1px solid rgba(239,68,68,0.6);
    color: #ff7777;
}

/* ── Loading / Empty ── */
.pmm-loading {
    text-align: center;
    color: #c084fc;
    padding: 30px;
    font-size: 13px;
}
.pmm-empty {
    text-align: center;
    color: #666;
    padding: 30px;
    font-size: 12px;
}

/* ── Stats ── */
.pmm-stats {
    display: flex;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(168,85,247,0.08);
    border-radius: 8px;
    margin-bottom: 10px;
    font-size: 11px;
    font-weight: 900;
    justify-content: center;
    flex-wrap: wrap;
}
.pmm-stats span { color: #c084fc; }
.pmm-stats .s-del { color: #ff7777; }
.pmm-stats .s-act { color: #4ade80; }
        `;
        document.head.appendChild(s);
    })();

    /* ══════════════════════════════════════════════ */
    /* Modal                                          */
    /* ══════════════════════════════════════════════ */
    function ensureModal() {
        var m = document.getElementById('pm-monitor-modal');
        if (m) return m;

        m = document.createElement('div');
        m.id = 'pm-monitor-modal';
        m.innerHTML =
            '<div id="pmm-box">' +
                '<div id="pmm-header">' +
                    '<h3>' +
                        '<button id="pmm-back" class="pmm-back-btn" type="button">← رجوع</button>' +
                        '<span id="pmm-title">💬 مراقبة المحادثات</span>' +
                    '</h3>' +
                    '<button id="pmm-close" type="button">✕</button>' +
                '</div>' +
                '<div id="pmm-search-wrap">' +
                    '<input type="text" id="pmm-search" placeholder="🔍 بحث بالاسم أو الكود..." autocomplete="off">' +
                '</div>' +
                '<div id="pmm-actionbar" class="pmm-actionbar" style="display:none;"></div>' +
                '<div id="pmm-body"></div>' +
            '</div>';

        document.body.appendChild(m);

        m.querySelector('#pmm-close').onclick = close;
        m.querySelector('#pmm-back').onclick = function () {
            if (PM.screen === 'messages') showConversations(PM.currentMember);
            else if (PM.screen === 'conversations') showMembers();
        };

        return m;
    }

    function showModal() {
        var m = ensureModal();
        m.classList.add('active');
    }

    function close() {
        var m = document.getElementById('pm-monitor-modal');
        if (m) m.classList.remove('active');
        PM.currentMember = null;
        PM.currentOther = null;
        PM.screen = 'members';
        PM.membersCache = [];
    }

    function setTitle(t) {
        var el = document.getElementById('pmm-title');
        if (el) el.textContent = t;
    }

    function setBackVisible(show) {
        var b = document.getElementById('pmm-back');
        if (b) {
            if (show) b.classList.add('show');
            else b.classList.remove('show');
        }
    }

    function setSearchVisible(show, placeholder) {
        var w = document.getElementById('pmm-search-wrap');
        var s = document.getElementById('pmm-search');
        if (w) w.style.display = show ? 'block' : 'none';
        if (s) {
            s.value = '';
            if (placeholder) s.placeholder = placeholder;
        }
    }

    function setActionBar(html) {
        var ab = document.getElementById('pmm-actionbar');
        if (!ab) return;
        if (html) {
            ab.innerHTML = html;
            ab.style.display = 'flex';
        } else {
            ab.innerHTML = '';
            ab.style.display = 'none';
        }
    }

    /* ══════════════════════════════════════════════ */
    /* Screen 1 — Members List                        */
    /* ══════════════════════════════════════════════ */
    async function showMembers() {
        if (!isKing()) { toast('fa-lock', 'للملك فقط'); close(); return; }

        PM.screen = 'members';
        PM.currentMember = null;
        PM.currentOther = null;
        setTitle('💬 مراقبة المحادثات');
        setBackVisible(false);
        setActionBar(null);
        setSearchVisible(true, '🔍 بحث بالاسم أو الكود...');

        var body = document.getElementById('pmm-body');
        body.innerHTML = '<div class="pmm-loading">⏳ جاري التحميل...</div>';

        try {
            var snap = await db.ref('users').limitToLast(500).once('value');
            var all = snap.val() || {};
            var users = Object.keys(all).map(function (uid) {
                var u = all[uid] || {};
                u.uid = uid;
                return u;
            }).filter(function (u) { return !u.isBot; });

            users.sort(function (a, b) { return (b.lastSeen || 0) - (a.lastSeen || 0); });
            PM.membersCache = users;

            renderMembers('');
        } catch (e) {
            console.error('showMembers error:', e);
            body.innerHTML = '<div class="pmm-empty">⚠️ فشل التحميل: ' + esc(e.message) + '</div>';
        }

        var search = document.getElementById('pmm-search');
        if (search && !search.__bound) {
            search.__bound = true;
            search.oninput = function () {
                if (PM.screen === 'members') renderMembers(this.value.trim());
            };
        }
    }

    function renderMembers(query) {
        var body = document.getElementById('pmm-body');
        if (!body) return;

        var users = PM.membersCache || [];
        if (query) {
            var q = query.toLowerCase();
            users = users.filter(function (u) {
                var name = (u.name || '').toLowerCase();
                var code = (u.code || '').toLowerCase();
                return name.indexOf(q) !== -1 || code.indexOf(q) !== -1;
            });
        }

        body.innerHTML = '';

        var cnt = document.createElement('div');
        cnt.style.cssText = 'text-align:center;color:#a855f7;font-size:11px;font-weight:900;padding:6px 0 10px;';
        cnt.textContent = '👥 ' + users.length + ' عضو';
        body.appendChild(cnt);

        if (!users.length) {
            body.innerHTML += '<div class="pmm-empty">لا يوجد أعضاء</div>';
            return;
        }

        users.forEach(function (u) {
            var row = document.createElement('div');
            row.className = 'pmm-row';

            var img = document.createElement('img');
            img.src = u.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.name || 'U') + '&background=333&color=fff';
            img.onerror = function () { this.src = 'https://ui-avatars.com/api/?name=U&background=333&color=fff'; };

            var info = document.createElement('div');
            info.className = 'pmm-row-info';
            info.innerHTML =
                '<div class="pmm-row-name">' + esc(u.name || 'مجهول') + '</div>' +
                '<div class="pmm-row-sub">' + esc(u.code || '—') + ' · ' + timeAgo(u.lastSeen) + '</div>';

            row.appendChild(img);
            row.appendChild(info);
            row.onclick = function () { showConversations(u); };
            body.appendChild(row);
        });
    }

    /* ══════════════════════════════════════════════ */
    /* Screen 2 — Conversations of a member           */
    /* ══════════════════════════════════════════════ */
    async function showConversations(member) {
        if (!isKing()) { toast('fa-lock', 'للملك فقط'); return; }
        if (!member || !member.uid) return;

        PM.screen = 'conversations';
        PM.currentMember = member;
        PM.currentOther = null;

        setTitle('📨 محادثات: ' + (member.name || ''));
        setBackVisible(true);
        setActionBar(null);
        setSearchVisible(false);

        var body = document.getElementById('pmm-body');
        body.innerHTML = '<div class="pmm-loading">⏳ جاري التحميل...</div>';

        try {
            var snap = await db.ref('user_private_messages/' + member.uid).once('value');
            var data = snap.val() || {};
            var otherUids = Object.keys(data);

            body.innerHTML = '';

            if (!otherUids.length) {
                body.innerHTML = '<div class="pmm-empty">لا توجد محادثات لهذا العضو</div>';
                return;
            }

            /* لكل مرسل: نجهز بطاقة */
            var rows = [];
            for (var i = 0; i < otherUids.length; i++) {
                var otherUid = otherUids[i];
                /* تجاهل bot_guardian كطرف أساسي؟ لا، نعرضه */
                var msgs = data[otherUid] || {};
                var msgKeys = Object.keys(msgs);
                var count = msgKeys.length;
                var deletedCount = 0;
                var lastTime = 0;
                var lastText = '';

                msgKeys.forEach(function (k) {
                    var m = msgs[k] || {};
                    if (m.deleted === true) deletedCount++;
                    if ((m.time || 0) > lastTime) {
                        lastTime = m.time || 0;
                        lastText = m.deleted ? '🚫 محذوفة' : (m.text || '📎 مرفق');
                    }
                });

                /* نجيب بيانات المرسل */
                var otherName = 'مجهول';
                var otherAvatar = 'https://ui-avatars.com/api/?name=U&background=333&color=fff';
                if (otherUid === 'bot_guardian') {
                    otherName = '🚔 السجان';
                    otherAvatar = 'https://ui-avatars.com/api/?name=%D8%A7%D9%84%D8%B3%D8%AC%D8%A7%D9%86&background=111&color=ff4444&bold=true&size=64';
                } else {
                    try {
                        var uSnap = await db.ref('users/' + otherUid).once('value');
                        var u = uSnap.val() || {};
                        otherName = u.name || 'مجهول';
                        otherAvatar = u.avatar || otherAvatar;
                    } catch (e) {}
                }

                rows.push({
                    otherUid: otherUid,
                    otherName: otherName,
                    otherAvatar: otherAvatar,
                    count: count,
                    deletedCount: deletedCount,
                    lastTime: lastTime,
                    lastText: lastText
                });
            }

            rows.sort(function (a, b) { return (b.lastTime || 0) - (a.lastTime || 0); });

            rows.forEach(function (r) {
                var row = document.createElement('div');
                row.className = 'pmm-row';

                var img = document.createElement('img');
                img.src = r.otherAvatar;

                var info = document.createElement('div');
                info.className = 'pmm-row-info';
                info.innerHTML =
                    '<div class="pmm-row-name">' + esc(r.otherName) + '</div>' +
                    '<div class="pmm-row-sub">' + esc(r.lastText) + '</div>' +
                    (r.deletedCount > 0 ? '<div class="pmm-row-badge-del">🚫 ' + r.deletedCount + ' محذوفة</div>' : '');

                var cnt = document.createElement('div');
                cnt.className = 'pmm-row-count';
                cnt.innerHTML = r.count + ' رسالة<br>' + timeAgo(r.lastTime);

                row.appendChild(img);
                row.appendChild(info);
                row.appendChild(cnt);
                row.onclick = function () { showMessages(PM.currentMember, r); };
                body.appendChild(row);
            });

        } catch (e) {
            console.error('showConversations error:', e);
            body.innerHTML = '<div class="pmm-empty">⚠️ فشل: ' + esc(e.message) + '</div>';
        }
    }

    /* ══════════════════════════════════════════════ */
    /* Screen 3 — Messages                            */
    /* ══════════════════════════════════════════════ */
    async function showMessages(member, other) {
        if (!isKing()) { toast('fa-lock', 'للملك فقط'); return; }
        if (!member || !other) return;

        PM.screen = 'messages';
        PM.currentOther = other;

        setTitle('💬 ' + (member.name || '') + ' ↔ ' + (other.otherName || ''));
        setBackVisible(true);
        setSearchVisible(false);
        setActionBar(
            '<button class="ab-del-deleted" id="pmm-ab-del-deleted">🗑️ حذف كل المحذوفات</button>' +
            '<button class="ab-del-all" id="pmm-ab-del-all">☠️ حذف المحادثة كاملة</button>'
        );

        /* ربط الأزرار */
        setTimeout(function () {
            var bd = document.getElementById('pmm-ab-del-deleted');
            var ba = document.getElementById('pmm-ab-del-all');
            if (bd) bd.onclick = function () { deleteAllDeleted(member, other); };
            if (ba) ba.onclick = function () { deleteFullConversation(member, other); };
        }, 30);

        var body = document.getElementById('pmm-body');
        body.innerHTML = '<div class="pmm-loading">⏳ جاري التحميل...</div>';

        try {
            var snap = await db.ref('user_private_messages/' + member.uid + '/' + other.otherUid).once('value');
            var msgs = snap.val() || {};

            var arr = Object.keys(msgs).map(function (k) {
                var m = msgs[k];
                m._key = k;
                return m;
            }).sort(function (a, b) {
                var ta = (typeof a.time === 'number') ? a.time : 0;
                var tb = (typeof b.time === 'number') ? b.time : 0;
                if (ta !== tb) return ta - tb;
                return (a._key < b._key) ? -1 : 1;
            });

            body.innerHTML = '';

            /* إحصائيات */
            var delCount = arr.filter(function (m) { return m.deleted === true; }).length;
            var activeCount = arr.length - delCount;
            var stats = document.createElement('div');
            stats.className = 'pmm-stats';
            stats.innerHTML =
                '<span>📨 ' + arr.length + ' رسالة</span>' +
                '<span class="s-act">✅ ' + activeCount + ' نشطة</span>' +
                '<span class="s-del">🚫 ' + delCount + ' محذوفة</span>';
            body.appendChild(stats);

            if (!arr.length) {
                body.innerHTML += '<div class="pmm-empty">لا توجد رسائل</div>';
                return;
            }

            arr.forEach(function (m) {
                var el = buildMessageEl(member, other, m);
                body.appendChild(el);
            });

        } catch (e) {
            console.error('showMessages error:', e);
            body.innerHTML = '<div class="pmm-empty">⚠️ فشل: ' + esc(e.message) + '</div>';
        }
    }

    function buildMessageEl(member, other, m) {
        var isDeleted = m.deleted === true;
        var hasOriginal = isDeleted && (!!m.originalText || !!m.originalAttachment);
        var displayText = isDeleted
            ? (m.originalText || '[النص الأصلي غير محفوظ]')
            : (m.text || '');
        var displayAtt = isDeleted
            ? (m.originalAttachment || null)
            : (m.attachment || null);

        var fromMember = m.fromUid === member.uid;

        var el = document.createElement('div');
        el.className = 'pmm-msg ' + (fromMember ? 'sent' : 'received') + (isDeleted ? ' deleted' : '');

        /* Header */
        var meta = document.createElement('div');
        meta.className = 'pmm-msg-meta';
        meta.textContent = (fromMember ? (member.name || '—') : (other.otherName || '—'));
        el.appendChild(meta);

        /* Text */
        if (displayText) {
            var t = document.createElement('div');
            t.style.cssText = 'word-break:break-word;';
            if (isDeleted) {
                t.style.textDecoration = 'line-through';
                t.style.textDecorationColor = 'rgba(255,68,68,0.6)';
            }
            t.textContent = displayText;
            el.appendChild(t);
        }

        /* Attachment */
        if (displayAtt && displayAtt.url) {
            var att = document.createElement('div');
            att.className = 'pmm-msg-attach';
            var type = displayAtt.type || 'image';
            if (type === 'image') {
                var im = document.createElement('img');
                im.src = displayAtt.url;
                im.loading = 'lazy';
                im.onclick = function () { window.open(displayAtt.url, '_blank'); };
                att.appendChild(im);
            } else if (type === 'video') {
                var vi = document.createElement('video');
                vi.src = displayAtt.url;
                vi.controls = true;
                att.appendChild(vi);
            } else if (type === 'audio') {
                var au = document.createElement('audio');
                au.src = displayAtt.url;
                au.controls = true;
                att.appendChild(au);
            }
            el.appendChild(att);
        }

        /* Deleted badge */
        if (isDeleted) {
            var badge = document.createElement('div');
            badge.className = 'pmm-msg-deleted-badge';
            badge.textContent = hasOriginal
                ? '🚫 محذوفة — بحوزتك نسخة'
                : '🚫 محذوفة — لا نسخة احتياطية';
            el.appendChild(badge);
        }

        /* Time */
        var tm = document.createElement('div');
        tm.className = 'pmm-msg-time';
        tm.textContent = fmtTime(m.time);
        el.appendChild(tm);

        /* Actions */
        var actions = document.createElement('div');
        actions.className = 'pmm-msg-actions';

        if (isDeleted && hasOriginal) {
            var rb = document.createElement('button');
            rb.className = 'pmm-btn-sm restore';
            rb.innerHTML = '♻️ استرجاع';
            rb.onclick = function () { restoreMessage(member, other, m._key); };
            actions.appendChild(rb);
        }

        var db_ = document.createElement('button');
        db_.className = 'pmm-btn-sm delete';
        db_.innerHTML = '🗑️ حذف';
        db_.onclick = function () { deleteMessage(member, other, m._key, isDeleted); };
        actions.appendChild(db_);

        el.appendChild(actions);

        return el;
    }

    /* ══════════════════════════════════════════════ */
    /* Actions — Restore                              */
    /* ══════════════════════════════════════════════ */
    async function restoreMessage(member, other, msgKey) {
        if (!isKing()) return;
        if (!confirm('♻️ استرجاع هذه الرسالة؟\n\nستظهر مرة أخرى للطرفين.')) return;

        try {
            var snap = await db.ref('user_private_messages/' + member.uid + '/' + other.otherUid + '/' + msgKey).once('value');
            var m = snap.val() || {};
            if (!m.originalText && !m.originalAttachment) {
                alert('⚠️ لا توجد نسخة احتياطية لهذه الرسالة.');
                return;
            }

            var patch = {
                deleted: false,
                text: m.originalText || '',
                attachment: m.originalAttachment || null,
                restoredAt: Date.now(),
                restoredBy: 'king'
                /* نُبقي originalText + originalAttachment كنسخة احتياطية */
            };

            await Promise.all([
                db.ref('user_private_messages/' + member.uid + '/' + other.otherUid + '/' + msgKey).update(patch),
                db.ref('user_private_messages/' + other.otherUid + '/' + member.uid + '/' + msgKey).update(patch)
            ]);

            logAudit('pm_restore', {
                targetUid: member.uid,
                targetName: member.name,
                otherUid: other.otherUid,
                otherName: other.otherName,
                msgKey: msgKey
            });

            toast('fa-check', '✅ تم الاسترجاع');
            showMessages(member, other);
        } catch (e) {
            console.error('restoreMessage error:', e);
            alert('⚠️ فشل الاسترجاع: ' + e.message);
        }
    }

    /* ══════════════════════════════════════════════ */
    /* Actions — Delete single message                */
    /* ══════════════════════════════════════════════ */
    async function deleteMessage(member, other, msgKey, isDeleted) {
        if (!isKing()) return;
        var warn = isDeleted
            ? '🗑️ حذف هذه الرسالة المحذوفة نهائياً؟\n\n(ستُحذف من الطرفين — لا يمكن التراجع)'
            : '🗑️ حذف هذه الرسالة نهائياً من المحادثة؟\n\n(ستُحذف من الطرفين — لا يمكن التراجع)';
        if (!confirm(warn)) return;

        try {
            await Promise.all([
                db.ref('user_private_messages/' + member.uid + '/' + other.otherUid + '/' + msgKey).remove(),
                db.ref('user_private_messages/' + other.otherUid + '/' + member.uid + '/' + msgKey).remove()
            ]);

            logAudit('pm_delete_msg', {
                targetUid: member.uid,
                targetName: member.name,
                otherUid: other.otherUid,
                otherName: other.otherName,
                msgKey: msgKey,
                wasDeleted: !!isDeleted
            });

            toast('fa-check', '✅ تم الحذف');
            showMessages(member, other);
        } catch (e) {
            console.error('deleteMessage error:', e);
            toast('fa-times', '⚠️ فشل: ' + e.message);
        }
    }

    /* ══════════════════════════════════════════════ */
    /* Actions — Delete all deleted (for pair)        */
    /* ══════════════════════════════════════════════ */
    async function deleteAllDeleted(member, other) {
        if (!isKing()) return;
        if (!confirm('🗑️ حذف كل الرسائل المحذوفة بين ' + (member.name || '') + ' و ' + (other.otherName || '') + '؟\n\n(لن تُحذف الرسائل النشطة)\n\n⚠️ لا يمكن التراجع!')) return;

        try {
            var snap = await db.ref('user_private_messages/' + member.uid + '/' + other.otherUid).once('value');
            var msgs = snap.val() || {};
            var toDel = Object.keys(msgs).filter(function (k) { return msgs[k] && msgs[k].deleted === true; });

            if (!toDel.length) {
                toast('fa-info-circle', 'لا توجد رسائل محذوفة');
                return;
            }

            var promises = [];
            toDel.forEach(function (k) {
                promises.push(db.ref('user_private_messages/' + member.uid + '/' + other.otherUid + '/' + k).remove());
                promises.push(db.ref('user_private_messages/' + other.otherUid + '/' + member.uid + '/' + k).remove());
            });

            await Promise.all(promises);

            logAudit('pm_delete_all_deleted', {
                targetUid: member.uid,
                targetName: member.name,
                otherUid: other.otherUid,
                otherName: other.otherName,
                count: toDel.length
            });

            toast('fa-check', '✅ تم حذف ' + toDel.length + ' رسالة محذوفة');
            showMessages(member, other);
        } catch (e) {
            console.error('deleteAllDeleted error:', e);
            toast('fa-times', '⚠️ فشل: ' + e.message);
        }
    }

    /* ══════════════════════════════════════════════ */
    /* Actions — Delete full conversation             */
    /* ══════════════════════════════════════════════ */
    async function deleteFullConversation(member, other) {
        if (!isKing()) return;

        var c1 = confirm('☠️ حذف المحادثة كاملة بين ' + (member.name || '') + ' و ' + (other.otherName || '') + '؟\n\n⚠️ سيُحذف كل شيء (نشط + محذوف) من الطرفين.\n\nلا يمكن التراجع!');
        if (!c1) return;

        var word = prompt('للتأكيد النهائي، اكتب كلمة: حذف', '');
        if (!word || word.trim() !== 'حذف') {
            toast('fa-times', '❌ أُلغيت العملية');
            return;
        }

        try {
            await Promise.all([
                db.ref('user_private_messages/' + member.uid + '/' + other.otherUid).remove(),
                db.ref('user_private_messages/' + other.otherUid + '/' + member.uid).remove(),
                db.ref('user_private_chats/' + member.uid + '/' + other.otherUid).remove().catch(function () {}),
                db.ref('user_private_chats/' + other.otherUid + '/' + member.uid).remove().catch(function () {})
            ]);

            logAudit('pm_delete_full_conversation', {
                targetUid: member.uid,
                targetName: member.name,
                otherUid: other.otherUid,
                otherName: other.otherName
            });

            toast('fa-check', '✅ حُذفت المحادثة كاملة');
            showConversations(member);
        } catch (e) {
            console.error('deleteFullConversation error:', e);
            toast('fa-times', '⚠️ فشل: ' + e.message);
        }
    }

    /* ══════════════════════════════════════════════ */
    /* Public API                                     */
    /* ══════════════════════════════════════════════ */

    /* open() — من غرفة الملك (قائمة الأعضاء) */
    function open() {
        if (!isKing()) { toast('fa-lock', 'للملك فقط'); return; }
        showModal();
        showMembers();
    }

    /* openFor(targetUid) — من بروفايل العضو (فتح مباشر على محادثاته) */
    async function openFor(targetUid) {
        if (!isKing()) { toast('fa-lock', 'للملك فقط'); return; }
        if (!targetUid) { toast('fa-times', '⚠️ معرّف غير صحيح'); return; }

        showModal();
        var body = document.getElementById('pmm-body');
        body.innerHTML = '<div class="pmm-loading">⏳ جاري تحميل بيانات العضو...</div>';
        setTitle('📨 محادثات العضو');
        setBackVisible(true);
        setActionBar(null);
        setSearchVisible(false);

        try {
            var snap = await db.ref('users/' + targetUid).once('value');
            var u = snap.val();
            if (!u) {
                body.innerHTML = '<div class="pmm-empty">⚠️ العضو غير موجود</div>';
                return;
            }
            u.uid = targetUid;
            /* نروح مباشرة لشاشة المحادثات — لكن رجوع يرجع للأعضاء */
            showConversations(u);
        } catch (e) {
            console.error('openFor error:', e);
            body.innerHTML = '<div class="pmm-empty">⚠️ ' + esc(e.message) + '</div>';
        }
    }

    /* ══════════════════════════════════════════════ */
    /* King Room Button Injection                     */
    /* ══════════════════════════════════════════════ */
    function injectButton() {
        if (!isKing()) return;
        var header = document.getElementById('kr-header');
        if (!header) return;
        if (document.getElementById('kr-pm-monitor-btn')) return;

        var btn = document.createElement('button');
        btn.id = 'kr-pm-monitor-btn';
        btn.type = 'button';
        btn.textContent = '💬 المحادثات';
        btn.style.cssText = 'background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border:none;padding:8px 14px;border-radius:10px;font-family:inherit;font-weight:900;font-size:12px;cursor:pointer;margin-right:8px;box-shadow:0 4px 12px rgba(168,85,247,0.4);';
        btn.onclick = open;

        var exitBtn = document.getElementById('kr-exit-btn');
        if (exitBtn && exitBtn.parentNode) {
            exitBtn.parentNode.insertBefore(btn, exitBtn);
        } else {
            header.appendChild(btn);
        }
    }

    setInterval(function () {
        var krView = document.getElementById('king-room-view');
        if (krView && krView.classList.contains('active')) {
            injectButton();
        }
    }, 500);

    /* ══════════════════════════════════════════════ */
    /* Export                                         */
    /* ══════════════════════════════════════════════ */
    window.PmMonitor = {
        open: open,
        openFor: openFor,
        close: close,
        version: 3
    };

    console.log('📨 pm-monitor.js v3 (TEST) loaded — openFor + originalAttachment + full delete');
})();
