// ==============================================
// profile-core.js v12 — no-video + catbox upload
// ==============================================
// ✅ v12:
//   1. _applyCover: صور فقط (no video)
//   2. _applyProfileBackground: color/image فقط
//   3. uploadFile: يستخدم UploadService (catbox/imgbb)
//   4. _autoCleanupLegacyVideos: يحذف فيديوهات قديمة
//   5. _switchBgTypeUI: بدون زر video
//   6. باقي المنطق كما v11 بالضبط
// ==============================================

const ProfileState = {
    mode: 'owner', me: null, subject: null,
    isAdminVisitor: false, collapsed: false,
    lastUserHash: '', localLockUntil: 0,
    settingsHistory: [],
    poetry: { text: '', bg: null, attachment: null },
    likes: { isLiked: false, count: 0 },
    friends: { state: 'off', count: 0 },
    blocked: { isBlocked: false }
};

const IMGBB_KEY = '80fd32c4ef79b5f25fbcf0893547de4f';
const MAX_VIDEO_MB = 5;
const MAX_AUDIO_MB = 5;

const NAME_GRADIENTS = [
    ['#d4af37','#ffec8b'], ['#b8860b','#ffd700'], ['#ffd700','#ff8c00'],
    ['#f4c430','#fff8dc'], ['#ffd700','#b8860b'], ['#e6b800','#ffeeaa'],
    ['#ff69b4','#ff1493'], ['#e84393','#fd79a8'], ['#a855f7','#7c3aed'],
    ['#8b00ff','#ff006e'], ['#ff00ff','#da70d6'], ['#c084fc','#f0abfc'],
    ['#d946ef','#a21caf'], ['#ec4899','#f43f5e'],
    ['#00f3ff','#0066ff'], ['#00bfff','#1e90ff'], ['#0ea5e9','#06b6d4'],
    ['#3b82f6','#8b5cf6'], ['#1e40af','#3b82f6'], ['#00d4ff','#0080ff'],
    ['#74b9ff','#0984e3'],
    ['#39ff14','#00cc00'], ['#00b894','#0984e3'], ['#55efc4','#00b894'],
    ['#10b981','#059669'], ['#84cc16','#65a30d'], ['#a3e635','#4ade80'],
    ['#ff0000','#ff4500'], ['#ff4500','#ff8c00'], ['#dc143c','#ff0066'],
    ['#b91c1c','#ef4444'], ['#ff0040','#ff3366'], ['#e0115f','#ff4757'],
    ['#ff8c00','#ff1493'], ['#d35400','#e17055'],
    ['#ff0000','#ffd700'], ['#ff0000','#00ff00'], ['#00ff00','#0000ff'],
    ['#ff00ff','#00ffff'], ['#ff006e','#8338ec'], ['#3a86ff','#ff006e'],
    ['#ffffff','#cccccc'], ['#fef9e7','#f9e79f'], ['#fdebd0','#f5b7b1'],
    ['#ffeaa7','#fdcb6e'], ['#fab1a0','#e17055'],
    ['#000000','#333333'], ['#1a1a2e','#16213e'], ['#2c3e50','#4ca1af'],
    ['#434343','#000000'],
    ['#ffd700','#ff006e'], ['#00ff88','#0066ff'], ['#ff0055','#ffd700'],
    ['#8b00ff','#ff006e'], ['#00f3ff','#ff00ff'], ['#ffcc00','#ff6699'],
    ['#00ffcc','#0066ff'], ['#ff66cc','#9900ff'], ['#ffaa00','#ff0000'],
    ['#00ccff','#6600ff'], ['#c0c0c0','#ffd700']
];

function _getCinemaBgStyles() {
    if (window.NameEffects && Array.isArray(window.NameEffects.CINEMA_BG_STYLES)) {
        const list = window.NameEffects.CINEMA_BG_STYLES.map(function (id) {
            if (window.NameEffects.CINEMA_STYLES) {
                const item = window.NameEffects.CINEMA_STYLES.find(function (x) { return x.id === id; });
                if (item) return item;
            }
            return { id: id, label: id, icon: '🎬' };
        });
        return list;
    }
    return [{ id: '', label: 'بدون', icon: '❌' }];
}

/* ═══ Helpers ═══ */
function _getUser() {
    try {
        return JSON.parse(
            localStorage.getItem(QAMAR.STORAGE_KEYS.CURRENT_USER) ||
            localStorage.getItem(QAMAR.STORAGE_KEYS.USER) ||
            'null'
        );
    } catch (e) { return null; }
}

function _getRankLevel(rank) {
    return (typeof getRankLevel === 'function') ? getRankLevel(rank) : (QAMAR.getRankLevel(rank) || 0);
}

function _toast(msg) {
    if (typeof showToast === 'function') showToast('fa-info-circle', msg);
    else console.log('[profile]', msg);
}

function _isOwner() { return ProfileState.mode === 'owner'; }
function _isVisitor() { return ProfileState.mode === 'visitor'; }

function _isAdminUser() {
    const u = ProfileState.me;
    if (!u) return false;
    const lvl = u.rankLevel || _getRankLevel(u.rank);
    return lvl >= 65;
}

function _canView(field) {
    if (_isOwner()) return true;
    const subj = ProfileState.subject;
    if (!subj) return false;
    const privacy = subj.privacy || {};
    const val = privacy[field] || 'public';
    return val === 'public';
}

function _esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
}

function _formatLastSeen(ts, roomId) {
    if (!ts) return '—';
    const d = new Date(ts);
    const date = d.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const time = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    let result = date + ' · ' + time;
    if (roomId && QAMAR.ROOMS[roomId]) {
        result += ' · 📌 ' + QAMAR.ROOMS[roomId].name;
    }
    return result;
}

function _formatDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function _userHash(u) {
    if (!u) return '';
    try {
        return JSON.stringify({
            n: u.name, b: u.bio, a: u.avatar, c: u.cover, r: u.rank,
            nc: u.nameColor, ng: u.nameGradient,
            nbc: u.nameBgColor, nbg: u.nameBgGradient,
            ncb: u.cinemaBgStyle,
            af: u.avatarFrame, pg: u.profileGlow,
            pbt: u.profileBgType, pbv: u.profileBgValue,
            mu: u.musicURL, p: u.poetry, pb: u.poetryBg, pa: u.poetryAttachment,
            co: u.country, fa: u.family,
            ij: u.isJailed, ju: u.jailUntil,
            ib: u.isBanned, bu: u.bannedUntil,
            iv: u.invisible
        });
    } catch (e) { return ''; }
}

function _openUserProfile(uid, name) {
    if (!uid) return;
    try {
        if (window.parent && window.parent !== window) {
            if (typeof window.parent.openUserProfile === 'function') {
                window.parent.openUserProfile(uid, name || '');
            } else {
                window.parent.postMessage({
                    action: 'openUserProfile',
                    uid: uid,
                    name: name || ''
                }, '*');
            }
        } else {
            location.href = 'profile.html?uid=' + encodeURIComponent(uid);
        }
    } catch (e) {
        console.warn('_openUserProfile failed:', e);
    }
}

/* ═══ Modal ═══ */
function openAppModal(opts) {
    opts = opts || {};
    const m = document.getElementById('app-modal');
    if (!m) return;

    const titleEl = document.getElementById('modal-title');
    const textEl = document.getElementById('modal-text');
    const dyn = document.getElementById('modal-dyn');
    const okBtn = document.getElementById('modal-ok');
    const cancelBtn = document.getElementById('modal-cancel');

    if (titleEl) titleEl.textContent = opts.title || 'تنبيه';
    if (textEl) {
        textEl.textContent = opts.text || '';
        textEl.style.display = opts.text ? 'block' : 'none';
    }
    if (dyn) dyn.innerHTML = '';

    if (opts.html && dyn) {
        dyn.innerHTML = opts.html;
    } else if (opts.type === 'input' && dyn) {
        const i = document.createElement('input');
        i.type = 'text';
        i.id = 'modal-input-val';
        i.value = opts.value || '';
        if (opts.maxLength) i.maxLength = opts.maxLength;
        dyn.appendChild(i);
    } else if (opts.type === 'textarea' && dyn) {
        const ta = document.createElement('textarea');
        ta.id = 'modal-input-val';
        ta.value = opts.value || '';
        ta.style.minHeight = '80px';
        if (opts.maxLength) ta.maxLength = opts.maxLength;
        dyn.appendChild(ta);
    } else if (opts.type === 'select' && dyn) {
        const s = document.createElement('select');
        s.id = 'modal-select-val';
        (opts.options || []).forEach(o => {
            const op = document.createElement('option');
            op.value = (typeof o === 'object') ? o.value : o;
            op.textContent = (typeof o === 'object') ? o.label : o;
            if (op.value === opts.value) op.selected = true;
            s.appendChild(op);
        });
        dyn.appendChild(s);
    }

    m.classList.add('active');

    if (opts.hideOk) {
        okBtn.style.display = 'none';
        cancelBtn.textContent = opts.cancelLabel || 'إغلاق';
        cancelBtn.style.width = '100%';
    } else {
        okBtn.style.display = '';
        cancelBtn.style.width = '';
        okBtn.textContent = opts.okLabel || 'موافق';
        cancelBtn.textContent = opts.cancelLabel || 'إلغاء';

        okBtn.onclick = function () {
            let v = '';
            if (opts.type === 'input' || opts.type === 'textarea') {
                const i = document.getElementById('modal-input-val');
                if (i) v = i.value;
            } else if (opts.type === 'select') {
                const s = document.getElementById('modal-select-val');
                if (s) v = s.value;
            }
            if (typeof opts.onSave === 'function') opts.onSave(v);
            m.classList.remove('active');
        };
    }

    cancelBtn.onclick = function () { m.classList.remove('active'); };
    m.onclick = function (e) { if (e.target === m) m.classList.remove('active'); };
}

window.openAppModal = openAppModal;

/* ═══ Bootstrap ═══ */
document.addEventListener('DOMContentLoaded', async function () {
    console.log('🚀 profile-core.js v12 booting...');

    try {
        localStorage.removeItem('saved_avatar_frame_motion');
    } catch (e) {}

    const params = new URLSearchParams(location.search);
    const urlUid = params.get('uid');
    const isOwnerParam = params.get('owner');

    ProfileState.me = _getUser();

    if (isOwnerParam === '1' || (!urlUid && ProfileState.me)) {
        ProfileState.mode = 'owner';
        ProfileState.subject = ProfileState.me;
    } else if (urlUid) {
        ProfileState.mode = 'visitor';
        ProfileState.subject = null;
    } else {
        document.body.innerHTML =
            '<div style="padding:40px;text-align:center;color:#fff;font-family:Cairo,sans-serif;">' +
            '⚠️ لا يوجد مستخدم' +
            '</div>';
        return;
    }

    document.body.classList.add(ProfileState.mode + '-mode');
    ProfileState.isAdminVisitor = _isVisitor() && _isAdminUser();

    if (_isOwner() && ProfileState.me) {
        ProfileState.subject = ProfileState.me;
        _loadSubjectFromCache();
    }

    if (_isVisitor() && urlUid) {
        _loadSubjectFromCache(urlUid);
    }

    _bindCoverButtons();
    _bindSettingsNavigation();
    _bindLikesFriendsBlocked();
    _bindImagesUploads();
    _bindMusic();
    _bindPoetry();
    _bindPrivacy();
    _bindDangerActions();
    _bindEditName();
    _bindEditBio();
    _bindVisitorView();

    renderTabsForMode();

    if (_isVisitor() && urlUid) {
        await _loadVisitorSubject(urlUid);
    } else if (_isOwner() && ProfileState.me) {
        await _loadOwnerSubject();
    }

    applyIdentityToDOM();
    _startSubjectListener();

    // ⭐ v12: تنظيف صامت للفيديوهات القديمة (owner فقط)
    if (_isOwner()) {
        _autoCleanupLegacyVideos();
    }

    setTimeout(function () {
        const p = document.getElementById('profile-container');
        if (p) {
            p.style.transition = 'opacity 0.15s ease-in';
            p.style.opacity = '1';
        }
    }, 200);

    setTimeout(function () {
        renderInfoGrid();
        renderHomeStats();
        renderMomentsTab();
        renderFriendsTab();
    }, 400);

    console.log('✅ profile-core.js v12 ready | Mode:', ProfileState.mode);
});

