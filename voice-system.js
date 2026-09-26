// ==============================================
// voice-system.js v1 — صوت WebRTC Mesh
// ==============================================
// ✅ v1:
//   1. WebRTC Mesh (P2P بين كل من على المايك)
//   2. Firebase Signaling (offer/answer/ICE)
//   3. Google STUN + OpenRelay TURN (مجاني)
//   4. كشف "يتكلم" (AudioContext Analyzer)
//   5. كتم/فتح المايك
//   6. طرد من المايك (65+)
//   7. تنظيف تلقائي عند disconnect
//   8. يعمل مع chat.js v3.16 أو v3.18 (MutationObserver)
// ==============================================

(function () {
    'use strict';
    if (window.__voiceSystemV1) return;
    window.__voiceSystemV1 = true;

    /* ═══ Config ═══ */
    const ICE_SERVERS = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ];

    const SPEAKING_THRESHOLD = 15;
    const SPEAKING_CHECK_MS = 200;
    const MIC_PATH = 'room_voice';
    const KICK_LEVEL = 65;

    /* ═══ State ═══ */
    const VS = {
        active: false,
        currentRoom: null,
        mySlot: null,
        myUid: null,
        muted: false,
        speaking: false,

        localStream: null,
        audioContext: null,
        analyser: null,
        analyserBuf: null,
        speakTimer: null,

        peers: {},          // { remoteUid: RTCPeerConnection }
        remoteAudios: {},   // { remoteUid: HTMLAudioElement }

        micsRef: null,
        micsData: {},
        signalRef: null,
        onDisc: null,

        uiObserver: null,
        lastRenderedHash: '',
        joinLock: false,
        _builtUI: false
    };

    /* ═══ Helpers ═══ */
    function getMe() {
        try {
            if (typeof getCurrentUser === 'function') {
                var u = getCurrentUser();
                if (u && u.uid) return u;
            }
        } catch (e) {}
        try {
            return JSON.parse(localStorage.getItem('qamar_current_user') || 'null');
        } catch (e) { return null; }
    }

    function getRoom() {
        try {
            if (typeof ChatState !== 'undefined' && ChatState.currentRoom) {
                return ChatState.currentRoom;
            }
        } catch (e) {}
        return 'general';
    }

    function getRoomConfig() {
        try {
            var r = getRoom();
            if (typeof QAMAR !== 'undefined' && QAMAR.ROOMS && QAMAR.ROOMS[r]) {
                return QAMAR.ROOMS[r];
            }
        } catch (e) {}
        return { micCount: 0, allowMic: false };
    }

    function myLevel() {
        var u = getMe();
        if (!u) return 0;
        if (typeof u.rankLevel === 'number') return u.rankLevel;
        try {
            if (typeof getRankLevel === 'function') return getRankLevel(u.rank) || 0;
        } catch (e) {}
        return 0;
    }

    function toast(icon, msg) {
        if (typeof showToast === 'function') showToast(icon, msg);
        else console.log('[Voice]', msg);
    }

    function log() {
        console.log('[VoiceSystem]', ...arguments);
    }

    function micsRef(roomId) { return db.ref(MIC_PATH + '/' + roomId + '/mics'); }
    function sigRef(roomId, toUid) { return db.ref(MIC_PATH + '/' + roomId + '/signals/' + toUid); }

    /* ═══ CSS ═══ */
    (function injectCSS() {
        if (document.getElementById('voice-system-css')) return;
        var s = document.createElement('style');
        s.id = 'voice-system-css';
        s.textContent = `
/* hidden audio elements */
.vs-remote-audio { display: none !important; }

/* زرار المايك الجديد */
.vs-slot {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 42px; height: 42px;
    border-radius: 50%;
    background: rgba(255,255,255,0.05);
    border: 2px solid rgba(255,215,0,0.35);
    color: #fff;
    cursor: pointer;
    overflow: visible;
    transition: all 0.2s ease;
    padding: 0;
    font-size: 16px;
    margin: 0 2px;
    flex-shrink: 0;
}
.vs-slot:hover { border-color: rgba(255,215,0,0.8); transform: scale(1.05); }
.vs-slot.empty {
    background: rgba(255,255,255,0.03);
    border-style: dashed;
    color: #666;
}
.vs-slot.empty:hover { color: #ffd700; }
.vs-slot.mine {
    border-color: #84cc16;
    box-shadow: 0 0 10px rgba(132,204,22,0.5);
}
.vs-slot.speaking {
    border-color: #00e676;
    box-shadow: 0 0 14px rgba(0,230,118,0.9);
    animation: vsSpeakPulse 0.9s ease-in-out infinite;
}
@keyframes vsSpeakPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
}
.vs-slot img {
    width: 100%; height: 100%;
    border-radius: 50%;
    object-fit: cover;
    display: block;
}
.vs-slot .vs-mute {
    position: absolute;
    bottom: -2px; left: -2px;
    width: 16px; height: 16px;
    border-radius: 50%;
    background: #ff4444;
    border: 2px solid #050508;
    display: flex; align-items: center; justify-content: center;
    font-size: 8px; color: #fff;
    z-index: 3;
}
.vs-slot .vs-kick {
    position: absolute;
    top: -6px; right: -6px;
    width: 20px; height: 20px;
    border-radius: 50%;
    background: #dc2626;
    border: 2px solid #050508;
    color: #fff; font-size: 10px; font-weight: 900;
    cursor: pointer; padding: 0;
    display: none;
    align-items: center; justify-content: center;
    z-index: 5;
}
.vs-slot:hover .vs-kick.can { display: flex; }
.vs-slot .vs-tip {
    position: absolute;
    bottom: -24px; left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.9);
    color: #fff;
    font-size: 9px; font-weight: 900;
    padding: 3px 8px;
    border-radius: 8px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s;
    z-index: 10;
}
.vs-slot:hover .vs-tip { opacity: 1; }

/* أزرار التحكم */
.vs-controls {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    margin: 0 6px;
    padding: 4px 8px;
    background: rgba(132,204,22,0.12);
    border: 1px solid rgba(132,204,22,0.35);
    border-radius: 20px;
}
.vs-ctrl {
    width: 32px; height: 32px;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,215,0,0.4);
    color: #fff; font-size: 14px;
    cursor: pointer; padding: 0;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
}
.vs-ctrl:hover { background: rgba(255,215,0,0.2); }
.vs-ctrl.muted {
    background: rgba(255,68,68,0.25);
    border-color: #ff4444;
    color: #ff8888;
}
.vs-ctrl.leave {
    background: rgba(255,68,68,0.15);
    border-color: rgba(255,68,68,0.5);
    color: #ff6666;
}
.vs-ctrl.leave:hover { background: rgba(255,68,68,0.3); }

@media (max-width: 480px) {
    .vs-slot { width: 36px; height: 36px; font-size: 14px; }
    .vs-ctrl { width: 28px; height: 28px; font-size: 12px; }
    .vs-controls { padding: 3px 6px; margin: 0 4px; }
}
        `;
        document.head.appendChild(s);
    })();

    /* ═══ UserMedia ═══ */
    async function acquireMic() {
        try {
            return await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            });
        } catch (e) {
            if (e.name === 'NotAllowedError') toast('fa-microphone-slash', '🔇 رفضت إذن المايك');
            else if (e.name === 'NotFoundError') toast('fa-microphone-slash', '🎤 لا يوجد مايك');
            else toast('fa-times', '⚠️ ' + (e.message || 'فشل الوصول للمايك'));
            console.warn('getUserMedia:', e);
            return null;
        }
    }

    /* ═══ Speaking detection ═══ */
    function startSpeakDetect(stream) {
        try {
            var Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            VS.audioContext = new Ctx();
            var src = VS.audioContext.createMediaStreamSource(stream);
            var an = VS.audioContext.createAnalyser();
            an.fftSize = 512;
            an.smoothingTimeConstant = 0.7;
            src.connect(an);
            VS.analyser = an;
            VS.analyserBuf = new Uint8Array(an.frequencyBinCount);

            VS.speakTimer = setInterval(function () {
                if (!VS.analyser || VS.muted) {
                    if (VS.speaking) { VS.speaking = false; publishSpeaking(false); }
                    return;
                }
                VS.analyser.getByteFrequencyData(VS.analyserBuf);
                var sum = 0;
                for (var i = 0; i < VS.analyserBuf.length; i++) sum += VS.analyserBuf[i];
                var avg = sum / VS.analyserBuf.length;
                var now = avg > SPEAKING_THRESHOLD;
                if (now !== VS.speaking) {
                    VS.speaking = now;
                    publishSpeaking(now);
                }
            }, SPEAKING_CHECK_MS);
        } catch (e) {
            console.warn('speaking detect failed:', e);
        }
    }

    function stopSpeakDetect() {
        if (VS.speakTimer) { clearInterval(VS.speakTimer); VS.speakTimer = null; }
        if (VS.audioContext) {
            try { VS.audioContext.close(); } catch (e) {}
            VS.audioContext = null;
        }
        VS.analyser = null;
        VS.analyserBuf = null;
    }

    function publishSpeaking(isSpeaking) {
        if (VS.mySlot === null || !VS.currentRoom) return;
        db.ref(MIC_PATH + '/' + VS.currentRoom + '/mics/' + VS.mySlot + '/speaking')
            .set(isSpeaking).catch(function () {});
    }

    /* ═══ WebRTC ═══ */
    function createPeer(remoteUid, isInitiator) {
        if (VS.peers[remoteUid]) return VS.peers[remoteUid];

        var pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        VS.peers[remoteUid] = pc;

        // add local tracks
        if (VS.localStream) {
            VS.localStream.getTracks().forEach(function (t) {
                try { pc.addTrack(t, VS.localStream); } catch (e) {}
            });
        }

        // ICE
        pc.onicecandidate = function (e) {
            if (e.candidate) {
                sendSignal(remoteUid, 'ice', { candidate: e.candidate });
            }
        };

        // remote track
        pc.ontrack = function (e) {
            attachRemoteAudio(remoteUid, e.streams[0]);
        };

        // connection state
        pc.onconnectionstatechange = function () {
            log('peer ' + remoteUid.substring(0, 6) + ' → ' + pc.connectionState);
            if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                // احذف وأعد المحاولة إذا لزم
                if (pc.connectionState === 'failed') {
                    setTimeout(function () {
                        if (!VS.peers[remoteUid]) return;
                        if (VS.peers[remoteUid].connectionState === 'failed') {
                            closePeer(remoteUid);
                            if (VS.micsData && hasUidOnMic(remoteUid)) {
                                // أعد الإنشاء
                                var initiator = VS.myUid < remoteUid;
                                createPeer(remoteUid, initiator);
                            }
                        }
                    }, 2500);
                }
            }
        };

        if (isInitiator) {
            pc.onnegotiationneeded = function () {
                pc.createOffer()
                    .then(function (off) { return pc.setLocalDescription(off); })
                    .then(function () {
                        sendSignal(remoteUid, 'offer', { sdp: pc.localDescription });
                    })
                    .catch(function (e) { console.warn('offer fail:', e); });
            };
        }

        return pc;
    }

    function closePeer(remoteUid) {
        if (VS.peers[remoteUid]) {
            try { VS.peers[remoteUid].close(); } catch (e) {}
            delete VS.peers[remoteUid];
        }
        if (VS.remoteAudios[remoteUid]) {
            try {
                VS.remoteAudios[remoteUid].pause();
                VS.remoteAudios[remoteUid].srcObject = null;
                VS.remoteAudios[remoteUid].remove();
            } catch (e) {}
            delete VS.remoteAudios[remoteUid];
        }
    }

    function closeAllPeers() {
        Object.keys(VS.peers).slice().forEach(closePeer);
    }

    function attachRemoteAudio(remoteUid, stream) {
        var a = VS.remoteAudios[remoteUid];
        if (!a) {
            a = document.createElement('audio');
            a.autoplay = true;
            a.className = 'vs-remote-audio';
            a.setAttribute('playsinline', '');
            document.body.appendChild(a);
            VS.remoteAudios[remoteUid] = a;
        }
        a.srcObject = stream;
        a.play().catch(function (e) {
            console.warn('autoplay fail:', e);
            toast('fa-volume-up', '🔊 اضغط لتفعيل الصوت');
        });
    }

    /* ═══ Signaling ═══ */
    function sendSignal(toUid, type, payload) {
        if (!VS.currentRoom || !VS.myUid) return;
        sigRef(VS.currentRoom, toUid).push({
            fromUid: VS.myUid,
            type: type,
            payload: payload,
            at: firebase.database.ServerValue.TIMESTAMP
        }).catch(function (e) { console.warn('sendSignal fail:', e); });
    }

    function startSignalListener() {
        if (!VS.currentRoom || !VS.myUid) return;
        stopSignalListener();
        var ref = sigRef(VS.currentRoom, VS.myUid);
        VS.signalRef = ref;
        ref.on('child_added', function (snap) {
            var sig = snap.val();
            if (!sig || sig.fromUid === VS.myUid) {
                snap.ref.remove().catch(function () {});
                return;
            }
            handleSignal(sig).then(function () {
                snap.ref.remove().catch(function () {});
            });
        });
    }

    function stopSignalListener() {
        if (VS.signalRef) {
            try { VS.signalRef.off(); } catch (e) {}
            VS.signalRef = null;
        }
    }

    async function handleSignal(sig) {
        try {
            var from = sig.fromUid;
            if (sig.type === 'offer') {
                var pc = VS.peers[from] || createPeer(from, false);
                await pc.setRemoteDescription(new RTCSessionDescription(sig.payload.sdp));
                var ans = await pc.createAnswer();
                await pc.setLocalDescription(ans);
                sendSignal(from, 'answer', { sdp: pc.localDescription });
            } else if (sig.type === 'answer') {
                var pc2 = VS.peers[from];
                if (pc2 && pc2.signalingState !== 'stable') {
                    await pc2.setRemoteDescription(new RTCSessionDescription(sig.payload.sdp));
                }
            } else if (sig.type === 'ice') {
                var pc3 = VS.peers[from];
                if (pc3 && sig.payload.candidate) {
                    try { await pc3.addIceCandidate(new RTCIceCandidate(sig.payload.candidate)); }
                    catch (e) {}
                }
            }
        } catch (e) {
            console.warn('handleSignal:', e);
        }
    }

    /* ═══ Mics listener ═══ */
    function hasUidOnMic(uid) {
        if (!VS.micsData) return false;
        return Object.keys(VS.micsData).some(function (k) {
            return VS.micsData[k] && VS.micsData[k].uid === uid;
        });
    }

    function startMicsListener() {
        if (!VS.currentRoom) return;
        stopMicsListener();
        var ref = micsRef(VS.currentRoom);
        VS.micsRef = ref;
        ref.on('value', function (snap) {
            VS.micsData = snap.val() || {};
            onMicsUpdate(VS.micsData);
        });
    }

    function stopMicsListener() {
        if (VS.micsRef) {
            try { VS.micsRef.off(); } catch (e) {}
            VS.micsRef = null;
        }
        VS.micsData = {};
    }

    function onMicsUpdate(data) {
        // أعد رسم UI
        renderSlots(data);

        // إذا لست على المايك → لا شيء آخر
        if (VS.mySlot === null || !VS.myUid) return;

        // تحقق من الطرد
        var my = data[VS.mySlot];
        if (!my || my.uid !== VS.myUid) {
            log('I was kicked');
            toast('fa-user-slash', '🚪 تم إنزالك من المايك');
            leaveMic();
            return;
        }

        // رصيف الاتصالات
        var others = [];
        Object.keys(data).forEach(function (k) {
            var s = data[k];
            if (s && s.uid && s.uid !== VS.myUid) others.push(s.uid);
        });

        // أنشئ peers جديدة
        others.forEach(function (uid) {
            if (!VS.peers[uid]) {
                var initiator = VS.myUid < uid;
                createPeer(uid, initiator);
            }
        });

        // أغلق peers لمن خرج
        Object.keys(VS.peers).forEach(function (uid) {
            if (others.indexOf(uid) === -1) closePeer(uid);
        });
    }

    /* ═══ Render Slots ═══ */
    function renderSlots(data) {
        var config = getRoomConfig();
        if (!config.micCount || config.micCount < 1) return;

        var container = document.querySelector('#mics-bar .mics');
        if (!container) return;

        // منع flicker: hash check
        var hash = JSON.stringify(data || {}) + '|' + VS.mySlot + '|' + VS.muted;
        if (hash === VS.lastRenderedHash && container.querySelector('.vs-slot')) return;
        VS.lastRenderedHash = hash;

        var me = getMe();
        var lvl = myLevel();
        var canKick = lvl >= KICK_LEVEL;

        container.innerHTML = '';

        for (var i = 0; i < config.micCount; i++) {
            var slotData = data && data[i] ? data[i] : null;
            var el = document.createElement('button');
            el.type = 'button';
            el.className = 'vs-slot';
            el.setAttribute('data-slot', i);

            if (!slotData || !slotData.uid) {
                el.classList.add('empty');
                el.innerHTML = '<span class="vs-icon">＋</span>';
                el.title = 'اركب المايك ' + (i + 1);
                el.onclick = (function () { return function () { if (!VS.active) joinMic(); }; })();
            } else {
                var isMine = slotData.uid === VS.myUid;
                if (isMine) el.classList.add('mine');
                if (slotData.speaking) el.classList.add('speaking');

                var img = document.createElement('img');
                img.src = slotData.avatar || 'https://ui-avatars.com/api/?name=' +
                    encodeURIComponent(slotData.name || 'U') + '&background=333&color=fff';
                img.onerror = function () {
                    this.src = 'https://ui-avatars.com/api/?name=U&background=333&color=fff';
                };
                el.appendChild(img);

                if (slotData.muted) {
                    var mb = document.createElement('span');
                    mb.className = 'vs-mute';
                    mb.textContent = '🔇';
                    el.appendChild(mb);
                }

                if (canKick && !isMine) {
                    var kb = document.createElement('button');
                    kb.type = 'button';
                    kb.className = 'vs-kick can';
                    kb.textContent = '✕';
                    kb.title = 'أنزله من المايك';
                    kb.onclick = (function (uid, name) {
                        return function (e) {
                            e.stopPropagation();
                            e.preventDefault();
                            if (confirm('إنزال ' + (name || 'المستخدم') + ' من المايك؟')) {
                                kickFromMic(uid);
                            }
                        };
                    })(slotData.uid, slotData.name);
                    el.appendChild(kb);
                }

                var tip = document.createElement('span');
                tip.className = 'vs-tip';
                tip.textContent = slotData.name || 'مستخدم';
                el.appendChild(tip);

                el.onclick = (function (uid, name, mine) {
                    return function () {
                        if (mine) {
                            if (confirm('تنزل من المايك؟')) leaveMic();
                        }
                    };
                })(slotData.uid, slotData.name, isMine);
            }

            container.appendChild(el);
        }

        renderControls();
    }

    function renderControls() {
        var wrapper = document.querySelector('.mics-bar-wrapper');
        if (!wrapper) return;

        var existing = wrapper.querySelector('.vs-controls');

        if (!VS.active) {
            if (existing) existing.remove();
            return;
        }

        if (!existing) {
            var ctrl = document.createElement('div');
            ctrl.className = 'vs-controls';
            ctrl.innerHTML =
                '<button type="button" class="vs-ctrl" data-action="mute">🎤</button>' +
                '<button type="button" class="vs-ctrl leave" data-action="leave">✕</button>';
            wrapper.appendChild(ctrl);

            ctrl.querySelector('[data-action="mute"]').onclick = toggleMute;
            ctrl.querySelector('[data-action="leave"]').onclick = function () {
                if (confirm('تنزل من المايك؟')) leaveMic();
            };
            existing = ctrl;
        }

        var muteBtn = existing.querySelector('[data-action="mute"]');
        if (muteBtn) {
            muteBtn.classList.toggle('muted', VS.muted);
            muteBtn.textContent = VS.muted ? '🔇' : '🎤';
        }
    }

    /* ═══ Join / Leave / Mute ═══ */
    async function joinMic() {
        if (VS.joinLock || VS.active) return;
        VS.joinLock = true;

        try {
            var me = getMe();
            if (!me || !me.uid) {
                toast('fa-user', '⚠️ سجّل دخول أولاً');
                return;
            }

            var room = getRoom();
            var config = getRoomConfig();

            if (!config.allowMic) { toast('fa-lock', '🔒 المايك غير متاح هنا'); return; }
            if (!config.micCount || config.micCount < 1) { toast('fa-info', 'ℹ️ لا يوجد مايكات'); return; }

            var stream = await acquireMic();
            if (!stream) return;

            // ابحث عن slot فاضي
            var snap = await micsRef(room).once('value');
            var data = snap.val() || {};
            var slot = -1;
            for (var i = 0; i < config.micCount; i++) {
                var s = data[i];
                if (!s || !s.uid || s.uid === me.uid) { slot = i; break; }
            }

            if (slot === -1) {
                toast('fa-microphone-slash', '📢 كل المايكات ممتلئة');
                stream.getTracks().forEach(function (t) { t.stop(); });
                return;
            }

            // حالة
            VS.active = true;
            VS.currentRoom = room;
            VS.mySlot = slot;
            VS.myUid = me.uid;
            VS.muted = false;
            VS.localStream = stream;

            // Firebase
            await db.ref(MIC_PATH + '/' + room + '/mics/' + slot).set({
                uid: me.uid,
                name: me.name || 'مستخدم',
                avatar: me.avatar || '',
                muted: false,
                speaking: false,
                joinedAt: firebase.database.ServerValue.TIMESTAMP
            });

            // onDisconnect
            VS.onDisc = db.ref(MIC_PATH + '/' + room + '/mics/' + slot).onDisconnect();
            VS.onDisc.remove();

            // ابدأ
            startSpeakDetect(stream);
            startMicsListener();
            startSignalListener();
            VS.lastRenderedHash = '';
            renderSlots(VS.micsData);
            renderControls();

            toast('fa-microphone', '🎤 أنت على المايك ' + (slot + 1));
            log('joined mic slot', slot);

        } catch (e) {
            console.error('joinMic:', e);
            toast('fa-times', '⚠️ فشل الانضمام: ' + (e.message || ''));
        } finally {
            VS.joinLock = false;
        }
    }

    async function leaveMic() {
        if (!VS.active) return;

        var room = VS.currentRoom;
        var slot = VS.mySlot;

        // احذف slotي
        try {
            if (room && slot !== null) {
                if (VS.onDisc) { try { VS.onDisc.cancel(); } catch (e) {} }
                await db.ref(MIC_PATH + '/' + room + '/mics/' + slot).remove();
            }
        } catch (e) {}

        // نظّف
        stopSpeakDetect();
        closeAllPeers();
        stopMicsListener();
        stopSignalListener();

        if (VS.localStream) {
            VS.localStream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
            VS.localStream = null;
        }

        VS.active = false;
        VS.currentRoom = null;
        VS.mySlot = null;
        VS.myUid = null;
        VS.muted = false;
        VS.speaking = false;
        VS.micsData = {};
        VS.onDisc = null;
        VS.lastRenderedHash = '';

        renderControls();
        var c = document.querySelector('#mics-bar .mics');
        if (c) c.innerHTML = '';
        toast('fa-microphone-slash', '👋 نزلت من المايك');
    }

    function toggleMute() {
        if (!VS.active || !VS.localStream) return;
        VS.muted = !VS.muted;
        VS.localStream.getAudioTracks().forEach(function (t) { t.enabled = !VS.muted; });
        if (VS.currentRoom && VS.mySlot !== null) {
            db.ref(MIC_PATH + '/' + VS.currentRoom + '/mics/' + VS.mySlot + '/muted')
                .set(VS.muted).catch(function () {});
        }
        toast('fa-microphone' + (VS.muted ? '-slash' : ''),
              VS.muted ? '🔇 تم كتم مايكك' : '🎤 تم فتح مايكك');
        renderControls();
    }

    async function kickFromMic(uid) {
        if (!VS.currentRoom) return;
        var me = getMe();
        if (!me) return;
        if (myLevel() < KICK_LEVEL) { toast('fa-lock', '🔒 لا تملك صلاحية'); return; }

        var snap = await micsRef(VS.currentRoom).once('value');
        var data = snap.val() || {};
        var targetSlot = null;
        Object.keys(data).forEach(function (k) {
            if (data[k] && data[k].uid === uid) targetSlot = k;
        });
        if (targetSlot === null) return;

        await db.ref(MIC_PATH + '/' + VS.currentRoom + '/mics/' + targetSlot).remove();

        try {
            db.ref('audit_log').push({
                type: 'kick_from_mic',
                byUid: me.uid,
                byName: me.name,
                targetUid: uid,
                roomId: VS.currentRoom,
                slot: targetSlot,
                at: firebase.database.ServerValue.TIMESTAMP
            }).catch(function () {});
        } catch (e) {}

        toast('fa-check', '✅ تم إنزاله من المايك');
    }

    /* ═══ MutationObserver — بديل updateMicsUI القديمة ═══ */
    function startUIObserver() {
        var bar = document.getElementById('mics-bar');
        if (!bar) return;

        if (VS.uiObserver) VS.uiObserver.disconnect();

        VS.uiObserver = new MutationObserver(function (muts) {
            // هل التغيير جاي من عندنا؟
            var fromUs = false;
            var container = bar.querySelector('.mics');
            if (!container) return;
            if (container.querySelector('.vs-slot')) fromUs = true;

            if (fromUs) return;

            // chat.js v3.16 استبدل الأزرار → نعيد البناء
            setTimeout(function () {
                if (!VS.active && !VS.micsData) {
                    // لسنا على المايك → نعرض slots فاضية
                    renderSlots({});
                } else if (VS.active) {
                    renderSlots(VS.micsData);
                }
            }, 30);
        });

        VS.uiObserver.observe(bar, { childList: true, subtree: true });
        log('UI observer attached');
    }

    /* ═══ مراقبة تغيير الغرفة ═══ */
    var _lastRoom = null;
    function watchRoom() {
        setInterval(function () {
            var r = getRoom();
            if (r !== _lastRoom) {
                var was = VS.active;
                _lastRoom = r;
                if (was) {
                    leaveMic().then(function () {
                        VS.lastRenderedHash = '';
                        renderSlots({});
                    });
                } else {
                    VS.lastRenderedHash = '';
                    renderSlots({});
                }
            }
        }, 500);
    }

    /* ═══ Cleanup ═══ */
    function cleanup() {
        if (VS.active) leaveMic();
    }
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);

    /* ═══ Public API ═══ */
    window.VoiceSystem = {
        join: joinMic,
        leave: leaveMic,
        toggleMute: toggleMute,
        kick: kickFromMic,
        isActive: function () { return VS.active; },
        isMuted: function () { return VS.muted; },
        getMySlot: function () { return VS.mySlot; },
        version: 1
    };

    /* ═══ Init ═══ */
    function init() {
        var tries = 0;
        var t = setInterval(function () {
            tries++;
            var hasBar = document.querySelector('#mics-bar .mics');
            var hasUser = !!(getMe() && getMe().uid);
            var hasDb = typeof db !== 'undefined' && db;

            if (hasBar && hasUser && hasDb) {
                clearInterval(t);
                _lastRoom = getRoom();
                startUIObserver();
                renderSlots({});
                watchRoom();
                log('✅ ready');
                return;
            }
            if (tries >= 60) {
                clearInterval(t);
                console.warn('VoiceSystem: init timeout');
            }
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('🎤 voice-system.js v1 loaded — WebRTC Mesh + Firebase signaling');
})();
