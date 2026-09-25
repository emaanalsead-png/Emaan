// ==============================================
// king-room-patch.js v1 — إخفاء تبويب السجان عن الملكات
// ==============================================
// ✅ v1:
//   1. مراقبة مستمرة لتبويبات غرفة الملك
//   2. إخفاء تبويب "🚔 السجان" لو المستخدم ملكة (مو ملك)
//   3. إخفاء بطاقة السجان في تبويب البوتات للملكات
// ==============================================

(function () {
    'use strict';
    if (window.__kingRoomPatchV1) return;
    window.__kingRoomPatchV1 = true;

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

    function _hideGuardianTab() {
        if (isKing()) return;   /* الملك يشوفه */

        /* 1. تبويب السجان في الهيدر */
        var tabs = document.querySelectorAll('#kr-tabs .kr-tab');
        tabs.forEach(function (t) {
            var txt = t.textContent || '';
            if (txt.indexOf('السجان') !== -1) {
                t.style.display = 'none';
                t.setAttribute('data-hidden-for-queen', '1');
            }
        });
    }

    function _hideGuardianInBotsTab() {
        if (isKing()) return;   /* الملك يشوفه */

        var body = document.getElementById('kr-body');
        if (!body) return;

        /* ابحث عن أي عنصر يحتوي على "السجان" في تبويب البوتات */
        var cards = body.querySelectorAll('.kr-card');
        cards.forEach(function (card) {
            var txt = card.textContent || '';
            if (txt.indexOf('السجان') !== -1 && txt.indexOf('إدارة السجان') !== -1) {
                card.style.display = 'none';
                card.setAttribute('data-hidden-for-queen', '1');
            }
            /* زر استيراد كلمات الطرد */
            var importBtn = card.querySelector('#kr-guardian-import');
            if (importBtn) {
                card.style.display = 'none';
            }
        });

        /* إخفاء أي زر يفتح لوحة السجان */
        var buttons = body.querySelectorAll('button, .kr-btn');
        buttons.forEach(function (b) {
            var txt = b.textContent || '';
            if (txt.indexOf('السجان') !== -1 && !b.hasAttribute('data-hidden-for-queen')) {
                b.style.display = 'none';
                b.setAttribute('data-hidden-for-queen', '1');
            }
        });
    }

    function _scan() {
        _hideGuardianTab();
        _hideGuardianInBotsTab();
    }

    /* مراقبة مستمرة */
    setInterval(_scan, 800);

    /* مراقبة عبر MutationObserver */
    var observer = null;
    function _startObserver() {
        var krView = document.getElementById('king-room-view');
        if (!krView) {
            setTimeout(_startObserver, 1500);
            return;
        }
        if (observer) return;

        observer = new MutationObserver(function () {
            setTimeout(_scan, 100);
        });
        observer.observe(krView, { childList: true, subtree: true });

        _scan();
        console.log('✅ king-room-patch: observer started');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _startObserver);
    } else {
        _startObserver();
    }

    console.log('✅ king-room-patch.js v1 loaded — السجان للملك فقط');
})();
