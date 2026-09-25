// ==============================================
// bots.js v30 (TEST) — سجان محسّن + نقل للسجن
// ==============================================
// ✅ v30 (فوق v29):
//   1. النقل القسري للسجن عند الحكم
//   2. حفظ lastRoomBeforeJail
//   3. إعادة العضو لآخر غرفة عند انتهاء السجن
//   4. دعم mutes (kتم كامل / كتم غرفة)
//   5. audit_log لكل عقوبة
//   6. باقي كل شيء من v29 محفوظ
// ==============================================

const BotsState = {
    initialized: false,
    autoInterval: null,
    memory: { hakawati: {}, hakawati_auto: {}, quiz: [], islamic: [] },
    currentQuiz: null,
    kingObs: null,
    badWords: ['كلب','حمار','غبي','خرا','زبالة','قذر','تافه','حقير','وقح','خنزير','نصاب'],
    kickWords: [],
    immuneCache: {},
    autoReplyCooldown: {},
    lastUserRooms: {},
    presenceListener: null,
    hiddenListener: null,
    ambassadorReady: false
};

const AUTO_TIMING = { islamic: 2 * 60 * 1000, quiz: 5 * 60 * 1000 };
const AGE_LIMIT_MS = 5 * 60 * 1000;
const QUIZ_WINDOW_MS = 5 * 60 * 1000;
const QUIZ_HINT_AT_MS = 60 * 1000;
const QUIZ_REVEAL_AT_MS = 120 * 1000;
const QUIZ_MAX_WINNERS = 3;
const QUIZ_POINTS = { 1: 10, 2: 5, 3: 2 };
const QUIZ_POINTS_HALF = { 1: 5, 2: 2, 3: 1 };
const HAKAWATI_TRIGGERS = ['حكواتي', 'بووت', 'البووت', 'بوت', 'البوت'];
const AUTO_REPLY_COOLDOWN_MS = 10 * 1000;
const WELCOME_COOLDOWN_MS = 5 * 60 * 1000;
const JAILS_BEFORE_KICK = 3;
const KICK_BAN_BASE_MS = 60 * 60 * 1000;
const PERMANENT_BAN_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_PROCESSED_CACHE = 2000;
const PRUNE_BATCH = 500;
const IMMUNE_LEVEL = 90;

const _processedMsgs = new Set();

const BAD_WORD_WHITELIST = [
    'حمار وحشي',
    'كلب الحراسة',
    'أبو كلب',
    'يا حمار'
];

const DEFAULT_ISLAMIC = [
    '🌙 اللهم صلِّ وسلِّم على نبينا محمد ﷺ',
    '📿 سبحان الله وبحمده، سبحان الله العظيم',
    '🤲 أستغفر الله العظيم وأتوب إليه',
    '✨ لا حول ولا قوة إلا بالله',
    '🌿 اللهم إني أسألك الجنة وأعوذ بك من النار',
    '💫 اللهم آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار',
    '🕌 اللهم اغفر لي ولوالديّ وللمؤمنين والمؤمنات',
    '🌅 أذكار الصباح: أصبحنا وأصبح الملك لله',
    '🌙 أذكار المساء: أمسينا وأمسى الملك لله',
    '📖 قال ﷺ: من قال لا إله إلا الله وحده لا شريك له...',
    '🤍 قال ﷺ: خيركم من تعلم القرآن وعلمه',
    '🌸 اللهم بلّغنا رمضان وأعنا على صيامه وقيامه'
];

const DEFAULT_QUIZ = [
    { q: 'ما هي أطول سورة في القرآن الكريم؟', answers: ['البقرة'] },
    { q: 'كم عدد أركان الإسلام؟', answers: ['5', 'خمسة', 'خمس'] },
    { q: 'ما عاصمة سوريا؟', answers: ['دمشق'] },
    { q: 'ما هي أكبر قارة في العالم؟', answers: ['آسيا', 'اسيا'] },
    { q: 'كم عدد أيام السنة الميلادية؟', answers: ['365'] },
    { q: 'ما هو الكوكب الأحمر؟', answers: ['المريخ'] },
    { q: 'من هو أول خليفة في الإسلام؟', answers: ['أبو بكر', 'ابو بكر'] },
    { q: 'كم عدد قارات العالم؟', answers: ['7', 'سبع', 'سبعة'] },
    { q: 'ما أطول نهر في العالم؟', answers: ['النيل'] },
    { q: 'من اخترع المصباح الكهربائي؟', answers: ['إديسون', 'اديسون'] }
];

const DEFAULT_HAKAWATI = {
    'سلام': 'وعليكم السلام ورحمة الله وبركاته 🌸',
    'السلام عليكم': 'وعليكم السلام ورحمة الله وبركاته 🌸',
    'مرحبا': 'أهلاً وسهلاً بك 🌸',
    'كيفك': 'بخير الحمد لله، وأنت كيف حالك؟ 🌙',
    'كيف حالك': 'بخير الحمد لله، الله يسعدك 🌙',
    'شو اخبارك': 'الحمد لله بخير 🌹',
    'كيف اسجل': 'اختر "زائر" أو "عضو" 📝',
    'كيف أدخل': 'اختر "زائر" أو "عضو" 📝',
    'الرتب': 'الملك ← الملكة ← Master Owner ← Room Owner ← Grand Owner ← Owner 👑',
    'كود التعريف': 'كودك في تبويب المعلومات 🔑',
    'الغرف': 'الغرف في القائمة الجانبية 🚪',
    'الخاص': 'اضغط أيقونة الرسائل 💬',
    'شكرا': 'العفو 🌸',
    'من انت': 'أنا حكواتي الشام 📖',
    'شو اسمك': 'اسمي حكواتي الشام 📖'
};

/* ══════════════════════════════════════════════ */
/* Normalize                                      */
/* ══════════════════════════════════════════════ */
function normalizeArabic(text) {
    if (!text) return '';
    var s = String(text).toLowerCase().trim();
    if (typeof QAMAR !== 'undefined' && QAMAR.ARABIC_EQUIVALENTS) {
        Object.keys(QAMAR.ARABIC_EQUIVALENTS).forEach(function(alt) {
            var main = QAMAR.ARABIC_EQUIVALENTS[alt];
            s = s.split(alt).join(main);
        });
    }
    s = s.replace(/\u0640/g, '');
    s = s.replace(/[أإآٱا]/g, 'ا');
    s = s.replace(/[يىئ]/g, 'ي');
    s = s.replace(/ة/g, 'ه');
    s = s.replace(/[\u064B-\u065F\u0670]/g, '');
    s = s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    s = s.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    s = s.replace(/(.)\1{1,}/g, '$1');
    s = s.replace(/\s+/g, ' ');
    return s;
}

function _isWhitelisted(text) {
    var norm = normalizeArabic(text);
    for (var i = 0; i < BAD_WORD_WHITELIST.length; i++) {
        if (norm.indexOf(normalizeArabic(BAD_WORD_WHITELIST[i])) !== -1) return true;
    }
    return false;
}

function isAnswerMatch(userAnswer, expected) {
    var ua = normalizeArabic(userAnswer);
    var ex = normalizeArabic(expected);
    if (!ua || !ex) return false;
    if (ua === ex) return true;
    if (/^\d+$/.test(ex)) return ua === ex;
    var uaWords = ua.split(/\s+/).filter(Boolean);
    if (uaWords.indexOf(ex) !== -1) return true;
    if (ex.indexOf(' ') !== -1 && ua.indexOf(ex) !== -1) return true;
    return false;
}

function maskWord(w) {
    if (!w) return '';
    var s = String(w);
    if (s.length <= 1) return s;
    if (s.length === 2) return s[0] + '*';
    return s[0] + '*'.repeat(s.length - 2) + s[s.length - 1];
}

function toArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.filter(Boolean);
    if (typeof val === 'object') return Object.values(val).filter(Boolean);
    return [];
}

function pruneProcessedMsgs() {
    if (_processedMsgs.size <= MAX_PROCESSED_CACHE) return;
    var it = _processedMsgs.values();
    for (var i = 0; i < PRUNE_BATCH; i++) {
        var v = it.next();
        if (v.done) break;
        _processedMsgs.delete(v.value);
    }
}

function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function(c) {
        return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
}

function extractMsgKey(msg) {
    if (!msg) return null;
    if (msg._fbKey) return msg._fbKey;
    var currentRoom = (typeof ChatState !== 'undefined' && ChatState.currentRoom) || 'general';
    if (msg._key && msg._key.indexOf(currentRoom + '_') === 0) {
        return msg._key.substring(currentRoom.length + 1);
    }
    return null;
}

/* ══════════════════════════════════════════════ */
/* ⭐ v30: _logAudit موحّد                         */
/* ══════════════════════════════════════════════ */
function _logAudit(type, data) {
    try {
        db.ref('audit_log').push(Object.assign({
            type: type,
            at: firebase.database.ServerValue.TIMESTAMP
        }, data || {})).catch(function () {});
    } catch (e) {}
}

