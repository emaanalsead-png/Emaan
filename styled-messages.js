// ==============================================
// styled-messages.js v1 (TEST) — رسائل مميزة + مولّد خطوط
// ==============================================
// ✅ v1 (جديد كلياً):
//   1. نص مميز: لون + توهج + حجم + خط + خلفية + محاذاة
//   2. مولّد خطوط Unicode (Bold, Italic, Script, Fraktur, ...)
//   3. Token: [sty:BASE64URL] — آمن ضد XSS
//   4. عام + خاص (context-aware)
//   5. Preview مباشر
//   6. حماية: لا ميزة للزوار
//   7. Whitelist للخطوط والأحجام والألوان
//   8. يعمل مع chat.js v3.18 + pm-enhanced v10
// ==============================================

(function () {
    'use strict';
    if (window.__styledMessagesV1) return;
    window.__styledMessagesV1 = true;

    /* ══════════════════════════════════════════════ */
    /* Config                                         */
    /* ══════════════════════════════════════════════ */
    var FONT_FAMILIES = [
        { id: 'Cairo',           label: 'Cairo (افتراضي)' },
        { id: 'Amiri',           label: 'Amiri (تقليدي)' },
        { id: 'Arial',           label: 'Arial' },
        { id: 'Georgia',         label: 'Georgia' },
        { id: 'Times New Roman', label: 'Times' },
        { id: 'Courier New',     label: 'Courier' },
        { id: 'Verdana',         label: 'Verdana' },
        { id: 'monospace',       label: 'Monospace' }
    ];

    var FONT_WEIGHTS = [
        { id: 'normal', label: 'عادي' },
        { id: '600',    label: 'شبه عريض' },
        { id: 'bold',   label: 'عريض' },
        { id: '900',    label: 'ثقيل' }
    ];

    var ALIGNS = [
        { id: 'right',  label: '⇥ يمين' },
        { id: 'center', label: '↔ منتصف' },
        { id: 'left',   label: '⇤ يسار' }
    ];

    var TEXT_COLORS = [
        '#ffffff', '#000000', '#ff0000', '#ff4444', '#ff8c00', '#ffd700',
        '#ffff00', '#39ff14', '#00cc00', '#00b894', '#00f3ff', '#00bfff',
        '#1e90ff', '#0000ff', '#6c5ce7', '#a855f7', '#ff00ff', '#da70d6',
        '#ff1493', '#ff69b4', '#8b4513', '#696969'
    ];

    var GLOW_COLORS = [
        'none', '#ffd700', '#ff69b4', '#00f3ff', '#39ff14',
        '#a855f7', '#ff0066', '#ffffff', '#ff4444', '#ff8c00'
    ];

    var BG_COLORS = [
        'transparent', '#000000', '#1a1a2e', '#4a148c', '#330000',
        '#003d1a', '#001a33', '#2a1500', '#ffffff'
    ];

    var MAX_TEXT_LEN = 500;
    var MIN_SIZE = 12;
    var MAX_SIZE = 40;
    var DEFAULT_SIZE = 18;

    /* ══════════════════════════════════════════════ */
    /* Unicode Font Mappings (Latin + digits)         */
    /* ══════════════════════════════════════════════ */
    var UNICODE_FONTS = {
        bold: {
            label: 'Bold',
            preview: '𝗔𝗕𝗖',
            map: _rangeMap('A-Z', 0x1D400) + _rangeMap('a-z', 0x1D41A) + _rangeMap('0-9', 0x1D7CE)
        },
        italic: {
            label: 'Italic',
            preview: '𝘈𝘉𝘊',
            map: _rangeMap('A-Z', 0x1D434) + _rangeMap('a-z', 0x1D44E, { h: 0x210E })
        },
        boldItalic: {
            label: 'Bold Italic',
            preview: '𝘼𝘽𝘾',
            map: _rangeMap('A-Z', 0x1D468) + _rangeMap('a-z', 0x1D482)
        },
        script: {
            label: 'Script',
            preview: '𝒜ℬ𝒞',
            map: _rangeMap('A-Z', 0x1D49C, { B: 0x212C, E: 0x2130, F: 0x2131, H: 0x210B, I: 0x2110, L: 0x2112, M: 0x2133, R: 0x211B }) + _rangeMap('a-z', 0x1D4B6, { e: 0x212F, g: 0x210A, o: 0x2134 })
        },
        boldScript: {
            label: 'Bold Script',
            preview: '𝓐𝓑𝓒',
            map: _rangeMap('A-Z', 0x1D4D0) + _rangeMap('a-z', 0x1D4EA)
        },
        fraktur: {
            label: 'Fraktur',
            preview: '𝔄𝔅ℭ',
            map: _rangeMap('A-Z', 0x1D504, { C: 0x212D, H: 0x210C, I: 0x2111, R: 0x211C, Z: 0x2128 }) + _rangeMap('a-z', 0x1D51E)
        },
        doubleStruck: {
            label: 'Double Struck',
            preview: '𝔸𝔹ℂ',
            map: _rangeMap('A-Z', 0x1D538, { C: 0x2102, H: 0x210D, N: 0x2115, P: 0x2119, Q: 0x211A, R: 0x211D, Z: 0x2124 }) + _rangeMap('a-z', 0x1D552) + _rangeMap('0-9', 0x1D7D8)
        },
        monospace: {
            label: 'Monospace',
            preview: '𝙰𝙱𝙲',
            map: _rangeMap('A-Z', 0x1D670) + _rangeMap('a-z', 0x1D68A) + _rangeMap('0-9', 0x1D7F6)
        },
        sansBold: {
            label: 'Sans Bold',
            preview: '𝗔𝗕𝗖',
            map: _rangeMap('A-Z', 0x1D5D4) + _rangeMap('a-z', 0x1D5EE) + _rangeMap('0-9', 0x1D7EC)
        },
        smallCaps: {
            label: 'Small Caps',
            preview: 'ᴀʙᴄ',
            map: { a:'ᴀ', b:'ʙ', c:'ᴄ', d:'ᴅ', e:'ᴇ', f:'ꜰ', g:'ɢ', h:'ʜ', i:'ɪ', j:'ᴊ', k:'ᴋ', l:'ʟ', m:'ᴍ', n:'ɴ', o:'ᴏ', p:'ᴘ', q:'Q', r:'ʀ', s:'ꜱ', t:'ᴛ', u:'ᴜ', v:'ᴠ', w:'ᴡ', x:'x', y:'ʏ', z:'ᴢ' }
        },
        circled: {
            label: 'Circled',
            preview: 'ⒶⒷⒸ',
            map: _rangeMap('A-Z', 0x24B6) + _rangeMap('a-z', 0x24D0)
        },
        negativeCircled: {
            label: 'Neg Circled',
            preview: '🅐🅑🅒',
            map: _rangeMap('A-Z', 0x1F150)
        },
        squared: {
            label: 'Squared',
            preview: '🄰🄱🄲',
            map: _rangeMap('A-Z', 0x1F130)
        },
        negativeSquared: {
            label: 'Neg Squared',
            preview: '🅰🅱🅲',
            map: _rangeMap('A-Z', 0x1F170)
        },
        parenthesized: {
            label: 'Parenthesized',
            preview: '⒜⒝⒞',
            map: _rangeMap('a-z', 0x249C)
        },
        fullwidth: {
            label: 'Fullwidth',
            preview: 'ＡＢＣ',
            map: _rangeMap('A-Z', 0xFF21) + _rangeMap('a-z', 0xFF41) + _rangeMap('0-9', 0xFF10)
        },
        upsideDown: {
            label: 'Upside Down',
            preview: '∀ᗺƆ',
            map: { a:'ɐ', b:'q', c:'ɔ', d:'p', e:'ǝ', f:'ɟ', g:'ƃ', h:'ɥ', i:'ᴉ', j:'ɾ', k:'ʞ', l:'l', m:'ɯ', n:'u', o:'o', p:'d', q:'b', r:'ɹ', s:'s', t:'ʇ', u:'n', v:'ʌ', w:'ʍ', x:'x', y:'ʎ', z:'z',
                   A:'∀', B:'ᗺ', C:'Ɔ', D:'ᗡ', E:'Ǝ', F:'Ⅎ', G:'⅁', H:'H', I:'I', J:'ſ', K:'ʞ', L:'˥', M:'W', N:'N', O:'O', P:'Ԁ', Q:'Ò', R:'ᴚ', S:'S', T:'⊥', U:'∩', V:'Λ', W:'M', X:'X', Y:'⅄', Z:'Z',
                   '0':'0', '1':'Ɩ', '2':'ᄅ', '3':'Ɛ', '4':'ㄣ', '5':'ϛ', '6':'9', '7':'ㄥ', '8':'8', '9':'6' }
        }
    };

    /* ⭐ Helper: بناء map range */
    function _rangeMap(range, startCode, overrides) {
        overrides = overrides || {};
        var map = {};
        var parts = range.split('-');
        var startChar = parts[0].charCodeAt(0);
        var endChar = parts.length > 1 ? parts[1].charCodeAt(0) : startChar;
        var i = 0;
        for (var c = startChar; c <= endChar; c++) {
            var ch = String.fromCharCode(c);
            if (overrides[ch] !== undefined) {
                map[ch] = String.fromCodePoint(overrides[ch]);
            } else {
                map[ch] = String.fromCodePoint(startCode + i);
            }
            i++;
        }
        return map;
    }

    /* ══════════════════════════════════════════════ */
    /* State                                          */
    /* ══════════════════════════════════════════════ */
    var SM = {
        ctx: 'general',
        tab: 'styled',   // 'styled' | 'fonts'
        state: {
            text: '',
            color: '#ffffff',
            glow: 'none',
            size: DEFAULT_SIZE,
            weight: 'bold',
            italic: false,
            underline: false,
            bg: 'transparent',
            align: 'center',
            ff: 'Cairo'
        },
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

    function toast(icon, msg) {
        if (typeof showToast === 'function') showToast(icon, msg);
        else console.log('[StyledMsgs]', msg);
    }

    function getMe() {
        try {
            if (typeof getCurrentUser === 'function') return getCurrentUser();
        } catch (e) {}
        try {
            return JSON.parse(localStorage.getItem('qamar_current_user') || localStorage.getItem('qamar_user') || 'null');
        } catch (e) { return null; }
    }

    function isGuestUser() {
        var u = getMe();
        return !!(u && u.isGuest === true);
    }

    /* ⭐ Base64 URL-safe */
    function _b64Encode(str) {
        try {
            var utf8 = unescape(encodeURIComponent(str));
            return btoa(utf8)
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');
        } catch (e) {
            console.error('b64 encode failed:', e);
            return '';
        }
    }

    function _b64Decode(b64) {
        try {
            b64 = String(b64).replace(/-/g, '+').replace(/_/g, '/');
            while (b64.length % 4) b64 += '=';
            var utf8 = atob(b64);
            return decodeURIComponent(escape(utf8));
        } catch (e) {
            return '';
        }
    }

    /* ⭐ تحقق من صلاحية المدخلات */
    function _validColor(c) {
        if (!c || typeof c !== 'string') return null;
        c = c.trim();
        if (c === 'transparent' || c === 'none') return c;
        if (/^#[0-9a-fA-F]{3,8}$/.test(c)) return c;
        return null;
    }
    function _validSize(n) {
        n = parseInt(n);
        if (isNaN(n)) return DEFAULT_SIZE;
        return Math.min(MAX_SIZE, Math.max(MIN_SIZE, n));
    }
    function _validFontWeight(w) {
        if (['normal', '600', 'bold', '900'].indexOf(w) !== -1) return w;
        return 'bold';
    }
    function _validAlign(a) {
        if (['right', 'center', 'left'].indexOf(a) !== -1) return a;
        return 'center';
    }
    function _validFontFamily(f) {
        for (var i = 0; i < FONT_FAMILIES.length; i++) {
            if (FONT_FAMILIES[i].id === f) return f;
        }
        return 'Cairo';
    }

    /* ⭐ تطبيق Unicode font */
    function _applyUnicodeFont(text, fontId) {
        var font = UNICODE_FONTS[fontId];
        if (!font || !font.map) return text;
        var out = '';
        for (var i = 0; i < text.length; i++) {
            var ch = text[i];
            out += (font.map[ch] !== undefined) ? font.map[ch] : ch;
        }
        return out;
    }

    /* ⭐ إزالة Unicode font (إرجاع الأصلي) */
    function _stripUnicodeFont(text) {
        // نبني reverse map لكل الـ fonts
        var reverseMap = {};
        Object.keys(UNICODE_FONTS).forEach(function (fid) {
            var f = UNICODE_FONTS[fid];
            Object.keys(f.map).forEach(function (k) {
                reverseMap[f.map[k]] = k;
            });
        });
        var out = '';
        for (var i = 0; i < text.length; i++) {
            // بعض الأحرف (مثل ﷺ) طولها 2 code units — نجرب أول 2 أول
            var two = text.substring(i, i + 2);
            if (reverseMap[two] !== undefined) {
                out += reverseMap[two];
                i++;
                continue;
            }
            var one = text[i];
            if (reverseMap[one] !== undefined) out += reverseMap[one];
            else out += one;
        }
        return out;
    }

    /* ══════════════════════════════════════════════ */
    /* CSS                                            */
    /* ══════════════════════════════════════════════ */
    (function injectCSS() {
        if (document.getElementById('styled-messages-css-v1')) return;
        var s = document.createElement('style');
        s.id = 'styled-messages-css-v1';
        s.textContent = `
/* ═══ Overlay ═══ */
#sm-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.94);
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
#sm-overlay.active { display: flex; }

#sm-box {
    background: #0a0616;
    border: 2px solid #a855f7;
    border-radius: 18px;
    width: 100%;
    max-width: 520px;
    max-height: 92vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.9), 0 0 40px rgba(168,85,247,0.35);
}

#sm-header {
    padding: 14px 16px;
    border-bottom: 1px solid rgba(168,85,247,0.3);
    background: linear-gradient(135deg, rgba(168,85,247,0.2), rgba(0,0,0,0.4));
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
}
#sm-header h3 {
    color: #c084fc;
    margin: 0;
    font-size: 15px;
    font-weight: 900;
    display: flex;
    align-items: center;
    gap: 8px;
}
#sm-close {
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

/* ═══ Tabs ═══ */
#sm-tabs {
    display: flex;
    border-bottom: 1px solid rgba(168,85,247,0.2);
    background: rgba(0,0,0,0.3);
    flex-shrink: 0;
}
.sm-tab {
    flex: 1;
    padding: 12px 8px;
    background: none;
    border: none;
    color: #999;
    font-family: inherit;
    font-size: 12px;
    font-weight: 900;
    cursor: pointer;
    border-bottom: 3px solid transparent;
    transition: all 0.15s;
}
.sm-tab.active {
    color: #c084fc;
    border-bottom-color: #a855f7;
}

/* ═══ Body ═══ */
#sm-body {
    flex: 1;
    overflow-y: auto;
    padding: 14px;
    scrollbar-width: thin;
    scrollbar-color: rgba(168,85,247,0.4) transparent;
}
#sm-body::-webkit-scrollbar { width: 5px; }
#sm-body::-webkit-scrollbar-thumb {
    background: rgba(168,85,247,0.4);
    border-radius: 5px;
}

/* ═══ Preview ═══ */
#sm-preview-wrap {
    padding: 16px;
    background: rgba(0,0,0,0.4);
    border: 2px dashed rgba(168,85,247,0.4);
    border-radius: 12px;
    min-height: 70px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
    overflow: hidden;
}
#sm-preview {
    max-width: 100%;
    word-break: break-word;
    padding: 4px 8px;
    border-radius: 8px;
    transition: all 0.2s;
}

/* ═══ Input ═══ */
#sm-text-input {
    width: 100%;
    min-height: 80px;
    max-height: 160px;
    padding: 12px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(168,85,247,0.4);
    border-radius: 12px;
    color: #fff;
    font-family: inherit;
    font-size: 14px;
    text-align: right;
    resize: vertical;
    outline: none;
    box-sizing: border-box;
    line-height: 1.5;
    margin-bottom: 4px;
}
#sm-text-input:focus { border-color: #c084fc; }
#sm-char-count {
    color: #888;
    font-size: 11px;
    text-align: left;
    margin-bottom: 12px;
}
#sm-char-count.near { color: #ff9800; }
#sm-char-count.at { color: #ff4444; font-weight: 900; }

/* ═══ Groups ═══ */
.sm-group {
    margin-bottom: 14px;
}
.sm-group-title {
    color: #c084fc;
    font-size: 11px;
    font-weight: 900;
    padding: 6px 8px;
    background: rgba(168,85,247,0.1);
    border-radius: 6px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
}

/* ═══ Color Grid ═══ */
.sm-colors {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
.sm-color-btn {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.15);
    cursor: pointer;
    padding: 0;
    transition: all 0.12s;
    position: relative;
}
.sm-color-btn:hover { transform: scale(1.1); }
.sm-color-btn.active {
    border-color: #fff;
    transform: scale(1.15);
    box-shadow: 0 0 10px rgba(255,255,255,0.6);
}
.sm-color-btn.none {
    background:
        linear-gradient(45deg, #666 25%, transparent 25%),
        linear-gradient(-45deg, #666 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #666 75%),
        linear-gradient(-45deg, transparent 75%, #666 75%);
    background-size: 8px 8px;
    background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
    background-color: #0a0a15;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: #999;
    font-weight: 900;
}

/* ═══ Select ═══ */
.sm-select {
    width: 100%;
    padding: 10px 12px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(168,85,247,0.4);
    border-radius: 10px;
    color: #fff;
    font-family: inherit;
    font-size: 13px;
    outline: none;
    text-align: right;
    box-sizing: border-box;
}
.sm-select option { background: #110724; color: #fff; }

/* ═══ Size Slider ═══ */
.sm-slider-row {
    display: flex;
    align-items: center;
    gap: 10px;
}
.sm-slider {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: rgba(255,255,255,0.1);
    -webkit-appearance: none;
    appearance: none;
    outline: none;
}
.sm-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #a855f7;
    cursor: pointer;
    border: 2px solid #000;
}
.sm-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #a855f7;
    cursor: pointer;
    border: 2px solid #000;
}
.sm-slider-val {
    color: #c084fc;
    font-size: 12px;
    font-weight: 900;
    min-width: 30px;
    text-align: center;
}

/* ═══ Toggle buttons ═══ */
.sm-toggle-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}
.sm-toggle {
    flex: 1;
    min-width: 60px;
    padding: 10px 8px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(168,85,247,0.3);
    border-radius: 10px;
    color: #fff;
    font-family: inherit;
    font-size: 12px;
    font-weight: 900;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
}
.sm-toggle:hover { background: rgba(168,85,247,0.15); }
.sm-toggle.active {
    background: linear-gradient(135deg, #a855f7, #7c3aed);
    color: #fff;
    border-color: #c084fc;
    box-shadow: 0 0 10px rgba(168,85,247,0.5);
}

/* ═══ Font Generator Grid ═══ */
.sm-fonts-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
}
.sm-font-item {
    padding: 12px 14px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(168,85,247,0.25);
    border-radius: 10px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    transition: all 0.15s;
}
.sm-font-item:hover {
    background: rgba(168,85,247,0.15);
    border-color: rgba(168,85,247,0.5);
}
.sm-font-item:active { transform: scale(0.99); }
.sm-font-preview {
    color: #fff;
    font-size: 18px;
    font-weight: 900;
    direction: ltr;
    text-align: left;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.sm-font-label {
    color: #c084fc;
    font-size: 10px;
    font-weight: 900;
    flex-shrink: 0;
}
.sm-font-help {
    color: #888;
    font-size: 11px;
    text-align: center;
    padding: 10px;
    background: rgba(168,85,247,0.06);
    border-radius: 8px;
    margin-bottom: 12px;
    line-height: 1.5;
}
.sm-font-btns {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
}
.sm-font-btn {
    flex: 1;
    padding: 8px 10px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(168,85,247,0.3);
    border-radius: 8px;
    color: #fff;
    font-family: inherit;
    font-size: 11px;
    font-weight: 900;
    cursor: pointer;
}
.sm-font-btn:hover { background: rgba(168,85,247,0.2); }

/* ═══ Actions ═══ */
#sm-actions {
    padding: 12px;
    border-top: 1px solid rgba(168,85,247,0.2);
    background: rgba(0,0,0,0.4);
    display: flex;
    gap: 8px;
    flex-shrink: 0;
}
#sm-actions button {
    flex: 1;
    padding: 12px;
    border-radius: 10px;
    border: none;
    font-family: inherit;
    font-size: 14px;
    font-weight: 900;
    cursor: pointer;
}
#sm-send {
    background: linear-gradient(135deg, #a855f7, #7c3aed);
    color: #fff;
}
#sm-send:active { transform: scale(0.97); }
#sm-send:disabled { opacity: 0.6; cursor: wait; }
#sm-cancel {
    background: rgba(255,255,255,0.08);
    color: #fff;
    border: 1px solid rgba(168,85,247,0.3);
}
#sm-reset {
    background: rgba(255,68,68,0.15);
    color: #ff8888;
    border: 1px solid rgba(255,68,68,0.4);
    flex: 0 0 auto;
    padding: 12px 16px;
}

/* ═══ Styled Message in Chat ═══ */
.sm-styled-message {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 10px;
    margin: 2px 0;
    max-width: 100%;
    word-break: break-word;
    line-height: 1.4;
    transition: all 0.15s;
}

/* ═══ Responsive ═══ */
@media (max-width: 480px) {
    #sm-box { border-radius: 14px; max-height: 94vh; }
    #sm-header { padding: 12px; }
    #sm-header h3 { font-size: 13px; }
    #sm-body { padding: 10px; }
    .sm-color-btn { width: 26px; height: 26px; }
    .sm-font-preview { font-size: 16px; }
    .sm-toggle { font-size: 11px; padding: 8px 6px; }
}
        `;
        document.head.appendChild(s);
    })();

    /* ══════════════════════════════════════════════ */
    /* UI                                             */
    /* ══════════════════════════════════════════════ */
    function ensureOverlay() {
        var ov = document.getElementById('sm-overlay');
        if (ov) return ov;

        ov = document.createElement('div');
        ov.id = 'sm-overlay';
        ov.innerHTML =
            '<div id="sm-box">' +
                '<div id="sm-header">' +
                    '<h3>✨ رسائل مميزة</h3>' +
                    '<button id="sm-close" type="button">✕</button>' +
                '</div>' +
                '<div id="sm-tabs">' +
                    '<button class="sm-tab active" data-tab="styled" type="button">✨ نص مميز</button>' +
                    '<button class="sm-tab" data-tab="fonts" type="button">🔤 مولّد الخطوط</button>' +
                '</div>' +
                '<div id="sm-body"></div>' +
                '<div id="sm-actions">' +
                    '<button id="sm-reset" type="button" title="إعادة تعيين">↺</button>' +
                    '<button id="sm-cancel" type="button">إلغاء</button>' +
                    '<button id="sm-send" type="button">📤 إرسال</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(ov);

        ov.querySelector('#sm-close').onclick = close;
        ov.querySelector('#sm-cancel').onclick = close;
        ov.querySelector('#sm-send').onclick = send;
        ov.querySelector('#sm-reset').onclick = resetAll;

        ov.querySelectorAll('.sm-tab').forEach(function (t) {
            t.onclick = function () {
                SM.tab = t.getAttribute('data-tab');
                ov.querySelectorAll('.sm-tab').forEach(function (x) {
                    x.classList.toggle('active', x === t);
                });
                renderTab();
            };
        });

        return ov;
    }

    function renderTab() {
        var body = document.getElementById('sm-body');
        if (!body) return;
        body.innerHTML = '';

        if (SM.tab === 'styled') {
            renderStyledTab(body);
        } else {
            renderFontsTab(body);
        }

        // اربط الأزرار
        setTimeout(_bindControls, 50);
    }

    function renderStyledTab(body) {
        // ─── Preview ───
        var previewWrap = document.createElement('div');
        previewWrap.id = 'sm-preview-wrap';
        var preview = document.createElement('div');
        preview.id = 'sm-preview';
        preview.textContent = SM.state.text || 'معاينة النص...';
        previewWrap.appendChild(preview);
        body.appendChild(previewWrap);

        // ─── Input ───
        var ta = document.createElement('textarea');
        ta.id = 'sm-text-input';
        ta.maxLength = MAX_TEXT_LEN;
        ta.placeholder = 'اكتب رسالتك هنا...';
        ta.value = SM.state.text || '';
        body.appendChild(ta);

        var cnt = document.createElement('div');
        cnt.id = 'sm-char-count';
        cnt.textContent = (SM.state.text || '').length + ' / ' + MAX_TEXT_LEN;
        body.appendChild(cnt);

        // ─── Color ───
        var grpColor = document.createElement('div');
        grpColor.className = 'sm-group';
        grpColor.innerHTML = '<div class="sm-group-title">🎨 لون النص</div><div class="sm-colors" id="sm-text-colors"></div>';
        body.appendChild(grpColor);
        _buildColorsGrid('sm-text-colors', TEXT_COLORS, 'color', false);

        // ─── Glow ───
        var grpGlow = document.createElement('div');
        grpGlow.className = 'sm-group';
        grpGlow.innerHTML = '<div class="sm-group-title">💡 توهج النص</div><div class="sm-colors" id="sm-glow-colors"></div>';
        body.appendChild(grpGlow);
        _buildColorsGrid('sm-glow-colors', GLOW_COLORS, 'glow', true);

        // ─── Background ───
        var grpBg = document.createElement('div');
        grpBg.className = 'sm-group';
        grpBg.innerHTML = '<div class="sm-group-title">🖼️ لون الخلفية</div><div class="sm-colors" id="sm-bg-colors"></div>';
        body.appendChild(grpBg);
        _buildColorsGrid('sm-bg-colors', BG_COLORS, 'bg', true);

        // ─── Font family ───
        var grpFF = document.createElement('div');
        grpFF.className = 'sm-group';
        var ffOpts = FONT_FAMILIES.map(function (f) {
            return '<option value="' + esc(f.id) + '"' + (SM.state.ff === f.id ? ' selected' : '') + '>' + esc(f.label) + '</option>';
        }).join('');
        grpFF.innerHTML = '<div class="sm-group-title">📝 نوع الخط</div><select class="sm-select" id="sm-font-family">' + ffOpts + '</select>';
        body.appendChild(grpFF);

        // ─── Size ───
        var grpSize = document.createElement('div');
        grpSize.className = 'sm-group';
        grpSize.innerHTML =
            '<div class="sm-group-title">📏 الحجم</div>' +
            '<div class="sm-slider-row">' +
                '<input type="range" id="sm-size" class="sm-slider" min="' + MIN_SIZE + '" max="' + MAX_SIZE + '" value="' + SM.state.size + '">' +
                '<span class="sm-slider-val" id="sm-size-val">' + SM.state.size + '</span>' +
            '</div>';
        body.appendChild(grpSize);

        // ─── Weight ───
        var grpWeight = document.createElement('div');
        grpWeight.className = 'sm-group';
        var wBtns = FONT_WEIGHTS.map(function (w) {
            return '<button type="button" class="sm-toggle' + (SM.state.weight === w.id ? ' active' : '') + '" data-weight="' + w.id + '">' + w.label + '</button>';
        }).join('');
        grpWeight.innerHTML = '<div class="sm-group-title">⚖️ سماكة الخط</div><div class="sm-toggle-row" id="sm-weight-row">' + wBtns + '</div>';
        body.appendChild(grpWeight);

        // ─── Italic / Underline ───
        var grpStyle = document.createElement('div');
        grpStyle.className = 'sm-group';
        grpStyle.innerHTML =
            '<div class="sm-group-title">🎨 أنماط إضافية</div>' +
            '<div class="sm-toggle-row">' +
                '<button type="button" class="sm-toggle' + (SM.state.italic ? ' active' : '') + '" id="sm-italic"><i>I</i> مائل</button>' +
                '<button type="button" class="sm-toggle' + (SM.state.underline ? ' active' : '') + '" id="sm-underline"><u>U</u> تحت الخط</button>' +
            '</div>';
        body.appendChild(grpStyle);

        // ─── Align ───
        var grpAlign = document.createElement('div');
        grpAlign.className = 'sm-group';
        var aBtns = ALIGNS.map(function (a) {
            return '<button type="button" class="sm-toggle' + (SM.state.align === a.id ? ' active' : '') + '" data-align="' + a.id + '">' + a.label + '</button>';
        }).join('');
        grpAlign.innerHTML = '<div class="sm-group-title">↔ المحاذاة</div><div class="sm-toggle-row" id="sm-align-row">' + aBtns + '</div>';
        body.appendChild(grpAlign);
    }

    function renderFontsTab(body) {
        // ─── Help ───
        var help = document.createElement('div');
        help.className = 'sm-font-help';
        help.innerHTML = '🔤 حوّل الأحرف اللاتينية والأرقام إلى خطوط مزخرفة.<br>الحروف العربية تبقى كما هي.';
        body.appendChild(help);

        // ─── Input ───
        var ta = document.createElement('textarea');
        ta.id = 'sm-text-input';
        ta.maxLength = MAX_TEXT_LEN;
        ta.placeholder = 'اكتب هنا... (اكتب بالإنجليزية/الأرقام للتحويل)';
        // ⭐ نعرض النص بدون Unicode fonts (الأصلي)
        ta.value = SM.state.text || '';
        body.appendChild(ta);

        var cnt = document.createElement('div');
        cnt.id = 'sm-char-count';
        cnt.textContent = (SM.state.text || '').length + ' / ' + MAX_TEXT_LEN;
        body.appendChild(cnt);

        // ─── Buttons ───
        var btns = document.createElement('div');
        btns.className = 'sm-font-btns';
        btns.innerHTML =
            '<button class="sm-font-btn" id="sm-font-clear" type="button">🧹 مسح الخط</button>' +
            '<button class="sm-font-btn" id="sm-font-copy" type="button">📋 نسخ النص</button>';
        body.appendChild(btns);

        // ─── Grid ───
        var grp = document.createElement('div');
        grp.className = 'sm-group';
        grp.innerHTML = '<div class="sm-group-title">🔤 اختر خطاً</div>';
        var grid = document.createElement('div');
        grid.className = 'sm-fonts-grid';

        Object.keys(UNICODE_FONTS).forEach(function (fid) {
            var f = UNICODE_FONTS[fid];
            var item = document.createElement('div');
            item.className = 'sm-font-item';
            item.setAttribute('data-font', fid);

            var previewSpan = document.createElement('div');
            previewSpan.className = 'sm-font-preview';
            // المعاينة: لو في نص → نطبق الخط على النص، وإلا نعرض preview الافتراضي
            var sampleText = SM.state.text || 'Abc 123';
            previewSpan.textContent = _applyUnicodeFont(sampleText, fid);

            var labelSpan = document.createElement('div');
            labelSpan.className = 'sm-font-label';
            labelSpan.textContent = f.label;

            item.appendChild(previewSpan);
            item.appendChild(labelSpan);

            item.onclick = function () {
                // احفظ النص الأصلي (بدون Unicode) ثم طبّق
                var orig = _stripUnicodeFont(SM.state.text || '');
                // نبني النص الجديد مع الـ font
                var newText = _applyUnicodeFont(orig, fid);
                SM.state.text = newText;
                // حدّث الـ textarea + المعاينات
                var ta2 = document.getElementById('sm-text-input');
                if (ta2) ta2.value = SM.state.text;
                _updateFontPreviews();
                _updatePreview();
                toast('fa-check', '✅ طبّق ' + f.label);
            };

            grid.appendChild(item);
        });

        grp.appendChild(grid);
        body.appendChild(grp);
    }

    function _updateFontPreviews() {
        var items = document.querySelectorAll('.sm-font-item');
        items.forEach(function (item) {
            var fid = item.getAttribute('data-font');
            var previewSpan = item.querySelector('.sm-font-preview');
            if (!previewSpan) return;
            var orig = _stripUnicodeFont(SM.state.text || '');
            var sampleText = orig || 'Abc 123';
            previewSpan.textContent = _applyUnicodeFont(sampleText, fid);
        });
    }

    function _buildColorsGrid(containerId, colors, key, allowNone) {
        var container = document.getElementById(containerId);
        if (!container) return;

        colors.forEach(function (c) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'sm-color-btn';
            b.setAttribute('data-key', key);
            b.setAttribute('data-color', c);

            if (c === 'transparent' || c === 'none') {
                b.classList.add('none');
                b.textContent = '✕';
                b.title = (c === 'none' ? 'بدون' : 'شفاف');
            } else {
                b.style.background = c;
                b.title = c;
            }

            if (SM.state[key] === c) b.classList.add('active');

            b.onclick = function () {
                SM.state[key] = c;
                container.querySelectorAll('.sm-color-btn').forEach(function (x) {
                    x.classList.remove('active');
                });
                b.classList.add('active');
                _updatePreview();
            };

            container.appendChild(b);
        });
    }

    function _bindControls() {
        // Text input
        var ta = document.getElementById('sm-text-input');
        if (ta && !ta.__bound) {
            ta.__bound = true;
            ta.addEventListener('input', function () {
                SM.state.text = this.value;
                var cnt = document.getElementById('sm-char-count');
                if (cnt) {
                    cnt.textContent = this.value.length + ' / ' + MAX_TEXT_LEN;
                    cnt.className = '';
                    if (this.value.length >= MAX_TEXT_LEN) cnt.classList.add('at');
                    else if (this.value.length > MAX_TEXT_LEN * 0.85) cnt.classList.add('near');
                }
                _updatePreview();
                if (SM.tab === 'fonts') _updateFontPreviews();
            });
        }

        // Font family
        var ffSel = document.getElementById('sm-font-family');
        if (ffSel && !ffSel.__bound) {
            ffSel.__bound = true;
            ffSel.onchange = function () {
                SM.state.ff = _validFontFamily(this.value);
                _updatePreview();
            };
        }

        // Size
        var sizeSlider = document.getElementById('sm-size');
        if (sizeSlider && !sizeSlider.__bound) {
            sizeSlider.__bound = true;
            sizeSlider.oninput = function () {
                SM.state.size = _validSize(this.value);
                var v = document.getElementById('sm-size-val');
                if (v) v.textContent = SM.state.size;
                _updatePreview();
            };
        }

        // Weight
        var wRow = document.getElementById('sm-weight-row');
        if (wRow && !wRow.__bound) {
            wRow.__bound = true;
            wRow.querySelectorAll('[data-weight]').forEach(function (b) {
                b.onclick = function () {
                    SM.state.weight = _validFontWeight(b.getAttribute('data-weight'));
                    wRow.querySelectorAll('[data-weight]').forEach(function (x) {
                        x.classList.remove('active');
                    });
                    b.classList.add('active');
                    _updatePreview();
                };
            });
        }

        // Italic
        var italicBtn = document.getElementById('sm-italic');
        if (italicBtn && !italicBtn.__bound) {
            italicBtn.__bound = true;
            italicBtn.onclick = function () {
                SM.state.italic = !SM.state.italic;
                italicBtn.classList.toggle('active', SM.state.italic);
                _updatePreview();
            };
        }

        // Underline
        var ulBtn = document.getElementById('sm-underline');
        if (ulBtn && !ulBtn.__bound) {
            ulBtn.__bound = true;
            ulBtn.onclick = function () {
                SM.state.underline = !SM.state.underline;
                ulBtn.classList.toggle('active', SM.state.underline);
                _updatePreview();
            };
        }

        // Align
        var aRow = document.getElementById('sm-align-row');
        if (aRow && !aRow.__bound) {
            aRow.__bound = true;
            aRow.querySelectorAll('[data-align]').forEach(function (b) {
                b.onclick = function () {
                    SM.state.align = _validAlign(b.getAttribute('data-align'));
                    aRow.querySelectorAll('[data-align]').forEach(function (x) {
                        x.classList.remove('active');
                    });
                    b.classList.add('active');
                    _updatePreview();
                };
            });
        }

        // Font-clear (tab fonts)
        var clearBtn = document.getElementById('sm-font-clear');
        if (clearBtn && !clearBtn.__bound) {
            clearBtn.__bound = true;
            clearBtn.onclick = function () {
                SM.state.text = _stripUnicodeFont(SM.state.text || '');
                var ta2 = document.getElementById('sm-text-input');
                if (ta2) ta2.value = SM.state.text;
                _updateFontPreviews();
                _updatePreview();
                toast('fa-check', '🧹 تم المسح');
            };
        }

        // Font-copy
        var copyBtn = document.getElementById('sm-font-copy');
        if (copyBtn && !copyBtn.__bound) {
            copyBtn.__bound = true;
            copyBtn.onclick = function () {
                var txt = SM.state.text || '';
                if (!txt) return;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(txt).then(function () {
                        toast('fa-check', '📋 نُسخ');
                    }).catch(function () {
                        toast('fa-times', '⚠️ فشل');
                    });
                } else {
                    toast('fa-info-circle', '📋 المتصفح لا يدعم');
                }
            };
        }
    }

    function _updatePreview() {
        var preview = document.getElementById('sm-preview');
        if (!preview) return;
        preview.textContent = SM.state.text || 'معاينة النص...';
        _applyStateTo(preview, SM.state);
    }

    function _applyStateTo(el, s) {
        if (!el) return;
        el.style.color = (s.color && s.color !== 'transparent') ? s.color : '#ffffff';
        el.style.fontSize = s.size + 'px';
        el.style.fontWeight = s.weight;
        el.style.fontStyle = s.italic ? 'italic' : 'normal';
        el.style.textDecoration = s.underline ? 'underline' : 'none';
        el.style.textAlign = s.align;
        el.style.fontFamily = s.ff + ', Cairo, sans-serif';
        el.style.background = (s.bg && s.bg !== 'transparent') ? s.bg : 'transparent';
        if (s.glow && s.glow !== 'none') {
            el.style.textShadow = '0 0 6px ' + s.glow + ', 0 0 12px ' + s.glow;
        } else {
            el.style.textShadow = 'none';
        }
    }

    /* ══════════════════════════════════════════════ */
    /* Open / Close / Reset                           */
    /* ══════════════════════════════════════════════ */
    function open(ctx) {
        if (isGuestUser()) {
            toast('fa-user-secret', '🕵️ هذه الميزة للأعضاء فقط');
            return;
        }

        SM.ctx = ctx || 'general';
        SM.tab = 'styled';
        // إعادة تعيين النص فقط (نحفظ الإعدادات)
        SM.state.text = '';

        var ov = ensureOverlay();
        ov.querySelectorAll('.sm-tab').forEach(function (x) {
            x.classList.toggle('active', x.getAttribute('data-tab') === 'styled');
        });

        renderTab();
        ov.classList.add('active');

        setTimeout(function () {
            var ta = document.getElementById('sm-text-input');
            if (ta) ta.focus();
        }, 200);
    }

    function close() {
        var ov = document.getElementById('sm-overlay');
        if (ov) ov.classList.remove('active');
    }

    function resetAll() {
        SM.state = {
            text: '',
            color: '#ffffff',
            glow: 'none',
            size: DEFAULT_SIZE,
            weight: 'bold',
            italic: false,
            underline: false,
            bg: 'transparent',
            align: 'center',
            ff: 'Cairo'
        };
        renderTab();
        toast('fa-check', '↺ تم');
    }

    /* ══════════════════════════════════════════════ */
    /* Send → insert token                            */
    /* ══════════════════════════════════════════════ */
    function send() {
        var text = (SM.state.text || '').trim();
        if (!text) {
            toast('fa-times', '⚠️ اكتب نصاً');
            return;
        }

        if (SM.tab === 'fonts') {
            // في تبويب الخطوط: نضع النص فقط (بدون token)
            var targetId = (SM.ctx === 'private') ? 'pc-input' : 'message-input';
            var inp = document.getElementById(targetId);
            if (inp) {
                var cur = inp.value;
                inp.value = (cur ? cur + ' ' : '') + text + ' ';
                try { inp.focus(); } catch (e) {}
                toast('fa-check', '✅ تم');
                close();
            }
            return;
        }

        // تبويب النص المميز → نبني token
        var payload = {
            t: text,
            c: SM.state.color,
            g: SM.state.glow,
            s: SM.state.size,
            w: SM.state.weight,
            i: SM.state.italic ? 1 : 0,
            u: SM.state.underline ? 1 : 0,
            bg: SM.state.bg,
            a: SM.state.align,
            f: SM.state.ff
        };

        var json = JSON.stringify(payload);
        var b64 = _b64Encode(json);
        if (!b64) {
            toast('fa-times', '⚠️ فشل التشفير');
            return;
        }

        var token = '[sty:' + b64 + ']';
        var targetId = (SM.ctx === 'private') ? 'pc-input' : 'message-input';
        var inp = document.getElementById(targetId);
        if (!inp) {
            toast('fa-times', '⚠️ لا يوجد حقل');
            return;
        }
        var cur = inp.value;
        inp.value = (cur ? cur + ' ' : '') + token + ' ';
        try { inp.focus(); } catch (e) {}
        toast('fa-check', '✅ تم — اضغط إرسال');
        close();
    }

    /* ══════════════════════════════════════════════ */
    /* Token parser                                   */
    /* ══════════════════════════════════════════════ */
    function _parseStyledToken(text) {
        if (!text || typeof text !== 'string') return null;
        if (text.indexOf('[sty:') === -1) return null;
        var regex = /\[sty:([A-Za-z0-9_\-]+)\]/g;
        var parts = [];
        var lastIdx = 0, m;
        while ((m = regex.exec(text)) !== null) {
            if (m.index > lastIdx) parts.push({ type: 'text', value: text.substring(lastIdx, m.index) });
            parts.push({ type: 'styled', payload: m[1] });
            lastIdx = regex.lastIndex;
        }
        if (lastIdx < text.length) parts.push({ type: 'text', value: text.substring(lastIdx) });
        return parts.length ? parts : null;
    }

    function _decodeStyledPayload(b64) {
        try {
            var json = _b64Decode(b64);
            if (!json) return null;
            var data = JSON.parse(json);
            if (!data || typeof data !== 'object') return null;

            // تحقق من الصلاحيات
            return {
                t:  String(data.t || '').substring(0, MAX_TEXT_LEN),
                c:  _validColor(data.c) || '#ffffff',
                g:  _validColor(data.g) || 'none',
                s:  _validSize(data.s),
                w:  _validFontWeight(data.w),
                i:  data.i === 1 || data.i === true,
                u:  data.u === 1 || data.u === true,
                bg: _validColor(data.bg) || 'transparent',
                a:  _validAlign(data.a),
                f:  _validFontFamily(data.f)
            };
        } catch (e) {
            console.warn('styled decode failed:', e);
            return null;
        }
    }

    /* ══════════════════════════════════════════════ */
    /* Render styled message                          */
    /* ══════════════════════════════════════════════ */
    function _buildStyledEl(data) {
        var span = document.createElement('span');
        span.className = 'sm-styled-message';
        span.textContent = data.t;
        span.style.color = (data.c && data.c !== 'transparent') ? data.c : '#ffffff';
        span.style.fontSize = data.s + 'px';
        span.style.fontWeight = data.w;
        span.style.fontStyle = data.i ? 'italic' : 'normal';
        span.style.textDecoration = data.u ? 'underline' : 'none';
        span.style.textAlign = data.a;
        span.style.fontFamily = data.f + ', Cairo, sans-serif';
        span.style.display = 'inline-block';
        span.style.background = (data.bg && data.bg !== 'transparent') ? data.bg : 'transparent';
        span.style.maxWidth = '100%';
        span.style.wordBreak = 'break-word';
        span.style.borderRadius = '8px';
        span.style.padding = '4px 10px';
        span.style.lineHeight = '1.4';
        if (data.g && data.g !== 'none') {
            span.style.textShadow = '0 0 6px ' + data.g + ', 0 0 12px ' + data.g;
        }
        return span;
    }

    /* ══════════════════════════════════════════════ */
    /* Process DOM                                    */
    /* ══════════════════════════════════════════════ */
    function _processElement(rootEl) {
        if (!rootEl || rootEl.nodeType !== 1) return;
        if (SM._processed.has(rootEl)) return;
        SM._processed.add(rootEl);

        var walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
        var toProcess = [];
        while (walker.nextNode()) {
            var val = walker.currentNode.nodeValue;
            if (val && val.indexOf('[sty:') !== -1) {
                toProcess.push(walker.currentNode);
            }
        }

        toProcess.forEach(function (textNode) {
            var parts = _parseStyledToken(textNode.nodeValue);
            if (!parts) return;

            var frag = document.createDocumentFragment();
            parts.forEach(function (p) {
                if (p.type === 'text') {
                    if (p.value) frag.appendChild(document.createTextNode(p.value));
                } else if (p.type === 'styled') {
                    var data = _decodeStyledPayload(p.payload);
                    if (data && data.t) {
                        frag.appendChild(_buildStyledEl(data));
                    } else {
                        // failed → اترك الـ token كما هو
                        frag.appendChild(document.createTextNode('[sty:' + p.payload + ']'));
                    }
                }
            });

            if (textNode.parentNode) {
                textNode.parentNode.replaceChild(frag, textNode);
            }
        });
    }

    /* ══════════════════════════════════════════════ */
    /* Observers                                      */
    /* ══════════════════════════════════════════════ */
    function installObserver(containerId) {
        var container = document.getElementById(containerId);
        if (!container) return false;
        if (container.__smObserved) return true;
        container.__smObserved = true;
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
        // عالج الموجود مسبقاً
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
    /* Override floating toolbar buttons              */
    /* ══════════════════════════════════════════════ */
    function _overrideInsertEmoji() {
        // لو حابين نضيف زر "✨" قريب من الأزرار الأخرى
        // (يتم عبر floating-toolbar-v2 أو index.html مباشرة)
    }

    /* ══════════════════════════════════════════════ */
    /* Init                                           */
    /* ══════════════════════════════════════════════ */
    function init() {
        installAllObservers();
        console.log('✨ StyledMessages: observers ready');
    }

    /* ══════════════════════════════════════════════ */
    /* Public API                                     */
    /* ══════════════════════════════════════════════ */
    window.StyledMessages = {
        open: open,
        close: close,
        reset: resetAll,
        send: send,
        applyUnicodeFont: _applyUnicodeFont,
        stripUnicodeFont: _stripUnicodeFont,
        version: 1
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('✨ styled-messages.js v1 (TEST) loaded — styled + font generator + [sty:BASE64]');
})();
