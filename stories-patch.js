// ==============================================
// stories-patch.js v1 — إصلاح الحالات
// ==============================================
// ✅ v1:
//   1. getMe fallback (يقرأ من localStorage لو auth غير محمّل)
//   2. Pause progress عند فتح كيبورد/إيموجي
//   3. شريط الإيموجي فوق (position fix)
//   4. Real-time listener للتفاعلات لصاحب الحالة
//   5. اللحظات في البروفايل تعرض الحالات
// ==============================================

(function () {
    'use strict';
    if (window.__storiesPatchV1) return;
    window.__storiesPatchV1 = true;

    /* ══════════════════════════════════════════════ */
    /* 1. getMe موحّد (يعمل داخل iframe)              */
    /* ══════════════════════════════════════════════ */
    function getMe() {
        try {
            if (typeof getCurrentUser === 'function') {
                var u = getCurrentUser();
                if (u && u.uid) return u;
            }
        } catch (e) {}
        try {
            return JSON.parse(
                localStorage.getItem('qamar_current_user') ||
                localStorage.getItem('qamar_user') ||
                'null'
            );
        } catch (e) { return null; }
    }
    window.StoriesGetMe = getMe;

    /* ══════════════════════════════════════════════ */
    /* 2. Pause progress (كيبورد + إيموجي)             */
    /* ══════════════════════════════════════════════ */
    function _installPauseHooks() {
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            var viewer = document.getElementById('story-viewer');
            if (!viewer) {
                if (attempts >= 40) clearInterval(t);
                return;
            }
            if (viewer.__pauseHooked) { clearInterval(t); return; }
            viewer.__pauseHooked = true;

            /* Hook على input الرد */
            var inp = document.getElementById('story-reply-input');
            if (inp) {
                inp.addEventListener('focus', function () {
                    if (window.Stories && window.Stories.pause) window.Stories.pause();
                    else if (typeof _pauseProgress === 'function') _pauseProgress();
                    console.log('⏸️ story: paused (input focus)');
                });
                inp.addEventListener('blur', function () {
                    setTimeout(function () {
                        /* إذا لم يفتح شيء آخر → resume */
                        var active = document.activeElement;
                        if (active !== inp) {
                            if (window.Stories && window.Stories.resume) window.Stories.resume();
                            else if (typeof _resumeProgress === 'function') _resumeProgress();
                            console.log('▶️ story: resumed (input blur)');
                        }
                    }, 150);
                });
            }

            /* Hook على emoji popup */
            var emojiTrig = document.getElementById('story-react-trigger');
            if (emojiTrig) {
                emojiTrig.addEventListener('click', function () {
                    var popup = document.getElementById('story-reactions-popup');
                    if (popup && popup.classList.contains('active')) {
                        if (window.Stories && window.Stories.pause) window.Stories.pause();
                    } else {
                        if (window.Stories && window.Stories.resume) window.Stories.resume();
                    }
                });
            }

            /* Hook على أي click داخل popup الإيموجي */
            var emojiPopup = document.getElementById('story-reactions-popup');
            if (emojiPopup) {
                emojiPopup.addEventListener('click', function () {
                    /* بعد اختيار الإيموجي → resume */
                    setTimeout(function () {
                        if (window.Stories && window.Stories.resume) window.Stories.resume();
                    }, 200);
                });
            }

            console.log('✅ stories-patch: pause hooks installed');
            clearInterval(t);
        }, 250);
    }

    /* ══════════════════════════════════════════════ */
    /* 3. شريط الإيموجي فوق (CSS fix)                 */
    /* ══════════════════════════════════════════════ */
    (function injectCSS() {
        if (document.getElementById('stories-patch-css')) return;
        var s = document.createElement('style');
        s.id = 'stories-patch-css';
        s.textContent = `
/* إصلاح: شريط الإيموجي فوق الحالة */
#story-viewer #story-reactions-popup {
    z-index: 9999999 !important;
    bottom: 90px !important;
    right: 12px !important;
    pointer-events: auto !important;
}
#story-viewer.mini #story-reactions-popup {
    bottom: 70px !important;
    right: 5px !important;
}

/* إصلاح: footer أعلى من الإيموجي */
#story-viewer-footer {
    position: relative !important;
    z-index: 50 !important;
}
#story-viewer-footer input {
    position: relative !important;
    z-index: 51 !important;
}

/* تحسين موضع الـ emoji trigger */
#story-react-trigger {
    position: relative !important;
    z-index: 51 !important;
}

/* ⭐ أزرار التفاعل الكبيرة لصاحب الحالة */
#story-owner-live-stats {
    position: absolute;
    top: 70px;
    left: 12px;
    right: 12px;
    display: flex;
    gap: 8px;
    z-index: 100;
    pointer-events: auto;
    justify-content: center;
}
#story-owner-live-stats .stat-chip {
    background: rgba(0,0,0,0.75);
    border: 1px solid rgba(255,215,0,0.5);
    border-radius: 20px;
    padding: 6px 12px;
    color: #fff;
    font-size: 11px;
    font-weight: 900;
    display: flex;
    align-items: center;
    gap: 4px;
    backdrop-filter: blur(6px);
}
#story-owner-live-stats .stat-chip .num {
    color: #ffd700;
    font-weight: 900;
}
`;
        document.head.appendChild(s);
    })();

    /* ══════════════════════════════════════════════ */
    /* 4. Real-time listener للتفاعلات                */
    /* ══════════════════════════════════════════════ */
    var _liveListener = null;
    var _currentStory = null;

    function _startLiveListener(uid, sid) {
        if (!db || !uid || !sid) return;
        _stopLiveListener();
        _currentStory = { uid: uid, sid: sid };

        var ref = db.ref('stories/' + uid + '/' + sid);
        _liveListener = ref;

        ref.on('value', function (s) {
            var st = s.val();
            if (!st) return;
            _updateLiveStats(st);
        });
    }

    function _stopLiveListener() {
        if (_liveListener) {
            try { _liveListener.off(); } catch (e) {}
            _liveListener = null;
        }
        _currentStory = null;
        _removeLiveStats();
    }

    function _updateLiveStats(story) {
        var me = getMe();
        if (!me || !story) return;

        /* فقط لصاحب الحالة */
        if (story.uid !== me.uid) {
            _removeLiveStats();
            return;
        }

        var viewer = document.getElementById('story-viewer');
        if (!viewer || !viewer.classList.contains('active')) return;

        var views = story.views ? Object.keys(story.views).length : 0;
        var reactions = 0;
        if (story.reactions) {
            Object.keys(story.reactions).forEach(function (k) {
                var arr = story.reactions[k];
                reactions += Array.isArray(arr) ? arr.length : Object.keys(arr || {}).length;
            });
        }
        var replies = story.replies ? Object.keys(story.replies).length : 0;

        var statsEl = document.getElementById('story-owner-live-stats');
        if (!statsEl) {
            statsEl = document.createElement('div');
            statsEl.id = 'story-owner-live-stats';
            viewer.appendChild(statsEl);
        }

        statsEl.innerHTML =
            '<div class="stat-chip">👁️ <span class="num">' + views + '</span></div>' +
            '<div class="stat-chip">❤️ <span class="num">' + reactions + '</span></div>' +
            '<div class="stat-chip">💬 <span class="num">' + replies + '</span></div>';
    }

    function _removeLiveStats() {
        var el = document.getElementById('story-owner-live-stats');
        if (el) el.remove();
    }

    /* ══════════════════════════════════════════════ */
    /* 5. Hook على openStoryViewer                    */
    /* ══════════════════════════════════════════════ */
    function _hookOpenViewer() {
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            var orig = window.openStoryViewer;
            if (typeof orig !== 'function') {
                if (attempts >= 40) clearInterval(t);
                return;
            }
            if (orig.__patchWrapped) { clearInterval(t); return; }

            window.openStoryViewer = function (stories, ownerUid, isMine, options) {
                var result = orig.apply(this, arguments);
                /* بعد فتح viewer → ابدأ live listener */
                setTimeout(function () {
                    if (stories && stories.length > 0) {
                        var s = stories[0];
                        if (s && s._id) {
                            _startLiveListener(ownerUid || s.uid, s._id);
                        }
                    }
                }, 300);
                return result;
            };
            window.openStoryViewer.__patchWrapped = true;
            console.log('✅ stories-patch: openStoryViewer hooked');
            clearInterval(t);
        }, 250);
    }

    /* Hook على close */
    function _hookClose() {
        var viewer = document.getElementById('story-viewer');
        if (!viewer) { setTimeout(_hookClose, 1000); return; }
        if (viewer.__closeHooked) return;
        viewer.__closeHooked = true;

        var closeBtn = document.getElementById('story-viewer-close');
        if (closeBtn) {
            var orig = closeBtn.onclick;
            closeBtn.onclick = function (e) {
                _stopLiveListener();
                if (typeof orig === 'function') return orig.call(this, e);
            };
        }
    }

    /* ══════════════════════════════════════════════ */
    /* 6. إصلاح اللحظات في البروفايل                  */
    /* ══════════════════════════════════════════════ */
    function _patchProfileMoments() {
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            if (!window.Stories || typeof window.Stories.renderMyTab !== 'function') {
                if (attempts >= 60) clearInterval(t);
                return;
            }
            if (window.Stories.renderMyTab.__patchFixed) { clearInterval(t); return; }

            var origRender = window.Stories.renderMyTab;
            window.Stories.renderMyTab = function (container) {
                if (!container) return;

                /* fallback: احصل على المستخدم من localStorage */
                var me = getMe();
                if (!me || !me.uid) {
                    container.innerHTML = '<div style="text-align:center;color:#888;padding:20px;font-size:12px;">سجّل دخول</div>';
                    return;
                }

                /* نكمل مع الأصل — بعد التأكد أن getMe سليم */
                return origRender.call(this, container);
            };
            window.Stories.renderMyTab.__patchFixed = true;
            console.log('✅ stories-patch: renderMyTab patched');
            clearInterval(t);
        }, 250);
    }

    /* ══════════════════════════════════════════════ */
    /* Init                                           */
    /* ══════════════════════════════════════════════ */
    function init() {
        _installPauseHooks();
        _hookOpenViewer();
        _hookClose();
        _patchProfileMoments();

        setTimeout(_installPauseHooks, 2000);
        setTimeout(_hookOpenViewer, 2000);
        setTimeout(_hookClose, 2000);
        setTimeout(_patchProfileMoments, 2000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

    console.log('✅ stories-patch.js v1 loaded');
})();