/* ⭐ v12: تنظيف فيديوهات قديمة */
async function _autoCleanupLegacyVideos() {
    const subj = ProfileState.subject;
    if (!subj || !subj.uid) return;
    if (typeof db === 'undefined' || !db) return;

    const updates = {};
    let didCleanup = false;

    // غلاف فيديو قديم؟
    const cover = subj.cover;
    if (cover && (
        subj.coverType === 'video' ||
        cover.indexOf('data:video/') === 0 ||
        /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(cover)
    )) {
        updates.cover = null;
        updates.coverType = null;
        didCleanup = true;
    }

    // خلفية بروفايل فيديو؟
    if (subj.profileBgType === 'video') {
        updates.profileBgType = null;
        updates.profileBgValue = null;
        didCleanup = true;
    }

    if (!didCleanup) return;

    try {
        await db.ref('users/' + subj.uid).update(updates);
        if (updates.cover === null) ProfileState.subject.cover = null;
        if (updates.coverType === null) ProfileState.subject.coverType = null;
        if (updates.profileBgType === null) ProfileState.subject.profileBgType = null;
        if (updates.profileBgValue === null) ProfileState.subject.profileBgValue = null;
        console.log('🗑️ v12: removed legacy videos from Firebase');
    } catch (e) {
        console.warn('cleanup legacy videos failed:', e);
    }
}

/* ═══ Load Subject ═══ */
function _loadSubjectFromCache(uid) {
    try {
        const key = uid ? ('profile_target_data_' + uid) : QAMAR.STORAGE_KEYS.CURRENT_USER;
        const raw = localStorage.getItem(key);
        if (raw) ProfileState.subject = JSON.parse(raw);
    } catch (e) {}
}

async function _loadOwnerSubject() {
    if (!ProfileState.me || !ProfileState.me.uid) return;
    if (typeof db === 'undefined' || !db) return;
    try {
        const snap = await db.ref('users/' + ProfileState.me.uid).once('value');
        const remote = snap.val();
        if (!remote) return;
        ProfileState.subject = _mergeIdentity(ProfileState.me, remote);
        ProfileState.me = Object.assign({}, ProfileState.me, remote);
        if (typeof saveSession === 'function') saveSession(ProfileState.me, ProfileState.me.isGuest === true);
    } catch (e) { console.warn('load owner subject failed:', e); }
}

async function _loadVisitorSubject(uid) {
    if (!uid) return;
    if (typeof db === 'undefined' || !db) return;
    try {
        const snap = await db.ref('users/' + uid).once('value');
        const remote = snap.val();
        if (!remote) {
            _toast('⚠️ المستخدم غير موجود');
            ProfileState.subject = { uid: uid, name: 'مستخدم', rank: 'User' };
            return;
        }
        ProfileState.subject = remote;
        try { localStorage.setItem('profile_target_data_' + uid, JSON.stringify(remote)); } catch (e) {}
        if (ProfileState.me && ProfileState.me.uid && ProfileState.me.uid !== uid) {
            db.ref('users/' + uid + '/visitors/' + ProfileState.me.uid).set({
                time: Date.now(),
                name: ProfileState.me.name || 'زائر',
                avatar: ProfileState.me.avatar || ''
            }).catch(function () {});
        }
        await checkVisitorStatus();
    } catch (e) { console.warn('load visitor subject failed:', e); }
}

function _mergeIdentity(cachedUser, remoteUser) {
    if (!cachedUser) return remoteUser;
    if (!remoteUser) return cachedUser;
    const cachedAt = cachedUser.identityUpdatedAt || 0;
    const remoteAt = remoteUser.identityUpdatedAt || 0;
    if (remoteAt >= cachedAt) return remoteUser;
    const fields = (QAMAR.IDENTITY_FIELDS || []);
    const patch = {};
    fields.forEach(function (k) {
        if (cachedUser[k] !== undefined) patch[k] = cachedUser[k];
    });
    patch.identityUpdatedAt = cachedAt;
    if (typeof db !== 'undefined' && db) {
        db.ref('users/' + cachedUser.uid).update(patch).catch(function () {});
    }
    return Object.assign({}, remoteUser, patch);
}

function _startSubjectListener() {
    if (typeof db === 'undefined' || !db) return;
    const subj = ProfileState.subject;
    if (!subj || !subj.uid) return;

    db.ref('users/' + subj.uid).on('value', function (snap) {
        const remote = snap.val();
        if (!remote) return;
        const newHash = _userHash(remote);
        if (newHash === ProfileState.lastUserHash) return;
        ProfileState.lastUserHash = newHash;
        if (Date.now() > ProfileState.localLockUntil) {
            ProfileState.subject = Object.assign({}, ProfileState.subject, remote);
        }
        try {
            if (_isVisitor()) {
                localStorage.setItem('profile_target_data_' + subj.uid, JSON.stringify(remote));
            } else {
                localStorage.setItem(QAMAR.STORAGE_KEYS.CURRENT_USER, JSON.stringify(ProfileState.subject));
            }
        } catch (e) {}
        applyIdentityToDOM();
        renderInfoGrid();
    });

    if (_isVisitor()) {
        db.ref('user_presence/' + subj.uid).on('value', function (snap) {
            const p = snap.val() || {};
            const dot = document.getElementById('status-dot');
            if (!dot) return;
            if (p.state === 'online') {
                dot.className = 'status-dot online';
                dot.title = 'متصل';
            } else {
                dot.className = 'status-dot offline';
                dot.title = 'غير متصل';
            }
        });
    }
}

/* ═══ Apply Identity ═══ */
function applyIdentityToDOM() {
    const subj = ProfileState.subject;
    if (!subj) return;

    const nameEl = document.getElementById('profile-username');
    if (nameEl) {
        const displayName = subj.name || 'مستخدم';
        nameEl.textContent = displayName;
        nameEl.setAttribute('data-name', displayName);
        nameEl.setAttribute('data-text', displayName);

        if (window.NameEffects && typeof window.NameEffects.applyCinemaStyle === 'function') {
            window.NameEffects.applyCinemaStyle(nameEl, subj.cinemaBgStyle || '', 'bg');
        }

        if (window.NameEffects && typeof window.NameEffects.apply === 'function') {
            window.NameEffects.apply(nameEl, {
                nameColor: subj.nameColor || null,
                nameGradient: subj.nameGradient || null,
                nameBgColor: subj.nameBgColor || null,
                nameBgGradient: subj.nameBgGradient || null,
                color: subj.color || '#ffd700'
            });
        } else {
            nameEl.style.color = subj.color || '#ffd700';
        }
    }

    const bioEl = document.getElementById('profile-bio');
    if (bioEl) {
        bioEl.textContent = subj.bio || (QAMAR.DEFAULT_BIO || '❋ نجوم الشام ❋');
    }

    const roleEl = document.getElementById('role-text');
    if (roleEl) {
        const badge = (typeof getRankBadge === 'function') ? getRankBadge(subj.rank) : '👤';
        roleEl.textContent = badge + ' ' + (subj.rank || 'User');
    }

    _applyCover(subj);
    _applyAvatar(subj);
    _applyProfileBackground(subj);
    _applyProfileGlow(subj);
    _applyMusicButton(subj);

    renderPoetry();

    if (_isVisitor()) updateVisitorButtons();

    const adminBtn = document.getElementById('btn-admin-actions');
    if (adminBtn) {
        adminBtn.style.display = ProfileState.isAdminVisitor ? 'flex' : 'none';
    }
}

/* ⭐ v12: cover — صور فقط */
function _applyCover(subj) {
    const img = document.getElementById('profile-cover-img');
    if (!img) return;

    const cover = subj.cover;
    if (!cover) {
        img.style.display = 'none';
        img.removeAttribute('src');
        return;
    }

    img.style.display = 'block';
    if (img.src !== cover) img.src = cover;
}

function _applyAvatar(subj) {
    const img = document.getElementById('profile-avatar-img');
    if (img) {
        const src = subj.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(subj.name || 'User') + '&background=555&color=fff';
        if (img.src !== src) img.src = src;
    }
    const box = document.getElementById('avatar-box');
    if (!box) return;
    if (typeof applyAvatarFrameFromUser === 'function') {
        applyAvatarFrameFromUser(box, {
            avatarFrame: subj.avatarFrame || null,
            rank: subj.rank,
            rankLevel: subj.rankLevel || _getRankLevel(subj.rank)
        });
    }
}

/* ⭐ v12: profile bg — color/image فقط */
function _applyProfileBackground(subj) {
    const layer = document.getElementById('profile-bg-layer');
    if (!layer) return;
    const type = subj.profileBgType;
    const value = subj.profileBgValue;
    layer.innerHTML = '';
    layer.style.backgroundImage = '';
    layer.style.background = '';
    if (!type || !value) return;
    if (type === 'color') {
        layer.style.background = value;
    } else if (type === 'image') {
        layer.style.backgroundImage = 'url("' + value + '")';
        layer.style.backgroundSize = 'cover';
        layer.style.backgroundPosition = 'center';
    }
}

function _applyProfileGlow(subj) {
    const container = document.getElementById('profile-container');
    if (!container) return;
    if (subj.profileGlow) {
        container.style.setProperty('--glow-color', subj.profileGlow);
        container.classList.add('glow-active');
    } else {
        container.style.removeProperty('--glow-color');
        container.classList.remove('glow-active');
    }
}

/* ⭐ v12: Music — v11 logic يبقى (base64 legacy + URL جديد) */
function _applyMusicButton(subj) {
    const btn = document.getElementById('music-btn-mini');
    const player = document.getElementById('music-player');
    if (!btn || !player) return;

    if (!subj.musicURL) {
        btn.style.display = 'none';
        if (player.pause) player.pause();
        player.removeAttribute('src');
        return;
    }

    if (!_isVisitor()) { btn.style.display = 'none'; return; }
    btn.style.display = 'flex';

    var finalSrc = subj.musicURL;

    // ⭐ legacy base64 → Blob
    if (finalSrc.indexOf('data:') === 0) {
        try {
            var cachedSrc = player.getAttribute('data-blob-src');
            var cachedUrl = player.getAttribute('data-blob-url');

            if (cachedSrc === finalSrc && cachedUrl) {
                finalSrc = cachedUrl;
            } else {
                var commaIdx = finalSrc.indexOf(',');
                if (commaIdx > 0) {
                    var header = finalSrc.substring(0, commaIdx);
                    var b64 = finalSrc.substring(commaIdx + 1);
                    var mimeMatch = header.match(/:(.*?);/);
                    var mime = mimeMatch ? mimeMatch[1] : 'audio/mpeg';

                    var binary = atob(b64);
                    var len = binary.length;
                    var bytes = new Uint8Array(len);
                    for (var i = 0; i < len; i++) {
                        bytes[i] = binary.charCodeAt(i);
                    }
                    var blob = new Blob([bytes], { type: mime });

                    if (cachedUrl) {
                        try { URL.revokeObjectURL(cachedUrl); } catch (e) {}
                    }

                    var blobUrl = URL.createObjectURL(blob);
                    player.setAttribute('data-blob-url', blobUrl);
                    player.setAttribute('data-blob-src', finalSrc);
                    finalSrc = blobUrl;
                }
            }
        } catch (e) {
            console.warn('Base64→Blob failed:', e);
        }
    }

    if (player.src !== finalSrc) {
        player.src = finalSrc;
        player.load();
    }

    if (!btn.__setup) {
        btn.__setup = true;
        btn.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (player.paused) {
                var p = player.play();
                if (p && p.then) {
                    p.then(function () {
                        btn.classList.add('playing');
                        var ic = btn.querySelector('i');
                        if (ic) ic.className = 'fas fa-pause';
                    }).catch(function (err) {
                        console.warn('Play failed:', err);
                        _toast('⚠️ تعذر تشغيل الموسيقى');
                    });
                }
            } else {
                player.pause();
                btn.classList.remove('playing');
                var ic2 = btn.querySelector('i');
                if (ic2) ic2.className = 'fas fa-play';
            }
        };
    }
}

