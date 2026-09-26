// ==============================================
// chat.js v3.16 — Cinema Styles in Chat
// ==============================================
// ✅ v3.16:
//   _applyNameEffectsToUsername: يستدعي applyCinemaStyle + apply
//   sendMessage: يُرسل cinemaTextStyle/cinemaBgStyle
// ==============================================

const ChatState = {
    currentRoom: localStorage.getItem('qamar_last_room') || 'general',
    messagesListener: null, privateMessagesListener: null,
    notificationsListener: null, privateChatsListener: null, presenceListener: null,
    currentPrivateChat: null, minimizedChat: null, replyingTo: null,
    unreadCount: 0, unreadPrivate: 0, privateChatsCache: {},
    lastMessageTime: 0, lastPrivateMessageTime: 0,
    seenMessages: new Set(), seenPrivateMessages: new Set(),
    invisibleMode: false, isInitialized: false,
    _lastSentText: null, _lastSentAt: 0, blockedUsers: {},
    listeners: {},
    presenceInterval: null,
    _lastCodeLookup: 0,
    _punishmentCheckInterval: null,
    _friendRequestsCache: {}
};

function safeColor(c) {
    if (!c || typeof c !== 'string') return null;
    const s = c.trim();
    return /^#[0-9a-fA-F]{3,8}$|^rgb\([\d\s,.%]+\)$|^rgba\([\d\s,.%]+\)$|^hsl\([\d\s,.%]+\)$|^hsla\([\d\s,.%]+\)$/.test(s) ? s : null;
}
function safeGradient(g) {
    if (!Array.isArray(g) || g.length < 2) return null;
    const a = safeColor(g[0]);
    const b = safeColor(g[1]);
    return (a && b) ? [a, b] : null;
}

var _audioCtx = null;
function getAudioCtx() {
    if (!_audioCtx) {
        try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (_audioCtx && _audioCtx.state === 'suspended') {
        _audioCtx.resume().catch(function () {});
    }
    return _audioCtx;
}
function _unlockAudio() {
    getAudioCtx();
    document.removeEventListener('touchstart', _unlockAudio);
    document.removeEventListener('click', _unlockAudio);
    document.removeEventListener('keydown', _unlockAudio);
}
document.addEventListener('touchstart', _unlockAudio, { passive: true });
document.addEventListener('click', _unlockAudio);
document.addEventListener('keydown', _unlockAudio);

function playBirdSound() {
    try {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const now = ctx.currentTime;
        [0, 0.15, 0.3].forEach((d, i) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = 'sine';
            const b = 2000 + (i * 300);
            o.frequency.setValueAtTime(b, now + d);
            o.frequency.linearRampToValueAtTime(b + 800, now + d + 0.05);
            o.frequency.linearRampToValueAtTime(b - 300, now + d + 0.1);
            g.gain.setValueAtTime(0, now + d);
            g.gain.linearRampToValueAtTime(0.3, now + d + 0.02);
            g.gain.exponentialRampToValueAtTime(0.01, now + d + 0.13);
            o.connect(g); g.connect(ctx.destination);
            o.start(now + d); o.stop(now + d + 0.15);
        });
    } catch (e) {}
}
function playPrivateMsgSound() {
    try {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const now = ctx.currentTime;
        [0, 0.12].forEach((d, i) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(800 + (i * 200), now + d);
            o.frequency.linearRampToValueAtTime(1200 + (i * 200), now + d + 0.08);
            g.gain.setValueAtTime(0, now + d);
            g.gain.linearRampToValueAtTime(0.25, now + d + 0.02);
            g.gain.exponentialRampToValueAtTime(0.01, now + d + 0.1);
            o.connect(g); g.connect(ctx.destination);
            o.start(now + d); o.stop(now + d + 0.12);
        });
    } catch (e) {}
}

function cleanupAllListeners() {
    try {
        Object.values(ChatState.listeners).forEach(ref => {
            if (ref && typeof ref.off === 'function') {
                try { ref.off(); } catch (e) {}
            }
        });
        ChatState.listeners = {};
        if (ChatState.messagesListener) { try { ChatState.messagesListener.off(); } catch(e){} ChatState.messagesListener = null; }
        if (ChatState.privateMessagesListener) { try { ChatState.privateMessagesListener.off(); } catch(e){} ChatState.privateMessagesListener = null; }
        if (ChatState.notificationsListener) { try { ChatState.notificationsListener.off(); } catch(e){} ChatState.notificationsListener = null; }
        if (ChatState.privateChatsListener) { try { ChatState.privateChatsListener.off(); } catch(e){} ChatState.privateChatsListener = null; }
        if (ChatState.presenceListener) { try { ChatState.presenceListener.off(); } catch(e){} ChatState.presenceListener = null; }
        if (ChatState.presenceInterval) {
            clearInterval(ChatState.presenceInterval);
            ChatState.presenceInterval = null;
        }
        if (ChatState._punishmentCheckInterval) {
            clearInterval(ChatState._punishmentCheckInterval);
            ChatState._punishmentCheckInterval = null;
        }
        if (typeof RoomAlerts !== 'undefined' && RoomAlerts.close) {
            try { RoomAlerts.close(); } catch(e) {}
        }
    } catch (e) {
        console.warn('cleanupAllListeners error:', e);
    }
}

function applyRoomBackground(roomId) {
    var container = document.getElementById('messages');
    if (!container) return;
    container.style.removeProperty('background');
    container.style.removeProperty('background-image');
    container.style.removeProperty('background-color');
    container.style.removeProperty('background-size');
    container.style.removeProperty('background-position');
    container.style.removeProperty('background-repeat');
    if (!roomId) return;
    if (typeof db === 'undefined' || !db) return;

    db.ref('room_settings/' + roomId).once('value').then(function (s) {
        var c = s.val() || {};
        var bgType = c.bgType;
        var bgValue = c.bgValue;
        var bgImage = c.bgImage;

        if (bgType === 'custom' && bgImage) {
            container.style.setProperty('background-image', 'url("' + bgImage + '")', 'important');
            container.style.setProperty('background-size', 'cover', 'important');
            container.style.setProperty('background-position', 'center', 'important');
            container.style.setProperty('background-repeat', 'no-repeat', 'important');
            return;
        }
        if (bgType === 'image' && bgValue) {
            if (/^https?:\/\//i.test(bgValue)) {
                container.style.setProperty('background-image', 'url("' + bgValue + '")', 'important');
                container.style.setProperty('background-size', 'cover', 'important');
                container.style.setProperty('background-position', 'center', 'important');
                container.style.setProperty('background-repeat', 'no-repeat', 'important');
            }
            return;
        }
        if (bgType === 'color' && bgValue) {
            var col = safeColor(bgValue);
            if (col) container.style.setProperty('background', col, 'important');
            return;
        }
        if (bgType === 'gradient' && bgValue) {
            if (/linear-gradient|radial-gradient/i.test(bgValue) && !/[<>]/.test(bgValue)) {
                container.style.setProperty('background', bgValue, 'important');
            }
            return;
        }
        if (!bgType && bgImage) {
            container.style.setProperty('background-image', 'url("' + bgImage + '")', 'important');
            container.style.setProperty('background-size', 'cover', 'important');
            container.style.setProperty('background-position', 'center', 'important');
        }
        applyRoomFont(c);
    }).catch(function (e) { console.warn('applyRoomBackground error:', e); });
}

function applyRoomFont(settings) {
    var container = document.getElementById('messages');
    if (!container) return;
    var fontColor = settings && settings.fontColor;
    var fontSize = settings && settings.fontSize;
    if (fontColor && safeColor(fontColor)) {
        container.style.setProperty('--chat-font-color', fontColor);
    } else {
        container.style.removeProperty('--chat-font-color');
    }
    if (fontSize && parseInt(fontSize) >= 12 && parseInt(fontSize) <= 28) {
        container.style.setProperty('--chat-font-size', parseInt(fontSize) + 'px');
    } else {
        container.style.removeProperty('--chat-font-size');
    }
    container.querySelectorAll('.message-text').forEach(function(el) {
        el.style.color = fontColor || '';
    });
}

function applyRoomImage(roomId, settings) {
    var el = document.querySelector('.sidebar-item[data-room-id="' + roomId + '"]');
    if (!el) return;
    var spans = el.querySelectorAll('span');
    if (spans.length < 2) return;
    var iconSpan = spans[0];
    var nameSpan = spans[1];

    if (settings.iconImage) {
        if (!iconSpan.querySelector('img')) {
            iconSpan.innerHTML = '';
            var img = document.createElement('img');
            img.src = settings.iconImage;
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
            iconSpan.appendChild(img);
        } else {
            iconSpan.querySelector('img').src = settings.iconImage;
        }
    } else {
        iconSpan.textContent = settings.icon || '🚪';
    }
    if (settings.name) nameSpan.textContent = settings.name;
    if (settings.nameColor && safeColor(settings.nameColor)) {
        nameSpan.style.color = settings.nameColor;
    } else {
        nameSpan.style.color = '';
    }
    if (typeof QAMAR !== 'undefined' && QAMAR.ROOMS && QAMAR.ROOMS[roomId]) {
        if (settings.name) QAMAR.ROOMS[roomId].name = settings.name;
        if (settings.icon) QAMAR.ROOMS[roomId].icon = settings.icon;
        if (settings.iconImage) QAMAR.ROOMS[roomId].iconImage = settings.iconImage;
        else delete QAMAR.ROOMS[roomId].iconImage;
        if (settings.bgImage) QAMAR.ROOMS[roomId].bgImage = settings.bgImage;
        if (settings.bgType) QAMAR.ROOMS[roomId].bgType = settings.bgType;
        if (settings.bgValue) QAMAR.ROOMS[roomId].bgValue = settings.bgValue;
        if (settings.nameColor) QAMAR.ROOMS[roomId].nameColor = settings.nameColor;
        if (settings.fontColor) QAMAR.ROOMS[roomId].fontColor = settings.fontColor;
        if (settings.fontSize) QAMAR.ROOMS[roomId].fontSize = settings.fontSize;
    }
}

