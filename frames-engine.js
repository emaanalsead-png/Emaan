// ==============================================
// frames-engine.js v13 — تثبيت GIF + WeakSet + Profile-Ready
// ==============================================
// ✅ v13 (فوق v12):
//   1. كشف تلقائي للصور المتحركة (GIF/WebP/APNG)
//   2. للصور المتحركة: loading=eager + decoding=sync
//   3. للصور المتحركة: animations آمنة (.qf-animated — بدون transform/filter)
//   4. لا نعيد تعيين src لو نفسه (يفقد الحركة)
//   5. forceGifRestart helper
//   6. preload للصور المتحركة
// ✅ v12 (محفوظ):
//   1. renderFramesGrid Signature موسّع (Object)
//   2. WeakSet بدل global lock
//   3. applyAvatarFrameFromUser
//   4. تكامل مع NameEffects
// ==============================================

const FRAMES_REPO = 'qamaralsham/qamaralsham';
const FRAMES_FOLDER = 'frames/';
const FRAMES_EXTS = ['png', 'gif', 'webp', 'jpg', 'jpeg', 'apng'];
const ANIMATED_EXTS = ['gif', 'webp', 'apng'];
const FRAMES_CACHE_TTL = 24 * 60 * 60 * 1000;
const FRAMES_CACHE_KEY = 'qamar_frames_cache_v1';

// ⭐ v13: دورة عادية للصور الثابتة
const ANIM_CYCLE = ['royal-glow', 'wing-flutter', 'flame-flicker', 'celestial-spin', 'none'];
// ⭐ v13: دورة آمنة للصور المتحركة (بدون transform/filter — يوقف GIF)
const ANIM_CYCLE_ANIMATED = ['opacity-pulse', 'opacity-gentle', 'none'];

var _framesProcessed = new WeakSet();

const FRAMES_OVERRIDES = {
    // "frame1.png": { name: "الفضي الملكي", animation: "royal-glow" },
};

const FALLBACK_FRAMES = [
    { id: "f1", file: "frame1.png", name: "إطار 1", animation: "royal-glow", isAnimated: false, rank: "User" },
    { id: "f2", file: "frame2.png", name: "إطار 2", animation: "wing-flutter", isAnimated: false, rank: "User" },
    { id: "f3", file: "frame3.png", name: "إطار 3", animation: "flame-flicker", isAnimated: false, rank: "User" },
    { id: "f4", file: "frame4.png", name: "إطار 4", animation: "celestial-spin", isAnimated: false, rank: "User" },
    { id: "f5", file: "frame5.png", name: "إطار 5", animation: "none", isAnimated: false, rank: "User" },
    { id: "f6", file: "frame6.png", name: "إطار 6", animation: "royal-glow", isAnimated: false, rank: "User" },
    { id: "f7", file: "frame7.png", name: "إطار 7", animation: "wing-flutter", isAnimated: false, rank: "User" },
    { id: "f8", file: "frame8.png", name: "إطار 8", animation: "none", isAnimated: false, rank: "User" }
];

let ALL_FRAMES = FALLBACK_FRAMES.slice();
let _refreshing = false;

/* ══════════════════════════════════════════════ */
/* ⭐ v13: أدوات كشف الصور المتحركة               */
/* ══════════════════════════════════════════════ */

function _getExt(filename) {
    if (!filename) return '';
    // نتجاهل query string
    var clean = String(filename).split('?')[0].split('#')[0];
    return (clean.split('.').pop() || '').toLowerCase();
}

function _isAnimatedFile(filename) {
    return ANIMATED_EXTS.indexOf(_getExt(filename)) !== -1;
}

/**
 * ⭐ v13: إعادة تشغيل GIF (لو احتاجنا)
 * iOS Safari أحياناً يوقف GIF بعد إخفاء/إظهار
 * نبعت cache-buster صغير عشان يُعاد التحميل
 */