/* ═══ Info Grid ═══ */
function renderInfoGrid() {
    const grid = document.getElementById('info-grid');
    if (!grid) return;
    const subj = ProfileState.subject;
    if (!subj) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#666;padding:12px;font-size:12px;">لا معلومات</div>';
        return;
    }

    const items = [];
    if (subj.code) items.push({ icon: '🔑', label: 'المعرّف', value: subj.code });
    if (subj.country && _canView('country')) items.push({ icon: '🌍', label: 'الدولة', value: subj.country });
    if (subj.family && _canView('family')) items.push({ icon: '👨‍👩‍👧', label: 'العائلة', value: subj.family });
    if (subj.age && _canView('age')) items.push({ icon: '🎂', label: 'العمر', value: subj.age + ' سنة' });
    if (subj.gender && _canView('gender')) {
        const g = subj.gender === 'male' ? '👦 ذكر' : '👧 أنثى';
        items.push({ icon: '👤', label: 'الجنس', value: g });
    }
    if (subj.createdAt && _canView('joinedAt')) items.push({ icon: '📅', label: 'الانضمام', value: _formatDate(subj.createdAt) });
    if (subj.lastSeen && _canView('lastSeen')) {
        const roomId = subj.currentRoom || null;
        items.push({ icon: '🕐', label: 'آخر تواجد', value: _formatLastSeen(subj.lastSeen, roomId) });
    }
    if (_canView('points')) {
        db.ref('bot_data/quiz/scores/' + subj.uid).once('value').then(function (s) {
            const pts = s.val() || 0;
            const el = grid.querySelector('[data-info="points"] .ii-value');
            if (el) el.textContent = pts + ' نقطة';
        }).catch(function () {});
        items.push({ icon: '⭐', label: 'النقاط', value: '...', key: 'points' });
    }

    if (items.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#666;padding:12px;font-size:12px;">لا معلومات متاحة</div>';
        return;
    }

    grid.innerHTML = '';
    items.forEach(function (it) {
        const div = document.createElement('div');
        div.className = 'info-item';
        if (it.key) div.setAttribute('data-info', it.key);
        div.innerHTML =
            '<div class="ii-label">' + it.icon + ' ' + it.label + '</div>' +
            '<div class="ii-value">' + _esc(it.value) + '</div>';
        grid.appendChild(div);
    });
}

window.renderInfoGrid = renderInfoGrid;

/* ═══ Cover Buttons ═══ */
function _bindCoverButtons() {
    const closeBtn = document.getElementById('btn-close');
    if (closeBtn) {
        closeBtn.onclick = function () {
            try {
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage({ action: 'closeProfile' }, '*');
                }
            } catch (e) {}
        };
    }
    const collapseBtn = document.getElementById('btn-collapse-info');
    if (collapseBtn) {
        collapseBtn.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            ProfileState.collapsed = !ProfileState.collapsed;
            document.body.classList.toggle('visitor-collapsed', ProfileState.collapsed);
        };
    }
}

/* ═══ Tabs ═══ */
function renderTabsForMode() {
    const tabsBar = document.getElementById('tabsBar');
    if (!tabsBar) return;
    let html = '';
    html += '<button class="tab active" data-tab="home"><i class="fas fa-home"></i><span>الرئيسية</span></button>';
    html += '<button class="tab" data-tab="moments"><i class="fas fa-camera"></i><span>لحظات</span></button>';
    html += '<button class="tab" data-tab="friends"><i class="fas fa-users"></i><span>أصدقاء</span></button>';
    if (_isOwner()) {
        html += '<button class="tab" data-tab="settings"><i class="fas fa-cog"></i><span>إعدادات</span></button>';
    } else if (ProfileState.isAdminVisitor) {
        html += '<button class="tab" data-tab="admin"><i class="fas fa-crosshairs"></i><span>أوامر</span></button>';
    }
    tabsBar.innerHTML = html;
    tabsBar.querySelectorAll('.tab').forEach(function (t) {
        t.onclick = function () { switchTab(t.getAttribute('data-tab')); };
    });
}

function switchTab(tabName) {
    const tabsBar = document.getElementById('tabsBar');
    if (tabsBar) {
        tabsBar.querySelectorAll('.tab').forEach(function (t) {
            t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
        });
    }
    document.querySelectorAll('.tab-content').forEach(function (c) {
        c.classList.toggle('active', c.getAttribute('data-content') === tabName);
    });
    const scrollBox = document.getElementById('scroll-box');
    if (scrollBox) scrollBox.scrollTop = 0;
    if (tabName === 'moments') renderMomentsTab();
    if (tabName === 'friends') renderFriendsTab();
    if (tabName === 'settings') _resetSettingsPage();
    if (tabName === 'admin') renderAdminTab();
}

window.switchTab = switchTab;

/* ═══ Drill-down ═══ */
function _resetSettingsPage() {
    ProfileState.settingsHistory = ['main'];
    _showSettingsPage('main', false);
}

function _showSettingsPage(pageId, pushHistory) {
    document.querySelectorAll('.settings-page').forEach(function (p) {
        p.classList.remove('active');
    });
    const target = document.querySelector('.settings-page[data-page="' + pageId + '"]');
    if (target) target.classList.add('active');
    if (pushHistory !== false) {
        ProfileState.settingsHistory.push(pageId);
    }
    _renderSettingsPage(pageId);
    const scrollBox = document.getElementById('scroll-box');
    if (scrollBox) scrollBox.scrollTop = 0;
}

function _goBackSettings() {
    const stack = ProfileState.settingsHistory;
    if (stack.length <= 1) {
        _showSettingsPage('main', false);
        stack.length = 0;
        stack.push('main');
        return;
    }
    stack.pop();
    const prev = stack[stack.length - 1];
    _showSettingsPage(prev, false);
}

function _renderSettingsPage(pageId) {
    switch (pageId) {
        case 'name-color': renderNameColorPicker(); break;
        case 'name-gradient': renderNameGradientPicker(); break;
        case 'name-bg-color': renderNameBgColorPicker(); break;
        case 'name-bg-gradient': renderNameBgGradientPicker(); break;
        case 'name-cinema-bg': renderNameCinemaBgPicker(); break;
        case 'avatar-page': renderAvatarPage(); break;
        case 'cover-page': renderCoverPage(); break;
        case 'frame-page': renderFramePage(); break;
        case 'glow-page': renderGlowPage(); break;
        case 'profile-bg-page': renderProfileBgPage(); break;
        case 'music': renderMusicPage(); break;
        case 'poetry': renderPoetryPage(); break;
        case 'privacy': renderPrivacyPage(); break;
        case 'room': renderRoomPage(); break;
    }
}

function _bindSettingsNavigation() {
    document.querySelectorAll('[data-open-page]').forEach(function (btn) {
        btn.onclick = function () {
            _showSettingsPage(btn.getAttribute('data-open-page'));
        };
    });
    document.querySelectorAll('[data-back]').forEach(function (btn) {
        btn.onclick = function () { _goBackSettings(); };
    });
}

/* ⭐ v12: uploadFile — يستخدم UploadService */
async function uploadFile(file, options) {
    if (!window.UploadService) {
        throw new Error('UploadService غير محمّل');
    }
    return await window.UploadService.upload(file, options || {});
}

async function updateIdentityField(field, value) {
    const subj = ProfileState.subject;
    if (!subj || !subj.uid) return;
    const now = Date.now();
    subj[field] = value;
    subj.identityUpdatedAt = now;
    ProfileState.localLockUntil = now + 5000;
    if (typeof db !== 'undefined' && db) {
        try {
            const patch = {};
            patch[field] = value;
            patch.identityUpdatedAt = now;
            await db.ref('users/' + subj.uid).update(patch);
        } catch (e) {
            console.warn('Firebase update failed:', e);
            _toast('⚠️ فشل الحفظ');
            return;
        }
    }
    if (_isOwner()) {
        try {
            const json = JSON.stringify(subj);
            localStorage.setItem(QAMAR.STORAGE_KEYS.CURRENT_USER, json);
            localStorage.setItem(QAMAR.STORAGE_KEYS.USER, json);
            localStorage.setItem(QAMAR.STORAGE_KEYS.IDENTITY_UPDATED_AT, String(now));
        } catch (e) {}
    }
    applyIdentityToDOM();
    try {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ action: 'userDataUpdated', userData: subj }, '*');
        }
    } catch (e) {}
}

/* ═══ Edit Name / Bio / Visitor View ═══ */
function _bindEditName() {
    const btn = document.getElementById('btn-edit-username');
    if (!btn || btn.__bound) return;
    btn.__bound = true;
    btn.onclick = function () {
        const subj = ProfileState.subject;
        if (!subj) return;
        openAppModal({
            title: '✏️ تعديل الاسم',
            type: 'input',
            value: subj.name || '',
            maxLength: 20,
            onSave: async function (v) {
                v = (v || '').trim();
                if (!v || v.length < 2) { _toast('⚠️ اسم قصير'); return; }
                if (v === subj.name) return;
                if (typeof reserveName === 'function') {
                    const res = await reserveName(v, subj.uid);
                    if (!res.ok) {
                        if (res.reason === 'taken') _toast('⚠️ الاسم محجوز');
                        else _toast('⚠️ فشل الاتصال');
                        return;
                    }
                }
                if (subj.name && subj.name !== v) {
                    try { await db.ref('user_names/' + subj.name).remove(); } catch (e) {}
                }
                await updateIdentityField('name', v);
                _toast('✅ تم');
            }
        });
    };
}

function _bindEditBio() {
    const btn = document.getElementById('btn-edit-bio');
    if (!btn || btn.__bound) return;
    btn.__bound = true;
    btn.onclick = function () {
        const subj = ProfileState.subject;
        if (!subj) return;
        openAppModal({
            title: '✏️ تعديل البايو',
            type: 'input',
            value: subj.bio || '',
            maxLength: 120,
            onSave: async function (v) {
                v = (v || '').trim();
                await updateIdentityField('bio', v || (QAMAR.DEFAULT_BIO || '❋ نجوم الشام ❋'));
                _toast('✅ تم');
            }
        });
    };
}

function _bindVisitorView() {
    const btn = document.getElementById('btn-visitor-view-cover');
    if (!btn || btn.__bound) return;
    btn.__bound = true;
    btn.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        const me = ProfileState.me;
        if (!me || !me.uid) return;
        if (typeof buildProfileUrl === 'function') {
            location.href = buildProfileUrl(me.uid);
        } else {
            location.href = 'profile.html?uid=' + encodeURIComponent(me.uid);
        }
    };
}

