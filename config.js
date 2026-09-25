// ==============================================
// قمر الشام — config.js v7 (TEST)
// ==============================================
// ✅ v7:
//   1. PATHS جديدة: mutes, banned_devices, banned_ips, device_registry,
//      ip_registry, multi_account_alerts
//   2. MUTE_TYPES: global + room (دائم حتى يُلغى)
//   3. BAN_TYPES: permanent + temporary
//   4. PRESENCE_ROOMS: نقل قسري + سجن
//   5. ما تبقى من v6 محفوظ
// ==============================================

const firebaseConfig = {
    apiKey: "AIzaSyCWh4rv__7DKqXUHXaPbNv4xGqJdoMbsCg",
    authDomain: "qamaralshamtest.firebaseapp.com",
    databaseURL: "https://qamaralshamtest-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "qamaralshamtest",
    storageBucket: "qamaralshamtest.firebasestorage.app",
    messagingSenderId: "204010808393",
    appId: "1:204010808393:web:6a83f5b179dcff44120b98"
};

let auth = null;
let db = null;
let storage = null;

try {
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.database();
        storage = firebase.storage();
        console.log('🔥 Firebase TEST initialized');
    } else if (firebase.apps.length) {
        auth = firebase.auth();
        db = firebase.database();
        storage = firebase.storage();
    }
} catch (e) {
    console.error('Firebase init failed:', e);
}

