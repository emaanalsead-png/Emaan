// ==============================================
// stories-cleaner.js v2 (TEST) — تنظيف تلقائي
// ==============================================
// ✅ v2:
//   1. أي مستخدم مسجّل — القفل الموزّع يضمن واحد فقط
//   2. بدون grace period — حذف فوري للمنتهية
//   3. Batch 100 حالة/دورة
//   4. audit_log فقط لما في حذف فعلي
//   5. لا نحذف stories/<uid> الفاضي
//   6. بدون tgMessageId (uploader v7 ما يرجّعه)
//   7. كل 6 ساعات + أول تشغيل بعد 5 دقائق
// ==============================================

(function () {
    'use strict';
    if (window.__storiesCleanerV2) return;
    window.__storiesCleanerV2 = true;

    var CLEAN_INTERVAL_MS = 6 * 60 * 60 * 1000;   // 6 ساعات
    var BATCH_SIZE = 100;                          // 100 حالة/دورة
    var LOCK_TTL_MS = 5 * 60 * 1000;               // 5 دقائق
    var FIRST_RUN_DELAY_MS = 5 * 60 * 1000;        // 5 دقائق
    var SCAN_LIMIT = 500;                          // اقرأ آخر 500 حالة
    var running = false;

    function log(m) { console.log('🧹 [StoriesCleaner v2] ' + m); }

    function getMe() {
        try { if (typeof getCurrentUser === 'function') return getCurrentUser(); } catch (e) {}
        return null;
    }

    /* ══════════════════════════════════════════════ */
    /* القفل الموزّع                                  */
    /* ══════════════════════════════════════════════ */
    async function _acquireLock() {
        if (typeof db === 'undefined' || !db) return false;
        try {
            var r = await db.ref('system/stories_cleaner_lock').transaction(function (cur) {
                var now = Date.now();
                if (cur && (now - (cur.at || 0)) < LOCK_TTL_MS) return;
                return { at: now, by: (getMe() || {}).uid || 'unknown' };
            });
            return r && r.committed === true;
        } catch (e) {
            return false;
        }
    }

    async function _releaseLock() {
        if (typeof db === 'undefined' || !db) return;
        try { await db.ref('system/stories_cleaner_lock').remove(); } catch (e) {}
    }

    /* ══════════════════════════════════════════════ */
    /* التنظيف الأساسي                                */
    /* ══════════════════════════════════════════════ */
    async function _cleanStories() {
        if (typeof db === 'undefined' || !db) return { deleted: 0, scanned: 0 };

        var now = Date.now();
        var deleted = 0;
        var scanned = 0;

        try {
            var snap = await db.ref('stories').limitToLast(SCAN_LIMIT).once('value');
            var all = snap.val() || {};
            var uids = Object.keys(all);

            for (var i = 0; i < uids.length && deleted < BATCH_SIZE; i++) {
                var uid = uids[i];
                var userStories = all[uid] || {};
                var sids = Object.keys(userStories);

                var toDelete = [];
                sids.forEach(function (sid) {
                    var st = userStories[sid];
                    if (!st) return;
                    scanned++;
                    if (!st.expiresAt) return;
                    if (st.expiresAt < now) toDelete.push(sid);
                });

                for (var j = 0; j < toDelete.length && deleted < BATCH_SIZE; j++) {
                    try {
                        await db.ref('stories/' + uid + '/' + toDelete[j]).remove();
                        deleted++;
                    } catch (e) {
                        console.warn('cleaner: failed to delete', uid, toDelete[j], e.message);
                    }
                }
            }
        } catch (e) {
            console.warn('_cleanStories error:', e);
        }

        return { deleted: deleted, scanned: scanned };
    }

    /* ══════════════════════════════════════════════ */
    /* audit_log (فقط لما في حذف)                    */
    /* ══════════════════════════════════════════════ */
    function _logAudit(result) {
        if (!result || result.deleted === 0) return;
        try {
            var me = getMe() || {};
            db.ref('audit_log').push({
                type: 'stories_cleanup',
                byUid: me.uid || null,
                byName: me.name || 'system',
                deleted: result.deleted,
                scanned: result.scanned,
                at: firebase.database.ServerValue.TIMESTAMP
            }).catch(function () {});
        } catch (e) {}
    }

    /* ══════════════════════════════════════════════ */
    /* دورة كاملة                                    */
    /* ══════════════════════════════════════════════ */
    async function runCleanup() {
        if (running) {
            log('already running — skip');
            return;
        }
        running = true;

        var gotLock = await _acquireLock();
        if (!gotLock) {
            log('lock busy — skip');
            running = false;
            return;
        }

        log('start');
        var start = Date.now();

        try {
            var result = await _cleanStories();
            var dur = Math.round((Date.now() - start) / 1000);
            if (result.deleted > 0) {
                log('done (' + dur + 's) — deleted ' + result.deleted + ' / scanned ' + result.scanned);
                _logAudit(result);
            } else {
                log('done (' + dur + 's) — nothing to delete (scanned ' + result.scanned + ')');
            }
        } catch (e) {
            console.warn('runCleanup error:', e);
        }

        await _releaseLock();
        running = false;
    }

    /* ══════════════════════════════════════════════ */
    /* الجدولة                                        */
    /* ══════════════════════════════════════════════ */
    function _schedule() {
        /* أول تشغيل بعد 5 دقائق (فقط لو في مستخدم) */
        setTimeout(function () {
            if (getMe()) {
                runCleanup();
            } else {
                log('no user at first run — skip');
            }
        }, FIRST_RUN_DELAY_MS);

        /* دوري كل 6 ساعات */
        setInterval(function () {
            if (getMe()) {
                runCleanup();
            }
        }, CLEAN_INTERVAL_MS);
    }

    /* ══════════════════════════════════════════════ */
    /* Public API                                     */
    /* ══════════════════════════════════════════════ */
    window.StoriesCleaner = {
        run: runCleanup,
        version: 2
    };

    /* ══════════════════════════════════════════════ */
    /* Init                                           */
    /* ══════════════════════════════════════════════ */
    function init() {
        /* ننتظر Firebase والمستخدم */
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            if (typeof db !== 'undefined' && db && getMe()) {
                clearInterval(t);
                log('ready — scheduling');
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

    console.log('🧹 stories-cleaner.js v2 (TEST) loaded — no grace + audit-if-deleted');
})();
