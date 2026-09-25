// ==============================================
// floating-toolbar-v2.js v2 (TEST) — يرافق الكيبورد + PM
// ==============================================
// ✅ v2 (جديد كلياً — يستبدل v1 القديم):
//   1. يرافق الكيبورد (bottom يتحرك تلقائياً)
//   2. يعمل في العام + الخاص (context-aware)
//   3. أزرار: ملفات، موسيقى، نرد، يوتيوب، رسام، نص مميز، إيموجي
//   4. يعتمد على: MediaPicker, PaintTool, StyledMessages, rollDice, searchYouTube
//   5. Responsive (mobile-first)
//   6. يتكامل مع chat.js toggleToolbar الحالي (لا يكسر شي)
//   7. يحترم حالة الزائر (يخفي أزرار محظورة)
// ==============================================

(function () {
    'use strict';
    if (window.__floatingToolbarV2) return;
    window.__floatingToolbarV2 = true;

    /* ══════════════════════════════════════════════ */
    /* Config                                         */
    /* ══════════════════════════════════════════════ */
    var TOOLBAR_ID = 'floating-toolbar';
    var PLUS_BTN_ID = 'plus-btn';
    var KEYBOARD_THRESHOLD_PX = 150;

    /* ══════════════════════════════════════════════ */
    /* State                                          */
    /* ══════════════════════════════════════════════ */
    var FT = {
        initialized: false,
        baseBottom: 100,        // القيمة الافتراضية
        keyboardOpen: false,
        currentCtx: 'general',  // 'general' | 'private'
        observer: null,
        pmObserver: null,
        vvListener: null
    };

    /* ══════════════════════════════════════════════ */
    /* Helpers                                        */
    /* ══════════════════════════════════════════════ */
    function toast(icon, msg) {
        if (typeof showToast === 'function') showToast(icon, msg);
        else console.log('[FloatingToolbar]', msg);
    }

    function getMe() {
        try {
            if (typeof getCurrentUser === 'function') return getCurrentUser();
        } catch (e) {}
        try {
            return JSON.parse(localStorage.getItem('qamar_current_user') || localStorage.getItem('qamar_user') || 'null');
        } catch (e) { return null; }
    }

    function iAmGuest() {
        var u = getMe();
        return !!(u && u.isGuest === true);
    }

    function isPmOpen() {
        var m = document.getElementById('private-chat-modal');
        return !!(m && m.classList.contains('open'));
    }

    function _safeCall(fnName, fallbackMsg) {
        var fn = window[fnName];
        if (typeof fn === 'function') {
            try {
                fn();
            } catch (e) {
                console.error('[FloatingToolbar] ' + fnName + ' failed:', e);
                toast('fa-times', '⚠️ فشل التنفيذ');
            }
        } else {
            toast('fa-info-circle', fallbackMsg || '⚠️ غير متوفر');
        }
    }

    /* ══════════════════════════════════════════════ */
    /* CSS                                            */
    /* ══════════════════════════════════════════════ */
    (function injectCSS() {
        if (document.getElementById('floating-toolbar-v2-css')) return;
        var s = document.createElement('style');
        s.id = 'floating-toolbar-v2-css';
        s.textContent = `
/* ═══ التولبار الأساسي ═══ */
#floating-toolbar {
    position: fixed !important;
    left: 12px !important;
    right: 12px !important;
    bottom: var(--ft-bottom, 100px) !important;
    padding: 10px 12px !important;
    border-radius: 20px !important;
    display: none !important;
    justify-content: space-around !important;
    align-items: center !important;
    gap: 6px !important;
    z-index: 9500 !important;
    background: rgba(5, 5, 12, 0.92) !important;
    border: 1px solid rgba(255, 215, 0, 0.45) !important;
    backdrop-filter: blur(14px) !important;
    -webkit-backdrop-filter: blur(14px) !important;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 215, 0, 0.15) !important;
    transition: bottom 0.22s ease, transform 0.15s ease !important;
    direction: rtl !important;
}
#floating-toolbar.open { display: flex !important; }

/* ═══ زر الأداة ═══ */
#floating-toolbar .tool-btn {
    flex: 1 1 0;
    min-width: 0;
    max-width: 64px;
    height: 52px !important;
    border-radius: 14px !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    background: rgba(255, 255, 255, 0.04) !important;
    color: #fff !important;
    cursor: pointer !important;
    font-size: 20px !important;
    font-weight: 900 !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 2px !important;
    padding: 4px 2px !important;
    transition: all 0.15s ease !important;
    position: relative !important;
    font-family: inherit !important;
}
#floating-toolbar .tool-btn:active {
    transform: scale(0.92) !important;
}
#floating-toolbar .tool-btn:hover {
    background: rgba(255, 215, 0, 0.12) !important;
    border-color: rgba(255, 215, 0, 0.45) !important;
}
#floating-toolbar .tool-btn .ft-label {
    font-size: 9px !important;
    font-weight: 700 !important;
    color: #aaa !important;
    letter-spacing: 0 !important;
    line-height: 1 !important;
    white-space: nowrap !important;
}
#floating-toolbar .tool-btn:hover .ft-label {
    color: #ffd700 !important;
}
#floating-toolbar .tool-btn > i,
#floating-toolbar .tool-btn > span.ft-icon {
    font-size: 20px !important;
    line-height: 1 !important;
}

/* ═══ أزرار محظورة للزوار ═══ */
#floating-toolbar .tool-btn.ft-blocked {
    opacity: 0.35 !important;
    position: relative !important;
}
#floating-toolbar .tool-btn.ft-blocked::after {
    content: '🕵️';
    position: absolute;
    top: 2px;
    right: 2px;
    font-size: 10px;
    line-height: 1;
}

/* ═══ زر + (plus-btn) يبقى في مكانه ═══ */
#plus-btn {
    transition: transform 0.2s ease !important;
}
#plus-btn.active {
    transform: rotate(45deg) !important;
    color: #ff4444 !important;
}

/* ═══ Positioning — keyboard-aware ═══ */
body.keyboard-open #floating-toolbar.open {
    --ft-bottom: 70px;
}
body.pm-open #floating-toolbar.open {
    --ft-bottom: calc(50vh + 8px);
}
body.pm-open.keyboard-open #floating-toolbar.open {
    --ft-bottom: calc(50vh + 8px);
}

/* ═══ Placeholder للشريط القديم إن وُجد ═══ */
.floating-toolbar-legacy {
    display: none !important;
}

/* ═══ Responsive ═══ */
@media (max-width: 480px) {
    #floating-toolbar {
        padding: 8px 8px !important;
        gap: 4px !important;
        border-radius: 16px !important;
    }
    #floating-toolbar .tool-btn {
        height: 46px !important;
        font-size: 17px !important;
        border-radius: 12px !important;
    }
    #floating-toolbar .tool-btn .ft-label {
        font-size: 8px !important;
    }
    #floating-toolbar .tool-btn > i {
        font-size: 17px !important;
    }
}

@media (max-width: 360px) {
    #floating-toolbar {
        padding: 6px 6px !important;
        gap: 3px !important;
    }
    #floating-toolbar .tool-btn {
        height: 42px !important;
        font-size: 15px !important;
    }
    #floating-toolbar .tool-btn .ft-label {
        display: none !important;
    }
}

/* ═══ ألوان مميزة لأزرار جديدة ═══ */
#floating-toolbar .tool-btn[data-action="paint"]:hover {
    background: rgba(168, 85, 247, 0.15) !important;
    border-color: rgba(168, 85, 247, 0.6) !important;
}
#floating-toolbar .tool-btn[data-action="styled"]:hover {
    background: rgba(255, 105, 180, 0.15) !important;
    border-color: rgba(255, 105, 180, 0.6) !important;
}
#floating-toolbar .tool-btn[data-action="youtube"]:hover {
    background: rgba(255, 0, 0, 0.15) !important;
    border-color: rgba(255, 0, 0, 0.6) !important;
}
#floating-toolbar .tool-btn[data-action="dice"]:hover {
    background: rgba(255, 215, 0, 0.15) !important;
    border-color: rgba(255, 215, 0, 0.6) !important;
}
#floating-toolbar .tool-btn[data-action="emoji"]:hover {
    background: rgba(255, 200, 0, 0.15) !important;
    border-color: rgba(255, 200, 0, 0.6) !important;
}
        `;
        document.head.appendChild(s);
    })();

    /* ══════════════════════════════════════════════ */
    /* Build Toolbar content                          */
    /* ══════════════════════════════════════════════ */
    function _buildToolbarContent() {
        var tb = document.getElementById(TOOLBAR_ID);
        if (!tb) return;

        // ⭐ تجنّب التكرار
        if (tb.getAttribute('data-v2') === '1') return;
        tb.setAttribute('data-v2', '1');

        // ⭐ احذف الأزرار القديمة
        tb.innerHTML = '';

        var isGuest = iAmGuest();

        // ⭐ قائمة الأزرار
        var tools = [
            {
                action: 'files',
                icon: '📁',
                label: 'ملفات',
                guestBlocked: true,
                handler: function () { _openFiles(); }
            },
            {
                action: 'emoji',
                icon: '😀',
                label: 'إيموجي',
                guestBlocked: false,
                handler: function () { _openEmoji(); }
            },
            {
                action: 'music',
                icon: '🎵',
                label: 'صوتيات',
                guestBlocked: true,
                handler: function () { _openAudio(); }
            },
            {
                action: 'paint',
                icon: '🎨',
                label: 'رسام',
                guestBlocked: true,
                handler: function () { _openPaint(); }
            },
            {
                action: 'styled',
                icon: '✨',
                label: 'نص مميز',
                guestBlocked: true,
                handler: function () { _openStyled(); }
            },
            {
                action: 'youtube',
                icon: '▶️',
                label: 'يوتيوب',
                guestBlocked: false,
                handler: function () { _openYouTube(); }
            },
            {
                action: 'dice',
                icon: '🎲',
                label: 'نرد',
                guestBlocked: true,
                handler: function () { _rollDice(); }
            }
        ];

        tools.forEach(function (t) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tool-btn';
            btn.setAttribute('data-action', t.action);
            if (isGuest && t.guestBlocked) btn.classList.add('ft-blocked');
            btn.title = t.label;

            var icon = document.createElement('span');
            icon.className = 'ft-icon';
            icon.textContent = t.icon;
            btn.appendChild(icon);

            var lbl = document.createElement('span');
            lbl.className = 'ft-label';
            lbl.textContent = t.label;
            btn.appendChild(lbl);

            btn.onclick = function (e) {
                e.preventDefault();
                e.stopPropagation();

                // ⭐ تحقق من الزائر
                if (isGuest && t.guestBlocked) {
                    toast('fa-user-secret', '🕵️ هذه الميزة للأعضاء فقط');
                    return;
                }

                // ⭐ حدّد السياق الحالي
                FT.currentCtx = isPmOpen() ? 'private' : 'general';

                // ⭐ نفّذ
                try {
                    t.handler();
                } catch (err) {
                    console.error('[FloatingToolbar] handler error:', err);
                    toast('fa-times', '⚠️ فشل');
                }
            };

            tb.appendChild(btn);
        });

        console.log('🎛️ FloatingToolbar v2: ' + tools.length + ' tools built' + (isGuest ? ' (guest mode)' : ''));
    }

    /* ══════════════════════════════════════════════ */
    /* Tool handlers                                  */
    /* ══════════════════════════════════════════════ */
    function _closeToolbarFirst() {
        var tb = document.getElementById(TOOLBAR_ID);
        if (tb) tb.classList.remove('open');
        var pb = document.getElementById(PLUS_BTN_ID);
        if (pb) pb.classList.remove('active');
    }

    function _openFiles() {
        _closeToolbarFirst();
        // ⭐ يفتح MediaPicker (وسائط من جهاز أو إيموجي)
        if (window.MediaPicker && typeof window.MediaPicker.open === 'function') {
            window.MediaPicker.open(FT.currentCtx);
        } else {
            toast('fa-info-circle', '📁 قريباً');
        }
    }

    function _openEmoji() {
        _closeToolbarFirst();
        // ⭐ إيموجي — يستخدم MediaPicker.open
        if (window.MediaPicker && typeof window.MediaPicker.open === 'function') {
            window.MediaPicker.open(FT.currentCtx);
        } else if (typeof window.insertEmoji === 'function') {
            window.insertEmoji();
        } else {
            toast('fa-info-circle', '😀 قريباً');
        }
    }

    function _openAudio() {
        _closeToolbarFirst();
        // ⭐ صوتيات: نفتح MediaPicker (يبقى الخيار الأقرب)
        // أو في المستقبل: مصمم صوتيات
        if (window.MediaPicker && typeof window.MediaPicker.open === 'function') {
            window.MediaPicker.open(FT.currentCtx);
            toast('fa-info-circle', '🎵 اختر ملف صوتي من الملفات');
        } else {
            toast('fa-info-circle', '🎵 قريباً');
        }
    }

    function _openPaint() {
        _closeToolbarFirst();
        if (window.PaintTool && typeof window.PaintTool.open === 'function') {
            window.PaintTool.open(FT.currentCtx);
        } else {
            toast('fa-times', '⚠️ الرسام غير محمّل');
        }
    }

    function _openStyled() {
        _closeToolbarFirst();
        if (window.StyledMessages && typeof window.StyledMessages.open === 'function') {
            window.StyledMessages.open(FT.currentCtx);
        } else {
            toast('fa-times', '⚠️ الرسائل المميزة غير محمّلة');
        }
    }

    function _openYouTube() {
        _closeToolbarFirst();
        // ⭐ نستدعي searchYouTube (اللي يعمل override على نفسه)
        if (typeof window.searchYouTube === 'function') {
            window.searchYouTube();
        } else {
            toast('fa-info-circle', '📺 قريباً');
        }
    }

    function _rollDice() {
        _closeToolbarFirst();
        if (typeof window.rollDice === 'function') {
            window.rollDice();
        } else {
            toast('fa-info-circle', '🎲 قريباً');
        }
    }

    /* ══════════════════════════════════════════════ */
    /* Keyboard-aware positioning                     */
    /* ══════════════════════════════════════════════ */
    function _setupKeyboardPositioning() {
        if (!window.visualViewport) return;
        if (FT.vvListener) return;
        FT.vvListener = true;

        var initialHeight = window.visualViewport.height;

        var onResize = function () {
            var kbHeight = initialHeight - window.visualViewport.height;
            if (kbHeight > KEYBOARD_THRESHOLD_PX) {
                FT.keyboardOpen = true;
                document.body.classList.add('keyboard-open');
            } else {
                FT.keyboardOpen = false;
                document.body.classList.remove('keyboard-open');
            }
        };

        window.visualViewport.addEventListener('resize', onResize);
        window.visualViewport.addEventListener('scroll', onResize);

        // ⭐ تحديث initialHeight عند تغيير الاتجاه
        window.addEventListener('orientationchange', function () {
            setTimeout(function () {
                initialHeight = window.visualViewport.height;
            }, 400);
        });
    }

    /* ══════════════════════════════════════════════ */
    /* Hook into toggleToolbar                        */
    /* ══════════════════════════════════════════════ */
    function _hookToggleToolbar() {
        var origToggle = window.toggleToolbar;
        if (typeof origToggle !== 'function') {
            console.warn('[FloatingToolbar] toggleToolbar غير موجود — ننتظر');
            return false;
        }
        if (origToggle.__ftV2Wrapped) return true;

        var wrapped = function () {
            var tb = document.getElementById(TOOLBAR_ID);
            var pb = document.getElementById(PLUS_BTN_ID);
            if (tb) tb.classList.toggle('open');
            if (pb) pb.classList.toggle('active');
        };
        wrapped.__ftV2Wrapped = true;
        window.toggleToolbar = wrapped;
        console.log('🎛️ FloatingToolbar v2: toggleToolbar hooked');
        return true;
    }

    /* ══════════════════════════════════════════════ */
    /* Observe PM open/close                          */
    /* ══════════════════════════════════════════════ */
    function _setupPmObserver() {
        var pm = document.getElementById('private-chat-modal');
        if (!pm) {
            setTimeout(_setupPmObserver, 1000);
            return;
        }
        if (FT.pmObserver) return;

        FT.pmObserver = new MutationObserver(function () {
            var isOpen = pm.classList.contains('open');
            FT.currentCtx = isOpen ? 'private' : 'general';
            // ⭐ أغلق الشريط عند فتح/إغلاق PM لتجنب الفوضى
            var tb = document.getElementById(TOOLBAR_ID);
            if (tb) tb.classList.remove('open');
            var pb = document.getElementById(PLUS_BTN_ID);
            if (pb) pb.classList.remove('active');
        });
        FT.pmObserver.observe(pm, { attributes: true, attributeFilter: ['class'] });
    }

    /* ══════════════════════════════════════════════ */
    /* Observer على DOM لإنشاء الشريط                 */
    /* ══════════════════════════════════════════════ */
    function _setupToolbarObserver() {
        var tb = document.getElementById(TOOLBAR_ID);
        if (tb) {
            _buildToolbarContent();
            return;
        }
        // ننتظر
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            var t2 = document.getElementById(TOOLBAR_ID);
            if (t2) {
                clearInterval(t);
                _buildToolbarContent();
            }
            if (attempts >= 40) clearInterval(t);
        }, 250);
    }

    /* ══════════════════════════════════════════════ */
    /* Init                                           */
    /* ══════════════════════════════════════════════ */
    function init() {
        if (FT.initialized) return;
        FT.initialized = true;

        _setupToolbarObserver();
        _setupKeyboardPositioning();
        _setupPmObserver();

        // ⭐ hook toggleToolbar
        var hooked = _hookToggleToolbar();
        if (!hooked) {
            var attempts = 0;
            var t = setInterval(function () {
                attempts++;
                if (_hookToggleToolbar()) clearInterval(t);
                if (attempts >= 20) clearInterval(t);
            }, 300);
        }

        // ⭐ أضف console log
        console.log('🎛️ floating-toolbar-v2.js: initialized');
    }

    /* ══════════════════════════════════════════════ */
    /* Public API                                     */
    /* ══════════════════════════════════════════════ */
    window.FloatingToolbar = {
        rebuild: function () {
            var tb = document.getElementById(TOOLBAR_ID);
            if (tb) tb.removeAttribute('data-v2');
            _buildToolbarContent();
        },
        close: _closeToolbarFirst,
        version: 2
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('🎛️ floating-toolbar-v2.js v2 (TEST) loaded — keyboard-aware + PM + 7 tools');
})();
