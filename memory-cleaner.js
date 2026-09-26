// ==============================================
// memory-cleaner.js v2 (TEST) — تنظيف + مؤشر ذاكرة
// ==============================================
// ✅ v2 (فوق v1):
//   1. 📊 مؤشر مستوى الذاكرة (شريط + نسبة + حالة)
//   2. أكبر 3 مساهمين في الاستهلاك
//   3. قياس تلقائي عند فتح التبويب + cache
//   4. زر "إعادة القياس" يدوي
//   5. تقديرات أوزان دقيقة لكل node
//   6. v1 محفوظ: 8 تصنيفات + تنظيف آمن
// ==============================================

(function () {
    'use strict';
    if (window.__memoryCleanerV2) return;
    window.__memoryCleanerV2 = true;

    var TAB_ID = 'memory-cleaner';
    var TAB_LABEL = '🧹 الذاكرة';
    var BATCH_SIZE = 200;
    var MAX_ITERATIONS = 50;

    // ═══ Firebase Spark Limit ═══
    var FIREBASE_LIMIT_BYTES = 1024 * 1024 * 1024; // 1 GB
    // عتبات الحالة (نسبة من الحد)
    var THRESHOLDS = {
        excellent: 0.10,  // < 10%  → 🟢 ممتاز
        good:      0.30,  // < 30%  → 🟡 جيد
        attention: 0.60,  // < 60%  → 🟠 يحتاج تنظيف
        critical:  1.00   // >= 60% → 🔴 حرج
    };

    var CACHE_KEY = 'qamar_memory_scan_v2';
    var CACHE_TTL_MS = 5 * 60 * 1000; // 5 دقائق
    var _currentScan = null;
    var _scanning = false;

    // ══════════════════════════════════════════════
    // Helpers
    // ══════════════════════════════════════════════
    function getMe() {
        try { if (typeof getCurrentUser === 'function') return getCurrentUser(); } catch (e) {}
        try {
            return JSON.parse(localStorage.getItem('qamar_current_user') || 'null');
        } catch (e) { return null; }
    }

    function isKing() {
        var u = getMe();
        return !!(u && u.rank === 'King');
    }

    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    }

    function toast(icon, msg) {
        if (typeof showToast === 'function') showToast(icon, msg);
    }

    function logAudit(type, data) {
        try {
            var me = getMe() || {};
            db.ref('audit_log').push(Object.assign({
                type: type,
                byUid: me.uid || null,
                byName: me.name || 'King',
                at: firebase.database.ServerValue.TIMESTAMP
            }, data || {})).catch(function () {});
        } catch (e) {}
    }

    function formatBytes(b) {
        if (!b || b < 1) return '0 B';
        if (b < 1024) return b + ' B';
        if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
        if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + ' MB';
        return (b / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }

    // ══════════════════════════════════════════════
    // Memory Measurement System
    // ══════════════════════════════════════════════
    // الأوزان = تقدير عدد البايتات لكل عنصر (JSON متوسط)
    var MEASUREMENTS = [
        {
            id: 'room_messages',
            label: 'رسائل الغرف',
            icon: '💬',
            weight: 700,
            counter: async function () {
                var rooms = Object.keys((typeof QAMAR !== 'undefined' && QAMAR.ROOMS) || {});
                var total = 0;
                for (var i = 0; i < rooms.length; i++) {
                    var snap = await db.ref('room_messages/' + rooms[i]).once('value');
                    if (snap.exists()) total += snap.numChildren();
                }
                return total;
            }
        },
        {
            id: 'user_private_messages',
            label: 'الرسائل الخاصة',
            icon: '💌',
            weight: 800,
            counter: async function () {
                var snap = await db.ref('user_private_messages').limitToFirst(200).once('value');
                if (!snap.exists()) return 0;
                var total = 0, users = 0;
                snap.forEach(function (userChild) {
                    users++;
                    userChild.forEach(function (chatChild) {
                        total += chatChild.numChildren();
                    });
                });
                // لو المسح مقطوع، نضاعف التقدير بحذر
                if (users >= 200) total = Math.round(total * 1.5);
                return total;
            }
        },
        {
            id: 'users',
            label: 'حسابات المستخدمين',
            icon: '👥',
            weight: 2500,
            counter: async function () {
                var snap = await db.ref('users').once('value');
                return snap.exists() ? snap.numChildren() : 0;
            }
        },
        {
            id: 'stories',
            label: 'الحالات (Stories)',
            icon: '📸',
            weight: 1500,
            counter: async function () {
                var snap = await db.ref('stories').once('value');
                if (!snap.exists()) return 0;
                var total = 0;
                snap.forEach(function (userChild) {
                    total += userChild.numChildren();
                });
                return total;
            }
        },
        {
            id: 'audit_log',
            label: 'سجل النشاط',
            icon: '📜',
            weight: 400,
            counter: async function () {
                var snap = await db.ref('audit_log').once('value');
                return snap.exists() ? snap.numChildren() : 0;
            }
        },
        {
            id: 'user_notifications',
            label: 'الإشعارات',
            icon: '🔔',
            weight: 400,
            counter: async function () {
                var snap = await db.ref('user_notifications').once('value');
                if (!snap.exists()) return 0;
                var total = 0;
                snap.forEach(function (userChild) {
                    total += userChild.numChildren();
                });
                return total;
            }
        },
        {
            id: 'device_registry',
            label: 'سجل الأجهزة',
            icon: '📱',
            weight: 250,
            counter: async function () {
                var snap = await db.ref('device_registry').once('value');
                if (!snap.exists()) return 0;
                var total = 0;
                snap.forEach(function (devChild) {
                    total += devChild.numChildren();
                });
                return total;
            }
        },
        {
            id: 'ip_registry',
            label: 'سجل الشبكات',
            icon: '🌐',
            weight: 250,
            counter: async function () {
                var snap = await db.ref('ip_registry').once('value');
                if (!snap.exists()) return 0;
                var total = 0;
                snap.forEach(function (ipChild) {
                    total += ipChild.numChildren();
                });
                return total;
            }
        },
        {
            id: 'bot_locks',
            label: 'أقفال البوتات',
            icon: '🔒',
            weight: 100,
            counter: async function () {
                var msgs = await db.ref('bot_locks/msgs').once('value');
                var welcome = await db.ref('bot_locks/welcome').once('value');
                var n = 0;
                if (msgs.exists()) n += msgs.numChildren();
                if (welcome.exists()) {
                    welcome.forEach(function (r) { n += r.numChildren(); });
                }
                return n;
            }
        },
        {
            id: 'bot_memory',
            label: 'ذاكرة البوتات',
            icon: '🤖',
            weight: 300,
            counter: async function () {
                var paths = ['badWords', 'kickWords', 'hakawati', 'hakawati_auto', 'quiz', 'islamic'];
                var total = 0;
                for (var i = 0; i < paths.length; i++) {
                    var snap = await db.ref('bot_memory/' + paths[i]).once('value');
                    if (snap.exists()) total += snap.numChildren();
                }
                return total;
            }
        },
        {
            id: 'bot_data',
            label: 'نقاط المسابقات',
            icon: '⭐',
            weight: 60,
            counter: async function () {
                var snap = await db.ref('bot_data/quiz/scores').once('value');
                return snap.exists() ? snap.numChildren() : 0;
            }
        },
        {
            id: 'misc',
            label: 'بيانات أخرى',
            icon: '📦',
            weight: 300,
            counter: async function () {
                var paths = [
                    'multi_account_alerts',
                    'banned_devices',
                    'banned_ips',
                    'reports',
                    'reports_archive',
                    'bot_learning/pending',
                    'room_kicks'
                ];
                var total = 0;
                for (var i = 0; i < paths.length; i++) {
                    var snap = await db.ref(paths[i]).once('value');
                    if (!snap.exists()) continue;
                    if (paths[i] === 'room_kicks') {
                        snap.forEach(function (r) { total += r.numChildren(); });
                    } else {
                        total += snap.numChildren();
                    }
                }
                return total;
            }
        }
    ];

    async function measureMemory(onProgress) {
        var result = {
            categories: [],
            totalBytes: 0,
            totalCount: 0,
            largest: null,
            scannedAt: Date.now()
        };

        for (var i = 0; i < MEASUREMENTS.length; i++) {
            var m = MEASUREMENTS[i];
            if (onProgress) onProgress(i, MEASUREMENTS.length, m.label);
            try {
                var count = await m.counter();
                var bytes = count * m.weight;
                result.categories.push({
                    id: m.id,
                    label: m.label,
                    icon: m.icon,
                    count: count,
                    bytes: bytes
                });
                result.totalCount += count;
                result.totalBytes += bytes;
            } catch (e) {
                console.warn('memory measure failed for ' + m.id + ':', e);
                result.categories.push({
                    id: m.id,
                    label: m.label,
                    icon: m.icon,
                    count: 0,
                    bytes: 0,
                    error: true
                });
            }
        }

        result.categories.sort(function (a, b) { return b.bytes - a.bytes; });
        if (result.categories.length > 0) result.largest = result.categories[0];

        return result;
    }

    // ══════════════════════════════════════════════
    // Cache
    // ══════════════════════════════════════════════
    function saveScanToCache(scan) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(scan));
        } catch (e) {}
    }

    function loadScanFromCache() {
        try {
            var raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            var data = JSON.parse(raw);
            if (!data || !data.scannedAt) return null;
            if (Date.now() - data.scannedAt > CACHE_TTL_MS) return null;
            return data;
        } catch (e) { return null; }
    }

    // ══════════════════════════════════════════════
    // Memory Level Helpers
    // ══════════════════════════════════════════════
    function getMemoryLevel(bytes) {
        var ratio = bytes / FIREBASE_LIMIT_BYTES;
        if (ratio < THRESHOLDS.excellent) {
            return { level: 1, label: 'ممتاز', color: '#4ade80', emoji: '🟢', ratio: ratio };
        }
        if (ratio < THRESHOLDS.good) {
            return { level: 2, label: 'جيد', color: '#fbbf24', emoji: '🟡', ratio: ratio };
        }
        if (ratio < THRESHOLDS.attention) {
            return { level: 3, label: 'يحتاج تنظيف', color: '#fb923c', emoji: '🟠', ratio: ratio };
        }
        return { level: 4, label: 'حرج', color: '#ef4444', emoji: '🔴', ratio: ratio };
    }

    // ══════════════════════════════════════════════
    // Rendering — Memory Indicator
    // ══════════════════════════════════════════════
    function renderMemoryIndicator(scan, scanning, progress) {
        var h = '<div class="kr-card" id="mc-indicator" style="background:linear-gradient(135deg,rgba(255,215,0,0.06),rgba(0,0,0,0.4));border-color:rgba(255,215,0,0.4);">';

        h += '<div class="kr-card-title" style="justify-content:space-between;display:flex;align-items:center;">';
        h += '<span>📊 مستوى ذاكرة Firebase</span>';
        h += '<button class="kr-btn kr-btn-outline kr-btn-sm" id="mc-rescan" type="button" style="padding:5px 10px;font-size:10px;">🔄 ' + (scanning ? 'جاري...' : 'إعادة القياس') + '</button>';
        h += '</div>';

        if (scanning && progress) {
            h += '<div style="text-align:center;padding:20px 10px;">';
            h += '<div style="font-size:32px;margin-bottom:10px;animation:mcSpin 1s linear infinite;display:inline-block;">⏳</div>';
            h += '<div style="color:#ffd700;font-size:13px;font-weight:900;margin-bottom:6px;">جاري القياس...</div>';
            h += '<div style="color:#888;font-size:11px;">' + esc(progress.label || '') + ' (' + (progress.current + 1) + '/' + progress.total + ')</div>';
            h += '</div>';
            h += '</div>';
            return h;
        }

        if (!scan) {
            h += '<div style="text-align:center;padding:20px 10px;color:#888;font-size:12px;">اضغط "إعادة القياس" للحصول على التقدير</div>';
            h += '</div>';
            return h;
        }

        var lvl = getMemoryLevel(scan.totalBytes);
        var pct = Math.min(100, lvl.ratio * 100);

        // ─── الشريط ───
        h += '<div style="margin:10px 0 14px;">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
        h += '<div style="font-size:18px;font-weight:900;color:' + lvl.color + ';">' + lvl.emoji + ' ' + lvl.label + '</div>';
        h += '<div style="font-size:13px;font-weight:900;color:#fff;">' + formatBytes(scan.totalBytes) + '</div>';
        h += '</div>';

        // Progress bar
        h += '<div style="position:relative;height:14px;background:rgba(0,0,0,0.5);border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">';
        h += '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;font-size:0;">';
        h += '<div style="flex:1;background:rgba(74,222,128,0.08);"></div>';
        h += '<div style="flex:2;background:rgba(251,191,36,0.08);"></div>';
        h += '<div style="flex:3;background:rgba(251,146,60,0.08);"></div>';
        h += '<div style="flex:4;background:rgba(239,68,68,0.08);"></div>';
        h += '</div>';
        h += '<div style="position:absolute;top:0;left:0;bottom:0;width:' + pct + '%;background:linear-gradient(90deg,' + lvl.color + ',' + lvl.color + 'cc);border-radius:8px;transition:width 0.5s ease;box-shadow:0 0 12px ' + lvl.color + '66;"></div>';
        h += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:9px;font-weight:900;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.9);white-space:nowrap;">' + pct.toFixed(1) + '%</div>';
        h += '</div>';

        h += '<div style="display:flex;justify-content:space-between;margin-top:6px;font-size:10px;color:#888;font-weight:700;">';
        h += '<span>0 MB</span>';
        h += '<span>حد Firebase: 1 GB (Spark)</span>';
        h += '</div>';
        h += '</div>';

        // ─── Top 3 contributors ───
        if (scan.categories.length > 0) {
            h += '<div style="border-top:1px solid rgba(255,215,0,0.15);padding-top:12px;">';
            h += '<div style="color:#ffd700;font-size:11px;font-weight:900;margin-bottom:8px;display:flex;align-items:center;gap:6px;">🔝 أكبر المساهمين</div>';
            var top = scan.categories.slice(0, 3);
            var maxBytes = top[0].bytes || 1;
            top.forEach(function (cat, i) {
                if (cat.bytes < 1) return;
                var catPct = scan.totalBytes > 0 ? (cat.bytes / scan.totalBytes * 100) : 0;
                var barPct = (cat.bytes / maxBytes * 100);
                h += '<div style="margin-bottom:8px;">';
                h += '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;">';
                h += '<span style="color:#fff;font-weight:900;">' + cat.icon + ' ' + esc(cat.label) + '</span>';
                h += '<span style="color:#888;font-weight:900;">' + formatBytes(cat.bytes) + ' <span style="color:#ffd700;">(' + catPct.toFixed(1) + '%)</span></span>';
                h += '</div>';
                h += '<div style="height:5px;background:rgba(0,0,0,0.4);border-radius:3px;overflow:hidden;">';
                h += '<div style="height:100%;width:' + barPct + '%;background:linear-gradient(90deg,#ffd700,#d4af37);border-radius:3px;"></div>';
                h += '</div>';
                h += '</div>';
            });
            h += '</div>';
        }

        // ─── إجمالي العناصر ───
        h += '<div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,215,0,0.15);display:flex;justify-content:space-between;font-size:11px;">';
        h += '<span style="color:#888;font-weight:700;">📦 إجمالي العناصر:</span>';
        h += '<span style="color:#fff;font-weight:900;">' + scan.totalCount.toLocaleString('en-US') + '</span>';
        h += '</div>';

        // ─── آخر قياس ───
        var ago = Math.round((Date.now() - scan.scannedAt) / 1000);
        var agoText = ago < 60 ? 'الآن' : (ago < 3600 ? ('قبل ' + Math.round(ago / 60) + ' دقيقة') : ('قبل ' + Math.round(ago / 3600) + ' ساعة'));
        h += '<div style="text-align:center;color:#666;font-size:10px;margin-top:8px;">آخر قياس: ' + agoText + ' · التقديرات تقريبية</div>';

        h += '</div>';
        return h;
    }

    // ══════════════════════════════════════════════
    // Core Cleaning Helpers (من v1)
    // ══════════════════════════════════════════════
    async function countSubtree(path) {
        try {
            var snap = await db.ref(path).once('value');
            if (!snap.exists()) return 0;
            var n = 0;
            snap.forEach(function () { n++; });
            return n;
        } catch (e) { return 0; }
    }

    async function removeSubtree(path) {
        var snap = await db.ref(path).once('value');
        if (!snap.exists()) return 0;
        var n = 0;
        snap.forEach(function () { n++; });
        await db.ref(path).remove();
        return n;
    }

    async function cleanByAge(path, timeField, days, onProgress) {
        var cutoff = Date.now() - days * 86400000;
        var totalDeleted = 0;
        for (var iter = 0; iter < MAX_ITERATIONS; iter++) {
            var snap = await db.ref(path).orderByKey().limitToFirst(BATCH_SIZE).once('value');
            if (!snap.exists()) break;
            var toDelete = [];
            var hitRecent = false;
            snap.forEach(function (child) {
                var v = child.val();
                if (v && typeof v[timeField] === 'number' && v[timeField] < cutoff) {
                    toDelete.push(child.key);
                } else {
                    hitRecent = true;
                }
            });
            if (toDelete.length === 0) break;
            var batch = {};
            toDelete.forEach(function (k) { batch[k] = null; });
            await db.ref(path).update(batch);
            totalDeleted += toDelete.length;
            if (onProgress) onProgress(totalDeleted);
            if (hitRecent) break;
            if (snap.numChildren() < BATCH_SIZE) break;
        }
        return totalDeleted;
    }

    async function countByAge(path, timeField, days, maxScan) {
        maxScan = maxScan || 1000;
        var cutoff = Date.now() - days * 86400000;
        try {
            var snap = await db.ref(path).orderByKey().limitToFirst(maxScan).once('value');
            if (!snap.exists()) return 0;
            var count = 0;
            snap.forEach(function (child) {
                var v = child.val();
                if (v && typeof v[timeField] === 'number' && v[timeField] < cutoff) count++;
            });
            return count;
        } catch (e) { return 0; }
    }

    async function countWithFilter(path, filter) {
        try {
            var snap = await db.ref(path).once('value');
            if (!snap.exists()) return 0;
            var count = 0;
            snap.forEach(function (child) {
                if (filter(child.key, child.val())) count++;
            });
            return count;
        } catch (e) { return 0; }
    }

    async function cleanWithFilter(path, filter, onProgress) {
        var snap = await db.ref(path).once('value');
        if (!snap.exists()) return 0;
        var toDelete = [];
        snap.forEach(function (child) {
            if (filter(child.key, child.val())) toDelete.push(child.key);
        });
        if (toDelete.length === 0) return 0;
        var totalDeleted = 0;
        for (var i = 0; i < toDelete.length; i += BATCH_SIZE) {
            var batch = {};
            for (var j = i; j < i + BATCH_SIZE && j < toDelete.length; j++) {
                batch[toDelete[j]] = null;
            }
            await db.ref(path).update(batch);
            totalDeleted += Object.keys(batch).length;
            if (onProgress) onProgress(totalDeleted, toDelete.length);
        }
        return totalDeleted;
    }

    async function countPerUser(path, itemFilter) {
        try {
            var snap = await db.ref(path).once('value');
            if (!snap.exists()) return 0;
            var count = 0;
            snap.forEach(function (userChild) {
                userChild.forEach(function (itemChild) {
                    if (itemFilter(userChild.key, itemChild.key, itemChild.val())) count++;
                });
            });
            return count;
        } catch (e) { return 0; }
    }

    async function cleanPerUser(path, itemFilter, onProgress) {
        var snap = await db.ref(path).once('value');
        if (!snap.exists()) return 0;
        var uids = [];
        snap.forEach(function (userChild) { uids.push(userChild.key); });
        var totalDeleted = 0;
        for (var i = 0; i < uids.length; i++) {
            var uid = uids[i];
            var userSnap = snap.child(uid);
            var toDelete = [];
            userSnap.forEach(function (itemChild) {
                if (itemFilter(uid, itemChild.key, itemChild.val())) {
                    toDelete.push(itemChild.key);
                }
            });
            if (toDelete.length > 0) {
                var batch = {};
                toDelete.forEach(function (k) { batch[k] = null; });
                await db.ref(path + '/' + uid).update(batch);
                totalDeleted += toDelete.length;
            }
            if (onProgress) onProgress(i + 1, uids.length, totalDeleted);
        }
        return totalDeleted;
    }

    // ══════════════════════════════════════════════
    // 8 Cleaning Categories
    // ══════════════════════════════════════════════
    var CATEGORIES = [
        {
            id: 'bot_locks', icon: '🔒', title: 'أقفال البوتات',
            desc: 'علامات منع التكرار + cooldowns — آمن تماماً',
            risk: 'safe',
            estimate: async function () {
                return (await countSubtree('bot_locks/msgs')) + (await countSubtree('bot_locks/welcome'));
            },
            clean: async function (onProgress) {
                var total = 0;
                var paths = ['bot_locks/msgs', 'bot_locks/welcome'];
                for (var i = 0; i < paths.length; i++) {
                    total += await removeSubtree(paths[i]);
                    if (onProgress) onProgress(i + 1, paths.length, total);
                }
                return total;
            }
        },
        {
            id: 'multi_resolved', icon: '🚨', title: 'تنبيهات مكرّرة مُعالَجة',
            desc: 'الحسابات المكررة التي تمت معالجتها (status: resolved)',
            risk: 'safe',
            estimate: function () {
                return countWithFilter('multi_account_alerts', function (k, v) {
                    return v && v.status === 'resolved';
                });
            },
            clean: function (onProgress) {
                return cleanWithFilter('multi_account_alerts', function (k, v) {
                    return v && v.status === 'resolved';
                }, onProgress);
            }
        },
        {
            id: 'stories_expired', icon: '📸', title: 'حالات منتهية',
            desc: 'الحالات المنتهية (24 ساعة) — لا يلمس النشطة',
            risk: 'safe',
            estimate: function () {
                var now = Date.now();
                return countPerUser('stories', function (uid, sid, s) {
                    return s && s.expiresAt && s.expiresAt < now;
                });
            },
            clean: function (onProgress) {
                var now = Date.now();
                return cleanPerUser('stories', function (uid, sid, s) {
                    return s && s.expiresAt && s.expiresAt < now;
                }, onProgress);
            }
        },
        {
            id: 'audit_old', icon: '📜', title: 'سجل النشاط (14 يوم)',
            desc: 'الأقدم من 14 يوماً فقط',
            risk: 'medium',
            estimate: function () { return countByAge('audit_log', 'at', 14, 1000); },
            clean: function (onProgress) { return cleanByAge('audit_log', 'at', 14, onProgress); }
        },
        {
            id: 'notifs_read', icon: '📬', title: 'إشعارات مقروءة (7 أيام)',
            desc: 'فقط المقروءة الأقدم من 7 أيام',
            risk: 'medium',
            estimate: function () {
                var cutoff = Date.now() - 7 * 86400000;
                return countPerUser('user_notifications', function (uid, k, n) {
                    return n && n.read === true && typeof n.time === 'number' && n.time < cutoff;
                });
            },
            clean: function (onProgress) {
                var cutoff = Date.now() - 7 * 86400000;
                return cleanPerUser('user_notifications', function (uid, k, n) {
                    return n && n.read === true && typeof n.time === 'number' && n.time < cutoff;
                }, onProgress);
            }
        },
        {
            id: 'reports_archive_old', icon: '📦', title: 'أرشيف البلاغات (30 يوم)',
            desc: 'البلاغات المعالجة الأقدم من 30 يوماً',
            risk: 'medium',
            estimate: function () { return countByAge('reports_archive', 'processedAt', 30, 500); },
            clean: function (onProgress) { return cleanByAge('reports_archive', 'processedAt', 30, onProgress); }
        },
        {
            id: 'bot_learning_old', icon: '🤖', title: 'أسئلة بوت معلقة (30 يوم)',
            desc: 'الأسئلة التي لم يجب عليها أحد منذ 30 يوماً',
            risk: 'medium',
            estimate: function () { return countByAge('bot_learning/pending', 'time', 30, 500); },
            clean: function (onProgress) { return cleanByAge('bot_learning/pending', 'time', 30, onProgress); }
        },
        {
            id: 'room_messages_trim', icon: '💬', title: 'تقليص رسائل الغرف',
            desc: 'أبقِ آخر 50 رسالة فقط في كل غرفة',
            risk: 'danger',
            estimate: async function () {
                var rooms = Object.keys((typeof QAMAR !== 'undefined' && QAMAR.ROOMS) || {});
                var total = 0;
                for (var i = 0; i < rooms.length; i++) {
                    var n = await countSubtree('room_messages/' + rooms[i]);
                    if (n > 50) total += (n - 50);
                }
                return total;
            },
            clean: async function (onProgress) {
                var rooms = Object.keys((typeof QAMAR !== 'undefined' && QAMAR.ROOMS) || {});
                var totalDeleted = 0;
                for (var i = 0; i < rooms.length; i++) {
                    var room = rooms[i];
                    var snap = await db.ref('room_messages/' + room).orderByKey().once('value');
                    if (!snap.exists()) continue;
                    var keys = [];
                    snap.forEach(function (child) { keys.push(child.key); });
                    if (keys.length <= 50) continue;
                    var toDelete = keys.slice(0, keys.length - 50);
                    for (var j = 0; j < toDelete.length; j += BATCH_SIZE) {
                        var batch = {};
                        for (var k = j; k < j + BATCH_SIZE && k < toDelete.length; k++) {
                            batch[toDelete[k]] = null;
                        }
                        await db.ref('room_messages/' + room).update(batch);
                        totalDeleted += Object.keys(batch).length;
                    }
                    if (onProgress) onProgress(i + 1, rooms.length, totalDeleted);
                }
                return totalDeleted;
            }
        }
    ];

    // ══════════════════════════════════════════════
    // UI Rendering
    // ══════════════════════════════════════════════
    function getRiskLabel(risk) {
        if (risk === 'safe') return { label: '✅ آمن', color: '#4ade80' };
        if (risk === 'medium') return { label: '⚠️ متوسط', color: '#fbbf24' };
        return { label: '🚨 خطير', color: '#ff6666' };
    }

    // ═══ CSS (يُضاف مرة واحدة) ═══
    (function injectCSS() {
        if (document.getElementById('mc-v2-css')) return;
        var s = document.createElement('style');
        s.id = 'mc-v2-css';
        s.textContent = '@keyframes mcSpin{to{transform:rotate(360deg)}}';
        document.head.appendChild(s);
    })();

    function renderMemoryTab() {
        var body = document.getElementById('kr-body');
        if (!body) return;
        if (!isKing()) { body.innerHTML = '<div class="kr-empty">للملك فقط</div>'; return; }

        var cached = loadScanFromCache();
        _currentScan = cached;

        var h = '';

        // ─── المؤشر ───
        h += '<div id="mc-indicator-wrap">' + renderMemoryIndicator(_currentScan, false, null) + '</div>';

        // ─── بطاقة الرأس ───
        h += '<div class="kr-card">';
        h += '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">';
        h += '<button class="kr-btn kr-btn-outline kr-btn-sm" id="mc-estimate-all">👁️ معاينة الكل</button>';
        h += '<button class="kr-btn kr-btn-green kr-btn-sm" id="mc-clean-safe">✅ تنظيف الآمن كاملاً</button>';
        h += '</div>';
        h += '</div>';

        // ─── التصنيفات ───
        CATEGORIES.forEach(function (cat) {
            var risk = getRiskLabel(cat.risk);
            h += '<div class="kr-card" data-cat="' + cat.id + '">';
            h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
            h += '<div style="color:#fff;font-weight:900;font-size:13px;">' + cat.icon + ' ' + esc(cat.title) + '</div>';
            h += '<div style="font-size:10px;font-weight:900;padding:3px 8px;border-radius:12px;background:rgba(0,0,0,0.4);color:' + risk.color + ';">' + risk.label + '</div>';
            h += '</div>';
            h += '<div style="color:#aaa;font-size:11px;line-height:1.5;margin-bottom:10px;">' + esc(cat.desc) + '</div>';
            h += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">';
            h += '<div style="color:#ffd700;font-size:12px;font-weight:900;">📊 <span data-count="' + cat.id + '">—</span></div>';
            h += '<div style="display:flex;gap:6px;">';
            h += '<button class="kr-btn kr-btn-outline kr-btn-sm" data-est="' + cat.id + '">👁️</button>';
            h += '<button class="kr-btn ' + (cat.risk === 'danger' ? 'kr-btn-red' : 'kr-btn-gold') + ' kr-btn-sm" data-clean="' + cat.id + '">🧹 حذف</button>';
            h += '</div>';
            h += '</div>';
            h += '<div data-progress="' + cat.id + '" style="display:none;margin-top:10px;padding:8px;background:rgba(168,85,247,0.1);border-radius:8px;color:#c084fc;font-size:11px;font-weight:900;"></div>';
            h += '</div>';
        });

        body.innerHTML = h;
        bindEvents();

        // ⭐ قياس تلقائي
        if (!cached) {
            setTimeout(function () { runRescan(true); }, 200);
        }
    }

    function bindEvents() {
        var rescanBtn = document.getElementById('mc-rescan');
        if (rescanBtn) rescanBtn.onclick = function () { runRescan(false); };

        var estAll = document.getElementById('mc-estimate-all');
        if (estAll) estAll.onclick = async function () {
            this.disabled = true;
            var orig = this.textContent;
            this.textContent = '⏳ جاري الحساب...';
            await Promise.all(CATEGORIES.map(function (cat) { return runEstimate(cat.id); }));
            this.disabled = false;
            this.textContent = orig;
            toast('fa-check', '✅ تمت المعاينة');
        };

        var cleanSafe = document.getElementById('mc-clean-safe');
        if (cleanSafe) cleanSafe.onclick = async function () {
            var safeCats = CATEGORIES.filter(function (c) { return c.risk === 'safe'; });
            if (!confirm('تنظيف ' + safeCats.length + ' تصنيفات آمنة؟\n\nلا يفقد أي بيانات مهمة.')) return;
            this.disabled = true;
            var orig = this.textContent;
            this.textContent = '⏳ جاري التنظيف...';
            var total = 0;
            for (var i = 0; i < safeCats.length; i++) {
                var n = await runClean(safeCats[i].id, true);
                total += n || 0;
            }
            this.disabled = false;
            this.textContent = orig;
            logAudit('memory_clean_safe', { total: total });
            toast('fa-check', '🧹 تم حذف ' + total + ' عنصر');
            // ⭐ أعد القياس بعد التنظيف
            setTimeout(function () { runRescan(true); }, 500);
        };

        document.querySelectorAll('[data-est]').forEach(function (btn) {
            btn.onclick = function () { runEstimate(this.getAttribute('data-est')); };
        });
        document.querySelectorAll('[data-clean]').forEach(function (btn) {
            btn.onclick = function () { runClean(this.getAttribute('data-clean')); };
        });
    }

    // ══════════════════════════════════════════════
    // Memory Scan
    // ══════════════════════════════════════════════
    async function runRescan(silent) {
        if (_scanning) return;
        _scanning = true;

        var wrap = document.getElementById('mc-indicator-wrap');
        if (wrap) {
            wrap.innerHTML = renderMemoryIndicator(null, true, { current: 0, total: MEASUREMENTS.length, label: 'البدء...' });
        }

        try {
            var scan = await measureMemory(function (i, total, label) {
                if (wrap) {
                    wrap.innerHTML = renderMemoryIndicator(null, true, { current: i, total: total, label: label });
                }
            });

            _currentScan = scan;
            saveScanToCache(scan);

            if (wrap) {
                wrap.innerHTML = renderMemoryIndicator(scan, false, null);
                // أعد ربط زر rescan
                var btn = document.getElementById('mc-rescan');
                if (btn) btn.onclick = function () { runRescan(false); };
            }

            if (!silent) toast('fa-check', '📊 تم القياس');
        } catch (e) {
            console.warn('memory rescan failed:', e);
            if (wrap) {
                wrap.innerHTML = renderMemoryIndicator(null, false, null);
                var btn = document.getElementById('mc-rescan');
                if (btn) btn.onclick = function () { runRescan(false); };
            }
            if (!silent) toast('fa-times', '⚠️ فشل القياس');
        }

        _scanning = false;
    }

    // ══════════════════════════════════════════════
    // Category Actions
    // ══════════════════════════════════════════════
    async function runEstimate(catId) {
        var cat = CATEGORIES.find(function (c) { return c.id === catId; });
        if (!cat) return 0;
        var countEl = document.querySelector('[data-count="' + catId + '"]');
        if (countEl) countEl.textContent = '⏳...';
        try {
            var n = await cat.estimate();
            if (countEl) countEl.textContent = n + ' عنصر';
            return n;
        } catch (e) {
            if (countEl) countEl.textContent = '⚠️ فشل';
            return 0;
        }
    }

    async function runClean(catId, silent) {
        var cat = CATEGORIES.find(function (c) { return c.id === catId; });
        if (!cat) return 0;

        if (cat.risk !== 'safe' && !silent) {
            if (cat.risk === 'danger') {
                var word = prompt('⚠️ تصنيف خطير!\n\n' + cat.title + '\n' + cat.desc + '\n\nاكتب "حذف" للتأكيد:');
                if (!word || word.trim() !== 'حذف') {
                    toast('fa-times', '❌ أُلغي');
                    return 0;
                }
            } else {
                if (!confirm('تنظيف "' + cat.title + '"؟\n\n' + cat.desc)) return 0;
            }
        }

        var progressEl = document.querySelector('[data-progress="' + catId + '"]');
        if (progressEl) {
            progressEl.style.display = 'block';
            progressEl.textContent = '⏳ جاري التنظيف...';
        }

        try {
            var total = await cat.clean(function (done, all, count) {
                if (progressEl) {
                    if (all) {
                        progressEl.textContent = '⏳ ' + done + ' / ' + all + (count ? ' (حُذف: ' + count + ')' : '');
                    } else {
                        progressEl.textContent = '⏳ حُذف: ' + done;
                    }
                }
            });

            if (progressEl) {
                progressEl.textContent = '✅ تم حذف ' + total + ' عنصر';
                setTimeout(function () { progressEl.style.display = 'none'; }, 5000);
            }

            await runEstimate(catId);

            if (!silent) {
                logAudit('memory_clean_' + catId, { total: total });
                toast('fa-check', '🧹 تم حذف ' + total + ' عنصر');
            }
            return total;
        } catch (e) {
            if (progressEl) progressEl.textContent = '❌ فشل: ' + e.message;
            if (!silent) toast('fa-times', '⚠️ ' + e.message);
            return 0;
        }
    }

    // ══════════════════════════════════════════════
    // Tab Injection
    // ══════════════════════════════════════════════
    function injectTabButton() {
        if (!isKing()) return;
        var tabs = document.getElementById('kr-tabs');
        if (!tabs) return;
        if (tabs.querySelector('[data-tab="' + TAB_ID + '"]')) return;
        var btn = document.createElement('button');
        btn.className = 'kr-tab';
        btn.setAttribute('data-tab', TAB_ID);
        btn.textContent = TAB_LABEL;
        btn.onclick = function () {
            tabs.querySelectorAll('.kr-tab').forEach(function (t) { t.classList.remove('active'); });
            btn.classList.add('active');
            renderMemoryTab();
        };
        tabs.appendChild(btn);
    }

    function observeTabs() {
        var tabs = document.getElementById('kr-tabs');
        if (!tabs) { setTimeout(observeTabs, 500); return; }
        injectTabButton();
        new MutationObserver(injectTabButton).observe(tabs, { childList: true });
    }

    function observeKingRoom() {
        var view = document.getElementById('king-room-view');
        if (!view) { setTimeout(observeKingRoom, 500); return; }
        new MutationObserver(function () {
            if (view.classList.contains('active')) injectTabButton();
        }).observe(view, { attributes: true, attributeFilter: ['class'] });
    }

    // ══════════════════════════════════════════════
    // Init
    // ══════════════════════════════════════════════
    function init() {
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            if (typeof db !== 'undefined' && db && typeof QAMAR !== 'undefined' && window.KingRoom) {
                clearInterval(t);
                observeTabs();
                observeKingRoom();
                console.log('🧹 memory-cleaner.js v2: ready (' + CATEGORIES.length + ' cats + memory indicator)');
            }
            if (attempts >= 40) clearInterval(t);
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.MemoryCleaner = {
        open: function () {
            if (window.KingRoom && typeof window.KingRoom.open === 'function') {
                window.KingRoom.open();
                setTimeout(function () {
                    var tabs = document.getElementById('kr-tabs');
                    var btn = tabs && tabs.querySelector('[data-tab="' + TAB_ID + '"]');
                    if (btn) btn.click();
                }, 150);
            }
        },
        render: renderMemoryTab,
        rescan: function () { return runRescan(false); },
        categories: CATEGORIES,
        version: 2
    };

    console.log('🧹 memory-cleaner.js v2 (TEST) loaded — memory indicator + 8 cats');
})();
