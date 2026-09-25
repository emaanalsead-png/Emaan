// ==============================================
// link-fix.js v1 — تجاوز isLink للتوكنات
// ==============================================
// ✅ v1:
//   1. Override مباشر على window.isLink
//   2. يستبعد [paint:], [yt:], [sty:], [audio:], [e:], [cu:], [img:]
//   3. مستقل — لا يلمس utils.js
//   4. يعمل حتى لو utils.js قديم
// ==============================================

(function () {
    'use strict';
    if (window.__linkFixV1) return;
    window.__linkFixV1 = true;

    function newIsLink(text) {
        if (!text) return false;

        // ⭐ استبعاد كل التوكنات الداخلية
        var cleaned = String(text)
            .replace(/\[img:[^\]]+\]/gi, '')
            .replace(/\[e:\d+\]/gi, '')
            .replace(/\[cu:[^\]]+\]/gi, '')
            .replace(/\[sticker:[^\]]+\]/gi, '')
            .replace(/\[paint:[^\]]+\]/gi, '')
            .replace(/\[yt:[a-zA-Z0-9_-]{11}\]/gi, '')
            .replace(/\[sty:[A-Za-z0-9_\-]+=*\]/gi, '')
            .replace(/\[audio:[^\]]+\]/gi, '');

        // إذا النص الأصلي كان مجرد توكن → مش رابط
        if (!cleaned.trim()) return false;

        // الآن نبحث عن روابط حقيقية
        var patterns = [
            /(https?:\/\/[^\s]+)/i,
            /(www\.[^\s]+)/i,
            /([a-z0-9-]+\.(com|net|org|io|ly|co|me|info|xyz|app|dev|tv|fm|link|sh|to|cc|ru|cn|tk))(\/[^\s]*)?/i,
            /(bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly)/i
        ];
        return patterns.some(function (p) { return p.test(cleaned); });
    }

    // Override ناعم
    window.isLink = newIsLink;

    console.log('✅ link-fix.js v1 loaded — isLink overridden (tokens ignored)');
})();
