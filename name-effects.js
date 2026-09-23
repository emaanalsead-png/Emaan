// ==============================================
// name-effects.js v8 — 20 نمط سينمائي
// ==============================================
// ✅ v8:
//   1. CINEMA_STYLES موحّد مع targets
//   2. CINEMA_TEXT_STYLES + CINEMA_BG_STYLES
//   3. 20 نمط للخلفية (11 جديد)
//   4. باقي المنطق كما v7
// ==============================================

(function () {
    'use strict';
    if (window.__nameEffectsV8) return;
    window.__nameEffectsV8 = true;

    const SUGAR_COLORS = [
        '#ff0000', '#ffd700', '#00ff88', '#00f3ff', '#a855f7',
        '#ff0080', '#ff8c00', '#39ff14', '#00bfff', '#ff69b4'
    ];

    // ⭐ v8: قائمة موحّدة مع targets
    const CINEMA_STYLES = [
        { id: '',             label: 'بدون',             icon: '❌', targets: ['text','bg'] },
        // ══ الأنماط المشتركة (نص + خلفية) ══
        { id: 'multicolor',   label: 'ألوان متعددة',     icon: '🌈', targets: ['text','bg'] },
        { id: 'spiral',       label: 'حلزون',             icon: '🌀', targets: ['text','bg'] },
        { id: 'nebula',       label: 'سديم',              icon: '🌌', targets: ['text','bg'] },
        { id: 'storm',        label: 'عاصفة رعدية',       icon: '⚡', targets: ['text','bg'] },
        { id: 'fireworks',    label: 'أضواء العيد',       icon: '🎆', targets: ['text','bg'] },
        { id: 'sugar',        label: 'حبات السكر',        icon: '✨', targets: ['text','bg'] },
        { id: 'snow',         label: 'ثلج',               icon: '❄️', targets: ['text','bg'] },
        { id: 'volcano',      label: 'براكين',            icon: '🌋', targets: ['text','bg'] },
        { id: 'waves',        label: 'أمواج',             icon: '🌊', targets: ['text','bg'] },
        // ══ خلفيات إضافية (bg فقط) ══
        { id: 'gold',         label: 'ذهبي فاخر',         icon: '👑', targets: ['bg'] },
        { id: 'sunset',       label: 'غروب',              icon: '🌅', targets: ['bg'] },
        { id: 'aurora',       label: 'شفق قطبي',          icon: '🌠', targets: ['bg'] },
        { id: 'ocean',        label: 'محيط',              icon: '💧', targets: ['bg'] },
        { id: 'galaxy',       label: 'مجرة',              icon: '🌌', targets: ['bg'] },
        { id: 'fire',         label: 'نار',               icon: '🔥', targets: ['bg'] },
        { id: 'neon',         label: 'نيون',              icon: '💜', targets: ['bg'] },
        { id: 'emerald',      label: 'زمرد',              icon: '💚', targets: ['bg'] },
        { id: 'diamond',      label: 'ماسي',              icon: '💎', targets: ['bg'] },
        { id: 'blood',        label: 'دماء',              icon: '🩸', targets: ['bg'] },
        { id: 'cyber',        label: 'سايبر',             icon: '🤖', targets: ['bg'] },
        { id: 'rainbowtext',  label: 'قوس قزح متحرك',     icon: '🌈', targets: ['bg'] },
        { id: 'royal',        label: 'ملكي',              icon: '⚜️', targets: ['bg'] }
    ];

    // مشتقة من القائمة الموحّدة
    const CINEMA_TEXT_STYLES = CINEMA_STYLES
        .filter(function (s) { return s.targets.indexOf('text') !== -1; })
        .map(function (s) { return s.id; });

    const CINEMA_BG_STYLES = CINEMA_STYLES
        .filter(function (s) { return s.targets.indexOf('bg') !== -1; })
        .map(function (s) { return s.id; });

    // الأنماط التي تحتاج تقسيم حروف
    const SPLIT_STYLES = ['multicolor', 'sugar'];

    /* ══════════════════════════════════════════════ */
    /* Helpers                                        */
    /* ══════════════════════════════════════════════ */
    function _isValidColor(c) {
        if (!c || typeof c !== 'string') return false;
        return /^#[0-9a-fA-F]{3,8}$|^rgb\(|^rgba\(|^hsl\(|^hsla\(/.test(c.trim());
    }

    function _isValidGradient(g) {
        if (!Array.isArray(g) || g.length < 2) return false;
        return _isValidColor(g[0]) && _isValidColor(g[1]);
    }

    function _gradientHash(grad) {
        if (!Array.isArray(grad)) return 0;
        let h = 0;
        for (let i = 0; i < grad.length; i++) {
            const c = grad[i];
            for (let k = 0; k < c.length; k++) {
                h = ((h * 31) + c.charCodeAt(k)) >>> 0;
            }
        }
        return h;
    }

    function _buildGradient(colors, hashSeed) {
        if (!_isValidGradient(colors)) return '';
        const ANGLES = [90, 135, 45, 120, 60, 150, 30, 180, 75, 105, 15, 165];
        const seed = (typeof hashSeed === 'number') ? hashSeed : 0;
        const angle = ANGLES[seed % ANGLES.length];
        const dir = angle + 'deg';

        if (colors.length === 2) {
            return 'repeating-linear-gradient(' + dir + ', ' +
                colors[0] + ' 0%, ' +
                colors[1] + ' 50%, ' +
                colors[0] + ' 100%)';
        }
        const stops = colors.map(function (c, i) {
            const pct = (i / (colors.length - 1)) * 100;
            return c + ' ' + pct.toFixed(1) + '%';
        });
        return 'linear-gradient(' + dir + ', ' + stops.join(', ') + ')';
    }

    function _buildNameBg(bgColor, bgGradient) {
        if (Array.isArray(bgGradient) && bgGradient.length >= 2) {
            return _buildGradient(bgGradient, _gradientHash(bgGradient));
        }
        if (_isValidColor(bgColor)) return bgColor;
        return '';
    }

    function _extractBgGlowColor(bgColor, bgGradient) {
        if (Array.isArray(bgGradient) && bgGradient.length >= 2 && _isValidColor(bgGradient[0])) {
            return bgGradient[0];
        }
        if (_isValidColor(bgColor)) return bgColor;
        return 'transparent';
    }

    function _getFallbackColor(params) {
        if (params && _isValidColor(params.color)) return params.color;
        return '#ffd700';
    }

    function _hasChars(el) {
        return el.querySelector('.nc') !== null;
    }

    function _splitToChars(el, styleId, target) {
        const originalText = el.dataset.originalText || el.dataset.name || el.textContent || '';
        el.dataset.originalText = originalText;

        el.innerHTML = '';

        for (let i = 0; i < originalText.length; i++) {
            const ch = originalText[i];
            const span = document.createElement('span');
            span.className = 'nc';
            span.setAttribute('data-ci', i);
            span.textContent = (ch === ' ') ? '\u00A0' : ch;

            if (styleId === 'sugar') {
                const color = SUGAR_COLORS[i % SUGAR_COLORS.length];
                if (target === 'text') {
                    span.style.setProperty('--sugar-color', color);
                } else {
                    span.style.setProperty('--sugar-bg-color', _hexToRgba(color, 0.4));
                }
            }

            el.appendChild(span);
        }
    }

    function _hexToRgba(hex, alpha) {
        if (!hex || hex.charAt(0) !== '#') return 'rgba(255,255,255,' + alpha + ')';
        let h = hex.substring(1);
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        const r = parseInt(h.substring(0, 2), 16);
        const g = parseInt(h.substring(2, 4), 16);
        const b = parseInt(h.substring(4, 6), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }

    function _maybeUnsplit(el) {
        const textStyle = el.getAttribute('data-cinema-text');
        const bgStyle = el.getAttribute('data-cinema-bg');

        const textNeedsSplit = SPLIT_STYLES.indexOf(textStyle) !== -1;
        const bgNeedsSplit = SPLIT_STYLES.indexOf(bgStyle) !== -1;

        if (textNeedsSplit || bgNeedsSplit) return;

        if (el.dataset.originalText !== undefined) {
            const original = el.dataset.originalText;
            el.innerHTML = '';
            el.textContent = original;
            delete el.dataset.originalText;
        }
    }

    /* ⭐ v8: applyCinemaStyle مع قائمتين */
    function applyCinemaStyle(el, styleId, target) {
        if (!el) return;
        target = target || 'text';

        const attrName = (target === 'text') ? 'data-cinema-text' : 'data-cinema-bg';
        const splitClass = (target === 'text') ? 'cinema-split' : 'cinema-split-bg';

        el.removeAttribute(attrName);
        el.classList.remove(splitClass);

        if (target === 'text') {
            el.classList.remove('has-gradient');
            el.style.removeProperty('--name-gradient');
        } else {
            el.classList.remove('has-bg', 'has-bg-gradient');
            el.style.removeProperty('--name-bg');
            el.style.removeProperty('--name-bg-glow');
        }

        if (!styleId) {
            _maybeUnsplit(el);
            return;
        }

        // ⭐ v8: تحقق حسب target
        const validList = (target === 'text') ? CINEMA_TEXT_STYLES : CINEMA_BG_STYLES;
        if (validList.indexOf(styleId) === -1) {
            console.warn('Unknown cinema style:', styleId, 'for target:', target);
            return;
        }

        el.setAttribute(attrName, styleId);

        const needsSplit = SPLIT_STYLES.indexOf(styleId) !== -1;
        if (needsSplit) {
            if (!_hasChars(el)) {
                _splitToChars(el, styleId, target);
            } else {
                _applyColorsToExistingChars(el, styleId, target);
            }
            el.classList.add(splitClass);
        } else {
            _maybeUnsplit(el);
        }
    }

    function _applyColorsToExistingChars(el, styleId, target) {
        const spans = el.querySelectorAll('.nc');
        spans.forEach(function (span, i) {
            if (styleId === 'sugar') {
                const color = SUGAR_COLORS[i % SUGAR_COLORS.length];
                if (target === 'text') {
                    span.style.setProperty('--sugar-color', color);
                } else {
                    span.style.setProperty('--sugar-bg-color', _hexToRgba(color, 0.4));
                }
            }
        });
    }

    function apply(el, params) {
        if (!el) return;
        params = params || {};

        _cleanClasses(el);
        _cleanVars(el);

        el.classList.add('name-styled');

        const nameColor    = params.nameColor    || null;
        const nameGradient = params.nameGradient || null;
        const nameBgColor  = params.nameBgColor  || null;
        const nameBgGrad   = params.nameBgGradient || null;
        const fallbackColor = _getFallbackColor(params);

        const hasBg = (!!nameBgColor && _isValidColor(nameBgColor)) ||
                      (Array.isArray(nameBgGrad) && nameBgGrad.length >= 2);

        const hasGradient = Array.isArray(nameGradient) && nameGradient.length >= 2
                            && _isValidColor(nameGradient[0]) && _isValidColor(nameGradient[1]);

        const hasColor = !!nameColor && _isValidColor(nameColor);

        const hasCinemaText = !!el.getAttribute('data-cinema-text');
        const hasCinemaBg = !!el.getAttribute('data-cinema-bg');

        if (!hasBg && !hasGradient && !hasColor) {
            if (!hasCinemaText) el.style.color = fallbackColor;
            return;
        }

        if (hasBg && !hasGradient && !hasColor) {
            if (!hasCinemaBg) _applyBg(el, nameBgColor, nameBgGrad);
            if (!hasCinemaText) el.style.color = fallbackColor;
            return;
        }

        if (hasColor && !hasGradient) {
            if (hasBg && !hasCinemaBg) _applyBg(el, nameBgColor, nameBgGrad);
            if (!hasCinemaText) {
                el.style.setProperty('--name-color', nameColor);
                el.style.color = nameColor;
            }
            return;
        }

        if (hasGradient && !hasCinemaText) {
            if (hasBg && !hasCinemaBg) _applyBg(el, nameBgColor, nameBgGrad);

            const baseColor = hasColor ? nameColor : fallbackColor;
            el.style.setProperty('--name-color', baseColor);
            el.style.color = baseColor;

            el.classList.add('has-gradient');

            if (!params.skipDataText) {
                const currentText = el.dataset.name || el.textContent || '';
                el.setAttribute('data-text', currentText);
            }

            const gradStr = _buildGradient(nameGradient, _gradientHash(nameGradient));
            if (gradStr) {
                el.style.setProperty('--name-gradient', gradStr);
            }
            return;
        }
    }

    function _applyBg(el, bgColor, bgGrad) {
        const bgValue = _buildNameBg(bgColor, bgGrad);
        if (!bgValue) return;

        el.classList.add('has-bg');

        if (Array.isArray(bgGrad) && bgGrad.length >= 2) {
            el.classList.add('has-bg-gradient');
        }

        el.style.setProperty('--name-bg', bgValue);

        const glowColor = _extractBgGlowColor(bgColor, bgGrad);
        if (glowColor !== 'transparent') {
            el.style.setProperty('--name-bg-glow', glowColor);
        }
    }

    function _cleanClasses(el) {
        el.classList.remove(
            'has-bg',
            'has-bg-gradient',
            'has-gradient',
            'name-color-only',
            'name-gradient-only'
        );
        if (!el.classList.contains('name-styled')) {
            el.classList.add('name-styled');
        }
    }

    function _cleanVars(el) {
        el.style.removeProperty('--name-color');
        el.style.removeProperty('--name-bg');
        el.style.removeProperty('--name-bg-glow');
        el.style.removeProperty('--name-gradient');
        el.style.removeProperty('--name-gradient-opacity');
        if (!el.getAttribute('data-cinema-text') && !el.getAttribute('data-cinema-bg')) {
            el.style.color = '';
        }
    }

    function clear(el) {
        if (!el) return;
        _cleanClasses(el);
        _cleanVars(el);
        el.removeAttribute('data-cinema-text');
        el.removeAttribute('data-cinema-bg');
        el.classList.remove('cinema-split', 'cinema-split-bg');
        _maybeUnsplit(el);
    }

    function applyDefaultAvatarFrame(box, rank, level) {
        if (!box) return;
        box.classList.remove(
            'default-frame-gold', 'default-frame-pink',
            'default-frame-silver', 'default-frame-gray'
        );
        if (box.querySelector('.qf')) return;
        const map = (typeof QAMAR !== 'undefined' && QAMAR.DEFAULT_AVATAR_FRAMES)
            ? QAMAR.DEFAULT_AVATAR_FRAMES : null;
        if (!map) return;
        const frameType = map[rank] || 'gray';
        if (frameType && frameType !== 'none') {
            box.classList.add('default-frame-' + frameType);
        }
    }

    function clearDefaultAvatarFrame(box) {
        if (!box) return;
        box.classList.remove(
            'default-frame-gold', 'default-frame-pink',
            'default-frame-silver', 'default-frame-gray'
        );
    }

    function previewTemplate(text, params, extraClass) {
        const el = document.createElement('div');
        el.className = 'name-grid-item' + (extraClass ? ' ' + extraClass : '');
        el.dataset.previewName = text || '';
        const inner = document.createElement('span');
        inner.className = 'name-styled';
        inner.textContent = text || '';
        inner.setAttribute('data-name', text || '');
        inner.setAttribute('data-text', text || '');
        el.appendChild(inner);
        apply(inner, params);
        return el;
    }

    window.NameEffects = {
        apply: apply,
        applyCinemaStyle: applyCinemaStyle,
        clear: clear,
        applyDefaultAvatarFrame: applyDefaultAvatarFrame,
        clearDefaultAvatarFrame: clearDefaultAvatarFrame,
        previewTemplate: previewTemplate,
        buildGradient: _buildGradient,
        isValidColor: _isValidColor,
        isValidGradient: _isValidGradient,
        CINEMA_STYLES: CINEMA_STYLES,
        CINEMA_TEXT_STYLES: CINEMA_TEXT_STYLES,
        CINEMA_BG_STYLES: CINEMA_BG_STYLES,
        SUGAR_COLORS: SUGAR_COLORS
    };

    console.log('✅ name-effects.js v8 loaded — 20 cinema bg styles');
})();
