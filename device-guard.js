// ==============================================
// device-guard.js v6 (TEST)
// ==============================================
// ✅ v6 (فوق v5):
//   1. بصمة مزدوجة: UUID + IP
//   2. جداول جديدة: device_uuid_map + device_ip_map
//   3. الكشف عبر الجدولين معاً
//   4. الحماية ضد VPN (UUID) وضد Incognito (IP)
//   v5 محفوظ: لا منع + إشعار فقط
// ==============================================

(function () {
    'use strict';
    if (window.__deviceGuardV6) return;
    window.__deviceGuardV6 = true;

    var DG = {
        uuid: null,
        uuidIsNew: false,
        deviceId: null,       // IP-based (كما v5)
        uuidHash: null,       // UUID-based
        ipHash: null,
        ip: null,
        ready: false,
        _afterAuthDone: {},
        _forceLogout: false,
        _watchingBanned: false
    };

    /* ═══ Hash — 48 حرف ═══ */
    function _hash(str) {
        if (!str) return '';
        var h1 = 5381, h2 = 52711, h3 = 41999, h4 = 33107;
        for (var i = 0; i < str.length; i++) {
            var c = str.charCodeAt(i);
            h1 = ((h1 * 33) ^ c) >>> 0;
            h2 = ((h2 * 31) ^ c) >>> 0;
            h3 = ((h3 * 37) ^ c) >>> 0;
            h4 = ((h4 * 41) ^ c) >>> 0;
        }
        var out = h1.toString(36) + h2.toString(36) + h3.toString(36) + h4.toString(36);
        return 'dg_' + out.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 48);
    }

    /* ═══ UUID Generator ═══ */
    function _generateUUID() {
        try {
            if (crypto && crypto.randomUUID) return crypto.randomUUID();
        } catch (e) {}
        /* Fallback */
        var t = Date.now().toString(36);
        var r = Math.random().toString(36).substring(2);
        return 'u-' + t + '-' + r + '-' + Math.random().toString(36).substring(2);
    }

    /* ═══ بصمة IP (كما v5) ═══ */
    function _buildIpDeviceId() {
        var parts = [];
        if (DG.ipHash) parts.push('IP:' + DG.ipHash);
        try { parts.push('SW:' + (screen.width || 0)); } catch (e) {}
        try { parts.push('SH:' + (screen.height || 0)); } catch (e) {}
        try { parts.push('L:' + (navigator.language || '').substring(0, 2)); } catch (e) {}
        try { parts.push('TZ:' + (Intl.DateTimeFormat().resolvedOptions().timeZone || '')); } catch (e) {}
        return _hash(parts.join('|'));
    }

    /* ═══ Device metadata ═══ */
    function _getDeviceMetadata() {
        var meta = {};
        try { meta.ua = (navigator.userAgent || '').substring(0, 200); } catch (e) {}
        try { meta.screen = (screen.width || 0) + 'x' + (screen.height || 0); } catch (e) {}
        try { meta.lang = navigator.language || ''; } catch (e) {}
        try { meta.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
        try { meta.platform = navigator.platform || ''; } catch (e) {}
        return meta;
    }

    /* ═══ IP ═══ */
    async function _fetchIp() {
        try {
            var controller = new AbortController();
            var timer = setTimeout(function () { controller.abort(); }, 3500);
            var res = await fetch(QAMAR.IP_SERVICE, { signal: controller.signal });
            clearTimeout(timer);
            if (!res.ok) return null;
            var data = await res.json();
            if (data && data.ip) return data.ip;
        } catch (e) {
            console.warn('🛡️ IP fetch failed:', e.message);
        }
        return null;
    }

    /* ═══ Init ═══ */
    async function _init() {
        try {
            /* 1. UUID من localStorage */
            var storedUuid = null;
            try { storedUuid = localStorage.getItem('qamar_device_uuid'); } catch (e) {}

            if (storedUuid && storedUuid.length > 10) {
                DG.uuid = storedUuid;
                DG.uuidIsNew = false;
                console.log('🛡️ DeviceGuard v6: UUID من cache');
            } else {
                DG.uuid = _generateUUID();
                DG.uuidIsNew = true;
                try { localStorage.setItem('qamar_device_uuid', DG.uuid); } catch (e) {}
                console.log('🛡️ DeviceGuard v6: UUID جديد');
            }

            DG.uuidHash = _hash('uuid_' + DG.uuid);

            /* 2. IP */
            var ip = await _fetchIp();
            if (ip) {
                DG.ip = ip;
                DG.ipHash = _hash('ip_' + ip);
                try { localStorage.setItem(QAMAR.STORAGE_KEYS.IP_HASH, DG.ipHash); } catch (e) {}
                console.log('🛡️ DeviceGuard v6: IP =', ip);
            } else {
                var cachedIp = localStorage.getItem(QAMAR.STORAGE_KEYS.IP_HASH);
                if (cachedIp) {
                    DG.ipHash = cachedIp;
                    console.log('🛡️ DeviceGuard v6: IP من cache');
                }
            }

            /* 3. بناء deviceId */
            DG.deviceId = _buildIpDeviceId();
            console.log('🛡️ DeviceGuard v6: deviceId =', DG.deviceId);
            console.log('🛡️ DeviceGuard v6: uuidHash =', DG.uuidHash);

            DG.ready = true;
        } catch (e) {
            console.error('🛡️ DeviceGuard v6 init failed:', e);
            DG.ready = true;
        }
    }

    /* ═══ preCheck ═══ */
    async function preCheck() {
        if (!DG.ready) {
            await new Promise(function (r) {
                var t = setInterval(function () {
                    if (DG.ready) { clearInterval(t); r(); }
                }, 100);
                setTimeout(function () { clearInterval(t); r(); }, 8000);
            });
        }
        if (!DG.deviceId) return { allowed: true, reason: null };

        try {
            /* فحص البان بـ IP deviceId */
            var banSnap = await db.ref(QAMAR.PATHS.BANNED_DEVICES + '/' + DG.deviceId).once('value');
            if (banSnap.exists()) {
                return { allowed: false, reason: '🚫 هذا الجهاز محظور من الدخول' };
            }
            /* فحص البان بـ UUID */
            if (DG.uuidHash) {
                var uuidBanSnap = await db.ref(QAMAR.PATHS.BANNED_DEVICES + '/' + DG.uuidHash).once('value');
                if (uuidBanSnap.exists()) {
                    return { allowed: false, reason: '🚫 هذا الجهاز محظور من الدخول' };
                }
            }
            if (DG.ipHash) {
                var ipBanSnap = await db.ref(QAMAR.PATHS.BANNED_IPS + '/' + DG.ipHash).once('value');
                if (ipBanSnap.exists()) {
                    return { allowed: false, reason: '🚫 شبكتك محظورة من الدخول' };
                }
            }
        } catch (e) {
            console.warn('🛡️ preCheck error:', e);
        }
        return { allowed: true, reason: null };
    }

    /* ═══ afterAuth — v6 الكشف المزدوج ═══ */
    async function afterAuth(uid, name) {
        if (!uid || !DG.deviceId) return;

        var last = DG._afterAuthDone[uid] || 0;
        if (Date.now() - last < 10000) return;
        DG._afterAuthDone[uid] = Date.now();

        try {
            /* فحص البان */
            var banSnap = await db.ref(QAMAR.PATHS.BANNED_DEVICES + '/' + DG.deviceId).once('value');
            if (banSnap.exists()) {
                if (typeof showToast === 'function') showToast('fa-ban', '🚫 تم حظر جهازك');
                setTimeout(_forceLogout, 1500);
                return;
            }

            /* ═══ 1. سجّل في الجدولين (UUID + IP) ═══ */
            var now = Date.now();
            var meta = _getDeviceMetadata();

            await Promise.all([
                /* device_uuid_map */
                db.ref('device_uuid_map/' + DG.uuidHash + '/uids/' + uid).set({
                    name: name || 'مجهول',
                    at: now
                }).catch(function (e) { console.warn('uuid_map write:', e); }),

                /* device_ip_map */
                DG.ipHash
                    ? db.ref('device_ip_map/' + DG.ipHash + '/uids/' + uid).set({
                        name: name || 'مجهول',
                        at: now
                    }).catch(function (e) { console.warn('ip_map write:', e); })
                    : Promise.resolve()
            ]);

            /* ═══ 2. سجّل في device_registry (كما v5) ═══ */
            await register(uid, name);

            /* ═══ 3. اقرأ الجدولين واجمع uids ═══ */
            var uuidUids = [];
            var ipUids = [];

            try {
                var uuidSnap = await db.ref('device_uuid_map/' + DG.uuidHash + '/uids').once('value');
                uuidSnap.forEach(function (c) { uuidUids.push(c.key); });
            } catch (e) {}

            if (DG.ipHash) {
                try {
                    var ipSnap = await db.ref('device_ip_map/' + DG.ipHash + '/uids').once('value');
                    ipSnap.forEach(function (c) { ipUids.push(c.key); });
                } catch (e) {}
            }

            /* اجمع - إزالة التكرار */
            var allUids = {};
            uuidUids.forEach(function (u) { allUids[u] = true; });
            ipUids.forEach(function (u) { allUids[u] = true; });
            var uidList = Object.keys(allUids);

            console.log('🛡️ DeviceGuard v6:',
                'uuid_uids =', uuidUids.length,
                '| ip_uids =', ipUids.length,
                '| total =', uidList.length);

            /* ═══ 4. إذا > 1 → تنبيه ═══ */
            if (uidList.length > 1) {
                var others = uidList.filter(function (u) { return u !== uid; });
                if (others.length > 0) {
                    console.warn('🛡️ device_login_alert:', uid.substring(0, 8), 'vs', others.length, 'others');
                    await _handleMultiAccount(uid, name, others);
                }
            }

        } catch (e) {
            console.warn('🛡️ afterAuth error:', e);
        }
    }

    /* ═══ register — v6 مع device_registry + maps ═══ */
    async function register(uid, name) {
        if (!uid || !DG.deviceId) return;
        try {
            var now = Date.now();
            var meta = _getDeviceMetadata();
            var ops = [
                db.ref(QAMAR.PATHS.DEVICE_REGISTRY + '/' + DG.deviceId + '/' + uid).set({
                    name: name || 'مجهول',
                    at: now,
                    uuid: DG.uuid || '',
                    ua: meta.ua || '',
                    screen: meta.screen || '',
                    platform: meta.platform || ''
                }),
                db.ref('users/' + uid + '/devices/' + DG.deviceId).set({ at: now })
            ];
            if (DG.ipHash) {
                ops.push(db.ref(QAMAR.PATHS.IP_REGISTRY + '/' + DG.ipHash + '/' + uid).set({
                    name: name || 'مجهول',
                    at: now,
                    ip: DG.ip || ''
                }));
                ops.push(db.ref('users/' + uid + '/ipHashes/' + DG.ipHash).set({
                    at: now,
                    ip: DG.ip || ''
                }));
            }
            await Promise.all(ops);
        } catch (e) {
            console.warn('🛡️ register error:', e);
        }
    }

    /* ═══ _handleMultiAccount ═══ */
    async function _handleMultiAccount(uid, name, existingUids) {
        try {
            var now = Date.now();
            var meta = _getDeviceMetadata();

            /* 1. audit_log */
            try {
                await db.ref(QAMAR.PATHS.AUDIT_LOG).push({
                    type: 'device_login_alert',
                    uid: uid,
                    name: name || '',
                    deviceId: DG.deviceId,
                    uuidHash: DG.uuidHash,
                    ipHash: DG.ipHash || '',
                    ip: DG.ip || '',
                    existingUids: existingUids,
                    at: firebase.database.ServerValue.TIMESTAMP
                });
            } catch (e) {}

            /* 2. multi_account_alerts */
            try {
                await db.ref(QAMAR.PATHS.MULTI_ACCOUNT_ALERTS).push({
                    uid: uid,
                    name: name || 'مجهول',
                    deviceId: DG.deviceId,
                    uuidHash: DG.uuidHash,
                    ipHash: DG.ipHash || '',
                    ip: DG.ip || '',
                    existingUids: existingUids,
                    meta: meta,
                    at: now,
                    status: 'pending',
                    type: 'device_login'
                });
            } catch (e) {}

            /* 3. إشعار الملك */
            try { await _notifyKing(uid, name, existingUids); } catch (e) {}

            /* 4. رسالة صغيرة للمستخدم */
            if (typeof showToast === 'function') {
                showToast('fa-shield', '👋 أهلاً — جهازك مسجل');
            }

        } catch (e) {
            console.warn('🛡️ _handleMultiAccount error:', e);
        }
    }

    /* ═══ _notifyKing ═══ */
    async function _notifyKing(uid, name, existingUids) {
        try {
            var kingSnap = await db.ref('config/king_uid').once('value');
            var kingUid = kingSnap.val();
            if (!kingUid) return;

            var names = [];
            for (var i = 0; i < existingUids.length && i < 10; i++) {
                try {
                    var nSnap = await db.ref('users/' + existingUids[i] + '/name').once('value');
                    names.push(nSnap.val() || existingUids[i].substring(0, 8));
                } catch (e) {}
            }

            var text = '🚔 تسجيل دخول من نفس الجهاز\n\n' +
                       '👤 الحساب الجديد: ' + (name || 'مجهول') + '\n' +
                       '🆔 UUID: ' + (DG.uuid || '').substring(0, 12) + '...\n' +
                       '🌐 الشبكة: ' + (DG.ip || '—') + '\n' +
                       '👥 الحسابات الموجودة: ' + (names.length ? names.join('، ') : '—') + '\n\n' +
                       '🕐 ' + new Date().toLocaleString('ar-EG');

            var now = Date.now();

            /* guardian_inbox */
            try {
                var inboxKey = db.ref('guardian_inbox/' + kingUid).push().key;
                await db.ref('guardian_inbox/' + kingUid + '/' + inboxKey).set({
                    from: 'bot_guardian',
                    type: 'device_login',
                    text: text,
                    suspectUid: uid,
                    suspectName: name || '',
                    deviceId: DG.deviceId,
                    uuidHash: DG.uuidHash,
                    ip: DG.ip || '',
                    existingUids: existingUids,
                    at: now,
                    read: false
                });
            } catch (e) {}

            /* user_notifications */
            try {
                await db.ref('user_notifications/' + kingUid).push({
                    fromUid: 'bot_guardian',
                    fromName: '🚔 السجان',
                    fromAvatar: '',
                    type: 'device_login',
                    preview: '🚔 دخول من نفس الجهاز: ' + (name || 'مجهول'),
                    icon: '🚔',
                    urgent: false,
                    read: false,
                    time: now,
                    data: {
                        suspectUid: uid,
                        suspectName: name,
                        deviceId: DG.deviceId,
                        uuidHash: DG.uuidHash,
                        ip: DG.ip,
                        existingUids: existingUids
                    }
                });
            } catch (e) {}

        } catch (e) {
            console.warn('🛡️ _notifyKing error:', e);
        }
    }

    /* ═══ _forceLogout ═══ */
    function _forceLogout() {
        if (DG._forceLogout) return;
        DG._forceLogout = true;
        try {
            if (typeof cleanupAllListeners === 'function') cleanupAllListeners();
            if (typeof logout === 'function') {
                logout().then(function () { location.reload(); });
            } else {
                location.reload();
            }
        } catch (e) { location.reload(); }
    }

    /* ═══ hook login buttons ═══ */
    function _hookLoginButtons() {
        var names = ['handleGuestLogin', 'handleMemberLogin', 'handleRegister'];
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            var allDone = true;
            names.forEach(function (name) {
                var orig = window[name];
                if (typeof orig !== 'function') { allDone = false; return; }
                if (orig.__dgWrapped) return;
                var wrapped = async function (btn) {
                    if (btn && btn.disabled) return;
                    if (btn) btn.disabled = true;
                    try {
                        var check = await preCheck();
                        if (!check.allowed) {
                            alert(check.reason || '🚫 لا يمكن الدخول من هذا الجهاز');
                            if (btn) btn.disabled = false;
                            return;
                        }
                    } catch (e) {}
                    if (btn) btn.disabled = false;
                    return orig.apply(this, arguments);
                };
                wrapped.__dgWrapped = true;
                window[name] = wrapped;
            });
            if (allDone || attempts >= 100) clearInterval(t);
        }, 100);
    }

    /* ═══ hook initChat ═══ */
    function _hookInitChat() {
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            var orig = window.initChat;
            if (typeof orig !== 'function') {
                if (attempts >= 60) clearInterval(t);
                return;
            }
            if (orig.__dgWrapped) { clearInterval(t); return; }
            var wrapped = function () {
                try {
                    var me = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
                    if (me && me.uid) {
                        afterAuth(me.uid, me.name).catch(function (e) {
                            console.warn('afterAuth error:', e);
                        });
                    }
                } catch (e) {}
                return orig.apply(this, arguments);
            };
            wrapped.__dgWrapped = true;
            window.initChat = wrapped;
            clearInterval(t);
        }, 100);
    }

    /* ═══ watch banned ═══ */
    function _watchBanned() {
        if (DG._watchingBanned) return;
        if (!DG.deviceId || typeof db === 'undefined' || !db) return;
        DG._watchingBanned = true;
        try {
            db.ref(QAMAR.PATHS.BANNED_DEVICES + '/' + DG.deviceId).on('value', function (snap) {
                if (snap.exists()) {
                    if (typeof showToast === 'function') showToast('fa-ban', '🚫 تم حظر جهازك');
                    setTimeout(_forceLogout, 1500);
                }
            });
            if (DG.uuidHash) {
                db.ref(QAMAR.PATHS.BANNED_DEVICES + '/' + DG.uuidHash).on('value', function (snap) {
                    if (snap.exists()) {
                        if (typeof showToast === 'function') showToast('fa-ban', '🚫 تم حظر جهازك');
                        setTimeout(_forceLogout, 1500);
                    }
                });
            }
        } catch (e) {}
    }

    /* ═══ ban / unban ═══ */
    async function ban(targetUid, byUid, byName, reason) {
        if (!targetUid) return false;
        try {
            var payload = {
                uid: targetUid,
                by: byUid || null,
                byName: byName || 'King',
                reason: reason || 'permanent_ban',
                at: Date.now()
            };
            var devSnap = await db.ref('users/' + targetUid + '/devices').once('value');
            var ipsSnap = await db.ref('users/' + targetUid + '/ipHashes').once('value');
            var devs = devSnap.val() || {};
            var ips = ipsSnap.val() || {};
            var ops = [];
            Object.keys(devs).forEach(function (devId) {
                ops.push(db.ref(QAMAR.PATHS.BANNED_DEVICES + '/' + devId).set(payload));
            });
            Object.keys(ips).forEach(function (ipH) {
                ops.push(db.ref(QAMAR.PATHS.BANNED_IPS + '/' + ipH).set(payload));
            });
            await Promise.all(ops);
            return true;
        } catch (e) {
            console.warn('🛡️ ban error:', e);
            return false;
        }
    }

    async function unban(targetUid) {
        if (!targetUid) return false;
        try {
            var devSnap = await db.ref('users/' + targetUid + '/devices').once('value');
            var ipsSnap = await db.ref('users/' + targetUid + '/ipHashes').once('value');
            var devs = devSnap.val() || {};
            var ips = ipsSnap.val() || {};
            var ops = [];
            Object.keys(devs).forEach(function (devId) {
                ops.push(db.ref(QAMAR.PATHS.BANNED_DEVICES + '/' + devId).remove());
            });
            Object.keys(ips).forEach(function (ipH) {
                ops.push(db.ref(QAMAR.PATHS.BANNED_IPS + '/' + ipH).remove());
            });
            await Promise.all(ops);
            return true;
        } catch (e) {
            console.warn('🛡️ unban error:', e);
            return false;
        }
    }

    /* ═══ Public API ═══ */
    window.DeviceGuard = {
        preCheck: preCheck,
        afterAuth: afterAuth,
        register: register,
        ban: ban,
        unban: unban,
        getDeviceId: function () { return DG.deviceId; },
        getUuidHash: function () { return DG.uuidHash; },
        getUuid: function () { return DG.uuid; },
        getIpHash: function () { return DG.ipHash; },
        getIp: function () { return DG.ip; },
        isReady: function () { return DG.ready; },
        version: 6
    };

    /* ═══ Boot ═══ */
    function _boot() {
        _init().then(function () {
            _hookLoginButtons();
            _hookInitChat();
            setTimeout(_watchBanned, 3000);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _boot);
    } else {
        _boot();
    }

    console.log('🛡️ device-guard.js v6 (TEST) loaded — dual fingerprint (UUID + IP)');
})();
