// ==============================================
// room-alerts.js v5 — عمر التنبيه 10 ثوان
// ==============================================

(function () {
    'use strict';
    if (window.__roomAlertsV5) return;
    window.__roomAlertsV5 = true;

    var MAX_LEN = 300;
    var ALERT_LIFETIME_MS = 10000; // ⏱️ 10 ثوان من الإرسال

    var ICONS = ['📢','⚠️','🚨','🔔','📣','⚡','🔥','💎','👑','💬'];
    var COLORS = [
        { c: '#ffd700', n: 'ذهبي' }, { c: '#ff4444', n: 'أحمر' },
        { c: '#84cc16', n: 'أخضر' }, { c: '#3b82f6', n: 'أزرق' },
        { c: '#ff9800', n: 'برتقالي' }, { c: '#c084fc', n: 'بنفسجي' },
        { c: '#ff69b4', n: 'وردي' }, { c: '#ffffff', n: 'أبيض' }
    ];
    var BGS = [
        { c: '#1a0033', n: 'بنفسجي' }, { c: '#330000', n: 'أحمر' },
        { c: '#001a0d', n: 'أخضر' }, { c: '#000033', n: 'أزرق' },
        { c: '#1a1a1a', n: 'أسود' }, { c: '#2a1500', n: 'بني' }
    ];

    var RA = {
        roomL: null, globalL: null, ctx: null,
        open: false,
        autoCloseTimer: null,
        countdownTimer: null,
        state: {
            text: '', color: '#ffd700', bgColor: '#1a0033',
            size: 'large', position: 'center', icon: '📢',
            sound: true, hidden: false, target: 'room'
        }
    };

    /* ⭐ فحص انتهاء العمر */
    function isExpired(d) {
        if (!d || !d.createdAt) return true;
        return (Date.now() - d.createdAt) >= ALERT_LIFETIME_MS;
    }

    function remainingMs(d) {
        if (!d || !d.createdAt) return 0;
        var r = ALERT_LIFETIME_MS - (Date.now() - d.createdAt);
        return Math.max(0, r);
    }

    /* ═══ صوت ═══ */
    function playSound() {
        try {
            if (!RA.ctx) RA.ctx = new (window.AudioContext || window.webkitAudioContext)();
            var ctx = RA.ctx, t = ctx.currentTime;
            [523.25, 659.25, 783.99, 1046.50].forEach(function (f, i) {
                var o = ctx.createOscillator(), g = ctx.createGain();
                o.type = 'sine';
                o.frequency.setValueAtTime(f, t + i * 0.13);
                g.gain.setValueAtTime(0, t + i * 0.13);
                g.gain.linearRampToValueAtTime(0.35, t + i * 0.13 + 0.03);
                g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.13 + 0.4);
                o.connect(g); g.connect(ctx.destination);
                o.start(t + i * 0.13); o.stop(t + i * 0.13 + 0.45);
            });
        } catch (e) { console.warn('sound error', e); }
    }

    /* ═══ Overlay ═══ */
    function ensureOverlay() {
        var ov = document.getElementById('ra-overlay');
        if (ov) return ov;
        ov = document.createElement('div');
        ov.id = 'ra-overlay';
        ov.innerHTML =
            '<div id="ra-box">' +
                '<div id="ra-icon">📢</div>' +
                '<div id="ra-title">تنبيه</div>' +
                '<div id="ra-text"></div>' +
                '<div id="ra-sender"></div>' +
                '<div id="ra-timer" style="font-size:11px;color:#888;margin-top:8px;font-weight:700;"></div>' +
                '<button id="ra-close-btn" type="button">حسناً ✓</button>' +
            '</div>';
        document.body.appendChild(ov);
        ov.querySelector('#ra-close-btn').onclick = closeAlert;
        return ov;
    }

    function showAlert(d) {
        if (!d || !d.text) return;

        // ⭐⭐ فحص انتهاء العمر
        if (isExpired(d)) {
            console.log('⏭ alert expired (age > 10s)');
            return;
        }

        var ov = ensureOverlay();
        var box = ov.querySelector('#ra-box');
        var col = d.color || '#ffd700';
        var bg = d.bgColor || '#1a0033';

        ov.className = '';
        box.className = '';
        box.classList.add('ra-size-' + (d.size || 'large'));
        box.style.borderColor = col;
        box.style.color = col;
        box.style.background = 'linear-gradient(135deg, ' + bg + ' 0%, rgba(0,0,0,0.96) 100%)';

        ov.querySelector('#ra-icon').textContent = d.icon || '📢';
        ov.querySelector('#ra-title').textContent = (d.target === 'all') ? '📡 تنبيه عام' : '📢 تنبيه الغرفة';
        ov.querySelector('#ra-text').textContent = d.text;

        var sEl = ov.querySelector('#ra-sender');
        if (d.hidden || !d.senderName) { sEl.textContent = ''; sEl.style.display = 'none'; }
        else { sEl.textContent = '— ' + d.senderName; sEl.style.display = ''; }

        var pos = d.position || 'center';
        if (pos === 'top') ov.classList.add('ra-pos-top');
        else if (pos === 'bottom') ov.classList.add('ra-pos-bottom');
        else ov.classList.add('ra-pos-center');

        ov.classList.add('active');
        if (d.sound !== false) playSound();

        // ⏱️ مؤقّت الإغلاق التلقائي = الوقت المتبقي من 10 ثوان
        var remaining = Math.ceil(remainingMs(d) / 1000);
        var timerEl = ov.querySelector('#ra-timer');
        timerEl.textContent = '⏱️ يُغلق تلقائياً بعد ' + remaining + ' ثانية';

        if (RA.autoCloseTimer) clearTimeout(RA.autoCloseTimer);
        if (RA.countdownTimer) clearInterval(RA.countdownTimer);

        RA.countdownTimer = setInterval(function () {
            var r = Math.ceil(remainingMs(d) / 1000);
            if (r <= 0) {
                clearInterval(RA.countdownTimer);
                RA.countdownTimer = null;
                timerEl.textContent = '⏱️ جاري الإغلاق...';
                closeAlert();
            } else {
                timerEl.textContent = '⏱️ يُغلق تلقائياً بعد ' + r + ' ثانية';
            }
        }, 500);

        RA.autoCloseTimer = setTimeout(closeAlert, remainingMs(d));
    }

    function closeAlert() {
        var ov = document.getElementById('ra-overlay');
        if (RA.autoCloseTimer) { clearTimeout(RA.autoCloseTimer); RA.autoCloseTimer = null; }
        if (RA.countdownTimer) { clearInterval(RA.countdownTimer); RA.countdownTimer = null; }
        if (!ov) return;
        ov.classList.remove('active');
    }

    /* ═══ Listeners ═══ */
    function startListening() {
        if (typeof db === 'undefined' || !db) { setTimeout(startListening, 1500); return; }
        if (!getCurrentUser()) { setTimeout(startListening, 1500); return; }

        if (RA.roomL) { try { RA.roomL.off(); } catch (e) {} }
        if (RA.globalL) { try { RA.globalL.off(); } catch (e) {} }

        var room = (typeof ChatState !== 'undefined' && ChatState.currentRoom) || 'general';

        RA.roomL = db.ref('room_alerts/' + room + '/current');
        RA.roomL.on('value', function (s) {
            var d = s.val();
            if (!d) return;
            var me = getCurrentUser() || {};
            if (d.senderUid === me.uid) return;
            showAlert(d);
        });

        RA.globalL = db.ref('room_alerts/__global__/current');
        RA.globalL.on('value', function (s) {
            var d = s.val();
            if (!d) return;
            var me = getCurrentUser() || {};
            if (d.senderUid === me.uid) return;
            showAlert(d);
        });

        console.log('🔔 room-alerts v5: ready · room=' + room);
    }

    /* ═══ Permissions ═══ */
    function lvl() {
        var u = getCurrentUser();
        if (!u) return 0;
        return (typeof getRankLevel === 'function') ? getRankLevel(u.rank) : (u.rankLevel || 0);
    }
    function canSendRoom() { return lvl() >= 90; }
    function canSendAll() {
        var u = getCurrentUser();
        if (!u) return false;
        if (u.rank === 'Queen' && u.queenOrder === 2) return false;
        return lvl() >= 90;
    }
    function canOpen() { return canSendRoom() || canSendAll(); }

    /* ═══ Send ═══ */
    function send(state) {
        var u = getCurrentUser();
        if (!u) return;
        if (!state.text.trim()) { if (typeof showToast === 'function') showToast('fa-exclamation', 'اكتب نصاً'); return; }
        if (state.text.length > MAX_LEN) { if (typeof showToast === 'function') showToast('fa-exclamation', 'طويل جداً'); return; }

        var room = (typeof ChatState !== 'undefined' && ChatState.currentRoom) || 'general';
        var path, rid;
        if (state.target === 'all') {
            if (!canSendAll()) { if (typeof showToast === 'function') showToast('fa-lock', '🔒 الملك فقط'); return; }
            path = 'room_alerts/__global__/current'; rid = '__global__';
        } else {
            if (!canSendRoom()) { if (typeof showToast === 'function') showToast('fa-lock', '🔒 لا تملك صلاحية'); return; }
            path = 'room_alerts/' + room + '/current'; rid = room;
        }

        var payload = {
            text: state.text.trim(),
            color: state.color,
            bgColor: state.bgColor,
            size: state.size,
            position: state.position,
            icon: state.icon,
            sound: state.sound !== false,
            hidden: state.hidden || (u.invisible === true),
            senderUid: u.uid,
            senderName: state.hidden ? '' : (u.name || 'إداري'),
            target: state.target,
            roomId: rid,
            createdAt: Date.now()
        };

        db.ref(path).set(payload).then(function () {
            if (typeof showToast === 'function') showToast('fa-check', '✅ تم الإرسال');
            closeCompose();
            try {
                db.ref('audit_log').push({
                    type: 'alert', byUid: u.uid, byName: state.hidden ? '(مخفي)' : u.name,
                    roomId: rid, target: state.target,
                    preview: state.text.substring(0, 100),
                    at: firebase.database.ServerValue.TIMESTAMP
                }).catch(function () {});
            } catch (e) {}
        }).catch(function (e) {
            if (typeof showToast === 'function') showToast('fa-times', '⚠️ فشل: ' + e.message);
        });
    }

    /* ═══ Compose UI ═══ */
    function openCompose() {
        if (!canOpen()) { if (typeof showToast === 'function') showToast('fa-lock', '🔒 لا تملك صلاحية'); return; }
        RA.open = true;
        var me = getCurrentUser() || {};
        RA.state = {
            text: '', color: '#ffd700', bgColor: '#1a0033',
            size: 'large', position: 'center', icon: '📢',
            sound: true, hidden: me.invisible === true, target: 'room'
        };

        var dlg = document.getElementById('ra-compose');
        if (!dlg) {
            dlg = document.createElement('div');
            dlg.id = 'ra-compose';
            dlg.innerHTML = '<div id="ra-compose-box"></div>';
            dlg.addEventListener('click', function (e) { if (e.target === dlg) closeCompose(); });
            document.body.appendChild(dlg);
        }
        dlg.classList.add('active');
        renderCompose();
    }

    function closeCompose() {
        RA.open = false;
        var d = document.getElementById('ra-compose');
        if (d) d.classList.remove('active');
    }

    function renderCompose() {
        var box = document.getElementById('ra-compose-box');
        if (!box) return;
        var s = RA.state;
        var u = getCurrentUser() || {};
        var globalOk = canSendAll();

        var h = '';
        h += '<h3 id="ra-compose-title">📢 إرسال تنبيه</h3>';
        h += '<div class="ra-field"><label>النص (300 حرف كحد أقصى)</label>';
        h += '<textarea id="ra-text" maxlength="' + MAX_LEN + '" placeholder="اكتب هنا..."></textarea>';
        h += '<div class="ra-char-count" id="ra-count">0 / ' + MAX_LEN + '</div></div>';
        h += '<div class="ra-field"><label>الأيقونة</label><div class="ra-colors" id="ra-icons"></div></div>';
        h += '<div class="ra-field"><label>لون النص</label><div class="ra-colors" id="ra-fg"></div></div>';
        h += '<div class="ra-field"><label>لون الخلفية</label><div class="ra-colors" id="ra-bg"></div></div>';
        h += '<div class="ra-field"><label>الحجم</label><div class="ra-sizes" id="ra-sizes"></div></div>';
        h += '<div class="ra-field"><label>الموضع</label><div class="ra-positions" id="ra-pos"></div></div>';

        if (globalOk) {
            h += '<div class="ra-field"><label>الهدف</label><div class="ra-targets" id="ra-target">';
            h += '<button type="button" class="ra-target-btn" data-t="room">📌 هذه الغرفة</button>';
            h += '<button type="button" class="ra-target-btn" data-t="all">📡 كل الشات</button>';
            h += '</div></div>';
        }

        h += '<div class="ra-checkbox-row"><input type="checkbox" id="ra-snd"' + (s.sound ? ' checked' : '') + '><label for="ra-snd">🔊 مع صوت</label></div>';
        h += '<div class="ra-checkbox-row"><input type="checkbox" id="ra-hid"' + ((s.hidden || u.invisible) ? ' checked' : '') + '><label for="ra-hid">👻 إخفاء اسمي</label></div>';
        h += '<div class="ra-field"><label>معاينة</label><div id="ra-preview">';
        h += '<div id="ra-preview-icon">' + s.icon + '</div>';
        h += '<div id="ra-preview-text" style="color:' + s.color + ';">نص التنبيه</div></div></div>';
        h += '<div id="ra-compose-actions">';
        h += '<button id="ra-cancel" type="button">إلغاء</button>';
        h += '<button id="ra-send" type="button">📤 إرسال</button>';
        h += '</div>';

        box.innerHTML = h;

        var ta = document.getElementById('ra-text');
        ta.value = s.text;
        ta.oninput = function () {
            s.text = this.value;
            var cnt = document.getElementById('ra-count');
            cnt.textContent = s.text.length + ' / ' + MAX_LEN;
            cnt.className = 'ra-char-count';
            if (s.text.length >= MAX_LEN) cnt.classList.add('at-limit');
            else if (s.text.length > MAX_LEN * 0.85) cnt.classList.add('near-limit');
            var pt = document.getElementById('ra-preview-text');
            if (pt) pt.textContent = s.text || 'نص التنبيه';
        };
        ta.focus();

        var ic = document.getElementById('ra-icons');
        ICONS.forEach(function (i) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'ra-color-btn' + (s.icon === i ? ' active' : '');
            b.style.background = 'rgba(255,255,255,0.08)';
            b.style.fontSize = '18px';
            b.style.display = 'flex';
            b.style.alignItems = 'center';
            b.style.justifyContent = 'center';
            b.textContent = i;
            b.onclick = function () { s.icon = i; renderCompose(); };
            ic.appendChild(b);
        });

        var fc = document.getElementById('ra-fg');
        COLORS.forEach(function (c) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'ra-color-btn' + (s.color === c.c ? ' active' : '');
            b.style.background = c.c;
            b.style.color = c.c;
            b.title = c.n;
            b.onclick = function () { s.color = c.c; renderCompose(); };
            fc.appendChild(b);
        });

        var bc = document.getElementById('ra-bg');
        BGS.forEach(function (c) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'ra-color-btn' + (s.bgColor === c.c ? ' active' : '');
            b.style.background = c.c;
            b.title = c.n;
            b.onclick = function () { s.bgColor = c.c; renderCompose(); };
            bc.appendChild(b);
        });

        var sz = document.getElementById('ra-sizes');
        [{ i: 'small', n: 'صغير' }, { i: 'medium', n: 'متوسط' }, { i: 'large', n: 'كبير' }, { i: 'huge', n: 'ضخم' }].forEach(function (z) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'ra-size-btn' + (s.size === z.i ? ' active' : '');
            b.textContent = z.n;
            b.onclick = function () { s.size = z.i; renderCompose(); };
            sz.appendChild(b);
        });

        var po = document.getElementById('ra-pos');
        [{ i: 'top', n: '⬆️ أعلى' }, { i: 'center', n: '⬌ منتصف' }, { i: 'bottom', n: '⬇️ أسفل' }].forEach(function (p) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'ra-pos-btn' + (s.position === p.i ? ' active' : '');
            b.textContent = p.n;
            b.onclick = function () { s.position = p.i; renderCompose(); };
            po.appendChild(b);
        });

        if (globalOk) {
            var tr = document.getElementById('ra-target');
            tr.querySelectorAll('.ra-target-btn').forEach(function (b) {
                if (s.target === b.getAttribute('data-t')) b.classList.add('active');
                b.onclick = function () { s.target = b.getAttribute('data-t'); renderCompose(); };
            });
        }

        document.getElementById('ra-snd').onchange = function () { s.sound = this.checked; };
        document.getElementById('ra-hid').onchange = function () { s.hidden = this.checked; };
        document.getElementById('ra-cancel').onclick = closeCompose;
        document.getElementById('ra-send').onclick = function () { send(s); };
    }

    /* ═══ Header Button ═══ */
    function injectBtn() {
        var c = document.querySelector('.header .header-actions');
        if (!c) { setTimeout(injectBtn, 1500); return; }
        if (document.getElementById('ra-send-btn')) return;
        if (!canOpen()) return;
        var b = document.createElement('button');
        b.id = 'ra-send-btn';
        b.type = 'button';
        b.title = 'إرسال تنبيه';
        b.innerHTML = '📢';
        b.onclick = function (e) { e.preventDefault(); e.stopPropagation(); openCompose(); };
        c.insertBefore(b, c.firstChild);
    }

    function observeHeader() {
        var h = document.querySelector('.header');
        if (!h) { setTimeout(observeHeader, 1500); return; }
        new MutationObserver(function () {
            if (!document.getElementById('ra-send-btn') && canOpen()) injectBtn();
        }).observe(h, { childList: true, subtree: true });
        injectBtn();
    }

    function onRoomChanged() {
        closeAlert();
        startListening();
        var old = document.getElementById('ra-send-btn');
        if (old) old.remove();
        injectBtn();
    }

    /* ═══ Public ═══ */
    window.RoomAlerts = {
        open: openCompose,
        close: closeAlert,
        closeCompose: closeCompose,
        startListening: startListening,
        onRoomChanged: onRoomChanged,
        send: send,
        canSend: canOpen,
        canSendGlobal: canSendAll,
        canSendInRoom: canSendRoom
    };

    function init() {
        var t = setInterval(function () {
            if (typeof getCurrentUser === 'function' && getCurrentUser()) {
                clearInterval(t);
                startListening();
                observeHeader();
                console.log('🔔 room-alerts v5: initialized (10s lifetime)');
            }
        }, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

    console.log('🔔 room-alerts.js v5 loaded — 10s lifetime');
})();