function watchRoomSettings() {
    if (typeof db === 'undefined' || !db) { setTimeout(watchRoomSettings, 1500); return; }
    db.ref('room_settings').on('value', function (s) {
        var settings = s.val() || {};
        Object.keys(settings).forEach(function (rid) {
            applyRoomImage(rid, settings[rid]);
        });
        if (typeof ChatState !== 'undefined' && ChatState.currentRoom) {
            applyRoomBackground(ChatState.currentRoom);
            var currentSettings = settings[ChatState.currentRoom] || {};
            applyRoomFont(currentSettings);
        }
    });
}

async function applyRoomSettings() {
    if (typeof db === 'undefined' || !db) return;
    try {
        const snap = await db.ref('room_settings').once('value');
        const settings = snap.val() || {};
        Object.keys(settings).forEach(roomId => {
            if (QAMAR.ROOMS[roomId]) {
                if (settings[roomId].name) QAMAR.ROOMS[roomId].name = settings[roomId].name;
                if (settings[roomId].icon) QAMAR.ROOMS[roomId].icon = settings[roomId].icon;
                QAMAR.ROOMS[roomId].bgType = settings[roomId].bgType || null;
                QAMAR.ROOMS[roomId].bgValue = settings[roomId].bgValue || null;
                QAMAR.ROOMS[roomId].bgImage = settings[roomId].bgImage || null;
                QAMAR.ROOMS[roomId].iconImage = settings[roomId].iconImage || null;
                QAMAR.ROOMS[roomId].nameColor = settings[roomId].nameColor || null;
                QAMAR.ROOMS[roomId].fontColor = settings[roomId].fontColor || null;
                QAMAR.ROOMS[roomId].fontSize = settings[roomId].fontSize || null;
            }
        });
    } catch (e) { console.warn('applyRoomSettings error:', e.message); }
}

function checkActiveInputs() {
    var a = document.activeElement;
    var m = document.getElementById('message-input');
    var p = document.getElementById('pc-input');
    if (a !== m && a !== p) document.body.classList.remove('keyboard-open');
}

function setupKeyboardHandlers() {
    var input = document.getElementById('message-input');
    var pcInput = document.getElementById('pc-input');
    function onFocus() { document.body.classList.add('keyboard-open'); }
    function onBlur() { setTimeout(checkActiveInputs, 100); }
    if (input && !input.__kbfix) { input.__kbfix = true; input.addEventListener('focus', onFocus); input.addEventListener('blur', onBlur); }
    if (pcInput && !pcInput.__kbfix) { pcInput.__kbfix = true; pcInput.addEventListener('focus', onFocus); pcInput.addEventListener('blur', onBlur); }
    if (window.visualViewport && !window.__vvListener) {
        window.__vvListener = true;
        var initialHeight = window.visualViewport.height;
        window.visualViewport.addEventListener('resize', function () {
            var k = initialHeight - window.visualViewport.height;
            if (k > 150) document.body.classList.add('keyboard-open');
            else document.body.classList.remove('keyboard-open');
        });
        window.addEventListener('orientationchange', function () {
            setTimeout(function () { initialHeight = window.visualViewport.height; }, 300);
        });
    }
}

function ensureMicsRendered() {
    var attempts = 0;
    var t = setInterval(function () {
        attempts++;
        var c = document.querySelector('#mics-bar .mics');
        if (c && c.children.length > 0) { clearInterval(t); return; }
        var u = getCurrentUser();
        if (u && u.rank && typeof updateMicsUI === 'function') { try { updateMicsUI(); } catch (e) {} }
        if (attempts >= 20) clearInterval(t);
    }, 500);
}

function applySidebarStyle(style) {
    document.body.classList.toggle('sidebar-glass', style === 'glass');
    document.body.classList.toggle('sidebar-classic', style === 'classic');
    try { localStorage.setItem(QAMAR.STORAGE_KEYS.SIDEBAR_STYLE, style); } catch (e) {}
}

function startPunishmentWatcher() {
    const user = getCurrentUser();
    if (!user || !user.uid) return;

    const check = async () => {
        try {
            const snap = await db.ref('users/' + user.uid).once('value');
            const d = snap.val();
            if (!d) return;
            const now = Date.now();

            if (d.isBanned === true && d.bannedUntil && now >= d.bannedUntil) {
                await db.ref('users/' + user.uid).update({ isBanned: false, bannedUntil: 0, permanentBan: false });
                return;
            }
            if (d.isJailed === true && d.jailUntil && now >= d.jailUntil) {
                await db.ref('users/' + user.uid).update({ isJailed: false, jailUntil: 0, jailReleasedAt: now });
                return;
            }
            if (d.isBanned === true && d.bannedUntil && now < d.bannedUntil) {
                const remaining = Math.ceil((d.bannedUntil - now) / 60000);
                cleanupAllListeners();
                if (typeof showToast === 'function') showToast('fa-ban', '🚪 أنت محظور — ' + remaining + ' دقيقة');
                try { if (typeof window.showRoomPicker === 'function') window.showRoomPicker(); } catch(e) {}
            }
            try {
                var kickSnap = await db.ref('room_kicks/' + ChatState.currentRoom + '/' + user.uid).once('value');
                if (kickSnap.exists()) {
                    cleanupAllListeners();
                    if (typeof showToast === 'function') {
                        var rn = (QAMAR.ROOMS[ChatState.currentRoom] && QAMAR.ROOMS[ChatState.currentRoom].name) || ChatState.currentRoom;
                        showToast('fa-door-closed', '🚪 أنت مطرود من ' + rn);
                    }
                    try { if (typeof window.showRoomPicker === 'function') window.showRoomPicker(); } catch(e) {}
                }
            } catch(e) {}
        } catch (e) { console.warn('punishment check error:', e); }
    };
    check();
    ChatState._punishmentCheckInterval = setInterval(check, 60000);
}

function initChat() {
    if (ChatState.isInitialized) return;
    const user = getCurrentUser();
    if (!user) return;
    ChatState.isInitialized = true;

    const savedStyle = localStorage.getItem(QAMAR.STORAGE_KEYS.SIDEBAR_STYLE) || 'classic';
    applySidebarStyle(savedStyle);

    const ls = document.getElementById('login-screen'); if (ls) ls.style.display = 'none';
    const cc = document.getElementById('chat-container'); if (cc) cc.style.display = 'flex';

    if (typeof generateStars === 'function') generateStars();
    buildBackgroundsList();
    buildRoomsList();

    if (typeof applyRoomSettings === 'function') {
        applyRoomSettings().then(function() { buildRoomsList(); });
    }

    if (!user.isGuest) {
        const ub = document.getElementById('upgrade-nav-btn');
        if (ub) ub.style.display = 'none';
    }

    addSystemMessage('👑 مرحباً ' + user.name + ' — رتبتك: ' + getRankBadge(user.rank) + ' ' + user.rank);

    if (ChatState.currentRoom !== 'general') {
        const room = QAMAR.ROOMS[ChatState.currentRoom];
        if (room) {
            const titleEl = document.getElementById('room-title');
            if (titleEl) titleEl.innerText = room.name + ' ' + room.icon;
        }
    }

    startMessagesListener();
    startNotificationsListener();
    startPrivateChatsListener();
    startPresenceHeartbeat();
    startBlockedListener();
    if (typeof initBots === 'function') { try { initBots(); } catch(e) { console.warn('Bots error:', e); } }
    startInvisibleListener();
    startUserDataListener();
    startPunishmentWatcher();

    watchRoomSettings();
    applyRoomBackground(ChatState.currentRoom);

    var _lastRoom = ChatState.currentRoom;
    setInterval(function () {
        if (ChatState.currentRoom && ChatState.currentRoom !== _lastRoom) {
            _lastRoom = ChatState.currentRoom;
            setTimeout(function () { applyRoomBackground(ChatState.currentRoom); }, 150);
        }
    }, 500);

    setupKeyboardHandlers();
    ensureMicsRendered();

    setTimeout(function() {
        var sb = localStorage.getItem(QAMAR.STORAGE_KEYS.BACKGROUND);
        if (sb && typeof changeBackground === 'function') changeBackground(sb);
    }, 500);

    setTimeout(function() {
        if (typeof generateStars === 'function') generateStars();
    }, 900);

    console.log('✅ Chat initialized | Room:', ChatState.currentRoom);
}

function startBlockedListener() {
    const user = getCurrentUser(); if (!user || !user.uid || !db) return;
    const ref = db.ref('users/' + user.uid + '/blocked');
    ref.on('value', s => {
        ChatState.blockedUsers = s.val() || {};
        Object.keys(ChatState.blockedUsers).forEach(uid => {
            document.querySelectorAll('[data-sender-uid="' + uid + '"]').forEach(el => el.remove());
        });
    });
    ChatState.listeners.blockedRef = ref;
}
function isBlocked(uid) {
    if (!uid) return false;
    const b = ChatState.blockedUsers[uid];
    return b === true || (b && b.time);
}

