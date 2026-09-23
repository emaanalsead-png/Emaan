// ==============================================
// chat-optimizer.js v1
// ==============================================
// ✅ الهدف:
//   1. تأجيل listeners ثقيلة من chat.js
//   2. تقليل ضغط Firebase عند بدء التطبيق
//   3. بدون أي خسارة في الميزات
// ==============================================
// المبدأ: لا نفتح كل الاتصالات دفعة واحدة
// عند فتح التطبيق، يُشغَّل الأساسي فقط
// الباقي يأتي تدريجياً بعد 3-6 ثواني
// ==============================================

(function () {
    'use strict';
    if (window.__chatOptimizerV1) return;
    window.__chatOptimizerV1 = true;

    console.log('📊 chat-optimizer v1: deferring heavy listeners...');

    /* ══════════════════════════════════════════════ */
    /* تأجيل listener — يُشغَّل بعد ms              */
    /* ══════════════════════════════════════════════ */
    function _defer(name, ms) {
        var _orig = window[name];
        if (typeof _orig !== 'function') {
            console.warn('chat-optimizer: ' + name + ' not found');
            return;
        }
        if (_orig.__optimizedDeferred) return;

        var wrapped = function () {
            var args = arguments;
            var self = this;
            setTimeout(function () {
                try {
                    _orig.apply(self, args);
                    console.log('⏱️ chat-optimizer: ' + name + ' started (after ' + ms + 'ms)');
                } catch (e) {
                    console.warn('chat-optimizer: ' + name + ' failed:', e);
                }
            }, ms);
        };
        wrapped.__optimizedDeferred = true;
        window[name] = wrapped;
    }

    /* ══════════════════════════════════════════════ */
    /* جدول التأجيل                                    */
    /* ══════════════════════════════════════════════ */
    // 3000ms: الإشعارات (المستخدم لا يحتاجها فوراً)
    _defer('startNotificationsListener', 3000);

    // 3000ms: قائمة المحادثات الخاصة
    _defer('startPrivateChatsListener', 3000);

    // 5000ms: المحظورون
    _defer('startBlockedListener', 5000);

    // 6000ms: الوضع المخفي (نادراً ما يستخدم)
    _defer('startInvisibleListener', 6000);

    /* ══════════════════════════════════════════════ */
    /* watchRoomSettings: بعد 4 ثواني                 */
    /* ══════════════════════════════════════════════ */
    var _origWatch = window.watchRoomSettings;
    if (typeof _origWatch === 'function') {
        window.watchRoomSettings = function () {
            setTimeout(function () {
                try { _origWatch.apply(this, arguments); } catch (e) {}
            }, 4000);
        };
    }

    /* ══════════════════════════════════════════════ */
    /* applyRoomSettings: دفعة واحدة — ليست listener   */
    /* ══════════════════════════════════════════════ */
    // لا نلمسها — تعمل بشكل جيد

    /* ══════════════════════════════════════════════ */
    /* bots: بدل 7 listeners، نؤجل initBots نفسه      */
    /* ══════════════════════════════════════════════ */
    // initBots يُستدعى من initChat — سنؤجله
    var _origInitBots = window.initBots;
    if (typeof _origInitBots === 'function') {
        window.initBots = function () {
            setTimeout(function () {
                try { _origInitBots.apply(this, arguments); } catch (e) {}
            }, 2500);
        };
    }

    console.log('✅ chat-optimizer v1: 5 listeners + watchRoom + bots deferred');

})();
