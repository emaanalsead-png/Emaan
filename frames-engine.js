// ==============================================
// frames-engine.js v12 — WeakSet + Profile-Ready
// ==============================================
// ✅ v12:
//   1. renderFramesGrid تدعم Object {avatarSrc, currentFrameId, onSelect}
//   2. تدعم Signature القديم (avatarSrc, currentFrameId) للتوافق
//   3. onSelect يُستدعى عند اختيار إطار (لحفظ Firebase)
//   4. باقي المنطق كما v11 بالضبط
// ✅ v11 (محفوظ):
//   1. WeakSet بدل global lock (لا يفقد رسائل)
//   2. applyAvatarFrameFromUser — API موحّد للبروفايل
//   3. لا localStorage (مسؤولية profile-core.js)
//   4. تكامل مع NameEffects.applyDefaultAvatarFrame
//   5. observer نظيف وآمن
// ==============================================

const FRAMES_REPO = 'qamaralsham/qamaralsham';
const FRAMES_FOLDER = 'frames/';
const FRAMES_EXTS = ['png', 'gif', 'webp', 'jpg', 'jpeg', 'apng'];
const FRAMES_CACHE_TTL = 24 * 60 * 60 * 1000;
const FRAMES_CACHE_KEY = 'qamar_frames_cache_v1';
const ANIM_CYCLE = ['royal-glow', 'wing-flutter', 'flame-flicker', 'celestial-spin', 'none'];

// ⭐ v11: WeakSet بدل global lock
// كل wrapper يمر مرة واحدة عبر observer
var _framesProcessed = new WeakSet();

const FRAMES_OVERRIDES = {
    // "frame1.png": { name: "الفضي الملكي", animation: "royal-glow" },
};

const FALLBACK_FRAMES = [
    { id: "f1", file: "frame1.png", name: "إطار 1", animation: "royal-glow", rank: "User" },
    { id: "f2", file: "frame2.png", name: "إطار 2", animation: "wing-flutter", rank: "User" },
    { id: "f3", file: "frame3.png", name: "إطار 3", animation: "flame-flicker", rank: "User" },
    { id: "f4", file: "frame4.png", name: "إطار 4", animation: "celestial-spin", rank: "User" },
    { id: "f5", file: "frame5.png", name: "إطار 5", animation: "none", rank: "User" },
    { id: "f6", file: "frame6.png", name: "إطار 6", animation: "royal-glow", rank: "User" },
    { id: "f7", file: "frame7.png", name: "إطار 7", animation: "wing-flutter", rank: "User" },
    { id: "f8", file: "frame8.png", name: "إطار 8", animation: "none", rank: "User" }
];

let ALL_FRAMES = FALLBACK_FRAMES.slice();
let _refreshing = false;

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
    var ext = (name.split('.').pop() || '').toLowerCase();
    var isAnimated = (ext === 'gif' || ext === 'webp' || ext === 'apng');
    var num = extractNum(name);
    var id = 'f' + (num || (index + 1));
    var override = FRAMES_OVERRIDES[name] || {};

    return {
        id: override.id || id,
        file: name,
        name: override.name || ('إطار ' + (num || (index + 1))),
        animation: override.animation || (isAnimated ? 'none' : ANIM_CYCLE[index % ANIM_CYCLE.length]),
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
            var ext = (f.name.split('.').pop() || '').toLowerCase();
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
/* ⚠️ ملاحظة: هذا Cache لعامّة الإطارات،           */
/*    وليس Cache لاختيار المستخدم.                 */
/*    اختيار المستخدم مسؤولية profile-core.js.     */

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
    }

    var fresh = await fetchFramesFromGitHub();
    if (fresh && fresh.length > 0) {
        ALL_FRAMES = fresh;
        saveToCache(fresh);
        console.log('🔄 إطارات محدّثة من GitHub: ' + fresh.length);
        var c = document.getElementById('frames-container');
        if (c && c.children.length > 0) renderFramesGrid(c);
    } else if (!cached) {
        ALL_FRAMES = FALLBACK_FRAMES.slice();
        console.log('📌 استخدام القائمة الاحتياطية');
    }
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
/* التطبيق الأساسي                                */
/* ══════════════════════════════════════════════ */

/**
 * ⭐ v11: تطبيق إطار على صندوق أفاتار (بدون localStorage).
 * @param {HTMLElement} box
 * @param {string} frameId
 */
function applyFrameTo(box, frameId) {
    if (!box) return;
    box.querySelectorAll('.qf').forEach(function(e) { e.remove(); });

    if (!frameId || frameId === 'none') return;

    var frame = ALL_FRAMES.find(function(f) { return f.id === frameId; });
    if (!frame) return;

    var el = document.createElement('div');
    el.className = 'qf ' + (frame.animation && frame.animation !== 'none' ? frame.animation : '');
    el.setAttribute('data-frame-id', frameId);

    var img = document.createElement('img');
    img.src = buildFrameSrc(frame.file);
    img.alt = frame.name;
    img.loading = 'lazy';
    img.onerror = function() { el.remove(); };
    el.appendChild(img);

    box.appendChild(el);
}

/**
 * ⭐ v11: تطبيق إطار على رسالة (wrapper).
 */
