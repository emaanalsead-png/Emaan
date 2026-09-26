// ==============================================
// voice-system.js v2 — Broadcasting + Music
// ==============================================
// ✅ v2 (فوق v1):
//   1. كل من في الغرفة = participant (يسمع تلقائياً)
//   2. Speakers (0..N) يبثّون للكل
//   3. Listeners يستقبلون من كل speakers
//   4. كتم الـ speaker نفسه
//   5. وضع الموسيقى (🎵) — يبث ملف صوتي للكل
//   6. ترك المايك
//   7. طرد speaker (65+)
//   8. عزل غرفة كامل
//   9. يعمل مع chat.js v3.16 أو v3.18
// ==============================================

(function () {
    'use strict';
    if (window.__voiceSystemV2) return;
    window.__voiceSystemV2 = true;

    /* ═══ Config ═══ */
    const ICE_SERVERS = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
    ];

    const SPEAKING_THRESHOLD = 15;
    const SPEAKING_CHECK_MS = 200;
    const BASE_PATH = 'room_voice';
    const KICK_LEVEL = 65;
    const HEARTBEAT_MS = 30000;
    const ROOM_WATCH_MS = 500;

    /* ═══ State ═══ */
    const VS = {
        me: null,
        room: null,

        // Role
        role: 'none',           // 'none' | 'listener' | 'speaker'
        mySlot: null,

        // Streams
        micStream: null,
        musicStream: null,
        musicEl: null,
        musicCtx: null,
        activeStream: null,      // mic or music (يبث حالياً)

        // Flags
        micMuted: false,
        musicMode: false,
        musicInfo: null,         // { url, title }
        speaking: false,

        // Speaking detection
        audioCtx: null,
        analyser: null,
        analyserBuf: null,
        speakTimer: null,

        // WebRTC
        peers: {},               // { remoteUid: RTCPeerConnection }
        remoteAudios: {},        // { remoteUid: HTMLAudioElement }

        // Firebase refs
        participantRef: null,
        participantDisc: null,
        speakersRef: null,
        signalRef: null,

        // Data caches
        speakersData: {},
        participantsData: {},
        currentRemoteUids: {},   // لمن أنشأنا peer

        // UI
        uiObserver: null,
        lastHash: '',
        joining: false,
        _lastRoomCheck: null,
        _roomWatcherTimer: null
    };

    /* ═══ Helpers ═══ */
    function getMe() {
        try {
            if (typeof getCurrentUser === 'function') {
                var u = getCurrentUser();
                if (u && u.uid) return u;
            }
        } catch (e) {}
        try { return JSON.parse(localStorage.getItem('qamar_current_user') || 'null'); }
        catch (e) { return null; }
    }

    function getRoom() {
        try {
            if (typeof ChatState !== 'undefined' && ChatState.currentRoom) return ChatState.currentRoom;
        } catch (e) {}
        return 'general';
    }

    function getRoomConfig() {
        try {
            var r = getRoom();
            if (typeof QAMAR !== 'undefined' && QAMAR.ROOMS && QAMAR.ROOMS[r]) return QAMAR.ROOMS[r];
        } catch (e) {}
        return { micCount: 0, allowMic: false };
    }

    function myLevel() {
        var u = getMe();
        if (!u) return 0;
        if (typeof u.rankLevel === 'number') return u.rankLevel;
        try { if (typeof getRankLevel === 'function') return getRankLevel(u.rank) || 0; } catch (e) {}
        return 0;
    }

    function toast(icon, msg) {
        if (typeof showToast === 'function') showToast(icon, msg);
        else console.log('[Voice]', msg);
    }

    function log() { console.log('[VoiceSystem]', ...arguments); }

    function pParticipants(roomId) { return db.ref(BASE_PATH + '/' + roomId + '/participants'); }
    function pSpeakers(roomId) { return db.ref(BASE_PATH + '/' + roomId + '/speakers'); }
    function pSignals(roomId, toUid) { return db.ref(BASE_PATH + '/' + roomId + '/signals/' + toUid); }

    /* ═══ CSS ═══ */
    (function injectCSS() {
        if (document.getElementById('voice-system-css-v2')) return;
        var s = document.createElement('style');
        s.id = 'voice-system-css-v2';
        s.textContent = `
.vs-remote-audio { display: none !important; }

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
    box-shadow: 0 0 14px rgba(0,230,118,0.9), 0 0 28px rgba(0,230,118,0.4);
    animation: vsSpeakPulse 0.9s ease-in-out infinite;
}
.vs-slot.music {
    border-color: #a855f7 !important;
    box-shadow: 0 0 14px rgba(168,85,247,0.9) !important;
    animation: vsMusicPulse 1.2s ease-in-out infinite;
}
@keyframes vsSpeakPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
}
@keyframes vsMusicPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.06); }
}
.vs-slot img {
    width: 100%; height: 100%;
    border-radius: 50%;
    object-fit: cover;
    display: block;
}
.vs-slot .vs-badge {
    position: absolute;
    bottom: -2px; left: -2px;
    width: 16px; height: 16px;
    border-radius: 50%;
    border: 2px solid #050508;
    display: flex; align-items: center; justify-content: center;
    font-size: 8px; color: #fff;
    z-index: 3;
}
.vs-slot .vs-badge.mute { background: #ff4444; }
.vs-slot .vs-badge.music { background: #a855f7; left: auto; right: -2px; bottom: -2px; }
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
    bottom: -26px; left: 50%;
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

/* شريط التحكم */
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
.vs-controls.music-active {
    background: rgba(168,85,247,0.15);
    border-color: rgba(168,85,247,0.5);
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
.vs-ctrl.music {
    background: rgba(168,85,247,0.15);
    border-color: rgba(168,85,247,0.5);
    color: #c084fc;
}
.vs-ctrl.music.active {
    background: rgba(168,85,247,0.4);
    border-color: #c084fc;
    color: #fff;
    box-shadow: 0 0 8px rgba(168,85,247,0.6);
}
.vs-ctrl.leave {
    background: rgba(255,68,68,0.15);
    border-color: rgba(255,68,68,0.5);
    color: #ff6666;
}
.vs-ctrl.leave:hover { background: rgba(255,68,68,0.3); }

/* Mini player للموسيقى عند الـ speaker */
.vs-music-mini {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    background: rgba(168,85,247,0.15);
    border: 1px solid rgba(168,85,247,0.5);
    border-radius: 14px;
    color: #c084fc;
    font-size: 10px;
    font-weight: 900;
    margin: 0 4px;
}
.vs-music-mini .vs-music-title {
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Modal اختيار موسيقى */
.vs-music-modal {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.92);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 1000050;
    display: none;
    justify-content: center;
    align-items: center;
    padding: 20px;
    direction: rtl;
    font-family: Cairo, sans-serif;
}
.vs-music-modal.active { display: flex; }
.vs-music-box {
    background: #0a0616;
    border: 2px solid #a855f7;
    border-radius: 18px;
    padding: 22px;
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.9), 0 0 40px rgba(168,85,247,0.4);
}
.vs-music-title-head {
    color: #c084fc;
    font-size: 16px;
    font-weight: 900;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(168,85,247,0.3);
}
.vs-music-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.vs-music-field label {
    color: #c084fc;
    font-size: 12px;
    font-weight: 900;
}
.vs-music-field input {
    padding: 11px 14px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(168,85,247,0.4);
    border-radius: 10px;
    color: #fff;
    font-family: inherit;
    font-size: 13px;
    outline: none;
    text-align: right;
    box-sizing: border-box;
}
.vs-music-field input:focus { border-color: #c084fc; }
.vs-music-actions {
    display: flex;
    gap: 8px;
    margin-top: 6px;
}
.vs-music-actions button {
    flex: 1;
    padding: 12px;
    border-radius: 10px;
    border: none;
    font-family: inherit;
    font-size: 13px;
    font-weight: 900;
    cursor: pointer;
}
.vs-music-upload {
    background: linear-gradient(135deg, #a855f7, #7c3aed);
    color: #fff;
}
.vs-music-url {
    background: rgba(255,255,255,0.08);
    color: #fff;
    border: 1px solid rgba(168,85,247,0.4) !important;
}
.vs-music-cancel {
    background: rgba(255,68,68,0.15);
    color: #ff8888;
    border: 1px solid rgba(255,68,68,0.4) !important;
}
.vs-music-actions button:active { transform: scale(0.97); }
.vs-music-hint {
    color: #888;
    font-size: 11px;
    text-align: center;
    line-height: 1.5;
    padding: 6px;
    background: rgba(168,85,247,0.06);
    border-radius: 8px;
}

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
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                video: false
            });
        } catch (e) {
            if (e.name === 'NotAllowedError') toast('fa-microphone-slash', '🔇 رفضت إذن المايك');
            else if (e.name === 'NotFoundError') toast('fa-microphone-slash', '🎤 لا يوجد مايك');
            else toast('fa-times', '⚠️ ' + (e.message || 'فشل الوصول للمايك'));
            return null;
        }
    }

    /* ═══ Music Stream من URL ═══ */
    async function buildMusicStream(url, title) {
        try {
            // نظّف القديم
            destroyMusicStream();

            var el = new Audio();
            el.src = url;
            el.crossOrigin = 'anonymous';
            el.loop = false;
            el.preload = 'auto';

            await new Promise(function (res, rej) {
                el.addEventListener('canplaythrough', res, { once: true });
                el.addEventListener('error', function () { rej(new Error('فشل تحميل الموسيقى')); }, { once: true });
                setTimeout(function () { rej(new Error('timeout')); }, 15000);
            });

            var Ctx = window.AudioContext || window.webkitAudioContext;
            var ctx = new Ctx();
            var src = ctx.createMediaElementSource(el);
            var dest = ctx.createMediaStreamDestination();
            src.connect(dest);
            src.connect(ctx.destination); // يسمعها الـ speaker أيضاً

            VS.musicEl = el;
            VS.musicCtx = ctx;
            VS.musicStream = dest.stream;
            VS.musicInfo = { url: url, title: title || 'موسيقى' };

            el.onended = function () {
                log('music ended');
                exitMusicMode();
            };

            return dest.stream;
        } catch (e) {
            console.warn('buildMusicStream failed:', e);
            toast('fa-times', '⚠️ فشل تحميل الموسيقى: ' + e.message);
            return null;
        }
    }

    function destroyMusicStream() {
        if (VS.musicEl) {
            try { VS.musicEl.pause(); VS.musicEl.src = ''; } catch (e) {}
            VS.musicEl = null;
        }
        if (VS.musicCtx) {
            try { VS.musicCtx.close(); } catch (e) {}
            VS.musicCtx = null;
        }
        VS.musicStream = null;
        VS.musicInfo = null;
    }

    /* ═══ Speaking detection ═══ */
    function startSpeakDetect(stream) {
        try {
            var Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            if (VS.audioCtx) { try { VS.audioCtx.close(); } catch (e) {} }
            VS.audioCtx = new Ctx();
            var src = VS.audioCtx.createMediaStreamSource(stream);
            var an = VS.audioCtx.createAnalyser();
            an.fftSize = 512;
            an.smoothingTimeConstant = 0.7;
            src.connect(an);
            VS.analyser = an;
            VS.analyserBuf = new Uint8Array(an.frequencyBinCount);

            VS.speakTimer = setInterval(function () {
                if (!VS.analyser || VS.micMuted) {
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
        } catch (e) { console.warn('speak detect fail:', e); }
    }

    function stopSpeakDetect() {
        if (VS.speakTimer) { clearInterval(VS.speakTimer); VS.speakTimer = null; }
        if (VS.audioCtx) { try { VS.audioCtx.close(); } catch (e) {} VS.audioCtx = null; }
        VS.analyser = null;
        VS.analyserBuf = null;
    }

    function publishSpeaking(isSpeaking) {
        if (VS.role !== 'speaker' || VS.mySlot === null || !VS.room) return;
        db.ref(BASE_PATH + '/' + VS.room + '/speakers/' + VS.mySlot + '/speaking')
            .set(isSpeaking).catch(function () {});
    }

    /* ═══ WebRTC ═══ */
    function getActiveStream() {
        return VS.musicMode ? VS.musicStream : VS.micStream;
    }

    function createPeer(remoteUid, isInitiator) {
        if (VS.peers[remoteUid]) return VS.peers[remoteUid];

        var pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        VS.peers[remoteUid] = pc;

        // إذا أنا speaker أو listener بلا بث → أضف transceiver الاستقبال
        // إذا أنا speaker → أضف tracks الإرسال
        // إذا أنا listener → لا tracks الإرسال (استقبال فقط)

        if (VS.role === 'speaker') {
            var stream = getActiveStream();
            if (stream) {
                stream.getTracks().forEach(function (t) {
                    try { pc.addTrack(t, stream); } catch (e) {}
                });
            }
        } else {
            // listener — استقبال فقط
            try {
                pc.addTransceiver('audio', { direction: 'recvonly' });
            } catch (e) {
                // fallback: addTrack ممنوع لكن نتركه فارغاً — WebRTC سيعمل بالـ answer
            }
        }

        pc.onicecandidate = function (e) {
            if (e.candidate) sendSignal(remoteUid, 'ice', { candidate: e.candidate });
        };

        pc.ontrack = function (e) {
            log('remote track from', remoteUid.substring(0, 6));
            if (e.streams && e.streams[0]) attachRemoteAudio(remoteUid, e.streams[0]);
        };

        pc.onconnectionstatechange = function () {
            log('peer ' + remoteUid.substring(0, 6) + ' → ' + pc.connectionState);
            if (pc.connectionState === 'failed') {
                setTimeout(function () {
                    if (!VS.peers[remoteUid]) return;
                    if (VS.peers[remoteUid].connectionState === 'failed') {
                        closePeer(remoteUid);
                        // أعد الإنشاء إذا لا زال هناك
                        if (VS.currentRemoteUids[remoteUid]) {
                            var initiator = VS.me.uid < remoteUid;
                            createPeer(remoteUid, initiator);
                        }
                    }
                }, 3000);
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
        delete VS.currentRemoteUids[remoteUid];
    }

    function closeAllPeers() {
        Object.keys(VS.peers).slice().forEach(closePeer);
        VS.currentRemoteUids = {};
    }

    function attachRemoteAudio(remoteUid, stream) {
        var a = VS.remoteAudios[remoteUid];
        if (!a) {
            a = document.createElement('audio');
            a.autoplay = true;
            a.className = 'vs-remote-audio';
            a.setAttribute('playsinline', '');
            a.setAttribute('webkit-playsinline', '');
            document.body.appendChild(a);
            VS.remoteAudios[remoteUid] = a;
        }
        a.srcObject = stream;
        a.muted = false;
        a.volume = 1.0;
        a.play().catch(function (e) {
            console.warn('autoplay fail:', e);
            // سيُفعَّل عند أول نقرة
        });
    }

    // فعّل كل audio عند أول نقرة
    function unlockAudio() {
        Object.keys(VS.remoteAudios).forEach(function (uid) {
            var a = VS.remoteAudios[uid];
            if (a && a.paused) a.play().catch(function () {});
        });
    }
    document.addEventListener('click', unlockAudio, { passive: true });
    document.addEventListener('touchstart', unlockAudio, { passive: true });

    /* ═══ Signaling ═══ */
    function sendSignal(toUid, type, payload) {
        if (!VS.room || !VS.me) return;
        pSignals(VS.room, toUid).push({
            fromUid: VS.me.uid,
            type: type,
            payload: payload,
            at: firebase.database.ServerValue.TIMESTAMP
        }).catch(function (e) { console.warn('sendSignal:', e); });
    }

    function startSignalListener() {
        if (!VS.room || !VS.me) return;
        stopSignalListener();
        var ref = pSignals(VS.room, VS.me.uid);
        VS.signalRef = ref;
        ref.on('child_added', function (snap) {
            var sig = snap.val();
            if (!sig || sig.fromUid === VS.me.uid) {
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
        } catch (e) { console.warn('handleSignal:', e); }
    }

    /* ═══ Speaker change mode (mic ↔ music) ═══ */
    function replaceTracksOnAllPeers(newStream) {
        var newTrack = newStream ? newStream.getAudioTracks()[0] : null;
        if (!newTrack) return;
        Object.keys(VS.peers).forEach(function (uid) {
            var pc = VS.peers[uid];
            var senders = pc.getSenders();
            var audioSender = senders.find(function (s) { return s.track && s.track.kind === 'audio'; });
            if (audioSender) {
                audioSender.replaceTrack(newTrack).catch(function (e) {
                    console.warn('replaceTrack fail:', e);
                });
            }
        });
    }

    /* ═══ Join / Leave participant (listener) ═══ */
    async function joinAsListener() {
        if (VS.joining) return;
        if (VS.role === 'listener' && VS.room === getRoom()) return;
        VS.joining = true;

        try {
            var me = getMe();
            if (!me || !me.uid) { VS.joining = false; return; }
            var room = getRoom();

            // غادر الغرفة القديمة
            if (VS.room && VS.room !== room) await leaveAll();

            VS.me = me;
            VS.room = room;
            VS.role = 'listener';

            // Heartbeat
            var pref = pParticipants(room).child(me.uid);
            VS.participantRef = pref;
            await pref.set({
                name: me.name || 'مستخدم',
                avatar: me.avatar || '',
                joinedAt: firebase.database.ServerValue.TIMESTAMP,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });
            VS.participantDisc = pref.onDisconnect();
            VS.participantDisc.remove();

            // Heartbeat loop
            if (VS._hbTimer) clearInterval(VS._hbTimer);
            VS._hbTimer = setInterval(function () {
                if (VS.role && VS.room && VS.me) {
                    pref.child('lastSeen').set(firebase.database.ServerValue.TIMESTAMP).catch(function () {});
                }
            }, HEARTBEAT_MS);

            // Listeners
            startSpeakersListener();
            startSignalListener();

            log('joined as listener in', room);
        } catch (e) {
            console.error('joinAsListener:', e);
        } finally {
            VS.joining = false;
        }
    }

    /* ═══ Join speaker ═══ */
    async function joinAsSpeaker() {
        if (VS.joining || VS.role === 'speaker') return;
        VS.joining = true;

        try {
            var me = getMe();
            if (!me || !me.uid) { toast('fa-user', '⚠️ سجّل دخول أولاً'); return; }
            var room = getRoom();
            var config = getRoomConfig();

            if (!config.allowMic) { toast('fa-lock', '🔒 المايك غير متاح هنا'); return; }
            if (!config.micCount || config.micCount < 1) { toast('fa-info', 'ℹ️ لا يوجد مايكات'); return; }

            var stream = await acquireMic();
            if (!stream) return;

            // تأكد من وجود مشارك
            if (VS.role !== 'listener' || VS.room !== room) {
                await joinAsListener();
                // حماية — لو لم نستطع
                if (VS.role !== 'listener') {
                    stream.getTracks().forEach(function (t) { t.stop(); });
                    return;
                }
            }

            // ابحث عن slot فاضي
            var snap = await pSpeakers(room).once('value');
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

            VS.micStream = stream;
            VS.mySlot = slot;
            VS.role = 'speaker';
            VS.micMuted = false;
            VS.musicMode = false;

            await db.ref(BASE_PATH + '/' + room + '/speakers/' + slot).set({
                uid: me.uid,
                name: me.name || 'مستخدم',
                avatar: me.avatar || '',
                muted: false,
                speaking: false,
                mode: 'mic',
                music: null,
                joinedAt: firebase.database.ServerValue.TIMESTAMP
            });

            var sref = db.ref(BASE_PATH + '/' + room + '/speakers/' + slot);
            VS.speakerDisc = sref.onDisconnect();
            VS.speakerDisc.remove();

            startSpeakDetect(stream);
            VS.lastHash = '';
            onSpeakersChange(VS.speakersData);

            toast('fa-microphone', '🎤 أنت على المايك ' + (slot + 1) + ' — الكل يسمعك');
            log('joined as speaker in slot', slot);
        } catch (e) {
            console.error('joinAsSpeaker:', e);
            toast('fa-times', '⚠️ فشل الانضمام: ' + (e.message || ''));
        } finally {
            VS.joining = false;
        }
    }

    /* ═══ Leave speaker (back to listener) ═══ */
    async function leaveSpeaker() {
        if (VS.role !== 'speaker') return;
        try {
            if (VS.room && VS.mySlot !== null) {
                if (VS.speakerDisc) { try { VS.speakerDisc.cancel(); } catch (e) {} }
                await db.ref(BASE_PATH + '/' + VS.room + '/speakers/' + VS.mySlot).remove().catch(function () {});
            }
        } catch (e) {}

        stopSpeakDetect();
        destroyMusicStream();

        if (VS.micStream) {
            VS.micStream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
            VS.micStream = null;
        }

        VS.role = 'listener';
        VS.mySlot = null;
        VS.micMuted = false;
        VS.musicMode = false;
        VS.speaking = false;

        // أعِد بناء peers كـ listener
        reconnectAllPeers();

        VS.lastHash = '';
        onSpeakersChange(VS.speakersData);
        onParticipantsChange(VS.participantsData);

        toast('fa-microphone-slash', '👋 نزلت من المايك — أنت الآن مستمع');
    }

    /* ═══ Leave all ═══ */
    async function leaveAll() {
        try {
            if (VS.role === 'speaker') await leaveSpeaker();
        } catch (e) {}

        try {
            if (VS.participantRef) {
                if (VS.participantDisc) { try { VS.participantDisc.cancel(); } catch (e) {} }
                await VS.participantRef.remove().catch(function () {});
            }
        } catch (e) {}

        stopSpeakersListener();
        stopSignalListener();
        closeAllPeers();
        stopSpeakDetect();

        if (VS._hbTimer) { clearInterval(VS._hbTimer); VS._hbTimer = null; }

        VS.role = 'none';
        VS.room = null;
        VS.mySlot = null;
        VS.participantRef = null;
        VS.participantDisc = null;
        VS.speakerDisc = null;
        VS.speakersData = {};
        VS.participantsData = {};
        VS.currentRemoteUids = {};
        VS.lastHash = '';

        renderSlots({});
    }

    /* ═══ Toggle mic mute ═══ */
    function toggleMute() {
        if (VS.role !== 'speaker' || !VS.micStream) return;
        // لا يمكن كتم في وضع الموسيقى — تحتاج إيقاف الموسيقى أولاً
        if (VS.musicMode) {
            toast('fa-info-circle', '🎵 أنهِ الموسيقى أولاً');
            return;
        }
        VS.micMuted = !VS.micMuted;
        VS.micStream.getAudioTracks().forEach(function (t) { t.enabled = !VS.micMuted; });
        if (VS.room && VS.mySlot !== null) {
            db.ref(BASE_PATH + '/' + VS.room + '/speakers/' + VS.mySlot + '/muted')
                .set(VS.micMuted).catch(function () {});
        }
        toast('fa-microphone' + (VS.micMuted ? '-slash' : ''),
              VS.micMuted ? '🔇 تم كتم مايكك' : '🎤 تم فتح مايكك');
        VS.lastHash = '';
        onSpeakersChange(VS.speakersData);
    }

    /* ═══ Music mode ═══ */
    async function enterMusicMode(url, title) {
        if (VS.role !== 'speaker') return;
        if (VS.musicMode) {
            toast('fa-info-circle', '🎵 الموسيقى شغالة بالفعل');
            return;
        }
        var stream = await buildMusicStream(url, title);
        if (!stream) return;

        VS.musicMode = true;
        VS.micMuted = true; // أوقف المايك تلقائياً
        if (VS.micStream) {
            VS.micStream.getAudioTracks().forEach(function (t) { t.enabled = false; });
        }

        // حدّث peers
        replaceTracksOnAllPeers(stream);

        // شغّل التشغيل (سيتم مزامنة الآخرين عبر Firebase)
        if (VS.musicEl) {
            VS.musicEl.play().catch(function (e) {
                console.warn('music play fail:', e);
                toast('fa-times', '⚠️ اضغط أي مكان لتفعيل الصوت');
            });
        }

        // Firebase
        if (VS.room && VS.mySlot !== null) {
            db.ref(BASE_PATH + '/' + VS.room + '/speakers/' + VS.mySlot).update({
                mode: 'music',
                music: { url: url, title: title || 'موسيقى' },
                muted: false,
                speaking: false
            }).catch(function () {});
            publishSpeaking(false);
        }

        toast('fa-music', '🎵 تشغيل للجميع');
        VS.lastHash = '';
        onSpeakersChange(VS.speakersData);
    }

    async function exitMusicMode() {
        if (!VS.musicMode) return;
        destroyMusicStream();
        VS.musicMode = false;
        VS.micMuted = false;

        if (VS.micStream) {
            VS.micStream.getAudioTracks().forEach(function (t) { t.enabled = true; });
            replaceTracksOnAllPeers(VS.micStream);
        }

        if (VS.room && VS.mySlot !== null) {
            db.ref(BASE_PATH + '/' + VS.room + '/speakers/' + VS.mySlot).update({
                mode: 'mic',
                music: null,
                muted: false
            }).catch(function () {});
        }

        toast('fa-microphone', '🎤 عاد المايك');
        VS.lastHash = '';
        onSpeakersChange(VS.speakersData);
    }

    /* ═══ Kick ═══ */
    async function kickFromMic(uid) {
        if (!VS.room) return;
        var me = getMe();
        if (!me) return;
        if (myLevel() < KICK_LEVEL) { toast('fa-lock', '🔒 لا تملك صلاحية'); return; }

        var snap = await pSpeakers(VS.room).once('value');
        var data = snap.val() || {};
        var targetSlot = null;
        Object.keys(data).forEach(function (k) {
            if (data[k] && data[k].uid === uid) targetSlot = k;
        });
        if (targetSlot === null) return;

        await db.ref(BASE_PATH + '/' + VS.room + '/speakers/' + targetSlot).remove();

        try {
            db.ref('audit_log').push({
                type: 'kick_from_mic',
                byUid: me.uid, byName: me.name,
                targetUid: uid, roomId: VS.room, slot: targetSlot,
                at: firebase.database.ServerValue.TIMESTAMP
            }).catch(function () {});
        } catch (e) {}

        toast('fa-check', '✅ تم إنزاله من المايك');
    }

    /* ═══ Speakers Listener ═══ */
    function startSpeakersListener() {
        if (!VS.room) return;
        stopSpeakersListener();
        var ref = pSpeakers(VS.room);
        VS.speakersRef = ref;
        ref.on('value', function (snap) {
            VS.speakersData = snap.val() || {};
            onSpeakersChange(VS.speakersData);
        });
    }

    function stopSpeakersListener() {
        if (VS.speakersRef) {
            try { VS.speakersRef.off(); } catch (e) {}
            VS.speakersRef = null;
        }
        VS.speakersData = {};
    }

    function onSpeakersChange(data) {
        // 1. رسم UI
        renderSlots(data);

        // 2. إذا أنا speaker → تحقق من الطرد
        if (VS.role === 'speaker' && VS.mySlot !== null) {
            var my = data[VS.mySlot];
            if (!my || my.uid !== VS.me.uid) {
                log('I was kicked');
                toast('fa-user-slash', '🚪 تم إنزالك من المايك');
                // ننزل بدون كلام
                stopSpeakDetect();
                destroyMusicStream();
                if (VS.micStream) {
                    VS.micStream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
                    VS.micStream = null;
                }
                VS.role = 'listener';
                VS.mySlot = null;
                VS.micMuted = false;
                VS.musicMode = false;
                reconnectAllPeers();
                VS.lastHash = '';
                onSpeakersChange(VS.speakersData);
                onParticipantsChange(VS.participantsData);
                return;
            }
        }

        // 3. اربط peers للـ speakers الآخرين (speaker ↔ speaker)
        // + كل مشارك يستقبل من كل speaker
        syncPeerConnections();
    }

    /* ═══ Participants Listener ═══ */
    function startParticipantsListener() {
        if (!VS.room) return;
        stopParticipantsListener();
        var ref = pParticipants(VS.room);
        VS.participantsRef = ref;
        ref.on('value', function (snap) {
            VS.participantsData = snap.val() || {};
            onParticipantsChange(VS.participantsData);
        });
    }

    function stopParticipantsListener() {
        if (VS.participantsRef) {
            try { VS.participantsRef.off(); } catch (e) {}
            VS.participantsRef = null;
        }
        VS.participantsData = {};
    }

    function onParticipantsChange(data) {
        syncPeerConnections();
    }

    /* ═══ Sync Peer Connections ═══ */
    function syncPeerConnections() {
        if (!VS.me || !VS.room || VS.role === 'none') return;

        var meUid = VS.me.uid;
        var speakers = VS.speakersData || {};
        var participants = VS.participantsData || {};

        // احسب قائمة "من يجب أن أتصل به"
        var shouldConnect = {};

        if (VS.role === 'speaker') {
            // Speaker يتصل بـ:
            //  - كل speakers آخرين
            //  - كل participants (listeners)
            Object.keys(speakers).forEach(function (k) {
                var s = speakers[k];
                if (s && s.uid && s.uid !== meUid) shouldConnect[s.uid] = true;
            });
            Object.keys(participants).forEach(function (uid) {
                if (uid !== meUid) shouldConnect[uid] = true;
            });
        } else {
            // listener يتصل بـ:
            //  - كل speakers
            Object.keys(speakers).forEach(function (k) {
                var s = speakers[k];
                if (s && s.uid && s.uid !== meUid) shouldConnect[s.uid] = true;
            });
        }

        // أنشئ peers جديدة
        Object.keys(shouldConnect).forEach(function (uid) {
            if (!VS.peers[uid]) {
                VS.currentRemoteUids[uid] = true;
                var initiator = meUid < uid; // uid أصغر = البادئ
                createPeer(uid, initiator);
            }
        });

        // أغلق peers لمن خرج
        Object.keys(VS.peers).forEach(function (uid) {
            if (!shouldConnect[uid]) closePeer(uid);
        });
    }

    /* ═══ Reconnect all ═══ */
    function reconnectAllPeers() {
        closeAllPeers();
        syncPeerConnections();
    }

    /* ═══ Render Slots ═══ */
    function renderSlots(data) {
        var config = getRoomConfig();
        var container = document.querySelector('#mics-bar .mics');
        if (!container) return;

        if (!config.micCount || config.micCount < 1) {
            // لا ميكات → أخفِ الشريط
            var bar = document.getElementById('mics-bar');
            if (bar) bar.classList.add('hidden');
            return;
        }

        var hash = JSON.stringify(data || {}) + '|' + VS.mySlot + '|' + VS.micMuted + '|' + VS.musicMode;
        if (hash === VS.lastHash && container.querySelector('.vs-slot')) return;
        VS.lastHash = hash;

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
                el.innerHTML = '<span>＋</span>';
                el.title = 'اركب المايك ' + (i + 1);
                el.onclick = (function () { return function () {
                    if (VS.role !== 'speaker') joinAsSpeaker();
                }; })();
            } else {
                var isMine = slotData.uid === VS.me.uid;
                if (isMine) el.classList.add('mine');
                if (slotData.mode === 'music') el.classList.add('music');
                else if (slotData.speaking) el.classList.add('speaking');

                var img = document.createElement('img');
                img.src = slotData.avatar || 'https://ui-avatars.com/api/?name=' +
                    encodeURIComponent(slotData.name || 'U') + '&background=333&color=fff';
                img.onerror = function () {
                    this.src = 'https://ui-avatars.com/api/?name=U&background=333&color=fff';
                };
                el.appendChild(img);

                // badge الكتم
                if (slotData.muted && slotData.mode !== 'music') {
                    var mb = document.createElement('span');
                    mb.className = 'vs-badge mute';
                    mb.textContent = '🔇';
                    el.appendChild(mb);
                }
                // badge الموسيقى
                if (slotData.mode === 'music') {
                    var mm = document.createElement('span');
                    mm.className = 'vs-badge music';
                    mm.textContent = '🎵';
                    el.appendChild(mm);
                }

                // kick
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

                el.onclick = (function (mine) {
                    return function () {
                        if (mine && confirm('تنزل من المايك؟')) leaveSpeaker();
                    };
                })(isMine);
            }

            container.appendChild(el);
        }

        renderControls();
    }

    function renderControls() {
        var wrapper = document.querySelector('.mics-bar-wrapper');
        if (!wrapper) return;

        var existing = wrapper.querySelector('.vs-controls');
        var musicMini = wrapper.querySelector('.vs-music-mini');

        if (VS.role !== 'speaker') {
            if (existing) existing.remove();
            if (musicMini) musicMini.remove();
            return;
        }

        if (!existing) {
            var ctrl = document.createElement('div');
            ctrl.className = 'vs-controls';
            ctrl.innerHTML =
                '<button type="button" class="vs-ctrl" data-action="mute">🎤</button>' +
                '<button type="button" class="vs-ctrl music" data-action="music">🎵</button>' +
                '<button type="button" class="vs-ctrl leave" data-action="leave">✕</button>';
            wrapper.appendChild(ctrl);

            ctrl.querySelector('[data-action="mute"]').onclick = toggleMute;
            ctrl.querySelector('[data-action="music"]').onclick = openMusicModal;
            ctrl.querySelector('[data-action="leave"]').onclick = function () {
                if (confirm('تنزل من المايك؟')) leaveSpeaker();
            };
            existing = ctrl;
        }

        // حالة
        var muteBtn = existing.querySelector('[data-action="mute"]');
        if (muteBtn) {
            muteBtn.classList.toggle('muted', VS.micMuted && !VS.musicMode);
            muteBtn.textContent = (VS.micMuted && !VS.musicMode) ? '🔇' : '🎤';
            muteBtn.disabled = VS.musicMode;
            muteBtn.style.opacity = VS.musicMode ? '0.4' : '1';
        }
        var musicBtn = existing.querySelector('[data-action="music"]');
        if (musicBtn) {
            musicBtn.classList.toggle('active', VS.musicMode);
        }
        existing.classList.toggle('music-active', VS.musicMode);

        // mini player
        if (VS.musicMode && VS.musicInfo) {
            if (!musicMini) {
                musicMini = document.createElement('div');
                musicMini.className = 'vs-music-mini';
                wrapper.appendChild(musicMini);
            }
            musicMini.innerHTML = '🎵 <span class="vs-music-title">' +
                (VS.musicInfo.title || 'موسيقى').substring(0, 20) + '</span>';
        } else if (musicMini) {
            musicMini.remove();
        }
    }

    /* ═══ Music Modal ═══ */
    function ensureMusicModal() {
        var m = document.getElementById('vs-music-modal');
        if (m) return m;

        m = document.createElement('div');
        m.id = 'vs-music-modal';
        m.className = 'vs-music-modal';
        m.innerHTML =
            '<div class="vs-music-box">' +
                '<div class="vs-music-title-head">🎵 تشغيل موسيقى</div>' +
                '<div class="vs-music-hint">الكل في الغرفة سيسمعها<br>🎤 سيتم كتم المايك تلقائياً</div>' +
                '<div class="vs-music-field">' +
                    '<label>🎧 رابط ملف صوتي (mp3, m4a, wav...)</label>' +
                    '<input type="url" id="vs-music-url" placeholder="https://..." autocomplete="off">' +
                '</div>' +
                '<div class="vs-music-actions">' +
                    '<button type="button" class="vs-music-url" id="vs-music-play-url">▶️ تشغيل الرابط</button>' +
                    '<button type="button" class="vs-music-upload" id="vs-music-upload">📁 رفع ملف</button>' +
                '</div>' +
                '<div class="vs-music-actions">' +
                    '<button type="button" class="vs-music-cancel" id="vs-music-cancel">إغلاق</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(m);

        m.addEventListener('click', function (e) {
            if (e.target === m) m.classList.remove('active');
        });

        m.querySelector('#vs-music-cancel').onclick = function () { m.classList.remove('active'); };
        m.querySelector('#vs-music-play-url').onclick = function () {
            var inp = m.querySelector('#vs-music-url');
            var url = (inp.value || '').trim();
            if (!url || url.indexOf('http') !== 0) { toast('fa-times', '⚠️ رابط غير صحيح'); return; }
            var title = url.split('/').pop().split('?')[0] || 'موسيقى';
            m.classList.remove('active');
            enterMusicMode(url, title);
        };
        m.querySelector('#vs-music-upload').onclick = function () {
            pickAudioFile();
        };

        return m;
    }

    function openMusicModal() {
        if (VS.role !== 'speaker') { toast('fa-lock', '🔒 اركب المايك أولاً'); return; }
        var m = ensureMusicModal();
        var urlInp = m.querySelector('#vs-music-url');
        if (urlInp) urlInp.value = '';
        m.classList.add('active');
    }

    function pickAudioFile() {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.style.display = 'none';
        input.onchange = async function () {
            var file = input.files && input.files[0];
            input.remove();
            if (!file) return;
            if (file.size > 30 * 1024 * 1024) { toast('fa-times', '⚠️ الحد 30MB'); return; }

            var modal = document.getElementById('vs-music-modal');
            if (modal) modal.classList.remove('active');

            toast('fa-spinner', '⏳ جاري رفع الموسيقى...');
            try {
                if (!window.UploadService || typeof window.UploadService.upload !== 'function') {
                    throw new Error('UploadService غير محمّل');
                }
                var url = await window.UploadService.upload(file);
                if (!url) throw new Error('لم يرجع رابط');
                await enterMusicMode(url, file.name || 'موسيقى');
            } catch (e) {
                console.error('music upload fail:', e);
                toast('fa-times', '⚠️ فشل الرفع: ' + (e.message || ''));
            }
        };
        document.body.appendChild(input);
        input.click();
    }

    /* ═══ UI Observer — بديل updateMicsUI ═══ */
    function startUIObserver() {
        var bar = document.getElementById('mics-bar');
        if (!bar) return;
        if (VS.uiObserver) VS.uiObserver.disconnect();

        VS.uiObserver = new MutationObserver(function () {
            var container = bar.querySelector('.mics');
            if (!container) return;
            if (container.querySelector('.vs-slot')) return;
            // chat.js استبدل الأزرار → أعِد البناء
            VS.lastHash = '';
            setTimeout(function () {
                renderSlots(VS.speakersData || {});
            }, 30);
        });
        VS.uiObserver.observe(bar, { childList: true, subtree: true });
    }

    /* ═══ Watch Room Change ═══ */
    function startRoomWatcher() {
        if (VS._roomWatcherTimer) clearInterval(VS._roomWatcherTimer);
        VS._roomWatcherTimer = setInterval(function () {
            var currentRoom = getRoom();
            if (VS._lastRoomCheck === null) { VS._lastRoomCheck = currentRoom; return; }
            if (currentRoom !== VS._lastRoomCheck) {
                log('room changed:', VS._lastRoomCheck, '→', currentRoom);
                VS._lastRoomCheck = currentRoom;
                // غادر كل شيء وانضم للغرفة الجديدة
                leaveAll().then(function () {
                    joinAsListener();
                });
            }
        }, ROOM_WATCH_MS);
    }

    /* ═══ Cleanup ═══ */
    function cleanup() {
        if (VS.role && VS.role !== 'none') {
            leaveAll();
        }
    }
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);

    /* ═══ Public API ═══ */
    window.VoiceSystem = {
        joinSpeaker: joinAsSpeaker,
        leaveSpeaker: leaveSpeaker,
        toggleMute: toggleMute,
        kick: kickFromMic,
        openMusicModal: openMusicModal,
        exitMusicMode: exitMusicMode,
        isSpeaker: function () { return VS.role === 'speaker'; },
        isListener: function () { return VS.role === 'listener'; },
        isMuted: function () { return VS.micMuted; },
        isMusicMode: function () { return VS.musicMode; },
        getMySlot: function () { return VS.mySlot; },
        getRole: function () { return VS.role; },
        version: 2
    };

    /* ═══ Init ═══ */
    function init() {
        var tries = 0;
        var t = setInterval(function () {
            tries++;
            var hasBar = document.querySelector('#mics-bar .mics');
            var me = getMe();
            var hasUser = !!(me && me.uid);
            var hasDb = typeof db !== 'undefined' && db;

            if (hasBar && hasUser && hasDb) {
                clearInterval(t);
                VS._lastRoomCheck = getRoom();
                VS.me = me;

                // انضم كـ listener تلقائياً
                joinAsListener().then(function () {
                    startParticipantsListener();
                    startUIObserver();
                    renderSlots({});
                    startRoomWatcher();
                    log('✅ v2 ready — role:', VS.role, '| room:', VS.room);
                });
                return;
            }
            if (tries >= 60) {
                clearInterval(t);
                console.warn('VoiceSystem v2: init timeout');
            }
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('🎤 voice-system.js v2 loaded — broadcast + music + listeners');
})();