/* ══════════════════════════════════════════════ */
/* الأصوات                                        */
/* ══════════════════════════════════════════════ */
function _getAudioCtx() {
    if (typeof getAudioCtx === 'function') {
        try { return getAudioCtx(); } catch (e) {}
    }
    if (!window._botAudioCtx) {
        try { window._botAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (window._botAudioCtx && window._botAudioCtx.state === 'suspended') {
        window._botAudioCtx.resume().catch(function(){});
    }
    return window._botAudioCtx;
}

function playPoliceSiren() {
    try {
        var ctx = _getAudioCtx();
        if (!ctx) return;
        var now = ctx.currentTime;
        for (var i = 0; i < 4; i++) {
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.type = 'sine';
            var start = now + i * 0.32;
            if (i % 2 === 0) {
                osc.frequency.setValueAtTime(600, start);
                osc.frequency.linearRampToValueAtTime(950, start + 0.28);
            } else {
                osc.frequency.setValueAtTime(950, start);
                osc.frequency.linearRampToValueAtTime(600, start + 0.28);
            }
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.28, start + 0.04);
            gain.gain.setValueAtTime(0.28, start + 0.22);
            gain.gain.exponentialRampToValueAtTime(0.01, start + 0.3);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.32);
        }
    } catch (e) {}
}

function playWelcomeSound() {
    try {
        var ctx = _getAudioCtx();
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume().catch(function(){});
        var now = ctx.currentTime;
        var notes = [523.25, 659.25, 783.99];
        notes.forEach(function(freq, i) {
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.type = 'sine';
            var start = now + i * 0.14;
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.2, start + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.01, start + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.4);
        });
    } catch (e) {}
}

/* ══════════════════════════════════════════════ */
/* الحصانة                                        */
/* ══════════════════════════════════════════════ */
async function isImmuneUser(uid) {
    if (!uid) return false;
    var cached = BotsState.immuneCache[uid];
    if (cached && (Date.now() - cached.at) < 60000) return cached.immune;
    try {
        var s = await db.ref('users/' + uid).once('value');
        var u = s.val() || {};
        var lvl = u.rankLevel || 0;
        if (!lvl && typeof getRankLevel === 'function') lvl = getRankLevel(u.rank) || 0;
        var immune = (lvl >= IMMUNE_LEVEL) || u.rank === 'King' || u.rank === 'Queen';
        BotsState.immuneCache[uid] = { immune: immune, at: Date.now(), name: u.name || 'مجهول', rank: u.rank || 'User' };
        return immune;
    } catch (e) {
        return false;
    }
}

/* ══════════════════════════════════════════════ */
/* إخفاء الرسالة المسيئة                          */
/* ══════════════════════════════════════════════ */
async function hideOffensiveMessage(msg, reason) {
    var fbKey = extractMsgKey(msg);
    if (!fbKey) return false;
    var room = (typeof ChatState !== 'undefined' && ChatState.currentRoom) || 'general';
    try {
        var el = document.querySelector('[data-msg-id="' + fbKey + '"]');
        if (el) {
            el.style.display = 'none';
            el.classList.add('hidden-by-guardian');
        }
    } catch (e) {}
    try {
        await db.ref('room_messages/' + room + '/' + fbKey).update({
            hidden: true,
            hiddenBy: 'guardian',
            hiddenAt: Date.now(),
            hiddenReason: reason || 'auto'
        });
        return true;
    } catch (e) {
        console.warn('Guardian hide failed:', e.message);
        return false;
    }
}

/* ══════════════════════════════════════════════ */
/* كشف الكلمات                                    */
/* ══════════════════════════════════════════════ */
function _buildSeparatedRegex(word) {
    var chars = String(word).split('');
    var pattern = chars.map(function(ch) {
        return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('[\\s.\\-_*·+•]{1,2}');
    return new RegExp(pattern, 'i');
}

function _checkWords(text, wordList) {
    if (!text || !wordList.length) return null;
    if (_isWhitelisted(text)) return null;
    var normalized = normalizeArabic(text);
    var collapsedRaw = String(text).toLowerCase()
        .replace(/\u0640/g, '')
        .replace(/(.)\1{1,}/g, '$1');
    for (var i = 0; i < wordList.length; i++) {
        var raw = wordList[i];
        var w = normalizeArabic(raw);
        if (!w) continue;
        if (normalized.indexOf(w) !== -1) return raw;
        if (collapsedRaw.indexOf(w) !== -1) return raw;
        if (w.length >= 3) {
            try {
                if (_buildSeparatedRegex(w).test(normalized)) return raw;
            } catch (e) {}
        }
    }
    return null;
}

function containsBadWord(text) { return _checkWords(text, BotsState.badWords); }
function containsKickWord(text) { return _checkWords(text, BotsState.kickWords); }

/* ══════════════════════════════════════════════ */
/* حكواتي                                         */
/* ══════════════════════════════════════════════ */
function hasTrigger(text) {
    if (!text) return false;
    for (var i = 0; i < HAKAWATI_TRIGGERS.length; i++) {
        if (text.indexOf(HAKAWATI_TRIGGERS[i]) !== -1) return true;
    }
    return false;
}

function stripTriggers(text) {
    var t = text;
    for (var i = 0; i < HAKAWATI_TRIGGERS.length; i++) {
        t = t.split(HAKAWATI_TRIGGERS[i]).join(' ');
    }
    return t.replace(/\s+/g, ' ').trim();
}

function findReply(question) {
    if (!question) return null;
    var merged = {};
    Object.keys(DEFAULT_HAKAWATI).forEach(function(k) { merged[k] = DEFAULT_HAKAWATI[k]; });
    Object.keys(BotsState.memory.hakawati).forEach(function(k) {
        var v = BotsState.memory.hakawati[k];
        merged[k] = (typeof v === 'string') ? v : (v.text || '');
    });
    var text = normalizeArabic(question);
    if (!text) return null;
    var best = null, bestLen = 0;
    Object.keys(merged).forEach(function(k) {
        var key = normalizeArabic(k);
        if (key && text.indexOf(key) !== -1 && key.length > bestLen) {
            best = merged[k];
            bestLen = key.length;
        }
    });
    return best;
}

function findAutoReply(text) {
    if (!text) return null;
    var autoDB = BotsState.memory.hakawati_auto || {};
    var keys = Object.keys(autoDB);
    if (!keys.length) return null;
    var normalized = normalizeArabic(text);
    if (!normalized) return null;
    var best = null, bestIdx = Infinity, bestLen = 0, bestKey = '';
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var key = normalizeArabic(k);
        if (!key) continue;
        var idx = normalized.indexOf(key);
        if (idx === -1) continue;
        if (idx < bestIdx || (idx === bestIdx && key.length > bestLen)) {
            var v = autoDB[k];
            best = (typeof v === 'string') ? v : (v.text || '');
            bestIdx = idx;
            bestLen = key.length;
            bestKey = k;
        }
    }
    return best ? { reply: best, key: bestKey } : null;
}

function isAutoReplyCoolingDown(uid, key) {
    var k = uid + '::' + key;
    var t = BotsState.autoReplyCooldown[k];
    if (!t) return false;
    if (Date.now() - t >= AUTO_REPLY_COOLDOWN_MS) {
        delete BotsState.autoReplyCooldown[k];
        return false;
    }
    return true;
}

function setAutoReplyCooldown(uid, key) {
    BotsState.autoReplyCooldown[uid + '::' + key] = Date.now();
}

/* ══════════════════════════════════════════════ */
/* ⭐ v30: النقل القسري للغرف                     */
/* ══════════════════════════════════════════════ */
async function forceTransferToRoom(uid, roomId, opts) {
    opts = opts || {};
    if (!uid || !roomId) return false;
    try {
        var now = Date.now();
        /* حفظ الغرفة الحالية قبل النقل */
        if (opts.saveLastRoom !== false) {
            try {
                var cur = await db.ref('user_presence/' + uid + '/room').once('value');
                var curRoom = cur.val();
                if (curRoom && curRoom !== roomId) {
                    await db.ref('users/' + uid + '/lastRoomBeforeJail').set(curRoom).catch(function () {});
                }
            } catch (e) {}
        }
        /* التحديث الفعلي */
        await db.ref('user_presence/' + uid).update({
            state: 'online',
            room: roomId,
            lastChanged: now,
            forced: true,
            forcedBy: opts.byUid || null,
            forcedReason: opts.reason || 'system'
        });
        return true;
    } catch (e) {
        console.warn('forceTransfer error:', e);
        return false;
    }
}

/* ══════════════════════════════════════════════ */
/* ⭐ v30: السجن مع النقل القسري                  */
/* ══════════════════════════════════════════════ */
async function _applyJail(uid, name, duration, reason) {
    var now = Date.now();
    var jailUntil = now + duration;

    await db.ref('users/' + uid).update({
        isJailed: true,
        jailUntil: jailUntil,
        jailReason: reason || 'auto',
        jailReleasedAt: 0
    });

    /* النقل القسري */
    if (typeof QAMAR !== 'undefined' && QAMAR.JAIL_BEHAVIOR && QAMAR.JAIL_BEHAVIOR.FORCE_TRANSFER) {
        await forceTransferToRoom(uid, 'jail', {
            reason: 'jail',
            saveLastRoom: QAMAR.JAIL_BEHAVIOR.SAVE_LAST_ROOM !== false
        });
    }

    /* جدولة الإخراج */
    setTimeout(async () => {
        try {
            var s = await db.ref('users/' + uid + '/jailUntil').once('value');
            if (s.val() && Date.now() >= s.val()) {
                await db.ref('users/' + uid).update({
                    isJailed: false,
                    jailUntil: 0,
                    jailReleasedAt: Date.now()
                });
                /* إعادة لآخر غرفة */
                if (typeof QAMAR !== 'undefined' && QAMAR.JAIL_BEHAVIOR && QAMAR.JAIL_BEHAVIOR.AUTO_RETURN) {
                    var lastSnap = await db.ref('users/' + uid + '/lastRoomBeforeJail').once('value');
                    var backRoom = lastSnap.val() || 'general';
                    await db.ref('users/' + uid + '/lastRoomBeforeJail').remove().catch(function () {});
                    await forceTransferToRoom(uid, backRoom, {
                        reason: 'jail_release',
                        saveLastRoom: false,
                        byUid: 'bot_guardian'
                    });
                }
                var ns = await db.ref('users/' + uid + '/name').once('value');
                postBotMessage('guardian', '🔓 ' + (ns.val() || name || 'المسجون') + ' خرج من السجن', 'jail');
                _logAudit('jail_release', { uid: uid, name: name || '', auto: true });
            }
        } catch (e) { console.warn('jail release error:', e); }
    }, duration + 2000);

    _logAudit('jail_apply', {
        uid: uid,
        name: name || '',
        duration: duration,
        reason: reason || 'auto'
    });
}

/* ══════════════════════════════════════════════ */
/* طرد كامل (permanent ban)                       */
/* ══════════════════════════════════════════════ */
async function _applyPermanentBan(uid, name, reason, byUid) {
    var now = Date.now();
    await db.ref('users/' + uid).update({
        isBanned: true,
        bannedUntil: now + PERMANENT_BAN_MS,
        permanentBan: true,
        banReason: reason || 'permanent',
        lastKickAt: now
    });

    /* استخدام DeviceGuard لحرق البصمة */
    try {
        if (window.DeviceGuard && typeof window.DeviceGuard.ban === 'function') {
            await window.DeviceGuard.ban(uid, byUid, 'system', reason || 'permanent');
        }
    } catch (e) { console.warn('DeviceGuard.ban failed:', e); }

    _logAudit('permanent_ban', {
        uid: uid,
        name: name || '',
        reason: reason || 'permanent',
        byUid: byUid || null
    });
}

/* ══════════════════════════════════════════════ */
/* الترحيب — السفير                              */
/* ══════════════════════════════════════════════ */
async function tryWelcomeUser(uid, roomId) {
    try {
        var userSnap = await db.ref('users/' + uid).once('value');
        var userData = userSnap.val();
        if (!userData) return;
        if (userData.invisible === true && (userData.rank === 'King' || userData.rank === 'Queen')) return;
        var now = Date.now();
        var result = await db.ref('bot_locks/welcome/' + roomId + '/' + uid).transaction(function(c) {
            if (c && (now - (c.at || 0)) < WELCOME_COOLDOWN_MS) return;
            return { at: now, by: 'ambassador' };
        });
        if (!result || result.committed !== true) return;
        var roomName = (typeof QAMAR !== 'undefined' && QAMAR.ROOMS && QAMAR.ROOMS[roomId])
            ? QAMAR.ROOMS[roomId].name
            : roomId;
        var userName = userData.name || 'زائر';
        var avatar = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userName) + '&background=111&color=ffd700&bold=true&size=64';
        var msgRef = db.ref('room_messages/' + roomId).push();
        await msgRef.set({
            senderUid: 'bot_ambassador',
            senderName: 'السفير',
            senderCode: null,
            senderAvatar: avatar,
            senderColor: '#d4af37',
            senderRank: 'Bot',
            senderFrame: 'none',
            isBot: true,
            botId: 'ambassador',
            isWelcome: true,
            welcomeFor: uid,
            welcomeName: userName,
            roomId: roomId,
            roomName: roomName,
            text: '🚪 انضم ' + userName + ' إلى ' + roomName,
            mentions: [],
            replyTo: null,
            time: firebase.database.ServerValue.TIMESTAMP,
            edited: false,
            deleted: false
        });
    } catch (e) {}
}