function applyFrameToMessage(wrapper, frameId) {
    if (!wrapper) return;
    wrapper.querySelectorAll('.qf').forEach(function(e) { e.remove(); });
    if (!frameId || frameId === 'none') return;

    var frame = ALL_FRAMES.find(function(f) { return f.id === frameId; });
    if (!frame) return;

    var el = document.createElement('div');
    el.className = 'qf ' + (frame.animation && frame.animation !== 'none' ? frame.animation : '');
    el.setAttribute('data-frame-id', frameId);
    el.style.cssText = 'position:absolute;inset:var(--frame-inset,-8%);pointer-events:none;z-index:20;display:flex;align-items:center;justify-content:center;';

    var img = document.createElement('img');
    img.src = buildFrameSrc(frame.file);
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
    img.onerror = function() { el.remove(); };
    el.appendChild(img);

    wrapper.appendChild(el);
}

/* ══════════════════════════════════════════════ */
/* ⭐ v11: API موحّد للبروفايل                     */
/* ══════════════════════════════════════════════ */

/**
 * يطبّق إطار الأفاتار حسب بيانات المستخدم:
 *   1. لو عند user.avatarFrame → إطار مخصص.
 *   2. لو ما عنده → الإطار الافتراضي حسب الرتبة.
 *
 * @param {HTMLElement} box — عنصر .avatar-box
 * @param {Object} user — { avatarFrame, rank, rankLevel }
 */
function applyAvatarFrameFromUser(box, user) {
    if (!box) return;

    // نظّف كل الإطارات (مخصص + افتراضي)
    box.querySelectorAll('.qf').forEach(function(e) { e.remove(); });
    if (window.NameEffects && typeof window.NameEffects.clearDefaultAvatarFrame === 'function') {
        window.NameEffects.clearDefaultAvatarFrame(box);
    }

    if (!user) return;

    // 1. إطار مخصص؟
    if (user.avatarFrame && user.avatarFrame !== 'none') {
        applyFrameTo(box, user.avatarFrame);
        return;
    }

    // 2. الإطار الافتراضي حسب الرتبة
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
 * ⭐ v12: تعرض شبكة الإطارات (3×N).
 * ✅ تدعم Signature القديم: renderFramesGrid(container, avatarSrc, currentFrameId)
 * ✅ تدعم Signature الجديد: renderFramesGrid(container, {avatarSrc, currentFrameId, onSelect})
 *
 * الصورة داخل كل إطار = صورة صاحب البروفايل الفعلية.
 *
 * @param {HTMLElement} container
 * @param {string|Object} arg2 — avatarSrc أو {avatarSrc, currentFrameId, onSelect}
 * @param {string} [arg3] — currentFrameId (الوضع القديم)
 */
function renderFramesGrid(container, arg2, arg3) {
    if (!container) return;
    container.innerHTML = '';

    // ⭐ v12: كشف الـ signature
    var avatarSrc = null;
    var currentFrameId = null;
    var onSelect = null;

    if (arg2 && typeof arg2 === 'object' && !Array.isArray(arg2)) {
        // Signature الجديد (Object)
        avatarSrc = arg2.avatarSrc || null;
        currentFrameId = arg2.currentFrameId || null;
        onSelect = (typeof arg2.onSelect === 'function') ? arg2.onSelect : null;
    } else {
        // Signature القديم
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

    // ⭐ v12: دالة مركزية للاختيار
    function _selectFrame(id) {
        if (onSelect) {
            try {
                onSelect(id);
            } catch (e) {
                console.error('onSelect threw:', e);
            }
        } else if (typeof window.applyAvatarFrame === 'function') {
            // Fallback للواجهات القديمة (بصري فقط)
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
        avatarBox.appendChild(av);

        const fimg = document.createElement('img');
        fimg.src = buildFrameSrc(f.file);
        fimg.className = 'frame-img';
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

                // ⭐ v11: WeakSet — كل wrapper يُعالَج مرة واحدة
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

    // ✅ v11: لم نعد نطبّق localStorage هنا
    // profile-core.js يتولى المهمة في owner mode

    setTimeout(applyFramesToExistingMessages, 2000);
});

/* ══════════════════════════════════════════════ */
/* التصدير العام                                  */
/* ══════════════════════════════════════════════ */

// ⭐ API أساسي
window.applyFrameTo = applyFrameTo;
window.applyFrameToMessage = applyFrameToMessage;
window.applyAvatarFrameFromUser = applyAvatarFrameFromUser;
window.renderFramesGrid = renderFramesGrid;
window.getFrames = function () { return ALL_FRAMES; };

// Legacy — للتوافق مع chat.js
window.applyFrameToWrapper = function (wrapper, frameId) {
    if (!wrapper) return;
    wrapper.querySelectorAll('.qf, .dynamic-frame-wrapper, .qcf, .avatar-frame, .qamar-frame').forEach(function(e) { e.remove(); });
    if (!frameId || frameId === 'none') return;
    applyFrameToMessage(wrapper, frameId);
};

// Legacy — يُستخدم من profile-appearance القديم
window.applyAvatarFrame = function (fid) {
    // ⚠️ deprecated — استخدم applyAvatarFrameFromUser
    const box = document.getElementById('avatar-box');
    if (box) applyFrameTo(box, fid);
};

// Legacy — للتوافق مع profile-core.js v4
window.renderFrames = function () {
    const c = document.getElementById('frames-container');
    if (c) renderFramesGrid(c);
};

console.log('✅ frames-engine.js v12 loaded — WeakSet + profile-ready API + onSelect support');