/* ═══ Name Pickers ═══ */
function renderNameColorPicker() {
    const grid = document.getElementById('name-color-grid');
    const preview = document.getElementById('name-preview-color');
    if (!grid) return;
    const subj = ProfileState.subject;
    const displayName = subj ? (subj.name || 'مستخدم') : 'مستخدم';
    const currentColor = subj ? subj.nameColor : null;
    const currentGrad = subj ? subj.nameGradient : null;

    if (preview) {
        preview.textContent = displayName;
        preview.setAttribute('data-text', displayName);
        preview.setAttribute('data-name', displayName);
        window.NameEffects.apply(preview, {
            nameColor: currentColor,
            nameGradient: currentGrad,
            color: subj ? subj.color : '#ffd700'
        });
    }

    grid.innerHTML = '';
    const colors = (QAMAR.NAME_BG_COLORS || []).slice();
    ['#ffd700','#ffffff','#ff69b4','#00f3ff','#39ff14','#a855f7'].forEach(function (c) {
        if (colors.indexOf(c) === -1) colors.push(c);
    });

    colors.forEach(function (color) {
        const item = window.NameEffects.previewTemplate(displayName, {
            nameColor: color,
            color: color
        }, currentColor === color ? 'selected' : '');
        item.onclick = function () {
            updateIdentityField('nameColor', color);
            grid.querySelectorAll('.name-grid-item').forEach(function (x) { x.classList.remove('selected'); });
            item.classList.add('selected');
            if (preview) {
                window.NameEffects.apply(preview, {
                    nameColor: color,
                    nameGradient: currentGrad,
                    color: subj ? subj.color : '#ffd700'
                });
            }
        };
        grid.appendChild(item);
    });

    const removeBtn = document.getElementById('remove-name-color');
    if (removeBtn && !removeBtn.__bound) {
        removeBtn.__bound = true;
        removeBtn.onclick = function () {
            updateIdentityField('nameColor', null);
            renderNameColorPicker();
        };
    }
}

function renderNameGradientPicker() {
    const grid = document.getElementById('name-gradient-grid');
    const preview = document.getElementById('name-preview-gradient');
    if (!grid) return;
    const subj = ProfileState.subject;
    const displayName = subj ? (subj.name || 'مستخدم') : 'مستخدم';
    const currentGrad = subj ? subj.nameGradient : null;
    const currentColor = subj ? subj.nameColor : null;

    if (preview) {
        preview.textContent = displayName;
        preview.setAttribute('data-text', displayName);
        preview.setAttribute('data-name', displayName);
        window.NameEffects.apply(preview, {
            nameColor: currentColor,
            nameGradient: currentGrad,
            color: subj ? subj.color : '#ffd700'
        });
    }

    grid.innerHTML = '';
    NAME_GRADIENTS.forEach(function (grad) {
        const isSelected = currentGrad && currentGrad[0] === grad[0] && currentGrad[1] === grad[1];
        const item = window.NameEffects.previewTemplate(displayName, {
            nameColor: currentColor,
            nameGradient: grad,
            color: subj ? subj.color : '#ffd700'
        }, isSelected ? 'selected' : '');
        item.onclick = function () {
            updateIdentityField('nameGradient', grad);
            grid.querySelectorAll('.name-grid-item').forEach(function (x) { x.classList.remove('selected'); });
            item.classList.add('selected');
            if (preview) {
                window.NameEffects.apply(preview, {
                    nameColor: currentColor,
                    nameGradient: grad,
                    color: subj ? subj.color : '#ffd700'
                });
            }
        };
        grid.appendChild(item);
    });

    const removeBtn = document.getElementById('remove-name-gradient');
    if (removeBtn && !removeBtn.__bound) {
        removeBtn.__bound = true;
        removeBtn.onclick = function () {
            updateIdentityField('nameGradient', null);
            renderNameGradientPicker();
        };
    }
}

function renderNameBgColorPicker() {
    const grid = document.getElementById('name-bg-color-grid');
    const preview = document.getElementById('name-preview-bg-color');
    if (!grid) return;
    const subj = ProfileState.subject;
    const displayName = subj ? (subj.name || 'مستخدم') : 'مستخدم';
    const currentBgColor = subj ? subj.nameBgColor : null;
    const currentBgGrad = subj ? subj.nameBgGradient : null;
    const currentColor = subj ? subj.nameColor : null;
    const currentGrad = subj ? subj.nameGradient : null;
    const currentCinema = subj ? subj.cinemaBgStyle : null;

    if (preview) {
        preview.textContent = displayName;
        preview.setAttribute('data-text', displayName);
        preview.setAttribute('data-name', displayName);
        if (currentCinema) {
            window.NameEffects.applyCinemaStyle(preview, currentCinema, 'bg');
        }
        window.NameEffects.apply(preview, {
            nameColor: currentColor,
            nameGradient: currentGrad,
            nameBgColor: currentBgColor,
            nameBgGradient: currentBgGrad,
            color: subj ? subj.color : '#ffd700'
        });
    }

    grid.innerHTML = '';
    const colors = (QAMAR.NAME_BG_COLORS || []).slice();

    colors.forEach(function (color) {
        const item = window.NameEffects.previewTemplate(displayName, {
            nameColor: '#ffffff',
            nameBgColor: color
        }, currentBgColor === color && !currentBgGrad && !currentCinema ? 'selected' : '');
        item.onclick = function () {
            updateIdentityField('nameBgColor', color);
            updateIdentityField('nameBgGradient', null);
            updateIdentityField('cinemaBgStyle', null);
            grid.querySelectorAll('.name-grid-item').forEach(function (x) { x.classList.remove('selected'); });
            item.classList.add('selected');
            if (preview) {
                window.NameEffects.applyCinemaStyle(preview, '', 'bg');
                window.NameEffects.apply(preview, {
                    nameColor: currentColor,
                    nameGradient: currentGrad,
                    nameBgColor: color,
                    nameBgGradient: null,
                    color: subj ? subj.color : '#ffd700'
                });
            }
        };
        grid.appendChild(item);
    });

    const removeBtn = document.getElementById('remove-name-bg-color');
    if (removeBtn && !removeBtn.__bound) {
        removeBtn.__bound = true;
        removeBtn.onclick = function () {
            updateIdentityField('nameBgColor', null);
            renderNameBgColorPicker();
        };
    }
}

function renderNameBgGradientPicker() {
    const grid = document.getElementById('name-bg-gradient-grid');
    const preview = document.getElementById('name-preview-bg-gradient');
    if (!grid) return;
    const subj = ProfileState.subject;
    const displayName = subj ? (subj.name || 'مستخدم') : 'مستخدم';
    const currentBgGrad = subj ? subj.nameBgGradient : null;
    const currentColor = subj ? subj.nameColor : null;
    const currentGrad = subj ? subj.nameGradient : null;
    const currentCinema = subj ? subj.cinemaBgStyle : null;

    if (preview) {
        preview.textContent = displayName;
        preview.setAttribute('data-text', displayName);
        preview.setAttribute('data-name', displayName);
        if (currentCinema) {
            window.NameEffects.applyCinemaStyle(preview, currentCinema, 'bg');
        }
        window.NameEffects.apply(preview, {
            nameColor: currentColor,
            nameGradient: currentGrad,
            nameBgColor: null,
            nameBgGradient: currentBgGrad,
            color: subj ? subj.color : '#ffd700'
        });
    }

    grid.innerHTML = '';
    NAME_GRADIENTS.forEach(function (grad) {
        const isSelected = currentBgGrad && currentBgGrad[0] === grad[0] && currentBgGrad[1] === grad[1] && !currentCinema;
        const item = window.NameEffects.previewTemplate(displayName, {
            nameColor: '#ffffff',
            nameBgGradient: grad
        }, isSelected ? 'selected' : '');
        item.onclick = function () {
            updateIdentityField('nameBgColor', null);
            updateIdentityField('nameBgGradient', grad);
            updateIdentityField('cinemaBgStyle', null);
            grid.querySelectorAll('.name-grid-item').forEach(function (x) { x.classList.remove('selected'); });
            item.classList.add('selected');
            if (preview) {
                window.NameEffects.applyCinemaStyle(preview, '', 'bg');
                window.NameEffects.apply(preview, {
                    nameColor: currentColor,
                    nameGradient: currentGrad,
                    nameBgColor: null,
                    nameBgGradient: grad,
                    color: subj ? subj.color : '#ffd700'
                });
            }
        };
        grid.appendChild(item);
    });

    const removeBtn = document.getElementById('remove-name-bg-gradient');
    if (removeBtn && !removeBtn.__bound) {
        removeBtn.__bound = true;
        removeBtn.onclick = function () {
            updateIdentityField('nameBgGradient', null);
            renderNameBgGradientPicker();
        };
    }
}

function renderNameCinemaBgPicker() {
    const grid = document.getElementById('name-cinema-bg-grid');
    const preview = document.getElementById('name-preview-cinema-bg');
    if (!grid) return;

    const subj = ProfileState.subject;
    const displayName = subj ? (subj.name || 'مستخدم') : 'مستخدم';
    const currentStyle = subj ? (subj.cinemaBgStyle || '') : '';

    if (preview) {
        preview.textContent = displayName;
        preview.setAttribute('data-text', displayName);
        preview.setAttribute('data-name', displayName);
        preview.style.color = '#ffffff';
        window.NameEffects.applyCinemaStyle(preview, currentStyle, 'bg');
    }

    const styles = _getCinemaBgStyles();

    grid.innerHTML = '';
    styles.forEach(function (style) {
        const item = document.createElement('div');
        item.className = 'name-grid-item' + (currentStyle === style.id ? ' selected' : '');

        const inner = document.createElement('span');
        inner.className = 'name-styled';
        inner.textContent = displayName;
        inner.setAttribute('data-name', displayName);
        inner.setAttribute('data-text', displayName);
        inner.style.color = '#ffffff';
        item.appendChild(inner);

        if (style.id) {
            window.NameEffects.applyCinemaStyle(inner, style.id, 'bg');
        }

        const lbl = document.createElement('div');
        lbl.style.cssText = 'font-size:10px;color:#888;margin-top:8px;text-align:center;';
        lbl.textContent = (style.icon || '🎬') + ' ' + (style.label || style.id);
        item.style.flexDirection = 'column';
        item.appendChild(lbl);

        item.onclick = function () {
            updateIdentityField('cinemaBgStyle', style.id || null);
            if (style.id) {
                updateIdentityField('nameBgColor', null);
                updateIdentityField('nameBgGradient', null);
            }
            grid.querySelectorAll('.name-grid-item').forEach(function (x) { x.classList.remove('selected'); });
            item.classList.add('selected');

            if (preview) {
                window.NameEffects.applyCinemaStyle(preview, style.id || '', 'bg');
            }
        };
        grid.appendChild(item);
    });

    const removeBtn = document.getElementById('remove-name-cinema-bg');
    if (removeBtn && !removeBtn.__bound) {
        removeBtn.__bound = true;
        removeBtn.onclick = function () {
            updateIdentityField('cinemaBgStyle', null);
            renderNameCinemaBgPicker();
        };
    }
}

/* ═══ Avatar / Cover / Frame / Glow / ProfileBG ═══ */
function renderAvatarPage() {
    const subj = ProfileState.subject;
    const img = document.getElementById('avatar-preview-img');
    if (img && subj) {
        img.src = subj.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(subj.name || 'U') + '&background=555&color=fff';
    }
}

