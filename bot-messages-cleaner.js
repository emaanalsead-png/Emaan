// ==============================================
// bot-messages-cleaner.js v1 (TEST)
// ==============================================
// ✅ v1:
//   1. يحذف رسائل البوت الأقدم من ساعة تلقائياً
//   2. يعمل من كل مستخدم مسجل — القفل يضمن واحد فقط
//   3. يدعم كل غرف QAMAR.ROOMS
//   4. Batch 200 رسالة/دورة لكل غرفة
//   5. لا يلمس رسائل المستخدمين إطلاقاً
//   6. audit_log فقط عند وجود حذف
//   7. دورة كل 60 ثانية + أول تشغيل بعد 90 ثانية
// ==============================================

(function () {
    'use strict';
    if (window.__botMsgsCleanerV1) return;
    window.__botMsgsCleanerV1 = true;

    // ══════════════════════════════════════════════
    // Config
    // ══════════════════════════════════════════════
    var AGE_MS = 60 * 60 * 1000;              // 60 دقيقة — عمر رسالة البوت
    var RUN_INTERVAL_MS = 60 * 1000;          // كل 60 ثانية
    var FIRST_RUN_DELAY_MS = 90 * 1000;       // أول تشغيل بعد 90 ثانية
    var BATCH_SIZE = 200;                     // 200 رسالة/دفعة
    var MAX_ITERATIONS = 20;                  // حد أقصى لكل غرفة (4000 رسالة)
    var LOCK_TTL_MS = 5 * 60 * 1000;          // القفل: 5 دقائق
    var SCAN_LIMIT = 200;                     // اقرأ أول 200 رسالة فقط في كل مرة

    var _running = false;
    var _intervalId = null;
    var _firstRunId = null;

    // ══════════════════════════════════════════════
    // Helpers
    // ══════════════════════════════════════════════
    function log(m) {
        console.log('🤖 [BotMsgsCleaner] ' + m);
    }

    function getMe() {
        try { if (typeof getCurrentUser === 'function') return getCurrentUser(); } catch (e) {}
        try {
            return JSON.parse(localStorage.getItem('qamar_current_user') || 'null');
        } catch (e) { return null; }
    }

    function getRooms() {
        try {
            if (typeof QAMAR !== 'undefined' && QAMAR.ROOMS) {
                return Object.keys(QAMAR.ROOMS);
            }
        } catch (e) {}
        return [];
    }

    function isBotMessage(msg) {
        if (!msg) return false;
        if (msg.isBot === true) return true;
        if (typeof msg.senderUid === 'string' && msg.senderUid.indexOf('bot_') === 0) return true;
        if (typeof msg.botId === 'string' && msg.botId.length > 0) return true;
        return false;
    }

    // ══════════════════════════════════════════════
    // Distributed Lock
    // ══════════════════════════════════════════════
    async function _acquireLock() {
        if (typeof db === 'undefined' || !db) return false;
        try {
            var me = getMe() || {};
            var r = await db.ref('system/bot_msgs_cleaner_lock').transaction(function (cur) {
                var now = Date.now();
                if (cur && (now - (cur.at || 0)) < LOCK_TTL_MS) return;
                return { at: now, by: me.uid || 'unknown' };
            });
            return r && r.committed === true;
        } catch (e) { return false; }
    }

    async function _releaseLock() {
        if (typeof db === 'undefined' || !db) return;
        try { await db.ref('system/bot_msgs_cleaner_lock').remove(); } catch (e) {}
    }

    // ══════════════════════════════════════════════
    // Core Cleaning
    // ══════════════════════════════════════════════

    /**
     * ينظف غرفة واحدة.
     * يقرأ أقدم 200 رسالة (orderByKey) — يتوقف عند أول رسالة حديثة.
     * يحذف فقط رسائل البوت الأقدم من ساعة.
     *
     * @returns {Promise<{deleted: number, scanned: number}>}
     */
    async function _cleanRoom(roomId) {
        var now = Date.now();
        var cutoff = now - AGE_MS;
        var totalDeleted = 0;
        var totalScanned = 0;

        for (var iter = 0; iter < MAX_ITERATIONS; iter++) {
            var snap;
            try {
                snap = await db.ref('room_messages/' + roomId)
                    .orderByKey()
                    .limitToFirst(SCAN_LIMIT)
                    .once('value');
            } catch (e) {
                break;
            }
            if (!snap.exists()) break;

            var toDelete = [];
            var hitRecent = false;

            snap.forEach(function (child) {
                totalScanned++;
                var v = child.val();
                if (!v) return;

                var t = (typeof v.time === 'number') ? v.time : 0;

                // ⭐ إيقاف: وصلنا لرسالة حديثة (كل التالية أحدث)
                if (t > cutoff) {
                    hitRecent = true;
                    return true; // forEach: break
                }

                // رسالة بوت قديمة → احذف
                if (isBotMessage(v)) {
                    toDelete.push(child.key);
                }
            });

            if (toDelete.length > 0) {
                // حذف دفعي
                var batch = {};
                toDelete.forEach(function (k) { batch[k] = null; });
                try {
                    await db.ref('room_messages/' + roomId).update(batch);
                    totalDeleted += toDelete.length;
                } catch (e) {
                    console.warn('bot-cleaner: batch delete failed for ' + roomId + ':', e);
                }
            }

            // شروط التوقف
            if (hitRecent) break;                              // وصلنا لرسائل حديثة
            if (snap.numChildren() < SCAN_LIMIT) break;        // الغرفة صغيرة
            if (toDelete.length === 0) break;                  // لا شيء يُحذف — لا فائدة من الاستمرار
        }

        return { deleted: totalDeleted, scanned: totalScanned };
    }

    /**
     * دورة كاملة: كل الغرف.
     */
    async function _cleanAllRooms() {
        var rooms = getRooms();
        if (rooms.length === 0) {
            log('no rooms in QAMAR.ROOMS — skip');
            return { deleted: 0, scanned: 0, rooms: 0 };
        }

        var totalDeleted = 0;
        var totalScanned = 0;
        var roomsTouched = 0;

        for (var i = 0; i < rooms.length; i++) {
            var roomId = rooms[i];
            var r = await _cleanRoom(roomId);
            if (r.deleted > 0) {
                roomsTouched++;
                totalDeleted += r.deleted;
                totalScanned += r.scanned;
                log(roomId + ': deleted ' + r.deleted + ' / scanned ' + r.scanned);
            } else {
                totalScanned += r.scanned;
            }
        }

        return { deleted: totalDeleted, scanned: totalScanned, rooms: roomsTouched };
    }

    // ══════════════════════════════════════════════
    // Audit Log
    // ══════════════════════════════════════════════
    function _logAudit(result) {
        if (!result || result.deleted === 0) return;
        try {
            var me = getMe() || {};
            db.ref('audit_log').push({
                type: 'bot_messages_cleanup',
                byUid: me.uid || null,
                byName: me.name || 'system',
                deleted: result.deleted,
                scanned: result.scanned,
                rooms: result.rooms,
                ageMinutes: Math.round(AGE_MS / 60000),
                at: firebase.database.ServerValue.TIMESTAMP
            }).catch(function () {});
        } catch (e) {}
    }

    // ══════════════════════════════════════════════
    // Run Cycle
    // ══════════════════════════════════════════════
    async function runCleanup(reason) {
        if (_running) {
            log('already running — skip');
            return;
        }
        _running = true;

        var gotLock = await _acquireLock();
        if (!gotLock) {
            log('lock busy — skip (' + (reason || 'auto') + ')');
            _running = false;
            return;
        }

        log('start (' + (reason || 'auto') + ')');
        var start = Date.now();

        try {
            var result = await _cleanAllRooms();
            var dur = Math.round((Date.now() - start) / 1000);

            if (result.deleted > 0) {
                log('done (' + dur + 's) — deleted ' + result.deleted + ' from ' + result.rooms + ' rooms');
                _logAudit(result);
            } else {
                log('done (' + dur + 's) — nothing to delete (scanned ' + result.scanned + ')');
            }
        } catch (e) {
            console.warn('bot-cleaner cycle error:', e);
        }

        await _releaseLock();
        _running = false;
    }

    // ══════════════════════════════════════════════
    // Scheduling
    // ══════════════════════════════════════════════
    function _schedule() {
        // أول تشغيل بعد 90 ثانية (فقط لو في مستخدم)
        _firstRunId = setTimeout(function () {
            if (getMe()) {
                runCleanup('first-run');
            } else {
                log('no user at first run — skip');
            }
        }, FIRST_RUN_DELAY_MS);

        // دوري كل 60 ثانية
        _intervalId = setInterval(function () {
            if (getMe()) {
                runCleanup('auto');
            }
        }, RUN_INTERVAL_MS);
    }

    function stop() {
        if (_intervalId) { clearInterval(_intervalId); _intervalId = null; }
        if (_firstRunId) { clearTimeout(_firstRunId); _firstRunId = null; }
        log('stopped');
    }

    // ══════════════════════════════════════════════
    // Public API
    // ══════════════════════════════════════════════
    window.BotMsgsCleaner = {
        run: function () { return runCleanup('manual'); },
        stop: stop,
        status: function () {
            return {
                running: _running,
                intervalMs: RUN_INTERVAL_MS,
                ageMs: AGE_MS,
                rooms: getRooms().length
            };
        },
        version: 1
    };

    // ══════════════════════════════════════════════
    // Init
    // ══════════════════════════════════════════════
    function init() {
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            if (typeof db !== 'undefined' && db && getMe()) {
                clearInterval(t);
                log('ready — age=1h · interval=60s · rooms=' + getRooms().length);
                _schedule();
                return;
            }
            if (attempts >= 60) {
                clearInterval(t);
                log('init timeout — will retry via schedule');
                _schedule();
            }
        }, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('🤖 bot-messages-cleaner.js v1 (TEST) loaded — 1h age · 60s cycle');
})();