function buildRoomsList() {
    const list = document.getElementById('rooms-list'); if (!list) return; list.innerHTML = '';
    const user = getCurrentUser(); if (!user) return;
    const visible = QAMAR.getVisibleRooms(user);
    Object.values(visible).forEach(room => {
        const item = document.createElement('div');
        item.className = 'sidebar-item';
        item.setAttribute('data-room-id', room.id);
        const i = document.createElement('span'); i.innerText = room.icon;
        const n = document.createElement('span'); n.innerText = room.name;
        if (room.nameColor && typeof safeColor === 'function') {
            const col = safeColor(room.nameColor);
            if (col) n.style.color = col;
        }
        item.appendChild(i); item.appendChild(n);
        if (room.id === ChatState.currentRoom) item.classList.add('active');
        item.onclick = () => switchRoom(room.id, room.name + ' ' + room.icon);
        list.appendChild(item);
    });
}

function buildBackgroundsList() {
    const list = document.getElementById('bg-options'); if (!list) return; list.innerHTML = '';
    QAMAR.BACKGROUNDS.forEach(bg => {
        const btn = document.createElement('button');
        btn.className = 'btn-outline';
        btn.style.cssText = 'padding:8px 12px;border-radius:8px;cursor:pointer;font-size:12px;';
        btn.innerText = bg.id;
        btn.onclick = () => changeBackground(bg.id);
        list.appendChild(btn);
    });
}

function changeBackground(bgId) {
    const c = document.getElementById('chat-container');
    const bg = QAMAR.BACKGROUNDS.find(b => b.id === bgId);
    if (bg && c) {
        QAMAR.BACKGROUNDS.forEach(b => c.classList.remove(b.class));
        c.classList.add(bg.class);
        localStorage.setItem(QAMAR.STORAGE_KEYS.BACKGROUND, bgId);
    }
}

function switchRoom(roomId, roomTitle) {
    const user = getCurrentUser();
    if (!QAMAR.isRoomVisible(roomId, user)) { showToast('fa-lock', '🔒 غير متاحة'); return; }

    if (user && user.uid && typeof db !== 'undefined' && db) {
        db.ref('room_kicks/' + roomId + '/' + user.uid).once('value').then(function(kickSnap) {
            if (kickSnap.exists()) {
                if (typeof showToast === 'function') showToast('fa-door-closed', '🚪 أنت مطرود من هذه الغرفة');
                return;
            }
            _doSwitchRoom(roomId, roomTitle, user);
        }).catch(function() {
            _doSwitchRoom(roomId, roomTitle, user);
        });
    } else {
        _doSwitchRoom(roomId, roomTitle, user);
    }
}

function _doSwitchRoom(roomId, roomTitle, user) {
    if (ChatState.messagesListener) { ChatState.messagesListener.off(); ChatState.messagesListener = null; }
    ChatState.currentRoom = roomId;
    localStorage.setItem('qamar_last_room', roomId);
    const t = document.getElementById('room-title'); if (t) t.innerText = roomTitle;
    document.querySelectorAll('.sidebar-item[data-room-id]').forEach(el =>
        el.classList.toggle('active', el.getAttribute('data-room-id') === roomId)
    );
    const mc = document.getElementById('messages'); if (mc) mc.innerHTML = '';
    ChatState.seenMessages.clear();
    addSystemMessage('📢 تم فتح ' + roomTitle);
    updateMicsUI();
    startMessagesListener();
    applyRoomBackground(roomId);

    if (user && user.uid && typeof db !== 'undefined' && db) {
        db.ref('user_presence/' + user.uid).set({
            state: 'online', lastChanged: Date.now(), room: roomId
        }).catch(function(){});
    }

    if (typeof RoomAlerts !== 'undefined' && RoomAlerts.onRoomChanged) {
        try { RoomAlerts.onRoomChanged(); } catch(e) {}
    }
    if (typeof onRoomChanged === 'function') {
        try { onRoomChanged(roomId); } catch(e) {}
    }
    closeAllPanels();
}

function startMessagesListener() {
    if (!db) return;
    if (ChatState.messagesListener) ChatState.messagesListener.off();
    const roomId = ChatState.currentRoom;
    const ref = db.ref('room_messages/' + roomId).limitToLast(15);
    ChatState.messagesListener = ref;

    ref.on('child_added', s => {
        const msg = s.val(); if (!msg) return;
        const user = getCurrentUser(); if (!user) return;
        if (msg.senderUid && isBlocked(msg.senderUid)) return;
        const key = roomId + '_' + s.key;
        if (!ChatState.seenMessages.has(key)) {
            ChatState.seenMessages.add(key);
            displayMessage(msg, s.key);
            if (msg.mentions && msg.mentions.includes(user.name)) playBirdSound();
        }
        if (typeof processIncomingMessage === 'function') {
            try { processIncomingMessage(Object.assign({}, msg, { _key: key, _fbKey: s.key })).catch(e => console.warn(e)); } catch(e) {}
        }
    });

    ref.on('child_changed', s => {
        const msg = s.val();
        const el = document.querySelector('[data-msg-id="' + s.key + '"]');
        if (msg && msg.hidden === true) {
            const u = getCurrentUser();
            if (u && (u.rank === 'King' || u.rank === 'Queen')) {
                if (el) el.remove();
                displayMessage(msg, s.key);
            } else {
                if (el) el.remove();
            }
            return;
        }
        if (el && msg) {
            if (msg.deleted) {
                el.classList.add('deleted');
                const t = el.querySelector('.message-text');
                if (t) t.innerText = '🚫 رسالة محذوفة';
            } else if (msg.edited) {
                const t = el.querySelector('.message-text');
                if (t) t.innerText = msg.text;
            }
        }
    });

    ref.on('child_removed', s => {
        const el = document.querySelector('[data-msg-id="' + s.key + '"]');
        if (el) el.remove();
    });
}

function applyFrameToWrapper(wrapper, frameId) {
    if (!wrapper) return;
    wrapper.querySelectorAll('.qf').forEach(el => el.remove());
    if (!frameId || frameId === 'none') return;
    if (typeof applyFrameToMessage === 'function') {
        applyFrameToMessage(wrapper, frameId);
    }
}

function extractCodeFromText(text) {
    if (!text) return null;
    const m = text.match(/([A-Z0-9]{2,5})·([A-Z0-9]{3,4})/);
    return m ? m[0] : null;
}

async function openProfileByCode(code) {
    if (!code) return;
    const now = Date.now();
    if (now - ChatState._lastCodeLookup < 3000) {
        showToast('fa-clock', '⏳ انتظر قليلاً');
        return;
    }
    ChatState._lastCodeLookup = now;
    try {
        const s = await db.ref('user_codes/' + code).once('value');
        const uid = s.val();
        if (uid) {
            const ns = await db.ref('users/' + uid + '/name').once('value');
            const name = ns.val() || 'عضو';
            openUserProfile(uid, name);
        } else {
            showToast('fa-user', '⚠️ كود غير معروف');
        }
    } catch (e) { showToast('fa-exclamation-circle', '⚠️ خطأ'); }
}

function _buildHiddenMessageEl(msg, msgId) {
    const container = document.getElementById('messages');
    if (!container) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'message hidden-message-king';
    wrapper.setAttribute('data-msg-id', msgId);
    wrapper.setAttribute('data-sender', msg.senderName || '');
    wrapper.setAttribute('data-sender-uid', msg.senderUid || '');
    wrapper.style.cssText = 'background:linear-gradient(135deg,rgba(120,0,0,0.35),rgba(0,0,0,0.5));border:2px solid #ff4444;border-radius:12px;padding:12px;margin:8px 0;font-family:Cairo,sans-serif;';

    const header = document.createElement('div');
    header.style.cssText = 'color:#ff6666;font-weight:900;font-size:12px;margin-bottom:8px;display:flex;align-items:center;gap:6px;';
    header.innerHTML = '⚠️ <span>رسالة مخفية</span>';

    const senderLine = document.createElement('div');
    senderLine.style.cssText = 'color:#fff;font-weight:900;font-size:13px;margin-bottom:6px;';
    senderLine.textContent = (msg.senderName || 'مجهول') + ':';

    const textLine = document.createElement('div');
    textLine.style.cssText = 'color:#ffcccc;font-size:13px;line-height:1.5;background:rgba(0,0,0,0.4);padding:8px;border-radius:8px;margin-bottom:8px;word-break:break-word;text-decoration:line-through;text-decoration-color:rgba(255,68,68,0.6);';
    textLine.textContent = msg.text || msg.originalText || '—';

    const infoLine = document.createElement('div');
    infoLine.style.cssText = 'color:#ff9999;font-size:10px;display:flex;gap:12px;flex-wrap:wrap;';
    const hiddenBy = msg.hiddenBy === 'guardian' ? '🚔 السجان' : (msg.hiddenByName || 'مشرف');
    const timeStr = (typeof formatTime === 'function') ? formatTime(msg.hiddenAt || msg.time) : '';
    infoLine.innerHTML = '<span>🗑️ حذفها: ' + hiddenBy + '</span><span>🕐 ' + timeStr + '</span>';

    wrapper.appendChild(header);
    wrapper.appendChild(senderLine);
    wrapper.appendChild(textLine);
    wrapper.appendChild(infoLine);
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
}

/* ⭐ v3.16: يستدعي applyCinemaStyle + apply */
function _applyNameEffectsToUsername(usernameEl, msg) {
    if (!usernameEl) return;

    if (!window.NameEffects) {
        usernameEl.style.color = safeColor(msg.senderColor) || '#ffd700';
        return;
    }

    // 1. طبّق الأنماط السينمائية (إن وُجدت)
    if (typeof window.NameEffects.applyCinemaStyle === 'function') {
        window.NameEffects.applyCinemaStyle(usernameEl, msg.senderCinemaText || '', 'text');
        window.NameEffects.applyCinemaStyle(usernameEl, msg.senderCinemaBg || '', 'bg');
    }

    // 2. طبّق الأنماط التقليدية
    if (typeof window.NameEffects.apply === 'function') {
        window.NameEffects.apply(usernameEl, {
            nameColor: msg.senderNameColor || null,
            nameGradient: msg.senderNameGradient || null,
            nameBgColor: msg.senderNameBgColor || null,
            nameBgGradient: msg.senderNameBgGradient || null,
            color: msg.senderColor
        });
    }
}

