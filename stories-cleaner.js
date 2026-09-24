// ==============================================
// stories-cleaner.js v1 — تنظيف تلقائي للحالات المنتهية
// ==============================================
// ✅ يعمل تلقائياً كل 6 ساعات
// ✅ يحذف فقط الحالات المنتهية (expiresAt < now)
// ✅ يحذف رسائل تلغرام المرتبطة (اختياري)
// ✅ قفل موزّع — يمنع تكرار التشغيل
// ✅ يستخدم Telegram Bot API لحذف الرسائل
// ==============================================

(function () {
    'use strict';
    if (window.__storiesCleanerV1) return;
    window.__storiesCleanerV1 = true;

    var TG_TOKEN = '8850098271:AAEy7xKwhbaSWrY_5ojUTA0McZvTPE1Gpv8';
    var TG_CHAT_ID = '-1003978647266';
    var TG_API = 'https://api.telegram.org/bot' + TG_TOKEN;

    var CLEAN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 ساعات
    var GRACE_MS = 60 * 60 * 1000;              // ساعة سماح بعد الانتهاء
    var BATCH_SIZE = 100;                        // معالجة 100 حالة/دورة
    var running = false;

    function log(m) { console.log('🧹 [StoriesCleaner] ' + m); }

    async function _cleanFirebase() {
        if (typeof db === 'undefined' || !db) return 0;
        var deleted = 0;
        try {
            // اقرأ آخر 200 حالة
            var snap = await db.ref('stories').limitToLast(200).once('value');
            var all = snap.val() || {};
            var now = Date.now();
            var cutoff = now - GRACE_MS;

            var uids = Object.keys(all);
            for (var i = 0; i < uids.length && deleted < BATCH_SIZE; i++) {
                var uid = uids[i];
                var userStories = all[uid] || {};
                var toDelete = [];

                Object.keys(userStories).forEach(function(sid) {
                    var st = userStories[sid];
                    if (!st) return;
                    if (st.expiresAt && st.expiresAt < cutoff) {
                        toDelete.push(sid);
                    }
                });

                for (var j = 0; j < toDelete.length && deleted < BATCH_SIZE; j++) {
                    try {
                        // ⭐ حذف رسالة تلغرام المرتبطة (إن وجدت)
                        var st = userStories[toDelete[j]];
                        if (st && st.tgMessageId) {
                            try {
                                await fetch(TG_API + '/deleteMessage', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        chat_id: TG_CHAT_ID,
                                        message_id: st.tgMessageId
                                    })
                                });
                            } catch (e) {}
                        }

                        await db.ref('stories/' + uid + '/' + toDelete[j]).remove();
                        deleted++;
                    } catch (e) {}
                }
            }
        } catch (e) { console.warn('cleaner error:', e); }
        return deleted;
    }

    async function _acquireLock() {
        if (typeof db === 'undefined' || !db) return false;
        try {
            var r = await db.ref('system/stories_cleaner_lock').transaction(function(cur) {
                var now = Date.now();
                if (cur && (now - (cur.at || 0)) < 5 * 60000) return; // 5 دقائق
                return { at: now };
            });
            return r && r.committed === true;
        } catch (e) { return false; }
    }

    async function _releaseLock() {
        if (typeof db === 'undefined' || !db) return;
        try { await db.ref('system/stories_cleaner_lock').remove(); } catch (e) {}
    }

    async function runCleanup() {
        if (running) return;
        running = true;
        var gotLock = await _acquireLock();
        if (!gotLock) {
            log('قفل مشغول — تخطي');
            running = false;
            return;
        }

        log('بدء التنظيف...');
        var start = Date.now();
        var deleted = await _cleanFirebase();
        await _releaseLock();

        var dur = Math.round((Date.now() - start) / 1000);
        log('انتهى (' + dur + 's) — حُذف ' + deleted + ' حالة');
        running = false;
    }

    // جدولة: بعد 5 دقائق من التحميل، ثم كل 6 ساعات
    function schedule() {
        setTimeout(function() {
            if (typeof getCurrentUser === 'function' && getCurrentUser()) {
                runCleanup();
            }
        }, 5 * 60 * 1000);

        setInterval(function() {
            if (typeof getCurrentUser === 'function' && getCurrentUser()) {
                runCleanup();
            }
        }, CLEAN_INTERVAL_MS);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', schedule);
    } else {
        schedule();
    }

    window.StoriesCleaner = {
        run: runCleanup,
        version: 1
    };

    console.log('🧹 stories-cleaner.js v1 loaded — auto-cleanup every 6h');
})();
