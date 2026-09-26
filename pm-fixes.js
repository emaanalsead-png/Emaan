// ==============================================
// pm-fixes.js v1 — إصلاحات الرسائل الخاصة
// ==============================================
// ✅ v1:
//   1. تجميع الإشعارات من نفس المرسل
//   2. cooldown لـ playPrivateMsgSound (30s)
//   3. للملك: عرض originalText + originalAttachment في PM
//   4. cleaner احتياطي للإشعارات المكررة
// ==============================================

(function () {
    'use strict';
    if (window.__pmFixesV1) return;
    window.__pmFixesV1 = true;

    var NOTIF_COOLDOWN_MS = 60000;
    var SOUND_COOLDOWN_MS = 30000;

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

    /* 1. Intercept db.ref().push() على user_notifications */
    function _installNotifInterceptor() {
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            if (typeof db === 'undefined' || !db || !db.ref) {
                if (attempts >= 40) clearInterval(t);
                return;
            }
            if (db.__pmFixesWrapped) { clearInterval(t); return; }

            var _origRef = db.ref.bind(db);
            db.__pmFixesOrigRef = _origRef;

            db.ref = function (path) {
                var ref = _origRef(path);

                if (typeof path === 'string' && /^user_notifications\/[^\/]+$/.test(path)) {
                    var _origPush = ref.push.bind(ref);
                    ref.push = function (data, onComplete) {
                        if (data && data.type === 'private' && data.fromUid) {
                            _handlePrivateNotifPush(path, data, _origPush, onComplete, _origRef);
                            return {
                                key: '_merged_' + Date.now(),
                                set: function () { return Promise.resolve(); },
                                update: function () { return Promise.resolve(); },
                                remove: function () { return Promise.resolve(); },
                                then: function (resolve) { if (resolve) resolve(); return Promise.resolve(); }
                            };
                        }
                        return _origPush(data, onComplete);
                    };
                }

                return ref;
            };

            db.__pmFixesWrapped = true;
            clearInterval(t);
            console.log('✅ pm-fixes: db.ref interceptor installed');
        }, 250);
    }

    async function _handlePrivateNotifPush(path, data, origPush, onComplete, origRef) {
        try {
            var snap = await origRef(path).limitToLast(20).once('value');
            var existing = snap.val() || {};
            var now = Date.now();
            var foundKey = null;
            var foundCount = 0;

            Object.keys(existing).forEach(function (k) {
                var n = existing[k];
                if (!n || n.read) return;
                if (n.fromUid !== data.fromUid) return;
                if (n.type !== 'private') return;
                if ((now - (n.time || 0)) < NOTIF_COOLDOWN_MS) {
                    foundKey = k;
                    foundCount = n._count || 1;
                }
            });

            if (foundKey) {
                await origRef(path + '/' + foundKey).update({
                    preview: data.preview || '',
                    time: now,
                    read: false,
                    _count: foundCount + 1
                });
                console.log('🔔 notif merged → count ' + (foundCount + 1));
            } else {
                await origPush(data, onComplete);
                console.log('🔔 new notif pushed');
            }
        } catch (e) {
            console.warn('notif intercept failed, falling back:', e);
            try { await origPush(data, onComplete); } catch (e2) {}
        }
    }

    /* 2. cooldown لـ playPrivateMsgSound */
    function _installSoundCooldown() {
        var _lastPlay = 0;
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            if (typeof window.playPrivateMsgSound !== 'function') {
                if (attempts >= 40) clearInterval(t);
                return;
            }
            if (window.playPrivateMsgSound.__pmFixed) { clearInterval(t); return; }

            var orig = window.playPrivateMsgSound;
            window.playPrivateMsgSound = function () {
                var now = Date.now();
                if (now - _lastPlay < SOUND_COOLDOWN_MS) {
                    console.log('⏭️ playPrivateMsgSound suppressed (cooldown)');
                    return;
                }
                _lastPlay = now;
                return orig.apply(this, arguments);
            };
            window.playPrivateMsgSound.__pmFixed = true;
            clearInterval(t);
            console.log('✅ pm-fixes: playPrivateMsgSound cooldown applied (30s)');
        }, 250);
    }

    /* 3. للملك: عرض originalText في PM */
    function _installKingOriginalDisplay() {
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            if (typeof window.displayPrivateMsg !== 'function') {
                if (attempts >= 40) clearInterval(t);
                return;
            }
            if (window.displayPrivateMsg.__pmFixed) { clearInterval(t); return; }

            var orig = window.displayPrivateMsg;

            window.displayPrivateMsg = function (msg, isSent) {
                var user = getMe();

                if (msg.deleted && user && user.rank === 'King' &&
                    (msg.originalText || msg.originalAttachment)) {

                    var modified = Object.assign({}, msg);
                    modified.deleted = false;
                    modified.text = msg.originalText || '';
                    modified.attachment = msg.originalAttachment || null;
                    modified._isKingOriginal = true;

                    orig.call(this, modified, isSent);

                    setTimeout(function () {
                        var c = document.getElementById('pc-messages');
                        if (!c) return;
                        var all = c.querySelectorAll('[data-pm-msg="' + (msg._key || '') + '"]');
                        var el = all[all.length - 1];
                        if (!el) return;
                        if (el.querySelector('.pm-king-badge')) return;

                        el.style.background = 'linear-gradient(135deg, rgba(120,0,0,0.15), rgba(0,0,0,0.3))';
                        el.style.borderRight = '3px solid #ff4444';

                        var badge = document.createElement('div');
                        badge.className = 'pm-king-badge';
                        badge.style.cssText = 'color:#ffd700;font-size:9px;font-weight:900;margin-top:6px;padding-top:6px;border-top:1px dashed rgba(255,215,0,0.3);letter-spacing:0.5px;';
                        badge.innerHTML = '👑 نسخة الملك — الرسالة محذوفة';
                        el.appendChild(badge);
                    }, 80);

                    return;
                }

                return orig.call(this, msg, isSent);
            };

            window.displayPrivateMsg.__pmFixed = true;
            clearInterval(t);
            console.log('✅ pm-fixes: displayPrivateMsg wrapped (King original)');
        }, 250);
    }

    /* 4. Cleaner احتياطي */
    function _startNotifCleaner() {
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            var u = getMe();
            if (!u || !u.uid || typeof db === 'undefined' || !db) {
                if (attempts >= 40) clearInterval(t);
                return;
            }
            clearInterval(t);

            console.log('🧹 pm-fixes: cleaner started for', u.uid.substring(0, 8));

            var cleaning = false;
            setInterval(async function () {
                if (cleaning) return;
                cleaning = true;

                try {
                    var snap = await db.ref('user_notifications/' + u.uid).limitToLast(50).once('value');
                    var data = snap.val() || {};
                    var bySender = {};
                    var toRemove = [];

                    Object.keys(data).forEach(function (k) {
                        var n = data[k];
                        if (!n || n.read) return;
                        if (n.type !== 'private') return;
                        var fromUid = n.fromUid;
                        if (!fromUid) return;

                        if (bySender[fromUid]) {
                            if ((n.time || 0) > (bySender[fromUid].time || 0)) {
                                toRemove.push(bySender[fromUid].key);
                                bySender[fromUid] = { key: k, time: n.time };
                            } else {
                                toRemove.push(k);
                            }
                        } else {
                            bySender[fromUid] = { key: k, time: n.time };
                        }
                    });

                    if (toRemove.length > 0) {
                        console.log('🧹 cleaning ' + toRemove.length + ' duplicate notifs');
                        for (var i = 0; i < toRemove.length; i++) {
                            await db.ref('user_notifications/' + u.uid + '/' + toRemove[i]).remove().catch(function () {});
                        }
                    }
                } catch (e) {
                    console.warn('cleaner error:', e);
                }

                cleaning = false;
            }, 5000);
        }, 1000);
    }

    function init() {
        _installNotifInterceptor();
        _installSoundCooldown();
        _installKingOriginalDisplay();
        _startNotifCleaner();
        console.log('📦 pm-fixes.js v1 loaded');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
