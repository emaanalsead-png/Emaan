// ==============================================
// قمر الشام — إخفاء الرسائل المخالفة (v2)
// ==============================================
// ✅ client-side فقط، بلا أي تعديل على Firebase Rules
// ✅ يقرأ badWords + kickWords
// ✅ يخفي الفقاعة كاملة
// ==============================================

(function () {
    'use strict';
    if (window.__guardianHideV2) return;
    window.__guardianHideV2 = true;

    var badList = [];
    var kickList = [];
    var seen = {};

    function normalizeArabic(text) {
        if (!text) return '';
        return String(text)
            .toLowerCase()
            .replace(/[أإآٱا]/g, 'ا')
            .replace(/[يىئ]/g, 'ي')
            .replace(/ة/g, 'ه')
            .replace(/[\u064B-\u065F\u0670]/g, '')
            .replace(/\s+/g, ' ');
    }

    function hasBadWord(text) {
        if (!text) return false;
        var all = badList.concat(kickList);
        if (!all.length) return false;
        var n = normalizeArabic(text);
        for (var i = 0; i < all.length; i++) {
            var w = normalizeArabic(all[i]);
            if (w && n.indexOf(w) !== -1) return true;
        }
        return false;
    }

    function loadWords() {
        if (typeof db === 'undefined' || !db) {
            setTimeout(loadWords, 1500);
            return;
        }

        function update() {
            console.log('🚔 Guardian-Hide: ' + badList.length + ' bad + ' + kickList.length + ' kick = ' + (badList.length + kickList.length) + ' words');
            hideExistingMessages();
        }

        db.ref('bot_memory/badWords').on('value', function (s) {
            badList = [];
            var v = s.val() || {};
            Object.keys(v).forEach(function (k) {
                var it = v[k];
                var txt = (typeof it === 'string') ? it : (it.text || '');
                if (txt) badList.push(txt);
            });
            update();
        });

        db.ref('bot_memory/kickWords').on('value', function (s) {
            kickList = [];
            var v = s.val() || {};
            Object.keys(v).forEach(function (k) {
                var it = v[k];
                var txt = (typeof it === 'string') ? it : (it.text || '');
                if (txt) kickList.push(txt);
            });
            update();
        });
    }

    function hideMessageEl(el) {
        if (!el || el.classList.contains('hidden-by-guardian')) return;
        el.style.display = 'none';
        el.classList.add('hidden-by-guardian');
    }

    function checkMessage(msgEl) {
        if (!msgEl || msgEl.classList.contains('system')) return;
        if (msgEl.classList.contains('bot')) return;
        if (msgEl.classList.contains('hidden-by-guardian')) return;

        var msgId = msgEl.getAttribute('data-msg-id');
        if (!msgId) return;
        if (seen[msgId]) return;

        var textEl = msgEl.querySelector('.message-text');
        if (!textEl) return;
        var text = textEl.textContent || '';

        if (hasBadWord(text)) {
            hideMessageEl(msgEl);
            seen[msgId] = true;
            console.log('🚔 Guardian-Hide: hid message', msgId, '→', text.substring(0, 30));
        }
    }

    function hideExistingMessages() {
        var container = document.getElementById('messages');
        if (!container) return;
        container.querySelectorAll('.message').forEach(checkMessage);
    }

    function installObserver() {
        var container = document.getElementById('messages');
        if (!container) {
            setTimeout(installObserver, 1500);
            return;
        }

        var obs = new MutationObserver(function (muts) {
            muts.forEach(function (m) {
                m.addedNodes.forEach(function (node) {
                    if (node.nodeType !== 1) return;
                    if (!node.classList.contains('message')) return;
                    setTimeout(function () { checkMessage(node); }, 50);
                });
            });
        });
        obs.observe(container, { childList: true, subtree: false });

        hideExistingMessages();
        console.log('🚔 Guardian-Hide v2: observer installed');
    }

    function start() {
        loadWords();
        installObserver();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }

    console.log('🚔 guardian-hide.js v2 loaded');
})();
