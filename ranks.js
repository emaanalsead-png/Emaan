// ==============================================
// قمر الشام - نظام الرتب والصلاحيات (v5)
// Qamar Al Sham - Ranks & Permissions v5
// ==============================================
// ✅ v5:
//   1. حذف getRankLevel المحلي (موحّد في config.js)
//   2. window.getRankLevel هو المصدر الوحيد (fallback = 0)
//   3. getRank() يبقى محلياً (يعيد كائن الرتبة الكامل)
//   4. باقي السلوك كما هو في v4
// ==============================================

const RANKS = {
    'King': {
        badge: '👑', color: '#ffd700', level: 100,
        // ── البروفايل ──
        canEditAllProfiles: true,
        canEditNames: true,
        canSeePrivateInfo: true,
        // ── الترقية والتخفيض ──
        canPromote: 'all',
        canDemote: 'all',
        canSetQueen1: true,
        canSetQueen2: true,
        // ── العقوبات ──
        canWarn: true,
        canJail: 'all',
        canJailUnlimited: true,
        canBan: 'all',
        canBanAdmins: true,
        canBanQueens: true,
        canUnban: 'all',
        canDeleteAccount: true,
        canKickFromRoom: 'all',
        canKickFromMic: 'all',
        // ── الرسائل ──
        canDeleteAnyMessage: true,
        canSeePrivateMessages: true,
        canSeeDeletedMessages: true,
        canEditOthersMessages: true,
        // ── الغرف ──
        canAccessRoyal: true,
        canInviteToRoyal: true,
        canAccessStudio: true,
        canAccessBotTraining: true,
        canCreateRooms: true,
        canDeleteRooms: true,
        canEditRooms: true,
        canMuteRoom: true,
        // ── البوتات ──
        canOpenKingPanel: true,
        canEditHakawati: true,
        canEditQuiz: true,
        canEditIslamic: true,
        canEditBadWords: true,
        canEditKickWords: true,
        canTrainBots: true,
        canDeleteBotMemory: true,
        // ── النقاط ──
        canGivePoints: true,
        canGiveSelfPoints: true,
        canClearUserPoints: true,
        canResetAllPoints: true,
        // ── الإعلانات ──
        canAnnounceRoom: true,
        canAnnounceAll: true,
        canPushAnnounce: true,
        // ── التنبيهات المنبثقة ──
        canSendRoomAlert: true,
        canSendGlobalAlert: true,
        // ── النظام ──
        canInvisible: true,
        canViewAuditLog: true,
        canEditConfig: true,
        canSetKingUid: true,
        canUseMic: true,
        canResetPasswords: true
    },

    'Queen': {
        badge: '👸', color: '#ff69b4', level: 95,
        canEditAllProfiles: true,
        canEditNames: true,
        canSeePrivateInfo: false,
        canPromote: 'below_queen',
        canDemote: 'below_queen',
        canSetQueen1: false,
        canSetQueen2: false,
        canWarn: true,
        canJail: 'below_self',
        canJailUnlimited: false,
        canBan: 'below_self',
        canBanAdmins: 'queen1_only',
        canBanQueens: 'queen1_only',
        canUnban: 'all',
        canDeleteAccount: false,
        canKickFromRoom: 'below_self',
        canKickFromMic: 'below_self',
        canDeleteAnyMessage: true,
        canSeePrivateMessages: false,
        canSeeDeletedMessages: false,
        canEditOthersMessages: false,
        canAccessRoyal: true,
        canInviteToRoyal: true,
        canAccessStudio: true,
        canAccessBotTraining: true,
        canCreateRooms: true,
        canDeleteRooms: 'queen1_only',
        canEditRooms: 'queen1_only',
        canMuteRoom: true,
        canOpenKingPanel: true,
        canEditHakawati: true,
        canEditQuiz: true,
        canEditIslamic: true,
        canEditBadWords: true,
        canEditKickWords: 'queen1_only',
        canTrainBots: true,
        canDeleteBotMemory: false,
        canGivePoints: true,
        canGiveSelfPoints: false,
        canClearUserPoints: 'queen1_only',
        canResetAllPoints: false,
        canAnnounceRoom: true,
        canAnnounceAll: 'queen1_only',
        canPushAnnounce: 'queen1_only',
        canSendRoomAlert: true,
        canSendGlobalAlert: 'queen1_only',
        canInvisible: true,
        canViewAuditLog: 'queen1_only',
        canEditConfig: false,
        canSetKingUid: false,
        canUseMic: true,
        canResetPasswords: true
    },

    'Master Owner': {
        badge: '🌟', color: '#ffa500', level: 90,
        canEditAllProfiles: false, canEditNames: false, canSeePrivateInfo: false,
        canPromote: 'below_self_one', canDemote: 'below_self',
        canSetQueen1: false, canSetQueen2: false,
        canWarn: true, canJail: 'below_self', canJailUnlimited: false,
        canBan: 'below_self', canBanAdmins: false, canBanQueens: false,
        canUnban: 'same_or_lower', canDeleteAccount: false,
        canKickFromRoom: 'below_self', canKickFromMic: 'below_self',
        canDeleteAnyMessage: true, canSeePrivateMessages: false,
        canSeeDeletedMessages: false, canEditOthersMessages: false,
        canAccessRoyal: false, canInviteToRoyal: false,
        canAccessStudio: true, canAccessBotTraining: false,
        canCreateRooms: true, canDeleteRooms: true,
        canEditRooms: true, canMuteRoom: true,
        canOpenKingPanel: false, canEditHakawati: false,
        canEditQuiz: false, canEditIslamic: false,
        canEditBadWords: false, canEditKickWords: false,
        canTrainBots: false, canDeleteBotMemory: false,
        canGivePoints: true,
        canGiveSelfPoints: false,
        canClearUserPoints: false,
        canResetAllPoints: false,
        canAnnounceRoom: false, canAnnounceAll: false, canPushAnnounce: false,
        canSendRoomAlert: true, canSendGlobalAlert: true,
        canInvisible: false, canViewAuditLog: false,
        canEditConfig: false, canSetKingUid: false,
        canUseMic: true, canResetPasswords: false
    },

    'Room Owner': {
        badge: '🛡️', color: '#3498db', level: 85,
        canEditAllProfiles: false, canEditNames: false, canSeePrivateInfo: false,
        canPromote: 'below_self_one', canDemote: 'below_self',
        canSetQueen1: false, canSetQueen2: false,
        canWarn: true, canJail: 'below_self', canJailUnlimited: false,
        canBan: 'below_self', canBanAdmins: false, canBanQueens: false,
        canUnban: 'same_or_lower', canDeleteAccount: false,
        canKickFromRoom: 'below_self', canKickFromMic: 'below_self',
        canDeleteAnyMessage: true, canSeePrivateMessages: false,
        canSeeDeletedMessages: false, canEditOthersMessages: false,
        canAccessRoyal: false, canInviteToRoyal: false,
        canAccessStudio: true, canAccessBotTraining: false,
        canCreateRooms: true, canDeleteRooms: true,
        canEditRooms: true, canMuteRoom: true,
        canOpenKingPanel: false, canEditHakawati: false,
        canEditQuiz: false, canEditIslamic: false,
        canEditBadWords: false, canEditKickWords: false,
        canTrainBots: false, canDeleteBotMemory: false,
        canGivePoints: true,
        canGiveSelfPoints: false,
        canClearUserPoints: false,
        canResetAllPoints: false,
        canAnnounceRoom: false, canAnnounceAll: false, canPushAnnounce: false,
        canSendRoomAlert: true, canSendGlobalAlert: false,
        canInvisible: false, canViewAuditLog: false,
        canEditConfig: false, canSetKingUid: false,
        canUseMic: true, canResetPasswords: false
    },

    'Grand Owner': {
        badge: '💎', color: '#9b59b6', level: 80,
        canEditAllProfiles: true, canEditNames: false, canSeePrivateInfo: false,
        canPromote: false, canDemote: false,
        canSetQueen1: false, canSetQueen2: false,
        canWarn: true, canJail: 'below_self', canJailUnlimited: false,
        canBan: 'below_self', canBanAdmins: false, canBanQueens: false,
        canUnban: 'same_or_lower', canDeleteAccount: false,
        canKickFromRoom: 'below_self', canKickFromMic: 'below_self',
        canDeleteAnyMessage: true, canSeePrivateMessages: false,
        canSeeDeletedMessages: false, canEditOthersMessages: false,
        canAccessRoyal: false, canInviteToRoyal: false,
        canAccessStudio: true, canAccessBotTraining: false,
        canCreateRooms: false, canDeleteRooms: false,
        canEditRooms: false, canMuteRoom: false,
        canOpenKingPanel: false, canEditHakawati: false,
        canEditQuiz: false, canEditIslamic: false,
        canEditBadWords: false, canEditKickWords: false,
        canTrainBots: false, canDeleteBotMemory: false,
        canGivePoints: true,
        canGiveSelfPoints: false,
        canClearUserPoints: false,
        canResetAllPoints: false,
        canAnnounceRoom: false, canAnnounceAll: false, canPushAnnounce: false,
        canSendRoomAlert: false, canSendGlobalAlert: false,
        canInvisible: false, canViewAuditLog: false,
        canEditConfig: false, canSetKingUid: false,
        canUseMic: true, canResetPasswords: false
    },

    'Owner': {
        badge: '🏆', color: '#e67e22', level: 75,
        canEditAllProfiles: false, canEditNames: false, canSeePrivateInfo: false,
        canPromote: false, canDemote: false,
        canSetQueen1: false, canSetQueen2: false,
        canWarn: true, canJail: false, canJailUnlimited: false,
        canBan: false, canBanAdmins: false, canBanQueens: false,
        canUnban: false, canDeleteAccount: false,
        canKickFromRoom: false, canKickFromMic: 'below_self',
        canDeleteAnyMessage: false, canSeePrivateMessages: false,
        canSeeDeletedMessages: false, canEditOthersMessages: false,
        canAccessRoyal: false, canInviteToRoyal: false,
        canAccessStudio: true, canAccessBotTraining: false,
        canCreateRooms: false, canDeleteRooms: false,
        canEditRooms: false, canMuteRoom: false,
        canOpenKingPanel: false, canEditHakawati: false,
        canEditQuiz: false, canEditIslamic: false,
        canEditBadWords: false, canEditKickWords: false,
        canTrainBots: false, canDeleteBotMemory: false,
        canGivePoints: true,
        canGiveSelfPoints: false,
        canClearUserPoints: false,
        canResetAllPoints: false,
        canAnnounceRoom: false, canAnnounceAll: false, canPushAnnounce: false,
        canSendRoomAlert: false, canSendGlobalAlert: false,
        canInvisible: false, canViewAuditLog: false,
        canEditConfig: false, canSetKingUid: false,
        canUseMic: true, canResetPasswords: false
    },

    'Super Admin': {
        badge: '🎖️', color: '#f1c40f', level: 70,
        canEditAllProfiles: false, canEditNames: false, canSeePrivateInfo: false,
        canPromote: false, canDemote: false,
        canSetQueen1: false, canSetQueen2: false,
        canWarn: true, canJail: false, canJailUnlimited: false,
        canBan: false, canBanAdmins: false, canBanQueens: false,
        canUnban: false, canDeleteAccount: false,
        canKickFromRoom: false, canKickFromMic: false,
        canDeleteAnyMessage: false, canSeePrivateMessages: false,
        canSeeDeletedMessages: false, canEditOthersMessages: false,
        canAccessRoyal: false, canInviteToRoyal: false,
        canAccessStudio: false, canAccessBotTraining: false,
        canCreateRooms: false, canDeleteRooms: false,
        canEditRooms: false, canMuteRoom: false,
        canOpenKingPanel: false, canEditHakawati: false,
        canEditQuiz: false, canEditIslamic: false,
        canEditBadWords: false, canEditKickWords: false,
        canTrainBots: false, canDeleteBotMemory: false,
        canGivePoints: false, canGiveSelfPoints: false,
        canClearUserPoints: false, canResetAllPoints: false,
        canAnnounceRoom: false, canAnnounceAll: false, canPushAnnounce: false,
        canSendRoomAlert: false, canSendGlobalAlert: false,
        canInvisible: false, canViewAuditLog: false,
        canEditConfig: false, canSetKingUid: false,
        canUseMic: true, canResetPasswords: false
    },

    'Admin': {
        badge: '🛠️', color: '#1abc9c', level: 65,
        canEditAllProfiles: false, canEditNames: false, canSeePrivateInfo: false,
        canPromote: false, canDemote: false,
        canSetQueen1: false, canSetQueen2: false,
        canWarn: true, canJail: false, canJailUnlimited: false,
        canBan: false, canBanAdmins: false, canBanQueens: false,
        canUnban: false, canDeleteAccount: false,
        canKickFromRoom: false, canKickFromMic: false,
        canDeleteAnyMessage: false, canSeePrivateMessages: false,
        canSeeDeletedMessages: false, canEditOthersMessages: false,
        canAccessRoyal: false, canInviteToRoyal: false,
        canAccessStudio: false, canAccessBotTraining: false,
        canCreateRooms: false, canDeleteRooms: false,
        canEditRooms: false, canMuteRoom: false,
        canOpenKingPanel: false, canEditHakawati: false,
        canEditQuiz: false, canEditIslamic: false,
        canEditBadWords: false, canEditKickWords: false,
        canTrainBots: false, canDeleteBotMemory: false,
        canGivePoints: false, canGiveSelfPoints: false,
        canClearUserPoints: false, canResetAllPoints: false,
        canAnnounceRoom: false, canAnnounceAll: false, canPushAnnounce: false,
        canSendRoomAlert: false, canSendGlobalAlert: false,
        canInvisible: false, canViewAuditLog: false,
        canEditConfig: false, canSetKingUid: false,
        canUseMic: false, canResetPasswords: false
    },

    'Premium': {
        badge: '💠', color: '#e84393', level: 60,
        canEditAllProfiles: false, canEditNames: false, canSeePrivateInfo: false,
        canPromote: false, canDemote: false,
        canSetQueen1: false, canSetQueen2: false,
        canWarn: false, canJail: false, canJailUnlimited: false,
        canBan: false, canBanAdmins: false, canBanQueens: false,
        canUnban: false, canDeleteAccount: false,
        canKickFromRoom: false, canKickFromMic: false,
        canDeleteAnyMessage: false, canSeePrivateMessages: false,
        canSeeDeletedMessages: false, canEditOthersMessages: false,
        canAccessRoyal: false, canInviteToRoyal: false,
        canAccessStudio: false, canAccessBotTraining: false,
        canCreateRooms: false, canDeleteRooms: false,
        canEditRooms: false, canMuteRoom: false,
        canOpenKingPanel: false, canEditHakawati: false,
        canEditQuiz: false, canEditIslamic: false,
        canEditBadWords: false, canEditKickWords: false,
        canTrainBots: false, canDeleteBotMemory: false,
        canGivePoints: false, canGiveSelfPoints: false,
        canClearUserPoints: false, canResetAllPoints: false,
        canAnnounceRoom: false, canAnnounceAll: false, canPushAnnounce: false,
        canSendRoomAlert: false, canSendGlobalAlert: false,
        canInvisible: false, canViewAuditLog: false,
        canEditConfig: false, canSetKingUid: false,
        canUseMic: false, canResetPasswords: false
    },

    'User': {
        badge: '👤', color: '#ffffff', level: 50,
        canEditAllProfiles: false, canEditNames: false, canSeePrivateInfo: false,
        canPromote: false, canDemote: false,
        canSetQueen1: false, canSetQueen2: false,
        canWarn: false, canJail: false, canJailUnlimited: false,
        canBan: false, canBanAdmins: false, canBanQueens: false,
        canUnban: false, canDeleteAccount: false,
        canKickFromRoom: false, canKickFromMic: false,
        canDeleteAnyMessage: false, canSeePrivateMessages: false,
        canSeeDeletedMessages: false, canEditOthersMessages: false,
        canAccessRoyal: false, canInviteToRoyal: false,
        canAccessStudio: false, canAccessBotTraining: false,
        canCreateRooms: false, canDeleteRooms: false,
        canEditRooms: false, canMuteRoom: false,
        canOpenKingPanel: false, canEditHakawati: false,
        canEditQuiz: false, canEditIslamic: false,
        canEditBadWords: false, canEditKickWords: false,
        canTrainBots: false, canDeleteBotMemory: false,
        canGivePoints: false, canGiveSelfPoints: false,
        canClearUserPoints: false, canResetAllPoints: false,
        canAnnounceRoom: false, canAnnounceAll: false, canPushAnnounce: false,
        canSendRoomAlert: false, canSendGlobalAlert: false,
        canInvisible: false, canViewAuditLog: false,
        canEditConfig: false, canSetKingUid: false,
        canUseMic: false, canResetPasswords: false
    }
};

