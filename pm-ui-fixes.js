// ==============================================
// pm-ui-fixes.js v1 — إصلاح PM input + الشريط العائم
// ==============================================
// ✅ v1:
//   1. ترتيب PM input مطابق للعام (Send | Emoji | Input | Plus)
//   2. إظهار الشريط العائم في PM
//   3. زر + في PM يفتح الشريط العائم
// ==============================================

(function () {
    'use strict';
    if (window.__pmUiFixesV1) return;
    window.__pmUiFixesV1 = true;

    /* 1. إضافة emoji button + إعادة ترتيب PM input */
    function _rebuildPmInput() {
        var modal = document.getElementById('private-chat-modal');
        if (!modal) return false;
        if (modal.__pmUiFixed) return true;

        var inputContainer = modal.querySelector('.private-chat-input');
        if (!inputContainer) return false;

        /* نجد العناصر */
        var pcInput = document.getElementById('pc-input');
        if (!pcInput) return false;

        var sendBtn = inputContainer.querySelector('button:not(.pm-plus-btn)');
        var plusBtn = inputContainer.querySelector('.pm-plus-btn');

        /* بناء الشريط الجديد */
        inputContainer.innerHTML = '';

        /* 1. Send (paper plane) */
        var newSendBtn = document.createElement('button');
        newSendBtn.type = 'button';
        newSendBtn.className = 'send-btn';
        newSendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
        newSendBtn.onclick = function () { if (typeof sendPrivateMsg === 'function') sendPrivateMsg(); };
        inputContainer.appendChild(newSendBtn);

        /* 2. Emoji */
        var emojiBtn = document.createElement('button');
        emojiBtn.type = 'button';
        emojiBtn.className = 'emoji-btn';
        emojiBtn.innerHTML = '<i class="fas fa-smile"></i>';
        emojiBtn.onclick = function () {
            if (window.MediaPicker && typeof window.MediaPicker.open === 'function') {
                window.MediaPicker.open('private', 'emojis1');
            }
        };
        inputContainer.appendChild(emojiBtn);

        /* 3. Input */
        pcInput.value = pcInput.value || '';
        pcInput.placeholder = 'اكتب رسالتك...';
        pcInput.className = '';
        pcInput.removeAttribute('style');
        inputContainer.appendChild(pcInput);

        /* 4. Plus — يفتح الشريط العائم */
        var newPlusBtn = document.createElement('button');
        newPlusBtn.type = 'button';
        newPlusBtn.className = 'plus-btn';
        newPlusBtn.id = 'pm-plus-btn-v2';
        newPlusBtn.innerHTML = '<i class="fas fa-plus"></i>';
        newPlusBtn.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            /* نفتح الشريط العائم */
            var tb = document.getElementById('floating-toolbar');
            var pb = document.getElementById('plus-btn');
            if (tb) tb.classList.toggle('open');
            if (newPlusBtn) newPlusBtn.classList.toggle('active');
        };
        inputContainer.appendChild(newPlusBtn);

        modal.__pmUiFixed = true;
        console.log('✅ pm-ui-fixes: input rebuilt');
        return true;
    }

    /* 2. إظهار الشريط العائم في PM */
    function _showFloatingToolbarInPM() {
        var pmModal = document.getElementById('private-chat-modal');
        if (!pmModal) return;

        var isPmOpen = pmModal.classList.contains('open');
        if (isPmOpen) {
            /* نجعل الشريط العائم مرئي */
            var tb = document.getElementById('floating-toolbar');
            if (tb) {
                tb.style.display = '';
                /* نجعلها ظاهرة فوق PM */
                tb.style.zIndex = '8500';
            }
            /* تحديث ctx */
            if (window.FloatingToolbar) {
                /* FT.currentCtx داخل ملف الشريط */
            }
        }
    }

    /* 3. مراقبة فتح/إغلاق PM */
    var _pmModal = null;
    var _obs = null;

    function _watchPm() {
        var pm = document.getElementById('private-chat-modal');
        if (!pm) { setTimeout(_watchPm, 1000); return; }
        if (_pmModal === pm) return;
        _pmModal = pm;

        _obs = new MutationObserver(function () {
            var isOpen = pm.classList.contains('open');
            if (isOpen) {
                _rebuildPmInput();
                _showFloatingToolbarInPM();
            } else {
                pm.__pmUiFixed = false;
            }
        });
        _obs.observe(pm, { attributes: true, attributeFilter: ['class'] });

        if (pm.classList.contains('open')) {
            _rebuildPmInput();
            _showFloatingToolbarInPM();
        }
    }

    /* 4. إصلاح CSS */
    (function injectCSS() {
        if (document.getElementById('pm-ui-fixes-css')) return;
        var s = document.createElement('style');
        s.id = 'pm-ui-fixes-css';
        s.textContent = `
/* PM input يطابق العام */
.private-chat-input {
    padding: 6px 10px !important;
    gap: 6px !important;
    display: flex !important;
    align-items: center !important;
}
.private-chat-input .send-btn {
    width: 34px !important;
    height: 34px !important;
    font-size: 14px !important;
    background: #ffd700 !important;
    color: #000 !important;
    border: none !important;
    border-radius: 50% !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex-shrink: 0 !important;
    order: 1 !important;
}
.private-chat-input .emoji-btn {
    width: 30px !important;
    height: 30px !important;
    font-size: 16px !important;
    background: transparent !important;
    color: var(--text-dim) !important;
    border: none !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex-shrink: 0 !important;
    order: 2 !important;
}
.private-chat-input .emoji-btn:hover { color: #ffd700 !important; }
.private-chat-input #pc-input {
    order: 3 !important;
    flex: 1 !important;
    padding: 8px 14px !important;
    font-size: 13px !important;
    border-radius: 20px !important;
    background: rgba(255,255,255,0.06) !important;
    border: 1px solid rgba(255,215,0,0.25) !important;
    color: #fff !important;
    outline: none !important;
    text-align: right !important;
    box-sizing: border-box !important;
}
.private-chat-input .plus-btn {
    order: 4 !important;
    width: 30px !important;
    height: 30px !important;
    font-size: 16px !important;
    background: transparent !important;
    color: #ffd700 !important;
    border: none !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex-shrink: 0 !important;
    padding: 0 !important;
}
.private-chat-input .plus-btn.active {
    transform: rotate(45deg) !important;
    color: #ff4444 !important;
}

/* إخفاء الشريط القديم للـ PM */
.pm-toolbar { display: none !important; }
.pm-plus-btn { display: none !important; }

/* الشريط العائم في PM */
body.pm-open #floating-toolbar.open {
    bottom: calc(50vh + 8px) !important;
    left: 12px !important;
    right: 12px !important;
    z-index: 8500 !important;
    display: flex !important;
}
        `;
        document.head.appendChild(s);
    })();

    /* 5. أيضاً إظهار الشريط العائم في PM عند فتحه */
    document.addEventListener('click', function (e) {
        var pm = document.getElementById('private-chat-modal');
        if (pm && pm.classList.contains('open')) {
            setTimeout(_rebuildPmInput, 100);
            setTimeout(_showFloatingToolbarInPM, 200);
        }
    }, true);

    function init() {
        _watchPm();
        setTimeout(_watchPm, 2000);
        setTimeout(_rebuildPmInput, 3000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

    console.log('✅ pm-ui-fixes.js v1 loaded');
})();
