// ==============================================
// voice-monitor.js v1 — استديو + مراقبة مشبوهين
// ==============================================
// ✅ v1:
//   1. استديو يدوي: تسجيل + مؤثرات صوتية + تحميل
//   2. مراقبة تلقائية: عند انضمام مشبوه للمايك
//   3. رفع مباشر إلى Telegram (بدون Firebase storage)
//   4. الملك فقط
//   5. سجل التنبيهات (metadata فقط في Firebase)
// ==============================================

(function () {
    'use strict';
    if (window.__voiceMonitorV1) return;
    window.__voiceMonitorV1 = true;

    const TG_TOKEN = '8850098271:AAEy7xKwhbaSWrY_5ojUTA0McZvTPE1Gpv8';
    const TG_CHAT_ID = '-1003978647266';
    const TG_API = 'https://api.telegram.org/bot' + TG_TOKEN;
    const SEGMENT_MS = 60000;
    const MAX_SESSION_MS = 15 * 60 * 1000;
    const MAX_UPLOAD_MB = 45;

    const SUSPECTS_PATH = 'king_suspects';
    const ALERTS_PATH = 'king_alerts';

    const VM = {
        me: null,
        suspects: {},
        activeMonitor: null,
        initDone: false,

        manual: {
            active: false,
            recorder: null,
            ctx: null,
            dest: null,
            sources: [],
            chunks: [],
            startTime: 0,
            timer: null,
            effects: { bass: 0, treble: 0, reverb: 0, echo: 0, volume: 100 },
            nodes: null
        },

        uiBuilt: false,
        suspectsRef: null,
        callbackRegistered: false
    };

    function getMe() {
        try { if (typeof getCurrentUser === 'function') { var u = getCurrentUser(); if (u && u.uid) return u; } } catch (e) {}
        try { return JSON.parse(localStorage.getItem('qamar_current_user') || 'null'); } catch (e) { return null; }
    }
    function isKing() { var u = getMe(); return !!(u && u.rank === 'King'); }
    function getRoom() {
        try { if (typeof ChatState !== 'undefined' && ChatState.currentRoom) return ChatState.currentRoom; } catch (e) {}
        return 'general';
    }
    function toast(icon, msg) {
        if (typeof showToast === 'function') showToast(icon, msg);
        else console.log('[VoiceMonitor]', msg);
    }
    function log() { console.log('[VoiceMonitor]', ...arguments); }
    function fmtTime(sec) {
        var m = Math.floor(sec / 60), s = sec % 60;
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
    function fmtBytes(b) {
        if (!b || b < 1) return '0 B';
        if (b < 1024) return b + ' B';
        if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
        return (b / (1024 * 1024)).toFixed(2) + ' MB';
    }
    function pickMimeType() {
        var types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
        for (var i = 0; i < types.length; i++) {
            if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(types[i])) return types[i];
        }
        return '';
    }
    function extFromMime(m) {
        if (!m) return 'webm';
        if (m.indexOf('webm') !== -1) return 'webm';
        if (m.indexOf('ogg') !== -1) return 'ogg';
        if (m.indexOf('mp4') !== -1) return 'm4a';
        return 'webm';
    }
    function downloadBlob(blob, filename) {
        try {
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url; a.download = filename || 'recording.webm';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        } catch (e) { console.error('download:', e); }
    }

    function buildMixSources(ctx, dest) {
        var VS = window.VoiceSystem || {};
        var sources = [];
        var addedCount = 0;

        var mic = (VS._getMicStream && VS._getMicStream()) || null;
        if (mic && mic.getAudioTracks().length > 0) {
            try {
                var mSrc = ctx.createMediaStreamSource(mic);
                sources.push(mSrc);
                addedCount++;
            } catch (e) { console.warn('mic src:', e); }
        }

        var remotes = (VS._getRemoteAudios && VS._getRemoteAudios()) || {};
        Object.keys(remotes).forEach(function (uid) {
            var a = remotes[uid];
            if (!a || !a.srcObject) return;
            if (a.srcObject.getAudioTracks().length === 0) return;
            try {
                var s = ctx.createMediaStreamSource(a.srcObject);
                sources.push(s);
                addedCount++;
            } catch (e) { console.warn('remote src ' + uid.substring(0, 6) + ':', e); }
        });

        return { sources: sources, count: addedCount };
    }

    function buildEffectsChain(ctx, opts) {
        var bass = ctx.createBiquadFilter();
        bass.type = 'lowshelf';
        bass.frequency.value = 200;
        bass.gain.value = opts.bass || 0;

        var treble = ctx.createBiquadFilter();
        treble.type = 'highshelf';
        treble.frequency.value = 3000;
        treble.gain.value = opts.treble || 0;

        var vol = ctx.createGain();
        vol.gain.value = (opts.volume || 100) / 100;

        var delay = ctx.createDelay(1.0);
        delay.delayTime.value = 0.25;
        var feedback = ctx.createGain();
        feedback.gain.value = Math.min(0.7, (opts.echo || 0) / 150);
        var echoWet = ctx.createGain();
        echoWet.gain.value = (opts.echo || 0) / 100;

        var reverbWet = null;
        var convolver = null;
        if (opts.reverb > 0) {
            convolver = ctx.createConvolver();
            convolver.buffer = generateImpulse(ctx, 2.5, 2.0);
            reverbWet = ctx.createGain();
            reverbWet.gain.value = Math.min(1.0, (opts.reverb || 0) / 100);
        }

        return { bass: bass, treble: treble, vol: vol, delay: delay, feedback: feedback, echoWet: echoWet, convolver: convolver, reverbWet: reverbWet };
    }

    function connectEffectsChain(ctx, sources, dest, nodes) {
        sources.forEach(function (src) {
            try { src.connect(nodes.bass); } catch (e) {}
        });
        nodes.bass.connect(nodes.treble);
        nodes.treble.connect(nodes.vol);
        nodes.vol.connect(dest);

        nodes.vol.connect(nodes.delay);
        nodes.delay.connect(nodes.feedback);
        nodes.feedback.connect(nodes.delay);
        nodes.delay.connect(nodes.echoWet);
        nodes.echoWet.connect(dest);

        if (nodes.convolver) {
            nodes.vol.connect(nodes.convolver);
            nodes.convolver.connect(nodes.reverbWet);
            nodes.reverbWet.connect(dest);
        }
    }

    function generateImpulse(ctx, duration, decay) {
        var rate = ctx.sampleRate;
        var length = Math.floor(rate * duration);
        var impulse = ctx.createBuffer(2, length, rate);
        for (var ch = 0; ch < 2; ch++) {
            var d = impulse.getChannelData(ch);
            for (var i = 0; i < length; i++) {
                d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
            }
        }
        return impulse;
    }

    async function uploadToTelegram(blob, filename, caption) {
        if (!blob || blob.size < 100) throw new Error('ملف فارغ');
        if (blob.size / (1024 * 1024) > MAX_UPLOAD_MB) throw new Error('الملف كبير جداً (' + (blob.size / (1024 * 1024)).toFixed(1) + 'MB)');
        var fd = new FormData();
        fd.append('chat_id', TG_CHAT_ID);
        fd.append('audio', blob, filename);
        if (caption) fd.append('caption', caption.substring(0, 1024));
        fd.append('parse_mode', 'HTML');
        var res = await fetch(TG_API + '/sendAudio', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('TG HTTP ' + res.status);
        var data = await res.json();
        if (!data.ok || !data.result) throw new Error('TG: ' + (data.description || 'bad'));
        var r = data.result;
        var fileId = null;
        if (r.audio && r.audio.file_id) fileId = r.audio.file_id;
        else if (r.voice && r.voice.file_id) fileId = r.voice.file_id;
        else if (r.document && r.document.file_id) fileId = r.document.file_id;
        return { ok: true, messageId: r.message_id, fileId: fileId, chatId: r.chat && r.chat.id };
    }

    async function saveAlert(meta) {
        try {
            var rid = db.ref(ALERTS_PATH).push().key;
            await db.ref(ALERTS_PATH + '/' + rid).set(meta);
            return rid;
        } catch (e) {
            console.warn('saveAlert:', e);
            return null;
        }
    }

    async function startManualRecording() {
        if (VM.manual.active) return;
        if (!isKing()) { toast('fa-lock', '👑 للملك فقط'); return; }
        if (typeof MediaRecorder === 'undefined') { toast('fa-times', '⚠️ المتصفح لا يدعم'); return; }
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) { toast('fa-times', '⚠️ غير مدعوم'); return; }

        var ctx = new Ctx();
        var dest = ctx.createMediaStreamDestination();
        var mix = buildMixSources(ctx, dest);
        if (mix.count === 0) {
            toast('fa-info-circle', '🎙️ لا يوجد صوت للتسجيل');
            try { ctx.close(); } catch (e) {}
            return;
        }

        var nodes = buildEffectsChain(ctx, VM.manual.effects);
        connectEffectsChain(ctx, mix.sources, dest, nodes);

        var mime = pickMimeType();
        var recorder;
        try { recorder = new MediaRecorder(dest.stream, { mimeType: mime }); }
        catch (e) { try { ctx.close(); } catch (e2) {} toast('fa-times', '⚠️ فشل'); return; }

        VM.manual.active = true;
        VM.manual.ctx = ctx;
        VM.manual.dest = dest;
        VM.manual.sources = mix.sources;
        VM.manual.nodes = nodes;
        VM.manual.recorder = recorder;
        VM.manual.chunks = [];
        VM.manual.startTime = Date.now();
        VM.manual.mime = mime.split(';')[0];

        recorder.ondataavailable = function (e) {
            if (e.data && e.data.size > 0) VM.manual.chunks.push(e.data);
        };
        recorder.onstop = onManualStop;
        recorder.onerror = function (e) { console.error('recorder:', e); };

        recorder.start(1000);
        startManualTimer();
        renderStudioUI();
        log('manual recording started with', mix.count, 'sources');
    }

    function stopManualRecording() {
        if (!VM.manual.active || !VM.manual.recorder) return;
        try { VM.manual.recorder.stop(); } catch (e) {}
    }

    async function onManualStop() {
        var duration = Math.round((Date.now() - VM.manual.startTime) / 1000);
        var chunks = VM.manual.chunks;

        stopManualTimer();
        VM.manual.sources.forEach(function (s) { try { s.disconnect(); } catch (e) {} });
        if (VM.manual.ctx) { try { VM.manual.ctx.close(); } catch (e) {} }

        VM.manual.active = false;
        VM.manual.recorder = null;
        VM.manual.ctx = null;
        VM.manual.sources = [];
        VM.manual.nodes = null;
        VM.manual.dest = null;

        renderStudioUI();

        if (!chunks.length) { toast('fa-times', '⚠️ لم يتم تسجيل صوت'); return; }

        var blob = new Blob(chunks, { type: VM.manual.mime || 'audio/webm' });
        VM.manual.chunks = [];
        log('manual done:', duration + 's', fmtBytes(blob.size));

        var defaultName = 'تسجيل_استديو_' + getRoom() + '_' + fmtTime(duration).replace(':', '-');
        var action = prompt(
            '🎙️ تم التسجيل · ' + fmtTime(duration) + ' · ' + fmtBytes(blob.size) + '\n\n' +
            'اختر:\n' +
            '  • حفظ → رفع على Telegram\n' +
            '  • تحميل → تنزيل على الجهاز\n' +
            '  • الاثنين\n' +
            '  • (أي شيء آخر = إلغاء)',
            'الاثنين'
        );
        if (!action) return;
        action = action.trim().toLowerCase();

        var doUpload = (action === 'حفظ' || action === 'الاثنين' || action === 'save' || action === 'both');
        var doDownload = (action === 'تحميل' || action === 'الاثنين' || action === 'download' || action === 'both');

        if (doDownload) {
            downloadBlob(blob, defaultName + '.' + extFromMime(VM.manual.mime));
            toast('fa-check', '⬇️ جاري التحميل');
        }

        if (doUpload) {
            toast('fa-spinner', '⏳ جاري الرفع إلى Telegram...');
            try {
                var me = getMe() || {};
                var caption = '🎙️ <b>استديو</b>\n' +
                    '👤 ' + (me.name || '') + '\n' +
                    '🚪 ' + getRoom() + '\n' +
                    '⏱️ ' + fmtTime(duration) + '\n' +
                    '📅 ' + new Date().toLocaleString('ar-EG');
                var result = await uploadToTelegram(blob, defaultName + '.' + extFromMime(VM.manual.mime), caption);
                await saveAlert({
                    type: 'manual_studio',
                    byUid: me.uid || null,
                    byName: me.name || 'الملك',
                    room: getRoom(),
                    duration: duration,
                    size: blob.size,
                    tgMessageId: result.messageId,
                    tgFileId: result.fileId,
                    title: defaultName,
                    createdAt: firebase.database.ServerValue.TIMESTAMP
                });
                toast('fa-check', '✅ تم الرفع على Telegram');
            } catch (e) {
                console.error('upload fail:', e);
                toast('fa-times', '⚠️ فشل الرفع: ' + (e.message || ''));
                downloadBlob(blob, defaultName + '.' + extFromMime(VM.manual.mime));
            }
        }
    }

    function startManualTimer() {
        stopManualTimer();
        VM.manual.timer = setInterval(function () {
            if (!VM.manual.active) { stopManualTimer(); return; }
            var el = document.getElementById('vm-manual-timer');
            if (el) {
                var sec = Math.floor((Date.now() - VM.manual.startTime) / 1000);
                el.textContent = fmtTime(sec);
            }
        }, 500);
    }
    function stopManualTimer() {
        if (VM.manual.timer) { clearInterval(VM.manual.timer); VM.manual.timer = null; }
    }

    function loadSuspects() {
        if (!isKing()) return;
        if (VM.suspectsRef) { try { VM.suspectsRef.off(); } catch (e) {} }
        VM.suspectsRef = db.ref(SUSPECTS_PATH);
        VM.suspectsRef.on('value', function (snap) {
            VM.suspects = snap.val() || {};
            log('suspects updated:', Object.keys(VM.suspects).length);
            var list = document.getElementById('vm-suspects-list');
            if (list) renderSuspectsList();
        });
    }

    function registerSpeakersCallback() {
        if (VM.callbackRegistered) return;
        if (!window.VoiceSystem || typeof window.VoiceSystem._registerSpeakersCallback !== 'function') return;
        window.VoiceSystem._registerSpeakersCallback(function (data) {
            try { onSpeakersUpdate(data); } catch (e) { console.warn('onSpeakersUpdate:', e); }
        });
        VM.callbackRegistered = true;
        log('speakers callback registered');
    }

    function onSpeakersUpdate(data) {
        if (!isKing()) return;
        if (!VM.initDone) return;

        var room = getRoom();
        var suspects = VM.suspects || {};

        var suspectsOnMic = [];
        Object.keys(data || {}).forEach(function (slot) {
            var s = data[slot];
            if (!s || !s.uid) return;
            if (suspects[s.uid]) {
                suspectsOnMic.push({ uid: s.uid, slot: slot, name: s.name, suspectData: suspects[s.uid] });
            }
        });

        if (suspectsOnMic.length > 0 && !VM.activeMonitor) {
            startAutoRecording(room, suspectsOnMic);
            return;
        }
        if (VM.activeMonitor && suspectsOnMic.length === 0) {
            stopAutoRecording();
            return;
        }
        if (VM.activeMonitor && suspectsOnMic.length > 0) {
            VM.activeMonitor.suspects = suspectsOnMic;
            renderMonitorIndicator();
        }
    }

    async function startAutoRecording(room, suspectsOnMic) {
        if (VM.activeMonitor) return;
        if (typeof MediaRecorder === 'undefined') return;
        log('starting auto recording for', suspectsOnMic.length, 'suspects');

        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;

        var ctx = new Ctx();
        var dest = ctx.createMediaStreamDestination();
        var mix = buildMixSources(ctx, dest);
        if (mix.count === 0) {
            try { ctx.close(); } catch (e) {}
            log('no audio sources for auto record');
            return;
        }

        mix.sources.forEach(function (src) {
            try { src.connect(dest); } catch (e) {}
        });

        var mime = pickMimeType();
        var recorder;
        try { recorder = new MediaRecorder(dest.stream, { mimeType: mime }); }
        catch (e) { try { ctx.close(); } catch (e2) {} return; }

        VM.activeMonitor = {
            room: room,
            suspects: suspectsOnMic,
            ctx: ctx,
            dest: dest,
            sources: mix.sources,
            recorder: recorder,
            chunks: [],
            mime: mime.split(';')[0],
            startTime: Date.now(),
            sessionId: 'sess_' + Date.now()
        };

        recorder.ondataavailable = function (e) {
            if (e.data && e.data.size > 0 && VM.activeMonitor) {
                VM.activeMonitor.chunks.push(e.data);
            }
        };
        recorder.onstop = onAutoStopped;
        recorder.onerror = function (e) { console.error('auto recorder:', e); };

        recorder.start(1000);

        VM.activeMonitor.maxTimer = setTimeout(function () {
            if (VM.activeMonitor) {
                log('max session time reached');
                stopAutoRecording();
            }
        }, MAX_SESSION_MS);

        startAutoTimer();
        renderMonitorIndicator();

        var names = suspectsOnMic.map(function (s) { return s.name || s.uid.substring(0, 6); }).join(', ');
        toast('fa-circle', '🔴 بدأ تسجيل تلقائي: ' + names);
        log('auto recording started, session:', VM.activeMonitor.sessionId);
    }

    async function stopAutoRecording() {
        if (!VM.activeMonitor) return;
        var mon = VM.activeMonitor;
        log('stopping auto recording, session:', mon.sessionId);
        if (mon.maxTimer) clearTimeout(mon.maxTimer);
        stopAutoTimer();
        try { mon.recorder.stop(); } catch (e) {}
    }

    async function onAutoStopped() {
        var mon = VM.activeMonitor;
        if (!mon) return;

        var duration = Math.round((Date.now() - mon.startTime) / 1000);
        var chunks = mon.chunks || [];

        mon.sources.forEach(function (s) { try { s.disconnect(); } catch (e) {} });
        if (mon.ctx) { try { mon.ctx.close(); } catch (e) {} }

        VM.activeMonitor = null;
        renderMonitorIndicator();

        if (chunks.length === 0) { log('no chunks recorded'); return; }

        var blob = new Blob(chunks, { type: mon.mime || 'audio/webm' });
        log('auto session done:', duration + 's', fmtBytes(blob.size));

        var me = getMe() || {};
        var names = (mon.suspects || []).map(function (s) { return s.name || s.uid.substring(0, 6); }).join(', ');
        var ts = new Date().toLocaleString('ar-EG');
        var filename = 'مراقبة_' + mon.room + '_' + fmtTime(duration).replace(':', '-') + '.' + extFromMime(mon.mime);

        var caption = '🚨 <b>تسجيل مراقبة</b>\n' +
            '👥 المشبوهون: <b>' + names + '</b>\n' +
            '🚪 الغرفة: ' + mon.room + '\n' +
            '⏱️ المدة: ' + fmtTime(duration) + '\n' +
            '📅 ' + ts;

        toast('fa-spinner', '⏳ جاري الرفع إلى Telegram...');

        try {
            var result = await uploadToTelegram(blob, filename, caption);
            await saveAlert({
                type: 'auto_monitor',
                suspects: (mon.suspects || []).map(function (s) { return { uid: s.uid, name: s.name, slot: s.slot }; }),
                byUid: me.uid || null,
                byName: me.name || 'الملك',
                room: mon.room,
                duration: duration,
                size: blob.size,
                tgMessageId: result.messageId,
                tgFileId: result.fileId,
                title: filename,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
            toast('fa-check', '✅ تسجيل المراقبة رُفع');
        } catch (e) {
            console.error('auto upload fail:', e);
            toast('fa-times', '⚠️ فشل الرفع — تحميل محلي');
            downloadBlob(blob, filename);
        }
    }

    function startAutoTimer() {
        stopAutoTimer();
        VM._autoTimer = setInterval(function () {
            var el = document.getElementById('vm-monitor-timer');
            if (!el || !VM.activeMonitor) return;
            var sec = Math.floor((Date.now() - VM.activeMonitor.startTime) / 1000);
            el.textContent = fmtTime(sec);
        }, 500);
    }
    function stopAutoTimer() {
        if (VM._autoTimer) { clearInterval(VM._autoTimer); VM._autoTimer = null; }
    }

    function renderMonitorIndicator() {
        var ex = document.getElementById('vm-monitor-indicator');
        if (!VM.activeMonitor) {
            if (ex) ex.remove();
            return;
        }
        if (!ex) {
            ex = document.createElement('div');
            ex.id = 'vm-monitor-indicator';
            ex.style.cssText = 'position:fixed;top:50px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#dc2626,#991b1b);color:#fff;padding:8px 16px;border-radius:20px;font-family:Cairo,sans-serif;font-size:12px;font-weight:900;display:flex;align-items:center;gap:8px;z-index:9999998;box-shadow:0 4px 20px rgba(220,38,38,0.6);pointer-events:none;';
            document.body.appendChild(ex);
        }
        var names = (VM.activeMonitor.suspects || []).map(function (s) { return s.name || '?'; }).slice(0, 3).join(', ');
        if ((VM.activeMonitor.suspects || []).length > 3) names += ' +' + (VM.activeMonitor.suspects.length - 3);
        ex.innerHTML =
            '<span style="width:8px;height:8px;border-radius:50%;background:#fff;animation:vmPulse 1s ease-in-out infinite;"></span>' +
            '🔴 جاري المراقبة: ' + names + ' · <span id="vm-monitor-timer">00:00</span>';
    }

    function renderStudioUI() {
        var btn = document.getElementById('vm-studio-btn');
        if (!btn) return;
        if (VM.manual.active) {
            btn.classList.add('recording');
            btn.innerHTML = '⏹️';
            btn.title = 'إيقاف التسجيل';
        } else {
            btn.classList.remove('recording');
            btn.innerHTML = '🎙️';
            btn.title = 'بدء تسجيل في الاستديو';
        }
    }

    (function injectCSS() {
        if (document.getElementById('voice-monitor-css')) return;
        var s = document.createElement('style');
        s.id = 'voice-monitor-css';
        s.textContent = `
@keyframes vmPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
.vm-btn { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; font-size: 16px; cursor: pointer; padding: 0; margin: 0 4px; transition: all 0.2s ease; flex-shrink: 0; border: 2px solid; }
.vm-btn.rec { background: rgba(220,38,38,0.15); border-color: rgba(220,38,38,0.5); color: #ff6666; }
.vm-btn.rec:hover { background: rgba(220,38,38,0.3); border-color: #dc2626; color: #fff; }
.vm-btn.rec.recording { background: #dc2626; border-color: #ff4444; color: #fff; animation: vmPulse 1s ease-in-out infinite; }
.vm-btn.mon { background: rgba(255,152,0,0.15); border-color: rgba(255,152,0,0.5); color: #ffbb66; }
.vm-btn.mon:hover { background: rgba(255,152,0,0.3); border-color: #ff9800; color: #fff; }
.vm-btn.list { background: rgba(168,85,247,0.15); border-color: rgba(168,85,247,0.5); color: #c084fc; }
.vm-btn.list:hover { background: rgba(168,85,247,0.3); border-color: #a855f7; color: #fff; }
.vm-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.94); backdrop-filter: blur(6px); z-index: 1000085; display: none; justify-content: center; align-items: center; padding: 12px; direction: rtl; font-family: Cairo, sans-serif; }
.vm-modal.active { display: flex; }
.vm-box { background: #0a0616; border: 2px solid #a855f7; border-radius: 18px; width: 100%; max-width: 520px; max-height: 92vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.9), 0 0 40px rgba(168,85,247,0.4); }
.vm-head { padding: 14px 16px; border-bottom: 1px solid rgba(168,85,247,0.3); background: linear-gradient(135deg, rgba(168,85,247,0.2), rgba(0,0,0,0.4)); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
.vm-head h3 { color: #c084fc; margin: 0; font-size: 15px; font-weight: 900; }
.vm-close { background: rgba(255,68,68,0.2); border: 1px solid rgba(255,68,68,0.5); color: #ff7777; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 14px; font-weight: 900; padding: 0; }
.vm-body { flex: 1; overflow-y: auto; padding: 14px; }
.vm-empty { text-align: center; color: #666; padding: 40px 20px; font-size: 13px; line-height: 1.7; }
.vm-loading { text-align: center; color: #c084fc; padding: 30px; font-size: 13px; }
.vm-row { background: rgba(168,85,247,0.08); border: 1px solid rgba(168,85,247,0.25); border-radius: 12px; padding: 12px; margin-bottom: 10px; display: flex; align-items: center; gap: 10px; }
.vm-row img { width: 44px; height: 44px; border-radius: 50%; border: 2px solid #a855f7; object-fit: cover; flex-shrink: 0; }
.vm-row-info { flex: 1; min-width: 0; }
.vm-row-name { color: #fff; font-weight: 900; font-size: 13px; }
.vm-row-sub { color: #888; font-size: 10px; margin-top: 3px; }
.vm-row-actions { display: flex; gap: 6px; flex-shrink: 0; }
.vm-action { padding: 6px 10px; border-radius: 8px; border: none; font-family: inherit; font-size: 11px; font-weight: 900; cursor: pointer; }
.vm-action.add { background: linear-gradient(135deg, #84cc16, #65a30d); color: #fff; }
.vm-action.del { background: rgba(255,68,68,0.15); color: #ff6666; border: 1px solid rgba(255,68,68,0.4); }
.vm-action.edit { background: rgba(255,215,0,0.15); color: #ffd700; border: 1px solid rgba(255,215,0,0.4); }
.vm-action:active { transform: scale(0.96); }
.vm-add-bar { display: flex; gap: 6px; margin-bottom: 12px; }
.vm-add-bar input { flex: 1; padding: 10px 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(168,85,247,0.4); border-radius: 10px; color: #fff; font-family: inherit; font-size: 13px; outline: none; text-align: right; box-sizing: border-box; }
.vm-add-bar input:focus { border-color: #c084fc; }
.vm-add-bar button { padding: 10px 16px; border-radius: 10px; border: none; background: linear-gradient(135deg, #a855f7, #7c3aed); color: #fff; font-family: inherit; font-size: 13px; font-weight: 900; cursor: pointer; white-space: nowrap; }
.vm-studio-effects { background: rgba(0,0,0,0.3); border-radius: 12px; padding: 12px; margin-bottom: 12px; }
.vm-effect-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.vm-effect-row:last-child { margin-bottom: 0; }
.vm-effect-row label { color: #c084fc; font-size: 12px; font-weight: 900; min-width: 65px; }
.vm-effect-row input[type="range"] { flex: 1; height: 6px; -webkit-appearance: none; appearance: none; background: rgba(255,255,255,0.1); border-radius: 3px; outline: none; }
.vm-effect-row input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #a855f7; cursor: pointer; border: 2px solid #000; }
.vm-effect-val { color: #fff; font-size: 11px; font-weight: 900; min-width: 36px; text-align: center; }
.vm-studio-record { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 20px; }
.vm-studio-record-btn { width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #dc2626, #991b1b); border: 4px solid #ff4444; color: #fff; font-size: 32px; cursor: pointer; padding: 0; box-shadow: 0 8px 24px rgba(220,38,38,0.5); transition: all 0.2s; }
.vm-studio-record-btn.recording { background: #111; border-color: #dc2626; animation: vmPulse 1s ease-in-out infinite; }
.vm-studio-record-btn:active { transform: scale(0.95); }
.vm-studio-timer { font-family: monospace; font-size: 28px; font-weight: 900; color: #fff; }
        `;
        document.head.appendChild(s);
    })();

    function injectButtons() {
        if (!isKing()) return;
        var wrapper = document.querySelector('.mics-bar-wrapper');
        if (!wrapper) return;
        if (wrapper.querySelector('.vm-btn-bar')) return;

        var bar = document.createElement('div');
        bar.className = 'vm-btn-bar';
        bar.style.cssText = 'display:inline-flex; align-items:center; gap:0; margin:0 6px;';

        var studioBtn = document.createElement('button');
        studioBtn.type = 'button';
        studioBtn.className = 'vm-btn rec';
        studioBtn.id = 'vm-studio-btn';
        studioBtn.title = 'بدء تسجيل في الاستديو';
        studioBtn.textContent = '🎙️';
        studioBtn.onclick = openStudio;
        bar.appendChild(studioBtn);

        var suspectsBtn = document.createElement('button');
        suspectsBtn.type = 'button';
        suspectsBtn.className = 'vm-btn mon';
        suspectsBtn.title = 'إدارة المشبوهين';
        suspectsBtn.textContent = '👁️';
        suspectsBtn.onclick = openSuspects;
        bar.appendChild(suspectsBtn);

        var alertsBtn = document.createElement('button');
        alertsBtn.type = 'button';
        alertsBtn.className = 'vm-btn list';
        alertsBtn.title = 'سجل التنبيهات';
        alertsBtn.textContent = '📋';
        alertsBtn.onclick = openAlerts;
        bar.appendChild(alertsBtn);

        wrapper.appendChild(bar);

        setInterval(function () {
            if (isKing() && !document.querySelector('.vm-btn-bar')) {
                var w = document.querySelector('.mics-bar-wrapper');
                if (w) injectButtons();
            }
        }, 3000);
    }

    function ensureStudioModal() {
        var m = document.getElementById('vm-studio-modal');
        if (m) return m;
        m = document.createElement('div');
        m.id = 'vm-studio-modal';
        m.className = 'vm-modal';
        m.innerHTML =
            '<div class="vm-box">' +
                '<div class="vm-head">' +
                    '<h3>🎙️ استديو التسجيل</h3>' +
                    '<button type="button" class="vm-close" id="vm-studio-close">✕</button>' +
                '</div>' +
                '<div class="vm-body">' +
                    '<div class="vm-studio-effects">' +
                        '<div class="vm-effect-row"><label>🎚️ Bass</label><input type="range" id="vm-eff-bass" min="-20" max="20" value="0" step="1"><span class="vm-effect-val" id="vm-eff-bass-v">0</span></div>' +
                        '<div class="vm-effect-row"><label>🎚️ Treble</label><input type="range" id="vm-eff-treble" min="-20" max="20" value="0" step="1"><span class="vm-effect-val" id="vm-eff-treble-v">0</span></div>' +
                        '<div class="vm-effect-row"><label>🔊 Echo</label><input type="range" id="vm-eff-echo" min="0" max="100" value="0" step="1"><span class="vm-effect-val" id="vm-eff-echo-v">0</span></div>' +
                        '<div class="vm-effect-row"><label>🏛️ Reverb</label><input type="range" id="vm-eff-reverb" min="0" max="100" value="0" step="1"><span class="vm-effect-val" id="vm-eff-reverb-v">0</span></div>' +
                        '<div class="vm-effect-row"><label>🔉 Volume</label><input type="range" id="vm-eff-volume" min="0" max="150" value="100" step="5"><span class="vm-effect-val" id="vm-eff-volume-v">100</span></div>' +
                    '</div>' +
                    '<div class="vm-studio-record">' +
                        '<button type="button" class="vm-studio-record-btn" id="vm-studio-rec-btn">🎙️</button>' +
                        '<div class="vm-studio-timer" id="vm-manual-timer">00:00</div>' +
                    '</div>' +
                    '<div style="text-align:center;color:#888;font-size:11px;margin-top:12px;">' +
                        'يسجّل: صوت المايكات + الموسيقى في الغرفة' +
                    '</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(m);
        m.querySelector('#vm-studio-close').onclick = function () { m.classList.remove('active'); };
        m.addEventListener('click', function (e) { if (e.target === m) m.classList.remove('active'); });

        ['bass', 'treble', 'echo', 'reverb', 'volume'].forEach(function (key) {
            var inp = m.querySelector('#vm-eff-' + key);
            var lbl = m.querySelector('#vm-eff-' + key + '-v');
            if (!inp) return;
            inp.oninput = function () {
                var v = parseInt(inp.value);
                VM.manual.effects[key] = v;
                if (lbl) lbl.textContent = v;
                if (VM.manual.active && VM.manual.nodes) applyEffectLive(key, v);
            };
        });

        var recBtn = m.querySelector('#vm-studio-rec-btn');
        recBtn.onclick = function () {
            if (VM.manual.active) {
                if (confirm('إيقاف التسجيل؟')) stopManualRecording();
            } else {
                startManualRecording();
            }
        };
        return m;
    }

    function applyEffectLive(key, val) {
        if (!VM.manual.nodes) return;
        try {
            var n = VM.manual.nodes;
            if (key === 'bass' && n.bass) n.bass.gain.value = val;
            else if (key === 'treble' && n.treble) n.treble.gain.value = val;
            else if (key === 'volume' && n.vol) n.vol.gain.value = val / 100;
            else if (key === 'echo' && n.echoWet) n.echoWet.gain.value = val / 100;
            else if (key === 'reverb' && n.reverbWet) n.reverbWet.gain.value = val / 100;
        } catch (e) {}
    }

    function openStudio() {
        if (!isKing()) { toast('fa-lock', '👑 للملك فقط'); return; }
        var m = ensureStudioModal();
        m.classList.add('active');
    }

    function ensureSuspectsModal() {
        var m = document.getElementById('vm-suspects-modal');
        if (m) return m;
        m = document.createElement('div');
        m.id = 'vm-suspects-modal';
        m.className = 'vm-modal';
        m.innerHTML =
            '<div class="vm-box">' +
                '<div class="vm-head">' +
                    '<h3>👁️ إدارة المشبوهين</h3>' +
                    '<button type="button" class="vm-close" id="vm-suspects-close">✕</button>' +
                '</div>' +
                '<div class="vm-body">' +
                    '<div class="vm-add-bar">' +
                        '<input type="text" id="vm-suspects-input" placeholder="ابحث عن مستخدم بالاسم..." autocomplete="off">' +
                        '<button type="button" id="vm-suspects-search">🔍 بحث</button>' +
                    '</div>' +
                    '<div id="vm-suspects-results"></div>' +
                    '<div style="border-top:1px dashed rgba(168,85,247,0.3); margin:16px 0; padding-top:12px;">' +
                        '<div style="color:#c084fc; font-size:12px; font-weight:900; margin-bottom:10px;">قائمة المشبوهين الحالية</div>' +
                        '<div id="vm-suspects-list"><div class="vm-loading">⏳</div></div>' +
                    '</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(m);
        m.querySelector('#vm-suspects-close').onclick = function () { m.classList.remove('active'); };
        m.addEventListener('click', function (e) { if (e.target === m) m.classList.remove('active'); });
        m.querySelector('#vm-suspects-search').onclick = doSuspectSearch;
        m.querySelector('#vm-suspects-input').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') doSuspectSearch();
        });
        return m;
    }

    function openSuspects() {
        if (!isKing()) { toast('fa-lock', '👑 للملك فقط'); return; }
        var m = ensureSuspectsModal();
        m.classList.add('active');
        renderSuspectsList();
    }

    async function renderSuspectsList() {
        var listEl = document.getElementById('vm-suspects-list');
        if (!listEl) return;
        listEl.innerHTML = '<div class="vm-loading">⏳</div>';
        try {
            var suspects = VM.suspects || {};
            var uids = Object.keys(suspects);
            if (uids.length === 0) {
                listEl.innerHTML = '<div class="vm-empty" style="padding:20px;">لا يوجد مشبوهون حالياً</div>';
                return;
            }
            listEl.innerHTML = '';
            for (var i = 0; i < uids.length; i++) {
                var uid = uids[i];
                var s = suspects[uid] || {};
                var row = document.createElement('div');
                row.className = 'vm-row';

                var img = document.createElement('img');
                img.src = s.avatar || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(s.name || 'U') + '&background=333&color=fff');
                row.appendChild(img);

                var info = document.createElement('div');
                info.className = 'vm-row-info';
                var added = s.addedAt ? new Date(s.addedAt).toLocaleString('ar-EG') : '—';
                info.innerHTML =
                    '<div class="vm-row-name">' + (s.name || 'مجهول') + '</div>' +
                    '<div class="vm-row-sub">🕐 أُضيف: ' + added + '</div>';
                row.appendChild(info);

                var actions = document.createElement('div');
                actions.className = 'vm-row-actions';

                var delBtn = document.createElement('button');
                delBtn.className = 'vm-action del';
                delBtn.textContent = '🗑️';
                delBtn.onclick = (function (uid, name) {
                    return function () {
                        if (confirm('إزالة ' + (name || '') + ' من قائمة المشبوهين؟')) {
                            db.ref(SUSPECTS_PATH + '/' + uid).remove().then(function () {
                                toast('fa-check', '✅ تمت الإزالة');
                            });
                        }
                    };
                })(uid, s.name);
                actions.appendChild(delBtn);

                row.appendChild(actions);
                listEl.appendChild(row);
            }
        } catch (e) {
            console.error('renderSuspectsList:', e);
            listEl.innerHTML = '<div class="vm-empty" style="color:#ff6666;">⚠️ فشل</div>';
        }
    }

    async function doSuspectSearch() {
        var input = document.getElementById('vm-suspects-input');
        var resultsEl = document.getElementById('vm-suspects-results');
        if (!input || !resultsEl) return;
        var q = (input.value || '').trim();
        if (!q || q.length < 2) { toast('fa-info-circle', 'اكتب حرفين على الأقل'); return; }
        resultsEl.innerHTML = '<div class="vm-loading">⏳ جاري البحث...</div>';
        try {
            var snap = await db.ref('users').limitToLast(500).once('value');
            var all = snap.val() || {};
            var ql = q.toLowerCase();
            var me = getMe() || {};
            var matches = [];
            Object.keys(all).forEach(function (uid) {
                if (uid === me.uid) return;
                var u = all[uid] || {};
                if (u.isBot) return;
                var name = (u.name || '').toLowerCase();
                var code = (u.code || '').toLowerCase();
                if (name.indexOf(ql) !== -1 || code.indexOf(ql) !== -1) {
                    matches.push({ uid: uid, name: u.name, avatar: u.avatar, code: u.code, rank: u.rank });
                }
            });
            resultsEl.innerHTML = '';
            if (matches.length === 0) {
                resultsEl.innerHTML = '<div class="vm-empty" style="padding:20px;">لا نتائج</div>';
                return;
            }
            matches.slice(0, 15).forEach(function (m) {
                var row = document.createElement('div');
                row.className = 'vm-row';
                var img = document.createElement('img');
                img.src = m.avatar || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(m.name || 'U') + '&background=333&color=fff');
                row.appendChild(img);
                var info = document.createElement('div');
                info.className = 'vm-row-info';
                info.innerHTML =
                    '<div class="vm-row-name">' + (m.name || 'مجهول') + '</div>' +
                    '<div class="vm-row-sub">🔑 ' + (m.code || '—') + ' · ' + (m.rank || 'User') + '</div>';
                row.appendChild(info);
                var actions = document.createElement('div');
                actions.className = 'vm-row-actions';
                var addBtn = document.createElement('button');
                addBtn.className = 'vm-action add';
                addBtn.textContent = '➕ إضافة';
                addBtn.onclick = (function (m) {
                    return function () {
                        var me = getMe() || {};
                        db.ref(SUSPECTS_PATH + '/' + m.uid).set({
                            name: m.name || 'مجهول',
                            avatar: m.avatar || '',
                            code: m.code || '',
                            addedAt: Date.now(),
                            addedBy: me.uid || null,
                            addedByName: me.name || 'الملك'
                        }).then(function () {
                            toast('fa-check', '✅ أُضيف ' + (m.name || ''));
                            row.remove();
                        }).catch(function (e) {
                            toast('fa-times', '⚠️ ' + e.message);
                        });
                    };
                })(m);
                actions.appendChild(addBtn);
                row.appendChild(actions);
                resultsEl.appendChild(row);
            });
        } catch (e) {
            console.error('doSuspectSearch:', e);
            resultsEl.innerHTML = '<div class="vm-empty" style="color:#ff6666;">⚠️ ' + e.message + '</div>';
        }
    }

    function ensureAlertsModal() {
        var m = document.getElementById('vm-alerts-modal');
        if (m) return m;
        m = document.createElement('div');
        m.id = 'vm-alerts-modal';
        m.className = 'vm-modal';
        m.innerHTML =
            '<div class="vm-box">' +
                '<div class="vm-head">' +
                    '<h3>📋 سجل المراقبة</h3>' +
                    '<button type="button" class="vm-close" id="vm-alerts-close">✕</button>' +
                '</div>' +
                '<div class="vm-body" id="vm-alerts-body">' +
                    '<div class="vm-loading">⏳</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(m);
        m.querySelector('#vm-alerts-close').onclick = function () { m.classList.remove('active'); };
        m.addEventListener('click', function (e) { if (e.target === m) m.classList.remove('active'); });
        return m;
    }

    function openAlerts() {
        if (!isKing()) { toast('fa-lock', '👑 للملك فقط'); return; }
        var m = ensureAlertsModal();
        m.classList.add('active');
        renderAlerts();
    }

    async function renderAlerts() {
        var body = document.getElementById('vm-alerts-body');
        if (!body) return;
        body.innerHTML = '<div class="vm-loading">⏳ جاري التحميل...</div>';
        try {
            var snap = await db.ref(ALERTS_PATH).limitToLast(100).once('value');
            var data = snap.val() || {};
            var items = Object.keys(data).map(function (k) {
                var v = data[k]; v._id = k; return v;
            }).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
            body.innerHTML = '';
            if (items.length === 0) {
                body.innerHTML = '<div class="vm-empty">📋<br><br>لا توجد تسجيلات محفوظة بعد</div>';
                return;
            }
            var counter = document.createElement('div');
            counter.style.cssText = 'text-align:center;color:#c084fc;font-size:11px;font-weight:900;padding:4px 0 12px;';
            counter.textContent = '📼 ' + items.length + ' تسجيل';
            body.appendChild(counter);
            items.forEach(function (it) {
                var row = document.createElement('div');
                row.className = 'vm-row';
                row.style.flexDirection = 'column';
                row.style.alignItems = 'stretch';
                var head = document.createElement('div');
                head.style.cssText = 'display:flex;gap:10px;align-items:flex-start;';
                var icon = document.createElement('div');
                icon.style.cssText = 'font-size:24px; flex-shrink:0;';
                icon.textContent = it.type === 'auto_monitor' ? '🚨' : '🎙️';
                head.appendChild(icon);
                var info = document.createElement('div');
                info.className = 'vm-row-info';
                var names = '';
                if (it.type === 'auto_monitor' && Array.isArray(it.suspects)) {
                    names = it.suspects.map(function (s) { return s.name || '?'; }).join(', ');
                } else if (it.byName) {
                    names = it.byName;
                }
                var dateStr = it.createdAt ? new Date(it.createdAt).toLocaleString('ar-EG') : '—';
                info.innerHTML =
                    '<div class="vm-row-name">' + (it.type === 'auto_monitor' ? '🚨 مراقبة' : '🎙️ استديو') + ' — ' + (names || '—') + '</div>' +
                    '<div class="vm-row-sub">🚪 ' + (it.room || '—') + ' · ⏱️ ' + fmtTime(it.duration || 0) + ' · 💾 ' + fmtBytes(it.size || 0) + '</div>' +
                    '<div class="vm-row-sub">📅 ' + dateStr + '</div>';
                head.appendChild(info);
                row.appendChild(head);
                var actions = document.createElement('div');
                actions.className = 'vm-row-actions';
                actions.style.cssText = 'justify-content:flex-end; margin-top:10px;';
                if (it.tgMessageId) {
                    var openBtn = document.createElement('button');
                    openBtn.className = 'vm-action edit';
                    openBtn.textContent = '📱 فتح في Telegram';
                    openBtn.onclick = function () {
                        window.open('https://t.me/c/' + String(TG_CHAT_ID).replace('-100', ''), '_blank');
                    };
                    actions.appendChild(openBtn);
                }
                var delBtn = document.createElement('button');
                delBtn.className = 'vm-action del';
                delBtn.textContent = '🗑️ حذف من السجل';
                delBtn.onclick = (function (id, title) {
                    return async function () {
                        if (!confirm('حذف هذا التنبيه من السجل؟\n\n"' + (title || '') + '"\n\n⚠️ لن يُحذف من Telegram')) return;
                        try {
                            await db.ref(ALERTS_PATH + '/' + id).remove();
                            toast('fa-check', '🗑️ حُذف');
                            renderAlerts();
                        } catch (e) {
                            toast('fa-times', '⚠️ ' + e.message);
                        }
                    };
                })(it._id, it.title);
                actions.appendChild(delBtn);
                row.appendChild(actions);
                body.appendChild(row);
            });
        } catch (e) {
            console.error('renderAlerts:', e);
            body.innerHTML = '<div class="vm-empty" style="color:#ff6666;">⚠️ فشل التحميل<br>' + e.message + '</div>';
        }
    }

    function init() {
        var tries = 0;
        var t = setInterval(function () {
            tries++;
            var me = getMe();
            var hasUser = !!(me && me.uid);
            var kingOk = me && me.rank === 'King';
            var hasDb = typeof db !== 'undefined' && db;
            var hasBar = document.querySelector('.mics-bar-wrapper');

            if (hasUser && hasDb && hasBar && kingOk) {
                clearInterval(t);
                VM.me = me;
                VM.initDone = true;
                injectButtons();
                loadSuspects();
                registerSpeakersCallback();
                log('✅ ready (King) | suspects callback:', VM.callbackRegistered);
            } else if (hasUser && hasDb && !kingOk && tries >= 20) {
                clearInterval(t);
                log('⏭️ not King — disabled');
            }
            if (tries >= 80) {
                clearInterval(t);
                log('init timeout');
            }
        }, 500);
    }

    function cleanup() {
        if (VM.manual.active) {
            try { VM.manual.recorder && VM.manual.recorder.stop(); } catch (e) {}
        }
        if (VM.activeMonitor) {
            try { VM.activeMonitor.recorder && VM.activeMonitor.recorder.stop(); } catch (e) {}
        }
    }
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);

    window.VoiceMonitor = {
        openStudio: openStudio,
        openSuspects: openSuspects,
        openAlerts: openAlerts,
        startManual: startManualRecording,
        stopManual: stopManualRecording,
        addSuspect: function (uid, name, avatar) {
            var me = getMe() || {};
            return db.ref(SUSPECTS_PATH + '/' + uid).set({
                name: name || 'مجهول',
                avatar: avatar || '',
                addedAt: Date.now(),
                addedBy: me.uid || null,
                addedByName: me.name || 'الملك'
            });
        },
        removeSuspect: function (uid) {
            return db.ref(SUSPECTS_PATH + '/' + uid).remove();
        },
        isRecording: function () { return VM.manual.active || !!VM.activeMonitor; },
        version: 1
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('🎙️ voice-monitor.js v1 loaded — studio + suspects monitor');
})();