/* ══════════════════════════════════════════════ */
/* دوال أساسية                                    */
/* ══════════════════════════════════════════════ */

// ⭐ v5: getRankLevel محذوف — نعتمد على window.getRankLevel
//       (موحّد في config.js، fallback = 0)

function getRank(rankName) {
    return RANKS[rankName] || RANKS['User'];
}

function getRankBadge(rankName) {
    return getRank(rankName).badge;
}

function getRankColor(rankName) {
    return getRank(rankName).color;
}

function isHigherRank(rankA, rankB) {
    return getRankLevel(rankA) > getRankLevel(rankB);
}

function isHigherOrEqualRank(rankA, rankB) {
    return getRankLevel(rankA) >= getRankLevel(rankB);
}

function isAdmin(user) {
    if (!user || !user.rank) return false;
    return getRankLevel(user.rank) >= 65;
}

function isOwner(user) {
    if (!user || !user.rank) return false;
    return getRankLevel(user.rank) >= 80;
}

/* ══════════════════════════════════════════════ */
/* دوال الملكات                                  */
/* ══════════════════════════════════════════════ */
function isKingRank(user)  { return !!(user && user.rank === 'King'); }
function isQueenRank(user) { return !!(user && user.rank === 'Queen'); }
function isRoyalRank(user) { return isKingRank(user) || isQueenRank(user); }

