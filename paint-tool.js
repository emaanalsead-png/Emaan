// ==============================================
// paint-tool.js v2 (TEST) — الرسام (Fabric.js) مُصلَّح
// ==============================================
// ✅ v2 (فوق v1):
//   1. إصلاح canvas creation (BUG: العنصر غير موجود في DOM)
//   2. إصلاح touch events (الإصبع يرسم)
//   3. استبدال prompt() بـ input overlay مدمج
//   4. touch-action: none programmatically
//   5. نوافذ تأكيد داخلية بدل confirm()
// ✅ v1 (محفوظ):
//   1. Fabric.js lazy-loaded من CDN
//   2. أدوات: فرشاة، ممحاة، خط، مستطيل، دائرة، نص
//   3. ألوان + سماكة + undo/redo + مسح
//   4. خلفية: شفافة (PNG) أو لون (JPEG)
//   5. إرسال للعام + الخاص (context-aware)
//   6. Token: [paint:URL]
// ==============================================

(function () {
    'use strict';
    if (window.__paintToolV2) return;
    window.__paintToolV2 = true;

    /* ══════════════════════════════════════════════ */
    /* Config                                         */
    /* ══════════════════════════════════════════════ */
    var FABRIC_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js';
    var FABRIC_LOAD_TIMEOUT_MS = 12000;
    var MAX_CANVAS_SIZE = 720;

    /* ══════════════════════════════════════════════ */
    /* State                                          */
    /* ══════════════════════════════════════════════ */
    var PT = {
        fabricReady: false,
        fabricPromise: null,
        canvas: null,
        overlay: null,
        ctx: 'general',
        tool: 'brush',
        color: '#000000',
        bgColor: 'transparent',
        thickness: 6,
        _history: [],
        _historyIndex: -1,
        _maxHistory: 30,
        _drawing: false,
        _currentShape: null,
        _startX: 0,
        _startY: 0,
        _processed: new WeakSet(),
        _sending: false,
        _pendingTextPos: null
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

    function toast(icon, msg) {
        if (typeof showToast === 'function') showToast(icon, msg);
        else console.log('[Paint]', msg);
    }

    /* ══════════════════════════════════════════════ */
    /* Fabric.js lazy loader                          */
    /* ══════════════════════════════════════════════ */
    function loadFabric() {
        if (PT.fabricReady && window.fabric) return Promise.resolve();
        if (PT.fabricPromise) return PT.fabricPromise;

        PT.fabricPromise = new Promise(function (resolve, reject) {
            if (window.fabric) {
                PT.fabricReady = true;
                resolve();
                return;
            }
            var s = document.createElement('script');
            s.src = FABRIC_CDN;
            s.async = true;
            var timeout = setTimeout(function () {
                reject(new Error('Fabric.js load timeout'));
            }, FABRIC_LOAD_TIMEOUT_MS);
            s.onload = function () {
                clearTimeout(timeout);
                if (window.fabric) {
                    PT.fabricReady = true;
                    console.log('🎨 Fabric.js loaded');
                    resolve();
                } else {
                    reject(new Error('Fabric.js لم يحمّل'));
                }
            };
            s.onerror = function () {
                clearTimeout(timeout);
                reject(new Error('فشل تحميل Fabric.js'));
            };
            document.head.appendChild(s);
        });
        return PT.fabricPromise;
    }

    /* ══════════════════════════════════════════════ */
    /* CSS                                            */
    /* ══════════════════════════════════════════════ */
    (function injectCSS() {
        if (document.getElementById('paint-tool-css-v2')) return;
        var s = document.createElement('style');
        s.id = 'paint-tool-css-v2';
        s.textContent = `
#paint-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.96);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    z-index: 1000020;
    display: none;
    flex-direction: column;
    direction: rtl;
    font-family: Cairo, sans-serif;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    touch-action: none;
}
#paint-overlay.active { display: flex; }

/* ═══ Header ═══ */
#paint-header {
    height: 50px;
    background: rgba(10,10,20,0.98);
    border-bottom: 1px solid rgba(255,215,0,0.4);
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 10px;
    gap: 8px;
    flex-shrink: 0;
}
#paint-title {
    color: #ffd700;
    font-size: 14px;
    font-weight: 900;
    display: flex;
    align-items: center;
    gap: 6px;
}
.paint-header-btn {
    height: 36px;
    padding: 0 14px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.2);
    background: rgba(255,255,255,0.05);
    color: #fff;
    font-family: inherit;
    font-size: 12px;
    font-weight: 900;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
}
.paint-header-btn:active { transform: scale(0.96); }
.paint-header-btn.save {
    background: linear-gradient(135deg, #84cc16, #65a30d);
    border-color: #a3e635;
    color: #fff;
}
.paint-header-btn.save:disabled {
    opacity: 0.6;
    cursor: wait;
}
.paint-header-btn.close {
    background: rgba(255,68,68,0.2);
    border-color: rgba(255,68,68,0.5);
    color: #ff8888;
    padding: 0 10px;
}

/* ═══ Body (canvas) ═══ */
#paint-body {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    padding: 8px;
    position: relative;
    background:
        linear-gradient(45deg, #1a1a2e 25%, transparent 25%),
        linear-gradient(-45deg, #1a1a2e 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #1a1a2e 75%),
        linear-gradient(-45deg, transparent 75%, #1a1a2e 75%);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
    background-color: #0a0a15;
    touch-action: none;
}
#paint-canvas-wrap {
    position: relative;
    background: transparent;
    border: 2px solid rgba(255,215,0,0.4);
    border-radius: 8px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.7);
    max-width: 100%;
    max-height: 100%;
    touch-action: none;
    background-image:
        linear-gradient(45deg, #2a2a3e 25%, transparent 25%),
        linear-gradient(-45deg, #2a2a3e 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #2a2a3e 75%),
        linear-gradient(-45deg, transparent 75%, #2a2a3e 75%);
    background-size: 16px 16px;
    background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}
#paint-canvas-wrap canvas {
    display: block !important;
    border-radius: 6px;
    touch-action: none !important;
    max-width: 100%;
    height: auto;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
}
#paint-canvas-wrap .canvas-container {
    touch-action: none !important;
    max-width: 100% !important;
    max-height: 100% !important;
}

/* ═══ Toolbar ═══ */
#paint-toolbar {
    background: rgba(10,10,20,0.98);
    border-top: 1px solid rgba(255,215,0,0.4);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-shrink: 0;
    max-height: 46vh;
    overflow-y: auto;
}
.paint-row {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
}

/* ═══ أزرار الأدوات ═══ */
.paint-tool-btn {
    min-width: 48px;
    height: 48px;
    padding: 0 12px;
    border-radius: 12px;
    border: 1px solid rgba(255,215,0,0.3);
    background: rgba(255,255,255,0.05);
    color: #fff;
    font-family: inherit;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    flex-shrink: 0;
    position: relative;
    transition: all 0.15s;
    touch-action: manipulation;
}
.paint-tool-btn:active { transform: scale(0.94); }
.paint-tool-btn.active {
    background: linear-gradient(135deg, #ffd700, #d4af37);
    color: #000;
    border-color: #ffd700;
    box-shadow: 0 0 12px rgba(255,215,0,0.5);
}
.paint-tool-btn.small {
    min-width: 40px;
    height: 40px;
    padding: 0 10px;
    font-size: 15px;
}
.paint-tool-btn.danger {
    border-color: rgba(255,68,68,0.5);
    color: #ff8888;
}
.paint-tool-btn.danger:active { background: rgba(255,68,68,0.2); }

.paint-tool-label {
    color: #aaa;
    font-size: 11px;
    font-weight: 900;
    min-width: 60px;
    padding: 0 6px;
}

/* ═══ الألوان ═══ */
.paint-color-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.2);
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    transition: all 0.15s;
    touch-action: manipulation;
}
.paint-color-btn:active { transform: scale(1.15); }
.paint-color-btn.active {
    border-color: #fff;
    transform: scale(1.2);
    box-shadow: 0 0 10px rgba(255,255,255,0.6);
}

/* ═══ السماكة ═══ */
#paint-thickness {
    flex: 1;
    min-width: 120px;
    height: 6px;
    border-radius: 3px;
    background: rgba(255,255,255,0.1);
    outline: none;
    -webkit-appearance: none;
    appearance: none;
    touch-action: manipulation;
}
#paint-thickness::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #ffd700;
    cursor: pointer;
    border: 2px solid #000;
}
#paint-thickness::-moz-range-thumb {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #ffd700;
    cursor: pointer;
    border: 2px solid #000;
}
#paint-thickness-val {
    color: #ffd700;
    font-size: 12px;
    font-weight: 900;
    min-width: 30px;
    text-align: center;
}

/* ═══ خلفية ═══ */
#paint-bg-custom {
    width: 36px;
    height: 36px;
    padding: 0;
    border: 2px solid rgba(255,255,255,0.3);
    border-radius: 8px;
    cursor: pointer;
    background: transparent;
    flex-shrink: 0;
}

/* ═══ Loading ═══ */
#paint-loading {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: rgba(0,0,0,0.85);
    z-index: 10;
    gap: 14px;
    color: #ffd700;
    font-weight: 900;
    font-size: 14px;
}
#paint-loading .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255,215,0,0.2);
    border-top-color: #ffd700;
    border-radius: 50%;
    animation: paintSpin 1s linear infinite;
}
@keyframes paintSpin { to { transform: rotate(360deg); } }

/* ═══ Text Input Modal ═══ */
#paint-text-modal {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.88);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    z-index: 1000050;
    display: none;
    justify-content: center;
    align-items: center;
    padding: 20px;
    direction: rtl;
    font-family: Cairo, sans-serif;
}
#paint-text-modal.active { display: flex; }
#paint-text-box {
    background: #0a0616;
    border: 2px solid #ffd700;
    border-radius: 16px;
    padding: 20px;
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.9), 0 0 40px rgba(255,215,0,0.3);
}
#paint-text-title {
    color: #ffd700;
    font-size: 16px;
    font-weight: 900;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}
#paint-text-input {
    width: 100%;
    min-height: 60px;
    max-height: 150px;
    padding: 12px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,215,0,0.4);
    border-radius: 10px;
    color: #fff;
    font-family: inherit;
    font-size: 16px;
    outline: none;
    text-align: right;
    resize: vertical;
    box-sizing: border-box;
    line-height: 1.5;
}
#paint-text-input:focus { border-color: #ffd700; }
#paint-text-actions {
    display: flex;
    gap: 8px;
}
#paint-text-actions button {
    flex: 1;
    padding: 12px;
    border-radius: 10px;
    border: none;
    font-family: inherit;
    font-size: 14px;
    font-weight: 900;
    cursor: pointer;
}
#paint-text-confirm {
    background: linear-gradient(135deg, #84cc16, #65a30d);
    color: #fff;
}
#paint-text-confirm:active { transform: scale(0.97); }
#paint-text-cancel {
    background: rgba(255,255,255,0.08);
    color: #fff;
    border: 1px solid rgba(255,215,0,0.2);
}

/* ═══ Card في الشات [paint:URL] ═══ */
.paint-msg-card {
    display: block;
    max-width: 280px;
    margin-top: 6px;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid rgba(255,215,0,0.4);
    background: #0a0a15;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.15s;
    position: relative;
}
.paint-msg-card:hover {
    border-color: #ffd700;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(255,215,0,0.3);
}
.paint-msg-card:active { transform: scale(0.98); }
.paint-msg-card .paint-thumb {
    width: 100%;
    aspect-ratio: 1;
    background:
        linear-gradient(45deg, #1a1a2e 25%, transparent 25%),
        linear-gradient(-45deg, #1a1a2e 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #1a1a2e 75%),
        linear-gradient(-45deg, transparent 75%, #1a1a2e 75%);
    background-size: 16px 16px;
    background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
    background-color: #0a0a15;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
}
.paint-msg-card .paint-thumb img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
}
.paint-msg-card .paint-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    background: linear-gradient(135deg, #ffd700, #d4af37);
    color: #000;
    font-size: 10px;
    font-weight: 900;
    padding: 3px 8px;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
}
.paint-msg-card .paint-meta {
    padding: 6px 10px;
    background: rgba(0,0,0,0.4);
    color: #999;
    font-size: 10px;
    text-align: center;
    font-weight: 900;
}

/* ═══ Responsive ═══ */
@media (max-width: 480px) {
    #paint-toolbar {
        padding: 8px;
        gap: 6px;
        max-height: 48vh;
    }
    .paint-tool-btn { min-width: 42px; height: 42px; padding: 0 8px; font-size: 16px; }
    .paint-tool-btn.small { min-width: 36px; height: 36px; font-size: 13px; }
    .paint-color-btn { width: 28px; height: 28px; }
    .paint-tool-label { min-width: 50px; font-size: 10px; }
    #paint-header { height: 44px; padding: 0 8px; }
    #paint-title { font-size: 12px; }
    .paint-header-btn { height: 32px; padding: 0 10px; font-size: 11px; }
}
        `;
        document.head.appendChild(s);
    })();

    /* ══════════════════════════════════════════════ */
    /* Build Overlay UI                               */
    /* ══════════════════════════════════════════════ */
    function ensureOverlay() {
        var ov = document.getElementById('paint-overlay');
        if (ov) return ov;

        ov = document.createElement('div');
        ov.id = 'paint-overlay';
        ov.innerHTML =
            '<div id="paint-header">' +
                '<div id="paint-title">🎨 الرسام</div>' +
                '<div style="display:flex;gap:6px;">' +
                    '<button class="paint-header-btn save" id="paint-save" type="button">📤 إرسال</button>' +
                    '<button class="paint-header-btn close" id="paint-close" type="button">✕</button>' +
                '</div>' +
            '</div>' +
            '<div id="paint-body">' +
                '<div id="paint-canvas-wrap"></div>' +
                '<div id="paint-loading">' +
                    '<div class="spinner"></div>' +
                    '<div>جاري تحميل الرسام...</div>' +
                '</div>' +
            '</div>' +
            '<div id="paint-toolbar">' +
                '<div class="paint-row" id="paint-tools-row"></div>' +
                '<div class="paint-row" id="paint-colors-row"></div>' +
                '<div class="paint-row" id="paint-thickness-row"></div>' +
                '<div class="paint-row" id="paint-bg-row"></div>' +
            '</div>';

        document.body.appendChild(ov);

        ov.querySelector('#paint-close').onclick = close;
        ov.querySelector('#paint-save').onclick = send;

        _buildToolsRow();
        _buildColorsRow();
        _buildThicknessRow();
        _buildBgRow();
        _ensureTextModal();

        return ov;
    }

    /* ⭐ v2: Text Modal */
    function _ensureTextModal() {
        var m = document.getElementById('paint-text-modal');
        if (m) return m;

        m = document.createElement('div');
        m.id = 'paint-text-modal';
        m.innerHTML =
            '<div id="paint-text-box">' +
                '<div id="paint-text-title">📝 إضافة نص</div>' +
                '<textarea id="paint-text-input" placeholder="اكتب النص هنا..." rows="3" maxlength="200"></textarea>' +
                '<div id="paint-text-actions">' +
                    '<button id="paint-text-cancel" type="button">إلغاء</button>' +
                    '<button id="paint-text-confirm" type="button">✅ إضافة</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(m);

        document.getElementById('paint-text-cancel').onclick = function () {
            m.classList.remove('active');
            PT._pendingTextPos = null;
        };

        document.getElementById('paint-text-confirm').onclick = function () {
            var inp = document.getElementById('paint-text-input');
            var txt = (inp.value || '').trim();
            if (txt) {
                _addTextToCanvas(txt);
            }
            inp.value = '';
            m.classList.remove('active');
            PT._pendingTextPos = null;
        };

        // Enter (بدون Shift) = إضافة
        document.getElementById('paint-text-input').addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                document.getElementById('paint-text-confirm').click();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                document.getElementById('paint-text-cancel').click();
            }
        });

        return m;
    }

    function _showTextModal(pos) {
        PT._pendingTextPos = pos;
        var m = _ensureTextModal();
        var inp = document.getElementById('paint-text-input');
        inp.value = '';
        m.classList.add('active');
        setTimeout(function () { inp.focus(); }, 150);
    }

    function _addTextToCanvas(txt) {
        if (!PT.canvas || !txt) return;
        var pos = PT._pendingTextPos || { x: PT.canvas.width / 2, y: PT.canvas.height / 2 };

        var fontSize = Math.max(20, PT.thickness * 4);
        var t = new fabric.IText(txt, {
            left: pos.x,
            top: pos.y,
            fill: PT.color,
            fontSize: fontSize,
            fontFamily: 'Cairo, sans-serif',
            fontWeight: '900',
            selectable: true,
            evented: true
        });
        PT.canvas.add(t);
        PT.canvas.setActiveObject(t);
        t.enterEditing();
        t.selectAll();
        PT.canvas.renderAll();
        _saveHistory();
        toast('fa-check', '✅ تمت إضافة النص');
    }

    function _buildToolsRow() {
        var row = document.getElementById('paint-tools-row');
        if (!row) return;

        var tools = [
            { id: 'brush',  icon: '🖌️', label: 'فرشاة' },
            { id: 'eraser', icon: '🧽', label: 'ممحاة' },
            { id: 'line',   icon: '📏', label: 'خط' },
            { id: 'rect',   icon: '▭',  label: 'مستطيل' },
            { id: 'circle', icon: '○',  label: 'دائرة' },
            { id: 'text',   icon: 'A',  label: 'نص' }
        ];

        row.innerHTML = '';

        tools.forEach(function (t) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'paint-tool-btn' + (PT.tool === t.id ? ' active' : '');
            b.setAttribute('data-tool', t.id);
            b.title = t.label;
            b.innerHTML = t.icon;
            b.onclick = function () { selectTool(t.id); };
            row.appendChild(b);
        });

        var spacer = document.createElement('div');
        spacer.style.cssText = 'flex:1;min-width:8px;';
        row.appendChild(spacer);

        var undoBtn = document.createElement('button');
        undoBtn.type = 'button';
        undoBtn.className = 'paint-tool-btn small';
        undoBtn.innerHTML = '↶';
        undoBtn.title = 'تراجع';
        undoBtn.onclick = undo;
        row.appendChild(undoBtn);

        var redoBtn = document.createElement('button');
        redoBtn.type = 'button';
        redoBtn.className = 'paint-tool-btn small';
        redoBtn.innerHTML = '↷';
        redoBtn.title = 'إعادة';
        redoBtn.onclick = redo;
        row.appendChild(redoBtn);

        var clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'paint-tool-btn small danger';
        clearBtn.innerHTML = '🗑️';
        clearBtn.title = 'مسح الكل';
        clearBtn.onclick = clearAll;
        row.appendChild(clearBtn);
    }

    function _buildColorsRow() {
        var row = document.getElementById('paint-colors-row');
        if (!row) return;

        var colors = [
            '#000000', '#ffffff', '#ff0000', '#ff8c00', '#ffd700',
            '#ffff00', '#39ff14', '#00cc00', '#00b894', '#00f3ff',
            '#00bfff', '#1e90ff', '#0000ff', '#6c5ce7', '#a855f7',
            '#ff00ff', '#da70d6', '#ff1493', '#8b4513', '#696969'
        ];

        row.innerHTML = '';

        var lbl = document.createElement('span');
        lbl.className = 'paint-tool-label';
        lbl.textContent = 'اللون:';
        row.appendChild(lbl);

        colors.forEach(function (c) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'paint-color-btn' + (PT.color === c ? ' active' : '');
            b.style.background = c;
            b.setAttribute('data-color', c);
            b.onclick = function () {
                PT.color = c;
                row.querySelectorAll('.paint-color-btn').forEach(function (x) {
                    x.classList.remove('active');
                });
                b.classList.add('active');
                _applyToolSettings();
            };
            row.appendChild(b);
        });

        var custom = document.createElement('input');
        custom.type = 'color';
        custom.value = PT.color;
        custom.style.cssText = 'width:36px;height:32px;padding:0;border:2px solid rgba(255,255,255,0.3);border-radius:8px;cursor:pointer;background:transparent;';
        custom.oninput = function () {
            PT.color = custom.value;
            row.querySelectorAll('.paint-color-btn').forEach(function (x) {
                x.classList.remove('active');
            });
            _applyToolSettings();
        };
        row.appendChild(custom);
    }

    function _buildThicknessRow() {
        var row = document.getElementById('paint-thickness-row');
        if (!row) return;

        row.innerHTML = '';

        var lbl = document.createElement('span');
        lbl.className = 'paint-tool-label';
        lbl.textContent = 'السماكة:';
        row.appendChild(lbl);

        var slider = document.createElement('input');
        slider.type = 'range';
        slider.id = 'paint-thickness';
        slider.min = '1';
        slider.max = '50';
        slider.value = PT.thickness;
        slider.oninput = function () {
            PT.thickness = parseInt(this.value);
            var v = document.getElementById('paint-thickness-val');
            if (v) v.textContent = PT.thickness;
            _applyToolSettings();
        };
        row.appendChild(slider);

        var val = document.createElement('span');
        val.id = 'paint-thickness-val';
        val.textContent = PT.thickness;
        row.appendChild(val);
    }

    function _buildBgRow() {
        var row = document.getElementById('paint-bg-row');
        if (!row) return;

        row.innerHTML = '';

        var lbl = document.createElement('span');
        lbl.className = 'paint-tool-label';
        lbl.textContent = 'الخلفية:';
        row.appendChild(lbl);

        var transBtn = document.createElement('button');
        transBtn.type = 'button';
        transBtn.className = 'paint-tool-btn small' + (PT.bgColor === 'transparent' ? ' active' : '');
        transBtn.innerHTML = '✕';
        transBtn.title = 'شفافة';
        transBtn.style.cssText = 'background-image:linear-gradient(45deg,#666 25%,transparent 25%),linear-gradient(-45deg,#666 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#666 75%),linear-gradient(-45deg,transparent 75%,#666 75%);background-size:8px 8px;background-position:0 0,0 4px,4px -4px,-4px 0px;';
        transBtn.onclick = function () {
            PT.bgColor = 'transparent';
            _updateBgUI();
        };
        row.appendChild(transBtn);

        var bgColors = ['#ffffff', '#000000', '#1a1a2e', '#4a148c', '#0a0a15'];
        bgColors.forEach(function (c) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'paint-color-btn' + (PT.bgColor === c ? ' active' : '');
            b.style.background = c;
            b.setAttribute('data-bg', c);
            b.onclick = function () {
                PT.bgColor = c;
                _updateBgUI();
            };
            row.appendChild(b);
        });

        var custom = document.createElement('input');
        custom.type = 'color';
        custom.id = 'paint-bg-custom';
        custom.value = PT.bgColor === 'transparent' ? '#ffffff' : PT.bgColor;
        custom.oninput = function () {
            PT.bgColor = custom.value;
            _updateBgUI();
        };
        row.appendChild(custom);
    }

    function _updateBgUI() {
        var row = document.getElementById('paint-bg-row');
        if (!row) return;
        row.querySelectorAll('.paint-color-btn').forEach(function (b) {
            var bc = b.getAttribute('data-bg');
            if (bc && bc === PT.bgColor) b.classList.add('active');
            else b.classList.remove('active');
        });
        var transBtn = row.querySelector('.paint-tool-btn');
        if (transBtn) {
            if (PT.bgColor === 'transparent') transBtn.classList.add('active');
            else transBtn.classList.remove('active');
        }
        _applyBgColor();
    }

    function _applyBgColor() {
        if (!PT.canvas) return;
        var wrap = document.getElementById('paint-canvas-wrap');
        if (!wrap) return;
        if (PT.bgColor === 'transparent') {
            wrap.style.backgroundColor = '';
            wrap.style.backgroundImage =
                'linear-gradient(45deg, #2a2a3e 25%, transparent 25%),' +
                'linear-gradient(-45deg, #2a2a3e 25%, transparent 25%),' +
                'linear-gradient(45deg, transparent 75%, #2a2a3e 75%),' +
                'linear-gradient(-45deg, transparent 75%, #2a2a3e 75%)';
            wrap.style.backgroundSize = '16px 16px';
            wrap.style.backgroundPosition = '0 0, 0 8px, 8px -8px, -8px 0px';
            PT.canvas.setBackgroundColor('', function () { PT.canvas.renderAll(); });
        } else {
            wrap.style.backgroundImage = 'none';
            wrap.style.backgroundColor = PT.bgColor;
            PT.canvas.setBackgroundColor(PT.bgColor, function () { PT.canvas.renderAll(); });
        }
    }

    /* ══════════════════════════════════════════════ */
    /* ⭐ v2: Canvas init — الإصلاح الأساسي            */
    /* ══════════════════════════════════════════════ */
    function _initCanvas() {
        var wrap = document.getElementById('paint-canvas-wrap');
        if (!wrap) return;

        var body = document.getElementById('paint-body');
        var availW = body.clientWidth - 20;
        var availH = body.clientHeight - 20;

        var size = Math.min(MAX_CANVAS_SIZE, availW, availH);
        size = Math.max(size, 260);

        wrap.innerHTML = '';
        wrap.style.width = size + 'px';
        wrap.style.height = size + 'px';

        // ⭐ v2: BUG FIX — إنشاء canvas element يدوياً
        var canvasEl = document.createElement('canvas');
        canvasEl.id = 'paint-canvas-el';
        canvasEl.width = size;
        canvasEl.height = size;
        wrap.appendChild(canvasEl);

        // ⭐ v2: بناء Fabric بعد وجود العنصر
        try {
            PT.canvas = new fabric.Canvas('paint-canvas-el', {
                isDrawingMode: true,
                backgroundColor: PT.bgColor === 'transparent' ? '' : PT.bgColor,
                selection: false,
                width: size,
                height: size,
                enableRetinaScaling: true,
                allowTouchScrolling: false
            });
        } catch (e) {
            console.error('Fabric init failed:', e);
            toast('fa-times', '⚠️ فشل بدء الرسام');
            return;
        }

        // ⭐ v2: التأكد من touch-action
        if (PT.canvas.upperCanvasEl) {
            PT.canvas.upperCanvasEl.style.touchAction = 'none';
            PT.canvas.upperCanvasEl.style.userSelect = 'none';
            PT.canvas.upperCanvasEl.style.webkitUserSelect = 'none';
            PT.canvas.upperCanvasEl.style.webkitTouchCallout = 'none';
        }
        if (PT.canvas.lowerCanvasEl) {
            PT.canvas.lowerCanvasEl.style.touchAction = 'none';
            PT.canvas.lowerCanvasEl.style.userSelect = 'none';
        }
        if (PT.canvas.wrapperEl) {
            PT.canvas.wrapperEl.style.touchAction = 'none';
            PT.canvas.wrapperEl.style.margin = '0 auto';
        }

        // Brush
        PT.canvas.freeDrawingBrush = new fabric.PencilBrush(PT.canvas);
        PT.canvas.freeDrawingBrush.color = PT.color;
        PT.canvas.freeDrawingBrush.width = PT.thickness;

        _applyToolSettings();
        _applyBgColor();

        // Events
        PT.canvas.on('mouse:down', _onMouseDown);
        PT.canvas.on('mouse:move', _onMouseMove);
        PT.canvas.on('mouse:up', _onMouseUp);
        PT.canvas.on('path:created', function () { _saveHistory(); });

        _saveHistory();
    }

    /* ══════════════════════════════════════════════ */
    /* Tool logic                                     */
    /* ══════════════════════════════════════════════ */
    function selectTool(toolId) {
        PT.tool = toolId;

        var row = document.getElementById('paint-tools-row');
        if (row) {
            row.querySelectorAll('.paint-tool-btn').forEach(function (b) {
                if (b.getAttribute('data-tool') === toolId) b.classList.add('active');
                else if (b.getAttribute('data-tool')) b.classList.remove('active');
            });
        }

        _applyToolSettings();
    }

    function _applyToolSettings() {
        if (!PT.canvas) return;

        if (PT.tool === 'brush') {
            PT.canvas.isDrawingMode = true;
            PT.canvas.selection = false;
            PT.canvas.defaultCursor = 'crosshair';
            if (PT.canvas.freeDrawingBrush) {
                PT.canvas.freeDrawingBrush.color = PT.color;
                PT.canvas.freeDrawingBrush.width = PT.thickness;
                // إلغاء override الممحاة إن وُجد
                delete PT.canvas.freeDrawingBrush._setBrushStyles;
            }
        } else if (PT.tool === 'eraser') {
            PT.canvas.isDrawingMode = true;
            PT.canvas.selection = false;
            PT.canvas.defaultCursor = 'crosshair';
            if (PT.canvas.freeDrawingBrush) {
                if (PT.bgColor === 'transparent') {
                    PT.canvas.freeDrawingBrush.color = 'rgba(0,0,0,1)';
                    PT.canvas.freeDrawingBrush.width = PT.thickness * 2;
                    PT.canvas.freeDrawingBrush._setBrushStyles = function () {
                        this.canvas.contextTop.globalCompositeOperation = 'destination-out';
                        this.canvas.contextTop.lineWidth = this.width;
                        this.canvas.contextTop.strokeStyle = this.color;
                        this.canvas.contextTop.lineCap = 'round';
                        this.canvas.contextTop.lineJoin = 'round';
                    };
                } else {
                    PT.canvas.freeDrawingBrush.color = PT.bgColor;
                    PT.canvas.freeDrawingBrush.width = PT.thickness * 2;
                }
            }
        } else {
            PT.canvas.isDrawingMode = false;
            PT.canvas.selection = (PT.tool === 'text');
            PT.canvas.defaultCursor = 'crosshair';
        }
    }

    /* ══════════════════════════════════════════════ */
    /* Shape drawing                                  */
    /* ══════════════════════════════════════════════ */
    function _getCanvasPointer(opt) {
        if (!opt || !opt.pointer) return { x: 0, y: 0 };
        return { x: opt.pointer.x, y: opt.pointer.y };
    }

    function _onMouseDown(opt) {
        if (!PT.canvas) return;

        // نص: افتح modal
        if (PT.tool === 'text') {
            var p = _getCanvasPointer(opt);
            _showTextModal(p);
            return;
        }

        if (PT.tool === 'brush' || PT.tool === 'eraser') return;

        PT._drawing = true;
        var p2 = _getCanvasPointer(opt);
        PT._startX = p2.x;
        PT._startY = p2.y;

        if (PT.tool === 'line') {
            PT._currentShape = new fabric.Line([p2.x, p2.y, p2.x, p2.y], {
                stroke: PT.color,
                strokeWidth: PT.thickness,
                strokeLineCap: 'round',
                selectable: false,
                evented: false
            });
        } else if (PT.tool === 'rect') {
            PT._currentShape = new fabric.Rect({
                left: p2.x,
                top: p2.y,
                width: 1,
                height: 1,
                fill: 'transparent',
                stroke: PT.color,
                strokeWidth: PT.thickness,
                selectable: false,
                evented: false
            });
        } else if (PT.tool === 'circle') {
            PT._currentShape = new fabric.Circle({
                left: p2.x,
                top: p2.y,
                radius: 1,
                fill: 'transparent',
                stroke: PT.color,
                strokeWidth: PT.thickness,
                selectable: false,
                evented: false
            });
        }

        if (PT._currentShape) {
            PT.canvas.add(PT._currentShape);
        }
    }

    function _onMouseMove(opt) {
        if (!PT._drawing || !PT._currentShape) return;
        var p = _getCanvasPointer(opt);

        if (PT.tool === 'line') {
            PT._currentShape.set({ x2: p.x, y2: p.y });
        } else if (PT.tool === 'rect') {
            var w = p.x - PT._startX;
            var h = p.y - PT._startY;
            PT._currentShape.set({
                left: w < 0 ? p.x : PT._startX,
                top: h < 0 ? p.y : PT._startY,
                width: Math.abs(w),
                height: Math.abs(h)
            });
        } else if (PT.tool === 'circle') {
            var r = Math.sqrt(
                Math.pow(p.x - PT._startX, 2) +
                Math.pow(p.y - PT._startY, 2)
            );
            PT._currentShape.set({ radius: r });
        }

        PT.canvas.requestRenderAll();
    }

    function _onMouseUp() {
        if (!PT._drawing) return;
        PT._drawing = false;
        PT._currentShape = null;
        _saveHistory();
    }

    /* ══════════════════════════════════════════════ */
    /* History                                        */
    /* ══════════════════════════════════════════════ */
    function _saveHistory() {
        if (!PT.canvas) return;
        try {
            var json = PT.canvas.toJSON(['selectable', 'evented', 'hoverCursor']);
            if (PT._historyIndex === PT._history.length - 1) {
                PT._history.push(json);
                if (PT._history.length > PT._maxHistory) PT._history.shift();
                else PT._historyIndex++;
            } else {
                PT._history = PT._history.slice(0, PT._historyIndex + 1);
                PT._history.push(json);
                PT._historyIndex = PT._history.length - 1;
            }
        } catch (e) { console.warn('history save failed:', e); }
    }

    function undo() {
        if (!PT.canvas) return;
        if (PT._historyIndex <= 0) { toast('fa-info-circle', '↶ لا يوجد'); return; }
        PT._historyIndex--;
        _restoreFromHistory(PT._history[PT._historyIndex]);
    }

    function redo() {
        if (!PT.canvas) return;
        if (PT._historyIndex >= PT._history.length - 1) { toast('fa-info-circle', '↷ لا يوجد'); return; }
        PT._historyIndex++;
        _restoreFromHistory(PT._history[PT._historyIndex]);
    }

    function _restoreFromHistory(json) {
        if (!json) return;
        PT.canvas.loadFromJSON(json, function () {
            PT.canvas.renderAll();
            _applyBgColor();
        });
    }

    function clearAll() {
        if (!PT.canvas) return;
        if (!confirm('🗑️ مسح كل الرسم؟')) return;
        PT.canvas.clear();
        PT.canvas.setBackgroundColor(PT.bgColor === 'transparent' ? '' : PT.bgColor);
        PT.canvas.renderAll();
        _saveHistory();
    }

    /* ══════════════════════════════════════════════ */
    /* Open / Close                                   */
    /* ══════════════════════════════════════════════ */
    async function open(ctx) {
        PT.ctx = ctx || 'general';

        var ov = ensureOverlay();
        ov.classList.add('active');

        var loading = document.getElementById('paint-loading');
        if (loading) loading.style.display = 'flex';

        try {
            await loadFabric();
        } catch (e) {
            console.error('Paint: Fabric load failed', e);
            toast('fa-times', '⚠️ فشل تحميل الرسام — تحقق من الإنترنت');
            close();
            return;
        }

        // ننتظر إطار الرسم حتى يُحسب clientHeight
        await new Promise(function (r) { setTimeout(r, 80); });

        try {
            _initCanvas();
        } catch (e) {
            console.error('Paint: canvas init failed', e);
            toast('fa-times', '⚠️ فشل بدء الرسم: ' + e.message);
            close();
            return;
        }

        if (loading) loading.style.display = 'none';

        PT._history = [];
        PT._historyIndex = -1;
        _saveHistory();

        console.log('🎨 Paint v2: opened (ctx=' + PT.ctx + ')');
    }

    function close() {
        var ov = document.getElementById('paint-overlay');
        if (ov) ov.classList.remove('active');

        // إغلاق text modal إن مفتوح
        var tm = document.getElementById('paint-text-modal');
        if (tm) tm.classList.remove('active');

        try {
            if (PT.canvas) PT.canvas.dispose();
        } catch (e) {}
        PT.canvas = null;
        PT._currentShape = null;
        PT._drawing = false;

        var wrap = document.getElementById('paint-canvas-wrap');
        if (wrap) wrap.innerHTML = '';
    }

    /* ══════════════════════════════════════════════ */
    /* Send                                           */
    /* ══════════════════════════════════════════════ */
    async function send() {
        if (PT._sending) return;
        if (!PT.canvas) { toast('fa-times', '⚠️ لا يوجد كانفس'); return; }

        PT._sending = true;
        var saveBtn = document.getElementById('paint-save');
        var origText = saveBtn ? saveBtn.innerHTML : '';
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '⏳ جاري الإرسال...';
        }

        try {
            var isTransparent = (PT.bgColor === 'transparent');
            var blob = await _canvasToBlob(isTransparent ? 'png' : 'jpeg');
            if (!blob) throw new Error('فشل توليد الصورة');

            if (!window.UploadService || typeof window.UploadService.upload !== 'function') {
                throw new Error('UploadService غير محمّل');
            }

            var ext = isTransparent ? 'png' : 'jpg';
            var mime = isTransparent ? 'image/png' : 'image/jpeg';
            var file = new File([blob], 'paint_' + Date.now() + '.' + ext, { type: mime });

            toast('fa-spinner', '⏳ جاري الرفع...');
            var url = await window.UploadService.upload(file);
            if (!url) throw new Error('لم يرجع رابط');

            var token = '[paint:' + url + ']';
            var targetId = (PT.ctx === 'private') ? 'pc-input' : 'message-input';
            var inp = document.getElementById(targetId);

            if (inp) {
                var cur = inp.value;
                inp.value = (cur ? cur + ' ' : '') + token + ' ';
                try { inp.focus(); } catch (e) {}
            } else {
                try {
                    await navigator.clipboard.writeText(token);
                    toast('fa-copy', '📋 نُسخ التوكن');
                } catch (e) {}
            }

            toast('fa-check', '✅ تم الإرسال — اضغط إرسال في الشات');
            close();

        } catch (e) {
            console.error('Paint send failed:', e);
            toast('fa-times', '⚠️ فشل: ' + (e.message || 'غير معروف'));
        } finally {
            PT._sending = false;
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = origText || '📤 إرسال';
            }
        }
    }

    function _canvasToBlob(format) {
        return new Promise(function (resolve, reject) {
            try {
                var dataURL = PT.canvas.toDataURL({
                    format: format,
                    quality: format === 'jpeg' ? 0.92 : 1,
                    multiplier: 2
                });
                var byteString = atob(dataURL.split(',')[1]);
                var ab = new ArrayBuffer(byteString.length);
                var ia = new Uint8Array(ab);
                for (var i = 0; i < byteString.length; i++) {
                    ia[i] = byteString.charCodeAt(i);
                }
                var mime = format === 'png' ? 'image/png' : 'image/jpeg';
                var blob = new Blob([ab], { type: mime });
                resolve(blob);
            } catch (e) { reject(e); }
        });
    }

    /* ══════════════════════════════════════════════ */
    /* Token processing in messages                   */
    /* ══════════════════════════════════════════════ */
    function _parsePaintToken(text) {
        if (!text || typeof text !== 'string') return null;
        if (text.indexOf('[paint:') === -1) return null;
        var regex = /\[paint:([^\]]+)\]/g;
        var parts = [];
        var lastIdx = 0, m;
        while ((m = regex.exec(text)) !== null) {
            if (m.index > lastIdx) parts.push({ type: 'text', value: text.substring(lastIdx, m.index) });
            parts.push({ type: 'image', value: m[1] });
            lastIdx = regex.lastIndex;
        }
        if (lastIdx < text.length) parts.push({ type: 'text', value: text.substring(lastIdx) });
        return parts.length ? parts : null;
    }

    function _processElement(rootEl) {
        if (!rootEl || rootEl.nodeType !== 1) return;
        if (PT._processed.has(rootEl)) return;
        PT._processed.add(rootEl);

        var walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
        var toProcess = [];
        while (walker.nextNode()) {
            var val = walker.currentNode.nodeValue;
            if (val && val.indexOf('[paint:') !== -1) {
                toProcess.push(walker.currentNode);
            }
        }

        toProcess.forEach(function (textNode) {
            var parts = _parsePaintToken(textNode.nodeValue);
            if (!parts) return;

            var frag = document.createDocumentFragment();
            parts.forEach(function (p) {
                if (p.type === 'text') {
                    if (p.value) frag.appendChild(document.createTextNode(p.value));
                } else if (p.type === 'image') {
                    frag.appendChild(_buildPaintCard(p.value));
                }
            });

            if (textNode.parentNode) {
                textNode.parentNode.replaceChild(frag, textNode);
            }
        });
    }

    function _buildPaintCard(url) {
        var card = document.createElement('a');
        card.className = 'paint-msg-card';
        card.href = 'javascript:void(0)';
        card.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            _openLightbox(url);
        };

        var thumb = document.createElement('div');
        thumb.className = 'paint-thumb';
        var img = document.createElement('img');
        img.src = url;
        img.loading = 'lazy';
        img.alt = 'رسمة';
        img.onerror = function () { this.alt = '⚠️ فشل تحميل'; };
        thumb.appendChild(img);

        var badge = document.createElement('div');
        badge.className = 'paint-badge';
        badge.textContent = '🎨 رسمة';
        thumb.appendChild(badge);

        var meta = document.createElement('div');
        meta.className = 'paint-meta';
        meta.textContent = 'اضغط للتكبير';

        card.appendChild(thumb);
        card.appendChild(meta);
        return card;
    }

    function _openLightbox(url) {
        if (!url) return;
        var lb = document.getElementById('paint-lightbox');
        if (!lb) {
            lb = document.createElement('div');
            lb.id = 'paint-lightbox';
            lb.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:1000010;display:none;justify-content:center;align-items:center;padding:20px;cursor:zoom-out;';
            lb.innerHTML = '<img id="paint-lb-img" style="max-width:100%;max-height:100%;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.9);">';
            lb.onclick = function () { lb.style.display = 'none'; };
            document.body.appendChild(lb);
        }
        var img = document.getElementById('paint-lb-img');
        if (img) img.src = url;
        lb.style.display = 'flex';
    }

    /* ══════════════════════════════════════════════ */
    /* Observers                                      */
    /* ══════════════════════════════════════════════ */
    function installObserver(containerId) {
        var container = document.getElementById(containerId);
        if (!container) return false;
        if (container.__paintObserved) return true;
        container.__paintObserved = true;
        new MutationObserver(function (muts) {
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
        }).observe(container, { childList: true, subtree: false });
        container.querySelectorAll('.message, .pc-msg').forEach(function (el) {
            _processElement(el);
        });
        return true;
    }

    function installAllObservers() {
        var ok1 = installObserver('messages');
        var ok2 = installObserver('pc-messages');
        if (!ok1 || !ok2) setTimeout(installAllObservers, 1500);
    }

    /* ══════════════════════════════════════════════ */
    /* Init                                           */
    /* ══════════════════════════════════════════════ */
    function init() {
        installAllObservers();
        console.log('🎨 Paint Tool v2: observers ready');
    }

    /* ══════════════════════════════════════════════ */
    /* Public API                                     */
    /* ══════════════════════════════════════════════ */
    window.PaintTool = {
        open: open,
        close: close,
        send: send,
        clear: clearAll,
        undo: undo,
        redo: redo,
        version: 2
    };

    window.openPaint = function (ctx) { open(ctx || 'general'); };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('🎨 paint-tool.js v2 (TEST) loaded — canvas FIX + touch FIX + text modal');
})();
