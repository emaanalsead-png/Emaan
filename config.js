// ==============================================
// قمر الشام - الإعدادات المشتركة (v4)
// Qamar Al Sham - Shared Configuration v4
// ==============================================
// ✅ v4:
//   1. IDENTITY_FIELDS: +coverType +cinemaTextStyle +cinemaBgStyle
//   2. STORAGE_KEYS: كل المفاتيح
//   3. DEFAULT_BIO + DEFAULT_NAME_SIZE + AVATAR_SIZE
//   4. DEFAULT_AVATAR_FRAMES
//   5. PROFILE_GLOWS + NAME_BG_COLORS
//   6. window.getRankLevel موحّد
// ==============================================

const firebaseConfig = {
    apiKey: "AIzaSyDOBWW4uACUSShJjwzfpnEzcL3KONZ-6FI",
    authDomain: "qamaralsham.firebaseapp.com",
    databaseURL: "https://qamaralsham-default-rtdb.firebaseio.com",
    projectId: "qamaralsham",
    storageBucket: "qamaralsham.firebasestorage.app",
    messagingSenderId: "1059424590289",
    appId: "1:1059424590289:web:176e82c30c8c7ec4c028f0"
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
        console.log('Firebase initialized');
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

    // ⭐ v4: حقول الهوية الكاملة
    IDENTITY_FIELDS: [
        'avatar',
        'cover',
        'coverType',
        'name',
        'bio',
        'nameColor',
        'nameGradient',
        'nameBgColor',
        'nameBgGradient',
        'cinemaTextStyle',
        'cinemaBgStyle',
        'avatarFrame',
        'profileGlow',
        'profileBgType',
        'profileBgValue',
        'musicURL',
        'poetry',
        'poetryBg',
        'poetryAttachment',
        'country',
        'family'
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
            audio: 3 * 1024 * 1024,
            video: 200 * 1024 * 1024
        }
    },

    JAIL: {
        FIRST_OFFENSE_MS:      2 * 60 * 1000,
        ESCALATION_WINDOW_MS: 10 * 60 * 1000,
        MAX_AUTO_JAIL_MS:     15 * 60 * 1000,
        ESCALATION_MULTIPLIER: 2
    },

    BOTS: {
        GUARDIAN: { id:'guardian',  name:'السجان',      icon:'🚔', color:'#ff4444', description:'يحرس المكان — يكتشف الكلمات الممنوعة ويعاقب المخالفين تلقائياً.' },
        ISLAMIC:  { id:'islamic',   name:'قمر الشام',   icon:'🌙', color:'#d4af37', intervalMs: 5*60*1000, description:'ينشر الأدعية والأذكار والاستغفار والصلاة على النبي ﷺ كل 5 دقائق.' },
        QUIZ:     { id:'quiz',      name:'الشاطر',      icon:'🎯', color:'#FF9800', intervalMs: 5*60*1000, revealDelayMs: 60*1000, description:'يطرح الأسئلة كل 5 دقائق — من يجيب أولاً يكسب نقاطاً.' },
        HAKAWATI: { id:'hakawati',  name:'حكواتي الشام', icon:'📖', color:'#9C27B0', description:'يساعدك على فهم الموقع — نادِه بـ "حكواتي" + سؤالك.' }
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
        MUSIC_URL:    'profile_music_url'
    },

    SETTINGS: {
        MESSAGES_LIMIT:         100,
        PRIVATE_MESSAGES_LIMIT: 50,
        NOTIFICATIONS_LIMIT:    50
    }
};

window.getRankLevel = function (rank) {
    return QAMAR.getRankLevel(rank);
};

console.log('Qamar Config v4 loaded:', {
    rooms:            Object.keys(QAMAR.ROOMS).length,
    ranks:            QAMAR.RANKS_ORDERED.length,
    bots:             Object.keys(QAMAR.BOTS).length,
    identityFields:   QAMAR.IDENTITY_FIELDS.length,
    profileGlows:     QAMAR.PROFILE_GLOWS.length,
    nameBgColors:     QAMAR.NAME_BG_COLORS.length,
    storageKeys:      Object.keys(QAMAR.STORAGE_KEYS).length
});