function _bindImagesUploads() {
    const upAvatar = document.getElementById('btn-upload-avatar');
    if (upAvatar && !upAvatar.__bound) {
        upAvatar.__bound = true;
        upAvatar.onclick = function () {
            pickImageFile('avatar-file-input', async function (file) {
                _toast('⏳ جاري الرفع...');
                try {
                    const url = await uploadFile(file);
                    await updateIdentityField('avatar', url);
                    renderAvatarPage();
                    _toast('✅ تم');
                } catch (e) { _toast('⚠️ فشل الرفع'); }
            }, { maxMb: 5 });
        };
    }

    const removeAvatar = document.getElementById('btn-remove-avatar');
    if (removeAvatar && !removeAvatar.__bound) {
        removeAvatar.__bound = true;
        removeAvatar.onclick = function () {
            if (!confirm('إزالة الصورة الشخصية؟')) return;
            updateIdentityField('avatar', null);
            renderAvatarPage();
            _toast('✅ تم');
        };
    }

    const upCover = document.getElementById('btn-upload-cover');
    if (upCover && !upCover.__bound) {
        upCover.__bound = true;
        upCover.onclick = function () {
            pickImageFile('cover-file-input', async function (file) {
                _toast('⏳ جاري الرفع...');
                try {
                    const url = await uploadFile(file);
                    await updateIdentityField('cover', url);
                    await updateIdentityField('coverType', 'image');
                    renderCoverPage();
                    _toast('✅ تم');
                } catch (e) { _toast('⚠️ فشل الرفع'); }
            }, { maxMb: 32 });
        };
    }

    const removeCover = document.getElementById('btn-remove-cover');
    if (removeCover && !removeCover.__bound) {
        removeCover.__bound = true;
        removeCover.onclick = function () {
            if (!confirm('إزالة الغلاف؟')) return;
            updateIdentityField('cover', null);
            updateIdentityField('coverType', null);
            renderCoverPage();
            _toast('✅ تم');
        };
    }

    document.querySelectorAll('[data-bg-type]').forEach(function (btn) {
        if (btn.__bound) return;
        btn.__bound = true;
        btn.onclick = function () {
            _switchBgTypeUI(btn.getAttribute('data-bg-type'));
        };
    });

    const bgColor = document.getElementById('profile-bg-color-picker');
    if (bgColor && !bgColor.__bound) {
        bgColor.__bound = true;
        let _t = null;
        bgColor.oninput = function () {
            clearTimeout(_t);
            _t = setTimeout(function () {
                updateIdentityField('profileBgType', 'color');
                updateIdentityField('profileBgValue', bgColor.value);
            }, 400);
        };
    }

    const upBg = document.getElementById('btn-upload-bg');
    if (upBg && !upBg.__bound) {
        upBg.__bound = true;
        upBg.onclick = function () {
            pickImageFile('profile-bg-input', async function (file) {
                _toast('⏳ جاري الرفع...');
                try {
                    const url = await uploadFile(file);
                    await updateIdentityField('profileBgType', 'image');
                    await updateIdentityField('profileBgValue', url);
                    renderProfileBgPage();
                    _toast('✅ تم');
                } catch (e) { _toast('⚠️ فشل الرفع'); }
            }, { maxMb: 15 });
        };
    }

    const removeBg = document.getElementById('btn-remove-profile-bg');
    if (removeBg && !removeBg.__bound) {
        removeBg.__bound = true;
        removeBg.onclick = function () {
            if (!confirm('إزالة الخلفية؟')) return;
            updateIdentityField('profileBgType', null);
            updateIdentityField('profileBgValue', null);
            renderProfileBgPage();
            _toast('✅ تم');
        };
    }
}

/* ⭐ v12: بدون video */
function _switchBgTypeUI(type) {
    const colorSec = document.getElementById('bg-color-section');
    const mediaSec = document.getElementById('bg-media-section');
    if (!colorSec || !mediaSec) return;
    colorSec.style.display = (type === 'color') ? 'block' : 'none';
    mediaSec.style.display = (type === 'image') ? 'block' : 'none';
    const lbl = document.getElementById('bg-upload-label');
    if (lbl) lbl.textContent = 'رفع صورة';
    document.querySelectorAll('[data-bg-type]').forEach(function (b) {
        b.style.opacity = (b.getAttribute('data-bg-type') === type) ? '1' : '0.5';
    });
}

function renderCoverPage() {
    const subj = ProfileState.subject;
    const img = document.getElementById('cover-preview-img');
    if (!img) return;
    if (subj && subj.cover) {
        img.style.display = 'block';
        img.src = subj.cover;
    } else {
        img.style.display = 'none';
    }
}

function renderFramePage() {
    const container = document.getElementById('frames-grid-container');
    if (!container) return;
    const subj = ProfileState.subject;
    const avatarSrc = subj ? subj.avatar : null;
    const currentFrame = subj ? subj.avatarFrame : null;

    if (typeof renderFramesGrid === 'function') {
        renderFramesGrid(container, {
            avatarSrc: avatarSrc,
            currentFrameId: currentFrame,
            onSelect: async function (frameId) {
                try {
                    try {
                        localStorage.setItem('saved_avatar_frame_motion', frameId || '');
                    } catch (e) {}

                    await updateIdentityField('avatarFrame', frameId || null);
                    _toast(frameId ? '✅ تم حفظ الإطار' : '✅ أُزيل الإطار');

                    setTimeout(function () {
                        const box = document.getElementById('avatar-box');
                        if (box) {
                            box.querySelectorAll('.qf').forEach(function (e) { e.remove(); });
                            if (frameId && typeof applyFrameTo === 'function') {
                                applyFrameTo(box, frameId);
                            } else {
                                if (window.NameEffects && typeof window.NameEffects.clearDefaultAvatarFrame === 'function') {
                                    window.NameEffects.clearDefaultAvatarFrame(box);
                                }
                                if (window.NameEffects && typeof window.NameEffects.applyDefaultAvatarFrame === 'function') {
                                    window.NameEffects.applyDefaultAvatarFrame(box, subj.rank, subj.rankLevel);
                                }
                            }
                        }
                    }, 100);
                } catch (e) {
                    console.error('Frame save failed:', e);
                    _toast('⚠️ فشل الحفظ');
                }
            }
        });
    }

    const removeBtn = document.getElementById('btn-remove-frame');
    if (removeBtn && !removeBtn.__bound) {
        removeBtn.__bound = true;
        removeBtn.onclick = function () {
            try { localStorage.removeItem('saved_avatar_frame_motion'); } catch (e) {}
            updateIdentityField('avatarFrame', null);

            setTimeout(function () {
                const box = document.getElementById('avatar-box');
                if (box) {
                    box.querySelectorAll('.qf').forEach(function (e) { e.remove(); });
                    if (window.NameEffects && typeof window.NameEffects.clearDefaultAvatarFrame === 'function') {
                        window.NameEffects.clearDefaultAvatarFrame(box);
                    }
                    if (window.NameEffects && typeof window.NameEffects.applyDefaultAvatarFrame === 'function') {
                        window.NameEffects.applyDefaultAvatarFrame(box, subj.rank, subj.rankLevel);
                    }
                }
            }, 100);

            renderFramePage();
            _toast('✅ تم');
        };
    }
}

function renderGlowPage() {
    const container = document.getElementById('glow-grid-container');
    if (!container) return;
    const subj = ProfileState.subject;
    const current = subj ? subj.profileGlow : null;
    container.innerHTML = '';
    (QAMAR.PROFILE_GLOWS || []).forEach(function (color) {
        const tile = document.createElement('div');
        tile.className = 'glow-tile' + (current === color ? ' selected' : '');
        const circle = document.createElement('div');
        circle.className = 'glow-circle';
        circle.style.boxShadow = '0 0 20px 5px ' + color + ', 0 0 40px 10px ' + color;
        circle.style.background = color;
        circle.style.opacity = '0.6';
        tile.appendChild(circle);
        tile.onclick = function () {
            updateIdentityField('profileGlow', color);
            container.querySelectorAll('.glow-tile').forEach(function (x) { x.classList.remove('selected'); });
            tile.classList.add('selected');
            _toast('✅ تم');
        };
        container.appendChild(tile);
    });
    const removeBtn = document.getElementById('btn-remove-glow');
    if (removeBtn && !removeBtn.__bound) {
        removeBtn.__bound = true;
        removeBtn.onclick = function () {
            updateIdentityField('profileGlow', null);
            renderGlowPage();
            _toast('✅ تم');
        };
    }
}

function renderProfileBgPage() {
    const subj = ProfileState.subject;
    if (!subj) return;
    const type = subj.profileBgType;
    _switchBgTypeUI(type || 'color');
    const colorPicker = document.getElementById('profile-bg-color-picker');
    if (colorPicker && type === 'color' && subj.profileBgValue) {
        colorPicker.value = subj.profileBgValue;
    }
}

/* ═══ Music ═══ */
function renderMusicPage() {
    const subj = ProfileState.subject;
    const status = document.getElementById('music-status');
    if (status) {
        status.textContent = (subj && subj.musicURL) ? 'يوجد موسيقى ✅' : 'لا يوجد موسيقى';
    }
}

function _bindMusic() {
    const upMusic = document.getElementById('btn-upload-music');
    if (upMusic && !upMusic.__bound) {
        upMusic.__bound = true;
        upMusic.onclick = function () {
            pickImageFile('music-file-input', async function (file) {
                _toast('⏳ جاري الرفع...');
                try {
                    const url = await uploadFile(file);
                    await updateIdentityField('musicURL', url);
                    renderMusicPage();
                    _toast('✅ تم');
                } catch (e) { _toast('⚠️ فشل الرفع'); }
            }, { maxMb: MAX_AUDIO_MB });
        };
    }
    const removeMusic = document.getElementById('btn-remove-music');
    if (removeMusic && !removeMusic.__bound) {
        removeMusic.__bound = true;
        removeMusic.onclick = function () {
            if (!confirm('إزالة الموسيقى؟')) return;
            updateIdentityField('musicURL', null);
            renderMusicPage();
            _toast('✅ تم');
        };
    }
}

/* ═══ Poetry ═══ */
function renderPoetryPage() {
    const subj = ProfileState.subject;
    if (!subj) return;
    ProfileState.poetry.text = subj.poetry || '';
    ProfileState.poetry.bg = subj.poetryBg || null;
    ProfileState.poetry.attachment = subj.poetryAttachment || null;
    const inp = document.getElementById('poetry-input');
    if (inp) {
        inp.value = ProfileState.poetry.text;
        _updatePoetryCharCount();
    }
    _renderPoetryBgPreview();
    _renderPoetryAttachPreview();
}

function _updatePoetryCharCount() {
    const inp = document.getElementById('poetry-input');
    const cnt = document.getElementById('poetry-char-count');
    if (inp && cnt) cnt.textContent = inp.value.length;
}

function _renderPoetryBgPreview() {
    const box = document.getElementById('poetry-bg-preview');
    if (!box) return;
    box.innerHTML = '';
    if (ProfileState.poetry.bg) {
        const img = document.createElement('img');
        img.src = ProfileState.poetry.bg;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        box.appendChild(img);
    } else {
        const ph = document.createElement('div');
        ph.style.cssText = 'color:#555;font-size:12px;';
        ph.textContent = 'لا يوجد';
        box.appendChild(ph);
    }
}

function _renderPoetryAttachPreview() {
    const box = document.getElementById('poetry-attach-preview');
    if (!box) return;
    box.innerHTML = '';
    if (ProfileState.poetry.attachment) {
        const img = document.createElement('img');
        img.src = ProfileState.poetry.attachment;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        box.appendChild(img);
    } else {
        const ph = document.createElement('div');
        ph.style.cssText = 'color:#555;font-size:12px;';
        ph.textContent = 'لا يوجد';
        box.appendChild(ph);
    }
}