function isQueen1(user) {
    return !!(user && user.rank === 'Queen' && (user.queenOrder === 1 || !user.queenOrder));
}

function isQueen2(user) {
    return !!(user && user.rank === 'Queen' && user.queenOrder === 2);
}

function isAnyQueen(user) {
    return isQueenRank(user);
}

/* ══════════════════════════════════════════════ */
/* الدالة المركزية can()                         */
/* ══════════════════════════════════════════════ */
function can(user, permission) {
    if (!user || !user.rank) return false;
    const rank = getRank(user.rank);
    let value = rank[permission];

    if (user.rank === 'Queen') {
        const qOrder = user.queenOrder || 1;
        if (value === 'queen1_only') return qOrder === 1;
        if (value === 'queen2_only') return qOrder === 2;
    }

    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return true;
    return false;
}

/* ══════════════════════════════════════════════ */
/* دوال الحظر والطرد (تحتاج actor + target)      */
/* ══════════════════════════════════════════════ */

function canBanUser(actor, target) {
    if (!actor || !target) return false;
    if (actor.uid === target.uid) return false;

    if (isKingRank(actor)) return true;

    if (isQueen1(actor)) {
        if (isKingRank(target)) return false;
        return true;
    }

    if (isQueen2(actor)) {
        if (isKingRank(target)) return false;
        if (isQueenRank(target)) return false;
        return true;
    }

    if (!isAdmin(actor)) return false;
    return getRankLevel(actor.rank) > getRankLevel(target.rank);
}