function handlePresenceChild(uid, p) {
    if (!p) return;
    var me = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
    if (!me) return;
    var prev = BotsState.lastUserRooms[uid];
    BotsState.lastUserRooms[uid] = { state: p.state, room: p.room, lastChanged: p.lastChanged };
    if (uid === me.uid) return;
    if (p.state !== 'online') return;
    var myRoom = (typeof ChatState !== 'undefined' && ChatState.currentRoom) || 'general';
    if (p.room !== myRoom) return;
    if (Date.now() - (p.lastChanged || 0) > 60000) return;
    var isNewJoin = !prev || prev.state !== 'online' || prev.room !== p.room;
    if (isNewJoin) tryWelcomeUser(uid, myRoom);
}

async function setupAmbassadorListener() {
    if (typeof db === 'undefined' || !db) { setTimeout(setupAmbassadorListener, 1500); return; }
    var me = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
    if (!me) { setTimeout(setupAmbassadorListener, 1500); return; }
    if (BotsState.presenceListener) {
        try { BotsState.presenceListener.off(); } catch(e) {}
        BotsState.presenceListener = null;
    }
    try {
        var snap = await db.ref('user_presence').once('value');
        var presences = snap.val() || {};
        Object.keys(presences).forEach(function(uid) {
            BotsState.lastUserRooms[uid] = presences[uid];
        });
    } catch (e) {}
    BotsState.presenceListener = db.ref('user_presence');
    BotsState.presenceListener.on('child_added', function(s) { handlePresenceChild(s.key, s.val()); });
    BotsState.presenceListener.on('child_changed', function(s) { handlePresenceChild(s.key, s.val()); });
    BotsState.presenceListener.on('child_removed', function(s) { delete BotsState.lastUserRooms[s.key]; });
    BotsState.ambassadorReady = true;
}

function handleWelcomeMessage(msg) {
    var me = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
    if (!me) return;
    var currentRoom = (typeof ChatState !== 'undefined' && ChatState.currentRoom) || 'general';
    if (msg.roomId !== currentRoom) return;
    var msgAge = Date.now() - (typeof msg.time === 'number' ? msg.time : Date.now());
    if (msgAge > 60000) return;
    playWelcomeSound();
    if (msg.welcomeFor === me.uid) showWelcomeModal(msg);
}

function showWelcomeModal(msg) {
    if (document.getElementById('qamar-welcome-modal')) return;
    var m = document.createElement('div');
    m.id = 'qamar-welcome-modal';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);backdrop-filter:blur(4px);display:flex;justify-content:center;align-items:center;z-index:99999;font-family:Cairo,sans-serif;direction:rtl;padding:20px;';
    m.innerHTML =
        '<div style="background:linear-gradient(135deg,#110724,#1a0e2e);border:2px solid #ffd700;border-radius:20px;padding:28px 24px;max-width:340px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.9),0 0 40px rgba(255,215,0,0.3);">' +
            '<div style="font-size:56px;line-height:1;margin-bottom:14px;filter:drop-shadow(0 0 15px rgba(255,215,0,0.6));">🌟</div>' +
            '<div style="color:#ffd700;font-size:13px;font-weight:900;letter-spacing:1px;margin-bottom:12px;">أهلاً وسهلاً بك</div>' +
            '<div style="color:#fff;font-size:22px;font-weight:900;margin-bottom:8px;text-shadow:0 2px 8px rgba(0,0,0,0.9);">' + escapeHtml(msg.welcomeName || '') + '</div>' +
            '<div style="color:#ccc;font-size:14px;margin-bottom:20px;">في ' + escapeHtml(msg.roomName || '') + '</div>' +
            '<button id="qamar-welcome-ok" type="button" style="padding:11px 32px;background:#ffd700;color:#000;border:none;border-radius:12px;font-weight:900;font-size:14px;cursor:pointer;font-family:inherit;box-shadow:0 4px 15px rgba(255,215,0,0.4);">حسناً</button>' +
        '</div>';
    document.body.appendChild(m);
    var close = function() { if (m.parentNode) m.parentNode.removeChild(m); };
    document.getElementById('qamar-welcome-ok').onclick = close;
    setTimeout(close, 10000);
}

