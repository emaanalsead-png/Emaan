// ==============================================
// connection-optimizer.js v1
// ==============================================
// ✅ الهدف:
//   1. تخفيف ضغط Firebase RTDB (70 → ~61 listener)
//   2. تحويل بيانات "نادرة التغيير" من on() إلى polling
//   3. بدون أي خسارة في الميزات
// ==============================================
// ملاحظة: يعمل على Firebase SDK نفسه (prototype snoop)
// لا يلمس أي ملف آخر.
// ==============================================

(function () {
    'use strict';
    if (window.__connectionOptimizerV1) return;
    window.__connectionOptimizerV1 = true;

    if (typeof firebase === 'undefined' || !firebase.database) {
        console.warn('⚠️ connection-optimizer: Firebase not ready — aborting');
        return;
    }

    console.log('🔌 connection-optimizer.js v1 starting...');

    /* ══════════════════════════════════════════════ */
    /* قائمة البيانات التي نحولها إلى polling         */
    /* (نادراً ما تتغير → لا تحتاج real-time)         */
    /* ══════════════════════════════════════════════ */
    const POLL_NODES = {
        'bot_memory/badWords': 90000,
        'bot_memory/kickWords': 90000,
        'bot_memory/hakawati': 90000,
        'bot_memory/hakawati_auto': 90000,
        'bot_memory/quiz': 90000,
        'bot_memory/islamic': 90000,
        'bot_locks/quiz_current': 30000,
        'room_settings': 120000
    };

    /* ══════════════════════════════════════════════ */
    /* تخزين callbacks + pollers                       */
    /* ══════════════════════════════════════════════ */
    var _pollCallbacks = {};  // { path: [ {cb, ref} ] }
    var _pollers = {};         // { path: intervalId }

    function _getPath(ref) {
        // تحويل URL كامل إلى path نسبي
        // https://xxx.firebaseio.com/bot_memory/badWords → bot_memory/badWords
        var url = ref.toString();
        try {
            var withoutProtocol = url.replace(/^https?:\/\//, '');
            var slashIdx = withoutProtocol.indexOf('/');
            if (slashIdx === -1) return '';
            return withoutProtocol.substring(slashIdx + 1);
        } catch (e) {
            return '';
        }
    }

    function _registerPollCallback(path, ref, callback) {
        if (!_pollCallbacks[path]) _pollCallbacks[path] = [];
        _pollCallbacks[path].push({ ref: ref, cb: callback });

        // إذا لم يكن هناك poller → ابدأ واحد
        if (!_pollers[path]) {
            var interval = POLL_NODES[path] || 90000;

            // نداء أولي فوري (بعد 300ms لتجميع الكل)
            setTimeout(function () {
                ref.once('value').then(function (snap) {
                    _fireCallbacks(path, snap);
                }).catch(function () {});
            }, 300);

            // Poll دوري
            _pollers[path] = setInterval(function () {
                ref.once('value').then(function (snap) {
                    _fireCallbacks(path, snap);
                }).catch(function () {});
            }, interval);
        }
    }

    function _fireCallbacks(path, snap) {
        var list = _pollCallbacks[path];
        if (!list || !list.length) return;
        list.forEach(function (item) {
            try {
                item.cb(snap);
            } catch (e) {
                console.warn('poll callback error (' + path + '):', e);
            }
        });
    }

    function _unregisterPollCallback(path, callback) {
        if (!_pollCallbacks[path]) return;
        _pollCallbacks[path] = _pollCallbacks[path].filter(function (item) {
            return item.cb !== callback;
        });
        if (_pollCallbacks[path].length === 0) {
            if (_pollers[path]) {
                clearInterval(_pollers[path]);
                delete _pollers[path];
            }
            delete _pollCallbacks[path];
        }
    }

    /* ══════════════════════════════════════════════ */
    /* Snoop على firebase.database.Reference.prototype.on */
    /* ══════════════════════════════════════════════ */
    var _origOn = firebase.database.Reference.prototype.on;
    var _origOff = firebase.database.Reference.prototype.off;

    firebase.database.Reference.prototype.on = function (eventType, callback, cancelCb) {
        var path = _getPath(this);

        // هل هذه عقدة polling؟
        if (POLL_NODES[path] && eventType === 'value' && typeof callback === 'function') {
            _registerPollCallback(path, this, callback);
            // إرجاع stub للـ off
            var self = this;
            return {
                off: function () {
                    _unregisterPollCallback(path, callback);
                }
            };
        }

        // عادي
        return _origOn.call(this, eventType, callback, cancelCb);
    };

    firebase.database.Reference.prototype.off = function (eventType, callback) {
        var path = _getPath(this);

        if (POLL_NODES[path] && typeof callback === 'function') {
            _unregisterPollCallback(path, callback);
            return;
        }

        return _origOff.call(this, eventType, callback);
    };

    /* ══════════════════════════════════════════════ */
    /* تعطيل userDataListener الأصلي (مكرر)           */
    /* user-data-optimizer يحل مكانه بـ 14 listeners  */
    /* ══════════════════════════════════════════════ */
    var _origStartUserData = window.startUserDataListener;
    var _userDataDisabled = false;

    window.startUserDataListener = function () {
        if (_userDataDisabled) {
            console.log('⏭️ connection-optimizer: userDataListener already disabled');
            return;
        }
        _userDataDisabled = true;
        console.log('⏭️ connection-optimizer: userDataListener disabled (user-data-optimizer handles it)');
        // لا نستدعي الأصلية
    };

    /* ══════════════════════════════════════════════ */
    /* تقليل punishment watcher من 60s → 180s         */
    /* ══════════════════════════════════════════════ */
    var _origPunish = window.startPunishmentWatcher;
    window.startPunishmentWatcher = function () {
        if (typeof _origPunish === 'function') {
            // استدعِ الأصلية مرة واحدة للفحص الفوري
            try { _origPunish.call(this); } catch (e) {}

            // أوقف interval القديم
            if (window.ChatState && ChatState._punishmentCheckInterval) {
                clearInterval(ChatState._punishmentCheckInterval);
                ChatState._punishmentCheckInterval = null;
            }

            // ضع interval جديد كل 180s بدل 60s
            var user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
            if (!user || !user.uid) return;

            var _check = async function () {
                try {
                    var snap = await db.ref('users/' + user.uid).once('value');
                    var d = snap.val();
                    if (!d) return;
                    var now = Date.now();

                    if (d.isBanned === true && d.bannedUntil && now >= d.bannedUntil) {
                        await db.ref('users/' + user.uid).update({ isBanned: false, bannedUntil: 0, permanentBan: false });
                        return;
                    }
                    if (d.isJailed === true && d.jailUntil && now >= d.jailUntil) {
                        await db.ref('users/' + user.uid).update({ isJailed: false, jailUntil: 0, jailReleasedAt: now });
                        return;
                    }
                } catch (e) {}
            };

            window.ChatState._punishmentCheckInterval = setInterval(_check, 180000);
            console.log('⏭️ connection-optimizer: punishment watcher 60s → 180s');
        }
    };

    /* ══════════════════════════════════════════════ */
    /* تقليل presence heartbeat من 30s → 90s          */
    /* ══════════════════════════════════════════════ */
    var _origPresence = window.startPresenceHeartbeat;
    window.startPresenceHeartbeat = function () {
        if (typeof _origPresence === 'function') {
            // استدعِ الأصلية (للتسجيل + onDisconnect)
            try { _origPresence.call(this); } catch (e) {}

            // أوقف interval القديم
            if (window.ChatState && ChatState.presenceInterval) {
                clearInterval(ChatState.presenceInterval);
                ChatState.presenceInterval = null;
            }

            var user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
            if (!user || !user.uid) return;

            var ref = db.ref('user_presence/' + user.uid);
            var setOn = function () {
                var room = (typeof ChatState !== 'undefined' && ChatState.currentRoom) || 'general';
                ref.set({ state: 'online', lastChanged: Date.now(), room: room }).catch(function () {});
            };

            window.ChatState.presenceInterval = setInterval(setOn, 90000);
            console.log('⏭️ connection-optimizer: presence heartbeat 30s → 90s');
        }
    };

    /* ══════════════════════════════════════════════ */
    /* تشخيص                                              */
    /* ══════════════════════════════════════════════ */
    setTimeout(function () {
        var polledCount = Object.keys(_pollCallbacks).length;
        if (polledCount > 0) {
            console.log('📊 connection-optimizer: ' + polledCount + ' nodes polling instead of real-time');
            console.log('📊 الأسماء: ' + Object.keys(_pollCallbacks).join(', '));
        }
    }, 3000);

    console.log('✅ connection-optimizer.js v1 loaded — reduced Firebase load');
})();
