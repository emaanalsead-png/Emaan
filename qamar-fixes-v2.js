// ==============================================
// qamar-fixes-v2.js — حزمة إصلاحات شاملة
// ==============================================
// ✅ الإصلاحات (8):
//   1. حذف زر الموسيقى من الشريط العائم
//   2. منع اليوتيوب + الإخفاء الكامل للزوار
//   3. النقل القسري (forced transfer) يعمل مع chat.js v3.16
//   4. صورة زائر موحدة (SVG قمر ذهبي)
//   5. استوديو التسجيل: 80+ فقط
//   6. منع ترقية الزوار (bottom nav + iframe)
//   7. حماية شاملة لصلاحيات الزوار
//   8. الفحص الدوري لكل الإصلاحات
// ==============================================

(function () {
    'use strict';
    if (window.__qamarFixesV2) return;
    window.__qamarFixesV2 = true;

    /* ════════ CONFIG ════════ */
    const STUDIO_MIN_LEVEL = 80; // Grand Owner+

    // صورة الزائر الموحدة — قمر ذهبي على خلفية داكنة
    const GUEST_AVATAR = "data:image/svg+xml;charset=utf-8," +
        "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E" +
        "%3Cdefs%3E%3CradialGradient id='g' cx='35%25' cy='35%25'%3E" +
        "%3Cstop offset='0%25' stop-color='%23fffef0'/%3E" +
        "%3Cstop offset='40%25' stop-color='%23ffd700'/%3E" +
        "%3Cstop offset='100%25' stop-color='%23b8860b'/%3E" +
        "%3C/radialGradient%3E%3C/defs%3E" +
        "%3Ccircle cx='50' cy='50' r='48' fill='%23050508' stroke='%23d4af37' stroke-width='2'/%3E" +
        "%3Cpath d='M 62 22 A 28 28 0 1 0 62 78 A 22 22 0 1 1 62 22 Z' fill='url(%23g)'/%3E" +
        "%3C/svg%3E";

    /* ════════ HELPERS ════════ */
    function getMe() {
        try {
            if (typeof getCurrentUser === 'function') {
                var u = getCurrentUser();
                if (u && u.uid) return u;
            }
        } catch (e) {}
        try {
            return JSON.parse(localStorage.getItem('qamar_current_user') || 'null');
        } catch (e) { return null; }
    }

    function isGuest() {
        var me = getMe();
        return !!(me && me.isGuest === true);
    }

    function myLevel() {
        var me = getMe();
        if (!me) return 0;
        if (typeof me.rankLevel === 'number') return me.rankLevel;
        try {
            if (typeof getRankLevel === 'function') return getRankLevel(me.rank) || 0;
        } catch (e) {}
        return 0;
    }

    function toast(icon, msg) {
        if (typeof showToast === 'function') showToast(icon, msg);
    }

    function log() {
        console.log('[qamar-fixes-v2]', ...arguments);
    }

    /* ═══════════════════════════════════════════════ */
    /* 1. حذف زر الموسيقى من الشريط العائم            */
    /* ═══════════════════════════════════════════════ */
    function removeMusicButton() {
        var tb = document.getElementById('floating-toolbar');
        if (!tb) return;
        // البحث عن "audio" أو "music" (الاسمان المحتملان)
        var btn = tb.querySelector('[data-action="music"]') ||
                  tb.querySelector('[data-action="audio"]');
        if (btn && btn.parentNode) {
            btn.parentNode.removeChild(btn);
            log('music button removed');
        }
    }

    /* ═══════════════════════════════════════════════ */
    /* 2. حماية الزوار: الشريط العائم + اليوتيوب      */
    /* ═══════════════════════════════════════════════ */
    function enforceGuestToolbarRestrictions() {
        if (!isGuest()) return;

        // إخفاء الشريط العائم كاملاً
        var tb = document.getElementById('floating-toolbar');
        if (tb) tb.style.display = 'none';

        // إخفاء زر + (Plus)
        var plus = document.getElementById('plus-btn');
        if (plus) {
            plus.style.display = 'none';
            plus.disabled = true;
        }

        // إخفاء زر الإيموجي (media picker)
        var emojiBtns = document.querySelectorAll('.emoji-btn');
        emojiBtns.forEach(function (b) { b.style.display = 'none'; });

        // إخفاء زر الترقية في bottom nav
        var upgradeBtn = document.getElementById('upgrade-nav-btn');
        if (upgradeBtn) upgradeBtn.style.display = 'none';
    }

    function hideYouTubeInToolbar() {
        if (!isGuest()) return;
        var btn = document.querySelector('#floating-toolbar .tool-btn[data-action="youtube"]');
        if (btn) btn.style.display = 'none';
    }

    /* ═══════════════════════════════════════════════ */
    /* 3. النقل القسري (forced transfer) — يعمل مع v3.16 */
    /* ═══════════════════════════════════════════════ */
    function startForcedTransferListener() {
        var me = getMe();
        if (!me || !me.uid) return;
        if (typeof db === 'undefined' || !db) return;

        // تجنب التكرار
        if (window.__forcedTransferListenerStarted) return;
        window.__forcedTransferListenerStarted = true;

        var ref = db.ref('user_presence/' + me.uid);
        ref.on('value', function (snap) {
            var p = snap.val() || {};

            // هل يوجد forced flag نشط؟
            if (p.forced !== true) return;
            if (!p.room) return;

            // احصل على الغرفة الحالية
            var currentRoom = 'general';
            try {
                if (typeof ChatState !== 'undefined' && ChatState.currentRoom) {
                    currentRoom = ChatState.currentRoom;
                }
            } catch (e) {}

            // إذا نحن بالفعل في الغرفة الصحيحة → نظّف flag
            if (p.room === currentRoom) {
                db.ref('user_presence/' + me.uid).update({
                    forced: null,
                    forcedBy: null,
                    forcedReason: null
                }).catch(function () {});
                return;
            }

            // غيّر الغرفة
            var roomName = p.room;
            try {
                if (typeof QAMAR !== 'undefined' && QAMAR.ROOMS && QAMAR.ROOMS[p.room]) {
                    var r = QAMAR.ROOMS[p.room];
                    roomName = (r.name || p.room) + ' ' + (r.icon || '🚪');
                }
            } catch (e) {}

            // استدعِ switchRoom
            try {
                if (typeof window.switchRoom === 'function') {
                    window.switchRoom(p.room, roomName);
                }
            } catch (e) {
                console.warn('switchRoom failed:', e);
            }

            // رسالة حسب السبب
            var reason = p.forcedReason || 'system';
            var msg = '📢 تم نقلك إلى ' + roomName;
            if (reason === 'jail') msg = '⛓️ تم نقلك إلى السجن';
            else if (reason === 'jail_release') msg = '🔓 تم إخراجك من السجن';
            else if (reason === 'kick_from_room') msg = '🚪 تم نقلك لغرفة أخرى';
            else if (p.forcedBy) msg = '📢 نقلك الإداري إلى ' + roomName;

            toast('fa-exchange-alt', msg);

            // نظّف الـ flag
            db.ref('user_presence/' + me.uid).update({
                forced: null,
                forcedBy: null,
                forcedReason: null
            }).catch(function () {});
        });

        log('forced transfer listener started');
    }

    /* ═══════════════════════════════════════════════ */
    /* 4. صورة الزائر الموحدة                         */
    /* ═══════════════════════════════════════════════ */
    async function fixGuestAvatar() {
        if (!isGuest()) return;
        var me = getMe();
        if (!me || !me.uid) return;

        try {
            // اقرأ الصورة الحالية من Firebase
            var snap = await db.ref('users/' + me.uid + '/avatar').once('value');
            var current = snap.val();

            if (current === GUEST_AVATAR) return; // محدّثة بالفعل

            // اكتب الصورة الموحدة
            await db.ref('users/' + me.uid + '/avatar').set(GUEST_AVATAR);
            log('guest avatar fixed');

            // حدّث localStorage
            me.avatar = GUEST_AVATAR;
            if (typeof saveSession === 'function') {
                saveSession(me, true);
            }
        } catch (e) {
            // القواعد قد تمنع هذا في حالات نادرة — تجاهل
            console.warn('fixGuestAvatar:', e.message);
        }
    }

    /* ═══════════════════════════════════════════════ */
    /* 5. استوديو التسجيل: 80+ فقط                    */
    /* ═══════════════════════════════════════════════ */
    function enforceStudioPermission() {
        var me = getMe();
        if (!me) return;

        var btn = document.querySelector('.vx-btn.studio');
        if (!btn) return;

        // الزائر: منع مطلق
        if (me.isGuest === true) {
            btn.remove();
            return;
        }

        // أقل من 80: منع
        var lvl = myLevel();
        if (lvl < STUDIO_MIN_LEVEL) {
            btn.remove();
        }
    }

    /* ═══════════════════════════════════════════════ */
    /* 6. منع ترقية الزوار (bottom nav + iframe)      */
    /* ═══════════════════════════════════════════════ */
    function blockGuestUpgrade() {
        if (!isGuest()) return;

        // bottom nav
        var btn = document.getElementById('upgrade-nav-btn');
        if (btn) btn.style.display = 'none';

        // داخل iframe (بروفايل)
        try {
            var iframe = document.getElementById('profile-iframe');
            if (iframe && iframe.contentWindow && iframe.contentDocument) {
                var doc = iframe.contentDocument;
                var upBtn = doc.getElementById('upgrade-nav-btn');
                if (upBtn) upBtn.style.display = 'none';
                // زر الترقية داخل صفحة البروفايل نفسها
                var upgradeModal = doc.getElementById('upgrade-modal');
                if (upgradeModal) upgradeModal.style.display = 'none';
            }
        } catch (e) {}
    }

    /* ═══════════════════════════════════════════════ */
    /* 7. حماية شاملة للزوار                          */
    /* ═══════════════════════════════════════════════ */
    function enforceGuestRestrictions() {
        if (!isGuest()) return;

        // منع فتح modal الترقية
        if (typeof window.openUpgradeModal === 'function' && !window.openUpgradeModal.__guestBlocked) {
            var orig = window.openUpgradeModal;
            window.openUpgradeModal = function () {
                toast('fa-user-secret', '🕵️ هذه الميزة للأعضاء فقط');
                return false;
            };
            window.openUpgradeModal.__guestBlocked = true;
        }

        // منع MediaPicker
        if (window.MediaPicker && typeof window.MediaPicker.open === 'function' && !window.MediaPicker.open.__guestBlocked) {
            var origMP = window.MediaPicker.open;
            window.MediaPicker.open = function () {
                toast('fa-user-secret', '🕵️ هذه الميزة للأعضاء فقط');
                return Promise.resolve();
            };
            window.MediaPicker.open.__guestBlocked = true;
        }

        // منع يوتيوب
        if (typeof window.searchYouTube === 'function' && !window.searchYouTube.__guestBlocked) {
            window.searchYouTube = function () {
                toast('fa-user-secret', '🕵️ يوتيوب للأعضاء فقط');
                return false;
            };
            window.searchYouTube.__guestBlocked = true;
        }

        // منع النرد
        if (typeof window.rollDice === 'function' && !window.rollDice.__guestBlocked) {
            window.rollDice = function () {
                toast('fa-user-secret', '🕵️ النرد للأعضاء فقط');
                return false;
            };
            window.rollDice.__guestBlocked = true;
        }

        // منع الرسائل الخاصة
        if (typeof window.openPrivateChatWith === 'function' && !window.openPrivateChatWith.__guestBlocked) {
            window.openPrivateChatWith = function () {
                toast('fa-user-secret', '🕵️ الخاص للأعضاء فقط');
                return false;
            };
            window.openPrivateChatWith.__guestBlocked = true;
        }

        // منع إرسال رسائل خاصة
        if (typeof window.sendPrivateMsg === 'function' && !window.sendPrivateMsg.__guestBlocked) {
            window.sendPrivateMsg = function () {
                toast('fa-user-secret', '🕵️ الخاص للأعضاء فقط');
                return false;
            };
            window.sendPrivateMsg.__guestBlocked = true;
        }

        // منع فتح الملفات
        if (window.MediaPicker && typeof window.MediaPicker.open === 'function' && !window.MediaPicker.open.__blocked2) {
            window.MediaPicker.open.__blocked2 = true;
        }
    }

    /* ═══════════════════════════════════════════════ */
    /* 8. الفحص الدوري                                 */
    /* ═══════════════════════════════════════════════ */
    function periodicScan() {
        removeMusicButton();
        enforceGuestToolbarRestrictions();
        hideYouTubeInToolbar();
        enforceStudioPermission();
        blockGuestUpgrade();
        enforceGuestRestrictions();
    }

    /* ═══════════════════════════════════════════════ */
    /* INIT                                            */
    /* ═══════════════════════════════════════════════ */
    function init() {
        log('initializing...');

        // انتظر جاهزية Firebase والمستخدم
        var tries = 0;
        var t = setInterval(function () {
            tries++;
            var me = getMe();
            var hasDb = typeof db !== 'undefined' && db;
            var hasChat = typeof window.switchRoom === 'function';

            if (me && me.uid && hasDb) {
                clearInterval(t);
                log('ready | user:', me.name, '| guest:', me.isGuest);

                // تشغيل الإصلاحات
                startForcedTransferListener();
                fixGuestAvatar();

                // فحص فوري
                periodicScan();

                // فحص دوري كل ثانية
                setInterval(periodicScan, 1000);

                // فحص إضافي عند التحميل الكامل
                window.addEventListener('load', function () {
                    setTimeout(periodicScan, 500);
                    setTimeout(periodicScan, 2000);
                    setTimeout(periodicScan, 5000);
                });
            }

            if (tries >= 120) {
                clearInterval(t);
                log('init timeout');
            }
        }, 500);
    }

    /* ════════ Public API ════════ */
    window.QamarFixesV2 = {
        version: 2,
        guestAvatar: GUEST_AVATAR,
        runScan: periodicScan,
        isGuest: isGuest,
        myLevel: myLevel
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('✅ qamar-fixes-v2.js loaded — 8 fixes applied');
})();