function displayMessage(msg, msgId) {
    const container = document.getElementById('messages'); if (!container) return;
    const user = getCurrentUser();

    if (msg.hidden === true) {
        var uLevel = 0;
        if (user) {
            uLevel = user.rankLevel || (typeof getRankLevel === 'function' ? getRankLevel(user.rank) : 0);
        }
        var canSee = user && (user.rank === 'King' || user.rank === 'Queen' || uLevel >= 95);
        if (canSee) _buildHiddenMessageEl(msg, msgId);
        return;
    }

    const isBot = msg.isBot === true;
    const msgEl = document.createElement('div');
    msgEl.className = 'message' + (isBot ? ' bot' : '');
    msgEl.setAttribute('data-msg-id', msgId);
    msgEl.setAttribute('data-sender', msg.senderName || '');
    msgEl.setAttribute('data-sender-uid', msg.senderUid || '');
    if (msg.mentions && msg.mentions.includes(user ? user.name : '')) msgEl.classList.add('highlighted');

    const aw = document.createElement('div'); aw.className = 'message-avatar-wrapper';
    const ai = document.createElement('img'); ai.className = 'message-avatar';
    let url = msg.senderAvatar;
    if (!msg.isBot && msg.senderUid === (user ? user.uid : '') && user && user.avatar) url = user.avatar;
    ai.src = url || getDefaultAvatar(msg.senderName);
    ai.alt = msg.senderName; ai.loading = 'lazy'; ai.decoding = 'async';
    ai.onerror = () => { ai.src = getDefaultAvatar(msg.senderName); };
    ai.onclick = () => { if (msg.isBot) return; if (msg.senderUid) openUserProfile(msg.senderUid, msg.senderName); };
    aw.appendChild(ai);
    if (msg.senderFrame && msg.senderFrame !== 'none') applyFrameToWrapper(aw, msg.senderFrame);

    const content = document.createElement('div'); content.className = 'message-content';
    const header = document.createElement('div'); header.className = 'message-header';

    const username = document.createElement('div'); username.className = 'message-username';
    let dn = msg.senderName || 'مجهول';
    if (isBot) dn += ' 🤖';
    username.textContent = dn;
    username.setAttribute('data-name', msg.senderName || '');
    _applyNameEffectsToUsername(username, msg);

    if (!isBot) username.onclick = () => insertMention(msg.senderName);

    const timeEl = document.createElement('span'); timeEl.className = 'message-time'; timeEl.textContent = formatTime(msg.time);
    const optBtn = document.createElement('button'); optBtn.className = 'message-options-btn'; optBtn.textContent = '⋮';
    optBtn.onclick = (e) => { e.stopPropagation(); showMessageMenu(msgEl, msg.senderName, msg.text, msgId); };
    header.appendChild(username); header.appendChild(timeEl); header.appendChild(optBtn);

    const msgText = document.createElement('div'); msgText.className = 'message-text';
    if (msg.deleted) {
        msgText.innerText = '🚫 رسالة محذوفة';
        msgEl.classList.add('deleted');
    } else if (msg.mentions && msg.mentions.length > 0) {
        msgText.appendChild(buildMentionHTML(msg.text, msg.mentions, insertMention));
    } else {
        const codeInText = extractCodeFromText(msg.text || '');
        if (codeInText && !isBot) {
            const cleanText = (msg.text || '').replace(codeInText, '').trim();
            if (cleanText) {
                const tn = document.createElement('div');
                tn.textContent = cleanText;
                tn.style.marginBottom = '4px';
                msgText.appendChild(tn);
            }
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'profile-visit-btn';
            btn.innerHTML = '👤 زيارة بروفايل';
            btn.onclick = (e) => { e.stopPropagation(); openProfileByCode(codeInText); };
            msgText.appendChild(btn);
        } else {
            msgText.textContent = msg.text || '';
        }
    }
    const _fontColor = msg._roomFontColor || (QAMAR.ROOMS[ChatState.currentRoom] && QAMAR.ROOMS[ChatState.currentRoom].fontColor);
    if (_fontColor && safeColor(_fontColor)) {
        msgText.style.color = _fontColor;
    }
    content.appendChild(header); content.appendChild(msgText);

    if (msg.attachment && !msg.deleted) {
        const a = buildAttachmentElement(msg.attachment);
        if (a) content.appendChild(a);
    }

    if (msg.replyTo) {
        const q = document.createElement('div'); q.className = 'reply-quote';
        const n = document.createElement('div'); n.className = 'reply-name'; n.textContent = '↩ ' + (msg.replyTo.senderName || '');
        const t = document.createElement('div'); t.className = 'reply-text'; t.textContent = truncate(msg.replyTo.text || '', 80);
        q.appendChild(n); q.appendChild(t);
        q.onclick = () => {
            const o = document.querySelector('[data-msg-id="' + msg.replyTo.id + '"]');
            if (o) {
                o.scrollIntoView({ behavior: 'smooth', block: 'center' });
                o.classList.add('highlighted');
                setTimeout(() => o.classList.remove('highlighted'), 3000);
            }
        };
        content.appendChild(q);
    }

    const reactions = document.createElement('div'); reactions.className = 'message-reactions';
    if (msg.reactions) {
        Object.entries(msg.reactions).forEach(([e, u]) => {
            const b = document.createElement('span'); b.className = 'reaction-badge';
            if (Array.isArray(u) && user && u.includes(user.uid)) b.classList.add('mine');
            b.textContent = e + ' ' + (Array.isArray(u) ? u.length : 0);
            b.onclick = () => toggleReaction(msgId, e);
            reactions.appendChild(b);
        });
    }
    content.appendChild(reactions);

    msgEl.appendChild(aw); msgEl.appendChild(content);

    if (msg.isWelcome === true && user) {
        var uLevel2 = user.rankLevel || (typeof getRankLevel === 'function' ? getRankLevel(user.rank) : 0);
        var canDeleteWelcome = (msg.welcomeFor === user.uid) || (uLevel2 >= 80) || user.rank === 'King' || user.rank === 'Queen';
        if (canDeleteWelcome) {
            var delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'welcome-del-btn';
            delBtn.textContent = '✕';
            delBtn.title = 'حذف رسالة الانضمام';
            delBtn.onclick = function(e) {
                e.stopPropagation();
                e.preventDefault();
                _hideWelcomeMessage(msgId, msgEl);
            };
            msgEl.style.position = 'relative';
            msgEl.appendChild(delBtn);
        }
    }

    container.appendChild(msgEl);
    container.scrollTop = container.scrollHeight;
}

async function _hideWelcomeMessage(msgId, msgEl) {
    if (!confirm('حذف رسالة الانضمام؟')) return;
    var roomId = (typeof ChatState !== 'undefined' && ChatState.currentRoom) || 'general';
    try {
        await db.ref('room_messages/' + roomId + '/' + msgId).update({
            hidden: true,
            hiddenBy: getCurrentUser() && getCurrentUser().uid,
            hiddenByName: (getCurrentUser() && getCurrentUser().name) || 'مشرف',
            hiddenAt: Date.now(),
            hiddenReason: 'welcome_deleted'
        });
        if (msgEl && msgEl.parentNode) msgEl.remove();
    } catch (e) {
        console.warn('hide welcome failed:', e);
        if (typeof showToast === 'function') showToast('fa-times', '⚠️ فشل');
    }
}
window._hideWelcomeMessage = _hideWelcomeMessage;

function buildAttachmentElement(att) {
    if (!att || !att.url) return null;
    const w = document.createElement('div'); w.className = 'message-attachment';
    const t = att.type, u = att.url;
    if (t === 'image' || t === 'gif') {
        const i = document.createElement('img');
        i.src = u; i.alt = 'صورة'; i.loading = 'lazy';
        i.onclick = () => window.open(u, '_blank');
        w.appendChild(i);
    } else if (t === 'audio') {
        const a = document.createElement('audio');
        a.controls = true; a.src = u;
        w.appendChild(a);
    } else if (t === 'video') {
        const v = document.createElement('video');
        v.controls = true; v.src = u;
        w.appendChild(v);
    } else return null;
    return w;
}

