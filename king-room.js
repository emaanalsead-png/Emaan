// ==============================================
// king-room.js v10 (TEST) — الملكات 4 + السجان + Lazy Load + المكرّرة + إدارة بان
// ==============================================
// ✅ v10 (فوق v9):
//   1. تبويب 🚨 الحسابات المكرّرة (multi_account_alerts)
//   2. تبويب 🛡️ إدارة البان (banned_devices + banned_ips)
//   3. استخدام DeviceGuard.ban / unban (فك الحظر)
//   4. زر حظر جهاز + زر حظر IP يدوياً
//   5. __krSetTab — للفتح المباشر من index.html (reports-btn)
//   6. audit_log لكل عملية
// ✅ v9 (محفوظ بالكامل):
//   1. تبويب 👸 الملكات (4 + صلاحيات مخصصة)
//   2. تبويب 🚔 السجان
//   3. المستخدمون: متصل/خامل + 10 + infinite
//   4. ترقية/تخفيض من قائمة إجراءات المستخدم
//   5. Lazy-load لكل تبويب
//   6. أرقام الملكات لا تظهر إلا في تبويب الملكات
// ==============================================

(function () {
    'use strict';
    if (window.__kingRoomV10) return;
    window.__kingRoomV10 = true;

    var KR = {
        open: false,
        currentTab: 'overview',
        usersCache: {},
        usersList: [],
        filter: { query: '', status: 'all' },
        usersPage: {
            online: { loaded: 0, hasMore: true, loading: false, cache: [] },
            offline: { loaded: 0, hasMore: true, loading: false, cache: [] }
        },
        currentUsersMode: 'online',
        roomsSettings: {},
        tempIconImage: null,
        tempBgImage: null,
        queenSearchResults: null,
        _punishmentFilter: 'jailed',
        _reportFilter: 'new',
        _guardianTab: 'badwords',
        _multiAccountFilter: 'pending',
        _banTab: 'devices'
    };

    var USERS_PAGE_SIZE = 10;

    function getMe() { return (typeof getCurrentUser === 'function') ? getCurrentUser() : null; }
    function isKing() { var u = getMe(); return !!(u && u.rank === 'King'); }
    function isRoyal() { var u = getMe(); return !!(u && (u.rank === 'King' || u.rank === 'Queen')); }
    function myLevel() { var u = getMe(); if (!u) return 0; return (typeof getRankLevel === 'function') ? getRankLevel(u.rank) : (u.rankLevel || 0); }
    function canDo(p) { var u = getMe(); if (!u || typeof can !== 'function') return false; return can(u, p); }
    function esc(s) { if (s == null) return ''; return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
    function timeAgo(ts) {
        if (!ts) return '—';
        var s = Math.floor((Date.now() - ts) / 1000);
        if (s < 60) return 'الآن';
        var m = Math.floor(s / 60); if (m < 60) return 'قبل ' + m + 'د';
        var h = Math.floor(m / 60); if (h < 24) return 'قبل ' + h + 'س';
        var d = Math.floor(h / 24); return 'قبل ' + d + 'ي';
    }
    function toast(i, m) { if (typeof showToast === 'function') showToast(i, m); }
    function rankBadge(r) {
        var m = { 'King': '👑', 'Queen': '👸', 'Master Owner': '🌟', 'Room Owner': '🛡️', 'Grand Owner': '💎', 'Owner': '🏆', 'Super Admin': '🎖️', 'Admin': '🛠️', 'Premium': '💠', 'User': '👤' };
        return m[r] || '👤';
    }
    function logAudit(type, data) {
        try {
            var me = getMe();
            db.ref('audit_log').push(Object.assign({
                type: type,
                byUid: me ? me.uid : null,
                byName: me ? me.name : 'admin',
                at: firebase.database.ServerValue.TIMESTAMP
            }, data || {})).catch(function () {});
        } catch (e) {}
    }

    function getQueenLabel(queenOrder) {
        if (!queenOrder) return 'الملكة الأولى';
        if (typeof QAMAR !== 'undefined' && QAMAR.QUEEN_ORDERS && QAMAR.QUEEN_ORDERS[queenOrder]) {
            return QAMAR.QUEEN_ORDERS[queenOrder].label;
        }
        var labels = { 1: 'الملكة الأولى', 2: 'الملكة الثانية', 3: 'الملكة الثالثة', 4: 'الملكة الرابعة' };
        return labels[queenOrder] || ('الملكة رقم ' + queenOrder);
    }

    function fileToBase64(file, maxSize, quality) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function (e) {
                var img = new Image();
                img.onload = function () {
                    try {
                        var canvas = document.createElement('canvas');
                        var w = img.width, h = img.height;
                        if (w > h) { if (w > maxSize) { h = h * maxSize / w; w = maxSize; } }
                        else { if (h > maxSize) { w = w * maxSize / h; h = maxSize; } }
                        canvas.width = w; canvas.height = h;
                        var ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);
                        resolve(canvas.toDataURL('image/jpeg', quality || 0.85));
                    } catch (err) { reject(err); }
                };
                img.onerror = function () { reject(new Error('فشل تحميل الصورة')); };
                img.src = e.target.result;
            };
            reader.onerror = function () { reject(new Error('فشل قراءة الملف')); };
            reader.readAsDataURL(file);
        });
    }

    async function findUserByInput(input) {
        if (!input) return null;
        input = input.trim();
        if (!input) return null;

        if (/^[A-Za-z0-9]{20,}$/.test(input)) {
            var s1 = await db.ref('users/' + input).once('value');
            if (s1.exists()) return { uid: input, data: s1.val() };
        }

        var codeMatch = input.match(/([A-Z0-9]{2,3})·([A-Z0-9]{3,4})/i);
        if (codeMatch) {
            var code = codeMatch[0].toUpperCase();
            var s2 = await db.ref('user_codes/' + code).once('value');
            var uid = s2.val();
            if (uid) {
                var u2 = await db.ref('users/' + uid).once('value');
                if (u2.exists()) return { uid: uid, data: u2.val() };
            }
        }

        if (input.indexOf('@') !== -1) {
            var allSnap = await db.ref('users').limitToLast(500).once('value');
            var all = allSnap.val() || {};
            var found = null;
            Object.keys(all).forEach(function (k) {
                if (all[k].email && all[k].email.toLowerCase() === input.toLowerCase()) {
                    found = { uid: k, data: all[k] };
                }
            });
            if (found) return found;
        }

        var s3 = await db.ref('user_names/' + input).once('value');
        var uid3 = s3.val();
        if (uid3) {
            var u3 = await db.ref('users/' + uid3).once('value');
            if (u3.exists()) return { uid: uid3, data: u3.val() };
        }

        var allSnap2 = await db.ref('users').limitToLast(500).once('value');
        var all2 = allSnap2.val() || {};
        var q = input.toLowerCase().replace(/\s+/g, '');
        var matches = [];
        Object.keys(all2).forEach(function (k) {
            var u = all2[k];
            if (!u || !u.name) return;
            var n = u.name.toLowerCase().replace(/\s+/g, '');
            if (n.indexOf(q) !== -1) matches.push({ uid: k, data: u });
        });
        if (matches.length === 1) return matches[0];
        if (matches.length > 1) return { multiple: true, matches: matches };
        return null;
    }

    /* ═══ Modal ═══ */
    function ensureModal() {
        var m = document.getElementById('king-room-view');
        if (m) return m;
        m = document.createElement('div');
        m.id = 'king-room-view';
        m.innerHTML = '<div id="kr-header"><div id="kr-title">👑 غرفة الملك</div><button id="kr-exit-btn" type="button">✕ خروج</button></div><div id="kr-tabs"></div><div id="kr-body"></div>';
        document.body.appendChild(m);
        document.getElementById('kr-exit-btn').onclick = closeRoom;
        return m;
    }

    function renderTabs() {
        var tabs = document.getElementById('kr-tabs');
        if (!tabs) return;
        var lvl = myLevel();
        var k = isKing();
        var list = [
            { id: 'overview', label: '📊 نظرة' },
            { id: 'users', label: '👥 المستخدمون' }
        ];
        if (canDo('canPromote') || canDo('canDemote') || k) list.push({ id: 'ranks', label: '🎖️ الرتب' });
        if (k) list.push({ id: 'queens', label: '👸 الملكات' });
        if (canDo('canWarn') || canDo('canJail') || canDo('canBan')) list.push({ id: 'punishments', label: '🚫 المعاقبون' });
        if (lvl >= 90) list.push({ id: 'reports', label: '🚨 الإبلاغات' });
        if (k) list.push({ id: 'multiAccount', label: '🚨 المكرّرة' });
        if (lvl >= 90) list.push({ id: 'bans', label: '🛡️ البان' });
        if ((canDo('canCreateRooms') || canDo('canEditRooms')) && lvl >= 80) list.push({ id: 'rooms', label: '🚪 الغرف' });
        list.push({ id: 'bots', label: '🤖 البوتات' });
        if (k) list.push({ id: 'guardian', label: '🚔 السجان' });
        if (k) list.push({ id: 'welcome', label: '🚪 الترحيب' });
        if (lvl >= 90) list.push({ id: 'alerts', label: '📢 تنبيه' });
        if (k) list.push({ id: 'settings', label: '⚙️ إعدادات' });

        if (!list.some(function (x) { return x.id === KR.currentTab; })) KR.currentTab = 'overview';

        tabs.innerHTML = '';
        list.forEach(function (t) {
            var b = document.createElement('button');
            b.className = 'kr-tab' + (KR.currentTab === t.id ? ' active' : '');
            b.textContent = t.label;
            b.onclick = function () { KR.currentTab = t.id; renderTabs(); renderTab(); };
            tabs.appendChild(b);
        });
    }

    function renderTab() {
        var body = document.getElementById('kr-body');
        if (!body) return;
        body.innerHTML = '';
        if (KR.currentTab === 'overview') return renderOverview(body);
        if (KR.currentTab === 'users') return renderUsers(body);
        if (KR.currentTab === 'ranks') return renderRanks(body);
        if (KR.currentTab === 'queens') return renderQueens(body);
        if (KR.currentTab === 'punishments') return renderPunishments(body);
        if (KR.currentTab === 'reports') return renderReports(body);
        if (KR.currentTab === 'multiAccount') return renderMultiAccount(body);
        if (KR.currentTab === 'bans') return renderBans(body);
        if (KR.currentTab === 'rooms') return renderRooms(body);
        if (KR.currentTab === 'bots') return renderBots(body);
        if (KR.currentTab === 'guardian') return renderGuardian(body);
        if (KR.currentTab === 'welcome') return renderWelcomeTab(body);
        if (KR.currentTab === 'alerts') return renderAlerts(body);
        if (KR.currentTab === 'settings') return renderSettings(body);
    }

    /* ═══ Overview ═══ */
    async function renderOverview(body) {
        body.innerHTML = '<div class="kr-loading">⏳</div>';
        try {
            var rs = await Promise.all([
                db.ref('users').limitToLast(500).once('value'),
                db.ref('user_presence').once('value'),
                db.ref('multi_account_alerts').limitToLast(20).once('value').catch(function () { return null; }),
                db.ref('banned_devices').limitToLast(20).once('value').catch(function () { return null; })
            ]);
            var users = rs[0].val() || {}, presence = rs[1].val() || {};
            var multiAcc = (rs[2] && rs[2].val()) || {};
            var bannedDev = (rs[3] && rs[3].val()) || {};
            var allU = Object.values(users), now = Date.now();
            var total = allU.length, online = 0, jailed = 0, banned = 0;
            allU.forEach(function (u) {
                if (u.isJailed && u.jailUntil && now < u.jailUntil) jailed++;
                if (u.isBanned && u.bannedUntil && now < u.bannedUntil) banned++;
            });
            Object.keys(presence).forEach(function (uid) {
                var p = presence[uid];
                if (p && p.state === 'online' && (now - (p.lastChanged || 0)) < 120000) online++;
            });
            var multiCount = Object.keys(multiAcc).length;
            var bannedDevCount = Object.keys(bannedDev).length;

            body.innerHTML =
                '<div class="kr-stats">' +
                    '<div class="kr-stat"><div class="kr-stat-val">' + total + '</div><div class="kr-stat-lbl">👥 إجمالي</div></div>' +
                    '<div class="kr-stat"><div class="kr-stat-val" style="color:#84cc16;">' + online + '</div><div class="kr-stat-lbl">🟢 متصل</div></div>' +
                    '<div class="kr-stat"><div class="kr-stat-val" style="color:#ff9800;">' + jailed + '</div><div class="kr-stat-lbl">⛓️ مسجون</div></div>' +
                    '<div class="kr-stat"><div class="kr-stat-val" style="color:#ff4444;">' + banned + '</div><div class="kr-stat-lbl">🚪 محظور</div></div>' +
                '</div>' +
                '<div class="kr-stats" style="grid-template-columns: repeat(2, 1fr);">' +
                    '<div class="kr-stat" style="border-color:rgba(255,68,68,0.5);"><div class="kr-stat-val" style="color:#ff4444;">' + multiCount + '</div><div class="kr-stat-lbl">🚨 محاولات مكرّرة</div></div>' +
                    '<div class="kr-stat" style="border-color:rgba(168,85,247,0.5);"><div class="kr-stat-val" style="color:#c084fc;">' + bannedDevCount + '</div><div class="kr-stat-lbl">🛡️ أجهزة محظورة</div></div>' +
                '</div>' +
                '<button class="kr-btn kr-btn-outline kr-btn-block" id="kr-refresh" style="margin-bottom:12px;">🔄 تحديث</button>';
            document.getElementById('kr-refresh').onclick = function () { renderOverview(body); };

            if (online > 0) {
                var oc = document.createElement('div');
                oc.className = 'kr-card';
                oc.innerHTML = '<div class="kr-card-title">🟢 المتصلون (' + online + ')</div>';
                Object.keys(presence).forEach(function (uid) {
                    var p = presence[uid];
                    if (!p || p.state !== 'online' || (now - (p.lastChanged || 0)) >= 120000) return;
                    var u = users[uid]; if (!u) return;
                    var r = document.createElement('div');
                    r.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 0;font-size:12px;cursor:pointer;';
                    r.innerHTML = '<img src="' + esc(u.avatar || 'https://ui-avatars.com/api/?name=U') + '" style="width:26px;height:26px;border-radius:50%;border:1px solid #ffd700;">' +
                        '<span style="color:#fff;font-weight:700;flex:1;">' + esc(u.name) + '</span>' +
                        '<span style="color:#888;font-size:10px;">📌 ' + esc(p.room || '—') + '</span>';
                    r.onclick = function () { openUserProfile(u.uid || uid, u.name); };
                    oc.appendChild(r);
                });
                body.appendChild(oc);
            }

            try {
                var sc = await db.ref('bot_data/quiz/scores').limitToLast(100).once('value');
                var scores = sc.val() || {};
                var ents = Object.keys(scores).map(function (uid) { return { uid: uid, score: scores[uid] || 0 }; })
                    .sort(function (a, b) { return b.score - a.score; }).slice(0, 5);
                if (ents.length) {
                    var tc = document.createElement('div');
                    tc.className = 'kr-card';
                    tc.innerHTML = '<div class="kr-card-title">🏆 أفضل 5</div>';
                    ents.forEach(function (e, i) {
                        var u = users[e.uid] || {};
                        var m = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i];
                        var r = document.createElement('div');
                        r.style.cssText = 'display:flex;justify-content:space-between;padding:5px 0;font-size:12px;';
                        r.innerHTML = '<span style="color:#fff;">' + m + ' ' + esc(u.name || 'مجهول') + '</span><span style="color:#ffd700;font-weight:900;">' + e.score + '</span>';
                        tc.appendChild(r);
                    });
                    body.appendChild(tc);
                }
            } catch (e) {}
        } catch (e) { body.innerHTML = '<div class="kr-empty">❌ ' + esc(e.message) + '</div>'; }
    }

    /* ═══ Users — متصل/خامل + 10 per page + infinite scroll ═══ */
    async function renderUsers(body) {
        body.innerHTML = '<div class="kr-loading">⏳ جاري التحميل...</div>';
        try {
            var rs = await Promise.all([
                db.ref('users').limitToLast(500).once('value'),
                db.ref('user_presence').once('value')
            ]);
            var users = rs[0].val() || {};
            var presence = rs[1].val() || {};
            var now = Date.now();

            var allUsers = Object.keys(users).map(function (uid) {
                var u = users[uid] || {};
                u.uid = uid;
                var p = presence[uid] || {};
                u._presence = p;
                u._isOnline = (p.state === 'online' && (now - (p.lastChanged || 0)) < 120000);
                return u;
            });

            KR.usersCache = users;
            KR.usersList = allUsers;
            KR._presenceMap = presence;

            buildUsersUI(body);
        } catch (e) {
            body.innerHTML = '<div class="kr-empty">❌ ' + esc(e.message) + '</div>';
        }
    }

    function buildUsersUI(body) {
        var online = KR.usersList.filter(function (u) { return u._isOnline; });
        var offline = KR.usersList.filter(function (u) { return !u._isOnline; });

        var h = '';
        h += '<input class="kr-input" id="kr-search" placeholder="🔍 بحث..." style="margin-bottom:8px;" value="' + esc(KR.filter.query) + '">';
        h += '<div class="kr-filters" style="margin-bottom:10px;">';
        h += '<button class="kr-chip' + (KR.currentUsersMode === 'online' ? ' active' : '') + '" data-umode="online">🟢 متصل (' + online.length + ')</button>';
        h += '<button class="kr-chip' + (KR.currentUsersMode === 'offline' ? ' active' : '') + '" data-umode="offline">⚪ خامل (' + offline.length + ')</button>';
        h += '</div>';
        h += '<div class="kr-filters" id="kr-status-filters" style="display:' + (KR.currentUsersMode === 'offline' ? 'flex' : 'none') + ';">';
        [['all', 'الكل'], ['jailed', 'مسجون'], ['banned', 'محظور'], ['admins', 'إداريين'], ['queens', 'ملكات'], ['kings', 'ملوك']].forEach(function (f) {
            h += '<button class="kr-chip' + (KR.filter.status === f[0] ? ' active' : '') + '" data-s="' + f[0] + '">' + f[1] + '</button>';
        });
        h += '</div>';
        h += '<div id="kr-ulist"></div>';
        h += '<div id="kr-load-more" style="text-align:center;padding:14px;color:#ffd700;font-size:12px;display:none;">⏳ جاري التحميل...</div>';
        body.innerHTML = h;

        document.getElementById('kr-search').oninput = function () {
            KR.filter.query = this.value.trim();
            resetUsersPage();
            renderUList();
        };
        body.querySelectorAll('[data-umode]').forEach(function (c) {
            c.onclick = function () {
                KR.currentUsersMode = c.getAttribute('data-umode');
                KR.filter.status = 'all';
                resetUsersPage();
                buildUsersUI(body);
            };
        });
        body.querySelectorAll('[data-s]').forEach(function (c) {
            c.onclick = function () {
                KR.filter.status = c.getAttribute('data-s');
                body.querySelectorAll('[data-s]').forEach(function (x) { x.classList.remove('active'); });
                c.classList.add('active');
                resetUsersPage();
                renderUList();
            };
        });

        body.addEventListener('scroll', function () {
            var st = body.scrollTop + body.clientHeight;
            var sh = body.scrollHeight;
            if (sh - st < 300) loadMoreUsers();
        });

        resetUsersPage();
        renderUList();
    }

    function resetUsersPage() {
        var mode = KR.currentUsersMode;
        KR.usersPage[mode] = { loaded: 0, hasMore: true, loading: false, cache: getFilteredUsers() };
    }

    function getFilteredUsers() {
        var now = Date.now(), q = KR.filter.query.toLowerCase();
        var mode = KR.currentUsersMode;
        return KR.usersList.filter(function (u) {
            if (mode === 'online' && !u._isOnline) return false;
            if (mode === 'offline' && u._isOnline) return false;
            if (q) {
                var n = (u.name || '').toLowerCase(), c = (u.code || '').toLowerCase(), e = (u.email || '').toLowerCase();
                if (n.indexOf(q) === -1 && c.indexOf(q) === -1 && e.indexOf(q) === -1) return false;
            }
            if (mode === 'offline') {
                if (KR.filter.status === 'jailed') return u.isJailed && u.jailUntil && now < u.jailUntil;
                if (KR.filter.status === 'banned') return u.isBanned && u.bannedUntil && now < u.bannedUntil;
                if (KR.filter.status === 'admins') return (u.rankLevel || 0) >= 65;
                if (KR.filter.status === 'queens') return u.rank === 'Queen';
                if (KR.filter.status === 'kings') return u.rank === 'King';
            }
            return true;
        }).sort(function (a, b) { return (b.lastSeen || 0) - (a.lastSeen || 0); });
    }

    function renderUList() {
        var l = document.getElementById('kr-ulist'); if (!l) return;
        var mode = KR.currentUsersMode;
        var page = KR.usersPage[mode];
        if (!page.cache || page.loaded === 0) {
            page.cache = getFilteredUsers();
        }
        var toShow = page.cache.slice(0, page.loaded || USERS_PAGE_SIZE);
        if ((page.loaded || 0) === 0) {
            page.loaded = Math.min(USERS_PAGE_SIZE, page.cache.length);
            toShow = page.cache.slice(0, page.loaded);
        }
        page.hasMore = page.loaded < page.cache.length;

        l.innerHTML = '';
        if (toShow.length === 0) {
            l.innerHTML = '<div class="kr-empty">لا نتائج</div>';
            return;
        }
        toShow.forEach(function (u) { l.appendChild(buildUCard(u)); });

        var lm = document.getElementById('kr-load-more');
        if (lm) lm.style.display = 'none';
    }

    function loadMoreUsers() {
        var mode = KR.currentUsersMode;
        var page = KR.usersPage[mode];
        if (page.loading || !page.hasMore) return;
        page.loading = true;

        var lm = document.getElementById('kr-load-more');
        if (lm) lm.style.display = 'block';

        setTimeout(function () {
            var before = page.loaded;
            page.loaded = Math.min(page.loaded + USERS_PAGE_SIZE, page.cache.length);
            page.hasMore = page.loaded < page.cache.length;
            page.loading = false;

            var l = document.getElementById('kr-ulist');
            if (!l) return;
            for (var i = before; i < page.loaded; i++) {
                if (page.cache[i]) l.appendChild(buildUCard(page.cache[i]));
            }

            if (lm) lm.style.display = 'none';
        }, 250);
    }

    function buildUCard(u) {
        var now = Date.now();
        var row = document.createElement('div');
        row.className = 'kr-user';

        var badges = '';
        if (u.rank === 'King') badges += '<span class="kr-badge kr-badge-king">👑 ملك</span>';
        else if (u.rank === 'Queen') badges += '<span class="kr-badge kr-badge-queen">👸 ملكة</span>';
        if (u.isBanned && u.bannedUntil && now < u.bannedUntil) badges += '<span class="kr-badge kr-badge-ban">🚪 محظور</span>';
        if (u.isJailed && u.jailUntil && now < u.jailUntil) badges += '<span class="kr-badge kr-badge-jail">⛓️ مسجون</span>';
        if ((u.warnings || 0) > 0) badges += '<span class="kr-badge kr-badge-warn">⚠️ ' + u.warnings + '</span>';

        var av = document.createElement('img');
        av.className = 'kr-user-avatar';
        av.src = u.avatar || 'https://ui-avatars.com/api/?name=U';
        av.onerror = function () { this.src = 'https://ui-avatars.com/api/?name=U'; };
        av.style.cursor = 'pointer';
        av.onclick = function (e) { e.stopPropagation(); openUserProfile(u.uid, u.name); };

        var info = document.createElement('div');
        info.className = 'kr-user-info';
        info.style.cursor = 'pointer';
        info.onclick = function () { openUserProfile(u.uid, u.name); };
        info.innerHTML =
            '<div class="kr-user-name">' + rankBadge(u.rank) + ' ' + esc(u.name || 'مجهول') + '</div>' +
            '<div class="kr-user-sub">' + esc(u.code || '—') + ' · ' + timeAgo(u.lastSeen) + '</div>' +
            (badges ? '<div class="kr-user-badges">' + badges + '</div>' : '');

        var btn = document.createElement('button');
        btn.className = 'kr-icon-btn more';
        btn.type = 'button';
        btn.textContent = '⋮';
        btn.onclick = function (e) { e.stopPropagation(); openActions(u, this); };

        row.appendChild(av);
        row.appendChild(info);
        row.appendChild(btn);
        return row;
    }

    /* ═══ Action Menu ═══ */
    function ensureMenu() {
        var m = document.getElementById('kr-menu');
        if (m) return m;
        m = document.createElement('div');
        m.id = 'kr-menu';
        document.body.appendChild(m);
        document.addEventListener('click', function (e) { if (!m.contains(e.target)) m.classList.remove('open'); }, true);
        return m;
    }

    function openActions(user, anchor) {
        var me = getMe(); if (!me) return;
        var menu = ensureMenu();
        menu.innerHTML = '';

        var canPts = (typeof canGivePointsTo === 'function') ? canGivePointsTo(me, user) : false;
        var canP = typeof canPromoteTo === 'function' ? canPromoteTo(me, user, 'Room Owner') : false;
        var canD = typeof canDemoteUser === 'function' ? canDemoteUser(me, user) : false;
        var canB = typeof canBanUser === 'function' ? canBanUser(me, user) : false;
        var canJ = typeof canJailUser === 'function' ? canJailUser(me, user) : false;
        var canK = typeof canKickFromRoomUser === 'function' ? canKickFromRoomUser(me, user) : false;
        var canEdit = canDo('canEditAllProfiles');

        var h = '';
        h += '<div class="kr-menu-item" data-a="viewProfile">👤 عرض البروفايل</div>';
        if (canPts) h += '<div class="kr-menu-item" data-a="points">⭐ إهداء نقاط</div>';
        if (canP) h += '<div class="kr-menu-item" data-a="promote">🎖️ ترقية</div>';
        if (canD) h += '<div class="kr-menu-item" data-a="demote">📉 تخفيض</div>';
        if (canDo('canWarn')) h += '<div class="kr-menu-item" data-a="warn">⚠️ تحذير</div>';
        if (canJ) h += '<div class="kr-menu-item" data-a="jail">⛓️ سجن</div>';
        if (canK) h += '<div class="kr-menu-item" data-a="kick">🚪 طرد من الغرفة</div>';
        if (canB) h += '<div class="kr-menu-item danger" data-a="ban">🚫 حظر</div>';
        if (canEdit) h += '<div class="kr-menu-item" data-a="editProfile">🖼️ تعديل البروفايل</div>';

        if (isKing() && user.uid !== me.uid && user.rank !== 'King') {
            h += '<div class="kr-menu-item" style="border-top:1px solid rgba(255,215,0,0.15);margin-top:4px;padding-top:10px;" data-a="makeQueen">👸 تعيينها ملكة</div>';
        }
        if (isKing() && user.rank === 'Queen' && user.uid !== me.uid) {
            h += '<div class="kr-menu-item" data-a="editQueenPerms">⚙️ تعديل صلاحياتها</div>';
            h += '<div class="kr-menu-item" data-a="striprank">👑 إزالة الرتبة</div>';
        }
        if (isKing() && user.uid !== me.uid && user.rank === 'Master Owner') {
            h += '<div class="kr-menu-item" data-a="striprank">👑 إزالة الرتبة</div>';
        }
        if (isKing() && user.uid !== me.uid) {
            h += '<div class="kr-menu-item danger" data-a="deleteAccount">🗑️ حذف الحساب</div>';
        }

        if (!h) h = '<div class="kr-menu-item" style="color:#666;">لا إجراءات</div>';
        menu.innerHTML = h;
        menu.classList.add('open');

        var r = anchor.getBoundingClientRect();
        var w = 220, hh = menu.offsetHeight || 300;
        var L = Math.min(window.innerWidth - w - 10, Math.max(10, r.left - w + 40));
        var T = r.bottom + 6;
        if (T + hh > window.innerHeight - 10) T = r.top - hh - 6;
        menu.style.left = L + 'px';
        menu.style.top = T + 'px';

        menu.querySelectorAll('.kr-menu-item').forEach(function (it) {
            it.onclick = function (e) {
                e.stopPropagation();
                menu.classList.remove('open');
                var a = this.getAttribute('data-a');
                if (a) doAction(user, a);
            };
        });
    }

    function doAction(u, a) {
        if (a === 'viewProfile') return openUserProfile(u.uid, u.name);
        if (a === 'points') return askPoints(u);
        if (a === 'promote') return askPromote(u);
        if (a === 'demote') return doDemote(u);
        if (a === 'warn') return doWarn(u);
        if (a === 'jail') return askJail(u);
        if (a === 'kick') return doKick(u);
        if (a === 'ban') return askBan(u);
        if (a === 'editProfile') return toast('fa-user', 'قريباً');
        if (a === 'striprank') return stripRank(u);
        if (a === 'deleteAccount') return deleteAccount(u);
        if (a === 'makeQueen') return openQueenDialog(u, null);
        if (a === 'editQueenPerms') return openQueenDialog(u, u.queenOrder || 1);
    }

    /* ══════════════════════════════════════════════ */
    /* نافذة تعيين الملكة + الصلاحيات                 */
    /* ══════════════════════════════════════════════ */
    function openQueenDialog(user, currentOrder) {
        if (!isKing()) { toast('fa-lock', 'للملك فقط'); return; }

        var me = getMe();
        var isEdit = (currentOrder != null && user.rank === 'Queen');
        var title = isEdit ? ('⚙️ تعديل صلاحيات ' + (user.name || '')) : ('👸 تعيين ' + (user.name || '') + ' ملكة');

        var h = '';
        h += '<div style="margin-bottom:16px;">';
        h += '<label style="display:block;color:#ffd700;font-size:12px;font-weight:900;margin-bottom:8px;">ترتيب الملكة:</label>';
        h += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">';
        [1, 2, 3, 4].forEach(function (n) {
            var checked = (currentOrder || 1) === n;
            h += '<label style="display:flex;align-items:center;gap:8px;padding:10px;background:rgba(255,215,0,' + (checked ? '0.15' : '0.04') + ');border:2px solid rgba(255,215,0,' + (checked ? '0.6' : '0.15') + ');border-radius:10px;cursor:pointer;color:#fff;font-size:12px;font-weight:900;">';
            h += '<input type="radio" name="kr-queen-order" value="' + n + '" ' + (checked ? 'checked' : '') + ' style="accent-color:#ffd700;">';
            h += '<span>' + getQueenLabel(n) + '</span>';
            h += '</label>';
        });
        h += '</div>';
        h += '</div>';

        h += '<div style="border-top:1px dashed rgba(255,215,0,0.25);padding-top:14px;margin-bottom:10px;">';
        h += '<div style="color:#ffd700;font-size:13px;font-weight:900;margin-bottom:4px;">🎖️ صلاحيات إضافية</div>';
        h += '<div style="color:#aaa;font-size:11px;line-height:1.5;margin-bottom:12px;">';
        h += 'الصلاحيات الأساسية: <b style="color:#ffd700;">Master Owner</b> (تُمنح تلقائياً)<br>';
        h += 'ما تحددّه هنا <b style="color:#84cc16;">يُضاف فوق</b> الأساسية.';
        h += '</div>';

        var customPerms = user.customPermissions || {};
        var groups = (typeof QAMAR !== 'undefined' && QAMAR.CUSTOMIZABLE_PERMISSIONS) ? QAMAR.CUSTOMIZABLE_PERMISSIONS : [];

        groups.forEach(function (group) {
            h += '<div style="margin-bottom:14px;">';
            h += '<div style="color:#ffd700;font-size:11px;font-weight:900;padding:6px 8px;background:rgba(255,215,0,0.08);border-radius:6px;margin-bottom:8px;">' + esc(group.group) + '</div>';
            h += '<div style="display:flex;flex-direction:column;gap:6px;">';
            group.items.forEach(function (item) {
                var checked = customPerms[item.key] === true;
                h += '<label style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,215,0,' + (checked ? '0.5' : '0.12') + ');border-radius:8px;cursor:pointer;color:#ddd;font-size:12px;">';
                h += '<input type="checkbox" class="kr-queen-perm" data-perm="' + esc(item.key) + '" ' + (checked ? 'checked' : '') + ' style="width:16px;height:16px;accent-color:#84cc16;">';
                h += '<span>' + esc(item.label) + '</span>';
                h += '</label>';
            });
            h += '</div>';
            h += '</div>';
        });

        h += '</div>';

        h += '<div id="kr-perm-count" style="text-align:center;color:#84cc16;font-size:11px;font-weight:900;padding:8px;background:rgba(132,204,22,0.1);border-radius:8px;">';
        h += '📊 صلاحيات إضافية محددة: <span id="kr-perm-count-num">0</span>';
        h += '</div>';

        openDlg(title, '', h, async function () {
            var order = parseInt(document.querySelector('input[name="kr-queen-order"]:checked').value);
            var perms = {};
            document.querySelectorAll('.kr-queen-perm').forEach(function (cb) {
                if (cb.checked) perms[cb.getAttribute('data-perm')] = true;
            });

            if (!isEdit && order === 1) {
                var existingQ1 = await findQueenByOrder(1);
                if (existingQ1 && existingQ1 !== user.uid) {
                    if (!confirm('يوجد ملكة أولى → ستنزل للثانية. متابعة؟')) return false;
                    await db.ref('users/' + existingQ1).update({ queenOrder: 2 });
                }
            }
            if (!isEdit) {
                var existingQN = await findQueenByOrder(order);
                if (existingQN && existingQN !== user.uid) {
                    var freeOrder = await findFreeQueenOrder();
                    if (freeOrder) {
                        await db.ref('users/' + existingQN).update({ queenOrder: freeOrder });
                    }
                }
            }

            await db.ref('users/' + user.uid).update({
                rank: 'Queen',
                rankLevel: 95,
                queenOrder: order,
                customPermissions: perms
            });

            logAudit(isEdit ? 'edit_queen' : 'set_queen', {
                targetUid: user.uid, targetName: user.name || '',
                order: order,
                permsCount: Object.keys(perms).length
            });

            toast('fa-crown', '✅ ' + (user.name || '') + ' — ' + getQueenLabel(order));
            renderTab();
        }, isEdit ? 'حفظ التعديلات' : 'تعيين ملكة', 'kr-btn-green');

        setTimeout(function () {
            var counter = document.getElementById('kr-perm-count-num');
            function updateCount() {
                var n = document.querySelectorAll('.kr-queen-perm:checked').length;
                if (counter) counter.textContent = n;
            }
            document.querySelectorAll('.kr-queen-perm').forEach(function (cb) {
                cb.addEventListener('change', updateCount);
            });
            updateCount();
        }, 100);
    }

    async function findQueenByOrder(order) {
        try {
            var s = await db.ref('users').limitToLast(500).once('value');
            var all = s.val() || {};
            var found = null;
            Object.keys(all).forEach(function (uid) {
                var u = all[uid];
                if (u.rank === 'Queen' && u.queenOrder === order) found = uid;
            });
            return found;
        } catch (e) { return null; }
    }

    async function findFreeQueenOrder() {
        try {
            var s = await db.ref('users').limitToLast(500).once('value');
            var all = s.val() || {};
            var used = {};
            Object.keys(all).forEach(function (uid) {
                var u = all[uid];
                if (u.rank === 'Queen' && u.queenOrder) used[u.queenOrder] = true;
            });
            for (var i = 1; i <= 4; i++) {
                if (!used[i]) return i;
            }
            return null;
        } catch (e) { return null; }
    }

    /* ═══ Queens Tab (King only) ═══ */
    async function renderQueens(body) {
        if (!isKing()) { body.innerHTML = '<div class="kr-empty">للملك فقط</div>'; return; }
        body.innerHTML = '<div class="kr-loading">⏳</div>';

        var s = await db.ref('users').limitToLast(500).once('value');
        var all = s.val() || {};
        var queens = [1, 2, 3, 4].map(function (n) {
            var uid = null;
            Object.keys(all).forEach(function (k) {
                var u = all[k];
                if (u.rank === 'Queen' && u.queenOrder === n) uid = k;
            });
            return { order: n, uid: uid, data: uid ? (all[uid] || {}) : null };
        });

        var h = '<div class="kr-card"><div class="kr-card-title">👸 الملكات (4)</div>';
        queens.forEach(function (q) {
            if (q.uid) {
                var permsCount = q.data.customPermissions ? Object.keys(q.data.customPermissions).filter(function (k) { return q.data.customPermissions[k] === true; }).length : 0;
                h += '<div class="kr-user">' +
                    '<img class="kr-user-avatar" src="' + esc(q.data.avatar || 'https://ui-avatars.com/api/?name=Q') + '">' +
                    '<div class="kr-user-info">' +
                        '<div class="kr-user-name">👸 ' + esc(q.data.name || '') + '</div>' +
                        '<div class="kr-user-sub">' + getQueenLabel(q.order) + ' · صلاحيات إضافية: ' + permsCount + '</div>' +
                    '</div>' +
                    '<button class="kr-icon-btn more" data-qedit="' + esc(q.uid) + '">⚙️</button>' +
                    '<button class="kr-icon-btn more" data-qopen="' + esc(q.uid) + '" style="margin-right:4px;">⋮</button>' +
                    '</div>';
            } else {
                h += '<div class="kr-user" style="opacity:0.5;">' +
                    '<div style="width:44px;height:44px;border-radius:50%;background:rgba(255,215,0,0.1);display:flex;align-items:center;justify-content:center;font-size:20px;">👸</div>' +
                    '<div class="kr-user-info">' +
                        '<div class="kr-user-name">— فارغة —</div>' +
                        '<div class="kr-user-sub">' + getQueenLabel(q.order) + '</div>' +
                    '</div>' +
                    '</div>';
            }
        });
        h += '</div>';

        h += '<div class="kr-card">';
        h += '<div class="kr-card-title">➕ تعيين ملكة</div>';
        h += '<input class="kr-input" id="kr-qsearch" placeholder="🔍 اسم / كود / إيميل / UID" style="margin-bottom:8px;">';
        h += '<button class="kr-btn kr-btn-outline kr-btn-block" id="kr-qsearch-btn" style="margin-bottom:10px;">🔎 بحث</button>';
        h += '<div id="kr-qresults"></div>';
        h += '</div>';

        body.innerHTML = h;

        body.querySelectorAll('[data-qedit]').forEach(function (b) {
            b.onclick = function () {
                var uid = this.getAttribute('data-qedit');
                var q = queens.find(function (x) { return x.uid === uid; });
                if (q && q.data) {
                    q.data.uid = uid;
                    openQueenDialog(q.data, q.order);
                }
            };
        });
        body.querySelectorAll('[data-qopen]').forEach(function (b) {
            b.onclick = function () {
                var uid = this.getAttribute('data-qopen');
                var q = queens.find(function (x) { return x.uid === uid; });
                if (q && q.data) {
                    q.data.uid = uid;
                    openActions(q.data, this);
                }
            };
        });

        var searchInput = document.getElementById('kr-qsearch');
        var searchBtn = document.getElementById('kr-qsearch-btn');
        var resultsBox = document.getElementById('kr-qresults');

        async function doSearch() {
            var val = searchInput.value.trim();
            if (!val) { toast('fa-times', 'أدخل قيمة'); return; }
            resultsBox.innerHTML = '<div style="text-align:center;color:#ffd700;padding:14px;font-size:12px;">⏳ جاري البحث...</div>';
            try {
                var result = await findUserByInput(val);
                if (!result) {
                    resultsBox.innerHTML = '<div style="text-align:center;color:#ff6666;padding:14px;font-size:12px;">❌ لا يوجد مستخدم مطابق</div>';
                    return;
                }
                if (result.multiple) {
                    resultsBox.innerHTML = '<div style="color:#ffd700;font-size:12px;margin-bottom:8px;">وُجد ' + result.matches.length + ' نتيجة:</div>';
                    result.matches.slice(0, 20).forEach(function (m) {
                        resultsBox.appendChild(buildSearchResultCard(m.uid, m.data));
                    });
                    return;
                }
                resultsBox.innerHTML = '';
                resultsBox.appendChild(buildSearchResultCard(result.uid, result.data));
            } catch (e) {
                resultsBox.innerHTML = '<div style="text-align:center;color:#ff6666;padding:14px;font-size:12px;">❌ ' + esc(e.message) + '</div>';
            }
        }

        function buildSearchResultCard(uid, u) {
            var el = document.createElement('div');
            el.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px;background:rgba(255,215,0,0.06);border:1px solid rgba(255,215,0,0.25);border-radius:10px;margin-bottom:8px;';
            var img = document.createElement('img');
            img.src = u.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.name || 'U') + '&background=333&color=fff';
            img.style.cssText = 'width:42px;height:42px;border-radius:50%;border:2px solid #ffd700;object-fit:cover;';
            var info = document.createElement('div');
            info.style.cssText = 'flex:1;min-width:0;';
            info.innerHTML = '<div style="color:#fff;font-weight:900;font-size:13px;">' + rankBadge(u.rank) + ' ' + esc(u.name || 'مجهول') + '</div>' +
                '<div style="color:#888;font-size:10px;margin-top:2px;">' + esc(u.code || '—') + '</div>';
            var btn = document.createElement('button');
            btn.textContent = '👸 تعيين ملكة';
            btn.style.cssText = 'padding:8px 12px;background:#ffd700;color:#000;border:none;border-radius:8px;font-weight:900;font-size:11px;cursor:pointer;font-family:inherit;';
            btn.onclick = function () {
                u.uid = uid;
                openQueenDialog(u, null);
                resultsBox.innerHTML = '';
                searchInput.value = '';
            };
            el.appendChild(img); el.appendChild(info); el.appendChild(btn);
            return el;
        }

        searchBtn.onclick = doSearch;
        searchInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });
    }

    /* ══════════════════════════════════════════════ */
    /* ⭐ v10: تبويب الحسابات المكرّرة                */
    /* ══════════════════════════════════════════════ */
    async function renderMultiAccount(body) {
        if (!isKing()) { body.innerHTML = '<div class="kr-empty">للملك فقط</div>'; return; }
        body.innerHTML = '<div class="kr-loading">⏳</div>';

        try {
            var s = await db.ref('multi_account_alerts').limitToLast(100).once('value');
            var data = s.val() || {};
            var alerts = Object.keys(data).map(function (k) {
                var a = data[k];
                a._id = k;
                return a;
            }).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });

            var renderList = function () {
                var filter = KR._multiAccountFilter;
                var filtered = alerts;
                if (filter === 'pending') filtered = alerts.filter(function (a) { return a.status !== 'resolved'; });
                else if (filter === 'resolved') filtered = alerts.filter(function (a) { return a.status === 'resolved'; });

                var listEl = document.getElementById('kr-ma-list');
                if (!listEl) return;
                listEl.innerHTML = '';

                if (!filtered.length) {
                    listEl.innerHTML = '<div style="text-align:center;color:#888;padding:20px;font-size:12px;">لا توجد تنبيهات</div>';
                    return;
                }

                filtered.forEach(function (a) {
                    var card = document.createElement('div');
                    card.className = 'kr-card';
                    card.style.cssText = 'padding:14px;margin-bottom:10px;border-color:rgba(255,68,68,0.4);background:linear-gradient(135deg,rgba(120,0,0,0.15),rgba(0,0,0,0.3));';

                    var existingList = Array.isArray(a.existingUids) ? a.existingUids : Object.keys(a.existingUids || {});
                    var isResolved = a.status === 'resolved';

                    var h = '';
                    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">';
                    h += '<div style="color:#ff6666;font-weight:900;font-size:13px;">' + (isResolved ? '✅ مُعالَج' : '🚨 محاولة مكرّرة') + '</div>';
                    h += '<div style="color:#888;font-size:10px;">' + timeAgo(a.at) + '</div>';
                    h += '</div>';

                    h += '<div style="color:#fff;font-size:13px;font-weight:900;margin-bottom:4px;">👤 ' + esc(a.name || 'مجهول') + '</div>';
                    h += '<div style="color:#ff9999;font-size:11px;margin-bottom:8px;word-break:break-all;">UID: ' + esc(a.uid || '—') + '</div>';

                    h += '<div style="background:rgba(0,0,0,0.4);border-radius:8px;padding:8px;font-size:11px;line-height:1.6;margin-bottom:10px;">';
                    h += '<div style="color:#aaa;"><b>📱 Device:</b> ' + esc((a.deviceId || '—').substring(0, 20)) + '...</div>';
                    h += '<div style="color:#aaa;"><b>🌐 IP:</b> ' + esc(a.ip || '—') + '</div>';
                    if (existingList.length) {
                        h += '<div style="color:#ffbb66;margin-top:6px;"><b>👥 حسابات موجودة:</b> ' + existingList.length + '</div>';
                        existingList.slice(0, 5).forEach(function (uid) {
                            h += '<div style="color:#ffcc88;font-size:10px;padding-right:10px;">• ' + esc(uid.substring(0, 12)) + '...</div>';
                        });
                    }
                    h += '</div>';

                    card.innerHTML = h;

                    var actions = document.createElement('div');
                    actions.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';

                    if (!isResolved) {
                        var delBtn = document.createElement('button');
                        delBtn.className = 'kr-btn kr-btn-red kr-btn-sm';
                        delBtn.textContent = '🗑️ حذف النبيه';
                        delBtn.onclick = async function () {
                            if (!confirm('حذف هذا التنبيه من القائمة؟')) return;
                            try {
                                await db.ref('multi_account_alerts/' + a._id).remove();
                                toast('fa-check', '✅ حُذف');
                                renderTab();
                            } catch (e) { toast('fa-times', '⚠️ فشل'); }
                        };

                        var banBtn = document.createElement('button');
                        banBtn.className = 'kr-btn kr-btn-red kr-btn-sm';
                        banBtn.textContent = '🛡️ حظر الجهاز';
                        banBtn.style.background = '#dc2626';
                        banBtn.onclick = async function () {
                            if (!confirm('حظر جهاز وIP هذا الحساب؟')) return;
                            try {
                                if (window.DeviceGuard && typeof window.DeviceGuard.ban === 'function') {
                                    await window.DeviceGuard.ban(a.uid, getMe().uid, getMe().name || 'King', 'multi_account');
                                    await db.ref('multi_account_alerts/' + a._id).update({
                                        status: 'resolved',
                                        resolvedAt: Date.now(),
                                        resolvedBy: getMe().uid,
                                        resolvedAction: 'device_ban'
                                    });
                                    toast('fa-check', '🛡️ تم حظر الجهاز + IP');
                                } else {
                                    toast('fa-times', '⚠️ DeviceGuard غير محمّل');
                                }
                                renderTab();
                            } catch (e) { toast('fa-times', '⚠️ فشل: ' + e.message); }
                        };

                        var viewBtn = document.createElement('button');
                        viewBtn.className = 'kr-btn kr-btn-outline kr-btn-sm';
                        viewBtn.textContent = '👤 عرض الحساب';
                        viewBtn.onclick = function () {
                            closeRoom();
                            setTimeout(function () { openUserProfile(a.uid, a.name || ''); }, 200);
                        };

                        actions.appendChild(banBtn);
                        actions.appendChild(delBtn);
                        actions.appendChild(viewBtn);
                    } else {
                        var resInfo = document.createElement('div');
                        resInfo.style.cssText = 'flex:1;color:#84cc16;font-size:11px;font-weight:900;padding:6px;';
                        resInfo.textContent = '✅ معالَج (' + (a.resolvedAction || 'admin') + ')';
                        actions.appendChild(resInfo);
                    }

                    card.appendChild(actions);
                    listEl.appendChild(card);
                });
            };

            var h = '<div class="kr-card">';
            h += '<div class="kr-card-title">🚨 الحسابات المكرّرة</div>';
            h += '<div style="color:#888;font-size:11px;margin-bottom:10px;">يتم الكشف تلقائياً عند محاولة تسجيل حساب ثانٍ من نفس الجهاز</div>';
            h += '</div>';

            h += '<div class="kr-filters">';
            h += '<button class="kr-chip' + (KR._multiAccountFilter === 'pending' ? ' active' : '') + '" data-maf="pending">🆕 جديدة</button>';
            h += '<button class="kr-chip' + (KR._multiAccountFilter === 'resolved' ? ' active' : '') + '" data-maf="resolved">✅ معالَجة</button>';
            h += '</div>';
            h += '<div id="kr-ma-list"></div>';
            body.innerHTML = h;

            body.querySelectorAll('[data-maf]').forEach(function (c) {
                c.onclick = function () {
                    KR._multiAccountFilter = c.getAttribute('data-maf');
                    body.querySelectorAll('[data-maf]').forEach(function (x) { x.classList.remove('active'); });
                    c.classList.add('active');
                    renderList();
                };
            });

            renderList();
        } catch (e) {
            body.innerHTML = '<div class="kr-empty">❌ ' + esc(e.message) + '</div>';
        }
    }

    /* ══════════════════════════════════════════════ */
    /* ⭐ v10: تبويب إدارة البان (devices + IPs)      */
    /* ══════════════════════════════════════════════ */
    async function renderBans(body) {
        var lvl = myLevel();
        if (lvl < 90) { body.innerHTML = '<div class="kr-empty">Master Owner+ فقط</div>'; return; }
        body.innerHTML = '<div class="kr-loading">⏳</div>';

        try {
            var rs = await Promise.all([
                db.ref('banned_devices').limitToLast(200).once('value').catch(function () { return null; }),
                db.ref('banned_ips').limitToLast(200).once('value').catch(function () { return null; })
            ]);
            var bannedDevices = (rs[0] && rs[0].val()) || {};
            var bannedIps = (rs[1] && rs[1].val()) || {};

            var renderList = function () {
                var tab = KR._banTab;
                var data = (tab === 'devices') ? bannedDevices : bannedIps;
                var prefix = (tab === 'devices') ? '📱 ' : '🌐 ';

                var listEl = document.getElementById('kr-ban-list');
                if (!listEl) return;
                listEl.innerHTML = '';

                var keys = Object.keys(data);
                if (!keys.length) {
                    listEl.innerHTML = '<div style="text-align:center;color:#888;padding:20px;font-size:12px;">لا توجد عناصر محظورة</div>';
                    return;
                }

                keys.forEach(function (key) {
                    var entry = data[key] || {};
                    var card = document.createElement('div');
                    card.className = 'kr-card';
                    card.style.cssText = 'padding:12px;margin-bottom:10px;border-color:rgba(168,85,247,0.4);';

                    var shortKey = key.length > 24 ? (key.substring(0, 12) + '...' + key.substring(key.length - 8)) : key;

                    var h = '';
                    h += '<div style="color:#c084fc;font-weight:900;font-size:12px;margin-bottom:6px;word-break:break-all;">' + prefix + esc(shortKey) + '</div>';
                    h += '<div style="color:#fff;font-size:11px;">👤 <b>' + esc(entry.name || 'مجهول') + '</b></div>';
                    h += '<div style="color:#888;font-size:10px;margin-top:2px;">UID: ' + esc((entry.uid || '—').substring(0, 16)) + '...</div>';
                    if (entry.ip) h += '<div style="color:#888;font-size:10px;margin-top:2px;">IP: ' + esc(entry.ip) + '</div>';
                    if (entry.reason) h += '<div style="color:#ff9999;font-size:10px;margin-top:4px;">📝 ' + esc(entry.reason) + '</div>';
                    h += '<div style="color:#666;font-size:10px;margin-top:4px;">🕐 ' + timeAgo(entry.at) + '</div>';

                    card.innerHTML = h;

                    var unbanBtn = document.createElement('button');
                    unbanBtn.className = 'kr-btn kr-btn-green kr-btn-sm';
                    unbanBtn.textContent = '🔓 فك الحظر';
                    unbanBtn.style.marginTop = '8px';
                    unbanBtn.style.width = '100%';
                    unbanBtn.onclick = async function () {
                        if (!confirm('فك حظر هذا العنصر؟')) return;
                        try {
                            var path = (tab === 'devices') ? 'banned_devices/' : 'banned_ips/';
                            await db.ref(path + key).remove();
                            logAudit('unban_' + tab.slice(0, -1), {
                                targetKey: key,
                                targetUid: entry.uid || '',
                                targetName: entry.name || ''
                            });
                            toast('fa-check', '🔓 تم فك الحظر');
                            renderTab();
                        } catch (e) { toast('fa-times', '⚠️ فشل: ' + e.message); }
                    };
                    card.appendChild(unbanBtn);
                    listEl.appendChild(card);
                });
            };

            var h = '<div class="kr-card">';
            h += '<div class="kr-card-title">🛡️ إدارة البان</div>';
            h += '<div style="color:#888;font-size:11px;margin-bottom:6px;">';
            h += '<b style="color:#ffd700;">' + Object.keys(bannedDevices).length + '</b> جهاز · ';
            h += '<b style="color:#ffd700;">' + Object.keys(bannedIps).length + '</b> IP';
            h += '</div>';
            h += '</div>';

            h += '<div class="kr-filters" style="margin-bottom:12px;">';
            h += '<button class="kr-chip' + (KR._banTab === 'devices' ? ' active' : '') + '" data-btab="devices">📱 الأجهزة (' + Object.keys(bannedDevices).length + ')</button>';
            h += '<button class="kr-chip' + (KR._banTab === 'ips' ? ' active' : '') + '" data-btab="ips">🌐 الشبكات (' + Object.keys(bannedIps).length + ')</button>';
            h += '</div>';

            h += '<div id="kr-ban-list"></div>';
            body.innerHTML = h;

            body.querySelectorAll('[data-btab]').forEach(function (c) {
                c.onclick = function () {
                    KR._banTab = c.getAttribute('data-btab');
                    body.querySelectorAll('[data-btab]').forEach(function (x) { x.classList.remove('active'); });
                    c.classList.add('active');
                    renderList();
                };
            });

            renderList();
        } catch (e) {
            body.innerHTML = '<div class="kr-empty">❌ ' + esc(e.message) + '</div>';
        }
    }

    /* ═══ Dialog ═══ */
    function ensureDlg() {
        var d = document.getElementById('kr-dialog');
        if (d) return d;
        d = document.createElement('div');
        d.id = 'kr-dialog';
        d.innerHTML = '<div id="kr-dialog-box"><h3 id="kr-dialog-title"></h3><div id="kr-dialog-desc"></div><div id="kr-dialog-body"></div><div id="kr-dialog-actions"><button class="kr-btn kr-btn-outline" id="kr-dialog-cancel" type="button">إلغاء</button><button class="kr-btn kr-btn-gold" id="kr-dialog-ok" type="button">تأكيد</button></div></div>';
        document.body.appendChild(d);
        d.addEventListener('click', function (e) { if (e.target === d) closeDlg(); });
        return d;
    }
    function openDlg(t, d, b, ok, lbl, cls) {
        var dl = ensureDlg();
        document.getElementById('kr-dialog-title').textContent = t;
        document.getElementById('kr-dialog-desc').innerHTML = d || '';
        document.getElementById('kr-dialog-body').innerHTML = b || '';
        var ob = document.getElementById('kr-dialog-ok');
        ob.textContent = lbl || 'تأكيد';
        ob.className = 'kr-btn ' + (cls || 'kr-btn-gold');
        ob.onclick = function () { if (ok && ok() !== false) closeDlg(); };
        document.getElementById('kr-dialog-cancel').onclick = closeDlg;
        dl.classList.add('active');
    }
    function closeDlg() { var d = document.getElementById('kr-dialog'); if (d) d.classList.remove('active'); }

    /* ═══ Actions ═══ */
    function askPoints(user) {
        var h = '<label style="display:block;color:#ffd700;font-size:12px;font-weight:900;margin-bottom:6px;">عدد النقاط:</label>';
        h += '<input class="kr-input" id="kr-pts" type="number" min="1" value="100">';
        openDlg('⭐ إهداء نقاط لـ ' + (user.name || ''), '', h, function () {
            var a = parseInt(document.getElementById('kr-pts').value);
            if (isNaN(a) || a <= 0) { toast('fa-times', 'رقم غير صحيح'); return false; }
            db.ref('bot_data/quiz/scores/' + user.uid).transaction(function (c) { return (c || 0) + a; })
                .then(function () {
                    logAudit('give_points', { targetUid: user.uid, targetName: user.name, amount: a });
                    toast('fa-star', '✅ أُهدي ' + a + ' نقطة');
                }).catch(function () { toast('fa-times', 'فشل'); });
        }, 'إهداء', 'kr-btn-gold');
    }

    function askPromote(user) {
        var me = getMe();
        var all = ['User', 'Premium', 'Admin', 'Super Admin', 'Owner', 'Grand Owner', 'Room Owner', 'Master Owner'];
        if (isKing()) all.push('Queen');
        var opts = all.filter(function (r) { return typeof canPromoteTo === 'function' && canPromoteTo(me, user, r); });
        if (!opts.length) { toast('fa-lock', 'لا يمكنك'); return; }
        var h = '<label style="display:block;color:#ffd700;margin-bottom:6px;font-weight:900;font-size:12px;">الرتبة الجديدة:</label>';
        h += '<select id="kr-pr" class="kr-select">';
        opts.forEach(function (r) { h += '<option value="' + r + '">' + rankBadge(r) + ' ' + r + '</option>'; });
        h += '</select>';
        openDlg('🎖️ ترقية ' + (user.name || ''), 'الحالية: ' + user.rank, h, function () {
            var n = document.getElementById('kr-pr').value;
            if (n === 'Queen') {
                closeDlg();
                setTimeout(function () { openQueenDialog(user, null); }, 200);
                return;
            }
            var l = (typeof getRankLevel === 'function') ? getRankLevel(n) : 50;
            db.ref('users/' + user.uid).update({ rank: n, rankLevel: l, customPermissions: null })
                .then(function () {
                    logAudit('promote', { targetUid: user.uid, targetName: user.name, fromRank: user.rank, toRank: n });
                    toast('fa-check', '✅'); renderTab();
                }).catch(function () { toast('fa-times', 'فشل'); });
        });
    }

    function doDemote(user) {
        var me = getMe();
        if (typeof canDemoteUser !== 'function' || !canDemoteUser(me, user)) { toast('fa-lock', 'لا صلاحية'); return; }
        openDlg('📉 تخفيض ' + (user.name || ''), 'سيُنزل إلى User.', '', function () {
            db.ref('users/' + user.uid).update({ rank: 'User', rankLevel: 50, queenOrder: null, customPermissions: null })
                .then(function () {
                    logAudit('demote', { targetUid: user.uid, targetName: user.name, fromRank: user.rank, toRank: 'User' });
                    toast('fa-check', '✅'); renderTab();
                }).catch(function () { toast('fa-times', 'فشل'); });
        }, 'تخفيض', 'kr-btn-red');
    }

    function stripRank(user) {
        if (!isKing()) { toast('fa-lock', 'للملك فقط'); return; }
        var me = getMe();
        if (user.uid === me.uid) { toast('fa-times', 'لا يمكنك'); return; }
        var msg = '<div style="color:#ff8888;font-size:12px;line-height:1.6;">الهدف: <b>' + esc(user.name) + '</b><br>رتبته الحالية: <b>' + esc(user.rank) + '</b><br><br>⚠️ سيتم تخفيضه إلى <b>User</b>.</div>';
        openDlg('👑 إزالة رتبة ' + (user.name || ''), msg, '', function () {
            db.ref('users/' + user.uid).update({ rank: 'User', rankLevel: 50, queenOrder: null, customPermissions: null })
                .then(function () {
                    logAudit('strip_rank', { targetUid: user.uid, targetName: user.name, fromRank: user.rank });
                    toast('fa-check', '✅'); renderTab();
                }).catch(function () { toast('fa-times', 'فشل'); });
        }, 'إزالة الرتبة', 'kr-btn-red');
    }

    function deleteAccount(user) {
        if (!isKing()) { toast('fa-lock', 'للملك فقط'); return; }
        var me = getMe();
        if (user.uid === me.uid) { toast('fa-times', 'لا يمكنك حذف نفسك'); return; }
        var msg = '<div style="color:#ff8888;font-size:12px;line-height:1.6;">⚠️ <b>تحذير خطير</b><br>الهدف: <b>' + esc(user.name) + '</b><br>الكود: <b>' + esc(user.code || '—') + '</b><br><br><b>لا يمكن التراجع!</b></div>';
        openDlg('🗑️ حذف حساب ' + (user.name || ''), msg, '', function () {
            if (!confirm('تأكيد نهائي: حذف حساب ' + user.name + '؟')) return false;
            var name = user.name, code = user.code;
            Promise.all([
                db.ref('users/' + user.uid).remove(),
                db.ref('user_presence/' + user.uid).remove(),
                name ? db.ref('user_names/' + name).remove() : Promise.resolve(),
                code ? db.ref('user_codes/' + code).remove() : Promise.resolve()
            ]).then(function () {
                logAudit('delete_account', { targetUid: user.uid, targetName: name });
                toast('fa-trash', '✅ حُذف الحساب');
                renderTab();
            }).catch(function (e) { toast('fa-times', 'فشل: ' + e.message); });
        }, 'حذف نهائي', 'kr-btn-red');
    }

    function doWarn(user) {
        var h = '<label style="display:block;color:#ffd700;font-size:12px;font-weight:900;margin-bottom:6px;">سبب التحذير (اختياري):</label>';
        h += '<input class="kr-input" id="kr-reason">';
        openDlg('⚠️ تحذير ' + (user.name || ''), '', h, function () {
            var reason = document.getElementById('kr-reason').value.trim();
            db.ref('users/' + user.uid + '/warnings').transaction(function (c) { return (c || 0) + 1; })
                .then(function () {
                    logAudit('warn', { targetUid: user.uid, targetName: user.name, reason: reason });
                    toast('fa-check', '✅');
                }).catch(function () { toast('fa-times', 'فشل'); });
        }, 'تحذير', 'kr-btn-orange');
    }

    function askJail(user) {
        var me = getMe();
        if (typeof canJailUser !== 'function' || !canJailUser(me, user)) { toast('fa-lock', 'لا صلاحية'); return; }
        var h = '<label style="display:block;color:#ffd700;font-size:12px;font-weight:900;margin-bottom:6px;">المدة (1-120 دقيقة):</label>';
        h += '<input class="kr-input" id="kr-jm" type="number" min="1" max="120" value="5">';
        openDlg('⛓️ سجن ' + (user.name || ''), '', h, function () {
            var m = parseInt(document.getElementById('kr-jm').value);
            if (isNaN(m) || m < 1 || m > 120) { toast('fa-times', 'رقم غير صحيح'); return false; }
            db.ref('users/' + user.uid + '/lastRoomBeforeJail').set(user.currentRoom || 'general').catch(function () {});
            db.ref('users/' + user.uid).update({ isJailed: true, jailUntil: Date.now() + m * 60000, jailReason: 'إجراء إداري' })
                .then(function () {
                    logAudit('jail', { targetUid: user.uid, targetName: user.name, minutes: m });
                    toast('fa-lock', '✅ ' + m + ' دقيقة');
                }).catch(function () { toast('fa-times', 'فشل'); });
        }, 'سجن', 'kr-btn-red');
    }

    function doKick(user) {
        var me = getMe();
        if (typeof canKickFromRoomUser !== 'function' || !canKickFromRoomUser(me, user)) { toast('fa-lock', 'لا صلاحية'); return; }
        openDlg('🚪 طرد ' + (user.name || ''), 'من الغرفة الحالية؟', '', function () {
            var room = (typeof ChatState !== 'undefined' && ChatState.currentRoom) || 'general';
            db.ref('room_kicks/' + room + '/' + user.uid).set({ by: me.uid, at: Date.now() })
                .then(function () {
                    logAudit('kick', { targetUid: user.uid, targetName: user.name, room: room });
                    toast('fa-check', '✅');
                }).catch(function () { toast('fa-times', 'فشل'); });
        }, 'طرد', 'kr-btn-orange');
    }

    function askBan(user) {
        var h = '<label style="display:block;color:#ffd700;font-size:12px;font-weight:900;margin-bottom:6px;">المدة:</label>';
        h += '<select id="kr-bd" class="kr-select" style="margin-bottom:10px;">';
        h += '<option value="60">ساعة</option><option value="360">6 ساعات</option><option value="1440">يوم</option><option value="10080">أسبوع</option>';
        if (isKing()) h += '<option value="-1">دائم</option>';
        h += '</select>';
        h += '<label style="display:block;color:#ffd700;font-size:12px;font-weight:900;margin-bottom:6px;">السبب (اختياري):</label>';
        h += '<input class="kr-input" id="kr-br">';
        openDlg('🚫 حظر ' + (user.name || ''), '', h, function () {
            var d = document.getElementById('kr-bd').value;
            var r = document.getElementById('kr-br').value.trim();
            doBan(user, d, r);
        }, 'حظر', 'kr-btn-red');
    }

    function doBan(user, dur, reason) {
        var me = getMe();
        if (typeof canBanUser !== 'function' || !canBanUser(me, user)) { toast('fa-lock', 'لا صلاحية'); return; }
        var bu;
        if (dur === '-1') { if (!isKing()) { toast('fa-lock', 'للملك فقط'); return; } bu = Date.now() + 365 * 24 * 60 * 60 * 1000; }
        else bu = Date.now() + parseInt(dur) * 60000;
        db.ref('users/' + user.uid).update({ isBanned: true, bannedUntil: bu, banReason: reason || '' })
            .then(function () {
                logAudit('ban', { targetUid: user.uid, targetName: user.name, duration: dur, reason: reason });
                toast('fa-check', '✅'); renderTab();
            }).catch(function () { toast('fa-times', 'فشل'); });
    }

    /* ═══ Ranks ═══ */
    function renderRanks(body) {
        body.innerHTML = '<div class="kr-loading">⏳</div>';
        db.ref('users').limitToLast(500).once('value').then(function (s) {
            var all = s.val() || {};
            var adm = Object.keys(all).map(function (uid) { var u = all[uid] || {}; u.uid = uid; return u; })
                .filter(function (u) { return (u.rankLevel || 0) >= 65; })
                .sort(function (a, b) { return (b.rankLevel || 0) - (a.rankLevel || 0); });
            body.innerHTML = '<div class="kr-card"><div class="kr-card-title">🎖️ الإداريون (' + adm.length + ')</div></div>';
            var c = body.querySelector('.kr-card');
            adm.forEach(function (u) { c.appendChild(buildUCard(u)); });
        }).catch(function () { body.innerHTML = '<div class="kr-empty">❌</div>'; });
    }

    /* ═══ Punishments ═══ */
    async function renderPunishments(body) {
        body.innerHTML = '<div class="kr-loading">⏳</div>';
        try {
            var s = await db.ref('users').limitToLast(500).once('value');
            var all = s.val() || {};
            var now = Date.now();
            var allUsers = Object.keys(all).map(function (uid) { var u = all[uid] || {}; u.uid = uid; return u; });

            var renderList = function () {
                var filter = KR._punishmentFilter;
                var filtered = allUsers.filter(function (u) {
                    if (filter === 'jailed') return u.isJailed && u.jailUntil && now < u.jailUntil;
                    if (filter === 'banned') return u.isBanned && u.bannedUntil && now < u.bannedUntil;
                    if (filter === 'perm') return u.permanentBan === true && u.isBanned === true;
                    return false;
                });

                var listEl = document.getElementById('kr-pun-list');
                if (!listEl) return;
                listEl.innerHTML = '';

                if (!filtered.length) {
                    listEl.innerHTML = '<div style="text-align:center;color:#888;padding:20px;font-size:12px;">لا يوجد معاقبون في هذه الفئة</div>';
                    return;
                }

                filtered.forEach(function (u) {
                    var row = document.createElement('div');
                    row.className = 'kr-user';
                    var timeInfo = '';
                    if (filter === 'jailed') timeInfo = '⛓️ ينتهي بعد ' + Math.ceil((u.jailUntil - now) / 60000) + ' دقيقة';
                    else if (filter === 'banned') timeInfo = '🚫 ينتهي بعد ' + Math.ceil((u.bannedUntil - now) / 3600000) + ' ساعة';
                    else if (filter === 'perm') timeInfo = '🛑 حظر دائم — يحتاج إعادة';

                    row.innerHTML =
                        '<img class="kr-user-avatar" src="' + esc(u.avatar || 'https://ui-avatars.com/api/?name=U') + '">' +
                        '<div class="kr-user-info">' +
                            '<div class="kr-user-name">' + rankBadge(u.rank) + ' ' + esc(u.name || 'مجهول') + '</div>' +
                            '<div class="kr-user-sub">' + timeInfo + '</div>' +
                            (u.kickReason || u.jailReason || u.banReason ? '<div style="color:#ff9999;font-size:10px;margin-top:2px;">📝 ' + esc(u.kickReason || u.jailReason || u.banReason) + '</div>' : '') +
                        '</div>' +
                        '<button class="kr-btn kr-btn-green kr-btn-sm" data-restore="' + esc(u.uid) + '">↩️ إعادة</button>';
                    listEl.appendChild(row);
                });

                listEl.querySelectorAll('[data-restore]').forEach(function (btn) {
                    btn.onclick = async function () {
                        var uid = this.getAttribute('data-restore');
                        var u = filtered.find(function (x) { return x.uid === uid; });
                        if (!u) return;
                        if (!confirm('إعادة ' + u.name + '؟')) return;
                        try {
                            await db.ref('users/' + uid).update({
                                isJailed: false, jailUntil: 0,
                                isBanned: false, bannedUntil: 0,
                                permanentBan: false,
                                jailReleasedAt: Date.now()
                            });
                            try {
                                var kicks = await db.ref('room_kicks').once('value');
                                var allKicks = kicks.val() || {};
                                Object.keys(allKicks).forEach(function (rid) {
                                    if (allKicks[rid] && allKicks[rid][uid]) {
                                        db.ref('room_kicks/' + rid + '/' + uid).remove().catch(function () {});
                                    }
                                });
                            } catch (e) {}
                            logAudit('restore_user', { targetUid: uid, targetName: u.name });
                            toast('fa-check', '✅ تمت الإعادة');
                            renderTab();
                        } catch (e) {
                            toast('fa-times', '⚠️ فشل: ' + e.message);
                        }
                    };
                });
            };

            var h = '<div class="kr-filters">';
            h += '<button class="kr-chip' + (KR._punishmentFilter === 'jailed' ? ' active' : '') + '" data-pf="jailed">⛓️ المسجونون</button>';
            h += '<button class="kr-chip' + (KR._punishmentFilter === 'banned' ? ' active' : '') + '" data-pf="banned">🚫 المحظورون</button>';
            h += '<button class="kr-chip' + (KR._punishmentFilter === 'perm' ? ' active' : '') + '" data-pf="perm">🛑 المطرودون نهائياً</button>';
            h += '</div>';
            h += '<div id="kr-pun-list"></div>';
            body.innerHTML = h;

            body.querySelectorAll('[data-pf]').forEach(function (c) {
                c.onclick = function () {
                    KR._punishmentFilter = c.getAttribute('data-pf');
                    body.querySelectorAll('[data-pf]').forEach(function (x) { x.classList.remove('active'); });
                    c.classList.add('active');
                    renderList();
                };
            });

            renderList();
        } catch (e) {
            body.innerHTML = '<div class="kr-empty">❌ ' + esc(e.message) + '</div>';
        }
    }

    /* ═══ Reports ═══ */
    async function renderReports(body) {
        body.innerHTML = '<div class="kr-loading">⏳</div>';
        try {
            var renderList = async function () {
                var filter = KR._reportFilter;
                var path = filter === 'archive' ? 'reports_archive' : 'reports';
                var snap = await db.ref(path).limitToLast(100).once('value');
                var data = snap.val() || {};
                var list = Object.keys(data).map(function (k) { var r = data[k]; r._id = k; return r; })
                    .sort(function (a, b) { return (b.time || 0) - (a.time || 0); });

                var listEl = document.getElementById('kr-reports-list');
                if (!listEl) return;
                listEl.innerHTML = '';

                if (!list.length) {
                    listEl.innerHTML = '<div style="text-align:center;color:#888;padding:20px;font-size:12px;">لا توجد بلاغات</div>';
                    return;
                }

                var REASONS = {
                    abuse: { icon: '🚫', name: 'محتوى مسيء' },
                    promo: { icon: '📢', name: 'ترويج / إعلان' },
                    adult: { icon: '🔞', name: 'محتوى غير لائق' },
                    harass: { icon: '💢', name: 'تحرش / إزعاج' },
                    other: { icon: '❓', name: 'سبب آخر' },
                    call_guardian: { icon: '🚔', name: 'استدعاء السجان' }
                };

                list.forEach(function (r) {
                    var reason = REASONS[r.reason] || { icon: '❓', name: r.reason || '—' };
                    var card = document.createElement('div');
                    card.className = 'kr-card';
                    card.style.cssText = 'padding:12px;margin-bottom:10px;';
                    card.innerHTML =
                        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
                            '<div style="color:#ffd700;font-weight:900;font-size:13px;">' + reason.icon + ' ' + reason.name + '</div>' +
                            '<div style="color:#888;font-size:10px;">' + timeAgo(r.time) + '</div>' +
                        '</div>' +
                        '<div style="color:#fff;font-size:12px;margin-bottom:4px;"><b>المُبلِّغ:</b> ' + esc(r.reporterName || '—') + '</div>' +
                        '<div style="color:#fff;font-size:12px;margin-bottom:4px;"><b>المُبلَّغ عنه:</b> ' + esc(r.targetName || '—') + '</div>' +
                        (r.messageText ? '<div style="color:#ffcccc;font-size:11px;background:rgba(0,0,0,0.4);padding:6px;border-radius:6px;margin:6px 0;word-break:break-word;">' + esc(r.messageText) + '</div>' : '');

                    var actions = document.createElement('div');
                    actions.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;';

                    if (filter === 'new') {
                        var doneBtn = document.createElement('button');
                        doneBtn.className = 'kr-btn kr-btn-green kr-btn-sm';
                        doneBtn.textContent = '✅ معالجة';
                        doneBtn.onclick = async function () {
                            if (!confirm('تمت المعالجة؟')) return;
                            try {
                                var me = getMe();
                                var arch = Object.assign({}, r, { processedAt: Date.now(), processedBy: me ? me.uid : null, processedByName: me ? me.name : 'مشرف' });
                                delete arch._id;
                                await db.ref('reports_archive/' + r._id).set(arch);
                                await db.ref('reports/' + r._id).remove();
                                logAudit('report_resolved', { reportId: r._id, targetUid: r.targetUid || '' });
                                toast('fa-check', '✅');
                                renderTab();
                            } catch (e) { toast('fa-times', '⚠️ ' + e.message); }
                        };

                        var viewBtn = document.createElement('button');
                        viewBtn.className = 'kr-btn kr-btn-outline kr-btn-sm';
                        viewBtn.textContent = '👤 عرض المستخدم';
                        viewBtn.onclick = function () {
                            if (r.targetUid) { closeRoom(); setTimeout(function () { openUserProfile(r.targetUid, r.targetName || ''); }, 200); }
                        };

                        actions.appendChild(doneBtn);
                        actions.appendChild(viewBtn);
                    }
                    card.appendChild(actions);
                    listEl.appendChild(card);
                });
            };

            var h = '<div class="kr-filters">';
            h += '<button class="kr-chip' + (KR._reportFilter === 'new' ? ' active' : '') + '" data-rf="new">🆕 جديدة</button>';
            h += '<button class="kr-chip' + (KR._reportFilter === 'archive' ? ' active' : '') + '" data-rf="archive">📦 أرشيف</button>';
            h += '</div>';
            h += '<div id="kr-reports-list"></div>';
            body.innerHTML = h;

            body.querySelectorAll('[data-rf]').forEach(function (c) {
                c.onclick = function () {
                    KR._reportFilter = c.getAttribute('data-rf');
                    body.querySelectorAll('[data-rf]').forEach(function (x) { x.classList.remove('active'); });
                    c.classList.add('active');
                    renderList();
                };
            });

            renderList();
        } catch (e) {
            body.innerHTML = '<div class="kr-empty">❌ ' + esc(e.message) + '</div>';
        }
    }

    /* ═══ Rooms ═══ */
    async function renderRooms(body) {
        body.innerHTML = '<div class="kr-loading">⏳</div>';
        var s = await db.ref('room_settings').once('value');
        KR.roomsSettings = s.val() || {};
        var h = '<div class="kr-card"><div class="kr-card-title">🚪 إدارة الغرف</div>';
        h += '<div style="color:#888;font-size:11px;margin-bottom:12px;">تعديل الاسم · الأيقونة · الخلفية · لون الخط</div>';
        Object.keys(QAMAR.ROOMS).forEach(function (rid) {
            var room = QAMAR.ROOMS[rid];
            if (room.invisible) return;
            var c = KR.roomsSettings[rid] || {};
            var n = c.name || room.name;
            var hasImg = c.iconImage ? '<img src="' + c.iconImage + '" style="width:32px;height:32px;border-radius:8px;object-fit:cover;">' : esc(c.icon || room.icon);
            h += '<div class="kr-user" style="margin-bottom:8px;">' +
                '<div style="font-size:22px;width:34px;text-align:center;display:flex;align-items:center;justify-content:center;">' + hasImg + '</div>' +
                '<div class="kr-user-info"><div class="kr-user-name">' + esc(n) + '</div><div class="kr-user-sub">' + esc(rid) + '</div></div>' +
                '<button class="kr-icon-btn more" data-r="' + esc(rid) + '">✏️</button>' +
                '</div>';
        });
        h += '</div>';
        body.innerHTML = h;
        body.querySelectorAll('[data-r]').forEach(function (b) { b.onclick = function () { editRoom(this.getAttribute('data-r')); }; });
    }

    function editRoom(rid) {
        if (myLevel() < 80) { toast('fa-lock', '🔒 Grand Owner+ فقط'); return; }
        var room = QAMAR.ROOMS[rid];
        if (!room) return;
        var c = KR.roomsSettings[rid] || {};
        KR.tempIconImage = c.iconImage || null;
        KR.tempBgImage = c.bgImage || null;

        var h = '';
        h += '<label style="display:block;color:#ffd700;font-size:12px;font-weight:900;margin-bottom:6px;">الاسم:</label>';
        h += '<input class="kr-input" id="kr-rn" value="' + esc(c.name || room.name) + '" style="margin-bottom:14px;" maxlength="30">';
        h += '<label style="display:block;color:#ffd700;font-size:12px;font-weight:900;margin-bottom:6px;">الأيقونة:</label>';
        h += '<input class="kr-input" id="kr-ri" value="' + esc(c.icon || room.icon) + '" style="margin-bottom:14px;" maxlength="4">';

        openDlg('✏️ ' + room.name, '', h, function () {
            saveRoom(rid, {
                name: document.getElementById('kr-rn').value.trim(),
                icon: document.getElementById('kr-ri').value.trim(),
                iconImage: KR.tempIconImage,
                bgImage: KR.tempBgImage,
                bgType: c.bgType,
                bgValue: c.bgValue,
                nameColor: c.nameColor,
                fontColor: c.fontColor,
                fontSize: c.fontSize
            });
        }, 'حفظ', 'kr-btn-green');
    }

    async function saveRoom(rid, d) {
        var me = getMe();
        try {
            var p = { updatedAt: Date.now(), updatedBy: me.uid };
            if (d.name) p.name = d.name;
            if (d.icon) p.icon = d.icon;
            if (d.iconImage !== undefined) p.iconImage = d.iconImage;
            if (d.bgImage !== undefined) p.bgImage = d.bgImage;
            p.bgType = d.bgType || null;
            p.bgValue = d.bgValue || null;
            p.nameColor = d.nameColor || null;
            p.fontColor = d.fontColor || null;
            p.fontSize = d.fontSize || null;
            await db.ref('room_settings/' + rid).update(p);

            if (QAMAR.ROOMS[rid]) {
                if (d.name) QAMAR.ROOMS[rid].name = d.name;
                if (d.icon) QAMAR.ROOMS[rid].icon = d.icon;
            }
            if (typeof buildRoomsList === 'function') buildRoomsList();
            logAudit('edit_room', { roomId: rid });
            toast('fa-check', '✅');
            renderRooms(document.getElementById('kr-body'));
        } catch (e) { toast('fa-times', 'فشل: ' + e.message); }
    }

    /* ═══ Bots ═══ */
    function renderBots(body) {
        var h = '<div class="kr-card"><div class="kr-card-title">🤖 إدارة البوتات</div>';
        h += '<div style="color:#888;font-size:11px;margin-bottom:14px;">حكواتي · مسابقات · إسلاميات · سفير</div>';
        h += '<button class="kr-btn kr-btn-gold kr-btn-block" id="kr-ob" style="margin-bottom:8px;">🤖 فتح لوحة البوتات</button>';
        h += '<button class="kr-btn kr-btn-outline kr-btn-block" id="kr-create-bot-profiles">🆕 إنشاء بروفايلات البوتات</button>';
        h += '</div>';
        body.innerHTML = h;

        document.getElementById('kr-ob').onclick = function () {
            closeRoom();
            setTimeout(function () { if (typeof window.openBotManager === 'function') window.openBotManager(); }, 200);
        };

        document.getElementById('kr-create-bot-profiles').onclick = async function () {
            if (!confirm('إنشاء/إعادة تعيين بروفايلات البوتات الـ5؟')) return;
            this.disabled = true;
            this.textContent = '⏳...';
            try {
                var bots = [
                    { id: 'guardian', name: 'السجان', rank: 'Guardian', bio: '🚔 حارس القوانين', color: '#ff4444' },
                    { id: 'hakawati', name: 'حكواتي الشام', rank: 'Storyteller', bio: '📖 صديقك في كل سؤال', color: '#9C27B0' },
                    { id: 'quiz', name: 'الشاطر', rank: 'Quiz Master', bio: '🎯 أسئلة ممتعة', color: '#FF9800' },
                    { id: 'islamic', name: 'قمر الشام', rank: 'Islamic', bio: '🌙 ذكر ودعاء', color: '#d4af37' },
                    { id: 'ambassador', name: 'السفير', rank: 'Ambassador', bio: '🚪 يرحّب بالأعضاء', color: '#84cc16' }
                ];
                var now = Date.now();
                for (var i = 0; i < bots.length; i++) {
                    var b = bots[i];
                    var uid = 'bot_' + b.id;
                    var avatar = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(b.name) + '&background=111&color=ffd700&bold=true&size=128';
                    await db.ref('users/' + uid).update({
                        uid: uid, name: b.name,
                        code: 'BOT·' + b.id.substring(0, 3).toUpperCase(),
                        rank: b.rank, rankLevel: 50, isBot: true, botId: b.id,
                        bio: b.bio, avatar: avatar, color: b.color,
                        createdAt: now, lastSeen: now, isGuest: false
                    });
                }
                toast('fa-check', '✅ تم إنشاء ' + bots.length + ' بروفايلات');
            } catch (e) { toast('fa-times', '⚠️ ' + e.message); }
            this.disabled = false;
            this.textContent = '🆕 إنشاء بروفايلات البوتات';
        };
    }

    /* ═══ Guardian (King only) ═══ */
    function renderGuardian(body) {
        if (!isKing()) { body.innerHTML = '<div class="kr-empty">للملك فقط</div>'; return; }

        body.innerHTML = '<div class="kr-loading">⏳</div>';

        var h = '<div class="kr-card">';
        h += '<div class="kr-card-title">🚔 إدارة السجان</div>';
        h += '<div style="color:#888;font-size:11px;margin-bottom:14px;">';
        h += '🚔 السجان يحمي المكان. كلمات السجن → عقوبات تصاعدية (2 → 4 → 8 → 15 دقيقة).<br>';
        h += '🚪 كلمات الطرد → حظر دائم فوري.';
        h += '</div>';
        h += '</div>';

        h += '<div class="kr-filters" style="margin-bottom:12px;">';
        h += '<button class="kr-chip' + (KR._guardianTab === 'badwords' ? ' active' : '') + '" data-gt="badwords">⚠️ كلمات السجن</button>';
        h += '<button class="kr-chip' + (KR._guardianTab === 'kickwords' ? ' active' : '') + '" data-gt="kickwords">🚪 كلمات الطرد</button>';
        h += '</div>';

        h += '<button class="kr-btn kr-btn-blue kr-btn-block" id="kr-guardian-import" style="margin-bottom:8px;background:linear-gradient(135deg,#3b82f6,#1e40af);color:#fff;">📥 استيراد قائمة عربية جاهزة</button>';
        h += '<button class="kr-btn kr-btn-green kr-btn-block" id="kr-guardian-add" style="margin-bottom:12px;">➕ إضافة كلمة</button>';
        h += '<div id="kr-guardian-list"></div>';

        body.innerHTML = h;

        body.querySelectorAll('[data-gt]').forEach(function (c) {
            c.onclick = function () {
                KR._guardianTab = c.getAttribute('data-gt');
                renderGuardian(body);
            };
        });

        document.getElementById('kr-guardian-import').onclick = async function () {
            if (typeof window.importArabicWordList === 'function') {
                window.importArabicWordList(KR._guardianTab);
            } else {
                toast('fa-times', '⚠️ bots.js غير محمّل');
            }
        };

        document.getElementById('kr-guardian-add').onclick = function () {
            var tab = KR._guardianTab;
            var w = prompt(tab === 'badwords' ? '⚠️ كلمة السجن:' : '🚪 كلمة الطرد الدائم:');
            if (!w) return;
            var path = tab === 'badwords' ? 'bot_memory/badWords' : 'bot_memory/kickWords';
            db.ref(path).push({ text: w.trim() }).then(function () {
                toast('fa-check', '✅');
                renderGuardian(body);
            }).catch(function (e) { alert('❌ ' + e.message); });
        };

        var path = KR._guardianTab === 'badwords' ? 'bot_memory/badWords' : 'bot_memory/kickWords';
        db.ref(path).once('value').then(function (s) {
            var data = s.val() || {};
            var items = Object.keys(data).map(function (k) {
                var it = data[k];
                return { key: k, text: (typeof it === 'string') ? it : (it.text || '') };
            }).filter(function (x) { return x.text; }).sort(function (a, b) { return a.text.localeCompare(b.text); });

            var listEl = document.getElementById('kr-guardian-list');
            if (!listEl) return;
            listEl.innerHTML = '';

            var cnt = document.createElement('div');
            cnt.style.cssText = 'text-align:center;color:#84cc16;font-size:12px;font-weight:900;padding:8px;background:rgba(132,204,22,0.1);border-radius:8px;margin-bottom:10px;';
            cnt.textContent = '📊 ' + items.length + ' كلمة';
            listEl.appendChild(cnt);

            if (!items.length) {
                listEl.innerHTML += '<div style="text-align:center;color:#888;padding:20px;font-size:12px;">لا توجد كلمات. استخدم زر الاستيراد أو أضف يدوياً.</div>';
                return;
            }

            items.forEach(function (it) {
                var r = document.createElement('div');
                r.style.cssText = (KR._guardianTab === 'badwords')
                    ? 'background:rgba(255,152,0,0.1);border:1px solid rgba(255,152,0,0.3);border-radius:10px;padding:10px;margin-bottom:6px;display:flex;align-items:center;gap:10px;'
                    : 'background:rgba(220,38,38,0.15);border:1px solid rgba(220,38,38,0.5);border-radius:10px;padding:10px;margin-bottom:6px;display:flex;align-items:center;gap:10px;';
                var t = document.createElement('div');
                t.style.cssText = 'color:#fff;font-weight:900;font-size:13px;flex:1;word-break:break-word;';
                t.textContent = (KR._guardianTab === 'badwords' ? '⚠️ ' : '🚪 ') + it.text;
                var del = document.createElement('button');
                del.textContent = '🗑️';
                del.style.cssText = 'padding:6px 12px;background:#ef4444;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:900;cursor:pointer;font-family:inherit;';
                del.onclick = function () {
                    if (!confirm('حذف "' + it.text + '"؟')) return;
                    db.ref(path + '/' + it.key).remove().then(function () {
                        toast('fa-check', '✅');
                        renderGuardian(body);
                    });
                };
                r.appendChild(t);
                r.appendChild(del);
                listEl.appendChild(r);
            });
        }).catch(function (e) {
            var listEl = document.getElementById('kr-guardian-list');
            if (listEl) listEl.innerHTML = '<div style="color:#ff6666;padding:14px;">⚠️ ' + esc(e.message) + '</div>';
        });
    }

    /* ═══ Welcome ═══ */
    async function renderWelcomeTab(body) {
        if (!isKing()) { body.innerHTML = '<div class="kr-empty">للملك فقط</div>'; return; }
        body.innerHTML = '<div class="kr-loading">⏳</div>';
        try {
            var s = await db.ref('room_settings').once('value');
            var settings = s.val() || {};
            var h = '<div class="kr-card"><div class="kr-card-title">🚪 رسائل الترحيب</div>';
            h += '<div style="color:#888;font-size:11px;margin-bottom:12px;">اضغط ✏️ لتعديل رسالة الترحيب</div>';

            Object.keys(QAMAR.ROOMS).forEach(function (rid) {
                var room = QAMAR.ROOMS[rid];
                if (room.invisible) return;
                var c = settings[rid] || {};
                var welcome = c.welcome || {};
                var text = welcome.text || ('🌟 أهلاً وسهلاً بك\n{name}\nفي {room}');
                var enabled = welcome.enabled !== false;
                h += '<div class="kr-user" style="margin-bottom:8px;">' +
                    '<div style="font-size:22px;width:34px;text-align:center;">' + (room.icon || '🚪') + '</div>' +
                    '<div class="kr-user-info">' +
                        '<div class="kr-user-name">' + esc(room.name) + '</div>' +
                        '<div class="kr-user-sub">' + (enabled ? '✅ مفعّل' : '❌ معطّل') + '</div>' +
                    '</div>' +
                    '<button class="kr-icon-btn more" data-wedit="' + esc(rid) + '">✏️</button>' +
                    '</div>';
            });
            h += '</div>';
            body.innerHTML = h;

            body.querySelectorAll('[data-wedit]').forEach(function (b) {
                b.onclick = function () { openWelcomeEditor(this.getAttribute('data-wedit')); };
            });
        } catch (e) {
            body.innerHTML = '<div class="kr-empty">❌ ' + esc(e.message) + '</div>';
        }
    }

    async function openWelcomeEditor(rid) {
        if (!rid) rid = (typeof ChatState !== 'undefined' && ChatState.currentRoom) || 'general';
        if (myLevel() < 80) { toast('fa-lock', '🔒 Grand Owner+ فقط'); return; }

        var snap = await db.ref('room_settings/' + rid).once('value');
        var c = snap.val() || {};
        var welcome = c.welcome || {};
        var roomName = (QAMAR.ROOMS[rid] && QAMAR.ROOMS[rid].name) || rid;

        var h = '';
        h += '<label style="display:block;color:#ffd700;font-size:12px;font-weight:900;margin-bottom:6px;">نص الترحيب:</label>';
        h += '<textarea id="kw-text" style="width:100%;min-height:90px;padding:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,215,0,0.3);border-radius:10px;color:#fff;font-family:inherit;font-size:13px;text-align:right;resize:vertical;box-sizing:border-box;">' + esc(welcome.text || '🌟 أهلاً وسهلاً بك\n{name}\nفي {room}') + '</textarea>';
        h += '<div style="color:#888;font-size:10px;margin-top:4px;">{name} = اسم العضو، {room} = اسم الغرفة</div>';
        h += '<div style="display:flex;align-items:center;gap:10px;margin-top:14px;padding:8px 0;">';
        h += '<input type="checkbox" id="kw-enabled" ' + (welcome.enabled !== false ? 'checked' : '') + ' style="width:20px;height:20px;accent-color:#ffd700;cursor:pointer;">';
        h += '<label for="kw-enabled" style="flex:1;color:#ddd;font-size:13px;font-weight:700;cursor:pointer;">✅ تفعيل الترحيب</label>';
        h += '</div>';

        openDlg('🚪 ترحيب: ' + roomName, '', h, async function () {
            var newText = document.getElementById('kw-text').value;
            var enabled = document.getElementById('kw-enabled').checked;
            try {
                await db.ref('room_settings/' + rid + '/welcome').update({
                    text: newText, enabled: enabled,
                    updatedAt: Date.now(), updatedBy: (getMe() || {}).uid
                });
                toast('fa-check', '✅');
                if (KR.open) renderTab();
            } catch (e) { toast('fa-times', '⚠️ ' + e.message); }
        }, 'حفظ', 'kr-btn-green');
    }

    window.openWelcomeEditor = openWelcomeEditor;

    /* ═══ Alerts ═══ */
    function renderAlerts(body) {
        var has = (typeof RoomAlerts !== 'undefined');
        var h = '<div class="kr-card"><div class="kr-card-title">📢 إرسال تنبيه منبثق</div>';
        h += '<div style="color:#888;font-size:11px;margin-bottom:14px;">يظهر لكل من في الغرفة</div>';
        if (has) h += '<button class="kr-btn kr-btn-gold kr-btn-block" id="kr-oa">📢 فتح النافذة</button>';
        else h += '<div style="text-align:center;color:#ff6666;padding:20px;">⚠️ نظام التنبيهات غير محمَّل</div>';
        h += '</div>';
        body.innerHTML = h;
        var b = document.getElementById('kr-oa');
        if (b) b.onclick = function () { closeRoom(); setTimeout(function () { RoomAlerts.open(); }, 200); };
    }

    /* ═══ Settings ═══ */
    async function renderSettings(body) {
        if (!isKing()) { body.innerHTML = '<div class="kr-empty">للملك فقط</div>'; return; }
        body.innerHTML = '<div class="kr-loading">⏳</div>';
        var s = await db.ref('config').once('value');
        var c = s.val() || {};
        var currentStyle = localStorage.getItem('qamar_sidebar_style') || 'classic';
        var styleLabel = currentStyle === 'glass' ? '💎 التبديل إلى: كلاسيكي' : '◻️ التبديل إلى: زجاجي';

        var h = '<div class="kr-card"><div class="kr-card-title">⚙️ إعدادات</div>';
        h += '<div style="color:#888;font-size:11px;margin-bottom:10px;">king_uid: <code style="color:#ffd700;font-size:10px;">' + esc(c.king_uid || '—') + '</code></div>';
        h += '<button class="kr-btn kr-btn-outline kr-btn-block" id="kr-sk" style="margin-bottom:8px;">👑 تعيين الملك</button>';
        h += '<button class="kr-btn kr-btn-outline kr-btn-block" id="kr-va" style="margin-bottom:8px;">📜 سجل النشاط</button>';
        h += '</div>';
        h += '<div class="kr-card"><div class="kr-card-title">🎨 المظهر</div>';
        h += '<div style="color:#888;font-size:11px;margin-bottom:10px;">تبديل شكل القوائم الجانبية</div>';
        h += '<button class="kr-btn kr-btn-gold kr-btn-block" id="kr-style-toggle">' + styleLabel + '</button>';
        h += '</div>';

        body.innerHTML = h;

        document.getElementById('kr-sk').onclick = function () {
            var uid = prompt('أدخل uid الملك الجديد:', c.king_uid || '');
            if (!uid) return;
            if (!confirm('⚠️ متابعة؟')) return;
            db.ref('config/king_uid').set(uid.trim()).then(function () { toast('fa-crown', '✅'); renderSettings(body); }).catch(function () { toast('fa-times', 'فشل'); });
        };
        document.getElementById('kr-va').onclick = function () { toast('fa-book', 'قريباً'); };
        document.getElementById('kr-style-toggle').onclick = function () {
            var cur = localStorage.getItem('qamar_sidebar_style') || 'classic';
            var next = cur === 'glass' ? 'classic' : 'glass';
            localStorage.setItem('qamar_sidebar_style', next);
            document.body.classList.toggle('sidebar-glass', next === 'glass');
            document.body.classList.toggle('sidebar-classic', next === 'classic');
            toast('fa-check', next === 'glass' ? '💎 زجاجي' : '◻️ كلاسيكي');
            this.textContent = next === 'glass' ? '💻 التبديل إلى: كلاسيكي' : '💎 التبديل إلى: زجاجي';
        };
    }

    /* ═══ Helper: فتح بروفايل من أي مكان ═══ */
    function openUserProfile(uid, name) {
        if (typeof window.openUserProfile === 'function' && window.openUserProfile !== openUserProfile) {
            window.openUserProfile(uid, name);
            return;
        }
        try {
            if (window.parent && window.parent !== window && typeof window.parent.openUserProfile === 'function') {
                window.parent.openUserProfile(uid, name);
                return;
            }
        } catch (e) {}
        localStorage.setItem('profile_target_uid', uid);
        localStorage.setItem('profile_target_name', name || '');
        var i = document.getElementById('profile-iframe');
        if (i) i.src = 'profile.html?uid=' + encodeURIComponent(uid) + '&t=' + Date.now();
        var f = document.getElementById('profile-frame-container');
        if (f) f.style.display = 'block';
    }

    /* ═══ Open/Close ═══ */
    function openRoom() {
        if (!isRoyal()) { toast('fa-lock', 'للملك/الملكة فقط'); return; }
        var m = ensureModal();
        renderTabs();
        renderTab();
        m.classList.add('active');
        KR.open = true;
    }
    function closeRoom() {
        var m = document.getElementById('king-room-view');
        if (m) m.classList.remove('active');
        KR.open = false;
    }

    /* ═══ Button ═══ */
    function injectBtn() {
        var list = document.getElementById('rooms-list');
        if (!list) { setTimeout(injectBtn, 1500); return; }
        if (document.getElementById('king-room-btn')) return;
        if (!isRoyal()) return;
        var b = document.createElement('div');
        b.id = 'king-room-btn';
        b.className = 'sidebar-item';
        b.style.cssText = 'background:linear-gradient(135deg,#4a148c,#d4af37) !important;color:#fff;font-weight:900;cursor:pointer;padding:12px;margin-bottom:8px;border-radius:12px;border:2px solid #ffd700;text-align:center;';
        b.textContent = '👑 غرفة الملك';
        b.onclick = function (e) { e.preventDefault(); e.stopPropagation(); openRoom(); };
        list.insertBefore(b, list.firstChild);
    }

    function observeList() {
        var l = document.getElementById('rooms-list');
        if (!l) { setTimeout(observeList, 1500); return; }
        new MutationObserver(function () { if (!document.getElementById('king-room-btn') && isRoyal()) injectBtn(); }).observe(l, { childList: true, subtree: false });
        injectBtn();
    }

    /* ⭐ v10: __krSetTab — للفتح المباشر من index.html */
    window.__krSetTab = function (tabId) {
        if (!tabId) return;
        KR.currentTab = tabId;
        if (KR.open) {
            renderTabs();
            renderTab();
        }
    };

    window.KingRoom = { open: openRoom, close: closeRoom, reload: function () { if (KR.open) renderTab(); } };

    function init() {
        var t = setInterval(function () {
            if (typeof getCurrentUser === 'function' && getCurrentUser()) {
                clearInterval(t);
                observeList();
            }
        }, 800);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    console.log('👑 king-room.js v10 (TEST) loaded — multi-account + bans + __krSetTab');
})();