/* ══════════════════════════════════════════════ */
/* initBots                                       */
/* ══════════════════════════════════════════════ */
function initBots() {
    if (BotsState.initialized) return;
    if (typeof db === 'undefined' || !db) { console.warn('🤖 initBots: db not ready'); return; }
    var user = getCurrentUser();
    if (!user) { console.warn('🤖 initBots: no user'); return; }
    BotsState.initialized = true;
    console.log('🤖 bots.js v30 initialized');

    db.ref('bot_memory/badWords').on('value', s => {
        var arr = toArray(s.val());
        var words = arr.map(it => (typeof it === 'string') ? it : (it.text || '')).filter(Boolean);
        if (words.length > 0) BotsState.badWords = words;
    });
    db.ref('bot_memory/kickWords').on('value', s => {
        var arr = toArray(s.val());
        var words = arr.map(it => (typeof it === 'string') ? it : (it.text || '')).filter(Boolean);
        if (words.length > 0) BotsState.kickWords = words;
    });
    db.ref('bot_memory/hakawati').on('value', s => { BotsState.memory.hakawati = s.val() || {}; });
    db.ref('bot_memory/hakawati_auto').on('value', s => { BotsState.memory.hakawati_auto = s.val() || {}; });
    db.ref('bot_memory/quiz').on('value', s => { BotsState.memory.quiz = toArray(s.val()); });
    db.ref('bot_memory/islamic').on('value', s => {
        var arr = toArray(s.val());
        BotsState.memory.islamic = arr.map(it => (typeof it === 'string') ? it : (it.text || '')).filter(Boolean);
    });
    db.ref('bot_locks/quiz_current').on('value', s => {
        var v = s.val();
        BotsState.currentQuiz = (!v || v.closed) ? null : v;
    }, err => console.warn('⚠️ quiz_current:', err.message));

    setupHiddenMessagesListener();
    setupAmbassadorListener();

    var rankLevel = (typeof QAMAR !== 'undefined' && QAMAR.getRankLevel) ? QAMAR.getRankLevel(user.rank) : 0;
    if (rankLevel >= 65) {
        BotsState.autoInterval = setInterval(autoTick, 30000);
        setTimeout(autoTick, 3000);
    }

    setupKingPanel();
}

function setupHiddenMessagesListener() {
    if (BotsState.hiddenListener) {
        try { BotsState.hiddenListener.off(); } catch(e) {}
        BotsState.hiddenListener = null;
    }
    var currentRoom = (typeof ChatState !== 'undefined' && ChatState.currentRoom) || 'general';
    var ref = db.ref('room_messages/' + currentRoom).limitToLast(50);
    var applyHidden = function(sKey, msg) {
        if (!msg || !msg.hidden) return;
        var el = document.querySelector('[data-msg-id="' + sKey + '"]');
        if (el && !el.classList.contains('hidden-by-guardian')) {
            el.style.display = 'none';
            el.classList.add('hidden-by-guardian');
        }
    };
    ref.on('child_added', function(s) { applyHidden(s.key, s.val()); });
    ref.on('child_changed', function(s) { applyHidden(s.key, s.val()); });
    BotsState.hiddenListener = ref;
}

/* ══════════════════════════════════════════════ */
/* autoTick + post                                */
/* ══════════════════════════════════════════════ */
async function autoTick() {
    if (typeof db === 'undefined' || !db) return;
    if (!getCurrentUser()) return;
    await tryPost('islamic');
    await tryPost('quiz');
}

async function tryPost(botId) {
    var interval = AUTO_TIMING[botId];
    var now = Date.now();
    var localKey = 'qamar_auto_' + botId;
    var lastLocal = parseInt(localStorage.getItem(localKey) || '0');
    var isFirst = (lastLocal === 0);
    if (!isFirst && now - lastLocal < interval) return;
    var canPost = false;
    try {
        var result = await db.ref('bot_locks/auto_' + botId).transaction(c => {
            if (!c) return { at: now };
            if (now - (c.at || 0) >= interval) return { at: now };
            return;
        });
        canPost = result.committed === true;
    } catch (e) { canPost = true; }
    if (!canPost) return;
    localStorage.setItem(localKey, String(now));
    if (botId === 'islamic') postIslamic();
    else if (botId === 'quiz') postQuiz();
}

function postIslamic() {
    var firebaseItems = BotsState.memory.islamic.length > 0 ? BotsState.memory.islamic : [];
    var library = (typeof window !== 'undefined' && window.ISLAMIC_LIBRARY) ? window.ISLAMIC_LIBRARY : [];
    var fallback = DEFAULT_ISLAMIC;
    var all = [];
    if (library.length > 0) all = all.concat(library);
    if (firebaseItems.length > 0) all = all.concat(firebaseItems);
    if (all.length === 0) all = fallback.slice();
    var lastKey = 'qamar_last_islamic';
    var lastText = localStorage.getItem(lastKey) || '';
    var pick = '';
    for (var attempt = 0; attempt < 5; attempt++) {
        pick = all[Math.floor(Math.random() * all.length)];
        if (pick !== lastText) break;
    }
    localStorage.setItem(lastKey, pick);
    postBotMessage('islamic', pick, 'islamic');
}

function buildHint(answer) {
    if (!answer) return '؟؟؟';
    var str = String(answer);
    var result = '';
    for (var i = 0; i < str.length; i++) {
        var ch = str.charAt(i);
        if (ch === ' ') { result += ' '; continue; }
        if (i % 2 === 0) result += ch;
        else result += '--';
    }
    return result;
}

function postQuiz() {
    var list = BotsState.memory.quiz.length > 0 ? BotsState.memory.quiz : DEFAULT_QUIZ;
    var q = list[Math.floor(Math.random() * list.length)];
    var text = '🎯 سؤال جديد!\n\n' + q.q + '\n\n⏳ أول 3 إجابات صحيحة = 10 / 5 / 2 نقطة';
    var startedAt = Date.now();
    var answersArr = toArray(q.answers).map(x => String(x));
    var firstAnswer = answersArr[0] || '';
    db.ref('bot_locks/quiz_current').set({
        question: q.q,
        answers: answersArr,
        startedAt: startedAt,
        winnersCount: 0,
        winners: {},
        hintPosted: false,
        closed: false,
        at: startedAt
    }).catch(e => console.warn('❌ Quiz save failed:', e.message));
    postBotMessage('quiz', text, 'quiz');
    setTimeout(async function() {
        try {
            var s = await db.ref('bot_locks/quiz_current').once('value');
            var c = s.val();
            if (!c || c.startedAt !== startedAt || c.closed) return;
            if ((c.winnersCount || 0) === 0) {
                var hint = buildHint(firstAnswer);
                postBotMessage('quiz', '💡 ' + hint, 'quiz');
                db.ref('bot_locks/quiz_current').update({ hintPosted: true }).catch(function(){});
                setTimeout(async function() {
                    try {
                        var s2 = await db.ref('bot_locks/quiz_current').once('value');
                        var c2 = s2.val();
                        if (!c2 || c2.startedAt !== startedAt || c2.closed) return;
                        postBotMessage('quiz', '💡 الإجابة: ' + firstAnswer, 'quiz');
                        db.ref('bot_locks/quiz_current').update({ closed: true }).catch(function(){});
                        setTimeout(function() {
                            db.ref('bot_locks/quiz_current').remove().catch(function(){});
                        }, 5000);
                    } catch (e) {}
                }, QUIZ_REVEAL_AT_MS - QUIZ_HINT_AT_MS);
            } else {
                postBotMessage('quiz', '💡 الإجابة: ' + firstAnswer, 'quiz');
                db.ref('bot_locks/quiz_current').update({ closed: true }).catch(function(){});
                setTimeout(function() {
                    db.ref('bot_locks/quiz_current').remove().catch(function(){});
                }, 5000);
            }
        } catch (e) {}
    }, QUIZ_HINT_AT_MS);
}

function postBotMessage(key, text, roomId) {
    if (typeof db === 'undefined' || !db) return;
    var bot = QAMAR.BOTS[key.toUpperCase()];
    if (!bot) return;
    var room = roomId || 'general';
    var user = getCurrentUser();
    if (!user || !user.uid) return;
    var botAvatar = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(bot.name) + '&background=111&color=ffd700&bold=true&size=64';
    db.ref('room_messages/' + room).push({
        senderUid: 'bot_' + bot.id,
        senderName: bot.name,
        senderCode: null,
        senderAvatar: botAvatar,
        senderColor: bot.color,
        senderRank: 'Bot',
        senderFrame: 'none',
        isBot: true,
        botId: bot.id,
        text: text,
        mentions: [],
        replyTo: null,
        time: firebase.database.ServerValue.TIMESTAMP,
        edited: false,
        deleted: false
    }).catch(e => console.warn('❌ Bot post failed:', e.message));
}

