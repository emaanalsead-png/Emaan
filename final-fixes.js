// ==============================================
// final-fixes.js v1 — 3 إصلاحات
// ==============================================
// ✅ v1:
//   1. Story: pause/resume صحيح (يمنع resume من blur لو إيموجي مفتوح)
//   2. Story: video fit (object-fit: cover — يملأ الحالة)
//   3. Chat: اسم المرسل → منشن (بدل بروفايل)
// ==============================================

(function () {
    'use strict';
    if (window.__finalFixesV1) return;
    window.__finalFixesV1 = true;

    /* ══════════════════════════════════════════════ */
    /* 1. CSS — Video fit + Story fixes                */
    /* ══════════════════════════════════════════════ */
    (function injectCSS() {
        if (document.getElementById('final-fixes-css')) return;
        var s = document.createElement('style');
        s.id = 'final-fixes-css';
        s.textContent = `
/* Video يملأ الحالة بالكامل */
.story-content-video {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    display: block !important;
    background: #000 !important;
}
.story-content-image {
    width: 100% !important;
    height: 100% !important;
    object-fit: contain !important;
}
/* في الوضع المصغّر — نضمن التغطية */
#story-viewer.mini .story-content-video {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
}
#story-viewer.mini #story-viewer-body {
    overflow: hidden !important;
}
/* شريط الإيموجي فوق (تأكيد) */
#story-reactions-popup {
    z-index: 9999999 !important;
    pointer-events: auto !important;
}
#story-reactions-popup span {
    pointer-events: auto !important;
}
        `;
        document.head.appendChild(s);
    })();

    /* ══════════════════════════════════════════════ */
    /* 2. Story — Pause/Resume counter مع إيموجي       */
    /* ══════════════════════════════════════════════ */
    function _installPauseCounter() {
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            if (!window.Stories || typeof window.Stories.pause !== 'function') {
                if (attempts >= 40) clearInterval(t);
                return;
            }
            if (window.Stories.__counterWrapped) { clearInterval(t); return; }

            var _pauseCount = 0;
            var _origPause = window.Stories.pause;
            var _origResume = window.Stories.resume;

            window.Stories.pause = function () {
                _pauseCount++;
                if (_pauseCount === 1) _origPause();
            };
            window.Stories.resume = function () {
                _pauseCount = Math.max(0, _pauseCount - 1);
                if (_pauseCount === 0) _origResume();
            };
            window.Stories.__counterWrapped = true;
            clearInterval(t);
            console.log('✅ final-fixes: pause counter wrapped');
        }, 200);
    }

    /* إعادة ربط input handler (لتفادي blur bug في stories.js v6) */
    function _rebindStoryInput() {
        var inp = document.getElementById('story-reply-input');
        if (!inp) return;
        if (inp.__finalRebound) return;
        inp.__finalRebound = true;

        /* نلغي الـ handlers القديمة */
        inp.onfocus = null;
        inp.onblur = null;

        inp.addEventListener('focus', function () {
            if (window.Stories && window.Stories.pause) window.Stories.pause();
        });

        inp.addEventListener('blur', function () {
            setTimeout(function () {
                /* لو ما زال focus عليه → لا resume */
                if (document.activeElement === inp) return;
                /* لو الـ emoji popup مفتوح → لا resume */
                var popup = document.getElementById('story-reactions-popup');
                if (popup && popup.classList.contains('active')) return;
                /* لو الـ actions menu مفتوح → لا resume */
                var menu = document.getElementById('story-actions-menu');
                if (menu && menu.classList.contains('active')) return;
                /* وإلا → resume */
                if (window.Stories && window.Stories.resume) window.Stories.resume();
            }, 250);
        });
    }

    /* نراقب فتح viewer لإعادة ربط الـ input */
    function _watchViewer() {
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            var viewer = document.getElementById('story-viewer');
            if (!viewer) {
                if (attempts >= 40) clearInterval(t);
                return;
            }
            if (viewer.__watched) { clearInterval(t); return; }
            viewer.__watched = true;

            new MutationObserver(function () {
                if (viewer.classList.contains('active')) {
                    /* نعيد الربط بعد بناء الـ input */
                    setTimeout(_rebindStoryInput, 100);
                    setTimeout(_rebindStoryInput, 500);
                    setTimeout(_rebindStoryInput, 1500);
                }
            }).observe(viewer, { attributes: true, attributeFilter: ['class'] });

            /* لو مفتوح من قبل */
            if (viewer.classList.contains('active')) {
                setTimeout(_rebindStoryInput, 300);
            }

            clearInterval(t);
        }, 500);
    }

    /* ══════════════════════════════════════════════ */
    /* 3. Chat — اسم المرسل → منشن                    */
    /* ══════════════════════════════════════════════ */
    function _fixUsernameClicks(rootEl) {
        if (!rootEl || rootEl.nodeType !== 1) return;
        var usernames = rootEl.querySelectorAll ? rootEl.querySelectorAll('.message-username') : [];
        if (rootEl.classList && rootEl.classList.contains('message-username')) {
            usernames = [rootEl];
        }
        usernames.forEach(function (un) {
            if (un.__mentionFixed) return;
            if (un.closest('.message.bot')) return;   /* نتجاوز البوتات */
            un.__mentionFixed = true;

            var name = un.getAttribute('data-name') || un.textContent.replace(' 🤖', '').trim();
            if (!name) return;

            /* نحفظ onclick القديم (لحالة نادرة) */
            var oldOnclick = un.onclick;
            un.onclick = null;

            un.style.cursor = 'pointer';
            un.addEventListener('click', function (e) {
                e.stopPropagation();
                e.preventDefault();
                /* ⭐ منشن بدل بروفايل */
                if (typeof window.insertMention === 'function') {
                    window.insertMention(name);
                } else {
                    /* fallback: نضيف @الاسم في حقل الإدخال */
                    var inp = document.getElementById('message-input');
                    if (inp) {
                        var v = inp.value;
                        var sp = v.length > 0 && !v.endsWith(' ') ? ' ' : '';
                        inp.value = v + sp + '@' + name + ' ';
                        try { inp.focus(); } catch (err) {}
                    }
                }
            });
        });
    }

    /* Observer على الرسائل الجديدة */
    function _installChatObserver() {
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            var container = document.getElementById('messages');
            if (!container) {
                if (attempts >= 40) clearInterval(t);
                return;
            }
            if (container.__mentionWatched) { clearInterval(t); return; }
            container.__mentionWatched = true;

            new MutationObserver(function (muts) {
                muts.forEach(function (m) {
                    m.addedNodes.forEach(function (node) {
                        if (node.nodeType !== 1) return;
                        if (node.classList && node.classList.contains('message')) {
                            setTimeout(function () { _fixUsernameClicks(node); }, 50);
                        }
                    });
                });
            }).observe(container, { childList: true, subtree: false });

            /* نعالج الموجود */
            container.querySelectorAll('.message').forEach(_fixUsernameClicks);

            clearInterval(t);
            console.log('✅ final-fixes: chat usernames → mention');
        }, 500);
    }

    /* ══════════════════════════════════════════════ */
    /* Init                                           */
    /* ══════════════════════════════════════════════ */
    function init() {
        _installPauseCounter();
        _watchViewer();
        _installChatObserver();

        /* نداءات إضافية لضمان الربط */
        setTimeout(_rebindStoryInput, 2000);
        setTimeout(_rebindStoryInput, 4000);
        setTimeout(function () {
            var container = document.getElementById('messages');
            if (container) container.querySelectorAll('.message').forEach(_fixUsernameClicks);
        }, 3000);
        setTimeout(function () {
            var container = document.getElementById('messages');
            if (container) container.querySelectorAll('.message').forEach(_fixUsernameClicks);
        }, 6000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

    console.log('✅ final-fixes.js v1 loaded — pause + video + mention');
})();