/* ⭐ v3.16: sendMessage — يُرسل cinema */
async function sendMessage() {
    const input = document.getElementById('message-input'); if (!input) return;
    const text = input.value.trim();
    let user = getCurrentUser();
    if (!text || !user) return;

    if (user.isBanned && user.bannedUntil && Date.now() < user.bannedUntil) {
        var mins = Math.ceil((user.bannedUntil - Date.now()) / 60000);
        showToast('fa-ban', '🚪 أنت محظور — ' + mins + ' دقيقة');
        return;
    }
    if (user.isJailed && user.jailUntil && Date.now() < user.jailUntil) {
        var jmins = Math.ceil((user.jailUntil - Date.now()) / 60000);
        showToast('fa-lock', '⛓️ أنت في السجن — ' + jmins + ' دقيقة');
        return;
    }
    if (user.muteInRoom && user.muteRoom === ChatState.currentRoom) {
        showToast('fa-microphone-slash', '🔇 أنت ممنوع من الكتابة في هذه الغرفة');
        return;
    }

    const nc = Date.now();
    if (ChatState._lastSentText === text && (nc - (ChatState._lastSentAt || 0)) < 1500) return;
    ChatState._lastSentText = text;
    ChatState._lastSentAt = nc;

    const now = Date.now();
    if (now - ChatState.lastMessageTime < QAMAR.RATE_LIMIT.MESSAGE_INTERVAL_MS) {
        const r = Math.ceil((QAMAR.RATE_LIMIT.MESSAGE_INTERVAL_MS - (now - ChatState.lastMessageTime)) / 1000);
        showToast('fa-hourglass-half', '⏳ انتظر ' + r + ' ثانية');
        return;
    }
    if (text.length > QAMAR.RATE_LIMIT.MAX_MESSAGE_LENGTH) { showToast('fa-exclamation-triangle', '⚠️ طويلة'); return; }
    if (isLink(text)) { showToast('fa-ban', '🚫 يحظر الروابط'); return; }

    ChatState.lastMessageTime = now;

    if (text.startsWith('!') && typeof handleBotCommand === 'function') {
        handleBotCommand(text);
        input.value = '';
        return;
    }

    const mentions = extractMentions(text);

    const messageData = {
        senderUid: user.uid,
        senderName: user.name,
        senderCode: user.code || null,
        senderAvatar: user.avatar || '',
        senderColor: user.color || '#ffd700',
        senderRank: user.rank,
        senderFrame: user.avatarFrame || 'none',
        senderNameColor: user.nameColor || null,
        senderNameGradient: user.nameGradient || null,
        senderNameBgColor: user.nameBgColor || null,
        senderNameBgGradient: user.nameBgGradient || null,
        senderCinemaText: user.cinemaTextStyle || null,
        senderCinemaBg: user.cinemaBgStyle || null,
        text: text,
        mentions: mentions,
        replyTo: ChatState.replyingTo,
        time: firebase.database.ServerValue.TIMESTAMP,
        edited: false,
        deleted: false
    };

    const msgRef = db.ref('room_messages/' + ChatState.currentRoom).push();
    const key = ChatState.currentRoom + '_' + msgRef.key;
    ChatState.seenMessages.add(key);
    msgRef.set(messageData).catch(err => {
        console.error('Send error:', err);
        showToast('fa-exclamation-circle', '⚠️ فشل الإرسال');
    });
    const lm = Object.assign({}, messageData, { time: Date.now() });
    displayMessage(lm, msgRef.key);
    if (mentions.length > 0) notifyMentions(mentions, text);
    cancelReply();
    input.value = '';
    input.focus();
}

function notifyMentions(mentions, text) {
    const user = getCurrentUser(); if (!user) return;
    mentions.forEach(async name => {
        if (name === user.name) return;
        try {
            const s = await db.ref('user_names/' + name).once('value');
            const uid = s.val();
            if (uid) db.ref('user_notifications/' + uid).push({
                fromUid: user.uid, fromName: user.name, fromAvatar: user.avatar || '',
                type: 'mention', roomId: ChatState.currentRoom,
                preview: truncate(text, 80), time: Date.now(), read: false
            });
        } catch (e) {}
    });
}

function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function startReply(sender, text, msgId) {
    ChatState.replyingTo = { id: msgId, senderName: sender, text: truncate(text, 100) };
    const n = document.getElementById('reply-name'), t = document.getElementById('reply-text-preview'), p = document.getElementById('reply-preview');
    if (n) n.textContent = sender;
    if (t) t.textContent = truncate(text, 60);
    if (p) p.classList.add('show');
    const i = document.getElementById('message-input'); if (i) i.focus();
    closeAllMenus();
}

function cancelReply() {
    ChatState.replyingTo = null;
    const p = document.getElementById('reply-preview');
    if (p) p.classList.remove('show');
}

function insertMention(name) {
    const i = document.getElementById('message-input'); if (!i) return;
    const v = i.value, sp = v.length > 0 && !v.endsWith(' ') ? ' ' : '';
    i.value = v + sp + '@' + name + ' ';
    i.focus();
    closeAllMenus();
}

function showMessageMenu(msgEl, sender, text, msgId) {
    closeAllMenus();
    const user = getCurrentUser(); if (!user) return;
    const isOwner = sender === user.name;
    const canDelete = isOwner || can(user, 'canDeleteAnyMessage');
    const menu = document.createElement('div');
    menu.className = 'message-menu open';

    const r = document.createElement('div');
    r.className = 'message-menu-item'; r.textContent = '😊 تفاعل';
    r.onclick = () => { menu.remove(); showEmojiBar(msgEl, msgId); };
    menu.appendChild(r);

    const rp = document.createElement('div');
    rp.className = 'message-menu-item'; rp.textContent = '💬 رد';
    rp.onclick = () => startReply(sender, text, msgId);
    menu.appendChild(rp);

    if (isOwner && msgId) {
        const e = document.createElement('div');
        e.className = 'message-menu-item'; e.textContent = '✏️ تعديل';
        e.onclick = () => editMessage(msgEl, msgId);
        menu.appendChild(e);
    }
    if (canDelete && msgId) {
        const d = document.createElement('div');
        d.className = 'message-menu-item danger'; d.textContent = '🗑️ حذف';
        d.onclick = () => deleteMessage(msgEl, msgId);
        menu.appendChild(d);
    }

    const c = msgEl.querySelector('.message-content');
    if (c) c.appendChild(menu);
    setTimeout(() => {
        const h = e => {
            if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', h); }
        };
        document.addEventListener('click', h);
    }, 100);
}

function showEmojiBar(msgEl, msgId) {
    closeAllMenus();
    const bar = document.createElement('div'); bar.className = 'emoji-bar open';
    ['👍', '❤️', '😂', '😮', '😢'].forEach(e => {
        const s = document.createElement('span');
        s.className = 'emoji-quick'; s.textContent = e;
        s.onclick = () => { toggleReaction(msgId, e); bar.remove(); };
        bar.appendChild(s);
    });
    const p = document.createElement('button');
    p.className = 'emoji-plus'; p.textContent = '+';
    p.onclick = () => { const c = prompt('🎨 إيموجي:', '🎉'); if (c) { toggleReaction(msgId, c); bar.remove(); } };
    bar.appendChild(p);
    const c = msgEl.querySelector('.message-content');
    if (c) c.appendChild(bar);
}

function closeAllMenus() {
    document.querySelectorAll('.message-menu,.emoji-bar').forEach(e => e.remove());
}

async function toggleReaction(msgId, emoji) {
    const user = getCurrentUser(); if (!user || !msgId) return;
    try {
        const ref = db.ref('room_messages/' + ChatState.currentRoom + '/' + msgId + '/reactions/' + emoji);
        const s = await ref.once('value');
        const u = s.val() || [];
        const i = Array.isArray(u) ? u.indexOf(user.uid) : -1;
        if (i >= 0) {
            u.splice(i, 1);
            if (u.length === 0) await ref.remove();
            else await ref.set(u);
        } else {
            const nu = Array.isArray(u) ? u.concat([user.uid]) : [user.uid];
            await ref.set(nu);
        }
    } catch (e) {}
    closeAllMenus();
}

async function editMessage(msgEl, msgId) {
    const t = msgEl.querySelector('.message-text'); if (!t) return;
    const cur = t.innerText, nt = prompt('✏️ تعديل:', cur);
    if (nt && nt.trim() && nt !== cur) {
        try {
            await db.ref('room_messages/' + ChatState.currentRoom + '/' + msgId).update({ text: nt.trim(), edited: true });
        } catch (e) { showToast('fa-exclamation-circle', '⚠️ فشل'); }
    }
    closeAllMenus();
}

async function deleteMessage(msgEl, msgId) {
    if (!msgId) return;
    if (!confirm('🗑️ حذف هذه الرسالة؟')) return;
    const user = getCurrentUser();
    try {
        await db.ref('room_messages/' + ChatState.currentRoom + '/' + msgId).update({
            hidden: true,
            hiddenBy: user ? user.uid : null,
            hiddenByName: user ? user.name : 'مشرف',
            hiddenAt: Date.now(),
            hiddenReason: 'manual'
        });
        const uLevel = user ? (user.rankLevel || (typeof getRankLevel === 'function' ? getRankLevel(user.rank) : 0)) : 0;
        const canSee = user && (user.rank === 'King' || user.rank === 'Queen' || uLevel >= 95);
        if (!canSee && msgEl && msgEl.parentNode) msgEl.remove();
    } catch (e) {
        console.warn('delete message failed:', e);
        showToast('fa-exclamation-circle', '⚠️ فشل');
    }
    closeAllMenus();
}

function togglePrivateMessages() {
    const s = document.getElementById('pm-sidebar'); if (!s) return;
    const o = s.classList.toggle('open');
    ['rooms-sidebar', 'notif-sidebar', 'settings-sidebar'].forEach(id => {
        const e = document.getElementById(id);
        if (e) e.classList.remove('open');
    });
    const ov = document.getElementById('overlay');
    if (ov) ov.classList.toggle('show', o);
    if (o) {
        if (typeof window.loadPrivateChatsList === 'function') {
            window.loadPrivateChatsList();
        }
        ChatState.unreadPrivate = 0;
        updatePMBadge();
    }
}

function startPrivateChatsListener() {
    const user = getCurrentUser(); if (!user || !user.uid) return;
    if (ChatState.privateChatsListener) ChatState.privateChatsListener.off();
    const ref = db.ref('user_private_chats/' + user.uid);
    ChatState.privateChatsListener = ref;
    ref.on('value', s => {
        const c = s.val() || {};
        ChatState.privateChatsCache = c;
        let u = 0;
        Object.values(c).forEach(ch => { u += ch.unread || 0; });
        ChatState.unreadPrivate = u;
        updatePMBadge();
    });
}