function handleBotCommand(text) {
    var user = getCurrentUser();
    if (!user) return;
    var cmd = text.slice(1).trim().split(/\s+/);
    var command = cmd[0].toLowerCase();
    var args = cmd.slice(1).join(' ');
    var room = (typeof ChatState !== 'undefined' && ChatState.currentRoom) || 'general';
    switch (command) {
        case 'مساعدة': case 'help': case 'اوامر': case 'أوامر':
            postBotMessage('hakawati', '🌙 الأوامر:\n!مساعدة\n!نقاطي\n!نكتة\n!دعاء\n!سؤال\nحكواتي سؤالك', room); break;
        case 'نقاطي': case 'نقاط':
            db.ref('bot_data/quiz/scores/' + user.uid).once('value').then(s => {
                var p = s.val() || 0;
                postBotMessage('quiz', '🏆 نقاطك: ' + p + '\n⭐ مستواك: ' + (Math.floor(p / 100) + 1), room);
            }); break;
        case 'دعاء': postIslamic(); break;
        case 'نكتة':
            var jokes = ['واحد راح للطبيب: كل ما آكل بيض تطلع بقع. قاله: جرب آكل بيض بيض! 🥚', 'واحد بلع ساعة، صار يطلع منو تيك توك! ⏰'];
            postBotMessage('hakawati', '😄 ' + jokes[Math.floor(Math.random() * jokes.length)], room); break;
        case 'سؤال': postQuiz(); break;
        case 'حكواتي':
            if (args) {
                var r = findReply(args);
                if (r) setTimeout(() => postBotMessage('hakawati', '📖 ' + r, room), 500);
            } else postBotMessage('hakawati', '📖 اكتب: حكواتي سؤالك', room);
            break;
        default: postBotMessage('hakawati', '❓ أمر غير معروف: ' + command, room);
    }
}

/* ══════════════════════════════════════════════ */
/* كلمة طرد → حظر دائم + بصمة                     */
/* ══════════════════════════════════════════════ */
async function handleKickWord(msg, kickWord) {
    try {
        var immune = await isImmuneUser(msg.senderUid);
        if (immune) return;
        await hideOffensiveMessage(msg, 'kick_word:' + kickWord);

        var userSnap = await db.ref('users/' + msg.senderUid).once('value');
        var userData = userSnap.val() || {};
        var kickCount = userData.kickCount || 0;

        await db.ref('users/' + msg.senderUid).update({
            kickCount: kickCount + 1,
            kickReason: kickWord,
            lastKickAt: Date.now()
        });

        /* ⭐ v30: permanent ban + device */
        await _applyPermanentBan(msg.senderUid, msg.senderName, 'kick_word:' + kickWord, null);

        var room = (typeof ChatState !== 'undefined' && ChatState.currentRoom) || 'general';
        postBotMessage('guardian',
            '🚪 السجان طرد ' + msg.senderName + ' نهائياً!\n' +
            '❌ كلمة محظورة: ' + maskWord(kickWord) + '\n' +
            '⏰ الحظر: دائم + بصمة الجهاز\n' +
            '🔁 رقم المخالفة: ' + (kickCount + 1), room);

        playPoliceSiren();

        var me = getCurrentUser();
        if (me && me.uid === msg.senderUid) {
            setTimeout(() => {
                if (typeof showToast === 'function') showToast('fa-ban', '🚪 تم طردك نهائياً!');
                try {
                    if (typeof cleanupAllListeners === 'function') cleanupAllListeners();
                    if (typeof logout === 'function') logout();
                } catch (e) {}
                setTimeout(() => location.reload(), 2500);
            }, 1500);
        }
    } catch (e) { console.warn('handleKickWord error:', e); }
}

/* ══════════════════════════════════════════════ */
/* كلمة سجن → تصاعدي → 3 → حظر                    */
/* ══════════════════════════════════════════════ */
async function handleBadWord(msg, badWord) {
    try {
        var immune = await isImmuneUser(msg.senderUid);
        if (immune) return;
        await hideOffensiveMessage(msg, 'bad_word:' + badWord);

        await db.ref('users/' + msg.senderUid + '/warnings').transaction(c => (c || 0) + 1);
        var userSnap = await db.ref('users/' + msg.senderUid).once('value');
        var userData = userSnap.val() || {};
        var warnCount = userData.warnings || 0;
        var jailCount = userData.jailCount || 0;
        var lastJailAt = userData.lastJailAt || 0;
        var now = Date.now();

        if (jailCount >= JAILS_BEFORE_KICK) {
            postBotMessage('guardian',
                '🚫 السجان حظر ' + msg.senderName + ' نهائياً!\n' +
                '⚠️ بعد 3 سجنات\n' +
                '⏰ الحظر: دائم + بصمة',
                (typeof ChatState !== 'undefined' && ChatState.currentRoom) || 'general');

            await _applyPermanentBan(msg.senderUid, msg.senderName, '3_jails_exceeded', null);

            playPoliceSiren();

            var me0 = getCurrentUser();
            if (me0 && me0.uid === msg.senderUid) {
                setTimeout(function() {
                    if (typeof showToast === 'function') showToast('fa-ban', '🚫 تم حظرك نهائياً!');
                    try {
                        if (typeof cleanupAllListeners === 'function') cleanupAllListeners();
                        if (typeof logout === 'function') logout();
                    } catch (e) {}
                    setTimeout(function() { location.reload(); }, 2500);
                }, 1500);
            }
            return;
        }

        var JAIL = (typeof QAMAR !== 'undefined' && QAMAR.JAIL) ? QAMAR.JAIL : {
            FIRST_OFFENSE_MS: 2 * 60 * 1000, ESCALATION_WINDOW_MS: 10 * 60 * 1000,
            MAX_AUTO_JAIL_MS: 15 * 60 * 1000, ESCALATION_MULTIPLIER: 2
        };
        var withinWindow = (now - lastJailAt) < JAIL.ESCALATION_WINDOW_MS;
        var duration = (withinWindow && jailCount > 0)
            ? JAIL.FIRST_OFFENSE_MS * Math.pow(JAIL.ESCALATION_MULTIPLIER, jailCount)
            : JAIL.FIRST_OFFENSE_MS;
        if (!withinWindow) jailCount = 0;
        duration = Math.min(duration, JAIL.MAX_AUTO_JAIL_MS);
        var newJailCount = jailCount + 1;
        var minutes = Math.ceil(duration / 60000);

        await db.ref('users/' + msg.senderUid).update({
            jailCount: newJailCount,
            lastJailAt: now
        });

        /* ⭐ v30: السجن + النقل القسري */
        await _applyJail(msg.senderUid, msg.senderName, duration, badWord);

        var room = (typeof ChatState !== 'undefined' && ChatState.currentRoom) || 'general';
        var remainingJails = JAILS_BEFORE_KICK - newJailCount;
        var warningLine = remainingJails > 0
            ? '⚠️ تبقّى ' + remainingJails + ' سجن ' + (remainingJails === 1 ? '' : 'ات') + ' قبل الطرد'
            : '🚨 هذا آخر تحذير قبل الطرد الدائم!';

        postBotMessage('guardian',
            '🚔 السجان قبض على ' + msg.senderName + '\n' +
            '❌ كلمة ممنوعة: ' + maskWord(badWord) + '\n' +
            '⚠️ التحذير رقم: ' + warnCount + '\n' +
            '⛓️ مدة السجن: ' + minutes + ' دقيقة\n' +
            '🚪 تم نقله إلى السجن\n' + warningLine, room);

        playPoliceSiren();

        /* إشعار الشخص المسجون */
        var me = getCurrentUser();
        if (me && me.uid === msg.senderUid) {
            setTimeout(function() {
                if (typeof showToast === 'function') showToast('fa-lock', '⛓️ تم سجنك ' + minutes + ' دقيقة');
            }, 800);
        }
    } catch (e) { console.warn('handleBadWord error:', e); }
}