function renderPoetry() {
    const section = document.getElementById('poetry-section');
    if (!section) return;
    const subj = ProfileState.subject;
    if (!subj) { section.classList.add('empty'); return; }
    const text = subj.poetry || '';
    const bg = subj.poetryBg || null;
    const attach = subj.poetryAttachment || null;
    if (!text && !attach) {
        section.classList.add('empty');
        return;
    }
    section.classList.remove('empty');
    if (bg) {
        section.style.backgroundImage = 'url("' + bg + '")';
        section.style.backgroundSize = 'cover';
        section.style.backgroundPosition = 'center';
    } else {
        section.style.backgroundImage = '';
    }
    const textEl = document.getElementById('poetry-display');
    if (textEl) textEl.textContent = text || '';
    const authorEl = document.getElementById('poetry-author');
    if (authorEl) authorEl.textContent = text ? ('— ' + (subj.name || '')) : '';
    const attEl = document.getElementById('poetry-attachment');
    if (attEl) {
        if (attach) {
            attEl.style.display = 'block';
            attEl.src = attach;
            attEl.onclick = function () { window.open(attach, '_blank'); };
        } else {
            attEl.style.display = 'none';
            attEl.removeAttribute('src');
        }
    }
}

function _bindPoetry() {
    const inp = document.getElementById('poetry-input');
    if (inp && !inp.__bound) {
        inp.__bound = true;
        inp.addEventListener('input', function () {
            ProfileState.poetry.text = this.value;
            _updatePoetryCharCount();
        });
    }
    const upBg = document.getElementById('btn-upload-poetry-bg');
    if (upBg && !upBg.__bound) {
        upBg.__bound = true;
        upBg.onclick = function () {
            pickImageFile('poetry-bg-input', async function (file) {
                _toast('⏳ جاري الرفع...');
                try {
                    const url = await uploadFile(file);
                    ProfileState.poetry.bg = url;
                    _renderPoetryBgPreview();
                    _toast('✅ تم (لا تنسَ الحفظ)');
                } catch (e) { _toast('⚠️ فشل الرفع'); }
            }, { maxMb: 5 });
        };
    }
    const removeBg = document.getElementById('btn-remove-poetry-bg');
    if (removeBg && !removeBg.__bound) {
        removeBg.__bound = true;
        removeBg.onclick = function () {
            ProfileState.poetry.bg = null;
            _renderPoetryBgPreview();
        };
    }
    const upAtt = document.getElementById('btn-upload-poetry-attach');
    if (upAtt && !upAtt.__bound) {
        upAtt.__bound = true;
        upAtt.onclick = function () {
            pickImageFile('poetry-attach-input', async function (file) {
                _toast('⏳ جاري الرفع...');
                try {
                    const url = await uploadFile(file);
                    ProfileState.poetry.attachment = url;
                    _renderPoetryAttachPreview();
                    _toast('✅ تم (لا تنسَ الحفظ)');
                } catch (e) { _toast('⚠️ فشل الرفع'); }
            }, { maxMb: 5 });
        };
    }
    const removeAtt = document.getElementById('btn-remove-poetry-attach');
    if (removeAtt && !removeAtt.__bound) {
        removeAtt.__bound = true;
        removeAtt.onclick = function () {
            ProfileState.poetry.attachment = null;
            _renderPoetryAttachPreview();
        };
    }
    const saveBtn = document.getElementById('btn-save-poetry');
    if (saveBtn && !saveBtn.__bound) {
        saveBtn.__bound = true;
        saveBtn.onclick = async function () {
            const text = (ProfileState.poetry.text || '').trim();
            if (text.length > 700) { _toast('⚠️ الحد 700 حرف'); return; }
            _toast('⏳ جاري الحفظ...');
            try {
                await updateIdentityField('poetry', text);
                await updateIdentityField('poetryBg', ProfileState.poetry.bg);
                await updateIdentityField('poetryAttachment', ProfileState.poetry.attachment);
                renderPoetry();
                _toast('✅ تم الحفظ');
            } catch (e) { _toast('⚠️ فشل'); }
        };
    }
    const removePoetry = document.getElementById('btn-remove-poetry');
    if (removePoetry && !removePoetry.__bound) {
        removePoetry.__bound = true;
        removePoetry.onclick = function () {
            if (!confirm('حذف الشعر بالكامل؟')) return;
            ProfileState.poetry.text = '';
            ProfileState.poetry.bg = null;
            ProfileState.poetry.attachment = null;
            updateIdentityField('poetry', '');
            updateIdentityField('poetryBg', null);
            updateIdentityField('poetryAttachment', null);
            renderPoetryPage();
            renderPoetry();
            _toast('✅ تم');
        };
    }
}

/* ═══ Privacy ═══ */
const PRIVACY_FIELDS = [
    { key: 'country',  label: 'الدولة' },
    { key: 'age',      label: 'العمر' },
    { key: 'family',   label: 'العائلة' },
    { key: 'gender',   label: 'الجنس' },
    { key: 'joinedAt', label: 'تاريخ الانضمام' },
    { key: 'lastSeen', label: 'آخر تواجد' },
    { key: 'points',   label: 'نقاط التفاعل' },
    { key: 'friends',  label: 'قائمة الأصدقاء' }
];

function renderPrivacyPage() {
    const container = document.getElementById('privacy-container');
    if (!container) return;
    const subj = ProfileState.subject;
    if (!subj) return;
    const privacy = subj.privacy || {};
    container.innerHTML = '';
    PRIVACY_FIELDS.forEach(function (f) {
        const row = document.createElement('div');
        row.className = 'settings-row';
        const lbl = document.createElement('span');
        lbl.className = 'sr-label';
        lbl.textContent = f.label;
        const sel = document.createElement('select');
        sel.className = 'setting-select';
        ['public', 'friends', 'private'].forEach(function (v) {
            const op = document.createElement('option');
            op.value = v;
            op.textContent = v === 'public' ? '🌍 الجميع' : v === 'friends' ? '👥 الأصدقاء' : '🔒 أنا فقط';
            if ((privacy[f.key] || 'public') === v) op.selected = true;
            sel.appendChild(op);
        });
        sel.onchange = function () {
            const newPrivacy = Object.assign({}, subj.privacy || {});
            newPrivacy[f.key] = sel.value;
            updateIdentityField('privacy', newPrivacy);
        };
        row.appendChild(lbl);
        row.appendChild(sel);
        container.appendChild(row);
    });
}

function _bindPrivacy() {}

function renderRoomPage() {
    const el = document.getElementById('current-room-name');
    if (!el) return;
    const roomId = (typeof ChatState !== 'undefined' && ChatState.currentRoom) || 'general';
    const room = QAMAR.ROOMS[roomId];
    el.textContent = room ? (room.icon + ' ' + room.name) : roomId;
}

/* ═══ Danger ═══ */
function _bindDangerActions() {
    const leaveBtn = document.getElementById('btn-leave-room');
    if (leaveBtn && !leaveBtn.__bound) {
        leaveBtn.__bound = true;
        leaveBtn.onclick = function () {
            if (!confirm('مغادرة الغرفة؟')) return;
            try {
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage({ action: 'leaveRoom' }, '*');
                }
            } catch (e) {}
        };
    }
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn && !logoutBtn.__bound) {
        logoutBtn.__bound = true;
        logoutBtn.onclick = function () {
            if (!confirm('تسجيل الخروج؟')) return;
            try {
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage({ action: 'logout' }, '*');
                } else {
                    if (typeof logout === 'function') {
                        logout().then(function () { location.reload(); });
                    }
                }
            } catch (e) {}
        };
    }
    const delBtn = document.getElementById('btn-delete-account');
    if (delBtn && !delBtn.__bound) {
        delBtn.__bound = true;
        delBtn.onclick = function () { _confirmDeleteAccount(); };
    }
}

function _confirmDeleteAccount() {
    openAppModal({
        title: '🗑️ حذف الحساب',
        html:
            '<div style="color:#ff8888;font-size:13px;text-align:center;line-height:1.6;padding:8px;background:rgba(255,68,68,0.15);border-radius:8px;">' +
                '⚠️ سيتم حذف حسابك نهائياً.<br>' +
                'اكتب كلمة <b style="color:#ff4444;">حذف</b> للتأكيد:' +
            '</div>' +
            '<input type="text" id="delete-confirm-input" placeholder="حذف" style="width:100%;margin-top:10px;padding:12px;background:rgba(255,255,255,0.08);border:1px solid #ff4444;border-radius:10px;color:#fff;font-family:inherit;text-align:center;box-sizing:border-box;">',
        okLabel: 'حذف',
        cancelLabel: 'إلغاء',
        onSave: async function () {
            const inp = document.getElementById('delete-confirm-input');
            const v = (inp ? inp.value : '').trim();
            if (v !== 'حذف') { _toast('⚠️ الكلمة غير صحيحة'); return; }
            await _executeDeleteAccount();
        }
    });
}

async function _executeDeleteAccount() {
    const subj = ProfileState.subject;
    if (!subj || !subj.uid) return;
    if (typeof db === 'undefined' || !db) return;
    _toast('⏳ جاري الحذف...');
    try {
        const uid = subj.uid;
        const name = subj.name;
        const code = subj.code;
        await Promise.all([
            db.ref('users/' + uid).remove(),
            db.ref('user_presence/' + uid).remove(),
            name ? db.ref('user_names/' + name).remove().catch(function () {}) : Promise.resolve(),
            code ? db.ref('user_codes/' + code).remove().catch(function () {}) : Promise.resolve()
        ]);
        try {
            if (typeof auth !== 'undefined' && auth && auth.currentUser) {
                await auth.currentUser.delete();
            }
        } catch (e) {}
        try {
            ['qamar_user', 'qamar_current_user', 'qamar_guest'].forEach(function (k) {
                localStorage.removeItem(k);
            });
        } catch (e) {}
        _toast('✅ تم الحذف');
        setTimeout(function () {
            try {
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage({ action: 'closeProfile' }, '*');
                }
                location.reload();
            } catch (e) {}
        }, 1200);
    } catch (e) {
        console.warn('delete account failed:', e);
        _toast('⚠️ فشل الحذف');
    }
}

/* ═══ Visitor Buttons ═══ */
async function checkVisitorStatus() {
    if (!_isVisitor()) return;
    const subj = ProfileState.subject;
    const me = ProfileState.me;
    if (!subj || !me || !me.uid || !subj.uid) return;

    try {
        const likeSnap = await db.ref('users/' + subj.uid + '/likes/' + me.uid).once('value');
        ProfileState.likes.isLiked = likeSnap.exists();
    } catch (e) {}

    try {
        const fSnap = await db.ref('users/' + subj.uid + '/friends/' + me.uid).once('value');
        const f = fSnap.val();
        if (f && f.status === 'accepted') {
            ProfileState.friends.state = 'accepted';
        } else {
            const r1 = await db.ref('users/' + me.uid + '/friend_requests/' + subj.uid).once('value');
            const r2 = await db.ref('users/' + subj.uid + '/friend_requests/' + me.uid).once('value');
            if (r2.exists() && !r1.exists()) ProfileState.friends.state = 'incoming';
            else if (r1.exists()) ProfileState.friends.state = 'pending';
            else ProfileState.friends.state = 'off';
        }
    } catch (e) {}

    try {
        const bSnap = await db.ref('users/' + me.uid + '/blocked/' + subj.uid).once('value');
        ProfileState.blocked.isBlocked = bSnap.exists();
    } catch (e) {}

    updateVisitorButtons();
}