function updatePMBadge() {
    const b = document.getElementById('pm-badge'); if (!b) return;
    if (ChatState.unreadPrivate > 0) {
        b.textContent = ChatState.unreadPrivate > 9 ? '9+' : ChatState.unreadPrivate;
        b.style.display = 'flex';
    } else b.style.display = 'none';
}

function openPrivateChatWith(uid, name, av) {
    const user = getCurrentUser();
    if (!user || !user.uid) { showToast('fa-user', 'سجّل دخول'); return; }
    if (uid === user.uid) return;
    if (isBlocked(uid)) { showToast('fa-ban', '🚫 هذا المستخدم محظور'); return; }

    ChatState.currentPrivateChat = {
        otherUid: uid,
        otherName: name || 'مستخدم',
        otherAvatar: av || getDefaultAvatar(name)
    };

    const a = document.getElementById('pc-avatar'), n = document.getElementById('pc-name'), st = document.getElementById('pc-status'), m = document.getElementById('private-chat-modal');
    if (a) a.src = ChatState.currentPrivateChat.otherAvatar;
    if (n) n.textContent = ChatState.currentPrivateChat.otherName;
    if (st) st.textContent = 'نشط';
    if (m) m.classList.add('open');
    const min = document.getElementById('minimized-chat-avatar'); if (min) min.classList.remove('show');
    ChatState.minimizedChat = null;
    ChatState.seenPrivateMessages.clear();

    db.ref('user_private_chats/' + user.uid + '/' + uid + '/unread').set(0).catch(function(){});

    if (typeof window.loadPrivateMessages === 'function') {
        window.loadPrivateMessages();
    }
    if (typeof window.clearPrivateNotifsFrom === 'function') {
        window.clearPrivateNotifsFrom(uid);
    }
}

function _clearPrivateNotifsFrom(fromUid) {
    var user = getCurrentUser();
    if (!user || !user.uid || !fromUid || !db) return;
    db.ref('user_notifications/' + user.uid).once('value').then(function(s) {
        var data = s.val() || {};
        var promises = [];
        Object.keys(data).forEach(function(k) {
            var n = data[k] || {};
            if (n.type === 'private' && n.fromUid === fromUid) {
                promises.push(db.ref('user_notifications/' + user.uid + '/' + k).remove().catch(function(){}));
            }
        });
        if (promises.length > 0) {
            Promise.all(promises).then(function() {});
        }
    }).catch(function(){});
}

function toggleNotifications() {
    const s = document.getElementById('notif-sidebar'); if (!s) return;
    const o = s.classList.toggle('open');
    ['rooms-sidebar', 'settings-sidebar', 'pm-sidebar'].forEach(id => {
        const e = document.getElementById(id);
        if (e) e.classList.remove('open');
    });
    const ov = document.getElementById('overlay');
    if (ov) ov.classList.toggle('show', o);
    if (o) {
        loadNotifications();
        ChatState.unreadCount = 0;
        updateNotifBadge();
        markAllNotificationsRead();
    }
}

function startNotificationsListener() {
    const user = getCurrentUser();
    if (!user || !user.uid) return;
    if (ChatState.notificationsListener) ChatState.notificationsListener.off();

    let lastKnownKey = '';
    db.ref('user_notifications/' + user.uid).limitToLast(50).once('value').then(function (s) {
        var unread = 0;
        s.forEach(function (c) {
            var n = c.val();
            if (!n) return;
            lastKnownKey = c.key;
            if (n.read) return;
            if (n.fromUid === user.uid) return;
            if (n.type === 'private') return;
            unread++;
        });
        ChatState.unreadCount = unread;
        updateNotifBadge();

        const ref = db.ref('user_notifications/' + user.uid).limitToLast(20);
        ChatState.notificationsListener = ref;

        ref.on('child_added', function (s) {
            var n = s.val();
            if (!n) return;
            if (s.key <= lastKnownKey) return;
            if (n.fromUid === user.uid) return;
            if (n.read) return;
            lastKnownKey = s.key;

            if (n.type === 'mention') {
                playBirdSound();
                showToast('fa-bell', '🔔 ' + n.fromName + ' أشار إليك');
                ChatState.unreadCount++;
                updateNotifBadge();
            } else if (n.type === 'private') {
                playPrivateMsgSound();
            } else if (n.type === 'friend_request') {
                showToast('fa-user-plus', '➕ طلب صداقة من ' + n.fromName);
                ChatState.unreadCount++;
                updateNotifBadge();
            } else if (n.type === 'like') {
                showToast('fa-heart', '❤️ ' + n.fromName + ' أعجب بك');
                ChatState.unreadCount++;
                updateNotifBadge();
            }
        });
    }).catch(function () {});
}

function loadNotifications() {
    const user = getCurrentUser(); if (!user || !user.uid) return;
    const list = document.getElementById('notif-list'); if (!list) return;
    list.innerHTML = '';
    db.ref('user_notifications/' + user.uid).limitToLast(50).once('value', s => {
        const arr = [];
        s.forEach(c => {
            var n = Object.assign({ id: c.key }, c.val());
            if (n.type === 'private') {
                if (n.read) return;
                if (n.fromUid === user.uid) return;
            }
            if (n.read && n.type !== 'friend_request') return;
            arr.push(n);
        });
        arr.reverse();
        if (arr.length === 0) {
            const e = document.createElement('div');
            e.style.cssText = 'text-align:center;color:var(--text-dim);font-size:12px;padding:20px;';
            e.textContent = 'لا إشعارات';
            list.appendChild(e);
            return;
        }
        arr.forEach(n => {
            var el = buildNotificationElement(n);
            el.dataset.notifId = n.id || '';
            list.appendChild(el);
        });
    });
}

function buildNotificationElement(n) {
    var i = document.createElement('div');
    i.className = 'notif-item';
    if (!n.read) i.classList.add('unread');
    i.dataset.notifId = n.id || '';

    var img = document.createElement('img');
    img.src = n.fromAvatar || getDefaultAvatar(n.fromName);
    img.style.cssText = 'width:32px;height:32px;border-radius:50%;border:1px solid var(--gold);flex-shrink:0;';

    var inf = document.createElement('div');
    inf.style.cssText = 'flex:1;min-width:0;';

    var nm = document.createElement('div');
    nm.style.cssText = 'color:var(--gold);font-weight:900;font-size:12px;';
    nm.textContent = n.fromName || '';

    var t = document.createElement('div');
    t.style.cssText = 'color:var(--text-dim);font-size:11px;margin-top:2px;word-break:break-word;';
    if (n.type === 'mention') {
        const r = QAMAR.ROOMS[n.roomId];
        t.textContent = '📢 أشار في ' + (r ? r.name : n.roomId);
    } else if (n.type === 'private') t.textContent = '💬 ' + (n.preview || 'رسالة');
    else if (n.type === 'friend_request') t.textContent = '➕ طلب صداقة';
    else if (n.type === 'friend_accepted') t.textContent = '✅ ' + (n.preview || 'قبل صداقتك');
    else if (n.type === 'like') t.textContent = '❤️ ' + (n.preview || 'أعجب بك');
    else t.textContent = n.preview || '';

    var tm = document.createElement('div');
    tm.style.cssText = 'color:#666;font-size:10px;margin-top:2px;';
    tm.textContent = formatTime(n.time);

    inf.appendChild(nm); inf.appendChild(t); inf.appendChild(tm);

    if (n.type === 'friend_request' && n.fromUid) {
        var actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:6px;margin-top:8px;';

        var acceptBtn = document.createElement('button');
        acceptBtn.type = 'button';
        acceptBtn.textContent = '✅ قبول';
        acceptBtn.style.cssText = 'flex:1;padding:8px 10px;background:#84cc16;color:#fff;border:none;border-radius:8px;font-family:Cairo,sans-serif;font-weight:900;font-size:12px;cursor:pointer;';
        acceptBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var me = getCurrentUser();
            if (me && me.uid) {
                acceptFriendRequest(me.uid, n.fromUid, n.fromName, n.fromAvatar, i, acceptBtn, rejectBtn);
            }
        });

        var rejectBtn = document.createElement('button');
        rejectBtn.type = 'button';
        rejectBtn.textContent = '❌ رفض';
        rejectBtn.style.cssText = 'flex:1;padding:8px 10px;background:rgba(255,68,68,0.85);color:#fff;border:none;border-radius:8px;font-family:Cairo,sans-serif;font-weight:900;font-size:12px;cursor:pointer;';
        rejectBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var me = getCurrentUser();
            if (me && me.uid) {
                rejectFriendRequest(me.uid, n.fromUid, i, acceptBtn, rejectBtn);
            }
        });

        actions.appendChild(acceptBtn);
        actions.appendChild(rejectBtn);
        inf.appendChild(actions);
    }

    i.appendChild(img); i.appendChild(inf);

    i.addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        if (n.type === 'mention' && n.roomId && QAMAR.ROOMS[n.roomId]) {
            const r = QAMAR.ROOMS[n.roomId];
            switchRoom(n.roomId, r.name + ' ' + r.icon);
        } else if (n.type === 'private' && n.fromUid) {
            openPrivateChatWith(n.fromUid, n.fromName, n.fromAvatar);
        } else if ((n.type === 'like' || n.type === 'poke' || n.type === 'friend_request' || n.type === 'friend_accepted') && n.fromUid) {
            openUserProfile(n.fromUid, n.fromName);
        }
        closeAllPanels();
    });

    return i;
}