function _forceGifRestart(imgEl) {
    if (!imgEl || !imgEl.src) return;
    if (!_isAnimatedFile(imgEl.src)) return;
    try {
        var src = imgEl.src.split('?')[0].split('#')[0];
        var sep = imgEl.src.indexOf('?') === -1 ? '?' : '&';
        // نبعت cache-buster
        imgEl.src = src + '?__gifr=' + Date.now();
    } catch (e) {}
}

/* ══════════════════════════════════════════════ */
/* أدوات مساعدة                                    */
/* ══════════════════════════════════════════════ */

function buildFrameSrc(file) {
    if (/^(https?:|\/)/i.test(file)) return file;
    return FRAMES_FOLDER + file;
}

function naturalSort(a, b) {
    var na = a.match(/\d+/g);
    var nb = b.match(/\d+/g);
    if (na && nb) {
        for (var i = 0; i < Math.max(na.length, nb.length); i++) {
            var va = parseInt(na[i] || 0);
            var vb = parseInt(nb[i] || 0);
            if (va !== vb) return va - vb;
        }
    }
    return a.localeCompare(b);
}

function extractNum(filename) {
    var m = filename.match(/\d+/);
    return m ? parseInt(m[0]) : 0;
}

function buildFrameFromFile(fileObj, index) {
    var name = fileObj.name;
    var ext = _getExt(name);
    var isAnimated = ANIMATED_EXTS.indexOf(ext) !== -1;
    var num = extractNum(name);
    var id = 'f' + (num || (index + 1));
    var override = FRAMES_OVERRIDES[name] || {};

    // ⭐ v13: نختار animation حسب نوع الملف
    var anim;
    if (override.animation) {
        anim = override.animation;
    } else if (isAnimated) {
        // للصور المتحركة: animations آمنة فقط (بدون transform/filter)
        anim = ANIM_CYCLE_ANIMATED[index % ANIM_CYCLE_ANIMATED.length];
    } else {
        anim = ANIM_CYCLE[index % ANIM_CYCLE.length];
    }

    return {
        id: override.id || id,
        file: name,
        name: override.name || ('إطار ' + (num || (index + 1))),
        animation: anim,
        isAnimated: isAnimated,
        rank: override.rank || 'User'
    };
}

/* ══════════════════════════════════════════════ */
/* جلب الإطارات من GitHub                         */
/* ══════════════════════════════════════════════ */

async function fetchFramesFromGitHub() {
    var url = 'https://api.github.com/repos/' + FRAMES_REPO + '/contents/' + FRAMES_FOLDER;
    try {
        var res = await fetch(url + '?t=' + Date.now());
        if (res.status === 403 || res.status === 429) {
            console.warn('⚠️ GitHub API rate-limited');
            return null;
        }
        if (!res.ok) {
            console.warn('⚠️ GitHub API error:', res.status);
            return null;
        }
        var data = await res.json();
        if (!Array.isArray(data)) return null;

        var files = data.filter(function (f) {
            if (f.type !== 'file') return false;
            if (f.name.charAt(0) === '.') return false;
            var ext = _getExt(f.name);
            if (FRAMES_EXTS.indexOf(ext) === -1) return false;
            if (!/^frame/i.test(f.name)) return false;
            return true;
        });

        files.sort(function (a, b) { return naturalSort(a.name, b.name); });
        return files.map(buildFrameFromFile);
    } catch (e) {
        console.warn('⚠️ fetch failed:', e.message);
        return null;
    }
}

/* ══════════════════════════════════════════════ */
/* Cache (localStorage — خاص بالإطارات فقط)      */
/* ══════════════════════════════════════════════ */

function loadFromCache() {
    try {
        var cached = JSON.parse(localStorage.getItem(FRAMES_CACHE_KEY) || 'null');
        if (!cached) return null;
        if (Date.now() - cached.at > FRAMES_CACHE_TTL) return null;
        if (!Array.isArray(cached.frames) || cached.frames.length === 0) return null;
        return cached.frames;
    } catch (e) { return null; }
}