/* ══════════════════════════════════════════════ */
/* processIncomingMessage                        */
/* ══════════════════════════════════════════════ */
async function processIncomingMessage(msg) {
    try {
        if (!msg) return;
        if (msg.isWelcome && msg.welcomeFor) { handleWelcomeMessage(msg); return; }
        if (msg.isBot) return;
        if (!msg.text) return;
        if (typeof db === 'undefined' || !db) return;
        var text = String(msg.text).trim();
        if (text.charAt(0) === '!') return;
        if (typeof msg.time === 'number' && msg.time > 0) {
            if (Date.now() - msg.time > AGE_LIMIT_MS) return;
        }
        var key = msg._key || (msg.senderUid + '_' + msg.time);
        var safeKey = String(key).replace(/[.#$\/\[\]]/g, '_').substring(0, 100);
        if (_processedMsgs.has(safeKey)) return;
        _processedMsgs.add(safeKey);
        pruneProcessedMsgs();
        try {
            var lockRes = await db.ref('bot_locks/msgs/' + safeKey).transaction(c => {
                if (c) return;
                return { at: Date.now() };
            });
            if (!lockRes || lockRes.committed !== true) return;
        } catch (e) {}

        var kick = containsKickWord(text);
        if (kick) { await handleKickWord(msg, kick); return; }
        var bad = containsBadWord(text);
        if (bad) { await handleBadWord(msg, bad); return; }

        if (hasTrigger(text)) {
            var q = stripTriggers(text);
            if (!q) return;
            var reply = findReply(q);
            if (reply) {
                var room = (typeof ChatState !== 'undefined' && ChatState.currentRoom) || 'general';
                setTimeout(() => postBotMessage('hakawati', '📖 ' + reply, room), 900);
            } else {
                var user = getCurrentUser();
                db.ref('bot_learning/pending').push({
                    question: q, fromName: (user && user.name) || 'مجهول',
                    fromUid: (user && user.uid) || '',
                    room: (typeof ChatState !== 'undefined' && ChatState.currentRoom) || 'general',
                    time: firebase.database.ServerValue.TIMESTAMP
                }).catch(() => {});
            }
            return;
        }

        var autoResult = findAutoReply(text);
        if (autoResult) {
            if (!isAutoReplyCoolingDown(msg.senderUid, autoResult.key)) {
                setAutoReplyCooldown(msg.senderUid, autoResult.key);
                var aroom = (typeof ChatState !== 'undefined' && ChatState.currentRoom) || 'general';
                setTimeout(() => postBotMessage('hakawati', '📖 ' + autoResult.reply, aroom), 700);
            }
        }

        try {
            var qSnap = await db.ref('bot_locks/quiz_current').once('value');
            var qz = qSnap.val();
            if (!qz || qz.closed) return;
            if (Date.now() - (qz.startedAt || 0) > QUIZ_WINDOW_MS) return;
            var answersArr = toArray(qz.answers).map(x => String(x));
            var match = answersArr.some(a => isAnswerMatch(text, a));
            if (!match) return;
            var winRes = await db.ref('bot_locks/quiz_current/winnersCount').transaction(function(c) {
                var n = (c || 0);
                if (n >= QUIZ_MAX_WINNERS) return;
                return n + 1;
            });
            if (!winRes || winRes.committed !== true) return;
            var rank = winRes.snapshot.val();
            var isAfterHint = (qz.hintPosted === true);
            var pointsTable = isAfterHint ? QUIZ_POINTS_HALF : QUIZ_POINTS;
            var points = pointsTable[rank] || 0;
            db.ref('bot_locks/quiz_current/winners/' + msg.senderUid).set({
                rank: rank, name: msg.senderName, at: Date.now(), points: points
            }).catch(function(){});
            await db.ref('bot_data/quiz/scores/' + msg.senderUid).transaction(c => (c || 0) + points).catch(() => {});
            var emoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
            postBotMessage('quiz', emoji + ' ' + msg.senderName + ' — +' + points + ' نقطة', 'quiz');
            if (rank === 3) {
                var firstAns = answersArr[0] || '';
                setTimeout(function() {
                    postBotMessage('quiz', '💡 الإجابة: ' + firstAns, 'quiz');
                    db.ref('bot_locks/quiz_current').update({ closed: true }).catch(function(){});
                    setTimeout(function() {
                        db.ref('bot_locks/quiz_current').remove().catch(function(){});
                    }, 5000);
                }, 800);
            }
        } catch (e) {}
    } catch (err) { console.error('❌ processIncomingMessage error:', err); }
}

/* ══════════════════════════════════════════════ */
/* onRoomChanged                                  */
/* ══════════════════════════════════════════════ */
function onRoomChanged(roomId) {
    if (typeof db === 'undefined' || !db) return;
    setupHiddenMessagesListener();
    var me = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
    if (me && me.uid && roomId) {
        BotsState.lastUserRooms[me.uid] = {
            state: 'online', room: roomId, lastChanged: Date.now()
        };
        setTimeout(function() { tryWelcomeUser(me.uid, roomId); }, 800);
    }
}

/* ══════════════════════════════════════════════ */
/* لوحة الملك                                     */
/* ══════════════════════════════════════════════ */
function setupKingPanel() {
    var user = getCurrentUser();
    if (!user || user.rank !== 'King') return;
    setTimeout(insertKingBtn, 1500);
    var list = document.getElementById('rooms-list');
    if (!list) { setTimeout(setupKingPanel, 2000); return; }
    if (BotsState.kingObs) { try { BotsState.kingObs.disconnect(); } catch (e) {} }
    BotsState.kingObs = new MutationObserver(() => { if (!document.getElementById('king-bot-panel-btn')) insertKingBtn(); });
    BotsState.kingObs.observe(list, { childList: true, subtree: false });
}

function insertKingBtn() {
    var list = document.getElementById('rooms-list');
    if (!list || document.getElementById('king-bot-panel-btn')) return;
    var btn = document.createElement('div');
    btn.id = 'king-bot-panel-btn';
    btn.className = 'sidebar-item';
    btn.style.cssText = 'background:linear-gradient(135deg,#8b0000,#d4af37);color:#fff;font-weight:900;cursor:pointer;padding:12px;margin-bottom:8px;border-radius:10px;border:2px solid #ffd700;text-align:center;';
    btn.textContent = '🤖 لوحة الملك';
    btn.onclick = e => { e.preventDefault(); e.stopPropagation(); openBotManager(); };
    list.insertBefore(btn, list.firstChild);
}

function openBotManager() {
    var m = document.getElementById('bot-manager-modal');
    if (m) { m.style.display = 'flex'; renderTab('hakawati'); return; }
    m = document.createElement('div');
    m.id = 'bot-manager-modal';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);display:flex;justify-content:center;align-items:center;z-index:99999;padding:10px;direction:rtl;font-family:Cairo,sans-serif;';
    m.innerHTML =
        '<div style="background:#110724;border:2px solid #ffd700;border-radius:16px;width:100%;max-width:540px;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;">' +
            '<div style="padding:14px;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center;">' +
                '<h3 style="color:#ffd700;margin:0;font-size:16px;">🤖 لوحة الملك</h3>' +
                '<button onclick="closeBotManager()" style="background:none;border:none;color:#fff;font-size:24px;cursor:pointer;">✕</button>' +
            '</div>' +
            '<div id="bm-tabs" style="display:flex;border-bottom:1px solid #333;flex-wrap:wrap;">' +
                '<button class="bm-tab" data-tab="hakawati" style="flex:1;min-width:65px;padding:10px;background:none;border:none;color:#fff;font-weight:900;cursor:pointer;font-family:inherit;font-size:11px;">🎭 حكواتي</button>' +
                '<button class="bm-tab" data-tab="hakawati_auto" style="flex:1;min-width:65px;padding:10px;background:none;border:none;color:#fff;font-weight:900;cursor:pointer;font-family:inherit;font-size:11px;">🔔 ردود تلقائية</button>' +
                '<button class="bm-tab" data-tab="quiz" style="flex:1;min-width:65px;padding:10px;background:none;border:none;color:#fff;font-weight:900;cursor:pointer;font-family:inherit;font-size:11px;">🎯 مسابقات</button>' +
                '<button class="bm-tab" data-tab="islamic" style="flex:1;min-width:65px;padding:10px;background:none;border:none;color:#fff;font-weight:900;cursor:pointer;font-family:inherit;font-size:11px;">🌙 إسلامي</button>' +
                '<button class="bm-tab" data-tab="badwords" style="flex:1;min-width:65px;padding:10px;background:none;border:none;color:#fff;font-weight:900;cursor:pointer;font-family:inherit;font-size:11px;">🚔 سجن</button>' +
                '<button class="bm-tab" data-tab="kickwords" style="flex:1;min-width:65px;padding:10px;background:none;border:none;color:#fff;font-weight:900;cursor:pointer;font-family:inherit;font-size:11px;">🚪 طرد</button>' +
                '<button class="bm-tab" data-tab="pending" style="flex:1;min-width:65px;padding:10px;background:none;border:none;color:#fff;font-weight:900;cursor:pointer;font-family:inherit;font-size:11px;">📥 جديدة</button>' +
            '</div>' +
            '<div id="bm-content" style="flex:1;overflow-y:auto;padding:14px;"></div>' +
        '</div>';
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) closeBotManager(); });
    m.querySelectorAll('.bm-tab').forEach(t => {
        t.onclick = () => {
            m.querySelectorAll('.bm-tab').forEach(x => { x.style.background = 'none'; x.style.color = '#fff'; });
            t.style.background = '#ffd700'; t.style.color = '#000';
            renderTab(t.getAttribute('data-tab'));
        };
    });
    var first = m.querySelector('[data-tab="hakawati"]');
    if (first) { first.style.background = '#ffd700'; first.style.color = '#000'; }
    renderTab('hakawati');
}

function closeBotManager() {
    var m = document.getElementById('bot-manager-modal');
    if (m) m.style.display = 'none';
}

