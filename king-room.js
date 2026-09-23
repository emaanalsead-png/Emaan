// ==============================================
// king-room.js v7 — تبويبات جديدة + تعيين الملكة
// ==============================================
// ✅ v7:
//   1. تبويب 🔔 ردود تلقائية (hakawati_auto)
//   2. تبويب 🚫 المعاقبون (3 فلاتر + زر إعادة)
//   3. تبويب 🚨 الإبلاغات (جديدة/أرشيف)
//   4. محرر الغرف: nameColor + fontColor + fontSize
//   5. زر تبديل الزجاج/الكلاسيكي
//   6. زر إنشاء بروفايلات البوتات
//   7. openWelcomeEditor — محرر رسالة الترحيب
// ==============================================

(function () {
    'use strict';
    if (window.__kingRoomV7) return;
    window.__kingRoomV7 = true;

    var KR = {
        open: false,
        currentTab: 'overview',
        usersCache: {},
        usersList: [],
        filter: { query: '', status: 'all' },
        roomsSettings: {},
        tempIconImage: null,
        tempBgImage: null,
        queenSearchResults: null
    };

    function getMe() { return (typeof getCurrentUser === 'function') ? getCurrentUser() : null; }
    function isRoyal() { var u = getMe(); return !!(u && (u.rank === 'King' || u.rank === 'Queen')); }
    function isKing() { var u = getMe(); return !!(u && u.rank === 'King'); }
    function myLevel() { var u = getMe(); if (!u) return 0; return (typeof getRankLevel === 'function') ? getRankLevel(u.rank) : (u.rankLevel || 0); }
    function canDo(p) { var u = getMe(); if (!u || typeof can !== 'function') return false; return can(u, p); }
    function esc(s) { if (s == null) return ''; return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
    function timeAgo(ts) { if (!ts) return '—'; var s = Math.floor((Date.now() - ts) / 1000); if (s < 60) return 'الآن'; var m = Math.floor(s / 60); if (m < 60) return 'قبل ' + m + 'د'; var h = Math.floor(m / 60); if (h < 24) return 'قبل ' + h + 'س'; var d = Math.floor(h / 24); return 'قبل ' + d + 'ي'; }
    function toast(i, m) { if (typeof showToast === 'function') showToast(i, m); }
    function rankBadge(r) {
        var m = { 'King': '👑', 'Queen': '👸', 'Master Owner': '🌟', 'Room Owner': '🛡️', 'Grand Owner': '💎', 'Owner': '🏆', 'Super Admin': '🎖️', 'Admin': '🛠️', 'Premium': '💠', 'User': '👤' };
        return m[r] || '👤';
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

    /* ⭐ البحث عن مستخدم */
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
        var list = [
            { id: 'overview', label: '📊 نظرة' },
            { id: 'users', label: '👥 المستخدمون' }
        ];
        if (canDo('canPromote') || canDo('canDemote')) list.push({ id: 'ranks', label: '🎖️ الرتب' });
        if (isKing()) list.push({ id: 'queens', label: '👸 الملكات' });
        if (canDo('canWarn') || canDo('canJail') || canDo('canBan')) list.push({ id: 'punishments', label: '🚫 المعاقبون' });
        if (lvl >= 90) list.push({ id: 'reports', label: '🚨 الإبلاغات' });
        if ((canDo('canCreateRooms') || canDo('canEditRooms')) && lvl >= 80) list.push({ id: 'rooms', label: '🚪 الغرف' });
        list.push({ id: 'bots', label: '🤖 البوتات' });
        if (isKing()) list.push({ id: 'welcome', label: '🚪 الترحيب' });
        if (lvl >= 90) list.push({ id: 'alerts', label: '📢 تنبيه' });
        if (isKing()) list.push({ id: 'settings', label: '⚙️ إعدادات' });

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
        if (KR.currentTab === 'rooms') return renderRooms(body);
        if (KR.currentTab === 'bots') return renderBots(body);
        if (KR.currentTab === 'welcome') return renderWelcomeTab(body);
        if (KR.currentTab === 'alerts') return renderAlerts(body);
        if (KR.currentTab === 'settings') return renderSettings(body);
    }

    /* ═══ Overview ═══ */
    async function renderOverview(body) {
        body.innerHTML = '<div class="kr-loading">⏳</div>';
        try {
            var rs = await Promise.all([db.ref('users').limitToLast(500).once('value'), db.ref('user_presence').once('value')]);
            var users = rs[0].val() || {}, presence = rs[1].val() || {};
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

            body.innerHTML =
                '<div class="kr-stats">' +
                    '<div class="kr-stat"><div class="kr-stat-val">' + total + '</div><div class="kr-stat-lbl">👥 إجمالي</div></div>' +
                    '<div class="kr-stat"><div class="kr-stat-val" style="color:#84cc16;">' + online + '</div><div class="kr-stat-lbl">🟢 متصل</div></div>' +
                    '<div class="kr-stat"><div class="kr-stat-val" style="color:#ff9800;">' + jailed + '</div><div class="kr-stat-lbl">⛓️ مسجون</div></div>' +
                    '<div class="kr-stat"><div class="kr-stat-val" style="color:#ff4444;">' + banned + '</div><div class="kr-stat-lbl">🚪 محظور</div></div>' +
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
                    r.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 0;font-size:12px;';
                    r.innerHTML = '<img src="' + esc(u.avatar || 'https://ui-avatars.com/api/?name=U') + '" style="width:26px;height:26px;border-radius:50%;border:1px solid #ffd700;">' +
                        '<span style="color:#fff;font-weight:700;flex:1;">' + esc(u.name) + '</span>' +
                        '<span style="color:#888;font-size:10px;">📌 ' + esc(p.room || '—') + '</span>';
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

    /* ═══ Users ═══ */
    async function renderUsers(body) {
        body.innerHTML = '<div class="kr-loading">⏳</div>';
        try {
            var s = await db.ref('users').limitToLast(500).once('value');
            var all = s.val() || {};
            KR.usersList = Object.keys(all).map(function (uid) { var u = all[uid] || {}; u.uid = uid; return u; });
            KR.usersCache = all;
            buildUsersUI(body);
        } catch (e) { body.innerHTML = '<div class="kr-empty">❌</div>'; }
    }

    function buildUsersUI(body) {
        var h = '<input class="kr-input" id="kr-search" placeholder="🔍 بحث..." style="margin-bottom:8px;" value="' + esc(KR.filter.query) + '">';
        h += '<div class="kr-filters">';
        [['all', 'الكل'], ['jailed', 'مسجون'], ['banned', 'محظور'], ['admins', 'إداريين'], ['queens', 'ملكات'], ['kings', 'ملوك']].forEach(function (f) {
            h += '<button class="kr-chip' + (KR.filter.status === f[0] ? ' active' : '') + '" data-s="' + f[0] + '">' + f[1] + '</button>';
        });
        h += '</div><div id="kr-ulist"></div>';
        body.innerHTML = h;

        document.getElementById('kr-search').oninput = function () { KR.filter.query = this.value.trim(); renderUList(); };
        body.querySelectorAll('.kr-chip').forEach(function (c) {
            c.onclick = function () {
                KR.filter.status = c.getAttribute('data-s');
                body.querySelectorAll('.kr-chip').forEach(function (x) { x.classList.remove('active'); });
                c.classList.add('active');
                renderUList();
            };
        });
        renderUList();
    }

    function renderUList() {
        var l = document.getElementById('kr-ulist'); if (!l) return;
        var now = Date.now(), q = KR.filter.query.toLowerCase();
        var f = KR.usersList.filter(function (u) {
            if (q) {
                var n = (u.name || '').toLowerCase(), c = (u.code || '').toLowerCase(), e = (u.email || '').toLowerCase();
                if (n.indexOf(q) === -1 && c.indexOf(q) === -1 && e.indexOf(q) === -1) return false;
            }
            if (KR.filter.status === 'jailed') return u.isJailed && u.jailUntil && now < u.jailUntil;
            if (KR.filter.status === 'banned') return u.isBanned && u.bannedUntil && now < u.bannedUntil;
            if (KR.filter.status === 'admins') return (u.rankLevel || 0) >= 65;
            if (KR.filter.status === 'queens') return u.rank === 'Queen';
            if (KR.filter.status === 'kings') return u.rank === 'King';
            return true;
        });
        f.sort(function (a, b) { return (b.lastSeen || 0) - (a.lastSeen || 0); });
        l.innerHTML = '';
        if (!f.length) { l.innerHTML = '<div class="kr-empty">لا نتائج</div>'; return; }
        f.slice(0, 100).forEach(function (u) { l.appendChild(buildUCard(u)); });
    }

    function buildUCard(u) {
        var now = Date.now();
        var row = document.createElement('div');
        row.className = 'kr-user';
        var badges = '';
        if (u.rank === 'King') badges += '<span class="kr-badge kr-badge-king">👑 ملك</span>';
        else if (u.rank === 'Queen') badges += '<span class="kr-badge kr-badge-queen">👸 ' + (u.queenOrder === 2 ? 'ملكة 2' : 'ملكة 1') + '</span>';
        if (u.isBanned && u.bannedUntil && now < u.bannedUntil) badges += '<span class="kr-badge kr-badge-ban">🚪 محظور</span>';
        if (u.isJailed && u.jailUntil && now < u.jailUntil) badges += '<span class="kr-badge kr-badge-jail">⛓️ مسجون</span>';
        if ((u.warnings || 0) > 0) badges += '<span class="kr-badge kr-badge-warn">⚠️ ' + u.warnings + '</span>';

        row.innerHTML =
            '<img class="kr-user-avatar" src="' + esc(u.avatar || 'https://ui-avatars.com/api/?name=U') + '" onerror="this.src=\'https://ui-avatars.com/api/?name=U\'">' +
            '<div class="kr-user-info"><div class="kr-user-name">' + rankBadge(u.rank) + ' ' + esc(u.name || 'مجهول') + '</div>' +
            '<div class="kr-user-sub">' + esc(u.code || '—') + ' · ' + timeAgo(u.lastSeen) + '</div>' +
            (badges ? '<div class="kr-user-badges">' + badges + '</div>' : '') + '</div>' +
            '<button class="kr-icon-btn more" type="button">⋮</button>';
        row.querySelector('.more').onclick = function (e) { e.stopPropagation(); openActions(u, this); };
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

        var canP = typeof canPromoteTo === 'function' ? canPromoteTo(me, user, 'Room Owner') : false;
        var canD = typeof canDemoteUser === 'function' ? canDemoteUser(me, user) : false;
        var canB = typeof canBanUser === 'function' ? canBanUser(me, user) : false;
        var canJ = typeof canJailUser === 'function' ? canJailUser(me, user) : false;
        var canK = typeof canKickFromRoomUser === 'function' ? canKickFromRoomUser(me, user) : false;
        var canPts = (typeof canGivePointsTo === 'function') ? canGivePointsTo(me, user) : false;
        var canEdit = canDo('canEditAllProfiles');

        var h = '';
        if (canPts) h += '<div class="kr-menu-item" data-a="points">⭐ إهداء نقاط</div>';
        if (canP) h += '<div class="kr-menu-item" data-a="promote">🎖️ ترقية</div>';
        if (canD) h += '<div class="kr-menu-item" data-a="demote">📉 تخفيض</div>';
        if (canDo('canWarn')) h += '<div class="kr-menu-item" data-a="warn">⚠️ تحذير</div>';
        if (canJ) h += '<div class="kr-menu-item" data-a="jail">⛓️ سجن</div>';
        if (canK) h += '<div class="kr-menu-item" data-a="kick">🚪 طرد من الغرفة</div>';
        if (canB) h += '<div class="kr-menu-item danger" data-a="ban">🚫 حظر</div>';
        if (canEdit) h += '<div class="kr-menu-item" data-a="editProfile">🖼️ تعديل البروفايل</div>';

        if (isKing() && user.uid !== me.uid && user.rank !== 'King' && user.rank !== 'Queen') {
            h += '<div class="kr-menu-item" style="border-top:1px solid rgba(255,215,0,0.15);margin-top:4px;padding-top:10px;" data-a="makeQueen">👸 اجعلها ملكة</div>';
        }
        if (isKing() && user.rank === 'Queen' && user.uid !== me.uid) {
            h += '<div class="kr-menu-item" data-a="setQueenOrder1">👸 اجعلها الملكة الأولى</div>';
            h += '<div class="kr-menu-item" data-a="setQueenOrder2">👸 اجعلها الملكة الثانية</div>';
        }

        if (isKing() && user.uid !== me.uid) {
            if (user.rank === 'King' || user.rank === 'Queen' || user.rank === 'Master Owner') {
                h += '<div class="kr-menu-item" style="border-top:1px solid rgba(255,215,0,0.15);margin-top:4px;padding-top:10px;" data-a="striprank">👑 إزالة الرتبة</div>';
            }
        }
        if (isKing() && user.uid !== me.uid) {
            h += '<div class="kr-menu-item danger" data-a="deleteAccount">🗑️ حذف الحساب</div>';
        }

        if (!h) h = '<div class="kr-menu-item" style="color:#666;">لا إجراءات</div>';
        menu.innerHTML = h;
        menu.classList.add('open');

        var r = anchor.getBoundingClientRect();
        var w = 220, hh = menu.offsetHeight || 250;
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
        if (a === 'makeQueen') return askMakeQueen(u);
        if (a === 'setQueenOrder1') return setQueenOrder(u, 1);
        if (a === 'setQueenOrder2') return setQueenOrder(u, 2);
    }

    /* ⭐ تعيين ملكة */
    function askMakeQueen(user) {
        if (!isKing()) { toast('fa-lock', 'للملك فقط'); return; }
        var h = '<label style="display:block;color:#ffd700;font-size:12px;font-weight:900;margin-bottom:6px;">ترتيب الملكة:</label>';
        h += '<select id="kr-qorder" class="kr-select">';
        h += '<option value="1">الملكة الأولى</option>';
        h += '<option value="2">الملكة الثانية</option>';
        h += '</select>';
        openDlg('👸 تعيين ' + (user.name || '') + ' ملكة', '', h, async function () {
            var order = parseInt(document.getElementById('kr-qorder').value);
            await assignQueen(user.uid, order, user.name);
        });
    }

    async function assignQueen(uid, order, name) {
        var me = getMe();
        try {
            if (order === 1) {
                var allS = await db.ref('users').limitToLast(500).once('value');
                var allU = allS.val() || {};
                var q1 = Object.keys(allU).find(function (k) {
                    return allU[k].rank === 'Queen' && (allU[k].queenOrder === 1 || !allU[k].queenOrder);
                });
                if (q1 && q1 !== uid) {
                    if (!confirm('يوجد ملكة أولى → ستنزل للثانية. متابعة؟')) return;
                    await db.ref('users/' + q1).update({ queenOrder: 2 });
                }
            }
            await db.ref('users/' + uid).update({ rank: 'Queen', rankLevel: 95, queenOrder: order });
            db.ref('audit_log').push({
                type: 'set_queen', byUid: me.uid, byName: me.name,
                targetUid: uid, targetName: name || '',
                order: order, at: firebase.database.ServerValue.TIMESTAMP
            }).catch(function () {});
            toast('fa-crown', '✅ ' + (name || '') + ' أصبحت ' + (order === 1 ? 'الملكة الأولى' : 'الملكة الثانية'));
            renderTab();
        } catch (e) { toast('fa-times', 'فشل: ' + e.message); }
    }

    async function setQueenOrder(user, order) {
        if (!isKing()) { toast('fa-lock', 'للملك فقط'); return; }
        await assignQueen(user.uid, order, user.name);
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
                    var me = getMe();
                    db.ref('audit_log').push({ type: 'give_points', byUid: me.uid, byName: me.name, targetUid: user.uid, targetName: user.name, amount: a, at: firebase.database.ServerValue.TIMESTAMP }).catch(function () {});
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
            if (n === 'Queen') return askMakeQueenOrder(user);
            var l = (typeof getRankLevel === 'function') ? getRankLevel(n) : 50;
            db.ref('users/' + user.uid).update({ rank: n, rankLevel: l })
                .then(function () {
                    var me2 = getMe();
                    db.ref('audit_log').push({ type: 'promote', byUid: me2.uid, byName: me2.name, targetUid: user.uid, targetName: user.name, fromRank: user.rank, toRank: n, at: firebase.database.ServerValue.TIMESTAMP }).catch(function () {});
                    toast('fa-check', '✅'); renderTab();
                }).catch(function () { toast('fa-times', 'فشل'); });
        });
    }

    function askMakeQueenOrder(user) {
        var h = '<label style="display:block;color:#ffd700;font-size:12px;font-weight:900;margin-bottom:6px;">ترتيب الملكة:</label>';
        h += '<select id="kr-qorder" class="kr-select">';
        h += '<option value="1">الملكة الأولى</option>';
        h += '<option value="2">الملكة الثانية</option>';
        h += '</select>';
        openDlg('👸 ' + (user.name || ''), '', h, async function () {
            var order = parseInt(document.getElementById('kr-qorder').value);
            await assignQueen(user.uid, order, user.name);
        });
    }

    function doDemote(user) {
        var me = getMe();
        if (typeof canDemoteUser !== 'function' || !canDemoteUser(me, user)) { toast('fa-lock', 'لا صلاحية'); return; }
        openDlg('📉 تخفيض ' + (user.name || ''), 'سيُنزل إلى User.', '', function () {
            db.ref('users/' + user.uid).update({ rank: 'User', rankLevel: 50, queenOrder: null })
                .then(function () {
                    var me2 = getMe();
                    db.ref('audit_log').push({ type: 'demote', byUid: me2.uid, byName: me2.name, targetUid: user.uid, targetName: user.name, fromRank: user.rank, toRank: 'User', at: firebase.database.ServerValue.TIMESTAMP }).catch(function () {});
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
            db.ref('users/' + user.uid).update({ rank: 'User', rankLevel: 50, queenOrder: null })
                .then(function () {
                    db.ref('audit_log').push({ type: 'strip_rank', byUid: me.uid, byName: me.name, targetUid: user.uid, targetName: user.name, fromRank: user.rank, at: firebase.database.ServerValue.TIMESTAMP }).catch(function () {});
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
                db.ref('audit_log').push({ type: 'delete_account', byUid: me.uid, byName: me.name, targetUid: user.uid, targetName: name, at: firebase.database.ServerValue.TIMESTAMP }).catch(function () {});
                toast('fa-trash', '✅ حُذف الحساب');
                renderTab();
            }).catch(function (e) { toast('fa-times', 'فشل: ' + e.message); });
        }, 'حذف نهائي', 'kr-btn-red');
    }

    function doWarn(user) {
        var me = getMe();
        var h = '<label style="display:block;color:#ffd700;font-size:12px;font-weight:900;margin-bottom:6px;">سبب التحذير (اختياري):</label>';
        h += '<input class="kr-input" id="kr-reason">';
        openDlg('⚠️ تحذير ' + (user.name || ''), '', h, function () {
            var reason = document.getElementById('kr-reason').value.trim();
            db.ref('users/' + user.uid + '/warnings').transaction(function (c) { return (c || 0) + 1; })
                .then(function () {
                    db.ref('audit_log').push({ type: 'warn', byUid: me.uid, byName: me.name, targetUid: user.uid, targetName: user.name, reason: reason, at: firebase.database.ServerValue.TIMESTAMP }).catch(function () {});
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
            db.ref('users/' + user.uid).update({ isJailed: true, jailUntil: Date.now() + m * 60000, jailReason: 'إجراء إداري' })
                .then(function () {
                    db.ref('audit_log').push({ type: 'jail', byUid: me.uid, byName: me.name, targetUid: user.uid, targetName: user.name, minutes: m, at: firebase.database.ServerValue.TIMESTAMP }).catch(function () {});
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
                    db.ref('audit_log').push({ type: 'kick', byUid: me.uid, byName: me.name, targetUid: user.uid, targetName: user.name, room: room, at: firebase.database.ServerValue.TIMESTAMP }).catch(function () {});
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
                db.ref('audit_log').push({ type: 'ban', byUid: me.uid, byName: me.name, targetUid: user.uid, targetName: user.name, duration: dur, reason: reason || '', at: firebase.database.ServerValue.TIMESTAMP }).catch(function () {});
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

    /* ═══ Queens ═══ */
    async function renderQueens(body) {
        if (!isKing()) { body.innerHTML = '<div class="kr-empty">للملك فقط</div>'; return; }
        body.innerHTML = '<div class="kr-loading">⏳</div>';
        var s = await db.ref('users').limitToLast(500).once('value');
        var all = s.val() || {};
        var qs = Object.keys(all).map(function (uid) { var u = all[uid] || {}; u.uid = uid; return u; })
            .filter(function (u) { return u.rank === 'Queen'; });

        var h = '<div class="kr-card"><div class="kr-card-title">👸 الملكات (' + qs.length + ')</div>';
        if (!qs.length) h += '<div style="color:#888;text-align:center;padding:16px;">لا يوجد ملكة</div>';
        else qs.forEach(function (q) {
            h += '<div class="kr-user">' +
                '<img class="kr-user-avatar" src="' + esc(q.avatar || 'https://ui-avatars.com/api/?name=Q') + '">' +
                '<div class="kr-user-info">' +
                    '<div class="kr-user-name">👸 ' + esc(q.name) + '</div>' +
                    '<div class="kr-user-sub">' + (q.queenOrder === 2 ? 'الملكة الثانية' : 'الملكة الأولى') + '</div>' +
                '</div>' +
                '<button class="kr-icon-btn more" data-qopen="' + esc(q.uid) + '">⋮</button>' +
                '</div>';
        });
        h += '</div>';

        h += '<div class="kr-card">';
        h += '<div class="kr-card-title">➕ تعيين ملكة</div>';
        h += '<input class="kr-input" id="kr-qsearch" placeholder="🔍 اسم / كود / إيميل / UID" style="margin-bottom:8px;">';
        h += '<button class="kr-btn kr-btn-outline kr-btn-block" id="kr-qsearch-btn" style="margin-bottom:10px;">🔎 بحث</button>';
        h += '<div id="kr-qresults"></div>';
        h += '</div>';

        body.innerHTML = h;

        body.querySelectorAll('[data-qopen]').forEach(function (b) {
            b.onclick = function () {
                var qid = this.getAttribute('data-qopen');
                var q = qs.find(function (x) { return x.uid === qid; });
                if (q) openActions(q, this);
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
                    var hh = '<div style="color:#ffd700;font-size:12px;margin-bottom:8px;">وُجد ' + result.matches.length + ' نتيجة — اختر:</div>';
                    resultsBox.innerHTML = hh;
                    result.matches.slice(0, 20).forEach(function (m) {
                        resultsBox.appendChild(buildSearchResultCard(m.uid, m.data));
                    });
                    return;
                }
                resultsBox.innerHTML = '';
                resultsBox.appendChild(buildSearchResultCard(result.uid, result.data));
            } catch (e) {
                resultsBox.innerHTML = '<div style="text-align:center;color:#ff6666;padding:14px;font-size:12px;">❌ خطأ: ' + esc(e.message) + '</div>';
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
                '<div style="color:#888;font-size:10px;margin-top:2px;">' + esc(u.code || '—') + (u.email ? ' · ' + esc(u.email) : '') + '</div>';

            var btnQ1 = document.createElement('button');
            btnQ1.textContent = '👸 الأولى';
            btnQ1.style.cssText = 'padding:8px 10px;background:#ffd700;color:#000;border:none;border-radius:8px;font-weight:900;font-size:11px;cursor:pointer;font-family:inherit;';
            btnQ1.onclick = async function () {
                await assignQueen(uid, 1, u.name);
                resultsBox.innerHTML = '';
                searchInput.value = '';
            };

            var btnQ2 = document.createElement('button');
            btnQ2.textContent = '👸 الثانية';
            btnQ2.style.cssText = 'padding:8px 10px;background:rgba(255,215,0,0.2);color:#ffd700;border:1px solid rgba(255,215,0,0.5);border-radius:8px;font-weight:900;font-size:11px;cursor:pointer;font-family:inherit;';
            btnQ2.onclick = async function () {
                await assignQueen(uid, 2, u.name);
                resultsBox.innerHTML = '';
                searchInput.value = '';
            };

            el.appendChild(img);
            el.appendChild(info);
            el.appendChild(btnQ1);
            el.appendChild(btnQ2);
            return el;
        }

        searchBtn.onclick = doSearch;
        searchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') doSearch();
        });
    }

    /* ═══════════════════════════════════════════ */
    /* ⭐ v7: المعاقبون                              */
    /* ═══════════════════════════════════════════ */
    async function renderPunishments(body) {
        body.innerHTML = '<div class="kr-loading">⏳</div>';
        try {
            var s = await db.ref('users').limitToLast(500).once('value');
            var all = s.val() || {};
            var now = Date.now();
            var allUsers = Object.keys(all).map(function (uid) { var u = all[uid] || {}; u.uid = uid; return u; });

            KR._punishmentFilter = KR._punishmentFilter || 'jailed';

            var renderList = function() {
                var filter = KR._punishmentFilter;
                var filtered = allUsers.filter(function(u) {
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

                filtered.forEach(function(u) {
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

                listEl.querySelectorAll('[data-restore]').forEach(function(btn) {
                    btn.onclick = async function() {
                        var uid = this.getAttribute('data-restore');
                        var u = filtered.find(function(x) { return x.uid === uid; });
                        if (!u) return;
                        if (!confirm('إعادة ' + u.name + '؟')) return;
                        try {
                            await db.ref('users/' + uid).update({
                                isJailed: false,
                                jailUntil: 0,
                                isBanned: false,
                                bannedUntil: 0,
                                permanentBan: false,
                                jailReleasedAt: Date.now()
                            });
                            // إزالة من قائمة الطرد من الروم إن وجد
                            try {
                                var kicks = await db.ref('room_kicks').once('value');
                                var allKicks = kicks.val() || {};
                                Object.keys(allKicks).forEach(function(rid) {
                                    if (allKicks[rid] && allKicks[rid][uid]) {
                                        db.ref('room_kicks/' + rid + '/' + uid).remove().catch(function(){});
                                    }
                                });
                            } catch(e) {}
                            toast('fa-check', '✅ تمت الإعادة');
                            renderTab();
                        } catch(e) {
                            toast('fa-times', '⚠️ فشل: ' + e.message);
                        }
                    };
                });
            };

            var h = '<div class="kr-filters" id="kr-pun-filters">';
            h += '<button class="kr-chip' + (KR._punishmentFilter === 'jailed' ? ' active' : '') + '" data-pf="jailed">⛓️ المسجونون</button>';
            h += '<button class="kr-chip' + (KR._punishmentFilter === 'banned' ? ' active' : '') + '" data-pf="banned">🚫 المحظورون</button>';
            h += '<button class="kr-chip' + (KR._punishmentFilter === 'perm' ? ' active' : '') + '" data-pf="perm">🛑 المطرودون نهائياً</button>';
            h += '</div>';
            h += '<div id="kr-pun-list"></div>';
            body.innerHTML = h;

            body.querySelectorAll('[data-pf]').forEach(function(c) {
                c.onclick = function() {
                    KR._punishmentFilter = c.getAttribute('data-pf');
                    body.querySelectorAll('[data-pf]').forEach(function(x) { x.classList.remove('active'); });
                    c.classList.add('active');
                    renderList();
                };
            });

            renderList();
        } catch(e) {
            body.innerHTML = '<div class="kr-empty">❌ ' + esc(e.message) + '</div>';
        }
    }

    /* ═══════════════════════════════════════════ */
    /* ⭐ v7: الإبلاغات                              */
    /* ═══════════════════════════════════════════ */
    async function renderReports(body) {
        body.innerHTML = '<div class="kr-loading">⏳</div>';
        try {
            KR._reportFilter = KR._reportFilter || 'new';

            var renderList = async function() {
                var filter = KR._reportFilter;
                var path = filter === 'archive' ? 'reports_archive' : 'reports';
                var snap = await db.ref(path).limitToLast(100).once('value');
                var data = snap.val() || {};
                var list = Object.keys(data).map(function(k) {
                    var r = data[k]; r._id = k; return r;
                }).sort(function(a, b) { return (b.time || 0) - (a.time || 0); });

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

                list.forEach(function(r) {
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
                        (r.messageText ? '<div style="color:#ffcccc;font-size:11px;background:rgba(0,0,0,0.4);padding:6px;border-radius:6px;margin:6px 0;word-break:break-word;">' + esc(r.messageText) + '</div>' : '') +
                        (r.roomId ? '<div style="color:#888;font-size:10px;margin-bottom:8px;">📌 ' + esc(r.roomId) + (r.isPrivate ? ' (خاص)' : '') + '</div>' : '');

                    var actions = document.createElement('div');
                    actions.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;';

                    if (filter === 'new') {
                        var doneBtn = document.createElement('button');
                        doneBtn.className = 'kr-btn kr-btn-green kr-btn-sm';
                        doneBtn.textContent = '✅ معالجة';
                        doneBtn.onclick = async function() {
                            if (!confirm('تمت المعالجة؟ سيُنقل للأرشيف.')) return;
                            try {
                                var me = getMe();
                                var archiveData = Object.assign({}, r, {
                                    processedAt: Date.now(),
                                    processedBy: me ? me.uid : null,
                                    processedByName: me ? me.name : 'مشرف'
                                });
                                delete archiveData._id;
                                await db.ref('reports_archive/' + r._id).set(archiveData);
                                await db.ref('reports/' + r._id).remove();
                                toast('fa-check', '✅ تمت المعالجة');
                                renderTab();
                            } catch(e) {
                                toast('fa-times', '⚠️ فشل: ' + e.message);
                            }
                        };

                        var viewUserBtn = document.createElement('button');
                        viewUserBtn.className = 'kr-btn kr-btn-outline kr-btn-sm';
                        viewUserBtn.textContent = '👤 عرض المستخدم';
                        viewUserBtn.onclick = function() {
                            if (r.targetUid && typeof window.openUserProfile === 'function') {
                                closeRoom();
                                setTimeout(function() { window.openUserProfile(r.targetUid, r.targetName || ''); }, 200);
                            }
                        };

                        var msgBtn = document.createElement('button');
                        msgBtn.className = 'kr-btn kr-btn-outline kr-btn-sm';
                        msgBtn.textContent = '📨 مراجعة رسائله';
                        msgBtn.onclick = function() {
                            if (r.targetUid && typeof ReviewUI !== 'undefined' && ReviewUI.open) {
                                closeRoom();
                                setTimeout(function() { ReviewUI.open(r.targetUid); }, 200);
                            } else {
                                toast('fa-info-circle', '📨 قريباً');
                            }
                        };

                        actions.appendChild(doneBtn);
                        actions.appendChild(viewUserBtn);
                        actions.appendChild(msgBtn);
                    }

                    card.appendChild(actions);
                    listEl.appendChild(card);
                });
            };

            var h = '<div class="kr-filters" id="kr-report-filters">';
            h += '<button class="kr-chip' + (KR._reportFilter === 'new' ? ' active' : '') + '" data-rf="new">🆕 جديدة</button>';
            h += '<button class="kr-chip' + (KR._reportFilter === 'archive' ? ' active' : '') + '" data-rf="archive">📦 أرشيف</button>';
            h += '</div>';
            h += '<div id="kr-reports-list"></div>';
            body.innerHTML = h;

            body.querySelectorAll('[data-rf]').forEach(function(c) {
                c.onclick = function() {
                    KR._reportFilter = c.getAttribute('data-rf');
                    body.querySelectorAll('[data-rf]').forEach(function(x) { x.classList.remove('active'); });
                    c.classList.add('active');
                    renderList();
                };
            });

            renderList();
        } catch(e) {
            body.innerHTML = '<div class="kr-empty">❌ ' + esc(e.message) + '</div>';
        }
    }

    /* ═══ Rooms — محدّث v7 (nameColor + fontColor + fontSize) ═══ */
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
            var hc = (c.bgValue || c.bgImage) ? ' · 🎨' : '';
            var fc = (c.fontColor || c.fontSize) ? ' · 🖍️' : '';
            h += '<div class="kr-user" style="margin-bottom:8px;">' +
                '<div style="font-size:22px;width:34px;text-align:center;display:flex;align-items:center;justify-content:center;">' + hasImg + '</div>' +
                '<div class="kr-user-info"><div class="kr-user-name">' + esc(n) + '</div><div class="kr-user-sub">' + esc(rid) + hc + fc + '</div></div>' +
                '<button class="kr-icon-btn more" data-r="' + esc(rid) + '" title="تعديل">✏️</button>' +
                '<button class="kr-icon-btn ban" data-c="' + esc(rid) + '" title="حذف كل الرسائل" style="margin-right:4px;">🗑️</button>' +
                '</div>';
        });
        h += '</div>';
        body.innerHTML = h;
        body.querySelectorAll('[data-r]').forEach(function (b) { b.onclick = function () { editRoom(this.getAttribute('data-r')); }; });
        body.querySelectorAll('[data-c]').forEach(function (b) { b.onclick = function () { clearRoom(this.getAttribute('data-c')); }; });
    }

    function clearRoom(rid) {
        if (myLevel() < 90) { toast('fa-lock', '🔒 Master+ فقط'); return; }
        var rn = (QAMAR.ROOMS[rid] && QAMAR.ROOMS[rid].name) || rid;
        openDlg('🗑️ حذف كل رسائل ' + rn, '<div style="color:#ff8888;font-size:13px;line-height:1.6;">⚠️ <b>لا يمكن التراجع!</b></div>', '', function () {
            if (!confirm('تأكيد نهائي: حذف كل رسائل ' + rn + '؟')) return false;
            toast('fa-spinner', '⏳ جاري الحذف...');
            db.ref('room_messages/' + rid).remove()
                .then(function () {
                    var me = getMe();
                    db.ref('audit_log').push({ type: 'clear_room', byUid: me.uid, byName: me.name, roomId: rid, roomName: rn, at: firebase.database.ServerValue.TIMESTAMP }).catch(function () {});
                    if (typeof ChatState !== 'undefined' && ChatState.currentRoom === rid) {
                        var mc = document.getElementById('messages');
                        if (mc) mc.innerHTML = '';
                    }
                    toast('fa-check', '✅ تم');
                }).catch(function (e) { toast('fa-times', 'فشل: ' + e.message); });
        }, 'حذف نهائي', 'kr-btn-red');
    }

    function editRoom(rid) {
        if (myLevel() < 80) { toast('fa-lock', '🔒 Grand Owner+ فقط'); return; }
        var room = QAMAR.ROOMS[rid];
        if (!room) return;
        var c = KR.roomsSettings[rid] || {};
        KR.tempIconImage = c.iconImage || null;
        KR.tempBgImage = c.bgImage || null;
        var currentIcon = c.icon || room.icon;
        var currentNameColor = c.nameColor || '#ffd700';
        var currentFontColor = c.fontColor || '#ffffff';
        var currentFontSize = c.fontSize || 16;

        var h = '';
        h += '<label style="display:block;color:#ffd700;font-size:12px;font-weight:900;margin-bottom:6px;">الاسم:</label>';
        h += '<input class="kr-input" id="kr-rn" value="' + esc(c.name || room.name) + '" style="margin-bottom:14px;" maxlength="30">';

        h += '<label style="display:block;color:#ffd700;font-size:12px;font-weight:900;margin-bottom:6px;">🎨 لون اسم الغرفة (في السيدبار):</label>';
        h += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;">';
        h += '<input type="color" id="kr-name-color" value="' + currentNameColor + '" style="width:60px;height:40px;border:2px solid #ffd700;border-radius:8px;cursor:pointer;background:transparent;">';
        h += '<span id="kr-name-color-val" style="color:#fff;font-size:12px;font-family:monospace;">' + currentNameColor + '</span>';
        h += '</div>';

        h += '<label style="display:block;color:#ffd700;font-size:12px;font-weight:900;margin-bottom:6px;">🖍️ لون خط الشات:</label>';
        h += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;">';
        h += '<input type="color" id="kr-font-color" value="' + currentFontColor + '" style="width:60px;height:40px;border:2px solid #ffd700;border-radius:8px;cursor:pointer;background:transparent;">';
        h += '<span id="kr-font-color-val" style="color:#fff;font-size:12px;font-family:monospace;">' + currentFontColor + '</span>';
        h += '</div>';

        h += '<label style="display:block;color:#ffd700;font-size:12px;font-weight:900;margin-bottom:6px;">📏 حجم خط الشات (12-28px):</label>';
        h += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;">';
        h += '<input type="range" id="kr-font-size" min="12" max="28" value="' + currentFontSize + '" style="flex:1;">';
        h += '<span id="kr-font-size-val" style="color:#ffd700;font-weight:900;font-size:13px;min-width:40px;text-align:center;">' + currentFontSize + 'px</span>';
        h += '</div>';

        h += '<label style="display:block;color:#ffd700;font-size:12px;font-weight:900;margin-bottom:6px;">الأيقونة (emoji):</label>';
        h += '<input class="kr-input" id="kr-ri" value="' + esc(currentIcon) + '" style="margin-bottom:8px;" maxlength="4">';

        h += '<label style="display:block;color:#ffd700;font-size:12px;font-weight:900;margin-bottom:6px;">أو صورة الأيقونة:</label>';
        h += '<div style="display:flex;align-items:center;gap:8px;padding:10px;background:rgba(0,0,0,0.3);border-radius:10px;border:1px dashed rgba(255,215,0,0.3);margin-bottom:14px;">';
        h += '<div id="kr-img-box" style="width:52px;height:52px;border-radius:10px;background:rgba(255,215,0,0.1);display:flex;align-items:center;justify-content:center;font-size:26px;overflow:hidden;">' + (c.iconImage ? '<img src="' + c.iconImage + '" style="width:100%;height:100%;object-fit:cover;">' : '🖼️') + '</div>';
        h += '<div style="flex:1;color:#bbb;font-size:11px;">' + (c.iconImage ? 'صورة مرفوعة' : 'لم يتم رفع صورة') + '</div>';
        h += '<button type="button" class="kr-btn kr-btn-gold kr-btn-sm" id="kr-img-pick">📤 رفع</button>';
        h += '<button type="button" class="kr-btn kr-btn-red kr-btn-sm" id="kr-img-clear">🗑️</button>';
        h += '</div>';
        h += '<input type="file" id="kr-img-file" accept="image/*" style="display:none;">';

        h += '<label style="display:block;color:#ffd700;font-size:12px;font-weight:900;margin-bottom:6px;">نوع الخلفية:</label>';
        h += '<select id="kr-rbt" class="kr-select" style="margin-bottom:10px;">';
        h += '<option value="">افتراضي (بدون)</option>';
        h += '<option value="color"' + (c.bgType === 'color' ? ' selected' : '') + '>لون سادة</option>';
        h += '<option value="image"' + (c.bgType === 'image' && !c.bgImage ? ' selected' : '') + '>صورة (URL)</option>';
        h += '<option value="custom"' + (c.bgType === 'custom' || c.bgImage ? ' selected' : '') + '>صورة من الجهاز</option>';
        h += '<option value="gradient"' + (c.bgType === 'gradient' ? ' selected' : '') + '>تدرج CSS</option>';
        h += '</select>';

        h += '<label style="display:block;color:#ffd700;font-size:12px;font-weight:900;margin-bottom:6px;">قيمة الخلفية (URL/hex/gradient):</label>';
        h += '<input class="kr-input" id="kr-rbv" value="' + esc(c.bgValue || '') + '" placeholder="#hex أو URL أو linear-gradient(...)" style="margin-bottom:10px;">';

        h += '<label style="display:block;color:#ffd700;font-size:12px;font-weight:900;margin-bottom:6px;">أو خلفية من الجهاز:</label>';
        h += '<div style="display:flex;align-items:center;gap:8px;padding:10px;background:rgba(0,0,0,0.3);border-radius:10px;border:1px dashed rgba(255,215,0,0.3);">';
        h += '<div id="kr-bg-box" style="width:52px;height:52px;border-radius:10px;background:rgba(255,215,0,0.1);display:flex;align-items:center;justify-content:center;font-size:26px;overflow:hidden;">' + (c.bgImage ? '<img src="' + c.bgImage + '" style="width:100%;height:100%;object-fit:cover;">' : '🎨') + '</div>';
        h += '<div style="flex:1;color:#bbb;font-size:11px;">' + (c.bgImage ? 'خلفية مرفوعة' : 'لم يتم رفع خلفية') + '</div>';
        h += '<button type="button" class="kr-btn kr-btn-gold kr-btn-sm" id="kr-bg-pick">📤 رفع</button>';
        h += '<button type="button" class="kr-btn kr-btn-red kr-btn-sm" id="kr-bg-clear">🗑️</button>';
        h += '</div>';
        h += '<input type="file" id="kr-bg-file" accept="image/*" style="display:none;">';

        openDlg('✏️ ' + room.name, '', h, function () {
            saveRoom(rid, {
                name: document.getElementById('kr-rn').value.trim(),
                icon: document.getElementById('kr-ri').value.trim(),
                iconImage: KR.tempIconImage,
                bgImage: KR.tempBgImage,
                bgType: document.getElementById('kr-rbt').value,
                bgValue: document.getElementById('kr-rbv').value.trim(),
                nameColor: document.getElementById('kr-name-color').value,
                fontColor: document.getElementById('kr-font-color').value,
                fontSize: parseInt(document.getElementById('kr-font-size').value)
            });
        }, 'حفظ', 'kr-btn-green');

        setTimeout(function () {
            // لون اسم الغرفة
            var nc = document.getElementById('kr-name-color');
            var ncv = document.getElementById('kr-name-color-val');
            if (nc && ncv) {
                nc.oninput = function() { ncv.textContent = this.value; };
            }
            // لون خط الشات
            var fc = document.getElementById('kr-font-color');
            var fcv = document.getElementById('kr-font-color-val');
            if (fc && fcv) {
                fc.oninput = function() { fcv.textContent = this.value; };
            }
            // حجم خط الشات
            var fs = document.getElementById('kr-font-size');
            var fsv = document.getElementById('kr-font-size-val');
            if (fs && fsv) {
                fs.oninput = function() { fsv.textContent = this.value + 'px'; };
            }
            // الأيقونة
            var pickBtn = document.getElementById('kr-img-pick');
            var fileInput = document.getElementById('kr-img-file');
            var clearBtn = document.getElementById('kr-img-clear');
            var imgBox = document.getElementById('kr-img-box');

            if (pickBtn && fileInput) {
                pickBtn.onclick = function () { fileInput.click(); };
                fileInput.onchange = async function () {
                    var f = this.files[0]; if (!f) return;
                    if (f.size / (1024 * 1024) > 3) { toast('fa-times', 'الحد 3MB'); return; }
                    pickBtn.textContent = '⏳...'; pickBtn.disabled = true;
                    try {
                        var b64 = await fileToBase64(f, 96, 0.85);
                        KR.tempIconImage = b64;
                        imgBox.innerHTML = '<img src="' + b64 + '" style="width:100%;height:100%;object-fit:cover;">';
                        pickBtn.textContent = '✅';
                        toast('fa-check', 'تم');
                    } catch (e) { toast('fa-times', 'فشل: ' + e.message); pickBtn.textContent = '📤 رفع'; }
                    pickBtn.disabled = false;
                };
            }
            if (clearBtn) {
                clearBtn.onclick = function () { KR.tempIconImage = null; imgBox.textContent = '🖼️'; toast('fa-check', 'أزيلت'); };
            }

            var pickBg = document.getElementById('kr-bg-pick');
            var fileBg = document.getElementById('kr-bg-file');
            var clearBg = document.getElementById('kr-bg-clear');
            var bgBox = document.getElementById('kr-bg-box');

            if (pickBg && fileBg) {
                pickBg.onclick = function () { fileBg.click(); };
                fileBg.onchange = async function () {
                    var f = this.files[0]; if (!f) return;
                    if (f.size / (1024 * 1024) > 5) { toast('fa-times', 'الحد 5MB'); return; }
                    pickBg.textContent = '⏳...'; pickBg.disabled = true;
                    try {
                        var b64 = await fileToBase64(f, 1280, 0.8);
                        KR.tempBgImage = b64;
                        bgBox.innerHTML = '<img src="' + b64 + '" style="width:100%;height:100%;object-fit:cover;">';
                        pickBg.textContent = '✅';
                        var typeSel = document.getElementById('kr-rbt');
                        if (typeSel) typeSel.value = 'custom';
                        toast('fa-check', 'تم رفع الخلفية');
                    } catch (e) { toast('fa-times', 'فشل: ' + e.message); pickBg.textContent = '📤 رفع'; }
                    pickBg.disabled = false;
                };
            }
            if (clearBg) {
                clearBg.onclick = function () { KR.tempBgImage = null; bgBox.textContent = '🎨'; toast('fa-check', 'أزيلت'); };
            }
        }, 100);
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
                if (d.iconImage !== undefined) {
                    if (d.iconImage) QAMAR.ROOMS[rid].iconImage = d.iconImage;
                    else delete QAMAR.ROOMS[rid].iconImage;
                }
                if (d.bgImage !== undefined) {
                    if (d.bgImage) QAMAR.ROOMS[rid].bgImage = d.bgImage;
                    else delete QAMAR.ROOMS[rid].bgImage;
                }
                QAMAR.ROOMS[rid].bgType = d.bgType || null;
                QAMAR.ROOMS[rid].bgValue = d.bgValue || null;
                QAMAR.ROOMS[rid].nameColor = d.nameColor || null;
                QAMAR.ROOMS[rid].fontColor = d.fontColor || null;
                QAMAR.ROOMS[rid].fontSize = d.fontSize || null;
            }

            if (typeof buildRoomsList === 'function') buildRoomsList();
            if (typeof ChatState !== 'undefined' && ChatState.currentRoom === rid) {
                var t = document.getElementById('room-title');
                if (t) t.textContent = (d.name || QAMAR.ROOMS[rid].name) + ' ' + (d.icon || QAMAR.ROOMS[rid].icon);
                if (typeof applyRoomBackground === 'function') applyRoomBackground(rid);
                if (typeof applyRoomFont === 'function') {
                    applyRoomFont({ fontColor: d.fontColor, fontSize: d.fontSize });
                }
            }

            db.ref('audit_log').push({ type: 'edit_room', byUid: me.uid, byName: me.name, roomId: rid, at: firebase.database.ServerValue.TIMESTAMP }).catch(function () {});
            toast('fa-check', '✅');
            renderRooms(document.getElementById('kr-body'));
        } catch (e) { toast('fa-times', 'فشل: ' + e.message); }
    }

    /* ═══ Bots — محدّث v7 (+ زر بروفايلات البوتات) ═══ */
    function renderBots(body) {
        var h = '<div class="kr-card"><div class="kr-card-title">🤖 إدارة البوتات</div>';
        h += '<div style="color:#888;font-size:11px;margin-bottom:14px;">حكواتي · مسابقات · إسلاميات · سجن · طرد · سفير</div>';
        h += '<button class="kr-btn kr-btn-gold kr-btn-block" id="kr-ob" style="margin-bottom:8px;">🤖 فتح لوحة البوتات</button>';
        h += '<button class="kr-btn kr-btn-outline kr-btn-block" id="kr-create-bot-profiles">🆕 إنشاء بروفايلات البوتات</button>';
        h += '<div style="color:#888;font-size:10px;margin-top:6px;text-align:center;">ينشئ سجلات users/bot_* إن لم تكن موجودة</div>';
        h += '</div>';
        body.innerHTML = h;

        document.getElementById('kr-ob').onclick = function () {
            closeRoom();
            setTimeout(function () { if (typeof window.openBotManager === 'function') window.openBotManager(); }, 200);
        };

        document.getElementById('kr-create-bot-profiles').onclick = async function () {
            if (!confirm('إنشاء/إعادة تعيين بروفايلات البوتات الـ4؟')) return;
            var btns = document.querySelectorAll('#kr-create-bot-profiles');
            btns.forEach(function(b) { b.disabled = true; b.textContent = '⏳ جاري الإنشاء...'; });
            try {
                var bots = [
                    { id: 'guardian', name: 'السجان', rank: 'Guardian', bio: '🚔 حارس القوانين — لا مكان للمسيء', color: '#ff4444' },
                    { id: 'hakawati', name: 'حكواتي الشام', rank: 'Storyteller', bio: '📖 صديقك في كل سؤال · اكتب اسمي وأنا أرد', color: '#9C27B0' },
                    { id: 'quiz', name: 'الشاطر', rank: 'Quiz Master', bio: '🎯 أسئلة ممتعة · نقاط قيمة · فرص متساوية', color: '#FF9800' },
                    { id: 'islamic', name: 'قمر الشام', rank: 'Islamic', bio: '🌙 ذكر ودعاء وصلاة على النبي ﷺ', color: '#d4af37' },
                    { id: 'ambassador', name: 'السفير', rank: 'Ambassador', bio: '🚪 يرحّب بالأعضاء الجدد في قمر الشام', color: '#84cc16' }
                ];
                var now = Date.now();
                for (var i = 0; i < bots.length; i++) {
                    var b = bots[i];
                    var uid = 'bot_' + b.id;
                    var avatar = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(b.name) + '&background=111&color=ffd700&bold=true&size=128';
                    await db.ref('users/' + uid).update({
                        uid: uid,
                        name: b.name,
                        code: 'BOT·' + b.id.substring(0, 3).toUpperCase(),
                        rank: b.rank,
                        rankLevel: 50,
                        isBot: true,
                        botId: b.id,
                        bio: b.bio,
                        avatar: avatar,
                        color: b.color,
                        createdAt: now,
                        lastSeen: now,
                        isGuest: false
                    });
                }
                toast('fa-check', '✅ تم إنشاء ' + bots.length + ' بروفايلات');
                btns.forEach(function(b) { b.disabled = false; b.textContent = '🆕 إنشاء بروفايلات البوتات'; });
            } catch (e) {
                toast('fa-times', '⚠️ فشل: ' + e.message);
                btns.forEach(function(b) { b.disabled = false; b.textContent = '🆕 إنشاء بروفايلات البوتات'; });
            }
        };
    }

    /* ═══════════════════════════════════════════ */
    /* ⭐ v7: تبويب الترحيب                           */
    /* ═══════════════════════════════════════════ */
    async function renderWelcomeTab(body) {
        if (!isKing()) { body.innerHTML = '<div class="kr-empty">للملك فقط</div>'; return; }
        body.innerHTML = '<div class="kr-loading">⏳</div>';
        try {
            var s = await db.ref('room_settings').once('value');
            var settings = s.val() || {};
            var h = '<div class="kr-card"><div class="kr-card-title">🚪 رسائل الترحيب لكل غرفة</div>';
            h += '<div style="color:#888;font-size:11px;margin-bottom:12px;">اضغط ✏️ لتعديل رسالة الترحيب</div>';

            Object.keys(QAMAR.ROOMS).forEach(function(rid) {
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
                        '<div class="kr-user-sub">' + (enabled ? '✅ مفعّل' : '❌ معطّل') + ' · ' + esc(text.substring(0, 30)) + '...</div>' +
                    '</div>' +
                    '<button class="kr-icon-btn more" data-wedit="' + esc(rid) + '">✏️</button>' +
                    '</div>';
            });
            h += '</div>';
            body.innerHTML = h;

            body.querySelectorAll('[data-wedit]').forEach(function(b) {
                b.onclick = function() {
                    var rid = this.getAttribute('data-wedit');
                    openWelcomeEditor(rid);
                };
            });
        } catch(e) {
            body.innerHTML = '<div class="kr-empty">❌ ' + esc(e.message) + '</div>';
        }
    }

    /* ⭐ v7: محرر الترحيب — يُستدعى من index.html أيضاً */
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
        h += '<div style="color:#888;font-size:10px;margin-top:4px;">المتغيرات: {name} = اسم العضو، {room} = اسم الغرفة</div>';

        h += '<div style="display:flex;align-items:center;gap:10px;margin-top:14px;padding:8px 0;">';
        h += '<input type="checkbox" id="kw-enabled" ' + (welcome.enabled !== false ? 'checked' : '') + ' style="width:20px;height:20px;accent-color:#ffd700;cursor:pointer;">';
        h += '<label for="kw-enabled" style="flex:1;color:#ddd;font-size:13px;font-weight:700;cursor:pointer;">✅ تفعيل الترحيب في هذه الغرفة</label>';
        h += '</div>';

        h += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;">';
        h += '<input type="checkbox" id="kw-sound" ' + (welcome.sound !== false ? 'checked' : '') + ' style="width:20px;height:20px;accent-color:#ffd700;cursor:pointer;">';
        h += '<label for="kw-sound" style="flex:1;color:#ddd;font-size:13px;font-weight:700;cursor:pointer;">🔊 تشغيل نغمة ترحيب</label>';
        h += '</div>';

        h += '<label style="display:block;color:#ffd700;font-size:12px;font-weight:900;margin-bottom:6px;margin-top:12px;">مدة Cooldown (دقيقة):</label>';
        h += '<input class="kr-input" id="kw-cd" type="number" min="1" max="60" value="' + (welcome.cooldown || 5) + '">';

        openDlg('🚪 ترحيب: ' + roomName, '', h, async function() {
            var newText = document.getElementById('kw-text').value;
            var enabled = document.getElementById('kw-enabled').checked;
            var sound = document.getElementById('kw-sound').checked;
            var cooldown = parseInt(document.getElementById('kw-cd').value) || 5;
            try {
                await db.ref('room_settings/' + rid + '/welcome').update({
                    text: newText,
                    enabled: enabled,
                    sound: sound,
                    cooldown: cooldown,
                    updatedAt: Date.now(),
                    updatedBy: (getMe() || {}).uid
                });
                toast('fa-check', '✅ تم الحفظ');
                if (KR.open) renderTab();
            } catch(e) {
                toast('fa-times', '⚠️ فشل: ' + e.message);
            }
        }, 'حفظ', 'kr-btn-green');
    }

    // تصدير للخارج (index.html يستدعيه)
    window.openWelcomeEditor = openWelcomeEditor;

    /* ═══ Alerts ═══ */
    function renderAlerts(body) {
        var has = (typeof RoomAlerts !== 'undefined');
        var h = '<div class="kr-card"><div class="kr-card-title">📢 إرسال تنبيه منبثق</div>';
        h += '<div style="color:#888;font-size:11px;margin-bottom:14px;">يظهر لكل من في الغرفة مع صوت مميز</div>';
        if (has) h += '<button class="kr-btn kr-btn-gold kr-btn-block" id="kr-oa">📢 فتح النافذة</button>';
        else h += '<div style="text-align:center;color:#ff6666;padding:20px;">⚠️ نظام التنبيهات غير محمَّل</div>';
        h += '</div>';
        body.innerHTML = h;
        var b = document.getElementById('kr-oa');
        if (b) b.onclick = function () { closeRoom(); setTimeout(function () { RoomAlerts.open(); }, 200); };
    }

    /* ═══ Settings — محدّث v7 (زر الزجاج) ═══ */
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

        // ⭐ v7: قسم المظهر
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

        // ⭐ تبديل الزجاجي/الكلاسيكي
        document.getElementById('kr-style-toggle').onclick = function () {
            var cur = localStorage.getItem('qamar_sidebar_style') || 'classic';
            var next = cur === 'glass' ? 'classic' : 'glass';
            localStorage.setItem('qamar_sidebar_style', next);
            document.body.classList.toggle('sidebar-glass', next === 'glass');
            document.body.classList.toggle('sidebar-classic', next === 'classic');
            toast('fa-check', next === 'glass' ? '💎 الشكل الزجاجي' : '◻️ الشكل الكلاسيكي');
            this.textContent = next === 'glass' ? '💻 التبديل إلى: كلاسيكي' : '💎 التبديل إلى: زجاجي';
        };
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

    console.log('👑 king-room.js v7 loaded — punishments + reports + welcome editor');
})();