function canKickFromRoomUser(actor, target) {
    if (!actor || !target) return false;
    if (actor.uid === target.uid) return false;

    if (isKingRank(actor)) return true;

    // ⭐ الملكات لا يطردن الملك ولا الملكة الأخرى
    if (isQueenRank(actor)) {
        if (isKingRank(target)) return false;
        if (isQueenRank(target)) return false;
        return true;
    }

    if (!isAdmin(actor)) return false;
    return getRankLevel(actor.rank) > getRankLevel(target.rank);
}

function canJailUser(actor, target) {
    if (!actor || !target) return false;
    if (actor.uid === target.uid) return false;

    if (isKingRank(actor)) return true;

    if (isQueenRank(actor)) {
        if (isKingRank(target)) return false;
        if (isQueenRank(target)) return false;
        return true;
    }

    if (!isAdmin(actor)) return false;
    return getRankLevel(actor.rank) > getRankLevel(target.rank);
}

function canPromoteTo(actor, target, newRank) {
    if (!actor || !target) return false;
    if (actor.uid === target.uid) return false;
    if (newRank === 'King') return false;

    if (isKingRank(actor)) {
        return newRank !== 'King';
    }

    if (isQueen1(actor)) {
        const allowed = ['User','Premium','Admin','Super Admin','Owner','Grand Owner','Room Owner','Master Owner'];
        return allowed.indexOf(newRank) !== -1;
    }

    if (isQueen2(actor)) {
        const allowed = ['User','Premium','Admin','Super Admin','Owner','Grand Owner','Room Owner'];
        return allowed.indexOf(newRank) !== -1;
    }

    if (!isAdmin(actor)) return false;
    return getRankLevel(actor.rank) > getRankLevel(newRank);
}

