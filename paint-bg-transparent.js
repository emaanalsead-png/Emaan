// ==============================================
// paint-bg-transparent.js v1 — خلفية الرسام شفافة
// ==============================================

(function () {
    'use strict';
    if (window.__paintBgTransV1) return;
    window.__paintBgTransV1 = true;

    function injectCSS() {
        var old = document.getElementById('paint-bg-transparent-css');
        if (old) old.remove();

        var s = document.createElement('style');
        s.id = 'paint-bg-transparent-css';
        s.textContent = `
/* Overlay نفسه شفاف */
#paint-overlay {
    background: rgba(0,0,0,0.35) !important;
    backdrop-filter: blur(3px) !important;
    -webkit-backdrop-filter: blur(3px) !important;
}

/* جسم الرسام شفاف تماماً */
#paint-body {
    background: transparent !important;
    background-image: none !important;
    background-color: transparent !important;
}

/* الـ wrap شفاف — بس إطار خفيف */
#paint-canvas-wrap {
    background: transparent !important;
    background-image: none !important;
    background-color: transparent !important;
    border: 1px dashed rgba(255,215,0,0.55) !important;
    box-shadow: 0 0 30px rgba(0,0,0,0.4) !important;
}

/* الكانفس نفسه شفاف */
#paint-canvas-wrap canvas,
#paint-canvas-wrap .canvas-container,
#paint-canvas-wrap .upper-canvas,
#paint-canvas-wrap .lower-canvas {
    background: transparent !important;
    background-color: transparent !important;
}
        `;
        document.head.appendChild(s);
    }

    injectCSS();
    setTimeout(injectCSS, 500);
    setTimeout(injectCSS, 2000);
    setTimeout(injectCSS, 5000);

    console.log('✅ paint-bg-transparent.js loaded');
})();
