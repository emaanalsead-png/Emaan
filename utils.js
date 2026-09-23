// ==============================================
// قمر الشام - دوال مساعدة (v5)
// Qamar Al Sham - Utilities v5
// ==============================================
// ✅ v5:
//   1. generateUserCode: defensive (uid فارغ)
//   2. extractUserCode: يدعم أكواد البوتات BOT·XXX
//   3. formatLastSeen: لعمود آخر تواجد (تاريخ+ساعة+غرفة)
//   4. isValidCountry / isValidFamily: حقول جديدة
//   5. buildProfileUrl: موحّد لبناء روابط البروفايل
//   6. formatTimeShort: وقت قصير (15:30)
// ==============================================

// ==============================================
// 1. الأمان — ضد XSS (الأهم!)
// ==============================================

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const str = String(text);
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function sanitizeWithTags(html, allowedTags = ['b', 'i', 'u', 'br', 'strong', 'em']) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;

    const walker = document.createTreeWalker(div, NodeFilter.SHOW_ELEMENT);
    const toRemove = [];

    while (walker.nextNode()) {
        const node = walker.currentNode;
        const tagName = node.tagName.toLowerCase();
        if (!allowedTags.includes(tagName)) {
            toRemove.push(node);
        } else {
            Array.from(node.attributes).forEach(attr => {
                node.removeAttribute(attr.name);
            });
        }
    }

    toRemove.forEach(node => {
        const text = document.createTextNode(node.textContent);
        if (node.parentNode) {
            node.parentNode.replaceChild(text, node);
        }
    });

    return div.innerHTML;
}

function sanitizeText(text) {
    return escapeHtml(text);
}

function sanitizeAttr(text) {
    if (!text) return '';
    return String(text).replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[c]);
}

// ==============================================
// 2. الإشعارات
// ==============================================

function showToast(icon, message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';

    const safeIcon = /^[a-z0-9-]+$/i.test(icon.replace('fa-', '')) ? icon : 'fa-info-circle';

    const iconEl = document.createElement('i');
    iconEl.className = `fas ${safeIcon}`;

    const spanEl = document.createElement('span');
    spanEl.textContent = message;

    toast.appendChild(iconEl);
    toast.appendChild(spanEl);

    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(15,15,20,0.95);
        border: 1px solid rgba(212,175,55,0.3);
        border-radius: 12px;
        padding: 12px 20px;
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 1100;
        box-shadow: 0 5px 15px rgba(0,0,0,0.5);
        animation: toastIn 0.3s ease-out;
        max-width: 90vw;
        direction: rtl;
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ==============================================
// 3. التنسيق (Time & Dates)
// ==============================================

function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('ar', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatDateTime(timestamp) {
    if (!timestamp) return '';
    return formatDate(timestamp) + ' - ' + formatTime(timestamp);
}

// ⭐ v5: وقت قصير بدون AM/PM (15:30)
function formatTimeShort(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
}

function timeAgo(timestamp) {
    if (!timestamp) return '';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'الآن';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `قبل ${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `قبل ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `قبل ${days} يوم`;
    return formatDate(timestamp);
}

// ⭐ v5: آخر تواجد = تاريخ + ساعة + غرفة
function formatLastSeen(timestamp, roomName) {
    if (!timestamp) return '—';
    const parts = [formatDate(timestamp), formatTimeShort(timestamp)];
    if (roomName) parts.push('📌 ' + roomName);
    return parts.join(' · ');
}

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let i = 0;
    while (size >= 1024 && i < units.length - 1) {
        size /= 1024;
        i++;
    }
    return size.toFixed(2) + ' ' + units[i];
}

function truncate(text, max = 80) {
    if (!text) return '';
    const str = String(text);
    return str.length > max ? str.substring(0, max) + '...' : str;
}

// ==============================================
// 4. التحقق
// ==============================================

/**
 * ⭐ isLink — يتجاهل الرموز الداخلية:
 *   [img:URL]  → للصور العادية
 *   [e:N]      → للإيموجيات من GitHub
 *   [cu:URL]   → للصور المخصصة (imgBB)
 *   [sticker:X] → للملصقات
 */
function isLink(text) {
    if (!text) return false;

    var cleaned = String(text)
        .replace(/\[img:[^\]]+\]/gi, '')
        .replace(/\[e:\d+\]/gi, '')
        .replace(/\[cu:[^\]]+\]/gi, '')
        .replace(/\[sticker:[^\]]+\]/gi, '');

    if (!cleaned.trim()) return false;

    const patterns = [
        /(https?:\/\/[^\s]+)/i,
        /(www\.[^\s]+)/i,
        /([a-z0-9-]+\.(com|net|org|io|ly|co|me|info|xyz|app|dev|tv|fm|link|sh|to|cc|ru|cn|tk))(\/[^\s]*)?/i,
        /(bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly)/i
    ];
    return patterns.some(p => p.test(cleaned));
}

function extractLinks(text) {
    if (!text) return [];
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    return text.match(urlRegex) || [];
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidName(name) {
    if (!name) return false;
    const trimmed = name.trim();
    return trimmed.length >= 2 && trimmed.length <= 20;
}

// ⭐ v5: حقول جديدة
function isValidCountry(name) {
    if (!name) return false;
    const t = String(name).trim();
    return t.length >= 2 && t.length <= 40;
}

function isValidFamily(name) {
    if (!name) return false;
    const t = String(name).trim();
    return t.length >= 2 && t.length <= 30;
}

// ==============================================
// 5. المنشن (Mentions)
// ==============================================

function extractMentions(text) {
    if (!text) return [];
    const regex = /(?:^|\s)@([\u0600-\u06FFa-zA-Z0-9_]{2,20})(?=\s|$|[^\u0600-\u06FFa-zA-Z0-9_@])/g;
    const mentions = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        const name = match[1];
        const idx = match.index;
        if (idx > 0 && text[idx - 1] !== ' ' && text[idx - 1] !== '\n') continue;
        if (!mentions.includes(name)) mentions.push(name);
    }
    return mentions;
}

