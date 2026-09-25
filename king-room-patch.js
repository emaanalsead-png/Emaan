// ==============================================
// king-room-patch.js v2 — إخفاء السجان عن الملكات
// ==============================================
// ✅ v2 (فوق v1):
//   1. إخفاء تبويب السجان في king-room
//   2. إخفاء خيار Guardian داخل openBotManager
//   3. مراقبة أكثر شمولاً
// ==============================================

(function () {
    'use strict';
    if (window.__kingRoomPatchV2) return;
    window.__kingRoomPatchV2 = true;

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

    /* 1. إخفاء تبويب السجان في king-room */
    function _hideGuardianTab() {
        if (isKing()) return;
        var tabs = document.querySelectorAll('#kr-tabs .kr-tab');
        tabs.forEach(function (t) {
            var txt = t.textContent || '';
            if (txt.indexOf('السجان') !== -1 && txt.indexOf('🚔') !== -1) {
                t.style.display = 'none';
            }
        });
    }

    /* 2. إخفاء بطاقة "إدارة البجان" في تبويب البوتات */
    function _hideGuardianCard() {
        if (isKing()) return;
        var body = document.getElementById('kr-body');
        if (!body) return;

        var cards = body.querySelectorAll('.kr-card');
        cards.forEach(function (card) {
            var txt = card.textContent || '';
            if (txt.indexOf('إدارة السجان') !== -1 || txt.indexOf('السجان يحمي') !== -1) {
                card.style.display = 'none';
            }
        });
    }

    /* 3. إخفاء تبويب Guardian داخل openBotManager */
    function _hideGuardianInBotManager() {
        if (isKing()) return;
        var modal = document.getElementById('bot-manager-modal');
        if (!modal || modal.style.display === 'none') return;

        var tabs = modal.querySelectorAll('.bm-tab');
        tabs.forEach(function (t) {
            var tabId = t.getAttribute('data-tab');
            var txt = t.textContent || '';
            if (tabId === 'badwords' || tabId === 'kickwords' ||
                txt.indexOf('سجن') !== -1 || txt.indexOf('طرد') !== -1) {
                t.style.display = 'none';
            }
        });

        var content = modal.querySelector('#bm-content');
        if (!content) return;
        var children = content.querySelectorAll('*');
        children.forEach(function (c) {
            var txt = c.textContent || '';
            if (txt.indexOf('إدارة السجان') !== -1 ||
                txt.indexOf('كلمات السجن') !== -1 ||
                txt.indexOf('كلمات الطرد') !== -1 ||
                txt.indexOf('السجان يحمي') !== -1) {
                c.style.display = 'none';
            }
        });

        var importBtn = modal.querySelector('#kr-bm-import, #kr-guardian-import');
        if (importBtn) importBtn.style.display = 'none';
    }

    function _scan() {
        _hideGuardianTab();
        _hideGuardianCard();
        _hideGuardianInBotManager();
    }

    setInterval(_scan, 700);

    function _startObserver() {
        var krView = document.getElementById('king-room-view');
        if (krView && !krView.__krpV2) {
            krView.__krpV2 = true;
            new MutationObserver(function () { setTimeout(_scan, 100); }).observe(krView, { childList: true, subtree: true });
        }
        var botMgr = document.getElementById('bot-manager-modal');
        if (botMgr && !botMgr.__krpV2) {
            botMgr.__krpV2 = true;
            new MutationObserver(function () { setTimeout(_scan, 100); }).observe(botMgr, { childList: true, subtree: true, attributes: true });
        }
        if (!krView || !botMgr) setTimeout(_startObserver, 1500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _startObserver);
    } else { _startObserver(); }

    _scan();
    console.log('✅ king-room-patch.js v2 loaded');
})();