async function acceptFriendRequest(myUid, fromUid, fromName, fromAvatar, notifEl, acceptBtn, rejectBtn) {
    if (!myUid || !fromUid) { showToast('fa-times', '⚠️ بيانات ناقصة'); return; }
    if (acceptBtn) { acceptBtn.disabled = true; acceptBtn.textContent = '⏳'; }
    if (rejectBtn) rejectBtn.disabled = true;

    try {
        var now = Date.now();
        var myData = getCurrentUser() || {};
        await db.ref('users/' + myUid + '/friends/' + fromUid).set({
            status: 'accepted', time: now,
            name: fromName || 'صديق', avatar: fromAvatar || ''
        });
        await db.ref('users/' + fromUid + '/friends/' + myUid).set({
            status: 'accepted', time: now,
            name: myData.name || 'صديق', avatar: myData.avatar || ''
        });
        try {
            await db.ref('user_notifications/' + fromUid).push({
                fromUid: myUid, fromName: myData.name || 'صديق', fromAvatar: myData.avatar || '',
                type: 'friend_accepted', icon: '✅', preview: 'قبل صداقتك',
                time: Date.now(), read: false
            });
        } catch (e) {}
        if (notifEl && notifEl.dataset && notifEl.dataset.notifId) {
            db.ref('user_notifications/' + myUid + '/' + notifEl.dataset.notifId).remove().catch(function(){});
        }
        if (acceptBtn) { acceptBtn.textContent = '✅ تم'; acceptBtn.style.background = '#65a30d'; }
        if (rejectBtn) rejectBtn.style.display = 'none';
        showToast('fa-check', '✅ تمت الصداقة');
    } catch (e) {
        showToast('fa-times', '⚠️ فشل القبول');
        if (acceptBtn) { acceptBtn.disabled = false; acceptBtn.textContent = '✅ قبول'; }
        if (rejectBtn) rejectBtn.disabled = false;
    }
}

async function rejectFriendRequest(myUid, fromUid, notifEl, acceptBtn, rejectBtn) {
    if (!myUid || !fromUid) { showToast('fa-times', '⚠️ بيانات ناقصة'); return; }
    if (acceptBtn) acceptBtn.disabled = true;
    if (rejectBtn) { rejectBtn.disabled = true; rejectBtn.textContent = '⏳'; }

    try {
        if (notifEl && notifEl.dataset && notifEl.dataset.notifId) {
            await db.ref('user_notifications/' + myUid + '/' + notifEl.dataset.notifId).remove();
        }
        if (notifEl) {
            notifEl.style.opacity = '0.4';
            if (acceptBtn) acceptBtn.style.display = 'none';
            if (rejectBtn) { rejectBtn.textContent = '❌ مرفوض'; rejectBtn.style.background = '#666'; }
        }
        showToast('fa-times', '❌ تم الرفض');
    } catch (e) {
        if (acceptBtn) acceptBtn.disabled = false;
        if (rejectBtn) { rejectBtn.disabled = false; rejectBtn.textContent = '❌ رفض'; }
    }
}

window.acceptFriendRequest = acceptFriendRequest;
window.rejectFriendRequest = rejectFriendRequest;

function updateNotifBadge() {
    const b = document.getElementById('notif-badge'); if (!b) return;
    if (ChatState.unreadCount > 0) {
        b.textContent = ChatState.unreadCount > 9 ? '9+' : ChatState.unreadCount;
        b.style.display = 'flex';
    } else b.style.display = 'none';
}

function markAllNotificationsRead() {
    const user = getCurrentUser(); if (!user || !user.uid) return;
    db.ref('user_notifications/' + user.uid).limitToLast(50).once('value', s => {
        const u = {};
        s.forEach(c => { if (!c.val().read) u[c.key + '/read'] = true; });
        if (Object.keys(u).length > 0) db.ref('user_notifications/' + user.uid).update(u);
    });
}

function startPresenceHeartbeat() {
    const user = getCurrentUser(); if (!user || !user.uid) return;
    const ref = db.ref('user_presence/' + user.uid);
    const setOn = () => ref.set({ state: 'online', lastChanged: Date.now(), room: ChatState.currentRoom }).catch(() => {});
    const setOff = () => ref.set({ state: 'offline', lastChanged: Date.now(), room: ChatState.currentRoom }).catch(() => {});
    setOn();
    ChatState.presenceInterval = setInterval(setOn, 30000);
    window.addEventListener('beforeunload', setOff);
    ref.onDisconnect().set({ state: 'offline', lastChanged: Date.now() });
}

function startInvisibleListener() {
    const u = getCurrentUser(); if (!u || !u.uid) return;
    const ref = db.ref('users/' + u.uid + '/invisible');
    ref.on('value', s => { ChatState.invisibleMode = s.val() === true; });
    ChatState.listeners.invisibleRef = ref;
}

async function toggleInvisible() {
    const u = getCurrentUser(); if (!u || !u.uid) return;
    if (!can(u, 'canInvisible')) { showToast('fa-lock', '🔒 للملك/الملكة'); return; }
    const nv = !ChatState.invisibleMode;
    try {
        await db.ref('users/' + u.uid + '/invisible').set(nv);
        ChatState.invisibleMode = nv;
        showToast('fa-eye-slash', nv ? '👻 مُفعَّل' : '👁️ مُعطَّل');
    } catch (e) { showToast('fa-exclamation-circle', '⚠️ فشل'); }
}

function updateMicsUI() {
    const mb = document.getElementById('mics-bar'); if (!mb) return;
    const r = QAMAR.ROOMS[ChatState.currentRoom]; if (!r) return;
    const mc = mb.querySelector('.mics'); if (!mc) return;
    mc.innerHTML = '';
    const u = getCurrentUser();
    const count = r.micCount || 0;
    const canUse = u && can(u, 'canUseMic');
    if (count === 0) { mb.classList.add('hidden'); return; }
    mb.classList.remove('hidden');
    for (let i = 0; i < count; i++) {
        const b = document.createElement('button');
        b.className = 'mic-btn'; b.setAttribute('data-mic', i);
        if (!canUse) b.disabled = true;
        const ic = document.createElement('i'); ic.className = 'fas fa-microphone';
        b.appendChild(ic);
        b.onclick = () => toggleMic(i);
        mc.appendChild(b);
    }
}

function toggleMic(i) {
    const u = getCurrentUser(); if (!u) return;
    if (!can(u, 'canUseMic')) { showToast('fa-lock', '🔒 لا تستطيع'); return; }
    const b = document.querySelector('.mic-btn[data-mic="' + i + '"]'); if (!b) return;
    const a = b.classList.toggle('active');
    const ic = b.querySelector('i');
    if (ic) ic.className = a ? 'fas fa-user' : 'fas fa-microphone';
}

function toggleMicsBar() {
    const m = document.getElementById('mics-bar');
    const t = document.getElementById('mics-toggle-btn');
    if (m) m.classList.toggle('hidden');
    if (t) {
        t.classList.toggle('collapsed');
        const ic = t.querySelector('i');
        if (ic) ic.className = (m && m.classList.contains('hidden')) ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
    }
}

function toggleRooms() {
    const s = document.getElementById('rooms-sidebar'); if (!s) return;
    const o = s.classList.toggle('open');
    ['notif-sidebar', 'settings-sidebar', 'pm-sidebar'].forEach(id => {
        const e = document.getElementById(id);
        if (e) e.classList.remove('open');
    });
    const ov = document.getElementById('overlay');
    if (ov) ov.classList.toggle('show', o);
}

function toggleSettings() {
    const s = document.getElementById('settings-sidebar'); if (!s) return;
    const o = s.classList.toggle('open');
    ['rooms-sidebar', 'notif-sidebar', 'pm-sidebar'].forEach(id => {
        const e = document.getElementById(id);
        if (e) e.classList.remove('open');
    });
    const ov = document.getElementById('overlay');
    if (ov) ov.classList.toggle('show', o);
}

function closeAllPanels() {
    ['rooms-sidebar', 'settings-sidebar', 'notif-sidebar', 'pm-sidebar', 'users-sidebar'].forEach(id => {
        const e = document.getElementById(id);
        if (e) e.classList.remove('open');
    });
    const ov = document.getElementById('overlay');
    if (ov) ov.classList.remove('show');
}

function addSystemMessage(text) {
    const c = document.getElementById('messages'); if (!c) return;
    const m = document.createElement('div');
    m.className = 'message system';
    m.textContent = text;
    c.appendChild(m);
    c.scrollTop = c.scrollHeight;
}

function openUserProfile(uid, name) {
    const user = getCurrentUser(); if (!user) return;
    if (uid === user.uid) { openProfile(); return; }
    if (!uid) { showToast('fa-user', 'لا يمكن'); return; }
    localStorage.setItem('profile_target_uid', uid);
    localStorage.setItem('profile_target_name', name);
    localStorage.setItem('profile_view_mode', 'visitor');
    const i = document.getElementById('profile-iframe');
    if (i) i.src = 'profile.html?uid=' + encodeURIComponent(uid) + '&t=' + Date.now();
    const f = document.getElementById('profile-frame-container');
    if (f) {
        f.style.display = 'block';
        const rb = f.querySelector('.close-btn');
        if (rb) rb.style.display = 'none';
    }
}

function openProfile() {
    const user = getCurrentUser(); if (!user) return;
    localStorage.setItem('profile_view_mode', 'owner');
    localStorage.setItem('profile_target_uid', user.uid);
    const i = document.getElementById('profile-iframe');
    if (i) i.src = 'profile.html?owner=1&t=' + Date.now();
    const f = document.getElementById('profile-frame-container');
    if (f) {
        f.style.display = 'block';
        const rb = f.querySelector('.close-btn');
        if (rb) rb.style.display = 'none';
    }
}

