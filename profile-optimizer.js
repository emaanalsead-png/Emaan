// ==============================================
// profile-optimizer.js v2
// ==============================================
// ✅ v2 (تصحيح v1):
//   1. _loadOwnerSubject: Object.assign بسيط (يحفظ الحقول الثقيلة)
//   2. إزالة _mergeIdentityLocal (كان يسبب Bug #1)
//   3. استخدام localStorage مباشر بدل saveSession (غير موجود)
// ✅ v1:
//   1. light-fetch في profile.html (20MB → 2KB)
//   2. heavy fields تُجلب في الخلفية
//   3. _startSubjectListener: 44 حقل خفيف بدل النود كامل
//   4. لا يلمس profile-core.js — override نظيف
// ==============================================

(function () {
    'use strict';
    if (window.__profileOptimizerV2) return;
    window.__profileOptimizerV2 = true;

    /* ══════════════════════════════════════════════ */
    /* الحقول الخفيفة — تُجلب فوراً                    */
    /* ══════════════════════════════════════════════ */
    const LIGHT_FIELDS = [
        'name', 'code', 'age', 'gender', 'email', 'rank', 'rankLevel', 'queenOrder',
        'isGuest', 'createdAt', 'lastSeen', 'identityUpdatedAt',
        'avatar', 'cover', 'coverType', 'bio', 'color',
        'nameColor', 'nameGradient', 'nameBgColor', 'nameBgGradient',
        'cinemaTextStyle', 'cinemaBgStyle', 'avatarFrame',
        'profileGlow', 'profileBgType',
        'privacy', 'country', 'family',
        'isBanned', 'bannedUntil', 'isJailed', 'jailUntil',
        'invisible', 'warnings', 'jailCount', 'permanentBan',
        'muteInRoom', 'muteRoom', 'kickCount', 'lastKickAt',
        'banReason', 'jailReason', 'kickReason', 'poetry'
    ];

    /* الحقول الثقيلة — تُجلب في الخلفية */
    const HEAVY_FIELDS = [
        'musicURL', 'profileBgValue', 'poetryBg', 'poetryAttachment'
    ];

    /* ══════════════════════════════════════════════ */
    /* جلب الحقول الخفيفة بالتوازي                    */
    /* ══════════════════════════════════════════════ */
    async function _fetchLightProfileData(uid) {
        if (!uid) return null;
        if (typeof db === 'undefined' || !db) return null;

        const promises = LIGHT_FIELDS.map(function (field) {
            return db.ref('users/' + uid + '/' + field).once('value')
                .then(function (s) { return { f: field, v: s.val() }; })
                .catch(function () { return { f: field, v: null }; });
        });

        const results = await Promise.all(promises);
        const data = { uid: uid };
        let any = false;
        results.forEach(function (r) {
            if (r.v !== null && r.v !== undefined) {
                data[r.f] = r.v;
                any = true;
            }
        });
        return any ? data : null;
    }

    /* ══════════════════════════════════════════════ */
    /* جلب الحقول الثقيلة في الخلفية (lazy)           */
    /* ══════════════════════════════════════════════ */
    function _scheduleHeavyFetch(uid) {
        if (!uid) return;
        setTimeout(function () {
            HEAVY_FIELDS.forEach(function (field) {
                db.ref('users/' + uid + '/' + field).once('value')
                    .then(function (s) {
                        const v = s.val();
                        if (v !== null && v !== undefined) {
                            if (ProfileState.subject) {
                                ProfileState.subject[field] = v;
                            }
                        }
                    })
                    .catch(function () {});
            });

            // بعد 800ms، طبّق التحديثات (music button + poetry)
            setTimeout(function () {
                try {
                    if (typeof applyIdentityToDOM === 'function') applyIdentityToDOM();
                } catch (e) {}
                try {
                    if (typeof renderPoetry === 'function') renderPoetry();
                } catch (e) {}
                console.log('🎨 profile-optimizer: heavy fields loaded (music/bg/poetry)');
            }, 800);
        }, 400);
    }

    /* ══════════════════════════════════════════════ */
    /* Override _loadVisitorSubject                   */
    /* ══════════════════════════════════════════════ */
    const _origLoadVisitor = window._loadVisitorSubject;
    window._loadVisitorSubject = async function (uid) {
        if (!uid) return;
        if (typeof db === 'undefined' || !db) return;

        console.time('👤 visitor-load');
        try {
            const lightData = await _fetchLightProfileData(uid);
            if (!lightData) {
                console.timeEnd('👤 visitor-load');
                if (typeof _origLoadVisitor === 'function') {
                    return _origLoadVisitor.call(this, uid);
                }
                ProfileState.subject = { uid: uid, name: 'مستخدم', rank: 'User' };
                return;
            }

            ProfileState.subject = lightData;
            console.timeEnd('👤 visitor-load');

            // visitor tracking (كما الأصلي)
            if (ProfileState.me && ProfileState.me.uid && ProfileState.me.uid !== uid) {
                db.ref('users/' + uid + '/visitors/' + ProfileState.me.uid).set({
                    time: Date.now(),
                    name: ProfileState.me.name || 'زائر',
                    avatar: ProfileState.me.avatar || ''
                }).catch(function () {});
            }

            // فحص حالة الزائر
            if (typeof checkVisitorStatus === 'function') {
                try { await checkVisitorStatus(); } catch (e) {}
            }

            // ⭐ جلب الحقول الثقيلة في الخلفية
            _scheduleHeavyFetch(uid);

        } catch (e) {
            console.timeEnd('👤 visitor-load');
            console.warn('profile-optimizer: visitor fallback', e);
            if (typeof _origLoadVisitor === 'function') {
                return _origLoadVisitor.call(this, uid);
            }
        }
    };

    /* ══════════════════════════════════════════════ */
    /* Override _loadOwnerSubject                     */
    /* ✅ v2: Object.assign بسيط — لا يفقد الحقول الثقيلة */
    /* ══════════════════════════════════════════════ */
    const _origLoadOwner = window._loadOwnerSubject;
    window._loadOwnerSubject = async function () {
        if (!ProfileState.me || !ProfileState.me.uid) return;
        if (typeof db === 'undefined' || !db) return;

        console.time('👑 owner-load');
        try {
            const lightData = await _fetchLightProfileData(ProfileState.me.uid);
            if (!lightData) {
                console.timeEnd('👑 owner-load');
                if (typeof _origLoadOwner === 'function') {
                    return _origLoadOwner.call(this);
                }
                return;
            }

            // ⭐ v2: Object.assign بسيط — يحفظ الحقول الثقيلة من الكاش
            const merged = Object.assign({}, ProfileState.me, lightData);
            ProfileState.subject = merged;
            ProfileState.me = merged;

            // ⭐ v2: localStorage مباشر (بدل saveSession)
            try {
                const json = JSON.stringify(merged);
                localStorage.setItem(QAMAR.STORAGE_KEYS.CURRENT_USER, json);
                localStorage.setItem(QAMAR.STORAGE_KEYS.USER, json);
            } catch (e) {}

            console.timeEnd('👑 owner-load');

            // ⭐ جلب الحقول الثقيلة في الخلفية
            _scheduleHeavyFetch(ProfileState.me.uid);

        } catch (e) {
            console.timeEnd('👑 owner-load');
            console.warn('profile-optimizer: owner fallback', e);
            if (typeof _origLoadOwner === 'function') {
                return _origLoadOwner.call(this);
            }
        }
    };

    /* ══════════════════════════════════════════════ */
    /* Override _startSubjectListener                 */
    /* ⭐ 44 حقل خفيف + 4 ثقيل = بدل النود كامل      */
    /* ══════════════════════════════════════════════ */
    let _uiUpdateTimer = null;
    function _scheduleUIUpdate() {
        clearTimeout(_uiUpdateTimer);
        _uiUpdateTimer = setTimeout(function () {
            try {
                if (typeof applyIdentityToDOM === 'function') applyIdentityToDOM();
            } catch (e) {}
            try {
                if (typeof renderInfoGrid === 'function') renderInfoGrid();
            } catch (e) {}
        }, 200);
    }

    window._startSubjectListener = function () {
        if (typeof db === 'undefined' || !db) return;
        const subj = ProfileState.subject;
        if (!subj || !subj.uid) return;

        // 1. listeners للحقول الخفيفة فقط
        LIGHT_FIELDS.forEach(function (field) {
            db.ref('users/' + subj.uid + '/' + field).on('value', function (s) {
                const v = s.val();
                if (ProfileState.subject) {
                    ProfileState.subject[field] = v;
                }
                _scheduleUIUpdate();
            }, function () { /* تجاهل أخطاء الصلاحيات */ });
        });

        // 2. listeners للحقول الثقيلة (بدون re-render كامل)
        HEAVY_FIELDS.forEach(function (field) {
            db.ref('users/' + subj.uid + '/' + field).on('value', function (s) {
                const v = s.val();
                if (v !== null && v !== undefined && ProfileState.subject) {
                    ProfileState.subject[field] = v;
                    // نطبق فقط عند التغيير الفعلي
                    try {
                        if (field === 'musicURL' && typeof _applyMusicButton === 'function') {
                            _applyMusicButton(ProfileState.subject);
                        }
                        if ((field === 'profileBgValue') && typeof _applyProfileBackground === 'function') {
                            _applyProfileBackground(ProfileState.subject);
                        }
                        if ((field === 'poetryBg' || field === 'poetryAttachment') && typeof renderPoetry === 'function') {
                            renderPoetry();
                        }
                    } catch (e) {}
                }
            }, function () { /* تجاهل */ });
        });

        // 3. presence listener (للـ visitor فقط)
        if (ProfileState.mode === 'visitor') {
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

        console.log('📡 profile-optimizer: ' + LIGHT_FIELDS.length + ' light listeners + ' + HEAVY_FIELDS.length + ' heavy listeners');
    };

    console.log('📦 profile-optimizer.js v2 loaded — light-fetch profile (20MB → 2KB)');
})();
