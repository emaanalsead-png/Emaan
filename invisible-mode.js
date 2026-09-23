// ==============================================
// invisible-mode.js v5
// ==============================================
// ✅ v5 (فوق v4):
//   1. قائمة المتواجدين: جلب 7 حقول خفيفة فقط
//      → كل مستخدم = 7 requests صغيرة بدل 1 request ضخم (20MB للملك)
//   2. Cache 15 ثانية لتجنب الطلبات المتكررة
//   3. باقي المنطق كما v4 بالضبط
// ✅ v4 (محفوظ):
//   1. لا تجلب 500 مستخدم — فقط المتصلين
//   2. الملك يرى الجميع، الملكة لا ترى المخفيين
// ==============================================

(function () {
    'use strict';
    if (window.__invisibleModeV5) return;
    window.__invisibleModeV5 = true;

    function getMe() { return (typeof getCurrentUser === 'function') ? getCurrentUser() : null; }
    function esc(s) { if (s == null) return ''; return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
    function rankBadge(r) {
        var m = { 'King': '👑', 'Queen': '👸', 'Master Owner': '🌟', 'Room Owner': '🛡️', 'Grand Owner': '💎', 'Owner': '🏆', 'Super Admin': '🎖️', 'Admin': '🛠️', 'Premium': '💠', 'User': '👤' };
        return m[r] || '👤';
    }
    function levelOf(u) {
        if (!u) return 0;
        if (typeof u.rankLevel === 'number') return u.rankLevel;
        if (typeof getRankLevel === 'function') return getRankLevel(u.rank) || 0;
        return 0;
    }
    function isKingUser(u) {
        if (!u) return false;
        if (u.rank === 'King') return true;
        return levelOf(u) >= 100;
    }
    function canInvisible() {
        var u = getMe();
        if (!u) return false;
        if (typeof can === 'function') return can(u, 'canInvisible');
        return isKingUser(u) || u.rank === 'Queen';
    }

    /* ═══ CSS ═══ */
    (function injectCSS() {
        if (document.getElementById('invisible-mode-css')) return;
        var s = document.createElement('style');
        s.id = 'invisible-mode-css';
        s.textContent = [
            '#invisible-btn { display: none; }',
            '#invisible-btn.active-invisible {',
            '    background: linear-gradient(135deg, rgba(168, 85, 247, 0.35), rgba(168, 85, 247, 0.15)) !important;',
            '    border-color: rgba(168, 85, 247, 0.8) !important;',
            '    color: #c084fc !important;',
            '    box-shadow: 0 0 12px rgba(168, 85, 247, 0.5) !important;',
            '}',

            '#users-sidebar .sidebar-content { padding: 10px !important; gap: 0 !important; }',
            '#users-sidebar .users-list-item {',
            '    display: flex; align-items: center; gap: 12px;',
            '    padding: 12px 14px; margin: 0;',
            '    background: rgba(255,255,255,0.04);',
            '    border: 1px solid rgba(255,215,0,0.15);',
            '    border-top: none;',
            '    border-bottom: 1px solid rgba(255,215,0,0.08);',
            '    cursor: pointer; transition: background 0.15s;',
            '    box-sizing: border-box;',
            '}',
            '#users-sidebar .users-list-item:first-child { border-top: 1px solid rgba(255,215,0,0.15); border-radius: 12px 12px 0 0; }',
            '#users-sidebar .users-list-item:last-child { border-bottom: 1px solid rgba(255,215,0,0.15); border-radius: 0 0 12px 12px; }',
            '#users-sidebar .users-list-item:only-child { border-radius: 12px; border-top: 1px solid rgba(255,215,0,0.15); }',
            '#users-sidebar .users-list-item:hover { background: rgba(255,215,0,0.1); }',
            '#users-sidebar .users-list-item:active { transform: scale(0.98); }',
            '#users-sidebar .uli-avatar { width: 42px; height: 42px; border-radius: 50%; border: 2px solid #ffd700; object-fit: cover; flex-shrink: 0; }',
            '#users-sidebar .uli-info { flex: 1; min-width: 0; }',
            '#users-sidebar .uli-name { color: #fff; font-weight: 900; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px; }',
            '#users-sidebar .uli-sub { color: #888; font-size: 10px; margin-top: 2px; }',
            '#users-sidebar .uli-dot { width: 10px; height: 10px; border-radius: 50%; background: #00e676; box-shadow: 0 0 8px #00e676; flex-shrink: 0; }',
            '#users-sidebar .uli-dot.invisible { background: #a855f7; box-shadow: 0 0 8px #a855f7; }',
            '#users-sidebar .uli-badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 9px; font-weight: 900; margin-top: 3px; }',
            '#users-sidebar .uli-badge.ghost { background: rgba(168, 85, 247, 0.2); color: #c084fc; }',
            '#users-sidebar .uli-loading { text-align: center; color: #888; padding: 20px; font-size: 12px; }'
        ].join('\n');
        document.head.appendChild(s);
    })();

    /* ═══ زر الوضع المخفي ═══ */
    function setupInvisibleButton() {
        var btn = document.getElementById('invisible-btn');
        if (!btn) { setTimeout(setupInvisibleButton, 1000); return; }

        if (!canInvisible()) {
            btn.style.display = 'none';
            return;
        }

        btn.style.display = 'flex';
        var user = getMe();
        if (!user || !user.uid) return;

        db.ref('users/' + user.uid + '/invisible').on('value', function (s) {
            var invis = s.val() === true;
            var icon = btn.querySelector('i');
            if (invis) {
                btn.classList.add('active-invisible');
                if (icon) icon.className = 'fas fa-eye-slash';
                btn.title = '👻 مخفي';
            } else {
                btn.classList.remove('active-invisible');
                if (icon) icon.className = 'fas fa-eye';
                btn.title = '👁️ اضغط للاختفاء';
            }
            if (typeof ChatState !== 'undefined') ChatState.invisibleMode = invis;
        });
    }

    /* ═══ قائمة المتواجدين — v5 ═══ */
    async function buildUsersSidebar() {
        var sb = document.getElementById('users-sidebar');
        if (!sb) {
            sb = document.createElement('div');
            sb.id = 'users-sidebar';
            sb.className = 'sidebar right-sidebar';
            sb.innerHTML =
                '<div class="sidebar-header">' +
                    '<h3><i class="fas fa-users"></i> المتواجدون</h3>' +
                    '<button type="button" class="sidebar-close" onclick="closeAllPanels()"><i class="fas fa-times"></i></button>' +
                '</div>' +
                '<div class="sidebar-content" id="users-list-content"></div>';
            document.body.appendChild(sb);
        }
        return sb;
    }

    /* ⭐ v5: حقول خفيفة + cache */
    const USERS_LIGHT_FIELDS = ['name', 'avatar', 'rank', 'rankLevel', 'invisible', 'isGuest', 'lastSeen'];
    const USERS_CACHE_TTL = 15000; // 15 ثانية
    var _usersListCache = { data: null, at: 0 };

    async function fetchOnlineUsers() {
        // Cache check
        if (_usersListCache.data && (Date.now() - _usersListCache.at) < USERS_CACHE_TTL) {
            return _usersListCache.data;
        }

        // 1. جلب presence فقط
        var presenceSnap = await db.ref('user_presence').once('value');
        var presence = presenceSnap.val() || {};
        var now = Date.now();

        // 2. فلترة: المتصلون فقط (آخر 2 دقيقة)
        var onlineUids = [];
        Object.keys(presence).forEach(function (uid) {
            var p = presence[uid];
            if (!p || p.state !== 'online') return;
            if ((now - (p.lastChanged || 0)) >= 120000) return;
            onlineUids.push(uid);
        });

        if (onlineUids.length === 0) {
            var emptyResult = { users: {}, presence: presence, onlineUids: [] };
            _usersListCache.data = emptyResult;
            _usersListCache.at = now;
            return emptyResult;
        }

        // ⭐ v5: جلب الحقول الخفيفة فقط — لا musicURL/video/cover
        var users = {};
        await Promise.all(onlineUids.map(async function (uid) {
            try {
                var fieldPromises = USERS_LIGHT_FIELDS.map(function (field) {
                    return db.ref('users/' + uid + '/' + field).once('value')
                        .then(function (s) { return { f: field, v: s.val() }; })
                        .catch(function () { return { f: field, v: null }; });
                });
                var results = await Promise.all(fieldPromises);
                var u = { uid: uid };
                results.forEach(function (r) {
                    if (r.v !== null && r.v !== undefined) u[r.f] = r.v;
                });
                users[uid] = u;
            } catch (e) {}
        }));

        var result = { users: users, presence: presence, onlineUids: onlineUids };
        _usersListCache.data = result;
        _usersListCache.at = now;
        return result;
    }

    async function openOnlineUsers() {
        if (typeof closeAllPanels === 'function') closeAllPanels();

        var sb = await buildUsersSidebar();
        sb.classList.add('open');
        var ov = document.getElementById('overlay');
        if (ov) ov.classList.add('show');

        var content = document.getElementById('users-list-content');
        if (content) content.innerHTML = '<div class="uli-loading">⏳ جاري التحميل...</div>';

        try {
            var result = await fetchOnlineUsers();
            var users = result.users;
            var presence = result.presence;
            var onlineUids = result.onlineUids;
            var me = getMe() || {};

            var iAmKing = isKingUser(me);

            // 4. بناء قائمة قابلة للعرض
            var online = [];
            onlineUids.forEach(function (uid) {
                var u = users[uid];
                if (!u) return;
                online.push({ uid: uid, user: u, presence: presence[uid] });
            });

            // 5. فلترة حسب الوضع المخفي
            var visible = online.filter(function (item) {
                var u = item.user;

                if (item.uid === me.uid) return true;

                var invis = u.invisible === true;
                if (!invis) return true;

                if (iAmKing) return true;

                return false;
            });

            // 6. ترتيب
            var RANK_ORDER = { 'King': 100, 'Queen': 95, 'Master Owner': 90, 'Room Owner': 85, 'Grand Owner': 80, 'Owner': 75, 'Super Admin': 70, 'Admin': 65, 'Premium': 60, 'User': 50 };
            visible.sort(function (a, b) {
                var la = RANK_ORDER[a.user.rank] || levelOf(a.user) || 0;
                var lb = RANK_ORDER[b.user.rank] || levelOf(b.user) || 0;
                if (la !== lb) return lb - la;
                return (b.user.lastSeen || 0) - (a.user.lastSeen || 0);
            });

            // 7. عرض
            content.innerHTML = '';
            if (visible.length === 0) {
                content.innerHTML = '<div style="text-align:center;color:#888;padding:30px;font-size:12px;">لا يوجد متواجدون</div>';
                return;
            }

            var counter = document.createElement('div');
            counter.style.cssText = 'text-align:center;color:#ffd700;font-size:11px;font-weight:900;padding:6px 0 10px;';
            counter.textContent = '🟢 ' + visible.length + ' متواجدون';
            content.appendChild(counter);

            visible.forEach(function (item) {
                var u = item.user;
                var p = item.presence;
                var isInvisible = u.invisible === true;
                var isMe = item.uid === me.uid;

                var el = document.createElement('div');
                el.className = 'users-list-item';

                var img = document.createElement('img');
                img.className = 'uli-avatar';
                img.src = u.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.name || 'U') + '&background=333&color=fff';
                img.onerror = function () { img.src = 'https://ui-avatars.com/api/?name=U&background=333&color=fff'; };

                var info = document.createElement('div');
                info.className = 'uli-info';

                var nameRow = document.createElement('div');
                nameRow.className = 'uli-name';
                nameRow.innerHTML = rankBadge(u.rank) + ' ' + esc(u.name || 'مجهول') + (isMe ? ' <span style="color:#84cc16;font-size:10px;">(أنت)</span>' : '');

                var sub = document.createElement('div');
                sub.className = 'uli-sub';
                var roomName = (p.room && typeof QAMAR !== 'undefined' && QAMAR.ROOMS[p.room]) ? QAMAR.ROOMS[p.room].name : (p.room || '—');
                sub.textContent = '📌 ' + roomName;

                info.appendChild(nameRow);
                info.appendChild(sub);

                if (isInvisible) {
                    var badge = document.createElement('span');
                    badge.className = 'uli-badge ghost';
                    badge.textContent = '👻 مخفي';
                    info.appendChild(badge);
                }

                var dot = document.createElement('span');
                dot.className = 'uli-dot' + (isInvisible ? ' invisible' : '');

                el.appendChild(img);
                el.appendChild(info);
                el.appendChild(dot);

                el.onclick = function () {
                    if (typeof closeAllPanels === 'function') closeAllPanels();
                    if (typeof openUserProfile === 'function') openUserProfile(item.uid, u.name);
                };

                content.appendChild(el);
            });

        } catch (e) {
            console.error('👻 users-list error:', e);
            if (content) content.innerHTML = '<div style="text-align:center;color:#ff6666;padding:20px;font-size:12px;">⚠️ فشل التحميل</div>';
        }
    }

    window.showOnlineUsers = openOnlineUsers;

    /* ═══ Override closeAllPanels ═══ */
    var _origClose = window.closeAllPanels;
    window.closeAllPanels = function () {
        if (typeof _origClose === 'function') { try { _origClose(); } catch (e) {} }
        var us = document.getElementById('users-sidebar');
        if (us) us.classList.remove('open');
        var ov = document.getElementById('overlay');
        if (ov) ov.classList.remove('show');
    };

    /* ═══ Init ═══ */
    function init() {
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            if (document.getElementById('invisible-btn') &&
                typeof getCurrentUser === 'function' &&
                getCurrentUser()) {
                clearInterval(t);
                setupInvisibleButton();
                console.log('✅ invisible-mode.js v5: ready');
            }
            if (attempts >= 25) clearInterval(t);
        }, 400);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

    console.log('✅ invisible-mode.js v5 loaded — optimized users list (7 fields + cache)');
})();
