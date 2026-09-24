// ==============================================
// قمر الشام - ranks.js v6 (TEST)
// ==============================================
// ✅ v6:
//   1. can(): customPermissions → Master Owner → الرتبة
//   2. دعم 4 ملكات (queenOrder 1-4)
//   3. إلغاء queen1_only / queen2_only (كل الملكات = Master Owner)
//   4. isQueen1/2/3/4
//   5. باقي السلوك كالمعتاد
// ==============================================

const RANKS = {
    'King': {
        badge: '👑', color: '#ffd700', level: 100,
        canEditAllProfiles: true,
        canEditNames: true,
        canSeePrivateInfo: true,
        canPromote: 'all',
        canDemote: 'all',
        canSetQueen1: true,
        canSetQueen2: true,
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
        canDeleteAnyMessage: true,
        canSeePrivateMessages: true,
        canSeeDeletedMessages: true,
        canEditOthersMessages: true,
        canAccessRoyal: true,
        canInviteToRoyal: true,
        canAccessStudio: true,
        canAccessBotTraining: true,
        canCreateRooms: true,
        canDeleteRooms: true,
        canEditRooms: true,
        canMuteRoom: true,
        canOpenKingPanel: true,
        canEditHakawati: true,
        canEditQuiz: true,
        canEditIslamic: true,
        canEditBadWords: true,
        canEditKickWords: true,
        canTrainBots: true,
        canDeleteBotMemory: true,
        canGivePoints: true,
        canGiveSelfPoints: true,
        canClearUserPoints: true,
        canResetAllPoints: true,
        canAnnounceRoom: true,
        canAnnounceAll: true,
        canPushAnnounce: true,
        canSendRoomAlert: true,
        canSendGlobalAlert: true,
        canInvisible: true,
        canViewAuditLog: true,
        canEditConfig: true,
        canSetKingUid: true,
        canUseMic: true,
        canResetPasswords: true
    },

    /* ⭐ v6: Queen = Master Owner + customPermissions */
    /* القيم هنا للتوافق فقط، can() ما يعتمد عليها */
    'Queen': {
        badge: '👸', color: '#ff69b4', level: 95,
        canEditAllProfiles: false, canEditNames: false, canSeePrivateInfo: false,
        canPromote: false, canDemote: false,
        canSetQueen1: false, canSetQueen2: false,
        canWarn: true, canJail: true, canJailUnlimited: false,
        canBan: true, canBanAdmins: false, canBanQueens: false,
        canUnban: true, canDeleteAccount: false,
        canKickFromRoom: true, canKickFromMic: true,
        canDeleteAnyMessage: true, canSeePrivateMessages: false,
        canSeeDeletedMessages: false, canEditOthersMessages: false,
        canAccessRoyal: true, canInviteToRoyal: true,
        canAccessStudio: true, canAccessBotTraining: true,
        canCreateRooms: true, canDeleteRooms: false,
        canEditRooms: false, canMuteRoom: true,
        canOpenKingPanel: true, canEditHakawati: true,
        canEditQuiz: true, canEditIslamic: true,
        canEditBadWords: true, canEditKickWords: false,
        canTrainBots: true, canDeleteBotMemory: false,
        canGivePoints: true, canGiveSelfPoints: false,
        canClearUserPoints: false, canResetAllPoints: false,
        canAnnounceRoom: true, canAnnounceAll: false, canPushAnnounce: false,
        canSendRoomAlert: true, canSendGlobalAlert: false,
        canInvisible: false, canViewAuditLog: false,
        canEditConfig: false, canSetKingUid: false,
        canUseMic: true, canResetPasswords: false
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
/* ⭐ v6: دوال الملكات — 4 ملكات                   */
/* ══════════════════════════════════════════════ */
function isKingRank(user)  { return !!(user && user.rank === 'King'); }
function isQueenRank(user) { return !!(user && user.rank === 'Queen'); }
function isRoyalRank(user) { return isKingRank(user) || isQueenRank(user); }

function isQueen1(user) {
    if (!user || user.rank !== 'Queen') return false;
    return user.queenOrder === 1 || user.queenOrder === null || user.queenOrder === undefined;
}
function isQueen2(user) { return !!(user && user.rank === 'Queen' && user.queenOrder === 2); }
function isQueen3(user) { return !!(user && user.rank === 'Queen' && user.queenOrder === 3); }
function isQueen4(user) { return !!(user && user.rank === 'Queen' && user.queenOrder === 4); }
function isAnyQueen(user) { return isQueenRank(user); }

function getQueenOrderLabel(user) {
    if (!user || user.rank !== 'Queen') return '';
    const ord = user.queenOrder || 1;
    const info = (typeof QAMAR !== 'undefined' && QAMAR.QUEEN_ORDERS) ? QAMAR.QUEEN_ORDERS[ord] : null;
    return info ? info.label : ('الملكة ' + ord);
}

/* ══════════════════════════════════════════════ */
/* ⭐ v6: can() — customPermissions → Master → rank */
/* ══════════════════════════════════════════════ */
function can(user, permission) {
    if (!user || !user.rank) return false;

    // 1. customPermissions تتفوق (تضيف فوق الافتراضي)
    if (user.customPermissions && user.customPermissions[permission] === true) {
        return true;
    }

    // 2. الملكة = Master Owner كقاعدة
    if (user.rank === 'Queen') {
        const mo = RANKS['Master Owner'];
        return mo[permission] === true;
    }

    // 3. باقي الرتب كالمعتاد
    const rank = getRank(user.rank);
    const value = rank[permission];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return true;  // نصوص مثل 'all', 'below_self'
    return false;
}

/* ══════════════════════════════════════════════ */
/* دوال الحظر والطرد (تحتاج actor + target)      */
/* ══════════════════════════════════════════════ */

function canBanUser(actor, target) {
    if (!actor || !target) return false;
    if (actor.uid === target.uid) return false;

    if (isKingRank(actor)) return true;

    // كل الملكات متساويات — يستخدمن can()
    if (isQueenRank(actor)) {
        if (isKingRank(target)) return false;
        if (isQueenRank(target)) return can(actor, 'canBanQueens');
        return can(actor, 'canBan');
    }

    if (!isAdmin(actor)) return false;
    return getRankLevel(actor.rank) > getRankLevel(target.rank);
}

function canKickFromRoomUser(actor, target) {
    if (!actor || !target) return false;
    if (actor.uid === target.uid) return false;

    if (isKingRank(actor)) return true;

    if (isQueenRank(actor)) {
        if (isKingRank(target)) return false;
        if (isQueenRank(target)) return false;
        return can(actor, 'canKickFromRoom');
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
        return can(actor, 'canJail');
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

    if (isQueenRank(actor)) {
        if (!can(actor, 'canPromote')) return false;
        const allowed = ['User','Premium','Admin','Super Admin','Owner','Grand Owner','Room Owner','Master Owner'];
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

    if (isQueenRank(actor)) {
        if (!can(actor, 'canDemote')) return false;
        if (isKingRank(target)) return false;
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
    if (isQueenRank(user)) {
        if (!can(user, 'canPromote')) return false;
        return !['King','Queen'].includes(targetRank);
    }
    const rank = getRank(user.rank);
    if (rank.canPromote === 'all') return true;
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

    if (actor.uid === target.uid) {
        return can(actor, 'canGiveSelfPoints');
    }

    if (isKingRank(actor)) return true;
    return getRankLevel(actor.rank) > getRankLevel(target.rank);
}

/* ══════════════════════════════════════════════ */
/* ⭐ v6: دوال مساعدة للملكات                    */
/* ══════════════════════════════════════════════ */
function hasCustomPermission(user, permission) {
    if (!user || !user.customPermissions) return false;
    return user.customPermissions[permission] === true;
}

function getCustomPermissionCount(user) {
    if (!user || !user.customPermissions) return 0;
    return Object.keys(user.customPermissions).filter(function(k) {
        return user.customPermissions[k] === true;
    }).length;
}

console.log('📦 Ranks v6 (TEST) loaded:', Object.keys(RANKS).length, 'ranks | 4 Queens + customPermissions');
