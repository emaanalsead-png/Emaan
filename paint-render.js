// ==============================================
// paint-render.js v2 — عرض [paint:URL] شفاف
// ==============================================
// ✅ v2 (فوق v1):
//   1. إزالة badge "رسمة"
//   2. إزالة "اضغط للتكبير"
//   3. إزالة الخلفية checkerboard
//   4. الصورة شفافة تماماً — يظهر الشات وراها
// ==============================================

(function () {
    'use strict';
    if (window.__paintRenderV2) return;
    window.__paintRenderV2 = true;

    var SCAN_INTERVAL_MS = 800;

    /* ══════════════════════════════════════════════ */
    /* CSS — بدون أي زخرفة                            */
    /* ══════════════════════════════════════════════ */
    (function injectCSS() {
        // نحذف CSS القديم
        var old = document.getElementById('paint-render-css');
        if (old) old.remove();

        if (document.getElementById('paint-render-css-v2')) return;
        var s = document.createElement('style');
        s.id = 'paint-render-css-v2';
        s.textContent = `
/* بطاقة الرسمة — شفافة تماماً */
.pr-card {
    display: inline-block;
    max-width: 260px;
    margin-top: 4px;
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    text-decoration: none;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    vertical-align: middle;
    transition: transform 0.15s;
}
.pr-card:hover {
    transform: translateY(-2px);
}
.pr-card:active { transform: scale(0.98); }
.pr-thumb {
    width: 100%;
    background: transparent !important;
    background-image: none !important;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    box-sizing: border-box;
}
.pr-thumb img {
    max-width: 100%;
    max-height: 260px;
    display: block;
    border-radius: 8px;
    background: transparent !important;
    filter: drop-shadow(0 4px 12px rgba(0,0,0,0.5));
}
/* إزالة badge و meta */
.pr-badge, .pr-meta { display: none !important; }

/* Lightbox — لسه موجود */
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
    /* Build Card — بدون badge ولا meta               */
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
        img.alt = '';
        img.loading = 'lazy';
        img.onerror = function () {
            thumb.innerHTML = '<span style="color:#ff6666;font-size:11px;font-weight:900;padding:8px;">⚠️ فشل التحميل</span>';
        };
        thumb.appendChild(img);

        card.appendChild(thumb);

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

        var textNodes = [];
        var walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
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
            var pubMessages = document.querySelectorAll('#messages .message:not([data-pr-done="1"])');
            pubMessages.forEach(_processElement);
            var pcMessages = document.querySelectorAll('#pc-messages .pc-msg:not([data-pr-done="1"])');
            pcMessages.forEach(_processElement);
        } catch (e) {
            console.warn('paint-render scan error:', e);
        }
    }

    /* ══════════════════════════════════════════════ */
    /* Hooks                                          */
    /* ══════════════════════════════════════════════ */
    function _hookDisplay() {
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            var hooked = 0;

            if (typeof window.displayMessage === 'function' && !window.displayMessage.__prV2Wrapped) {
                var orig = window.displayMessage;
                window.displayMessage = function (msg, msgId) {
                    var r = orig.apply(this, arguments);
                    setTimeout(_scanAll, 50);
                    return r;
                };
                window.displayMessage.__prV2Wrapped = true;
                hooked++;
            } else if (window.displayMessage && window.displayMessage.__prV2Wrapped) {
                hooked++;
            }

            if (typeof window.displayPrivateMsg === 'function' && !window.displayPrivateMsg.__prV2Wrapped) {
                var orig2 = window.displayPrivateMsg;
                window.displayPrivateMsg = function (msg, isSent) {
                    var r = orig2.apply(this, arguments);
                    setTimeout(_scanAll, 50);
                    return r;
                };
                window.displayPrivateMsg.__prV2Wrapped = true;
                hooked++;
            } else if (window.displayPrivateMsg && window.displayPrivateMsg.__prV2Wrapped) {
                hooked++;
            }

            if (hooked === 2 || attempts >= 60) {
                clearInterval(t);
                if (hooked === 2) console.log('✅ paint-render v2: hooked');
            }
        }, 200);
    }

    function _installObservers() {
        ['messages', 'pc-messages'].forEach(function (cid) {
            var container = document.getElementById(cid);
            if (!container || container.__prV2Observed) return;
            container.__prV2Observed = true;

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
    /* Init                                           */
    /* ══════════════════════════════════════════════ */
    function init() {
        _hookDisplay();
        _installObservers();
        setInterval(_scanAll, SCAN_INTERVAL_MS);

        setTimeout(_scanAll, 500);
        setTimeout(_scanAll, 1500);
        setTimeout(_scanAll, 3000);
        setTimeout(_installObservers, 3000);

        console.log('🎨 paint-render.js v2: transparent + no badge');
    }

    window.PaintRender = {
        scan: _scanAll,
        version: 2
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('🎨 paint-render.js v2 loaded');
})();