function buildMentionHTML(text, mentions, onClickMention = null) {
    const container = document.createDocumentFragment();
    if (!text) return container;

    if (!mentions || mentions.length === 0) {
        container.appendChild(document.createTextNode(text));
        return container;
    }

    const escapedNames = mentions.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`@(${escapedNames.join('|')})`, 'g');

    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            container.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
        }

        const name = match[1];
        const span = document.createElement('span');
        span.className = 'mention-inline';
        span.setAttribute('data-mention', name);

        const img = document.createElement('img');
        img.src = getDefaultAvatar(name);
        img.alt = name;
        img.loading = 'lazy';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;

        span.appendChild(img);
        span.appendChild(nameSpan);

        if (onClickMention) {
            span.style.cursor = 'pointer';
            span.addEventListener('click', () => onClickMention(name));
        }

        container.appendChild(span);
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
        container.appendChild(document.createTextNode(text.substring(lastIndex)));
    }

    return container;
}

// ==============================================
// 6. نجوم الخلفية
// ==============================================

function generateStars() {
    const starfield = document.getElementById('starfield');
    if (!starfield) return;
    starfield.innerHTML = '';
    for (let i = 0; i < 50; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.animationDuration = (Math.random() * 3 + 2) + 's';
        star.style.animationDelay = (Math.random() * 5) + 's';
        starfield.appendChild(star);
    }
}

// ==============================================
// 7. Avatar
// ==============================================

function getDefaultAvatar(name, bgColor = 'random', textColor = 'fff') {
    const encoded = encodeURIComponent(name || 'User');
    return `https://ui-avatars.com/api/?name=${encoded}&background=${bgColor}&color=${textColor}`;
}

// ==============================================
// 8. أدوات الأداء
// ==============================================

function debounce(fn, delay = 300) {
    let timer = null;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

function throttle(fn, limit = 1000) {
    let inThrottle = false;
    return function(...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ==============================================
// 9. الاهتزاز
// ==============================================

function vibrate(ms = 50) {
    if (navigator.vibrate) {
        try { navigator.vibrate(ms); } catch (e) {}
    }
}

// ==============================================
// 10. التخزين الآمن
// ==============================================

function safeGetJSON(key, fallback = null) {
    try {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : fallback;
    } catch (e) {
        console.warn('safeGetJSON error:', key, e);
        return fallback;
    }
}

function safeSetJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.warn('safeSetJSON error:', key, e);
        return false;
    }
}

// ==============================================
// 11. الأنيميشن (CSS)
// ==============================================

if (!document.getElementById('qamar-animations')) {
    const style = document.createElement('style');
    style.id = 'qamar-animations';
    style.innerHTML = `
        @keyframes toastIn {
            from { opacity: 0; transform: translateX(50px); }
            to { opacity: 1; transform: translateX(0); }
        }
        @keyframes toastOut {
            from { opacity: 1; transform: translateX(0); }
            to { opacity: 0; transform: translateX(50px); }
        }
        @keyframes fadeInSlide {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);
}

// ==============================================
// 12. اكتشاف البيئة
// ==============================================

function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// ==============================================
// 13. كود البصمة الفريد (User Code)
// ==============================================

/**
 * يبني كود بصمة فريد:
 *   - أوله حرفان من الاسم (UPPERCASE)
 *   - أو U1/U2/... لو الاسم غير صالح
 *   - ثم · ثم 3 خانات hash (base36)
 * مثال: AH·XY3
 *
 * ⭐ v5: defensive — إذا uid فارغ يستخدم Math.random()
 */
function generateUserCode(name, uid) {
    let prefix = '';
    const clean = (name || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (clean.length >= 2) prefix = clean.substring(0, 2);
    else if (clean.length === 1) prefix = clean + 'X';
    else prefix = 'U' + Math.floor(Math.random() * 9 + 1);

    let hash = 5381;
    const source = String(uid || (Math.random().toString(36) + Date.now()));
    for (let i = 0; i < source.length; i++) {
        hash = ((hash * 33) ^ source.charCodeAt(i)) >>> 0;
    }
    const h = hash.toString(36).toUpperCase().padStart(3, '0').slice(-3);
    return prefix + '·' + h;
}

/**
 * يستخرج كود المستخدم من نص.
 * ⭐ v5: يدعم أكواد المستخدمين (AH·XY3) وأكواد البوتات (BOT·GUA)
 */
function extractUserCode(text) {
    if (!text) return null;
    const m = text.match(/([A-Z0-9]{2,5})·([A-Z0-9]{3,4})/);
    if (m) return m[0];
    return null;
}

function hasUserCode(text) {
    return extractUserCode(text) !== null;
}

// ==============================================
// 14. روابط موحّدة
// ==============================================

/**
 * ⭐ v5: بناء رابط البروفايل بشكل موحّد.
 * @param {string} uid — معرّف المستخدم
 * @param {boolean} asOwner — عرض كمالك؟
 */
function buildProfileUrl(uid, asOwner = false) {
    const base = (typeof QAMAR !== 'undefined' && QAMAR.PROFILE_URL) || 'profile.html';
    if (asOwner) return base + '?owner=1';
    if (!uid) return base;
    return base + '?uid=' + encodeURIComponent(uid);
}

// ==============================================
// تصدير
// ==============================================

console.log('📦 Utils v5 loaded — Security + User Code + Identity Helpers + Profile URL 🔑');
