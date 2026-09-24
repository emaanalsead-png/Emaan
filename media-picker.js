// ==============================================
// media-picker.js v8 — إيموجي متعدد
// ==============================================
// ✅ v8:
//   1. القائمة لا تغلق بعد اختيار إيموجي (اختيار متعدد)
//   2. عدّاد الإيموجيات المُضافة (يظهر في الأعلى)
//   3. زر ✅ تم لإغلاق القائمة
//   4. عند الإغلاق: تركيز الإدخال + تحديث الحالة
//   5. باقي المنطق كما v7
// ==============================================

(function () {
    'use strict';
    if (window.__mediaPickerV8) return;
    window.__mediaPickerV8 = true;

    var REPO = 'qamaralsham/qamaralsham';
    var BRANCH = 'main';
    var JSDELIVR_API = 'https://data.jsdelivr.com/v1/package/gh/' + REPO + '@' + BRANCH + '/flat';
    var JSDELIVR_CDN = 'https://cdn.jsdelivr.net/gh/' + REPO + '@' + BRANCH + '/emojis/';
    var IMGBB_KEY = '80fd32c4ef79b5f25fbcf0893547de4f';
    var PAGE_SIZE = 30;
    var CACHE_KEY = 'qamar_emoji_cache_v2';
    var CACHE_TTL = 24 * 60 * 60 * 1000;

    var CACHE = { files: null, urlMap: null, fetchedAt: 0 };
    var currentContext = 'private';
    var currentTab = 'emojis1';
    var _insertedCount = 0;

    try {
        var saved = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        if (saved.files && saved.urlMap && saved.fetchedAt && (Date.now() - saved.fetchedAt) < CACHE_TTL) {
            CACHE.files = saved.files;
            CACHE.urlMap = saved.urlMap;
            CACHE.fetchedAt = saved.fetchedAt;
            console.log('📦 media-picker v8: loaded from cache (' + CACHE.files.length + ' files)');
        }
    } catch (e) {}

    /* ═══ CSS ═══ */
    (function injectCSS() {
        if (document.getElementById('media-picker-css-v8')) return;
        var s = document.createElement('style');
        s.id = 'media-picker-css-v8';
        s.textContent = `
#media-picker-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.88);
    display: none;
    justify-content: center;
    align-items: flex-end;
    z-index: 100000;
    font-family: 'Cairo', sans-serif;
    direction: rtl;
}
#media-picker-overlay.active { display: flex; }
#media-picker-panel {
    background: rgba(15, 15, 25, 0.99);
    border-top: 2px solid #ffd700;
    border-radius: 20px 20px 0 0;
    width: 100%; max-width: 500px;
    height: 60vh; max-height: 60vh;
    display: flex; flex-direction: column; overflow: hidden; position: relative;
}
#media-picker-tabs {
    display: flex;
    border-bottom: 1px solid rgba(255,215,0,0.3);
    background: rgba(0,0,0,0.4);
}
.mp-tab {
    flex: 1; padding: 12px 4px;
    background: none; border: none;
    color: #aaa; font-family: inherit;
    font-size: 11px; font-weight: 900;
    cursor: pointer; border-bottom: 3px solid transparent;
    white-space: nowrap;
}
.mp-tab.active { color: #ffd700; border-bottom-color: #ffd700; }
#media-picker-content {
    flex: 1; overflow-y: auto; padding: 10px;
    display: grid; grid-template-columns: repeat(5, 1fr);
    gap: 6px; align-content: start;
}
@media (max-width: 400px) { #media-picker-content { grid-template-columns: repeat(4, 1fr); } }
.mp-item {
    aspect-ratio: 1;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,215,0,0.15);
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; overflow: hidden; position: relative;
    padding: 4px; width: 100%; height: 100%;
    box-sizing: border-box;
    transition: transform 0.1s, border-color 0.1s;
}
.mp-item:active { transform: scale(0.92); border-color: #ffd700; }
.mp-item.just-picked {
    border-color: #84cc16 !important;
    box-shadow: 0 0 12px rgba(132, 204, 22, 0.6) !important;
}
.mp-item img {
    max-width: 100% !important; max-height: 100% !important;
    width: auto !important; height: auto !important;
    object-fit: contain !important;
    pointer-events: none; display: block;
}
.mp-item .mp-num {
    position: absolute; bottom: 2px; right: 4px;
    font-size: 9px; color: #ffd700; font-weight: 900;
    background: rgba(0,0,0,0.7); border-radius: 4px;
    padding: 1px 4px; pointer-events: none;
}
.mp-upload-tile {
    background: linear-gradient(135deg, #84cc16, #65a30d) !important;
    border: 1px solid #a3e635 !important;
    color: #fff; font-size: 22px; font-weight: 900;
}
.mp-empty {
    grid-column: 1 / -1;
    text-align: center; color: #888;
    padding: 30px 10px; font-size: 13px;
}
.mp-retry {
    grid-column: 1 / -1;
    text-align: center; padding: 20px;
}
.mp-retry button {
    background: #ffd700; color: #000;
    border: none; padding: 10px 24px;
    border-radius: 8px; font-weight: 900;
    font-family: 'Cairo', sans-serif;
    cursor: pointer; font-size: 13px;
}
.mp-custom-del {
    position: absolute; top: 2px; right: 2px;
    width: 18px; height: 18px; border-radius: 50%;
    background: #ef4444; border: 2px solid #050508;
    color: #fff; font-size: 10px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; padding: 0; font-weight: 900; z-index: 5;
}
.mp-close-btn {
    position: absolute; top: 8px; left: 8px;
    width: 32px; height: 32px; border-radius: 50%;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.2);
    color: #fff; cursor: pointer; font-size: 14px;
    display: flex; align-items: center; justify-content: center;
    z-index: 10;
}
.mp-done-btn {
    position: absolute; top: 8px; right: 8px;
    height: 32px; padding: 0 14px;
    border-radius: 16px;
    background: linear-gradient(135deg, #84cc16, #65a30d);
    border: none; color: #fff;
    cursor: pointer; font-size: 12px; font-weight: 900;
    font-family: inherit;
    display: none;
    align-items: center; justify-content: center;
    z-index: 10;
    box-shadow: 0 2px 10px rgba(132, 204, 22, 0.5);
}
.mp-done-btn.show { display: flex; }
.mp-counter {
    position: absolute; top: 12px; left: 50%;
    transform: translateX(-50%);
    background: rgba(255,215,0,0.15);
    border: 1px solid rgba(255,215,0,0.4);
    color: #ffd700;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 11px; font-weight: 900;
    z-index: 9;
    display: none;
    pointer-events: none;
}
.mp-counter.show { display: block; }
.pm-inline-media {
    max-width: 90px; max-height: 90px;
    vertical-align: middle; margin: 2px 4px;
    border-radius: 6px; cursor: pointer;
}
        `;
        document.head.appendChild(s);
    })();

    /* ═══ جلب الإيموجيات من jsDelivr ═══ */
    async function fetchEmojis() {
        try {
            var res = await fetch(JSDELIVR_API + '?t=' + Date.now());
            if (!res.ok) {
                console.warn('⚠️ jsDelivr API error:', res.status);
                return { files: [], error: 'api_error' };
            }
            var data = await res.json();
            if (!data || !Array.isArray(data.files)) return { files: [], error: 'invalid' };

            var emojiFiles = data.files.filter(function (f) {
                if (!f.name) return false;
                if (f.name.indexOf('/emojis/') !== 0) return false;
                var base = f.name.split('/').pop();
                if (!base || base.charAt(0) === '.') return false;
                var ext = (base.split('.').pop() || '').toLowerCase();
                return ['gif', 'webp', 'png', 'jpg', 'jpeg', 'apng', 'svg'].indexOf(ext) !== -1;
            });

            emojiFiles.sort(function (a, b) {
                var na = a.name.match(/\d+/g) || [];
                var nb = b.name.match(/\d+/g) || [];
                for (var i = 0; i < Math.max(na.length, nb.length); i++) {
                    var va = parseInt(na[i] || 0);
                    var vb = parseInt(nb[i] || 0);
                    if (va !== vb) return va - vb;
                }
                return a.name.localeCompare(b.name);
            });

            var names = emojiFiles.map(function (f) {
                return f.name.split('/').pop();
            });

            console.log('📦 media-picker v8: fetched ' + names.length + ' emojis from jsDelivr');
            return { files: names, error: null };
        } catch (e) {
            console.warn('❌ fetch error:', e.message);
            return { files: [], error: 'network' };
        }
    }

    async function ensureCache(force) {
        var now = Date.now();
        if (!force && CACHE.files && CACHE.urlMap && (now - CACHE.fetchedAt) < CACHE_TTL) return true;

        var res = await fetchEmojis();
        if (res.error && res.files.length === 0) {
            if (CACHE.files && CACHE.files.length > 0) {
                console.warn('⚠️ fetch فشل، أستخدم cache قديم');
                return false;
            }
            return false;
        }
        if (res.files.length === 0) {
            return false;
        }

        CACHE.files = res.files;
        CACHE.urlMap = {};
        CACHE.files.forEach(function (name, i) {
            CACHE.urlMap[i + 1] = JSDELIVR_CDN + name;
        });
        CACHE.fetchedAt = now;

        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                files: CACHE.files,
                urlMap: CACHE.urlMap,
                fetchedAt: CACHE.fetchedAt
            }));
        } catch (e) {}

        return true;
    }

    function getUrlByNum(n) {
        return CACHE.urlMap ? CACHE.urlMap[n] : null;
    }

    /* ═══ UI ═══ */
    function buildUI() {
        if (document.getElementById('media-picker-overlay')) return;
        var ov = document.createElement('div');
        ov.id = 'media-picker-overlay';
        ov.innerHTML =
            '<div id="media-picker-panel">' +
                '<button class="mp-close-btn" id="mp-close-x" type="button">✕</button>' +
                '<button class="mp-done-btn" id="mp-done-btn" type="button">✅ تم</button>' +
                '<div class="mp-counter" id="mp-counter">0</div>' +
                '<div id="media-picker-tabs">' +
                    '<button class="mp-tab active" data-tab="emojis1">😀 إيموجي 1</button>' +
                    '<button class="mp-tab" data-tab="emojis2">😎 إيموجي 2</button>' +
                    '<button class="mp-tab" data-tab="emojis3">🤩 إيموجي 3</button>' +
                    '<button class="mp-tab" data-tab="custom">⭐ خاصتي</button>' +
                '</div>' +
                '<div id="media-picker-content"></div>' +
            '</div>';
        document.body.appendChild(ov);
        ov.addEventListener('click', function (e) { if (e.target === ov) MediaPicker.close(); });

        ov.querySelector('#mp-close-x').onclick = function () { MediaPicker.close(); };
        ov.querySelector('#mp-done-btn').onclick = function () { MediaPicker.close(); };

        ov.querySelectorAll('.mp-tab').forEach(function (t) {
            t.onclick = function () {
                ov.querySelectorAll('.mp-tab').forEach(function (x) { x.classList.remove('active'); });
                t.classList.add('active');
                currentTab = t.getAttribute('data-tab');
                renderTab();
            };
        });
    }

    function _updateCounter() {
        var c = document.getElementById('mp-counter');
        var d = document.getElementById('mp-done-btn');
        if (!c || !d) return;
        if (_insertedCount > 0) {
            c.textContent = '✅ ' + _insertedCount + ' رمز';
            c.classList.add('show');
            d.classList.add('show');
        } else {
            c.classList.remove('show');
            d.classList.remove('show');
        }
    }

    function getCustomMedia() {
        try {
            var v = JSON.parse(localStorage.getItem('qamar_custom_media') || '[]');
            return Array.isArray(v) ? v : [];
        } catch (e) { return []; }
    }
    function setCustomMedia(list) {
        try { localStorage.setItem('qamar_custom_media', JSON.stringify(list)); } catch (e) {}
    }

    function renderTab() {
        var c = document.getElementById('media-picker-content');
        if (!c) return;
        c.innerHTML = '';
        if (currentTab === 'custom') { renderCustomTab(c); return; }

        var all = CACHE.files || [];
        if (all.length === 0) {
            var err = document.createElement('div');
            err.className = 'mp-retry';
            err.innerHTML = '<div style="color:#ff6666;font-size:14px;margin-bottom:10px;">⚠️ تعذّر تحميل الإيموجيات</div>' +
                '<div style="color:#888;font-size:11px;margin-bottom:14px;">تأكد من الاتصال بالإنترنت</div>';
            var btn = document.createElement('button');
            btn.textContent = '🔄 إعادة المحاولة';
            btn.onclick = async function () {
                btn.textContent = '⏳ جاري التحميل...';
                var ok = await ensureCache(true);
                if (ok) renderTab();
                else btn.textContent = '❌ فشل — حاول مجدداً';
            };
            err.appendChild(btn);
            c.appendChild(err);
            return;
        }

        var startNum = 1, endNum = all.length;
        if (currentTab === 'emojis1') { startNum = 1; endNum = Math.min(PAGE_SIZE, all.length); }
        else if (currentTab === 'emojis2') { startNum = PAGE_SIZE + 1; endNum = Math.min(PAGE_SIZE * 2, all.length); }
        else if (currentTab === 'emojis3') { startNum = PAGE_SIZE * 2 + 1; endNum = all.length; }

        if (startNum > all.length) {
            c.innerHTML = '<div class="mp-empty">لا توجد ملفات في هذا القسم.</div>';
            return;
        }

        for (var i = startNum; i <= endNum; i++) {
            (function (num) {
                var url = getUrlByNum(num);
                if (!url) return;
                var d = document.createElement('div');
                d.className = 'mp-item';
                var img = document.createElement('img');
                img.src = url;
                img.loading = 'lazy';
                img.onerror = function () { d.style.opacity = '0.3'; };
                d.appendChild(img);
                var nb = document.createElement('span');
                nb.className = 'mp-num';
                nb.textContent = num;
                d.appendChild(nb);
                d.onclick = function () { insertEmoji(num, d); };
                c.appendChild(d);
            })(i);
        }
    }

    function renderCustomTab(c) {
        c.innerHTML = '';
        var uploadTile = document.createElement('div');
        uploadTile.className = 'mp-item mp-upload-tile';
        uploadTile.innerHTML = '<i class="fas fa-plus"></i>';
        uploadTile.onclick = pickCustomFiles;
        c.appendChild(uploadTile);

        var list = getCustomMedia();
        if (!list.length) {
            var empty = document.createElement('div');
            empty.className = 'mp-empty';
            empty.textContent = 'اضغط + لرفع صور من جهازك';
            c.appendChild(empty);
            return;
        }
        list.forEach(function (item, idx) {
            var wrap = document.createElement('div');
            wrap.className = 'mp-item';
            var img = document.createElement('img');
            img.src = item.url;
            img.loading = 'lazy';
            wrap.appendChild(img);
            var del = document.createElement('button');
            del.className = 'mp-custom-del';
            del.textContent = '×';
            del.onclick = function (e) {
                e.stopPropagation();
                if (!confirm('حذف؟')) return;
                var arr = getCustomMedia();
                arr.splice(idx, 1);
                setCustomMedia(arr);
                renderCustomTab(c);
            };
            wrap.appendChild(del);
            wrap.onclick = function () { insertCustom(item.url, wrap); };
            c.appendChild(wrap);
        });
    }

    function pickCustomFiles() {
        var fi = document.createElement('input');
        fi.type = 'file';
        fi.accept = 'image/*';
        fi.multiple = true;
        fi.onchange = async function () {
            var files = Array.from(this.files || []);
            if (!files.length) return;
            if (typeof showToast === 'function') showToast('fa-spinner', '⏳ جاري رفع ' + files.length + '...');
            var arr = getCustomMedia();
            var ok = 0;
            for (var i = 0; i < files.length; i++) {
                var f = files[i];
                if (f.size / (1024 * 1024) > 5) continue;
                try {
                    var fd = new FormData();
                    fd.append('key', IMGBB_KEY);
                    fd.append('image', f);
                    var r = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: fd });
                    var d = await r.json();
                    if (d.success && d.data && d.data.url) {
                        arr.unshift({ url: d.data.url, time: Date.now() });
                        ok++;
                    }
                } catch (e) {}
            }
            setCustomMedia(arr);
            if (typeof showToast === 'function') showToast('fa-check', '✅ تم رفع ' + ok);
            renderCustomTab(document.getElementById('media-picker-content'));
        };
        fi.click();
    }

    /* ⭐ v8: لا تغلق — أضف فقط + وميض */
    function insertEmoji(num, tileEl) {
        insertText('[e:' + num + ']', tileEl);
    }
    function insertCustom(url, tileEl) {
        insertText('[cu:' + url + ']', tileEl);
    }

    function insertText(token, tileEl) {
        var targetId = (currentContext === 'private') ? 'pc-input' : 'message-input';
        var inp = document.getElementById(targetId);
        if (inp) {
            var cur = inp.value;
            inp.value = (cur ? cur + ' ' : '') + token + ' ';
        }
        /* وميض أخضر على الرمز */
        if (tileEl) {
            tileEl.classList.add('just-picked');
            setTimeout(function () { tileEl.classList.remove('just-picked'); }, 400);
        }
        _insertedCount++;
        _updateCounter();
        /* ⭐ v8: لا نغلق — ولا نركز */
    }

    function parseTokens(text) {
        if (!text || typeof text !== 'string') return null;
        if (text.indexOf('[e:') === -1 && text.indexOf('[cu:') === -1 && text.indexOf('[img:') === -1) return null;
        var regex = /\[(e|cu|img):([^\]]+)\]/g;
        var parts = [];
        var lastIdx = 0, match;
        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIdx) parts.push({ type: 'text', value: text.substring(lastIdx, match.index) });
            var kind = match[1];
            var val = match[2];
            var url = null;
            if (kind === 'e') { url = getUrlByNum(parseInt(val)); }
            else if (kind === 'cu') { url = val; }
            else if (kind === 'img') { url = val; }
            if (url) parts.push({ type: 'image', value: url });
            else parts.push({ type: 'text', value: match[0] });
            lastIdx = regex.lastIndex;
        }
        if (lastIdx < text.length) parts.push({ type: 'text', value: text.substring(lastIdx) });
        return parts.length ? parts : null;
    }

    function processMsgMedia(msgEl) {
        if (!CACHE.urlMap) return;
        var walker = document.createTreeWalker(msgEl, NodeFilter.SHOW_TEXT);
        var toProcess = [];
        while (walker.nextNode()) {
            var val = walker.currentNode.nodeValue;
            if (val.indexOf('[e:') !== -1 || val.indexOf('[cu:') !== -1 || val.indexOf('[img:') !== -1) {
                toProcess.push(walker.currentNode);
            }
        }
        toProcess.forEach(function (textNode) {
            var parts = parseTokens(textNode.nodeValue);
            if (!parts) return;
            var frag = document.createDocumentFragment();
            parts.forEach(function (p) {
                if (p.type === 'text') {
                    frag.appendChild(document.createTextNode(p.value));
                } else {
                    var img = document.createElement('img');
                    img.src = p.value;
                    img.className = 'pm-inline-media';
                    img.onclick = function () { window.open(p.value, '_blank'); };
                    frag.appendChild(img);
                }
            });
            if (textNode.parentNode) textNode.parentNode.replaceChild(frag, textNode);
        });
    }

    async function processAllMessages() {
        await ensureCache();
        document.querySelectorAll('.pc-msg').forEach(processMsgMedia);
        document.querySelectorAll('#messages .message').forEach(processMsgMedia);
    }

    function installObserver() {
        var pc = document.getElementById('pc-messages');
        var pub = document.getElementById('messages');
        if (!pc && !pub) { setTimeout(installObserver, 1500); return; }

        if (pc) {
            var obs1 = new MutationObserver(function (muts) {
                muts.forEach(function (m) {
                    m.addedNodes.forEach(function (node) {
                        if (node.nodeType === 1 && node.classList.contains('pc-msg')) {
                            if (CACHE.urlMap) processMsgMedia(node);
                            else ensureCache().then(function () { processMsgMedia(node); });
                        }
                    });
                });
            });
            obs1.observe(pc, { childList: true });
        }

        if (pub) {
            var obs2 = new MutationObserver(function (muts) {
                muts.forEach(function (m) {
                    m.addedNodes.forEach(function (node) {
                        if (node.nodeType === 1 && node.classList.contains('message')) {
                            if (CACHE.urlMap) processMsgMedia(node);
                            else ensureCache().then(function () { processMsgMedia(node); });
                        }
                    });
                });
            });
            obs2.observe(pub, { childList: true });
        }

        ensureCache().then(function () {
            document.querySelectorAll('.pc-msg, #messages .message').forEach(processMsgMedia);
        });
    }

    window.pmInsertEmoji = function () { MediaPicker.open('private'); };
    window.insertEmoji = function () { MediaPicker.open('general'); };

    window.MediaPicker = {
        open: async function (context) {
            currentContext = context || 'private';
            _insertedCount = 0;
            buildUI();
            _updateCounter();
            document.getElementById('media-picker-overlay').classList.add('active');
            var c = document.getElementById('media-picker-content');
            if (c) c.innerHTML = '<div class="mp-empty">⏳ جاري التحميل...</div>';
            await ensureCache();
            renderTab();
        },
        close: function () {
            var ov = document.getElementById('media-picker-overlay');
            if (ov) ov.classList.remove('active');
            /* ⭐ v8: ركّز على الإدخال بعد الإغلاق */
            var hadInsertions = _insertedCount > 0;
            _insertedCount = 0;
            _updateCounter();
            if (hadInsertions) {
                var targetId = (currentContext === 'private') ? 'pc-input' : 'message-input';
                var inp = document.getElementById(targetId);
                if (inp) {
                    setTimeout(function () {
                        try { inp.focus(); } catch (e) {}
                    }, 100);
                }
            }
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installObserver);
    } else {
        installObserver();
    }

    console.log('✅ media-picker.js v8 loaded — multi-select mode');
})();