function canDemoteUser(actor, target) {
    if (!actor || !target) return false;
    if (actor.uid === target.uid) return false;

    if (isKingRank(actor)) {
        return !isKingRank(target);
    }

    if (isQueen1(actor)) {
        if (isKingRank(target)) return false;
        if (isQueen1(target)) return false;
        return true;
    }

    if (isQueen2(actor)) {
        if (isKingRank(target)) return false;
        if (isQueenRank(target)) return false;
        return true;
    }

    if (!isAdmin(actor)) return false;
    return getRankLevel(actor.rank) > getRankLevel(target.rank);
}

/* ══════════════════════════════════════════════ */
/* دوال التوافق مع الكود القديم                  */
/* ══════════════════════════════════════════════ */
function canPromote(user, targetRank) {
    if (!user || !user.rank) return false;
    if (isKingRank(user)) return true;
    if (isQueen1(user)) return !['King','Queen'].includes(targetRank);
    if (isQueen2(user)) {
        const allowed = ['User','Premium','Admin','Super Admin','Owner','Grand Owner','Room Owner'];
        return allowed.indexOf(targetRank) !== -1;
    }
    const rank = getRank(user.rank);
    if (rank.canPromote === 'all') return true;
    if (rank.canPromote === 'below_queen') return targetRank !== 'King' && targetRank !== 'Queen';
    if (rank.canPromote === 'below_self_one') return true;
    return false;
}

