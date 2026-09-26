// ==============================================
// voice-system.js v1 — نظام صوت WebRTC Mesh
// ==============================================
// ✅ v1:
//   1. WebRTC Mesh (P2P كامل بين المتصلين)
//   2. Firebase Signaling (offer/answer/ICE)
//   3. STUN مجاني + OpenRelay TURN fallback
//   4. كشف "يتكلم" (AudioContext Analyzer)
//   5. كتم/فتح المايك
//   6. طرد من المايك (للأدمن)
//   7. تنظيف تلقائي عند disconnect
//   8. عزل غرفة كامل
//   9. Adapter Pattern (جاهز للمستقبل)
// ==============================================

(function () {
    'use strict';
    if (window.__voiceSystemV1) return;
    window.__voiceSystemV1 = true;

    /* ══════════════════════════════════════════════ */
    /* ICE Servers (مجاني — بدون تسجيل)               */
    /* ══════════════════════════════════════════════ */
    var ICE_SERVERS = [
        // Google STUN (سريع جداً)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        // Cloudflare STUN
        { urls: 'stun:stun.cloudflare.com:3478' },
        // OpenRelay TURN (مجاني — لا تسجيل)
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

    /* ══════════════════════════════════════════════ */
    /* State                                          */
    /* ══════════════════════════════════════════════ */
    var VS = {
        active: false,                // أنا على المايك؟
        currentRoom: null,
        mySlot: null,                 // رقم slot 0..N-1
        myUid: null,
        myName: null,
        myAvatar: null,
        muted: false,
        speaking: false,

        localStream: null,            // mic stream
        audioContext: null,
        analyser: null,
        analyserData: null,
        speakingCheckInterval: null,

        // WebRTC
        peers: {},                    // { uid: RTCPeerConnection }
        remoteAudios: {},             // { uid: HTMLAudioElement }

        // Firebase
        micsListener: null,
        signalListener: null,
        micsRef: null,
        signalRef: null,
        onDisconnectMics: null,

        // UI
        uiBuilt: false,

        // Anti-double
        _processingSignal: false,
        _joinLock: false
    };

    /* ══════════════════════════════════════════════ */
    /* Helpers                                        */
    /* ══════════════════════════════════════════════ */
    function getMe() {
        try {
            if (typeof getCurrentUser === 'function') return getCurrentUser();
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

    function toast(icon, msg) {
        if (typeof showToast === 'function') showToast(icon, msg);
        else console.log('[VoiceSystem]', msg);
    }

    function log() {
        var args = Array.prototype.slice.call(arguments);
        console.log('[VoiceSystem]', ...args);
    }

    /* ══════════════════════════════════════════════ */
    /* CSS Injection                                  */
    /* ══════════════════════════════════════════════ */
    (function injectCSS() {
        if (document.getElementById('voice-system-css')) return;
        var s = document.createElement('style');
        s.id = 'voice-system-css';
        s.textContent = `
/* ═══ Slots الجديدة ═══ */
.vs-mic-slot {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(255,255,255,0.05);
    border: 2px solid rgba(255,215,0,0.3);
    color: #fff;
    cursor: pointer;
    overflow: visible;
    transition: all 0.2s ease;
    padding: 0;
}
.vs-mic-slot:hover {
    border-color: rgba(255,215,0,0.7);
    transform: scale(1.05);
}
.vs-mic-slot.empty {
    background: rgba(255,255,255,0.03);
    border-style: dashed;
    color: #666;
}
.vs-mic-slot.empty:hover {
    border-color: rgba(255,215,0,0.6);
    color: #ffd700;
}
.vs-mic-slot.mine {
    border-color: #84cc16;
    box-shadow: 0 0 12px rgba(132,204,22,0.5);
}
.vs-mic-slot.speaking {
    border-color: #00e676;
    box-shadow: 0 0 15px rgba(0,230,118,0.9), 0 0 30px rgba(0,230,118,0.5);
    animation: vsSpeakPulse 0.8s ease-in-out infinite;
}
@keyframes vsSpeakPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.08); }
}
.vs-mic-slot .vs-avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    display: block;
}
.vs-mic-slot .vs-icon {
    font-size: 18px;
    pointer-events: none;
}
.vs-mic-slot .vs-mute-badge {
    position: absolute;
    bottom: -2px;
    left: -2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #ff4444;
    border: 2px solid #050508;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    color: #fff;
    z-index: 3;
}
.vs-mic-slot .vs-kick-btn {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #dc2626;
    border: 2px solid #050508;
    color: #fff;
    font-size: 10px;
    font-weight: 900;
    cursor: pointer;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 0;
    z-index: 5;
}
.vs-mic-slot:hover .vs-kick-btn.can-kick {
    display: flex;
}
.vs-mic-slot .vs-name-tip {
    position: absolute;
    bottom: -22px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.9);
    color: #fff;
    font-size: 9px;
    font-weight: 900;
    padding: 3px 8px;
    border-radius: 8px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
    z-index: 10;
}
.vs-mic-slot:hover .vs-name-tip {
    opacity: 1;
}

/* ═══ أزرار التحكم بصوتي ═══ */
.vs-controls {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-right: 8px;
}
.vs-ctrl-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
    border: 2px solid rgba(255,215,0,0.4);
    color: #fff;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: all 0.2s;
}
.vs-ctrl-btn:hover {
    background: rgba(255,215,0,0.15);
    border-color: #ffd700;
}
.vs-ctrl-btn.muted {
    background: rgba(255,68,68,0.2);
    border-color: #ff4444;
    color: #ff8888;
}
.vs-ctrl-btn.leave {
    background: rgba(255,68,68,0.15);
    border-color: rgba(255,68,68,0.5);
    color: #ff6666;
}

/* ═══ حالة الاتصال ═══ */
.vs-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: rgba(132,204,22,0.15);
    border: 1px solid rgba(132,204,22,0.4);
    border-radius: 20px;
    color: #a3e635;
    font-size: 11px;
    font-weight: 900;
    margin-right: 8px;
}
.vs-status.disconnected {
    background: rgba(255,68,68,0.15);
    border-color: rgba(255,68,68,0.4);
    color: #ff8888;
}
.vs-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    animation: vsDotPulse 1.5s ease-in-out infinite;
}
@keyframes vsDotPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
}

/* ═══ Responsive ═══ */
@media (max-width: 480px) {
    .vs-mic-slot { width: 38px; height: 38px; }
    .vs-mic-slot .vs-icon { font-size: 15px; }
    .vs-ctrl-btn { width: 34px; height: 34px; font-size: 14px; }
}
        `;
        document.head.appendChild(s);
    })();

    /* ══════════════════════════════════════════════ */
    /* Firebase Paths                                 */
    /* ══════════════════════════════════════════════ */
    function micsPath(roomId) {
        return 'room_voice/' + roomId + '/mics';
    }
    function signalsPath(roomId, toUid) {
        return 'room_voice/' + roomId + '/signals/' + toUid;
    }

    /* ══════════════════════════════════════════════ */
    /* getUserMedia                                   */
    /* ══════════════════════════════════════════════ */
    async function acquireMic() {
        try {
            var stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            });
            return stream;
        } catch (e) {
            console.error('getUserMedia failed:', e);
            if (e.name === 'NotAllowedError') {
                toast('fa-microphone-slash', '🔇 رفضت إذن المايك');
            } else if (e.name === 'NotFoundError') {
                toast('fa-microphone-slash', '🎤 لا يوجد مايك');
            } else {
                toast('fa-times', '⚠️ فشل الوصول للمايك: ' + e.message);
            }
            return null;
        }
    }

    /* ══════════════════════════════════════════════ */
    /* كشف "يتكلم"                                    */
    /* ══════════════════════════════════════════════ */
    function startSpeakingDetection(stream) {
        try {
            var ctx = new (window.AudioContext || window.webkitAudioContext)();
            VS.audioContext = ctx;
            var source = ctx.createMediaStreamSource(stream);
            var analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.7;
            source.connect(analyser);
            VS.analyser = analyser;
            VS.analyserData = new Uint8Array(analyser.frequencyBinCount);

            VS.speakingCheckInterval = setInterval(function () {
                if (!VS.analyser || VS.muted) {
                    if (VS.speaking) {
                        VS.speaking = false;
                        publishSpeaking(false);
                    }
                    return;
                }
                VS.analyser.getByteFrequencyData(VS.analyserData);
                var sum = 0;
                for (var i = 0; i < VS.analyserData.length; i++) {
                    sum += VS.analyserData[i];
                }
                var avg = sum / VS.analyserData.length;
                var nowSpeaking = avg > 15; // عتبة
                if (nowSpeaking !== VS.speaking) {
                    VS.speaking = nowSpeaking;
                    publishSpeaking(nowSpeaking);
                }
            }, 200);
        } catch (e) {
            console.warn('speaking detection failed:', e);
        }
    }

    function stopSpeakingDetection() {
        if (VS.speakingCheckInterval) {
            clearInterval(VS.speakingCheckInterval);
            VS.speakingCheckInterval = null;
        }
        if (VS.audioContext) {
            try { VS.audioContext.close(); } catch (e) {}
            VS.audioContext = null;
        }
        VS.analyser = null;
        VS.analyserData = null;
    }

    function publishSpeaking(isSpeaking) {
        if (!VS.mySlot || !VS.currentRoom) return;
        try {
            db.ref(micsPath(VS.currentRoom) + '/' + VS.mySlot + '/speaking').set(isSpeaking)
                .catch(function () {});
        } catch (e) {}
    }

    /* ══════════════════════════════════════════════ */
    /* WebRTC — إنشاء Peer Connection                 */
    /* ══════════════════════════════════════════════ */
    function createPeer(remoteUid, isInitiator) {
        if (VS.peers[remoteUid]) {
            return VS.peers[remoteUid];
        }

        var pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        VS.peers[remoteUid] = pc;

        // أضف مسارات الصوت المحلية
        if (VS.localStream) {
            VS.localStream.getTracks().forEach(function (track) {
                pc.addTrack(track, VS.localStream);
            });
        }

        // ICE candidates → أرسل عبر Firebase
        pc.onicecandidate = function (e) {
            if (e.candidate) {
                sendSignal(remoteUid, 'ice', { candidate: e.candidate });
            }
        };

        // استقبل المسارات البعيدة
        pc.ontrack = function (e) {
            var stream = e.streams[0];
            attachRemoteAudio(remoteUid, stream);
        };

        // حالة الاتصال
        pc.onconnectionstatechange = function () {
            log('peer ' + remoteUid.substring(0, 6) + ' state:', pc.connectionState);
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                setTimeout(function () {
                    if (VS.peers[remoteUid] && pc.connectionState !== 'connected') {
                        log('retry peer', remoteUid.substring(0, 6));
                        closePeer(remoteUid);
                        if (VS.micsData && VS.micsData[remoteUid]) {
                            var shouldInitiate = VS.myUid < remoteUid;
                            createPeer(remoteUid, shouldInitiate);
                        }
                    }
                }, 3000);
            }
        };

        // أنا البادئ؟ أنشئ offer
        if (isInitiator) {
            pc.onnegotiationneeded = function () {
                pc.createOffer()
                    .then(function (offer) {
                        return pc.setLocalDescription(offer);
                    })
                    .then(function () {
                        sendSignal(remoteUid, 'offer', { sdp: pc.localDescription });
                    })
                    .catch(function (e) { console.warn('offer failed:', e); });
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
                if (VS.remoteAudios[remoteUid].parentNode) {
                    VS.remoteAudios[remoteUid].parentNode.removeChild(VS.remoteAudios[remoteUid]);
                }
            } catch (e) {}
            delete VS.remoteAudios[remoteUid];
        }
    }

    function closeAllPeers() {
        Object.keys(VS.peers).forEach(closePeer);
    }

    function attachRemoteAudio(remoteUid, stream) {
        var audio = VS.remoteAudios[remoteUid];
        if (!audio) {
            audio = document.createElement('audio');
            audio.autoplay = true;
            audio.style.display = 'none';
            document.body.appendChild(audio);
            VS.remoteAudios[remoteUid] = audio;
        }
        audio.srcObject = stream;
        audio.play().catch(function (e) {
            console.warn('audio autoplay failed:', e);
        });
    }

    /* ══════════════════════════════════════════════ */
    /* Signaling عبر Firebase                         */
    /* ══════════════════════════════════════════════ */
    function sendSignal(toUid, type, payload) {
        if (!VS.currentRoom || !VS.myUid) return;
        var ref = db.ref(signalsPath(VS.currentRoom, toUid)).push();
        ref.set({
            fromUid: VS.myUid,
            type: type,
            payload: payload,
            at: firebase.database.ServerValue.TIMESTAMP
        }).catch(function (e) { console.warn('send signal failed:', e); });
    }

    function startSignalListener() {
        if (!VS.currentRoom || !VS.myUid) return;
        stopSignalListener();

        var ref = db.ref(signalsPath(VS.currentRoom, VS.myUid));
        VS.signalRef = ref;

        ref.on('child_added', function (snap) {
            var sig = snap.val();
            if (!sig || !sig.fromUid || !sig.type) return;
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
        var fromUid = sig.fromUid;
        if (fromUid === VS.myUid) return;

        try {
            if (sig.type === 'offer') {
                var pc = VS.peers[fromUid] || createPeer(fromUid, false);
                await pc.setRemoteDescription(new RTCSessionDescription(sig.payload.sdp));
                var answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                sendSignal(fromUid, 'answer', { sdp: pc.localDescription });
            } else if (sig.type === 'answer') {
                var pc2 = VS.peers[fromUid];
                if (pc2 && pc2.signalingState !== 'stable') {
                    await pc2.setRemoteDescription(new RTCSessionDescription(sig.payload.sdp));
                }
            } else if (sig.type === 'ice') {
                var pc3 = VS.peers[fromUid];
                if (pc3 && sig.payload.candidate) {
                    try {
                        await pc3.addIceCandidate(new RTCIceCandidate(sig.payload.candidate));
                    } catch (e) {
                        // قد يصل ICE قبل setRemoteDescription — نتجاهل
                    }
                }
            }
        } catch (e) {
            console.warn('handle signal failed:', e);
        }
    }

    /* ══════════════════════════════════════════════ */
    /* Mics Listener — تتبع من على المايك              */
    /* ══════════════════════════════════════════════ */
    function startMicsListener() {
        if (!VS.currentRoom) return;
        stopMicsListener();

        var ref = db.ref(micsPath(VS.currentRoom));
        VS.micsRef = ref;

        ref.on('value', function (snap) {
            var data = snap.val() || {};
            VS.micsData = data;
            onMicsUpdate(data);
        });
    }

    function stopMicsListener() {
        if (VS.micsRef) {
            try { VS.micsRef.off(); } catch (e) {}
            VS.micsRef = null;
        }
        VS.micsData = null;
    }

    function onMicsUpdate(data) {
        // 1. ارسم UI
        renderMicsUI(data);

        // 2. لو أنا لست على المايك — تجاهل
        if (VS.mySlot === null || !VS.myUid) return;

        // 3. أرصفة الاتصال — أحضر قائمة المتصلين
        var others = [];
        Object.keys(data).forEach(function (slotIdx) {
            var slot = data[slotIdx];
            if (!slot || !slot.uid) return;
            if (slot.uid === VS.myUid) return;
            others.push({ uid: slot.uid, slot: parseInt(slotIdx) });
        });

        // 4. لكل واحد جديد — أنشئ Peer
        // القاعدة: من عنده uid أصغر هو البادئ (منع double offers)
        others.forEach(function (o) {
            if (!VS.peers[o.uid]) {
                var isInitiator = VS.myUid < o.uid;
                if (isInitiator) {
                    createPeer(o.uid, true);
                } else {
                    // سأنتظر offer منه — لكن أنشئ pc مسبقاً
                    createPeer(o.uid, false);
                }
            }
        });

        // 5. اغلق peers لأشخاص خرجوا
        Object.keys(VS.peers).forEach(function (uid) {
            var stillThere = others.some(function (o) { return o.uid === uid; });
            if (!stillThere) {
                closePeer(uid);
            }
        });

        // 6. هل أُطردت من المايك؟
        if (VS.mySlot !== null) {
            var mySlotData = data[VS.mySlot];
            if (!mySlotData || mySlotData.uid !== VS.myUid) {
                // أُزيل slotي → طُردت
                log('kicked from mic');
                toast('fa-user-slash', '🚪 تم إنزالك من المايك');
                leaveMic();
            }
        }
    }

    /* ══════════════════════════════════════════════ */
    /* Join / Leave / Mute                            */
    /* ══════════════════════════════════════════════ */
    async function joinMic() {
        if (VS._joinLock || VS.active) return;
        VS._joinLock = true;

        var me = getMe();
        if (!me || !me.uid) {
            toast('fa-user', '⚠️ سجّل دخول أولاً');
            VS._joinLock = false;
            return;
        }

        var room = getRoom();
        var config = getRoomConfig();

        if (!config.allowMic) {
            toast('fa-lock', '🔒 المايك غير متاح في هذه الغرفة');
            VS._joinLock = false;
            return;
        }
        if (!config.micCount || config.micCount < 1) {
            toast('fa-info', 'ℹ️ لا يوجد مايكات في هذه الغرفة');
            VS._joinLock = false;
            return;
        }

        // احصل على مايك
        var stream = await acquireMic();
        if (!stream) {
            VS._joinLock = false;
            return;
        }

        // ابحث عن slot فاضي
        var micsSnap = await db.ref(micsPath(room)).once('value');
        var data = micsSnap.val() || {};
        var slotIndex = -1;
        for (var i = 0; i < config.micCount; i++) {
            var s = data[i];
            if (!s || !s.uid || s.uid === me.uid) {
                slotIndex = i;
                break;
            }
        }

        if (slotIndex === -1) {
            toast('fa-microphone-slash', '📢 كل المايكات ممتلئة');
            stream.getTracks().forEach(function (t) { t.stop(); });
            VS._joinLock = false;
            return;
        }

        // احفظ الحالة
        VS.active = true;
        VS.currentRoom = room;
        VS.mySlot = slotIndex;
        VS.myUid = me.uid;
        VS.myName = me.name || 'مستخدم';
        VS.myAvatar = me.avatar || '';
        VS.localStream = stream;
        VS.muted = false;

        // اكتب في Firebase
        var micData = {
            uid: me.uid,
            name: VS.myName,
            avatar: VS.myAvatar,
            muted: false,
            speaking: false,
            joinedAt: firebase.database.ServerValue.TIMESTAMP
        };
        await db.ref(micsPath(room) + '/' + slotIndex).set(micData);

        // onDisconnect — ينظف عند القطع
        VS.onDisconnectMics = db.ref(micsPath(room) + '/' + slotIndex).onDisconnect();
        VS.onDisconnectMics.remove();

        // ابدأ كشف "يتكلم"
        startSpeakingDetection(stream);

        // ابدأ listeners
        startMicsListener();
        startSignalListener();

        // UI
        renderControlsBar();
        toast('fa-microphone', '🎤 أنت على المايك ' + (slotIndex + 1));

        VS._joinLock = false;
    }

    async function leaveMic() {
        if (!VS.active) return;

        var room = VS.currentRoom;
        var slot = VS.mySlot;

        // 1. امسح slotي
        try {
            if (room && slot !== null) {
                if (VS.onDisconnectMics) {
                    try { VS.onDisconnectMics.cancel(); } catch (e) {}
                }
                await db.ref(micsPath(room) + '/' + slot).remove();
            }
        } catch (e) {}

        // 2. أوقف كل شيء
        stopSpeakingDetection();
        closeAllPeers();
        stopMicsListener();
        stopSignalListener();

        // 3. أوقف الـ stream
        if (VS.localStream) {
            VS.localStream.getTracks().forEach(function (t) {
                try { t.stop(); } catch (e) {}
            });
            VS.localStream = null;
        }

        // 4. صفّر الحالة
        VS.active = false;
        VS.mySlot = null;
        VS.myUid = null;
        VS.myName = null;
        VS.myAvatar = null;
        VS.muted = false;
        VS.speaking = false;
        VS.currentRoom = null;
        VS.micsData = null;
        VS.onDisconnectMics = null;

        // 5. UI
        renderControlsBar();
        renderMicsUI({});
        toast('fa-microphone-slash', '👋 نزلت من المايك');
    }

    function toggleMute() {
        if (!VS.active || !VS.localStream) return;
        VS.muted = !VS.muted;
        VS.localStream.getAudioTracks().forEach(function (t) {
            t.enabled = !VS.muted;
        });
        if (VS.currentRoom && VS.mySlot !== null) {
            db.ref(micsPath(VS.currentRoom) + '/' + VS.mySlot + '/muted')
                .set(VS.muted).catch(function () {});
        }
        if (VS.muted) {
            toast('fa-microphone-slash', '🔇 تم كتم مايكك');
        } else {
            toast('fa-microphone', '🎤 تم فتح مايكك');
        }
        renderControlsBar();
    }

    async function kickFromMic(uid) {
        if (!VS.currentRoom) return;
        var me = getMe();
        if (!me) return;

        // فحص الصلاحيات
        if (typeof canKickFromMicUser === 'function') {
            // دالة موجودة؟ استخدمها
        }
        // فحص يدوي
        var myLevel = me.rankLevel || (typeof getRankLevel === 'function' ? getRankLevel(me.rank) : 0);
        if (myLevel < 65) {
            toast('fa-lock', '🔒 لا تملك صلاحية');
            return;
        }

        // ابحث عن slot المستهدف
        var snap = await db.ref(micsPath(VS.currentRoom)).once('value');
        var data = snap.val() || {};
        var targetSlot = null;
        Object.keys(data).forEach(function (s) {
            if (data[s] && data[s].uid === uid) targetSlot = s;
        });

        if (targetSlot === null) return;

        await db.ref(micsPath(VS.currentRoom) + '/' + targetSlot).remove();

        // log
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

    /* ══════════════════════════════════════════════ */
    /* UI — رسم المايكات                              */
    /* ══════════════════════════════════════════════ */
    function renderMicsUI(data) {
        var container = document.querySelector('#mics-bar .mics');
        if (!container) return;

        var config = getRoomConfig();
        if (!config.micCount || config.micCount < 1) {
            container.innerHTML = '';
            return;
        }

        var me = getMe();
        var myLevel = me ? (me.rankLevel || (typeof getRankLevel === 'function' ? getRankLevel(me.rank) : 0)) : 0;
        var canKick = myLevel >= 65;

        container.innerHTML = '';

        for (var i = 0; i < config.micCount; i++) {
            var slotData = data && data[i] ? data[i] : null;

            var slot = document.createElement('div');
            slot.className = 'vs-mic-slot';
            slot.setAttribute('data-slot', i);

            if (!slotData || !slotData.uid) {
                // فاضي
                slot.classList.add('empty');
                slot.innerHTML = '<span class="vs-icon">＋</span>';
                slot.title = 'اركب المايك ' + (i + 1);
                slot.onclick = function () {
                    if (!VS.active) joinMic();
                };
            } else {
                // مشغول
                var isMine = slotData.uid === VS.myUid;
                if (isMine) slot.classList.add('mine');
                if (slotData.speaking) slot.classList.add('speaking');

                var img = document.createElement('img');
                img.className = 'vs-avatar';
                img.src = slotData.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(slotData.name || 'U') + '&background=333&color=fff';
                img.onerror = function () {
                    this.src = 'https://ui-avatars.com/api/?name=U&background=333&color=fff';
                };
                slot.appendChild(img);

                // اسم المستخدم (tooltip)
                var tip = document.createElement('div');
                tip.className = 'vs-name-tip';
                tip.textContent = slotData.name || 'مستخدم';
                slot.appendChild(tip);

                // كتم
                if (slotData.muted) {
                    var mb = document.createElement('div');
                    mb.className = 'vs-mute-badge';
                    mb.textContent = '🔇';
                    slot.appendChild(mb);
                }

                // زر الطرد (للأدمن فقط، ليس لنفسي)
                if (canKick && !isMine) {
                    var kb = document.createElement('button');
                    kb.type = 'button';
                    kb.className = 'vs-kick-btn can-kick';
                    kb.textContent = '✕';
                    kb.title = 'أنزل من المايك';
                    kb.onclick = function (e) {
                        e.stopPropagation();
                        e.preventDefault();
                        if (confirm('إنزال ' + (slotData.name || '') + ' من المايك؟')) {
                            kickFromMic(slotData.uid);
                        }
                    };
                    slot.appendChild(kb);
                }

                // نقر على slot مشغول
                slot.onclick = function () {
                    if (isMine) {
                        // أنا عليه → انزل
                        if (confirm('تنزل من المايك؟')) leaveMic();
                    }
                };
            }

            container.appendChild(slot);
        }

        // شريط التحكم
        renderControlsBar();
    }

    function renderControlsBar() {
        var wrapper = document.querySelector('.mics-bar-wrapper');
        if (!wrapper) return;

        var existing = wrapper.querySelector('.vs-controls');
        var existingStatus = wrapper.querySelector('.vs-status');

        if (!VS.active) {
            if (existing) existing.remove();
            if (existingStatus) existingStatus.remove();
            return;
        }

        // شريط التحكم
        if (!existing) {
            var ctrl = document.createElement('div');
            ctrl.className = 'vs-controls';
            ctrl.innerHTML =
                '<button type="button" class="vs-ctrl-btn" id="vs-mute-btn" title="كتم/فتح المايك">🎤</button>' +
                '<button type="button" class="vs-ctrl-btn leave" id="vs-leave-btn" title="انزل من المايك">✕</button>';
            wrapper.appendChild(ctrl);

            ctrl.querySelector('#vs-mute-btn').onclick = toggleMute;
            ctrl.querySelector('#vs-leave-btn').onclick = function () {
                if (confirm('تنزل من المايك؟')) leaveMic();
            };
            existing = ctrl;
        }

        // تحديث حالة زر الكتم
        var muteBtn = existing.querySelector('#vs-mute-btn');
        if (muteBtn) {
            if (VS.muted) {
                muteBtn.classList.add('muted');
                muteBtn.textContent = '🔇';
            } else {
                muteBtn.classList.remove('muted');
                muteBtn.textContent = '🎤';
            }
        }
    }

    /* ══════════════════════════════════════════════ */
    /* مراقبة تغيير الغرفة                            */
    /* ══════════════════════════════════════════════ */
    var _lastRoom = null;
    function watchRoomChange() {
        setInterval(function () {
            var currentRoom = getRoom();
            if (currentRoom !== _lastRoom) {
                var wasActive = VS.active;
                _lastRoom = currentRoom;
                if (wasActive) {
                    // خرج من الغرفة → انزل من المايك
                    leaveMic().then(function () {
                        // انتقلت لغرفة جديدة → جهّز UI
                        renderMicsUI({});
                    });
                } else {
                    renderMicsUI({});
                }
            }
        }, 500);
    }

    /* ══════════════════════════════════════════════ */
    /* Cleanup                                        */
    /* ══════════════════════════════════════════════ */
    function cleanup() {
        if (VS.active) leaveMic();
    }
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);

    /* ══════════════════════════════════════════════ */
    /* Public API                                     */
    /* ══════════════════════════════════════════════ */
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

    /* ══════════════════════════════════════════════ */
    /* Init                                           */
    /* ══════════════════════════════════════════════ */
    function init() {
        var attempts = 0;
        var t = setInterval(function () {
            attempts++;
            if (typeof getCurrentUser === 'function' &&
                getCurrentUser() &&
                typeof db !== 'undefined' && db &&
                document.querySelector('#mics-bar .mics')) {
                clearInterval(t);
                _lastRoom = getRoom();
                renderMicsUI({});
                watchRoomChange();
                log('✅ ready');
            }
            if (attempts >= 60) {
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
