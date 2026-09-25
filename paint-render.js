// ==============================================
// paint-render.js v1 — عرض [paint:URL] كبطاقة
// ==============================================
// ✅ v1:
//   1. Scanner يعمل كل 800ms (لا يفشل)
//   2. hook على displayMessage + displayPrivateMsg
//   3. عرض بطاقة أنيقة للرسمة (checkerboard + badge)
//   4. يعمل مع [paint:URL] في الشات + الخاص
// ==============================================

(function () {
    'use strict';
    if (window.__paintRenderV1) return;
    window.__paintRenderV1 = true;

    var SCAN_INTERVAL_MS = 800;

    /* ══════════════════════════════════════════════ */
    /* CSS                                            */
    /* ══════════════════════════════════════════════ */
    (function injectCSS() {
        if (document.getElementById('paint-render-css')) return;
        var s = document.createElement('style');
        s.id = 'paint-render-css';
        s.textContent = `
.pr-card {
    display: inline-block;
    max-width: 260px;
    margin-top: 6px;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(255,215,0,0.4);
    background: #0a0a15;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.15s;
    position: relative;
    vertical-align: middle;
}
.pr-card:hover {
    border-color: #ffd700;
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(255,215,0,0.35);
}
.pr-card:active { transform: scale(0.98); }
.pr-thumb {
    width: 100%;
    min-height: 140px;
    background:
        linear-gradient(45deg, #1a1a2e 25%, transparent 25%),
        linear-gradient(-45deg, #1a1a2e 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #1a1a2e 75%),
        linear-gradient(-45deg, transparent 75%, #1a1a2e 75%);
    background-size: 16px 16px;
    background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
    background-color: #0a0a15;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    box-sizing: border-box;
}
.pr-thumb img {
    max-width: 100%;
    max-height: 220px;
    display: block;
    border-radius: 6px;
}
.pr-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    background: linear-gradient(135deg, #ffd700, #d4af37);
    color: #000;
    font-size: 10px;
    font-weight: 900;
    padding: 3px 9px;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    letter-spacing: 0.3px;
}
.pr-meta {
    padding: 6px 10px;
    background: rgba(0,0,0,0.5);
    color: #aaa;
    font-size: 10px;
    text-align: center;
    font-weight: 900;
    letter-spacing: 0.3px;
}

/* Lightbox */
#pr-lightbox {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.96);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    z-index: 1000100;
    display: none;
    justify-content: center;
    align-items: center;
    padding: 20px;
    cursor: zoom-out;
    direction: rtl;
}
#pr-lightbox.active { display: flex; }
#pr-lightbox img {
    max-width: 100%;
    max-height: 100%;
    border-radius: 14px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.9);
    border: 2px solid rgba(255,215,0,0.4);
}
#pr-lightbox-close {
    position: absolute;
    top: 15px;
    left: 15px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255,68,68,0.3);
    border: 1px solid rgba(255,68,68,0.6);
    color: #fff;
    font-size: 18px;
    font-weight: 900;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}
        `;
        document.head.appendChild(s);
    })();

    /* ══════════════════════════════════════════════ */
    /* Parser                                         */
    /* ══════════════════════════════════════════════ */
    function _parseToken(text) {
        if (!text || typeof text !== 'string') return null;
        if (text.indexOf('[paint:') === -1) return null;
        var regex = /\[paint:([^\]]+)\]/g;
        var parts = [];
        var lastIdx = 0, m;
        while ((m = regex.exec(text)) !== null) {
            if (m.index > lastIdx) parts.push({ type: 'text', value: text.substring(lastIdx, m.index) });
            parts.push({ type: 'image', value: m[1].trim() });
            lastIdx = regex.lastIndex;
        }
        if (lastIdx < text.length) parts.push({ type: 'text', value: text.substring(lastIdx) });
        return parts.length ? parts : null;
    }

    /* ══════════════════════════════════════════════ */
    /* Build Card                                     */
    /* ══════════════════════════════════════════════ */
    function _buildCard(url) {
        var card = document.createElement('span');
        card.className = 'pr-card';
        card.setAttribute('data-paint-url', url);

        var thumb = document.createElement('span');
        thumb.className = 'pr-thumb';
        thumb.style.display = 'block';

        var img = document.createElement('img');
        img.src = url;
        img.alt = '🎨 رسمة';
        img.loading = 'lazy';
        img.onerror = function () {
            thumb.innerHTML = '<span style="color:#ff6666;font-size:11px;font-weight:900;padding:20px;">⚠️ فشل تحميل الرسمة</span>';
        };
        thumb.appendChild(img);

        var badge = document.createElement('span');
        badge.className = 'pr-badge';
        badge.textContent = '🎨 رسمة';
        thumb.appendChild(badge);

        var meta = document.createElement('span');
        meta.className = 'pr-meta';
        meta.style.display = 'block';
        meta.textContent = 'اضغط للتكبير';

        card.appendChild(thumb);
        card.appendChild(meta);

        card.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            _openLightbox(url);
        };

        return card;
    }

    /* ══════════════════════════════════════════════ */
    /* Lightbox                                       */
    /* ══════════════════════════════════════════════ */
    function _openLightbox(url) {
        var lb = document.getElementById('pr-lightbox');
        if (!lb) {
            lb = document.createElement('div');
            lb.id = 'pr-lightbox';
            lb.innerHTML =
                '<button id="pr-lightbox-close" type="button">✕</button>' +
                '<img id="pr-lightbox-img" src="" alt="رسمة">';
            document.body.appendChild(lb);

            lb.onclick = function (e) {
                if (e.target === lb || e.target.id === 'pr-lightbox-close') {
                    lb.classList.remove('active');
                }
            };
        }
        var img = document.getElementById('pr-lightbox-img');
        if (img) img.src = url;
        lb.classList.add('active');
    }

    /* ══════════════════════════════════════════════ */
    /* Process Element                                */
    /* ══════════════════════════════════════════════ */
    function _processElement(rootEl) {
        if (!rootEl || rootEl.nodeType !== 1) return;
        if (rootEl.getAttribute && rootEl.getAttribute('data-pr-done') === '1') return;

        // نتجاوز أي عناصر داخل بطاقة موجودة
        var textNodes = [];
        var walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                // تجاهل النصوص داخل بطاقة pr-card
                var p = node.parentNode;
                while (p && p !== rootEl) {
                    if (p.classList && p.classList.contains('pr-card')) return NodeFilter.FILTER_REJECT;
                    p = p.parentNode;
                }
                if (node.nodeValue && node.nodeValue.indexOf('[paint:') !== -1) return NodeFilter.FILTER_ACCEPT;
                return NodeFilter.FILTER_SKIP;
            }
        });

        while (walker.nextNode()) textNodes.push(walker.currentNode);

        if (textNodes.length === 0) {
            if (rootEl.setAttribute) rootEl.setAttribute('data-pr-done', '1');
            return;
        }

        textNodes.forEach(function (textNode) {
            var parts = _parseToken(textNode.nodeValue);
            if (!parts) return;

            var frag = document.createDocumentFragment();
            parts.forEach(function (p) {
                if (p.type === 'text') {
                    if (p.value) frag.appendChild(document.createTextNode(p.value));
                } else if (p.type === 'image') {
                    frag.appendChild(_buildCard(p.value));
                }
            });

            try {
                if (textNode.parentNode) textNode.parentNode.replaceChild(frag, textNode);
            } catch (e) {}
        });

        if (rootEl.setAttribute) rootEl.setAttribute('data-pr-done', '1');
    }

    /* ══════════════════════════════════════════════ */
    /* Scan All                                       */
    /* ══════════════════════════════════════════════ */
    function _scanAll() {
        try {
            // الشات العام
            var pubMessages = document.querySelectorAll('#messages .message:not([data-pr-done="1"])');
            pubMessages.forEach(_processElement);

            // الشات الخاص
            var pcMessages = document.querySelectorAll('#pc-messages .pc-msg:not([data-pr-done="1"])');
            pcMessages.forEach(_processElement);

            // بروفايل (iframe) — لا يعمل مباشرة، يتم عبر chat.js
        } catch (e) {
            console.warn('paint-render scan error:', e);
        }
    }

    /* ══════════════════════════════════════════════ */
    /* Hook displayMessage + displayPrivateMsg         */
    /* ══════════════════════════════════════════════ */
    function _hookDisplay() {
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            var hooked = 0;

            if (typeof window.displayMessage === 'function' && !window.displayMessage.__prWrapped) {
                var orig = window.displayMessage;
                window.displayMessage = function (msg, msgId) {
                    var r = orig.apply(this, arguments);
                    setTimeout(_scanAll, 50);
                    return r;
                };
                window.displayMessage.__prWrapped = true;
                hooked++;
            } else if (window.displayMessage && window.displayMessage.__prWrapped) {
                hooked++;
            }

            if (typeof window.displayPrivateMsg === 'function' && !window.displayPrivateMsg.__prWrapped) {
                var orig2 = window.displayPrivateMsg;
                window.displayPrivateMsg = function (msg, isSent) {
                    var r = orig2.apply(this, arguments);
                    setTimeout(_scanAll, 50);
                    return r;
                };
                window.displayPrivateMsg.__prWrapped = true;
                hooked++;
            } else if (window.displayPrivateMsg && window.displayPrivateMsg.__prWrapped) {
                hooked++;
            }

            if (hooked === 2 || attempts >= 60) {
                clearInterval(t);
                if (hooked === 2) console.log('✅ paint-render: displayMessage + displayPrivateMsg hooked');
            }
        }, 200);
    }

    /* ══════════════════════════════════════════════ */
    /* Observer (احتياطي — للمعالجة الفورية)         */
    /* ══════════════════════════════════════════════ */
    function _installObservers() {
        ['messages', 'pc-messages'].forEach(function (cid) {
            var container = document.getElementById(cid);
            if (!container || container.__prObserved) return;
            container.__prObserved = true;

            new MutationObserver(function (muts) {
                muts.forEach(function (m) {
                    m.addedNodes.forEach(function (node) {
                        if (node.nodeType !== 1) return;
                        if (node.classList && (
                            node.classList.contains('message') ||
                            node.classList.contains('pc-msg')
                        )) {
                            setTimeout(function () { _processElement(node); }, 60);
                        }
                    });
                });
            }).observe(container, { childList: true, subtree: false });
        });
    }

    /* ══════════════════════════════════════════════ */
    /* Scanner Loop                                   */
    /* ══════════════════════════════════════════════ */
    function _startScanner() {
        setInterval(_scanAll, SCAN_INTERVAL_MS);
    }

    /* ══════════════════════════════════════════════ */
    /* Init                                           */
    /* ══════════════════════════════════════════════ */
    function init() {
        _hookDisplay();
        _installObservers();
        _startScanner();

        // فحص أولي متعدد
        setTimeout(_scanAll, 500);
        setTimeout(_scanAll, 1500);
        setTimeout(_scanAll, 3000);
        setTimeout(_installObservers, 3000);

        console.log('🎨 paint-render.js v1: scanner active (interval ' + SCAN_INTERVAL_MS + 'ms)');
    }

    window.PaintRender = {
        scan: _scanAll,
        version: 1
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('🎨 paint-render.js v1 loaded');
})();