function updateVisitorButtons() {
    const heart = document.getElementById('btn-heart');
    if (heart) {
        heart.textContent = ProfileState.likes.isLiked ? '💔' : '❤️';
        heart.classList.toggle('active', ProfileState.likes.isLiked);
        heart.setAttribute('data-state', ProfileState.likes.isLiked ? 'on' : 'off');
    }

    const friend = document.getElementById('btn-friend');
    if (friend) {
        const st = ProfileState.friends.state;
        if (st === 'accepted') {
            friend.textContent = '✅';
            friend.setAttribute('data-state', 'accepted');
            friend.classList.add('active');
            friend.title = 'صديق — اضغط للإزالة';
        } else if (st === 'pending') {
            friend.textContent = '⏳';
            friend.setAttribute('data-state', 'pending');
            friend.classList.remove('active');
            friend.title = 'طلب معلّق';
        } else if (st === 'incoming') {
            friend.textContent = '📩';
            friend.setAttribute('data-state', 'incoming');
            friend.classList.add('active');
            friend.title = 'طلب وارد — اضغط للقبول';
        } else {
            friend.textContent = '➕';
            friend.setAttribute('data-state', 'off');
            friend.classList.remove('active');
            friend.title = 'إضافة صديق';
        }
    }

    const block = document.getElementById('btn-block');
    if (block) {
        block.textContent = ProfileState.blocked.isBlocked ? '🔓' : '🚫';
        block.classList.toggle('active', ProfileState.blocked.isBlocked);
    }
}

function _bindLikesFriendsBlocked() {
    const heart = document.getElementById('btn-heart');
    if (heart && !heart.__bound) {
        heart.__bound = true;
        heart.onclick = async function () {
            const subj = ProfileState.subject;
            const me = ProfileState.me;
            if (!subj || !me || !me.uid) return;
            try {
                if (ProfileState.likes.isLiked) {
                    await db.ref('users/' + subj.uid + '/likes/' + me.uid).remove();
                    ProfileState.likes.isLiked = false;
                    _toast('💔 ألغي الإعجاب');
                } else {
                    await db.ref('users/' + subj.uid + '/likes/' + me.uid).set({
                        time: Date.now(),
                        name: me.name || 'زائر',
                        avatar: me.avatar || ''
                    });
                    ProfileState.likes.isLiked = true;
                    _toast('❤️ تم الإعجاب');
                    db.ref('user_notifications/' + subj.uid).push({
                        fromUid: me.uid,
                        fromName: me.name || 'زائر',
                        fromAvatar: me.avatar || '',
                        type: 'like',
                        preview: 'أعجب بك',
                        time: Date.now(),
                        read: false
                    }).catch(function () {});
                }
                updateVisitorButtons();
            } catch (e) { _toast('⚠️ فشل'); }
        };
    }

    const mail = document.getElementById('btn-mail');
    if (mail && !mail.__bound) {
        mail.__bound = true;
        mail.onclick = function () {
            const subj = ProfileState.subject;
            if (!subj || !subj.uid) return;
            try {
                if (window.parent && window.parent !== window) {
                    if (typeof window.parent.openPrivateChatWith === 'function') {
                        window.parent.openPrivateChatWith(subj.uid, subj.name || '', subj.avatar || '');
                    } else {
                        window.parent.postMessage({
                            action: 'openPrivateChat',
                            uid: subj.uid,
                            name: subj.name || '',
                            avatar: subj.avatar || ''
                        }, '*');
                    }
                    setTimeout(function () {
                        try {
                            if (typeof window.parent.closeProfileFrame === 'function') {
                                window.parent.closeProfileFrame();
                            }
                        } catch (e) {}
                    }, 200);
                }
            } catch (e) { console.warn('mail click failed:', e); }
        };
    }

    const friend = document.getElementById('btn-friend');
    if (friend && !friend.__bound) {
        friend.__bound = true;
        friend.onclick = async function () {
            const subj = ProfileState.subject;
            const me = ProfileState.me;
            if (!subj || !me || !me.uid) return;
            const st = ProfileState.friends.state;

            if (st === 'accepted') {
                if (!confirm('إزالة الصداقة؟')) return;
                try {
                    await Promise.all([
                        db.ref('users/' + subj.uid + '/friends/' + me.uid).remove(),
                        db.ref('users/' + me.uid + '/friends/' + subj.uid).remove()
                    ]);
                    ProfileState.friends.state = 'off';
                    updateVisitorButtons();
                    _toast('✅ تمت الإزالة');
                } catch (e) { _toast('⚠️ فشل'); }
                return;
            }

            if (st === 'pending') {
                if (!confirm('إلغاء الطلب؟')) return;
                try {
                    await db.ref('users/' + me.uid + '/friend_requests/' + subj.uid).remove();
                    ProfileState.friends.state = 'off';
                    updateVisitorButtons();
                } catch (e) { _toast('⚠️ فشل'); }
                return;
            }

            if (st === 'incoming') {
                try {
                    await Promise.all([
                        db.ref('users/' + subj.uid + '/friends/' + me.uid).set({
                            status: 'accepted', time: Date.now(),
                            name: me.name, avatar: me.avatar || ''
                        }),
                        db.ref('users/' + me.uid + '/friends/' + subj.uid).set({
                            status: 'accepted', time: Date.now(),
                            name: subj.name, avatar: subj.avatar || ''
                        }),
                        db.ref('users/' + subj.uid + '/friend_requests/' + me.uid).remove()
                    ]);
                    ProfileState.friends.state = 'accepted';
                    updateVisitorButtons();
                    _toast('✅ تمت الصداقة');
                } catch (e) { _toast('⚠️ فشل'); }
                return;
            }

            try {
                await db.ref('users/' + me.uid + '/friend_requests/' + subj.uid).set({
                    time: Date.now(),
                    name: me.name,
                    avatar: me.avatar || ''
                });
                await db.ref('user_notifications/' + subj.uid).push({
                    fromUid: me.uid,
                    fromName: me.name || 'زائر',
                    fromAvatar: me.avatar || '',
                    type: 'friend_request',
                    preview: 'طلب صداقة',
                    time: Date.now(),
                    read: false
                });
                ProfileState.friends.state = 'pending';
                updateVisitorButtons();
                _toast('➕ أُرسل الطلب');
            } catch (e) { _toast('⚠️ فشل'); }
        };
    }

    const block = document.getElementById('btn-block');
    if (block && !block.__bound) {
        block.__bound = true;
        block.onclick = async function () {
            const subj = ProfileState.subject;
            const me = ProfileState.me;
            if (!subj || !me || !me.uid) return;
            if (ProfileState.blocked.isBlocked) {
                if (!confirm('إلغاء الحظر؟')) return;
                try {
                    await db.ref('users/' + me.uid + '/blocked/' + subj.uid).remove();
                    ProfileState.blocked.isBlocked = false;
                    updateVisitorButtons();
                    _toast('✅ تم');
                } catch (e) { _toast('⚠️ فشل'); }
            } else {
                if (!confirm('حظر ' + (subj.name || '') + '؟')) return;
                try {
                    await db.ref('users/' + me.uid + '/blocked/' + subj.uid).set({
                        time: Date.now(),
                        name: subj.name,
                        avatar: subj.avatar || ''
                    });
                    ProfileState.blocked.isBlocked = true;
                    updateVisitorButtons();
                    _toast('🚫 تم الحظر');
                } catch (e) { _toast('⚠️ فشل'); }
            }
        };
    }

    const adm = document.getElementById('btn-admin-actions');
    if (adm && !adm.__bound) {
        adm.__bound = true;
        adm.onclick = function () { switchTab('admin'); };
    }
}

/* ═══ Home Stats ═══ */
async function renderHomeStats() {
    const subj = ProfileState.subject;
    if (!subj || !subj.uid) return;
    if (typeof db === 'undefined' || !db) return;
    try {
        const s = await db.ref('users/' + subj.uid + '/likes').once('value');
        const likes = s.val() || {};
        const el = document.getElementById('stat-likes');
        if (el) el.textContent = Object.keys(likes).length;
    } catch (e) {}
    try {
        const s = await db.ref('users/' + subj.uid + '/friends').once('value');
        const f = s.val() || {};
        const el = document.getElementById('stat-friends');
        if (el) el.textContent = Object.keys(f).length;
    } catch (e) {}
    try {
        const s = await db.ref('bot_data/quiz/scores/' + subj.uid).once('value');
        const pts = s.val() || 0;
        const el = document.getElementById('stat-achievements');
        if (el) el.textContent = Math.floor(pts / 100);
    } catch (e) {}
    const el4 = document.getElementById('stat-gifts');
    if (el4) el4.textContent = '0';
    if (_isOwner()) {
        renderVisitors();
        renderLikers();
    }
}

async function renderVisitors() {
    const subj = ProfileState.subject;
    if (!subj || !subj.uid) return;
    const section = document.getElementById('visitors-section');
    const container = document.getElementById('visitors-container');
    if (!container) return;
    if (section && _isOwner()) section.style.display = '';
    try {
        const s = await db.ref('users/' + subj.uid + '/visitors').limitToLast(20).once('value');
        const data = s.val() || {};
        const list = Object.keys(data).map(function (uid) {
            const v = data[uid];
            v.uid = uid;
            return v;
        }).sort(function (a, b) { return (b.time || 0) - (a.time || 0); });
        container.innerHTML = '';
        if (!list.length) {
            container.innerHTML = '<div style="color:#666;font-size:11px;padding:8px;">لا يوجد زوار بعد</div>';
            return;
        }
        list.slice(0, 12).forEach(function (v) {
            const chip = document.createElement('div');
            chip.className = 'visitor-chip';
            const initial = (v.name || 'U').substring(0, 1);
            const avatarUrl = v.avatar || '';
            chip.innerHTML =
                '<div class="visitor-avatar">' +
                    (avatarUrl ? '<img src="' + _esc(avatarUrl) + '" onerror="this.style.display=\'none\'">' : '') +
                    '<span>' + _esc(initial) + '</span>' +
                '</div>' +
                '<span class="visitor-name">👁️ ' + _esc(v.name || 'زائر') + '</span>';
            chip.onclick = function () { _openUserProfile(v.uid, v.name); };
            container.appendChild(chip);
        });
    } catch (e) {}
}

async function renderLikers() {
    const subj = ProfileState.subject;
    if (!subj || !subj.uid) return;
    const container = document.getElementById('visitors-container');
    if (!container) return;
    if (!_isOwner()) return;
    try {
        const s = await db.ref('users/' + subj.uid + '/likes').limitToLast(20).once('value');
        const data = s.val() || {};
        const list = Object.keys(data).map(function (uid) {
            const v = data[uid];
            v.uid = uid;
            return v;
        }).sort(function (a, b) { return (b.time || 0) - (a.time || 0); });
        if (!list.length) return;
        list.slice(0, 10).forEach(function (v) {
            const chip = document.createElement('div');
            chip.className = 'visitor-chip';
            chip.style.borderColor = 'rgba(255, 68, 120, 0.5)';
            const initial = (v.name || 'U').substring(0, 1);
            const avatarUrl = v.avatar || '';
            chip.innerHTML =
                '<div class="visitor-avatar" style="background:linear-gradient(135deg,#ff69b4,#ff1493);color:#fff;">' +
                    (avatarUrl ? '<img src="' + _esc(avatarUrl) + '" onerror="this.style.display=\'none\'">' : '') +
                    '<span>' + _esc(initial) + '</span>' +
                '</div>' +
                '<span class="visitor-name">❤️ ' + _esc(v.name || 'معجب') + '</span>';
            chip.onclick = function () { _openUserProfile(v.uid, v.name); };
            container.appendChild(chip);
        });
    } catch (e) {}
}

window.renderVisitors = renderVisitors;
window.renderLikers = renderLikers;