function saveToCache(frames) {
    try {
        localStorage.setItem(FRAMES_CACHE_KEY, JSON.stringify({
            frames: frames,
            at: Date.now()
        }));
    } catch (e) {}
}

async function initFrames() {
    var cached = loadFromCache();
    if (cached) {
        ALL_FRAMES = cached;
        console.log('📦 إطارات من الذاكرة: ' + cached.length);
        _preloadAnimatedFrames();
    }

    var fresh = await fetchFramesFromGitHub();
    if (fresh && fresh.length > 0) {
        ALL_FRAMES = fresh;
        saveToCache(fresh);
        console.log('🔄 إطارات محدّثة من GitHub: ' + fresh.length);
        _preloadAnimatedFrames();
        var c = document.getElementById('frames-container');
        if (c && c.children.length > 0) renderFramesGrid(c);
    } else if (!cached) {
        ALL_FRAMES = FALLBACK_FRAMES.slice();
        console.log('📌 استخدام القائمة الاحتياطية');
    }
}

/**
 * ⭐ v13: preload للصور المتحركة فقط
 * لضمان أنها تظهر متحركة من أول مرة
 */
function _preloadAnimatedFrames() {
    var animated = ALL_FRAMES.filter(function (f) {
        return f.isAnimated === true || _isAnimatedFile(f.file);
    });
    if (!animated.length) return;
    console.log('🎬 preloading ' + animated.length + ' animated frames');
    animated.forEach(function (f) {
        try {
            var img = new Image();
            img.src = buildFrameSrc(f.file);
        } catch (e) {}
    });
}

/* ══════════════════════════════════════════════ */
/* تصدير: إعادة التحميل يدوياً                    */
/* ══════════════════════════════════════════════ */

window.reloadFrames = async function () {
    if (_refreshing) return;
    _refreshing = true;

    var btn = document.getElementById('frames-refresh-btn');
    if (btn) btn.textContent = '⏳';

    try {
        localStorage.removeItem(FRAMES_CACHE_KEY);
        var fresh = await fetchFramesFromGitHub();
        if (fresh && fresh.length > 0) {
            ALL_FRAMES = fresh;
            saveToCache(fresh);
            _preloadAnimatedFrames();
            var c = document.getElementById('frames-container');
            if (c) renderFramesGrid(c);
            if (typeof toast === 'function') toast('✅ تم تحديث القائمة (' + fresh.length + ' إطار)');
        } else {
            if (typeof toast === 'function') toast('⚠️ فشل التحديث — جرب بعد دقيقة');
        }
    } catch (e) {
        if (typeof toast === 'function') toast('⚠️ خطأ في التحديث');
    }

    _refreshing = false;
    if (btn) btn.textContent = '🔄';
};

/* ══════════════════════════════════════════════ */
/* ⭐ v13: بناء عنصر الإطار (كامل)                */
/* ══════════════════════════════════════════════ */

/**
 * نبني عنصر الإطار مع كل الاعتبارات:
 *   - للصور الثابتة: loading=lazy + animations عادية
 *   - للصور المتحركة: loading=eager + animations آمنة + .qf-animated
 *   - ضبط classes بشكل نظيف
 *
 * @param {Object} frame — كائن الإطار من ALL_FRAMES
 * @param {boolean} forMessage — هل للرسالة؟ (يضيف inline styles)
 * @returns {HTMLElement}
 */