function closeProfileFrame() {
    const f = document.getElementById('profile-frame-container');
    if (f) f.style.display = 'none';
    const i = document.getElementById('profile-iframe');
    if (i) i.src = 'about:blank';
}

function toggleToolbar() {
    const t = document.getElementById('floating-toolbar'), b = document.getElementById('plus-btn');
    if (t) t.classList.toggle('open');
    if (b) b.classList.toggle('active');
}

function rollDice() {
    addSystemMessage('🎲 ' + (Math.floor(Math.random() * 6) + 1));
    toggleToolbar();
}

function searchYouTube() {
    const q = prompt('🔍 يوتيوب:');
    if (q) window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(q), '_blank');
    toggleToolbar();
}

function insertEmoji() {
    if (typeof window.MediaPicker !== 'undefined' && window.MediaPicker.open) {
        window.MediaPicker.open('general');
    }
}

function showOnlineUsers() {
    if (typeof window.showOnlineUsers === 'function' && window.showOnlineUsers !== showOnlineUsers) {
        window.showOnlineUsers();
    } else {
        closeAllPanels();
        showToast('fa-users', '👥 قريباً');
    }
}

function showStore() { closeAllPanels(); showToast('fa-store', '🛒 قريباً'); }

function openUpgradeModal() {
    const u = getCurrentUser();
    if (!u || !u.isGuest) { showToast('fa-check', '✅ أنت عضو'); return; }
    const m = document.getElementById('upgrade-modal');
    if (m) m.classList.add('active');
}
function closeUpgradeModal() {
    const m = document.getElementById('upgrade-modal');
    if (m) m.classList.remove('active');
}

async function handleLogout() {
    if (!confirm('تأكيد الخروج؟')) return;
    cleanupAllListeners();
    await logout();
    location.reload();
}

window.addEventListener('DOMContentLoaded', () => {
    const u = getCurrentUser();
    if (u) setTimeout(() => { if (typeof initChat === 'function') initChat(); }, 100);
});

document.addEventListener('DOMContentLoaded', () => {
    const o = document.getElementById('overlay');
    if (o) o.addEventListener('click', closeAllPanels);
});

document.addEventListener('DOMContentLoaded', () => {
    const mn = document.getElementById('pc-minimize'), cn = document.getElementById('pc-close');
    if (mn) mn.onclick = () => {
        if (!ChatState.currentPrivateChat) return;
        ChatState.minimizedChat = Object.assign({}, ChatState.currentPrivateChat);
        const m = document.getElementById('private-chat-modal');
        if (m) m.classList.remove('open');
        const mi = document.getElementById('mca-img');
        if (mi) mi.src = ChatState.currentPrivateChat.otherAvatar;
        const mv = document.getElementById('minimized-chat-avatar');
        if (mv) mv.classList.add('show');
    };
    if (cn) cn.onclick = () => {
        if (ChatState.privateMessagesListener) {
            ChatState.privateMessagesListener.off();
            ChatState.privateMessagesListener = null;
        }
        const m = document.getElementById('private-chat-modal');
        if (m) m.classList.remove('open');
        ChatState.currentPrivateChat = null;
        ChatState.minimizedChat = null;
        const mv = document.getElementById('minimized-chat-avatar');
        if (mv) mv.classList.remove('show');
    };
});

function restorePrivateChat() {
    if (!ChatState.minimizedChat) return;
    const c = ChatState.minimizedChat;
    openPrivateChatWith(c.otherUid, c.otherName, c.otherAvatar);
}

window.addEventListener('message', e => {
    if (!e.data) return;
    if (e.data.action === 'openPrivateChat') {
        setTimeout(function () {
            openPrivateChatWith(e.data.uid, e.data.name, e.data.avatar || '');
        }, 100);
    }
    if (e.data.action === 'closeProfile') {
        closeProfileFrame();
    }
    if (e.data.action === 'openUserProfile' && e.data.uid) {
        setTimeout(function () {
            openUserProfile(e.data.uid, e.data.name);
        }, 100);
    }
    if (e.data.action === 'userDataUpdated' && e.data.userData) {
        const u = e.data.userData;
        if (typeof saveSession === 'function') saveSession(u, u.isGuest === true);
        if (u.avatarFrame !== undefined) refreshAvatarsInMessages(u.avatarFrame);
        refreshNameStylesInMessages(u);
    }
    if (e.data.action === 'leaveRoom') {
        if (typeof window.showRoomPicker === 'function') {
            try { window.showRoomPicker(); } catch (err) {}
        } else {
            const roomsList = document.getElementById('rooms-sidebar');
            if (roomsList) {
                roomsList.classList.add('open');
                const ov = document.getElementById('overlay');
                if (ov) ov.classList.add('show');
            }
        }
    }
});

function refreshAvatarsInMessages(newFrame) {
    const u = getCurrentUser(); if (!u || !u.uid) return;
    document.querySelectorAll('[data-sender-uid="' + u.uid + '"] .message-avatar-wrapper').forEach(w => {
        w.querySelectorAll('.qf').forEach(e => e.remove());
        if (newFrame && newFrame !== 'none' && typeof applyFrameToMessage === 'function') {
            applyFrameToMessage(w, newFrame);
        }
    });
}

/* ⭐ v3.16: refreshNameStyles — مع cinema */
function refreshNameStylesInMessages(userData) {
    const u = getCurrentUser(); if (!u || !u.uid) return;
    document.querySelectorAll('[data-sender-uid="' + u.uid + '"]').forEach(msgEl => {
        const un = msgEl.querySelector('.message-username');
        if (!un) return;
        un.textContent = userData.name || u.name || 'مجهول';
        un.setAttribute('data-name', userData.name || u.name || '');

        // إعادة تعيين
        if (window.NameEffects && typeof window.NameEffects.clear === 'function') {
            window.NameEffects.clear(un);
        }

        _applyNameEffectsToUsername(un, {
            senderColor: userData.color || '#ffd700',
            senderNameColor: userData.nameColor || null,
            senderNameGradient: userData.nameGradient || null,
            senderNameBgColor: userData.nameBgColor || null,
            senderNameBgGradient: userData.nameBgGradient || null,
            senderCinemaText: userData.cinemaTextStyle || null,
            senderCinemaBg: userData.cinemaBgStyle || null
        });
    });
}

window.refreshAvatarsInMessages = refreshAvatarsInMessages;
window.refreshNameStylesInMessages = refreshNameStylesInMessages;

function startUserDataListener() {
    const u = getCurrentUser(); if (!u || !u.uid) return;
    let lastRelevant = '';
    const ref = db.ref('users/' + u.uid);
    ref.on('value', s => {
        const d = s.val(); if (!d) return;
        const relevant = JSON.stringify({
            name: d.name, avatar: d.avatar, avatarFrame: d.avatarFrame,
            nameColor: d.nameColor, nameGradient: d.nameGradient,
            nameBgColor: d.nameBgColor, nameBgGradient: d.nameBgGradient,
            cinemaTextStyle: d.cinemaTextStyle, cinemaBgStyle: d.cinemaBgStyle,
            profileGlow: d.profileGlow,
            isBanned: d.isBanned, bannedUntil: d.bannedUntil,
            isJailed: d.isJailed, jailUntil: d.jailUntil
        });
        if (relevant === lastRelevant) return;
        lastRelevant = relevant;

        const c = JSON.parse(localStorage.getItem(QAMAR.STORAGE_KEYS.CURRENT_USER) || '{}');
        const up = Object.assign({}, c, d);
        if (typeof saveSession === 'function') saveSession(up, up.isGuest === true);
        refreshAvatarsInMessages(d.avatarFrame);
        refreshNameStylesInMessages(d);
    });
    ChatState.listeners.userDataRef = ref;
}
window.startUserDataListener = startUserDataListener;

window.ChatState = ChatState;
window.initChat = initChat;
window.sendMessage = sendMessage;
window.handleKeyPress = handleKeyPress;
window.switchRoom = switchRoom;
window.toggleMic = toggleMic;
window.toggleMicsBar = toggleMicsBar;
window.toggleRooms = toggleRooms;
window.toggleSettings = toggleSettings;
window.toggleNotifications = toggleNotifications;
window.togglePrivateMessages = togglePrivateMessages;
window.closeAllPanels = closeAllPanels;
window.startReply = startReply;
window.cancelReply = cancelReply;
window.insertMention = insertMention;
window.editMessage = editMessage;
window.deleteMessage = deleteMessage;
window.toggleReaction = toggleReaction;
window.restorePrivateChat = restorePrivateChat;
window.openUserProfile = openUserProfile;
window.openProfile = openProfile;
window.closeProfileFrame = closeProfileFrame;
window.toggleToolbar = toggleToolbar;
window.rollDice = rollDice;
window.searchYouTube = searchYouTube;
window.insertEmoji = insertEmoji;
window.showOnlineUsers = showOnlineUsers;
window.showStore = showStore;
window.openUpgradeModal = openUpgradeModal;
window.closeUpgradeModal = closeUpgradeModal;
window.handleLogout = handleLogout;
window.toggleInvisible = toggleInvisible;
window.changeBackground = changeBackground;
window.applyFrameToWrapper = applyFrameToWrapper;
window.openProfileByCode = openProfileByCode;
window.cleanupAllListeners = cleanupAllListeners;
window.startPunishmentWatcher = startPunishmentWatcher;
window.applyRoomSettings = applyRoomSettings;
window.applyRoomBackground = applyRoomBackground;
window.applyRoomFont = applyRoomFont;
window.buildRoomsList = buildRoomsList;
window.clearPrivateNotifsFrom = _clearPrivateNotifsFrom;
window.applySidebarStyle = applySidebarStyle;

console.log('✅ chat.js v3.16 loaded — cinema styles in chat');
