// ==============================================
// voice-extras.js v1 — استوديو + مشاركة + مراقبة
// ==============================================
// ✅ v1:
//   1. استوديو صوتي احترافي مع مؤثرات DJ
//   2. بوت موسيقار الشام داخل الاستديو
//   3. مشاركة: روم (ساعة) / خاص (one-time)
//   4. مراقبة مشبوهين (موزّعة من أي متصفح)
//   5. تنظيف تلقائي شامل
// ==============================================

(function () {
    'use strict';
    if (window.__voiceExtrasV1) return;
    window.__voiceExtrasV1 = true;

    /* ════════ CONFIG ════════ */
    const TG_TOKEN = '8850098271:AAEy7xKwhbaSWrY_5ojUTA0McZvTPE1Gpv8';
    const TG_CHAT_ID = '-1003978647266';
    const TG_API = 'https://api.telegram.org/bot' + TG_TOKEN;

    const STUDIO_MAX_SEC = 300;        // 5 دقائق
    const STUDIO_WARN_SEC = 240;       // تحذير عند 4 دقائق
    const ROOM_MSG_TTL_MS = 60 * 60 * 1000; // ساعة
    const MONITOR_MAX_SESSION_MS = 15 * 60 * 1000; // 15 دقيقة
    const LOCK_TTL_MS = 30 * 1000;
    const MAX_UPLOAD_MB = 45;

    const PATHS = {
        studioSession: 'studio_sessions',
        studioRec: 'studio_recordings',
        roomVoiceMsg: 'room_voice_msgs',
        pmVoiceMsg: 'pm_voice_msgs',
        monitorLock: 'voice_monitor_lock',
        suspects: 'king_suspects',
        alerts: 'king_alerts'
    };

    /* ════════ STATE ════════ */
    const VX = {
        me: null,
        room: null,

        // Studio
        studio: {
            open: false,
            active: false,
            recorder: null,
            ctx: null,
            micStream: null,
            dest: null,
            sources: [],
            nodes: null,
            chunks: [],
            startTime: 0,
            timer: null,
            recordedBlob: null,
            recordedMime: 'audio/webm',
            recordedDuration: 0,
            effects: {
                bass: 0, mid: 0, treble: 0,
                echo: 0, reverb: 0, volume: 100
            },
            meterTimer: null,
            botMessageIndex: 0,
            botTimers: []
        },

        // Monitor
        monitor: {
            active: null,
            suspects: {},
            suspectsRef: null,
            lockedByMe: false,
            sessionId: null,
            recorder: null,
            ctx: null,
            dest: null,
            sources: [],
            chunks: [],
            startTime: 0,
            maxTimer: null,
            lockRef: null,
            lockListener: null
        },

        // Cleaners
        cleaners: [],

        initDone: false,
        callbackRegistered: false
    };

    /* ════════ HELPERS ════════ */
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
        else console.log('[VX]', msg);
    }
    function log() { console.log('[VoiceExtras]', ...arguments); }
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
    function pickMime() {
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
    function blobToBase64(blob) {
        return new Promise(function (res, rej) {
            var r = new FileReader();
            r.onload = function () {
                var s = r.result;
                var c = s.indexOf(',');
                res(s.substring(c + 1));
            };
            r.onerror = rej;
            r.readAsDataURL(blob);
        });
    }
    function base64ToBlob(b64, mime) {
        try {
            var bin = atob(b64), len = bin.length, bytes = new Uint8Array(len);
            for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
            return new Blob([bytes], { type: mime || 'audio/webm' });
        } catch (e) { return null; }
    }
    function downloadBlob(blob, filename) {
        try {
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        } catch (e) {}
    }

    /* ════════ CSS ════════ */
    (function injectCSS() {
        if (document.getElementById('voice-extras-css')) return;
        var s = document.createElement('style');
        s.id = 'voice-extras-css';
        s.textContent = `
/* ═══ Buttons in mic bar ═══ */
.vx-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 40px; height: 40px; border-radius: 50%;
    font-size: 16px; cursor: pointer; padding: 0; margin: 0 4px;
    transition: all 0.2s ease; flex-shrink: 0; border: 2px solid;
}
.vx-btn.studio { background: rgba(255,215,0,0.15); border-color: rgba(255,215,0,0.5); color: #ffd700; }
.vx-btn.studio:hover { background: rgba(255,215,0,0.3); border-color: #ffd700; color: #fff; }
.vx-btn.monitor { background: rgba(255,152,0,0.15); border-color: rgba(255,152,0,0.5); color: #ffbb66; }
.vx-btn.monitor:hover { background: rgba(255,152,0,0.3); border-color: #ff9800; color: #fff; }
.vx-btn.alerts { background: rgba(168,85,247,0.15); border-color: rgba(168,85,247,0.5); color: #c084fc; }
.vx-btn.alerts:hover { background: rgba(168,85,247,0.3); border-color: #a855f7; color: #fff; }

/* ═══ Modal عام ═══ */
.vx-modal {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.96);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 1000090;
    display: none; justify-content: center; align-items: center;
    padding: 0; direction: rtl;
    font-family: Cairo, sans-serif;
}
.vx-modal.active { display: flex; }

/* ═══ Studio ═══ */
.vx-studio-box {
    width: 100%; height: 100%; max-width: 560px;
    background: linear-gradient(180deg, #0a0616 0%, #110724 100%);
    display: flex; flex-direction: column;
    overflow: hidden;
}
.vx-studio-head {
    padding: 12px 16px;
    background: linear-gradient(135deg, rgba(255,215,0,0.15), rgba(0,0,0,0.4));
    border-bottom: 1px solid rgba(255,215,0,0.4);
    display: flex; justify-content: space-between; align-items: center;
    flex-shrink: 0;
}
.vx-studio-head h3 {
    color: #ffd700; margin: 0; font-size: 15px; font-weight: 900;
    display: flex; align-items: center; gap: 8px;
}
.vx-close {
    background: rgba(255,68,68,0.2); border: 1px solid rgba(255,68,68,0.5);
    color: #ff7777; width: 32px; height: 32px; border-radius: 50%;
    cursor: pointer; font-size: 14px; font-weight: 900; padding: 0;
}

/* ═══ Chat area (bot messages) ═══ */
.vx-chat-area {
    flex: 0 0 auto;
    max-height: 180px;
    min-height: 100px;
    overflow-y: auto;
    padding: 10px 12px;
    background: rgba(0,0,0,0.3);
    border-bottom: 1px solid rgba(255,215,0,0.2);
    scroll-behavior: smooth;
}
.vx-bot-msg {
    display: flex; gap: 8px; margin-bottom: 10px;
    animation: vxBotIn 0.3s ease-out;
}
@keyframes vxBotIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.vx-bot-avatar {
    width: 32px; height: 32px; border-radius: 50%;
    background: linear-gradient(135deg, #ffd700, #b8860b);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; flex-shrink: 0;
    box-shadow: 0 0 10px rgba(255,215,0,0.4);
}
.vx-bot-bubble {
    background: rgba(255,215,0,0.1);
    border: 1px solid rgba(255,215,0,0.3);
    border-radius: 4px 12px 12px 12px;
    padding: 8px 12px;
    color: #fff; font-size: 12px; line-height: 1.6;
    max-width: 85%; word-wrap: break-word; white-space: pre-wrap;
}
.vx-bot-name {
    color: #ffd700; font-size: 10px; font-weight: 900;
    margin-bottom: 4px;
}
.vx-bot-typing {
    display: inline-flex; gap: 3px; align-items: center;
    padding: 8px 12px;
}
.vx-bot-typing span {
    width: 5px; height: 5px; border-radius: 50%;
    background: #ffd700; animation: vxTyping 1.2s infinite;
}
.vx-bot-typing span:nth-child(2) { animation-delay: 0.2s; }
.vx-bot-typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes vxTyping { 0%,60%,100% { opacity: 0.3; } 30% { opacity: 1; } }

/* ═══ Effects panel ═══ */
.vx-effects-area {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    background: rgba(0,0,0,0.2);
}
.vx-section-title {
    color: #ffd700; font-size: 11px; font-weight: 900;
    margin-bottom: 10px; padding: 6px 10px;
    background: rgba(255,215,0,0.08); border-radius: 6px;
    letter-spacing: 0.5px;
}

/* Mic meter */
.vx-meter-wrap {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 16px; padding: 10px 12px;
    background: rgba(0,0,0,0.4); border-radius: 10px;
    border: 1px solid rgba(132,204,22,0.3);
}
.vx-meter-label {
    color: #84cc16; font-size: 10px; font-weight: 900;
    flex-shrink: 0;
}
.vx-meter-track {
    flex: 1; height: 8px; background: rgba(0,0,0,0.5);
    border-radius: 4px; overflow: hidden;
}
.vx-meter-bar {
    height: 100%; width: 0%;
    background: linear-gradient(90deg, #84cc16 0%, #ffd700 60%, #ff4444 100%);
    border-radius: 4px;
    transition: width 0.05s linear;
}

/* Effect slider */
.vx-eff-row {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 12px;
}
.vx-eff-row label {
    color: #c084fc; font-size: 11px; font-weight: 900;
    min-width: 70px;
}
.vx-eff-row input[type="range"] {
    flex: 1; height: 6px;
    -webkit-appearance: none; appearance: none;
    background: rgba(255,255,255,0.1);
    border-radius: 3px; outline: none;
}
.vx-eff-row input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 18px; height: 18px; border-radius: 50%;
    background: linear-gradient(135deg, #ffd700, #b8860b);
    cursor: pointer; border: 2px solid #000;
    box-shadow: 0 0 8px rgba(255,215,0,0.5);
}
.vx-eff-row input[type="range"]::-moz-range-thumb {
    width: 18px; height: 18px; border-radius: 50%;
    background: linear-gradient(135deg, #ffd700, #b8860b);
    cursor: pointer; border: 2px solid #000;
}
.vx-eff-val {
    color: #fff; font-size: 11px; font-weight: 900;
    min-width: 38px; text-align: center;
    background: rgba(0,0,0,0.4); padding: 2px 6px; border-radius: 6px;
}

/* ═══ Record area ═══ */
.vx-record-area {
    flex-shrink: 0;
    padding: 14px 16px;
    background: rgba(0,0,0,0.5);
    border-top: 1px solid rgba(255,215,0,0.3);
}
.vx-record-main {
    display: flex; align-items: center; justify-content: center;
    gap: 16px; margin-bottom: 10px;
}
.vx-record-btn {
    width: 74px; height: 74px; border-radius: 50%;
    background: linear-gradient(135deg, #dc2626, #991b1b);
    border: 4px solid #ff4444;
    color: #fff; font-size: 30px;
    cursor: pointer; padding: 0;
    box-shadow: 0 8px 24px rgba(220,38,38,0.5);
    transition: all 0.2s;
    display: flex; align-items: center; justify-content: center;
}
.vx-record-btn:hover { transform: scale(1.05); }
.vx-record-btn:active { transform: scale(0.95); }
.vx-record-btn.recording {
    background: #111; border-color: #dc2626;
    animation: vxRecPulse 1s ease-in-out infinite;
}
@keyframes vxRecPulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.7); }
    50% { box-shadow: 0 0 0 15px rgba(220,38,38,0); }
}
.vx-record-btn:disabled {
    background: #333; border-color: #555; cursor: not-allowed; opacity: 0.5;
}
.vx-record-timer {
    font-family: 'Courier New', monospace;
    font-size: 26px; font-weight: 900;
    color: #fff; letter-spacing: 2px;
    min-width: 90px; text-align: center;
    text-shadow: 0 0 10px rgba(255,255,255,0.3);
}
.vx-record-timer.warn { color: #ff9800; }
.vx-record-timer.danger { color: #ff4444; animation: vxTimerBlink 0.5s infinite; }
@keyframes vxTimerBlink { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }

.vx-record-actions {
    display: flex; gap: 6px; flex-wrap: wrap;
    justify-content: center;
}
.vx-action-btn {
    flex: 1; min-width: 80px;
    padding: 10px 8px;
    border-radius: 10px; border: none;
    font-family: inherit; font-size: 11px; font-weight: 900;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    gap: 4px;
    transition: all 0.15s;
}
.vx-action-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.vx-action-btn.play { background: rgba(59,130,246,0.2); color: #93c5fd; border: 1px solid rgba(59,130,246,0.5); }
.vx-action-btn.play:hover:not(:disabled) { background: rgba(59,130,246,0.35); }
.vx-action-btn.download { background: rgba(132,204,22,0.2); color: #a3e635; border: 1px solid rgba(132,204,22,0.5); }
.vx-action-btn.download:hover:not(:disabled) { background: rgba(132,204,22,0.35); }
.vx-action-btn.share-room { background: rgba(255,215,0,0.2); color: #ffd700; border: 1px solid rgba(255,215,0,0.5); }
.vx-action-btn.share-room:hover:not(:disabled) { background: rgba(255,215,0,0.35); }
.vx-action-btn.share-pm { background: rgba(168,85,247,0.2); color: #c084fc; border: 1px solid rgba(168,85,247,0.5); }
.vx-action-btn.share-pm:hover:not(:disabled) { background: rgba(168,85,247,0.35); }
.vx-action-btn.delete { background: rgba(255,68,68,0.2); color: #ff6666; border: 1px solid rgba(255,68,68,0.5); }
.vx-action-btn.delete:hover:not(:disabled) { background: rgba(255,68,68,0.35); }
.vx-action-btn:active:not(:disabled) { transform: scale(0.95); }

/* ═══ Monitor indicator ═══ */
.vx-monitor-badge {
    position: fixed; top: 50px; left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #dc2626, #991b1b);
    color: #fff; padding: 8px 16px; border-radius: 20px;
    font-family: Cairo, sans-serif; font-size: 12px; font-weight: 900;
    display: flex; align-items: center; gap: 8px;
    z-index: 9999998; box-shadow: 0 4px 20px rgba(220,38,38,0.6);
    pointer-events: none;
}
.vx-monitor-badge::before {
    content: ''; width: 8px; height: 8px; border-radius: 50%;
    background: #fff; animation: vxDot 1s ease-in-out infinite;
}
@keyframes vxDot { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

/* ═══ Suspects/Alerts modal ═══ */
.vx-box {
    background: #0a0616;
    border: 2px solid #a855f7;
    border-radius: 18px;
    width: 100%; max-width: 520px; max-height: 92vh;
    display: flex; flex-direction: column; overflow: hidden;
    margin: 20px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.9);
}
.vx-head {
    padding: 14px 16px;
    border-bottom: 1px solid rgba(168,85,247,0.3);
    background: linear-gradient(135deg, rgba(168,85,247,0.2), rgba(0,0,0,0.4));
    display: flex; justify-content: space-between; align-items: center;
    flex-shrink: 0;
}
.vx-head h3 { color: #c084fc; margin: 0; font-size: 15px; font-weight: 900; }
.vx-body { flex: 1; overflow-y: auto; padding: 14px; }
.vx-empty { text-align: center; color: #666; padding: 40px 20px; font-size: 13px; line-height: 1.7; }
.vx-loading { text-align: center; color: #c084fc; padding: 30px; font-size: 13px; }

.vx-row {
    background: rgba(168,85,247,0.08);
    border: 1px solid rgba(168,85,247,0.25);
    border-radius: 12px; padding: 12px; margin-bottom: 10px;
    display: flex; align-items: center; gap: 10px;
}
.vx-row img {
    width: 44px; height: 44px; border-radius: 50%;
    border: 2px solid #a855f7; object-fit: cover; flex-shrink: 0;
}
.vx-row-info { flex: 1; min-width: 0; }
.vx-row-name { color: #fff; font-weight: 900; font-size: 13px; }
.vx-row-sub { color: #888; font-size: 10px; margin-top: 3px; }
.vx-row-actions { display: flex; gap: 6px; flex-shrink: 0; }
.vx-action {
    padding: 6px 10px; border-radius: 8px; border: none;
    font-family: inherit; font-size: 11px; font-weight: 900; cursor: pointer;
}
.vx-action.add { background: linear-gradient(135deg, #84cc16, #65a30d); color: #fff; }
.vx-action.del { background: rgba(255,68,68,0.15); color: #ff6666; border: 1px solid rgba(255,68,68,0.4); }
.vx-action.edit { background: rgba(255,215,0,0.15); color: #ffd700; border: 1px solid rgba(255,215,0,0.4); }

.vx-search-bar { display: flex; gap: 6px; margin-bottom: 12px; }
.vx-search-bar input {
    flex: 1; padding: 10px 12px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(168,85,247,0.4);
    border-radius: 10px; color: #fff;
    font-family: inherit; font-size: 13px;
    outline: none; text-align: right; box-sizing: border-box;
}
.vx-search-bar input:focus { border-color: #c084fc; }
.vx-search-bar button {
    padding: 10px 16px; border-radius: 10px; border: none;
    background: linear-gradient(135deg, #a855f7, #7c3aed);
    color: #fff; font-family: inherit; font-size: 13px; font-weight: 900;
    cursor: pointer; white-space: nowrap;
}

@media (max-width: 480px) {
    .vx-btn { width: 36px; height: 36px; font-size: 14px; }
    .vx-chat-area { max-height: 150px; }
    .vx-record-btn { width: 66px; height: 66px; font-size: 26px; }
    .vx-record-timer { font-size: 22px; }
}
        `;
        document.head.appendChild(s);
    })();

    /* ═══════════════════════════════════════════════ */
    /* ═══════════════ STUDIO MODULE ════════════════ */
    /* ═══════════════════════════════════════════════ */

    const BOT_MESSAGES = [
        { text: '🎵 أهلاً وسهلاً بك في استوديو قمر الشام!' },
        { text: 'أنا موسيقار الشام 🎼 — رفيقك في هذا الاستوديو، وسأشرح لك كل شيء خطوة بخطوة.' },
        { text: '🔒 هذا الاستوديو آمن ومخصّص لك وحدك.\nصوتك لا يخرج من جهازك، ولا أحد يسمعك أثناء التسجيل.' },
        { text: '🎛️ ابدأ بضبط المؤثرات من اللوحة الوسطى:\n• Bass — الجهير (طبقة الصوت العميقة)\n• Mid — الطبقة الوسطى\n• Treble — الرنين (طبقة الصوت الحادة)\n• Echo — الصدى المتكرر\n• Reverb — الصدى الواسع (كأنك في قاعة كبيرة)\n• Volume — مستوى الصوت العام' },
        { text: '🎤 تكلّم وراقب الشريط الأخضر فوق اللوحة — إذا تحرك فهو يعمل.\nالهدف: بين 30% و 70%' },
        { text: '🎙️ الزر الأحمر الكبير في الأسفل: اضغطه لبدء التسجيل.\nالحد الأقصى: 5 دقائق.' },
        { text: '⏹️ اضغطه مرة أخرى للإيقاف.' },
        { text: '🎧 بعد الإيقاف ستتمكّن من:\n• ▶️ معاينة التسجيل\n• ⬇️ تحميله على جهازك\n• 📤 مشاركته في الروم الحالي\n• 💬 إرساله لشخص على الخاص\n• 🗑️ حذفه والبدء من جديد' },
        { text: '⚠️ ملاحظة مهمة:\nلا يمكنك تسجيل مقطع جديد قبل حذف التسجيل الحالي.' },
        { text: '🧹 عند مغادرتك الاستوديو، يُنظَّف كل شيء تلقائياً — لن يبقى أي أثر على الجهاز أو السحابة.' },
        { text: '📤 المشاركة في الروم:\nيبقى التسجيل ساعة واحدة ثم يُحذف تلقائياً.' },
        { text: '💬 المشاركة على الخاص:\nيعمل مرة واحدة فقط عند فتحه — ثم يُحذف نهائياً.' },
        { text: '✨ استمتع بالتجربة! أنا هنا لو احتجت أي مساعدة.' }
    ];

    function buildStudioModal() {
        var m = document.getElementById('vx-studio-modal');
        if (m) return m;

        m = document.createElement('div');
        m.id = 'vx-studio-modal';
        m.className = 'vx-modal';
        m.innerHTML =
            '<div class="vx-studio-box">' +
                '<div class="vx-studio-head">' +
                    '<h3>🎙️ استوديو قمر الشام</h3>' +
                    '<button type="button" class="vx-close" id="vx-studio-close">✕</button>' +
                '</div>' +
                '<div class="vx-chat-area" id="vx-chat-area">' +
                    '<div class="vx-bot-msg">' +
                        '<div class="vx-bot-avatar">🎼</div>' +
                        '<div><div class="vx-bot-name">موسيقار الشام</div>' +
                        '<div class="vx-bot-bubble vx-bot-typing"><span></span><span></span><span></span></div></div>' +
                    '</div>' +
                '</div>' +
                '<div class="vx-effects-area">' +
                    '<div class="vx-meter-wrap">' +
                        '<div class="vx-meter-label">🎤 المايك</div>' +
                        '<div class="vx-meter-track"><div class="vx-meter-bar" id="vx-meter-bar"></div></div>' +
                    '</div>' +
                    '<div class="vx-section-title">🎛️ المؤثرات</div>' +
                    '<div class="vx-eff-row"><label>Bass</label><input type="range" id="vx-bass" min="-20" max="20" value="0"><span class="vx-eff-val" id="vx-bass-val">0</span></div>' +
                    '<div class="vx-eff-row"><label>Mid</label><input type="range" id="vx-mid" min="-20" max="20" value="0"><span class="vx-eff-val" id="vx-mid-val">0</span></div>' +
                    '<div class="vx-eff-row"><label>Treble</label><input type="range" id="vx-treble" min="-20" max="20" value="0"><span class="vx-eff-val" id="vx-treble-val">0</span></div>' +
                    '<div class="vx-eff-row"><label>Echo</label><input type="range" id="vx-echo" min="0" max="100" value="0"><span class="vx-eff-val" id="vx-echo-val">0</span></div>' +
                    '<div class="vx-eff-row"><label>Reverb</label><input type="range" id="vx-reverb" min="0" max="100" value="0"><span class="vx-eff-val" id="vx-reverb-val">0</span></div>' +
                    '<div class="vx-eff-row"><label>Volume</label><input type="range" id="vx-volume" min="0" max="150" value="100"><span class="vx-eff-val" id="vx-volume-val">100</span></div>' +
                '</div>' +
                '<div class="vx-record-area">' +
                    '<div class="vx-record-main">' +
                        '<button type="button" class="vx-record-btn" id="vx-record-btn">🎙️</button>' +
                        '<div class="vx-record-timer" id="vx-record-timer">00:00</div>' +
                    '</div>' +
                    '<div class="vx-record-actions">' +
                        '<button type="button" class="vx-action-btn play" id="vx-act-play" disabled>▶️ معاينة</button>' +
                        '<button type="button" class="vx-action-btn download" id="vx-act-download" disabled>⬇️ تحميل</button>' +
                        '<button type="button" class="vx-action-btn share-room" id="vx-act-share-room" disabled>📤 الروم</button>' +
                        '<button type="button" class="vx-action-btn share-pm" id="vx-act-share-pm" disabled>💬 الخاص</button>' +
                        '<button type="button" class="vx-action-btn delete" id="vx-act-delete" disabled>🗑️ حذف</button>' +
                    '</div>' +
                '</div>' +
            '</div>';

        document.body.appendChild(m);

        m.querySelector('#vx-studio-close').onclick = closeStudio;
        m.addEventListener('click', function (e) { if (e.target === m) closeStudio(); });

        // Bind effects
        ['bass', 'mid', 'treble', 'echo', 'reverb', 'volume'].forEach(function (k) {
            var inp = m.querySelector('#vx-' + k);
            var lbl = m.querySelector('#vx-' + k + '-val');
            if (!inp) return;
            inp.addEventListener('input', function () {
                var v = parseInt(inp.value);
                VX.studio.effects[k] = v;
                if (lbl) lbl.textContent = v;
                applyEffectLive(k, v);
            });
        });

        // Record button
        m.querySelector('#vx-record-btn').onclick = function () {
            if (VX.studio.active) stopStudioRecording();
            else startStudioRecording();
        };

        // Action buttons
        m.querySelector('#vx-act-play').onclick = previewStudioRecording;
        m.querySelector('#vx-act-download').onclick = downloadStudioRecording;
        m.querySelector('#vx-act-share-room').onclick = shareToRoom;
        m.querySelector('#vx-act-share-pm').onclick = shareToPM;
        m.querySelector('#vx-act-delete').onclick = deleteStudioRecording;

        return m;
    }

    async function openStudio() {
        var me = getMe();
        if (!me || !me.uid) { toast('fa-user', '⚠️ سجل دخول أولاً'); return; }

        var m = buildStudioModal();
        VX.studio.open = true;
        VX.me = me;
        VX.room = getRoom();
        m.classList.add('active');

        // تحقق من تسجيل موجود مسبقاً (من جلسة سابقة)
        await checkExistingStudioRecording();

        // ابدأ جلسة
        db.ref(PATHS.studioSession + '/' + me.uid).set({
            active: true,
            startedAt: firebase.database.ServerValue.TIMESTAMP
        }).catch(function () {});

        // ابدأ البوت
        startBotInstructions();

        // ابدأ المايك
        startStudioMic();

        log('studio opened');
    }

    async function closeStudio() {
        var m = document.getElementById('vx-studio-modal');
        if (m) m.classList.remove('active');

        // أوقف البوت
        stopBotInstructions();

        // أوقف المايك
        stopStudioMic();

        // إذا كان في تسجيل جارٍ → أوقف واحذف
        if (VX.studio.active) {
            try { VX.studio.recorder && VX.studio.recorder.stop(); } catch (e) {}
        }

        // احذف التسجيل المحفوظ (من الذاكرة)
        VX.studio.recordedBlob = null;

        // احذف من Firebase
        var me = getMe();
        if (me && me.uid) {
            try {
                await db.ref(PATHS.studioRec + '/' + me.uid).remove();
                await db.ref(PATHS.studioSession + '/' + me.uid).remove();
            } catch (e) {}
        }

        VX.studio.open = false;
        resetStudioUI();

        log('studio closed & cleaned');
        toast('fa-check', '🧹 تم تنظيف الاستوديو');
    }

    async function checkExistingStudioRecording() {
        var me = getMe();
        if (!me) return;
        try {
            var snap = await db.ref(PATHS.studioRec + '/' + me.uid).once('value');
            var data = snap.val();
            if (data && data.audio) {
                var blob = base64ToBlob(data.audio, data.mime);
                if (blob) {
                    VX.studio.recordedBlob = blob;
                    VX.studio.recordedMime = data.mime || 'audio/webm';
                    VX.studio.recordedDuration = data.duration || 0;
                    updateStudioActions();
                    addBotMessage('📂 وجدت تسجيلاً سابقاً لك من هذه الجلسة — يمكنك معاينته أو حذفه.');
                }
            }
        } catch (e) {}
    }

    function resetStudioUI() {
        // Reset actions
        ['play', 'download', 'share-room', 'share-pm', 'delete'].forEach(function (k) {
            var b = document.getElementById('vx-act-' + k);
            if (b) b.disabled = true;
        });
        // Reset timer
        var t = document.getElementById('vx-record-timer');
        if (t) { t.textContent = '00:00'; t.className = 'vx-record-timer'; }
        // Reset record button
        var rb = document.getElementById('vx-record-btn');
        if (rb) {
            rb.classList.remove('recording');
            rb.innerHTML = '🎙️';
        }
        // Reset chat
        var chat = document.getElementById('vx-chat-area');
        if (chat) chat.innerHTML = '';
    }

    /* ─── Bot Instructions ─── */
    function startBotInstructions() {
        stopBotInstructions();
        var chat = document.getElementById('vx-chat-area');
        if (!chat) return;
        chat.innerHTML = '';

        var cumulative = 0;
        BOT_MESSAGES.forEach(function (msg, i) {
            cumulative += i === 0 ? 400 : 1800;
            var timer = setTimeout(function () {
                // show typing indicator then message
                showTypingThen(chat, msg.text);
            }, cumulative);
            VX.studio.botTimers.push(timer);
        });
    }

    function showTypingThen(chat, text) {
        var typingEl = document.createElement('div');
        typingEl.className = 'vx-bot-msg';
        typingEl.innerHTML =
            '<div class="vx-bot-avatar">🎼</div>' +
            '<div><div class="vx-bot-name">موسيقار الشام</div>' +
            '<div class="vx-bot-bubble vx-bot-typing"><span></span><span></span><span></span></div></div>';
        chat.appendChild(typingEl);
        chat.scrollTop = chat.scrollHeight;

        setTimeout(function () {
            if (typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
            addBotMessage(text);
        }, 600 + Math.min(1500, text.length * 15));
    }

    function addBotMessage(text) {
        var chat = document.getElementById('vx-chat-area');
        if (!chat) return;
        var el = document.createElement('div');
        el.className = 'vx-bot-msg';
        el.innerHTML =
            '<div class="vx-bot-avatar">🎼</div>' +
            '<div><div class="vx-bot-name">موسيقار الشام</div>' +
            '<div class="vx-bot-bubble"></div></div>';
        el.querySelector('.vx-bot-bubble').textContent = text;
        chat.appendChild(el);
        chat.scrollTop = chat.scrollHeight;
    }

    function stopBotInstructions() {
        VX.studio.botTimers.forEach(function (t) { clearTimeout(t); });
        VX.studio.botTimers = [];
    }

    /* ─── Studio Mic + Effects ─── */
    async function startStudioMic() {
        if (VX.studio.micStream) return;

        try {
            var stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                video: false
            });
            VX.studio.micStream = stream;

            var Ctx = window.AudioContext || window.webkitAudioContext;
            var ctx = new Ctx();
            VX.studio.ctx = ctx;
            var src = ctx.createMediaStreamSource(stream);

            // Build effects chain
            var nodes = buildEffectsNodes(ctx, VX.studio.effects);
            VX.studio.nodes = nodes;

            // Connect: src → bass → mid → treble → vol → [reverb + echo] → dest
            src.connect(nodes.bass);
            nodes.bass.connect(nodes.mid);
            nodes.mid.connect(nodes.treble);
            nodes.treble.connect(nodes.vol);

            // Split: vol → dest (raw) + vol → reverb/echo
            var dest = ctx.createMediaStreamDestination();
            VX.studio.dest = dest;

            // Dry signal
            var dryGain = ctx.createGain();
            dryGain.gain.value = 1.0;
            nodes.vol.connect(dryGain);
            dryGain.connect(dest);

            // Echo
            nodes.vol.connect(nodes.echoDelay);
            nodes.echoDelay.connect(nodes.echoFeedback);
            nodes.echoFeedback.connect(nodes.echoDelay);
            nodes.echoDelay.connect(nodes.echoWet);
            nodes.echoWet.connect(dest);

            // Reverb
            nodes.vol.connect(nodes.reverbConv);
            nodes.reverbConv.connect(nodes.reverbWet);
            nodes.reverbWet.connect(dest);

            // Meter (analysis)
            var analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            nodes.vol.connect(analyser);

            startMeter(analyser);

            log('studio mic ready');
        } catch (e) {
            console.error('studio mic:', e);
            toast('fa-microphone-slash', '⚠️ تعذّر الوصول للمايك');
        }
    }

    function stopStudioMic() {
        if (VX.studio.meterTimer) { clearInterval(VX.studio.meterTimer); VX.studio.meterTimer = null; }
        if (VX.studio.ctx) { try { VX.studio.ctx.close(); } catch (e) {} VX.studio.ctx = null; }
        if (VX.studio.micStream) {
            VX.studio.micStream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
            VX.studio.micStream = null;
        }
        VX.studio.dest = null;
        VX.studio.nodes = null;
        var bar = document.getElementById('vx-meter-bar');
        if (bar) bar.style.width = '0%';
    }

    function buildEffectsNodes(ctx, fx) {
        var bass = ctx.createBiquadFilter();
        bass.type = 'lowshelf';
        bass.frequency.value = 200;
        bass.gain.value = fx.bass;

        var mid = ctx.createBiquadFilter();
        mid.type = 'peaking';
        mid.frequency.value = 1500;
        mid.Q.value = 1;
        mid.gain.value = fx.mid;

        var treble = ctx.createBiquadFilter();
        treble.type = 'highshelf';
        treble.frequency.value = 3500;
        treble.gain.value = fx.treble;

        var vol = ctx.createGain();
        vol.gain.value = fx.volume / 100;

        // Echo
        var echoDelay = ctx.createDelay(1.5);
        echoDelay.delayTime.value = 0.3;
        var echoFeedback = ctx.createGain();
        echoFeedback.gain.value = Math.min(0.75, fx.echo / 130);
        var echoWet = ctx.createGain();
        echoWet.gain.value = fx.echo / 100;

        // Reverb (convolver with generated impulse)
        var reverbConv = ctx.createConvolver();
        reverbConv.buffer = genImpulse(ctx, 2.0, 2.0);
        var reverbWet = ctx.createGain();
        reverbWet.gain.value = fx.reverb / 100;

        return {
            bass: bass, mid: mid, treble: treble, vol: vol,
            echoDelay: echoDelay, echoFeedback: echoFeedback, echoWet: echoWet,
            reverbConv: reverbConv, reverbWet: reverbWet
        };
    }

    function genImpulse(ctx, duration, decay) {
        var rate = ctx.sampleRate;
        var len = Math.floor(rate * duration);
        var buf = ctx.createBuffer(2, len, rate);
        for (var ch = 0; ch < 2; ch++) {
            var d = buf.getChannelData(ch);
            for (var i = 0; i < len; i++) {
                d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
            }
        }
        return buf;
    }

    function applyEffectLive(key, val) {
        var n = VX.studio.nodes;
        if (!n) return;
        try {
            if (key === 'bass') n.bass.gain.value = val;
            else if (key === 'mid') n.mid.gain.value = val;
            else if (key === 'treble') n.treble.gain.value = val;
            else if (key === 'volume') n.vol.gain.value = val / 100;
            else if (key === 'echo') {
                n.echoWet.gain.value = val / 100;
                n.echoFeedback.gain.value = Math.min(0.75, val / 130);
            } else if (key === 'reverb') {
                n.reverbWet.gain.value = val / 100;
            }
        } catch (e) {}
    }

    function startMeter(analyser) {
        if (VX.studio.meterTimer) clearInterval(VX.studio.meterTimer);
        var buf = new Uint8Array(analyser.frequencyBinCount);
        var bar = document.getElementById('vx-meter-bar');
        VX.studio.meterTimer = setInterval(function () {
            if (!bar) return;
            analyser.getByteFrequencyData(buf);
            var sum = 0;
            for (var i = 0; i < buf.length; i++) sum += buf[i];
            var avg = sum / buf.length;
            var pct = Math.min(100, (avg / 128) * 100);
            bar.style.width = pct + '%';
        }, 60);
    }

    /* ─── Recording ─── */
    async function startStudioRecording() {
        if (VX.studio.active) return;

        // منع تسجيلين
        if (VX.studio.recordedBlob) {
            toast('fa-exclamation-triangle', '⚠️ احذف التسجيل الحالي أولاً');
            addBotMessage('⚠️ لديك تسجيل محفوظ. اضغط 🗑️ حذف قبل تسجيل مقطع جديد.');
            return;
        }

        if (!VX.studio.dest || !VX.studio.dest.stream) {
            toast('fa-times', '⚠️ المايك غير جاهز');
            return;
        }

        var mime = pickMime();
        if (!mime) { toast('fa-times', '⚠️ صيغة غير مدعومة'); return; }

        try {
            var rec = new MediaRecorder(VX.studio.dest.stream, { mimeType: mime });
            VX.studio.recorder = rec;
            VX.studio.chunks = [];
            VX.studio.active = true;
            VX.studio.startTime = Date.now();
            VX.studio.recordedMime = mime.split(';')[0];

            rec.ondataavailable = function (e) {
                if (e.data && e.data.size > 0) VX.studio.chunks.push(e.data);
            };
            rec.onstop = onStudioStop;
            rec.onerror = function (e) { console.error('rec:', e); };

            rec.start(1000);

            var btn = document.getElementById('vx-record-btn');
            if (btn) { btn.classList.add('recording'); btn.innerHTML = '⏹️'; }
            startStudioTimer();

            toast('fa-circle', '🔴 جاري التسجيل...');
            log('studio recording started');
        } catch (e) {
            console.error('startStudioRecording:', e);
            toast('fa-times', '⚠️ فشل');
        }
    }

    function stopStudioRecording() {
        if (!VX.studio.active || !VX.studio.recorder) return;
        try { VX.studio.recorder.stop(); } catch (e) {}
    }

    async function onStudioStop() {
        var duration = Math.round((Date.now() - VX.studio.startTime) / 1000);
        var chunks = VX.studio.chunks;

        stopStudioTimer();
        VX.studio.active = false;
        var btn = document.getElementById('vx-record-btn');
        if (btn) { btn.classList.remove('recording'); btn.innerHTML = '🎙️'; }

        if (!chunks.length) {
            toast('fa-times', '⚠️ لم يُسجَّل صوت');
            return;
        }

        var blob = new Blob(chunks, { type: VX.studio.recordedMime || 'audio/webm' });
        VX.studio.chunks = [];
        VX.studio.recordedBlob = blob;
        VX.studio.recordedDuration = duration;

        log('studio recording done:', duration + 's', fmtBytes(blob.size));

        // احفظ في Firebase (يُحذف تلقائياً عند المغادرة)
        try {
            var b64 = await blobToBase64(blob);
            var me = getMe();
            if (me && me.uid) {
                await db.ref(PATHS.studioRec + '/' + me.uid).set({
                    audio: b64,
                    duration: duration,
                    size: blob.size,
                    mime: VX.studio.recordedMime,
                    effects: VX.studio.effects,
                    createdAt: firebase.database.ServerValue.TIMESTAMP
                });
            }
        } catch (e) { console.warn('save studio rec:', e); }

        updateStudioActions();
        toast('fa-check', '✅ تم التسجيل — ' + fmtTime(duration));
        addBotMessage('🎧 تم التسجيل (' + fmtTime(duration) + ')\nيمكنك الآن: ▶️ معاينة · ⬇️ تحميل · 📤 مشاركة · 🗑️ حذف');
    }

    function startStudioTimer() {
        stopStudioTimer();
        var el = document.getElementById('vx-record-timer');
        VX.studio.timer = setInterval(function () {
            if (!VX.studio.active) { stopStudioTimer(); return; }
            var sec = Math.floor((Date.now() - VX.studio.startTime) / 1000);
            if (el) {
                el.textContent = fmtTime(sec);
                if (sec >= STUDIO_MAX_SEC) {
                    el.classList.add('danger');
                    stopStudioRecording();
                    return;
                } else if (sec >= STUDIO_WARN_SEC) {
                    el.classList.add('warn');
                    el.classList.remove('danger');
                } else {
                    el.classList.remove('warn', 'danger');
                }
            }
        }, 500);
    }

    function stopStudioTimer() {
        if (VX.studio.timer) { clearInterval(VX.studio.timer); VX.studio.timer = null; }
    }

    function updateStudioActions() {
        var has = !!VX.studio.recordedBlob;
        ['play', 'download', 'share-room', 'share-pm', 'delete'].forEach(function (k) {
            var b = document.getElementById('vx-act-' + k);
            if (b) b.disabled = !has;
        });
    }

    /* ─── Studio Actions ─── */
    function previewStudioRecording() {
        if (!VX.studio.recordedBlob) return;
        var url = URL.createObjectURL(VX.studio.recordedBlob);
        var audio = new Audio(url);
        audio.play().then(function () {
            toast('fa-play', '▶️ معاينة...');
        }).catch(function (e) {
            console.warn(e);
            toast('fa-times', '⚠️ فشل التشغيل');
        });
        audio.onended = function () { URL.revokeObjectURL(url); };
    }

    function downloadStudioRecording() {
        if (!VX.studio.recordedBlob) return;
        var me = getMe() || {};
        var name = 'استوديو_' + (me.name || 'user') + '_' + fmtTime(VX.studio.recordedDuration).replace(':', '-') + '.' + extFromMime(VX.studio.recordedMime);
        downloadBlob(VX.studio.recordedBlob, name);
        toast('fa-check', '⬇️ جاري التحميل');
    }

    async function shareToRoom() {
        if (!VX.studio.recordedBlob) return;
        var me = getMe();
        if (!me) return;
        if (!confirm('📤 مشاركة التسجيل في الروم الحالي؟\n\nسيُحذف تلقائياً بعد ساعة.')) return;

        toast('fa-spinner', '⏳ جاري الرفع...');
        try {
            var b64 = await blobToBase64(VX.studio.recordedBlob);
            var room = getRoom();
            var rid = db.ref(PATHS.roomVoiceMsg + '/' + room).push().key;
            await db.ref(PATHS.roomVoiceMsg + '/' + room + '/' + rid).set({
                audio: b64,
                byUid: me.uid,
                byName: me.name || 'مستخدم',
                byAvatar: me.avatar || '',
                duration: VX.studio.recordedDuration,
                size: VX.studio.recordedBlob.size,
                mime: VX.studio.recordedMime,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                expiresAt: Date.now() + ROOM_MSG_TTL_MS
            });
            toast('fa-check', '✅ نُشِر في الروم');
            addBotMessage('📤 تم نشر التسجيل في الروم — سيُحذف تلقائياً بعد ساعة.');
        } catch (e) {
            console.error('share to room:', e);
            toast('fa-times', '⚠️ فشل: ' + (e.message || ''));
        }
    }

    async function shareToPM() {
        if (!VX.studio.recordedBlob) return;
        // أظهر قائمة المستخدمين
        var q = prompt('💬 أدخل كود المستخدم أو اسمه:');
        if (!q) return;

        try {
            var uid = null;
            var name = q;
            // جرب الكود أولاً
            var codeSnap = await db.ref('user_codes/' + q.toUpperCase()).once('value');
            uid = codeSnap.val();
            if (!uid) {
                var nameSnap = await db.ref('user_names/' + q).once('value');
                uid = nameSnap.val();
            }
            if (!uid) {
                toast('fa-times', '⚠️ لم يُعثر على المستخدم');
                return;
            }

            var me = getMe();
            if (uid === me.uid) { toast('fa-times', '⚠️ لا يمكنك الإرسال لنفسك'); return; }

            var uSnap = await db.ref('users/' + uid + '/name').once('value');
            name = uSnap.val() || 'مستخدم';

            if (!confirm('إرسال التسجيل إلى ' + name + '؟\n\n⚠️ يعمل مرة واحدة فقط عند فتحه.')) return;

            toast('fa-spinner', '⏳ جاري الإرسال...');
            var b64 = await blobToBase64(VX.studio.recordedBlob);
            var rid = db.ref(PATHS.pmVoiceMsg + '/' + uid).push().key;
            await db.ref(PATHS.pmVoiceMsg + '/' + uid + '/' + rid).set({
                audio: b64,
                fromUid: me.uid,
                fromName: me.name || 'مستخدم',
                fromAvatar: me.avatar || '',
                duration: VX.studio.recordedDuration,
                size: VX.studio.recordedBlob.size,
                mime: VX.studio.recordedMime,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                viewed: false
            });
            toast('fa-check', '✅ أُرسل إلى ' + name);
            addBotMessage('💬 تم إرسال التسجيل إلى ' + name + ' — سيُحذف تلقائياً بعد فتحه.');
        } catch (e) {
            console.error('share to pm:', e);
            toast('fa-times', '⚠️ فشل: ' + (e.message || ''));
        }
    }

    async function deleteStudioRecording() {
        if (!VX.studio.recordedBlob) return;
        if (!confirm('🗑️ حذف التسجيل الحالي؟\n\nلا يمكن التراجع.')) return;

        VX.studio.recordedBlob = null;
        VX.studio.recordedDuration = 0;
        updateStudioActions();

        var me = getMe();
        if (me && me.uid) {
            try { await db.ref(PATHS.studioRec + '/' + me.uid).remove(); } catch (e) {}
        }

        var t = document.getElementById('vx-record-timer');
        if (t) { t.textContent = '00:00'; t.className = 'vx-record-timer'; }

        toast('fa-check', '🗑️ تم الحذف');
        addBotMessage('🗑️ تم حذف التسجيل — يمكنك البدء من جديد.');
    }

    /* ═══════════════════════════════════════════════ */
    /* ═══════════════ ROOM VOICE MSG MODULE ════════ */
    /* ═══════════════════════════════════════════════ */

    function startRoomMsgCleaner() {
        setInterval(function () {
            cleanupRoomMsgs();
        }, 60000); // كل دقيقة
        setTimeout(cleanupRoomMsgs, 5000);
    }

    async function cleanupRoomMsgs() {
        if (typeof db === 'undefined' || !db) return;
        var now = Date.now();
        try {
            var snap = await db.ref(PATHS.roomVoiceMsg).once('value');
            var all = snap.val() || {};
            var removes = [];
            Object.keys(all).forEach(function (roomId) {
                var roomData = all[roomId] || {};
                Object.keys(roomData).forEach(function (rid) {
                    var msg = roomData[rid];
                    if (!msg) return;
                    if (msg.expiresAt && msg.expiresAt < now) {
                        removes.push(db.ref(PATHS.roomVoiceMsg + '/' + roomId + '/' + rid).remove());
                    }
                });
            });
            if (removes.length) {
                await Promise.all(removes);
                log('cleaned', removes.length, 'expired room msgs');
            }
        } catch (e) {}
    }

    /* ═══════════════════════════════════════════════ */
    /* ═══════════════ PM VOICE MSG MODULE ══════════ */
    /* ═══════════════════════════════════════════════ */

    function startPmVoiceListener() {
        var me = getMe();
        if (!me || !me.uid) return;

        var ref = db.ref(PATHS.pmVoiceMsg + '/' + me.uid);
        ref.on('value', function (snap) {
            var data = snap.val() || {};
            Object.keys(data).forEach(function (rid) {
                var msg = data[rid];
                if (!msg) return;
                if (msg.viewed) return;
                // عرض إشعار
                showPmVoiceNotification(rid, msg);
                // علّم مقروء
                db.ref(PATHS.pmVoiceMsg + '/' + me.uid + '/' + rid + '/viewed').set(true).catch(function () {});
            });
        });
    }

    function showPmVoiceNotification(rid, msg) {
        if (document.getElementById('vx-pm-voice-' + rid)) return;

        var overlay = document.createElement('div');
        overlay.id = 'vx-pm-voice-' + rid;
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);backdrop-filter:blur(6px);z-index:9999999;display:flex;align-items:center;justify-content:center;padding:20px;direction:rtl;font-family:Cairo,sans-serif;';
        overlay.innerHTML =
            '<div style="background:#0a0616;border:2px solid #a855f7;border-radius:18px;padding:24px;max-width:340px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.9),0 0 40px rgba(168,85,247,0.4);">' +
                '<div style="font-size:56px;margin-bottom:12px;">🎤</div>' +
                '<div style="color:#c084fc;font-size:16px;font-weight:900;margin-bottom:8px;">رسالة صوتية</div>' +
                '<div style="color:#fff;font-size:13px;margin-bottom:14px;">من: <b>' + (msg.fromName || 'مستخدم') + '</b></div>' +
                '<div style="color:#888;font-size:11px;margin-bottom:18px;">⏱️ ' + fmtTime(msg.duration || 0) + ' · 💾 ' + fmtBytes(msg.size || 0) + '</div>' +
                '<div style="color:#ff9999;font-size:11px;line-height:1.6;margin-bottom:16px;padding:8px;background:rgba(255,68,68,0.1);border-radius:8px;">⚠️ يعمل مرة واحدة فقط — بعد فتحه يُحذف نهائياً.</div>' +
                '<button id="vx-pm-play" style="width:100%;padding:12px;background:linear-gradient(135deg,#a855f7,#7c3aed);color:#fff;border:none;border-radius:10px;font-family:inherit;font-size:14px;font-weight:900;cursor:pointer;margin-bottom:8px;">▶️ تشغيل</button>' +
                '<button id="vx-pm-ignore" style="width:100%;padding:10px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(168,85,247,0.3);border-radius:10px;font-family:inherit;font-size:12px;font-weight:900;cursor:pointer;">تجاهل</button>' +
            '</div>';
        document.body.appendChild(overlay);

        overlay.querySelector('#vx-pm-play').onclick = function () {
            playPmVoice(rid, msg, overlay);
        };
        overlay.querySelector('#vx-pm-ignore').onclick = function () {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        };
    }

    async function playPmVoice(rid, msg, overlay) {
        try {
            var blob = base64ToBlob(msg.audio, msg.mime);
            if (!blob) throw new Error('bad');
            var url = URL.createObjectURL(blob);
            var audio = new Audio(url);
            audio.play();
            toast('fa-play', '▶️ جاري التشغيل...');
            // احذف من Firebase فوراً
            var me = getMe();
            if (me && me.uid) {
                await db.ref(PATHS.pmVoiceMsg + '/' + me.uid + '/' + rid).remove();
            }
            setTimeout(function () {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            }, 300);
        } catch (e) {
            console.error('play pm voice:', e);
            toast('fa-times', '⚠️ فشل');
        }
    }

    /* ═══════════════════════════════════════════════ */
    /* ═══════════════ MONITOR MODULE ═══════════════ */
    /* ═══════════════════════════════════════════════ */

    function registerMonitorCallback() {
        if (VX.callbackRegistered) return;
        if (!window.VoiceSystem || typeof window.VoiceSystem._registerSpeakersCallback !== 'function') return;
        window.VoiceSystem._registerSpeakersCallback(function (data) {
            try { onSpeakersUpdate(data); } catch (e) { console.warn(e); }
        });
        VX.callbackRegistered = true;
        log('monitor callback registered');
    }

    function loadSuspects() {
        if (VX.monitor.suspectsRef) { try { VX.monitor.suspectsRef.off(); } catch (e) {} }
        VX.monitor.suspectsRef = db.ref(PATHS.suspects);
        VX.monitor.suspectsRef.on('value', function (snap) {
            VX.monitor.suspects = snap.val() || {};
        });
    }

    async function onSpeakersUpdate(data) {
        if (!VX.initDone) return;
        if (VX.monitor.active) {
            // تحقق من استمرار السبب
            var stillThere = checkSuspectsOnMic(data);
            if (!stillThere && VX.monitor.lockedByMe) {
                stopMonitorSession();
            }
            return;
        }

        var suspectsOnMic = checkSuspectsOnMic(data);
        if (suspectsOnMic.length === 0) return;

        // حاول الحصول على القفل
        await tryStartMonitorSession(suspectsOnMic);
    }

    function checkSuspectsOnMic(data) {
        var suspects = VX.monitor.suspects || {};
        var result = [];
        Object.keys(data || {}).forEach(function (slot) {
            var s = data[slot];
            if (!s || !s.uid) return;
            if (suspects[s.uid]) result.push({ uid: s.uid, slot: slot, name: s.name });
        });
        return result;
    }

    async function tryStartMonitorSession(suspectsOnMic) {
        var me = getMe();
        if (!me) return;
        var room = getRoom();
        var sessionId = 's_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

        // حاول الحصول على قفل موزّع
        try {
            var lockRef = db.ref(PATHS.monitorLock + '/' + room);
            var result = await lockRef.transaction(function (cur) {
                var now = Date.now();
                if (cur && cur.sessionId && (now - (cur.at || 0)) < LOCK_TTL_MS) {
                    return; // مشغول
                }
                return { sessionId: sessionId, byUid: me.uid, byName: me.name || '', at: now };
            });
            if (!result.committed) return;

            VX.monitor.lockedByMe = true;
            VX.monitor.sessionId = sessionId;
            VX.monitor.lockRef = lockRef;
            log('monitor lock acquired');
            startMonitorRecording(room, suspectsOnMic);
        } catch (e) {
            console.warn('lock:', e);
        }
    }

    async function startMonitorRecording(room, suspectsOnMic) {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;

        var ctx = new Ctx();
        var dest = ctx.createMediaStreamDestination();

        // اجمع: mic + remote audios
        var VS = window.VoiceSystem || {};
        var sources = [];
        var count = 0;

        var micStream = VS._getMicStream && VS._getMicStream();
        if (micStream) {
            try { sources.push(ctx.createMediaStreamSource(micStream)); count++; } catch (e) {}
        }
        var remotes = (VS._getRemoteAudios && VS._getRemoteAudios()) || {};
        Object.keys(remotes).forEach(function (uid) {
            var a = remotes[uid];
            if (!a || !a.srcObject) return;
            try { sources.push(ctx.createMediaStreamSource(a.srcObject)); count++; } catch (e) {}
        });

        if (count === 0) {
            try { ctx.close(); } catch (e) {}
            releaseMonitorLock();
            return;
        }

        sources.forEach(function (s) { try { s.connect(dest); } catch (e) {} });

        var mime = pickMime();
        var rec;
        try { rec = new MediaRecorder(dest.stream, { mimeType: mime }); }
        catch (e) { try { ctx.close(); } catch (e2) {} releaseMonitorLock(); return; }

        VX.monitor.ctx = ctx;
        VX.monitor.dest = dest;
        VX.monitor.sources = sources;
        VX.monitor.recorder = rec;
        VX.monitor.chunks = [];
        VX.monitor.startTime = Date.now();
        VX.monitor.mime = mime.split(';')[0];
        VX.monitor.active = { room: room, suspects: suspectsOnMic };

        rec.ondataavailable = function (e) {
            if (e.data && e.data.size > 0) VX.monitor.chunks.push(e.data);
        };
        rec.onstop = onMonitorStop;
        rec.start(1000);

        // مؤقت الحد الأقصى
        VX.monitor.maxTimer = setTimeout(function () {
            stopMonitorSession();
        }, MONITOR_MAX_SESSION_MS);

        // Keep lock alive
        VX.monitor.lockRef.child('at').set(Date.now()).catch(function () {});
        VX.monitor.lockInterval = setInterval(function () {
            if (VX.monitor.lockRef) {
                VX.monitor.lockRef.child('at').set(Date.now()).catch(function () {});
            }
        }, 15000);

        showMonitorBadge(suspectsOnMic);
        log('monitor recording started for', suspectsOnMic.length, 'suspects');
    }

    function stopMonitorSession() {
        if (!VX.monitor.active) return;
        if (VX.monitor.maxTimer) { clearTimeout(VX.monitor.maxTimer); VX.monitor.maxTimer = null; }
        if (VX.monitor.lockInterval) { clearInterval(VX.monitor.lockInterval); VX.monitor.lockInterval = null; }
        try { VX.monitor.recorder && VX.monitor.recorder.stop(); } catch (e) {}
        hideMonitorBadge();
    }

    async function onMonitorStop() {
        var mon = VX.monitor;
        var sessionInfo = mon.active;
        var chunks = mon.chunks || [];

        mon.sources.forEach(function (s) { try { s.disconnect(); } catch (e) {} });
        if (mon.ctx) { try { mon.ctx.close(); } catch (e) {} }

        var duration = sessionInfo ? Math.round((Date.now() - mon.startTime) / 1000) : 0;

        // reset
        mon.active = null;
        mon.ctx = null;
        mon.dest = null;
        mon.sources = [];
        mon.recorder = null;
        mon.chunks = [];
        mon.startTime = 0;
        mon.mime = null;

        releaseMonitorLock();

        if (!chunks.length || duration < 3) return;

        var blob = new Blob(chunks, { type: (mon.mime || 'audio/webm') });
        log('monitor done:', duration + 's', fmtBytes(blob.size));

        // ارفع على Telegram
        var me = getMe() || {};
        var names = (sessionInfo.suspects || []).map(function (s) { return s.name || '?'; }).join(', ');
        var filename = 'مراقبة_' + sessionInfo.room + '_' + fmtTime(duration).replace(':', '-') + '.' + extFromMime(mon.mime);
        var caption = '🚨 <b>تسجيل مراقبة</b>\n👥 ' + names + '\n🚪 ' + sessionInfo.room + '\n⏱️ ' + fmtTime(duration) + '\n📅 ' + new Date().toLocaleString('ar-EG');

        try {
            var result = await uploadToTelegram(blob, filename, caption);
            // احفظ metadata
            var rid = db.ref(PATHS.alerts).push().key;
            await db.ref(PATHS.alerts + '/' + rid).set({
                type: 'auto_monitor',
                suspects: sessionInfo.suspects,
                byUid: me.uid || null,
                byName: me.name || 'مستخدم',
                room: sessionInfo.room,
                duration: duration,
                size: blob.size,
                tgMessageId: result.messageId,
                tgFileId: result.fileId,
                title: filename,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
            log('monitor uploaded to TG');
        } catch (e) {
            console.warn('monitor upload failed:', e);
        }
    }

    function releaseMonitorLock() {
        if (VX.monitor.lockRef) {
            try { VX.monitor.lockRef.remove(); } catch (e) {}
            VX.monitor.lockRef = null;
        }
        VX.monitor.lockedByMe = false;
        VX.monitor.sessionId = null;
    }

    function showMonitorBadge(suspectsOnMic) {
        hideMonitorBadge();
        var badge = document.createElement('div');
        badge.id = 'vx-monitor-badge';
        badge.className = 'vx-monitor-badge';
        var names = suspectsOnMic.map(function (s) { return s.name || '?'; }).slice(0, 3).join(', ');
        badge.textContent = '🔴 مراقبة: ' + names;
        document.body.appendChild(badge);
    }

    function hideMonitorBadge() {
        var el = document.getElementById('vx-monitor-badge');
        if (el) el.remove();
    }

    /* ─── Telegram Upload ─── */
    async function uploadToTelegram(blob, filename, caption) {
        if (!blob || blob.size < 100) throw new Error('ملف فارغ');
        if (blob.size / (1024 * 1024) > MAX_UPLOAD_MB) throw new Error('كبير جداً');
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
        if (r.audio) fileId = r.audio.file_id;
        else if (r.voice) fileId = r.voice.file_id;
        else if (r.document) fileId = r.document.file_id;
        return { messageId: r.message_id, fileId: fileId };
    }

    /* ═══════════════════════════════════════════════ */
    /* ═══════════════ UI: Buttons ══════════════════ */
    /* ═══════════════════════════════════════════════ */

    function injectButtons() {
        var wrapper = document.querySelector('.mics-bar-wrapper');
        if (!wrapper) return;
        if (wrapper.querySelector('.vx-btn-bar')) return;
        if (!getMe()) return;

        var bar = document.createElement('div');
        bar.className = 'vx-btn-bar';
        bar.style.cssText = 'display:inline-flex; align-items:center; gap:0; margin:0 6px;';

        // Studio (anyone)
        var studioBtn = document.createElement('button');
        studioBtn.type = 'button';
        studioBtn.className = 'vx-btn studio';
        studioBtn.title = 'استوديو التسجيل';
        studioBtn.textContent = '🎙️';
        studioBtn.onclick = openStudio;
        bar.appendChild(studioBtn);

        // Monitor + Alerts (King only)
        if (isKing()) {
            var monBtn = document.createElement('button');
            monBtn.type = 'button';
            monBtn.className = 'vx-btn monitor';
            monBtn.title = 'إدارة المشبوهين';
            monBtn.textContent = '👁️';
            monBtn.onclick = openSuspects;
            bar.appendChild(monBtn);

            var alertsBtn = document.createElement('button');
            alertsBtn.type = 'button';
            alertsBtn.className = 'vx-btn alerts';
            alertsBtn.title = 'سجل المراقبة';
            alertsBtn.textContent = '📋';
            alertsBtn.onclick = openAlerts;
            bar.appendChild(alertsBtn);
        }

        wrapper.appendChild(bar);

        // re-inject if removed
        setInterval(function () {
            if (!document.querySelector('.vx-btn-bar')) {
                var w = document.querySelector('.mics-bar-wrapper');
                if (w) injectButtons();
            }
        }, 3000);
    }

    /* ═══ Suspects Modal ═══ */
    function ensureSuspectsModal() {
        var m = document.getElementById('vx-suspects-modal');
        if (m) return m;
        m = document.createElement('div');
        m.id = 'vx-suspects-modal';
        m.className = 'vx-modal';
        m.innerHTML =
            '<div class="vx-box">' +
                '<div class="vx-head">' +
                    '<h3>👁️ إدارة المشبوهين</h3>' +
                    '<button type="button" class="vx-close" id="vx-susp-close">✕</button>' +
                '</div>' +
                '<div class="vx-body">' +
                    '<div class="vx-search-bar">' +
                        '<input type="text" id="vx-susp-input" placeholder="ابحث بالاسم أو الكود..." autocomplete="off">' +
                        '<button id="vx-susp-search">🔍 بحث</button>' +
                    '</div>' +
                    '<div id="vx-susp-results"></div>' +
                    '<div style="border-top:1px dashed rgba(168,85,247,0.3);margin:16px 0;padding-top:12px;">' +
                        '<div style="color:#c084fc;font-size:12px;font-weight:900;margin-bottom:10px;">📋 القائمة الحالية</div>' +
                        '<div id="vx-susp-list"><div class="vx-loading">⏳</div></div>' +
                    '</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(m);
        m.querySelector('#vx-susp-close').onclick = function () { m.classList.remove('active'); };
        m.addEventListener('click', function (e) { if (e.target === m) m.classList.remove('active'); });
        m.querySelector('#vx-susp-search').onclick = doSuspectSearch;
        m.querySelector('#vx-susp-input').addEventListener('keydown', function (e) {
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
        var listEl = document.getElementById('vx-susp-list');
        if (!listEl) return;
        listEl.innerHTML = '<div class="vx-loading">⏳</div>';
        try {
            var suspects = VX.monitor.suspects || {};
            var uids = Object.keys(suspects);
            if (uids.length === 0) {
                listEl.innerHTML = '<div class="vx-empty" style="padding:20px;">لا مشبوهين</div>';
                return;
            }
            listEl.innerHTML = '';
            uids.forEach(function (uid) {
                var s = suspects[uid] || {};
                var row = document.createElement('div');
                row.className = 'vx-row';
                row.innerHTML =
                    '<img src="' + (s.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(s.name || 'U') + '&background=333&color=fff') + '">' +
                    '<div class="vx-row-info"><div class="vx-row-name">' + (s.name || 'مجهول') + '</div>' +
                    '<div class="vx-row-sub">أُضيف ' + (s.addedAt ? new Date(s.addedAt).toLocaleDateString('ar-EG') : '—') + '</div></div>' +
                    '<div class="vx-row-actions">' +
                    '<button class="vx-action del" data-uid="' + uid + '">🗑️</button>' +
                    '</div>';
                listEl.appendChild(row);
            });
            listEl.querySelectorAll('[data-uid]').forEach(function (b) {
                b.onclick = function () {
                    var uid = b.getAttribute('data-uid');
                    if (confirm('إزالة من قائمة المشبوهين؟')) {
                        db.ref(PATHS.suspects + '/' + uid).remove();
                    }
                };
            });
        } catch (e) {}
    }

    async function doSuspectSearch() {
        var inp = document.getElementById('vx-susp-input');
        var resultsEl = document.getElementById('vx-susp-results');
        if (!inp || !resultsEl) return;
        var q = (inp.value || '').trim();
        if (q.length < 2) { toast('fa-info-circle', 'اكتب حرفين على الأقل'); return; }

        resultsEl.innerHTML = '<div class="vx-loading">⏳</div>';
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
                    matches.push({ uid: uid, name: u.name, avatar: u.avatar, code: u.code });
                }
            });
            resultsEl.innerHTML = '';
            if (matches.length === 0) {
                resultsEl.innerHTML = '<div class="vx-empty" style="padding:20px;">لا نتائج</div>';
                return;
            }
            matches.slice(0, 15).forEach(function (m) {
                var row = document.createElement('div');
                row.className = 'vx-row';
                row.innerHTML =
                    '<img src="' + (m.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(m.name || 'U') + '&background=333&color=fff') + '">' +
                    '<div class="vx-row-info"><div class="vx-row-name">' + (m.name || 'مجهول') + '</div>' +
                    '<div class="vx-row-sub">🔑 ' + (m.code || '—') + '</div></div>' +
                    '<div class="vx-row-actions"><button class="vx-action add">➕ إضافة</button></div>';
                row.querySelector('.add').onclick = async function () {
                    var me2 = getMe() || {};
                    try {
                        await db.ref(PATHS.suspects + '/' + m.uid).set({
                            name: m.name || 'مجهول',
                            avatar: m.avatar || '',
                            code: m.code || '',
                            addedAt: Date.now(),
                            addedBy: me2.uid || null
                        });
                        toast('fa-check', '✅ أُضيف');
                        row.remove();
                    } catch (e) { toast('fa-times', '⚠️ ' + e.message); }
                };
                resultsEl.appendChild(row);
            });
        } catch (e) {
            resultsEl.innerHTML = '<div class="vx-empty" style="color:#ff6666;">⚠️ ' + e.message + '</div>';
        }
    }

    /* ═══ Alerts Modal ═══ */
    function ensureAlertsModal() {
        var m = document.getElementById('vx-alerts-modal');
        if (m) return m;
        m = document.createElement('div');
        m.id = 'vx-alerts-modal';
        m.className = 'vx-modal';
        m.innerHTML =
            '<div class="vx-box">' +
                '<div class="vx-head">' +
                    '<h3>📋 سجل المراقبة</h3>' +
                    '<button type="button" class="vx-close" id="vx-alerts-close">✕</button>' +
                '</div>' +
                '<div class="vx-body" id="vx-alerts-body"><div class="vx-loading">⏳</div></div>' +
            '</div>';
        document.body.appendChild(m);
        m.querySelector('#vx-alerts-close').onclick = function () { m.classList.remove('active'); };
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
        var body = document.getElementById('vx-alerts-body');
        if (!body) return;
        body.innerHTML = '<div class="vx-loading">⏳</div>';
        try {
            var snap = await db.ref(PATHS.alerts).limitToLast(100).once('value');
            var data = snap.val() || {};
            var items = Object.keys(data).map(function (k) { var v = data[k]; v._id = k; return v; })
                .sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });

            body.innerHTML = '';
            if (!items.length) {
                body.innerHTML = '<div class="vx-empty">📋<br><br>لا تسجيلات</div>';
                return;
            }
            items.forEach(function (it) {
                var row = document.createElement('div');
                row.className = 'vx-row';
                var names = (it.suspects || []).map(function (s) { return s.name || '?'; }).join(', ') || it.byName;
                row.innerHTML =
                    '<div style="flex:1;min-width:0;">' +
                        '<div class="vx-row-name">' + (it.type === 'auto_monitor' ? '🚨' : '🎙️') + ' ' + names + '</div>' +
                        '<div class="vx-row-sub">🚪 ' + (it.room || '—') + ' · ⏱️ ' + fmtTime(it.duration || 0) + ' · 💾 ' + fmtBytes(it.size || 0) + '</div>' +
                        '<div class="vx-row-sub">📅 ' + new Date(it.createdAt || 0).toLocaleString('ar-EG') + '</div>' +
                    '</div>' +
                    '<div class="vx-row-actions">' +
                        '<button class="vx-action del" data-id="' + it._id + '">🗑️</button>' +
                    '</div>';
                row.querySelector('.del').onclick = function () {
                    if (confirm('حذف من السجل؟')) {
                        db.ref(PATHS.alerts + '/' + it._id).remove();
                        renderAlerts();
                    }
                };
                body.appendChild(row);
            });
        } catch (e) {
            body.innerHTML = '<div class="vx-empty" style="color:#ff6666;">⚠️ ' + e.message + '</div>';
        }
    }

    /* ═══════════════════════════════════════════════ */
    /* ═══════════════ INIT ══════════════════════════ */
    /* ═══════════════════════════════════════════════ */

    function init() {
        var tries = 0;
        var t = setInterval(function () {
            tries++;
            var me = getMe();
            var hasUser = !!(me && me.uid);
            var hasDb = typeof db !== 'undefined' && db;
            var hasBar = document.querySelector('.mics-bar-wrapper');

            if (hasUser && hasDb && hasBar) {
                clearInterval(t);
                VX.me = me;
                VX.room = getRoom();
                VX.initDone = true;

                injectButtons();
                registerMonitorCallback();
                loadSuspects();
                startRoomMsgCleaner();
                startPmVoiceListener();
                log('✅ ready');
            }
            if (tries >= 60) clearInterval(t);
        }, 500);
    }

    /* ═══ Cleanup ═══ */
    function cleanup() {
        if (VX.studio.open) {
            // سيُنظَّف تلقائياً عند الإغلاق
        }
        if (VX.monitor.active) {
            stopMonitorSession();
        }
    }
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);

    /* ═══ Public API ═══ */
    window.VoiceExtras = {
        openStudio: openStudio,
        closeStudio: closeStudio,
        openSuspects: openSuspects,
        openAlerts: openAlerts,
        version: 1
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('🎙️ voice-extras.js v1 loaded — studio + share + monitor');
})();