const QAMAR = {
    PROFILE_URL: 'profile.html',
    INDEX_URL: 'index.html',

    RANK_LEVELS: {
        'King': 100, 'Queen': 95, 'Master Owner': 90, 'Room Owner': 85,
        'Grand Owner': 80, 'Owner': 75, 'Super Admin': 70, 'Admin': 65,
        'Premium': 60, 'User': 50
    },

    RANKS_ORDERED: [
        'King', 'Queen', 'Master Owner', 'Room Owner', 'Grand Owner',
        'Owner', 'Super Admin', 'Admin', 'Premium', 'User'
    ],

    isHigherRank: function (rankA, rankB) {
        return (this.RANK_LEVELS[rankA] || 0) > (this.RANK_LEVELS[rankB] || 0);
    },
    isHigherOrEqual: function (rankA, rankB) {
        return (this.RANK_LEVELS[rankA] || 0) >= (this.RANK_LEVELS[rankB] || 0);
    },
    getRankLevel: function (rank) {
        return this.RANK_LEVELS[rank] || 0;
    },

    ROOMS: {
        general:      { id:'general',      name:'الروم العام',    icon:'🌍', type:'public',  visibleTo:'all',    micCount:4, allowMic:true,  maxUsers:null },
        quiz:         { id:'quiz',         name:'روم المسابقات',  icon:'🎯', type:'public',  visibleTo:'all',    micCount:4, allowMic:true,  maxUsers:null },
        islamic:      { id:'islamic',      name:'روم الإسلاميات', icon:'🕌', type:'public',  visibleTo:'all',    micCount:1, allowMic:true,  maxUsers:null },
        royal:        { id:'royal',        name:'السويت الملكي',  icon:'👑', type:'private', visibleTo:'royal',  micCount:2, allowMic:true,  maxUsers:2 },
        candy:        { id:'candy',        name:'كانديز',         icon:'🍫', type:'public',  visibleTo:'all',    micCount:4, allowMic:true,  maxUsers:null },
        studio:       { id:'studio',       name:'استديو التسجيل', icon:'🎙️', type:'private', visibleTo:'owner+', micCount:1, allowMic:true,  maxUsers:1, hasRecording:true, hasEcho:true, hasEqualizer:true },
        gaza:         { id:'gaza',         name:'غزة العزة',      icon:'🇵🇸', type:'public',  visibleTo:'all',    micCount:4, allowMic:true,  maxUsers:null },
        sham:         { id:'sham',         name:'ليالي الشام',    icon:'🌙', type:'public',  visibleTo:'all',    micCount:4, allowMic:true,  maxUsers:null },
        bot_training: { id:'bot_training', name:'تدريب البوت',    icon:'🤖', type:'private', visibleTo:'royal',  micCount:0, allowMic:false, maxUsers:2, invisible:true },
        jail:         { id:'jail',         name:'السجن',          icon:'🚔', type:'private', visibleTo:'jailed', micCount:0, allowMic:false, maxUsers:null }
    },

    isRoomVisible: function (roomId, user) {
        const room = this.ROOMS[roomId];
        if (!room || !user) return false;
        if (user.rank === 'King') return true;
        if (roomId === 'bot_training' && user.rank === 'Queen') return true;
        switch (room.visibleTo) {
            case 'all':         return true;
            case 'royal':       return user.rank === 'King' || user.rank === 'Queen';
            case 'owner+':      return ['King','Queen','Master Owner','Room Owner','Grand Owner','Owner'].includes(user.rank);
            case 'grandowner+': return ['King','Queen','Master Owner','Room Owner','Grand Owner'].includes(user.rank);
            case 'jailed':      return user.isJailed === true;
            case 'king':        return user.rank === 'King';
            default:            return false;
        }
    },

    getVisibleRooms: function (user) {
        const visible = {};
        for (const [id, room] of Object.entries(this.ROOMS)) {
            if (room.invisible) continue;
            if (this.isRoomVisible(id, user)) visible[id] = room;
        }
        return visible;
    },

    BACKGROUNDS: [
        { id: 'stars',  class: 'background-type-stars'  },
        { id: 'nebula', class: 'background-type-nebula' },
        { id: 'moon',   class: 'background-type-moon'   },
        { id: 'dust',   class: 'background-type-dust'   },
        { id: 'waves',  class: 'background-type-waves'  }
    ],

    COLORS: { gold: '#d4af37', goldLight: '#ffd700', bgDark: '#050508' },

    DEFAULT_BIO: '❋ نجوم الشام ❋',
    DEFAULT_NAME_SIZE: 26,
    AVATAR_SIZE: 120,

    DEFAULT_AVATAR_FRAMES: {
        'King':         'gold',
        'Queen':        'pink',
        'Master Owner': 'silver',
        'Room Owner':   'silver',
        'Grand Owner':  'silver',
        'Owner':        'silver',
        'Super Admin':  'silver',
        'Admin':        'silver',
        'Premium':      'gray',
        'User':         'gray'
    },

    IDENTITY_FIELDS: [
        'avatar', 'cover', 'coverType', 'name', 'bio',
        'nameColor', 'nameGradient', 'nameBgColor', 'nameBgGradient',
        'cinemaTextStyle', 'cinemaBgStyle',
        'avatarFrame', 'profileGlow', 'profileBgType', 'profileBgValue',
        'musicURL', 'poetry', 'poetryBg', 'poetryAttachment',
        'country', 'family'
    ],

    PROFILE_GLOWS: [
        '#ffd700', '#ff69b4', '#00f3ff', '#39ff14',
        '#a855f7', '#ff0066', '#ffffff', '#ff4444',
        '#ff8c00', '#00ff88', '#8b00ff', '#feca57'
    ],

    NAME_BG_COLORS: [
        '#000000', '#ffffff', '#ff0000', '#ff4500',
        '#ff8c00', '#ffd700', '#ffff00', '#adff2f',
        '#39ff14', '#00cc00', '#00b894', '#00f3ff',
        '#00bfff', '#1e90ff', '#0000ff', '#6c5ce7',
        '#8a2be2', '#a855f7', '#ff00ff', '#da70d6',
        '#ff1493', '#e0115f', '#8b4513', '#696969'
    ],

    RATE_LIMIT: {
        MESSAGE_INTERVAL_MS: 5000,
        PRIVATE_MESSAGE_INTERVAL_MS: 3000,
        MAX_MESSAGE_LENGTH: 2000,
        MAX_FILE_SIZE: {
            image: 5 * 1024 * 1024,
            gif:   5 * 1024 * 1024,
            audio: 10 * 1024 * 1024,
            video: 20 * 1024 * 1024
        }
    },

    JAIL: {
        FIRST_OFFENSE_MS:      2 * 60 * 1000,
        ESCALATION_WINDOW_MS: 10 * 60 * 1000,
        MAX_AUTO_JAIL_MS:     15 * 60 * 1000,
        ESCALATION_MULTIPLIER: 2
    },

    BOTS: {
        GUARDIAN: { id:'guardian',  name:'السجان',      icon:'🚔', color:'#ff4444', description:'يحرس المكان.' },
        ISLAMIC:  { id:'islamic',   name:'قمر الشام',   icon:'🌙', color:'#d4af37', intervalMs: 5*60*1000, description:'أدعية وأذكار.' },
        QUIZ:     { id:'quiz',      name:'الشاطر',      icon:'🎯', color:'#FF9800', intervalMs: 5*60*1000, revealDelayMs: 60*1000, description:'أسئلة كل 5 دقائق.' },
        HAKAWATI: { id:'hakawati',  name:'حكواتي الشام', icon:'📖', color:'#9C27B0', description:'مساعد الموقع.' },
        AMBASSADOR: { id:'ambassador', name:'السفير',   icon:'🚪', color:'#84cc16', description:'يرحب بالأعضاء الجدد.' }
    },

    STORAGE_KEYS: {
        USER:         'qamar_user',
        GUEST:        'qamar_guest',
        CURRENT_USER: 'qamar_current_user',
        BACKGROUND:          'qamar_background',
        IDENTITY_UPDATED_AT: 'qamar_identity_updated_at',
        ROOM_PICKER_DONE:    'qamar_room_picker_done',
        LAST_ROOM:           'qamar_last_room',
        SIDEBAR_STYLE:       'qamar_sidebar_style',
        SAVED_AVATAR:    'saved_avatar',
        SAVED_COVER:     'saved_cover',
        AVATAR_FRAME:    'saved_avatar_frame_motion',
        PROFILE_BG_TYPE: 'profile_bg_type',
        PROFILE_BG_VALUE:'profile_bg_value',
        NAME_COLOR:       'name_color',
        NAME_GRADIENT:    'name_gradient',
        NAME_BG_COLOR:    'name_bg_color',
        NAME_BG_GRADIENT: 'name_bg_gradient',
        PROFILE_GLOW: 'profile_glow',
        PROFILE_NAME: 'profile_name',
        PROFILE_BIO:  'profile_bio',
        POETRY_TEXT:  'poetry_text',
        MUSIC_URL:    'profile_music_url',
        DEVICE_HASH:  'qamar_device_hash',
        DEVICE_ID:    'qamar_device_id',
        IP_HASH:      'qamar_ip_hash'
    },

    SETTINGS: {
        MESSAGES_LIMIT:         100,
        PRIVATE_MESSAGES_LIMIT: 50,
        NOTIFICATIONS_LIMIT:    50,
        USERS_PAGE_SIZE:        10,
        STORIES_LIMIT:          100
    },

    QUEEN_ORDERS: {
        1: { label: 'الملكة الأولى',  short: 'الأولى',  color: '#ff69b4' },
        2: { label: 'الملكة الثانية', short: 'الثانية', color: '#ff69b4' },
        3: { label: 'الملكة الثالثة', short: 'الثالثة', color: '#ff69b4' },
        4: { label: 'الملكة الرابعة', short: 'الرابعة', color: '#ff69b4' }
    },

    CUSTOMIZABLE_PERMISSIONS: [
        {
            group: '🎖️ إدارة الرتب',
            items: [
                { key: 'canPromote', label: 'ترقية الأعضاء' },
                { key: 'canDemote',  label: 'تخفيض الأعضاء' }
            ]
        },
        {
            group: '⚔️ العقوبات',
            items: [
                { key: 'canWarn',         label: 'تحذير' },
                { key: 'canJail',         label: 'سجن' },
                { key: 'canBan',          label: 'حظر' },
                { key: 'canBanAdmins',    label: 'حظر الإداريين' },
                { key: 'canBanQueens',    label: 'حظر الملكات' },
                { key: 'canUnban',        label: 'فك الحظر' },
                { key: 'canKickFromRoom', label: 'طرد من الغرفة' },
                { key: 'canKickFromMic',  label: 'طرد من المايك' },
                { key: 'canMuteGlobal',   label: 'كتم كامل' },
                { key: 'canMuteInRoom',   label: 'كتم في غرفة' },
                { key: 'canTransferUsers',label: 'نقل الأعضاء' }
            ]
        },
        {
            group: '🚪 إدارة الغرف',
            items: [
                { key: 'canCreateRooms', label: 'إنشاء غرف' },
                { key: 'canDeleteRooms', label: 'حذف غرف' },
                { key: 'canEditRooms',   label: 'تعديل غرف' },
                { key: 'canMuteRoom',    label: 'كتم الغرفة' }
            ]
        },
        {
            group: '🤖 البوتات',
            items: [
                { key: 'canOpenKingPanel', label: 'فتح لوحة الملك' },
                { key: 'canEditHakawati',  label: 'تعديل حكاواتي' },
                { key: 'canEditQuiz',      label: 'تعديل المسابقات' },
                { key: 'canEditIslamic',   label: 'تعديل الإسلاميات' },
                { key: 'canEditBadWords',  label: 'تعديل كلمات السجن' },
                { key: 'canEditKickWords', label: 'تعديل كلمات الطرد' },
                { key: 'canTrainBots',     label: 'تدريب البوتات' },
                { key: 'canDeleteBotMemory', label: 'مسح ذاكرة البوتات' }
            ]
        },
        {
            group: '💬 الرسائل',
            items: [
                { key: 'canDeleteAnyMessage',    label: 'حذف أي رسالة' },
                { key: 'canSeePrivateMessages',  label: 'مراقبة الخاص' },
                { key: 'canSeeDeletedMessages',  label: 'رؤية المحذوفات' },
                { key: 'canEditOthersMessages',  label: 'تعديل رسائل الآخرين' }
            ]
        },
        {
            group: '⭐ النقاط',
            items: [
                { key: 'canGivePoints',      label: 'إهداء نقاط' },
                { key: 'canGiveSelfPoints',  label: 'إهداء نقاط لنفسه' },
                { key: 'canClearUserPoints', label: 'مسح نقاط عضو' },
                { key: 'canResetAllPoints',  label: 'تصفير كل النقاط' }
            ]
        },
        {
            group: '📢 الإعلانات والتنبيهات',
            items: [
                { key: 'canAnnounceRoom',    label: 'إعلان في الغرفة' },
                { key: 'canAnnounceAll',     label: 'إعلان عام' },
                { key: 'canPushAnnounce',    label: 'إشعار منبثق' },
                { key: 'canSendRoomAlert',   label: 'تنبيه غرفة' },
                { key: 'canSendGlobalAlert', label: 'تنبيه عام' }
            ]
        },
        {
            group: '🔒 النظام',
            items: [
                { key: 'canInvisible',      label: 'الوضع المخفي' },
                { key: 'canViewAuditLog',   label: 'قراءة سجل النشاط' },
                { key: 'canEditAllProfiles',label: 'تعديل بروفايلات الأعضاء' },
                { key: 'canUseMic',         label: 'استخدام المايك' },
                { key: 'canResetPasswords', label: 'إعادة كلمات السر' },
                { key: 'canViewDevices',    label: 'عرض بيانات الأجهزة' }
            ]
        }
    ],

    SWEAR_WORDS_SOURCES: {
        arabic: 'https://raw.githubusercontent.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/master/ar',
        arabicFallback: 'https://cdn.jsdelivr.net/gh/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words@master/ar'
    },

    ARABIC_EQUIVALENTS: {
        /* ─── كاف ─── */
        'ڪ': 'ك', 'ک': 'ك', 'گ': 'ك', 'ݢ': 'ك',
        /* ─── ياء ─── */
        'ی': 'ي', 'ے': 'ي', 'ى': 'ي', 'ئ': 'ي', 'ﻯ': 'ي',
        /* ─── هاء ─── */
        'ہ': 'ه', 'ۀ': 'ه', 'ھ': 'ه', 'ە': 'ه', 'ﮪ': 'ه', 'ﮫ': 'ه', 'ﮬ': 'ه',
        /* ─── ألف ─── */
        'ٱ': 'ا', 'آ': 'ا', 'أ': 'ا', 'إ': 'ا', 'ٲ': 'ا', 'ٳ': 'ا',
        /* ─── واو ─── */
        'ﻭ': 'و', 'ۆ': 'و', 'ۇ': 'و',
        /* ─── نون ─── */
        'ں': 'ن',
        /* ─── راء ─── */
        'ڕ': 'ر', 'ڒ': 'ر', 'ړ': 'ر',
        /* ─── لام ─── */
        'ڵ': 'ل', 'ﻝ': 'ل',
        /* ─── ميم ─── */
        'ﻡ': 'م',
        /* ─── باء ─── */
        'ٻ': 'ب', 'پ': 'ب',
        /* ─── تاء ─── */
        'ٹ': 'ت', 'ٺ': 'ت',
        /* ─── جيم ─── */
        'چ': 'ج',
        /* ─── دال ─── */
        'ډ': 'د',
        /* ─── سين ─── */
        'ښ': 'س', 'ڛ': 'س',
        /* ─── عين ─── */
        'ﻉ': 'ع',
        /* ─── غين ─── */
        'ڠ': 'غ', 'ﻍ': 'غ',
        /* ─── قاف ─── */
        'ڨ': 'ق', 'ﻕ': 'ق',
        /* ─── فاء ─── */
        'ڤ': 'ف', 'ڦ': 'ف',
        /* ─── حاء ─── */
        'ځ': 'ح', 'ڂ': 'ح',
        /* ─── صاد ─── */
        'ڝ': 'ص', 'ڞ': 'ص',
        /* ─── طاء ─── */
        'ڟ': 'ط', 'ﻁ': 'ط',
        /* ─── ظاء ─── */
        'ﻅ': 'ظ',
        /* ─── ذال ─── */
        'ڊ': 'ذ', 'ڌ': 'ذ',
        /* ─── شين ─── */
        'ڜ': 'ش'
    },

    /* ══════════════════════════════════════════════ */
    /* ⭐ v7: بنية الحظر والكتم                       */
    /* ══════════════════════════════════════════════ */

    /* مسارات Firebase الجديدة */
    PATHS: {
        DEVICE_REGISTRY:     'device_registry',
        IP_REGISTRY:         'ip_registry',
        BANNED_DEVICES:      'banned_devices',
        BANNED_IPS:          'banned_ips',
        MULTI_ACCOUNT_ALERTS:'multi_account_alerts',
        AUDIT_LOG:           'audit_log'
    },

    /* أنواع الكتم */
    MUTE_TYPES: {
        GLOBAL: 'global',    /* كل الغرف — دائم حتى يُلغى */
        ROOM:   'room'       /* غرفة محددة — دائم حتى يُلغى */
    },

    /* أنواع البان */
    BAN_TYPES: {
        TEMPORARY: 'temp',   /* ساعة/يوم/أسبوع */
        PERMANENT: 'perm'    /* دائم + بصمة + IP */
    },

    /* فحص IP */
    IP_SERVICE: 'https://ipwho.is/',

    /* الأجهزة الممنوعة */
    DEVICE_HASH_LENGTH: 32,

    /* سلوك النقل القسري */
    TRANSFER: {
        MIN_RANK_LEVEL: 90,   /* Master Owner+ */
        NOTIFY_USER: true,    /* إشعار للمنقول */
        SAVE_LAST_ROOM: true  /* حفظ الغرفة السابقة */
    },

    /* سلوك السجن */
    JAIL_BEHAVIOR: {
        FORCE_TRANSFER: true,    /* ينقل فوراً لغرفة السجن */
        SAVE_LAST_ROOM: true,    /* يحفظ الغرفة قبل السجن */
        LOCK_ROOM_SWITCH: true,  /* يمنع تغيير الغرفة حتى يُفك */
        AUTO_RETURN: true        /* يعيده لآخر غرفة بعد السجن */
    },

    /* إشعارات الحسابات المكرّرة */
    MULTI_ACCOUNT: {
        ENABLED: true,
        NOTIFY_KING_VIA_BOT: true,   /* السجان يرسل خاص للملك */
        SHOW_TAB: true                /* تبويب في غرفة الملك */
    }
};

window.getRankLevel = function (rank) {
    return QAMAR.getRankLevel(rank);
};

console.log('🔥 Qamar Config v7 (TEST) loaded:', {
    project: firebaseConfig.projectId,
    rooms:   Object.keys(QAMAR.ROOMS).length,
    ranks:   QAMAR.RANKS_ORDERED.length,
    queens:  Object.keys(QAMAR.QUEEN_ORDERS).length,
    permGroups: QAMAR.CUSTOMIZABLE_PERMISSIONS.length,
    arabicEq: Object.keys(QAMAR.ARABIC_EQUIVALENTS).length,
    newPaths: Object.keys(QAMAR.PATHS).length
});