async function renderMomentsTab() {
    const grid = document.getElementById('moments-grid');
    if (!grid) return;
    const subj = ProfileState.subject;
    if (!subj || !subj.uid) return;
    const addBtn = document.getElementById('add-moment-btn');
    grid.innerHTML = '';
    if (_isOwner() && addBtn) grid.appendChild(addBtn);
    try {
        const s = await db.ref('stories/' + subj.uid).once('value');
        const data = s.val() || {};
        const now = Date.now();
        const stories = Object.keys(data).map(function (k) { var x = data[k]; x._id = k; return x; })
            .filter(function (st) { return (st.expiresAt || 0) > now; })
            .sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
        if (!stories.length) {
            const e = document.createElement('div');
            e.style.cssText = 'grid-column:1/-1;text-align:center;color:#888;padding:20px;font-size:12px;';
            e.textContent = 'لا توجد لحظات';
            grid.appendChild(e);
            return;
        }
        stories.forEach(function (st) {
            const tile = document.createElement('div');
            tile.className = 'moment-tile';
            var icon = '📝';
            if (st.type === 'image') icon = '🖼️';
            else if (st.type === 'video') icon = '🎥';
            const preview = st.text ? st.text.substring(0, 20) : (st.type === 'image' ? 'صورة' : (st.type === 'video' ? 'فيديو' : 'نص'));
            tile.innerHTML =
                '<div class="moment-tile-icon">' + icon + '</div>' +
                '<div class="moment-tile-name">' + _esc(preview) + '</div>';
            tile.onclick = function () {
                if (typeof openStoryViewer === 'function') {
                    openStoryViewer([st], subj.uid, false);
                } else {
                    try {
                        window.parent.postMessage({ action: 'openStory', uid: subj.uid }, '*');
                    } catch (e) {}
                }
            };
            grid.appendChild(tile);
        });
    } catch (e) {}
}

async function renderFriendsTab() {
    const grid = document.getElementById('friends-grid-container');
    if (!grid) return;
    const subj = ProfileState.subject;
    if (!subj || !subj.uid) return;

    if (!_canView('friends')) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#888;padding:20px;font-size:12px;">🔒 قائمة الأصدقاء خاصة</div>';
        return;
    }

    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#888;padding:20px;font-size:12px;">⏳ جاري التحميل...</div>';

    try {
        const s = await db.ref('users/' + subj.uid + '/friends').once('value');
        const f = s.val() || {};
        const list = [];
        Object.keys(f).forEach(function (uid) {
            const fr = f[uid] || {};
            if (fr.status && fr.status !== 'accepted') return;
            list.push({ uid: uid, name: fr.name || 'مجهول', avatar: fr.avatar || '' });
        });
        if (!list.length) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#888;padding:20px;font-size:12px;">لا يوجد أصدقاء</div>';
            return;
        }
        grid.innerHTML = '';
        list.forEach(function (fr) {
            const card = document.createElement('div');
            card.className = 'friend-card';
            const initial = (fr.name || 'U').substring(0, 1);
            const avatarUrl = fr.avatar || '';
            const avatarHTML = avatarUrl
                ? '<img src="' + _esc(avatarUrl) + '" onerror="this.parentNode.innerHTML=\'<span class=\\\'friend-initial\\\'>' + _esc(initial) + '</span>\'">'
                : '<span class="friend-initial">' + _esc(initial) + '</span>';
            card.innerHTML =
                '<div class="friend-avatar">' + avatarHTML + '</div>' +
                '<div class="friend-name">' + _esc(fr.name) + '</div>';
            card.onclick = function () { _openUserProfile(fr.uid, fr.name); };
            grid.appendChild(card);
        });
    } catch (e) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#ff6666;padding:20px;font-size:12px;">⚠️ فشل</div>';
    }
}

function renderAdminTab() {
    const container = document.getElementById('admin-actions-container');
    if (!container) return;
    if (!ProfileState.isAdminVisitor) {
        container.innerHTML = '<div class="empty" style="text-align:center;padding:30px;color:#666;">لا صلاحيات</div>';
        return;
    }
    const me = ProfileState.me;
    const subj = ProfileState.subject;
    if (!me || !subj) return;
    if (me.uid === subj.uid) {
        container.innerHTML = '<div class="empty" style="text-align:center;padding:30px;color:#666;">لا يمكن تنفيذ أوامر على نفسك</div>';
        return;
    }
    const meLvl = me.rankLevel || _getRankLevel(me.rank);
    const tgLvl = subj.rankLevel || _getRankLevel(subj.rank);
    const canWarn = meLvl >= 65;
    const canJail = meLvl >= 75 && meLvl > tgLvl;
    const canKick = meLvl >= 80 && meLvl > tgLvl;
    const canBan = meLvl >= 90 && meLvl > tgLvl;
    const canPoints = meLvl >= 75;

    let h = '';
    h += '<div class="action-category">';
    h += '<div class="action-category-title">💬 التواصل</div>';
    h += '<button class="action-btn" data-action="message"><i class="fas fa-comment"></i> إرسال رسالة</button>';
    h += '</div>';
    if (canPoints) {
        h += '<div class="action-category">';
        h += '<div class="action-category-title">🎖️ المكافآت</div>';
        h += '<button class="action-btn" data-action="points"><i class="fas fa-star"></i> إهداء نقاط</button>';
        h += '</div>';
    }
    if (canWarn || canJail || canKick) {
        h += '<div class="action-category">';
        h += '<div class="action-category-title">🛡️ العقوبات</div>';
        if (canWarn) h += '<button class="action-btn warning" data-action="warn"><i class="fas fa-exclamation-triangle"></i> تحذير</button>';
        if (canKick) h += '<button class="action-btn warning" data-action="kick"><i class="fas fa-door-closed"></i> طرد</button>';
        if (canJail) h += '<button class="action-btn danger" data-action="jail"><i class="fas fa-lock"></i> سجن</button>';
        h += '</div>';
    }
    if (canBan) {
        h += '<div class="action-category">';
        h += '<div class="action-category-title">⛔ الحظر</div>';
        h += '<button class="action-btn danger" data-action="ban"><i class="fas fa-ban"></i> حظر</button>';
        h += '</div>';
    }
    container.innerHTML = h;
    container.querySelectorAll('[data-action]').forEach(function (btn) {
        btn.onclick = function () {
            _executeAdminAction(btn.getAttribute('data-action'));
        };
    });
}

function _executeAdminAction(action) {
    const subj = ProfileState.subject;
    if (!subj) return;
    if (action === 'message') {
        try {
            if (window.parent && typeof window.parent.openPrivateChatWith === 'function') {
                window.parent.openPrivateChatWith(subj.uid, subj.name, subj.avatar || '');
                setTimeout(function () {
                    if (typeof window.parent.closeProfileFrame === 'function') {
                        window.parent.closeProfileFrame();
                    }
                }, 200);
            }
        } catch (e) {}
        return;
    }
    if (action === 'points') {
        openAppModal({
            title: '⭐ إهداء نقاط',
            html: '<input type="number" id="cmd-pts" min="1" max="10000" value="100" style="width:100%;padding:12px;background:rgba(255,255,255,0.08);border:1px solid #ffd700;border-radius:10px;color:#fff;font-family:inherit;text-align:center;box-sizing:border-box;">',
            onSave: async function () {
                const amt = parseInt((document.getElementById('cmd-pts') || {}).value);
                if (!amt || amt < 1) return;
                try {
                    await db.ref('bot_data/quiz/scores/' + subj.uid).transaction(function (c) { return (c || 0) + amt; });
                    _toast('⭐ تم');
                } catch (e) { _toast('⚠️ فشل'); }
            }
        });
        return;
    }
    if (action === 'warn') {
        openAppModal({
            title: '⚠️ تحذير',
            text: 'تحذير ' + subj.name + '؟',
            onSave: async function () {
                try {
                    await db.ref('users/' + subj.uid + '/warnings').transaction(function (c) { return (c || 0) + 1; });
                    _toast('✅ تم');
                } catch (e) { _toast('⚠️ فشل'); }
            }
        });
        return;
    }
    if (action === 'kick') {
        openAppModal({
            title: '🚪 طرد',
            text: 'طرد ' + subj.name + ' من الغرفة الحالية؟',
            onSave: async function () {
                const roomId = (typeof ChatState !== 'undefined' && ChatState.currentRoom) || 'general';
                try {
                    await db.ref('room_kicks/' + roomId + '/' + subj.uid).set({
                        by: ProfileState.me.uid, byName: ProfileState.me.name, at: Date.now()
                    });
                    _toast('🚪 تم');
                } catch (e) { _toast('⚠️ فشل'); }
            }
        });
        return;
    }
    if (action === 'jail') {
        openAppModal({
            title: '⛓️ سجن',
            html: '<label style="display:block;color:#ffd700;font-size:12px;font-weight:900;margin-bottom:6px;">المدة (دقائق):</label><input type="number" id="cmd-jm" min="1" max="120" value="5" style="width:100%;padding:12px;background:rgba(255,255,255,0.08);border:1px solid #ffd700;border-radius:10px;color:#fff;font-family:inherit;text-align:center;box-sizing:border-box;">',
            onSave: async function () {
                const m = parseInt((document.getElementById('cmd-jm') || {}).value);
                if (!m || m < 1) return;
                try {
                    await db.ref('users/' + subj.uid).update({
                        isJailed: true,
                        jailUntil: Date.now() + m * 60000,
                        jailReason: 'إجراء إداري'
                    });
                    _toast('⛓️ تم');
                } catch (e) { _toast('⚠️ فشل'); }
            }
        });
        return;
    }
    if (action === 'ban') {
        openAppModal({
            title: '🚫 حظر',
            html:
                '<label style="display:block;color:#ffd700;font-size:12px;font-weight:900;margin-bottom:6px;">المدة:</label>' +
                '<select id="cmd-bd" style="width:100%;padding:12px;background:rgba(255,255,255,0.08);border:1px solid #ffd700;border-radius:10px;color:#fff;font-family:inherit;box-sizing:border-box;">' +
                    '<option value="60">ساعة</option>' +
                    '<option value="360">6 ساعات</option>' +
                    '<option value="1440" selected>يوم</option>' +
                    '<option value="10080">أسبوع</option>' +
                '</select>',
            onSave: async function () {
                const d = parseInt((document.getElementById('cmd-bd') || {}).value);
                try {
                    await db.ref('users/' + subj.uid).update({
                        isBanned: true,
                        bannedUntil: Date.now() + d * 60000,
                        banReason: 'إجراء إداري'
                    });
                    _toast('🚫 تم');
                } catch (e) { _toast('⚠️ فشل'); }
            }
        });
    }
}

/* ═══ Helpers: pickImageFile ═══ */
function pickImageFile(inputId, onFile, opts) {
    opts = opts || {};
    const inp = document.getElementById(inputId);
    if (!inp) return;
    inp.value = '';
    inp.onchange = async function () {
        const file = this.files[0];
        if (!file) return;
        const maxMb = opts.maxMb || 5;
        if (file.size / (1024 * 1024) > maxMb) {
            _toast('⚠️ الحد ' + maxMb + 'MB');
            return;
        }
        onFile(file);
    };
    inp.click();
}

/* ═══ Exports ═══ */
window.ProfileState = ProfileState;
window.applyIdentityToDOM = applyIdentityToDOM;
window.updateIdentityField = updateIdentityField;
window.checkVisitorStatus = checkVisitorStatus;
window.updateVisitorButtons = updateVisitorButtons;
window.renderInfoGrid = renderInfoGrid;
window.renderVisitors = renderVisitors;
window.renderLikers = renderLikers;
window._openUserProfile = _openUserProfile;

console.log('✅ profile-core.js v12 loaded — no-video + catbox upload');
