// ==============================================
// device-guard.js v1 (TEST) — بصمة + IP + منع تعدد
// ==============================================
// ✅ v1:
//   1. بصمة متقدمة (Canvas + WebGL + Audio + Fonts + Battery + Media)
//   2. IP من ipwho.is
//   3. فحص banned_devices + banned_ips قبل الدخول
//   4. منع الحسابات المكرّرة من نفس الجهاز
//   5. حظر + إشعار الملك عند المحاولة
//   6. listener للبان أثناء الجلسة
// ==============================================

(function () {
    'use strict';
    if (window.__deviceGuardV1) return;
    window.__deviceGuardV1 = true;

    var DG = {
        deviceId: null,
        ipHash: null,
        ip: null,
        ready: false,
        _afterAuthDone: {},
        _forceLogout: false,
        _watchingBanned: false
    };

    /* ══════════════════════════════════════════════ */
    /* Hash                                           */
    /* ══════════════════════════════════════════════ */
    function _hash(str) {
        if (!str) return '';
        var h1 = 5381, h2 = 52711;
        for (var i = 0; i < str.length; i++) {
            var c = str.charCodeAt(i);
            h1 = ((h1 * 33) ^ c) >>> 0;
            h2 = ((h2 * 31) ^ c) >>> 0;
        }
        var h3 = (h1 ^ h2) >>> 0;
        var out = h1.toString(36) + h2.toString(36) + h3.toString(36) + ((h1 + h2 + h3) >>> 0).toString(36);
        return 'dg_' + out.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 32);
    }

    /* ══════════════════════════════════════════════ */
    /* بناء بصمة الجهاز                               */
    /* ══════════════════════════════════════════════ */
    async function _buildDeviceId() {
        var parts = [];

        /* 1. UA + language + platform */
        try { parts.push(navigator.userAgent || ''); } catch (e) { parts.push(''); }
        try { parts.push(navigator.language || ''); } catch (e) { parts.push(''); }
        try { parts.push(navigator.platform || ''); } catch (e) { parts.push(''); }
        try { parts.push(String(navigator.hardwareConcurrency || 0)); } catch (e) { parts.push(''); }
        try { parts.push(String(navigator.deviceMemory || 0)); } catch (e) { parts.push(''); }

        /* 2. Screen */
        try {
            var s = window.screen || {};
            parts.push([s.width || 0, s.height || 0, s.colorDepth || 0, s.pixelDepth || 0].join('x'));
            parts.push(String(window.devicePixelRatio || 1));
        } catch (e) { parts.push(''); }

        /* 3. Timezone */
        try {
            parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
        } catch (e) { parts.push(''); }

        /* 4. Canvas */
        try {
            var canvas = document.createElement('canvas');
            canvas.width = 220;
            canvas.height = 60;
            var ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.textBaseline = 'top';
                ctx.font = '14px "Arial"';
                ctx.fillStyle = '#f60';
                ctx.fillRect(125, 1, 62, 20);
                ctx.fillStyle = '#069';
                ctx.fillText('Qamar🌙 الشام', 2, 15);
                ctx.fillStyle = 'rgba(102,204,0,0.7)';
                ctx.fillText('Qamar🌙 الشام', 4, 17);
                parts.push(canvas.toDataURL().substring(0, 200));
            }
        } catch (e) { parts.push(''); }

        /* 5. WebGL */
        try {
            var gl = document.createElement('canvas').getContext('webgl') ||
                     document.createElement('canvas').getContext('experimental-webgl');
            if (gl) {
                var dbg = gl.getExtension('WEBGL_debug_renderer_info');
                if (dbg) {
                    parts.push(String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || ''));
                    parts.push(String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || ''));
                }
                parts.push(String(gl.getParameter(gl.VERSION) || ''));
                parts.push(String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION) || ''));
            }
        } catch (e) { parts.push(''); }

        /* 6. AudioContext */
        try {
            var AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
            if (AC) {
                var audioCtx = new AC(1, 44100, 44100);
                var osc = audioCtx.createOscillator();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(10000, audioCtx.currentTime);
                var comp = audioCtx.createDynamicsCompressor();
                osc.connect(comp);
                comp.connect(audioCtx.destination);
                osc.start(0);
                var audioHash = await Promise.race([
                    new Promise(function (resolve) {
                        audioCtx.oncomplete = function (e) {
                            try {
                                var buf = e.renderedBuffer.getChannelData(0);
                                var sum = 0;
                                for (var i = 4500; i < 5000; i++) sum += Math.abs(buf[i]);
                                resolve(sum.toString().substring(0, 20));
                            } catch (err) { resolve(''); }
                        };
                        audioCtx.startRendering();
                    }),
                    new Promise(function (r) { setTimeout(function () { r(''); }, 1200); })
                ]);
                parts.push(audioHash);
            }
        } catch (e) { parts.push(''); }

        /* 7. Fonts */
        try {
            var fontList = ['Arial','Verdana','Times New Roman','Courier New','Georgia',
                            'Tahoma','Comic Sans MS','Impact','Cairo','Amiri','Roboto',
                            'Helvetica','Monaco','Consolas'];
            var span = document.createElement('span');
            span.style.cssText = 'position:absolute;left:-9999px;top:-9999px;font-size:72px;visibility:hidden;';
            span.textContent = 'mmmmmmmmmmlli';
            document.body.appendChild(span);
            var detected = [];
            fontList.forEach(function (f) {
                span.style.fontFamily = 'monospace';
                var base = span.offsetWidth;
                span.style.fontFamily = '"' + f + '", monospace';
                var test = span.offsetWidth;
                if (test !== base) detected.push(f);
            });
            document.body.removeChild(span);
            parts.push(detected.join(','));
        } catch (e) { parts.push(''); }

        /* 8. Battery */
        try {
            if (navigator.getBattery) {
                var bat = await Promise.race([
                    navigator.getBattery(),
                    new Promise(function (r) { setTimeout(function () { r(null); }, 800); })
                ]);
                if (bat) {
                    parts.push(bat.charging ? '1' : '0');
                    if (typeof bat.level === 'number') parts.push(bat.level.toFixed(2));
                }
            }
        } catch (e) {}

        /* 9. Media Devices */
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
                var devs = await Promise.race([
                    navigator.mediaDevices.enumerateDevices(),
                    new Promise(function (r) { setTimeout(function () { r([]); }, 800); })
                ]);
                if (Array.isArray(devs)) {
                    var cnt = { audioinput: 0, audiooutput: 0, videoinput: 0 };
                    devs.forEach(function (d) {
                        if (cnt[d.kind] !== undefined) cnt[d.kind]++;
                    });
                    parts.push(cnt.audioinput + '_' + cnt.audiooutput + '_' + cnt.videoinput);
                }
            }
        } catch (e) {}

        return _hash(parts.join('|||'));
    }

    /* ══════════════════════════════════════════════ */
    /* جلب IP                                         */
    /* ══════════════════════════════════════════════ */
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

    /* ══════════════════════════════════════════════ */
    /* Init                                           */
    /* ══════════════════════════════════════════════ */
    async function _init() {
        try {
            /* deviceId — من cache أو بناء جديد */
            var cachedDevice = localStorage.getItem(QAMAR.STORAGE_KEYS.DEVICE_ID);
            if (cachedDevice && cachedDevice.length > 10) {
                DG.deviceId = cachedDevice;
                console.log('🛡️ DeviceGuard: deviceId من cache');
            } else {
                try {
                    DG.deviceId = await _buildDeviceId();
                    try { localStorage.setItem(QAMAR.STORAGE_KEYS.DEVICE_ID, DG.deviceId); } catch (e) {}
                    console.log('🛡️ DeviceGuard: deviceId جديد');
                } catch (e) {
                    console.warn('🛡️ deviceId build failed:', e);
                }
            }

            /* IP */
            var ip = await _fetchIp();
            if (ip) {
                DG.ip = ip;
                DG.ipHash = _hash('ip_' + ip);
                try { localStorage.setItem(QAMAR.STORAGE_KEYS.IP_HASH, DG.ipHash); } catch (e) {}
                console.log('🛡️ DeviceGuard: IP محمّل');
            } else {
                var cachedIp = localStorage.getItem(QAMAR.STORAGE_KEYS.IP_HASH);
                if (cachedIp) {
                    DG.ipHash = cachedIp;
                    console.log('🛡️ DeviceGuard: IP من cache');
                }
            }

            DG.ready = true;
        } catch (e) {
            console.error('🛡️ DeviceGuard init failed:', e);
            DG.ready = true;
        }
    }

    /* ══════════════════════════════════════════════ */
    /* preCheck (قبل الدخول)                          */
    /* ══════════════════════════════════════════════ */
    async function preCheck() {
        /* ننتظر الـ init */
        if (!DG.ready) {
            await new Promise(function (r) {
                var t = setInterval(function () {
                    if (DG.ready) { clearInterval(t); r(); }
                }, 100);
                setTimeout(function () { clearInterval(t); r(); }, 4000);
            });
        }
        if (!DG.deviceId) return { allowed: true, reason: null };

        try {
            /* banned_devices */
            var banSnap = await db.ref(QAMAR.PATHS.BANNED_DEVICES + '/' + DG.deviceId).once('value');
            if (banSnap.exists()) {
                return { allowed: false, reason: '🚫 هذا الجهاز محظور من الدخول' };
            }
            /* banned_ips */
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

    /* ══════════════════════════════════════════════ */
    /* afterAuth (بعد نجاح الدخول)                    */
    /* ══════════════════════════════════════════════ */
    async function afterAuth(uid, name) {
        if (!uid || !DG.deviceId) return;

        /* منع التكرار خلال 10 ثواني لنفس الـ uid */
        var last = DG._afterAuthDone[uid] || 0;
        if (Date.now() - last < 10000) return;
        DG._afterAuthDone[uid] = Date.now();

        try {
            /* فحص البان مرة ثانية */
            var banSnap = await db.ref(QAMAR.PATHS.BANNED_DEVICES + '/' + DG.deviceId).once('value');
            if (banSnap.exists()) {
                if (typeof showToast === 'function') showToast('fa-ban', '🚫 تم حظر جهازك');
                setTimeout(_forceLogout, 1500);
                return;
            }
            if (DG.ipHash) {
                var ipBanSnap = await db.ref(QAMAR.PATHS.BANNED_IPS + '/' + DG.ipHash).once('value');
                if (ipBanSnap.exists()) {
                    if (typeof showToast === 'function') showToast('fa-ban', '🚫 تم حظر شبكتك');
                    setTimeout(_forceLogout, 1500);
                    return;
                }
            }

            /* فحص device_registry */
            var regSnap = await db.ref(QAMAR.PATHS.DEVICE_REGISTRY + '/' + DG.deviceId).once('value');
            var registered = regSnap.val() || {};
            var registeredUids = Object.keys(registered);

            if (registeredUids.length === 0) {
                /* أول مرة على هذا الجهاز */
                await register(uid, name);
                return;
            }

            if (registeredUids.indexOf(uid) !== -1) {
                /* مستخدم عائد */
                await register(uid, name);   /* تحديث lastSeen */
                return;
            }

            /* حساب ثانٍ! */
            console.warn('🛡️ multi-account detected:', uid, 'vs', registeredUids);
            await _handleMultiAccount(uid, name, registeredUids);

        } catch (e) {
            console.warn('🛡️ afterAuth error:', e);
        }
    }

    /* ══════════════════════════════════════════════ */
    /* register                                       */
    /* ══════════════════════════════════════════════ */
    async function register(uid, name) {
        if (!uid || !DG.deviceId) return;
        try {
            var now = Date.now();
            var ua = (navigator.userAgent || '').substring(0, 120);
            var ops = [
                db.ref(QAMAR.PATHS.DEVICE_REGISTRY + '/' + DG.deviceId + '/' + uid).set({
                    name: name || 'مجهول',
                    at: now,
                    ua: ua
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
            console.log('🛡️ DeviceGuard: registered', uid.substring(0, 8));
        } catch (e) {
            console.warn('🛡️ register error:', e);
        }
    }

    /* ══════════════════════════════════════════════ */
    /* _handleMultiAccount                            */
    /* ══════════════════════════════════════════════ */
    async function _handleMultiAccount(uid, name, existingUids) {
        try {
            /* فحص رتبة المستخدم الجديد */
            var snap = await db.ref('users/' + uid).once('value');
            var d = snap.val() || {};

            /* استثناء الملك */
            if (d.rank === 'King') {
                console.log('🛡️ King exception — allow');
                await register(uid, name);
                return;
            }

            /* حظر الحساب الجديد */
            var now = Date.now();
            await db.ref('users/' + uid).update({
                isBanned: true,
                bannedUntil: now + 365 * 24 * 60 * 60 * 1000,
                permanentBan: true,
                banReason: 'multi_account_same_device'
            });

            /* تسجيل في audit_log */
            try {
                db.ref(QAMAR.PATHS.AUDIT_LOG).push({
                    type: 'multi_account_block',
                    uid: uid,
                    name: name || '',
                    deviceId: DG.deviceId,
                    ipHash: DG.ipHash || '',
                    existingUids: existingUids,
                    at: firebase.database.ServerValue.TIMESTAMP
                }).catch(function () {});
            } catch (e) {}

            /* إضافة في multi_account_alerts */
            try {
                db.ref(QAMAR.PATHS.MULTI_ACCOUNT_ALERTS).push({
                    uid: uid,
                    name: name || 'مجهول',
                    deviceId: DG.deviceId,
                    ipHash: DG.ipHash || '',
                    ip: DG.ip || '',
                    existingUids: existingUids,
                    at: now,
                    status: 'pending'
                }).catch(function () {});
            } catch (e) {}

            /* إشعار الملك */
            await _notifyKing(uid, name, existingUids);

            /* حذف بيانات الحساب الجديد */
            try {
                var code = d.code;
                await db.ref('users/' + uid).remove();
                await db.ref('user_presence/' + uid).remove();
                if (name) await db.ref('user_names/' + name).remove().catch(function () {});
                if (code) await db.ref('user_codes/' + code).remove().catch(function () {});
            } catch (e) { console.warn('cleanup failed:', e); }

            /* حذف Firebase auth user */
            try {
                if (typeof auth !== 'undefined' && auth && auth.currentUser && auth.currentUser.uid === uid) {
                    await auth.currentUser.delete().catch(function () {});
                }
            } catch (e) {}

            /* إشعار + خروج */
            alert('🚫 هذا الجهاز مرتبط بحساب آخر.\n\nتم رفض الدخول وإبلاغ الإدارة.');
            _forceLogout();

        } catch (e) {
            console.warn('🛡️ _handleMultiAccount error:', e);
        }
    }

    /* ══════════════════════════════════════════════ */
    /* إشعار الملك                                    */
    /* ══════════════════════════════════════════════ */
    async function _notifyKing(uid, name, existingUids) {
        try {
            var kingSnap = await db.ref('config/king_uid').once('value');
            var kingUid = kingSnap.val();
            if (!kingUid) return;

            /* أسماء الحسابات الموجودة */
            var names = [];
            for (var i = 0; i < existingUids.length && i < 5; i++) {
                try {
                    var nSnap = await db.ref('users/' + existingUids[i] + '/name').once('value');
                    names.push(nSnap.val() || existingUids[i].substring(0, 8));
                } catch (e) {}
            }

            var text = '🚨 محاولة حساب ثانٍ من نفس الجهاز\n\n' +
                       '👤 الحساب الجديد: ' + (name || 'مجهول') + '\n' +
                       '🆔 الجهاز: ' + DG.deviceId.substring(0, 15) + '...\n' +
                       '🌐 الشبكة: ' + (DG.ip || '—') + '\n' +
                       '👥 حسابات موجودة: ' + (names.length ? names.join('، ') : '—') + '\n\n' +
                       '🕐 ' + new Date().toLocaleString('ar-EG');

            var msgKey = db.ref('user_private_messages/' + kingUid + '/bot_guardian').push().key;
            await Promise.all([
                db.ref('user_private_messages/' + kingUid + '/bot_guardian/' + msgKey).set({
                    fromUid: 'bot_guardian',
                    toUid: kingUid,
                    text: text,
                    time: firebase.database.ServerValue.TIMESTAMP,
                    read: false,
                    deleted: false,
                    isGuardianCall: true,
                    guardianCallType: 'multi_account',
                    suspectUid: uid,
                    suspectName: name || '',
                    deviceId: DG.deviceId,
                    ipHash: DG.ipHash || '',
                    at: Date.now()
                }),
                db.ref('user_private_chats/' + kingUid + '/bot_guardian').update({
                    otherUid: 'bot_guardian',
                    otherName: '🚔 السجان',
                    otherAvatar: 'https://ui-avatars.com/api/?name=%D8%A7%D9%84%D8%B3%D8%AC%D8%A7%D9%86&background=111&color=ff4444&bold=true&size=64',
                    lastMessage: '🚨 محاولة حساب ثانٍ',
                    lastTime: Date.now()
                })
            ]);

            /* user_notifications للملك */
            db.ref('user_notifications/' + kingUid).push({
                fromUid: 'bot_guardian',
                fromName: '🚔 السجان',
                fromAvatar: '',
                type: 'private',
                preview: '🚨 محاولة حساب ثانٍ',
                time: Date.now(),
                read: false
            }).catch(function () {});
        } catch (e) {
            console.warn('🛡️ _notifyKing error:', e);
        }
    }

    /* ══════════════════════════════════════════════ */
    /* _forceLogout                                   */
    /* ══════════════════════════════════════════════ */
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

    /* ══════════════════════════════════════════════ */
    /* hook login buttons                             */
    /* ══════════════════════════════════════════════ */
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
                    } catch (e) {
                        console.warn('🛡️ preCheck failed:', e);
                    }
                    if (btn) btn.disabled = false;
                    return orig.apply(this, arguments);
                };
                wrapped.__dgWrapped = true;
                window[name] = wrapped;
            });
            if (allDone || attempts >= 60) {
                clearInterval(t);
                console.log('🛡️ DeviceGuard: login handlers hooked');
            }
        }, 100);
    }

    /* ══════════════════════════════════════════════ */
    /* hook initChat                                  */
    /* ══════════════════════════════════════════════ */
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
            console.log('🛡️ DeviceGuard: initChat hooked');
        }, 100);
    }

    /* ══════════════════════════════════════════════ */
    /* watch banned (mid-session)                     */
    /* ══════════════════════════════════════════════ */
    function _watchBanned() {
        if (DG._watchingBanned) return;
        if (!DG.deviceId || typeof db === 'undefined' || !db) return;
        DG._watchingBanned = true;
        try {
            var ref = db.ref(QAMAR.PATHS.BANNED_DEVICES + '/' + DG.deviceId);
            ref.on('value', function (snap) {
                if (snap.exists()) {
                    console.warn('🛡️ device banned mid-session');
                    if (typeof showToast === 'function') showToast('fa-ban', '🚫 تم حظر جهازك');
                    setTimeout(_forceLogout, 1500);
                }
            });
        } catch (e) {}
    }

    /* ══════════════════════════════════════════════ */
    /* ban / unban (للملك)                            */
    /* ══════════════════════════════════════════════ */
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
            console.log('🛡️ banned', Object.keys(devs).length, 'devices +', Object.keys(ips).length, 'IPs');
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
            console.log('🛡️ unbanned');
            return true;
        } catch (e) {
            console.warn('🛡️ unban error:', e);
            return false;
        }
    }

    /* ══════════════════════════════════════════════ */
    /* Public API                                     */
    /* ══════════════════════════════════════════════ */
    window.DeviceGuard = {
        preCheck: preCheck,
        afterAuth: afterAuth,
        register: register,
        ban: ban,
        unban: unban,
        getDeviceId: function () { return DG.deviceId; },
        getIpHash: function () { return DG.ipHash; },
        getIp: function () { return DG.ip; },
        isReady: function () { return DG.ready; },
        version: 1
    };

    /* ══════════════════════════════════════════════ */
    /* Init                                           */
    /* ══════════════════════════════════════════════ */
    function _boot() {
        _init().then(function () {
            _hookLoginButtons();
            _hookInitChat();
            /* نبدأ watch بعد 3 ثواني (نضمن auth جاهز) */
            setTimeout(_watchBanned, 3000);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _boot);
    } else {
        _boot();
    }

    console.log('🛡️ device-guard.js v1 (TEST) loaded');
})();