function _buildFrameElement(frame, forMessage) {
    var isAnim = frame.isAnimated === true || _isAnimatedFile(frame.file);

    var el = document.createElement('div');
    var classes = ['qf'];
    // ⭐ v13: class خاص بالصور المتحركة
    if (isAnim) classes.push('qf-animated');
    // animation — نتجنب none
    if (frame.animation && frame.animation !== 'none') {
        classes.push(frame.animation);
    }
    el.className = classes.join(' ');
    el.setAttribute('data-frame-id', frame.id);
    if (isAnim) el.setAttribute('data-animated', '1');

    // ⭐ v13: inline styles للرسائل
    if (forMessage) {
        el.style.cssText = 'position:absolute;inset:var(--frame-inset,-8%);pointer-events:none;z-index:20;display:flex;align-items:center;justify-content:center;';
    }

    var img = document.createElement('img');
    img.src = buildFrameSrc(frame.file);
    img.alt = frame.name;

    // ⭐ v13: تحميل مختلف حسب النوع
    if (isAnim) {
        img.loading = 'eager';
        img.decoding = 'sync';
    } else {
        img.loading = 'lazy';
        img.decoding = 'async';
    }

    // ⭐ v13: styles الصورة في الرسائل
    if (forMessage) {
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
    }

    img.onerror = function () { el.remove(); };
    el.appendChild(img);

    return el;
}

/* ══════════════════════════════════════════════ */
/* التطبيق الأساسي                                */
/* ══════════════════════════════════════════════ */

/**
 * تطبيق إطار على صندوق أفاتار (بدون localStorage).
 * @param {HTMLElement} box
 * @param {string} frameId
 */
function applyFrameTo(box, frameId) {
    if (!box) return;
    box.querySelectorAll('.qf').forEach(function (e) { e.remove(); });

    if (!frameId || frameId === 'none') return;

    var frame = ALL_FRAMES.find(function (f) { return f.id === frameId; });
    if (!frame) return;

    var el = _buildFrameElement(frame, false);
    box.appendChild(el);
}

/**
 * تطبيق إطار على رسالة (wrapper).
 */
function applyFrameToMessage(wrapper, frameId) {
    if (!wrapper) return;
    wrapper.querySelectorAll('.qf').forEach(function (e) { e.remove(); });
    if (!frameId || frameId === 'none') return;

    var frame = ALL_FRAMES.find(function (f) { return f.id === frameId; });
    if (!frame) return;

    var el = _buildFrameElement(frame, true);
    wrapper.appendChild(el);
}

/* ══════════════════════════════════════════════ */
/* API موحّد للبروفايل                            */
/* ══════════════════════════════════════════════ */

function applyAvatarFrameFromUser(box, user) {
    if (!box) return;

    box.querySelectorAll('.qf').forEach(function (e) { e.remove(); });
    if (window.NameEffects && typeof window.NameEffects.clearDefaultAvatarFrame === 'function') {
        window.NameEffects.clearDefaultAvatarFrame(box);
    }

    if (!user) return;

    if (user.avatarFrame && user.avatarFrame !== 'none') {
        applyFrameTo(box, user.avatarFrame);
        return;
    }

    if (window.NameEffects && typeof window.NameEffects.applyDefaultAvatarFrame === 'function') {
        window.NameEffects.applyDefaultAvatarFrame(box, user.rank, user.rankLevel);
    }
}

/* ══════════════════════════════════════════════ */
/* عرض شبكة الإطارات                              */
/* ══════════════════════════════════════════════ */

function ensureRefreshButton() {
    var modal = document.getElementById('frames-modal');
    if (!modal) return;
    if (document.getElementById('frames-refresh-btn')) return;

    var box = modal.querySelector('.modal-c');
    if (!box) return;

    var btn = document.createElement('button');
    btn.id = 'frames-refresh-btn';
    btn.type = 'button';
    btn.textContent = '🔄';
    btn.title = 'تحديث قائمة الإطارات';
    btn.style.cssText = 'position:absolute;top:10px;left:10px;background:rgba(255,215,0,0.15);border:1px solid rgba(255,215,0,0.4);color:#ffd700;width:36px;height:36px;border-radius:50%;font-size:16px;cursor:pointer;font-weight:900;z-index:5;';
    btn.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        window.reloadFrames();
    };

    box.style.position = 'relative';
    box.appendChild(btn);
}