/* ⭐ v30: importArabicWordList محسّن */
async function importArabicWordList(tab, btnParam) {
    if (!confirm('📥 استيراد قائمة كلمات عربية جاهزة؟\n\n⚠️ القائمة تحتوي كلمات نابية.')) return;
    var btn = btnParam || document.getElementById('kr-bm-import') || document.getElementById('kr-guardian-import');
    var originalText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }
    try {
        var url = (typeof QAMAR !== 'undefined' && QAMAR.SWEAR_WORDS_SOURCES)
            ? QAMAR.SWEAR_WORDS_SOURCES.arabic
            : 'https://raw.githubusercontent.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/master/ar';
        var res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var text = await res.text();
        var words = text.split('\n').map(w => w.trim()).filter(w => w.length > 1 && !w.startsWith('#'));
        if (words.length === 0) throw new Error('القائمة فارغة');
        var path = tab === 'badwords' ? 'bot_memory/badWords' : 'bot_memory/kickWords';
        var currentSnap = await db.ref(path).once('value');
        var currentData = currentSnap.val() || {};
        var currentSet = new Set();
        Object.values(currentData).forEach(item => {
            var txt = (typeof item === 'string') ? item : (item.text || '');
            if (txt) currentSet.add(txt);
        });
        var added = 0;
        var promises = [];
        words.forEach(word => {
            if (!currentSet.has(word)) {
                promises.push(db.ref(path).push({ text: word }));
                added++;
            }
        });
        await Promise.all(promises);
        if (typeof showToast === 'function') showToast('fa-check', '✅ تم استيراد ' + added + ' كلمة');
        renderTab(tab);
    } catch (e) {
        if (typeof showToast === 'function') showToast('fa-times', '⚠️ ' + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = originalText || '📥 استيراد'; }
    }
}

