// ==============================================
// new-rank-88.js v1 — إضافة رتبة "ملك" (88)
// ==============================================

(function () {
    'use strict';
    if (window.__newRank88V1) return;
    window.__newRank88V1 = true;

    var RANK_NAME = 'ملك';
    var RANK_LEVEL = 88;
    var RANK_BADGE = '🤴';
    var RANK_COLOR = '#c084fc';

    function addRank() {
        if (typeof RANKS === 'undefined' || typeof QAMAR === 'undefined') return false;
        if (RANKS[RANK_NAME]) return true;

        /* صلاحيات ملكية — أعلى من Master Owner وأقل من King */
        RANKS[RANK_NAME] = {
            badge: RANK_BADGE,
            color: RANK_COLOR,
            level: RANK_LEVEL,
            canEditAllProfiles: false, canEditNames: false, canSeePrivateInfo: false,
            canPromote: 'below_self_one', canDemote: 'below_self',
            canSetQueen1: false, canSetQueen2: false,
            canWarn: true, canJail: 'below_self', canJailUnlimited: false,
            canBan: 'below_self', canBanAdmins: false, canBanQueens: false,
            canUnban: 'same_or_lower', canDeleteAccount: false,
            canKickFromRoom: 'below_self', canKickFromMic: 'below_self',
            canDeleteAnyMessage: true, canSeePrivateMessages: false,
            canSeeDeletedMessages: false, canEditOthersMessages: false,
            canAccessRoyal: true, canInviteToRoyal: true,
            canAccessStudio: true, canAccessBotTraining: false,
            canCreateRooms: true, canDeleteRooms: false,
            canEditRooms: true, canMuteRoom: true,
            canOpenKingPanel: false, canEditHakawati: false,
            canEditQuiz: false, canEditIslamic: false,
            canEditBadWords: false, canEditKickWords: false,
            canTrainBots: false, canDeleteBotMemory: false,
            canGivePoints: true, canGiveSelfPoints: false,
            canClearUserPoints: false, canResetAllPoints: false,
            canAnnounceRoom: false, canAnnounceAll: false, canPushAnnounce: false,
            canSendRoomAlert: true, canSendGlobalAlert: false,
            canInvisible: false, canViewAuditLog: false,
            canEditConfig: false, canSetKingUid: false,
            canUseMic: true, canResetPasswords: false
        };

        QAMAR.RANK_LEVELS[RANK_NAME] = RANK_LEVEL;

        /* إضافة في RANKS_ORDERED بعد Queen */
        if (QAMAR.RANKS_ORDERED.indexOf(RANK_NAME) === -1) {
            var idx = QAMAR.RANKS_ORDERED.indexOf('Queen');
            if (idx === -1) idx = 0;
            QAMAR.RANKS_ORDERED.splice(idx + 1, 0, RANK_NAME);
        }

        console.log('✅ new-rank-88: "ملك" added at level ' + RANK_LEVEL);
        return true;
    }

    var attempts = 0;
    var t = setInterval(function () {
        attempts++;
        if (addRank() || attempts >= 50) clearInterval(t);
    }, 200);

    console.log('✅ new-rank-88.js loaded');
})();
