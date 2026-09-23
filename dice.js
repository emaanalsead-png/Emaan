// ==============================================
// dice.js v3.1 — سرعة × 3
// ==============================================

(function () {
    'use strict';
    if (window.__diceV31) return;
    window.__diceV31 = true;

    var DICE_REGEX = /__DICE__:(\d):(\d+)/;
    var DICE_POINTS = { 6: 100, 5: 75, 4: 50, 3: 30, 2: 15, 1: 0 };
    var TILT_X = 14;
    var TILT_Y = 20;

    var TARGET = {
        1: { x: 0,   y: 0 },
        2: { x: 0,   y: 180 },
        3: { x: 0,   y: -90 },
        4: { x: 0,   y: 90 },
        5: { x: -90, y: 0 },
        6: { x: 90,  y: 0 }
    };

    /* ═══ الصوت ═══ */
    var audioCtx = null;
    function getCtx() {
        if (!audioCtx) {
            try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
        }
        return audioCtx;
    }
    function playClack(intensity) {
        var ctx = getCtx(); if (!ctx) return;
        intensity = Math.max(0.15, Math.min(1, intensity || 1));
        var t = ctx.currentTime;
        var bufferSize = Math.floor(ctx.sampleRate * 0.04);
        var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2.5);
        }
        var src = ctx.createBufferSource(); src.buffer = buffer;
        var filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2200 + Math.random() * 900, t);
        filter.Q.setValueAtTime(3.5, t);
        var gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.35 * intensity, t + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        var osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160 + Math.random() * 60, t);
        var oGain = ctx.createGain();
        oGain.gain.setValueAtTime(0, t);
        oGain.gain.linearRampToValueAtTime(0.18 * intensity, t + 0.004);
        oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        osc.connect(oGain); oGain.connect(ctx.destination);
        src.start(t); osc.start(t);
        src.stop(t + 0.08); osc.stop(t + 0.08);
    }

    function buildDiceCube() {
        var stage = document.createElement('div');
        stage.className = 'dice-stage';
        var shadow = document.createElement('div');
        shadow.className = 'dice-shadow';
        var cube = document.createElement('div');
        cube.className = 'dice-cube';
        [1, 2, 3, 4, 5, 6].forEach(function (n) {
            var f = document.createElement('div');
            f.className = 'dice-face face-' + n;
            f.setAttribute('data-n', n);
            cube.appendChild(f);
        });
        stage.appendChild(shadow);
        stage.appendChild(cube);
        return stage;
    }

    function ensureOverlay() {
        var ov = document.getElementById('dice-overlay');
        if (ov) return ov;
        ov = document.createElement('div');
        ov.id = 'dice-overlay';
        document.body.appendChild(ov);
        return ov;
    }

    function settleAnglesFor(result, spinsX, spinsY, spinsZ) {
        var t = TARGET[result];
        return {
            x: spinsX * 360 + t.x + TILT_X,
            y: spinsY * 360 + t.y + TILT_Y,
            z: spinsZ * 360
        };
    }

    function rollDiceAnimated(callback) {
        var ov = ensureOverlay();
        ov.innerHTML = '';
        var stage = buildDiceCube();
        ov.appendChild(stage);
        ov.classList.add('active');

        var cube = stage.querySelector('.dice-cube');
        var shadow = stage.querySelector('.dice-shadow');

        var result = Math.floor(Math.random() * 6) + 1;
        var points = DICE_POINTS[result] || 0;

        var end = settleAnglesFor(result, 2, 2, 1);

        var startX = -180 + Math.random() * 360;
        var startY = -180 + Math.random() * 360;
        var startZ = -180 + Math.random() * 360;

        var keyframes = [
            { transform: 'translate3d(0px, -320px, 0px) rotateX(' + startX + 'deg) rotateY(' + startY + 'deg) rotateZ(' + startZ + 'deg)', offset: 0 },
            { transform: 'translate3d(0px, -40px, 0px) rotateX(' + (startX + 200) + 'deg) rotateY(' + (startY + 200) + 'deg) rotateZ(' + (startZ + 90) + 'deg)', offset: 0.15 },
            { transform: 'translate3d(0px, -110px, 0px) rotateX(' + (startX + 340) + 'deg) rotateY(' + (startY + 340) + 'deg) rotateZ(' + (startZ + 140) + 'deg)', offset: 0.28 },
            { transform: 'translate3d(0px, -20px, 0px) rotateX(' + (startX + 480) + 'deg) rotateY(' + (startY + 480) + 'deg) rotateZ(' + (startZ + 200) + 'deg)', offset: 0.48 },
            { transform: 'translate3d(0px, -55px, 0px) rotateX(' + (startX + 570) + 'deg) rotateY(' + (startY + 570) + 'deg) rotateZ(' + (startZ + 260) + 'deg)', offset: 0.62 },
            { transform: 'translate3d(0px, -8px, 0px) rotateX(' + (startX + 640) + 'deg) rotateY(' + (startY + 640) + 'deg) rotateZ(' + (startZ + 320) + 'deg)', offset: 0.8 },
            { transform: 'translate3d(0px, -18px, 0px) rotateX(' + (startX + 690) + 'deg) rotateY(' + (startY + 690) + 'deg) rotateZ(' + (startZ + 350) + 'deg)', offset: 0.9 },
            { transform: 'translate3d(0px, 0px, 0px) rotateX(' + end.x + 'deg) rotateY(' + end.y + 'deg) rotateZ(' + end.z + 'deg)', offset: 1 }
        ];

        // ⚡ أصوات سريعة (كل ~100ms)
        playClack(0.9);
        setTimeout(function () { playClack(0.7); }, 100);
        setTimeout(function () { playClack(0.55); }, 200);
        setTimeout(function () { playClack(0.4); }, 320);
        setTimeout(function () { playClack(0.3); }, 450);

        // ⚡ مدة الحركة: 1700 → 600ms (× 2.8 أسرع)
        var duration = 600;

        var anim;
        try {
            anim = cube.animate(keyframes, {
                duration: duration,
                easing: 'cubic-bezier(0.22, 0.9, 0.35, 1)',
                fill: 'forwards'
            });
        } catch (e) {
            console.warn('WAAPI not supported, fallback');
            cube.style.transform = 'rotateX(' + end.x + 'deg) rotateY(' + end.y + 'deg) rotateZ(' + end.z + 'deg)';
        }

        try {
            shadow.animate([
                { transform: 'translateX(-50%) scale(0.4)', opacity: 0.1, offset: 0 },
                { transform: 'translateX(-50%) scale(1.2)', opacity: 0.55, offset: 0.15 },
                { transform: 'translateX(-50%) scale(0.9)', opacity: 0.4, offset: 0.28 },
                { transform: 'translateX(-50%) scale(1.1)', opacity: 0.5, offset: 0.48 },
                { transform: 'translateX(-50%) scale(0.95)', opacity: 0.45, offset: 0.62 },
                { transform: 'translateX(-50%) scale(1)', opacity: 0.5, offset: 1 }
            ], {
                duration: duration,
                easing: 'ease-out',
                fill: 'forwards'
            });
        } catch (e) {}

        setTimeout(function () {
            try { if (anim && anim.cancel) anim.cancel(); } catch (e) {}
            cube.style.transform =
                'rotateX(' + end.x + 'deg) rotateY(' + end.y + 'deg) rotateZ(' + end.z + 'deg)';

            setTimeout(function () {
                ov.classList.remove('active');
                if (callback) callback(result, points);
            }, 350);
        }, duration + 50);
    }

    function sendDiceMessage(result, points) {
        var user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
        if (!user) return;
        var text = '__DICE__:' + result + ':' + points;
        var room = (typeof ChatState !== 'undefined' && ChatState.currentRoom) || 'general';
        db.ref('room_messages/' + room).push({
            senderUid: user.uid,
            senderName: user.name,
            senderCode: user.code || null,
            senderAvatar: user.avatar || '',
            senderColor: user.color || '#ffd700',
            senderRank: user.rank,
            senderFrame: user.avatarFrame || 'none',
            text: text,
            mentions: [], replyTo: null,
            time: firebase.database.ServerValue.TIMESTAMP,
            edited: false, deleted: false
        });
        if (points > 0) {
            db.ref('bot_data/quiz/scores/' + user.uid).transaction(function (c) {
                return (c || 0) + points;
            }).catch(function () {});
        }
    }

    function rollDiceAction() {
        var t = document.getElementById('floating-toolbar');
        var b = document.getElementById('plus-btn');
        if (t) t.classList.remove('open');
        if (b) b.classList.remove('active');
        rollDiceAnimated(function (result, points) {
            sendDiceMessage(result, points);
        });
    }

    function replaceDiceMessage(msgEl) {
        if (!msgEl || msgEl.classList.contains('dice-replaced')) return;
        var textEl = msgEl.querySelector('.message-text');
        if (!textEl) return;
        var text = textEl.textContent || '';
        var m = DICE_REGEX.exec(text);
        if (!m) return;

        var result = parseInt(m[1]);
        var points = parseInt(m[2]);
        msgEl.classList.add('dice-replaced');

        var wrap = document.createElement('div');
        wrap.className = 'dice-msg-wrap';

        var stage = buildDiceCube();
        var shadow = stage.querySelector('.dice-shadow');
        if (shadow) shadow.remove();
        var cube = stage.querySelector('.dice-cube');

        var end = settleAnglesFor(result, 0, 0, 0);
        cube.style.transform =
            'rotateX(' + end.x + 'deg) rotateY(' + end.y + 'deg) rotateZ(' + end.z + 'deg)';

        var info = document.createElement('div');
        info.className = 'dice-msg-info';

        var label = document.createElement('div');
        label.className = 'dice-msg-label';
        label.textContent = '🎲';

        var num = document.createElement('div');
        num.className = 'dice-msg-num';
        num.textContent = result;

        var pts = document.createElement('div');
        pts.className = 'dice-msg-points' + (points === 0 ? ' zero' : '');
        pts.textContent = points > 0 ? '+' + points : '0';

        info.appendChild(label);
        info.appendChild(num);
        info.appendChild(pts);

        wrap.appendChild(stage);
        wrap.appendChild(info);

        textEl.innerHTML = '';
        textEl.appendChild(wrap);
    }

    function scanExistingMessages() {
        document.querySelectorAll('#messages .message:not(.dice-replaced)').forEach(replaceDiceMessage);
    }

    function observeMessages() {
        var container = document.getElementById('messages');
        if (!container) { setTimeout(observeMessages, 1500); return; }
        new MutationObserver(function (muts) {
            muts.forEach(function (m) {
                m.addedNodes.forEach(function (node) {
                    if (node.nodeType !== 1) return;
                    if (!node.classList.contains('message')) return;
                    setTimeout(function () { replaceDiceMessage(node); }, 50);
                });
            });
        }).observe(container, { childList: true, subtree: false });
        scanExistingMessages();
    }

    window.Dice = {
        roll: rollDiceAction,
        pointsFor: function (n) { return DICE_POINTS[n] || 0; }
    };
    window.rollDice = rollDiceAction;

    function init() {
        var t = setInterval(function () {
            if (typeof getCurrentUser === 'function' && getCurrentUser()) {
                clearInterval(t);
                observeMessages();
                console.log('🎲 dice.js v3.1: initialized');
            }
        }, 800);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

    console.log('🎲 dice.js v3.1 loaded — speed ×3');
})();