/**
 * تعرض شبكة الإطارات (3×N).
 * ✅ تدعم Signature القديم: renderFramesGrid(container, avatarSrc, currentFrameId)
 * ✅ تدعم Signature الجديد: renderFramesGrid(container, {avatarSrc, currentFrameId, onSelect})
 *
 * ⭐ v13: الصور المتحركة تُعرض بـ loading=eager
 */
function renderFramesGrid(container, arg2, arg3) {
    if (!container) return;
    container.innerHTML = '';

    var avatarSrc = null;
    var currentFrameId = null;
    var onSelect = null;

    if (arg2 && typeof arg2 === 'object' && !Array.isArray(arg2)) {
        avatarSrc = arg2.avatarSrc || null;
        currentFrameId = arg2.currentFrameId || null;
        onSelect = (typeof arg2.onSelect === 'function') ? arg2.onSelect : null;
    } else {
        avatarSrc = arg2 || null;
        currentFrameId = arg3 || null;
    }

    ensureRefreshButton();

    if (!ALL_FRAMES || ALL_FRAMES.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#888;padding:20px;font-size:12px;">⏳ جاري تحميل الإطارات...</div>';
        return;
    }

    const currentId = currentFrameId || null;
    const previewAvatar = avatarSrc || 'https://ui-avatars.com/api/?name=U&background=333&color=fff';

    function _selectFrame(id) {
        if (onSelect) {
            try {
                onSelect(id);
            } catch (e) {
                console.error('onSelect threw:', e);
            }
        } else if (typeof window.applyAvatarFrame === 'function') {
            window.applyAvatarFrame(id);
        }
    }

    // ─── بطاقة "بدون إطار" ───
    const noneCard = document.createElement('div');
    noneCard.className = 'frame-tile';
    if (!currentId || currentId === 'none') noneCard.classList.add('selected');

    const noneAvatar = document.createElement('div');
    noneAvatar.className = 'frame-avatar';
    const noneImg = document.createElement('img');
    noneImg.src = previewAvatar;
    noneImg.loading = 'eager';
    noneAvatar.appendChild(noneImg);

    const noneIcon = document.createElement('div');
    noneIcon.textContent = '✕';
    noneIcon.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);color:#888;font-size:22px;border-radius:50%;';
    noneAvatar.appendChild(noneIcon);

    noneCard.appendChild(noneAvatar);
    noneCard.onclick = function() {
        _selectFrame('none');
        container.querySelectorAll('.frame-tile').forEach(function(x) { x.classList.remove('selected'); });
        noneCard.classList.add('selected');
    };
    container.appendChild(noneCard);

    // ─── بطاقات الإطارات ───
    ALL_FRAMES.forEach(function(f) {
        const tile = document.createElement('div');
        tile.className = 'frame-tile';
        if (currentId === f.id) tile.classList.add('selected');

        const avatarBox = document.createElement('div');
        avatarBox.className = 'frame-avatar';
        const av = document.createElement('img');
        av.src = previewAvatar;
        av.loading = 'eager';
        avatarBox.appendChild(av);

        const fimg = document.createElement('img');
        fimg.src = buildFrameSrc(f.file);
        fimg.className = 'frame-img';

        // ⭐ v13: eager + sync للصور المتحركة
        const isAnim = f.isAnimated === true || _isAnimatedFile(f.file);
        if (isAnim) {
            fimg.loading = 'eager';
            fimg.decoding = 'sync';
            fimg.setAttribute('data-animated', '1');
        } else {
            fimg.loading = 'lazy';
        }

        fimg.onerror = function() { fimg.style.display = 'none'; };
        avatarBox.appendChild(fimg);

        tile.appendChild(avatarBox);

        tile.onclick = function() {
            _selectFrame(f.id);
            container.querySelectorAll('.frame-tile').forEach(function(x) { x.classList.remove('selected'); });
            tile.classList.add('selected');
        };

        container.appendChild(tile);
    });
}

/* ══════════════════════════════════════════════ */
/* تطبيق الإطارات على الرسائل الموجودة            */
/* ══════════════════════════════════════════════ */