function renderTab(tab) {
    var c = document.getElementById('bm-content');
    if (!c) return;
    c.innerHTML = '';
    var info = document.createElement('div');
    info.style.cssText = 'color:#ffd700;font-size:12px;margin-bottom:10px;text-align:center;padding:8px;background:rgba(255,215,0,0.1);border-radius:8px;line-height:1.6;white-space:pre-line;';
    info.textContent =
        tab === 'hakawati' ? '🎭 كلمات حكواتي (تحتاج نداء)'
        : tab === 'hakawati_auto' ? '🔔 ردود تلقائية'
        : tab === 'quiz' ? '🎯 أسئلة المسابقة'
        : tab === 'islamic' ? '🌙 أدعية وأذكار'
        : tab === 'badwords' ? '🚔 كلمات السجن → عقوبات تصاعدية'
        : tab === 'kickwords' ? '🚪 كلمات الطرد → حظر دائم + بصمة'
        : '📥 أسئلة معلقة';
    c.appendChild(info);
    if (tab === 'badwords' || tab === 'kickwords') {
        var importBtn = document.createElement('button');
        importBtn.id = 'kr-bm-import';
        importBtn.textContent = '📥 استيراد قائمة عربية جاهزة';
        importBtn.style.cssText = 'width:100%;padding:12px;background:linear-gradient(135deg,#3b82f6,#1e40af);color:#fff;border:none;border-radius:10px;font-weight:900;font-size:14px;cursor:pointer;margin-bottom:8px;font-family:inherit;';
        importBtn.onclick = function () { importArabicWordList(tab, importBtn); };
        c.appendChild(importBtn);
    }
    if (tab !== 'pending') {
        var add = document.createElement('button');
        add.textContent = '➕ إضافة';
        add.style.cssText = 'width:100%;padding:12px;background:#84cc16;color:#fff;border:none;border-radius:10px;font-weight:900;font-size:14px;cursor:pointer;margin-bottom:12px;font-family:inherit;';
        add.onclick = () => addItem(tab);
        c.appendChild(add);
    } else {
        var clr = document.createElement('button');
        clr.textContent = '🗑️ مسح الكل';
        clr.style.cssText = 'width:100%;padding:10px;background:#ef4444;color:#fff;border:none;border-radius:10px;font-weight:900;font-size:13px;cursor:pointer;margin-bottom:12px;font-family:inherit;';
        clr.onclick = () => { if (!confirm('حذف الكل؟')) return; db.ref('bot_learning/pending').remove().then(() => renderTab('pending')); };
        c.appendChild(clr);
    }
    var box = document.createElement('div');
    c.appendChild(box);
    if (tab === 'hakawati') {
        db.ref('bot_memory/hakawati').once('value').then(s => {
            var fb = s.val() || {};
            var h = document.createElement('div');
            h.style.cssText = 'color:#ffd700;font-size:12px;font-weight:900;margin:8px 0 6px;padding:6px;background:rgba(255,215,0,0.08);border-radius:6px;';
            h.textContent = '📌 الافتراضي';
            box.appendChild(h);
            Object.keys(DEFAULT_HAKAWATI).sort().forEach(k => {
                var override = fb[k] !== undefined;
                var v = override ? ((typeof fb[k] === 'string') ? fb[k] : (fb[k].text || '')) : DEFAULT_HAKAWATI[k];
                box.appendChild(buildHakRow('hakawati', k, v, override));
            });
            var addedKeys = Object.keys(fb).filter(k => DEFAULT_HAKAWATI[k] === undefined);
            if (addedKeys.length > 0) {
                var h2 = document.createElement('div');
                h2.style.cssText = 'color:#84cc16;font-size:12px;font-weight:900;margin:12px 0 6px;padding:6px;background:rgba(132,204,22,0.1);border-radius:6px;';
                h2.textContent = '➕ المضاف';
                box.appendChild(h2);
                addedKeys.sort().forEach(k => {
                    var v = (typeof fb[k] === 'string') ? fb[k] : (fb[k].text || '');
                    box.appendChild(buildHakRow('hakawati', k, v, false));
                });
            }
        });
    } else if (tab === 'hakawati_auto') {
        db.ref('bot_memory/hakawati_auto').once('value').then(s => {
            var fb = s.val() || {};
            var keys = Object.keys(fb);
            if (keys.length === 0) {
                box.innerHTML = '<div style="color:#888;text-align:center;padding:20px;">لا توجد ردود تلقائية.</div>';
                return;
            }
            keys.sort().forEach(k => {
                var v = (typeof fb[k] === 'string') ? fb[k] : (fb[k].text || '');
                box.appendChild(buildHakRow('hakawati_auto', k, v, false));
            });
        });
    } else if (tab === 'quiz') {
        var list = BotsState.memory.quiz.length > 0 ? BotsState.memory.quiz : DEFAULT_QUIZ;
        list.forEach(q => {
            var r = document.createElement('div');
            r.style.cssText = 'background:rgba(255,255,255,0.05);border:1px solid rgba(255,215,0,0.2);border-radius:10px;padding:10px;margin-bottom:8px;';
            var t = document.createElement('div');
            t.style.cssText = 'color:#ffd700;font-weight:900;font-size:13px;margin-bottom:6px;word-break:break-word;';
            t.textContent = '❓ ' + q.q;
            var a = document.createElement('div');
            a.style.cssText = 'color:#ccc;font-size:12px;word-break:break-word;';
            a.textContent = '✅ ' + toArray(q.answers).join(' / ');
            r.appendChild(t); r.appendChild(a);
            box.appendChild(r);
        });
    } else if (tab === 'islamic') {
        var libCount = (typeof window !== 'undefined' && window.ISLAMIC_LIBRARY) ? window.ISLAMIC_LIBRARY.length : 0;
        var info2 = document.createElement('div');
        info2.style.cssText = 'color:#84cc16;font-size:11px;text-align:center;padding:8px;margin-bottom:8px;background:rgba(132,204,22,0.1);border-radius:8px;';
        info2.textContent = '📚 مكتبة مدمجة: ' + libCount + ' عنصر';
        box.appendChild(info2);
        var list = BotsState.memory.islamic.length > 0 ? BotsState.memory.islamic : [];
        if (list.length === 0) {
            var e = document.createElement('div');
            e.style.cssText = 'color:#888;text-align:center;padding:20px;';
            e.textContent = 'لم تُضف عناصر بعد.';
            box.appendChild(e);
        } else {
            list.forEach(t => {
                var r = document.createElement('div');
                r.style.cssText = 'background:rgba(255,255,255,0.05);border:1px solid rgba(255,215,0,0.2);border-radius:10px;padding:10px;margin-bottom:8px;color:#ccc;font-size:13px;word-break:break-word;';
                r.textContent = t;
                box.appendChild(r);
            });
        }
    } else if (tab === 'badwords' || tab === 'kickwords') {
        var list = tab === 'badwords' ? BotsState.badWords : BotsState.kickWords;
        var path = tab === 'badwords' ? 'bot_memory/badWords' : 'bot_memory/kickWords';
        if (!list || list.length === 0) {
            box.innerHTML = '<div style="color:#888;text-align:center;padding:20px;">لا توجد كلمات.</div>';
        } else {
            var countInfo = document.createElement('div');
            countInfo.style.cssText = 'color:#84cc16;text-align:center;padding:8px;margin-bottom:10px;font-size:12px;font-weight:900;';
            countInfo.textContent = '📊 ' + list.length + ' كلمة';
            box.appendChild(countInfo);
            list.forEach(w => {
                var r = document.createElement('div');
                r.style.cssText = tab === 'badwords'
                    ? 'background:rgba(255,152,0,0.1);border:1px solid rgba(255,152,0,0.3);border-radius:10px;padding:10px;margin-bottom:8px;'
                    : 'background:rgba(220,38,38,0.15);border:1px solid rgba(220,38,38,0.5);border-radius:10px;padding:10px;margin-bottom:8px;';
                var t = document.createElement('div');
                t.style.cssText = 'color:#fff;font-weight:900;font-size:13px;margin-bottom:8px;';
                t.textContent = (tab === 'badwords' ? '⚠️ ' : '🚪 ') + w;
                r.appendChild(t);
                var del = document.createElement('button');
                del.textContent = '🗑️ حذف';
                del.style.cssText = 'width:100%;padding:6px;background:#ef4444;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:900;cursor:pointer;font-family:inherit;';
                del.onclick = () => {
                    if (!confirm('حذف "' + w + '"؟')) return;
                    db.ref(path).once('value').then(s => {
                        var data = s.val() || {};
                        Object.keys(data).forEach(k => {
                            var it = data[k];
                            var txt = (typeof it === 'string') ? it : (it.text || '');
                            if (txt === w) db.ref(path + '/' + k).remove();
                        });
                        setTimeout(() => renderTab(tab), 500);
                    });
                };
                r.appendChild(del);
                box.appendChild(r);
            });
        }
    } else if (tab === 'pending') {
        db.ref('bot_learning/pending').once('value').then(s => {
            var d = s.val() || {};
            var keys = Object.keys(d);
            if (keys.length === 0) {
                box.innerHTML = '<div style="color:#888;text-align:center;padding:20px;">لا يوجد أسئلة معلقة.</div>';
                return;
            }
            keys.forEach(k => {
                var it = d[k];
                var r = document.createElement('div');
                r.style.cssText = 'background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.3);border-radius:10px;padding:10px;margin-bottom:8px;';
                var qd = document.createElement('div');
                qd.style.cssText = 'color:#fff;font-weight:900;font-size:13px;margin-bottom:4px;word-break:break-word;';
                qd.textContent = '❓ ' + (it.question || '');
                var wh = document.createElement('div');
                wh.style.cssText = 'color:#888;font-size:11px;margin-bottom:8px;';
                wh.textContent = 'من: ' + (it.fromName || 'مجهول');
                r.appendChild(qd); r.appendChild(wh);
                var btns = document.createElement('div');
                btns.style.cssText = 'display:flex;gap:6px;';
                var teach = document.createElement('button');
                teach.textContent = '✅ تعليم حكواتي';
                teach.style.cssText = 'flex:2;padding:8px;background:#84cc16;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:900;cursor:pointer;font-family:inherit;';
                teach.onclick = () => {
                    var key = prompt('📖 الكلمة المفتاحية:', it.question || '');
                    if (!key) return;
                    var answer = prompt('💬 الرد:');
                    if (!answer) return;
                    var safePath = key.replace(/[.#$\/\[\]]/g, '_').substring(0, 100);
                    db.ref('bot_memory/hakawati/' + safePath).set(answer)
                        .then(() => db.ref('bot_learning/pending/' + k).remove())
                        .then(() => { if (typeof showToast === 'function') showToast('fa-check', '✅'); renderTab('pending'); })
                        .catch(e => alert('❌ ' + e.message));
                };
                var del = document.createElement('button');
                del.textContent = '🗑️';
                del.style.cssText = 'flex:1;padding:8px;background:#ef4444;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:900;cursor:pointer;font-family:inherit;';
                del.onclick = () => { if (!confirm('حذف؟')) return; db.ref('bot_learning/pending/' + k).remove().then(() => renderTab('pending')); };
                btns.appendChild(teach); btns.appendChild(del);
                r.appendChild(btns);
                box.appendChild(r);
            });
        });
    }
}

function buildHakRow(path, key, val, isOverride) {
    var r = document.createElement('div');
    r.style.cssText = 'background:rgba(255,255,255,0.05);border:1px solid rgba(255,215,0,0.2);border-radius:10px;padding:10px;margin-bottom:8px;';
    var t = document.createElement('div');
    t.style.cssText = 'color:#ffd700;font-weight:900;font-size:13px;margin-bottom:6px;word-break:break-word;';
    t.textContent = '🔑 ' + key + (isOverride ? ' (معدّل)' : '');
    var v = document.createElement('div');
    v.style.cssText = 'color:#ccc;font-size:12px;margin-bottom:8px;word-break:break-word;';
    v.textContent = '💬 ' + val;
    r.appendChild(t); r.appendChild(v);
    var btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:6px;';
    var e = document.createElement('button');
    e.textContent = '✏️';
    e.style.cssText = 'flex:1;padding:6px;background:#3b82f6;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:900;cursor:pointer;font-family:inherit;';
    e.onclick = () => {
        var nv = prompt('تعديل الرد:', val);
        if (nv === null) return;
        var safePath = key.replace(/[.#$\/\[\]]/g, '_');
        db.ref('bot_memory/' + path + '/' + safePath).set(nv.trim())
            .then(() => renderTab(path))
            .catch(e => alert('❌ ' + e.message));
    };
    var d = document.createElement('button');
    d.textContent = '🗑️';
    d.style.cssText = 'flex:1;padding:6px;background:#ef4444;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:900;cursor:pointer;font-family:inherit;';
    d.onclick = () => {
        if (!confirm('حذف؟')) return;
        var safePath = key.replace(/[.#$\/\[\]]/g, '_');
        db.ref('bot_memory/' + path + '/' + safePath).remove().then(() => renderTab(path));
    };
    btns.appendChild(e); btns.appendChild(d);
    r.appendChild(btns);
    return r;
}

function addItem(tab) {
    if (tab === 'hakawati' || tab === 'hakawati_auto') {
        var k = prompt('🔑 الكلمة المفتاحية:'); if (!k) return;
        var v = prompt('💬 الرد:'); if (!v) return;
        var safePath = k.trim().replace(/[.#$\/\[\]]/g, '_');
        db.ref('bot_memory/' + tab + '/' + safePath).set(v.trim())
            .then(() => renderTab(tab))
            .catch(e => alert('❌ ' + e.message));
    } else if (tab === 'quiz') {
        var q = prompt('🎯 السؤال:'); if (!q) return;
        var a = prompt('✅ الأجوبة (افصل بفاصلة):'); if (!a) return;
        var answers = a.split(',').map(x => x.trim()).filter(Boolean);
        db.ref('bot_memory/quiz').push({ q: q.trim(), answers }).then(() => renderTab('quiz')).catch(e => alert('❌ ' + e.message));
    } else if (tab === 'islamic') {
        var t = prompt('🌙 نص الدعاء:'); if (!t) return;
        db.ref('bot_memory/islamic').push({ text: t.trim() }).then(() => renderTab('islamic')).catch(e => alert('❌ ' + e.message));
    } else if (tab === 'badwords') {
        var w = prompt('⚠️ كلمة السجن:'); if (!w) return;
        db.ref('bot_memory/badWords').push({ text: w.trim() }).then(() => renderTab('badwords')).catch(e => alert('❌ ' + e.message));
    } else if (tab === 'kickwords') {
        var kw = prompt('🚪 كلمة الطرد الدائم:'); if (!kw) return;
        db.ref('bot_memory/kickWords').push({ text: kw.trim() }).then(() => renderTab('kickwords')).catch(e => alert('❌ ' + e.message));
    }
}

function stopBots() {
    if (BotsState.autoInterval) clearInterval(BotsState.autoInterval);
    if (BotsState.kingObs) { try { BotsState.kingObs.disconnect(); } catch (e) {} }
    if (BotsState.presenceListener) { try { BotsState.presenceListener.off(); } catch (e) {} }
    if (BotsState.hiddenListener) { try { BotsState.hiddenListener.off(); } catch (e) {} }
    BotsState.initialized = false;
}

/* ══════════════════════════════════════════════ */
/* Exports                                        */
/* ══════════════════════════════════════════════ */
window.initBots = initBots;
window.handleBotCommand = handleBotCommand;
window.processIncomingMessage = processIncomingMessage;
window.onRoomChanged = onRoomChanged;
window.stopBots = stopBots;
window.openBotManager = openBotManager;
window.closeBotManager = closeBotManager;
window.importArabicWordList = importArabicWordList;
window.forceTransferToRoom = forceTransferToRoom;
window.BotsState = BotsState;

console.log('🤖 bots.js v30 (TEST) loaded — jail transfer + permanent ban + device');
