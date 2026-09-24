// ==============================================
// stories.js v4 (TEST) — Mini mode + 20MB + delete
// ==============================================
// ✅ v4:
//   1. window.openStoryViewer يُصدَّر صريحاً (مع options.mini)
//   2. وضع مصغّر (mini) — عند الفتح من تبويب اللحظات في البروفايل
//   3. 20MB فيديو + زر 🗑️ (من v3)
//   4. يستخدم UploadService v7 (فيديو تلغرام فقط)
//   5. إدارة محسّنة للفيديو (cleanup + currentVideoEl)
// ==============================================

(function () {
    'use strict';
    if (window.__storiesV4) return;
    window.__storiesV4 = true;

    var STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;
    var TEXT_DURATION_MS = 5000;
    var IMAGE_DURATION_MS = 15000;
    var VIDEO_FALLBACK_MS = 60000;
    var MAX_TEXT_LEN = 200;
    var MAX_VIDEO_MB = 20;
    var MAX_IMAGE_MB = 5;

    var STORY_BGS = [
        { id: 'sunset',   css: 'linear-gradient(135deg,#ff006e,#fb5607,#ffbe0b)' },
        { id: 'ocean',    css: 'linear-gradient(135deg,#0077b6,#00b4d8,#90e0ef)' },
        { id: 'galaxy',   css: 'linear-gradient(135deg,#1a0033,#4b0082,#8a2be2)' },
        { id: 'forest',   css: 'linear-gradient(135deg,#004d40,#00c853,#69f0ae)' },
        { id: 'fire',     css: 'linear-gradient(135deg,#330000,#8b0000,#ff6600)' },
        { id: 'gold',     css: 'linear-gradient(135deg,#4a3800,#d4af37,#ffec8b)' },
        { id: 'night',    css: 'linear-gradient(135deg,#000,#1a1a2e,#16213e)' },
        { id: 'pink',     css: 'linear-gradient(135deg,#ff006e,#ff69b4,#ffb6d9)' },
        { id: 'emerald',  css: 'linear-gradient(135deg,#004d40,#00d97e,#a5f5b0)' },
        { id: 'royal',    css: 'linear-gradient(135deg,#4a148c,#d4af37,#ffd700)' }
    ];

    var REACTIONS = ['👍','❤️','😂','😮','😢'];

    var St = {
        currentViewer: null,
        currentList: [],
        currentIndex: 0,
        progressTimer: null,
        progressStart: 0,
        progressElapsed: 0,
        isPaused: false,
        publishing: false,
        currentVideoEl: null,
        videoDurationMs: 0,
        videoEndedHandler: null,
        miniMode: false
    };

    function getMe() { return (typeof getCurrentUser === 'function') ? getCurrentUser() : null; }
    function esc(s) { if (s == null) return ''; return String(s).replace(/[&<>"']/g, function(c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
    function timeAgo(ts) {
        if (!ts) return '';
        var s = Math.floor((Date.now() - ts) / 1000);
        if (s < 60) return 'الآن';
        var m = Math.floor(s / 60); if (m < 60) return 'قبل ' + m + 'د';
        var h = Math.floor(m / 60); if (h < 24) return 'قبل ' + h + 'س';
        return 'قبل ' + Math.floor(h/24) + 'ي';
    }

    /* ══════════════════════════════════════════════ */
    /* CSS                                            */
    /* ══════════════════════════════════════════════ */
    (function injectCSS() {
        if (document.getElementById('stories-css-v4')) return;
        var s = document.createElement('style');
        s.id = 'stories-css-v4';
        s.textContent = `
#stories-section { padding: 8px 6px 10px; border-bottom: 1px solid rgba(255,215,0,0.18); margin-bottom: 6px; }
#stories-section h4 { color: #ffd700; font-size: 11px; font-weight: 900; margin: 0 0 8px 2px; display: flex; align-items: center; gap: 5px; }
#stories-row { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding-bottom: 4px; }
#stories-row::-webkit-scrollbar { display: none; }
.story-circle { display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; flex-shrink: 0; width: 58px; transition: transform 0.15s; }
.story-circle:active { transform: scale(0.94); }
.story-avatar-wrap { position: relative; width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.story-ring { position: absolute; inset: 0; border-radius: 50%; padding: 3px; background: conic-gradient(from 0deg, #ffd700, #ff006e, #8a2be2, #ffd700); -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px)); mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px)); animation: storySpin 8s linear infinite; }
.story-ring.seen { background: conic-gradient(from 0deg, #555, #777, #555); animation: none; }
@keyframes storySpin { to { transform: rotate(360deg); } }
.story-avatar { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; border: 2px solid #050508; background: #111; position: relative; z-index: 1; }
.story-avatar-wrap.is-add .story-avatar { background: linear-gradient(135deg,#4a148c,#d4af37); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 22px; font-weight: 900; }
.story-name { font-size: 10px; color: #fff; font-weight: 700; max-width: 58px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; }

/* ═══ Viewer ═══ */
#story-viewer { position: fixed; inset: 0; background: #000; z-index: 999998; display: none; flex-direction: column; direction: rtl; font-family: Cairo, sans-serif; user-select: none; -webkit-user-select: none; touch-action: none; }
#story-viewer.active { display: flex; }
#story-progress-bar { position: absolute; top: 8px; left: 8px; right: 8px; display: flex; gap: 3px; z-index: 10; }
.story-progress-segment { flex: 1; height: 3px; background: rgba(255,255,255,0.3); border-radius: 3px; overflow: hidden; }
.story-progress-fill { height: 100%; width: 0%; background: #fff; transition: width 0.05s linear; }
#story-viewer-header { position: absolute; top: 20px; left: 8px; right: 8px; display: flex; align-items: center; gap: 10px; z-index: 11; padding: 8px 10px; background: linear-gradient(to bottom, rgba(0,0,0,0.6), transparent); }
#story-viewer-header img { width: 38px; height: 38px; border-radius: 50%; border: 2px solid #ffd700; object-fit: cover; cursor: pointer; }
#story-viewer-header .sv-name { flex: 1; color: #fff; font-weight: 900; font-size: 14px; text-shadow: 0 1px 3px rgba(0,0,0,0.9); cursor: pointer; }
#story-viewer-header .sv-time { color: #ccc; font-size: 11px; }
#story-viewer-delete { background: rgba(255,68,68,0.25); border: 1px solid rgba(255,68,68,0.6); color: #fff; font-size: 18px; cursor: pointer; padding: 6px 10px; border-radius: 8px; margin-right: 4px; line-height: 1; }
#story-viewer-delete:active { background: rgba(255,68,68,0.5); }
#story-viewer-close { background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; padding: 4px 8px; line-height: 1; text-shadow: 0 1px 3px rgba(0,0,0,0.9); }
#story-viewer-body { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
.story-content-text { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 40px; text-align: center; color: #fff; font-size: 26px; font-weight: 900; line-height: 1.4; word-wrap: break-word; text-shadow: 0 2px 10px rgba(0,0,0,0.6); }
.story-content-image, .story-content-video { max-width: 100%; max-height: 100%; object-fit: contain; background: #000; }
.story-tap-zone { position: absolute; top: 0; bottom: 0; width: 30%; z-index: 5; }
.story-tap-zone.left { left: 0; }
.story-tap-zone.right { right: 0; }
#story-viewer-footer { padding: 10px 12px 18px; background: linear-gradient(to top, rgba(0,0,0,0.85), transparent); display: flex; align-items: center; gap: 8px; z-index: 10; }
#story-viewer-footer input { flex: 1; padding: 10px 16px; border-radius: 25px; border: 1px solid rgba(255,255,255,0.3); background: rgba(0,0,0,0.5); color: #fff; font-family: inherit; font-size: 13px; outline: none; text-align: right; }
#story-viewer-footer input::placeholder { color: #aaa; }
.story-react-btn { width: 38px; height: 38px; border-radius: 50%; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.25); color: #fff; font-size: 18px; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; padding: 0; }
.story-react-btn:active { transform: scale(0.9); }
#story-reactions-popup { position: absolute; bottom: 70px; right: 12px; display: none; gap: 6px; padding: 8px 10px; background: rgba(0,0,0,0.85); border-radius: 30px; border: 1px solid rgba(255,215,0,0.3); z-index: 12; }
#story-reactions-popup.active { display: flex; }
#story-reactions-popup span { font-size: 22px; cursor: pointer; transition: transform 0.15s; }
#story-reactions-popup span:active { transform: scale(1.3); }
.story-meta { position: absolute; bottom: 90px; left: 12px; right: 12px; display: flex; align-items: center; gap: 8px; justify-content: center; flex-wrap: wrap; z-index: 9; pointer-events: none; }
.story-meta-badge { background: rgba(0,0,0,0.6); border: 1px solid rgba(255,215,0,0.3); border-radius: 20px; padding: 4px 12px; color: #fff; font-size: 12px; font-weight: 700; pointer-events: auto; }

/* ⭐ v4: الوضع المصغّر — للفتح من تبويب اللحظات */
#story-viewer.mini {
    background: rgba(0,0,0,0.85);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    padding: 20px;
    justify-content: center;
    align-items: center;
}
#story-viewer.mini #story-viewer-body {
    position: relative;
    max-width: 320px;
    max-height: 480px;
    width: 85vw;
    height: 70vh;
    border: 2px solid #ffd700;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.9), 0 0 40px rgba(255,215,0,0.3);
    flex: none;
}
#story-viewer.mini #story-progress-bar {
    top: -40px;
    left: 0;
    right: 0;
}
#story-viewer.mini #story-viewer-header {
    top: -75px;
    left: 0;
    right: 0;
    padding: 0;
    background: none;
}
#story-viewer.mini #story-viewer-header img { width: 36px; height: 36px; }
#story-viewer.mini #story-viewer-header .sv-name { font-size: 13px; }
#story-viewer.mini #story-viewer-footer {
    position: static;
    background: none;
    padding: 12px 0 0;
    max-width: 320px;
    width: 85vw;
}
#story-viewer.mini #story-viewer-footer input { font-size: 12px; padding: 8px 12px; }
#story-viewer.mini .story-react-btn { width: 34px; height: 34px; font-size: 15px; }
#story-viewer.mini .story-meta { display: none; }
#story-viewer.mini #story-reactions-popup { bottom: 60px; right: 5px; }

/* ═══ Publish Modal ═══ */
#story-publish-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.92); backdrop-filter: blur(4px); display: none; justify-content: center; align-items: center; z-index: 999999; padding: 16px; direction: rtl; font-family: Cairo, sans-serif; }
#story-publish-modal.active { display: flex; }
#story-publish-box { background: #110724; border: 2px solid #ffd700; border-radius: 18px; padding: 18px; width: 100%; max-width: 400px; max-height: 92vh; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
#story-publish-box h3 { color: #ffd700; font-size: 15px; font-weight: 900; text-align: center; margin: 0; padding-bottom: 10px; border-bottom: 1px solid rgba(255,215,0,0.2); }
.story-tabs { display: flex; gap: 6px; }
.story-tab { flex: 1; padding: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,215,0,0.3); border-radius: 10px; color: #fff; font-family: inherit; font-size: 13px; font-weight: 900; cursor: pointer; }
.story-tab.active { background: rgba(255,215,0,0.25); border-color: #ffd700; color: #ffd700; }
#story-text-area { width: 100%; min-height: 140px; padding: 16px; background: rgba(0,0,0,0.4); border: 2px solid rgba(255,215,0,0.3); border-radius: 12px; color: #fff; font-family: inherit; font-size: 18px; font-weight: 700; text-align: center; outline: none; resize: none; line-height: 1.4; box-sizing: border-box; }
.story-bg-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
.story-bg-item { aspect-ratio: 1; border-radius: 50%; cursor: pointer; border: 2px solid rgba(255,255,255,0.15); transition: transform 0.15s; }
.story-bg-item.active { border-color: #ffd700; transform: scale(1.1); box-shadow: 0 0 12px rgba(255,215,0,0.6); }
.story-privacy-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.story-privacy-btn { padding: 8px 4px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,215,0,0.3); border-radius: 8px; color: #fff; font-family: inherit; font-size: 10px; font-weight: 700; cursor: pointer; text-align: center; }
.story-privacy-btn.active { background: rgba(255,215,0,0.25); border-color: #ffd700; color: #ffd700; }
.story-publish-actions { display: flex; gap: 8px; margin-top: 6px; }
.story-publish-actions button { flex: 1; padding: 12px; border-radius: 10px; border: none; font-family: inherit; font-size: 14px; font-weight: 900; cursor: pointer; }
.story-publish-cancel { background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,215,0,0.2) !important; }
.story-publish-go { background: #ffd700; color: #000; }
#story-image-preview, #story-video-preview { max-width: 100%; max-height: 200px; border-radius: 12px; object-fit: cover; display: block; margin: 0 auto; }
.story-mine-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,215,0,0.2); border-radius: 12px; padding: 12px; margin-bottom: 10px; }
.story-mine-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.story-mine-preview { display: flex; align-items: center; gap: 10px; }
.story-mine-thumb { width: 50px; height: 50px; border-radius: 50%; background-size: cover; background-position: center; border: 2px solid #ffd700; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 12px; font-weight: 900; flex-shrink: 0; overflow: hidden; text-align: center; padding: 2px; }
.story-mine-info { flex: 1; min-width: 0; }
.story-mine-info .time { font-size: 10px; color: #888; }
.story-mine-info .stats { font-size: 11px; color: #ffd700; margin-top: 2px; }
.story-viewers-list { max-height: 200px; overflow-y: auto; margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(255,215,0,0.2); }
.story-viewer-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 12px; color: #fff; }
.story-viewer-row img { width: 28px; height: 28px; border-radius: 50%; border: 1px solid #ffd700; object-fit: cover; }
.story-viewer-row .sv-name-click { flex: 1; cursor: pointer; }
        `;
        document.head.appendChild(s);
    })();

    /* ══════════════════════════════════════════════ */
    /* _canViewStory                                  */
    /* ══════════════════════════════════════════════ */
    async function _canViewStory(story, myUid) {
        if (!story) return false;
        if (story.uid === myUid) return true;
        if (Date.now() > (story.expiresAt || 0)) return false;
        var privacy = story.privacy || 'public';
        if (privacy === 'private') return false;
        if (privacy === 'public') return true;
        if (privacy === 'friends') {
            try {
                var s = await db.ref('users/' + story.uid + '/friends/' + myUid).once('value');
                var f = s.val();
                return !!(f && (!f.status || f.status === 'accepted'));
            } catch (e) { return false; }
        }
        if (privacy === 'online') {
            try {
                var p = await db.ref('user_presence/' + story.uid).once('value');
                var d = p.val() || {};
                if (d.state !== 'online') return false;
                if ((Date.now() - (d.lastChanged || 0)) >= 120000) return false;
                var myRoom = (typeof ChatState !== 'undefined' && ChatState.currentRoom) || 'general';
                return d.room === myRoom;
            } catch (e) { return false; }
        }
        return false;
    }

    /* ══════════════════════════════════════════════ */
    /* fetchStoriesForSidebar                         */
    /* ══════════════════════════════════════════════ */
    async function fetchStoriesForSidebar() {
        var me = getMe();
        if (!me) return { my: null, others: [] };
        try {
            var snap = await db.ref('stories').limitToLast(100).once('value');
            var data = snap.val() || {};
            var mine = null;
            var others = [];
            var uids = Object.keys(data);
            for (var i = 0; i < uids.length; i++) {
                var uid = uids[i];
                var userStories = data[uid] || {};
                var keys = Object.keys(userStories);
                var newest = 0;
                var storyItems = [];
                keys.forEach(function (sid) {
                    var st = userStories[sid];
                    if (!st || Date.now() > (st.expiresAt || 0)) return;
                    st._id = sid;
                    st.uid = uid;
                    storyItems.push(st);
                    if ((st.createdAt || 0) > newest) newest = st.createdAt;
                });
                if (!storyItems.length) continue;
                if (uid === me.uid) {
                    mine = { uid: uid, stories: storyItems, newest: newest };
                    continue;
                }
                var sampleStory = storyItems[0];
                var visible = await _canViewStory(sampleStory, me.uid);
                if (!visible) continue;
                try {
                    var b1 = await db.ref('user_private_blocks/' + me.uid + '/' + uid).once('value');
                    if (b1.exists()) continue;
                } catch (e) {}
                others.push({ uid: uid, stories: storyItems, newest: newest });
            }
            others.sort(function (a, b) { return (b.newest || 0) - (a.newest || 0); });
            return { my: mine, others: others };
        } catch (e) {
            console.warn('fetchStories error:', e);
            return { my: null, others: [] };
        }
    }

    /* ══════════════════════════════════════════════ */
    /* renderStoriesSection (في sidebar المتواجدين)   */
    /* ══════════════════════════════════════════════ */
    async function renderStoriesSection() {
        var content = document.getElementById('users-list-content');
        if (!content) return;
        var existing = document.getElementById('stories-section');
        if (existing) existing.remove();
        var me = getMe();
        if (!me) return;
        var data = await fetchStoriesForSidebar();
        var section = document.createElement('div');
        section.id = 'stories-section';
        var h = '<h4>📸 الحالات اليومية</h4>';
        h += '<div id="stories-row">';
        h += '<div class="story-circle" id="story-add-btn">' +
                '<div class="story-avatar-wrap is-add"><div class="story-avatar">+</div></div>' +
                '<div class="story-name">حالتي</div>' +
              '</div>';
        if (data.my && data.my.stories.length) {
            var av1 = me.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(me.name) + '&background=333&color=fff';
            h += '<div class="story-circle" data-story-mine="1">' +
                    '<div class="story-avatar-wrap">' +
                        '<div class="story-ring"></div>' +
                        '<img class="story-avatar" src="' + esc(av1) + '" alt="">' +
                    '</div>' +
                    '<div class="story-name">' + esc(me.name || 'أنا') + '</div>' +
                 '</div>';
        }
        data.others.forEach(function (item) {
            var u = item.stories[0] || {};
            var name = u.userName || '—';
            var av = u.userAvatar || 'https://ui-avatars.com/api/?name=U&background=333&color=fff';
            h += '<div class="story-circle" data-story-uid="' + esc(item.uid) + '">' +
                    '<div class="story-avatar-wrap">' +
                        '<div class="story-ring"></div>' +
                        '<img class="story-avatar" src="' + esc(av) + '" alt="">' +
                    '</div>' +
                    '<div class="story-name">' + esc(name) + '</div>' +
                 '</div>';
        });
        h += '</div>';
        section.innerHTML = h;
        content.insertBefore(section, content.firstChild);
        var addBtn = section.querySelector('#story-add-btn');
        if (addBtn) addBtn.onclick = function () { openPublishModal(); };
        section.querySelectorAll('[data-story-mine]').forEach(function (el) {
            el.onclick = function () { openStoryViewer(data.my.stories, data.my.uid, true); };
        });
        section.querySelectorAll('[data-story-uid]').forEach(function (el) {
            var uid = el.getAttribute('data-story-uid');
            el.onclick = function () {
                var item = data.others.find(function (x) { return x.uid === uid; });
                if (item) openStoryViewer(item.stories, uid, false);
            };
        });
    }

    /* ══════════════════════════════════════════════ */
    /* Viewer                                         */
    /* ══════════════════════════════════════════════ */
    function ensureViewer() {
        var v = document.getElementById('story-viewer');
        if (v) return v;
        v = document.createElement('div');
        v.id = 'story-viewer';
        v.innerHTML =
            '<div id="story-progress-bar"></div>' +
            '<div id="story-viewer-header">' +
                '<img id="story-viewer-avatar" src="" alt="">' +
                '<div style="flex:1;min-width:0;">' +
                    '<div class="sv-name" id="story-viewer-name"></div>' +
                    '<div class="sv-time" id="story-viewer-time"></div>' +
                '</div>' +
                '<button id="story-viewer-delete" type="button" title="حذف الحالة">🗑️</button>' +
                '<button id="story-viewer-close" type="button">✕</button>' +
            '</div>' +
            '<div id="story-viewer-body">' +
                '<div class="story-tap-zone left" id="story-prev-zone"></div>' +
                '<div class="story-tap-zone right" id="story-next-zone"></div>' +
                '<div id="story-content-holder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"></div>' +
            '</div>' +
            '<div class="story-meta" id="story-meta"></div>' +
            '<div id="story-reactions-popup">' + REACTIONS.map(function (r) { return '<span data-r="' + r + '">' + r + '</span>'; }).join('') + '</div>' +
            '<div id="story-viewer-footer">' +
                '<button class="story-react-btn" id="story-react-trigger" type="button">😊</button>' +
                '<input type="text" id="story-reply-input" placeholder="اكتب رداً..." maxlength="200">' +
                '<button class="story-react-btn" id="story-send-reply" type="button" style="background:#ffd700;color:#000;">➤</button>' +
            '</div>';
        document.body.appendChild(v);

        v.querySelector('#story-viewer-close').onclick = closeViewer;
        v.querySelector('#story-viewer-delete').onclick = deleteCurrentStory;
        v.querySelector('#story-prev-zone').onclick = goPrev;
        v.querySelector('#story-next-zone').onclick = goNext;
        v.querySelector('#story-react-trigger').onclick = function () {
            var p = document.getElementById('story-reactions-popup');
            p.classList.toggle('active');
        };
        v.querySelectorAll('#story-reactions-popup span').forEach(function (sp) {
            sp.onclick = function () {
                var emoji = this.getAttribute('data-r');
                addReaction(emoji);
                document.getElementById('story-reactions-popup').classList.remove('active');
            };
        });
        v.querySelector('#story-send-reply').onclick = sendReply;
        var replyInp = v.querySelector('#story-reply-input');
        if (replyInp) replyInp.onkeydown = function (e) {
            if (e.key === 'Enter') { e.preventDefault(); sendReply(); }
        };

        /* ضغطة الصورة/الاسم → بروفايل */
        var av = v.querySelector('#story-viewer-avatar');
        var nm = v.querySelector('#story-viewer-name');
        if (av) av.onclick = function () { _openStoryOwnerProfile(); };
        if (nm) nm.onclick = function () { _openStoryOwnerProfile(); };

        return v;
    }

    function _openStoryOwnerProfile() {
        if (!St.currentViewer || !St.currentViewer.ownerUid) return;
        if (St.currentViewer.isMine) return;
        var uid = St.currentViewer.ownerUid;
        var curStory = St.currentList[St.currentIndex];
        var name = curStory ? curStory.userName : '';
        try {
            if (typeof window.openUserProfile === 'function') {
                window.openUserProfile(uid, name);
                return;
            }
        } catch (e) {}
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ action: 'openUserProfile', uid: uid, name: name }, '*');
                return;
            }
        } catch (e) {}
        if (typeof _openUserProfile === 'function') {
            _openUserProfile(uid, name);
        }
    }

    /* ⭐ v4: delete current story */
    function deleteCurrentStory() {
        var me = getMe();
        if (!me || !St.currentViewer || !St.currentViewer.isMine) return;
        var story = St.currentList[St.currentIndex];
        if (!story) return;
        if (!confirm('🗑️ حذف هذه الحالة؟')) return;

        stopProgress();
        _cleanupVideo();

        db.ref('stories/' + story.uid + '/' + story._id).remove()
            .then(function () {
                if (typeof showToast === 'function') showToast('fa-check', '✅ تم الحذف');
                St.currentList.splice(St.currentIndex, 1);
                if (St.currentList.length === 0) {
                    closeViewer();
                } else {
                    if (St.currentIndex >= St.currentList.length) {
                        St.currentIndex = St.currentList.length - 1;
                    }
                    renderProgressBar();
                    renderCurrentStory();
                }
                if (typeof window.renderStoriesSection === 'function') window.renderStoriesSection();
                try {
                    var grid = document.getElementById('moments-grid');
                    if (grid && window.Stories && window.Stories.renderMyTab) {
                        var wrapper = grid.querySelector('div');
                        if (wrapper) window.Stories.renderMyTab(wrapper);
                    }
                } catch (e) {}
            })
            .catch(function (e) {
                console.error('Delete story failed:', e);
                if (typeof showToast === 'function') showToast('fa-times', '⚠️ فشل الحذف');
            });
    }

    /* ⭐ v4: openStoryViewer مع options.mini */
    function openStoryViewer(stories, ownerUid, isMine, options) {
        options = options || {};
        if (!stories || !stories.length) return;
        var me = getMe();
        if (!me) return;
        St.currentList = stories.slice().sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
        St.currentIndex = 0;
        St.currentViewer = { ownerUid: ownerUid, isMine: !!isMine };
        St.miniMode = options.mini === true;

        _markViews();
        var v = ensureViewer();
        if (St.miniMode) v.classList.add('mini');
        else v.classList.remove('mini');

        v.classList.add('active');
        renderProgressBar();
        renderCurrentStory();
    }

    function _markViews() {
        var me = getMe();
        if (!me || St.currentViewer.isMine) return;
        St.currentList.forEach(function (st) {
            if (st.uid === me.uid) return;
            db.ref('stories/' + st.uid + '/' + st._id + '/views/' + me.uid).set({
                at: Date.now(),
                name: me.name || 'زائر',
                avatar: me.avatar || ''
            }).catch(function () {});
        });
    }

    function renderProgressBar() {
        var bar = document.getElementById('story-progress-bar');
        if (!bar) return;
        bar.innerHTML = '';
        St.currentList.forEach(function (_, i) {
            var seg = document.createElement('div');
            seg.className = 'story-progress-segment';
            var fill = document.createElement('div');
            fill.className = 'story-progress-fill';
            fill.id = 'story-fill-' + i;
            if (i < St.currentIndex) fill.style.width = '100%';
            seg.appendChild(fill);
            bar.appendChild(seg);
        });
    }

    function _cleanupVideo() {
        if (St.currentVideoEl) {
            try {
                if (St.videoEndedHandler) {
                    St.currentVideoEl.removeEventListener('ended', St.videoEndedHandler);
                }
                St.currentVideoEl.pause();
                St.currentVideoEl.removeAttribute('src');
                St.currentVideoEl.load();
            } catch (e) {}
        }
        St.currentVideoEl = null;
        St.videoEndedHandler = null;
        St.videoDurationMs = 0;
    }

    function renderCurrentStory() {
        var story = St.currentList[St.currentIndex];
        if (!story) { closeViewer(); return; }
        _cleanupVideo();
        var me = getMe();
        var holder = document.getElementById('story-content-holder');
        holder.innerHTML = '';
        var av = story.userAvatar || 'https://ui-avatars.com/api/?name=U&background=333&color=fff';
        document.getElementById('story-viewer-avatar').src = av;
        document.getElementById('story-viewer-name').textContent = story.userName || '—';
        document.getElementById('story-viewer-time').textContent = timeAgo(story.createdAt);

        var delBtn = document.getElementById('story-viewer-delete');
        if (delBtn) delBtn.style.display = St.currentViewer.isMine ? 'block' : 'none';

        if (story.type === 'video' && story.videoUrl) {
            var vid = document.createElement('video');
            vid.className = 'story-content-video';
            vid.src = story.videoUrl;
            vid.playsInline = true;
            vid.setAttribute('playsinline', '');
            vid.setAttribute('webkit-playsinline', '');
            vid.preload = 'auto';
            vid.autoplay = true;
            vid.muted = false;
            vid.controls = false;
            St.currentVideoEl = vid;
            vid.play().catch(function () {
                vid.muted = true;
                vid.play().catch(function (err) { console.warn('video play failed:', err); });
            });
            vid.addEventListener('loadedmetadata', function () {
                var dur = vid.duration;
                if (isFinite(dur) && dur > 0) St.videoDurationMs = Math.ceil(dur * 1000);
                else St.videoDurationMs = VIDEO_FALLBACK_MS;
                startProgress();
            }, { once: true });
            St.videoEndedHandler = function () { stopProgress(); goNext(); };
            vid.addEventListener('ended', St.videoEndedHandler);
            setTimeout(function () {
                if (St.currentVideoEl === vid && St.videoDurationMs === 0) {
                    St.videoDurationMs = VIDEO_FALLBACK_MS;
                    startProgress();
                }
            }, 1500);
            holder.appendChild(vid);
            if (story.text) {
                var ov = document.createElement('div');
                ov.style.cssText = 'position:absolute;bottom:80px;left:15px;right:15px;color:#fff;font-size:14px;font-weight:900;text-align:center;text-shadow:0 2px 8px rgba(0,0,0,0.9);padding:8px;background:rgba(0,0,0,0.5);border-radius:10px;';
                ov.textContent = story.text;
                holder.appendChild(ov);
            }
        } else if (story.type === 'image' && story.imageUrl) {
            var img = document.createElement('img');
            img.className = 'story-content-image';
            img.src = story.imageUrl;
            holder.appendChild(img);
            if (story.text) {
                var ov2 = document.createElement('div');
                ov2.style.cssText = 'position:absolute;bottom:80px;left:15px;right:15px;color:#fff;font-size:14px;font-weight:900;text-align:center;text-shadow:0 2px 8px rgba(0,0,0,0.9);padding:8px;background:rgba(0,0,0,0.5);border-radius:10px;';
                ov2.textContent = story.text;
                holder.appendChild(ov2);
            }
            startProgress();
        } else {
            var div = document.createElement('div');
            div.className = 'story-content-text';
            div.style.background = story.bgColor || STORY_BGS[0].css;
            div.textContent = story.text || '';
            holder.appendChild(div);
            startProgress();
        }

        var meta = document.getElementById('story-meta');
        meta.innerHTML = '';
        if (St.currentViewer.isMine) {
            var vCount = story.views ? Object.keys(story.views).length : 0;
            var rCount = 0;
            if (story.reactions) {
                Object.keys(story.reactions).forEach(function (k) {
                    var arr = story.reactions[k];
                    rCount += Array.isArray(arr) ? arr.length : Object.keys(arr || {}).length;
                });
            }
            var repCount = story.replies ? Object.keys(story.replies).length : 0;
            meta.innerHTML =
                '<span class="story-meta-badge">👁️ ' + vCount + '</span>' +
                '<span class="story-meta-badge">❤️ ' + rCount + '</span>' +
                '<span class="story-meta-badge">💬 ' + repCount + '</span>';
        }

        var footer = document.getElementById('story-viewer-footer');
        footer.style.display = St.currentViewer.isMine ? 'none' : 'flex';
    }

    function startProgress() {
        stopProgress();
        var story = St.currentList[St.currentIndex];
        if (!story) return;
        var duration = (story.type === 'video')
            ? (St.videoDurationMs || VIDEO_FALLBACK_MS)
            : (story.type === 'image' ? IMAGE_DURATION_MS : TEXT_DURATION_MS);
        St.progressStart = Date.now();
        St.progressElapsed = 0;
        var fill = document.getElementById('story-fill-' + St.currentIndex);
        if (!fill) return;
        fill.style.width = '0%';
        var tick = function () {
            if (St.isPaused) return;
            if (story.type === 'video' && St.currentVideoEl && !St.currentVideoEl.paused) {
                var cur = St.currentVideoEl.currentTime * 1000;
                var dur = St.currentVideoEl.duration * 1000;
                if (isFinite(dur) && dur > 0) {
                    var pct = Math.min(100, (cur / dur) * 100);
                    if (fill) fill.style.width = pct + '%';
                }
                return;
            }
            var el = Date.now() - St.progressStart + St.progressElapsed;
            var pct2 = Math.min(100, (el / duration) * 100);
            if (fill) fill.style.width = pct2 + '%';
            if (el >= duration && story.type !== 'video') {
                stopProgress();
                goNext();
            }
        };
        St.progressTimer = setInterval(tick, 50);
    }

    function stopProgress() {
        if (St.progressTimer) { clearInterval(St.progressTimer); St.progressTimer = null; }
    }

    function goNext() {
        if (St.currentIndex < St.currentList.length - 1) {
            var fill = document.getElementById('story-fill-' + St.currentIndex);
            if (fill) fill.style.width = '100%';
            St.currentIndex++;
            renderCurrentStory();
        } else {
            closeViewer();
        }
    }

    function goPrev() {
        if (St.currentIndex > 0) {
            St.currentIndex--;
            renderCurrentStory();
        } else {
            renderCurrentStory();
        }
    }

    function closeViewer() {
        stopProgress();
        _cleanupVideo();
        var v = document.getElementById('story-viewer');
        if (v) {
            v.classList.remove('active');
            v.classList.remove('mini');
        }
        St.currentViewer = null;
        St.currentList = [];
        St.currentIndex = 0;
        St.miniMode = false;
    }

    function addReaction(emoji) {
        var me = getMe();
        if (!me || !St.currentViewer) return;
        var story = St.currentList[St.currentIndex];
        if (!story) return;
        var ref = db.ref('stories/' + story.uid + '/' + story._id + '/reactions/' + emoji + '/' + me.uid);
        ref.set({ at: Date.now(), name: me.name || 'زائر' }).catch(function () {});
        if (typeof showToast === 'function') showToast('fa-check', '✅ ' + emoji);
    }

    function sendReply() {
        var me = getMe();
        if (!me || !St.currentViewer) return;
        var inp = document.getElementById('story-reply-input');
        if (!inp) return;
        var txt = inp.value.trim();
        if (!txt) return;
        var story = St.currentList[St.currentIndex];
        if (!story) return;
        db.ref('stories/' + story.uid + '/' + story._id + '/replies').push({
            fromUid: me.uid,
            fromName: me.name || 'زائر',
            fromAvatar: me.avatar || '',
            text: txt.substring(0, 200),
            at: Date.now()
        }).then(function () {
            if (typeof showToast === 'function') showToast('fa-check', '✅ تم إرسال الرد');
            inp.value = '';
        }).catch(function () {
            if (typeof showToast === 'function') showToast('fa-times', '⚠️ فشل');
        });
    }

    /* ══════════════════════════════════════════════ */
    /* Publish Modal                                  */
    /* ══════════════════════════════════════════════ */
    function ensurePublishModal() {
        var m = document.getElementById('story-publish-modal');
        if (m) return m;
        m = document.createElement('div');
        m.id = 'story-publish-modal';
        m.innerHTML = '<div id="story-publish-box"></div>';
        document.body.appendChild(m);
        m.addEventListener('click', function (e) { if (e.target === m) closePublishModal(); });
        return m;
    }

    function openPublishModal() {
        var m = ensurePublishModal();
        var box = m.querySelector('#story-publish-box');
        St.publishing = false;
        var defaultPrivacy = 'public';
        try { defaultPrivacy = localStorage.getItem('story_default_privacy') || 'public'; } catch (e) {}
        St._pubState = {
            type: 'text', text: '', bgId: STORY_BGS[0].id,
            imageFile: null, imagePreview: null, imageUrl: null,
            videoFile: null, videoPreview: null, videoUrl: null,
            privacy: defaultPrivacy
        };
        box.innerHTML =
            '<h3>📸 نشر حالة</h3>' +
            '<div class="story-tabs">' +
                '<button class="story-tab active" data-t="text">📝 نص</button>' +
                '<button class="story-tab" data-t="image">🖼️ صورة</button>' +
                '<button class="story-tab" data-t="video">🎥 فيديو</button>' +
            '</div>' +
            '<div id="story-pub-body"></div>' +
            '<div class="story-privacy-grid" id="story-privacy-grid">' +
                '<button class="story-privacy-btn" data-p="public">🌍<br>عام</button>' +
                '<button class="story-privacy-btn" data-p="friends">👥<br>أصدقاء</button>' +
                '<button class="story-privacy-btn" data-p="online">🟢<br>متواجدون</button>' +
                '<button class="story-privacy-btn" data-p="private">🔒<br>أنا فقط</button>' +
            '</div>' +
            '<input type="file" id="story-file-input" accept="image/*" style="display:none;">' +
            '<input type="file" id="story-video-input" accept="video/*" style="display:none;">' +
            '<div class="story-publish-actions">' +
                '<button class="story-publish-cancel" id="story-pub-cancel" type="button">إلغاء</button>' +
                '<button class="story-publish-go" id="story-pub-go" type="button">📤 نشر</button>' +
            '</div>';
        _renderPublishBody(box);
        box.querySelectorAll('.story-tab').forEach(function (t) {
            t.onclick = function () {
                box.querySelectorAll('.story-tab').forEach(function (x) { x.classList.remove('active'); });
                t.classList.add('active');
                St._pubState.type = t.getAttribute('data-t');
                _renderPublishBody(box);
            };
        });
        box.querySelectorAll('[data-p]').forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-p') === St._pubState.privacy);
            b.onclick = function () {
                box.querySelectorAll('[data-p]').forEach(function (x) { x.classList.remove('active'); });
                b.classList.add('active');
                St._pubState.privacy = b.getAttribute('data-p');
            };
        });
        box.querySelector('#story-pub-cancel').onclick = closePublishModal;
        box.querySelector('#story-pub-go').onclick = publishStory;
        m.classList.add('active');
    }

    function _renderPublishBody(box) {
        var holder = box.querySelector('#story-pub-body');
        holder.innerHTML = '';
        var st = St._pubState;
        if (st.type === 'text') {
            var ta = document.createElement('textarea');
            ta.id = 'story-text-area';
            ta.maxLength = MAX_TEXT_LEN;
            ta.placeholder = 'اكتب حالتك...';
            ta.value = st.text || '';
            var bg = STORY_BGS.find(function (b) { return b.id === st.bgId; });
            ta.style.background = bg ? bg.css : STORY_BGS[0].css;
            ta.oninput = function () { st.text = this.value; };
            holder.appendChild(ta);
            var grid = document.createElement('div');
            grid.className = 'story-bg-grid';
            STORY_BGS.forEach(function (b) {
                var d = document.createElement('div');
                d.className = 'story-bg-item' + (b.id === st.bgId ? ' active' : '');
                d.style.background = b.css;
                d.onclick = function () {
                    st.bgId = b.id;
                    grid.querySelectorAll('.story-bg-item').forEach(function (x) { x.classList.remove('active'); });
                    d.classList.add('active');
                    var ta2 = document.getElementById('story-text-area');
                    if (ta2) ta2.style.background = b.css;
                };
                grid.appendChild(d);
            });
            holder.appendChild(grid);
        } else if (st.type === 'image') {
            var wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
            if (st.imagePreview) {
                var img = document.createElement('img');
                img.id = 'story-image-preview';
                img.src = st.imagePreview;
                wrap.appendChild(img);
                var ta2 = document.createElement('textarea');
                ta2.id = 'story-text-area';
                ta2.maxLength = MAX_TEXT_LEN;
                ta2.placeholder = 'أضف تعليقاً (اختياري)...';
                ta2.value = st.text || '';
                ta2.style.minHeight = '70px';
                ta2.style.fontSize = '14px';
                ta2.oninput = function () { st.text = this.value; };
                wrap.appendChild(ta2);
            } else {
                var pick = document.createElement('button');
                pick.type = 'button';
                pick.className = 'story-publish-go';
                pick.textContent = '📤 اختر صورة';
                pick.style.padding = '20px';
                pick.onclick = function () {
                    var fi = document.getElementById('story-file-input');
                    if (fi) fi.click();
                };
                wrap.appendChild(pick);
                var hint = document.createElement('div');
                hint.style.cssText = 'color:#888;font-size:11px;text-align:center;';
                hint.textContent = '💡 الحد الأقصى: ' + MAX_IMAGE_MB + 'MB';
                wrap.appendChild(hint);
            }
            holder.appendChild(wrap);
            var fi = document.getElementById('story-file-input');
            if (fi) {
                fi.onchange = function () {
                    var f = this.files && this.files[0];
                    if (!f) return;
                    if (f.size / (1024 * 1024) > MAX_IMAGE_MB) {
                        if (typeof showToast === 'function') showToast('fa-exclamation-triangle', '⚠️ الحد ' + MAX_IMAGE_MB + 'MB');
                        return;
                    }
                    St._pubState.imageFile = f;
                    var rd = new FileReader();
                    rd.onload = function (ev) {
                        St._pubState.imagePreview = ev.target.result;
                        _renderPublishBody(box);
                    };
                    rd.readAsDataURL(f);
                };
            }
        } else if (st.type === 'video') {
            var wrap2 = document.createElement('div');
            wrap2.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
            if (st.videoPreview) {
                var vid = document.createElement('video');
                vid.id = 'story-video-preview';
                vid.src = st.videoPreview;
                vid.muted = true;
                vid.playsInline = true;
                vid.controls = true;
                wrap2.appendChild(vid);
                var ta3 = document.createElement('textarea');
                ta3.id = 'story-text-area';
                ta3.maxLength = MAX_TEXT_LEN;
                ta3.placeholder = 'أضف تعليقاً (اختياري)...';
                ta3.value = st.text || '';
                ta3.style.minHeight = '60px';
                ta3.style.fontSize = '14px';
                ta3.oninput = function () { st.text = this.value; };
                wrap2.appendChild(ta3);
            } else {
                var pick2 = document.createElement('button');
                pick2.type = 'button';
                pick2.className = 'story-publish-go';
                pick2.textContent = '🎥 اختر فيديو';
                pick2.style.padding = '20px';
                pick2.onclick = function () {
                    var vi = document.getElementById('story-video-input');
                    if (vi) vi.click();
                };
                wrap2.appendChild(pick2);
                var hint2 = document.createElement('div');
                hint2.style.cssText = 'color:#888;font-size:11px;text-align:center;';
                hint2.textContent = '💡 الحد الأقصى: ' + MAX_VIDEO_MB + 'MB (Telegram)';
                wrap2.appendChild(hint2);
            }
            holder.appendChild(wrap2);
            var vi = document.getElementById('story-video-input');
            if (vi) {
                vi.onchange = function () {
                    var f = this.files && this.files[0];
                    if (!f) return;
                    if (f.size / (1024 * 1024) > MAX_VIDEO_MB) {
                        if (typeof showToast === 'function') showToast('fa-exclamation-triangle', '⚠️ الحد ' + MAX_VIDEO_MB + 'MB');
                        return;
                    }
                    St._pubState.videoFile = f;
                    var rd2 = new FileReader();
                    rd2.onload = function (ev) {
                        St._pubState.videoPreview = ev.target.result;
                        _renderPublishBody(box);
                    };
                    rd2.readAsDataURL(f);
                };
            }
        }
    }

    function closePublishModal() {
        var m = document.getElementById('story-publish-modal');
        if (m) m.classList.remove('active');
    }

    async function publishStory() {
        if (St.publishing) return;
        var me = getMe();
        if (!me) return;
        var st = St._pubState;
        if (st.type === 'text' && (!st.text || st.text.trim().length < 1)) {
            if (typeof showToast === 'function') showToast('fa-exclamation', '⚠️ اكتب شيئاً');
            return;
        }
        if (st.type === 'image' && !st.imagePreview && !st.imageUrl) {
            if (typeof showToast === 'function') showToast('fa-exclamation', '⚠️ اختر صورة');
            return;
        }
        if (st.type === 'video' && !st.videoPreview && !st.videoUrl) {
            if (typeof showToast === 'function') showToast('fa-exclamation', '⚠️ اختر فيديو');
            return;
        }
        if (!window.UploadService) {
            if (typeof showToast === 'function') showToast('fa-times', '⚠️ UploadService غير محمّل');
            return;
        }
        St.publishing = true;
        var goBtn = document.getElementById('story-pub-go');
        if (goBtn) { goBtn.disabled = true; goBtn.textContent = '⏳ جاري النشر...'; }
        try {
            var imageUrl = null;
            var videoUrl = null;
            if (st.type === 'image' && st.imageFile && !st.imageUrl) {
                if (typeof showToast === 'function') showToast('fa-spinner', '⏳ جاري رفع الصورة...');
                imageUrl = await window.UploadService.upload(st.imageFile);
                st.imageUrl = imageUrl;
            }
            if (st.type === 'video' && st.videoFile && !st.videoUrl) {
                if (typeof showToast === 'function') showToast('fa-spinner', '⏳ جاري رفع الفيديو...');
                /* v7: الفيديو يروح تلغرام فقط */
                videoUrl = await window.UploadService.upload(st.videoFile);
                st.videoUrl = videoUrl;
            }
            var now = Date.now();
            var storyData = {
                uid: me.uid,
                userName: me.name || 'زائر',
                userAvatar: me.avatar || '',
                type: st.type,
                text: (st.text || '').substring(0, MAX_TEXT_LEN),
                bgColor: st.type === 'text' ? (STORY_BGS.find(function (b) { return b.id === st.bgId; }) || STORY_BGS[0]).css : null,
                imageUrl: imageUrl,
                videoUrl: videoUrl,
                privacy: st.privacy,
                createdAt: now,
                expiresAt: now + STORY_LIFETIME_MS,
                views: {}, reactions: {}, replies: {}
            };
            await db.ref('stories/' + me.uid).push(storyData);
            if (typeof showToast === 'function') showToast('fa-check', '✅ نُشرت الحالة');
            closePublishModal();
            renderStoriesSection();
        } catch (e) {
            console.error('publishStory error:', e);
            if (typeof showToast === 'function') showToast('fa-times', '⚠️ فشل: ' + (e.message || ''));
        }
        St.publishing = false;
        if (goBtn) { goBtn.disabled = false; goBtn.textContent = '📤 نشر'; }
    }

    /* ══════════════════════════════════════════════ */
    /* renderMyStoryTab (يستدعيها profile-core v15)   */
    /* ══════════════════════════════════════════════ */
    async function renderMyStoryTab(container) {
        if (!container) return;
        container.innerHTML = '<div style="text-align:center;color:#888;padding:20px;font-size:12px;">⏳ جاري التحميل...</div>';
        var me = getMe();
        if (!me) {
            container.innerHTML = '<div style="text-align:center;color:#888;padding:20px;font-size:12px;">سجّل دخول</div>';
            return;
        }
        try {
            var snap = await db.ref('stories/' + me.uid).once('value');
            var data = snap.val() || {};
            var now = Date.now();
            var stories = Object.keys(data).map(function (k) {
                var st = data[k]; st._id = k; return st;
            }).filter(function (st) { return (st.expiresAt || 0) > now; })
              .sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
            var defaultPriv = 'public';
            try { defaultPriv = localStorage.getItem('story_default_privacy') || 'public'; } catch (e) {}
            var h = '';
            h += '<button class="story-publish-go" id="story-tab-add" type="button" style="width:100%;padding:12px;border-radius:12px;font-size:14px;font-weight:900;cursor:pointer;margin-bottom:14px;">📸 أضف حالة جديدة</button>';
            h += '<div style="display:flex;flex-direction:column;gap:10px;">';
            h += '<div style="color:#ffd700;font-size:12px;font-weight:900;">⚙️ الإعدادات الافتراضية</div>';
            h += '<div style="display:flex;align-items:center;gap:8px;justify-content:space-between;padding:8px 0;">';
            h += '<span style="color:#fff;font-size:12px;">الخصوصية الافتراضية:</span>';
            h += '<select id="story-default-privacy" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,215,0,0.3);color:#fff;border-radius:8px;padding:6px 10px;font-family:inherit;font-size:12px;">';
            ['public','friends','online','private'].forEach(function (p) {
                var names = { public: '🌍 عام', friends: '👥 أصدقاء', online: '🟢 متواجدون', private: '🔒 أنا فقط' };
                h += '<option value="' + p + '"' + (p === defaultPriv ? ' selected' : '') + '>' + names[p] + '</option>';
            });
            h += '</select></div>';
            h += '</div>';
            h += '<div style="border-top:1px dashed rgba(255,215,0,0.2);margin:14px 0;padding-top:12px;"></div>';
            h += '<div style="color:#ffd700;font-size:12px;font-weight:900;margin-bottom:10px;">📋 حالاتي الحالية (' + stories.length + ')</div>';
            h += '<div id="story-mine-list"></div>';
            container.innerHTML = h;
            document.getElementById('story-tab-add').onclick = openPublishModal;
            var sel = document.getElementById('story-default-privacy');
            if (sel) sel.onchange = function () {
                try { localStorage.setItem('story_default_privacy', this.value); } catch (e) {}
                if (typeof showToast === 'function') showToast('fa-check', '✅ تم');
            };
            var listEl = document.getElementById('story-mine-list');
            if (!stories.length) {
                listEl.innerHTML = '<div style="text-align:center;color:#888;padding:16px;font-size:12px;">لا توجد حالات منشورة</div>';
            } else {
                stories.forEach(function (st) {
                    var card = document.createElement('div');
                    card.className = 'story-mine-card';
                    var vCount = st.views ? Object.keys(st.views).length : 0;
                    var rCount = 0;
                    if (st.reactions) Object.keys(st.reactions).forEach(function (k) {
                        var arr = st.reactions[k];
                        rCount += Array.isArray(arr) ? arr.length : Object.keys(arr || {}).length;
                    });
                    var repCount = st.replies ? Object.keys(st.replies).length : 0;
                    var thumbStyle;
                    if (st.type === 'image' && st.imageUrl) {
                        thumbStyle = 'background-image:url(' + esc(st.imageUrl) + ');';
                    } else if (st.type === 'video' && st.videoUrl) {
                        thumbStyle = 'background:#000;';
                    } else {
                        thumbStyle = 'background:' + esc(st.bgColor || '#333') + ';';
                    }
                    var shortText = st.text || (
                        st.type === 'image' ? '🖼️ صورة' :
                        st.type === 'video' ? '🎥 فيديو' : '—'
                    );
                    if (shortText.length > 30) shortText = shortText.substring(0, 30) + '...';
                    var typeLabel = st.type === 'video' ? '🎥 فيديو' : (st.type === 'image' ? '🖼️ صورة' : '📝 نص');
                    card.innerHTML =
                        '<div class="story-mine-header">' +
                            '<div class="story-mine-preview">' +
                                '<div class="story-mine-thumb" style="' + thumbStyle + '">' + (st.type === 'text' ? esc(shortText.substring(0, 20)) : '') + '</div>' +
                                '<div class="story-mine-info">' +
                                    '<div style="color:#fff;font-size:12px;font-weight:900;">' + typeLabel + '</div>' +
                                    '<div class="time">' + timeAgo(st.createdAt) + ' · ينتهي ' + timeAgo(st.expiresAt) + '</div>' +
                                    '<div class="stats">👁️ ' + vCount + ' · ❤️ ' + rCount + ' · 💬 ' + repCount + '</div>' +
                                '</div>' +
                            '</div>' +
                            '<button class="story-publish-cancel" data-del="' + esc(st._id) + '" type="button" style="padding:6px 10px;font-size:11px;">🗑️</button>' +
                        '</div>';
                    if (st.views && Object.keys(st.views).length > 0) {
                        var vh = '<div style="color:#ffd700;font-size:11px;font-weight:900;margin-top:8px;">👁️ المشاهدون:</div>';
                        vh += '<div class="story-viewers-list">';
                        Object.keys(st.views).forEach(function (vid) {
                            var vd = st.views[vid] || {};
                            vh += '<div class="story-viewer-row">' +
                                    '<img src="' + esc(vd.avatar || 'https://ui-avatars.com/api/?name=U&background=333&color=fff') + '">' +
                                    '<span class="sv-name-click" data-vuid="' + esc(vid) + '" data-vname="' + esc(vd.name || '') + '">' + esc(vd.name || '—') + '</span>' +
                                    '<span style="color:#888;font-size:10px;">' + timeAgo(vd.at) + '</span>' +
                                  '</div>';
                        });
                        vh += '</div>';
                        var vdiv = document.createElement('div');
                        vdiv.innerHTML = vh;
                        card.appendChild(vdiv);
                    }
                    if (st.replies && Object.keys(st.replies).length > 0) {
                        var rh = '<div style="color:#ffd700;font-size:11px;font-weight:900;margin-top:8px;">💬 الردود:</div>';
                        rh += '<div class="story-viewers-list">';
                        Object.keys(st.replies).forEach(function (rid) {
                            var rp = st.replies[rid] || {};
                            rh += '<div class="story-viewer-row">' +
                                    '<img src="' + esc(rp.fromAvatar || 'https://ui-avatars.com/api/?name=U&background=333&color=fff') + '">' +
                                    '<div style="flex:1;min-width:0;">' +
                                        '<div style="font-weight:900;font-size:11px;cursor:pointer;" data-vuid="' + esc(rp.fromUid || '') + '" data-vname="' + esc(rp.fromName || '') + '">' + esc(rp.fromName || '—') + '</div>' +
                                        '<div style="color:#ccc;font-size:11px;word-break:break-word;">' + esc(rp.text || '') + '</div>' +
                                    '</div>' +
                                  '</div>';
                        });
                        rh += '</div>';
                        var rdiv = document.createElement('div');
                        rdiv.innerHTML = rh;
                        card.appendChild(rdiv);
                    }
                    listEl.appendChild(card);
                });
                /* حذف */
                listEl.querySelectorAll('[data-del]').forEach(function (b) {
                    b.onclick = function () {
                        var sid = this.getAttribute('data-del');
                        if (!confirm('حذف هذه الحالة؟')) return;
                        db.ref('stories/' + me.uid + '/' + sid).remove().then(function () {
                            if (typeof showToast === 'function') showToast('fa-check', '✅ حُذفت');
                            renderMyStoryTab(container);
                        }).catch(function () {
                            if (typeof showToast === 'function') showToast('fa-times', '⚠️ فشل');
                        });
                    };
                });
                /* ⭐ v4: كليكات على المشاهدين + الردود → بروفايل */
                listEl.querySelectorAll('[data-vuid]').forEach(function (b) {
                    b.onclick = function (e) {
                        e.stopPropagation();
                        var uid = this.getAttribute('data-vuid');
                        var name = this.getAttribute('data-vname');
                        if (uid && uid !== me.uid) _openUserProfile(uid, name);
                    };
                });
            }
        } catch (e) {
            container.innerHTML = '<div style="text-align:center;color:#ff6666;padding:20px;font-size:12px;">⚠️ خطأ: ' + esc(e.message) + '</div>';
        }
    }

    /* ══════════════════════════════════════════════ */
    /* Cleanup expired (محلي — الطرف الآخر)          */
    /* ══════════════════════════════════════════════ */
    async function cleanupExpiredStories() {
        if (typeof db === 'undefined' || !db) return;
        var me = getMe();
        if (!me) return;
        try {
            var snap = await db.ref('stories/' + me.uid).once('value');
            var data = snap.val() || {};
            var now = Date.now();
            var promises = [];
            Object.keys(data).forEach(function (sid) {
                var st = data[sid];
                if (!st || !st.expiresAt) return;
                if (st.expiresAt < now) {
                    promises.push(db.ref('stories/' + me.uid + '/' + sid).remove().catch(function () {}));
                }
            });
            if (promises.length) await Promise.all(promises);
        } catch (e) {}
    }

    function setupStoriesListener() {
        if (typeof db === 'undefined' || !db) { setTimeout(setupStoriesListener, 1500); return; }
        var me = getMe();
        if (!me) { setTimeout(setupStoriesListener, 1500); return; }
        cleanupExpiredStories();
        setInterval(function () { cleanupExpiredStories(); }, 30 * 60 * 1000);
        console.log('📸 stories.js v4: ready');
    }

    function patchUsersSidebar() {
        if (typeof window.showOnlineUsers !== 'function') { setTimeout(patchUsersSidebar, 500); return; }
        if (window.__storiesPatchedShowUsers) return;
        window.__storiesPatchedShowUsers = true;
        var _orig = window.showOnlineUsers;
        window.showOnlineUsers = async function () {
            await _orig.apply(this, arguments);
            setTimeout(function () { renderStoriesSection(); }, 100);
        };
        console.log('📸 stories.js v4: users-sidebar patched');
    }

    function init() {
        var t = setInterval(function () {
            if (typeof getCurrentUser === 'function' && getCurrentUser() && typeof db !== 'undefined' && db) {
                clearInterval(t);
                setupStoriesListener();
                patchUsersSidebar();
            }
        }, 800);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

    /* ⭐ v4: التصدير — مع openStoryViewer صريح */
    window.Stories = {
        publish: openPublishModal,
        renderMyTab: renderMyStoryTab,
        refreshSidebar: renderStoriesSection,
        openViewer: openStoryViewer
    };
    window.renderStoriesSection = renderStoriesSection;
    window.openStoryPublish = openPublishModal;
    window.openStoryViewer = openStoryViewer;   /* ⭐ v4: مهم للـ profile-core v15 */

    console.log('📸 stories.js v4 (TEST) loaded — 20MB video + mini mode + delete');
})();