function applyFramesToExistingMessages() {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;
    if (typeof db === 'undefined' || !db) return;

    const currentRoom = (typeof ChatState !== 'undefined' && ChatState.currentRoom)
        ? ChatState.currentRoom
        : 'general';

    db.ref('room_messages/' + currentRoom).limitToLast(50).once('value').then(function(snap) {
        const messages = snap.val() || {};
        Object.keys(messages).forEach(function(msgId) {
            const msg = messages[msgId];
            if (!msg || !msg.senderFrame || msg.senderFrame === 'none') return;
            const msgEl = document.querySelector('[data-msg-id="' + msgId + '"]');
            if (!msgEl) return;
            const wrapper = msgEl.querySelector('.message-avatar-wrapper');
            if (!wrapper) return;
            if (wrapper.querySelector('.qf')) return;
            if (_framesProcessed.has(wrapper)) return;
            _framesProcessed.add(wrapper);
            applyFrameToMessage(wrapper, msg.senderFrame);
        });
    }).catch(function(e) { console.warn('Frame apply error:', e); });
}

/* ══════════════════════════════════════════════ */
/* Observer: تطبيق الإطارات على الرسائل الجديدة   */
/* ══════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function () {
    var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
            m.addedNodes.forEach(function (node) {
                if (node.nodeType !== 1) return;
                if (!node.classList || !node.classList.contains('message')) return;
                if (node.classList.contains('system')) return;

                var wrapper = node.querySelector('.message-avatar-wrapper');
                if (!wrapper) return;

                if (_framesProcessed.has(wrapper)) return;
                _framesProcessed.add(wrapper);

                if (wrapper.querySelector('.qf')) return;

                var senderUid = node.getAttribute('data-sender-uid');
                if (!senderUid) return;
                if (senderUid.indexOf('bot_') === 0) return;

                if (typeof db === 'undefined' || !db) return;
                db.ref('users/' + senderUid + '/avatarFrame').once('value').then(function (s) {
                    var frame = s.val();
                    if (frame && frame !== 'none' && !wrapper.querySelector('.qf')) {
                        applyFrameToMessage(wrapper, frame);
                    }
                }).catch(function () {});
            });
        });
    });

    var messagesContainer = document.getElementById('messages');
    if (messagesContainer) {
        observer.observe(messagesContainer, { childList: true, subtree: false });
    }
});

/* ══════════════════════════════════════════════ */
/* Init + Exports                                 */
/* ══════════════════════════════════════════════ */

window.addEventListener('load', function () {
    initFrames();
    setTimeout(applyFramesToExistingMessages, 2000);
});

/* ══════════════════════════════════════════════ */
/* التصدير العام                                  */
/* ══════════════════════════════════════════════ */

window.applyFrameTo = applyFrameTo;
window.applyFrameToMessage = applyFrameToMessage;
window.applyAvatarFrameFromUser = applyAvatarFrameFromUser;
window.renderFramesGrid = renderFramesGrid;
window.getFrames = function () { return ALL_FRAMES; };
/* ⭐ v13 */
window.forceGifRestart = _forceGifRestart;
window.isAnimatedFile = _isAnimatedFile;

window.applyFrameToWrapper = function (wrapper, frameId) {
    if (!wrapper) return;
    wrapper.querySelectorAll('.qf, .dynamic-frame-wrapper, .qcf, .avatar-frame, .qamar-frame').forEach(function(e) { e.remove(); });
    if (!frameId || frameId === 'none') return;
    applyFrameToMessage(wrapper, frameId);
};

window.applyAvatarFrame = function (fid) {
    const box = document.getElementById('avatar-box');
    if (box) applyFrameTo(box, fid);
};

window.renderFrames = function () {
    const c = document.getElementById('frames-container');
    if (c) renderFramesGrid(c);
};

console.log('✅ frames-engine.js v13 loaded — GIF stabilized + WeakSet + profile-ready API');
