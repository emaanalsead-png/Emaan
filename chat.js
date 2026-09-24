/* ==============================================
   chat-ui.css v1 — إصلاحات الواجهة
   ============================================== */
/* ✅ v1:
   1. شريط الكتابة شفاف (يأخذ خلفية الشات)
   2. القوائم الجانبية تغطي الشريط السفلي + العلوي
   3. الشريط السفلي يختفي فقط مع الكيبورد + يرجع تلقائياً
   4. الشريط العائم يرافق الكيبورد في العام + الخاص
   5. رسائل الشات شفافة (تأخذ خلفية الشات)
============================================== */

/* ═══ 1. شريط الكتابة — بدون خلفية ═══ */
.input-area {
    background: transparent !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    box-shadow: none !important;
    border-top: 1px solid rgba(255, 215, 0, 0.35) !important;
}

.input-area input[type="text"] {
    background: rgba(255, 255, 255, 0.06) !important;
    border: 1px solid rgba(255, 215, 0, 0.25) !important;
    backdrop-filter: blur(10px) !important;
    -webkit-backdrop-filter: blur(10px) !important;
}

.private-chat-input {
    background: transparent !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    box-shadow: none !important;
    border-top: 1px solid rgba(255, 215, 0, 0.35) !important;
}

/* ═══ 2. القوائم الجانبية — تغطي الشريطين العلوي والسفلي ═══ */
.sidebar {
    z-index: 500 !important;
    height: 100vh !important;
    height: 100dvh !important;
    top: 0 !important;
    bottom: 0 !important;
}

.sidebar.right-sidebar {
    right: 0 !important;
    left: auto !important;
}

.sidebar.left-sidebar {
    left: 0 !important;
    right: auto !important;
}

.overlay {
    z-index: 450 !important;
}

body.pm-open .private-chat-modal {
    z-index: 8500 !important;
}

/* ═══ 3. الشريط السفلي — يختفي فقط مع الكيبورد ═══ */
.bottom-nav {
    transition: transform 0.22s ease, opacity 0.22s ease !important;
}

body.keyboard-open .bottom-nav {
    transform: translateY(110%) !important;
    opacity: 0 !important;
    pointer-events: none !important;
}

body:not(.keyboard-open) .bottom-nav {
    transform: translateY(0) !important;
    opacity: 1 !important;
    pointer-events: auto !important;
}

body.keyboard-open .mics-bar-wrapper {
    transform: translateY(110%) !important;
    opacity: 0 !important;
    pointer-events: none !important;
}

body:not(.keyboard-open) .mics-bar-wrapper {
    transform: translateY(0) !important;
    opacity: 1 !important;
    pointer-events: auto !important;
}

/* ═══ 4. الشريط العائم — يرافق الكيبورد في العام والخاص ═══ */
.floating-toolbar {
    position: fixed !important;
    bottom: 100px !important;
    left: 12px !important;
    right: 12px !important;
    padding: 12px !important;
    border-radius: 20px !important;
    display: none !important;
    justify-content: space-around !important;
    gap: 10px !important;
    z-index: 9500 !important;
    background: rgba(5, 5, 12, 0.88) !important;
    border: 1px solid rgba(255, 215, 0, 0.4) !important;
    backdrop-filter: blur(14px) !important;
    -webkit-backdrop-filter: blur(14px) !important;
    transition: bottom 0.22s ease !important;
}

.floating-toolbar.open {
    display: flex !important;
}

body.keyboard-open .floating-toolbar.open {
    bottom: 70px !important;
    display: flex !important;
}

/* نفس الشي في الخاص */
body.pm-open .floating-toolbar.open {
    bottom: 50vh !important;
    left: 12px !important;
    right: 12px !important;
}

body.pm-open.keyboard-open .floating-toolbar.open {
    bottom: calc(50vh + 60px) !important;
}

/* ═══ 5. الرسائل — شفافة تأخذ خلفية الشات ═══ */
.message:not(.system):not(.bot):not(.hidden-message-king) {
    background: rgba(5, 5, 12, 0.18) !important;
    backdrop-filter: blur(4px) !important;
    -webkit-backdrop-filter: blur(4px) !important;
    border: 1px solid rgba(255, 215, 0, 0.08) !important;
}

/* ═══ 6. زر + في شريط الكتابة ═══ */
.input-area .plus-btn {
    color: #ffd700 !important;
}

.input-area .plus-btn.active {
    transform: rotate(45deg) !important;
    color: #ff4444 !important;
}

.private-chat-input .pm-plus-btn {
    color: #ffd700 !important;
}

/* ═══ 7. Responsive ═══ */
@media (max-width: 480px) {
    .floating-toolbar {
        bottom: 90px !important;
        padding: 10px !important;
        gap: 6px !important;
    }
    body.keyboard-open .floating-toolbar.open {
        bottom: 60px !important;
    }
    body.pm-open .floating-toolbar.open {
        bottom: 50vh !important;
    }
    body.pm-open.keyboard-open .floating-toolbar.open {
        bottom: calc(50vh + 50px) !important;
    }
}

@media (max-width: 360px) {
    .floating-toolbar {
        padding: 8px !important;
        gap: 4px !important;
    }
}

/* ═══ 8. منع وميض الانتقال عند تحميل الصفحة ═══ */
html.preload-transition * {
    transition: none !important;
}
