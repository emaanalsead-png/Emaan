// ==============================================
// youtube-search.js v2 (TEST) — fallback محسّن
// ==============================================
// ✅ v2 (فوق v1):
//   1. مصادر إضافية (Piped + Invidious)
//   2. Fallback ذكي: زر "افتح في يوتيوب" عند فشل APIs
//   3. دعم كامل للرابط المباشر
//   4. رسائل أوضح
//   5. زر "افتح YouTube" دائماً ظاهر
// ✅ v1 (محفوظ):
//   - بحث بدون API key
//   - نافذة مصغرة draggable
//   - paste detection
// ==============================================

(function () {
    'use strict';
    if (window.__youtubeSearchV2) return;
    window.__youtubeSearchV2 = true;

    /* ══════════════════════════════════════════════ */
    /* Config                                         */
    /* ══════════════════════════════════════════════ */
    var PIPED_APIS = [
        'https://pipedapi.kavin.rocks',
        'https://pipedapi.adminforge.de',
        'https://pipedapi.reallyaweso.me',
        'https://api.piped.yt',
        'https://pipedapi.syncpundit.io',
        'https://piped-api.lunar.icu'
    ];
    var INVIDIOUS_APIS = [
        'https://invidious.nerdvpn.de',
        'https://inv.nadeko.net',
        'https://yewtu.be',
        'https://invidious.privacyredirect.com',
        'https://iv.melmac.space',
        'https://invidious.f5.si'
    ];
    var CACHE_TTL_MS = 5 * 60 * 1000;
    var MAX_RESULTS = 24;
    var SEARCH_TIMEOUT_MS = 5000;

    var YT = {
        ctx: 'general',
        cache: {},
        lastQuery: '',
        currentResults: [],
        loading: false,
        openPlayer: null,
        _processed: new WeakSet()
    };

    /* ══════════════════════════════════════════════ */
    /* Helpers                                        */
    /* ══════════════════════════════════════════════ */
    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    }

    function extractYouTubeId(input) {
        if (!input) return null;
        input = String(input).trim();
        if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
        var patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/|youtube-nocookie\.com\/embed\/)([a-zA-Z0-9_-]{11})/i,
            /[?&]v=([a-zA-Z0-9_-]{11})/i
        ];
        for (var i = 0; i < patterns.length; i++) {
            var m = input.match(patterns[i]);
            if (m) return m[1];
        }
        return null;
    }

    function thumbUrl(id, quality) {
        quality = quality || 'hq';
        var map = { hq: 'hqdefault', mq: 'mqdefault', sd: 'sddefault', max: 'maxresdefault' };
        return 'https://i.ytimg.com/vi/' + id + '/' + (map[quality] || 'hqdefault') + '.jpg';
    }

    function fmtDuration(sec) {
        if (!sec || sec <= 0) return '';
        var h = Math.floor(sec / 3600);
        var m = Math.floor((sec % 3600) / 60);
        var s = sec % 60;
        if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
        return m + ':' + String(s).padStart(2, '0');
    }

    function fmtViews(n) {
        if (!n || n <= 0) return '';
        if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
        if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
        return String(n);
    }

    function toast(icon, msg) {
        if (typeof showToast === 'function') showToast(icon, msg);
        else console.log('[YouTube]', msg);
    }

    function openYouTubeExternal(query) {
        var url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
        window.open(url, '_blank');
    }

    /* ══════════════════════════════════════════════ */
    /* CSS                                            */
    /* ══════════════════════════════════════════════ */
    (function injectCSS() {
        if (document.getElementById('yt-search-css-v2')) return;
        var s = document.createElement('style');
        s.id = 'yt-search-css-v2';
        s.textContent = `
#yt-search-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.92);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    z-index: 1000010;
    display: none;
    justify-content: center;
    align-items: center;
    padding: 12px;
    direction: rtl;
    font-family: Cairo, sans-serif;
}
#yt-search-overlay.active { display: flex; }

#yt-search-box {
    background: #0a0616;
    border: 2px solid #ff0000;
    border-radius: 18px;
    width: 100%;
    max-width: 560px;
    height: 88vh;
    max-height: 720px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.9), 0 0 40px rgba(255,0,0,0.35);
}

#yt-search-header {
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255,0,0,0.3);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: linear-gradient(135deg, rgba(255,0,0,0.15), rgba(0,0,0,0.4));
    flex-shrink: 0;
}
#yt-search-header h3 {
    color: #ff6666;
    margin: 0;
    font-size: 15px;
    font-weight: 900;
    display: flex;
    align-items: center;
    gap: 8px;
}
#yt-search-close {
    background: rgba(255,68,68,0.2);
    border: 1px solid rgba(255,68,68,0.5);
    color: #ff7777;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 14px;
    font-weight: 900;
    padding: 0;
}

#yt-search-bar-wrap {
    padding: 12px;
    border-bottom: 1px solid rgba(255,0,0,0.2);
    display: flex;
    gap: 8px;
    flex-shrink: 0;
}
#yt-search-input {
    flex: 1;
    padding: 12px 16px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,0,0,0.4);
    border-radius: 12px;
    color: #fff;
    font-family: inherit;
    font-size: 14px;
    outline: none;
    text-align: right;
    box-sizing: border-box;
    min-width: 0;
}
#yt-search-input:focus { border-color: #ff0000; }
#yt-search-btn {
    padding: 0 20px;
    background: #ff0000;
    color: #fff;
    border: none;
    border-radius: 12px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 900;
    cursor: pointer;
    flex-shrink: 0;
}
#yt-search-btn:disabled { opacity: 0.5; cursor: wait; }

/* ⭐ v2: شريط الأدوات الجانبية */
#yt-quick-actions {
    padding: 8px 12px;
    border-bottom: 1px solid rgba(255,0,0,0.15);
    display: flex;
    gap: 6px;
    flex-shrink: 0;
    flex-wrap: wrap;
}
.yt-quick-btn {
    flex: 1;
    min-width: 100px;
    padding: 8px 12px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,0,0,0.3);
    border-radius: 8px;
    color: #fff;
    font-family: inherit;
    font-size: 11px;
    font-weight: 900;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    transition: all 0.15s;
}
.yt-quick-btn:hover {
    background: rgba(255,0,0,0.15);
    border-color: #ff0000;
}
.yt-quick-btn:active { transform: scale(0.96); }

#yt-search-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,0,0,0.4) transparent;
}
#yt-search-body::-webkit-scrollbar { width: 5px; }
#yt-search-body::-webkit-scrollbar-thumb {
    background: rgba(255,0,0,0.4);
    border-radius: 5px;
}

.yt-res-item {
    display: flex;
    gap: 10px;
    padding: 8px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,0,0,0.15);
    border-radius: 10px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.15s;
}
.yt-res-item:hover {
    background: rgba(255,0,0,0.1);
    border-color: rgba(255,0,0,0.4);
}
.yt-res-item:active { transform: scale(0.99); }

.yt-res-thumb {
    width: 130px;
    height: 73px;
    border-radius: 8px;
    overflow: hidden;
    position: relative;
    flex-shrink: 0;
    background: #000;
}
.yt-res-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}
.yt-res-duration {
    position: absolute;
    bottom: 3px;
    right: 3px;
    background: rgba(0,0,0,0.85);
    color: #fff;
    font-size: 9px;
    font-weight: 900;
    padding: 1px 5px;
    border-radius: 4px;
}
.yt-res-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 3px;
}
.yt-res-title {
    color: #fff;
    font-weight: 900;
    font-size: 12px;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
}
.yt-res-channel {
    color: #ccc;
    font-size: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.yt-res-meta {
    color: #888;
    font-size: 9px;
    display: flex;
    gap: 8px;
}

.yt-empty {
    text-align: center;
    color: #666;
    padding: 40px 20px;
    font-size: 13px;
}
.yt-loading {
    text-align: center;
    color: #ff6666;
    padding: 30px;
    font-size: 13px;
}
.yt-error {
    text-align: center;
    color: #ff6666;
    padding: 20px;
    font-size: 12px;
    background: rgba(255,68,68,0.1);
    border-radius: 10px;
    line-height: 1.6;
}

/* ⭐ v2: fallback card */
.yt-fallback {
    text-align: center;
    padding: 24px 16px;
    background: linear-gradient(135deg, rgba(255,0,0,0.1), rgba(0,0,0,0.4));
    border: 1px dashed rgba(255,0,0,0.5);
    border-radius: 14px;
    margin: 10px 0;
}
.yt-fallback-icon {
    font-size: 48px;
    margin-bottom: 12px;
    filter: drop-shadow(0 0 15px rgba(255,0,0,0.6));
}
.yt-fallback-title {
    color: #ff6666;
    font-size: 15px;
    font-weight: 900;
    margin-bottom: 8px;
}
.yt-fallback-desc {
    color: #aaa;
    font-size: 12px;
    line-height: 1.6;
    margin-bottom: 16px;
}
.yt-fallback-btn {
    padding: 12px 24px;
    background: #ff0000;
    color: #fff;
    border: none;
    border-radius: 10px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 900;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 15px rgba(255,0,0,0.4);
}
.yt-fallback-btn:active { transform: scale(0.96); }

/* ═══ Chat card [yt:ID] ═══ */
.yt-msg-card {
    display: block;
    max-width: 320px;
    margin-top: 6px;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid rgba(255,0,0,0.4);
    background: #000;
    cursor: pointer;
    position: relative;
    transition: all 0.15s;
    text-decoration: none;
}
.yt-msg-card:hover {
    border-color: #ff0000;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(255,0,0,0.35);
}
.yt-msg-card:active { transform: scale(0.98); }

.yt-msg-thumb {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #111;
    overflow: hidden;
}
.yt-msg-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}
.yt-msg-play {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
}
.yt-msg-play svg {
    width: 56px;
    height: 56px;
    filter: drop-shadow(0 3px 10px rgba(0,0,0,0.8));
    opacity: 0.92;
    transition: opacity 0.15s, transform 0.15s;
}
.yt-msg-card:hover .yt-msg-play svg {
    opacity: 1;
    transform: scale(1.1);
}
.yt-msg-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    background: #ff0000;
    color: #fff;
    font-size: 10px;
    font-weight: 900;
    padding: 3px 8px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
}
.yt-msg-meta {
    padding: 8px 10px;
    background: linear-gradient(180deg, rgba(20,10,15,0.98), rgba(15,8,12,1));
}
.yt-msg-title {
    color: #fff;
    font-size: 12px;
    font-weight: 900;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
}
.yt-msg-channel {
    color: #999;
    font-size: 10px;
    margin-top: 3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* ═══ Mini Player ═══ */
#yt-mini-player {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 1000005;
    display: none;
    flex-direction: column;
    width: 340px;
    max-width: calc(100vw - 24px);
    background: #0a0a15;
    border: 2px solid #ff0000;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.95), 0 0 40px rgba(255,0,0,0.4);
    direction: rtl;
    font-family: Cairo, sans-serif;
    animation: ytMiniIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
#yt-mini-player.active { display: flex; }
#yt-mini-player.minimized { width: 200px; }
@keyframes ytMiniIn {
    0% { transform: translateY(40px) scale(0.85); opacity: 0; }
    100% { transform: translateY(0) scale(1); opacity: 1; }
}
#yt-mini-header {
    padding: 8px 10px;
    background: linear-gradient(135deg, rgba(255,0,0,0.2), rgba(0,0,0,0.4));
    border-bottom: 1px solid rgba(255,0,0,0.3);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    cursor: move;
    user-select: none;
}
#yt-mini-title {
    color: #fff;
    font-size: 11px;
    font-weight: 900;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.yt-mini-btn {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.2);
    color: #fff;
    font-size: 11px;
    font-weight: 900;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: inherit;
}
.yt-mini-btn.close { background: rgba(255,68,68,0.3); border-color: rgba(255,68,68,0.6); }
#yt-mini-body {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #000;
}
#yt-mini-player.minimized #yt-mini-body { display: none; }
#yt-mini-body iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
}
#yt-mini-ytlink {
    padding: 6px 10px;
    background: rgba(0,0,0,0.5);
    color: #999;
    font-size: 10px;
    text-align: center;
    cursor: pointer;
    border-top: 1px solid rgba(255,0,0,0.2);
}
#yt-mini-ytlink:hover { color: #ff6666; background: rgba(255,0,0,0.1); }
#yt-mini-player.minimized #yt-mini-ytlink { display: none; }

@media (max-width: 480px) {
    #yt-mini-player { bottom: 12px; right: 12px; width: 300px; }
}
        `;
        document.head.appendChild(s);
    })();

    /* ══════════════════════════════════════════════ */
    /* Search API                                     */
    /* ══════════════════════════════════════════════ */
    async function searchYouTubeAPI(query) {
        if (!query || !query.trim()) return [];
        var q = query.trim();

        var cacheKey = 'q_' + q.toLowerCase();
        var cached = YT.cache[cacheKey];
        if (cached && (Date.now() - cached.at) < CACHE_TTL_MS) {
            return cached.results;
        }

        // جرّب Piped
        for (var i = 0; i < PIPED_APIS.length; i++) {
            try {
                var res = await _searchPiped(PIPED_APIS[i], q);
                if (res && res.length > 0) {
                    YT.cache[cacheKey] = { results: res, at: Date.now() };
                    return res;
                }
            } catch (e) {}
        }

        // جرّب Invidious
        for (var j = 0; j < INVIDIOUS_APIS.length; j++) {
            try {
                var res2 = await _searchInvidious(INVIDIOUS_APIS[j], q);
                if (res2 && res2.length > 0) {
                    YT.cache[cacheKey] = { results: res2, at: Date.now() };
                    return res2;
                }
            } catch (e) {}
        }

        throw new Error('fallback');
    }

    async function _searchPiped(api, query) {
        var url = api + '/search?q=' + encodeURIComponent(query) + '&filter=videos';
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, SEARCH_TIMEOUT_MS);
        try {
            var res = await fetch(url, { signal: controller.signal });
            clearTimeout(timer);
            if (!res.ok) return null;
            var data = await res.json();
            if (!data.items || !Array.isArray(data.items)) return null;
            var out = [];
            for (var i = 0; i < data.items.length && out.length < MAX_RESULTS; i++) {
                var it = data.items[i];
                if (!it.url) continue;
                var vid = it.url.replace('/watch?v=', '').trim();
                if (!vid || vid.length !== 11) continue;
                out.push({
                    id: vid,
                    title: it.title || '—',
                    channel: it.uploaderName || '',
                    duration: parseInt(it.duration) || 0,
                    views: parseInt(it.views) || 0,
                    thumbnail: thumbUrl(vid, 'hq')
                });
            }
            return out;
        } catch (e) {
            clearTimeout(timer);
            return null;
        }
    }

    async function _searchInvidious(api, query) {
        var url = api + '/api/v1/search?q=' + encodeURIComponent(query) + '&type=video';
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, SEARCH_TIMEOUT_MS);
        try {
            var res = await fetch(url, { signal: controller.signal });
            clearTimeout(timer);
            if (!res.ok) return null;
            var data = await res.json();
            if (!Array.isArray(data)) return null;
            var out = [];
            for (var i = 0; i < data.length && out.length < MAX_RESULTS; i++) {
                var it = data[i];
                if (!it.videoId) continue;
                out.push({
                    id: it.videoId,
                    title: it.title || '—',
                    channel: it.author || '',
                    duration: parseInt(it.lengthSeconds) || 0,
                    views: parseInt(it.viewCount) || 0,
                    thumbnail: thumbUrl(it.videoId, 'hq')
                });
            }
            return out;
        } catch (e) {
            clearTimeout(timer);
            return null;
        }
    }

    /* ══════════════════════════════════════════════ */
    /* UI                                             */
    /* ══════════════════════════════════════════════ */
    function ensureDialog() {
        var ov = document.getElementById('yt-search-overlay');
        if (ov) return ov;

        ov = document.createElement('div');
        ov.id = 'yt-search-overlay';
        ov.innerHTML =
            '<div id="yt-search-box">' +
                '<div id="yt-search-header">' +
                    '<h3>▶️ يوتيوب</h3>' +
                    '<button id="yt-search-close" type="button">✕</button>' +
                '</div>' +
                '<div id="yt-search-bar-wrap">' +
                    '<input type="text" id="yt-search-input" placeholder="🔍 ابحث أو الصق رابط..." autocomplete="off">' +
                    '<button id="yt-search-btn" type="button">🔎</button>' +
                '</div>' +
                '<div id="yt-quick-actions">' +
                    '<button class="yt-quick-btn" id="yt-open-external" type="button">🌐 افتح في يوتيوب</button>' +
                '</div>' +
                '<div id="yt-search-body">' +
                    '<div class="yt-empty">اكتب كلمة أو الصق رابط YouTube</div>' +
                '</div>' +
            '</div>';

        document.body.appendChild(ov);

        ov.querySelector('#yt-search-close').onclick = closeDialog;
        ov.addEventListener('click', function (e) { if (e.target === ov) closeDialog(); });

        var inp = ov.querySelector('#yt-search-input');
        var btn = ov.querySelector('#yt-search-btn');

        inp.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
        });
        btn.onclick = doSearch;

        ov.querySelector('#yt-open-external').onclick = function () {
            var q = inp.value.trim();
            if (!q) { toast('fa-info', 'اكتب شي أولاً'); return; }
            // لو رابط → افتح الفيديو، لو نص → بحث
            var vid = extractYouTubeId(q);
            if (vid) {
                window.open('https://www.youtube.com/watch?v=' + vid, '_blank');
            } else {
                openYouTubeExternal(q);
            }
        };

        inp.addEventListener('paste', function (e) {
            var paste = (e.clipboardData || window.clipboardData).getData('text');
            var vid = extractYouTubeId(paste);
            if (vid) {
                e.preventDefault();
                inp.value = paste;
                setTimeout(function () { _insertAndClose(vid); }, 100);
            }
        });

        async function doSearch() {
            var q = inp.value.trim();
            if (!q) return;

            var vid = extractYouTubeId(q);
            if (vid) {
                _insertAndClose(vid);
                return;
            }

            await _doSearchAndRender(q);
        }

        return ov;
    }

    function openDialog(ctx) {
        YT.ctx = ctx || 'general';
        var ov = ensureDialog();
        ov.classList.add('active');
        setTimeout(function () {
            var inp = document.getElementById('yt-search-input');
            if (inp) inp.focus();
        }, 150);
    }

    function closeDialog() {
        var ov = document.getElementById('yt-search-overlay');
        if (ov) ov.classList.remove('active');
    }

    async function _doSearchAndRender(query) {
        YT.loading = true;
        YT.lastQuery = query;
        var body = document.getElementById('yt-search-body');
        if (!body) return;

        body.innerHTML = '<div class="yt-loading">⏳ جاري البحث...</div>';
        var btn = document.getElementById('yt-search-btn');
        if (btn) btn.disabled = true;

        try {
            var results = await searchYouTubeAPI(query);
            YT.currentResults = results;
            renderResults(results);
        } catch (e) {
            // ⭐ v2: fallback
            _renderFallback(query);
        } finally {
            YT.loading = false;
            if (btn) btn.disabled = false;
        }
    }

    /* ⭐ v2: fallback */
    function _renderFallback(query) {
        var body = document.getElementById('yt-search-body');
        if (!body) return;

        body.innerHTML =
            '<div class="yt-fallback">' +
                '<div class="yt-fallback-icon">📺</div>' +
                '<div class="yt-fallback-title">البحث الداخلي غير متاح</div>' +
                '<div class="yt-fallback-desc">' +
                    'تعذّر الاتصال بخدمات البحث المجانية.<br>' +
                    'يمكنك فتح يوتيوب مباشرة في تبويب جديد.' +
                '</div>' +
                '<button class="yt-fallback-btn" id="yt-fallback-open" type="button">' +
                    '🌐 افتح يوتيوب في تبويب جديد' +
                '</button>' +
            '</div>';

        var btn = document.getElementById('yt-fallback-open');
        if (btn) {
            btn.onclick = function () {
                openYouTubeExternal(query);
            };
        }
    }

    function renderResults(results) {
        var body = document.getElementById('yt-search-body');
        if (!body) return;

        if (!results || !results.length) {
            body.innerHTML = '<div class="yt-empty">لا نتائج 😕</div>';
            return;
        }

        body.innerHTML = '';
        results.forEach(function (r) {
            var el = document.createElement('div');
            el.className = 'yt-res-item';

            var thumb = document.createElement('div');
            thumb.className = 'yt-res-thumb';

            var img = document.createElement('img');
            img.src = r.thumbnail;
            img.loading = 'lazy';
            img.onerror = function () { this.src = thumbUrl(r.id, 'mq'); };
            thumb.appendChild(img);

            if (r.duration) {
                var dur = document.createElement('div');
                dur.className = 'yt-res-duration';
                dur.textContent = fmtDuration(r.duration);
                thumb.appendChild(dur);
            }

            var info = document.createElement('div');
            info.className = 'yt-res-info';

            var title = document.createElement('div');
            title.className = 'yt-res-title';
            title.textContent = r.title;

            var channel = document.createElement('div');
            channel.className = 'yt-res-channel';
            channel.textContent = r.channel || '—';

            var meta = document.createElement('div');
            meta.className = 'yt-res-meta';
            if (r.views) {
                var v = document.createElement('span');
                v.textContent = '👁️ ' + fmtViews(r.views);
                meta.appendChild(v);
            }

            info.appendChild(title);
            info.appendChild(channel);
            info.appendChild(meta);

            el.appendChild(thumb);
            el.appendChild(info);

            el.onclick = function () {
                _insertAndClose(r.id, r);
            };

            body.appendChild(el);
        });
    }

    function _insertAndClose(videoId, meta) {
        var targetId = (YT.ctx === 'private') ? 'pc-input' : 'message-input';
        var inp = document.getElementById(targetId);
        if (!inp) {
            toast('fa-times', '⚠️ تعذّر الوصول للحقل');
            return;
        }

        var token = '[yt:' + videoId + ']';
        var cur = inp.value;
        inp.value = (cur ? cur + ' ' : '') + token + ' ';
        try { inp.focus(); } catch (e) {}

        closeDialog();
    }

    /* ══════════════════════════════════════════════ */
    /* Message token processing                       */
    /* ══════════════════════════════════════════════ */
    function _processElement(rootEl) {
        if (!rootEl || rootEl.nodeType !== 1) return;
        if (YT._processed.has(rootEl)) return;
        YT._processed.add(rootEl);

        var walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
        var toProcess = [];
        while (walker.nextNode()) {
            var val = walker.currentNode.nodeValue;
            if (val && val.indexOf('[yt:') !== -1) {
                toProcess.push(walker.currentNode);
            }
        }

        toProcess.forEach(function (textNode) {
            var parts = _parseYtToken(textNode.nodeValue);
            if (!parts) return;

            var frag = document.createDocumentFragment();
            parts.forEach(function (p) {
                if (p.type === 'text') {
                    if (p.value) frag.appendChild(document.createTextNode(p.value));
                } else if (p.type === 'video') {
                    frag.appendChild(_buildVideoCard(p.id));
                }
            });

            if (textNode.parentNode) {
                textNode.parentNode.replaceChild(frag, textNode);
            }
        });
    }

    function _parseYtToken(text) {
        if (!text || typeof text !== 'string') return null;
        if (text.indexOf('[yt:') === -1) return null;
        var regex = /\[yt:([a-zA-Z0-9_-]{11})\]/g;
        var parts = [];
        var lastIdx = 0, m;
        while ((m = regex.exec(text)) !== null) {
            if (m.index > lastIdx) parts.push({ type: 'text', value: text.substring(lastIdx, m.index) });
            parts.push({ type: 'video', id: m[1] });
            lastIdx = regex.lastIndex;
        }
        if (lastIdx < text.length) parts.push({ type: 'text', value: text.substring(lastIdx) });
        return parts.length ? parts : null;
    }

    function _buildVideoCard(videoId) {
        var card = document.createElement('a');
        card.className = 'yt-msg-card';
        card.href = 'javascript:void(0)';
        card.setAttribute('data-yt-id', videoId);
        card.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            openMiniPlayer(videoId);
        };

        var thumb = document.createElement('div');
        thumb.className = 'yt-msg-thumb';

        var img = document.createElement('img');
        img.src = thumbUrl(videoId, 'hq');
        img.loading = 'lazy';
        img.alt = 'YouTube';
        img.onerror = function () { this.src = thumbUrl(videoId, 'mq'); };
        thumb.appendChild(img);

        var play = document.createElement('div');
        play.className = 'yt-msg-play';
        play.innerHTML =
            '<svg viewBox="0 0 68 48" xmlns="http://www.w3.org/2000/svg">' +
                '<path d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.63 3.26-5.42 6.19C.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z" fill="#ff0000"/>' +
                '<path d="M45 24L27 14v20" fill="#fff"/>' +
            '</svg>';
        thumb.appendChild(play);

        var badge = document.createElement('div');
        badge.className = 'yt-msg-badge';
        badge.innerHTML = '▶️ YouTube';
        thumb.appendChild(badge);

        var meta = document.createElement('div');
        meta.className = 'yt-msg-meta';

        var title = document.createElement('div');
        title.className = 'yt-msg-title';
        title.textContent = '🎬 فيديو يوتيوب';

        var channel = document.createElement('div');
        channel.className = 'yt-msg-channel';
        channel.textContent = 'اضغط للتشغيل';

        meta.appendChild(title);
        meta.appendChild(channel);

        card.appendChild(thumb);
        card.appendChild(meta);

        _fetchVideoMeta(videoId).then(function (info) {
            if (info && info.title) title.textContent = info.title;
            if (info && info.channel) channel.textContent = info.channel;
        }).catch(function () {});

        return card;
    }

    var _metaCache = {};
    async function _fetchVideoMeta(videoId) {
        if (!videoId) return null;
        if (_metaCache[videoId]) return _metaCache[videoId];

        try {
            var res = await fetch('https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=' + videoId + '&format=json');
            if (res.ok) {
                var data = await res.json();
                var info = { title: data.title || '', channel: data.author_name || '' };
                _metaCache[videoId] = info;
                return info;
            }
        } catch (e) {}

        for (var i = 0; i < PIPED_APIS.length; i++) {
            try {
                var res2 = await fetch(PIPED_APIS[i] + '/streams/' + videoId);
                if (!res2.ok) continue;
                var d = await res2.json();
                var info2 = { title: d.title || '', channel: d.uploader || '' };
                _metaCache[videoId] = info2;
                return info2;
            } catch (e) {}
        }

        return null;
    }

    /* ══════════════════════════════════════════════ */
    /* Observers                                      */
    /* ══════════════════════════════════════════════ */
    function installObserver(containerId) {
        var container = document.getElementById(containerId);
        if (!container) return false;
        if (container.__ytObserved) return true;
        container.__ytObserved = true;

        var obs = new MutationObserver(function (muts) {
            muts.forEach(function (m) {
                m.addedNodes.forEach(function (node) {
                    if (node.nodeType !== 1) return;
                    if (node.classList && (
                        node.classList.contains('message') ||
                        node.classList.contains('pc-msg')
                    )) {
                        setTimeout(function () { _processElement(node); }, 80);
                    }
                });
            });
        });
        obs.observe(container, { childList: true, subtree: false });

        container.querySelectorAll('.message, .pc-msg').forEach(function (el) {
            _processElement(el);
        });

        return true;
    }

    function installAllObservers() {
        var ok1 = installObserver('messages');
        var ok2 = installObserver('pc-messages');
        if (!ok1 || !ok2) {
            setTimeout(installAllObservers, 1500);
        }
    }

    /* ══════════════════════════════════════════════ */
    /* Mini Player                                    */
    /* ══════════════════════════════════════════════ */
    function ensureMiniPlayer() {
        var p = document.getElementById('yt-mini-player');
        if (p) return p;

        p = document.createElement('div');
        p.id = 'yt-mini-player';
        p.innerHTML =
            '<div id="yt-mini-header">' +
                '<div id="yt-mini-title">▶️ يوتيوب</div>' +
                '<button class="yt-mini-btn" id="yt-mini-toggle" type="button" title="تصغير">−</button>' +
                '<button class="yt-mini-btn close" id="yt-mini-close" type="button" title="إغلاق">✕</button>' +
            '</div>' +
            '<div id="yt-mini-body"></div>' +
            '<div id="yt-mini-ytlink">🔗 فتح في يوتيوب</div>';

        document.body.appendChild(p);

        p.querySelector('#yt-mini-close').onclick = closeMiniPlayer;
        p.querySelector('#yt-mini-toggle').onclick = function () {
            p.classList.toggle('minimized');
            this.textContent = p.classList.contains('minimized') ? '+' : '−';
        };
        p.querySelector('#yt-mini-ytlink').onclick = function () {
            if (YT.openPlayer) {
                window.open('https://www.youtube.com/watch?v=' + YT.openPlayer, '_blank');
            }
        };

        _makeDraggable(p, p.querySelector('#yt-mini-header'));
        return p;
    }

    function _makeDraggable(el, handle) {
        var isDragging = false;
        var startX = 0, startY = 0, initialX = 0, initialY = 0;

        handle.addEventListener('mousedown', function (e) {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            var rect = el.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            el.style.right = 'auto';
            el.style.bottom = 'auto';
            el.style.left = initialX + 'px';
            el.style.top = initialY + 'px';
            e.preventDefault();
        });

        document.addEventListener('mousemove', function (e) {
            if (!isDragging) return;
            el.style.left = (initialX + (e.clientX - startX)) + 'px';
            el.style.top = (initialY + (e.clientY - startY)) + 'px';
        });

        document.addEventListener('mouseup', function () { isDragging = false; });

        handle.addEventListener('touchstart', function (e) {
            if (e.target.tagName === 'BUTTON') return;
            var t = e.touches[0];
            isDragging = true;
            startX = t.clientX;
            startY = t.clientY;
            var rect = el.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            el.style.right = 'auto';
            el.style.bottom = 'auto';
            el.style.left = initialX + 'px';
            el.style.top = initialY + 'px';
        }, { passive: true });

        document.addEventListener('touchmove', function (e) {
            if (!isDragging) return;
            var t = e.touches[0];
            el.style.left = (initialX + (t.clientX - startX)) + 'px';
            el.style.top = (initialY + (t.clientY - startY)) + 'px';
        }, { passive: true });

        document.addEventListener('touchend', function () { isDragging = false; });
    }

    function openMiniPlayer(videoId) {
        if (!videoId) return;
        var p = ensureMiniPlayer();
        YT.openPlayer = videoId;

        var body = p.querySelector('#yt-mini-body');
        body.innerHTML = '';

        var iframe = document.createElement('iframe');
        iframe.src = 'https://www.youtube-nocookie.com/embed/' + videoId + '?autoplay=1&rel=0&modestbranding=1';
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        iframe.allowFullscreen = true;
        body.appendChild(iframe);

        var titleEl = p.querySelector('#yt-mini-title');
        titleEl.textContent = '⏳ جاري التحميل...';
        _fetchVideoMeta(videoId).then(function (info) {
            if (info && info.title) titleEl.textContent = info.title;
            else titleEl.textContent = '▶️ يوتيوب';
        }).catch(function () {
            titleEl.textContent = '▶️ يوتيوب';
        });

        p.classList.add('active');
        p.classList.remove('minimized');
    }

    function closeMiniPlayer() {
        var p = document.getElementById('yt-mini-player');
        if (!p) return;
        var body = p.querySelector('#yt-mini-body');
        if (body) body.innerHTML = '';
        p.classList.remove('active');
        YT.openPlayer = null;
    }

    /* ══════════════════════════════════════════════ */
    /* Paste detection                                */
    /* ══════════════════════════════════════════════ */
    function installPasteDetection() {
        ['message-input', 'pc-input'].forEach(function (id) {
            var inp = document.getElementById(id);
            if (!inp || inp.__ytPaste) return;
            inp.__ytPaste = true;

            inp.addEventListener('paste', function (e) {
                var paste = (e.clipboardData || window.clipboardData).getData('text');
                if (!paste) return;
                var vid = extractYouTubeId(paste);
                if (!vid) return;

                e.preventDefault();
                var token = '[yt:' + vid + ']';
                var cur = inp.value || '';
                var start = inp.selectionStart || 0;
                var end = inp.selectionEnd || 0;
                inp.value = cur.substring(0, start) + token + cur.substring(end);
                var newPos = start + token.length;
                try { inp.setSelectionRange(newPos, newPos); } catch (err) {}
                toast('fa-youtube', '▶️ تم تحويل الرابط');
            });
        });
    }

    /* ══════════════════════════════════════════════ */
    /* Override searchYouTube                         */
    /* ══════════════════════════════════════════════ */
    function _overrideSearchYouTube() {
        window.searchYouTube = function () {
            var ctx = 'general';
            var pmModal = document.getElementById('private-chat-modal');
            if (pmModal && pmModal.classList.contains('open')) ctx = 'private';
            openDialog(ctx);
            try {
                var t = document.getElementById('floating-toolbar');
                if (t) t.classList.remove('open');
                var b = document.getElementById('plus-btn');
                if (b) b.classList.remove('active');
            } catch (e) {}
        };
    }

    /* ══════════════════════════════════════════════ */
    /* Init                                           */
    /* ══════════════════════════════════════════════ */
    function init() {
        _overrideSearchYouTube();
        installAllObservers();
        setTimeout(installPasteDetection, 1500);
        setInterval(installPasteDetection, 5000);
        console.log('📺 YouTube Search v2: ready (fallback enabled)');
    }

    window.YouTubeSearch = {
        open: openDialog,
        close: closeDialog,
        openMiniPlayer: openMiniPlayer,
        closeMiniPlayer: closeMiniPlayer,
        extractId: extractYouTubeId,
        thumbUrl: thumbUrl,
        version: 2
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('📺 youtube-search.js v2 (TEST) loaded — extended sources + fallback + open external');
})();