function canManageRank(user, targetRank) {
    if (!user || !user.rank) return false;
    return isHigherRank(user.rank, targetRank);
}

function canModerateTarget(user, targetRank) {
    if (!user || !user.rank) return false;
    return isHigherRank(user.rank, targetRank);
}

function canEditTargetProfile(user, targetRank) {
    if (!user || !user.rank) return false;
    const rank = getRank(user.rank);
    if (!rank.canEditAllProfiles) return false;
    return isHigherRank(user.rank, targetRank);
}

/* ══════════════════════════════════════════════ */
/* دالة إهداء النقاط                             */
/* ══════════════════════════════════════════════ */
function canGivePointsTo(actor, target) {
    if (!actor || !target) return false;
    if (!can(actor, 'canGivePoints')) return false;

    // لا تهدي لنفسك إلا إذا كنت الملك
    if (actor.uid === target.uid) {
        return can(actor, 'canGiveSelfPoints');
    }

    // لا تهدي لمن هو أعلى منك (إلا الملك)
    if (isKingRank(actor)) return true;
    return getRankLevel(actor.rank) > getRankLevel(target.rank);
}

console.log('📦 Ranks v5 loaded:', Object.keys(RANKS).length, 'ranks | canGivePoints from Owner+ | getRankLevel unified in config.js');
